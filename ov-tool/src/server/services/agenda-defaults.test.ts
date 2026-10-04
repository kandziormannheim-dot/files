import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fromBerlin } from "@/lib/dates";
import { buildDefaultAgenda, parseStandardAgenda } from "./agenda-defaults";

const def = parseStandardAgenda(readFileSync(path.join(process.cwd(), "templates/standard-tagesordnung.json"), "utf8"));

describe("Standard-Tagesordnung", () => {
  it("ohne offene Protokolle und überfällige Aufgaben", () => {
    const items = buildDefaultAgenda(def, { minutesToApprove: [], overdueTasks: [], topics: [] });
    expect(items.map((i) => i.title)).toEqual([
      "Begrüßung durch den Vorsitzenden",
      "Bericht aus dem BBR Seckenheim",
      "Bericht aus dem BBR Friedrichsfeld",
      "Bericht aus dem Gemeinderat",
      "Termine",
      "Sonstiges",
    ]);
    expect(items[0]!.children).toEqual([{ title: "Bericht aus dem CDU Kreisverband Mannheim" }]);
    expect(items.at(-2)!.kind).toBe("TERMINE");
    expect(items.at(-1)!.kind).toBe("SONSTIGES");
  });

  it("mit Protokollgenehmigung, Aufgabenbericht und Stadtteil-Themen", () => {
    const items = buildDefaultAgenda(def, {
      minutesToApprove: [{ id: "m1", meetingDate: fromBerlin(2026, 10, 15, 19) }],
      overdueTasks: [{ title: "Plakate", responsible: "Muster", due: "01.10.2026" }],
      topics: [{ id: "t1", title: "Parksituation Hauptstraße" }],
    });
    expect(items.map((i) => i.title)).toEqual([
      "Begrüßung durch den Vorsitzenden",
      "Genehmigung des Protokolls der Sitzung vom 15.10.2026",
      "Bericht aus dem BBR Seckenheim",
      "Bericht aus dem BBR Friedrichsfeld",
      "Bericht aus dem Gemeinderat",
      "Stand offener Aufgaben",
      "Parksituation Hauptstraße",
      "Termine",
      "Sonstiges",
    ]);
    expect(items[1]).toMatchObject({ kind: "PROTOKOLLGENEHMIGUNG", minutesToApproveId: "m1" });
    expect(items[5]!.description).toBe("Plakate – Muster – 01.10.2026");
    expect(items[6]!.topicId).toBe("t1");
  });
});
