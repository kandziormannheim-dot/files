"use client";

import { ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

const noop = () => () => {};

/** Code aus Barcode (OVMASF01234.20) oder QR-Link (…/inventory/code/OVMASF01234.20) herauslösen. */
function extractCode(raw: string) {
  const m = /OVMASF\d{5}\.\d{2}/i.exec(raw);
  return m ? m[0].toUpperCase() : raw.trim();
}

/**
 * Scannen mit der Handykamera (Chrome/Android über BarcodeDetector). Auf dem iPhone einfach den QR-Code
 * mit der Kamera-App öffnen; Handscanner tippen den Code ins Suchfeld und schicken ihn mit Enter ab.
 */
export function Scanner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const supported = useSyncExternalStore(noop, () => !!window.BarcodeDetector, () => false);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!open || !window.BarcodeDetector) return;
    let stream: MediaStream | null = null;
    let stop = false;
    const detector = new window.BarcodeDetector({ formats: ["code_128", "qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        while (!stop) {
          const hits = await detector.detect(video.current).catch(() => []);
          const hit = hits[0]?.rawValue;
          if (hit) {
            stop = true;
            router.push(`/inventory/code/${encodeURIComponent(extractCode(hit))}`);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setError("Kamera nicht verfügbar. Bitte Kamerazugriff erlauben oder den Code eintippen.");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, router]);

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) router.push(`/inventory/code/${encodeURIComponent(extractCode(code))}`);
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code scannen oder eingeben (OVMASF…)"
          aria-label="Inventarcode"
          className="min-w-0 font-mono"
          autoCapitalize="characters"
        />
        <Button type="submit" variant="outline">
          Öffnen
        </Button>
        {supported ? (
          <Button type="button" onClick={() => setOpen((o) => !o)} aria-label="Mit Kamera scannen">
            {open ? <X className="size-4" /> : <ScanLine className="size-4" />}
            <span className="hidden sm:inline">{open ? "Schließen" : "Kamera"}</span>
          </Button>
        ) : null}
      </form>
      {open ? (
        <div className="overflow-hidden rounded-lg border bg-black">
          <video ref={video} className="aspect-video w-full object-cover" muted playsInline />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
