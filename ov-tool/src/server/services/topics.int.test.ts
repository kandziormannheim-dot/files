import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { ForbiddenError, UserError } from "@/server/errors";
import { enforceRetention } from "@/server/jobs/reminders";
import { addTopicEvent, createTopic, readContact, updateTopic } from "./topics";

const base = { title: "Parksituation Hauptstraße", category: "Verkehr", district: "SECKENHEIM", status: "NEU" };

describe.skipIf(!hasTestDb)("Stadtteil-Themen und Bürgeranliegen (DB)", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.ENCRYPTION_KEY = "test-schluessel";
  });
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("Statuswechsel landen im Verlauf; nur Verantwortliche/Ersteller/Admin bearbeiten", async () => {
    const a = await makeUser({ role: "VORSTAND" });
    const b = await makeUser({ role: "VORSTAND" });
    const t = await createTopic(a, form(base));
    await updateTopic(a, t.id, form({ ...base, status: "BEI_STADTRAETEN" }));
    await expect(updateTopic(b, t.id, form(base))).rejects.toBeInstanceOf(ForbiddenError);
    await addTopicEvent(b, t.id, form({ type: "ANTWORT_VERWALTUNG", text: "Prüfung zugesagt", date: "2026-10-01" }));
    const events = await db.topicEvent.findMany({ where: { topicId: t.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.text)).toEqual(["Thema angelegt.", "Status: neu → bei den Stadträten", "Prüfung zugesagt"]);
  });

  it("Kontaktdaten nur mit Einwilligung, verschlüsselt, nur für Vorstand lesbar, Löschfrist ab Erledigung", async () => {
    const a = await makeUser({ role: "VORSTAND" });
    const leser = await makeUser({ role: "LESEZUGRIFF" });
    await expect(createTopic(a, form({ ...base, isCitizenConcern: true, citizenContact: "Herr Beispiel, 0621 1" }))).rejects.toBeInstanceOf(UserError);
    const t = await createTopic(a, form({ ...base, isCitizenConcern: true, citizenContact: "Herr Beispiel, 0621 1", citizenConsent: true }));
    const stored = await db.topic.findUniqueOrThrow({ where: { id: t.id } });
    expect(stored.citizenContact).not.toContain("Beispiel");
    expect(readContact(a, stored)).toBe("Herr Beispiel, 0621 1");
    expect(readContact(leser, stored)).toBeNull();
    const audits = await db.auditLog.findMany({ where: { entityId: t.id } });
    expect(JSON.stringify(audits)).not.toContain("Beispiel");

    await updateTopic(a, t.id, form({ ...base, status: "ERLEDIGT", isCitizenConcern: true }));
    const done = await db.topic.findUniqueOrThrow({ where: { id: t.id } });
    expect(done.contactDeleteAfter!.getTime()).toBeGreaterThan(Date.now() + 150 * 86_400_000);
    expect(done.citizenContact).not.toBeNull();
    await enforceRetention(new Date(Date.now() + 400 * 86_400_000));
    expect((await db.topic.findUniqueOrThrow({ where: { id: t.id } })).citizenContact).toBeNull();
  });
});
