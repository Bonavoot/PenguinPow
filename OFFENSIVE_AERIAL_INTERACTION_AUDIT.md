# Offensive Aerial Interaction Audit — PUMO PUMO !

**Phase: investigation / characterization (2026-07-31).**  
**Phase 1–2 implemented:** explicit outcome contract + cleanup hardening (behavior-preserving).  
See `OFFENSIVE_AERIAL_OUTCOME_CONTRACT.md`, `OFFENSIVE_AERIAL_CLEANUP_CONTRACT.md`, `OFFENSIVE_AERIAL_PHASE_1_2_REPORT.md`.  
No gameplay retune, Rope Jump redesign, or landing-settle integration yet.

Companion docs:
- [`OFFENSIVE_AERIAL_OUTCOME_MATRIX.md`](./OFFENSIVE_AERIAL_OUTCOME_MATRIX.md)
- [`OFFENSIVE_AERIAL_STATE_LIFECYCLE.md`](./OFFENSIVE_AERIAL_STATE_LIFECYCLE.md)
- [`OFFENSIVE_AERIAL_LANDING_ARCHITECTURE.md`](./OFFENSIVE_AERIAL_LANDING_ARCHITECTURE.md)
- [`OFFENSIVE_AERIAL_TEST_MATRIX.md`](./OFFENSIVE_AERIAL_TEST_MATRIX.md)
- Prior: [`COMBAT_FIDELITY_AUDIT.md`](./COMBAT_FIDELITY_AUDIT.md), [`COMBAT_INTERACTION_ARCHITECTURE.md`](./COMBAT_INTERACTION_ARCHITECTURE.md), [`ROPE_JUMP_MOVE_IDENTITY_V2.md`](./ROPE_JUMP_MOVE_IDENTITY_V2.md)

---

## Executive summary

Offensive airborne contact in PUMO PUMO ! is **one system**, not three separate moves:

1. **Ice-slide → W slide-jump** creates the only live aerial offense vehicle (`isSlideJumping`).
2. **FLAP** is a loadout/power-up that **arms** that jump with air charges and can switch the integrator into classic FLAP flight after a W spend.
3. **S dive** commits a belly-flop: pins X, forces descending active body hitbox, burns charges, removes flight immunity.

There is **no standalone grounded FLAP liftoff** (`beginFlapStartup` always returns false). Legacy `isFlapping` / `flapPhase` fields remain for cleanup and deltas only.

Authoritative body contact is **`checkFlapBodySlam`** in `server-io/collisionSystem.js`. It is **not** an `isAttacking` strike, does **not** use tip-rail geometry, and does **not** go through `processHit`. Parry uses a dedicated **`resolveFlapRawParry`**. Landing recovery for slide-jump/FLAP is owned by **`index.js`**, not `landingResolution.js` (Rope Jump only).

**Coherence verdict:** The commitment model (flight immune → dive/descent hittable & hitting → latch → land) is intentional and mostly coherent. Gaps are cleanup ownership, midpoint contact FX, armor bypass, double per-tick polling, and the lack of an explicit post-contact outcome type before generic landing/pushbox.

---

## Baseline verification (pre-change)

| Suite | Command | Result |
|-------|---------|--------|
| Full server | `cd server-io && npm test` | **474** tests, **0** fail |
| Landing | `cd server-io && npm run test:landing` | **171** tests, **0** fail |
| Facing (includes aerial facing exclusion) | `test/facing/facing-system.test.js` | covered inside full suite |
| Dedicated flap/slide/slam unit tests | — | **none** before this phase |

No pre-existing failures. No sprite bake.

---

## Move inventory

### A. Plain slide-jump (no FLAP arm)

