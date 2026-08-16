# Claude Code Skills

Dieses Repo hat die Skill-Bibliothek [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
als Claude-Code-Marketplace registriert. Die Konfiguration liegt in [`settings.json`](settings.json)
und greift automatisch in jeder Claude-Code-Session auf diesem Repo — es ist keine
manuelle Installation pro Rechner nötig.

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
