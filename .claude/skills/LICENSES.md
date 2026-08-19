# Herkunft und Lizenzen der Projekt-Skills

Die Skills unter `.claude/skills/` stammen nicht aus diesem Projekt, sondern sind
aus fremden Repos hierher kopiert. Diese Datei hält fest, welcher Skill woher
kommt und unter welcher Lizenz — beide Lizenzen verlangen genau das.

Die vollständigen Lizenztexte liegen unverändert unter
[`licenses/`](licenses/).

## Übersicht

| Skills | Upstream | Lizenz | Copyright |
| --- | --- | --- | --- |
| `brief-to-tasks`, `design-brief`, `design-flow`, `design-review`, `design-tokens`, `frontend-design`, `grill-me`, `information-architecture` | [julianoczkowski/designer-skills](https://github.com/julianoczkowski/designer-skills) | [Apache 2.0](licenses/Apache-2.0-designer-skills.txt) | Copyright 2026 Julian Oczkowski |
| `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling`, `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | [MIT](licenses/MIT-ui-ux-pro-max-skill.txt) | Copyright (c) 2024 Next Level Builder |
| `web-design` | [xiaopu-ai/web-design](https://github.com/xiaopu-ai/web-design) | MIT — Text liegt bei: [`web-design/LICENSE`](web-design/LICENSE) | siehe Datei |

## Stand der Kopien

| Upstream | Geprüfter Commit | Datum | Abgleich |
| --- | --- | --- | --- |
| `designer-skills` | `c259656c76d9758d7ead46b0d2f125cbe84f8665` | 2026-07-06 | alle 8 Skill-Namen decken sich |
| `ui-ux-pro-max-skill` | `8a1a6d857332da32252d77365da90c3f6293b47b` | 2026-08-19 | 6 von 7 byte-identisch; `ui-ux-pro-max` weicht ab, Upstream ist neuer |
| `web-design` | `22a4f482cc4caa2394391c0c31ff0aefd1908774` | 2026-06-25 | im [README](../README.md) dokumentiert |

Kopierter Code bekommt keine Updates über `/plugin update`. Wer aktualisiert,
sollte den Commit in der Tabelle mitziehen.

## Warum „claudekit" in der Frontmatter nicht die Quelle ist

Sechs der sieben MIT-Skills tragen `metadata.author: claudekit`. Das ist **nicht**
das Repo [carlrannaberg/claudekit](https://github.com/carlrannaberg/claudekit) —
dort liegt keiner dieser Skills. Bezogen wurden sie aus
`nextlevelbuilder/ui-ux-pro-max-skill`, wo sechs von ihnen byte-identisch liegen.
Die Frontmatter-Angabe wurde bewusst nicht geändert, damit die Dateien
unverändert gegen den Upstream vergleichbar bleiben.

## Was die Lizenzen verlangen

**Apache 2.0** (designer-skills): Lizenztext beilegen, vorhandene Copyright- und
Lizenzhinweise erhalten, Änderungen kennzeichnen. Eine `NOTICE`-Datei führt der
Upstream nicht, es ist also keine weiterzureichen. Die Dateien liegen hier
unverändert.

**MIT** (ui-ux-pro-max-skill, web-design): Copyright- und Erlaubnisvermerk in
allen Kopien erhalten.

Beides ist mit dieser Datei plus `licenses/` erfüllt. Wird ein Skill hier
inhaltlich verändert, gehört unter Apache 2.0 ein Änderungsvermerk in die
betroffene Datei.
