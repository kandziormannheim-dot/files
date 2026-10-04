import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { visibleNavItems } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Mehr" };

/** Übersicht aller Bereiche für die Handy-Navigation. */
export default async function MorePage() {
  const user = await requireUser();
  const items = [...visibleNavItems(user.role === "ADMIN"), { href: "/profile", label: "Mein Profil", icon: UserRound }];
  return (
    <>
      <PageHeader title="Alle Bereiche" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 rounded-lg border bg-white p-4 text-sm font-medium hover:border-akzent">
              <Icon className="size-5 text-akzent-dunkel" aria-hidden /> {label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
