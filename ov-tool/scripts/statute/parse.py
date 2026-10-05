#!/usr/bin/env python3
"""Zerlegt die amtlichen Satzungs-PDFs (per `pdftotext -layout`) in Paragraphen/Absätze.

Aufruf:  python3 scripts/statute/parse.py <statut.txt> <bw.txt> > src/data/statutes.json

Quellen:
  Statutenbroschüre der CDU Deutschlands, Stand 21.02.2026
    https://www.cdu.de/app/uploads/2026/03/Statutenbroschuere-der-CDU-Deutschlands.pdf
  Satzung, Verfahrensordnung und Finanzordnung der CDU Baden-Württemberg, Stand 27.04.2024
    https://www.cdu-bw.de/ueber-uns/satzung/
"""
import json
import re
import sys

STATUT_URL = "https://www.cdu.de/app/uploads/2026/03/Statutenbroschuere-der-CDU-Deutschlands.pdf"
BW_URL = "https://www.cdu-bw.de/ueber-uns/satzung/"

# (id, Titel, Kurz, Ebene, Stand, Quelle, Datei-Index, Startzeile, Endzeile) – 1-basiert, inklusiv
DOCS = [
    ("lv-satzung", "Satzung der CDU Baden-Württemberg", "LV-Satzung", "Land", "27.04.2024", BW_URL, 1, 217, 1500),
    ("lv-verfahrensordnung", "Verfahrensordnung der CDU Baden-Württemberg (Kandidatenaufstellung)", "LV-VerfO", "Land", "18.11.2023", BW_URL, 1, 1509, 1770),
    ("lv-finanzordnung", "Finanzordnung der CDU Baden-Württemberg", "LV-FinO", "Land", "27.04.2024", BW_URL, 1, 1782, 1961),
    ("statut", "Statut der CDU Deutschlands", "Statut", "Bund", "21.02.2026", STATUT_URL, 0, 174, 1615),
    ("go-cdu", "Geschäftsordnung der CDU (GO-CDU)", "GO-CDU", "Bund", "21.02.2026", STATUT_URL, 0, 1671, 2005),
    ("fbo", "Finanz- und Beitragsordnung der CDU (FBO)", "FBO", "Bund", "21.02.2026", STATUT_URL, 0, 2053, 2946),
    ("pgo", "Parteigerichtsordnung der CDU (PGO)", "PGO", "Bund", "21.02.2026", STATUT_URL, 0, 3050, 3695),
    ("dso", "Datenschutzordnung der CDU (DSO)", "DSO", "Bund", "21.02.2026", STATUT_URL, 0, 3721, 4023),
    ("bfao", "Ordnung für die Bundesfachausschüsse der CDU (BFAO)", "BFAO", "Bund", "21.02.2026", STATUT_URL, 0, 4047, 4194),
    ("partg", "Gesetz über die politischen Parteien (Parteiengesetz)", "PartG", "Gesetz", "Abdruck in der Statutenbroschüre, Stand 21.02.2026", STATUT_URL, 0, 4322, 5753),
]

HEADERS = [
    "statut der cdu", "geschäftsordnung der cdu (go-cdu)", "finanz- und beitragsordnung (fbo)",
    "parteigerichtsordnung (pgo)", "datenschutzordnung der cdu (dso)",
    "ordnung für die bundesfachausschüsse der cdu (bfao)", "ordnung für die bundesfachausschüsse",
    "gesetz über die politischen parteien (parteiengesetz)", "parteiengesetz", "gesetz über die politischen parteien",
    "satzung", "verfahrensordnung", "finanzordnung", "anlage zur finanzordnung",
]

SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
PARA_RE = re.compile(r"^§\s?(\d+)\s?([a-z])?\b\s*(.*)$")
PART_RE = re.compile(r"^([A-L]|[IVX]{1,5})\.\s+\S")
ABS_RE = re.compile(r"^\((\d+[a-z]?)\)\s*(.*)$")


CTRL = re.compile(r"[\x00-\x08\x0b-\x1f]")


def is_noise(line: str) -> bool:
    line = CTRL.sub(" ", line)
    s = re.sub(r"\s+", " ", line.replace("\f", " ")).strip()
    if not s:
        return False
    if re.fullmatch(r"\d{1,3}", s):
        return True
    core = re.sub(r"^\d{1,3}\s+|\s+\d{1,3}$", "", s).strip().lower()
    return core in HEADERS


