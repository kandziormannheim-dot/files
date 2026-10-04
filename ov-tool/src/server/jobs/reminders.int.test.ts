import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { addBerlinDays, fromBerlin, toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { captureMailsForTests } from "@/server/mail/transport";
import { createMeeting } from "@/server/services/meetings";
import {
  enforceRetention,
  sendCirculationDeadlineNotices,
  sendInvitationDeadlineWarnings,
  sendRsvpReminders,
  sendTaskReminders,
} from "./reminders";

describe.skipIf(!hasTestDb)("Erinnerungen und Löschfristen (DB)", () => {
  beforeEach(resetDb);

  it("Aufgaben: einmal vor der Frist, einmal bei Überfälligkeit; Gruppe „Vorstand“ ohne Lesezugriff", async () => {
    const outbox = captureMailsForTests();
    const now = fromBerlin(2026, 3, 10, 7);
    const a = await makeUser({ role: "VORSTAND" });
    await makeUser({ role: "LESEZUGRIFF" });
    await db.task.create({ data: { title: "bald", dueDate: fromBerlin(2026, 3, 12), assignees: { create: [{ userId: a.id }] } } });
    await db.task.create({ data: { title: "später", dueDate: fromBerlin(2026, 3, 30), assignees: { create: [{ userId: a.id }] } } });
    await db.task.create({ data: { title: "Gruppe überfällig", dueDate: fromBerlin(2026, 3, 1), assigneeGroup: "VORSTAND" } });
    await db.task.create({ data: { title: "Freitext", dueText: "laufend", assignees: { create: [{ userId: a.id }] } } });
    expect(await sendTaskReminders(now)).toBe(2);
    expect(outbox.map((m) => m.subject).sort()).toEqual(["Erinnerung: bald", "Überfällig: Gruppe überfällig"]);
    expect(outbox.find((m) => m.subject === "Erinnerung: bald")!.text).toContain("am 12.03.2026 fällig");
    expect(await sendTaskReminders(now)).toBe(0); // idempotent
  });

  it("Zu-/Absage-Erinnerung nur an Personen ohne Rückmeldung", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN" });
    const b = await makeUser({ role: "VORSTAND" });
    const m = await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: toDateTimeInput(addBerlinDays(new Date(), 3)), location: "Ort" }));
    await db.meeting.update({ where: { id: m.id }, data: { status: "EINGELADEN", invitationSentAt: new Date() } });
    await db.attendance.update({ where: { meetingId_userId: { meetingId: m.id, userId: b.id } }, data: { response: "ZUGESAGT" } });
    expect(await sendRsvpReminders()).toBe(1);
    expect(outbox[0]!.to).toBe(admin.email);
    expect(outbox[0]!.text).toContain("/rsvp/");
    expect(await sendRsvpReminders()).toBe(0);
  });

  it("Ladungsfrist-Hinweis an Admins, wenn die Einladung bald raus muss", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN" });
    await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: toDateTimeInput(addBerlinDays(new Date(), 30)), location: "Ort" }));
    expect(await sendInvitationDeadlineWarnings()).toBe(0);
    await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: toDateTimeInput(addBerlinDays(new Date(), 8)), location: "Ort" }));
    expect(await sendInvitationDeadlineWarnings()).toBe(1);
    expect(outbox[0]!.subject).toMatch(/^Ladungsfrist: Einladung zur Vorstandssitzung/);
  });

  it("Umlaufverfahren: Hinweis an Admins nach Fristablauf", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN" });
    await db.circulation.create({ data: { number: "U-2026-01", subject: "X", text: "Y", deadline: new Date(Date.now() - 1000), eligibleCount: 3 } });
    expect(await sendCirculationDeadlineNotices()).toBe(1);
    expect(outbox[0]!.to).toBe(admin.email);
    expect(await sendCirculationDeadlineNotices()).toBe(0);
  });

  it("löscht Transkripttext nach Genehmigung bzw. Frist und Bürgerkontakte nach Ablauf", async () => {
    const m = await db.meeting.create({ data: { startsAt: new Date() } });
    const old = await db.meeting.create({ data: { startsAt: new Date() } });
    await db.minutes.create({ data: { meetingId: m.id, status: "GENEHMIGT" } });
    const t1 = await db.transcript.create({ data: { meetingId: m.id, source: "TEAMS", originalName: "a.vtt", text: "Text", status: "ENTWURF_FERTIG", consentConfirmedAt: new Date(), draft: { x: 1 } } });
    const t2 = await db.transcript.create({ data: { meetingId: old.id, source: "ZOOM", originalName: "b.txt", text: "Text", status: "TRANSKRIBIERT", consentConfirmedAt: new Date() } });
    const topic = await db.topic.create({ data: { title: "Anliegen", citizenContact: "enc", contactDeleteAfter: new Date(Date.now() - 1000) } });
    const r = await enforceRetention();
    expect(r).toMatchObject({ texts: 1, contacts: 1 });
    expect((await db.transcript.findUniqueOrThrow({ where: { id: t1.id } })).text).toBeNull();
    expect((await db.transcript.findUniqueOrThrow({ where: { id: t1.id } })).draft).toBeNull();
    expect((await db.transcript.findUniqueOrThrow({ where: { id: t2.id } })).text).toBe("Text");
    expect((await db.topic.findUniqueOrThrow({ where: { id: topic.id } })).citizenContact).toBeNull();
    // nach Ablauf der Frist auch ohne Genehmigung
    expect((await enforceRetention(new Date(Date.now() + 100 * 86_400_000))).texts).toBe(1);
  });
});
