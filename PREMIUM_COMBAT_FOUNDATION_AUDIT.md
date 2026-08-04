# PREMIUM COMBAT FOUNDATION — PHASE 0 AUDIT

**Status:** Source-of-truth combat audit (documentation only)  
**Workspace inspected:** 2026-08-03  
**Branch:** `main` (clean except untracked master prompt)  
**Authority:** Current source + tests supersede historical phase docs when they disagree.

This audit reconstructs the live combat contract so later Premium Combat Foundation phases do not break approved systems or implement obsolete recommendations. No production gameplay was changed for this document.

---

## 1. Current architecture map (exact owners)

| Domain | Authoritative owner | Client consumer | Notes |
|---|---|---|---|
| Simulation clock | `room.simTime` via `advanceRoomSimTime` (`gameUtils.js`) | Display sync via `serverClock` | Frozen during hitstop |
| Hitstop freeze | `room.hitstopUntil` + `triggerHitstop` (`gameUtils.js`); wall-clock expiry via `gameNow()` | `"hitstop"` socket → `serverClock` display freeze | Symmetric: both fighters skip sim |
| Input enqueue | Socket path → `player.inputQueue` | `Game.jsx` emits `fighter_action` | Queued, not drained, during hitstop |
| Input dispatch | `processInputPacket` / `socketHandlers.js` at tick start | N/A | Deterministic drain order = player array order |
| Movement integration | Per-player loop in `index.js` | Local ground strafe/coast only (`prediction/movementPredictor.js`) | Runs **after** pushbox/collision in the same tick |
| Pushbox / separation | `arePlayersColliding` + `adjustPlayerPositions` (`gameFunctions.js`); half-width `pushboxGeometry.js` | Overlay half-widths in `CombatFidelityDebug` | Disabled during dodge/sidestep/aerial actives |
| Strike tip rail | `strikeContact.js` | Contact seams / park via presentation events | Slap, palm, charged |
| Charged earliest contact | `chargedHeadbuttContact.js` (flag `COMBAT_CONTACT_FIDELITY_V2`, default ON) | Presentation follows server result | Must not spread pushbox-yield to palm |
| Contact cleanup / consume | `combatContactResolution.js` + collision path | Observes outcomes | Losing attack consumed on resolution tick |
| Grounded hit resolution | `collisionSystem.js` `checkCollision` | Hit/parry/guard sockets + presentation | Server authors hits |
| Grab / clinch | `grabActionSystem.js`, `grabMechanics.js` | Clinch poses / Open / Plant tells | Own distance system |
| Offensive aerial | `offensiveAerialContact.js`, `offensiveAerialOutcome.js`, landing helpers | `offensiveAerialPresentation` wire field | Outcome before land settle |
| Rope jump landing | `landingResolution.js` + `ropeJumpVault.js` (V2 default ON) | Landing diag optional / debug-net | Approved high-vault identity |
| Action lifecycle | `actionLifecycleOwnership.js` (V2 default ON) | Observes flags | Instance-safe cleanup |
| Action facing | `actionFacingOwnership.js` (V2) | Facing lock during committed travel | Facing ≠ travel direction |
| Pose registration | `poseRegistration.js` (server + client twin) | Render offsets only | **Not** combat hurtboxes |
| State broadcast | `deltaState.js` + `fighterBroadcast.js` @ 32 Hz (or 64 local) | `fighterSnapshotBus` → `GameFighter` | Delta + keyframes |
| Combat presentation | `combatPresentationEvent.js` | `client/src/combatPresentation/` dedupe/placement | Event-ID first-wins |
| Debug overlay | N/A (server fields optional) | `CombatFidelityDebug.js` | Default OFF |
| CPU decisions | `cpuAI.js` | N/A | Sets keys; human gates partially reused |

---

## 2. Simulation and broadcast rates

| Constant | Value | Location |
|---|---|---|
| `TICK_RATE` | **64 Hz** | `server-io/constants.js` |
| `BROADCAST_EVERY_N_TICKS` | **2 → 32 Hz** | `constants.js` |
| `LOCAL_TIGHT_BROADCAST=1` | every tick → **64 Hz** | `index.js` |
| `KEYFRAME_EVERY_N_BROADCASTS` | 64 (~2 s at 32 Hz) | `constants.js` |

### Confirmed tick order (`server-io/index.js` `tick`)

