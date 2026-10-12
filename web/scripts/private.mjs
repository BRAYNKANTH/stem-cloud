// After the build: lesson pages and past papers are login-only, so they must never be published as static files.
// Astro builds them to dist/shell/learn/ and dist/shell/past-papers/; this moves them to dist-private/, which Vercel
// bundles with the Python function only
// (vercel.json includeFiles) and never puts on the CDN. The function serves them after checking the sign-in
// (stemcloud/routers/lessons.py). The pages' scripts, styles and fonts stay in dist/_astro/, which are not lesson content.
//   npm run build   (runs this after astro build)
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const web = resolve(import.meta.dirname, '..');
rmSync(join(web, 'dist-private'), { recursive: true, force: true });
for (const name of ['learn', 'past-papers']) {
  const from = join(web, 'dist', 'shell', name);
  const to = join(web, 'dist-private', name);
  if (!existsSync(from)) {
    console.error(`No pages in dist/shell/${name}: did astro build run?`);
    process.exit(1);
  }
  cpSync(from, to, { recursive: true });
  rmSync(from, { recursive: true, force: true });
  if (existsSync(from)) {
    console.error(`dist/shell/${name} is still there: login-only pages would be published.`);
    process.exit(1);
  }
  console.log(`Login-only pages moved out of the published build: dist/shell/${name} -> dist-private/${name}`);
}
