# PUMO PUMO ! — PREMIUM COMBAT FOUNDATION AND GAMEPLAY-FEEL PROGRAM

## GROK 4.5 MASTER EXECUTION PROMPT

Continue from the CURRENT WORKSPACE STATE.

You are working inside the real PUMO PUMO ! repository. Treat the current source, current tests, current audit documents, and current user-approved behavior as the source of truth. Do not assume an older prompt, an older report, or a filename is still accurate without inspecting it.

This is a gameplay and combat-quality program for a commercial Steam fighting game. It is not a generic cleanup, not a code-style exercise, and not permission to rewrite the project.

The objective is to make the existing game feel dramatically more legitimate, intentional, readable, physical, responsive, and competitively trustworthy. Changes must be felt during play. Architecture work is valuable only when it directly prevents gameplay defects, enables better interaction quality, or makes future combat tuning safer.

The user is willing to change, remove, or add mechanics when the evidence supports it. However, do not change balance, controls, move identity, or approved interactions casually. First distinguish:

1. A confirmed correctness bug
2. A presentation problem
3. A missing fighting-game foundation
4. A balance decision
5. An animation or art limitation
6. Architecture debt with no immediate player-facing consequence

Prioritize the first three. Do not use the fifth as an excuse for weak timing or weak physical resolution. Defer the sixth unless it is blocking safe gameplay work.

---

# CRITICAL EXECUTION RULE: THIS IS NOT A ONE-SHOT AUTONOMOUS REWRITE

This document is a phased program charter.

When you receive this prompt for the first time:

- Perform PHASE 0 ONLY.
- Phase 0 is read-only except for its two audit/roadmap documents.
- Do not implement Phase 1 or any later phase.
- Finish the Phase 0 report.
- Stop at the exact gate:

    PUMO PREMIUM COMBAT FOUNDATION — PHASE 0 GATE

- Wait for explicit user authorization before continuing.

When the user later authorizes a phase:

- Perform only that numbered phase.
- Reinspect affected code before editing because the workspace may have changed.
- Do not quietly begin the next phase.
- Run only the focused verification allowed for that phase.
- Give the required phase report and stop at that phase’s gate.

If the user says “continue” without a phase number, continue with only the next uncompleted phase.

Never interpret this large prompt as permission to make all changes in one pass.

## Phase map

| Phase | Deliverable | Authority impact |
|---|---|---|
| 0 | Current-source combat audit and ranked roadmap | Documentation only |
| 1 | Deterministic harness, geometry primitives, debug visibility | None |
| 2 | Small proven contract/parity fixes | Narrow; approval for balance-sensitive cancel |
| 3 | Authored combat volumes in shadow mode | None |
| 4 | Move-by-move whiff-punishable limb rollout | High; feature-gated |
| 5 | Sidestep route, overlap, settle, and evade truth | High; authoritative movement |
| 6 | Bounded premium interaction beats | Presentation; any new hitstop is authoritative and separately justified |
| 7 | Actionability/cancel contract hardening | Narrow, test-led consolidation |
| 8 | Determinism, latency, and reconciliation evidence | Measurement plus focused fixes |
| 9 | Consumer CPU and explicit lab-dummy separation | CPU only; same player rules |
| 10 | Approved integration and final regression gate | Consolidation only |

The phase order is a risk-control strategy. Do not collapse shadow validation, authoritative cutover, presentation, and online testing into one patch.

---

# PRODUCT CONTEXT

PUMO PUMO ! is a 2D penguin sumo arena fighter with online PvP, CPU play, and BASHO tournament content. It uses:

- React DOM for the client
- Node/Express and Socket.IO for the server
- Electron for the desktop build
- A server-authoritative combat simulation
- A 2D illustrated fighter presentation rather than bone-driven 3D characters
- Ice movement and ring position as major parts of combat identity

The game is intentionally easier to understand than a traditional combo-heavy fighter, but it must not be built carelessly because it has fewer systems. Its smaller move set should make every interaction clearer, more physical, and more polished.

The relevant control vocabulary includes:

- A/D movement
- S crouch
- W jump
- Mouse1 slap
- Charged flying headbutt through the existing charge command
- Mouse2 grab
- Space defensive actions
- Shift dodge/dash
- S + Shift sidestep
- Rope jump
- Slide jump / FLAP / dive interactions
- Clinch push, Plant, jolt, throw, pull, breaks, and related techniques

Do not change control bindings in this program unless a later phase explicitly proves an input contradiction and the user separately approves a binding change.

---

# THE USER’S QUALITY TARGET

The game should feel legitimate beside polished competitive games even though its mechanics and technology differ from Street Fighter, Tekken, Smash, Brawlhalla, and Skullgirls.

Do not copy those games mechanically. Extract the principles:

- The visible pose and the hittable body agree.
- Startup, active, recovery, invulnerability, and punishability are intentional.
- Whiffed limbs remain meaningfully vulnerable when visually extended.
- Two bodies cannot occupy confusing illegal positions without a clear authored resolution.
- Important interactions receive a short readable beat.
- The beat does not turn ordinary play into a cutscene.
- Input and action eligibility are predictable.
- Outcomes do not depend on player-array order, packet arrival accidents, or stale timers.
- Local and remote players converge cleanly to server truth.
- Debug tools make invisible combat rules inspectable.
- CPU opponents use the same legal combat contract as humans.

The Skullgirls hitbox screenshots supplied by the user are a conceptual reference, not a request to copy Skullgirls’ box density. PUMO needs the same kind of authored honesty, adapted to its simpler silhouettes and gameplay.

A likely correct PUMO solution uses a small number of stable, art-informed shapes:

- Pushbox: physical grounded occupancy
- Hurtbox: hittable body and exposed limbs
- Hitbox: offensive active region
- Grabbox: grab acquisition region
- Optional landing/occupancy footprint where needed
- Explicit invulnerability or intangibility tags

Do not use opaque-pixel collision. Do not create dozens of tiny boxes that jitter between frames. Do not install a physics engine simply because other fighting games have sophisticated tooling. A small deterministic geometry layer is preferable if it solves the actual game.

---

# CURRENT STRONG FOUNDATIONS — PRESERVE THEM

The repository has already received substantial gameplay-feel work. It is not a blank slate.

Before modifying anything, confirm and preserve the behavior and ownership of:

- Server-authoritative 64 Hz simulation
- Reduced 32 Hz state broadcast with client interpolation/prediction
- Pausable room.simTime and symmetric hitstop
- Input queuing through hitstop
- Tip-derived grounded strike contact in server-io/strikeContact.js
- Slap, palm, and charged contact seams and readable park positions
- Charged-headbutt earliest physical-contact work
- Combat contact cleanup and losing-action consumption
- Action lifecycle instance ownership
- Action-facing ownership
- Input command reliability and trace tooling
- Rope-jump landing V2 and its approved high-vault identity
- Offensive-aerial outcome, cleanup, reaction, and facing contracts
- Clinch regression harness and existing visible Open/recovery rules
- Existing combatPresentationEvent and client combatPresentation/dedupe infrastructure
- Existing CombatFidelityDebug overlay
- Existing focused Node node:test suites
- Existing local movement prediction and server reconciliation

Read the existing design/audit documents before proposing replacements, especially when present:

- COMBAT_INVARIANTS.md
- COMBAT_INTERACTION_ARCHITECTURE.md
- COMBAT_FIDELITY_AUDIT.md
- COMBAT_FIDELITY_ROADMAP.md
- COMBAT_CONTACT_FIDELITY_PHASE.md
- CHARGED_HEADBUTT_CONTACT_PHASE.md
- ACTION_LIFECYCLE_OWNERSHIP_PHASE.md
- NON_AERIAL_STATE_FACING_PHASE.md
- INPUT_COMMAND_RELIABILITY_PHASE.md
- CHARACTER_POSE_GEOMETRY_PHASE.md
- Rope-jump and offensive-aerial phase documents
- server-io/test/clinch/README.md

Those documents may contain historical or superseded observations. Verify them against current code. Preserve current user-approved behavior, not an obsolete phase experiment.

---

# HIGH-CONFIDENCE INVESTIGATION LEADS

These findings came from an external read-only audit of a recent repository copy. Treat them as leads that must be reconfirmed in the current workspace, not as permission to edit blindly.

## 1. PUMO has strong strike rails but not a general authored hurtbox system

The grounded strike system already uses art-derived tip distance, victim body half-width, contact correction, and authoritative contact seams. That is good.

However:

- Pushbox width and generic body hurt depth are still closely coupled.
- Most grounded contact remains primarily one-dimensional root/tip distance plus a broad vertical gate.
- server-io/poseRegistration.js and the client pose registry are presentation registration, not combat hurtbox definitions.
- There is no universal per-pose/per-action authored hurtbox definition for exposed body regions.
- A slap arm that remains visually extended during whiff recovery does not appear to become a corresponding attackable limb hurtbox.
- Low kick still uses dedicated legacy reach.
- Grab range, pushbox, clinch attach distance, strike tip, and aerial body contact use several related but separate geometric languages.

Do not destroy the good tip-rail system to make everything “uniform.” Extend combat honesty around it.

## 2. Sidestep has multiple correctness and readability risks

Reconfirm:

- Server constants currently describe approximately 50 ms startup, 400 ms active, and 150 ms recovery.
- A client sidestep trail path has described/hardcoded the active duration as 320 ms.
- sidestepDirection may not be part of the normal fighter delta payload.
- Client sidestep start/trail effects may use fighter facing instead of actual travel direction.
- The server locks a fixed travel target after startup, disables ordinary pushbox interaction during the active arc, and later performs a recovery settle or allows generic pushbox correction.
- Successful and failed pass attempts use final relative position and overlap rules that can become difficult to read when the opponent moves, the boundary clamps the destination, or the arc ends inside the opponent.
- Existing dedicated sidestep coverage appears extremely thin; the obvious test is primarily a facing test rather than a complete movement/collision suite.

The user specifically cares about sidestep destinations that overlap the opponent and resolutions that pop, reverse, clip, or visually confuse the player.

## 3. An intended recovery cancel may be unreachable

