import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS, visibleNavItems } from "./nav-items";

describe("Hauptnavigation", () => {
  it("enthält die Bereiche aus SPEC.md Abschnitt 8 in fester Reihenfolge", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Übersicht",
      "Sitzungen",
      "Aufgaben",
      "Aktionen",
      "Themen",
      "Marketing",
      "Inventar",
      "Vorstand",
      "Links",
      "Einstellungen",
    ]);
  });

  it("zeigt Einstellungen nur Admins", () => {
    expect(visibleNavItems(false).some((i) => i.href === "/settings")).toBe(false);
    expect(visibleNavItems(true).some((i) => i.href === "/settings")).toBe(true);
  });

  it("markiert Unterseiten als aktiv, die Übersicht aber nur exakt", () => {
    expect(isActive("/meetings/42", "/meetings")).toBe(true);
    expect(isActive("/meetingsx", "/meetings")).toBe(false);
    expect(isActive("/tasks", "/")).toBe(false);
    expect(isActive("/", "/")).toBe(true);
  });
});
