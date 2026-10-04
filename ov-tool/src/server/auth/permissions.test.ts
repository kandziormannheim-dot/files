import { describe, expect, it } from "vitest";
import { can, canEditOwned } from "./permissions";

describe("Rollenrechte (SPEC.md Abschnitt 2)", () => {
  it("Admin darf alles", () => {
    expect(can("ADMIN", "users.manage")).toBe(true);
    expect(can("ADMIN", "invitation.send")).toBe(true);
    expect(can("ADMIN", "minutes.send")).toBe(true);
  });

  it("Schriftführer wie Vorstand plus Protokolle und Transkripte", () => {
    expect(can("SCHRIFTFUEHRER", "minutes.edit")).toBe(true);
    expect(can("SCHRIFTFUEHRER", "minutes.send")).toBe(true);
    expect(can("SCHRIFTFUEHRER", "transcript.upload")).toBe(true);
    expect(can("SCHRIFTFUEHRER", "task.create")).toBe(true);
    expect(can("SCHRIFTFUEHRER", "users.manage")).toBe(false);
    expect(can("SCHRIFTFUEHRER", "invitation.send")).toBe(false);
  });

  it("Vorstand legt an und schlägt TOPs vor, versendet aber nichts", () => {
    for (const c of ["task.create", "topic.create", "action.create", "agenda.propose", "shift.signup"] as const) {
      expect(can("VORSTAND", c)).toBe(true);
    }
    expect(can("VORSTAND", "minutes.edit")).toBe(false);
    expect(can("VORSTAND", "invitation.send")).toBe(false);
    expect(can("VORSTAND", "task.editAll")).toBe(false);
  });

  it("Lesezugriff und Gast lesen nur und sagen zu oder ab", () => {
    for (const role of ["LESEZUGRIFF", "GAST"] as const) {
      expect(can(role, "read")).toBe(true);
      expect(can(role, "meeting.respond")).toBe(true);
      expect(can(role, "task.create")).toBe(false);
      expect(can(role, "shift.signup")).toBe(false);
    }
  });

  it("eigene Objekte: Vorstand ja, Lesezugriff nie, Admin immer", () => {
    expect(canEditOwned("VORSTAND", "task.editAll", "u1", ["u1"])).toBe(true);
    expect(canEditOwned("VORSTAND", "task.editAll", "u1", ["u2"])).toBe(false);
    expect(canEditOwned("LESEZUGRIFF", "task.editAll", "u1", ["u1"])).toBe(false);
    expect(canEditOwned("ADMIN", "task.editAll", "u1", [])).toBe(true);
  });
});
