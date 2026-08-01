# Pose Geometry Audit — PUMO PUMO !

Programmatic scan of gameplay fighter sprites. Automated alpha bounds are **estimates**, not final authored metadata.

## How to regenerate

```bash
# From repo root
node tools/audit-pose-geometry.js
node tools/audit-pose-geometry.js --json > tools/pose-geometry-report.json
node tools/audit-pose-geometry.js --viz   # writes tools/pose-geometry-viz/*-audit.png
```

Alpha threshold: 16. Design assumptions mirrored from server: canvas 960, display width `12.30%` of 1280, `SPRITE_PX_TO_WORLD = 0.164`.

Visualization legend: green = opaque bounds, yellow = sole line, cyan = canvas center/root guess, orange = alpha centroid, magenta = frontmost silhouette.

---

## 1. Dimension inventory (highlights)

| Category | Examples | Canvas |
|----------|----------|--------|
| Target gameplay canvas | ready, slap hit frames, palm, blocking, grabbing | **960×960** |
| Legacy / oversized | `slapAttack1.png`, `slapAttack2.png`, `throwing.png`, `attempting-grab-throw.png`, `pumo-waddle.png` | **1024×1024** |
| Undersized placeholders | `hit.png`, `at-the-ropes.png`, `bow.png`, `grab-attempt.png` | **480×480** |
| Mid-size placeholders | `crouch-stance.png`, `is-attempting-pull.png` | **600×600** |
| APNG reaction | `is_perfect_parried.png` | (animated; scan still reports raster bounds) |

**Risk:** Server tip math always divides by **960** (`strikeContact.js` `SPRITE_PX_TO_WORLD`). Display CSS always uses **12.30%** width with `aspect-ratio: 1`. Non-960 sources are scaled to the same CSS box, so **pixel tip constants only match poses authored on 960**. Using a 1024 slap legacy asset as a contact pose would desync tip world length.

---

## 2. Tip constant vs measured opaque tip

Sprites face left; tip ≈ canvasCenterX − frontmostOpaqueX.

| Pose (live contact art) | Measured tip px | `constants.js` live | Δ |
|-------------------------|-----------------|---------------------|---|
| `slap-attack-1-hit-frame.png` | 458.5 | `STRIKE_TIP_SLAP1_SPRITE_PX=478` | **−19.5** |
| `slap-attack-2-hit-frame.png` | 477.5 | 478 | −0.5 |
| `attack.png` (charged) | 424.5 | 425 | −0.5 |
| `palm-thrust.png` | 437.5 | 438 | −0.5 |

**Interpretation:** Charged, palm, and slap2 tip rails are tightly art-aligned (confidence: high). Slap1’s live constant is ~20px longer than hard-alpha tip — likely soft-edge / intentional slack from playtest. **Do not “fix” to 458 without playtest** — changing it would alter slap1 reach and could regress the improved feel.

`palm-thrust-smear.png` tip measures ~469.5 — longer than active palm; smear is presentation-only if active frame drives connect.

---

## 3. Ground-anchor / sole consistency

Typical grounded 960 poses: `padB` (transparent under feet) ≈ **19–38px** (~2–4% of canvas). Client sole pivot `FIGHTER_SOLE_TRANSFORM_ORIGIN = 50% calc(100% - 2.1%)` matches that band.

| Pose | padB | Issue |
|------|------|-------|
| Most idle/ready/slap-hit/palm/block | 19–38 | OK |
| **`attack.png` (charged flight)** | **223** | **Intentional flying headbutt** — elevated feet are flight art, not a grounding defect. Do **not** sole-correct. |
| **`dodging.png`** | **162** | Aerial/dodge lean — not ground-snapped |
| **`pumo-flap-1/2.png`** | **77 / 106** | Air poses; sole not ground-glued (expected if airborne) |
| `cinematic-throw-kill-landing.png` | 5 | Sole near edge; full-bleed belly |

**Charged headbutt note:** Extreme bottom padding on `attack.png` is expected for the flying headbutt. Phase 11 initially misclassified this as a sole-float defect (~33px correction); that correction was **removed**. Tip rails remain the contact source of truth; vertical separation from the dohyo during flight is intentional.

---

## 4. Transparent padding & horizontal bias

- Slap2 hit frame: strong left bias (`centroid.biasX ≈ -46`), front almost at canvas edge (`frontX=2`) — tip-sensitive; edge clip risk.
- `at-the-ropes.png` (480): front at 0, strong bias — rope pose geometry unreliable if treated as 960-normalized.
- `grabbing.png`: narrow opaque width (590) — clinch attach distance is a separate system; pushbox still uses uniform half-width 65×size.
- Idle/ready bodies are roughly centered; attack extensions reach forward (left).

