import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcs, foldLine } from "./ics";

describe("ICS", () => {
  it("escaped Sonderzeichen", () => {
    expect(escapeIcs("Ort; Straße, 1\nMannheim")).toBe("Ort\; Straße\\, 1\\nMannheim");
  });

  it("faltet lange Zeilen UTF-8-sicher", () => {
    const folded = foldLine(`SUMMARY:${"ä".repeat(60)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"ä".repeat(60)}`);
  });

  it("erzeugt gültige Ereignisse in UTC", () => {
    const ics = buildIcs("Test", [
      { uid: "m1@ov", start: new Date("2026-11-12T18:00:00Z"), end: new Date("2026-11-12T20:00:00Z"), summary: "Vorstandssitzung", cancelled: true },
    ], new Date("2026-10-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261112T180000Z\r\n");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
