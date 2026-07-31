# Phase 0 performance tooling

| Script / file | Purpose |
| --- | --- |
| `runPerfBaseline.mjs` | Environment + inventory + reachability + loops |
| `assetInventory.mjs` | Raster/audio sizes and theoretical RGBA |
| `reachabilityReport.mjs` | Static import graph + `client/dist` top files |
| `liveLoopInventory.mjs` | rAF / interval / React hot-file inventory |
| `validateCosmeticMappings.mjs` | BODY_SRCS ↔ stem table length + FLAP stems |
| `scenarios.json` | Named reproducible scenarios |
| `phase1Regression.mjs` … `phase5` | Static phase gates |
| `../encodeDisplayAssets.mjs` | Regenerate map WebP + battle OGGs |
| `../../server-io/scripts/roomLoadBaseline.mjs` | Synthetic room serialize capacity |
| `out/` | Generated reports (gitignored) |

From repo root:

```bash
npm run perf:baseline
npm run perf:cosmetics
npm run perf:phase5
npm run perf:server-load
npm run perf:server-soak
npm run encode:display
```

Runtime: open the game with `?perf=1`, `Ctrl+Shift+P` for overlay, `__PUMO_PERF.dump()`.
