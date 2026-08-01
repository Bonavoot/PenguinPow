# OFFENSIVE_AERIAL_EFFECT_ART_NEEDS

After Phase 6 placement migration (no new art authored). Distinguishes gaps from placement bugs already fixed.

| Move | Outcome | Existing effect | Why insufficient | Need | Anchor | Orientation | Role / duration | Particle OK meantime? |
|------|---------|-----------------|------------------|------|--------|-------------|-----------------|------------------------|
| FLAP / S-dive | PARRIED | SlapParry grab-break sheet | Shared with ground AP; reads as hand-deflect, not aerial reject | Short “belly-slam stuffed” burst (2–4 frames) | CONTACT | Contact normal | ~300–400ms reject flash | Partial ice chips only |
| FLAP | HIT continuation travel | None (spark at contact only) | No follow-through streak after connect | Optional short body-trail puff (3 frames) | ATTACKER_ROOT | Approach | ~150ms | `flapWingBeat`-like puffs OK |
| S-dive | Ground touchdown | `flapFastFallLand` particles | Strong; no dedicated belly-plant sprite | Optional 1-frame ground impact stamp | GROUND_CONTACT | Ground up | ~1 frame + particles | **Yes — current particles adequate** |
| FLAP | WHIFF land | `throwLand` | Generic land dust; acceptable | None required | GROUND_CONTACT | Ground up | — | Yes |

### Classification

| Issue | Status |
|-------|--------|
| HIT/PARRY Y ignored contact (fixed Y constants) | **Placement bug — fixed in Phase 6** |
| Missing dedicated aerial-parry sheet | Missing artwork |
| Dive land particles | Existing artwork — preserve |
| Liftoff / trail particles | Existing — preserve |
| Particle-profile weakness | None blocking |
| State/lifecycle double-spark | Deduped via `eventId` |
