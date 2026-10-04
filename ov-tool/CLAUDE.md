# CLAUDE.md – OV-Management-Tool CDU Seckenheim-Friedrichsfeld

Web-App für den Vorstand des CDU-Ortsverbands: Sitzungen, Protokolle, Aufgaben, Aktionen, Stadtteil-Themen, Link-Hub.
Produktiv unter `https://management.cdu-sf.de`.

**Die vollständige Spezifikation steht in `SPEC.md`. Lies sie vor jeder neuen Aufgabe.**

## Arbeitsweise

- Arbeite **ein Arbeitspaket aus SPEC.md Abschnitt 9 nach dem anderen** ab. Nicht vorgreifen.
- Vor Beginn eines Pakets: kurz planen, betroffene Dateien nennen, dann umsetzen.
- Nach jedem Paket: `npm run lint`, `npm run typecheck`, `npm test` müssen grün sein. Dann kurze Zusammenfassung, was getestet werden sollte.
- Bei Unklarheiten in der Spezifikation: nachfragen statt raten. Abweichungen von SPEC.md nur nach Rücksprache.
- Kleine, nachvollziehbare Commits mit deutschen Commit-Messages im Imperativ („Füge Aufgabenfilter hinzu“).

## Stack

- Next.js (App Router), TypeScript (strict)
- Tailwind CSS, shadcn/ui
- PostgreSQL 16, Prisma
- Auth.js (E-Mail-Magic-Link via SMTP)
- pg-boss für Hintergrundjobs
- faster-whisper (eigener Container) für Transkription
- Anthropic Claude API für Protokollentwürfe (`@anthropic-ai/sdk`)
- Playwright/Chromium für PDF, `docx` für DOCX
- Docker Compose, Caddy als Reverse Proxy (kein Cloudflare)

## Befehle

```bash
npm install            # Abhängigkeiten, erzeugt auch den Prisma-Client
cp .env.example .env   # lokale Werte eintragen
docker compose up -d db
npm run dev            # Entwicklungsserver auf http://localhost:3000
npm run lint           # ESLint (eslint-config-next)
npm run typecheck      # tsc --noEmit
npm test               # Vitest; DB-Tests (*.int.test.ts) nur mit TEST_DATABASE_URL (eigene DB, wird geleert)
npm run build          # Produktions-Build (output: standalone)
npm run db:migrate     # = npx prisma migrate dev (Migration lokal anlegen/anwenden)
npm run db:seed        # erster Admin aus SEED_ADMIN_* (Paket 1.6: Vorlagen, Standard-TOPs)
npx prisma studio
docker compose --profile prod up -d --build   # Produktion: app, db, whisper, caddy (docs/betrieb.md)
```

CI: `.github/workflows/ov-tool-tests.yml` (im Repo-Root) führt Lint, Typprüfung, Tests, Migrationen und Build aus.
Deployment: `.github/workflows/ov-tool-deploy.yml` (manuell), Betrieb und Sicherung: `docs/betrieb.md`, `scripts/backup.sh`.
Beim Serverstart (`src/instrumentation.ts`) werden fehlende Vorlagen angelegt, der erste Admin aus `SEED_ADMIN_*` und die Hintergrundjobs gestartet.

## Struktur

```
src/
  app/                 # Routen (App Router), Seiten auf Deutsch benannt im UI, Pfade englisch
  components/          # UI-Komponenten
  server/
    auth/              # Auth.js-Konfiguration, Rollenprüfung
    services/          # Geschäftslogik je Modul (meetings, minutes, tasks, actions, topics, links, templates)
    jobs/              # pg-boss-Jobs (mail, reminders, transcription, ai-draft, retention)
    pdf/               # PDF/DOCX-Erzeugung
  lib/                 # Hilfsfunktionen, Validierung (zod)
prisma/
  schema.prisma
  seed.ts              # Standardvorlagen, Standard-TOPs, Beispiel-Admin
templates/             # Standardvorlagen (werden per Seed in die DB übernommen)
docker/                # Dockerfiles, Caddyfile, whisper-Konfiguration
```

## Muster im Code

