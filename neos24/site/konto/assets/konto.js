/* NEOS Kundenportal — kleine Handgriffe; alles läuft auch ohne JS. */
(function () {
  'use strict';

  /* Bestätigung vor Konto schließen u. ä. */
  document.querySelectorAll('form[data-bestaetigen]').forEach(function (form) {
    form.addEventListener('submit', function (e) { if (!window.confirm(form.getAttribute('data-bestaetigen'))) e.preventDefault(); });
  });

  /* Login: „Link schicken“ nimmt die E-Mail aus dem Passwort-Formular mit */
  var linkForm = document.querySelector('form[data-link-form]');
  var emailInput = document.getElementById('email');
  if (linkForm && emailInput) {
    linkForm.addEventListener('submit', function (e) {
      var v = emailInput.value.trim();
      if (!v) { e.preventDefault(); emailInput.focus(); emailInput.closest('.field').classList.add('is-invalid'); return; }
      linkForm.querySelector('[name="email"]').value = v;
    });
  }

  /* Neue Sendung: Nettopreis, Carrier und Laufzeit live aus data-klassen */
  var sendung = document.querySelector('.k-sendung');
  if (sendung) {
    var land = sendung.querySelector('[name="zielland"]'), gewicht = sendung.querySelector('[name="gewichtsklasse"]');
    var lang = document.documentElement.lang === 'en' ? 'en' : 'de';
    var fmt = function (cent) { return lang === 'de' ? (cent / 100).toFixed(2).replace('.', ',') + ' €' : '€' + (cent / 100).toFixed(2); };
    var update = function () {
      var o = land.options[land.selectedIndex];
      var klassen = o && o.value ? JSON.parse(o.getAttribute('data-klassen') || '{}') : {};
      var gk = gewicht.value;
      Array.prototype.forEach.call(gewicht.options, function (g) { g.disabled = o && o.value ? !klassen[g.value] : false; });
      if (gewicht.options[gewicht.selectedIndex] && gewicht.options[gewicht.selectedIndex].disabled) {
        var erste = Array.prototype.find.call(gewicht.options, function (g) { return !g.disabled; });
        if (erste) gewicht.value = erste.value;
        gk = gewicht.value;
      }
      var k = klassen[gk];
      sendung.querySelector('[data-preis]').textContent = k ? fmt(k.netto) : '—';
      sendung.querySelector('[data-carrier]').textContent = k ? k.carrier : '—';
      sendung.querySelector('[data-laufzeit]').textContent = k ? k.laufzeit : '—';
    };
    land.addEventListener('change', update); gewicht.addEventListener('change', update); update();
    sendung.addEventListener('input', function (e) { var f = e.target.closest('.field'); if (f) f.classList.remove('is-invalid'); });
  }
})();
