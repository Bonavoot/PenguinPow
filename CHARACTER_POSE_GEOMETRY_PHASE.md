# Character Pose Geometry Phase 11

**Date:** 2026-07-31  
**Status:** Manually approved. **`FIGHTER_POSE_GEOMETRY_V2` default ON.**

No artwork changes. No gameplay movement / collision / timing changes.  
Phases 1–10 presentation placements preserved. Movement-smoke baselines untouched.

---

## Manual approval summary

Playtesting approved V2. Findings:

- Most active fighter assets were already consistently authored for the shared CSS box / sole convention.
- **No broad visual correction was necessary** — the registry applies identity offsets for active poses.
- Charged-headbutt separation from the ground is **intentional flight**, not floating; airborne classification preserves legacy vertical placement (offset **0**).
- V2 is therefore the normal default for `npm run dev:web`.
- Exact legacy rendering remains available via explicit rollback.

---

## Feature flag / rollback

```bash
npm run dev:web                              # V2 on (approved default)
FIGHTER_POSE_GEOMETRY_V2=0 npm run dev:web   # exact legacy rendering
FIGHTER_POSE_GEOMETRY_V2=false npm run dev:web
```

| Value | Mode |
|-------|------|
| unset / `""` | V2 |
| `1` / `true` | V2 |
| `0` / `false` | Legacy |

Vite `envPrefix` includes `FIGHTER_`. Flag affects **client presentation coordinates only**.

---

## Coordinate contract

| Concept | Meaning | Authority |
|---------|---------|-----------|
| Server / gameplay position | Sim `x,y` | Server — unchanged |
| Fighter gameplay root | Client interpolated gameplay `x,y` | Prediction / server — unchanged |
| Client render root | CSS `left`/`bottom` for the sprite box | Presentation (V2 path; identity today) |
| Sprite local origin | CSS box bottom-center (`translate:-50%`) | Legacy layout |
| Visual pivot | Normalized `(pivotX, pivotY)` | Registry |
| Ground support point | Only for truly grounded poses | Registry |
| Airborne pivot | Follow gameplay Y; **no** sole ground-snap | Registry `grounded:false` |
| Contact / effect anchors | World-space from Phases 6–10 | Unchanged |

**Principle:** Gameplay coordinates remain authoritative. Transparent padding is **not** evidence that a flying pose should touch the ground.

---

## Charged headbutt

| Phase | Art | Registration |
|-------|-----|----------------|
| Charge hold | `charging.png` | `charging` — grounded, offset **0** |
| Flight | `attack.png` | `charged_attack` — **airborne**, offset **0**, pivot stable |
| Recovery | `recovering.png` | `recovering` — grounded after touchdown, offset **0** |

Resolved by presentation state (`charging` / `charged_flight` / `recovering`) plus sprite src.

---

## Active visible corrections

**None required.** No `supportFromBottomPct` sole corrections are active. Registry/tooling remains for future proven defects without inventing offsets.

Approved invariants preserved:

- Pose offsets / ground support / airborne pivots (identity / intentional flight)
- Charged-headbutt placement
- Mirroring / accessories
- Effect placement (Phases 6–10)
- Jolt grip-contact registration
- Raw-dodge smoke offset **10**
- Slide-redirect smoke offset **0**
- Incoming-side projectile parry

---

## POSE_GEOMETRY_MISSING_ART_NEEDS

| Transition / pose | Fallback today | Why registration fails | Art needed |
|-------------------|----------------|------------------------|------------|
| Hitstun (`hit.png` 480) | Scaled into 12.3% box | Non-960 padding/bias unreliable | 960 hitstun with shared sole guide |
| At-the-ropes (`at-the-ropes.png` 480) | Scaled + ad-hoc width | Strong H bias / edge clip | 960 ropes pose |
| Crouch (`crouch-stance.png` 600) | Scaled | Soft H mismatch vs idle | Optional 960 crouch |
| Perfect-parried APNG path | Missing / alt name in audit | Asset path inconsistency | Confirm live APNG |

---

## Tests

`node --test 'test/pose/pose-geometry.test.js'`

## Audit (read-only)

```bash
npm run audit:pose-geometry
```
