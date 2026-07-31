# Aerial Landing — Phase A.3.2 (Recovery Re-Intrusion & Release-Tick Stability)

**Status:** Implemented behind feature flag · **Default: OFF** · **Landing/contact playtest-positive; trajectory superseded by move-identity vault**  
**Date:** 2026-07-31  
**Scope stop (historical):** Rope-jump V2 recovery collision monitoring + re-intrusion settle only. No slide jump / FLAP / butt slam. No rebalance of timings, stamina, invuln, or recovery length.

**Final outcome (2026-07-31):** Rope Jump V2 with A.3.2 settle is **manually approved** and **default ON** (`reference_contact_9`). Legacy rollback: `ROPE_JUMP_LANDING_V2=0`. See [`ROPE_JUMP_MOVE_IDENTITY_V2.md`](./ROPE_JUMP_MOVE_IDENTITY_V2.md).

**Follow-up:** High-vault move identity — [`ROPE_JUMP_MOVE_IDENTITY_V2.md`](./ROPE_JUMP_MOVE_IDENTITY_V2.md). A.3.2 landing settle is retained; the airborne planner is replaced by an authored vault + capped endpoint correction.

**Polish / approval:** [`ROPE_JUMP_V2_POLISH_TUNING.md`](./ROPE_JUMP_V2_POLISH_TUNING.md) — rounded rejected; `reference_contact_9` approved (reference traj + allow 9). A.3.2 settle/re-intrusion lifecycle unchanged.

Companion: [`AERIAL_LANDING_PHASE_A3_1.md`](./AERIAL_LANDING_PHASE_A3_1.md), [`AERIAL_LANDING_PHASE_A3.md`](./AERIAL_LANDING_PHASE_A3.md).

---

## Why A.3.2 (A.3.1 defect — not visually approved)

Phase A.3.1 correctly settles overlap that exists at touchdown, but treated `recovery_safe_to_release` as a **sticky collision exemption** for the rest of landing recovery.

Those two meanings are not equivalent:

1. No collision debt exists at this exact moment
2. Collision can be ignored for the rest of recovery

A fighter clear at touchdown does not guarantee the opponent cannot enter the landing footprint during the next ~187.5 ms.

### Confirmed reproduction (64 Hz, production pushbox → clear → move order)

| Field | Value |
|-------|-------|
| Jumper start | 340, dir +1, size 0.85 |
| Opponent | 560 stationary in air, then −3.75 px/tick in recovery, size 0.85 |
| Touchdown X / opp | ≈438.175 / 560 |
| Touchdown center distance | ≈121.825 (min 110.5) |
| Touchdown overlap | **0** |
| Touchdown settle state | `recovery_safe_to_release` (pre-fix) |
| Recovery overlap debt | accumulates to **≈33.675** |
| Cleanup-tick pushbox | **0** (sticky ignore) |
| First grounded pushbox | **≈33.675** pair displacement (~16.84 each) |

Mirrored from the right rope. Ordinary ice movement — not synthetic stress.

### Sticky-safe mechanism

```js
} else if (
  ropeJumper &&
  ropeJumper.ropeJumpLandingPath === "v2" &&
  ropeJumper.ropeJumpSettleState === SETTLE_RECOVERY_SAFE_TO_RELEASE
) {
  return; // ignored all recovery collision
}
```

---

## Actual production cleanup / pushbox ordering

From `server-io/index.js` tick:

1. **Early pair block:** `adjustPlayerPositions` (shared pushbox)
2. **Per-player loop:** rope-jump landing recovery may `clearRopeJumpLandingState`
3. **Per-player loop (later):** ice / strafe movement

Therefore accumulated recovery debt snaps on the **first fully grounded pushbox tick after clear**, not necessarily on the cleanup tick itself. The test helper records both `cleanupTick` and `postRecovery` under production order, plus an optional `movement_then_pushbox` harness.

---

## Required invariant

> From touchdown until landing recovery is released, any newly created fighter overlap must be resolved continuously and must not accumulate into a release-tick correction.

---

## New landing-recovery monitoring lifecycle

| State | Meaning |
|-------|---------|
| `landing_settle_active` | Authored settle correcting current overlap |
| `recovery_clear_but_monitoring` | Currently clear; recovery still owns collision |
| `recovery_safe_to_release` | Legacy/diagnostic alias for clear-under-monitoring — **must not suppress overlap** |

