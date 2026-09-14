/* neos24.com — Privatkunden-Checkout mit Revolut.
   Startet nur, wenn der Abschnitt #paket (DE) bzw. #parcel (EN) existiert.
   Ablauf: Formular → POST bestellung.php → embed.js laden → RevolutCheckout
   Popup → status.php abfragen → Erfolgspanel. Texte kommen aus data-msg-*
   des Abschnitts, damit dieselbe Datei für beide Sprachen gilt. */
(function () {
  'use strict';
  var sec = document.getElementById('paket') || document.getElementById('parcel');
  if (!sec) return;

  var api = sec.getAttribute('data-api') || 'api/revolut';
  var lang = sec.getAttribute('data-lang') || 'de';
  var form = sec.querySelector('.checkout');
  var land = form.querySelector('[name="zielland"]');
  var gewicht = form.querySelector('[name="gewichtsklasse"]');
  var kategorieWahl = form.querySelectorAll('[name="kategorie"]');
  var kategorie = function () { var r = form.querySelector('[name="kategorie"]:checked'); return r ? r.value : 'paket'; };
  var palettePanel = sec.querySelector('[data-palette]');
  var zollHinweis = sec.querySelector('[data-zoll]');
  var kategorieHinweis = sec.querySelector('[data-kategorie-hinweis]');
  var payBtn = form.querySelector('.checkout-pay');
  var errBox = form.querySelector('.checkout-state--error');
  var okBox = form.querySelector('.checkout-state--success');
  var sum = function (k) { return form.querySelector('[data-sum="' + k + '"]'); };
  var msg = function (k) { return sec.getAttribute('data-msg-' + k) || k; };
  var mwst = 19, modus = 'sandbox', bereit = true;
  var SDK = { sandbox: 'https://sandbox-merchant.revolut.com/embed.js', prod: 'https://merchant.revolut.com/embed.js' };

  var fmt = function (cent) {
    try { return new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(cent / 100); }
    catch (e) { return '€' + (cent / 100).toFixed(2); }
  };
  var brutto = function (netto) { return Math.round(netto * (100 + mwst) / 100); };

  /* Zusammenfassung ------------------------------------------------------ */
  var update = function () {
    var o = land.options[land.selectedIndex];
    var has = o && o.value;
    var netto = has ? parseInt(o.getAttribute('data-netto'), 10) || 0 : 0;
    var b = brutto(netto);
    sum('land').textContent = has ? o.textContent : '—';
    sum('carrier').textContent = has ? (o.getAttribute('data-carrier') || '—') : '—';
    sum('laufzeit').textContent = has ? (o.getAttribute('data-laufzeit') || '—') : '—';
    sum('netto').textContent = has ? fmt(netto) : '—';
    sum('mwst').textContent = has ? fmt(b - netto) : '—';
    sum('brutto').textContent = has ? fmt(b) : '—';
    form.querySelectorAll('[data-zielland]').forEach(function (el) { el.textContent = has ? o.textContent : '—'; });
    payBtn.disabled = !has || !bereit || kategorie() === 'palette';
    /* Zollhinweis für Ziele außerhalb der EU */
    if (zollHinweis) {
      var eu = has && angebot ? angebot.laender.some(function (l) { return l.code === o.value && l.eu; }) : true;
      zollHinweis.hidden = !has || eu;
    }
  };
  land.addEventListener('change', update);
  update();
  kategorieWahl.forEach(function (r) { r.addEventListener('change', function () { kategorieAnwenden(); }); }); // kategorieAnwenden wird weiter unten definiert

  /* Palette: Angebot anfragen (api/anfrage.php, typ = palette) ------------- */
  var paletteKnopf = sec.querySelector('[data-palette-senden]');
  if (paletteKnopf && palettePanel) {
    var pFehler = palettePanel.querySelector('[data-palette-fehler]');
    var pOk = palettePanel.querySelector('[data-palette-ok]');
    var pv = function (n) { var el = palettePanel.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    paletteKnopf.addEventListener('click', function () {
      pFehler.hidden = true;
      var name = pv('palette_name'), email = pv('palette_email');
      if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { pFehler.textContent = msg('invalid'); pFehler.hidden = false; return; }
      paletteKnopf.disabled = true;
      var privat = document.documentElement.getAttribute('data-audience') === 'private';
      fetch(api.replace(/\/revolut$/, '') + '/anfrage.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sprache: lang, art: privat ? 'privat' : 'business', typ: 'palette', name: name, email: email, zielland: land.value,
          palette_anzahl: pv('palette_anzahl'), palette_art: pv('palette_art'), palette_gewicht: pv('palette_gewicht'), palette_abholung: pv('palette_abholung'), nachricht: pv('palette_nachricht') })
      })
        .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (res) {
          paletteKnopf.disabled = false;
          if (res.d && res.d.ok) { pOk.hidden = false; paletteKnopf.hidden = true; return; }
          pFehler.textContent = res.status === 429 ? msg('toomany') : msg('invalid'); pFehler.hidden = false;
        })
        .catch(function () { paletteKnopf.disabled = false; pFehler.textContent = msg('network'); pFehler.hidden = false; });
    });
  }

  /* Verbindliche Preise vom Server (Dashboard → Routingmatrix): überschreibt
     die Werte im Markup, baut Zielland-/Gewichtsauswahl und die Preistabelle
     (#preise / #pricing) neu. Ohne Backend bleiben die Markup-Werte. ------- */
  var angebot = null;
  var preis = function (cent) { return '€' + (cent / 100).toFixed(2).replace('.', lang === 'de' ? ',' : '.'); };
  /* Gewichtsklassen der gewählten Kategorie in die Auswahl schreiben (Brief/Dokumente oder Paket) */
  var klassenFuellen = function () {
    if (!gewicht || !angebot || !angebot.klassen) return;
    var kat = kategorie() === 'brief' ? 'brief' : 'paket';
    var aktuell = gewicht.value;
    gewicht.innerHTML = '';
    Object.keys(angebot.klassen).forEach(function (code) {
      if (angebot.klassen[code].kategorie !== kat) return;
      var o = document.createElement('option'); o.value = code; o.textContent = angebot.klassen[code].name; gewicht.appendChild(o);
    });
    if (angebot.klassen[aktuell] && angebot.klassen[aktuell].kategorie === kat) gewicht.value = aktuell;
  };
  var kategorieAnwenden = function () {
    var kat = kategorie();
    var palette = kat === 'palette';
    sec.classList.toggle('is-palette', palette);
    if (palettePanel) palettePanel.hidden = !palette;
    if (kategorieHinweis) kategorieHinweis.hidden = palette;
    if (gewicht) gewicht.closest('.field').hidden = palette;
    if (!palette) klassenFuellen();
    applyKlasse();
  };
  var applyKlasse = function () {
    if (!angebot) return;
    var gk = gewicht ? gewicht.value : '2kg';
    if (kategorie() === 'palette') { /* alle Länder wählbar, Preise bleiben leer */
      angebot.laender.forEach(function (l) { var o = land.querySelector('option[value="' + l.code + '"]'); if (o) { o.disabled = false; o.hidden = false; o.removeAttribute('data-netto'); } });
      update();
      return;
    }
    var erste = null;
    angebot.laender.forEach(function (l) {
      var o = land.querySelector('option[value="' + l.code + '"]');
      var k = l.klassen && l.klassen[gk];
      if (!o) { o = document.createElement('option'); o.value = l.code; land.appendChild(o); }
      o.textContent = l.name;
      o.disabled = !k; o.hidden = !k;
      if (k) { o.setAttribute('data-netto', k.netto); o.setAttribute('data-carrier', k.carrier); o.setAttribute('data-laufzeit', k.laufzeit); erste = erste || o; }
    });
    Array.prototype.forEach.call(land.options, function (o) {
      if (o.value && !angebot.laender.some(function (l) { return l.code === o.value; })) { o.disabled = true; o.hidden = true; }
    });
    if (land.value && land.options[land.selectedIndex].disabled) land.value = '';
    update();
  };
  var buildTable = function (d) {
    var body = document.querySelector('.price-table-wrap tbody');
    if (!body || !d.laender.length) return;
    var ab = body.querySelector('small') ? body.querySelector('small').textContent : (lang === 'de' ? 'ab' : 'from');
    var tpl = body.querySelector('tr');
    body.innerHTML = '';
    d.laender.forEach(function (l) {
      var tr = document.createElement('tr');
      var td = function (html) { var c = document.createElement('td'); tr.appendChild(c); return c; };
      var c1 = td(); var flag = document.createElement('span'); flag.className = 'flag'; flag.textContent = l.code; c1.appendChild(flag); c1.appendChild(document.createTextNode(l.name));
      td().textContent = l.carrier;
      td().textContent = l.laufzeit;
      var preisZelle = function (z) {
        var c = td(); c.className = 'price';
        if (!z) { c.textContent = '—'; return; }
        var sm = document.createElement('small'); sm.textContent = ab; c.appendChild(sm);
        var b = document.createElement('span'); b.setAttribute('data-for', 'business'); b.textContent = preis(z.netto); c.appendChild(b);
        var p = document.createElement('span'); p.setAttribute('data-for', 'private'); p.textContent = preis(z.brutto); c.appendChild(p);
      };
      preisZelle(l.ab && l.ab.brief);
      preisZelle(l.ab && l.ab.paket ? l.ab.paket : { netto: l.netto, brutto: l.brutto });
      body.appendChild(tr);
    });
    void tpl;
  };
  fetch(api + '/angebot.php?sprache=' + lang, { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.ok || !d.laender) return;
      mwst = d.mwst; modus = d.modus; bereit = !!d.bereit; angebot = d;
      if (gewicht && d.klassen) {
        klassenFuellen();
        gewicht.addEventListener('change', applyKlasse);
      }
      kategorieAnwenden();
      buildTable(d);
      if (!bereit) showError(msg('unavailable'));
    })
    .catch(function () { /* Markup-Preise bleiben; die Bestellung prüft ohnehin serverseitig */ });

  /* Angemeldeter Privatkunde (Kundenportal): E-Mail und Absender vorbelegen */
  var konto = sec.getAttribute('data-konto') || (api.indexOf('../') === 0 ? '../konto' : 'konto');
  fetch(konto + '/ich', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.angemeldet) return;
      var set = function (n, v) { var el = form.querySelector('[name="' + n + '"]'); if (el && !el.value && v) el.value = v; };
      set('email', d.email); set('absender.name', (d.absender && d.absender.name) || d.name);
      if (d.absender) { set('absender.strasse', d.absender.strasse); set('absender.plz', d.absender.plz); set('absender.ort', d.absender.ort); }
    })
    .catch(function () {});

  /* Validierung ---------------------------------------------------------- */
  var validate = function (input) {
    var wrap = input.closest('.field');
    var v = input.value.trim();
    var ok = input.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) : v.length >= (input.getAttribute('minlength') ? parseInt(input.getAttribute('minlength'), 10) : 1);
    if (input.tagName === 'SELECT') ok = v !== '';
    wrap.classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  };
  form.querySelectorAll('[required]').forEach(function (input) {
    input.addEventListener('blur', function () { validate(input); });
    input.addEventListener('input', function () { if (input.closest('.field').classList.contains('is-invalid')) validate(input); });
  });

  /* Zustände ------------------------------------------------------------- */
  var busy = function (on) { payBtn.disabled = on; form.classList.toggle('is-busy', on); };
  var showError = function (text) { errBox.textContent = text; errBox.hidden = false; };
  var clearError = function () { errBox.hidden = true; errBox.textContent = ''; };
  form.addEventListener('input', function () { if (!errBox.hidden) clearError(); });
  var showSuccess = function (ref, email, pending) {
    sum('bestellung').textContent = ref;
    sum('email').textContent = email;
    okBox.querySelector('[data-pending]').hidden = !pending;
    okBox.hidden = false;
    form.classList.add('is-paid');
    okBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  /* Revolut-SDK nachladen ------------------------------------------------ */
  var sdkPromise = null;
  var loadSdk = function (mode) {
    if (window.RevolutCheckout) return Promise.resolve(window.RevolutCheckout);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SDK[mode] || SDK.sandbox; s.async = true;
      var t = setTimeout(function () { reject(new Error('timeout')); }, 12000);
      s.onload = function () { clearTimeout(t); window.RevolutCheckout ? resolve(window.RevolutCheckout) : reject(new Error('no sdk')); };
      s.onerror = function () { clearTimeout(t); sdkPromise = null; reject(new Error('blocked')); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  };

  /* Status nach dem Popup abfragen -------------------------------------- */
  var pollStatus = function (ref, tries) {
    return fetch(api + '/status.php?id=' + encodeURIComponent(ref), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && (d.status === 'bezahlt' || d.status === 'autorisiert')) return d;
        if (tries <= 0) return d || {};
        return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return pollStatus(ref, tries - 1); });
      });
  };

  /* Absenden ------------------------------------------------------------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    var allOk = true, first = null;
    form.querySelectorAll('[required]').forEach(function (input) { var ok = validate(input); if (!ok) { allOk = false; first = first || input; } });
    if (!allOk) { first.focus(); showError(msg('invalid')); return; }

    var val = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    var payload = {
      sprache: lang,
      zielland: land.value,
      kategorie: kategorie(),
      gewichtsklasse: gewicht ? gewicht.value : '2kg',
      email: val('email'),
      firma: val('firma'),
      absender: { name: val('absender.name'), strasse: val('absender.strasse'), plz: val('absender.plz'), ort: val('absender.ort') },
      empfaenger: { name: val('empfaenger.name'), strasse: val('empfaenger.strasse'), plz: val('empfaenger.plz'), ort: val('empfaenger.ort') }
    };
    busy(true);

    fetch(api + '/bestellung.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (!d.ok || !d.token) {
          var code = d.fehler || 'network';
          throw new Error(code === 'nicht-eingerichtet' ? 'unavailable' : code === 'zu-viele' ? 'toomany' : code === 'ungueltig' ? 'invalid' : code === 'zahlungsdienst' ? 'failed' : 'network');
        }
        return loadSdk(d.modus || modus).then(function (RC) {
          return RC(d.token, d.modus || modus).then(function (instance) {
            instance.payWithPopup({
              email: payload.email,
              name: payload.absender.name,
              onSuccess: function () {
                pollStatus(d.bestellung, 6).then(function (s) {
                  busy(false);
                  showSuccess(d.bestellung, payload.email, !(s && (s.status === 'bezahlt' || s.status === 'autorisiert')));
                });
              },
              onError: function () { busy(false); showError(msg('failed')); },
              onCancel: function () { busy(false); showError(msg('cancelled')); }
            });
          });
        });
      })
      .catch(function (err) {
        busy(false);
        var k = (err && err.message) || 'network';
        showError(msg(['unavailable', 'toomany', 'invalid', 'failed', 'network', 'cancelled'].indexOf(k) >= 0 ? k : (k === 'blocked' || k === 'timeout' || k === 'no sdk' ? 'unavailable' : 'network')));
      });
  });

  /* Rücksprung nach 3-D-Secure: ?bestellung=NE-… → Status zeigen -------- */
  var q = new URLSearchParams(location.search);
  var back = q.get('bestellung');
  if (back && /^NE-\d{4}-[0-9A-F]{8}$/i.test(back)) {
    pollStatus(back.toUpperCase(), 3).then(function (s) {
      if (s && s.ok) showSuccess(s.bestellung, s.email || '', !(s.status === 'bezahlt' || s.status === 'autorisiert'));
    }).catch(function () {});
  }
})();
