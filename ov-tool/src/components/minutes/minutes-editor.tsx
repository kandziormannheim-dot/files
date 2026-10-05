"use client";

import type { AgendaItemStatus } from "@prisma/client";
import { FileCheck, ListPlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  approveLinkedMinutesAction,
  closeMeetingAction,
  deleteResolutionAction,
  openMeetingAction,
  quickTaskAction,
  saveFormalitiesAction,
  saveHeaderAction,
  saveSectionAction,
  saveSignersAction,
} from "@/app/(app)/meetings/[id]/minutes/actions";
import { setAgendaItemStatusAction } from "@/app/(app)/meetings/actions";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { QuorumState } from "@/server/services/minutes";
import { AttendanceCard, type AttendanceRow } from "./attendance-card";
import { AutoSaveForm } from "./autosave-form";
import { ResolutionDialog } from "./resolution-dialog";

export type EditorTop = {
  id: string;
  number: string;
  level: number;
  title: string;
  status: AgendaItemStatus;
  kind: string;
  approval: { minutesId: string; status: string; date: string } | null;
  pointsText: string;
  outcomeType: string;
  outcomeText: string;
  resolutions: { id: string; number: string; subject: string; label: string }[];
  tasks: { id: string; title: string; who: string; due: string }[];
};

export type EditorData = {
  meetingId: string;
  minutesId: string;
  header: {
    chairNote: string;
    recorderName: string;
    openedTime: string;
    closedTime: string;
    interruptionNote: string;
    extraAttendees: string;
  };
  formalities: { eroeffnung: string; wiedereroeffnung: string; tagesordnung: string; letztesProtokoll: string };
  signers: { name: string; funktion: string }[];
  attendance: AttendanceRow[];
  quorum: QuorumState;
  determined: { by: string; present: number; eligible: number; reached: boolean } | null;
  isRepeat: boolean;
  suspended: boolean;
  canManage: boolean;
  defaultLocation: string;
  tops: EditorTop[];
  users: { id: string; name: string }[];
  uncertainties: string[];
};

