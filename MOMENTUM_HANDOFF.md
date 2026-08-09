# Momentum Combat — Implementation Handoff

You are taking over a partially-complete combat rewrite in this repo. Read this whole file before
changing anything. The design rationale lives in `MOMENTUM_COMBAT_SPEC.md`; this file is the
practical state-of-play, the traps, and the remaining work.

**Read `server-io/momentumTransfer.js` first.** It is the entire new system in one commented file.

---

## 0. What the game is

2D 1v1 sumo fighting game on ICE. Win condition is ring-out. Authoritative Node server
(`server-io/`, socket.io, 64 Hz sim / 32 Hz broadcast) + React client (`client/`).

Ring geometry that every number is designed against:

| Thing | Value | Source |
|---|---:|---|
| Rope-to-rope width | 595 px | `gameUtils.js:253-254` (340 / 935) |
| Centre-to-rope ("half-ring") | 297.5 px | derived |
| Fighter pushbox width | 110 px | `HITBOX_DISTANCE_VALUE` 65 × 0.85 × 2 |
| Dohyo fall edge | 250 / 1030 | `gameUtils.js:259-260` |

**The whole ring is only 5.4 fighters wide.** Every displacement decision has to be held against
that number.

---

## 1. The model, in one page

```
Fixed values are FLOORS. Ceilings are bought with SPEED.
  How far you send them   <- YOUR velocity        (distance channel)
  How much it hurts       <- CLOSING velocity     (impact channel)
  Consecutive connects    -> escalate the send    (pressure channel)
```

Everything is authored in **pixels of delivered distance**, converted to velocity once.

### The three channels

**Distance** — `transfer(vSelf, floorPx, ceilPx, mult)`. `vSelf` is the attacker's own earned
speed toward the victim, curved by `momentumRatio()` (`t^1.5`, where `t = vSelf / V_REF`,
`V_REF = ICE_SLIDE_MAX_SPEED = 2.4`). Walking (1.3) buys 40% of the floor→ceiling range; a full
committed slide buys 100%.

**Impact** — `hitstopMsFor(vClose)` and `postureChipFor(vClose)`. `vClose` is the **gap-closing
rate**, not the sum of both speeds. A head-on collision maxes it; chasing a fleeing victim is
nearly zero.

**Pressure** — `pressureMultiplierFor(step)`, `PRESSURE_ESCALATION = 1.45`. Consecutive connects
within `PRESSURE_RESET_MS` (620 ms) multiply the send, capped at the move's ceiling. This is what
makes a slap barrage build: ground per slap runs `17, 37, 63, 98, 117` px, ring-out on the fifth.

### Move profiles (`MOVE_TRANSFER` in `momentumTransfer.js`)

**Read the live values from `MOVE_TRANSFER` in `momentumTransfer.js`** — floors and ceilings are
the main balance surface and get retuned often. Tests are written profile-driven for this reason;
keep them that way rather than hardcoding numbers.

Floors double as a SPEED dial, not just a distance dial. At this friction a send's initial velocity
is exactly `sendPx / PX_PER_VELOCITY`, so a small send is not merely short, it is SLOW — a 65px
slap starts at 0.40 against a walking speed of 1.3 and averages 27px/s over 2.4s. That is the
"feels like dirt rather than ice" failure mode. Rough guide: 100px → 0.62 initial, 170px → 1.06,
320px → 1.99.

`guaranteed: true` means DI cannot reduce it — a carried fighter has no stance to shift. That is
the grab's entire reason to exist next to a cheaper, faster palm thrust.

---

## 2. HARD INVARIANTS — do not break these

1. **Slap hitstun is +0 by construction.** Victim hitstun = the attacker's remaining attack cycle
   (`collisionSystem.js`, `hitStateDuration` for `isSlapAttack`). Both become actionable on the
   same sim tick. This is `COMBAT_INVARIANTS.md` #3. Never add hitstun to a slap to "make it
   combo" — the pressure escalation is the reward, not frame advantage.
2. **One friction for horizontal decay.** `KB_FRICTION === COAST_FRICTION === ICE_COAST_FRICTION`
   (0.982). Knockback and free glide must decay identically so `handoffVelocity()` is an identity
   and velocity is continuous through hitstun end.
3. **Momentum must be EARNED by moving, never GRANTED by landing a hit.** The attacker's on-hit
   chase push is recorded via `creditGrantedVelocity()` and subtracted in `sampleSelfMomentum()`.
   Without this, each slap powers up the next and mashing spirals to the cap in ~4 hits. There is
   a regression test for it.
