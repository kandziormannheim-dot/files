/* Womo-Schadensakte — das bisschen JavaScript:
   Zonen-Skizze, Foto-Vorschau, Unterschriften-Felder, Rückfragen. */

(function () {
    'use strict';

    // Skizze und Schaltflächen setzen dieselben Radio-Felder.
    document.querySelectorAll('.zonen').forEach(function (feld) {
        var flaechen = feld.querySelectorAll('.womo-skizze [data-zone]');
        var radios = feld.querySelectorAll('input[name="zone"]');

        function abgleichen() {
            var gewaehlt = feld.querySelector('input[name="zone"]:checked');
            flaechen.forEach(function (flaeche) {
                flaeche.classList.toggle(
                    'aktiv',
                    gewaehlt !== null && flaeche.dataset.zone === gewaehlt.value
                );
            });
        }

        flaechen.forEach(function (flaeche) {
            flaeche.addEventListener('click', function () {
                var radio = feld.querySelector('input[value="' + flaeche.dataset.zone + '"]');
                if (radio) {
                    radio.checked = true;
                    abgleichen();
                }
            });
        });
        radios.forEach(function (radio) {
            radio.addEventListener('change', abgleichen);
        });
        abgleichen();
    });

    // Gewählte Fotos sofort als Miniaturen zeigen — am Fahrzeug will man
    // sehen, ob die Aufnahme etwas geworden ist.
    document.querySelectorAll('.foto-feld input[type="file"]').forEach(function (eingabe) {
        eingabe.addEventListener('change', function () {
            var vorschau = eingabe.closest('form').querySelector('.foto-vorschau');
            if (!vorschau) {
                return;
            }
            vorschau.textContent = '';
            Array.prototype.forEach.call(eingabe.files, function (datei) {
                if (!datei.type.startsWith('image/')) {
                    return;
                }
                var bild = document.createElement('img');
                bild.src = URL.createObjectURL(datei);
                bild.onload = function () { URL.revokeObjectURL(bild.src); };
                vorschau.appendChild(bild);
            });
        });
    });

    // Unterschriften: mit Finger oder Maus auf die Leinwand, beim Absenden
    // wandert das Bild als Daten-URL in das versteckte Feld. Eine leere
    // Leinwand bleibt ein leeres Feld — der Server verlangt beide.
    document.querySelectorAll('.unterschrift').forEach(function (feld) {
        var leinwand = feld.querySelector('canvas');
        var ziel = feld.querySelector('input[type="hidden"]');
        var stift = leinwand.getContext('2d');
        var gezeichnet = false;
        var aktiv = false;

        stift.lineWidth = 2.5;
        stift.lineCap = 'round';
        stift.lineJoin = 'round';
        stift.strokeStyle = '#1d2733';

        function punkt(ereignis) {
            var kasten = leinwand.getBoundingClientRect();
            return {
                x: (ereignis.clientX - kasten.left) * (leinwand.width / kasten.width),
                y: (ereignis.clientY - kasten.top) * (leinwand.height / kasten.height)
            };
        }

        leinwand.addEventListener('pointerdown', function (ereignis) {
            ereignis.preventDefault();
            leinwand.setPointerCapture(ereignis.pointerId);
            aktiv = true;
            gezeichnet = true;
            var p = punkt(ereignis);
            stift.beginPath();
            stift.moveTo(p.x, p.y);
            stift.lineTo(p.x + 0.1, p.y + 0.1); // Auch ein Tipper hinterlässt einen Punkt
            stift.stroke();
        });
        leinwand.addEventListener('pointermove', function (ereignis) {
            if (!aktiv) {
                return;
            }
            var p = punkt(ereignis);
            stift.lineTo(p.x, p.y);
            stift.stroke();
        });
        ['pointerup', 'pointercancel'].forEach(function (art) {
            leinwand.addEventListener(art, function () { aktiv = false; });
        });

        feld.querySelector('.leeren').addEventListener('click', function () {
            stift.clearRect(0, 0, leinwand.width, leinwand.height);
            gezeichnet = false;
            ziel.value = '';
        });

        leinwand.closest('form').addEventListener('submit', function () {
            ziel.value = gezeichnet ? leinwand.toDataURL('image/png') : '';
        });
    });

    // Formulare mit data-bestaetigen fragen nach, bevor etwas unwiderruflich wird.
    document.querySelectorAll('form[data-bestaetigen]').forEach(function (formular) {
        formular.addEventListener('submit', function (ereignis) {
            if (!window.confirm(formular.dataset.bestaetigen)) {
                ereignis.preventDefault();
            }
        });
    });
})();
