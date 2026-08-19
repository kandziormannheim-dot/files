# neos24.com — die komplette Ranking-Checkliste

Vorab ein ehrlicher Satz, weil er die Erwartung an alles andere hier setzt:
**Platz 1 kann niemand garantieren**, auch keine Agentur, die es verspricht.
Das Ranking hängt an Wettbewerbern, die man nicht kontrolliert, und an einem
Algorithmus, der sich ändert. Was man kontrollieren kann, ist, ob man
*rankbar* ist — und die Praxis ist, dass die meisten Seiten nicht an fehlenden
Tricks scheitern, sondern an ein bis zwei stillen technischen Blockern und an
Content, der die Suchintention nicht trifft.

Realistisch ist: **Platz 1 für spitze Long-Tail-Suchen in 3–6 Monaten**,
Top-3 für die mittleren Money-Keywords in 9–18 Monaten. Genau darauf ist die
AIVA-Mechanik ausgelegt — viele präzise Seiten statt weniger breiter.

Die Liste ist nach Hebelwirkung sortiert. Stufe 0 ist nicht optional: solange da
etwas rot ist, ist alles darunter wirkungslos.

---

## Stufe 0 — Indexierbarkeit (ohne das ist der Rest egal)

Das sind die Fehler, die Wochen kosten, weil sie lautlos sind: Deploy grün,
Seite im Browser sichtbar, Google indexiert sie trotzdem nie.

- [ ] **Kein `noindex` im HTML.** Weder `robots`, noch `googlebot`, noch
      `bingbot`. Auch nicht `none` (= `noindex, nofollow`) und nicht
      `unavailable_after`.
- [ ] **Kein `X-Robots-Tag: noindex` im HTTP-Header.** Der unsichtbare Zwilling —
      steht nicht im Seitenquelltext, wirkt aber genauso. Klassischer
      Server-Config-Rest nach einem Relaunch.
- [ ] **Kein `Disallow: /` in der `robots.txt`.** Der Standardfehler nach jedem
      Relaunch: Die Staging-`robots.txt` wandert mit auf Produktion.
- [ ] **Kein Basic-Auth / IP-Schutz mehr aktiv.** Googlebot bekommt sonst 401
      oder 403 und sieht buchstäblich nichts.
- [ ] **HTTPS erzwungen**, gültiges Zertifikat, `http://` leitet per 301 auf
      `https://` um.
- [ ] **Eine kanonische Host-Variante.** `www` *oder* ohne `www`, die andere
      301 darauf. Nicht beide erreichbar.
- [ ] **Canonical absolut und selbstreferenziell.** `<link rel="canonical">`
      zeigt auf die volle `https://…`-URL der Seite selbst.
- [ ] **`sitemap.xml` erreichbar, aktuell, nur 200er-URLs**, und in der
      `robots.txt` per `Sitemap:` eingetragen.
- [ ] **Search Console eingerichtet, Property als URL-Prefix**
      (`https://neos24.com/`) — nicht als Domain-Property. Sonst 403 auf die
      URL-Inspection-API (siehe Handover-Review F7).
- [ ] **Bing Webmaster Tools + IndexNow-Key** im Docroot als `/<key>.txt`.
- [ ] **Kein clientseitiges Rendering für den Hauptinhalt.** Wenn der Text erst
      per JavaScript erscheint, ist die Indexierung bestenfalls verzögert.
      Prüfen mit „Seitenquelltext anzeigen" — steht der Text drin?

> **Prüfen lassen statt hoffen:**
> ```bash
> python3 neos24/tools/indexability-audit.py https://neos24.com/
> ```
> Deckt alle Punkte dieser Stufe ab, Exit-Code 1 bei jedem Blocker. Gehört nach
> jedem Relaunch-Deploy einmal ausgeführt — und danach monatlich.

---

## Stufe 1 — Technisches Fundament

- [ ] **Core Web Vitals im grünen Bereich**, gemessen an Felddaten (CrUX), nicht
      nur im Lab: LCP < 2,5 s · INP < 200 ms · CLS < 0,1.
- [ ] **Mobile-First.** Google bewertet ausschließlich die mobile Version.
      Alles, was mobil fehlt, existiert für das Ranking nicht.
- [ ] **Saubere, sprechende URL-Struktur**, flach, Kleinschreibung,
      Bindestriche, keine Parameter-IDs. Einmal festlegen — jede spätere
      Änderung kostet Rankings.
- [ ] **Interne Verlinkung mit beschreibenden Ankertexten.** Der mit Abstand
      unterschätzteste Hebel: Pillar verlinkt seine Spokes, Spokes verlinken
      zurück und quer. Keine verwaisten Seiten.
- [ ] **Bilder:** WebP/AVIF, `width`/`height` gesetzt (gegen CLS), `loading="lazy"`
      unterhalb des Falzes, echte `alt`-Texte.
- [ ] **404 statt Soft-404**, 301 statt 302 bei dauerhaften Umzügen.
- [ ] **Relaunch-Redirect-Map:** jede alte URL → neue URL per 301, 1:1 und
      direkt (keine Ketten). Das ist der Punkt, an dem Relaunches Rankings
      verlieren, und er ist vollständig vermeidbar.

---

## Stufe 2 — Content, der die Suchintention trifft

