# MASTERY OVERHAUL SPEC — "The Ice Is Always On"

## Implementation Status

- **Phase 0 — Instrumentation & cleanup**: ✅ Complete
- **Phase 1 — Momentum inheritance**: ✅ Complete (flag `MASTERY_P1_MOMENTUM` ON for playtest)
- **Phase 2 — Posture coupling**: ✅ Complete (flag `MASTERY_P2_POSTURE` ON for playtest)
- **Phase 3 — Tsuppari cadence**: ✅ Complete (flag `MASTERY_P3_CADENCE` ON for playtest)
- **Phase 4 — Analog resolutions & risk dials**: ✅ Complete (flag `MASTERY_P4_ANALOG` ON for playtest)
- **Phase 5 — Assist removal & legibility**: ✅ Complete (flag `MASTERY_P5_ASSISTS` ON for playtest)
  - **5.1 Assist removal**: grab sidestep-tracking tightened 400→`SIDESTEP_GRAB_TRACK_RANGE_P5`
    (220 LOUD / 280 SAFE) in `index.js`, so spacing (not an auto-track table)
    answers the sidestep.
    - **Held-direction aim — CUT (post-playtest)**: originally the slap committed
      to a held horizontal direction (absolute aim) instead of auto-facing. Removed
      entirely: the only cases it triggered added no skill and read as a bug, and
      BACK+MOUSE1 is already bound to palm thrust, so a held slap direction is
      never a meaningful, non-conflicting input. Slap + palm both keep auto-face.
      The CPU IMPOSSIBLE whiff-bait that depended on it was removed with it.
  - **5.2 Legibility**: momentum-hit (heavier spark/SFX/shake) + braked-knockback
    ("dig-in" skid) tells sent in `player_hit` (server-gated); posture-bar pulse
    when broken (`BalanceGauge`). The phase flag is broadcast to the client on
    `fighter_action` (`masteryP5`) so client-only tells render only when ON.
    - **Speed-state snow-spray — CUT (post-playtest)**: reused the landing-smoke
      preset under a fast-moving fighter; it read as a stuck landing puff, not a
      speed tell. Removed. Speed-state legibility deferred to a bespoke effect.
    - **Deferred polish** (safe follow-ups, not yet built): body-lean sprite
      transform in the speed state, and the hidden-tech dust/SFX for dodge
      S-cancel + dodge-landing powerslide boost. Skipped to avoid regressions in
      the fighter-sprite transform stack; everything else in 5.2 is live.

> **Only intentional gameplay change so far**: projectile ring-outs (snowball,
> pumo clones) are now clamped to the kill band like slaps — they can only ring a
> victim out from within `SLAP_KILL_RANGE` of the rope. Everything else in Phase 0
> is non-gameplay (telemetry) or dead-code removal.

---

> **Purpose**: Add a continuous skill dimension underneath PenguinPow's discrete
> decision layer, so mastery compounds for thousands of hours without raising
> the floor for casual players. This document is self-contained: it is written
> to be handed to an implementing agent with no other conversation context.
>
> **Scope**: Server combat sim (`server-io/`) + client feedback/VFX. No new
> verbs, no new inputs, no map changes, no clinch-internals rework.
>
> **Read first**: `server-io/constants.js`, `server-io/index.js` (tick loop),
> `server-io/gameFunctions.js` (`executeSlapAttack`, `executePalmThrust`),
> `server-io/collisionSystem.js` (`processHit`), `server-io/grabActionSystem.js`,
> `server-io/socketHandlers.js` (`processInputPacket`), `server-io/cpuAI.js`
> (`DIFFICULTY_PROFILES`, `PERSONALITY_PROFILES`).

---

## 0. Design thesis (why)

The game today resolves every interaction through **quantized verbs**
(fixed-duration macros), **table lookups** (what-beats-what), and **flattened
payouts** (fixed constants for every win). Knowledge saturates; there is
nothing continuous to practice. The overhaul introduces three currencies that
interact continuously:

| Currency | What it is | Where it lives today |
|---|---|---|
| **Position** | The win condition (rope lines at x=340/935) | Fully built |
| **Momentum** | Velocity carried into/out of every verb | Built (ice physics) but **confiscated by every button** |
| **Posture** | The hand-fight currency that gates conversions | Built (`balance`) but weakly coupled and invisible |

