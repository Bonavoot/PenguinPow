# Pumo Pumo Motion and Event Taxonomy

## Motion grammar

All registers share three ideas:

1. **Side owns direction.** Left-player information enters/points from the left; right-player information mirrors it without reversing text.
2. **Impact then calm.** One decisive acceleration, a readable hold, and a clean removal. No decorative breathing at rest.
3. **Priority controls mass.** Higher tiers gain area, duration, and one supporting accent. They do not gain an unrelated visual language.

Direction B's grammar is a restrained sports-broadcast cut with one ceremonial fan/rope rhythm. It may borrow the discipline of sports-manga transitions, not another game's graphics.

## Tier definitions

### Tier 0 — persistent match information

Includes:

- player identity and local ownership;
- stamina and ghost damage;
- posture/balance;
- score and round/BASHO day;
- active power-up, cooldown, charges;
- critical BASHO boon state;
- danger, gassed, recovery, deep-grip, and shove state.

Motion:

- ordinary updates: 120–220 ms transform/opacity/fill interpolation;
- heavy hit: one 180–320 ms impulse;
- recovery/refund: one 450–750 ms directed accent;
- critical loop, if still necessary: 900–1400 ms with low amplitude and only one owner per wing;
- no idle shimmer, wobble, glow cycle, or permanent breathing.

### Tier 1 — mechanical reads

Production events:

- COUNTER HIT — `CounterHitEffect.jsx`;
- PUNISH — `PunishBannerEffect.jsx`;
- COUNTER GRAB — `CounterGrabEffect.jsx`;
- GRAB BREAK — `GrabBreakEffect.jsx`;
- GRAB TECH — `GrabTechEffect.jsx`;
- COUNTER THROW, RESISTED, DEEP GRIP — `ClinchCalloutEffect.jsx`;
- CLAMPED local escape prompt — `GripPromptEffect.jsx`;
- NOT ENOUGH STAMINA local denied-action prompt — `GassedEffect.jsx`.

Recommended motion:

- 140–190 ms side-directed entrance;
- 40–70 ms settle;
- 550–800 ms readable hold;
- 140–190 ms exit/cut;
- total target: 0.9–1.2 s unless game semantics require a longer input window;
- no full-screen flash or dim.

The current rail's 1.5 s lifecycle, replacement, and restrike mechanics are sound starting semantics, but the visible hold can be tightened after gameplay review.

### Tier 2 — mastery / hype reads

Events:

- PERFECT (perfect parry);
- PERFECT BRACE;
- MATADOR;
- MATADOR BREAK.

`MATADOR BREAK` is inconsistent today: `SumoHypeStamp.jsx` defines a compact hype mark, while `GoredBannerEffect.jsx` renders it through the Tier 1 side rail. The recommended taxonomy is **compact Tier 2**: rarer and louder than PUNISH, smaller than PERFECT. This must be confirmed against event frequency before Stage 4.

Recommended motion:

- 180–260 ms press/cut entrance;
- 650–900 ms hold;
- 180–240 ms exit;
- total target: 1.1–1.4 s;
- one supporting accent only: seal/fan cut, line burst, or brief flash—not all three;
- preserve the current 1.25 s lifecycle unless playtesting proves it too short.

### Tier 3 — round ceremony

Events:

- HANDS DOWN / `tewotsuite`;
- HAKKI-YOI.

Shared structure:

- same type roles, anchor, color roles, and supporting line vocabulary;
- persistent HUD remains readable but visually quiet;
- all Tier 1/2 reads are cleared before ceremony begins.

Distinct choreography:

- **HANDS DOWN:** controlled rise or reveal, low acceleration, held breath. It may occupy the current 2 s game lifecycle.
- **HAKKI-YOI:** compressed forward cut/release. Its dominant visual mass should clear within the opening beat even if the component's authoritative lifecycle remains 1.8 s.

Changing the visual clear point must not change input activation or server timing.

### Tier 4 — result

Production results from `RoundResult.jsx`:

- THRUST OUT / `slap`;
- PUSH OUT / `charged`;
- DEMOLISHED / `cinematicKill`;
- FORCE OUT / `grabPush`;
- OVERARM THROW / `grabThrow`;
- CRUSHING THROW / `clinchKillThrow`;
- PULL DOWN / `clinchKillPull`;
- REAR PUSH OUT / `okuridashi`;
- BODY SLAM / `flap`;
- RING OUT / snowball, clone, generic fallback.

Motion:

- technique/result is the first and largest read;
- winner/loser context remains available, not covered by ornament;
- 220–360 ms conclusive stamp/cut;
- 1.4–2.2 s stable readable hold within the existing three-second lifecycle;
- 180–300 ms clear;
- cinematic results may add one stronger world/compositing beat, but use the same result skeleton.