```text
touchdown / settle clear
    → recovery_clear_but_monitoring
         ├── overlap == 0 → remain monitoring
         ├── overlap > 0  → reactivate landing_settle_active
         └── recovery ends while clear → release (cleanup)
```

Rules:

1. Collision monitoring remains active for the entire landing recovery.
2. New overlap reactivates settle (or clears shallow contact immediately under the 18 px cap).
3. Spatial side stays stable unless centers are coincident.
4. No aerial endpoint / side-intent replan.
5. No homing toward the opponent — grounded pushbox/contact only.
6. Recovery duration, control lock, invuln, punishability unchanged.
7. Ordinary movement-created contact corrections ≈ newly introduced penetration.
8. Deep knockback re-intrusion is classified and settled ASAP under the per-tick cap (episode budget = `ceil(overlap/18)`), not re-spread across the full recovery window.

---

## Measured Case 1 after A.3.2

| Metric | Before (sticky safe) | After |
|--------|----------------------|-------|
| Touchdown overlap | 0 | 0 |
| Touchdown state | `recovery_safe_to_release` | `recovery_clear_but_monitoring` |
| Max recovery overlap | ≈33.675 | **3.75** |
| Max ordinary correction | 0 during recovery, then 33.675 | **3.75** |
| Cleanup-tick displacement | 0 (ignored) | **3.75** (last pre-clear intrusion) |
| First grounded displacement | **≈33.675** | **0** |
| Overlap ever increased | n/a | **false** |
| Settle reactivated | no | **yes** |

---

## Recovery-phase scan results

Sampling: left-rope starts; opponent X ∈ {520,540,560,580,600}; rates ±3.75…0; 9 size pairs; profiles const / accel / coast / brake / reverse / enter-leave / enter-leave-reenter / final-tick; plus early knockback; right-rope mirrors for a subset.

| Metric | Result |
|--------|--------|
| Samples | **3276** |
| Worst ordinary recovery overlap | **3.75** |
| Worst ordinary correction | **3.75** |
| Worst cleanup-tick displacement | **3.75** |
| Worst first-grounded displacement | **≈0** |
| Sticky-safe debt failures | **0** |
| Overlap-increase failures | **0** |

---

## Dynamic budget exception (unchanged)

The A.3.1 far-cross ≈1468 px/s exception remains explicitly classified for manual playtest. This phase does not redesign it.

---

## Tests

```bash
cd server-io
npm test
npm run test:landing
```

New: `test/landing/rope-jump-recovery-reintrusion-a32.test.js`  
Updated: `helpers/ropeJumpSim.js` (`landingOpponentStep`, production-order cleanup metrics).

---

## Local playtest matrix

```bash
# Normal development (V2 default on):
npm run dev:web

# Optional diagnostics:
LANDING_DEBUG_NET=1 LANDING_TRACE=1 npm run dev:web
```

Client:

```js
localStorage.setItem("pumo_combat_fidelity_debug", "1")
localStorage.setItem("pumo_landing_trace", "1")
```

| # | Scenario | Expect |
|---|----------|--------|
| 1 | Left rope, opp stands at ~560, then walks in at full ice speed during landing recovery | Clear touchdown; body contact maintained; **no** release/grounded snap |
| 2 | Mirror from right | Symmetric |
| 3 | Slower walk-in (~2 px/tick) during recovery | Same invariants |
| 4 | Walk in only in the second half of recovery | No delayed debt |
| 5 | Small enter on the final recovery tick | Cleanup owns contact; no grounded snap; recovery length unchanged |
| 6 | Late-intrusion settle completes, then opp walks back in | Second contact owned and cleared |
| 7 | Enter → leave → re-enter during recovery | No side oscillation; no sticky-safe suppress |
| 8 | Knockback into recovering jumper | Deep settle; monotonic; no release snap |
| 9 | Punish / buffer / shake / facing / recovery length | Unchanged vs A.3.1 timings |

**Final:** V2 is **default ON** (approved). Historical phase notes above described the pre-approval state.

---

## Rollback

```bash
ROPE_JUMP_LANDING_V2=0 npm run dev:web
```

Legacy path unchanged when explicitly selected.

---

*A.3.2 implementation history preserved. Final approval recorded in `ROPE_JUMP_MOVE_IDENTITY_V2.md`.*