| Field | Current behavior |
|-------|------------------|
| Input | Ice-slide (dodge land + SHIFT) → W after `SLIDE_JUMP_MIN_MS` (buffer `SLIDE_JUMP_BUFFER_MS`) |
| Entry | Grounded ice-slide; not gassed for slide itself |
| Startup | None separate — instant takeoff |
| Takeoff | `isSlideJumping`, `slideJumpPhase:"flight"`, H from slide age/speed, V=`SLIDE_JUMP_LIFTOFF_IMPULSE` |
| Active hitbox start | First tick with `velY<=0` (or dive) **and** `y-GROUND<=100` |
| Active hitbox end | On `slideJumpHitLanded` latch, or leave height band, or leave flight |
| Hits | **One** per flight (`slideJumpHitLanded`) |
| Hit ID | No `attackId`; latch flag only |
| Attacker hurtbox | Flight immune (`isSlideJumpFlightImmune`) until dive or landing |
| Parry eligibility | Defender `isRawParrying` while slam window open |
| Armor | **Not checked** (bypasses `processHit` absorb) |
| Midair pushbox | Disabled during `flight` |
| H / V ownership | `slideJumpVelocityX/Y` (+ weak air steer) |
| Opponent affects trajectory? | No (until contact / land pushbox) |
| Side crossing | Allowed (pass-through flight) |
| Crossing vs contact | Crossing can occur before/during/after; contact is geometric overlap while descending |
| Hit / parry / whiff | See outcome matrix |
| Landing recovery | `SLIDE_JUMP_LANDING_RECOVERY_MS` (90) whiff; `BURST_STUN_MS` if hit latched |
| Animation | `flap1`/`flap2` in air; dodge pose on dive; `recovering` on landing |
| Cleanup | `clearSlideJumpState` after recovery |
| Buffer | `executeInputBuffer` blocked while `isSlideJumping` |
| CPU | `handleFlapOffense` / flight pilot when FLAP available; plain slide-jump used in movement |
| Network | `DELTA_TRACKED_PROPS` includes slide-jump / flap fields |
| Bugs / uncertainty | Landing overlap uses generic pushbox (no settle); ascent body overlap is non-damaging |

### B. FLAP-armed slide-jump / FLAP flight

| Field | Current behavior |
|-------|------------------|
| Input | Same takeoff; `armSlideJumpFlapCharges` if `playerHasFlap` (stamina tax) |
| Air flaps | W spends charge → `slideJumpFlapFlightActive`, `FLAP_IMPULSE`, H carry dropped on first spend |
| Physics | After first spend: `FLAP_*` gravity/ceiling/air-move/H-burst |
| Active hitbox | **Same** `checkFlapBodySlam` (not charge-gated) |
| Whiff land recovery | `FLAP_LANDING_RECOVERY_MS` (250) if flap flight was used |
| Else | Same as plain slide-jump |

### C. S-key aerial body slam (dive)

| Field | Current behavior |
|-------|------------------|
| Input | `keys.s` while `slideJumpPhase==="flight"` |
| Effect | `slideJumpDiveCommitted`, pin X, kill H, min down vel, burn charges |
| Immunity | Dive removes flight immunity |
| Hitbox | Always qualifies descending rule via dive flag |
| Animation | Client dodge / belly-flop pose |
| Landing | Same landing machine; dive flag kept until `clearSlideJumpState` for land-smoke |

### D. Explicitly nonexistent

- Standalone grounded FLAP liftoff
- Separate “buttSlam” / `attackId` symbols
- Normal free jump aerial attack
- Rope Jump offensive hitbox (protected non-attacking vault — **do not copy**)

### E. Power-ups producing airborne body contact

- **FLAP** power-up / BASHO `hasFlap` movement loadout — arms slide-jump only
- No other power-up adds a distinct air body hitbox in current code

---

## Source file map (actual paths)

| Concern | Path | Symbols |
|---------|------|---------|
| Tick order / flight / land | `server-io/index.js` | ice-slide → takeoff → flight integrator → land; early-pair `checkFlapBodySlam` |
| Body slam + flap parry | `server-io/collisionSystem.js` | `checkFlapBodySlam`, `resolveFlapRawParry` |
| Helpers | `server-io/gameUtils.js` | `armSlideJumpFlapCharges`, `clearSlideJumpState`, `isSlideJumpFlightImmune`, `clearAllActionStates`, air-hit fall |
| Pushbox | `server-io/gameFunctions.js` | `arePlayersColliding`, `adjustPlayerPositions` |
| Geometry helpers | `server-io/pushboxGeometry.js` | shared half-width (rope landing + general) |
| Rope landing only | `server-io/landingResolution.js` | **not** slide-jump owner |
| Constants | `server-io/constants.js` | `SLIDE_JUMP_*`, `FLAP_*`, `FLAP_BODYSLAM_KB_VELOCITY` |
| Player fields | `server-io/playerFactory.js` | slide-jump / flap fields |
| CPU | `server-io/cpuAI.js` | `pilotFlapFlight`, `handleFlapOffense/Defense` |
| Client pose | `client/src/components/getImageSrc.js` | slide-jump / flap / dive branches |
| Client interp | `GameFighter.jsx`, `movementPredictor.js` | prediction suspended on slide-jump/flap |
| Debug | `client/src/debug/CombatFidelityDebug.js` | overlay + aerial lines |
| Trace (new) | `server-io/offensiveAerialTrace.js`, `offensiveAerialFlags.js` | dev-only |
| Tests (new) | `server-io/test/aerial/**` | characterization |

