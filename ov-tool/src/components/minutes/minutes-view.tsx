import { formatDate, formatDateLong, formatTime } from "@/lib/dates";
import { PRESENCE_LABELS } from "@/lib/meetings";
import type { MinutesContext } from "@/server/services/minutes-export";

/** Leseansicht des Protokolls in der App (gleiche Struktur wie PDF/DOCX). */
export function MinutesView({ ctx }: { ctx: MinutesContext }) {
  const s = ctx.sitzung;
  const pr = ctx.protokoll;
  const f = pr.formalia;
  const quorum = s.wiederholungNachBeschlussunfaehigkeit
    ? "gegeben gemäß § 52 Abs. 3 LV-Satzung (erneute Einladung nach Beschlussunfähigkeit)"
    : s.beschlussfaehig
      ? `festgestellt durch ${s.feststellungDurch}`
      : "nicht gegeben – die Sitzung wurde gemäß § 52 Abs. 3 LV-Satzung aufgehoben";
  const h2 = "mt-6 mb-2 border-b-2 border-akzent pb-1 font-semibold";
  return (
    <article className="rounded-lg border bg-white p-4 text-sm md:p-6">
      <h1 className="text-lg font-bold">Protokoll der {s.artGenitiv}</h1>
      <p className="mb-4">{ctx.ov.nameLang}</p>
      {pr.aenderungshinweis ? (
        <p className="mb-2 text-xs text-neutral-600">
          Version {pr.version} – {pr.aenderungshinweis}
        </p>
      ) : null}
      <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1">
        <dt className="font-semibold">Datum</dt>
        <dd>{formatDateLong(s.beginn)}</dd>
        <dt className="font-semibold">Ort</dt>
        <dd>{[s.ort, s.onlineLink ? "online" : ""].filter(Boolean).join(" / ")}</dd>
        <dt className="font-semibold">Beginn / Ende</dt>
        <dd>
          {formatTime(s.eroeffnetUm)} Uhr{s.unterbrechung ? ` (${s.unterbrechung})` : ""} bis {formatTime(s.geschlossenUm) || "–"} Uhr
        </dd>
        <dt className="font-semibold">Sitzungsleitung</dt>
        <dd>{s.sitzungsleitung || "–"}</dd>
        <dt className="font-semibold">Protokollführung</dt>
        <dd>{pr.protokollfuehrung || "–"}</dd>
        <dt className="font-semibold">Einladung vom</dt>
        <dd>
          {formatDate(s.einladungVom)}, {s.einladungsweg}
        </dd>
      </dl>

      <h2 className={h2}>Anwesenheit</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-akzent-hell text-left">
            <tr>
              <th className="p-1.5">Name</th>
              <th className="p-1.5">Funktion</th>
              <th className="p-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {ctx.anwesenheit.map((a, i) => (
              <tr key={`${a.name}-${i}`} className="border-b">
                <td className="p-1.5">{a.name}</td>
                <td className="p-1.5">{a.funktion}</td>
                <td className="p-1.5">{PRESENCE_LABELS[a.status as keyof typeof PRESENCE_LABELS] ?? a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={h2}>Formalia</h2>
      <div className="flex flex-col gap-1">
        {f.eroeffnung ? <p><strong>Eröffnung:</strong> {f.eroeffnung}</p> : null}
        {f.wiedereroeffnung ? <p><strong>Wiedereröffnung:</strong> {f.wiedereroeffnung}</p> : null}
        <p>
          <strong>Beschlussfähigkeit:</strong> {quorum} ({s.quorumAnwesend} von {s.quorumStimmberechtigt} stimmberechtigten Mitgliedern anwesend)
        </p>
        {s.eilbeduerftig ? <p><strong>Verkürzte Ladungsfrist:</strong> {s.eilbeduerftigBegruendung}</p> : null}
        {ctx.umlaufbeschluesse.length ? (
          <p>
            <strong>Umlaufbeschlüsse seit der letzten Sitzung:</strong>{" "}
            {ctx.umlaufbeschluesse.map((u) => `Nr. ${u.nummer} „${u.betreff}“ – ${u.ergebnisText}`).join("; ")}
          </p>
        ) : null}
        <p><strong>Tagesordnung:</strong> {f.tagesordnung || "–"}</p>
        {f.letztesProtokoll ? <p><strong>Protokoll der letzten Sitzung:</strong> {f.letztesProtokoll}</p> : null}
      </div>

      <h2 className={h2}>Verlauf der Sitzung</h2>
      {pr.abschnitte.map((a) => (
        <section key={a.topNummer} className="mb-3">
          <p className="grid grid-cols-[4.5rem_1fr] font-semibold">
            <span>TOP {a.topNummer}</span>
            <span>{a.topTitel}</span>
          </p>
          <ul className="ml-[4.5rem] flex flex-col gap-0.5">
            {a.punkte.map((pt, i) => (
              <li key={i}>
                – {pt.text}
                {pt.unterpunkte.length ? (
                  <ul className="ml-4">
                    {pt.unterpunkte.map((u, j) => (
                      <li key={j}>· {u}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          {a.ergebnis ? (
            <p className="mt-1 ml-[4.5rem] font-semibold">
              {a.ergebnis.art === "BESCHLUSS" ? "Beschluss:" : "Ergebnis:"} {a.ergebnis.text}
            </p>
          ) : null}
        </section>
      ))}

      {ctx.beschluesse.length ? (
        <>
          <h2 className={h2}>Beschlüsse und Ergebnisse im Überblick</h2>
          <table className="w-full">
            <thead className="bg-akzent-hell text-left">
              <tr>
                <th className="p-1.5">TOP</th>
                <th className="p-1.5">Gegenstand</th>
                <th className="p-1.5">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {ctx.beschluesse.map((b, i) => (
                <tr key={i} className="border-b">
                  <td className="p-1.5">{b.top}</td>
                  <td className="p-1.5">{b.gegenstand}</td>
                  <td className="p-1.5">{b.ergebnisText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {ctx.aufgaben.length ? (
        <>
          <h2 className={h2}>Aufgaben</h2>
          <table className="w-full">
            <thead className="bg-akzent-hell text-left">
              <tr>
                <th className="p-1.5">Nr.</th>
                <th className="p-1.5">Aufgabe</th>
                <th className="p-1.5">Verantwortlich</th>
                <th className="p-1.5">Frist</th>
              </tr>
            </thead>
            <tbody>
              {ctx.aufgaben.map((t) => (
                <tr key={t.nr} className="border-b">
                  <td className="p-1.5">{t.nr}</td>
                  <td className="p-1.5">{t.titel}</td>
                  <td className="p-1.5">{t.verantwortlich}</td>
                  <td className="p-1.5">{t.frist}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <p className="mt-4">
        <strong>Ende der Sitzung:</strong> {formatTime(s.geschlossenUm) || "–"} Uhr
      </p>
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {pr.unterzeichner.map((u) => (
          <div key={u.name}>
            <p>{ctx.ov.ort}, ________________</p>
            <p className="mt-10 border-t border-neutral-800 pt-1">
              <strong>{u.name}</strong>
              <br />
              {u.funktion}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
