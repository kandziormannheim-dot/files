import type { Metadata } from "next";
import { cookies } from "next/headers";
import { clampOffset, labelDensity, labelFormat, labelsPerPage, LABEL_FORMATS } from "@/lib/label-formats";
import { requireUser } from "@/server/auth/session";
import { code128Svg, qrSvg } from "@/server/barcode";
import { appUrl } from "@/server/ov";
import { itemsForLabels } from "@/server/services/inventory";
import { FormatSelect, PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Etiketten" };

type SP = { ids?: string; skip?: string; format?: string; copies?: string; dx?: string; dy?: string };

/**
 * Etiketten drucken in wählbarem Format (A4-Bögen verschiedener Hersteller oder Etikettendrucker).
 * Je Etikett: Bezeichnung, Code-128-Barcode mit Klartext und QR-Code zum Öffnen am Handy – je nach Größe mehr oder weniger.
 * Das zuletzt gewählte Format merkt sich der Browser (Cookie „labelFormat“).
 */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const jar = await cookies();
  const f = labelFormat(sp.format ?? jar.get("labelFormat")?.value);
  const density = labelDensity(f);
  const perPage = labelsPerPage(f);
  const items = await itemsForLabels(user, (sp.ids ?? "").split(",").filter(Boolean));
  const copies = Math.min(Math.max(Math.floor(Number(sp.copies) || 1), 1), 20);
  const skip = f.roll ? 0 : Math.min(Math.max(Math.floor(Number(sp.skip) || 0), 0), perPage - 1);
  const dx = clampOffset(sp.dx);
  const dy = clampOffset(sp.dy);
  const base = appUrl();

  const labels = items.flatMap((i) => Array.from({ length: copies }, (_, n) => ({ item: i, n })));
  const cells: ((typeof labels)[number] | null)[] = [...Array(skip).fill(null), ...labels];
  const pages: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += perPage) pages.push(cells.slice(i, i + perPage));
  if (pages.length === 0) pages.push([]);

  const qrSize = density === "gross" ? 28 : Math.min(16, f.label.height - 8);
  const barHeight = density === "klein" ? Math.max(6, f.label.height - 9) : density === "gross" ? 16 : 11;
  const fs = density === "gross" ? 12 : 8.5;

  return (
    <>
      <style>{`
        @page { size: ${f.page.width}mm ${f.page.height}mm; margin: 0; }
        .blatt { box-sizing: border-box; width: ${f.page.width}mm; height: ${f.page.height}mm; margin: 0 auto; overflow: hidden; break-after: page; page-break-after: always; }
        .blatt:last-child { break-after: auto; page-break-after: auto; }
        .bogen { padding: ${f.margin.top + dy}mm 0 0 ${f.margin.left + dx}mm; display: grid; grid-template-columns: repeat(${f.cols}, ${f.label.width}mm); grid-auto-rows: ${f.label.height}mm; column-gap: ${f.gap.x}mm; row-gap: ${f.gap.y}mm; }
        .etikett { box-sizing: border-box; padding: ${density === "klein" ? "1.5mm 2mm" : density === "gross" ? "5mm 6mm" : "3mm 3.5mm"}; display: grid; grid-template-columns: 1fr ${density === "klein" ? "" : `${qrSize}mm`}; grid-template-rows: auto 1fr auto; gap: 0 2mm; overflow: hidden; font-family: Inter, Arial, sans-serif; color: #000; }
        .etikett .name { grid-column: 1 / -1; font-size: ${fs}pt; font-weight: 800; line-height: 1.15; max-height: ${density === "gross" ? "3.5em" : "2.3em"}; overflow: hidden; }
        .etikett .meta { grid-column: 1; font-size: 8pt; line-height: 1.3; color: #2d3c4b; }
        .etikett .bar { grid-column: 1; align-self: center; height: ${barHeight}mm; }
        .etikett .bar svg { width: 100%; height: 100%; }
        .etikett .qr { grid-column: 2; grid-row: 2 / 4; align-self: center; width: ${qrSize}mm; height: ${qrSize}mm; }
        .etikett .qr svg { width: 100%; height: 100%; }
        .etikett .code { grid-column: 1; font-family: ui-monospace, Menlo, monospace; font-size: ${density === "klein" ? 7 : density === "gross" ? 11 : 8}pt; font-weight: 700; letter-spacing: .02em; }
        .etikett .ov { font-size: ${density === "gross" ? 8 : 6}pt; color: #2d3c4b; font-weight: 400; }
        ${density === "kompakt" ? `
        .etikett { padding: 2mm 2.5mm; grid-template-columns: 1fr 12mm; grid-template-rows: 12mm auto auto; gap: .8mm 1.5mm; }
        .etikett .name { grid-column: 1; grid-row: 1; font-size: 7.5pt; line-height: 1.15; max-height: 3.45em; }
        .etikett .ov { font-size: 5.5pt; }
        .etikett .qr { grid-column: 2; grid-row: 1; width: 12mm; height: 12mm; align-self: start; }
        .etikett .bar { grid-column: 1 / -1; grid-row: 2; height: 8mm; }
        .etikett .code { grid-column: 1 / -1; grid-row: 3; font-size: 7.5pt; text-align: center; }` : ""}
        @media screen { body { background: #e8ecec; } .blatt { background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.15); margin: 16px auto; } .etikett { outline: 1px dashed #ccc; } }
        @media print { .no-print { display: none !important; } body { margin: 0; } }
      `}</style>
      <div className="no-print mx-auto flex max-w-[210mm] flex-col gap-3 bg-white p-4 text-sm shadow-sm">
        <form className="flex flex-wrap items-end gap-3" action="/inventory/labels">
          {sp.ids ? <input type="hidden" name="ids" value={sp.ids} /> : null}
          <label className="flex flex-col gap-1">
            <span className="font-medium">Druckformat</span>
            <FormatSelect value={f.key} options={LABEL_FORMATS.map((o) => ({ key: o.key, name: o.name, hint: o.hint }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Etiketten je Gegenstand</span>
            <input name="copies" type="number" min={1} max={20} defaultValue={copies} className="w-20 rounded border px-2 py-1" />
          </label>
          {f.roll ? null : (
            <label className="flex flex-col gap-1">
              <span className="font-medium">Freie Plätze überspringen</span>
              <input name="skip" type="number" min={0} max={perPage - 1} defaultValue={skip} className="w-20 rounded border px-2 py-1" />
            </label>
          )}
          <details className="self-center">
            <summary className="cursor-pointer">Versatz</summary>
            <div className="mt-2 flex gap-2">
              <label className="flex flex-col gap-1">
                <span>links/rechts (mm)</span>
                <input name="dx" type="number" step="0.5" min={-10} max={10} defaultValue={dx} className="w-20 rounded border px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1">
                <span>oben/unten (mm)</span>
                <input name="dy" type="number" step="0.5" min={-10} max={10} defaultValue={dy} className="w-20 rounded border px-2 py-1" />
              </label>
            </div>
          </details>
          <button className="rounded border px-3 py-1">Übernehmen</button>
          <PrintButton />
        </form>
        <p className="text-neutral-600">
          {labels.length} Etikett{labels.length === 1 ? "" : "en"} auf {pages.length} {f.roll ? "Etikett(en)" : pages.length === 1 ? "Bogen" : "Bögen"} · {f.hint}.
          Beim Drucken „Tatsächliche Größe / 100 %“ und keine Ränder wählen{f.roll ? "; im Druckdialog den Etikettendrucker und das passende Papierformat einstellen" : ""}.
        </p>
      </div>
      {pages.map((cellsOnPage, p) => (
        <div className="blatt" key={p}>
          <div className="bogen">
            {cellsOnPage.map((c, idx) =>
              c ? (
                <div className="etikett" key={`${c.item.id}-${c.n}`}>
                  {density === "klein" ? null : (
                    <div className="name">
                      {c.item.name} <span className="ov">· CDU Seckenheim-Friedrichsfeld</span>
                    </div>
                  )}
                  {density === "gross" && (c.item.location || c.item.category) ? (
                    <div className="meta">
                      {[c.item.category, c.item.location ? `Standort: ${c.item.location}` : ""].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                  <div className="bar" dangerouslySetInnerHTML={{ __html: code128Svg(c.item.code) }} />
                  {density === "klein" ? null : <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg(`${base}/inventory/code/${c.item.code}`) }} />}
                  <div className="code">{c.item.code}</div>
                </div>
              ) : (
                <div className="etikett" key={`leer-${p}-${idx}`} />
              ),
            )}
          </div>
        </div>
      ))}
    </>
  );
}
