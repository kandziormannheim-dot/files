#!/usr/bin/env python3
"""Indexability-Audit — prueft, ob eine Live-URL ueberhaupt ranken KANN.

Das ist die Sicherheitsnetz-Seite von "achte drauf, dass kein noindex drin ist".
Der seo_check-Gate im Worker prueft die Bytes VOR dem Upload; dieses Skript
prueft, was der Crawler danach tatsaechlich sieht — inklusive der Dinge, die der
Gate prinzipiell nicht sehen kann: robots.txt, HTTP-Header, Redirects, Sitemap,
Staging-Basic-Auth.

Genau diese Faehler kosten Wochen, weil sie lautlos sind: Deploy gruen, Seite im
Browser sichtbar, Google indexiert sie trotzdem nie.

Aufruf:
    python3 indexability-audit.py https://neos24.com/
    python3 indexability-audit.py https://neos24.com/ --urls urls.txt
    python3 indexability-audit.py https://neos24.com/ --quiet   # nur Probleme

Exit-Codes:  0 = sauber (evtl. Warnungen)   1 = mindestens ein BLOCKER
Nur Python-3-Standardbibliothek, laeuft auf jedem Server.
"""
from __future__ import annotations

import argparse
import gzip
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import List, Optional, Tuple

UA = ("Mozilla/5.0 (compatible; neos24-indexability-audit/1.0; "
      "+https://neos24.com/) Python-urllib")
TIMEOUT = 20

# Direktiven, die eine Seite aus dem Index halten. 'none' ist die Kurzform von
# 'noindex, nofollow'. 'unavailable_after' wirft sie ab einem Datum wieder raus.
BLOCKING = ("noindex", "none", "unavailable_after")
# robots-Meta-Namen, die Google/Bing auswerten.
ROBOTS_NAMES = {"robots", "googlebot", "googlebot-news", "bingbot"}

BLOCKER, WARN, OK, INFO = "BLOCKER", "WARNUNG", "OK", "INFO"
_findings: List[Tuple[str, str, str, str]] = []     # (level, bereich, text, url)
_quiet = False
_current_url = ""                                   # welche URL gerade geprueft wird


def note(level: str, area: str, text: str) -> None:
    _findings.append((level, area, text, _current_url))
    if _quiet and level in (OK, INFO):
        return
    colour = {BLOCKER: "\033[1;31m", WARN: "\033[1;33m",
              OK: "\033[1;32m", INFO: "\033[0;36m"}[level]
    print(f"  {colour}[{level:8s}]\033[0m {area:14s} {text}")


class _Head(HTMLParser):
    """Zieht die SEO-relevanten Kopf-Elemente aus dem HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.description: Optional[str] = None
        self.canonical: Optional[str] = None
        self.robots: List[Tuple[str, str]] = []      # (meta-name, content)
        self.hreflang: List[Tuple[str, str]] = []    # (hreflang, href)
        self.h1: List[str] = []
        self.lang: Optional[str] = None
        self._in_title = False
        self._in_h1 = False

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "title":
            self._in_title = True
        elif tag == "h1":
            self._in_h1 = True
            self.h1.append("")
        elif tag == "meta":
            name = a.get("name", "").lower()
            if name == "description":
                self.description = a.get("content", "")
            elif name in ROBOTS_NAMES:
                self.robots.append((name, a.get("content", "")))
        elif tag == "link":
            rel = a.get("rel", "").lower()
            if "canonical" in rel:
                self.canonical = a.get("href", "")
            elif "alternate" in rel and a.get("hreflang"):
                self.hreflang.append((a["hreflang"], a.get("href", "")))

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif self._in_h1 and self.h1:
            self.h1[-1] += data


def fetch(url: str) -> Tuple[int, dict, bytes, str]:
    """(status, headers, body, final_url). Folgt Redirects."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            body = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            return r.status, dict(r.headers), body, r.url
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), (e.read() or b""), url


def blocking_directives(content: str) -> List[str]:
    parts = {d.strip().lower() for d in content.split(",")}
    return sorted(d for d in parts if d.startswith(BLOCKING))


