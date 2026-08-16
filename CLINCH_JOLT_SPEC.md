# Clinch Jolt (Mouse1 During Clinch) — Design Spec v2

## Overview

Clinch Mouse1 shove (`clinchJolt`). Requires `hasGrip`.

Current matchup numbers:

- **Push vs neutral** — positional gain + balance/stam drain on the victim
- **Plant vs push** — slows the walk, stam upkeep, ~0 bal/sec mid-ring
- **Jolt vs plant** — 60px push + 15 balance + 800ms regen interrupt
- **Push vs jolt** — jolter takes 8 self-damage, 0 lockout on target, 400ms recovery

---

## Current numbers

### Effectiveness by opponent state
| Opponent doing | Balance damage | Self-damage | Push (px) | Target lockout | Frame adv |
|---|---|---|---|---|---|
| **Plant** | 15 | 0 | 60px | 550ms | +150ms |
| **Neutral** | 6 | 0 | 15px | 400ms | 0ms |
| **Push** | 0 | **8 (self)** | 0px | **0ms** | −400ms |
| **Jolting (mutual)** | 6 each | 0 | 0px | 300ms both | Even |

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
- One jolt per cooldown cycle

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

### Plant Regen (brake identity — nets ~0 vs push mid-ring)
```javascript
const CLINCH_PLANT_BALANCE_REGEN_PER_SEC = 12;
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
- **vs Plant:** 55% chance to jolt
- **vs Neutral:** 10% chance
- **vs Push:** 0% chance
- Reaction delay: 200-400ms
- Respects cooldown flag

---

## Current constraints

- Jolt requires `hasGrip`
- Jolt does not break clinch
- Jolt blocked during throw/pull/lift/clash animations
- Jolt blocked during one-sided grip-up (Phase A)
