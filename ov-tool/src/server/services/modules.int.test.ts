import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { addCandidate, addPosition, createElection, electionProtocol, getElection, positionStep, recordLot, recordRound } from "./elections";
import { confirmNewsletter, createPage, enforceLandingRetention, getPublicPage, listSubmissions, setPageStatus, submitLanding } from "./landing";
import { createPoll, getPoll, votePoll } from "./polls";
import { approveRelease, confirmContact, createRelease, publicReleases, publishRelease, registerContact, setContactStatus, unsubscribeContact } from "./press";
import { saveMotion, sendMotion } from "./resolutions";

const tokenFrom = (text: string, path: string) => text.match(new RegExp(`${path}/([A-Za-z0-9_-]+)`))?.[1] ?? "";

describe.skipIf(!hasTestDb)("Wahlmanagement (DB)", () => {
  beforeEach(resetDb);

  it("führt eine Einzelwahl über Stichwahl und Los und erzeugt die Niederschrift", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const e = await createElection(admin, form({ title: "MV 2026", date: "2026-11-20T19:00", defaults: "on", assessors: "4" }));
    const full = await getElection(admin, e.id);
    expect(full.positions.map((p) => p.title)).toContain("Beisitzer/innen");
    const chair = full.positions.find((p) => p.title === "Vorsitzende/r")!;
    for (const name of ["Anna Beispiel", "Bernd Muster", "Clara Probe"]) await addCandidate(admin, chair.id, form({ name }));
    const ids = (await db.electionCandidate.findMany({ where: { positionId: chair.id }, orderBy: { name: "asc" } })).map((c) => c.id);
    const [a, b, c] = ids as [string, string, string];
    await db.election.update({ where: { id: e.id }, data: { presentEligible: 25 } });

    await expect(recordRound(admin, chair.id, { sequence: 1, ballotsCast: 26, invalid: 0, abstentions: 0, noVotes: 0, votes: {} })).rejects.toThrow(/mehr Stimmzettel/);
    await expect(recordRound(admin, chair.id, { sequence: 1, ballotsCast: 21, invalid: 0, abstentions: 0, noVotes: 0, votes: { [a]: 9, [b]: 8, [c]: 3 } })).rejects.toThrow(/passen nicht/);
    await recordRound(admin, chair.id, { sequence: 1, ballotsCast: 22, invalid: 1, abstentions: 1, noVotes: 0, votes: { [a]: 9, [b]: 8, [c]: 3 } });
    await expect(recordRound(admin, chair.id, { sequence: 1, ballotsCast: 22, invalid: 1, abstentions: 1, noVotes: 0, votes: { [a]: 9, [b]: 8, [c]: 3 } })).rejects.toThrow(/bereits erfasst/);
    await recordRound(admin, chair.id, { sequence: 2, ballotsCast: 22, invalid: 0, abstentions: 1, noVotes: 0, votes: { [a]: 10, [b]: 8, [c]: 3 } });
    await recordRound(admin, chair.id, { sequence: 3, ballotsCast: 22, invalid: 0, abstentions: 0, noVotes: 0, votes: { [a]: 11, [b]: 11 } });
    await recordRound(admin, chair.id, { sequence: 4, ballotsCast: 22, invalid: 0, abstentions: 0, noVotes: 0, votes: { [a]: 11, [b]: 11 } });
    let pos = (await getElection(admin, e.id)).positions.find((p) => p.id === chair.id)!;
    expect(positionStep(pos)).toMatchObject({ done: false, stage: "LOS" });
    await expect(recordLot(admin, chair.id, [a, b])).rejects.toThrow(/genau 1/);
    await recordLot(admin, chair.id, [b]);
    const done = await getElection(admin, e.id);
    pos = done.positions.find((p) => p.id === chair.id)!;
    expect(positionStep(pos)).toMatchObject({ done: true, elected: [b] });
    const text = electionProtocol(done, "CDU Test");
    expect(text).toContain("Anna Beispiel 9");
    expect(text).toContain("Losentscheid");
    expect(text).toContain("geheim");
  });

  it("prüft Sammelwahl-Plausibilität und Rechte", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const vorstand = await makeUser({ role: "VORSTAND" });
    const e = await createElection(admin, form({ title: "MV", date: "2026-11-20T19:00" }));
    await expect(createElection(vorstand, form({ title: "X", date: "2026-11-20T19:00" }))).rejects.toBeInstanceOf(ForbiddenError);
    await addPosition(admin, e.id, form({ title: "Beisitzer", mode: "SAMMEL", seats: "4" }));
    const p = (await getElection(admin, e.id)).positions[0]!;
    for (const name of ["A", "B", "C", "D", "E"]) await addCandidate(admin, p.id, form({ name }));
    const ids = (await db.electionCandidate.findMany({ where: { positionId: p.id }, orderBy: { name: "asc" } })).map((c) => c.id);
    const votes = Object.fromEntries(ids.map((id, i) => [id, [3, 3, 3, 1, 1][i]!]));
    await expect(recordRound(admin, p.id, { sequence: 1, ballotsCast: 10, invalid: 0, abstentions: 0, noVotes: 0, votes })).rejects.toThrow(/Plausibilität/);
    const r = await recordRound(admin, p.id, { sequence: 1, ballotsCast: 10, invalid: 0, abstentions: 0, noVotes: 0, votes, override: true });
    expect(r.result.kind).toBe("STICHWAHL");
  });
});

