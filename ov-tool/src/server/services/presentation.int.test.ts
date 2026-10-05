import { writeFileSync } from "node:fs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError } from "@/server/errors";
import { addAgendaItem, createMeeting } from "./meetings";
import { attachPresentationToMinutes, buildMeetingPresentation, saveLeaderNotes } from "./presentation";

describe.skipIf(!hasTestDb)("Sitzungspräsentation (DB)", () => {
  beforeEach(resetDb);

  it("erzeugt eine PowerPoint mit Titel, Tagesordnung, je TOP einer Folie und Vermerken in den Notizen", async () => {
    const admin = await makeUser({ role: "ADMIN", votingRight: "STIMMBERECHTIGT" });
    const m = await createMeeting(
      admin,
      form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: toDateTimeInput(new Date(Date.now() + 8 * 86_400_000)), location: "Gasthaus Beispiel, Hauptstraße 1" }),
    );
    const before = await db.agendaItem.count({ where: { meetingId: m.id, parentId: null } });
    const extra = await addAgendaItem(admin, m.id, { title: "Glühweinstand am 03.12." });
    await saveLeaderNotes(admin, m.id, form({ [`note:${extra.id}`]: "Schichtplan vorstellen, Helfer abfragen" }));
    const { data, filename } = await buildMeetingPresentation(admin, m.id);
    expect(filename).toMatch(/^Praesentation-\d{4}-\d\d-\d\d\.pptx$/);
    if (process.env.PPTX_OUT) writeFileSync(process.env.PPTX_OUT, data);
    const zip = await JSZip.loadAsync(data);
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    const tops = before + 1;
    expect(slides.length).toBe(1 + Math.ceil(tops / 20) + tops + 1);
    const notes = await Promise.all(Object.keys(zip.files).filter((f) => /notesSlide\d+\.xml$/.test(f)).map((f) => zip.file(f)!.async("string")));
    expect(notes.some((n) => n.includes("Schichtplan vorstellen"))).toBe(true);
  });

  it("nur die Sitzungsleitung erzeugt Präsentationen; Anlage zum Protokoll ersetzt frühere Fassung", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const v = await makeUser({ role: "VORSTAND" });
    const m = await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: toDateTimeInput(new Date(Date.now() + 8 * 86_400_000)), location: "Gasthaus Beispiel" }));
    await expect(buildMeetingPresentation(v, m.id)).rejects.toBeInstanceOf(ForbiddenError);
    await attachPresentationToMinutes(admin, m.id);
    await attachPresentationToMinutes(admin, m.id);
    expect(await db.attachment.count({ where: { ownerId: m.id, inMinutes: true } })).toBe(1);
  });
});
