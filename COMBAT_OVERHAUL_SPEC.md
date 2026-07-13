# COMBAT OVERHAUL — The Ender Seam, Spam Economics, Corner Economy & AI Identity

> **How to use this doc:** This is the source-of-truth spec for overhauling PenguinPow's core
> combat loop. It is written so a fresh AI agent (or future you) can implement it with no prior
> context. Work is split into **4 phases + an optional prep pass** — implement ONE phase per
> session/PR, playtest, then move on. Each phase is independently shippable and leaves the game
> better than it was. Read **Design Principles** and **Guardrails** before writing any code.
>
> Origin: a full design evaluation found that the mouse1 slap string is the only tool requiring
> no prediction, no meaningful resource, and no timing — while every answer to it requires all
> three. Once slap1 confirms, ~900ms of gameplay is autopilot for both players. The CPU mirrors
> the same slap-forward plan at every rank. These phases fix that loop at the root.

---

# ⚠️ SLAP REWORK (July 2026) — SUPERSEDES THE STRING & THE ENDER SEAM

> The slap string, enders, and the ender seam were **removed from the game entirely**. Playtesting
> after Phase 1 showed the string — even with the contestable seam — kept the slap as THE answer to
> almost every situation, centralizing the game around hit-confirm strings instead of sumo. The fix
> went deeper than the seam: the string itself is gone. **Phase 1 of this spec is dead** (the seam,
> the just-frame ender, the grab ender, string latching); the seam-dependent parts of Phases 3–4
> (seam wakeup policies, ender memory reads, `seamMixups` kit verb) are dead with it. Phase 2
> (whiff economics, read-gated charged kills), Phase 3's corner economy, and Phase 4's difficulty
> curve / archetype policies at the corner and clinch all still stand.

## The slap as it exists now: individual presses, +0 on hit

Each mouse1 press is one self-contained slap. There is no string position, no chaining bonus, no
ender, and no combo — every press is contestable by the opponent.

**Per-press frame data** (`constants.js`):
- 55ms startup / 100ms active / 75ms recovery ≈ **230ms cycle** (`SLAP_TOTAL_MS`). Cost 3 stamina
  (6 gassed). Press lunge unchanged.
- `slapAnimation` alternates 1 ↔ 2 purely cosmetically — both slaps are mechanically identical.
- One press may buffer during a slap (`pendingSlapCount` cap = 1) so mash never drops a beat.

**On hit — exactly +0 frame advantage:**
- Victim hitstun = the attacker's remaining lockout at the moment of connect
  (`attackerFreeAt - now`, floored at `SLAP_MIN_HITSTUN_MS = 60`). Both players become actionable
  on the same frame; nothing combos for free. Victim input lock matches the hitstun.
- Hitstop: one flat symmetric **70ms** (`HITSTOP_SLAP_MS`) — sim clock pauses for both, so the +0
  math is untouched by the freeze.
- Ground transfer: attacker slides `SLAP_ONHIT_ATTACKER_PUSH = 1.0`, victim drifts
  `SLAP_ONHIT_VICTIM_DRIFT = 1.15`. The victim loses ground on every hit and the gap self-spaces
  after 2–3 consecutive slaps — the slap pays in **position**, the game's real currency.
- Victim chip: −8 stamina, −8 balance per hit (unchanged).
- Ring-out only within `SLAP_KILL_RANGE` (45px) of the boundary; otherwise the 12px rope clamp
  catches them. No bypasses.

**Counter hit on a slap (mechanical, kept):** ×1.25 knockback (`SLAP_COUNTER_KB_MULT`, tune up
toward 1.5 if it reads weak) + flat **+35ms** hitstun (`SLAP_COUNTER_HIT_BONUS_MS`) — a small,
honest reward for interrupting startup/commitment, enough to press position but not a free combo.

**Punish (game-wide, label only):** the PUNISH banner still fires, but the ×1.25 knockback, the
×1.4 stun, and the rope-clamp bypass are all **removed**. Punish tells the players what happened;
it no longer changes what happens.

