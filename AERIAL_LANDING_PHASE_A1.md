# Aerial Landing — Phase A.1 (Rope-Jump Trajectory Hardening)

**Status:** Implemented behind feature flag · **Default: OFF** · **Not visually approved**  
**Date:** 2026-07-30  
**Scope stop:** Rope jump V2 trajectory only. No slide jump / FLAP / butt slam. V2 remains disabled by default.

**Follow-up:** Phase A.2 decision stability — [`AERIAL_LANDING_PHASE_A2.md`](./AERIAL_LANDING_PHASE_A2.md). A.1’s 15px scan missed 0.25px endpoint cliffs (~200–260 px) and ordinary `hold_settle` rope hops; A.2 corrects decision continuity without enabling V2 by default.

**Follow-up:** Phase A.3 dynamic conflict — [`AERIAL_LANDING_PHASE_A3.md`](./AERIAL_LANDING_PHASE_A3.md). A.2’s irreversible `preserve_raw` lock failed ordinary ice approaches into a previously clear raw cell.

Companion: [`AERIAL_LANDING_PHASE_A.md`](./AERIAL_LANDING_PHASE_A.md), [`COMBAT_FIDELITY_AUDIT.md`](./COMBAT_FIDELITY_AUDIT.md).

---

## Phase A trajectory defect (not rewritten as approved)

Phase A’s endpoint solver was sound, but post-commit motion used **position-only ease rebasing**:

```js
x = commitX + (resolved − commitX) * u(eased)
```

That guarantees position continuity at commit, **not** velocity continuity. Independent review found visible midair acceleration, late reverse, and forced cross-ups.

### Measured Phase A examples (size 0.85, map 340–935, left raw ≈ 438.175)

| Case | Setup | Commit t / X | Endpoint | Defect |
|------|--------|--------------|----------|--------|
| **1** | Opp on raw | 0.590 / 402.82 | 548.69 | Pre Δ≈5.2 → post Δ≈20.8 (**~3.9×** speed pop); peak vel ≈1333 px/s |
| **2** | Opp X=470 | 0.590 / 402.82 | 359.49 (near) | Travels centerward then **reverses** toward rope |
| **3** | Opp X=450 | 0.590 / 402.82 | 560.51 (alt) | Preferred clamp at 340 had **0.5 px** residual; rejected → forced cross-up |

Mirrored on the right rope with symmetric numbers.

Phase A docs that called the kink “slight” were incorrect for Case 1.

---

## Chosen path model

### Trajectories (post-commit)

| Type | When | Continuity |
|------|------|------------|
| **`hermite`** | Default clear forward endpoint | Cubic Hermite in **linear remaining time**: matches commit X + commit vel, ends at endpoint with v=0 |
| **`brake`** | Preferred endpoint ahead but Hermite would reverse (can’t brake with matched tangents) | Quadratic ease-out; bounded vel discontinuity ≤ `BRAKE_MAX_VEL_DISCONTINUITY` (400 px/s) |
| **`hold_settle`** | Endpoint ≈ commit / tiny residual at boundary | Hold X; only when \|commitVel\| ≤ 120 px/s (early lock) |

### Endpoint planner

`planLandingEndpoint()` scores candidates with explicit costs (overlap, travel, side switch, peak vel/accel, cross-up ratio). Live stepping uses the planner; pure geometry tests still call `resolveLandingTarget()`.

---

## Policies (documented thresholds)

| Constant | Value | Why |
|----------|-------|-----|
| `TOLERABLE_TOUCHDOWN_OVERLAP_PX` | **18** | Equals existing landing safety cap (one 64 Hz tick ≈ 15.6 ms). Tiny residual beats a doubling of travel. |
| `MAX_CROSSUP_TRAVEL_RATIO` | **1.35** | Cross-up travel vs \|raw−start\|; Case 3 alternate was ~1.6× and rejected when residual preferred exists. |
| `HOLD_SETTLE_EPS_PX` | **0.75** | Near-zero remaining travel → hold instead of Hermite overshoot. |
| `HOLD_SETTLE_MAX_COMMIT_VEL` | **120 px/s** | Only early locks may kill H-velocity; late ~330 px/s kills forbidden. |
| `BRAKE_MAX_VEL_DISCONTINUITY` | **400 px/s** | Max commit vel pop for brake path; still ≪ Phase A ~1000 px/s cross-up spike. |
| `ROPE_JUMP_LANDING_COMMIT_T` | **0.58** | Latest lock (opponent sampling window). |
| `ROPE_JUMP_LANDING_COMMIT_T_MIN` | **0.05** | Earliest early-lock for overshoot / boundary residual. |

### Direction-reversal policy

