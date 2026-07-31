# Combat Invariants — PUMO PUMO !

Rules future fidelity work must uphold. Phase 1 audit only — nothing here is newly enforced in code.

---

## Gameplay invariants

1. Server remains authoritative for hits, movement outcomes, push separation, grabs, parries, and ring-outs.
2. Hitstop freezes `room.simTime` for both fighters equally (symmetric freeze preserves frame advantage).
3. Slap on-hit remains +0 (victim hitstun = attacker remaining lockout, min `SLAP_MIN_HITSTUN_MS`).
4. Clinch positional rules (`maintainClinchPositions`, attach distances) must not be replaced by generic pushbox logic.
5. Intentional pass-through states (dodge, sidestep, rope-jump **active**, slide-jump **flight**, throw arcs, grab locks) remain pass-through unless a design change explicitly removes them.
6. Thick Blubber / armor absorb remains grabs-oriented as currently implemented.
7. Competitive outcomes (damage, knockback magnitudes, active/recovery windows, input rules) must not change unless a later phase explicitly authorizes balance work.

## Physical invariants

1. Two grounded, non-grappling, non-pass-through fighters must not remain deeply overlapped after pushbox resolution completes.
2. A registered slap / charged / palm strike must confirm when the art tip meets the victim body surface within the tip-rail epsilon (`isWithinConnectRange`).
3. On strike confirm, freeze-frame park distance comes from `getHitParkDistance` (slap/charged at connect; palm at connect + outset).
4. Fast projectiles that can tunnel must use swept checks (snowballs already do).
5. Aerial landings must not rely on “land inside → multi-tick push out” as the primary landing solution. Rope-jump V2 (`ROPE_JUMP_LANDING_V2`, **default on**, approved preset `reference_contact_9`) uses an authored high-vault path with a single apex crossover lock and capped opponent-driven endpoint correction (`ROPE_JUMP_MOVE_IDENTITY_V2.md`); the opponent must not define the full airborne trajectory. Bounded touchdown settle debt is owned by landing-settle during recovery (A.3.1/A.3.2): monotonic overlap reduction; no sticky clear exemption; recovery-exit / first grounded correction ≤0.5 px. Startup remains punishable; airborne `active` remains protected; landing recovery remains punishable. Legacy path remains available via `ROPE_JUMP_LANDING_V2=0` for emergency rollback only. Offensive aerial (slide-jump / FLAP / dive) must resolve hit/parry/whiff **before** any generalized land settle; do not copy rope vault identity onto offense (`OFFENSIVE_AERIAL_LANDING_ARCHITECTURE.md`). Each offensive-aerial activation has one authoritative outcome record (`offensiveAerialOutcome.js`); terminal contact outcomes are immutable for that instance; stale-instance cleanup must not affect a newer activation (`OFFENSIVE_AERIAL_OUTCOME_CONTRACT.md`).
6. Ring-boundary clamps and fighter separation must compose without fighting each other into jitter.
7. Tip length must not be scaled by `sizeMultiplier`; victim body half may (matches current `strikeContact.js` contract).

## Visual invariants

1. A registered strike must look like contact with the victim’s **presented** body, not empty air or a ghost offset.
2. Impact sparks / banners that have tip metadata must originate from `contactX` / contact seam, not root midpoint or legacy `x+70`.
3. Hitstop should freeze a readable two-character contact composition (attacker pose + park spacing + victim reaction).
4. Pose changes must not unexpectedly change the fighter’s ground sole relative to `GROUND_LEVEL` without metadata compensation.
5. CSS squash/stretch must pivot at the sole (`FIGHTER_SOLE_TRANSFORM_ORIGIN`), not the sprite box center.
6. Feedback effects must not be used to hide incorrect body placement.

## Networking invariants

1. Client prediction must never authoritatively invent hits or final collision outcomes.
2. Contact presentation should prefer server-emitted contact fields (`contactX`, `attackerX`, park positions) over client estimates.
3. Hitstop end must be clock-synced (`serverClock` / `getDisplayHitstopUntil`), not “guess from local receipt time.”
4. Interpolation must not continue sliding fighters apart/together during hitstop freeze in a way that destroys the contact pose (`pinFighterX` exists specifically for this).
5. Local vs remote fighters may use different prediction scopes, but both must converge to server truth without visible perpetual drift.

## Animation invariants

1. Pose priority must remain intentional (cinematic / kill / hit / aerial / attack / defense / locomotion order as currently designed).
2. Slap / palm multi-frame client timelines must stay aligned with server active windows for contact poses.
3. Dead positional arguments in `getImageSrc` must not be silently repurposed.
4. Recovery poses must not be overridden by stale action flags (existing sidestep-recovery-before-sidestep rule).
5. Offensive-aerial facing locks are instance-owned (`offensiveAerialFacingLock`); stale actions cannot release or overwrite a newer lock, and presentation uses `offensiveAerialPresentation` rather than inferring attack poses from loose booleans after PARRIED / interrupt (`OFFENSIVE_AERIAL_STATE_FACING_PHASE.md`).

## Existing good reference interactions (must not regress)

| Interaction | Why it is a reference |
|-------------|----------------------|
| Slap tip-rail + extension sep + on-hit park | Art tip → connect → seam; prevents bury; freeze reads solid |
| Charged tip-rail + pushbox yield during lunge + plant (no bounce) | Reach matches limb; Honda-style plant |
| Palm tip-rail + startup sep + park outset | Rooted poke without ghost whiff or limb-through-torso |
| Snowball swept collision | Continuous path check for fast objects |
| Symmetric hitstop via sim clock | Competitive fairness + presentation freeze |
| `contactX` on `player_hit` / guard / many parry emits | Authoritative spark placement |
| Ice movement character + slap ground transfer | Sumo positional currency feel |

## Known intentional exceptions

| Exception | Reason |
|-----------|--------|
| Pushbox disabled during charged **lunge** (not palm) | Otherwise pushbox blocks connect |
| Pushbox / tip-sep disabled during aerial active arcs | Allows cross-over escapes and body-slam approach |
| Rope-jump landing overlap capped at 18px/tick | Softens landing separation; V2 uses this as settle/safety per-tick cap when flag on (see `AERIAL_LANDING_PHASE_A3_2.md`) |
| Low kick uses fixed distance, not tip rail | Placeholder until tip art exists |
| Flap/AP kill cinematic `contactX` midpoint | Pull-kill cinematic path (not live slam FX); live FLAP/slam HIT/PARRIED use surface contact (Phase 3); Phase 4 `heavy_short` recoil is default ON (`OFFENSIVE_AERIAL_REACTION_V2=0` → legacy snap) |
| Clinch own distance system | Grapple composition ≠ strike pushbox |
| `sizeMultiplier` scales pushbox but not sprite width | Client fighter width is fixed at 12.30% |
| CSS sole origin hardcoded 2.1% | Compensates typical transparent foot pad; not per-pose |
| Slap1 tip constant 478 vs alpha ~458 | Likely intentional slack / soft-edge measure — verify before changing |

---

*Phase 1 — do not implement new enforcement until authorized.*
