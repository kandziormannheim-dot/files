import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { evaluate, voteByToken, determineCirculation } from "./circulations";
import { createMeeting } from "./meetings";
import {
  addResolution,
  closeMeetingNow,
  createNewVersion,
  determineQuorum,
  liveQuorum,
  openMeetingNow,
  reopenMeeting,
  saveSection,
  setPresence,
  startMinutes,
  suspendForNoQuorum,
} from "./minutes";
import { minutesContext } from "./minutes-export";
import { sendMinutes } from "./minutes-workflow";
import { minutesMeetingInclude } from "./minutes";

vi.mock("@/server/pdf/render", () => ({
  renderDocumentPdf: vi.fn(async () => ({ pdf: Buffer.from("%PDF-test"), html: "", version: 1 })),
  wrapDocument: vi.fn(async (html: string) => html),
}));

const inDays = (d: number) => toDateTimeInput(new Date(Date.now() + d * 86_400_000));

async function setup(n = 4) {
  captureMailsForTests();
  const admin = await makeUser({ role: "ADMIN", name: "Max Muster", functionTitle: "Ortsvorsitzender", sortOrder: 1 });
  const others = [];
  for (let i = 0; i < n - 1; i++) others.push(await makeUser({ role: "VORSTAND", sortOrder: 10 + i }));
  await makeUser({ role: "GAST", votingRight: "OHNE", loginEnabled: false, name: "Gerd Gast" });
  const meeting = await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: inDays(1), location: "Gasthaus Beispiel" }));
  const minutes = await startMinutes(admin, meeting.id);
  return { admin, others, meeting, minutes };
}

async function presentAll(adminId: string, minutesId: string, meetingId: string, absent = 0) {
  const atts = await db.attendance.findMany({ where: { meetingId }, orderBy: { sortSnapshot: "asc" } });
  let i = 0;
  for (const a of atts) {
    const presence = a.votingSnapshot === "STIMMBERECHTIGT" && i++ < absent ? "ENTSCHULDIGT" : "ANWESEND";
    await setPresence({ id: adminId, role: "ADMIN", name: "" }, minutesId, a.id, presence);
  }
}

async function finish(admin: Pick<User, "id" | "role" | "name">, minutesId: string, meetingId: string) {
  await openMeetingNow(admin, minutesId);
  await closeMeetingNow(admin, minutesId);
  for (const item of await db.agendaItem.findMany({ where: { meetingId } })) {
    await db.agendaItem.update({ where: { id: item.id }, data: { status: "BEHANDELT" } });
  }
}

