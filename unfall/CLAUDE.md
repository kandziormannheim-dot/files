# CLAUDE.md — Projekt "Unfall-Landingpage Rettinger & Kollegen"

## Zweck des Projekts

Eine eigenständige Landingpage plus Intake-Automatisierung, die Unfallgeschädigte
innerhalb der ersten Minuten nach dem Schadensfall abholt — bevor die gegnerische
Versicherung anruft und einen eigenen Gutachter schickt.

Kernziele in dieser Reihenfolge:
1. Sofortige Erreichbarkeit (WhatsApp, Formular, später Telefon-Assistent)
2. Vertrauen durch Aufklärung (freie Gutachterwahl)
3. Sichtbarkeit in Suchmaschinen **und** KI-Assistenten (strukturierte Daten)

## Auftraggeber / Firmendaten

| Feld | Wert |
| --- | --- |
| Firmierung | Rettinger & Kollegen |
| Zusatz | KFZ Prüf- und Schätzstelle |
| Adresse | Schmidtstraße 63, 60326 Frankfurt am Main |
| Unfallhotline | 069 730 444 (`tel:+4969730444`) |
| WhatsApp | +49 178 662 6621 (`https://wa.me/491786626621`) |
| Hauptdomain | https://sv-rettinger.de |
| Ziel-Subdomain | unfall.sv-rettinger.de |

**OFFEN — vor Go-live klären:** Gibt es einen zweiten Standort in Mannheim?
Falls ja, muss die `LocalBusiness`-Auszeichnung zwei Filialen abbilden und der
Einzugsradius für Partnerwerkstätten entsprechend geplant werden. Bis zur Klärung
ausschließlich Frankfurt verwenden.

### Social-Profile (für `sameAs` im JSON-LD)

- Facebook: https://www.facebook.com/Rettinger-Kollegen-Kfz-Sachverständigenbüro-336100083173866/
- Instagram: https://www.instagram.com/sv_rettinger_kollegen/
- YouTube: https://www.youtube.com/@rettingerkollegen8061

### Karten-Links

- Google Maps: https://maps.app.goo.gl/D29WqKNjQNWpBq1o9
- Apple Karten: Eintrag "KFZ-Gutachter Rettinger & Kollegen", 50.104989 / 8.616314

## Leistungsspektrum

Vollständige Liste, so wie auf der Hauptseite geführt. Nicht kürzen, nicht
umbenennen — diese Begriffe sind die Suchbegriffe.

- Beweissicherung
- Gutachten für Elektrofahrzeuge
- Classic Data Bewertungen
- Motorradgutachten
- Caravan- und Wohnmobilgutachten
- Fahrrad, Pedelecs, S-Pedelecs, E-Bikes
- Vorschadenuntersuchung / technische Prüfberichte
- Zeitwertschätzung
- Auslandsunfall
- Modernste Vermessungstechnik
- Akustische Fehlersuche (störende Geräusche)

## Marken-Assets

Direkt von der Hauptseite übernehmen, nichts neu gestalten. Nach `/public/brand/`
herunterladen:

- Logo: `https://sv-rettinger.de/wp-content/uploads/2025/07/cropped-rettinger_kollegen_logo_01.png`
- Favicon: `https://sv-rettinger.de/wp-content/uploads/2025/09/cropped-rettinger_kollegen_favicon-scaled-1-300x300.png`
- Trust-Badge VDI/VKS: `https://sv-rettinger.de/wp-content/uploads/2026/05/RK-VDI-Qualifield-Experts-VKS.png`

Das VDI/VKS-Badge gehört **above the fold**. Es ist das stärkste
Vertrauenssignal gegen das Argument "nehmen Sie unseren Gutachter".

### Design-Tokens

Farben, Schriftfamilien und Button-Stile werden **nicht erfunden**, sondern aus
der CSS von sv-rettinger.de extrahiert und in `src/styles/tokens.css` abgelegt.
Die Landingpage muss für einen Besucher erkennbar zur Hauptseite gehören.

## Rechtliche Leitplanken

Diese Regeln gelten für jeden generierten Text und jede Funktion. Im Zweifel
weniger schreiben, nicht mehr.

1. **Kein RDG-Verstoß.** Rettinger & Kollegen ist Sachverständigenbüro, keine
   Rechtsberatung. Zulässig sind allgemeine Hinweise zur freien Gutachterwahl,
   unzulässig ist die Bewertung eines konkreten Einzelfalls, Formulierungen wie
   "Sie haben Anspruch auf X" oder das Ausfüllen von Ansprüchen für Mandanten.
   Formulierung immer allgemein halten und im Zweifel an einen Anwalt verweisen.
