<?php

declare(strict_types=1);

require __DIR__ . '/_hilfen.php';

$html = markdownRendern("## Titel\n\nAbsatz mit **fett**, _kursiv_ und `code`.\n\n- eins\n- zwei\n    - zwei-a\n- drei\n\n1. erst\n2. dann\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> Zitat\n\n:::merke\nMerksatz.\n:::\n\n:::funk\nSEEADLER: MAYDAY\n(Pause)\n:::\n");

pruefe(str_contains($html, '<h2 id="titel">Titel</h2>'), 'Überschrift mit Anker');
pruefe(str_contains($html, '<strong>fett</strong>'), 'fett');
pruefe(str_contains($html, '<em>kursiv</em>'), 'kursiv');
pruefe(str_contains($html, '<code>code</code>'), 'code');
pruefe(str_contains($html, '<ul><li>eins</li><li>zwei<ul><li>zwei-a</li></ul></li><li>drei</li></ul>'), 'verschachtelte Liste');
pruefe(str_contains($html, '<ol><li>erst</li><li>dann</li></ol>'), 'nummerierte Liste');
pruefe(str_contains($html, '<th>A</th>') && str_contains($html, '<td>2</td>'), 'Tabelle');
pruefe(str_contains($html, '<blockquote><p>Zitat</p></blockquote>'), 'Zitat');
pruefe(str_contains($html, 'kasten-merke') && str_contains($html, '<p>Merksatz.</p>'), 'Merke-Block');
pruefe(str_contains($html, '<dt>SEEADLER</dt><dd>MAYDAY</dd>') && str_contains($html, 'class="regie"'), 'Funk-Block mit Regieanweisung');

$boese = markdownRendern("<script>alert(1)</script>\n\n[klick](javascript:alert(1))\n\n[ok](https://example.org)\n\n![x](../../etc/passwd)\n");
pruefe(!str_contains($boese, '<script>'), 'HTML wird maskiert');
pruefe(!str_contains($boese, 'javascript:'), 'javascript:-Link wird verworfen');
pruefe(str_contains($boese, 'href="https://example.org"'), 'https-Link erlaubt');
pruefe(!str_contains($boese, 'passwd'), 'Pfad mit .. im Bild wird verworfen');

$ueberschriften = markdownUeberschriften("## Erste\ntext\n### nicht\n## Zweite Überschrift");
pruefeGleich(['erste', 'zweite-ueberschrift'], array_column($ueberschriften, 'anker'), 'Überschriften für das Inhaltsverzeichnis');

exit(testErgebnis());
