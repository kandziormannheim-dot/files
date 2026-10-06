import { describe, expect, it } from "vitest";
import { formatEuro, maskIban, normalizeIban, parseEuro } from "./money";

describe("parseEuro", () => {
  it("liest deutsche und englische Schreibweisen in Cent", () => {
    expect(parseEuro("12,50")).toBe(1250);
    expect(parseEuro("12.5")).toBe(1250);
    expect(parseEuro("1.234,56")).toBe(123456);
    expect(parseEuro("7")).toBe(700);
    expect(parseEuro("0,99 €")).toBe(99);
  });
  it("lehnt Unsinn ab", () => {
    expect(parseEuro("")).toBeNull();
    expect(parseEuro("12,345")).toBeNull();
    expect(parseEuro("-5")).toBeNull();
    expect(parseEuro("abc")).toBeNull();
  });
  it("formatiert", () => {
    expect(formatEuro(123456).replace(/\s/g, " ")).toBe("1.234,56 €");
  });
});

describe("IBAN", () => {
  it("prüft die Prüfziffer (Beispiel-IBAN der Bundesbank)", () => {
    expect(normalizeIban("de89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
    expect(normalizeIban("DE89370400440532013001")).toBeNull();
    expect(normalizeIban("DE8937040044053201300")).toBeNull();
  });
  it("maskiert", () => {
    expect(maskIban("DE89370400440532013000")).toBe("DE•• •••• 3000");
  });
});
