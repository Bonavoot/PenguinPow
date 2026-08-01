# Rope Jump Free-Flight Trajectory — Phase 17

## Status

**Finalized:** **`ROPE_JUMP_FLIGHT_CURVE_V3`** default **ON**. Manually approved preset: **`smooth_long_20`**.

```bash
npm run dev:web
# unset / 1 / true → V3
# unset preset → smooth_long_20
```

Exact pre-V3 reference rollback:

```bash
ROPE_JUMP_FLIGHT_CURVE_V3=0 npm run dev:web
# also: false
```

Related:

* `ROPE_JUMP_LANDING_V2` default ON → `reference_contact_9` for nearby / vault settle
* `INPUT_COMMAND_RELIABILITY_V2` default ON (unchanged by this finalization)

No further apex, gravity, speed, range, or slide-jump matching was requested.

---

## Approved free-flight identity

A smoother, moderately longer committed Rope Jump in free flight / whiff — continuous ballistic arc, heavy descent, same timing windows as the pre-V3 move.

`smooth_same_range` and `smooth_long_30` remain explicitly selectable for development comparison only; they were **not** production-selected.

---

## Existing reference path (verified)

| Quantity | Value |
| -------- | ----- |
| Nearby preset | `reference_contact_9` |
| Nearby curve | `piecewise_linear_sincos` (frozen when opponent-influenced) |
| Apex height | 156 |
| Apex / decision `t` | 0.42 |
| H progress @ apex | 0.75 |
| Settle allowance | 9 → contact ~101.5 (0.85/0.85) |
| Base range (left rope) | ~98.175 px (`CENTER_FRACTION` 0.33) |
| Startup / active / recovery | 166 / 450 / 183 ms |
| Airborne protection | entire active phase |
| Commitment | one lock at `decisionT` 0.42 |

Nearby-opponent behavior remains the **frozen** `OPPONENT_INFLUENCED_REFERENCE` path (maximum positional delta **0** vs pre-V3).

### Proven triangular-arc cause

Piecewise-linear horizontal progress (rate kink at apex) combined with sin/cos vertical halves produced a corner-like apex in free flight. Free-flight V3 replaces that only when the opponent does not influence landing.

---

## Trajectory classification

Modes (per jump instance, first active tick):

* `OPPONENT_INFLUENCED_REFERENCE` — approved nearby path, frozen
* `FREE_FLIGHT` — smooth ballistic + Hermite horizontal, optional longer range

**Predicate:** existing `decideApexCrossover` on the **base** raw footprint (never the extended free-flight endpoint). Influence ⇔ `intentClass !== "preserve_raw"`.

**Commitment:** mode + planned endpoint lock on first active tick. Free-flight commit forces `preserve_raw` so late opponent motion cannot create a new cross-up. Rematch/reset clears classification.

---

## Free-flight curve (approved)

* Vertical: `ballistic_c1` — `vy → 0` at apex; C1 join; no plateau
* Horizontal: `smooth_hermite_c1`
* Apex height / `apexT` / H@apex / timing windows preserved
* Gameplay root = rendered root (no client visual offset)

---

## Presets (`ROPE_JUMP_FLIGHT_PRESET`)

| Preset | `rangeMult` | Left-rope range (px) | Production |
| ------ | ----------- | -------------------- | ---------- |
| `smooth_same_range` | 1.0 | 98.175 | Dev only |
| **`smooth_long_20`** | **1.2** | **117.81** | **Approved default** |
| `smooth_long_30` | 1.3 | 127.628 | Dev only |

Unset preset → `smooth_long_20`.

---

## Range / timing / velocity (left-rope authored path)

| Path | Range | Apex | H@apex | Active | Max \|Hx\| | Max up | Max down | Protected | Recovery | Control restore |
| ---- | ----- | ---- | ------ | ------ | --------- | ------ | -------- | --------- | -------- | --------------- |
| Pre-V3 reference (influenced / V3=0 free) | 98.175 | 156 / 0.42 | 0.75 | 450 | ~390 | ~1296 | ~939 | 450 | 183 | 799 |
| `smooth_same_range` | 98.175 | same | 0.75 | 450 | ~494 | ~1631 | ~1185 | 450 | 183 | 799 |
| **`smooth_long_20`** | **117.81** | same | 0.75 | 450 | ~592 | ~1631 | ~1185 | 450 | 183 | 799 |
| `smooth_long_30` | 127.63 | same | 0.75 | 450 | ~642 | ~1631 | ~1185 | 450 | 183 | 799 |

Invulnerability is **not** scaled with range.

---

## Interaction-safety rules

1. Influenced opponents → exact reference branch (Δ = 0).
2. Free-flight range cannot expand the influence envelope (classification uses base raw).
3. Free-flight destination constrained to near-side contact vs non-influencing opponents — no new cross-up.
4. No new hitbox / throw / invuln / recovery changes.
5. No final-tick mode snap; boundary clamps shorten the curve target (no long-curve teleport).

---

## Flag relationship

| Flag | Default | Role |
| ---- | ------- | ---- |
| `ROPE_JUMP_LANDING_V2` | ON | High-vault landing system |
| `ROPE_JUMP_VAULT_PRESET` | `reference_contact_9` | Nearby / reference traj + settle |
| `ROPE_JUMP_FLIGHT_CURVE_V3` | **ON** | FREE_FLIGHT vs REFERENCE split |
| `ROPE_JUMP_FLIGHT_PRESET` | **`smooth_long_20`** | Free-flight candidate when V3 ON |

---

## Manual rollback / comparison

```bash
# Production default
npm run dev:web

# Exact pre-V3 reference
ROPE_JUMP_FLIGHT_CURVE_V3=0 npm run dev:web

# Dev presets (optional)
ROPE_JUMP_FLIGHT_CURVE_V3=1 ROPE_JUMP_FLIGHT_PRESET=smooth_same_range npm run dev:web
ROPE_JUMP_FLIGHT_CURVE_V3=1 ROPE_JUMP_FLIGHT_PRESET=smooth_long_30 npm run dev:web
```

---

## Remaining art needs

Deferred: Rope Jump transition art, pose/SFX/smoke, clinch hand/belt presentation. Trajectory-only; no further physics matching requested.

## Recommended preset

**`smooth_long_20`** — manually approved and production default.
