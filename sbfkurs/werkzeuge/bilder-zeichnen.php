#!/usr/bin/env php
<?php
/**
 * Eigene Grafiken für die Bildfragen des SBF-Binnen-Katalogs als SVG erzeugen.
 *
 *   php werkzeuge/bilder-zeichnen.php [--ziel content/binnen/bilder]
 *
 * Die amtlichen Katalog-PDFs enthalten Fotos und Zeichnungen, die nicht
 * übernommen werden. Hier entsteht je Frage eine eigene, schematische
 * Zeichnung aus wenigen Bausteinen (Tafelzeichen nach Anhang 7 BinSchStrO,
 * Lichter auf dunklem Grund, Sichtzeichen an einer Bootssilhouette,
 * Schallsignale als Punkt/Strich-Folge, Segelskizzen von oben). Jedes SVG
 * trägt einen <title> als Textfassung; der Import hängt die Datei über das
 * Profil (bilder: Nummer → Datei) an die Frage.
 *
 * Deterministisch: gleicher Aufruf, gleiche Dateien — die SVGs werden mit
 * eingecheckt, das Skript dokumentiert, wie sie entstanden sind.
 */

declare(strict_types=1);

$ziel = __DIR__ . '/../content/binnen/bilder';
for ($i = 1; $i < $argc; $i++) {
    if ($argv[$i] === '--ziel' && isset($argv[$i + 1])) {
        $ziel = $argv[++$i];
    }
}

// --------------------------------------------------------------- Farben

const ROT = '#c8102e';
const BLAU = '#0057a8';
const GELB = '#f2c500';
const GRUEN = '#2e9e4f';
const WEISS = '#ffffff';
const SCHWARZ = '#1a1a1a';
const NACHT = '#101418';
const WASSER = '#dce9f2';

// ------------------------------------------------------------- Bausteine

function svg(int $b, int $h, string $titel, string $inhalt, string $grund = WEISS): string
{
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $b . ' ' . $h . '" width="' . $b . '" height="' . $h . '" role="img" aria-labelledby="t">'
        . "\n<title id=\"t\">" . htmlspecialchars($titel, ENT_XML1 | ENT_QUOTES, 'UTF-8') . "</title>\n"
        . '<rect width="' . $b . '" height="' . $h . '" fill="' . $grund . '"/>' . "\n"
        . $inhalt . "\n</svg>\n";
}

/** Gebots-/Verbotstafel: roter Rahmen, weißes Feld, Symbol, optional roter Schrägstrich. */
function tafel(string $symbol, bool $verbot = false, int $x = 0, int $y = 0, int $g = 200): string
{
    $s = $g / 200;
    $out = '<g transform="translate(' . $x . ' ' . $y . ') scale(' . $s . ')">'
        . '<rect x="4" y="4" width="192" height="192" rx="6" fill="' . ROT . '"/>'
        . '<rect x="30" y="30" width="140" height="140" fill="' . WEISS . '"/>'
        . $symbol;
    if ($verbot) {
        $out .= '<line x1="30" y1="30" x2="170" y2="170" stroke="' . ROT . '" stroke-width="14" stroke-linecap="round"/>';
    }
    return $out . '</g>';
}

/** Hinweistafel: blaues Feld mit weißem Symbol. */
function hinweistafel(string $symbol, int $x = 0, int $y = 0, int $g = 200): string
{
    $s = $g / 200;
    return '<g transform="translate(' . $x . ' ' . $y . ') scale(' . $s . ')">'
        . '<rect x="4" y="4" width="192" height="192" rx="6" fill="' . BLAU . '"/>' . $symbol . '</g>';
}

/** Rot-weiß-rote bzw. grün-weiß-grüne Tafel (Verbot/Erlaubnis der Durchfahrt). */
function bandtafel(string $farbe, int $x = 0, int $y = 0, int $g = 200): string
{
    $s = $g / 200;
    return '<g transform="translate(' . $x . ' ' . $y . ') scale(' . $s . ')">'
        . '<rect x="4" y="4" width="192" height="192" rx="6" fill="' . $farbe . '"/>'
        . '<rect x="4" y="76" width="192" height="48" fill="' . WEISS . '"/></g>';
}

/** Pfeil von (x1,y1) nach (x2,y2), schwarz, mit Spitze. */
function pfeil(float $x1, float $y1, float $x2, float $y2, string $farbe = SCHWARZ, float $breite = 14): string
{
    $dx = $x2 - $x1;
    $dy = $y2 - $y1;
    $l = sqrt($dx * $dx + $dy * $dy);
    $ux = $dx / $l;
    $uy = $dy / $l;
    $kopf = $breite * 1.8;
    $bx = $x2 - $ux * $kopf;
    $by = $y2 - $uy * $kopf;
    $px = -$uy;
    $py = $ux;
    $w = $breite * 1.3;
    return sprintf(
        '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/><polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>',
        $x1, $y1, $bx, $by, $farbe, $breite,
        $x2, $y2, $bx + $px * $w, $by + $py * $w, $bx - $px * $w, $by - $py * $w, $farbe
    );
}

/** Ein Licht: leuchtender Kreis mit Schein. */
function licht(float $x, float $y, string $farbe, float $r = 11): string
{
    return sprintf(
        '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" opacity="0.25"/><circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="#fff" stroke-width="1.5" stroke-opacity="0.6"/>',
        $x, $y, $r * 2.2, $farbe, $x, $y, $r, $farbe
    );
}

