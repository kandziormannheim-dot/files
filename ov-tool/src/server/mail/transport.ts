import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };
export type OutgoingMail = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
};

let transporter: Transporter | null = null;
let testOutbox: OutgoingMail[] | null = null;

/** Versandweg: Brevo (SMTP-Relay, Domain cdu-sf.de dort authentifiziert) hat Vorrang vor dem eigenen SMTP-Server. */
export function mailRoute(): { via: "brevo" | "smtp" | "log"; host: string | null } {
  if (process.env.BREVO_SMTP_LOGIN && process.env.BREVO_SMTP_KEY) return { via: "brevo", host: "smtp-relay.brevo.com" };
  if (process.env.SMTP_HOST) return { via: "smtp", host: process.env.SMTP_HOST };
  return { via: "log", host: null };
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (mailRoute().via === "brevo") {
    transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: process.env.BREVO_SMTP_LOGIN, pass: process.env.BREVO_SMTP_KEY },
    });
    return transporter;
  }
  const host = process.env.SMTP_HOST;
  if (!host) {
    // Ohne SMTP (Entwicklung): Mails nur ins Server-Log schreiben.
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export function mailFrom(): string {
  // Über Brevo immer mit der dort authentifizierten Domain cdu-sf.de versenden (sonst landet die Mail im Spam)
  if (mailRoute().via === "brevo") return process.env.BREVO_MAIL_FROM || "CDU Seckenheim-Friedrichsfeld <info@cdu-sf.de>";
  return process.env.MAIL_FROM || "OV-Management <noreply@localhost>";
}

/** Antworten auf Mails des Tools landen hier (z. B. info@cdu-sf.de), auch wenn technisch über eine andere Adresse versendet wird. */
export function mailReplyTo(): string | undefined {
  return process.env.MAIL_REPLY_TO || undefined;
}

/** Nur für Tests: Mails sammeln statt senden. */
export function captureMailsForTests(): OutgoingMail[] {
  testOutbox = [];
  return testOutbox;
}

export async function sendMail(mail: OutgoingMail): Promise<void> {
  if (testOutbox) {
    testOutbox.push(mail);
    return;
  }
  const t = getTransporter();
  const info = await t.sendMail({ from: mailFrom(), replyTo: mailReplyTo(), ...mail });
  if (mailRoute().via === "log") {
    console.info(`[mail] an ${[mail.to].flat().join(", ")}: ${mail.subject}\n${mail.text}`);
  } else {
    console.info(`[mail] gesendet an ${[mail.to].flat().length} Empfänger: ${mail.subject} (${info.messageId})`);
  }
}