4. **Distance depends only on the attacker's own state.** This is also a netcode requirement —
   `vSelf` can be backdated to the attacker's true press, `vClose` cannot (backdating the victim's
   state would give the attacker a rewind advantage). Never let closing speed feed distance.
5. **No chain of hits may exceed `MAX_SEND_PX` (450).**

---

## 3. TRAPS — mistakes already made in this rewrite, do not repeat them

These all shipped, were caught in playtest, and were reverted. They are listed so you do not
rediscover them.

**Trap 1: giving knockback its own faster friction.** Tried `KB_FRICTION = 0.93` so shoves would
"land promptly", with a scaled handoff to preserve distance. It deleted the ice — the victim
decelerated hard, then dropped speed 4x at hitstun end and crept. It also destroyed carryover
between slaps (30% survived a cycle instead of 74%) so barrages never built, and shrank the chase
push to a quarter of the victim's drift. **One friction. The ice is the point.**

**Trap 2: summing both fighters' speed for `vClose`.** A fleeing victim contributed 0 instead of
subtracting, so during a barrage the chase speed read as a collision and fired **199 ms of hitstop
on every slap inside a 260 ms cycle**. The game froze more than it moved. `vClose` is
`attackerAlongAxis - victimAlongAxis`, floored at 0.

**Trap 3: bounding DI and adding a footing-loss window.** The designer was explicit: *"I never had
a problem with DI-able sliding knockback, I only really had an issue of how fast you can kill."*
DI is a per-tick friction multiplier (`DI_FRICTION_FACTOR = 0.96`) and the defender keeps full
control of their slide. Kill speed is governed by floor/ceiling values, not by removing defensive
options.

**Trap 4: additive-only compounding.** Adding a flat send each hit *converges* rather than builds
(`10, 18, 24, 28, 31, 33...`, ~13 connects per half-ring). The designer called it "100 slap hits to
win". Escalation must be multiplicative.

**Trap 5 (found last):** a 0.3 multiplier on the slap slide while pushboxes overlapped
(`index.js`, now `SLAP_SLIDE_CONTACT_DAMP = 0.8`). A 70% brake applied exactly while in slapping
range, so forward motion was suppressed *during* each slap and released between them. Also, the
slap **assigned** `movementVelocity` instead of taking the max, so sliding in at 2.4 and slapping
braked you to 2.0. Both fixed. **A slap must never brake an approach.**

---

## 4. THE LEADING OPEN QUESTION — read this before doing any phase

Latest playtest feedback, verbatim:

> *"it weirdly feels like we are LESS on ice, and the pacing has been grinded to a halt."*

This is the most important unresolved problem, and it may mean part of the approach is wrong.

**Hypothesis.** The goal was "wins shouldn't come so fast." That was pursued by making every hit
displace less. But displacement is also what *creates the ice feel* — long uncontrolled slides.
Shrinking sends made the game slower AND stickier, which are the two things the designer did not
want. Typical play is single hits at the floor (65 px, well under one body width), so most
exchanges produce a nudge rather than a slide.

**Suggested direction (needs designer sign-off before implementing).** Decouple the two: keep
sends BIG and slidey (ice feel, fast pacing), and control kill speed by gating the **ring-out**
rather than the displacement. The original game already did this with kill bands
(`SLAP_KILL_RANGE`, `chargedKillReach`) — a hit slid you to the rope but could only push you OUT
if you were already inside a band. That mechanism was slated for deletion in Phase 6; it may
instead be the right lever, in a cleaner form.

Concretely, worth trying: raise floors ~1.5–2x (slap floor 65 → 100-130), keep the escalation, and
re-introduce a single unified ring-out gate rather than deleting kill bands. **Ask the designer
before committing to this.** Do not silently reverse the spec.

---

## 5. What is DONE and live

- `server-io/momentumTransfer.js` — the whole engine. New file.
- `server-io/test/momentum/transfer.test.js` — 23 tests, all passing.
- **One friction + identity handoff**, applied at all 5 handoff sites: `gameUtils.js`
  (`endHitKnockback`, `finishAirHitFallLanding`) and `collisionSystem.js` (3 trade paths).
- **Universal per-tick DI** in `index.js` (burst/charged no longer lock it out).
- **Slap** → transfer, with a chase push capped at `CHASE_SPEED_CAP` and credited as granted.
- **Impact channel** drives hitstop for slap / low kick / palm / charged.
- **Converted moves:** slap, palm, charged, low kick, body slam (uses dive speed as `vSelf`),
  snowball, pumo clone.