Target structure (authentic sumo): **striking is the setup layer, conversion is
the payoff layer** — either *oshi* (momentum thrust → edge kill band) or
*yotsu* (grab vs broken posture → enhanced clinch). Two mastery tracks, two
style identities (the CPU already encodes them: `pusher` / `grappler`).

### Global invariants — DO NOT BREAK

1. **Frames never change from momentum.** Momentum/posture scale *distances*
   only. The slap's +0-by-construction (victim stun = attacker's remaining
   cycle, `processHit`) is preserved. (Exception: cadence + risk dials in
   Phases 3–4 adjust frames *explicitly and deliberately*, never via momentum.)
2. **Floors are today's values.** At entry velocity 0 and full posture, every
   move behaves byte-identically to current constants. All new effects are
   ceiling-only.
3. **Rope clamps and kill bands remain the floor geometry.** Bands may *expand*
   with earned quality (momentum, posture, counter), never shrink, and the
   midscreen no-kill deadzone must survive (see Phase 2 caps).
4. **Every phase behind its own kill-switch flag**, off by default until tuned.
   With all flags off, the sim must be byte-identical to today.
5. **PvP/BASHO firewall preserved**: no change may leak BASHO stat/draft/loadout
   behavior into PvP paths (follow the existing `player.statMods?.x ?? 1`
   pattern).
6. **Server-authoritative everything.** The client movement predictor already
   suspends on all attack/hit flags (`prediction/movementPredictor.js`
   `BLOCKING_FLAGS`) — do not extend prediction scope.
7. **Untouched**: hitstop discipline, pausable sim clock, netcode/lag-comp,
   sidestep's fixed arc, rope jump, map dimensions, stamina costs, input map.

### Feature flags

Create `server-io/masteryFlags.js`:

```js
module.exports = {
  MASTERY_P1_MOMENTUM: false,       // Phase 1 — momentum inheritance
  MASTERY_P2_POSTURE: false,        // Phase 2 — posture coupling
  MASTERY_P3_CADENCE: false,        // Phase 3 — tsuppari cadence
  MASTERY_P4_ANALOG: false,         // Phase 4 — analog resolutions + risk dials
  MASTERY_P5_ASSISTS: false,        // Phase 5 — assist removal
};
```

Every new branch checks its flag. Tuning constants live in `constants.js`
under a clearly-marked `MASTERY OVERHAUL` section, each with a **LOUD** value
(ship first, playtest) and a **SAFE** fallback (commented). Tune loud, dial
back — if a first-time playtester can't feel a phase inside 10 minutes, the
coefficients are wrong, not the design.

---

## Phase 0 — Instrumentation & cleanup (no gameplay change)

**Goal**: baseline data + a clean substrate. Independently shippable.

1. **Velocity-at-press telemetry.** In the existing per-match input audit log
   (`inputAuditLog.js`), record on every attack/grab initiation:
   `{ verb, movementVelocity, x, opponentDistance, simTime }`. Add a tiny
   offline script (`server-io/scripts/velocity-histogram.mjs`) that histograms
   `|movementVelocity|` at press per verb. This tells us where the momentum
   curve's knee belongs and proves the before/after shift.
2. **Dead code removal** (verify each is truly unreferenced first):
   - Crouch stance: `isCrouchStance`/`isCrouchStrafing` are forced `false`
     every tick in `index.js`; `BALANCE_CROUCH_REGEN_PER_SEC` is exported but
     never read. Remove the constants + the crouch multiplier branch in
     `processHit` (`isCrouchStance` ×0.9) + delta props, or leave sprites/assets
     for later reuse. Decision: **remove logic, keep art**.
   - `slapStrafeCooldown` / `slapStrafeCooldownEndTime`: gates strafing in
     `index.js` but nothing sets them anymore. Remove the gates.
   - Unused `e` key plumbing (`eJustPressed` etc.) — keep the key in the input
     map (free real estate) but delete dead handler references.
   - Legacy constants: `SLAP_PARRY_KNOCKBACK_VELOCITY`, `GRAB_BREAK_PUSH_VELOCITY`,
     `GRAB_PUSH_SPEED`/`GRAB_PUSH_DURATION` (if unreferenced), `THROW_RANGE`
     (if unreferenced), legacy movement aliases that alias 1:1.