Reconfirm the path in server-io/socketHandlers.js and server-io/gameUtils.js:

- The input handler contains logic saying dodge may cancel isRecovering after a 100 ms grace.
- The enclosing branch first requires canPlayerDash(player).
- canPlayerDash appears to reject isRecovering.
- If current code still has this structure, the inner cancellation path is unreachable.

Do not automatically decide that recovery should be cancelable. First prove current intent from comments, tests, and behavior. Then either:

- Make the intended cancel legal and tested, or
- Remove the dead promise and document recovery as intentionally uncancelable.

Because this changes actionability and balance, user approval is required before authoritative behavior changes.

## 4. Action state is heavily distributed

The player factory contains a very large number of boolean-like fields and timers. Eligibility is spread across:

- isPlayerInActiveState
- isPlayerInBasicActiveState
- canPlayerUseAction
- canPlayerDash
- canPlayerSidestep
- socket-level gates
- buffered-action gates
- CPU gates
- individual move systems

This does not justify a wholesale finite-state-machine rewrite. It does justify:

- A documented action/cancel matrix
- Shared capability queries where duplication is proven
- Development assertions for impossible combinations
- Instance ownership for delayed cleanup
- Tests for every corrected eligibility contradiction

## 5. CPU and arena constants may drift

Reconfirm whether cpuAI.js still defines a right boundary of 940 while the game authority exports 935. If true, remove the drift by using the authoritative constant. Do not otherwise “fix Easy AI” during an unrelated phase.

The user intentionally created an EASY slap-only or grab-only dummy for testing. Preserve that testing capability, but isolate it as an explicit development/training fixture rather than allowing it to masquerade as the real consumer-facing EASY difficulty.

## 6. Networking is solid in places but lacks proof for a full fighting-game contract

Reconfirm:

- Hits and final collision outcomes are server-authoritative.
- Local movement and some presentation are predicted.
- Combat starts after server receipt rather than full rollback simulation.
- Hitstop is server/sim-clock controlled.
- State broadcasts are lower frequency than simulation ticks.
- There is no complete rollback implementation.
- Existing tests simulate some delay/order cases, but there is no single deterministic combat input replay covering all core neutral interactions.

Do not introduce rollback netcode or a new networking library in this program without a separate evidence-based gate. First measure the real latency failure modes.

## 7. Some “instant” interactions may actually be presentation failures

The user reports that a clinch throw defended by Plant can feel almost instantaneous and that the thrower can appear to try again immediately.

Current code may already contain:

- CLINCH_THROW_FAIL_STAGGER_MS
- CLINCH_PERFECT_BRACE_OPEN_MS
- clinchThrowFailStagger
- isClinchOpen
- input rejection during Open

Trace the real state before adding another cooldown. If the server already blocks re-throw but the player cannot perceive the Open/stagger, improve the presentation and state tell. If the attacker truly becomes actionable early, fix the authoritative lifecycle. Never hide an actual actionability bug with CSS.

---

# NON-NEGOTIABLE GAMEPLAY INVARIANTS

Unless a later phase explicitly earns and receives approval for a design change:

1. Server remains authoritative for hits, movement outcomes, push separation, grabs, parries, ring-outs, and gameplay freeze.
2. Hitstop freezes both fighters symmetrically on room.simTime.
3. Inputs received during hitstop remain queued and ordered rather than silently lost.
4. Slap on-hit timing and existing positional identity remain unchanged.
5. The approved strike tip → connect → park → seam relationship remains intact.
6. Charged flying headbutt remains a committed high-speed move with current identity.
7. Charged-lunge pushbox yielding must not accidentally spread to palm.
8. Clinch attachment and technique resolution remain owned by the clinch system, not generic pushbox code.
9. Rope Jump’s approved vault identity and landing resolver remain untouched unless a direct regression is proven.
10. Offensive aerial outcomes resolve before landing cleanup.
11. Losing attacks are consumed on the authoritative resolution tick.
12. Stale timers or stale action instances may not clear a newer action.
13. Facing and travel direction remain separate concepts.
14. Client prediction never authors a hit or final collision result.
15. Visual effects prefer authoritative contact positions and event IDs.
16. Two grounded, tangible fighters may not remain deeply overlapped after the responsible resolver completes.
17. A visual limb that is intentionally exposed may become a hurtbox; a visual limb must not remain an offensive hitbox outside active frames.
18. Invulnerability, intangibility, armor, and priority are separate concepts.
19. Player-array iteration order must not decide simultaneous outcomes.
20. Existing controls, damage, stamina costs, Balance rules, knockback, ring rules, and timings stay unchanged unless the phase explicitly authorizes tuning.

---

# UNIVERSAL SAFETY AND WORKFLOW RULES

These rules apply to every phase.

## Before editing

1. Run git status and inspect the current diff.
2. Treat all existing changes as user-owned.
3. Do not overwrite or revert unrelated work.
4. Identify the exact authoritative server path, client consumer path, tests, flags, and docs involved.
5. Report the discovered path and the intended change before editing.
6. If a finding in this prompt is no longer true, say so and adapt. Never recreate a fixed bug to match the prompt.

## Scope discipline

- Change the smallest coherent set of files.
- Do not perform broad formatting.
- Do not rename large systems merely for cleanliness.
- Do not split giant files unless the extraction directly makes the current phase safer.
- Do not rewrite the server, client, Socket.IO architecture, or React presentation.
- Do not introduce TypeScript as part of this work.
- Do not install a physics engine.
- Do not install a new netcode library.
- Do not install dependencies.
- Do not create a second combat simulation on the client.
- Do not replace existing good specialized systems with a generic abstraction.
- Do not touch UI redesign, Gyoji speech bubbles, presentation-lab work, How to Play, menus, BASHO screens, Steam packaging, cosmetics, or unrelated art.

## Prohibited commands and pipelines

Do not run:

- npm run build
- npx vite build
- Any production Vite build
- Electron packaging
- Steam packaging
- npm install
- Package fetching through npx
- Sprite baking
- Sprite recoloring
- Topper generation
- Manifest generation
- Dohyo/arena asset pipelines
- Audio generation
- Broad asset conversion
- Git add
- Git commit

Do not stage or commit files.

## Allowed verification

During implementation phases:

- Focused Node node:test files relevant to the phase
- Focused client unit tests
- Focused ESLint on changed client files using the already-installed local ESLint only
- Existing read-only audit scripts
- Existing deterministic simulation harnesses
- git diff --check
- Manual npm run dev:web playtesting when required

Do not use a production build as verification.

Run the complete relevant server test suite only at the final integration phase, not after every small edit. If a focused phase crosses many combat systems and needs a broader pass, explain why before running it.

## Development process hygiene

Before starting development servers or Electron:

- Check for already-running Node, Vite, Electron, or Chromium processes.
- Do not kill unrelated user processes.
- Check available disk space if the environment has recently been constrained.
- Record processes you start.
- Stop only the temporary processes you started before finishing.

## Claims and evidence

- Never claim manual playtesting was performed if you did not personally observe it.
- If the environment cannot provide meaningful real gameplay input, provide the user with a precise playtest checklist and mark it pending.
- Passing tests is not proof that an interaction feels good.
- A GIF, screenshot, console trace, or debug overlay is supporting evidence, not a substitute for playing the interaction.

## Feature flags and rollback

Use a feature flag only for a materially risky behavior change.

- Do not create one flag per helper or per file.
- New high-risk systems begin default OFF or in non-authoritative shadow mode.
- Preserve the legacy path while the user playtests.
- Finalizing a flag to default ON is a separate approval step after manual validation.
- Every flag must have a documented exact rollback command and tests for unset/true/false semantics.
- Remove obsolete flags only in the final consolidation phase after current behavior is approved.

## Phase completion

At the end of every phase report:

1. Exact behavior before
2. Exact behavior after
3. Exact files created
4. Exact files modified
5. Authoritative state owner
6. Tests run and results
7. Manual playtest status
8. Feature flag and rollback
9. Known risks
10. Deferred items
11. Confirmation that unrelated gameplay/UI was untouched
12. Confirmation that prohibited pipelines did not run
13. Confirmation that nothing was staged or committed
14. Confirmation that temporary processes were stopped

Then stop at the phase gate.

---

# PHASE 0 — SOURCE-OF-TRUTH COMBAT AUDIT

## Authorization

Read-only investigation. Documentation changes only.

## Objective

Reconstruct the current combat contract from real code and tests so later changes do not break user-approved systems or implement obsolete recommendations.

## Inspect

At minimum trace:

- server-io/index.js tick ordering
- server-io/socketHandlers.js input handling
- server-io/gameUtils.js eligibility, timers, sim clock, hitstop
- server-io/gameFunctions.js pushbox and separation
- server-io/collisionSystem.js grounded hit resolution
- server-io/strikeContact.js
- server-io/chargedHeadbuttContact.js
- server-io/combatContactResolution.js
- server-io/actionLifecycleOwnership.js
- server-io/actionFacingOwnership.js
- server-io/playerFactory.js
- server-io/constants.js
- server-io/deltaState.js
- server-io/fighterBroadcast.js
- server-io/grabActionSystem.js
- server-io/grabMechanics.js
- server-io/offensiveAerialContact.js
- server-io/offensiveAerialOutcome.js
- server-io/landingResolution.js
- server-io/cpuAI.js
- client/src/components/Game.jsx
- client/src/components/GameFighter.jsx
- client/src/prediction/
- client/src/combatPresentation/
- client/src/debug/CombatFidelityDebug.js
- current server and client tests
- current combat audit/phase documents

Confirm tick order, especially:

1. Input queue consumption
2. Movement integration
3. Pushbox resolution
4. Strike extension separation
5. Collision checks
6. Hit resolution
7. Hitstop
8. Broadcast/delta construction
9. Client snapshot consumption
10. Client prediction/interpolation
11. Presentation event handling and dedupe

## Required outputs

Create or update:

- PREMIUM_COMBAT_FOUNDATION_AUDIT.md
- PREMIUM_COMBAT_FOUNDATION_ROADMAP.md

Do not rewrite existing historical phase documents.