1. `advanceRoomSimTime` + `timeoutManager.processRoom`
2. **Input queue drain** (skipped during hitstop; packets held ordered)
3. Early-out if `< 2` players
4. If not hitstop (pair block):
   - orphan grab/throw cleanup
   - CPU AI + CPU input process
   - ready / grab attach / force-out
   - **Pushbox** (`arePlayersColliding` → `adjustPlayerPositions`)
   - **Strike extension separation** (both directions)
   - **Collision / hit resolution** (`checkCollision` both ways + flap body slam)
   - ready/hakkiyoi, recovery-slide, projectiles
5. Per-player loop (skipped per player during hitstop): dodge / sidestep / grab startup / **movement** / attacks / etc.
6. `enforcePairFacing` (if not hitstop)
7. Broadcast / delta construction (`buildFighterActionPacket`)

**Implication:** pushbox + collision resolve before that tick’s ground locomotion. Sidestep/dodge motion in the player loop can therefore leave overlap that pushbox only sees on the **next** tick (except where the move owns its own settle).

---

## 3. Full move interaction matrix (summary)

Legend for volume columns: **P** pushbox, **HB** hurt volume, **HIT** offensive hit volume, **GRAB** grab acquisition.  
“Authored limb HB” = dedicated extended-limb hurtbox (currently **none** for any move).

| Move | Startup | Active | Recovery / end | Contact model | P | Body HB | Limb HB | HIT | GRAB |
|---|---|---|---|---|---|---|---|---|---|
| Neutral / walk / crouch | — | — | — | pushbox only | Y | body=push half | N | N | N |
| Slap | 55 ms | 130 ms | 75 ms (+45 whiff extra) | tip rail | Y* | body half | **N** | tip | N |
| Palm thrust | 90 | 90 | hold 260 + end 60; hit recover 200 | tip rail | Y* | body half | **N** | tip | N |
| Charged headbutt | 150 | 200–450 | hit recover 280; clash 450 | tip + earliest surface | yield on lunge | body half | **N** | tip | N |
| Low kick | 95 / 85 / 300 (whiff) | | hit recover 180 | fixed reach 142 | Y | body | **N** | scalar | N |
| Grab startup | 145 | 110 connect | whiff recover 450 | center dist `GRAB_RANGE` 146 | special | body | N | N | Y |
| Dodge | 50 / 210 / 0 + 100 CD | | | travel target; strike i-frames 40 ms | off while dodge | — | N | N | grabs beat |
| Sidestep | 50 / **400** / 150 | | | fixed arc; settle if pass | off while `isSidestepping` | — | N | N | track rules |
| Space AP / Matador | AP active 180; whiff 300 | | success plant 200 | parry windows | Y | body | N | N | Matador vs grab |
| Rope jump | 166 / 450 / land 183 | | | vault V2 landing | off active | — | N | N | N |
| Slide jump / FLAP / dive | slide flash + flight | | land recover / slam i-frames | aerial outcome owner | off flight | aerial rules | N | body slam | N |
| Clinch techniques | throw anim 220; Open 320/400 | | | clinch system | clinch attach | clinch | N | N | N |
| Thrown / break / force-out | tween locks | | | dedicated states | off / special | — | N | N | N |

\* Tip-extension separation expands spacing during slap/palm ACTIVE; charged lunge uses pushbox yield (must not apply to palm).

`LOW_KICK_ENABLED = false` — timings exist but move is disabled in current constants.

---

## 4. Startup / active / recovery owners

| Move | Timing constants | Lifecycle owner | Clears via |
|---|---|---|---|
| Slap | `SLAP_*_MS` | attack flags + timeouts / lifecycle instance | hit consume, cycle end, interrupt |
| Palm | `PALM_THRUST_*` | palm flags + recoveryDuration | palm timeouts / hit path |
| Charged | `CHARGED_*`, `CHARGED_HIT_RECOVERY_MS` | charge + attackType charged | plant / clash / interrupt |
| Grab | `GRAB_STARTUP_MS`, `GRAB_ACTIVE_MS`, `GRAB_WHIFF_RECOVERY_MS` | grab startup / whiff flags | connect → clinch or whiff clear |
| Dodge | `DODGE_*` | `beginPlayerDodge` + tick dodge phases | land → cooldown |
| Sidestep | `SIDESTEP_*` | tick sidestep block in `index.js` | `sidestepEndTime` |
| AP / Matador | `AP_*`, `MATADOR_*` | parry state machine in handlers + collision | success/whiff timers |
| Rope jump | `ROPE_JUMP_*` | `ropeJumpPhase` + landing resolver | landing recovery end |
| Offensive aerial | slide/flap/dive constants | `offensiveAerialOutcome` + reaction | outcome + land cleanup |
| Clinch Open | `CLINCH_THROW_FAIL_STAGGER_MS` 320, `CLINCH_PERFECT_BRACE_OPEN_MS` 400 | `applyClinchOpen` timeout `clinchThrowFailStagger` | timeout clear |
| Hitstun / recovering | various | `isHit` / `isRecovering` + `recoveryDuration` | sim elapsed |