---

## Geometry separation (current)

| Concept | Implementation | Shared with? |
|---------|----------------|--------------|
| Offensive hitbox | Horizontal: `HITBOX_DISTANCE_VALUE * 2 * 0.7 * maxSize`; Vertical: `y-GROUND ≤ 100`; descending or dive | Scaled pushbox width — **not** tip rail |
| Attacker hurtbox | Implicit: flight immune to strikes; dive/landing vulnerable | Flag-based, not a shape |
| Airborne body interaction | Pushbox **off** in flight → pass-through / cross-up | Same exemption as rope active |
| Landing footprint | Grounded pushbox on landing phase; **no** rope settle / side lock | Generic `adjustPlayerPositions` |

**Finding:** Hitbox, hurtbox, body pass-through, and landing footprint are conceptually distinct, but hitbox reuses a scaled pushbox constant and landing has no dedicated footprint solver.

---

## Hit / parry / landing resolution order (production tick)

```
early pair:
  pushbox (skipped if either in slide-jump flight)
  tip extension sep
  checkCollision (isAttacking strikes)
  checkFlapBodySlam × both orders
  [optional OFFENSIVE_AERIAL_DEBUG snapshot]

per-player:
  ice-slide / slide-jump integrate
  checkFlapBodySlam again (if flight && !hitLanded)
  touchdown → landing phase + recovery timer
  landing recovery expiry → clearSlideJumpState
  hit-fall / other verbs…
```

**Parry order inside slam:** `isRawParrying` → `resolveFlapRawParry` (no damage). Else damage branch.

**Important:** Body slam is polled **twice** per tick when still in flight (early pair + post-integrate). Latch makes double connect impossible after first hit.

---

## State cleanup paths

| Trigger | Path |
|---------|------|
| Landing recovery done | `index.js` → `cancelPendingSlapWork` + `clearSlideJumpState` |
| Parry | `resolveFlapRawParry` → `clearAllActionStates(flapper)` then ground + stagger |
| Hit on defender | `clearAllActionStates(opponent)` then KB / optional air-hit fall |
| Round reset / win | `roomManagement.js`, `gameFunctions.js` win cleanup |
| Disconnect | `playerCleanup.js` |
| Broad teardown | `clearAllActionStates` (also clears `_offensiveAerialTrace`) |

**Risks:** Fields cleared in multiple places; parry uses broad `clearAllActionStates` (intentional interrupt); hit latch is flight-local only; no centralized outcome cleanup contract.

---

## Animation ownership

| Outcome | Client selection (`getImageSrc`) |
|---------|----------------------------------|
| Flight | `flap1`/`flap2` (wing-beat clock) |
| Dive | dodge pose |
| Landing phase | `recovering` |
| Parry (attacker grounded + recovering) | recovery / idle path via `isRecovering` — **not** aerial landing phase |
| Defender hit | `lastHitType==="flap"` hit presentation |

**Presentation gaps:** Flap `player_hit` / parry often use **midpoint** `contactX`; no authoritative aerial outcome enum for client.

---

## Behavior to preserve

1. Descending-only (or dive) body hitbox — ascent pass-through without damage
2. One-hit latch per flight (`slideJumpHitLanded`)
3. Flight strike immunity until dive/landing
4. Parry immediately ends flight and grounds attacker with flap stagger
5. Post-hit attacker keeps flying (no scripted self-knockback) then lands with burst recovery
6. Plain slide-jump and FLAP-armed jump share the same slam detector
7. Rope Jump remains a separate non-offensive vault

## Confirmed issues / gaps

