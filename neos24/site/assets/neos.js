/* neos24.com — Verhalten. Keine Abhängigkeiten.
   Alles hier ist Komfort: Die Seite funktioniert ohne JS vollständig
   (Reveal-Klassen greifen nur, wenn <html class="js"> gesetzt ist). */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Burger-Menü ------------------------------------------------------------ */
  var header = document.querySelector('.site-header');
  var burger = document.querySelector('.burger');
  if (header && burger) {
    var setOpen = function (open) {
      header.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? (burger.dataset.labelClose || 'Close menu') : (burger.dataset.labelOpen || 'Open menu'));
    };
    burger.addEventListener('click', function () {
      setOpen(!header.classList.contains('nav-open'));
    });
    header.querySelectorAll('.mobile-nav a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) { setOpen(false); burger.focus(); }
    });
  }

  /* Scroll-Reveal ---------------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* FAQ: immer nur ein Eintrag offen (Fallback für Browser ohne details[name]) */
  var faqItems = document.querySelectorAll('.faq details');
  faqItems.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      faqItems.forEach(function (o) { if (o !== d && o.open) o.open = false; });
    });
  });

  /* Formular-Validierung --------------------------------------------------- */
  var form = document.querySelector('.form');
  if (form) {
    var fields = form.querySelectorAll('[required]');
    var validate = function (input) {
      var wrap = input.closest('.field');
      var ok = input.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim()) : input.value.trim() !== '';
      wrap.classList.toggle('is-invalid', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      return ok;
    };
    fields.forEach(function (input) {
      input.addEventListener('blur', function () { validate(input); });
      input.addEventListener('input', function () { if (input.closest('.field').classList.contains('is-invalid')) validate(input); });
    });
    form.addEventListener('submit', function (e) {
      var allOk = true, first = null;
      fields.forEach(function (input) { var ok = validate(input); if (!ok) { allOk = false; first = first || input; } });
      if (!allOk) { e.preventDefault(); first.focus(); return; }
      /* Gültig: Formular geht an sein action-Ziel (Platzhalter mailto) und
         zeigt die Bestätigung. Mit echtem Backend hier fetch() einsetzen. */
      form.classList.add('is-sent');
    });
  }

  /* Aktiven Nav-Punkt markieren -------------------------------------------- */
  var navLinks = document.querySelectorAll('.nav a[href^="#"]');
  var sections = Array.prototype.map.call(navLinks, function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if (sections.length && 'IntersectionObserver' in window) {
    var active = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + entry.target.id;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { active.observe(s); });
  }
})();