Facing during committed travel: `actionFacingOwnership` (dodge/sidestep/strikes as configured). Travel direction fields: `dodgeDirection`, `sidestepDirection` (server-local).

---

## 5. Pushbox / hurtbox / hitbox / grabbox status

### What exists today

- **Pushbox:** 1D grounded interval; half-width = `HITBOX_DISTANCE_VALUE` (65) × `sizeMultiplier` (`pushboxGeometry.js`).
- **Body “hurt” depth for strikes:** same constant via `getVictimBodyHalf` in `strikeContact.js` — **coupled to pushbox**.
- **Strike hit surfaces:** art-tip sprite px → world tip → `getConnectDistance` / park / seam (slap, palm, charged).
- **Grabbox:** scalar center-distance `GRAB_RANGE = 146` (plus sidestep track range 400, or 220 if `MASTERY_P5_ASSISTS`).
- **Low kick (disabled):** fixed `LOW_KICK_HITBOX_DISTANCE_VALUE = 142`, not tip rail.
- **Aerial body slam:** separate aerial contact path.
- **Clinch attach:** clinch-owned distances, not generic pushbox.

### What does **not** exist

- No universal per-pose / per-action authored hurt regions (torso/limb/head).
- No whiff-recovery limb hurtboxes for extended slap/palm arms.
- `poseRegistration.js` is presentation sole/offset metadata only — explicitly not combat authority.
- No Skullgirls-style multi-box combat vocabulary in live resolution.

**Preserve:** tip-rail + park + seam + charged earliest-contact. Do not replace with a generic box engine.

---

## 6. Invulnerability / intangibility / armor / priority matrix

| State | Strike | Grab | Pushbox | Notes |
|---|---|---|---|---|
| Neutral | vulnerable | vulnerable | on | |
| Slap/palm/charged startup | vulnerable | vulnerable | on | counter-hit sensitive |
| Strike active | vulnerable body; HIT on | vulnerable | tip-sep / charged yield | |
| Strike recovery | vulnerable | vulnerable | on | **no limb HB** despite visual arm |
| Dodge startup | strike i-frames `DODGE_IFRAME_MS` 40 | **grabs beat dodge** | off | |
| Dodge active | hittable (no full i-frames) | grabs beat | off | |
| Sidestep startup | vulnerable | vulnerable | off (`isSidestepping`) | |
| Sidestep active | strike i-frames | special track / i-frame rules | off | |
| Sidestep recovery (passed + overlap < 80) | strike i-frames while clipping | mirrors strike rule | off until end | failed pass: **no** recovery i-frames |
| Sidestep recovery (separated / failed) | vulnerable (punish) | vulnerable if failed overlap | off until end, then pushbox | |
| Hitstun / Open / ropes | locked | locked | varies | |
| Grab startup | historically armor removed for slap; charged can shatter | contested | special | Thick Blubber / absorb remains grab-oriented |
| Rope jump active | protected (design) | — | off | landing recovery punishable |
| Slide-jump land slam i-frames | brief slam-only | — | — | `SLIDE_JUMP_LAND_SLAM_IFRAME_MS` 78 |

Concepts are separate in design comments; code still uses overlapping booleans rather than a single tagged volume layer.

---

## 7. Action and cancel matrix

Rows = state. Columns = capability. Values: **Y** yes, **N** no, **B** buffer-only, **\*** special.

