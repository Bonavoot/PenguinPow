# Aerial Landing — Phase A (Rope Jump Only)

**Status (historical build-up):** Implemented behind feature flag through A…A.3.2 + move identity.  
**Final outcome (2026-07-31):** Rope Jump V2 **manually approved** and **default ON** (`reference_contact_9`). See [`ROPE_JUMP_MOVE_IDENTITY_V2.md`](./ROPE_JUMP_MOVE_IDENTITY_V2.md).  
**Scope stop:** Rope jump only. Slide jump / FLAP / butt slam are **not** integrated.

The bullet history below records the phase sequence as written during development (when V2 was still default OFF). It is retained for context; the live default is now ON.

**Phase A.1 (trajectory hardening):** See [`AERIAL_LANDING_PHASE_A1.md`](./AERIAL_LANDING_PHASE_A1.md). Phase A’s position-only rebase caused measurable midair speed pops, late reverses, and forced cross-ups; A.1 replaces that path model while keeping V2 default OFF *(at the time)*.

**Phase A.2 (decision stability):** See [`AERIAL_LANDING_PHASE_A2.md`](./AERIAL_LANDING_PHASE_A2.md). A.1 left subpixel decision cliffs (~200 px endpoint flips); A.2 separates side intent, commit timing, and same-side endpoint refinement. V2 still default OFF *(at the time)*. A.1 was **not** visually approved.

**Phase A.3 (dynamic conflict):** See [`AERIAL_LANDING_PHASE_A3.md`](./AERIAL_LANDING_PHASE_A3.md). A.2 locked `preserve_raw` irreversibly on the first clear planning tick; ordinary ice approach recreated land-inside→multi-tick sep. A.3 makes raw-clear provisional and replans on pre-commit conflict. V2 still default OFF *(at the time)*.

**Phase A.3.1 (late-intrusion settle):** See [`AERIAL_LANDING_PHASE_A3_1.md`](./AERIAL_LANDING_PHASE_A3_1.md). A.3’s one-tick late freeze left residual that snapped after recovery; A.3.1 settles monotonically through recovery-exit. V2 still default OFF *(at the time)*.

**Phase A.3.2 (recovery re-intrusion):** See [`AERIAL_LANDING_PHASE_A3_2.md`](./AERIAL_LANDING_PHASE_A3_2.md). A.3.1’s sticky `recovery_safe_to_release` ignored post-touchdown walk-ins; A.3.2 monitors until release. V2 still default OFF *(at the time)*.

**Move identity (high vault):** See [`ROPE_JUMP_MOVE_IDENTITY_V2.md`](./ROPE_JUMP_MOVE_IDENTITY_V2.md). Authored high vault + apex crossover + capped endpoint correction; A.3.2 settle retained. **Now approved / default ON.**

Companion: [`COMBAT_FIDELITY_AUDIT.md`](./COMBAT_FIDELITY_AUDIT.md), [`COMBAT_FIDELITY_ROADMAP.md`](./COMBAT_FIDELITY_ROADMAP.md) Phase 3.

---

## Confirmed legacy behavior

1. Near a map boundary, W + forward starts a rope jump.
2. `socketHandlers.js` / `cpuAI.js` set `ropeJumpTargetX = startX + (mid − startX) * ROPE_JUMP_CENTER_FRACTION` (opponent ignored).
3. During `ropeJumpPhase === "active"`, ground pushbox is disabled (bodies may share an X column).
4. Arc eases X toward that fixed target; Y follows `ROPE_JUMP_ARC_HEIGHT * 4t(1−t)`.
5. At `t ≥ 1`: phase → `landing`, `x = ropeJumpTargetX`, `y = GROUND_LEVEL`.
6. Pushbox re-enables. Overlap is corrected at **≤ 18 px/tick** in `adjustPlayerPositions`.
7. Deep conflict (~110 px at default size) ⇒ ~7 correction ticks (~109 ms) of grounded slide.

This is the “land inside → push out” path. Phase A replaces it for rope jump only when V2 is on.

---

## Resolver contract

**Module:** `server-io/landingResolution.js`  
**Flag:** `server-io/landingFlags.js` → `ROPE_JUMP_LANDING_V2`

```js
resolveLandingTarget({
  rawTargetX,
  jumperStartX,
  jumperCurrentX,
  jumpDirection,      // +1 rightward escape, -1 leftward
  opponentX,
  jumperHalfWidth,    // from getPushboxHalfWidth(sizeMultiplier)
  opponentHalfWidth,
  mapLeft,
  mapRight,
  preferredSide,      // optional override for tests
})
```

