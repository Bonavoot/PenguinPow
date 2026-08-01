# Pumo Pumo Premium Match UI — Forensic Audit

Date: 2026-08-01  
Scope: Stage 0 audit and Stage 1 direction gate only

## Executive finding

The arena, crowd, gyōji, and penguin silhouettes are already the game's strongest identity. The weak link is not a lack of effects; it is the absence of one hierarchy spanning the persistent HUD, mechanical reads, ceremony, results, and BASHO flow.

**Recommendation: Direction B — Winter Basho Broadcast.** It gives the permanent HUD a clear mirrored broadcast silhouette, reserves large manga-style motion for meaningful events, and uses ivory/sumi/ice/vermilion/brass in roles rather than as decoration. Direction A is safer but retains too much of the current hardware-overlay silhouette. Direction C has strong personality but spends visual intensity too continuously and is least durable against the hand-drawn scene.

No production direction should be implemented until the visual-direction gate is approved.

## Evidence inspected

- Four supplied 1024×576 Pumo screenshots, including neutral combat, HANDS DOWN, and FORCE OUT.
- Supplied Pumo recording, `2026-08-01 16-14-30.mkv` (68.0 s).
- Supplied MARVEL Tōkon reference, `2026-08-01 16-18-52.mkv` (43.3 s).
- Extracted source contact sheets and transition sequences under `premium-match-ui-evidence/source-analysis/`.
- Production rendering/state ownership in:
  - `client/src/components/Game.jsx`
  - `client/src/components/GameFighter.jsx`
  - `client/src/components/UiPlayerInfo.jsx`
  - `client/src/components/UiPlayerInfoBasho.jsx`
  - `client/src/components/BalanceGauge.jsx`
  - `client/src/components/BashoDayHud.jsx`
  - `client/src/components/BashoBoonStrip.jsx`
  - `client/src/components/SumoAnnouncementBanner.jsx`
  - `client/src/components/SumoHypeStamp.jsx`
  - `client/src/components/SumoGameAnnouncement.jsx`
  - `client/src/components/RoundResult.jsx`
  - `client/src/components/PreMatchScreen.jsx`
  - `client/src/components/DayCard.jsx`
  - `client/src/components/MatchOver.jsx`
  - `client/src/components/PowerUpSelection.jsx`
  - `client/src/components/PowerUpReveal.jsx`
  - event wrappers named in `MOTION_AND_EVENT_TAXONOMY.md`
  - `client/src/components/menuTheme.js`
  - `client/src/styles/typography.css`
  - `client/src/App.css`
  - `client/src/components/SteamDeck.css`

## Rendered-game findings

### Pumo footage

- **Persistent hierarchy:** stamina is correctly the largest persistent signal, but names, rank plates, center day, posture, win marks, and square power-up tiles all use separate framing conventions. At a glance, the top reads as several widgets rather than one match silhouette.
- **Ownership:** mirrored placement works, but green stamina on both sides weakens fighter ownership. Mawashi color appears in smaller signals while the dominant bar remains shared green.
- **HAND S DOWN:** production holds for 2 s. Its gentle rise is semantically appropriate, but the white headline, Japanese subtitle, brush, and flash are a different graphic family from side reads and results.
- **HAKKI-YOI:** production holds for 1.8 s. The fast slam has the right release energy, but its full-screen flash/vignette/brush mass can compete with the first actionable instant.
- **Mechanical callouts:** the 1.5 s side rails are appropriately smaller than ceremony, side-owned, and fast. In busy frames they can feel detached from the initiating fighter and their kanji/line/plaque details are dense relative to the short mechanical message.
- **Hype stamps:** the 1.25 s register creates a useful priority jump, but each variant accumulates stamp, seal, kanji, label, gradient, and bespoke choreography. It reads as a family only at the component level, not across the whole package.
- **RoundResult:** the three-second result composition is conclusive and readable, but it is materially louder than the illustrated scene: flash, haze, splash, brush, gradient display type, subtitle, and film treatment arrive together. The supplied FORCE OUT frame demonstrates strong dominance but also obscures much of the winner/loser context.
- **Flow continuity:** PreMatch and DayCard move into very dark, full-screen graphic environments. Their typography and card grammar are internally competent, but the cut from the colorful arena is severe enough to feel like a different product layer.
- **Occlusion:** the screenshots show the crowd and stage props pushing close to the top HUD. Code confirms that the entire `#game-hud-info` layer sits below ring props and actors; therefore mandatory text and meters can be crossed by tassels, fighters, and props, not merely decorative framing.
- **Lighting:** crowd grading and vignettes create depth, but the cool/dark stack compresses the illustrated crowd while fighters do not always gain an equally clean edge separation. The ice remains attractive; more global darkness is not the solution.