### The audit must include

1. Current architecture map with exact owners
2. Current simulation and broadcast rates
3. Full move interaction matrix
4. Startup/active/recovery owner for every move
5. Pushbox/hurtbox/hitbox/grabbox status for every move
6. Invulnerability/intangibility/armor/priority matrix
7. Action and cancel matrix
8. Server/client prediction responsibility matrix
9. Hitstop and input-buffer pipeline
10. Sidestep state and positional trace
11. Clinch Plant-resist trace
12. CPU difficulty and test-dummy trace
13. Determinism and iteration-order risks
14. Existing test coverage and missing tests
15. Performance risks of a geometry layer
16. Exact confirmed findings from the leads above
17. Exact leads that are no longer true
18. Ranked MUST FIX / SHOULD FIX / DEFER list

### The action matrix must distinguish

- Neutral
- Startup
- Active
- Recovery
- Hitstun
- Open/stagger
- Dodge startup/active/recovery
- Sidestep startup/active/recovery
- Grab startup/whiff
- Clinch neutral/push/Plant/jolt/technique/Open
- Rope jump
- Slide jump/FLAP/dive
- Ropes
- Thrown states

For every row, record:

- Can move?
- Can face?
- Can attack?
- Can grab?
- Can defend?
- Can dodge?
- Can sidestep?
- Can buffer?
- Has pushbox?
- Has hurtbox?
- Has hitbox?
- Is invulnerable?
- Is intangible?
- Which owner clears it?

### Required Phase 0 analysis questions

Answer explicitly:

1. Is the 100 ms dodge-from-recovery cancellation actually unreachable?
2. Is sidestep active 400 ms on server while the client trail assumes 320 ms?
3. Is sidestepDirection absent from production fighter deltas?
4. Do client sidestep particles use facing instead of travel?
5. Can a successful sidestep begin recovery or end the move inside a grounded opponent?
6. What happens when there is insufficient boundary space on the desired far side?
7. Can an opponent moving during the sidestep invalidate the original success test?
8. Does generic pushbox correction ever fight the sidestep recovery resolver?
9. Is the Plant-resisted thrower truly actionable immediately, or does it only look that way?
10. Which visible attack limbs remain extended during recovery without corresponding hurt volume?
11. Which moves already have physical surface models that must not be replaced?
12. Which simultaneous outcomes remain sensitive to player iteration order?
13. What exact inputs are locally predicted, and what visible delay remains at realistic RTT?
14. Is the EASY test dummy accessible as ordinary consumer-facing EASY?
15. Is the CPU boundary constant stale?
16. How much per-tick allocation would the proposed geometry approach add?
17. Is there a deterministic input replay capable of reproducing a full neutral interaction?

## Phase 0 prohibition

Do not:

- Change production combat
- Add hitboxes
- Fix sidestep
- Change recovery
- Change CPU
- Add VFX
- Add tests that require production code changes
- Create new feature flags

## Phase 0 final recommendation

Recommend the smallest sequence of phases that can produce the largest felt improvement. If this master sequence should be adjusted because the current source already solved something, explain the adjustment. Do not simply echo this prompt.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 0 GATE

---

# PHASE 1 — DETERMINISTIC SAFETY HARNESS AND COMBAT-VOLUME DEBUG VIEW

## Authorization

Only after explicit user approval of Phase 0.

## Objective

Make invisible combat rules observable and testable before changing authoritative outcomes.

This phase must not change who wins, who gets hit, damage, movement, timing, stamina, Balance, invulnerability, or actionability.

## 1. Deterministic geometry primitives

Create a small dependency-free server geometry module with pure functions for the minimal shapes selected in Phase 0.

Prefer simple mirrored local rectangles or capsules. Choose only what is necessary.

The module must support:

- Local shape definition relative to fighter root
- Mirroring by committed action facing
- World-space conversion
- AABB/capsule intersection as selected
- Contact point/normal approximation
- Finite-value validation
- Stable deterministic ordering
- Optional swept test for fast one-axis movement when required later

Do not connect it to live hit outcomes yet.

Avoid per-tick object churn:

- Freeze or precompute shape templates
- Reuse scratch structures where practical
- Do not parse assets during gameplay
- Do not read DOM geometry
- Do not examine sprite pixels at runtime

## 2. Combat-volume vocabulary

Define explicit terms:

- PUSH
- HURT_BODY
- HURT_LIMB
- HIT
- GRAB
- LANDING
- INTANGIBLE
- INVULNERABLE
- ARMOR

Do not treat these as interchangeable.

## 3. Developer overlay

Extend the existing CombatFidelityDebug system rather than creating an unrelated debug application.

Provide a development-only toggle that can render current or shadow combat volumes over the real arena:

- Pushbox: blue
- Hurtbox body: green
- Hurtbox limb: lighter green
- Hitbox: red
- Grabbox: yellow
- Landing footprint: cyan or another clearly distinct color
- Intangible/invulnerable state: label or outline treatment

The colors are debug semantics only and have no relationship to production art direction.

The overlay must:

- Use the same world-to-screen transform as fighters
- Mirror correctly
- Track server-authoritative or accurately reconstructed action phase
- Work for both player sides
- Work through cross-ups
- Scale at 1920×1080 and 1280×800
- Be disabled by default
- Have negligible production overhead when disabled
- Not add normal production network traffic

If authoritative debug shapes need to cross the network, use an explicit development-only debug flag and compact payload. Do not add them to every production fighter delta.

## 4. Deterministic scenario harness

Build a focused server test harness capable of stepping:

- room.simTime
- Both player roots
- Facing and travel direction
- Action phase
- Shape generation
- Candidate contacts
- Outcome ordering

It must be possible to run the same scenario twice and compare the trace exactly after excluding presentation-only wall-clock identifiers.

Add characterization tests for current live behavior before any cutover.

## Required scenarios

- Idle versus idle
- Movement into pushbox
- Slap startup/active/recovery
- Palm startup/active/recovery
- Charged hold/startup/lunge/recovery
- Low kick
- Grab startup and whiff
- Dodge
- Sidestep all phases
- Cross-up
- Same-center fallback
- Both ring boundaries
- Size multiplier combinations
- Hitstop
- Reset/rematch cleanup

## Acceptance criteria

- Live gameplay outcomes are unchanged.
- Debug shapes line up with fighter roots and mirrored direction.
- Repeated simulation traces are deterministic.
- Debug-off performance shows no meaningful regression.
- No new production dependency.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 1 GATE

---

# PHASE 2 — PROVEN CONTRACT BUGS AND CLIENT/SERVER PARITY

## Authorization

Only after Phase 1 is approved.

## Objective

Fix small, directly proven contradictions before attempting the large geometry or sidestep redesign.

Do not combine these fixes with new hurtbox authority or new sidestep behavior.

## Candidate fixes to reconfirm

### A. Sidestep presentation parity

If confirmed:

- Eliminate the 400 ms server versus 320 ms client phase-duration drift.
- Send or derive the actual sidestep travel direction.
- Stop using facing as a substitute for travel direction.
- Ensure start/trail/landing effects use authoritative phase edges.
- Avoid an independent client timer that can outlive or under-run the server state.
- Preserve current gameplay timing.

Choose the smallest robust protocol:

- A compact direction and phase-progress field, or
- A shared generated configuration already supported by the repository, or
- State-edge-driven VFX with authoritative remaining time

Do not import server CommonJS constants directly into browser code through a fragile bundler hack.

Add server payload tests and client tests for:

- Both travel directions
- Both facings
- Cross-up where facing changes but travel does not
- Delta packets
- Keyframes/resync
- Interrupted sidestep
- Recovery edge

### B. Recovery cancel contradiction

If current code still contains an unreachable “dodge cancels recovery after 100 ms” path:

1. Characterize current behavior in a failing test.
2. Document whether the intended design is cancelable or uncancelable.
3. Present the choice to the user before changing authoritative behavior.
4. If approved as cancelable, make the outer eligibility gate explicitly support the permitted recovery override without weakening every other blocking state.
5. If approved as uncancelable, delete or correct misleading dead logic and comments.

Do not make canPlayerDash generally ignore isRecovering.

Test:

- 99 ms rejected
- Boundary exactly at the approved rule
- After window accepted if intended
- Hitstun never cancelable through this path
- Ropes/throw/clinch/Open remain blocked
- Gassed remains blocked
- Buffered Shift cannot cause double dodge

### C. CPU boundary drift

If cpuAI still carries 940 while the authoritative boundary is 935:

- Import/use the authoritative boundary.
- Add a focused edge test.
- Do not otherwise retune CPU.

### D. State/payload cleanup

Fix only directly proven missing fields, stale cleanup, or client parity defects needed by A–C.

Do not begin a player-state rewrite.

## Acceptance criteria

- No move timing changes except a separately approved recovery-cancel behavior.
- Sidestep VFX follows actual travel and actual authoritative phase duration.
- Resync/keyframes preserve direction.
- CPU edge calculations use the true arena boundary.
- New tests fail on the old behavior and pass on the fix.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 2 GATE

---

# PHASE 3 — AUTHORED COMBAT GEOMETRY IN SHADOW MODE

## Purpose

Create the missing fighting-game geometry foundation without changing a single live combat outcome yet.

This is deliberately a shadow-mode phase. The candidate geometry is calculated, visualized, logged, and tested, but the current authoritative hit/contact code continues to decide gameplay.

The goal is not to imitate the number of rectangles visible in a Skullgirls developer screenshot. The goal is for every important PUMO pose to have an intentional physical meaning that an engineer and designer can inspect.

## Before editing

Trace and document the current ownership of:

- Pushbox width and physical separation
- Generic body hit depth/body half-width
- Slap, palm, low-kick, charged-headbutt, grab, aerial, rope-jump, and clinch contact
- Character size variants and BASHO size modifiers
- Pose identity, action identity, action phase, facing, action facing, root position, height, and scale
- Invulnerability, intangibility, pass-through, armor, and throw immunity
- Client rendering scale versus server gameplay scale

Do not assume the client pose registry is authoritative combat data.

## Implement a minimal data-driven volume vocabulary

