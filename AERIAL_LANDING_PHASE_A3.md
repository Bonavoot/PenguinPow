# Aerial Landing — Phase A.3 (Dynamic Landing-Conflict)

**Status:** Implemented behind feature flag · **Default: OFF** · **Late-intrusion settle superseded by A.3.1**  
**Date:** 2026-07-31  
**Scope stop:** Rope-jump V2 dynamic conflict planning only. No slide jump / FLAP / butt slam. V2 remains disabled by default. No rebalance of timings, stamina, invuln, or recovery.

**Phase A.3.1:** A.3’s one-tick late-intrusion freeze left residual overlap that snapped on the first grounded tick after recovery, and jump-direction tiebreak could increase overlap. See [`AERIAL_LANDING_PHASE_A3_1.md`](./AERIAL_LANDING_PHASE_A3_1.md).

Companion: [`AERIAL_LANDING_PHASE_A.md`](./AERIAL_LANDING_PHASE_A.md), [`AERIAL_LANDING_PHASE_A1.md`](./AERIAL_LANDING_PHASE_A1.md), [`AERIAL_LANDING_PHASE_A2.md`](./AERIAL_LANDING_PHASE_A2.md).

---

## Why A.3 (A.2 defect — not visually approved)

Phase A.2 locked side intent at the first planning tick (`t ≥ COMMIT_T_MIN`). When the raw footprint was clear, that lock was:

```text
intentClass: "preserve_raw"
ropeJumpSideIntentLocked: true
```

`planLandingEndpoint()` then kept the raw target for the rest of the jump whenever `intentClass === "preserve_raw"`, even after the opponent walked deeply into the landing cell.

### Confirmed reproduction (64 Hz, size 0.85)

| Case | Setup | A.2 result |
|------|--------|------------|
| **1** | Left start 340, opp 560, −3.75 px/tick | `preserve_raw` → end 438.175; touchdown overlap **97.425**; **7** correction ticks; total pair displacement **≈123.6** |
| **1R** | Right start 935, opp 715, +3.75 px/tick | Mirror of Case 1 |
| **2** | Left start 340, opp 555, −2 px/tick | `preserve_raw`; overlap **≈51.7**; **3** correction ticks |

These rates are ordinary ice movement (`15.625 × 0.185 × 1.3 ≈ 3.76` px/tick), not synthetic stress.

### Why existing moving tests passed

They asserted `maxSingleTickCorrection ≤ 18`, which is true for every tick of a 7-tick slide. Event-level totals and “clear → conflict before commit” were not covered.

---

## Planning-state lifecycle

| State | Meaning |
|-------|---------|
| `provisional_raw` | Raw footprint currently clear (or not yet side-locked). Follow raw arc. **Not** an irreversible side decision. |
| `side_locked` | First meaningful pre-commit conflict selected `near` or `cross` once. Endpoint may refine on that side until commit. |
| `endpoint_committed` | Final endpoint locked. No re-home. |

Rules:

1. `preserve_raw` never sets `ropeJumpSideIntentLocked`.
2. `near` / `cross` lock at most once; never revert to provisional raw.
3. If raw stays clear through the commit window → commit unchanged raw.
4. Conflict after endpoint commit → classified late intrusion (bounded safety only).

---

## Side-lock rule

On first trusted-velocity sample with `rawOverlap > 0` before the no-return deadline:

1. Predict opponent X at touchdown (`x + v·rem`, plus measured ice accel when present).
2. Run A.2 `resolveSideIntent` on the **predicted** cell.
3. If preferred ideal is map-unfit / residual / sub-escape → take clear alternate.
4. Lock that side once; refine endpoint with predicted+clearance bias until commit.

Waiting one tick for a trusted Δx sample prevents 0→vel spikes from looking like huge acceleration.

---

## Dynamic no-return

