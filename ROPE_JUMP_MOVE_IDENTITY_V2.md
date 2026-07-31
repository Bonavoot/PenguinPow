# Rope Jump Move Identity V2 — High Vault

**Status:** **Manually approved** · **Default ON** · Preset `reference_contact_9`  
**Date finalized:** 2026-07-31

Companion: [`AERIAL_LANDING_PHASE_A3_2.md`](./AERIAL_LANDING_PHASE_A3_2.md) · [`ROPE_JUMP_V2_POLISH_TUNING.md`](./ROPE_JUMP_V2_POLISH_TUNING.md)

---

## Final approval

| Item | Value |
|------|-------|
| Approved preset | **`reference_contact_9`** |
| Apex height | **156** |
| Horizontal travel by apex | **75%** |
| Crossover decision `t` | **0.42** |
| Curve model | `piecewise_linear_sincos` |
| Landing settle allowance | **9** |
| Landing-contact distance (0.85/0.85) | **101.5** |
| Endpoint-correction cap | **40** |
| Vulnerability | startup / landing vulnerable; airborne protected |
| Landing settle | A.3.2 (monotonic + recovery re-intrusion monitoring) |
| Default | **ON** for normal `npm run dev:web` |
| Legacy rollback | `ROPE_JUMP_LANDING_V2=0 npm run dev:web` |
| Rejected polish | `rounded_rejected_floaty` (floatier / more triangular in motion) |

No additional rope-jump tuning is currently authorized. Slide jump / FLAP / other aerials are **not** updated by this work.

---

## Move identity

Rope jump is a **high, committed, non-attacking corner-escape vault**.

| Property | Rule |
|----------|------|
| Availability | Near rope / map boundary |
| Startup | Readable, **vulnerable** |
| Airborne | **Protected**, non-offensive, pass-through |
| Path | Strong rise → apex crossover lock → steep descent |
| Opponent influence | Side class + capped endpoint correction only |
| Landing | A.3.2 settle owns residual / re-intrusion |
| Recovery | Fully **vulnerable**; duration unchanged |

---

## Environment

| Flag | Default | Notes |
|------|---------|-------|
| `ROPE_JUMP_LANDING_V2` | **ON** (unset) | `0` / `false` → legacy |
| `ROPE_JUMP_VAULT_PRESET` | `reference_contact_9` | Invalid names fall back here |

```bash
npm run dev:web
ROPE_JUMP_LANDING_V2=0 npm run dev:web   # legacy emergency rollback
```

Parsing is centralized in `server-io/landingFlags.js` → `parseRopeJumpLandingV2Flag`.

---

*Finalization stop gate. Do not retune the vault or expand to other aerial verbs in this conversation.*
