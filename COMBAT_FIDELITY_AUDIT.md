# COMBAT FIDELITY AUDIT — PUMO PUMO !

**Phase 1: investigation only (2026-07-30).**  
No combat overhaul, rebalance, or architecture replacement was performed.

Companion docs:
- [`COMBAT_INTERACTION_ARCHITECTURE.md`](./COMBAT_INTERACTION_ARCHITECTURE.md)
- [`COMBAT_INVARIANTS.md`](./COMBAT_INVARIANTS.md)
- [`POSE_GEOMETRY_AUDIT.md`](./POSE_GEOMETRY_AUDIT.md)
- [`COMBAT_FIDELITY_ROADMAP.md`](./COMBAT_FIDELITY_ROADMAP.md)
- [`AERIAL_LANDING_PHASE_A.md`](./AERIAL_LANDING_PHASE_A.md) — rope-jump landing V2 (flagged, default OFF)
- [`AERIAL_LANDING_PHASE_A1.md`](./AERIAL_LANDING_PHASE_A1.md) — V2 trajectory hardening (Hermite/brake/residual; still default OFF; not visually approved)
- [`AERIAL_LANDING_PHASE_A2.md`](./AERIAL_LANDING_PHASE_A2.md) — V2 decision stability (side intent / commit continuity; still default OFF)
- [`AERIAL_LANDING_PHASE_A3.md`](./AERIAL_LANDING_PHASE_A3.md) — V2 dynamic landing-conflict (provisional raw-clear; still default OFF)
- Pose scan: `tools/audit-pose-geometry.js`, `tools/pose-geometry-report.json`, `tools/pose-geometry-viz/`
- Dev overlay: `client/src/debug/CombatFidelityDebug.js` (`localStorage pumo_combat_fidelity_debug=1`)

---

## Executive summary

PUMO PUMO’s combat stack is **not** a single unified interaction model. It is a **server-authoritative 64Hz ice-fighter** with three coexisting positional languages (pushbox, strike tip-rail, clinch attach) plus many intentional pass-through exemptions.

The recent slap / charged / palm work introduced a real professional core: **`strikeContact.js` art-tip → connect distance → live extension separation → on-hit park → `contactX` seam**. That pipeline is why those strikes now feel like bodies meeting. Much of the rest of the game still uses older midpoint effects, fixed distances, or “disable collision then correct later” patterns.

**Coherence verdict:** Grounded tip-rail strikes are structurally strong. Aerial landing, pose grounding metadata, defense composition, and client freeze pinning are the main gaps that still produce “sticker” moments. The system is uneven — professionally tuned islands inside a larger special-case sea — not uniformly amateur and not uniformly AAA.

---

## Current strengths (preserve)

1. **Tip-rail strike contact** (`server-io/strikeContact.js`) for slap / charged / palm — art-derived tip, victim body half, skin embed, inclusive epsilon, park correction, seam sparks.
2. **Live extension separation** during slap/palm active — prevents limb bury without relying on particles.
3. **Symmetric sim-clock hitstop** — competitive +0 slap math and readable freeze.
4. **Server-emitted `contactX` / `attackerX` on `player_hit`** — client prefers authoritative seam over legacy `x+70`.
5. **Ice movement + slap ground transfer** — sumo positional identity.
6. **Snowball swept collision** (`projectileUpdates.js`) — correct continuous pattern for fast objects.
7. **Charged lunge pushbox yield vs palm non-yield** — carefully documented special case that protects both connects and pocket poses.
8. **Clinch as its own system** with regression harness (`server-io/test/clinch/`).
9. **Client hitstop pin** (`pinFighterX`) — admits and mitigates interp/prediction bury at confirm.
10. **Sole-pivoted CSS squash** (`FIGHTER_SOLE_TRANSFORM_ORIGIN`) — correct deformation principle when sole metadata matches art.

---

## Confirmed high-impact problems

