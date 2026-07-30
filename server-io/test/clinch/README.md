# Clinch regression tests

Deterministic regression suite for the grab/clinch system (`server-io/grabActionSystem.js` and related input/timestamp paths).

## What existed before

- No Jest/Vitest/Mocha in the repo.
- Ad-hoc Node scripts under `server-io/scripts/` (notably `test-drive-plant-cancel-defense.js`).
- This suite uses Node’s built-in `node:test` + `node:assert/strict` (Node 18+).

## Layout

| Path | Kind |
|------|------|
| `harness/` | Deterministic sim clock, player/room factory, mock IO, network queue |
| `unit/` | Pure helpers (Plant authority, timestamp clamps) |
| `simulation/` | Full `updateGrabActions` scenarios (throw/pull/jolt/break/edge/stalemate/…) |
| `integration/` | `processInputPacket` + lag-comp / queued delivery |

## Commands

From repo root or `server-io/`:

```bash
# All clinch tests
npm run test:clinch

# Network / timestamp clinch tests only
npm run test:clinch:network

# Watch mode
npm run test:clinch:watch

# Coverage for clinch-related production files
npm run test:clinch:coverage

# Full server-io test suite (clinch + any other node:test files)
npm test
```

Legacy plant-cancel script (still valid):

```bash
node server-io/scripts/test-drive-plant-cancel-defense.js
```

## Simulation clock

- Gameplay time is `room.simTime` via `simNow(room)`.
- Harness advances with `advanceTime(ms)` / `advance(ms)` / `tick()` — never `setTimeout` sleeps.
- `setSimRoomResolver` wires `simNowForPlayer` and sim-scheduled `timeoutManager` timers.
- Production hitstop freezes `simTime` using wall `gameNow()`. After each tick the harness clears `room.hitstopUntil` so later advances stay deterministic. Capture hitstop emits before that clear if you need them.

## Raw input vs authoritative state

Helpers are explicit:

| Intent | API |
|--------|-----|
| Raw keys | `setKeys` / `holdAway` / `holdToward` |
| Buffered request | `setThrowRequest` / `setJoltRequest` / `setBreakRequest` |
| Transition | `setDrivePlantCancel` (`clinchDrivePlantCancelUntil`) |
| Authoritative active | `setActivePlant` / `setActiveTechnique` / `setJoltStartup` |

Do not treat raw Plant keys as defense while a Drive→Plant cancel is pending.

## Adding a scenario

1. `const s = createClinchScenario({ ... })` (always dispose / use `afterEach`).
2. Set resources, stance, requests with harness setters.
3. `s.stepOnce()` or `s.advance(ms)` through the real `updateGrabActions` path.
4. Assert gameplay consequences (state, resources, positions, emits, clinch end).
5. For symmetry, use `withRoleSwap(opts, (s, label) => { ... })`.

## Network harness limits

`createNetworkQueue` only models delayed/reordered/duplicate/dropped delivery on an explicit clock. It does **not** reproduce real internet RTT distributions, congestion, or Socket.IO framing.

## Symmetry

Where a rule should be identity-symmetric, prefer `withRoleSwap`. Failures prefix `[P1-grabber]` / `[P2-grabber]`.
