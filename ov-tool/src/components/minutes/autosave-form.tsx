"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * Formular mit automatischem Zwischenspeichern (SPEC.md 3.3: Live-Protokoll). Speichert 1 s nach der letzten
 * Eingabe und sofort beim Verlassen eines Feldes; zeigt den Zustand an.
 */
export function AutoSaveForm({
  action,
  children,
  className,
  delay = 1000,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const form = ref.current;
    if (!form) return;
    const fd = new FormData(form);
    setStatus("saving");
    startTransition(async () => {
      const res = await action(null, fd);
      if (res && !res.ok) {
        setStatus("error");
        setError(res.error ?? "Speichern fehlgeschlagen");
      } else {
        setStatus("saved");
        setError(null);
      }
    });
  };

  const schedule = () => {
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, delay);
  };

  useEffect(() => {
    // Ungespeicherte Änderungen beim Verlassen der Seite noch senden
    const flush = () => {
      if (timer.current) save();
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  });

  return (
    <form
      ref={ref}
      className={cn("relative", className)}
      onInput={schedule}
      onChange={schedule}
      onBlur={() => {
        if (timer.current) save();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {children}
      <div className="mt-1 h-4 text-right text-xs text-neutral-500" aria-live="polite">
        {status === "dirty" ? "ungespeichert" : status === "saving" ? "speichert …" : status === "saved" ? "gespeichert" : null}
        {status === "error" ? <span className="text-red-700">{error}</span> : null}
      </div>
    </form>
  );
}