describe.skipIf(!hasTestDb)("Meinungsbild (DB)", () => {
  beforeEach(resetDb);
  it("zählt Stimmen, erlaubt Ändern und zeigt bei anonym keine Namen", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const w = await makeUser({ role: "VORSTAND" });
    const poll = await createPoll(v, form({ question: "Termin?", options: "Sa\nSo\nSa", anonymous: "on" }));
    expect(poll.options).toEqual(["Sa", "So"]);
    await votePoll(v, poll.id, [0]);
    await votePoll(w, poll.id, [1]);
    await votePoll(w, poll.id, [0]);
    await expect(votePoll(w, poll.id, [0, 1])).rejects.toBeInstanceOf(UserError);
    const p = await getPoll(v, poll.id);
    expect(p.counts).toEqual([2, 0]);
    expect(p.voters).toEqual([]);
  });
});

describe.skipIf(!hasTestDb)("Landing Pages (DB)", () => {
  beforeEach(resetDb);
  it("zeigt erst nach Freigabe, speichert Einträge, Double-Opt-in und Löschfrist", async () => {
    const outbox = captureMailsForTests();
    const v = await makeUser({ role: "VORSTAND" });
    const admin = await makeUser({ role: "ADMIN" });
    const page = await createPage(v, form({ title: "Sommerfest", slug: "sommerfest", kind: "VERANSTALTUNG", formEnabled: "on", newsletterOption: "on", retentionDays: "30" }));
    expect(page.consentText).toContain("30 Tagen");
    expect(await getPublicPage("sommerfest")).toBeNull();
    await expect(setPageStatus(v, page.id, "FREIGEGEBEN")).rejects.toBeInstanceOf(ForbiddenError);
    await setPageStatus(admin, page.id, "FREIGEGEBEN");
    expect(await getPublicPage("sommerfest")).not.toBeNull();
    await expect(submitLanding("sommerfest", form({ name: "Erika", email: "erika@example.org" }))).rejects.toThrow();
    const res = await submitLanding("sommerfest", form({ name: "Erika", email: "erika@example.org", consent: "on", newsletter: "on" }));
    expect(res.newsletter).toBe(true);
    const token = tokenFrom(outbox.at(-1)!.text, "bestaetigen");
    expect(await confirmNewsletter(token)).toBe(true);
    expect(await confirmNewsletter(token)).toBe(false);
    const subs = await listSubmissions(admin, page.id);
    expect(subs[0]).toMatchObject({ name: "Erika", email: "erika@example.org" });
    expect(subs[0]!.confirmedAt).not.toBeNull();
    await enforceLandingRetention(new Date(Date.now() + 31 * 86_400_000));
    expect(await listSubmissions(admin, page.id)).toHaveLength(0);
  });
});