**Whiff cooldown (replaced Phase 2's whiff economics):** the "2 whiffs → 300ms committed pause +
3 stamina surcharge" was built to price string spam and is gone. Instead every WHIFFED slap holds
its recovery slightly longer (`SLAP_WHIFF_EXTRA_RECOVERY_MS = 45`: 75 → 120ms, cycle 230 → 275ms).
Spam is allowed — but landing hits keeps your rhythm faster than swinging at air, and a whiffed
slap gives a slightly wider reactive punish window without any hard lockout.

**Kept deliberately:** the slap parry clash (simultaneous slaps), grab startup armor vs slaps,
the desperation-context counter-slap value via counter hits, and `slap_burst` as the CPU's flurry
behavior (a burst of individual contestable presses — not a string).

**Deleted with the string** (for future readers wondering where things went): string
position/window/buffer chaining, hit-confirm gating, the seam + its 140ms slap2 freeze, earned
strings and counter/punish latches, the grab ender, the just-frame ender + its lag compensation,
the slap3 burst + `slapAnimation 3` palm-pose path, the desperation 45ms wakeup startup, the hit1
attacker hitstop relief, per-position hitstop tiers, CPU string commitments + seam wakeup +
ender-memory, and the client seam cue / perfect-ender FX / `stringPos` routing. Palm thrust keeps
its burst knockback and now owns the heavy `HITSTOP_BURST_MS` (200ms) freeze.

---

## 1. Vision (one paragraph)

The slap string stays the metronome of the game but stops being the win condition on its own.
Mid-ring strings become a **decision moment for both players** (the "ender seam"), kills trace
back to **reads** (counter-hits, punishes, corners, gassed opponents) instead of raw mash, corner
escapes stop being **full positional refunds**, and the CPU roster gains **legible identities,
memory, and a smooth difficulty curve**. Mash must always complete; precision must always pay.
Premium feel = every added millisecond lives inside hitstop, never inside recovery.

---

## 2. DESIGN PRINCIPLES (read first)

1. **Time inside hitstop reads as impact; time in recovery reads as sluggishness.** When a moment
   needs more decision room, extend the freeze, not the endlag.
2. **Position is this game's only persistent damage.** Any mechanic that refunds position for a
   few stamina is a "full heal" and must be priced accordingly. Reads must pay out in position,
   not just resource chip.
3. **Reads buy kills; mash buys tempo.** Guaranteed round-enders must always trace to a read
   (counter/punish opener, cornered victim, gassed victim) — never to neutral spam.
4. **Mash always completes, precision always pays.** A button-masher must never drop the basic
   string (accessibility); a precise player must always get visibly/mechanically more (depth).
5. **The CPU may only act on humanly observable information** — revealed frequencies and
   telegraphs, never current-frame input reading. (The existing jitter/miss architecture already
   embodies this; extend it, don't bypass it.)
6. **Legibility lives at decision moments, not aggregate probabilities.** AI personality must
   express itself where the player is watching: the ender seam, the corner, the tachiai, the
   clinch — not as ±20% on buried dice rolls.

---

## 3. GUARDRAILS

1. **Phases 1–2 intentionally change shared combat math for ALL modes** (PvP, VS CPU, BASHO).
   This is the opposite of the BASHO_MODE_SPEC firewall — the combat rebalance IS the product.
   Fighter parity (both players identical except power-up pick) must be preserved everywhere.
2. **Phase 3 combat changes are shared; Phase 3–4 AI changes are per-context.** Classic VS CPU
   keeps its discrete difficulty select (HARD = legacy `AI_CONFIG` baseline). The continuous
   difficulty curve, curriculum kits, and memory system are **BASHO-gated** (via
   `room.cpuDifficulty` / `cpu.aiArchetype` — absent = legacy behavior, exactly like the existing
   personality firewall in `cpuAI.js` ~L260).
3. **Do not slow the global game down.** Slap startup (55ms), movement, dodge, string cadence on
   hits 1→2 — untouched. All added decision time comes from hitstop at exactly one moment (slap2
   connect).
4. **Hit1 → hit2 remains a true combo.** Only the 2→3 seam opens up, and only for un-earned
   (neutral) strings.
5. **The desperation counter-slap (45ms startup, `gameFunctions.js` ~727–733) is load-bearing**
   after Phase 1 — it is the "mash beats grab" leg of the seam RPS. Do not remove it.
6. **Every phase ships with its presentation cues.** A mechanic without its VFX/SFX/banner is
   not done — feedback is how players learn the new layer exists.

---

## 4. Current-State Primer (verified numbers, for context)

Arena: playable width **595px** (`MAP_LEFT_BOUNDARY` 340 → `MAP_RIGHT_BOUNDARY` 935,
`gameUtils.js` ~108). 64Hz sim; hitstop pauses the room sim clock (timers freeze in lockstep).

**Slap string today** (`constants.js` ~117–203, `gameFunctions.js` ~673–883,
`collisionSystem.js` ~1254–1637):
- Per slap: startup 55ms / active 100ms / recovery 75ms (pos1) or 50ms (pos2). Cost 3 stamina.
- Victim per hit: −8 stamina, −8 balance, 260ms stun (hits 1–2), hitstop 70ms (attacker
  unfreezes 20ms early via `SLAP_STRING_ATTACKER_HITSTOP_RELIEF_MS`).
- Hit-confirm string: advances only on connect; mashed presses buffer via `pendingSlapCount`
  (unbounded) and auto-chain; `pendingGrabEnder` (mouse2 during slap2 cycle) queues a grab ender.
- Slap3: 3.1 velocity burst ≈ 494px carry, no DI for 200ms, rope-clamped unless victim within
  `SLAP_KILL_RANGE` (45px) of the boundary in knockback direction OR the string is punish-latched
  (`effectivePunish` bypasses the clamp, `collisionSystem.js` ~1282–1286).
- Whiff rhythm: 2 whiffs → 220ms committed pause; buffered mash auto-resumes after the pause.
- Result: one confirmed string ≈ victim parked at the rope; the next confirmed string kills.

**Charged attack:** kill check `0.45 + charge^1.3 × 0.75 ≥ 1.0` feeding a trajectory sim
(`willGuaranteeRingOut`, `collisionSystem.js` ~89–106) that travels ~700px at full charge —
guaranteed midscreen ring-out at ~79% charge, ~56% on counter-hit, down to ~40–50% with BASHO
POWER stat + Power Water stacking (stat mods multiply into the same predictor, ~1241–1249).

**Defense vs the string:** parry = the only real answer (predictive stance, 12 stamina refunded
on success, loses to grab via counter-grab). Dodge has zero i-frames vs strikes. Sidestep beats
the string start but not slap3 mid-string. Gassed (stamina 0) = 5s with no dodge/sidestep/rope
jump (parry still works and is effectively free at 0 stamina).

**CPU:** one decision tree for all archetypes; personalities are probability multipliers only
(`PERSONALITY_PROFILES`, `cpuAI.js` ~269–309); close range resolves to slap on most rolls;
corner escape (Priority 2, ~L988–998, ~L1665–1745) rolls sidestep 25% / rope jump 28% **per
decision tick** → near-certain escape within a second; **palm thrust: zero references in
`cpuAI.js`** (never used); difficulty = 4 discrete tiers mapped per division
(`bashoConfig.js` ~326–388) with 3 divisions of EASY at the bottom.

---

# PHASE 1 — The Ender Seam ❌ (SUPERSEDED — see SLAP REWORK at the top; the string no longer exists)

**Intent:** turn the slap2→slap3 moment into the game's signature decision beat. Both players
choose during a big slap2 freeze; neutral strings become a 2×2 mixup; earned strings stay
guaranteed; a just-frame input makes the finisher a skill expression ("blue spark").

## 1.1 The decision freeze

| Change | From → To | Where |
|---|---|---|
| Hitstop on slap2 connect (both players) | 70ms → **140ms** (new `HITSTOP_SLAP_HIT2_MS`) | `collisionSystem.js` ~1466–1477 (split the `isChainableStringHit` branch by position) |
| Hitstop on slap1 connect | 70ms (unchanged, keeps `HITSTOP_SLAP_STRING_MS`) | same |
| Attacker hitstop relief | applies to **pos 1 only** (pos 2 freeze is symmetric) | `collisionSystem.js` ~1486–1494 |
| Slap3 finisher hitstop | 200ms (unchanged) | — |

The slap2 freeze is where both players pick their option. It reads as the heaviest mid-string
impact, not as lag — per Design Principle 1.

## 1.2 Contestable slap3 (neutral strings only)

New constant `SLAP_STRING_HIT2_STUN_MS = 180` (victim stun from slap2). Existing
`SLAP_STRING_HIT_STUN_MS = 260` continues to apply to hit 1 (keeps 1→2 a true combo) **and** to
hit 2 of an **earned** string.

**Earned string = the seam stays closed (260ms stun, slap3 guaranteed as today) when ANY of:**
- `slapStringCounterLatched` or `slapStringPunishLatched` (the string opened as a counter-hit or
  punish — latch already exists, `collisionSystem.js` ~758–774), OR
- victim `isGassed`, OR
- victim within `DOHYO_EDGE_PANIC_ZONE` (89px) of the boundary **in the knockback direction**
  (same measurement pattern as the `SLAP_KILL_RANGE` check, ~1282–1286).

Edit point: the hit-stun selection at `collisionSystem.js` ~1545–1560 — branch on
`stringPos === 2 && !earned`.

**Resulting seam timeline** (sim-time from slap2 connect ≈ C; hitstop is symmetric so it cancels
out of every margin):

| Sim time | Attacker | Victim (neutral string) |
|---|---|---|
| C+0 | slap2 connects, 140ms freeze both | 180ms stun starts |
| C+135 | actionable — ender window opens | still stunned |
| C+135..185 | **just-frame window** for perfect slap3 | still stunned |
| C+180 | — | actionable; buffered wakeup action fires frame 1 |
| C+190 | earliest slap3 connects | a buffered parry (from C+180) perfect-parries it |
| C+235 | — | buffered desperation slap (45ms startup) connects |
| C+315 | seam grab connects (180ms startup from C+135) | parry held from C+180 is still active → counter-grabbed |

**The 2×2 mixup this produces (all four interactions already exist in the engine):**

| | Victim: wakeup parry | Victim: wakeup mash (desperation slap) |
|---|---|---|
| **Attacker: slap3** | Parried (perfect window) — attacker eats 700ms stun + punish | Counter-hit slap3 — punish-latched, big carry |
| **Attacker: grab ender** | **Counter-grab** — parrier eaten, clinch with chipped balance | Slap clips grab startup — grab stuffed, counter-hit |

Victim's third option (buffered sidestep, 8 stamina) behaves like mash vs the grab (escapes, since
active i-frames beat grabs) and loses to immediate slap3 (counter-hit during 40–50ms startup) —
"mash with repositioning," acceptable redundancy. Passive/confused victims still eat slap3
(connects 10ms after their stun ends — only a buffered choice escapes), so **beginners feel no
change**; the layer only opens at intermediate play. Attacker's third option is walking away —
baiting a whiffed wakeup parry (−12 stamina, unrefunded) for a fresh punish opener.

**Seam grab rule:** a grab ender initiated from the string (`pendingGrabEnder` path,
`gameFunctions.js` ~784–801) carries **no slap-startup armor** (set `grabStartupArmorUsed = true`
on creation). It's a mixup tool, not a neutral grab; wakeup mash must cleanly beat it, or the 2×2
collapses. Neutral grabs keep their armor.

## 1.3 Input buffer restructure

| Rule | Change | Where |
|---|---|---|
| Mash buffer cap | `pendingSlapCount` clamps at **1** | `socketHandlers.js` mouse1 press handler (where `pendingSlapCount++` happens) |
| Whiff-pause auto-resume | **Removed** — buffered slaps are cleared when the pause triggers; a fresh press after the pause fires frame 1 | `gameFunctions.js` ~827–852 (delete the "resume the BOP-BOP rhythm" re-fire; keep the input-lock) |
| Ender buffer opens late | slap3 / grab-ender inputs only accepted from **slap2 connect** onward; earlier presses do not queue an ender | `socketHandlers.js` mouse1/mouse2 handlers + `pendingGrabEnder` set-site (gate on `currentSlapHitConnected` or connect timestamp for position 2) |
| Ender buffer closes | unchanged — `SLAP_STRING_BUFFER_WINDOW_MS` (300ms) after cycle end | — |

The point: the ender becomes a decision made **after seeing slap2 land** (during the freeze), not
a pre-loaded mash. Any accepted press must produce visible confirmation (see 1.6) so eaten early
presses never feel like dropped inputs.

## 1.4 Perfect-input finisher ("blue spark")

Slap3's burst velocity now depends on press timing (grab ender has no tiers — its reward is the
clinch):

