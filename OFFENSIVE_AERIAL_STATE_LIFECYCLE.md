# Offensive Aerial State Lifecycle — PUMO PUMO !

Current authoritative lifecycle for slide-jump / FLAP / S-dive body slam (2026-07-31).  
Phase 1–2 adds `player.offensiveAerial` outcome + cleanup stages alongside these flags  
(`OFFENSIVE_AERIAL_OUTCOME_CONTRACT.md`, `OFFENSIVE_AERIAL_CLEANUP_CONTRACT.md`).  
Phase 4 `offensiveAerialReaction` is **default ON** (`heavy_short`); disable with `OFFENSIVE_AERIAL_REACTION_V2=0`  
(`OFFENSIVE_AERIAL_POST_CONTACT_REACTIONS.md`).

Repository model (preferred over inventing a parallel SM):

```
ice_slide → takeoff → flight → (optional flap_flight / dive)
         → contact_resolved? (hit latch | parry | none)
         → HIT_CONTINUATION | PARRIED_RECOIL (V2) | parried_grounded (legacy) | whiff
         → landing handoff → recovery → clear → grounded_control
```

---

## 1. Phase ownership

| Phase | Player flags | Owns H vel | Owns V vel | Owns anim (client) | Owns hitbox | Owns hurtbox | Owns input lock | Owns landing | Clears move |
|-------|--------------|------------|------------|--------------------|-------------|--------------|-----------------|--------------|-------------|
| Entry (ice slide) | `isIceSliding` | `movementVelocity` | ground | sliding | off | grounded | slide rules | n/a | `clearIceSlideState` on takeoff |
| Takeoff | set `isSlideJumping`, `flight` | `slideJumpVelocityX` | `slideJumpVelocityY` | flap frames | off (ascent) | flight immune | `currentAction=slideJump` | n/a | — |
| Airborne inactive (ascent / high) | flight, `velY>0`, no dive | slide or flap H | gravity integrator | flap1/2 | **off** | immune | buffer blocked | n/a | — |
| Airborne active | descending or dive, height≤100, !latch | same | same | flap or dodge | **on** (`checkFlapBodySlam`) | dive: vulnerable; else immune until descend only affects offense | same | n/a | latch or parry |
| Contact resolved — hit | `slideJumpHitLanded` | continues | continues | flap/dive | **off** | still flight immune if !dive | same | pending | — |
| Contact resolved — parry (legacy / flag OFF) | cleared; `isRecovering` | AP shove | grounded | recovery/AP | off | grounded vulnerable | `AP_STAGGER_FLAP_MS` | skipped | `clearAllActionStates` |
| Contact resolved — parry (V2) | `PARRIED_RECOIL`; still `isSlideJumping` | recoil Hx | recoil+gravity | recovering | off | **vulnerable** | lock until `controlRestoreAt` | after recoil touchdown | reaction integrator |
| Post-hit travel | latch + flight | continues | continues | flap/dive | off | immune if !dive | same | until Y≤ground | — |
| Whiff descent | !latch + descending | same | same | flap/dive | on while in band | same | same | until ground | — |
| Landing approach / touchdown | `y` snap ground; phase→`landing` | zeroed | zeroed | recovering | off | vulnerable | `actionLockUntil` = recovery | **this phase** | timer |
| Landing recovery | `landing` | pushbox may move X | ground | recovering | off | vulnerable | lock | pushbox on | on expiry |
| Fully grounded | cleared | locomotion | ground | idle/ready | off | normal | unlocked | done | `clearSlideJumpState` |
| Control restored | `currentAction=null` | ice strafe | ground | facing refresh vs opponent | — | — | — | — | — |

---

## 2. Lifecycle diagrams

### Hit

```
flight(active) → latch hit → post_hit_travel → touchdown → landing(BURST_STUN_MS) → clear → grounded
defender: clearAllActionStates → isHit + burst KB → stun timeout → (optional hit-fall if was air)
```

### Parry

```
flight(active) → resolveFlapRawParry → clearAllActionStates(attacker) → y=GROUND
→ isRecovering + stagger lock + AP shove
(no slide-jump landing phase)
defender: AP success / guard hold / chain++
```

### Whiff

```
flight → touchdown → landing(90 or 250ms) → clear → grounded
```

### Dive

```
flight → S → diveCommitted (pin X, burn charges, lose immunity)
→ active while in band → hit|parry|whiff as above
```

