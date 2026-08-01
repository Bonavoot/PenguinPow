# Offensive Aerial Phase 6 — Unified Combat Presentation Events

**Date:** 2026-07-31  
**Status:** Complete for FLAP / slide-jump / S-dive category only.  
Shared module later extended by Phase 7 ground strikes — see `GROUND_STRIKE_PRESENTATION_PHASE.md`.  
Rope Jump unchanged.

---

## Inventory (migrated category)

| Path | Medium | Before | After |
|------|--------|--------|-------|
| Body-slam HIT spark | Sprite `HIT_FX.flap` | `contactX` + fixed `FLAP_HIT_EFFECT_Y` | `combatPresentation` CONTACT + `contactY` |
| Body-slam PARRY burst | Sprite SlapParry | `contactX` + fixed hand Y + facing push | Profile offset along contact normal |
| Dive land burst | Particle `flapFastFallLand` | Client phase edge | Same art; deduped touchdown event id |
| Slide-jump / whiff land | Particle `throwLand` | Client phase edge | Same art; deduped |
| Liftoff / wing-beat / dive trail | Particles | Client state edges | **Preserved** (not attack-contact) |
| Screen shake / hitstop | Screen / sim | Existing | **Preserved** |

---

## Event contract

Compact object `combatPresentation` on existing `player_hit` / `raw_parry_success` (no new Socket.IO channel).

| Field | Authority |
|-------|-----------|
| `eventId`, `actionInstanceId` | Authoritative (from attack instance) |
| `eventType`, `outcome`, `moveType`, `profileId` | Authoritative / derived from outcome |
| `x`,`y` | Derived from surface contact + profile local offset |
| `nx`,`ny`, `contactAxis` | Authoritative contact |
| `ax`,`ay` | Derived approach |
| `facing` / `facingHint` / `orientationSource` | Derived |
| `fallback` | Presentation diagnostic (0–4) |

Module: `server-io/combatPresentationEvent.js`  
Client consume: `client/src/combatPresentation/`

---

## Coordinate spaces

1. **Gameplay/world** — server sim (1280×720, Y up)  
2. **Contact surface** — Phase 3 AABB anchors → contact point  
3. **Ground/touchdown** — `(attacker.x, GROUND_LEVEL)`  
4. **CSS render** — `left=(x/1280)*100%`, `bottom=(y/720)*100%`  
5. **Particle canvas** — existing `GAME_H - y` conversion in ParticleEngine  

One placement builder on server; client reads resolved `x/y` (does not re-midpoint when contact exists).

---

## Anchor hierarchy (fallback)

0. Surface-derived contact  
1. Stored contact on action (same fields)  
2. Attacker/defender surface anchors  
3. Outcome geometric (ground for touchdown)  
4. Root midpoint (compatibility last resort)

---

## Profiles

`OA_FLAP_HIT`, `OA_FLAP_PARRY`, `OA_DIVE_HIT`, `OA_DIVE_PARRY`, `OA_DIVE_TOUCHDOWN`, `OA_SLIDE_JUMP_TOUCHDOWN`, `OA_WHIFF_LAND`

Orientation: contact normal for fighter contact; ground-up for touchdown.  
Mirroring: local X offset along contact normal sign (not root order).

---

## Dedup / reset

- Client `claimPresentationEvent(eventId)` (bounded 256)  
- Round `game_reset` clears hit/parry FX state + dedupe store  
- Old `actionInstanceId` cannot mint the same `eventId` as a newer instance  

---

## Debug

Combat-fidelity overlay (still throttled / cached / hidden-skip) shows last presentation placement for ~4s.
