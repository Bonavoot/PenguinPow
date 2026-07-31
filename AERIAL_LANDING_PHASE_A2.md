# Aerial Landing — Phase A.2 (Rope-Jump Decision Stability)

**Status:** Implemented behind feature flag · **Default: OFF** · **Superseded for dynamic conflict by A.3**  
**Date:** 2026-07-31  
**Scope stop:** Rope-jump V2 decision continuity only. No slide jump / FLAP / butt slam. V2 remains disabled by default. No rebalance of timings, stamina, invuln, or recovery.

**Phase A.3:** A.2’s first-tick `preserve_raw` lock is not a valid irreversible side decision — see [`AERIAL_LANDING_PHASE_A3.md`](./AERIAL_LANDING_PHASE_A3.md). Static continuity results below remain the A.2 baseline; dynamic approach cases require A.3.

Companion: [`AERIAL_LANDING_PHASE_A.md`](./AERIAL_LANDING_PHASE_A.md), [`AERIAL_LANDING_PHASE_A1.md`](./AERIAL_LANDING_PHASE_A1.md).

---

## Why A.2 (A.1 not visually approved)

Phase A.1 fixed midair Hermite continuity, but independent inspection found severe **decision discontinuities**: nearly identical opponent positions produced radically different landing sides, endpoints, commit times, and trajectory types.

### Confirmed pre-A.2 cliffs (default size 0.85, left rope, raw ≈ 438.175)

| Cliff | Opponent X | Result A | Result B | Δ endpoint | Root cause |
|-------|------------|----------|----------|------------|------------|
| **1** | 439.00 vs 439.25 | end≈549.51 hermite cross | end≈341.16 hold_settle near | ~208 px | `SIDE_AMBIGUITY_EPSILON_PX=1` / `rawOnCenter` flipped preferred side |
| **2** | 511.00 vs 511.25 | end≈400.49 early t≈0.069 | end≈621.76 late cross t≈0.590 | ~221 px | `requiresEarlyCommit` used `isEndpointBehind` with **0.75 px** epsilon vs predicted max-commit X |
| **3** | 514.00 vs 514.25 | end≈624.51 late cross, peakVel≈1722 | end≈403.74 near brake | ~221 px | Short remaining travel converted to `hold_settle` (≤0.75 px), rejected by late-commit vel gate → extreme cross-up |

The 15-pixel A.1 scenario scan missed these because each cliff is only **0.25 px** wide.

### Pre-A.2 fine scan (0.25 px, 9 size pairs, both ropes)

| Metric | Value |
|--------|-------|
| Endpoint cliffs (>20 px adjacent) | **58** |
| Worst cliff | **~260 px** |
| Hold-settle near-rope samples | **930** |
| Velocity/accel budget violations | **384** |
| Repeated side-flip patterns | Common (cross→near→cross) |

---

## Rope-jump gameplay rule (plain language)

Rope jump is a **centerward escape** that may cross an opponent when that is the only way to keep a real escape.

| Situation | Intent |
|-----------|--------|
| Raw landing footprint does **not** overlap opponent pushbox | **Preserve raw** destination |
| Raw start→target segment **crosses** opponent center | **Cross** (jump direction) |
| Raw terminates in opponent on the start side, and a clear near-side footprint yields **meaningful centerward escape** | **Near** (originating side) |
| Near-side clear footprint is off-map or escape travel is below the meaningful threshold | **Cross** (do not collapse into a vertical rope hop) |
| Map geometry makes the locked side deeply residual-only | Bounded residual / emergency on the **locked** side |

Not used for side selection: 1px `rawOnCenter` epsilon, object iteration order, weighted score races, or hard feasibility flips at subpixel boundaries.

---

## Separated decision architecture

1. **Stable side intent** — A.2 locked once at first `t ≥ COMMIT_T_MIN` via `resolveSideIntent()` (including `preserve_raw`). **A.3:** raw-clear stays provisional; only `near`/`cross` lock once on conflict.
2. **Stable commit policy** — `computeRecommendedCommitT()` finds the latest raw-arc time that does not overshoot the planned endpoint and stays inside planner motion budgets (continuous; replaces boolean `requiresEarlyCommit`).
3. **Same-side endpoint refinement** — endpoint = `opponentX ± (minDistance + pad)` on the locked side (clamped). Score may choose hermite vs brake, never the opposite side.
4. **Motion-feasible trajectory** — Hermite (default) / brake / emergency hold only.

### Fate of A.1 mechanisms