---

## 3. Field ownership & cleanup inventory

### Always relevant aerial fields

| Field | Set | Cleared | Survive touchdown? | Survive hitstop? | Notes |
|-------|-----|---------|--------------------|------------------|-------|
| `isSlideJumping` | takeoff | clearSlideJump / clearAll / parry | yes through landing | yes | Master flag |
| `slideJumpPhase` | flight/landing | clear | yes | yes | |
| `slideJumpVelocityX/Y` | takeoff/integrate | clear / touchdown zero | no (zeroed) | frozen by room hitstop | |
| `slideJumpDiveCommitted` | S | clear on exit | yes through landing (VFX) | yes | |
| `slideJumpDiveLockX` | dive | clear | yes until clear | yes | |
| `slideJumpHitLanded` | slam connect | clear | yes through landing | yes | Latch |
| `slideJumpHitRecoverDuration` | slam connect | clear | yes | yes | Usually `BURST_STUN_MS` |
| `slideJumpLandingTime` | touchdown | clear | landing only | yes | |
| `slideJumpHasFlap` | arm on takeoff | clear | yes | yes | |
| `slideJumpFlapFlightActive` | first W spend | clear | yes (affects whiff ms) | yes | |
| `flapCharges` | arm / spend / dive0 | clear | — | yes | |
| `flapVelocityX` | directional flap | clear / friction | zeroed on land | yes | |
| `flapWingBeatTime` / `flapBeatHDir` | flap spend | clear | — | yes | Client wing art |
| Legacy `isFlapping` / `flapPhase` / `flapVelocityY`… | legacy only | clearAll / resets | should stay false | — | Do not reintroduce |
| `currentAction` / `actionLockUntil` | takeoff / land | clear | land lock | yes | |
| `isRecovering` (parry path) | resolveFlapRawParry | stagger timeout | n/a (already ground) | yes | Different from land phase |
| `isAlreadyHit` / `isHit` / KB fields | on defender hit | hitStateReset / clearAll | — | yes | |
| `inputBuffer` / `bufferedAction` | sockets | clearAll; blocked while aerial | — | — | |
| `lastHitType` | `"flap"` on victim | later hits / reset | — | — | |
| `_offensiveAerialTrace` | debug/harness | clearAll / flush | debug only | — | Not networked |

### Cleanup duplication / risks

| Risk | Evidence |
|------|----------|
| Broad clear on parry | `clearAllActionStates` — correct interrupt, easy to over-clear future fields |
| Hit latch only local | Must not forget clear on round reset (covered) |
| Legacy flap fields | Still zeroed in many places — drift risk if someone revives `isFlapping` |
| Land recovery vs parry stagger | Different owners (`slideJumpPhase` vs `isRecovering`) — client must not assume aerial land after parry |
| Double slam poll | Early pair + post-integrate — latch makes safe |

---

## 4. Implicit illegal combinations (audit results)

| Combination | Possible today? | Notes |
|-------------|-----------------|-------|
| Grounded + slam hitbox active | No | Requires flight phase |
| Parried + slide-jump flight | No | Cleared immediately |
| Landing recovery + Y airborne | No | Y snapped at touchdown |
| `slideJumpHitLanded` + active hitbox | No | Window requires !latch |
| Flight immune + dive | No | Dive clears immunity helper |
| Buffered slap executes mid-flight | No | `executeInputBuffer` gate |
| Attack ID reuse | N/A | No attackId; latch per flight |
| One move clear wiping another | Parry clearAll can wipe unrelated temps | Known pattern elsewhere |

---

## 5. Network / client sync notes

- Slide-jump / flap discrete fields are on `DELTA_TRACKED_PROPS`.
- Prediction suspended while `isSlideJumping` / `isFlapping` / ice slide / hit-fall.
- Client interpolates server positions; aerial arcs are not locally predicted.
- Hit presentation uses `player_hit` (`attackType:"flap"`); parry uses `raw_parry_success`.
- No production network dependency on `_offensiveAerialTrace`.

---

## 6. Proposed future lifecycle (not implemented)

Introduce an explicit `offensiveAerialOutcome` (or equivalent) at contact resolve time, then select post-contact phase:

`post_hit_travel | parried_recoil | interrupted | whiff_descent → landing_<outcome> → grounded`

Each outcome owns cleanup via a single contract (see landing architecture doc).
