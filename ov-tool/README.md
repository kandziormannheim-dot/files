# OV-Management-Tool – CDU Seckenheim-Friedrichsfeld

Web-App für die Vorstandsarbeit des Ortsverbands. Spezifikation: [`SPEC.md`](SPEC.md), Arbeitsregeln und Befehle: [`CLAUDE.md`](CLAUDE.md), Standardvorlagen: [`templates/`](templates/README.md).

## Stand

| Paket | Inhalt | Status |
|---|---|---|
| 1.1 | Projekt-Setup: Next.js, Prisma, Docker Compose (app, db), Lint/Tests, Grundlayout mit Navigation | erledigt |
| 1.2 | Auth und Rollen: Magic-Link-Login, Rollen, Nutzerverwaltung, Rechteprüfung, Audit-Log | erledigt |
| 1.3 | Link-Hub: Kategorien, Suche, Sortierung per Drag & Drop, Schutz gegen gespeicherte Passwörter | erledigt |
| 1.4 | Aufgaben: Ansichten Meine/Alle/Überfällig, Filter, Kommentare, Herkunft, Mail bei Zuweisung | erledigt |
| 1.5 | Sitzungen und Tagesordnung: automatische Vorbelegung, TOP-Editor mit Drag & Drop, TO-Vorschläge/Antrag auf Einberufung, Zu-/Absagen (auch per Link), Satzungslogik | erledigt |
| 1.6 | Vorlagen-Engine und Einladungsversand: versionierte Vorlagen mit Prüfung und Vorschau, PDF auf Briefbogen, Versand mit persönlichem Zusage-Link, Ladungsfrist-Prüfung, Unterschriftsbild, Einstellungen | erledigt (Ladungsfrist-Erinnerung per Job: 2.1) |
| 1.7 | Protokolle: Live-/nachträglicher Editor mit Autosave, Anwesenheit und Beschlussfähigkeit, Aufhebung/Wiedereröffnung, Beschlüsse mit Mehrheitsberechnung, Aufgaben, Prüfliste, Versand, Versionen, Genehmigung (Sitzung/Umlauf), Übersendung an die Geschäftsstelle, PDF/DOCX; Umlaufverfahren | erledigt |
| 1.8 | Deployment: Dockerfile mit Chromium, Compose (app, db, whisper, caddy), Caddy mit HTTPS, Start-Initialisierung, Backup/Restore, Deploy-Workflow, Betriebsanleitung (`docs/betrieb.md`) | erledigt (Image-Build auf dem Server zu prüfen) |

## Lokal starten

```bash
npm install
cp .env.example .env
docker compose up -d db
npm run db:migrate
SEED_ADMIN_EMAIL=ich@example.org SEED_ADMIN_NAME="Vorname Name" npm run db:seed
npm run dev
```

Ohne `SMTP_HOST` erscheinen Mails (auch der Anmeldelink) im Terminal von `npm run dev`.

```
```

`docs/beispiele/` enthält eine Beispiel-Einladung und ein Beispiel-Protokoll mit erfundenen Inhalten (Abnahmemaßstab für die Pakete 1.6 und 1.7).
