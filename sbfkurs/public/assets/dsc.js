/* SBF-Kurs — DSC-Controller-Simulator (nachgebautes UKW-Funkgerät).
   Ein vereinfachter UKW-Controller mit DSC als Zustandsautomat: Menübaum,
   Eingabepuffer, Kanalwahl, Sendeleistung 1 W/25 W, Sprechtaste (PTT) zum
   Halten mit Antwort der Gegenstelle (Text, auf Wunsch vorgelesen) und
   DISTRESS-Taste mit Haltezeit. Jedes Szenario
   nennt die erwartete Bedienfolge (content/dsc/szenarien.json); das Skript
   gleicht Schritt für Schritt ab, protokolliert Fehltritte und übergibt das
   Ergebnis an ein normales Formular — kein JSON-Endpunkt, kein Inline-Code. */

(function () {
    'use strict';

    var geraet = document.querySelector('[data-dsc]');
    if (!geraet) { return; }

    var szenarien = JSON.parse(geraet.dataset.szenarien || '[]');
    var konfig = JSON.parse(geraet.dataset.geraet || '{}');
    var kanaele = konfig.kanaele || ['16', '70'];
    var eigeneMmsi = konfig.eigeneMmsi || '000000000';

    var zeilen = [1, 2, 3].map(function (n) { return geraet.querySelector('[data-zeile="' + n + '"]'); });
    var anzeigeKanal = geraet.querySelector('[data-anzeige-kanal]');
    var lage = document.querySelector('[data-lage]');
    var lageTitel = document.querySelector('[data-lage-titel]');
    var lageText = document.querySelector('[data-lage-text]');
    var protokollListe = document.querySelector('[data-protokoll]');
    var ergebnisFormular = document.querySelector('form[data-dsc-ergebnis]');
    var distressTaste = geraet.querySelector('[data-distress]');
    var klappe = geraet.querySelector('[data-klappe]');
    var pttTaste = geraet.querySelector('[data-taste="ptt"]');
    var leistungTaste = geraet.querySelector('[data-taste="leistung"]');
    var anzeigeLeistung = geraet.querySelector('[data-anzeige-leistung]');
    var funkKasten = document.querySelector('[data-funk]');
    var funkDu = document.querySelector('[data-funk-du]');
    var funkAntwort = document.querySelector('[data-funk-antwort]');
    var funkVorlesen = document.querySelector('[data-funk-vorlesen]');

    // ---------------------------------------------------------- Menübaum
    var NATURES = ['undesignated', 'fire', 'flooding', 'collision', 'grounding', 'capsizing', 'sinking', 'adrift', 'abandoning', 'piracy', 'mob'];
    var NATURE_TEXT = { undesignated: 'UNDESIGNATED', fire: 'FIRE/EXPLOSION', flooding: 'FLOODING', collision: 'COLLISION', grounding: 'GROUNDING', capsizing: 'CAPSIZING', sinking: 'SINKING', adrift: 'DISABLED/ADRIFT', abandoning: 'ABANDONING SHIP', piracy: 'PIRACY', mob: 'MAN OVERBOARD' };
    var KATEGORIEN = ['routine', 'safety', 'urgency'];

    var zustand;

    function neuerZustand() {
        return {
            kanal: '16',
            leistung: '25',       // Sendeleistung in Watt
            menue: null,          // null | 'haupt' | 'distress' | 'individual' | 'all-ships' | 'ack'
            auswahl: 0,
            eingabe: '',
            ruf: {},               // gesammelte Angaben des laufenden Anrufs
            distressGesetzt: null, // nature, sobald im Distress-Menü bestätigt
            eingehend: false,
            szenario: null,
            schritt: 0,
            fehltritte: 0,
            protokoll: [],
            fertig: false
        };
    }

    var HAUPT = [
        { id: 'distress', text: 'DISTRESS ALERT' },
        { id: 'individual', text: 'INDIVIDUAL CALL' },
        { id: 'all-ships', text: 'ALL SHIPS CALL' },
        { id: 'ack', text: 'RECEIVED CALLS' }
    ];

    // ---------------------------------------------------------- Anzeige
    function zeigen(a, b, c) {
        zeilen[0].textContent = a || '';
        zeilen[1].textContent = b || '';
        zeilen[2].textContent = c || '';
        anzeigeKanal.textContent = 'CH ' + zustand.kanal;
    }

    function menueZeigen() {
        var z = zustand;
        if (z.menue === null) {
            zeigen(z.eingehend ? '** DISTRESS RECEIVED **' : 'DSC READY', z.eingehend ? 'ACK? ENT=YES CLR=NO' : '', 'MENU: Anruf senden');
        } else if (z.menue === 'haupt') {
            zeigen('MENU', '> ' + HAUPT[z.auswahl].text, '▲▼ wählen, ENT bestätigen');
        } else if (z.menue === 'distress') {
            zeigen('DISTRESS: NATURE', '> ' + NATURE_TEXT[NATURES[z.auswahl]], 'ENT bestätigen');
        } else if (z.menue === 'distress-pos') {
            zeigen('DISTRESS: POSITION', '> ' + (z.auswahl === 0 ? 'FROM GPS (AUTO)' : 'ENTER MANUALLY'), 'ENT bestätigen');
        } else if (z.menue === 'distress-bereit') {
            zeigen('DISTRESS READY', NATURE_TEXT[z.ruf.nature] + ' / POS ' + (z.ruf.position === 'auto' ? 'GPS' : 'MANUAL'), 'DISTRESS-Taste 5 s halten');
        } else if (z.menue === 'mmsi') {
            zeigen('INDIVIDUAL CALL', 'MMSI: ' + z.eingabe + '_', 'Ziffern, ENT bestätigen');
        } else if (z.menue === 'kategorie') {
            zeigen('CATEGORY', '> ' + KATEGORIEN[z.auswahl].toUpperCase(), 'ENT bestätigen');
        } else if (z.menue === 'kanalwahl') {
            zeigen('WORKING CHANNEL', '> CH ' + kanaele[z.auswahl], 'ENT bestätigen');
        } else if (z.menue === 'senden') {
            zeigen('READY TO SEND', beschreibungRuf(), 'ENT = SEND, CLR = zurück');
        } else if (z.menue === 'gesendet') {
            zeigen('CALL SENT', beschreibungRuf(), 'CH ' + zustand.kanal + ' — PTT zum Sprechen');
        } else if (z.menue === 'ack') {
            zeigen('RECEIVED CALLS', z.eingehend ? '> DISTRESS 211987650' : '(leer)', z.eingehend ? 'ENT = ACK senden, CLR = nicht' : 'CLR zurück');
        } else if (z.menue === 'alarm') {
            zeigen('*** DISTRESS ALERT SENT ***', NATURE_TEXT[z.ruf.nature] + ' MMSI ' + eigeneMmsi, 'CH 16 — Sprechfunk MAYDAY (PTT)');
        }
    }

    function beschreibungRuf() {
        var r = zustand.ruf;
        var teile = [];
        if (r.art === 'individual') { teile.push('TO ' + (r.mmsi || '?')); }
        if (r.art === 'all-ships') { teile.push('ALL SHIPS'); }
        if (r.kategorie) { teile.push(r.kategorie.toUpperCase()); }
        if (r.kanal) { teile.push('CH ' + r.kanal); }
        return teile.join(' ');
    }

    // ---------------------------------------------------------- Szenario-Abgleich
    function ereignis(aktion, wert) {
        var z = zustand;
        if (!z.szenario || z.fertig) { return; }
        var erwartet = z.szenario.erwartet[z.schritt];
        var passt = erwartet && erwartet.aktion === aktion && (erwartet.wert === undefined || erwartet.wert === wert);
        if (passt) {
            z.protokoll.push({ schritt: z.schritt, aktion: aktion, wert: wert, ok: true });
            z.schritt++;
            if (z.schritt >= z.szenario.erwartet.length) {
                z.fertig = true;
            }
        } else {
            // Kanalwechsel, Leistungswahl und Menü-Navigation sind nur dann
            // Fehltritte, wenn sie eine erwartete Aktion vorwegnehmen; reines
            // Blättern nicht.
            var harmlos = ((aktion === 'kanal' || aktion === 'leistung') && !(erwartet && erwartet.aktion === aktion)) || aktion === 'blaettern';
            if (!harmlos) {
                z.fehltritte++;
                z.protokoll.push({ schritt: z.schritt, aktion: aktion, wert: wert, ok: false });
            }
        }
        protokollZeigen();
    }

    function protokollZeigen() {
        var z = zustand;
        protokollListe.textContent = '';
        if (!z.szenario) { return; }
        z.szenario.erwartet.forEach(function (schritt, i) {
            var li = document.createElement('li');
            li.textContent = schritt.text || (schritt.aktion + (schritt.wert ? ' ' + schritt.wert : ''));
            li.className = i < z.schritt ? 'ok' : 'offen';
            protokollListe.appendChild(li);
        });
        if (z.fehltritte > 0) {
            var li = document.createElement('li');
            li.className = 'fehl';
            li.textContent = z.fehltritte + ' Fehltritt(e) — falsche Aktion an dieser Stelle';
            protokollListe.appendChild(li);
        }
        if (z.fertig) {
            var punkte = Math.max(0, z.szenario.erwartet.length - z.fehltritte);
            var fertig = document.createElement('li');
            fertig.className = 'ok';
            fertig.textContent = 'Szenario abgeschlossen: ' + punkte + ' von ' + z.szenario.erwartet.length + ' Punkten.';
            protokollListe.appendChild(fertig);
            if (ergebnisFormular) {
                ergebnisFormular.hidden = false;
                ergebnisFormular.querySelector('[name="szenario"]').value = z.szenario.id;
                ergebnisFormular.querySelector('[name="punkte"]').value = String(punkte);
                ergebnisFormular.querySelector('[name="protokoll"]').value = JSON.stringify(z.protokoll);
            }
        }
    }

    function leistungZeigen() {
        if (anzeigeLeistung) { anzeigeLeistung.textContent = zustand.leistung + ' W'; }
        if (leistungTaste) { leistungTaste.textContent = zustand.leistung === '25' ? '25 W → 1 W' : '1 W → 25 W'; }
    }

    // ---------------------------------------------------------- Sprechfunk (PTT halten)
    var sprechText = (function () {
        var synth = window.speechSynthesis;
        var Utter = window.SpeechSynthesisUtterance;
        return function (text, sprache) {
            if (!synth || !Utter || !funkVorlesen || !funkVorlesen.checked) { return; }
            synth.cancel();
            var u = new Utter(text.replace(/(\d)(?=\d)/g, '$1 '));
            u.lang = sprache === 'de' ? 'de-DE' : 'en-GB';
            u.rate = 0.9;
            var stimmen = synth.getVoices().filter(function (v) { return v.lang.replace('_', '-').toLowerCase().indexOf(u.lang.slice(0, 2)) === 0; });
            if (stimmen[0]) { u.voice = stimmen[0]; }
            synth.speak(u);
        };
    })();

    function pttStart(ev) {
        ev.preventDefault();
        var z = zustand;
        if (pttTaste.classList.contains('sendet')) { return; }
        pttTaste.classList.add('sendet');
        var erwartet = z.szenario && !z.fertig ? z.szenario.erwartet[z.schritt] : null;
        var passendesPtt = erwartet && erwartet.aktion === 'ptt' ? erwartet : null;
        zeigen('TX  CH ' + z.kanal + '  ' + z.leistung + ' W', passendesPtt && passendesPtt.sprechtext ? 'Du sprichst …' : '(Sprechfunk)', '');
        if (funkKasten) {
            funkKasten.hidden = false;
            funkDu.textContent = passendesPtt && passendesPtt.sprechtext ? passendesPtt.sprechtext : '(Sprechfunk auf Kanal ' + z.kanal + ' — laut Szenario ist jetzt kein Sprechen vorgesehen)';
            funkAntwort.textContent = '…';
        }
    }
    function pttEnde() {
        if (!pttTaste.classList.contains('sendet')) { return; }
        pttTaste.classList.remove('sendet');
        var z = zustand;
        var erwartet = z.szenario && !z.fertig ? z.szenario.erwartet[z.schritt] : null;
        var passendesPtt = erwartet && erwartet.aktion === 'ptt' ? erwartet : null;
        ereignis('ptt');
        if (passendesPtt && passendesPtt.antwort) {
            zeigen('RX  CH ' + z.kanal, 'Gegenstelle antwortet', '');
            if (funkAntwort) { funkAntwort.textContent = passendesPtt.antwort; }
            sprechText(passendesPtt.antwort, z.szenario.sprache || 'en');
        } else {
            zeigen('RX  CH ' + z.kanal, '', '');
            if (funkAntwort) { funkAntwort.textContent = '(keine Antwort)'; }
        }
    }

    function szenarioStarten(id) {
        var s = szenarien.filter(function (x) { return x.id === id; })[0];
        zustand = neuerZustand();
        zustand.szenario = s || null;
        if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
        if (funkKasten) { funkKasten.hidden = true; }
        leistungZeigen();
        if (s) {
            // Szenarien mit „quittung“ beginnen mit einem eingehenden Notalarm.
            zustand.eingehend = s.erwartet.some(function (e) { return e.aktion === 'quittung'; });
            lage.hidden = false;
            lageTitel.textContent = s.titel;
            lageText.textContent = s.lage;
        }
        if (ergebnisFormular) { ergebnisFormular.hidden = true; }
        klappeSchliessen();
        menueZeigen();
        protokollZeigen();
    }

    // ---------------------------------------------------------- Tasten
    function taste(name) {
        var z = zustand;
        switch (name) {
            case 'menu':
                if (z.menue === null || z.menue === 'gesendet' || z.menue === 'alarm') {
                    z.menue = 'haupt';
                    z.auswahl = 0;
                    z.ruf = {};
                }
                break;
            case 'hoch':
            case 'runter':
                var n = listeLaenge();
                if (n > 0) {
                    z.auswahl = (z.auswahl + (name === 'hoch' ? n - 1 : 1)) % n;
                    ereignis('blaettern');
                }
                break;
            case 'ent':
                bestaetigen();
                break;
            case 'clr':
                if (z.eingehend && z.menue === null) {
                    z.eingehend = false;
                    ereignis('quittung', 'nicht-senden');
                } else if (z.menue === 'ack' && z.eingehend) {
                    z.menue = null;
                    z.eingehend = false;
                    ereignis('quittung', 'nicht-senden');
                } else if (z.menue === 'mmsi' && z.eingabe.length > 0) {
                    z.eingabe = z.eingabe.slice(0, -1);
                } else {
                    z.menue = null;
                    z.eingabe = '';
                }
                break;
            case 'kanal-hoch':
            case 'kanal-runter':
                var i = kanaele.indexOf(z.kanal);
                i = (i + (name === 'kanal-hoch' ? 1 : kanaele.length - 1)) % kanaele.length;
                z.kanal = kanaele[i];
                ereignis('kanal', z.kanal);
                break;
            case 'leistung':
                z.leistung = z.leistung === '25' ? '1' : '25';
                leistungZeigen();
                ereignis('leistung', z.leistung);
                break;
        }
        menueZeigen();
    }

    function listeLaenge() {
        switch (zustand.menue) {
            case 'haupt': return HAUPT.length;
            case 'distress': return NATURES.length;
            case 'distress-pos': return 2;
            case 'kategorie': return KATEGORIEN.length;
            case 'kanalwahl': return kanaele.length;
            default: return 0;
        }
    }

    function bestaetigen() {
        var z = zustand;
        switch (z.menue) {
            case null:
                if (z.eingehend) {
                    // ENT auf eingehendem Alarm = Quittung senden (für Sportboote falsch)
                    z.eingehend = false;
                    ereignis('quittung', 'senden');
                }
                break;
            case 'haupt':
                var wahl = HAUPT[z.auswahl].id;
                ereignis('menue', wahl);
                z.auswahl = 0;
                z.ruf = { art: wahl };
                if (wahl === 'distress') { z.menue = 'distress'; }
                else if (wahl === 'individual') { z.menue = 'mmsi'; z.eingabe = ''; }
                else if (wahl === 'all-ships') { z.menue = 'kategorie'; }
                else { z.menue = 'ack'; }
                break;
            case 'distress':
                z.ruf.nature = NATURES[z.auswahl];
                ereignis('nature', z.ruf.nature);
                z.menue = 'distress-pos';
                z.auswahl = 0;
                break;
            case 'distress-pos':
                z.ruf.position = z.auswahl === 0 ? 'auto' : 'manuell';
                ereignis('position', z.ruf.position);
                z.menue = 'distress-bereit';
                break;
            case 'mmsi':
                if (z.eingabe.length === 9) {
                    z.ruf.mmsi = z.eingabe;
                    ereignis('mmsi', z.eingabe);
                    z.menue = 'kategorie';
                    z.auswahl = 0;
                }
                break;
            case 'kategorie':
                z.ruf.kategorie = KATEGORIEN[z.auswahl];
                ereignis('kategorie', z.ruf.kategorie);
                if (z.ruf.art === 'individual') {
                    z.menue = 'kanalwahl';
                    z.auswahl = Math.max(0, kanaele.indexOf('72'));
                } else {
                    z.menue = 'senden';
                }
                break;
            case 'kanalwahl':
                z.ruf.kanal = kanaele[z.auswahl];
                ereignis('kanal', z.ruf.kanal);
                z.menue = 'senden';
                break;
            case 'senden':
                ereignis('senden');
                z.menue = 'gesendet';
                if (z.ruf.kanal) { z.kanal = z.ruf.kanal; }
                break;
            case 'ack':
                if (z.eingehend) {
                    z.eingehend = false;
                    ereignis('quittung', 'senden');
                    z.menue = null;
                }
                break;
        }
    }

    function ziffer(w) {
        var z = zustand;
        if (w === '⌫') {
            z.eingabe = z.eingabe.slice(0, -1);
        } else if (w === '16') {
            z.kanal = '16';
            z.menue = z.menue === 'gesendet' || z.menue === 'alarm' ? z.menue : null;
            ereignis('kanal', '16');
        } else if (z.menue === 'mmsi' && z.eingabe.length < 9) {
            z.eingabe += w;
        }
        menueZeigen();
    }

    // ---------------------------------------------------------- DISTRESS-Taste
    var halteTimer = null;

    function klappeSchliessen() {
        distressTaste.hidden = true;
        klappe.hidden = false;
        klappe.setAttribute('aria-expanded', 'false');
    }
    klappe.addEventListener('click', function () {
        klappe.hidden = true;
        distressTaste.hidden = false;
        klappe.setAttribute('aria-expanded', 'true');
    });

    function halteStart(ev) {
        ev.preventDefault();
        if (halteTimer) { return; }
        var sek = 5;
        distressTaste.classList.add('haelt');
        halteTimer = window.setTimeout(function () {
            halteTimer = null;
            distressTaste.classList.remove('haelt');
            var z = zustand;
            if (!z.ruf.nature) {
                z.ruf = { art: 'distress', nature: 'undesignated', position: 'auto' };
            }
            ereignis('distress-taste');
            z.menue = 'alarm';
            z.kanal = '16';
            ereignis('kanal', '16');
            klappeSchliessen();
            menueZeigen();
        }, sek * 1000);
    }
    function halteEnde() {
        if (halteTimer) {
            window.clearTimeout(halteTimer);
            halteTimer = null;
            distressTaste.classList.remove('haelt');
            zeigen('DISTRESS ABGEBROCHEN', 'Taste 5 Sekunden halten', '');
        }
    }
    distressTaste.addEventListener('pointerdown', halteStart);
    distressTaste.addEventListener('pointerup', halteEnde);
    distressTaste.addEventListener('pointerleave', halteEnde);
    distressTaste.addEventListener('keydown', function (ev) { if (ev.key === ' ' || ev.key === 'Enter') { halteStart(ev); } });
    distressTaste.addEventListener('keyup', halteEnde);

    // ---------------------------------------------------------- Verdrahtung
    geraet.querySelectorAll('[data-taste]').forEach(function (k) {
        if (k.dataset.taste === 'ptt') { return; }
        k.addEventListener('click', function () { taste(k.dataset.taste); });
    });
    if (pttTaste) {
        pttTaste.addEventListener('pointerdown', pttStart);
        pttTaste.addEventListener('pointerup', pttEnde);
        pttTaste.addEventListener('pointerleave', pttEnde);
        pttTaste.addEventListener('keydown', function (ev) { if (ev.key === ' ' || ev.key === 'Enter') { pttStart(ev); } });
        pttTaste.addEventListener('keyup', pttEnde);
    }
    geraet.querySelectorAll('[data-ziffer]').forEach(function (k) {
        k.addEventListener('click', function () { ziffer(k.dataset.ziffer); });
    });
    document.querySelectorAll('[data-szenario]').forEach(function (k) {
        k.addEventListener('click', function () {
            document.querySelectorAll('[data-szenario]').forEach(function (x) { x.classList.remove('aktiv'); });
            k.classList.add('aktiv');
            szenarioStarten(k.dataset.szenario);
        });
    });
    var neustart = document.querySelector('[data-neustart]');
    if (neustart) {
        neustart.addEventListener('click', function () { if (zustand.szenario) { szenarioStarten(zustand.szenario.id); } });
    }

    zustand = neuerZustand();
    leistungZeigen();
    menueZeigen();
})();
