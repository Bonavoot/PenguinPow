# PUMO PUMO — Fresh Gameplay-Feel Audit

Phase 0 (diagnosis and implementation planning only). No game code, tuning, assets, tests, or configuration were modified. The only file added is this one.

Evidence hierarchy used: (1) the supplied recording, (2) executable code traced from the observed behaviour, (3) labelled inference. Repository prose, code comments, and prior documents were not used as evidence. Line references are to the current working tree.

---

## A. Independent verdict

The game does not look amateur because it lacks feedback. It looks amateur because **the simulation and the picture disagree about what matters**.

The server is precise and opinionated: every slap sets a distinct hit state with a computed knockback, freezes the room for a computed hitstop, tags the hit as counter/punish, decides a perfect parry inside a 31 ms window, stuns the parried attacker for 580 ms, and ends the round the instant a hit fighter's centre crosses a fixed X. The picture then draws almost all of those outcomes with the **same upright, planted penguin**. The struck fighter, the stunned fighter, the recovering fighter, the fighter in ready stance, the idle fighter, and the fighter who has just lost the round differ only by flipper angle and facial expression — differences that vanish at gameplay scale. Bodies are displaced by a frictionless ice slide with no lean, recoil, or footwork, so displacement reads as skating, not being driven back.

Because the body never tells the story, the presentation layer tells it with **text and uniform flashes**: a 67 ms white flash that looks identical on a trivial hit, a trade, the second-loudest hit of the match, and the hit that ends the round; a spark pinned to a world point that the sliding bodies leave behind; and text stamps (PERFECT!, COUNTER HIT!, THRUST OUT!) that last 1.5–3 s, stack, arrive 150–400 ms after the event they describe, and sit on the HUD side of the player rather than near the body. The round-deciding hit is visually indistinguishable from the one 400 ms before it; the loser is still standing in a normal pose on the rope when the banner fades in.

A second, narrower pattern compounds this: **vertical action is authored beyond what the camera shows**. The match-deciding kill throw launches the victim 1000 px on a 720 px map with a camera that never follows Y, so the victim is invisible for ~1.4 s and re-enters and lands within ~130 ms; the aerial's apex is clipped by the HUD.

The recording does not support "everything is placeholder animation" as the explanation. The failures traced here are in the **reaction contract** (which body states exist visually and how displacement is shown), the **round-end contract** (nothing changes in the world at the decisive tick), and the **feedback hierarchy** (uniform contact effects + text carrying the meaning). All three can be corrected substantially with placeholder-safe presentation and timing work before final art; final poses will make them better, not make them exist.

---

## B. What I actually inspected

- **Recording**: `/mnt/c/Users/vente/Videos/2026-09-05 02-12-12.mkv`, 123.649 s, 1920×1080 @ 60 fps, stereo 48 kHz audio present. Single-player BASHO run vs CPU, four rounds: Day 1 (Blubbernishiki, lost by CRUSHING THROW at 35.5 s), Day 2 (Glacier Gunkan, lost by THRUST OUT at 63.0 s), Day 3 (Mackerelyama, won by THRUST OUT at 86.0 s), Day 4 (Chill Norris, lost by PUSH OUT at 114.9 s). Watched at normal speed; contact sheets at 2 fps for the full clip; 15/20/30 fps sheets for every round finish, the first exchange, the perfect parry + punish, the loudest three hits, the CPU jump, the player's flap-dive, and the kill throw; 60 fps sheets for the dive landing (51.55–51.73) and the throw descent (35.25–35.43). Audio: RMS envelope and transient onset list (loudest: 35.583 s −18.3 dBFS throw landing; 79.433 s −19.9; 28.683 s −21.2; 18.150 s −21.0).
- **Code paths traced**: slap resolution and hitstun/hitstop (`server-io/collisionSystem.js`, `momentumTransfer.js`, `constants.js`), slap trade path, hit callouts (counter/punish), ring-out win condition and `handleWinCondition` (`server-io/index.js`, `gameFunctions.js`), clinch kill-throw arc and win timing (`index.js`, `commandGrabSystem.js` via trace), flap flight / dive / body-slam contact (`constants.js`, `collisionSystem.js`), client pose selection (`client/src/components/getImageSrc.js`), hit flash / spark / landing sound / interpolation (`GameFighter.jsx`), camera (`hooks/useCamera.js`, `lib/cameraShake.js`), win banner (`RoundResult.jsx`), side callouts (`SumoAnnouncementBanner.jsx`, `SumoHypeStamp.jsx`, `CounterHitEffect.jsx`, `GoredBannerEffect.jsx`), sprite assets (`fighterAssets.js` + PNGs).
- **Targeted checks**: (a) 60 fps frame extraction to distinguish interpolation teleports from authored fast motion (result: motion is continuous across 3–7 frames; teleport hypothesis rejected); (b) arithmetic on the kill-throw arc constants to predict visible/invisible durations (predicted 1.42 s invisible / 144 ms visible descent; observed ≈1.4 s / ≈120–130 ms); (c) side-by-side render of the pose assets that the state machine maps to.
- **Not verified**: the game was not run (no runtime instrumentation); which specific both-white contacts were same-tick trades (inferred from code: the trade path is the only path that whitens both fighters); the exact reason "PERFECT!" leads visible contact by ~150 ms (two candidate mechanisms listed in D3); music presence/level; controller input timing (the recording has no input overlay).

---

## C. Timestamped player-facing evidence

| Timestamp | Neutral observation | Likely player reading | Why it matters | Confidence |
|---|---|---|---|---|
| 18.100–18.467 | Red's flipper extended at purple (18.100). 18.133: **both** sprites turn fully white + yellow spark, camera zooms a step, loud transient (−21 dBFS). Both stay white ~100 ms. 18.267–18.467 purple slides back ~0.5–1 body width **in an upright pose identical to idle**; spark stays at the original point while bodies leave it; red is back to a standing stance by 18.267. | "Something happened; both flashed; now they're standing again." Cannot tell who hit whom. | First contact of the match establishes that hits are a flash and a slide, with no body reaction. | High (observation); trade attribution medium |
| 19.250–20.000 | "PERFECT!" stamp appears with purple still ~1 body above red. 19.450 purple lands beside red in a normal standing pose. 19.800 purple-only white flash + spark. 19.900 "PUNISH!". 20.000 purple in dizzy pose; HP bar drops. | "I got a PERFECT… nothing happened to him… then I hit him and now he's dizzy." | The parry's 580 ms stun is invisible until after the punish. Text announces success before bodies show it. | High |
| 28.500–28.967 | Purple slaps; 28.567–28.733 **both** fully white (~170 ms) + large spark + zoom step; third-loudest sound. 28.767: both back to colour, standing side by side, **no displacement, no reaction pose**. | "That was huge… and nothing happened." | Biggest audiovisual event of the round has the smallest visible consequence: feedback magnitude and consequence are decoupled. | High |
| 33.033–33.567 | Clinch connect; camera zooms a step in one frame; both lock in a static hold ~530 ms. | "They're hugging." | Clinch has no visible struggle or stake before the throw. | High |
| 33.633–35.433 | 33.633 red turns full white, hoisted; 33.833 red near top edge; **33.900–35.300 red is off-screen (~1.4 s)** while purple stands frozen arms-up and a smoke column dissipates; 35.317–35.433 red re-enters and is lying flat at the ring edge within ~120 ms. | "Where did I go? … oh, I'm on the floor." | Match-deciding throw: the victim is not visible for most of the throw and the landing is too fast to read. | High |
| 35.433–35.583 | Landing pose visible at 35.433; "CRUSHING THROW!" fades in from 35.500; loudest sound of the match at 35.583. Red lies flat until the Day 2 cut at 39.0. | Three separate "landing" cues over 150 ms. | Landing channels are desynchronised (pose swap, banner fade, sound triggered on a state flag). | High |
| 50.850–51.717 | Red in flap flight rises slowly; head clipped by HUD 51.10–51.30 (camera does not pan up); slow descent to 51.667; 51.667–51.717 drops ~1.5 body heights in 3 frames onto grey with spark. | "Float… float… slam." | Apex not framed; the drop is authored fast-fall (continuous in 60 fps frames), so it reads as intent-less snap unless anticipated. | High |
| 62.500 vs 62.900 | Two identical hits on red standing on the right rope: white flash + spark, no pose change, no visible displacement. 63.050 "THRUST OUT!" fades in; red still standing normally on the rope at 63.200+. | "Why did that one end the round?" | The round-ending hit has no distinct presentation and the loser never changes pose or leaves the rope. | High |
| 85.450–86.200 | Mirror case (player wins): blue struck at 85.450 and 85.800, standing normally on the rope; 85.950 "THRUST OUT!"; PERFECT! (since 84.5) and COUNTER HIT! still on screen — three stamps at once. | "I won? It says so." | Victory is a caption, not an event; stale stamps overlap the decisive one. | High |
| 112.300–112.567 | Green-only white flash + spark. 112.500 left "COUNTER HIT!" appears while right "COUNTER HIT!" already showing. Red's HP bar red/low. | "Both of us are counter-hitting?" | Callout definition is so broad that it stops carrying information; slot-anchored stamps don't point at a body. | High |
| 114.450–115.050 | Red struck on the left rope (white + spark), drifts left ~0.3 body width in idle pose over 400 ms; 114.850 red is just outside the rope + "PUSH OUT!"; red stands normally outside the ring; referee raises fan far right. | "I slid out, I guess." | Boundary crossing changes nothing about the body; the only ring-out cue is the caption. | High |
| 62.35–63.2, 85.35–86.2 | "COUNTER HIT!" on the right HUD rail while its owner (CPU) is on the **left** of the screen. | Reads as the wrong player's stamp. | Callouts anchored to player slot, not body position. | High |
| Throughout | Camera scale changes with every knockback (zoom-in on approach, out on separation), including one-frame steps on contact. | Constant "breathing". | Camera is coupled to inter-player distance rather than to moments. | High |

