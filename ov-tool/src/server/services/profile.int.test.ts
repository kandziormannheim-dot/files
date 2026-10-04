import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { resetRateLimits } from "@/server/rate-limit";
import { confirmEmailChange, listBoard, pendingEmailChange, requestEmailChange, updateOwnProfile } from "./users";

const tokenFrom = (text: string) => /\/email-confirm\/([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";

describe.skipIf(!hasTestDb)("Eigenes Profil (DB)", () => {
  beforeEach(async () => {
    await resetDb();
    resetRateLimits();
  });

  it("speichert Name und Telefon; Telefon in der Vorstandsliste nur mit Zustimmung", async () => {
    const u = await makeUser({ role: "VORSTAND" });
    await updateOwnProfile(u, form({ name: "Erika Neu", phone: "+49 621 123456" }));
    let board = await listBoard(u);
    expect(board.find((b) => b.id === u.id)).toMatchObject({ name: "Erika Neu", phone: null });
    await updateOwnProfile(await db.user.findUniqueOrThrow({ where: { id: u.id } }), form({ name: "Erika Neu", phone: "+49 621 123456", showPhoneInBoard: true }));
    board = await listBoard(u);
    expect(board.find((b) => b.id === u.id)?.phone).toBe("+49 621 123456");
  });

  it("lehnt ungültige Telefonnummern ab", async () => {
    const u = await makeUser();
    await expect(updateOwnProfile(u, form({ name: "X", phone: "ruf mich an" }))).rejects.toThrow();
  });

  it("blendet Gäste und Deaktivierte in der Vorstandsliste aus", async () => {
    const u = await makeUser({ role: "VORSTAND" });
    await makeUser({ role: "GAST" });
    await makeUser({ role: "VORSTAND", active: false });
    expect((await listBoard(u)).map((b) => b.id)).toEqual([u.id]);
  });

  it("ändert die E-Mail-Adresse erst nach Bestätigung, Link nur einmal gültig", async () => {
    const outbox = captureMailsForTests();
    const u = await makeUser({ email: "alt@example.org" });
    await requestEmailChange(u, form({ newEmail: "Neu@Example.org" }));
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe("neu@example.org");
    expect((await pendingEmailChange(u.id))?.newEmail).toBe("neu@example.org");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe("alt@example.org");

    const token = tokenFrom(outbox[0]!.text);
    expect(token).not.toBe("");
    expect(await confirmEmailChange(token)).toBe("neu@example.org");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe("neu@example.org");
    expect(outbox.at(-1)!.to).toBe("alt@example.org");
    expect(await confirmEmailChange(token)).toBeNull();
    expect(await db.auditLog.count({ where: { action: "user.emailChanged" } })).toBe(1);
  });

  it("verweigert vergebene Adressen und abgelaufene Links", async () => {
    captureMailsForTests();
    const u = await makeUser();
    await makeUser({ email: "belegt@example.org" });
    await expect(requestEmailChange(u, form({ newEmail: "belegt@example.org" }))).rejects.toBeInstanceOf(UserError);
    const outbox = captureMailsForTests();
    await requestEmailChange(u, form({ newEmail: "frei@example.org" }));
    await db.emailChangeToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await confirmEmailChange(tokenFrom(outbox[0]!.text))).toBeNull();
  });
});
