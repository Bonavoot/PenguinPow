# Offensive Aerial Phase 5A — State Transition, Animation Ownership, Facing-Lock Hardening

**Date:** 2026-07-31  
**Status:** Complete. Ownership / facing hardening only — no combat retune, no new art, no effect redesign.

Modules:

- `server-io/offensiveAerialFacing.js` — instance-owned facing locks
- `server-io/offensiveAerialPresentation.js` — presentation projection (not a second combat FSM)

Wire field (compact): `offensiveAerialPresentation`  
Client consumers: `getImageSrc.js`, `GameFighter.jsx`

---

## 1. Facing-lock inventory (pre-Phase-5A)

| Mechanism | Field / helper | Acquire | Direction source | Release | Instance-tied? | Stale risk |
|-----------|----------------|---------|------------------|---------|----------------|------------|
| Soft aerial freeze | `getLockedFacing` via `isSlideJumping` / `isFlapping` | Takeoff / flight | `player.facing` (A/D may rewrite) | Flags clear | No | Lock soft-survives if flags linger; no owner ID |
| Takeoff face | `player.facing = jumpDir` | Takeoff tick | Ice-slide / velocity sign | Overwritten by steer / land | No | Can be wrong after owner ends |
| Dive pin | Dive commit (X lock; facing not rewritten by steer) | S press | Current facing | Land / clear | No | Auto-face could still thrash without soft freeze |
| HIT continuation | Kept prior facing + soft freeze | Contact | Travel facing | Land refresh | No | A/D could flip during continuation |
| PARRIED V2 | Face defender once in `armParriedRecoilFlight` | Parry resolve | Relative X at contact | Land / clear | No | Root cross + `enforcePairFacing` if soft freeze drops |
| Landing refresh | Face opponent on `landDone` | Recovery complete | Relative X | — | No | Double update / race with auto-face |
| Hitstun | `getLockedFacing` → `player.facing` while `isHit` | Hit reaction | Hit system | Hit end | No | OK if aerial soft lock cleared first |
| Ropes | `atTheRopesFacingDirection` | Ring-out | Stored | Round / return inside | Explicit field | Unrelated to aerial |
| Slap / charge / pull / throw | `*FacingDirection` fields | Those actions | Action snapshot | Action clear | Partial | Unrelated; unchanged this phase |

**Confirmed stale failure paths addressed**

1. Soft `isSlideJumping` freeze with no instance ID — delayed cleanup could not prove ownership.
2. HIT / PARRIED facing could flip when A/D or root-order auto-face raced after soft lock loss.
3. Generic clear could wipe facing without a newer-owner gate.
4. Client inferred attack poses from loose booleans (dive / flap) after PARRIED.

---

## 2. Central facing ownership model

Lock record on `player.offensiveAerialFacingLock`:

| Field | Role |
|-------|------|
| `ownerType` | `OFFENSIVE_AERIAL` |
| `ownerInstanceId` | Attack-instance ID (or null for plain slide-jump) |
| `direction` | `-1` \| `1` |
| `reason` | `FLIGHT` / `DIVE` / `HIT_CONTINUATION` / `PARRIED_RECOIL` / `WHIFF_DESCENT` / `LANDING` / `INTERRUPTED` |
| `acquiredTick` | Optional tick stamp |
| `releaseCondition` | Intended terminal (`RECOVERY_COMPLETE`, `INTERRUPT`, `FULL_RESET`, …) |
| `allowSteerUpdate` | Free flight may update; dive / post-contact / landing may not |
| `active` | Live flag |

Operations: acquire (with supersede), update direction (steer-gated), release (instance-gated, idempotent), force-clear (reset / interrupt), validate via owner ID, recalculate neutral after release.

`getLockedFacing` prefers an active aerial lock over bare `isSlideJumping` soft freeze.

---

## 3. Acquisition / release rules

