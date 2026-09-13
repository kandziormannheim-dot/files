/* SBF-Kurs — das bisschen JavaScript ohne Inline-Code (CSP):
   Prüfungs-Timer und Antwort-Entwurf, Tastenkürzel im Trainer,
   Reihenfolge-Übung, Lückenspiegel, Rückfragen. */

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
})();
