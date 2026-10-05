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
  "inventory.edit", // Inventar anlegen, bearbeiten, verleihen
  "inventory.manage", // ausmustern, löschen
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
  "inventory.edit",
];
const SCHRIFTFUEHRER: Capability[] = [...VORSTAND, "minutes.edit", "minutes.send", "transcript.upload"];

/** Werkseinstellung je Rolle; im Rechtemanagement (Einstellungen → Rechte) anpassbar. */
export const DEFAULT_ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: CAPABILITIES,
  SCHRIFTFUEHRER: SCHRIFTFUEHRER,
  VORSTAND: VORSTAND,
  LESEZUGRIFF: READ,
  // Gäste mit Login: wie Lesezugriff (SPEC.md Abschnitt 2)
  GAST: READ,
};

/** Rollen, deren Rechte angepasst werden können – Admin hat immer alle Rechte. */
export const EDITABLE_ROLES = ["SCHRIFTFUEHRER", "VORSTAND", "LESEZUGRIFF", "GAST"] as const satisfies readonly Role[];

function toSets(map: Record<Role, readonly Capability[]>): Record<Role, ReadonlySet<Capability>> {
  return Object.fromEntries(Object.entries(map).map(([r, c]) => [r, new Set(c)])) as unknown as Record<Role, ReadonlySet<Capability>>;
}

let roleCapabilities = toSets(DEFAULT_ROLE_CAPABILITIES);

/**
 * Gespeicherte Rechte übernehmen (aus der Tabelle Setting, siehe role-permissions.ts). Unbekannte Rechte werden
 * ignoriert, fehlende Rollen behalten die Werkseinstellung; „read“ bleibt für jede Rolle mit Login erhalten.
 */
export function applyRoleCapabilities(overrides: Partial<Record<string, readonly string[]>> | null | undefined) {
  const known = new Set<string>(CAPABILITIES);
  const merged: Record<Role, readonly Capability[]> = { ...DEFAULT_ROLE_CAPABILITIES };
  for (const role of EDITABLE_ROLES) {
    const list = overrides?.[role];
    if (Array.isArray(list)) merged[role] = ["read", ...list.filter((c): c is Capability => known.has(c) && c !== "read")];
  }
  merged.ADMIN = CAPABILITIES;
  roleCapabilities = toSets(merged);
}

export function currentRoleCapabilities(): Record<Role, ReadonlySet<Capability>> {
  return roleCapabilities;
}

export function can(role: Role, capability: Capability): boolean {
  if (role === "ADMIN") return true;
  return roleCapabilities[role].has(capability);
}

/** Beschriftung der Rechte für das Rechtemanagement, gruppiert nach Bereich. */
export const CAPABILITY_GROUPS: { title: string; items: { cap: Capability; label: string; hint?: string }[] }[] = [
  {
    title: "Grundrechte",
    items: [
      { cap: "read", label: "Alles lesen", hint: "immer aktiv für alle mit Login" },
      { cap: "meeting.respond", label: "Zu-/Absage zu Sitzungen" },
    ],
  },
  {
    title: "Sitzungen & Protokolle",
    items: [
      { cap: "meeting.manage", label: "Sitzungen anlegen und Tagesordnung pflegen" },
      { cap: "agenda.propose", label: "TOPs vorschlagen" },
      { cap: "invitation.send", label: "Einladungen versenden" },
      { cap: "minutes.edit", label: "Protokolle schreiben" },
      { cap: "minutes.send", label: "Protokolle versenden" },
      { cap: "transcript.upload", label: "Transkripte/Aufnahmen hochladen" },
      { cap: "circulation.manage", label: "Umlaufverfahren starten" },
    ],
  },
  {
    title: "Arbeit im Vorstand",
    items: [
      { cap: "task.create", label: "Aufgaben anlegen (eigene bearbeiten)" },
      { cap: "task.editAll", label: "Alle Aufgaben bearbeiten" },
      { cap: "topic.create", label: "Themen anlegen" },
      { cap: "topic.editAll", label: "Alle Themen bearbeiten" },
      { cap: "action.create", label: "Aktionen anlegen" },
      { cap: "action.editAll", label: "Alle Aktionen bearbeiten" },
      { cap: "shift.signup", label: "Für Schichten eintragen" },
    ],
  },
  {
    title: "Öffentlichkeitsarbeit",
    items: [
      { cap: "marketing.create", label: "Beiträge und Blogartikel entwerfen" },
      { cap: "marketing.publish", label: "Beiträge freigeben und veröffentlichen" },
    ],
  },
  {
    title: "Inventar & Links",
    items: [
      { cap: "inventory.edit", label: "Inventar anlegen, bearbeiten, verleihen" },
      { cap: "inventory.manage", label: "Inventar ausmustern" },
      { cap: "link.create", label: "Links anlegen (eigene bearbeiten)" },
      { cap: "link.manage", label: "Alle Links bearbeiten und sortieren" },
    ],
  },
  {
    title: "Verwaltung",
    items: [
      { cap: "users.manage", label: "Nutzer verwalten", hint: "Vorsicht: erlaubt auch Rollenwechsel" },
      { cap: "settings.manage", label: "Einstellungen ändern" },
      { cap: "templates.manage", label: "Vorlagen bearbeiten" },
      { cap: "audit.read", label: "Audit-Log einsehen" },
    ],
  },
];

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
