# Quellmaterial: Rechtstexte

Diese beiden Dateien sind **unverändertes Zulieferungsmaterial** von Martin Kandzior, abgelegt am 16.08.2026. Sie sind **nicht** die Fassung, die auf der Seite erscheint — Aufgabe P1 erzeugt daraus die angepassten Fassungen unter `site/src/content/legal/`.

Der Grund für die Trennung: Beide Dokumente beschreiben in Teilen eine **andere Website** als die, die hier gebaut wird.

---

## Was die Dateien beitragen

| Offener Punkt | Geklärt durch |
| --- | --- |
| Ladungsfähige Anschrift (Punkt 5) | Mainzer Landstraße 10, 60325 Frankfurt am Main |
| Kontaktdaten (Punkt 7) | `mail@kandzior.de`, +49 176 10 20 20 30 |
| Hosting (Punkt 6) | **Hetzner Online GmbH**, Server in Deutschland, Auftragsverarbeitungsvertrag besteht |

Das Hosting bei Hetzner ist eine gute Nachricht für das Kontaktformular: Ein serverseitiger Endpunkt in Deutschland ist damit möglich, ohne einen Drittanbieter einzubinden.

---

## Widerspruch 1: Frankfurt gegen Mannheim

Die gesamte Positionierung der Seite lautet „aus Mannheim". Die Biografie nennt Mannheim, die Bildunterschrift zeigt den Wasserturm, der Suchbegriff, unter dem gefunden werden soll, ist „Martin Kandzior Mannheim". Das Impressum nennt eine Anschrift in **Frankfurt am Main**, und die zuständige Aufsichtsbehörde ist entsprechend die hessische.

Ein Geschäftsführer, der in 90 Sekunden prüft, ob jemand ernst zu nehmen ist, klickt durchaus ins Impressum. Findet er dort eine andere Stadt als im Fließtext, entsteht genau die Frage, die die Seite vermeiden soll.

Auflösbar ist das leicht, aber es muss **bewusst** entschieden werden:

- Ist Frankfurt eine Geschäftsadresse und Mannheim der Lebensmittelpunkt, sollte die Biografie beides benennen — etwa „zu Hause in Mannheim, geschäftlich in Frankfurt". Das ist kein Widerspruch mehr, sondern eine Angabe.
- Soll die Seite auf Frankfurt zeigen, müssen Positionierung, Biografie, Bildunterschrift und Meta-Beschreibung angepasst werden.
- Soll sie auf Mannheim zeigen, bleibt alles wie es ist — das Impressum steht dann unkommentiert daneben, was zulässig, aber erklärungsbedürftig ist.

**Entscheidung offen.** Blockiert P1 nicht, sollte aber vor dem Livegang fallen.

---

## Widerspruch 2: Die Datenschutzerklärung beschreibt eine andere Seite

Das ist der schwerwiegendere Punkt. Die vorliegende Erklärung ist eine solide, aber allgemeine Vorlage für eine Website mit einem **völlig anderen technischen Aufbau**:

| Abschnitt | Beschreibt | Auf dieser Seite |
| --- | --- | --- |
| 5. Cookiebot | Cookie-Consent-Banner der Usercentrics A/S | **Nicht vorhanden.** Die Zwei-Klick-Lösung macht ihn entbehrlich |
| 6. Google Analytics | Webanalyse mit IP-Anonymisierung | **Nicht vorhanden.** Ausdrücklich außerhalb des Umfangs (siehe Brief) |
| 7. Eingebettete Inhalte | Facebook, LinkedIn, X, **YouTube, TikTok** | Nur die ersten drei, und ohne Cookiebot |
| 8. Newsletter (Brevo) | Double-Opt-in-Anmeldung | **Nicht vorhanden.** Ausdrücklich außerhalb des Umfangs |
| 4.1 Kontaktformular | Speicherung „in einer Datenbank" | Endpunkt noch offen; eine Datenbank ist nicht vorgesehen |

**Warum das nicht bloß überflüssiger Text ist:** Eine Datenschutzerklärung ist eine Zusicherung darüber, was tatsächlich passiert. Steht dort, Einwilligungen würden über ein Cookiebot-Banner eingeholt, und es existiert keines, ist die Erklärung unzutreffend. Sie verspricht außerdem einen Widerrufsweg („jederzeit über das Cookiebot-Banner"), den es auf dieser Seite nicht gibt — der Nutzer bekäme eine Anleitung ins Leere.

Für die Zwei-Klick-Lösung braucht es stattdessen einen eigenen Abschnitt: Ohne Klick findet **keine** Übertragung statt, mit Klick gilt die Einwilligung für diesen einen Aufruf, und ein Widerruf ist schlicht das Neuladen der Seite. Das ist kürzer und einfacher als der Cookiebot-Absatz — und es stimmt.

**Aufgabe P1** erzeugt daraus die angepasste Fassung: Abschnitte 5, 6 und 8 entfallen, Abschnitt 7 wird auf drei Plattformen und die Zwei-Klick-Mechanik umgeschrieben, Ticket Tailor kommt als eigener Punkt dazu, und der Abschnitt zum Kontaktformular wird an den tatsächlichen Endpunkt angepasst, sobald er feststeht.

---

## Unverändert gültig: die juristische Prüfung bleibt außerhalb des Umfangs

Wie im Brief unter „Out of Scope" festgehalten: Ich liefere Struktur, Anpassung an den tatsächlichen technischen Aufbau und Kennzeichnung offener Stellen. Die inhaltliche Prüfung gehört zu einem Anwalt — insbesondere die Formulierungen zur Verarbeitung der Formulardaten und, falls über Ticket Tailor kostenpflichtige Tickets verkauft werden, die Fragen zu Umsatzsteuer, Widerruf und AGB.
