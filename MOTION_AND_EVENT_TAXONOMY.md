# Pumo Pumo Motion and Event Taxonomy

## Motion grammar

All registers share three ideas:

1. **Side owns direction.** Left-player information enters/points from the left; right-player information mirrors it without reversing text.
2. **Impact then calm.** One decisive acceleration, a readable hold, and a clean removal. No decorative breathing at rest.
3. **Priority controls mass.** Higher tiers gain area, duration, and one supporting accent. They do not gain an unrelated visual language.

B2 and B3 share the same information grammar but spend visual mass differently. B2 uses thin dark broadcast wings and measured cuts. B3 keeps persistent structure sparse and reserves stronger sports-manga geometry for temporary events, ceremony, and results. Direction B is historical reference only, not the approved grammar.

## Verified gameplay semantics

Static source inspection establishes opportunity conditions, not empirical match frequency:

- **COUNTER HIT:** `collisionSystem.js` awards it during attack/grab/rope-jump/sidestep/flap startup or a recent attack intent. The intent-only window is 100 ms with the mastery flag (150 ms fallback); a slap counter adds 35 ms and extra shove, explicitly **not** combo routing. Treat it as frequent-to-conditional acknowledgement.
- **PUNISH:** marks a hit during recovery/landing/whiff states. It confirms timing after the hit has already resolved; no new player input is requested.
- **GRAB BREAK / GRAB TECH / RESISTED:** resolved defensive outcomes. Grab Break costs 30 stamina and locks movement during separation, but the banner appears after the successful escape input. They are acknowledgements, not prompts.
- **COUNTER THROW / DEEP GRIP / COUNTER GRAB:** advantage-change reads. Deep Grip is earned after 1000 ms of unanswered push or specific clinch wins. Counter Grab creates an arm clamp with offense locked while Plant remains available. Persistent HUD state should carry the continuing advantage after the acknowledgement clears.
- **CLAMPED:** actionable local feedback because the victim's offense is restricted while a precise Plant defense remains available.
- **NOT ENOUGH STAMINA:** actionable local denial; it must explain the failed action immediately and clear without masking play.
- **PERFECT:** a 40 ms inner parry band with extra posture/frame reward; legitimately rare mastery.
- **PERFECT BRACE:** a 100 ms final startup window that opens the attacker and grants Deep Grip; legitimately rare mastery.
- **MATADOR / MATADOR BREAK:** both depend on committing to a 180 ms grab-line Matador window. Success turns a grab; a strike into live/whiff Matador produces the internally named GORED/EXPOSED punish. Their occurrence is strategy-dependent, so both use compact mastery rather than PERFECT-scale authority.

Telemetry is still required before production tuning can claim actual event frequency.

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

### Tier 1A — passive informational acknowledgement

Production events:

- offensive recognition: COUNTER HIT, PUNISH;
- technical defense/escape: RESISTED, GRAB BREAK, GRAB TECH;
- control/advantage: COUNTER THROW, DEEP GRIP, COUNTER GRAB.

Presentation:

- one coherent side-rail primitive;
- one readable line with no generic explanatory subtitle;
- 10–23 px lab type range, depending on viewport;
- outside the central fighter lane, never over a face or torso;
- mirrored opposing reads may coexist at the same vertical level;
- 125–215 ms entrance/overshoot, stable hold, then directed clear;
- 0.98 s B2/B3 total target;
- same-side replacement starts at 0.76 s so the old read cuts out as the new one arrives;
- no full-screen flash, dim, glow loop, or bespoke skin per word.

The current production rail's authoritative keys, replacement, restrike, and dedupe behavior remain the semantic starting point. Only its footprint, copy density, and material hierarchy are challenged.

### Tier 1B — actionable local feedback

Production events:

- CLAMPED — local player must understand that Plant remains available while offense is restricted;
- NOT ENOUGH STAMINA — local denied action and immediate recovery requirement;
- future escape/input-window text only when gameplay cannot communicate the window through pose/state alone.

Presentation:

- near the affected side but outside the fighter silhouette;
- warning notch and explicit shape, not red alone;
- one short action explanation is permitted;
- 145–260 ms entrance/settle, longer stable hold, clean removal;
- 1.45 s B2/B3 target, or the authoritative input-window duration when longer;
- it may coexist with a passive event only when the messages answer different player questions.

### Semantic accent mapping

| Family | Events | Color role | Non-color identity |
|---|---|---|---|
| Offensive recognition | COUNTER HIT, PUNISH | muted vermilion/coral | single diagonal cut |
| Technical defense | RESISTED, GRAB BREAK, GRAB TECH | deliberate ice blue | open bracket |
| Control advantage | COUNTER THROW, DEEP GRIP, COUNTER GRAB | restrained brass | double rule |
| Actionable warning | CLAMPED, NOT ENOUGH STAMINA | high-contrast vermilion | boxed `!` notch plus local placement |
| Mastery / rare | PERFECT, PERFECT BRACE, MATADOR, MATADOR BREAK | snow text with restrained brass | split-cross/crown mark, larger type, longer hold |