- **Rechte:** `src/server/auth/permissions.ts` (Fähigkeiten je Rolle, `assertCan`). Jeder Service ruft `assertCan(actor, …)` auf; Seiten nutzen `requirePageCapability`, Server Actions `requireUser()` und übergeben den Nutzer an den Service.
- **Server Actions** liegen als `actions.ts` neben der Seite, rufen nur Services auf und laufen über `runAction` (`src/server/action.ts`) → einheitliche Feld- und Fehlermeldungen für `ActionForm` (`src/components/form.tsx`).
- **Audit:** `audit(tx, actor, "objekt.aktion", "Typ", id, diff)` aus `src/server/audit.ts`, in derselben Transaktion.
- **Mails:** nur über Vorlagen (`src/server/templates/engine.ts`, `renderMailTemplate`) und `sendMail`. Ohne `SMTP_HOST` landen Mails im Server-Log.
- **Datum/Zeit:** ausschließlich über `src/lib/dates.ts` (Europe/Berlin).
- **Vorlagen:** aktive Fassung über `getTemplateSource(key)` (DB, versioniert; Rückfall auf `templates/`). Kontext für Sitzungen/Absender aus `src/server/services/template-context.ts`. Neue Platzhalter in `src/server/templates/placeholders.ts` und `templates/README.md` eintragen – der Test `placeholders.test.ts` prüft alle Standardvorlagen.
- **PDF:** `renderDocumentPdf(key, kontext, titel)` in `src/server/pdf/render.ts` (Briefbogen, eingebettete Inter, keine externen Verbindungen).
- **Dateien:** `src/server/files.ts` (relativ zu `FILE_STORAGE_PATH`, Pfad-Traversal-geschützt); Dateityp über `sniffType` prüfen.

## Verbindliche Regeln

1. **Keine Mitgliederdaten.** Es gibt kein Mitglieder-Modell. Keine Felder für Mitgliedsnummern, Adressen oder Beiträge anlegen.
2. **Rechte serverseitig prüfen** in jeder Server Action / Route (`requireRole(...)`). UI-Ausblendung allein reicht nie.
3. **Jede schreibende Aktion ins Audit-Log** (über den zentralen Service-Layer, nicht in Komponenten).
4. **Eingaben mit zod validieren**, an der Servergrenze.
5. **Keine Passwörter oder Zugangsdaten** im Link-Hub oder sonstwo speichern.
6. **Transkripte und Audio:** Upload nur mit gesetzter Zustimmungsbestätigung. Audio nach Transkription löschen. Löschfristen über den Retention-Job durchsetzen.
7. **KI-Ergebnisse sind immer Vorschläge.** Beschlüsse und Aufgaben aus dem Claude-Entwurf erst nach Bestätigung durch einen Nutzer anlegen.
8. **Geheimnisse nur über Umgebungsvariablen**, nie im Code oder in Commits.
9. Versendete Protokolle sind gesperrt; Änderungen nur als neue Version.
10. **Satzungslogik zentral** in `src/server/services/statute.ts` (Ladungsfrist, Quorum, Mehrheiten, Umlaufverfahren) mit Quellenangabe je Regel als Kommentar und vollständigen Unit-Tests, inkl. Randfällen (Stimmengleichheit, genau die Hälfte anwesend, Widerspruch von genau einem Viertel). Siehe SPEC.md Abschnitt 2a.
11. Nicht abgegebene Stimmen gelten im Umlaufverfahren **nie** als Zustimmung.

## Konventionen

- Code, Bezeichner, Dateinamen: Englisch. Oberfläche, E-Mails, Vorlagen, Fehlermeldungen für Nutzer: **Deutsch**, neutral formuliert. Anrede und Tonalität in E-Mails werden ausschließlich über die Vorlagen gesteuert, nicht im Code festgelegt.
- Datumsformat `TT.MM.JJJJ`, Uhrzeit `HH:MM`, Zeitzone `Europe/Berlin` (in der DB UTC).
- Mobile-first: jede Seite muss bei 375 px Breite ohne horizontales Scrollen funktionieren.
- Server Components bevorzugen; Client Components nur wo Interaktion nötig.
- Vorlagen: Handlebars, Ausgangsfassungen und Platzhalter-Referenz in `templates/README.md`. Unbekannte Platzhalter beim Speichern einer Vorlage als Fehler melden. Datum/Uhrzeit immer über die Helfer aus einem einzigen Feld, nie doppelt gepflegt.
- Testdaten und Fixtures nur mit **erfundenen** Namen und Inhalten. Echte Protokolle, Einladungen oder Transkripte niemals ins Repository committen.

## Umgebungsvariablen

```
DATABASE_URL=
AUTH_SECRET=
APP_URL=https://management.cdu-sf.de
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
WHISPER_URL=http://whisper:9000
WHISPER_MODEL=
FILE_STORAGE_PATH=/data/files
CHROMIUM_PATH=           # PDF-Erzeugung; im Container /usr/bin/chromium
ENCRYPTION_KEY=          # für Bürgerkontaktdaten
SEED_ADMIN_EMAIL=        # Seed: erster Admin
SEED_ADMIN_NAME=
SEED_ADMIN_FUNCTION=
TEST_DATABASE_URL=       # nur Tests: separate Datenbank, wird vor jedem DB-Test geleert
```

`.env.example` immer aktuell halten.
