/* SBF-Kurs — das bisschen JavaScript ohne Inline-Code (CSP):
   Prüfungs-Timer und Antwort-Entwurf, Tastenkürzel im Trainer,
   Reihenfolge-Übung, Lückenspiegel, Rückfragen, Schallsignale (Web Audio)
   und Diktat (Sprachausgabe). */

(function () {
    'use strict';

    // ------------------------------------------------------ Rückfragen
    document.querySelectorAll('form[data-bestaetigen]').forEach(function (formular) {
        formular.addEventListener('submit', function (ereignis) {
            if (formular.dataset.autoAbgabe === '1') {
                return; // Der Timer gibt ab, ohne zu fragen.
            }
            if (!window.confirm(formular.dataset.bestaetigen)) {
                ereignis.preventDefault();
            }
        });
    });

    // ------------------------------------------------------ Trainer: Tasten 1–4, Enter
    var trainer = document.querySelector('form[data-trainer]');
    document.addEventListener('keydown', function (ereignis) {
        if (ereignis.target.matches('input:not([type="radio"]), textarea, select')) {
            return;
        }
        if (/^[1-9]$/.test(ereignis.key)) {
            var ziel = document.querySelector('input[type="radio"][data-taste="' + ereignis.key + '"]:not(:disabled)');
            if (ziel && trainer) {
                ziel.checked = true;
                ziel.focus();
                ereignis.preventDefault();
            }
        }
        if (ereignis.key === 'Enter') {
            var weiter = document.querySelector('a[data-enter]');
            if (weiter) {
                weiter.click();
                ereignis.preventDefault();
            } else if (trainer && trainer.querySelector('input[type="radio"]:checked')) {
                trainer.requestSubmit();
                ereignis.preventDefault();
            }
        }
    });

    // ------------------------------------------------------ Prüfungsbogen
    var bogen = document.querySelector('form.bogen[data-pruefung]');
    if (bogen) {
        var schluessel = 'pruefung-' + bogen.dataset.pruefung;
        var anzeige = bogen.querySelector('[data-timer]');
        var timerKasten = bogen.querySelector('.timer');
        var zaehler = bogen.querySelector('[data-beantwortet]');
        var ende = parseInt(bogen.dataset.ende, 10) * 1000;
        var abgegeben = false;

        // Entwurf wiederherstellen — Neuladen oder Rückkehr verliert nichts.
        try {
            var entwurf = JSON.parse(localStorage.getItem(schluessel) || '{}');
            Object.keys(entwurf).forEach(function (name) {
                var feld = bogen.querySelector('input[name="' + name + '"][value="' + entwurf[name] + '"]');
                if (feld) { feld.checked = true; }
            });
        } catch (e) { /* kein Speicher, kein Drama */ }

        function beantwortetZaehlen() {
            var namen = {};
            bogen.querySelectorAll('input[type="radio"]:checked').forEach(function (r) { namen[r.name] = true; });
            if (zaehler) { zaehler.textContent = String(Object.keys(namen).length); }
        }
        bogen.addEventListener('change', function (ereignis) {
            var r = ereignis.target;
            if (r.type !== 'radio') { return; }
            try {
                var stand = JSON.parse(localStorage.getItem(schluessel) || '{}');
                stand[r.name] = r.value;
                localStorage.setItem(schluessel, JSON.stringify(stand));
            } catch (e) { /* s. o. */ }
            beantwortetZaehlen();
        });
        beantwortetZaehlen();

        bogen.addEventListener('submit', function () {
            abgegeben = true;
            try { localStorage.removeItem(schluessel); } catch (e) { /* s. o. */ }
        });
        window.addEventListener('beforeunload', function (ereignis) {
            if (!abgegeben) {
                ereignis.preventDefault();
                ereignis.returnValue = '';
            }
        });

        function tick() {
            var rest = Math.max(0, Math.round((ende - Date.now()) / 1000));
            var m = Math.floor(rest / 60);
            var s = rest % 60;
            if (anzeige) { anzeige.textContent = m + ':' + (s < 10 ? '0' : '') + s; }
            if (timerKasten) { timerKasten.classList.toggle('knapp', rest <= 120); }
            if (rest <= 0 && !abgegeben) {
                bogen.dataset.autoAbgabe = '1';
                abgegeben = true;
                bogen.requestSubmit();
                return;
            }
            window.setTimeout(tick, 1000);
        }
        tick();
    }

    // ------------------------------------------------------ Reihenfolge: ▲ ▼
    document.querySelectorAll('form[data-reihenfolge] .reihenfolge').forEach(function (liste) {
        liste.addEventListener('click', function (ereignis) {
            var knopf = ereignis.target.closest('button[data-hoch], button[data-runter]');
            if (!knopf) { return; }
            var punkt = knopf.closest('li');
            if (knopf.hasAttribute('data-hoch') && punkt.previousElementSibling) {
                liste.insertBefore(punkt, punkt.previousElementSibling);
            } else if (knopf.hasAttribute('data-runter') && punkt.nextElementSibling) {
                liste.insertBefore(punkt.nextElementSibling, punkt);
            }
            knopf.focus();
        });
    });

    // ------------------------------------------------------ Lückentext: Wiederholungen spiegeln
    document.querySelectorAll('.luecke-feld').forEach(function (feld) {
        var nummer = (feld.name.match(/\[(\d+)\]/) || [])[1];
        if (!nummer) { return; }
        var spiegel = document.querySelectorAll('[data-spiegel="' + nummer + '"]');
        feld.addEventListener('input', function () {
            spiegel.forEach(function (s) { s.textContent = feld.value.toUpperCase() || '…'; });
        });
    });
    // ------------------------------------------------------ Schallsignale: k = kurz (1 s), l = lang (4 s)
    var audioKontext = null;
    document.querySelectorAll('button[data-schall]').forEach(function (knopf) {
        knopf.addEventListener('click', function () {
            if (!window.AudioContext && !window.webkitAudioContext) {
                knopf.disabled = true;
                knopf.textContent = 'Keine Tonausgabe möglich';
                return;
            }
            audioKontext = audioKontext || new (window.AudioContext || window.webkitAudioContext)();
            var ctx = audioKontext;
            var t = ctx.currentTime + 0.05;
            var dauer = { k: 1, l: 4 };
            var pause = 1;
            knopf.disabled = true;
            knopf.dataset.text = knopf.dataset.text || knopf.textContent;
            knopf.textContent = '… läuft';
            knopf.dataset.schall.split('').forEach(function (ton) {
                if (!dauer[ton]) { return; }
                var osz = ctx.createOscillator();
                var lautst = ctx.createGain();
                osz.type = 'square';
                osz.frequency.value = 220; // tiefes Horn, kein Piepser
                lautst.gain.setValueAtTime(0.0001, t);
                lautst.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
                lautst.gain.setValueAtTime(0.25, t + dauer[ton] - 0.08);
                lautst.gain.exponentialRampToValueAtTime(0.0001, t + dauer[ton]);
                osz.connect(lautst).connect(ctx.destination);
                osz.start(t);
                osz.stop(t + dauer[ton]);
                t += dauer[ton] + pause;
            });
            window.setTimeout(function () {
                knopf.disabled = false;
                knopf.textContent = knopf.dataset.text;
            }, Math.max(0, (t - ctx.currentTime - pause) * 1000));
        });
    });

    // ------------------------------------------------------ Diktat: Sprachausgabe (Web Speech API)
    document.querySelectorAll('[data-diktat]').forEach(function (kasten) {
        var start = kasten.querySelector('[data-diktat-start]');
        var pause = kasten.querySelector('[data-diktat-pause]');
        var stopp = kasten.querySelector('[data-diktat-stop]');
        var tempo = kasten.querySelector('[data-diktat-tempo]');
        var stand = kasten.querySelector('[data-diktat-stand]');
        var fehlt = kasten.querySelector('[data-diktat-fehlt]');
        if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) {
            if (fehlt) { fehlt.hidden = false; }
            [start, pause, stopp].forEach(function (k) { if (k) { k.disabled = true; } });
            return;
        }
        var synth = window.speechSynthesis;
        var sprache = kasten.dataset.sprache === 'de' ? 'de-DE' : 'en-GB';
        // Ziffern einzeln sprechen (MMSI, Position), wie beim Diktat.
        var text = (kasten.dataset.text || '').replace(/(\d)(?=\d)/g, '$1 ');
        var pausiert = false;

        function stimme() {
            var stimmen = synth.getVoices();
            var passend = stimmen.filter(function (v) { return v.lang.replace('_', '-').toLowerCase().indexOf(sprache.slice(0, 2)) === 0; });
            var genau = passend.filter(function (v) { return v.lang.replace('_', '-') === sprache; });
            return genau[0] || passend[0] || null;
        }
        function melden(t) { if (stand) { stand.textContent = t; } }
        function sprechen() {
            synth.cancel();
            pausiert = false;
            // Satzweise, damit Pausen wie beim Diktieren entstehen.
            var saetze = text.split(/(?<=[.!?])\s+/).filter(function (s) { return s.trim() !== ''; });
            var rate = parseFloat(tempo ? tempo.value : '0.85') || 0.85;
            var v = stimme();
            saetze.forEach(function (satz, i) {
                var u = new SpeechSynthesisUtterance(satz);
                u.lang = sprache;
                if (v) { u.voice = v; }
                u.rate = rate;
                u.pitch = 1;
                u.onstart = function () { melden('Satz ' + (i + 1) + ' von ' + saetze.length); };
                if (i === saetze.length - 1) {
                    u.onend = function () { melden('Ende der Meldung.'); };
                }
                synth.speak(u);
            });
            melden('Wird vorgelesen …');
        }
        if (start) { start.addEventListener('click', sprechen); }
        if (pause) {
            pause.addEventListener('click', function () {
                if (!synth.speaking) { return; }
                if (pausiert) { synth.resume(); pausiert = false; pause.textContent = '⏸ Pause'; melden('Weiter …'); }
                else { synth.pause(); pausiert = true; pause.textContent = '▶ Weiter'; melden('Pausiert.'); }
            });
        }
        if (stopp) { stopp.addEventListener('click', function () { synth.cancel(); pausiert = false; if (pause) { pause.textContent = '⏸ Pause'; } melden('Gestoppt.'); }); }
        window.addEventListener('pagehide', function () { synth.cancel(); });
    });
})();
