import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { isPublic, listReleases } from "@/server/services/press";
import { db } from "@/server/db";
import { PressTabs } from "./press-tabs";
import { PRESS_STATUS } from "./status";

export const metadata: Metadata = { title: "Presse" };

export default async function PressPage() {
  const user = await requireUser();
  const releases = await listReleases(user);
  const waiting = can(user.role, "press.contacts") ? await db.pressContact.count({ where: { status: "WARTET" } }) : 0;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Presse" description="Pressemitteilungen mit Freigabe, Presseverteiler und Pressespiegel." />
        {can(user.role, "press.create") ? (
          <Button asChild>
            <Link href="/press/new">
              <Plus className="size-4" /> Neue Pressemitteilung
            </Link>
          </Button>
        ) : null}
      </div>
      <PressTabs active="pm" showContacts={can(user.role, "press.contacts")} />
      {waiting ? (
        <p className="mb-4 text-sm">
          <Link href="/press/contacts" className="font-semibold underline">
            {waiting} Registrierung{waiting === 1 ? "" : "en"} warten auf Freigabe
          </Link>
        </p>
      ) : null}
      {releases.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Pressemitteilungen.</p> : null}
      <ul className="flex flex-col gap-2">
        {releases.map((r) => {
          const st = PRESS_STATUS[r.status];
          return (
            <li key={r.id}>
              <Link href={`/press/${r.id}`} className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:border-cadenabbia">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-rhoendorf">{r.title}</div>
                  <div className="text-xs text-neutral-600">
                    {r.publishedAt ? `veröffentlicht ${formatDate(r.publishedAt)}` : `geändert ${formatDateTime(r.updatedAt)}`}
                    {r.sentAt ? ` · an ${r.sentCount} versendet` : ""}
                    {r.embargoUntil && !isPublic(r) && r.status === "VEROEFFENTLICHT" ? ` · Sperrfrist bis ${formatDateTime(r.embargoUntil)}` : ""}
                  </div>
                </div>
                <Badge variant={st.variant}>{st.label}</Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
