import "server-only";
import { db } from "@/server/db";
import { readTemplateFile } from "./files";
import { templateDef } from "./registry";

/**
 * Aktive Fassung einer Vorlage: aus der DB (versioniert, in den Einstellungen bearbeitbar),
 * sonst die Ausgangsfassung aus templates/ (Version 0, z. B. vor dem ersten Seed).
 */
export async function getTemplateSource(key: string): Promise<{ source: string; version: number }> {
  templateDef(key);
  const t = await db.template.findFirst({ where: { key, active: true }, orderBy: { version: "desc" } });
  if (t) return { source: t.body, version: t.version };
  return { source: await readTemplateFile(key), version: 0 };
}
