# Combat Interaction Architecture — PUMO PUMO !

Current-state map of ownership and pipelines. Proposed future boundaries are labeled **PROPOSED** and are not implemented.

---

## 1. System ownership (current)

| Concern | Owner | Key files |
|---------|-------|-----------|
| Simulation clock / tick | Server | `server-io/index.js` (`startGameLoop`, `tick`), `constants.js` (`TICK_RATE=64`) |
| Input ingest / validation | Server | `server-io/socketHandlers.js` |
| Attack creation / timing | Server | `server-io/gameFunctions.js` (`executeSlapAttack`, `executeChargedAttack`, `executePalmThrust`, `executeLowKick`) |
| Hit detection / resolution | Server | `server-io/collisionSystem.js` (`checkCollision`, `processHit`, `checkFlapBodySlam`, clash/parry resolvers) |
| Strike contact geometry | Server | `server-io/strikeContact.js` |
| Ground pushbox | Server | `server-io/gameFunctions.js` (`arePlayersColliding`, `adjustPlayerPositions`) |
| Movement / ice / knockback integrate | Server | `server-io/index.js` movement block |
| Aerial verbs | Server | `server-io/index.js` (rope jump, slide jump / FLAP), `socketHandlers.js` start triggers |
| Aerial landing resolve + rope-jump vault identity | Server | `server-io/landingResolution.js`, `ropeJumpVault.js`, `landingFlags.js`, `ropeJumpStart.js`, `pushboxGeometry.js` (rope jump V2 only) |
| Grab / clinch | Server | `server-io/grabActionSystem.js`, `grabMechanics.js`, `combatHelpers.js` |
| Facing | Server | `server-io/facingSystem.js` |
| Projectiles | Server | `server-io/projectileUpdates.js` |
| Tunables | Server | `server-io/constants.js` |
| State broadcast | Server | `deltaState.js`, `fighterBroadcast.js`, `index.js` |
| Snapshot ingest | Client | `client/src/net/fighterSnapshotBus.js` |
| Interpolation / prediction | Client | `GameFighter.jsx`, `prediction/movementPredictor.js`, `lib/serverClock.js` |
| Pose selection | Client | `getImageSrc.js`, `fighterAssets.js` |
| CSS deformation / sole | Client | `fighterStyledComponents.js` |
| Hit VFX / particles / camera | Client | `GameFighter.jsx` (`handlePlayerHit`), `ParticleEngine.js`, `cameraShake.js`, `useCamera.js`, effect components |
| CPU AI | Server | `cpuAI.js` (duplicates some geometry — drift risk) |

**There is no shared geometry module between client and server.** Matching constants are duplicated by comment convention.

---

## 2. Server interaction pipeline (normal strike)

```
Input (socketHandlers)
  → validate / stamina / locks
  → execute*Attack (gameFunctions) — sets isAttacking, attackStartTime, startup flags
Tick loop (index.js @ 64Hz, paused by hitstop)
  → integrate movement / knockback / aerial arcs
  → facingSystem
  → arePlayersColliding → adjustPlayerPositions (pushbox)
  → enforceStrikeExtensionSeparation (slap/palm tip park, after pushbox)
  → checkCollision(attacker, victim) × both orders
       gates: i-frames, air height, already-hit, immunity
       reach: getConnectDistance (slap/charged/palm) OR LOW_KICK constant
       defense: AP parry / guard / dodge / armor branches inside processHit or early return
       on connect: processHit
            applyContactCorrection(parkDist)
            damage / balance / knockback / hitstun
            emit player_hit { contactX, attackerX, … }
            triggerHitstopAndEmit
  → broadcast fighter_action deltas (~32Hz)
```

### Shared vs custom

| Stage | Shared | Custom per-move |
|-------|--------|-----------------|
| Startup/active timers | Pattern shared | Per-constant in `constants.js` |
| Connect test | `strikeContact` tip rail | Low kick fixed distance; flap body width overlap |
| Pushbox | One AABB system | Many exemption lists (duplicated) |
| On-hit park | `applyContactCorrection` | Palm outset; charged plant (no attacker bounce) |
| Hitstop ladder | `triggerHitstopAndEmit` | Per-tier ms |
| Defense | AP/guard in `processHit` | Low kick bypasses parry gate; flap has `resolveFlapRawParry` |
| Effects metadata | `contactX` via `getContactSeamX` | Flap/clinch often midpoint |

---

## 3. Client presentation pipeline

```
fighter_action packet
  → fighterSnapshotBus merge (delta/full)
  → GameFighter subscriber
       discrete state → React setState (gated)
       position → previous/current refs for lerp
  → rAF interpolationLoop
       lerp / extrapolate (cap 1.25) / teleport if Δ>100
       hitstop freeze via getDisplayHitstopUntil
       optional MovementPredictor (local grounded strafe only)
       DOM write left/bottom
  → getImageSrc(~90 positional args) → <img>
  → fighterStyledComponents animation ternary + sole-pivoted squash
player_hit event
  → handlePlayerHit
       pinFighterX to authoritative plant
       contactFxX(data.contactX)
       shake / particles / SFX / impact amp / judder
```

---

## 4. Major state transitions

### Strike lifecycle
`idle → startup → active → (hit|whiff) → recovery → idle`

### Rope jump
`startup → active (pass-through arc to fixed/raw targetX) → landing (pushbox returns, 18px/tick sep) → idle`