3. **Consistency decision — projectile ring-outs.** Snowball (kb 1.55, 300ms)
   and pumo clones (1.6, 200ms) have **no rope clamp** and can ring out from
   ~100px. This violates the kill-band philosophy. **Decision: clamp them**
   like slaps (reuse `isSlapKnockback` + `slapKnockbackCanRingOut` with
   `SLAP_KILL_RANGE`) so *all* ring-outs are earned at the rope. (If a
   projectile niche kill is wanted later, re-add deliberately in Phase 4.)
4. **Acceptance**: flags absent, sim byte-identical (run a scripted input
   replay before/after if available; otherwise CPU-vs-CPU determinism spot
   check), telemetry lands in the audit log.

---

## Phase 1 — Momentum inheritance (the substrate)

**Rule**: no verb ever *assigns* `movementVelocity`; verbs **blend** their
impulse with carried velocity. Only distances change. Flag:
`MASTERY_P1_MOMENTUM`.

### 1.1 Shared helper

In `gameUtils.js`:

```js
// Signed entry velocity aligned to a direction (+ = moving that way).
// dir is ±1 (e.g. slap slideDirection). Clamped to sane sim bounds.
function alignedEntryVelocity(v, dir) {
  const a = (v || 0) * dir;
  return Math.max(-2.2, Math.min(a, 2.2)); // powerslide cap ~2.1
}
```

### 1.2 Slap — inherits (both set-points)

The slap writes its slide in **two places**; both become blends. Capture
`const entryV = player.movementVelocity;` **before** any overwrite.

- `gameFunctions.js` → `executeSlapAttack` (on press):
  today `movementVelocity = slideDirection * slapSlideVelocity /*1.0*/`.
  New:

  ```
  aligned  = alignedEntryVelocity(entryV, slideDirection)
  slideVel = clamp(1.0 + K_SLAP_INHERIT * aligned, SLAP_SLIDE_MIN, SLAP_SLIDE_MAX)
  movementVelocity = slideDirection * slideVel * (existing power/basho slide scaling)
  ```

  Constants: `K_SLAP_INHERIT = 0.55` (LOUD; SAFE 0.35),
  `SLAP_SLIDE_MIN = 0.45` (fade-away slap — retreating entry produces a short,
  safe step-in; keep > 0 so the ground-transfer identity survives),
  `SLAP_SLIDE_MAX = 2.0`.
  Store `player.slapEntryAligned = max(0, aligned)` for the hit resolution.
- `collisionSystem.js` → `processHit` slap branch (on connect): attacker push
  `SLAP_ONHIT_ATTACKER_PUSH` and victim drift `SLAP_ONHIT_VICTIM_DRIFT` both
  scale by the same factor:

  ```
  momentumMult = 1 + K_SLAP_KB_INHERIT * slapEntryAligned   // K = 0.45 LOUD / 0.3 SAFE
  attacker push = 1.0  * momentumMult   (cap 1.8)
  victim drift  = 1.15 * momentumMult * finalKnockbackMultiplier (cap 2.2 total)
  ```
- **Whiff**: no change needed — the slap slide already coasts on ice; with a
  bigger inherited slide, over-committed whiffs carry the attacker
  past/toward the rope automatically. Do NOT add a scripted stop.
- The pushbox rule that kills toward-velocity on contact
  (`adjustPlayerPositions`) **stays** — it naturally splits slap range into
  *contact* (no momentum possible; grab/clinch territory) and *tip range*
  (~116–146px; momentum footsies). Do not "fix" this.

### 1.3 Victim-side momentum (getting hit while moving)

In `processHit`, capture `victimEntryV = otherPlayer.movementVelocity` at the
top (before any zeroing). For slap / palm / charged / flap-slam knockback:

```
intoHit = alignedEntryVelocity(victimEntryV, knockbackDirection * -1) // + = moving into the hit
kbScale = 1 + K_VICTIM_INTO * max(0, intoHit)      // K_VICTIM_INTO = 0.35 LOUD / 0.2 SAFE
        - K_VICTIM_BRACE * max(0, -intoHit)        // K_VICTIM_BRACE = 0.20 LOUD / 0.12 SAFE
knockbackVelocity.x *= clamp(kbScale, 0.7, 1.6)
```

