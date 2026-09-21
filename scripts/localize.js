#!/usr/bin/env node
/* Splendo — generates the /en/ and /it/ static pages from the German
   source pages, so each language gets its own indexable URL (required
   for hreflang to mean anything to Google — a client-side language
   switch on a single URL doesn't).

   Source of truth stays the German .html file: its own
   window.SPLENDO_I18N_PAGE dict + i18n-common.js's SPLENDO_I18N_COMMON
   already carry the en/it translations (used until now only for the
   client-side switcher). This script statically pre-renders them into
   real HTML for /en/<page> and /it/<page>, the same way i18n.js's
   applyLanguage() would at runtime, so the correct-language content is
   there even with JavaScript off.

   Run `npm run sync-partials` after editing translations or the page
   structure (that runs build.js first, then this). `--check` (used by
   `npm test` / the pre-push hook) fails if the committed /en/ or /it/
   files are out of sync with what this would generate. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const cheerio = require("cheerio");
const {
  ROOT_URL,
  LOCALIZED_PAGES,
  LANGS,
  OG_LOCALE,
  BREADCRUMB_LABELS,
  HOME_BREADCRUMB_LABEL,
  pathFor,
  urlFor
} = require("./i18n-pages-config");

const ROOT = path.join(__dirname, "..");
const GENERATED_LANGS = LANGS.filter((l) => l !== "de");

function extractDict(content, varName) {
  const re = new RegExp(`window\\.${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});`);
  const m = content.match(re);
  if (!m) return null;
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  return vm.runInContext(`(${m[1]})`, sandbox);
}

function makeTranslator(pageDict, commonDict, lang) {
  return function t(key) {
    if (pageDict[lang] && Object.prototype.hasOwnProperty.call(pageDict[lang], key)) return pageDict[lang][key];
    if (commonDict[lang] && Object.prototype.hasOwnProperty.call(commonDict[lang], key)) return commonDict[lang][key];
    if (pageDict.de && Object.prototype.hasOwnProperty.call(pageDict.de, key)) return pageDict.de[key];
    if (commonDict.de && Object.prototype.hasOwnProperty.call(commonDict.de, key)) return commonDict.de[key];
    return key;
  };
}

// Rewrites an internal <a href> to its lang-prefixed sibling when it
// points at one of the localized pages ("/" or "/slug.html"). Links to
// legal pages, external sites, mailto:, wa.me and anchors pass through
// untouched — those don't have a localized counterpart.
function rewriteHref(href, lang) {
  if (href === "/") return pathFor("index.html", lang);
  const m = href.match(/^\/([\w-]+\.html)$/);
  if (m && LOCALIZED_PAGES.includes(m[1])) return pathFor(m[1], lang);
  return href;
}

function localizePage(sourceHtml, slug, lang, pageDict, commonDict) {
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const t = makeTranslator(pageDict, commonDict, lang);

  $("[data-i18n]").each((_, el) => { $(el).text(t($(el).attr("data-i18n"))); });
  $("[data-i18n-html]").each((_, el) => { $(el).html(t($(el).attr("data-i18n-html"))); });
  $("[data-i18n-placeholder]").each((_, el) => { $(el).attr("placeholder", t($(el).attr("data-i18n-placeholder"))); });
  $("[data-i18n-aria-label]").each((_, el) => { $(el).attr("aria-label", t($(el).attr("data-i18n-aria-label"))); });
  $('meta[data-i18n-content]').each((_, el) => { $(el).attr("content", t($(el).attr("data-i18n-content"))); });
  $('title[data-i18n-content]').each((_, el) => { $(el).text(t($(el).attr("data-i18n-content"))); });

  $("html").attr("lang", lang);
  $('link[rel="canonical"]').attr("href", urlFor(slug, lang));
  $('meta[property="og:url"]').attr("content", urlFor(slug, lang));
  $('meta[property="og:locale"]').attr("content", OG_LOCALE[lang]);

  $(".lang-btn").each((_, el) => {
    $(el).toggleClass("is-active", $(el).attr("data-lang") === lang);
  });

  // BreadcrumbList is page-specific structured data (added outside the
  // synced LDJSON block) — localize its names/URLs. FAQPage is dropped
  // on generated pages: its accepted-answer text isn't independently
  // translated, and mismatched-language rich snippets are worse than none.
  $('script[type="application/ld+json"]').each((_, el) => {
    let json;
    try { json = JSON.parse($(el).text()); } catch (e) { return; }
    if (json["@type"] === "BreadcrumbList") {
      json.itemListElement = json.itemListElement.map((item) => {
        if (item.position === 1) {
          return Object.assign({}, item, { name: HOME_BREADCRUMB_LABEL[lang], item: urlFor("index.html", lang) });
        }
        const label = BREADCRUMB_LABELS[slug];
        return Object.assign({}, item, { name: label ? label[lang] : item.name, item: urlFor(slug, lang) });
      });
      $(el).text(JSON.stringify(json, null, 2));
    } else if (json["@type"] === "FAQPage") {
      $(el).remove();
    }
  });

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const rewritten = rewriteHref(href, lang);
    if (rewritten !== href) $(el).attr("href", rewritten);
  });

  return $.html();
}

function main() {
  const checkOnly = process.argv.includes("--check");
  let changed = 0;
  let failed = 0;

  const commonDict = extractDict(fs.readFileSync(path.join(ROOT, "i18n-common.js"), "utf-8"), "SPLENDO_I18N_COMMON");

  for (const slug of LOCALIZED_PAGES) {
    const sourcePath = path.join(ROOT, slug);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`  skip  ${slug} (source not found)`);
      continue;
    }
    const sourceHtml = fs.readFileSync(sourcePath, "utf-8");
    const pageDict = extractDict(sourceHtml, "SPLENDO_I18N_PAGE");
    if (!pageDict) {
      console.error(`  FAIL  ${slug} — no SPLENDO_I18N_PAGE dict found`);
      failed++;
      continue;
    }

    for (const lang of GENERATED_LANGS) {
      const outPath = path.join(ROOT, lang, slug);
      const generated = localizePage(sourceHtml, slug, lang, pageDict, commonDict);
      const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf-8") : null;

      if (existing === generated) {
        console.log(`  ok    ${lang}/${slug} (already up to date)`);
        continue;
      }

      if (checkOnly) {
        console.error(`  FAIL  ${lang}/${slug} — out of sync (run 'npm run sync-partials')`);
        failed++;
      } else {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, generated, "utf-8");
        console.log(`  built ${lang}/${slug}`);
        changed++;
      }
    }
  }

  if (checkOnly) {
    console.log(`\nlocalize --check: ${failed === 0 ? "all localized pages in sync" : failed + " page(s) out of sync"}`);
  } else {
    console.log(`\nlocalize: ${changed} page(s) updated`);
  }
  if (failed > 0) process.exit(1);
}

main();