export function MinutesEditor({ d }: { d: EditorData }) {
  return (
    <div className="flex flex-col gap-6">
      {d.uncertainties.length ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle>Prüfhinweise aus dem KI-Entwurf</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm">
              {d.uncertainties.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <HeaderCard d={d} />
      <AttendanceCard
        meetingId={d.meetingId}
        minutesId={d.minutesId}
        rows={d.attendance}
        initialQuorum={d.quorum}
        determined={d.determined}
        isRepeat={d.isRepeat}
        suspended={d.suspended}
        canManage={d.canManage}
        defaultLocation={d.defaultLocation}
      />
      <Card>
        <CardHeader>
          <CardTitle>Formalia</CardTitle>
        </CardHeader>
        <CardContent>
          <AutoSaveForm action={saveFormalitiesAction.bind(null, d.minutesId)} className="grid gap-3 md:grid-cols-2">
            <Field label="Eröffnung" name="eroeffnung" hint="z. B. „19:05 Uhr durch Max Muster.“">
              <Textarea id="eroeffnung" name="eroeffnung" rows={2} defaultValue={d.formalities.eroeffnung} />
            </Field>
            <Field label="Wiedereröffnung (optional)" name="wiedereroeffnung">
              <Textarea id="wiedereroeffnung" name="wiedereroeffnung" rows={2} defaultValue={d.formalities.wiedereroeffnung} />
            </Field>
            <Field label="Tagesordnung" name="tagesordnung" hint="Abgesetzte und vertagte TOPs werden automatisch ergänzt.">
              <Textarea id="tagesordnung" name="tagesordnung" rows={2} defaultValue={d.formalities.tagesordnung} />
            </Field>
            <Field label="Protokoll der letzten Sitzung" name="letztesProtokoll">
              <Textarea id="letztesProtokoll" name="letztesProtokoll" rows={2} defaultValue={d.formalities.letztesProtokoll} />
            </Field>
          </AutoSaveForm>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Verlauf der Sitzung</h2>
        <p className="text-sm text-neutral-600">
          Eine Zeile je Stichpunkt, eingerückte Zeilen (zwei Leerzeichen) sind Unterpunkte. Wird automatisch gespeichert.
        </p>
        {d.tops.map((t) => (
          <TopCard key={t.id} d={d} t={t} />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Unterzeichner</CardTitle>
        </CardHeader>
        <CardContent>
          <AutoSaveForm action={saveSignersAction.bind(null, d.minutesId)} className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border p-3">
                <Input name="signerName[]" defaultValue={d.signers[i]?.name} placeholder="Name" aria-label={`Unterzeichner ${i + 1} Name`} />
                <Input
                  name="signerFunction[]"
                  defaultValue={d.signers[i]?.funktion}
                  placeholder="Funktion"
                  aria-label={`Unterzeichner ${i + 1} Funktion`}
                />
              </div>
            ))}
          </AutoSaveForm>
        </CardContent>
      </Card>
    </div>
  );
}

function HeaderCard({ d }: { d: EditorData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kopf</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <ActionForm action={openMeetingAction.bind(null, d.meetingId, d.minutesId)} showErrorInline={false}>
            <SubmitButton size="sm" variant={d.header.openedTime ? "outline" : "default"}>
              Sitzung jetzt eröffnen
            </SubmitButton>
          </ActionForm>
          <ActionForm action={closeMeetingAction.bind(null, d.meetingId, d.minutesId)} showErrorInline={false}>
            <SubmitButton size="sm" variant="outline">
              Sitzung jetzt schließen
            </SubmitButton>
          </ActionForm>
        </div>
        <AutoSaveForm action={saveHeaderAction.bind(null, d.minutesId)} className="grid gap-3 sm:grid-cols-2">
          <Field label="Beginn (Uhrzeit)" name="openedTime">
            <Input id="openedTime" name="openedTime" type="time" defaultValue={d.header.openedTime} />
          </Field>
          <Field label="Ende (Uhrzeit)" name="closedTime">
            <Input id="closedTime" name="closedTime" type="time" defaultValue={d.header.closedTime} />
          </Field>
          <Field label="Sitzungsleitung" name="chairNote">
            <Input id="chairNote" name="chairNote" defaultValue={d.header.chairNote} />
          </Field>
          <Field label="Protokollführung" name="recorderName">
            <Input id="recorderName" name="recorderName" defaultValue={d.header.recorderName} />
          </Field>
          <Field label="Unterbrechung (optional)" name="interruptionNote" hint="z. B. „Wiedereröffnung 18:15 Uhr“">
            <Input id="interruptionNote" name="interruptionNote" defaultValue={d.header.interruptionNote} />
          </Field>
          <Field label="Weitere Anwesende ohne Konto" name="extraAttendees" hint="eine Person je Zeile: „Name, Funktion“">
            <Textarea id="extraAttendees" name="extraAttendees" rows={2} defaultValue={d.header.extraAttendees} />
          </Field>
        </AutoSaveForm>
      </CardContent>
    </Card>
  );
}

function TopCard({ d, t }: { d: EditorData; t: EditorTop }) {
  const [, startTransition] = useTransition();
  const setStatus = (status: string) =>
    startTransition(async () => {
      const res = await setAgendaItemStatusAction(d.meetingId, t.id, status as AgendaItemStatus);
      if (res && !res.ok) toast.error(res.error);
    });
  const removeResolution = (id: string) =>
    startTransition(async () => {
      if (!window.confirm("Beschluss/Ergebnis löschen?")) return;
      const res = await deleteResolutionAction(d.meetingId, id);
      if (res?.ok) toast.success(res.message);
      else if (res) toast.error(res.error);
    });

  return (
    <Card className={t.level ? "ml-4 md:ml-8" : ""}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <CardTitle>
          TOP {t.number} · {t.title}
        </CardTitle>
        <NativeSelect className="h-8 w-36 text-xs" defaultValue={t.status} onChange={(e) => setStatus(e.target.value)} aria-label="Status des TOPs">
          <option value="OFFEN">offen</option>
          <option value="BEHANDELT">behandelt</option>
          <option value="ABGESETZT">abgesetzt</option>
          <option value="VERTAGT">vertagt</option>
        </NativeSelect>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {t.approval ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-akzent-hell/50 px-3 py-2 text-sm">
            Protokoll vom {t.approval.date}: <Badge variant={t.approval.status === "GENEHMIGT" ? "success" : "secondary"}>{t.approval.status.toLowerCase()}</Badge>
            {t.approval.status === "VERSENDET" ? (
              <ActionForm action={approveLinkedMinutesAction.bind(null, d.meetingId, d.minutesId, t.id)} showErrorInline={false}>
                <SubmitButton size="sm" variant="outline">
                  Als genehmigt markieren
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        ) : null}
        <AutoSaveForm action={saveSectionAction.bind(null, d.minutesId, t.id)} className="flex flex-col gap-2">
          <Textarea
            name="points"
            rows={Math.max(3, t.pointsText.split("\n").length + 1)}
            defaultValue={t.pointsText}
            placeholder={"Stichpunkt\n  Unterpunkt"}
            aria-label={`Stichpunkte TOP ${t.number}`}
          />
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <NativeSelect name="outcomeType" defaultValue={t.outcomeType} aria-label="Art der Ergebniszeile">
              <option value="">keine Ergebniszeile</option>
              <option value="BESCHLUSS">Beschluss:</option>
              <option value="ERGEBNIS">Ergebnis:</option>
            </NativeSelect>
            <Input name="outcomeText" defaultValue={t.outcomeText} placeholder="Text der Ergebniszeile (fett im Protokoll)" aria-label="Ergebniszeile" />
          </div>
        </AutoSaveForm>

        {t.resolutions.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {t.resolutions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1">
                <span>
                  <strong>{r.number}</strong> {r.subject} – {r.label}
                </span>
                <span className="flex gap-1">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/resolutions/${r.id}`}>
                      <FileCheck /> PDF / Antrag
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/tasks/new?meetingId=${d.meetingId}&agendaItemId=${t.id}&resolutionId=${r.id}&titel=${encodeURIComponent(r.subject)}`}>
                      <ListPlus /> Aufgabe
                    </Link>
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Löschen" onClick={() => removeResolution(r.id)}>
                    <Trash2 />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {t.tasks.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {t.tasks.map((task) => (
              <li key={task.id}>
                <Link href={`/tasks/${task.id}`} className="text-akzent-dunkel hover:underline">
                  Aufgabe: {task.title}
                </Link>{" "}
                <span className="text-neutral-600">
                  – {task.who || "offen"} – {task.due || "ohne Frist"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ResolutionDialog meetingId={d.meetingId} minutesId={d.minutesId} itemId={t.id} topLabel={`TOP ${t.number}`} />
        </div>
        <ActionForm action={quickTaskAction.bind(null, d.meetingId)} resetOnSuccess showErrorInline={false} className="grid gap-2 sm:grid-cols-[1fr_11rem_9rem_auto]">
          <input type="hidden" name="meetingId" value={d.meetingId} />
          <input type="hidden" name="agendaItemId" value={t.id} />
          <Input name="title" placeholder="Neue Aufgabe …" aria-label="Neue Aufgabe" required />
          <NativeSelect name="assigneeIds[]" defaultValue="" aria-label="Verantwortlich">
            <option value="">verantwortlich …</option>
            {d.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
          <Input name="dueDate" type="date" aria-label="Frist" />
          <SubmitButton size="default" variant="secondary" pendingText="…">
            Aufgabe
          </SubmitButton>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