---

## D. Highest-impact root causes

### D1. The body never reacts: one silhouette for hit, stunned, recovering, ready, idle, and defeated

- **Symptom**: struck fighters slide back in a pose indistinguishable from idle (18.267–18.467, 62.5, 79.33, 114.45); parried attackers land "normally" (19.45); ring-out losers stand normally on the rope (63.05, 85.95, 114.85); hits read as a flash and a skate.
- **Evidence chain**: the server sets `isHit` on connect and keeps it for `max(attacker cooldown remaining, 60 ms)` — exactly until the attacker is also free (`server-io/collisionSystem.js:4008-4016`, `SLAP_MIN_HITSTUN_MS = 60` at `constants.js:258`); knockback is 175–380 px decaying at 0.982/tick ice friction (`momentumTransfer.js:24,171`). The client maps `isHit → hit` (`client/src/components/getImageSrc.js:240`), parried-aerial / landing-recovery states → `recovering` (`getImageSrc.js:252-267`), post-slap recovery and windup → `palmThrustStartup` (`getImageSrc.js:370-371`), stun → `isPerfectParried` only when not hit/grabbed (`getImageSrc.js:231-239`). The assets behind `hit`, `recovering`, `palm-thrust-startup`, `charging`, `blocking`, `is_perfect_parried`, and `pumo-idle` (`fighterAssets.js:13,38,47,48,54,70,79`) are all upright, feet planted, same body volume, no lean; they differ by flipper angle and face. **Correction (found during implementation, see §J):** there *is* one per-hit body transform — a 280 ms CSS `hitSquash` keyframe (scale/skew ≤ 4°, amplitude via `--impact-amp`, `fighterStyledComponents.js:983,1117-1122`) — but it is time-based, starts on the `isHit` edge and therefore plays *during the hitstop freeze under the white flash*, and is finished before the slide is visible; nothing in the render path was a function of the displayed knockback (direction, speed, decay). The perceptual finding stands: the other per-hit body change is the 67 ms white tint (`GameFighter.jsx:3317, 8921-8939, 9152`). At ring-out, `handleWinCondition` leaves `isHit` set and keeps the loser's slide velocity for 3 s (`gameFunctions.js:891-935`), so the loser is drawn with the same upright `hit` sprite until the next round.
- **Why it produces the symptom**: the simulation's most frequent state transitions (hit, recovery, stun, defeat) have no visible body correlate; displacement without body response reads as the sprite being moved, not the character being moved.
- **Competing explanations**: (a) hitstop missing — rejected: hitstop is 45–260 ms on every connect (`momentumTransfer.js:403-440`), observed ~100–170 ms; (b) network interpolation smearing motion — rejected as primary: 60 fps frames show continuous motion, and the 100 px snap guard (`GameFighter.jsx:2631-2642`) is not reached by slap knockback; (c) "just placeholder art" — partly true for final quality, but the missing element is a *reaction rule* (direction, magnitude, duration, settle), which the render path does not have at all.
- **Breadth**: every slap, trade, parry stun, and ring-out. Systemic.
- **Confidence**: High.
- **Before final animation?** Yes for the contract and a placeholder-safe body response; final poses later.
- **Disposition**: **Redesign** the reaction contract; implement a placeholder-safe version now.

### D2. Round end is a boolean, not an event

- **Symptom**: the fatal hit looks like the previous one; the loser stays standing on/near the rope; the banner fades in 150–400 ms later; the camera does nothing; stale stamps overlap.
- **Evidence chain**: win condition is `player.isHit && x <= 340 || x >= 935` (`server-io/index.js:1849-1857`; `MAP_LEFT/RIGHT_BOUNDARY` at `gameUtils.js:264-265`), not gated on grounding or any fall state; `winType` is simply `lastHitType` (`index.js:1884-1893`) → "THRUST OUT!"/"PUSH OUT!" text (`RoundResult.jsx:27-39`). `handleWinCondition` emits `game_over` on the same tick, zeroes the winner's motion, keeps the loser's slide, sets `loser.y` to ground or fall depth, and does nothing else to either body (`gameFunctions.js:891-935`); the reset fires 2000 ms later (`index.js:1933-1939`). Client: banner mounts after 2 rAF (`GameFighter.jsx:5858-5860`) and its keyframe reaches full opacity at 10 % of a 3 s animation ≈ 300 ms (`RoundResult.jsx:58,89-94,109-110`); `useCamera.js` has no round-end branch (normal tracking continues, `useCamera.js:517-538`); side callouts are not cleared (durations at `SumoAnnouncementBanner.jsx:41`, `SumoHypeStamp.jsx:23`).
- **Why**: the decisive tick changes a flag and starts a caption; nothing in the world (body, camera, time) marks it, so the player learns the outcome by reading.
- **Competing explanations**: (a) boundary line doesn't match the visual rope — not the main issue: in all three cases the loser is on or just past the rope when the banner appears; (b) banner too slow — true but secondary: a faster caption would still be a caption.
- **Breadth**: every round (4/4 in the recording); the moment that decides whether the outcome felt legitimate.
- **Confidence**: High.
- **Before final animation?** Yes: the state, timing, camera, and label policy; the fall/step-out pose is art.
- **Disposition**: **Redesign** (add a ring-out resolution beat).

### D3. Contact feedback is uniform, and meaning is delegated to slow, broad, misplaced text

- **Symptom**: trivial hits, trades, counters, the second-loudest hit, and the round-ending hit all present the same way (28.567, 79.333, 62.9, 114.45); the difference is carried by stamps that last 1.5–2.4 s, appear on both sides at once, sit on the HUD slot rather than near the body, and can lead the bodies (19.25).
- **Evidence chain**: a single hit rule — white tint 67 ms on the `isHit` rising edge, red tint 167 ms if within 300 ms of the last flash (`GameFighter.jsx:3316-3318, 8921-8939`); the slap shake profile has `punch: 0` (`lib/cameraShake.js:30`); the presentation event carries flags (`isCounterHit`, `isPunish`) but no severity (`collisionSystem.js:1844-1876`); the spark is placed once at the server seam and stays there (`GameFighter.jsx:4394-4415`); hit SFX base volume 0.042 with layer flags (`GameFighter.jsx:4262`). The trade path whitens both fighters exactly like a clean hit (`collisionSystem.js:1765-1889`, window 8 ms at `constants.js:813`; CPU AI runs before collision in the same tick, `index.js:602,743`). Counter-hit is true for any attack within 150 ms of an attempt or intent, any grab/rope/sidestep/flap startup, and any non-landing slide-jump phase (`collisionSystem.js:409-438`), so with both fighters slapping on a 260 ms cycle (`constants.js:198-201`) most hits qualify. Stamps: `ANNOUNCEMENT_DURATION_MS = 1500`, two per side; `HYPE_DURATION_MS = 2400`; side chosen by `playerNumber === 1` (`CounterHitEffect.jsx:56`, `GoredBannerEffect.jsx:51`). Camera zoom is a function of inter-player distance between 100 and 700 px (`useCamera.js:18-19,121-135`), lerped every frame (`useCamera.js:519-522`), so every knockback moves the zoom.
- **Why**: when every contact is presented at the same intensity, intensity carries no information; the text layer then has to carry it, but it is slow (event → banner), broad (counter definition), long (1.5–2.4 s), and spatially wrong (HUD slot), so it reads as noise.
- **Competing explanations for "PERFECT! before contact"**: (i) the aerial contact is resolved at a height threshold (body-slam connects at ≤ 100 px above ground, `collisionSystem.js:4126,4468-4472`) while the stamp fires on event arrival; (ii) event-driven effects lead position rendering by one interpolation interval (~31 ms, `GameFighter.jsx:2628`). Distinguishing check: log server contact tick vs the client's rendered Y of the attacker at stamp time; a lead ≫ 31 ms means (i).
- **Breadth**: every contact and every callout. Systemic.
- **Confidence**: High (mechanisms), Medium (trade attribution of specific frames).
- **Before final animation?** Yes.
- **Disposition**: **Simplify / tune** — a three-tier contact hierarchy expressed by body, time, and camera; narrow the counter rule; shorten and re-anchor stamps.

### D4. Vertical action is authored beyond the frame

