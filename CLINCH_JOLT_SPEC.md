# Clinch Jolt (Mouse1 During Clinch) — Implementation Spec

## Overview

Add a new **"jolt"** action to the existing clinch/grab system. Mouse1 during clinch performs a quick chest-shove that deals balance damage and micro-pushes the opponent. It completes the push/plant/throw triangle by giving players a tool that specifically punishes planting.

**Input:** Mouse1 during clinch (requires `hasGrip`)
**Name convention:** `clinchJolt` (e.g. `isClinchJolting`, `isBeingClinchJolted`)

---

## Game Design

### Core Effect
- Deals **flat balance damage** to opponent (varies by their stance)
- Costs **stamina** to the jolter
- Creates a **small positional push** (~8-10px, permanent, toward opponent's side)
- Has a **recovery window** (~300ms) where jolter can't push/plant/throw
- Does NOT break clinch — both players keep grips, clinch continues

### Effectiveness by Opponent State
| Opponent doing | Balance damage | Positional push | Target lockout | Frame advantage | Notes |
|---|---|---|---|---|---|
| **Plant** | 10 | 10px | 350ms | **+50ms** (jolter advantage) | Full damage + interrupts plant regen for ~400ms |
| **Neutral** | 8 | 8px | 300ms | **0ms** (even) | Fair trade |
| **Push** | 5 | 5px | 200ms | **-100ms** (target advantage) | Bad read — they recover first |
| **Jolting (mutual)** | 6 each | 0px (cancels) | 300ms both | Even | Both pay cost, no net position change |

**Target lockout** uses the existing `inputLockUntil` pattern (same as throw/pull lockouts). During lockout the target cannot push, plant, throw, pull, lift, or jolt. They're frozen in the recoil pose. This means:
- Jolt vs plant = rewarded read (damage + frame advantage + plant interrupt)
- Jolt vs neutral = break-even trade (moderate damage, no advantage)
- Jolt vs push = punished (low damage, target recovers first and can throw during your recovery)

### Resource Costs
- **Stamina cost:** 7 (jolter pays on execution)
- **Recovery window:** 300ms — during recovery, jolter:
  - Cannot push (clinchAction forced to "neutral")
  - Cannot plant
  - Cannot request throw/pull/lift
  - Cannot jolt again
  - IS vulnerable to throws as if "pushing" (20 balance drain from `CLINCH_THROW_BALANCE_DRAIN_VS_PUSH`) — but only exploitable if target's lockout ended first (i.e., jolter hit a pushing opponent)

### Mutual Jolt (Both Mouse1 within window)
- Window: ~120ms (tighter than throw clash at 175ms)
- Both take 6 balance damage
- No positional change (forces cancel)
- Both enter recovery
- Both pay stamina cost
- Brief hitstop (~60ms)

### Cooldown
- **Cooldown after jolt:** 500ms (prevents spam, creates rhythm)
- Cooldown starts after recovery ends (so total cycle = 300ms recovery + 500ms cooldown = 800ms minimum between jolts)

### Gassed Penalty
- Gassed players CAN jolt but deal 50% balance damage and 50% positional push
- This matches the philosophy of `CLINCH_GASSED_PUSH_MULT` (0.2 for push is harsher because push is continuous)

---

## New State Flags

### On the jolter:
- `isClinchJolting` (bool) — true during the jolt animation (~150ms)
- `clinchJoltRecovery` (bool) — true during the recovery window after jolt (~300ms)
- `clinchJoltCooldown` (bool) — true during cooldown after recovery
- `clinchJoltStartTime` (number) — timestamp when jolt began

### On the target:
- `isBeingClinchJolted` (bool) — true during the impact/recoil (~200ms)
- `clinchJoltPlantInterrupt` (bool) — true for ~400ms, blocks plant balance regen

### On both (mutual jolt):
- `isClinchJoltClashing` (bool) — true during mutual jolt animation (~150ms)

---

## New Constants (add to `server-io/constants.js`)

Add these in the clinch section near the other `CLINCH_*` constants (~line 408-516):

```javascript
// Clinch jolt system (Mouse1 during clinch)
const CLINCH_JOLT_ANIMATION_MS = 150;           // Jolt lunge animation duration
const CLINCH_JOLT_RECOVERY_MS = 300;            // Recovery window (vulnerable, can't act)
const CLINCH_JOLT_COOLDOWN_MS = 500;            // Cooldown after recovery ends
const CLINCH_JOLT_STAMINA_COST = 7;             // Stamina cost per jolt
const CLINCH_JOLT_BALANCE_VS_PLANT = 10;        // Balance damage vs planting opponent
const CLINCH_JOLT_BALANCE_VS_NEUTRAL = 8;       // Balance damage vs neutral opponent
const CLINCH_JOLT_BALANCE_VS_PUSH = 5;          // Balance damage vs pushing opponent (braced)
const CLINCH_JOLT_PUSH_VS_PLANT = 10;           // Positional micro-push (px) vs plant
const CLINCH_JOLT_PUSH_VS_NEUTRAL = 8;          // Positional micro-push (px) vs neutral
const CLINCH_JOLT_PUSH_VS_PUSH = 5;             // Positional micro-push (px) vs push
const CLINCH_JOLT_MUTUAL_BALANCE = 6;           // Balance damage on mutual jolt (both)
const CLINCH_JOLT_CLASH_WINDOW_MS = 120;        // Mutual jolt detection window
const CLINCH_JOLT_HITSTOP_MS = 50;              // Hitstop on jolt landing
const CLINCH_JOLT_MUTUAL_HITSTOP_MS = 60;       // Hitstop on mutual jolt
const CLINCH_JOLT_PLANT_INTERRUPT_MS = 400;     // Duration plant regen is interrupted after being jolted
const CLINCH_JOLT_RECOIL_MS = 200;              // How long the target shows recoil animation
const CLINCH_JOLT_GASSED_MULT = 0.5;            // Damage/push multiplier when jolter is gassed

// Target lockout after being jolted (varies by what they were doing — scales frame advantage)
const CLINCH_JOLT_LOCKOUT_VS_PLANT = 350;       // +50ms advantage for jolter (300ms recovery - 350ms lockout)
const CLINCH_JOLT_LOCKOUT_VS_NEUTRAL = 300;     // Even (300ms recovery = 300ms lockout)
const CLINCH_JOLT_LOCKOUT_VS_PUSH = 200;        // -100ms disadvantage for jolter (bad read punished)
```

---

## Files That Need Changes

### Server-side:

1. **`server-io/constants.js`**
   - Add all new `CLINCH_JOLT_*` constants (see above)
   - Export them in the `module.exports` block at the bottom

2. **`server-io/grabActionSystem.js`** (main clinch logic)
   - Import new constants at the top
   - In `updateGrabActions()`:
     - Add jolt request processing BEFORE the throw/pull/lift section (around line 296)
     - Check for mutual jolt (both have `clinchJoltRequest` within window)
     - Process single jolt: apply balance damage based on opponent's `clinchAction`, apply micro-push, set states
     - During recovery: force `clinchAction` to "neutral", block throw requests
     - Handle the plant interrupt flag (block `CLINCH_PLANT_BALANCE_REGEN_PER_SEC` when `clinchJoltPlantInterrupt` is true)
     - In the balance/stamina section (~line 544-592): check `clinchJoltPlantInterrupt` before applying plant regen
   - Add jolt state cleanup in `clearClinchThrowState()` and anywhere clinch ends
   - The stalemate timer should reset on jolt (balance changes)

3. **`server-io/socketHandlers.js`** (input detection)
   - Around line 2148-2207 where clinch inputs are processed:
     - Add Mouse1 detection for clinch jolt:
       ```
       if (player.mouse1JustPressed && player.hasGrip && player.inClinch &&
           !player.isClinchJolting && !player.clinchJoltRecovery && !player.clinchJoltCooldown &&
           !player.clinchThrowActive && !player.isClinchClashing &&
           !player.isResistingThrow && !player.isResistingPull && !player.isBeingLifted)
       ```
     - Set `player.clinchJoltRequest = true` and `player.clinchJoltRequestTime = Date.now()`
   - NOTE: Currently Mouse1 is blocked during clinch in TWO places:
     - **Client** `Game.jsx` line 374-375: `if (cp?.isBeingGrabbed && e.button === 0) return;` — needs to allow Mouse1 when `inClinch && hasGrip`
     - **Server** `socketHandlers.js` ~line 1457-1460: `shouldBlockAction()` returns true when `player.inClinch` — the jolt input detection must happen BEFORE this general block (similar to how grip-up and throw detection happen before it at lines 2148-2207)

4. **`server-io/grabMechanics.js`**
   - In `executeClinchSeparation()`: clear jolt states on both players

5. **`server-io/gameFunctions.js`**
   - In `cleanupGrabStates()`: clear all jolt-related flags

6. **`server-io/playerCleanup.js`**
   - Add jolt flags to the cleanup/reset functions

7. **`server-io/roomManagement.js`**
   - Add jolt flags (defaulting to false/0) to the player initialization objects (~line 155-167)

8. **`server-io/cpuAI.js`**
   - In `handleClinchBehavior()` (~line 873):
     - Add jolt decision logic: CPU should jolt when opponent is planting and CPU has enough stamina
     - Probability-based with reaction delay (similar to throw decision pattern)
     - Don't jolt when opponent is pushing (bad trade)
     - Higher jolt chance when CPU's push is being stalled by plant
     - Respect cooldown

### Client-side:

9. **`client/src/components/Game.jsx`**
   - Line 374-375: Change Mouse1 block to allow clicks when player has grip in clinch
     - Current: `if (cp?.isBeingGrabbed && e.button === 0) return;`
     - New: `if (cp?.isBeingGrabbed && e.button === 0 && !(cp?.inClinch && cp?.hasGrip)) return;`
   - Same pattern for the gamepad handler (~line 217-231)

10. **`client/src/components/GameFighter.jsx`** (fighter rendering)
    - Pass new state flags as props to styled components
    - `$isClinchJolting`, `$isBeingClinchJolted`, `$isClinchJoltClashing`

11. **`client/src/components/fighterStyledComponents.js`** (CSS animations)
    - Add CSS transforms as placeholder animations (see below)

12. **`server-io/deltaState.js`** (state sync)
    - Add jolt flags to the delta state so they're sent to client

13. **`server-io/constants.js`** player defaults
    - Add default values for all jolt flags in the GRAB_STATES or wherever player defaults are defined

---

## Server Logic Flow (in `grabActionSystem.js`)

Insert this block in `updateGrabActions()` AFTER the stalemate timer check and BEFORE the throw/pull/lift section (before line 296):

```
// ============================================
// CLINCH JOLT (Mouse1) — quick balance-damage shove
// Processed before throw/pull/lift — recovery blocks those actions
// ============================================

// --- Mutual jolt detection ---
if (player.clinchJoltRequest && opponent.clinchJoltRequest) {
  const timeDiff = Math.abs(
    (player.clinchJoltRequestTime || 0) - (opponent.clinchJoltRequestTime || 0)
  );
  if (timeDiff <= CLINCH_JOLT_CLASH_WINDOW_MS) {
    // Mutual jolt — both take damage, no positional change
    [consume both requests]
    [set isClinchJoltClashing on both]
    [apply CLINCH_JOLT_MUTUAL_BALANCE to both]
    [apply CLINCH_JOLT_STAMINA_COST to both]
    [trigger hitstop CLINCH_JOLT_MUTUAL_HITSTOP_MS]
    [set recovery on both]
    [reset stalemate timer]
  }
}

// --- Process single jolt ---
for each player who has clinchJoltRequest (and request not consumed by mutual):
  [consume request]
  [determine opponent's clinchAction: "push", "plant", or "neutral"]
  [look up balance damage, positional push, AND target lockout from constants based on opponent action]
  [apply gassed multiplier if jolter is gassed (affects balance damage and push distance, NOT lockout)]
  [apply balance damage to opponent]
  [apply stamina cost to jolter]
  [apply micro-push: move both players by push amount toward opponent's side]
  [set isClinchJolting on jolter, isBeingClinchJolted on target]
  [set target.inputLockUntil = now + CLINCH_JOLT_LOCKOUT_VS_{opponent action}]
  [if opponent was planting: set clinchJoltPlantInterrupt = true on opponent]
  [trigger hitstop CLINCH_JOLT_HITSTOP_MS]
  [set clinchJoltRecovery after animation ends (150ms anim + 300ms recovery)]
  [set clinchJoltCooldown after recovery ends (+ 500ms cooldown)]
  [reset stalemate timer]

// --- Block actions during jolt recovery ---
if (player.clinchJoltRecovery) {
  // Force neutral — can't push, plant, or request throw
  override player's clinchAction to "neutral"
  // Throws treat recovery as "push" state (via the getClinchAction override or
  // by checking clinchJoltRecovery in the throw balance drain lookup)
}

// --- Plant regen interrupt ---
// In the existing plant balance regen section (~line 544-555), add:
if (player.clinchJoltPlantInterrupt) {
  // Skip balance regen — plant was interrupted by jolt
}
```

---

## CSS Placeholder Animations (in `fighterStyledComponents.js`)

Use the existing `grabbing.png` sprite. Apply CSS transforms to simulate the jolt:

### Jolter animation (`$isClinchJolting`):
```css
/* Quick forward lunge — translateX toward opponent, slight scaleX stretch */
@keyframes clinchJoltLunge {
  0% { transform: translateX(0) scaleX(1); }
  40% { transform: translateX(${props => props.$facing === -1 ? '-8px' : '8px'}) scaleX(1.08); }
  100% { transform: translateX(0) scaleX(1); }
}
/* Apply: animation: clinchJoltLunge 150ms ease-out; */
```

### Jolter recovery (`$clinchJoltRecovery`):
```css
/* Slight backward lean during recovery — subtle "catching breath" */
transform: translateX(${props => props.$facing === -1 ? '3px' : '-3px'});
opacity: 0.92;
```

### Target recoil (`$isBeingClinchJolted`):
```css
/* Sharp backward jerk + slight tilt = got shoved */
@keyframes clinchJoltRecoil {
  0% { transform: translateX(0) rotate(0deg); }
  30% { transform: translateX(${props => props.$facing === -1 ? '6px' : '-6px'}) rotate(${props => props.$facing === -1 ? '3deg' : '-3deg'}); }
  100% { transform: translateX(0) rotate(0deg); }
}
/* Apply: animation: clinchJoltRecoil 200ms ease-out; */
```

### Mutual jolt clash (`$isClinchJoltClashing`):
```css
/* Both compress together then bounce back */
@keyframes clinchJoltClash {
  0% { transform: translateX(0) scaleX(1); }
  35% { transform: translateX(${props => props.$facing === -1 ? '-4px' : '4px'}) scaleX(0.94); }
  100% { transform: translateX(0) scaleX(1); }
}
/* Apply: animation: clinchJoltClash 150ms ease-out; */
```

---

## Existing Patterns to Follow

- **Input detection pattern:** Follow exactly how clinch throw/pull/lift is detected in `socketHandlers.js` lines 2163-2207. The jolt uses Mouse1 instead of Mouse2 but the same guard conditions apply (hasGrip, inClinch, not in active animation, etc.)

- **Clash detection pattern:** Follow exactly how throw clash works in `grabActionSystem.js` lines 296-314. Same structure: check both requests, compare timestamps, consume if within window.

- **State cleanup pattern:** Follow how throw states are cleaned in `clearClinchThrowState()` (line 725), `endClinchLift()` (line 736), `triggerRingOut()` (line 846), and `cleanupGrabStates()` in `gameFunctions.js`.

- **Cooldown pattern:** Follow how `clinchThrowCooldown` is managed with `setPlayerTimeout` (line 325-326).

- **Timer/flag naming:** Follow existing convention: `isClinchJolting` (active animation), `clinchJoltRecovery` (post-action vulnerability), `clinchJoltCooldown` (can't act again yet), `clinchJoltStartTime` (timestamp).

- **Visual flag pattern:** Follow how `$isClinchPushing`, `$isClinchPlanting`, `$isClinchClashing` etc. are passed through `GameFighter.jsx` to `fighterStyledComponents.js` (~line 303-312 of styledComponents).

- **AI decision pattern:** Follow how `handleClinchBehavior()` in `cpuAI.js` (~line 873-1070) makes throw/pull/lift decisions with probability + reaction delay + interval checks.

- **Edge detection (just pressed):** Mouse1 edge detection already exists in `socketHandlers.js` for slap attacks. The `mouse1JustPressed` flag follows the same pattern as `mouse2JustPressed` — compare current `player.keys.mouse1` to the previous tick state.

---

## What NOT to Change

- Do NOT modify how push, plant, throw, pull, or lift work — jolt is additive
- Do NOT allow jolt without grip (must have `hasGrip`)
- Do NOT break clinch on jolt — both players stay clinched
- Do NOT allow jolt during throw/pull/lift animations, clash animations, or while being lifted/resisting
- Do NOT allow jolt during the one-sided burst push phase (Phase A) — only during Phase B (mutual clinch)
- Do NOT add jolt to the `HowToPlay.jsx` — it's already minimal and this is an advanced mechanic
