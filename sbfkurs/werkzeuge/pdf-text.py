#!/usr/bin/env python3
"""Text aus einer Katalog-PDF gewinnen — Rückfall für katalog-import.php, wenn
pdftotext (poppler-utils) fehlt. Braucht PyMuPDF (python3 -m pip install pymupdf).

Baut Zeilen aus den Wortpositionen wieder zusammen (wie pdftotext -layout) und
behebt eine Eigenheit der Funk-Kataloge: Die Kataloge sind Tabellen, in denen
Fragennummer und Antwortkennung („12.“, „2)“, „b)“) in einer schmalen linken
Spalte stehen und bei mehrzeiligem Text vertikal mittig neben der Zelle sitzen —
in der Wortfolge also erst nach der ersten Textzeile. Die Kennung wird deshalb
der Zelle zugeordnet, in deren Höhe sie steht, und vor deren erste Zeile gesetzt:

    PDF (Wortlage)                      Ausgabe
    ----------------------------------  ----------------------------------
    Zu welchem Zweck wurde das GMDSS    3. Zu welchem Zweck wurde das GMDSS
    3. eingeführt?                      eingeführt?
    Wie heißt der Dienst, in dem …      117. Wie heißt der Dienst, in dem …
    117.                                über terrestrische Frequenzen …
    über terrestrische Frequenzen …

Eine Zelle ist eine Folge eng untereinander stehender Textzeilen; zwischen zwei
Zellen liegt ein deutlich größerer Abstand. Steht die Kennung genau auf einer
Zeile (einzeilige Zelle, inline-Layout des SBF-Katalogs), bleibt sie dort.

    python3 werkzeuge/pdf-text.py katalog.pdf > katalog.txt
"""

import re
import sys

import pymupdf

# Die Verweisnummern „[117]“ der Funk-Kataloge stehen neben der Kennung (auch
# rechts der Spalte); sie wandern mit ihr und werden im Import per Profil
# (Option „entfernen“) gestrichen.
KENNUNG = re.compile(r"^(\d{1,3}\.|[1-4]\)|[a-d]\)|[a-d]\.)$")
VERWEIS = re.compile(r"^\[\d{1,3}\]$")
KENNUNG_SPALTE_BIS = 100  # x-Position, links davon stehen Kennungen
ZEILEN_TOLERANZ = 3       # gleiche Zeile, wenn Mittellinien so nah liegen


def ist_kennung(wort):
    return VERWEIS.match(wort[4]) is not None or (KENNUNG.match(wort[4]) is not None and wort[0] < KENNUNG_SPALTE_BIS)


def zeilen_bilden(woerter):
    """Wörter nach Mittellinie zu Zeilen gruppieren; Rückgabe [[mitte, hoehe, woerter]]."""
    zeilen = []
    for w in sorted(woerter, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        mitte = (w[1] + w[3]) / 2
        if zeilen and abs(zeilen[-1][0] - mitte) <= ZEILEN_TOLERANZ:
            zeilen[-1][2].append(w)
        else:
            zeilen.append([mitte, w[3] - w[1], [w]])
    for z in zeilen:
        z[2].sort(key=lambda w: w[0])
        z[1] = max(w[3] - w[1] for w in z[2])
    return zeilen


def zellen_bilden(zeilen):
    """Zeilenindizes zu Zellen bündeln: enger Abstand zur Vorzeile = gleiche Zelle."""
    zellen = []
    for i, z in enumerate(zeilen):
        if zellen and z[0] - zeilen[i - 1][0] < zeilen[i - 1][1] * 1.6:
            zellen[-1].append(i)
        else:
            zellen.append([i])
    return zellen


def mitte(wort):
    return (wort[1] + wort[3]) / 2


def kennungen_einfuegen(zeilen, kennungen):
    """Kennungen den Zellen zuordnen und vorn in die passende Zeile setzen.

    Je Zelle werden die Kennungshöhen bestimmt (Kennungen auf gleicher Höhe,
    etwa „117.“ und „[117]“, zählen als eine). Jede Textzeile gehört zur
    nächstgelegenen Kennungshöhe; die Kennungen kommen vor die erste Zeile
    ihrer Gruppe. Eine Zelle mit einer Höhe (Tabellenlayout der Funk-Kataloge)
    bekommt so ihre Kennung vor die erste Zeile; bei einer Kennung je Zeile
    (Inline-Layout) bleibt jede auf ihrer Zeile.
    """
    uebrig = sorted(kennungen, key=lambda w: (mitte(w), w[0]))
    for zelle in zellen_bilden(zeilen):
        oben = zeilen[zelle[0]][0] - zeilen[zelle[0]][1]
        unten = zeilen[zelle[-1]][0] + zeilen[zelle[-1]][1]
        drin = [k for k in uebrig if oben <= mitte(k) <= unten]
        if not drin:
            continue
        uebrig = [k for k in uebrig if k not in drin]
        gruppen = []  # [hoehe, kennungen, erste Zeile]
        for k in drin:
            if gruppen and mitte(k) - gruppen[-1][0] <= ZEILEN_TOLERANZ:
                gruppen[-1][1].append(k)
            else:
                gruppen.append([mitte(k), [k], None])
        for i in zelle:
            g = min(gruppen, key=lambda g: abs(g[0] - zeilen[i][0]))
            if g[2] is None:
                g[2] = i
        for hoehe, ks, erste in gruppen:
            if erste is None:
                erste = min(zelle, key=lambda i: abs(zeilen[i][0] - hoehe))
            # Von rechts nach links einfügen, damit die linke Kennung zuletzt vorn steht.
            for k in sorted(ks, key=lambda w: -w[0]):
                zeilen[erste][2].insert(0, k)
    for k in uebrig:
        # Kennung ohne Text in Reichweite: eigene Zeile an der passenden Stelle.
        zeilen.append([mitte(k), k[3] - k[1], [k]])
    zeilen.sort(key=lambda z: z[0])
    return zeilen


def seitentext(seite):
    woerter = seite.get_text("words")
    kennungen = [w for w in woerter if ist_kennung(w)]
    zeilen = zeilen_bilden([w for w in woerter if not ist_kennung(w)])
    zeilen = kennungen_einfuegen(zeilen, kennungen)
    return "\n".join(" ".join(w[4] for w in z[2]) for z in zeilen)


def main(pfad):
    doc = pymupdf.open(pfad)
    sys.stdout.write("\n\f\n".join(seitentext(seite) for seite in doc))
    sys.stdout.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write("Aufruf: pdf-text.py <datei.pdf>\n")
        sys.exit(2)
    main(sys.argv[1])