| Press timing | Burst velocity | Presentation |
|---|---|---|
| Buffered during the freeze (before actionable, C+0..135) | `SLAP_HIT3_KB_VELOCITY_SLOPPY = 2.4` (~385px carry) | normal hit FX, slightly dulled SFX |
| **Just-frame: within `SLAP_ENDER_JUST_WINDOW_MS = 50` of becoming actionable** (C+135..185) | full `SLAP_HIT3_KB_VELOCITY = 3.1` (~494px carry) | **blue spark** VFX + distinct crack SFX |
| Late (after the window, within the 300ms string window) | 2.4 | normal |

- Judged on **press arrival vs actionable time** in sim-time, with lag compensation mirroring the
  parry pattern: backdate up to `MAX_ENDER_BACKDATE_MS = 120` toward the reconstructed client
  press moment (`lagCompensatedParryStart`, `gameUtils.js` ~178–185, `constants.js` ~499–506).
- The earned-string guarantee does NOT change the tiers — perfect timing pays everywhere.
- ~110px of carry difference is the mechanical stake; the spark is the psychological one.

## 1.5 Minimal CPU seam participation (ships WITH this phase — without it, BASHO never feels the change)

**As victim:** when the CPU eats slap2 of a *neutral* string (`lastHitByStringPos === 2`, seam
open), roll ONE wakeup option during the freeze, jittered by the existing reaction pipeline:

