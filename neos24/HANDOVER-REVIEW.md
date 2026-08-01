# Handover-Prüfung: `neos24handover.zip`

Geprüft am 2026-08-01 gegen das entpackte Bundle
(`AIVA-ANLEITUNG.md`, `setup-neos24.sh`, `aiva-v3-code.tar.gz`, `referenz-docs/`).

**Gesamturteil:** Das Bundle ist vollständig und der Code ist in besserem Zustand
als solche Handovers üblicherweise sind — es gibt einen echten, fail-closed
SEO-Gate vor dem Upload, Dedup-Schutz, Health-Monitoring und eine ehrliche
Troubleshooting-Sektion aus dem Realbetrieb. Zwei Dinge muss man vor dem ersten
Start reparieren (F1, F2), eins ist ein Konzept-Missverständnis, das den
ganzen Zeitplan betrifft (F0).

Legende: 🔴 vor dem Start reparieren · 🟡 vor dem ersten Deploy klären · ⚪ notiert

---

## F0 🔴 AIVA gestaltet keine Website — es befüllt eine

Das ist der wichtigste Punkt und er steht nirgends explizit im Handover.

AIVA v3 ist ein **Content-Delivery- und Indexing-Monitor**. Es produziert
einzelne SEO-Artikelseiten, lädt sie per FTP/SFTP/WP-REST auf einen fremden
Server, pingt Sitemap und IndexNow an und beobachtet danach, ob Google sie
indexiert. Es kennt keine Startseite, keine Navigation, kein Design-System,
keine Conversion-Strecke.

Dein Ziel „neos24.com neu gestalten" besteht also aus **zwei getrennten
Arbeitssträngen**:

| | Strang A — Relaunch | Strang B — AIVA |
|---|---|---|
| Was | Design, Seitenstruktur, Startseite, Navigation, Technik-Basis | Content-Nachschub auf dieser Basis |
| Liefert | Die Website | 5–50 Unterseiten pro Tag |
| Im Handover enthalten | **Nein** | Ja, komplett |
| Dauer | 3–8 Wochen | Setup 1–2 Tage, dann läuft es |

**Reihenfolge ist nicht verhandelbar:** Strang A zuerst. AIVA lädt Seiten in eine
bestehende Struktur hoch — Layout, CSS, Navigation und URL-Schema müssen
vorher stehen. Wer AIVA auf eine unfertige Seite loslässt, produziert Hunderte
Seiten, die er nach dem Relaunch alle wieder umziehen muss.

---

## F1 🔴 `setup-neos24.sh` legt fremde Mikra-Projekte in deiner Datenbank an

**Fundstelle:** `setup-neos24.sh`, Abschnitt 3

```bash
for mig in "$REPO_DIR"/database/migrations/00[4-9]_*.sql; do
```

Der Glob trifft alle sechs Dateien 004–008 — darunter zwei, die **keine
Schema-Migrationen sind, sondern Mikra-Webtec-Mandantendaten**:

- `005_mikra_config.sql` — mischt beides: die DDL, die jede Instanz braucht
  (Spalte `writer_guidance`, `ftp` im Protokoll-Enum), *und* Mikra-Projektdaten.
  Die Datenteile greifen per `WHERE slug = 'mikra-webtec'` bzw. `'sleepcodex'`
  und laufen auf einer frischen neos24-DB ins Leere. Harmlos, aber falsch am Platz.

- `006_mikra_domains.sql` — **das ist der eigentliche Schaden.** Die Datei legt
  per `INSERT` drei Projekte an: `mikra-webtec-at`, `mikra-webtec-ch`,
  `mikra-webtec-com`. Das `WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = …)`
  darin schützt nur gegen Doppel-Anlage in *derselben* Instanz — nicht dagegen,
  dass die Datei in der *falschen* Instanz läuft.

Konkrete Folge auf deinem Server: drei fremde Projekte mit `status='active'`,
`deploy_rate_current=10`, `indexing_use_google_api=1`, Ziel-FTP-Pfad
`/mikra-webtec.at` usw. Ihr `credentials_vault_id` wird `NULL` (die Zeile holt
sie aus dem `mikra-webtec`-Projekt, das bei dir nicht existiert). Der
06:00-UTC-Deploy-Job fasst sie damit **täglich** an, scheitert an den fehlenden
Credentials und schickt dir Alerts für Domains, die dir nicht gehören. Dazu
verfälschen sie jede Portfolio- und Kosten-Ansicht im Dashboard.

**Fix mitgeliefert:**
`patches/002-setup-neos24-skip-mikra-migrations.patch` ersetzt den Glob durch
eine explizite Liste und `patches/005a_schema_only.sql` zieht die DDL aus 005
ohne die Mandantendaten. Beides trägt 005 und 006 im `schema_migrations`-Ledger
ein — 006 ausdrücklich als „bewusst übersprungen", damit ein späterer Lauf sie
nicht doch noch nachzieht.

