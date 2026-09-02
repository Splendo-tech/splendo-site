#!/usr/bin/env node
/* Splendo — i18n integrity check.
   Two things, per page and for i18n-common.js:
   1. Key parity: de/en/it must declare exactly the same key set. Catches
      a translation that was added in one language and forgotten in
      another (or a stray leftover key).
   2. Cross-language leakage: flags German words sitting inside the en/it
      blocks — this is exactly the class of bug found by hand this week
      (German text left in the Italian price-tier note, a German plural
      noun stuck in an Italian sentence). Proper nouns and shared loan
      words (Berlin, Extra, service names) are allow-listed. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

// Words that are only ever legitimate in German prose — if these show up
// inside an en/it dictionary value, something almost certainly leaked.
const GERMAN_TELLS = [
  "und", "oder", "nicht", "für", "mit", "jetzt", "deine", "dein",
  "Reinigung", "Wohnung", "Buchung", "kostenlos", "Termin", "bitte",
  "Preis", "Stunden", "Tagen", "Endreinigung", "Grundreinigung",
  "inklusive", "enthalten", "Zimmer", "Küche", "Badezimmer", "Fenster",
  "sowie", "sofort", "persönlich", "zuverlässig", "Anfrage",
  "ausgestattet", "verfügbar", "erreichbar", "antworten", "Kunden",
  "gebucht", "Verfügung", "entfernt", "gründlich", "Haushalt"
];
// Allow-listed loan words / proper nouns that legitimately appear in any language,
// plus German service/legal terms deliberately kept untranslated (with a gloss)
// per the EN/IT house style — e.g. "Endreinigung (pulizia di fine locazione)".
const ALLOWLIST = [
  "Berlin", "Extra", "Splendo", "WhatsApp", "Stripe", "Web3Forms",
  "Endreinigung", "Grundreinigung", "Einzugsreinigung", "Bezirk", "Kaution", "Anmeldung"
];

function extractDict(content, varName) {
  const re = new RegExp(`window\\.${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});`);
  const m = content.match(re);
  if (!m) return null;
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  try {
    const dict = vm.runInContext(`(${m[1]})`, sandbox);
    return dict;
  } catch (e) {
    return { __parseError: e.message };
  }
}

function sameKeys(a, b) {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  return JSON.stringify(ak) === JSON.stringify(bk) ? null : { a: ak, b: bk };
}

function scanLeakage(dict, lang) {
  const hits = [];
  const tellRe = new RegExp(`\\b(${GERMAN_TELLS.join("|")})\\b`);
  for (const key of Object.keys(dict[lang] || {})) {
    const value = String(dict[lang][key] || "");
    const withoutAllowlist = ALLOWLIST.reduce((s, w) => s.split(w).join(""), value);
    const m = withoutAllowlist.match(tellRe);
    if (m) hits.push({ key, word: m[0], sample: value.slice(0, 70) });
  }
  return hits;
}

function checkDict(dict, label) {
  let ok = true;
  if (!dict || dict.__parseError) {
    console.error(`  FAIL  ${label} — could not parse dictionary (${dict && dict.__parseError})`);
    return false;
  }
  const langs = ["de", "en", "it"];
  for (const l of langs) {
    if (!dict[l]) {
      console.error(`  FAIL  ${label} — missing "${l}" block`);
      ok = false;
    }
  }
  if (!ok) return false;

  const deVsEn = sameKeys(dict.de, dict.en);
  const deVsIt = sameKeys(dict.de, dict.it);
  if (deVsEn) {
    console.error(`  FAIL  ${label} — de/en key mismatch`);
    ok = false;
  }
  if (deVsIt) {
    console.error(`  FAIL  ${label} — de/it key mismatch`);
    ok = false;
  }

  for (const l of ["en", "it"]) {
    const hits = scanLeakage(dict, l);
    for (const h of hits) {
      console.error(`  FAIL  ${label} [${l}.${h.key}] — German word "${h.word}" found: "${h.sample}"`);
      ok = false;
    }
  }
  return ok;
}

function main() {
  let failed = 0;
  let checked = 0;

  const commonPath = path.join(ROOT, "i18n-common.js");
  if (fs.existsSync(commonPath)) {
    const content = fs.readFileSync(commonPath, "utf-8");
    const dict = extractDict(content, "SPLENDO_I18N_COMMON");
    checked++;
    if (checkDict(dict, "i18n-common.js")) {
      console.log("  ok    i18n-common.js");
    } else {
      failed++;
    }
  }

  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  for (const f of htmlFiles) {
    const content = fs.readFileSync(path.join(ROOT, f), "utf-8");
    const dict = extractDict(content, "SPLENDO_I18N_PAGE");
    if (!dict) continue; // legal pages etc. may have a minimal or no page dict
    checked++;
    if (checkDict(dict, f)) {
      console.log(`  ok    ${f}`);
    } else {
      failed++;
    }
  }

  console.log(`\ncheck-i18n: ${checked - failed}/${checked} dictionaries OK`);
  if (failed > 0) process.exit(1);
}

main();
