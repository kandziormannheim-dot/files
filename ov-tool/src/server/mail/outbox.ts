import "server-only";
import { sendMail, type OutgoingMail } from "./transport";

type Sender = (mail: OutgoingMail) => Promise<void>;

let queueSender: Sender | null = null;

/** Paket 2.1: Job-Queue registriert sich hier, damit Mails im Hintergrund mit Wiederholung laufen. */
export function registerMailQueue(sender: Sender | null) {
  queueSender = sender;
}

/**
 * Mail nicht-blockierend versenden. Fehler beim Versand dürfen die eigentliche Aktion nicht scheitern lassen;
 * sie werden protokolliert (und über die Queue wiederholt).
 */
export async function queueMail(mail: OutgoingMail): Promise<void> {
  try {
    if (queueSender) await queueSender(mail);
    else await sendMail(mail);
  } catch (err) {
    console.error("[mail] Versand fehlgeschlagen:", mail.subject, err);
  }
}
