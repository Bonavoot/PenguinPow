# Offensive Aerial Phase 4 Report — Post-Contact Reaction & Landing Handoff

**Date:** 2026-07-31  
**Status:** Complete. **`heavy_short` manually approved; V2 default ON.**

---

## Finalization (approved candidate)

| Item | Value |
|------|--------|
| Flag | `OFFENSIVE_AERIAL_REACTION_V2` **default ON** |
| Preset | `heavy_short` (unset env → heavy_short) |
| Rollback | `OFFENSIVE_AERIAL_REACTION_V2=0 npm run dev:web` → Phase 3 legacy snap |
| Identity | Heavy continuation into landing after parry reject — not floaty/upward/large-H rebound |
| Phase 5 settle | **Deferred** — playtest found no meaningful overlap / side-switch / first-grounded snap |

No reaction values or combat numbers were retuned at finalization.

---

## 1. Baseline (pre-Phase-4)

| Suite | Result |
|-------|--------|
| Full server | 584/584 |
| Landing | 171/171 |
| Offensive-aerial | 110/110 |

---

## 2–14. Model summary

See `OFFENSIVE_AERIAL_POST_CONTACT_REACTIONS.md` and `OFFENSIVE_AERIAL_LANDING_HANDOFF.md`.

---

## 15–21. Control / quantitative (`heavy_short` scan)

| Metric | Value |
|--------|------:|
| Legacy contact→control | 500 ms (`AP_STAGGER_FLAP_MS`) |
| V2 min (scan) | ~516 ms |
| V2 max (scan heights 40–100) | ~516 ms |
| Max upward recoil | ~0 (immediate heavy fall) |
| Max horizontal recoil | ~8 px (scan) |

---

## 25–27. Debug / presets

- Trace + overlay extended  
- Candidate / approved preset: **`heavy_short`**

---

## Verification (post-finalization)

| Check | Result |
|-------|--------|
| Full server | **613/613** |
| Landing | **171/171** |
| Offensive-aerial | **139/139** (incl. `reaction-v2-defaults.test.js`) |
| Vite build | success (no sprite bake) |

---

## Confirmations

- Attack eligibility, damage, defender KB, active frames, parry timing unchanged at finalization  
- Rope Jump untouched  
- Reaction physics values frozen to approved `heavy_short` constants  

---

## Manual playtest (approved)

```bash
npm run dev:web
```

Legacy rollback:

```bash
OFFENSIVE_AERIAL_REACTION_V2=0 npm run dev:web
```

---

## Recommended next (do not auto-start)

Phase 5 generalized landing settle remains available if future playtests reveal overlap/snap issues; not justified by current approval notes.
