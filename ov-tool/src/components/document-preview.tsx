/**
 * Dokumentvorschau (Einladung, Protokoll) im Briefbogen-Layout – gleiche Vorlage wie das PDF.
 * Als srcDoc in einem iframe ohne Skripte; funktioniert auch auf Handys, die PDFs nicht eingebettet anzeigen.
 */
export function DocumentPreview({ html, title, pdfHref }: { html: string; title: string; pdfHref?: string }) {
  return (
    <details className="group mb-4 rounded-lg border bg-white" open>
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
        <span>Vorschau: {title}</span>
        {pdfHref ? (
          <a href={pdfHref} target="_blank" rel="noopener" className="font-normal underline">
            als PDF öffnen
          </a>
        ) : null}
      </summary>
      <iframe title={`Vorschau ${title}`} srcDoc={html} sandbox="" className="h-[75dvh] w-full rounded-b-lg border-t bg-neutral-100" />
    </details>
  );
}
