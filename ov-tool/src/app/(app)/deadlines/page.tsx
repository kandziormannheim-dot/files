import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { deadlineRadar, listDeadlines } from "@/server/services/deadlines";
import { createDeadlineAction, deleteDeadlineAction } from "./actions";

export const metadata: Metadata = { title: "Fristenradar" };

export default async function DeadlinesPage() {
  const user = await requireUser();
  const [radar, external] = await Promise.all([deadlineRadar(user), listDeadlines(user)]);
  const manage = can(user.role, "deadline.manage");
  return (
    <>
      <PageHeader title="Fristenradar" description="Fristen aus Sitzungen, Umlaufverfahren, Aufgaben, Wahlen, Presse und externe Fristen – nächste 60 Tage." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2">
          {radar.length === 0 ? <li className="text-sm text-neutral-600">Keine Fristen.</li> : null}
          {radar.map((r, i) => (
            <li key={`${r.href}-${i}`}>
              <Link href={r.href} className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 text-sm hover:border-cadenabbia">
                <span className="w-24 shrink-0 font-bold text-rhoendorf">{formatDate(r.date)}</span>
                <span className="min-w-0 flex-1">{r.title}</span>
                <Badge variant={r.level === "destructive" ? "destructive" : r.level === "warning" ? "warning" : "secondary"}>
                  {r.daysLeft < 0 ? "überschritten" : r.daysLeft === 0 ? "heute" : `in ${r.daysLeft} Tagen`}
                </Badge>
                <span className="text-xs text-neutral-500">{r.source}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Externe Fristen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {external.map((d) => (
              <div key={d.id} className="flex items-start gap-2 border-b pb-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-neutral-600">
                    {formatDateTime(d.dueAt)} · Vorwarnung {d.warnDays} Tage{d.note ? ` · ${d.note}` : ""}
                  </div>
                </div>
                {manage ? (
                  <ActionForm action={deleteDeadlineAction.bind(null, d.id)} showErrorInline={false}>
                    <SubmitButton size="sm" variant="ghost" pendingText="…" aria-label="Löschen">
                      <Trash2 className="size-4" />
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            ))}
            {manage ? (
              <ActionForm action={createDeadlineAction} resetOnSuccess className="flex flex-col gap-3">
                <Field label="Frist" name="title">
                  <Input id="title" name="title" required placeholder="z. B. Antragsschluss Kreisparteitag" />
                </Field>
                <Field label="Fällig am" name="dueAt">
                  <Input id="dueAt" name="dueAt" type="datetime-local" required />
                </Field>
                <Field label="Vorwarnung (Tage)" name="warnDays">
                  <Input id="warnDays" name="warnDays" type="number" min={0} max={365} defaultValue={14} />
                </Field>
                <Field label="Notiz" name="note">
                  <Input id="note" name="note" />
                </Field>
                <SubmitButton className="self-start">Eintragen</SubmitButton>
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