Use the smallest set of shapes that accurately describes PUMO:

- Axis-aligned or facing-mirrored rectangles for most body regions
- Capsules or circles only when they materially improve a rounded limb or head
- A grounded pushbox/occupancy interval
- Hurt regions with semantic labels such as torso, head, frontArm, rearArm, frontLeg, and rearLeg
- Offensive regions only where a move needs them and only during its authored active window
- Grab acquisition regions kept distinct from strike hitboxes
- Explicit tags for intangible, strike-invulnerable, throw-invulnerable, armored, or non-targetable regions

Prefer two to six meaningful hurt regions over a cloud of frame-by-frame microboxes. Stable shapes are easier to tune, test, mirror, serialize, and reason about.

Geometry must be expressed in fighter-local coordinates and transformed by authoritative root position, size/scale, and action-facing ownership. A same-frame facing flip must not teleport an already-committed attack to the opposite side.

Do not use DOM measurements, sprite pixel alpha, CSS layout, browser image dimensions, or client animation timing as server combat authority.

## Required data contract

Build or extend a combat-volume query that can answer, for a fighter and authoritative simulation time:

- Current action/lifecycle instance
- Current combat phase: startup, active, recovery, neutral, incapacitated, airborne, clinched, or another existing canonical phase
- World-space pushbox
- World-space hurt regions
- World-space offensive regions if active
- World-space grab region if applicable
- Region labels and flags
- The exact source definition/fallback used

Do not force every move into identical phases if current mechanics genuinely differ. Represent the truth that exists.

Use existing constants and lifecycle clocks rather than starting independent timers. Centralize timing metadata only when doing so does not create a second owner or silently change current timings.

## Shadow comparison

For supported interactions, calculate both:

1. The current authoritative result
2. The candidate authored-volume result

The candidate must not deal damage, cancel actions, move fighters, change hitstop, alter presentation events, or affect AI in this phase.

Record mismatches with an explicit taxonomy:

- LEGACY_HIT_CANDIDATE_MISS
- LEGACY_MISS_CANDIDATE_HIT_BODY
- LEGACY_MISS_CANDIDATE_HIT_LIMB
- PHASE_DISAGREEMENT
- FACING_OR_MIRROR_DISAGREEMENT
- SCALE_OR_SIZE_DISAGREEMENT
- VERTICAL_DISAGREEMENT
- ORDER_OR_MULTI_CONTACT_DISAGREEMENT
- UNSUPPORTED_ACTION_FALLBACK

Rate-limit and aggregate diagnostics. Do not flood production logs. Shadow diagnostics must be development-only or explicitly gated.

## Debug visualization

Extend the existing CombatFidelityDebug tooling instead of creating a disconnected debug app if practical.

The overlay must be development-only and must distinguish at minimum:

- Pushbox
- Hurtbox/body region
- Hurtbox/exposed limb
- Active strike hitbox or existing tip/contact rail
- Grabbox
- Intangible/invulnerable region
- Legacy contact result versus candidate result
- Action phase and lifecycle instance

It must support:

- Both players
- Both facings
- Different sizes
- Airborne and grounded states
- Freeze/single-frame or deterministic fixture inspection if existing tooling allows it
- A legend that makes colors understandable
- A toggle that cannot be enabled accidentally in production

Do not send debug-only geometry over the normal production network stream every tick. Prefer deriving it from authoritative fixtures, local debug data, or an explicitly gated debug channel.

## Initial authored coverage

In this phase, author and validate geometry for a deliberately limited slice:

1. Neutral/standing body
2. Crouch body
3. Slap startup, active, and visible recovery
4. Palm if it shares a proven lifecycle cleanly
5. Charged-headbutt presentation shapes without replacing its approved contact authority
6. Sidestep startup/active/recovery occupancy for visualization only

Do not attempt every aerial, clinch, rope, and BASHO variant at once. Unsupported states must fall back explicitly and visibly, never silently to a misleading box.

## Performance and determinism requirements

- Candidate geometry must be deterministic at a given simulation tick.
- Do not allocate large arrays/objects for every fighter on every tick if a reusable or query-on-demand structure is practical.
- Do not use floating random values or wall-clock time.
- Use a documented edge policy for touching boundaries and epsilon handling.
- Mirror from one authored definition when possible rather than maintaining separate left/right data.
- Preserve array-order independence.
- Never round on the client and server differently for a gameplay-relevant value.

## Required focused tests

Add tests for:

- Left/right mirroring around root position
- Action-facing ownership across a cross-up
- Startup/active/recovery boundary ticks
- Visible recovery limb remaining in candidate hurt geometry
- Offensive region absent before startup ends and after active ends
- Hurt region still present when offensive region is absent
- Crouch versus standing geometry
- Small, normal, and large fighter scale
- Exact edge-touch policy
- Same-center fighters
- Reset/new action lifecycle does not reuse stale geometry
- Interrupted action removes the correct offensive region
- Unsupported action reports an explicit fallback
- Results do not change when player array order is reversed

## Phase 3 evidence

Create/update the phase roadmap with:

- A geometry ownership diagram
- A move/phase/region table for the authored slice
- Overlay screenshots or deterministic fixture evidence for both facings
- A legacy-versus-candidate mismatch table
- Known unsupported states
- Performance observations
- Recommendation for the first authoritative rollout slice

## Phase 3 acceptance criteria

- Live gameplay outcomes are byte-for-byte or behaviorally unchanged.
- Candidate shapes accurately track authoritative action phase and action facing.
- The visible slap recovery arm is represented as a hurt region in shadow mode.
- The overlay makes disagreements inspectable.
- No production debug stream, dependency, physics engine, or pixel collision is introduced.
- Focused tests pass.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 3 GATE

---

# PHASE 4 — WHIFF-PUNISHABLE LIMBS AND AUTHORITATIVE HURTBOX ROLLOUT

## Purpose

Make visually exposed attacking limbs honestly punishable, using the shadow-mode evidence from Phase 3 and a guarded move-by-move rollout.

This is one of the highest-risk phases. Do not proceed unless Phase 3 evidence is complete and the user explicitly authorizes Phase 4.

## Core design contract

When a limb is visibly extended during an attack or its recovery:

- It may be struck as part of that fighter’s hurtbox.
- It does not remain an offensive hitbox outside the move’s active phase.
- Striking it resolves against the owning fighter through the normal approved damage/contact pipeline unless a different region-specific rule is explicitly approved.
- It must not create a second damage event when the same opposing strike overlaps both limb and torso.
- It must not let one attack hit the same action lifecycle multiple times.
- It must remain consistent for both player slots, both facings, cross-ups, size modifiers, and network resync.

This does not mean every feather, foot tip, or squash-and-stretch smear becomes hittable. Author the competitively meaningful silhouette.

## Preserve the existing strike-contact strengths

Do not replace the approved slap/palm tip rail, victim body-half logic, contact correction, charged-headbutt earliest physical contact, or contact seam merely to say the game now uses boxes.

The initial authoritative change should use authored hurt regions as the target surface while keeping proven attacking contact ownership intact wherever compatible.

If replacing a proven contact rail becomes necessary, stop and present:

- The exact defect it causes
- A failing regression test
- A comparison of old and proposed behavior
- The expected balance/spacing consequence

Wait for user approval before that replacement.

## Feature gating and rollout

Add one narrowly named server-side development/rollout flag following existing configuration conventions. Its initial default must preserve current production behavior until verification is complete.

Do not leave a permanent maze of per-move flags. Use temporary rollout control, then consolidate after approval.

Roll out in this order unless Phase 3 evidence strongly disproves it:

1. Slap target hurt regions
2. Slap visible-recovery limb vulnerability
3. Palm if its lifecycle and art are sufficiently verified
4. Low kick only after its actual pose/reach contract is traced
5. Charged headbutt only as a compatibility check around its already approved contact system

Keep grab acquisition, clinch attachment, rope jump, offensive aerials, and throw contact on their existing authority during this phase unless a directly blocking defect is proven.

## Multi-region contact resolution

For each attacking action instance against one victim:

- Gather candidate overlaps deterministically.
- Select one winning contact with a documented priority/tie-break policy.
- Prefer earliest physical contact along the attack’s travel/contact direction when meaningful.
- Preserve the correct contact point for VFX and contact correction.
- Consume the hit exactly once through the existing action lifecycle ownership.
- Do not depend on hurt-region array order.

Suggested region priority is not automatically head over torso over limb. The policy should preserve physical contact and stable gameplay, not invent region damage bonuses.

Do not add headshots, limb damage scaling, dismemberment, or region-specific stun in this program.

## Punish and counter semantics

Inspect current counter-hit and punish classification before using the new limb contact.

- A strike that catches a whiff-recovery limb should be classified consistently with current punish rules if the victim is in recovery.
- Do not label every limb hit a punish.
- Do not change current startup counter-hit semantics without separate evidence.
- Existing combatPresentationEvent ownership remains the presentation source.

## Required authoritative tests

For each rolled-out move, cover at minimum:

- Torso-only contact
- Limb-only contact during active phase
- Limb-only contact during recovery
- Limb contact absent after the visual/defined recovery exposure ends
- Both torso and limb overlap resolves one hit
- Two attacking players on the same tick remain order-independent
- Exact active-to-recovery boundary
- Exact recovery-to-neutral boundary
- Interrupted/cancelled move cleanup
- Cross-up with action facing retained
- Different fighter sizes
- Victim crouching, moving, sidestepping, airborne, hitstunned, and invulnerable as applicable
- Ring-edge contact correction does not force an illegal position
- Hitstop, damage, posture/stamina, hit reaction, VFX contact point, and action consumption occur once
- Legacy behavior remains for moves outside the rollout

Add regression fixtures for representative whiff-punish spacing. A future tuning change must make the snapshot/fixture difference obvious.

## Manual inspection matrix

At normal speed and frame-stepped/debug speed, inspect:

- Attack barely whiffs the torso; opponent strikes the extended limb
- Attack is still active; two hit regions overlap
- Recovery arm retracts and stops being hittable at an intelligible moment
- Left/right mirror and cross-up
- Small versus large wrestler
- Ring edge
- Local attacker versus remote victim, then reversed
- CPU attacker and CPU victim

