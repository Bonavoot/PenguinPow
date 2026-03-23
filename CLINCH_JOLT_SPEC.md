# Clinch Jolt (Mouse1 During Clinch) — Design Spec v2

## Overview

The **jolt** is a heavy, committal chest-shove during clinch. It's the anti-plant read — the way a pusher cracks through a planting opponent. It completes the clinch triangle:

- **Push beats neutral** (positional gain + balance drain)
- **Plant beats push** (net +3 balance/sec mid-ring, trades position for recovery)
- **Jolt beats plant** (60px push + 15 balance damage + 800ms regen interrupt)
- **Push beats jolt** (jolter takes 8 self-damage, 0 lockout on target, 400ms recovery = free throw window)

**Input:** Mouse1 during clinch (requires `hasGrip`)
**Name convention:** `clinchJolt` (e.g. `isClinchJolting`, `isBeingClinchJolted`)

---

## Design Philosophy

Jolt is NOT spam. It's a read. Each jolt is a real commitment — 250ms startup (telegraphed), 400ms recovery (punishable), 1200ms cooldown (one shot per clinch cycle). You use it when you SEE the opponent planting and want to crack them open. Wrong read (they're pushing) = self-damage, no lockout on them, and you're stuck in recovery while they can throw.

### Plant Regen Context
Plant regens balance at **15/sec** (buffed from 10). Push drains at 12/sec. This means:
- **Mid-ring:** Plant is net +3/sec (plant WINS the balance war)
- **At edge (1.5x drain):** Push drains 18/sec vs 15/sec regen = net -3/sec (push wins at edge)

This makes jolt NECESSARY — without it, a planting opponent can safely regen mid-ring. The pusher needs jolt to accelerate past the safe zone.

---

## Game Design

### Effectiveness by Opponent State
| Opponent doing | Balance damage | Self-damage | Push (px) | Target lockout | Frame adv | Notes |
|---|---|---|---|---|---|---|
| **Plant** | 15 | 0 | 60px | 550ms | **+150ms** | Devastating — correct read rewarded hard |
| **Neutral** | 6 | 0 | 15px | 400ms | **0ms** | Modest — neutral isn't the target |
| **Push** | 0 | **8 (self)** | 0px | **0ms** | **-400ms** | Disaster — you walked into their force |
| **Jolting (mutual)** | 6 each | 0 | 0px | 300ms both | Even | Both pay cost, no net position |

### Resource Costs
- **Stamina cost:** 10
- **Animation (startup):** 250ms — telegraphed, opponent can see it
- **Recovery:** 400ms — long vulnerability window
- **Cooldown:** 1200ms after recovery ends (total cycle = 250ms + 400ms + 1200ms = 1850ms)

### During Recovery (400ms)
- Cannot push, plant, throw, pull, lift, or jolt
- IS vulnerable to throws (treated as "pushing" state for throw balance drain)
- Target who was pushing gets 0ms lockout = they recover instantly and can throw

### Cooldown (1200ms)
- Starts AFTER recovery ends
- During cooldown: can push, plant, throw — just can't jolt again
- One jolt per clinch cycle keeps it as a read, not a rhythm game

### Plant Interrupt
- On successful jolt vs plant: target's plant regen is interrupted for **800ms**
- Full second of no balance recovery — the plant is truly broken

### Gassed Penalty
- Gassed players CAN jolt but deal 50% balance damage and 50% push distance
- Stamina cost, recovery, cooldown, and self-damage (vs push) are unchanged

### Mutual Jolt
- Window: 120ms
- Both take 6 balance damage
- No positional change
- Both enter recovery → cooldown chain
- Hitstop: 120ms

---

## Constants (`server-io/constants.js`)

```javascript
const CLINCH_JOLT_ANIMATION_MS = 250;
const CLINCH_JOLT_RECOVERY_MS = 400;
const CLINCH_JOLT_COOLDOWN_MS = 1200;
const CLINCH_JOLT_STAMINA_COST = 10;
const CLINCH_JOLT_BALANCE_VS_PLANT = 15;
const CLINCH_JOLT_BALANCE_VS_NEUTRAL = 6;
const CLINCH_JOLT_BALANCE_VS_PUSH = 0;
const CLINCH_JOLT_SELF_BALANCE_VS_PUSH = 8;
const CLINCH_JOLT_PUSH_VS_PLANT = 60;
const CLINCH_JOLT_PUSH_VS_NEUTRAL = 15;
const CLINCH_JOLT_PUSH_VS_PUSH = 0;
const CLINCH_JOLT_MUTUAL_BALANCE = 6;
const CLINCH_JOLT_CLASH_WINDOW_MS = 120;
const CLINCH_JOLT_HITSTOP_MS = 150;
const CLINCH_JOLT_MUTUAL_HITSTOP_MS = 120;
const CLINCH_JOLT_PLANT_INTERRUPT_MS = 800;
const CLINCH_JOLT_RECOIL_MS = 300;
const CLINCH_JOLT_GASSED_MULT = 0.5;
const CLINCH_JOLT_LOCKOUT_VS_PLANT = 550;
const CLINCH_JOLT_LOCKOUT_VS_NEUTRAL = 400;
const CLINCH_JOLT_LOCKOUT_VS_PUSH = 0;
```

### Plant Regen (buffed)
```javascript
const CLINCH_PLANT_BALANCE_REGEN_PER_SEC = 15;
```

---

## State Flags

### On the jolter:
- `isClinchJolting` — true during 250ms animation
- `clinchJoltRecovery` — true during 400ms recovery
- `clinchJoltCooldown` — true during 1200ms cooldown (starts after recovery)
- `clinchJoltStartTime` — timestamp when jolt began

### On the target:
- `isBeingClinchJolted` — true during recoil (300ms)
- `clinchJoltPlantInterrupt` — true for 800ms, blocks plant regen

### On both (mutual jolt):
- `isClinchJoltClashing` — true during mutual jolt animation

---

## Cooldown Implementation

Recovery → Cooldown chain using nested `setPlayerTimeout`:
```javascript
p.clinchJoltRecovery = true;
setPlayerTimeout(p.id, () => {
  p.clinchJoltRecovery = false;
  p.clinchJoltCooldown = true;
  setPlayerTimeout(p.id, () => {
    p.clinchJoltCooldown = false;
  }, CLINCH_JOLT_COOLDOWN_MS, "clinchJoltCooldown");
}, CLINCH_JOLT_RECOVERY_MS, "clinchJoltRecovery");
```

Input gating in `socketHandlers.js` checks `!player.clinchJoltCooldown`.
Cooldown cleared on clinch end / round end / all cleanup paths.

---

## CPU AI Behavior

- Check interval: 1600ms (matches cooldown rhythm)
- **vs Plant:** 55% chance to jolt (this is the intended use case)
- **vs Neutral:** 10% chance (occasional pressure)
- **vs Push:** 0% chance (AI knows this is a bad trade)
- Reaction delay: 200-400ms
- Respects cooldown flag

---

## What NOT to Change

- Push, plant, throw, pull, lift mechanics are unchanged
- Jolt requires `hasGrip` — no grip = no jolt
- Jolt does NOT break clinch
- Jolt blocked during throw/pull/lift/clash animations
- Jolt blocked during one-sided grip-up phase (Phase A)