- **Pressure escalation** live on every transfer.
- Trade constants rescaled for the new friction (`SLAP_TRADE_KNOCKBACK` 2.8 → 1.675,
  `PALM_TRADE_KNOCKBACK` 2.15 → 1.29).
- Slap slide no longer brakes an approach; contact damp 0.3 → 0.8.

**Test baseline: 1150 pass / 1 fail.** The single failure is
`test/foundation/authored-slap-limb-contact-correction.test.js` and it is **pre-existing** —
verified by stashing all new files and re-running. Do not chase it.

---

## 6. REMAINING PHASES

Do them in order. Run the full suite after each. Do not batch.

### Phase A — Posture chip (small, do this first)
`resolveTransfer()` already returns `postureChip`, but nothing consumes it. Wire it into the
balance drain in `collisionSystem.js` (currently uses flat constants
`BALANCE_SLAP_HIT_DRAIN_P2` etc.).

Why it matters: posture currently never breaks (85 damage needed vs 35/sec regen after 1.75 s), so
every posture-gated mechanic in the game is dead content — including the kill throw and the
posture-scaled grab distances. Under the impact channel, three hard collisions should break it
while twenty standing pokes should not.

Also consider slowing regen: `BALANCE_REGEN_PER_SEC` 35 → 22, `BALANCE_REGEN_DELAY_MS` 1750 → 2000.

**Acceptance:** three max-closing-speed hits drop balance below `CLINCH_THROW_KILL_THRESHOLD` (15).

### Phase B — Verify parry / clash knockback constants
Not yet checked against the new friction. Candidates in `constants.js`:
`SLAP_PARRY_KNOCKBACK_WINNER/LOSER/NEUTRAL` (194-196), `RAW_PARRY_KNOCKBACK` (726),
`CHARGE_CLASH_*` (~1050).

Determine which channel each writes to. **`movementVelocity` = coast channel, unaffected by the
rewrite — leave alone.** `knockbackVelocity` = affected, needs rescaling by the friction ratio
(old 0.97 → new 0.982 means multiply by ~0.6 to preserve distance). The designer reported parry
knockback "doesn't seem out of whack", so verify before changing.

### Phase C — Grabs (`commandGrabSystem.js`)
Replace the authored tween distances with `transfer()`:
- **DRIVE** spends the GRABBER's momentum: `transfer(vSelf, 30, 300)`. Reduce by the victim's
  counter-charge (driving into someone charging back should barely move them).
- **PULL** spends the VICTIM's closing momentum: `resolveTransfer({ moveKey: "pull" })` samples
  this automatically.
- **THROW** is the neutral option: `transfer(vSelf, 90, 230)`.

Delete `postureScaled()` as the distance source; posture becomes a multiplier instead.
Grabs stay `guaranteed` — never apply DI to them.

Current constants to remove: `CMD_DRIVE_DISTANCE_MIN/MAX`, `CMD_DRIVE_APPROACH_REF_SPEED`,
`CMD_DRIVE_APPROACH_BONUS_MAX`, `CLINCH_PULL_DISTANCE_MIN/MAX`, `CLINCH_THROW_DISTANCE_MIN/MAX`.

**Acceptance:** a standing drive moves ~30 px; a full-slide drive rings out from centre; a pull on
a stationary opponent is a side-switch only.

### Phase D — Deletions (PARTIALLY RESOLVED — read this first)

**DO NOT delete the kill bands.** The designer has answered §4: they explicitly want the rope to
catch a long slide — *"hopefully the rope can catch the knockback if they slid from a far distance
to the map boundary."* So `SLAP_KILL_RANGE`, `chargedKillReach()`, `slapKnockbackCanRingOut` and
`chargedKnockbackCanRingOut` **stay**. They are the ring-out gate, and keeping them is what lets
sends be big and slidey (ice feel) without every big hit being lethal. That is the resolution of
the "feels like dirt" problem: control kill speed at the RING-OUT, not at the displacement.

Still safe to delete (genuinely dead under the new model):
Kill bands and rope clamps: `SLAP_KILL_RANGE`, `SLAP_ROPE_RESIST_BUFFER`, `slapKillBand()`,
`slapKnockbackCanRingOut`, `chargedKillReach()`, `CHARGED_KILL_REACH_*`, the clamp blocks in
`index.js` (~1316-1345), `CMD_DRIVE_EDGE_FORCE_OUT_FRACTION`.