The result must look like the visible penguin was struck. No invisible air hits, backward contact sparks, double sparks, or root teleport.

## Phase 4 acceptance criteria

- A clearly extended whiffed slap limb can be punished.
- Active and recovery vulnerability are separate from offensive activity.
- Existing approved contact seams and charged behavior remain intact.
- Contact is once-only and order-independent.
- Unsupported moves retain known legacy behavior rather than receiving guessed boxes.
- Network clients observe the same authoritative result.
- The rollout can be disabled cleanly until user approval.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 4 GATE

---

# PHASE 5 — SIDESTEP PHYSICAL RESOLUTION AND DESTINATION SAFETY

## Purpose

Make sidestep trustworthy and visually comprehensible before adding spectacle.

This phase owns only authoritative sidestep travel, collision/overlap resolution, outcome classification, state cleanup, payload correctness needed by that behavior, and focused tests. It does not yet own slow motion, screen dimming, afterimages, or dramatic presentation.

## First build the sidestep scenario harness

Create focused deterministic helpers/fixtures using the real movement and collision code. Do not test a reimplementation of the algorithm.

The matrix must vary:

- Player slot/order
- Left/right travel
- Left/right facing and cross-up
- Stationary, approaching, retreating, and crossing opponent
- Same-center start and slight initial overlap
- Opponent widths/sizes
- Sidestepper widths/sizes
- Center, left boundary, and right boundary
- Destination open, partially blocked, and impossible
- Opponent attacking, recovering, stunned, crouching, jumping, and sidestepping
- Normal completion, interruption, hitstop, round end, disconnect/reset, and new-round cleanup

Capture per simulation tick:

- Root positions
- Pushbox intervals
- Overlap depth
- Intended side of opponent
- sidestepDirection
- Phase
- Travel target
- Outcome
- Tangible/pass-through status
- Recovery ownership
- Any correction displacement and owner

## Explicit outcome model

Give each completed or interrupted sidestep one authoritative outcome, using names consistent with project conventions. It must distinguish at least:

- CLEAN_PASS: reached the intended far side without illegal final overlap
- PASS_WITH_SETTLE: crossed successfully but required a small authored final separation
- BLOCKED_SHORT: safe far-side placement was impossible, so the move failed on the original side
- EDGE_CONSTRAINED: the arena boundary prevented the intended route/destination
- INTERRUPTED: hit, grab, round transition, or another legal state ended the move
- NO_TARGET or equivalent if sidestep can legitimately occur without a meaningful opponent reference

The exact enum names may differ. The behavioral distinctions may not be collapsed into a single generic complete flag.

## Non-negotiable resolution rules

- A completed sidestep may not leave fighters in an illegal ambiguous overlap.
- The resolving player may not pop from one side of the opponent to the other on the final frame without a readable travel path.
- Generic pushbox separation and sidestep-specific settle may not fight each other in the same tick.
- One system owns the tangible handoff and final settle.
- Overlap correction after active travel must reduce overlap monotonically unless an explicit new collision changes the situation.
- Do not move the defender as a hidden shortcut merely to make the sidestepper fit, except through the ordinary symmetric pushbox rules already expected during legal tangible contact.
- Do not teleport either player through the ring boundary.
- Do not choose the final side from a noisy one-frame root comparison after the opponent has crossed. Track the intended route/side with stable authoritative state.
- If the far-side destination becomes impossible, resolve to a readable same-side failure with existing recovery/exposure, not a last-frame warp.
- Do not grant extra invulnerability, cancelability, distance, or speed as a side effect of collision cleanup.
- Hitstop and server simTime must pause/advance sidestep consistently with the rest of combat.

## Suggested resolution approach

Do not implement this blindly; prove it against the harness.

A safe design will likely:

1. Snapshot a stable sidestep direction, intended target relationship, and legal destination interval at the authoritative start.
2. Re-evaluate physical clearance as the opponent moves without changing the move’s travel identity.
3. Permit controlled pass-through only during the authored phase.
4. At tangible handoff, solve the nearest legal non-overlapping placement on the intended side within the ring.
5. Limit settle correction to a small, visible, deterministic distance.
6. If no legal far-side interval exists, choose the defined blocked/edge outcome and remain on the original side.
7. Hand back to generic pushbox resolution only after sidestep-specific resolution is complete.

Do not add pathfinding, a general physics engine, continuous rigid-body simulation, or spring forces.

## Confirmed-evade gameplay event

Add a server-authoritative, once-only semantic fact indicating that a sidestep genuinely evaded an opponent attack. This fact will drive Phase 6 presentation, but Phase 5 must not add the spectacle.

An evade is confirmed only when all approved conditions are true, for example:

- The opponent has an active committed strike/action instance.
- The sidestep’s evasive/pass-through window is active.
- The attack would have threatened the sidestepper according to current or approved authored contact geometry, or crossed an explicitly defined threat corridor.
- The sidestep causes that committed threat to miss.
- The same opponent action instance has not already awarded this evade.

Do not award a premium evade merely because Shift/S+Shift was pressed near an idle opponent. Do not predict it exclusively on the client.

The semantic event must include stable identifiers needed for dedupe, such as room/match epoch if available, simulation time/tick, sidestep action instance, opponent attack instance, actor, target, travel direction, contact/threat position, and outcome.

Do not change damage/hit resolution to fabricate an evade. If the attack legitimately hits, it is not an evade.

## Required focused tests

Add enough cases to cover the matrix, including at least:

- Clean pass in both directions
- Both player array orders
- Opponent moving into the destination
- Opponent moving across during the sidestep
- Same-center start
- Initial shallow overlap
- Left and right boundary-constrained attempts
- Small around large, large around small, and equal sizes
- Exact tangible-handoff tick
- No overlap increase during settle
- No reverse-side pop
- Blocked attempt remains original side
- Generic pushbox does not double-correct
- Interrupted startup, active, and recovery
- Hitstop during each phase
- New round/reset cleanup
- Keyframe/resync retains route and outcome state where necessary
- One confirmed-evade event for one attack lifecycle
- No evade event against idle/recovery-only opponent
- No evade event when attack hits
- Two simultaneous threats resolve deterministically

## Manual visual verification

Inspect normal speed and slowed developer playback, but do not alter live game speed as the solution.

The player should be able to answer from the motion alone:

- Which direction did I travel?
- Did I get around them?
- Was I blocked by them or the ring?
- Why am I on this side now?
- When did I become tangible/actionable again?

No final frame may look like clipping, teleporting, being squeezed through the opponent, or being yanked backward by a cleanup system.

## Phase 5 acceptance criteria

- Sidestep finishes in a legal, understandable position across the scenario matrix.
- The server owns outcome and separation.
- Travel direction, intended side, outcome, and recovery state survive normal payload/resync requirements.
- A real evaded attack creates exactly one semantic event.
- No VFX or freeze is being used to hide unresolved geometry.
- Existing movement speed, phase timings, and cancel rules are unchanged unless explicitly approved.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 5 GATE

---

# PHASE 6 — PREMIUM INTERACTION BEATS AND PRESENTATION DIRECTOR

## Purpose

Make high-value interactions readable and satisfying without turning the match into constant slow motion or allowing client spectacle to lie about server gameplay.

This phase begins only after the underlying mechanics and outcome events are trustworthy.

Use the existing combatPresentationEvent pipeline and client combatPresentation/dedupe ownership. Extend it where necessary. Do not build a second competing announcement, freeze, or event bus.

## Design principle: resolve, emphasize, release

Premium fighting-game feel often comes from a very short structured beat:

1. The server resolves the mechanical outcome.
2. The game emphasizes the important instant.
3. Both players and spectators can read what happened.
4. Presentation clears before it smothers the next decision.

This is not permission to place interactions “on rails” through long forced animations. The beat must fit PUMO’s fast pace.

## Build a priority and budget contract first

Inventory every current source of:

- Simulation hitstop
- Visual-only freeze/hold
- Screen shake
- Camera or arena displacement
- Screen dim/flash
- Particles
- Afterimages/trails
- Character CSS transforms
- Combat text/callouts
- Audio stingers/ducking
- Controller rumble if present

Document the owner, trigger, duration, stacking behavior, cancellation behavior, and reduced-effects behavior.

Define presentation priority tiers using existing conventions where possible:

- Match/round-ending result
- Rare mastery interaction
- Major defensive reversal
- Standard confirmed hit/throw
- Ordinary information

Define a budget so simultaneous events do not produce:

- Additive slow motion
- Repeated hitstop for one mechanical outcome
- Unbounded screen shake
- Permanent dim overlays
- Competing afterimage systems
- Callout spam
- Audio/VFX triggered again by delta retransmission or React remount

One mechanical event ID must produce at most one presentation beat per client epoch.

## Authoritative versus visual timing

Use server hitstop when gameplay really must pause symmetrically. Use visual-only transforms, particles, scene lighting, or short holds when only emphasis is needed.

Never pause the local DOM while the server simulation, remote opponent, and input eligibility continue invisibly underneath.

Never use a client setTimeout as the authoritative end of a gameplay state. Visual timers may animate an already resolved event, must be cancellable on unmount/room reset, and must derive their identity from the event.

Any new simulation pause must:

- Be server-authoritative
- Use room.simTime/existing hitstop ownership
- Affect both players consistently
- Preserve input queue semantics
- Have a hard maximum
- Be covered by order-independent tests
- Be justified by playtest evidence rather than spectacle preference

## Beat A: confirmed sidestep evade

Use the Phase 5 semantic event. A suggested starting composition, to be tuned in the real game:

- One brief localized or global contrast falloff/dim that does not obscure positions
- Belt/mawashi-color afterimages along the true travel path
- A crisp directional light streak or particle accent sourced from actual travel direction
- A restrained character accent transform or pose hold if animation is missing
- Optional tiny server-authoritative hitstop only if the existing simulation can express it safely and blind playtesting proves it helps
- Immediate release back to normal readability

Requirements:

