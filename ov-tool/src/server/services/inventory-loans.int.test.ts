import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { createItem } from "./inventory";
import { addLoanPhotos, lendItem, loanContext, loanProtocolPdf, purgeBorrowerEmails, returnItem, sendLoanProtocol } from "./inventory-loans";
import { updateSettings } from "./settings";

const base = { name: "Pavillon 3 × 3 m", location: "Garage", condition: "gut", acquiredYear: "2022" };

async function photo(color = "#52b7c1") {
  const jpeg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: color } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: "Test" } } })
    .toBuffer();
  return new File([new Uint8Array(jpeg)], "foto.jpg", { type: "image/jpeg" });
}

describe.skipIf(!hasTestDb)("Leihprotokoll (DB)", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = "test-schluessel";
  });
  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });
  beforeEach(resetDb);

  it("bucht die Ausgabe mit allen Angaben, Fotos und schickt das Protokoll an alle Beteiligten", async () => {
    const outbox = captureMailsForTests();
    const v = await makeUser({ role: "VORSTAND" });
    const lager = await makeUser({ role: "VORSTAND", name: "Lager Person" });
    const admin = await makeUser({ role: "ADMIN" });
    await updateSettings(admin, form({ "inventory.notifyEmails": "Verteiler@Example.org\n" }));
    const item = await createItem(v, form(base));
    const fd = form({
      pickupAt: "",
      handedOverById: lager.id,
      borrowerName: "Erika Beispiel",
      organization: "Beispielverein e. V.",
      borrowerEmail: "Erika@Example.org",
      accessories: "4 Seitenwände, Tasche",
      conditionOut: "gut",
      dueAt: "2099-01-10",
      note: "Herbstfest",
    });
    fd.append("photos", await photo());
    fd.append("photos", await photo("#2d3c4b"));
    const { loan, mail } = await lendItem(v, item.id, fd);

    expect(mail.sent).toBe(true);
    expect(outbox).toHaveLength(1);
    const sent = outbox[0]!;
    expect(String(sent.to).split(", ").sort()).toEqual(["erika@example.org", lager.email, v.email, "verteiler@example.org"].sort());
    expect(sent.subject).toBe("Leihprotokoll Ausgabe: Pavillon 3 × 3 m an Erika Beispiel");
    expect(sent.text).toContain("Zubehör: 4 Seitenwände, Tasche");
    expect(sent.attachments?.[0]).toMatchObject({ contentType: "application/pdf" });
    expect(String(sent.attachments?.[0]?.filename)).toMatch(/^Leihprotokoll-Ausgabe-OVMASF00001\.22-\d{4}-\d{2}-\d{2}\.pdf$/);

    const saved = await db.inventoryLoan.findUniqueOrThrow({ where: { id: loan.id }, include: { photos: true } });
    expect(saved).toMatchObject({ borrower: "Erika Beispiel (Beispielverein e. V.)", handedOverBy: "Lager Person", conditionOut: "gut" });
    expect(saved.borrowerEmail).not.toContain("erika"); // verschlüsselt
    expect(saved.outMailSentAt).not.toBeNull();
    expect(saved.photos.map((p) => p.phase)).toEqual(["AUSGABE", "AUSGABE"]);
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).lentTo).toBe("Erika Beispiel (Beispielverein e. V.)");

    const full = await db.inventoryLoan.findUniqueOrThrow({ where: { id: loan.id }, include: { item: true, photos: true, createdBy: true } });
    const ctx = await loanContext(full, "AUSGABE");
    expect(ctx.leihe).toMatchObject({ email: "erika@example.org", organisation: "Beispielverein e. V.", rueckgabeBis: "10.01.2099", anzahlFotos: 2 });
    expect(ctx.leihe.fotosAusgabe).toHaveLength(2);
    expect(ctx.leihe.fotosAusgabe[0]!.bild).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("prüft Pflichtangaben, Datum und Rechte", async () => {
    captureMailsForTests();
    const v = await makeUser({ role: "VORSTAND" });
    const r = await makeUser({ role: "LESEZUGRIFF" });
    const item = await createItem(v, form(base));
    await expect(lendItem(r, item.id, form({ borrowerName: "X", conditionOut: "gut" }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(lendItem(v, item.id, form({ conditionOut: "gut" }))).rejects.toThrow();
    await expect(lendItem(v, item.id, form({ borrowerName: "X", conditionOut: "gut", pickupAt: "2099-01-01" }))).rejects.toBeInstanceOf(UserError);
    await expect(lendItem(v, item.id, form({ borrowerName: "X", conditionOut: "gut", pickupAt: "2026-01-10", dueAt: "2026-01-05" }))).rejects.toBeInstanceOf(UserError);
    expect(await db.inventoryLoan.count()).toBe(0);
  });

  it("bucht die Rückgabe, übernimmt den Zustand und mailt das Rückgabeprotokoll an alle", async () => {
    const outbox = captureMailsForTests();
    const v = await makeUser({ role: "VORSTAND" });
    const annahme = await makeUser({ role: "VORSTAND", name: "Annahme Person" });
    const item = await createItem(v, form(base));
    const { loan } = await lendItem(v, item.id, form({ borrowerName: "Erika Beispiel", borrowerEmail: "erika@example.org", accessories: "Tasche", conditionOut: "gut", pickupAt: "2026-01-10" }));
    const fd = form({ returnedAt: "2026-01-12", receivedById: annahme.id, conditionIn: "reparaturbedürftig", accessoriesComplete: "nein", returnNote: "Tasche fehlt" });
    fd.append("photos", await photo("#cc0000"));
    const { mail } = await returnItem(v, item.id, fd);
    expect(mail.sent).toBe(true);
    const back = outbox[1]!;
    expect(String(back.to).split(", ").sort()).toEqual(["erika@example.org", annahme.email, v.email].sort());
    expect(back.subject).toBe("Leihprotokoll Rückgabe: Pavillon 3 × 3 m von Erika Beispiel");
    expect(back.text).toContain("Zustand: reparaturbedürftig (bei Ausgabe: gut)");
    expect(back.text).toContain("Zubehör vollständig: nein");

    const saved = await db.inventoryLoan.findUniqueOrThrow({ where: { id: loan.id }, include: { photos: true } });
    expect(saved).toMatchObject({ returnedByName: "Erika Beispiel", receivedBy: "Annahme Person", conditionIn: "reparaturbedürftig", accessoriesComplete: false });
    expect(saved.returnMailSentAt).not.toBeNull();
    expect(saved.photos.filter((p) => p.phase === "RUECKGABE")).toHaveLength(1);
    const after = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after).toMatchObject({ lentTo: null, condition: "reparaturbedürftig" });

    const { pdf, fileName } = await loanProtocolPdf(v, loan.id, "RUECKGABE");
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(fileName).toBe("Leihprotokoll-Rueckgabe-OVMASF00001.22-2026-01-12.pdf");

    await expect(addLoanPhotos(v, loan.id, "RUECKGABE", new FormData())).rejects.toBeInstanceOf(UserError);
    const more = new FormData();
    more.append("photos", await photo("#ffffff"));
    await addLoanPhotos(v, loan.id, "RUECKGABE", more);
    expect(await db.inventoryLoanPhoto.count({ where: { loanId: loan.id, phase: "RUECKGABE" } })).toBe(2);
    expect((await sendLoanProtocol(v, loan.id, "RUECKGABE")).sent).toBe(true);
    expect(outbox).toHaveLength(3);
  });

  it("ohne E-Mail der ausleihenden Person geht das Protokoll an die buchende Person", async () => {
    const outbox = captureMailsForTests();
    const v = await makeUser({ role: "VORSTAND" });
    const item = await createItem(v, form(base));
    const { mail } = await lendItem(v, item.id, form({ borrowerName: "Ohne Mail", conditionOut: "gut" }));
    expect(mail.sent).toBe(true);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe(v.email);
  });

  it("löscht die E-Mail der ausleihenden Person 12 Monate nach der Rückgabe", async () => {
    captureMailsForTests();
    const v = await makeUser({ role: "VORSTAND" });
    const item = await createItem(v, form(base));
    const { loan } = await lendItem(v, item.id, form({ borrowerName: "Erika", borrowerEmail: "erika@example.org", conditionOut: "gut" }));
    await returnItem(v, item.id, form({ conditionIn: "gut" }));
    expect(await purgeBorrowerEmails()).toBe(0);
    expect(await purgeBorrowerEmails(new Date(Date.now() + 366 * 86_400_000))).toBe(1);
    expect((await db.inventoryLoan.findUniqueOrThrow({ where: { id: loan.id } })).borrowerEmail).toBeNull();
  });
});
