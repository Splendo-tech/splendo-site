#!/usr/bin/env node
/* Splendo — regenerates the header/footer/JSON-LD blocks in every page from
   the shared partials in /_partials, replacing everything between the
   BEGIN/END marker comments in place. The deployed output is still
   plain static HTML — this only removes the need to hand-edit the same
   markup in 12 files every time the nav, footer, or structured data changes.

   Run `npm run sync-partials` after editing a file in /_partials. It also runs
   automatically as part of `npm test` / the pre-push hook, so a page
   can never drift from its partial without the check catching it. */

const fs = require("fs");
const path = require("path");
const { LOCALIZED_PAGES, LANGS, pathFor, urlFor } = require("./i18n-pages-config");

const ROOT = path.join(__dirname, "..");
const PARTIALS = path.join(ROOT, "_partials");

// Which header/footer variant each page uses.
const MANIFEST = {
  "index.html": "marketing",
  "buchen.html": "marketing",
  "buchen-success.html": "marketing",
  "preise.html": "marketing",
  "ablauf.html": "marketing",
  "ueber-uns.html": "marketing",
  "team.html": "marketing",
  "kontakt.html": "marketing",
  "faq.html": "marketing",
  "impressum.html": "legal",
  "agb.html": "legal",
  "datenschutz.html": "legal",
  "widerruf.html": "legal"
};

function replaceBlock(content, markerName, partialContent) {
  const re = new RegExp(
    `<!-- BEGIN:${markerName} -->[\\s\\S]*?<!-- END:${markerName} -->`
  );
  if (!re.test(content)) {
    return { content, found: false };
  }
  const block = `<!-- BEGIN:${markerName} -->\n${partialContent.trim()}\n<!-- END:${markerName} -->`;
  return { content: content.replace(re, block), found: true };
}

// Builds the <link rel="alternate" hreflang="..."> block for a localized
// page: one entry per language plus x-default (pointed at the German
// version, since that's the site's default/fallback market).
function buildHreflangBlock(slug) {
  const links = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(slug, l)}">`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${urlFor(slug, "de")}">`);
  return links.join("\n");
}

// Embeds the sibling-URL map i18n.js needs so the language switcher can
// navigate to the matching /en/ or /it/ URL instead of swapping the DOM.
function buildLangUrlsScript(slug) {
  const map = {};
  LANGS.forEach((l) => { map[l] = pathFor(slug, l); });
  return `<script>window.SPLENDO_LANG_URLS = ${JSON.stringify(map)};</script>`;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  let changed = 0;
  let failed = 0;

  const ldJsonPartial = fs.readFileSync(path.join(PARTIALS, "ld-json-localbusiness.html"), "utf-8");

  for (const [page, variant] of Object.entries(MANIFEST)) {
    const pagePath = path.join(ROOT, page);
    if (!fs.existsSync(pagePath)) {
      console.warn(`  skip  ${page} (not found)`);
      continue;
    }
    const headerPartial = fs.readFileSync(path.join(PARTIALS, `header-${variant}.html`), "utf-8");
    const footerPartial = fs.readFileSync(path.join(PARTIALS, `footer-${variant}.html`), "utf-8");

    const original = fs.readFileSync(pagePath, "utf-8");
    let { content, found: hFound } = replaceBlock(original, "HEADER", headerPartial);
    let footerResult = replaceBlock(content, "FOOTER", footerPartial);
    content = footerResult.content;
    let ldJsonResult = replaceBlock(content, "LDJSON", ldJsonPartial);
    content = ldJsonResult.content;

    let hreflangFound = true;
    let langUrlsFound = true;
    if (LOCALIZED_PAGES.includes(page)) {
      const hreflangResult = replaceBlock(content, "HREFLANG", buildHreflangBlock(page));
      content = hreflangResult.content;
      hreflangFound = hreflangResult.found;
      const langUrlsResult = replaceBlock(content, "LANGURLS", buildLangUrlsScript(page));
      content = langUrlsResult.content;
      langUrlsFound = langUrlsResult.found;
    }

    if (!hFound || !footerResult.found || !ldJsonResult.found || !hreflangFound || !langUrlsFound) {
      console.error(`  FAIL  ${page} — missing BEGIN/END markers (header:${hFound} footer:${footerResult.found} ldjson:${ldJsonResult.found} hreflang:${hreflangFound} langurls:${langUrlsFound})`);
      failed++;
      continue;
    }

    if (content !== original) {
      if (checkOnly) {
        console.error(`  FAIL  ${page} — out of sync with _partials/${variant} (run 'npm run sync-partials')`);
        failed++;
      } else {
        fs.writeFileSync(pagePath, content, "utf-8");
        console.log(`  built ${page} (${variant})`);
        changed++;
      }
    } else {
      console.log(`  ok    ${page} (${variant}, already up to date)`);
    }
  }

  if (checkOnly) {
    console.log(`\nbuild --check: ${failed === 0 ? "all pages in sync" : failed + " page(s) out of sync"}`);
  } else {
    console.log(`\nbuild: ${changed} page(s) updated`);
  }
  if (failed > 0) process.exit(1);
}

main();