This makes brake-timing before an incoming hit a real, trainable defensive
skill (it upgrades the existing invisible DI). Kill-band checks are evaluated
at connect position as today — the scale changes carry distance, and clamps
still apply (invariant 3).

### 1.4 Dodge — inherits on landing

- `socketHandlers.js` dodge start (and the two buffered-dodge paths in
  `gameFunctions.js`): capture `player.dodgeEntrySpeed = Math.abs(player.movementVelocity)`
  **before** `movementVelocity = 0`. Travel stays fixed (104px).
- `index.js` dodge landing: today `movementVelocity = landingDirection * DODGE_SLIDE_MOMENTUM /*1.1*/`.
  New: `landingMomentum = clamp(0.9 + 0.6 * dodgeEntrySpeed, 1.1, 1.7)`
  (LOUD; SAFE `+0.4`, cap 1.5). The `* DODGE_POWERSLIDE_BOOST` (C held) path
  multiplies the same base. Dash becomes the runway-free momentum generator:
  walk→dodge→slap chains carry real speed.

### 1.5 Grab — already inherits (verify + retune)

`grabApproachSpeed` → burst push via `GRAB_PUSH_MOMENTUM_TRANSFER` (0.6).
Raise to **0.75 LOUD / 0.65 SAFE**. Verify capture happens before zeroing in
*all three* grab entry paths (direct press, buffered `executeInputBuffer`,
post-grab buffer). This is the template mechanic — keep its feel.

### 1.6 Anchors — explicitly unchanged (this contrast IS design)

- **Palm thrust**: stays rooted. Optional matador upgrade (same flag):
  `palmKb = PALM_THRUST_KB_VELOCITY + 0.5 * max(0, victimClosingSpeed)`,
  cap 3.2 (just under the flap slam's 3.1 base? — flap uses 3.1; cap palm at
  3.1 so the slam stays the heaviest strike). A read on a charging opponent
  uses their own speed against them.
- **Parry**: full-stop plant, unchanged.
- **Sidestep / rope jump**: unchanged (committed escapes).
- **Charged**: unchanged in Phase 1 (it already has lunge physics). Optional
  Phase 4 dial: release inherits `0.3 * aligned` into lunge initial speed.

### 1.7 CPU + acceptance

- CPU: teach momentum entries at HARD+ — prefer dodge-in/walk-in before slap
  when at 160–260px (`cpuAI.js` offense blocks); EASY/NORMAL press flat-footed
  as today. Respect the new fade-away option in retreat logic (optional).
- Acceptance: flag off ⇒ byte-identical. Flag on, entry v=0 ⇒ distances match
  current constants exactly. Telemetry shows velocity-at-press distribution
  shifting right within one playtest session. A dodge-in slap visibly shoves
  ~2× a flat slap.

---

## Phase 2 — Posture coupling (the sumo structure)

**Goal**: striking becomes the setup layer; grabs/edge become the conversion
layers. Reuses the existing `balance` stat — rename in UI only ("POSTURE" on
`BalanceGauge`), server keeps the field name. Flag: `MASTERY_P2_POSTURE`.

### 2.1 The broken-posture state

- New derived state: `isPostureBroken = balance < POSTURE_BREAK_THRESHOLD (35)`.
  Add `isPostureBroken` to `DELTA_TRACKED_PROPS` (computed server-side each
  tick, hysteresis: breaks at <35, recovers at >45 to avoid flicker).
- Client: visible stagger art/overlay (reuse the `GassedEffect`/tint pattern in
  `GameFighter.jsx`) + a posture-crack SFX on the break edge. This state must
  be readable from across the room — it is the game's "openable" tell.

### 2.2 Drains and regen (the hand-fight has an arc)

| Constant | Today | LOUD | SAFE | Notes |
|---|---|---|---|---|
| `BALANCE_SLAP_HIT_DRAIN` | 8 | 12 | 10 | Tsuppari breaks posture |
| `BALANCE_CHARGED_HIT_DRAIN` | 15 | 18 | 16 | |
| Palm posture drain | 15 (charged) | 20 | 18 | The posture-breaker identity |
| `BALANCE_PASSIVE_REGEN_PER_SEC` | 5 | 6 | 5 | Slightly faster so disengaging resets the war |

