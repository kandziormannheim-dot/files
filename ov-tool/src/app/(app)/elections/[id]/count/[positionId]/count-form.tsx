"use client";

import { CloudOff, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { evaluateRound, type NextStep } from "@/lib/election-flow";
import { collectiveVotesPlausible } from "@/server/services/statute";
import type { RoundInput } from "@/server/services/elections";
import { recordLotAction, recordRoundAction } from "../../../actions";

type Candidate = { id: string; name: string };
type Pending = { electionId: string; positionId: string; input: RoundInput; savedAt: string };
const QUEUE_KEY = "ov-election-queue";

function readQueue(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as Pending[];
  } catch {
    return [];
  }
}
function writeQueue(q: Pending[]) {
  try {
    if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Speicher nicht verfügbar – dann bleibt nur der direkte Versand
  }
}

function Counter({ label, value, onChange, strong }: { label: string; value: number; onChange: (n: number) => void; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`min-w-0 flex-1 truncate ${strong ? "font-bold text-rhoendorf" : "text-neutral-700"}`}>{label}</span>
      <Button type="button" size="icon" variant="outline" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`${label} minus eins`}>
        <Minus className="size-4" />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-20 text-center text-lg"
        aria-label={label}
      />
      <Button type="button" size="icon" variant="outline" onClick={() => onChange(value + 1)} aria-label={`${label} plus eins`}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

