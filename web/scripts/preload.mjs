// After astro build, before private.mjs: tell the browser at once which scripts a page's islands need.
// An island's script imports others (preact, hooks, the stores...), and the browser only finds each import after it has
// fetched and read the script that names it: on a phone that is a chain of round trips (about four levels on the Past
// papers page) before anything shows. A <link rel="modulepreload"> for every file of the chain, in the page's head, starts
// them all together. Only the islands that start at once (client:load) and the island renderer are preloaded; the ones
// that wait for the browser to be idle (client:idle, client:visible) keep waiting.
//   npm run build   (runs this after astro build)
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const web = resolve(import.meta.dirname, '..');
const dist = join(web, 'dist');
const cache = new Map();

/** The files a chunk imports straight away (import ... from"./x.js" and import"./x.js", not import("./x.js")). */
function imports(name) {
  if (!cache.has(name)) {
    let src = '';
    try { src = readFileSync(join(dist, '_astro', name), 'utf8'); } catch { /* not a file of ours */ }
    const found = new Set();
    for (const m of src.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([\w.\-]+\.js)["']/g)) found.add(m[1]);
    cache.set(name, [...found]);
  }
  return cache.get(name);
}
function chain(roots) {
  const seen = new Set();
  const walk = (n) => { if (seen.has(n)) return; seen.add(n); imports(n).forEach(walk); };
  roots.forEach(walk);
  return [...seen];
}
function pages(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === '_astro' || f === 'static') return [];
    return statSync(p).isDirectory() ? pages(p) : f.endsWith('.html') ? [p] : [];
  });
}

let changed = 0, links = 0;
for (const file of pages(dist)) {
  let html = readFileSync(file, 'utf8');
  if (html.includes('rel="modulepreload"')) continue;
  const roots = new Set();
  for (const m of html.matchAll(/<astro-island\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\bclient="load"/.test(tag)) continue;
    for (const k of ['component-url', 'renderer-url']) {
      const u = new RegExp(`${k}="/_astro/([\\w.\\-]+\\.js)"`).exec(tag);
      if (u) roots.add(u[1]);
    }
  }
  if (!roots.size) continue;
  const tags = chain([...roots]).map((n) => `<link rel="modulepreload" href="/_astro/${n}">`).join('');
  if (!html.includes('</head>')) continue;
  html = html.replace('</head>', tags + '</head>');
  writeFileSync(file, html);
  changed++;
  links += tags.split('<link').length - 1;
}
console.log(`Preloaded the scripts of ${changed} page(s) with islands that start at once (${links} links).`);