| Mechanism | A.2 fate |
|-----------|----------|
| `SIDE_AMBIGUITY_EPSILON_PX` | **Unused by side intent** (export retained for compat). Exact center coincidence uses jump direction only when start==opp; land-short vs cross uses map-fit + escape travel. |
| `requiresEarlyCommit` | **Replaced** by `recommendedCommitT` (still exported as a derived boolean alias for older tests). |
| `hold_settle` | **Emergency / float only** — not a normal response when the preferred endpoint is behind commit. Ordinary rope-edge collapses become **cross**. |
| Weighted candidate score | Soft ranking **within** locked side only. |

### Meaningful centerward escape

```
minEscape = max(12, min(0.35 × jumperHalfWidth, 0.15 × |raw − start|))
```

Near intent requires on-map ideal endpoint with centerward travel ≥ `minEscape`.  
Default size (0.85): ≈14.7 px → near-escape opponent boundary ≈ **465.2**.

### Intentional discrete boundaries (only these)

1. **Near-escape threshold** — opponent X where near clear footprint first yields `minEscape` travel.
2. **Raw-center crossing** — opponent center crosses the raw target (segment cross appears/disappears). Often shadowed when the escape boundary is centerward of raw.
3. **Clear ↔ conflict** — `|raw − opp|` crosses `minimumDistance` (preserve_raw).

No repeated cross→near→cross patterns across a fine sweep.

---

## Post-A.2 fine-scan results

Sampling: opponent X step **0.25 px**, zoom **0.1 px** at transitions; both ropes; size pairs 0.70/0.85/1.00 (all 9 combinations).

| Metric | Result |
|--------|--------|
| Max same-side adjacent endpoint Δ | **0.25 px** |
| Same-side cliffs >2 px | **0** |
| Intentional side transitions | **18** (exactly 1 per size×direction sweep) |
| Max side flips per sweep | **1** |
| Hold-settle near-rope | **0** |
| Peak velocity (all samples) | **≈1097 px/s** (budget 1225) |
| Peak acceleration | **≈21810 px/s²** (budget 25000) |
| Touchdown overlap | **0** on all ordinary samples |
| Safety corrections | **0** on static fine scan |

Confirmed cliffs 1–3: adjacent endpoints differ by **0.25 px**; same side; under budgets.

---

## Commit / continuity invariants

- Side intent does not flip during one jump (including slow opponent motion after lock).
- Within a side region, 0.25 px opponent motion ⇒ ≤ ~2 px endpoint motion (measured max 0.25).
- Commit time does not jump 0.07↔0.59 without crossing an explicit boundary.
- Total active duration 450 ms, vertical arc, stamina, startup vulnerability, airborne immunity, landing recovery, buffer, facing, shake — unchanged.
- No post-commit re-homing.

---

## Tests

```bash
cd server-io
npm test                 # full suite (388)
npm run test:landing     # landing only
```

New: `test/landing/rope-jump-stability-a2.test.js` — cliffs 1–3, mirrors, hold-band elimination, intent lock vs moving opponent, determinism, mirror symmetry, fine scan.

Updated: Case 3 expectations (cross escape, not residual hold); pure solver land-short / map-unfit cases.

---

## Local playtest

```bash
cd server-io
ROPE_JUMP_LANDING_V2=1 LANDING_DEBUG_NET=1 LANDING_TRACE=1 npm start
```

Client:

```js
localStorage.setItem("pumo_combat_fidelity_debug", "1")
localStorage.setItem("pumo_landing_trace", "1")
```

| # | Scenario | Expect |
|---|----------|--------|
| 1 | Left rope, opp at 439.00 then 439.25 | Both cross right of opp; endpoints ~0.25 apart; no rope hop |
| 2 | Left rope, opp at 511 / 511.25 | Both near-side; similar commit era; no 200px flip |
| 3 | Left rope, opp at 514 / 514.25 | Both near brake/hermite; peak vel under ~1100 |
| 4 | Left rope, opp ~440–465 | Cross escape (not vertical hold at rope) |
| 5 | Left rope, opp ~470+ | Near-side land with visible centerward travel |
| 6 | Mirror 1–5 from right rope | Symmetric |
| 7 | Opp walks across ~465 during jump after lock | Side stays locked; no oscillation |
| 8 | Landing punish / buffer / shake / facing | Unchanged vs legacy timings |

**V2 default remains OFF** until playtest sign-off.

---

## Rollback

Unset `ROPE_JUMP_LANDING_V2`. Legacy path unchanged.

---

*Phase A.2 stop gate. Do not enable V2 by default or integrate other aerial verbs in this conversation.*