export function CountForm({
  electionId,
  positionId,
  mode,
  seats,
  sequence,
  presentEligible,
  step,
  candidates,
}: {
  electionId: string;
  positionId: string;
  mode: "EINZEL" | "SAMMEL";
  seats: number;
  sequence: number;
  presentEligible: number | null;
  step: Exclude<NextStep, { done: true }>;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const draftKey = `ov-count-draft-${positionId}-${sequence}`;
  const [cast, setCast] = useState(0);
  const [invalid, setInvalid] = useState(0);
  const [abstentions, setAbstentions] = useState(0);
  const [noVotes, setNoVotes] = useState(0);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [override, setOverride] = useState(false);
  const [queued, setQueued] = useState(0);
  const [lot, setLot] = useState<string[]>([]);
  const [pending, start] = useTransition();

  // Entwurf auf dem Gerät halten (Neuladen ohne Netz)
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (d) {
        // Entwurf aus dem Gerätespeicher übernehmen (externer Zustand, erst nach dem Hydratisieren lesbar)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCast(d.cast ?? 0);
        setInvalid(d.invalid ?? 0);
        setAbstentions(d.abstentions ?? 0);
        setNoVotes(d.noVotes ?? 0);
        setVotes(d.votes ?? {});
      }
    } catch {
      // ignorieren
    }
  }, [draftKey]);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ cast, invalid, abstentions, noVotes, votes }));
    } catch {
      // ignorieren
    }
  }, [draftKey, cast, invalid, abstentions, noVotes, votes]);

  const flush = useCallback(async () => {
    const q = readQueue();
    if (!q.length || !navigator.onLine) {
      setQueued(q.length);
      return;
    }
    const rest: Pending[] = [];
    for (const item of q) {
      try {
        const res = await recordRoundAction(item.electionId, item.positionId, item.input);
        if (res?.ok) toast.success(`Übertragen: ${res.message ?? "Wahlgang"}`);
        else toast.error(`Nicht übernommen: ${res?.error ?? "Fehler"}`);
      } catch {
        rest.push(item);
      }
    }
    writeQueue(rest);
    setQueued(rest.length);
    if (rest.length < q.length) router.refresh();
  }, [router]);

  useEffect(() => {
    // Warteschlange beim Öffnen übertragen (externer Zustand: localStorage und Netz)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  const single = mode === "EINZEL" && candidates.length === 1;
  const valid = cast - invalid - abstentions;
  const candidateSum = candidates.reduce((s, c) => s + (votes[c.id] ?? 0), 0);
  const effectiveMode = mode;

  const problems: string[] = [];
  if (valid < 0) problems.push("Ungültige und Enthaltungen sind mehr als abgegebene Stimmzettel.");
  if (presentEligible != null && cast > presentEligible) problems.push(`Mehr Stimmzettel (${cast}) als anwesende Stimmberechtigte (${presentEligible}).`);
  if (effectiveMode === "EINZEL" && cast > 0 && candidateSum + (single ? noVotes : 0) !== valid) {
    problems.push(`Summe der Stimmen (${candidateSum + (single ? noVotes : 0)}) ≠ gültige Stimmzettel (${valid}).`);
  }
  const implausible = effectiveMode === "SAMMEL" && valid > 0 && !collectiveVotesPlausible(candidateSum, valid, step.seats);

  const preview = useMemo(() => {
    if (step.stage === "LOS" || valid <= 0) return null;
    try {
      return evaluateRound(mode, seats, { stage: step.stage, round: step.round, candidateIds: candidates.map((c) => c.id), noVotes: single ? noVotes : 0, votes }, step.carried);
    } catch {
      return null;
    }
  }, [mode, seats, step, candidates, votes, noVotes, single, valid]);
  const name = (cid: string) => candidates.find((c) => c.id === cid)?.name ?? "?";

  function submit() {
    const input: RoundInput = { sequence, ballotsCast: cast, invalid, abstentions, noVotes: single ? noVotes : 0, votes, override };
    start(async () => {
      const save = () => {
        writeQueue([...readQueue().filter((p) => !(p.positionId === positionId && p.input.sequence === sequence)), { electionId, positionId, input, savedAt: new Date().toISOString() }]);
        setQueued(readQueue().length);
        toast.warning("Kein Netz – Ergebnis auf diesem Gerät gespeichert und wird automatisch übertragen.");
      };
      if (!navigator.onLine) return save();
      try {
        const res = await recordRoundAction(electionId, positionId, input);
        if (!res?.ok) {
          toast.error(res?.error ?? "Konnte nicht gespeichert werden.");
          return;
        }
        localStorage.removeItem(draftKey);
        toast.success(res.message ?? "Gespeichert.");
        router.push(`/elections/${electionId}`);
        router.refresh();
      } catch {
        save();
      }
    });
  }

  function submitLot() {
    start(async () => {
      const res = await recordLotAction(electionId, positionId, lot);
      if (!res?.ok) {
        toast.error(res?.error ?? "Fehler");
        return;
      }
      toast.success("Losentscheid erfasst.");
      router.push(`/elections/${electionId}`);
      router.refresh();
    });
  }

  if (step.stage === "LOS") {
    return (
      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-3 pt-6">
          <p className="text-sm">
            Stimmengleichheit – das Los entscheidet zwischen {candidates.map((c) => c.name).join(", ")} (sofern nicht vorher jemand verzichtet). Bitte{" "}
            {step.seats === 1 ? "die gezogene Person" : `die ${step.seats} gezogenen Personen`} auswählen:
          </p>
          {candidates.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-base">
              <Checkbox checked={lot.includes(c.id)} onChange={(e) => setLot((l) => (e.target.checked ? [...l, c.id] : l.filter((x) => x !== c.id)))} />
              {c.name}
            </label>
          ))}
          <Button type="button" onClick={submitLot} disabled={pending || lot.length !== step.seats} className="self-start">
            Losentscheid speichern
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {queued ? (
            <Alert variant="warning">
              <CloudOff className="size-4" />
              <AlertTitle>{queued} Ergebnis(se) warten auf Übertragung</AlertTitle>
              <AlertDescription>Werden automatisch gesendet, sobald das Gerät wieder online ist.</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-3">
            <h3 className="font-extrabold text-rhoendorf">Stimmzettel</h3>
            <Counter label="abgegeben" value={cast} onChange={setCast} strong />
            <Counter label="ungültig" value={invalid} onChange={setInvalid} />
            <Counter label="Enthaltung" value={abstentions} onChange={setAbstentions} />
            <p className="text-sm text-neutral-600">gültig: <strong>{Math.max(valid, 0)}</strong></p>
          </div>
          <div className="flex flex-col gap-3 border-t pt-4">
            <h3 className="font-extrabold text-rhoendorf">Stimmen {mode === "SAMMEL" ? `(je Stimmzettel ${Math.ceil(step.seats / 2)}–${step.seats} Kreuze)` : ""}</h3>
            {candidates.map((c) => (
              <Counter key={c.id} label={c.name} value={votes[c.id] ?? 0} onChange={(n) => setVotes((v) => ({ ...v, [c.id]: n }))} strong />
            ))}
            {single ? <Counter label="Nein" value={noVotes} onChange={setNoVotes} /> : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {problems.length ? (
          <Alert variant="destructive">
            <AlertTitle>Plausibilität</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {implausible ? (
          <Alert variant="warning">
            <AlertTitle>Stimmensumme ungewöhnlich</AlertTitle>
            <AlertDescription>
              Bei {valid} gültigen Stimmzetteln sind {Math.ceil(step.seats / 2) * valid} bis {step.seats * valid} Stimmen möglich (erfasst: {candidateSum}). Zählung
              prüfen.
              <label className="mt-2 flex items-center gap-2">
                <Checkbox checked={override} onChange={(e) => setOverride(e.target.checked)} /> trotzdem übernehmen
              </label>
            </AlertDescription>
          </Alert>
        ) : null}
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            <h3 className="font-extrabold text-rhoendorf">Ergebnis-Vorschau</h3>
            {preview ? (
              <>
                {"elected" in preview && preview.elected.length && preview.kind === "GEWAEHLT" ? (
                  <p className="text-lg font-bold text-rhoendorf">Gewählt: {preview.elected.map(name).join(", ")}</p>
                ) : null}
                <p className="text-sm text-neutral-700">{preview.text}</p>
              </>
            ) : (
              <p className="text-sm text-neutral-600">Zahlen eingeben – das Ergebnis nach LV-Satzung § 57 erscheint hier.</p>
            )}
          </CardContent>
        </Card>
        <Button type="button" size="lg" onClick={submit} disabled={pending || cast === 0 || problems.length > 0 || (implausible && !override)}>
          {pending ? "Wird gespeichert …" : "Ergebnis feststellen und speichern"}
        </Button>
      </div>
    </div>
  );
}
