# Pumo Pumo Match UI State Matrix

This matrix records production semantics before any renderer replacement. “Lab” means the state has a deterministic Stage 1 visual fixture; it does not imply production behavior has been rewritten.

## Persistent HUD and meters

| State | Production owner / trigger | Current presentation behavior | Stage 1 fixture | Production requirement |
|---|---|---|---|---|
| Full stamina | `UiPlayerInfo.jsx`: `player1Stamina`, `player2Stamina` | Dominant glossy green mirrored bars | `neutral` | Quiet baseline; preserve opposing fill direction. |
| Stamina damage | Same props, clamped 0–100 | Fill snaps down with impact feedback | `damaged` | Damage must read before ornament. |
| Trailing/ghost damage | Local refs/state and delayed catch-up in `UiPlayerInfo.jsx` | Pale trailing fill after a hit | `damaged` | Preserve delay/catch-up semantics; renderer may change material only. |
| Heavy-hit response | Impact counters and stamina-delta threshold in `UiPlayerInfo.jsx` | Frame shake/strike feedback | `damaged` visual approximation | Keep short and transform-based; do not move labels off baseline. |
| Regeneration | Stamina increase detection and regen timers in `UiPlayerInfo.jsx` | Leading-edge glow with throttled display increase | `recovering` visual approximation | Direction must remain clear without relying on green alone. |
| Parry refund | `player*ParryRefund`, local replay key | 0.5 s refund flash | event fixture `perfect` plus neutral HUD | Keep distinct from ordinary regen; preserve key/remount semantics. |
| Stamina danger | Derived threshold in `UiPlayerInfo.jsx` | Vermilion frame/fill and 0.7 s infinite frame pulse | `danger` | One restrained state cue; no stacked flashing. |
| Gassed | `player*IsGassed` | Alarm pulse, frame pulse, slash drift, stamp | `gassed` | Unmistakable but not four simultaneous loops; add text/shape cue. |
| Recovery / second wind | Gassed→not-gassed transition detection | 0.7–0.8 s recovery burst/text | `recovering` | One clear transition, then return to quiet baseline. |
| Match-over meter state | `matchOver` | Slower danger/gassed animation; HUD retained | `matchOver` | Freeze or calm nonessential loops behind result. |
| Normal posture | `BalanceGauge.jsx`: `balance` | Slim canvas gauge below stamina | `neutral` | Visually related to HUD but differentiated by rhythm/label. |
| Posture danger | Derived at `< 15` in `UiPlayerInfo.jsx` | Canvas danger palette | `postureDanger` | Use shape/label as well as color. |
| Posture broken | `player*PostureBroken` | 0.6 s infinite shell pulse | `postureBroken` | Strong break cue; result/ceremony must suppress the loop. |
| Posture gain | `player*BalanceGain` replay timestamp | 700 ms canvas/track pulse | represented by `recovering`; no temporal scrub fixture | Preserve server timestamp as replay key. |
| Posture drain | `player*TipDrain` replay timestamp | 420 ms bite plus remounted drain flash | represented by `damaged`; no temporal scrub fixture | Keep immediate and subordinate to hit VFX. |
| Deep-grip ownership | `player*HasDeepGrip` | Gauge chip: `DEEP GRIP` | `deepGrip` left/hold | Ownership must be explicit, not just a gauge color. |
| Deep-grip threat | Opponent ownership derived by side | Gauge chip: `EXPOSED` | `deepGrip` right/threat | Distinguish threat from ownership in wording and direction. |
| Shove advantage | `player*ShoveLead` | Tactical state adjacent to gauge | `clinchShove` (`PUSH`) | Must show responsible side and remain readable in clinch density. |
| Shove disadvantage | Same | Mirrored tactical state | `clinchShove` (`BACK`) | Pair with advantage; do not add another meter. |
| Shove even/none | `null` or equal semantic state | No tactical chip | `neutral` | Absence should restore stable layout without jump. |

## Power-ups and BASHO