### Tier 5 — match and BASHO flow

Includes:

- PreMatch;
- MatchOver;
- BASHO DayCard;
- power-up selection and reveal where they touch match flow;
- rematch/next-day transition.

Motion:

- 350–600 ms major transitions with deliberate breathing room;
- content should remain connected to arena color and fighter identity;
- loading/readiness pulses are functional, not ambient decoration;
- interactive actions must never wait for decorative animation to become legible;
- reduced motion uses direct state changes plus short opacity transitions.

## Collision policy

### Per-side capacity

- At most **one Tier 1 mechanical rail per side**.
- At most **one Tier 2 hype read per side**.
- A local actor-anchored prompt may coexist only when it communicates an input window or denial not already stated by the rail.
- Never show both `COUNTER GRAB` and `CLAMPED` as equal banners; COUNTER GRAB explains the event, CLAMPED explains the local response window.

### Replacement and repeat

- Same event, same side, new authoritative event key: restrike the existing read; do not stack duplicates.
- Different Tier 1, same side: replace immediately with a short cut. Do not queue stale combat information.
- Tier 2, same side: replace Tier 1 and suppress a redundant Tier 1 generated by the same action.
- New Tier 1 while own-side Tier 2 is active: suppress if redundant; otherwise defer only until the Tier 2's text-safe hold has ended, with a maximum freshness window of 300 ms. Past that, drop it.
- Event IDs/timestamps remain the dedupe source. Visual timers must not infer gameplay occurrence.

### Simultaneous players

- Opposing Tier 1 reads may coexist in mirrored lanes.
- Opposing Tier 2 reads may coexist as compact mirrored marks; neither may occupy the center ceremony lane.
- Tier 1 on one side may coexist with Tier 2 on the other if their text-safe areas do not overlap.
- Side inversion changes origin and alignment, never semantic ownership.

### Round ending

- Tier 4 result cancels and unmounts all Tier 1/2 reads and clears pending replacement timers.
- The round-ending world hit remains visible.
- A mastery event caused by the finishing action may contribute a very brief accent before the result, but duplicate explanatory text is suppressed.
- Result presentation freezes or calms continuous danger/gassed/posture loops.
- No rail queues survive into the next round.

### Ceremony and flow

- Tier 3 clears Tier 1/2 before its entrance.
- Tier 3 does not hide mandatory Tier 0 data, but it may lower decorative HUD contrast.
- Tier 5 owns the screen and hides match HUD hosts through the existing mounted visibility seam.
- Reset, rematch, and next-day transitions clear all local timers and event IDs.

### Occlusion

- Direction wedges, impact trails, and decorative framing may pass behind actors.
- The minimum readable event text/backing must remain above actors.
- A callout may not cover the responsible fighter's face/torso at neutral camera framing.
- Tier 2 may overlap silhouette edges for impact but not the semantic text.
- Mandatory Tier 0 values stay above actors and stage props; see `PRESENTATION_LAYER_MAP.md`.

## Reduced-motion alternatives

| Register | Full motion | Reduced motion |
|---|---|---|
| Tier 0 update | short fill/edge movement | direct value update plus 100–140 ms opacity/color acknowledgement |
| Tier 1 | directional slide/cut | 100–140 ms fade with static side pointer; full readable hold |
| Tier 2 | press/scale plus one accent | 120–160 ms fade/very small scale; no rotation, shake, streak, or flash |
| HANDS DOWN | controlled rise | static composition with short fade |
| HAKKI-YOI | forward release cut | static decisive composition, short fade, early clear |
| Result | stamp/brush movement | direct result layout with short fade and stable hold |
| Flow | card/fighter travel | crossfade with no parallax or continuous pulse |

Reduced motion does not remove information, reduce hold duration below readability, or set every duration to zero.

## Performance contract

- Frequent motion: transform, opacity, and canvas fill only.
- Keyframes are module-static; dynamic values use CSS custom properties.
- Avoid animating width/height/position for callouts; meter values may use a compositor-safe inner transform where practical.
- No Tier 1 full-screen paint.
- One full-screen accent owner at a time for Tier 2–4.
- `will-change` is applied only for an active entrance/exit or existing camera transform.
- Warm one hidden representative per tier before first gameplay use.
- Replacement clears every timeout/listener owned by the previous visual instance.

## Stage 1 overlap tests

The lab exposes:

- opposing simultaneous callouts;
- a rapid repeat/replacement sequence across COUNTER HIT, PUNISH, GRAB BREAK, PERFECT, COUNTER THROW, and MATADOR BREAK;
- replay, pause, speed, frame-step scrub, and reduced motion.

These fixtures test visual capacity. Stage 4 must test production event IDs, cleanup, authoritative side mapping, and round-ending cancellation against real gameplay.

