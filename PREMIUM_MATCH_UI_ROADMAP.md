# Pumo Pumo Premium Match UI Roadmap

## Current gate

Stages 0 and 1 are complete. Production presentation remains unchanged. The program is stopped at:

**VISUAL DIRECTION GATE — recommendation: Direction B**

Continue only after one of:

- `APPROVE VISUAL DIRECTION A`
- `APPROVE VISUAL DIRECTION B`
- `APPROVE VISUAL DIRECTION C`

Adjustments requested before approval apply to Stage 1 only.

## Stage 0 — forensic audit: complete

Deliverables:

- `PREMIUM_MATCH_UI_AUDIT.md`
- `MATCH_UI_STATE_MATRIX.md`
- `PRESENTATION_LAYER_MAP.md`
- `MOTION_AND_EVENT_TAXONOMY.md`
- `PREMIUM_MATCH_UI_ROADMAP.md`

The audit covers the supplied Pumo and Tōkon recordings, production state ownership, event inventory, portal stack, token conflicts, first-use warming, performance risks, responsiveness, accessibility, and mode parity.

## Stage 1 — dev-only presentation lab: complete

### Isolation

- Access is gated by `import.meta.env.DEV`.
- The URL must include `presentationLab=1`.
- `main.jsx` dynamically imports the lab instead of `App.jsx`.
- Global combat audio initialization/tracing is skipped while the lab is active.
- The lab uses local fixtures only.
- It does not render `App`, `Game`, `GameFighter`, matchmaking, sockets, server state, prediction, input, or gameplay audio.
- Removing the query parameter restores the existing application path.

### Access

From `client/`:

```bash
npm run dev -- --host 0.0.0.0
```

Open:

```text
http://localhost:5173/?presentationLab=1
```

When the browser is outside WSL, replace `localhost` with the WSL address shown by `hostname -I`.

### Motion replay

1. Choose Direction A, B, or C.
2. Choose `Live fight`, then select a combat event.
3. Press **Replay** to remount and replay the event.
4. Use **Playback** for 0.25×, 0.5×, or 1×.
5. Press **Pause**, then **Step +100ms** to inspect deterministic poses through 3000 ms.
6. Enable **Overlap test** for opposing simultaneous reads.
7. Press **Rapid replacement** for the six-event replacement/restrike stress sequence.
8. Enable **Reduced motion** and replay the same state to inspect the alternate choreography.
9. Select HANDS DOWN, HAKKI-YOI, a result, PreMatch, DayCard, or MatchOver under **Ceremony / flow**, then press Replay.

Controls persist into the URL. A direct example:

```text
/?presentationLab=1&direction=B&fixture=danger&event=perfect&moment=fight&viewport=1280x800&contrast=arena&speed=0.5&inverted=0&long=0&overlap=0&reduced=0
```

Use `chrome=0` to hide lab controls for capture.

### Direction summary

- **A — Conservative Evolution:** keeps the current broad layout, removes material noise, and clarifies type. Lowest implementation risk; weakest identity improvement.
- **B — Winter Basho Broadcast:** mirrored ivory/sumi fighter wings, centered ritual hub, restrained fighter accents, and one coherent directional event family. Best hierarchy and arena fit.
- **C — Bold Graphic Fighter:** widest color ownership and strongest angles/transition energy. Attractive in hero frames but too assertive at rest and least durable on Steam Deck/long sessions.

### Evidence

Primary comparison sheets:

- `premium-match-ui-evidence/direction-a-matrix.png`
- `premium-match-ui-evidence/direction-b-matrix.png`
- `premium-match-ui-evidence/direction-c-matrix.png`
- `premium-match-ui-evidence/direction-a-motion.mp4`
- `premium-match-ui-evidence/direction-b-motion.mp4`
- `premium-match-ui-evidence/direction-c-motion.mp4`
- `premium-match-ui-evidence/abc-perfect-motion.gif`
- `premium-match-ui-evidence/directions-side-by-side.png`
- `premium-match-ui-evidence/recommended-direction-b.png`
- `premium-match-ui-evidence/direction-b-flow.png`
- `premium-match-ui-evidence/direction-b-contrast.png`
- `premium-match-ui-evidence/direction-b-resolutions.png`
- `premium-match-ui-evidence/presentation-lab-controls.png`

