# OV-Management-Tool – CDU Seckenheim-Friedrichsfeld

Web-App für die Vorstandsarbeit des Ortsverbands. Spezifikation: [`SPEC.md`](SPEC.md), Arbeitsregeln und Befehle: [`CLAUDE.md`](CLAUDE.md), Standardvorlagen: [`templates/`](templates/README.md).

## Stand

| Paket | Inhalt | Status |
|---|---|---|
| 1.1 | Projekt-Setup: Next.js, Prisma, Docker Compose (app, db), Lint/Tests, Grundlayout mit Navigation | erledigt |
| 1.2 | Auth und Rollen: Magic-Link-Login, Rollen, Nutzerverwaltung, Rechteprüfung, Audit-Log | erledigt |

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