Fighter mawashi color remains an ownership accent and is not reassigned as an event-category color.

### Tier 2 — mastery / hype reads

Events:

- PERFECT (perfect parry);
- PERFECT BRACE;
- MATADOR;
- MATADOR BREAK.

`MATADOR BREAK` is inconsistent today: `SumoHypeStamp.jsx` defines a compact hype mark, while `GoredBannerEffect.jsx` renders it through the Tier 1 side rail. Source confirms a harder wrong-read reward than COUNTER HIT, but not empirical rarity. The revised taxonomy is **compact Tier 2**: louder than PUNISH, smaller than PERFECT, and strategy-dependent.

Recommended motion:

- 165–375 ms impact/overshoot/settle;
- roughly 760 ms stable hold;
- 240–360 ms directed exit;
- 1.5 s B2/B3 probe target; production may retain 1.25 s after readability testing;
- one supporting split-cross/line accent only—no seal, kanji wall, glow, and flash stack.

### Tier 3 — round ceremony

Events:

- HANDS DOWN / `tewotsuite`;
- HAKKI-YOI.

Shared structure:

- same type roles, anchor, color roles, and supporting line vocabulary;
- persistent HUD remains readable but visually quiet;
- all Tier 1/2 reads are cleared before ceremony begins.

Distinct choreography:

- **HANDS DOWN:** controlled reveal, low acceleration, held breath, then contraction. B2 uses one calm broadcast band over 1.8 s; B3 separates HANDS and DOWN around the open center over 1.7 s.
- **HAKKI-YOI:** compressed impact, brief settle, and outward release. B2's probe clears by about 0.84 s of a 1.05 s sequence; B3 clears by about 0.75 s of a 0.98 s sequence, leaving the first actionable beat unobstructed.

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
- 240–430 ms conclusive impact/settle;
- roughly 1.55 s stable readable hold in the 2.4 s B2/B3 probe;
- 300–430 ms clear;
- cinematic results may add one stronger world/compositing beat, but use the same result skeleton.

### Tier 5 — match and BASHO flow

Includes:

- PreMatch;
- MatchOver;
- BASHO DayCard;
- power-up selection and reveal where they touch match flow;
- rematch/next-day transition.

Motion:

- 350–600 ms major entrances with deliberate breathing room;
- the dark BASHO Day cut may fully leave arena color; continuity comes from type, spacing, fighter accents, hierarchy, and repeated motion roles;
- the B2/B3 Day transition runs arena → near-black ceremony → arena over 2.8 s in the motion probe;
- cream remains a supporting neutral, never the default full-screen surface;
- PreMatch and MatchOver should compose across the screen or arena, not default to centered cards;
- loading/readiness pulses are functional, not ambient decoration;
- interactive actions must never wait for decorative animation to become legible;
- reduced motion uses direct state changes plus short opacity transitions.

## Collision policy

### Per-side capacity

- At most **one Tier 1A acknowledgement rail per side**.
- At most **one Tier 1B actionable prompt for the affected local player**.
- At most **one Tier 2 hype read per side**.
- A local actor-anchored prompt may coexist only when it communicates an input window or denial not already stated by the rail.
- Never show both `COUNTER GRAB` and `CLAMPED` as equal banners; COUNTER GRAB explains the event, CLAMPED explains the local response window.

### Replacement and repeat

- Same event, same side, new authoritative event key: restrike the existing read; do not stack duplicates.
- Different Tier 1A, same side: begin the replacement cut before the old hold expires; do not queue stale combat information. The lab demonstrates a 0.76 s replacement start in a 0.98 s lifecycle.
- Same Tier 1B warning: refresh from the authoritative event/window key; do not stack copies.
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
| Flow | full-screen/broadcast composition | dark crossfade with no parallax or continuous pulse |

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
- an explicit same-side replacement toggle plus a rapid sequence across COUNTER HIT, PUNISH, GRAB BREAK, PERFECT, COUNTER THROW, and MATADOR BREAK;
- a five-family event sheet and ordinary-versus-mastery scale comparison;
- replay, pause, speed, frame-step scrub through 4000 ms, and reduced motion;
- delivered 30 fps motion samples for information replacement, mastery, both ceremonies, result, and BASHO transition in B2 and B3.

These fixtures test visual capacity. Stage 4 must test production event IDs, cleanup, authoritative side mapping, and round-ending cancellation against real gameplay.

