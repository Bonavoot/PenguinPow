# Offensive Aerial Outcome Contract — Phase 1 (+ Phase 3 contact + Phase 4 reaction)

**Status:** Implemented (2026-07-31). Behavior-preserving architecture hardening.  
Module: `server-io/offensiveAerialOutcome.js`  
Contact geometry: `server-io/offensiveAerialContact.js` (Phase 3 — metadata only).  
Post-contact reaction: `server-io/offensiveAerialReaction.js` (Phase 4 — `OFFENSIVE_AERIAL_REACTION_V2` default ON, approved `heavy_short`; `=0` → Phase 3 legacy).  
Facing / presentation ownership: `server-io/offensiveAerialFacing.js` + `offensiveAerialPresentation.js` (Phase 5A — instance-tied facing locks; see `OFFENSIVE_AERIAL_STATE_FACING_PHASE.md`).  
Combat FX events: `server-io/combatPresentationEvent.js` (Phase 6 — compact `combatPresentation` on existing hit/parry sockets; see `OFFENSIVE_AERIAL_PRESENTATION_EVENTS_PHASE.md`).

---

## Outcome enum

| Value | Active this phase? | Meaning |
|-------|--------------------|---------|
| `NONE` | Yes | Activation live; no terminal result yet |
| `HIT` | Yes | Shared slam connected |
| `PARRIED` | Yes | `resolveFlapRawParry` won |
| `WHIFF` | Yes | Armed activation ended at touchdown without contact |
| `INTERRUPTED` | Yes | Armed activation cancelled mid-air (`clearAllActionStates`) |
| `LANDED_WITHOUT_CONTACT` | Yes | Plain (unarmed) slide-jump touchdown |
| `TRADE` | Reserved | Unused |
| `CLASH` | Reserved | Unused |
| `ARMORED` | Reserved | Unused (slam still bypasses thick blubber) |

---

## Attack-instance identity

- Field: `player.offensiveAerial.attackInstanceId`
- Format: `${playerId}:oa:${seq}` where `seq` is monotonic `player._offensiveAerialSeq`
- Minted only by `beginOffensiveAerialActivation` (or ensure-for-contact)
- **Not** reminted on detector re-poll (idempotent begin without `forceNew`)
- New ID on FLAP-armed takeoff (`forceNew`) and on each new dive/FLAP activation after prior finalize
- Cleared on finalize / full reset; seq persists across a match for uniqueness (zeroed on round/player reset)

Cooperates with existing `slideJumpHitLanded` latch — does not replace it.

---

## Activation arming rules (current mapping)

| Event | Activation |
|-------|------------|
| Plain slide-jump takeoff | **None** (movement only) |
| FLAP-armed takeoff | New `FLAP_SLIDE_JUMP`, `offensiveArmed=true`, outcome `NONE` |
| S-dive commit | Begin or upgrade to `BODY_SLAM_DIVE`, armed |
| Ambient plain slam hit/parry | `ensure…ForContact` creates armed activation then resolves |
| Touchdown, armed, still `NONE` | → `WHIFF` |
| Touchdown, no armed activation | → `LANDED_WITHOUT_CONTACT` |
| Touchdown after `HIT`/`PARRIED` | Preserve terminal; mark touchdown handoff |

---

## Legal transitions

```
NONE → HIT | PARRIED | WHIFF | INTERRUPTED | LANDED_WITHOUT_CONTACT
```

- First terminal wins
- Identical re-resolve → idempotent OK
- Conflicting second terminal → rejected (debug counter; no throw)

## Illegal transitions (rejected)

- `HIT` → `PARRIED` / `WHIFF` / …
- `PARRIED` → `HIT` / …
- Any terminal → different terminal

---

## Contact consumption

`contactConsumed=true` on `HIT` / `PARRIED` (and reserved contact terminals).  
`isBodySlamWindowOpen` treats latch **or** `contactConsumed` as hitbox-dead.

---

## Record fields (compact)

`attackInstanceId`, `moveType`, `outcome`, `resolved`, `resolvedTick`, `resolvedTime`, `contactConsumed`, `contactTargetId`, `contactX`, `contactY`, `contactNormalX`, `contactNormalY`, `contactAxis`, `geometrySource`, `fallbackUsed`, `sideBeforeContact`, `sideAfterContact`, `movementOwner`, `landingHandoffReason`, `cleanupStage`, `debugReason`, `offensiveArmed`

### Contact metadata rules (Phase 3)

- Written only on `HIT` / `PARRIED`, **before** cleanup can erase active geometry
- Computed by `computeOffensiveAerialContact` after the existing detector accepts the candidate
- First write wins; duplicate identical poll is idempotent; conflicting second write rejected (`_offensiveAerialContactWriteRejects`)
- Touchdown / recovery must not replace HIT/PARRIED contact; full reset clears
- `WHIFF` / `INTERRUPTED` / `LANDED_WITHOUT_CONTACT`: no fabricated combat contact (`contactX/Y` null)

Convention: normal defender→attacker; shared point = midpoint of surface anchors. See `OFFENSIVE_AERIAL_CONTACT_FIDELITY.md`.

Not on production delta wire by default (effect events may carry `contactX/Y`).

---

## Authoritative write API

| Helper | Role |
|--------|------|
| `beginOffensiveAerialActivation` | Create / upgrade activation |
| `ensureOffensiveAerialActivationForContact` | Ambient slam ensure |
| `resolveOffensiveAerialOutcome` | Terminal resolve + conflict guard |
| `resolveOffensiveAerialTouchdownTerminal` | WHIFF / LANDED_WITHOUT_CONTACT / preserve |
| `markOffensiveAerialLandingHandoff` | Touchdown cleanup stage |
| `finalizeOffensiveAerialActivation` | Recovery complete → null |
| `resetOffensiveAerialActivation` | Full reset (+ optional INTERRUPTED) |
| `canCleanupOffensiveAerialInstance` | Stale-owner gate |

---

## Resolution order (unchanged)

Early-pair pushbox → tip sep → strikes → slam (+ optional post-integrate slam) → raw-parry branch before damage → latch.

See `OFFENSIVE_AERIAL_CLEANUP_CONTRACT.md` for cleanup stages.

## Phase 4 reaction (flagged)

When `OFFENSIVE_AERIAL_REACTION_V2` is ON (default), terminal `HIT` / `PARRIED` select a post-contact reaction (`HIT_CONTINUATION` / `PARRIED_RECOIL`) on the same attack-instance ID. Explicit `=0` leaves movement/anim on Phase 3 paths. See `OFFENSIVE_AERIAL_POST_CONTACT_REACTIONS.md`.
