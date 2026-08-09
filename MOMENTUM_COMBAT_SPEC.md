# Momentum Combat — Core Model Spec

Design spec, not an implementation plan. Replaces the authored knockback table with a single
momentum model so that every contact in the game speaks one language.

Status: **proposed**. Nothing here is in code.

---

## 0. The rule

> **Fixed values are floors. Ceilings are bought with speed.**
> How far you send them is set by **your** velocity.
> How much it hurts is set by the **closing** velocity.
> Impulse **adds** to a fleeing victim's existing slide, so pressure compounds.

Everything below is a consequence of those four lines.

### Why this and not the current model

Today every hit does `knockbackVelocity.x = <constant>` — an assignment, not an addition
(`collisionSystem.js:3237-3243`, `:3298`). At the moment of contact, everything both fighters
built on the ice is deleted and replaced with a number from a table. The ice is therefore
cosmetic: it changes how you travel between hits, but it has no bearing on what a hit does.
`victimKbScale` (`constants.js:1652-1655`) bolts momentum back on but clamps it to 0.7–1.6, so at
best momentum modifies the constant by 60%.

The current numbers also leave no room to play. Centre-to-rope is 297.5px. A slap moves you 96px
(32% of that), a palm thrust 385px (130%), and one dodge refunds 281px (94%). There is no unit
small enough to accumulate, so position cannot function as a resource.

---

## 1. Units

Unchanged from today, restated so the formulas below are unambiguous.

| Quantity | Value | Source |
|---|---|---|
| `TICK_RATE` | 64 Hz → `delta` = 15.625 ms | `constants.js:12` |
| `speedFactor` | 0.185 | `constants.js:140` |
| `k` (px per velocity-unit per tick) | `delta × speedFactor` = **2.8906** | derived |
| `ICE_COAST_FRICTION` | 0.982 | `constants.js:505` |
| `ICE_MAX_SPEED` (walk) | 1.3 | `constants.js:501` |
| `ICE_SLIDE_MAX_SPEED` | 2.4 | `constants.js:550` |
| Centre-to-rope | 297.5 px | `gameUtils.js:253-254` |

**Settle distance** for a velocity `v` decaying at friction `f`:

```
D(v) = v × k / (1 − f)
```

### 1.1 Two channels, one honest number

An earlier draft of this spec proposed collapsing every friction into `ICE_COAST_FRICTION` and
authoring moves in "settle distance on open ice." **That was wrong, and the reason is worth
recording**, because it is the same mistake the original audit made.

Two live mechanisms mean settle distance is not what a hit delivers:

1. **DI.** Holding away multiplies knockback friction (`index.js:1270-1293`). It is locked out
   during burst and charged windows but live for slaps.
2. **The handoff.** `endHitKnockback` (`gameUtils.js:2056-2058`) assigns leftover knockback
   straight onto `movementVelocity`, where `ICE_BRAKE_FRICTION` (0.80) devours it if the victim
   brakes — and where, if they *don't*, it silently travels ~4x further because the coast channel
   decays ~4x slower than the knockback channel it came from.

Measured against the live constants, that produces an enormous spread:

| Move | Victim holds nothing | Victim DIs + brakes | Ratio |
|---|---:|---:|---:|
| Slap | 149 px | 25 px | 6.0x |
| Palm thrust | 385 px | 107 px | 3.6x |
| Charged @100% | 340 px | 165 px | 2.1x |
| Body slam | 396 px | 139 px | 2.8x |

Also relevant: **a fighter moving under `movementVelocity` is hard-clamped at the ropes**
(`index.js:1398`, `:1420`, `:3096`). Only a victim crossing the boundary while `isHit` can leave
the ring. So displacement outside the hitstun window never rings anyone out — it only repositions.

Authoring against the left column makes every value look enormous. Authoring against the right
column makes hits vanish the moment anyone learns to hold back: a 35 px "settle" slap lands as a
6 px nudge, which is exactly the slow-and-boring failure this system must avoid.

**Resolution.** Two frictions, deliberately, with an honest conversion between them:

| Channel | Friction | Role |
|---|---:|---|
| Knockback (`KB_FRICTION`) | **0.93** | The shove. Delivers ~85% of its distance in 400 ms. |
| Coast (`COAST_FRICTION`) | **0.982** | The free glide. Unchanged from today. |