A rope jump is an escape **toward center**. The V2 path must not travel centerward then reverse toward the originating rope solely to keep the near side.

- If preferred endpoint would be **behind** at late commit → **early lock** while still feasible, or **hold_settle** with tolerable residual, or **forward cross-up** if cheaper than deep residual.
- Never retain a visible reverse-direction Hermite arc.

### Boundary / residual policy

Replaces “preferred must be perfectly clear else alternate”:

1. Exact clear preferred  
2. **Small residual preferred** (≤18 px) — including map clamp  
3. Brake to nearby preferred  
4. Forward cross-up when necessary  
5. Both sides constrained / emergency raw settle  

Decision classes are recorded on the player (`ropeJumpDecisionClass`, `ropeJumpFallbackReason`).

### Commit timing

- Default final lock at **0.58** when the planned endpoint stays forward-reachable.  
- **Early lock** (`requiresEarlyCommit`) when waiting until 0.58 would put the preferred/residual endpoint behind the raw path (Cases 2–3).  
- At most one authoritative commitment; no post-commit re-homing.

**A.2 note:** the boolean `requiresEarlyCommit` + 0.75px behind-epsilon created Cliff 2. Replaced by continuous `recommendedCommitT` (see A.2).

---

## Production / debug network separation

Phase A put ~15 landing diagnostic fields on `DELTA_TRACKED_PROPS`, updating during the active arc even with the client overlay off.

**A.1:**

- Diagnostics moved to `LANDING_DIAG_DELTA_PROPS`.  
- Registered on the delta wire **only** when `LANDING_DEBUG_NET` (implied by `LANDING_TRACE=1`).  
- Optional one-shot `landing_diag` socket event at commit/touchdown under the same flag.  
- Gameplay still sends `isRopeJumping`, `ropeJumpPhase`, `x`, `y`.

| Metric | Phase A (approx) | A.1 production |
|--------|------------------|----------------|
| Diag fields on normal PvP delta | 15 keys / ~280–350 B per change | **0** |
| Debug path | N/A | `landing_diag` event ~400 B, 1–2× per jump |

---

## Shared pushbox geometry

`server-io/pushboxGeometry.js` owns `getPushboxHalfWidth` / `getMinimumCenterDistance`.  
`calculateEffectiveHitboxSize()` and landing resolution both use it. No value change. No pose-geometry phase.

---

## After A.1 — measured Cases 1–3

| Case | Commit | Endpoint | Result |
|------|--------|----------|--------|
| **1** | 0.590 / 402.82 | 548.69 hermite | Vel ratio **~1.37** (was 3.92); peak vel ~1109; no reverse; overlap 0 |
| **2** | **0.069** early / 341.16 | 359.49 hermite | No reverse; stays near side; overlap 0 |
| **3** | **0.069** early / 341.16 | 341.16 hold_settle | Residual **~1.7 px**; no cross-up to 560 |

Right-rope mirrors match.

**A.2 revises Case 3:** near map-unfit / sub-threshold escape → **cross** (~560) instead of vertical `hold_settle` at the rope. See A.2 playtest matrix.

---

## Tests

```bash
cd server-io
npm test                 # full suite
npm run test:landing     # landing only
```

Added/fixed:

- `rope-jump-trajectory.test.js` — Cases 1–3, mirrors, full grid scan, Hermite v0, symmetry  
- `rope-jump-integration.test.js` — `startRopeJump` / `stepRopeJumpActive` wiring, delta gating, pushbox ownership  
- Fixed tautology `overlap \|\| correctionTicks >= 0`  
- Geometric Case 3 residual preference (`15b`)

---

## Remaining limitations

- Brake path allows a bounded commit velocity discontinuity (documented).  
- Post-commit opponent motion into the cell can still need ≤18 px/tick safety.  
- Extreme both-sides-constrained size/edge cases may still leave residual overlap.  
- V2 still default **OFF** pending playtest.

---

## Local playtest matrix

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
| 1 | Left rope, opp standing on raw | Smooth accel to right of opp; no speed pop; clear land |
| 2 | Left rope, opp ~470 | Early near-side land; **no** reverse toward rope |
| 3 | Left rope, opp ~450 | Stay near rope with tiny residual; **no** cross-up to ~560 |
| 4 | Mirror 1–3 from right rope | Symmetric |
| 5 | Opp walking into cell | See A.3: pre-commit replan; not N×18 safety |
| 6 | Landing punish / buffer / shake / facing | Unchanged vs legacy timings |

---

## Rollback

Unset `ROPE_JUMP_LANDING_V2` (default). Legacy path unchanged in `stepRopeJumpActive({ useV2: false })`.

---

*Phase A.1 stop gate. Do not enable V2 by default or integrate other aerial verbs in this conversation.*
