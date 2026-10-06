import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { addAgendaItemFiles, agendaItemExtras, saveAgendaItemNote } from "./attachments";
import { createMeeting } from "./meetings";
import { minutesMeetingInclude, startMinutes } from "./minutes";
import { minutesContext, renderMinutesPdf } from "./minutes-export";

// Protokoll-PDF als echte, einseitige PDF-Datei simulieren (ohne Chromium)
vi.mock("@/server/pdf/render", () => ({
  renderDocumentPdf: vi.fn(async () => {
    const d = await PDFDocument.create();
    d.addPage();
    return { pdf: Buffer.from(await d.save()), html: "", version: 1 };
  }),
  wrapDocument: vi.fn(async (html: string) => html),
}));

const inDays = (d: number) => toDateTimeInput(new Date(Date.now() + d * 86_400_000));

async function pdfFile(pages: number, name: string) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage();
  return new File([new Uint8Array(await d.save())], name, { type: "application/pdf" });
}

describe.skipIf(!hasTestDb)("Notizen und Anlagen zu TOPs (DB)", () => {
  beforeEach(resetDb);

  it("übernimmt Notizen und Anlagen ins Protokoll und hängt PDF/Bilder ans Protokoll-PDF an", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const vorstand = await makeUser({ role: "VORSTAND" });
    const meeting = await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: inDays(3), location: "Gasthaus Beispiel" }));
    const items = await db.agendaItem.findMany({ where: { meetingId: meeting.id, parentId: null }, orderBy: { position: "asc" } });
    expect(items.length).toBeGreaterThan(1);
    const [first, second] = items as [(typeof items)[0], (typeof items)[0]];

    await expect(saveAgendaItemNote(vorstand, first.id, "x")).rejects.toBeInstanceOf(ForbiddenError);
    await saveAgendaItemNote(admin, second.id, "Standplatz mit dem Marktamt abgestimmt.");

    const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#52b7c1" } }).png().toBuffer();
    const fd = new FormData();
    fd.append("file", await pdfFile(2, "Lageplan.pdf"));
    fd.append("file", new File([new Uint8Array(png)], "Foto.png", { type: "image/png" }));
    await addAgendaItemFiles(admin, second.id, fd);
    const fd2 = new FormData();
    fd2.append("file", await pdfFile(1, "Vorlage.pdf"));
    await addAgendaItemFiles(admin, first.id, fd2);

    const extras = await agendaItemExtras(meeting.id);
    expect(extras[second.id]!.files.map((f) => f.fileName)).toEqual(["Lageplan.pdf", "Foto.png"]);

    const minutes = await startMinutes(admin, meeting.id);
    const full = await db.meeting.findUniqueOrThrow({ where: { id: meeting.id }, include: minutesMeetingInclude });
    const ctx = await minutesContext(minutes, full);
    // Nummerierung folgt der Tagesordnung: TOP 1 zuerst
    expect(ctx.anlagen.map((a) => `${a.nummer} ${a.name}`)).toEqual(["1 Vorlage.pdf", "2 Lageplan.pdf", "3 Foto.png"]);
    const sec = ctx.protokoll.abschnitte.find((a) => a.topTitel === second.title)!;
    expect(sec.notiz).toBe("Standplatz mit dem Marktamt abgestimmt.");
    expect(sec.anlagen.map((a) => a.nummer)).toEqual([2, 3]);

    const { pdf, mergedAnnexIds } = await renderMinutesPdf(minutes.id);
    const out = await PDFDocument.load(pdf);
    expect(out.getPageCount()).toBe(1 + 1 + 2 + 1); // Protokoll + Vorlage + Lageplan + Foto
    expect(mergedAnnexIds).toHaveLength(3);

    // nach dem Versand gesperrt
    await db.minutes.update({ where: { id: minutes.id }, data: { status: "VERSENDET" } });
    await expect(saveAgendaItemNote(admin, second.id, "geändert")).rejects.toBeInstanceOf(UserError);
  }, 60_000);
});
