"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MIN_SHOT, type Segment } from "@/lib/video-plan";

const fmt = (n: number) => {
  const m = Math.floor(n / 60);
  const s = n - m * 60;
  return m ? `${m}:${s.toFixed(1).padStart(4, "0").replace(".", ",")}` : `${s.toFixed(1).replace(".", ",")} s`;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Zuschneiden eines Ausschnitts: Originalclip ansehen, Anfang/Ende an der aktuellen Stelle setzen, Griffe auf der
 * Zeitleiste ziehen, in 0,5-s-Schritten nachjustieren oder ganze Sätze aus dem Transkript übernehmen.
 */
export function ShotTrimmer({
  clipId,
  duration,
  transcript,
  start,
  end,
  onChange,
}: {
  clipId: string;
  duration: number;
  transcript: Segment[] | null;
  start: number;
  end: number;
  onChange: (range: { start: number; end: number }) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const stopAt = useRef<number | null>(null);
  const drag = useRef<"start" | "end" | null>(null);
  const [now, setNow] = useState(start);
  const [playing, setPlaying] = useState(false);
  // sichtbarer Bereich: Ausschnitt mit 15 s Rand (bei langen Clips sonst zu grob)
  const [base, setWin] = useState(() => ({ from: Math.max(0, start - 15), to: Math.min(duration, end + 15) }));
  // Fenster wächst mit, wenn der Ausschnitt aus dem sichtbaren Bereich wandert
  const win = { from: Math.min(base.from, Math.max(0, start - 2)), to: Math.max(base.to, Math.min(duration, end + 2)) };


  const set = (s: number, e: number) => {
    let a = Math.max(0, Math.min(r1(s), duration));
    let b = Math.max(0, Math.min(r1(e), duration));
    if (b - a < 0.5) {
      if (s !== start) a = Math.max(0, b - 0.5);
      else b = Math.min(duration, a + 0.5);
    }
    onChange({ start: a, end: b });
  };
  const seek = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, t));
    setNow(v.currentTime);
  };
  const playRange = () => {
    const v = video.current;
    if (!v) return;
    stopAt.current = end;
    v.currentTime = start;
    void v.play();
  };
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    stopAt.current = null;
    if (v.paused) void v.play();
    else v.pause();
  };

  const span = Math.max(0.1, win.to - win.from);
  const pct = (t: number) => `${((Math.max(win.from, Math.min(win.to, t)) - win.from) / span) * 100}%`;
  const timeAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return win.from + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * span;
  };
  const onDown = (e: ReactPointerEvent, which: "start" | "end" | null) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = which;
    if (!which) seek(timeAt(e.clientX));
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const t = timeAt(e.clientX);
    if (drag.current === "start") set(Math.min(t, end - 0.5), end);
    else set(start, Math.max(t, start + 0.5));
    seek(t);
  };
  const onUp = () => {
    drag.current = null;
  };

  const sentences = (transcript ?? []).filter((s) => s.end > win.from && s.start < win.to);
  const len = end - start;

  return (
    <div className="mt-3 grid gap-3 rounded-md bg-neutral-50 p-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <video
          ref={video}
          src={`/api/video/clip/${clipId}/source`}
          className="aspect-video w-full rounded bg-black"
          playsInline
          preload="metadata"
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setNow(t);
            if (stopAt.current != null && t >= stopAt.current) {
              e.currentTarget.pause();
              stopAt.current = null;
            }
          }}
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = start;
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Button type="button" size="sm" variant="outline" onClick={toggle} aria-label={playing ? "Pause" : "Abspielen"}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={playRange}>
            Ausschnitt abspielen
          </Button>
          <span className="ml-auto whitespace-nowrap font-mono">{fmt(now)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <Button type="button" size="sm" onClick={() => set(Math.min(now, end - 0.5), end)}>
            Anfang hier
          </Button>
          <Button type="button" size="sm" onClick={() => set(start, Math.max(now, start + 0.5))}>
            Ende hier
          </Button>
          <div className="flex items-center justify-between gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => set(start - 0.5, end)} aria-label="Anfang 0,5 s früher">
              −0,5
            </Button>
            <span className="whitespace-nowrap font-mono">{fmt(start)}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => set(start + 0.5, end)} aria-label="Anfang 0,5 s später">
              +0,5
            </Button>
          </div>
          <div className="flex items-center justify-between gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => set(start, end - 0.5)} aria-label="Ende 0,5 s früher">
              −0,5
            </Button>
            <span className="whitespace-nowrap font-mono">{fmt(end)}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => set(start, end + 0.5)} aria-label="Ende 0,5 s später">
              +0,5
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-neutral-600">
            <span>{fmt(win.from)}</span>
            <span className={len < MIN_SHOT ? "font-semibold text-red-700" : ""}>Ausschnitt {fmt(len)}</span>
            <span>{fmt(win.to)}</span>
          </div>
          <div
            ref={track}
            className="relative h-10 cursor-pointer touch-none select-none rounded bg-neutral-200"
            onPointerDown={(e) => onDown(e, null)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="slider"
            aria-label="Zeitleiste – klicken zum Springen"
            aria-valuemin={win.from}
            aria-valuemax={win.to}
            aria-valuenow={now}
          >
            {sentences.map((s, k) => (
              <div key={k} className="absolute top-1 h-1.5 rounded bg-neutral-400/70" style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }} title={s.text} />
            ))}
            <div className="absolute inset-y-0 bg-akzent/40" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
            {(["start", "end"] as const).map((which) => (
              <div
                key={which}
                role="slider"
                tabIndex={0}
                aria-label={which === "start" ? "Anfang ziehen" : "Ende ziehen"}
                aria-valuenow={which === "start" ? start : end}
                className="absolute inset-y-0 z-10 -ml-1.5 w-3 cursor-ew-resize rounded bg-rhoendorf"
                style={{ left: pct(which === "start" ? start : end) }}
                onPointerDown={(e) => onDown(e, which)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={(e) => {
                  const d = e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0;
                  if (!d) return;
                  e.preventDefault();
                  const step = e.shiftKey ? d * 10 : d;
                  if (which === "start") set(start + step, end);
                  else set(start, end + step);
                }}
              />
            ))}
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-red-600" style={{ left: pct(now) }} />
          </div>
          <div className="mt-1 flex gap-2 text-[11px]">
            <button type="button" className="underline" onClick={() => setWin({ from: Math.max(0, win.from - 30), to: Math.min(duration, win.to + 30) })}>
              Bereich erweitern
            </button>
            <span className="text-neutral-600">Griffe ziehen oder mit Pfeiltasten verschieben (Umschalt = 1 s); Klick in die Leiste springt dorthin.</span>
          </div>
        </div>
        {sentences.length ? (
          <ul className="max-h-48 overflow-y-auto rounded border bg-white text-xs">
            {sentences.map((s, k) => {
              const inside = s.end > start + 0.1 && s.start < end - 0.1;
              return (
                <li key={k} className={`flex items-start gap-2 border-b px-2 py-1.5 last:border-0 ${inside ? "bg-akzent/10" : ""}`}>
                  <button type="button" className="shrink-0 whitespace-nowrap font-mono text-neutral-600 underline" onClick={() => seek(s.start)} title="hierhin springen">
                    {fmt(s.start)}
                  </button>
                  <span className="min-w-0 flex-1">{s.text}</span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-neutral-100" onClick={() => set(s.start - 0.1, Math.max(end, s.start + 0.5))} title="Ausschnitt beginnt mit diesem Satz">
                      ab hier
                    </button>
                    <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-neutral-100" onClick={() => set(Math.min(start, s.end - 0.5), s.end + 0.15)} title="Ausschnitt endet nach diesem Satz">
                      bis hier
                    </button>
                    <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-neutral-100" onClick={() => set(s.start - 0.1, s.end + 0.15)} title="nur diesen Satz als O-Ton">
                      nur Satz
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-neutral-600">Kein Transkript für diesen Bereich – Anfang und Ende über die Wiedergabe oder die Zeitleiste setzen.</p>
        )}
      </div>
    </div>
  );
}
