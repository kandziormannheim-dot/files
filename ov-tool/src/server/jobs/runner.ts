import "server-only";
import { PgBoss } from "pg-boss";
import { registerMailQueue } from "@/server/mail/outbox";
import "./definitions";
import { jobHandlers, setJobSender } from "./queue";
import { sendMail, type OutgoingMail } from "@/server/mail/transport";
import {
  enforceRetention,
  runOfficeAutoSend,
  sendCirculationDeadlineNotices,
  sendInvitationDeadlineWarnings,
  sendRsvpReminders,
  sendTaskReminders,
} from "./reminders";

// Job-Queue in Postgres (pg-boss, SPEC.md 5): Mails mit Wiederholung, Erinnerungen, Löschfristen.
// Paket 2.2 registriert hier zusätzlich Transkription und KI-Entwurf (siehe registerWorker).

type MailJob = Omit<OutgoingMail, "attachments"> & {
  attachments?: { filename: string; contentBase64: string; contentType?: string }[];
};

let boss: PgBoss | null = null;

export function getBoss(): PgBoss | null {
  return boss;
}

/** Zeitgesteuerte Aufgaben (Europe/Berlin). */
const SCHEDULES: { queue: string; cron: string; run: () => Promise<unknown> }[] = [
  { queue: "reminders-tasks", cron: "0 7 * * *", run: () => sendTaskReminders() },
  { queue: "reminders-rsvp", cron: "0 9 * * *", run: () => sendRsvpReminders() },
  { queue: "reminders-invitation", cron: "30 8 * * *", run: () => sendInvitationDeadlineWarnings() },
  { queue: "circulation-deadline", cron: "15 * * * *", run: () => sendCirculationDeadlineNotices() },
  { queue: "retention", cron: "30 3 * * *", run: () => enforceRetention() },
  { queue: "office-autosend", cron: "45 * * * *", run: () => runOfficeAutoSend() },
];

export async function startJobs() {
  if (boss || process.env.JOBS_ENABLED === "false" || !process.env.DATABASE_URL) return;
  const instance = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: "pgboss" });
  instance.on("error", (err) => console.error("[jobs]", err));
  await instance.start();
  boss = instance;

  await instance.createQueue("mail", { retryLimit: 5, retryDelay: 60, retryBackoff: true });
  await instance.work<MailJob>("mail", async ([job]) => {
    if (!job) return;
    const { attachments, ...mail } = job.data;
    await sendMail({
      ...mail,
      attachments: attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.contentBase64, "base64"), contentType: a.contentType })),
    });
  });
  registerMailQueue(async (mail) => {
    const data: MailJob = {
      ...mail,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, contentBase64: a.content.toString("base64"), contentType: a.contentType })),
    };
    await instance.send("mail", data);
  });

  for (const s of SCHEDULES) {
    await instance.createQueue(s.queue, { retryLimit: 2, retryDelay: 300 });
    await instance.schedule(s.queue, s.cron, null, { tz: "Europe/Berlin" });
    await instance.work(s.queue, async () => {
      const result = await s.run();
      console.info(`[jobs] ${s.queue}:`, JSON.stringify(result));
    });
  }
  // Transkription und KI-Entwurf: lange Laufzeit, eine Wiederholung
  for (const [queue, handler] of jobHandlers()) {
    await instance.createQueue(queue, { retryLimit: 1, retryDelay: 120, expireInSeconds: 6 * 3600 });
    await instance.work<Record<string, unknown>>(queue, async ([job]) => {
      if (job) await handler(job.data);
    });
  }
  setJobSender((queue, data) => instance.send(queue, data));
  console.info(`[jobs] gestartet: mail, ${[...SCHEDULES.map((s) => s.queue), ...jobHandlers().keys()].join(", ")}`);
}
