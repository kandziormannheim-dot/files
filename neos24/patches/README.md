# Patches für das AIVA-v3-Bundle (neos24-Instanz)

Zwei Fixes gegen `aiva-v3-code.tar.gz` und `setup-neos24.sh` aus dem Handover.
Beide **vor** dem ersten `setup-neos24.sh`-Lauf anwenden. Hintergrund und
Auswirkung stehen in [`../HANDOVER-REVIEW.md`](../HANDOVER-REVIEW.md), Befunde
F1 und F2.

| Datei | Was sie tut |
|---|---|
| `001-seo-check-noindex-guard.patch` | Ergänzt Regel 7 im Pre-Upload-Gate: blockt `noindex` & Co |
| `002-setup-neos24-skip-mikra-migrations.patch` | Ersetzt den Migrations-Glob durch eine explizite Liste |
| `005a_schema_only.sql` | Ersatz für `005_mikra_config.sql` — nur DDL, keine Mikra-Daten |
| `test_noindex_guard.py` | 12 Testfälle für Regel 7, ohne MySQL lauffähig |

---

## Anwenden

```bash
# Bundle wie in der Anleitung entpacken
mkdir -p /var/www/aiva
tar xzf aiva-v3-code.tar.gz -C /var/www/aiva

# Patch 1 — noindex-Regel im SEO-Gate
cd /var/www/aiva
patch -p1 --dry-run < /pfad/zu/001-seo-check-noindex-guard.patch   # erst prüfen
patch -p1           < /pfad/zu/001-seo-check-noindex-guard.patch

# 005a neben die anderen Migrationen legen
cp /pfad/zu/005a_schema_only.sql /var/www/aiva/database/migrations/

# Patch 2 — Migrations-Liste im Setup-Skript
cd /pfad/zum/handover-ordner          # dort, wo setup-neos24.sh liegt
patch -p1 < /pfad/zu/002-setup-neos24-skip-mikra-migrations.patch

# Erst jetzt das Setup starten
AIVA_DASHBOARD_HOST=aiva.neos24.com bash setup-neos24.sh
```

Beide Patches wurden gegen das unveränderte Bundle mit `patch -p1 --dry-run`
verifiziert und wenden sich ohne Offset oder Fuzz an.

---

## Verifizieren

```bash
python3 /pfad/zu/test_noindex_guard.py /var/www/aiva
```

Erwartet: `Alle 12 Tests bestanden — die noindex-Regel greift.` (Exit 0).

Das Skript braucht weder MySQL noch `.env` noch einen laufenden Worker — es
lädt `seo_check.py` isoliert und stubbt DB und Logger weg. Gegen das
**ungepatchte** Bundle läuft es mit **7 Fehlschlägen** durch; das ist der
Beweis, dass die Lücke real war und nicht theoretisch.

Nach `setup-neos24.sh` zusätzlich den Migrationsstand prüfen:

```sql
SELECT version, note FROM schema_migrations ORDER BY version;
```

Erwartet: 001–008 vorhanden. 005 mit dem Vermerk „nur Schema", 006 mit
„bewusst übersprungen". **Keine** Projekte mit `slug LIKE 'mikra%'`:

```sql
SELECT id, slug, status FROM projects;   -- darf keine mikra-* Zeile enthalten
```

---

## Was Patch 1 genau ändert

`worker/core/seo_check.py`, drei Stellen:

1. `ROBOTS_META_NAMES` und `BLOCKING_ROBOTS_DIRECTIVES` als Konstanten.
2. Der HTML-Extraktor sammelt zusätzlich die `robots`-Meta-Tags ein.
3. Neue Regel 7 in `check()`: blockt `noindex`, `none` und `unavailable_after`
   auf den vier Meta-Namen, die Google und Bing auswerten (`robots`,
   `googlebot`, `googlebot-news`, `bingbot`), case-insensitiv.

Ausdrücklich **erlaubt** bleiben die harmlosen Direktiven — `nofollow`,
`noimageindex`, `noarchive`, `nosnippet`, `max-snippet`, `all`. Der Test deckt
das mit ab, damit die Regel nicht versehentlich legitime Seiten blockt.

Die Regel greift dort, wo die vorhandenen Schutzschichten nicht hinsehen: Der
LLM-Judge bewertet nur den Artikeltext, nie den `<head>`. Der Deploy-Guard
prüft Transport, nicht Inhalt. Ein `noindex` im Layout wäre bis zum Blick in die
Search Console unsichtbar geblieben — und dort steht nur „Durch 'noindex'-Tag
ausgeschlossen", ohne Alert und ohne `failed_qa`.

**Nicht** abgedeckt: `X-Robots-Tag` im HTTP-Header, `robots.txt`, Basic-Auth.
Die kann ein Gate, der die Datei vor dem Upload prüft, prinzipiell nicht sehen.
Dafür ist [`../tools/indexability-audit.py`](../tools/indexability-audit.py) da,
das die Live-URL nach dem Deploy prüft.