| Tier | Parry | Mash | Escape (sidestep) | Eat it |
|---|---|---|---|---|
| EASY | 10% | 15% | 5% | 70% |
| NORMAL | 20% | 20% | 10% | 50% |
| HARD | 30% | 25% | 10% | 35% |
| IMPOSSIBLE | 40% | 30% | 10% | 20% |

**As attacker:** the existing `STRING_GRAB_CHANCE` (25% slap-slap-grab commitment, `cpuAI.js`
~L94) already makes the CPU's ender a mixup; additionally, when the CPU's string is **earned**,
it must always take slap3 (free guaranteed finisher). No memory/adaptation yet — that's Phase 4.

## 1.6 Presentation cues (required)

1. **Seam-open cue** on slap2 connect: brief ring/flash on the attacker + a distinct "clack" —
   both players learn "the decision moment is now." (The `player_hit` payload already carries
   `stringPos`; key client FX off `stringPos === 2`.)
2. **Blue spark** on just-frame slap3: spark burst at the point of contact + unique SFX. Reuse
   the hit-FX pipeline (payload already supports styling flags like `isPowered`/`isArmorBreak` —
   add `isPerfectEnder`).
3. **Sloppy finisher** keeps current FX with a duller thud (contrast teaches the tiers).
4. **Counter-grab at the seam**: add a "CAUGHT!" side banner (reuse the counter/punish banner
   plumbing, `collisionSystem.js` ~1418–1439).
5. Buffered-ender acceptance: small input-icon flash on the attacker (client-side) so eaten
   early presses read as "queued," never as dropped.

