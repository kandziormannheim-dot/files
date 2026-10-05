import type { Metadata } from "next";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { resultText } from "@/server/services/minutes";
import { listResolutions } from "@/server/services/resolutions";

export const metadata: Metadata = { title: "Beschlüsse" };

export default async function ResolutionsPage() {
  const user = await requireUser();
  const list = await listResolutions(user);
  return (
    <>
      <PageHeader title="Beschlüsse" description="Alle Beschlüsse aus Sitzungen und Umlaufverfahren – als PDF und als Antrag an den Kreisverband." />
      {list.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Beschlüsse erfasst. Beschlüsse entstehen im Protokoll (TOP → Beschluss) oder im Umlaufverfahren.</p> : null}
      <ul className="flex flex-col gap-2">
        {list.map((r) => {
          const sent = r.motions.find((m) => m.status === "EINGEREICHT");
          return (
            <li key={r.id} className="flex items-center gap-2 rounded-lg border bg-white p-3 hover:border-cadenabbia">
              <Link href={`/resolutions/${r.id}`} className="min-w-0 flex-1">
                <div className="truncate font-bold text-rhoendorf">
                  {r.number} · {r.subject}
                </div>
                <div className="text-xs text-neutral-600">
                  {formatDate(r.meeting?.startsAt ?? r.createdAt)} · {r.circulation ? `Umlauf ${r.circulation.number}` : "Sitzung"} · {resultText(r)}
                </div>
              </Link>
              {sent ? <Badge variant="success">Antrag eingereicht</Badge> : r.motions.length ? <Badge variant="warning">Antrag im Entwurf</Badge> : null}
              <a href={`/api/resolutions/${r.id}/pdf`} target="_blank" rel="noreferrer" className="rounded p-2 text-rhoendorf hover:bg-cadenabbia-10" aria-label="PDF">
                <FileDown className="size-4" />
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
