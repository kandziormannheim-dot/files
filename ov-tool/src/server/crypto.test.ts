import { afterEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

describe("Verschlüsselung Bürgerkontakte", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("verschlüsselt mit zufälligem IV und entschlüsselt verlustfrei", () => {
    process.env.ENCRYPTION_KEY = "test-schluessel-nur-fuer-tests";
    const a = encrypt("Erika Beispiel, 0621 123456");
    expect(a).not.toContain("Erika");
    expect(encrypt("Erika Beispiel, 0621 123456")).not.toBe(a);
    expect(decrypt(a)).toBe("Erika Beispiel, 0621 123456");
  });

  it("erkennt Manipulation und falschen Schlüssel", () => {
    process.env.ENCRYPTION_KEY = "schluessel-a";
    const a = encrypt("geheim");
    process.env.ENCRYPTION_KEY = "schluessel-b";
    expect(() => decrypt(a)).toThrow();
  });

  it("ohne Schlüssel kein Speichern", () => {
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });
});
