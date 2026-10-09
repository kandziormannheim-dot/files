import { describe, expect, it } from "vitest";
import { effectiveTone, einblendungWindow, fallbackPlan, normalizePlan, pickStills, stillTimes, parseWhisperJson, planDuration, shotText, snapToWords, subtitleCues, type Segment, type VideoPlan } from "./video-plan";

const words = (list: [number, number, string][]) => list.map(([start, end, word]) => ({ start, end, word }));
const seg: Segment[] = [
  {
    start: 0.5,
    end: 6.2,
    text: "Die Kreuzung ist für Kinder gefährlich. Wir brauchen einen Zebrastreifen.",
    words: words([
      [0.5, 0.7, "Die"],
      [0.7, 1.3, "Kreuzung"],
      [1.3, 1.5, "ist"],
      [1.5, 1.7, "für"],
      [1.7, 2.2, "Kinder"],
      [2.2, 3.0, "gefährlich."],
      [3.4, 3.6, "Wir"],
      [3.6, 4.1, "brauchen"],
      [4.1, 4.4, "einen"],
      [4.4, 5.6, "Zebrastreifen."],
    ]),
  },
];

const base: VideoPlan = { titel: "Sicherer Schulweg", unterzeile: "", shots: [], abschluss: "Gemeinsam für sichere Schulwege", aufruf: "Mehr auf cdu-sf.de", beitragstext: "", hashtags: "", begruendung: "" };
const clipA = { id: "a", duration: 8, hasAudio: true, transcript: seg };
const clipB = { id: "b", duration: 20, hasAudio: false, transcript: null };