```
PX_PER_KB_VELOCITY    = 2.8906 / (1 − 0.93)  ≈  41.3 px
PX_PER_COAST_VELOCITY = 2.8906 / (1 − 0.982) ≈ 160.6 px
```

The knockback friction exists because a shove should *land*. At the coast friction a hit needs
~1.4 s to deliver 85% of its distance, which is why legacy knockback felt like it trickled and why
its no-input totals ballooned.

**The handoff becomes distance-preserving** rather than a silent 3.9x inflation:

```
handoffVelocity(kb) = kb × (1 − COAST_FRICTION) / (1 − KB_FRICTION)     // × 0.257
```

The residual glide now carries exactly the distance the shove still owed.

### 1.2 DI is bounded to ~35%

`DI_FRICTION_FACTOR` stays at 0.96, so total distance scales by
`(1 − f) / (1 − f × DI)` = **0.653**. A DI-ing victim eats 65% of the send instead of 17–28%.

DI stays a skill worth learning and worth reading, but it stops being an off switch. This matters
for the attacker as much as the defender: under the legacy spread the same read paid 25 px or
149 px depending on a habit you cannot see, so landing a good hit never felt reliably good.

---

## 2. The transfer curve

One function. Every move calls it.

```
V_REF          = ICE_SLIDE_MAX_SPEED = 2.4     // speed that buys the ceiling
MOMENTUM_CURVE = 1.5                            // >1 so the payoff needs real commitment

transfer(vSelf, floor, ceiling):
    t = clamp(vSelf, 0, V_REF) / V_REF
    return floor + (ceiling − floor) × t ^ MOMENTUM_CURVE
```

`MOMENTUM_CURVE = 1.5` is load-bearing. At 1.0 a casual walk-in already buys 54% of the ceiling,
which makes ordinary movement feel like a power move. At 1.5, walking buys 40% and the top of the
range genuinely requires a committed slide:

| `vSelf` | What it is | `t^1.5` | Share of range |
|---:|---|---:|---:|
| 0.00 | standing | 0.000 | floor only |
| 0.65 | strolling | 0.141 | 14% |
| 1.30 | walk top speed | 0.399 | 40% |
| 1.80 | slide, not committed | 0.650 | 65% |
| 2.40 | full committed slide | 1.000 | 100% |

### 2.1 Sampling — and why the two channels are sampled differently

Velocity is the fighter's total horizontal velocity along the hit axis
(`movementVelocity + knockbackVelocity.x`), signed positive toward the opponent. Velocity moving
*away* contributes zero, never negative — a retreating attacker gets the floor, not a penalty.

The two channels are sampled at **different moments**, and this is a networking requirement, not a
preference.

```
vSelf  = attacker velocity at the attacker's BACKDATED PRESS TIME     → distance
vClose = attacker velocity + victim velocity at the CONNECT TICK      → impact
```

**`vSelf` is backdated to the press.** The server drains inputs when packets arrive
(`index.js:498-512`); there is no input rewind. A player on 120 ms RTT who commits a slap at 2.3
velocity will have that input executed several ticks later, by which point the server has decayed
their slide. Under the current binary model that reads as "my hit whiffed" — legible. Under a
continuous model it would read as "my perfect read paid 60%," which is invisible and unfixable
from the player's side.

Backdating solves it, and **the mechanism already exists and already ships**:
`lagCompensatedFromPress` (`gameUtils.js:394-404`) reconstructs true press time from client event
timestamps plus a clock offset, capped RTT-aware by `getPlayerInputBackdateCapMs`
(`gameUtils.js:346-352`) and clamped against replay by `clampTrustedPressGameTime`
(`gameUtils.js:376-392`). It is currently wired only to parry.

The *momentum* half also already exists: `slapEntryAligned` (`gameFunctions.js:982`) snapshots the
attacker's carried velocity at slap press and consumes it later in `processHit`. The comment at
`gameFunctions.js:966-970` reasons through exactly this problem. Both halves are built; they have
simply never been combined or generalised beyond the slap.

Implementation: a per-player **velocity ring buffer** of ~20 ticks (one scalar per tick, ~20
floats per fighter) so the connect handler can answer "what was this fighter's velocity at
backdated time T." This is dramatically cheaper than rollback — no position history, no
resimulation, no snapshots.

