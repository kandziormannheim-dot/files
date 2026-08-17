# Baut die Ein-Seiten-Browservorschau aus dist/index.html:
# alles eigenständig (CSS/JS inline, Fonts + Bilder + Logo-Maske als
# data-URIs), interne Links zeigen einen Hinweis statt zu navigieren.
# Jedes JS-Bundle bekommt ein EIGENES <script type="module"> — zwei Bundles
# in einem Block kollidierten bei den minifizierten Bezeichnern.
import base64
import sys
import re
from pathlib import Path

DIST = Path(__file__).resolve().parent.parent / "dist"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd() / "kandzior-vorschau.html"

html = (DIST / "index.html").read_text()


def data_uri(pfad: str) -> str:
    p = DIST / pfad.lstrip("/")
    mime = {
        ".woff2": "font/woff2",
        ".webp": "image/webp",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".jpg": "image/jpeg",
    }[p.suffix]
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


# --- Stylesheets einbetten; Fonts und Maskenbild darin gleich mit ---------
def css_inline(m: re.Match) -> str:
    css = (DIST / m.group(1).lstrip("/")).read_text()
    css = re.sub(
        r"url\(\s*['\"]?(/(?:fonts|assets)/[^)'\"]+)['\"]?\s*\)",
        lambda u: f"url({data_uri(u.group(1))})",
        css,
    )
    return f"<style>{css}</style>"


html = re.sub(r'<link rel="stylesheet" href="([^"]+)"\s*/?>', css_inline, html)

# --- Preloads und Icons raus: alles ist inline, nichts darf anfragen ------
html = re.sub(r'<link rel="preload"[^>]*>', "", html)
html = re.sub(r'<link rel="icon"[^>]*>', "", html)
html = re.sub(r'<link rel="apple-touch-icon"[^>]*>', "", html)
html = re.sub(r'<link rel="canonical"[^>]*>', "", html)
html = re.sub(r'<link rel="alternate"[^>]*>', "", html)
html = re.sub(r'<link rel="sitemap"[^>]*>', "", html)

# --- Skript-Bundles einbetten --------------------------------------------
html = re.sub(
    r'<script type="module" src="([^"]+)"></script>',
    lambda m: '<script type="module">'
    + (DIST / m.group(1).lstrip("/")).read_text()
    + "</script>",
    html,
)

# --- Bilder als data-URIs -------------------------------------------------
html = re.sub(
    r'src="(/assets/[^"]+\.(?:webp|png|jpg|svg))"',
    lambda m: f'src="{data_uri(m.group(1))}"',
    html,
)

# --- Interne Links markieren (nicht #anker, nicht mailto, nicht extern) ---
def markiere(m: re.Match) -> str:
    tag = m.group(0)
    href = m.group(1)
    if href.startswith("/") and not href.startswith("//"):
        return tag[:-1] + " data-preview-intern>"
    return tag


html = re.sub(r'<a\b[^>]*href="([^"]*)"[^>]*>', markiere, html)

# --- Kopf und Rumpf zu einem Fragment zusammenfassen ----------------------
head = re.search(r"<head>(.*)</head>", html, re.S).group(1)
body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)
head = re.sub(r"<title>[^<]*</title>", "", head)
head = re.sub(r'<meta charset[^>]*>|<meta name="viewport"[^>]*>', "", head)

toast_css = """
<style>
#preview-toast {
  position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 16px);
  z-index: 500; max-width: min(92vw, 520px);
  padding: 12px 20px;
  background: var(--color-bg-inverse); color: var(--color-text-inverse);
  font-family: var(--font-family-body); font-size: 15px; line-height: 1.5;
  box-shadow: var(--shadow-lg); opacity: 0; pointer-events: none;
  transition: opacity .2s ease, transform .2s ease;
}
#preview-toast.sichtbar { opacity: 1; transform: translate(-50%, 0); }
</style>
"""

toast_js = """
<script type="module">
document.querySelectorAll('[data-preview-intern]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    let t = document.getElementById('preview-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'preview-toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = 'Vorschau: Diese Unterseite (' + a.getAttribute('href') + ') ist Teil der echten Website, nicht dieser Ein-Seiten-Vorschau.';
    t.classList.add('sichtbar');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('sichtbar'), 4200);
  });
});
</script>
"""

fragment = (
    "<title>kandzior.de — Vorschau</title>\n"
    + head.strip()
    + toast_css
    + "\n"
    + body.strip()
    + "\n"
    + toast_js
)

OUT.write_text(fragment)
print(f"geschrieben: {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")
