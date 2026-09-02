# neos24.com — Relaunch & SEO

Startpunkt für den Relaunch von neos24.com und die Inbetriebnahme von AIVA v3.
Ausgangsmaterial: `neos24handover.zip` (AIVA-Anleitung, `setup-neos24.sh`,
`aiva-v3-code.tar.gz`, Referenz-Docs), geprüft am 2026-08-01.

## Was hier liegt

| Datei | Inhalt |
|---|---|
| [`HANDOVER-REVIEW.md`](HANDOVER-REVIEW.md) | Prüfergebnis des Handovers — 2 Bugs, 1 Konzept-Missverständnis, 10 bestätigte Punkte |
| [`SEO-RANK1-CHECKLIST.md`](SEO-RANK1-CHECKLIST.md) | Die vollständige Ranking-Checkliste, nach Hebelwirkung sortiert |
| [`patches/`](patches/) | Zwei getestete Fixes für das AIVA-Bundle + Testskript |
| [`tools/indexability-audit.py`](tools/indexability-audit.py) | Live-Check gegen `noindex` & Co. Läuft überall, nur Python 3 |
| [`site/`](site/) | Startseite nach dem Rebranding 2026 (HTML/CSS/JS, ohne Build) — Vorlage für Layout, CSS und Navigation, die AIVA später braucht |

---

## Das Wichtigste zuerst

Das Handover liefert **AIVA v3** — eine Maschine, die SEO-Unterseiten
produziert, hochlädt und ihre Indexierung überwacht. Es liefert **keinen
Website-Relaunch**. AIVA kennt keine Startseite, keine Navigation, kein Design.
Es lädt fertige Artikelseiten in eine Struktur, die bereits stehen muss.

„neos24.com neu gestalten" sind deshalb zwei Projekte:

```
Strang A — Relaunch (3–8 Wochen)          Strang B — AIVA (Setup 1–2 Tage)
Design, Struktur, Startseite,             Content-Nachschub auf dieser Basis,
Navigation, Technik-Basis, Layout    ───▶ 5–50 Seiten/Tag, Indexing-Monitoring
NICHT im Handover enthalten               komplett im Handover enthalten
```

**Reihenfolge:** A vor B. AIVA braucht Layout, CSS, Navigation und URL-Schema als
Vorlage. Wer die Maschine vorher anwirft, produziert Hunderte Seiten, die nach
dem Relaunch alle umziehen müssen — mit genau dem Redirect-Aufwand, an dem
Relaunches typischerweise ihre Rankings verlieren.

Die gute Nachricht: die 1–2 Tage AIVA-Setup lassen sich parallel zu Strang A
erledigen. Nur der erste Deploy wartet.

---

## Was ich schon erledigt habe

**Handover geprüft.** Ergebnis in `HANDOVER-REVIEW.md`. Der Code ist besser als
üblich — echter fail-closed SEO-Gate vor dem Upload, Dedup-Schutz gegen
Scaled-Content-Abstrafung, Healthcheck, ehrliche Troubleshooting-Sektion. Zwei
Dinge müssen vor dem ersten Start repariert werden:

**Bug 1 — `setup-neos24.sh` legt fremde Projekte an.** Das Skript spielt
Migrationen per Glob `00[4-9]_*.sql` ein und erwischt damit
`006_mikra_domains.sql`, eine reine Mandantendaten-Migration. Sie legt drei
aktive **Mikra-Webtec**-Projekte (.at/.ch/.com) in deiner Datenbank an, die der
tägliche Deploy-Job anfasst und die ohne Credentials Fehler-Alerts produzieren.
→ `patches/002-…` + `patches/005a_schema_only.sql`

**Bug 2 — der SEO-Gate prüft nicht auf `noindex`.** Genau dein Punkt, und er ist
real. `worker/core/seo_check.py` prüft sechs Regeln (Wortzahl, Title, Meta, H1,
Canonical, JSON-LD) und sieht sich `<meta name="robots">` **nie** an. Eine Seite
mit `noindex` läuft durch, wird deployt, bei Google angemeldet — und verschwindet
lautlos. → `patches/001-…`, Regel 7 ergänzt.

