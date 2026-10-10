// STEM Cloud web app: static Astro pages with Preact islands (React-style components; ~4 KB runtime instead of ~64 KB). The API stays in FastAPI (../stemcloud).
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// In development the current app and its API run on uvicorn (see ../README.md); everything Astro does not
// build yet is passed through to it, so the new pages can call /api/* on the same origin as in production.
const API = process.env.STEMCLOUD_API ?? 'http://127.0.0.1:8000';
const passThrough = ['/api', '/healthz', '/lessons', '/topics', '/static', '/login', '/account', '/admin'];

export default defineConfig({
  output: 'static',
  build: { format: 'directory' },
  trailingSlash: 'ignore',
  integrations: [preact()],
  vite: {
    server: { proxy: Object.fromEntries(passThrough.map((p) => [p, { target: API, changeOrigin: false }])) },
  },
});
