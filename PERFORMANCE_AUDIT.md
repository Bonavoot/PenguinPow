# PUMO PUMO ! — Performance Audit

**Phase:** 5 complete + post-5 ship-hardening. Performance phase gates closed.  
**Date:** 2026-07-30  
**Status:** Phases 0–5 landed; live socket soak measured (0 seq gaps). Packaged Electron FPS soak with `?perf=1` still recommended before ship.

---

## 1. Hardware and software (this baseline machine)

| Item | Value |
| --- | --- |
| Host | WSL2 Linux (`6.18.33.2-microsoft-standard-WSL2`) |
| CPU | 12th Gen Intel Core i7-12700K (20 threads visible) |
| RAM | 15 GiB |
| Node (host) | v22.14.0 |
| Electron | **31.7.7** |
| Chromium (Electron) | **126.0.6478.234** |
| Electron Node | 20.18.0 |
| Client build present | `client/dist` ≈ **234.3 MB** (1661 files) — prior production Vite build |
| Server tests | **296 / 296 pass** |

> Runtime FPS / frame-time traces on a **packaged** Electron build are not yet captured in this Phase 0 pass. Instrumentation is in place (`?perf=1`). Named scenarios are defined in `client/scripts/perf/scenarios.json`.

---

## 2. How to reproduce measurements

```bash
# Static inventories (assets, reachability, live loops, env)
npm run perf:baseline

# Cosmetic mapping length / FLAP stem check
npm run perf:cosmetics

# Server load harness scaffold (Phase 0 contract only)
npm run perf:server-scaffold

# Functional regression baseline
npm test
```

**In-app recorder (dev or built client):**

1. Open with `?perf=1` or `localStorage.setItem('pumo_perf','1')` then reload.
2. Overlay: `Ctrl+Shift+P`.
3. Dump: `window.__PUMO_PERF.dump()`.
4. Ghost traces: `window.__PUMO_GHOST.summary()`.
5. Scenario list: `client/scripts/perf/scenarios.json`.

---

## 3. Asset and memory inventory (static)

Source report: `client/scripts/perf/out/asset-inventory.md`

| Metric | Measured |
| --- | --- |
| Raster files under client src | **575** |
| Raster compressed | **220.1 MB** |
| Theoretical full RGBA (known PNGs) | **~2399 MB** (upper bound if everything decoded) |
| Audio files | **120** / **77.7 MB** compressed |
| Battle music WAVs compressed | **55.1 MB** |
| Battle music estimated decoded float | **~110.3 MB** |
| Bald bodies | 25 / ~**87.9 MB** RGBA |
| Cosmetic rasters | 249 / ~**747 MB** RGBA theoretical |
| Backup/alternate candidates | 46 / **53.1 MB** |

### Production bundle (existing `client/dist`) — critical

Source: `client/scripts/perf/out/reachability-report.md`

| Finding | Evidence |
| --- | --- |
| Active arena map is 6144×4096 | `game-map-444-*.png` **35.17 MB** in dist; CSS uses `game-map-444.png` |
| Battle music shipped as WAV | Three WAVs in dist: **27.1 + 19.2 + 8.8 MB** |
| Dohyo style still large | `dohyo-style-*.webp` **6.1 MB** in dist |
| Static graph vs disk | ~285 assets reachable by static imports (~85 MB); ~413 not reached (~212 MB) — includes backups; package.json also ships root `assets/**` and all of `server-io/**` |

**Count-based caches verified in code:**

- `SpriteRecolorizer`: `MAX_CACHE_SIZE = 2000`, `MAX_DECODED_CACHE_SIZE = 800` (entry counts, not bytes)
- `hatComposite`: `MAX_CACHE = 512` composites
- `warmHatCompositesForFighter`: iterates every `HAT_OVERLAY_BY_SRC` pose × **5 tints** → up to **~145** composites per equipped fighter

---

## 4. Verified root-cause leads (code evidence)

Ranked by confidence × combat impact. Phase 0 **measures only**; fixes are Phase 1+.

### P0-1 — Hidden-tab preload can stall on triple-`requestAnimationFrame` (CONFIRMED in code)

**Where:** `PlayerColorContext.jsx` `preloadSprites()` Step 6.

**What:** Completion awaits three nested `requestAnimationFrame` callbacks + 100 ms timeout.