---

## F2 🔴 Der SEO-Gate prüft alles — nur nicht auf `noindex`

Genau der Punkt, auf den du hingewiesen hast. Er ist real.

**Fundstelle:** `worker/core/seo_check.py`

`seo_check.check()` läuft fail-closed direkt vor dem Upload und prüft sechs
Regeln: Wortzahl ≥ 400, Title vorhanden/eindeutig/≤ 70 Zeichen, Meta-Description
vorhanden/eindeutig, genau eine H1, absoluter Canonical passend zur Deploy-URL,
parsebares JSON-LD.

Er sieht sich `<meta name="robots">` **nie an.** Eine Seite mit
`<meta name="robots" content="noindex">` läuft sauber durch den Gate, wird
hochgeladen, als `deployed` markiert, bei IndexNow und Google angemeldet — und
verschwindet in der Search Console lautlos unter „Durch 'noindex'-Tag
ausgeschlossen". Kein Alert, kein Fehler, keine `failed_qa`-Zeile.

Realistische Wege, wie ein `noindex` dort landet:
- Beim Anlegen des neos24-Layouts wird während des Testens ein `noindex`
  gesetzt und vor dem Livegang nicht entfernt (der mit Abstand häufigste Fall).
- Das Writer-Modell schreibt einen `<meta>`-Tag mit in den Artikel-Body.
- Ein `X-Robots-Tag`-Header vom Webserver — den sieht der Gate ohnehin nicht,
  dafür ist `tools/indexability-audit.py` da.

**Fix mitgeliefert:** `patches/001-seo-check-noindex-guard.patch` ergänzt Regel 7.
Sie blockt `noindex`, `none` und `unavailable_after` auf den vier Meta-Namen, die
Google und Bing auswerten (`robots`, `googlebot`, `googlebot-news`, `bingbot`),
case-insensitiv. Harmlose Direktiven wie `noimageindex`, `nofollow` oder
`max-snippet` bleiben ausdrücklich erlaubt.

Beides ist belegt: `patches/test_noindex_guard.py` (12 Fälle) läuft gegen das
Original-Bundle mit **7 Fehlschlägen** und gegen das gepatchte mit **0**.

---

## F3 🔴 Das einzige HTML-Layout ist fest auf Mikra Webtec verdrahtet

**Fundstelle:** `worker/core/templates/layouts/agency_portfolio.html`

Es gibt genau ein Layout im ganzen Bundle, und es enthält hartcodiert:

- `<meta property="og:site_name" content="Mikra Webtec">`
- `og:locale` fest auf `de_DE`
- Mikra-Logo als Inline-SVG in Header und Footer
- Navigation `/leistungen/ /preise/ /referenzen/ /blog/ /website-check/`
- Footer mit `+49 (0) 171 215 2257`, `info@mikra-webtec.de`, `Mikra Webtec e.K.`
- Zwei CTA-Blöcke mit Calendly-Link `calendly.com/michaelth-krause/30min`
- Copyright-Zeile „© 2026 Mikra Webtec e.K."

Wenn du AIVA ohne neues Layout auf neos24 loslässt, wird **jede einzelne Seite
als Mikra Webtec ausgeliefert** — mit fremder Telefonnummer, fremdem Impressum
und einem Calendly-Link, der Termine bei jemand anderem bucht. Das ist kein
Schönheitsfehler, das sind hunderte falsche Seiten auf deiner Domain.

Das neos24-Layout ist eine Aufgabe aus Strang A (siehe F0) und braucht das
fertige Design als Vorlage.

---

## F4 🟡 Vier der fünf Projekt-Templates haben gar kein Layout

`worker/core/templates/` enthält fünf JSON-Konfigurationen —
`agency_portfolio`, `d2c_supplemente`, `insurance_lead`, `health_info`,
`custom` — aber `layouts/` enthält **nur** `agency_portfolio.html`.

Der Projekt-Wizard bietet dir also fünf Templates an, von denen vier ohne
zusätzliche Arbeit keine Seite rendern können. Für neos24 (laut öffentlicher
Recherche Last-Mile-Paketzustellung mit europaweitem Zusteller-Netz, also am
ehesten `custom` oder ein B2B-Service-Zuschnitt) heißt das: Layout wird so oder
so neu gebaut. Es ist nur gut zu wissen, dass keins der anderen Templates ein
Abkürzung bietet.

---

## F5 🟡 Kein hreflang im Layout, Sprache hart auf Deutsch

Das Layout setzt `og:locale` fest auf `de_DE` und enthält keinerlei
`<link rel="alternate" hreflang="…">`. Das DB-Schema kann Mehrsprachigkeit
(`hreflang_group`, `supported_locales`, `locale` auf Pillar-Ebene, aus
Migration 004/006) — das **Layout** setzt sie nur nicht um.