## 1.7 Acceptance criteria

- Neutral string, victim buffers parry → slap3 is perfect-parried; grab ender counter-grabs that
  same parry; victim desperation slap stuffs the (armorless) seam grab; passive victim still eats
  slap3.
- Punish- or counter-opened strings, gassed victims, and edge-panic-zone victims are hit by
  slap3 exactly as today (260ms stun, no seam).
- Mashing mouse1 from round start completes full strings every time (cap=1 buffer never drops the
  chain on hit) but always produces the 2.4 sloppy finisher; a just-frame press produces 3.1 +
  spark. Whiff-pause no longer auto-resumes mashed slaps.
- PvP at 80–120ms ping: just-frame window judged on press time (backdating), no perceived eaten
  inputs.
- Hit1→hit2 remains inescapable in all cases. `SLAP_CHAIN_HIT_GAP_MS` / immunity behavior
  unchanged (no "phantom hit" regressions — see the comment at `collisionSystem.js` ~1259–1265).

**Out of scope:** whiff costs, charged gating, corner changes, AI memory/personality.

---

# PHASE 2 — Spam Economics & Read-Gated Kills ⚠️ (PARTIALLY SUPERSEDED — 2.1 whiff economics replaced by the per-press whiff cooldown, see SLAP REWORK; 2.2 read-gated charged kills still live)

**Intent:** make whiffing a *choice with a price* and tie every guaranteed kill to a read. The
palm thrust's anti-mash role strengthens automatically once whiffs cost real stamina.

## 2.1 Whiff economics

| Change | From → To | Where |
|---|---|---|
| Whiff pause duration | `SLAP_WHIFF_PAUSE_MS` 220 → **300** | `constants.js` ~151 |
| Whiff surcharge | new `SLAP_WHIFF_EXTRA_STAMINA = 3` — charged at cycle end when `!currentSlapHitConnected` (whiffed slap totals 6, landed slap stays 3) | `gameFunctions.js` cycle-end callback (~819+) |
| Whiff pause is a punish state | hits landed during `isSlapWhiffPausing` classify as **PUNISH** (banner + 1.25× + latch) | punish classification in `collisionSystem.js` (~700–775 latch area) — include the whiff-pause flag |

Rationale: the 220ms pause was designed so "a delayed punish arrives after you're actionable" —
that philosophy protects spam specifically. 300ms makes a *reactive* whiff punish possible;
the punish tag makes spacing pay in the game's real currency (punish-latched strings).

## 2.2 Read-gated charged kills

The cinematic kill (guaranteed midscreen ring-out + cutscene) becomes **conditional**. In
`processHit` (`collisionSystem.js` ~1347–1349), `isCinematicKill` additionally requires ANY of:

- `isCounterHit` or `isPunish`, OR
- victim within `DOHYO_EDGE_PANIC_ZONE` of the boundary in knockback direction, OR
- victim `isGassed`.

**Neutral midscreen charged hits** (any charge %) instead deliver their knockback under the rope
clamp: extend the boundary-clamp block (`index.js` ~993–1002, currently gated on
`isSlapKnockback && !slapKnockbackCanRingOut`) to cover charged knockback when the kill
conditions are not met — victim slams TO the rope (12px buffer) instead of through it. A full
charge from center still converts ~half the arena and parks them in the panic zone (where the
next confirmed string/charge IS earned) — the payoff moves one read later, it doesn't disappear.

BASHO note: no predictor cap needed — POWER stat / Power Water stacking can no longer buy neutral
one-shots (the gate is read-based, not number-based); on counter/punish, stacked power killing
easier is earned and correct.

## 2.3 Acceptance criteria

- Two whiffed slaps cost 12 stamina total and end in a 300ms pause during which any hit shows the
  PUNISH banner and latches through the follow-up string.
- A neutral 100% charge from center ring never ends the round outright; the same hit as a
  counter-hit / punish / vs a gassed or panic-zone victim produces the cinematic kill exactly as
  today.
- `CHARGE_PRIORITY_THRESHOLD` trades, palm thrust, at-the-ropes self-lunge behavior: unchanged.

**Out of scope:** desperation slap tuning (load-bearing, untouched), grab changes, AI.

---

# PHASE 3 — Corner Economy & Escape Reads ✅ (STILL LIVE — seam-math notes in 3.1 are moot; the seam is gone)

**Intent:** escapes still save your life but stop refunding the whole war; reading an escape pays
in position; the AI stops treating the corner as a scripted exit and starts *fighting* there —
including with the palm thrust it currently never uses.

## 3.1 Escape refund reductions (shared combat)

| Change | From → To | Where |
|---|---|---|
| Rope jump landing point | 52% toward center → **33%** (new `ROPE_JUMP_CENTER_FRACTION = 0.33`, replaces the inline `0.52`) | `socketHandlers.js` ~1132–1140 |
| Sidestep travel when starting inside the edge-panic zone (89px) | 160px → **110px** (new `SIDESTEP_TRAVEL_EDGE`) | travel selection where the arc starts, `index.js` ~1831+ |
| Sidestep startup (global) | 40ms → **50ms** | `constants.js` ~291 |