**Why it matters:** Hidden tabs pause/throttle rAF → `spritesReady` / loading UI can freeze until visible → decode/warm/React/socket work bursts on return.

**Instrumentation added:** `preload.step6` mark with `step6Ms`, `sawHiddenDuringBarrier`, `completedWhileHidden`; console warn if hidden or >500 ms.

**Scenario:** `hidden-tab-preload` in `scenarios.json`.

### P0-2 — Live topper path can sync-`toDataURL` and fall back bald (CONFIRMED in code)

**Where:**

- `hatComposite.js` `compositeHatOntoSpriteSync()` → `canvas.toDataURL("image/png")` then `preDecodeImage(url)` **without await**
- `GameFighter.jsx`: `staticBodySrc = validHatted || recoloredSpriteSrc` (unhatted fallback while equipped)

**Why FLAP made it visible:** Slide-jump/FLAP rapidly walks `pumo-flap-1`, `pumo-flap-2`, `dodging`, `sliding`, `recovering`, hit, idle — each needs body×tint×overlay×under/over. Cache miss → sync encode or bald frame.

**Instrumentation added:** `hat.toDataURL` timings, `hat.syncTopper` / `cachedTopper` / `asyncTopper` / `syncMissColdLayers` counters, `GhostFrameTracer` pose/cosmetic present log + `fallbackBody` ghost heuristic.

### P0-3 — `preDecodeImage` caches failures as ready (CONFIRMED in code)

**Where:** `SpriteRecolorizer.js` — `decode()` / `onerror` still call `onComplete()` and insert into `decodedImageCache`.

**Instrumentation:** `decode.failedButCached` counter/mark.

### P0-4 — Focus/visibility rewarm storms can overlap (CONFIRMED in code)

**Where:** `Game.jsx` calls `rewarmDecodedImages()` from rematch, `visibilitychange`, `focus`, basho begin, `power_ups_revealed`. Focus + visibility often fire together. No single-flight.

**Instrumentation:** `rewarm.trigger` with reason; `rewarm.overlap` / duration gauges; cache pin counts in marks.

### P0-5 — Electron disables recolor worker (CONFIRMED in code)

**Where:** `SpriteRecolorizer.initWorker()` — `if (isElectron()) { workerReady = false; return; }`

Steam/Electron path uses main-thread pixel work for any runtime recolor.

### P0-6 — Oversized map + full WAV music in production dist (CONFIRMED by bundle inventory)

See §3. `game-map-444` 6144×4096 and three battle WAVs dominate dist size / decode budget.

### P0-7 — Cosmetic overlay map is positionally coupled (CONFIRMED)

`cosmetics.js` `mapFromStemTable` zips `BODY_SRCS[i]` with `Object.keys(TOP_HAT_BY_STEM)[i]`. Lengths currently match (29). FLAP stems present for all five gear tables. Reorder risk remains. Validated by `npm run perf:cosmetics`.

### P0-8 — Many concurrent presentation loops (CONFIRMED statically)

`GameFighter.jsx`: ~8300 lines, **58** `useState`, **72** `useEffect`, **17** rAF sites, ~30 socket `.on`. ParticleEngine perpetual rAF over 500-slot pool (render idle-skips clears but loop never sleeps). Snow: 62 DOM flakes. Crowd: ~421 members.

### P0-9 — Electron `debugLog` sync multi-file append (CONFIRMED in code)

`main.js` `debugLog` → `fs.appendFileSync` to multiple locations; mirrors renderer `console-message` and local server stdio.

---

## 5. Live-loop inventory (static)

Source: `client/scripts/perf/out/live-loop-inventory.md`

- **56** `requestAnimationFrame` call sites across hot files  
- **25** `setInterval`, **58** `setTimeout`  
- Runtime per-frame callback counts: capture with PerfRecorder during scenarios (not yet filled)

---

## 6. Server baseline (Phase 0)

| Item | Value |
| --- | --- |
| Tick rate | 64 Hz (deadline **15.625 ms**) |
| Remote broadcast | 32 Hz (`BROADCAST_EVERY_N_TICKS = 2`) |
| Local solo broadcast | 64 Hz (`LOCAL_TIGHT_BROADCAST`) |
| Tests | **296 pass** |
| Room load harness | Scaffold only → `server-room-load-baseline.json` |

