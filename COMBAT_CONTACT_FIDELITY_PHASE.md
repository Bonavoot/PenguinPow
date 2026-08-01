# Combat Contact Fidelity — Phase 13

**Status:** Implemented behind `COMBAT_CONTACT_FIDELITY_V2` (**default ON** — Phase 14 finalized).  
**Phase 13A follow-up:** slap↔flying-headbutt winners under V2 are physical first-contact (`CHARGED_HEADBUTT_CONTACT_PHASE.md`). Legacy V2-off threshold matrix unchanged.  
**Does not change:** damage/KB/hitstop magnitudes, timing constants, Pose Geometry V2, Facing Ownership V2, Rope Jump, smoke offsets, Jolt art, low kick (disabled).

## Feature flag / rollback

```bash
# unset → V2 (default ON)
COMBAT_CONTACT_FIDELITY_V2=1 npm run dev:web   # V2
COMBAT_CONTACT_FIDELITY_V2=0 npm run dev:web   # exact legacy behavior
```

| Value | Path |
|---|---|
| unset / `""` | V2 (default ON) |
| `1` / `true` | V2 |
| `0` / `false` | legacy |

## Core principle

Separate **eligibility**, **outcome arbitration**, **offensive hitbox**, **hurt/targetability**, **body/pushbox presence**, **contact geometry**, **reaction/interrupt**, and **presentation**.

Losing offensive priority must not erase physical body presence. Only the explicit intangibility allowlist may pass through.

## Interaction matrix (audited)

| Family | Legacy outcome authority | Ghost class (pre-V2) |
|---|---|---|
| Slap vs Slap | Earlier `attackStartTime`; tie → trade | LATE_INTERRUPTION (later slap) |
| Slap vs Charged (≥ threshold) | Legacy: Charged `processHit`. V2+13A flying headbutt: earliest surface contact / point-blank active-start (`chargedHeadbuttContact.js`) | PRIORITY_WITHOUT_REACTION / STALE_ACTIVE_POSE (slap) |
| Slap vs Charged (< threshold) | Legacy: Slap `processHit`. V2+13A: same physical rule (power not a tie-break) | STALE_ACTIVE_POSE / residual lunge (charged) |
| Slap vs Grab throw-catch | `grabCatchesSlap` + clinch | GHOST_BODY / LATE_INTERRUPTION (slap through grabber) |
| Slap vs early grab | Slap stuffs grab | — |
| Charged vs Charged | `resolveChargeClash` | WRONG_CONTACT_SURFACE (midpoint FX) |
| Palm vs Grab clinch | Palm blocked if already grabbing | — |
| Dodge/sidestep i-frames | Intentional evade | INTENTIONAL_EVASION |
| Rope active / slide flight | Intentional intangible | INTENTIONAL_EVASION |
| Charged lunge pushbox yield | Intentional for connect | PUSHBOX_SUPPRESS (body still present) |

Disabled low kick excluded.

## Immunity classification

| Mechanism | Classes | Body present? | Pushbox? |
|---|---|---|---|
| Dodge strike i-frames | DODGE_EVASION, STRIKE | Yes | No |
| Sidestep i-frames | DODGE_EVASION, STRIKE | Yes | No |
| Rope-jump active | PHYSICAL_INTANGIBLE, STRIKE | No | No |
| Slide-jump passive flight | PHYSICAL_INTANGIBLE, STRIKE | No | No |
| Throw travel | PHYSICAL_INTANGIBLE, PUSHBOX_SUPPRESS | Yes | No |
| Charged non-palm lunge | PUSHBOX_SUPPRESS | **Yes** | No |
| `grabImmune` | GRAB | Yes | Yes |
| Thick Blubber | ABSORB (grabs) | Yes | Yes |
| Priority defer `return` | PRIORITY_SUPPRESS | Yes (must stay) | — |
| AP pose hold after hitbox kill | PRESENTATION_ONLY | Yes | — |

### Explicit intangible / pass-through allowlist

`DODGE_STRIKE_IFRAMES`, `SIDESTEP_IFRAMES`, `ROPE_JUMP_ACTIVE`, `SLIDE_JUMP_FLIGHT`, `THROW_TRAVEL`.

## Contact contract

Module: `server-io/combatContactResolution.js`  
Flag: `server-io/combatContactFidelityFlags.js`

Resolution record fields: interactionId, action instance ids, outcome, winner/loser, surfaces, contactPoint, bodyPresence, interruptionReason, settlePolicy, etc.

Ops:

- `classifyBodyPresence`
- `consumeLosingAttackInstance` — kills loser hitbox + attack pose + residual attack velocity on the resolution tick (0 survival ticks)
- `noteWinnerContactResolution` — stamps shared contact identity after hit
- `snapshotCombatContactDebug` / `clearCombatContactState`

Phase 13 consume helpers do **not** re-arbitrate winners. Phase 13A (`chargedHeadbuttContact.js`) **does** re-arbitrate slap↔flying-headbutt under V2 via physical first-contact (palm keeps legacy threshold).

## V2 behavioral corrections (physical contact only)

1. **Slap loses to charged (priority defer):** consume slap hitbox/pose immediately.
2. **Charged loses to slap (< threshold):** consume charged hitbox/pose/lunge velocity immediately; `processHit` still applies slap reaction.
3. **Grab throw-catch beats slap:** consume slap at catch suppress (limb-capture/clinch transition unchanged).
4. **Later slap stuffed:** consume loser slap on that tick.
5. **On `processHit` (V2):** record contact identity; force victim `movementVelocity = 0` after clear so charged lunge cannot ghost.

Gameplay winner, damage, balance, knockback magnitudes, hitstop, and active windows are unchanged.

## High-speed / tunneling

No universal swept solver added. Charged/slap ghost cases inspected were primarily **priority defer without interrupt** and **pushbox yield with surviving attack pose**, not discrete tunneling. Snowball swept checks unchanged.

## Contact settle

Policy default: `REACTION_SEPARATE` (existing hit reaction / knockback). No new authoritative penetration solver; no Rope Jump settle reuse.

## Prediction / client

Debug overlay infers presence from flags (no new wire fields). Client prediction audit deferred unless playtest shows stale charged lunge after V2 server consume — server now clears attack flags on the resolution tick.

## Quantitative targets

| Metric | Target |
|---|---|
| Losing active-pose survival after resolution | **0** ticks |
| Duplicate resolution | **0** |
| Unintended side switches | **0** |
| Outcome mismatches vs legacy | **0** |

## CONTACT_REACTION_MISSING_ART_NEEDS

None required for this phase — uses existing hitstun / grab / attack-end poses.

## Manual matrix

`COMBAT_CONTACT_FIDELITY_V2=1 npm run dev:web`

Slap stages vs grab · slap vs charged both outcomes · palm vs charged · charged vs grab · armor/absorb · parry · dodge · FLAP · trades · both directions · boundaries · reset/rematch · debug OFF/ON.

## Confirmation

No build/bake/assets · no balance retune · no Pose Geometry / Facing Ownership / Rope Jump / smoke / Jolt / low-kick changes · flag **not** default-enabled.
