import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { isLive, LANDING_KIND_LABELS, listPages } from "@/server/services/landing";

export const metadata: Metadata = { title: "Landing Pages" };

export default async function LandingListPage() {
  const user = await requireUser();
  const pages = await listPages(user);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Landing Pages" description="Seiten für Aktionen, Veranstaltungen und Kampagnen unter management.cdu-sf.de/p/… – erst nach Freigabe online." />
        {can(user.role, "landing.edit") ? (
          <Button asChild>
            <Link href="/landing/new">
              <Plus className="size-4" /> Neue Seite
            </Link>
          </Button>
        ) : null}
      </div>
      {pages.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Seiten.</p> : null}
      <ul className="flex flex-col gap-2">
        {pages.map((p) => (
          <li key={p.id}>
            <Link href={`/landing/${p.id}`} className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:border-cadenabbia">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-rhoendorf">{p.title}</div>
                <div className="truncate text-xs text-neutral-600">
                  /p/{p.slug} · {LANDING_KIND_LABELS[p.kind]} · {p.views} Aufrufe · {p._count.submissions} Einträge
                </div>
              </div>
              {isLive(p) ? <Badge variant="success">online</Badge> : p.status === "FREIGEGEBEN" ? <Badge variant="secondary">abgelaufen</Badge> : p.status === "ARCHIVIERT" ? <Badge variant="outline">archiviert</Badge> : <Badge variant="warning">Entwurf</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