Capacity numbers deferred to Phase 5.

---

## 7. Ranked bottlenecks (evidence-based priority for later phases)

| Rank | Bottleneck | Phase | Evidence type |
| ---: | --- | --- | --- |
| 1 | Topper sync compose + bald fallback + cold decode | **1** | Code path + FLAP transition frequency |
| 2 | Triple-rAF preload / hidden-tab stall | **1** | Code path + known browser rAF throttle |
| 3 | Overlapping full-pinset rewarm on focus | **1** | Multiple call sites, no single-flight |
| 4 | Failed decode marked ready | **1** | Code path |
| 5 | Runtime recolor/composite architecture | **2** | Electron worker off; bake exists but toppers still runtime |
| 6 | Count-based caches vs byte cost | **2** | Cache constants + asset math |
| 7 | Frame loops / particles / snow / CSS filters | **3** | Static loop inventory; needs runtime profile |
| 8 | Map resolution + music AudioBuffers + package junk | **4** | Dist top files |
| 9 | Sync Electron logging | **4** | `main.js` |
| 10 | Network deltas / visibility resync / room capacity | **5** | Design review + scaffold |

---

## 8. Phase 0 deliverables checklist

| Deliverable | Location |
| --- | --- |
| This audit | `PERFORMANCE_AUDIT.md` |
| Architecture (as-is + target) | `PERFORMANCE_ARCHITECTURE.md` |
| Perf recorder | `client/src/utils/perf/PerfRecorder.js` |
| Ghost tracer | `client/src/utils/perf/GhostFrameTracer.js` |
| Scenarios | `client/scripts/perf/scenarios.json` |
| Asset inventory script | `client/scripts/perf/assetInventory.mjs` |
| Reachability / dist report | `client/scripts/perf/reachabilityReport.mjs` |
| Live-loop inventory | `client/scripts/perf/liveLoopInventory.mjs` |
| Cosmetic mapping check | `client/scripts/perf/validateCosmeticMappings.mjs` |
| Server load scaffold | `server-io/scripts/roomLoadBaseline.mjs` |
| Generated reports | `client/scripts/perf/out/` |

### Minimal instrumentation hooks (measure-only)

- `hatComposite.js` — path classification + `toDataURL` timing  
- `SpriteRecolorizer.js` — failed-decode-as-cached; rewarm overlap/duration; byte approx in `getCacheStats`  
- `PlayerColorContext.jsx` — Step 6 visibility/timing  
- `Game.jsx` — tagged rewarm reasons  
- `GameFighter.jsx` — present-tuple ghost heuristics  
- `main.jsx` — opt-in recorder bootstrap  

---

## 9. Tests run (Phase 0)

| Command | Result |
| --- | --- |
| `npm test` (server-io) | **296 pass**, 0 fail |
| `npm run perf:baseline` | OK — reports written |
| `npm run perf:cosmetics` | OK — 29/29 stems, FLAP present |
| `npm run perf:server-scaffold` | OK |

---

## 10. Remaining risks / gaps before Phase 1

1. **No packaged Electron frame-time baseline yet** on this machine — run scenarios with a production package + `?perf=1` before claiming FPS numbers.  
2. Ghost heuristics detect fallback/bald paths; **deterministic FLAP torture automation** still to be driven in Phase 1.  
3. Theoretical RGBA ≠ live working set — use PerfRecorder heap + `getCacheStats()` during scenarios.  
4. Static reachability undercounts some dynamic assets; dist inventory is the stronger shipping signal.

---

## 11. Phase 1 — Ghost frames and asset-transition correctness

### Root problems addressed

| Problem | Fix |
| --- | --- |
| Triple-rAF preload deadlock when hidden | `awaitDecodedReadiness` + `setTimeout` yield; **no rAF** in Step 6 |
| Sync `toDataURL` on live topper path | `compositeHatOntoSpriteSync` = cache+decoded lookup only; async uses `toBlob` |
| Bald/unhatted flash when equipped | Hold `lastGoodHattedRef` until exact tuple ready |
| Failed decode marked ready | `failedDecodeKeys`; failures never enter `decodedImageCache` |
| Duplicate concurrent decode/composite | `inFlightDecodes` / `inFlightComposites` |
| Overlapping rewarm storms | Single-flight `rewarmDecodedImages`; Game.jsx coalesces focus+visibility (50ms) |