/** Nachtszene: dunkler Grund, Wasserlinie, Fahrzeug nur als schwache Silhouette. */
function nacht(string $titel, string $lichter, bool $silhouette = true): string
{
    $inhalt = '<rect y="150" width="360" height="70" fill="#1c2a36"/>';
    if ($silhouette) {
        $inhalt .= '<g fill="none" stroke="#5a6b78" stroke-width="2">'
            . '<polygon points="110,150 250,150 236,176 124,176"/>'
            . '<rect x="150" y="110" width="60" height="40"/>'
            . '<line x1="180" y1="110" x2="180" y2="40"/>'
            . '<line x1="120" y1="80" x2="240" y2="80"/></g>';
    }
    return svg(360, 220, $titel, $inhalt . $lichter, NACHT);
}

/** Tagszene: Schiff von vorn mit Mast und Rah, Sichtzeichen an den Positionen. */
function tag(string $titel, string $zeichen): string
{
    $inhalt = '<rect y="150" width="360" height="70" fill="' . WASSER . '"/>'
        . '<g fill="none" stroke="' . SCHWARZ . '" stroke-width="3">'
        . '<polygon points="110,150 250,150 236,178 124,178" fill="#f4f4f4"/>'
        . '<rect x="150" y="110" width="60" height="40" fill="#f4f4f4"/>'
        . '<line x1="180" y1="110" x2="180" y2="36"/>'
        . '<line x1="112" y1="76" x2="248" y2="76"/></g>'
        . '<path d="M0 190 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#8fb3cc" stroke-width="2"/>';
    return svg(360, 220, $titel, $inhalt . $zeichen);
}

/** Tagszene mit Schiff von der Seite (Schubleichter) und Mast mittschiffs. */
function seitlich(string $titel, string $zeichen): string
{
    $inhalt = '<rect y="150" width="360" height="70" fill="' . WASSER . '"/>'
        . '<g fill="#f4f4f4" stroke="' . SCHWARZ . '" stroke-width="3">'
        . '<polygon points="40,150 320,150 304,172 56,172"/>'
        . '<rect x="250" y="118" width="46" height="32"/></g>'
        . '<line x1="180" y1="150" x2="180" y2="40" stroke="' . SCHWARZ . '" stroke-width="3"/>';
    return svg(360, 220, $titel, $inhalt . $zeichen);
}

/** Blauer Kegel, Spitze unten, an Position. */
function kegel(float $x, float $y, string $farbe = BLAU, float $g = 22): string
{
    return sprintf('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>', $x - $g / 2, $y - $g, $x + $g / 2, $y - $g, $x, $y, $farbe);
}

/** Doppelkegel (zwei Kegel, Spitzen aufeinander) = Rhombus. */
function doppelkegel(float $x, float $y, string $farbe = GRUEN, float $g = 22): string
{
    return sprintf('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>', $x, $y - $g, $x + $g / 2, $y, $x, $y + $g, $x - $g / 2, $y, $farbe);
}

function ball(float $x, float $y, float $r = 12): string
{
    return sprintf('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>', $x, $y, $r, SCHWARZ);
}

/** Flagge am Stock; $farben = Streifen von oben nach unten. */
function flagge(float $x, float $y, array $farben, float $b = 30, float $h = 22): string
{
    $out = sprintf('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2"/>', $x, $y, $x, $y + $h + 10, SCHWARZ);
    $n = count($farben);
    foreach ($farben as $i => $f) {
        $out .= sprintf('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" stroke="%s" stroke-width="0.8"/>', $x, $y + $i * $h / $n, $b, $h / $n, $f, SCHWARZ);
    }
    return $out;
}

/** Schallsignal als Folge: 'k' kurzer Ton (Punkt), 'l' langer Ton (Strich). */
function schall(string $titel, string $folge, bool $wiederholt = false): string
{
    $x = 40;
    $teile = '';
    foreach (str_split($folge) as $t) {
        if ($t === 'k') {
            $teile .= sprintf('<circle cx="%.1f" cy="60" r="12" fill="%s"/>', $x + 12, SCHWARZ);
            $x += 44;
        } else {
            $teile .= sprintf('<rect x="%.1f" y="52" width="58" height="16" rx="8" fill="%s"/>', $x, SCHWARZ);
            $x += 78;
        }
    }
    $b = max(400, $x + 30);
    $legende = '<text x="' . ($b / 2) . '" y="108" font-family="system-ui, sans-serif" font-size="12" text-anchor="middle" fill="#444">'
        . ($wiederholt ? 'ständig wiederholt · ' : '') . 'Punkt = kurzer Ton (ca. 1 s), Strich = langer Ton (ca. 4 s)</text>';
    $klammern = '<path d="M22 30 q-12 30 0 60" fill="none" stroke="#666" stroke-width="3"/>'
        . '<path d="M' . ($b - 22) . ' 30 q12 30 0 60" fill="none" stroke="#666" stroke-width="3"/>';
    return svg($b, 124, $titel, $klammern . $teile . $legende);
}

