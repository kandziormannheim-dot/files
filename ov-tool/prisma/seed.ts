// Seed: Beispiel-Admin (aus Umgebungsvariablen). Paket 1.6 ergänzt Vorlagen und Standard-TOPs.
// Aufruf: npx prisma db seed
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.org").trim().toLowerCase();
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
