# Aerial Landing — Phase A.3.1 (Late-Intrusion Resolution & Recovery-Exit Stability)

**Status:** Implemented behind feature flag · **Default: OFF** · **Not manually playtest-approved** · **Superseded for recovery re-intrusion by A.3.2**  
**Date:** 2026-07-31  
**Scope stop:** Rope-jump V2 late-intrusion settle + recovery-exit invariants only. No slide jump / FLAP / butt slam. V2 remains disabled by default. No rebalance of timings, stamina, invuln, or recovery length.

**Phase A.3.2:** A.3.1’s `recovery_safe_to_release` sticky exemption ignored new overlap created during recovery after a clear touchdown, deferring a large grounded snap at release. See [`AERIAL_LANDING_PHASE_A3_2.md`](./AERIAL_LANDING_PHASE_A3_2.md).

Companion: [`AERIAL_LANDING_PHASE_A3.md`](./AERIAL_LANDING_PHASE_A3.md), [`AERIAL_LANDING_PHASE_A2.md`](./AERIAL_LANDING_PHASE_A2.md).

---

## Why A.3.1 (A.3 defects — not visually approved)

Phase A.3 stopped multi-tick ordinary slides for pre-commit conflicts, but late-intrusion safety was incomplete:

1. **Residual → delayed snap.** One capped 18 px correction left ~27 px residual; `ropeJumpLateIntrusion` froze further landing corrections; recovery ended and cleared rope-jump state; the next ordinary grounded `adjustPlayerPositions()` applied the entire residual in one tick.
2. **Overlap-increasing correction.** When centers were within half-body, jump-direction tiebreak treated the jumper as opposite their actual side and moved centers closer (e.g. ~88.7 → ~106.7 px).

---

## Confirmed reproductions (pre-fix)

### Defect 1 — realistic late intrusion

| Field | Value |
|-------|-------|
| Jumper start | 340, dir +1, size 0.70 |
| Opponent | 590, −3.75 px/tick, size 0.70 |
| Endpoint / touchdown opp | ≈435.24 / ≈481.25 |
| Touchdown overlap | ≈44.99 |
| After 1×18 correction | jumper≈426.24, opp≈490.25, residual≈26.99 |
| Post-recovery ordinary tick | **≈26.99 pair displacement** |

Mirrored from the right rope.

### Defect 2 — direction tiebreaker stress

| Field | Value |
|-------|-------|
| Touchdown | jumper≈438.175, opp≈460, minDist 110.5 |
| Initial overlap | ≈88.675 |
| Rope direction | +1 (intent: jumper on right) |
| Actual order | jumper still left of opp |
| After one “correction” | overlap **≈106.675** (grew) |

---

## Chosen late-intrusion policy

**`preserve_actual_side` + authored landing-settle across existing recovery**

| Priority | Rule |
|----------|------|
| 1 | Separation never increases overlap |
| 2 | No body pass-through after ground contact |
| 3 | No post-recovery deferred snap |
| 4 | Minimal total displacement / stable side |
| 5 | Competitive predictability |

**Side policy classes:**

| Class | When |
|-------|------|
| `preserve_actual_side` | Actual order disagrees with intended cross-up — keep actual, separate to contact |
| `intended_side_achievable` | Already on intended side — settle on that side |
| `intent_coincident` | Centers within `CENTER_COINCIDENCE_EPS_PX` (1e-3) — jump intent breaks the tie |

Jump intent never chooses a displacement that decreases current center distance when centers are distinguishable.

**Tradeoff:** A committed aerial cross-up that becomes physically impossible at touchdown does **not** force the jumper through the opponent. Side flip is explicit (`preserve_actual_side`), not silent.

---

## Settle lifecycle ownership

| State | Meaning |
|-------|---------|
| `late_intrusion_detected` | Planning classified late intrusion (pre-settle) |
| `landing_settle_active` | Residual debt owned by authored settle |
| `landing_settle_complete` | (transitional) residual cleared |
| `recovery_safe_to_release` | A.3.1: negligible residual. **A.3.2:** replaced as sticky exemption by `recovery_clear_but_monitoring` — clear is not a permanent collision ignore |

At touchdown V2 calls `beginLandingSettle()` which records actual ordering, side policy, initial overlap, and recovery tick budget (`ceil(ROPE_JUMP_LANDING_RECOVERY_MS / TICK_MS)`). A.3.2: zero-overlap touchdown enters monitoring, not a sticky safe return.

---

## Landing-settle path

