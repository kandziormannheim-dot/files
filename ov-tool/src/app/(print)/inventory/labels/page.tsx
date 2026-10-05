import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { code128Svg, qrSvg } from "@/server/barcode";
import { appUrl } from "@/server/ov";
import { itemsForLabels } from "@/server/services/inventory";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Etiketten" };

/**
 * Etikettenbogen A4 mit 3 × 8 Etiketten à 70 × 37 mm (z. B. Avery Zweckform 3474/3475).
 * Je Etikett: Bezeichnung, Code-128-Barcode mit Klartext und QR-Code zum Öffnen am Handy.
 */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string; skip?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const items = await itemsForLabels(user, (sp.ids ?? "").split(",").filter(Boolean));
  const skip = Math.min(Math.max(Number(sp.skip) || 0, 0), 23);
  const base = appUrl();
  const cells: ((typeof items)[number] | null)[] = [...Array(skip).fill(null), ...items];
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        .bogen { width: 210mm; display: grid; grid-template-columns: repeat(3, 70mm); grid-auto-rows: 37mm; margin: 0 auto; padding: 0; }
        .etikett { box-sizing: border-box; padding: 3mm 3.5mm; display: grid; grid-template-columns: 1fr 16mm; grid-template-rows: auto 1fr auto; gap: 0 2mm; overflow: hidden; font-family: Inter, Arial, sans-serif; }
        .etikett .name { grid-column: 1 / 3; font-size: 8.5pt; font-weight: 800; line-height: 1.15; max-height: 2.3em; overflow: hidden; }
        .etikett .bar { grid-column: 1; align-self: center; height: 11mm; }
        .etikett .bar svg { width: 100%; height: 100%; }
        .etikett .qr { grid-column: 2; grid-row: 2 / 4; align-self: center; width: 16mm; height: 16mm; }
        .etikett .qr svg { width: 100%; height: 100%; }
        .etikett .code { grid-column: 1; font-family: ui-monospace, Menlo, monospace; font-size: 8pt; font-weight: 700; letter-spacing: .02em; }
        .etikett .ov { font-size: 6pt; color: #2d3c4b; font-weight: 400; }
        @media screen { .bogen { box-shadow: 0 0 0 1px #ddd; margin-top: 16px; } .etikett { outline: 1px dashed #ccc; } }
        @media print { .no-print { display: none !important; } body { margin: 0; } }
      `}</style>
      <div className="no-print mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <p>
          {items.length} Etikett{items.length === 1 ? "" : "en"} · Bogen 3 × 8 (70 × 37 mm). Beim Drucken „Tatsächliche Größe/100 %“ wählen.
        </p>
        <form className="flex items-center gap-2" action="/inventory/labels">
          {sp.ids ? <input type="hidden" name="ids" value={sp.ids} /> : null}
          <label htmlFor="skip">Freie Plätze überspringen:</label>
          <input id="skip" name="skip" type="number" min={0} max={23} defaultValue={skip} className="w-16 rounded border px-2 py-1" />
          <button className="rounded border px-3 py-1">Übernehmen</button>
          <PrintButton />
        </form>
      </div>
      <div className="bogen">
        {cells.map((i, idx) =>
          i ? (
            <div className="etikett" key={i.id}>
              <div className="name">
                {i.name} <span className="ov">· CDU Seckenheim-Friedrichsfeld</span>
              </div>
              <div className="bar" dangerouslySetInnerHTML={{ __html: code128Svg(i.code) }} />
              <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg(`${base}/inventory/code/${i.code}`) }} />
              <div className="code">{i.code}</div>
            </div>
          ) : (
            <div className="etikett" key={`leer-${idx}`} />
          ),
        )}
      </div>
    </>
  );
}