Each direction matrix contains:

1. neutral HUD;
2. danger HUD;
3. COUNTER;
4. PUNISH;
5. PERFECT;
6. HANDS DOWN;
7. HAKKI-YOI;
8. long RoundResult;
9. BASHO HUD;
10. Steam Deck 1280×800;
11. long-name stress.

The `abc-*.png` sheets compare all directions state-for-state. Direction B composites cover PreMatch/DayCard/MatchOver, bright/dark contrast, and 1280×720/1920×1080/2560×1440. Source-video contact sheets and frame sequences are under `premium-match-ui-evidence/source-analysis/`.

The 1.5 s MP4 samples show the Tier 2 PERFECT entrance, hold, and exit at 10 inspection frames per second. Live Replay remains the source of truth for browser timing. For deterministic capture, add `paused=1&seek=300` (0–3000 ms) to sample an exact lab pose.

### Stage 1 known limitations

- The lab validates visual hierarchy, state density, responsive geometry, and motion grammar; it does not validate real socket event timing.
- Its static crowd is representative and deliberately omits production crowd animation/DoF complexity.
- Frame stepping is a CSS delay scrub in 100 ms increments, not a frame-perfect browser timeline.
- Exact BASHO maximum boon count, zero/max win-mark configurations, and literal N/A power-up state remain Stage 3 fixture additions.
- Power-up selection/reveal are inventoried but not separate A/B/C probe screens because they do not alter the first direction decision.

## Recommendation

Approve **Direction B**.

It is the only probe that materially fixes the fragmented top silhouette while remaining quieter than the penguin combat. It uses fighter color for ownership without turning the stamina system into neon team bars, preserves the warm illustrated arena, scales to long result strings and BASHO density, and has a feasible CSS/React path. Direction A does not go far enough; Direction C spends too much intensity in Tier 0.

The strongest idea to carry from C is its faster directional cut at Tier 2/3—not its permanent full-color HUD mass.

## Post-approval roadmap

### Stage 2 — foundation

- Establish the approved color, type, spacing, shape, motion, layer, safe-area, and reduced-motion roles.
- Split state adapters from presentation without replacing proven stamina/posture/event logic.
- Add one default-off presentation flag and rollback seam.
- Keep the lab consuming the same approved primitives.
- Stop at `FOUNDATION GATE`.

### Stage 3 — match HUD

- Implement the approved fighter wings, center hub, essential/decorative layer split, power-up treatment, posture language, BASHO density rules, and full state matrix.
- Verify side inversion, long names, tassel overlap, all target viewports, and remount stability.
- Stop at `MATCH HUD GATE`.

### Stage 4 — event presentation

- Apply one Tier 1/2 family and the documented replacement/suppression policy to all real event wrappers.
- Preserve authoritative IDs, ownership, dedupe, and first-use warming.
- Stop at `EVENT PRESENTATION GATE`.

### Stage 5 — round flow

- Unify PreMatch, HANDS DOWN, HAKKI-YOI, RoundResult, MatchOver, DayCard, and adjacent power-up flow.
- Keep controller actions and loading safety intact.
- Stop at `ROUND FLOW GATE`.

### Stage 6 — lighting

- Tune the existing single-light-story stack; do not replace character art.
- Profile map blur, grain, rays, vignettes, flashes, and result compositing at target resolutions.
- Stop at `LIGHTING GATE`.

### Stage 7 — final integration

- Verify Custom PvP, CPU, BASHO, rematch, next day, both local sides, stress combinations, reduced motion, cleanup, and first-use performance.
- Keep the new presentation default off until `APPROVE FINAL INTEGRATION`.

## Verification

