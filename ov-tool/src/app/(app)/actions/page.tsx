import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateLong, formatTime } from "@/lib/dates";
import { ACTION_STATUS_LABELS, ACTION_TYPE_LABELS } from "@/lib/labels";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { listActions, openSlots } from "@/server/services/actions";

export const metadata: Metadata = { title: "Aktionen" };

export default async function ActionsPage() {
  const user = await requireUser();
  const { upcoming, past } = await listActions(user);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Aktionen" description="Infostände, Plakataktionen, Veranstaltungen – mit Helferschichten." />
        {can(user.role, "action.create") ? (
          <Button asChild>
            <Link href="/actions/new">Aktion anlegen</Link>
          </Button>
        ) : null}
      </div>
      <section className="mb-8">
        <h2 className="mb-2 font-semibold">Anstehend</h2>
        <ul className="flex flex-col gap-2">
          {upcoming.map((a) => {
            const open = openSlots(a);
            const mine = a.shifts.some((s) => s.signups.some((x) => x.userId === user.id));
            return (
              <li key={a.id}>
                <Link href={`/actions/${a.id}`} className="block rounded-lg border bg-white p-3 hover:border-akzent">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className="flex gap-1">
                      {mine ? <Badge variant="success">Sie helfen mit</Badge> : null}
                      {open ? <Badge variant="warning">{open} Helfer gesucht</Badge> : null}
                      <Badge variant="secondary">{ACTION_STATUS_LABELS[a.status]}</Badge>
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    {ACTION_TYPE_LABELS[a.type]} · {formatDateLong(a.startsAt)}, {formatTime(a.startsAt)} Uhr{a.location ? ` · ${a.location}` : ""}
                  </div>
                </Link>
              </li>
            );
          })}
          {upcoming.length === 0 ? <li className="text-sm text-neutral-600">Keine anstehenden Aktionen.</li> : null}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Vergangen</h2>
        <ul className="flex flex-col divide-y rounded-lg border bg-white">
          {past.map((a) => (
            <li key={a.id}>
              <Link href={`/actions/${a.id}`} className="flex flex-wrap justify-between gap-2 p-3 hover:bg-neutral-50">
                <span>
                  {formatDate(a.startsAt)} · {a.title}
                </span>
                <Badge variant="secondary">{ACTION_STATUS_LABELS[a.status]}</Badge>
              </Link>
            </li>
          ))}
          {past.length === 0 ? <li className="p-3 text-sm text-neutral-600">Noch keine.</li> : null}
        </ul>
      </section>
    </>
  );
}
