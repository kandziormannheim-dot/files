import { describe, expect, it } from "vitest";
import {
  addBerlinDays,
  berlinDayDiff,
  formatDate,
  formatDateLong,
  formatMonthYear,
  formatTime,
  formatTimeShort,
  fromBerlin,
  parseDateTimeInput,
  toDateTimeInput,
} from "./dates";

describe("Datumshelfer (Europe/Berlin)", () => {
  const winter = fromBerlin(2026, 2, 26, 19, 0); // MEZ
  const summer = fromBerlin(2026, 7, 9, 19, 30); // MESZ

  it("rechnet Berliner Wandzeit korrekt nach UTC um", () => {
    expect(winter.toISOString()).toBe("2026-02-26T18:00:00.000Z");
    expect(summer.toISOString()).toBe("2026-07-09T17:30:00.000Z");
  });

  it("formatiert wie in den Vorlagen beschrieben", () => {
    expect(formatDate(winter)).toBe("26.02.2026");
    expect(formatDateLong(winter)).toBe("Donnerstag, 26. Februar 2026");
    expect(formatTime(winter)).toBe("19:00");
    expect(formatTimeShort(winter)).toBe("19");
    expect(formatTimeShort(summer)).toBe("19:30");
    expect(formatMonthYear(fromBerlin(2026, 3, 1))).toBe("März 2026");
  });

  it("liefert leere Zeichenkette für fehlende Werte", () => {
    expect(formatDate(null)).toBe("");
    expect(formatTimeShort(undefined)).toBe("");
  });

  it("liest und schreibt datetime-local-Werte in Berliner Zeit", () => {
    expect(toDateTimeInput(summer)).toBe("2026-07-09T19:30");
    expect(parseDateTimeInput("2026-07-09T19:30")?.toISOString()).toBe(summer.toISOString());
  });

  it("zählt Kalendertage auch über die Zeitumstellung", () => {
    const before = fromBerlin(2026, 3, 27, 19, 0);
    const after = addBerlinDays(before, 7);
    expect(formatTime(after)).toBe("19:00");
    expect(berlinDayDiff(before, after)).toBe(7);
  });
});
