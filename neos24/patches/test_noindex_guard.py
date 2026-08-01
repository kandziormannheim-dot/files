#!/usr/bin/env python3
"""Test fuer die noindex-Regel (Regel 7) aus 001-seo-check-noindex-guard.patch.

Laedt worker/core/seo_check.py aus einer AIVA-Installation, stubbt die zwei
internen Abhaengigkeiten (DB + Logger) weg und prueft, dass genau die
blockierenden robots-Direktiven abgelehnt und die harmlosen durchgelassen
werden.

Aufruf:
    python3 test_noindex_guard.py [/var/www/aiva]

Braucht kein MySQL, keine .env, keinen laufenden Worker — nur Python 3.
Exit 0 = alle Tests bestanden.
"""
from __future__ import annotations

import pathlib
import sys
import types

AIVA_ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/var/www/aiva").resolve()
SEO_CHECK = AIVA_ROOT / "worker" / "core" / "seo_check.py"


def load_seo_check():
    """Importiere seo_check.py isoliert, mit gestubbten Paket-Importen."""
    if not SEO_CHECK.is_file():
        sys.exit(f"seo_check.py nicht gefunden: {SEO_CHECK}\n"
                 f"Pfad zur AIVA-Installation als Argument uebergeben.")

    pkg = types.ModuleType("aivastub")
    pkg.__path__ = [str(SEO_CHECK.parent)]
    sys.modules["aivastub"] = pkg

    # .database: der Dedup-Check fragt die DB nach doppelten Titeln/Metas.
    # Fuer diesen Test ist nichts doppelt -> immer 0 Treffer.
    db_stub = types.ModuleType("aivastub.database")
    db_stub.db = types.SimpleNamespace(
        query_one=lambda *a, **k: {"n": 0},
        fetch_one=lambda *a, **k: {"n": 0},
    )
    sys.modules["aivastub.database"] = db_stub

    log_stub = types.ModuleType("aivastub.logger")
    log_stub.get_logger = lambda name: types.SimpleNamespace(
        warning=lambda *a, **k: None, info=lambda *a, **k: None
    )
    sys.modules["aivastub.logger"] = log_stub

    mod = types.ModuleType("aivastub.seo_check")
    mod.__package__ = "aivastub"
    sys.modules["aivastub.seo_check"] = mod
    exec(compile(SEO_CHECK.read_text(), str(SEO_CHECK), "exec"), mod.__dict__)
    return mod


CANONICAL = "https://neos24.com/test/"


def build_page(robots_html: str = "") -> str:
    """Eine ansonsten fehlerfreie Seite — nur der robots-Tag variiert."""
    body = "<article><h1>Titel</h1><p>" + ("wort " * 500) + "</p></article>"
    return (
        "<!DOCTYPE html><html><head>"
        "<title>Ein sauberer Titel fuer neos24</title>"
        '<meta name="description" content="Eine ausreichend lange und eindeutige '
        'Beschreibung fuer genau diese eine Seite.">'
        f"{robots_html}"
        f'<link rel="canonical" href="{CANONICAL}">'
        '<script type="application/ld+json">{"@type":"Article"}</script>'
        f"</head><body>{body}</body></html>"
    )


# (Name, robots-Markup, soll die Seite durchgehen?)
CASES = [
    ("kein robots-Tag",            "",                                                              True),
    ("index, follow",              '<meta name="robots" content="index, follow">',                  True),
    ("all",                        '<meta name="robots" content="all">',                            True),
    ("max-snippet + noimageindex", '<meta name="robots" content="max-snippet:-1, noimageindex">',   True),
    ("nofollow allein",            '<meta name="robots" content="nofollow">',                       True),
    ("noindex",                    '<meta name="robots" content="noindex">',                        False),
    ("noindex, follow",            '<meta name="robots" content="noindex, follow">',                False),
    ("NOINDEX in Grossschrift",    '<meta name="ROBOTS" content="NOINDEX">',                        False),
    ("none (= noindex,nofollow)",  '<meta name="robots" content="none">',                           False),
    ("googlebot noindex",          '<meta name="googlebot" content="noindex">',                     False),
    ("bingbot noindex",            '<meta name="bingbot" content="noindex">',                       False),
    ("unavailable_after",          '<meta name="robots" content="unavailable_after: 25 Jun 2030">', False),
]


def main() -> int:
    mod = load_seo_check()
    failed = 0
    for name, robots, should_pass in CASES:
        ok, reasons = mod.check(
            build_page(robots), {"content_plan_id": 1}, {}, CANONICAL
        )
        good = ok is should_pass
        failed += not good
        detail = "durchgelassen" if ok else f"blockiert: {'; '.join(reasons)}"
        print(f"[{'PASS' if good else 'FAIL'}] {name:28s} -> {detail}")

    print()
    if failed:
        print(f"{failed} von {len(CASES)} Tests FEHLGESCHLAGEN")
        return 1
    print(f"Alle {len(CASES)} Tests bestanden — die noindex-Regel greift.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
