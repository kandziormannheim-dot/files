/* NEOS Kundenportal — Handgriffe im Browser; alle Formulare laufen auch ohne JS,
   nur die Revolut-Zahlung (Popup) braucht es. Texte kommen aus data-* im Markup,
   damit dieselbe Datei für DE und EN gilt. */
(function () {
  'use strict';

  var lang = document.documentElement.lang === 'en' ? 'en' : 'de';
  var fmt = function (cent) {
    try { return new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(cent / 100); }
    catch (e) { return '€' + (cent / 100).toFixed(2); }
  };
  var centAus = function (text) {
    var t = String(text || '').trim().replace(/\s|€/g, '');
    if (t === '') return 0;
    if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(',', '.');
    var v = parseFloat(t);
    return isNaN(v) ? 0 : Math.round(v * 100);
  };
  var jsonAus = function (id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  };
  var SDK = { sandbox: 'https://sandbox-merchant.revolut.com/embed.js', prod: 'https://merchant.revolut.com/embed.js' };
  var sdkPromise = null;
  var loadSdk = function (mode) {
    if (window.RevolutCheckout) return Promise.resolve(window.RevolutCheckout);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SDK[mode] || SDK.sandbox; s.async = true;
      var t = setTimeout(function () { reject(new Error('unavailable')); }, 12000);
      s.onload = function () { clearTimeout(t); window.RevolutCheckout ? resolve(window.RevolutCheckout) : reject(new Error('unavailable')); };
      s.onerror = function () { clearTimeout(t); sdkPromise = null; reject(new Error('unavailable')); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  };
  var postForm = function (url, felder) {
    var body = new URLSearchParams();
    Object.keys(felder).forEach(function (k) { body.append(k, felder[k]); });
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'X-Requested-With': 'fetch' }, body: body.toString() })
      .then(function (r) { return r.json(); });
  };
  var getJson = function (url) {
    return fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
  };
  var warten = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };

  /* Bestätigung vor Konto schließen, Löschen, Retoure u. ä. */
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

  /* ------------------------------------------------------------ Neue Sendung
     Angebote je Land und Gewichtsklasse aus #angebote-daten, Gewicht → Klasse,
     Carrier-Karten als Radios, Zusatzleistungen mit Detailfeldern, Summen mit
     MwSt., Guthaben-Wahl, Vorlagen und Adressbuch-Vorbelegung. */
  var sendung = document.querySelector('.k-sendung');
  var daten = sendung ? jsonAus('angebote-daten') : null;
  if (sendung && daten) {
    var adressen = jsonAus('adressen-daten') || { absender: [], empfaenger: [], vorlagen: [] };
    var mwst = parseInt(sendung.getAttribute('data-mwst'), 10) || 19;
    var guthaben = parseInt(sendung.getAttribute('data-guthaben'), 10) || 0;
    var land = sendung.querySelector('[name="zielland"]');
    var gewicht = sendung.querySelector('[name="gewicht_kg"]');
    var klasseText = sendung.querySelector('[data-gewichtsklasse]');
    var angebote = sendung.querySelector('[data-angebote]');
    var gewaehlt = angebote.getAttribute('data-gewaehlt') || '';
    var summe = function (k) { return sendung.querySelector('[data-summe="' + k + '"]'); };
    var zusatzBoxen = Array.prototype.slice.call(sendung.querySelectorAll('input[name="zusatz[]"]'));
    var guthabenWahl = sendung.querySelector('[data-guthaben-wahl]');
    var guthabenText = sendung.querySelector('[data-guthaben-text]');
    var absenden = sendung.querySelector('button[type="submit"]');

    var klasseFuer = function (gramm) {
      var codes = Object.keys(daten.gewichtsklassen);
      for (var i = 0; i < codes.length; i++) {
        var max = daten.gewichtsklassen[codes[i]].max_gramm;
        if (max <= 0 || max >= gramm) return codes[i];
      }
      return null;
    };
    var volumenText = sendung.querySelector('[data-volumen]');
    var volumenVorlage = sendung.getAttribute('data-volumen-text') || '%s';
    var volumenHinweis = volumenText ? volumenText.textContent : '';
    /* Volumengewicht: L·B·H (cm) / Faktor des Carriers (kg) — hebt die Klasse an, wenn es das reale Gewicht übersteigt */
    var volumenGramm = function (faktor) {
      var l = parseInt(sendung.querySelector('[name="laenge"]').value, 10) || 0;
      var b = parseInt(sendung.querySelector('[name="breite"]').value, 10) || 0;
      var h = parseInt(sendung.querySelector('[name="hoehe"]').value, 10) || 0;
      if (l <= 0 || b <= 0 || h <= 0 || !(faktor > 0)) return 0;
      return Math.round(l * b * h / faktor * 1000);
    };
    var aktuelleKlasse = function () {
      var gramm = Math.round(parseFloat(String(gewicht.value).replace(',', '.')) * 1000);
      if (!(gramm > 0)) { if (volumenText) volumenText.textContent = volumenHinweis; return null; }
      var gk = klasseFuer(gramm);
      var l = daten.laender[land.value];
      var liste = gk && l && l.klassen[gk] ? l.klassen[gk] : [];
      var gewaehltCarrier = angebote.querySelector('input[name="carrier"]:checked');
      var faktor = 5000;
      liste.forEach(function (a, i) { if ((gewaehltCarrier && a.carrier === gewaehltCarrier.value) || (!gewaehltCarrier && i === 0)) faktor = a.volumenfaktor || 5000; });
      var volumen = volumenGramm(faktor);
      if (volumenText) volumenText.textContent = volumen > gramm ? volumenVorlage.replace('%s', (volumen / 1000).toFixed(1).replace('.', lang === 'de' ? ',' : '.')) : volumenHinweis;
      return klasseFuer(Math.max(gramm, volumen));
    };
    var aktuelleAngebote = function () {
      var gk = aktuelleKlasse();
      var l = daten.laender[land.value];
      return gk && l && l.klassen[gk] ? l.klassen[gk] : [];
    };
    var gewaehltesAngebot = function () {
      var r = angebote.querySelector('input[name="carrier"]:checked');
      if (!r) return null;
      var liste = aktuelleAngebote();
      for (var i = 0; i < liste.length; i++) if (liste[i].carrier === r.value) return liste[i];
      return null;
    };

    var angeboteZeichnen = function () {
      var gk = aktuelleKlasse();
      klasseText.textContent = gk ? daten.gewichtsklassen[gk].name : '';
      var liste = aktuelleAngebote();
      var vorher = angebote.querySelector('input[name="carrier"]:checked');
      var wunsch = vorher ? vorher.value : gewaehlt;
      angebote.innerHTML = '';
      if (!liste.length) {
        var leer = document.createElement('p'); leer.className = 'k-leer'; leer.textContent = angebote.getAttribute('data-leer'); angebote.appendChild(leer);
        summen(); return;
      }
      var treffer = liste.some(function (a) { return a.carrier === wunsch; });
      liste.forEach(function (a, i) {
        var label = document.createElement('label'); label.className = 'k-angebot' + (a.empfohlen ? ' k-angebot--empfohlen' : '');
        var r = document.createElement('input'); r.type = 'radio'; r.name = 'carrier'; r.value = a.carrier;
        r.checked = treffer ? a.carrier === wunsch : i === 0;
        var kopf = document.createElement('span'); kopf.className = 'k-angebot-kopf';
        var name = document.createElement('strong'); name.textContent = a.carrier; kopf.appendChild(name);
        if (a.empfohlen) { var tag = document.createElement('span'); tag.className = 'status status--bezahlt'; tag.textContent = angebote.getAttribute('data-empfohlen'); kopf.appendChild(tag); }
        var zeit = document.createElement('span'); zeit.className = 'k-klein'; zeit.textContent = a.laufzeit;
        var preis = document.createElement('span'); preis.className = 'k-angebot-preis';
        var n = document.createElement('strong'); n.className = 'k-mono'; n.textContent = fmt(a.netto);
        var b = document.createElement('span'); b.className = 'k-klein'; b.textContent = angebote.getAttribute('data-brutto') + ' ' + fmt(a.brutto);
        preis.appendChild(n); preis.appendChild(b);
        label.appendChild(r); var mitte = document.createElement('span'); mitte.className = 'k-angebot-mitte'; mitte.appendChild(kopf); mitte.appendChild(zeit); label.appendChild(mitte); label.appendChild(preis);
        angebote.appendChild(label);
      });
      summen();
    };

    var summen = function () {
      var a = gewaehltesAngebot();
      var zusatz = 0;
      zusatzBoxen.forEach(function (cb) {
        if (cb.checked) zusatz += parseInt(cb.getAttribute('data-preis'), 10) || 0;
        var detail = sendung.querySelector('[data-zusatz-detail="' + cb.value + '"]');
        if (detail) detail.hidden = !cb.checked;
      });
      var porto = a ? a.netto : 0;
      var netto = porto + zusatz;
      var brutto = Math.round(netto * (100 + mwst) / 100);
      summe('carrier').textContent = a ? a.carrier : '—';
      summe('laufzeit').textContent = a ? a.laufzeit : '—';
      summe('porto').textContent = a ? fmt(porto) : '—';
      summe('zusatz').textContent = a ? fmt(zusatz) : '—';
      summe('netto').textContent = a ? fmt(netto) : '—';
      summe('mwst').textContent = a ? fmt(brutto - netto) : '—';
      summe('brutto').textContent = a ? fmt(brutto) : '—';
      if (guthabenWahl && guthabenText) {
        var reicht = !a || guthaben >= brutto;
        guthabenText.textContent = guthabenText.getAttribute(reicht ? 'data-reicht' : 'data-knapp');
        guthabenWahl.disabled = !reicht;
        if (!reicht && guthabenWahl.checked) {
          var andere = sendung.querySelector('input[name="zahlungsart"]:not([data-guthaben-wahl]):not(:disabled)');
          if (andere) andere.checked = true;
        }
      }
      if (absenden) absenden.disabled = !a;
    };

    land.addEventListener('change', angeboteZeichnen);
    gewicht.addEventListener('input', angeboteZeichnen);
    ['laenge', 'breite', 'hoehe'].forEach(function (n) { var el = sendung.querySelector('[name="' + n + '"]'); if (el) el.addEventListener('input', angeboteZeichnen); });
    angebote.addEventListener('change', summen);
    zusatzBoxen.forEach(function (cb) { cb.addEventListener('change', summen); });

    /* Paketvorlage: Gewicht, Maße, Zusatzleistungen übernehmen */
    var vorlage = sendung.querySelector('[data-vorlage]');
    if (vorlage) {
      vorlage.addEventListener('change', function () {
        var v = adressen.vorlagen.filter(function (x) { return String(x.id) === vorlage.value; })[0];
        if (!v) return;
        gewicht.value = (v.gewicht_gramm / 1000).toFixed(2).replace('.', lang === 'de' ? ',' : '.');
        sendung.querySelector('[name="laenge"]').value = v.laenge_cm > 0 ? v.laenge_cm : '';
        sendung.querySelector('[name="breite"]').value = v.breite_cm > 0 ? v.breite_cm : '';
        sendung.querySelector('[name="hoehe"]').value = v.hoehe_cm > 0 ? v.hoehe_cm : '';
        zusatzBoxen.forEach(function (cb) { cb.checked = (v.zusatz || []).indexOf(cb.value) >= 0; });
        angeboteZeichnen();
      });
    }

    /* Unterkunde (Rechnungsempfänger) wechseln: Seite mit dessen Preisliste und Absender neu laden */
    var unterkundeWahl = sendung.querySelector('[data-unterkunde-wahl]');
    if (unterkundeWahl) {
      unterkundeWahl.addEventListener('change', function () {
        window.location.href = unterkundeWahl.getAttribute('data-url') + '?unterkunde=' + encodeURIComponent(unterkundeWahl.value);
      });
    }

    /* Adressbuch: Empfänger bzw. Absender vorbelegen */
    sendung.querySelectorAll('[data-adresswahl]').forEach(function (wahl) {
      var rolle = wahl.getAttribute('data-adresswahl');
      wahl.addEventListener('change', function () {
        var a = (adressen[rolle] || []).filter(function (x) { return String(x.id) === wahl.value; })[0];
        if (!a) return;
        ['name', 'firma', 'strasse', 'plz', 'ort', 'email', 'telefon', 'land'].forEach(function (f) {
          var el = sendung.querySelector('[name="' + rolle + '[' + f + ']"]');
          if (el) { el.value = a[f] || ''; el.closest('.field') && el.closest('.field').classList.remove('is-invalid'); }
        });
        if (rolle === 'empfaenger' && a.land && daten.laender[a.land]) { land.value = a.land; angeboteZeichnen(); }
      });
    });

    sendung.addEventListener('input', function (e) { var f = e.target.closest('.field'); if (f) f.classList.remove('is-invalid'); });
    angeboteZeichnen();
  }

  /* ------------------------------------------------- Sammeldruck der Labels */
  var auswahl = document.querySelector('[data-labelauswahl]');
  if (auswahl) {
    var boxen = Array.prototype.slice.call(auswahl.querySelectorAll('[data-label-ref]'));
    var alle = auswahl.querySelector('[data-alle]');
    var knopf = auswahl.querySelector('[data-labels-drucken]');
    var stand = function () {
      var refs = boxen.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      if (knopf) knopf.disabled = refs.length === 0;
      if (alle) alle.checked = boxen.length > 0 && refs.length === boxen.length;
      return refs;
    };
    boxen.forEach(function (b) { b.addEventListener('change', stand); });
    if (alle) alle.addEventListener('change', function () { boxen.forEach(function (b) { b.checked = alle.checked; }); stand(); });
    if (knopf) knopf.addEventListener('click', function () {
      var refs = stand();
      if (refs.length) window.open(auswahl.getAttribute('data-url') + '?refs=' + encodeURIComponent(refs.join(',')), '_blank', 'noopener');
    });
    stand();
  }

  /* ------------------------------------------- Revolut-Popup (Sendung zahlen) */
  var bezahlen = document.querySelector('[data-bezahlen]');
  if (bezahlen) {
    var bKnopf = bezahlen.querySelector('[data-bezahlen-knopf]');
    var bFehler = bezahlen.querySelector('[data-fehler]');
    var bStatus = bezahlen.querySelector('[data-status-text]');
    var bMsg = function (k) { return bezahlen.getAttribute('data-msg-' + k) || k; };
    var bZeigen = function (text, ok) { bFehler.textContent = text; bFehler.hidden = false; bFehler.classList.toggle('k-hinweis--ok', !!ok); bFehler.classList.toggle('k-hinweis--fehler', !ok); };
    var bStatusAbfragen = function (versuche) {
      return getJson(bezahlen.getAttribute('data-status-url')).then(function (d) {
        if (d && d.ok && (d.status === 'bezahlt' || d.status === 'autorisiert' || d.status === 'beauftragt')) return d;
        if (versuche <= 0) return d || {};
        return warten(1500).then(function () { return bStatusAbfragen(versuche - 1); });
      });
    };
    var bFertig = function () {
      bStatus.textContent = bMsg('warten');
      return bStatusAbfragen(6).then(function (d) {
        if (d && d.ok && d.status !== 'angelegt' && d.status !== 'offen' && d.status !== 'fehlgeschlagen') {
          bZeigen(bMsg('erfolg'), true);
          if (bKnopf) bKnopf.hidden = true;
          setTimeout(function () { location.href = bezahlen.getAttribute('data-weiter'); }, 1200);
        } else {
          bZeigen(bMsg('warten'), true);
        }
      });
    };
    if (bKnopf) bKnopf.addEventListener('click', function () {
      bKnopf.disabled = true; bFehler.hidden = true;
      postForm(bezahlen.getAttribute('data-token-url'), { csrf: bezahlen.getAttribute('data-csrf') })
        .then(function (d) {
          if (!d || !d.ok || !d.token) throw new Error(d && d.fehler === 'nicht-eingerichtet' ? 'unavailable' : 'fehler');
          var modus = d.modus || bezahlen.getAttribute('data-modus') || 'sandbox';
          return loadSdk(modus).then(function (RC) {
            return RC(d.token, modus).then(function (instance) {
              instance.payWithPopup({
                email: bezahlen.getAttribute('data-email') || undefined,
                name: bezahlen.getAttribute('data-name') || undefined,
                onSuccess: function () { bFertig().then(function () { bKnopf.disabled = false; }); },
                onError: function () { bKnopf.disabled = false; bZeigen(bMsg('fehler')); },
                onCancel: function () { bKnopf.disabled = false; bZeigen(bMsg('abbruch')); }
              });
            });
          });
        })
        .catch(function (err) { bKnopf.disabled = false; bZeigen(bMsg(err && err.message === 'unavailable' ? 'unavailable' : 'fehler')); });
    });
    /* Rücksprung nach 3-D-Secure: Status nachziehen */
    if (bezahlen.getAttribute('data-zurueck')) bFertig();
  }

  /* -------------------------------------------------- Guthaben aufladen */
  var aufladen = document.querySelector('[data-aufladen]');
  if (aufladen) {
    var aKnopf = aufladen.querySelector('[data-aufladen-knopf]');
    var aFeld = aufladen.querySelector('[data-betrag-feld]');
    var aFehler = aufladen.querySelector('[data-fehler]');
    var aOk = aufladen.querySelector('[data-ok]');
    var aStand = document.querySelector('[data-guthaben-stand]');
    var aMsg = function (k) { return aufladen.getAttribute('data-msg-' + k) || k; };
    var aZeigen = function (el, text) { aFehler.hidden = true; aOk.hidden = true; el.textContent = text; el.hidden = false; };
    aufladen.querySelectorAll('[data-betrag]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = parseInt(b.getAttribute('data-betrag'), 10);
        aFeld.value = (c / 100).toFixed(2).replace('.', lang === 'de' ? ',' : '.');
        aufladen.querySelectorAll('[data-betrag]').forEach(function (x) { x.classList.toggle('is-aktiv', x === b); });
      });
    });
    var aStatusAbfragen = function (ref, versuche) {
      return getJson(aufladen.getAttribute('data-status-url') + '?ref=' + encodeURIComponent(ref)).then(function (d) {
        if (d && d.ok && d.status === 'bezahlt') return d;
        if (versuche <= 0) return d || {};
        return warten(1500).then(function () { return aStatusAbfragen(ref, versuche - 1); });
      });
    };
    var aFertig = function (ref) {
      aZeigen(aOk, aMsg('warten'));
      return aStatusAbfragen(ref, 6).then(function (d) {
        if (d && d.ok && d.status === 'bezahlt') {
          aZeigen(aOk, aMsg('erfolg'));
          if (aStand && typeof d.guthaben === 'number') aStand.textContent = fmt(d.guthaben);
          setTimeout(function () { location.href = location.pathname + (lang === 'en' ? '?sprache=en' : ''); }, 1500);
        } else {
          aZeigen(aOk, aMsg('warten'));
        }
      });
    };
    if (aKnopf) aKnopf.addEventListener('click', function () {
      var cent = centAus(aFeld.value);
      if (cent < 500 || cent > 500000) { aZeigen(aFehler, aMsg('betrag')); aFeld.focus(); return; }
      aKnopf.disabled = true; aFehler.hidden = true;
      postForm(aufladen.getAttribute('data-url'), { csrf: aufladen.getAttribute('data-csrf'), betrag: aFeld.value })
        .then(function (d) {
          if (!d || !d.ok || !d.token) throw new Error(d && d.fehler === 'betrag' ? 'betrag' : d && d.fehler === 'nicht-eingerichtet' ? 'unavailable' : 'fehler');
          var modus = d.modus || aufladen.getAttribute('data-modus') || 'sandbox';
          return loadSdk(modus).then(function (RC) {
            return RC(d.token, modus).then(function (instance) {
              instance.payWithPopup({
                email: aufladen.getAttribute('data-email') || undefined,
                name: aufladen.getAttribute('data-name') || undefined,
                onSuccess: function () { aFertig(d.ref).then(function () { aKnopf.disabled = false; }); },
                onError: function () { aKnopf.disabled = false; aZeigen(aFehler, aMsg('fehler')); },
                onCancel: function () { aKnopf.disabled = false; aZeigen(aFehler, aMsg('abbruch')); }
              });
            });
          });
        })
        .catch(function (err) {
          aKnopf.disabled = false;
          var k = err && err.message;
          aZeigen(aFehler, aMsg(k === 'betrag' ? 'betrag' : k === 'unavailable' ? 'unavailable' : 'fehler'));
        });
    });
    /* Rücksprung nach 3-D-Secure: ?aufladung=NG-… */
    var rueck = aufladen.getAttribute('data-rueck');
    if (rueck) aFertig(rueck);
  }
})();