| State | Move | Face | Attack | Grab | Defend | Dodge | Sidestep | Buffer | Pushbox | Hurt | Hitbox | Invuln | Intangible | Owner clears |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Neutral | Y | Y | Y | Y | Y | Y | Y | — | Y | body | N | N | N | — |
| Startup (strike) | N | lock* | N | N | N | N | N | B | Y | body | N | N | N | lifecycle / interrupt |
| Active strike | N | lock* | N | N | N* | N | N | B | tip-sep | body | Y tip | N | N | hit consume / active end |
| Recovery (isRecovering) | slide* | * | N | N | N | **N†** | **N†** | B | Y | body | N | N | N | recoveryDuration |
| Hitstun | N | N | N | N | N | N | N | B | * | body | N | N | N | hitstun lifecycle |
| Clinch Open / stagger | clinch* | * | N tech | N tech | Plant* | N | N | * | clinch | * | N | N | N | `applyClinchOpen` timer |
| Dodge startup | N | freeze* | N | N | N | N | N | B | off | — | N | strike 40ms | pass | dodge timers |
| Dodge active | travel | freeze* | N | N | N | N | N | B | off | — | N | N | pass | dodge end |
| Dodge recovery | N | * | N | N | N | N | N | B | * | — | N | N | N | recovery + CD |
| Sidestep startup | N | * | N | N | N | N | N | B | off | — | N | N | pass | phase |
| Sidestep active | arc | * | N | N | N | N | N | B | off | — | N | strikes | pass | phase |
| Sidestep recovery | settle | reface | N | N | N | N | N | B | off | — | N | conditional | pass | end time |
| Grab startup / whiff | N | * | N | N | N | N | N | B | * | body | N | N | N | whiff / connect |
| Clinch neutral/push/Plant/jolt/tech | clinch | clinch | tech rules | tech | Plant/jolt | N | N | clinch | clinch | clinch | N | N | N | clinch system |
| Rope jump | arc | * | buffer land | N | N | N | N | attack buffer | off active | — | N | active prot. | pass active | landing end |
| Slide jump / FLAP / dive | flight | aerial facing | dive/slam | N | N | N | N | * | off flight | aerial | slam | land i-frame | pass flight | outcome+land |
| At ropes | N | ropes | N | N | N | N | N | N | * | body | N | N | N | ropes timer |
| Thrown / break tweens | tween | lock | N | N | N | N | N | B | off | — | N | * | * | tween end |

† **Dead intent:** socket comments claim dodge/sidestep may cancel `isRecovering` after 100 ms, but outer gates `canPlayerDash` / `canPlayerUseAction` reject recovering — see §16 Q1.

Primary gates: `isPlayerInActiveState`, `isPlayerInBasicActiveState`, `canPlayerUseAction`, `canPlayerDash`, `canPlayerSidestep`, `canPlayerSlap`, `shouldBlockAction` (socket), plus move-specific and CPU copies.

---

## 8. Server / client prediction responsibility matrix

| Concern | Server | Client local | Client remote |
|---|---|---|---|
| Ground strafe / brake / ice coast | Authority | Predicted + reconciled | Interpolated |
| Hits / damage / KB / ring-out | Authority | Never invent | Observe |
| Grab / clinch / Plant / Open | Authority | Never invent | Observe |
| Sidestep / dodge motion | Authority | Prediction **suspended** | Interpolated flags |
| Action pose (slap/dodge/grab…) | Authority | Short pose prediction (≤150 ms), cleared by victim/server flags | Flags only |
| Hitstop | Authority (`simTime` freeze) | Display pin via `serverClock` | Same |
| Presentation VFX | Emits event IDs / contact | Dedupe + place; some local edge VFX (sidestep trail) | Same pipeline |
| Confirmed evade / limb hit | N/A today | Must not invent | — |

No rollback / GGPO. “Rollback” in repo = feature-flag legacy paths.

---

## 9. Hitstop and input-buffer pipeline

1. Contact path calls `triggerHitstop` → `room.hitstopUntil = max(existing, gameNow()+ms)`.
2. While active: `advanceRoomSimTime` does **not** advance; pair gameplay + per-player sim skipped; **broadcast continues**.
3. Input packets **enqueue but do not drain** during hitstop; first post-freeze tick drains in order.
4. Representative durations: slap 70, burst/palm 160, charged 160–280, grab 55, throw 100, AP 110 / perfect 210, guard 40, cinematic kill 550.
5. Client: `"hitstop"` → `displayHitstopUntilMs`; RAF pins fighter X; movement predictor `notePause`.
6. Buffer window constant `INPUT_BUFFER_WINDOW_MS = 200` for lockout release; additional per-move buffers (shift during attack, rope-jump attack release, etc.).

