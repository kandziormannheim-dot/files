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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/dates";
import { DISTRICT_LABELS, TOPIC_EVENT_LABELS, TOPIC_STATUS_LABELS } from "@/lib/labels";
import { meetingTitle } from "@/lib/meetings";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { listAttachments } from "@/server/services/attachments";
import { listTasks } from "@/server/services/tasks";
import { canEditTopic, getTopic, readContact } from "@/server/services/topics";
import { addEventAction, forNextMeetingAction } from "../actions";

export const metadata: Metadata = { title: "Thema" };

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [topic, attachments, tasks] = await Promise.all([
    getTopic(user, id),
    listAttachments("Topic", id),
    listTasks(user, { view: "all" }).then((t) => t.filter((x) => x.topicId === id)),
  ]);
  const editable = canEditTopic(user, topic);
  const contact = readContact(user, topic);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={topic.title} description={`${topic.category} · ${DISTRICT_LABELS[topic.district]}`} />
        <div className="flex gap-1">
          {topic.isCitizenConcern ? <Badge variant="outline">Bürgeranliegen</Badge> : null}
          <Badge variant={topic.status === "ERLEDIGT" ? "success" : "secondary"}>{TOPIC_STATUS_LABELS[topic.status]}</Badge>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {editable ? (
          <Button asChild variant="outline">
            <Link href={`/topics/${id}/edit`}>Bearbeiten</Link>
          </Button>
        ) : null}
        {can(user.role, "topic.create") ? (
          <ActionForm action={forNextMeetingAction.bind(null, id, !topic.forNextMeeting)} showErrorInline={false}>
            <SubmitButton variant={topic.forNextMeeting ? "secondary" : "outline"}>
              {topic.forNextMeeting ? "✓ für nächste Sitzung vorgemerkt" : "Für nächste Sitzung vormerken"}
            </SubmitButton>
          </ActionForm>
        ) : null}
        {can(user.role, "task.create") ? (
          <Button asChild variant="outline">
            <Link href={`/tasks/new?topicId=${id}`}>Aufgabe anlegen</Link>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {topic.description ? <p className="whitespace-pre-wrap">{topic.description}</p> : null}
          <section>
            <h2 className="mb-2 font-semibold">Verlauf</h2>
            {can(user.role, "topic.create") ? (
              <ActionForm action={addEventAction.bind(null, id)} resetOnSuccess className="mb-4 grid gap-2 rounded-md border p-3 sm:grid-cols-[12rem_10rem_1fr]">
                <NativeSelect name="type" defaultValue="NOTIZ" aria-label="Art des Eintrags">
                  {Object.entries(TOPIC_EVENT_LABELS)
                    .filter(([k]) => k !== "STATUS")
                    .map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                </NativeSelect>
                <Input name="date" type="date" aria-label="Datum (leer = heute)" />
                <div className="sm:col-span-3">
                  <Field label="Eintrag" name="text">
                    <Textarea id="text" name="text" rows={2} required />
                  </Field>
                </div>
                <SubmitButton size="sm" variant="secondary" className="self-start">
                  Eintrag speichern
                </SubmitButton>
              </ActionForm>
            ) : null}
            <ol className="relative ml-2 border-l-2 border-akzent-hell">
              {topic.events.map((e) => (
                <li key={e.id} className="mb-4 ml-4">
                  <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full bg-akzent" aria-hidden />
                  <div className="text-xs text-neutral-500">
                    {formatDate(e.date)} · {TOPIC_EVENT_LABELS[e.type]}
                    {e.author ? ` · ${e.author.name}` : ""}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{e.text}</p>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Aufgaben</h2>
            <TaskList tasks={tasks} empty="Keine Aufgaben zu diesem Thema." />
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <div>Verantwortlich: {topic.responsible?.name ?? "–"}</div>
              <div>Angelegt: {formatDate(topic.createdAt)}{topic.createdBy ? ` von ${topic.createdBy.name}` : ""}</div>
              {topic.agendaItems.length ? (
                <div className="mt-2">
                  In Sitzungen:
                  <ul className="ml-4 list-disc">
                    {topic.agendaItems.map((a) => (
                      <li key={a.id}>
                        <Link href={`/meetings/${a.meeting.id}`} className="text-akzent-dunkel underline">
                          {meetingTitle(a.meeting)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
          {topic.isCitizenConcern && can(user.role, "topic.create") ? (
            <Card>
              <CardHeader>
                <CardTitle>Kontakt (vertraulich)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {contact ? <p className="whitespace-pre-wrap">{contact}</p> : <p className="text-neutral-600">Keine Kontaktdaten gespeichert.</p>}
                {topic.contactDeleteAfter && contact ? (
                  <p className="mt-2 text-xs text-neutral-600">Wird am {formatDate(topic.contactDeleteAfter)} automatisch gelöscht.</p>
                ) : null}
                {topic.contactDeletedAt ? <p className="mt-2 text-xs text-neutral-600">Kontaktdaten gelöscht am {formatDate(topic.contactDeletedAt)}.</p> : null}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Anhänge</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentList
                ownerType="Topic"
                ownerId={id}
                path={`/topics/${id}`}
                items={attachments}
                canUpload={can(user.role, "topic.create")}
                canDelete={(a) => a.uploadedById === user.id || can(user.role, "topic.editAll")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
