import {
  BookOpen,
  Receipt,
  FileCheck,
  Boxes,
  Globe,
  Mic,
  Vote,
  CalendarDays,
  House,
  Link2,
  ListChecks,
  Megaphone,
  MapPin,
  Newspaper,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** auf dem Handy nicht in der unteren Leiste, sondern unter „Mehr“ */
  secondary?: boolean;
};

// Hauptnavigation laut SPEC.md Abschnitt 8. Pfade englisch, Beschriftung deutsch.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Übersicht", icon: House },
  { href: "/meetings", label: "Sitzungen", icon: CalendarDays },
  { href: "/tasks", label: "Aufgaben", icon: ListChecks },
  { href: "/actions", label: "Aktionen", icon: Megaphone },
  { href: "/topics", label: "Themen", icon: MapPin, secondary: true },
  { href: "/marketing", label: "Marketing", icon: Newspaper },
  { href: "/expenses", label: "Auslagen", icon: Receipt, secondary: true },
  { href: "/resolutions", label: "Beschlüsse", icon: FileCheck, secondary: true },
  { href: "/press", label: "Presse", icon: Mic, secondary: true },
  { href: "/landing", label: "Landing Pages", icon: Globe, secondary: true },
  { href: "/elections", label: "Wahlen & Abstimmungen", icon: Vote, secondary: true },
  { href: "/satzung", label: "Satzung", icon: BookOpen, secondary: true },
  { href: "/inventory", label: "Inventar", icon: Boxes, secondary: true },
  { href: "/board", label: "Vorstand", icon: Users, secondary: true },
  { href: "/links", label: "Links", icon: Link2, secondary: true },
  { href: "/settings", label: "Einstellungen", icon: Settings, adminOnly: true },
];

/** Externer Bereich nur für die CDU-Bezirksbeiräte (eigene Anmeldung über cloud.cdu-sf.de). */
export const BBR_ANLIEGEN_URL = "https://bbr-anliegen.cdu-sf.de/";

export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
