import { describe, expect, it } from "vitest";
import { asPoints, parsePoints, serializePoints, shortName } from "./minutes-text";

describe("Stichpunkte", () => {
  it("liest Punkte und eingerückte Unterpunkte", () => {
    const text = "– Vorschlag: Infostand.\n  · Material über den Kreisverband\n\tZwei Schichten\nKein Bericht.";
    expect(parsePoints(text)).toEqual([
      { text: "Vorschlag: Infostand.", unterpunkte: ["Material über den Kreisverband", "Zwei Schichten"] },
      { text: "Kein Bericht.", unterpunkte: [] },
    ]);
  });

  it("Unterpunkt ohne vorherigen Punkt wird zum Punkt", () => {
    expect(parsePoints("  allein")).toEqual([{ text: "allein", unterpunkte: [] }]);
  });

  it("schreibt und liest verlustfrei", () => {
    const points = [{ text: "A", unterpunkte: ["a1", "a2"] }, { text: "B", unterpunkte: [] }];
    expect(parsePoints(serializePoints(points))).toEqual(points);
  });

  it("bereinigt gespeichertes JSON", () => {
    expect(asPoints([{ text: "x", unterpunkte: [1] }, null, { foo: 1 }])).toEqual([{ text: "x", unterpunkte: ["1"] }]);
    expect(asPoints("kaputt")).toEqual([]);
  });

  it("kürzt Namen auf den Nachnamen", () => {
    expect(shortName("Erika Beispiel")).toBe("Beispiel");
  });
});