Beide Patches sind gegen das Original-Bundle verifiziert; der noindex-Test läuft
gegen das ungepatchte Bundle mit 7 Fehlschlägen und gegen das gepatchte mit 0.
Details in `patches/README.md`.

**Dazu ein Live-Audit-Tool.** Der Gate prüft die Bytes *vor* dem Upload;
`tools/indexability-audit.py` prüft, was der Crawler *danach* sieht — inklusive
`robots.txt`, `X-Robots-Tag`-Header, Redirects, Basic-Auth und Sitemap, die der
Gate prinzipiell nicht sehen kann.

```bash
python3 neos24/tools/indexability-audit.py https://neos24.com/
```

---

## Wo ich blockiert bin

Zwei Dinge brauche ich von dir, bevor Strang A losgehen kann.

**1. Ich komme nicht an neos24.com heran.** Die Netzwerk-Policy dieser Umgebung
blockt ausgehende Verbindungen dorthin (403 auf den CONNECT-Tunnel). Ich konnte
weder Startseite noch `robots.txt` noch Sitemap abrufen und kenne den
Ist-Zustand nicht. Entweder `neos24.com` in der Umgebungs-Policy freigeben —
oder du lässt das Audit-Skript oben einmal selbst laufen und schickst mir die
Ausgabe. Beides reicht.

**2. Ich weiß nicht, was neos24.com verkauft.** Öffentliche Suche deutet auf
Last-Mile-Paketzustellung mit europaweitem Zusteller-Netz und einer öffentlichen
API hin. Das ist eine Vermutung, keine Grundlage für eine Keyword-Strategie.
Konkret brauche ich:

- Was verkauft ihr, an wen? B2B, B2C oder beides?
- Wonach sucht dieser Kunde bei Google, kurz bevor er bei euch landet?
- Welche 3–5 Wettbewerber ranken heute für diese Suchen?
- Welche Sprachen und Länder? (Entscheidet über hreflang und Domain-Struktur)
- Was ist die Conversion — Angebotsanfrage, Registrierung, API-Zugang?
- Aktuelles CMS? WordPress, statisch, Eigenentwicklung? (Entscheidet über den
  AIVA-Deploy-Weg: `wp_rest`, `sftp`/`ftp` oder `git`)
- Design: kompletter Neuentwurf oder Auffrischung des bestehenden?

---

## Vorschlag: die nächsten drei Schritte

**Schritt 1 — Bestandsaufnahme (Tag 1).**
Audit-Skript gegen neos24.com laufen lassen. Parallel: Search Console
einrichten, falls noch nicht vorhanden, und die aktuellen Rankings sichern —
das ist die Baseline, gegen die der Relaunch später gemessen wird, und sie ist
nach dem Relaunch nicht mehr rekonstruierbar.

**Schritt 2 — Struktur vor Design (Woche 1).**
Aus deinen Antworten oben: Zielgruppen, Suchintentionen, Seitenstruktur,
URL-Schema. Erst danach Design. Ein Design, das auf eine falsche Struktur
gebaut wurde, muss zweimal gebaut werden.

**Schritt 3 — Relaunch technisch absichern (Woche 2 ff.).**
Redirect-Map alt→neu, Stufe 0 der Checkliste durchgehen, Audit erneut laufen
lassen. Erst wenn das grün ist, wird AIVA scharf geschaltet — mit
konservativer Deploy-Rate (2–5 Seiten/Tag), nicht mit dem Ceiling.

AIVA-Setup auf der VPS kann jederzeit dazwischen laufen; es blockiert nichts.
Reihenfolge dann: Bundle entpacken → **beide Patches anwenden** →
`setup-neos24.sh` → `.env` füllen → Preflight.
