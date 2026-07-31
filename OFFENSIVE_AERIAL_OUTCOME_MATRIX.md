# Offensive Aerial Outcome Matrix — PUMO PUMO !

Characterization of **current** authoritative behavior (2026-07-31).  
Not a redesign. Labels: **I** = intentional, **S** = stable/accidental, **G** = gap, **U** = needs playtest.

Shared detector: `checkFlapBodySlam` (plain slide-jump, FLAP flight, S dive).

Geometry: width = `HITBOX_DISTANCE_VALUE * 2 * 0.7 * max(sizeMult)`; height band ≤ 100px above ground; descending **or** dive-committed; blocked by `slideJumpHitLanded`.

---

## 1. Successful hit outcomes

| # | Scenario | Collision winner | Contact timing | Movement after | Sides | Attacker anim | Defender anim | Hitstop | KB | Hitbox cleanup | Landing | Recovery | Buffer | Pushbox / 1st grounded | Class |
|---|----------|------------------|----------------|----------------|-------|---------------|---------------|---------|----|----------------|---------|----------|--------|------------------------|-------|
| 1 | Air → grounded | Slam body overlap | First overlapping descending tick | Attacker continues flight; defender burst KB | Defender pushed away from flapper; attacker facing unchanged mid-flight | flap/dive art until land | hit (`lastHitType:"flap"`) | `HITSTOP_BURST_MS` (+gored) | `FLAP_BODYSLAM_KB_VELOCITY` × mastery/read | Latch `slideJumpHitLanded`; charges=0 | Whiff clock replaced by `BURST_STUN_MS` on touchdown | Attacker land lock = burst; defender stun = burst (+CH/GORED) | Blocked while slide-jumping | Flight off → land pushbox on | **I** |
| 2 | Air → moving grounded | Same | Same | Victim entry vel scales KB if mastery P1 | Same | Same | Same | Same | Scaled | Same | Same | Same | Same | Same | **I** |
| 3 | Air → attacking defender | Same if not already-hit / immune | Same | Callouts may CH/punish/gored via `evaluateHitCallouts` | Same | Same | Hit cancels via `clearAllActionStates` | Same | Read mults | Same | Same | Extended victim stun on CH/GORED | Same | Same | **I** |
| 4 | Air → crouching | No crouch special case | Same as grounded | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | **S** |
| 5 | Near left boundary | Same | Same | Rope kill-band via `slapKillBand` / `isSlapKnockback` | Edge clamp possible | Same | Same | Same | Same | Same | Same | Same | Same | Boundary clamp | **I** |
| 6 | Near right boundary | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | **I** |
| 7 | Air → airborne non-immune | Same if gates pass | Same | `beginAirHitFall` on defender | Facing update | Same | Air dump | Same | H boost + fall | Same | Attacker still lands normally | Defender hit-fall then ground | Same | N/A midair | **I** (comment stale) |
| 8 | Crossing-side hit | Overlap while H travel | Whenever descend+overlap | Flight continues; may finish cross after latch | May flip during post-hit travel | Same | Same | Same | Away from flapper at connect | Latch prevents 2nd | Land wherever arc ends | Burst land | Same | Generic pushbox | **I** |
| 9 | Hit immediately before touchdown | Same | Same tick may land after integrate | Latch then phase→landing | Same | recovering quickly | hit | Same | Same | Latch | Immediate landing possible | Burst | Same | Pushbox on land tick | **I** |
| 10 | Already overlapping at active start | Same | First active tick | Same | Same | Same | Same | Same | Same | Latch | Same | Same | Same | Same | **I** |

**Repeated-hit:** Latch blocks further slam this flight even if bodies still overlap (**I**).

---

## 2. Parry outcomes

Path: `opponent.isRawParrying` → `resolveFlapRawParry` (before damage).

