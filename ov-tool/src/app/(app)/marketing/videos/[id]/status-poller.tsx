"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const LABELS: Record<string, string> = {
  ANALYSE: "Clips werden analysiert – Standbilder und O-Töne abschreiben …",
  SCHNITT: "Schnitt wird nach den Regievorgaben geplant …",
  RENDERN: "Video wird gerendert …",
};

/** Zeigt den Fortschritt und lädt die Seite neu, sobald das Video fertig ist (oder ein Fehler auftrat). */
export function StatusPoller({ projectId, status: initialStatus, progress: initialProgress }: { projectId: string; status: string; progress: number }) {
  const router = useRouter();
  const [state, setState] = useState({ status: initialStatus, progress: initialProgress });

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/video/${projectId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as { status: string; progress: number };
        if (stopped) return;
        setState(next);
        if (!(next.status in LABELS)) {
          stopped = true;
          router.refresh();
        }
      } catch {
        // nächster Versuch
      }
    };
    const timer = setInterval(() => void tick(), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [projectId, router]);

  return (
    <div className="flex flex-col gap-2 text-sm" role="status" aria-live="polite">
      <p className="flex items-center gap-2 font-medium">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {LABELS[state.status] ?? "Wird bearbeitet …"}
      </p>
      <div className="h-2 overflow-hidden rounded bg-neutral-200">
        <div className="h-full bg-akzent transition-all duration-700" style={{ width: `${Math.max(3, state.progress)}%` }} />
      </div>
      <p className="text-xs text-neutral-600">Das dauert je nach Länge der Clips einige Minuten. Die Seite kann geschlossen werden – das Video wird trotzdem fertig.</p>
    </div>
  );
}
