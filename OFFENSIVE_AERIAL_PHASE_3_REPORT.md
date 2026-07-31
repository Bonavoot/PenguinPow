# Offensive Aerial Phase 3 Report — Shared Slam Contact Fidelity

**Date:** 2026-07-31  
**Status:** Complete. Stop after this phase.

---

## 1. Baseline (pre-change)

| Suite | Result |
|-------|--------|
| Full server | 566/566 |
| Landing | 171/171 |
| Offensive-aerial | 92/92 |

Midpoint-only `contactX = (ax+dx)/2` (often without `contactY`) drove effects toward root midpoints.

---

## 2–9. Contact model (summary)

See `OFFENSIVE_AERIAL_CONTACT_FIDELITY.md`.

- **Helper:** `server-io/offensiveAerialContact.js` — `computeOffensiveAerialContact`
- **Convention:** defender→attacker normal; shared point = midpoint of surface anchors
- **Lateral:** facing-edge AABB anchors; horizontal normal
- **Downward:** lower-attacker / upper-defender; dive + `|relVx|` → diagonal
- **Crossing:** geometry + velocity; contact immutable after first write
- **Same-center:** deterministic tie-break; `DEGENERATE_FALLBACK`
- **Classification:** `LATERAL` / `DOWNWARD` / `DOWNWARD_DIAGONAL` / `DEGENERATE_FALLBACK` (metadata only)

---

## 10–12. Integration

- Outcome writes compact contact before cleanup; rejects overwrite / stale owner
- `player_hit` / `raw_parry_success` emit `contactX`/`contactY` (+ optional normals for debug)
- Client `contactFxX` prefers `data.contactX`; no art redesign

---

## 13. Strike-contact reuse

Surface-anchor / seam spirit reused; tip-rail model **not** forced onto body slam.

---

## 14–18. Behavior preserved

Eligibility, damage, knockback, hitstop, stagger, post-hit movement, raw-parry grounding, whiff descent, landing/recovery, Rope Jump — unchanged. Hit/parry ticks unchanged by design (detector unchanged; contact computed after).

---

## 19–22. Quantitative scan (11 samples)

| Metric | Value |
|--------|------:|
| Max midpoint→new Δ | ~43.6 px |
| Median Δ | ~31.1 px |
| Max surface-anchor gap | ~50.5 px |
| Fallbacks | 1 |

---

## 23. Debug / trace

`offensiveAerialTrace.js` + combat debug overlay: instance id, axis, contact/anchors/normals, relV, penetration, midpoint delta, geometrySource, fallback, contact-write rejects.

---

## 24–25. Files / tests

**New:** `offensiveAerialContact.js`, `test/aerial/contact-fidelity.test.js`, this report + `OFFENSIVE_AERIAL_CONTACT_FIDELITY.md`

**Touched:** `collisionSystem.js`, `offensiveAerialOutcome.js`, `offensiveAerialTrace.js`, aerial helpers, `CombatFidelityDebug.js`, fidelity docs

**Tests:** contact-fidelity suite (preservation, lateral, downward, parry, outcome, degenerate, presentation + scan)

---

## 26–30. Verification (post-change)

| Check | Result |
|-------|--------|
| Full server | 584/584 |
| Landing | 171/171 |
| Offensive-aerial | 110/110 |
| Contact suite | included in aerial |
| Client lint (`eslint src/debug/CombatFidelityDebug.js`) | clean (no findings) |
| Vite build (`cd client && npx vite build`) | success (~4.9s) |

---

## 31–32. Confirmations

- No gameplay tuning (damage/KB/timing/movement)
- Rope Jump untouched

---

## 33. Remaining contact limitations

- Authoritative AABB (not pose silhouettes)
- Vertical band still uses fixed slam contact height
- Client may still ignore `contactY` for some FX paths
- Classification unused by reactions until a later phase

---

## 34. Recommended next phase

**Phase 4 — Post-contact reaction & landing handoff:** use stored contact axis/normal for professional hit continuation and parried-airborne recoil/tumble **without** changing contact eligibility or damage tables.