**`vClose` is sampled at the connect tick, on server truth, no backdating.** Backdating the
*victim's* state to the attacker's press would hand the attacker a rewind advantage over a
defender who has no equivalent. Sampling it live is correct and safe, because this channel decides
hitstop and posture — feel and attrition — not distance. **The channel that decides the round is
latency-fair; the channel that is latency-sensitive does not decide the round.**

#### Backdate cap for momentum

`MAX_PARRY_BACKDATE_MS` is 120 ms (`constants.js:743`) because a parry is a timing window that
needs the full envelope. Momentum does not: ice velocity is a slow signal, decaying 1.8% per tick
at `ICE_COAST_FRICTION`. Use a separate, tighter cap:

```
MAX_MOMENTUM_BACKDATE_MS = 48        // ~3 ticks; enough for throttle + one tick + slack
```

This matters because backdating gains a new abuse surface once it gates *damage output* rather
than only parry timing: during a decelerating slide, an older press time means a faster claimed
velocity. At the 120 ms parry cap a maximally-backdated claim buys ~15% velocity, which the `^1.5`
curve amplifies to roughly **+23% distance** at the top of the range. At 48 ms it is under 7%,
which is inside the noise floor. The existing monotonic watermark already blocks replaying stale
presses.

---

## 3. Applying the impulse

The victim's own inbound momentum has to be paid for. Rather than modelling elastic collision,
split by sign — it produces both behaviours we want and stays readable. Everything is tracked as
**distance still owed**, not velocity, so the authored number stays the number:

```
send  = transfer(vSelf, floor, ceiling)      // px, always directed away from attacker
owed  = distance the victim's current knockback has left to run

if victim was already fleeing:
    total = min(owed × (1 + COMPOUND_GAIN) + send, MAX_SEND_PX)   // COMPOUNDS
else (closing, or still):
    total = send                                                   // stopped and reversed
```

```
MAX_SEND_PX   = 380     // no chain exceeds the biggest authored hit by much
COMPOUND_GAIN = 0.15    // texture knob for how much a barrage snowballs
```

`MAX_SEND_PX` sits above the largest single hit (charged, 340) and below centre-to-dohyo-edge
(390), so sustained pressure can finish but cannot spiral. `COMPOUND_GAIN` is deliberately small:
adding the owed distance already accelerates the victim ~1.5x over a barrage, and the whole point
of this system is that mashing must not become dominant.

### 3.1 Compounding, worked

This is the tsuppari rhythm. Slap floor `send = 40 px`. A slap cycle is `SLAP_TOTAL_MS` = 260 ms =
16.64 ticks, over which owed distance decays by `0.93^16.64` = **0.299**.

| Slap # | Owed after impulse (px) | Ground covered that cycle (px) |
|---:|---:|---:|
| 1 | 40.0 | 28.0 |
| 2 | 53.8 | 37.7 |
| 3 | 58.5 | 41.0 |
| 4 | 60.1 | 42.1 |
| ∞ | **61.0** (steady state) | **42.7** |

Steady state solves `X = X × 0.299 × 1.15 + 40` → `X = 61.0 px`.

Centre to rope is 297.5 px, so an unbroken tsuppari barrage walks a passive fighter out in
**~7 connected slaps ≈ 1.8 s**, and a DI-ing one in **~11 slaps ≈ 2.8 s**. Flight speed grows
about 1.5x across the barrage, so the slide visibly accelerates rather than plateauing.

That is the correct shape. Slap pressure *walks* someone out — it never blasts them out — and
flat-footed slaps converge well below ring-out distance on their own, so pressure alone cannot
finish. You need a real read to convert. The victim's counterplay is to stop being a passive
target, which means committing to movement, which is exactly when pulls and closing-speed hits
become available against them.

### 3.2 The granted-velocity guard

A slap pushes the **attacker** forward on hit (`SLAP_ONHIT_ATTACKER_PUSH`, the chase/glue push),
and the knockback handoff feeds leftover velocity into `movementVelocity`. If that engine-granted
velocity counted toward `vSelf`, every landed hit would make the next one stronger.

