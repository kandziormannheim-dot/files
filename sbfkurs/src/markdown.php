<?php

/**
 * Markdown-Teilmenge für Lektionen und Rechtstexte — genau die Konstrukte
 * aus docs/sbfkurs/INHALTE.md. Alles wird maskiert; rohes HTML im Text
 * erscheint als Text. Keine Abhängigkeit, kein Regex-Dschungel: ein
 * zeilenweiser Zustandsautomat für Blöcke, eine kleine Ersetzung für
 * Inline-Auszeichnung.
 */

declare(strict_types=1);

/** Markdown-Text in HTML wandeln. $bildBasis ist der URL-Präfix für relative Bilder. */
function markdownRendern(string $text, string $bildBasis = ''): string
{
    $zeilen = explode("\n", str_replace(["\r\n", "\r"], "\n", $text));
    $html = [];
    $absatz = [];
    $block = null;      // aktiver :::-Block
    $blockZeilen = [];
    $liste = null;      // ['art' => 'ul'|'ol', 'punkte' => [[ebene, text], …]]
    $tabelle = [];      // Zeilen der laufenden Tabelle
    $zitat = [];

    $absatzSchliessen = static function () use (&$absatz, &$html): void {
        if ($absatz !== []) {
            $html[] = '<p>' . mdInline(implode(' ', $absatz)) . '</p>';
            $absatz = [];
        }
    };
    $listeSchliessen = static function () use (&$liste, &$html): void {
        if ($liste !== null) {
            $html[] = mdListe($liste);
            $liste = null;
        }
    };
    $tabelleSchliessen = static function () use (&$tabelle, &$html): void {
        if ($tabelle !== []) {
            $html[] = mdTabelle($tabelle);
            $tabelle = [];
        }
    };
    $zitatSchliessen = static function () use (&$zitat, &$html): void {
        if ($zitat !== []) {
            $html[] = '<blockquote><p>' . mdInline(implode(' ', $zitat)) . '</p></blockquote>';
            $zitat = [];
        }
    };
    $allesSchliessen = static function () use ($absatzSchliessen, $listeSchliessen, $tabelleSchliessen, $zitatSchliessen): void {
        $absatzSchliessen();
        $listeSchliessen();
        $tabelleSchliessen();
        $zitatSchliessen();
    };

    foreach ($zeilen as $zeile) {
        $roh = rtrim($zeile);

        // ::: -Blöcke sammeln Zeilen und rendern sie beim Schließen gesondert.
        if ($block !== null) {
            if (trim($roh) === ':::') {
                $html[] = mdBlock($block, $blockZeilen, $bildBasis);
                $block = null;
                $blockZeilen = [];
            } else {
                $blockZeilen[] = $roh;
            }
            continue;
        }
        if (preg_match('/^:::([a-z]+)\s*$/', $roh, $t)) {
            $allesSchliessen();
            $block = $t[1];
            $blockZeilen = [];
            continue;
        }

        if (trim($roh) === '') {
            $allesSchliessen();
            continue;
        }

        if (preg_match('/^(#{2,3})\s+(.+)$/', $roh, $t)) {
            $allesSchliessen();
            $stufe = strlen($t[1]);
            $html[] = "<h$stufe id=\"" . e(mdAnker($t[2])) . '">' . mdInline($t[2]) . "</h$stufe>";
            continue;
        }

        if (preg_match('/^(\s*)([-*]|\d+\.)\s+(.+)$/', $roh, $t)) {
            $absatzSchliessen();
            $tabelleSchliessen();
            $zitatSchliessen();
            $art = ctype_digit(rtrim($t[2], '.')) ? 'ol' : 'ul';
            $ebene = intdiv(strlen($t[1]), 4);
            if ($liste === null || ($ebene === 0 && $liste['art'] !== $art)) {
                $listeSchliessen();
                $liste = ['art' => $art, 'punkte' => []];
            }
            $liste['punkte'][] = [$ebene, $art, $t[3]];
            continue;
        }

        if (str_starts_with($roh, '|')) {
            $absatzSchliessen();
            $listeSchliessen();
            $zitatSchliessen();
            $tabelle[] = $roh;
            continue;
        }

        if (preg_match('/^>\s?(.*)$/', $roh, $t)) {
            $absatzSchliessen();
            $listeSchliessen();
            $tabelleSchliessen();
            $zitat[] = $t[1];
            continue;
        }

        if (preg_match('/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/', $roh, $t)) {
            $allesSchliessen();
            $html[] = mdBild($t[1], $t[2], $bildBasis);
            continue;
        }

        // Fortsetzung eines Listenpunkts (eingerückte Textzeile)
        if ($liste !== null && preg_match('/^\s{2,}\S/', $roh)) {
            $letzte = count($liste['punkte']) - 1;
            $liste['punkte'][$letzte][2] .= ' ' . trim($roh);
            continue;
        }

        $listeSchliessen();
        $tabelleSchliessen();
        $zitatSchliessen();
        $absatz[] = trim($roh);
    }

    if ($block !== null) {
        $html[] = mdBlock($block, $blockZeilen, $bildBasis);
    }
    $allesSchliessen();

    return implode("\n", $html);
}

