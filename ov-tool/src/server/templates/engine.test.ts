import { describe, expect, it } from "vitest";
import { fromBerlin } from "@/lib/dates";
import {
  dueText,
  extractPlaceholders,
  findUnknownPlaceholders,
  parseFrontMatter,
  personsText,
  renderHtml,
  renderMailTemplate,
  textToHtml,
} from "./engine";

const beginn = fromBerlin(2026, 2, 26, 19, 0);

describe("Vorlagen-Engine", () => {
  it("trennt Front Matter und Inhalt", () => {
    const p = parseFrontMatter("---\nbetreff: Hallo {{a}}\n---\nText");
    expect(p.meta.betreff).toBe("Hallo {{a}}");
    expect(p.body).toBe("Text");
  });

  it("rendert Betreff und Text aus einem einzigen Datumsfeld", () => {
    const src = "---\nbetreff: Einladung am {{datum sitzung.beginn}} um {{uhrzeitKurz sitzung.beginn}} Uhr\n---\nam {{datumLang sitzung.beginn}}, {{uhrzeitKurz sitzung.beginn}} Uhr\n\n\n\nEnde";
    const mail = renderMailTemplate(src, { sitzung: { beginn } });
    expect(mail.subject).toBe("Einladung am 26.02.2026 um 19 Uhr");
    expect(mail.text).toBe("am Donnerstag, 26. Februar 2026, 19 Uhr\n\nEnde\n");
  });

  it("escaped HTML in Dokumenten, nicht in Klartext-Mails", () => {
    expect(renderHtml("<p>{{x}}</p>", { x: "<b>&" })).toBe("<p>&lt;b&gt;&amp;</p>");
    expect(renderMailTemplate("{{x}}", { x: "<b>&" }).text).toBe("<b>&\n");
  });

  it("macht Links in HTML-Mails klickbar und escaped den Rest", () => {
    const html = textToHtml("Link: https://example.org/a?b=1\n<script>");
    expect(html).toContain('<a href="https://example.org/a?b=1"');
    expect(html).toContain("&lt;script&gt;");
  });

  it("eq-Helfer und statusText", () => {
    expect(renderHtml('{{#eq a "X"}}ja{{else}}nein{{/eq}} {{statusText s}}', { a: "X", s: "ANWESEND_DIGITAL" })).toBe(
      "ja anwesend (digital)",
    );
  });

  it("fristText und personen", () => {
    expect(dueText({ dueDate: beginn })).toBe("26.02.2026");
    expect(dueText({ dueText: "laufend" })).toBe("laufend");
    expect(personsText(["Kelsch", { name: "Kandzior" }])).toBe("Kelsch, Kandzior");
    expect(personsText("VORSTAND")).toBe("Vorstand");
  });

  it("findet Platzhalter inklusive Schleifen und ../", () => {
    const src = "---\nbetreff: {{a.b}}\n---\n{{#each liste}}{{titel}} {{../ov.ort}} {{datum beginn}}{{/each}}{{#if c}}{{d}}{{/if}}";
    expect(extractPlaceholders(src)).toEqual(["a.b", "c", "d", "liste", "liste[].beginn", "liste[].titel", "ov.ort"]);
  });

  it("meldet unbekannte Platzhalter", () => {
    const src = "{{sitzung.beginn}} {{sitzung.tippfehler}} {{aktion.titel}} {{#if liste.length}}{{/if}}";
    expect(findUnknownPlaceholders(src, ["sitzung.beginn", "aktion.*", "liste", "liste[].x"])).toEqual([
      "sitzung.tippfehler",
    ]);
  });
});

describe("Mail-Auszeichnung", () => {
  it("setzt **fett** in HTML um und entfernt die Sternchen im Klartext", async () => {
    const { textToHtml, stripMarkup } = await import("./engine");
    expect(textToHtml("Termin:\n**Dienstag, 13. Oktober 2026, 19 Uhr**")).toContain("<strong");
    expect(stripMarkup("**Dienstag, 19 Uhr**\n**Ort**")).toBe("Dienstag, 19 Uhr\nOrt");
  });

  it("stellt die Tagesordnung als ausgerichtete Tabelle dar, Unterpunkte eingerückt", async () => {
    const { textToHtml } = await import("./engine");
    const html = textToHtml("TOP 1\tBegrüßung\n\tTOP 1.1\tBericht Kreisverband\nTOP 2\tSonstiges");
    expect(html).toContain("<table");
    expect(html).toMatch(/TOP 1<\/td><td[^>]*>Begrüßung/);
    expect(html).toMatch(/padding:3px 12px 3px 16px[^>]*>TOP 1\.1/);
  });

  it("erkennt die Tagesordnung auch mit Windows-Zeilenumbrüchen aus dem Formular", async () => {
    const { textToHtml, stripMarkup } = await import("./engine");
    const html = textToHtml("Folgende Tagesordnung:\r\n\r\nTOP 1\tBegrüßung\r\nTOP 10\tRückblick\r\n\r\nGruß");
    expect(html).toContain("<table");
    expect(html).toMatch(/TOP 10<\/td><td[^>]*>Rückblick/);
    expect(stripMarkup("a\r\nb")).toBe("a\nb");
  });
});
