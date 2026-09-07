# Prompt für Claude Cowork

Diese Datei ist als Prompt gedacht: kopiere alles unterhalb der Trennlinie in
Claude Cowork auf einem Rechner mit Netzzugang zu `api.lexoffice.io`.

Hintergrund: Das Script in diesem Verzeichnis kann aus der Claude-Code-Web-
Umgebung nicht ausgeführt werden — die gesamte Lexware-Domainfamilie ist dort
durch die Egress-Richtlinie gesperrt. Der Lauf passiert deshalb lokal.

---

Du hast Netzzugang zu api.lexoffice.io — eine frühere Session hatte den nicht
und konnte den Lauf deshalb nicht selbst ausführen. Führe ihn jetzt aus.

## Ziel

Aus einem Sendungs-Export sollen in lexoffice drei Rechnungs-ENTWÜRFE
entstehen: eine Sammelrechnung je Kunde, eine Position je Sendung.
Festschreiben und Versenden mache ich anschließend selbst in Lexware —
du legst ausschließlich Entwürfe an.

## Ausgangslage

Repository: kandziormannheim-dot/files
Branch:     claude/lexware-rechnungen-schreiben-lb84q8

Dort liegt alles Nötige:

- `lexware/shipments_to_invoices.py` — das Script (nur Standardbibliothek,
  keine Installation nötig)
- `lexware/data/shipments_ab_mai_2026.csv` — die Sendungsdaten, 18 Zeilen
- `lexware/contacts_map.json` — Zuordnung customer_id → lexoffice contactId
- `lexware/README.md` — lies das zuerst, es erklärt die Duplikat-Logik,
  die Abbruchbedingungen und den Stand der API-Anbindung

Checke den Branch aus und lies das README, bevor du irgendetwas ausführst.

## Was ich beisteuere

- `LEXOFFICE_API_KEY` setze ich als Umgebungsvariable. Frag mich danach,
  falls sie fehlt. Schreib den Key NIEMALS in eine Datei, ein Log, einen
  Commit oder eine Ausgabe.
- Die contactIds trage ich in `lexware/contacts_map.json` ein, für die
  Kunden 1 (NEOS Logistics UG), 48 (UPS Capital Vers. GmbH) und
  57 (Q-Peak GmbH). Fehlen sie, frag mich — lege auf keinen Fall selbst
  Kontakte in lexoffice an, das erzeugt Dubletten.

## Ablauf — halte diese Reihenfolge ein

**Schritt 1 — Dry-Run ohne Netz.** Rechnet nur, schreibt nichts:

    python3 lexware/shipments_to_invoices.py \
        --source lexware/data/shipments_ab_mai_2026.csv --dry-run

Erwartetes Ergebnis, exakt:

| Kunde                  | customer_id | Positionen | Netto     |
|------------------------|------------:|-----------:|----------:|
| NEOS Logistics UG      |           1 |          1 |    4,93 € |
| UPS Capital Vers. GmbH |          48 |          3 |   14,85 € |
| Q-Peak GmbH            |          57 |         14 |  110,80 € |
| **Gesamt**             |             |     **18** | **130,58 €** |

Gesamt brutto 155,39 € (24,81 € USt). Weicht irgendetwas ab: STOPP,
zeig mir die Ausgabe, mach nicht weiter.

**Schritt 2 — Dry-Run mit Key.** Jetzt wird die API wirklich angesprochen,
aber immer noch nichts geschrieben:

    LEXOFFICE_API_KEY=… python3 lexware/shipments_to_invoices.py \
        --source lexware/data/shipments_ab_mai_2026.csv --dry-run

Das ruft `GET /v1/profile` und den `voucherlist`-Scan real auf. Prüfe:
Ist der angezeigte Firmenname mein Konto? Findet der Scan Rechnungen, die
bereits Order-Codes (`JBD…`) aus der Quelldatei enthalten? Solche Sendungen
werden als "übersprungen" ausgewiesen und dürfen NICHT erneut berechnet
werden — das ist der ganze Zweck der Übung.

Falls hier ein HTTP-Fehler kommt: der API-Vertrag wurde gegen den Client
`lexoffice-client` (PyPI 0.2.0) abgeglichen und stimmt, bis auf zwei
ungeprüfte Details — der Parameter `size=100` auf `voucherlist` und das
explizite `finalize=false`. Das sind die ersten Verdächtigen. Nenn mir den
Fehler, bevor du am Script änderst.

**Schritt 3 — eine einzelne kleine Rechnung echt anlegen.** Die kleinste
zuerst, damit ein Fehler billig bleibt:

    LEXOFFICE_API_KEY=… python3 lexware/shipments_to_invoices.py \
        --source lexware/data/shipments_ab_mai_2026.csv \
        --create-drafts --exclude-customer 48 --exclude-customer 57

Das legt nur die NEOS-Rechnung über 5,87 € brutto an. Dann STOPP und sag
mir Bescheid — ich sehe sie mir in Lexware an. So muss eine Position
aussehen:

    DHL Paket DE 2
    Sendung JBD260522GWE002550000283 | 22.05.2026 | 2 kg | ID 178
    1 Sendung × 4,93 € netto (19 % USt)

Geprüft wird: richtiger Kontakt, Order-Code in der Beschreibung, Gewicht
und Einzelpreis korrekt, Status *Entwurf*. Erst wenn ich das freigebe,
geht es weiter.

**Schritt 4 — Rest anlegen**, nach meiner Freigabe:

    LEXOFFICE_API_KEY=… python3 lexware/shipments_to_invoices.py \
        --source lexware/data/shipments_ab_mai_2026.csv --create-drafts

**Schritt 5** — commite das fortgeschriebene `lexware/data/invoiced_ledger.json`
auf denselben Branch und pushe. Das ist der Nachweis, welche Sendungen
abgerechnet sind, und verhindert Doppelabrechnung bei künftigen Läufen.
Der Report unter `lexware/data/report_*.md` ist per .gitignore ausgenommen —
zeig ihn mir stattdessen im Chat.

## Grenzen

- Niemals `finalize=true`, niemals Rechnungen festschreiben oder versenden.
- Niemals Kontakte in lexoffice anlegen.
- Niemals das Ledger von Hand kürzen — das erzeugt Doppelabrechnungen.
- Bei Unstimmigkeiten in den Daten bricht das Script bewusst ab. Umgeh das
  nicht; zeig mir den Abbruch.

## Kontext, den du kennen solltest

- Der Abgleich gegen Doppelabrechnung läuft über `shipment_ext_order_code`,
  nicht über die Tracking-Nummer: die ist im Originalexport als
  Fließkommazahl gespeichert und in allen 18 Zeilen identisch, also
  unbrauchbar. Details im README.
- Die `ID` am Ende der Positionsbeschreibung ist die interne `shipment_id`
  für meine eigene Rückverfolgung.
- NEOS Logistics UG ist womöglich meine eigene Gesellschaft. Sie ist auf
  meinen ausdrücklichen Wunsch im Umfang — frag nicht erneut nach.
- Die drei UPS-Capital-Sendungen stammen aus Dez 2025 und stehen seit dem
  auf `in_transit`. Falls Schritt 2 zeigt, dass sie schon fakturiert wurden,
  greift der Duplikatschutz automatisch.