Für ein europaweit operierendes Geschäft ist das relevant: ohne hreflang
konkurrieren die Sprachversionen in Google gegeneinander statt sich zu
ergänzen. Muss ins neue Layout, sobald mehr als eine Sprache geplant ist.

---

## F6 ⚪ Die Modell-IDs in der Anleitung sind veraltet

`AIVA-ANLEITUNG.md` Abschnitt 3.4 nennt `ANTHROPIC_MODEL_WRITER=claude-sonnet-4-6`
und `ANTHROPIC_MODEL_JUDGE=claude-haiku-4-5-20251001`. Die Anleitung sagt selbst,
man solle die IDs prüfen — richtig so. Aktueller Stand:

```
ANTHROPIC_MODEL_WRITER=claude-sonnet-5            # Qualität
ANTHROPIC_MODEL_JUDGE=claude-haiku-4-5-20251001   # billig + schnell, bleibt
```

Der Judge-Wert stimmt unverändert. Für den Writer ist Sonnet 5 der passende
Nachfolger; Opus 5 wäre bei diesen Textmengen unnötig teuer.

---

## F7–F11 ⚪ Bestätigte Warnungen aus der Anleitung

Diese Punkte stehen bereits im Handover (Abschnitt 6, „aus dem echten Betrieb").
Ich habe sie im Code gegengeprüft, sie stimmen alle — bitte ernst nehmen, das
sind teuer bezahlte Erfahrungen:

| | Punkt | Warum es weh tut |
|---|---|---|
| F7 | Search-Console-Property als **URL-Prefix** anlegen (`https://neos24.com/`), nicht als Domain-Property | `sc-domain:` liefert 403, die komplette Index-Prüfung fällt still aus |
| F8 | `target_remote_path` **immer** mit dem Docroot präfixen | Sonst landen Seiten und Sitemap in der FTP-Wurzel und sind live 404 |
| F9 | Google Indexing API ist offiziell nur für JobPosting/BroadcastEvent | Für normale Seiten ignoriert Google sie meist. **Die Sitemap ist der Weg, der zählt** |
| F10 | `db.cnf` darf kein `database=` in `[client]` haben | Sonst bricht `mysqldump` ab und die täglichen Backups sind 20 Byte groß — man merkt es erst beim Restore |
| F11 | `/etc/aiva/vault.key` separat off-site sichern | Key weg = alle hinterlegten Credentials unwiederbringlich weg |

---

## F12 ⚪ Ich konnte den Ist-Zustand von neos24.com nicht prüfen

Ausgehende Verbindungen zu `neos24.com` werden von der Netzwerk-Policy dieser
Session blockiert (`403` auf den CONNECT-Tunnel, bestätigt über den Proxy-Status).
Ich konnte weder die Startseite noch `robots.txt` oder die Sitemap abrufen.

Alles, was ich über das aktuelle neos24.com sage, stammt aus öffentlicher Suche
und ist entsprechend unsicher. Zwei Wege, das aufzulösen:

1. `neos24.com` in der Netzwerk-Policy der Umgebung freigeben — dann crawle ich
   den Ist-Zustand direkt.
2. Du lässt `tools/indexability-audit.py` einmal selbst laufen und schickst mir
   die Ausgabe. Das Skript braucht nur Python 3, keine Installation:
   ```bash
   python3 neos24/tools/indexability-audit.py https://neos24.com/
   ```

---

## Was ich geprüft und für gut befunden habe

Damit das Bild vollständig ist — das hier ist solide gebaut und muss nicht
angefasst werden:

- **`seo_check` ist fail-closed.** Jede Exception blockt den Upload, statt ihn
  durchzuwinken. Das ist die richtige Richtung für einen Qualitäts-Gate.
- **Dedup gegen Scaled-Content-Abstrafung.** Title und Meta-Description werden
  korpusweit gegen die DB auf Eindeutigkeit geprüft, nicht nur pro Seite.
- **`preview.php` setzt korrekt `X-Robots-Tag: noindex, nofollow`.** Die
  Dashboard-Vorschau darf nicht indexiert werden — hier gehört das `noindex`
  hin und ist richtig gesetzt. Es waren die einzigen zwei `noindex`-Vorkommen im
  ganzen Bundle; im ausgelieferten Layout steht sauber `index, follow`.
- **Deploy-Guard mit Dry-Run-Pflicht** vor dem ersten echten Deploy je Projekt.
- **Healthcheck pausiert Projekte** bei Indexierungsrate < 10 % nach 14 Tagen,
  und zählt die Reife ab Sitemap-Einreichung statt ab Deploy — ein Detail, das
  einen Discovery-Ausfall davor bewahrt, als „schlechter Content" fehlgedeutet
  zu werden.
- **Budget-Caps** pro Projekt mit Warn- und Hard-Grenze, plus Job-Cap.