---

## 10. Sidestep state and positional trace

### Timings (server)

| Phase | ms |
|---|---|
| Startup | 50 |
| Active | **400** |
| Recovery | 150 |
| Total | 600 |
| Travel | 160 (edge panic 110) |
| Arc depth Y | 50 |
| Recovery overlap i-frame threshold | 80 |
| Landing separation target | 140 |

### Lifecycle (server `index.js`)

1. **Startup:** no X move; vulnerable.
2. End of startup: lock `sidestepTargetX` from start X + direction × travel, clamped to `[340, 935]`.
3. **Active:** ease-in-out X to locked target; Y = sin dip; pushbox off; strike i-frames.
4. **Active→recovery:** snap X to target; `passedOpponent = (x - opp.x) * sidestepDirection > 0` using **opponent position at this instant**.
5. If passed **and** distance < full pushbox width **and** opp not airborne → `sidestepRecoveryTargetX = opp.x + dir * 140` (clamped). Else hold (`target = x`) — failed/short attempts stay exposed.
6. **Recovery:** quartic ease-out toward recovery target; conditional i-frames only if passed + still < 80 px.
7. **End:** clear flags; reface; residual overlap → next-tick generic pushbox.

### Client presentation gaps

- Trail assumes `ACTIVE_MS = 320` (`GameFighter.jsx`) — **80 ms short** vs server 400.
- Comment incorrectly claims server active is 320.
- Start/trail `direction` = `penguin.facing`, not travel.
- `sidestepDirection` is **not** in `DELTA_TRACKED_PROPS` / `ALWAYS_SEND_PROPS`.
- Zero client references to `sidestepDirection`.
- Sidestep art reuses perfect-parried sprite; no pose-registry entry.

### Tests

Only facing freeze coverage in `server-io/test/facing/facing-system.test.js`. No physics / settle / edge / order suite.

---

## 11. Clinch Plant-resist trace

| Step | Owner | Evidence |
|---|---|---|
| Technique commit | clinch chord / `grabActionSystem` | throw anim `CLINCH_THROW_ANIMATION_MS` 220 |
| Plant / Perfect Brace check | `getClinchThrowDefense` / `isPerfectBraceTiming` | final `CLINCH_PERFECT_BRACE_WINDOW_MS` 100 |
| Resist → Open | `applyClinchOpen(actor, CLINCH_THROW_FAIL_STAGGER_MS=320)` | sets `isClinchOpen` + `clinchThrowFailStagger` |
| Perfect Brace → Open | `applyClinchOpen(actor, CLINCH_PERFECT_BRACE_OPEN_MS=400)` | attacker Open |
| Input reject while Open | `socketHandlers.js` → `INPUT_REJECT.THROW_RECOVERY_ACTIVE` | blocks technique retry |
| Clear | sim-clock timeout name `clinchThrowFailStagger` | |

**Verdict:** thrower is **not** immediately actionable for clinch offense. User “instant retry” reports are classified primarily as **presentation / pose readability** risk unless a future input trace proves a bypass. Do not stack a hidden cooldown before proving actionability.

Clinch regression harness: `server-io/test/clinch/` (including Perfect Brace boundaries, throw-pull defense matrix).

---

## 12. CPU difficulty and test-dummy trace

| Item | Current truth |
|---|---|
| Authoritative arena right | `gameUtils.js` `MAP_RIGHT_BOUNDARY = 935` |
| CPU local constant | `cpuAI.js` `MAP_RIGHT_BOUNDARY = 940` (comment wrongly says must match 940) |
| CPU also imports | `GAME_MAP_RIGHT` from gameUtils (935) — used on some rope-edge paths |
| Drift | **Confirmed partial:** many edge-distance helpers use **940**; some rope checks use **935** |
| `EASY_SLAP_ONLY_DUMMY` | `true` |
| Behavior | Easy VS CPU → `runEasySlapOnlyDummy` (stand, mash Mouse1) |
| Consumer access | Ordinary lobby `cpuDifficulty === "EASY"` |
| Grab-matador dummy | flag false; slap flag wins if both true |

Easy is an intentional lab dummy **masquerading as consumer Easy**. Preserve the tool; separate the product later (Phase 9).

---

## 13. Determinism and iteration-order risks

