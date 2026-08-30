#!/usr/bin/env python3
"""Erzeugt aus einem Sendungs-Export Rechnungsentwuerfe in lexoffice.

Eine Sammelrechnung je Kunde, eine Rechnungsposition je Sendung. Der
Order-Code (shipment_ext_order_code) steht in jeder Position und dient als
Schluessel gegen Doppelabrechnung -- die Tracking-Nummer taugt dafuer nicht,
sie ist im Export als Float verstuemmelt.

Nur Standardbibliothek, damit das Script ohne Installation laeuft.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import OrderedDict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

API_BASE = "https://api.lexoffice.io"
ORDER_CODE_RE = re.compile(r"JBD\d{6}[A-Z]{3}\d{12}")
MIN_REQUEST_INTERVAL = 0.5  # lexoffice erlaubt 2 Requests/Sekunde
MAX_RETRIES = 5

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
LEDGER_PATH = os.path.join(DATA_DIR, "invoiced_ledger.json")
CONTACTS_MAP_PATH = os.path.join(HERE, "contacts_map.json")

ODS_NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}
_T = "{%s}" % ODS_NS["table"]
_O = "{%s}" % ODS_NS["office"]
_X = "{%s}" % ODS_NS["text"]


class AbortRun(Exception):
    """Ein Zustand, bei dem weiterzumachen falsche Rechnungen erzeugen wuerde."""


# --------------------------------------------------------------------------
# Einlesen
# --------------------------------------------------------------------------

def _ods_cell_value(cell):
    vtype = cell.get(_O + "value-type")
    if vtype == "date":
        return cell.get(_O + "date-value") or ""
    if vtype in ("float", "currency", "percentage"):
        return cell.get(_O + "value") or ""
    return "\n".join("".join(p.itertext()) for p in cell.iter(_X + "p"))


def read_ods(path):
    """Liest das erste Tabellenblatt einer ODS-Datei als Liste von Dicts."""
    with zipfile.ZipFile(path) as zf:
        content = zf.read("content.xml")
    root = ET.fromstring(content)

    rows = []
    for table in root.iter(_T + "table"):
        for row in table.findall(_T + "table-row"):
            row_repeat = int(row.get(_T + "number-rows-repeated", "1"))
            cells = []
            for cell in row.findall(_T + "table-cell"):
                col_repeat = int(cell.get(_T + "number-columns-repeated", "1"))
                # Ein Wiederholungszaehler in dieser Groessenordnung ist die
                # Fuellung bis zum Blattrand, keine echten Spalten.
                if col_repeat > 200:
                    col_repeat = 1
                cells.extend([_ods_cell_value(cell)] * col_repeat)
            while cells and not cells[-1]:
                cells.pop()
            if row_repeat > 200:
                row_repeat = 1
            rows.extend([cells] * row_repeat)
        break  # nur das erste Blatt

    while rows and not any(rows[-1]):
        rows.pop()
    if not rows:
        raise AbortRun("Die ODS-Datei enthaelt keine Daten.")

    header = rows[0]
    return [
        {header[i]: (row[i] if i < len(row) else "") for i in range(len(header))}
        for row in rows[1:]
    ]


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def read_source(path):
    if path.lower().endswith(".ods"):
        rows = read_ods(path)
    elif path.lower().endswith((".csv", ".tsv")):
        rows = read_csv(path)
    else:
        raise AbortRun("Unbekanntes Quellformat: %s (erwartet .ods oder .csv)" % path)
    # Tabellenkalkulationen haengen gern formatierte Leerzeilen an das Blatt.
    return [r for r in rows if any((v or "").strip() for v in r.values())]


# --------------------------------------------------------------------------
# Validierung
# --------------------------------------------------------------------------

REQUIRED_COLUMNS = [
    "shipment_id",
    "shipment_ext_order_code",
    "shipment_weight",
    "shipment_created_at",
    "customer_id",
    "customer_address_name",
    "product_name",
    "product_price",
    "product_max_weight",
]


def money(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def validate(rows):
    """Prueft die Zeilen. Sammelt alle Fehler, statt beim ersten abzubrechen."""
    if not rows:
        raise AbortRun("Die Quelldatei enthaelt keine Sendungen.")

    missing = [c for c in REQUIRED_COLUMNS if c not in rows[0]]
    if missing:
        raise AbortRun("Der Quelldatei fehlen Spalten: %s" % ", ".join(missing))

    errors = []
    warnings = []
    seen_codes = {}

    for index, row in enumerate(rows, start=2):
        where = "Zeile %d (shipment_id=%s)" % (index, row.get("shipment_id") or "?")

        code = (row.get("shipment_ext_order_code") or "").strip()
        if not code:
            errors.append("%s: shipment_ext_order_code ist leer." % where)
        elif code in seen_codes:
            errors.append(
                "%s: Order-Code %s doppelt, zuerst in Zeile %d."
                % (where, code, seen_codes[code])
            )
        else:
            seen_codes[code] = index

        try:
            price = Decimal(row["product_price"])
        except Exception:
            errors.append(
                "%s: product_price %r ist keine Zahl." % (where, row.get("product_price"))
            )
        else:
            if price <= 0:
                errors.append("%s: product_price %s ist nicht positiv." % (where, price))
            elif money(price) != price:
                warnings.append(
                    "%s: product_price %s wird auf %s gerundet (Differenz %s)."
                    % (where, price, money(price), money(price) - price)
                )

        try:
            weight = Decimal(row["shipment_weight"])
            max_weight = Decimal(row["product_max_weight"])
        except Exception:
            errors.append("%s: Gewicht oder Maximalgewicht ist keine Zahl." % where)
        else:
            if weight > max_weight:
                errors.append(
                    "%s: Gewicht %s kg ueberschreitet das Maximum %s kg von %r."
                    % (where, weight, max_weight, row.get("product_name"))
                )

        if not (row.get("customer_id") or "").strip():
            errors.append("%s: customer_id fehlt." % where)

    if errors:
        raise AbortRun(
            "Die Quelldaten sind nicht abrechenbar:\n  - " + "\n  - ".join(errors)
        )
    return warnings


# --------------------------------------------------------------------------
# Ledger und Kontakt-Zuordnung
# --------------------------------------------------------------------------

def load_ledger():
    if not os.path.exists(LEDGER_PATH):
        return {}
    with open(LEDGER_PATH, encoding="utf-8") as fh:
        content = fh.read().strip()
    if not content:
        return {}
    data = json.loads(content)
    return data.get("invoiced", {})


def save_ledger(invoiced):
    os.makedirs(DATA_DIR, exist_ok=True)
    payload = {
        "_comment": (
            "Bereits fakturierte Order-Codes. Wird nach jeder erfolgreich "
            "angelegten Rechnung fortgeschrieben. Nicht von Hand kuerzen -- "
            "sonst entstehen Doppelabrechnungen."
        ),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "invoiced": invoiced,
    }
    tmp = LEDGER_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False, sort_keys=True)
        fh.write("\n")
    os.replace(tmp, LEDGER_PATH)


def load_contacts_map():
    if not os.path.exists(CONTACTS_MAP_PATH):
        return {}
    with open(CONTACTS_MAP_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    return {
        str(k): v
        for k, v in data.items()
        if not k.startswith("_") and isinstance(v, str) and v.strip()
    }


# --------------------------------------------------------------------------
# lexoffice-Client
# --------------------------------------------------------------------------

class LexofficeClient:
    def __init__(self, api_key, base=API_BASE):
        self.api_key = api_key
        self.base = base.rstrip("/")
        self._last_request = 0.0

    def _throttle(self):
        elapsed = time.monotonic() - self._last_request
        if elapsed < MIN_REQUEST_INTERVAL:
            time.sleep(MIN_REQUEST_INTERVAL - elapsed)
        self._last_request = time.monotonic()

    def request(self, method, path, params=None, body=None):
        url = self.base + path
        if params:
            url += "?" + urllib.parse.urlencode(params)
        data = json.dumps(body).encode("utf-8") if body is not None else None

        for attempt in range(MAX_RETRIES):
            self._throttle()
            req = urllib.request.Request(url, data=data, method=method)
            req.add_header("Authorization", "Bearer %s" % self.api_key)
            req.add_header("Accept", "application/json")
            if data is not None:
                req.add_header("Content-Type", "application/json")

            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "replace")
                retryable = exc.code == 429 or 500 <= exc.code < 600
                if retryable and attempt < MAX_RETRIES - 1:
                    wait = float(exc.headers.get("Retry-After") or 0) or 2 ** attempt
                    print(
                        "    HTTP %d, erneuter Versuch in %.0fs ..." % (exc.code, wait),
                        file=sys.stderr,
                    )
                    time.sleep(wait)
                    continue
                raise AbortRun(
                    "%s %s -> HTTP %d: %s" % (method, path, exc.code, detail[:500])
                )
            except urllib.error.URLError as exc:
                if attempt < MAX_RETRIES - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise AbortRun("%s %s nicht erreichbar: %s" % (method, path, exc.reason))
        raise AbortRun("%s %s: Versuche erschoepft." % (method, path))

    def profile(self):
        return self.request("GET", "/v1/profile")

    def iter_invoice_ids(self):
        page = 0
        while True:
            result = self.request(
                "GET",
                "/v1/voucherlist",
                params={
                    "voucherType": "invoice",
                    "voucherStatus": "draft,open,paid,voided",
                    "page": page,
                    "size": 100,
                },
            )
            for voucher in result.get("content", []):
                if voucher.get("id"):
                    yield voucher
            if page + 1 >= int(result.get("totalPages", 0) or 0):
                return
            page += 1

    def invoice(self, invoice_id):
        return self.request("GET", "/v1/invoices/%s" % invoice_id)

    def create_invoice_draft(self, payload):
        return self.request(
            "POST", "/v1/invoices", params={"finalize": "false"}, body=payload
        )


def scan_remote_order_codes(client):
    """Sammelt alle Order-Codes, die in lexoffice bereits auf einer Rechnung stehen."""
    found = {}
    vouchers = list(client.iter_invoice_ids())
    print("  %d bestehende Rechnungen in lexoffice werden geprueft ..." % len(vouchers))
    for voucher in vouchers:
        invoice = client.invoice(voucher["id"])
        label = voucher.get("voucherNumber") or voucher["id"]
        for item in invoice.get("lineItems") or []:
            haystack = "%s %s" % (item.get("name") or "", item.get("description") or "")
            for code in ORDER_CODE_RE.findall(haystack):
                found.setdefault(code, label)
    return found


# --------------------------------------------------------------------------
# Rechnungsaufbau
# --------------------------------------------------------------------------

def german_date(iso_timestamp):
    return datetime.strptime(iso_timestamp[:10], "%Y-%m-%d").strftime("%d.%m.%Y")


def build_line_item(row, vat_rate):
    weight = Decimal(row["shipment_weight"]).normalize()
    return {
        "type": "custom",
        "name": row["product_name"],
        "description": "Sendung %s | %s | %s kg"
        % (
            row["shipment_ext_order_code"],
            german_date(row["shipment_created_at"]),
            weight,
        ),
        "quantity": 1,
        "unitName": "Sendung",
        "unitPrice": {
            "currency": "EUR",
            "netAmount": float(money(Decimal(row["product_price"]))),
            "taxRatePercentage": vat_rate,
        },
        "discountPercentage": 0,
    }


def group_by_customer(rows):
    grouped = OrderedDict()
    for row in sorted(rows, key=lambda r: (int(r["customer_id"]), r["shipment_created_at"])):
        grouped.setdefault(row["customer_id"], []).append(row)
    return grouped


def build_invoice(customer_rows, contact_id, vat_rate, voucher_date):
    first = customer_rows[0]
    dates = [r["shipment_created_at"][:10] for r in customer_rows]
    period = "%s - %s" % (german_date(min(dates)), german_date(max(dates)))

    return {
        "archived": False,
        "voucherDate": voucher_date,
        "address": {"contactId": contact_id},
        "lineItems": [build_line_item(r, vat_rate) for r in customer_rows],
        "totalPrice": {"currency": "EUR"},
        "taxConditions": {"taxType": "net"},
        "shippingConditions": {
            "shippingDate": voucher_date,
            "shippingType": "service",
        },
        "title": "Rechnung",
        "introduction": "Abrechnung Ihrer Sendungen im Zeitraum %s." % period,
        "remark": "Vielen Dank fuer die Zusammenarbeit.",
    }


def invoice_totals(customer_rows, vat_rate):
    net = sum(money(Decimal(r["product_price"])) for r in customer_rows)
    vat = money(net * Decimal(vat_rate) / Decimal(100))
    return net, vat, net + vat


# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------

def render_report(invoices, skipped, warnings, vat_rate, created):
    out = []
    out.append("# Rechnungslauf %s" % datetime.now().strftime("%d.%m.%Y %H:%M"))
    out.append("")
    out.append("Modus: **%s**" % ("Entwuerfe angelegt" if created else "Dry-Run, nichts geschrieben"))
    out.append("")

    if warnings:
        out.append("## Hinweise")
        out.append("")
        for warning in warnings:
            out.append("- %s" % warning)
        out.append("")

    if skipped:
        out.append("## Uebersprungen (bereits abgerechnet)")
        out.append("")
        out.append("| Order-Code | Kunde | Fundstelle |")
        out.append("|---|---|---|")
        for code, name, source in skipped:
            out.append("| %s | %s | %s |" % (code, name, source))
        out.append("")

    if not invoices:
        out.append("## Keine Rechnung zu erstellen")
        out.append("")
        out.append("Alle Sendungen der Quelldatei sind bereits abgerechnet.")
        out.append("")
        return "\n".join(out)

    total_net = total_vat = total_gross = Decimal("0.00")
    out.append("## Rechnungen")
    out.append("")

    for entry in invoices:
        rows = entry["rows"]
        net, vat, gross = invoice_totals(rows, vat_rate)
        total_net += net
        total_vat += vat
        total_gross += gross

        heading = "### %s (customer_id=%s)" % (rows[0]["customer_address_name"], entry["customer_id"])
        if entry.get("invoice_id"):
            heading += " -- lexoffice %s" % entry["invoice_id"]
        out.append(heading)
        out.append("")
        out.append("| Datum | Produkt | Gewicht | Netto | Order-Code |")
        out.append("|---|---|---:|---:|---|")
        for row in rows:
            out.append(
                "| %s | %s | %s kg | %s EUR | %s |"
                % (
                    german_date(row["shipment_created_at"]),
                    row["product_name"],
                    Decimal(row["shipment_weight"]).normalize(),
                    money(Decimal(row["product_price"])),
                    row["shipment_ext_order_code"],
                )
            )
        out.append("")
        out.append(
            "**%d Positionen -- Netto %s EUR | USt %d%% %s EUR | Brutto %s EUR**"
            % (len(rows), net, vat_rate, vat, gross)
        )
        out.append("")

    out.append("## Gesamt")
    out.append("")
    out.append(
        "%d Rechnungen, %d Positionen -- Netto %s EUR | USt %s EUR | Brutto %s EUR"
        % (
            len(invoices),
            sum(len(e["rows"]) for e in invoices),
            total_net,
            total_vat,
            total_gross,
        )
    )
    out.append("")
    return "\n".join(out)


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Erzeugt aus einem Sendungs-Export Rechnungsentwuerfe in lexoffice."
    )
    parser.add_argument("--source", required=True, help="Quelldatei (.ods oder .csv)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nichts schreiben, nur den Report erzeugen (Standard).",
    )
    parser.add_argument(
        "--create-drafts",
        action="store_true",
        help="Rechnungsentwuerfe wirklich in lexoffice anlegen.",
    )
    parser.add_argument(
        "--exclude-customer",
        action="append",
        default=[],
        metavar="ID",
        help="customer_id ausschliessen, mehrfach nutzbar.",
    )
    parser.add_argument(
        "--skip-order-code",
        action="append",
        default=[],
        metavar="CODE",
        help="Order-Code als bereits abgerechnet behandeln, mehrfach nutzbar.",
    )
    parser.add_argument("--vat-rate", type=int, default=19, help="USt-Satz in Prozent.")
    args = parser.parse_args(argv)

    if args.dry_run and args.create_drafts:
        parser.error("--dry-run und --create-drafts schliessen sich aus.")
    return args


def run(args):
    rows = read_source(args.source)
    print("Quelle: %s -- %d Sendungen gelesen." % (args.source, len(rows)))

    warnings = validate(rows)
    for warning in warnings:
        print("  Hinweis: %s" % warning)

    excluded = set(str(c) for c in args.exclude_customer)
    if excluded:
        before = len(rows)
        rows = [r for r in rows if str(r["customer_id"]) not in excluded]
        print(
            "  %d Sendungen wegen --exclude-customer %s ausgeschlossen."
            % (before - len(rows), ", ".join(sorted(excluded)))
        )

    # Bereits abgerechnete Order-Codes einsammeln: lokales Ledger, CLI-Schalter
    # und -- sofern ein Key vorliegt -- der Bestand in lexoffice selbst.
    ledger = load_ledger()
    known = {}
    for code, entry in ledger.items():
        known[code] = "Ledger (%s)" % (entry.get("invoice_id") or entry.get("invoiced_at") or "lokal")
    for code in args.skip_order_code:
        known[code] = "--skip-order-code"

    api_key = os.environ.get("LEXOFFICE_API_KEY", "").strip()
    client = None
    if api_key:
        client = LexofficeClient(api_key)
        profile = client.profile()
        print(
            "lexoffice verbunden: %s"
            % (profile.get("companyName") or profile.get("organizationId") or "?")
        )
        for code, label in scan_remote_order_codes(client).items():
            known.setdefault(code, "lexoffice Rechnung %s" % label)
    else:
        print(
            "Kein LEXOFFICE_API_KEY gesetzt -- Abgleich nur gegen das lokale Ledger."
        )
        if args.create_drafts:
            raise AbortRun(
                "--create-drafts benoetigt LEXOFFICE_API_KEY in der Umgebung."
            )

    skipped = []
    billable = []
    for row in rows:
        code = row["shipment_ext_order_code"]
        if code in known:
            skipped.append((code, row["customer_address_name"], known[code]))
        else:
            billable.append(row)

    for code, name, source in skipped:
        print("  Uebersprungen: %s (%s) -- %s" % (code, name, source))

    grouped = group_by_customer(billable)
    contacts = load_contacts_map()

    if args.create_drafts:
        unmapped = [
            "customer_id=%s (%s)" % (cid, rows_[0]["customer_address_name"])
            for cid, rows_ in grouped.items()
            if not contacts.get(str(cid))
        ]
        if unmapped:
            raise AbortRun(
                "Diese Kunden haben keine lexoffice-contactId in %s:\n  - %s\n"
                "Trage die IDs ein; das Script legt bewusst keine Kontakte an."
                % (CONTACTS_MAP_PATH, "\n  - ".join(unmapped))
            )

    voucher_date = datetime.now().astimezone().replace(microsecond=0).isoformat()
    invoices = []
    for customer_id, customer_rows in grouped.items():
        invoices.append(
            {
                "customer_id": customer_id,
                "rows": customer_rows,
                "payload": build_invoice(
                    customer_rows,
                    contacts.get(str(customer_id), ""),
                    args.vat_rate,
                    voucher_date,
                ),
            }
        )

    if args.create_drafts:
        for entry in invoices:
            name = entry["rows"][0]["customer_address_name"]
            print("Lege Entwurf an: %s (%d Positionen) ..." % (name, len(entry["rows"])))
            response = client.create_invoice_draft(entry["payload"])
            entry["invoice_id"] = response.get("id", "")
            print("  -> lexoffice-ID %s" % entry["invoice_id"])

            # Ledger sofort fortschreiben: bricht der Lauf danach ab, gilt diese
            # Rechnung trotzdem als erledigt und wird nicht doppelt angelegt.
            stamp = datetime.now(timezone.utc).isoformat()
            for row in entry["rows"]:
                ledger[row["shipment_ext_order_code"]] = {
                    "invoice_id": entry["invoice_id"],
                    "customer_id": entry["customer_id"],
                    "customer_name": name,
                    "invoiced_at": stamp,
                }
            save_ledger(ledger)

    report = render_report(invoices, skipped, warnings, args.vat_rate, args.create_drafts)
    print()
    print(report)

    os.makedirs(DATA_DIR, exist_ok=True)
    report_path = os.path.join(
        DATA_DIR, "report_%s.md" % datetime.now().strftime("%Y%m%d_%H%M%S")
    )
    with open(report_path, "w", encoding="utf-8") as fh:
        fh.write(report)
    print("Report: %s" % report_path)
    return 0


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[1:])
    try:
        return run(args)
    except AbortRun as exc:
        print("\nABBRUCH: %s" % exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