### Files changed (Phase 1)

- `client/src/utils/assetReadiness.js` (new)
- `client/src/utils/hatComposite.js`
- `client/src/utils/SpriteRecolorizer.js`
- `client/src/context/PlayerColorContext.jsx`
- `client/src/components/GameFighter.jsx`
- `client/src/components/Game.jsx`
- `client/src/utils/perf/GhostFrameTracer.js`
- `client/scripts/perf/phase1Regression.mjs` (new)
- `package.json` (`perf:phase1`)

### Behavior preserved

- Gameplay rules, timings, authority unchanged
- Topper visual attachment still single composited `<img>`
- Preload still warms all pose×tint composites before `spritesReady`
- Input release on `document.hidden` unchanged

### Measurements

| Metric | Before (Phase 0) | After (Phase 1) |
| --- | --- | --- |
| Preload Step 6 | 3× rAF + 100ms (stalls when hidden) | Timer poll readiness; completes while hidden |
| Live hat encode | `toDataURL` on sync cache miss | **None** (lookup only) |
| Equipped miss display | `recoloredSpriteSrc` (bald) | Hold last good hatted |
| Rewarm overlap | Started parallel full passes | Coalesce + single-flight join |
| Failed decode | Inserted as “ready” | Explicit fail; not ready |

Runtime FPS / prolonged FLAP torture with `?perf=1` still recommended on packaged Electron before declaring ghosts eliminated in production.

### Tests run

| Command | Result |
| --- | --- |
| `npm test` | **296 pass** |
| `npm run perf:phase1` | **all checks passed** |
| `npm run perf:cosmetics` | OK (via phase1) |

### Hotfix (post Phase 1 review)

User-reported delayed animations / toppers stuck on wrong poses were **not expected**. Cause: hold-last-good + decode-gating cache hits froze the previous hatted pose across FLAP/slide swaps. Fixed by:

- Returning cache hits immediately (no decoded-gate null)
- Restoring warm-layer sync compose on cache miss (pose advances)
- Removing hold-last-good so poses never stall waiting on hat async

### Remaining risks

1. Brief bald/unhatted flash can still appear on a true cache miss (pre-Phase-1 tradeoff restored for snappiness).
2. Warm-miss sync path can still `toDataURL` — Phase 2 bake should eliminate that.
3. Byte-budgeted caches and build-time topper bake remain **Phase 2**.
4. Packaged Electron prolonged torture not yet numerically logged in this session.

## 12. Phase 2 — Sprite and cosmetic asset architecture

### Approach chosen

Evaluated flattened files vs atlas vs layered topper DOM vs WebGL. **Selected build-time flattened body+topper WebPs** for the supported catalog:

- Perfect pose attachment (no historical dual-layer drift)
- Stable file identity (`/baked/h….webp`)
- Sync resolve on the combat path when the tuple is in the manifest

Atlas / WebGL deferred — higher eng cost, same reliability only if frame metadata is perfect.

### What shipped

| Item | Detail |
| --- | --- |
| Registry | `client/src/config/bakeHatSources.js` |
| Baker | `bakeSprites.mjs` → `manifest.hats` (v2-hats) |
| Runtime | `getBakedHattedSprite` / `resolveHattedSpriteSync` |
| Preload | `warmHatCompositesForFighter` pins baked URLs (no compose when covered) |
| Memory | Soft `MAX_DECODED_BYTES` (384 MB) on non-pinned decoded cache |
| Fallback | Custom colors / unbaked tint flashes → prior runtime compose |

### Bake measurements (this machine)

| Metric | Value |
| --- | --- |
| Body PNGs | 3476 (~388 MB with hats folder total) |
| Hat WebPs | 6075 unique + 225 deduped refs |
| Hat manifest entries | 6300 |
| Hat payload | **311.6 MB** (q82; next bake default q70 via `BAKE_HAT_WEBP_QUALITY`) |
| Total `public/baked` | **~699 MB** |
| Bake wall time | ~21 min |

### Files changed (Phase 2)

