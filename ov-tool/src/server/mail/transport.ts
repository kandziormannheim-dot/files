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

function getTransporter(): Transporter {
  if (transporter) return transporter;
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
  return process.env.MAIL_FROM || "OV-Management <noreply@localhost>";
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
  const info = await t.sendMail({ from: mailFrom(), ...mail });
  if (!process.env.SMTP_HOST) {
    console.info(`[mail] an ${[mail.to].flat().join(", ")}: ${mail.subject}\n${mail.text}`);
  } else {
    console.info(`[mail] gesendet an ${[mail.to].flat().length} Empfänger: ${mail.subject} (${info.messageId})`);
  }
}
