"use client";

import Link from "next/link";
import { Ellipsis, ExternalLink, Landmark } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BBR_ANLIEGEN_URL, isActive, visibleNavItems } from "./nav-items";

type Props = { isAdmin: boolean; isBbr?: boolean };

/** Seitenleiste ab Tablet-Breite. */
export function SideNav({ isAdmin, isBbr = false }: Props) {
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
              "flex items-center gap-3 rounded-md border-l-4 px-3 py-2 text-sm",
              active
                ? "border-cadenabbia bg-cadenabbia-10 font-bold text-rhoendorf"
                : "border-transparent font-medium text-rhoendorf/80 hover:bg-cadenabbia-10 hover:text-rhoendorf",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
      {isBbr ? (
        <a
          href={BBR_ANLIEGEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-3 rounded-md border-l-4 border-transparent px-3 py-2 text-sm font-medium text-rhoendorf/80 hover:bg-cadenabbia-10 hover:text-rhoendorf"
        >
          <Landmark className="size-4 shrink-0" aria-hidden />
          BBR-Anliegen
          <ExternalLink className="ml-auto size-3.5 opacity-60" aria-hidden />
        </a>
      ) : null}
    </nav>
  );
}

/**
 * Leiste am unteren Rand auf dem Handy (mobile-first, 375 px ohne Querscrollen).
 * Einstellungen stehen dort im Nutzermenü, damit die Beschriftungen nicht abgeschnitten werden.
 */
export function BottomNav() {
  const pathname = usePathname();
  const items = [
    ...visibleNavItems(false).filter((i) => !i.secondary),
    { href: "/more", label: "Mehr", icon: Ellipsis },
  ];
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rhoendorf-10 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/more"
              ? pathname === "/more" || visibleNavItems(true).some((i) => i.secondary && isActive(pathname, i.href))
              : isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 border-t-2 px-1 py-2 text-[10px] leading-tight",
                  active ? "border-cadenabbia font-bold text-rhoendorf" : "border-transparent text-rhoendorf/70",
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