Startup note: 40ms was tuned for the old slap2→grab option-select escape (`constants.js`
~285–290). Phase 1 rebuilt that seam (buffered wakeup sidestep enters i-frames at C+230, well
before the seam grab at C+315), so 50ms is safe there — and it makes a *predicted* corner
sidestep actually clippable. Verify the seam math after changing (acceptance test below).

## 3.2 Read conversion: catching the escape

When a grab **connects** on a victim in `isSidestepRecovery` or rope-jump `landing` phase:
- clean connect (no tech possible — they're in recovery, and mutual-startup tech can't apply),
- Phase A burst gets a momentum floor: `grabApproachSpeed = max(actual, GRAB_CATCH_MIN_BURST_SPEED = 1.5)`
  so the burst-push carries them back cornerward hard (burst = `2.5 + approach × 0.6`,
  `grabActionSystem.js` ~165–268).

This is the "caught the henka" moment — a read-timed grab (grab startup 180ms vs 150–183ms
recovery windows means it must be input predictively, which is correct: reads should be reads).
Slap-punishes on escape recovery already punish-latch (Phase 2 made that matter more).

## 3.3 CPU corner behavior (shared `cpuAI.js`, applies to all modes on the existing corner path)

1. **Kill the compounding roll.** Corner escape rolls convert from per-decision-tick to
   **per-corner-entry + cooldown**: one escape decision when the cornered state begins, then a
   `CORNER_DECISION_COOLDOWN_MS = 1500` before re-rolling. (Pattern to reuse anywhere a
   per-tick `chance()` guards a rare action.)
2. **Escape budget:** `AI_CORNER_ESCAPE_BUDGET = 2` sidestep/rope-jump escapes per round
   (aiState counter). Budget exhausted → corner answers only.
3. **Corner answers menu** (replaces "always flee"): fight out with slaps/clash, **palm thrust**
   ("get off me"), parry, plant/crouch, grab. Baseline weights (personality-flavored in Phase 4):
   escape 35% (if budget) / palm 20% / parry 15% / fight 20% / grab 10%.
4. **Cornered CPUs keep reacting.** The corner handler currently sits above the reaction pipeline
   (Priority 2, `cpuAI.js` ~988–998) — let it fall through to defensive reactions when it doesn't
   act, so a cornered CPU can still parry instead of tunnel-visioning escape.

## 3.4 CPU palm thrust usage (new — currently zero references in `cpuAI.js`)

The AI is the tutorial in a 200-bout mode; it must demonstrate the anti-mash counter-poke.

| Context | Rule (all with a shared `PALM_DECISION_COOLDOWN_MS = 1500`) |
|---|---|
| Anti-mash counter-poke | opponent slapped ≥3 times in the last 4s and distance 145–180px → `PALM_COUNTERPOKE_CHANCE = 0.30` |
| Corner defense | from the corner-answers menu above (palm slot) |
| Edge finisher | opponent inside `SLAP_KILL_RANGE` of the rope in the CPU's facing direction → `PALM_EDGE_FINISH_CHANCE = 0.50` |

Track opponent slap frequency with a simple rolling counter in aiState (this also seeds Phase 4's
memory system). Palm input = back + mouse1 relative to facing (verify against the palm gating in
`socketHandlers.js`).

## 3.5 Acceptance criteria

- A rope jump from the deep corner lands visibly short of center; a sidestep started at the rope
  travels ~110px; both still escape the immediate kill.
- A predicted grab on sidestep recovery / rope-jump landing connects clean and the Phase A burst
  visibly carries the victim back toward the rope.
- A cornered CPU: sometimes palms, sometimes parries, sometimes fights; never escapes more than
  twice a round; no longer escapes "every time."
- CPU uses palm thrust against a slap-spamming player at range and the player can parry/whiff-punish
  it (generic charged-attack reaction path still applies to palms defensively).
- Phase 1 seam math re-verified with 50ms sidestep startup (wakeup sidestep still escapes the
  seam grab, still loses to immediate slap3).

**Out of scope:** personality-specific corner weights (Phase 4), any change to rope jump / sidestep
i-frame durations, escape stamina costs.

---

# PHASE 4 — AI Identity, Memory & the Difficulty Curve ⚠️ (PARTIALLY SUPERSEDED — 4.1 memory and the seam policies in 4.2 were removed with the string; corner/clinch policies, curriculum kits, and the difficulty curve still stand)

**Intent:** rivals with obvious, engaging gameplans at low/mid ranks that converge to
"complete-with-a-lean" at the top; a memory system that forces mixups; a curriculum ladder; a
continuous difficulty curve that ramps sooner. **All BASHO-gated** (Guardrail 2).

## 4.1 Memory / read system (resurrects the dead `lastReadTime`/`readCooldown` scaffold, `cpuAI.js` ~368–369)

Track per-bout counters of the player's choices at decision moments (observable info only):