| Risk | Status |
|---|---|
| Input drain order = `room.players` index | Present; same-tick competing inputs can be order-sensitive |
| `checkCollision(p1,p2)` then `(p2,p1)` | Symmetric trade window (`SLAP_TRADE_WINDOW_MS` 8) mitigates same-tick slap trades; other interactions still call order-dependent paths |
| `Math.random()` in presentation IDs / some AI | Presentation IDs non-deterministic; AI decisions not fully seeded for replay |
| Hitstop wall-clock vs simTime | Freeze duration wall-clock; sim frozen — generally OK, but not a pure sim-time freeze duration |
| Full neutral input replay harness | **Absent** |
| Clinch / aerial / contact fixtures | Strong partial coverage; not a universal combat replay |

Player-array reversal is **not** proven safe across sidestep settle, simultaneous non-slap contests, or CPU edge logic.

---

## 14. Existing test coverage and missing tests

### Strong / present

- Clinch harness + Perfect Brace / techniques / jolt / stalemate
- Rope-jump landing V2 + intrusion / trajectory / identity
- Offensive aerial outcome, cleanup, facing, contact, body slam
- Strike contact fidelity + charged headbutt contact
- Action lifecycle ownership
- Action facing ownership
- Input command reliability
- Pose geometry (presentation)
- Presentation event dedupe (several)
- Fighter broadcast
- Client: movement prediction offline script; liveLocalFighter; combat audio tests

### Missing (high value for this program)

- Sidestep physics matrix (pass/fail/edge/sizes/order/hitstop)
- Recovery-cancel characterization (currently unreachable)
- CPU boundary 935 vs 940
- Authored hurt / limb punish (none yet)
- Full deterministic neutral interaction replay
- Client sidestep VFX parity (320 vs 400, facing vs travel)
- Simultaneous non-slap order independence suite

---

## 15. Performance risks of a geometry layer

Current combat math is cheap: 1D intervals + tip scalars.

A shadow authored-volume layer (Phase 3) should:

- Use frozen templates + scratch AABBs (no per-tick parse/DOM/pixels)
- Query on demand or reuse 2–6 regions × 2 fighters
- Avoid allocating large arrays every tick

**Rough budget if naive:** ~10–40 small objects/tick → measurable GC at 64 Hz.  
**If scratch-reused:** near-zero allocation; AABB tests are trivial vs existing clinch/CPU work.

Debug overlay already caps rebuilds at 100 ms — extend it; do not add a second debug app or production geometry wire traffic.

---

## 16. Required analysis questions — answers

### Q1. Is the 100 ms dodge-from-recovery cancellation unreachable?

**YES — confirmed defect (dead / contradictory path).**

- Dodge branch clears recovering after `recoveryAge > 100` then calls `beginPlayerDodge` (`socketHandlers.js`).
- Enclosing condition requires `canPlayerDash(player)`.
- `canPlayerDash` requires `!player.isRecovering`.
- Therefore the inner cancel never runs while recovering.
- Sidestep branch has the same pattern behind `canPlayerSidestep` → `canPlayerUseAction` → `!isRecovering`.
- `shouldBlockAction(allowDodgeCancelRecovery=true)` is never invoked; all call sites use `shouldBlockAction()`.

**Classification:** confirmed correctness/intent contradiction. **Balance-sensitive** — do not enable cancel without user approval (Phase 2 choice).

### Q2. Sidestep active 400 server vs 320 client trail?

**YES — confirmed.** Server `SIDESTEP_ACTIVE_MS = 400`; client `ACTIVE_MS = 320` with stale comment.

### Q3. Is `sidestepDirection` absent from production fighter deltas?

**YES — confirmed.** Tracked: `isSidestepping`, `isSidestepStartup`, `isSidestepRecovery` only. Not in `DELTA_TRACKED_PROPS`. Client grep empty.

### Q4. Do client sidestep particles use facing instead of travel?

**YES — confirmed.** `direction: penguin.facing || 1` on start/trail. Contrast: movement-smoke path documents moveDir ≠ facing.

### Q5. Can a successful sidestep begin recovery / end inside a grounded opponent?

**YES — possible, then settle attempts cleanup.** On pass + clipping, recovery eases toward 140 px separation. During recovery, generic pushbox is still off (`isSidestepping` true). If settle clamps at boundary or opponent moves in, final position can remain tight/overlapping until sidestep ends and pushbox runs. Failed pass intentionally holds inside and stays punishable.

### Q6. Insufficient boundary space on desired far side?

