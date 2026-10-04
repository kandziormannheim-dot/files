import type { Prisma, PrismaClient } from "@prisma/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;
export type Actor = { id: string } | null;

/**
 * Schreibt einen Audit-Eintrag (CLAUDE.md Regel 3). Wird ausschließlich aus dem Service-Layer aufgerufen,
 * idealerweise in derselben Transaktion wie die Änderung.
 */
export async function audit(
  db: DbClient,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  diff?: unknown,
) {
  await db.auditLog.create({
    data: {
      userId: actor?.id ?? null,
      action,
      entityType,
      entityId,
      diff: diff === undefined ? undefined : (JSON.parse(JSON.stringify(diff)) as Prisma.InputJsonValue),
    },
  });
}

/** Geänderte Felder als { feld: [alt, neu] }; Datumswerte als ISO-Text. */
export function changes<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, [unknown, unknown]> {
  const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined ? null : v);
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of Object.keys(after)) {
    const a = norm(before[key]);
    const b = norm(after[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = [a, b];
  }
  return out;
}