| # | Problem | Evidence | Class | Confidence |
|---|---------|----------|-------|------------|
| 1 | **Rope-jump lands on predetermined X with pushbox off in air; landing re-enables pushbox and separates at ≤18px/tick** | `socketHandlers.js` fixed `ropeJumpTargetX`; `index.js` active arc pass-through; `gameFunctions.js` landing cap | Physical + visual contradiction | **High** |
| 2 | **No swept collision for melee / landings** — only snowballs | Workspace grep; discrete distance in `checkCollision` | Tunneling / late contact risk | **High** (risk); playtest for frequency |
| 3 | **Charged pose `attack.png` sole padB≈223px** — feet float while tip rail is correct | Pose audit; `getImageSrc` uses `attack` for charged | Visual grounding contradiction | **High** |
| 4 | **Multiple body/reach definitions + dead legacy constants** | `HITBOX_DISTANCE_VALUE`, tip rail, `LOW_KICK_*`, unused `SLAP/CHARGED/PALM_HITBOX_*`, clinch 72 literals | Maintainability → future bugs | **High** |
| 5 | **Pass-through exemption lists duplicated** (pushbox vs tip-sep vs various tick gates) | `arePlayersColliding` / `adjustPlayerPositions` / `enforceStrikeExtensionSeparation` | Drift risk | **Medium-High** |
| 6 | **Several interactions still place FX at midpoint** | Flap/AP kill / clinch jolt `contactX: (a+b)/2` | Visual inconsistency | **High** |
| 7 | **Low kick not on tip rail** | `LOW_KICK_HITBOX_DISTANCE_VALUE`; comment “until tip art” | Inconsistent contact language | **High** |
| 8 | **`getImageSrc` ~90 positional booleans** | `getImageSrc.js` + call site | Maintainability / pose fights | **High** |
| 9 | **Slap1 tip constant 478 vs alpha tip ~458.5** | Pose audit Δ −19.5 | Uncertain — may be intentional slack | **Medium** (needs playtest) |
| 10 | **cpuAI `MAP_RIGHT_BOUNDARY=940` vs real 935** | `cpuAI.js` vs `gameUtils.js` | Gameplay AI bug (edge) | **High** |

---

## Suspected problems requiring playtest

- How often discrete strike checks ghost-whiff or deep-penetrate at high relative speed (slide-jump H, charged lunge) despite epsilon/slack.
- Whether parry “empty air” reads are geometry vs animation choice vs latency.
- Whether `pinFighterX` / hard-snap 80px / interp teleport 100px are visible online under real RTT.
- Whether rope-jump 18px/tick slide is acceptable soft correction or reads as teleport (user report suggests the latter).
- Whether charged sole float is noticed when tip contact feels good.
- Whether slap1’s longer tip constant is load-bearing for mash pocket feels.

---

## Why slap / charged / palm feel good (reference principles)

From `strikeContact.js` + `collisionSystem.processHit` + client `handlePlayerHit`:

| Principle | Mechanism | Generalize? |
|-----------|-----------|-------------|
| Art tip defines reach | `STRIKE_TIP_*_SPRITE_PX` → world | Yes for all limb strikes |
| Victim surface = pushbox half | `getVictimBodyHalf` | Yes (until hurtbox metadata) |
| Inclusive connect band | `CONTACT_SNAP_EPSILON` | Yes |
| Prevent bury during active | `enforceStrikeExtensionSeparation` | Yes for rooted/extension strikes; charged uses lunge clamp instead |
| Freeze at readable park | `applyContactCorrection` + palm outset | Yes; park ≠ connect for some moves |
| Spark past tip into body | `getContactSeamX` + `SPARK_PAST_TIP_PX` | Yes |
| Emit authoritative contact | `player_hit.contactX`, `attackerX` | Yes for all connects |
| Client pin on confirm | `pinFighterX` | Until protocol carries both plants |
| Attacker plant (charged) / recoil (slap/palm CSS) | Move-specific | Keep per-move |
| Hitstop tier by weight | slap 70 / palm burst / charged scale | Category table later |

**Technical debt in the good system:** slap AP-grace defers tip-sep; deferred open-hit slack; tipQuality samples pre-sep spacing; palm shares `attackType:"charged"` with flags — clever but easy to break.

---

## Architecture map (short)

See `COMBAT_INTERACTION_ARCHITECTURE.md` for full pipelines.

```
Input → executeAttack → 64Hz tick
  movement → pushbox → tip extension sep → checkCollision → processHit
    park + KB + hitstop + player_hit{contactX}
→ broadcast → client lerp/predict → getImageSrc → CSS deform
→ handlePlayerHit presentation
```

Parallel systems: clinch attach, rope/slide aerial arcs, snowball swept, flap body slam.

---

## Interaction inventory (core)

Legend — Contact test: **Tip** = tip rail; **Dist** = fixed distance; **AABB** = pushbox; **Body** = flap width; **Range** = grab range. Swept: Y/N.