**Confirmed behavior:** target clamped to map; edge-panic start uses shorter travel (110). Pass test uses final relative position — edge clamp can prevent `passedOpponent`, yielding failed hold + exposure. No explicit `EDGE_CONSTRAINED` outcome enum today.

### Q7. Can an opponent moving during sidestep invalidate the original success test?

**YES — confirmed.** Success is evaluated once at active→recovery from live relative positions, not from a snapshotted intended-side token. Opponent walking/crossing during the 400 ms active can flip pass/fail relative to player expectation.

### Q8. Does generic pushbox ever fight the sidestep recovery resolver?

**Partially deferred / interaction risk.** During all `isSidestepping` (including recovery), `arePlayersColliding` returns false — no same-tick fight. **After** sidestep ends, `adjustPlayerPositions` may correct residual overlap, which can feel like a second pop if settle was incomplete or opponent moved. Classification: **confirmed architectural handoff risk**, severity playtest-dependent.

### Q9. Plant-resisted thrower immediately actionable, or presentation?

**Authoritative lockout exists (320 / 400 ms Open).** Inputs rejected with `THROW_RECOVERY_ACTIVE`. User “instant” feel → treat as **presentation-first** until an actionability bypass is traced. Not a missing cooldown by default.

### Q10. Which visible attack limbs stay extended in recovery without hurt volume?

**Slap and palm recovery poses** (and charged recoveries) — tip HIT is gone after active, but **no limb hurt region** exists. Low kick disabled. Whiff punish of extended arm is **missing foundation**, not a balance choice yet.

### Q11. Which moves already have physical surface models that must not be replaced?

- Slap / palm / charged **tip rail** (`strikeContact.js`) + park/seam
- Charged earliest physical contact (`chargedHeadbuttContact.js`)
- Strike extension separation
- Clinch attach / techniques
- Rope-jump V2 landing resolver
- Offensive-aerial outcome-before-land contract
- Snowball swept checks

### Q12. Simultaneous outcomes sensitive to player iteration order?

- Input queue drain by player index
- Ordered `checkCollision` calls (mitigated for slap trade window)
- Sidestep/CPU edge helpers not proven order-independent
- Some presentation IDs use `Math.random()`

### Q13. Exact locally predicted inputs; visible delay at realistic RTT?

**Predicted:** local A/D strafe, brake, ice coast (movement predictor); short action **pose** flags (slap/dodge/parry/grab/charge) with 150 ms timeout.  
**Not predicted:** hits, grabs, clinch, sidestep motion, final collision.  
**Visible delay:** remote actions appear after server accept + ≤ ~31 ms broadcast quantization + interpolation; local movement feels immediate; local attacks show pose early but confirm late. No measured RTT table in this Phase 0 pass — measurement is Phase 8.

### Q14. Is the EASY test dummy ordinary consumer Easy?

**YES — confirmed.** `EASY_SLAP_ONLY_DUMMY === true` gates on `cpuDifficulty === "EASY"`.

### Q15. Is the CPU boundary constant stale?

**YES — confirmed drift (partial use).** Local `940` vs authority `935`; mixed with imported `GAME_MAP_RIGHT`.

### Q16. Per-tick allocation of proposed geometry approach?

With scratch reuse: **negligible** (few AABB writes). Naive object-per-region-per-tick: low tens of allocs/tick — avoid. No asset/DOM reads.

### Q17. Deterministic input replay for full neutral interaction?

**NO.** Partial harnesses exist (clinch, aerial, contact, movement prediction). No single ordered-input neutral combat replay covering slap/grab/dodge/sidestep/hitstop together.

---

## 17. Exact confirmed findings from investigation leads

1. **Strong tip rails, no general authored hurtbox system** — confirmed.
2. **Sidestep timing/payload/VFX/direction/settle risks** — confirmed (see §10, Q2–Q8).
3. **Recovery dodge cancel unreachable** — confirmed (Q1).
4. **Action state heavily distributed** — confirmed; not a rewrite mandate.
5. **CPU boundary drift + Easy dummy as consumer Easy** — confirmed.
6. **Networking solid in places, lacks full FG proof** — confirmed; no rollback; no full replay.
7. **Plant “instant” may be presentation** — lockout confirmed present; presentation gap remains the leading hypothesis.

---

## 18. Leads that are no longer true / nuances

