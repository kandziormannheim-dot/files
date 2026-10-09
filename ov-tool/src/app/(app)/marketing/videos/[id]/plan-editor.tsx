"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Play, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cutBudget, MIN_SHOT, OUTRO_SECONDS, planDuration, SHOT_TONES, shotText, TONE_LABELS, type Segment, type Shot, type VideoPlan } from "@/lib/video-plan";
import { savePlanAction } from "../actions";

export type EditorClip = { id: string; name: string; duration: number; hasAudio: boolean; hasStill: boolean; transcript: Segment[] | null };

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

export function PlanEditor({ projectId, initial, clips, maxSeconds, disabled }: { projectId: string; initial: VideoPlan; clips: EditorClip[]; maxSeconds: number; disabled?: boolean }) {
  const [plan, setPlan] = useState<VideoPlan>(initial);
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
    setPlan((p) => ({ ...p, shots: [...p.shots, { clipId: c.id, start: 0, end: Math.min(c.duration, 3), ton: c.hasAudio ? "original" : "stumm", einblendung: "", untertitel: c.hasAudio }] }));
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
                          {TONE_LABELS[t]}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs sm:col-span-3">
                    Texteinblendung (optional, max. 7 Wörter)
                    <Input value={s.einblendung} maxLength={80} onChange={(e) => setShot(i, { einblendung: e.target.value })} />
                  </label>
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
                {text ? <> · „{text}“</> : null}
              </p>
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