| Interaction | Server owner | Client presentation | Contact test | Swept | Pushbox | Contact point | Attacker recoil | Defender disp | Hitstop | Risks | Conf |
|-------------|--------------|---------------------|--------------|-------|---------|---------------|-----------------|---------------|---------|-------|------|
| Slap | `executeSlapAttack` / `checkCollision` slap / `processHit` | `handlePlayerHit`, slap frames, slap spark | Tip | N | On (sep after park) | `getContactSeamX` | CSS recoil | Ground drift | Slap tier | Ghost-whiff mitigated; slap1 tip slack | H |
| Charged | `executeChargedAttack` + lunge | charged sheet, plant pin | Tip | N | **Yield during lunge** | Seam | Plant (none) | Heavy KB | Scaled | Sole float on `attack.png` | H |
| Palm | `executePalmThrust` | palm frames, burst FX | Tip | N | On + tip sep in startup | Seam; park+6 | CSS recoil | Burst KB | Burst | Shares charged type flag | H |
| Low kick | `executeLowKick` | `kick.png` | Dist 142 | N | On | Seam via slap kind fallback | Minimal | Chip/trip | Slap tier | Not tip-aligned | H |
| Slap trade | `resolveSlapTrade` | dual hit | Tip window | N | — | Seam | Both | Both | Slap | — | H |
| Charge clash | `resolveChargeClash` | clash FX | Tip | N | — | Seam | Both | Both | Clash | — | M |
| AP parry | `processHit` AP branch | `RawParryEffect`, success frames | Uses strike connect then branch | N | Anchored shares | Seam (strikes) | Attacker freeze+shove | Plant | AP tiers | Composition vs independent anims | M |
| Guard block | same | `BlockingEffect` | Strike connect | N | — | Seam | Continues | Chip push | Guard | — | H |
| Dodge i-frame | gates in `checkCollision` | dodge pose | — | N | Off while dodge | — | — | — | — | Punish window tuning history | H |
| Sidestep | tick + gates | spin/recover | Overlap thresh 80 recovery | N | Off active | — | — | — | — | Facing flip order | M |
| Grab | `combatHelpers` + grab systems | grab poses + arm overlay | Range 146 | N | Off in clinch | Midpoint often | — | Attach | Clinch | Own physics | H |
| Clinch jolt/throw | `grabActionSystem` | clinch VFX | Clinch rules | N | Off | Midpoint common | Scripted | Scripted | Various | — | H |
| FLAP / butt slam | `checkFlapBodySlam` | flap land FX | Body width overlap | N | Off in flight | Midpoint often | Continues flight | Burst KB | Burst | Discrete overlap | H |
| Rope jump | `index.js` arc | dodge/recover poses | None (escape) | N | Off **active** only | — | Fixed target | Landing sep ≤18/tick | — | **Land inside** | H |
| Slide jump | `index.js` ballistic | flap/dodge | Body slam if dive | N | Off flight | Midpoint | — | — | — | Cross-up + land sep | M |
| Snowball | `projectileUpdates` | projectile img | Horiz+vert thresh | **Y** | — | Impact | Reflect on PP | Hit/parry | — | Good pattern | H |
| Ring KB clamp | `index.js` | ropes pose | Boundary buffers | N | With push | — | — | Clamp vs kill band | — | — | H |
| Armor absorb | `processHit` / snowball | absorb FX | Hit registered | N | — | Varies | — | Reduced | — | Grab-oriented | M |

Full aerial/parry/side-switch traces: see architecture doc.

---

## Physical geometry — competing definitions

| Name | Value / formula | Used by |
|------|-----------------|---------|
| Pushbox half | `HITBOX_DISTANCE_VALUE=65 * sizeMultiplier` | Pushbox, victim tip body half |
| Legacy slap/charged/palm hitbox | 138 / 135 / 164 | **Unused** (dead) |
| Tip sprite px | 478/478/425/438 | `strikeContact` |
| Tip world | tipPx * `(1280*0.123)/960` | Connect distance |
| Skin embed / palm overhang | 1 / 10 world px | Connect |
| Low kick distance | 142 | Low kick only |
| Grab range | 146 | Grab |
| Clinch attach | ~72 (`75*0.96`) | Clinch; **triplicated** literals in `index.js` |
| Flap slam width | `65*2*FLAP_BODYSLAM_WIDTH_SCALE*size` | Body slam |
| Air hurt height | 72 above ground | Grounded strike gate |
| Sidestep recovery overlap | 80 | Punish window |
| Display width | 12.30% CSS | Client only |
| Sole pivot | 2.1% from bottom | Client CSS global |

