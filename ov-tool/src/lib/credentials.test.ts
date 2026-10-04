import { describe, expect, it } from "vitest";
import { looksLikeCredential, urlContainsCredentials } from "./credentials";

describe("Zugangsdaten-Erkennung", () => {
  it("erkennt Passwörter in Notizen", () => {
    expect(looksLikeCredential("Passwort: geheim123")).toBe(true);
    expect(looksLikeCredential("pw=abc")).toBe(true);
    expect(looksLikeCredential("Kennwort : x")).toBe(true);
  });
  it("lässt Zugangshinweise ohne Passwort zu", () => {
    expect(looksLikeCredential("Zugang über den Ortsvorsitzenden")).toBe(false);
    expect(looksLikeCredential("Passwort beim Schriftführer erfragen")).toBe(false);
    expect(looksLikeCredential("")).toBe(false);
  });
  it("erkennt Zugangsdaten in URLs", () => {
    expect(urlContainsCredentials("https://user:geheim@example.org")).toBe(true);
    expect(urlContainsCredentials("https://example.org/?token=abc")).toBe(true);
    expect(urlContainsCredentials("https://www.cduplus.cdu.de/")).toBe(false);
  });
});
