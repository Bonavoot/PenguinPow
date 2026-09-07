# PUMO PUMO — Interaction-by-Interaction Presentation Pass (Fable 5.1 mega prompt)

You are taking over the gameplay-presentation work on **PUMO PUMO**, a 2D penguin-sumo fighting game (Electron + React client, authoritative socket.io server at 64 Hz / 32 Hz broadcast). Read this whole file before touching anything, then follow it exactly.

The owner's target is explicit: **every interaction that can happen in a bout must look and feel like it belongs in a premium fighting game — Super Smash Bros. / Street Fighter standard.** Not "a better hit animation." Every move, every outcome of every move, every transition, presented deliberately.

---

## 0. What the owner actually wants (read twice)

1. **Fixed and "on rails."** Interactions should feel authored and deterministic: specific poses at specific frames, positions that snap to where they should be, holds that last exactly as long as they should, and transitions that are cuts or short authored tweens — not physics-y, springy, procedural deformation. Think of how a Smash character's hitstun pose is *a pose*, held, then released into a landing/recovery pose at a fixed frame.
2. **This is flat 2D art.** Do **not** bend, shear, skew, or tilt the fighter sprites to fake body reactions. The previous session tried a procedural "reaction rig" (shear lean on hit, stun sway, forward drive bend) and the owner's verdict was: *"the 2D art just getting thinner while slanting is… maybe a downgrade."* It also lingered into moments where the player already had control (leaning while parrying). Those channels are now **off** (`RIG_FEATURES` in `client/src/combatPresentation/reactionRig.js`). Leave them off. If you conclude the whole module should go, remove it cleanly rather than leaving dead paths.
3. **Reactions are poses, timing, position, camera, VFX, SFX — not deformation.** Where the right pose asset doesn't exist, use the closest existing one *plus* timing/hold/VFX, and write the missing pose down as an **art request** with a precise brief (frame, silhouette, duration). Never substitute a deformation for a missing pose.
4. **Go through each move.** The deliverable is coverage: a per-interaction presentation spec, implemented, for the whole move list in §3 — including whiff, hit, blocked/guarded, parried, perfect-parried, traded, counter, punish, airborne victim, rope/edge, and kill variants where they exist.
5. **Keep what already landed.** The owner liked: the ring-out resolution (loser topples past the rope and stays down; banner keyed to the landing), the body-anchored contact callouts, the camera changes (filtered zoom, airborne framing, round-end hold), the in-frame kill throw with one landing moment, and the airborne tilt on air hits. Build on those; don't regress them.

---

## 1. Ground truth first (mandatory before code)

There are two gameplay recordings the owner made; ask for a fresh one if you need a specific interaction:

- `C:\Users\vente\Videos\2026-09-05 02-12-12.mkv` (≈124 s, 1080p60; WSL path `/mnt/c/Users/vente/Videos/2026-09-05 02-12-12.mkv`)
- `C:\Users\vente\Videos\2026-09-05 05-58-00.mkv` (≈56 s, 1080p60)

Frame-analysis pipeline that works in this environment (ffmpeg is installed, Python has no numpy):

```bash
# 3 fps overview sheets (4x4 tiles) to find moments
ffmpeg -v error -ss 0 -t 56 -i "$V" -vf "fps=3,scale=480:270,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='%{pts\:hms\:0}':fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6:x=4:y=4,tile=4x4" /tmp/ov_%02d.png
# 60 fps cropped strip of one interaction (crop=W:H:X:Y in source pixels)
ffmpeg -v error -ss 27.93 -t 0.3 -i "$V" -vf "fps=60,crop=760:520:80:400,scale=380:260,drawtext=...:text='%{pts\:hms\:27.93}',tile=6x3" /tmp/land_%02d.png
```

Rules of evidence, in order: what the recording shows → what the running game does → what the code says. When they disagree, the recording wins. Before you change any interaction, capture how it looks *now* (60 fps strip) so you can compare after.