Also dead now: `victimKbScale`, `slapMomentumMult`, `K_PALM_MATADOR`, `PALM_MATADOR_KB_CAP`,
`BURST_KB_FRICTION`, the fixed hitstop ladder, `MASTERY_P1_MOMENTUM` (it is the base game now).

**WARNING:** §4 may mean the kill bands should be KEPT as the ring-out gate. Confirm first.

### Phase E — Dodge / block / parry
- Dodge should PRESERVE momentum, not mint it. `DODGE_LANDING_MIN = 1.1` guarantees a slide floor
  regardless of entry speed, which is how one dodge refunds 94% of the half-ring. Replace with
  inheritance (`entrySpeed × ~0.85`) plus a small floor so dodge stays usable from standstill.
- Block already zeroes movement, so it is the footing option by construction. Give it a transfer
  resist multiplier (~0.45) rather than a new mechanic.
- Parry riposte should scale with the attacker's closing speed.

### Phase F — Client presentation (IMPORTANT, do not skip)
`resolveTransfer().telemetry` carries `{ power, impact, sendPx, compounded, capped }`.
`power` is the distance channel (VFX scale), `impact` is the collision channel (shake, SFX weight).

Emit both in the `player_hit` payload and consume them client-side. Camera shake currently keys off
knockback magnitude alone (`useCamera`, driven by `hitCounter` + knockback). Under this model a
floor hit carries little knockback, so keying off knockback alone makes light hits read as **broken**
rather than **light**. The two channels must be able to look different: a slide-in on a stationary
target is high power / low impact; a mutual head-on is medium power / max impact.

### Phase G — Bout structure + CPU
- Bout timer 60 s → ~30 s with a live hantei readout (position/posture) so both players always know
  who is ahead. Currently the timer never fires and is decoration.
- `cpuAI.js` plays a distance-agnostic game and will be badly wrong under momentum. It needs to
  value building speed before committing. Also route its `vSelf` through a synthetic-RTT backdate
  so it does not read momentum more precisely than a human can.

### Phase H — Latency hardening (ship-blocking for online, deliberately last)
Add a ~20-tick per-player velocity ring buffer and route `vSelf` through
`lagCompensatedFromPress()` (`gameUtils.js:394`, currently wired only to parry) with a tighter cap
than parry's 120 ms — `MAX_MOMENTUM_BACKDATE_MS ≈ 48`. Ice velocity is a slow signal so it does not
need the full envelope, and a longer window is an abuse surface once backdating gates damage.

Also extend the client-prediction knockback suspension to cover momentum sends: the movement
predictor hard-snaps at 80 px and a 300 px send is well past that.

---

## 7. How to work in this repo

```bash
cd server-io
npm test                                  # full suite
node --test test/momentum/transfer.test.js  # the new engine's tests
node --check <file>.js                    # syntax check
```

- **Do not** `require('./index.js')` to smoke-test — it boots the socket server and hangs. Require
  `collisionSystem.js` / `gameFunctions.js` / `gameUtils.js` individually instead.
- The designer runs `nodemon index.js`, so edits hot-reload into their running game immediately.
- Several existing tests are **characterization tests** that pin old constants (e.g.
  `FLAP_BODYSLAM_KB_VELOCITY === 3.1`). When the new model changes a value legitimately, update the
  assertion to express the new contract — do not revert the code to satisfy a stale test. Three
  have already been updated this way; look at them for the pattern.
- Comment style in this codebase is dense and explains WHY. Match it. When you change a value that
  playtest drove, record what the old behaviour felt like and why it was wrong.

---

## 8. Tuning knobs, all in `momentumTransfer.js`

| Constant | Value | Effect |
|---|---:|---|
| `PRESSURE_ESCALATION` | 1.45 | How hard a barrage builds |
| `PRESSURE_RESET_MS` | 620 | How long pressure credit survives |
| `MOMENTUM_CURVE` | 1.5 | >1 means speed must be committed to |
| `V_REF` | 2.4 | Speed that buys a move's full ceiling |
| `MAX_SEND_PX` | 450 | Anti-spiral cap |
| `HITSTOP_FLOOR/CEIL_MS` | 45 / 260 | Freeze range |
| `SLAP_CHASE_RATIO` | 1.15 | How hard the attacker follows |
| `CHASE_SPEED_CAP` | 1.3 | Chase can never exceed own top speed |
| `SLAP_SLIDE_CONTACT_DAMP` | 0.8 | Slide damp while overlapping |
| `MOVE_TRANSFER[*].floor/ceil` | see §1 | The main balance surface |

Floors and ceilings are the primary lever for pacing. Everything else is texture.