Solving that fixed point diverges: with the chase tracking the victim at 1.15x, a flurry pins the
send cap within about four hits and mashing becomes the dominant strategy — the exact degenerate
this system exists to remove.

**Rule: momentum must be EARNED by moving, never GRANTED by landing a hit.** Engine-granted
velocity is recorded (`creditGrantedVelocity`) and subtracted when sampling `vSelf`. It still moves
you; it just cannot be spent as offence.

Two consequences worth stating:

- The victim side needs no guard. Knockback points *away* from the attacker and `vSelf` only counts
  velocity moving *toward* the opponent, so sign already excludes it.
- Because the slap slide ignores movement input (`index.js:3596-3633`), a fighter mid-flurry has no
  earned momentum at all — every flurry slap pays the floor. To throw a heavy slap you must break
  off, rebuild speed, and re-engage. That is the intended rhythm: **pressure to chip, commitment to
  convert.**

`vClose` deliberately does *not* subtract granted velocity. A fighter shoved into a second hit
really is arriving fast and that collision really should freeze harder. It cannot be farmed,
because the impact channel awards no distance.

---

## 4. Move table

Authored in **pixels actually delivered** against a victim holding nothing. A DI-ing victim eats
65% of these (`× 0.653`). Ceilings assume `vSelf = 2.4`.

| Move | Floor | Ceiling | Floor (DI'd) | Ceiling (DI'd) | Ceiling vs half-ring | Contested? |
|---|---:|---:|---:|---:|---:|---|
| Slap | 40 px | 200 px | 26 px | 131 px | 67% | yes |
| Palm thrust | 90 px | 300 px | 59 px | 196 px | 101% | yes |
| Charged headbutt | 70 px | 340 px | 46 px | 222 px | 114% | yes |
| Body slam / dive | 85 px | 330 px | 55 px | 215 px | 111% | yes |
| Grab **DRIVE** | 30 px | 300 px | — | — | 101% | **no** |
| Grab **PULL** | 40 px | 290 px | — | — | 97% | **no** |
| Grab **THROW** | 90 px | 230 px | — | — | 77% | **no** |

Compare against today, both columns, since a single number was never the truth:

| Move | Today (passive) | Today (DI'd) | Proposed (passive) | Proposed (DI'd) |
|---|---:|---:|---:|---:|
| Slap | 149 px | 25 px | 40 → 200 px | 26 → 131 px |
| Palm thrust | 385 px | 107 px | 90 → 300 px | 59 → 196 px |
| Charged @100% | 340 px | 165 px | 70 → 340 px | 46 → 222 px |
| Body slam | 398 px | 139 px | 85 → 330 px | 55 → 215 px |
| Grab DRIVE | 110–155 px (guaranteed) | same | 30 → 300 px (guaranteed) | same |

The floors barely move against a *competent* defender — today's DI'd slap is 25 px and the new one
is 26 px. What changes is that the number stops depending on whether the opponent has learned a
habit you cannot see, and that momentum finally buys the ceiling.

### 4.1 Contested vs guaranteed — the grab's reason to exist

Strikes are contested; a carried fighter has no DI, so grabs deliver exactly what they say.

That, not raw distance, is the grab's identity next to a cheaper and faster palm thrust. A maxed
palm sends 300 px or 196 px depending on whether they hold back. A maxed drive sends 300 px, full
stop. **The guarantee is worth ~104 px**, and it is what justifies the drive costing 8 stamina and
690 ms against the palm's 4 and 180 ms.

This also corrects the original audit, which claimed the drive was the weakest ring-out tool in
the game. That comparison used the palm's *passive* number. Against a defender who DIs — including
this game's own HARD+ CPU, which always holds the correct opposite (`cpuAI.js:1489`, `:1882`) —
the drive already out-positions the palm today. The grab's real problem was never distance; it was
paying twice the cost for the same ground, with no defender interaction to justify the price.

### 4.2 Slap across the speed range

