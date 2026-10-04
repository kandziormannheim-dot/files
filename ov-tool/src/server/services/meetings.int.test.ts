import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { numberAgenda } from "@/lib/agenda";
import { fromBerlin, toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import {
  addAgendaItem,
  agendaSuggestions,
  cancelMeeting,
  createMeeting,
  deleteAgendaItem,
  reorderAgenda,
  respondByToken,
  setAgendaItemStatus,
} from "./meetings";
import { createProposal, toggleSupport } from "./proposals";

const inDays = (d: number) => toDateTimeInput(new Date(Date.now() + d * 86_400_000));

async function meeting(admin: { id: string; role: "ADMIN"; name: string }, days = 14) {
  return createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: inDays(days), location: "Gasthaus Beispiel" }));
}

describe.skipIf(!hasTestDb)("Sitzungen (DB)", () => {
  beforeEach(resetDb);

  it("belegt die TO vor und legt Teilnehmer mit Stand der Daten an", async () => {
    const admin = await makeUser({ role: "ADMIN", name: "Max Muster", functionTitle: "Ortsvorsitzender" });
    await makeUser({ role: "GAST", loginEnabled: false, votingRight: "OHNE" });
    await makeUser({ role: "VORSTAND", active: false });
    // versendetes, nicht genehmigtes Protokoll einer früheren Sitzung
    const old = await db.meeting.create({ data: { startsAt: fromBerlin(2026, 8, 20, 19), status: "DURCHGEFUEHRT" } });
    const minutes = await db.minutes.create({ data: { meetingId: old.id, status: "VERSENDET", approvalMode: "SITZUNG" } });
    await db.task.create({ data: { title: "Plakate", dueDate: fromBerlin(2020, 1, 1) } });
    await db.topic.create({ data: { title: "Parksituation Hauptstraße", forNextMeeting: true } });

    const m = await meeting(admin as never);
    const items = numberAgenda(await db.agendaItem.findMany({ where: { meetingId: m.id } }));
    expect(items.map((i) => `${i.number} ${i.title}`)).toEqual([
      "1 Begrüßung durch den Vorsitzenden",
      "1.1 Bericht aus dem CDU Kreisverband Mannheim",
      "2 Genehmigung des Protokolls der Sitzung vom 20.08.2026",
      "3 Bericht aus dem BBR Seckenheim",
      "4 Bericht aus dem BBR Friedrichsfeld",
      "5 Bericht aus dem Gemeinderat",
      "6 Stand offener Aufgaben",
      "7 Parksituation Hauptstraße",
      "8 Termine",
      "9 Sonstiges",
    ]);
    expect(items[2]!.minutesToApproveId).toBe(minutes.id);
    expect(await db.topic.count({ where: { forNextMeeting: true } })).toBe(0);
    expect(await db.attendance.count({ where: { meetingId: m.id } })).toBe(2);
    expect(m.responseDeadline).not.toBeNull();
    // Ein zweite Sitzung nimmt dasselbe Protokoll nicht noch einmal auf
    const m2 = await meeting(admin as never, 30);
    expect(await db.agendaItem.count({ where: { meetingId: m2.id, kind: "PROTOKOLLGENEHMIGUNG" } })).toBe(0);
  });

  it("nur Admins legen Sitzungen an; Präsenz braucht einen Ort", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const admin = await makeUser({ role: "ADMIN" });
    await expect(meeting(v as never)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: inDays(10) })),
    ).rejects.toThrow();
  });

  it("fügt neue TOPs vor „Termine“ ein, sortiert und löscht nur vor der Einladung", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const m = await meeting(admin as never);
    await addAgendaItem(admin, m.id, { title: "Planung Infostand" });
    const tops = await db.agendaItem.findMany({ where: { meetingId: m.id, parentId: null }, orderBy: { position: "asc" } });
    expect(tops.map((t) => t.title).slice(-3)).toEqual(["Planung Infostand", "Termine", "Sonstiges"]);
    await reorderAgenda(admin, m.id, null, [...tops.map((t) => t.id)].reverse());
    const after = await db.agendaItem.findMany({ where: { meetingId: m.id, parentId: null }, orderBy: { position: "asc" } });
    expect(after[0]!.title).toBe("Sonstiges");
    await db.meeting.update({ where: { id: m.id }, data: { status: "EINGELADEN" } });
    await expect(deleteAgendaItem(admin, after[0]!.id)).rejects.toBeInstanceOf(UserError);
  });

  it("Zu-/Absage per Link ohne Login, nicht mehr nach Beginn", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const m = await meeting(admin as never);
    const att = await db.attendance.findFirstOrThrow({ where: { meetingId: m.id } });
    await respondByToken(att.responseToken, form({ response: "ABGESAGT", note: "Urlaub" }));
    expect((await db.attendance.findUniqueOrThrow({ where: { id: att.id } })).response).toBe("ABGESAGT");
    await expect(respondByToken("x".repeat(30), form({ response: "ZUGESAGT" }))).rejects.toBeInstanceOf(UserError);
    await db.meeting.update({ where: { id: m.id }, data: { startsAt: new Date(Date.now() - 1000) } });
    await expect(respondByToken(att.responseToken, form({ response: "ZUGESAGT" }))).rejects.toBeInstanceOf(UserError);
  });

  it("schlägt abgesetzte TOPs in der nächsten Sitzung wieder vor", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const m1 = await meeting(admin as never, 5);
    const item = await addAgendaItem(admin, m1.id, { title: "Satzungsänderung" });
    await setAgendaItemStatus(admin, item.id, "VERTAGT");
    const m2 = await meeting(admin as never, 40);
    const s = await agendaSuggestions(m2.id);
    expect(s.carryOvers.map((c) => c.title)).toEqual(["Satzungsänderung"]);
  });

  it("informiert Admins, sobald fünf Mitglieder einen Antrag auf Einberufung tragen", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN" });
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser({ role: "VORSTAND" })));
    const p = await createProposal(users[0]!, form({ title: "Sondersitzung Haushalt", isConveneRequest: true }));
    for (const u of users.slice(1, 4)) await toggleSupport(u, p.id);
    expect(outbox).toHaveLength(0);
    await toggleSupport(users[4]!, p.id);
    expect(outbox.map((o) => o.to)).toEqual([admin.email]);
    expect(outbox[0]!.text).toContain("5 Vorstandsmitgliedern");
  });

  it("Absage informiert nur nach versendeter Einladung", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN", name: "Max Muster", functionTitle: "Ortsvorsitzender" });
    await makeUser({ role: "VORSTAND" });
    const m = await meeting(admin as never);
    await db.meeting.update({ where: { id: m.id }, data: { invitationSentAt: new Date(), status: "EINGELADEN" } });
    await cancelMeeting(admin, m.id, form({ cancelReason: "Krankheit", notify: true }));
    expect(outbox).toHaveLength(2);
    expect(outbox[0]!.subject).toMatch(/^Absage: Vorstandssitzung am \d\d\.\d\d\.\d{4}$/);
    expect(outbox[0]!.text).toContain("Grund: Krankheit");
    expect(outbox[0]!.text).toContain("Max Muster\nOrtsvorsitzender");
  });
});