- The effect occurs only for a genuinely evaded active attack.
- It appears once per sidestep/attack interaction.
- The trail begins at prior authoritative/presentation positions and ends at the resolved legal position.
- It does not display on the wrong side because facing changed.
- Belt colors are derived from real player data with a readable fallback.
- Scene dimming restores on cancellation, room change, round end, remount, and reduced-effects mode.
- It does not imply invulnerability beyond the real evasive phase.
- It does not make an ordinary unthreatened sidestep look like a mastery event.

Do not add a large banner by default. Let motion, color, and a compact callout if truly useful communicate the event.

## Beat B: clinch Plant resistance / Perfect Brace Open

First trace the current real behavior end to end:

- Input acceptance
- Throw attempt lifecycle
- Plant/brace determination
- Current CLINCH_THROW_FAIL_STAGGER_MS or equivalent
- Current CLINCH_PERFECT_BRACE_OPEN_MS or equivalent
- applyClinchOpen or equivalent ownership
- Actionability of both players
- Client poses and presentation events

The external audit found evidence that a resisted throw already receives roughly a 320 ms stagger and Perfect Brace can apply roughly a 400 ms Open window. Reconfirm. The user’s complaint that the exchange feels instantaneous may therefore be a presentation/pose problem rather than a missing gameplay lockout.

If the authoritative recovery/open window already exists and is correct:

- Do not stack a hidden cooldown on top.
- Make the failed throw visibly recoil/hold for the actual existing duration.
- Make the successful Plant/brace read visually legible.
- Use a short authored shake, squash, recoil translate/rotate, foot skid, contact pulse, or similar transform if final animation is unavailable.
- Ensure the transform does not move the authoritative root or change hitboxes.
- Return exactly when the existing state says the player is actionable.

If the authoritative state does not actually prevent immediate retry:

- Prove it with an input/action trace and failing test.
- Present the exact proposed lock/recovery timing and balance consequence.
- Wait for user approval before changing it.

Do not loop CSS shake for the entire duration. Compose a short impact, a readable settle/hold, and a clean release.

## Other candidate beats

Audit, rank, and implement only a small number whose mechanics are already trustworthy. Candidates include:

- Grab tech / grab break
- Counter throw
- Defensive jolt
- Matador / Matador Break
- Rope-jump landing interaction
- Posture break or stamina collapse
- Decisive ring-edge force out

Do not automatically implement every candidate in one phase. Select the two or three with the highest gameplay-information value after sidestep and Plant. Report why.

Each event needs its own purpose, mass, color, sound relationship, and duration. Do not apply the same slowmo + dim + shake recipe to everything.

## Placeholder animation policy

CSS transforms are allowed when final animation frames do not exist, including:

- Brief recoil translation
- Small rotation from a physically believable pivot
- Squash/stretch
- One or two damped shake impulses
- Opacity or brightness accents
- Afterimages based on already rendered fighter art

They must:

- Respect the current transform stack and avoid overwriting movement/facing transforms
- Use a wrapper or composed CSS variables when necessary
- Never alter authoritative coordinates
- Clean up on state change and remount
- Remain correct at both facings and sizes
- Avoid endless wobble or cheap random jitter
- Be labeled as placeholder in the phase report if asset animation is still preferred

Production-worthy transform work is welcome. Do not make “placeholder” an excuse for ugly or misleading motion.

## Reduced effects and accessibility

Respect the project’s existing setting or system preference. If none exists for combat presentation, propose the narrowest compatible mechanism rather than a global settings redesign.

Reduced-effects behavior must:

- Preserve the semantic information
- Remove or reduce rapid shake, large scale overshoot, afterimage count, strong flash, and large scene dimming
- Preserve authoritative hitstop if it is mechanical
- Never make a player appear actionable before server truth
- Avoid relying on color alone

## Required tests

Add focused tests for event production and pure presentation-state reducers/helpers where practical:

- Same event delivered twice presents once
- New event ID presents normally
- Round/match epoch prevents stale dedupe collisions
- Simultaneous priorities resolve predictably
- Result event suppresses lower-priority clutter where intended
- Cancellation/reset clears dim, shake, afterimages, and holds
- True sidestep direction and belt color are used
- Reduced-effects mapping preserves event meaning
- Clinch Plant presentation duration is derived from authoritative state/event, not a guessed independent gameplay timer

Do not write brittle screenshot tests for every CSS frame. Test state contracts and manually inspect motion.

## Manual playtest criteria

At normal speed, ask:

- Could a new spectator explain who made the good read?
- Does the beat help before its text is read?
- Is the next actionable moment visually honest?
- Does repeated use become exhausting?
- Does an ordinary sidestep remain ordinary?
- Does online remote presentation match local presentation?
- Do simultaneous events degrade gracefully?

Test rapid repetition, interruption, room reset, and long sessions for stuck overlays or accumulated DOM nodes.

## Phase 6 acceptance criteria

- Confirmed sidestep evasion feels special and remains mechanically honest.
- Plant/brace resolution finally reads at the pace the server already enforces.
- No interaction receives duplicate freeze or duplicate presentation.
- Placeholder transforms compose safely with fighter movement/facing.
- Reduced-effects behavior exists.
- Presentation reliably clears.
- The game pace is not broadly slowed.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 6 GATE

---

# PHASE 7 — ACTIONABILITY AND CANCEL-CONTRACT HARDENING

## Purpose

Reduce the gameplay bugs caused by distributed booleans and contradictory gates without performing a dangerous wholesale finite-state-machine rewrite.

This phase is architecture in service of feel: players should know when an action can begin, cancel, be interrupted, or recover, and every input path should ask the same authoritative question.

## Start with an actionability matrix

From real code and tests, document for every player command:

- Required neutral/capability conditions
- Explicit blocking states
- Allowed cancel sources
- Cancel window start/end
- Resource requirements
- Server input handler
- Simulation action owner
- Lifecycle/timer owner
- Cleanup path
- CPU entry path
- Client prediction path if any
- Presentation-only versus mechanical consequences

Cover at minimum:

- Move left/right
- Crouch/stand
- Jump
- Slap/palm
- Charged-headbutt charge/start/release
- Grab
- Dodge/dash
- Sidestep
- Rope jump
- Slide jump/FLAP/dive
- Space defensive actions
- Clinch push/Plant/jolt/throw/pull/break techniques

Do not infer intent only from a helper name. Follow each call path.

## Introduce capability queries carefully

Where duplicated eligibility checks are causing proven contradictions, create or refine narrow semantic queries such as:

- canStartGroundStrike
- canStartGrab
- canStartDodge
- canStartSidestep
- canStartJump
- canAcceptMovementInput
- canBufferCommandDuringHitstop

Names are illustrative. Follow repository conventions.

A capability result should be able to expose a development-only rejection reason, for example RECOVERING, HITSTUN, CLINCH, AIRBORNE, GASSING, ROUND_LOCKED, or RESOURCE_EMPTY. Do not send verbose internal diagnostics in normal production packets.

Do not create one enormous canAct function with hidden exceptions. Do not replace every boolean with a new framework in one pass.

## Lifecycle ownership

For any action touched:

- One lifecycle instance owns its startup/active/recovery clocks.
- Cleanup verifies instance ownership before clearing state.
- A stale timeout/callback cannot clear a newer action.
- Round reset/disconnect removes all transient state.
- Hitstop uses simulation time, not wall-clock drift.
- Cancel transitions explicitly consume/replace the old lifecycle.
- Presentation observes lifecycle; it does not own it.

Prefer the already established action-lifecycle patterns in the repository.

## Impossible-state assertions

Add development/test-only invariant checks for combinations that must not persist, based on proven design. Examples may include:

- Simultaneously in incompatible grounded attacks
- Active sidestep and active ordinary dash when mutually exclusive
- Clinched without a valid partner/relationship
- Intangible after the owning action ended
- Recovery state with no valid lifecycle owner
- Attack active with missing/expired action instance
- Rope state persisting through round reset

Assertions must not crash ordinary production matches unless the project already uses a safe invariant policy. In tests/dev, make violations loud and actionable.

Do not assert away legitimate transitional same-tick states. First observe the simulation order.

## CPU and human parity

Route CPU action attempts through the same authoritative capability contract as human inputs. The CPU may decide differently, but it may not bypass legal actionability.

Do not make CPU read client-only presentation flags. Do not give it a second mechanics implementation.

## Required tests

- Every documented allowed cancel succeeds at exact boundary ticks
- Every blocked state rejects with the correct development reason
- Buffered input during hitstop starts once when legal
- Buffered input expires/clears according to current rules
- Repeated press cannot create duplicate action instances
- Stale cleanup cannot clear a newer action
- Round reset/new match clears all action ownership
- CPU and human attempts receive the same legal/illegal result for the same fighter state
- Reversed player order does not change eligibility
- Recovery-cancel decision from Phase 2 is encoded consistently
- Rope-jump, offensive-aerial, and clinch invariant suites remain green

## Scope limit

This phase may consolidate proven duplicate guards and delete dead paths after tests exist. It may not:

- Replace the entire player object
- Introduce Redux/XState/ECS or another state library
- Rename every state field
- Retune all cancel windows
- Redesign input bindings
- Rewrite networking
- Convert server modules wholesale between CommonJS and ESM

## Phase 7 acceptance criteria

- Commands use a coherent authoritative capability contract.
- Known contradictory or unreachable gates are resolved according to approved intent.
- Existing approved move identities and timings remain stable.
- CPU cannot bypass human legality.
- Lifecycle cleanup is instance-safe.
- Tests expose the reason a command was accepted or rejected.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 7 GATE

---

# PHASE 8 — DETERMINISM, LATENCY, AND RECONCILIATION EVIDENCE

## Purpose

Prove that the upgraded combat remains trustworthy online. Do not assume that server authority alone makes the game feel good under latency.

This phase is measurement and focused repair, not permission to replace the netcode.

## Build a deterministic combat trace harness

Extend existing input reliability and combat trace tooling where possible.

For a deterministic scenario, capture:

