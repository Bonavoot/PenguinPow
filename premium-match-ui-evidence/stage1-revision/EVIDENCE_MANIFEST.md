# Stage 1 revision evidence manifest

Every file here was rendered from the dev-only presentation lab at
`client/src/presentationLab/`, driven by `captureRevisionEvidence.mjs` against the
client dev server. No production component was rendered, imported, or modified to
produce any of it.

Directions under test are **B2 — Ink Basho Broadcast** and **B3 — Open Arena Manga**.
Directions A, B, and C are preserved unchanged for historical comparison and their
evidence remains one level up in `premium-match-ui-evidence/`.

## Comparison sheets

| File | Shows |
|---|---|
| `b2-b3-neutral.png` | Neutral HUD, round 6, both candidates at 1440×810 |
| `b2-b3-danger-posture.png` | Low-stamina danger and posture-broken/gassed states |
| `b2-b3-names-inversion.png` | Long-name stress and inverted sides (local player on the right) |
| `b2-b3-loadout.png` | Active power-up, cooling-down power-up, and maximum representative BASHO boon density |
| `combat-event-system.png` | The five semantic event families with their real event strings, accent colors, and non-color edge marks |
| `callout-scale-comparison.png` | Ordinary informational read against a rare mastery read at true relative scale |
| `b2-b3-ordinary-collision.png` | Simultaneous opposing ordinary reads (COUNTER HIT / RESISTED) |
| `b2-b3-ceremony.png` | HANDS DOWN anticipation and HAKKI-YOI release |
| `b2-b3-round-result.png` | Short result (FORCE OUT) and long result (REAR PUSH OUT) |
| `basho-day-current-vs-revised.png` | Currently shipped dark BASHO Day above both revised treatments |
| `current-black-basho-day-reference.png` | The shipped screen, extracted from the supplied gameplay video and cropped free of browser chrome |
| `b2-b3-prematch-matchover.png` | PreMatch and MatchOver treatments |
| `b2-b3-resolutions.png` | 1920×1080 and 1280×800 (Steam Deck) |
| `b2-b3-contrast.png` | Bright arena, dark arena, and the actual arena grade |
| `historical-abc-day-card-regression.png` | Directions A, B, and C rendering the shared day-card changes unharmed |

## Full-resolution source captures

`frames/` holds the 47 unscaled captures behind the sheets above. Every frame is
1920×1080 except the two Steam Deck frames, which are 1280×800. Names follow
`<direction>-<state>.png`; the two system sheets are `event-family-sheet.png` and
`callout-scale.png`.

## Motion samples

`motion/` holds twelve deterministic H.264 samples at 30 fps, named
`<direction>-<register>-30fps.mp4`. Each covers a complete entrance, hold, and exit;
the information sample additionally shows same-side replacement.

| Register | Duration | Covers |
|---|---|---|
| `info-replacement` | 1.9 s | Ordinary acknowledgement, then a same-side COUNTER HIT → PUNISH cut |
| `mastery` | 1.7 s | A rare mastery read (PERFECT) |
| `hands-down` | 2.0 s | Ceremonial anticipation |
| `hakki-yoi` | 1.2 s | Decisive release into playable state |
| `round-result` | 2.6 s | Long RoundResult |
| `basho-day` | 3.0 s | Arena into the dark BASHO Day screen and back |

Frames are scrubbed deterministically through a CSS animation-delay offset rather than
captured in real time, so the samples are reproducible frame-for-frame.

## Reproducing

Start the client dev server, then run the harness described under
"Reproducing the revision evidence" in `PREMIUM_MATCH_UI_ROADMAP.md`.