Counter-hits drain ×1.5 posture (their frame bonus stays as-is).
Perfect parry's existing +12 balance refund is kept — it's now a posture swing
and needs no change (synergy for free).

### 2.3 Yotsu conversion — grab vs broken posture

In both grab-connect sites (`index.js` grab-startup connect + grab-movement
connect): if `opponent.isPostureBroken`:

- Grant the grabber **deep grip on connect** (`grantDeepGrip` semantics: set
  `hasDeepGrip`, emit the existing `deep_grip` event with `source: "posture"`).
- Floor the Phase A burst at `GRAB_CATCH_MIN_BURST_SPEED` (reuse the existing
  "caught the henka" mechanism) so the carry visibly bites.
- Do **not** skip the victim's grip-up — the clinch stays a fight; the reward
  is the deep-grip head start (+10 throw threshold, ×1.1 push) they otherwise
  need 1s of unanswered push to earn.

### 2.4 Oshi conversion — momentum + posture edge lethality

Slap/palm/flap-slam kill band becomes:

```
band = SLAP_KILL_RANGE (45)
     + KILLBAND_MOMENTUM * min(slapEntryAligned, 1.3) / 1.3   // 25 LOUD / 15 SAFE
     + (victim.isPostureBroken ? KILLBAND_POSTURE : 0)        // 30 LOUD / 20 SAFE
band = min(band, KILLBAND_CAP = 110)
```

Charged: `killReach *= victim.isPostureBroken ? 1.25 : 1` (cap stays
`CHARGED_KILL_REACH_CAP = 135`). Deadzone check: 595 − 2×135 = 325px midscreen
no-kill zone survives worst case (invariant 3 holds).

### 2.5 CPU + acceptance

- CPU: add "hunt broken posture" trigger — when opponent `isPostureBroken`,
  boost grab chance (grappler archetype ×1.5) and edge-thrust chance (pusher
  ×1.5); EASY ignores posture entirely. Extend the existing clinch balance
  checks rather than forking logic.
- Acceptance: a deliberate 4-slap opening → visible break → grab grants deep
  grip. Kill-type telemetry (add `winType` counts to the audit log close)
  shows both oshi (slap/palm/charged edge kills) and yotsu (clinch) paths used
  by the CPU at HARD.

---

## Phase 3 — Tsuppari cadence (depth inside the slap loop)

**Goal**: the contact-range slap war becomes a rhythm skill. Reward-only —
mash keeps today's exact behavior. Flag: `MASTERY_P3_CADENCE`.

### 3.1 Mechanism (uses existing buffer semantics — no input changes)

The slap buffer already keeps the **first** press per cycle
(`pendingSlapCount` cap 1) and fires it at cycle end. That means a masher
buffers an *early* press and a rhythm player presses *late and precise*. The
cadence check is therefore purely a timestamp comparison:

- Add `player.pendingSlapPressTime` (simNow when the buffered press was
  queued; also stamp the direct-press path).
- At `endSlapCycle`, when firing the next slap:
  `gap = cycleEndSimTime - pendingSlapPressTime`.
  If `gap <= CADENCE_WINDOW_MS (60)` → **enhanced slap** (window ≥ 4 ticks to
  be fair through the 16ms client emit granularity; the parry lag-comp
  pattern `pressGameTimeFromEvents` can tighten this later if wanted).
- Because +0 is computed dynamically from the attacker's remaining cycle, an
  enhanced slap with a shorter cycle **stays +0 automatically** — both players
  become actionable sooner together. No frame-math patch needed.

### 3.2 Enhanced slap properties

| Property | Normal | Enhanced (LOUD) | Enhanced (SAFE) |
|---|---|---|---|
| Cycle (`SLAP_TOTAL_MS`) | 230ms | 205ms | 215ms |
| Posture drain | 12 (P2) | 16 | 14 |
| Step-in / pair shift | base | ×1.15 | ×1.1 |
| Feedback | — | sharper SFX (rising pitch per consecutive), hand-flash VFX | same |

Consecutive enhanced slaps increment a cosmetic `cadenceChain` (delta prop)
for escalating VFX — the crowd should *hear* a good player's tsuppari. Chain
resets on whiff/clash/parry/hit-taken. The rhythm is naturally non-metronomic:
hitstop pauses the sim clock, hit vs whiff cycles differ (230/275ms), clashes
interrupt — this is rhythm-under-perturbation, not a metronome tax.

