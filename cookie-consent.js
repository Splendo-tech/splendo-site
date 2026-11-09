/* Splendo - cookie-consent.js
   Cookie banner + Google Ads conversion tracking, loaded on every page via
   the footer partial. Nothing from Google is requested until the visitor
   clicks "Alle akzeptieren":
   - Consent Mode v2 is declared "denied" up front (dataLayer only, no network).
   - gtag.js is injected only after consent; the choice lives in localStorage.
   - On /buchen-success.html (where Stripe sends the customer after saving
     the card) one "Book appointment" conversion is sent per booking, and
     only with consent.
   Texts come from i18n-common.js (cookie_* / footer_cookie_settings). */

(function () {
  "use strict";

  var AW_ID = "AW-18508487140";
  var CONVERSION_SEND_TO = "AW-18508487140/r8YTCJ6MlpodEOSzxPlE";
  var STORAGE_KEY = "splendo-cookie-consent";
  var STORAGE_VERSION = 1;
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

  var DENIED = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" };
  // analytics_storage stays denied: Google Analytics is not used on this site.
  // ad_personalization stays denied on purpose: the banner and the privacy
  // policy promise conversion measurement only, no remarketing.
  var GRANTED = { ad_storage: "granted", ad_user_data: "granted" };

  var FALLBACK_DE = {
    cookie_banner_title: "Cookies & Datenschutz",
    cookie_banner_text: "Mit Google Ads messen wir, ob eine Buchung über eine unserer Anzeigen zustande kommt. Dafür setzt Google Cookies, aber nur mit deiner Zustimmung. Ohne Zustimmung werden keine Daten an Google gesendet. Mehr dazu in unserer <a href=\"/datenschutz.html\">Datenschutzerklärung</a>.",
    cookie_accept: "Alle akzeptieren",
    cookie_necessary: "Nur notwendige"
  };

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag("consent", "default", DENIED);

  var tagStarted = false;
  var memoryConsent = null;
  var banner = null;

  function t(key) {
    var value = window.SPLENDO_T ? window.SPLENDO_T(key) : key;
    return value === key && FALLBACK_DE[key] ? FALLBACK_DE[key] : value;
  }

  function readConsent() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    var data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch (e) { data = null; }
    } else {
      data = memoryConsent;
    }
    if (!data || data.v !== STORAGE_VERSION || typeof data.marketing !== "boolean" || typeof data.ts !== "number") return null;
    if (Date.now() - data.ts > MAX_AGE_MS) return null;
    return data;
  }

  function saveConsent(marketing) {
    var data = { v: STORAGE_VERSION, marketing: marketing, ts: Date.now() };
    memoryConsent = data;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function deleteGoogleCookies() {
    var host = location.hostname;
    var parts = host.split(".");
    var domains = ["", host, "." + host];
    if (parts.length > 2) domains.push("." + parts.slice(-2).join("."));
    document.cookie.split(";").forEach(function (pair) {
      var name = pair.split("=")[0].trim();
      if (!/^(_gcl_|_gac_)/.test(name)) return;
      domains.forEach(function (domain) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (domain ? "; domain=" + domain : "");
      });
    });
  }

  function isSuccessPage() {
    return /\/buchen-success\.html$/.test(location.pathname);
  }

  function sendConversionOnce() {
    if (!isSuccessPage()) return;
    var match = location.search.match(/[?&]session_id=(cs_(?:live|test)_[A-Za-z0-9]+)/);
    if (!match) return;
    var key = "splendo-conversion-sent-" + match[1];
    var alreadySent = false;
    try {
      alreadySent = !!localStorage.getItem(key);
      if (!alreadySent) localStorage.setItem(key, "1");
    } catch (e) {
      try {
        alreadySent = !!sessionStorage.getItem(key);
        if (!alreadySent) sessionStorage.setItem(key, "1");
      } catch (e2) {}
    }
    if (alreadySent) return;
    gtag("event", "conversion", { "send_to": CONVERSION_SEND_TO, "value": 1.0, "currency": "EUR" });
  }

  function grant() {
    gtag("consent", "update", GRANTED);
    if (!tagStarted) {
      tagStarted = true;
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + AW_ID;
      document.head.appendChild(script);
      gtag("js", new Date());
      gtag("config", AW_ID, { "allow_ad_personalization_signals": false });
    }
    sendConversionOnce();
  }

  function revoke() {
    gtag("consent", "update", DENIED);
    deleteGoogleCookies();
  }

  function renderTexts() {
    if (!banner) return;
    banner.querySelector("#cookie-banner-title").textContent = t("cookie_banner_title");
    banner.querySelector("#cookie-banner-text").innerHTML = t("cookie_banner_text");
    banner.querySelector('[data-cookie="accept"]').textContent = t("cookie_accept");
    banner.querySelector('[data-cookie="necessary"]').textContent = t("cookie_necessary");
  }

  function buildBanner() {
    banner = document.createElement("div");
    banner.className = "cookie-banner";
    banner.id = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "cookie-banner-title");
    banner.setAttribute("aria-describedby", "cookie-banner-text");
    banner.hidden = true;
    banner.innerHTML =
      '<p class="cookie-banner-title" id="cookie-banner-title"></p>' +
      '<p class="cookie-banner-text" id="cookie-banner-text"></p>' +
      '<div class="cookie-banner-actions">' +
        '<button type="button" class="cookie-btn" data-cookie="accept"></button>' +
        '<button type="button" class="cookie-btn" data-cookie="necessary"></button>' +
      '</div>';
    document.body.appendChild(banner);

    banner.querySelector('[data-cookie="accept"]').addEventListener("click", function () {
      saveConsent(true);
      hideBanner();
      grant();
    });
    banner.querySelector('[data-cookie="necessary"]').addEventListener("click", function () {
      saveConsent(false);
      hideBanner();
      revoke();
    });
  }

  function showBanner(moveFocus) {
    renderTexts();
    banner.hidden = false;
    if (moveFocus) banner.querySelector('[data-cookie="accept"]').focus();
  }

  function hideBanner() {
    banner.hidden = true;
  }

  function init() {
    buildBanner();

    document.addEventListener("click", function (event) {
      var link = event.target.closest ? event.target.closest("[data-cookie-settings]") : null;
      if (!link) return;
      event.preventDefault();
      showBanner(true);
    });
    document.addEventListener("splendo:langchange", renderTexts);

    var consent = readConsent();
    if (!consent) {
      showBanner(false);
    } else if (consent.marketing) {
      grant();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
