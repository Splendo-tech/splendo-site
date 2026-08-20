/* Splendo — i18n.js
   Motore di traduzione minimale, senza framework. Lingua default: tedesco (de).
   Ogni pagina definisce window.SPLENDO_I18N_PAGE = { de: {...}, en: {...} }
   prima di includere questo script. I dizionari comuni (header/footer) sono
   in i18n-common.js. */

(function () {
  "use strict";

  var STORAGE_KEY = "splendo-lang";
  var DEFAULT_LANG = "de";

  function getSavedLang() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    return saved === "de" || saved === "en" ? saved : DEFAULT_LANG;
  }

  function buildDict() {
    var common = window.SPLENDO_I18N_COMMON || { de: {}, en: {} };
    var page = window.SPLENDO_I18N_PAGE || { de: {}, en: {} };
    return {
      de: Object.assign({}, common.de, page.de),
      en: Object.assign({}, common.en, page.en)
    };
  }

  function t(key, lang) {
    var dict = buildDict();
    var table = dict[lang] || dict[DEFAULT_LANG];
    if (table && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    var fallback = dict[DEFAULT_LANG];
    return fallback && fallback[key] !== undefined ? fallback[key] : key;
  }

  var currentLang = getSavedLang();
  window.SPLENDO_T = function (key) { return t(key, currentLang); };
  window.SPLENDO_GET_LANG = function () { return currentLang; };

  function applyLanguage(lang) {
    currentLang = lang === "en" ? "en" : "de";
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

    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang") === currentLang);
    });

    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) {}
    document.dispatchEvent(new CustomEvent("splendo:langchange", { detail: { lang: currentLang } }));
  }
  window.SPLENDO_SET_LANG = applyLanguage;

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { applyLanguage(btn.getAttribute("data-lang")); });
    });
    applyLanguage(currentLang);
  });
})();
