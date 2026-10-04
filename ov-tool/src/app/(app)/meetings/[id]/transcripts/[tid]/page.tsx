import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { meetingTitle } from "@/lib/meetings";
import { requirePageCapability } from "@/server/auth/session";
import { RESULT_LABELS } from "@/server/services/minutes";
import { getTranscript, parseStoredDraft } from "@/server/services/transcripts";
import { listActiveUsers } from "@/server/services/users";
import { applyDraftAction } from "../actions";

export const metadata: Metadata = { title: "Entwurf prüfen" };

/** Bester Treffer für einen Namen aus dem Entwurf („Muster“, „Max Muster“, „Vorstand“). */
function matchUser(name: string, users: { id: string; name: string }[]): string {
  const n = name.trim().toLowerCase();
  if (n === "vorstand") return "VORSTAND";
  if (n === "alle") return "ALLE";
  return (
    users.find((u) => u.name.toLowerCase() === n)?.id ??
    users.find((u) => u.name.toLowerCase().split(/\s+/).includes(n))?.id ??
    ""
  );
}

export default async function DraftPage({ params }: { params: Promise<{ id: string; tid: string }> }) {
  const user = await requirePageCapability("minutes.edit");
  const { id, tid } = await params;
  const t = await getTranscript(user, tid);
  if (t.meetingId !== id) redirect(`/meetings/${t.meetingId}/transcripts/${tid}`);
  const draft = parseStoredDraft(t.draft);
  const users = await listActiveUsers();
  if (!draft) {
    return (
      <>
        <PageHeader title="Entwurf prüfen" />
        <p className="text-sm">Für dieses Transkript liegt kein Entwurf vor.</p>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Entwurf prüfen" description={`${meetingTitle(t.meeting)} · aus ${t.originalName}`} />
      <Alert variant="warning" className="mb-4">
        <AlertDescription>
          Der Entwurf ist ein Vorschlag der KI. Stichpunkte werden nur in leere TOPs übernommen (außer „überschreiben“). Beschlüsse und
          Aufgaben werden nur angelegt, wenn Sie sie hier auswählen. Beschlüsse setzen eine festgestellte Beschlussfähigkeit voraus.
        </AlertDescription>
      </Alert>
      {draft.unsicherheiten.length ? (
        <Card className="mb-4 border-amber-300">
          <CardHeader>
            <CardTitle>Unsicherheiten – bitte prüfen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm">
              {draft.unsicherheiten.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <ActionForm action={applyDraftAction.bind(null, id, tid)} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Verlauf je TOP</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {draft.abschnitte.map((a) => (
              <div key={a.topNummer}>
                <div className="font-semibold">
                  TOP {a.topNummer} {a.status !== "BEHANDELT" ? `(${a.status.toLowerCase()})` : ""}
                </div>
                <ul className="ml-4">
                  {a.punkte.map((p, i) => (
                    <li key={i}>
                      – {p.text}
                      {p.unterpunkte.map((u, j) => (
                        <div key={j} className="ml-4">
                          · {u}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
                {a.ergebnis ? (
                  <div className="ml-4 font-semibold">
                    {a.ergebnis.art === "BESCHLUSS" ? "Beschluss:" : "Ergebnis:"} {a.ergebnis.text}
                  </div>
                ) : null}
              </div>
            ))}
            <label className="flex items-center gap-2">
              <Checkbox name="overwrite" /> bereits ausgefüllte TOPs und Formalia überschreiben
            </label>
          </CardContent>
        </Card>
        {draft.beschluesse.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Erkannte Beschlüsse</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {draft.beschluesse.map((b, i) => (
                <label key={i} className="flex items-start gap-2">
                  <Checkbox name="resolution[]" value={String(i)} defaultChecked className="mt-0.5" />
                  <span>
                    TOP {b.topNummer}: {b.gegenstand} – {RESULT_LABELS[b.ergebnisart]}
                    {b.ja !== null ? ` (${b.ja}:${b.nein ?? 0}:${b.enthaltung ?? 0})` : ""}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {draft.aufgaben.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Erkannte Aufgaben</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {draft.aufgaben.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-start gap-2">
                    <Checkbox name="task[]" value={String(i)} defaultChecked className="mt-0.5" />
                    <span>
                      {a.titel}
                      <span className="text-neutral-600">
                        {" "}
                        – {a.fristDatum ?? a.fristText ?? "ohne Frist"}
                        {a.topNummer ? ` · TOP ${a.topNummer}` : ""}
                        {a.verantwortlich.length ? ` · laut Entwurf: ${a.verantwortlich.join(", ")}` : ""}
                      </span>
                    </span>
                  </label>
                  <NativeSelect
                    name={`taskAssignee-${i}`}
                    defaultValue={a.verantwortlich[0] ? matchUser(a.verantwortlich[0], users) : ""}
                    className="w-52"
                    aria-label={`Verantwortlich für „${a.titel}“`}
                  >
                    <option value="">niemand</option>
                    <option value="VORSTAND">Gruppe „Vorstand“</option>
                    <option value="ALLE">Gruppe „alle“</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {draft.verschiedenes.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Ohne passenden TOP</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm">
                {draft.verschiedenes.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
        <SubmitButton className="self-start" pendingText="Wird übernommen …">
          Auswahl ins Protokoll übernehmen
        </SubmitButton>
      </ActionForm>
    </>
  );
}
