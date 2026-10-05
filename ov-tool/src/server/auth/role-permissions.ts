import "server-only";
import type { Role, User } from "@prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import {
  applyRoleCapabilities,
  assertCan,
  CAPABILITIES,
  currentRoleCapabilities,
  DEFAULT_ROLE_CAPABILITIES,
  EDITABLE_ROLES,
  type Capability,
} from "./permissions";

// Rechtemanagement: Rechte je Rolle als JSON in Setting "permissions.roles". Je Prozess kurz zwischengespeichert,
// damit can() synchron bleibt; nach dem Speichern sofort neu geladen.

const KEY = "permissions.roles";
const TTL_MS = 15_000;
let loadedAt = 0;

export async function loadRolePermissions(force = false) {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  const row = await db.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  let parsed: Record<string, string[]> | null = null;
  try {
    parsed = row ? (JSON.parse(row.value) as Record<string, string[]>) : null;
  } catch {
    parsed = null;
  }
  applyRoleCapabilities(parsed);
  loadedAt = Date.now();
}

export function rolePermissionMatrix() {
  const current = currentRoleCapabilities();
  return Object.fromEntries(EDITABLE_ROLES.map((r) => [r, [...current[r]]])) as Record<(typeof EDITABLE_ROLES)[number], Capability[]>;
}

/** Formular: Checkboxen "cap:ROLLE:recht". */
export async function saveRolePermissions(actor: Pick<User, "id" | "role">, formData: FormData) {
  assertCan(actor, "settings.manage");
  const known = new Set<string>(CAPABILITIES);
  const next: Record<string, Capability[]> = {};
  for (const role of EDITABLE_ROLES) next[role] = ["read"];
  for (const key of formData.keys()) {
    const [prefix, role, cap] = key.split(":");
    if (prefix !== "cap" || !role || !cap || !(EDITABLE_ROLES as readonly string[]).includes(role) || !known.has(cap) || cap === "read") continue;
    next[role]!.push(cap as Capability);
  }
  await loadRolePermissions(true);
  const before = rolePermissionMatrix();
  const diff: Record<string, { hinzu: string[]; entfernt: string[] }> = {};
  for (const role of EDITABLE_ROLES) {
    const a = new Set<string>(before[role]);
    const b = new Set<string>(next[role]);
    const hinzu = [...b].filter((c) => !a.has(c));
    const entfernt = [...a].filter((c) => !b.has(c));
    if (hinzu.length || entfernt.length) diff[role] = { hinzu, entfernt };
  }
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(next) }, create: { key: KEY, value: JSON.stringify(next) } });
    await audit(tx, actor, "permissions.update", "Setting", KEY, diff);
  });
  await loadRolePermissions(true);
  return Object.keys(diff).length;
}

export async function resetRolePermissions(actor: Pick<User, "id" | "role">) {
  assertCan(actor, "settings.manage");
  await db.$transaction(async (tx) => {
    await tx.setting.deleteMany({ where: { key: KEY } });
    await audit(tx, actor, "permissions.reset", "Setting", KEY);
  });
  await loadRolePermissions(true);
}

export function defaultCapabilities(role: Role) {
  return DEFAULT_ROLE_CAPABILITIES[role];
}
