# Phase 8B — Clinch Jolt Registration + Dodge/Slide Smoke Hardening

**Date:** 2026-07-31  
**Status:** Complete. No gameplay changes. No new visual effects. No authored Jolt art generated.

---

## 1. Clinch Jolt — diagnosis

Phase 8 placed Jolt on `CLINCH_SEAM` with `CLINCH_EFFECT_MID_Y` (**376**, `PLAYER_MID_Y`). That is chest/face height in the 1280×720 world, so the temporary CSS ring:

- Sat too high (often over faces)
- Read as a portal/target rather than grip compression
- Could feel biased when unilateral fallback nudged toward a fighter

Programmatic event identity was fine; **artistic registration** was wrong.

## 2. Corrected grip-contact anchor

- New anchor: `CLINCH_GRIP_CONTACT`
- Authored height: `CLINCH_GRIP_CONTACT_Y = 338` (forearm / upper-waist seam)
- Unilateral and mutual cores use **shared midpoint X** `(initiator.x + responder.x) / 2`
- Initiator ownership does **not** bias X
- Unilateral orientation may still favor the responder via `MOVEMENT`
- Placement is snapshotted on the presentation event

## 3. Temporary CSS fallback

`ClinchJoltEffect` + CSS remain as an explicit **temporary fallback**:

- `temporaryCssFallback: true` on `CLINCH_JOLT` / `CLINCH_JOLT_MUTUAL` profiles
- `spriteKey: "clinchJoltCssFallback"`
- Repositioned to grip height only — **not** cosmetically redesigned
- **Remove** when the authored sheet ships

Phase 8 single-event / index-0 SFX dedupe preserved.

## 4. Authored Jolt sprite-sheet brief (deferred)

| Spec | Value |
|------|--------|
| Purpose | Clinch **compression** at the shared grip — not a hit spark |
| Frames | ~6–8 |
| Anchor | Shared grip / forearm / upper-waist seam (`CLINCH_GRIP_CONTACT`) |
| Motion | Narrow compressed flash → horizontal opposing curved pressure crescents |
| Accents | Few short icy-white / pale-cyan slivers only |
| Avoid | Circular portal ring, generic explosion, comic lightning, CSS world FX |
| Unilateral | Same core origin; pressure may read more toward responder |
| Mutual | Symmetric expansion |
| Layering | Core over arms; outer crescents readable beyond both silhouettes |

Do not approximate with particles or CSS redesign before art exists.

---

## 5. Dodge / slide smoke — prior path

| Stage | Source |
|-------|--------|
| Predict | `applyPrediction` `dash` → `dashStart` at `penguin.x/y`, dir = `action.direction \|\| facing` |
| Confirm | `isDodging` rising edge → same emitter; suppressed if predict was recent |
| Slide start | `isIceSliding` rising edge → `iceSlideStart` at interp x/y |
| Slide redirect | `isIceSlideReverseHopping` rising edge → **`iceSlideRedirect`** (tighter profile) |
| Trail | Interval emitters using player Y + often facing |

### SLIDE_REDIRECT presentation profile (Phase 8B follow-up)

Same **dodge `dashStart` swoosh** (`dash-smoke-effect`), not landing smoke and not `iceSlideStart` frost.

| Param | `dashStart` (dodge) | `iceSlideRedirect` |
|-------|---------------------|--------------------|
| Sheet | dash-smoke-effect | same |
| Scale | 1.0 | **0.6** |
| Alpha | 0.9 | **0.85** |
| Life | 0.42 | **0.26** |
| Orientation | movement dir; wake behind | same |

**Fix:** reverse-hop peak Y (`GROUND + 16`) must not trip the airborne smoke gate (`GROUND + 8`). `isIceSlideReverseHopping` is treated as grounded for smoke purposes after named aerial checks.

## 6. Proven failure paths

1. **Airborne predict** — `canPredictDash` lacked FLAP / slide-jump / dive / rope / recoil gates → Shift in air spawned smoke  
2. **Wrong Y** — smoke used `penguin.y` / interp Y (airborne or offset)  
3. **Wrong orientation** — fallback to **facing** (inverted vs travel)  
4. **Missing redirect smoke** — accepted bunny-hop reverse never spawned a burst  
5. **Duplicate risk** — predict/confirm / re-renders without shared claim identity for slide redirects  

## 7. Accepted-transition ownership

Client + server helper (`movementSmokePresentation.js` / `combatPresentation/movementSmoke.js`):

- Transitions: `DODGE_START`, `SLIDE_START`, `SLIDE_REDIRECT`
- Stable `move-smoke:…` event ids via `claimPresentationEvent` / claim store
- Predict + confirm share suppress window + claim so confirmation does not double
- Airborne / rejected paths return null (no spawn)

## 8–9. Ground + orientation

- Smoke Y always `MOVEMENT_SMOKE_GROUND_Y` = server `GROUND_LEVEL` (**286**)
- Direction = accepted `dodgeDirection` / `iceSlideDir` / movement dir — **not** facing
- Emitter still owns behind-launch bias (`spawnDashSmoke` xBias)

## 10. Prediction / dedupe

- Existing predict → suppress-on-confirm window kept for dodge SFX/smoke  
- `claimMovementSmoke` prevents replay  
- Redirects use monotonic `sequence` so rapid L-R-L ids stay unique  
- `game_reset` still clears presentation dedupe  

---

## Files

- `server-io/combatPresentationEvent.js` — grip anchor / Jolt Y  
- `server-io/grabActionSystem.js` — jolt contact Y  
- `server-io/movementSmokePresentation.js` — smoke rules + tests  
- `client/src/combatPresentation/movementSmoke.js` + `index.js`  
- `client/src/components/GameFighter.jsx` — predict gates, smoke spawn, redirect  
- `client/src/components/ClinchJoltEffect.jsx` — temporary fallback mark  
- `client/src/components/fighterAssets.js` — `CLINCH_GRIP_CONTACT_Y`  
- `server-io/test/presentation/jolt-and-movement-smoke.test.js`  
- This document  

## Tests

`node --test 'test/presentation/jolt-and-movement-smoke.test.js'`
