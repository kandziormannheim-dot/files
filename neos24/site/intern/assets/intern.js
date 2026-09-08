/* NEOS intern — kleine Handgriffe. Alles funktioniert auch ohne JS. */
(function () {
  'use strict';

  /* Löschen und Zurücksetzen bestätigen */
  document.querySelectorAll('form[data-bestaetigen]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-bestaetigen'))) e.preventDefault();
    });
  });

  /* Rechtematrix: „alle“ je Zeile an/aus */
  document.querySelectorAll('.rechteformular [data-alles]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var boxes = btn.closest('tr').querySelectorAll('input[type="checkbox"]');
      var alle = Array.prototype.every.call(boxes, function (b) { return b.checked; });
      boxes.forEach(function (b) { b.checked = !alle; });
    });
  });
  /* Bearbeiten/Löschen schließt Sehen ein — im Formular sofort sichtbar */
  document.querySelectorAll('.rechteformular tr[data-modul]').forEach(function (tr) {
    var sehen = tr.querySelector('input[name$="[sehen]"]');
    tr.querySelectorAll('input[name$="[bearbeiten]"], input[name$="[loeschen]"]').forEach(function (b) {
      b.addEventListener('change', function () { if (b.checked && sehen) sehen.checked = true; });
    });
  });

  /* Routing-Zelle: Brutto und Marge live */
  var euro = function (cent) { return (cent / 100).toFixed(2).replace('.', ',') + ' €'; };
  var cent = function (v) { var n = parseFloat(String(v).replace(/\s|€/g, '').replace(',', '.')); return isNaN(n) ? null : Math.round(n * 100); };
  document.querySelectorAll('.prioritaeten tbody tr').forEach(function (tr) {
    var vk = tr.querySelector('[data-geld="verkauf"]'), ek = tr.querySelector('[data-geld="einkauf"]');
    var brutto = tr.querySelector('[data-brutto]'), marge = tr.querySelector('[data-marge]');
    if (!vk || !brutto) return;
    var mwst = parseInt(brutto.getAttribute('data-mwst'), 10) || 19;
    var update = function () {
      var v = cent(vk.value), e = cent(ek ? ek.value : '0') || 0;
      brutto.textContent = v === null ? '—' : euro(Math.round(v * (100 + mwst) / 100));
      marge.textContent = v === null ? '—' : euro(v - e);
    };
    vk.addEventListener('input', update); if (ek) ek.addEventListener('input', update);
  });

  /* Startpasswort per Klick kopieren */
  document.querySelectorAll('[data-kopieren]').forEach(function (el) {
    el.title = 'Klicken zum Kopieren';
    el.style.cursor = 'copy';
    el.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(el.textContent.trim()).then(function () { el.classList.add('kopiert'); setTimeout(function () { el.classList.remove('kopiert'); }, 1200); });
    });
  });
})();
