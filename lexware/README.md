# Sendungsabrechnung → lexoffice

Erzeugt aus einem Sendungs-Export Rechnungs**entwürfe** in lexoffice: eine
Sammelrechnung je Kunde, eine Position je Sendung. Das Festschreiben und
Versenden bleibt manuell in Lexware.

## Warum der Order-Code und nicht die Tracking-Nummer

Der Abgleich gegen Doppelabrechnung läuft über `shipment_ext_order_code`
(`JBD…`), nicht über die Tracking-Nummer. Grund: im Export
`shopments_ab_mai_2026.ods` wurde die Spalte `shipment_ext_tracking_number`
als Fließkommazahl gespeichert — alle 18 Zeilen enthalten identisch
`3.40433880660022E+017`. Der Wert ist weder eindeutig noch rekonstruierbar.
Der Order-Code ist dagegen in jeder Zeile eindeutig.

Damit der Abgleich künftig auch gegen Lexware selbst funktioniert, schreibt
das Script den Order-Code in die Beschreibung **jeder** Rechnungsposition:

```
DHL Paket 20
Sendung JBD260612GWE002550000076 | 12.06.2026 | 16 kg
```

Deshalb wird pro Sendung eine eigene Position erzeugt und nicht nach Produkt
zusammengefasst.

## Duplikatschutz

Vor jedem Lauf werden drei Quellen zu einer Sperrliste vereinigt:

1. **`data/invoiced_ledger.json`** — lokaler Bestand, wird nach jeder
   erfolgreich angelegten Rechnung sofort fortgeschrieben. Bricht ein Lauf
   mittendrin ab, gelten die bereits angelegten Rechnungen als erledigt.
2. **lexoffice selbst** — sofern `LEXOFFICE_API_KEY` gesetzt ist, werden alle
   bestehenden Rechnungen (Entwurf, offen, bezahlt, storniert) geladen und
   ihre Positionen nach `JBD…`-Codes durchsucht.
3. **`--skip-order-code`** — für Sendungen, die außerhalb von Lexware
   abgerechnet wurden.

Ein zweiter Lauf mit derselben Quelldatei erzeugt daher nichts mehr.

## Einrichtung

1. **API-Key** in Lexware unter *Erweiterungen → lexoffice Public API*
   erzeugen und als Umgebungsvariable setzen — nicht in eine Datei im Repo:

   ```bash
   export LEXOFFICE_API_KEY="…"
   ```

2. **Kontakte zuordnen.** In `contacts_map.json` je `customer_id` die
   lexoffice-`contactId` eintragen (steht in der URL der Kontaktseite):

   ```json
   { "1": "…", "48": "…", "57": "…" }
   ```

   Fehlt eine ID, bricht `--create-drafts` ab. Das Script legt bewusst keine
   Kontakte an, um Dubletten zu vermeiden.

## Ausführung

Nur Python 3 der Standardbibliothek, keine Installation nötig.

```bash
# 1. Dry-Run ohne Key: rechnet und berichtet, schreibt nichts
python3 shipments_to_invoices.py --source ../pfad/shopments_ab_mai_2026.ods

# 2. Dry-Run mit Key: prüft zusätzlich Auth und den Bestand in lexoffice
LEXOFFICE_API_KEY=… python3 shipments_to_invoices.py --source … --dry-run

# 3. Erst eine kleine Rechnung echt anlegen und in Lexware prüfen
LEXOFFICE_API_KEY=… python3 shipments_to_invoices.py --source … \
    --create-drafts --exclude-customer 48 --exclude-customer 57

# 4. Rest anlegen
LEXOFFICE_API_KEY=… python3 shipments_to_invoices.py --source … --create-drafts
```

`--dry-run` ist der Standard; Schreiben erfordert immer `--create-drafts`.

### Optionen

| Option | Wirkung |
|---|---|
| `--source PATH` | Quelldatei, `.ods` oder `.csv` (Pflicht) |
| `--dry-run` | Nichts schreiben, nur Report (Standard) |
| `--create-drafts` | Entwürfe in lexoffice anlegen |
| `--exclude-customer ID` | `customer_id` ausschließen, mehrfach nutzbar |
| `--skip-order-code CODE` | Order-Code als abgerechnet behandeln, mehrfach nutzbar |
| `--vat-rate 19` | USt-Satz in Prozent |

## Abbruchbedingungen

Das Script bricht ab, statt eine falsche Rechnung zu erzeugen, wenn:

- ein Order-Code leer oder doppelt ist,
- `product_price` fehlt, unlesbar oder nicht positiv ist,
- `shipment_weight` das `product_max_weight` des Produkts überschreitet,
- `customer_id` fehlt,
- bei `--create-drafts` der API-Key oder eine `contactId` fehlt.

Rundungen (z. B. `4.93025` → `4.93`, `ROUND_HALF_UP`) brechen den Lauf nicht
ab, erscheinen aber als Hinweis im Report.

## Ausgabe

Report nach stdout und als `data/report_<zeitstempel>.md` mit allen Positionen,
Summen je Rechnung, Gesamtsumme und der Liste der übersprungenen Sendungen samt
Fundstelle. Die Reports sind über `.gitignore` ausgenommen.

## Stand der API-Anbindung

Die verwendeten Endpunkte (`GET /v1/profile`, `GET /v1/voucherlist`,
`GET /v1/invoices/{id}`, `POST /v1/invoices?finalize=false`) und die Struktur
des Request-Body sind **nicht gegen die Live-Dokumentation verifiziert** —
`developers.lexware.io` und `api.lexoffice.io` waren aus der Entwicklungs-
umgebung durch die Netzwerkrichtlinie gesperrt. Schritt 2 oben (Dry-Run mit
Key) ist genau dafür da: er ruft `profile` und `voucherlist` wirklich auf und
deckt falsche Feldnamen auf, bevor irgendetwas geschrieben wird.

Der Client drosselt auf 2 Requests/Sekunde und wiederholt `429`/`5xx` mit
exponentiellem Backoff unter Beachtung von `Retry-After`.
