import {
  CalendarDays,
  House,
  Link2,
  ListChecks,
  Megaphone,
  MapPin,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

// Hauptnavigation laut SPEC.md Abschnitt 8. Pfade englisch, Beschriftung deutsch.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Übersicht", icon: House },
  { href: "/meetings", label: "Sitzungen", icon: CalendarDays },
  { href: "/tasks", label: "Aufgaben", icon: ListChecks },
  { href: "/actions", label: "Aktionen", icon: Megaphone },
  { href: "/topics", label: "Themen", icon: MapPin },
  { href: "/links", label: "Links", icon: Link2 },
  { href: "/settings", label: "Einstellungen", icon: Settings, adminOnly: true },
];

export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