- **Symptom**: kill-throw victim invisible ~1.4 s then lands in ~120 ms with three desynchronised landing cues; aerial apex clipped by the HUD; float-then-snap dive.
- **Evidence chain**: kill throw is a 1700 ms progress tween with peak at 48 % and height `GROUND_LEVEL + 1000` (ground 286; ease-out rise, ease-in fall) (`server-io/index.js:2027-2029,2098-2115`; `constants.js:1145-1148`); the camera pans Y only for flap flight and explicitly not for throws (`useCamera.js:525-538`), max 9 % (`useCamera.js:34-36`). Arithmetic: victim above +300 px from 133 ms after launch until 144 ms before touchdown → 1.42 s invisible, matching the recording. Landing cues: pose swaps to the flat sprite when Y ≤ ground + 80 while still falling (`GameFighter.jsx:138-141,8438-8449`); win + shake at `throwEndTime` (`index.js:2123-2154`); landing SFX plays when the client sees `isBeingThrown` clear (`GameFighter.jsx:6752-6799`), i.e., one broadcast later; banner fades over 300 ms. Aerials: flap ceiling +300 (`constants.js:885`) vs 9 % pan; dive = 220 ms pop to +200 then gravity 1.5/tick² with ≥ 8 px/tick (`constants.js:491-492,888-889`), continuous in 60 fps frames.
- **Competing explanations**: interpolation snap (100 px guard) — rejected by the 60 fps check; server tick hitching — no evidence.
- **Breadth**: kill throw (match-deciding when it happens), flap flight, dive.
- **Confidence**: High.
- **Before final animation?** Yes (arc/camera/event sync); hoist/launch/landing poses are art.
- **Disposition**: **Tune** the kill-throw arc to stay framed (or follow it), unify the landing to one event; **tune** flight framing.

---

## E. Highest-leverage recommendations

| Rank | Proposed change | Player-facing result | Evidence/confidence | Cost/risk | Art dependency | Success check |
|---|---|---|---|---|---|---|
| 1 | **Reaction contract v1 (client, presentation-only)**: while `isHit`, apply a body transform driven by knockback direction and magnitude — lean/skew away from the hit that settles as the slide decays, with a short recoil at the hitstop release; distinct sustained sway for `isRawParryStun`; hold the attacker's hit frame through hitstop then settle. No server or tuning changes. | The struck fighter is identifiable without the flash; slides read as being driven back; stunned fighters read as stunned before the punish. | D1, High | Low–medium; risk of over-animating (keep magnitudes small, tie to velocity). Isolated to render path. | None for v1; final hit/stun poses later replace the transform. | Blind test on 15 fps sheets: viewer names the struck fighter and direction in ≥ 9/10 hits with the white flash disabled. Same-scenario A/B recordings. |
| 2 | **Ring-out resolution beat (server + client)**: on the win tick, put the loser into a dedicated `ringOut` state (continue the shove past the rope + topple/step-out transform), hold the winner in stance, stop camera distance-tracking and settle on the rope, clear side stamps, and key the banner to the body event (topple/landing), not the tick. | The round ends because you saw someone leave the ring, then the caption confirms it. | D2, High | Medium; touches `handleWinCondition` and client state; regression risk on reset timing (2000 ms). | Fall/step-out pose is art; transform placeholder is fine. | In 4/4 finishes the loser's body crosses the rope and changes pose before the banner reaches full opacity; no stale stamp on screen at banner time. |
| 3 | **Contact hierarchy + stamp policy**: define three tiers (ordinary / decisive: counter, perfect parry, trade / finisher) and give each a body-time-camera signature (ordinary = flash + lean only; decisive = longer hold + directional recoil; finisher = D2). Narrow counter-hit to true startup (drop the 150 ms intent window and slide-jump phases). Shorten COUNTER HIT!/PUNISH! to ≤ 600 ms, PERFECT! to ≤ 900 ms, anchor to the body (or attacker side of the screen), never show the same stamp on both sides simultaneously. | Important contacts feel important; captions stop competing with bodies; "COUNTER HIT!" means something. | D3, High | Low for durations/anchor; medium for the counter rule (gameplay meaning changes: bonus hitstun via counter). | None. | Count stamps per round (target < ⅓ of current); ordinary vs decisive hits distinguishable on 15 fps sheets without text. |
| 4 | **Kill throw stays in frame**: cap the arc so the victim's peak stays inside the camera's headroom (or make the camera follow the thrown body), keep the ease-in fall, and fire one landing event that drives pose, sound, shake, and banner together. | The player watches themselves get thrown and land; the landing hits once. | D4, High | Low; server constant + client event ordering. | Launch/land poses are art; not required. | Victim visible for ≥ 90 % of the arc; pose/sound/banner within one 60 fps frame of each other. |
| 5 | **Decouple camera zoom from per-hit distance**: add hysteresis/deadband to the distance→scale mapping (or drive zoom by phase: neutral / edge / finish) so knockbacks don't pump the zoom; add a Y pan for any airborne body above the HUD line. | Stable framing; the apex is visible; zoom changes mean something. | D3/D4, High | Low. | None. | No scale change > 0.02 on an ordinary slap; airborne sprites never clipped by the HUD. |
| 6 | **Spark lifetime tied to hitstop**: end the impact spark at hitstop release + ~80 ms (currently held through hitstop then 200 ms dissipation, `SlapHitSpriteEffect.jsx:30,219`). | Contact point and bodies stop disagreeing. | D3, Medium | Trivial. | None. | Spark never outlives the victim's slide start by more than ~80 ms. |

A narrower correction than 1–2 (e.g., only speeding up the banner or only adding hitstop) would not solve the diagnosed problem: the missing information is in the body and the world state, not in the caption's latency or in the amount of freeze.

---

## F. What not to do yet

- **More hitstop, shake, particles, or zoom-punch on hits.** Hitstop already exists (45–260 ms); the problem is that the bodies do nothing during and after it. Adding intensity before adding information makes contact noisier, not clearer.
- **Netcode / interpolation work.** The 60 fps checks show continuous motion; the 100 px snap guard is not implicated in the observed snaps.
- **Changing slap frame data or the +0 hitstun contract** (`victimFreeAt = attackerFreeAt`, `collisionSystem.js:4008-4016`). It may deserve revisiting, but not until reactions are visible; otherwise you tune a mechanic you cannot see.
- **Changing ice friction / knockback distances** for feel. Displacement reads wrong because the body doesn't react, not because it slides too far. Tuning distance now changes ring-out balance without fixing the read.
- **A full animation production pass** (all states, all characters). Settle the reaction and round-end contracts first so animators get a spec, not a wishlist.
- **HUD/label restyling.** Duration, anchoring, and frequency are the problems, not typography.
- **Audio mixing pass.** Hit sounds vary only ~5 dB, but the audio hierarchy will follow naturally from the contact tiers in E3; mixing first would be redone.
- **Clinch struggle presentation** (33.0–33.6 static hold). Real, but narrower than the four causes above; schedule after E1–E2.

---

## G. Before-final-animation contract

**1. Settle before final animation (systems, timing, contracts, placeholder-safe presentation)**
- Reaction contract: for each of {hit, trade, stun, guard-break/parried, ring-out}, the direction, magnitude, duration, and settle rule of the body response, expressed so a transform can stand in for a pose.
- Ring-out resolution: a dedicated loser state, winner hold, camera behaviour, stamp clearing, banner timing keyed to the body event.
- Contact tiers and the stamp policy (which events get text, duration, anchor, exclusivity).
- Counter-hit definition.
- Kill-throw arc height vs camera headroom; one landing event.
- Camera policy: zoom hysteresis, Y follow for airborne bodies, behaviour at round end.
- Spark lifetime relative to hitstop.

**2. Truly depends on authored assets**
- Hit reaction poses (light/heavy, direction-aware), stun/dizzy loop, stagger.
- Ring-out fall/step-out and knocked-out poses; winner hold pose.
- Throw hoist/launch/airborne/landing frames; body-slam landing.
- Clinch struggle frames.
- Final impact VFX sprites and SFX per tier.

---

## H. Recommended first implementation phase

> Superseded: this minimal slice was carried out as a diagnostic and then replaced by the full foundation described in §J. Kept for the record.

**Scope: Slap hit reaction contract v1 — presentation only, ground slap and slap trade victims.**

- **Interactions and code paths touched**: client render path only. In `client/src/components/GameFighter.jsx`, derive a per-frame body transform for the fighter from `penguin.isHit`, `penguin.knockbackVelocity.x` (sign and magnitude), the hitstop window (`getDisplayHitstopUntil`), and `isRawParryStun`: (a) during hitstop hold the pre-hit pose (already done via `struckLimbHold`) plus a small compression; (b) at hitstop release apply a lean/skew away from the attacker proportional to `|knockbackVelocity.x|` (capped), decaying with the slide; (c) while `isRawParryStun` and not hit, a slow sway; (d) attacker: no change. Apply via the existing styled-component transform on the fighter sprite (`fighterStyledComponents.js`); keep the 67 ms white flash unchanged for A/B purposes.
- **Deliberately untouched**: server simulation, knockback values, hitstun/hitstop durations, friction, counter/punish rules, stamps, camera, sounds, round-end.
- **Acceptance (before/after)**: record the same Day 1 CPU match. On 15 fps contact sheets with the white flash masked, a viewer identifies the struck fighter and knockback direction in ≥ 9/10 slap contacts (baseline in this recording: not identifiable without the flash). At 30 fps the victim's silhouette differs from idle for the full slide (lean ≥ ~8°, returning to upright as the slide ends). Attacker/victim roles in trades remain visually symmetric (both lean away).
- **Regressions to check**: no transform leakage into throws, grabs, rope-jump, dive, or ring-out states (gate on `isHit && !isBeingThrown && !isBeingGrabbed && !isSlideJumping`); no change to sprite hit-test or shadow placement; no extra re-renders beyond the existing rAF hit-visual watcher; facing flips mid-slide do not mirror the lean incorrectly.
- **How to compare**: side-by-side clips of the same scenario before/after at 15 and 60 fps; count of contacts where the victim is identifiable; subjective 5-point "who got hit / how hard" rating from two people who did not implement it.
- **Stopping point**: once the slap victim reads correctly, stop. Do not extend to stamps, camera, ring-out, or throws in this phase; E2 (ring-out beat) is the next isolated slice and should be judged against a baseline that already includes E1.

