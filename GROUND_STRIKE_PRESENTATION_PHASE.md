# Ground-Strike Presentation Phase 7

**Date:** 2026-07-31  
**Status:** Complete for slap chain, palm / Shatter Palm, and charged headbutt only.  
Low kick remains disabled (not migrated). Grabs/throws migrated later — see `CLINCH_THROW_PRESENTATION_PHASE.md`. Rope Jump unchanged.

Extends the Phase 6 unified contract in `server-io/combatPresentationEvent.js` and `client/src/combatPresentation/`.

---

## Inventory (migrated paths)

| Path | Trigger | Asset / emitter | Placement before | After |
|------|---------|-----------------|------------------|-------|
| Slap hit | `player_hit` `attackType=slap` | `HIT_FX.slap` | `getContactSeamX` + `HIT_EFFECT_Y` | `combatPresentation` CONTACT + spark Y |
| Slap trade hit | trade `player_hit` | same | seam X + `HIT_EFFECT_Y` | same profile |
| Slap / palm / charged AP | `raw_parry_success` `isAttackParry` | SlapParry sheet | seam X + hand Y + 28px outward | profile offset along contact normal |
| Palm hit | `player_hit` + `isPalmThrust` | `HIT_FX.slapBurst` | seam X + `HIT_EFFECT_Y` | `GS_PALM_HIT` |
| Shatter Palm / armor-break palm | palm + `isArmorBreak` | same `slapBurst` + armorBreak filter | unchanged filter path | `GS_SHATTER_PALM_HIT` |
| Charged hit | `player_hit` `attackType=charged` | `HIT_FX.charged` | seam X + `HIT_EFFECT_Y` | `GS_CHARGED_HIT` |
| Charged armor-break | charged + `isArmorBreak` | charged sheet + armorBreak filter | unchanged filter | `GS_ARMOR_BREAK_HIT` |
| Counter / punish / tip / cadence | flags on `player_hit` | CSS filters / SFX | client | **Preserved** (not profile-switched) |
| Charge shake | `chargePercentage` | camera shake | client | **Preserved** (no tier-specific sheets) |
| Low kick | `attackType=lowKick` | `HIT_FX.lowKick` + ankle Y | legacy | **Not migrated** |
| Screen shake / hitstop / sounds | existing | existing | existing | **Preserved** |

Coordinate note: server historically sent `contactY: victim.y` (root). Client **ignored** it for these sparks and used `HIT_EFFECT_Y` / parry hand Y. Presentation now authors those spark heights explicitly (`366` / `388`) so contact Y matches the approved look.

---

## Event-contract extensions

New event types: `GS_HIT`, `GS_PARRY`.  
New optional compact fields (when relevant): `slapStage`, `chargeTier`.  
No new Socket.IO channel.

Invariants from Phase 6 still hold: one resolved interaction → one logical presentation event; dedupe by `eventId`; presentation never decides combat.

---

## Profiles

`GS_SLAP_HIT`, `GS_SLAP_PARRY`, `GS_PALM_HIT`, `GS_PALM_PARRY`, `GS_SHATTER_PALM_HIT`, `GS_CHARGED_HIT`, `GS_CHARGED_PARRY`, `GS_ARMOR_BREAK_HIT`

Charge tiers do **not** get separate sprite profiles (existing art is identical; shake still uses `chargePercentage`).

---

## Contact / orientation

1. Valid tip seam X (`getContactSeamX`) + authored spark Y  
2. Outcome geometric midpoint X at spark Y  
3. Shared root midpoint fallback via `resolveAnchorPoint`

Orientation: hits use **APPROACH** (attacker→defender). Parries use **CONTACT_NORMAL** (defender→attacker) with `localOffsetX: 28` mirrored by normal sign. Root order alone must not flip effects.

---

## Dedup / reset

Unchanged Phase 6 client `claimPresentationEvent` (cap 256).  
`game_reset` / rematch still clear FX + dedupe store.

---

## Intentional visible changes

1. **Spark mirror / facing** for slap/palm/charged hits now follows approach/contact geometry instead of victim `facing` (corrects cross-through / root-order cases). Seam X/Y and assets unchanged.  
2. Attack-parry outward offset for ground strikes is applied via the shared profile (same 28px along normal as Phase 6 aerial), replacing client arithmetic when presentation is present.

No new layers, particles, flashes, or asset generation.

---

## Missing art

None for this migration — existing sheets cover all migrated paths.

---

## Tests

`server-io/test/ground/ground-strike-presentation.test.js`  
Script: `npm run test:ground --prefix server-io`
