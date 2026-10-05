"use client";

import { BookOpen, Copy, ExternalLink, MessageCircleQuestion, Search, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import data from "@/data/statutes.json";
import {
  citation,
  findSection,
  highlight,
  searchStatutes,
  snippet,
  type StatuteData,
  type StatuteDocument,
  type StatuteSection,
} from "@/lib/statute-search";
import { cn } from "@/lib/utils";
import { askStatuteAction } from "./actions";

const statutes = data as StatuteData;

const FILTERS: { key: string; label: string; ids?: string[] }[] = [
  { key: "alle", label: "Alle" },
  { key: "lv", label: "Landessatzung BW", ids: ["lv-satzung", "lv-verfahrensordnung", "lv-finanzordnung"] },
  { key: "statut", label: "Statut CDU", ids: ["statut"] },
  { key: "bund", label: "Bundesordnungen", ids: ["go-cdu", "fbo", "pgo", "dso", "bfao"] },
  { key: "partg", label: "Parteiengesetz", ids: ["partg"] },
];

const DISCLAIMER = "Auslegungshilfe, keine Rechtsberatung – im Zweifel die Kreisgeschäftsstelle fragen.";

type Answer = {
  answer: string;
  covered: boolean;
  sources: { docId: string; num: string; absatz: string | null; label: string; stand: string }[];
};

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-union-gold/30 px-0.5 text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function SectionView({
  doc,
  section,
  terms,
  activeAbsatz,
}: {
  doc: StatuteDocument;
  section: StatuteSection;
  terms: string[];
  activeAbsatz?: number;
}) {
  function copy() {
    const text = `${citation(doc, section)} (${section.title})\n${section.absaetze.map((a) => (a.nr ? `(${a.nr}) ${a.text}` : a.text)).join("\n")}\nQuelle: ${doc.title}, Stand ${doc.stand}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Paragraph kopiert"),
      () => toast.error("Kopieren nicht möglich"),
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {section.absaetze.map((a, i) => (
        <p
          key={i}
          className={cn(
            "whitespace-pre-line rounded-md text-[15px] leading-relaxed text-rhoendorf",
            activeAbsatz === i && section.absaetze.length > 1 ? "-mx-2 bg-cadenabbia/10 px-2 py-1" : "",
          )}
        >
          {a.nr ? <span className="mr-1 font-semibold">({a.nr})</span> : null}
          <Highlighted text={a.text} terms={terms} />
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
        <span>
          {doc.title} · Stand {doc.stand}
        </span>
        <a href={doc.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
          Quelle <ExternalLink className="size-3" />
        </a>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={copy}>
          <Copy className="size-4" /> Kopieren
        </Button>
      </div>
    </div>
  );
}

function ResultCard({
  docId,
  num,
  absatz,
  terms,
  open,
  onToggle,
}: {
  docId: string;
  num: string;
  absatz: number;
  terms: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const found = findSection(statutes, docId, num);
  if (!found) return null;
  const { doc, section } = found;
  const best = section.absaetze[absatz] ?? section.absaetze[0];
  return (
    <Card id={`${docId}-${num}`} className="scroll-mt-20">
      <CardContent className="flex flex-col gap-2 p-4">
        <button type="button" onClick={onToggle} className="flex flex-col items-start gap-1 text-left" aria-expanded={open}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={doc.level === "Land" ? "default" : "secondary"}>{doc.short}</Badge>
            <span className="text-base font-extrabold text-rhoendorf">
              § {section.num.replace(/([a-z])$/, " $1")} {section.title}
            </span>
          </div>
          {section.part ? <span className="font-serif text-xs text-neutral-500">{section.part}</span> : null}
          {!open && best ? (
            <span className="text-sm text-neutral-700">
              {best.nr && section.absaetze.length > 1 ? <span className="font-semibold">({best.nr}) </span> : null}
              <Highlighted text={snippet(best.text, terms)} terms={terms} />
            </span>
          ) : null}
        </button>
        {open ? <SectionView doc={doc} section={section} terms={terms} activeAbsatz={absatz} /> : null}
      </CardContent>
    </Card>
  );
}

function TableOfContents({ docs, onOpen }: { docs: StatuteDocument[]; onOpen: (q: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {docs.map((doc) => {
        const parts: { part: string | null; sections: StatuteSection[] }[] = [];
        for (const s of doc.sections) {
          const last = parts[parts.length - 1];
          if (last && last.part === s.part) last.sections.push(s);
          else parts.push({ part: s.part, sections: [s] });
        }
        return (
          <details key={doc.id} className="group min-w-0 rounded-lg border border-neutral-200 bg-white p-4" open={doc.id === "lv-satzung"}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-start gap-2">
                <BookOpen className="mt-0.5 size-5 shrink-0 text-cadenabbia" />
                <div className="min-w-0">
                  <div className="font-extrabold text-rhoendorf">{doc.title}</div>
                  <div className="font-serif text-xs text-neutral-500">
                    Stand {doc.stand} · {doc.sections.length} Paragraphen
                  </div>
                </div>
              </div>
            </summary>
            <div className="mt-3 flex flex-col gap-3 text-sm">
              {parts.map((p, i) => (
                <div key={i}>
                  {p.part ? <div className="mb-1 font-semibold text-rhoendorf">{p.part}</div> : null}
                  <ul className="flex flex-col gap-0.5">
                    {p.sections.map((s) => (
                      <li key={s.num}>
                        <button type="button" className="text-left text-neutral-700 hover:text-rhoendorf hover:underline" onClick={() => onOpen(`${doc.short} § ${s.num}`)}>
                          § {s.num.replace(/([a-z])$/, " $1")} {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function StatuteBrowser({ initialQuery, canAsk, aiEnabled }: { initialQuery: string; canAsk: boolean; aiEnabled: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("alle");
  const [manualOpen, setManualOpen] = useState<{ query: string; key: string | null } | null>(null);
  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const [offlineReady, setOfflineReady] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, startAsking] = useTransition();

  const ids = FILTERS.find((f) => f.key === filter)?.ids;
  const hits = useMemo(() => (query.trim() ? searchStatutes(statutes, query, { docIds: ids, limit: 30 }) : []), [query, ids]);
  const terms = hits[0]?.terms ?? [];

  // Direkttreffer (Fundstelle) sofort aufklappen
  const firstKey = hits[0] && hits[0].score >= 900 ? `${hits[0].docId}:${hits[0].num}` : null;
  const openKey = manualOpen && manualOpen.query === query ? manualOpen.key : firstKey;
  const setOpenKey = (key: string | null) => setManualOpen({ query, key });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, [query]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false));
    }
  }, []);

  function ask() {
    startAsking(async () => {
      setAnswer(null);
      const res = await askStatuteAction(question);
      if (!res?.ok) {
        toast.error(res?.error ?? "Die Frage konnte nicht beantwortet werden.");
        return;
      }
      setAnswer(res.data as unknown as Answer);
    });
  }

  const docs = statutes.documents.filter((d) => !ids || ids.includes(d.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="z. B. Ladungsfrist, Stichwahl, Beschlussfähigkeit oder „LV § 57 Abs. 3“"
            className="h-11 pl-9 text-base"
            aria-label="Satzung durchsuchen"
            autoFocus={!initialQuery}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button key={f.key} type="button" size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
          <span className="ml-auto flex items-center gap-2 text-xs text-neutral-600">
            {!online ? (
              <Badge variant="secondary">
                <WifiOff className="size-3" /> offline
              </Badge>
            ) : null}
            {offlineReady ? <span>auch offline verfügbar</span> : null}
          </span>
        </div>
      </div>

      {canAsk ? (
        <Card className="border-cadenabbia/40">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2 font-extrabold text-rhoendorf">
              <MessageCircleQuestion className="size-5 text-cadenabbia" /> Frage an den Satzungs-Assistenten
            </div>
            {aiEnabled ? (
              <>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="z. B. Wie lange vorher muss ich zur Mitgliederversammlung einladen?"
                  aria-label="Frage zur Satzung"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={ask} disabled={asking || question.trim().length < 8 || !online}>
                    {asking ? "Sucht und antwortet …" : "Fragen"}
                  </Button>
                  <span className="font-serif text-xs text-neutral-600">Antwortet nur auf Grundlage der gefundenen Paragraphen, mit Fundstelle. {online ? "" : "Benötigt Internet."}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-600">Der Assistent wird aktiv, sobald ein ANTHROPIC_API_KEY auf dem Server hinterlegt ist. Die Suche funktioniert bereits.</p>
            )}
            {answer ? (
              <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3">
                {!answer.covered ? (
                  <Alert>
                    <AlertDescription>Die gefundenen Paragraphen beantworten die Frage nicht vollständig.</AlertDescription>
                  </Alert>
                ) : null}
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-rhoendorf">{answer.answer}</p>
                {answer.sources.length ? (
                  <div className="flex flex-wrap gap-2">
                    {answer.sources.map((s) => (
                      <Button key={`${s.docId}:${s.num}`} type="button" size="sm" variant="outline" onClick={() => setQuery(`${s.label}`)}>
                        {s.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <p className="font-serif text-xs text-neutral-600">{DISCLAIMER}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {query.trim() ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            {hits.length === 0 ? "Keine Treffer. Andere Begriffe oder eine Fundstelle wie „Statut § 43“ versuchen." : `${hits.length} Treffer`}
          </p>
          {hits.map((h) => {
            const key = `${h.docId}:${h.num}`;
            return (
              <ResultCard
                key={key}
                docId={h.docId}
                num={h.num}
                absatz={h.absatz}
                terms={terms}
                open={openKey === key}
                onToggle={() => setOpenKey(openKey === key ? null : key)}
              />
            );
          })}
        </div>
      ) : (
        <TableOfContents docs={docs} onOpen={setQuery} />
      )}

      <p className="font-serif text-xs text-neutral-600">
        Texte aus den amtlichen Fassungen (Statutenbroschüre der CDU Deutschlands, Stand 21.02.2026; Satzung, Verfahrens- und Finanzordnung der CDU
        Baden-Württemberg, Stand 27.04.2024), maschinell nach Paragraph und Absatz gegliedert. Maßgeblich ist der amtliche Text. {DISCLAIMER}
      </p>
    </div>
  );
}
