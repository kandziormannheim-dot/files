import { describe, expect, it } from "vitest";
import { numberAgenda } from "./agenda";

describe("numberAgenda", () => {
  it("nummeriert TOPs und Unterpunkte nach Position", () => {
    const items = [
      { id: "c", parentId: null, position: 30, title: "Sonstiges" },
      { id: "a", parentId: null, position: 10, title: "Begrüßung" },
      { id: "a2", parentId: "a", position: 2, title: "Bericht Gemeinderat" },
      { id: "a1", parentId: "a", position: 1, title: "Bericht KV" },
      { id: "b", parentId: null, position: 20, title: "Termine" },
    ];
    expect(numberAgenda(items).map((i) => `${i.number} ${i.title}`)).toEqual([
      "1 Begrüßung",
      "1.1 Bericht KV",
      "1.2 Bericht Gemeinderat",
      "2 Termine",
      "3 Sonstiges",
    ]);
    expect(numberAgenda(items)[1]!.level).toBe(1);
  });
});
