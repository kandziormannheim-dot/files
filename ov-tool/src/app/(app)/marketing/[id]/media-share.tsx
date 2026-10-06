"use client";

import { Copy, Download, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Kachel bzw. Video samt Text über das Teilen-Menü des Handys weitergeben (z. B. direkt in die Facebook- oder Instagram-App). */
export function MediaShare({ src, fileName, mime, text, label }: { src: string; fileName: string; mime: string; text: string; label: string }) {
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], fileName, { type: mime });
      if (navigator.canShare?.({ files: [file] })) {
        // Text vorab kopieren: viele Apps übernehmen beim Teilen von Dateien den Text nicht
        await navigator.clipboard?.writeText(text).catch(() => undefined);
        await navigator.share({ files: [file], text });
        toast.success("Geteilt. Der Text liegt zusätzlich in der Zwischenablage.");
      } else {
        toast.info("Teilen von Dateien wird hier nicht unterstützt – bitte herunterladen.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Teilen nicht möglich – bitte herunterladen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={share} disabled={busy}>
        <Share2 className="size-4" aria-hidden /> {label} teilen …
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={`${src}?download=1`}>
          <Download className="size-4" aria-hidden /> Herunterladen
        </a>
      </Button>
    </div>
  );
}

export function CopyText({ text, label = "Kopieren" }: { text: string; label?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Kopiert.");
        } catch {
          toast.error("Kopieren nicht möglich.");
        }
      }}
    >
      <Copy className="size-4" aria-hidden /> {label}
    </Button>
  );
}