| Lead / assumption | Current verdict |
|---|---|
| Premium audit/roadmap already exist | **False** — created by this Phase 0 |
| Easy is slap-or-grab dummy simultaneously | **False** — slap-only flag on; grab-matador off |
| Hitstop freezes wall-clock sim incorrectly | **Nuance** — `simTime` freezes; deadline uses `gameNow()`; intentional |
| Grab startup has default slap armor | **Superseded** — comments/code: default slap armor removed; charged shatter path remains |
| Low kick is a live tip-rail gap | **Nuance** — low kick **disabled** (`LOW_KICK_ENABLED = false`); legacy scalar remains if re-enabled |
| Pushbox fights sidestep settle same tick | **Softened** — pushbox fully off while `isSidestepping`; fight risk is **post-end** handoff |
| Entire CPU uses 940 | **Partial** — also imports 935 for some rope checks; still a real drift bug |

Historical `COMBAT_FIDELITY_*` docs remain useful for invariants and prior phases but are **not** this program’s controlling roadmap.

---

## 19. Ranked MUST FIX / SHOULD FIX / DEFER

### MUST FIX (player-trust or proven contradiction)

1. Sidestep client/server phase parity (400 vs 320) + travel direction on wire or derived — presentation honesty  
2. Sidestep destination / pass / edge / settle outcome model + tests — physical trust  
3. Recovery-cancel dead path — resolve intent with user (enable tested cancel **or** delete dead promise)  
4. Whiff-exposed limb vulnerability foundation (shadow → gated rollout) — competitive readability  
5. Easy lab dummy separated from consumer Easy — product honesty  
6. CPU right boundary uses authority 935 everywhere  

### SHOULD FIX

1. Documented action/cancel matrix enforced by shared capability queries (no full FSM rewrite)  
2. Plant/Open presentation beat aligned to existing 320/400 ms lock  
3. Confirmed-evade semantic event (after sidestep truth) + bounded premium beat  
4. Deterministic scenario harness + order-independence tests  
5. CombatFidelityDebug volumes for push/hurt/hit/grab  
6. Iteration-order audits for simultaneous non-trade cases  

### DEFER

1. Rollback netcode / new networking library  
2. Physics engine  
3. Wholesale playerFactory / boolean FSM rewrite  
4. Low-kick tip-rail (move disabled)  
5. UI/HUD, How to Play, BASHO chrome, Steam packaging, art pipelines  
6. Broad balance retune of damage/stamina/frame data  
7. Replacing tip-rail with pure boxes  

---

## 20. Classification glossary (this audit)

| Class | Examples from this pass |
|---|---|
| Confirmed defect | Unreachable recovery cancel; sidestep 320/400 drift; missing `sidestepDirection` on wire; CPU 940 drift |
| Disproven suspicion | Plant has no lockout (it does); premium audit files already present (they did not) |
| Presentation problem | Sidestep trail facing; Plant feel; slap recovery limb readability without HB |
| Missing foundation | Authored hurt volumes; sidestep outcome enum; full combat replay harness; debug volume draw |
| Balance decision | Whether recovery should be dodge-cancelable after 100 ms |
| Architecture debt (defer unless blocking) | Distributed eligibility booleans; playerFactory size; dual CPU boundary constants style |

---

## 21. Preservation checklist (do not casually disturb)

- Server-authoritative 64 Hz sim; 32 Hz broadcast + interpolation  
- Pausable `room.simTime` + symmetric hitstop; input queue through freeze  
- Tip-derived grounded strike contact; slap/palm/charged seams and parks  
- Charged earliest contact; contact cleanup / losing-action consume  
- Action lifecycle + action-facing ownership  
- Input command reliability / trace tooling  
- Rope-jump V2 vault + landing  
- Offensive-aerial outcome-before-land  
- Clinch harness + Open/Plant rules  
- `combatPresentationEvent` + client dedupe  
- `CombatFidelityDebug`  
- Focused node:test suites  
- Local movement prediction + reconciliation  

---

## 22. Phase 0 evidence limits

- No manual playtest performed in this Phase 0 execution.  
- No production builds, installs, packaging, or git staging/commits.  
- Severity of sidestep “pop” and Plant visual weakness remain **playtest-pending** even where code paths are proven.  
- Dirty worktree: only untracked `PUMO_PUMO_PREMIUM_COMBAT_FOUNDATION_GROK_MEGA_PROMPT.md` at audit time.
