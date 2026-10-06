import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { addItem, approveAndSend, claimPdf, createClaim, enforceExpenseRetention, getClaim, listClaims, submitClaim } from "./expenses";

vi.mock("@/server/pdf/render", () => ({
  renderDocumentPdf: vi.fn(async () => {
    const d = await PDFDocument.create();
    d.addPage();
    return { pdf: Buffer.from(await d.save()), html: "", version: 1 };
  }),
  renderDocumentPreview: vi.fn(async () => ""),
  wrapDocument: vi.fn(async (html: string) => html),
}));

async function itemForm(desc: string, amount: string, file?: File) {
  const fd = form({ date: "2026-10-01", description: desc, amount });
  if (file) fd.set("receipt", file);
  return fd;
}

describe.skipIf(!hasTestDb)("Auslagenerstattung (DB)", () => {
  beforeEach(resetDb);

  it("erfasst Belege, prüft IBAN, Freigabe und Versand mit PDF an die Kreisgeschäftsstelle", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN", name: "Erika Vorsitz" });
    const v = await makeUser({ role: "VORSTAND", name: "Max Muster" });
    const other = await makeUser({ role: "VORSTAND" });
    await db.setting.create({ data: { key: "office.email", value: "kgs@example.org" } });

    await expect(createClaim(v, form({ title: "Infostand", payout: "UEBERWEISUNG", iban: "DE89370400440532013001" }))).rejects.toThrow(/IBAN/);
    const claim = await createClaim(v, form({ title: "Infostand", payout: "UEBERWEISUNG", iban: "DE89 3704 0044 0532 0130 00" }));
    expect(claim.number).toMatch(/^A-\d{4}-01$/);
    expect(claim.personalData).not.toContain("DE89"); // verschlüsselt (Test-ENCRYPTION_KEY) oder zumindest nicht im Klartext-Feld sichtbar, wenn gesetzt

    const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const pdf = await PDFDocument.create();
    pdf.addPage();
    await addItem(v, claim.id, await itemForm("Glühwein", "42,50", new File([new Uint8Array(png)], "kassenbon.png", { type: "image/png" })));
    await addItem(v, claim.id, await itemForm("Flyer", "19,90"));
    await expect(submitClaim(v, claim.id)).rejects.toThrow(/Beleg/);
    await db.expenseItem.deleteMany({ where: { claimId: claim.id, description: "Flyer" } });
    await addItem(v, claim.id, await itemForm("Flyer", "19,90", new File([new Uint8Array(await pdf.save())], "rechnung.pdf", { type: "application/pdf" })));

    const full = await getClaim(v, claim.id);
    expect(full.total).toBe(6240);
    expect(full.personal.iban).toBe("DE89370400440532013000");
    expect(full.items[0]!.receiptMime).toBe("image/webp");
    await expect(getClaim(other, claim.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listClaims(other)).length).toBe(0);
    expect((await listClaims(admin)).length).toBe(1);

    await submitClaim(v, claim.id);
    await expect(approveAndSend(v as typeof v, claim.id)).rejects.toBeInstanceOf(ForbiddenError);
    const res = await approveAndSend(admin, claim.id);
    expect(res).toMatchObject({ to: "kgs@example.org", total: 6240 });
    const mail = outbox.at(-1)!;
    expect(mail.to).toBe("kgs@example.org");
    expect(mail.attachments?.[0]?.filename).toBe(`Auslagenerstattung-${claim.number}.pdf`);
    const out = await PDFDocument.load(mail.attachments![0]!.content);
    expect(out.getPageCount()).toBe(3); // Antrag + Foto + PDF-Beleg
    await expect(approveAndSend(admin, claim.id)).rejects.toBeInstanceOf(UserError);

    // Löschfrist: Bankdaten nach 12 Monaten entfernt, Belege bleiben
    const later = new Date(Date.now() + 400 * 86_400_000);
    expect(await enforceExpenseRetention(later)).toBe(1);
    expect((await getClaim(admin, claim.id)).personal).toEqual({});
    expect((await claimPdf(admin, claim.id)).pdf.length).toBeGreaterThan(0);
  }, 60_000);

  it("verlangt für die Spendenbescheinigung eine Anschrift", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    await expect(createClaim(v, form({ title: "Fahrt", payout: "SPENDE" }))).rejects.toThrow(/Anschrift/);
    const c = await createClaim(v, form({ title: "Fahrt", payout: "SPENDE", address: "Musterstraße 1\n68239 Mannheim" }));
    expect((await getClaim(v, c.id)).personal.address).toContain("Musterstraße");
    const lese = await makeUser({ role: "LESEZUGRIFF" });
    await expect(createClaim(lese, form({ title: "x", payout: "BAR" }))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