describe("Schnittplan", () => {
  it("legt O-Töne an Wortgrenzen", () => {
    expect(snapToWords(0.9, 2.9, seg, 8)).toEqual({ start: 0.58, end: 3.2 }); // „Kreuzung … gefährlich.“
    expect(snapToWords(1.0, 4.2, seg, 8).end).toBe(4.3); // „einen“ nur zu einem Drittel drin → endet nach „brauchen“
    expect(snapToWords(0, 3, [], 8)).toEqual({ start: 0, end: 3 });
  });

  it("entfernt Unbekanntes, schaltet stumme Clips auf ohne Ton und kürzt auf das Zeitbudget", () => {
    const plan: VideoPlan = {
      ...base,
      shots: [
        { clipId: "x", start: 0, end: 3, ton: "original", einblendung: "", untertitel: true, untertitelText: "" },
        { clipId: "a", start: 0.4, end: 3.0, ton: "original", einblendung: "", untertitel: true, untertitelText: "" },
        { clipId: "b", start: 2, end: 14, ton: "original", einblendung: "Hier fehlt ein Überweg", untertitel: true, untertitelText: "" },
        { clipId: "a", start: 3.3, end: 5.7, ton: "original", einblendung: "", untertitel: true, untertitelText: "" },
        { clipId: "b", start: 15, end: 25, ton: "stumm", einblendung: "", untertitel: false, untertitelText: "" },
      ],
    };
    const { plan: out, warnings } = normalizePlan(plan, [clipA, clipB], 20);
    expect(out.shots.map((s) => s.clipId)).toEqual(["a", "b", "a"]);
    expect(out.shots[1]).toMatchObject({ ton: "stumm", untertitel: false, untertitelText: "" });
    expect(planDuration(out)).toBeLessThanOrEqual(20);
    expect(out.shots[2]!.end).toBeLessThanOrEqual(5.8);
    expect(warnings.some((w) => w.includes("unbekannten Clip"))).toBe(true);
    expect(warnings.some((w) => w.includes("gekürzt"))).toBe(true);
  });

  it("verlängert zu kurze Ausschnitte auf 1,5 Sekunden", () => {
    const { plan } = normalizePlan({ ...base, shots: [{ clipId: "b", start: 19.5, end: 19.8, ton: "stumm", einblendung: "", untertitel: false, untertitelText: "" }] }, [clipB], 30);
    expect(plan.shots[0]).toMatchObject({ start: 18.5, end: 20 });
  });

  it("erstellt Untertitel-Zeilen nach Satzzeichen und Länge", () => {
    const cues = subtitleCues({ start: 0.4, end: 5.8 }, seg);
    expect(cues.map((c) => c.text)).toEqual(["Die Kreuzung ist für Kinder gefährlich.", "Wir brauchen einen Zebrastreifen."]);
    expect(cues[0]!.from).toBeCloseTo(0.1);
    expect(cues[1]!.to).toBeLessThanOrEqual(5.4);
    expect(shotText({ start: 3.3, end: 5.7 }, seg)).toBe("Wir brauchen einen Zebrastreifen.");
    // korrigierter Text wird über die Sprechzeit verteilt
    const fixed = subtitleCues({ start: 3.3, end: 5.7, untertitelText: "Wir brauchen endlich einen Zebrastreifen." }, seg);
    expect(fixed).toEqual([{ from: 0.1, to: 2.4, text: "Wir brauchen endlich einen Zebrastreifen." }]);
    expect(subtitleCues({ start: 0, end: 4, untertitelText: "Eins zwei drei vier fünf sechs sieben acht neun." }, []).map((c) => c.text)).toEqual(["Eins zwei drei vier fünf sechs sieben", "acht neun."]);
  });

  it("baut ohne KI einen gleichmäßigen Schnitt", () => {
    const p = fallbackPlan([clipA, clipB], 30, { titel: "T", botschaft: "B", aufruf: "A" });
    expect(p.shots).toHaveLength(2);
    expect(planDuration(p)).toBeLessThanOrEqual(30.01);
    expect(normalizePlan(p, [clipA, clipB], 30).plan.shots).toHaveLength(2);
  });

  it("behält verschobene Texte und Zeitfenster und begrenzt sie", () => {
    const { plan } = normalizePlan(
      {
        ...base,
        titelPos: { x: 120, y: -5 },
        untertitelY: 3,
        shots: [{ clipId: "b", start: 0, end: 10, ton: "stumm", einblendung: "Fakt", untertitel: false, untertitelText: "", einblendungPos: { x: 10.04, y: 40 }, einblendungVon: 2, einblendungBis: 30 }],
      },
      [clipB],
      320,
    );
    expect(plan.titelPos).toEqual({ x: 90, y: 0 });
    expect(plan.untertitelY).toBe(10);
    expect(plan.shots[0]).toMatchObject({ einblendungPos: { x: 10, y: 40 }, einblendungVon: 2, einblendungBis: 10 });
    expect(einblendungWindow(plan.shots[0]!)).toEqual({ from: 2, to: 10 });
    // erster Ausschnitt: ohne eigene Angabe erst nach der Titelzeile, bei zu kurzem Rest gar nicht
    expect(einblendungWindow({ start: 0, end: 6 }, 3)).toEqual({ from: 3, to: 6 });
    expect(einblendungWindow({ start: 0, end: 3.5 }, 3)).toBeNull();
  });

  it("erlaubt lange Videos bis 320 Sekunden", () => {
    const long = { id: "l", duration: 600, hasAudio: false, transcript: null };
    const shots = Array.from({ length: 30 }, (_, i) => ({ clipId: "l", start: i * 20, end: i * 20 + 15, ton: "stumm" as const, einblendung: "", untertitel: false, untertitelText: "" }));
    const { plan } = normalizePlan({ ...base, shots }, [long], 320);
    expect(planDuration(plan)).toBeLessThanOrEqual(320);
    expect(planDuration(plan)).toBeGreaterThan(310);
  });

  it("verteilt Standbilder nach Cliplänge und begrenzt die Bilder je KI-Anfrage", () => {
    expect(stillTimes(10)).toEqual([1, 5, 8.5]);
    const long = stillTimes(898);
    expect(long).toHaveLength(24);
    expect(long[0]).toBeGreaterThan(15);
    expect(long[23]).toBeLessThan(898);
    expect(stillTimes(100)).toHaveLength(5);
    const picked = pickStills([Array.from({ length: 24 }, (_, i) => i), Array.from({ length: 24 }, (_, i) => i), Array.from({ length: 24 }, (_, i) => i)], 60);
    expect(picked.reduce((n, l) => n + l.length, 0)).toBeLessThanOrEqual(60);
    expect(picked[0]![0]).toBe(0);
    expect(pickStills([[1, 2, 3]], 60)).toEqual([[1, 2, 3]]);
  });

  it("macht ohne Musik keine Stille", () => {
    expect(effectiveTone("stumm", true, false)).toBe("leise");
    expect(effectiveTone("stumm", true, true)).toBe("stumm");
    expect(effectiveTone("original", false, false)).toBe("stumm");
    expect(effectiveTone("original", true, false)).toBe("original");
  });

  it("liest das Whisper-JSON", () => {
    const s = parseWhisperJson({ segments: [{ start: 0, end: 1.5, text: " Hallo zusammen", words: [{ start: 0, end: 0.6, word: " Hallo" }, { start: 0.6, end: 1.4, word: " zusammen" }] }, { start: 2, end: 2, text: "" }] });
    expect(s).toEqual([{ start: 0, end: 1.5, text: "Hallo zusammen", words: [{ start: 0, end: 0.6, word: "Hallo" }, { start: 0.6, end: 1.4, word: "zusammen" }] }]);
  });
});