While provisional and raw-clear: deadline = `COMMIT_T_MAX` (full window).  
Once conflict geometry exists: latest `t` where a clear same-side Hermite/brake from the raw arc remains planner-feasible (search quantized; ratchets later only).

- Conflict before deadline → must resolve aerially (ordinary budget).
- Conflict after deadline / after commit → late intrusion class.

---

## Endpoint commit

Unchanged A.2 continuous `recommendedCommitT`, with one A.3 fix: when no planner-budget commit time exists, fall back to the **earliest** non-overshoot `t` (not latest), so far dynamic cross-ups do not Hermite-spike at `t≈0.59`.

No endpoint changes after `endpoint_committed`.

---

## Safety-event budget

| Class | Correction ticks | Total correction | Touchdown overlap |
|-------|------------------|------------------|-------------------|
| Ordinary pre-commit conflict | **0** (target); ≤1 if tiny residual | ≈0 | ≈0 (scan worst **≈12** on extreme size/rate) |
| Late intrusion (A.3) | ≤**1** then freeze | ≤**18** | classified — **left residual; superseded by A.3.1** |
| Late intrusion (A.3.1) | settle across recovery, ≤18/tick | event-level clear | recovery-end ≈0; post-recovery ≈0 |

A.3 `adjustPlayerPositions` froze after one late-intrusion tick. **A.3.1** replaces that freeze with authored landing-settle so residual is not deferred to the first grounded frame after recovery.

---

## Dynamic scan results

Sampling: opponent X step **2.5 px** (+ **0.25** zoom at raw boundaries); rates `±3.75…0`; 9 size pairs; both ropes; const-vel profiles (+ dedicated ice-accel / coast / reversal unit tests).

| Metric | Result |
|--------|--------|
| Samples | **39042** |
| Worst pre-deadline touchdown overlap | **≈11.86 px** |
| Worst post-commit touchdown overlap | **≈45 px** (late intrusion class) |
| Max correction ticks | **1** |
| Max total safety correction | **18** |
| Peak velocity | **≈1377 px/s** |
| Peak acceleration | **≈21920 px/s²** |

Confirmed Cases 1 / 1R / 2 after A.3: overlap **0**, correction ticks **0**, total correction **0**.

Static A.2 fine scan (0.25 px) remains green.

---

## Remaining late-intrusion limits

**Superseded by A.3.1 for residual ownership.** A.3 left residual after one 18px safety tick and deferred the rest to post-recovery — that is now treated as a defect, not intentional visibility. See A.3.1 settle + recovery-exit invariant.

Accelerating ice approaches can leave a few pixels of residual (measured ≈5–8) when prediction lags the ramp; A.3.1 clears that in one settle tick (≤18).

A.3’s claim of dedicated acceleration/coast/braking/reversal coverage was overstated relative to the suite (mostly constant-velocity scans + one accel test). A.3.1 adds production-faithful ice profiles.

---

## Tests

```bash
cd server-io
npm test
npm run test:landing
```

New: `test/landing/rope-jump-dynamic-a3.test.js`  
Strengthened: moving-opponent + A.1 full scenario scan event-level budgets.

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
| 1 | Left rope, opp walks from ~560 at full ice speed into raw | Side locks cross/near before commit; clear land; `plan` shows provisional→side_locked→committed |
| 2 | Mirror from right rope | Symmetric |
| 3 | Opp walks at ~2 px/tick from ~555 | Clear land; 0 correction ticks |
| 4 | Standing clear opp | Unchanged raw trajectory |
| 5 | Opp enters cell only after commit | `lateIntrusion`; ≤1 safety tick |
| 6 | Punish / buffer / shake / facing | Unchanged vs legacy timings |

**V2 default remains OFF.**

---

## Rollback

Unset `ROPE_JUMP_LANDING_V2`. Legacy path unchanged.

---

*Phase A.3 stop gate. Do not enable V2 by default or integrate other aerial verbs in this conversation.*