### Tōkon principles worth retaining

- The top HUD is read as one silhouette before its labels are read.
- Player color ownership is established in broad, controlled fields.
- ROUND/FIGHT transitions use large mass briefly, then clear decisively.
- Ordinary combat reads occupy much less mass than ceremony.
- Streaks, distortion, and high-energy graphics are transition punctuation rather than permanent wallpaper.
- Bright-stage readability comes from structural contrast and silhouette, not repeated dark cards behind every label.

These are hierarchy and timing lessons only. Direction B deliberately does not copy Tōkon's shapes, placement details, type, palette, or branded motion.

## Diagnosis review

| ID | Verdict | Evidence |
|---|---|---|
| A | Confirmed | The arena and characters carry the most specific authorship in every supplied frame. |
| B | Confirmed | The black/gold plates, beveled meters, and square slots read as hardware/esports overlay over an illustrated world. |
| C | Confirmed | Green gloss, blue posture, gold rank, gradient tiles, stones, seals, brushes, grain, and lighting effects do not share one material rule. |
| D | Confirmed | Framed gradient power-up squares resemble mobile inventory tiles, especially at the top corners. |
| E | Confirmed | Bungee/display styling appears across identity, ceremony, results, and match-adjacent flow, reducing role contrast. |
| F | Confirmed | Mechanical rails, hype stamps, ceremony, result, PreMatch, and DayCard each use distinct compositional and easing systems. |
| G | Partially confirmed | Local ownership needs a cue, but HUD `YOU`, actor `You`, and `PLAYER 1` together are redundant. Keep one persistent cue plus the actor marker when spatially useful. |
| H | Confirmed | Rank, name, stamina, posture, center day, win history, power-ups, and boons lack a strict density/priority rule. |
| I | Confirmed | Side reads can be small/detached; hype stamps spend too much ornament relative to their duration. |
| J | Partially confirmed | Mood is effective, but stacked scene grading softens crowd detail without consistently improving fighter separation. |
| K | Confirmed | PreMatch/DayCard darkness breaks arena continuity. Darkness can remain a transition device, not the whole identity. |
| L | Confirmed | Detailed local comments and polish coexist with global inconsistency. |
| M | Confirmed | `UiPlayerInfo.jsx` combines state smoothing, event response, layout, animation, and material styling, making safe iteration expensive. |

## Token audit

### Type

| Role/source | Current use | Conflict |
|---|---|---|
| `FONT_DISPLAY` / Bungee | hero headings, player names, results, DayCard numerals, MatchOver | Too many hierarchy levels share the same voice. |
| `FONT_UI` / Chillax | labels, ranks, stats, cards, boons | Best candidate for persistent match information; small tracked variants become hard to read. |
| `FONT_BODY` / `"Space Grotesk", "Inter", system-ui` | PreMatch labels and supporting copy | No Space Grotesk package, import, or local face was found. It falls back by platform and conflicts with CSS `--font-body`, which points to Chillax. |
| `FONT_KANJI` / Noto Serif JP | verified ceremonial Japanese and result subtitles | Semantically appropriate; first-use rasterization is already warmed in `Game.jsx`. |
| Noto Sans JP 600 | globally imported | No explicit match-presentation role was found in the audited path; verify need before retaining the global load. |
| Material Symbols | icon glyph utility | Functional icon role only; do not mix with fighter/event typography. |
| Tracking tokens | `none`, `body`, `meta`, `label`, `display` | Label/display tracking is overused at controller distance and on sub-12 px text. |

