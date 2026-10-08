import { describe, expect, it } from "vitest";
import { clampOffset, labelDensity, labelFormat, labelsPerPage, LABEL_FORMATS } from "./label-formats";

describe("Etiketten-Druckformate", () => {
  it("passen rechnerisch auf die Seite", () => {
    for (const f of LABEL_FORMATS) {
      const w = f.margin.left + f.cols * f.label.width + (f.cols - 1) * f.gap.x;
      const h = f.margin.top + f.rows * f.label.height + (f.rows - 1) * f.gap.y;
      expect(w, f.key).toBeLessThanOrEqual(f.page.width + 0.01);
      expect(h, f.key).toBeLessThanOrEqual(f.page.height + 0.01);
    }
    expect(new Set(LABEL_FORMATS.map((f) => f.key)).size).toBe(LABEL_FORMATS.length);
  });

  it("wählt Standard, Inhaltsstufe und begrenzt den Versatz", () => {
    expect(labelFormat("unbekannt").key).toBe("roll-50x30");
    expect(labelDensity(labelFormat("roll-50x30"))).toBe("kompakt");
    expect(labelsPerPage(labelFormat("a4-5x13-38x21"))).toBe(65);
    expect(labelDensity(labelFormat("a4-5x13-38x21"))).toBe("klein");
    expect(labelDensity(labelFormat("a4-3x8-70x37"))).toBe("normal");
    expect(labelDensity(labelFormat("a4-2x4-105x74"))).toBe("gross");
    expect(labelFormat("roll-62x29").roll).toBe(true);
    expect(clampOffset("1,25")).toBe(1.3);
    expect(clampOffset("-40")).toBe(-10);
    expect(clampOffset("x")).toBe(0);
  });
});