def clean_line(line: str) -> str:
    line = CTRL.sub(" ", line).replace("\f", " ").rstrip()
    if line.endswith(("\u00ad", "\u00ac")):
        line = line[:-1] + "-"
    line = line.replace("\u00ad", "").replace("\u00ac", "").replace("\t", " ")
    return re.sub(r"\s{2,}", " ", line).strip()


def join_lines(lines):
    out = ""
    for ln in lines:
        if not ln:
            continue
        if not out:
            out = ln
            continue
        # Aufzählungen beginnen eine neue Zeile
        if re.match(r"^(\d{1,2}\.|[a-z]\)|[a-z]{1,2}\))\s", ln) and not re.search(r"\b(Nr|Abs|Satz|vom|Art)\.?$", out):
            out += "\n" + ln
            continue
        if out.endswith("-") and not out.endswith(" -"):
            first = ln.split(" ", 1)[0]
            if first in ("und", "oder", "bzw.", "sowie", "bis"):
                out += " " + ln  # "Kreis- und Landesvorstand"
            elif ln[:1].islower():
                out = out[:-1] + ln
            else:
                out += ln  # "CDU-Fraktion" über Zeilenumbruch
            continue
        out += " " + ln
    return out


def sentence_numbers(text: str) -> str:
    # In der Broschüre stehen hochgestellte Satznummern direkt vor dem Satzanfang ("1Der Austritt …").
    def repl(m):
        return m.group(1) + m.group(2).translate(SUP)
    text = re.sub(r"(^|[.;:!?]\s|\n)(\d{1,2})(?=[A-ZÄÖÜ„\"(§])", repl, text)
    return text


def parse(lines, doc):
    did, title, short, level, stand, source = doc[:6]
    sections = []
    part = None
    cur = None
    buf = []  # Zeilen des aktuellen Absatzes
    absnr = None
    preamble = []

    def flush_abs():
        nonlocal buf, absnr
        if cur is not None and buf:
            text = sentence_numbers(join_lines(buf))
            if text:
                cur["absaetze"].append({"nr": absnr, "text": text})
        buf = []
        absnr = None

    for raw in lines:
        if is_noise(raw):
            continue
        ln = clean_line(raw)
        if not ln:
            continue
        m = PARA_RE.match(ln)
        if m and (m.group(3).startswith("(") or did.startswith("lv-") or did == "partg" or not m.group(3)) and not re.search(r"\s\d{1,3}$", ln):
            rest = m.group(3).strip()
            # Fließtext-Verweise wie "§ 22 Statut der CDU sowie …" sind keine Überschriften
            if did.startswith("lv-") or did == "partg":
                if rest and (rest[0].islower() or re.match(r"^(Abs|Absatz|Satz|Nr|des|der|Statut|PartG|BGB|und|bis)\b", rest)):
                    m = None
            if m:
                flush_abs()
                num = m.group(1) + (m.group(2) or "")
                ttl = rest.strip("() ")
                cur = {"num": num, "title": rest, "part": part, "absaetze": [], "open": rest.startswith("(") and ")" not in rest}
                sections.append(cur)
                continue
        if cur is None:
            preamble.append(ln)
            if PART_RE.match(ln) and len(ln) < 90:
                part = ln
            continue
        if PART_RE.match(ln) and len(ln) < 90 and not ln.endswith((",", ";")) and not buf_continues(buf):
            flush_abs()
            part = ln
            cur = None
            continue
        a = ABS_RE.match(ln)
        if a:
            flush_abs()
            absnr = a.group(1)
            buf = [a.group(2)]
            continue
        # Überschrift in Klammern über mehrere Zeilen
        if cur.get("open"):
            cur["title"] = join_lines([cur["title"], ln])
            if ")" in ln:
                cur["open"] = False
            continue
        buf.append(ln)
    flush_abs()
    for s in sections:
        s["title"] = s["title"].strip("() ").strip()
        s.pop("open", None)
    return {
        "id": did, "title": title, "short": short, "level": level, "stand": stand, "source": source,
        "sections": [s for s in sections if s["absaetze"]],
    }


def buf_continues(buf):
    return bool(buf) and not re.search(r"[.:;]$", buf[-1])


def main():
    files = [open(p, encoding="utf-8").read().split("\n") for p in sys.argv[1:3]]
    out = []
    for doc in DOCS:
        lines = files[doc[6]]
        start, end = doc[7], min(doc[8], len(lines))
        out.append(parse(lines[start - 1:end], doc))
    json.dump({"generated": "2026-10-06", "documents": out}, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
