import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { createLink, deleteLink, listLinks, reorderLinks, updateLink } from "./links";

describe.skipIf(!hasTestDb)("Link-Hub (DB)", () => {
  beforeEach(resetDb);

  it("legt Links an, ergänzt https:// und hängt sie hinten an", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    const a = await createLink(v, form({ title: "CDUplus", url: "cduplus.cdu.de", category: "PARTEI" }));
    const b = await createLink(v, form({ title: "KV", url: "https://example.org", category: "PARTEI" }));
    expect(a.url).toBe("https://cduplus.cdu.de");
    expect(b.position).toBe(a.position + 1);
  });

  it("weist Passwörter und Zugangsdaten in URLs zurück", async () => {
    const v = await makeUser({ role: "VORSTAND" });
    await expect(
      createLink(v, form({ title: "X", url: "https://example.org", category: "PARTEI", accessNote: "Passwort: geheim" })),
    ).rejects.toBeInstanceOf(UserError);
    await expect(
      createLink(v, form({ title: "X", url: "https://a:b@example.org", category: "PARTEI" })),
    ).rejects.toBeInstanceOf(UserError);
  });

  it("Lesezugriff legt nichts an; fremde Links bearbeitet nur der Admin", async () => {
    const leser = await makeUser({ role: "LESEZUGRIFF" });
    const v1 = await makeUser({ role: "VORSTAND" });
    const v2 = await makeUser({ role: "VORSTAND" });
    const admin = await makeUser({ role: "ADMIN" });
    await expect(createLink(leser, form({ title: "X", url: "https://e.org", category: "PRESSE" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const link = await createLink(v1, form({ title: "X", url: "https://e.org", category: "PRESSE" }));
    await expect(updateLink(v2, link.id, form({ title: "Y", url: "https://e.org", category: "PRESSE" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await updateLink(admin, link.id, form({ title: "Y", url: "https://e.org", category: "PRESSE" }));
    await deleteLink(v1, link.id);
    expect(await db.link.count()).toBe(0);
  });

  it("sortiert per Drag & Drop nur als Admin und nur vollständige Listen", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const v = await makeUser({ role: "VORSTAND" });
    const l1 = await createLink(admin, form({ title: "1", url: "https://e.org/1", category: "PRESSE" }));
    const l2 = await createLink(admin, form({ title: "2", url: "https://e.org/2", category: "PRESSE" }));
    await expect(reorderLinks(v, "PRESSE", [l2.id, l1.id])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(reorderLinks(admin, "PRESSE", [l2.id])).rejects.toBeInstanceOf(UserError);
    await reorderLinks(admin, "PRESSE", [l2.id, l1.id]);
    const order = await db.link.findMany({ where: { category: "PRESSE" }, orderBy: { position: "asc" } });
    expect(order.map((l) => l.title)).toEqual(["2", "1"]);
  });
});

describe.skipIf(!hasTestDb)("BBR-Links (DB)", () => {
  beforeEach(resetDb);

  it("zeigt BBR-Links nur Bezirksbeiräten und Admins", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const bbr = await makeUser({ role: "VORSTAND", isBbr: true });
    const other = await makeUser({ role: "VORSTAND" });
    await db.link.create({ data: { title: "BBR-Anliegen", url: "https://bbr-anliegen.cdu-sf.de/", bbrOnly: true } });
    await db.link.create({ data: { title: "Website", url: "https://cdu-sf.de" } });
    expect((await listLinks(admin)).map((l) => l.title).sort()).toEqual(["BBR-Anliegen", "Website"]);
    expect((await listLinks(bbr)).length).toBe(2);
    expect((await listLinks(other)).map((l) => l.title)).toEqual(["Website"]);
  });
});
