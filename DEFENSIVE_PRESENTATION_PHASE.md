# Defensive Presentation Phase 9

**Date:** 2026-07-31  
**Status:** Complete for discrete defensive outcomes. No gameplay tuning. No new visual effects.  
Rope Jump unchanged. Low kick remains disabled. Movement-smoke baseline offsets remain separate.

Extends the unified contract in `server-io/combatPresentationEvent.js` and `client/src/combatPresentation/`.

---

## 1. Inventory (active paths)

| Path | Trigger | Assets | Status |
|------|---------|--------|--------|
| Guard block chip | `guard_block` | `BlockingEffect` / `blocking-effect.png` | **Migrated P9** |
| GS attack parry (slap/palm) | `raw_parry_success` `isAttackParry` | SlapParry sheet | P7 + P9 defense metadata |
| OA attack parry (flap/dive) | `raw_parry_success` `isAttackParry` | SlapParry sheet | P6 + P9 metadata; **kill path attach fixed** |
| Perfect AP extras | state rising edge | spark burst / land smoke / PERFECT stamp | **State-owned** (composite, unchanged) |
| Snowball / pumo raw parry | `raw_parry_success` (!attack) | `RawParryEffect` | **Migrated P9** |
| Matador success | `matador_success` | HUD `MatadorSuccessEffect` + SFX/shake | **Migrated P9** (screen-space) |
| Matador / AP stance plumes | state edges | gold/blue hold particles | **State-owned sustained** |
| Sidestep dust | state edges | sidestepStart/Trail/Land | **State-owned sustained** |
| Grab armor absorb/break (melee) | clinch sockets | Phase 8 particles | P8 unchanged |
| Projectile Thick Blubber absorb | `grab_armor_absorb` | absorb particle | **P9 attach** (reuse CLINCH absorb) |
| Guard crush | flag on `guard_block` | stun stars + glass SFX | Preserved on block payload |
| Legacy `perfect_parry` / `slap_parry` sockets | dead | — | Ignored |

---

## 2. State-owned vs event-owned

**State-owned (not presentation events):** guarding pose, AP/Matador hold plumes, sidestep trail, perfect additive spark/land smoke, HUD refund flashes.

**Event-owned (`combatPresentation`):** one block, one attack parry (existing GS/OA), one projectile raw parry, one Matador success, one projectile absorb attach.

---

## 3. Event-contract extensions

- Event type: `DEFENSE`
- Outcomes: `BLOCK`, `PARRY`, `PERFECT_PARRY`, `MATADOR`, `ABSORB`, `RAW_PARRY`
- Defense types: `GUARD_BLOCK`, `ATTACK_PARRY`, `PROJECTILE_PARRY`, `MATADOR`, `GRAB_ARMOR_ABSORB`
- Profiles: `DEF_BLOCK`, `DEF_RAW_PARRY`, `DEF_MATADOR`
- Compact fields: `defenseInstanceId`, `incomingActionInstanceId`, `defenseType`, `timingGrade`, `attackFamily`, `attackerId`, `defenderId`, `screenSpaceCallout`
- Helpers: `buildDefensivePresentation`, `annotateAttackParryDefense`
- No new Socket.IO channel

---

## 4. Profiles / contact

| Profile | Anchor | Y | Orientation | Asset |
|---------|--------|---|-------------|-------|
| `DEF_BLOCK` | CONTACT seam X | `366` hit spark | attacker facing | blocking sheet |
| `DEF_RAW_PARRY` | incoming-side of parrier (`towardIncoming * 55`; Phase 9 correction) | `366` | approach-aligned facing | raw parry ring |
| `DEF_MATADOR` | shared midpoint | mid Y | none | HUD stamp (screen-space) |
| GS/OA `*_PARRY` | existing P6/P7 | `388` / OA contact | contact normal | slapParry (unchanged look) |

---

## 5. Duplicate-path resolution

- One `eventId` per resolved defense; client `claimPresentationEvent` (cap 256)
- Block never shares a hit profile
- Attack parry annotated with `PERFECT_PARRY` vs `PARRY` timing grade — still one SlapParry spawn
- Matador claim prevents double HUD stamp on retransmit
- Aerial AP-kill now attaches `OA_PARRY` (was bare emit)

---

## 6. Prediction

- AP / Matador activation plumes remain state-predicted (unchanged)
- Discrete outcome bursts claim by `eventId` so confirm cannot double-spawn
- No new prediction system

---

## 7. Intentional visible changes

1. **Aerial AP-kill** now receives the same OA parry placement/dedupe as non-kill (fix for missing attach). Assets unchanged.
2. No other intentional visual redesign — placement matches prior approved seams / legacy offsets.

---

## 8. Movement smoke baselines (untouched)

- Raw dodge: `DASH_SMOKE_SHEET_BASELINE_Y = 10`
- Slide redirect: `sheetBaselineY = 0`
- Not normalized or merged

---

## Tests

`node --test 'test/presentation/defensive-presentation.test.js'`
