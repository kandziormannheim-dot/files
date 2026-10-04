import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { TaskStatusBadge } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { canDeleteTask, canEditTask, getTask, taskSummary } from "@/server/services/tasks";
import { addCommentAction, deleteTaskAction, setTaskStatusAction } from "../actions";

export const metadata: Metadata = { title: "Aufgabe" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const task = await getTask(user, id);
  const s = taskSummary(task);
  const editable = canEditTask(user, task);
  const originHref = task.action
    ? `/actions/${task.action.id}`
    : task.topic
      ? `/topics/${task.topic.id}`
      : task.meeting
        ? `/meetings/${task.meeting.id}`
        : null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={task.title} />
        <TaskStatusBadge task={task} />
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {task.description ? <p className="whitespace-pre-wrap">{task.description}</p> : null}
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
            <dt className="text-neutral-600">Verantwortlich</dt>
            <dd>{s.assignees || "–"}</dd>
            <dt className="text-neutral-600">Frist</dt>
            <dd>{s.due || "–"}</dd>
            <dt className="text-neutral-600">Herkunft</dt>
            <dd>
              {s.origin ? (
                originHref ? (
                  <Link className="text-akzent-dunkel underline" href={originHref}>
                    {s.origin}
                  </Link>
                ) : (
                  s.origin
                )
              ) : (
                "–"
              )}
            </dd>
            <dt className="text-neutral-600">Angelegt</dt>
            <dd>
              {formatDateTime(task.createdAt)}
              {task.createdBy ? ` von ${task.createdBy.name}` : ""}
            </dd>
          </dl>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              {task.status !== "IN_ARBEIT" && task.status !== "ERLEDIGT" ? (
                <ActionForm action={setTaskStatusAction.bind(null, id, "IN_ARBEIT")} showErrorInline={false}>
                  <SubmitButton variant="outline">In Arbeit</SubmitButton>
                </ActionForm>
              ) : null}
              {task.status !== "ERLEDIGT" ? (
                <ActionForm action={setTaskStatusAction.bind(null, id, "ERLEDIGT")} showErrorInline={false}>
                  <SubmitButton>Erledigt</SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={setTaskStatusAction.bind(null, id, "OFFEN")} showErrorInline={false}>
                  <SubmitButton variant="outline">Wieder öffnen</SubmitButton>
                </ActionForm>
              )}
              <Button asChild variant="ghost">
                <Link href={`/tasks/${id}/edit`}>Bearbeiten</Link>
              </Button>
            </div>
          ) : null}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Kommentare</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {task.comments.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Kommentare.</p> : null}
            {task.comments.map((c) => (
              <div key={c.id} className="text-sm">
                <div className="text-xs text-neutral-500">
                  {c.author?.name ?? "–"} · {formatDateTime(c.createdAt)}
                </div>
                <p className="whitespace-pre-wrap">{c.text}</p>
              </div>
            ))}
            {can(user.role, "task.create") ? (
              <ActionForm action={addCommentAction.bind(null, id)} resetOnSuccess className="flex flex-col gap-2">
                <Field label="Neuer Kommentar" name="text">
                  <Textarea id="text" name="text" rows={2} required />
                </Field>
                <SubmitButton variant="outline" className="self-start">
                  Kommentieren
                </SubmitButton>
              </ActionForm>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {canDeleteTask(user, task) ? (
        <ActionForm action={deleteTaskAction.bind(null, id)} className="mt-8 border-t pt-6">
          <ConfirmSubmit variant="destructive" confirm="Aufgabe wirklich löschen?" pendingText="Wird gelöscht …">
            Aufgabe löschen
          </ConfirmSubmit>
        </ActionForm>
      ) : null}
    </>
  );
}
