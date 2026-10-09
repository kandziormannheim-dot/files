# Standardvorlagen

Abgeleitet aus der Einladung vom 19.02.2026 und dem Protokoll der Vorstandssitzung vom 26.02.2026. Die Inhalte dieser Sitzung sind **nicht** enthalten, nur Aufbau, Formulierungen und Layout.

Die Vorlagen werden per `prisma/seed.ts` in die Tabelle `Template` übernommen und sind danach in den Einstellungen bearbeitbar (versioniert).

## Engine

**Handlebars** (`handlebars`-Paket). Platzhalter `{{bereich.feld}}`, Schleifen `{{#each}}`, Bedingungen `{{#if}}`.
Beim Speichern einer Vorlage werden unbekannte Platzhalter als Fehler gemeldet (Whitelist: `src/server/templates/placeholders.ts`).

Mail-Vorlagen (`*.mail.hbs`) haben einen Front-Matter-Block mit `betreff:`. Der Rest ist Klartext; HTML-Mail wird daraus automatisch erzeugt.
Dokument-Vorlagen (`*.dokument.hbs`) enthalten nur den Inhalt als HTML. Der Renderer legt Briefbogen und Seitenraster darum (siehe Kommentar in `briefbogen.css`) und druckt über Chromium zu PDF (A4).

## Helfer

| Helfer | Beispiel-Ausgabe |
|---|---|
| `{{datum x}}` | 26.02.2026 |
| `{{datumLang x}}` | Donnerstag, 26. Februar 2026 |
| `{{wochentag x}}` | Donnerstag |
| `{{uhrzeit x}}` | 19:00 |
| `{{uhrzeitKurz x}}` | 19 (bei vollen Stunden), sonst 19:30 |
| `{{monatJahr x}}` | März 2026 |
| `{{fristText aufgabe}}` | Datum der Frist oder der Freitext (z. B. „laufend“) |
| `{{personen liste}}` | „Kelsch, Kandzior“ bzw. Gruppenbezeichnung („Vorstand“, „alle“) |

**Wichtig:** Datum und Uhrzeit kommen überall aus genau einem Feld (`sitzung.beginn`). Betreff, Brieftext und Protokoll können sich dadurch nicht mehr widersprechen.

## Kontext (verfügbare Platzhalter)