| State | Production owner | Current behavior | Stage 1 fixture | Requirement |
|---|---|---|---|---|
| Empty slot | `player*ActivePowerUp = null` | Dark square slot | `neutral` | Intentional empty state; low visual weight. |
| Active power-up | Active type from shared game state | Gradient square icon tile | `activePowerUp` | Preserve icon recognition; integrate slot with wing silhouette. |
| Cooldown | snowball/army cooldown props | Dim/grayscale treatment | `cooldown` | Use icon plus explicit cooldown state; not color alone. |
| Multiple charges | throws/spawns remaining props | Numeric badge | `cooldown` | Keep count controller-distance readable. |
| Single charge | same | Numeric badge or available state | `cooldown` right side | Avoid ambiguous “1” overlap with icon. |
| BASHO slot unavailable | `bashoPowerUpSlots` with no applicable power-up | N/A/empty state in core HUD | neutral/BASHO fixtures cover empty vs active, not literal `N/A` | Add exact N/A fixture before Stage 3 integration. |
| BASHO active boon | `UiPlayerInfoBasho.jsx` → `BashoBoonStrip.jsx` | Small icon/chip strip with deal-in | `basho` | Show only combat-relevant shorthand during a bout. |
| BASHO passive boon | drafted/opponent power-up arrays | Same strip language | `basho` | Do not become inventory bar; details belong in DayCard. |
| Maximum boon density | drafted/opponent arrays | Width and microtype pressure | `basho` representative two-per-side | Add actual configured maximum before Stage 3 QA. |
| BASHO day | `BashoDayHud.jsx` via `centerContent` | Center day numeral/label | `basho` day 12 | One- and two-digit values must not resize wings. |

## Identity, score, orientation, and density

| State | Production behavior | Stage 1 coverage | Finding / requirement |
|---|---|---|---|
| Actual P1 identity | `UiPlayerInfo.jsx` hardcodes `PLAYER 1`; there is no `player1Name` prop | Lab uses named fixture | Confirmed semantic gap. Stage 3 must source actual display identity without changing gameplay ownership. |
| Actual P2 identity | `player2Name`, default `PLAYER 2` | Lab uses named fixture | Asymmetry should be removed at renderer boundary. |
| Local player left | `isPlayer1Local = true`; local marker logic | default lab side | Keep one persistent local cue. |
| Local player right | `isPlayer1Local = false` | `Invert sides` control | Ownership, fill direction, and callout origin must invert together. |
| Actor “You” marker | Rendered in game world | Arena lab marker | Useful for spatial acquisition; avoid duplicating it twice in the top HUD. |
| Rank present | optional rank labels; BASHO can place in top marks | all lab HUD states | Secondary to identity and stamina. |
| Rank absent | null rank labels | not separately captured | Layout must collapse without leaving an ornamental hole. |
| Score zero | `roundHistory` / top-mark render helpers | available by editing fixture only | Add direct zero-score fixture before Stage 3 QA. |
| Score one | round history / top marks | `neutral` | Marks should fill symmetrically from identity outward. |
| Score maximum | match rules / round history | `matchOver` representative 2–1 | Verify actual configured maximum before Stage 3. |
| Short names | production defaults | normal lab mode | Stable baseline. |
| Long names | P2 name can be long; P1 currently cannot | `Long names` control | Must clamp/truncate deliberately without shrinking meter labels. |
| Day 1–9 | BASHO center content | `neutral` day 6 | Baseline. |
| Day 10+ | same | `basho` day 12 | Two digits covered. |
| 16:9 desktop | container-query HUD | 1280×720, 1920×1080, 2560×1440 presets | Required comparison captures complete. |
| 16:10 Steam Deck | global and local compact rules | 1280×800 preset | Boon and micro-label readability is limiting case. |
| Bright arena | same HUD over brighter grade | `Bright` contrast control | Mandatory text needs structural backing independent of world grade. |
| Dark arena | same HUD over darker grade | `Dark` contrast control | Secondary labels cannot collapse into frame. |

## Mechanical and actor-anchored event states

