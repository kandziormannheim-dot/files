import { beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { invitationPreview, RSVP_MARKER, sendInvitation } from "./invitations";
import { addMeetingFiles, readAttachmentByResponseToken, setInInvitation } from "./attachments";
import { createMeeting } from "./meetings";

vi.mock("@/server/pdf/render", () => ({
  renderDocumentPdf: vi.fn(async () => ({ pdf: Buffer.from("%PDF-test"), html: "", version: 3 })),
  renderDocumentPreview: vi.fn(async () => "<html></html>"),
}));

const inDays = (d: number) => toDateTimeInput(new Date(Date.now() + d * 86_400_000));

async function setup(days: number, extra: Record<string, string | boolean> = {}) {
  const admin = await makeUser({ role: "ADMIN", name: "Max Muster", functionTitle: "Ortsvorsitzender" });
  const gast = await makeUser({ role: "GAST", loginEnabled: false, votingRight: "OHNE", name: "Gerd Gast" });
  const meeting = await createMeeting(
    admin,
    form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: inDays(days), location: "Gasthaus Beispiel", ...extra }),
  );
  return { admin, gast, meeting };
}

describe.skipIf(!hasTestDb)("Einladungsversand (DB)", () => {
  beforeEach(resetDb);

  it("versendet mit persönlichem Link und PDF, setzt Status und merkt die Vorlagenversion", async () => {
    const outbox = captureMailsForTests();
    const { admin, meeting } = await setup(14);
    const p = await invitationPreview(admin, meeting.id);
    expect(p.check).toEqual({ ok: true, timely: true });
    expect(p.subject).toMatch(/^Einladung Vorstandssitzung am \d\d\.\d\d\.\d{4} um [\d:]+ Uhr$/);
    expect(p.text).toContain(RSVP_MARKER);
    const n = await sendInvitation(admin, meeting.id, form({ subject: p.subject, text: p.text }));
    expect(n).toBe(2);
    const tokens = (await db.attendance.findMany({ where: { meetingId: meeting.id } })).map((a) => a.responseToken);
    expect(outbox.every((m) => !m.text.includes(RSVP_MARKER))).toBe(true);
    expect(tokens.every((t) => outbox.some((m) => m.text.includes(`/rsvp/${t}`)))).toBe(true);
    expect(outbox[0]!.attachments?.[0]?.contentType).toBe("application/pdf");
    expect(outbox[0]!.text).toMatch(/\/rsvp\/[\w-]+\?antwort=vielleicht/);
    expect(outbox[0]!.html).toContain("?antwort=ja");
    expect(outbox[0]!.html).toContain("Vielleicht");
    expect(outbox[0]!.html).not.toContain(RSVP_MARKER);
    const after = await db.meeting.findUniqueOrThrow({ where: { id: meeting.id } });
    expect(after.status).toBe("EINGELADEN");
    expect(after.invitationTemplateVersion).toBe(3);
  });

  it("verweigert den Versand bei unterschrittener Ladungsfrist ohne Eilbedürftigkeit", async () => {
    captureMailsForTests();
    const { admin, meeting } = await setup(3);
    const p = await invitationPreview(admin, meeting.id);
    expect(p.check.ok).toBe(false);
    await expect(sendInvitation(admin, meeting.id, form({ subject: p.subject, text: p.text }))).rejects.toBeInstanceOf(UserError);
  });

  it("erlaubt verkürzte Frist mit Begründung", async () => {
    const outbox = captureMailsForTests();
    const { admin, meeting } = await setup(3, { urgent: true, urgencyReason: "Stellungnahme an die Stadt bis Monatsende" });
    const p = await invitationPreview(admin, meeting.id);
    await sendInvitation(admin, meeting.id, form({ subject: p.subject, text: p.text }));
    expect(outbox).toHaveLength(2);
  });

  it("verlangt den Zusage-Platzhalter und Admin-Rechte; Nachversand nur an Neue", async () => {
    const outbox = captureMailsForTests();
    const { admin, meeting } = await setup(14);
    const v = await makeUser({ role: "VORSTAND" });
    const p = await invitationPreview(admin, meeting.id);
    await expect(sendInvitation(admin, meeting.id, form({ subject: "x", text: "ohne Link" }))).rejects.toBeInstanceOf(UserError);
    await expect(sendInvitation(v, meeting.id, form({ subject: p.subject, text: p.text }))).rejects.toBeInstanceOf(ForbiddenError);
    await sendInvitation(admin, meeting.id, form({ subject: p.subject, text: p.text }));
    expect(outbox).toHaveLength(3);
    await makeUser({ role: "VORSTAND", name: "Nora Neu" });
    await invitationPreview(admin, meeting.id); // legt die Teilnahme an
    await sendInvitation(admin, meeting.id, form({ subject: p.subject, text: p.text, scope: "new" }));
    expect(outbox).toHaveLength(4);
  });

  it("verschickt freigegebene Unterlagen mit und bietet sie über den Rückmelde-Link an", async () => {
    const outbox = captureMailsForTests();
    const { admin, meeting } = await setup(14);
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(Buffer.from("%PDF-1.4 Protokoll"))], "Protokoll-2026-09-01.pdf", { type: "application/pdf" }));
    fd.append("file", new File(["Intern"], "notizen.txt", { type: "text/plain" }));
    fd.set("inInvitation", "on");
    expect(await addMeetingFiles(admin, meeting.id, fd)).toBe(2);
    const docs = await db.attachment.findMany({ where: { ownerType: "Meeting", ownerId: meeting.id }, orderBy: { fileName: "asc" } });
    await setInInvitation(admin, docs.find((d) => d.fileName === "notizen.txt")!.id, false);
    const p = await invitationPreview(admin, meeting.id);
    await sendInvitation(admin, meeting.id, form({ subject: p.subject, text: p.text }));
    const names = outbox[0]!.attachments!.map((a) => a.filename);
    expect(names).toContain("Protokoll-2026-09-01.pdf");
    expect(names).not.toContain("notizen.txt");
    expect(outbox[0]!.text).toContain("Sitzungsunterlagen (1)");
    const att = await db.attendance.findFirstOrThrow({ where: { meetingId: meeting.id } });
    const pdf = docs.find((d) => d.fileName.startsWith("Protokoll"))!;
    const txt = docs.find((d) => d.fileName === "notizen.txt")!;
    expect((await readAttachmentByResponseToken(att.responseToken, pdf.id))?.attachment.fileName).toBe(pdf.fileName);
    expect(await readAttachmentByResponseToken(att.responseToken, txt.id)).toBeNull();
    expect(await readAttachmentByResponseToken("y".repeat(30), pdf.id)).toBeNull();
  });

  it("Vorstand ohne Sitzungsrechte darf keine Unterlagen hochladen", async () => {
    const { meeting } = await setup(14);
    const v = await makeUser({ role: "VORSTAND" });
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(Buffer.from("%PDF-1.4"))], "x.pdf"));
    await expect(addMeetingFiles(v, meeting.id, fd)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
