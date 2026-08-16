# Rope Jump V2 — Polish Rejection & Final Approval

**Status:** Rounded polish **rejected** · `reference_contact_9` **manually approved** · V2 **default ON**  
**Date:** 2026-07-31

Parent identity: [`ROPE_JUMP_MOVE_IDENTITY_V2.md`](./ROPE_JUMP_MOVE_IDENTITY_V2.md)

---

## Playtest verdict (historical)

C1 Hermite/`smooth_hermite_c1` polish (`rounded`) improved measured horizontal velocity continuity but **looked and felt worse**:

- Path read more triangular / as separate straight segments  
- Jump felt floatier; penguins lighter / less forceful  
- Pre-polish **reference** trajectory communicated weight, decisiveness, and commitment better  

**Game feel overrode favorable numeric continuity metrics.** Contact allowance **9** was chosen as the approved midpoint (between historical 12 and tighter 6). Trajectory and landing-overlap were evaluated independently.

---

## Approved candidate: `reference_contact_9`

| Property | Value |
|----------|-------|
| Airborne trajectory | Exact pre-polish **reference** |
| Apex height | **156** |
| H travel by apex | **75%** |
| Curve model | **`piecewise_linear_sincos`** |
| Decision / apex `t` | **0.42** |
| Settle allowance | **9** |
| Landing contact (0.85/0.85) | **101.5** |
| Endpoint correction cap | **40** |
| Durations | startup 166 / active 450 / recovery 183 |

`intended` aliases this approved preset. Historical contact variants (`reference` / `_12` / `_6`) remain internal only.

---

## Rejected: `rounded_rejected_floaty`

Alias: `rounded`. Marked `rejected: true`. Not default, not `intended`.

---

## Defaults & rollback

```bash
npm run dev:web
# → V2 on, preset reference_contact_9

ROPE_JUMP_LANDING_V2=0 npm run dev:web
# → legacy rope jump
```

Current default: V2 on, preset `reference_contact_9`.
