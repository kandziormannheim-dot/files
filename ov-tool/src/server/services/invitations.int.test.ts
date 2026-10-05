import { beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { invitationPreview, RSVP_MARKER, sendInvitation } from "./invitations";
import { createMeeting } from "./meetings";

vi.mock("@/server/pdf/render", () => ({
  renderDocumentPdf: vi.fn(async () => ({ pdf: Buffer.from("%PDF-test"), html: "", version: 3 })),
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
});