- Seed and fixture identity
- Server simulation tick/simTime
- Client input sequence ID and local timestamp if currently used
- Server receive/accept/reject tick and reason
- Command buffered/consumed tick
- Action lifecycle start and phase boundaries
- Action facing and travel direction
- Candidate/authoritative contact tick and contact point
- Damage/force/reaction result
- Hitstop start/end
- Combat presentation event ID
- State packet sequence/keyframe identity
- Client prediction start, reconciliation correction, and final convergence
- Round/reset epoch

Trace output must be bounded, development-only, scrub sensitive identifiers if any, and be easy to compare between two runs.

## Network-condition matrix

Use existing test hooks or a narrow development-only transport shim. Do not add a dependency merely to simulate latency.

Test representative conditions, including:

- Near-zero latency
- Stable moderate latency
- High but playable latency
- Symmetric and asymmetric delay
- Jitter
- Limited packet reordering if transport/test harness permits
- Dropped non-critical state deltas with later keyframe recovery
- Duplicate/retransmitted semantic presentation events
- Brief stall followed by catch-up

Use clearly documented values. Avoid claiming exact real-world behavior from an unrealistic fake network.

Run scenarios from both client roles:

- Movement and stop/reversal
- Slap hit and whiff punish
- Simultaneous strikes
- Charged headbutt
- Grab/clinch entry
- Plant resistance/open
- Sidestep clean pass, blocked pass, and confirmed evade
- Rope jump landing interaction
- Hitstop plus buffered input
- Round end/reset during an in-flight event

## What to measure

Record at minimum:

- Input-to-local-feedback time
- Input-to-server-accept time
- Server action start tick
- Contact/result tick
- Remote visual delay
- Reconciliation correction magnitude and duration
- Wrong-side or facing correction count
- Duplicate/missing presentation event count
- Final state divergence
- Illegal overlap duration
- Input lost/duplicated/reordered outcome

Do not hide bad results behind averages. Report worst representative cases and outliers.

## Safe repair boundaries

Allowed repairs include:

- Missing authoritative payload fields
- Incorrect delta/keyframe tracking
- Stale epoch/dedupe behavior
- A prediction branch using facing where travel direction is required
- Prediction cleanup that survives reset
- Smoothing that visually overshoots the authoritative legal position
- Input trace/sequence bookkeeping bugs
- Remote presentation timing that is needlessly delayed after the event is known

Do not predict damage, hits, throws, ring outs, clinch success, Plant success, or confirmed sidestep evades exclusively on the client.

Do not add rollback netcode, GGPO, a physics library, WebRTC, a new transport, or a new serialization framework in this phase.

## Rollback decision gate

Rollback is not a magic “premium” library and would be a major architectural program for the current React/Node simulation.

Only recommend a separate rollback/protocol project if measured evidence shows that focused prediction/reconciliation cannot meet the game’s target under realistic latency. A recommendation must include:

- Measured current failure
- Target latency/jitter envelope
- Determinism prerequisites not yet met
- Server/client ownership changes required
- Estimated migration risk
- Incremental prototype boundary
- How PvE, PvP, Electron, and current servers would be affected

Do not implement that recommendation without a separate user-approved charter.

## Determinism checks

For server fixtures with the same seed and ordered input stream:

- Final authoritative state must match.
- Contact decisions and outcome events must match.
- Player-array reversal must not change symmetric interactions.
- Wall-clock scheduling variation must not change simTime results.
- Development overlay/presentation toggles must not change mechanics.

If deterministic replay is blocked by global randomness or wall-clock use, isolate and inject the smallest necessary clock/RNG seam. Do not rewrite the whole simulation.

## Phase 8 evidence

Create:

- Scenario definitions
- Trace comparison output
- Before/after metrics for any focused repair
- A table of known acceptable corrections versus gameplay defects
- Remaining network risks
- A direct recommendation: current architecture sufficient, focused follow-up needed, or separate rollback investigation justified

## Phase 8 acceptance criteria

- Critical scenarios converge to server truth across the tested matrix.
- No input/action is duplicated by retransmission or remount.
- Sidestep side/direction and limb-hit results remain stable on both clients.
- Presentation events are deduped and epoch-safe.
- Large corrections are measured and either fixed or honestly documented.
- No unsupported netcode rewrite is started.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 8 GATE

---

# PHASE 9 — CPU AND TRAINING-OPPONENT LEGITIMACY

## Purpose

Turn intentional test-dummy behavior into an explicit tool while making the consumer-facing CPU difficulties play the real game through the same combat contract as humans.

The user has confirmed that the current EASY dummy behavior was intentionally simplified for testing. Do not mislabel that code as incompetence or delete the useful test behavior.

## Separate two products

Preserve an explicit deterministic lab/training dummy mode for engineering and move testing. It may:

- Stand still
- Repeat a chosen action
- Hold a chosen defense
- Reset position/state deterministically
- Record contact traces
- Display combat volumes in development

It must be clearly named and gated so ordinary players do not accidentally receive it as the actual Easy CPU.

Consumer CPU difficulties should all participate in the complete legal game, with different decision quality rather than different rules.

Do not create a full training-mode UI in this phase. Create only the logic/config separation needed for reliable tests and real CPU play.

## CPU fairness contract

The CPU may read authoritative information that a human could reasonably observe or infer:

- Positions, spacing, ring edge
- Visible action/phase cues
- Resources and status
- Current velocity/facing
- Known move commitments

It may not:

- Bypass actionability/resource/cancel rules
- Read future random outcomes or future queued human inputs
- React at zero delay to the first simulation tick of hidden startup
- Know client-only button state before server acceptance
- Ignore hitstop, stun, Open, recovery, or sidestep occupancy
- Receive altered attack ranges, invulnerability, or movement physics simply because it is CPU

Decision logic may use internal exact values where the existing architecture requires it, but behavior must include human-like observation/reaction constraints appropriate to difficulty.

## Difficulty identity

Preserve current game identity and tune conservatively. A reasonable structure is:

- Easy: plays the full rules, reacts slowly, misses opportunities, uses a limited plan, and occasionally makes punishable commitments
- Normal: understands spacing, basic defense, ring position, simple whiff punishment, and legal sidestep usage
- Hard: stronger anticipation, adaptation, ring control, Plant/clinch choices, and whiff punishment, but still bounded by reaction and commitment

Do not turn Hard into an input-reading oracle. Do not make Easy permanently idle outside the explicit lab dummy.

## Use the new contracts

- All CPU actions pass through Phase 7 capability queries.
- Spacing decisions use authoritative arena boundaries and approved contact/volume queries, not copied magic ranges.
- Sidestep decisions understand Phase 5 outcomes and do not intentionally choose impossible destinations unless making a difficulty-appropriate mistake.
- CPU can recognize a clearly extended recovery limb as a whiff-punish opportunity after the Phase 4 rollout.
- CPU respects clinch Plant/Open and cannot instantly retry while legally locked.
- Existing rope-jump and aerial invariants remain unchanged.

Do not let CPU query the debug overlay or shadow-only candidate geometry once authority differs.

## Deterministic decision testing

Inject or reuse a seedable RNG/clock seam for CPU decision tests if current global randomness blocks repeatability. Keep the production random source behavior compatible.

Test scenario-level properties rather than expecting one exact action forever when tuning should remain flexible:

- No illegal command is issued
- Reaction delay stays within the difficulty contract
- Easy eventually takes legal actions
- Normal can recognize a major whiff but does not always respond perfectly
- Hard punishes representative whiffs at a bounded, non-perfect rate
- CPU avoids obviously impossible edge sidesteps most of the time at higher difficulty
- CPU can fail/choose imperfectly according to its profile
- Same seed produces the same decisions
- Different seed remains legal
- Both player slots and mirrored sides behave equivalently
- Lab dummy remains exactly deterministic
- Round/reset does not retain an old plan or opponent action instance

## Long-run soak

Run deterministic accelerated server simulations if existing test infrastructure allows, without launching production packaging.

Look for:

- Stuck states
- Permanent intangibility
- Repeated illegal input spam
- Clinch deadlocks
- Ring-edge overlap loops
- Sidestep oscillation
- Unbounded queues/timers
- NaN positions or resources
- Action lifecycle leaks between rounds

Report scenario count and seed range honestly. Do not claim human fun from a bot soak test.

## Phase 9 acceptance criteria

- Intentional dummy behavior survives as an explicit test tool.
- Consumer Easy plays the full legal game imperfectly.
- CPU and humans share actionability and mechanics authority.
- CPU uses no stale copied ring/contact constants.
- CPU understands new recovery and sidestep facts without becoming clairvoyant.
- Seeded tests and soak runs are repeatable.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 9 GATE

---

# PHASE 10 — INTEGRATION, FLAG RETIREMENT, AND FINAL GAMEPLAY GATE

## Purpose

Integrate only the user-approved outcomes from previous phases, remove temporary duplication safely, perform the broadest permitted regression pass, and report what is truly ready versus what still needs playtesting or animation assets.

Do not use this phase to sneak in new mechanics.

## Reinspect the complete diff history

Before editing:

- List every file changed by this program.
- Separate user pre-existing changes from program changes.
- List every temporary feature/debug flag.
- List every legacy-versus-candidate dual path.
- List every new payload field and consumer.
- List every new event type and dedupe key.
- List every timing or balance change that received explicit approval.
- List any approved phase whose implementation is still disabled.

Do not delete user work or unrelated dirty-worktree changes.

## Feature flag decisions

For each temporary flag, recommend one of:

- Enable as current authoritative behavior
- Keep development-only for further evaluation
- Remove and keep legacy behavior
- Defer because evidence is incomplete

Only remove a legacy path after:

- The replacement was approved
- Focused and integration tests cover it
- Manual playtest found no blocker
- Payload backward/forward assumptions are understood
- No current debug/audit fixture still depends on it unintentionally

Avoid leaving permanent shadow calculations on every production combat tick unless their runtime value is explicitly justified.

## Required full regression matrix

Run the complete existing server test suite only in this final integration phase, plus all focused new suites. If the repository already has a safe documented command, use it. Do not invent a production build as a test.

Also run:

