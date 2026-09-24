/* KI-Werkstatt — Kursinhalte
   Nur Text und Daten, kein Programmcode. Wer Inhalte ändert, fasst kurs.js
   nicht an. Aufbau je Modul: siehe docs/kikurs/README.md.
   In Lektionstexten setzt <figure class="grafik" data-grafik="name"></figure>
   eine Grafik aus grafiken.js ein. */
window.KURS = {
  titel: "KI-Werkstatt",
  untertitel: "Vom Chatbot zur eigenen KI-Lösung",
  wochen: 6,
  bestehen: 0.7,

  persona: [
    { titel: "Für wen", text: "Menschen, die ChatGPT, Claude oder Copilot schon im Chat nutzen und jetzt verstehen wollen, wie man daraus verlässliche Abläufe baut." },
    { titel: "Vorwissen, das trägt", text: "VWL: Wahrscheinlichkeit, Kosten-Nutzen, Anreize. Scrum und Agile Coaching: Experimente, Iteration, Prozesse sichtbar machen. Genau das braucht KI-Arbeit." },
    { titel: "Kein Programmieren nötig", text: "Alles läuft über No-Code-Werkzeuge. Wer später tiefer will, bekommt in Modul 6 einen kurzen Blick unter die Haube." },
    { titel: "Aufwand", text: "Sechs Wochen mit insgesamt rund 29 Stunden, also im Schnitt knapp 5 Stunden pro Woche. Jedes Modul endet mit einer Praxisübung und einem kurzen Wissenscheck." },
  ],

  module: [
    /* ------------------------------------------------------------------ */
    {
      id: "m0", nr: 0, titel: "Kick-off: Vom Chatten zum Bauen", kurztitel: "Kick-off",
      kurz: "Wo du stehst, wie der Kurs läuft und welche Werkzeuge du brauchst.",
      dauer: "1 h", woche: 1, breite: 0.35,
      ziele: [
        "Du kennst die vier Stufen vom Chatbot bis zum Agenten und weißt, wo du gerade stehst.",
        "Du hast deine Werkzeuge eingerichtet und ein Lerntagebuch angelegt.",
        "Du hast drei eigene Aufgaben notiert, die du im Kurs mit KI angehen willst.",
      ],
      lektionen: [
        {
          id: "m0l1", titel: "Die vier Stufen der KI-Nutzung",
          html: `
<p>Die meisten Menschen nutzen KI heute auf Stufe 1: Sie tippen eine Frage in ein Chatfenster und kopieren die Antwort heraus. Das ist nützlich, bleibt aber Handarbeit. Jede Antwort hängt davon ab, wie gut du an diesem Tag fragst, und nichts davon läuft ohne dich.</p>
<figure class="grafik" data-grafik="leiter"><figcaption>Jede Stufe baut auf der vorigen auf. Der Kurs führt dich Schritt für Schritt nach rechts.</figcaption></figure>
<ul>
  <li><b>Chatbot:</b> einzelne Fragen, einzelne Antworten.</li>
  <li><b>Assistent:</b> ein eingerichteter Arbeitsbereich (z. B. Claude-Projekt, Custom GPT, Copilot-Agent) mit festen Anweisungen und eigenem Wissen. Du wiederholst dich nicht mehr.</li>
  <li><b>Workflow:</b> ein Ablauf, der von selbst startet, etwa wenn ein Formular eingeht, und die KI als einen Schritt unter mehreren nutzt.</li>
  <li><b>Agent:</b> Die KI bekommt ein Ziel und Werkzeuge und entscheidet die Schritte selbst. Mächtig, aber nur mit guten Leitplanken sinnvoll.</li>
</ul>
<div class="notiz"><span class="eyebrow">Für Agile Coaches</span><p>Die Stufen entsprechen einem Reifegradmodell. Wie bei agilen Transformationen gilt: Nicht jedes Team muss auf die letzte Stufe. Eine gute Stufe 2 schlägt eine wacklige Stufe 4.</p></div>`
        },
        {
          id: "m0l2", titel: "Werkzeugkiste einrichten",
          html: `
<p>Für den Kurs reichen kostenlose oder günstige Konten. Prüfe vorher, welche Werkzeuge dein Arbeitgeber freigegeben hat, denn für echte Arbeitsdaten gelten dessen Regeln (mehr dazu in Modul 7).</p>
<div class="tabelle-wrap"><table>
<tr><th>Wofür</th><th>Beispiele</th><th>Brauchst du ab</th></tr>
<tr><td>Chat und Assistenten</td><td>Claude, ChatGPT, Microsoft Copilot, Gemini</td><td>Modul 1</td></tr>
<tr><td>Recherche mit Quellen</td><td>NotebookLM, Perplexity, Claude/ChatGPT mit Websuche</td><td>Modul 3</td></tr>
<tr><td>Automatisierung (No-Code)</td><td>n8n, Make, Zapier, Microsoft Power Automate</td><td>Modul 4</td></tr>
<tr><td>Formular als Auslöser</td><td>Google Forms, Microsoft Forms, Tally</td><td>Modul 4</td></tr>
<tr><td>Agenten</td><td>Claude mit Konnektoren, Claude Cowork/Code, ChatGPT Agent, Copilot Studio</td><td>Modul 6</td></tr>
</table></div>
<div class="achtung"><strong>Wichtig</strong><p>Werkzeugnamen und Preise ändern sich alle paar Monate. Lerne die Konzepte, dann kannst du jedes neue Werkzeug schnell einordnen.</p></div>`
        },
        {
          id: "m0l3", titel: "Lerntagebuch und eigene Aufgaben",
          html: `
<p>Lege ein Dokument oder eine Notiz „KI-Lerntagebuch“ an. Nach jedem Modul schreibst du drei Zeilen: <i>Was habe ich ausprobiert? Was hat überrascht? Was nehme ich mit?</i> Das ist deine persönliche Retrospektive.</p>
<p>Notiere außerdem drei Aufgaben aus deinem Arbeitsalltag, die regelmäßig vorkommen und dich nerven oder Zeit fressen. Gute Kandidaten:</p>
<ul>
  <li>Protokolle und Zusammenfassungen (Dailys, Retros, Workshops)</li>
  <li>Dinge sortieren und einordnen (Feedback, Tickets, E-Mails)</li>
  <li>Texte in eine feste Form bringen (User Stories, Berichte, Präsentationen)</li>
  <li>Informationen aus mehreren Quellen zusammentragen (Jira, Confluence, Tabellen)</li>
</ul>
<p>Eine davon wird dein Abschlussprojekt in Modul 9.</p>`
        },
      ],
      videos: [
        { titel: "AI Fluency: Framework & Foundations", quelle: "Anthropic Academy · kostenloser Kurs", dauer: "ca. 1 h, Englisch", url: "https://anthropic.skilljar.com/", warum: "Die 4D-Denkweise (Delegation, Beschreibung, Urteilsvermögen, Sorgfalt) ist ein guter Rahmen für alles, was hier folgt." },
      ],
      uebung: {
        titel: "Standortbestimmung",
        schritte: [
          "Schätze in der Selbsteinschätzung auf der Startseite ein, wo du stehst.",
          "Lege dein Lerntagebuch an und trage die drei Aufgaben aus dem Alltag ein.",
          "Frag deinen Chatbot: „Ich bin Scrum Master. Welche fünf wiederkehrenden Aufgaben in meinem Job eignen sich für KI, und welche ausdrücklich nicht? Begründe kurz.“ Vergleiche die Antwort mit deiner Liste.",
        ],
        ergebnis: "Ein Lerntagebuch mit drei Kandidaten für dein Abschlussprojekt.",
      },
      quiz: [
        { frage: "Was unterscheidet einen Workflow von einem Chatbot?", antworten: ["Ein Workflow nutzt ein besseres Sprachmodell.", "Ein Workflow startet durch einen Auslöser und läuft in festen Schritten ohne dein Zutun ab.", "Ein Workflow braucht immer Programmierkenntnisse."], richtig: 1, erklaerung: "Das Modell kann dasselbe sein. Der Unterschied ist der Ablauf: Auslöser, feste Schritte, keine Handarbeit." },
        { frage: "Warum solltest du Konzepte statt Werkzeugnamen lernen?", antworten: ["Weil Werkzeuge sich schnell ändern, die Konzepte aber gleich bleiben.", "Weil Werkzeuge alle gleich sind.", "Weil Konzepte im Test abgefragt werden."], richtig: 0, erklaerung: "Genau. Wer Auslöser, Kontext und Leitplanken versteht, findet sich in jedem neuen Werkzeug zurecht." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m1", nr: 1, titel: "Wie Sprachmodelle wirklich ticken", kurztitel: "Sprachmodelle",
      kurz: "Tokens, Wahrscheinlichkeiten, Kontextfenster — und warum KI manchmal Dinge erfindet.",
      dauer: "2,5 h", woche: 1, versatz: 0.35, breite: 0.65,
      ziele: [
        "Du kannst in eigenen Worten erklären, wie ein Sprachmodell eine Antwort erzeugt.",
        "Du weißt, was ein Kontextfenster ist und was das für deine Arbeit bedeutet.",
        "Du erkennst Situationen, in denen Halluzinationen wahrscheinlich sind, und weißt, wie du gegensteuerst.",
      ],
      lektionen: [
        {
          id: "m1l1", titel: "Ein Sprachmodell rät das nächste Wort",
          html: `
<p>Ein großes Sprachmodell (LLM) hat beim Training Milliarden Texte gesehen und dabei eine einzige Aufgabe geübt: <b>Welches Wortstück kommt als Nächstes?</b> Diese Wortstücke heißen Tokens. Ein deutsches Wort besteht meist aus ein bis drei Tokens.</p>
<figure class="grafik" data-grafik="token"><figcaption>Beispielwerte zur Veranschaulichung. Ein echtes Modell verteilt die Wahrscheinlichkeit auf zehntausende mögliche Tokens.</figcaption></figure>
<p>Die Antwort entsteht Token für Token. Nach jedem Token schaut das Modell auf alles, was bisher dasteht, und rechnet neu. Dass daraus sinnvolle Texte, Analysen und sogar Code werden, liegt an der schieren Menge an Trainingsdaten und an einem zweiten Trainingsschritt, in dem Menschen gute von schlechten Antworten unterscheiden.</p>
<div class="notiz"><span class="eyebrow">VWL-Brücke</span><p>Denk an eine bedingte Wahrscheinlichkeitsverteilung: P(nächstes Token | bisheriger Text). Die „Temperatur“ steuert, wie oft auch weniger wahrscheinliche Tokens gezogen werden. Niedrig heißt vorhersehbar, hoch heißt kreativ, aber fehleranfälliger.</p></div>`
        },
        {
          id: "m1l2", titel: "Das Kontextfenster: was die KI gerade sieht",
          html: `
<p>Ein Sprachmodell hat kein Gedächtnis im menschlichen Sinn. Es sieht nur, was in seinem <b>Kontextfenster</b> steht: Anweisungen, angehängte Dateien, der bisherige Chat und deine aktuelle Frage. Alles andere kennt es nur aus dem Training, und das ist ungenau und hat einen Stichtag.</p>
<figure class="grafik" data-grafik="kontext"><figcaption>Moderne Modelle fassen hunderte Seiten. Trotzdem gilt: Relevantes nach vorn, Überflüssiges weglassen.</figcaption></figure>
<p>Daraus folgen drei Arbeitsregeln:</p>
<ol>
  <li><b>Gib Kontext mit.</b> Wer ist das Team, was ist das Ziel, welches Material gibt es? Die KI kann nicht in deinen Kopf schauen.</li>
  <li><b>Neuer Chat für neues Thema.</b> Alte Gesprächsteile lenken ab und verbrauchen Platz.</li>
  <li><b>Wiederkehrender Kontext gehört in ein Projekt.</b> Dort liegt er dauerhaft, statt jedes Mal neu eingefügt zu werden (Modul 2).</li>
</ol>`
        },
        {
          id: "m1l3", titel: "Halluzinationen: warum KI überzeugend falsch liegt",
          html: `
<p>Weil das Modell plausible Fortsetzungen erzeugt und nicht in einer Datenbank nachschlägt, kann es Dinge erfinden, die sehr echt klingen: Quellen, Zahlen, Paragrafen, Zitate. Das nennt man Halluzination.</p>
<div class="tabelle-wrap"><table>
<tr><th>Riskant</th><th>Meist zuverlässig</th></tr>
<tr><td>Exakte Zahlen, Daten, Namen, Gesetzesstellen</td><td>Umformulieren, strukturieren, zusammenfassen von Text, den du mitgibst</td></tr>
<tr><td>Nischenwissen und sehr aktuelle Ereignisse</td><td>Ideen sammeln, Gegenargumente finden, Entwürfe schreiben</td></tr>
<tr><td>Lange Rechnungen im Kopf</td><td>Einordnen in Kategorien, die du vorgibst</td></tr>
</table></div>
<p><b>Gegenmittel:</b> Material mitgeben und die KI anweisen, nur daraus zu antworten. Quellen verlangen und stichprobenartig prüfen. „Wenn du es nicht weißt, sag es“ ausdrücklich erlauben. Für Rechnungen ein Werkzeug nutzen lassen (Tabellen oder Code-Ausführung).</p>
<div class="notiz"><span class="eyebrow">Scrum-Brücke</span><p>Behandle KI-Ergebnisse wie ein Inkrement ohne Definition of Done: erst prüfen, dann weitergeben. Die Verantwortung für das Ergebnis bleibt bei dir.</p></div>`
        },
        {
          id: "m1l4", titel: "Modelle, die nachdenken, sehen und hören",
          html: `
<p>Aktuelle Modelle können mehr als Text: Sie lesen Bilder und PDFs, verstehen Screenshots von Boards, transkribieren Audio und erzeugen Diagramme. Viele haben einen <b>Denkmodus</b> (Reasoning), in dem sie vor der Antwort Zwischenschritte durchgehen. Das kostet etwas Zeit, verbessert aber Analysen, Planungen und Rechnungen deutlich.</p>
<ul>
  <li><b>Schneller Modus:</b> Umformulieren, kurze Antworten, Ideen.</li>
  <li><b>Denkmodus:</b> Abwägungen, mehrstufige Analysen, Business Cases, Fehlersuche.</li>
  <li><b>Multimodal:</b> Foto vom Whiteboard hochladen und die KI die Karten abtippen und clustern lassen.</li>
</ul>`
        },
      ],
      film: {
        titel: "Erklärfilm: Wie eine KI-Antwort entsteht",
        grafik: "token",
        szenen: [
          { schritt: 1, text: "Du schreibst einen Satz. Das Sprachmodell zerlegt ihn zuerst in Tokens, also in Wörter und Wortstücke." },
          { schritt: 2, text: "Für jedes denkbare nächste Token berechnet es eine Wahrscheinlichkeit. Hier liegt ‚blockiert‘ vorn, weil der Satz nach einem typischen Daily klingt." },
          { schritt: 3, text: "Ein Token wird gezogen und angehängt. Dann beginnt die Rechnung von vorn, Token für Token, bis die Antwort fertig ist." },
          { schritt: 0, text: "Merke: Die KI schlägt nichts nach. Sie erzeugt die plausibelste Fortsetzung. Deshalb ist guter Kontext so wichtig." },
        ],
      },
      videos: [
        { titel: "Large Language Models explained briefly", quelle: "3Blue1Brown", dauer: "8 min, Englisch, Untertitel", url: "https://www.3blue1brown.com/lessons/mini-llm/", warum: "Die beste kurze Animation zum Prinzip der Wortvorhersage." },
        { titel: "Transformers, the tech behind LLMs", quelle: "3Blue1Brown", dauer: "27 min, Englisch", url: "https://www.3blue1brown.com/lessons/gpt/", warum: "Für alle, die sehen wollen, was im Inneren passiert. Freiwillig." },
        { titel: "Intro to Large Language Models", quelle: "Andrej Karpathy", dauer: "60 min, Englisch", url: "https://www.youtube.com/watch?v=zjkBMFhNj_g", warum: "Vortrag eines Mitgründers von OpenAI, gut verständlich, mit Blick auf Sicherheitsfragen." },
      ],
      uebung: {
        titel: "Halluzinationen provozieren und bändigen",
        schritte: [
          "Frag ohne Material: „Nenne mir drei Studien mit Autor und Jahr, die belegen, dass Retrospektiven die Teamleistung steigern.“ Prüfe eine der Quellen per Suche.",
          "Neuer Chat. Füge einen echten Text ein (z. B. den Scrum Guide oder einen eigenen Artikel) und frag: „Beantworte nur aus diesem Text. Wenn die Antwort nicht drinsteht, sag das.“",
          "Vergleiche beide Antworten und notiere im Lerntagebuch, woran du die erfundene erkennen konntest.",
        ],
        ergebnis: "Ein Gefühl dafür, wann du der KI trauen kannst und wann du prüfen musst.",
      },
      quiz: [
        { frage: "Was macht ein Sprachmodell im Kern?", antworten: ["Es sucht die Antwort in einer großen Datenbank.", "Es berechnet Token für Token die wahrscheinlichste Fortsetzung eines Textes.", "Es versteht Bedeutung genau wie ein Mensch."], richtig: 1, erklaerung: "Alles andere, auch das scheinbare Verstehen, entsteht aus dieser Vorhersage in sehr großem Maßstab." },
        { frage: "Du willst, dass die KI eine Zusammenfassung deines Sprint Reviews schreibt. Was ist am wichtigsten?", antworten: ["Ein möglichst kurzer Prompt.", "Die Notizen des Reviews mitgeben.", "Die Temperatur hochdrehen."], richtig: 1, erklaerung: "Was nicht im Kontextfenster steht, kann das Modell nur raten." },
        { frage: "Wobei ist die Gefahr von Halluzinationen besonders hoch?", antworten: ["Beim Umformulieren eines mitgegebenen Textes.", "Bei exakten Quellenangaben ohne mitgegebenes Material.", "Beim Sortieren von Notizen in vorgegebene Kategorien."], richtig: 1, erklaerung: "Quellen, Zahlen und Paragrafen aus dem Gedächtnis sind der klassische Fall." },
        { frage: "Wofür lohnt sich der Denkmodus?", antworten: ["Für mehrstufige Analysen wie einen Business Case.", "Für eine schnelle Umformulierung.", "Er lohnt sich nie."], richtig: 0, erklaerung: "Zwischenschritte helfen bei allem, was Abwägen oder Rechnen verlangt." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m2", nr: 2, titel: "Vom Prompt zum Kontext", kurztitel: "Prompting & Kontext",
      kurz: "Prompts, die zuverlässig funktionieren, und Assistenten, die dein Wissen dauerhaft kennen.",
      dauer: "3 h", woche: 2, breite: 0.6,
      ziele: [
        "Du schreibst Prompts mit den sechs Bausteinen und bekommst reproduzierbare Ergebnisse.",
        "Du verlangst Ausgaben in festen Formaten, die sich weiterverarbeiten lassen.",
        "Du richtest einen eigenen Assistenten (Projekt / Custom GPT) für eine wiederkehrende Aufgabe ein.",
      ],
      lektionen: [
        {
          id: "m2l1", titel: "Die sechs Bausteine eines guten Prompts",
          html: `
<p>Ein guter Prompt ist ein gutes Briefing. Stell dir vor, du gibst die Aufgabe an eine kluge neue Kollegin, die dein Team nicht kennt. Was müsste sie wissen?</p>
<figure class="grafik" data-grafik="prompt"><figcaption>Nicht jeder Prompt braucht alle sechs. Ziel und Kontext fehlen aber am häufigsten.</figcaption></figure>
<ul>
  <li><b>Rolle:</b> aus welcher Perspektive die KI arbeitet. Hilft beim Ton und bei der Fachtiefe.</li>
  <li><b>Ziel:</b> was am Ende herauskommen soll und wofür.</li>
  <li><b>Kontext:</b> Hintergrund, Material, Zielgruppe.</li>
  <li><b>Format:</b> Tabelle, Stichpunkte, Länge, Sprache.</li>
  <li><b>Beispiele:</b> ein oder zwei Muster für gute Ergebnisse. Das wirkt oft stärker als jede Beschreibung.</li>
  <li><b>Grenzen:</b> was nicht passieren darf und wann die KI nachfragen soll.</li>
</ul>
<p>Im <a href="#baukasten">Prompt-Baukasten</a> kannst du die Bausteine ausfüllen und den fertigen Prompt kopieren.</p>`
        },
        {
          id: "m2l2", titel: "Iterieren wie in einem Sprint",
          html: `
<p>Der erste Prompt ist selten der beste. Profis arbeiten in kurzen Schleifen:</p>
<ol>
  <li><b>Entwurf:</b> Prompt schreiben, Ergebnis ansehen.</li>
  <li><b>Diagnose:</b> Was fehlt? Zu lang, falscher Ton, Fakten erfunden, Format falsch?</li>
  <li><b>Anpassen:</b> genau einen Baustein ändern und neu testen.</li>
  <li><b>Festhalten:</b> Wenn es passt, den Prompt in deine Bibliothek übernehmen.</li>
</ol>
<p>Zwei Tricks helfen besonders: Lass die KI <b>zuerst Rückfragen stellen</b> („Stell mir bis zu fünf Fragen, bevor du loslegst“). Und lass sie <b>den eigenen Prompt verbessern</b> („Wie müsste ich diesen Prompt formulieren, damit du das Ergebnis beim ersten Mal triffst?“).</p>
<div class="notiz"><span class="eyebrow">Agile-Brücke</span><p>Das ist Inspect &amp; Adapt im Kleinen. Eine Änderung pro Durchlauf, damit du weißt, was gewirkt hat. Genau wie bei Team-Experimenten.</p></div>`
        },
        {
          id: "m2l3", titel: "Strukturierte Ausgaben: die Brücke zur Automatisierung",
          html: `
<p>Sobald eine Maschine die Antwort weiterverarbeiten soll, braucht sie eine feste Form. Das wichtigste Format dafür ist <b>JSON</b>: Felder mit Namen und Werten.</p>
<pre>Ordne das folgende Feedback ein. Antworte ausschließlich mit JSON
in genau diesem Format, ohne weiteren Text:
{"kategorie": "Bug" | "Idee" | "Lob" | "Frage",
 "dringlichkeit": 1-3,
 "zusammenfassung": "max. 15 Wörter"}

Feedback: "Seit dem letzten Release stürzt der Export bei großen Dateien ab."</pre>
<p>Antwort der KI:</p>
<pre>{"kategorie": "Bug", "dringlichkeit": 3,
 "zusammenfassung": "Export stürzt seit letztem Release bei großen Dateien ab"}</pre>
<p>Diese Antwort kann ein Workflow direkt verwenden: bei „Bug“ ein Ticket anlegen, bei Dringlichkeit 3 jemanden benachrichtigen. Das üben wir in Modul 5.</p>`
        },
        {
          id: "m2l4", titel: "Eigene Assistenten: Projekte, GPTs, Copilot-Agenten",
          html: `
<p>Wenn du denselben Kontext immer wieder einfügst, bau dir einen Assistenten. Je nach Werkzeug heißt das <b>Projekt</b> (Claude, ChatGPT), <b>Custom GPT</b>, <b>Gem</b> (Gemini) oder <b>Agent</b> (Microsoft Copilot). Das Prinzip ist immer gleich:</p>
<ul>
  <li><b>Anweisungen:</b> Rolle, Ton, Format, Grenzen. Einmal geschrieben, gilt für jeden Chat.</li>
  <li><b>Wissen:</b> Dateien wie Team-Arbeitsvereinbarung, Definition of Done, Produktvision, Glossar.</li>
  <li><b>Teilen:</b> Viele Werkzeuge erlauben, den Assistenten mit dem Team zu teilen.</li>
</ul>
<p>Beispiele für dich: ein <i>Retro-Assistent</i>, der Notizen clustert und Formate vorschlägt; ein <i>Story-Coach</i>, der User Stories gegen INVEST prüft; ein <i>Stakeholder-Übersetzer</i>, der Sprint-Ergebnisse in Management-Sprache fasst.</p>`
        },
      ],
      videos: [
        { titel: "Prompting best practices", quelle: "Claude-Dokumentation", dauer: "Lesen, 20 min, Englisch", url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices", warum: "Kompakte Sammlung erprobter Techniken, gilt sinngemäß für alle Modelle." },
      ],
      uebung: {
        titel: "Dein erster eigener Assistent",
        schritte: [
          "Wähle eine wiederkehrende Aufgabe aus deinem Lerntagebuch.",
          "Schreibe im Prompt-Baukasten die Anweisungen mit allen sechs Bausteinen.",
          "Lege ein Projekt (Claude/ChatGPT) oder einen Custom GPT an, füge die Anweisungen und ein bis zwei Wissensdateien ein.",
          "Teste mit drei echten, aber unkritischen Beispielen. Ändere pro Durchlauf nur einen Baustein.",
          "Speichere die beste Fassung in der Prompt-Bibliothek deines Lerntagebuchs.",
        ],
        ergebnis: "Ein Assistent, der eine Aufgabe von dir zuverlässig in gleichbleibender Qualität erledigt.",
      },
      quiz: [
        { frage: "Welcher Baustein fehlt in Prompts am häufigsten?", antworten: ["Die Rolle", "Ziel und Kontext", "Die Höflichkeitsformel"], richtig: 1, erklaerung: "Ohne Ziel und Hintergrund muss die KI raten, was du eigentlich willst." },
        { frage: "Warum ist JSON als Ausgabeformat nützlich?", antworten: ["Es sieht professioneller aus.", "Automatisierungen können einzelne Felder direkt weiterverwenden.", "Es verhindert Halluzinationen vollständig."], richtig: 1, erklaerung: "Feste Felder machen die Antwort maschinenlesbar. Halluzinationen verhindert es nicht." },
        { frage: "Das Ergebnis passt nicht. Wie gehst du vor?", antworten: ["Den ganzen Prompt neu schreiben.", "Einen Baustein ändern und neu testen.", "Ein anderes Modell nehmen."], richtig: 1, erklaerung: "Eine Änderung pro Durchlauf zeigt dir, was wirkt." },
        { frage: "Wann lohnt sich ein eigener Assistent (Projekt / Custom GPT)?", antworten: ["Wenn du denselben Kontext immer wieder brauchst.", "Nur für Programmieraufgaben.", "Nie, ein normaler Chat reicht immer."], richtig: 0, erklaerung: "Wiederkehrender Kontext und feste Anweisungen sind genau sein Zweck." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m3", nr: 3, titel: "Die Werkzeuglandschaft verstehen", kurztitel: "Werkzeuge",
      kurz: "Welches Werkzeug wofür: Modelle, Recherche, Meetings, Automatisierung, Agenten.",
      dauer: "2 h", woche: 2, versatz: 0.6, breite: 0.4,
      ziele: [
        "Du ordnest KI-Werkzeuge nach Einsatzzweck statt nach Marke.",
        "Du kennst Auswahlkriterien und kannst eine begründete Empfehlung geben.",
        "Du hast ein Recherche-Werkzeug mit Quellenangaben ausprobiert.",
      ],
      lektionen: [
        {
          id: "m3l1", titel: "Fünf Werkzeugklassen",
          html: `
<div class="tabelle-wrap"><table>
<tr><th>Klasse</th><th>Wofür</th><th>Beispiele</th></tr>
<tr><td><b>Allzweck-Assistenten</b></td><td>Schreiben, Analysieren, Denken, Projekte</td><td>Claude, ChatGPT, Gemini, Microsoft Copilot</td></tr>
<tr><td><b>Recherche mit Quellen</b></td><td>Antworten aus Web oder eigenen Dokumenten, mit Belegen</td><td>NotebookLM, Perplexity, Deep-Research-Modi</td></tr>
<tr><td><b>KI in bestehender Software</b></td><td>KI direkt dort, wo du arbeitest</td><td>Atlassian Rovo (Jira, Confluence), Copilot in Teams/Outlook, Miro AI</td></tr>
<tr><td><b>Automatisierungsplattformen</b></td><td>Abläufe zwischen Programmen, mit KI-Schritten</td><td>n8n, Make, Zapier, Power Automate</td></tr>
<tr><td><b>Agenten</b></td><td>Ziel vorgeben, KI arbeitet mit Werkzeugen selbstständig</td><td>Claude Cowork/Code, ChatGPT Agent, Copilot Studio</td></tr>
</table></div>
<p>Die Grenzen verschwimmen: Allzweck-Assistenten bekommen Konnektoren und Agentenfunktionen, Automatisierungsplattformen bekommen Agenten-Bausteine. Frag deshalb immer: <i>Was soll erledigt werden?</i> und erst dann: <i>Welches Werkzeug?</i></p>`
        },
        {
          id: "m3l2", titel: "Auswahlkriterien für den Arbeitsalltag",
          html: `
<ol>
  <li><b>Datenschutz und Freigabe:</b> Ist das Werkzeug im Unternehmen erlaubt? Gibt es einen Auftragsverarbeitungsvertrag (AVV)? Werden Eingaben zum Training genutzt?</li>
  <li><b>Integration:</b> Kommt es an deine Daten (Jira, SharePoint, Google Drive)? Ohne Anbindung bleibt es ein Chatfenster.</li>
  <li><b>Qualität für deine Aufgabe:</b> Teste mit echten Beispielen, nicht mit Werbeversprechen.</li>
  <li><b>Kosten:</b> pro Nutzer und Monat, oder nach Verbrauch (Tokens, Ausführungen).</li>
  <li><b>Betrieb:</b> Wer pflegt es, wenn du im Urlaub bist? Wie abhängig machst du dich von einem Anbieter?</li>
</ol>
<div class="notiz"><span class="eyebrow">VWL-Brücke</span><p>Achte auf Lock-in-Effekte und Wechselkosten. Offene Standards wie MCP (Modul 6) und selbst betreibbare Werkzeuge wie n8n senken sie.</p></div>`
        },
        {
          id: "m3l3", titel: "Meetings, Whiteboards, Audio",
          html: `
<p>Für Scrum Master besonders ergiebig: KI rund um Meetings.</p>
<ul>
  <li><b>Transkription und Protokoll:</b> Teams, Zoom und Google Meet bieten KI-Zusammenfassungen. Vorher klären, ob alle Beteiligten einverstanden sind.</li>
  <li><b>Whiteboard auswerten:</b> Foto oder Export eines Miro-/Mural-Boards hochladen, Karten clustern lassen, Muster über mehrere Retros erkennen.</li>
  <li><b>Vorbereitung:</b> Aus Sprint-Daten eine Agenda und passende Retro-Formate vorschlagen lassen.</li>
</ul>
<div class="achtung"><strong>Achtung</strong><p>Aufzeichnungen und Transkripte sind personenbezogene Daten. Ein Retro-Protokoll mit Namen und Stimmungsbildern gehört in die rote Zone der Datenampel (Modul 7).</p></div>`
        },
      ],
      videos: [
        { titel: "NotebookLM: Quellen hochladen, Fragen stellen", quelle: "Google · Hilfeseite", dauer: "Lesen, 10 min", url: "https://support.google.com/notebooklm/", warum: "Einfachster Einstieg in „KI antwortet nur aus meinen Dokumenten“." },
      ],
      uebung: {
        titel: "Werkzeugvergleich mit echter Aufgabe",
        schritte: [
          "Nimm einen öffentlichen Text, z. B. den Scrum Guide als PDF.",
          "Stelle dieselben drei Fragen in einem Allzweck-Assistenten ohne Datei und in NotebookLM (oder einem Projekt) mit Datei.",
          "Bewerte Qualität, Quellenangaben und Aufwand in einer kleinen Tabelle.",
          "Schreibe eine Empfehlung in drei Sätzen, als würdest du sie deinem Team geben.",
        ],
        ergebnis: "Eine begründete Werkzeugempfehlung für eine konkrete Aufgabe.",
      },
      quiz: [
        { frage: "Womit beginnt eine gute Werkzeugwahl?", antworten: ["Mit der Marke, die gerade am bekanntesten ist.", "Mit der Aufgabe, die erledigt werden soll.", "Mit dem günstigsten Preis."], richtig: 1, erklaerung: "Erst der Zweck, dann das Werkzeug." },
        { frage: "Was ist ein Auftragsverarbeitungsvertrag (AVV)?", antworten: ["Ein Vertrag, der regelt, wie ein Anbieter personenbezogene Daten in deinem Auftrag verarbeitet.", "Eine Lizenz für mehr Tokens.", "Eine Garantie gegen Halluzinationen."], richtig: 0, erklaerung: "Ohne AVV dürfen in Unternehmen in der Regel keine personenbezogenen Daten in das Werkzeug." },
        { frage: "Was senkt Abhängigkeit von einem Anbieter?", antworten: ["Offene Standards und austauschbare Bausteine.", "Möglichst viele Funktionen eines Anbieters nutzen.", "Lange Vertragslaufzeiten."], richtig: 0, erklaerung: "Offene Schnittstellen halten die Wechselkosten niedrig." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m4", nr: 4, titel: "Automatisierung ohne Code", kurztitel: "Automatisierung",
      kurz: "Auslöser, Schritte, Daten, Verzweigungen: wie Workflows aufgebaut sind und wie du deinen ersten baust.",
      dauer: "4 h", woche: 3,
      ziele: [
        "Du erklärst die Bausteine eines Workflows: Auslöser, Aktion, Daten, Bedingung, Fehlerbehandlung.",
        "Du analysierst einen Prozess, bevor du ihn automatisierst.",
        "Du baust einen ersten Workflow ohne KI, der wirklich läuft.",
      ],
      lektionen: [
        {
          id: "m4l1", titel: "Die Anatomie eines Workflows",
          html: `
<p>Jede Automatisierung besteht aus denselben Bausteinen, egal ob in n8n, Make, Zapier oder Power Automate:</p>
<figure class="grafik" data-grafik="workflow"><figcaption>Der KI-Schritt ist nur einer unter mehreren. In diesem Modul bauen wir zuerst ohne ihn.</figcaption></figure>
<ul>
  <li><b>Auslöser (Trigger):</b> startet den Ablauf. Neue E-Mail, neues Formular, neues Ticket, feste Uhrzeit.</li>
  <li><b>Aktionen:</b> etwas tun. Zeile in Tabelle schreiben, Nachricht senden, Ticket anlegen.</li>
  <li><b>Daten:</b> jeder Schritt gibt Felder weiter, die der nächste nutzen kann (z. B. „Name“, „Text“, „Datum“).</li>
  <li><b>Bedingungen (Weichen):</b> „Wenn Kategorie = Bug, dann …“.</li>
  <li><b>Fehlerbehandlung:</b> Was passiert, wenn ein Schritt scheitert? Mindestens: Benachrichtigung an dich.</li>
</ul>`
        },
        {
          id: "m4l2", titel: "Erst den Prozess verstehen",
          html: `
<p>Die häufigste Ursache für gescheiterte Automatisierung: Ein schlechter Prozess wird schneller schlecht. Bevor du etwas baust, zeichne den Ablauf auf.</p>
<ol>
  <li><b>Ist-Zustand:</b> Wer macht was, in welcher Reihenfolge, mit welchen Programmen?</li>
  <li><b>Zeiten:</b> Wie lange dauert jeder Schritt, wie lange liegt etwas herum?</li>
  <li><b>Häufigkeit:</b> Wie oft pro Woche kommt es vor?</li>
  <li><b>Regeln:</b> Welche Entscheidungen werden getroffen, nach welchen Kriterien?</li>
  <li><b>Ausnahmen:</b> Was passiert in den 10 % der Fälle, die anders sind?</li>
</ol>
<div class="notiz"><span class="eyebrow">Agile-Brücke</span><p>Das ist eine Value Stream Map. Du kennst sie aus der Arbeit mit Teams. Die Wartezeiten zwischen den Schritten sind oft der größere Hebel als die Schritte selbst.</p></div>
<p><b>Faustregel für gute Kandidaten:</b> häufig, regelbasiert, digital, mit klarem Anfang und Ende.</p>`
        },
        {
          id: "m4l3", titel: "Plattformen im Vergleich",
          html: `
<div class="tabelle-wrap"><table>
<tr><th></th><th>n8n</th><th>Make</th><th>Zapier</th><th>Power Automate</th></tr>
<tr><td>Stärke</td><td>Sehr flexibel, selbst betreibbar, starke KI-Bausteine</td><td>Visuell, gut für komplexe Abläufe</td><td>Am einfachsten, riesige App-Auswahl</td><td>Tief in Microsoft 365 integriert</td></tr>
<tr><td>Datenstandort</td><td>eigener Server möglich (DSGVO-freundlich)</td><td>Cloud, EU-Region wählbar</td><td>Cloud (USA)</td><td>Microsoft-Cloud des Unternehmens</td></tr>
<tr><td>Lernkurve</td><td>mittel</td><td>mittel</td><td>niedrig</td><td>mittel</td></tr>
<tr><td>Gut, wenn …</td><td>du Kontrolle und KI-Tiefe willst</td><td>du viel visuell gestalten willst</td><td>es schnell gehen soll</td><td>deine Firma Microsoft nutzt</td></tr>
</table></div>
<p>Für den Kurs sind die Beispiele so beschrieben, dass sie in allen vier Plattformen funktionieren. Die Begriffe unterscheiden sich leicht (Node, Modul, Zap, Flow), das Prinzip nicht.</p>`
        },
        {
          id: "m4l4", titel: "Dein erster Workflow: Formular → Tabelle → Nachricht",
          html: `
<p>Wir bauen einen Ablauf, den jedes Team brauchen kann: einen <b>Impediment-Melder</b>. Teammitglieder melden Hindernisse über ein Formular, du bekommst eine Nachricht, und alles landet in einer Tabelle.</p>
<ol>
  <li><b>Formular:</b> Felder „Was blockiert dich?“, „Seit wann?“, „Wie stark (1–3)?“.</li>
  <li><b>Auslöser:</b> „Neue Formularantwort“.</li>
  <li><b>Aktion 1:</b> neue Zeile in einer Tabelle (Google Sheets, Excel) mit allen Feldern und Datum.</li>
  <li><b>Bedingung:</b> Wenn Stärke = 3 …</li>
  <li><b>Aktion 2:</b> … Nachricht an dich in Teams/Slack oder per E-Mail.</li>
  <li><b>Testen:</b> drei Testeinträge abschicken, einen davon mit Stärke 3.</li>
</ol>
<div class="achtung"><strong>Typische Stolpersteine</strong><p>Zugangsdaten (Verbindungen) müssen einmal angelegt werden. Felder aus früheren Schritten erscheinen erst, wenn du einmal Testdaten durchgeschickt hast. Workflow am Ende aktivieren, sonst läuft er nur im Testmodus.</p></div>`
        },
      ],
      film: {
        titel: "Erklärfilm: Ein Workflow Schritt für Schritt",
        grafik: "workflow",
        szenen: [
          { schritt: 1, text: "Alles beginnt mit einem Auslöser. Hier: Jemand schickt ein Formular ab. Ab jetzt läuft alles ohne dich." },
          { schritt: 2, text: "Der nächste Schritt bereitet die Daten auf, zum Beispiel Datum ergänzen oder Text säubern." },
          { schritt: 3, text: "Der KI-Schritt ordnet ein oder fasst zusammen. Er liefert feste Felder zurück, zum Beispiel eine Kategorie." },
          { schritt: 4, text: "Die Weiche prüft eine Bedingung. Je nach Kategorie geht es in eine andere Richtung." },
          { schritt: 5, text: "Bei einem Bug entsteht ein Ticket, bei einer Idee eine Nachricht ans Team." },
          { schritt: 6, text: "Ist die KI unsicher, geht der Fall an einen Menschen. So bleibt die Qualität hoch." },
        ],
      },
      videos: [
        { titel: "n8n Beginner Course (9 Teile)", quelle: "n8n · offizielle Playlist", dauer: "ca. 90 min, Englisch", url: "https://www.youtube.com/playlist?list=PLlET0GsrLUL59YbxstZE71WszP3pVnZfI", warum: "Offizieller Einsteigerkurs: Workflows, Daten, Fehlerbehandlung." },
        { titel: "n8n-Videokurse im Überblick", quelle: "n8n Docs", dauer: "Übersichtsseite", url: "https://docs.n8n.io/video-courses/", warum: "Einsteiger- und Fortgeschrittenenkurs an einem Ort." },
      ],
      uebung: {
        titel: "Impediment-Melder bauen",
        schritte: [
          "Zeichne den heutigen Weg, wie Hindernisse bei dir gemeldet werden, als kleine Value Stream Map.",
          "Lege das Formular und die Tabelle an.",
          "Baue den Workflow nach Lektion 4 in einer Plattform deiner Wahl.",
          "Füge eine Fehlerbenachrichtigung hinzu.",
          "Teste mit drei Einträgen und notiere im Lerntagebuch, was nicht auf Anhieb funktioniert hat.",
        ],
        ergebnis: "Ein laufender Workflow ohne KI. Er ist die Grundlage für Modul 5.",
      },
      quiz: [
        { frage: "Was startet einen Workflow?", antworten: ["Ein Auslöser (Trigger)", "Die Fehlerbehandlung", "Die letzte Aktion"], richtig: 0, erklaerung: "Ohne Auslöser läuft nichts von selbst." },
        { frage: "Welcher Prozess eignet sich am besten für eine erste Automatisierung?", antworten: ["Selten, mit vielen Ausnahmen und Bauchentscheidungen.", "Häufig, regelbasiert, digital, mit klarem Anfang und Ende.", "Einmalig, aber sehr aufwendig."], richtig: 1, erklaerung: "Häufigkeit bringt Nutzen, klare Regeln bringen Zuverlässigkeit." },
        { frage: "Warum solltest du den Prozess vor dem Bauen aufzeichnen?", antworten: ["Weil die Plattformen das verlangen.", "Damit du keinen schlechten Prozess nur schneller machst.", "Das ist nicht nötig."], richtig: 1, erklaerung: "Oft zeigt die Aufzeichnung, dass ein Schritt ganz wegfallen kann." },
        { frage: "Was sollte jeder Workflow mindestens als Fehlerbehandlung haben?", antworten: ["Nichts, Fehler kommen selten vor.", "Eine Benachrichtigung an die verantwortliche Person.", "Einen automatischen Neustart ohne Grenze."], richtig: 1, erklaerung: "Ein still gescheiterter Workflow ist schlimmer als gar keiner." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m5", nr: 5, titel: "KI als Baustein im Workflow", kurztitel: "KI im Workflow",
      kurz: "Einordnen, Zusammenfassen, Herausziehen, Entwerfen — und wie du die Qualität im Griff behältst.",
      dauer: "4 h", woche: 4,
      ziele: [
        "Du kennst die vier typischen KI-Aufgaben in Workflows.",
        "Du baust einen KI-Schritt mit strukturierter Ausgabe und einer Weiche dahinter.",
        "Du planst, wo ein Mensch prüft, und misst die Qualität mit einer Stichprobe.",
      ],
      lektionen: [
        {
          id: "m5l1", titel: "Vier Dinge, die KI in Workflows gut kann",
          html: `
<div class="tabelle-wrap"><table>
<tr><th>Aufgabe</th><th>Was passiert</th><th>Beispiel aus dem agilen Alltag</th></tr>
<tr><td><b>Einordnen</b></td><td>Text einer Kategorie zuordnen</td><td>Feedback → Bug / Idee / Lob / Frage</td></tr>
<tr><td><b>Zusammenfassen</b></td><td>Langes kurz machen</td><td>Transkript vom Refinement → fünf Kernpunkte und offene Fragen</td></tr>
<tr><td><b>Herausziehen</b></td><td>Felder aus freiem Text lesen</td><td>E-Mail vom Stakeholder → Wunsch, Frist, Priorität</td></tr>
<tr><td><b>Entwerfen</b></td><td>Neuen Text nach Vorgabe schreiben</td><td>Stichpunkte → User Story mit Akzeptanzkriterien</td></tr>
</table></div>
<p>Alle vier brauchen dasselbe: klare Anweisung, feste Ausgabeform (oft JSON, siehe Modul 2) und ein paar Beispiele. In der Plattform heißt der Baustein etwa „AI Agent“, „Basic LLM Chain“ oder „OpenAI/Anthropic“ (n8n), „AI“ (Make), „AI by Zapier“ oder „AI Builder“ (Power Automate).</p>`
        },
        {
          id: "m5l2", titel: "Praxis: der Retro-Radar",
          html: `
<p>Wir erweitern den Workflow aus Modul 4. Das Team gibt vor der Retro anonym Feedback über ein Formular. Der Workflow ordnet jede Antwort ein, sammelt alles in einer Tabelle und schickt dir am Retro-Morgen eine Zusammenfassung.</p>
<ol>
  <li><b>Auslöser:</b> neue Formularantwort (Felder: „Was lief gut?“, „Was hat gebremst?“, „Idee“).</li>
  <li><b>KI-Schritt „Einordnen“:</b> Prompt aus der Bibliothek „Retro-Feedback einordnen“, Ausgabe als JSON mit <code>thema</code>, <code>stimmung</code> (-1/0/1), <code>kernaussage</code>.</li>
  <li><b>Tabelle:</b> Originaltext plus die drei KI-Felder speichern.</li>
  <li><b>Zweiter Workflow, zeitgesteuert:</b> am Retro-Tag um 8 Uhr alle Zeilen des Sprints holen.</li>
  <li><b>KI-Schritt „Zusammenfassen“:</b> Top-Themen, Stimmungstrend, drei Vorschläge für Retro-Formate.</li>
  <li><b>Nachricht an dich</b>, nicht direkt ans Team. Du prüfst und entscheidest.</li>
</ol>
<div class="notiz"><span class="eyebrow">Warum an dich?</span><p>Die KI bereitet vor, du moderierst. So bleibt die Retro ein Raum des Teams und kein Bericht einer Maschine.</p></div>`
        },
        {
          id: "m5l3", titel: "Mensch im Ablauf (Human in the Loop)",
          html: `
<figure class="grafik" data-grafik="workflow"><figcaption>Der rote Pfad: Unsichere oder heikle Fälle gehen an einen Menschen.</figcaption></figure>
<p>Lass die KI zusätzlich eine <b>Sicherheit</b> ausgeben (z. B. <code>"sicher": true/false</code>) oder begründen. Dann legst du fest:</p>
<ul>
  <li><b>Automatisch:</b> niedriges Risiko und die KI ist sicher (z. B. Ablage in eine Kategorie).</li>
  <li><b>Freigabe:</b> alles, was nach außen geht oder Menschen betrifft (E-Mails an Kunden, Aussagen über Personen).</li>
  <li><b>Nie automatisch:</b> Entscheidungen über Personal, Leistung, Geld.</li>
</ul>
<p>Die meisten Plattformen haben dafür einen Freigabeschritt: Nachricht mit „Freigeben / Ablehnen“-Knopf, der Workflow wartet.</p>`
        },
        {
          id: "m5l4", titel: "Qualität messen statt hoffen",
          html: `
<p>Ein KI-Schritt ist eine Wahrscheinlichkeitsmaschine. Er wird gelegentlich danebenliegen. Die Frage ist: wie oft, und ist das akzeptabel?</p>
<ol>
  <li><b>Testsatz anlegen:</b> 20 echte Beispiele, von dir von Hand richtig eingeordnet.</li>
  <li><b>Durchlaufen lassen</b> und vergleichen: Wie viele hat die KI richtig?</li>
  <li><b>Fehler ansehen:</b> Liegt es am Prompt, an unklaren Kategorien oder am Beispiel selbst?</li>
  <li><b>Nach jeder Prompt-Änderung</b> denselben Testsatz wiederholen.</li>
  <li><b>Im Betrieb:</b> jede Woche fünf zufällige Fälle prüfen.</li>
</ol>
<div class="notiz"><span class="eyebrow">VWL-Brücke</span><p>Das ist eine Stichprobe mit Trefferquote. Bei 20 Fällen ist die Unsicherheit noch groß: 18 von 20 richtig heißt ungefähr 70–97 % im 95-%-Konfidenzintervall. Für kritische Abläufe also mehr testen.</p></div>`
        },
      ],
      videos: [
        { titel: "n8n: KI-Agenten und LLM-Bausteine", quelle: "n8n Docs", dauer: "Lesen, 15 min, Englisch", url: "https://docs.n8n.io/advanced-ai/", warum: "Wie KI-Schritte in n8n aufgebaut sind, mit Beispielen." },
      ],
      uebung: {
        titel: "Retro-Radar bauen",
        schritte: [
          "Erweitere deinen Workflow aus Modul 4 um einen KI-Schritt „Einordnen“ mit JSON-Ausgabe.",
          "Lege einen Testsatz mit 20 selbst ausgedachten Feedback-Sätzen an und ordne sie von Hand ein.",
          "Miss die Trefferquote. Verbessere den Prompt, bis sie mindestens 85 % erreicht.",
          "Baue den zweiten, zeitgesteuerten Workflow mit der Zusammenfassung an dich.",
          "Trage Trefferquote vorher/nachher ins Lerntagebuch ein.",
        ],
        ergebnis: "Ein KI-Workflow mit gemessener Qualität und klarer Rolle für den Menschen.",
      },
      quiz: [
        { frage: "Eine Stakeholder-E-Mail soll in Wunsch, Frist und Priorität zerlegt werden. Welche KI-Aufgabe ist das?", antworten: ["Entwerfen", "Herausziehen", "Zusammenfassen"], richtig: 1, erklaerung: "Felder aus freiem Text lesen heißt Herausziehen (Extraktion)." },
        { frage: "Was gehört niemals in einen vollautomatischen KI-Ablauf?", antworten: ["Feedback in Kategorien ablegen.", "Entscheidungen über Leistung oder Personal.", "Eine Zusammenfassung an dich schicken."], richtig: 1, erklaerung: "Solche Entscheidungen brauchen einen Menschen, auch rechtlich (Modul 7)." },
        { frage: "Wie prüfst du, ob eine Prompt-Änderung besser ist?", antworten: ["Nach Gefühl.", "Mit demselben Testsatz vorher und nachher.", "Indem du das Modell fragst."], richtig: 1, erklaerung: "Nur ein fester Testsatz macht Änderungen vergleichbar." },
        { frage: "Warum schickt der Retro-Radar die Zusammenfassung an dich und nicht ans Team?", antworten: ["Weil die KI das Team nicht kennt.", "Damit ein Mensch prüft und die Retro in der Hand des Teams bleibt.", "Aus technischen Gründen."], richtig: 1, erklaerung: "Die KI bereitet vor, der Mensch moderiert." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m6", nr: 6, titel: "Eigenes Wissen und KI-Agenten", kurztitel: "Wissen & Agenten",
      kurz: "KI mit Firmenwissen verbinden, Werkzeuge über MCP anbinden und verstehen, wann ein Agent sinnvoll ist.",
      dauer: "3,5 h", woche: 5, breite: 0.6,
      ziele: [
        "Du erklärst RAG und weißt, wann es besser ist als ein großes Dokument im Chat.",
        "Du verstehst die Agenten-Schleife und MCP als Standard für Werkzeuge.",
        "Du entscheidest begründet zwischen Workflow und Agent.",
      ],
      lektionen: [
        {
          id: "m6l1", titel: "RAG: KI antwortet aus deinen Dokumenten",
          html: `
<p>Firmenwissen ist zu groß für ein Kontextfenster und ändert sich ständig. <b>Retrieval Augmented Generation</b> (RAG) löst das: Erst wird gesucht, dann geantwortet.</p>
<figure class="grafik" data-grafik="rag"><figcaption>Die Suche arbeitet nach Bedeutung, nicht nach genauen Wörtern. „Fertig-Kriterien“ findet auch „Definition of Done“.</figcaption></figure>
<p>Du nutzt RAG oft schon, ohne es zu wissen: Wissensdateien in Projekten, NotebookLM, Copilot mit SharePoint, Rovo mit Confluence. Gute Ergebnisse hängen vor allem an der <b>Qualität der Dokumente</b>. Veraltete oder widersprüchliche Seiten führen zu veralteten oder widersprüchlichen Antworten.</p>`
        },
        {
          id: "m6l2", titel: "Agenten: Ziel statt Schritte",
          html: `
<p>Bei einem Workflow legst du die Schritte fest. Bei einem <b>Agenten</b> gibst du ein Ziel und Werkzeuge vor, und das Modell entscheidet selbst, welche Schritte es in welcher Reihenfolge macht.</p>
<figure class="grafik" data-grafik="agent"><figcaption>Der Agent wiederholt die Schleife, bis er das Ziel erreicht hat oder nicht weiterkommt.</figcaption></figure>
<p>Beispielauftrag: „Bereite das Sprint Review vor: Hol die erledigten Tickets aus Jira, gruppiere sie nach Epic, schreibe für jede Gruppe zwei Sätze Nutzen für die Anwender und leg den Entwurf als Confluence-Seite ab. Nicht veröffentlichen.“</p>
<div class="tabelle-wrap"><table>
<tr><th>Workflow nehmen, wenn …</th><th>Agent nehmen, wenn …</th></tr>
<tr><td>die Schritte immer gleich sind</td><td>die Schritte je nach Fall anders sind</td></tr>
<tr><td>es sehr oft und zuverlässig laufen muss</td><td>es seltener vorkommt und du dabei bist</td></tr>
<tr><td>Kosten und Laufzeit planbar sein sollen</td><td>Flexibilität wichtiger ist als Planbarkeit</td></tr>
</table></div>`
        },
        {
          id: "m6l3", titel: "MCP: der Steckerstandard für KI-Werkzeuge",
          html: `
<p>Damit ein Agent in Jira lesen oder einen Kalender prüfen kann, braucht er eine Verbindung. Das <b>Model Context Protocol</b> (MCP) ist ein offener Standard dafür, 2024 von Anthropic vorgestellt und inzwischen von vielen Anbietern unterstützt.</p>
<figure class="grafik" data-grafik="mcp"><figcaption>Einmal als MCP-Server angebunden, steht ein Werkzeug vielen KI-Anwendungen zur Verfügung.</figcaption></figure>
<p>In der Praxis heißt das oft „Konnektor“ oder „Integration“: In Claude, ChatGPT oder Copilot aktivierst du etwa den Atlassian- oder Google-Drive-Konnektor, meldest dich an und die KI kann dort lesen und, wenn du es erlaubst, schreiben.</p>
<div class="achtung"><strong>Sicherheit</strong><p>Gib Agenten nur die Rechte, die sie brauchen. Lesen reicht oft. Vorsicht bei Inhalten von außen: Eine Webseite oder E-Mail kann versteckte Anweisungen enthalten („Prompt Injection“), die einen Agenten zu ungewollten Aktionen verleiten. Deshalb: Freigabe vor jeder Aktion, die etwas verändert oder versendet.</p></div>`
        },
        {
          id: "m6l4", titel: "Blick unter die Haube: ein API-Aufruf",
          html: `
<p>Alle Automatisierungsplattformen machen im Hintergrund dasselbe: Sie schicken eine Anfrage an die Schnittstelle (API) eines Modellanbieters. So sieht das aus, freiwillig und nur zum Verstehen:</p>
<pre>curl https://api.anthropic.com/v1/messages \\
  -H "x-api-key: DEIN_SCHLÜSSEL" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-sonnet-5",
    "max_tokens": 500,
    "system": "Du ordnest Retro-Feedback ein. Antworte nur mit JSON.",
    "messages": [{"role": "user", "content": "Das Daily dauert zu lang."}]
  }'</pre>
<p>Du erkennst alles wieder: Systemanweisung, Nachricht, Grenze für die Länge. Abgerechnet wird nach Tokens. Den API-Schlüssel behandelst du wie ein Passwort: nie in Dokumente, Chats oder Tickets kopieren.</p>`
        },
      ],
      film: {
        titel: "Erklärfilm: So arbeitet ein Agent",
        grafik: "agent",
        szenen: [
          { schritt: 1, text: "Der Agent bekommt ein Ziel, zum Beispiel: Bereite das Sprint Review vor." },
          { schritt: 2, text: "Er macht einen Plan: Tickets holen, gruppieren, Texte schreiben, Seite anlegen." },
          { schritt: 3, text: "Er nutzt ein Werkzeug, etwa die Jira-Suche, und bekommt Daten zurück." },
          { schritt: 6, text: "Die Werkzeuge sind über Konnektoren angebunden, oft über den offenen Standard MCP." },
          { schritt: 4, text: "Er schaut sich das Ergebnis an und entscheidet über den nächsten Schritt." },
          { schritt: 5, text: "Ist das Ziel erreicht, hört er auf. Sonst beginnt die Schleife erneut." },
          { schritt: 7, text: "Leitplanken halten den Agenten sicher: wenig Rechte, Freigabe vor dem Senden, jedes Protokoll nachvollziehbar." },
        ],
      },
      videos: [
        { titel: "Was ist das Model Context Protocol?", quelle: "modelcontextprotocol.io", dauer: "Lesen, 10 min, Englisch", url: "https://modelcontextprotocol.io/", warum: "Offizielle Einführung in den Standard." },
        { titel: "Intro to Large Language Models, Teil „LLM OS“ und Sicherheit", quelle: "Andrej Karpathy", dauer: "ab Minute 35, Englisch", url: "https://www.youtube.com/watch?v=zjkBMFhNj_g", warum: "Anschauliche Erklärung von Werkzeugnutzung und Prompt Injection." },
      ],
      uebung: {
        titel: "Workflow oder Agent?",
        schritte: [
          "Lege in einem Projekt oder in NotebookLM drei bis fünf Team-Dokumente ab (Arbeitsvereinbarung, DoD, Onboarding). Stelle fünf Fragen, die ein neues Teammitglied hätte. Prüfe die Quellenangaben.",
          "Aktiviere, falls freigegeben, einen Konnektor (z. B. Google Drive oder Atlassian) und lass die KI eine Übersicht aus echten, unkritischen Daten erstellen, nur lesend.",
          "Nimm die drei Aufgaben aus deinem Lerntagebuch und entscheide für jede: Assistent, Workflow oder Agent? Begründe mit der Tabelle aus Lektion 2.",
        ],
        ergebnis: "Ein Team-Wissensassistent und eine begründete Architekturentscheidung für dein Abschlussprojekt.",
      },
      quiz: [
        { frage: "Was macht RAG?", antworten: ["Es trainiert das Modell mit deinen Daten neu.", "Es sucht passende Abschnitte in deinen Dokumenten und gibt sie dem Modell zur Antwort mit.", "Es löscht veraltete Dokumente."], richtig: 1, erklaerung: "Erst suchen, dann mit den Fundstellen antworten. Neu trainiert wird nichts." },
        { frage: "Wann ist ein Workflow besser als ein Agent?", antworten: ["Wenn die Schritte immer gleich sind und es zuverlässig oft laufen muss.", "Wenn jeder Fall anders ist.", "Nie."], richtig: 0, erklaerung: "Feste Schritte sind planbarer, günstiger und leichter zu prüfen." },
        { frage: "Was ist Prompt Injection?", antworten: ["Ein besonders guter Prompt.", "Versteckte Anweisungen in fremden Inhalten, die einen Agenten manipulieren.", "Ein Fehler in der API."], richtig: 1, erklaerung: "Deshalb brauchen Agenten Freigaben vor verändernden Aktionen." },
        { frage: "Wofür steht MCP?", antworten: ["Ein offener Standard, um KI-Anwendungen mit Werkzeugen und Daten zu verbinden.", "Ein Sprachmodell von Microsoft.", "Eine Datenschutzregel."], richtig: 0, erklaerung: "Model Context Protocol: ein Stecker, viele Werkzeuge." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m7", nr: 7, titel: "Verantwortung: Datenschutz, Recht, Fairness", kurztitel: "Verantwortung",
      kurz: "DSGVO, EU AI Act, Urheberrecht und Voreingenommenheit — was du im Alltag beachten musst.",
      dauer: "2 h", woche: 5, versatz: 0.6, breite: 0.4,
      ziele: [
        "Du stufst Daten mit der Datenampel ein, bevor sie in ein KI-Werkzeug gehen.",
        "Du kennst die Grundzüge des EU AI Act und was er für Anwender bedeutet.",
        "Du erkennst typische Verzerrungen und planst Gegenmaßnahmen.",
      ],
      lektionen: [
        {
          id: "m7l1", titel: "Die Datenampel",
          html: `
<figure class="grafik" data-grafik="ampel"><figcaption>Im Zweifel eine Stufe strenger. Die Regeln deines Unternehmens gehen immer vor.</figcaption></figure>
<ul>
  <li><b>Anonymisieren hilft:</b> „Person A“ statt Namen, keine Kombination aus Rolle und Team, die eindeutig auf jemanden zeigt.</li>
  <li><b>Einstellungen prüfen:</b> Bei privaten Konten kann die Nutzung zum Training aktiv sein. In Unternehmensversionen ist das meist ausgeschlossen.</li>
  <li><b>Transparenz:</b> Wer KI im Team einsetzt, sagt es. Besonders bei Meeting-Aufzeichnungen.</li>
</ul>
<div class="achtung"><strong>Kein Rechtsrat</strong><p>Dieser Kurs gibt eine Orientierung. Für konkrete Fälle sind Datenschutzbeauftragte, Rechtsabteilung und Betriebsrat zuständig. Bei KI-Einsatz, der Verhalten oder Leistung erfassen kann, hat der Betriebsrat in Deutschland ein Mitbestimmungsrecht.</p></div>`
        },
        {
          id: "m7l2", titel: "EU AI Act in fünf Minuten",
          html: `
<p>Die KI-Verordnung der EU ist seit August 2024 in Kraft und gilt gestaffelt. Sie ordnet KI nach Risiko:</p>
<div class="tabelle-wrap"><table>
<tr><th>Stufe</th><th>Beispiele</th><th>Folge</th></tr>
<tr><td><b>Verboten</b></td><td>Social Scoring, Emotionserkennung am Arbeitsplatz (mit Ausnahmen)</td><td>seit Februar 2025 untersagt</td></tr>
<tr><td><b>Hochrisiko</b></td><td>KI bei Bewerbungsauswahl, Leistungsbewertung, Kreditvergabe</td><td>strenge Pflichten; Fristen durch den „Digital Omnibus“ 2026 teils auf Ende 2027 verschoben</td></tr>
<tr><td><b>Transparenz</b></td><td>Chatbots, KI-erzeugte Bilder und Texte für die Öffentlichkeit</td><td>Kennzeichnung, dass KI im Spiel ist</td></tr>
<tr><td><b>Gering</b></td><td>Textentwürfe, Zusammenfassungen, Sortieren</td><td>keine besonderen Pflichten</td></tr>
</table></div>
<p>Für dich besonders wichtig: Unternehmen sollen dafür sorgen, dass Beschäftigte, die mit KI arbeiten, über <b>ausreichende KI-Kompetenz</b> verfügen (Artikel 4). Dieser Kurs ist genau das. Dokumentiere deine Teilnahme.</p>
<div class="achtung"><strong>Stand prüfen</strong><p>Die Verordnung wird laufend ergänzt und angepasst. Den aktuellen Zeitplan findest du unter <a href="https://artificialintelligenceact.eu/implementation-timeline/" target="_blank" rel="noopener">artificialintelligenceact.eu</a>.</p></div>
<div class="notiz"><span class="eyebrow">Achtung Coaching-Alltag</span><p>„Die KI soll aus den Retro-Daten ablesen, wer im Team unzufrieden ist“ wäre eine Leistungs- oder Verhaltensbewertung. Das ist heikel bis unzulässig. Werte Themen aus, nicht Personen.</p></div>`
        },
        {
          id: "m7l3", titel: "Urheberrecht, Kennzeichnung, Verantwortung",
          html: `
<ul>
  <li><b>Du bist verantwortlich</b> für das, was du mit KI-Hilfe veröffentlichst, als hättest du es selbst geschrieben.</li>
  <li><b>Fremde Inhalte:</b> Lade nur hoch, was du nutzen darfst. Lizenzierte Studien oder Kundendokumente nicht einfach in öffentliche Werkzeuge.</li>
  <li><b>Kennzeichnen:</b> Intern ist ein kurzer Hinweis („mit KI-Unterstützung erstellt“) guter Stil. Nach außen kann er Pflicht sein.</li>
  <li><b>Nachvollziehbarkeit:</b> Bei Automatisierungen protokollieren, was die KI entschieden hat.</li>
</ul>`
        },
        {
          id: "m7l4", titel: "Voreingenommenheit (Bias) erkennen",
          html: `
<p>Sprachmodelle lernen aus menschlichen Texten und übernehmen deren Schieflagen. Typische Muster im Arbeitsalltag:</p>
<ul>
  <li>Rollenbilder: „der Entwickler, die Assistentin“ in generierten Texten.</li>
  <li>Bewertungen, die je nach Name, Sprache oder Schreibstil anders ausfallen.</li>
  <li>Einseitige Perspektiven, etwa nur US-amerikanische Management-Literatur.</li>
</ul>
<p><b>Gegenmittel:</b> Tausche testweise Namen oder Merkmale aus und vergleiche die Ergebnisse. Frag ausdrücklich nach Gegenpositionen. Lass Entscheidungen über Menschen bei Menschen.</p>`
        },
      ],
      videos: [
        { titel: "EU AI Act: Zeitplan der Umsetzung", quelle: "artificialintelligenceact.eu", dauer: "Lesen, 10 min, Englisch", url: "https://artificialintelligenceact.eu/implementation-timeline/", warum: "Laufend aktualisierte Übersicht, welche Pflicht ab wann gilt." },
        { titel: "Navigating the AI Act (FAQ)", quelle: "Europäische Kommission", dauer: "Lesen, 20 min, Englisch", url: "https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act", warum: "Offizielle Antworten, auch zur KI-Kompetenz nach Artikel 4." },
      ],
      uebung: {
        titel: "KI-Leitplanken fürs Team",
        schritte: [
          "Kläre, welche KI-Werkzeuge in deinem Unternehmen freigegeben sind und ob es eine KI-Richtlinie gibt.",
          "Ordne die Daten deines geplanten Abschlussprojekts nach der Datenampel ein.",
          "Schreibe eine einseitige „Team-Arbeitsvereinbarung KI“: Was dürfen wir, was nicht, wie kennzeichnen wir, wer ist Ansprechperson?",
          "Mach den Bias-Test: Lass die KI zwei identische Feedbacktexte mit unterschiedlichen Namen bewerten und vergleiche.",
        ],
        ergebnis: "Eine Team-Arbeitsvereinbarung für den KI-Einsatz, die du mit dem Team besprechen kannst.",
      },
      quiz: [
        { frage: "Retro-Notizen mit Namen und Stimmungsbildern gehören in welche Ampelstufe?", antworten: ["Grün", "Gelb", "Rot"], richtig: 2, erklaerung: "Personenbezogen und bewertend: rote Zone." },
        { frage: "Was verlangt Artikel 4 des EU AI Act von Unternehmen?", antworten: ["Dass sie keine KI nutzen.", "Dass Beschäftigte, die mit KI arbeiten, ausreichende KI-Kompetenz haben.", "Dass jede KI-Nutzung genehmigt wird."], richtig: 1, erklaerung: "KI-Kompetenz ist die Grundlage verantwortlicher Nutzung." },
        { frage: "KI soll Bewerbungen vorsortieren. Wie ist das einzustufen?", antworten: ["Geringes Risiko", "Hochrisiko", "Verboten"], richtig: 1, erklaerung: "Personalauswahl gehört ausdrücklich zu den Hochrisiko-Anwendungen." },
        { frage: "Wer ist verantwortlich für einen mit KI erstellten Bericht, den du verschickst?", antworten: ["Der KI-Anbieter", "Du", "Niemand"], richtig: 1, erklaerung: "Die Verantwortung bleibt bei dem Menschen, der das Ergebnis nutzt." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m8", nr: 8, titel: "Wirtschaftlichkeit und Einführung im Team", kurztitel: "Business Case & Einführung",
      kurz: "Rechnen wie eine Volkswirtin, einführen wie ein Agile Coach: Nutzen belegen und KI im Team verankern.",
      dauer: "3 h", woche: 6, breite: 0.5,
      ziele: [
        "Du rechnest einen einfachen Business Case mit Gewinnschwelle und Opportunitätskosten.",
        "Du priorisierst Use Cases nach Nutzen und Risiko.",
        "Du planst die Einführung als Serie kleiner Experimente.",
      ],
      lektionen: [
        {
          id: "m8l1", titel: "Der Business Case",
          html: `
<p>Automatisierung kostet zuerst: Zeit zum Aufbauen, Lernen und Testen. Danach spart sie laufend. Die zentrale Frage ist, <b>ab wann</b> sich das rechnet.</p>
<figure class="grafik" data-grafik="breakEven"><figcaption>Beispiel: 400 € Arbeitszeit pro Monat von Hand, 1.800 € Aufbau, 90 € laufend. Im <a href="#rechner">Rechner</a> setzt du eigene Werte ein.</figcaption></figure>
<ul>
  <li><b>Direkter Nutzen:</b> gesparte Stunden × Stundensatz.</li>
  <li><b>Indirekter Nutzen:</b> weniger Fehler, schnellere Reaktion, Arbeit, die vorher liegen blieb.</li>
  <li><b>Kosten:</b> Aufbau, Lizenzen, Tokens, <i>Pflege</i> (wird oft vergessen, rechne 10–20 % des Aufbaus pro Quartal).</li>
</ul>
<div class="notiz"><span class="eyebrow">VWL-Brücke</span><p><b>Opportunitätskosten:</b> Was machst du mit der gewonnenen Zeit? Nur wenn sie in wertvollere Arbeit fließt, entsteht echter Nutzen. <b>Jevons-Paradox:</b> Wird etwas billiger, wird oft mehr davon gemacht. Zehn KI-Berichte statt einem sparen keine Zeit.</p></div>`
        },
        {
          id: "m8l2", titel: "Use Cases priorisieren",
          html: `
<figure class="grafik" data-grafik="matrix"><figcaption>Beispielhafte Einordnung. Rechts oben anfangen: hoher Nutzen, geringes Risiko.</figcaption></figure>
<p>Bewerte jeden Kandidaten auf zwei Achsen:</p>
<ul>
  <li><b>Nutzen:</b> Zeitersparnis, Häufigkeit, Qualitätsgewinn, Freude im Team.</li>
  <li><b>Risiko:</b> Datenampel, Außenwirkung, Folgen eines Fehlers, Abhängigkeiten.</li>
</ul>
<p>Das ist die bekannte Wert-Aufwand-Matrix aus dem Backlog-Refinement, nur mit Risiko statt Aufwand. Du kannst beides kombinieren: Weighted Shortest Job First (WSJF) funktioniert auch für KI-Vorhaben.</p>`
        },
        {
          id: "m8l3", titel: "Einführung als Experiment",
          html: `
<p>KI-Einführung scheitert selten an der Technik, meistens an Gewohnheiten, Ängsten und fehlender Zeit zum Lernen. Hier ist deine Coaching-Erfahrung Gold wert.</p>
<ol>
  <li><b>Hypothese formulieren:</b> „Wir glauben, dass der Retro-Radar die Vorbereitungszeit von 60 auf 20 Minuten senkt. Wir wissen es nach drei Retros.“</li>
  <li><b>Klein anfangen:</b> ein Team, ein Use Case, begrenzte Zeit.</li>
  <li><b>Messen:</b> Zeit vorher/nachher, Trefferquote, Zufriedenheit des Teams.</li>
  <li><b>Review:</b> Ergebnisse zeigen, auch die gescheiterten.</li>
  <li><b>Skalieren oder stoppen:</b> bewusst entscheiden.</li>
</ol>
<div class="notiz"><span class="eyebrow">Change-Tipps</span><ul><li>Eine <b>Community of Practice</b> „KI im Alltag“ mit 30 Minuten Show &amp; Tell alle zwei Wochen.</li><li>Ängste ernst nehmen: KI übernimmt Aufgaben, nicht Rollen. Sag offen, was mit gewonnener Zeit passieren soll.</li><li>Sichtbare Erfolge feiern, aber ehrlich über Grenzen sprechen.</li></ul></div>`
        },
        {
          id: "m8l4", titel: "Deine Rolle: KI-Coach im Unternehmen",
          html: `
<p>Die Kombination aus ökonomischem Denken, Prozessverständnis und Coaching ist genau das, was Unternehmen bei der KI-Einführung fehlt. Mögliche Rollen:</p>
<ul>
  <li><b>KI-Enablement / KI-Coach:</b> Teams befähigen, Use Cases finden, Leitplanken etablieren.</li>
  <li><b>Product Owner für interne KI-Lösungen:</b> Backlog von Automatisierungen priorisieren.</li>
  <li><b>Prozess- und Wertstrom-Beratung</b> mit KI-Schwerpunkt.</li>
</ul>
<p>Sammle deshalb im Kurs Belege: Vorher-nachher-Zahlen, Screenshots deiner Workflows, eine Team-Arbeitsvereinbarung. Das ist dein Portfolio.</p>`
        },
      ],
      film: {
        titel: "Erklärfilm: Welche Use Cases zuerst?",
        grafik: "matrix",
        szenen: [
          { schritt: 1, text: "Retro-Notizen clustern: großer Nutzen, geringes Risiko, wenn die Notizen anonym sind. Ein idealer Start." },
          { schritt: 2, text: "Meeting-Protokolle sparen viel Zeit. Das Risiko ist mittel, weil Namen und Aussagen drinstecken." },
          { schritt: 3, text: "User Stories vorformulieren: solider Nutzen, kaum Risiko. Der Mensch prüft ohnehin im Refinement." },
          { schritt: 4, text: "Bewerbungen vorsortieren: Das ist Hochrisiko nach dem EU AI Act. Nur mit strengen Leitplanken, oder gar nicht." },
          { schritt: 5, text: "Kunden-Mails automatisch beantworten: großer Nutzen, aber hohe Außenwirkung. Freigabe durch Menschen einbauen." },
          { schritt: 6, text: "Ein Glossar-Bot fürs Team ist risikoarm, bringt aber weniger. Gut als Lernprojekt." },
        ],
      },
      videos: [
        { titel: "AI Fluency für kleine Unternehmen", quelle: "Anthropic Academy", dauer: "Kurs, Englisch", url: "https://anthropic.skilljar.com/", warum: "Gut für den Blick, wie Einführung im Unternehmen gelingt." },
      ],
      uebung: {
        titel: "Business Case und Experiment-Karte",
        schritte: [
          "Trage deine drei Kandidaten in die Nutzen-Risiko-Matrix ein (Canvas-Seite).",
          "Rechne für den besten Kandidaten im Rechner die Gewinnschwelle aus, mit ehrlichen Werten inklusive Pflege.",
          "Formuliere eine Hypothese im Format „Wir glauben … Wir wissen es, wenn …“.",
          "Überlege, wer im Team profitiert und wer Bedenken haben könnte. Plane ein Gespräch.",
        ],
        ergebnis: "Ein begründeter, gerechneter Vorschlag für dein Abschlussprojekt.",
      },
      quiz: [
        { frage: "Was wird im KI-Business-Case am häufigsten vergessen?", antworten: ["Die Lizenzkosten", "Die laufende Pflege", "Der Stundensatz"], richtig: 1, erklaerung: "Prompts, Verbindungen und Prozesse ändern sich. Pflege kostet laufend Zeit." },
        { frage: "Was beschreibt das Jevons-Paradox im KI-Kontext?", antworten: ["Wenn etwas billiger wird, wird oft mehr davon gemacht, und die Ersparnis verpufft.", "KI wird immer teurer.", "Automatisierung spart immer Zeit."], richtig: 0, erklaerung: "Deshalb vorher festlegen, wohin die gewonnene Zeit fließen soll." },
        { frage: "Wie führst du KI im Team am besten ein?", antworten: ["Mit einer großen Ankündigung für alle gleichzeitig.", "Als kleines, gemessenes Experiment mit klarer Hypothese.", "Indem jeder selbst ausprobiert, ohne Austausch."], richtig: 1, erklaerung: "Klein anfangen, messen, dann bewusst skalieren." },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: "m9", nr: 9, titel: "Abschlussprojekt: deine eigene KI-Lösung", kurztitel: "Abschlussprojekt",
      kurz: "In zwei Mini-Sprints von der Idee zur laufenden Lösung, mit Review und Zertifikat.",
      dauer: "4 h", woche: 6, versatz: 0.5, breite: 0.5,
      ziele: [
        "Du hast eine eigene KI-Lösung gebaut, die ein echtes Problem löst.",
        "Du hast Nutzen und Qualität gemessen.",
        "Du kannst die Lösung in fünf Minuten vorstellen.",
      ],
      lektionen: [
        {
          id: "m9l1", titel: "Sprint 1: Canvas und erster Durchstich",
          html: `
<p>Fülle den <a href="#canvas">Use-Case-Canvas</a> aus. Er zwingt dich, alle wichtigen Fragen vorab zu klären: Problem, Nutzer, Daten, Ablauf, Risiko, Messgröße.</p>
<p>Baue dann den kleinsten Ablauf, der von Anfang bis Ende läuft, auch wenn er noch hässlich ist. Ein Auslöser, ein KI-Schritt, ein Ergebnis. Das ist dein <b>Walking Skeleton</b>.</p>`
        },
        {
          id: "m9l2", titel: "Sprint 2: Qualität, Leitplanken, Messung",
          html: `
<ul>
  <li>Testsatz mit mindestens 20 Fällen, Trefferquote messen und verbessern.</li>
  <li>Mensch im Ablauf an den richtigen Stellen.</li>
  <li>Fehlerbehandlung und Benachrichtigung.</li>
  <li>Kurze Dokumentation: Was macht es, wer pflegt es, wo liegen die Zugänge?</li>
  <li>Eine Woche echte Nutzung und Zeitmessung vorher/nachher.</li>
</ul>`
        },
        {
          id: "m9l3", titel: "Review: fünf Minuten, die überzeugen",
          html: `
<ol>
  <li><b>Problem</b> in einem Satz, mit Zahl („Vorbereitung der Retro kostet mich 60 Minuten“).</li>
  <li><b>Live-Demo</b> des Ablaufs, zwei Minuten.</li>
  <li><b>Ergebnis:</b> gemessene Zeitersparnis und Trefferquote.</li>
  <li><b>Leitplanken:</b> Daten, Mensch im Ablauf, was bewusst nicht automatisiert ist.</li>
  <li><b>Nächster Schritt:</b> skalieren, verbessern oder stoppen.</li>
</ol>
<p>Stelle die Lösung deinem Team oder einer Kollegin vor und hol Feedback ein. Wenn alle Module abgeschlossen sind, schaltet sich dein <a href="#zertifikat">Zertifikat</a> frei.</p>`
        },
      ],
      videos: [],
      uebung: {
        titel: "Abschlussprojekt",
        schritte: [
          "Canvas ausfüllen und mit einer Person gegenlesen lassen.",
          "Sprint 1: Walking Skeleton bauen.",
          "Sprint 2: Testsatz, Leitplanken, Dokumentation, eine Woche echte Nutzung.",
          "Review mit Team oder Kollegin halten und Feedback im Lerntagebuch festhalten.",
          "Abschlussretro: Was würdest du beim nächsten KI-Projekt anders machen?",
        ],
        ergebnis: "Eine laufende, gemessene KI-Lösung und ein Portfolio-Nachweis.",
      },
      quiz: [
        { frage: "Was ist ein Walking Skeleton?", antworten: ["Die kleinste Version, die von Anfang bis Ende läuft.", "Eine vollständige Dokumentation.", "Ein Testsatz."], richtig: 0, erklaerung: "Erst durchgängig, dann schön. Das kennst du aus der Produktentwicklung." },
        { frage: "Was gehört unbedingt ins Review?", antworten: ["Nur die Technik.", "Gemessener Nutzen und Leitplanken.", "Eine Liste aller Werkzeuge, die du ausprobiert hast."], richtig: 1, erklaerung: "Entscheider wollen wissen: Was bringt es, und ist es sicher?" },
      ],
    },
  ],

  /* ---------------------------------------------------------------------- */
  prompts: [
    { kat: "Scrum & Agile", titel: "Retro-Feedback einordnen (für Workflows)", text: `Du ordnest anonymes Retrospektiven-Feedback eines Scrum-Teams ein.
Antworte ausschließlich mit JSON in diesem Format, ohne weiteren Text:
{"thema": "Zusammenarbeit" | "Prozess" | "Technik" | "Stakeholder" | "Arbeitslast" | "Sonstiges",
 "stimmung": -1 | 0 | 1,
 "kernaussage": "max. 12 Wörter, neutral formuliert",
 "sicher": true | false}
Setze "sicher" auf false, wenn das Feedback mehrdeutig ist.
Nenne niemals Personen, auch wenn sie im Text vorkommen.

Feedback: {FEEDBACK}` },
    { kat: "Scrum & Agile", titel: "Retro-Vorbereitung aus gesammeltem Feedback", text: `Rolle: Du bist ein erfahrener Agile Coach und bereitest eine Retrospektive vor.
Ziel: Hilf mir, eine Retro zu gestalten, die das wichtigste Thema des Teams trifft.
Kontext: Team mit {ANZAHL} Personen, Sprint {NR}, besondere Ereignisse: {EREIGNISSE}.
Unten steht das gesammelte, anonyme Feedback.
Format:
1. Top-3-Themen mit je einem typischen Zitat
2. Stimmungstrend in einem Satz
3. Zwei passende Retro-Formate mit Ablauf (Zeitangaben für 60 Minuten)
Grenzen: Keine Rückschlüsse auf einzelne Personen. Wenn das Feedback zu dünn ist, sag es.

Feedback:
{FEEDBACK}` },
    { kat: "Scrum & Agile", titel: "User Story aus Stichpunkten", text: `Schreibe aus den Stichpunkten eine User Story im Format
„Als <Rolle> möchte ich <Ziel>, damit <Nutzen>“ mit 3–5 Akzeptanzkriterien (Gegeben/Wenn/Dann).
Prüfe die Story danach gegen INVEST und nenne in einer Zeile, welches Kriterium am schwächsten ist.
Stell mir zuerst Rückfragen, wenn Rolle oder Nutzen unklar sind.

Stichpunkte: {STICHPUNKTE}` },
    { kat: "Scrum & Agile", titel: "Sprint Review für Stakeholder übersetzen", text: `Hier sind die erledigten Tickets des Sprints. Fasse sie für Stakeholder ohne Technikhintergrund zusammen.
Gruppiere nach Nutzen für Anwender, nicht nach Technik. Maximal 150 Wörter, danach eine Zeile „Was als Nächstes kommt“.
Erfinde nichts, was nicht in den Tickets steht.

Tickets:
{TICKETS}` },
    { kat: "Coaching", titel: "Coaching-Gespräch vorbereiten", text: `Ich coache eine Führungskraft, die {SITUATION}.
Schlage mir zehn offene, systemische Coaching-Fragen vor, geordnet nach Gesprächsphase (Einstieg, Klärung, Lösung, Abschluss).
Vermeide Suggestivfragen und Ratschläge.` },
    { kat: "Coaching", titel: "Gegenpositionen einholen", text: `Hier ist mein Plan: {PLAN}
Übernimm nacheinander drei Perspektiven: ein skeptisches Teammitglied, die Geschäftsführung, den Betriebsrat.
Nenne je Perspektive die zwei stärksten Einwände und eine Frage, die ich vorab klären sollte.` },
    { kat: "Analyse & VWL", titel: "Business Case prüfen", text: `Du bist Controllerin mit VWL-Hintergrund. Prüfe diesen Business Case für eine KI-Automatisierung kritisch.
Berechne Gewinnschwelle und Nutzen nach 12 Monaten. Nenne fehlende Kostenpositionen (Pflege, Schulung, Tokens),
Opportunitätskosten und Rebound-Effekte. Rechne Schritt für Schritt und zeig die Rechnung.

Daten: {DATEN}` },
    { kat: "Analyse & VWL", titel: "Nur aus Quellen antworten", text: `Beantworte die Frage ausschließlich anhand der angehängten Dokumente.
Gib zu jeder Aussage die Stelle an (Dokument, Abschnitt).
Wenn die Dokumente die Frage nicht beantworten, sag „Steht nicht in den Quellen“ und rate nicht.

Frage: {FRAGE}` },
    { kat: "Automatisierung", titel: "Stakeholder-Mail in Felder zerlegen", text: `Lies die E-Mail und gib ausschließlich JSON zurück:
{"anliegen": "kurz", "frist": "JJJJ-MM-TT oder null", "prioritaet": "hoch" | "mittel" | "niedrig",
 "betroffenes_produkt": "Text oder null", "rueckfrage_noetig": true | false}
Wenn eine Angabe fehlt, setze null. Erfinde keine Frist.

E-Mail: {EMAIL}` },
    { kat: "Automatisierung", titel: "Prozess für Automatisierung analysieren", text: `Ich beschreibe dir einen Arbeitsablauf. Erstelle daraus:
1. Eine Schrittliste mit Rolle, Werkzeug, Dauer und Wartezeit
2. Eine Einschätzung je Schritt: weglassen, automatisieren (ohne KI), KI-Schritt, bleibt beim Menschen
3. Einen Vorschlag für einen Workflow mit Auslöser, Schritten und Freigabepunkten
Frag nach, wenn Häufigkeit oder Regeln unklar sind.

Ablauf: {ABLAUF}` },
    { kat: "Automatisierung", titel: "Eigenen Prompt verbessern lassen", text: `Hier ist ein Prompt, den ich in einem automatisierten Workflow nutze, und drei Fälle, in denen das Ergebnis falsch war.
Analysiere, warum die Fehler entstehen, und schlage eine verbesserte Fassung vor.
Ändere nur, was nötig ist, und erkläre jede Änderung in einem Satz.

Prompt: {PROMPT}
Fehlerfälle: {FAELLE}` },
  ],

  /* ---------------------------------------------------------------------- */
  glossar: [
    ["Agent", "KI, die ein Ziel selbstständig in Schritten verfolgt und dabei Werkzeuge nutzt."],
    ["API", "Programmierschnittstelle. Darüber sprechen Automatisierungen mit KI-Modellen und anderen Programmen."],
    ["AVV", "Auftragsverarbeitungsvertrag nach DSGVO. Regelt, wie ein Anbieter personenbezogene Daten in deinem Auftrag verarbeitet."],
    ["Bias", "Systematische Verzerrung, die ein Modell aus seinen Trainingsdaten übernimmt."],
    ["Denkmodus (Reasoning)", "Betriebsart, in der das Modell vor der Antwort Zwischenschritte durchdenkt."],
    ["EU AI Act", "KI-Verordnung der EU. Ordnet KI-Systeme nach Risiko und legt Pflichten fest."],
    ["Few-Shot", "Prompt mit wenigen Beispielen, an denen sich das Modell orientiert."],
    ["Halluzination", "Plausibel klingende, aber erfundene Aussage eines Sprachmodells."],
    ["Human in the Loop", "Ein Mensch prüft oder gibt frei, bevor ein automatisierter Schritt wirkt."],
    ["JSON", "Einfaches Textformat mit benannten Feldern. Ideal, damit Automatisierungen KI-Antworten weiterverarbeiten."],
    ["Kontextfenster", "Alles, was ein Modell in einer Unterhaltung gleichzeitig sehen kann. Gemessen in Tokens."],
    ["Konnektor", "Fertige Verbindung zwischen KI-Anwendung und einem Werkzeug wie Jira oder Google Drive."],
    ["LLM", "Large Language Model, großes Sprachmodell. Die Technik hinter Claude, ChatGPT und Co."],
    ["MCP", "Model Context Protocol. Offener Standard, um KI-Anwendungen an Werkzeuge und Daten anzubinden."],
    ["Multimodal", "Ein Modell verarbeitet neben Text auch Bilder, Audio oder Dateien."],
    ["Prompt", "Die Anweisung an ein Sprachmodell."],
    ["Prompt Injection", "Angriff, bei dem versteckte Anweisungen in fremden Inhalten ein Modell manipulieren."],
    ["RAG", "Retrieval Augmented Generation. Erst passende Textstellen suchen, dann damit antworten."],
    ["Systemanweisung", "Dauerhafte Anweisung, die vor jedem Gespräch gilt, z. B. in einem Projekt."],
    ["Temperatur", "Einstellung, wie zufällig das Modell das nächste Token wählt."],
    ["Token", "Wortstück, in dem Modelle Text verarbeiten und in dem abgerechnet wird."],
    ["Trigger", "Auslöser, der einen Workflow startet."],
    ["Walking Skeleton", "Kleinste Version einer Lösung, die von Anfang bis Ende funktioniert."],
    ["Workflow", "Automatisierter Ablauf aus Auslöser, Schritten und Bedingungen."],
  ],
};
