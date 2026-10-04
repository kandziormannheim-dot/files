import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { addShift, createAction, sendHelpCall, toggleShiftSignup, updateAction } from "./actions";
import { addAttachment, deleteAttachment } from "./attachments";

const inDays = (d: number) => toDateTimeInput(new Date(Date.now() + d * 86_400_000));

describe.skipIf(!hasTestDb)("Aktionen und Helferschichten (DB)", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.FILE_STORAGE_PATH = mkdtempSync(path.join(tmpdir(), "ov-files-"));
  });

  it("Schichten mit Kapazität; Eintragen nur für sich selbst ab Vorstand", async () => {
    const a = await makeUser({ role: "VORSTAND" });
    const b = await makeUser({ role: "VORSTAND" });
    const leser = await makeUser({ role: "LESEZUGRIFF" });
    const action = await createAction(a, form({ type: "INFOSTAND", title: "Infostand Markt", startsAt: inDays(10), location: "Marktplatz" }));
    await addShift(a, action.id, form({ start: "10:00", end: "12:00", needed: 1 }));
    const shift = await db.shift.findFirstOrThrow({ where: { actionId: action.id } });
    expect(await toggleShiftSignup(a, shift.id)).toBe(true);
    await expect(toggleShiftSignup(b, shift.id)).rejects.toThrow(/voll besetzt/);
    await expect(toggleShiftSignup(leser, shift.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await toggleShiftSignup(a, shift.id)).toBe(false);
    expect(await toggleShiftSignup(b, shift.id)).toBe(true);
    await expect(updateAction(b, action.id, form({ type: "INFOSTAND", title: "X", startsAt: inDays(10) }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addShift(a, action.id, form({ start: "12:00", end: "11:00", needed: 1 }))).rejects.toBeInstanceOf(UserError);
  });

  it("Helferaufruf an den Vorstand mit offenen Plätzen", async () => {
    const outbox = captureMailsForTests();
    const a = await makeUser({ role: "ADMIN", name: "Max Muster" });
    await makeUser({ role: "VORSTAND" });
    await makeUser({ role: "GAST", votingRight: "OHNE" });
    const action = await createAction(a, form({ type: "INFOSTAND", title: "Infostand Weihnachtsmarkt", startsAt: inDays(10), location: "Rathausplatz" }));
    await expect(sendHelpCall(a, action.id)).rejects.toThrow(/Schichten/);
    await addShift(a, action.id, form({ start: "10:00", end: "12:00", needed: 3 }));
    expect(await sendHelpCall(a, action.id)).toBe(2);
    expect(outbox[0]!.subject).toMatch(/^Helfer gesucht: Infostand Weihnachtsmarkt am/);
    expect(outbox[0]!.text).toContain("noch 3 von 3 Plätzen frei");
  });

  it("Anhänge: nur erlaubte Typen, löschen durch Hochladenden", async () => {
    const a = await makeUser({ role: "VORSTAND" });
    const b = await makeUser({ role: "VORSTAND" });
    const action = await createAction(a, form({ type: "VERANSTALTUNG", title: "Sommerfest", startsAt: inDays(10) }));
    await expect(addAttachment(a, "Action", action.id, new File(["<script>"], "x.html"))).rejects.toBeInstanceOf(UserError);
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], "foto.png");
    const att = await addAttachment(a, "Action", action.id, png);
    expect(att.mimeType).toBe("image/png");
    await expect(deleteAttachment(b, att.id)).rejects.toBeInstanceOf(ForbiddenError);
    await deleteAttachment(a, att.id);
  });
});
