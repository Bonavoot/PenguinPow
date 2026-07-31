# Offensive Aerial Phase 1–2 Report

**Date:** 2026-07-31  
**Scope:** Explicit outcome contract + cleanup hardening only.  
**Gameplay:** Unchanged (damage, KB, recovery, movement, parry timing, Rope Jump untouched).

---

## Baseline → final

| Suite | Baseline | Final |
|-------|----------|-------|
| Full server | 531 pass | see verification below |
| Landing | 171 pass | unchanged expectation |
| Aerial | 57 pass | **92** pass (+35 contract/cleanup) |

---

## What shipped

### Code
- `server-io/offensiveAerialOutcome.js` — enum, activation, resolve, cleanup stages, stale-owner
- Wired: `collisionSystem.js` (HIT/PARRIED), `index.js` (arm/dive/touchdown/recovery), `gameUtils.js` (`clearSlideJumpState` / `clearAllActionStates`), resets in room/player/win cleanup
- `offensiveAerialTrace.js` — includes `outcomeContract` snapshot; hitbox respects `contactConsumed`
- Client debug overlay shows instance/outcome/cleanup when present
- Tests: `test/aerial/outcome-contract.test.js`, `cleanup-contract.test.js`
- Docs: `OFFENSIVE_AERIAL_OUTCOME_CONTRACT.md`, `OFFENSIVE_AERIAL_CLEANUP_CONTRACT.md`, this report

### Mapping summary
- FLAP arm / dive → activation `NONE`
- Slam hit → `HIT` + consumed + post-hit travel
- Raw parry → `PARRIED` + consumed + immediate ground (existing)
- Armed touchdown no contact → `WHIFF`
- Plain touchdown → `LANDED_WITHOUT_CONTACT`
- Armed mid-air clearAll → `INTERRUPTED` then null

---

## Deferred (unchanged)

- Midpoint `contactX`
- Generalized land settle
- Parried airborne recoil redesign
- Dive-specific impact handoff
- Armor/thick-blubber for slam
- Pure guard without `isRawParrying`
- Priority / trade redesign
- Animation / FX redesign

---

## Exact next phase

**Phase 3 — Shared slam resolution polish** (from roadmap): contact-point fidelity; optional armor policy **only with approval**; no settle yet; no KB/recovery retune.

Do **not** begin Phase 5 settle before outcome+cleanup are trusted in playtests.