| Event | Production component / path | Current register | Lab fixture |
|---|---|---|---|
| COUNTER HIT | `CounterHitEffect.jsx` → `SumoAnnouncementBanner` | Side mechanical rail | `counterHit` |
| PUNISH | `PunishBannerEffect.jsx` → rail | Side mechanical rail | `punish` |
| RESISTED | `ClinchCalloutEffect.jsx` → rail | Side mechanical rail | `resisted` |
| GRAB BREAK | `GrabBreakEffect.jsx` → rail | Side mechanical rail | `grabBreak` |
| COUNTER THROW | `ClinchCalloutEffect.jsx` → rail | Side mechanical rail | `counterThrow` |
| DEEP GRIP | `ClinchCalloutEffect.jsx` → rail | Side mechanical rail | `deepGrip` |
| COUNTER GRAB | `CounterGrabEffect.jsx` → rail plus clamp burst | Rail + world burst | `counterGrab` |
| GRAB TECH | `GrabTechEffect.jsx` → rail/world effect | Mechanical read | `grabTech` |
| MATADOR BREAK / GORED | `GoredBannerEffect.jsx` and `SumoHypeStamp` config | Current code straddles rail/hype semantics | `matadorBreak` |
| CLAMPED | `GripPromptEffect.jsx` | Local actor-anchored prompt | `clamped` |
| NOT ENOUGH STAMINA | `GassedEffect.jsx` | Centered local action-denied prompt | `noStamina` |
| PERFECT | perfect-parry path → `SumoHypeStamp` | Hype stamp | `perfect` |
| PERFECT BRACE | `PerfectBraceEffect.jsx` → hype stamp | Hype stamp | `perfectBrace` |
| MATADOR | `MatadorSuccessEffect.jsx` → hype stamp | Hype stamp | `matador` |

World-space strike, parry, grab, grip, clinch, and particle effects are not all HUD messages. They should retain world ownership unless they communicate a rule the player cannot infer from animation alone.

## Ceremony, result, and match flow

| Moment | Production owner | Current duration / behavior | Lab fixture |
|---|---|---|---|
| Normal combat | `Game.jsx` / `GameFighter.jsx` | Persistent HUD and world effects | `fight` |
| HANDS DOWN | `SumoGameAnnouncement.jsx` `tewotsuite` | 2.0 s held-breath rise with flash/brush | `handsDown` |
| HAKKI-YOI | `SumoGameAnnouncement.jsx` `hakkiyoi` | 1.8 s slam/release with flash/vignette/rule | `hakkiYoi` |
| Force out | `RoundResult.jsx` config | 3.0 s result composition | `resultForce` |
| Overarm throw | same | technique-specific copy | `resultThrow` |
| Long result | same | long-string stress | `resultLong` |
| Victory | result/match flow state | winner treatment | `victory` |
| Defeat | result/match flow state | loser treatment | `defeat` |
| PreMatch | `PreMatchScreen.jsx` | fighter load/readiness and VS presentation | `preMatch` |
| BASHO DayCard | `DayCard.jsx` | day, opponent, record, boons/actions | `dayCard` |
| Power-up selection/reveal | `PowerUpSelection.jsx`, `PowerUpReveal.jsx` | match-adjacent BASHO flow | inventoried; not separately rendered in Stage 1 probe |
| MatchOver | `MatchOver.jsx` | conclusion card and actions | `matchOver` |
| Rematch / next day | `Game.jsx` flow ownership | renderer remount/state reset risk | not simulated; Stage 7 integration case |

## Stress and collision fixtures

- `Overlap test` shows simultaneous opposing callouts.
- `Rapid repeat` cycles representative Tier 1 and Tier 2 events to expose replacement/restrike problems.
- Replay remounts the selected event/moment with a deterministic key.
- Pause, 0.25×, 0.5×, 1×, and frame-step scrub are available.
- Reduced motion replaces large travel/rotation with shorter opacity/scale communication.
- Result and match-flow fixtures intentionally demonstrate the higher-tier suppression context; the production collision policy is specified in `MOTION_AND_EVENT_TAXONOMY.md`.