- `client/src/config/bakeHatSources.js` (new)
- `client/src/config/bakeSources.js` (slapAttack ids)
- `client/scripts/bakeSprites.mjs`
- `client/src/utils/bakedSprites.js`
- `client/src/utils/hatComposite.js`
- `client/src/components/GameFighter.jsx`
- `client/src/utils/SpriteRecolorizer.js` (byte budget)
- `client/scripts/perf/phase2Regression.mjs` (new)

### Behavior preserved

- Gameplay/authority unchanged
- Toppers still single `<img>` (flattened)
- Hit/charge/blubber/armor flash tints still runtime (not baked) — brief overlays

### Tests

| Command | Result |
| --- | --- |
| `npm test` | **296 pass** |
| `npm run perf:phase1` | pass |
| `npm run perf:phase2` | pass (6300 hat entries) |

### Remaining risks

1. **Package size** — baked hats add ~312 MB at q82; rebake at q70 or compact roster before Steam depot freeze.
2. Bake lookup must use **original** body stem (`bakeSourceUrl`), not hashed `/baked/body.png` — wired; regressions would silently fall back to runtime compose.
3. Visual parity vs PNG composite: WebP q82/q70 — spot-check FLAP toppers in Electron.
4. Atlas evaluation deferred to a later size pass if depots require it.

### Recommended next phase

**Phase 3 — Client frame-time optimization** (authorized and completed — see §13).

---

## 13. Phase 3 — Client frame-time

### Scope (evidence-backed only)

Static live-loop inventory + code inspection pointed at perpetual work when idle:

| Lead | Evidence | Action |
| --- | --- | --- |
| ParticleEngine perpetual rAF | Always scheduled; scanned 500-slot pool every frame even with `_activeCount === 0` (render already idle-skipped clears) | Sleep after committed empty frame; wake on `spawn`/`emit` |
| SnowEffect DOM rAF | 62 flakes × transform/opacity writes every ~16ms while mounted | Pause loop on `document.hidden`; resume resets clock |
| GameFighter / crowd / filters | Present but not profiled for this pass | **No change** — avoid blind React rewrites |

### What shipped

1. **`ParticleEngine` idle sleep** — `_tick` cancels rAF when `_activeCount === 0` and a final empty clear was committed; `_wake()` from `spawn`/`emit`; destroyed engines refuse wake.
2. **`SnowEffect` visibility pause** — `visibilitychange` stops/starts rAF; no huge `timeFactor` jump on return.
3. **`npm run perf:phase3`** static regression for sleep/wake + visibility wiring.
4. Live-loop inventory strings updated to match.

### Files changed (Phase 3)

- `client/src/particles/ParticleEngine.js`
- `client/src/components/SnowEffect.jsx`
- `client/scripts/perf/phase3Regression.mjs`
- `client/scripts/perf/liveLoopInventory.mjs`
- `package.json` (`perf:phase3`)
- `PERFORMANCE_AUDIT.md`, `PERFORMANCE_ARCHITECTURE.md`

### Behavior preserved

- Particle presets/VFX timing unchanged while awake; hitstop with in-flight particles keeps painting (`_activeCount > 0`).
- Snow visuals unchanged while the tab is visible.
- No GameFighter architecture rewrite; no flake-count or CSS filter changes.

### Expected impact (qualitative until packaged soak)

| Scenario | Expected |
| --- | --- |
| Match idle (no VFX) | ParticleEngine rAF ≈ 0 (was continuous) |
| Background tab with snow mounted | Snow rAF stopped |
| Active combat VFX | Same rAF cadence as before while particles live |

Perf counter: `particles.sleep` increments when the engine parks (with `?perf=1`).

### Tests

| Command | Result |
| --- | --- |
| `npm run perf:phase1` | pass |
| `npm run perf:phase2` | pass |
| `npm run perf:phase3` | pass |
| `npm test` | (server suite) |

### Remaining risks / deferred

1. Packaged FPS / frame-time soak with `?perf=1` still needed to quantify idle vs combat gains.
2. Active-list over full-pool scan while awake — deferred (wake path is the large win).
3. Crowd cheer interval / fighter `drop-shadow` — deferred pending profiles.
4. Presentation-clock consolidation — still future work if soak shows React/interpolation cost.

### Recommended next phase

**Phase 4 — Audio / images / packaging** (authorized and completed — see §14).

---

