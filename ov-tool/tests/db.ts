import type { Role, User } from "@prisma/client";
import { db } from "@/server/db";

export const hasTestDb = !!process.env.TEST_DATABASE_URL;

/** Leert alle Tabellen (außer Prisma-Migrationen). */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  }
}

let counter = 0;
export async function makeUser(overrides: Partial<User> & { role?: Role } = {}): Promise<User> {
  counter += 1;
  return db.user.create({
    data: {
      name: `Testperson ${counter}`,
      email: `person${counter}-${Date.now()}@example.org`,
      ...overrides,
    },
  });
}

export function form(values: Record<string, string | string[] | boolean | number | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === false) continue;
    if (Array.isArray(v)) for (const x of v) fd.append(k, x);
    else fd.append(k, v === true ? "on" : String(v));
  }
  return fd;
}
