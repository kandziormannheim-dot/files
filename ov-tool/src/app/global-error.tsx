"use client";

import { useEffect } from "react";

// Letzte Auffangstelle: nach einem Update veraltete Seiten automatisch neu laden, sonst Hinweis anzeigen.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = /Server Action|failed-to-find-server-action|ChunkLoadError|Loading chunk/i.test(error.message);
  useEffect(() => {
    if (stale && !sessionStorage.getItem("reloaded-after-deploy")) {
      sessionStorage.setItem("reloaded-after-deploy", "1");
      window.location.reload();
    }
  }, [stale]);
  return (
    <html lang="de">
      <body style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24, color: "#2d3c4b" }}>
        <h1 style={{ fontWeight: 800 }}>Es ist ein Fehler aufgetreten</h1>
        <p>{stale ? "Die Anwendung wurde aktualisiert. Bitte die Seite neu laden." : "Bitte erneut versuchen."}</p>
        <button onClick={() => (stale ? window.location.reload() : reset())} style={{ padding: "8px 16px", background: "#2d3c4b", color: "#fff", border: 0, borderRadius: 6 }}>
          Neu laden
        </button>
      </body>
    </html>
  );
}