| Tracked | Used to bias |
|---|---|
| Ender choice after slap2 (slap3 / grab / bait) | CPU wakeup weights when defending the seam |
| Wakeup choice vs the CPU's strings (parry / mash / escape / eat) | CPU ender choice when attacking |
| Corner-escape punish attempts (does the player pre-charge / chase-grab?) | CPU corner answer weights |
| Slap frequency (rolling, from Phase 3) & grab frequency | defensive posture (parry rate, spacing intent) |

**Adaptation rule:** if the modal choice frequency ≥ 60% over the last N observations, shift the
counter-weight by S; decay the shift over 20s of contrary evidence.

| Tier band | N (min obs) | S (shift) |
|---|---|---|
| EASY band | — | no memory |
| NORMAL band | 4 | +10% |
| HARD band | 3 | +20% |
| IMPOSSIBLE band | 2 | +30%, plus near-optimal mixing when no pattern exists |

Cap total shift at +30%. Stretch goal (recommended): persist memory **per named rival within a
basho run** — "Sir Slipsalot remembers you from Day 3" is a premium rivalry feel for free.

## 4.2 Personality = decision-moment policies (replaces multipliers-only identity)

Keep the existing `PERSONALITY_PROFILES` multipliers as seasoning; add per-archetype policy
tables at the four legible moments. Starting values (rows sum to 100):

**Ender choice (attacker at the seam):** slap3 / grab / bait-walk-away

| | slap3 | grab | bait |
|---|---|---|---|
| pusher | 70 | 20 | 10 |
| grappler | 30 | **60** | 10 |
| counter | 45 | 25 | **30** |
| brawler | **80** | 15 | 5 |
| balanced | 55 | 30 | 15 |

**Wakeup choice (victim at the seam):** parry / mash / escape / eat

| | parry | mash | escape | eat |
|---|---|---|---|---|
| pusher | 15 | 25 | 10 | 50 |
| grappler | 15 | 15 | 10 | 60 |
| counter | **45** | 10 | 15 | 30 |
| brawler | 10 | **40** | 5 | 45 |
| balanced | 25 | 20 | 10 | 45 |

**Corner answer:** fight / palm / parry / escape / grab — pusher fights (40) and palms (30);
counter parries (40) and palms (25); grappler grabs (35) and plants; brawler fights (55); only
counter/balanced keep escape ≥25. **Clinch style:** grappler lifts/pulls and grips up fast;
pusher pushes and jolts vs plant; counter breaks early and throws off failed jolts; brawler
jolt-happy. (Clinch currently has zero personality hooks — `cpuAI.js` ~1146–1426 — wire these
weights into `handleClinchBehavior`.)

**Top-rank convergence:** at the IMPOSSIBLE band, multiply personality deltas by **0.5** toward
the balanced row and enable full kit + memory — "complete with a lean," never flat. Each boss
keeps one hard signature (e.g., Yokozuna always hunts the kill-throw once your balance < 30).
Also unlock `whiffPunish` for the **counter archetype from the HARD band** (currently
IMPOSSIBLE-only) — patient punishment IS its identity.

## 4.3 Curriculum kits (per-division CPU toolkits, BASHO only)

Low ranks are specialists with **narrow kits** (missing tools, not lobotomized reactions); each
division adds verbs. The ladder becomes a designed learning arc:

| Division | Kit adds (cumulative) | Lesson taught |
|---|---|---|
| Jonokuchi | slap string, basic grab, clinch push | "hit buttons, learn the rope" |
| Jonidan | + plant, + parry | "your mash can be answered" |
| Sandanme | + palm thrust, + clinch throw | "stop mashing at range; balance matters" |
| Makushita | + jolt, + pull, + sidestep | "the clinch triangle; escapes exist" |
| Juryo | + rope jump, + lift, + power-ups | "full sumo" |
| Maegashira+ | full kit + memory + seam mixups at full strength | "the real game" |

## 4.4 Continuous difficulty curve (BASHO only; classic VS CPU keeps discrete tiers)

Replace the 4-cliff division mapping with interpolation. Define ladder position
`L ∈ [0,1]` from (division index + normalized banzuke number within the division), and lerp every
dial (`missChance`, `pressureMiss`, jitter min/max, `decisionCooldown`, parry/dodge mults, memory
N/S) between anchor profiles:

| Anchor | L | Profile |
|---|---|---|
| Floor | 0.00 | current EASY (first basho stays masher-winnable — the hook) |
| A2 | **0.25** | current NORMAL (arrives ~Jonidan/Sandanme — one division sooner than today) |
| A3 | **0.60** | current HARD (arrives ~Makushita/Juryo) |
| Ceiling | 1.00 | current IMPOSSIBLE (Ozeki/Yokozuna + bosses) |

Keep the intra-basho back-third kachi-koshi ramp as `+0.05–0.10 L`. Bosses override to their
configured tier as today. Net effect: the ramp starts sooner and never plateaus for three
divisions, and every promotion is felt.

## 4.5 Acceptance criteria

