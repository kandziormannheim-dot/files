/* KI-Werkstatt — Grafiken
   Jede Grafik ist eine Funktion, die SVG als Text liefert. Gruppen mit
   data-schritt="n" kann der Erklärfilm nacheinander hervorheben.
   Farben kommen ausschließlich über die g-*-Klassen aus kurs.css. */
(function () {
  "use strict";

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = (w, h, inhalt, titel) =>
    `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(titel)}" xmlns="http://www.w3.org/2000/svg">
      <defs><marker id="spitze" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" class="g-pfeil"/></marker></defs>${inhalt}</svg>`;
  const box = (x, y, w, h, cls, r = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${cls}"/>`;
  const txt = (x, y, s, cls = "", anchor = "middle") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(s)}</text>`;
  const pfeil = (x1, y1, x2, y2, cls = "g-lin") =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" marker-end="url(#spitze)"/>`;
  const schritt = (n, inhalt) => `<g data-schritt="${n}">${inhalt}</g>`;

  const G = {};

  /* Vom Chatbot zum Agenten: vier Stufen */
  G.leiter = () => {
    const stufen = [
      ["Chatbot", "Du fragst,", "die KI antwortet.", "Heute: da bist du"],
      ["Assistent", "Projekt mit Wissen", "und Anweisungen", "Modul 2–3"],
      ["Workflow", "Feste Schritte laufen", "automatisch ab", "Modul 4–5"],
      ["Agent", "KI plant und nutzt", "Werkzeuge selbst", "Modul 6"],
    ];
    let s = "";
    stufen.forEach((st, i) => {
      const x = 20 + i * 190, y = 190 - i * 44, h = 70 + i * 44;
      s += schritt(i + 1,
        box(x, y, 170, h, i === 0 ? "g-nog" : "g-akh", 8) +
        txt(x + 85, y + 26, st[0], "tb" + (i === 0 ? " tn" : "")) +
        txt(x + 85, y + 48, st[1], "t2") + txt(x + 85, y + 64, st[2], "t2") +
        txt(x + 85, 290, st[3], "tm" + (i === 0 ? "" : " tak")));
    });
    s += pfeil(20, 318, 770, 318) + txt(20, 340, "mehr Selbstständigkeit der KI  →  mehr Nutzen, aber auch mehr Verantwortung beim Aufbau", "t2", "start");
    return svg(790, 350, s, "Vier Stufen vom Chatbot zum Agenten");
  };

  /* Nächstes-Token-Vorhersage */
  G.token = () => {
    const satz = ["Im", " Daily", " klären", " wir", ",", " was", " uns"];
    const werte = [["blockiert", .46], ["bremst", .21], ["hilft", .12], ["fehlt", .09], ["freut", .04]];
    let s = "", x = 20;
    let t1 = "";
    satz.forEach((w) => {
      const b = 12 + w.length * 9.5;
      t1 += box(x, 40, b, 34, "g-fl", 6) + txt(x + b / 2, 62, w.trim() || "␣", "tm");
      x += b + 6;
    });
    t1 += box(x, 40, 70, 34, "g-nog", 6) + txt(x + 35, 62, "???", "tm tn");
    s += txt(20, 24, "1  Der Text wird in Tokens zerlegt (Wortstücke)", "t2", "start");
    s = schritt(1, s + t1);
    let t2 = txt(20, 110, "2  Das Modell berechnet für jedes mögliche nächste Token eine Wahrscheinlichkeit", "t2", "start");
    werte.forEach(([w, p], i) => {
      const y = 126 + i * 34;
      t2 += txt(130, y + 19, w, "tm", "end") + box(140, y, 520 * p / .5, 24, i === 0 ? "g-ak" : "g-akh", 4) +
        txt(150 + 520 * p / .5, y + 17, (p * 100).toFixed(0) + " %", "tm", "start");
    });
    s += schritt(2, t2);
    s += schritt(3,
      txt(20, 318, "3  Eines wird gezogen (meist ein wahrscheinliches), angehängt — und alles beginnt von vorn.", "t2", "start") +
      txt(20, 340, "Kein Nachschlagen in einer Datenbank: nur sehr gut trainierte Wahrscheinlichkeiten.", "t2", "start"));
    return svg(790, 352, s, "Wie ein Sprachmodell das nächste Wort wählt");
  };

  /* Kontextfenster */
  G.kontext = () => {
    let s = box(250, 20, 520, 300, "g-fl", 12) + txt(510, 46, "Kontextfenster = Arbeitsgedächtnis dieser einen Unterhaltung", "tb");
    const ebenen = [
      ["Systemanweisung / Projektanweisung", "Wer bin ich, wie antworte ich?", "g-akh"],
      ["Angehängte Dateien, Wissen", "Protokolle, Backlog, PDF …", "g-akh"],
      ["Bisheriger Gesprächsverlauf", "alles, was schon gesagt wurde", "g-fl2"],
      ["Deine aktuelle Nachricht", "die eigentliche Frage", "g-nog"],
    ];
    ebenen.forEach((e, i) => {
      const y = 66 + i * 60;
      s += schritt(i + 1, box(272, y, 476, 50, e[2], 6) + txt(290, y + 22, e[0], "tb" + (i === 3 ? " tn" : ""), "start") + txt(290, y + 40, e[1], "t2" , "start"));
    });
    s += schritt(5, box(20, 110, 200, 120, "g-wa", 10) + txt(120, 140, "Trainingswissen", "tb twa") +
      txt(120, 162, "eingefroren zum", "t2") + txt(120, 180, "Stichtag, ungenau", "t2") + txt(120, 198, "bei Details", "t2") +
      pfeil(220, 170, 248, 170));
    s += txt(510, 340, "Was nicht im Fenster steht, weiß das Modell nur ungefähr — oder erfindet es.", "t2");
    return svg(790, 352, s, "Was ein Sprachmodell in einer Unterhaltung sieht");
  };

  /* Prompt-Anatomie */
  G.prompt = () => {
    const teile = [
      ["Rolle", "Du begleitest seit zehn Jahren agile Teams in der Finanzbranche."],
      ["Ziel", "Werte die Retro-Notizen aus und schlage 3 Experimente vor."],
      ["Kontext", "Team aus 7 Personen, Sprint 14, Thema Release-Stress. Notizen unten."],
      ["Format", "Tabelle: Thema | Häufigkeit | Zitat | Experiment. Max. 200 Wörter."],
      ["Beispiel", "So sieht ein gutes Experiment aus: „Zwei Wochen WIP-Limit 3 …“"],
      ["Grenzen", "Nenne keine Namen. Wenn etwas unklar ist, frag zuerst nach."],
    ];
    let s = "";
    teile.forEach((t, i) => {
      const y = 14 + i * 52;
      s += schritt(i + 1, box(20, y, 120, 42, i % 2 ? "g-akh" : "g-ak", 6) +
        txt(80, y + 27, t[0], "tb" + (i % 2 ? " tak" : " ti")) +
        box(150, y, 620, 42, "g-fl", 6) + txt(166, y + 26, t[1], "", "start"));
    });
    return svg(790, 330, s, "Die sechs Bausteine eines guten Prompts");
  };

  /* Workflow mit KI-Schritt und Mensch */
  G.workflow = () => {
    let s = "";
    s += schritt(1, box(20, 120, 130, 70, "g-nog", 10) + txt(85, 148, "Auslöser", "tb tn") + txt(85, 170, "Formular geht ein", "t2"));
    s += pfeil(150, 155, 182, 155);
    s += schritt(2, box(184, 120, 130, 70, "g-fl", 10) + txt(249, 148, "Daten holen", "tb") + txt(249, 170, "Felder aufbereiten", "t2"));
    s += pfeil(314, 155, 346, 155);
    s += schritt(3, box(348, 110, 140, 90, "g-akh", 10) + txt(418, 140, "KI-Schritt", "tb tak") + txt(418, 162, "einordnen,", "t2") + txt(418, 180, "zusammenfassen", "t2"));
    s += pfeil(488, 155, 520, 155);
    s += schritt(4, `<polygon points="560,110 600,155 560,200 520,155" class="g-fl"/>` + txt(560, 160, "Weiche", "t2"));
    s += schritt(5, pfeil(600, 155, 630, 70) + box(632, 36, 146, 60, "g-fl", 10) + txt(705, 62, "Ticket anlegen", "tb") + txt(705, 82, "wenn „Bug“", "t2") +
      pfeil(600, 155, 630, 240) + box(632, 212, 146, 60, "g-fl", 10) + txt(705, 238, "Nachricht ans Team", "tb") + txt(705, 258, "wenn „Idee“", "t2"));
    s += schritt(6, box(348, 250, 250, 52, "g-wa", 10) + txt(473, 272, "Mensch prüft", "tb twa") + txt(473, 290, "bei Unsicherheit der KI", "t2") +
      `<path d="M418 200 L418 250" class="g-linwa" stroke-dasharray="5 4" marker-end="url(#spitze)"/>`);
    return svg(790, 316, s, "Aufbau eines Workflows mit KI-Schritt");
  };

  /* Agenten-Schleife */
  G.agent = () => {
    const cx = 300, cy = 175, r = 120;
    const stationen = [["Ziel verstehen", -90], ["Plan machen", -18], ["Werkzeug nutzen", 54], ["Ergebnis ansehen", 126], ["Fertig?", 198]];
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" class="g-gitter" stroke-dasharray="6 6"/>`;
    stationen.forEach(([n, grad], i) => {
      const a = grad * Math.PI / 180, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      s += schritt(i + 1, box(x - 72, y - 20, 144, 40, i === 2 ? "g-akh" : "g-fl", 20) + txt(x, y + 5, n, "tb"));
    });
    s += txt(cx, cy - 4, "Schleife läuft,", "t2") + txt(cx, cy + 14, "bis das Ziel erreicht ist", "t2");
    s += schritt(6, box(510, 40, 260, 124, "g-akh", 10) + txt(640, 66, "Werkzeuge (z. B. über MCP)", "tb tak") +
      txt(640, 90, "Jira lesen · Kalender · Dateien", "t2") + txt(640, 110, "Websuche · E-Mail-Entwurf", "t2") + txt(640, 130, "Tabellen · Code ausführen", "t2") +
      pfeil(420, 190, 508, 120));
    s += schritt(7, box(510, 196, 260, 110, "g-wa", 10) + txt(640, 222, "Leitplanken", "tb twa") +
      txt(640, 246, "Rechte nur so weit wie nötig", "t2") + txt(640, 266, "Freigabe vor dem Senden", "t2") + txt(640, 286, "Protokoll jedes Schritts", "t2"));
    return svg(790, 330, s, "Wie ein KI-Agent arbeitet");
  };

  /* RAG */
  G.rag = () => {
    let s = "";
    s += schritt(1, box(20, 130, 130, 60, "g-nog", 10) + txt(85, 156, "Frage", "tb tn") + txt(85, 176, "„Was gilt bei DoD?“", "t2"));
    s += pfeil(150, 160, 190, 160);
    s += schritt(2, box(192, 30, 170, 90, "g-fl", 10) + txt(277, 56, "Wissensspeicher", "tb") + txt(277, 78, "Confluence, PDFs,", "t2") + txt(277, 96, "Protokolle (vorab zerlegt)", "t2") +
      box(192, 130, 170, 60, "g-akh", 10) + txt(277, 156, "Suche", "tb tak") + txt(277, 176, "nach Bedeutung", "t2") + `<path d="M277 120 L277 130" class="g-lin"/>`);
    s += pfeil(362, 160, 402, 160);
    s += schritt(3, box(404, 110, 170, 100, "g-fl", 10) + txt(489, 134, "Top-3-Abschnitte", "tb") +
      box(420, 144, 138, 14, "g-fl2", 3) + box(420, 164, 138, 14, "g-fl2", 3) + box(420, 184, 100, 14, "g-fl2", 3));
    s += pfeil(574, 160, 614, 160);
    s += schritt(4, box(616, 120, 160, 80, "g-akh", 10) + txt(696, 146, "Sprachmodell", "tb tak") + txt(696, 166, "antwortet nur aus", "t2") + txt(696, 184, "diesen Abschnitten", "t2"));
    s += schritt(5, pfeil(696, 200, 696, 240) + box(560, 242, 216, 56, "g-gut", 10) + txt(668, 266, "Antwort + Quellenangabe", "tb") + txt(668, 286, "nachprüfbar", "t2"));
    return svg(790, 312, s, "Retrieval Augmented Generation: KI mit eigenem Wissen");
  };

  /* MCP */
  G.mcp = () => {
    let s = schritt(1, box(20, 110, 190, 100, "g-akh", 12) + txt(115, 146, "KI-Anwendung", "tb tak") + txt(115, 168, "Claude, ChatGPT,", "t2") + txt(115, 186, "Copilot, n8n …", "t2"));
    s += schritt(2, box(270, 130, 110, 60, "g-no", 30) + txt(325, 165, "MCP", "tb tn") + `<line x1="210" y1="160" x2="270" y2="160" class="g-linak"/>`);
    const ziele = ["Jira / Azure DevOps", "Confluence / Wiki", "Kalender & E-Mail", "Tabellen & Dateien", "Eigene Datenbank"];
    let z = "";
    ziele.forEach((n, i) => {
      const y = 20 + i * 58;
      z += `<path d="M380 160 C 440 160, 440 ${y + 22}, 500 ${y + 22}" class="g-linak"/>` + box(500, y, 270, 44, "g-fl", 8) + txt(520, y + 27, n, "", "start");
    });
    s += schritt(3, z);
    s += txt(20, 300, "Ein Stecker-Standard: Jedes Werkzeug wird einmal angebunden und steht dann vielen KI-Anwendungen zur Verfügung.", "t2", "start");
    return svg(790, 312, s, "Model Context Protocol als Steckverbindung");
  };

  /* Datenampel */
  G.ampel = () => {
    const stufen = [
      ["g-gut", "Grün — öffentlich", "Webseiten, Fachartikel, eigene", "anonyme Notizen", "jedes seriöse KI-Werkzeug"],
      ["g-nog", "Gelb — intern", "Backlog, Prozessbeschreibungen,", "Protokolle ohne Namen", "nur freigegebene Firmen-KI (AV-Vertrag)"],
      ["g-wa", "Rot — personenbezogen, vertraulich", "Namen + Bewertung, Gehälter,", "Kundendaten, Gesundheit", "nur mit Freigabe DSB / oder gar nicht"],
    ];
    let s = "";
    stufen.forEach((st, i) => {
      const y = 16 + i * 98;
      s += schritt(i + 1, `<circle cx="52" cy="${y + 42}" r="30" class="${st[0]}"/>` +
        box(100, y, 330, 84, "g-fl", 10) + txt(116, y + 26, st[1], "tb", "start") + txt(116, y + 48, st[2], "t2", "start") + txt(116, y + 66, st[3], "t2", "start") +
        pfeil(432, y + 42, 470, y + 42) + box(472, y + 14, 300, 56, st[0], 10) + txt(622, y + 47, st[4], "tb"));
    });
    return svg(790, 312, s, "Datenampel: was darf in welches KI-Werkzeug");
  };

  /* Nutzen-Risiko-Matrix */
  G.matrix = (punkte) => {
    const P = punkte || [
      ["Retro-Notizen clustern", 7, 2], ["Meeting-Protokolle", 6, 3], ["User Stories vorformulieren", 5, 2],
      ["Bewerbungen vorsortieren", 6, 9], ["Kunden-Mails auto-antworten", 8, 7], ["Glossar-Bot fürs Team", 4, 3],
    ];
    const X0 = 90, Y0 = 20, W = 640, H = 300;
    let s = box(X0, Y0, W / 2, H / 2, "g-nog", 0) + box(X0 + W / 2, Y0, W / 2, H / 2, "g-gut", 0) +
      box(X0, Y0 + H / 2, W / 2, H / 2, "g-fl2", 0) + box(X0 + W / 2, Y0 + H / 2, W / 2, H / 2, "g-wa", 0);
    s += txt(X0 + 10, Y0 + 20, "Später / klein halten", "t2", "start") + txt(X0 + W - 10, Y0 + 20, "Zuerst machen", "tb", "end") +
      txt(X0 + 10, Y0 + H - 10, "Lassen", "t2", "start") + txt(X0 + W - 10, Y0 + H - 10, "Nur mit Leitplanken", "tb twa", "end");
    s += txt(X0 + W / 2, Y0 + H + 34, "Nutzen (Zeit, Qualität, Freude)  →", "t2");
    s += `<text x="30" y="${Y0 + H / 2}" transform="rotate(-90 30 ${Y0 + H / 2})" text-anchor="middle" class="t2">← höheres Risiko   ·   geringeres Risiko →</text>`;
    P.forEach(([n, nutzen, risiko], i) => {
      const x = X0 + (nutzen / 10) * W, y = Y0 + (risiko / 10) * H;
      s += schritt(i + 1, `<circle cx="${x}" cy="${y}" r="8" class="g-ak"/>` + txt(x + (nutzen > 7 ? -12 : 12), y + 5, n, "", nutzen > 7 ? "end" : "start"));
    });
    return svg(760, 370, s, "Use Cases nach Nutzen und Risiko einordnen");
  };

  /* Break-even: kumulierte Kosten manuell gegen automatisiert */
  G.breakEven = (p) => {
    const q = Object.assign({ manuellMonat: 400, aufbau: 1800, laufendMonat: 90, monate: 12 }, p || {});
    const X0 = 70, Y0 = 20, W = 660, H = 250;
    const manuell = (m) => q.manuellMonat * m;
    const auto = (m) => q.aufbau + q.laufendMonat * m;
    const maxWert = Math.max(manuell(q.monate), auto(q.monate), 1);
    const schrittWert = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000, 100000].find((v) => maxWert / v <= 6) || 200000;
    const oben = Math.ceil(maxWert / schrittWert) * schrittWert;
    const sx = (m) => X0 + (m / q.monate) * W, sy = (v) => Y0 + H - (v / oben) * H;
    let s = "";
    for (let v = 0; v <= oben; v += schrittWert) {
      s += `<line x1="${X0}" y1="${sy(v)}" x2="${X0 + W}" y2="${sy(v)}" class="g-gitter"/>` + txt(X0 - 8, sy(v) + 4, v.toLocaleString("de-DE") + " €", "tm", "end");
    }
    for (let m = 0; m <= q.monate; m += q.monate > 12 ? 6 : 2) s += txt(sx(m), Y0 + H + 20, "M" + m, "tm");
    const linie = (f, cls) => `<polyline class="${cls}" points="${Array.from({ length: q.monate + 1 }, (_, m) => `${sx(m).toFixed(1)},${sy(f(m)).toFixed(1)}`).join(" ")}"/>`;
    s += linie(manuell, "g-linwa") + linie(auto, "g-linak");
    s += txt(sx(q.monate) - 4, sy(manuell(q.monate)) - 8, "von Hand", "tb twa", "end");
    s += txt(sx(q.monate) - 4, sy(auto(q.monate)) + (auto(q.monate) > manuell(q.monate) ? -8 : 20), "automatisiert", "tb tak", "end");
    const diff = q.manuellMonat - q.laufendMonat;
    if (diff > 0) {
      const be = q.aufbau / diff;
      if (be <= q.monate) {
        s += `<line x1="${sx(be)}" y1="${Y0}" x2="${sx(be)}" y2="${Y0 + H}" class="g-lin" stroke-dasharray="4 4"/>` +
          `<circle cx="${sx(be)}" cy="${sy(manuell(be))}" r="6" class="g-no"/>` +
          txt(sx(be) + (be > q.monate * 0.6 ? -10 : 10), Y0 + H - 12, "Gewinnschwelle nach " + be.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Monaten", "tb", be > q.monate * 0.6 ? "end" : "start");
      }
    }
    return svg(760, 300, s, "Kumulierte Kosten von Hand und automatisiert");
  };

  /* Lernplan als Balkenplan */
  G.plan = (module, wochen) => {
    const X0 = 230, Y0 = 34, BW = 90, RH = 30;
    let s = "";
    for (let w = 1; w <= wochen; w++) {
      s += box(X0 + (w - 1) * BW, 4, BW - 4, 22, "g-fl2", 4) + txt(X0 + (w - 1) * BW + BW / 2 - 2, 20, "Woche " + w, "tm");
    }
    module.forEach((m, i) => {
      const y = Y0 + i * RH;
      s += txt(X0 - 12, y + 19, `${m.nr} · ${m.kurztitel}`, "", "end");
      s += `<line x1="${X0}" y1="${y + RH - 1}" x2="${X0 + wochen * BW}" y2="${y + RH - 1}" class="g-gitter"/>`;
      const x = X0 + (m.woche - 1) * BW + (m.versatz || 0) * BW;
      s += schritt(i + 1, box(x + 2, y + 5, BW * (m.breite || 1) - 8, RH - 10, m.nr === 9 ? "g-no" : "g-ak", 5) +
        txt(x + 10, y + 20, m.dauer, "tm " + (m.nr === 9 ? "tn" : "ti"), "start"));
    });
    return svg(X0 + wochen * BW + 10, Y0 + module.length * RH + 10, s, "Lernplan über sechs Wochen");
  };

  /* Fünf Werkzeugklassen */
  G.werkzeuge = () => {
    const klassen = [
      ["Assistenten", "Claude, ChatGPT,", "Gemini, Copilot"],
      ["Recherche", "NotebookLM, Deep", "Research, Perplexity"],
      ["KI in Software", "Rovo, Copilot in", "Teams, Miro AI"],
      ["Automatisierung", "n8n (euer Server),", "Power Automate"],
      ["Agenten", "Cowork, ChatGPT", "Agent, n8n-Agent"],
    ];
    let s = "";
    klassen.forEach((k, i) => {
      const x = 14 + i * 154;
      s += schritt(i + 1, box(x, 30, 140, 150, i === 3 ? "g-nog" : "g-akh", 10) +
        txt(x + 70, 62, k[0], "tb" + (i === 3 ? " tn" : " tak")) + txt(x + 70, 100, k[1], "t2") + txt(x + 70, 118, k[2], "t2"));
    });
    s += schritt(6, box(14, 214, 756, 60, "g-fl", 10) + txt(392, 240, "Erst fragen: Was soll erledigt werden?", "tb") +
      txt(392, 262, "Dann: Welche Klasse passt? Erst danach: welches Produkt.", "t2"));
    return svg(784, 290, s, "Fünf Klassen von KI-Werkzeugen");
  };

  /* Vier KI-Aufgaben im Workflow */
  G.aufgaben = () => {
    const a = [
      ["Einordnen", "„Export stürzt ab“", "→ Kategorie: Bug"],
      ["Zusammenfassen", "Transkript, 40 min", "→ 5 Kernpunkte"],
      ["Herausziehen", "Mail vom Stakeholder", "→ Wunsch, Frist, Prio"],
      ["Entwerfen", "Stichpunkte", "→ User Story + Kriterien"],
    ];
    let s = "";
    a.forEach((t, i) => {
      const y = 14 + i * 66;
      s += schritt(i + 1, box(20, y, 180, 54, "g-ak", 8) + txt(110, y + 33, t[0], "tb ti") +
        box(214, y, 250, 54, "g-fl", 8) + txt(339, y + 33, t[1], "") + pfeil(466, y + 27, 500, y + 27) +
        box(502, y, 268, 54, "g-akh", 8) + txt(636, y + 33, t[2], "tb tak"));
    });
    s += schritt(5, txt(395, 292, "Immer mit fester Ausgabeform (JSON) und einem Menschen an den heiklen Stellen.", "t2"));
    return svg(790, 304, s, "Vier Aufgaben, die KI in Workflows übernimmt");
  };

  /* Abschlussprojekt in zwei Mini-Sprints */
  G.abschluss = () => {
    const phasen = [
      ["Canvas", "Problem, Daten,", "Messgröße klären", "g-nog"],
      ["Sprint 1", "Walking Skeleton:", "läuft einmal durch", "g-akh"],
      ["Sprint 2", "Testsatz, Leitplanken,", "eine Woche Nutzung", "g-akh"],
      ["Review", "5 Minuten Demo,", "Zahlen, Entscheidung", "g-gut"],
    ];
    let s = "";
    phasen.forEach((p, i) => {
      const x = 20 + i * 192;
      s += schritt(i + 1, box(x, 40, 170, 110, p[3], 12) + txt(x + 85, 74, p[0], "tb" + (i === 0 ? " tn" : "")) +
        txt(x + 85, 104, p[1], "t2") + txt(x + 85, 122, p[2], "t2") + (i < 3 ? pfeil(x + 172, 95, x + 190, 95) : ""));
    });
    s += schritt(5, `<path d="M700 152 C 700 220, 105 220, 105 154" class="g-linak" stroke-dasharray="6 5" marker-end="url(#spitze)"/>` +
      txt(402, 236, "Retro: Was machst du beim nächsten KI-Projekt anders?", "t2"));
    return svg(790, 250, s, "Abschlussprojekt in zwei Mini-Sprints");
  };

  /* Marke oben links */
  G.marke = () => `<svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
      <rect x="1" y="1" width="36" height="36" rx="8" class="g-ak"/>
      <rect x="8" y="9" width="9" height="9" rx="2" class="g-no"/>
      <rect x="21" y="9" width="9" height="9" rx="2" style="fill:var(--flaeche)"/>
      <rect x="8" y="21" width="9" height="9" rx="2" style="fill:var(--flaeche)"/>
      <path d="M21 25.5 l3 3 l6-7" fill="none" style="stroke:var(--flaeche)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  window.GRAFIKEN = G;
})();
