// JavaScript budget for every built page (docs/migration-plan-astro.md, section 3.7): the JS a page loads before any
// interaction, gzipped, must stay under BUDGET_KB. Counts scripts and island code referenced by the HTML plus their
// static imports; code loaded later with import() (labs, for example) is not counted here.
//   npm run build && npm run budget
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = Number(process.env.JS_BUDGET_KB ?? 60);
const dist = resolve(import.meta.dirname, '..', 'dist');

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const gz = new Map();
const gzipKb = (file) => {
  if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(file)).length / 1024);
  return gz.get(file);
};

// "/_astro/x.js" -> file in dist; "./y.js" -> relative to the importing file
const toFile = (ref, from) => (ref.startsWith('/') ? join(dist, ref) : resolve(dirname(from), ref));
const STATIC_IMPORT = /(?:^|[;\s}])import\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+\.js)["']|export\s*[{*][^;]*?from\s*["']([^"']+\.js)["']/g;

function withImports(file, seen) {
  if (seen.has(file)) return;
  seen.add(file);
  const code = readFileSync(file, 'utf8');
  for (const m of code.matchAll(STATIC_IMPORT)) withImports(toFile(m[1] ?? m[2], file), seen);
}

const HTML_REF = /(?:src|href|component-url|renderer-url|before-hydration-url)="([^"]+\.js)"/g;
let failed = false;
const rows = [];
// public/static/* is the current app, copied into the build unchanged; it is measured by tools/perf_baseline.py instead.
const legacy = join(dist, 'static');
for (const page of walk(dist).filter((f) => f.endsWith('.html') && !f.startsWith(legacy))) {
  const html = readFileSync(page, 'utf8');
  const files = new Set();
  for (const m of html.matchAll(HTML_REF)) withImports(toFile(m[1], page), files);
  // inline scripts count too
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + gzipSync(m[1]).length / 1024, 0);
  const kb = [...files].reduce((n, f) => n + gzipKb(f), 0) + inline;
  const over = kb > BUDGET_KB;
  failed ||= over;
  rows.push(`${over ? 'OVER' : 'ok  '}  ${kb.toFixed(1).padStart(6)} KB  ${relative(dist, page).replaceAll('\\', '/')}  (${files.size} files)`);
}
console.log(`Initial JS per page, gzipped (budget ${BUDGET_KB} KB):\n` + rows.sort().join('\n'));
if (!rows.length) {
  console.error('No pages found in dist/. Run npm run build first.');
  process.exit(1);
}
process.exit(failed ? 1 : 0);
