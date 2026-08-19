# Claude Code Skills

Insgesamt **355 Skills** aus vier Quellen:

| # | Quelle | Skills | Always-on | Weg |
| --- | --- | ---: | ---: | --- |
| [1](#1-marketplace-alirezarezvaniclaude-skills) | `alirezarezvani/claude-skills` | 314 | ~60.300 | Marketplace |
| [2](#2-vendored-web-design) | `xiaopu-ai/web-design` | 1 | — | ins Repo kopiert |
| [3](#3-marketplace-mattpocockskills) | `mattpocock/skills` | 25 | ~1.600 | Marketplace |
| [4](#4-vendored-designer-skills) | designer-skills + claudekit (gemischt) | 15 | — | ins Repo kopiert |

Alles greift automatisch in jeder Claude-Code-Session auf diesem Repo; eine manuelle
Installation pro Rechner ist nicht nötig.

> **Offen:** Für die Matt-Pocock-Skills muss einmalig pro Repo
> `/setup-matt-pocock-skills` laufen. Siehe [Abschnitt 3](#einmalige-einrichtung-nötig).

---

# 1. Marketplace: alirezarezvani/claude-skills

Die Skill-Bibliothek [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
ist als Claude-Code-Marketplace registriert. Die Konfiguration liegt in
[`settings.json`](settings.json).

Die Skills werden **nicht** ins Repo kopiert. Claude Code klont den Marketplace bei
Bedarf selbst nach `~/.claude/`, wodurch Updates über `/plugin update` laufen und das
Repo schlank bleibt.

## Installierter Umfang

34 Plugins mit zusammen **314 Skills**.

| Plugin | Skills | Always-on Tokens |
| --- | ---: | ---: |
| `marketing-skills` | 47 | ~8.490 |
| `c-level-skills` | 34 | ~5.371 |
| `engineering-advanced-skills` | 38 | ~5.330 |
| `engineering-skills` | 33 | ~5.085 |
| `ra-qm-skills` | 17 | ~3.220 |
| `commercial-skills` | 17 | ~3.215 |
| `business-operations-skills` | 15 | ~2.940 |
| `product-skills` | 16 | ~2.533 |
| `compliance-os` | 9 | ~2.494 |
| `pm-skills` | 12 | ~2.414 |
| `markdown-html-skills` | 11 | ~2.326 |
| `research-ops-skills` | 11 | ~2.173 |
| `business-growth-skills` | 5 | ~985 |
| `finance-skills` | 3 | ~397 |
| Productivity (10 Einzel-Plugins) | 26 | ~6.584 |
| Research (9 Einzel-Plugins) | 18 | ~6.124 |
| `landing` | 2 | ~612 |
| **Summe** | **314** | **~60.300** |

## Token-Kosten beachten

"Always-on" heißt: Name und Beschreibung jedes Skills liegen in **jeder** Session im
Kontext, unabhängig davon, ob der Skill benutzt wird. Bei ~60.000 Tokens ist das ein
relevanter Anteil des Kontextfensters.

Um eine Domain abzuschalten, den entsprechenden Eintrag in `settings.json` auf `false`
setzen oder löschen:

```json
"c-level-skills@claude-code-skills": false
```

Kosten und Inhalt eines Plugins lassen sich jederzeit prüfen:

```bash
claude plugin details marketing-skills@claude-code-skills
```

## Nützliche Befehle

```bash
claude plugin list                                  # installierte Plugins anzeigen
claude plugin install <name>@claude-code-skills     # weiteres Plugin aktivieren
claude plugin update <name>@claude-code-skills      # Plugin aktualisieren
claude plugin marketplace update claude-code-skills # Marketplace-Cache auffrischen
```

## Nicht enthalten

`loop-library` besitzt im Upstream-Repo keinen Marketplace-Eintrag und ist daher nicht
über `/plugin install` verfügbar. Der Skill muss bei Bedarf manuell aus dem
Upstream-Repo kopiert werden.

---

# 2. Vendored: web-design

Liegt unter [`skills/web-design/`](skills/web-design/) und wird von Claude Code als
Projekt-Skill automatisch gefunden.

**Quelle:** [xiaopu-ai/web-design](https://github.com/xiaopu-ai/web-design), MIT,
Commit `22a4f482cc4caa2394391c0c31ff0aefd1908774` (2026-06-25).
Die `README.md` im Upstream nennt noch den alten Pfad `KAOPU-XiaoPu/web-design` — das
Konto wurde umbenannt, der Inhalt ist derselbe.

## Warum kopiert statt referenziert

Das Repo enthält nur eine einzelne `SKILL.md` ohne `plugin.json` oder
`marketplace.json`. Damit gibt es keinen Marketplace-Weg wie bei den Skills oben; der
Upstream dokumentiert selbst nur `git clone`. Kopieren ins Repo ist hier die einzige
Variante, die versioniert ist und ohne Setup pro Rechner auskommt.

## Was der Skill tut

Zweistufiger Workflow für Web-Design: erst eine `DESIGN.md`-Spezifikation (Farbe,
Typografie, Komponenten, Layout, Motion, Responsive, Accessibility), nach deiner
Bestätigung dann der Code dazu. Eingabe wahlweise PRD, Referenz-URL, Screenshot oder
Stichworte. Zielgruppe sind Landing Pages, Portfolios, Produkt- und SaaS-Seiten — nicht
Backend oder Datenbank.

Enthalten sind 56 Design-System-Referenzen (Stripe, Linear, Vercel, Apple, …), eine
Motion- und Interaction-Library sowie eine Quality-Checklist.

## Mitgelieferte Skripte

`skills/web-design/scripts/` enthält drei Python-Skripte, die Claude bei Bedarf ausführt:

| Skript | Zweck | Netzwerk |
| --- | --- | --- |
| `crawl_website.py` | Playwright-Crawler: rendert eine Referenz-URL, screenshottet, extrahiert Tokens | ja, benötigt Playwright |
| `extract_design_tokens.py` | Zieht Design-Tokens aus HTML/CSS; lädt verlinkte Stylesheets nach | ja |
| `fetch_unsplash_images.py` | Baut Unsplash-URLs aus einer kuratierten Liste für Platzhalterbilder | nein |

Alle drei laufen nur gegen URLs, die du selbst vorgibst.

## Nicht kopiert

Der Ordner `docs/` des Upstream-Repos (~1,5 MB, Demo-Landingpage mit Bildern für
GitHub Pages) fehlt bewusst. `SKILL.md` referenziert ausschließlich `references/` und
`scripts/` — die Demo wird für den Betrieb nicht gebraucht.

## Aktualisieren

Vendored Code bekommt keine Updates über `/plugin update`. Für eine neue Version:

```bash
git clone --depth 1 https://github.com/xiaopu-ai/web-design /tmp/web-design
rm -rf .claude/skills/web-design
mkdir -p .claude/skills/web-design
cp /tmp/web-design/SKILL.md /tmp/web-design/LICENSE .claude/skills/web-design/
cp -r /tmp/web-design/references /tmp/web-design/scripts .claude/skills/web-design/
claude plugin validate .claude
```

---

# 3. Marketplace: mattpocock/skills

[mattpocock/skills](https://github.com/mattpocock/skills) (MIT), Plugin
`mattpocock-skills` v1.2.3 — 25 Skills für **~1.600 Tokens** always-on. Damit das
günstigste der drei Sets, gemessen an Skills pro Token.

Der Upstream bewirbt zwei Installationswege: das Plugin (verwaltet, aktualisiert sich)
oder `npx skills@latest add` (kopiert editierbare Dateien ins Repo). Wir nehmen das
Plugin, konsistent zu Quelle 1. **Nicht beides installieren** — sonst liegt jeder Skill
doppelt vor.

Das README nennt den offiziellen Claude-Code-Marketplace, in dem das Plugin ohne
weiteres Zutun verfügbar sein soll. In dieser Umgebung war es dort nicht auffindbar,
deshalb ist `mattpocock/skills` in `settings.json` explizit als Marketplace registriert.
Das funktioniert unabhängig davon, ob der offizielle Eintrag vorhanden ist.

## Einmalige Einrichtung nötig

Der Upstream verlangt einen Setup-Lauf pro Repo:

```
/setup-matt-pocock-skills
```

Der Skill fragt interaktiv nach Issue-Tracker (GitHub, Linear oder lokale Dateien), den
Labels für `/triage` und dem Ablageort für erzeugte Dokumente. **Das ist noch nicht
gelaufen** — die Antworten sind Projektentscheidungen und wurden bewusst nicht geraten.
Skills wie `/triage` und `/to-tickets` funktionieren erst danach vollständig.

## Enthaltene Skills

Engineering: `ask-matt`, `code-review`, `codebase-design`, `diagnosing-bugs`,
`domain-modeling`, `grill-with-docs`, `implement`, `improve-codebase-architecture`,
`prototype`, `research`, `resolving-merge-conflicts`, `setup-matt-pocock-skills`, `tdd`,
`to-spec`, `to-tickets`, `triage`, `wayfinder`, `wizard`

Productivity: `grill-me`, `grilling`, `handoff`, `teach`, `to-questionnaire`,
`wait-what`, `writing-for-agents`

## Nicht enthalten

Das Repo hat 35 `SKILL.md`-Dateien, das Plugin liefert 25. Der Autor listet die übrigen
10 nicht in `plugin.json`:

- `skills/in-progress/` — `claude-handoff`, `loop-me`, `setup-ts-deep-modules`,
  `writing-beats`, `writing-fragments`, `writing-shape`
- `skills/misc/` — `git-guardrails-claude-code`, `migrate-to-shoehorn`,
  `scaffold-exercises`, `setup-pre-commit`

Der Ausschluss ist beabsichtigt (unfertige Arbeit), deshalb sind sie hier nicht
nachgereicht.

---

# 4. Vendored: designer-skills

15 Skills unter [`skills/`](skills/), im Zuge von PR #3 zusammen mit der Astro-Site
hinzugekommen. Anders als die Marketplace-Quellen liegen sie als Dateien im Repo und
bekommen keine Updates über `/plugin update`.

## Herkunft ist gemischt

Der PR beschreibt sie als „eight designer-skills" — tatsächlich sind es 15 aus
mindestens zwei Projekten. Abgeglichen mit dem Upstream-Repo:

| Skills | Herkunft | Beleg |
| --- | --- | --- |
| `brief-to-tasks`, `design-brief`, `design-flow`, `design-review`, `design-tokens`, `frontend-design`, `grill-me`, `information-architecture` | [julianoczkowski/designer-skills](https://github.com/julianoczkowski/designer-skills) | Namen decken sich exakt mit den 8 Skills des Upstream-Repos |
| `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling` | claudekit | `metadata.author: claudekit` im Frontmatter |
| `ui-ux-pro-max` | unbekannt | keine Autor- oder Lizenzangabe im Frontmatter |

## Fehlende Lizenzangaben

Sechs der claudekit-Skills tragen `license: MIT` im Frontmatter, aber **keiner der 15
hat eine LICENSE-Datei** — im Gegensatz zu `web-design` (Quelle 2), wo Lizenz und
Quell-Commit festgehalten sind. Für `ui-ux-pro-max` fehlt jede Lizenzangabe.

Wer die Skills weitergibt oder das Repo öffentlich macht, sollte das nachziehen:
Upstream-Commit und Lizenz je Herkunft festhalten, so wie es bei Quelle 2 gemacht ist.

---

# Namenskollisionen

Geprüft über alle 339 Plugin-Skills und alle 16 Projekt-Skills hinweg. Es gibt vier
Dopplungen, in drei verschiedenen Konstellationen.

## Projekt-Skill gegen Plugin-Skill

| Name | Projekt (`skills/`) | Plugin |
| --- | --- | --- |
| `design-system` | Quelle 4, claudekit-Teil | `markdown-html-skills@claude-code-skills` |
| `grill-me` | Quelle 4, designer-skills-Teil | `mattpocock-skills@mattpocock` |

Diese beiden sind die unangenehmeren: Projekt-Skills liegen als Dateien im Repo,
Plugin-Skills kommen aus dem Marketplace-Cache. Welcher gewinnt, hängt an der
Auflösungsreihenfolge von Claude Code und nicht an einer Einstellung in diesem Repo.

Inhaltlich sind es **verschiedene Skills mit gleichem Namen**, nicht zwei Versionen
desselben:

- `design-system` — Quelle 4 baut Design-Tokens und Komponenten-Specs;
  `markdown-html-skills` meint den Onboarding-Wizard für die Markdown-zu-HTML-Konverter.
- `grill-me` — Quelle 4 interviewt dich zu einem Design oder Plan;
  `mattpocock-skills` grillt einen technischen Plan gegen den Engineering-Kanon.

Wenn du gezielt eine der beiden Varianten brauchst, ist der Name allein nicht mehr
eindeutig. Zwei Auswege: das ungewollte Plugin in [`settings.json`](settings.json) auf
`false` setzen, oder den Projekt-Skill unter `skills/` umbenennen (Ordnername **und**
`name:` im Frontmatter) — Letzteres hält beide verfügbar.

## Plugin gegen Plugin

| Name | Plugins |
| --- | --- |
| `handoff` | `handoff-productivity@claude-code-skills`, `mattpocock-skills@mattpocock` |
| `research` | `research-orchestrator@claude-code-skills`, `mattpocock-skills@mattpocock` |

Hier reicht es, das ungewollte Plugin in `settings.json` auf `false` zu setzen.

## Gegen einen eingebauten Skill

`mattpocock-skills` bringt ein `code-review` mit, das namensgleich zum eingebauten
`/code-review` von Claude Code ist.
