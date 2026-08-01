# Non-Aerial Action State and Facing Ownership — Phase 12

**Status:** Manually approved — `ACTION_FACING_OWNERSHIP_V2` **default ON**.  
**Does not change:** Pose Geometry V2, Rope Jump, movement smoke offsets, Jolt art, low kick (disabled), combat timing/values, offensive-aerial facing behavior.

## Feature flag / rollback

```bash
npm run dev:web                              # V2 (default)
ACTION_FACING_OWNERSHIP_V2=1 npm run dev:web # V2
ACTION_FACING_OWNERSHIP_V2=true npm run dev:web
ACTION_FACING_OWNERSHIP_V2=0 npm run dev:web # exact legacy soft-field / flag freezes
ACTION_FACING_OWNERSHIP_V2=false npm run dev:web
```

| Value | Path |
|---|---|
| unset / `""` | V2 |
| `1` / `true` | V2 |
| `0` / `false` | legacy |

Pose Geometry V2 remains independently default-on.

## Direction domains (both use numeric ±1)

These must not be conflated:

| Domain | Meaning | Example |
|---|---|---|
| **Sprite facing** (`player.facing`, ownership `direction`) | Which way the fighter’s art faces | `facing === -1` → faces **right** (+X); `facing === 1` → faces **left** (−X) |
| **World / travel** (`throwDir`, `throwingFacingDirection`, knockback signs) | Motion along X | `+1` → +X; `−1` → −X |

Because both domains use `±1`, forward-throw tests assert that THROWER ownership locks committed `actor.facing` and that `throwingFacingDirection` remains the travel sign (often the **numeric inverse** of presentation facing).

## Part 1 — Legacy ownership inventory (active non-aerial)

| Field / helper | Owning action | Acquire | Direction source | Duration | Release | Instance id (pre-P12) | Stale-release risk |
|---|---|---|---|---|---|---|---|
| `slapFacingDirection` | Slap chain | `executeSlapAttack` | Opponent X once | Until cycle end | `endSlapCycle` / clear | No | Yes — ungated null |
| `chargingFacingDirection` | Palm / Shatter / charged / hold | execute / start charge | Opponent or current facing | Until attack/charge end | `safelyEndChargedAttack` / clear | No | Yes |
| `isAttacking` freeze | Active strike | attack start | `player.facing` | While attacking | attack end | No | Soft |
| `isDodging` freeze | Dodge | `beginPlayerDodge` | Current facing | Hop | land / cancel | No | Soft |
| `isSidestepping` freeze | Sidestep | sidestep start | Current facing | Arc | end | No | Soft |
| `isHit` / ring-out cutscene | Hitstun | `processHit` / trade | Face attacker | Hitstun timer | `endHitKnockback` / timeout | No | Soft |
| `atTheRopesFacingDirection` | Ropes | boundary contact | Saved attack facing | Named timeout / reset | timeout / reset | No | Yes — ungated timeout |
| `pullFacingDirection` | Pull yank | pull resolve | Post-pull destinations | Until yank flags clear | `clearOrphanPullFacingLocks` | No | Partial |
| `throwingFacingDirection` | Thrower | throw resolve | **World travel** (not sprite facing) | Throw end | throw end / clear | No | Soft |
| `beingThrownFacingDirection` | Victim | throw resolve | Victim **sprite** facing | Throw end | throw end / clear | No | Soft |
| `isThrowing` / `isBeingThrown` | Throw | throw start | Current facing | Flags | throw end | No | Soft |
| `enforcePairFacing` | Neutral | every tick | Rel-X | When unlocked | n/a | n/a | Overwrite if unlock early |
| OA `offensiveAerialFacingLock` | Aerial (Phase 5A) | aerial lifecycle | Instance-owned | Aerial handoff | gated release | **Yes** | Hardened |

**Proven risks addressed by V2:** bare boolean / soft-field locks; ungated delayed cleanup (slap end, ropes timeout, charge clear); multiple writers per tick without instance identity; A/D / ordinary facing overwriting committed direction when soft field cleared early; old slap stage clearing a newer stage.

## Part 2 — Shared contract

Module: `server-io/actionFacingOwnership.js`  
Storage: `player.actionFacingLock` (not on production delta wire).

Lock shape: `ownerType`, `ownerInstanceId`, `direction`, `reason`, `priority`, `allowDirectionUpdate`, `acquiredTick`, `releaseCondition`, `active`.

Ops: `acquire` / `updateDirection` / `release(expected…)` / `forceClear` / neutral resolve / debug snapshot.

Aerial facing remains on `offensiveAerialFacing.js` (behaviorally unchanged). Soft `*FacingDirection` fields remain dual-written or mirrored for legacy / V2-off.

### Precedence (derived from existing `getLockedFacing` order)

Higher priority wins on acquire (when not forced):

`ROPES (100) > THROW_VICTIM (95) > PULL (90) > HITSTUN/STAGGER/KNOCKDOWN (85) > SLAP/PALM/CHARGED (70) > CHARGE_HOLD (65) > THROWER (60) > CLINCH (55) > GRAB_STARTUP (50) > DODGE/SIDESTEP (40) > RECOVERY (20)`

When V2 is on, an active `actionFacingLock` is consulted **before** soft fields; otherwise legacy soft/flag path is unchanged.

## Part 3 — Action wiring (V2 on)

- **Slap:** mint per stage; `endSlapCycle` releases expected instance only.
- **Palm / charged / hold:** acquire `PALM` / `CHARGED_ATTACK` / `CHARGE_HOLD`; end paths instance-gated.
- **Dodge:** acquire on begin; release on land/cancel; ordinary re-face after release (existing land logic).
- **Hitstun:** acquire after impact facing set; release in `endHitKnockback` / trade timeout.
- **Ropes:** acquire after clear; timeout releases expected ropes instance only.
- **Grab startup → clinch:** acquire on startup; release on successful connect (clinch uses ordinary inward facing).
- **Pull / throw:** acquire at authoritative resolve; pull orphan clear + throw end are instance-gated.
- **Forward throw (W+Mouse2) invariant:**
  - `throwDir` / `throwingFacingDirection` = **world trajectory only**
  - They must **not** be used as sprite facing
  - THROWER ownership locks committed `actor.facing`
  - Victim ownership preserves approved `target.facing`
  - No obsolete over-the-head reversal
  - Both sides mirror correctly; ordinary facing resumes after recovery

## Part 4 — Neutral restoration

`resolveNeutralFacingAfterAction`: valid relative X → `_afFacingPreviousValid` → movement sign → sanitize current facing. Same-center never yields 0/undefined.

## Part 5 — Cleanup

`clearAllActionStates` / round reset / `forceClearActionFacingLock` clear V2 ownership. Soft ropes field still intentionally outlives some clears (legacy).

## Part 6 — Presentation

No new gameplay network fields. Client consumes authoritative `facing`. Debug overlay infers owner type from existing flags (no debug-only wire).

## Part 7 — Aerial compatibility

Offensive-aerial locks, touchdown handoff, parried fall, and Phase 5A tests remain the source of truth. Shared layer does not replace aerial internals.

## Part 8 — Debug

- Server: `snapshotActionFacingDebug(player)`
- Client overlay (`pumo_combat_fidelity_debug`): inferred owner + facing per fighter

## Confirmation

No `npm run build` / bake / asset generation · no Pose Geometry change · no Rope Jump change · no smoke change · no Jolt-art · no low-kick enable · approved priorities / handoffs / forward-throw invariant preserved through default-ON finalization.
