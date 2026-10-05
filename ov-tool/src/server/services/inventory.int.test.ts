import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { readStoredFile } from "@/server/files";
import { createItem, findByCode, lendItem, listItems, retireItem, returnItem, updateItem } from "./inventory";

const base = { name: "Stehtisch", location: "Garage", condition: "gut", acquiredYear: "2020" };

describe.skipIf(!hasTestDb)("Inventar (DB)", () => {
  beforeEach(resetDb);

  it("vergibt fortlaufende Codes mit Anschaffungsjahr und findet sie per Scan", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const a = await createItem(v, form(base));
    const b = await createItem(v, form({ ...base, name: "Schirm", acquiredYear: "2024" }));
    expect(a.code).toBe("OVMASF00001.20");
    expect(b.code).toBe("OVMASF00002.24");
    const c = await createItem(v, form({ ...base, name: "Altbestand", number: "1234" }));
    expect(c.code).toBe("OVMASF01234.20");
    expect((await createItem(v, form({ ...base, name: "Neu" }))).code).toBe("OVMASF01235.20");
    await expect(createItem(v, form({ ...base, number: "2" }))).rejects.toBeInstanceOf(UserError);
    expect((await findByCode(v, " ovmasf00002.24 "))?.id).toBe(b.id);
  });

  it("verweigert Lesezugriff das Anlegen", async () => {
    const r = await makeUser({ role: "LESEZUGRIFF" });
    await expect(createItem(r, form(base))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("speichert Fotos ohne Metadaten als WebP", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const jpeg = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#52b7c1" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "Test" } } })
      .toBuffer();
    const fd = form(base);
    fd.set("photo", new File([new Uint8Array(jpeg)], "foto.jpg", { type: "image/jpeg" }));
    const item = await createItem(v, fd);
    const saved = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    const meta = await sharp(await readStoredFile(saved.photoPath!)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1600);
    expect(meta.exif).toBeUndefined();
  });

  it("bucht Verleih und Rückgabe mit Verlauf; Code bleibt beim Bearbeiten fest", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const item = await createItem(v, form(base));
    await lendItem(v, item.id, form({ borrower: "FDP Mannheim Süd", dueAt: "2026-10-20" }));
    await expect(lendItem(v, item.id, form({ borrower: "JU" }))).rejects.toBeInstanceOf(UserError);
    expect((await listItems(v, { status: "verliehen" })).map((i) => i.id)).toEqual([item.id]);
    await returnItem(v, item.id, form({ returnNote: "vollständig" }));
    const loan = await db.inventoryLoan.findFirstOrThrow({ where: { itemId: item.id } });
    expect(loan.returnedAt).not.toBeNull();
    expect(loan.note).toContain("vollständig");
    await updateItem(v, item.id, form({ ...base, name: "Stehtisch rund", acquiredYear: "1999" }));
    const after = await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after).toMatchObject({ name: "Stehtisch rund", code: "OVMASF00001.20", lentTo: null });
  });

  it("nur Admins mustern aus; ausgemusterte fallen aus dem Bestand", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const admin = await makeUser({ role: "ADMIN" });
    const item = await createItem(v, form(base));
    await expect(retireItem(v, item.id, true)).rejects.toBeInstanceOf(ForbiddenError);
    await retireItem(admin, item.id, true);
    expect(await listItems(v)).toHaveLength(0);
    expect(await listItems(v, { status: "ausgemustert" })).toHaveLength(1);
  });
});
