# Charged Headbutt Contact — Phase 13A

**Status:** Implemented behind `COMBAT_CONTACT_FIDELITY_V2` (**default ON** as of Phase 14).  
**Extends:** Phase 13 outcome-aware cleanup (`COMBAT_CONTACT_FIDELITY_PHASE.md`).  
**Does not:** retune charge speed/distance/damage/KB/hitstop, redesign all hitboxes, add clash FX, or modify Rope Jump / Pose Geometry / Facing Ownership. Rollback: `COMBAT_CONTACT_FIDELITY_V2=0`.

## Previous failure

At close range, the flying-headbutt pose could embed in the opponent before resolution. Slap-versus-charged used `CHARGE_PRIORITY_THRESHOLD` (30%) plus root tip-rail distance — not first physical surface contact — so a correct gameplay winner could still look arbitrary (forehead through torso, slap through head, late reactions).

## Previous winner rules (legacy / V2-off)

| Condition | Winner |
|---|---|
| Charged power ≥ 30 and both in tip-connect range | Charged |
| Charged power < 30 | Slap |
| Charged in startup / recovery | Slap (normal) |

Iteration order: `checkCollision(P1,P2)` then `(P2,P1)`. Threshold defer could leave a losing slap animating until the reciprocal call.

## New physical-contact model (V2-on, flying headbutt only)

Palm thrust keeps the legacy threshold path (rooted; not a flying headbutt).

Winner = earliest valid surface contact in the current sim step (or point-blank active-start order). Charge power and travel distance are **not** priority tie-breakers.

### Authored surfaces (`chargedHeadbuttContact.js`)

| Surface | Role |
|---|---|
| `HEAD_ATTACK_FRONT` | Charged tip depth (existing `STRIKE_TIP_CHARGED`) |
| `FRONT_BODY_HURT` | `HEAD * 0.58` — behind forehead |
| `BODY_HURT` / `REAR_BODY_HURT` | Full body half; rear/side tags |
| `SLAP_TIP` | Existing slap tip rail |
| `SLAP_BODY_HURT` | Slap defender body half |

Mirrored via facing. Not tied to cosmetics / Pose Geometry V2.

### Startup / active / recovery

| Phase | Rule |
|---|---|
| Charge hold / launch startup | Slap wins cleanly; no headbutt hitbox |
| Active frontal | Head vs slap body vs slap tip vs front body — earliest `t∈[0,1]` |
| Active rear | Slap tags body; head cannot threaten |
| Recovery (past active) | Slap wins normally |

### Point-blank ordering

When already touching / both candidates at `t=0`:

1. Slap active-start earlier → slap wins  
2. Charged active-start earlier → charged wins  
3. Within `SLAP_TRADE_WINDOW_MS` → trade  

Never player-id or collision-loop order.

### Simultaneous trade

`|t_slap − t_charged| ≤ SAME_CONTACT_EPSILON (0.05)` → existing-style trade (`resolveSlapChargedTrade`): both attacks consumed, slap trade hit + charged drains, one hitstop. No new clash FX.

### Why charge power / travel distance are not priority

Power still scales speed, active length, damage/KB/hitstop exactly as before. Faster lunges may reach first **because they move**; power is never consulted after contact times are known.

### Movement / contact ordering

1. Propose charged lunge step  
2. If live slap present (V2), evaluate earliest contact on `[prev → proposed]`  
3. Advance to contact (bounded correction ≤ 14px on overlap)  
4. Resolve hit/trade + Phase 13 consume  
5. Do not commit the remainder of the step through the opponent  

Collision path uses the same evaluator with `_combatPrevX` when available.

### Cleanup ownership

Phase 13 `consumeLosingAttackInstance` — 0 losing active-pose survival ticks; residual charged velocity 0 after slap win. Instance-gated / idempotent.

### Prediction

Charged lunge X is not client-predicted (`movementPredictor` suspends on `isAttacking`). Server clears attack flags on the resolution tick; `player_hit` pins attacker X. No client-only outcome.

### Feature flag / rollback

```bash
# unset → V2 (default ON, Phase 14)
COMBAT_CONTACT_FIDELITY_V2=1 npm run dev:web   # physical slap↔headbutt
COMBAT_CONTACT_FIDELITY_V2=0 npm run dev:web   # legacy threshold
```

## Quantitative results (deterministic tests)

| Metric | Result |
|---|---|
| Losing active-pose survival | 0 |
| Residual charged velocity after slap win | 0 |
| Outcome mismatch under collision-order swap | 0 |
| Legacy V2-off threshold outcomes | preserved |
| Max charged step @100% (unchanged) | ~20.2 px/tick |

## Manual playtest matrix

`COMBAT_CONTACT_FIDELITY_V2=1 npm run dev:web`

Slap catches hold · slap catches startup · active head reaches first · slap body first · same-time trade · point-blank repeated headbutts/slaps · all slap stages · low/med/full charge · short/mid/long travel · both directions · side/rear · both boundaries · parry · armor · dodge/sidestep · grab after interrupt · next action after recovery · reset/rematch · debug OFF/ON.

Watch for: forehead through opponent, slap through head, late reactions, root snap, invisible wall, wrong FX, prediction replay, unfair point-blank dominance.

## Remaining art limitation

Static flying-headbutt pose can still *read* deep even when contact resolves at the forehead surface. Transition art is deferred (user-owned).

## Deferred

Universal swept solver · all-attack redesign · weak-charge special clash · new FX · default-on flag · charge/slap retune.
