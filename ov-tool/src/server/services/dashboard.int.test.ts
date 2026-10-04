import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { addBerlinDays, toDateTimeInput } from "@/lib/dates";
import { db } from "@/server/db";
import { captureMailsForTests } from "@/server/mail/transport";
import { dashboardData } from "./dashboard";
import { createMeeting } from "./meetings";

describe.skipIf(!hasTestDb)("Übersicht (DB)", () => {
  beforeEach(resetDb);

  it("zeigt Aufgaben, nächste Sitzung und Hinweise je Rolle", async () => {
    captureMailsForTests();
    const admin = await makeUser({ role: "ADMIN" });
    const v = await makeUser({ role: "VORSTAND" });
    await db.meeting.create({ data: { startsAt: addBerlinDays(new Date(), -50), status: "DURCHGEFUEHRT" } });
    await db.task.create({ data: { title: "Für alle", assigneeGroup: "ALLE" } });
    let d = await dashboardData(admin);
    expect(d.notices.some((n) => n.text.startsWith("Nächste Vorstandssitzung planen"))).toBe(true);
    expect(d.notices.some((n) => n.text.startsWith("Protokoll noch nicht versendet"))).toBe(true);
    expect((await dashboardData(v)).notices).toHaveLength(0);
    expect(d.tasks.map((t) => t.title)).toEqual(["Für alle"]);

    await createMeeting(admin, form({ type: "VORSTANDSSITZUNG", format: "PRAESENZ", startsAt: toDateTimeInput(addBerlinDays(new Date(), 8)), location: "Ort" }));
    d = await dashboardData(admin);
    expect(d.nextMeeting?.counts.OFFEN).toBe(2);
    expect(d.notices.some((n) => n.text.startsWith("Einladung zu"))).toBe(true);
    expect(d.notices.some((n) => n.text.startsWith("Nächste Vorstandssitzung planen"))).toBe(false);
  });
});