```
ov.name               Seckenheim-Friedrichsfeld
ov.nameLang           CDU Seckenheim-Friedrichsfeld
ov.nameAnschrift      CDU OV Seckenheim-Friedrichsfeld
ov.ort                Mannheim
ov.absenderzeile      (nur Referenz; im Briefbogen-Bild bereits enthalten)
ov.appUrl             https://management.cdu-sf.de

absender.name         Martin Kandzior
absender.funktion     Ortsvorsitzender
absender.unterschrift (Bild-URL, optional)

sitzung.art           Vorstandssitzung
sitzung.artGenitiv    Vorstandssitzung   (für „Protokoll der …“)
sitzung.beginn        DateTime
sitzung.ort           Restaurant Weingärtner, Kehler Straße 4, 68239 Mannheim
sitzung.onlineLink    optional
sitzung.eroeffnetUm   DateTime
sitzung.geschlossenUm DateTime
sitzung.unterbrechung Freitext, optional („Wiedereröffnung 18:15 Uhr“)
sitzung.sitzungsleitung Freitext (vorbelegt: Vorsitzender)
sitzung.einladungVom  DateTime
sitzung.einladungsweg „per E-Mail“
sitzung.zusageLink    persönlicher Link (nur in Mails; im Versanddialog als [Zusage-Link], je Empfänger ersetzt)
sitzung.rueckmeldungBis DateTime (Rückmeldefrist)
sitzung.ende          DateTime, optional
ersatztermin.beginn   (Absage mit neuem Termin, optional)
letztesProtokoll.sitzungsdatum  (nur in Titeln der Standard-Tagesordnung)
sitzung.absagegrund   optional

tagesordnung[]        nummer („1“, „1.1“), titel, ebene (0|1), status (OFFEN|BEHANDELT|ABGESETZT|VERTAGT)

protokoll.protokollfuehrung  Name
protokoll.version, protokoll.aenderungshinweis
protokoll.formalia.eroeffnung / wiedereroeffnung / tagesordnung / letztesProtokoll  (Freitext)
protokoll.abschnitte[]       topNummer, topTitel, punkte[] (text, unterpunkte[]), ergebnis? (art: BESCHLUSS|ERGEBNIS, text), notiz, anlagen[] (nummer, name)
protokoll.unterzeichner[]    name, funktion

anwesenheit[]         name, funktion, status (ANWESEND|ANWESEND_DIGITAL|ENTSCHULDIGT|NICHT_ANWESEND)
sitzung.beschlussfaehig, sitzung.quorumAnwesend, sitzung.quorumStimmberechtigt, sitzung.feststellungDurch
sitzung.wiederholungNachBeschlussunfaehigkeit, sitzung.eilbeduerftig, sitzung.eilbeduerftigBegruendung
vorherigeSitzung.beginn
umlaufbeschluesse[]   nummer, betreff, ergebnisText
umlauf.*              betreff, text, begruendung, frist, link, nummer, stimmberechtigt, erforderlich, ja, nein, enthaltung, widerspruch, ohneRueckmeldung, angenommen, ergebnisText, protokoll
beschluesse[]         top, gegenstand, ergebnisText
aufgaben[]            nr, titel, verantwortlich, frist
anlagen[]             nummer, name, top (Anlagen zum Protokoll: Anhänge der TOPs, Sitzungspräsentation; PDF/Bilder werden ans Protokoll-PDF angehängt)

empfaenger.name, empfaenger.anrede (nur Mails an Einzelpersonen)
anmeldung.link, anmeldung.gueltigMinuten   (Anmeldelink)
zugang.link           (Zugang eingerichtet → Login-Seite)
emailAenderung.*      neueAdresse, alteAdresse, link, gueltigStunden (Änderung der eigenen E-Mail-Adresse)
antrag.*              titel, beschreibung, unterstuetzer, erforderlich, link
transkript.*          sitzung, link (Entwurf aus Transkript fertig)
frist.letzterTag, frist.link   (Hinweis Ladungsfrist)
aufgabe.*             titel, frist, ueberfaellig, herkunft, link, von (Aufgaben-Erinnerung, Zuweisung)
aktion.*, schichten[] (Helferaufruf)
auslage.*             nummer, titel, anlass, antragsteller, erstellt, erstattungsart, spende/ueberweisung/bar, kontoinhaber, iban, anschrift, bemerkung, summe, positionen[] (nr, belegdatum, beschreibung, betrag, beleg), freigabeDurch, freigabeAm
inventar.*            stand, filter, anzahl, inventur (Prüfspalte), positionen[] (code, name, kategorie, standort, menge, zustand, verliehenAn, faellig, ausgemustert)
video.*               Videoschnitt (prompt.video): maxSekunden, schnittSekunden (ohne Abschlusstafel)
leihe.*               Leihprotokoll: art („Ausgabe“/„Rückgabe“), rueckgabe (ja/nein), code, gegenstand, kategorie, beschreibung, menge,
                      abholung, uebergebenVon, ausleiher, organisation, email, zubehoer, zustandAusgabe, rueckgabeBis, notiz,
                      rueckgabeAm, zurueckgegebenVon, angenommenVon, zustandRueckgabe, zustandGeaendert, zubehoerVollstaendig („ja“/„nein“/leer),
                      bemerkungRueckgabe, anzahlFotos, erstellt, fotosAusgabe[] / fotosRueckgabe[] (nr, bild = eingebettetes Bild; nur im PDF)
beschluss.*           nummer, gremium, gegenstand, datum, verfahren, top, topTitel, ergebnisText, stimmen, beschlussfaehigkeit, wortlaut, begruendung, ausgestelltAm
eingabe.*             titel, empfaenger, datum, text, begruendung (Antrag aus einem Beschluss an den Kreisverband)
seite.titel, seite.link   (Landing Page)
bestaetigung.*        link, loeschfristTage, datenschutz (Double-Opt-in Newsletter/Presseverteiler)
pm.*                  titel, untertitel, datum, text, link (Pressemitteilung)
pressekontakt, abmeldeLink   (Versand an den Presseverteiler)
```

## Dateien

