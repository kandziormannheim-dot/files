// Übernimmt die Ausgangsvorlagen aus templates/ in die DB (Version 1), sofern ein Schlüssel noch fehlt.
// Ohne "server-only", damit prisma/seed.ts es nutzen kann.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { TEMPLATE_DEFS } from "./registry";

export async function seedTemplates(db: PrismaClient, templatesDir: string): Promise<string[]> {
  const created: string[] = [];
  for (const def of TEMPLATE_DEFS) {
    const exists = await db.template.findFirst({ where: { key: def.key } });
    if (exists) continue;
    const body = await readFile(path.join(templatesDir, def.file), "utf8");
    await db.template.create({ data: { key: def.key, name: def.name, body, version: 1, active: true } });
    created.push(def.key);
  }
  return created;
}
