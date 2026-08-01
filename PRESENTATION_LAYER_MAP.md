# Pumo Pumo Presentation Layer Map

## Current runtime stack

`Game.jsx` creates one screen-fixed container and three camera-synchronized world hosts. `GameFighter.jsx` portals UI and props into those hosts rather than relying only on component-tree order.

Highest visible layer:

```text
z 210  #game-hud
       ceremony, RoundResult, centered/local prompts, KO and match-level overlays
       danger-vignette is z 999 inside this host

z 206  .cinematic-dim
       screen-fixed radial dim; opacity-only KO framing

z 205  .game-actors
       both fighters and actor-owned VFX/particles; camera transform

z 202  #game-hud-callouts
       mechanical side rails and hype stamps; screen-fixed

z 201  #game-ring-props
       gyōji and salt baskets; camera transform

z 200  #game-hud-info
       entire UiPlayerInfo / UiPlayerInfoBasho; screen-fixed

z 199  .film-grain
       screen-fixed 150% procedural SVG grain; continuously translated
       perfect-parry flash also uses z 199 as a container pseudo-element

z 198  .game-container::after
       screen-fixed lens edge/letterbox

world    .game-scene
         map, crowd, dohyo, snow, arena-lighting (local z 6), god-rays (local z 7)
```

Relevant source:

- Host creation and ordering: `client/src/components/Game.jsx`
- Portal destinations: `client/src/components/GameFighter.jsx`
- Global stacking values and camera transforms: `client/src/App.css`
- HUD's own internal stacking: `client/src/components/UiPlayerInfo.jsx`

## Ownership by host

| Host | Coordinate space | Current owners | Correct responsibility |
|---|---|---|---|
| `.game-scene` | World/camera | arena map, crowd, dohyo, world snow, lighting, rays | Illustrated environment and effects attached to it. |
| `#game-ring-props` | World/camera | gyōji, salt baskets | Non-fighter stage props that must track the camera. |
| `.game-actors` | World/camera | fighters, reflections/shadows, actor particles and VFX | Fighters and effects whose position is part of combat. |
| `#game-hud-info` | Screen | whole persistent HUD | Currently mixes mandatory data and decorative frame. |
| `#game-hud-callouts` | Screen | Tier 1 rails and Tier 2 hype stamps | Side-owned event direction and text. |
| `.cinematic-dim` | Screen | cinematic KO focus | One explicitly owned full-screen dim layer. |
| `#game-hud` | Screen | ceremony, results, danger, local prompts, match overlays | Events that must dominate the whole match. |
| Match-adjacent roots | Screen | PreMatch, DayCard, MatchOver, power-up screens | Interactive/flow surfaces outside normal fight hierarchy. |

## Confirmed failure mode

The current ordering does exactly what its comments describe: **the complete `UiPlayerInfo` is below ring props, callouts, and fighters.** This is visually attractive when a penguin crosses decorative framing, but it also permits the actor or a stage prop to cover:

- player identity;
- rank/local ownership;
- stamina;
- posture;
- score/day;
- power-up availability;
- BASHO boon state.

Those are Tier 0 mandatory reads. Treating the whole HUD as scenery is therefore not safe. The answer is not to move the entire HUD above everything: that would make broad opaque wings paint over jumps and particles and would flatten the authored world/HUD interaction.

## Required Stage 2 seam

Direction B should split presentation, not state ownership:

```text
under actors
  HUD structural silhouette, wing cuts, low-value ornament
  callout direction wedge / impact trail where intentional

world
  props and fighters

over actors
  identity glyphs, meter fills/labels, score/day, availability icons
  mechanical callout text and its minimum contrast backing

top event
  ceremony, result, match transitions
```

A practical future stack within the existing container:

| Proposed band | Suggested relation | Content |
|---|---|---|
| HUD decoration | remain near z 200 | Wing/fan/rope structure allowed to pass behind fighters. |
| Props | z 201 | Existing camera-synchronized props. |
| Callout decoration | z 202 | Side wedges/trails that may intersect actors. |
| Actors | z 205 | Existing fighter host. |
| Cinematic focus | z 206 | Existing opacity-only dim. |
| Essential HUD | between dim and main event host | Text, meter state, day/score, power-up/boon availability. |
| Essential callout text | above actors, below ceremony/result | Minimum readable mechanical message. |
| Ceremony/result | existing z 210 host | Tier 3–5 event presentation. |

Exact numeric values should be tokenized only after Direction B approval. The architectural rule is more important than the numbers: **decorative mass may cross behind actors; mandatory information may not.**

## Portal rules

1. Gameplay state remains in `Game.jsx`, `GameFighter.jsx`, and the proven HUD hooks.
2. A visual split must not duplicate the state machine. One state model can render into two presentational portal bands.
3. World coordinates belong only to scene/props/actors. Screen-space HUD elements must not inherit camera scale or shake.
4. A world effect with readable text should be split only when occlusion makes the rule unreadable. Keep the burst in world space and the semantic text in screen space.
5. PreMatch hiding should continue to use mounted hosts with opacity/visibility so portalled components do not lose state unexpectedly.
6. The production lab must not create any of these hosts or connect to gameplay. It is a separate deterministic renderer.

## Full-screen compositing ownership

| Layer | Current behavior | Audit decision |
|---|---|---|
| Arena map grade | `--arena-map-filter` includes brightness, saturation, SVG grade, blur | Keep one map grade; profile blur while camera scales. |
| Crowd grade | Per-sprite depth and lighting in `CrowdLayer.jsx` | Keep depth ownership here; do not add crowd vignette. |
| `.arena-lighting` | Warm key, cool bounce, edge falloff | Correct single owner for world lighting; tune later, do not duplicate. |
| `.god-rays` | Local z 7, screen blend, low opacity | Atmosphere only; reduce/hold during loud events if needed. |
| Lens frame | Fixed z 198 radial edge | Keep subtle and static. |
| Film grain | Fixed z 199, 0.6 s infinite stepped translation | Question continuous animation benefit; static/subtler reduced-motion alternative required. |
| Perfect-parry flash | Container pseudo-element at z 199, 0.34 s | Cheap opacity flash, but currently below HUD/actors; collision with grain should be profiled. |
| Cinematic dim | Fixed z 206, opacity only | Good performance correction; preserve. |
| Danger vignette | Inside main HUD, z 999, infinite pulse | State-useful but high priority; suppress during result/flow and reduce-motion. |
| Announcement flash/vignette | Styled layers inside ceremony | Consolidate with taxonomy so HANDS DOWN and HAKKI-YOI do not stack redundant full-screen layers. |
| Result flash/haze | Styled layers in `RoundResult.jsx` | Result owns the screen temporarily; lower tiers must be removed first. |

## First-use performance

`Game.jsx` includes a hidden `FontWarmup` and additional warm/re-warm scheduling specifically to avoid CJK font rasterization and styled-component first-mount stalls. Preserve this behavior until static production primitives prove they no longer need it. New visual primitives should:

- define keyframes and styled components at module scope;
- avoid dynamic keyframe construction;
- warm one representative element per event tier;
- use stable keys only where replay/remount is semantically required;
- never warm by mounting full-screen visible effects;
- keep camera transforms on the existing three synchronized hosts.

## Stage 1 isolation

The presentation lab is reached only through the development-gated branch in `client/src/main.jsx`. It dynamically imports `client/src/presentationLab/PresentationLab.jsx` and does not render `App`, `Game`, `GameFighter`, socket flows, or the production portal architecture. Its z-indexes model visual priority only; they cannot mutate production gameplay or layering.

