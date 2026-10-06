import { describe, expect, it } from "vitest";
import { bbrAccountName, detectBezirk, extractKurzfassung, kurzfassungKey, kurzfassungLines, parseCardDescription } from "./bbr-card";

const card = `**Bezirk:** Friedrichsfeld
**Datum:** 01.10.2026
**Hinweisgeber/Kontakt:** Erika Beispiel, 0621 000000

**Kurzfassung**

Die Ampel an der Musterstraße schaltet für Fußgänger sehr kurz.
Wir bitten die Verwaltung, die Grünphase zu prüfen.
Ziel ist ein sicherer Schulweg.

**Erläuterung**

Seit Wochen melden Eltern aus Seckenheim …

---
Angelegt mit BBR-Anliegen`;

describe("BBR-Karten auslesen", () => {
  it("liest nur die Kurzfassung, nie Hinweisgeber oder Erläuterung", () => {
    const k = extractKurzfassung(card);
    expect(kurzfassungLines(k)).toHaveLength(3);
    expect(k).toContain("Grünphase");
    expect(k).not.toContain("Erika");
    expect(k).not.toContain("Eltern");
  });

  it("erkennt den Bezirk aus dem Kopf, nicht aus der Erläuterung", () => {
    expect(parseCardDescription(card).bezirk).toBe("Friedrichsfeld");
    expect(parseCardDescription("**Kurzfassung**\n\nText\n\n**Erläuterung**\nin Seckenheim").bezirk).toBeNull();
    expect(parseCardDescription("**Kurzfassung**\n\nText", "BBR Seckenheim").bezirk).toBe("Seckenheim");
    expect(detectBezirk("Bezirksbeirat: Mannheim-Seckenheim")).toBe("Seckenheim");
  });

  it("verträgt fehlende Kurzfassung, Aufzählungszeichen und Windows-Zeilenenden", () => {
    expect(extractKurzfassung("**Erläuterung**\nnur Text")).toBe("");
    expect(extractKurzfassung("**Kurzfassung**\r\n\r\n- Eins\r\n- Zwei\r\n")).toBe("Eins\nZwei");
    expect(extractKurzfassung("## Kurzfassung\nA\nB\n## Erläuterung\nC")).toBe("A\nB");
  });

  it("vergleicht Kurzfassungen unabhängig von Leerraum", () => {
    expect(kurzfassungKey("T", "a  b\nc", "Seckenheim")).toBe(kurzfassungKey("T ", "a b c", "Seckenheim"));
    expect(kurzfassungKey("T", "a", null)).not.toBe(kurzfassungKey("T", "b", null));
  });

  it("benennt den BBR-Kanal", () => {
    expect(bbrAccountName("Seckenheim")).toBe("CDU-Gruppe im BBR Seckenheim");
    expect(bbrAccountName(null)).toContain("Seckenheim/Friedrichsfeld");
  });
});

describe("Fettdruck in der Kurzfassung", () => {
  it("zerlegt **…** in Abschnitte und entfernt Auszeichnung", async () => {
    const { boldSegments, stripMarkdown } = await import("./bbr-card");
    expect(boldSegments("**Anliegen:** In den Quartieren")).toEqual([
      { text: "Anliegen:", bold: true },
      { text: " In den Quartieren", bold: false },
    ]);
    expect(boldSegments("ohne")).toEqual([{ text: "ohne", bold: false }]);
    expect(stripMarkdown("**Ziel:** Seckenheim __fair__ fördern")).toBe("Ziel: Seckenheim fair fördern");
  });
});
