# Combat Fidelity Roadmap — PUMO PUMO !

Phase-gated plan derived from the Phase 1 audit. **Do not start a phase until the previous stop gate is approved.**

Reference behavior that must not regress: slap / charged / palm tip-rail contact (`strikeContact.js` + `processHit` park + `contactX`).

---

## Phase 0 — Diagnostic & geometry foundation *(this conversation / immediate next)*

### Scope
- Keep/extend disabled-by-default overlays (`client/src/debug/CombatFidelityDebug.js`)
- Keep pose audit script (`tools/audit-pose-geometry.js`)
- Optional: server log flag for contact/push events (dev only)
- Capture playtest clips for rope-jump land, charged grounding, parry compositions, slap1 tip

### Exclusions
- No gameplay constant changes
- No pushbox rewrite
- No networking protocol changes

### Player-visible benefit
None directly — enables evidence for later phases.

### Technical risk
Low.

### Dependencies
None.

### Required tests
- Flag off → bit-identical presentation
- Pose script runs on CI optionally (warn-only)

### Rollback
Delete/disable debug module; remove GameFighter note/render hooks.

### Stop when
Overlays + pose report trusted; playtest list filled.

---

## Phase 1 — Pose metadata & coordinate standardization

### Scope
- Introduce authored (or semi-authored) pose metadata for contact poses first: slap hit 1/2, palm, charged, blocking, ready
- Document shared scale helpers (still may live duplicated until a real shared package is approved)
- Fix **documentation + tooling** so tip/sole/root are named concepts
- Resolve non-960 contact-critical assets plan (migrate hit/ropes/etc. later)

### Exclusions
- Do not retune slap1 tip 478→458 without playtest
- Do not change pushbox values
- Do not change move frame data

### Player-visible benefit
Little at first; prevents future art from breaking contact.

### Technical risk
Medium — metadata wrong → silent reach bugs.

### Dependencies
Phase 0 overlays to validate markers in-game.

### Required tests
- Unit: tip px → world matches `strikeContact` for reference poses
- Snapshot: metadata present for all tip-rail moves

### Rollback
Ignore metadata; fall back to current constants.

### Stop when
Reference poses have sole + tip markers validated in overlay; charged sole float diagnosed as art vs engine.

---

## Phase 2 — Ground pushbox & movement resolution

### Scope
- Single exemption registry for pass-through (shared by pushbox + tip-sep)
- Eliminate duplicate `Math.round(75*0.96)` clinch distance literals
- Fix `cpuAI.js` `MAP_RIGHT_BOUNDARY` 940 vs 935 drift
- Investigate grounded jitter when both hold in; cap/separation smoothness without changing rest distance feel
- Keep ice character + slap ground transfer

### Exclusions
- No aerial landing solver yet
- No strike formula changes
- No clinch redesign

### Player-visible benefit
Cleaner belly-to-belly pressure; less AI edge weirdness; fewer mystery penetrations on ground.

### Technical risk
Medium — pushbox feel is playtest-sensitive.

### Dependencies
Phase 1 concepts (body half naming).

### Required tests
- Two fighters walk into each other both facings
- Charged lunge still connects (yield preserved)
- Palm still does not inherit charged yield

### Rollback
Revert exemption registry to previous inline lists.

### Stop when
Ground separation stable; charged/palm regression tests green.

---

## Phase 3 — Aerial movement & landing *(highest player-facing fidelity gap)*

### Phase 3A — Rope jump only *(implemented 2026-07-30…31, default OFF)*

See [`AERIAL_LANDING_PHASE_A.md`](./AERIAL_LANDING_PHASE_A.md), [`AERIAL_LANDING_PHASE_A1.md`](./AERIAL_LANDING_PHASE_A1.md), [`AERIAL_LANDING_PHASE_A2.md`](./AERIAL_LANDING_PHASE_A2.md), [`AERIAL_LANDING_PHASE_A3.md`](./AERIAL_LANDING_PHASE_A3.md).

- Pure `landingResolution.js` + `ROPE_JUMP_LANDING_V2` flag (default **false**)
- A.1: Hermite/brake trajectory + residual-aware fallback (not visually approved — decision cliffs remained)
- A.2: stable side intent + continuous commit + same-side endpoint continuity; fine 0.25px scans
- A.3: provisional raw-clear + pre-commit dynamic conflict replan; event-level safety budgets; dynamic movement scan
- Legacy path preserved; 18px/tick retained as late-intrusion safety only (≤1 tick when classified)
- Diagnostics debug-net only; `server-io/test/landing/` suite including A.2/A.3 scans
- **Stop:** do not enable by default until playtest; do not integrate slide/FLAP here

### Phase 3B — Slide jump / FLAP *(not started)*

### Scope (remaining)
- Slide-jump / FLAP landing: same footprint idea; preserve intentional cross-up rules
- Replace “land inside → 18px/tick slide” as the primary solution for those verbs (cap may remain as safety)
- Side prediction using jump direction + relative X
- Deterministic server resolution (no client authority)

### Exclusions
- No strike tip changes
- No FLAP damage rebalance
- No new aerial attacks
- No silent default-on for rope V2 without playtest sign-off

### Player-visible benefit
Rope jump / cross-up lands feel intentional; no “teleport after landing inside.”

### Technical risk
**High** — movement tech identity; cross-up fairness; ring edge cases.

### Dependencies
Phase 2 exemption clarity; landing footprint from Phase 1 metadata (or temporary default capsule). Phase 3A solver is the substrate for 3B.