describe.skipIf(!hasTestDb)("Protokolle (DB)", () => {
  beforeEach(resetDb);

  it("rechnet die Beschlussfähigkeit nur mit Stimmberechtigten und sperrt Beschlüsse ohne Feststellung", async () => {
    const { admin, meeting, minutes } = await setup(4);
    await presentAll(admin.id, minutes.id, meeting.id, 2);
    const q = await liveQuorum(meeting.id);
    expect(q).toMatchObject({ present: 2, eligible: 4, required: 3, reached: false });
    const item = await db.agendaItem.findFirstOrThrow({ where: { meetingId: meeting.id, parentId: null } });
    await expect(addResolution(admin, minutes.id, item.id, form({ subject: "X", kind: "BESCHLUSS" }))).rejects.toThrow(/Beschlussfähigkeit feststellen/);
    await determineQuorum(admin, minutes.id, form({ determinedBy: "den Vorsitzenden" }));
    await expect(addResolution(admin, minutes.id, item.id, form({ subject: "X", kind: "BESCHLUSS" }))).rejects.toThrow(/nicht beschlussfähig/);
  });

  it("Beschluss mit Stimmen: Mehrheit nach LV § 55, Nummer je Jahr, Ergebniszeile vorbelegt", async () => {
    const { admin, meeting, minutes } = await setup(5);
    await presentAll(admin.id, minutes.id, meeting.id);
    await determineQuorum(admin, minutes.id, form({ determinedBy: "den Vorsitzenden" }));
    const item = await db.agendaItem.findFirstOrThrow({ where: { meetingId: meeting.id, parentId: null } });
    const r1 = await addResolution(admin, minutes.id, item.id, form({ subject: "Infostand", kind: "BESCHLUSS", votesYes: 2, votesNo: 2, votesAbstain: 1 }));
    expect(r1.resultType).toBe("ABGELEHNT");
    const r2 = await addResolution(admin, minutes.id, item.id, form({ subject: "Plakate", kind: "BESCHLUSS", resultType: "ANGENOMMEN_EINSTIMMIG" }));
    expect(r2.number).toMatch(/^\d{4}-02$/);
    await expect(
      addResolution(admin, minutes.id, item.id, form({ subject: "Zu viele", kind: "BESCHLUSS", votesYes: 9 })),
    ).rejects.toThrow(/Mehr Stimmen als anwesende/);
    await expect(
      addResolution(admin, minutes.id, item.id, form({ subject: "ohne Zahlen", kind: "BESCHLUSS", resultType: "ANGENOMMEN_MEHRHEITLICH" })),
    ).rejects.toBeInstanceOf(UserError);
    const section = await db.minutesSection.findFirstOrThrow({ where: { minutesId: minutes.id, agendaItemId: item.id } });
    expect(section.outcomeText).toBe("Der Antrag wird mit 2 Ja-Stimmen, 2 Nein-Stimmen und 1 Enthaltung abgelehnt.");
  });

  it("Versand erst nach vollständiger Prüfliste; danach gesperrt; Korrektur als neue Version", async () => {
    const { admin, meeting, minutes } = await setup(3);
    const vorstand = await db.user.findFirstOrThrow({ where: { role: "VORSTAND" } });
    await presentAll(admin.id, minutes.id, meeting.id);
    await expect(sendMinutes(admin, minutes.id, form({ approvalMode: "SITZUNG" }))).rejects.toThrow(/nicht vollständig/);
    await determineQuorum(admin, minutes.id, form({ determinedBy: "den Vorsitzenden" }));
    await finish(admin, minutes.id, meeting.id);
    await expect(sendMinutes(vorstand, minutes.id, form({ approvalMode: "SITZUNG" }))).rejects.toBeInstanceOf(ForbiddenError);
    const outbox = captureMailsForTests();
    await sendMinutes(admin, minutes.id, form({ approvalMode: "SITZUNG" }));
    expect(outbox.length).toBe(4);
    expect(outbox[0]!.subject).toMatch(/^Protokoll der Vorstandssitzung vom/);
    const item = await db.agendaItem.findFirstOrThrow({ where: { meetingId: meeting.id } });
    await expect(saveSection(admin, minutes.id, item.id, form({ points: "x" }))).rejects.toThrow(/gesperrt/);
    const v2 = await createNewVersion(admin, minutes.id, form({ changeNote: "Tippfehler in TOP 3" }));
    expect(v2.version).toBe(2);
    expect((await db.minutes.findUniqueOrThrow({ where: { id: minutes.id } })).isCurrent).toBe(false);
    // Folgesitzung nimmt die Genehmigung auf; Beschluss dort genehmigt das Protokoll
    await sendMinutes(admin, v2.id, form({ approvalMode: "SITZUNG" }));
    const next = await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: inDays(30), location: "Ort" }));
    const approvalItem = await db.agendaItem.findFirstOrThrow({ where: { meetingId: next.id, kind: "PROTOKOLLGENEHMIGUNG" } });
    expect(approvalItem.minutesToApproveId).toBe(v2.id);
    const m2 = await startMinutes(admin, next.id);
    await presentAll(admin.id, m2.id, next.id);
    await determineQuorum(admin, m2.id, form({ determinedBy: "den Vorsitzenden" }));
    await addResolution(admin, m2.id, approvalItem.id, form({ subject: "Genehmigung", kind: "BESCHLUSS", resultType: "ANGENOMMEN_EINSTIMMIG" }));
    const approved = await db.minutes.findUniqueOrThrow({ where: { id: v2.id } });
    expect(approved.status).toBe("GENEHMIGT");
    expect(approved.approvedAtMeetingId).toBe(next.id);
    expect((await db.minutes.findUniqueOrThrow({ where: { id: m2.id } })).formalities).toMatchObject({ letztesProtokoll: "wird einstimmig genehmigt." });
  });

  it("Genehmigung im Umlaufverfahren: Mehrheit aller Stimmberechtigten", async () => {
    const { admin, others, meeting, minutes } = await setup(4);
    await presentAll(admin.id, minutes.id, meeting.id);
    await determineQuorum(admin, minutes.id, form({ determinedBy: "den Vorsitzenden" }));
    await finish(admin, minutes.id, meeting.id);
    await sendMinutes(admin, minutes.id, form({ approvalMode: "UMLAUF" }));
    const circ = await db.circulation.findFirstOrThrow({ where: { minutesId: minutes.id }, include: { votes: true } });
    expect(circ.eligibleCount).toBe(4);
    const voteOf = (uid: string) => circ.votes.find((v) => v.userId === uid)!.token;
    await voteByToken(voteOf(admin.id), form({ vote: "JA" }));
    await voteByToken(voteOf(others[0]!.id), form({ vote: "JA" }));
    await expect(determineCirculation(admin, circ.id, { announce: false })).rejects.toThrow(/steht noch nicht fest/);
    await voteByToken(voteOf(others[1]!.id), form({ vote: "JA" }));
    await expect(voteByToken(voteOf(others[1]!.id), form({ vote: "NEIN" }))).rejects.toThrow(/bereits abgestimmt/);
    const fresh = await db.circulation.findUniqueOrThrow({ where: { id: circ.id }, include: { votes: true } });
    expect(evaluate(fresh, fresh.votes).final).toBe(true);
    await determineCirculation(admin, circ.id, { announce: true });
    expect((await db.minutes.findUniqueOrThrow({ where: { id: minutes.id } })).status).toBe("GENEHMIGT");
    expect(await db.resolution.count({ where: { circulationId: circ.id } })).toBe(1);
  });

  it("Umlauf wird bei Widerspruch von mehr als einem Viertel sofort unzulässig", async () => {
    const { admin, others, meeting, minutes } = await setup(4);
    await presentAll(admin.id, minutes.id, meeting.id);
    await determineQuorum(admin, minutes.id, form({ determinedBy: "den Vorsitzenden" }));
    await finish(admin, minutes.id, meeting.id);
    await sendMinutes(admin, minutes.id, form({ approvalMode: "UMLAUF" }));
    const circ = await db.circulation.findFirstOrThrow({ where: { minutesId: minutes.id }, include: { votes: true } });
    const voteOf = (uid: string) => circ.votes.find((v) => v.userId === uid)!.token;
    await voteByToken(voteOf(others[0]!.id), form({ vote: "WIDERSPRUCH" })); // 1 von 4 = genau ein Viertel → zulässig
    expect((await db.circulation.findUniqueOrThrow({ where: { id: circ.id } })).status).toBe("LAUFEND");
    await voteByToken(voteOf(others[1]!.id), form({ vote: "WIDERSPRUCH" }));
    expect((await db.circulation.findUniqueOrThrow({ where: { id: circ.id } })).status).toBe("UNZULAESSIG");
    // Protokoll geht zur Genehmigung in die nächste Sitzung
    expect((await db.minutes.findUniqueOrThrow({ where: { id: minutes.id } })).approvalMode).toBe("SITZUNG");
  });

  it("Beschlussunfähigkeit: aufheben, Folgesitzung mit TO; Wiedereröffnung erst mit Quorum", async () => {
    const { admin, meeting, minutes } = await setup(4);
    await presentAll(admin.id, minutes.id, meeting.id, 3);
    await determineQuorum(admin, minutes.id, form({ determinedBy: "den Vorsitzenden" }));
    const repeat = await suspendForNoQuorum(admin, minutes.id, form({ startsAt: inDays(8), location: "Ort" }));
    expect(repeat.isRepeatAfterNoQuorum).toBe(true);
    expect(await db.agendaItem.count({ where: { meetingId: repeat.id } })).toBe(await db.agendaItem.count({ where: { meetingId: meeting.id } }));
    expect((await db.meeting.findUniqueOrThrow({ where: { id: meeting.id } })).status).toBe("AUFGEHOBEN");
    await expect(reopenMeeting(admin, minutes.id)).rejects.toThrow(/Noch nicht beschlussfähig/);
    await presentAll(admin.id, minutes.id, meeting.id, 0);
    await reopenMeeting(admin, minutes.id);
    expect(await db.meeting.findUnique({ where: { id: repeat.id } })).toBeNull();
    const ctxMeeting = await db.meeting.findUniqueOrThrow({ where: { id: meeting.id }, include: minutesMeetingInclude });
    const ctx = await minutesContext(await db.minutes.findUniqueOrThrow({ where: { id: minutes.id } }), ctxMeeting);
    expect(ctx.protokoll.formalia.wiedereroeffnung).toMatch(/Beschlussfähigkeit ist nun gegeben/);
  });
});