/** Segelboot von oben: Rumpf als Tropfen, Segel als Bogen nach Lee; $kurs in Grad (0 = nach oben). */
function segelboot(float $x, float $y, float $kurs, string $name = '', bool $wind_von_bb = true, bool $kegel = false, string $farbe = '#f7f7f7'): string
{
    // Segel steht auf der Leeseite: Wind von Backbord → Segel nach Steuerbord (rechts).
    $seite = $wind_von_bb ? 1 : -1;
    $out = sprintf('<g transform="translate(%.1f %.1f) rotate(%.1f)">', $x, $y, $kurs);
    $out .= '<path d="M0 -34 C 14 -20, 14 20, 6 32 L -6 32 C -14 20, -14 -20, 0 -34 Z" fill="' . $farbe . '" stroke="' . SCHWARZ . '" stroke-width="2.5"/>';
    $out .= sprintf('<path d="M0 -8 Q %d 10 %d 26" fill="none" stroke="%s" stroke-width="3"/>', 18 * $seite, 6 * $seite, SCHWARZ);
    $out .= '<circle cx="0" cy="-8" r="3" fill="' . SCHWARZ . '"/>';
    if ($kegel) {
        $out .= '<polygon points="-7,-6 7,-6 0,6" fill="' . SCHWARZ . '" transform="translate(0 -18)"/>';
    }
    $out .= '</g>';
    if ($name !== '') {
        $out .= sprintf('<text x="%.1f" y="%.1f" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="%s">%s</text>', $x + 30, $y + 6, SCHWARZ, $name);
    }
    return $out;
}

/** Motorboot von oben mit Heckwelle. */
function motorboot(float $x, float $y, float $kurs): string
{
    return sprintf('<g transform="translate(%.1f %.1f) rotate(%.1f)">', $x, $y, $kurs)
        . '<path d="M0 -36 C 16 -18, 16 26, 10 34 L -10 34 C -16 26, -16 -18, 0 -36 Z" fill="#f7f7f7" stroke="' . SCHWARZ . '" stroke-width="2.5"/>'
        . '<rect x="-7" y="-4" width="14" height="14" fill="none" stroke="' . SCHWARZ . '" stroke-width="2"/>'
        . '<path d="M-8 40 q8 10 16 0 M-14 50 q14 14 28 0" fill="none" stroke="#7a9bb5" stroke-width="2"/></g>';
}

/** Windpfeil mit Beschriftung. */
function wind(float $x1, float $y1, float $x2, float $y2): string
{
    $mx = ($x1 + $x2) / 2;
    $my = ($y1 + $y2) / 2;
    return pfeil($x1, $y1, $x2, $y2, '#3a6ea5', 6)
        . sprintf('<text x="%.1f" y="%.1f" font-family="system-ui, sans-serif" font-size="14" text-anchor="middle" fill="#3a6ea5">Wind</text>', $mx, $my - 12);
}

/** Skizze von oben: helles Wasser als Grund. */
function skizze(string $titel, string $inhalt): string
{
    return svg(360, 220, $titel, $inhalt, WASSER);
}

/** Brückendurchfahrt: Fahrbahn mit Fachwerk und zwei Pfeilern, Tafeln darunter. */
function bruecke(string $titel, string $tafeln): string
{
    $inhalt = '<rect y="170" width="360" height="50" fill="' . WASSER . '"/>'
        . '<rect x="0" y="40" width="360" height="22" fill="#e8e8e8" stroke="' . SCHWARZ . '" stroke-width="2"/>'
        . '<path d="M0 62 L30 40 L60 62 L90 40 L120 62 L150 40 L180 62 L210 40 L240 62 L270 40 L300 62 L330 40 L360 62" fill="none" stroke="' . SCHWARZ . '" stroke-width="1.5"/>'
        . '<g fill="#e8e8e8" stroke="' . SCHWARZ . '" stroke-width="2"><polygon points="60,62 100,62 106,172 54,172"/><polygon points="260,62 300,62 306,172 254,172"/></g>';
    return svg(360, 220, $titel, $inhalt . $tafeln);
}

/** Rhombus (Tafel an Brücken); $links/$rechts = Farben der beiden Hälften. */
function rhombus(float $x, float $y, string $links, string $rechts, float $g = 26): string
{
    return sprintf('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" stroke="%s" stroke-width="1.5"/>', $x, $y - $g, $x, $y + $g, $x - $g, $y, $links, SCHWARZ)
        . sprintf('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" stroke="%s" stroke-width="1.5"/>', $x, $y - $g, $x + $g, $y, $x, $y + $g, $rechts, SCHWARZ);
}

function text(float $x, float $y, string $t, int $gr = 16, string $anker = 'middle', string $farbe = SCHWARZ): string
{
    return sprintf('<text x="%.1f" y="%.1f" font-family="system-ui, sans-serif" font-size="%d" font-weight="700" text-anchor="%s" fill="%s">%s</text>', $x, $y, $gr, $anker, $farbe, htmlspecialchars($t, ENT_XML1, 'UTF-8'));
}

function anker(): string
{
    return '<g fill="none" stroke="' . SCHWARZ . '" stroke-width="10" stroke-linecap="round">'
        . '<circle cx="100" cy="52" r="9"/><line x1="100" y1="61" x2="100" y2="150"/><line x1="74" y1="80" x2="126" y2="80"/>'
        . '<path d="M58 118 q42 46 84 0"/></g>';
}

