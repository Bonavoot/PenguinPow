# Projectile Presentation Phase 10

**Date:** 2026-07-31  
**Status:** Complete for active projectile discrete lifecycle moments.  
No gameplay retune. No new visual effects / particles / sheets / SFX.  
Rope Jump unchanged. Low kick remains disabled. Movement-smoke baselines untouched.  
Phase 9 incoming-side raw-parry placement preserved (not reverted).

Extends `server-io/combatPresentationEvent.js` and client `combatPresentation/` consumers.

---

## 1. Inventory (active paths)

| Path | Trigger | Assets | Ownership | Status |
|------|---------|--------|-----------|--------|
| Snowball launch | state `isThrowingSnowball` | throw SFX | Continuous | Unchanged |
| Snowball travel | entity + trail particles | sprite + `snowballTrail` | Continuous | Unchanged |
| Snowball hit | `snowball_hit` | `SnowballImpactEffect` | Discrete event | **Migrated P10** |
| Snowball raw / perfect parry | `raw_parry_success` | `RawParryEffect` | Discrete (P9) | Preserved incoming-side |
| Snowball Thick Blubber absorb | `grab_armor_absorb` | absorb particles (follow) | Discrete attach + state follow | Stable ID + contact |
| Snowball off-screen / expire | filter remove | — | State only | No invented FX |
| PUMO spawn | state + empty spawn FX | spawn SFX | Continuous | Unchanged |
| PUMO travel | clone entities | sprites | Continuous | Unchanged |
| PUMO hit | player hit state | hit reaction | Continuous | No discrete impact FX |
| PUMO raw parry | `raw_parry_success` | `RawParryEffect` | Discrete (P9) | Preserved + per-clone ID |
| PUMO absorb | `grab_armor_absorb` | absorb particles | Discrete attach | **Parity attach P10** |
| PUMO expire / boundary | lifespan / off-screen | — | State only | No invented FX |
| Reset / rematch | `game_reset` | clear claims + impact | — | Impact clear added |

No other active combat projectiles (Salt is ritual, not combat FX).

---

## 2. Discrete vs continuous

**Continuous (state/entity-owned):** launch pose/SFX, travel sprites, snowball trail, PUMO clone motion, hit-stun poses, absorb follow-the-defender particles.

**Discrete (`combatPresentation`):** snowball hit, projectile raw/perfect parry (P9), Thick Blubber absorb attach (snowball + PUMO).

Travel never emits launch/contact/destruction every tick.

---

## 3. Event-contract additions

- Event type: `PROJECTILE`
- `PROJECTILE_TYPE`: `snowball`, `pumo_army`
- `PROJECTILE_LIFECYCLE`: `HIT`, `PARRY`, `PERFECT_PARRY`, `ABSORB`, `DESTROY`, `EXPIRE`, `BOUNDARY`
- `PROJECTILE_OUTCOME`: `HIT`, `PARRY`, `PERFECT_PARRY`, `ABSORB`, `DESTROYED`, `EXPIRED`, `BOUNDARY`
- Profile: `PROJ_SNOWBALL_HIT`
- Helper: `buildProjectilePresentation`
- Compact attach fields: `projectileInstanceId`, `projectileType`, `lifecycleStage`, `ownerId`, `targetId`, `terminalX`, `terminalY`
- Parry/absorb remain `DEFENSE` events; payload may also carry projectile instance metadata
- Identity: `{projectileId}:{lifecycle}` — not `Date.now()`

---

## 4. Placement / orientation

| Moment | Rule |
|--------|------|
| Snowball hit | World X = snowball contact X; Y = victim.y + 50 (prior chest registration); approach from velocity |
| Raw parry | **P9 approved:** parrier incoming side (`towardIncoming * 55`), facing/CSS tilt from approach — **no** `parrierX + 150` |
| Absorb | Discrete contact uses projectile X/Y; client follow remains defender-owned (approved) |
| Destroy/expire/boundary | No discrete FX; entity removal ends travel/trail |

---

## 5. Proven defects corrected

1. **Snowball impact double-spawn** — both `GameFighter` instances rendered impact; now index-0 only.
2. **Snowball impact always-+70 X** — legacy `victim.x + 70` biased to +X; now projectile contact X.
3. **PUMO absorb missing presentation attach** — could not dedupe; now matches snowball.
4. **Unstable IDs** — hit/parry/absorb used `Date.now()`; now entity-instance lifecycle IDs.
5. **Reset leftover impact** — `snowballImpactPosition` cleared on `game_reset` / game start.

---

## 6. Prediction

- Snowball travel extrapolation remains (position only).
- No predicted hit/parry/absorb outcomes.
- Retransmit gated by `claimPresentationEvent(eventId)`.

---

## 7. Performance / cleanup

- Dedupe cap 256 unchanged.
- Impact effect self-expires (~450ms); cleared on reset/start.
- No per-tick presentation emits.
- Debug overlay fields extended (projectile id/type/lifecycle/terminal/approach/cleanup).

---

## Tests

`node --test 'test/presentation/projectile-presentation.test.js'`
