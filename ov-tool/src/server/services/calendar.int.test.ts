import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { db } from "@/server/db";
import { calendarForToken, renewIcsToken } from "./calendar";

describe.skipIf(!hasTestDb)("Kalender-Abo (DB)", () => {
  beforeEach(resetDb);

  it("liefert Sitzungen, Aktionen und eigene Schichten; erneuerter Token sperrt den alten", async () => {
    const u = await makeUser({ role: "VORSTAND" });
    const other = await makeUser({ role: "VORSTAND" });
    const start = new Date(Date.now() + 5 * 86_400_000);
    await db.meeting.create({ data: { startsAt: start, location: "Gasthaus" } });
    const action = await db.action.create({ data: { title: "Infostand", startsAt: start } });
    const shift = await db.shift.create({ data: { actionId: action.id, startsAt: start, endsAt: new Date(start.getTime() + 3600_000) } });
    await db.shiftSignup.create({ data: { shiftId: shift.id, userId: u.id } });
    const ics = await calendarForToken(u.icsToken);
    expect(ics).toContain("SUMMARY:Vorstandssitzung");
    expect(ics).toContain("SUMMARY:Infostand: Infostand");
    expect(ics).toContain("SUMMARY:Meine Schicht: Infostand");
    expect(await calendarForToken(other.icsToken)).not.toContain("Meine Schicht");
    const old = u.icsToken;
    await renewIcsToken(u);
    expect(await calendarForToken(old)).toBeNull();
    await db.user.update({ where: { id: other.id }, data: { active: false } });
    expect(await calendarForToken(other.icsToken)).toBeNull();
  });
});