function poller(): string
{
    return '<g fill="' . SCHWARZ . '"><rect x="78" y="60" width="44" height="90" rx="6"/><rect x="66" y="52" width="68" height="18" rx="6"/>'
        . '<rect x="40" y="96" width="120" height="12" transform="rotate(-8 100 102)"/></g>';
}

function wellen(): string
{
    return '<g fill="none" stroke="' . SCHWARZ . '" stroke-width="12" stroke-linecap="round">'
        . '<path d="M46 84 q27 -22 54 0 t54 0"/><path d="M46 118 q27 -22 54 0 t54 0"/></g>';
}

function propeller(): string
{
    return '<g fill="' . SCHWARZ . '"><circle cx="100" cy="100" r="12"/>'
        . '<ellipse cx="100" cy="66" rx="16" ry="30"/><ellipse cx="70" cy="118" rx="16" ry="30" transform="rotate(120 70 118)"/>'
        . '<ellipse cx="130" cy="118" rx="16" ry="30" transform="rotate(-120 130 118)"/></g>';
}

function wasserski(): string
{
    return '<g fill="' . WEISS . '"><circle cx="128" cy="50" r="12"/>'
        . '<path d="M120 66 l-30 34 l16 34 l-26 6 l-6 -12 l14 -6 l-18 -30 l34 -40 z"/>'
        . '<path d="M100 96 l38 -20 l6 10 l-40 22 z"/><path d="M40 140 q60 -10 120 0 l-4 8 q-56 -8 -112 0 z"/>'
        . '<path d="M46 150 h116 v6 h-116 z"/><path d="M136 60 l50 -20 l3 7 l-48 22 z"/></g>';
}

function wassermotorrad(): string
{
    return '<g fill="' . WEISS . '"><path d="M30 130 q80 30 140 0 l-14 -24 h-112 z"/>'
        . '<path d="M78 106 l14 -28 h44 l-6 28 z"/><circle cx="112" cy="58" r="11"/>'
        . '<path d="M104 70 l-14 30 h30 l-6 -30 z"/><path d="M118 80 l34 -14 l3 6 l-32 16 z"/>'
        . '<path d="M26 148 q70 14 148 0" fill="none" stroke="' . WEISS . '" stroke-width="5"/></g>';
}

// ------------------------------------------------------------ Motive

$bilder = [];

// Basisfragen: Töne
$bilder['004'] = schall('Kurzer Ton: ein Punkt.', 'k');
$bilder['005'] = schall('Langer Ton: ein Strich.', 'l');
$bilder['016'] = schall('Bleib-weg-Signal: ein kurzer und ein langer Ton, ständig wiederholt.', 'klklkl', true);

// Tafelzeichen
$bilder['017'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, zwei schwarze Pfeile nebeneinander nach oben, roter Schrägstrich.',
    tafel(pfeil(76, 150, 76, 48) . pfeil(124, 150, 124, 48), true));
$bilder['018'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, ein Pfeil nach oben und einer nach unten nebeneinander, roter Schrägstrich.',
    tafel(pfeil(76, 48, 76, 150) . pfeil(124, 150, 124, 48), true));