### 3.3 Guardrails + CPU + acceptance

- Never required: base slap untouched; no content gated behind cadence.
- Optional backlog (do NOT build now): extend the same cadence system to
  clinch push ("gaburi" belly-pump rhythm) — flagged here so the clinch has a
  designed growth path without a rework.
- CPU: cadence competence by tier — EASY 0%, NORMAL 25%, HARD 60%,
  IMPOSSIBLE 92% of presses in-window (implement as scheduling the CPU's next
  M1 press near cycle end with jitter from `DIFFICULTY_PROFILES`).
- Acceptance: audible/visible difference between mash and rhythm within one
  session; enhanced slap confirmed +0 (both actionable same tick) via sim test.

---

## Phase 4 — Analog resolutions & risk dials (payouts become curves)

**Goal**: replace table cliffs with continuous curves, and add *player-chosen*
variance. Flag: `MASTERY_P4_ANALOG`. Ship each item separately in this order:

### 4.1 Parry quality curve

`processHit` already computes `parryDuration = hitTime − rawParryStartTime`
(lag-compensated). Inside the perfect window (≤120ms):

```
quality = 1 - parryDuration / PERFECT_PARRY_WINDOW      // 1.0 = frame-perfect
attackerStun = lerp(700, 880, quality)                  // PERFECT_PARRY_ATTACKER_STUN_DURATION base
parryShove   = lerp(0.65, 0.95, quality)                // PERFECT_PARRY_KNOCKBACK base
postureRefund= round(lerp(12, 20, quality))             // PERFECT_PARRY_BALANCE_REFUND base
```

Regular (non-perfect) parry unchanged. Client: scale the existing
perfect-parry flash/shake slightly with `quality` (send it in the
`perfect_parry` payload). Tens-of-ms parry grading = thousand-hour skill.

### 4.2 Tip/deep slap spacing

At slap connect, `d = |attacker.x − victim.x|`:
- **Tip** (`d > 120`): posture drain ×1.3, victim drift ×1.1 (spacing reward).
- **Deep** (`d ≤ 120`): baseline.
One threshold, continuous enough via positioning; revisit as a true curve
later if it reads well.

### 4.3 Clash margin scaling

`resolveSlapParry` decisive case: replace the fixed WINNER/LOSER constants
with `t = clamp((gap − 30) / (75 − 30), 0, 1)`:
`loserKb = lerp(2.6, 4.2, t)`, `winnerKb = lerp(1.2, 0.6, t)`. Neutral tie
case unchanged. Recovery stays symmetric (their fairness invariant).

### 4.4 Continuous charge

Replace the 300/500/1000 lunge-tier buckets with
`attackDuration = 300 + 1700 * (charge/100)^1.6` (matches endpoints, keeps
low-charge lunges short). Priority threshold (30) and kill gates (50/80)
stay — they're legible bets.

### 4.5 Risk dials (the compounding layer — most sensitive, tune last)

- **Follow-through** (slap, on connect): holding *toward* at connect →
  pair-shift ×1.35, attacker recovery +25ms (slightly minus — victim can
  answer). Holding *away* → fade: shift ×0.8, recovery −10ms (slightly plus,
  less ground). Player-chosen variance on every connect; the +0 default stays
  for neutral hands.
- **Counter-hit honesty**: drop the pure-intent counter case
  (`counterHitFromIntent` with no active startup) or shrink
  `COUNTER_HIT_WINDOW_MS` 150→100 for intent-only. Counters must be earned
  reads now that they feed posture ×1.5.

### 4.6 CPU + acceptance

CPU: IMPOSSIBLE uses follow-through when victim posture-broken near edge;
pusher archetype biases follow-through, counter archetype biases fade.
Acceptance: each sub-item independently flag-testable; clash outcomes vary
visibly with timing margin; no midscreen kills appear in telemetry.

---

## Phase 5 — Assist removal & legibility (skill must be visible)

Flag: `MASTERY_P5_ASSISTS`. Do this **last** — it changes muscle memory.

### 5.1 Assist removal