- [ ] **Eine Seite pro Suchintention, nicht pro Keyword.** Zwei Seiten für
      dasselbe Bedürfnis kannibalisieren sich — beide landen auf Seite 2.
- [ ] **SERP vorher ansehen.** Was rankt aktuell auf Platz 1–3? Ratgeber?
      Produktseite? Vergleichstabelle? Das ist Googles Antwort auf die Frage,
      welches Format es sehen will. Wer ein anderes liefert, verliert.
- [ ] **Genau eine H1**, danach eine logische H2/H3-Hierarchie.
- [ ] **Title ≤ 60–65 Zeichen**, korpusweit eindeutig, Hauptkeyword vorn.
- [ ] **Meta-Description 120–155 Zeichen**, eindeutig, als Klick-Argument
      geschrieben — sie ist kein Rankingfaktor, aber der Klick ist einer.
- [ ] **Substanz statt Wortzahl.** Der `seo_check` blockt unter 400 Wörtern, das
      ist die Untergrenze gegen Thin Content, nicht das Ziel. Ziel ist: die
      Frage vollständiger beantworten als Platz 1.
- [ ] **Keine Duplikate.** Title und Meta korpusweit eindeutig — der Gate prüft
      das gegen die DB, aber Text-Duplikate über mehrere Seiten prüft er nicht.
- [ ] **E-E-A-T:** Autorenbox mit echter Person und Qualifikation, Datum der
      letzten Aktualisierung, Quellenangaben, Impressum, Kontaktweg.
      Für ein Logistik-Geschäft: Referenzen, Zustellgebiete, echte Prozesse.
- [ ] **Aktualität pflegen.** AIVA hat dafür den Refresh-Scout
      (`content_refresh_after_days`, Default 365). Nicht abschalten.

---

## Stufe 3 — Strukturierte Daten

Ranken nicht direkt, gewinnen aber Fläche in der Suchergebnisliste — und Fläche
gewinnt Klicks.

- [ ] **`Organization`** auf der Startseite: Name, Logo, `sameAs`,
      Kontaktdaten.
- [ ] **`BreadcrumbList`** auf jeder Unterseite.
- [ ] **`FAQPage`** dort, wo echte Fragen beantwortet werden — nicht als
      Deko-FAQ, das wird abgestraft.
- [ ] **`Service`** / **`Article`** je nach Seitentyp.
- [ ] Für Logistik zusätzlich prüfenswert: **`LocalBusiness`** (Standorte),
      **`ParcelDelivery`** (Sendungsverfolgung).
- [ ] **Jedes JSON-LD muss parsen** und ein `@type` haben — der `seo_check`
      blockt sonst den Upload. Zusätzlich mit dem Rich-Results-Test von Google
      gegenprüfen.

---

## Stufe 4 — Autorität

Der langsamste und der einzige Teil, den AIVA nicht automatisieren kann.

- [ ] **Google-Unternehmensprofil** vollständig, falls physische Standorte
      existieren.
- [ ] **Branchenverzeichnisse und Fachportale** — bei Logistik/Versand die
      einschlägigen Marktplätze und Vergleichsportale.
- [ ] **Digitales PR statt Linkkauf.** Eigene Daten, ein Marktreport, ein
      Rechner — etwas, das andere freiwillig verlinken. Gekaufte Links sind ein
      kalkulierbares Risiko und kein Fundament.
- [ ] **Konsistente NAP-Daten** (Name, Adresse, Telefon) über alle Einträge.
- [ ] **Bewertungen** aktiv einsammeln.

---

## Stufe 5 — Messen und nachsteuern

- [ ] **Search Console** wöchentlich: Impressionen, Positionen, Abdeckungsfehler.
- [ ] **Indexierungsrate** pro Seiten-Kohorte — genau das misst AIVA und zeigt
      es im Dashboard. Unter 10 % nach 14 Tagen pausiert der Healthcheck das
      Projekt automatisch. Wenn das feuert: nicht die Rate hochdrehen, sondern
      die Ursache suchen.
- [ ] **Rank-Tracking** für die 20–50 wichtigsten Keywords.
- [ ] **Nicht die falsche Zahl feiern.** Deployte Seiten sind kein Ergebnis.
      Indexierte Seiten mit Impressionen sind eins.

---

## Die fünf Fehler, an denen es tatsächlich scheitert

Nach Häufigkeit, nicht nach Dramatik:

1. **`noindex` oder `Disallow: /` vom Staging mit auf Produktion genommen.**
   Kostet regelmäßig 4–8 Wochen, weil niemand danach sucht. Deshalb Stufe 0 und
   deshalb der Patch aus dem Handover-Review (F2).
2. **Relaunch ohne Redirect-Map.** Alle alten Rankings weg, und sie kommen nicht
   von selbst zurück.
3. **Zu schnell zu viele Seiten.** Sieht für Google nach Scaled Content Abuse
   aus. Deshalb hat AIVA die Deploy-Rate mit Ceiling und die Sonntags-Rampe —
   klein anfangen (2–5/Tag), erst hochfahren, wenn die Indexierungsrate stimmt.
4. **Keyword-Kannibalisierung**, weil pro Keyword statt pro Intention geplant
   wurde. Fällt erst nach Monaten auf und ist dann teuer zu entwirren.
5. **Content, der die Frage nicht beantwortet.** Technisch perfekte Seiten, die
   niemand zu Ende liest. Kein Tool der Welt repariert das.