$bilder['019'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, zwei schwarze Wellenlinien, roter Schrägstrich.', tafel(wellen(), true));
$bilder['020'] = svg(240, 200, 'Tafelzeichen: roter Rahmen, schwarzes nach links zeigendes Fünfeck mit der weißen Zahl 40.',
    '<rect x="4" y="4" width="232" height="192" rx="6" fill="' . ROT . '"/><rect x="30" y="30" width="180" height="140" fill="' . WEISS . '"/>'
    . '<polygon points="46,100 86,50 200,50 200,150 86,150" fill="' . SCHWARZ . '"/>' . text(140, 118, '40', 52, 'middle', WEISS));
$bilder['021'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, weißes Feld mit schwarzem waagerechtem Balken.',
    tafel('<rect x="62" y="88" width="76" height="24" rx="12" fill="' . SCHWARZ . '"/>'));
$bilder['022'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, schwarzer Anker, roter Schrägstrich.', tafel(anker(), true));
$bilder['023'] = svg(420, 200, 'Zwei Tafelzeichen: roter Rahmen mit durchgestrichenem Poller; roter Rahmen mit durchgestrichenem P.',
    tafel(poller(), true) . tafel(text(100, 136, 'P', 104), true, 220));
$bilder['024'] = svg(200, 260, 'Tafelzeichen: roter Rahmen mit schwarzem Punkt, darunter eine kleine weiße Tafel mit schwarzem Strich.',
    tafel('<circle cx="100" cy="100" r="30" fill="' . SCHWARZ . '"/>')
    . '<rect x="40" y="206" width="120" height="44" fill="' . WEISS . '" stroke="' . SCHWARZ . '" stroke-width="2"/><rect x="62" y="224" width="76" height="8" fill="' . SCHWARZ . '"/>');
$bilder['025'] = svg(420, 200, 'Zwei blaue Tafeln: weißer Wasserskiläufer; weißes Wassermotorrad mit Fahrer.',
    hinweistafel(wasserski()) . hinweistafel(wassermotorrad(), 220));
$bilder['026'] = svg(200, 200, 'Tafelzeichen: blaues Feld mit weißem Schrägstrich von links oben nach rechts unten.',
    hinweistafel('<line x1="40" y1="30" x2="160" y2="170" stroke="' . WEISS . '" stroke-width="16"/>'));
$bilder['027'] = svg(200, 200, 'Tafelzeichen: rote Tafel mit waagerechtem weißem Band (rot-weiß-rot).', bandtafel(ROT));
$bilder['028'] = svg(240, 120, 'Zwei rote Lichter nebeneinander.', licht(70, 60, ROT, 26) . licht(170, 60, ROT, 26), NACHT);
$bilder['029'] = svg(120, 240, 'Zwei rote Lichter übereinander.', licht(60, 70, ROT, 26) . licht(60, 170, ROT, 26), NACHT);
$bilder['030'] = svg(240, 120, 'Zwei grüne Lichter nebeneinander.', licht(70, 60, GRUEN, 26) . licht(170, 60, GRUEN, 26), NACHT);

$bilder['107'] = svg(200, 200, 'Blaue Tafel mit weißem Dreieck, darin drei blaue Kegel übereinander, Spitzen nach unten.',
    hinweistafel('<polygon points="100,26 180,166 20,166" fill="' . WEISS . '"/>' . kegel(100, 84, BLAU, 18) . kegel(100, 116, BLAU, 18) . kegel(100, 148, BLAU, 18)));
$bilder['108'] = svg(420, 200, 'Zwei blaue Tafeln: weißer Rhombus; weißes Dreieck mit Spitze nach unten.',
    hinweistafel('<polygon points="100,32 168,100 100,168 32,100" fill="' . WEISS . '"/>')
    . hinweistafel('<polygon points="26,44 174,44 100,168" fill="' . WEISS . '"/>', 220));
$bilder['110'] = bruecke('Brücke mit einem gelben Rhombus in der Mitte der Durchfahrt.', rhombus(180, 100, GELB, GELB));
$bilder['111'] = svg(420, 200, 'Zwei gelbe Rhomben nebeneinander oder zwei gelbe Rhomben übereinander.',
    rhombus(60, 100, GELB, GELB) . rhombus(130, 100, GELB, GELB) . text(215, 106, 'oder', 16, 'middle', '#555')
    . rhombus(330, 62, GELB, GELB) . rhombus(330, 138, GELB, GELB));
$bilder['112'] = svg(360, 200, 'Zwei Rhomben, je zur Hälfte rot und weiß, die roten Hälften außen; Pfeile zeigen nach innen zwischen die Tafeln.',
    rhombus(70, 70, ROT, WEISS, 34) . rhombus(290, 70, WEISS, ROT, 34)
    . '<line x1="70" y1="120" x2="70" y2="160" stroke="' . SCHWARZ . '" stroke-width="2" stroke-dasharray="6 5"/><line x1="290" y1="120" x2="290" y2="160" stroke="' . SCHWARZ . '" stroke-width="2" stroke-dasharray="6 5"/>'
    . pfeil(80, 150, 160, 150, SCHWARZ, 4) . pfeil(280, 150, 200, 150, SCHWARZ, 4));
$bilder['113'] = svg(360, 200, 'Zwei Rhomben, je zur Hälfte gelb und weiß; Pfeile zeigen von den Tafeln nach außen.',
    rhombus(70, 70, WEISS, GELB, 34) . rhombus(290, 70, GELB, WEISS, 34)
    . '<line x1="70" y1="120" x2="70" y2="160" stroke="' . SCHWARZ . '" stroke-width="2" stroke-dasharray="6 5"/><line x1="290" y1="120" x2="290" y2="160" stroke="' . SCHWARZ . '" stroke-width="2" stroke-dasharray="6 5"/>'
    . pfeil(150, 150, 84, 150, SCHWARZ, 4) . pfeil(210, 150, 276, 150, SCHWARZ, 4));
$bilder['114'] = svg(200, 200, 'Ein gelber Rhombus.', rhombus(100, 100, GELB, GELB, 70));
$bilder['115'] = svg(360, 200, 'Zwei gelbe Rhomben nebeneinander.', rhombus(100, 100, GELB, GELB, 70) . rhombus(260, 100, GELB, GELB, 70));
$bilder['116'] = svg(200, 200, 'Rote Tafel mit waagerechtem weißem Band (rot-weiß-rot).', bandtafel(ROT));

// Lichter und Sichtzeichen der Fahrzeuge
$bilder['120'] = nacht('Nachts: zwei weiße Lichter senkrecht übereinander, darunter links ein rotes und rechts ein grünes Licht.',
    licht(180, 50, WEISS) . licht(180, 86, WEISS) . licht(120, 130, ROT) . licht(240, 130, GRUEN));
$bilder['121'] = seitlich('Tagzeichen: ein Zylinder am Mast.',
    '<rect x="166" y="44" width="28" height="40" fill="' . SCHWARZ . '"/><rect x="166" y="58" width="28" height="12" fill="' . WEISS . '"/>');
$bilder['122'] = seitlich('Tagzeichen: ein schwarzer Ball am Mast.', ball(180, 56, 14));
$bilder['123'] = nacht('Nachts: drei weiße Lichter im Dreieck (eines oben, zwei darunter nebeneinander), darunter links rot und rechts grün.',
    licht(180, 44, WEISS) . licht(150, 84, WEISS) . licht(210, 84, WEISS) . licht(120, 130, ROT) . licht(240, 130, GRUEN));
$bilder['124'] = nacht('Nachts: ein grünes Licht über einem weißen Licht.', licht(180, 50, GRUEN) . licht(180, 90, WEISS));
$bilder['125'] = nacht('Nachts: ein grünes Licht über einem weißen Licht, darunter links rot und rechts grün.',
    licht(180, 50, GRUEN) . licht(180, 90, WEISS) . licht(120, 130, ROT) . licht(240, 130, GRUEN));
$bilder['127'] = seitlich('Tagzeichen: ein blauer Kegel am Mast, Spitze nach unten.', kegel(180, 66));
$bilder['129'] = seitlich('Tagzeichen: zwei blaue Kegel übereinander am Mast, Spitzen nach unten.', kegel(180, 60) . kegel(180, 88));
$bilder['131'] = seitlich('Tagzeichen: drei blaue Kegel übereinander am Mast, Spitzen nach unten.', kegel(180, 58) . kegel(180, 84) . kegel(180, 110));
$bilder['132'] = seitlich('Tagzeichen: ein roter Wimpel am Mast.',
    '<polygon points="180,40 236,52 180,64" fill="' . ROT . '" stroke="' . SCHWARZ . '" stroke-width="1"/>');

$bilder['145'] = nacht('Nachts, Fahrzeug von vorn: auf beiden Seiten je ein rotes Licht über einem weißen Licht.',
    licht(120, 60, ROT) . licht(120, 96, WEISS) . licht(240, 60, ROT) . licht(240, 96, WEISS));
$bilder['146'] = tag('Am Tag, Fahrzeug von vorn: auf beiden Seiten je eine rot-weiße Flagge (rot oben).',
    flagge(96, 40, [ROT, WEISS]) . flagge(232, 40, [ROT, WEISS]));
$bilder['147'] = nacht('Nachts, Fahrzeug von vorn: links ein rotes Licht, rechts ein rotes Licht über einem weißen Licht.',
    licht(120, 60, ROT) . licht(240, 60, ROT) . licht(240, 96, WEISS));
$bilder['148'] = tag('Am Tag, Fahrzeug von vorn: links eine rote Flagge, rechts eine rot-weiße Flagge.',
    flagge(96, 40, [ROT]) . flagge(232, 40, [ROT, WEISS]));
$bilder['149'] = nacht('Nachts, Fahrzeug von vorn: links ein rotes Licht, rechts zwei grüne Lichter übereinander.',
    licht(120, 60, ROT) . licht(240, 60, GRUEN) . licht(240, 96, GRUEN));
$bilder['150'] = tag('Am Tag, Fahrzeug von vorn: links ein schwarzer Ball, rechts zwei grüne Doppelkegel übereinander.',
    ball(110, 56) . doppelkegel(250, 46, GRUEN, 16) . doppelkegel(250, 84, GRUEN, 16));
$bilder['151'] = tag('Am Tag, Fahrzeug von vorn: links eine rot-weiß-rote Tafel, rechts eine grün-weiß-grüne Tafel.',
    bandtafel(ROT, 66, 28, 56) . bandtafel(GRUEN, 238, 28, 56));
$bilder['152'] = nacht('Nachts, Fahrzeug von vorn: auf beiden Seiten je zwei grüne Lichter übereinander.',
    licht(120, 60, GRUEN) . licht(120, 96, GRUEN) . licht(240, 60, GRUEN) . licht(240, 96, GRUEN));
$bilder['153'] = tag('Am Tag, Fahrzeug von vorn: auf beiden Seiten je zwei grüne Doppelkegel übereinander.',
    doppelkegel(110, 46, GRUEN, 16) . doppelkegel(110, 84, GRUEN, 16) . doppelkegel(250, 46, GRUEN, 16) . doppelkegel(250, 84, GRUEN, 16));
$bilder['154'] = tag('Am Tag, Fahrzeug von vorn: auf beiden Seiten je eine grün-weiß-grüne Tafel.',
    bandtafel(GRUEN, 66, 28, 56) . bandtafel(GRUEN, 238, 28, 56));
$bilder['155'] = svg(420, 220, 'Links am Tag: Fahrzeug mit rot-weißer Flagge (rot oben). Rechts nachts: ein rotes Licht über einem weißen Licht.',
    '<rect width="200" height="220" fill="' . WEISS . '"/><rect y="150" width="200" height="70" fill="' . WASSER . '"/>'
    . '<g fill="#f4f4f4" stroke="' . SCHWARZ . '" stroke-width="3"><polygon points="50,150 150,150 140,176 60,176"/><rect x="80" y="112" width="40" height="38"/></g>'
    . '<line x1="100" y1="112" x2="100" y2="40" stroke="' . SCHWARZ . '" stroke-width="3"/>' . flagge(100, 40, [ROT, WEISS])
    . '<rect x="220" width="200" height="220" fill="' . NACHT . '"/><rect x="220" y="150" width="200" height="70" fill="#1c2a36"/>'
    . '<g fill="none" stroke="#5a6b78" stroke-width="2"><polygon points="270,150 370,150 360,176 280,176"/><line x1="320" y1="150" x2="320" y2="40"/></g>'
    . licht(320, 56, ROT) . licht(320, 94, WEISS) . text(100, 206, 'Tag', 14, 'middle', '#444') . text(320, 206, 'Nacht', 14, 'middle', '#cfd8e0'));
$bilder['156'] = svg(200, 200, 'Rundes rotes Zeichen mit waagerechtem weißem Streifen.',
    '<circle cx="100" cy="100" r="92" fill="' . ROT . '"/><rect x="8" y="86" width="184" height="28" fill="' . WEISS . '"/>');
$bilder['157'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, schwarzer Propeller, roter Schrägstrich.', tafel(propeller(), true));

// Schallsignale beim Manövrieren
$bilder['162'] = schall('Ein langer Ton, ein kurzer Ton.', 'lk');
$bilder['163'] = schall('Ein langer Ton, zwei kurze Töne.', 'lkk');
$bilder['164'] = schall('Zwei lange Töne, ein kurzer Ton.', 'llk');
$bilder['165'] = schall('Zwei lange Töne, zwei kurze Töne.', 'llkk');
$bilder['166'] = schall('Drei lange Töne, ein kurzer Ton.', 'lllk');
$bilder['167'] = schall('Drei lange Töne, zwei kurze Töne.', 'lllkk');

// Segelskizzen (Draufsicht)
$bilder['180'] = skizze('Von oben: Wind von links unten. Ein Motorboot fährt nach links, ein Segelboot kreuzt seinen Kurs nach rechts oben; die Kurse laufen aufeinander zu.',
    wind(30, 190, 80, 160) . motorboot(260, 70, -90) . segelboot(120, 150, 40, '', true)
    . '<line x1="120" y1="150" x2="200" y2="80" stroke="' . SCHWARZ . '" stroke-width="1.5" stroke-dasharray="6 5"/>'
    . '<line x1="260" y1="70" x2="180" y2="76" stroke="' . SCHWARZ . '" stroke-width="1.5" stroke-dasharray="6 5"/>');
$bilder['183'] = skizze('Von oben: Wind von links oben. Boot A rechts oben führt einen schwarzen Kegel, Boot B links unten segelt; beide laufen aufeinander zu.',
    wind(30, 30, 70, 60) . segelboot(280, 70, 200, 'A', true, true) . segelboot(90, 150, 30, 'B', false)
    . '<line x1="90" y1="150" x2="200" y2="100" stroke="' . SCHWARZ . '" stroke-width="1.5" stroke-dasharray="6 5"/>'
    . '<line x1="280" y1="70" x2="215" y2="100" stroke="' . SCHWARZ . '" stroke-width="1.5" stroke-dasharray="6 5"/>');
$bilder['185'] = skizze('Von oben: Wind von oben. Boot A links segelt nach rechts oben mit Wind von Backbord, Boot B rechts nach links oben mit Wind von Steuerbord; Kollisionskurs.',
    wind(180, 20, 180, 56) . segelboot(80, 150, 40, 'A', true) . segelboot(280, 150, -40, 'B', false)
    . '<line x1="80" y1="150" x2="170" y2="80" stroke="' . SCHWARZ . '" stroke-width="1.5" stroke-dasharray="6 5"/>'
    . '<line x1="280" y1="150" x2="190" y2="80" stroke="' . SCHWARZ . '" stroke-width="1.5" stroke-dasharray="6 5"/>');
$bilder['186'] = skizze('Von oben: Wind von links oben. Boot B liegt luvseitig (näher am Wind) links oben, Boot A leeseitig rechts unten; beide segeln denselben Kurs nach rechts oben.',
    wind(24, 30, 64, 62) . segelboot(150, 70, 50, 'B', true) . segelboot(250, 160, 50, 'A', true)
    . '<line x1="150" y1="70" x2="240" y2="10" stroke="' . SCHWARZ . '" stroke-width="1.5" stroke-dasharray="6 5"/>'
    . '<line x1="250" y1="160" x2="330" y2="100" stroke="' . SCHWARZ . '" stroke-width="1.5" stroke-dasharray="6 5"/>');
$bilder['188'] = skizze('Von oben: Wind von rechts. Drei Boote A, B und C nebeneinander segeln nach oben; A ist am weitesten in Lee (links), C am weitesten in Luv (rechts).',
    wind(334, 120, 292, 120) . segelboot(70, 120, 0, 'A', false) . segelboot(160, 120, 0, 'B', false) . segelboot(250, 120, 0, 'C', false));
$bilder['189'] = skizze('Von oben: Wind von oben. Boot C liegt links oben in Luv, Boot B links unten, Boot A rechts unten in Lee; alle segeln nach rechts oben.',
    wind(180, 20, 180, 56) . segelboot(90, 70, 50, 'C', true) . segelboot(110, 165, 50, 'B', true) . segelboot(260, 170, 50, 'A', true));
$bilder['192'] = svg(360, 220, 'Nachts: links ein rotes Licht, rechts daneben ein weißes Licht.', licht(130, 120, ROT, 14) . licht(230, 110, WEISS, 14), NACHT);
$bilder['196'] = svg(200, 240, 'Nachts: ein rotes Licht über einem weißen Licht.', licht(100, 70, ROT, 22) . licht(100, 170, WEISS, 22), NACHT);

// Weitere Tafelzeichen
$bilder['198'] = svg(240, 200, 'Tafelzeichen: roter Rahmen, weißes Feld mit schwarzem Pfeil nach links.',
    '<rect x="4" y="4" width="232" height="192" rx="6" fill="' . ROT . '"/><rect x="30" y="30" width="180" height="140" fill="' . WEISS . '"/>' . pfeil(200, 100, 46, 100, SCHWARZ, 18));
$bilder['199'] = svg(240, 200, 'Weißer Winkel, Spitze nach rechts, mit einem roten Licht in der Öffnung.',
    '<polygon points="60,20 220,100 60,180 40,164 168,100 40,36" fill="' . WEISS . '" stroke="' . SCHWARZ . '" stroke-width="3"/>' . licht(70, 100, ROT, 20));
$bilder['200'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, weißes Feld mit der schwarzen Zahl 10.', tafel(text(100, 128, '10', 80)));
$bilder['201'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, weißes Feld mit schwarzem senkrechtem Balken.',
    tafel('<rect x="88" y="56" width="24" height="88" rx="12" fill="' . SCHWARZ . '"/>'));
$bilder['202'] = svg(200, 200, 'Tafelzeichen: roter Rahmen, schwarzer Kreispfeil, roter Schrägstrich.',
    tafel('<path d="M136 118 a40 40 0 1 1 -8 -46" fill="none" stroke="' . SCHWARZ . '" stroke-width="14"/><polygon points="116,54 146,60 130,88" fill="' . SCHWARZ . '"/>', true));
$bilder['203'] = svg(200, 200, 'Blaue Tafel mit weißem Kreispfeil.',
    hinweistafel('<path d="M136 118 a40 40 0 1 1 -8 -46" fill="none" stroke="' . WEISS . '" stroke-width="14"/><polygon points="116,54 146,60 130,88" fill="' . WEISS . '"/>'));
$bilder['204'] = svg(200, 200, 'Blaue Tafel mit weißem Wehrsymbol: waagerechter Balken mit fünf senkrechten Pfeilern.',
    hinweistafel('<rect x="30" y="60" width="140" height="18" fill="' . WEISS . '"/>'
        . '<rect x="30" y="78" width="16" height="70" fill="' . WEISS . '"/><rect x="62" y="78" width="16" height="70" fill="' . WEISS . '"/>'
        . '<rect x="92" y="78" width="16" height="70" fill="' . WEISS . '"/><rect x="122" y="78" width="16" height="70" fill="' . WEISS . '"/><rect x="154" y="78" width="16" height="70" fill="' . WEISS . '"/>'));
$bilder['243'] = bruecke('Brücke: gelber Rhombus in der Mitte der Durchfahrt, links und rechts je ein halb roter, halb weißer Rhombus mit der roten Hälfte nach außen.',
    rhombus(180, 100, GELB, GELB) . rhombus(122, 100, ROT, WEISS, 20) . rhombus(238, 100, WEISS, ROT, 20));
$bilder['244'] = svg(200, 200, 'Rote Tafel mit waagerechtem weißem Band (rot-weiß-rot).', bandtafel(ROT));

// Segelmanöver-Kurs
// Wind von links. Gegen den Uhrzeigersinn: unten (1) zeigt der Bug beim Drehen
// nach links in den Wind (Wende), oben (2) nach rechts vor den Wind (Halse),
// rechts (3) eine volle Drehung (Q-Wende), danach Auslauf nach rechts oben.
$bilder['295'] = svg(360, 240, 'Kursskizze auf Wasser: Wind kommt von links (Pfeil W). Das Boot kommt von rechts unten, dreht am unteren Punkt 1 nach links oben, läuft über die linke Seite zum oberen Punkt 2, dreht dort nach rechts unten, fährt rechts an Punkt 3 eine volle kleine Schleife und läuft nach rechts oben aus.',
    pfeil(16, 120, 62, 120, '#3a6ea5', 8) . text(18, 108, 'W', 15, 'start', '#3a6ea5')
    . '<path d="M330 195 C 260 214, 190 214, 160 204 C 110 190, 66 150, 78 108 C 88 72, 128 38, 158 38 C 195 38, 210 70, 232 110 C 244 128, 256 144, 268 158 a 24 24 0 1 0 30 -6 L 335 45" fill="none" stroke="' . SCHWARZ . '" stroke-width="2.5"/>'
    . pfeil(310, 88, 335, 45, SCHWARZ, 3) . pfeil(346, 190, 330, 195, SCHWARZ, 3)
    . '<circle cx="160" cy="204" r="4" fill="' . SCHWARZ . '"/><circle cx="158" cy="38" r="4" fill="' . SCHWARZ . '"/><circle cx="298" cy="180" r="4" fill="' . SCHWARZ . '"/>'
    . text(160, 230, '1', 18) . text(158, 26, '2', 18) . text(326, 190, '3', 18, 'start'), WASSER);

// ------------------------------------------------------------ Schreiben

if (!is_dir($ziel) && !mkdir($ziel, 0775, true) && !is_dir($ziel)) {
    fwrite(STDERR, "Zielverzeichnis $ziel lässt sich nicht anlegen.\n");
    exit(1);
}
ksort($bilder);
foreach ($bilder as $nr => $inhalt) {
    file_put_contents("$ziel/$nr.svg", $inhalt);
}
printf("%d SVG-Dateien nach %s geschrieben.\n", count($bilder), $ziel);
