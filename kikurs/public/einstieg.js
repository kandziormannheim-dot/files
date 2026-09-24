/* KI-ckoff — Kurs 1: KI-Einstieg
   Einführung für Menschen ohne Vorwissen: Was ist KI, was ist ein LLM,
   was kann man damit machen, wie fragt man gut, was ist zu beachten.
   Gleicher Aufbau wie inhalte.js (KI-Werkstatt); IDs beginnen mit „e“,
   damit sie sich nie mit der Werkstatt überschneiden. */
window.EINSTIEG = {
  id: "einstieg",
  titel: "KI-Einstieg",
  kurzname: "Einstieg",
  untertitel: "Was ist KI, und was kann ich damit machen?",
  beschreibung: "Für alle, die neu in der KI-Welt sind: wie KI und Sprachmodelle funktionieren, was sie können und was nicht, wie du gute Fragen stellst und worauf du achten musst.",
  lead: "Kein Vorwissen nötig. In gut vier Stunden verstehst du, was hinter ChatGPT, Claude und Co. steckt, probierst sie selbst aus und weißt, wofür du sie sinnvoll und sicher einsetzt.",
  startKnopf: "Los geht's mit Modul 0",
  heldGrafik: "zwiebel",
  dauerText: "ca. 4,5 Stunden",
  dauerKurz: "4,5 h",
  einheit: "Teil",
  wochen: 2,
  planTitel: "Zwei Teile: verstehen, dann anwenden",
  planText: "Teil 1 erklärt, was KI ist und wie Sprachmodelle arbeiten. Teil 2 zeigt, was du damit machen kannst, wie du gut fragst und was du beachten musst. Du kannst alles an einem Tag schaffen oder auf zwei Wochen verteilen.",
  zertifikatText: "alle sieben Module des KI-Einstiegs mit Übungen und Wissenschecks abgeschlossen hat: Begriffe und Geschichte der KI, Funktionsweise großer Sprachmodelle, Einsatzmöglichkeiten, gutes Fragen, Datenschutz und verantwortungsvoller Umgang.",
  bestehen: 0.7,

  persona: [
    { titel: "Für wen", text: "Für alle, die KI bisher kaum genutzt haben oder endlich verstehen wollen, was dahintersteckt. Egal ob Büro, Vertrieb, Personal, Projekt oder Führung." },
    { titel: "Was du brauchst", text: "Einen Browser und Zugang zu einem KI-Assistenten (Claude, ChatGPT, Gemini oder Copilot). Bei euch sind alle großen Modelle verfügbar." },
    { titel: "Was du danach kannst", text: "KI in eigenen Worten erklären, sie für typische Aufgaben nutzen, gute Fragen stellen, Antworten prüfen und wissen, welche Daten tabu sind." },
    { titel: "Und dann?", text: "Wer mehr will, macht weiter mit der KI-Werkstatt: Assistenten bauen, Abläufe automatisieren, KI im Team einführen." },
  ],

  module: [
    /* ------------------------------------------------------------------ */
    {
      id: "e0", nr: 0, titel: "Willkommen in der KI-Welt", kurztitel: "Willkommen",
      kurz: "Warum KI gerade jeden betrifft, und welche Mythen du getrost vergessen kannst.",
      dauer: "0,5 h", woche: 1, breite: 0.25,
      ziele: [
        "Du weißt, warum KI seit 2022 plötzlich überall ist.",
        "Du kannst drei verbreitete Mythen über KI richtigstellen.",
        "Du hast deine erste Unterhaltung mit einem KI-Assistenten geführt.",
      ],
      lektionen: [
        {
          id: "e0l1", titel: "KI ist nicht neu, aber jetzt ist sie für alle da",
          html: `
<p>Künstliche Intelligenz wird seit fast 70 Jahren erforscht. Lange blieb sie Spezialisten vorbehalten: im Schachcomputer, im Spamfilter, in der Bilderkennung. Ende 2022 änderte sich das. Mit ChatGPT konnte plötzlich jeder in normaler Sprache mit einer KI schreiben. Innerhalb von zwei Monaten nutzten es über 100 Millionen Menschen.</p>
<figure class="grafik" data-grafik="zeitleiste"><figcaption>Die grünen Punkte zeigen die jüngste Welle, die heutige KI-Assistenten möglich gemacht hat.</figcaption></figure>
<p>Heute steckt KI in vielen Programmen, die du ohnehin nutzt: in Office, in Suchmaschinen, im Smartphone. Die Frage ist nicht mehr, <i>ob</i> du KI begegnest, sondern <i>wie gut</i> du mit ihr umgehen kannst.</p>`
        },
        {
          id: "e0l2", titel: "Drei Mythen, die du vergessen kannst",
          html: `
<div class="tabelle-wrap"><table>
<tr><th>Mythos</th><th>Wirklichkeit</th></tr>
<tr><td>„Die KI denkt und fühlt wie ein Mensch.“</td><td>Sie erkennt Muster in riesigen Datenmengen und rechnet Wahrscheinlichkeiten aus. Das wirkt oft menschlich, ist aber etwas ganz anderes. Mehr dazu in Modul 2.</td></tr>
<tr><td>„Was die KI sagt, stimmt.“</td><td>Sie kann sehr überzeugend Falsches sagen. Prüfen bleibt deine Aufgabe.</td></tr>
<tr><td>„KI nimmt uns allen die Arbeit weg.“</td><td>Sie übernimmt vor allem <i>Aufgaben</i>, selten ganze Berufe. Wer sie gut nutzt, gewinnt Zeit für das, was Menschen besser können: urteilen, entscheiden, Beziehungen pflegen.</td></tr>
</table></div>`
        },
        {
          id: "e0l3", titel: "Deine erste Unterhaltung",
          html: `
<p>Öffne einen KI-Assistenten, den ihr nutzen dürft (Claude, ChatGPT, Gemini oder Copilot). Schreib einfach so, wie du mit einem Menschen schreiben würdest:</p>
<pre>Hallo! Ich fange gerade an, mich mit KI zu beschäftigen.
Erklär mir in drei Sätzen, was du bist und was du nicht kannst.</pre>
<p>Dann frag nach, als ob du ein Gespräch führst: „Kannst du das an einem Beispiel aus dem Büroalltag zeigen?“ oder „Was meinst du mit …?“. Genau das ist der Unterschied zu einer Suchmaschine: Du kannst nachfragen, und die KI bezieht sich auf das bisher Gesagte.</p>
<div class="notiz"><span class="eyebrow">Keine Sorge</span><p>Du kannst nichts kaputt machen. Wenn eine Antwort nicht passt, schreib einfach, was dir fehlt, oder starte einen neuen Chat.</p></div>`
        },
      ],
      film: {
        titel: "Erklärfilm: Warum KI jetzt überall ist",
        grafik: "zeitleiste",
        szenen: [
          { schritt: 1, text: "Der Begriff Künstliche Intelligenz ist fast siebzig Jahre alt. 1956 trafen sich Forscher in den USA und gaben dem Gebiet seinen Namen." },
          { schritt: 2, text: "Schon 1966 gab es den ersten Chatbot. ELIZA antwortete nach einfachen Regeln und wirkte trotzdem erstaunlich menschlich." },
          { schritt: 3, text: "1997 schlug der Computer Deep Blue den Schachweltmeister. Das war beeindruckend, aber er konnte nur Schach." },
          { schritt: 4, text: "Ab 2012 lernten Computer mit großen neuronalen Netzen, Bilder zu erkennen. Dieses Lernen aus Beispielen heißt Deep Learning." },
          { schritt: 5, text: "2017 erfanden Forscher den Transformer. Er ist der Bauplan fast aller heutigen Sprachmodelle." },
          { schritt: 6, text: "Ende 2022 kam ChatGPT. Zum ersten Mal konnte jeder in normaler Sprache mit einer KI schreiben." },
          { schritt: 7, text: "Heute erledigen KI-Agenten schon ganze Aufgaben. In diesem Kurs lernst du Schritt für Schritt, was dahintersteckt und wie du KI sinnvoll nutzt." },
        ],
      },
      videos: [
        { titel: "Elements of AI: kostenloser Onlinekurs", quelle: "Universität Helsinki · deutsche Fassung", dauer: "Kurs, Deutsch", url: "https://www.elementsofai.de/", warum: "Einer der bekanntesten Einführungskurse, gut verständlich, ohne Mathematik." },
      ],
      uebung: {
        titel: "Erste Schritte",
        schritte: [
          "Kläre, welches KI-Werkzeug du bei der Arbeit nutzen darfst, und melde dich an.",
          "Führe die Unterhaltung aus Lektion 3 und stelle mindestens drei Nachfragen.",
          "Frag die KI: „Was ist ein verbreiteter Irrtum über dich?“ Vergleiche die Antwort mit den Mythen aus Lektion 2.",
        ],
        ergebnis: "Dein erstes Gespräch mit einer KI und ein Gefühl dafür, wie sie antwortet.",
      },
      quiz: [
        { frage: "Seit wann gibt es den Begriff „Künstliche Intelligenz“?", antworten: ["Seit 2022", "Seit 1956", "Seit 1997"], richtig: 1, erklaerung: "Der Begriff stammt von einer Konferenz im Jahr 1956. Neu ist, dass KI seit 2022 für alle zugänglich ist." },
        { frage: "Was unterscheidet einen KI-Assistenten von einer Suchmaschine?", antworten: ["Er kennt immer die neuesten Nachrichten.", "Du kannst mit ihm ein Gespräch führen und nachfragen.", "Er macht nie Fehler."], richtig: 1, erklaerung: "Ein Assistent bezieht sich auf das bisher Gesagte. Aktuell ist er nicht automatisch, und Fehler macht er auch." },
        { frage: "Was stimmt über KI und Arbeit?", antworten: ["KI übernimmt vor allem einzelne Aufgaben.", "KI ersetzt bald alle Berufe.", "KI ist für die Arbeit nicht zu gebrauchen."], richtig: 0, erklaerung: "Meist verändern sich Aufgaben, nicht ganze Berufe." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "e1", nr: 1, titel: "Was ist Künstliche Intelligenz?", kurztitel: "Was ist KI?",
      kurz: "KI, Maschinelles Lernen, Deep Learning, Generative KI: was die Begriffe bedeuten und wie sie zusammenhängen.",
      dauer: "0,75 h", woche: 1, versatz: 0.25, breite: 0.35,
      ziele: [
        "Du erklärst den Unterschied zwischen festen Regeln und Lernen aus Beispielen.",
        "Du ordnest KI, Maschinelles Lernen, Deep Learning und Generative KI richtig ein.",
        "Du erkennst KI in Anwendungen, die du täglich nutzt.",
      ],
      lektionen: [
        {
          id: "e1l1", titel: "Regeln oder Beispiele: zwei Wege zur „klugen“ Maschine",
          html: `
<p>Stell dir vor, ein Programm soll Spam-Mails erkennen. Es gibt zwei Wege:</p>
<div class="tabelle-wrap"><table>
<tr><th></th><th>Klassisches Programm</th><th>Maschinelles Lernen</th></tr>
<tr><td>Wie?</td><td>Ein Mensch schreibt Regeln: „Wenn ‚Gewinn‘ und ‚sofort‘ im Betreff stehen, dann Spam.“</td><td>Das System bekommt tausende Mails, die als Spam oder kein Spam markiert sind, und findet die Muster selbst.</td></tr>
<tr><td>Stärke</td><td>nachvollziehbar, vorhersehbar</td><td>findet Muster, an die niemand gedacht hat</td></tr>
<tr><td>Schwäche</td><td>versagt bei allem, was die Regeln nicht vorsehen</td><td>braucht viele Beispiele, ist schwer zu durchschauen</td></tr>
</table></div>
<p>Fast alles, was wir heute KI nennen, arbeitet nach dem zweiten Weg: <b>Es lernt aus Beispielen.</b></p>`
        },
        {
          id: "e1l2", titel: "Die KI-Zwiebel: vier Begriffe, ineinander geschachtelt",
          html: `
<figure class="grafik" data-grafik="zwiebel"><figcaption>Jede innere Schicht ist ein Teil der äußeren. ChatGPT ist also Generative KI, Deep Learning, Maschinelles Lernen und KI zugleich.</figcaption></figure>
<ul>
  <li><b>Künstliche Intelligenz</b> ist der Oberbegriff für Maschinen, die Aufgaben lösen, für die Menschen Denken brauchen.</li>
  <li><b>Maschinelles Lernen</b> ist der Teil der KI, der aus Beispielen lernt statt aus festen Regeln.</li>
  <li><b>Deep Learning</b> nutzt dafür sehr große künstliche <b>neuronale Netze</b>, lose inspiriert vom Gehirn: viele einfache Recheneinheiten, die in Schichten verbunden sind.</li>
  <li><b>Generative KI</b> erzeugt etwas Neues: Texte, Bilder, Musik, Code. Die Sprachmodelle hinter ChatGPT und Claude gehören dazu.</li>
</ul>`
        },
        {
          id: "e1l3", titel: "KI in deinem Alltag",
          html: `
<p>Du nutzt KI wahrscheinlich schon jeden Tag, ohne es zu merken:</p>
<ul>
  <li><b>Navigation:</b> Die Stauprognose lernt aus Millionen Fahrten.</li>
  <li><b>Streaming und Onlineshops:</b> Empfehlungen („Das könnte dir auch gefallen“).</li>
  <li><b>Smartphone:</b> Gesichtserkennung zum Entsperren, Fotos sortieren, Diktierfunktion.</li>
  <li><b>E-Mail:</b> Spamfilter, Vorschläge für kurze Antworten.</li>
  <li><b>Übersetzer:</b> DeepL oder Google Translate.</li>
</ul>
<p>Neu an den KI-Assistenten ist, dass du selbst bestimmst, was die KI tun soll, und zwar in ganz normaler Sprache.</p>`
        },
      ],
      film: {
        titel: "Erklärfilm: Die KI-Zwiebel",
        grafik: "zwiebel",
        szenen: [
          { schritt: 1, text: "Künstliche Intelligenz ist der große Oberbegriff. Gemeint sind Maschinen, die Aufgaben lösen, für die wir Menschen normalerweise nachdenken müssen." },
          { schritt: 2, text: "Ein Teil davon ist das Maschinelle Lernen. Hier schreibt niemand Regeln. Das System lernt Muster aus sehr vielen Beispielen." },
          { schritt: 3, text: "Deep Learning ist Maschinelles Lernen mit sehr großen neuronalen Netzen. Das sind viele einfache Recheneinheiten, in Schichten verbunden." },
          { schritt: 4, text: "Ganz innen liegt die Generative KI. Sie erzeugt Neues: Texte, Bilder, Musik. Dazu gehören auch ChatGPT, Claude und Gemini." },
          { schritt: 0, text: "Wenn also jemand von KI spricht, meint er heute meistens diesen innersten Kern: generative KI, die Texte und Bilder erzeugt." },
        ],
      },
      videos: [
        { titel: "KI-Campus: Lernangebote zur KI", quelle: "KI-Campus · Lernplattform", dauer: "Kurse und Videos, Deutsch", url: "https://ki-campus.org/", warum: "Kostenlose deutschsprachige Kurse und Videos von Einsteiger bis Profi." },
      ],
      uebung: {
        titel: "KI-Spurensuche",
        schritte: [
          "Notiere fünf Stellen in deinem Alltag oder Job, an denen dir KI begegnet.",
          "Ordne jede in die KI-Zwiebel ein: Lernt sie aus Beispielen? Erzeugt sie etwas Neues?",
          "Frag einen KI-Assistenten: „Erkläre den Unterschied zwischen Maschinellem Lernen und Generativer KI so, dass ihn ein zwölfjähriges Kind versteht.“",
        ],
        ergebnis: "Eine Liste deiner eigenen KI-Begegnungen, richtig eingeordnet.",
      },
      quiz: [
        { frage: "Was ist das Besondere am Maschinellen Lernen?", antworten: ["Ein Mensch schreibt alle Regeln vor.", "Das System lernt Muster aus vielen Beispielen.", "Es funktioniert ohne Daten."], richtig: 1, erklaerung: "Statt fester Regeln stehen viele Beispiele am Anfang." },
        { frage: "Zu welcher Schicht der KI-Zwiebel gehört ChatGPT am genauesten?", antworten: ["Nur zur äußersten Schicht (KI)", "Zur Generativen KI", "Zu keiner, es ist ein klassisches Programm"], richtig: 1, erklaerung: "ChatGPT erzeugt neue Texte und ist damit Generative KI, und damit auch alles, was außen herum liegt." },
        { frage: "Welches Beispiel ist KI, die du wahrscheinlich schon nutzt?", antworten: ["Der Taschenrechner", "Der Spamfilter im E-Mail-Programm", "Die Uhr am Computer"], richtig: 1, erklaerung: "Moderne Spamfilter lernen aus vielen markierten Mails." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "e2", nr: 2, titel: "Was ist ein LLM?", kurztitel: "Was ist ein LLM?",
      kurz: "Wie große Sprachmodelle entstehen, wie sie Antworten bilden und wo ihre Grenzen liegen.",
      dauer: "0,75 h", woche: 1, versatz: 0.6, breite: 0.4,
      ziele: [
        "Du erklärst in eigenen Worten, was ein großes Sprachmodell (LLM) ist.",
        "Du weißt, wie aus Texten ein hilfreicher Assistent wird.",
        "Du kennst die drei wichtigsten Grenzen: Halluzinationen, Wissensstand, Rechnen.",
      ],
      lektionen: [
        {
          id: "e2l1", titel: "LLM heißt Large Language Model",
          html: `
<p>Ein <b>LLM</b> (Large Language Model, großes Sprachmodell) ist ein KI-Programm, das mit riesigen Mengen Text trainiert wurde. Es ist das „Gehirn“ hinter Chat-Assistenten wie ChatGPT (Modell: GPT), Claude, Gemini oder Copilot.</p>
<p><b>Groß</b> bezieht sich auf zweierlei: auf die Menge der Trainingstexte (ein großer Teil des öffentlichen Internets, dazu Bücher und Artikel) und auf die Zahl der Stellschrauben im Modell, die sogenannten Parameter. Moderne Modelle haben hunderte Milliarden davon.</p>
<figure class="grafik" data-grafik="training"><figcaption>Vom Text zum Assistenten in zwei großen Schritten: Vortraining und Feinschliff.</figcaption></figure>`
        },
        {
          id: "e2l2", titel: "Wie ein LLM antwortet: Wort für Wort",
          html: `
<p>Die Grundidee ist verblüffend einfach: Ein LLM sagt immer das <b>nächste Wortstück</b> voraus. Dann hängt es dieses an und sagt das nächste voraus, und so weiter, bis die Antwort fertig ist.</p>
<figure class="grafik" data-grafik="token"><figcaption>Beispielwerte. Die Wortstücke heißen Tokens.</figcaption></figure>
<p>Weil es beim Training so unglaublich viele Texte gesehen hat, sind diese Vorhersagen oft sehr gut, gut genug, um Fragen zu beantworten, Texte zu schreiben oder Code zu erzeugen. Es schlägt dabei aber <b>nichts nach</b>, sondern erzeugt die plausibelste Fortsetzung.</p>
<div class="notiz"><span class="eyebrow">Bild zum Merken</span><p>Ein LLM ist wie jemand, der unfassbar viel gelesen hat und blitzschnell formulieren kann, aber kein Notizbuch hat, in dem er Fakten nachschlagen könnte.</p></div>`
        },
        {
          id: "e2l3", titel: "Drei Grenzen, die du kennen musst",
          html: `
<ol>
  <li><b>Halluzinationen:</b> Wenn das Modell etwas nicht weiß, erfindet es manchmal etwas, das plausibel klingt: Zahlen, Quellen, Zitate. Es sagt dabei nicht Bescheid.</li>
  <li><b>Wissensstand:</b> Das Training endet an einem Stichtag. Was danach passiert ist, kennt das Modell nur, wenn es eine Websuche nutzt oder du ihm Material gibst.</li>
  <li><b>Rechnen und Zählen:</b> Weil es in Wortstücken denkt, verzählt es sich leicht bei Buchstaben oder langen Rechnungen. Viele Assistenten nutzen dafür inzwischen ein Rechenwerkzeug im Hintergrund.</li>
</ol>
<p>Daraus folgt eine einfache Regel: <b>Nutze KI gern zum Entwerfen, Erklären und Ordnen. Prüfe Fakten, bevor du sie weitergibst.</b></p>`
        },
        {
          id: "e2l4", titel: "Nicht nur Text: Bilder, Sprache, Dateien",
          html: `
<p>Viele aktuelle Modelle sind <b>multimodal</b>: Sie verstehen nicht nur Text, sondern auch Bilder, Fotos, PDFs, Tabellen und gesprochene Sprache. Du kannst also ein Foto von einem Whiteboard hochladen und die KI die Notizen abtippen lassen, oder ein langes PDF und dir die wichtigsten Punkte nennen lassen.</p>
<p>Daneben gibt es spezialisierte Modelle, die Bilder oder Videos <i>erzeugen</i>. Sie funktionieren nach einem ähnlichen Prinzip: Sie haben aus Millionen Beispielen gelernt, wie Bilder zu Beschreibungen passen.</p>`
        },
      ],
      film: {
        titel: "Erklärfilm: Wie ein Sprachmodell entsteht",
        grafik: "training",
        szenen: [
          { schritt: 1, text: "Am Anfang stehen riesige Mengen Text: Bücher, Webseiten, Artikel und Programmcode. Zusammen sind das Billionen Wörter." },
          { schritt: 2, text: "Im Vortraining übt das Modell wochenlang auf tausenden Spezialchips eine einzige Aufgabe: das nächste Wort vorherzusagen." },
          { schritt: 3, text: "Heraus kommt ein Basismodell. Es kann Texte fortsetzen, aber es führt noch kein hilfreiches Gespräch." },
          { schritt: 4, text: "Im Feinschliff bewerten Menschen viele Antworten. Das Modell lernt, hilfreich, ehrlich und sicher zu antworten." },
          { schritt: 5, text: "Erst jetzt ist es ein Assistent, wie du ihn als ChatGPT, Claude oder Gemini kennst." },
          { schritt: 6, text: "Wichtig: Danach ist das Wissen eingefroren. Neues erfährt das Modell nur über eine Websuche oder über Dateien, die du ihm gibst." },
        ],
      },
      videos: [
        { titel: "Large Language Models explained briefly", quelle: "3Blue1Brown", dauer: "8 min, Englisch, Untertitel", url: "https://www.3blue1brown.com/lessons/mini-llm/", warum: "Wunderbar animiert: wie ein Sprachmodell das nächste Wort wählt." },
      ],
      uebung: {
        titel: "Das LLM auf die Probe stellen",
        schritte: [
          "Frag ohne Websuche: „Was ist letzte Woche in meiner Stadt passiert?“ Achte darauf, wie das Modell mit seinem Wissensstand umgeht.",
          "Frag: „Wie viele Buchstaben ‚e‘ hat das Wort ‚Entwicklungsteam‘?“ Zähl selbst nach.",
          "Lade ein Foto oder PDF hoch (etwas Unverfängliches) und lass dir den Inhalt in drei Punkten zusammenfassen.",
        ],
        ergebnis: "Du hast Stärken und Grenzen eines LLM selbst erlebt.",
      },
      quiz: [
        { frage: "Wofür steht LLM?", antworten: ["Large Language Model", "Logical Learning Machine", "Live Language Monitor"], richtig: 0, erklaerung: "Großes Sprachmodell: mit riesigen Textmengen trainiert." },
        { frage: "Was macht ein LLM im Kern?", antworten: ["Es schlägt Antworten in einem Lexikon nach.", "Es sagt Wortstück für Wortstück die wahrscheinlichste Fortsetzung voraus.", "Es kopiert Texte aus dem Internet."], richtig: 1, erklaerung: "Alles andere entsteht aus dieser Vorhersage in riesigem Maßstab." },
        { frage: "Warum kennt ein Modell manche aktuellen Ereignisse nicht?", antworten: ["Weil es absichtlich Nachrichten verschweigt.", "Weil sein Training an einem Stichtag endete.", "Weil es nur Englisch versteht."], richtig: 1, erklaerung: "Ohne Websuche oder eigene Dateien endet sein Wissen am Stichtag." },
        { frage: "Was ist eine Halluzination?", antworten: ["Ein Bild, das die KI erzeugt", "Eine überzeugend klingende, aber erfundene Aussage", "Ein technischer Absturz"], richtig: 1, erklaerung: "Deshalb: Fakten immer prüfen." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "e3", nr: 3, titel: "Was kann man mit KI machen?", kurztitel: "Was geht damit?",
      kurz: "Acht Einsatzfelder mit Beispielen aus Büro, Projekt, Vertrieb, Personal und Alltag.",
      dauer: "1 h", woche: 2, breite: 0.3,
      ziele: [
        "Du kennst acht typische Einsatzfelder von KI-Assistenten.",
        "Du findest mindestens drei Aufgaben aus deinem Alltag, bei denen KI hilft.",
        "Du weißt, wofür KI sich weniger eignet.",
      ],
      lektionen: [
        {
          id: "e3l1", titel: "Acht Einsatzfelder",
          html: `
<figure class="grafik" data-grafik="einsatz"><figcaption>Die ersten sieben kannst du heute schon im Chat ausprobieren. Das achte ist Thema der KI-Werkstatt.</figcaption></figure>
<p>Eine gute Faustregel: KI ist stark, wenn es um <b>Sprache, Struktur und Ideen</b> geht, und wenn du das Ergebnis gut beurteilen kannst. Sie ist schwach bei <b>exakten Fakten ohne Quelle</b>, bei <b>Entscheidungen über Menschen</b> und überall dort, wo ein Fehler teuer wäre und niemand prüft.</p>`
        },
        {
          id: "e3l2", titel: "Beispiele nach Arbeitsbereich",
          html: `
<div class="tabelle-wrap"><table>
<tr><th>Bereich</th><th>Beispiele</th></tr>
<tr><td><b>Büro und Verwaltung</b></td><td>Mails entwerfen, Protokolle zusammenfassen, Vorlagen und Checklisten erstellen, Texte in einfache Sprache übersetzen</td></tr>
<tr><td><b>Projekte und Teams</b></td><td>Workshops vorbereiten, Aufgaben strukturieren, Risiken sammeln, Statusberichte schreiben</td></tr>
<tr><td><b>Vertrieb und Marketing</b></td><td>Angebotstexte, Produktbeschreibungen, Ideen für Kampagnen, Antworten auf häufige Kundenfragen vorformulieren</td></tr>
<tr><td><b>Personal</b></td><td>Stellenanzeigen formulieren, Onboarding-Pläne, Schulungsunterlagen. <i>Nicht:</i> Bewerbungen bewerten lassen (Modul 5)</td></tr>
<tr><td><b>Führung</b></td><td>Gespräche vorbereiten, Gegenargumente durchspielen, komplexe Themen verständlich erklären</td></tr>
<tr><td><b>Alltag</b></td><td>Reiseplanung, Rezepte aus dem, was im Kühlschrank ist, Briefe an Behörden, Lernen für Prüfungen</td></tr>
</table></div>`
        },
        {
          id: "e3l3", titel: "KI als Lernpartner",
          html: `
<p>Eine der unterschätztesten Anwendungen: KI als geduldiger Lehrer, der nie genervt ist.</p>
<ul>
  <li>„Erkläre mir Inflation, als wäre ich 15.“ Danach: „Und jetzt etwas genauer.“</li>
  <li>„Stell mir fünf Quizfragen zu diesem Text und sag mir danach, was ich falsch hatte.“</li>
  <li>„Ich verstehe diesen Absatz aus dem Vertrag nicht. Was bedeutet er in einfachen Worten?“</li>
</ul>
<p>So wird aus der KI ein persönlicher Nachhilfelehrer für jedes Thema. Wichtige Fakten prüfst du trotzdem nach.</p>`
        },
      ],
      film: {
        titel: "Erklärfilm: Acht Dinge, die KI für dich tun kann",
        grafik: "einsatz",
        szenen: [
          { schritt: 1, text: "Erstens: Schreiben. Die KI entwirft Mails, Berichte und Texte und verbessert, was du schon geschrieben hast." },
          { schritt: 2, text: "Zweitens: Zusammenfassen. Aus einem langen Protokoll oder einer Studie werden die wichtigsten Punkte." },
          { schritt: 3, text: "Drittens: Erklären und Lernen. Schwierige Themen werden einfach, und du kannst so oft nachfragen, wie du willst." },
          { schritt: 4, text: "Viertens: Ideen finden. Beim Brainstorming liefert die KI in Sekunden zwanzig Vorschläge, aus denen du die besten auswählst." },
          { schritt: 5, text: "Fünftens: Übersetzen, in viele Sprachen und in den passenden Ton." },
          { schritt: 6, text: "Sechstens: Analysieren. Die KI erkennt Muster in Tabellen oder Umfrageergebnissen." },
          { schritt: 7, text: "Siebtens: Bilder und Audio. Sie liest Fotos, erzeugt Bilder und macht aus Sprache Text." },
          { schritt: 8, text: "Und achtens: Abläufe automatisieren. Wiederkehrende Aufgaben erledigen sich dann von selbst. Das lernst du in der KI-Werkstatt." },
        ],
      },
      videos: [],
      uebung: {
        titel: "Deine KI-Aufgabenliste",
        schritte: [
          "Schreib zehn Aufgaben auf, die du jede Woche erledigst.",
          "Markiere, welche zu den acht Einsatzfeldern passen.",
          "Probiere drei davon heute mit einem KI-Assistenten aus, mit echten, aber unkritischen Inhalten.",
          "Notiere für jede: Wie viel Zeit hat es gespart? Wie gut war das Ergebnis (1–5)?",
        ],
        ergebnis: "Drei erprobte Anwendungen für deinen Alltag.",
      },
      quiz: [
        { frage: "Wobei ist KI besonders stark?", antworten: ["Bei Sprache, Struktur und Ideen", "Bei exakten Fakten ohne Quelle", "Bei Entscheidungen über Menschen"], richtig: 0, erklaerung: "Dort kannst du das Ergebnis auch gut selbst beurteilen." },
        { frage: "Welche Aufgabe solltest du NICHT der KI überlassen?", antworten: ["Eine Stellenanzeige formulieren", "Bewerbungen bewerten und aussortieren", "Ein Onboarding-Programm entwerfen"], richtig: 1, erklaerung: "Entscheidungen über Menschen gehören zu Menschen, auch rechtlich." },
        { frage: "Wie nutzt du KI gut als Lernpartner?", antworten: ["Nur eine einzige Frage stellen", "Erklären lassen, nachfragen, Quizfragen geben lassen", "Alles ungeprüft auswendig lernen"], richtig: 1, erklaerung: "Das Gespräch mit Nachfragen macht den Unterschied." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "e4", nr: 4, titel: "Richtig fragen: deine ersten guten Prompts", kurztitel: "Richtig fragen",
      kurz: "Mit vier einfachen Zutaten bekommst du Antworten, die wirklich passen.",
      dauer: "0,75 h", woche: 2, versatz: 0.3, breite: 0.3,
      ziele: [
        "Du formulierst Anfragen mit Ziel, Hintergrund, Form und Ton.",
        "Du verbesserst eine Antwort im Gespräch, statt neu anzufangen.",
        "Du hast eine persönliche Sammlung mit drei guten Prompts.",
      ],
      lektionen: [
        {
          id: "e4l1", titel: "Vier Zutaten für eine gute Anfrage",
          html: `
<p>Die Anweisung an die KI heißt <b>Prompt</b>. Stell dir vor, du gibst einer neuen, sehr klugen Kollegin eine Aufgabe, die dich und deine Firma noch nicht kennt. Was müsste sie wissen?</p>
<figure class="grafik" data-grafik="fragen"><figcaption>Derselbe Wunsch, zwei Anfragen. Rechts stehen alle vier Zutaten.</figcaption></figure>
<ol>
  <li><b>Ziel:</b> Was soll herauskommen? („eine Einladungsmail“)</li>
  <li><b>Hintergrund:</b> Für wen, worum geht es, welche Fakten gibt es?</li>
  <li><b>Form:</b> Länge, Aufbau, zum Beispiel Stichpunkte oder Tabelle.</li>
  <li><b>Ton:</b> förmlich oder locker, per du oder Sie.</li>
</ol>`
        },
        {
          id: "e4l2", titel: "Im Gespräch verbessern",
          html: `
<p>Die erste Antwort ist ein Entwurf. Statt neu anzufangen, sag einfach, was du anders willst:</p>
<ul>
  <li>„Kürzer, höchstens drei Sätze.“</li>
  <li>„Weniger förmlich, wir duzen uns im Team.“</li>
  <li>„Der zweite Absatz stimmt nicht: Die Veranstaltung ist am Freitag.“</li>
  <li>„Gib mir drei Varianten zur Auswahl.“</li>
</ul>
<p>Zwei Sätze, die fast immer helfen: <b>„Stell mir zuerst Rückfragen, wenn dir etwas fehlt.“</b> und <b>„Wenn du dir bei etwas nicht sicher bist, sag es.“</b></p>`
        },
        {
          id: "e4l3", titel: "Drei Vorlagen zum Mitnehmen",
          html: `
<pre>Fasse den folgenden Text in fünf Stichpunkten zusammen.
Zielgruppe: Kolleginnen und Kollegen ohne Fachwissen.
Am Ende: eine Zeile „Was ich tun muss“.

Text: …</pre>
<pre>Hilf mir, eine schwierige Mail zu beantworten.
Situation: …
Mein Ziel: freundlich bleiben, aber klar Nein sagen.
Schreib zwei Varianten: eine kurze, eine ausführliche.</pre>
<pre>Erkläre mir [Thema] in einfachen Worten mit einem Beispiel
aus dem Arbeitsalltag. Stell mir danach drei Fragen,
mit denen ich prüfen kann, ob ich es verstanden habe.</pre>
<p>Mehr Vorlagen findest du in der <a href="#prompts">Prompt-Bibliothek</a>, einen Baukasten für eigene Prompts im <a href="#baukasten">Prompt-Baukasten</a>.</p>`
        },
      ],
      film: {
        titel: "Erklärfilm: Gut gefragt ist halb gewonnen",
        grafik: "fragen",
        szenen: [
          { schritt: 1, text: "Links eine typische erste Anfrage: Schreib was über unser Sommerfest. Die KI weiß nicht, für wen, wann, wie lang und in welchem Ton. Das Ergebnis ist allgemein und austauschbar." },
          { schritt: 2, text: "Rechts dieselbe Bitte mit vier Zutaten: dem Ziel, dem Hintergrund mit allen Fakten, der Form und dem Ton." },
          { schritt: 2, text: "Und ein Zusatz, der fast immer hilft: Stell mir Rückfragen, falls etwas fehlt." },
          { schritt: 0, text: "Passt die Antwort noch nicht ganz, fang nicht neu an. Sag einfach, was anders sein soll: kürzer, lockerer, mit einem Beispiel." },
        ],
      },
      videos: [
        { titel: "AI Fluency: Framework & Foundations", quelle: "Anthropic Academy · kostenlos", dauer: "ca. 1 h, Englisch", url: "https://anthropic.skilljar.com/", warum: "Vertieft, wie man gut mit KI zusammenarbeitet: beschreiben, delegieren, prüfen." },
      ],
      uebung: {
        titel: "Vorher und nachher",
        schritte: [
          "Nimm eine echte, unkritische Aufgabe aus deinem Alltag und frag die KI zuerst in einem Satz.",
          "Frag dann in einem neuen Chat mit allen vier Zutaten.",
          "Verbessere die bessere Antwort mit zwei Nachrichten im Gespräch.",
          "Speichere den guten Prompt in einer Notiz als Vorlage für dich.",
        ],
        ergebnis: "Drei eigene Prompt-Vorlagen, die du wiederverwenden kannst.",
      },
      quiz: [
        { frage: "Welche vier Zutaten machen eine gute Anfrage aus?", antworten: ["Ziel, Hintergrund, Form, Ton", "Höflichkeit, Länge, Ausrufezeichen, Emojis", "Name, Datum, Uhrzeit, Ort"], richtig: 0, erklaerung: "Damit weiß die KI, was, für wen, wie und in welchem Stil." },
        { frage: "Die Antwort ist zu lang. Was tust du?", antworten: ["Einen neuen Chat anfangen und alles neu schreiben", "Im Gespräch schreiben: „Kürzer, höchstens drei Sätze“", "Aufgeben"], richtig: 1, erklaerung: "Nachschärfen im Gespräch geht schneller und klappt meist sofort." },
        { frage: "Welcher Satz verbessert viele Anfragen?", antworten: ["„Mach schnell.“", "„Stell mir zuerst Rückfragen, wenn dir etwas fehlt.“", "„Du bist der beste Computer der Welt.“"], richtig: 1, erklaerung: "So holt sich die KI den Kontext, der ihr fehlt." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "e5", nr: 5, titel: "Sicher und verantwortungsvoll", kurztitel: "Sicher nutzen",
      kurz: "Welche Daten tabu sind, wie du Antworten prüfst und woran du Fälschungen erkennst.",
      dauer: "0,5 h", woche: 2, versatz: 0.6, breite: 0.2,
      ziele: [
        "Du stufst Daten mit der Datenampel ein, bevor du sie der KI gibst.",
        "Du prüfst wichtige Aussagen, bevor du sie weitergibst.",
        "Du kennst Anzeichen für KI-Fälschungen (Deepfakes).",
      ],
      lektionen: [
        {
          id: "e5l1", titel: "Die Datenampel",
          html: `
<figure class="grafik" data-grafik="ampel"><figcaption>Im Zweifel eine Stufe strenger. Die Regeln deines Arbeitgebers gehen immer vor.</figcaption></figure>
<p>Merksatz: <b>Was du nicht auf eine Postkarte schreiben würdest, gehört nicht in ein privates KI-Konto.</b> Für Arbeitsdaten nutzt du nur das Werkzeug, das dein Unternehmen freigegeben hat. Namen kannst du oft einfach weglassen oder ersetzen („Person A“).</p>`
        },
        {
          id: "e5l2", titel: "Prüfen, bevor du teilst",
          html: `
<ul>
  <li><b>Fakten, Zahlen, Quellen:</b> immer gegenprüfen, zum Beispiel über eine seriöse Webseite.</li>
  <li><b>Nach Quellen fragen:</b> „Woher weißt du das? Nenne die Quelle.“ Dann die Quelle wirklich öffnen, denn auch Quellen können erfunden sein.</li>
  <li><b>Du bist verantwortlich:</b> Was du mit KI-Hilfe verschickst, verantwortest du, als hättest du es selbst geschrieben.</li>
  <li><b>Offen damit umgehen:</b> Sag Bescheid, wenn ein Text mit KI-Hilfe entstanden ist, besonders wenn es anderen wichtig sein könnte.</li>
</ul>`
        },
        {
          id: "e5l3", titel: "Deepfakes und KI-Betrug erkennen",
          html: `
<p>Mit KI lassen sich täuschend echte Bilder, Stimmen und Videos erzeugen. Betrüger nutzen das, zum Beispiel für gefälschte Anrufe „vom Chef“ oder Fotos, die nie aufgenommen wurden.</p>
<ul>
  <li><b>Misstrauisch werden bei Druck:</b> „Sofort überweisen, niemandem sagen“ ist ein Warnsignal, egal wie echt die Stimme klingt.</li>
  <li><b>Rückkanal nutzen:</b> Bei ungewöhnlichen Bitten über eine bekannte Nummer zurückrufen.</li>
  <li><b>Bilder prüfen:</b> seltsame Hände, verzerrte Schrift, unlogische Schatten. Eine Bildersuche zeigt oft den Ursprung.</li>
</ul>
<div class="achtung"><strong>EU AI Act</strong><p>Die KI-Verordnung der EU verlangt unter anderem, dass KI-erzeugte Inhalte in vielen Fällen gekennzeichnet werden, und dass Beschäftigte, die mit KI arbeiten, ausreichend geschult sind. Dieser Kurs ist ein Baustein dafür.</p></div>`
        },
      ],
      film: {
        titel: "Erklärfilm: Die Datenampel",
        grafik: "ampel",
        szenen: [
          { schritt: 1, text: "Grün sind öffentliche Informationen, zum Beispiel Fachartikel oder deine eigenen Notizen ohne Namen. Die darfst du in jedes seriöse KI-Werkzeug geben." },
          { schritt: 2, text: "Gelb sind interne Informationen deiner Firma. Die gehören nur in das KI-Werkzeug, das dein Arbeitgeber freigegeben hat." },
          { schritt: 3, text: "Rot sind persönliche und vertrauliche Daten, etwa Namen mit Bewertungen, Gesundheitsdaten oder Kundendaten. Hier brauchst du eine ausdrückliche Freigabe, oder du lässt es ganz." },
          { schritt: 0, text: "Im Zweifel stufst du eine Stufe strenger ein. Und oft reicht es, Namen einfach wegzulassen." },
        ],
      },
      videos: [],
      uebung: {
        titel: "Sicherheitscheck",
        schritte: [
          "Finde heraus, welche KI-Werkzeuge bei dir freigegeben sind und ob es eine KI-Richtlinie gibt.",
          "Stufe die drei Aufgaben aus Modul 3 nach der Datenampel ein.",
          "Lass dir von der KI eine Aussage mit Quelle geben und prüfe, ob die Quelle existiert und das wirklich sagt.",
        ],
        ergebnis: "Du weißt, was du wo eingeben darfst, und hast das Prüfen geübt.",
      },
      quiz: [
        { frage: "Eine Liste mit Namen und Krankheitstagen von Kollegen gehört …", antworten: ["in jedes KI-Werkzeug", "in die rote Zone: nur mit Freigabe oder gar nicht", "in ein privates KI-Konto"], richtig: 1, erklaerung: "Persönliche und besonders sensible Daten sind rot." },
        { frage: "Die KI nennt eine Studie als Quelle. Was tust du?", antworten: ["Sofort weitergeben", "Die Studie suchen und prüfen, ob es sie gibt und was drinsteht", "Die KI fragen, ob sie sich sicher ist, und dann weitergeben"], richtig: 1, erklaerung: "Auch Quellen können erfunden sein." },
        { frage: "Die Stimme deiner Chefin am Telefon verlangt eine eilige Überweisung. Was ist klug?", antworten: ["Sofort überweisen", "Über eine bekannte Nummer zurückrufen und nachfragen", "Die KI fragen"], richtig: 1, erklaerung: "Stimmen lassen sich mit KI fälschen. Der Rückkanal schützt dich." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "e6", nr: 6, titel: "Wie geht es weiter?", kurztitel: "Wie weiter?",
      kurz: "Vom Chat zum eigenen Assistenten, zu Automatisierung und Agenten, und dein persönlicher nächster Schritt.",
      dauer: "0,25 h", woche: 2, versatz: 0.8, breite: 0.2,
      ziele: [
        "Du kennst die Stufen vom Chatbot bis zum KI-Agenten.",
        "Du hast dir einen konkreten nächsten Schritt vorgenommen.",
      ],
      lektionen: [
        {
          id: "e6l1", titel: "Die vier Stufen der KI-Nutzung",
          html: `
<figure class="grafik" data-grafik="leiter"><figcaption>Nach diesem Kurs stehst du sicher auf Stufe 1. Die Modulhinweise beziehen sich auf die KI-Werkstatt.</figcaption></figure>
<ul>
  <li><b>Chatbot:</b> fragen und antworten, das kannst du jetzt.</li>
  <li><b>Assistent:</b> ein eingerichteter Arbeitsbereich mit festen Anweisungen und eigenen Dokumenten, sodass du dich nicht wiederholen musst.</li>
  <li><b>Workflow:</b> Abläufe, die von selbst starten, etwa wenn ein Formular eingeht, mit KI als einem Schritt darin.</li>
  <li><b>Agent:</b> Die KI bekommt ein Ziel und Werkzeuge und plant die Schritte selbst.</li>
</ul>`
        },
        {
          id: "e6l2", titel: "Dein nächster Schritt",
          html: `
<p>Wissen bleibt hängen, wenn du es anwendest. Such dir einen der Wege aus:</p>
<ol>
  <li><b>Jeden Tag eine Aufgabe:</b> Probiere zwei Wochen lang täglich eine Aufgabe mit KI aus und notiere, was funktioniert.</li>
  <li><b>Mit anderen teilen:</b> Zeig einer Kollegin oder einem Kollegen deinen besten Prompt.</li>
  <li><b>Weiterlernen:</b> In der <a href="#werkstatt">KI-Werkstatt</a> baust du eigene Assistenten, automatisierst Abläufe mit n8n und lernst, KI im Team einzuführen.</li>
</ol>
<div class="notiz"><span class="eyebrow">Glückwunsch</span><p>Wenn du alle Module abgehakt und die Wissenschecks bestanden hast, wartet deine <a href="#einstieg-zertifikat">Teilnahmebestätigung</a>.</p></div>`
        },
      ],
      film: {
        titel: "Erklärfilm: Deine nächsten Stufen",
        grafik: "leiter",
        szenen: [
          { schritt: 1, text: "Geschafft! Du kannst jetzt sicher mit einem KI-Chatbot arbeiten: gut fragen, nachschärfen und Antworten prüfen." },
          { schritt: 2, text: "Die nächste Stufe ist ein eigener Assistent. Er kennt deine Anweisungen und Dokumente, und du musst dich nicht wiederholen." },
          { schritt: 3, text: "Danach kommen Workflows: Abläufe, die von selbst starten und KI als einen Schritt nutzen." },
          { schritt: 4, text: "Ganz oben stehen Agenten, die ein Ziel selbstständig verfolgen." },
          { schritt: 0, text: "Wie das geht, lernst du in der KI-Werkstatt. Bis dahin: Probier jeden Tag eine Aufgabe mit KI aus." },
        ],
      },
      videos: [],
      uebung: {
        titel: "Mein KI-Vorsatz",
        schritte: [
          "Schreib einen Satz: „In den nächsten zwei Wochen nutze ich KI für …“",
          "Trag dir einen Termin in zwei Wochen ein, um zu prüfen, wie es gelaufen ist.",
          "Entscheide, ob du mit der KI-Werkstatt weitermachst.",
        ],
        ergebnis: "Ein konkreter Plan, wie du KI in deinen Alltag bringst.",
      },
      quiz: [
        { frage: "Was ist ein KI-Agent?", antworten: ["Ein Chatbot, der nur Fragen beantwortet", "Eine KI, die ein Ziel bekommt und die Schritte mit Werkzeugen selbst plant", "Ein Mitarbeiter der KI-Firma"], richtig: 1, erklaerung: "Agenten handeln selbstständig, deshalb brauchen sie gute Leitplanken." },
        { frage: "Was hilft am meisten, damit das Gelernte bleibt?", antworten: ["Den Kurs noch einmal lesen", "Regelmäßig echte Aufgaben mit KI ausprobieren", "Abwarten, bis KI noch besser wird"], richtig: 1, erklaerung: "Anwenden schlägt Wiederholen." },
      ],
    },
  ],

  glossar: [
    ["Künstliche Intelligenz (KI)", "Oberbegriff für Maschinen, die Aufgaben lösen, für die Menschen Denken brauchen."],
    ["Maschinelles Lernen", "Teil der KI, der Muster aus vielen Beispielen lernt, statt festen Regeln zu folgen."],
    ["Deep Learning", "Maschinelles Lernen mit sehr großen künstlichen neuronalen Netzen."],
    ["Neuronales Netz", "Rechenmodell aus vielen einfachen, in Schichten verbundenen Einheiten, lose vom Gehirn inspiriert."],
    ["Generative KI", "KI, die neue Inhalte erzeugt: Texte, Bilder, Musik, Code."],
    ["Chatbot", "Programm, mit dem man sich in normaler Sprache unterhalten kann."],
    ["Parameter", "Die Stellschrauben eines Modells, die beim Training eingestellt werden. Große Modelle haben Milliarden davon."],
    ["Training", "Der Vorgang, in dem ein Modell aus Beispielen lernt."],
    ["Stichtag (Wissensstand)", "Zeitpunkt, bis zu dem die Trainingsdaten eines Modells reichen."],
    ["Deepfake", "Mit KI gefälschtes Bild, Video oder gefälschte Stimme, die echt wirken."],
    ["Transformer", "Bauplan neuronaler Netze von 2017, auf dem fast alle heutigen Sprachmodelle beruhen."],
  ],
};
