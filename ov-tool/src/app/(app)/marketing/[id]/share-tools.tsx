"use client";

import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Kopieren und Teilen ohne Plattform-API: Text in die Zwischenablage oder über das Teilen-Menü des Handys. */
export function ShareTools({ text, url }: { text: string; url?: string | null }) {
  const full = url ? `${text}\n\n${url}` : text;
  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      toast.success("Text kopiert – jetzt in Facebook, Instagram oder WhatsApp einfügen.");
    } catch {
      toast.error("Kopieren nicht möglich. Bitte den Text manuell markieren.");
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text: full, ...(url ? { url } : {}) });
      } catch {
        /* abgebrochen */
      }
    } else {
      await copy();
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        <Copy className="size-4" aria-hidden /> Text kopieren
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={share}>
        <Share2 className="size-4" aria-hidden /> Teilen …
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={`https://wa.me/?text=${encodeURIComponent(full)}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </Button>
      {url ? (
        <Button asChild variant="outline" size="sm">
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
            Auf Facebook teilen
          </a>
        </Button>
      ) : null}
      <Button asChild variant="outline" size="sm">
        <a href="https://business.facebook.com/latest/content_calendar" target="_blank" rel="noopener noreferrer">
          Meta Business Suite (planen)
        </a>
      </Button>
    </div>
  );
}