| # | Scenario | Interrupt? | Hitbox cleared? | Re-hit same anim? | Vel after | Rebound? | Attacker state | Defender | Sides | Touchdown | Land overlap | Anim | Cleanup | Buffer | FX contact | Leak risk | Class |
|---|----------|------------|-----------------|-------------------|-----------|----------|----------------|----------|-------|-----------|--------------|------|---------|--------|------------|----------|-------|
| 1 | Grounded parries FLAP/slam | Yes | Yes (`clearAllActionStates`) | No | Zeroed then AP shove (`slapParryKnockbackVelocity`) | Ground shove | Grounded + `isRecovering` + `AP_STAGGER_FLAP_MS` lock | Success frames; chain++; optional guard hold | Facing may retarget | Instant ground (no aerial land phase) | Pushbox immediately | Recovery / AP success — not aerial land | Broad clear then stagger timers | Cleared in `clearAllActionStates` | Midpoint `contactX` | Low if timers fire | **I** |
| 2 | Parries slide-jump attack | Same path | Same | No | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Midpoint | Same | **I** |
| 3 | Parries body slam dive | Same | Same | No | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Midpoint | Same | **I** |
| 4 | During ascent | Only if dive committed (ascent alone has no hitbox) | If window open | No | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Midpoint | — | **I** |
| 5 | Near apex | If descending into band | Same | No | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Midpoint | — | **I** |
| 6 | During descent | Primary case | Same | No | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Midpoint | — | **I** |
| 7 | Immediately before touchdown | Same | Same | No | Same | Same | Grounded stagger (skips land phase) | Same | Same | Instant | Same | Same | Same | Same | Midpoint | — | **I** |
| 8 | Near boundary | Same | Same | No | Shove may clamp | Same | Same | Same | Same | Same | Same | Same | Same | Same | Midpoint | — | **I** |
| 9 | Defender moves under/across | Geometric at poll ticks | Same | No | Same | Same | Same | Same | May change pre-contact | Same | Same | Same | Same | Same | Midpoint | **U** | **U** |
| 10 | Roots already overlapping | Same | Same | No | Same | Same | Same | Same | Same | Same | Same | Same | Same | Same | Midpoint | — | **I** |

**Perfect vs regular:** Live AP window + duration ≤ `PERFECT_PARRY_WINDOW`; guarding floor forces regular tier.  
**AP kill:** Perfect + flapper balance < threshold → pull-kill cinematic (midpoint impact).  
**Guard:** Works when `isRawParrying` (guard hold keeps it true). Pure `isGuarding` without `isRawParrying` would **not** enter parry branch (**G/U**).

---

## 3. Whiff outcomes

| # | Scenario | Result | Late attack risk | Class |
|---|----------|--------|------------------|-------|
| 1 | Clean whiff | Land → recovery 90ms (plain) or 250ms (flap flight used) | None | **I** |
| 2 | Pass over high | No hit while `y-GROUND>100`; may hit later if descend into band overlapping | Possible late enter into band | **I** |
| 3 | Land immediately in front | Landing pushbox separates | No — latch or inactive | **S** |
| 4 | Land immediately behind | Cross-up land; facing refresh on clear | No | **I** |
| 5 | Hitbox expires while bodies overlap | Latch or leave band; no damage | **Prevented by latch / inactive ascent** | **I** |
| 6 | Opponent walks into attacker after active expires | No slam without latch+window | Safe | **I** |
| 7 | Whiff near boundary | X clamped in flight | Safe | **I** |
| 8 | Whiff vs anchored/immovable | No special case; may land overlapping then pushbox | Safe for damage | **S** |

---

## 4. Simultaneous / defensive outcomes

| Matchup | Current ordering | Notes | Class |
|---------|------------------|-------|-------|
| Aerial slam vs slap | Separate systems; strike via `checkCollision`, slam via `checkFlapBodySlam` same tick early pair | Order: pushbox → tip sep → strikes → slam | **I** |
| vs charged / palm | Same | Flight immune attacker ignores strikes until dive | **I** |
| vs low kick | Same | Low kick still needs hittable target | **I** |
| vs another aerial | Mutual flight immunity blocks both slams until dive | Dive vs flight: dive is hittable | **I** |
| vs armor / thick blubber | **Not consulted** | Slam bypasses `processHit` absorb | **G** |
| vs invuln / already-hit / KB immunity | Early return | **I** |
| vs dodge / sidestep active | Early return | **I** |
| vs grab startup | `isGrabbing` / `isBeingGrabbed` block | **I** |
| vs rope jump active | Blocked | **I** |
| vs landing player | Landing phase is hittable (not flight immune) | **I** |
| Double hit | Latch prevents same attacker; opposite order both poll | **I** |
| Trade / clash | No slam-specific clash; strikes may trade separately | **S** |
| Priority | Parry checked before hit inside slam | **I** |
| Counter-hit | Via `evaluateHitCallouts` on defender | **I** |
| Parry + hit same tick | Parry branch returns first | **I** |

---

## 5. Per-move matrix coverage checklist

| Move | Hit matrix | Parry matrix | Whiff matrix | Ordering |
|------|------------|--------------|--------------|----------|
| Plain slide-jump | Covered (shared) | Covered | Covered | Covered |
| FLAP flight | Covered (shared) | Covered | Longer land recovery | Covered |
| S dive | Covered (dive opens window) | Covered | Covered | Covered |

See tests in `server-io/test/aerial/` and [`OFFENSIVE_AERIAL_TEST_MATRIX.md`](./OFFENSIVE_AERIAL_TEST_MATRIX.md).
