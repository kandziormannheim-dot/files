# Sprint 1 — Landingpage „Unfall — was jetzt?" (unfall.sv-rettinger.de)

Stand: 2026-09-05 · Status: **wartet auf Freigabe** · Projektvorgaben: [`unfall/CLAUDE.md`](../../unfall/CLAUDE.md)

## 0. Ergebnis der Recherche

**sv-rettinger.de war aus der Agent-Session nicht erreichbar.** Der Egress-Proxy
der Umgebung beantwortet jeden Verbindungsaufbau zu `sv-rettinger.de:443` mit
403 (Organisationsrichtlinie). Weder CSS noch Logo/Favicon/Badge konnten geladen
werden, und Werte werden laut Vorgabe nicht erfunden.

Stattdessen liegt die Extraktion als reproduzierbare Skripte im Repo:

| Datei | Zweck |
| --- | --- |
| `unfall/scripts/extract-tokens.mjs` | Lädt Startseite + alle Stylesheets, liest Elementor-Global-Colors, Schriftfamilien (Überschrift/Fließtext), `.elementor-button`-Stile und die häufigsten Border-Radius-Werte. Schreibt `src/styles/tokens.css` und einen Rohbefund `.design/brand-extract.json` (inkl. aller internen Links der Startseite → Leistungs-Detailseiten). |
| `unfall/scripts/fetch-brand.sh` | Lädt Logo, Favicon, VDI/VKS-Badge nach `public/brand/`. |
| `unfall/src/styles/tokens.css` | Gerüst mit den Variablennamen, noch ohne Werte. |

Einmal lokal ausführen (Node ≥ 20, curl):

```bash
cd unfall
node scripts/extract-tokens.mjs   # → src/styles/tokens.css + .design/brand-extract.json
./scripts/fetch-brand.sh          # → public/brand/{logo,favicon,vdi-vks-badge}.png
```

Beides getestet gegen eine lokale Nachbildung einer Elementor-Seite. Alternativ:
Zugriff auf `sv-rettinger.de` für die Session freischalten, dann führe ich es aus.

## 1. Ablage im Repo

Neues Teilprojekt `unfall/` neben `site/` (kandzior.de) und `womo/`. Eigene
`package.json`, eigenes Compose. Nichts davon berührt die anderen Projekte.

```
unfall/
├── CLAUDE.md                  Projektvorgaben (Firmendaten, Recht, Stack)
├── README.md                  lokaler Start, Deployment, TODO-ANWALT-Liste
├── package.json               astro, @tailwindcss/vite, tailwindcss
├── astro.config.mjs           site: https://unfall.sv-rettinger.de, output: static
├── tsconfig.json
├── .env.example               PUBLIC_INTAKE_WEBHOOK_URL, DEPLOY_HOST, DEPLOY_PATH, TUNNEL_NETWORK
├── .gitignore
├── Dockerfile                 Stage 1 node:22-alpine build · Stage 2 nginx:alpine, dist/ → /usr/share/nginx/html
├── docker-compose.yml         Service unfall-web, kein veröffentlichter Port, hängt im Tunnel-Netz
├── nginx.conf                 gzip, Cache-Header für /_astro/*, Security-Header, 404 → /404.html
├── deploy.sh                  ssh → git pull → docker compose up -d --build → Healthcheck über die öffentliche URL
├── public/
│   ├── brand/                 logo.png, favicon.png, vdi-vks-badge.png (per Skript)
│   └── robots.txt
├── scripts/
│   ├── extract-tokens.mjs, fetch-brand.sh   (vorhanden)
│   └── check-jsonld.mjs       liest dist/index.html, prüft Pflichtfelder beider JSON-LD-Blöcke
└── src/
    ├── styles/
    │   ├── tokens.css         extrahierte Variablen (Quelle der Wahrheit)
    │   └── global.css         @import tailwindcss; @theme bindet tokens.css an Tailwind-Utilities
    ├── data/
    │   ├── firma.ts           Name, Adresse, Hotline, WhatsApp, Geo, sameAs, Karten-Links, Rechtslinks
    │   ├── leistungen.ts      die 11 Leistungen, Wortlaut 1:1 aus CLAUDE.md, je mit Detail-URL
    │   └── faq.ts             Frage/Antwort-Paare — eine Quelle für Sektion 3 und FAQPage-JSON-LD
    ├── layouts/BaseLayout.astro   <head>, Meta, Open Graph, Canonical, Favicon, JSON-LD-Slot
    ├── components/
    │   ├── Header.astro       Logo (→ sv-rettinger.de), Hotline-Button rechts
    │   ├── Hero.astro         Sektion 1
    │   ├── CallBar.astro      mobile Fixleiste unten: „Anrufen" | „WhatsApp"
    │   ├── Schritte.astro     Sektion 2
    │   ├── Faq.astro          Sektion 3, <details>/<summary>, ohne JS
    │   ├── Leistungen.astro   Sektion 4
    │   ├── Kontaktformular.astro  Sektion 5, Markup + Client-Script
    │   ├── Footer.astro       Sektion 6
    │   └── JsonLd.astro       LocalBusiness + FAQPage aus data/*
    └── pages/
        ├── index.astro        die Landingpage
        └── 404.astro
```

