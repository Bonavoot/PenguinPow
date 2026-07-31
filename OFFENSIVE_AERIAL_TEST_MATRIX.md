# Offensive Aerial Test Matrix — PUMO PUMO !

Characterization / regression foundation (2026-07-31).  
**Does not rewrite gameplay** to make tests pass.

## Commands

```bash
cd server-io
npm test                 # full suite
npm run test:landing     # rope landing only
npm run test:aerial      # offensive aerial characterization
```

Dev traces (optional):

```bash
OFFENSIVE_AERIAL_DEBUG=1 OFFENSIVE_AERIAL_TRACE=1 npm run dev
# client overlay: localStorage pumo_combat_fidelity_debug=1
# client aerial breadcrumb: localStorage pumo_offensive_aerial_trace=1
```

---

## Harness

| Piece | Path |
|-------|------|
| Sim + real `checkFlapBodySlam` | `server-io/test/aerial/helpers/slideJumpSim.js` |
| Trace builder | `server-io/offensiveAerialTrace.js` |
| Flags | `server-io/offensiveAerialFlags.js` |

Harness mirrors flight/land from `index.js` and calls production collision resolution. Hitstop cleared each tick (clinch pattern).

---

## Coverage matrix

### FLAP / shared body slam — `flap-body-slam.test.js`

| Case | Status | Verdict label |
|------|--------|---------------|
| Geometry constants | covered | intentional |
| Ascent no hitbox | covered | intentional |
| Descent window | covered | intentional |
| Above height inactive | covered | intentional |
| Clean hit | covered | intentional |
| Repeated-hit prevention | covered | intentional |
| Crossing-side hit | covered | intentional |
| Hit near L/R boundary | covered | intentional |
| Hit immediately before touchdown | covered | intentional |
| Latch closes window | covered | intentional |
| Clean whiff + flap land ms | covered | intentional |
| Pass-over high | covered (soft) | intentional |
| Width miss | covered | intentional |
| Grounded parry | covered | intentional |
| Parry clears re-hit | covered | intentional |
| Perfect parry grade | covered | intentional |
| Parry near boundary | covered | intentional |
| Parry overlapping roots | covered | intentional |
| Hit then land recovery | covered | intentional |
| First grounded clear | covered | intentional |
| Trace snapshots | covered | — |
| vs flight immune | covered | intentional |
| vs dodge | covered | intentional |
| vs rope active | covered | intentional |
| vs already-hit | covered | intentional |
| Opponent moving toward/away | **partial** (KB mastery path exists; dedicated drift cases thin) | untested residual |
| Active expire before touchdown without latch | **partial** (window height) | intentional |
| Crossing-side whiff | **partial** (pass-through test in slide-jump file) | stable |

### Slide-jump — `slide-jump-lifecycle.test.js`

| Case | Status | Verdict |
|------|--------|---------|
| Takeoff fields | covered | intentional |
| Flight pushbox off | covered | intentional |
| Landing not flight-exempt | covered | intentional |
| Whiff arc no contact | covered | intentional |
| Descent hit without FLAP | covered | intentional |
| Ascent no contact | covered | intentional |
| S opens dive | covered | intentional |
| Parry plain slam | covered | intentional |
| Side cross pass-through | covered | intentional |
| State cleanup | covered | intentional |
| Buffer blocked | covered | intentional |
| FLAP arm + air spend | covered | intentional |
| Buffered follow-up after land | **not yet** | untested |
| Offensive contact during ascent with overlap | covered (negative) | intentional |

### S-key dive — `body-slam-dive.test.js`

| Case | Status | Verdict |
|------|--------|---------|
| Clean hit | covered | intentional |
| Clean whiff | covered | intentional |
| Parry | covered | intentional |
| Pin X / kill H | covered | intentional |
| Burns charges | covered | intentional |
| Edge L/R | covered | intentional |
| Immediate touchdown after contact | covered | intentional |
| No re-hit after latch | covered | intentional |
| Hit airborne defender → hit-fall | covered | intentional |
| Landing recovery cleanup | via shared clear tests | intentional |

### Interaction ordering — `interaction-ordering.test.js`

| Case | Status | Verdict |
|------|--------|---------|
| Parry before hit same tick | covered | intentional |
| Dual flight immunity | covered | intentional |
| vs dive-committed (hittable) | covered | intentional |
| vs thick blubber / armor | covered | **gap** (slam connects) |
| Round reset clearAll | covered | intentional |
| Hitstop emit + harness clear | covered | intentional |
| Double poll safe | covered | intentional |
| Whiff then flags clear | covered | intentional |
| Aerial vs slap/charged trade | **not automated** | needs playtest / richer harness |
| Hitstop exactly on touchdown tick | **not automated** | untested |
| Ring-out during/after aerial contact | **not automated** | untested |
| Two aerial both dive same tick | **not automated** | untested |

---

## Pre-existing related tests

| Suite | Relevance |
|-------|-----------|
| `test/landing/**` | Rope only; asserts slide-jump fields not owned by landing module |
| `test/facing/facing-system.test.js` | Facing exclusion while flapping/slide-jumping |
| `test/clinch/**` | Not aerial slam; pattern source for harness |

---

## Diagnostic / expected-gap cases

| Test | Label |
|------|-------|
| `thick blubber / hit absorption is NOT consulted` | **DIAGNOSTIC gap** — do not “fix” by making slam respect armor without design approval |

---

## Baseline → post-audit totals

| Suite | Before | After (this phase) |
|-------|--------|--------------------|
| Full server | 474 pass | see final report |
| Landing | 171 pass | unchanged expectation |
| Aerial | 0 | **57** characterization tests |

Failures must not be silently “fixed” by retuning moves.
