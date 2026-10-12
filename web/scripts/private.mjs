// After the build: lesson pages are login-only, so they must never be published as static files. Astro builds them to
// dist/shell/learn/; this moves them to dist-private/learn/, which Vercel bundles with the Python function only
// (vercel.json includeFiles) and never puts on the CDN. The function serves them after checking the sign-in
// (stemcloud/routers/lessons.py). The pages' scripts, styles and fonts stay in dist/_astro/, which are not lesson content.
//   npm run build   (runs this after astro build)
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const web = resolve(import.meta.dirname, '..');
const from = join(web, 'dist', 'shell', 'learn');
const to = join(web, 'dist-private', 'learn');

rmSync(join(web, 'dist-private'), { recursive: true, force: true });
if (!existsSync(from)) {
  console.error('No lesson pages in dist/shell/learn: did astro build run?');
  process.exit(1);
}
cpSync(from, to, { recursive: true });
rmSync(from, { recursive: true, force: true });
if (existsSync(from)) {
  console.error('dist/shell/learn is still there: lesson pages would be published.');
  process.exit(1);
}
console.log('Lesson pages moved out of the published build: dist/shell/learn -> dist-private/learn');
