/* KI-Werkstatt — Anwendung
   Liest window.KURS (inhalte.js) und window.GRAFIKEN (grafiken.js).

   Zwei Betriebsarten:
   - Mit Server (api.php antwortet mit JSON): Konten, Anmeldung, der
     Lernstand wird zusätzlich zentral gespeichert, Admins sehen alle
     Teilnehmenden.
   - Ohne Server (Datei geöffnet, statische Vorschau): alles bleibt im
     localStorage dieses Browsers. Jeder Zugriff ist abgesichert. */
(function () {
  "use strict";

  const K = window.KURS, G = window.GRAFIKEN;
  const SPEICHER = "ki-werkstatt-v1";
  const API = "api.php";
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- Zustand ---------- */
  const leer = () => ({ fertig: {}, quiz: {}, selbst: {}, baukasten: {}, rechner: {}, canvas: {}, name: "" });
  let Z = leer();
  let SERVER = null;          // Antwort von api.php?aktion=ich, null = ohne Server
  let speicherSchluessel = SPEICHER;
  let syncTimer = null, syncStatus = "lokal";
  const lokalLesen = (schluessel) => {
    try { const roh = localStorage.getItem(schluessel); return roh ? JSON.parse(roh) : null; } catch (e) { return null; }
  };
  // PHP gibt leere Objekte als [] zurück; ein Array würde benannte Schlüssel
  // beim Speichern stillschweigend verlieren. Darum hier normalisieren.
  const zustandSetzen = (daten) => {
    Z = Object.assign(leer(), daten && typeof daten === "object" && !Array.isArray(daten) ? daten : {});
    for (const k of ["fertig", "quiz", "selbst", "baukasten", "rechner", "canvas"]) {
      if (!Z[k] || typeof Z[k] !== "object" || Array.isArray(Z[k])) Z[k] = {};
    }
    if (typeof Z.name !== "string") Z.name = "";
  };
  zustandSetzen(lokalLesen(SPEICHER));

  async function api(aktion, daten) {
    const post = daten !== undefined;
    const antwort = await fetch(API + "?aktion=" + aktion, {
      method: post ? "POST" : "GET", credentials: "same-origin", keepalive: post && aktion === "stand",
      headers: Object.assign({ Accept: "application/json" }, post ? { "Content-Type": "application/json", "X-CSRF": SERVER ? SERVER.csrf : "" } : {}),
      body: post ? JSON.stringify(daten) : undefined,
    });
    let json = null;
    try { json = await antwort.json(); } catch (e) { /* kein JSON */ }
    if (!antwort.ok) {
      const f = new Error((json && json.fehler) || "Der Server antwortet nicht (HTTP " + antwort.status + ").");
      f.status = antwort.status; throw f;
    }
    return json || {};
  }

  const syncAnzeigen = () => {
    const el = $("#sync"); if (!el) return;
    el.textContent = { lokal: "Lernstand nur in diesem Browser", ok: "Lernstand gespeichert", wartet: "Wird gleich gespeichert …", laeuft: "Wird gespeichert …", fehler: "Nicht gespeichert, nächster Versuch läuft" }[syncStatus];
    el.dataset.status = syncStatus;
  };
  async function serverSichern() {
    if (!SERVER || !SERVER.angemeldet) return;
    clearTimeout(syncTimer); syncTimer = null;
    syncStatus = "laeuft"; syncAnzeigen();
    try { await api("stand", { stand: Z }); syncStatus = "ok"; }
    catch (e) {
      syncStatus = "fehler";
      if (e.status === 401) { SERVER.angemeldet = false; zeigeAnmeldung("Deine Anmeldung ist abgelaufen. Bitte melde dich neu an, dein Stand in diesem Browser bleibt erhalten."); return; }
      syncTimer = setTimeout(serverSichern, 15000);
    }
    syncAnzeigen();
  }
  const sichern = () => {
    try { localStorage.setItem(speicherSchluessel, JSON.stringify(Z)); } catch (e) { /* ignoriert */ }
    if (SERVER && SERVER.angemeldet) { clearTimeout(syncTimer); syncTimer = setTimeout(serverSichern, 1200); syncStatus = "wartet"; syncAnzeigen(); }
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && syncTimer) serverSichern(); });

  const modulStatus = (m, S = Z) => {
    const fertig = S.fertig || {}, quiz = S.quiz || {};
    const gesamt = m.lektionen.length, erledigt = m.lektionen.filter((l) => fertig[l.id]).length;
    const q = quiz[m.id];
    const quizOk = q && q.quote >= K.bestehen;
    if (erledigt === gesamt && quizOk) return "fertig";
    if (erledigt > 0 || q) return "laeuft";
    return "offen";
  };
  const fortschritt = (S = Z) => {
    const fertig = S.fertig || {}, quiz = S.quiz || {};
    const alle = K.module.flatMap((m) => m.lektionen);
    const l = alle.filter((x) => fertig[x.id]).length;
    const q = K.module.filter((m) => quiz[m.id] && quiz[m.id].quote >= K.bestehen).length;
    return { anteil: (l + q) / (alle.length + K.module.length), module: K.module.filter((m) => modulStatus(m, S) === "fertig").length };
  };
  const stundenGesamt = () => K.module.reduce((a, m) => a + parseFloat(m.dauer.replace(",", ".")), 0);
  const zeitLesen = (s) => (s ? new Date(String(s).replace(" ", "T") + "Z") : null);
  const zeitText = (s) => {
    const d = zeitLesen(s); if (!d || isNaN(d)) return "–";
    const tage = Math.floor((Date.now() - d) / 86400000);
    return tage <= 0 ? "heute" : tage === 1 ? "gestern" : "vor " + tage + " Tagen";
  };

  const toast = (text) => {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = text; t.setAttribute("role", "status");
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  };
  const kopieren = (text, knopf) => {
    const ok = () => toast("In die Zwischenablage kopiert");
    try {
      navigator.clipboard.writeText(text).then(ok, () => markieren(knopf));
    } catch (e) { markieren(knopf); }
  };
  const markieren = (knopf) => {
    const pre = knopf && knopf.closest(".prompt, .ausgabe") && knopf.closest(".prompt, .ausgabe").querySelector("pre");
    if (!pre) return;
    const r = document.createRange(); r.selectNodeContents(pre);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    toast("Text markiert – mit Strg+C kopieren");
  };

  /* ---------- Seitenleiste ---------- */
  function leiste(aktiv) {
    const f = fortschritt();
    const link = (hash, nr, text, meta, status) =>
      `<a class="nav-link" href="#${hash}" ${aktiv === hash ? 'aria-current="page"' : ""} ${status ? `data-status="${status}"` : ""}>
        <span class="nav-nr">${nr}</span><span>${esc(text)}</span><span class="nav-meta">${meta || ""}</span></a>`;
    $("#leiste").innerHTML = `
      <a class="marke" href="#start">${G.marke()}<div><strong>${esc(K.titel)}</strong><span>${esc(K.untertitel)}</span></div></a>
      <div class="gesamt">
        <div class="gesamt-zeile"><span>Fortschritt</span><span>${Math.round(f.anteil * 100)} % · ${f.module}/${K.module.length} Module</span></div>
        <div class="balken"><i style="width:${(f.anteil * 100).toFixed(1)}%"></i></div>
      </div>
      <nav class="nav-gruppe" aria-label="Überblick"><span class="eyebrow">Überblick</span>
        ${link("start", "◎", "Start", "")}
        ${link("plan", "▦", "Lernplan", K.wochen + " Wo.")}
      </nav>
      <nav class="nav-gruppe" aria-label="Module"><span class="eyebrow">Module</span>
        ${K.module.map((m) => link(m.id, m.nr, m.kurztitel, m.dauer, modulStatus(m))).join("")}
      </nav>
      <nav class="nav-gruppe" aria-label="Werkzeuge"><span class="eyebrow">Werkzeuge</span>
        ${link("baukasten", "✎", "Prompt-Baukasten", "")}
        ${link("prompts", "❏", "Prompt-Bibliothek", K.prompts.length)}
        ${link("rechner", "€", "Automatisierungs-Rechner", "")}
        ${link("canvas", "▣", "Use-Case-Canvas", "")}
        ${link("vorlagen", "⇩", "n8n-Vorlagen", K.vorlagen.length)}
        ${link("glossar", "Aa", "Glossar", K.glossar.length)}
        ${link("zertifikat", "★", "Zertifikat", "")}
      </nav>
      ${SERVER && SERVER.angemeldet && SERVER.benutzer.rolle === "admin" ? `<nav class="nav-gruppe" aria-label="Kursleitung"><span class="eyebrow">Kursleitung</span>
        ${link("teilnehmende", "☷", "Teilnehmende", "")}</nav>` : ""}
      <div class="leiste-fuss">
        ${SERVER && SERVER.angemeldet
          ? `<div class="konto-zeile"><strong>${esc(SERVER.benutzer.name)}</strong><span id="sync" data-status="${syncStatus}"></span>
             <span class="chips"><a class="knopf leise klein" href="#konto">Konto</a><button class="knopf leise klein" data-aktion="abmelden">Abmelden</button></span></div>`
          : `<div class="konto-zeile"><span id="sync" data-status="lokal"></span></div>`}
      </div>`;
    syncAnzeigen();
  }

  /* ---------- Seiten ---------- */
  const seiten = {};

  seiten.start = () => {
    const f = fortschritt();
    const naechstes = K.module.find((m) => modulStatus(m) !== "fertig") || K.module[K.module.length - 1];
    const spalten = { offen: [], laeuft: [], fertig: [] };
    K.module.forEach((m) => spalten[modulStatus(m)].push(m));
    const karte = (m) => `<a class="karte" href="#${m.id}" data-status="${modulStatus(m)}">
        <span class="eyebrow">Modul ${m.nr} · Woche ${m.woche} · ${m.dauer}</span><strong>${esc(m.titel)}</strong><small>${esc(m.kurz)}</small></a>`;
    const regler = [
      ["prompt", "Ich schreibe Prompts mit Kontext, Format und Beispielen"],
      ["werkzeug", "Ich habe schon einen eigenen Assistenten oder ein Projekt eingerichtet"],
      ["auto", "Ich habe schon einmal eine Automatisierung gebaut (z. B. in n8n)"],
      ["recht", "Ich weiß, welche Daten ich in welches KI-Werkzeug geben darf"],
    ];
    return `<div class="spalte breit">
      <section class="held">
        <span class="eyebrow">Selbstlernkurs · ${K.wochen} Wochen · Deutsch</span>
        <h1>Vom Chatbot zur eigenen KI-Lösung</h1>
        <p class="lead">Du nutzt KI schon im Chat. Hier lernst du, wie sie funktioniert, wie du sie in Abläufe einbaust und wie du daraus Lösungen machst, die im Team verlässlich laufen. Ohne Programmieren, mit deinem Vorwissen aus VWL, Scrum und Coaching als Rückenwind.</p>
        <div class="chips"><a class="knopf" href="#${naechstes.id}">${f.anteil > 0 ? "Weitermachen: Modul " + naechstes.nr : "Mit dem Kick-off beginnen"}</a><a class="knopf leise" href="#plan">Lernplan ansehen</a></div>
      </section>
      <div class="leiter-wrap">${G.leiter()}</div>
      <section class="block"><h2>Für wen dieser Kurs ist</h2><div class="persona">${K.persona.map((p) => `<div><h4>${esc(p.titel)}</h4><p>${esc(p.text)}</p></div>`).join("")}</div></section>
      <section class="block">
        <div class="block-kopf"><h2>Dein Kurs-Board</h2><span class="chip">${f.module} von ${K.module.length} Modulen fertig</span></div>
        <div class="board">
          <div class="board-spalte"><h3><span>Offen</span><span>${spalten.offen.length}</span></h3>${spalten.offen.map(karte).join("")}</div>
          <div class="board-spalte"><h3><span>In Arbeit</span><span>${spalten.laeuft.length}</span></h3>${spalten.laeuft.map(karte).join("")}</div>
          <div class="board-spalte"><h3><span>Fertig</span><span>${spalten.fertig.length}</span></h3>${spalten.fertig.map(karte).join("")}</div>
        </div>
      </section>
      <section class="block">
        <h2>Selbsteinschätzung</h2>
        <p style="margin:0;color:var(--tinte-2)">0 = trifft gar nicht zu, 4 = trifft voll zu. Daraus ergibt sich, wo du Schwerpunkte setzen solltest.</p>
        <div class="zwei">
          <form class="formular" id="selbst">${regler.map(([k, t]) => `<div class="feld"><label for="s-${k}">${esc(t)}</label>
            <input type="range" id="s-${k}" name="${k}" min="0" max="4" step="1" value="${Z.selbst[k] ?? 1}"></div>`).join("")}</form>
          <div class="ausgabe" id="selbst-ergebnis"></div>
        </div>
      </section>
    </div>`;
  };
  function selbstAuswerten() {
    const w = (k) => Number(Z.selbst[k] ?? 1);
    const tipps = [];
    if (w("prompt") < 3) tipps.push(["Modul 2", "m2", "Prompting und strukturierte Ausgaben gründlich durcharbeiten."]);
    if (w("werkzeug") < 2) tipps.push(["Modul 3", "m3", "Einen eigenen Assistenten einrichten, bevor du automatisierst."]);
    if (w("auto") < 2) tipps.push(["Modul 4", "m4", "Für den ersten Workflow mehr Zeit einplanen (ca. 5 h statt 4 h)."]);
    if (w("recht") < 3) tipps.push(["Modul 7", "m7", "Die Datenampel vorziehen und schon in Woche 2 lesen."]);
    const summe = ["prompt", "werkzeug", "auto", "recht"].reduce((a, k) => a + w(k), 0);
    const stufe = summe <= 5 ? "Stufe 1 · Chatbot" : summe <= 10 ? "Stufe 2 · Assistent" : "Stufe 3 · Workflow";
    $("#selbst-ergebnis").innerHTML = `<span class="eyebrow">Dein Startpunkt</span><h3>${stufe}</h3>
      ${tipps.length ? `<ul style="margin:0;padding-left:20px">${tipps.map((t) => `<li><a href="#${t[1]}">${t[0]}</a>: ${t[2]}</li>`).join("")}</ul>`
        : "<p style='margin:0'>Solide Grundlage. Du kannst zügig durch die Module 1–3 gehen und dich auf 4–6 konzentrieren.</p>"}`;
  }

  seiten.plan = () => {
    const wochen = Array.from({ length: K.wochen }, (_, i) => K.module.filter((m) => m.woche === i + 1));
    return `<div class="spalte breit">
      <div class="modul-kopf"><span class="eyebrow">Lernplan</span><h1>Sechs Wochen, zehn Module</h1>
        <p>Insgesamt rund ${stundenGesamt().toLocaleString("de-DE")} Stunden, je nach Woche 3,5 bis 7,5 Stunden. Am besten zwei feste Termine im Kalender, wie ein Sprint mit fester Kadenz. Die Wochen sind ein Vorschlag: Wer schneller ist, zieht vor.</p></div>
      <div class="plan-wrap">${G.plan(K.module, K.wochen)}</div>
      <div class="wochen">${wochen.map((ms, i) => {
        const h = ms.reduce((a, m) => a + parseFloat(m.dauer.replace(",", ".")), 0);
        return `<div class="woche"><span class="eyebrow">Woche ${i + 1}</span><span class="zeit">ca. ${h.toLocaleString("de-DE")} Stunden</span>
          <ul>${ms.map((m) => `<li><a href="#${m.id}">Modul ${m.nr}: ${esc(m.kurztitel)}</a> <span class="chip ${modulStatus(m) === "fertig" ? "fertig" : ""}">${m.dauer}</span></li>`).join("")}</ul>
          <small style="color:var(--tinte-2)">Ergebnis: ${esc(ms.map((m) => m.uebung.ergebnis).slice(-1)[0])}</small></div>`;
      }).join("")}</div>
      <section class="block"><h2>So ist jedes Modul aufgebaut</h2>
        <div class="tabelle-wrap"><table>
          <tr><th>Teil</th><th>Was du tust</th><th>Anteil</th></tr>
          <tr><td>Lernziele</td><td>Wissen, worauf es ankommt</td><td>2 min</td></tr>
          <tr><td>Lektionen mit Grafiken</td><td>Lesen, Grafiken ansehen, als erledigt abhaken</td><td>30 %</td></tr>
          <tr><td>Erklärfilm und Videos</td><td>Zusehen und zuhören, weiterführende Videos nach Lust</td><td>15 %</td></tr>
          <tr><td>Praxisübung</td><td>Mit echten Werkzeugen ausprobieren</td><td>45 %</td></tr>
          <tr><td>Wissenscheck</td><td>Kurzes Quiz, ab ${Math.round(K.bestehen * 100)} % bestanden</td><td>10 %</td></tr>
        </table></div></section>
    </div>`;
  };

  seiten.modul = (m) => {
    const i = K.module.indexOf(m), vor = K.module[i - 1], nach = K.module[i + 1];
    const q = Z.quiz[m.id];
    return `<div class="spalte">
      <div class="modul-kopf">
        <span class="eyebrow">Modul ${m.nr} · Woche ${m.woche} · ${m.dauer}</span>
        <h1>${esc(m.titel)}</h1><p>${esc(m.kurz)}</p>
        <div class="chips"><span class="chip ${modulStatus(m) === "fertig" ? "fertig" : "akzent"}">${{ offen: "Offen", laeuft: "In Arbeit", fertig: "Fertig" }[modulStatus(m)]}</span>
          <span class="chip">${m.lektionen.filter((l) => Z.fertig[l.id]).length}/${m.lektionen.length} Lektionen</span>
          <span class="chip">${q ? "Quiz " + Math.round(q.quote * 100) + " %" : "Quiz offen"}</span></div>
      </div>
      <div class="ziele"><span class="eyebrow">Nach diesem Modul</span><ul>${m.ziele.map((z) => `<li>${esc(z)}</li>`).join("")}</ul></div>
      <section class="block"><h2>Lektionen</h2>
        ${m.lektionen.map((l, n) => `<details class="lektion" data-id="${l.id}" data-fertig="${Z.fertig[l.id] ? "ja" : "nein"}" ${n === 0 && !Z.fertig[l.id] ? "open" : ""}>
          <summary><span class="haken" aria-hidden="true">✓</span><h3>${esc(l.titel)}</h3><span class="pfeil" aria-hidden="true">▸</span></summary>
          <div class="lektion-inhalt">${l.html}
            <div class="lektion-fuss"><button class="knopf ${Z.fertig[l.id] ? "leise" : ""} klein" data-lektion="${l.id}">${Z.fertig[l.id] ? "Als offen markieren" : "Als erledigt abhaken"}</button></div>
          </div></details>`).join("")}
      </section>
      ${m.film ? `<section class="block"><h2>${esc(m.film.titel)}</h2>
        <video class="filmvideo" controls preload="none" playsinline poster="filme/${m.id}.jpg" src="filme/${m.id}.mp4">
          <track kind="captions" srclang="de" label="Deutsch" src="filme/${m.id}.vtt">
          Dein Browser kann das Video nicht abspielen. Nutze die Schritt-für-Schritt-Fassung darunter.</video>
        <details class="film-details"><summary>Schritt für Schritt ansehen (mit Stimme deines Browsers)</summary>${filmHtml(m)}</details></section>` : ""}
      ${m.videos.length ? `<section class="block"><div class="block-kopf"><h2>Zum Weiterlernen</h2><span class="chip">meist Englisch, freiwillig</span></div><div class="videos">${m.videos.map((v) => `
        <a class="video" href="${esc(v.url)}" target="_blank" rel="noopener">
          <span class="play" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M5 3 L15 9 L5 15 z" style="fill:currentColor"/></svg></span>
          <span><strong>${esc(v.titel)}</strong><small>${esc(v.quelle)} · ${esc(v.dauer)}</small><small>${esc(v.warum)}</small></span></a>`).join("")}
        </div></section>` : ""}
      <section class="uebung"><span class="eyebrow">Praxisübung</span><h2>${esc(m.uebung.titel)}</h2>
        <ol>${m.uebung.schritte.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        <p><b>Ergebnis:</b> ${esc(m.uebung.ergebnis)}</p></section>
      <section class="block"><div class="block-kopf"><h2>Wissenscheck</h2><span class="chip">ab ${Math.round(K.bestehen * 100)} % bestanden</span></div>
        <div class="quiz" data-modul="${m.id}">${m.quiz.map((f, n) => `<div class="frage" data-n="${n}"><p>${n + 1}. ${esc(f.frage)}</p>
          <div class="antworten">${f.antworten.map((a, k) => `<button class="antwort" data-k="${k}">${esc(a)}</button>`).join("")}</div>
          <p class="erklaerung" hidden></p></div>`).join("")}
          <div class="quiz-ergebnis" hidden></div></div></section>
      <div class="weiter">${vor ? `<a class="knopf leise" href="#${vor.id}">← Modul ${vor.nr}</a>` : "<span></span>"}
        ${nach ? `<a class="knopf" href="#${nach.id}">Modul ${nach.nr}: ${esc(nach.kurztitel)} →</a>` : `<a class="knopf" href="#zertifikat">Zum Zertifikat →</a>`}</div>
    </div>`;
  };

  /* ---------- Erklärfilm ---------- */
  function filmHtml(m) {
    return `<div class="film" data-modul="${m.id}">
      <div class="film-buehne">${G[m.film.grafik]()}</div>
      <div class="film-text" aria-live="polite">Drück auf „Abspielen“. Der Film zeigt die Grafik Schritt für Schritt und liest den Text vor (Ton einschalten). Mit „Ton aus“ läuft er als Stummfilm mit Untertitel.</div>
      <div class="film-leiste">
        <button class="knopf klein" data-film="play">▶ Abspielen</button>
        <button class="knopf leise klein" data-film="zurueck" aria-label="Szene zurück">◀</button>
        <button class="knopf leise klein" data-film="vor" aria-label="Nächste Szene">▶▶</button>
        <button class="knopf leise klein" data-film="ton" aria-pressed="true">Ton an</button>
        <span class="film-zeit"></span>
        <div class="film-punkte">${m.film.szenen.map((_, i) => `<button data-film-szene="${i}" aria-label="Szene ${i + 1}"></button>`).join("")}</div>
      </div></div>`;
  }
  let film = null;
  function filmStopp() {
    if (!film) return;
    clearTimeout(film.timer);
    try { speechSynthesis.cancel(); } catch (e) { /* keine Sprachausgabe */ }
    film.laeuft = false;
    const b = film.el.querySelector('[data-film="play"]'); if (b) b.textContent = "▶ Abspielen";
  }
  function filmZeige(el, m, i, weiter) {
    if (!film || film.el !== el) { filmStopp(); film = { el, m, i: 0, laeuft: false, ton: true, timer: null }; }
    const sz = m.film.szenen;
    film.i = Math.max(0, Math.min(sz.length - 1, i));
    const s = sz[film.i];
    const buehne = el.querySelector(".film-buehne");
    buehne.classList.toggle("aktiv", s.schritt > 0);
    buehne.querySelectorAll("[data-schritt]").forEach((g) => g.classList.toggle("an", Number(g.dataset.schritt) === s.schritt));
    el.querySelector(".film-text").textContent = s.text;
    el.querySelector(".film-zeit").textContent = `Szene ${film.i + 1} / ${sz.length}`;
    el.querySelectorAll("[data-film-szene]").forEach((p, k) => p.classList.toggle("an", k === film.i));
    if (!weiter) return;
    const naechste = () => {
      if (!film.laeuft) return;
      if (film.i < sz.length - 1) filmZeige(el, m, film.i + 1, true);
      else { filmStopp(); buehne.classList.remove("aktiv"); }
    };
    let gesprochen = false;
    if (film.ton && "speechSynthesis" in window) {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(s.text);
        u.lang = "de-DE"; u.rate = 1.0;
        const stimme = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith("de"));
        if (stimme) u.voice = stimme;
        u.onend = () => { film.timer = setTimeout(naechste, 700); };
        speechSynthesis.speak(u);
        gesprochen = true;
      } catch (e) { gesprochen = false; }
    }
    if (!gesprochen) film.timer = setTimeout(naechste, 1800 + s.text.length * 55);
  }

  /* ---------- Werkzeuge ---------- */
  const BAUSTEINE = [
    ["rolle", "Rolle", "Aus welcher Perspektive soll die KI arbeiten?", "Du bist ein erfahrener Agile Coach für Teams in einem mittelständischen Softwareunternehmen."],
    ["ziel", "Ziel", "Was soll am Ende herauskommen, und wofür?", "Bereite mir die Retrospektive für Sprint 14 vor, damit wir das drängendste Thema bearbeiten."],
    ["kontext", "Kontext", "Hintergrund, Zielgruppe, Material", "Team aus 7 Personen, zwei neue Kolleginnen, das letzte Release war stressig. Das anonyme Feedback steht unten."],
    ["format", "Format", "Aufbau, Länge, Sprache", "Top-3-Themen als Tabelle (Thema | Häufigkeit | Zitat), danach zwei Retro-Formate mit Ablauf für 60 Minuten."],
    ["beispiel", "Beispiel", "Ein Muster für ein gutes Ergebnis (optional)", "Ein gutes Experiment klingt so: „Zwei Wochen lang WIP-Limit 3 in der Spalte Review, danach Auswertung im Daily.“"],
    ["grenzen", "Grenzen", "Was darf nicht passieren, wann nachfragen?", "Keine Rückschlüsse auf einzelne Personen. Wenn das Feedback zu dünn ist, sag es und frag nach."],
  ];
  seiten.baukasten = () => `<div class="spalte breit">
    <div class="modul-kopf"><span class="eyebrow">Werkzeug · Modul 2</span><h1>Prompt-Baukasten</h1>
      <p>Fülle die sechs Bausteine aus. Rechts entsteht der fertige Prompt zum Kopieren. Die Beispieltexte zeigen, wie es aussehen kann. Überschreibe sie mit deiner Aufgabe.</p></div>
    <div class="zwei">
      <form class="formular" id="baukasten">${BAUSTEINE.map(([k, t, h, bsp]) => `<div class="feld"><label for="b-${k}">${t}</label><small>${h}</small>
        <textarea id="b-${k}" name="${k}">${esc(Z.baukasten[k] ?? bsp)}</textarea></div>`).join("")}
        <div class="chips"><button type="button" class="knopf leise klein" data-aktion="baukasten-leeren">Alle Felder leeren</button>
        <button type="button" class="knopf leise klein" data-aktion="baukasten-beispiel">Beispiel wiederherstellen</button></div></form>
      <div class="ausgabe" style="position:sticky;top:16px"><div class="block-kopf"><h3>Dein Prompt</h3><button class="knopf klein" data-aktion="baukasten-kopieren">Kopieren</button></div>
        <pre id="baukasten-ausgabe"></pre><small id="baukasten-hinweis" style="color:var(--tinte-2)"></small></div>
    </div></div>`;
  function baukastenText() {
    const f = (k) => (Z.baukasten[k] ?? BAUSTEINE.find((b) => b[0] === k)[3]).trim();
    const teile = [];
    if (f("rolle")) teile.push(f("rolle"));
    if (f("ziel")) teile.push("Ziel: " + f("ziel"));
    if (f("kontext")) teile.push("Kontext: " + f("kontext"));
    if (f("format")) teile.push("Format: " + f("format"));
    if (f("beispiel")) teile.push("Beispiel: " + f("beispiel"));
    if (f("grenzen")) teile.push("Grenzen: " + f("grenzen"));
    const leer = BAUSTEINE.filter(([k]) => !f(k)).map((b) => b[1]);
    $("#baukasten-ausgabe").textContent = teile.join("\n\n") || "Noch leer.";
    $("#baukasten-hinweis").textContent = leer.length ? "Noch leer: " + leer.join(", ") + (leer.includes("Ziel") || leer.includes("Kontext") ? ". Ziel und Kontext sind die wichtigsten Bausteine." : ".") : "Alle sechs Bausteine gesetzt.";
  }

  seiten.prompts = () => {
    const kats = [...new Set(K.prompts.map((p) => p.kat))];
    return `<div class="spalte breit">
      <div class="modul-kopf"><span class="eyebrow">Werkzeug</span><h1>Prompt-Bibliothek</h1>
        <p>Erprobte Vorlagen für den agilen Alltag. Platzhalter in {GESCHWEIFTEN KLAMMERN} ersetzt du durch deine Inhalte. Die JSON-Vorlagen sind für Workflows gedacht (Modul 5).</p></div>
      <div class="filter" id="prompt-filter"><button class="chip" aria-pressed="true" data-kat="">Alle</button>${kats.map((k) => `<button class="chip" aria-pressed="false" data-kat="${esc(k)}">${esc(k)}</button>`).join("")}</div>
      <div class="prompts">${K.prompts.map((p, i) => `<div class="prompt" data-kat="${esc(p.kat)}">
        <div class="prompt-kopf"><div><span class="eyebrow">${esc(p.kat)}</span><h3>${esc(p.titel)}</h3></div><button class="knopf klein" data-kopiere="${i}">Kopieren</button></div>
        <pre>${esc(p.text)}</pre></div>`).join("")}</div></div>`;
  };

  const RECHNER = [
    ["minuten", "Minuten pro Durchlauf von Hand", 30, 1],
    ["haeufigkeit", "Durchläufe pro Monat", 8, 1],
    ["satz", "Stundensatz in € (Vollkosten)", 75, 1],
    ["aufbauStunden", "Aufbau in Stunden (inkl. Lernen, Testen)", 20, 1],
    ["restMinuten", "Minuten Restarbeit pro Durchlauf (Prüfen)", 5, 1],
    ["werkzeug", "Werkzeug- und Tokenkosten pro Monat in €", 30, 1],
    ["pflege", "Pflege in Stunden pro Monat", 0.5, 0.5],
    ["monate", "Betrachtungszeitraum in Monaten", 12, 1],
  ];
  seiten.rechner = () => `<div class="spalte breit">
    <div class="modul-kopf"><span class="eyebrow">Werkzeug · Modul 8</span><h1>Automatisierungs-Rechner</h1>
      <p>Lohnt sich die Automatisierung? Trag ehrliche Werte ein, auch für Prüfen und Pflege. Die Voreinstellung ist ein Beispiel: die Retro-Vorbereitung, zweimal im Monat für vier Teams.</p></div>
    <div class="zwei">
      <form class="formular" id="rechner">${RECHNER.map(([k, t, v, st]) => `<div class="feld"><label for="r-${k}">${t}</label>
        <input type="number" id="r-${k}" name="${k}" min="0" step="${st}" value="${Z.rechner[k] ?? v}"></div>`).join("")}</form>
      <div class="ausgabe" style="position:sticky;top:16px"><div class="kennzahlen" id="rechner-zahlen"></div><p id="rechner-satz" style="margin:0"></p></div>
    </div>
    <section class="block"><h2>Kumulierte Kosten im Zeitverlauf</h2><div class="rechner-grafik" id="rechner-grafik"></div></section></div>`;
  function rechnerAuswerten() {
    const w = (k) => Math.max(0, Number(Z.rechner[k] ?? RECHNER.find((r) => r[0] === k)[2]) || 0);
    const manuellMonat = w("minuten") / 60 * w("haeufigkeit") * w("satz");
    const laufendMonat = w("restMinuten") / 60 * w("haeufigkeit") * w("satz") + w("werkzeug") + w("pflege") * w("satz");
    const aufbau = w("aufbauStunden") * w("satz");
    const monate = Math.max(1, Math.min(60, Math.round(w("monate"))));
    const ersparnis = manuellMonat * monate - (aufbau + laufendMonat * monate);
    const stunden = (w("minuten") - w("restMinuten")) / 60 * w("haeufigkeit") * monate - w("aufbauStunden") - w("pflege") * monate;
    const diff = manuellMonat - laufendMonat;
    const be = diff > 0 ? aufbau / diff : Infinity;
    const eur = (x) => Math.round(x).toLocaleString("de-DE") + " €";
    $("#rechner-zahlen").innerHTML = `
      <div class="kennzahl"><b>${eur(manuellMonat)}</b><span>kostet es heute pro Monat</span></div>
      <div class="kennzahl"><b>${eur(laufendMonat)}</b><span>kostet es automatisiert pro Monat</span></div>
      <div class="kennzahl"><b>${isFinite(be) ? be.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Mon." : "nie"}</b><span>bis zur Gewinnschwelle</span></div>
      <div class="kennzahl"><b style="color:${ersparnis >= 0 ? "var(--gut)" : "var(--warn)"}">${eur(ersparnis)}</b><span>Saldo nach ${monate} Monaten</span></div>`;
    $("#rechner-grafik").innerHTML = G.breakEven({ manuellMonat, aufbau, laufendMonat, monate });
    $("#rechner-satz").innerHTML = ersparnis >= 0
      ? `Nach ${monate} Monaten gewinnst du rund <b>${Math.round(stunden).toLocaleString("de-DE")} Stunden</b>. Entscheide vorher, wofür du sie nutzt, sonst verpufft der Effekt (Jevons-Paradox).`
      : `Im gewählten Zeitraum rechnet es sich nicht. Prüfe, ob der Ablauf häufiger vorkommt, der Aufbau kleiner geht oder ob der Nutzen eher in Qualität liegt als in Zeit.`;
  }

  const CANVAS = [
    ["titel", "Name der Lösung", "Retro-Radar", "text"],
    ["problem", "Problem (mit Zahl)", "Die Vorbereitung jeder Retro kostet mich 60 Minuten, weil ich Feedback aus drei Kanälen zusammensuche.", "area"],
    ["nutzer", "Wer profitiert?", "Ich als Scrum Master, indirekt das Team durch fokussiertere Retros.", "area"],
    ["ausloeser", "Auslöser", "Neue Formularantwort; zusätzlich am Retro-Tag 8 Uhr.", "text"],
    ["schritte", "Ablauf in Schritten", "1. Formular → 2. KI ordnet ein (JSON) → 3. Tabelle → 4. Zusammenfassung → 5. Nachricht an mich", "area"],
    ["daten", "Welche Daten, welche Ampelstufe?", "Anonymes Feedback, keine Namen: gelb. Firmen-KI mit AVV.", "area"],
    ["mensch", "Wo prüft ein Mensch?", "Ich lese die Zusammenfassung vor der Retro. Unsichere Einordnungen markiert.", "area"],
    ["messung", "Woran messen wir Erfolg?", "Vorbereitungszeit unter 20 Minuten; Trefferquote ≥ 85 % im Testsatz.", "area"],
    ["nutzen", "Nutzen (0–10)", "7", "zahl"],
    ["risiko", "Risiko (0–10)", "3", "zahl"],
  ];
  seiten.canvas = () => `<div class="spalte breit">
    <div class="modul-kopf"><span class="eyebrow">Werkzeug · Modul 8 und 9</span><h1>Use-Case-Canvas</h1>
      <p>Beschreibe dein Abschlussprojekt auf einer Seite. Vorausgefüllt ist das Beispiel „Retro-Radar“. Deine Eingaben bleiben in diesem Browser gespeichert.</p></div>
    <div class="zwei">
      <form class="formular" id="canvas">${CANVAS.map(([k, t, bsp, typ]) => `<div class="feld"><label for="c-${k}">${t}</label>${typ === "area"
        ? `<textarea id="c-${k}" name="${k}">${esc(Z.canvas[k] ?? bsp)}</textarea>`
        : `<input type="${typ === "zahl" ? "number" : "text"}" ${typ === "zahl" ? 'min="0" max="10"' : ""} id="c-${k}" name="${k}" value="${esc(Z.canvas[k] ?? bsp)}">`}</div>`).join("")}</form>
      <div class="ausgabe" style="position:sticky;top:16px"><h3>Einordnung</h3><div id="canvas-matrix" style="overflow-x:auto"></div>
        <p id="canvas-satz" style="margin:0"></p>
        <div class="block-kopf"><span class="eyebrow">Als Text für Dokument oder Ticket</span><button class="knopf klein" data-aktion="canvas-kopieren">Kopieren</button></div>
        <pre id="canvas-text" style="max-height:220px"></pre></div>
    </div></div>`;
  function canvasAuswerten() {
    const w = (k) => (Z.canvas[k] ?? CANVAS.find((c) => c[0] === k)[2]);
    const n = Math.max(0, Math.min(10, Number(w("nutzen")) || 0)), r = Math.max(0, Math.min(10, Number(w("risiko")) || 0));
    $("#canvas-matrix").innerHTML = G.matrix([[w("titel") || "Mein Use Case", n, r]]);
    const feld = n >= 5 ? (r <= 5 ? ["Zuerst machen", "Hoher Nutzen bei geringem Risiko: guter Kandidat für das Abschlussprojekt."] : ["Nur mit Leitplanken", "Plane Freigaben durch Menschen und kläre die Daten vorab mit der Datenschutzstelle."])
      : (r <= 5 ? ["Klein halten", "Gut als Lernprojekt. Prüfe, ob es einen Kandidaten mit mehr Nutzen gibt."] : ["Lassen", "Viel Risiko für wenig Nutzen. Such dir einen anderen Kandidaten."]);
    $("#canvas-satz").innerHTML = `<b>${feld[0]}:</b> ${feld[1]}`;
    $("#canvas-text").textContent = CANVAS.map(([k, t]) => `${t}: ${w(k)}`).join("\n");
  }

  seiten.glossar = () => `<div class="spalte">
    <div class="modul-kopf"><span class="eyebrow">Nachschlagen</span><h1>Glossar</h1><p>Die wichtigsten Begriffe aus dem Kurs, kurz erklärt.</p></div>
    <input type="search" id="glossar-suche" placeholder="Begriff suchen, z. B. Token" aria-label="Glossar durchsuchen">
    <dl class="glossar" id="glossar-liste">${K.glossar.map(([b, d]) => `<div data-such="${esc((b + " " + d).toLowerCase())}"><dt>${esc(b)}</dt><dd>${esc(d)}</dd></div>`).join("")}</dl></div>`;

  seiten.zertifikat = () => {
    const f = fortschritt(), alle = f.module === K.module.length;
    const offen = K.module.filter((m) => modulStatus(m) !== "fertig");
    const heute = new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
    return `<div class="spalte">
      <div class="modul-kopf"><span class="eyebrow">Abschluss</span><h1>Teilnahmebestätigung</h1>
        <p>${alle ? "Glückwunsch, alle Module sind abgeschlossen. Mach einen Screenshot als Nachweis für die KI-Kompetenz nach Artikel 4 EU AI Act." : `Das Zertifikat schaltet sich frei, wenn alle Module fertig sind (Lektionen abgehakt, Quiz ab ${Math.round(K.bestehen * 100)} %). Noch offen: ${offen.map((m) => `<a href="#${m.id}">Modul ${m.nr}</a>`).join(", ")}.`}</p></div>
      <div class="feld"><label for="z-name">Name auf dem Zertifikat</label><input type="text" id="z-name" value="${esc(Z.name)}" placeholder="Vor- und Nachname"></div>
      <div class="zertifikat ${alle ? "" : "gesperrt"}">
        ${G.marke()}<span class="eyebrow">${esc(K.titel)} · Selbstlernkurs</span>
        <h2>Vom Chatbot zur eigenen KI-Lösung</h2>
        <p style="margin:0">Hiermit wird bestätigt, dass</p>
        <div class="name" id="z-anzeige">${esc(Z.name || "Dein Name")}</div>
        <p style="margin:0;max-width:52ch">alle zehn Module mit Praxisübungen und Wissenschecks abgeschlossen hat: Funktionsweise von Sprachmodellen, Prompting und Kontext, Werkzeugauswahl, Automatisierung ohne Code, KI in Workflows, RAG und Agenten, Datenschutz und EU AI Act, Business Case und Einführung sowie ein eigenes Abschlussprojekt. Umfang ca. ${stundenGesamt().toLocaleString("de-DE")} Stunden.</p>
        <p class="eyebrow" style="margin:0">${alle ? heute : "noch nicht freigeschaltet"}</p>
      </div></div>`;
  };

  seiten.vorlagen = () => `<div class="spalte">
    <div class="modul-kopf"><span class="eyebrow">Werkzeug · Module 4 bis 6</span><h1>n8n-Vorlagen</h1>
      <p>Fertige Workflows für euren n8n-Server. In n8n: neuer Workflow → Menü „…“ oben rechts → „Import from File“. Jede Vorlage enthält eine gelbe Notiz mit den drei, vier Handgriffen nach dem Import (Credential wählen, Empfänger eintragen, Tabelle verbinden).</p></div>
    <div class="prompts">${K.vorlagen.map((v) => {
      const m = K.module.find((x) => x.id === v.modul);
      return `<div class="prompt"><div class="prompt-kopf"><div><span class="eyebrow">Modul ${m.nr} · ${esc(m.kurztitel)}</span><h3>${esc(v.titel)}</h3></div>
        <a class="knopf klein" href="${esc(v.datei)}" download>Herunterladen</a></div><p style="margin:0">${esc(v.text)}</p></div>`;
    }).join("")}</div>
    <div class="achtung"><strong>Vor dem ersten echten Einsatz</strong><p>Die Vorlagen nutzen Knoten ab n8n 1.x und den Data-Table-Knoten neuerer Versionen. Kennt euer Server einen Knoten nicht, ersetze ihn durch Google Sheets oder Excel. Teste jeden Workflow mit Beispieldaten, bevor echte Teamdaten hindurchlaufen.</p></div>
  </div>`;

  seiten.konto = () => {
    if (!SERVER || !SERVER.angemeldet) return `<div class="spalte"><h1>Konto</h1><p>Der Kurs läuft gerade ohne Server. Dein Lernstand liegt nur in diesem Browser.</p></div>`;
    const b = SERVER.benutzer;
    return `<div class="spalte">
      <div class="modul-kopf"><span class="eyebrow">Konto</span><h1>${esc(b.name)}</h1><p>${esc(b.email)} · ${b.rolle === "admin" ? "Kursleitung" : "Teilnehmer*in"}</p></div>
      ${b.wechselNoetig ? `<div class="achtung"><strong>Neues Passwort nötig</strong><p>Dein Passwort wurde zurückgesetzt. Bitte vergib jetzt ein eigenes.</p></div>` : ""}
      <form class="formular ausgabe" id="pw-form" style="max-width:460px">
        <h3>Passwort ändern</h3>
        <div class="feld"><label for="pw-alt">Bisheriges Passwort</label><input type="password" id="pw-alt" autocomplete="current-password" required></div>
        <div class="feld"><label for="pw-neu">Neues Passwort</label><small>mindestens 10 Zeichen</small><input type="password" id="pw-neu" autocomplete="new-password" minlength="10" required></div>
        <p class="formular-meldung" id="pw-meldung" role="status"></p>
        <div><button class="knopf" type="submit">Passwort speichern</button></div>
      </form></div>`;
  };

  let uebersicht = null;
  seiten.teilnehmende = () => {
    if (!SERVER || !SERVER.angemeldet || SERVER.benutzer.rolle !== "admin") return `<div class="spalte"><h1>Nur für die Kursleitung</h1></div>`;
    return `<div class="spalte breit">
      <div class="modul-kopf"><span class="eyebrow">Kursleitung</span><h1>Teilnehmende</h1>
        <p>Lernstand aller Konten, wie er zuletzt gespeichert wurde. Die Daten kommen aus den Häkchen und Quizergebnissen der Teilnehmenden.</p></div>
      <div id="tn-inhalt"><p>Wird geladen …</p></div></div>`;
  };
  async function teilnehmendeLaden() {
    const ziel = $("#tn-inhalt"); if (!ziel) return;
    try { uebersicht = await api("admin_uebersicht", {}); }
    catch (e) { ziel.innerHTML = `<div class="achtung"><strong>Fehler</strong><p>${esc(e.message)}</p></div>`; return; }
    const lerner = uebersicht.teilnehmende.filter((t) => t.rolle !== "admin");
    const f = (t) => fortschritt(t.stand || {});
    const schnitt = lerner.length ? lerner.reduce((a, t) => a + f(t).anteil, 0) / lerner.length : 0;
    const aktiv7 = lerner.filter((t) => { const d = zeitLesen(t.aktualisiertAm || t.letzteAnmeldung); return d && Date.now() - d < 7 * 86400000; }).length;
    const fertigAlle = lerner.filter((t) => f(t).module === K.module.length).length;
    const jeModul = K.module.map((m) => ({ m, n: lerner.filter((t) => modulStatus(m, t.stand || {}) === "fertig").length }));
    const aktuell = (t) => { const m = K.module.find((x) => modulStatus(x, t.stand || {}) !== "fertig"); return m ? "Modul " + m.nr : "fertig"; };
    ziel.innerHTML = `
      <div class="kennzahlen">
        <div class="kennzahl"><b>${lerner.length}</b><span>Teilnehmende</span></div>
        <div class="kennzahl"><b>${Math.round(schnitt * 100)} %</b><span>Fortschritt im Schnitt</span></div>
        <div class="kennzahl"><b>${aktiv7}</b><span>aktiv in den letzten 7 Tagen</span></div>
        <div class="kennzahl"><b>${fertigAlle}</b><span>Kurs abgeschlossen</span></div>
      </div>
      <section class="block"><h2>Module abgeschlossen</h2>
        <div class="modulbalken">${jeModul.map(({ m, n }) => `<div><span>${m.nr} · ${esc(m.kurztitel)}</span>
          <div class="balken"><i style="width:${lerner.length ? (n / lerner.length * 100).toFixed(1) : 0}%"></i></div><span class="tab">${n}/${lerner.length}</span></div>`).join("")}</div></section>
      <section class="block"><h2>Konten</h2><div class="tabelle-wrap"><table class="tn-tabelle">
        <tr><th>Name</th><th>Fortschritt</th><th>Steht bei</th><th>Zuletzt aktiv</th><th>Aktionen</th></tr>
        ${uebersicht.teilnehmende.map((t) => {
          const x = f(t);
          return `<tr class="${t.aktiv ? "" : "inaktiv"}"><td><strong>${esc(t.name)}</strong>${t.rolle === "admin" ? ' <span class="chip">Kursleitung</span>' : ""}<br><small>${esc(t.email)}</small>${t.aktiv ? "" : ' <span class="chip">gesperrt</span>'}</td>
            <td style="min-width:150px"><div class="balken"><i style="width:${(x.anteil * 100).toFixed(1)}%"></i></div><small>${Math.round(x.anteil * 100)} % · ${x.module}/${K.module.length} Module</small></td>
            <td>${t.rolle === "admin" ? "–" : aktuell(t)}</td><td>${zeitText(t.aktualisiertAm || t.letzteAnmeldung)}</td>
            <td>${t.id === SERVER.benutzer.id ? "" : `<div class="chips" data-konto="${t.id}">
              <button class="knopf leise klein" data-admin="passwort">Passwort zurücksetzen</button>
              <button class="knopf leise klein" data-admin="${t.aktiv ? "sperren" : "entsperren"}">${t.aktiv ? "Sperren" : "Entsperren"}</button>
              <button class="knopf leise klein" data-admin="loeschen">Löschen</button></div><div class="admin-meldung" id="am-${t.id}"></div>`}</td></tr>`;
        }).join("")}</table></div></section>
      <section class="block"><h2>Einladungen</h2>
        ${uebersicht.einladungscode ? `<p style="margin:0">Gemeinsamer Code für alle: <code class="gross">${esc(uebersicht.einladungscode)}</code>. Neue Teilnehmende öffnen die Kursadresse, wählen „Konto anlegen“ und geben den Code ein.</p>` : "<p style=\"margin:0\">Es gibt keinen gemeinsamen Code. Neue Teilnehmende brauchen einen Einmalcode.</p>"}
        <form class="filter" id="einladung-form"><input type="text" id="einladung-bemerkung" placeholder="Für wen? (z. B. Team Blau)" style="max-width:280px" aria-label="Bemerkung zum Einmalcode">
          <button class="knopf klein" type="submit">Einmalcode erzeugen</button></form>
        ${uebersicht.einladungen.length ? `<div class="tabelle-wrap"><table><tr><th>Code</th><th>Für</th><th>Erstellt</th><th>Eingelöst von</th></tr>
          ${uebersicht.einladungen.map((e) => `<tr><td><code>${esc(e.code)}</code></td><td>${esc(e.bemerkung)}</td><td>${zeitText(e.erstellt_am)}</td><td>${e.verbraucht_am ? esc(e.verbraucht_von || "gelöschtes Konto") : "noch offen"}</td></tr>`).join("")}</table></div>` : ""}
      </section>`;
  }

  /* ---------- Anmeldung ---------- */
  function zeigeAnmeldung(hinweis, modus) {
    document.body.classList.add("ohne-leiste");
    const reg = modus === "registrieren";
    $("#leiste").innerHTML = "";
    $("#inhalt").innerHTML = `<div class="anmeldung">
      <div class="marke">${G.marke()}<div><strong>${esc(K.titel)}</strong><span>${esc(K.untertitel)}</span></div></div>
      <div class="leiter-wrap">${G.leiter()}</div>
      <div class="reiter" role="tablist">
        <button role="tab" aria-selected="${!reg}" data-aktion="zu-anmelden">Anmelden</button>
        <button role="tab" aria-selected="${reg}" data-aktion="zu-registrieren">Konto anlegen</button></div>
      ${hinweis ? `<div class="notiz"><p>${esc(hinweis)}</p></div>` : ""}
      <form class="formular" id="${reg ? "reg-form" : "login-form"}">
        ${reg ? `<div class="feld"><label for="f-code">Einladungscode</label><small>bekommst du von der Kursleitung</small><input type="text" id="f-code" autocomplete="off" required style="text-transform:uppercase"></div>
                 <div class="feld"><label for="f-name">Dein Name</label><small>erscheint auf der Teilnahmebestätigung</small><input type="text" id="f-name" autocomplete="name" required></div>` : ""}
        <div class="feld"><label for="f-email">E-Mail</label><input type="email" id="f-email" autocomplete="email" required></div>
        <div class="feld"><label for="f-pw">Passwort</label>${reg ? "<small>mindestens 10 Zeichen</small>" : ""}<input type="password" id="f-pw" autocomplete="${reg ? "new-password" : "current-password"}" ${reg ? 'minlength="10"' : ""} required></div>
        <p class="formular-meldung" id="f-meldung" role="alert"></p>
        <button class="knopf" type="submit">${reg ? "Konto anlegen und loslegen" : "Anmelden"}</button>
        ${reg ? "" : "<small style=\"color:var(--tinte-2)\">Passwort vergessen? Die Kursleitung kann es zurücksetzen.</small>"}
      </form></div>`;
  }
  async function nachAnmeldung() {
    SERVER = await api("ich");
    speicherSchluessel = SPEICHER + ":" + SERVER.benutzer.id;
    const lokal = lokalLesen(speicherSchluessel) || lokalLesen(SPEICHER);
    if (SERVER.stand) zustandSetzen(SERVER.stand);
    else { zustandSetzen(lokal); await serverSichern(); }
    if (!Z.name) Z.name = SERVER.benutzer.name;
    try { localStorage.setItem(speicherSchluessel, JSON.stringify(Z)); } catch (e) { /* - */ }
    syncStatus = "ok";
    document.body.classList.remove("ohne-leiste");
    if (SERVER.benutzer.wechselNoetig) location.hash = "#konto";
    zeige();
  }

  /* ---------- Filmbild für die MP4-Erzeugung (werkzeuge/filme-rendern.mjs) ---------- */
  function filmbild(modulId, n) {
    const m = K.module.find((x) => x.id === modulId);
    const szenen = [{ schritt: -1, text: `Modul ${m.nr}: ${m.titel}` }].concat(m.film.szenen);
    const s = szenen[n];
    document.documentElement.setAttribute("data-theme", "light");
    document.body.className = "filmbild";
    document.body.innerHTML = s.schritt === -1
      ? `<div class="fb-titel">${G.marke()}<span class="eyebrow">${esc(K.titel)} · Erklärfilm</span><h1>${esc(m.film.titel.replace(/^Erklärfilm:\s*/, ""))}</h1><p>Modul ${m.nr} · ${esc(m.titel)}</p></div>`
      : `<div class="fb-kopf"><span>${G.marke()}<b>${esc(K.titel)}</b></span><span>Modul ${m.nr} · ${esc(m.kurztitel)}</span></div>
         <div class="fb-buehne film-buehne ${s.schritt > 0 ? "aktiv" : ""}">${G[m.film.grafik]()}</div>
         <div class="fb-text">${esc(s.text)}</div>`;
    document.querySelectorAll("[data-schritt]").forEach((g) => g.classList.toggle("an", Number(g.dataset.schritt) === s.schritt));
    window.FILM = { szenen: szenen.map((x) => x.text), anzahl: szenen.length };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { document.body.dataset.fertig = "ja"; });
  }

  /* ---------- Router ---------- */
  function zeige() {
    const hash = (location.hash || "#start").slice(1);
    const m = K.module.find((x) => x.id === hash);
    const eigene = hash !== "modul" && seiten[hash];
    const seite = m ? seiten.modul(m) : (eigene || seiten.start)();
    filmStopp(); film = null;
    $("#inhalt").innerHTML = seite;
    leiste(m ? m.id : eigene ? hash : "start");
    $("#inhalt").querySelectorAll("figure.grafik[data-grafik]").forEach((f) => {
      const fn = G[f.dataset.grafik];
      if (fn) f.insertAdjacentHTML("afterbegin", fn());
    });
    if (!m && (hash === "start" || !eigene)) selbstAuswerten();
    if (hash === "baukasten") baukastenText();
    if (hash === "rechner") rechnerAuswerten();
    if (hash === "canvas") canvasAuswerten();
    if (hash === "teilnehmende") teilnehmendeLaden();
    if (m) quizWiederherstellen(m);
    document.body.classList.remove("menue-offen");
    window.scrollTo(0, 0);
    const h1 = $("#inhalt h1"); document.title = (h1 ? h1.textContent + " · " : "") + K.titel;
  }

  function quizWiederherstellen(m) {
    const q = Z.quiz[m.id];
    if (!q || !q.antworten) return;
    const box = $(`.quiz[data-modul="${m.id}"]`);
    q.antworten.forEach((k, n) => { if (k != null) quizAntwort(box, m, n, k, false); });
    quizErgebnis(box, m);
  }
  function quizAntwort(box, m, n, k, speichern) {
    const f = m.quiz[n], el = box.querySelector(`.frage[data-n="${n}"]`);
    el.querySelectorAll(".antwort").forEach((b) => {
      b.disabled = true;
      const bk = Number(b.dataset.k);
      if (bk === f.richtig) b.classList.add("richtig");
      else if (bk === k) b.classList.add("falsch");
    });
    const e = el.querySelector(".erklaerung");
    e.hidden = false; e.textContent = (k === f.richtig ? "Richtig. " : "Nicht ganz. ") + f.erklaerung;
    if (speichern) {
      const q = Z.quiz[m.id] || { antworten: [] };
      q.antworten = q.antworten || []; q.antworten[n] = k;
      const beantwortet = q.antworten.filter((x) => x != null).length;
      q.quote = q.antworten.filter((x, i) => x === m.quiz[i].richtig).length / m.quiz.length;
      if (beantwortet < m.quiz.length) q.quote = Math.min(q.quote, K.bestehen - 0.001);
      Z.quiz[m.id] = q; sichern();
      quizErgebnis(box, m);
    }
  }
  function quizErgebnis(box, m) {
    const q = Z.quiz[m.id];
    const beantwortet = q.antworten.filter((x) => x != null).length;
    if (beantwortet < m.quiz.length) return;
    const richtig = q.antworten.filter((x, i) => x === m.quiz[i].richtig).length;
    const ok = richtig / m.quiz.length >= K.bestehen;
    const el = box.querySelector(".quiz-ergebnis");
    el.hidden = false;
    el.innerHTML = `<span class="chip ${ok ? "fertig" : ""}">${richtig} von ${m.quiz.length} richtig</span>
      <span>${ok ? "Bestanden." : "Noch nicht bestanden. Lies die Erklärungen und versuch es noch einmal."}</span>
      <button class="knopf leise klein" data-aktion="quiz-neu" data-modul="${m.id}">Quiz wiederholen</button>`;
    leiste(m.id);
  }

  /* ---------- Ereignisse ---------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("button, a");
    if (!t) return;
    if (t.id === "menue-knopf") { document.body.classList.toggle("menue-offen"); return; }
    if (t.dataset.aktion === "zu-anmelden" || t.dataset.aktion === "zu-registrieren") { zeigeAnmeldung("", t.dataset.aktion === "zu-registrieren" ? "registrieren" : ""); return; }
    if (t.dataset.aktion === "abmelden") {
      (async () => {
        if (syncTimer) await serverSichern();
        try { await api("abmelden", {}); } catch (e) { /* trotzdem abmelden */ }
        SERVER.angemeldet = false; zustandSetzen(null); speicherSchluessel = SPEICHER;
        try { SERVER = await api("ich"); } catch (e) { /* - */ }
        zeigeAnmeldung("Du bist abgemeldet.");
      })();
      return;
    }
    if (t.dataset.admin) {
      const box = t.closest("[data-konto]"), id = Number(box.dataset.konto), was = t.dataset.admin;
      const meldung = $("#am-" + id);
      if (was === "loeschen" && t.dataset.sicher !== "ja") {
        t.dataset.sicher = "ja"; t.textContent = "Wirklich löschen? Klick noch einmal";
        setTimeout(() => { if (t.isConnected) { t.dataset.sicher = ""; t.textContent = "Löschen"; } }, 5000);
        return;
      }
      api("admin_konto", { id, was }).then((a) => {
        if (was === "passwort") meldung.innerHTML = `Neues Einmal-Passwort: <code class="gross">${esc(a.passwort)}</code><br><small>Gib es persönlich weiter. Beim nächsten Anmelden wird ein eigenes Passwort verlangt.</small>`;
        else teilnehmendeLaden();
      }, (e) => { meldung.textContent = e.message; });
      return;
    }
    if (t.dataset.lektion) {
      const id = t.dataset.lektion;
      Z.fertig[id] = !Z.fertig[id]; if (!Z.fertig[id]) delete Z.fertig[id]; sichern();
      const d = t.closest(".lektion");
      d.dataset.fertig = Z.fertig[id] ? "ja" : "nein";
      t.textContent = Z.fertig[id] ? "Als offen markieren" : "Als erledigt abhaken";
      t.classList.toggle("leise", !!Z.fertig[id]);
      if (Z.fertig[id]) { d.open = false; const n = d.nextElementSibling; if (n && n.matches(".lektion") && n.dataset.fertig !== "ja") n.open = true; }
      leiste((location.hash || "#start").slice(1));
      return;
    }
    if (t.classList.contains("antwort")) {
      const box = t.closest(".quiz"), m = K.module.find((x) => x.id === box.dataset.modul);
      quizAntwort(box, m, Number(t.closest(".frage").dataset.n), Number(t.dataset.k), true);
      return;
    }
    if (t.dataset.aktion === "quiz-neu") { delete Z.quiz[t.dataset.modul]; sichern(); zeige(); return; }
    if (t.dataset.film || t.dataset.filmSzene) {
      const el = t.closest(".film"), m = K.module.find((x) => x.id === el.dataset.modul);
      if (!film || film.el !== el) filmZeige(el, m, 0, false);
      if (t.dataset.film === "play") {
        if (film.laeuft) { filmStopp(); return; }
        film.laeuft = true; t.textContent = "❚❚ Pause";
        filmZeige(el, m, film.i >= m.film.szenen.length - 1 ? 0 : film.i, true);
      } else if (t.dataset.film === "ton") {
        film.ton = !film.ton; t.textContent = film.ton ? "Ton an" : "Ton aus"; t.setAttribute("aria-pressed", String(film.ton));
        if (!film.ton) { try { speechSynthesis.cancel(); } catch (e) { /* - */ } }
      } else {
        const ziel = t.dataset.filmSzene != null ? Number(t.dataset.filmSzene) : film.i + (t.dataset.film === "vor" ? 1 : -1);
        const lief = film.laeuft; clearTimeout(film.timer); try { speechSynthesis.cancel(); } catch (e) { /* - */ }
        filmZeige(el, m, ziel, lief);
      }
      return;
    }
    if (t.dataset.kopiere != null) { kopieren(K.prompts[Number(t.dataset.kopiere)].text, t); return; }
    if (t.dataset.kat != null && t.closest("#prompt-filter")) {
      document.querySelectorAll("#prompt-filter .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === t)));
      document.querySelectorAll(".prompt").forEach((p) => { p.hidden = !!t.dataset.kat && p.dataset.kat !== t.dataset.kat; });
      return;
    }
    if (t.dataset.aktion === "baukasten-kopieren") { kopieren($("#baukasten-ausgabe").textContent, t); return; }
    if (t.dataset.aktion === "baukasten-leeren" || t.dataset.aktion === "baukasten-beispiel") {
      BAUSTEINE.forEach(([k, , , bsp]) => {
        const v = t.dataset.aktion === "baukasten-leeren" ? "" : bsp;
        Z.baukasten[k] = v; $("#b-" + k).value = v;
      });
      sichern(); baukastenText(); return;
    }
    if (t.dataset.aktion === "canvas-kopieren") { kopieren($("#canvas-text").textContent, t); return; }
  });

  document.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.closest("#selbst")) { Z.selbst[t.name] = Number(t.value); sichern(); selbstAuswerten(); }
    else if (t.closest("#baukasten")) { Z.baukasten[t.name] = t.value; sichern(); baukastenText(); }
    else if (t.closest("#rechner")) { Z.rechner[t.name] = t.value; sichern(); rechnerAuswerten(); }
    else if (t.closest("#canvas")) { Z.canvas[t.name] = t.value; sichern(); canvasAuswerten(); }
    else if (t.id === "z-name") { Z.name = t.value; sichern(); $("#z-anzeige").textContent = t.value || "Dein Name"; }
    else if (t.id === "glossar-suche") {
      const s = t.value.trim().toLowerCase();
      document.querySelectorAll("#glossar-liste > div").forEach((d) => { d.hidden = !!s && !d.dataset.such.includes(s); });
    }
  });
  document.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = ev.target, wert = (id) => ($("#" + id) ? $("#" + id).value : "");
    const knopf = f.querySelector('button[type="submit"]');
    const melde = (el, text, gut) => { if (el) { el.textContent = text; el.dataset.gut = gut ? "ja" : ""; } };
    const laufen = async (fn, meldung) => {
      if (knopf) knopf.disabled = true;
      try { await fn(); } catch (e) { melde(meldung, e.message, false); }
      if (knopf && knopf.isConnected) knopf.disabled = false;
    };
    if (f.id === "login-form") {
      laufen(async () => { await api("anmelden", { email: wert("f-email"), passwort: wert("f-pw") }); await nachAnmeldung(); }, $("#f-meldung"));
    } else if (f.id === "reg-form") {
      laufen(async () => {
        await api("registrieren", { code: wert("f-code").trim(), name: wert("f-name"), email: wert("f-email"), passwort: wert("f-pw") });
        await nachAnmeldung();
      }, $("#f-meldung"));
    } else if (f.id === "pw-form") {
      laufen(async () => {
        await api("passwort", { alt: wert("pw-alt"), neu: wert("pw-neu") });
        SERVER.benutzer.wechselNoetig = false; f.reset();
        melde($("#pw-meldung"), "Neues Passwort gespeichert.", true);
      }, $("#pw-meldung"));
    } else if (f.id === "einladung-form") {
      laufen(async () => { await api("admin_einladung", { bemerkung: wert("einladung-bemerkung") }); await teilnehmendeLaden(); }, null);
    }
  });
  window.addEventListener("hashchange", () => {
    if (SERVER && !SERVER.angemeldet) return;
    if (SERVER && SERVER.benutzer && SERVER.benutzer.wechselNoetig && location.hash !== "#konto") { location.hash = "#konto"; return; }
    zeige();
  });
  try { speechSynthesis.getVoices(); } catch (e) { /* - */ }

  /* ---------- Start ---------- */
  (async function starten() {
    const R = new URLSearchParams(location.search);
    if (R.get("film")) { filmbild(R.get("film"), Number(R.get("szene") || 0)); return; }
    if (location.protocol !== "file:") {
      try {
        const ich = await api("ich");
        if (ich && typeof ich.angemeldet === "boolean") SERVER = ich;
      } catch (e) { SERVER = null; /* statische Vorschau ohne PHP */ }
    }
    if (SERVER && !SERVER.angemeldet) { zeigeAnmeldung(); return; }
    if (SERVER) { await nachAnmeldung(); return; }
    zeige();
  })();
})();

