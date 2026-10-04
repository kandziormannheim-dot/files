import type { Metadata } from "next";
import Link from "next/link";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateLong, formatDateTime, formatTime } from "@/lib/dates";
import { ACTION_STATUS_LABELS, ACTION_TYPE_LABELS } from "@/lib/labels";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { canEditAction, getAction } from "@/server/services/actions";
import { listAttachments } from "@/server/services/attachments";
import { listTasks } from "@/server/services/tasks";
import { addShiftAction, deleteShiftAction, followUpAction, helpCallAction, toggleSignupAction } from "../actions";

export const metadata: Metadata = { title: "Aktion" };

export default async function ActionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [action, attachments, tasks] = await Promise.all([
    getAction(user, id),
    listAttachments("Action", id),
    listTasks(user, { view: "all" }).then((t) => t.filter((x) => x.actionId === id)),
  ]);
  const editable = canEditAction(user, action);
  const signupOpen = action.status === "GEPLANT" || action.status === "BESTAETIGT";
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={action.title}
          description={`${ACTION_TYPE_LABELS[action.type]} · ${formatDateLong(action.startsAt)}, ${formatTime(action.startsAt)}${action.endsAt ? `–${formatTime(action.endsAt)}` : ""} Uhr`}
        />
        <Badge variant="secondary">{ACTION_STATUS_LABELS[action.status]}</Badge>
      </div>
      <div className="mb-6 flex flex-col gap-1 text-sm">
        {action.location ? <div>Ort: {action.location}</div> : null}
        {action.partners ? <div>Partner: {action.partners}</div> : null}
        {action.description ? <p className="mt-2 whitespace-pre-wrap">{action.description}</p> : null}
      </div>
      {editable ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/actions/${id}/edit`}>Bearbeiten</Link>
          </Button>
          <ActionForm action={helpCallAction.bind(null, id)} showErrorInline={false}>
            <SubmitButton variant={action.helpCallSentAt ? "outline" : "default"} pendingText="Wird versendet …">
              {action.helpCallSentAt ? "Helferaufruf erneut senden" : "Helferaufruf senden"}
            </SubmitButton>
          </ActionForm>
          {action.helpCallSentAt ? <span className="self-center text-xs text-neutral-600">zuletzt {formatDateTime(action.helpCallSentAt)}</span> : null}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Helferschichten</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {action.shifts.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Schichten.</p> : null}
              {action.shifts.map((s) => {
                const mine = s.signups.some((x) => x.userId === user.id);
                const full = s.signups.length >= s.needed;
                return (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">
                        {formatTime(s.startsAt)}–{formatTime(s.endsAt)} Uhr · {s.signups.length}/{s.needed}
                      </div>
                      <div className="text-xs text-neutral-600">
                        {s.signups.map((x) => x.user.name).join(", ") || "noch niemand"}
                        {s.note ? ` · ${s.note}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {can(user.role, "shift.signup") && signupOpen && (mine || !full) ? (
                        <ActionForm action={toggleSignupAction.bind(null, id, s.id)} showErrorInline={false}>
                          <SubmitButton size="sm" variant={mine ? "secondary" : "default"} pendingText="…">
                            {mine ? "Austragen" : "Eintragen"}
                          </SubmitButton>
                        </ActionForm>
                      ) : full && !mine ? (
                        <Badge variant="success">voll</Badge>
                      ) : null}
                      {editable ? (
                        <ActionForm action={deleteShiftAction.bind(null, id, s.id)} showErrorInline={false}>
                          <SubmitButton size="sm" variant="ghost">
                            Löschen
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {editable ? (
                <ActionForm action={addShiftAction.bind(null, id)} resetOnSuccess className="grid grid-cols-2 gap-2 sm:grid-cols-[7rem_7rem_6rem_1fr_auto]">
                  <Input name="start" type="time" required aria-label="Beginn" />
                  <Input name="end" type="time" required aria-label="Ende" />
                  <Input name="needed" type="number" min={1} defaultValue={2} required aria-label="Benötigte Personen" />
                  <Input name="note" placeholder="Hinweis (optional)" aria-label="Hinweis" />
                  <SubmitButton variant="secondary" pendingText="…">
                    Schicht
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Aufgaben</h2>
              {can(user.role, "task.create") ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/tasks/new?actionId=${id}`}>Aufgabe anlegen</Link>
                </Button>
              ) : null}
            </div>
            <TaskList tasks={tasks} empty="Material, Genehmigung, Presse … noch keine Aufgaben." />
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Nachbereitung</CardTitle>
            </CardHeader>
            <CardContent>
              {editable ? (
                <ActionForm action={followUpAction.bind(null, id)} className="flex flex-col gap-2">
                  <Field label="Notiz" name="followUpNote">
                    <Textarea id="followUpNote" name="followUpNote" defaultValue={action.followUpNote} rows={4} />
                  </Field>
                  <SubmitButton size="sm" variant="outline" className="self-start">
                    Speichern
                  </SubmitButton>
                </ActionForm>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{action.followUpNote || "–"}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fotos und Dokumente</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentList
                ownerType="Action"
                ownerId={id}
                path={`/actions/${id}`}
                items={attachments}
                canUpload={can(user.role, "action.create")}
                canDelete={(a) => a.uploadedById === user.id || can(user.role, "action.editAll")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