**Output (decision record):**  
`rawTargetX`, `resolvedTargetX`, `preferredSide`, `resolvedSide`, `minimumDistance`, `rawOverlap`, `boundaryLimited`, `usedFallback`, `fallbackReason`, plus geometry inputs.

**Physical language:** half-widths match `calculateEffectiveHitboxSize` / `HITBOX_DISTANCE_VALUE * sizeMultiplier`. Minimum center distance is the grounded pushbox rest distance. A `LANDING_SEPARATION_PAD_PX` (0.01) prevents float re-entry into the pushbox. No pose-derived widths.

**Invariant:** V2 does **not** teleport on the touchdown frame as the primary fix. It commits earlier and travels continuously to the locked endpoint.

---

## Cross-up rule (plain language)

**Superseded for live V2 by A.2** (`resolveSideIntent` — see [`AERIAL_LANDING_PHASE_A2.md`](./AERIAL_LANDING_PHASE_A2.md)). Historical Phase A table:

| Situation | Preferred side |
|-----------|----------------|
| Raw arc **crosses** opponent center (start and raw on opposite sides) | Jump direction (centerward) |
| Raw overlaps but near-side clear footprint has meaningful centerward escape | Near / start side |
| Raw overlaps but near escape is off-map / below escape threshold | Cross (not a vertical rope hop) |
| Opponent outside footprint of raw target | Keep raw target |

Side is locked once early in the jump; it is **not** re-scored from touchdown-frame X or a 1px `rawOnCenter` epsilon.

---

## Landing commit rule

- Constant: `ROPE_JUMP_LANDING_COMMIT_T = 0.58` (fraction of `ROPE_JUMP_ACTIVE_MS`).
- First active tick with `t ≥ commitT` samples opponent X, runs `resolveLandingTarget`, locks:
  - `ropeJumpLandingCommitted`
  - `ropeJumpLandingCommitX` / `ropeJumpLandingCommitT`
  - `ropeJumpResolvedTargetX` (also written to `ropeJumpTargetX`)
- After commit, horizontal motion rebases:  
  `x = commitX + (resolved − commitX) * u(eased)` over the remaining ease span.  
  Position-continuous at commit; vertical arc unchanged; total active duration unchanged.
- No per-tick re-homing after lock.

---

## Boundary fallback priority

1. Place at preferred side = `opponentX ± (minDistance + pad)`, clamped to map.
2. If still overlapping after clamp → try alternate side.
3. If alternate clear → use it (`fallbackReason: preferred_side_impossible_alternate_ok`).
4. If both constrained → pick lower residual overlap; tie → preferred side (`both_sides_constrained`).
5. Never return NaN / Infinity / out-of-map X. Never move the defender as the first-choice solution.

---

## Feature flag

| Flag | Default | Notes |
|------|---------|--------|
| `ROPE_JUMP_LANDING_V2` | **true** (unset) | `0` / `false` → legacy rollback |
| `ROPE_JUMP_VAULT_PRESET` | `reference_contact_9` | Approved vault + contact |
| `LANDING_TRACE` | false | `LANDING_TRACE=1` — one JSON line per completed jump |

Flag checks are centralized in `landingFlags.js` (`parseRopeJumpLandingV2Flag`) + `isRopeJumpLandingV2Enabled()` / `stepRopeJumpActive({ useV2 })`.

---

## New player state fields

| Field | Role |
|-------|------|
| `ropeJumpRawTargetX` | Predetermined center-fraction destination |
| `ropeJumpResolvedTargetX` | Locked valid endpoint (V2) |
| `ropeJumpLandingCommitted` | Commit latch |
| `ropeJumpLandingCommitX` / `CommitT` | Pose at commit |
| `ropeJumpLandingDecision` | Full server decision (not on wire) |
| `ropeJumpLandingPath` | `"legacy"` \| `"v2"` |
| `ropeJumpPreferredSide` / `ResolvedSide` | ±1 |
| `ropeJumpMinDistance` / `CenterDistance` / `Overlap` | Live diagnostics |
| `ropeJumpSafetyCorrectionPx` | Accumulated post-land pushbox correction |
| `ropeJumpPreTouchdownX` / `TouchdownX` | Touchdown metrics |
| `ropeJumpUsedFallback` | Boundary fallback used |

Cleared on: jump start (re-init), landing recovery end, `clearAllActionStates`, round reset, match end, disconnect cleanup, player factory defaults.

---

## Diagnostics

**Client overlay** (`client/src/debug/CombatFidelityDebug.js`):

