import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError } from "@/server/errors";
import { absoluteStoredPath } from "@/server/files";
import { captureMailsForTests } from "@/server/mail/transport";
import type { MinutesDraft } from "./ai-draft";
import { createMeeting } from "./meetings";
import { determineQuorum, setPresence } from "./minutes";
import { applyDraft, uploadTranscript } from "./transcripts";

const draft: MinutesDraft = {
  formalia: { eroeffnung: "19:05 Uhr durch Max Muster.", beschlussfaehig: true, wiedereroeffnung: null, tagesordnung: null, letztesProtokoll: null, eroeffnetUm: "19:05", geschlossenUm: "20:40" },
  abschnitte: [
    { topNummer: "1", status: "BEHANDELT", punkte: [{ text: "Der Ortsvorsitzende begrüßt die Anwesenden.", unterpunkte: [] }], ergebnis: null },
    { topNummer: "5", status: "BEHANDELT", punkte: [{ text: "Kein Bericht.", unterpunkte: [] }], ergebnis: null },
  ],
  beschluesse: [{ topNummer: "1", gegenstand: "Infostand", ergebnisart: "ANGENOMMEN_EINSTIMMIG", ja: null, nein: null, enthaltung: null }],
  aufgaben: [
    { titel: "Infostand anmelden", topNummer: "1", verantwortlich: ["Muster"], fristDatum: "2026-11-20", fristText: null },
    { titel: "nicht gewählt", topNummer: null, verantwortlich: [], fristDatum: null, fristText: "laufend" },
  ],
  verschiedenes: ["Sommerfest"],
  unsicherheiten: ["Abstimmung zu TOP 1 unklar"],
};

vi.mock("./ai-draft", async (orig) => ({
  ...(await orig<typeof import("./ai-draft")>()),
  aiConfigured: () => true,
  generateDraft: vi.fn(async () => draft),
}));

const file = (name: string, content: string | Uint8Array<ArrayBuffer>, type = "text/plain") => new File([content], name, { type });
const inDays = (d: number) => toDateTimeInput(new Date(Date.now() + d * 86_400_000));

describe.skipIf(!hasTestDb)("Transkript-Pipeline (DB)", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.FILE_STORAGE_PATH = mkdtempSync(path.join(tmpdir(), "ov-files-"));
  });
  afterEach(() => vi.unstubAllGlobals());

  async function setup() {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN", name: "Max Muster" });
    const meeting = await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: inDays(1), location: "Ort" }));
    return { outbox, admin, meeting };
  }

  it("verlangt die Zustimmungsbestätigung und das Recht zum Hochladen", async () => {
    const { admin, meeting } = await setup();
    const v = await makeUser({ role: "VORSTAND" });
    const fd = form({ source: "TEAMS" });
    fd.set("file", file("t.txt", "Hallo"));
    await expect(uploadTranscript(admin, meeting.id, fd)).rejects.toThrow();
    fd.set("consent", "on");
    await expect(uploadTranscript(v, meeting.id, fd)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("Text-Upload → Entwurf → Mail an Hochladenden; Übernahme nur der ausgewählten Vorschläge", async () => {
    const { outbox, admin, meeting } = await setup();
    const fd = form({ source: "TEAMS", consent: true });
    fd.set("file", file("sitzung.vtt", "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Max Muster>Ich eröffne.</v>"));
    const t = await uploadTranscript(admin, meeting.id, fd);
    const after = await db.transcript.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.text).toBe("Max Muster: Ich eröffne.");
    expect(after.status).toBe("ENTWURF_FERTIG");
    expect(outbox.some((m) => m.subject.startsWith("Protokollentwurf bereit"))).toBe(true);

    // Beschluss braucht Beschlussfähigkeit → wird als Fehler gemeldet, Rest übernommen
    let summary = await applyDraft(admin, t.id, form({ "resolution[]": ["0"], "task[]": ["0"], "taskAssignee-0": admin.id }));
    expect(summary).toMatchObject({ sections: 2, resolutions: 0, tasks: 1 });
    expect(summary.errors[0]).toMatch(/Beschlussfähigkeit/);
    const minutes = await db.minutes.findFirstOrThrow({ where: { meetingId: meeting.id } });
    expect(minutes.formalities).toMatchObject({ eroeffnung: "19:05 Uhr durch Max Muster." });
    expect(minutes.aiUncertainties).toEqual(["Abstimmung zu TOP 1 unklar", "Ohne passenden TOP: Sommerfest"]);
    const tasks = await db.task.findMany({ where: { meetingId: meeting.id }, include: { assignees: true } });
    expect(tasks.map((x) => x.title)).toEqual(["Infostand anmelden"]);
    expect(tasks[0]!.assignees[0]!.userId).toBe(admin.id);

    for (const a of await db.attendance.findMany({ where: { meetingId: meeting.id } })) await setPresence(admin, minutes.id, a.id, "ANWESEND");
    await determineQuorum(admin, minutes.id, form({ determinedBy: "den Vorsitzenden" }));
    summary = await applyDraft(admin, t.id, form({ "resolution[]": ["0"] }));
    expect(summary.resolutions).toBe(1);
  });

  it("Audio: Whisper transkribiert, danach ist die Audiodatei gelöscht", async () => {
    const { admin, meeting } = await setup();
    const fetchMock = vi.fn(async () => new Response("Erkannter Text der Sitzung.", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const fd = form({ source: "HANDY", consent: true });
    fd.set("file", file("aufnahme.m4a", new Uint8Array([1, 2, 3]), "audio/mp4"));
    const t = await uploadTranscript(admin, meeting.id, fd);
    expect(t.filePath).toBeTruthy();
    const after = await db.transcript.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.text).toBe("Erkannter Text der Sitzung.");
    expect(after.filePath).toBeNull();
    expect(after.audioDeletedAt).not.toBeNull();
    expect(existsSync(absoluteStoredPath(t.filePath!))).toBe(false);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/asr?task=transcribe&language=de");
  });
});
