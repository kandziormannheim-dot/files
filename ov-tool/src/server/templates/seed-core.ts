// Übernimmt die Ausgangsvorlagen aus templates/ in die DB (Version 1), sofern ein Schlüssel noch fehlt.
// Ohne "server-only", damit prisma/seed.ts es nutzen kann.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { TEMPLATE_DEFS } from "./registry";

export async function seedTemplates(db: PrismaClient, templatesDir: string): Promise<string[]> {
  const created: string[] = [];
  for (const def of TEMPLATE_DEFS) {
    const body = await readFile(path.join(/*turbopackIgnore: true*/ templatesDir, def.file), "utf8");
    const versions = await db.template.findMany({ where: { key: def.key }, orderBy: { version: "desc" } });
    if (versions.length) {
      // Unveränderte Standardvorlagen (nie von jemandem bearbeitet) auf die neue Ausgangsfassung heben;
      // selbst bearbeitete Vorlagen bleiben unangetastet.
      const untouched = versions.every((v) => !v.createdById);
      const latest = versions[0]!;
      if (untouched && latest.body !== body) {
        await db.$transaction([
          db.template.updateMany({ where: { key: def.key }, data: { active: false } }),
          db.template.create({ data: { key: def.key, name: def.name, body, version: latest.version + 1, active: true } }),
        ]);
        created.push(`${def.key} (aktualisiert)`);
      }
      continue;
    }
    await db.template.create({ data: { key: def.key, name: def.name, body, version: 1, active: true } });
    created.push(def.key);
  }
  return created;
}
