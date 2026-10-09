"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { autoStartAction } from "../actions";

type Item = { name: string; size: number; done: number; state: "wartet" | "lädt" | "fertig" | "fehler"; error?: string };

const CHUNK = 32 * 1024 * 1024; // muss zu CHUNK_BYTES im Server passen
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`;

async function uploadFile(projectId: string, file: File, onProgress: (bytes: number) => void) {
  const uploadId = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  for (let i = 0; i < total; i++) {
    const start = i * CHUNK;
    const chunk = file.slice(start, Math.min(file.size, start + CHUNK));
    let attempt = 0;
    for (;;) {
      try {
        const res = await fetch(`/api/video/${projectId}/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x-upload-id": uploadId,
            "x-chunk-index": String(i),
            "x-chunk-total": String(total),
            "x-chunk-offset": String(start),
            "x-file-name": encodeURIComponent(file.name),
            "x-file-size": String(file.size),
          },
          body: chunk,
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          // Nutzerfehler (400/403/404) nicht wiederholen
          if (res.status < 500) throw Object.assign(new Error(json.error ?? "Upload fehlgeschlagen."), { final: true });
          throw new Error(json.error ?? "Upload fehlgeschlagen.");
        }
        break;
      } catch (err) {
        attempt += 1;
        if ((err as { final?: boolean }).final || attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt)); // kurz warten (Funkloch) und Abschnitt erneut senden
      }
    }
    onProgress(Math.min(file.size, start + chunk.size));
  }
}

export function Uploader({ projectId, autoStart, disabled }: { projectId: string; autoStart: boolean; disabled?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setItems(list.map((f) => ({ name: f.name, size: f.size, done: 0, state: "wartet" })));
    setBusy(true);
    let ok = 0;
    for (const [i, file] of list.entries()) {
      const set = (patch: Partial<Item>) => setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it)));
      set({ state: "lädt" });
      try {
        await uploadFile(projectId, file, (done) => set({ done }));
        set({ state: "fertig", done: file.size });
        ok += 1;
      } catch (err) {
        set({ state: "fehler", error: (err as Error).message });
      }
    }
    if (input.current) input.current.value = "";
    setBusy(false);
    if (ok && autoStart) {
      const r = await autoStartAction(projectId);
      if (r.ok) toast.success("Clips hochgeladen – das Video wird jetzt automatisch geschnitten.");
      else toast.error(r.error ?? "Schnitt konnte nicht gestartet werden.");
    } else if (ok) {
      toast.success(`${ok} Clip${ok === 1 ? "" : "s"} hochgeladen. Mit „Neu schneiden lassen“ fließen sie in den Schnitt ein.`);
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={input} type="file" accept="video/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <Button type="button" variant="outline" className="self-start" disabled={busy || disabled} onClick={() => input.current?.click()}>
        <Upload className="size-4" /> {busy ? "Wird hochgeladen …" : "Clips auswählen"}
      </Button>
      {items.length ? (
        <ul className="flex flex-col gap-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2">
                <span className="truncate">{it.name}</span>
                <span className={it.state === "fehler" ? "text-red-700" : "text-neutral-600"}>
                  {it.state === "lädt" ? `${mb(it.done)} / ${mb(it.size)}` : it.state === "fehler" ? "Fehler" : it.state}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-neutral-200">
                <div className={`h-full ${it.state === "fehler" ? "bg-red-600" : "bg-akzent"}`} style={{ width: `${it.size ? Math.round((100 * it.done) / it.size) : 0}%` }} />
              </div>
              {it.error ? <p className="text-xs text-red-700">{it.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-neutral-600">
        Bis zu 12 Clips, je höchstens 2 GB und 15 Minuten. Große Dateien werden in Teilen übertragen – bei kurzem Verbindungsabbruch geht es automatisch weiter. Am Handy
        die Seite während des Hochladens geöffnet lassen.
      </p>
    </div>
  );
}
