# Offensive Aerial Cleanup Contract — Phase 2 (+ Phase 3 contact)

**Status:** Implemented (2026-07-31). Behavior-preserving.  
Companions: `OFFENSIVE_AERIAL_OUTCOME_CONTRACT.md`, `offensiveAerialOutcome.js`, `offensiveAerialContact.js`, `offensiveAerialReaction.js`

---

## Cleanup stages

| Stage | When | Guarantees |
|-------|------|------------|
| `NONE` | Activation start | Hitbox follows existing descending/dive rules |
| `CONTACT_CONSUMED` | After `HIT` / `PARRIED` | Hitbox dead; latch coherent; flight may continue on HIT; **Phase 3:** immutable contact; **Phase 4 default:** `PARRIED_RECOIL`; `V2=0` parry grounds via clearAll |
| `AIRBORNE_INTERRUPTED` | Mid-air cancel / parry clearAll path | Hitbox dead; flight flags cleared; no authored resume |
| `TOUCHDOWN_HANDOFF` | Y snap + landing phase | Outcome inspectable; hitbox dead; recovery timings unchanged; pushbox unchanged |
| `RECOVERY_COMPLETE` | Landing recovery expiry → `clearSlideJumpState` | Move fields cleared; outcome finalized (nulled); control restored as before |
| `FULL_RESET` | Round / disconnect / clearAll teardown | Nothing survives |

---

## Field ownership table (actual fields)

| Field | Owner | Create | Mutate | Contact consumed | Parry | Hit | Interrupt | Touchdown | Recovery complete | Full reset |
|-------|-------|--------|--------|------------------|-------|-----|-----------|-----------|-------------------|------------|
| `offensiveAerial.*` | outcome module | begin/ensure | resolve/mark | set consumed + contact meta | PARRIED + contact | HIT + contact | INTERRUPTED then null (no fabricated contact) | handoff / WHIFF / keep HIT+contact | finalize null | null |
| `_offensiveAerialSeq` | outcome module | takeoff | +1 per begin | keep | keep | keep | keep | keep | keep | 0 on round reset |
| `isSlideJumping` / `slideJumpPhase` | index.js | takeoff | land/clear | keep (HIT) | clear | keep until land | clear | → landing | clear | clear |
| `slideJumpVelocityX/Y` | index.js | takeoff | integrate | keep (HIT) | clear | keep until land | clear | zero | clear | clear |
| `slideJumpDiveCommitted` | index.js | S | — | keep | clear | keep | clear | keep (VFX) | clear | clear |
| `slideJumpHitLanded` | collisionSystem | hit | — | true | false/cleared | true | clear | keep | clear | clear |
| `slideJumpHasFlap` / `slideJumpFlapFlightActive` | gameUtils/index | arm/spend | — | keep | clear | keep | clear | keep (recovery ms) | clear | clear |
| `flapCharges` / `flapVelocityX` / wing fields | index/gameUtils | arm/spend | spend/friction | 0 on hit | clear | 0 | clear | zero H | clear | clear |
| Flight immunity (`isSlideJumpFlightImmune`) | derived | flight & !dive | dive removes | same | cleared w/ flight | same until dive/land | cleared | cleared | cleared | cleared |
| `actionLockUntil` | index.js | land | — | burst if hit | AP stagger (parry path) | burst on land | 0 via clearAll | set recovery | 0 | 0 |
| `isRecovering` (parry stagger) | resolveFlapRawParry | parry | timer | n/a | true | n/a | may clear | n/a | n/a | clear |
| `inputBuffer` | sockets / executeInputBuffer | input | — | blocked while SJ | cleared in clearAll | blocked while SJ | cleared | blocked until clear | prior rules | clear |
| Facing | index / parry | — | land refresh / parry | — | retarget | — | — | — | refresh vs opp | reset |
| `_offensiveAerialTrace` | trace module | debug | samples | — | — | — | clear | — | flush/clear | clear |

---

## Helper classification

| Helper | Verdict | Phase 2 change |
|--------|---------|----------------|
| `clearSlideJumpState` | Narrow move-end; now optional finalize + stale-instance gate | **Hardened** — idempotent; `expectedInstanceId`; `finalizeOutcome` |
| `clearAllActionStates` | Broad but intentional interrupt | **Hardened** — preserve HIT/PARRIED; record INTERRUPTED for armed mid-air; else reset |
| `resolveFlapRawParry` | Correct parry owner | Records PARRIED before clear; restores record after clearAll |
| `checkFlapBodySlam` | Correct hit owner | Records HIT + consumed; latch unchanged |
| Landing block in `index.js` | Correct touchdown/recovery owner | Touchdown terminal + instance-gated clear |
| Round / player cleanup | Broad intentional | Nulls outcome + seq/debug counters |

---

## Stale-owner protection

`canCleanupOffensiveAerialInstance(player, expectedInstanceId)`:

- Mismatch → reject, increment `_offensiveAerialStaleRejects`, no throw
- Used by `clearSlideJumpState` / resolve / finalize when ID supplied
- Landing recovery captures instance ID before clear

---

## Immunity ownership (unchanged rule)

Derived: `isSlideJumping && phase===flight && !diveCommitted`.

- FLAP arm alone does not add extra immunity beyond flight
- Dive removes immunity exactly as before
- Parry / interrupt / touchdown / reset clear via clearing flight flags
- Rope Jump protection lifecycle is not used

---

## Buffered inputs (unchanged)

- `executeInputBuffer` still returns false while `isSlideJumping`
- `clearAllActionStates` still clears buffers (parry/interrupt paths)
- No new global buffer wipe on touchdown alone

---

## Animation (unchanged)

Client still keys off existing flags (`isSlideJumping`, phase, dive, recovering). Outcome enum is debug-oriented; not required for production pose selection.