| Type scale / scope | Observed values | Audit |
|---|---|---|
| HUD identity | `clamp(11px, 1.55cqw, 19px)` | Good range; long-name policy is missing. |
| Rank / state / power-up | `clamp(7px…10px, 0.78cqw…1.2cqw, 9px…14px)` | The 7–9 px floor is below controller-distance comfort. |
| Gassed / recovery | `clamp(9px, 1.3cqh, 16px)` and `clamp(7px, 1cqh, 13px)` | State hierarchy is expressed through both type and effects; effects currently dominate. |
| Center day | numeral `clamp(24px, 4cqw, 56px)`, label `clamp(7px, 0.9cqw, 12px)` | Numeral works; label tracking at the small floor does not. |
| Tier 1 rail | secondary `0.82–1.05rem`, primary `0.95–1.25rem`, hero `1.05–1.4rem`; mobile floors `0.72–0.9rem` | Three subtiers are too granular for one mechanical register. |
| Hype | label about `0.95–1.45rem`; kanji up to `4.8–6.4rem` | Kanji can outweigh the gameplay word. |
| Result | English `clamp(2.2rem, 6.5cqw, 5.8rem)`; Japanese `0.8–1.4rem` | Strong dominance; long English strings need width-class rules. |
| Tracking | `0`, `0.01em`, `0.04em`, `0.08em`, `0.12em`; local outliers `0.2`, `0.22`, animated `0.25–0.8em` | Keep 0–0.08em for small UI. Reserve 0.12em+ for large ceremonial copy. |

### Color and material

| Token family | Current values / role | Conflict |
|---|---|---|
| Dark anchors | `ink #0a0d12`, `inkSoft #141821`, rgba ink panels; `sumi #171a20`, `sumiSoft #22262d` | Two near-duplicate dark systems serve HUD and match-adjacent flow. |
| Snow surfaces | `#eaf1f7`, `#f3f7fb`, `#fff`, `#dde9f1`, `#cbdbe7`; border `#b3c7d6` | Strong flow palette, but its full-white DayCard jump needs arena continuity. |
| Dark text | `#0f1d2e`, `#06101c`, `#34465e`, `#5b6e87` plus faint alpha | Coherent on snow; not consistently shared with match cards. |
| Ivory text | `cream #f5ecd9`, `creamWarm #e8dcc8`, muted/faint alpha variants | Appropriate primary-on-dark family. |
| Vermilion | `#d83b27`, bright `#ee5141`, deep `#8a1f12`, glow alpha | Currently CTA, danger, ceremony, and event punctuation; roles need separation. |
| Brass/gold | `#e8c547`, deep `#b8860b` | Simultaneously rank, premium trim, day, card, rail, and hype. |
| Ice | `#7eb8d0`, bright `#a8d0e4`, mid `#3a7a9a`, deep `#1c4a62` | Environment, technical events, and old posture associations overlap. |
| Posture | `#6fa9c4`, bright `#8fbed4`, mid `#5a93ae`, deep `#3a6a82` | Correct dedicated family, but still resembles a separate metallic meter. |
| Stamina | `#3db86a`, bright `#5fd98a`, mid `#2a9a58`, deep `#176b3c` | Shared green on both players weakens ownership. |
| Success/regen | `#4ade80`, bright `#86efac`, deep `#16a34a` | Too close to stamina; relies on glow and timing for distinction. |
| Fighter accents | dynamic mawashi colors | Underused in the dominant current HUD; Direction B uses them as controlled ownership marks. |
| Legacy indigo | `#1f2a4d`, bright `#3a4a85` | Marked deprecated but remains available, increasing palette drift. |

| Material category | Current vocabulary | Decision |
|---|---|---|
| Gradients | jade stamina depth, blue posture depth, black/gold rank, icon tiles, rail lacquer, result flash/haze/brush, DayCard gold/snow | Too many materials. Retain structural flat fields, meter depth, and one event accent. |
| Borders | 1–4 px dark/cream/gold hairlines, inset highlights, state-colored frames | Keep one structural hairline plus a semantic state edge. |
| Radii | HUD 1–4 px; power/boon tiles 3–4 px; stones/seals 50%; irregular 25–80% result splashes; larger rounded match cards | Circles, tiles, splashes, and cards currently imply different products. |
| Shadows | hard combat shelf; soft 10–18 px display shadows; meter inset/outer glows up to 30 px; card ambient shadows | Keep the hard text shelf; remove permanent meter bloom and redundant glows. |
| Textures | procedural film grain, brush/splash shapes, seals/kanji, rope, stones, rank motifs | Limit each component to one or two semantically valid motifs. |
| Filters | map `brightness(.86) saturate(.95) url(#scene-grade) blur(1.35px)`; cooldown grayscale; HUD state brightness/saturation; crowd grade; drop-shadows | Animated filter on HUD state and transformed/large layers is the primary paint risk. |
| Blend/blur | rays `screen`, grain `overlay`, ray blur 9 px, dohyo shadow blur about 14 px; one match prompt backdrop blur | Use blend modes only for atmosphere; backdrop blur is not a core HUD material. |

