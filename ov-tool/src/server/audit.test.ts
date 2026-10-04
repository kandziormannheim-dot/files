import { describe, expect, it } from "vitest";
import { changes } from "./audit";

describe("changes", () => {
  it("liefert nur geänderte Felder", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    expect(changes({ a: 1, b: "x", c: d }, { a: 1, b: "y", c: new Date("2026-01-02T00:00:00Z") })).toEqual({
      b: ["x", "y"],
      c: [d.toISOString(), "2026-01-02T00:00:00.000Z"],
    });
  });
});