describe.skipIf(!hasTestDb)("Presse (DB)", () => {
  beforeEach(resetDb);
  it("Registrierung mit Double-Opt-in und Freigabe, Freigabe-Workflow, Einzelversand, Abmeldung", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN" });
    const v = await makeUser({ role: "VORSTAND" });
    await registerContact(form({ name: "Rita Reporter", medium: "Lokalblatt", email: "rita@example.org", consent: "on" }));
    const token = tokenFrom(outbox.at(-1)!.text, "presse/bestaetigen");
    const contact = await db.pressContact.findUniqueOrThrow({ where: { email: "rita@example.org" } });
    await expect(setContactStatus(admin, contact.id, "AKTIV")).rejects.toThrow(/nicht bestätigt/);
    expect(await confirmContact(token)).toBe(true);
    await setContactStatus(admin, contact.id, "AKTIV");

    const pm = await createRelease(v, form({ title: "Sichere Schulwege", body: "Mannheim-Seckenheim. Text." }));
    await expect(publishRelease(admin, pm.id, true)).rejects.toThrow(/freigeben/);
    await expect(approveRelease(v, pm.id)).rejects.toBeInstanceOf(ForbiddenError);
    await approveRelease(admin, pm.id);
    const before = outbox.length;
    const { sent } = await publishRelease(admin, pm.id, true);
    expect(sent).toBe(1);
    expect(outbox.length).toBe(before + 1);
    expect(outbox.at(-1)!.to).toBe("rita@example.org");
    expect(outbox.at(-1)!.text).toContain("presse/abmelden/");
    expect((await publicReleases()).map((r) => r.slug)).toEqual(["sichere-schulwege"]);
    await expect(publishRelease(admin, pm.id, true)).rejects.toThrow(/bereits versendet/);
    const unsub = tokenFrom(outbox.at(-1)!.text, "presse/abmelden");
    expect(await unsubscribeContact(unsub)).toBe(true);
    expect((await db.pressContact.findUniqueOrThrow({ where: { id: contact.id } })).status).toBe("ABGEMELDET");
  });
});

describe.skipIf(!hasTestDb)("Antrag aus Beschluss (DB)", () => {
  beforeEach(resetDb);
  it("legt Antrag an und reicht ihn mit zwei PDFs an die Kreisgeschäftsstelle ein", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN" });
    const v = await makeUser({ role: "VORSTAND" });
    const r = await db.resolution.create({ data: { number: "2026-01", subject: "Tempo 30 Hauptstraße", kind: "BESCHLUSS", resultType: "ANGENOMMEN_EINSTIMMIG", votesYes: 7, votesNo: 0, votesAbstain: 0 } });
    const values = { title: "Tempo 30", recipientName: "CDU-Kreisverband Mannheim", recipientEmail: "kgs@example.org", body: "Der Kreisvorstand möge beschließen: …" };
    await expect(saveMotion(v, r.id, null, form(values))).rejects.toBeInstanceOf(ForbiddenError);
    const m = await saveMotion(admin, r.id, null, form(values));
    await sendMotion(admin, m.id);
    const mail = outbox.at(-1)!;
    expect(mail.to).toBe("kgs@example.org");
    expect(mail.attachments?.map((a) => a.filename)).toEqual(["Antrag-2026-01.pdf", "Beschluss-2026-01.pdf"]);
    expect((await db.motion.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("EINGEREICHT");
    await expect(sendMotion(admin, m.id)).rejects.toThrow(/bereits eingereicht/);
    const rejected = await db.resolution.create({ data: { number: "2026-02", subject: "X", kind: "BESCHLUSS", resultType: "ABGELEHNT" } });
    await expect(saveMotion(admin, rejected.id, null, form(values))).rejects.toThrow(/angenommene/);
  }, 60_000);
});
