import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Music, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/dates";
import { isVideoFormat, planDuration, VIDEO_FORMATS } from "@/lib/video-plan";
import { requirePageCapability } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { aiConfigured } from "@/server/services/ai-draft";
import { getProject, isBusy, outputsOf, planOf, stillsOf, transcriptOf } from "@/server/services/video";
import { MARKETING_STATUS } from "../../labels";
import { deleteProjectAction, removeClipAction, removeMusicAction, setMusicAction, startProcessingAction, toMarketingPostAction, updateProjectAction } from "../actions";
import { VIDEO_STATUS } from "../labels";
import { ProjectForm } from "../project-form";
import { PlanEditor } from "./plan-editor";
import { StatusPoller } from "./status-poller";
import { Uploader } from "./uploader";

export const metadata: Metadata = { title: "Video" };

const fmtSec = (n: number | null) => (n == null ? "–" : `${n.toFixed(1).replace(".", ",")} s`);

export default async function VideoProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageCapability("marketing.create");
  const { id } = await params;
  const p = await getProject(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const busy = isBusy(p);
  const plan = planOf(p);
  const outputs = outputsOf(p);
  const formats = p.formats.filter(isVideoFormat).filter((f) => outputs.files[f]);
  const status = busy ? p.status : p.status === "FERTIG" || p.status === "FEHLER" ? p.status : plan ? "FERTIG" : "ENTWURF";

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/marketing/videos" className="underline">
          ← Videos
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={p.title} description={p.topic.length > 160 ? `${p.topic.slice(0, 157)}…` : p.topic} />
        <Badge variant={VIDEO_STATUS[status].variant}>{VIDEO_STATUS[status].label}</Badge>
      </div>

      {busy ? (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <StatusPoller projectId={p.id} status={p.status} progress={p.progress} />
          </CardContent>
        </Card>
      ) : null}
      {p.status === "FEHLER" && p.error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{p.error}</AlertDescription>
        </Alert>
      ) : null}
      {!busy && outputs.warnings.length ? (
        <Alert className="mb-4">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {outputs.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        {formats.length && !busy ? (
          <Card>
            <CardHeader>
              <CardTitle>Fertiges Video</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start gap-4">
                {formats.map((f) => {
                  const slug = f.replace(":", "x");
                  const { width, height } = VIDEO_FORMATS[f];
                  return (
                    <figure key={f} className="flex flex-col gap-1.5" style={{ width: width > height ? 360 : height > width ? 200 : 260 }}>
                      <video src={`/api/video/${p.id}/output/${slug}?v=${p.renderedAt?.getTime() ?? 0}`} controls playsInline preload="metadata" className="w-full rounded bg-black" style={{ aspectRatio: `${width}/${height}` }} />
                      <figcaption className="flex items-center justify-between gap-2 text-xs">
                        <span>{VIDEO_FORMATS[f].label}</span>
                        <a href={`/api/video/${p.id}/output/${slug}?download=1`} className="inline-flex items-center gap-1 underline">
                          <Download className="size-3.5" aria-hidden /> MP4
                        </a>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
                <ActionForm action={toMarketingPostAction.bind(null, p.id)}>
                  <SubmitButton pendingText="…">{p.marketingPost && p.marketingPost.status !== "VEROEFFENTLICHT" ? "Video im Beitrag ersetzen" : "Als Social-Media-Beitrag übernehmen"}</SubmitButton>
                </ActionForm>
                {p.marketingPost ? (
                  <Link href={`/marketing/${p.marketingPost.id}`} className="underline">
                    Beitrag „{p.marketingPost.title || "ohne Titel"}“ ({MARKETING_STATUS[p.marketingPost.status]?.label ?? p.marketingPost.status})
                  </Link>
                ) : (
                  <span className="text-neutral-600">Veröffentlicht wird erst nach Freigabe im Beitrag.</span>
                )}
              </div>
              <p className="text-xs text-neutral-600">
                Gerendert {p.renderedAt ? formatDateTime(p.renderedAt) : "–"}
                {plan ? ` · ${fmtSec(planDuration(plan))}` : ""}
                {p.planSource === "ki" ? " · Schnitt von Claude vorgeschlagen" : p.planSource === "bearbeitet" ? " · Schnitt von Hand angepasst" : p.planSource === "einfach" ? " · einfacher Schnitt ohne KI" : ""}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Clips</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {p.clips.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {p.clips.map((c, i) => {
                  const stills = stillsOf(c);
                  const t = transcriptOf(c);
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-6 font-bold">C{i + 1}</span>
                      {stills[1] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/video/clip/${c.id}/still/1`} alt="" className="h-12 w-16 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-16 shrink-0 rounded bg-neutral-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.originalName}</p>
                        <p className="text-xs text-neutral-600">
                          {fmtSec(c.duration)} · {c.width}×{c.height} · {c.hasAudio ? (t?.length ? `O-Ton erkannt (${t.length} Sätze)` : c.analyzedAt ? "Ton, ohne Transkript" : "mit Ton") : "ohne Ton"}
                          {" · "}
                          {(c.size / 1024 / 1024).toFixed(0)} MB
                        </p>
                      </div>
                      <ActionForm action={removeClipAction.bind(null, p.id, c.id)}>
                        <SubmitButton variant="ghost" size="icon" aria-label={`${c.originalName} entfernen`} disabled={busy} pendingText="…">
                          <Trash2 className="size-4" />
                        </SubmitButton>
                      </ActionForm>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-neutral-600">Noch keine Clips. Nach dem Hochladen wird das Video automatisch geschnitten.</p>
            )}
            <Uploader projectId={p.id} autoStart={!plan && !busy} disabled={busy} />
            {p.clips.length ? (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <ActionForm action={startProcessingAction.bind(null, p.id, plan ? "plan" : "full")}>
                  <SubmitButton variant={plan ? "outline" : "default"} disabled={busy} pendingText="…">
                    {plan ? "Neu schneiden lassen" : "Video automatisch schneiden"}
                  </SubmitButton>
                </ActionForm>
                {!aiConfigured() ? <p className="self-center text-xs text-neutral-600">Ohne Claude API entsteht nur ein einfacher Schnitt.</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {plan && !busy ? (
          <Card>
            <CardHeader>
              <CardTitle>Schnitt anpassen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {plan.begruendung ? <p className="text-sm text-neutral-600">Idee des Schnitts: {plan.begruendung}</p> : null}
              <PlanEditor
                key={p.updatedAt.toISOString()}
                projectId={p.id}
                initial={plan}
                maxSeconds={p.maxSeconds}
                disabled={busy}
                clips={p.clips.map((c) => ({ id: c.id, name: c.originalName, duration: c.duration ?? 0, hasAudio: c.hasAudio, hasStill: stillsOf(c).length > 1, transcript: transcriptOf(c) }))}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="size-4" aria-hidden /> Musik (optional)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {p.musicPath ? (
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  <strong>{p.musicName}</strong> · {p.musicVolume} % unter O-Tönen
                </span>
                <ActionForm action={removeMusicAction.bind(null, p.id)}>
                  <SubmitButton variant="ghost" size="sm" disabled={busy} pendingText="…">
                    entfernen
                  </SubmitButton>
                </ActionForm>
              </div>
            ) : null}
            <ActionForm action={setMusicAction.bind(null, p.id)} className="flex flex-col gap-3" resetOnSuccess>
              <Field label={p.musicPath ? "Andere Musik hochladen" : "Musik hochladen"} name="music" hint="MP3, M4A, AAC, OGG oder WAV, höchstens 30 MB. Läuft leise unter dem Video und wird bei Sprache automatisch leiser.">
                <Input id="music" name="music" type="file" accept="audio/*" required />
              </Field>
              <label className="flex items-start gap-2">
                <Checkbox name="rights" required className="mt-0.5" />
                Wir dürfen diese Musik für Social Media verwenden (z. B. GEMA-frei oder lizenziert).
              </label>
              <SubmitButton variant="outline" className="self-start" disabled={busy} pendingText="Wird hochgeladen …">
                Musik speichern
              </SubmitButton>
            </ActionForm>
            {plan ? <p className="text-xs text-neutral-600">Nach dem Ändern der Musik „Schnitt speichern und neu rendern“ wählen.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thema und Regievorgaben</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ProjectForm action={updateProjectAction.bind(null, p.id)} project={p} submitLabel="Speichern" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-neutral-600">
              <span>
                Angelegt von {p.createdBy?.name ?? "–"} · Einverständnis der gezeigten Personen bestätigt {p.consentConfirmedAt ? formatDateTime(p.consentConfirmedAt) : "–"}
              </span>
              <ActionForm action={deleteProjectAction.bind(null, p.id)}>
                <SubmitButton variant="ghost" size="sm" className="text-red-700" disabled={busy} pendingText="…">
                  Video mit allen Clips löschen
                </SubmitButton>
              </ActionForm>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