# --------------------------------------------------------------------------
def check_robots_txt(base: str) -> Optional[str]:
    """robots.txt: blockt sie den Crawler? Steht die Sitemap drin?"""
    global _current_url
    url = urllib.parse.urljoin(base, "/robots.txt")
    _current_url = url
    print(f"\n\033[1m== robots.txt ==\033[0m  {url}")
    try:
        status, _, body, _ = fetch(url)
    except Exception as exc:
        note(WARN, "robots.txt", f"nicht abrufbar ({exc}) — Google nimmt dann 'alles erlaubt' an")
        return None

    if status == 404:
        note(OK, "robots.txt", "nicht vorhanden (404) — zulaessig, Google crawlt alles")
        return None
    if status != 200:
        note(WARN, "robots.txt", f"HTTP {status} — ein 5xx laesst Google das ganze Crawling pausieren")
        return None

    text = body.decode("utf-8", "replace")
    sitemap = None
    agent = None
    blanket = False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, val = (p.strip() for p in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            agent = val
        elif key == "sitemap":
            sitemap = val
            note(OK, "robots.txt", f"Sitemap eingetragen: {val}")
        elif key == "disallow" and val == "/" and agent in ("*", "Googlebot", "googlebot"):
            blanket = True
            note(BLOCKER, "robots.txt",
                 f"'Disallow: /' fuer User-agent: {agent} — sperrt die KOMPLETTE Domain aus")
        elif key == "disallow" and val:
            note(INFO, "robots.txt", f"Disallow: {val}  (User-agent: {agent})")

    if not blanket:
        note(OK, "robots.txt", "keine domainweite Sperre")
    if not sitemap:
        note(WARN, "robots.txt",
             "kein Sitemap:-Eintrag — die Sitemap ist der wichtigste Discovery-Kanal")
    return sitemap


def check_sitemap(base: str, from_robots: Optional[str]) -> None:
    global _current_url
    url = from_robots or urllib.parse.urljoin(base, "/sitemap.xml")
    _current_url = url
    print(f"\n\033[1m== Sitemap ==\033[0m  {url}")
    try:
        status, _, body, _ = fetch(url)
    except Exception as exc:
        note(BLOCKER, "sitemap", f"nicht abrufbar: {exc}")
        return
    if status != 200:
        note(BLOCKER, "sitemap", f"HTTP {status} — ohne Sitemap findet Google neue Seiten nur ueber Links")
        return

    text = body.decode("utf-8", "replace")
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", text)
    if "<sitemapindex" in text:
        note(OK, "sitemap", f"Sitemap-Index mit {len(locs)} Teil-Sitemaps")
    else:
        note(OK, "sitemap", f"{len(locs)} URLs")
    if not locs:
        note(WARN, "sitemap", "keine <loc>-Eintraege gefunden — leere Sitemap")
    http_locs = [u for u in locs if u.startswith("http://")]
    if http_locs:
        note(WARN, "sitemap", f"{len(http_locs)} URLs zeigen auf http:// statt https://")


def check_page(url: str, is_home: bool = False) -> None:
    global _current_url
    _current_url = url
    print(f"\n\033[1m== Seite ==\033[0m  {url}")
    try:
        status, headers, body, final = fetch(url)
    except Exception as exc:
        note(BLOCKER, "abruf", f"nicht abrufbar: {exc}")
        return

    if status == 401 or status == 403:
        note(BLOCKER, "abruf",
             f"HTTP {status} — Basic-Auth/Zugriffsschutz aktiv. Klassiker: Staging-Schutz "
             f"nach dem Relaunch vergessen. Googlebot sieht dann gar nichts.")
        return
    if status >= 400:
        note(BLOCKER, "abruf", f"HTTP {status}")
        return
    if final.rstrip("/") != url.rstrip("/"):
        note(INFO, "redirect", f"weitergeleitet auf {final}")
    if not final.startswith("https://"):
        note(BLOCKER, "https", "Endziel ist nicht HTTPS")
    else:
        note(OK, "abruf", f"HTTP {status} ueber HTTPS")

    # --- X-Robots-Tag (der unsichtbare Zwilling des meta-robots) ---
    xrt = headers.get("X-Robots-Tag") or headers.get("x-robots-tag")
    if xrt:
        hits = blocking_directives(xrt)
        if hits:
            note(BLOCKER, "x-robots-tag",
                 f"HTTP-Header setzt '{', '.join(hits)}' — wirkt genau wie ein noindex im HTML, "
                 f"ist aber im Seitenquelltext unsichtbar. Voller Header: {xrt!r}")
        else:
            note(OK, "x-robots-tag", f"vorhanden, aber unkritisch: {xrt!r}")
    else:
        note(OK, "x-robots-tag", "nicht gesetzt")

    p = _Head()
    p.feed(body.decode("utf-8", "replace"))

    # --- meta robots ---
    if not p.robots:
        note(OK, "meta robots", "kein Tag — Standard ist 'index, follow'")
    for name, content in p.robots:
        hits = blocking_directives(content)
        if hits:
            note(BLOCKER, "meta robots",
                 f'<meta name="{name}" content="{content}"> — enthaelt {", ".join(hits)}')
        else:
            note(OK, "meta robots", f'<meta name="{name}" content="{content}">')

    # --- canonical ---
    if not p.canonical:
        note(WARN, "canonical", "fehlt — bei Parameter-URLs entstehen so Duplikate")
    elif not p.canonical.lower().startswith("http"):
        note(BLOCKER, "canonical", f"nicht absolut: {p.canonical!r}")
    elif p.canonical.rstrip("/") != final.rstrip("/"):
        note(WARN, "canonical",
             f"zeigt woanders hin: {p.canonical} (Seite ist {final}). "
             f"Zeigt sie auf eine fremde Seite, faellt diese hier aus dem Index.")
    else:
        note(OK, "canonical", p.canonical)

    # --- Basis-Onpage ---
    title = p.title.strip()
    if not title:
        note(BLOCKER, "title", "fehlt")
    elif len(title) > 65:
        note(WARN, "title", f"{len(title)} Zeichen — wird im Snippet abgeschnitten: {title[:60]}...")
    else:
        note(OK, "title", f"{len(title)} Zeichen: {title}")

    desc = (p.description or "").strip()
    if not desc:
        note(WARN, "description", "fehlt — Google textet das Snippet dann selbst")
    elif len(desc) < 50:
        note(WARN, "description", f"nur {len(desc)} Zeichen")
    else:
        note(OK, "description", f"{len(desc)} Zeichen")

    h1s = [h.strip() for h in p.h1 if h.strip()]
    if len(h1s) == 1:
        note(OK, "h1", h1s[0][:70])
    elif not h1s:
        note(WARN, "h1", "keine H1")
    else:
        note(WARN, "h1", f"{len(h1s)} H1-Elemente — genau eine ist sauber")

    if not p.lang:
        note(WARN, "lang", "<html> ohne lang-Attribut")
    else:
        note(OK, "lang", f'lang="{p.lang}"')

    if p.hreflang:
        tags = {h for h, _ in p.hreflang}
        note(OK, "hreflang", f"{len(p.hreflang)} Verweise: {', '.join(sorted(tags))}")
        if "x-default" not in tags:
            note(WARN, "hreflang", "kein x-default gesetzt")

    if is_home:
        wc = len(re.findall(r"\w+", re.sub(r"(?s)<(script|style).*?</\1>", " ",
                                           body.decode("utf-8", "replace"))))
        if wc < 300:
            note(WARN, "inhalt",
                 f"nur ~{wc} Woerter im Quelltext — falls die Seite clientseitig rendert, "
                 f"sieht der Crawler moeglicherweise nichts davon")


def main() -> int:
    global _quiet
    ap = argparse.ArgumentParser(description="Indexability-Audit fuer eine Domain")
    ap.add_argument("url", help="Start-URL, z.B. https://neos24.com/")
    ap.add_argument("--urls", help="Datei mit weiteren URLs (eine pro Zeile)")
    ap.add_argument("--quiet", action="store_true", help="nur Blocker und Warnungen zeigen")
    args = ap.parse_args()
    _quiet = args.quiet

    base = args.url if args.url.startswith("http") else "https://" + args.url
    print(f"\n\033[1mIndexability-Audit: {base}\033[0m")

    sitemap = check_robots_txt(base)
    check_sitemap(base, sitemap)
    check_page(base, is_home=True)

    if args.urls:
        with open(args.urls, encoding="utf-8") as fh:
            extra = [l.strip() for l in fh if l.strip() and not l.startswith("#")]
        for u in extra:
            check_page(u)

    blockers = [f for f in _findings if f[0] == BLOCKER]
    warns = [f for f in _findings if f[0] == WARN]
    print("\n" + "=" * 70)
    if blockers:
        print(f"\033[1;31m{len(blockers)} BLOCKER\033[0m — das kann so nicht ranken:")
        for _, area, text, where in blockers:
            print(f"    - {where}\n      [{area}] {text}")
    else:
        print("\033[1;32mKeine Blocker.\033[0m Indexierung ist technisch moeglich.")
    print(f"{len(warns)} Warnung(en).")
    print("=" * 70)
    return 1 if blockers else 0


if __name__ == "__main__":
    sys.exit(main())