### Motion

| Register | Current durations | Curves / behavior | Audit |
|---|---|---|---|
| HUD ordinary | roughly 180–500 ms | ease-out fill, ghost, refund and impact transitions | Appropriate if only one accent owns a state change. |
| HUD critical loops | danger 0.7 s, gassed frame 1.6 s, posture break 0.6 s, slash drift 5 s | ease-in-out/linear infinite; some animate filter | Too many simultaneous continuous owners. |
| Mechanical rail | 1.5 s total; 0.18–0.26 s in, 0.28 s out, 0.18 s replacement | enter near `cubic-bezier(.2,.72,.2,1)`; hard ease-in replacement | Sound replacement semantics; visible hold can tighten. |
| Hype | 1.25 s total; 0.16–0.30 s accents, 0.24 s out | press/spring near `cubic-bezier(.18,.85,.22,1)` | Scale is right; decorative subanimations are excessive. |
| Ceremony | HANDS DOWN 2 s; HAKKI-YOI 1.8 s | gentle slide vs fast slam, both with full-screen support | Correct semantic contrast, inconsistent family/material. |
| Result | 3 s composition, 0.6 s flash | stamp `cubic-bezier(.16,1,.3,1)`, brush and haze on ease-out | Conclusive but stacks too many concurrent effects. |
| Match flow | 0.38–0.8 s entrances; loading/breathe loops 1.15–1.5 s | mix of ease, broadcast cut, and overshoot springs up to `1.56` | Needs named role curves and fewer perpetual loops. |
| Global lens texture | grain shifts every 0.6 s in six steps | infinite transform | Low opacity but permanent; disable motion in reduced mode. |

The code contains many near-duplicate curves in the range `cubic-bezier(0.16–0.22, 0.7–1.2, 0.2–0.4, 1)` without named semantic roles.

### Layer and responsive tokens

| Layer | Current z-index | Ownership |
|---|---:|---|
| Lens frame | 198 | fixed edge frame |
| Grain / perfect flash | 199 | lens texture / brief flash |
| Player-info HUD | 200 | all persistent mandatory and decorative HUD |
| Ring props | 201 | gyōji and baskets |
| Side callouts | 202 | Tier 1/2 reads |
| Actors | 205 | fighters and actor VFX |
| Cinematic dim | 206 | KO focus |
| Main HUD | 210 | ceremony, results, match overlays |
| Danger/result internals | 999–1001 inside host | local full-screen dominance |

See `PRESENTATION_LAYER_MAP.md` for coordinate spaces and the required essential/decorative split.

| Responsive mechanism | Current values | Risk |
|---|---|---|
| Size container | `.game-container { container-type: size; }` | Good scaling anchor. |
| Container units | widespread `cqw`/`cqh` plus `clamp()` | Useful, but mixed px/rem floors create uneven scale. |
| Production `@container` rules | none found in audited production files | Aspect-specific composition is handled indirectly rather than explicitly. |
| Common viewport breakpoint | 900 px in rails, hype, result, MatchOver | One breakpoint covers devices with different aspect ratios. |
| Narrow result breakpoint | 600 px | Relevant to windowed/portrait use, not Steam Deck. |
| Steam Deck exact | 1280×800 | Exact-match rules can miss scaled/windowed 16:10. |
| Compact desktop | max 1366×900 | Overlaps exact Steam Deck and local component rules. |
| Portrait warning | orientation portrait and max 900 px | Match is landscape-first. |
| Lab container tests | max aspect ratio 1.7 and max width 760 px | Stage 1 only; demonstrates a safer aspect-aware direction. |

## Performance audit

### Existing protections to preserve

- `Game.jsx` warms Noto Serif JP and styled presentation paths before first visible use.
- `SumoAnnouncementBanner` and `SumoHypeStamp` use stable exported durations and explicit replacement/restrike phases.
- Combat callouts generally animate transform/opacity rather than layout.
- Cinematic camera grading has comments and code paths designed to avoid expensive filter work on the transformed scene.