- Blind-test legibility: a playtester who fights a pusher, a grappler, and a counter (same
  division) can name which was which without being told.
- Ending every string with slap3 for ~3 strings makes a HARD-band rival start wakeup-parrying;
  switching to grab enders gets it desperation-slapping; the counter-adaptation is visible but
  never exceeds the shift cap (no psychic CPU).
- A Jonokuchi CPU never jolts/pulls/rope-jumps; a Juryo CPU uses the full kit.
- Difficulty dials measurably interpolate between adjacent banzuke ranks (log the resolved
  profile per bout); classic VS CPU HARD remains byte-identical to the legacy `AI_CONFIG`
  baseline; PvP untouched.

**Out of scope:** new AI codebases (one brain, dialed — per BASHO_MODE_SPEC §5.5), tachiai
opening redesign, draft/loadout verb-changers (separate future spec).

---

# PHASE 0 (optional prep, anytime) — Dead-Dial Sweep

Tuning against dials that do nothing will sabotage every phase above. Remove or wire up:
`RAW_PARRY_STUN_DURATION` / `RAW_PARRY_SLAP_STUN_DURATION` (defined, never referenced),
`GRAB_TECH_*` family (old tech path), `GRAB_PUSH_RESIST_*`, `GRAB_ACTION_WINDOW`,
`GRAB_PUSH_MAX_DURATION` (imported, unused), `GRAB_WHIFF_STUMBLE_VEL` (defined, not applied),
`CLINCH_CLASH_BALANCE_DRAIN` (imported, never applied — decide: wire it in or delete),
`SIDESTEP_INITIATION_RANGE` (legacy), and the stale `SLAP_KILL_RANGE` comment (describes ~95px;
value is 45 — fix the comment to match intent). Also note `isCounterGrabbed` is set but never
enforced on clinch break — decide intended behavior and align code or comment.

---

## Cross-Phase Testing Strategy

- **The one question every phase re-asks:** "does mouse1 still play the game by itself?" After
  Phase 1–2, a pure masher should still complete strings but lose to any player using the seam,
  spacing, or reads.
- Frame-math regression: scripted bot-vs-bot checks for (a) hit1→2 true combo, (b) neutral seam
  escapable only by buffered parry/mash, (c) earned seam inescapable, (d) neutral charged
  midscreen never kills. (`match-logs` / `inputAuditLog.js` can drive assertions.)
- PvP latency pass at ~100ms: just-frame judging, buffered wakeups, no phantom-hit regressions.
- BASHO firewall: classic VS CPU (no archetype, discrete difficulty) byte-identical pre/post
  Phase 4; PvP identical pre/post Phase 3–4 AI work.
- Feel pass per phase with the stated goal: seam freeze reads as impact (not lag); sloppy vs
  perfect finisher is audibly/visibly distinct; corners feel dangerous but not hopeless.

## Tuning Dials Index (the knobs most likely to need playtest adjustment)

| Dial | Start | Moves what |
|---|---|---|
| `HITSTOP_SLAP_HIT2_MS` | 140 | size of the decision beat |
| `SLAP_STRING_HIT2_STUN_MS` | 180 | how contestable the neutral seam is (raise toward 260 = safer for attacker) |
| `SLAP_ENDER_JUST_WINDOW_MS` | 50 | just-frame difficulty |
| `SLAP_HIT3_KB_VELOCITY_SLOPPY` | 2.4 | mash tax (gap to 3.1) |
| `SLAP_WHIFF_PAUSE_MS` / `SLAP_WHIFF_EXTRA_STAMINA` | 300 / 3 | spam price |
| `ROPE_JUMP_CENTER_FRACTION` / `SIDESTEP_TRAVEL_EDGE` | 0.33 / 110 | escape refund size |
| `AI_CORNER_ESCAPE_BUDGET` / `CORNER_DECISION_COOLDOWN_MS` | 2 / 1500 | corner monotony |
| Memory N / S per band | table §4.1 | how hard the CPU forces mixups |
| Difficulty anchors L | 0 / 0.25 / 0.60 / 1.0 | ramp shape |

## Open Questions (decide during implementation, none block Phase 1)

1. Should counter-hit openers keep the full earned guarantee, or punish-openers only? (Start with
   both; if strings feel too safe, drop counter-hit to "sloppy-tier guaranteed.")
2. Does the seam grab need a small startup buff (180 → ~160ms) if playtests show wakeup-parry
   release timing beats it? (Math says no — parry min-hold 200ms covers C+315 — verify in play.)
3. Blue spark bonus beyond full velocity — extra balance chip? (Start with presentation only.)
4. Memory persistence across a basho per rival (recommended stretch) — where to store it
   (`bashoRun` context vs aiState keyed by rival id)?
5. Tachiai as a designed opening read moment — deliberately excluded here; candidate for its own
   spec after Phase 2.

---

*End of spec. Implement one phase per session. Playtest between phases. Keep the freeze, not the
lag; keep the mash, not the win; keep the escape, not the refund.*