| Attacker state | `vSelf` | Sends (passive) | Sends (DI'd) |
|---|---:|---:|---:|
| Standing jab | 0.00 | **40 px** | 26 px |
| Walking in | 1.30 | **104 px** | 68 px |
| Sliding, partial commit | 1.80 | **144 px** | 94 px |
| Full slide into contact | 2.40 | **200 px** | 131 px |

Same button, same animation, 5× spread, decided entirely by the ten frames before the press. This
is where the skill expression lives — and unlike the legacy spread, it is a gradient the *attacker*
controls rather than one the defender's habits impose.

---

## 5. Impact — the second channel

Distance comes from `vSelf`. **Feel and posture come from `vClose`.** A head-on collision does not
send anyone far — physically, two masses meeting cancel — it freezes the screen and wrecks
posture. This is what makes the tachi-ai read for something without breaking the distance economy.

```
V_IMPACT_REF = 3.7        // slide max 2.4 + walk-in 1.3, the hardest collision available
impact       = clamp(vClose, 0, V_IMPACT_REF) / V_IMPACT_REF
```

### 5.1 Hitstop

```
hitstop = HITSTOP_FLOOR + (HITSTOP_CEIL − HITSTOP_FLOOR) × impact
HITSTOP_FLOOR = 45 ms
HITSTOP_CEIL  = 260 ms
```

| Collision | `vClose` | Hitstop |
|---|---:|---:|
| Standing jab on a standing target | 0.0 | 45 ms |
| Walk-in on a standing target | 1.3 | 121 ms |
| Full slide onto a standing target | 2.4 | 184 ms |
| Both committed, head-on | 3.7 | **260 ms** |

Replaces the fixed ladder (`HITSTOP_SLAP_MS` 70, `HITSTOP_BURST_MS` 160,
`HITSTOP_CHARGED_MIN/MAX` 160/280). Hitstop stops being a property of *which move* and becomes a
property of *how hard the collision was*, which is the whole point of a single language.

### 5.2 Posture

```
postureChip = POSTURE_CHIP_FLOOR + (POSTURE_CHIP_CEIL − POSTURE_CHIP_FLOOR) × impact
POSTURE_CHIP_FLOOR = 4
POSTURE_CHIP_CEIL  = 30
```

This revives a dead system. Today reaching the lethal line costs 85 balance against 35/sec regen
after a 1.75 s delay — roughly 3.2 seconds of completely unbroken pressure, which a 5-second bout
never produces. Posture effectively never breaks, which is why `CMD_DRIVE_DISTANCE_MAX = 250` has
never fired in a real match.

Under this model **three hard collisions break posture** while twenty standing pokes do not.
Posture becomes what it should have been: the record of how many real reads you have lost.

Recommended companion change: `BALANCE_REGEN_PER_SEC` 35 → **22**, `BALANCE_REGEN_DELAY_MS`
1750 → **2000**, so a broken posture is a state you have to survive rather than one that
evaporates.

### 5.3 Posture as a multiplier, not a distance source

`postureScaled()` currently *is* the distance function for grabs. It stops being that. Posture
becomes a multiplier on the transfer result:

```
postureMult = lerp(1.0, 1.35, brokenness)      // brokenness = 1 at the lethal line
J *= postureMult
```

A battered fighter travels further from the same input, but the input still has to be earned with
speed.

---

## 6. Grabs

The three variants stop being three flavours of the same shove and become a genuine triangle,
because each one spends a **different fighter's** momentum.

### 6.1 DRIVE — spends your momentum

```
vEffective = max(0, vGrabber − DRIVE_COUNTER_CHARGE × vVictimClosing)
DRIVE_COUNTER_CHARGE = 0.6

carry = transfer(vEffective, 30 px, 300 px) × postureMult
```

| Grabber | Victim | `vEffective` | Carry |
|---|---|---:|---:|
| Standing | Standing | 0.00 | **30 px** |
| Walking in | Standing | 1.30 | **138 px** |
| Full slide | Standing | 2.40 | **300 px** |
| Full slide | Counter-charging at 2.4 | 0.96 | **98 px** |

A standing grab is worth 30 px. It is not a threat, so spamming it costs 8 stamina to accomplish
nothing — **spam stops being good without needing a cooldown to stop it.** A full-slide drive is a
round-ender from the centre of the ring, which is the payoff the mechanic has always deserved.

The counter-charge term is what stops DRIVE from being universally correct: driving into a fighter
who is charging back at you is driving into their force, and it barely moves them.

### 6.2 PULL — spends *their* momentum

```
launch = transfer(vVictimClosing, 40 px, 290 px) × postureMult
```

| Victim's approach | Launch |
|---|---:|
| Standing | **40 px** — a side switch and nothing more |
| Walking in | **140 px** |
| Full slide in | **290 px** |

Against a stationary opponent, PULL spends its full ~760 ms commitment to trade sides. Against a
committed charge it launches them the width of the half-ring, past you, having also taken the
side. This is hatakikomi, and it is the reason a fast approach cannot be the universal answer.

### 6.3 THROW — the neutral option

```
arc = transfer(vGrabber, 90 px, 230 px) × postureMult
```

Highest floor, lowest ceiling, least speed-dependent. The option you take when you have not earned
a momentum advantage and want a guaranteed reset plus posture chip.

### 6.4 The loop

| If your opponent is… | …the answer is | because |
|---|---|---|
| Passive / turtling | **Slap pressure** | compounding drift walks them out at 35 px a slap |
| Charging at you | **PULL** | their closing speed is the launch |
| Retreating or planted | **DRIVE** (with speed built) | your speed is the carry |
| Pulling | **Patience** | an unpaid pull is a ~760 ms whiff |

Four nodes, one language, no new buttons. Every edge is a statement about momentum.

---

## 7. Block and parry

Correcting an earlier assumption: there is no brace mechanic in this game. Block is the tail of the
parry system — a failed parry attempt, not heavily punished, and the blocking fighter still eats
knockback. That does not need a new button. It needs a momentum-native job.

### 7.1 Block

Block already zeroes your movement (`gameUtils.js:665-666`), which under this model means **block
is the footing option by construction**: you cannot be sent far while planted, and you also cannot
build the speed that makes you dangerous.

```
BLOCK_TRANSFER_RESIST = 0.45           // impulse multiplier while blocking
J *= BLOCK_TRANSFER_RESIST
```

A blocked slap sends 16 px instead of 35. A blocked full-slide palm sends 135 px instead of 300.
Blocking never stops the drift, it halves it — so turtling on ice is a way to lose slowly, which
is the correct value for it. It buys time and costs ground, and it remains open to grabs.

### 7.2 Parry

Parry refuses the transfer outright and returns a share of the closing energy:

```
riposte = PARRY_RETURN × vClose
PARRY_RETURN         = 0.55
PERFECT_PARRY_RETURN = 0.85
```

The reward scales with what the attacker committed. Parrying a standing jab returns almost nothing
(there was nothing to return). Perfect-parrying a full-commitment slide charge returns
`0.85 × 3.7 = 3.15` velocity — over 500 px — and is a round-ending read.

This is the correct risk curve, and it is the same curve as everything else: **the harder someone
commits, the bigger both the payoff and the punish.**

---

## 8. Dodge

Under the current landing rules a dodge *creates* momentum out of nothing:
`DODGE_LANDING_MIN = 1.1` guarantees a slide floor regardless of entry speed
(`constants.js:1663-1666`), which is how one dodge refunds 281 px (94% of the half-ring).

Dodge should **preserve** momentum, never mint it:

```
landingVelocity = dodgeEntrySpeed × DODGE_INHERIT
DODGE_INHERIT = 0.85
```

`DODGE_LANDING_BASE`, `DODGE_LANDING_MIN`, `DODGE_LANDING_MAX` and `DODGE_SLIDE_MOMENTUM` are
deleted. A dodge from standstill now covers ~85 px of travel and lands flat, instead of covering
104 px and then sliding another 177. A dodge out of a full slide keeps most of the slide, which is
the movement-tech payoff worth having.

This is also what makes retreat cost something. Escaping is still possible; escaping *for free*
is not.

---

## 9. What this deletes

The point of a single language is that most of the special cases stop being necessary.

**Kill bands and rope clamps — the entire "armed / not armed" concept.** If you have the momentum
to send someone past the rope, they go past the rope. Nothing else is needed.

- `SLAP_KILL_RANGE` (`constants.js:268`), `SLAP_ROPE_RESIST_BUFFER` (`:272`), `slapKillBand()`,
  `slapKnockbackCanRingOut`, the clamp at `index.js:1316-1325`
- `CHARGED_KILL_REACH_MIN/MAX/CAP` (`:1545-1549`), `chargedKillReach()`,
  `chargedKnockbackCanRingOut`, the clamp at `index.js:1334+`, and the midscreen deadzone
- `CHARGED_KILL_MIN_CHARGE` (`:1525`), `CHARGED_KILL_READ_MIN_CHARGE` (`:1526`),
  `CHARGED_KILL_EDGE_ZONE` (`:600`)
- `CMD_DRIVE_EDGE_FORCE_OUT_FRACTION` (`:1446`) and `cmdGrabEdgeWaiver`

**Per-move knockback physics.**

- `isSlapKnockback` / `isBurstKnockback` / `isChargedKnockback` friction branches
  (`index.js:1274-1283`), `BURST_KB_FRICTION`, the `DI_FRICTION_BONUS` special case
- `SLAP_TRADE_KNOCKBACK`, `PALM_TRADE_*`, `CHARGE_CLASH_*` — trades resolve through the same
  transfer function with both fighters as attacker
- Fixed hitstop ladder: `HITSTOP_SLAP_MS`, `HITSTOP_BURST_MS`, `HITSTOP_CHARGED_MIN/MAX`

**The bolted-on momentum layer, now redundant.**

- `victimKbScale` (`:1652-1655`), `slapMomentumMult`, `K_SLAP_INHERIT`, `K_PALM_MATADOR`,
  `PALM_MATADOR_KB_CAP` (`:1685`)
- `MASTERY_P1_MOMENTUM` — it stops being a flag and becomes the game

**Authored grab distances.**

- `CMD_DRIVE_DISTANCE_MIN/MAX`, `CMD_DRIVE_APPROACH_REF_SPEED`, `CMD_DRIVE_APPROACH_BONUS_MAX`
- `CLINCH_PULL_DISTANCE_MIN/MAX`, `CLINCH_THROW_DISTANCE_MIN/MAX`
- `GRAB_PUSH_BURST_BASE` / `GRAB_PUSH_MOMENTUM_TRANSFER` (already dead, never removed)

**Dodge landing floors** — `DODGE_LANDING_BASE/MIN/MAX`, `K_DODGE_INHERIT`, `DODGE_SLIDE_MOMENTUM`.

---

## 10. Migration order

Each step is independently playable and independently revertable. Do not batch them.

1. **Fix the handoff and add `KB_FRICTION`.** Collapse the three knockback frictions (0.97 / 0.982
   / 0.96) into one `KB_FRICTION` (0.93), and make `endHitKnockback` distance-preserving via
   `handoffVelocity` instead of assigning raw velocity across channels. No authored value changes.
   Play a set — this alone tightens the DI spread from 3.6–6x down to ~1.5x, and it is the change
   most likely to reveal that some existing numbers were only ever tuned around the leak.
2. **Add `transfer()` and convert the slap only.** Floors and compounding live. Every other move
   keeps its current constant. This isolates the two riskiest ideas — the curve and the
   compounding cap — in the move you throw most.
3. **Split the impact channel.** Hitstop and posture chip move onto `vClose`. Distance untouched.
4. **Convert palm, charged, body slam** to the transfer curve.
5. **Convert DRIVE / PULL / THROW,** including the counter-charge term.
6. **Delete the kill bands and rope clamps.** Ring-outs become emergent. Expect this to be the
   step where bouts get dramatically more decisive at the edges.
7. **Dodge to pure inheritance.**
8. **Block resist and parry riposte.**
9. **Latency hardening.** Add the per-player velocity ring buffer, generalise
   `lagCompensatedFromPress` beyond parry, and route `vSelf` through it with
   `MAX_MOMENTUM_BACKDATE_MS`. Extend the client-prediction knockback suspension to cover momentum
   sends. Ship-blocking for online, but deliberately late — the model has to be proven fun on LAN
   before it is worth hardening.
10. **Retune bout structure** — timer 60 s → ~30 s, live hantei readout on screen.
11. **Retrain the CPU**, including routing its `vSelf` through a synthetic-RTT backdate so it does
    not read momentum more precisely than a human can. It currently plays a distance-agnostic game
    and will be badly wrong here.

Step 2 is the decision point. If the slap does not feel dramatically more expressive with nothing
else changed, the model is wrong and the rest should not be built.

---

## 11. Risks and open questions

**Runaway compounding.** Mitigated by `MAX_SEND_PX` plus the granted-velocity guard (§3.2), and
flat-footed slap steady state (61 px owed) sits well under it. Covered by
`test/momentum/transfer.test.js`, including a regression test that demonstrates the divergence the
guard prevents. Worth re-checking once palm and charged pressure can chain.

**Camera.** 300 px sends against a 595 px ring will need camera work that the current follow logic
probably does not have. Ring-outs will read badly before this is addressed.

**Netcode desync — investigated, and much smaller than first assessed.** The concern was that
momentum-dependent outcomes require rewinding velocity alongside position. That failure mode
requires *partial* lag compensation, and this codebase has none to be partial with. There is a
single 64 Hz authoritative sim; `checkCollision` / `processHit` run once, on current server state,
with no spatial rewind, no rollback, and no client-side hit resolution (client prediction is
scoped to local ground movement and cosmetic poses — `movementPredictor.js:10-17`). Both fighters'
velocities are therefore read from the same tick **by construction**, and both clients receive the
same authoritative `player_hit`. `movementVelocity` and `knockbackVelocity` are already on the
delta wire (`constants.js:59-65`), so clients can render momentum state today.

The residual risk is **fairness under latency, not divergence** — see §2.1. It is handled by
backdating `vSelf` with machinery that already ships for parry, and it is structurally bounded
because distance depends only on the attacker's own state.

**Client prediction snap threshold.** The movement predictor hard-snaps at 80 px
(`movementPredictor.js`), and deliberately does not model knockback. A 300 px send is well past
that threshold. Knockback already routes through interpolation rather than prediction, and
prediction already suspends for `slapParryKnockbackVelocity` (`constants.js:60-62`) — the same
suspension needs to cover momentum knockback, or the local fighter will visibly teleport on big
hits.

**PvE fairness.** The CPU runs inside the same server tick loop with no socket
(`index.js:572-600`), so its inputs execute same-tick with a perfect velocity sample while a human
gets a backdated one. Left alone, the CPU will make momentum reads no human can. Its existing
0–55 ms reaction jitter is the right tool, but it has to be applied to *momentum commitment*, not
only to reaction timing — sample the CPU's `vSelf` through the same backdate path with a synthetic
RTT.

**Bout length may overshoot.** Target is 15–25 s, up from a 5 s median. If bouts run long, raise
floors before lowering ceilings — the ceilings are where the expressiveness lives.

**Readability of `vClose`.** Players need to *see* momentum to make reads about it. Snow spray
scaled to speed, motion trails, and stance-lean at the moment of commitment are not polish here;
they are the interface for the entire mechanic.

**Charged headbutt overlap.** With slaps and grabs both scaling on momentum, the charged headbutt's
583 px lunge at full charge needs re-examining. It may want to become a pure momentum *generator*
— an attack that buys speed rather than one that carries its own — but that is a separate design
question.

---

## 12. Invariants this must uphold

Additions to `COMBAT_INVARIANTS.md` if this ships.

1. **No chain of hits may send further than `MAX_SEND_PX`.** Sustained pressure can finish; it can
   never spiral.
2. **Exactly two horizontal decay channels exist** — `KB_FRICTION` for shoves and
   `COAST_FRICTION` for free glide — and **every crossing between them is distance-preserving**
   (`handoffVelocity`). A velocity must never change how far it travels by changing channel. Any
   move that wants a third decay curve is a design failure, not a tuning need.
2b. **Authored distances are what a hit delivers**, not an upper bound a defender can erase. DI
   scales delivered distance by `diDistanceRatio()` (~0.65) and nothing else may compound on top of
   it. If a defensive option ever removes more than ~40% of a send, the number stops being
   designable.
3. **Distance is a function of `vSelf` only. Impact is a function of `vClose` only.** Anything that
   wants to change both is asking for a new move, not a new coefficient.
4. **Impulse adds to a fleeing victim and replaces a closing one.** Compounding is a feature and
   must survive refactors.
5. **Every floor is reachable from standstill; every ceiling requires `V_REF` approach speed.** No
   move may reach its ceiling without a committed slide.
6. **Ring-out is emergent.** No move carries a kill flag, kill band, or ring-out permission. If the
   momentum carries them out, they go out.