2. **Keine Rechtsberatung durch Automatisierung.** Auto-Antworten in WhatsApp,
   Formular oder Telefon-Assistent bestätigen den Eingang, bieten einen Termin an
   und stellen Rückfragen zum Sachverhalt. Sie bewerten die Haftungslage nicht.
3. **KI-Kennzeichnung.** Jeder automatisierte Dialog (Telefon, Chat) gibt sich zu
   Beginn als KI-Assistent zu erkennen. Keine Vortäuschung eines Menschen.
4. **DSGVO.** Unfalldaten sind sensibel. Datenminimierung, Hosting in der EU,
   Löschkonzept, Auftragsverarbeitungsverträge mit allen Dienstleistern,
   Einwilligung vor jedem nicht-notwendigen Cookie oder Tracking.
5. **Bestehende Rechtstexte verlinken, nicht duplizieren:**
   - Impressum: https://sv-rettinger.de/impressum/
   - Datenschutzerklärung: https://sv-rettinger.de/datenschutzerklaerung/
   - AGB (PDF): https://sv-rettinger.de/wp-content/uploads/2025/09/AuftragsbedingungAGB.pdf

   Die Datenschutzerklärung muss um die neuen Verarbeitungen (Formular-Upload,
   WhatsApp, ggf. Telefon-Assistent) ergänzt werden — das ist eine Aufgabe für
   den Anwalt, nicht für uns.
6. Alle Rechtstexte und die Formulierungen zur freien Gutachterwahl gehen vor
   Go-live durch anwaltliche Prüfung.

## Tonalität

- Deutsch, Sie-Form, sachlich und ruhig.
- Zielgruppe steht unter Stress und liest auf dem Handy am Unfallort.
- Kurze Sätze, keine Fachbegriffe ohne Erklärung, keine Werbesprache.
- Kein Angstmarketing gegen Versicherungen. Wir klären auf, wir polemisieren nicht.
- Wichtigste Botschaft: Bei einem nicht-bagatellhaften Schaden darf der
  Geschädigte grundsätzlich einen eigenen, unabhängigen Sachverständigen
  beauftragen. Diese Aussage immer allgemein halten (siehe Punkt 1).

## Technischer Stack

Bestehende Infrastruktur nutzen, nichts Neues einführen.

- **Frontend:** Astro, statisch generiert, Tailwind. Kein WordPress.
- **Hosting:** Hostinger VPS, Ubuntu 24.04, Docker Compose
- **Reverse Proxy / Zugang:** Cloudflare Tunnel
- **Automatisierung:** n8n (bestehende Instanz)
- **Datenhaltung:** PostgreSQL im selben Compose-Stack
- **Admin-Bereiche:** hinter Cloudflare Access, nie öffentlich

Die WordPress-Hauptseite bleibt unangetastet. Deployment erfolgt ausschließlich
auf die Subdomain. Niemals im Live-WordPress arbeiten.

## Struktur der Landingpage

1. Hero: Unfall? Sofort-Hilfe. Hotline + WhatsApp als Buttons, VDI/VKS-Badge
2. Drei Schritte: Melden → Begutachtung → Gutachten in 24 Stunden
3. FAQ mit den Standard-Einwänden der gegnerischen Versicherung
4. Leistungsübersicht (Liste oben), verlinkt auf die Detailseiten der Hauptseite
5. Kontaktformular mit Foto-Upload
6. Footer mit Impressum, Datenschutz, AGB

### Strukturierte Daten (Pflicht)

- `LocalBusiness` mit Adresse, Telefon, Geo, Öffnungszeiten, `sameAs`
- `FAQPage` für den FAQ-Block
- Beides als JSON-LD, valide gegen den Rich Results Test

Das ist die Grundlage dafür, dass KI-Assistenten das Büro als Entität erkennen
und bei Fragen wie "muss ich den Gutachter der Versicherung nehmen" zitieren.

## Arbeitsweise in diesem Repo

- Vor jedem Sprint erst einen Plan schreiben, dann nach Freigabe implementieren.
- `deploy.sh` rollt über den bestehenden Cloudflare Tunnel aus. Kein manuelles
  Deployment.
- Keine Secrets im Repo. `.env` bleibt lokal, `.env.example` wird gepflegt.
- Commits auf Deutsch, kurz und im Imperativ.
- Bei rechtlich heiklen Formulierungen: nachfragen statt raten.
