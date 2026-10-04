import path from "node:path";
import { db } from "./db";
import { seedTemplates } from "./templates/seed-core";

/**
 * Beim Serverstart (instrumentation.ts): fehlende Standardvorlagen anlegen und – falls noch kein Admin
 * existiert – den ersten Admin aus SEED_ADMIN_EMAIL/SEED_ADMIN_NAME. Idempotent.
 */
export async function bootstrap() {
  try {
    const created = await seedTemplates(db, path.join(/*turbopackIgnore: true*/ process.cwd(), "templates"));
    if (created.length) console.info(`[start] Vorlagen angelegt: ${created.join(", ")}`);
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    if (email && (await db.user.count({ where: { role: "ADMIN" } })) === 0) {
      await db.user.upsert({
        where: { email },
        update: { role: "ADMIN", active: true, loginEnabled: true },
        create: { email, name: process.env.SEED_ADMIN_NAME || "Admin", role: "ADMIN", functionTitle: process.env.SEED_ADMIN_FUNCTION ?? "", sortOrder: 1 },
      });
      console.info(`[start] Erster Admin angelegt: ${email}`);
    }
  } catch (err) {
    console.error("[start] Initialisierung fehlgeschlagen:", err);
  }
}