The owner is willing to playtest for you: **do not spend time driving the game in the IDE browser** (the session's review policy blocks most in-game clicks anyway). Ship changes with clear "what to look for" notes and let the owner verify. Unit tests + a throwaway `npx vite build` are your automated gates.

---

## 2. Codebase map (what you need, where)

**Server (`server-io/`)** — authoritative sim; presentation events are emitted from here.
- `index.js` — game loop, per-tick player update (knockback integration ≈ lines 1250–1330, ice slide/coast ≈ 3630–3760, win checks ≈ 1850–1930, kill-throw arc ≈ 2030–2160, broadcast ≈ 4370+).
- `collisionSystem.js` — `processHit` (hit resolution, hitstun/hitstop, counter/punish flags, `player_hit` payload ≈ 3700–4000), trades (`resolveSlapTrade`), parries (AP / perfect), air hits (`beginAirHitFall` in `gameUtils.js`).
- `momentumTransfer.js` — knockback sends per move (floor/ceil px), hitstop per move (≈ 403–440), friction constants.
- `gameFunctions.js` — `handleWinCondition` (round end; ring-out resolution via `applyRingOutResolution`; training-lab hold), slap cycle (`endSlapCycle`), ready/tachiai, bow.
- `commandGrabSystem.js`, `grabMechanics.js` — clinch/grab: throw, kill throw, pull, kill pull, push (FORCE OUT), belly flop, jolt, brace, tech, break.
- `constants.js` — every timing/distance constant, plus `DELTA_TRACKED_PROPS` (the fighter wire: add a field here to get it to the client).
- Tests: `npm test` (node:test). Baseline: 1368 tests, **14 pre-existing failures** in Phase 13 / 4A / 4C limb-contact suites — record the failing set before you start and diff after every server change.

**Client (`client/src/`)**
- `components/GameFighter.jsx` (~10.5k lines, one instance per fighter) — socket handlers (`player_hit` ≈ 4000–4750, `game_over` ≈ 6000, `training_reset` ≈ 5890), interpolation rAF (≈ 2790–3400; hitstop freeze branch, extrapolation floor, kill-throw landing detector), sprite selection call (`getImageSrc(...)` ≈ 9100), render (≈ 10150+). The fighter sprite is `StyledImage` (static) or `AnimatedFighterContainer` (APNG/spritesheet), wrapped in `FighterRigLayer`.
- `components/getImageSrc.js` — the pose vocabulary: a long positional-arg function mapping server flags → sprite. This is where "which pose at which state" lives.
- `components/fighterStyledComponents.js` — sprite CSS: transform/animation cascade (≈ 890–1080) and all keyframes (hit squash, attacker recoil, belly bump, clinch, kill-throw spin/land squash, etc.).
- `components/fighterAssets.js` + `config/spriteConfig.js` — asset inventory (which poses exist). Compose sprites side by side with ffmpeg to *look* at them before deciding.
- `combatPresentation/` — `struckLimbHold.js` (victim holds pre-hit pose through hitstop), `slapConnectHold.js` (attacker hit frame through hitstop), `reactionRig.js` (see §0.2; `airTilt`, `landSquash`, `topple` on; the rest off), `strikeLayer.js`, tests run with `node --no-warnings --loader ./scripts/extResolve.mjs --test <file>`.
- `hooks/useCamera.js` — camera (filtered engagement zoom, airborne pan, round-end hold, kill cinematic). `lib/cameraShake.js` — trauma/punch profiles per event.
- `components/ContactCallout.jsx` (COUNTER HIT / PUNISH / MATADOR BREAK at the struck body), `SumoHypeStamp.jsx` (PERFECT / MATADOR), `SumoAnnouncementBanner.jsx` (clinch/grab rail), `RoundResult.jsx` (kimarite banner).
- `particles/ParticleEngine.js` — VFX presets (`throwLand`, `ringOutToppleLand`, `clinchKillThrowLand`, `slapSkidDust`, …). Sounds via `playSound(...)` and the combat audio orchestrator.
- Lint: `npx eslint <files>` — 4 pre-existing `no-unused-vars` errors (`GameFighter.jsx` ×2, `fighterStyledComponents.js` ×2); don't add more.

**Background documents** (read, don't re-do): `FRESH_GAMEPLAY_FEEL_AUDIT.md` (the audit + §J implementation record, including what was tried and rejected) and `PUMO_PUMO_FABLE_5_1_PREMIUM_GAMEPLAY_FEEL_MEGA_PROMPT.md` (the original audit brief and its evidence standards).

---

## 3. The interaction inventory you must cover

Verify this list against the code first (`socketHandlers.js`, `gameFunctions.js`, `commandGrabSystem.js`, `getImageSrc.js`) and add anything missing. For **each row**, cover every outcome that exists.

| Family | Moves | Outcomes to present |
|---|---|---|
| Strikes | slap (pocket mash; cadence-enhanced), **belly bump** (ice-slide + M1 convert), charged headbutt (S+forward+M1, charge levels), palm thrust, low kick (if enabled) | whiff · hit (light/heavy tiers) · trade · counter hit · punish · blocked/guarded · parried (AP) · perfect-parried · hit on airborne victim · hit on rope/edge · kill (cinematic) |
| Defense | guard/block, attack parry (AP), perfect parry, matador (back+space grab parry), DI on knockback | success · fail/whiff · stun on the attacker · stagger/jail on the defender |
| Movement | walk/strafe, dash/dodge (Shift), ice slide + brake, slide-jump (+ FLAP charges, dive, fast-fall), rope jump (kick-off), sidestep, at-the-ropes clamp | start · loop · land (clean / stuffed / into a slap) · air-hit dump · landing recovery |
| Clinch / grab | grab attempt (M2), grip, throw, **kill throw**, pull, **kill pull**, push → FORCE OUT, belly flop, frontal force-out, jolt, brace / perfect brace, tech, break, counter-grab, deep grip | startup tell · connect · resist · win/lose · separation · post-grab recovery |
| Power-ups | snowball, pumo army, happy feet, power water, size, others in `POWER_UP_TYPES` | activation · projectile hit · victim reaction |
| Round structure | ready/tachiai, HAKKIYOI, ring-out (thrust/push out, okuridashi), kill finishes, time expiry (hantei), bow, reset/walk-up, BASHO day cards | the decisive frame · the hold · the caption · the reset |

The owner specifically flagged the **belly bump on hit** as "dealt with weirdly" without being able to say exactly what — start there with a 60 fps strip of a real connect (attacker freeze → forward crawl → stop; victim send) and diagnose it properly before touching it. Note `test/momentum/slide-slap.test.js` pins the fixed follow-through crawl as intentional; change it only with a reason you can defend in the test.

---

## 4. Method (per interaction, in this order)

1. **Capture current.** 60 fps strip of the interaction from a recording (or ask the owner for one). Write down, frame by frame: pose, position, hold, VFX, SFX, camera, caption.
2. **Spec the target** in one table row per interaction (see §6 format): startup tell → contact frame → freeze (hitstop, who holds what pose) → release (victim pose + displacement profile; attacker follow-through pose) → recovery pose → return to neutral, with frame counts at 60 fps, plus VFX/SFX/camera/caption per beat. Reference how Smash/SF present the same beat, then decide what PUMO's version is. Keep it *on rails*: fixed frames, fixed poses, fixed snaps.
3. **Check assets.** Which poses exist for each beat (`fighterAssets.js`, look at them). Where a beat has no pose: pick the closest existing pose + hold/timing/VFX now, and log an art request (pose name, silhouette description, frame count, what it must read as at gameplay scale).
4. **Implement** — server presentation events / flags where timing must be authoritative; client pose selection, holds, position snapping, keyframe cuts, VFX, SFX, camera, captions. Prefer discrete, time-boxed states (`isX` + `xStartTime`) over continuous procedural math. Every timing lives in a named constant.
5. **Validate**: unit tests for any pure logic you add; server suite diff against the baseline failure set; eslint on touched files; `npx vite build`. Then hand the owner a one-paragraph "what to look for" per interaction for playtest.
6. **Record** what you did and why in `FRESH_GAMEPLAY_FEEL_AUDIT.md` §K (new section), interaction by interaction.

Work in **internally validated stages** grouped by family (strikes → defense → movement → clinch → power-ups → round structure), and don't stop after one family. If an existing system is the wrong foundation for the standard (e.g., a pose chosen by a 70-argument positional function you can no longer reason about), refactor it — the owner has said reworks are wanted, not just additions — but don't manufacture a rewrite for its own sake.

---

## 5. Non-negotiables

- No procedural deformation of fighter art (skew/shear/rotate/scale-as-lean) for reactions. Squash-and-stretch is allowed only as a *short authored keyframe accent* (e.g., a 6-frame landing squash), never a continuous state.
- Server stays authoritative; presentation must be correct for both clients regardless of ping (use server flags/timestamps, the display hitstop clock in `lib/serverClock.js`, not wall-clock guesses).
- Don't change frame data / hitstun / knockback distances / friction for "feel" unless the interaction is unreadable without it, and then say so explicitly.
- Every callout/caption is short, body-adjacent, exclusive, and cleared at round boundaries (already true — keep it true).
- Keep the training lab in parity with matches for anything presentational (it now plays the ring-out resolution before snapping back; keep new presentation working there too — training never emits `game_over`).

---

## 6. Deliverables

1. **`FRESH_GAMEPLAY_FEEL_AUDIT.md` §K — Interaction presentation spec & record**: one table per family with columns `Interaction | Outcome | Startup tell | Contact/freeze | Release/reaction | Recovery | VFX/SFX | Camera | Caption | Frames @60 | Status (done / art request)`, followed by the art-request list.
2. The implementation, staged and validated as in §4.
3. In chat at the end: what changed per family, what's left, the art requests, and exactly what the owner should look for when playtesting each family.

Start by reading the two background documents and `getImageSrc.js` + `fighterAssets.js` (look at the poses), then capture the belly-bump connect and one of each strike outcome from the recordings before writing a single spec row.
