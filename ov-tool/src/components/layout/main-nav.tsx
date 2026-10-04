"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, visibleNavItems } from "./nav-items";

type Props = { isAdmin: boolean };

/** Seitenleiste ab Tablet-Breite. */
export function SideNav({ isAdmin }: Props) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-1">
      {visibleNavItems(isAdmin).map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
              active ? "bg-akzent-hell text-akzent-dunkel" : "text-neutral-700 hover:bg-neutral-100",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Leiste am unteren Rand auf dem Handy (mobile-first, 375 px ohne Querscrollen).
 * Einstellungen stehen dort im Nutzermenü, damit die Beschriftungen nicht abgeschnitten werden.
 */
export function BottomNav() {
  const pathname = usePathname();
  const items = visibleNavItems(false);
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] leading-tight",
                  active ? "text-akzent-dunkel" : "text-neutral-600",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="w-full truncate text-center">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
