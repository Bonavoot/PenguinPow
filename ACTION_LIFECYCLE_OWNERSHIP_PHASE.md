# Action Lifecycle Ownership V2 — Phase 15

## Status

**Manually playtested and approved.** `ACTION_LIFECYCLE_OWNERSHIP_V2` is now **default ON**.

Normal play:

```bash
npm run dev:web
```

Explicit legacy rollback:

```bash
ACTION_LIFECYCLE_OWNERSHIP_V2=0 npm run dev:web
```

### Approval notes

* Manual playtesting approved V2.
* Normal gameplay felt unchanged vs legacy (timing, control feel, recovery, no unexpected self-cancellation).
* Purpose is **stale-callback protection**, not gameplay retuning.
* Remaining ungated timers were **intentionally not migrated** without a proven defect.

Independent of facing, pose, contact, aerial, and presentation flags.

---

## Pre-implementation report (proven only)

| # | Finding |
|---|---------|
| 1 Existing ownership | Action facing locks; combat contact consume IDs; `clinchInstanceId` (presentation); offensive aerial `attackInstanceId`; presentation `eventId`s |
| 2 Existing action-instance IDs | Facing `*FacingInstanceId`; contact `_combatContactActionInstanceId` (often minted at consume); OA `attackInstanceId`; clinch presentation id |
| 3 Fields without instance ownership | Slap/palm/charged shells, endlag, hitstun timers, parry stagger, projectile hitstun, ropes stun, most locomotion completion |
| 4 Delayed lifecycle callbacks | `slapCycle`, unnamed slap startup, `chargedEndlagReset`, `hitStateReset`, `chainHitGap`, `parryStaggerBegin`/`Reset`, unnamed projectile hitstun, `atTheRopesTimeout`, palm/lowKick named timers, grab/clinch named timers |
| 5 Ungated cleanup paths | `endSlapCycle` (facing gated only); `chargedEndlagReset` body; `hitStateReset` bodies; `parryStagger*`; projectile hitstun; `clearAllActionStates` does **not** cancel those named timers (legacy) |
| 6 Proven stale-callback paths | (P1) `chargedEndlagReset` after `clearAll` can clear newer `currentAction`/`actionLockUntil`; (P2) unnamed slap startup can clear `isInStartupFrames` on a newer slap; (P3) unnamed projectile hitstun bypasses named `hitStateReset` clear; (P4) `parryStagger*` can re-apply recovery after interrupt; (P5) live `hitStateReset` after `clearAll` can mutate KB/`isAlreadyHit` |
| 7 Proven double-completion | Palm visual-end + recovery both clear palm flags (idempotent flag writes; not a newer-action revive when `clearAll` clears `palmThrustVisualEnd`) |
| 8 Proven early-control | P1 endlag clearing `actionLockUntil` on a newer charged action |
| 9 Proven late-control | Not isolated as a separate timer race in this audit (input locks remain timestamp-based) |
| 10 Reset omissions | Factory lacked `_combatContact*` init (rematch already cleared); lifecycle owners previously nonexistent |
| 11 Already safe | Facing expected-instance release; OA instance cleanup; named timeout replace-on-same-name; clinch jolt cancel on cleanup; contact consume idempotency; round `timeoutManager.clearPlayer` |

---

## Ownership domains

| Domain | Typical owners |
|--------|----------------|
| `PRIMARY_ACTION` | SLAP, PALM, CHARGED, CHARGE_HOLD, ENDLAG, GRAB_STARTUP |
| `LOCOMOTION` | DODGE, SIDESTEP (primitive ready; ground tick still timestamp-driven) |
| `REACTION` | HITSTUN, PARRY_STAGGER, ROPES |
| `CLINCH_THROW` | CLINCH, THROW (reuse existing clinch instance ids; no clinch rewrite) |

Record fields: `ownerType`, `ownerInstanceId`, `phase`, `startedTick`, `consumed`, `active`, plus completion/recovery/control counts.

---

## Transition / handoff contract (V2)

1. **Begin** — mint or reuse instance; write domain record.
2. **Assert** — delayed callbacks must match expected instance; reject otherwise (+ stale reject counter).
3. **Consume** — contact/parry marks owner consumed; later ordinary completion no-ops.
4. **Complete** — once per instance (idempotent duplicate).
5. **Control restore** — once per instance.
6. **Release** — expected instance only; stale rejected.
7. **Full reset** — `forceClearLifecycleOwners` + cancel `LIFECYCLE_TIMEOUT_NAMES` from `clearAllActionStates` / rematch init.

