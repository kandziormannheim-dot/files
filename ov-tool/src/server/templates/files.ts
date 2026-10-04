import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { templateDef } from "./registry";

// Laufzeitpfad; templates/ wird über outputFileTracingIncludes (next.config.ts) ins Build übernommen
export const TEMPLATES_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "templates");

/** Ausgangsfassung einer Vorlage aus templates/ (Seed und Rückfall, falls die DB-Vorlage fehlt). */
export async function readTemplateFile(key: string): Promise<string> {
  return readFile(path.join(/*turbopackIgnore: true*/ TEMPLATES_DIR, templateDef(key).file), "utf8");
}