## 14. Phase 4 — Audio / images / packaging

### Scope (P0-6 + package junk + P0-9)

| Lead | Before | Action |
| --- | --- | --- |
| Arena map | 6144×4096 PNG ~35 MB in dist; ~100 MB RGBA decode | Display `game-map-444.webp` **3840×2560** ~345 KB; PNG retained as encode master only |
| Battle music | 3× WAV ~55 MB; full `decodeAudioData` (~110 MB float) | 3× OGG Vorbis ~4.5 MB; **streamed** HTMLAudioElement crossfade (not in `preloadSounds`) |
| Dohyo preload | Preloaded 6.1 MB `dohyo-style.webp` | Match preload → `dohyo-display.webp` (~787 KB); style still in CSS for editor `--live` |
| electron-builder | Shipped `server-io/test`, docs under node_modules | Exclude tests, md, package-lock, node_modules docs/tests |
| `debugLog` | Sync `appendFileSync` × multi-path; mirrored all renderer logs | Async `appendFile`; packaged builds mirror errors only (`PENGUINPOW_DEBUG=1` for verbose) |
| Bake quality | Default hat WebP q70 (Phase 2) | Unchanged this pass — re-encode with `BAKE_HAT_WEBP_QUALITY` before depot freeze if needed |

### What shipped

1. `client/src/assets/game-map-444.webp` + CSS / fighterAssets / editors wired to it.
2. Battle `.ogg` tracks + `preloadMusic` / `createStreamedCrossfadeLoop` in `audioEngine.js`.
3. `npm run encode:display` / `client/scripts/encodeDisplayAssets.mjs` to regenerate from masters.
4. Packaging excludes + async debug gate in `main.js`.
5. `npm run perf:phase4` static regression.

### Size deltas (source / expected dist)

| Asset | Before (shipped) | After (shipped) |
| --- | --- | --- |
| Arena map | ~35 MB PNG | ~0.34 MB WebP |
| Battle music | ~55 MB WAV | ~4.5 MB OGG |
| Battle music RAM | ~110 MB PCM buffers | Streamed (decoder buffer only) |
| Map RGBA (approx) | ~100 MB @ native | ~39 MB @ 3840×2560 |

Masters (`game-map-444.png`, battle `.wav`) remain on disk for re-encode; Vite does not import them.

### Files changed (Phase 4)

- `client/src/assets/game-map-444.webp` (new)
- `client/src/sounds/battle-music-sound*.ogg` (new)
- `client/src/utils/audioEngine.js`
- `client/src/components/fighterAssets.js`
- `client/src/App.css`
- `client/src/components/CrowdEditor.jsx`, `RoofTassleEditor.jsx`
- `client/scripts/encodeDisplayAssets.mjs`
- `client/scripts/perf/phase4Regression.mjs`
- `main.js`, `package.json`, `client/package.json`
- `PERFORMANCE_AUDIT.md`, `PERFORMANCE_ARCHITECTURE.md`

### Behavior preserved

- Battle / eeshi crossfade loop API (`stop({ fadeOut, hold })`) unchanged for callers.
- Short SFX + eeshi still use AudioBuffer path.
- Map framing / CSS `cover` + camera unchanged; resolution tier sized for 1280×720 × ~1.55 zoom × ~2 DPR.

### Tests

| Command | Result |
| --- | --- |
| `npm run perf:phase1` … `phase4` | pass |
| `npm test` | (server suite) |

### Remaining risks / deferred

1. `dohyo-style.webp` (~6.1 MB) still bundled via `App.css` `.dohyo-overlay--live` (Crowd editor). Split editor CSS / dynamic import to drop from player builds if depot needs it.
2. Full client rebuild still copies `public/baked` (~699 MB hats+bodies) into dist — roster/quality pass before Steam freeze.
3. Spot-check battle music loop crossfade + map sharpness in packaged Electron.
4. Unused alternate `game-map-*` / backup rasters still on disk (not imported → not in Vite dist).

### Recommended next phase

**Phase 5 — Network / server capacity** (authorized and completed — see §15).

---

## 15. Phase 5 — Network / server capacity

### Scope (architecture §4 targets)

