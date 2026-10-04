// Seed: Standardvorlagen aus templates/ (inkl. Standard-TOPs) und der erste Admin (aus Umgebungsvariablen).
// Aufruf: npm run db:seed – mehrfach ausführbar, vorhandene Daten bleiben unverändert.
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedTemplates } from "../src/server/templates/seed-core";

const db = new PrismaClient();

async function main() {
  const created = await seedTemplates(db, path.join(process.cwd(), "templates"));
  console.info(created.length ? `Vorlagen angelegt: ${created.join(", ")}` : "Vorlagen bereits vorhanden.");

  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    if ((await db.user.count({ where: { role: "ADMIN" } })) === 0) {
      console.warn("Kein Admin vorhanden – SEED_ADMIN_EMAIL und SEED_ADMIN_NAME setzen und Seed erneut ausführen.");
    }
    return;
  }
  const name = process.env.SEED_ADMIN_NAME ?? "Admin";
  const admin = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role: "ADMIN", functionTitle: process.env.SEED_ADMIN_FUNCTION ?? "", sortOrder: 1 },
  });
  console.info(`Admin: ${admin.name} <${admin.email}>`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