### Risks

- Full-screen `screenFlash`, result haze, vignette, film grain, god rays, cinematic dim, danger overlay, and parry overlay can overlap in the same compositing window.
- Several components animate large shadows, filters, or full-screen gradients; the effect is multiplied at 1440p.
- Persistent HUD danger/gassed/regen treatments include continuous animations. These communicate state, but simultaneous pulses create noise and paint cost.
- Styled-component keyframes and first-use mounting remain hitch-sensitive despite warmup; any new family must use static definitions and keep warmup coverage.
- Multiple event wrappers per fighter can duplicate effect ownership if a world effect and HUD effect both mount for the same event.
- Permanent `will-change` appears on match-adjacent cards and animated pieces. It should be scoped to short active windows in production implementation.
- `UiPlayerInfo.jsx`'s combined state and style responsibilities increase remount/regression risk; visual extraction should not replace its proven smoothing or timer semantics.

## Responsiveness and accessibility

- Stage 1 evidence covers 1280×720, 1280×800, 1920×1080, and 2560×1440, plus long names, side inversion, bright/dark contrast, maximum BASHO density, overlap, and reduced motion.
- Current weak points are small boon labels, tracked micro-labels, corner power-up density, center-day competition, and long-name compression.
- Mandatory state relies too much on green/red/blue alone. Meter shape, labels, segments, and state text must carry equivalent meaning.
- The current layer stack cannot guarantee HUD readability against actors/props.
- Existing flashes are brief, but multiple event layers can combine. Collision policy must suppress lower tiers during ceremony/results.
- Reduced motion needs alternate readable holds/opacity cuts, not globally zeroed durations.
- Side inversion must change ownership direction and callout origin without reversing text or changing gameplay identity.

## Mode parity

- `UiPlayerInfoBasho.jsx` wraps the core `UiPlayerInfo`, so Custom/CPU/BASHO already share the main HUD primitive.
- BASHO injects `BashoDayHud` and `BashoBoonStrip`; it does not need a separate match-HUD language.
- PreMatch and MatchOver are shared match-flow surfaces. DayCard and power-up selection/reveal are BASHO-specific but should use the same typography, color roles, and transition registers.
- Stage 1 fixtures model mode differences as data, not separate render trees.

## Direction acceptance

| Criterion | A | B | C |
|---|---:|---:|---:|
| Immediate readability | Strong | **Strongest** | Medium |
| Fit with illustrated arena | Strong | **Strongest** | Medium |
| Pumo-specific identity | Medium | **Strongest** | Strong |
| State scalability | Strong | **Strongest** | Medium |
| Motion clarity | Strong | **Strongest** | Medium |
| Implementation/performance risk | Lowest | **Controlled** | Highest |
| Steam Deck durability | Strong | **Strong** | Medium |
| Long-session restraint | Strong | **Strongest** | Weakest |

Direction B wins because it changes the silhouette and hierarchy enough to solve the actual problem while keeping event effects subordinate to penguin combat. Its two motifs—broadcast wing cuts and restrained ceremonial fan/rope rhythm—are sufficient. Direction C should donate only selected transition energy after the foundation is approved.

## Stage 1 evidence and known limits

- Comparison matrices: `premium-match-ui-evidence/direction-a-matrix.png`, `direction-b-matrix.png`, `direction-c-matrix.png`.
- Direct side-by-side states: files beginning `abc-` in `premium-match-ui-evidence/`.
- Motion samples: `direction-a-motion.mp4`, `direction-b-motion.mp4`, `direction-c-motion.mp4`.
- Flow, contrast, viewport, and controls evidence: `direction-b-flow.png`, `direction-b-contrast.png`, `direction-b-resolutions.png`, `presentation-lab-controls.png`.
- The laboratory is a visual/state simulator, not a gameplay integration test.
- Static crowd fixtures intentionally avoid production crowd animation and depth-of-field complexity.
- Frame stepping changes a deterministic animation-delay scrub; it is useful for visual inspection but is not a full Web Animations timeline debugger.
- Motion replay is available in the lab; capture instructions are in `PREMIUM_MATCH_UI_ROADMAP.md`.

