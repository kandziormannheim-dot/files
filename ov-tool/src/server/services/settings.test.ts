import { describe, expect, it } from "vitest";
import { toAppSettings } from "./settings";

describe("Einstellungen", () => {
  it("liefert Standardwerte", () => {
    const s = toAppSettings({});
    expect(s.meeting.noticeDays).toBe(7);
    expect(s.meeting.quorumRule).toBe("MEHR_ALS_HAELFTE");
    expect(s.topicCategories).toContain("Verkehr");
  });

  it("lässt die Ladungsfrist nicht unter die Satzung fallen", () => {
    expect(toAppSettings({ "meeting.noticeDays": "3" }).meeting.noticeDays).toBe(7);
    expect(toAppSettings({ "meeting.noticeDays": "10" }).meeting.noticeDays).toBe(10);
  });
});
