#!/usr/bin/env node
// next-sitemap 4.2.3 bug: 3-subtag BCP 47 tags like `uz-Latn-UZ` get written
// with underscores (`uz_Latn_UZ`). Google rejects these. Post-process the
// generated sitemap files to restore hyphens.
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(process.cwd(), 'public');
const pattern = /\buz_Latn_UZ\b/g;
const replacement = 'uz-Latn-UZ';

let rewritten = 0;
for (const file of fs.readdirSync(publicDir)) {
  if (!/^sitemap.*\.xml$/.test(file)) continue;
  const target = path.join(publicDir, file);
  const original = fs.readFileSync(target, 'utf8');
  if (!pattern.test(original)) continue;
  fs.writeFileSync(target, original.replace(pattern, replacement));
  rewritten += 1;
}

if (rewritten > 0) {
  console.log(`[sitemap] normalized hreflang in ${rewritten} file(s)`);
}
