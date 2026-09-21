/* Splendo — i18n.js
   Motore di traduzione minimale, senza framework. Lingua default: tedesco (de).
   Ogni pagina definisce window.SPLENDO_I18N_PAGE = { de: {...}, en: {...}, it: {...} }
   prima di includere questo script. I dizionari comuni (header/footer) sono
   in i18n-common.js.

   Localized pages (the ones generated under /en/ and /it/ by
   scripts/localize.js) declare window.SPLENDO_LANG_URLS = {de,en,it} —
   the language IS the URL there, so the switcher navigates to the
   sibling URL instead of swapping the DOM, and the current language is
   read from the page's own <html lang> rather than a saved preference.
   Pages without that map (the German-only legal pages) keep the old
   behavior: the switcher re-renders the header/footer in place and
   remembers the choice in localStorage. */

(function () {
  "use strict";

  var STORAGE_KEY = "splendo-lang";
  var DEFAULT_LANG = "de";
  var LANGS = ["de", "en", "it"];
  var LOCALIZED_URLS = window.SPLENDO_LANG_URLS || null;

  function getSavedLang() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    return LANGS.indexOf(saved) !== -1 ? saved : DEFAULT_LANG;
  }

  function getPageLang() {
    var pageLang = document.documentElement.getAttribute("lang");
    return LANGS.indexOf(pageLang) !== -1 ? pageLang : DEFAULT_LANG;
  }

  function buildDict() {
    var common = window.SPLENDO_I18N_COMMON || { de: {}, en: {}, it: {} };
    var page = window.SPLENDO_I18N_PAGE || { de: {}, en: {}, it: {} };
    return {
      de: Object.assign({}, common.de, page.de),
      en: Object.assign({}, common.en, page.en),
      it: Object.assign({}, common.it, page.it)
    };
  }

  function t(key, lang) {
    var dict = buildDict();
    var table = dict[lang] || dict[DEFAULT_LANG];
    if (table && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    var fallback = dict[DEFAULT_LANG];
    return fallback && fallback[key] !== undefined ? fallback[key] : key;
  }

  var currentLang = LOCALIZED_URLS ? getPageLang() : getSavedLang();
  window.SPLENDO_T = function (key) { return t(key, currentLang); };
  window.SPLENDO_GET_LANG = function () { return currentLang; };

  function applyLanguage(lang) {
    currentLang = LANGS.indexOf(lang) !== -1 ? lang : DEFAULT_LANG;
    document.documentElement.setAttribute("lang", currentLang);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"), currentLang);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"), currentLang);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder"), currentLang));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label"), currentLang));
    });
    var descMeta = document.querySelector('meta[name="description"][data-i18n-content]');
    if (descMeta) descMeta.setAttribute("content", t(descMeta.getAttribute("data-i18n-content"), currentLang));
    var ogDescMeta = document.querySelector('meta[property="og:description"][data-i18n-content]');
    if (ogDescMeta) ogDescMeta.setAttribute("content", t(ogDescMeta.getAttribute("data-i18n-content"), currentLang));
    var titleEl = document.querySelector("title[data-i18n-content]");
    if (titleEl) document.title = t(titleEl.getAttribute("data-i18n-content"), currentLang);
    var ogTitleMeta = document.querySelector('meta[property="og:title"][data-i18n-content]');
    if (ogTitleMeta) ogTitleMeta.setAttribute("content", t(ogTitleMeta.getAttribute("data-i18n-content"), currentLang));

    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang") === currentLang);
    });

    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) {}
    document.dispatchEvent(new CustomEvent("splendo:langchange", { detail: { lang: currentLang } }));
  }
  window.SPLENDO_SET_LANG = applyLanguage;

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-lang");

        if (LOCALIZED_URLS) {
          if (target === currentLang) { closeMobileNav(); return; }
          var proceed = typeof window.SPLENDO_BEFORE_LANG_SWITCH === "function"
            ? window.SPLENDO_BEFORE_LANG_SWITCH(target)
            : true;
          if (proceed && LOCALIZED_URLS[target]) {
            window.location.href = LOCALIZED_URLS[target];
          }
          closeMobileNav();
          return;
        }

        applyLanguage(target);
        closeMobileNav();
      });
    });
    applyLanguage(currentLang);

    var header = document.querySelector(".site-header");
    var hamburger = document.querySelector(".hamburger-btn");
    function closeMobileNav() {
      if (header) header.classList.remove("nav-open");
      if (hamburger) hamburger.setAttribute("aria-expanded", "false");
    }
    if (hamburger && header) {
      hamburger.addEventListener("click", function () {
        var isOpen = header.classList.toggle("nav-open");
        hamburger.setAttribute("aria-expanded", String(isOpen));
      });
      header.querySelectorAll(".main-nav a, .header-actions a").forEach(function (link) {
        link.addEventListener("click", closeMobileNav);
      });
    }
  });
})();
