"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Play, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  cutBudget,
  MIN_SHOT,
  OUTRO_SECONDS,
  planDuration,
  SHOT_TONES,
  shotText,
  subtitleCues,
  TONE_LABELS,
  VIDEO_FORMATS,
  type LogoOptions,
  type Pos,
  type Segment,
  type Shot,
  type VideoFormat,
  type VideoPlan,
} from "@/lib/video-plan";
import { LayoutPreview } from "./layout-preview";
import { savePlanAction } from "../actions";

export type EditorClip = { id: string; name: string; duration: number; hasAudio: boolean; hasStill: boolean; transcript: Segment[] | null };

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

export function PlanEditor({
  projectId,
  initial,
  clips,
  maxSeconds,
  disabled,
  formats,
  logo,
  hasMusic,
}: {
  projectId: string;
  initial: VideoPlan;
  clips: EditorClip[];
  maxSeconds: number;
  disabled?: boolean;
  formats: VideoFormat[];
  logo: LogoOptions;
  hasMusic: boolean;
}) {
  const [plan, setPlan] = useState<VideoPlan>(initial);
  const [layoutShot, setLayoutShot] = useState(0);
  const [layoutFormat, setLayoutFormat] = useState<VideoFormat>(formats[0] ?? "9:16");
  const video = useRef<HTMLVideoElement>(null);
  const stopAt = useRef<number | null>(null);
  const byId = new Map(clips.map((c) => [c.id, c]));
  const total = planDuration(plan);
  const over = total > maxSeconds + 0.05;

  const setShot = (i: number, patch: Partial<Shot>) => setPlan((p) => ({ ...p, shots: p.shots.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) =>
    setPlan((p) => {
      const shots = [...p.shots];
      const j = i + d;
      if (j < 0 || j >= shots.length) return p;
      [shots[i], shots[j]] = [shots[j]!, shots[i]!];
      return { ...p, shots };
    });
  const remove = (i: number) => setPlan((p) => ({ ...p, shots: p.shots.filter((_, k) => k !== i) }));
  const add = () => {
    const c = clips[0];
    if (!c) return;
    setPlan((p) => ({ ...p, shots: [...p.shots, { clipId: c.id, start: 0, end: Math.min(c.duration, 3), ton: c.hasAudio ? "original" : "stumm", einblendung: "", untertitel: c.hasAudio, untertitelText: "" }] }));
  };

  const preview = (s: Shot) => {
    const v = video.current;
    if (!v) return;
    const src = `/api/video/clip/${s.clipId}/source`;
    const go = () => {
      v.currentTime = s.start;
      stopAt.current = s.end;
      void v.play();
    };
    if (!v.src.endsWith(src)) {
      v.src = src;
      v.addEventListener("loadedmetadata", go, { once: true });
    } else go();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Titelzeile (erste Sekunden)</span>
            <Input value={plan.titel} maxLength={80} onChange={(e) => setPlan({ ...plan, titel: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Unterzeile (optional)</span>
            <Input value={plan.unterzeile} maxLength={120} onChange={(e) => setPlan({ ...plan, unterzeile: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Abschlusstafel: Botschaft</span>
            <Input value={plan.abschluss} maxLength={100} onChange={(e) => setPlan({ ...plan, abschluss: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Abschlusstafel: Aufruf</span>
            <Input value={plan.aufruf} maxLength={80} onChange={(e) => setPlan({ ...plan, aufruf: e.target.value })} />
          </label>
        </div>
        <div className="flex flex-col gap-1 text-xs text-neutral-600">
          <video
            ref={video}
            className="aspect-video w-full rounded bg-black"
            controls
            playsInline
            preload="none"
            onTimeUpdate={(e) => {
              if (stopAt.current != null && e.currentTarget.currentTime >= stopAt.current) {
                e.currentTarget.pause();
                stopAt.current = null;
              }
            }}
          />
          Vorschau des Originalclips – „▶“ spielt den Ausschnitt ab.
        </div>
      </div>

      <LayoutSection
        plan={plan}
        clips={clips}
        formats={formats}
        format={layoutFormat}
        setFormat={setLayoutFormat}
        shotIndex={Math.min(layoutShot, Math.max(0, plan.shots.length - 1))}
        setShotIndex={setLayoutShot}
        logo={logo}
        logoUrl={`/api/video/${projectId}/logo`}
        onMove={(kind, pos, i) => {
          if (kind === "titel") setPlan((p) => ({ ...p, titelPos: pos }));
          else if (kind === "untertitel") setPlan((p) => ({ ...p, untertitelY: pos.y }));
          else setShot(i, { einblendungPos: pos });
        }}
        onReset={() => setPlan((p) => ({ ...p, titelPos: undefined, untertitelY: undefined, shots: p.shots.map((s) => ({ ...s, einblendungPos: undefined })) }))}
      />

      <ol className="flex flex-col gap-3">
        {plan.shots.map((s, i) => {
          const clip = byId.get(s.clipId);
          const text = clip?.transcript ? shotText(s, clip.transcript) : "";
          return (
            <li key={i} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <span className="w-6 text-sm font-bold">{i + 1}.</span>
                  {clip?.hasStill ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/video/clip/${s.clipId}/still/1`} alt="" className="h-14 w-20 rounded object-cover" />
                  ) : null}
                </div>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_5.5rem_5.5rem_minmax(0,1fr)]">
                  <label className="flex min-w-0 flex-col gap-0.5 text-xs">
                    Clip
                    <NativeSelect value={s.clipId} onChange={(e) => setShot(i, { clipId: e.target.value })}>
                      {clips.map((c, k) => (
                        <option key={c.id} value={c.id}>
                          C{k + 1} · {c.name} ({fmt(c.duration)} s)
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs">
                    von (s)
                    <Input type="number" step={0.1} min={0} max={clip?.duration} value={s.start} onChange={(e) => setShot(i, { start: Number(e.target.value) })} />
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs">
                    bis (s)
                    <Input type="number" step={0.1} min={0} max={clip?.duration} value={s.end} onChange={(e) => setShot(i, { end: Number(e.target.value) })} />
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs">
                    Ton
                    <NativeSelect value={s.ton} onChange={(e) => setShot(i, { ton: e.target.value as Shot["ton"] })} disabled={!clip?.hasAudio}>
                      {SHOT_TONES.map((t) => (
                        <option key={t} value={t}>
                          {t === "stumm" && !hasMusic ? "ohne Ton (ohne Musik: leise)" : TONE_LABELS[t]}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs sm:col-span-2">
                    Texteinblendung (optional, max. 7 Wörter)
                    <Input value={s.einblendung} maxLength={80} onChange={(e) => setShot(i, { einblendung: e.target.value })} />
                  </label>
                  <div className="flex gap-2 text-xs">
                    <label className="flex w-1/2 flex-col gap-0.5">
                      Einbl. ab (s)
                      <Input
                        type="number"
                        step={0.1}
                        min={0}
                        placeholder={i === 0 && plan.titel ? "nach Titel" : "0"}
                        value={s.einblendungVon ?? ""}
                        disabled={!s.einblendung}
                        onChange={(e) => setShot(i, { einblendungVon: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </label>
                    <label className="flex w-1/2 flex-col gap-0.5">
                      bis (s)
                      <Input
                        type="number"
                        step={0.1}
                        min={0}
                        placeholder="Ende"
                        value={s.einblendungBis ?? ""}
                        disabled={!s.einblendung}
                        onChange={(e) => setShot(i, { einblendungBis: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 self-end pb-2 text-xs">
                    <input type="checkbox" className="size-4 accent-akzent-dunkel" checked={s.untertitel} disabled={!clip?.transcript?.length || s.ton === "stumm"} onChange={(e) => setShot(i, { untertitel: e.target.checked })} />
                    Untertitel
                  </label>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label="Ausschnitt abspielen" onClick={() => preview(s)}>
                    <Play className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="nach oben" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="nach unten" onClick={() => move(i, 1)} disabled={i === plan.shots.length - 1}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Ausschnitt entfernen" onClick={() => remove(i)} disabled={plan.shots.length === 1}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-neutral-600">
                {fmt(Math.max(0, s.end - s.start))} s{s.end - s.start < MIN_SHOT ? " – wird auf 1,5 s verlängert" : ""}
                {text && !(s.untertitel && s.ton !== "stumm") ? <> · „{text}“</> : null}
              </p>
              {s.untertitel && s.ton !== "stumm" && text ? (
                <label className="mt-2 flex flex-col gap-0.5 text-xs">
                  Untertitel – bei Erkennungsfehlern hier korrigieren
                  <Textarea
                    rows={2}
                    maxLength={400}
                    value={s.untertitelText || text}
                    onChange={(e) => setShot(i, { untertitelText: e.target.value.trim() === text ? "" : e.target.value })}
                    className={s.untertitelText ? "border-union-gold" : ""}
                  />
                  {s.untertitelText ? (
                    <span>
                      korrigiert · erkannt war: „{text}“{" "}
                      <button type="button" className="underline" onClick={() => setShot(i, { untertitelText: "" })}>
                        zurücksetzen
                      </button>
                    </span>
                  ) : null}
                </label>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" /> Ausschnitt hinzufügen
        </Button>
        <p className={`text-sm ${over ? "font-semibold text-red-700" : "text-neutral-600"}`}>
          Länge {fmt(total)} s von max. {maxSeconds} s (davon {OUTRO_SECONDS} s Abschlusstafel)
          {over ? ` – wird beim Speichern auf ${fmt(cutBudget(maxSeconds) + OUTRO_SECONDS)} s gekürzt` : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Begleittext für den Beitrag</span>
          <Textarea rows={4} value={plan.beitragstext} maxLength={1500} onChange={(e) => setPlan({ ...plan, beitragstext: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Hashtags</span>
          <Input value={plan.hashtags} maxLength={200} onChange={(e) => setPlan({ ...plan, hashtags: e.target.value })} />
        </label>
      </div>

      <ActionForm action={savePlanAction.bind(null, projectId)}>
        <input type="hidden" name="plan" value={JSON.stringify(plan)} />
        <SubmitButton disabled={disabled} pendingText="Wird gespeichert …">
          Schnitt speichern und neu rendern
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

function LayoutSection(props: {
  plan: VideoPlan;
  clips: EditorClip[];
  formats: VideoFormat[];
  format: VideoFormat;
  setFormat: (f: VideoFormat) => void;
  shotIndex: number;
  setShotIndex: (i: number) => void;
  logo: LogoOptions;
  logoUrl: string;
  onMove: (kind: "titel" | "einblendung" | "untertitel", pos: Pos, shotIndex: number) => void;
  onReset: () => void;
}) {
  const { plan, shotIndex } = props;
  const shot = plan.shots[shotIndex];
  if (!shot) return null;
  const clip = props.clips.find((c) => c.id === shot.clipId);
  const cue = shot.untertitel ? subtitleCues(shot, clip?.transcript)[0]?.text : "";
  const vertical = VIDEO_FORMATS[props.format].height > VIDEO_FORMATS[props.format].width;
  const moved = plan.titelPos || plan.untertitelY != null || plan.shots.some((s) => s.einblendungPos);
  return (
    <section className="rounded-md border p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Texte verschieben</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {props.formats.map((f) => (
            <button key={f} type="button" onClick={() => props.setFormat(f)} className={`rounded border px-2 py-1 ${f === props.format ? "border-rhoendorf bg-rhoendorf text-white" : ""}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className={vertical ? "w-56 max-w-full" : props.format === "1:1" ? "w-72 max-w-full" : "w-96 max-w-full"}>
          <LayoutPreview
            format={props.format}
            still={clip?.hasStill ? `/api/video/clip/${shot.clipId}/still/1` : null}
            logoUrl={props.logoUrl}
            logo={props.logo}
            titel={shotIndex === 0 ? { text: plan.titel, unterzeile: plan.unterzeile, pos: plan.titelPos } : null}
            einblendung={shot.einblendung ? { text: shot.einblendung, pos: shot.einblendungPos } : null}
            untertitel={cue ? { text: cue, y: plan.untertitelY } : { text: "Beispiel für einen Untertitel", y: plan.untertitelY }}
            onMove={(kind, pos) => props.onMove(kind, pos, shotIndex)}
          />
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs">Ausschnitt</span>
            <NativeSelect value={shotIndex} onChange={(e) => props.setShotIndex(Number(e.target.value))}>
              {plan.shots.map((s, i) => (
                <option key={i} value={i}>
                  {i + 1}. {s.einblendung || (i === 0 && plan.titel ? plan.titel : props.clips.find((c) => c.id === s.clipId)?.name ?? "")}
                </option>
              ))}
            </NativeSelect>
          </label>
          <p className="text-xs text-neutral-600">
            Titelzeile (im ersten Ausschnitt) und Einblendung mit Maus oder Finger an die gewünschte Stelle ziehen, Untertitel nach oben oder unten. Mit den Pfeiltasten
            geht es feiner. Titel und Untertitel gelten für das ganze Video, Einblendungen je Ausschnitt. Die Positionen gelten in Prozent für alle Formate; das
            Standbild dient nur der Orientierung.
          </p>
          {moved ? (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={props.onReset}>
              Alle Positionen zurücksetzen
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