| Phase | Facing owner | Steer | Release / transfer |
|-------|--------------|-------|--------------------|
| FLAP / slide-jump flight | Aerial lock `FLIGHT` | Allowed | Dive upgrade / contact / touchdown |
| S-dive | Aerial lock `DIVE` | Frozen | Contact / touchdown |
| HIT continuation | Aerial lock `HIT_CONTINUATION` | Frozen | Touchdown → `LANDING` |
| PARRIED recoil | Aerial lock `PARRIED_RECOIL` | Frozen | Touchdown → `LANDING` |
| WHIFF descent | Flight lock (or explicit `WHIFF_DESCENT`) | As armed | Touchdown → `LANDING` |
| Interruption | Force-clear aerial lock; hitstun owns | — | Hit system |
| Touchdown / landing | Aerial lock `LANDING` | Frozen | Recovery complete |
| Neutral | No aerial lock | Auto-face | — |
| Round reset | Force-clear | — | — |

**Invariants:** old instance cannot release/overwrite newer; release idempotent; full reset clears; facing never invalid; deliberate lock beats ordinary opponent-facing.

---

## 4. Same-center / neutral fallback

After final lock release, `resolveNeutralFacingAfterAerial`:

1. Relative X toward opponent (if centers differ)
2. Previous valid facing (`_oaFacingPreviousValid`)
3. Movement / residual air velocity sign
4. Fallback `-1`

---

## 5. Presentation-state resolver

Priority (highest first):

`INTERRUPTED_AIRBORNE` → `GROUNDED_STAGGER` → `TOUCHDOWN` → `LANDING_RECOVERY` → `PARRIED_FALL` → `HIT_CONTINUATION` → `DIVE_ACTIVE` → `WHIFF_DESCENT` → `FLIGHT_ACTIVE` → `NONE`

Projection of existing outcome / reaction / airborne / landing flags. Synced to `offensiveAerialPresentation` for client ownership.

---

## 6. Transition ownership table

| Transition | Hitbox | Action owner | Reaction | Facing | Animation / presentation |
|------------|--------|--------------|----------|--------|--------------------------|
| FLAP → HIT → land → recover → neutral | Dead at HIT | Activation → land finalize | `HIT_CONTINUATION` → landing | Freeze → land → release → neutral | `HIT_CONTINUATION` → touchdown → landing → `NONE` |
| FLAP → PARRIED → land → recover → neutral | Dead at PARRY | Activation preserved | `PARRIED_RECOIL` → landing | Freeze at contact → land → release | `PARRIED_FALL` → landing → `NONE` |
| FLAP → WHIFF → land → recover → neutral | Dead at land | WHIFF terminal | Whiff / landing | Land lock → release | Flight / whiff → landing → `NONE` |
| S-dive HIT / PARRIED | Same as above | Dive activation | Same | Dive freeze → contact freeze | `DIVE_ACTIVE` → hit/parry path |
| Interrupt mid-air | Cleared | INTERRUPTED | Interrupted fall / hitstun | Aerial force-cleared | `INTERRUPTED_AIRBORNE` |
| Plain slide-jump | N/A | No activation | N/A | Flight lock → release | `FLIGHT_ACTIVE` → landing → `NONE` |
| Round reset | Cleared | Cleared | Cleared | Force-cleared | `NONE` |

---

## 7. Missing art

See `OFFENSIVE_AERIAL_MISSING_ART_NEEDS.md` (only genuine gaps after ownership fix).

---

## Manual playtest

1. FLAP hit — facing stable through knockback root cross; lands; re-faces opponent once.
2. FLAP parry V2 — recovering pose in air (not dive/FLAP attack); no flicker while falling past defender.
3. S-dive hit / parry — dive pose until resolution; then continuation / parried fall.
4. Whiff land — no permanent facing lock.
5. Interrupt flapper mid-air — aerial facing lock gone; hitstun owns.
6. Plain slide-jump — unchanged feel; facing unlocks after recovery.
7. Round reset mid-flight — no leftover presentation / facing lock.
