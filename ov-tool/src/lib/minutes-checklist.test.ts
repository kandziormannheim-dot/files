import { describe, expect, it } from "vitest";
import { checklistComplete, minutesChecklist, nextResolutionNumber } from "./minutes-checklist";

const complete = {
  location: "Gasthaus Beispiel",
  onlineUrl: "",
  openedAt: new Date(),
  closedAt: new Date(),
  attendanceTotal: 3,
  attendanceRecorded: 3,
  quorumDetermined: true,
  recorderName: "Max Muster",
  signerCount: 2,
  openAgendaItems: [],
  resolutionsWithoutResult: [],
  beschluesseWithoutVotes: [],
};

describe("Prüfliste Niederschrift (LV § 51)", () => {
  it("vollständig", () => {
    expect(checklistComplete(minutesChecklist(complete))).toBe(true);
  });

  it("fehlende Dauer, Anwesenheit oder offene TOPs blockieren den Versand", () => {
    expect(checklistComplete(minutesChecklist({ ...complete, closedAt: null }))).toBe(false);
    const items = minutesChecklist({ ...complete, attendanceRecorded: 2, openAgendaItems: ["3", "4"] });
    expect(items.find((i) => i.key === "anwesenheit")?.detail).toBe("2 von 3");
    expect(items.find((i) => i.key === "tops")?.detail).toBe("offen: TOP 3, 4");
    expect(checklistComplete(items)).toBe(false);
  });
});

describe("Beschlussnummern", () => {
  it("zählt je Jahr hoch", () => {
    expect(nextResolutionNumber(2026, [])).toBe("2026-01");
    expect(nextResolutionNumber(2026, ["2026-01", "2026-07", "2025-12"])).toBe("2026-08");
    expect(nextResolutionNumber(2026, ["U-2026-02"], "U-")).toBe("U-2026-03");
  });
});