Alle Firmendaten stehen genau einmal in `data/firma.ts`. Header, Hero, CallBar,
Footer und JSON-LD lesen daraus — kein Duplikat einer Telefonnummer im Markup.

## 2. Technische Entscheidungen

- **Astro 5 + Tailwind 4** über `@tailwindcss/vite`. Tailwind-Farben/-Schriften
  kommen ausschließlich aus `tokens.css` (`@theme { --color-primary: var(--color-primary); … }`).
  Kein Wert wird in einer Komponente hartkodiert.
- **Schriften:** Nutzt die Hauptseite Google Fonts, werden sie **selbst gehostet**
  (`@fontsource/<familie>`), nicht von Google geladen — sonst geht bei jedem
  Aufruf eine IP an Google, ohne Einwilligung (DSGVO, Leitplanke 4). Optisch
  identisch.
- **Kein Tracking, keine Cookies, keine externen Skripte** in Sprint 1. Damit
  ist kein Consent-Banner nötig. Karten nur als Links (Google/Apple), kein Embed.
- **Mobile first:** eine Spalte, Fixleiste mit Anrufen/WhatsApp unten (nur
  < 768 px), Tap-Ziele ≥ 48 px, Grundschrift ≥ 16 px, kein Hero-Bild (Badge +
  Text reichen und laden sofort im Funkloch). Zielwert Lighthouse mobil ≥ 95.
- **Hotline/WhatsApp:** `tel:+4969730444` und
  `https://wa.me/491786626621?text=<vorbelegter Gruß>`. Vorbelegter Text nur
  „Guten Tag, ich hatte einen Unfall und bitte um Rückruf." — keine
  Sachverhaltsabfrage im Link.
- **Formular ohne Backend:** `POST multipart/form-data` per `fetch` an
  `PUBLIC_INTAKE_WEBHOOK_URL` (Build-Zeit-Variable aus `.env`; in Sprint 2 der
  n8n-Webhook). Ist die Variable leer, zeigt das Formular statt Absenden den
  Hinweis „Bitte rufen Sie an oder schreiben Sie per WhatsApp" — die Seite ist
  auch ohne Webhook nie kaputt.
  - Felder (Datenminimierung): Name, Telefon (Pflicht), E-Mail (optional),
    kurze Nachricht (optional), Fotos (bis 5 Stück, JPG/PNG/HEIC, je ≤ 8 MB,
    `capture="environment"` für die Kamera), Einwilligungs-Checkbox mit Link
    auf die Datenschutzerklärung der Hauptseite, Honeypot-Feld.
  - Client-Validierung: Pflichtfelder, Telefonformat, Dateityp/-größe/-anzahl,
    Fehlermeldungen am Feld, `aria-describedby`.
  - Optional (empfohlen): Fotos vor dem Upload clientseitig auf max. 1600 px
    verkleinern (Canvas). Spart am Unfallort Datenvolumen und Zeit. Bitte
    ja/nein entscheiden.