**Conflated concepts today:** pushbox half ≈ hurt half for tip math; no distinct hurtbox; hitbox is a 1D distance; contact point is derived tip+past; root is fighter `x`; sole is global CSS guess; landing footprint does not exist; visual silhouette is not in sim.

---

## Pushbox & rope-jump mechanism (confirmed)

### Pass-through when
Dodge, sidestep, rope-jump **`active`**, slide-jump **`flight`**, throw states, grab/clinch locks; charged **lunge** (not palm) yields pushbox entirely.

### Correction model
Post-penetration split by who moves toward whom; anchored hit/parry victims take 0% share. **Not predictive.**

### Rope-jump symptom — exact path

1. Start: `socketHandlers.js` sets `ropeJumpTargetX = x + (mid - x) * ROPE_JUMP_CENTER_FRACTION` (ignores opponent).
2. Active: `index.js` eases X/Y along parabola; `arePlayersColliding` returns false → bodies may occupy same X column.
3. Land frame: `x = ropeJumpTargetX`, `y = GROUND_LEVEL`, phase → `landing` (pushbox **on** again).
4. `adjustPlayerPositions`: if centers within half-body, side tie-break uses `ropeJumpDirection`; overlap correction **capped at 18px/tick**.

**Why it looks amateur:** Player sees a grounded pose overlapping the opponent, then a multi-tick slide/snap to legal spacing. Comment at `index.js:2359` explicitly chose gradual correction over one-frame snap — both read as correction if overlap is large (~100px ⇒ ~6 ticks ≈ 94ms).

**Phase A / A.1 / A.2 / A.3 (implemented, default OFF):** `landingResolution.js` uses provisional raw-clear, locks `near`/`cross` only on pre-commit conflict (A.3), commits a same-side endpoint at a continuous recommended commit time, and travels with Hermite/brake. A.2 static continuity remains; A.2’s irreversible `preserve_raw` lock is corrected in A.3. Enable with `ROPE_JUMP_LANDING_V2=1`. Legacy 18px/tick path retained as flag-off + late-intrusion safety. Slide-jump/FLAP not integrated yet.

---

## Continuous / swept collision

| System | Swept? |
|--------|--------|
| Snowballs | Yes (`sweptHorizDistance`) |
| All melee strikes | No — discrete + epsilon/slack |
| Grab | No |
| Pushbox | No |
| Rope/slide landing | No path probe |
| Knockback | Integrated per tick; boundary clamps |

Fast relative motions that most need continuous or sub-step checks: charged lunge, slide-jump H, reflected snowballs (done), rope-jump landing into moving body.

---

## Parry / defense audit notes

- AP vs slap/palm/charged uses strike connect then branches inside `processHit`; `contactX` via tip seam for those.
- Guard chip also uses seam — good.
- Flap raw parry / some kill paths use **midpoint** — weaker composition.
- Low kick intentionally bypasses parry gate (gameplay).
- Client success poses are frame-indexed independently of attack height — **no per-attack parry hand metadata** → awkward “parry air / wrong height” can be presentation even when timing was correct.
- Classification: many awkward parries need **animation + contact metadata**, not window retunes.

---

## Client/server visual agreement

Risks confirmed in code:
- Hit resolved on server positions; client may lerp/predict until `pinFighterX`.
- Effects prefer `contactX` when present; legacy fallback `x+70` remains.
- Hitstop freezes clock but position interp needs explicit pin.
- Predictor hard-snap 80px; interp teleport 100px.
- `BLOCKING_FLAGS` must stay complete or local ice sim fights server.

**Future CombatEvent fields (recommended, not implemented):** server tick, interaction id, move id, contact result, attacker/defender ids, contact world pos, normal, force category, attacker/defender correction, reaction category, hitstop category, side/facing.

---

## Animation state selection

- `getImageSrc(...~90 args)` first-match chain; dead positional placeholders; callers pass `undefined`/`false` fillers.
- Parallel priority in `fighterStyledComponents` animation ternary.
- Slap/palm use client frame indices while server holds boolean — works if timelines stay synced; fragile.
- **Recommendation (later):** structured `AnimState` object; preserve current priority table explicitly.

---

## Hit reaction / feedback vocabulary (inventory sketch)