- Focused ESLint on changed client files
- Focused client tests relevant to changed systems
- git diff --check
- Existing combat invariant/audit scripts that are read-only and relevant
- Deterministic scenario harness
- CPU soak within a documented finite budget
- Source/import inspection for development-only gates

Do not run production Vite builds, Electron packaging, Steam packaging, asset generation, or dependency installation.

## Required manual playtest matrix

Use the real allowed development mode. Test both local ownership directions where possible.

### Neutral and strikes

- Walk, stop, reverse, crouch, jump
- Slap hit, block/defense as applicable, and whiff
- Punish extended slap recovery limb
- Palm and low kick legacy/rolled-out behavior
- Charged headbutt hit, trade, whiff, and interruption
- Simultaneous attacks with player slots reversed
- Small, normal, and large bodies

### Sidestep

- Unthreatened ordinary sidestep
- Confirmed evade in both directions
- Cross-up/facing reversal
- Moving opponent occupies destination
- Same-center/shallow-overlap start
- Both ring edges
- Small around large and large around small
- Interrupted startup, active, and recovery
- Rapid repeated attempts
- Reduced-effects presentation

### Clinch and throws

- Clinch entry from both sides
- Plant resistance
- Perfect Brace/Open
- Immediate retry attempts during and after real recovery
- Throw, pull, jolt, break/tech, and escape paths
- Ring edge and size differences
- Presentation interruption/reset

### Aerial and ropes

- Approved rope-jump high-vault identity
- Grounded-opponent landing resolution
- Offensive-aerial outcomes
- Boundary/landing cases
- Verify no regressions from generic geometry/actionability work

### Match flow and cleanup

- Round start lock
- Hitstop plus buffered input
- Ring out/result transition
- New round
- Rematch/new room
- Disconnect/reconnect or available equivalent
- BASHO CPU match
- Long session for stuck effects/state

### Online/network conditions

- Two clients if the local development setup supports it
- Both clients as local actor for each changed mechanic
- Representative stable/moderate/high-delay cases from Phase 8
- Delta loss/keyframe recovery if harnessed
- No duplicate presentation after resend/reconnect
- Final authoritative convergence

Test at the primary desktop gameplay resolution and 1280 x 800/Steam Deck where client presentation was touched. Mechanics must not depend on viewport size.

## Performance sanity

Measure rather than guess:

- Server simulation time before/after in a representative match/soak
- Candidate/authoritative volume query cost
- Allocations or obvious garbage pressure from per-tick geometry
- Client DOM/particle count during repeated premium beats
- Stuck timers/listeners after remount or room reset
- Network payload impact of new tracked fields/events

Do not launch a broad optimization rewrite. Fix only clear regressions created by this program.

## Final documentation

Update the program audit/roadmap so a future developer can find:

- Combat-volume vocabulary and authority
- Move phase and exposed-limb rules
- Edge-touch/tie-break policy
- Sidestep outcome and settle contract
- Confirmed-evade definition
- Presentation priority/budget contract
- Actionability/cancel matrix
- Network/determinism findings
- CPU/dummy separation
- Feature flags and final defaults
- Known legacy exceptions
- Manual tuning values and their owner

Do not claim temporary CSS motion is final character animation. Label remaining asset needs precisely.

## Final acceptance criteria

- Approved limb vulnerability is authoritative, once-only, deterministic, and visually honest.
- Sidestep cannot end in a confusing illegal overlap across the verified matrix.
- Confirmed sidestep evades and Plant/brace interactions receive readable, bounded beats.
- Actionability rules are coherent and tested without a wholesale state rewrite.
- Local and remote results converge under the measured conditions.
- Consumer CPU plays legally; lab dummy remains useful.
- Approved rope-jump, aerial, charged-contact, clinch, hitstop, and input-reliability contracts remain green.
- Debug/shadow systems cannot leak into production unintentionally.
- No prohibited pipeline, dependency install, staging, or commit occurred.

Stop at:

PUMO PREMIUM COMBAT FOUNDATION — FINAL GAMEPLAY GATE

---

# CROSS-PHASE SCOPE PROTECTION

This program does not authorize:

- A UI/HUD redesign
- How to Play content
- New character art or animation asset generation
- A general VFX art-direction rewrite
- Character balance overhaul
- Control remapping
- New characters or moves
- Ranked matchmaking changes
- Save-data migration
- Monetization/Steam store work
- Production builds or packaging
- A general engine rewrite
- A rollback implementation
- A physics engine
- An ECS/state-machine/networking library migration

If a serious issue in one of those areas blocks a phase, stop and report the blocker. Do not expand scope silently.

---

# GROK 4.5 EXECUTION DISCIPLINE

Follow these rules to minimize bug risk and context drift in Cursor.

## Before every edit

1. Re-read the current phase and its scope limit.
2. Inspect git status and preserve unrelated user changes.
3. Locate the real owner and every consumer with rg.
4. Read the relevant existing tests and invariant documents.
5. State the discovered path and proposed smallest change.
6. Identify whether the change affects authority, balance, payloads, presentation, or only diagnostics.
7. If intent is ambiguous and the choice changes gameplay, stop and ask.

Do not announce a theory as a confirmed defect until a trace, test, or direct code path proves it.

## While editing

- Make small coherent patches.
- Prefer modifying an existing owner over creating a parallel one.
- Add the failing regression test before or with the fix.
- Re-read the edited section after each patch.
- Search for every renamed field and every payload consumer.
- Keep server mechanics independent from React/CSS/DOM.
- Keep presentation independent from authority.
- Never use wall-clock timers for server gameplay.
- Never swallow errors to make a test pass.
- Never loosen a broad guard to fix one exception.
- Never add a fallback that silently guesses gameplay geometry.
- Never leave console spam in normal matches.
- Do not make unrelated formatting changes.

If a patch touches more ownership domains than expected, pause and re-scope before continuing.

## After every edit cluster

1. Run the narrowest relevant tests.
2. Inspect the diff, including accidental whitespace/formatting.
3. Run rg for stale constants, old field names, duplicate event strings, and missing cleanup.
4. Confirm both player slots and both directions are covered.
5. Confirm reset/round transition cleanup.
6. Confirm player-array order does not change symmetric outcomes.
7. Confirm no prohibited command ran.

Do not fix unrelated failures. Report them separately with evidence.

## When blocked

Stop rather than improvise if:

- A required asset/file is missing
- Current code contradicts the prompt’s repository snapshot
- Tests reveal ambiguous design intent
- A gameplay change needs user balance approval
- Existing dirty changes overlap unsafely
- The allowed dev environment cannot reproduce the interaction
- A required command would violate the prohibited list

Give the exact blocker, evidence, safest options, and recommended next action.

## Do not flatter the task

Be candid. If a proposed upgrade is not felt in play, say so. If the existing code is already stronger than assumed, preserve it. If a flashy beat hides bad mechanics, reject it. If a phase produces no safe improvement, stop with evidence instead of manufacturing changes.

---

# COMMAND AND PIPELINE RESTRICTIONS

Unless the user explicitly replaces these restrictions in a later message, do not run:

- npm install
- npm ci
- Package fetching through npx
- npm run build
- npx vite build
- Any production Vite build
- Electron packaging
- Steam packaging
- Installer generation
- Sprite baking or recoloring
- Topper/manifest generation
- Dohyo/arena asset pipelines
- Audio generation
- Broad automated formatting
- git add
- git commit
- git push

Do not edit package-lock.json or add dependencies.

Use existing development/test commands only after reading package scripts. Avoid launching multiple long-lived servers. Stop every temporary dev server, Electron, Chromium, or capture process before finishing a phase.

---

# REQUIRED REPORT AT EVERY PHASE GATE

Every phase report must include:

1. Phase completed
2. Original rendering/simulation/input/state path inspected
3. Confirmed defects versus disproven suspicions
4. Design decisions and why
5. Exact files created
6. Exact files modified
7. Gameplay-authority changes
8. Payload/network changes
9. Presentation-only changes
10. Timings changed, with before/after values and approval basis
11. Feature/debug flags and defaults
12. Tests added
13. Tests run and exact results
14. Manual scenarios inspected and findings
15. Performance/payload observations where relevant
16. Known weaknesses and untested cases
17. Unrelated pre-existing failures or dirty changes
18. Confirmation that approved invariants remained intact
19. Confirmation that prohibited pipelines did not run
20. Confirmation that nothing was staged or committed
21. The exact gate name

Do not say “all tests pass” without naming the commands and counts/results. Do not claim a resolution was visually verified if the real sequence was not actually observed.

---

# FINAL PROGRAM REPORT

After Phase 10, report:

1. Executive assessment of gameplay quality before and after
2. The highest-impact player-felt improvements
3. Final combat geometry model
4. Final whiff-punishable limb rules
5. Move-by-move authority status and legacy exceptions
6. Sidestep route, outcome, settle, and evade contracts
7. Interaction-beat priority and timing strategy
8. Plant/Perfect Brace findings and final behavior
9. Actionability/cancel contract
10. Network/determinism findings and measured limits
11. CPU and test-dummy design
12. Exact balance/timing changes approved
13. Exact files created
14. Exact files modified
15. Tests and manual playtests performed
16. Performance and payload findings
17. Remaining animation/art needs
18. Remaining gameplay risks
19. Deferred recommendations, including rollback only if evidence justifies it
20. Feature/debug flags and final defaults
21. Confirmation of preserved approved systems
22. Confirmation that prohibited pipelines did not run
23. Confirmation that temporary processes stopped
24. Confirmation that nothing was staged or committed

Do not describe PUMO as “now AAA” merely because code was added. State exactly what is proven, what was felt during play, and what still requires human tuning.

---

# FIRST RESPONSE TO THIS PROMPT

Begin with a concise statement that you will perform PHASE 0 ONLY.

Then inspect the current repository, create/update only the two Phase 0 audit/roadmap documents named in Phase 0, perform the required source-of-truth analysis, deliver the Phase 0 report, and stop at:

PUMO PREMIUM COMBAT FOUNDATION — PHASE 0 GATE

Do not ask whether you should begin Phase 1 in the same response. Do not implement anything beyond Phase 0 until the user explicitly authorizes it.