- **Docker/Compose:** Multi-Stage-Build, nginx liefert `dist/` aus. Der Service
  veröffentlicht keinen Port, sondern tritt dem bestehenden Docker-Netz des
  `cloudflared`-Containers bei (`TUNNEL_NETWORK` in `.env`, `external: true`).
  Ingress-Regel im Tunnel: `unfall.sv-rettinger.de → http://unfall-web:80`.
  Läuft `cloudflared` nicht als Container, sondern auf dem Host, bindet Compose
  stattdessen `127.0.0.1:${UNFALL_PORT}` — beides ist über `.env` wählbar.
  Kein PostgreSQL, kein n8n in diesem Compose — das bleibt beim bestehenden
  Stack (Sprint 2 hängt sich dort an).
- **deploy.sh:** von lokal `./deploy.sh` → `ssh $DEPLOY_HOST` → `git pull` auf
  dem VPS → `docker compose up -d --build` → `curl -f https://unfall.sv-rettinger.de/`
  als Abnahme. Bricht bei fehlender `.env` ab. Die Tunnel-Konfiguration selbst
  wird nicht angefasst (einmalige Ingress-Regel, im README beschrieben).

## 3. Inhalte je Sektion

Tonalität wie vorgegeben: Sie-Form, kurze Sätze, ruhig, keine Werbesprache,
kein Angstmarketing. Alles Allgemeine, nichts Einzelfallbezogenes.

### Header
Logo (Link zur Hauptseite), rechts Button „069 730 444" (`tel:`). Auf dem
Handy nur Logo — die Fixleiste unten übernimmt.

### Sektion 1 — Hero
- H1: **Unfall? Wir helfen sofort.**
- Unterzeile: Unabhängige Kfz-Sachverständige in Frankfurt am Main. Rufen Sie
  an oder schreiben Sie per WhatsApp — wir melden uns umgehend.
- Zwei große Buttons: **Jetzt anrufen** (`tel:`) · **Per WhatsApp schreiben**
  (`wa.me`), je mit Nummer als Text darunter.
- VDI/VKS-Badge above the fold, daneben drei ruhige Fakten:
  VDI/VKS-qualifiziert · Gutachten in 24 Stunden · Frankfurt am Main.
- Hinweiskasten „Gut zu wissen": *Bei einem Schaden, der kein Bagatellschaden
  ist, dürfen Geschädigte grundsätzlich einen eigenen, unabhängigen
  Sachverständigen beauftragen.* → Kernbotschaft, allgemein gehalten.

### Sektion 2 — Drei Schritte
1. **Melden.** Anruf, WhatsApp oder Formular. Fotos vom Schaden reichen für den Anfang.
2. **Begutachtung.** Wir kommen zu Ihnen, in die Werkstatt oder Sie kommen zu uns.
   Frankfurt und Umgebung.
3. **Gutachten in 24 Stunden.** Nach der Besichtigung. Sie erhalten es digital,
   auf Wunsch geht es an Ihre Werkstatt, Versicherung oder Ihren Anwalt.

### Sektion 3 — FAQ (Standard-Einwände der gegnerischen Versicherung)
Wortlaut kommt in der Umsetzung; hier die Fragen und die Richtung der Antwort.
Jede Antwort endet, wo es um den Einzelfall geht, mit dem Verweis auf einen
Anwalt. Unsichere Stellen werden mit `TODO-ANWALT` markiert.

1. **„Die Versicherung schickt ihren eigenen Gutachter. Muss ich den nehmen?"**
   Allgemein: Wahl des Sachverständigen liegt beim Geschädigten, außer bei
   Bagatellschäden. Kein „Sie haben Anspruch".
2. **„Wer bezahlt das Gutachten?"** Allgemein: Bei unverschuldetem Unfall
   gehören die Gutachterkosten üblicherweise zum Schaden, den die
   gegnerische Haftpflicht reguliert. Bei unklarer Haftung → Anwalt.
   `TODO-ANWALT` für die genaue Formulierung.
3. **„Was ist ein Bagatellschaden?"** Allgemein: eine grobe Grenze aus der
   Rechtsprechung; darunter reicht oft ein Kostenvoranschlag. Ob der
   eigene Schaden darunter liegt, sieht man von außen selten. `TODO-ANWALT`
   für die Betragsgrenze.
4. **„Die Versicherung bietet mir eine schnelle Auszahlung ohne Gutachten an."**
   Allgemein: Was eine Pauschale abdeckt, zeigt sich erst mit einer
   Schadenaufnahme (Wertminderung, verdeckte Schäden). Neutral, ohne Polemik.
