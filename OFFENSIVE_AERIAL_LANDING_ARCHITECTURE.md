# Offensive Aerial Landing Architecture — Proposal

**Status:** Proposal for landing settle / post-contact polish.  
**Phase 1–2 done:** outcome enum + cleanup stages (`offensiveAerialOutcome.js`).  
**Phase 3 done:** shared slam contact fidelity (`offensiveAerialContact.js`) — metadata/FX placement only.  
**Phase 4 done / approved:** post-contact reaction + landing handoff — `OFFENSIVE_AERIAL_REACTION_V2` **default ON**, preset `heavy_short`.  
Phase 5 generalized settle **deferred** (playtest: no meaningful overlap/snap). Phase 6 anim/FX polish not started.  
Rope Jump V2 remains approved and untouched.

---

## 1. Principles

1. **Attack resolution precedes landing resolution.**
2. **One outcome per attack activation** (multi-hit only if explicitly designed later).
3. **Parry is an interruption outcome** — hitbox dies; deliberate post-parry state.
4. **Whiff body overlap ≠ attack contact.**
5. **Landing depends on interaction result.**
6. **Authoritative gameplay and visible animation must agree.**
7. **State ownership must be explicit.**

---

## 2. Outcome ownership (proposed)

```ts
// Conceptual — not in codebase yet
type OffensiveAerialOutcome =
  | "hit"
  | "parried"
  | "whiff"
  | "armored"      // currently impossible for slam; reserve
  | "interrupted"  // struck out of air / clearAll from other system
  | "clash"        // reserve
  | "trade"        // reserve
  | "landed_without_contact";
```

Set once at contact resolve or at touchdown if never contacted (`whiff` / `landed_without_contact`).  
Immutable for the remainder of the activation.

---

## 3. Post-contact state table (proposed)

| Outcome | Movement owner | Attack active | Hurtbox | Side ownership | Animation | Landing behavior | Recovery | Cleanup |
|---------|----------------|---------------|---------|----------------|-----------|------------------|----------|---------|
| hit | Continue authored air integrator until ground | off (latch) | flight rules until dive/land | preserve pre-land side intent optional | attack/travel → land recover | touchdown then settle w/ knowledge of hit | burst land (current) | clear latch+move at recover end |
| parried | Replace with grounded AP shove | off | grounded vulnerable | facing retarget (current) | parry recoil / recover — **not** aerial land | already grounded | AP stagger (current) | clearAll already ran; finish stagger timers |
| whiff | Continue integrator | off after leave band | same | free cross | travel → land recover | touchdown + settle | 90 / 250 ms (current) | clearSlideJumpState |
| armored | TBD (define when armor applies) | off | — | — | recoil or continue | TBD | TBD | TBD |
| interrupted | hit-fall / KB owner | off | hit | — | hit/fall | hit-fall land | stun | clear aerial + hit-fall |
| landed_without_contact | — | off | grounded | pushbox/settle | land recover | settle | whiff times | clear |

---

## 4. Landing handoff interface (proposed)

```
1) OffensiveInteraction.resolve(tick)
      → outcome + contactPoint + latch/parry side effects

2) PostContactAerial.step(attacker, outcome)
      → movement until touchdown predicate
      → does NOT re-open hitbox unless multi-hit contract

3) Touchdown.begin(attacker, outcome, defenderSnapshot)
      → snap Y, freeze air velocities
      → compute landing footprint intent (side, overlap)

4) LandingSettle.step(...)   // generalized from rope settle
      → monotonic overlap reduction, boundary-safe
      → MUST NOT rewrite combat outcome

5) Recovery.complete
      → cleanup contract
      → facing refresh
      → control restore
```

**Critical:** Shared settle must accept `outcome` as input, not infer “rope vault clear.”

---

## 5. Cleanup contract (proposed)

### Always cleared at move end

`isSlideJumping`, `slideJumpPhase`, velocities, dive flags, latch, recover duration, landing time, flap charges/wing/H-burst, `slideJumpHasFlap`, `slideJumpFlapFlightActive`, `currentAction` (if slideJump), `_offensiveAerialTrace`

### Outcome-dependent

| Field | hit | parried | whiff | interrupted |
|-------|-----|---------|-------|-------------|
| `isRecovering` / stagger | no (uses land lock) | yes | no | maybe |
| Defender KB / hitstun | set on contact | n/a | n/a | other |
| `actionLockUntil` | burst on land | AP stagger | 90/250 | stun |

### Survive touchdown

Latch, flapFlightActive (for recovery ms), diveCommitted (VFX), outcome enum, side intent

### Survive hitstop

All of the above (sim frozen); timers on sim clock

### Cleared only after recovery

Land lock, recovering pose ownership, settle monitoring

### System owners

| System | Owns |
|--------|------|
| `checkFlapBodySlam` / future resolver | outcome + combat fields |
| `index.js` aerial integrator | air movement until handoff |
| Generalized `landingResolution` settle | post-touchdown spacing only |
| `clearSlideJumpState` | move-end aerial fields |
| `clearAllActionStates` | hard interrupt only |

---

## 6. Rope Jump infrastructure reuse

| Component | Use for offensive aerial? |
|-----------|---------------------------|
| Pushbox half-width / min distance | Yes, unchanged |
| Overlap measurement | Yes |
| Landing settle / monotonic reduce | Yes **after** outcome |
| Re-intrusion monitoring | Yes during land recovery |
| Boundary-safe correction | Yes |
| Anchored-player handling | Yes |
| Same-center side resolve | Yes, but seed from **combat/cross-up intent**, not rope apex lock |
| Trace / test harness patterns | Yes |
| Airborne protection / apex crossover / vault trajectory / non-offensive pass-through / endpoint caps / move identity | **No** |

---

## 7. Implementation roadmap (refined)

| Phase | Scope | Gameplay change? | Stop gate |
|-------|-------|------------------|-----------|
| **1** | Outcome enum + set at slam/parry/touchdown; traces assert it | No (mirror flags) | Tests map enum ↔ current flags |
| **2** | Cleanup contract helper; single clear path; optional single slam poll | No (behavior-identical) | No latch/parry leaks in tests |
| **3** | Shared slam contact fidelity (surface contact, classification) | **Done** — metadata only; armor deferred | Contact suite green |
| **4** | Post-contact reaction & landing handoff | **Done / approved** — default ON (`heavy_short`); `=0` legacy | Manual playtest + reaction suite |
| **5** | Generalized settle behind feature flag for slide-jump land | Spacing only | Cross-up preserved |
| **6** | Animation / FX align to outcome | Presentation | Overlay agrees with server |

**Do not** start at Phase 5 — settle without outcome ownership will fight parry/hit cases.

**Highest-risk first target:** Phases 1–2 (done). Phase 3 contact fidelity (done).

**Next prompt scope:** Phase 5 only if future playtests show overlap/snap issues; do not auto-start. Keep V2 reactions; no Rope Jump vault copy.
