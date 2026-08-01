# Input Command Reliability V2 — Phase 16

## Status

**Finalized (Phase 17 preamble):** **`INPUT_COMMAND_RELIABILITY_V2`** default **ON**.

```bash
npm run dev:web
# unset / 1 / true → V2
```

Legacy rollback (exact pre-V2 path):

```bash
INPUT_COMMAND_RELIABILITY_V2=0 npm run dev:web
# also: false
```

Palm chord remains **50ms** (~3 ticks). Clinch command rules unchanged.

Opt-in diagnostics (independent of V2):

* Client: `localStorage.setItem("pumo_input_command_trace", "1")` → `window.__PUMO_INPUT_COMMAND_TRACE.dump()` / `.last()`
* Server: `INPUT_COMMAND_TRACE=1`
* Bound: **256** records; cleared on rematch/reset; overlay shows last result only

---

## Command pipeline (current)

| Command | Physical inputs | Client detector | Socket path | Server resolver | Facing / dir source | Eligibility | Recovery |
| ------- | --------------- | --------------- | ----------- | --------------- | ------------------- | ----------- | -------- |
| Neutral Mouse1 slap | Mouse1 | `Game.jsx` predict slap | `fighter_action` | `processInputPacket` → `executeSlapAttack` | n/a | `canPlayerSlap` | action lock / busy |
| Forward + Mouse1 | Fwd+M1 (no S) | slap | same | slap | server facing | same | same |
| Back + Mouse1 Palm | Back+M1 | `palm_thrust` predict | same | `executePalmThrust` | **facing snapshot @ M1** (V2) | `canPlayerSlap` + neutral | busy → pending palm mid-slap |
| S+Forward+M1 charge | S+Fwd+M1 | charge predict | same | `startCharging` | held S+forward | slap gate ignore CD | — |
| Forward / Back + Shift | A/D absolute + Shift | dash predict | same | `beginPlayerDodge` | **absolute A/D** | `canPlayerDash` | fresh recovery &lt;100ms |
| Slide re-press | Shift while ice-sliding | edges only | same | `tryIceSlideReverse` | slide dig | ice-slide state | reverse buffer 150ms |
| Mouse2 grab | Mouse2 | grab predict | same | `beginGrabStartup` | faces opponent | `canPlayerUseAction` | CD / whiff |
| Forward + Mouse2 clinch | Toward+M2 | keys only | same | **push + belt** (not a throw) | opponent X | grip / clinch | — |
| Back + Mouse2 clinch | Away+M2 | keys only | same | `clinchThrowRequest=pull` | opponent X | grip, !Open, !clamp… | Open / fail stagger |
| W + Mouse2 clinch | W+M2 | keys only | same | `clinchThrowRequest=throw` | W absolute | same | same |
| Deep Grip throw | any throw/pull while `hasDeepGrip` | state flag | same | consume at `commitTechnique` | same | same; PB can still beat | Open after fail |

---

## Proven failure paths

1. **Palm chord (Mouse1 before Back)** — legacy resolved palm from **held keys at process time only**. Same-packet event order and cross-packet Back-within-50ms after slap startup were lost → slap instead of palm.
2. **Dodge fresh-recovery `return`** — legacy `return` exited **entire** `processInputPacket`, silently dropping later clinch throw/pull recognition in the same packet.
3. **Clinch “lost” throws during Open / fail stagger** — often `COMMAND_RECOGNIZED_BUT_INELIGIBLE` (`THROW_RECOVERY_ACTIVE`), not recognition failure. Deep Grip does **not** bypass Open.
4. **Perfect Brace** — technique **resolves and is defended** (`DEFENDER_PERFECT_BRACE`); not a dropped command.
5. **`clinchThrowCooldown`** — retired; not a live gate (cleanup-only field).

---

## Direction / facing sampling rule

* **Open-game palm/slap relative dir:** snapshotted at **Mouse1 acquisition** (`_strikeFacingSnap`). V2 uses that snap for back/forward keys; does not re-interpret after pair-facing / root cross mid-command.
* **Clinch throw/pull:** still **opponent-X** relative (away/toward), unchanged.
* **Dodge:** absolute A/D, unchanged.