- Focused ESLint passed for `main.jsx`, `PresentationLab.jsx`, and `presentationFixtures.js` with zero warnings.
- Editor diagnostics report no errors in the changed lab/entry files.
- `git diff --check` passed.
- The development browser loaded the deterministic paused/seek state correctly.
- Browser resource inspection for the lab loaded only the lab modules among the audited application graph: no `App.jsx`, `Game.jsx`, Socket.IO, or `combatAudio` module was loaded.
- All three H.264 motion samples validate at 960×540, 10 fps, 1.5 s.
- There is no client unit-test script. Server/gameplay tests are unrelated to this isolated visual renderer and were not run.
- No production build was run.

Tooling deviation: an initial command used `npx eslint` from the wrong working directory. npm fetched a temporary ESLint runner into its external cache and that invocation failed before checking files. It did not change `package.json`, lockfiles, or project `node_modules`; final verification used the repository's installed client ESLint directly.

## First-run change boundary

Modified:

- `client/src/main.jsx` — minimal development-only entry seam.

Created:

- `client/src/presentationLab/PresentationLab.jsx`
- `client/src/presentationLab/PresentationLab.css`
- `client/src/presentationLab/presentationFixtures.js`
- `PREMIUM_MATCH_UI_AUDIT.md`
- `MATCH_UI_STATE_MATRIX.md`
- `PRESENTATION_LAYER_MAP.md`
- `MOTION_AND_EVENT_TAXONOMY.md`
- `PREMIUM_MATCH_UI_ROADMAP.md`

Evidence files:

- `premium-match-ui-evidence/abc-neutral.png`
- `premium-match-ui-evidence/abc-danger.png`
- `premium-match-ui-evidence/abc-counter.png`
- `premium-match-ui-evidence/abc-punish.png`
- `premium-match-ui-evidence/abc-perfect.png`
- `premium-match-ui-evidence/abc-hands-down.png`
- `premium-match-ui-evidence/abc-hakki-yoi.png`
- `premium-match-ui-evidence/abc-round-result.png`
- `premium-match-ui-evidence/abc-basho.png`
- `premium-match-ui-evidence/abc-steam-deck.png`
- `premium-match-ui-evidence/abc-long-names.png`
- `premium-match-ui-evidence/abc-perfect-motion.gif`
- `premium-match-ui-evidence/direction-a-matrix.png`
- `premium-match-ui-evidence/direction-b-matrix.png`
- `premium-match-ui-evidence/direction-c-matrix.png`
- `premium-match-ui-evidence/direction-a-motion.mp4`
- `premium-match-ui-evidence/direction-b-motion.mp4`
- `premium-match-ui-evidence/direction-c-motion.mp4`
- `premium-match-ui-evidence/directions-side-by-side.png`
- `premium-match-ui-evidence/recommended-direction-b.png`
- `premium-match-ui-evidence/direction-b-flow.png`
- `premium-match-ui-evidence/direction-b-contrast.png`
- `premium-match-ui-evidence/direction-b-resolutions.png`
- `premium-match-ui-evidence/presentation-lab-controls.png`
- `premium-match-ui-evidence/source-analysis/pumo-contact-sheet.png`
- `premium-match-ui-evidence/source-analysis/pumo-prematch-round-sequence.png`
- `premium-match-ui-evidence/source-analysis/pumo-result-day-sequence.png`
- `premium-match-ui-evidence/source-analysis/pumo-round-start-sequence.png`
- `premium-match-ui-evidence/source-analysis/tokon-contact-sheet.png`
- `premium-match-ui-evidence/source-analysis/tokon-counter-sequence.png`
- `premium-match-ui-evidence/source-analysis/tokon-round-start-sequence.png`

Not changed:

- production HUD, callout, ceremony, result, flow, or lighting components;
- gameplay, server simulation, input classification, rollback/prediction, hit rules, movement, networking, or combat-audio code;
- package manifests or runtime dependencies.

No production build, Electron build, Steam package, sprite bake, dohyo bake, broad formatter, or image/audio asset pipeline was run. `ffmpeg` was used only to inspect supplied videos and compose evidence sheets; Chrome headless was used only for lab screenshots.

