/* Splendo — shared config for the /en/ and /it/ localized-URL generator.
   Used by both scripts/build.js (hreflang + lang-urls injection into the
   German source pages) and scripts/localize.js (the EN/IT page generator).
   Legal pages (impressum/agb/datenschutz/widerruf) are deliberately not
   listed here — they stay German-only at a single URL. */

const ROOT_URL = "https://splendo.eu";

const LOCALIZED_PAGES = [
  "index.html",
  "buchen.html",
  "preise.html",
  "ablauf.html",
  "ueber-uns.html",
  "team.html",
  "kontakt.html",
  "faq.html",
  "buchen-success.html"
];

// buchen-success.html is noindex (post-checkout landing page) — it still
// gets /en/ and /it/ copies so the redirect lands in the right language,
// but it's excluded from hreflang/hub navigation lists that only make
// sense for indexable pages.
const INDEXABLE_LOCALIZED_PAGES = LOCALIZED_PAGES.filter((p) => p !== "buchen-success.html");

const LANGS = ["de", "en", "it"];

const OG_LOCALE = { de: "de_DE", en: "en_US", it: "it_IT" };

// Breadcrumb "name" values (position 2 — position 1 is always Home).
// Must mirror the German text already hardcoded in each page's
// BreadcrumbList JSON-LD so the de-locale meaning doesn't drift.
const BREADCRUMB_LABELS = {
  "buchen.html": { de: "Buchen", en: "Book", it: "Prenota" },
  "preise.html": { de: "Preise", en: "Prices", it: "Prezzi" },
  "ablauf.html": { de: "So funktioniert's", en: "How it works", it: "Come funziona" },
  "ueber-uns.html": { de: "Über uns", en: "About us", it: "Chi siamo" },
  "team.html": { de: "Team", en: "Team", it: "Team" },
  "kontakt.html": { de: "Kontakt", en: "Contact", it: "Contatti" },
  "faq.html": { de: "FAQ", en: "FAQ", it: "FAQ" }
};

const HOME_BREADCRUMB_LABEL = { de: "Home", en: "Home", it: "Home" };

function pathFor(slug, lang) {
  if (slug === "index.html") return lang === "de" ? "/" : `/${lang}/`;
  return lang === "de" ? `/${slug}` : `/${lang}/${slug}`;
}

function urlFor(slug, lang) {
  return ROOT_URL + pathFor(slug, lang);
}

module.exports = {
  ROOT_URL,
  LOCALIZED_PAGES,
  INDEXABLE_LOCALIZED_PAGES,
  LANGS,
  OG_LOCALE,
  BREADCRUMB_LABELS,
  HOME_BREADCRUMB_LABEL,
  pathFor,
  urlFor
};