## Chord tolerance

* **`PALM_DIR_CHORD_MS = 50`** (~3 ticks @ 64Hz).
* Same-packet event walk: Mouse1 then Back in one `events` array → palm.
* Cross-packet: Back during slap **startup** within 50ms of slap start → convert to palm (once).
* Does **not** delay intentional neutral slaps; ambiguous A+D never becomes palm.

---

## Deep Grip authoritative contract

* Earned advantage; **breaks ordinary held Plant** on throw/pull.
* **Perfect Brace** still beats Deep Grip (and awards Deep Grip to the defender).
* Consumed on **technique commit** (`clinchThrowUsedDeepGrip` snapshot), before impact.
* Does **not** guarantee an unblockable throw; does **not** skip Open/recovery/jolt/arm-clamp gates.
* Land threshold retired (`CLINCH_THROW_LAND_THRESHOLD = 0`).

## Throw recovery

* Visible **Clinch Open** / fail stagger / Perfect Brace Open control re-throw timing.
* No active invisible `clinchThrowCooldown` gate.
* Inputs during Open are diagnosed as `THROW_RECOVERY_ACTIVE`, not silently forgotten (when chord attempt detected).

---

## Rejection reasons (compact)

`NO_DIRECTION`, `AMBIGUOUS_DIRECTION`, `INVALID_FACING`, `AIRBORNE`, `PRIMARY_ACTION_BUSY`, `RECOVERY_ACTIVE`, `LIFECYCLE_OWNER_ACTIVE`, `NOT_IN_CLINCH`, `STALE_CLINCH_INSTANCE`, `THROW_RECOVERY_ACTIVE`, `INVALID_GRIP_STATE`, `DEFENDER_PERFECT_BRACE`, `ROUND_INACTIVE`, `DUPLICATE_COMMAND`, `STALE_COMMAND`, `ACTION_BLOCKED`, `ELIGIBILITY_FAILED`, `DODGE_RECOVERY_FRESH`, `GASSED`, `ARM_CLAMPED`, `TECHNIQUE_ACTIVE`, `JOLT_RECOVERY`, `COMMAND_NOT_RECOGNIZED`, `RESOLVED_AND_DEFENDED`.

Three concepts:

1. `COMMAND_NOT_RECOGNIZED`
2. `COMMAND_RECOGNIZED_BUT_INELIGIBLE`
3. `THROW_ATTEMPT_RESOLVED_AND_DEFENDED`

---

## Bugs fixed (V2 on)

* Palm same-packet / short chord recognition
* Slap→palm convert when Back follows Mouse1 within 50ms in startup
* Dodge fresh-recovery no longer aborts the rest of the input packet
* Explicit reject notes for blocked Mouse1 / clinch ineligibility / Perfect Brace

## Intentionally preserved

Damage, frames, slap anim, palm combat properties, dodge/slide/smoke (`10` / `0`), clinch movement/trajectories/Plant/PB timing, Deep Grip balance semantics, Rope Jump, Jolt, low kick disabled, all prior default-ON fidelity flags.

---

## Manual matrix

`INPUT_COMMAND_RELIABILITY_V2=1 npm run dev:web`

Palm both sides · Back slightly before/with/after Mouse1 · Fast A/D alternation · Back+Shift both sides · Shift after recovery · Side cross during palm · Grab→clinch · W+M2 / Away+M2 spam · Deep Grip vs Neutral/Plant/PB/late brace · Throw during/after Open · Held vs discrete M2 · Reset/rematch · Trace on/off

---

## Remaining risks

* Cross-packet palm convert only while slap startup (&lt;50ms); later Back stays slap (intentional).
* Clinch already had a 220ms chord; intermittent “Deep Grip throw fail” is often Open/PB, not recognition — use the trace.
* Client prediction still uses snapshot facing; rare predict mismatch until authority confirms.
