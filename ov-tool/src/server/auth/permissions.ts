import type { Role } from "@prisma/client";
import { ForbiddenError } from "@/server/errors";

// Rechte laut SPEC.md Abschnitt 2. Reine Funktionen, damit sie ohne DB getestet werden können.
// Geprüft wird immer serverseitig (requireCapability in session.ts), die UI blendet nur zusätzlich aus.

export const CAPABILITIES = [
  "read", // alles lesen
  "meeting.respond", // Zu-/Absage
  "users.manage",
  "settings.manage",
  "templates.manage",
  "audit.read",
  "meeting.manage", // Sitzungen anlegen/ändern, TO pflegen, TO-Vorschläge übernehmen
  "invitation.send",
  "agenda.propose",
  "task.create",
  "task.editAll",
  "topic.create",
  "topic.editAll",
  "action.create",
  "action.editAll",
  "shift.signup",
  "link.create",
  "link.manage", // alle Links bearbeiten, sortieren
  "minutes.edit",
  "minutes.send",
  "transcript.upload",
  "circulation.manage",
  "marketing.create", // Social-/Blog-Entwürfe anlegen und eigene bearbeiten
  "marketing.publish", // freigeben, alle bearbeiten, an WordPress senden
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const READ: Capability[] = ["read", "meeting.respond"];
const VORSTAND: Capability[] = [
  ...READ,
  "agenda.propose",
  "task.create",
  "topic.create",
  "action.create",
  "shift.signup",
  "link.create",
  "marketing.create",
];
const SCHRIFTFUEHRER: Capability[] = [...VORSTAND, "minutes.edit", "minutes.send", "transcript.upload"];

const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  ADMIN: new Set(CAPABILITIES),
  SCHRIFTFUEHRER: new Set(SCHRIFTFUEHRER),
  VORSTAND: new Set(VORSTAND),
  LESEZUGRIFF: new Set(READ),
  // Gäste mit Login: wie Lesezugriff (SPEC.md Abschnitt 2)
  GAST: new Set(READ),
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SCHRIFTFUEHRER: "Schriftführer",
  VORSTAND: "Vorstand",
  LESEZUGRIFF: "Lesezugriff",
  GAST: "Gast",
};

export const VOTING_RIGHT_LABELS = {
  STIMMBERECHTIGT: "stimmberechtigt",
  BERATEND: "beratend",
  OHNE: "ohne Stimmrecht",
} as const;

/** Eigene Objekte darf bearbeiten, wer sie angelegt hat oder verantwortlich ist; sonst nur mit *.editAll. */
export function canEditOwned(
  role: Role,
  editAll: Capability,
  userId: string,
  owners: ReadonlyArray<string | null | undefined>,
): boolean {
  if (can(role, editAll)) return true;
  if (!can(role, "task.create")) return false; // nur Rollen ab Vorstand bearbeiten überhaupt etwas
  return owners.includes(userId);
}

/** Wirft ForbiddenError, wenn die Rolle die Fähigkeit nicht hat. Aufruf in jedem Service vor Lesen/Schreiben. */
export function assertCan(user: { role: Role }, capability: Capability): void {
  if (!can(user.role, capability)) throw new ForbiddenError();
}