---

## I. Genuine design decisions

1. **Should a landed slap stay +0 (victim free when the attacker is)?** This is why exchanges reset to neutral after every hit and progress is purely positional. Recommendation: keep +0 through Phase 1 (it is a coherent sumo stance: position is the reward), then re-evaluate once the body shows the shove. Tradeoff: advantage frames make hits feel more consequential but shift the game toward strike combos.
2. **Should the kill throw leave the screen?** It is currently authored to (1000 px). Recommendation: keep it in frame or follow it; the comic beat of "gone, then splat" is worth less than seeing the decisive moment. Tradeoff: loses the exaggerated height gag.
3. **What are stamps for?** Hype (PERFECT!, MATADOR!) versus information (COUNTER HIT!). Recommendation: keep hype stamps short and body-adjacent; demote COUNTER HIT!/PUNISH! to a body/VFX cue with no text unless the counter rule is narrowed. Tradeoff: fewer visible "rewards" for experts.
4. **Is the ice slide part of the identity?** Frictionless coasting is a mechanic and a look. Recommendation: keep the physics, make the body react to it (lean, feet planted vs skating). Tradeoff: a reacting body will make long slides look more deliberate but also expose how far they go.
5. **Camera philosophy**: continuous distance-coupled zoom versus staged framing (neutral / edge / finish). Recommendation: staged with hysteresis. Tradeoff: less "cinematic" motion in neutral, more legible moments.

---

## J. Implementation record — the gameplay-presentation foundation (post-audit)

The four high-confidence causes (D1–D4) were implemented as a foundation, not as the §H slice. Where the code contradicted the audit, the code won; those points are listed first.

### J.1 Where implementation corrected the audit

- **D1 evidence**: a per-hit body transform did exist (`hitSquash`, 280 ms CSS keyframe). It was inaudible in the recording because it is wall-clock keyframed on the `isHit` edge, so it plays under the white flash during the hitstop freeze and ends before the slide starts. The fix is therefore not "add a squash" but "own posture continuously from the displayed motion" (J.2). The keyframe is kept as the impact accent; the rig owns everything after it.
- **D4 arithmetic**: the map is 720 px tall with the ground at 286, so the tallest arc whose crown stays inside the *map* (not just the camera) is ≈ 240 px (286 + 240 + ~170 sprite). Camera following alone cannot rescue a 1000 px arc; the arc had to change. Also: with the edge clamp `|camY| ≤ 50(scale−1)`, panning to the clamp always shows the map top at *any* zoom, so airborne framing is a pan problem, not a zoom-out problem — the audit's "or make the camera follow" was half right.
- **D3 counter rule**: the audit proposed dropping both the 150 ms intent window and the slide-jump phases. Only the intent-only path was removed (a press that never became an attack is not a committed action). Anti-airing a committed aerial is a legitimate counter and stays.
- **Stamp anchoring**: the audit offered "body or attacker side". Body won: the word now spawns at the *struck* fighter's head on the impact frame, drawn by that fighter's own render instance, so it is where the eye already is.

### J.2 What was built (by stage; all validated before the next)

**Stage 1 — Reaction Rig (client, new subsystem).** `client/src/combatPresentation/reactionRig.js` (+ `reactionRig.test.js`, 15 tests): a pure per-frame posture state machine — `STRUCK` (compression + pre-lean while the display clock is frozen) → `REELING` (lean *into* the travel direction, proportional to the displayed slide speed with a perceptual curve, fast attack / lagging release) → `RECOVERING` (under-damped spring back upright, ≈9 % overshoot for weight) → `IDLE`; `STUNNED` (1.3 Hz dizzy sway + bob for parry stun); `TOPPLING`/`DOWNED` (ring-out fall, below). Tier (`ordinary`/`decisive`) scales lean ×1.35 and deepens the struck compression. Blocked states (grab, throw, aerial moves, ropes, bow…) drain to identity. Integration in `GameFighter.jsx:2689-2790` (rig block), stepped in both branches of the interpolation rAF (`:2963` moving, and inside the hitstop-frozen branch); output is written to the sprite's **individual CSS `rotate` / `scale` properties** (`fighterStyledComponents.js:836,1659`), which compose with — and are never overridden by — the existing `transform` keyframe animations; React attrs mirror the same strings so a re-render or sprite remount can never pop. Tier is armed from the `player_hit` payload (`isCounterHit || isPunish || isArmorBreak`).