- **Facing auto-correct → held-direction aim**: on slap/palm press, if a
  direction key is held, the attack fires that way; if neutral, keep today's
  auto-face (casual assist preserved). This unlocks whiff-baiting and
  deliberate misdirection without ever punishing a neutral press. Charged
  release keeps auto-correct (it's a committed lunge; revisit later).
- **Grab sidestep-tracking**: `SIDESTEP_GRAB_TRACK_RANGE` 400 → **220**. A
  point-blank read still catches the sidestep startup/recovery; a spaced
  sidestep escapes. Spacing becomes the answer, not the table.

### 5.2 Legibility pass (client)

- **Speed states**: snow-spray particles + body lean when `|movementVelocity| > 0.9`
  (server already broadcasts `movementVelocity`; client-side only).
- **Momentum hits**: heavier hitspark variant + deeper SFX when
  `momentumMult > 1.25` (send a flag in `player_hit`).
- **Braked knockback**: "dig-in" ice-chip puff + skid SFX when the victim's
  brace reduction applied (send in `player_hit`).
- **Posture**: broken-posture stagger overlay + crack SFX (Phase 2 item,
  polish here). Posture bar pulses when broken.
- **Cadence**: per-3.2. Parry quality: per-4.1.
- **Hidden tech surfacing**: distinct dust/SFX for dodge S-cancel and
  dodge-landing powerslide boost (both exist today, invisible).

### 5.3 Acceptance

A spectator watching two skilled players can *name* what happened: "dodge-in
cadence tsuppari broke posture, momentum slap killed at the band." Every one
of those words has a visual/audio tell.
a
---

## Cross-phase: CPU AI program

Each phase lands with its CPU competence in the same PR (VS CPU and BASHO are
first-class; a combat change without CPU support silently breaks them):

| Phase | CPU work (in `cpuAI.js`) |
|---|---|
| P1 | Momentum entries at HARD+; respect new threat ranges; fade-away retreat slaps (optional) |
| P2 | Hunt broken posture (grab/edge-thrust triggers); protect own posture (disengage when low, archetype-weighted) |
| P3 | Cadence % by difficulty tier (0/25/60/92) |
| P4 | Follow-through/fade usage by archetype; parry timing already tier-gated (`perfectParry`) — feed quality curve |
| P5 | Aimed attacks: only IMPOSSIBLE deliberately whiff-baits; others use neutral auto-face |

Difficulty firewall: EASY/NORMAL must *not* gain any new capability beyond the
percentages above — the overhaul raises the ceiling, not the floor.

---

## Rollout & testing protocol

1. **Order**: P0 → P1 → P2 → P3 → P4 (item-by-item) → P5. Each phase is
   independently shippable and playtestable; do not start tuning a phase with
   the previous one's flag off.
2. **Regression harness**: with all flags off, CPU-vs-CPU (fixed seed if
   possible) and a scripted input replay must match pre-overhaul behavior.
   With a flag on and inputs at rest (v=0, full posture), distances must equal
   the documented floors.
3. **Playtest metrics** (from the Phase 0 telemetry): velocity-at-press
   histogram (expect rightward shift after P1), win-type distribution (expect
   oshi/yotsu split after P2, not 90/10), enhanced-slap rate by player (P3),
   average round length (watch for bull-charge degeneracy after P1 — if rounds
   collapse below ~15s, lower `K_SLAP_KB_INHERIT` first, not the step-in).
4. **Known degeneracy watchlist**:
   - Bull-charge meta (P1): mitigated by early-saturating curves, whiff
     self-endangerment, and the palm matador; monitor anyway.
   - Posture-camp (P2): if players disengage-heal too easily, raise regen
     delay after being hit rather than lowering regen.
   - Cadence-as-tax (P3): if playtesters report "forced rhythm", weaken
     enhanced properties — never nerf the base slap.
5. **Netcode note**: cadence and parry windows are judged on the sim clock
   with existing buffering; the 60ms cadence window ≥ 4 ticks covers client
   emit granularity (16ms) + jitter. Do not judge any new window on packet
   arrival time (follow the parry lag-comp precedent).

## Explicitly out of scope (backlog, do not build now)

- Clinch internals rework (stance system stays; gaburi cadence is the designed
  extension point).
- Jolt/clinch table → margin curves (candidate for a later analog pass).
- Power-up specialization / pickable PvP kits (separate identity track; BASHO
  loadout infra is the seed).
- Continuous stamina fatigue outside the clinch, map size, new verbs, new
  inputs, tutorialization.