/** Inline-Auszeichnung: erst maskieren, dann **fett**, _kursiv_, `code`, [Link](url). */
function mdInline(string $text): string
{
    $text = e($text);
    // Code zuerst, damit darin nichts weiter ersetzt wird.
    $stuecke = preg_split('/(`[^`]+`)/', $text, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$text];
    foreach ($stuecke as $i => $stueck) {
        if ($stueck !== '' && $stueck[0] === '`' && str_ends_with($stueck, '`')) {
            $stuecke[$i] = '<code>' . substr($stueck, 1, -1) . '</code>';
            continue;
        }
        $stueck = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $stueck) ?? $stueck;
        $stueck = preg_replace('/(?<![\w])_(.+?)_(?![\w])/s', '<em>$1</em>', $stueck) ?? $stueck;
        $stueck = preg_replace_callback(
            '/\[([^\]]+)\]\(([^)\s]+)\)/',
            static function (array $t): string {
                $ziel = html_entity_decode($t[2], ENT_QUOTES, 'UTF-8');
                if (!preg_match('#^(https?://|/|\#)#i', $ziel)) {
                    return $t[1];
                }
                $extern = str_starts_with($ziel, 'http');

                return '<a href="' . e($ziel) . '"' . ($extern ? ' rel="noopener" target="_blank"' : '') . '>' . $t[1] . '</a>';
            },
            $stueck
        ) ?? $stueck;
        $stuecke[$i] = $stueck;
    }

    return implode('', $stuecke);
}

/** Überschriften-Anker: Kleinbuchstaben, Umlaute aufgelöst, Bindestriche. */
function mdAnker(string $text): string
{
    $text = mb_strtolower($text);
    $text = str_replace(['ä', 'ö', 'ü', 'ß'], ['ae', 'oe', 'ue', 'ss'], $text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? $text;

    return trim($text, '-');
}

/** Verschachtelte Liste aus [ebene, art, text]-Punkten. */
function mdListe(array $liste): string
{
    $html = '';
    $stapel = []; // offene Listen, innerste zuletzt; jede hat genau ein offenes <li>
    foreach ($liste['punkte'] as [$e, $art, $text]) {
        if ($e >= count($stapel)) {
            // Tiefer: neue Liste im offenen Punkt aufmachen (immer nur eine Stufe).
            $html .= "<$art>";
            $stapel[] = $art;
        } else {
            while (count($stapel) - 1 > $e) {
                $html .= '</li></' . array_pop($stapel) . '>';
            }
            $html .= '</li>';
        }
        $html .= '<li>' . mdInline($text);
    }
    while ($stapel !== []) {
        $html .= '</li></' . array_pop($stapel) . '>';
    }

    return $html;
}

/** Tabelle: erste Zeile Kopf, zweite Zeile Trenner (---), Rest Körper. */
function mdTabelle(array $zeilen): string
{
    $zellen = static fn (string $z): array => array_map('trim', explode('|', trim(trim($z), '|')));
    $kopf = $zellen($zeilen[0]);
    $koerper = array_slice($zeilen, 1);
    if (isset($koerper[0]) && preg_match('/^\|?\s*:?-{2,}/', $koerper[0])) {
        array_shift($koerper);
    }
    $html = '<div class="tabelle-rahmen"><table><thead><tr>';
    foreach ($kopf as $z) {
        $html .= '<th>' . mdInline($z) . '</th>';
    }
    $html .= '</tr></thead><tbody>';
    foreach ($koerper as $zeile) {
        $html .= '<tr>';
        foreach ($zellen($zeile) as $z) {
            $html .= '<td>' . mdInline($z) . '</td>';
        }
        $html .= '</tr>';
    }

    return $html . '</tbody></table></div>';
}

function mdBild(string $alt, string $quelle, string $bildBasis): string
{
    if (preg_match('#^(https?:)?//#i', $quelle) || str_contains($quelle, '..')) {
        return '';
    }
    $quelle = preg_replace('#^bilder/#', '', $quelle) ?? $quelle;

    return '<figure><img src="' . e($bildBasis . $quelle) . '" alt="' . e($alt) . '" loading="lazy">'
        . ($alt !== '' ? '<figcaption>' . e($alt) . '</figcaption>' : '') . '</figure>';
}

/** :::merke, :::beispiel, :::achtung, :::funk — sonst neutraler Kasten. */
function mdBlock(string $art, array $zeilen, string $bildBasis): string
{
    $titel = ['merke' => 'Merke', 'beispiel' => 'Beispiel', 'achtung' => 'Achtung', 'funk' => 'Funkverkehr'];
    if (!isset($titel[$art])) {
        $art = 'kasten';
    }
    if ($art === 'funk') {
        $html = '<div class="kasten kasten-funk"><p class="kasten-titel">Funkverkehr</p><dl class="funkspruch">';
        foreach ($zeilen as $zeile) {
            $zeile = trim($zeile);
            if ($zeile === '') {
                continue;
            }
            if (preg_match('/^([^:]{1,40}):\s*(.+)$/', $zeile, $t)) {
                $html .= '<dt>' . e(trim($t[1])) . '</dt><dd>' . mdInline($t[2]) . '</dd>';
            } else {
                $html .= '<dd class="regie"><em>' . mdInline($zeile) . '</em></dd>';
            }
        }

        return $html . '</dl></div>';
    }
    $inhalt = markdownRendern(implode("\n", $zeilen), $bildBasis);

    return '<div class="kasten kasten-' . $art . '">'
        . (isset($titel[$art]) ? '<p class="kasten-titel">' . $titel[$art] . '</p>' : '')
        . $inhalt . '</div>';
}

/** Zwischenüberschriften (H2) einer Lektion für das Inhaltsverzeichnis. */
function markdownUeberschriften(string $text): array
{
    preg_match_all('/^##\s+(.+)$/m', str_replace("\r", '', $text), $treffer);

    return array_map(static fn (string $t): array => ['anker' => mdAnker($t), 'text' => $t], $treffer[1]);
}
