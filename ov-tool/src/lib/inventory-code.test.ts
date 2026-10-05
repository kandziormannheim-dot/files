import { describe, expect, it } from "vitest";
import { formatInventoryCode, parseInventoryCode } from "./inventory-code";

describe("Inventarnummer", () => {
  it("formatiert Nummer und Anschaffungsjahr", () => {
    expect(formatInventoryCode(1234, 2020)).toBe("OVMASF01234.20");
    expect(formatInventoryCode(7, 2005)).toBe("OVMASF00007.05");
    expect(formatInventoryCode(99999, 2100)).toBe("OVMASF99999.00");
  });
  it("lehnt ungültige Werte ab", () => {
    expect(() => formatInventoryCode(0, 2020)).toThrow();
    expect(() => formatInventoryCode(100000, 2020)).toThrow();
    expect(() => formatInventoryCode(5, 20)).toThrow();
  });
  it("liest gescannte Codes tolerant", () => {
    expect(parseInventoryCode(" ovmasf01234.20 ")).toEqual({ number: 1234, yearSuffix: 20, code: "OVMASF01234.20" });
    expect(parseInventoryCode("OVMASF1234.20")).toBeNull();
    expect(parseInventoryCode("OVMASF00000.20")).toBeNull();
    expect(parseInventoryCode("XYZ01234.20")).toBeNull();
  });
});
