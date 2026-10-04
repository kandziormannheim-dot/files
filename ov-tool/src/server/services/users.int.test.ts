import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { createUser, updateUser } from "./users";

const base = { name: "Erika Beispiel", role: "VORSTAND", votingRight: "STIMMBERECHTIGT", loginEnabled: true, active: true };

describe.skipIf(!hasTestDb)("Nutzerverwaltung (DB)", () => {
  beforeEach(resetDb);

  it("legt Nutzer an, schreibt Audit und sendet die Zugangsmail", async () => {
    const outbox = captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN" });
    const user = await createUser(admin, form({ ...base, email: " Erika@Example.ORG ", sendInvite: true }));
    expect(user.email).toBe("erika@example.org");
    expect(await db.auditLog.count({ where: { entityId: user.id, action: "user.create" } })).toBe(1);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.text).toContain("/login");
  });

  it("verweigert Nicht-Admins die Nutzerverwaltung", async () => {
    const vorstand = await makeUser({ role: "VORSTAND" });
    await expect(createUser(vorstand, form({ ...base, email: "x@example.org" }))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lässt mindestens einen aktiven Admin übrig", async () => {
    const a1 = await makeUser({ role: "ADMIN" });
    const a2 = await makeUser({ role: "ADMIN" });
    await expect(updateUser(a1, a1.id, form({ ...base, email: a1.email, role: "VORSTAND" }))).rejects.toBeInstanceOf(UserError);
    await updateUser(a1, a2.id, form({ ...base, email: a2.email, role: "VORSTAND" }));
    // a1 ist jetzt der letzte Admin – ein anderer Admin dürfte ihn nicht herabstufen; hier gibt es keinen mehr
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBe(1);
  });

  it("beendet Sitzungen beim Entzug des Zugangs", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const gast = await makeUser({ role: "GAST" });
    await db.session.create({ data: { sessionToken: "t1", userId: gast.id, expires: new Date(Date.now() + 1e6) } });
    await updateUser(admin, gast.id, form({ ...base, email: gast.email, role: "GAST", active: false }));
    expect(await db.session.count({ where: { userId: gast.id } })).toBe(0);
  });
});
