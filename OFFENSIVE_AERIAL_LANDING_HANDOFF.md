# Offensive Aerial Landing Handoff — Phase 4

**Status:** Live with Reaction V2 (**default ON**, approved `heavy_short`).  
Rollback: `OFFENSIVE_AERIAL_REACTION_V2=0`.  
Companions: `OFFENSIVE_AERIAL_POST_CONTACT_REACTIONS.md`, `offensiveAerialReaction.js`

Generalized landing settle remains **deferred** — manual approval of `heavy_short` found no meaningful overlap, side-switch, or first-grounded-snap problems. This module hands off ownership and may still instrument overlap for a future Phase 5.

---

## Touchdown reasons

| Reason | When |
|--------|------|
| `HIT_CONTINUATION_TOUCHDOWN` | After successful slam flight |
| `PARRIED_RECOIL_TOUCHDOWN` | After V2 parry recoil lands |
| `WHIFF_TOUCHDOWN` | Armed activation, no contact |
| `INTERRUPTED_TOUCHDOWN` | Interrupted mid-air (bookkeeping) |
| `PLAIN_SLIDE_JUMP_TOUCHDOWN` | Unarmed / `LANDED_WITHOUT_CONTACT` |

These are **not** a second outcome enum. Outcome stays on `offensiveAerial.outcome`.

---

## Handoff sequence

1. Contact resolves → reaction selected (HIT/PARRIED) or flight continues (whiff)
2. Aerial integrator or `stepParriedRecoil` runs until `y <= GROUND`
3. Snap Y, zero air velocities, `slideJumpPhase = landing`
4. `resolveOffensiveAerialTouchdownTerminal` (preserve HIT/PARRIED; set WHIFF / plain)
5. `applyOffensiveAerialTouchdownHandoff` — one recovery, control deadline, cleanup stage `TOUCHDOWN_HANDOFF`
6. Landing recovery tick until control restore / recovery expiry
7. `clearSlideJumpState` + `completeOffensiveAerialReaction`

Duplicate touchdown calls increment `_offensiveAerialDuplicateTouchdownRejects` and no-op.

---

## Preserved at handoff

- Attack-instance ID  
- Original outcome + contact metadata  
- Reaction contact side / normals  
- Touchdown X/Y / side  
- `controlRestoreAt` / `recoveryEndsAt`  
- Cleanup stage  

---

## Spacing (instrument only)

`recordTouchdownSpacingMetrics` may store:

- `touchdownOverlap` (approximate)
- `firstGroundedCorrection`

No large airborne endpoint correction. No Rope Jump vault reuse. Generic grounded pushbox remains.

---

## Cleanup

| Stage | Reaction |
|-------|----------|
| Contact | `CONTACT_CONSUMED` |
| Touchdown | `TOUCHDOWN_HANDOFF` + `LANDING_RECOVERY` |
| Recovery end | `COMPLETE` / null reaction + finalize outcome |
| Full reset | `resetOffensiveAerialReaction` |