| Datei | Schlüssel | Verwendung |
|---|---|---|
| `einladung-vorstandssitzung.dokument.hbs` | `einladung.dokument` | PDF-Anhang der Einladung (Briefbogen) |
| `einladung-vorstandssitzung.mail.hbs` | `einladung.mail` | Einladungs-Mail |
| `standard-tagesordnung.json` | `tagesordnung.standard` | Vorbelegung neuer Sitzungen |
| `protokoll.dokument.hbs` | `protokoll.dokument` | Protokoll als PDF (und Struktur für DOCX) |
| `protokoll-versand.mail.hbs` | `protokoll.versand` | Versand zur Kenntnis, Genehmigung in Folgesitzung |
| `protokoll-geschaeftsstelle.mail.hbs` | `protokoll.geschaeftsstelle` | Übersendung der genehmigten Niederschrift an die Kreisgeschäftsstelle (LV § 51 Abs. 3) |
| `umlauf-einleitung.mail.hbs` | `umlauf.einleitung` | Start eines Umlaufbeschlusses (auch Protokollgenehmigung), Statut § 42 Abs. 3 |
| `umlauf-ergebnis.mail.hbs` | `umlauf.ergebnis` | Feststellung und Bekanntgabe des Ergebnisses |
| `einladung-wiederholung.mail.hbs` | `einladung.wiederholung` | Neue Einladung nach Aufhebung wegen Beschlussunfähigkeit, LV § 52 Abs. 3 |
| `erinnerung-zusage.mail.hbs` | `erinnerung.zusage` | an alle ohne Rückmeldung |
| `absage-sitzung.mail.hbs` | `sitzung.absage` | Sitzung abgesagt |
| `aufgaben-erinnerung.mail.hbs` | `aufgabe.erinnerung` | Frist naht / überschritten |
| `helferaufruf.mail.hbs` | `aktion.helferaufruf` | Aktion veröffentlicht |
| `prompt-marketing.md` | `prompt.marketing` | Systemprompt für Social-Media- und Blog-Entwürfe |
| `prompt-bbr-social.md` | `prompt.bbr-social` | Systemprompt für die automatischen Beiträge aus BBR-Kurzfassungen (Ton je Kanal: BBR sachlich, OV politisch) |
| `prompt-protokollentwurf.md` | `prompt.protokoll` | Systemprompt für den Claude-Entwurf aus Transkripten |
| `aufgabe-zugewiesen.mail.hbs` | `aufgabe.zugewiesen` | Neue Aufgabe zugewiesen (an neu Verantwortliche) |
| `antrag-einberufung.mail.hbs` | `antrag.einberufung` | an Admins, sobald fünf Mitglieder einen Antrag auf Einberufung tragen (LV § 31 Abs. 3) |
| `ladungsfrist-hinweis.mail.hbs` | `ladungsfrist.hinweis` | an Admins, wenn die Ladungsfrist naht und die Einladung fehlt |
| `umlauf-frist.mail.hbs` | `umlauf.frist` | an Admins nach Fristablauf eines Umlaufverfahrens |
| `transkript-fertig.mail.hbs` | `transkript.fertig` | Protokollentwurf aus Transkript bereit (an die hochladende Person) |
| `anmeldung.mail.hbs` | `anmeldung.mail` | Anmeldelink (Magic Link) |
| `zugang-einladung.mail.hbs` | `zugang.einladung` | Hinweis an neue Nutzer, dass ein Zugang besteht |
| `email-bestaetigung.mail.hbs` | `email.bestaetigung` | Bestätigungslink an die neue Adresse, wenn jemand seine E-Mail-Adresse ändert |
| `email-geaendert.mail.hbs` | `email.geaendert` | Hinweis an die bisherige Adresse nach erfolgter Änderung |
| `inventar-liste.dokument.hbs` | `inventar.liste` | Inventarliste als PDF (Filter der Übersicht), optional Inventurliste mit Prüfspalte und Unterschriftszeile |
| `prompt-video.md` | `prompt.video` | Regievorgaben für den automatischen Videoschnitt (Claude) |
| `inventar-leihprotokoll.dokument.hbs` | `inventar.leihprotokoll` | Leihprotokoll bei Ausgabe bzw. Rückgabe, mit Unterschriftszeilen und Fotos |
| `inventar-ausgabe.mail.hbs` | `inventar.ausgabe` | Mail mit Ausgabeprotokoll an alle Beteiligten |
| `inventar-rueckgabe.mail.hbs` | `inventar.rueckgabe` | Mail mit Rückgabeprotokoll an alle Beteiligten |
| `auslagen.dokument.hbs` | `auslagen.dokument` | Antrag auf Auslagenerstattung (Positionen, Erstattungsart, Freigabe); Belege werden angehängt |
| `auslagen-versand.mail.hbs` | `auslagen.versand` | Versand des freigegebenen Auslagenantrags an die Kreisgeschäftsstelle |
| `beschluss.dokument.hbs` | `beschluss.dokument` | Beschlussauszug als PDF im Briefbogen |
| `antrag.dokument.hbs` | `antrag.dokument` | Antrag aus einem Beschluss, z. B. an den Kreisverband (PDF) |
| `antrag-versand.mail.hbs` | `antrag.versand` | Begleit-Mail beim Einreichen eines Antrags (Antrag + Beschluss als PDF-Anhang) |
| `landing-bestaetigung.mail.hbs` | `landing.bestaetigung` | Double-Opt-in, wenn auf einer Landing Page der Newsletter angekreuzt wurde |
| `presse-bestaetigung.mail.hbs` | `presse.bestaetigung` | Double-Opt-in für die Registrierung im Presseverteiler |
| `presse-mitteilung.mail.hbs` | `presse.mitteilung` | Pressemitteilung, Einzelversand an den Presseverteiler (mit Abmeldelink) |
| `briefbogen.css` | – | Layout für alle Dokument-Vorlagen |
| `assets/briefbogen.png` | – | Briefbogen als Seitenhintergrund (A4, 1414×2000 px) – in den Einstellungen austauschbar |
| (Unterschrift) | – | nicht im Repo; jeder Unterzeichner lädt sein Unterschriftsbild in der App selbst hoch |
