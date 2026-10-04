import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/dates";
import { meetingTitle } from "@/lib/meetings";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listProposals } from "@/server/services/proposals";
import { CONVENE_REQUEST_SUPPORTERS } from "@/server/services/statute";
import { createProposalAction, rejectProposalAction, toggleSupportAction } from "../actions";

export const metadata: Metadata = { title: "TO-Vorschläge" };

const STATUS: Record<string, string> = { OFFEN: "offen", UEBERNOMMEN: "übernommen", VERWORFEN: "verworfen" };

export default async function ProposalsPage() {
  const user = await requireUser();
  const [proposals, upcoming] = await Promise.all([
    listProposals(user),
    db.meeting.findMany({ where: { status: { in: ["GEPLANT", "EINGELADEN"] }, startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } }),
  ]);
  return (
    <>
      <PageHeader
        title="TO-Vorschläge"
        description="Themen für die nächste Sitzung vorschlagen. Der Admin übernimmt sie in die Tagesordnung oder verwirft sie."
      />
      {can(user.role, "agenda.propose") ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Neuer Vorschlag</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createProposalAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
              <Field label="Thema" name="title" className="sm:col-span-2">
                <Input id="title" name="title" required />
              </Field>
              <Field label="Erläuterung" name="description" className="sm:col-span-2">
                <Textarea id="description" name="description" rows={2} />
              </Field>
              <Field label="Für Sitzung" name="meetingId">
                <NativeSelect id="meetingId" name="meetingId" defaultValue="">
                  <option value="">nächste Sitzung</option>
                  {upcoming.map((m) => (
                    <option key={m.id} value={m.id}>
                      {meetingTitle(m)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Checkbox name="isConveneRequest" /> Antrag auf Einberufung einer Sitzung
              </label>
              <SubmitButton className="self-start">Vorschlag einreichen</SubmitButton>
            </ActionForm>
            <p className="mt-3 text-xs text-neutral-600">
              Ein Antrag auf Einberufung braucht {CONVENE_REQUEST_SUPPORTERS} Mitglieder (Antragsteller plus Unterstützer, LV-Satzung § 31
              Abs. 3). Dann wird der Admin automatisch informiert.
            </p>
          </CardContent>
        </Card>
      ) : null}
      <ul className="flex flex-col gap-2">
        {proposals.map((p) => {
          const supporting = p.supporters.some((s) => s.userId === user.id);
          return (
            <li key={p.id} className="rounded-lg border bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-neutral-600">
                    {p.proposedBy?.name ?? "–"} · {formatDate(p.createdAt)}
                    {p.meeting ? ` · für ${meetingTitle(p.meeting)}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  {p.isConveneRequest ? <Badge variant="warning">Antrag auf Einberufung</Badge> : null}
                  <Badge variant={p.status === "OFFEN" ? "secondary" : p.status === "UEBERNOMMEN" ? "success" : "outline"}>
                    {STATUS[p.status]}
                  </Badge>
                </div>
              </div>
              {p.description ? <p className="mt-1 text-sm whitespace-pre-wrap">{p.description}</p> : null}
              {p.decisionNote ? <p className="mt-1 text-sm text-neutral-600">Begründung: {p.decisionNote}</p> : null}
              {p.isConveneRequest ? (
                <p className="mt-1 text-sm">
                  Getragen von {p.supporters.length + 1} von {CONVENE_REQUEST_SUPPORTERS} erforderlichen Mitgliedern
                  {p.supporters.length ? `: ${[p.proposedBy?.name, ...p.supporters.map((s) => s.user.name)].filter(Boolean).join(", ")}` : ""}
                </p>
              ) : null}
              {p.status === "OFFEN" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.isConveneRequest && p.proposedById !== user.id && can(user.role, "agenda.propose") ? (
                    <ActionForm action={toggleSupportAction.bind(null, p.id)} showErrorInline={false}>
                      <SubmitButton size="sm" variant={supporting ? "secondary" : "outline"}>
                        {supporting ? "Unterstützung zurückziehen" : "Unterstützen"}
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                  {can(user.role, "meeting.manage") ? (
                    <ActionForm action={rejectProposalAction.bind(null, p.id)} showErrorInline={false} className="flex gap-1">
                      <Input name="decisionNote" placeholder="Begründung (optional)" className="h-8 w-48" />
                      <SubmitButton size="sm" variant="ghost">
                        Verwerfen
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
        {proposals.length === 0 ? <li className="text-sm text-neutral-600">Noch keine Vorschläge.</li> : null}
      </ul>
    </>
  );
}
