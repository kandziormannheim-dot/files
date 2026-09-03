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
    payBtn.disabled = !has || !bereit;
  };
  land.addEventListener('change', update);
  update();

  /* Verbindliche Preise vom Server (überschreibt die Werte im Markup) ---- */
  fetch(api + '/angebot.php?sprache=' + lang, { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.ok) return;
      mwst = d.mwst; modus = d.modus; bereit = !!d.bereit;
      d.laender.forEach(function (l) {
        var o = land.querySelector('option[value="' + l.code + '"]');
        if (!o) return;
        o.setAttribute('data-netto', l.netto); o.setAttribute('data-carrier', l.carrier); o.setAttribute('data-laufzeit', l.laufzeit); o.textContent = l.name;
      });
      if (!bereit) showError(msg('unavailable'));
      update();
    })
    .catch(function () { /* Markup-Preise bleiben; die Bestellung prüft ohnehin serverseitig */ });

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