**Phase A…A.3.2 + high-vault identity (approved, default ON):** Rope-jump airborne path is an authored high vault with one apex crossover decision and capped endpoint correction (`ropeJumpVault.js` / `ROPE_JUMP_MOVE_IDENTITY_V2.md`, preset `reference_contact_9`). Landing residual and recovery re-intrusion remain A.3.2 settle-owned. Explicit `ROPE_JUMP_LANDING_V2=0` = legacy fixed target + post-land 18px/tick. Diagnostics debug-net only. Slide jump / FLAP unchanged.

**Production tick order (landing recovery):** shared `adjustPlayerPositions` runs in the early pair block; rope-jump recovery clear runs later in the per-player loop; ice movement runs after that.

### Slide jump / FLAP
`takeoff → flight (pass-through; descending can body-slam) → landing → idle`

### Attack Parry
`Space tap → apActiveUntil window → (perfect|regular) success OR guard floor OR whiff jail`

### Clinch
`grab startup → connect → clinch loop (push/plant/jolt/throw/pull) → separation / kill / break`

### Hit reaction
`processHit → isHit + KB → hitstun timers → clear → locomotion`

---

## 5. Collision ownership detail

Three positional systems currently coexist:

1. **Pushbox** — `HITBOX_DISTANCE_VALUE * sizeMultiplier` half-widths; AABB; `adjustPlayerPositions` splits overlap.
2. **Strike tip rail** — art tip + victim half − skin embed; live extension sep; on-hit park.
3. **Clinch attach** — `CLINCH_ATTACHED_DISTANCE` / `maintainClinchPositions`; direct `.x` sets.

Aerial verbs disable (1) and (2) during flight/active, then re-enable on landing without a landing probe.

---

## 6. Network ownership

| Data | Cadence | Notes |
|------|---------|-------|
| Fighter state deltas | ~32Hz (`BROADCAST_EVERY_N_TICKS=2`) | Positions continuous; discrete flags event-like |
| `player_hit` / parry / guard events | Immediate on resolve | Carry `contactX`, banners, attacker plant |
| Hitstop | Event + sim clock pause | Client mirrors end time via `serverClock` |

---

## 7. PROPOSED future responsibility boundaries

Not implemented. Intended end-state for later phases:

| Module | Responsibility |
|--------|----------------|
| **PoseGeometry** (data) | Per-pose root, sole, body half, tip, contact anchors (shared JSON consumed by server + client tools) |
| **ContactSolver** (server) | Single entry: given attacker pose + victim pose + move → connect test, park, contact point, normal |
| **SeparationSolver** (server) | Pushbox + landing probes + ring clamps; one exemption registry |
| **CombatEvent** (protocol) | Standardized contact payload for all interactions |
| **PresentationDirector** (client) | Consumes CombatEvent; places FX/camera/deform; never invents contact geometry |
| **AnimState** (client) | Structured pose request object replacing positional `getImageSrc` soup |
| **DebugOverlay** (client/dev) | Pushbox / tip / contact / auth-vs-render (flagged) |

Until those exist, new moves should prefer extending `strikeContact.js` + `processHit` emits rather than inventing a fourth distance constant.

---

## 8. Interaction traces (condensed)

### Grab initiation
`socketHandlers` grab input → startup timers (`combatHelpers`) → range/front check → clinch enter (`grabActionSystem`) → attach distance lock → client grab poses + arm overlay.

### Parry (AP)
Strike enters `processHit` → defender `isRawParrying` / `apActiveUntil` → guard vs parry branch → park/shove/hitstop → `raw_parry_success` with `contactX` (tip seam for strikes) → client `RawParryEffect` + success frames.

### Charged attack
Charge hold → release execute → lunge in `index.js` with pushbox yield → tip connect → plant (no attacker KB bounce) → park → charged hitstop/shake.

### Palm thrust
Rooted execute (`isPalmThrust`, `attackType:"charged"`) → tip sep through startup → connect + park outset → burst hitstop.

### Low kick
Fixed `LOW_KICK_HITBOX_DISTANCE_VALUE` → beats parry/grab priority quirks → no tip park → slap-tier hitstop.

### FLAP / butt slam
Flight pass-through → descending overlap vs `FLAP_BODYSLAM_WIDTH_SCALE` → optional AP raw parry → burst KB → landing recovery; `contactX` often midpoint.

### Rope jump
Fixed `ropeJumpTargetX` toward center fraction → active pass-through → snap to target on land → pushbox re-enabled with 18px/tick correction.  
V2 (`ROPE_JUMP_LANDING_V2`): same timings/arc; commit resolved endpoint mid-arc; land already clear when possible.

### Side switch
Facing hard-rule (`facingSystem`) + aerial cross + rope-jump landing direction tie-break when centers within half-body.

### Simultaneous attacks
Slap vs slap: earlier `attackStartTime` wins; tie → `resolveSlapTrade`. Charged clash → `resolveChargeClash`.

### Attack vs dodge
`isInDodgeStrikeIFrames` / dodge active exemptions → whiff or delayed punish on recovery.

### Attack vs airborne
`AIR_STRIKE_HURT_HEIGHT` gate; tip-sep / pushbox exemptions for flight; flap slam has its own window.

---

*Phase 1 documentation — architecture not rewritten.*
