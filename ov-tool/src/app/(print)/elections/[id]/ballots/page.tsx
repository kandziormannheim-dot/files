import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/app/(print)/inventory/labels/print-button";
import { formatDate } from "@/lib/dates";
import { ballotInstruction } from "@/lib/election-flow";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getElection, positionStep } from "@/server/services/elections";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Stimmzettel" };

// Farbband je Wahlgang, damit Stimmzettel verschiedener Wahlgänge nicht verwechselt werden (SPEC.md 3.12)
const BAND: Record<string, string> = { "WAHLGANG-1": "#52b7c1", "WAHLGANG-2": "#ffa600", STICHWAHL: "#bf111b" };

type Ballot = { key: string; position: string; label: string; band: string; names: string[]; single: boolean; instruction: string };

/** Stimmzettel A6 (4 je A4-Seite), alphabetisch, mit Gültigkeitshinweis – LV-Satzung § 57. */
export default async function BallotsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ position?: string; n?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  let election;
  try {
    election = await getElection(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const settings = await getSettings();
  const copies = Math.min(Math.max(Number(sp.n) || 4, 1), 200);
  const ballots: Ballot[] = [];
  for (const p of election.positions) {
    if (sp.position && p.id !== sp.position) continue;
    const step = positionStep(p);
    if (step.done || step.stage === "LOS") continue;
    if (!sp.position && step.round !== 1) continue;
    const names = step.candidateIds
      .map((cid) => p.candidates.find((c) => c.id === cid)?.name ?? "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));
    if (names.length === 0) continue;
    const seats = step.stage === "STICHWAHL" ? step.seats : p.seats;
    const mode = step.stage === "STICHWAHL" && p.mode === "SAMMEL" && seats === 1 ? "EINZEL" : p.mode;
    const band = step.stage === "STICHWAHL" ? BAND.STICHWAHL! : BAND[`WAHLGANG-${step.round}`] ?? BAND["WAHLGANG-1"]!;
    for (let i = 0; i < copies; i++) {
      ballots.push({
        key: `${p.id}-${i}`,
        position: p.title + (mode === "SAMMEL" ? ` (${seats} ${seats === 1 ? "Platz" : "Plätze"})` : ""),
        label: step.label,
        band,
        names,
        single: mode === "EINZEL" && names.length === 1,
        instruction: ballotInstruction(mode, seats, names.length),
      });
    }
  }

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        .bogen { width: 210mm; display: grid; grid-template-columns: repeat(2, 105mm); grid-auto-rows: 148.5mm; margin: 0 auto; }
        .zettel { box-sizing: border-box; padding: 8mm 9mm; border: 0.2mm dashed #bbb; display: flex; flex-direction: column; gap: 3mm; font-family: Inter, Arial, sans-serif; color: #1b191d; overflow: hidden; break-inside: avoid; }
        .band { height: 4mm; margin: -8mm -9mm 2mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .kopf { font-size: 7.5pt; color: #2d3c4b; }
        .titel { font-size: 13pt; font-weight: 800; line-height: 1.15; color: #2d3c4b; }
        .gang { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
        .namen { display: flex; flex-direction: column; gap: 2.4mm; margin-top: 2mm; }
        .zeile { display: flex; align-items: center; gap: 3mm; font-size: 11.5pt; }
        .kreis { width: 6mm; height: 6mm; border: 0.4mm solid #1b191d; border-radius: 50%; flex-shrink: 0; }
        .hinweis { margin-top: auto; font-size: 7pt; color: #444; line-height: 1.3; }
        @media screen { .bogen { margin-top: 16px; box-shadow: 0 0 0 1px #ddd; } }
        @media print { .no-print { display: none !important; } body { margin: 0; } .zettel { border-color: #ddd; } }
      `}</style>
      <div className="no-print mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <p>
          {ballots.length} Stimmzettel (A6, 4 je Seite). Zum Schneiden entlang der gestrichelten Linien. Farbband: Türkis = 1. Wahlgang, Gold = 2. Wahlgang, Rot =
          Stichwahl.
        </p>
        <form className="flex items-center gap-2">
          {sp.position ? <input type="hidden" name="position" value={sp.position} /> : null}
          <label htmlFor="n">Anzahl je Amt:</label>
          <input id="n" name="n" type="number" min={1} max={200} defaultValue={copies} className="w-20 rounded border px-2 py-1" />
          <button className="rounded border px-3 py-1">Übernehmen</button>
          <PrintButton />
        </form>
      </div>
      {ballots.length === 0 ? <p className="no-print p-4 text-center text-sm">Keine Stimmzettel – es fehlen Vorschläge oder die Wahl ist entschieden.</p> : null}
      <div className="bogen">
        {ballots.map((b) => (
          <div key={b.key} className="zettel">
            <div className="band" style={{ background: b.band }} />
            <div className="kopf">
              CDU {settings.ov.name} · {election.title} · {formatDate(election.date)}
            </div>
            <div className="gang" style={{ color: b.band === BAND["WAHLGANG-1"] ? "#2d3c4b" : b.band }}>
              Stimmzettel – {b.label}
            </div>
            <div className="titel">{b.position}</div>
            <div className="namen">
              {b.single ? (
                <>
                  <div className="zeile" style={{ fontWeight: 700 }}>
                    {b.names[0]}
                  </div>
                  {["Ja", "Nein", "Enthaltung"].map((o) => (
                    <div key={o} className="zeile">
                      <span className="kreis" /> {o}
                    </div>
                  ))}
                </>
              ) : (
                b.names.map((n) => (
                  <div key={n} className="zeile">
                    <span className="kreis" /> {n}
                  </div>
                ))
              )}
            </div>
            <div className="hinweis">
              {b.instruction} Geheime Wahl – bitte gefaltet abgeben.
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
