"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { LAYOUT, LOGO_SCALE, VIDEO_FORMATS, type LogoOptions, type Pos, type VideoFormat } from "@/lib/video-plan";

const TUERKIS = "#52b7c1";
const RHOENDORF = "#2d3c4b";
const GOLD = "#ffa600";

type Drag = { kind: "titel" | "einblendung" | "untertitel"; startX: number; startY: number; orig: Pos };

/**
 * Vorschau eines Bildes im Zielformat mit Titel, Einblendung, Untertitel und Logo – maßstabsgetreu zum Renderer
 * (gleiche Prozentpositionen und Schriftgrößen aus LAYOUT). Texte lassen sich mit Maus oder Finger verschieben.
 */
export function LayoutPreview(props: {
  format: VideoFormat;
  still: string | null;
  logoUrl: string;
  logo: LogoOptions;
  titel?: { text: string; unterzeile: string; pos?: Pos } | null;
  einblendung?: { text: string; pos?: Pos } | null;
  untertitel?: { text: string; y?: number } | null;
  onMove: (kind: Drag["kind"], pos: Pos) => void;
}) {
  const { format } = props;
  const { width, height } = VIDEO_FORMATS[format];
  const l = LAYOUT[format];
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const start = (e: ReactPointerEvent, kind: Drag["kind"], orig: Pos) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, startX: e.clientX, startY: e.clientY, orig };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    const x = d.orig.x + ((e.clientX - d.startX) / r.width) * 100;
    const y = d.orig.y + ((e.clientY - d.startY) / r.height) * 100;
    props.onMove(d.kind, { x: Math.round(Math.max(0, Math.min(90, x)) * 10) / 10, y: Math.round(Math.max(d.kind === "untertitel" ? 10 : 0, Math.min(95, y)) * 10) / 10 });
  };
  const end = () => {
    drag.current = null;
  };

  const px = (n: number) => `${n * scale}px`;
  const handle = "cursor-move touch-none select-none outline-1 outline-offset-2 outline-dashed outline-white/70 hover:outline-white";
  const placed = (pos: Pos, kind: Drag["kind"], label: string, children: ReactNode) => (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label} verschieben`}
      className={`absolute ${handle}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, maxWidth: `${Math.max(20, 100 - pos.x - l.margin)}%` }}
      onPointerDown={(e) => start(e, kind, pos)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 5 : 1;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault();
        props.onMove(kind, { x: Math.max(0, Math.min(90, pos.x + d[0]!)), y: Math.max(0, Math.min(95, pos.y + d[1]!)) });
      }}
    >
      {children}
    </div>
  );

  const logoH = props.logo.size === "aus" ? 0 : l.logoHeight * LOGO_SCALE[props.logo.size];
  const [v, hz] = props.logo.position.split("-");
  const my = format === "9:16" ? (v === "oben" ? 110 : 330) : height * 0.046;

  return (
    <div
      ref={box}
      className="relative w-full overflow-hidden rounded bg-neutral-800 font-sans"
      style={{ aspectRatio: `${width}/${height}`, fontFamily: "Inter, Arial, sans-serif" }}
    >
      {props.still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.still} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
      ) : null}

      {logoH ? (
        <div
          className="pointer-events-none absolute"
          style={{
            [v === "oben" ? "top" : "bottom"]: px(my),
            [hz === "links" ? "left" : "right"]: px((width * l.margin) / 100),
            ...(props.logo.chip ? { background: "#fff", borderRadius: px(10), padding: `${px(logoH * 0.14)} ${px(logoH * 0.2)}` } : {}),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.logoUrl} alt="" style={{ height: px(logoH), maxWidth: px(logoH * 4), objectFit: "contain", display: "block" }} />
        </div>
      ) : null}

      {props.titel?.text
        ? placed(
            props.titel.pos ?? l.titel,
            "titel",
            "Titelzeile",
            <>
              <p style={{ fontWeight: 900, fontSize: px(l.fonts.titel), lineHeight: 1.18, color: "#fff" }}>
                <span style={{ background: TUERKIS, padding: "0.06em 0.3em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{props.titel.text}</span>
              </p>
              {props.titel.unterzeile ? (
                <p style={{ marginTop: px(22), fontWeight: 700, fontSize: px(l.fonts.unterzeile), lineHeight: 1.35, color: RHOENDORF }}>
                  <span style={{ background: "#fff", padding: "0.12em 0.4em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{props.titel.unterzeile}</span>
                </p>
              ) : null}
            </>,
          )
        : null}

      {props.einblendung?.text
        ? placed(
            props.einblendung.pos ?? l.einblendung,
            "einblendung",
            "Einblendung",
            <>
              <p style={{ fontWeight: 800, fontSize: px(l.fonts.einblendung), lineHeight: 1.32, color: "#fff" }}>
                <span style={{ background: TUERKIS, padding: "0.12em 0.35em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{props.einblendung.text}</span>
              </p>
              <div style={{ marginTop: px(14), width: px(l.fonts.einblendung * 2.4), height: px(l.fonts.einblendung * 0.22), background: GOLD }} />
            </>,
          )
        : null}

      {props.untertitel?.text ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Untertitel nach oben oder unten verschieben"
          className={`absolute flex justify-center ${handle}`}
          style={{ left: `${l.margin}%`, right: `${l.margin}%`, top: `${props.untertitel.y ?? l.untertitelY}%`, transform: "translateY(-50%)" }}
          onPointerDown={(e) => start(e, "untertitel", { x: 0, y: props.untertitel?.y ?? l.untertitelY })}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={(e) => {
            const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
            if (!d) return;
            e.preventDefault();
            props.onMove("untertitel", { x: 0, y: Math.max(10, Math.min(95, (props.untertitel?.y ?? l.untertitelY) + d * (e.shiftKey ? 5 : 1))) });
          }}
        >
          <p style={{ textAlign: "center", fontWeight: 800, fontSize: px(l.fonts.untertitel), lineHeight: 1.34, color: "#fff" }}>
            <span style={{ background: "rgba(45,60,75,.86)", padding: "0.1em 0.35em", borderRadius: px(8), boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{props.untertitel.text}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
