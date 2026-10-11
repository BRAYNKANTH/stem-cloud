# Performance snapshot: astro-public (2026-10-11)

Local run of `tools/perf_baseline.py`: Lighthouse 13.4.1, mobile, simulated slow 4G with 4x CPU slowdown, served by the server at http://localhost:4330 on this machine (no CDN, no network distance). Compare snapshots with each other, not with field data.

| Page | Perf | A11y | Best pr. | FCP | LCP | TBT | CLS | Speed index | Total KB | JS KB | HTML KB | Font KB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| /home/ | 100 | 96 | 96 | 1.3 s | 1.8 s | 0 ms | 0.004 | 1.3 s | 408 | 19 | 13 | 200 |
| /about/ | 97 | 95 | 96 | 0.9 s | 2.6 s | 0 ms | 0.001 | 0.9 s | 348 | 16 | 8 | 150 |
| /privacy/ | 100 | 100 | 96 | 1.2 s | 1.4 s | 0 ms | 0.001 | 1.2 s | 293 | 2 | 2 | 117 |

Raw reports: `docs/perf/raw/2026-10-11-astro-public/`
