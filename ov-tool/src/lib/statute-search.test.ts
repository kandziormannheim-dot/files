import { describe, expect, it } from "vitest";
import data from "@/data/statutes.json";
import { citation, findSection, highlight, parseReference, searchStatutes, type StatuteData } from "./statute-search";

const statutes = data as StatuteData;

describe("Satzungstexte", () => {
  it("enthalten Statut und Landessatzung mit Stand und Quelle", () => {
    const ids = statutes.documents.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["statut", "lv-satzung", "go-cdu", "partg"]));
    for (const d of statutes.documents) {
      expect(d.stand).toMatch(/\d{2}\.\d{2}\.\d{4}/);
      expect(d.source).toMatch(/^https:\/\//);
      expect(d.sections.length).toBeGreaterThan(5);
    }
    // Paragraphen, auf die sich die Satzungslogik stützt
    expect(findSection(statutes, "statut", "40")?.section.title).toBe("Beschlussfähigkeit");
    expect(findSection(statutes, "statut", "43")?.section.title).toBe("Wahlen");
    expect(findSection(statutes, "lv-satzung", "52")?.section.title).toBe("Beschlussfähigkeit");
    expect(findSection(statutes, "lv-satzung", "57")?.section.title).toBe("Wahlverfahren");
    expect(findSection(statutes, "lv-satzung", "50")?.section.absaetze.length).toBeGreaterThanOrEqual(3);
  });

  it("enthalten keine Seitenköpfe oder Seitenzahlen im Fließtext", () => {
    const all = statutes.documents.flatMap((d) => d.sections.flatMap((s) => s.absaetze.map((a) => a.text))).join("\n");
    expect(all).not.toMatch(/[a-zäöü] \d{1,3} Statut der CDU (?!Deutschland)/);
    expect(all).not.toMatch(/\bSATZUNG\b/);
  });
});

describe("parseReference", () => {
  it("erkennt Fundstellen mit Ordnung und Absatz", () => {
    expect(parseReference("§ 43 Statut")).toEqual({ docId: "statut", num: "43", absatz: undefined });
    expect(parseReference("LV-Satzung § 57 Abs. 2")).toEqual({ docId: "lv-satzung", num: "57", absatz: "2" });
    expect(parseReference("§ 40 a")).toEqual({ docId: undefined, num: "40a", absatz: undefined });
    expect(parseReference("Wahlen im Vorstand")).toBeNull();
  });
});

describe("searchStatutes", () => {
  it("findet Paragraphen per Fundstelle direkt", () => {
    const hits = searchStatutes(statutes, "LV-Satzung § 52 Abs. 3");
    expect(hits[0]).toMatchObject({ docId: "lv-satzung", num: "52", absatz: 2 });
  });

  it("findet ohne Ordnung Landessatzung und Statut", () => {
    const hits = searchStatutes(statutes, "§ 40");
    expect(hits.map((h) => h.docId)).toEqual(["lv-satzung", "statut"]);
  });

  it("findet Wahlverfahren bei Stichwahl", () => {
    const hits = searchStatutes(statutes, "Stichwahl Stimmengleichheit");
    expect(hits.slice(0, 3).map((h) => `${h.docId} ${h.num}`)).toContain("lv-satzung 57");
  });

  it("findet die Beschlussfähigkeit über das Synonym Quorum", () => {
    const hits = searchStatutes(statutes, "Quorum");
    expect(hits.slice(0, 3).map((h) => `${h.docId} ${h.num}`)).toEqual(expect.arrayContaining(["lv-satzung 52"]));
  });

  it("findet das Umlaufverfahren", () => {
    const hits = searchStatutes(statutes, "Umlaufverfahren Widerspruch");
    expect(hits.slice(0, 5).map((h) => `${h.docId} ${h.num}`)).toContain("statut 42");
  });

  it("filtert nach Ordnung", () => {
    const hits = searchStatutes(statutes, "Wahl", { docIds: ["partg"] });
    expect(hits.every((h) => h.docId === "partg")).toBe(true);
  });

  it("liefert leere Liste bei Unsinn", () => {
    expect(searchStatutes(statutes, "xyzzyquux")).toEqual([]);
  });
});

describe("Darstellung", () => {
  it("bildet Zitate", () => {
    expect(citation({ short: "Statut" }, { num: "40a" }, "2")).toBe("Statut § 40 a Abs. 2");
    expect(citation({ short: "LV-Satzung" }, { num: "57" })).toBe("LV-Satzung § 57");
  });

  it("markiert Treffer", () => {
    const parts = highlight("Wahlen werden geheim durch Stimmzettel vorgenommen.", ["stimmzettel"]);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["Stimmzettel"]);
  });
});
