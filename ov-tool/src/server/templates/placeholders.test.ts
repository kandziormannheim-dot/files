import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findUnknownPlaceholders } from "./engine";
import { KNOWN_PLACEHOLDERS } from "./placeholders";
import { TEMPLATE_DEFS } from "./registry";

describe("Standardvorlagen", () => {
  for (const def of TEMPLATE_DEFS.filter((d) => d.kind !== "json")) {
    it(`${def.file} nutzt nur bekannte Platzhalter`, () => {
      const source = readFileSync(path.join(process.cwd(), "templates", def.file), "utf8");
      expect(findUnknownPlaceholders(source, KNOWN_PLACEHOLDERS)).toEqual([]);
    });
  }
});