### Required tests
- Rope jump over standing opponent mid/near rope both sides *(3A done)*
- Rope jump when opponent moves into landing cell *(3A done)*
- Slide jump cross-up + butt slam still hits
- Landing during hitstop / knockback scenarios
- Deterministic clinch harness style scenarios for landing

### Rollback
Feature-flag landing probe; restore fixed `ropeJumpTargetX` + 18px cap path (`ROPE_JUMP_LANDING_V2=0`).

### Stop when
Playtest confirms no visible land-inside-then-correct on reference scenarios; then consider default-on for rope V2 before 3B.

---

## Phase 4 — Strike contact standardization

### Scope
- Bring low kick onto tip rail when art exists
- Optional: reconcile slap1 tip constant with art after playtest
- Ensure every strike emit includes full contact fields
- Reduce move-specific distance magic numbers
- Preserve slap/charged/palm feel exactly (golden scenarios)

### Exclusions
- No hitstop/damage retune
- No aerial rewrite (done in Phase 3)

### Player-visible benefit
Low kick / future strikes match the professional tip-meets-body language.

### Technical risk
Medium — reach changes are balance-adjacent; require explicit approval for any constant delta.

### Dependencies
Phase 1 metadata; Phase 0 golden recordings.

### Required tests
- Golden connect distances for slap1/2, palm, charged at size 1 and 0.85
- Ghost-whiff regression (ice drift, AP grace, extension sep)
- Palm park outset still reads palm-on-skin

### Rollback
Per-move flag to use legacy distance.

### Stop when
All melee strikes share ContactSolver API; low kick no longer special-cased without metadata.

---

## Phase 5 — Parry, defense, armor, clashes

### Scope
- Shared contact composition for AP / guard / flap parry (reuse tip seam; stop midpoint where wrong)
- Per-attack parry height/hand metadata (presentation first; gameplay windows unchanged unless approved)
- Clash / trade contactX consistency
- Armor absorb presentation tied to contact point

### Exclusions
- No AP window retune
- No perfect-parry kill threshold changes

### Player-visible benefit
Parries look like two bodies meeting, not independent VFX.

### Technical risk
Medium — visual-only changes can still affect perceived fairness.

### Dependencies
Phase 4 contact events.

### Required tests
- Parry slap / palm / charged / flap each facing
- Guard chip spark at seam
- Perfect vs regular presentation

### Rollback
Restore prior effect anchors per event.

### Stop when
Defense interactions use CombatEvent contact fields.

---

## Phase 6 — Reaction & presentation-event standardization

### Scope
- Reaction vocabulary table (light/heavy/palm/counter/air/parry/armor/rope/land…)
- Map each to anim + hitstop category + deform amp + shake profile without flattening unique moves
- Remove feedback that only exists to hide bad spacing (after Phases 3–4)

### Exclusions
- No new particle spam as primary fix
- No cinematic rewrite

### Player-visible benefit
Consistent “weight language” across the cast of moves.

### Technical risk
Low–medium (mostly client).

### Dependencies
Stable contact events.

### Required tests
- Same force category → comparable shake/amp bands
- Reference slap/charged/palm still match current feel recordings

### Rollback
Per-move presentation overrides.

### Stop when
PresentationDirector reads categories; one-off amps documented as exceptions.

---

## Phase 7 — Client/server contact synchronization

### Scope
- Expand `player_hit` / defense events toward CombatEvent schema (tick, interaction id, contact normal, corrections, reaction category)
- Ensure hitstop pins both fighters to park poses from the same event
- Auth-vs-render debug overlay completion
- Reduce reliance on `pinFighterX` heuristics by sending explicit plant positions for both

### Exclusions
- No client-authoritative hits
- No rollback netcode project

### Player-visible benefit
Online hits look like offline hits; fewer “spark then slide” moments.

### Technical risk
Medium — protocol / bandwidth; old clients if any

### Dependencies
Phases 4–6.

### Required tests
- Artificial 80–120ms RTT: contact pose stable through hitstop
- Packet gap + resync does not desync freeze composition

### Rollback
Optional fields; clients ignore unknown keys.

### Stop when
ContactEvent required fields present on all strike/defense connects.

---

## Phase 8 — Full interaction regression & polish

### Scope
- Scenario harness beyond clinch: strikes, landings, parries, boundaries
- Art pass for sole-consistent 960 poses (charged, hit, ropes)
- Remove dead legacy hitbox constants or quarantine them
- Final playtest checklist vs `COMBAT_INVARIANTS.md`

### Exclusions
- Broad combat redesign / slap economics (see `COMBAT_OVERHAUL_SPEC.md` — separate track)

### Player-visible benefit
Commercial cohesion; sticker-overlap class bugs gone.

### Technical risk
Low if prior phases gated.

### Dependencies
All prior.

### Required tests
- Full automated scenario pack + human checklist

### Rollback
N/A — polish phase; revert individual assets/constants.

### Stop when
Steam-release fidelity bar signed off for interaction (not particle count).

---

## Recommended next implementation phase

**Phase 3A + A.1 + A.2 + A.3 are code-complete behind a flag (still default OFF).** Next conversation should be: (1) playtest rope V2 (A.3 matrix) and decide default-on, **or** (2) Phase 3B slide-jump/FLAP landing using the same solver, **or** (3) low-risk Phase 2 hygiene (CPU boundary + exemption registry).

Do **not** start Phase 4 tip standardization before landing/pushbox ownership is clear — otherwise tip parks will keep fighting aerial correction snaps.