- Recovery duration, control lock, invulnerability, punishability: **unchanged**
- Per-tick displacement ≤ **18 px** (`LANDING_SETTLE_MAX_PX_PER_TICK`)
- Residual ≤ 18 px clears in **one** settle tick (no deferred debt)
- Residual > 18 px spreads across remaining recovery ticks (ease by remaining/ticks, with last-tick guarantee under the cap)
- Path is continuous and monotonic (`overlapAfter ≤ overlapBefore`)
- Anchored shares unchanged (`isHit` / parry stun / raw parry)
- Map clamps + remainder transfer unchanged
- At release: remaining overlap ≤ `RECOVERY_EXIT_CORRECTION_TOLERANCE_PX` (0.5)

### Measured Case 1 after A.3.1

| Metric | Before | After |
|--------|--------|-------|
| Touchdown overlap | ≈44.99 | ≈44.99 (unchanged aerial) |
| Settle ticks | 1 then freeze | 9 (≤18/tick) |
| Max single-tick pair correction | 18 | ≈15 |
| Recovery-end overlap | ≈26.99 | **0** |
| Post-recovery correction | ≈26.99 | **0** |
| Overlap ever increased | n/a | **false** |

### Measured Defect 2 after A.3.1

| Metric | Before | After |
|--------|--------|-------|
| First correction | 88.7 → 106.7 | 88.7 → ≈81.3 |
| Side policy | (implicit intent) | `preserve_actual_side` |
| Overlap increased | **true** | **false** |

---

## Correction-direction invariant

```text
overlapAfter ≤ overlapBefore
```

Implemented in `resolveLandingSeparationOrdering()` + post-move tracking (`ropeJumpOverlapIncreased`).

---

## Recovery-exit invariant

Immediately after rope-jump landing recovery clears through the real cleanup path, one additional ordinary grounded `adjustPlayerPositions()` tick must move the pair by ≤ **0.5 px** total, with ~0 residual overlap and no side flip.

Timeline helper (`ropeJumpSim.js`) always records `recoveryEnd` + `postRecovery`.

---

## Production-faithful movement profiles

Added profiles using real constants (`ICE_ACCELERATION`, `ICE_MAX_SPEED`, `ICE_BRAKE_FRICTION`, `ICE_STOP_THRESHOLD`, `ICE_TURN_BURST`, `ICE_COAST_FRICTION`, `speedFactor`, `TICK_RATE`):

1. Full-speed approach → active braking  
2. Full-speed approach → direction reversal  
3. Coasting through landing zone  
4. Conflict appears briefly, then clears  
5. Conflict persists  
6. Knocked into landing zone after commit  
7. Knocked out after side lock  
8. Movement change shortly before commit  
9. Movement change shortly after commit  

Mirrored both ropes. Do not claim coverage the tests do not execute.

---

## Dynamic budget exception (honest)

Exact profile: start 340, opp 547, full left ice speed, brake from active tick 15.

| Field | Result |
|-------|--------|
| Locked cross endpoint | ≈615.09 |
| Commit t | ≈0.521 |
| Peak horizontal speed | ≈1468 px/s |
| `feasibility.withinBudget` | **false** |
| `feasibility.withinPlannerBudget` | **false** |
| Classification | `dynamic_commit_exceeds_ordinary_budget` (`ropeJumpBudgetException`) |
| Touchdown overlap | 0 |
| Decision | **Retain for manual playtest** — do not silently raise the ordinary ceiling |

Accepted production trajectories that fail ordinary budgets must set `ropeJumpBudgetException` rather than claim `withinBudget: true`.

---

## Tests

```bash
cd server-io
npm test
npm run test:landing
```

New: `test/landing/rope-jump-late-intrusion-a31.test.js`  
Updated: `helpers/ropeJumpSim.js` (settle + post-recovery tick), A.3 dynamic scan / late budgets, A.1 scenario scan late-settle allowance.

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
| 1 | Left rope, opp walks from ~590 at −3.75 into raw (size 0.70) | `lateIntrusion`; settle during recovery; **no** snap when recovery ends |
| 2 | Mirror from right | Symmetric |
| 3 | Deep bury stress (centers close, intent disagrees with actual) | Overlap never grows; `preserve_actual_side` |
| 4 | Same-center land | Intent chooses side; first move increases separation |
| 5 | Anchored opponent during late residual | Jumper settles; exit stable |
| 6 | Full-speed approach + brake (~547) | May show `budgetException`; clear land; playtest feel |
| 7 | Punish / buffer / shake / facing / recovery length | Unchanged vs prior V2 timings |

**V2 default remains OFF.**

---

## Rollback

Unset `ROPE_JUMP_LANDING_V2`. Legacy path unchanged.

---

*Phase A.3.1 stop gate. Do not enable V2 by default or integrate other aerial verbs in this conversation.*