| # | Issue | Class |
|---|-------|-------|
| 1 | Body slam bypasses thick-blubber / `processHit` armor | Suspected design gap (characterized) |
| 2 | Contact FX / parry `contactX` midpoint | Visual inconsistency (known from combat audit) |
| 3 | Double per-tick `checkFlapBodySlam` | Harmless with latch; noisy for traces |
| 4 | No explicit outcome type — landing branch infers from flags | Architecture debt |
| 5 | Slide-jump landing has no settle / side policy (unlike rope V2) | Fidelity gap for Phase 3B |
| 6 | Comment in slam says “grounded target” but airborne non-immune defenders can be hit | Doc drift |

## Illegal / contradictory combinations investigated

| Combo | Current |
|-------|---------|
| Grounded + FLAP active hitbox | Impossible — hitbox requires flight phase |
| Parried + hitbox remains active | Cleared — `clearAllActionStates` ends slide-jump |
| Landing recovery + airborne Y | Touchdown snaps `y=GROUND` before landing phase |
| Attacking + slide-jump | Buffer/execute blocked; strikes gated separately |
| Hit latch survives clear | Cleared on `clearSlideJumpState` / `clearAllActionStates` |
| Invuln after parry | Flight immunity ends with clear; stagger recovery is punishable |

---

## Rope Jump reuse classification

| Component | Classification |
|-----------|----------------|
| `pushboxGeometry` half-width / min center distance | **Safe to reuse unchanged** |
| Touchdown overlap measurement helpers | **Safe after generalization** |
| Landing-settle lifecycle / monotonic overlap | **Safe after generalization** (must not decide hit/parry) |
| Recovery re-intrusion monitoring | **Safe after generalization** |
| Boundary-safe correction / anchored handling | **Safe after generalization** |
| Same-center deterministic side resolve | **Safe after generalization** |
| Debug trace / landing test harness patterns | **Safe to reuse as pattern** |
| Rope airborne protection | **Unsafe to copy** |
| Apex crossover decision | **Unsafe to copy** |
| High-vault trajectory / endpoint caps | **Unsafe to copy** |
| Non-offensive pass-through identity | **Unsafe to copy onto offense** |
| Rope move identity / presets | **Leave untouched** |

---

## Proposed architecture (not implemented)

See landing architecture doc. Summary:

1. **Outcome ownership** — authoritative enum: `hit | parried | whiff | armored | interrupted | clash/trade | landed_without_contact`
2. **Post-contact state** — explicit movement/anim/landing/recovery owners per outcome
3. **Landing handoff** — offense resolves → post-contact air → touchdown → generalized settle → recovery complete → grounded
4. **Cleanup contract** — centralized field ownership table

### Recommended implementation order (refined)

| Phase | Why this order |
|-------|----------------|
| **1 — Outcome contract** | Lowest risk; flags already encode hit/parry/whiff; makes traces honest |
| **2 — Cleanup / lifecycle hardening** | Latch, double-poll, buffer, invuln leaks — prerequisite for safe feel changes |
| **3 — FLAP/slide shared slam resolution** | One detector already; improve hit/parry/contact point together |
| **4 — Dive-specific post-contact** | Dive pins X; needs distinct land handoff |
| **5 — Generalized landing settle** | Reuse rope settle **after** outcome known; do not import vault identity |
| **6 — Animation / FX fidelity** | After server outcomes stable |
| **Slide-jump-only before FLAP?** | Rejected — they share `checkFlapBodySlam`; splitting would duplicate |

**Highest-risk first implementation target:** Phase 1–2 outcome + cleanup (prevents post-parry reactivation and makes landing handoff well-defined) **before** any knockback/recovery retune.

**Exact next prompt scope:** Implement Phase 1 outcome contract + Phase 2 cleanup hardening only; no damage/KB/recovery constant changes; no Rope Jump edits; keep characterization tests green and add outcome-enum assertions.

---

## Permitted artifacts shipped this phase

- Audit markdown (5 docs + fidelity doc touch-ups)
- `server-io/offensiveAerialTrace.js` + flags
- Dev-only index.js snapshot when `OFFENSIVE_AERIAL_DEBUG`
- `server-io/test/aerial/**` characterization suite
- Debug overlay aerial lines
- Export of body-slam geometry constants from `collisionSystem.js`

**STOP.** Do not implement the full outcome architecture or change move balance in this phase.
