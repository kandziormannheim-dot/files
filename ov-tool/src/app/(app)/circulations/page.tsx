import type { Metadata } from "next";
import Link from "next/link";
import { CirculationBadge } from "@/components/circulation-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { listCirculations, tally } from "@/server/services/circulations";

export const metadata: Metadata = { title: "Umlaufbeschlüsse" };

export default async function CirculationsPage() {
  const user = await requireUser();
  const list = await listCirculations(user);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Umlaufbeschlüsse"
          description="Beschlüsse zwischen Sitzungen (Statut § 42 Abs. 3). Mehrheit aller Stimmberechtigten nötig; unzulässig bei Widerspruch von mehr als einem Viertel."
        />
        {can(user.role, "circulation.manage") ? (
          <Button asChild>
            <Link href="/circulations/new">Umlaufverfahren einleiten</Link>
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {list.map((c) => {
          const t = tally(c, c.votes);
          return (
            <li key={c.id}>
              <Link href={`/circulations/${c.id}`} className="block rounded-lg border bg-white p-3 hover:border-akzent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {c.number} · {c.subject}
                  </span>
                  <CirculationBadge status={c.status} />
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  Frist {formatDate(c.deadline)} · {t.yes + t.no + t.abstain + t.objections} von {t.eligible} Stimmen abgegeben
                </div>
              </Link>
            </li>
          );
        })}
        {list.length === 0 ? <li className="text-sm text-neutral-600">Noch keine Umlaufverfahren.</li> : null}
      </ul>
    </>
  );
}