| Reaction | Anim | Notes |
|----------|------|-------|
| Light slap hit | `hit` + squash amp | Tip/momentum/cadence modifiers |
| Charged hit | `hit` + trail | Plant attacker |
| Palm hit | slap burst variant | Burst hitstop |
| Counter / punish / gored | banners + SFX | Punish largely label-only per overhaul spec |
| AP regular / perfect | success frames + RawParryEffect | Camera micro-freeze on perfect |
| Guard chip | block-parry pose | |
| Armor absorb | absorb preset | |
| Flap slam | burst | Midpoint FX |
| Rope land | recovering | Shake `rope_landing` |
| Hard flap land | recovering + shards | |
| Clinch jolt / throw / kill | dedicated | Own system |
| Clash / trade | dual | |

Feedback sometimes compensates spacing (`pinFighterX`, judder, spark past tip) — tip past is good; pin is a symptom of missing dual plant in protocol.

---

## Impact effects & camera

| Source | Used when |
|--------|-----------|
| `getContactSeamX` | Slap/charged/palm hits, many AP/guard |
| Midpoint `(a+b)/2` | Flap kills, some clinch, some AP flap |
| Legacy `x+70` | Client fallback if no `contactX` |
| Attacker-forward palm cone | Palm particle preset |

Camera: trauma bus profiles in `cameraShake.js`; charged scales with charge %; perfect parry freeze 75ms. Intensity is profile-tabled but move wiring is still bespoke in `handlePlayerHit`.

---

## Architectural scar tissue (selected)

| Item | Why introduced | Keep? |
|------|----------------|-------|
| Palm `attackType:"charged"` + `isPalmThrust` | Share charged pipeline | Keep but dangerous — document |
| Charged pushbox yield | Lunge must close | Keep; must not apply to palm |
| Tip-sep AP grace skip | Prevent ghost whiff | Keep |
| Rope land 18px cap | Avoid teleport | Replace with probe; cap as safety |
| Dead `*_HITBOX_DISTANCE_VALUE` | Migration leftovers | Quarantine/remove in Phase 8 |
| `getImageSrc` dead args | Signature stability | Formal AnimState later |
| cpuAI boundary 940 | Stale copy | Fix in Phase 2 hygiene |
| Sidestep recovery threshold 80 | Restore punish | Keep documented |

---

## Ranked risks (implementation order)

1. Aerial landing solver (rope jump symptom) — player-facing “sticker”  
2. Pose sole metadata for charged (and undersized reaction arts)  
3. Unify exemption registry + geometry naming  
4. Standardize contact events (kill midpoint FX)  
5. Low kick → tip rail when art ready  
6. AnimState refactor (maintainability)  
7. Melee swept/substep only where telemetry shows tunneling  

---

## Recommended phase order

See `COMBAT_FIDELITY_ROADMAP.md`. Short version:

0 diagnostics → 1 pose metadata → 2 ground pushbox hygiene → **3 aerial landing** → 4 strike standardization → 5 defense composition → 6 reaction vocabulary → 7 net contact sync → 8 regression/polish.

---

## Expected player-visible impact (after full roadmap)

Penguins occupy one physical world: strikes meet limbs, landings don’t bury, parries meet attacks, online freeze matches offline contact. Not “more screen shake.”

## Must not regress

Slap tip feel, charged plant/lunge connect, palm rooted poke + park outset, ice movement, attack timings, hitstop ladder, clinch rules, AP timing, server authority, intentional aerial pass-through during escapes.

---

## Diagnostic tooling created

| Tool | Path | Enable |
|------|------|--------|
| Pose geometry audit | `tools/audit-pose-geometry.js` | CLI |
| JSON report | `tools/pose-geometry-report.json` | generated |
| Viz sheets | `tools/pose-geometry-viz/*-audit.png` | `--viz` |
| Combat fidelity overlay | `client/src/debug/CombatFidelityDebug.js` | `localStorage.setItem("pumo_combat_fidelity_debug","1")` or `window.__PUMO_COMBAT_FIDELITY.enable()` |
| Landing one-jump client dump | same module | `localStorage.setItem("pumo_landing_trace","1")` |
| Landing server trace | `landingResolution.js` | `LANDING_TRACE=1` |

Overlay is wired into `GameFighter.jsx` only behind the flag (contact ingest + P1-owned draw). Per-fighter size multipliers and server landing diagnostic fields are shown when present. No balance changes when V2 flag is off.

---

## Areas needing your footage / subjective feedback

1. Rope-jump land on/through opponent — confirm severity vs 18px slide.  
2. Charged attack — do floating feet bother you when tip feels good?  
3. Slap1 max range — ever feel long/short vs art?  
4. Parry vs palm vs charged — which look emptiest?  
5. Online-only contact weirdness vs offline.

---

*End of Phase 1 audit. STOP — await authorization before Phase 2+ implementation.*