---

## Callback ownership (hardened)

| Callback | Gate |
|----------|------|
| Slap startup / cycle | PRIMARY slap instance |
| Charged endlag | PRIMARY endlag instance + cancelled on V2 `clearAll` |
| Hitstun (`hitStateReset`, projectile named) | REACTION hitstun instance |
| Parry stagger begin/reset | REACTION parry-stagger instance |
| At-the-ropes timeout | REACTION ropes instance |

Durations unchanged. Sim clock unchanged.

Only these proven stale-callback paths are instance-owned. Other timers remain ungated by design until a defect is proven.

---

## Reset semantics

- **V2 `clearAllActionStates`**: cancel full lifecycle timeout list + force-clear owners, then existing flag clears.
- **Legacy `clearAll`** (`ACTION_LIFECYCLE_OWNERSHIP_V2=0|false`): prior selective clears only (exact).
- **Rematch / factory**: lifecycle fields initialized/zeroed; `_combatContact*` initialized in factory.

---

## Feature flag

| Value | Behavior |
|-------|----------|
| unset / `""` | **V2 (default ON)** |
| `1` / `true` | V2 hardened ownership |
| `0` / `false` | Exact legacy |

Rollback:

```bash
ACTION_LIFECYCLE_OWNERSHIP_V2=0 npm run dev:web
```

---

## Quantitative results (targeted tests)

| Metric | Before (proven) | After (V2) |
|--------|-----------------|------------|
| Domains hardened | 0 | 4 |
| Lifecycles using existing IDs | facing/contact/OA/clinch | reused where present |
| New IDs | — | slap/palm/endlag/hitstun/parry/ropes lifecycle ids |
| Ungated callbacks (audited set) | 6+ | 0 under V2 gates + clear |
| Stale callback affecting newer action | proven paths exist | **0** in targeted tests |
| Duplicate completion / recovery / control | possible | **0** (idempotent counters) |
| Reset ownership survivors | lifecycle N/A | **0** |
| Gameplay timing changes | — | **0** (playtest-confirmed identical feel) |
| Network fields added | — | **0** |

---

## Manual matrix

Normal: `npm run dev:web`  
Rollback: `ACTION_LIFECYCLE_OWNERSHIP_V2=0 npm run dev:web`

Slap chain · Palm/Shatter · Charged hit/whiff/interrupt · Parry/trade · Dodge/slide/redirect/sidestep · Grab hit/whiff · Clinch/drive/plant/pull · Tech/break/jolt · Forward/kill throws · Hitstun/stagger/knockdown · Ropes · Immediate next action after recovery · Reset mid-action · Rematch · Debug OFF/ON.

Watch for: lost/early/late control, old poses, old cleanup canceling new actions, double recovery, grab/throw leftovers, stale facing, smoke/effect dupes, reset leftovers.

---

## Systems intentionally unchanged

- Contact / facing / pose / OA internals and defaults
- Rope Jump, smoke offsets, Jolt placement, low kick disabled
- Clinch system rewrite
- Slap animation playback
- Damage / balance / knockback / hitstop numbers
- Client animation system
- Projectile travel / FLAP internals
- Additional timers beyond the proven stale set (not migrated without evidence)

---

## Remaining risks

- Not every grab/throw/sidestep delayed path is instance-gated (intentionally; no proven defect).
- Locomotion still primarily timestamp-driven; LOCOMOTION domain is ready for further wiring if new stale paths are proven.
- Dual palm visual/recovery clear remains dual-writer but interrupt-safe via existing named clear.

---

## Modules

- `server-io/actionLifecycleFlags.js`
- `server-io/actionLifecycleOwnership.js`
- Wired: `gameUtils.js`, `gameFunctions.js`, `collisionSystem.js`, `projectileUpdates.js`, `index.js`, `playerFactory.js`, `roomManagement.js`
- Client overlay inference: `client/src/debug/CombatFidelityDebug.js`
- Tests: `server-io/test/lifecycle/action-lifecycle-ownership.test.js`