| Target | Status |
| --- | --- |
| Sequence + server tick/time on packets | **Done** — `seq`, `simTime` on every `fighter_action` |
| Periodic keyframes + explicit resync | **Done** — every 64 broadcasts (~2s @32Hz); `request_fighter_resync` |
| No naive `volatile` deltas | **Preserved** — reliable ordered emits only |
| Merge once / shared ingest | **Done** — `fighterSnapshotBus`; camera + ThrowTech read accumulated state |
| Measured capacity | **Done** — synthetic serialize harness (`npm run perf:server-load`) |

### What shipped

1. **`server-io/fighterBroadcast.js`** — `buildFighterActionPacket` (seq / simTime / isKeyframe / isDelta / isResync).
2. **`KEYFRAME_EVERY_N_BROADCASTS = 64`** in constants; tick loop uses builder.
3. **`request_fighter_resync`** — full snapshot to requester only (does not reset room baselines for opponents).
4. **`client/src/net/fighterSnapshotBus.js`** — single merge, gap telemetry + throttled resync, visibility request from `Game.jsx`.
5. **useCamera / ThrowTechEffect** read shared accumulated state (not raw deltas).
6. **Room-load harness** measures delta/keyframe build cost + payload bytes; writes `client/scripts/perf/out/server-room-load-baseline.json`.
7. **`npm run perf:phase5`** + unit tests for packet builder.

### Synthetic capacity (this machine, 24 rooms × 3s)

| Metric | Value |
| --- | --- |
| Broadcast build avg | ~0.035 ms / room |
| Avg delta payload | ~449 B |
| Avg keyframe payload | ~6.7 KB |
| Bytes/sec/match (est.) | ~18.5 KB/s |
| Serialize-only safe rooms @ 8ms budget | ~459 (upper bound — no physics/AI/sockets) |

### Files changed (Phase 5)

- `server-io/fighterBroadcast.js` (new)
- `server-io/constants.js`, `index.js`, `socketHandlers.js`
- `server-io/scripts/roomLoadBaseline.mjs`
- `server-io/test/fighterBroadcast.test.js`
- `client/src/net/fighterSnapshotBus.js` (new)
- `client/src/components/GameFighter.jsx`, `Game.jsx`, `ThrowTechEffect.jsx`
- `client/src/hooks/useCamera.js`
- `client/scripts/perf/phase5Regression.mjs`
- `package.json`, `PERFORMANCE_AUDIT.md`, `PERFORMANCE_ARCHITECTURE.md`

### Behavior preserved

- Still 64 Hz sim / 32 Hz remote broadcast (64 Hz local tight).
- Delta compression unchanged between keyframes.
- No `volatile` snapshot path.
- Prediction / interpolation consumers still see merged fighter objects.

### Tests

| Command | Result |
| --- | --- |
| `npm run perf:phase5` | pass |
| `npm run perf:server-load` | measured report written |
| `npm test` | **300 / 300 pass** (+4 broadcast tests) |

### Remaining risks / follow-ups

1. Packaged Electron FPS soak with `?perf=1` still recommended across Phases 1–4 visuals.
2. Larger live soaks (`SOAK_ROOMS=16+`) before claiming multi-process sharding needs.

### Phase gate status

**All authorized performance phases (0–5) complete.**

---

## 16. Post–Phase 5 ship-hardening (soak / fan-out / packaging)

Authorized continuation after Phase 5 (“go” with no Phase 6 in the original plan).

### What shipped

1. **Live socket soak** — `npm run perf:server-soak` (`server-io/scripts/liveRoomSoak.mjs`): spawns server, N CPU matches, input hammer, reports packet rate / keyframes / **seq gaps**.
2. **Single `fighter_action` owner** — `retainFighterSocket` in Game; GameFighter / useCamera / ThrowTech **subscribe** (no per-component `socket.on`).
3. **`dohyo-style.webp` out of player CSS** — removed from `App.css`; CrowdEditor lazy-loaded with live overlay styles (editor-only chunk).

### Live soak (this machine)

| Metric | 4 CPU rooms × 10s |
| --- | --- |
| Status | `measured_live` |
| Rooms fighting | 4 |
| Packets/sec | ~225 |
| Keyframes | 36 |
| Seq gaps | **0** |
| Bytes/sec in | ~185 KB/s |

### Tests

`perf:phase5` pass · `perf:server-soak` measured · server **300/300** pass