5. **„Muss ich in die Partnerwerkstatt der Versicherung?"** Allgemein:
   Werkstattwahl ist grundsätzlich frei. `TODO-ANWALT`.
6. **„Was soll ich am Unfallort tun?"** Praktisch: Unfallstelle sichern,
   Fotos, Daten austauschen, bei Personenschaden oder Streit Polizei, nichts
   unterschreiben, was man nicht versteht.
7. **„Wie schnell bekomme ich das Gutachten?"** 24 Stunden nach Besichtigung.
8. **„Brauche ich einen Anwalt?"** Wir beraten nicht rechtlich. Bei Fragen
   zur Haftung oder wenn die Versicherung kürzt: Verkehrsrechtsanwalt.

### Sektion 4 — Leistungen
Die 11 Leistungen wortgleich aus `CLAUDE.md`, als Liste mit Link auf die
jeweilige Detailseite der Hauptseite. Die Detail-URLs liefert
`brand-extract.json` (`internalLinks`); bis dahin Platzhalter, gekennzeichnet.
Kurze Einleitung: „Was wir außerdem tun" — keine Beschreibungstexte, die
Detailseiten übernehmen das.

### Sektion 5 — Kontaktformular
Überschrift „Schaden melden — wir rufen zurück." Felder wie in Abschnitt 2.
Nach dem Absenden Bestätigung inline: „Vielen Dank. Wir melden uns umgehend.
In dringenden Fällen: 069 730 444." Einwilligungstext: `TODO-ANWALT`.

### Sektion 6 — Footer
Firmierung + Zusatz, Adresse, Hotline, WhatsApp, Links Google Maps / Apple
Karten, Social-Links (Facebook, Instagram, YouTube), Links **Impressum ·
Datenschutzerklärung · AGB (PDF)** auf die Hauptseite. Keine eigenen Rechtstexte.
Hinweiszeile: „Hinweis: Wir sind Sachverständige, keine Rechtsberatung."

## 4. Strukturierte Daten

Ein `<script type="application/ld+json">` pro Typ, erzeugt aus `data/`:

- **LocalBusiness:** `name` „Rettinger & Kollegen", `alternateName` „KFZ Prüf-
  und Schätzstelle", `address` (PostalAddress), `telephone` +4969730444,
  `geo` 50.104989/8.616314, `url` https://sv-rettinger.de, `hasMap`,
  `image`/`logo` (Logo), `sameAs` (3 Profile), `areaServed` Frankfurt am Main,
  `contactPoint` (Unfallhotline, `availableLanguage: de`),
  `openingHoursSpecification` — **Öffnungszeiten fehlen, siehe offene Punkte**.
  Nur Frankfurt, kein Mannheim (bis zur Klärung).
- **FAQPage:** `mainEntity` = alle Frage/Antwort-Paare aus `faq.ts`, Wortlaut
  identisch mit dem sichtbaren Text (Bedingung von Google).
- Prüfung: `scripts/check-jsonld.mjs` nach dem Build (Pflichtfelder, gültiges
  JSON) plus manuell Rich Results Test — der hat keine API.

## 5. Nicht in Sprint 1
Backend/n8n-Webhook, PostgreSQL, Auto-Antworten, Telefon-Assistent, Cloudflare
Access, Anpassung der Datenschutzerklärung (Anwalt), Mannheim-Standort.

## 6. Offene Punkte — bitte mit der Freigabe beantworten

1. **Zugriff auf sv-rettinger.de:** Skripte lokal ausführen und das Ergebnis
   committen — oder die Domain für die Session freischalten?
2. **Öffnungszeiten** des Büros und Erreichbarkeit der Hotline (rund um die
   Uhr?). Ohne Angabe bleibt `openingHoursSpecification` weg.
3. **cloudflared:** läuft er als Container (Name des Docker-Netzes?) oder als
   Dienst auf dem Host?
4. **Fotos clientseitig verkleinern** vor dem Upload: ja/nein?
5. **Ablage unter `unfall/`** in diesem Repo in Ordnung?
6. **Schriften selbst hosten** statt Google Fonts: in Ordnung?