**Stage 2 — Ring-out resolution (server + client).** Server (`gameFunctions.js:467-500, 928-975`): for every ring-out-class win the loser is marked `isRingOutLoser` + `ringOutDirection` + `ringOutStartTime`, the exit shove is floored to `RING_OUT_EXIT_VELOCITY` (4.8 velocity units ≈ 105 px on the dirt apron: off the rope, past the 90 px fall edge, onto the lower apron within ~350 ms), the struck state is held, the winner is marked `isRoundWinner`; the loser is excluded from the bow; dedicated finishes (kill throw/pull, cinematic kill, FORCE OUT, overarm throw, time expiry) are excluded. Fields ride the delta wire (`constants.js:55`), are reset in `roomManagement.js`/`playerCleanup.js`, defaulted in `playerFactory.js`. Round-end hold 2000 → `ROUND_END_HOLD_MS` 2600 (`constants.js:370`, three sites in `index.js`). Client: `getImageSrc.js:187` holds the struck sprite for the loser; the rig tips it 82° in the fall direction over 430 ms with an ease-in fall, a 7° rebound and a ground squash, then holds `DOWNED`; the landing fires `ring_out_land` (new shake profile with the finisher's single small push-in, `cameraShake.js:84`), `ringOutToppleLand` dust (`ParticleEngine.js`) and a low thud (`GameFighter.jsx:7075`). The kimarite banner is keyed to that landing (`roundResultBannerDelayMs`, `GameFighter.jsx:158`, used at `:6077`); the tick's own `ring_out` shake was demoted to a light cue. Server contract test: `server-io/test/presentation/ring-out-resolution.test.js` (4 tests).

**Stage 3 — Contact hierarchy & stamp policy.** New `client/src/components/ContactCallout.jsx`: COUNTER HIT / PUNISH / MATADOR BREAK are 650 ms words at the struck fighter's head, one per type, swept at round boundaries. `CounterHitEffect.jsx`, `PunishBannerEffect.jsx`, `GoredBannerEffect.jsx` (HUD-rail slabs) were deleted. Info rail hold 1500 → 850 ms (`SumoAnnouncementBanner.jsx`), hype hold 2400 → 1100 ms (`SumoHypeStamp.jsx`); both rails gained `retireAll…()` which `game_over` / `game_reset` call, so no stale word shares the screen with the kimarite. Decisive contacts hold the white snap 100 ms instead of 67. Server: intent-only counter removed (`collisionSystem.js:414`).

**Stage 4 — Camera (`useCamera.js`).** Zoom now follows a *filtered* engagement gap (deadband 48 px, τ 220 ms closing / 650 ms opening, `:51-53, :421-447`) with slower per-frame zoom rates, so a single shove barely moves the frame while sustained spacing still reads. Airborne framing generalised to any body above the ground (flight, dive, slide-jump, **thrown victim**) with the exact pan needed to keep the crown in frame (`panYForVisibleTop`, `:167`; `:571-590`), replacing the FLAP-only 9 % cap. `game_over` holds the zoom for the resolution beat while pan keeps tracking (`:327`). `addShake` gained a `source: "server"` path so a client-authored landing can suppress the server's duplicate (`cameraShake.js:145-160`).

**Stage 5 — Kill throw in frame.** `CLINCH_KILL_THROW_ARC_HEIGHT` 1000 → 240, `CLINCH_KILL_THROW_DURATION_MS` 1700 → 900 (same implied gravity; `constants.js:1164-1165`); spin keyframe 0.9 → 0.86 s to invert exactly at touchdown; `KILL_THROW_PEAK_ARM_PX` 400 → 110. One landing moment: the rAF frame on which the flat KO art takes over fires dust + thud + `kill_throw_land` crack (and suppresses the server's copy), with the banner 160 ms behind it (`GameFighter.jsx:3250, 7048`).

**Stage 6 — Spark**: dissipation after the hitstop hold 200 → 110 ms (`SlapHitSpriteEffect.jsx:34`).

### J.3 Validation performed

- Client: `reactionRig.test.js` 15/15; all existing `combatPresentation` and `combatAudio` node tests pass; ESLint on every touched file adds no errors (the 4 pre-existing `no-unused-vars` errors in `GameFighter.jsx`, `fighterStyledComponents.js` are untouched).
- Server: `npm test` → 1367 tests, 1353 pass; the 14 failures are the identical pre-existing set from the baseline run taken before any change (Phase 13 / 4A / 4C limb-contact tests).
- Runtime smoke (dev server + Vite + the Cursor browser, VS CPU / HARD, no input from the player): the match ran with zero collected runtime errors; the ring-out loser was observed **lying toppled at −82° past the rope on the lower apron at (233, 249)** with the struck sprite held, framed by the camera — the D2 finish now exists as a body event. Mid-fight lean and the body callouts could not be observed live because further browser automation was blocked by the session's review policy; they are covered by the unit tests and by the same DOM path that the topple demonstrably drove (`style.rotate`/`style.scale` on the sprite element).

### J.4a Feedback pass — rig v2 (planted feet, air hits, kill-throw splat)

Playtest feedback on v1: the sway/lean read as "a flat image being rotated, as if the ground doesn't exist"; a stuffed slide-jump showed the body on an angle, then snapping flat and dipping below the ice; the kill-throw "fall to splat" cut looked off. Frame checks of the second recording (`2026-09-05 05-58-00.mkv`, 27.55–28.15 s at 60 fps) confirmed all three and found one more: the airborne tilt pointed the wrong way (the server's knockback sign disagreed with the actual travel after an overlap eject).

- **Shear, not rotation, on the ground.** The rig now emits two deformations: `leanDeg` (skewX about the sole — feet stay planted and level, only the upper body displaces) for every grounded state (struck, reeling, recovering, stun sway, belly-bump drive), and `tiltDeg` (rotation) only while airborne and for the ring-out fall, which really is a rigid rotation. The two are blended by the *displayed* height over the last ~34 px of a descent, so a landing goes tilt → feet slap flat + squash (`LAND_SQUASH_Y` 0.9, 190 ms) → bent body straightens; no frame can switch deformation. A rigid rotation's bottom corner poking through the ice is gone by construction.
- **Wrapper layer instead of per-sprite properties.** `FighterRigLayer` (`fighterStyledComponents.js`) wraps the sprite cluster with `inset: 0`, so children keep their map-percent positions; the rig writes one `transform` + `transform-origin` (the fighter's sole, following the same anchor the sprite CSS uses) per frame. The layer never remounts on a sprite swap, so posture can no longer pop on hit → idle; identity is `transform: none` (no stacking context) and while bending the layer carries the body's own z, so the victim still paints under the striking limb and the grab-arm z contract is untouched.
- **Direction from real travel.** At the struck edge the rig uses the server knockback sign (never the victim's own pre-hit motion); once the post-release travel exceeds 90 px/s the displayed velocity decides, so an ejected air victim tilts with its actual flight.
- **Below-ground dip fixed at the source.** The interpolator's 25 % extrapolation could carry a fast descent below the lower authoritative sample for a frame or two; it is now floored at that sample (`GameFighter.jsx` interpolation loop). Real drops (dohyo edge) are unaffected because the floor is the sample, not `GROUND_LEVEL`.
- **Kill-throw splat.** The spin keyframe now also translates the box down (0 → 18 %) so the horizontal body's underside meets the ground line exactly at touchdown (the standing body is ~75 % of its box wide, the flat art sits ~5 % below its box); the flat-art swap moved from 80 px to 14 px above ground (the touchdown frame), and the `clinchKillThrowLandSquash` starts on that same frame rather than when the server flag clears. Dust, thud, crack, squash and art swap are now one frame.
- **Belly bump.** Could not isolate the reported oddity in the clip (every slide contact in it was a stuffed slide-jump, not a connect). Added the attacker-side `DRIVING` phase: after the contact freeze the belly-bumper stays bent 9° into the shove and straightens as the fixed follow-through crawl dies, so the crawl reads as a dig-in rather than an upright glide. The server crawl itself (`SLIDE_SLAP_FOLLOW_VEL` 0.9, friction 1) was left alone — `test/momentum/slide-slap.test.js` pins it as a deliberate design ("decay was the chop").

### J.4b Owner verdict on the rig, and the training lab

- **Verdict**: bending flat 2D art (shear lean, stun sway, drive bend) reads as the picture thinning and slanting, and it persisted into moments where the player already had control. Rejected. `RIG_FEATURES` (`reactionRig.js`) now ships with `groundBend`, `struckSquash`, `stunSway`, `bellyDrive` **off**; `airTilt` (levelled out through the last 70 px of a descent, so the body meets the ice upright), `landSquash` (a short authored compression on touchdown) and `topple` (ring-out) stay on. The next pass (`PUMO_PUMO_FABLE_5_1_INTERACTION_PRESENTATION_MEGA_PROMPT.md`) is an interaction-by-interaction, authored, "on rails" presentation standard — poses, timing, position, camera, VFX, SFX — not deformation.
- **Training lab parity**: a ring-out in training used to reset on the very tick the boundary was crossed, so none of the round-end presentation was ever visible there. `handleWinCondition` now applies the same `applyRingOutResolution` (topple flag, exit shove, `ring_out` event, input lock on the loser) and holds `TRAINING_RING_OUT_HOLD_MS` (1500) before snapping back; the loser physics gate in `index.js` treats `isRingOutLoser` like the match loser. Client `training_reset` sweeps callouts and posture like `game_reset`. Contract test added to `ring-out-resolution.test.js`.

### J.4 Tuning surface (all in one place each)

`RIG_TUNING` in `reactionRig.js` (shear cap 15°, decisive ×1.35, speed reference 780 px/s, air tilt 14° with a 34 px hand-over band, landing squash 0.9 / 190 ms, recovery ω 13 / ζ 0.6, stun 4.5° @ 1.3 Hz, drive 9° / 320 ms, topple 82° / 430 ms); camera `ZOOM_GAP_*`, `AIRBORNE_*`, `SMOOTH_ZOOM_*` in `useCamera.js`; `RING_OUT_EXIT_VELOCITY`, `ROUND_END_HOLD_MS`, kill-throw arc/duration in `server-io/constants.js`; `CONTACT_CALLOUT_MS` / head offset in `ContactCallout.jsx`; rail holds in `SumoAnnouncementBanner.jsx` / `SumoHypeStamp.jsx`.

---

## K. Interaction presentation spec & record (authored, "on rails")

Standard applied: every interaction is a sequence of **poses held for fixed frames**, **positions that snap**, and **cuts or short authored tweens** — never procedural deformation of the flat art (`RIG_FEATURES` bend channels stay off). Where a beat has no pose, the closest existing pose is used with authored timing and the missing pose is logged in K.10.

Frame counts are 60 fps (1 f = 16.7 ms). Server times are sim-clock (they pause in lockstep with the display hitstop). `Status`: **done** = changed in this pass; **existing** = already met the standard before this pass and is specified here for the record (verify in playtest); **art** = needs a pose (see K.10); **n/a** = the outcome does not exist for that move in code.

### K.1 Ground truth for this pass

- Recording `2026-09-05 05-58-00.mkv` (56 s, Day 10–12 BASHO) at 3 fps overview, then 20 fps strips at 10.3–11.9, 26.8–28.4, 33.4–35.0 s. Every slide contact in it is a **stuffed slide-jump** (27.3 s, 34.3 s: flap wings → hit in the air → airTilt → lands upright), not a belly-bump connect. The rope-edge ring-out at 10.7–11.3 s (three COUNTER HIT clamps → topple onto the apron → THRUST OUT) reads exactly as §J.2 Stage 2 intended and is the reference for "the decisive frame, the hold, the caption".
- **No belly-bump connect exists in either recording.** The belly bump below is diagnosed from the executable path (`gameFunctions.js:1175-1230, 1279-1284, 1364-1375`; `collisionSystem.js:3392-3399`; `index.js:3671-3693`; client `combatTiming.js`, `getImageSrc.js:368-383`, `GameFighter.jsx` `handlePlayerHit` belly-bump block) and the pinned test `test/momentum/slide-slap.test.js`. **Owner: please record one connected belly bump** (slide ≥ 1.45 into M1, land it) so the K.2 row can be checked against a 60 fps strip.
- Pose vocabulary reviewed as a single sheet (40 poses; `hit.png` is a 3-frame wince loop @ 16 fps, `is_perfect_parried.png` is a 7-frame spin, `at-the-ropes.png` 6 frames, `grab-attempt.png` 20 frames). Notable: the game has **no** brace/plant pose, **no** dedicated stun pose (the spin doubles as sidestep), **no** grab-clash/separation pose (AP success f1 is borrowed), **no** hit-recover pose.
- Inventory verified against `socketHandlers.js`, `gameFunctions.js`, `commandGrabSystem.js`, `collisionSystem.js`, `constants.js`: low kick is **disabled** (`LOW_KICK_ENABLED = false`); the old clinch sub-game (jolt / brace / perfect brace / deep grip / grab break / belly flop / frontal force-out) is **not reachable** in the live command-grab system (flags remain on the wire and in `getImageSrc` as dead branches); belly bump is the slide-armed slap (`slideSlapArmed`), not a separate move.

### K.2 Belly bump — diagnosis and fix (the owner's "dealt with weirdly")

**What the code did on a connect** (client + server, before this pass):

| t (anim clock) | Attacker pose | Attacker motion | Notes |
|---|---|---|---|
| 0–18 ms (1 f) | `palm-thrust-startup` (upright ready stance) | full slide speed (≥ 1.45) | **one-frame upright pop** in the middle of a crouched slide |
| 18–55 ms | `belly-bump` | full slide speed | lunge |
| ~55–100 ms contact | `belly-bump` (connect hold) | frozen 88–140 ms | `bellyBumpPlant` squash keyframe **played under the freeze** (wall-clock) — invisible, finished before release |
| release → 330 ms | `belly-bump` (same single frame) | **constant 0.9** (friction 1) | one static picture glides forward ~230 ms |
| 330 ms | cut to **idle** | velocity **zeroed on the same tick** | the glide is switched off; no plant, no recovery pose |

So the "weird" read is three things stacked: a windup flicker, a static image gliding at constant speed, and a stop that is a hard cut to idle with no body beat. The server crawl itself (`SLIDE_SLAP_FOLLOW_VEL 0.9`, friction 1) is **left alone** — `slide-slap.test.js` pins it ("decay was the chop") and the fix is presentational.

**Spec (done):**

| Beat | Frames @60 | Pose | Position | VFX/SFX | Status |
|---|---|---|---|---|---|
| Windup | 0–3 f | `sliding` (stay in the slide squat) | full slide | arm dust already fires on `slideSlapArmed` edge | done (`getImageSrc.js`) |
| Lunge → contact | 3–6 f | `belly-bump` | full slide → server park pin | — | existing |
| Freeze | 5–8 f | `belly-bump` held (connect hold) | frozen | white snap on victim, judder, `slide_slap_hit` shake, gut-check SFX | existing |
| Release | +0 f | `belly-bump` + `bellyBumpPlant` compress **starts at release** | crawl begins (0.9) | plant dust + throwLand puff at victim feet | done (retimed, `GameFighter.jsx` `BELLY_BUMP_PLANT_ACCENT_MS`) |
| Crawl | release → 14.4 f | `belly-bump` | constant crawl | — | existing |
| Plant lead-in | last 5.4 f of the cycle (`SLIDE_SLAP_PLANT_LEAD_MS` 90) | `palm-thrust-startup` (ready stance) | still crawling | — | done (`combatTiming.js` `SLAP_ANIM.SLIDE_HIT_END`) |
| Stop | cycle end | ready stance **held** | velocity zeroed | one skid puff at the feet kicked *against* travel | done (`poseBeats` `SLIDE_SLAP_PLANT`, +4.8 f `SLIDE_SLAP_PLANT_HOLD_MS` 80) |
| Neutral | after hold | idle (or whatever the player does — any input cancels the hold) | — | — | done |

Victim side (unchanged in code, specified): pre-hit pose held through the freeze → `hit` wince, 260–440 px send on ice, hitstun = attacker's remaining cycle + 50 ms → **post-hit settle** (K.3) → neutral.

### K.3 What was built this pass (all families)

1. **`client/src/combatPresentation/poseBeats.js`** (+ 17 tests) — authored, time-boxed pose holds that **replace idle only**. Any other body owner (attack, parry, dodge, grab, strafe, new hit, ring-out…) cancels a beat outright; it never resumes. Wired through `resolveFighterDisplaySprite` (`struckLimbHold.js`, new `poseBeatSrc` arg, ranked below the struck-limb hold and the dash windup) so the precedence itself is unit-tested. Beats: `POST_HIT_SETTLE` (100 ms `recovering` on the grounded `isHit` falling edge — the victim's feet catch the ice before idle, instead of idle-on-wheels while still skating), `SLIDE_SLAP_PLANT` (K.2). Round boundaries (`game_reset`, `training_reset`) sweep beats. The rAF watcher forces the release render on a beat's deadline.
2. **Belly bump director** (K.2): `getImageSrc` slide-armed frames, `SLAP_ANIM.SLIDE_HIT_END` lead-in, plant accent retimed to hitstop release, plant dust at the stop.
3. **Trade = one contact** (`collisionSystem.js` `applyTradeHit` / `resolveSlapTrade` / `resolveSlapChargedTrade`: payload gains `isTrade` + shared `tradeId`; presentation-only fields). Client: the second half of a trade draws **no** spark, crack or shake of its own; the first half shakes symmetrically (no direction bias, ×1.2) with a second, lower crack layered so the pair reads as a clash; **both** bodies are on the decisive tier (100 ms white snap, deeper struck hold). Previously a trade was two unrelated hits with two sparks and two shakes.
4. **AP / matador whiff jail made visible**: after the 50 ms f1 flinch the server still has the fighter locked for the rest of `AP_WHIFF_RECOVERY_MS` (300). That jail was drawn as idle. It now draws `recovering` for its whole remaining duration (server-flag-bound, no client timer), so a whiffed commitment looks committed.
5. Cleanup: two pre-existing unused imports removed from `getImageSrc.js`.

Verified and **left as-is** after inspection: AP success hold (server keeps `isRawParrySuccess` for the full 200 ms lock; the client already holds f2 through hitstop + lock), ring-out resolution, kill throw, airborne tilt, body callouts, camera.

### K.4 Strikes

| Interaction | Outcome | Startup tell | Contact/freeze | Release/reaction | Recovery | VFX/SFX | Camera | Caption | Frames @60 | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Slap | whiff | `palm-thrust-startup` 1 f → `slap-N-blur` 2.3 f | — | `slap-N-hit` 2.8 f | `palm-thrust-startup` 9.5 f (+ whiff extra recovery) | whiff swoosh at startup | none | — | 15.6 f cycle | existing |
| Slap | hit (ordinary) | as whiff | attacker holds `slap-N-hit` through freeze; victim holds **pre-hit pose** through freeze; 67 ms white; judder ±3 px | victim → `hit` wince + send (floor/ceil px per move), attacker chases (granted) | victim: `hit` until attacker is free (+0) → **`recovering` 6 f (settle)** → idle; attacker: ready stance | spark at seam (hitstop + 110 ms), skid dust ×1–3 by momentum, slap crack + momentum sub-layer | `slap_hit` replace-mode shake, zoom deadbanded | — | freeze 2.7–~7 f | **done** (settle) |
| Slap | hit (heavy / momentum) | same | same; judder amp by tier | bigger send; extra skid puffs | same | heavier sub-layer, more dust | scale by `momentumPower/Impact` | — | — | existing |
| Slap | trade | both in `slap-N-hit` | **one** symmetric freeze; both hold their strike frame; both 100 ms white | both → `hit`, mutual `SLAP_TRADE_KNOCKBACK` | both: hitstun 120 ms → settle 6 f → idle | **one** spark, one crack + lower clash layer, one symmetric shake | `slap_hit` ×1.2, no dir | — | freeze 45 ms+ | **done** |
| Slap | counter hit | — | decisive: 100 ms white, deeper struck hold | ×1.25 send | settle → idle | pitched-down thud layer | — | **COUNTER HIT** 650 ms at struck head | — | existing |
| Slap | punish | — | decisive | send | settle → idle | pitched-up crack layer | — | **PUNISH** 650 ms at head | — | existing |
| Slap | guarded | — | `guard_block` hitstop; parrier `block-parry` for the absorb window; attacker holds strike frame | chip shove `slapParryKnockbackVelocity` | attacker: normal recovery | blocking effect sheet | `guard_block` | — | — | existing |
| Slap | AP-parried | — | `AP_HITSTOP_MS` 110 (6.6 f); parrier `raw-parry-success-f2` **through hitstop + 200 ms lock** | attacker staggered 180 ms, shoved | attacker: `isRawParryStun` → spin loop | star burst, parry SFX | `parry` | — | 6.6 f + 12 f | existing |
| Slap | perfect-parried | — | 210 ms (12.6 f) freeze; f2 | attacker stun 580 ms (35 f) | spin loop → free | — | `perfect_parry` | **PERFECT** 1100 ms hype | — | existing |
| Slap | airborne victim | — | freeze; victim `hit` | airTilt 14° with travel, levelled through last 70 px | landSquash 190 ms on touchdown → settle 6 f → idle | — | airborne pan keeps crown in frame | — | — | existing + done (settle after land) |
| Slap | rope / edge | — | clamp: heavier crumple amp; `at-the-ropes` pose owns the body | pinned at rope rest | — | rope clamp body SFX, clamped effect | `rope_clamp_hit` (palm) | — | — | existing |
| Slap | kill | n/a — slap cannot ring out except via posture-armed clamp (ring-out resolution, K.9) | | | | | | | | n/a |
| Belly bump | whiff | `sliding` 3 f → `belly-bump` | — | `belly-bump` to 14.4 f → ready stance 5.4 f | idle | arm dust on convert | — | — | 19.8 f | **done** |
| Belly bump | hit | K.2 | K.2 | K.2 | K.2 | K.2 | `slide_slap_hit` | — | K.2 | **done** |
| Belly bump | trade / counter / punish / guarded / parried | as slap (same cycle) with bump art | | | | | | | | existing |
| Charged headbutt | whiff | `charging` (hold, 0–100 % over 1 s; tier VFX) → release → `attack` (flying) | — | lunge 300 / 500 / 1000+ ms by tier | `recovering` | launch SFX + smoke | — | — | 9 f startup | existing |
| Charged headbutt | hit | as whiff | `attack` pinned at server X; 45–260 ms freeze by closing speed | victim `hit` + knockback trail 280 ms; attacker recoil (`CHARGED_ATTACKER_RECOIL`) | attacker `recovering` 280 ms (17 f); victim settle → idle | charged spark sheet, charged crack, counter/punish layers | `charged_hit` scaled | COUNTER/PUNISH at head | — | existing + done (settle) |
| Charged headbutt | charge clash | both `attack` | `charge_clash` midpoint burst | asymmetric knockback by charge | both `recovering` 450 ms | clash burst | — | — | 27 f | existing |
| Charged headbutt | vs slap trade | — | one freeze (`isTrade`) | slapper takes charged drain + trade shove | — | one spark / one crack | symmetric | — | — | **done** |
| Charged headbutt | armor break (vs grab startup) | — | `grab_armor_break` | victim `hit` | — | glass shatter + `grabArmorBreak` particles | — | — | — | existing |
| Charged headbutt | kill (cinematic) | — | `cinematic_kill` 550 ms freeze | fly-out | loser off-ring | cinematic trail | kill cinematic | kimarite banner | — | existing |
| Palm thrust | whiff | `palm-thrust-smear` 5.4 f (startup) | — | `palm-thrust` held active 5.4 f + hold 380 ms | `palm-thrust-startup` 60 ms | whiff SFX | — | — | — | existing |
| Palm thrust | hit | as whiff | `palm-thrust` pinned; burst freeze (weight 1.0) | victim `hit`, burst send | attacker hold 200 ms; victim settle → idle | burst spark, `throw_landing` shake | — | COUNTER/PUNISH | — | existing + done (settle) |
| Palm thrust | guarded / AP / perfect / rope | as slap rows (palm stagger 420 ms on AP) | | | | | | | | existing |
| Palm thrust | shatter (power-up) | — | `grab_armor_break` | — | — | glass | — | — | — | existing |
| Low kick | all | disabled (`LOW_KICK_ENABLED=false`); poses/paths dormant | | | | | | | | n/a |

### K.5 Defense

| Interaction | Outcome | Startup tell | Contact/freeze | Release/reaction | Recovery | VFX/SFX | Camera | Caption | Frames @60 | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Guard (Space hold) | attempting | `blocking` from press (live window, then guard floor — same art) | — | — | — | — | — | — | — | existing |
| Guard | absorb | — | `block-parry` for the absorb window; attacker holds strike | chip shove | back to `blocking` while held | blocking sheet + chip SFX | `guard_block` | — | — | existing |
| Guard | crush | — | — | `isRawParryStun` 500 ms → spin loop, gassed | — | — | — | — | 30 f | existing (art: stun pose) |
| Attack parry (tap) | window (no contact) | `blocking` | — | — | — | — | — | — | — | existing |
| Attack parry | success | `blocking` → | `raw-parry-success-f2` **on the hit frame**, 110 ms freeze | attacker shoved + staggered (slap 180 / palm 420 / flap 500) | f2 held through the 200 ms lock (server flag) | star burst, parry SFX, balance refund glyph | `parry` | — | 6.6 f + 12 f | existing (verified) |
| Attack parry | perfect | same | 210 ms freeze | attacker stun 580 ms | f2 through lock | — | `perfect_parry` | **PERFECT** | 12.6 f + 12 f | existing |
| Attack parry | whiff (empty window) | `blocking` | — | `raw-parry-success-f1` flinch **3 f** | **`recovering` for the remaining ~15 f of the 300 ms jail** (was idle) | — | — | — | 18 f | **done** |
| Attack parry | stun on attacker | — | — | attacker: `is_perfect_parried` spin loop | free on stun end | stunned SFX, stars | — | — | 35 f (perfect) | existing (art: a true dazed pose — see K.10) |
| Matador (back+Space) | success | `blocking` → | `matador_success` freeze | grabber yanked; matador shows `is-attempting-pull` | — | matador burst | — | **MATADOR** hype | — | existing |
| Matador | whiff | — | — | f1 flinch 3 f → **`recovering` for the jail** | — | — | — | — | — | **done** (same path as AP whiff) |
| Matador | kill | — | `cinematic_kill` (`matador_kill`) | — | loser `belly-laying` | — | kill cinematic | banner | — | existing |
| DI (hold away) | braked knockback | — | — | shorter send; `braked` flag | settle → idle | skid puff kicked **back** toward the shove (dig-in) | — | — | — | existing |

### K.6 Movement

| Interaction | Outcome | Startup tell | Contact/freeze | Release/reaction | Recovery | VFX/SFX | Camera | Caption | Frames @60 | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Walk / strafe | loop | `pumo-waddle` APNG, strafing SFX | — | — | — | — | filtered zoom (deadband 48 px) | — | — | existing |
| Dash / dodge (Shift tap) | start · hop · land | `recovering` windup (dash windup) → `sliding` squat + CSS hop arc | — | — | land holds the squat (no idle for the land window) | dodge effect, dash smoke | — | — | 135 ms + recovery | existing |
| Ice slide (Shift held) | loop · brake · reverse hop | `sliding`; brake = `isBraking` dust; reverse hop flashes `recovering` → `sliding` | — | — | — | ice slide start dust | — | — | — | existing |
| Slide-jump | start · flight · land (clean) | grounded flash 100 ms → `flap-1/2` in the air | — | — | `recovering` 90 ms landing recovery + 160 ms settle | landing smoke | airborne pan (crown in frame) | — | — | existing |
| Slide-jump | dive (fast-fall) | `dodging` on `DIVE_ACTIVE` | belly-slam contact = `flap` hit row | — | `recovering` | slam dust | — | — | — | existing |
| Slide-jump | stuffed (hit in the air) | — | victim `hit` + `INTERRUPTED_AIRBORNE` keeps `hit` in the air | airTilt with travel, levelled before touchdown | landSquash → settle 6 f → idle | — | airborne pan | — | — | existing + done |
| Slide-jump | parried in the air | — | `PARRIED_FALL` → `recovering` fall | — | `LANDING_RECOVERY` / `GROUNDED_STAGGER` → `recovering` | — | — | — | — | existing |
| FLAP (power-up) | start · beat · dive | `recovering` startup → `flap-1/2` alternating on `flapWingBeatTime`; `dodging` when out of charges / fast-fall | — | — | `recovering` landing | flap SFX per beat | airborne pan | — | — | existing |
| Rope jump | start · arc · land | `recovering` 166 ms (telegraph) → `dodging` 450 ms arc → `recovering` 183 ms | — | — | — | rope kick-off FX (`ropeKickoffFxId`) | — | — | 10 f / 27 f / 11 f | existing |
| Sidestep | start · spin · recover | 50 ms → `is_perfect_parried` **spin** 400 ms → `recovering` 150 ms | — | — | — | sidestep VFX | — | — | 3 / 24 / 9 f | existing (art: sidestep pose — K.10) |
| At the ropes | clamp | `at-the-ropes` APNG owns the body while pinned; facing locked | — | — | — | clamped effect, rope body SFX | `rope_clamp` | — | — | existing |

### K.7 Clinch / grab

| Interaction | Outcome | Startup tell | Contact/freeze | Release/reaction | Recovery | VFX/SFX | Camera | Caption | Frames @60 | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Grab attempt (M2) | startup · connect | `grab-attempt` APNG (20 f) lunge; `isGrabStartup` armor | latch → `grabbing` body + `belt-grab-arm-only` overlay on both | — | — | grab SFX | clinch zoom step | — | — | existing |
| Grab attempt | whiff | as above | — | — | `recovering` 450 ms (27 f) — the punish window | — | — | — | 27 f | existing |
| Grab attempt | clash (mutual) | — | `isClinchClashing` → `raw-parry-success-f1` **placeholder** | `clinch_callout` tech | — | tech SFX | — | rail: tech callout | — | existing (art: clash pose) |
| Grab attempt | stuffed (armor break) | — | `grab_armor_break` glass | grabber `hit` | — | shatter | — | — | — | existing |
| Grab attempt | absorbed (Thick Blubber) | — | `grab_armor_absorb` | — | — | absorb ring | — | — | — | existing |
| Counter-grab | connect | — | `counter_grab` | — | — | counter-grab SFX | — | rail callout | — | existing |
| Drive (push) | drive · rope pin | `grabbing` (committed lean is CSS) vs victim `clinch-planting` | `rope_clamp` at the pin | — | — | drive rope body SFX | `rope_clamp` | — | — | existing |
| Drive | release (separation) | — | `CMD_DRIVE_RELEASE_IMPACT_MS` 80 → | shoved fighter: **palm shove-off** poses re-paced (`GRAB_SEPARATE_PALM_ANIM`) while tweening 270 ms; grabber `raw-parry-success-f1` **placeholder** | settle before the tween ends | `grab_separate` | — | — | 5 f + 16 f | existing (art: separation pose for the grabber) |
| Drive | **FORCE OUT** | — | boundary | loser `push-defeat-pose` held after the shove | winner stance; bow skipped for `grabPush` | — | round-end hold | **FORCE OUT** | — | existing |
| Throw (non-kill) | hoist · arc · land | `throwing` / victim `hit` on CSS arc | `clinch_throw` hitstop | land → `THROW_LAND` shake + dust | victim `hit` → settle → idle | throw SFX | — | — | — | existing + done (settle) |
| **Kill throw** | launch · arc · **land** | `clinch_kill_throw` → spin (`hit`, 0.86 s spin keyframe, box translates down to meet the ground) | — | 240 px / 900 ms arc **in frame** | **one landing frame**: flat KO art + dust + thud + `kill_throw_land` crack + squash; banner 160 ms later | `clinchKillThrowLand` | airborne pan; kill cinematic | **CRUSHING THROW** | 54 f arc | existing (owner-approved) |
| Pull | yank | `is-attempting-pull` | — | victim pulled past | — | grab SFX | — | — | — | existing |
| **Kill pull** | slide · down | — | — | victim `belly-laying-eyes-open` during the slide | `belly-laying` (eyes closed) at the bow | — | round-end hold | banner | — | existing |
| Jolt / brace / perfect brace / deep grip / tech / grab break / belly flop / frontal force-out | — | **unreachable** in the live command-grab system (flags never set); `getImageSrc` branches are dead | | | | | | | | n/a (candidate for removal in a signature audit) |

### K.8 Power-ups

| Interaction | Outcome | Startup tell | Contact/freeze | Release/reaction | Recovery | VFX/SFX | Camera | Caption | Frames @60 | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Salt ritual / draft | activation | `salt` pose, basket; `power_ups_revealed` | — | — | — | salt SFX | — | rail | — | existing |
| Snowball | throw | `snowball-throw` APNG (9 f) | — | projectile extrapolated at 60 fps | — | throw SFX | — | — | — | existing |
| Snowball | hit | — | `snowball_hit`; victim `hit`; hitstop weight 0.3 | send | settle 6 f → idle | projectile burst | — | — | — | existing + done (settle) |
| Snowball | parried / perfect-parried | — | `raw_parry_success` (projectile); parrier f2 200 ms lock (shorter perfect lock) | ball reflected | — | star burst | — | PERFECT on perfect | — | existing |
| Snowball | absorbed | — | `grab_armor_absorb` | — | — | absorb ring | — | — | — | existing |
| Pumo army | spawn · clone hit | `pumo-army` APNG (10 f) | clone hit = projectile path (`pumoClone`) | victim `hit` | settle → idle | army SFX | — | — | — | existing + done |
| Happy feet (speed) | activation | HUD icon; faster waddle | — | — | — | — | — | — | — | existing |
| Power water | activation · powered hit | HUD icon; `isPowered` on hits | — | bigger send | — | red-tinted spark palette | — | — | — | existing |
| Thick blubber | absorb | — | K.7 absorb row | — | — | — | — | — | — | existing |
| FLAP | — | K.6 | | | | | | | | existing |
| Shatter palm | — | K.4 palm shatter row | | | | | | | | existing |
| Size | not in `POWER_UP_TYPES` (BASHO opponent scale only) | | | | | | | | | n/a |

### K.9 Round structure

| Interaction | Decisive frame | Hold | Caption | Reset | Status |
|---|---|---|---|---|---|
| Ready / tachiai | `pumo-ready-position` → `pumo-tachiai-position` after the intro; gyoji "HANDS DOWN…" | until both ready | TE WO TSUITE! (`gyoji_call`) | — | existing |
| HAKKIYOI | `game_start` → both released | — | **HAKKI-YOI!** banner | — | existing |
| Ring-out (thrust / push out, okuridashi) | loser floored to `RING_OUT_EXIT_VELOCITY` 4.8, `hit` held, **topples 82° over 430 ms**, lands on the apron (`ring_out_land` shake + dust + thud); winner `isRoundWinner` stance | `ROUND_END_HOLD_MS` 2600 (training 1500, then snap back) | kimarite banner keyed to the **topple landing** (`roundResultBannerDelayMs`); side rails swept | walk-up | existing (owner-approved; verified in recording 10.7–11.3 s) |
| Kill finishes (cinematic charged / kill throw / kill pull / matador kill) | own choreography (K.4 / K.7) | round-end hold | banner | — | existing |
| FORCE OUT | K.7 | hold; bow skipped | FORCE OUT | — | existing |
| Time expiry (hantei) | `bout_draw` `{hanteiScores}` or `timeExpired` win | — | hantei UI | torinaoshi rematch path | existing (not presentation-changed; verify) |
| Bow | `bow` APNG (10 f) — loser excluded on ring-out | — | — | — | existing |
| Reset / walk-up | `game_reset`: callouts, hype, rails, posture, **pose beats** swept; `training_reset` identical | — | — | — | done (beats added to the sweep) |
| BASHO day cards | client `DayCard` interstitial; server waits on `basho_advance` | — | DAY N / opponent | — | existing |

### K.10 Art requests (precise briefs)

Each is one static pose (or a 2–3 frame loop) on the standard 480×480 canvas, sole on the same baseline as `pumo-idle.png`. Placeholder currently in use is named so the swap is a one-line change in `getImageSrc.js` / `poseBeats.js`.

1. **`hit-recover.png` — brace/plant after a shove** (placeholder: `recovering.png`, `POST_HIT_SETTLE`, 6 f). Silhouette: feet wide, knees bent, weight on the back foot, flippers out low to the sides catching balance, head up and forward, eyes open (the wince is over). Must read at gameplay scale as *"caught it"* — distinct from `recovering` (head down) and `crouch-stance` (deliberate stance).
2. **`belly-bump-plant.png` — dig-in after a bump** (placeholder: `palm-thrust-startup.png`, `SLIDE_SLAP_PLANT`, 5.4 f + 4.8 f). Silhouette: belly still forward, front foot planted and toes splayed, back leg straight, flippers back, chin tucked — the momentum arriving in the feet.
3. **`stunned.png` (3-frame loop)** — dazed, not spinning (placeholder: `is_perfect_parried.png` spin). Upright, knees soft, head lolling side to side, eyes as spirals/closed, flippers hanging. Hold 500–580 ms; the spin should return to being *only* the sidestep.
4. **`sidestep.png`** — a quarter-turn step-behind with one flipper leading (placeholder: the spin). 24 f active.
5. **`grab-clash.png`** — both fighters' shoulders jammed, arms locked at the belt, feet skidding (placeholder: `raw-parry-success-frame-1.png` flinch). Mirrors so both fighters can use it.
6. **`grab-separate.png`** (grabber) — released, hands open, weight back, one step retreating (placeholder: `raw-parry-success-frame-1.png`). 5 f + 16 f tween.
7. **`throw-land.png`** (non-kill throw victim) — on the back foot after being thrown, flippers windmilling (placeholder: `hit` then settle).
8. **`guard-crush.png`** — guard broken: flippers flung wide, torso open, mouth open (placeholder: stun spin). 30 f.
9. **`hit-heavy.png`** — a second, deeper hit reaction for charged / palm / belly-bump / counter tiers (placeholder: the single `hit` wince). Torso folded back, one foot lifted, flippers thrown.

### K.11 Playtest — what to look for

- **Belly bump** (slide ≥ 1.45 and press M1 into the opponent): the squat should hold right up to the pop into the bump (no upright flicker); after the freeze the body compresses *as it starts to crawl*, the bumper is back in the ready stance **before** he stops, a puff of ice kicks back at his feet at the stop, and he stays planted a beat. If you press anything the plant yields instantly. A whiffed bump should look like any other whiffed slap.
- **Any landed slap / palm / charged** (both sides): the victim comes out of the wince into a 6-frame hunch before idle, even while still sliding. It must never show while you are already slapping / strafing / parrying — if you ever see the hunch *under* an input you made, that is a bug (report which input).
- **Trade** (slap into a CPU slap on the same frame): one spark, one crack (with a lower second layer), one symmetric shake; both fighters snap white for 100 ms. Previously two of everything.
- **Whiffed parry / matador** (tap Space with nothing coming): the flinch, then the fighter visibly stays in the hunched recovery for the rest of the jail (~¼ s). Landing a parry still shows f2 held through the lock as before.
- **Regressions to watch**: idle ghost frame between hit and hunch (should be none); ring-out loser must still topple and stay down; training lab must show the same beats and clear them on reset.

### K.12 Validation

- Client: `poseBeats.test.js` 17/17; `struckLimbHold.test.js` 47/47 (precedence with the new `poseBeatSrc` arg covered); `slapConnectHold` 6/6; `reactionRig` 24/24. ESLint on every touched file: no new errors (the two pre-existing `no-unused-vars` in `GameFighter.jsx` remain; the two in `getImageSrc.js` were removed). `npx vite build` ✓.
- Server: `npm test` 1368 tests, 14 failures — **byte-identical failing set** to the pre-change baseline (Phase 13 / 4A / 4C limb-contact suites).
- Not verified live (per the owner's instruction not to drive the game from the IDE): the beats' on-screen read. All new timings are named constants (`POSE_BEAT_TIMING`, `SLIDE_SLAP_PLANT_LEAD_MS`, `BELLY_BUMP_PLANT_ACCENT_MS`).