---

## 5. Pose categories (for future metadata)

| Category | Poses | Default body idea |
|----------|-------|-------------------|
| Neutral grounded | idle, ready, tachiai, charging, recovering | Capsule ~ body half 65 world @ size 1; sole pad ~2.1% |
| Strike extension | slap hit 1/2, palm active, charged attack | Tip anchor + body hurt half; sole must be authored |
| Strike windup | palm/slap startup, smear | Shorter tip; may share pushbox |
| Defense | blocking, block-parry, raw-parry-success* | Guard plane / parry hand anchor |
| Aerial | flap1/2, dodging (rope active), slide-jump | No ground pushbox; landing footprint needed |
| Grapple | grabbing, clinch-planting, throw attempts | Clinch attach metadata, not strike tip |
| Reaction | hit (480), at-the-ropes (480) | Needs 960 rebuild + sole |
| Prone / cinematic | belly, throw-kill landing | Special ground rules |

---

## 6. Poses requiring manual overrides (candidates)

1. `attack.png` — flying headbutt (airborne); tip source of truth; **no** sole correction  

2. `slap-attack-1-hit-frame.png` — tip constant slack vs alpha  
3. `dodging.png` / flap frames — aerial sole  
4. All 480/600 assets — normalize to 960 before trusting pixel math  
5. `slapAttack1/2.png` (1024) — legacy; ensure gameplay never uses them for contact poses (hit frames preferred — currently true in `getImageSrc`)  
6. Clinch bodies — arm overlay alignment already special-cased  

---

## 7. Proposed metadata structure (PROPOSED — not implemented)

```json
{
  "poseId": "slap-attack-1-hit",
  "src": "slap-attack-1-hit-frame.png",
  "canvas": { "w": 960, "h": 960 },
  "root": { "x": 480, "y": 480 },
  "sole": { "yFromBottomPx": 25, "yFromBottomPct": 0.026 },
  "body": {
    "hurtHalfWidthWorld": null,
    "opaqueBoundsPx": { "minX": 21, "maxX": 850, "minY": 113, "maxY": 934 }
  },
  "contact": {
    "tipFromCenterPx": 458,
    "tipRole": "strikeForward",
    "parryHand": null
  },
  "push": { "useDefaultHalf": true },
  "flags": { "airborne": false, "grounded": true }
}
```

Server would convert tip px → world via shared scale; client sole % would read `sole.yFromBottomPct` instead of a global 2.1%.

---

## 8. Risks of automated extraction

- Soft airbrush tips underestimate reach (slap1 −19.5 case).
- Motion blur / smear frames invent false tips.
- Drop shadows / outline glow expand opaque bounds.
- Facing-left assumption breaks if a pose is authored facing right.
- Non-960 canvases need explicit scale before comparison.
- Centroid ≠ mass/hurt center for sumo silhouettes.

**Authoring workflow recommendation:** artist places markers (sole, tip, hurt center) on 960 guides → export JSON → CI runs `audit-pose-geometry.js` as a diff check against markers (warn-only), never auto-overwrite playtest-tuned tip constants.

---

## 9. Server/client unit consistency

| Quantity | Unit | Source |
|----------|------|--------|
| Fighter `x/y` | Design world px (1280×720 space) | Server sim |
| `HITBOX_DISTANCE_VALUE` | World px half-width | `constants.js` |
| Tip constants | Source px from canvas center | `constants.js` / art |
| Tip → world | `tipPx * (1280*0.123)/960` | `strikeContact.js` |
| Display width | 12.30% of stage | CSS |
| Sole pivot | 2.1% from bottom | CSS constant |
| `sizeMultiplier` | Scales pushbox/hurt half, **not** sprite width or tip | Server + comments |

---

*Generated artifacts: `tools/pose-geometry-report.json`, `tools/pose-geometry-viz/`.*

---

## Phase 11 status

Client pose registration is implemented behind **`FIGHTER_POSE_GEOMETRY_V2` (default ON — manually approved)**. Rollback: `FIGHTER_POSE_GEOMETRY_V2=0`. See `CHARACTER_POSE_GEOMETRY_PHASE.md`. Alpha bounds remain diagnostic only; V2 does not rewrite assets. **No active sole corrections** — charged headbutt padB must not drive grounding.
