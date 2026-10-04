import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { getTemplateSource } from "@/server/templates/store";
import { restoreTemplateVersion, saveTemplate } from "./templates";

describe.skipIf(!hasTestDb)("Vorlagen (DB)", () => {
  beforeEach(resetDb);

  it("speichert neue Versionen, lehnt unbekannte Platzhalter ab und stellt alte wieder her", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const v1 = await saveTemplate(admin, "sitzung.absage", form({ body: "---\nbetreff: Absage {{datum sitzung.beginn}}\n---\nText" }));
    expect(v1.version).toBe(1);
    await expect(
      saveTemplate(admin, "sitzung.absage", form({ body: "---\nbetreff: X\n---\n{{sitzung.tippfehler}}" })),
    ).rejects.toThrow(/Unbekannte Platzhalter: sitzung.tippfehler/);
    await expect(saveTemplate(admin, "sitzung.absage", form({ body: "ohne Betreff" }))).rejects.toBeInstanceOf(UserError);
    await expect(saveTemplate(admin, "sitzung.absage", form({ body: "---\nbetreff: X\n---\n{{#if}}" }))).rejects.toThrow(/Syntaxfehler/);
    await saveTemplate(admin, "sitzung.absage", form({ body: "---\nbetreff: Neu\n---\nText 2" }));
    expect((await getTemplateSource("sitzung.absage")).version).toBe(2);
    const v3 = await restoreTemplateVersion(admin, "sitzung.absage", 1);
    expect(v3.version).toBe(3);
    expect((await getTemplateSource("sitzung.absage")).source).toContain("Absage {{datum sitzung.beginn}}");
    expect(await db.template.count({ where: { key: "sitzung.absage", active: true } })).toBe(1);
  });

  it("prüft die Standard-Tagesordnung als JSON", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    await expect(saveTemplate(admin, "tagesordnung.standard", form({ body: "{kaputt" }))).rejects.toThrow(/Ungültiges JSON/);
  });
});
