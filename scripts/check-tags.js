#!/usr/bin/env node
/* Splendo — HTML tag-balance check.
   Walks every top-level .html file with a stack-based open/close tag
   matcher (void elements are skipped). Exits non-zero on any mismatch,
   so this can gate a push instead of being a one-off script. */

const fs = require("fs");
const path = require("path");

const VOID = new Set(["br", "img", "input", "meta", "link", "hr", "area", "base", "col", "embed", "source", "track", "wbr"]);
const ROOT = path.join(__dirname, "..");

function checkFile(fname) {
  const content = fs.readFileSync(fname, "utf-8");
  // Strip script/style contents so JS/CSS text can't be mistaken for markup.
  const cleaned = content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "<script></script>")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, "<style></style>");

  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  const stack = [];
  let match;
  while ((match = tagRe.exec(cleaned)) !== null) {
    const [, closing, rawTag, attrs] = match;
    const tag = rawTag.toLowerCase();
    if (VOID.has(tag) || attrs.trim().endsWith("/")) continue;
    if (!closing) {
      stack.push(tag);
    } else {
      if (stack.length === 0 || stack[stack.length - 1] !== tag) {
        return { ok: false, reason: `mismatched </${tag}>, expected </${stack[stack.length - 1] || "(empty stack)"}>` };
      }
      stack.pop();
    }
  }
  if (stack.length > 0) {
    return { ok: false, reason: `unclosed tag(s): ${stack.join(", ")}` };
  }
  return { ok: true };
}

function main() {
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  let failed = 0;
  for (const f of files) {
    const result = checkFile(path.join(ROOT, f));
    if (result.ok) {
      console.log(`  ok    ${f}`);
    } else {
      console.error(`  FAIL  ${f} — ${result.reason}`);
      failed++;
    }
  }
  console.log(`\ncheck-tags: ${files.length - failed}/${files.length} files OK`);
  if (failed > 0) process.exit(1);
}

main();