```js
localStorage.setItem("pumo_combat_fidelity_debug", "1")
// optional one-landing console dump:
localStorage.setItem("pumo_landing_trace", "1")
```

Shows per-fighter size multipliers and half-widths (not P1’s size for both), rope phase, raw/resolved/commit marks, sides, distances, overlap, safety correction, V2 vs legacy path. Server diagnostic fields are synced on the fighter delta wire when present.

**Server:** `LANDING_TRACE=1` prints one `[LANDING_TRACE]` JSON object per jump.

---

## Tests

```bash
cd server-io
npm test                                    # full suite
node --test 'test/landing/**/*.test.js'     # Phase A only
```

| File | Coverage |
|------|----------|
| `test/landing/landing-resolution.test.js` | Pure solver (20+ cases, both dirs, sizes, boundaries, symmetry, determinism) |
| `test/landing/rope-jump-landing.test.js` | 64 Hz lifecycle, legacy baseline, V2 commit, durations, facing, buffer, cleanup |
| `test/landing/rope-jump-moving-opponent.test.js` | Walk / cross / knockback / anchor / edge; no post-commit home |
| `test/landing/landing-regression.test.js` | Flag default, rope constants, pushbox, tip connect, slide/flap untouched |

---

## Representative traces (default size 0.85, opponent on raw target)

### Legacy (left rope)

| Metric | Value |
|--------|-------|
| Raw landing target | 438.175 |
| Touchdown overlap | 110.5 |
| Max single-tick correction | 18 |
| Correction ticks | 7 |
| Total post-touchdown displacement | 110.5 |

### V2 (left rope)

| Metric | Value |
|--------|-------|
| Raw target | 438.175 |
| Commit t | ~0.59 |
| Commit X | ~402.8 |
| Resolved endpoint | ~548.69 (opp right) |
| Airborne path adjustment | ~110.5 |
| Touchdown overlap | 0 |
| Safety correction | 0 |
| Fallback | false |

Symmetric results for right-rope (resolved left of opponent).

---

## Known limitations

- **Superseded by A.3:** early `preserve_raw` lock treated clear-at-plan as permanent; ordinary approach into the cell still needed multi-tick sep. See A.3 for provisional raw + pre-commit replan.
- Post-commit opponent motion into the locked cell is classified late intrusion (≤1×18 px safety), not an ordinary path.
- **Superseded by A.1:** Phase A’s “slight kink” understated Case 1 (~4× horizontal speed pop). See A.1 for Hermite / brake / hold_settle.
- Both-sides-constrained near edges may still leave residual overlap (reported); defender is not shoveled as first choice.
- Debug overlay still estimates half-width as `65 * sizeMult` when server half is not separately sent (matches server formula).
- CPU and human share `startRopeJump` + `stepRopeJumpActive` when the flag is on.

---

## Why slide-jump / FLAP are not integrated yet

Different flight models (ballistic / flap charges / dive), different pass-through windows, body-slam hit detection coupling, and separate landing recovery. Phase A proves the solver + commit pattern on the highest-confidence rope-jump bug without expanding risk.

---

## Before enabling V2 by default *(checklist — completed)*

1. Local playtest: rope jump over standing / walking / knocked opponent, both ropes.
2. Confirm no mid-arc snap reads; confirm touchdown already clear in overlay.
3. Confirm grab punish during landing, attack buffer, screen shake, facing still feel identical.
4. Watch boundary + large `sizeMultiplier` cases for fallback frequency.
5. Keep the 18 px cap until telemetry shows safety corrections are rare/tiny.
6. Do **not** flip default in the same PR as slide/FLAP work.

**Final (2026-07-31):** Checklist satisfied for `reference_contact_9`. V2 is **default ON**. No further rope-jump tuning currently authorized.

---

## Rollback

1. `ROPE_JUMP_LANDING_V2=0 npm run dev:web` (or `false`).
2. Or call `stepRopeJumpActive({ useV2: false })`.
3. Legacy path remains — fixed raw target + 18 px/tick slide.

---

## Local playtest

```bash
npm run dev:web
# optional:
LANDING_TRACE=1 npm run dev:web
```

Client console:

```js
localStorage.setItem("pumo_combat_fidelity_debug", "1")
localStorage.setItem("pumo_landing_trace", "1")
```

Corner → W + forward toward center → land on / past a standing opponent. Overlay should show `path=v2`, commit marks, and ~0 touchdown overlap.

---

*Phase A stop gate. Do not integrate slide jump / FLAP in this document’s follow-up without a new authorized conversation.*
