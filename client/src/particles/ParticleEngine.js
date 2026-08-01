import { DOHYO_LEFT_BOUNDARY, DOHYO_RIGHT_BOUNDARY } from "../constants";
import { DASH_SMOKE_SHEET_BASELINE_Y } from "../combatPresentation/movementSmoke";
import landingSmokeSheet from "../assets/landing-smoke-effect.png";
import straightUpSmokeSheet from "../assets/straight-up-smoke-effect.png";
import tiltedUpSmokeSheet from "../assets/tilted-up-smoke-effect.png";
import smokePuffSheet from "../assets/smoke-puff-effect.png";
import dashSmokeSheet from "../assets/dash-smoke-effect.png";
import chargedSmokeSheet from "../assets/charged-attack-smoke-effect.png";
import cinematicThrowLandSmokeSheet from "../assets/cinematicKill-throw-landing-smoke-effect.png";
import clampedEffectSheet from "../assets/clamped-effect.png";

const MAX_PARTICLES = 500;
const GAME_W = 1280;
const GAME_H = 720;

// ── Landing smoke sprite sheet ───────────────────────────────────────────────
// 1024x1024, a 4x4 grid of 256px frames read left→right/top→bottom. All 16
// frames hold content: a soft dust puff that blooms (frames ~4–6) then dissipates
// (→15). Loaded once as a raw Image; the engine draws the current frame's
// sub-rect per particle (see _renderParticle). Preloaded in fighterAssets too.
const landingSmokeImg =
  typeof Image !== "undefined" ? new Image() : null;
if (landingSmokeImg) {
  landingSmokeImg.src = landingSmokeSheet;
  if (typeof landingSmokeImg.decode === "function") {
    landingSmokeImg.decode().catch(() => {});
  }
}
const LANDING_SMOKE_COLS = 4;
const LANDING_SMOKE_ROWS = 4;
const LANDING_SMOKE_FRAMES = 16;
// Base on-screen footprint (GAME-space px). Dust reads wider than tall, so the
// puff is stretched horizontally to hug the ground like the old rings did.
const LANDING_SMOKE_SIZE = 110;
const LANDING_SMOKE_STRETCH = 1.6;
// Vertical placement of the puff center relative to the foot contact, as a
// fraction of the draw size. Positive = LOWER on screen (toward/below the feet),
// negative = higher. Tune this to sit the dust right at the feet.
const LANDING_SMOKE_Y_BIAS = -0.04;

// Spawn one animated dust puff at a foot contact point. `scale`/`alpha`/`maxLife`
// let each landing preset tune the punch while sharing one look. footY is already
// in canvas space (GAME_H - y - offset). Returns false if the sheet isn't decoded
// yet so callers can fall back if needed.
function spawnLandingSmoke(
  engine,
  footX,
  footY,
  { scale = 1, alpha = 1, maxLife = 0.5, delay = 0, behindDohyo = false } = {}
) {
  if (!landingSmokeImg || !landingSmokeImg.complete || !landingSmokeImg.naturalWidth) {
    return false;
  }
  const drawSize = LANDING_SMOKE_SIZE * scale;
  engine.spawn({
    x: footX,
    // Bias the center vertically so the puff sits at the feet (see Y_BIAS).
    y: footY + drawSize * LANDING_SMOKE_Y_BIAS,
    vx: 0,
    vy: 0,
    gravity: 0,
    drag: 1,
    size: drawSize,
    sizeEnd: drawSize * 1.1, // gentle grow; the sheet itself does most of the bloom
    alpha,
    alphaEnd: 0,
    // Pin rotation — spawn() defaults an unset rotation to a RANDOM angle, which
    // would draw each puff tilted/sideways. Frames are pre-oriented upright.
    rotation: 0,
    rotationSpeed: 0,
    ease: "outCubic",
    easeAlpha: "inCubic", // hold opacity, fade only the tail so it vanishes cleanly
    maxLife,
    stretchX: LANDING_SMOKE_STRETCH,
    delay,
    behindDohyo,
    sheet: landingSmokeImg,
    sheetCols: LANDING_SMOKE_COLS,
    sheetRows: LANDING_SMOKE_ROWS,
    sheetStart: 0,
    sheetEnd: LANDING_SMOKE_FRAMES - 1,
  });
  return true;
}

// ── Liftoff smoke sprite sheets (going airborne) ─────────────────────────────
// Two 1024x1024 4x4 grids of light-gray smoke:
//   • straight-up: neutral vertical plume (flap with no A/D held)
//   • tilted-up:   angled plume (flap while strafing A/D; also rope jump)
// The tilted sheet is drawn pointing one way and mirrored via a negative
// stretchX when the player goes the other direction.
function makeSmokeImg(src) {
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = src;
  if (typeof img.decode === "function") img.decode().catch(() => {});
  return img;
}
const straightUpSmokeImg = makeSmokeImg(straightUpSmokeSheet);
const tiltedUpSmokeImg = makeSmokeImg(tiltedUpSmokeSheet);

// Small drifting smoke puff (flap air-charge beats + S-key dive wisps). Unlike
// the landing/liftoff bursts these MOVE, so this just layers the animated sheet
// onto a normal moving particle. 4x4 grid; the cloud lifecycle lives in frames
// 4–15 (top row is stray droplets + a star, skipped).
const smokePuffImg = makeSmokeImg(smokePuffSheet);
const SMOKE_PUFF_COLS = 4;
const SMOKE_PUFF_ROWS = 4;
const SMOKE_PUFF_START = 4; // first real cloud frame (skip droplets/star row)
const SMOKE_PUFF_END = 15;

// The source art is a hollow cloud OUTLINE (transparent interior), which reads
// as a ring. This bakes a FILLED version once the image loads: for each frame we
// find the cloud's silhouette (pixels enclosed by the outline on both axes) and
// paint a soft fill there, then draw the original outline back on top. Result:
// a solid cloud body with the hand-drawn edge. Falls back to the raw outline
// until the bake finishes.
let smokePuffFilled = null;
const SMOKE_FILL_ALPHA = 0.72; // interior opacity relative to the outline
const SMOKE_FILL_RGB = [244, 244, 244];

function buildFilledSmokePuffSheet() {
  if (!smokePuffImg || typeof document === "undefined") return;
  const run = () => {
    const W = smokePuffImg.naturalWidth;
    const H = smokePuffImg.naturalHeight;
    if (!W || !H) return;
    const fw = W / SMOKE_PUFF_COLS;
    const fh = H / SMOKE_PUFF_ROWS;

    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = W;
    srcCanvas.height = H;
    const sctx = srcCanvas.getContext("2d");
    sctx.drawImage(smokePuffImg, 0, 0);
    let img;
    try {
      img = sctx.getImageData(0, 0, W, H);
    } catch {
      return; // tainted canvas (shouldn't happen for a bundled asset)
    }
    const px = img.data;

    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const octx = out.getContext("2d");
    const fill = octx.createImageData(W, H);
    const fp = fill.data;
    const TH = 24; // alpha threshold for "outline pixel"
    const [fr, fg, fb] = SMOKE_FILL_RGB;
    const fa = Math.round(SMOKE_FILL_ALPHA * 255);

    const iw = Math.round(fw);
    const ih = Math.round(fh);
    const total = SMOKE_PUFF_COLS * SMOKE_PUFF_ROWS;
    for (let frame = 0; frame < total; frame++) {
      const bx = Math.round((frame % SMOKE_PUFF_COLS) * fw);
      const by = Math.round(Math.floor(frame / SMOKE_PUFF_COLS) * fh);

      // 1) Barrier = outline pixels, dilated by 1px so anti-aliased gaps close.
      const barrier = new Uint8Array(iw * ih);
      for (let y = 0; y < ih; y++) {
        for (let x = 0; x < iw; x++) {
          if (px[((by + y) * W + (bx + x)) * 4 + 3] > TH) barrier[y * iw + x] = 1;
        }
      }
      const bar = new Uint8Array(iw * ih);
      for (let y = 0; y < ih; y++) {
        for (let x = 0; x < iw; x++) {
          if (!barrier[y * iw + x]) continue;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= ih) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= iw) continue;
              bar[ny * iw + nx] = 1;
            }
          }
        }
      }

      // 2) Flood "outside" inward from every border pixel that isn't barrier.
      const outside = new Uint8Array(iw * ih);
      const stack = [];
      const pushIf = (x, y) => {
        const i = y * iw + x;
        if (!bar[i] && !outside[i]) {
          outside[i] = 1;
          stack.push(i);
        }
      };
      for (let x = 0; x < iw; x++) {
        pushIf(x, 0);
        pushIf(x, ih - 1);
      }
      for (let y = 0; y < ih; y++) {
        pushIf(0, y);
        pushIf(iw - 1, y);
      }
      while (stack.length) {
        const i = stack.pop();
        const x = i % iw;
        const y = (i / iw) | 0;
        if (x > 0) pushIf(x - 1, y);
        if (x < iw - 1) pushIf(x + 1, y);
        if (y > 0) pushIf(x, y - 1);
        if (y < ih - 1) pushIf(x, y + 1);
      }

      // 3) Anything not reachable from the border is enclosed → fill it.
      for (let y = 0; y < ih; y++) {
        for (let x = 0; x < iw; x++) {
          if (outside[y * iw + x]) continue;
          const o = ((by + y) * W + (bx + x)) * 4;
          fp[o] = fr;
          fp[o + 1] = fg;
          fp[o + 2] = fb;
          fp[o + 3] = fa;
        }
      }
    }

    octx.putImageData(fill, 0, 0); // soft interior fill
    octx.drawImage(smokePuffImg, 0, 0); // crisp outline on top
    smokePuffFilled = out;
  };
  if (smokePuffImg.complete && smokePuffImg.naturalWidth) run();
  else smokePuffImg.addEventListener("load", run, { once: true });
}
buildFilledSmokePuffSheet();

function spawnSmokePuff(engine, cfg) {
  const sheet = smokePuffFilled || smokePuffImg;
  const ready = smokePuffFilled
    ? true
    : !!(smokePuffImg && smokePuffImg.complete && smokePuffImg.naturalWidth);
  if (!sheet || !ready) return false;
  engine.spawn({
    ...cfg,
    // Keep puffs upright — the sheet frames are pre-oriented, and spawn() would
    // otherwise default an unset rotation to a random angle.
    rotation: 0,
    rotationSpeed: 0,
    texture: null,
    sheet,
    sheetCols: SMOKE_PUFF_COLS,
    sheetRows: SMOKE_PUFF_ROWS,
    sheetStart: SMOKE_PUFF_START,
    sheetEnd: SMOKE_PUFF_END,
  });
  return true;
}

const LIFTOFF_SMOKE_SIZE = 150; // plumes read tall — bigger than the flat landing puff
const LIFTOFF_SMOKE_STRETCH = 1; // vertical plume: no horizontal flattening
// Vertical placement: the plume rises UP from the feet, so its center sits above
// the foot point. Positive = higher on screen (fraction of draw size).
const LIFTOFF_SMOKE_Y_LIFT = 0.28;
// NOTE: if a tilted plume leans the WRONG way for a given direction, flip the
// sign of the `flip` expressions in flapLiftoff / the liftoffSmoke preset below.

// Spawn one animated liftoff plume at a foot point. `tilted` picks the sheet;
// `flip` mirrors it horizontally; footY is already in canvas space.
function spawnLiftoffSmoke(
  engine,
  footX,
  footY,
  { tilted = false, flip = false, scale = 1, alpha = 1, maxLife = 0.55, yLift = LIFTOFF_SMOKE_Y_LIFT } = {}
) {
  const sheet = tilted ? tiltedUpSmokeImg : straightUpSmokeImg;
  if (!sheet || !sheet.complete || !sheet.naturalWidth) return false;
  const drawSize = LIFTOFF_SMOKE_SIZE * scale;
  // straight-up content starts a few frames in; tilted holds content from frame 0.
  const startFrame = tilted ? 0 : 2;
  engine.spawn({
    x: footX,
    y: footY - drawSize * yLift,
    vx: 0,
    vy: 0,
    gravity: 0,
    drag: 1,
    size: drawSize,
    sizeEnd: drawSize * 1.08,
    alpha,
    alphaEnd: 0,
    rotation: 0,
    rotationSpeed: 0,
    ease: "outCubic",
    easeAlpha: "inCubic",
    maxLife,
    stretchX: LIFTOFF_SMOKE_STRETCH * (flip ? -1 : 1),
    sheet,
    sheetCols: 4,
    sheetRows: 4,
    sheetStart: startFrame,
    sheetEnd: 15,
  });
  return true;
}

// ── Directional swoosh smoke sheets (dash + charged-attack lunge) ────────────
// Both are 1024x1024, 4x4 grids of a horizontal smoke swoosh that forms then
// dissipates (all 16 frames used). The art is baked pointing +x; a negative
// stretchX mirrors it for a leftward move. Each is a one-shot burst spawned at
// the move's launch point, so it stays put and trails behind as the fighter
// zips away. If a swoosh ever leans the wrong way, flip the `flip` expression.
const dashSmokeImg = makeSmokeImg(dashSmokeSheet);
const chargedSmokeImg = makeSmokeImg(chargedSmokeSheet);

// Per-move tuning. size = footprint (GAME-space px); stretch = horizontal widen;
// yLift = raise center off the floor (fraction of size); xBias = nudge behind
// the launch point (fraction of size).
// flipSign flips the sprite mirror relative to move direction (the two sheets
// are baked pointing opposite ways), without affecting the behind-launch offset.
const SWOOSH_SMOKE_CFG = {
  dash: { size: 200, stretch: 1.2, yLift: 0.24, xBias: 0.08, flipSign: 1 },
  // Same size/height as the dash. Bigger xBias so it spawns clearly BEHIND the
  // fighter: unlike the dash (which zips away instantly, leaving its centered
  // swoosh behind), the charged lunge has startup, so a center-anchored swoosh
  // would overlap his body and read as "inside" him.
  charged: { size: 200, stretch: 1.2, yLift: 0.24, xBias: 0.45, flipSign: -1 },
};

function spawnSwooshSmoke(
  engine,
  sheet,
  cfg,
  footX,
  footY,
  { dir = 1, scale = 1, alpha = 0.9, maxLife = 0.42 } = {}
) {
  if (!sheet || !sheet.complete || !sheet.naturalWidth) return false;
  const drawSize = cfg.size * scale;
  const sign = cfg.flipSign ?? 1;
  const flip = sign * dir < 0;
  engine.spawn({
    // flipSign also corrects the "behind the launch point" offset for sheets
    // whose direction convention is inverted (e.g. charged).
    x: footX - sign * dir * drawSize * cfg.xBias,
    y: footY - drawSize * cfg.yLift,
    vx: 0,
    vy: 0,
    gravity: 0,
    drag: 1,
    size: drawSize,
    sizeEnd: drawSize * 1.08, // gentle grow; the sheet does the bloom/dissipate
    alpha,
    alphaEnd: 0,
    rotation: 0,
    rotationSpeed: 0,
    ease: "outCubic",
    easeAlpha: "inCubic",
    maxLife,
    stretchX: cfg.stretch * (flip ? -1 : 1),
    sheet,
    sheetCols: 4,
    sheetRows: 4,
    sheetStart: 0,
    sheetEnd: 15,
  });
  return true;
}

function spawnDashSmoke(engine, footX, footY, opts = {}) {
  // Sheet-only visual registration: PNG pad sits under the plume, so nudge the
  // draw center down in GAME-space for full dodge dashStart. Slide-redirect
  // can opt out (applySheetBaseline: false) to keep its prior registration.
  // Does not touch charged swoosh, ice-slide frost, or streak emitters.
  const baseline =
    opts.applySheetBaseline === false ? 0 : DASH_SMOKE_SHEET_BASELINE_Y;
  return spawnSwooshSmoke(
    engine,
    dashSmokeImg,
    SWOOSH_SMOKE_CFG.dash,
    footX,
    footY + baseline,
    opts
  );
}

function spawnChargedSmoke(engine, footX, footY, opts) {
  return spawnSwooshSmoke(engine, chargedSmokeImg, SWOOSH_SMOKE_CFG.charged, footX, footY, opts);
}

// ── Cinematic throw-kill landing splash ──────────────────────────────────────
// Dedicated 1024x1024, 4x4 grid (16 frames) of a wide impact splash that flares
// up on both sides then settles — used only for the cinematic throw-kill body
// slam, distinct from the softer generic landing puff.
// ── Arm-clamp crackle sheet (counter-grab) ───────────────────────────────────
// 1024x1024, 4x4 grid: a magenta/purple electric burst that shatters into
// flecks and dissipates. Frame 0 is empty; content lives in ~1–13. Drawn on
// the clamped victim (front canvas) so the "arms pinned" state visibly zaps.
const clampedEffectImg = makeSmokeImg(clampedEffectSheet);
const CLAMP_CRACKLE_FRAMES = { start: 1, end: 13 };

const cinematicThrowLandSmokeImg = makeSmokeImg(cinematicThrowLandSmokeSheet);
const CK_THROW_LAND_SIZE = 220; // wide, heavy impact footprint (GAME-space px)
const CK_THROW_LAND_STRETCH = 1.1;
const CK_THROW_LAND_Y_BIAS = -0.20; // negative = higher on screen; slight lift off the floor

// Bakes a color-tinted copy of a (white/gray) sheet once it loads. Uses
// `source-atop` (paint the color ONLY over existing non-transparent pixels) at a
// given `strength` instead of `multiply`: multiply darkens mid-grays into muddy
// olive, whereas source-atop lays the vivid color on top and keeps the sprite's
// original alpha, so the result stays BRIGHT and saturated (matches the effect's
// yellow instead of a dull tan). `strength` = how fully the color takes over
// (1 = flat color silhouette; lower keeps more of the sprite's own shading).
// Returns a holder whose .canvas is null until the image has loaded + baked.
function makeTintedSheet(img, r, g, b, strength = 0.85) {
  const holder = { canvas: null };
  if (!img || typeof document === "undefined") return holder;
  const build = () => {
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (!W || !H) return;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);
    cx.globalCompositeOperation = "source-atop";
    cx.globalAlpha = strength;
    cx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    cx.fillRect(0, 0, W, H);
    holder.canvas = c;
  };
  if (img.complete && img.naturalWidth) build();
  else img.addEventListener("load", build, { once: true });
  return holder;
}

// Vivid YELLOW variant of the cinematic throw-land splash (charged / KO paths).
const cinematicThrowLandSmokeGold = makeTintedSheet(cinematicThrowLandSmokeImg, 255, 240, 95, 0.88);
// Electric ice-cyan variant — perfect-parry foot splash, matches the hotter
// perfect-tier burst (distinct from regular steel-cyan hold motes).
const cinematicThrowLandSmokeCyan = makeTintedSheet(cinematicThrowLandSmokeImg, 40, 230, 255, 0.82);

function spawnCinematicThrowLandSmoke(
  engine,
  footX,
  footY,
  { scale = 1, alpha = 1, maxLife = 0.55, behindDohyo = false, tint = null } = {}
) {
  const goldReady = tint === "gold" && cinematicThrowLandSmokeGold.canvas;
  const cyanReady = tint === "cyan" && cinematicThrowLandSmokeCyan.canvas;
  const tintedReady = goldReady || cyanReady;
  const img = goldReady
    ? cinematicThrowLandSmokeGold.canvas
    : cyanReady
      ? cinematicThrowLandSmokeCyan.canvas
      : cinematicThrowLandSmokeImg;
  // The baked tint canvas is always render-ready; the raw <img> needs a load check.
  if (!tintedReady && (!img || !img.complete || !img.naturalWidth)) return false;
  const drawSize = CK_THROW_LAND_SIZE * scale;
  engine.spawn({
    x: footX,
    y: footY + drawSize * CK_THROW_LAND_Y_BIAS,
    vx: 0,
    vy: 0,
    gravity: 0,
    drag: 1,
    size: drawSize,
    sizeEnd: drawSize * 1.1,
    alpha,
    alphaEnd: 0,
    rotation: 0,
    rotationSpeed: 0,
    ease: "outCubic",
    easeAlpha: "inCubic",
    maxLife,
    stretchX: CK_THROW_LAND_STRETCH,
    behindDohyo,
    sheet: img,
    sheetCols: 4,
    sheetRows: 4,
    sheetStart: 0,
    sheetEnd: 15,
  });
  return true;
}

// Cap canvas backing-store DPR. The previous implementation forced at least 2x
// device pixels, which inflates fillrate cost on every frame for three full-
// scene canvases. 1.5x is visually indistinguishable for soft particles while
// cutting per-pixel cost roughly in half on common 1920x1080 displays.
function getCanvasDpr() {
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  return Math.min(Math.max(dpr, 1), 1.5);
}

// ─── Easing ─────────────────────────────────────────────────────────

const EASE = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t * t * t,
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  // Sine arc — eases 0 → 1 → 0 over the full life. Use with
  // alpha == alphaEnd > 0 (or any nonzero target) to get a clean
  // fade-in/fade-out pulse without needing a multi-keyframe system.
  // Used by the local player halo so the ring breathes subtly instead
  // of popping in at full alpha.
  bump: (t) => Math.sin(Math.PI * t),
};

// ─── Texture generation ─────────────────────────────────────────────
// Anime-style cloud puffs: solid interior, bumpy irregular edges.
// Built by compositing many overlapping hard circles into a blob shape.

function createAnimePuff(size, seed) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;

  // Seeded-ish random for reproducible but varied shapes
  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // Build cloud from overlapping hard circles
  const numBlobs = 8 + Math.floor(srand() * 6);
  for (let i = 0; i < numBlobs; i++) {
    const bx = half + (srand() - 0.5) * size * 0.55;
    const by = half + (srand() - 0.5) * size * 0.45;
    const br = size * (0.18 + srand() * 0.18);

    // Hard gradient: solid for most of radius, quick fade at edge
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.65, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.85, "rgba(255,255,255,0.4)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

function createBluePuff(size, seed) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;

  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const numBlobs = 8 + Math.floor(srand() * 6);
  for (let i = 0; i < numBlobs; i++) {
    const bx = half + (srand() - 0.5) * size * 0.55;
    const by = half + (srand() - 0.5) * size * 0.45;
    const br = size * (0.18 + srand() * 0.18);

    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, "rgba(120,200,255,0.95)");
    grad.addColorStop(0.45, "rgba(60,150,255,0.9)");
    grad.addColorStop(0.7, "rgba(30,100,255,0.6)");
    grad.addColorStop(1, "rgba(0,60,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

// MATADOR plume — same blob recipe as AP blue, rich metallic gold.
// Loud + additive like the blue plumes; gold (not orange, not CLAMP magenta).
function createMatadorPuff(size, seed) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;

  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const numBlobs = 8 + Math.floor(srand() * 6);
  for (let i = 0; i < numBlobs; i++) {
    const bx = half + (srand() - 0.5) * size * 0.55;
    const by = half + (srand() - 0.5) * size * 0.45;
    const br = size * (0.18 + srand() * 0.18);

    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, "rgba(255,248,210,0.98)");
    grad.addColorStop(0.32, "rgba(255,220,100,0.95)");
    grad.addColorStop(0.58, "rgba(232,197,71,0.82)");
    grad.addColorStop(0.82, "rgba(184,134,11,0.42)");
    grad.addColorStop(1, "rgba(100,70,10,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

// Player-accent puff — parametric sibling of createBluePuff. Used in sidestep
// trail particles so YOUR dust carries a faint tint of YOUR mawashi color,
// reinforcing identity during overlap without needing a glow filter.
function createColoredPuff(size, rgb, seed) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  const [r, g, b] = rgb;

  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const numBlobs = 8 + Math.floor(srand() * 6);
  for (let i = 0; i < numBlobs; i++) {
    const bx = half + (srand() - 0.5) * size * 0.55;
    const by = half + (srand() - 0.5) * size * 0.45;
    const br = size * (0.18 + srand() * 0.18);

    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    // White-hot core blending into the player's color so the puff still reads
    // as "dust kicked up" rather than a saturated colored cloud.
    grad.addColorStop(0, `rgba(255,255,255,0.9)`);
    grad.addColorStop(0.4, `rgba(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)},0.8)`);
    grad.addColorStop(0.75, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

// Local-player ice mark - a horizontally-stretched, broken scuff tinted
// toward the player's mawashi color. Used by the localPlayerHalo preset
// to mark "this is YOU" on the dohyo floor without reading as UI chrome.
//
// IMPORTANT: this texture is built at the FINAL render aspect ratio
// (~3.7:1 wide). The localPlayerHalo preset spawns it with a matching
// `stretchX` so the engine's per-axis scaling is symmetric — no
// asymmetric squashing of the stroke pixels. That's the difference
// between a clean floor mark and the blurry over-thick smear you
// get when you render a square ring texture with a 4× horizontal
// stretch.
//
// Deliberately not a perfect ring: short dry-brush arcs plus tiny
// scratch flecks make it feel like scuffed frost on the ice, not a
// selection circle or glow effect.
function createHaloRing(width, height, rgb) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  const [r, g, b] = rgb;

  const cx = width / 2;
  const cy = height / 2;
  const baseW = Math.max(1.1, Math.min(width, height) * 0.028);
  const rx = width / 2 - baseW * 3.2;
  const ry = height / 2 - baseW * 3.2;

  // Pull saturated belt colors back toward ice/cream so the mark remains
  // character-tinted without becoming a neon team-color decal.
  const ice = [218, 246, 252];
  const tintMix = 0.38;
  const mr = Math.round(ice[0] * (1 - tintMix) + r * tintMix);
  const mg = Math.round(ice[1] * (1 - tintMix) + g * tintMix);
  const mb = Math.round(ice[2] * (1 - tintMix) + b * tintMix);

  let seed = ((r + 17) * 73856093) ^ ((g + 31) * 19349663) ^ ((b + 47) * 83492791);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const strokeArc = (start, end, alpha, lineWidth, inset = 0) => {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `rgba(${mr},${mg},${mb},${alpha})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - inset, ry - inset * 0.35, 0, start, end);
    ctx.stroke();
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "source-over";

  const segments = [
    [Math.PI * 0.08, Math.PI * 0.43],
    [Math.PI * 0.56, Math.PI * 0.91],
    [Math.PI * 0.98, Math.PI * 1.15],
    [Math.PI * 1.84, Math.PI * 1.96],
  ];

  segments.forEach(([start, end], i) => {
    // A soft under-pass reads as frost rubbed into the floor, not bloom.
    strokeArc(start, end, 0.18, baseW * (2.1 + rand() * 0.5), -baseW * 0.25);

    for (let pass = 0; pass < 3; pass++) {
      const jitter = (rand() - 0.5) * 0.035;
      const inset = (rand() - 0.5) * baseW * 1.4;
      const alpha = i < 2 ? 0.48 - pass * 0.1 : 0.34 - pass * 0.07;
      strokeArc(
        start + jitter,
        end + jitter + (rand() - 0.5) * 0.03,
        alpha,
        baseW * (0.72 + rand() * 0.5),
        inset
      );
    }
  });

  // Small tangential scratches break the silhouette so the eye reads a scuff,
  // while still preserving enough oval shape to identify the local fighter.
  for (let i = 0; i < 38; i++) {
    const seg = segments[Math.floor(rand() * segments.length)];
    const a = seg[0] + (seg[1] - seg[0]) * rand();
    const px = cx + Math.cos(a) * (rx + (rand() - 0.5) * baseW * 4.6);
    const py = cy + Math.sin(a) * (ry + (rand() - 0.5) * baseW * 2.8);
    const tangent = a + Math.PI / 2 + (rand() - 0.5) * 0.45;
    const len = baseW * (0.8 + rand() * 2.4);
    const half = len / 2;
    const alpha = 0.18 + rand() * 0.24;

    ctx.lineWidth = Math.max(0.6, baseW * (0.35 + rand() * 0.25));
    ctx.strokeStyle = `rgba(${mr},${mg},${mb},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(tangent) * half, py - Math.sin(tangent) * half);
    ctx.lineTo(px + Math.cos(tangent) * half, py + Math.sin(tangent) * half);
    ctx.stroke();
  }

  return c;
}

function createAnimePuffSmall(size, seed) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;

  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const numBlobs = 5 + Math.floor(srand() * 4);
  for (let i = 0; i < numBlobs; i++) {
    const bx = half + (srand() - 0.5) * size * 0.5;
    const by = half + (srand() - 0.5) * size * 0.4;
    const br = size * (0.2 + srand() * 0.15);

    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.85, "rgba(255,255,255,0.3)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

function createChunk(size, r, g, b, peakAlpha = 0.8) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${r},${g},${b},${peakAlpha})`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},${peakAlpha * 0.6})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Glowy dot with a baked-in DARK KEYLINE — a bright core fades through a
// color band into a dark translucent rim before going transparent. Rendered
// with NORMAL (not additive) blending, the dark rim darkens the surrounding
// pixels so the bright core separates cleanly even on a bright / same-color
// background (the same white-on-white contrast trick the hit FX uses). core,
// mid, rim are "r,g,b" strings.
function createGlowDotKeyed(size, core, mid, rim) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  // Small hot center with a SOFT glow falloff and only a gentle dark halo
  // (no hard ring) — reads as a frost glint, not a bordered disc. The dark
  // halo is subtle: just enough to separate from a bright background.
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, `rgba(${core},1)`);
  g.addColorStop(0.12, `rgba(${core},0.9)`);
  g.addColorStop(0.3, `rgba(${mid},0.62)`);
  g.addColorStop(0.5, `rgba(${mid},0.28)`);
  g.addColorStop(0.68, `rgba(${rim},0.26)`); // soft dark halo (not a ring)
  g.addColorStop(0.86, `rgba(${rim},0.08)`);
  g.addColorStop(1, `rgba(${rim},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function createSpeedLine(length, thickness, r, g, b, peakAlpha = 0.9) {
  const c = document.createElement("canvas");
  c.width = length;
  c.height = thickness + 2;
  const ctx = c.getContext("2d");
  const cy = c.height / 2;
  // Sharp horizontal line that tapers to points at both ends
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(length * 0.15, cy - thickness / 2);
  ctx.lineTo(length * 0.85, cy - thickness / 2);
  ctx.lineTo(length, cy);
  ctx.lineTo(length * 0.85, cy + thickness / 2);
  ctx.lineTo(length * 0.15, cy + thickness / 2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, length, 0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
  grad.addColorStop(0.2, `rgba(${r},${g},${b},${peakAlpha})`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},${peakAlpha})`);
  grad.addColorStop(0.8, `rgba(${r},${g},${b},${peakAlpha})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fill();
  return c;
}

// Horizontal speed streak with the palm-thrust ring palette — bright yellow
// stroke, warm halo, and white-hot core so forward lines match the removed ring.
function createGlowingSpeedLine(length, thickness, palette) {
  const glowPad = Math.ceil(thickness * 5);
  const c = document.createElement("canvas");
  c.width = length;
  c.height = thickness + glowPad * 2;
  const ctx = c.getContext("2d");
  const cy = c.height / 2;
  const [sr, sg, sb] = palette.stroke;
  const [gr, gg, gb] = palette.glow;
  const glowAlpha = palette.glowAlpha ?? 0.78;
  const strokeAlpha = palette.strokeAlpha ?? 1.0;

  // Outer warm halo — soft bloom like the ring's glow pass
  ctx.save();
  ctx.shadowColor = `rgba(${gr},${gg},${gb},${glowAlpha})`;
  ctx.shadowBlur = thickness * 4;
  ctx.strokeStyle = `rgba(${gr},${gg},${gb},${glowAlpha * 0.55})`;
  ctx.lineWidth = thickness * 2.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(length * 0.05, cy);
  ctx.lineTo(length * 0.95, cy);
  ctx.stroke();
  ctx.restore();

  // Tapered body — hot yellow stroke with white-hot center
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(length * 0.15, cy - thickness / 2);
  ctx.lineTo(length * 0.85, cy - thickness / 2);
  ctx.lineTo(length, cy);
  ctx.lineTo(length * 0.85, cy + thickness / 2);
  ctx.lineTo(length * 0.15, cy + thickness / 2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, length, 0);
  grad.addColorStop(0, `rgba(${gr},${gg},${gb},0)`);
  grad.addColorStop(0.15, `rgba(${gr},${gg},${gb},${glowAlpha * 0.55})`);
  grad.addColorStop(0.35, `rgba(${sr},${sg},${sb},${strokeAlpha * 0.95})`);
  grad.addColorStop(0.5, `rgba(255,255,255,${strokeAlpha})`);
  grad.addColorStop(0.65, `rgba(${sr},${sg},${sb},${strokeAlpha * 0.95})`);
  grad.addColorStop(0.85, `rgba(${gr},${gg},${gb},${glowAlpha * 0.55})`);
  grad.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Bright rim stroke — ring-like sharp edge with glow
  ctx.save();
  ctx.shadowColor = `rgba(${sr},${sg},${sb},0.95)`;
  ctx.shadowBlur = thickness * 1.6;
  ctx.strokeStyle = `rgba(${sr},${sg},${sb},${strokeAlpha})`;
  ctx.lineWidth = Math.max(1, thickness * 0.38);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(length * 0.12, cy);
  ctx.lineTo(length * 0.88, cy);
  ctx.stroke();
  ctx.restore();

  return c;
}

function createCloudRing(diameter, bandWidth, seed) {
  // Default white ring — preserved for existing presets that consume it.
  return createColoredCloudRing(diameter, bandWidth, seed, {
    shadow: [210, 215, 220],
    body: [250, 252, 255],
    highlight: [255, 255, 255],
  });
}

// Three-pass tiled-blob ring builder. Same construction the white ring uses,
// but with caller-controlled colors so we can mint themed rings (pink absorb
// ring, glass-yellow break ring, etc.) without hand-rolling each one.
function createColoredCloudRing(diameter, bandWidth, seed, palette) {
  const c = document.createElement("canvas");
  c.width = diameter;
  c.height = diameter;
  const ctx = c.getContext("2d");
  const half = diameter / 2;
  const ringR = half - bandWidth * 0.7;

  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  function drawBlob(bx, by, br, r, g, b, alpha) {
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.75, `rgba(${r},${g},${b},${alpha * 0.7})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const [sr, sg, sb] = palette.shadow;
  const [br_, bg, bb] = palette.body;
  const [hr, hg, hb] = palette.highlight;

  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2 + srand() * 0.4;
    const jitter = (srand() - 0.5) * bandWidth * 0.5;
    const bx = half + Math.cos(angle) * (ringR + jitter);
    const by = half + Math.sin(angle) * (ringR + jitter) + bandWidth * 0.3;
    const br = bandWidth * (0.6 + srand() * 0.5);
    drawBlob(bx, by, br, sr, sg, sb, 1.0);
  }

  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2 + srand() * 0.45;
    const jitter = (srand() - 0.5) * bandWidth * 0.55;
    const bx = half + Math.cos(angle) * (ringR + jitter);
    const by = half + Math.sin(angle) * (ringR + jitter);
    const br = bandWidth * (0.5 + srand() * 0.5);
    drawBlob(bx, by, br, br_, bg, bb, 1.0);
  }

  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2 + srand() * 0.5;
    const jitter = (srand() - 0.5) * bandWidth * 0.4;
    const bx = half + Math.cos(angle) * (ringR + jitter);
    const by = half + Math.sin(angle) * (ringR + jitter) - bandWidth * 0.2;
    const br = bandWidth * (0.3 + srand() * 0.4);
    drawBlob(bx, by, br, hr, hg, hb, 1.0);
  }

  return c;
}

// Crisp circular ring with a soft inner glow + bright stroke + outer halo.
// Mimics the CSS hit-effect ring style (border + box-shadow) — sharp/geometric
// rather than the cloud-blob feel of createCloudRing. Used for the grab-armor
// absorb where we want the ring to read as a clean shockwave matching the
// style of the slap/charged hit rings, not as a "smoke puff".
function createCrispRing(diameter, palette) {
  const c = document.createElement("canvas");
  c.width = diameter;
  c.height = diameter;
  const ctx = c.getContext("2d");
  const half = diameter / 2;
  const ringR = half * 0.78; // leave room for the outer halo
  // palette.thin → much thinner stroke for delicate "energy boundary" rings
  // (e.g. armor absorb), vs. the default chunky ~5% diameter line.
  const strokeW = palette.thin
    ? Math.max(1.5, diameter * 0.018)
    : Math.max(2, diameter * 0.045);

  const [sr, sg, sb] = palette.stroke; // bright ring color
  const [gr, gg, gb] = palette.glow; // soft outer halo
  const [cr, cg, cb] = palette.core; // optional inner core fill

  // Optional inner core fill (very faint, fades to transparent at the ring)
  if (palette.coreAlpha > 0) {
    const coreGrad = ctx.createRadialGradient(half, half, 0, half, half, ringR);
    coreGrad.addColorStop(0, `rgba(${cr},${cg},${cb},${palette.coreAlpha})`);
    coreGrad.addColorStop(0.6, `rgba(${cr},${cg},${cb},${palette.coreAlpha * 0.4})`);
    coreGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(half, half, ringR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer halo (additive-style bloom around the ring) — palette.crisp
  // skips this entirely (no soft halo = no cloudy/smoky read), used by
  // tech-feeling rings like the grab-armor absorb.
  if (!palette.crisp) {
    const haloGrad = ctx.createRadialGradient(
      half, half, ringR * 0.85,
      half, half, half
    );
    haloGrad.addColorStop(0, `rgba(${gr},${gg},${gb},0)`);
    haloGrad.addColorStop(0.35, `rgba(${gr},${gg},${gb},${palette.glowAlpha})`);
    haloGrad.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner shadow band right inside the stroke (depth) — opt-out via
  // palette.simple = true for "less detail" rings (e.g. armor absorb).
  if (!palette.simple) {
    ctx.lineWidth = Math.max(1, strokeW * 0.45);
    ctx.strokeStyle = `rgba(0,0,0,0.22)`;
    ctx.beginPath();
    ctx.arc(half, half, ringR - strokeW * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Main bright stroke — the "border" of the ring. palette.crisp
  // disables shadowBlur so the stroke stays geometrically sharp (no
  // smoky/glowy outline) — meant for tech-style absorb rings.
  ctx.lineWidth = strokeW;
  ctx.strokeStyle = `rgba(${sr},${sg},${sb},${palette.strokeAlpha})`;
  if (!palette.crisp) {
    ctx.shadowColor = `rgba(${sr},${sg},${sb},0.95)`;
    ctx.shadowBlur = strokeW * 1.8;
  }
  ctx.beginPath();
  ctx.arc(half, half, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Bright highlight inner edge (sells the 3D rim feel) — also opt-out
  // when simple mode is requested for a flatter/cleaner ring read.
  if (!palette.simple) {
    ctx.lineWidth = Math.max(1, strokeW * 0.35);
    ctx.strokeStyle = `rgba(255,255,255,0.55)`;
    ctx.beginPath();
    ctx.arc(half, half, ringR + strokeW * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }

  return c;
}

// Forward-bulging CRESCENT arc — a "bow wave" that reads as a DIRECTIONAL
// shockwave (force shoved one way) rather than a radial ring. The arc is
// drawn on the +x side of the canvas (bulge pointing right) and fades to
// nothing at its tips via per-segment alpha, so stacked/expanding copies
// read as a clean anime push-wave. Rotate the sprite by 0 (→) or π (←) to
// aim it down the thrust. Used by the open-palm thrust.
function createArcWave(diameter, palette) {
  const c = document.createElement("canvas");
  c.width = diameter;
  c.height = diameter;
  const ctx = c.getContext("2d");
  const half = diameter / 2;
  const R = half * 0.72;
  const strokeW = Math.max(2, diameter * 0.05);
  const [sr, sg, sb] = palette.stroke;
  const [gr, gg, gb] = palette.glow;
  const glowAlpha = palette.glowAlpha ?? 0.8;
  const strokeAlpha = palette.strokeAlpha ?? 1.0;
  // Arc span: ~150° centered on +x (from -75° to +75°).
  const a0 = -Math.PI * 0.42;
  const a1 = Math.PI * 0.42;
  const SEG = 44;
  ctx.lineCap = "round";

  // Draw the arc in short segments, alpha shaped by a sine bell (0 at the
  // tips, 1 at the center) so the crescent fades out at its ends. Two passes:
  // a soft wide glow, then a crisp bright core, then a thin white hot edge.
  const drawArc = (color, baseAlpha, widthMul, blur, radius) => {
    for (let i = 0; i < SEG; i++) {
      const t0 = i / SEG;
      const t1 = (i + 1) / SEG;
      const mid = (t0 + t1) * 0.5;
      const fade = Math.sin(mid * Math.PI); // 0 → 1 → 0
      const ang0 = a0 + (a1 - a0) * t0;
      const ang1 = a0 + (a1 - a0) * t1;
      ctx.strokeStyle = `rgba(${color},${baseAlpha * fade})`;
      ctx.lineWidth = strokeW * widthMul;
      if (blur > 0) {
        ctx.shadowColor = `rgba(${color},${0.9 * fade})`;
        ctx.shadowBlur = blur;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(half, half, radius, ang0, ang1);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  };

  // Tight glow (kept narrow so it doesn't wash into a grey haze), a CRISP
  // bright core, a sharp white hot rim on the leading edge, and a thin inner
  // trailing arc so the wave reads as a defined double-edged energy blade
  // rather than one soft smear.
  drawArc(`${gr},${gg},${gb}`, glowAlpha * 0.9, 1.7, strokeW * 1.0, R);
  drawArc(`${sr},${sg},${sb}`, strokeAlpha, 0.95, strokeW * 0.45, R);
  drawArc(`255,255,255`, 0.9, 0.34, 0, R + strokeW * 0.26);
  drawArc(`${sr},${sg},${sb}`, strokeAlpha * 0.5, 0.45, 0, R - strokeW * 0.95);

  return c;
}

// Angular wedge with a bright leading edge — reads as a thin shard of glass
// when spawned at random rotations. Multiple seeds produce subtly different
// silhouettes so a burst of shards doesn't look stamped from one cookie cutter.
function createGlassShard(size, seed, frost = false) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;

  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // Long, narrow, irregular triangle with one bright tip and a darker tail
  const lengthScale = 0.55 + srand() * 0.4;
  const widthScale = 0.12 + srand() * 0.12;
  const taperBias = 0.55 + srand() * 0.25;

  const tipX = half + size * lengthScale * 0.5;
  const tailX = half - size * lengthScale * 0.5;
  const halfWidth = size * widthScale * 0.5;

  ctx.translate(half, half);
  ctx.rotate((srand() - 0.5) * 0.4); // Slight asymmetric lean
  ctx.translate(-half, -half);

  ctx.beginPath();
  ctx.moveTo(tipX, half);
  ctx.lineTo(tailX + size * 0.05, half - halfWidth * taperBias);
  ctx.lineTo(tailX, half + (srand() - 0.5) * halfWidth * 0.4);
  ctx.lineTo(tailX + size * 0.06, half + halfWidth * (1 - taperBias * 0.6));
  ctx.closePath();

  // Edge-lit gradient: bright white tip, fading to a pale tail. Warm
  // white-yellow by default (glass-shard armor break); frost=true swaps
  // to an icy white-cyan tint so the same shard silhouette reads as cold
  // impact energy on the slap/charged/burst hits.
  const sEdge = frost ? "120,195,255" : "255,235,140";
  const sNear = frost ? "150,210,255" : "255,240,170";
  const sMid = frost ? "205,235,255" : "255,250,210";
  const sHot = frost ? "240,250,255" : "255,255,240";
  const grad = ctx.createLinearGradient(tailX, half, tipX, half);
  grad.addColorStop(0, `rgba(${sEdge},0)`);
  grad.addColorStop(0.18, `rgba(${sNear},0.55)`);
  grad.addColorStop(0.55, `rgba(${sMid},0.85)`);
  grad.addColorStop(0.85, `rgba(${sHot},1.0)`);
  grad.addColorStop(1, "rgba(255,255,255,1.0)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Bright leading-edge highlight along the tip
  ctx.beginPath();
  ctx.moveTo(tipX, half);
  ctx.lineTo(tipX - size * 0.18, half - halfWidth * 0.4);
  ctx.lineTo(tipX - size * 0.18, half + halfWidth * 0.4);
  ctx.closePath();
  const tipGrad = ctx.createRadialGradient(tipX - size * 0.05, half, 0, tipX - size * 0.05, half, size * 0.18);
  tipGrad.addColorStop(0, "rgba(255,255,255,1)");
  tipGrad.addColorStop(0.6, `rgba(${sMid},0.6)`);
  tipGrad.addColorStop(1, `rgba(${sEdge},0)`);
  ctx.fillStyle = tipGrad;
  ctx.fill();

  return c;
}

// Punchy 8-point cross flare — 4 long primary rays + 4 short diagonal
// rays + a hot white-pink core. Designed for the IMPACT moment of the
// grab-armor absorb so the spark of contact reads as a clean, bright
// "snap" rather than a blob. Anime-fighter idiom: bright cross flare
// over a hot pinpoint, additive-blended for bloom. Color is applied
// via (r,g,b); rays fade to transparent at their tips so the flare
// reads as light, not as a stamp.
// Tight white-center → saturated-pink halo with a SHARP falloff.
// Mirrors the perfect-parry inner-burst gradient (white ≤12% → hot
// color 30% → faint 68% → transparent by 80%) but in pink instead
// of cyan. Hard cutoff before the canvas edge is what stops it from
// reading as a smokey blob — the previous version extended color
// out to 100% which left a long soft tail. This version snaps to
// transparent so the bloom looks like a CONTAINED flash, not a
// foggy puff.
function createFlashBloom(size, r, g, b) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.12, "rgba(255,240,246,0.95)");
  grad.addColorStop(0.30, "rgba(255,160,195,0.88)");
  grad.addColorStop(0.50, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(0.68, `rgba(${r},${g},${b},0.18)`);
  grad.addColorStop(0.80, `rgba(${r},${g},${b},0)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Clean cel smoke puff — tight 3-blob cluster, crisp hard edge (anime idiom).
function createHitRingSmokePuff(size, seed) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  const srand = makeSeededRand(seed);

  const drawBlob = (ox, oy, br, peak) => {
    const bx = half + ox * size;
    const by = half + oy * size;
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, `rgba(255,255,255,${peak})`);
    grad.addColorStop(0.58, `rgba(255,255,255,${peak * 0.94})`);
    grad.addColorStop(0.82, `rgba(255,255,255,${peak * 0.32})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  };

  drawBlob(0, 0, size * 0.32, 1);
  drawBlob(0.11 + srand() * 0.03, -0.05, size * 0.19, 0.9);
  drawBlob(-0.09 + srand() * 0.02, 0.06, size * 0.17, 0.85);

  return c;
}

function createCrossFlare(size, r, g, b, coreMid = "255,235,242", rayPrimaryMid = "255,170,200", raySecondaryMid = "255,200,220") {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;

  // Hot white-pink core. Bright nucleus the rays radiate from.
  const core = ctx.createRadialGradient(half, half, 0, half, half, size * 0.32);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.35, `rgba(${coreMid},0.95)`);
  core.addColorStop(0.75, `rgba(${r},${g},${b},0.5)`);
  core.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  const drawTaperedRay = (rayHalfLen, thickness, alphaPeak, midColorRgb) => {
    const grad = ctx.createLinearGradient(-rayHalfLen, 0, rayHalfLen, 0);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(0.4, `rgba(${midColorRgb},${alphaPeak * 0.7})`);
    grad.addColorStop(0.5, `rgba(255,255,255,${alphaPeak})`);
    grad.addColorStop(0.6, `rgba(${midColorRgb},${alphaPeak * 0.7})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;

    // Tapered diamond — thicker in the middle, points at both ends.
    ctx.beginPath();
    ctx.moveTo(-rayHalfLen, 0);
    ctx.lineTo(-rayHalfLen * 0.25, -thickness);
    ctx.lineTo(rayHalfLen * 0.25, -thickness);
    ctx.lineTo(rayHalfLen, 0);
    ctx.lineTo(rayHalfLen * 0.25, thickness);
    ctx.lineTo(-rayHalfLen * 0.25, thickness);
    ctx.closePath();
    ctx.fill();
  };

  // 4 PRIMARY rays — long, bright, on the cardinal axes.
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate((i * Math.PI) / 2);
    drawTaperedRay(half * 0.96, size * 0.05, 1.0, rayPrimaryMid);
    ctx.restore();
  }

  // 4 SECONDARY rays — shorter, thinner, on the diagonals. Adds the
  // 8-point flare silhouette without competing with the primaries.
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
    drawTaperedRay(half * 0.62, size * 0.022, 0.7, raySecondaryMid);
    ctx.restore();
  }

  return c;
}

function createSpark(size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1.0)");
  grad.addColorStop(0.25, "rgba(230,245,255,0.95)");
  grad.addColorStop(0.5, "rgba(180,220,255,0.5)");
  grad.addColorStop(1, "rgba(150,200,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function createGroundStreak(length, thickness) {
  const c = document.createElement("canvas");
  c.width = length;
  c.height = thickness + 4;
  const ctx = c.getContext("2d");
  const cy = c.height / 2;
  const grad = ctx.createLinearGradient(0, 0, length, 0);
  grad.addColorStop(0, "rgba(200,230,255,0)");
  grad.addColorStop(0.15, "rgba(220,240,255,0.7)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.5)");
  grad.addColorStop(0.85, "rgba(220,240,255,0.7)");
  grad.addColorStop(1, "rgba(200,230,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, cy - thickness / 2, length, thickness);
  return c;
}

// ─── HIT VFX OVERHAUL (Phase A) — cel-burst impact bakery ────────────
//
// Status palettes (§4.2). Each hit read is white core -> body band -> thin
// dark keyline, per Craft Rule 1 (flat tones, never gradient bodies). `volt`
// gets an extra inner band. All bodies render on NORMAL blend so the baked
// keyline's dark pixels survive.
const IMPACT_PALETTES = {
  white:  { core: [255, 255, 255], body: [240, 246, 255], key: [10, 16, 28] },
  gold:   { core: [255, 255, 255], body: [255, 208, 84],  key: [46, 30, 0] },
  purple: { core: [255, 255, 255], body: [186, 132, 255], key: [26, 10, 44] },
  red:    { core: [255, 255, 255], body: [255, 84, 64],   key: [44, 4, 0] },
  amber:  { core: [255, 255, 255], body: [255, 232, 128], key: [44, 34, 0] },
  volt:   { core: [255, 255, 255], body: [43, 99, 255],   innerBand: [156, 196, 255], key: [8, 14, 44] },
};

function makeSeededRand(seed) {
  let s = seed % 233280;
  if (s <= 0) s += 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Impact FLASH BLOT — an irregular jagged polygon drawn as flat concentric
// bands (keyline outermost -> body -> [inner band] -> white core). `frame`
// 1 = the flash (white-dominant); frame 2 = the torn follow-up with 2-3
// wedge notches cut inward and body-dominant. Same silhouette family for a
// given seed so the two frames read as one shape SNAPPING between states.
function createImpactBlot(size, seed, frame, pal) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  const srand = makeSeededRand(seed);

  const numPts = 8 + Math.floor(srand() * 5); // 8-12 points
  const baseAngle = srand() * Math.PI * 2;
  const ox = (srand() - 0.5) * size * 0.16; // center offset ~8% of radius
  const oy = (srand() - 0.5) * size * 0.16;
  const maxR = half * 0.92;

  // Ray lengths deliberately uneven: 35-100% of radius (Craft Rule 4).
  const radii = [];
  for (let i = 0; i < numPts; i++) radii.push(maxR * (0.35 + srand() * 0.65));

  // Frame 2 is "torn": cut 2-3 wedge notches inward.
  if (frame === 2) {
    const notches = 2 + Math.floor(srand() * 2);
    for (let n = 0; n < notches; n++) {
      const ni = Math.floor(srand() * numPts);
      radii[ni] = maxR * (0.18 + srand() * 0.12);
    }
  }

  const tracePoly = (scale) => {
    ctx.beginPath();
    for (let i = 0; i < numPts; i++) {
      const ang = baseAngle + (i / numPts) * Math.PI * 2;
      const rr = radii[i] * scale;
      const x = half + ox + Math.cos(ang) * rr;
      const y = half + oy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // Keyline (outermost) -> body -> optional inner band -> white core.
  const whiteScale = frame === 1 ? 0.66 : 0.4;
  ctx.fillStyle = rgb(pal.key, 0.92);
  tracePoly(1.0);
  ctx.fill();
  ctx.fillStyle = rgb(pal.body, 1);
  tracePoly(0.88);
  ctx.fill();
  if (pal.innerBand) {
    ctx.fillStyle = rgb(pal.innerBand, 1);
    tracePoly((whiteScale + 0.88) / 2);
    ctx.fill();
  }
  ctx.fillStyle = rgb(pal.core, 1);
  tracePoly(whiteScale);
  ctx.fill();

  return c;
}

// Ejecta CROWN shard — a curved tapered teardrop baked pointing +x (the
// preset orients it to the velocity angle and stretches it with stretchX).
// Wide at the base, tip slightly curled; flat keyline -> body -> white core
// wedge along the leading (tip) edge.
function createImpactPetal(size, seed, pal) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  const srand = makeSeededRand(seed);

  const baseX = size * 0.14;
  const tipX = size * 0.9;
  const halfH = size * (0.2 + srand() * 0.08);
  const curl = (srand() - 0.5) * size * 0.22; // asymmetric tip curl

  const traceTeardrop = (inset) => {
    const bx = baseX + inset;
    const tx = tipX - inset;
    const hh = Math.max(1, halfH - inset);
    const cyBase = half;
    const cyTip = half + curl;
    ctx.beginPath();
    ctx.moveTo(bx, cyBase);
    // upper edge, base -> tip
    ctx.quadraticCurveTo(bx + (tx - bx) * 0.35, cyBase - hh, tx, cyTip);
    // lower edge, tip -> base
    ctx.quadraticCurveTo(bx + (tx - bx) * 0.35, cyBase + hh, bx, cyBase);
    ctx.closePath();
  };

  const kw = Math.max(1.5, size * 0.05); // keyline width
  ctx.fillStyle = rgb(pal.key, 0.92);
  traceTeardrop(0);
  ctx.fill();
  ctx.fillStyle = rgb(pal.body, 1);
  traceTeardrop(kw);
  ctx.fill();
  if (pal.innerBand) {
    ctx.fillStyle = rgb(pal.innerBand, 1);
    traceTeardrop(kw + size * 0.06);
    ctx.fill();
  }
  // White core wedge hugging the leading (tip) half of the spine.
  const cyTip = half + curl;
  ctx.fillStyle = rgb(pal.core, 1);
  ctx.beginPath();
  ctx.moveTo(baseX + size * 0.34, half);
  ctx.quadraticCurveTo(tipX * 0.72, half - halfH * 0.34, tipX - kw, cyTip);
  ctx.quadraticCurveTo(tipX * 0.72, half + halfH * 0.34, baseX + size * 0.34, half);
  ctx.closePath();
  ctx.fill();

  return c;
}

// DEBRIS chip — a small irregular flat 4-6-sided polygon with a keyline
// (deliberately NOT the soft-gradient `chunk` texture). A tiny white nick
// keeps it reading as a lit fleck rather than a dark dot.
function createImpactChip(size, seed, pal) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;
  const srand = makeSeededRand(seed);

  const numPts = 4 + Math.floor(srand() * 3); // 4-6 sides
  const baseAngle = srand() * Math.PI * 2;
  const maxR = half * 0.86;
  const radii = [];
  const jit = [];
  for (let i = 0; i < numPts; i++) {
    radii.push(maxR * (0.55 + srand() * 0.45));
    jit.push((srand() - 0.5) * 0.2);
  }

  const tracePoly = (scale) => {
    ctx.beginPath();
    for (let i = 0; i < numPts; i++) {
      const ang = baseAngle + (i / numPts) * Math.PI * 2 + jit[i];
      const rr = radii[i] * scale;
      const x = half + Math.cos(ang) * rr;
      const y = half + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  ctx.fillStyle = rgb(pal.key, 0.92);
  tracePoly(1.0);
  ctx.fill();
  ctx.fillStyle = rgb(pal.body, 1);
  tracePoly(0.7);
  ctx.fill();
  // Small offset white nick.
  ctx.fillStyle = rgb(pal.core, 1);
  ctx.beginPath();
  ctx.arc(half - maxR * 0.18, half - maxR * 0.18, Math.max(1, size * 0.12), 0, Math.PI * 2);
  ctx.fill();

  return c;
}

// DART — a short flat tapered dart (triangle sliver) with a keyline; the
// disciplined remnant of the old streak lines. Baked pointing +x; the
// preset stretches it with stretchX and orients it to velocity.
function createImpactDart(length, thickness, pal) {
  const c = document.createElement("canvas");
  c.width = length;
  c.height = thickness;
  const ctx = c.getContext("2d");
  const cy = thickness / 2;

  const traceDart = (pad) => {
    ctx.beginPath();
    ctx.moveTo(length - pad, cy);              // sharp tip (leading)
    ctx.lineTo(pad, cy - (cy - pad));          // upper base
    ctx.lineTo(pad + length * 0.14, cy);       // notch at base center
    ctx.lineTo(pad, cy + (cy - pad));          // lower base
    ctx.closePath();
  };

  ctx.fillStyle = rgb(pal.key, 0.92);
  traceDart(0);
  ctx.fill();
  ctx.fillStyle = rgb(pal.body, 1);
  traceDart(Math.max(1, thickness * 0.22));
  ctx.fill();
  // White-hot core sliver down the spine.
  ctx.fillStyle = rgb(pal.core, 1);
  ctx.beginPath();
  ctx.moveTo(length - thickness * 0.6, cy);
  ctx.lineTo(length * 0.4, cy - thickness * 0.16);
  ctx.lineTo(length * 0.4, cy + thickness * 0.16);
  ctx.closePath();
  ctx.fill();

  return c;
}

// Bake the full cel-burst kit for every status palette. Returns a map
// keyed by palette name; each entry holds the seeded texture variants the
// `emitCelImpact` emitter picks from.
function buildImpactTextures(r) {
  const kit = {};
  let seed = 20260707;
  const nextSeed = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);

  for (const name of Object.keys(IMPACT_PALETTES)) {
    const pal = IMPACT_PALETTES[name];
    kit[name] = {
      blotF1: [
        createImpactBlot(r(96), nextSeed(), 1, pal),
        createImpactBlot(r(96), nextSeed(), 1, pal),
      ],
      blotF2: [
        createImpactBlot(r(104), nextSeed(), 2, pal),
        createImpactBlot(r(104), nextSeed(), 2, pal),
      ],
      petal: [
        createImpactPetal(r(64), nextSeed(), pal),
        createImpactPetal(r(64), nextSeed(), pal),
        createImpactPetal(r(64), nextSeed(), pal),
      ],
      chip: [
        createImpactChip(r(20), nextSeed(), pal),
        createImpactChip(r(20), nextSeed(), pal),
      ],
      dart: createImpactDart(r(56), r(8), pal),
      powder: [
        createColoredPuff(r(56), pal.body, nextSeed()),
        createColoredPuff(r(56), pal.body, nextSeed()),
      ],
    };
  }
  return kit;
}

function generateTextures(s) {
  const r = (v) => Math.round(v * s);
  return {
    puff1: createAnimePuff(r(96), 1234),
    puff2: createAnimePuff(r(96), 5678),
    puff3: createAnimePuff(r(96), 9012),
    puff4: createAnimePuff(r(96), 3456),
    puff5: createAnimePuff(r(112), 7890),

    puffSm1: createAnimePuffSmall(r(64), 2345),
    puffSm2: createAnimePuffSmall(r(64), 6789),
    puffSm3: createAnimePuffSmall(r(64), 1357),

    chunk: createChunk(r(12), 255, 255, 255, 0.85),
    chunkIce: createChunk(r(12), 210, 235, 255, 0.75),

    circle: createChunk(r(24), 255, 255, 255, 0.9),
    circleIce: createChunk(r(24), 220, 240, 255, 0.8),

    ring: createCloudRing(r(160), r(14), 4321),
    ringAlt: createCloudRing(r(160), r(14), 8765),
    ringThick: createCloudRing(r(160), r(17), 1597),

    speedLine: createSpeedLine(r(80), r(3), 255, 255, 255, 0.95),
    speedLineIce: createSpeedLine(r(80), r(3), 220, 240, 255, 0.85),
    speedLineThin: createSpeedLine(r(60), r(2), 255, 255, 255, 0.8),
    speedLineThick: createSpeedLine(r(80), r(5), 255, 255, 255, 0.9),

    saltGrain: createChunk(r(6), 255, 255, 255, 1.0),
    saltClump: createChunk(r(14), 255, 255, 255, 0.95),

    spark: createSpark(r(16)),
    sparkSmall: createSpark(r(10)),

    groundStreak: createGroundStreak(r(60), r(3)),
    groundStreakThin: createGroundStreak(r(40), r(2)),

    bluePuff1: createBluePuff(r(96), 2468),
    bluePuff2: createBluePuff(r(96), 1357),
    bluePuff3: createBluePuff(r(96), 8024),
    bluePuff4: createBluePuff(r(112), 5791),
    circleBlue: createChunk(r(24), 80, 160, 255, 0.9),
    chunkBlue: createChunk(r(12), 100, 180, 255, 0.85),

    matadorPuff1: createMatadorPuff(r(96), 3141),
    matadorPuff2: createMatadorPuff(r(96), 5926),
    matadorPuff3: createMatadorPuff(r(96), 7182),
    matadorPuff4: createMatadorPuff(r(112), 8453),
    circleMatador: createChunk(r(24), 255, 220, 90, 0.95),
    chunkMatador: createChunk(r(12), 232, 197, 71, 0.92),
    circleGold: createChunk(r(24), 255, 248, 150, 0.95),
    chunkGold: createChunk(r(12), 255, 238, 110, 0.92),

    // ── HIT VFX OVERHAUL (Phase A) — cel-burst impact kit ──────────
    // Flat-shaded, dark-keylined impact shapes (blots, ejecta petals,
    // debris chips, darts, powder) baked per status palette. Consumed by
    // the `hitImpact` preset / `emitCelImpact`. Replaces the deleted
    // radial-spark `hitSpark*` textures + gold perfect-ender textures.
    impact: buildImpactTextures(r),

    // ── GRAB-ARMOR ABSORB textures ─────────────────────────────────
    // Abigail-style pink absorb VFX: ONE ring that expands from a
    // small bright ring (with flashy content INSIDE) to a big ring
    // that WRAPS around the entire player. NO content inside the
    // big ring — the inner flash fades as the ring grows past it.

    // The single ring used throughout the absorb. Bright magenta
    // stroke + strong halo + NO inner fill (coreAlpha 0). When small,
    // the cross flare + hot core sit visibly INSIDE its perimeter;
    // when expanded, the player sits cleanly inside the ring instead
    // of being washed out by an interior glow.
    armorAbsorbWrapRing: createCrispRing(r(240), {
      stroke: [255, 80, 135],
      strokeAlpha: 1.0,
      glow: [255, 110, 165],
      glowAlpha: 0.7,
      core: [0, 0, 0],
      coreAlpha: 0,
      simple: false,
      crisp: false,
      thin: false,
    }),
    // 8-point pink cross flare — the bright "content INSIDE the small
    // ring" beat. Short lifetime so it's only visible while the ring
    // is small.
    armorAbsorbCross: createCrossFlare(r(140), 255, 90, 140),
    // White-centered bloom — the BANG of light at the very moment of
    // impact. Pops bigger than the small ring then fades fast; reads
    // as the "flash" before the ring takes over.
    armorAbsorbFlash: createFlashBloom(r(160), 255, 110, 160),
    // Hot pinpoint core — the bright white-pink center inside the
    // small ring. Even shorter lifetime than the cross flare.
    armorAbsorbCore: createChunk(r(28), 255, 180, 200, 1.0),
    // Tiny bright pink spark — used for the outward scatter sparks
    // around the big ring + the residual upward "mist" tail.
    armorAbsorbSpark: createChunk(r(6), 255, 220, 230, 1.0),

    // Grab-armor break: white-yellow glass shards (ring texture kept for
    // possible absorb-style reuse; break VFX no longer spawns smoke rings).
    armorBreakRing: createColoredCloudRing(r(170), r(15), 4091, {
      shadow: [220, 200, 110],
      body: [255, 240, 170],
      highlight: [255, 255, 230],
    }),
    glassShard1: createGlassShard(r(56), 1217),
    glassShard2: createGlassShard(r(56), 3491),
    glassShard3: createGlassShard(r(48), 5783),
    glassShard4: createGlassShard(r(64), 7129),
    glassFleck: createChunk(r(6), 255, 250, 220, 1.0),

    // ── OPEN-PALM THRUST — WHITE two-armed push textures ────────────
    // A quick, powerful two-armed shove, so the FX is a DIRECTIONAL white
    // force read (the game's white + ice-blue accent palette), not a radial
    // ring. The core of it is a forward-bulging CRESCENT "bow wave" — three
    // tiers graduating from a hot white leading edge to a cooler, fainter
    // ice-white trailing wave — so stacked/expanding copies read as a clean
    // anime push shoved down the thrust axis.
    palmThrustArc1: createArcWave(r(160), {
      stroke: [255, 255, 255], strokeAlpha: 1.0,
      glow: [238, 247, 255], glowAlpha: 0.85,
    }),
    palmThrustArc2: createArcWave(r(160), {
      stroke: [240, 249, 255], strokeAlpha: 1.0,
      glow: [200, 228, 255], glowAlpha: 0.78,
    }),
    palmThrustArc3: createArcWave(r(160), {
      stroke: [214, 235, 255], strokeAlpha: 0.95,
      glow: [168, 208, 255], glowAlpha: 0.7,
    }),
    // Pure white flash — the hot "bang" of light at the palm contact.
    palmThrustFlash: createFlashBloom(r(180), 255, 255, 255),
    // Bright white speed-line streak — thicker canvas for a bold arm read.
    palmThrustStreak: createGlowingSpeedLine(r(96), r(7), {
      stroke: [255, 255, 255], strokeAlpha: 1.0,
      glow: [224, 240, 255], glowAlpha: 0.95,
    }),
    // Small GLOWY BLUE ice particles kicked off the palms (snowy-sumo
    // flavor). Bright near-white core → ice-blue body → DARK NAVY keyline
    // rim, rendered on normal blend so the dark rim separates them from the
    // game's bright blue background (additive blue-on-blue just washes out).
    // Small + round (no stretched slivers) = a spray of glowing frost sparks.
    palmThrustIceGlow: createGlowDotKeyed(r(20), "240,250,255", "120,195,255", "6,18,50"),
    palmThrustIceChip: createGlowDotKeyed(r(14), "225,242,255", "95,170,255", "4,12,40"),

    // Hit ring core — premium center burst (star flare + bloom + streaks).
    hitCoreFlash: createFlashBloom(r(160), 255, 255, 255),
    hitCoreFlashGold: createFlashBloom(r(160), 255, 210, 80),
    hitCoreFlashPurple: createFlashBloom(r(160), 170, 120, 255),
    hitCoreFlashRed: createFlashBloom(r(160), 255, 60, 50),
    hitCoreFlashAmber: createFlashBloom(r(160), 255, 230, 100),
    hitCoreCross: createCrossFlare(r(140), 255, 255, 255, "255,252,255", "255,255,255", "240,248,255"),
    hitCoreCrossGold: createCrossFlare(r(140), 255, 200, 60, "255,246,200", "255,220,110", "255,195,60"),
    hitCoreCrossPurple: createCrossFlare(r(140), 170, 120, 255, "235,220,255", "180,130,255", "150,90,235"),
    hitCoreCrossRed: createCrossFlare(r(140), 255, 60, 50, "255,200,188", "255,70,60", "220,28,28"),
    hitCoreCrossAmber: createCrossFlare(r(140), 255, 230, 100, "255,252,220", "255,235,120", "255,210,80"),
    hitCorePin: createChunk(r(24), 255, 255, 255, 1.0),

    // Hit ring smoke — cel cloud puffs for circumference burst.
    hitRingSmoke1: createHitRingSmokePuff(r(64), 8201),
    hitRingSmoke2: createHitRingSmokePuff(r(64), 8202),
    hitRingSmoke3: createHitRingSmokePuff(r(64), 8203),

  };
}

// ─── Presets ────────────────────────────────────────────────────────

function rand(min, max) {
  return min + Math.random() * (max - min);
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickPuff(textures) {
  return pick([textures.puff1, textures.puff2, textures.puff3, textures.puff4, textures.puff5]);
}
function pickSmallPuff(textures) {
  return pick([textures.puffSm1, textures.puffSm2, textures.puffSm3]);
}
function pickBluePuff(textures) {
  return pick([textures.bluePuff1, textures.bluePuff2, textures.bluePuff3, textures.bluePuff4]);
}
function pickMatadorPuff(textures) {
  return pick([textures.matadorPuff1, textures.matadorPuff2, textures.matadorPuff3, textures.matadorPuff4]);
}

const HIT_CORE_TEXTURES = {
  white:  { flash: "hitCoreFlash",       cross: "hitCoreCross" },
  gold:   { flash: "hitCoreFlashGold",   cross: "hitCoreCrossGold" },
  purple: { flash: "hitCoreFlashPurple", cross: "hitCoreCrossPurple" },
  red:    { flash: "hitCoreFlashRed",    cross: "hitCoreCrossRed" },
  amber:  { flash: "hitCoreFlashAmber",  cross: "hitCoreCrossAmber" },
};

function pickHitRingSmoke(textures) {
  return pick([textures.hitRingSmoke1, textures.hitRingSmoke2, textures.hitRingSmoke3]);
}

// sliding.png foot pads (unflipped local X). World = x + facing * local.
// Measured from yellow sole centroids on the 960² asset at fighter width 12.3%.
const SLIDE_FOOT_LEFT = -50;
const SLIDE_FOOT_RIGHT = 39;
// Just clear the transparent pad under the soles (~6px game).
const SLIDE_FOOT_Y_LIFT = 6;

// Ice-slide mist is FACING-mirrored (not travel-dir). P1's good look faces
// right (facing=-1) with the blue wake off the art-left pad trailing toward
// their back (world-left). Opposite facing must mirror that sprite-relative
// read — wakeDir = facing does that ( -1 → trail left, +1 → trail right ).
function slideArtFeet(x, facing) {
  const face = facing === -1 ? -1 : 1;
  return {
    face,
    wakeDir: face,
    artLeftX: x + face * SLIDE_FOOT_LEFT,
    artRightX: x + face * SLIDE_FOOT_RIGHT,
  };
}

// ─── HIT VFX OVERHAUL (Phase A) — cel-burst impact emitter ───────────
// One parameterized emitter used by EVERY hit (replaces the deleted
// radial `emitImpactSparks` + `hitSpark*` presets). Draws "displaced
// matter": a snapping flash-blot -> torn-blot core, a directional ejecta
// crown fanned along the knockback, falling debris, disciplined darts, and
// a brief powder bloom. Flat cel shapes with dark keylines (Craft Rules),
// NOT rings and NOT even radial spoke wheels (Banned Looks). cx/cy are
// already screen-space (GAME_H - y).
//
//   tier    — "slap" | "burst" | "charged" (density / scale)
//   dir     — knockback sign (+1 right / -1 left); the crown fans this way
//   palette — status palette key (see IMPACT_PALETTES / §4.2)
function emitCelImpact(engine, cx, cy, { tier = "slap", dir = 1, palette = "white" } = {}) {
  const T = engine.textures;
  const kit = (T.impact && (T.impact[palette] || T.impact.white)) || null;
  if (!kit) return;

  const d = dir >= 0 ? 1 : -1;
  const baseAng = d > 0 ? 0 : Math.PI; // fan center, horizontal along knockback
  const SPREAD = 1.134; // ±65° crown spread (Tuning dial: fan spread)

  const idx = tier === "charged" ? 2 : tier === "burst" ? 1 : 0;
  const blot = [40, 52, 66][idx];          // core size in game-px (tuning dial)
  const fragN = [3, 4, 5][idx];
  const petalN = [5, 7, 9][idx];
  const debrisN = [4, 6, 8][idx];
  const dartN = [3, 4, 5][idx];
  const powderN = [2, 3, 4][idx];

  // Seed shared by F1/F2 so the torn frame belongs to the same silhouette
  // family as the flash frame.
  const seedIdx = Math.floor(Math.random() * kit.blotF1.length);
  const f1rot = rand(-Math.PI, Math.PI);

  // ── 1 · FLASH BLOT (frame 1) — static jagged pop, snaps in, no fade ──
  engine.spawn({
    x: cx, y: cy, vx: 0, vy: 0, gravity: 0, drag: 1,
    size: blot, sizeEnd: blot * 1.08,
    alpha: 1, alphaEnd: 1,
    rotation: f1rot, rotationSpeed: 0,
    ease: "outCubic",
    maxLife: 0.06,
    texture: kit.blotF1[seedIdx],
    aboveFighters: true,
  });

  // ── 2 · TORN BLOT (frame 2) — snaps to replace F1, body-dominant ──
  engine.spawn({
    x: cx, y: cy, vx: 0, vy: 0, gravity: 0, drag: 1,
    size: blot * 1.15, sizeEnd: blot * 1.15,
    alpha: 1, alphaEnd: 1,
    rotation: f1rot + rand(-0.15, 0.15), rotationSpeed: 0,
    ease: "linear",
    maxLife: 0.08,
    delay: 0.06,
    texture: kit.blotF2[seedIdx],
    aboveFighters: true,
  });

  // ── 3 · FRAGMENTS — the blot dies by BREAKUP into chips off its rim ──
  for (let i = 0; i < fragN; i++) {
    const ang = rand(0, Math.PI * 2);
    const spd = rand(80, 190);
    const size = blot * rand(0.12, 0.2);
    engine.spawn({
      x: cx + Math.cos(ang) * blot * 0.28,
      y: cy + Math.sin(ang) * blot * 0.28,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      gravity: 240, drag: 0.9,
      size, sizeEnd: size * 0.7,
      alpha: 1, alphaEnd: 1,
      rotation: rand(0, Math.PI * 2), rotationSpeed: rand(-5, 5),
      ease: "outCubic",
      maxLife: rand(0.12, 0.18),
      delay: 0.14,
      texture: pick(kit.chip),
      aboveFighters: true,
    });
  }

  // ── 4 · EJECTA CROWN — directional petals fanned along knockback + a
  //        small back-splash toward the attacker (never a radial wheel) ──
  const backN = petalN >= 7 ? 2 : 1;
  const fwdN = petalN - backN;
  for (let i = 0; i < petalN; i++) {
    const isBack = i >= fwdN;
    const ang = isBack
      ? baseAng + Math.PI + rand(-0.4, 0.4)
      : baseAng + rand(-SPREAD, SPREAD);
    const spd = isBack ? rand(120, 240) : rand(300, 650);
    const vx = Math.cos(ang) * spd;
    const vy = Math.sin(ang) * spd - rand(0, 60);
    const size = blot * rand(0.4, 0.6);
    engine.spawn({
      x: cx, y: cy, vx, vy,
      gravity: 120, drag: 0.85,
      size, sizeEnd: size * 0.35,
      alpha: 1, alphaEnd: 1,
      rotation: Math.atan2(vy, vx), rotationSpeed: 0,
      stretchX: rand(1.4, 2.0),
      ease: "outExpo", easeAlpha: "outExpo",
      maxLife: rand(0.2, 0.32),
      texture: pick(kit.petal),
      aboveFighters: true,
    });
  }

  // ── 5 · DEBRIS CHIPS — heavier, spinning, arc up and fall (mid layer) ──
  for (let i = 0; i < debrisN; i++) {
    const ang = baseAng + rand(-SPREAD * 1.4, SPREAD * 1.4);
    const spd = rand(200, 480);
    const vx = Math.cos(ang) * spd;
    const vy = Math.sin(ang) * spd - rand(60, 180);
    const size = blot * rand(0.14, 0.24);
    engine.spawn({
      x: cx, y: cy, vx, vy,
      gravity: rand(500, 700), drag: 0.985,
      size, sizeEnd: size * 0.85,
      alpha: 1, alphaEnd: 1,
      rotation: rand(0, Math.PI * 2), rotationSpeed: rand(-6, 6),
      ease: "linear",
      maxLife: rand(0.3, 0.45),
      texture: pick(kit.chip),
    });
  }

  // ── 6 · DARTS — disciplined streak remnant, clustered inside the fan ──
  for (let i = 0; i < dartN; i++) {
    const ang = baseAng + rand(-SPREAD * 0.5, SPREAD * 0.5);
    const spd = rand(500, 900);
    const vx = Math.cos(ang) * spd;
    const vy = Math.sin(ang) * spd;
    const size = blot * rand(0.4, 0.7);
    engine.spawn({
      x: cx, y: cy, vx, vy,
      gravity: 80, drag: 0.86,
      size, sizeEnd: size * 0.5,
      alpha: 1, alphaEnd: 1,
      rotation: Math.atan2(vy, vx), rotationSpeed: 0,
      stretchX: rand(3, 6),
      ease: "outExpo", easeAlpha: "outQuad",
      maxLife: rand(0.1, 0.16),
      texture: kit.dart,
      aboveFighters: true,
    });
  }

  // ── 7 · POWDER — soft drift bloom (alpha fade allowed per Craft Rule 3) ──
  for (let i = 0; i < powderN; i++) {
    const ang = baseAng + rand(-1.4, 1.4);
    const spd = rand(40, 120);
    const size = blot * rand(0.5, 0.8);
    engine.spawn({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - rand(10, 40),
      gravity: 30, drag: 0.9,
      size, sizeEnd: size * 1.3,
      alpha: 0.5, alphaEnd: 0,
      rotation: rand(0, Math.PI * 2), rotationSpeed: rand(-1, 1),
      ease: "outCubic", easeAlpha: "linear",
      maxLife: rand(0.3, 0.45),
      delay: rand(0.03, 0.06),
      texture: pick(kit.powder),
    });
  }
}

// Clean anime smoke — center spawn, shoots past the ring with organic variation.
function emitHitImpactSmoke(engine, cx, cy, { tier = "slap" } = {}) {
  const T = engine.textures;
  const idx = tier === "charged" ? 2 : tier === "burst" ? 1 : 0;
  const scale = [1, 1.06, 1.12][idx];
  const ringR = [22, 28, 34][idx] * scale;
  const slots = [6, 7, 8][idx];
  const basePeak = [18, 20, 22][idx] * scale;

  const spawn = (cfg) => engine.spawn({ ...cfg, aboveFighters: true });
  const outwardSpeed = (travel, life, drag) => {
    const frames = life / 0.016;
    const dragTravel = 0.016 * (1 - drag ** frames) / (1 - drag);
    return travel / dragTravel;
  };

  for (let i = 0; i < slots; i++) {
    const ang =
      (i / slots) * Math.PI * 2 +
      rand(-0.16, 0.16) +
      (i % 2 === 0 ? rand(-0.05, 0.05) : 0);
    const life = rand(0.28, 0.38);
    const drag = rand(0.89, 0.92);
    const travel = ringR * rand(1.35, 1.58);
    const spd = outwardSpeed(travel, life, drag);
    const peak = basePeak * rand(0.9, 1.1);

    spawn({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * spd + rand(-6, 6),
      vy: Math.sin(ang) * spd + rand(-6, 6),
      gravity: rand(-4, 4),
      drag,
      size: peak * rand(0.4, 0.55),
      sizeEnd: peak * rand(1.12, 1.32),
      alpha: rand(0.64, 0.8),
      alphaEnd: 0,
      rotation: ang + rand(-0.2, 0.2),
      rotationSpeed: rand(-0.15, 0.15),
      ease: "outQuad",
      easeAlpha: "outQuad",
      maxLife: life,
      delay: rand(0, 0.02),
      texture: pickHitRingSmoke(T),
    });
  }
}

// Premium hit ring CENTER — layered starburst + bloom + directional streaks.
// Lives inside the CSS ring while it's small, fades before the ring empties.
function emitHitRingCore(engine, cx, cy, { tier = "slap", dir = 1, palette = "white" } = {}) {
  const T = engine.textures;
  const tex = HIT_CORE_TEXTURES[palette] || HIT_CORE_TEXTURES.white;
  const flashTex = T[tex.flash];
  const crossTex = T[tex.cross];
  if (!flashTex || !crossTex) return;

  const idx = tier === "charged" ? 2 : tier === "burst" ? 1 : 0;
  const scale = [1, 1.14, 1.3][idx];
  const fwd = dir >= 0 ? 1 : -1;
  const streakRot = fwd > 0 ? 0 : Math.PI;

  const bloomStart = [12, 14, 16][idx];
  const bloomEnd = [62, 78, 96][idx];
  const crossStart = [16, 20, 24][idx];
  const crossEnd = [78, 98, 124][idx];
  const pinStart = [6, 8, 10][idx];
  const pinEnd = [18, 24, 30][idx];
  const sparkleN = [4, 5, 6][idx];

  const front = (cfg) => engine.spawn({ ...cfg, aboveFighters: true });

  // Tight bloom — fills the ring interior with a contained flash.
  front({
    x: cx, y: cy, vx: 0, vy: 0, gravity: 0, drag: 1,
    size: bloomStart * scale, sizeEnd: bloomEnd * scale,
    alpha: 0.96, alphaEnd: 0,
    rotation: 0, rotationSpeed: 0,
    ease: "outExpo", easeAlpha: "linear",
    maxLife: 0.13,
    texture: flashTex,
    blendMode: "lighter",
  });

  // Inner twinkle sparks — crackle inside the ring perimeter.
  for (let i = 0; i < sparkleN; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(8, 28) * scale;
    front({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r * 0.88,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: rand(1.2, 2), sizeEnd: rand(4, 6) * scale,
      alpha: 1, alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outExpo", easeAlpha: "outQuad",
      maxLife: rand(0.06, 0.1),
      delay: i * 0.016,
      texture: T.sparkSmall,
      blendMode: "lighter",
    });
  }

  // Primary 8-point cross flare.
  front({
    x: cx, y: cy, vx: 0, vy: 0, gravity: 0, drag: 1,
    size: crossStart * scale, sizeEnd: crossEnd * scale,
    alpha: 1, alphaEnd: 0,
    rotation: rand(-0.05, 0.05), rotationSpeed: rand(-0.4, 0.4),
    ease: "outCubic", easeAlpha: "linear",
    maxLife: 0.15,
    texture: crossTex,
    blendMode: "lighter",
  });

  // Secondary cross — interleaved 22.5° for a dense 16-spoke star.
  front({
    x: cx, y: cy, vx: 0, vy: 0, gravity: 0, drag: 1,
    size: crossStart * 0.92 * scale, sizeEnd: crossEnd * 0.88 * scale,
    alpha: 0.82, alphaEnd: 0,
    rotation: Math.PI / 8 + rand(-0.04, 0.04),
    rotationSpeed: rand(-0.3, 0.3),
    ease: "outCubic", easeAlpha: "linear",
    maxLife: 0.14,
    delay: 0.012,
    texture: crossTex,
    blendMode: "lighter",
  });

  // Hot pinpoint nucleus.
  front({
    x: cx, y: cy, vx: 0, vy: 0, gravity: 0, drag: 1,
    size: pinStart * scale, sizeEnd: pinEnd * scale,
    alpha: 1, alphaEnd: 0,
    rotation: 0, rotationSpeed: 0,
    ease: "outExpo", easeAlpha: "outQuad",
    maxLife: 0.1,
    texture: T.hitCorePin,
    blendMode: "lighter",
  });

  // Directional impact streaks — snap forward along the hit (AAA speed-line read).
  const streakCount = [3, 4, 5][idx];
  for (let i = 0; i < streakCount; i++) {
    const yOff = (i - (streakCount - 1) / 2) * rand(5, 9);
    const stretch = rand(14, 22) * scale;
    const thick = rand(2, 3.5);
    const spd = rand(320, 520) * scale;
    front({
      x: cx + fwd * rand(-2, 4),
      y: cy + yOff,
      vx: fwd * spd,
      vy: rand(-18, 18),
      gravity: 0,
      drag: 0.82,
      size: thick,
      sizeEnd: thick * 0.55,
      alpha: rand(0.88, 1),
      alphaEnd: 0,
      rotation: streakRot,
      rotationSpeed: 0,
      ease: "outExpo",
      easeAlpha: "outQuad",
      maxLife: rand(0.07, 0.11),
      delay: rand(0, 0.02),
      texture: T.speedLineThin,
      stretchX: stretch,
      blendMode: "lighter",
    });
  }

  emitHitImpactSmoke(engine, cx, cy, { tier, dir, palette });
}

const PRESETS = {

  // ── OPEN-PALM THRUST — force cone ──────────────────────────────────
  // Glow streaks, sparks, and core flash on a hard open-palm thrust.
  //
  //   x, y  — thrust ORIGIN in game space (sprite center, chest height).
  //           Caller passes the exact center the hit-spark uses.
  //   dir   — forward SCREEN-x sign (+1 = right, -1 = left). Caller passes
  //           -facing (the authoritative forward, see gameFunctions
  //           auto-facing) so the cone ALWAYS fires toward the opponent,
  //           never backward.
  palmThrust(engine, { x, y, dir = 1, owner = null, scale = 1 }) {
    const cx = x;
    const cy = GAME_H - y;
    const d = dir >= 0 ? 1 : -1;
    const T = engine.textures;
    // Pocket-range shrinks the whole cone so it doesn't bloom through both
    // bodies; tip keeps scale 1.
    const s = Math.max(0.45, Math.min(1, scale));

    // No artificial lead: the cone fires when the server confirms the thrust,
    // which already lands ~a network hop into the move — adding a lead on top
    // made it read as appearing AFTER the strike. Spawn immediately.
    const LEAD = 0;

    // ── PALM ANCHOR ────────────────────────────────────────────────
    // The rings are born AT the flipper palm — forward of body center and
    // raised to ~shoulder height (the slap1 pose extends the flipper
    // up-and-forward). Everything anchors here so the effect hugs the
    // player instead of floating out as a giant tunnel.
    const PALM_FWD = 50 * s; // px forward from body center to the palm
    const PALM_UP = -6;  // px up from chest to the raised flipper (negative = lower)
    const palmX = cx + d * PALM_FWD;
    const palmY = cy - PALM_UP;
    const RING_BACK = 24 * s;  // px back from palm toward player center
    const ringX = palmX - d * RING_BACK;
    const RING_DOWN = 6;  // px lower on screen for ring + forward streaks
    const ringY = palmY + RING_DOWN;
    const streakCenterY = ringY;
    // Point along thrust — the half behind the anchor extends back into the arm/body.
    const streakRot = d > 0 ? 0 : Math.PI;
    const streakSpawnX = ringX - d * 56 * s;
    const flashX = ringX - d * 2;
    const palmFx = (cfg) => ({
      ...cfg,
      palmThrustFx: true,
      palmThrustOwner: owner,
    });

    // ═══════════════════════════════════════════════════════════════════
    // ANIME TWO-ARMED PALM PUSH — a clean DIRECTIONAL force read, not a
    // cloud and not a radial ring. The attack is a flat two-palm shove, so
    // the FX is: a tight white flash at the palms, a forward-bulging
    // CRESCENT "bow wave" shoved down the thrust axis (the push itself), a
    // fan of forward WHITE SPEED LINES (the whoosh), and ICE SHARDS kicked
    // off the palms. Fast + snappy, nothing floats or lingers.
    // ═══════════════════════════════════════════════════════════════════

    // ── CORE FLASH — tight white pop of light right at the palms. Small +
    // fast (no big soft bloom that reads as a blob).
    engine.spawn({
      x: flashX, y: streakCenterY,
      vx: 0, vy: 0, gravity: 0, drag: 0.9,
      size: 26 * s, sizeEnd: 58 * s,
      alpha: 1, alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic", easeAlpha: "outCubic",
      maxLife: 0.13, delay: LEAD,
      texture: T.palmThrustFlash,
      stretchX: 1.0,
      blendMode: "lighter",
      aboveFighters: true,
      palmThrustFx: true,
      palmThrustOwner: owner,
    });

    // ── CRESCENT BOW WAVE — the "push". Forward-bulging arcs launched off
    // the palms down the thrust axis, staggered in time so they read as a
    // wave of force shoved outward (directional, NOT a radial ring). Rotated
    // by streakRot so the bulge always points at the opponent; each rides
    // forward and expands. Tall (stretchX < 1) so the wave stands vertical
    // across the opponent's body like a shove of air.
    const WAVES = [
      { tex: T.palmThrustArc1, s0: 32, s1: 82, life: 0.2, tilt: 0.82, alpha: 1.0, spd: 150, delay: 0.0 },
      { tex: T.palmThrustArc2, s0: 38, s1: 112, life: 0.24, tilt: 0.8, alpha: 0.85, spd: 120, delay: 0.05 },
      { tex: T.palmThrustArc3, s0: 44, s1: 142, life: 0.28, tilt: 0.78, alpha: 0.62, spd: 95, delay: 0.1 },
    ];
    for (const w of WAVES) {
      engine.spawn(palmFx({
        x: flashX - d * 6, y: streakCenterY,
        vx: d * w.spd * s, vy: 0, gravity: 0, drag: 0.88,
        size: w.s0 * s, sizeEnd: w.s1 * s,
        alpha: w.alpha, alphaEnd: 0,
        rotation: streakRot, rotationSpeed: 0,
        ease: "outExpo", easeAlpha: "outCubic",
        maxLife: w.life, delay: LEAD + w.delay,
        texture: w.tex,
        stretchX: w.tilt,
        blendMode: "lighter",
        aboveFighters: true,
      }));
    }

    // ── SPEED LINES — the signature whoosh: sharp WHITE lines fired forward
    // down the thrust axis, fanned around palm height. Fast + short so they
    // snap out and vanish. Back layer wraps behind the arm, front reads over.
    const FWD_STREAKS = [
      { yOff: -18, stretch: 24, thick: 6.5, behind: true, alpha: 1, spd: 220 },
      { yOff: 0, stretch: 26, thick: 6.5, behind: true, alpha: 1, spd: 260 },
      { yOff: 18, stretch: 24, thick: 6.5, behind: true, alpha: 1, spd: 220 },
      { yOff: -10, stretch: 20, thick: 5.2, behind: false, alpha: 0.92, spd: 300 },
      { yOff: 8, stretch: 22, thick: 5.6, behind: false, alpha: 0.94, spd: 300 },
      { yOff: 20, stretch: 18, thick: 5, behind: false, alpha: 0.88, spd: 260 },
    ];
    for (const slot of FWD_STREAKS) {
      engine.spawn(palmFx({
        x: streakSpawnX + d * rand(-2, 2),
        y: streakCenterY + slot.yOff * s + rand(-2, 2),
        vx: d * slot.spd * s, vy: 0,
        gravity: 0, drag: 0.86,
        size: slot.thick * s, sizeEnd: slot.thick * 0.7 * s,
        alpha: slot.alpha, alphaEnd: 0,
        rotation: streakRot, rotationSpeed: 0,
        ease: "outCubic", easeAlpha: "outQuad",
        maxLife: rand(0.12, 0.18),
        delay: LEAD,
        texture: T.palmThrustStreak,
        stretchX: slot.stretch * (0.7 + 0.3 * s),
        blendMode: "lighter",
        aboveFighters: !slot.behind,
      }));
    }

    // ── GLOWY BLUE ICE PARTICLES — a spray of small round frost sparks
    // kicked forward off the palms. Small + ice-blue with a baked dark
    // keyline (no stretched slivers). NORMAL blend (NOT additive) so the
    // dark rim separates them from the bright blue background.
    //
    // MOMENTUM: spawned BACK at the palms/arm and driven in a TIGHT forward
    // cone with almost no drag and barely any gravity, so they carry forward
    // and glide out as they fade — a committed forward push, NOT the
    // lightweight "shove out and instantly stop" (feather) look that heavy
    // drag + gravity + an upward pop was producing.
    const iceCount = s < 0.75 ? 7 : 11;
    for (let i = 0; i < iceCount; i++) {
      const ang = (d === 1 ? 0 : Math.PI) + rand(-0.26, 0.26);
      const spd = rand(150, 320) * s;
      const size = rand(2.5, 5.5) * s;
      engine.spawn({
        x: flashX - d * rand(4, 22), y: streakCenterY + rand(-15, 15),
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        gravity: 40, drag: 0.95,
        size, sizeEnd: size * 0.5,
        alpha: rand(0.72, 0.92), alphaEnd: 0,
        rotation: 0, rotationSpeed: 0,
        ease: "linear", easeAlpha: "inQuad",
        maxLife: rand(0.13, 0.22),
        delay: LEAD + rand(0, 0.05),
        texture: i % 3 === 0 ? T.palmThrustIceChip : T.palmThrustIceGlow,
        aboveFighters: true,
        palmThrustFx: true,
        palmThrustOwner: owner,
      });
    }
  },

  // Fired once at dash start — a single hand-drawn smoke swoosh sprite that
  // stays at the launch point and trails behind the fighter as they zip away.
  // (Replaces the old procedural burst: ground dust + speed lines + ice chips +
  // ring + sparks.)
  dashStart(engine, { x, y, direction, facing }) {
    const dir = direction || facing || 1;
    const footX = x;
    const footY = GAME_H - y;
    spawnDashSmoke(engine, footX, footY, { dir, maxLife: 0.42 });
  },

  // Fired once when the charged-attack (flying headbutt) lunge begins — a single
  // smoke swoosh sprite that stays at the launch point and trails behind the
  // lunging fighter. Same one-shot approach as dashStart, own sheet/tuning.
  chargedLungeSmoke(engine, { x, y, direction, facing }) {
    const dir = direction || facing || 1;
    const footX = x;
    const footY = GAME_H - y;
    spawnChargedSmoke(engine, footX, footY, { dir, maxLife: 0.46 });
  },

  // Called every ~45ms during the dash. Bright sparks arcing down from the feet
  // like ice skate blades grinding — visually distinct from charged attack's static speed lines.
  dashSparkTrail(engine, { x, y, direction }) {
    const dir = direction || 1;
    const footX = x;
    const footY = GAME_H - y;

    // Bright ice sparks — short-lived, high gravity, arc downward
    for (let i = 0; i < 3; i++) {
      const spd = rand(60, 160);
      const angle = rand(-0.3, 0.5);
      engine.spawn({
        x: footX + -dir * rand(0, 12) + rand(-4, 4),
        y: footY - rand(4, 12),
        vx: -dir * Math.cos(angle) * spd + rand(-20, 20),
        vy: -Math.abs(Math.sin(angle)) * spd * 0.4 + rand(-25, -5),
        gravity: 600,
        drag: 0.93,
        size: rand(3, 6),
        sizeEnd: rand(1, 2),
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.08, 0.16),
        texture: pick([engine.textures.spark, engine.textures.sparkSmall]),
        blendMode: "lighter",
      });
    }

    // Occasional larger spark that lingers a bit more
    if (Math.random() < 0.4) {
      engine.spawn({
        x: footX + -dir * rand(2, 8),
        y: footY - rand(6, 14),
        vx: -dir * rand(30, 80) + rand(-10, 10),
        vy: rand(-40, -15),
        gravity: 450,
        drag: 0.95,
        size: rand(5, 8),
        sizeEnd: rand(2, 3),
        alpha: rand(0.9, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        rotationSpeed: 0,
        maxLife: rand(0.14, 0.22),
        texture: engine.textures.spark,
        blendMode: "lighter",
      });
    }

    // Ground streaks — stay nearly stationary, fade in place to leave a "trail" on the ice
    engine.spawn({
      x: footX + -dir * rand(2, 16),
      y: footY - rand(1, 4),
      vx: -dir * rand(5, 15),
      vy: 0,
      gravity: 0,
      drag: 0.98,
      size: rand(3, 5),
      sizeEnd: rand(2, 3),
      alpha: rand(0.5, 0.7),
      alphaEnd: 0,
      rotation: 0,
      rotationSpeed: 0,
      ease: "linear",
      easeAlpha: "inQuad",
      maxLife: rand(0.25, 0.4),
      texture: pick([engine.textures.groundStreak, engine.textures.groundStreakThin]),
      stretchX: rand(3, 6),
    });
  },

  // ── ICE SLIDE (SHIFT-held post-dodge) ────────────────────────────────────
  // Premium skate-blade FX pinned to sliding.png. Blue mist is facing-mirrored
  // to match P1's good look (face right → wake off art-left pad toward back);
  // opposite facing uses the same sprite-relative layout via wakeDir = facing.

  // One-shot commitment burst when the slide locks in after dodge land.
  // variant: "redirect" → tighter dig-reversal burst (see iceSlideRedirect).
  iceSlideStart(engine, opts = {}) {
    if (opts.variant === "redirect") {
      PRESETS.iceSlideRedirect(engine, opts);
      return;
    }
    const { x, y, direction, facing } = opts;
    const footY = GAME_H - y - SLIDE_FOOT_Y_LIFT;
    const { wakeDir, artLeftX, artRightX } = slideArtFeet(x, facing);

    // Soft frost bloom — bias toward the wake side (P1-good layout).
    for (const fx of [artLeftX, artRightX]) {
      const size = rand(22, 30);
      engine.spawn({
        x: fx + wakeDir * rand(0, 8) + rand(-3, 3),
        y: footY - size * 0.35,
        vx: wakeDir * rand(18, 40) + rand(-8, 8),
        vy: rand(-6, 2),
        gravity: 12,
        drag: 0.92,
        size,
        sizeEnd: size * rand(0.4, 0.55),
        alpha: rand(0.6, 0.8),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-0.6, 0.6),
        maxLife: rand(0.32, 0.42),
        texture: pickBluePuff(engine.textures),
      });
    }

    // Expanding frost scuff ring at contact.
    engine.spawn({
      x,
      y: footY - 5,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      size: 10,
      sizeEnd: 42,
      alpha: 0.55,
      alphaEnd: 0,
      rotation: 0,
      rotationSpeed: 0,
      ease: "outExpo",
      easeAlpha: "outCubic",
      maxLife: 0.28,
      texture: engine.textures.ring,
      stretchX: 2.8,
    });

    // Hot blade sparks + ice chips kicked sideways off both feet.
    for (let i = 0; i < 8; i++) {
      const fx = i % 2 === 0 ? artLeftX : artRightX;
      const side = i % 2 === 0 ? -1 : 1;
      const spd = rand(90, 200);
      const lift = rand(0.2, 0.75);
      engine.spawn({
        x: fx + rand(-4, 4),
        y: footY - rand(2, 8),
        vx: side * Math.cos(lift) * spd + wakeDir * rand(20, 60),
        vy: -Math.abs(Math.sin(lift)) * spd * 0.55 - rand(10, 35),
        gravity: 520,
        drag: 0.94,
        size: rand(3.5, 6.5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.85, 1),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-4, 4),
        maxLife: rand(0.16, 0.28),
        texture: pick([
          engine.textures.spark,
          engine.textures.sparkSmall,
          engine.textures.palmThrustIceGlow,
        ]),
        blendMode: "lighter",
      });
    }

    for (let i = 0; i < 5; i++) {
      const fx = i % 2 === 0 ? artLeftX : artRightX;
      const side = Math.random() < 0.5 ? -1 : 1;
      engine.spawn({
        x: fx + rand(-3, 3),
        y: footY - rand(1, 5),
        vx: side * rand(50, 130) + wakeDir * rand(10, 40),
        vy: rand(-55, -12),
        gravity: 380,
        drag: 0.95,
        size: rand(3, 6),
        sizeEnd: rand(1, 2.5),
        alpha: rand(0.7, 0.95),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-8, 8),
        maxLife: rand(0.22, 0.36),
        texture: pick([
          engine.textures.chunkIce,
          engine.textures.circleIce,
          engine.textures.palmThrustIceChip,
        ]),
      });
    }
  },

  // Accepted ice-slide bunny-hop redirect — same dashStart swoosh sheet as a
  // grounded dodge, at ~60% scale / shorter life. Orient from NEW travel dir
  // (not facing). Keeps pre-baseline sheet registration (no DASH_SMOKE nudge).
  iceSlideRedirect(engine, { x, y, direction, facing }) {
    const travel = direction || facing || 1;
    const dir = travel > 0 ? 1 : -1;
    const footX = x;
    const footY = GAME_H - y;
    spawnDashSmoke(engine, footX, footY, {
      dir,
      scale: 0.6,
      alpha: 0.85,
      maxLife: 0.26,
      applySheetBaseline: false,
    });
  },

  // Continuous emission (~36ms) while ice-sliding. Dual-foot blade grind;
  // blue mist is facing-mirrored (see slideArtFeet), not travel-dir based.
  iceSlideTrail(engine, { x, y, direction, facing, speed = 0.7, braking = false }) {
    const footY = GAME_H - y - SLIDE_FOOT_Y_LIFT;
    const s = Math.min(Math.max(speed, 0.25), 1.5);
    const brake = braking ? 1.55 : 1;
    const { wakeDir, artLeftX, artRightX } = slideArtFeet(x, facing);
    const feet = [artLeftX, artRightX];
    const digX = artRightX;

    // Soft frost mist from BOTH pads — facing-mirrored wake direction.
    // One puff per foot per tick (was piled on a single pad before).
    const mistN = Math.max(1, Math.round((0.7 + s * 0.6) * (braking ? 1.3 : 1)));
    for (const footX of feet) {
      for (let i = 0; i < mistN; i++) {
        const size = rand(12, 20) * (0.85 + s * 0.25);
        engine.spawn({
          x: footX + wakeDir * rand(4, 18) + rand(-2, 2),
          y: footY - size * 0.38 + rand(-1, 2),
          vx: wakeDir * rand(22, 48) * (0.7 + s * 0.35) + rand(-4, 4),
          vy: rand(-3, 2),
          gravity: 7,
          drag: 0.95,
          size,
          sizeEnd: size * rand(0.4, 0.6),
          alpha: rand(0.45, 0.7) * (0.75 + s * 0.25),
          alphaEnd: 0,
          ease: "outCubic",
          easeAlpha: "inQuad",
          rotationSpeed: rand(-0.4, 0.4),
          maxLife: rand(0.26, 0.4),
          texture: pickBluePuff(engine.textures),
        });
      }
    }

    // Blade sparks — bright ice-cyan glints arcing off both feet.
    const sparkN = Math.round(2 + s * 2 * brake);
    for (let i = 0; i < sparkN; i++) {
      const fx = i % 2 === 0 ? artLeftX : artRightX;
      const spd = rand(50, 140) * (0.7 + s * 0.4);
      const angle = rand(-0.25, 0.55);
      engine.spawn({
        x: fx + wakeDir * rand(0, 8) + rand(-3, 3),
        y: footY - rand(3, 10),
        vx: wakeDir * Math.cos(angle) * spd + rand(-18, 18),
        vy: -Math.abs(Math.sin(angle)) * spd * 0.45 + rand(-28, -4),
        gravity: 580,
        drag: 0.93,
        size: rand(2.5, 5.5) * (0.85 + s * 0.2),
        sizeEnd: rand(0.8, 1.8),
        alpha: rand(0.85, 1),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.08, 0.16),
        texture: pick([
          engine.textures.spark,
          engine.textures.sparkSmall,
          engine.textures.palmThrustIceGlow,
        ]),
        blendMode: "lighter",
      });
    }

    // Twinkling frost pinpoints — the "sparkly ice" read.
    if (Math.random() < 0.55 + s * 0.25) {
      const fx = pick(feet);
      engine.spawn({
        x: fx + rand(-6, 6),
        y: footY - rand(4, 14),
        vx: wakeDir * rand(10, 40) + rand(-12, 12),
        vy: rand(-35, -8),
        gravity: 120,
        drag: 0.94,
        size: rand(3, 6),
        sizeEnd: rand(1, 2.5),
        alpha: rand(0.75, 1),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.14, 0.24),
        texture: pick([
          engine.textures.palmThrustIceGlow,
          engine.textures.palmThrustIceChip,
          engine.textures.circleIce,
        ]),
        blendMode: "lighter",
      });
    }

    // Frost scuff streaks from both pads.
    for (const footX of feet) {
      engine.spawn({
        x: footX + wakeDir * rand(2, 12),
        y: footY - rand(1, 3),
        vx: wakeDir * rand(4, 14),
        vy: 0,
        gravity: 0,
        drag: 0.98,
        size: rand(2.5, 4.5),
        sizeEnd: rand(1.5, 2.5),
        alpha: rand(0.45, 0.7) * (0.75 + s * 0.25),
        alphaEnd: 0,
        rotation: 0,
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inQuad",
        maxLife: rand(0.28, 0.45),
        texture: pick([engine.textures.groundStreak, engine.textures.groundStreakThin]),
        stretchX: rand(3.2, 6.5) * (0.85 + s * 0.25),
      });
    }

    // Occasional ice chips flicked sideways (more when braking / faster).
    const chipChance = 0.35 + s * 0.25 + (braking ? 0.3 : 0);
    if (Math.random() < chipChance) {
      const chipN = braking ? 3 : 1 + (Math.random() < s * 0.5 ? 1 : 0);
      for (let i = 0; i < chipN; i++) {
        const fx = braking && i === 0 ? digX : pick(feet);
        const side = Math.random() < 0.5 ? -1 : 1;
        engine.spawn({
          x: fx + rand(-3, 3),
          y: footY - rand(1, 5),
          vx: side * rand(40, 110) * brake + wakeDir * rand(15, 50) * s,
          vy: rand(-50, -8) * (braking ? 1.2 : 1),
          gravity: 360,
          drag: 0.94,
          size: rand(2.5, 5.5),
          sizeEnd: rand(1, 2),
          alpha: rand(0.65, 0.95),
          alphaEnd: 0,
          ease: "linear",
          easeAlpha: "outQuad",
          rotationSpeed: rand(-10, 10),
          maxLife: rand(0.18, 0.32),
          texture: pick([
            engine.textures.chunkIce,
            engine.textures.circleIce,
            engine.textures.palmThrustIceChip,
          ]),
        });
      }
    }

    // Dig plow — when braking, spray toward the look side (opposite wake).
    if (braking) {
      const lookDir = -wakeDir;
      for (let i = 0; i < 2; i++) {
        const size = rand(14, 22);
        engine.spawn({
          x: digX + lookDir * rand(2, 10) + rand(-3, 3),
          y: footY - size * 0.32,
          vx: lookDir * rand(8, 28) + rand(-14, 14),
          vy: rand(-8, 2),
          gravity: 14,
          drag: 0.91,
          size,
          sizeEnd: size * rand(0.35, 0.5),
          alpha: rand(0.55, 0.75),
          alphaEnd: 0,
          ease: "outCubic",
          easeAlpha: "inCubic",
          rotationSpeed: rand(-0.6, 0.6),
          maxLife: rand(0.2, 0.3),
          texture: pickBluePuff(engine.textures),
        });
      }
      // Extra hot grind sparks at the dig edge.
      for (let i = 0; i < 2; i++) {
        engine.spawn({
          x: digX + rand(-4, 4),
          y: footY - rand(2, 8),
          vx: wakeDir * rand(20, 70) + rand(-20, 20),
          vy: rand(-45, -10),
          gravity: 500,
          drag: 0.93,
          size: rand(4, 7),
          sizeEnd: rand(1.5, 2.5),
          alpha: rand(0.9, 1),
          alphaEnd: 0,
          ease: "linear",
          easeAlpha: "outQuad",
          rotationSpeed: 0,
          maxLife: rand(0.1, 0.18),
          texture: pick([engine.textures.spark, engine.textures.palmThrustIceGlow]),
          blendMode: "lighter",
        });
      }
    }
  },

  snowballTrail(engine, { x, y, direction }) {
    const dir = direction || 1;
    const ballX = x;
    const ballY = GAME_H - y - 100;

    // Small wispy puff left behind the snowball
    const size = rand(10, 18);
    engine.spawn({
      x: ballX + -dir * rand(8, 16),
      y: ballY + rand(-4, 4),
      vx: -dir * rand(10, 30),
      vy: rand(-6, 6),
      gravity: 8,
      drag: 0.95,
      size,
      sizeEnd: size * rand(0.2, 0.4),
      alpha: rand(0.4, 0.65),
      alphaEnd: 0,
      ease: "outCubic",
      easeAlpha: "inQuad",
      rotationSpeed: rand(-0.8, 0.8),
      maxLife: rand(0.25, 0.4),
      texture: pickSmallPuff(engine.textures),
    });

    // Tiny ice sparkle
    if (Math.random() < 0.5) {
      engine.spawn({
        x: ballX + -dir * rand(4, 12) + rand(-6, 6),
        y: ballY + rand(-8, 8),
        vx: -dir * rand(15, 40) + rand(-10, 10),
        vy: rand(-15, 5),
        gravity: 80,
        drag: 0.96,
        size: rand(2, 4),
        sizeEnd: rand(0.5, 1.5),
        alpha: rand(0.6, 0.9),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-3, 3),
        maxLife: rand(0.15, 0.25),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }
  },

  // Called every ~50ms on the GRABBED player while being push-carried.
  // `speed` 0–1 controls spawn count/size. Puffs are dropped in place and linger
  // so the trail builds up behind the moving player, then each puff fades individually.
  grabPushTrail(engine, { x, y, direction, speed }) {
    const dir = direction || 1;
    const footX = x;
    const footY = GAME_H - y;
    const s = Math.min(Math.max(speed || 0, 0), 1);
    if (s < 0.05) return;

    const puffCount = s > 0.4 ? 2 : 1;
    for (let i = 0; i < puffCount; i++) {
      const size = rand(20, 34) * (0.6 + s * 0.4);
      engine.spawn({
        x: footX + rand(-10, 10),
        y: footY - size / 2 + rand(-4, 2),
        vx: rand(-4, 4),
        vy: rand(-5, -1),
        gravity: 1,
        drag: 0.98,
        size,
        sizeEnd: size * rand(0.8, 1.0),
        alpha: rand(0.4, 0.65) * (0.5 + s * 0.5),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-0.2, 0.2),
        maxLife: rand(1.0, 1.6),
        texture: pickSmallPuff(engine.textures),
      });
    }

    const chipCount = s > 0.3 ? 2 : 1;
    for (let i = 0; i < chipCount; i++) {
      const angle = rand(-0.8, 0.8);
      const chipSpeed = rand(15, 50) * s;
      engine.spawn({
        x: footX + rand(-8, 8),
        y: footY - rand(1, 5),
        vx: Math.cos(angle) * chipSpeed + rand(-8, 8),
        vy: -Math.abs(Math.sin(angle)) * chipSpeed * 0.4 + rand(-12, -3),
        gravity: 200,
        drag: 0.94,
        size: rand(2, 5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.5, 0.85) * s,
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-4, 4),
        maxLife: rand(0.5, 0.8),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }
  },

  // Clinch strain sweat — the on-character balance tell. Small ice-white
  // droplets flick off the head/shoulders in short gravity arcs, the classic
  // sumo/anime "straining" read. Called on an interval while a clinched
  // player's balance is in the throwable zone; intensity ramps the count,
  // launch speed, and droplet size as balance approaches the kill threshold.
  clinchStrainSweat(engine, { x, y, facing, intensity = 0.5 }) {
    const t = Math.min(Math.max(intensity, 0), 1);
    const headX = x;
    // 88-112 read as neck height in playtests — true head/temple level sits higher
    const headY = GAME_H - y - rand(118, 140);
    const count = t > 0.75 ? 3 : rand(0, 1) < 0.7 ? 2 : 1;

    // FACING CONVENTION: the server sets facing = -1 when this player is on
    // the LEFT of the opponent (facing right), so direction-to-opponent is
    // -facing and AWAY from the opponent is +facing. Away is the only side
    // worth spraying: these render on the main canvas (behind the sprites),
    // so anything fired inward dies invisibly between the clinched bodies —
    // and inward sprays from both players read as crossing streams.
    const side = facing || 1;

    for (let i = 0; i < count; i++) {
      // Fan of launch angles from flat flicks to steep pops, all outward.
      // A small offset off the head's side keeps drops from materializing on
      // the sprite while still reading as flicking off THIS head, not floating
      // detached in the air beside it.
      const angle = rand(0.25, 1.0); // radians above horizontal
      const speed = rand(95, 150) * (0.65 + t * 0.55);
      const vx = side * Math.cos(angle) * speed;
      const vy = -Math.sin(angle) * speed;
      const size = rand(2.4, 4);
      engine.spawn({
        x: headX + side * rand(8, 18),
        y: headY + rand(-8, 8),
        vx,
        vy,
        gravity: 560,
        drag: 0.985,
        size,
        sizeEnd: size * 0.55,
        alpha: rand(0.8, 0.95),
        alphaEnd: 0,
        // Orient the droplet along its launch velocity and stretch on that
        // axis — a defined "droplet in flight" teardrop read instead of a
        // smeared horizontal blob. (Engine order: rotate, then scale-X.)
        rotation: Math.atan2(vy, vx),
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inQuad",
        maxLife: rand(0.34, 0.5),
        texture: pick([engine.textures.circle, engine.textures.circleIce]),
        stretchX: 1.9,
      });
    }
  },

  // Arm-clamp crackle — magenta electric burst from the clamped-effect sheet,
  // drawn over the victim's upper body. `scale` sizes the burst (big on the
  // connect frame, small for the sustained crackle while clamped).
  clampCrackle(engine, { x, y, scale = 1, alpha = 0.95 }) {
    const sheet = clampedEffectImg;
    if (!sheet || !sheet.complete || !sheet.naturalWidth) return;
    const drawSize = 130 * scale;
    engine.spawn({
      x: x + rand(-8, 8) * scale,
      y: GAME_H - y - 72 + rand(-10, 10) * scale,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      size: drawSize,
      sizeEnd: drawSize * 1.06,
      alpha,
      alphaEnd: 0,
      rotation: 0,
      rotationSpeed: 0,
      ease: "outCubic",
      easeAlpha: "inCubic",
      maxLife: 0.32,
      stretchX: rand(0, 1) < 0.5 ? -1 : 1,
      sheet,
      sheetCols: 4,
      sheetRows: 4,
      sheetStart: CLAMP_CRACKLE_FRAMES.start,
      sheetEnd: CLAMP_CRACKLE_FRAMES.end,
      aboveFighters: true,
      // Additive blend: the sheet's black debris lines vanish and the
      // magenta/white core reads as emitted LIGHT (electric energy) instead
      // of a translucent decal pasted over the sprite. This is the difference
      // between "glowing crackle" and "muddy sticker".
      blendMode: "lighter",
    });
  },

  // Called every ~50ms during the charged attack lunge (flying headbutt).
  // Big billowing clouds dropped behind the player at mid-body height, jet contrail style.
  chargedAttackTrail(engine, { x, y, direction, speed }) {
    const dir = direction || 1;
    const bodyX = x;
    const bodyY = GAME_H - y - 72;
    const s = Math.min(Math.max(speed || 0, 0), 1);
    if (s < 0.08) return;

    // Speed lines: fully opaque, sharp, no smokey fade. They appear and snap away.
    const lineCount = s > 0.5 ? 5 : 3;
    for (let i = 0; i < lineCount; i++) {
      const thickness = rand(2.5, 4.5);
      const stretch = rand(12, 22) * (0.6 + s * 0.4);
      engine.spawn({
        x: bodyX + dir * rand(10, 55),
        y: bodyY + rand(-30, 30),
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 1,
        size: thickness,
        sizeEnd: thickness,
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        rotation: 0,
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.12, 0.25),
        texture: pick([engine.textures.speedLine, engine.textures.speedLineIce]),
        stretchX: stretch,
      });
    }

    // Thinner accent lines further out
    for (let i = 0; i < (s > 0.3 ? 2 : 1); i++) {
      const thickness = rand(2, 3.5);
      const stretch = rand(10, 18) * (0.5 + s * 0.5);
      engine.spawn({
        x: bodyX + dir * rand(25, 70),
        y: bodyY + rand(-40, 40),
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 1,
        size: thickness,
        sizeEnd: thickness,
        alpha: rand(0.7, 0.95),
        alphaEnd: 0,
        rotation: 0,
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.08, 0.18),
        texture: pick([engine.textures.speedLineThin, engine.textures.speedLine]),
        stretchX: stretch,
      });
    }

    // Small ice chips for texture
    const chipCount = Math.max(1, Math.ceil(s * 2));
    for (let i = 0; i < chipCount; i++) {
      const chipSpeed = rand(30, 80) * s;
      engine.spawn({
        x: bodyX + dir * rand(25, 50) + rand(-6, 6),
        y: bodyY + rand(-8, 8),
        vx: dir * chipSpeed * rand(0.3, 1.0) + rand(-15, 15),
        vy: rand(-20, 10),
        gravity: 140,
        drag: 0.95,
        size: rand(2, 5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.5, 0.8) * s,
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-5, 5),
        maxLife: rand(0.2, 0.4),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }
  },

  // Pull reversal hop landing — lighter than a throw touchdown. Same smoke-puff
  // sprite, scaled/faded down by hop intensity.
  pullReversalLand(engine, { x, y, intensity }) {
    const footX = x;
    const footY = GAME_H - y - 12;
    const s = Math.min(Math.max(intensity || 0.5, 0), 1);
    spawnLandingSmoke(engine, footX, footY, {
      scale: 0.62 + s * 0.4,
      alpha: Math.min(1, 0.95 * s),
      maxLife: 0.44,
    });
  },

  // Clinch kill PULL: a heavy penguin slammed flat on the ice. The body lands
  // belly-down, so the impact reads WIDE and LOW — a broad horizontal shockwave
  // with snow/ice displaced sideways (and up) along the body, plus settling dust.
  // `intensity` scales the whole burst so the big initial slam is dramatic while
  // the diminishing bounce-hops just kick up light dust. `direction` (slide dir)
  // biases debris to trail behind the sliding body.
  clinchKillPullSlam(engine, { x, y, intensity, direction }) {
    const dir = direction || 1;
    const footX = x;
    const footY = GAME_H - y - 8;
    const s = Math.min(Math.max(intensity == null ? 1 : intensity, 0), 1);

    // ── SIDEWAYS SNOW/ICE SPRAY — displaced from under the belly to BOTH sides ──
    const sprayCount = Math.round(7 * s) + 2;
    for (let i = 0; i < sprayCount; i++) {
      // Bias outward to both sides; the trailing side gets a touch more.
      const side = i % 2 === 0 ? 1 : -1;
      const biased = side === -dir ? 1.15 : 0.9;
      const speed = rand(130, 300) * (0.6 + s * 0.4) * biased;
      const lift = rand(0.25, 0.7);
      engine.spawn({
        x: footX + side * rand(4, 20),
        y: footY - rand(2, 8),
        vx: side * Math.cos(lift) * speed + rand(-15, 15),
        vy: -Math.abs(Math.sin(lift)) * speed - rand(20, 70) * s,
        gravity: 700,
        drag: 0.95,
        size: rand(3, 7) * (0.7 + s * 0.5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.7, 0.95),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-6, 6),
        maxLife: rand(0.28, 0.5),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }

    // ── IMPACT SPARKS — only on the heavy hits, sharp bright flecks ──
    if (s > 0.55) {
      const sparkCount = Math.round(5 * s);
      for (let i = 0; i < sparkCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const angle = rand(0.2, 0.9);
        const spd = rand(160, 320) * s;
        engine.spawn({
          x: footX + side * rand(2, 10),
          y: footY - rand(2, 8),
          vx: side * Math.cos(angle) * spd + rand(-15, 15),
          vy: -Math.abs(Math.sin(angle)) * spd - rand(10, 40),
          gravity: 600,
          drag: 0.94,
          size: rand(4, 7),
          sizeEnd: rand(1, 2),
          alpha: rand(0.9, 1.0),
          alphaEnd: 0,
          ease: "linear",
          easeAlpha: "outQuad",
          rotationSpeed: 0,
          maxLife: rand(0.12, 0.22),
          texture: pick([engine.textures.spark, engine.textures.sparkSmall]),
          blendMode: "lighter",
        });
      }
    }
  },

  // Landing dust for a throw/jump touchdown. Now an animated smoke-puff sprite
  // instead of the old expanding rings (bigger impact than pull reversal).
  throwLand(engine, { x, y }) {
    const footX = x;
    const footY = GAME_H - y - 12;
    spawnLandingSmoke(engine, footX, footY, {
      scale: 1,
      alpha: 1,
      maxLife: 0.5,
    });
  },

  // Victim feet skid — a small dust kick under a slap victim as the hit shoves
  // them back. The body judder sells the IMPACT; this sells the DISPLACEMENT
  // (ground being lost on every hit). Deliberately small so rapid slap
  // exchanges layer puffs without whiting out the feet. dir = drift direction.
  slapSkidDust(engine, { x, y, dir = 1 }) {
    const footX = x;
    const footY = GAME_H - y - 12;
    spawnLandingSmoke(engine, footX - dir * 6, footY, {
      scale: 0.45,
      alpha: 0.7,
      maxLife: 0.3,
    });
    // A few low chips flicked along the drift — matter displaced by the shove.
    for (let i = 0; i < 3; i++) {
      engine.spawn({
        x: footX + dir * rand(2, 10),
        y: footY - rand(0, 4),
        vx: dir * rand(60, 140),
        vy: rand(-40, -10),
        gravity: rand(160, 260),
        drag: 0.9,
        size: rand(3, 6),
        sizeEnd: rand(1, 2),
        alpha: rand(0.7, 0.95),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        rotation: 0,
        rotationSpeed: rand(-10, 10),
        maxLife: rand(0.22, 0.34),
        texture: pick([engine.textures.circleIce, engine.textures.circle]),
        blendMode: "lighter",
        delay: rand(0, 0.02),
      });
    }
  },

  // Fast-fall slam landing — a slightly bigger smoke puff for the harder impact,
  // plus icy shards that spread low inside the footprint.
  flapFastFallLand(engine, { x, y }) {
    const footX = x;
    const footY = GAME_H - y - 12;
    // Keep ice/sparks inside the smoke footprint.
    const RING_SPREAD = 44;

    // Bigger, punchier puff than a normal touchdown for the slam.
    spawnLandingSmoke(engine, footX, footY, {
      scale: 1.15,
      alpha: 1,
      maxLife: 0.52,
    });

    // Ice crystals — low, spread across the ring interior.
    for (let i = 0; i < 10; i++) {
      const angle = rand(0, Math.PI * 2);
      const dist = rand(10, RING_SPREAD);
      const size = rand(9, 16);
      engine.spawn({
        x: footX + Math.cos(angle) * dist,
        y: footY - rand(0, 5),
        vx: Math.cos(angle) * rand(35, 90),
        vy: rand(-20, 18),
        gravity: rand(60, 140),
        drag: 0.92,
        size,
        sizeEnd: rand(3, 7),
        alpha: rand(0.88, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-12, 12),
        maxLife: rand(0.32, 0.5),
        texture: pick([
          engine.textures.circleIce,
          engine.textures.chunkIce,
          engine.textures.circle,
        ]),
        blendMode: "lighter",
        delay: rand(0, 0.03),
      });
    }

    // Ice twinkles — wider scatter, still low and inside the ring.
    for (let i = 0; i < 6; i++) {
      const angle = rand(0, Math.PI * 2);
      const dist = rand(14, RING_SPREAD);
      engine.spawn({
        x: footX + Math.cos(angle) * dist,
        y: footY - rand(0, 4),
        vx: Math.cos(angle) * rand(45, 110),
        vy: rand(-18, 12),
        gravity: rand(70, 150),
        drag: 0.9,
        size: rand(7, 12),
        sizeEnd: rand(2, 5),
        alpha: rand(0.92, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-5, 5),
        maxLife: rand(0.24, 0.38),
        texture: pick([engine.textures.spark, engine.textures.sparkSmall]),
        blendMode: "lighter",
        delay: rand(0, 0.025),
      });
    }

    // Ice chips — skim outward along the ground inside the ring.
    for (let i = 0; i < 5; i++) {
      const angle = rand(-Math.PI * 0.85, Math.PI * 0.85);
      const dist = rand(6, RING_SPREAD * 0.85);
      const speed = rand(90, 170);
      engine.spawn({
        x: footX + Math.cos(angle) * dist,
        y: footY - rand(0, 3),
        vx: Math.cos(angle) * speed,
        vy: rand(-12, 8),
        gravity: 380,
        drag: 0.94,
        size: rand(4, 8),
        sizeEnd: rand(1.5, 3.5),
        alpha: rand(0.8, 0.98),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-6, 6),
        maxLife: rand(0.26, 0.4),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }
  },

  clinchKillThrowLand(engine, { x, y, behindDohyo }) {
    const footX = x;
    const footY = GAME_H - y - 12;
    const behind = !!behindDohyo;

    // Primary cinematic splash — scaled up for a heavier body-slam read.
    spawnCinematicThrowLandSmoke(engine, footX, footY, {
      scale: 1.45,
      alpha: 1,
      maxLife: 0.65,
      behindDohyo: behind,
    });
    // Second overlapping splash, slightly offset + delayed, sells a thicker cloud.
    spawnCinematicThrowLandSmoke(engine, footX + rand(-18, 18), footY + rand(-12, 0), {
      scale: 1.1,
      alpha: 0.85,
      maxLife: 0.5,
      behindDohyo: behind,
    });

    // Extra billowing puffs around the impact footprint.
    for (let i = 0; i < 8; i++) {
      const size = rand(28, 55);
      engine.spawn({
        x: footX + rand(-55, 55),
        y: footY + rand(-28, -2),
        vx: rand(-90, 90),
        vy: rand(-120, -30),
        gravity: rand(40, 90),
        drag: 0.92,
        size,
        sizeEnd: size * rand(1.5, 2.4),
        alpha: rand(0.55, 0.85),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.4, 0.7),
        texture: pickPuff(engine.textures),
        delay: i * 0.012,
        behindDohyo: behind,
      });
    }
  },

  // Smoke trail while the kill-throw victim is airborne (esp. the crash down).
  // `ascending`: tilt the column forward in the throw direction on the way up
  // so it doesn't read as a straight vertical chimney.
  // Drawn aboveFighters so the trail wraps over the body instead of sitting
  // on the mid canvas under the sprite (z50 vs fighter z99).
  clinchKillThrowTrail(engine, { x, y, direction, ascending = false }) {
    const dir = direction || 1;
    const baseY = GAME_H - y - 50;
    // Forward lean (~25–35°) in throw direction; screen Y is down, so a
    // forward-up trail leans with rotation matching dir.
    const forwardTilt = dir * (ascending ? 0.55 : 0.28);
    const front = { aboveFighters: true };

    if (ascending) {
      // Way up: bias a little FORWARD of the body (throw direction) so the
      // liftoff cloud sits in front of the thrower rather than trailing behind.
      for (let i = 0; i < 2; i++) {
        const size = rand(28, 52);
        engine.spawn({
          ...front,
          x: x + dir * rand(6, 22) + rand(-8, 8),
          y: baseY + rand(4, 28),
          vx: -dir * rand(40, 110) + rand(-15, 15),
          vy: rand(25, 90),
          gravity: rand(10, 35),
          drag: 0.9,
          size,
          sizeEnd: size * rand(1.5, 2.3),
          alpha: rand(0.45, 0.75),
          alphaEnd: 0,
          ease: "outCubic",
          easeAlpha: "inQuad",
          rotation: forwardTilt + rand(-0.12, 0.12),
          rotationSpeed: rand(-1.2, 1.2),
          maxLife: rand(0.4, 0.7),
          texture: pickPuff(engine.textures),
          delay: i * 0.012,
        });
      }

      for (let i = 0; i < 3; i++) {
        const size = rand(12, 24);
        engine.spawn({
          ...front,
          x: x + dir * rand(2, 16) + rand(-10, 10),
          y: baseY + rand(0, 26),
          vx: -dir * rand(30, 90) + rand(-20, 20),
          vy: rand(20, 75),
          gravity: rand(20, 50),
          drag: 0.88,
          size,
          sizeEnd: size * rand(0.7, 1.3),
          alpha: rand(0.4, 0.65),
          alphaEnd: 0,
          ease: "outCubic",
          easeAlpha: "outQuad",
          rotation: forwardTilt + rand(-0.2, 0.2),
          rotationSpeed: rand(-2.5, 2.5),
          maxLife: rand(0.28, 0.5),
          texture: pickSmallPuff(engine.textures),
        });
      }
      return;
    }

    // Way down: denser crash trail, still slightly forward-tilted, over the body.
    for (let i = 0; i < 2; i++) {
      const size = rand(28, 52);
      engine.spawn({
        ...front,
        x: x + rand(-14, 14),
        y: baseY + rand(-16, 16),
        vx: -dir * rand(20, 70) + rand(-25, 25),
        vy: rand(-20, 50),
        gravity: rand(-8, 25),
        drag: 0.9,
        size,
        sizeEnd: size * rand(1.5, 2.3),
        alpha: rand(0.45, 0.75),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotation: forwardTilt + rand(-0.1, 0.1),
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.4, 0.7),
        texture: pickPuff(engine.textures),
        delay: i * 0.012,
      });
    }

    for (let i = 0; i < 3; i++) {
      const size = rand(12, 24);
      engine.spawn({
        ...front,
        x: x + rand(-18, 18),
        y: baseY + rand(-22, 22),
        vx: rand(-50, 50),
        vy: rand(-10, 60),
        gravity: rand(15, 45),
        drag: 0.88,
        size,
        sizeEnd: size * rand(0.7, 1.3),
        alpha: rand(0.4, 0.65),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotation: forwardTilt + rand(-0.15, 0.15),
        rotationSpeed: rand(-3, 3),
        maxLife: rand(0.28, 0.5),
        texture: pickSmallPuff(engine.textures),
      });
    }
  },

  // Perfect raw parry — cinematic landing splash in electric ice-cyan.
  perfectParryLandSmoke(engine, { x, y }) {
    const footX = x;
    const footY = GAME_H - y - 32;
    spawnCinematicThrowLandSmoke(engine, footX, footY, {
      scale: 1,
      alpha: 0.95,
      maxLife: 0.58,
      tint: "cyan",
    });
  },

  // Salt throw: tight forward arc of small grains that disappear at ground level.
  saltThrow(engine, { x, y, facing }) {
    const dir = -(facing || 1);
    const handX = x + dir * 25;
    const handY = GAME_H - y - 75;
    const ground = GAME_H - y - 10;

    for (let i = 0; i < 90; i++) {
      const elevation = rand(0.75, 1.05);
      const speed = rand(260, 560);
      engine.spawn({
        x: handX + rand(-3, 3),
        y: handY + rand(-3, 3),
        vx: dir * Math.cos(elevation) * speed,
        vy: -Math.sin(elevation) * speed,
        gravity: rand(1100, 1280),
        drag: 0.998,
        size: rand(2.5, 5),
        sizeEnd: rand(2, 4.5),
        alpha: rand(0.9, 1.0),
        alphaEnd: rand(0.8, 1.0),
        maxLife: 2.0,
        groundY: ground,
        texture: engine.textures.saltGrain,
        ease: "linear",
        easeAlpha: "linear",
      });
    }
  },

  dashLand(engine, { x, y, slideVelocity = 0 }) {
    const slideOffset = slideVelocity * 28;
    const footX = x + slideOffset;
    const footY = GAME_H - y - 12;

    // ── IMPACT RING — single clean expanding ring ────────────────
    engine.spawn({
      x: footX,
      y: footY,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 10,
      sizeEnd: 48,
      alpha: 0.85,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic", easeAlpha: "outCubic",
      maxLife: 0.3,
      texture: engine.textures.ring,
      stretchX: 2.2,
    });

    // ── GROUND PUFFS — small dust that spreads laterally ─────────
    for (let i = 0; i < 3; i++) {
      const side = i === 0 ? -1 : i === 1 ? 1 : (Math.random() > 0.5 ? 1 : -1);
      const size = rand(16, 26);
      engine.spawn({
        x: footX + side * rand(2, 10),
        y: footY - size * 0.4,
        vx: side * rand(40, 90),
        vy: rand(-6, -1),
        gravity: 15,
        drag: 0.9,
        size,
        sizeEnd: size * rand(0.3, 0.5),
        alpha: rand(0.6, 0.8),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-0.5, 0.5),
        maxLife: rand(0.22, 0.32),
        texture: pickSmallPuff(engine.textures),
      });
    }

    // ── TINY CHIPS — kicked up on impact ─────────────────────────
    for (let i = 0; i < 3; i++) {
      const angle = rand(-1.2, 1.2);
      const speed = rand(60, 130);
      engine.spawn({
        x: footX + rand(-4, 4),
        y: footY - rand(1, 4),
        vx: Math.cos(angle) * speed,
        vy: -Math.abs(Math.sin(angle)) * speed * 0.5 + rand(-20, -5),
        gravity: 350,
        drag: 0.95,
        size: rand(2, 4),
        sizeEnd: rand(1, 2),
        alpha: rand(0.5, 0.8),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-4, 4),
        maxLife: rand(0.2, 0.3),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }
  },

  // ─── Local player ice mark ─────────────────────────────────────────
  // Persistent "this is YOU" scuff on the dohyo floor under the local
  // player's feet. Identity preservation for overlap-heavy moments
  // (sidestep, clinch break, dodge cancel-through, throw recovery).
  //
  // Single ring on the DEFAULT canvas (zIndex 50). The fighter sprite
  // (zIndex 99 normal / 101 sidestepping) draws on top, so the back
  // half of the foreshortened oval is naturally occluded by the
  // player's body — no compositing tricks, just z-order. The half
  // that sits in front of the feet stays visible as the footprint
  // mark on the dohyo floor.
  //
  // followGetter so the mark smoothly tracks the player through any
  // movement, including the sidestep dip (the player isn't airborne
  // — they're walking around the dohyo's curved near edge, so the
  // mark dips with them).
  //
  // Spawned on the same cadence as its lifetime. The texture is steady
  // and low-alpha, so it does not pulse like a UI selection indicator.
  localPlayerHalo(engine, { x, y, playerNumber, followGetter }) {
    const accent = engine.accentTextures?.[`player${playerNumber}`];
    if (!accent || !accent.haloRing) return;

    // Y_LIFT puts the ring center slightly above the raw feet position
    // — but lower than the PlayerShadow's center so the front edge of
    // the ring extends past the toes onto the floor in front of the
    // player. Baked into spawn-time only; followGetter returns
    // absolute feet position and the engine tracks deltas, so the
    // lift stays constant relative to the player.
    const Y_LIFT = 10;
    const cx = x;
    const cy = GAME_H - y - Y_LIFT;

    // Keep the marker steady. The texture already contains low-alpha
    // scuffed frost; pulsing it makes the mark read like UI again.
    //
    // Render math: texture aspect is ~3.7:1 (built at r(260)×r(70)).
    // We render at size 34 (the height) with stretchX = 3.71, so the
    // texture is downscaled symmetrically on both axes — clean,
    // uniform stroke width all the way around.
    engine.spawn({
      x: cx,
      y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 30,
      sizeEnd: 30,
      stretchX: 260 / 70,
      alpha: 0.86,
      alphaEnd: 0.86,
      rotation: 0, rotationSpeed: 0,
      ease: "linear",
      easeAlpha: "linear",
      maxLife: 2.0,
      texture: accent.haloRing,
      followGetter: followGetter || null,
      // While the owner is inside the ring this draws on the main canvas
      // (occluded by the sprite, on the floor). When they get knocked OUT of
      // the ring, it routes to the behind-dohyo canvas so the identity marker
      // sinks behind the platform with the sprite/shadow instead of floating
      // over it.
      behindDohyoWhenOutside: true,
    });
  },

  // ─── Sidestep VFX ──────────────────────────────────────────────────
  // The sidestep is GROUND footwork — the player walks laterally
  // around the dohyo's curved near edge (Y dips DOWN on screen =
  // toward camera in 2D). NOT a leap. All three presets read as
  // dust scuffed sideways from the foot push-off, debris left in
  // the wake, and a settling step on landing.
  //
  // Modeled on dashStart / dashSparkTrail / dashLand but with:
  //   • Lateral spread rather than forward bias (push-off is sideways)
  //   • Lower vertical velocity on dust (sidestep is grounded)
  //   • A touch of player-accent color in the dust to gently
  //     reinforce identity at peak overlap

  sidestepStart(engine, { x, y, direction, playerNumber }) {
    const dir = direction || 1;
    const footX = x;
    const footY = GAME_H - y;
    const accent = engine.accentTextures?.[`player${playerNumber}`];

    // Tight cluster of ground dust kicked LATERALLY from the planting foot.
    // No forward bias — we're stepping sideways, not lunging.
    const puffOffsets = [6, 22, 38];
    for (let i = 0; i < puffOffsets.length; i++) {
      const t = i / (puffOffsets.length - 1);
      const size = rand(26, 36) + t * 10;
      engine.spawn({
        x: footX + -dir * (puffOffsets[i] + rand(-2, 2)),
        y: footY - size * 0.4 + rand(0, 3),
        vx: -dir * rand(40, 80),
        vy: rand(-3, 3),
        gravity: 18,
        drag: 0.9,
        size,
        sizeEnd: size * rand(0.35, 0.5),
        alpha: rand(0.7, 0.85),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-0.5, 0.5),
        maxLife: rand(0.32, 0.42),
        texture: pickPuff(engine.textures),
      });
    }

    // 1–2 player-color accent puffs mixed in — reinforces "this is YOUR
    // kick-off" without being loud. Skipped if no accent texture is baked.
    if (accent?.trailPuff) {
      for (let i = 0; i < 2; i++) {
        const size = rand(20, 28);
        engine.spawn({
          x: footX + -dir * rand(8, 26) + rand(-3, 3),
          y: footY - size * 0.4 + rand(-2, 4),
          vx: -dir * rand(30, 65),
          vy: rand(-2, 2),
          gravity: 15,
          drag: 0.91,
          size,
          sizeEnd: size * rand(0.3, 0.45),
          alpha: rand(0.55, 0.75),
          alphaEnd: 0,
          ease: "outCubic",
          easeAlpha: "outQuad",
          rotationSpeed: rand(-0.4, 0.4),
          maxLife: rand(0.3, 0.4),
          texture: accent.trailPuff,
        });
      }
    }

    // Short shin-height speed lines in the direction of travel — sells
    // the lateral momentum without the vertical "leap" feel of dashStart.
    const shinY = footY - 26;
    for (let i = 0; i < 3; i++) {
      const thickness = rand(2, 3);
      const stretch = rand(10, 16);
      engine.spawn({
        x: footX + dir * rand(2, 14),
        y: shinY + rand(-8, 8),
        vx: dir * rand(120, 220),
        vy: rand(-3, 3),
        gravity: 0,
        drag: 0.93,
        size: thickness,
        sizeEnd: thickness * 0.7,
        alpha: rand(0.7, 0.9),
        alphaEnd: 0,
        rotation: 0,
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.1, 0.16),
        texture: engine.textures.speedLineThin,
        stretchX: stretch,
      });
    }

    // Single low expanding ring at the feet — settles the kick-off as
    // a deliberate sumo step rather than a sudden burst.
    engine.spawn({
      x: footX,
      y: footY - 6,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 8,
      sizeEnd: 28,
      alpha: 0.55,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outExpo",
      easeAlpha: "outCubic",
      maxLife: 0.22,
      texture: engine.textures.ring,
      stretchX: 2.6,
    });
  },

  // Called every ~40ms during the active arc. Drops a small player-color
  // puff at foot height and a short ground streak that lingers on the
  // dohyo where the foot just was. Low/zero vertical velocity = grounded
  // dust, not airborne mist.
  sidestepTrail(engine, { x, y, direction, t, playerNumber }) {
    const dir = direction || 1;
    const footX = x;
    const footY = GAME_H - y;
    const accent = engine.accentTextures?.[`player${playerNumber}`];

    // Slight intensity bump near peak Y dip (mid-arc, t≈0.5) — that's
    // when the sidestepper is closest to the camera, so the extra dust
    // there reads as "passing through the foreground".
    const apexBoost = 1 + 0.4 * Math.sin(Math.PI * Math.min(Math.max(t || 0, 0), 1));

    // Small player-color puff at foot height. Falls back to white if no
    // accent texture is baked yet.
    const puffTex = accent?.trailPuff || pickSmallPuff(engine.textures);
    const puffSize = rand(14, 20) * apexBoost;
    engine.spawn({
      x: footX + -dir * rand(4, 12),
      y: footY - puffSize * 0.4,
      vx: -dir * rand(8, 22),
      vy: rand(-2, 1),
      gravity: 5,
      drag: 0.93,
      size: puffSize,
      sizeEnd: puffSize * rand(0.4, 0.6),
      alpha: rand(0.5, 0.7),
      alphaEnd: 0,
      ease: "outCubic",
      easeAlpha: "outQuad",
      rotationSpeed: rand(-0.4, 0.4),
      maxLife: rand(0.16, 0.22),
      texture: puffTex,
    });

    // Ground streak that lingers on the dohyo where the foot just was —
    // emphasizes the lateral travel as a footwork trail, not airborne fog.
    engine.spawn({
      x: footX + -dir * rand(2, 8),
      y: footY - rand(1, 3),
      vx: -dir * rand(4, 10),
      vy: 0,
      gravity: 0,
      drag: 0.98,
      size: rand(2, 4),
      sizeEnd: rand(1.5, 2.5),
      alpha: rand(0.45, 0.65),
      alphaEnd: 0,
      rotation: 0,
      rotationSpeed: 0,
      ease: "linear",
      easeAlpha: "inQuad",
      maxLife: rand(0.22, 0.32),
      texture: engine.textures.groundStreakThin,
      stretchX: rand(2.5, 4),
    });
  },

  // One-shot when the active arc ends. A small foot-plant: tight
  // expanding ring, 2 lateral ground puffs, a couple of ice chips.
  // Lower intensity than dashLand — sidestep settles, doesn't slide.
  sidestepLand(engine, { x, y }) {
    const footX = x;
    const footY = GAME_H - y - 10;

    // Single tight impact ring
    engine.spawn({
      x: footX,
      y: footY,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 8,
      sizeEnd: 36,
      alpha: 0.7,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic",
      easeAlpha: "outCubic",
      maxLife: 0.26,
      texture: engine.textures.ring,
      stretchX: 2.4,
    });

    // 2 lateral ground puffs spreading outward from the foot plant
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const size = rand(14, 22);
      engine.spawn({
        x: footX + side * rand(2, 8),
        y: footY - size * 0.3,
        vx: side * rand(30, 65),
        vy: rand(-4, 0),
        gravity: 12,
        drag: 0.91,
        size,
        sizeEnd: size * rand(0.35, 0.5),
        alpha: rand(0.55, 0.75),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-0.5, 0.5),
        maxLife: rand(0.2, 0.3),
        texture: pickSmallPuff(engine.textures),
      });
    }

    // A couple of ice chips for texture
    for (let i = 0; i < 2; i++) {
      const angle = rand(-1, 1);
      const speed = rand(50, 110);
      engine.spawn({
        x: footX + rand(-3, 3),
        y: footY - rand(1, 4),
        vx: Math.cos(angle) * speed,
        vy: -Math.abs(Math.sin(angle)) * speed * 0.4 + rand(-15, -3),
        gravity: 320,
        drag: 0.95,
        size: rand(2, 4),
        sizeEnd: rand(1, 2),
        alpha: rand(0.55, 0.8),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-3, 3),
        maxLife: rand(0.18, 0.28),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }
  },

  cinematicKillTrail(engine, { x, y, direction }) {
    const dir = direction || 1;
    const baseY = GAME_H - y - 60;

    // Big billowing smoke — fewer, varied sizes for shape
    for (let i = 0; i < 3; i++) {
      const size = rand(35, 65);
      engine.spawn({
        x: x + -dir * rand(5, 25),
        y: baseY + rand(-18, 18),
        vx: -dir * rand(100, 240),
        vy: rand(-35, 25),
        gravity: rand(-15, 10),
        drag: 0.91,
        size,
        sizeEnd: size * rand(1.4, 2.2),
        alpha: rand(0.6, 0.85),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.5, 0.8),
        texture: pickPuff(engine.textures),
        delay: i * 0.015,
      });
    }

    // Smaller turbulent puffs — more of them, scattered wider
    for (let i = 0; i < 4; i++) {
      const size = rand(14, 28);
      engine.spawn({
        x: x + -dir * rand(0, 20) + rand(-10, 10),
        y: baseY + rand(-25, 25),
        vx: -dir * rand(60, 200) + rand(-30, 30),
        vy: rand(-50, 30),
        gravity: rand(10, 40),
        drag: 0.89,
        size,
        sizeEnd: size * rand(0.6, 1.2),
        alpha: rand(0.5, 0.75),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-3, 3),
        maxLife: rand(0.3, 0.55),
        texture: pickSmallPuff(engine.textures),
      });
    }

    // Speed lines streaking behind
    for (let i = 0; i < 3; i++) {
      engine.spawn({
        x: x + -dir * rand(10, 45),
        y: baseY + rand(-22, 18),
        vx: -dir * rand(200, 450),
        vy: rand(-12, 12),
        gravity: 0,
        drag: 0.93,
        size: rand(30, 55),
        sizeEnd: rand(8, 20),
        alpha: rand(0.5, 0.85),
        alphaEnd: 0,
        ease: "outExpo",
        easeAlpha: "inQuad",
        rotation: dir > 0 ? 0 : Math.PI,
        rotationSpeed: 0,
        maxLife: rand(0.18, 0.35),
        texture: pick([engine.textures.speedLine, engine.textures.speedLineThick, engine.textures.speedLineThin]),
        stretchX: rand(2.5, 5),
      });
    }

    // Ice chunks — tumbling hard debris for texture
    for (let i = 0; i < 5; i++) {
      const angle = rand(-1.8, 1.8);
      const speed = rand(80, 220);
      engine.spawn({
        x: x + rand(-10, 10),
        y: baseY + rand(-15, 10),
        vx: -dir * Math.abs(Math.cos(angle)) * speed + rand(-40, 40),
        vy: -Math.abs(Math.sin(angle)) * speed * 0.5 + rand(-40, -5),
        gravity: 380,
        drag: 0.96,
        size: rand(3, 7),
        sizeEnd: rand(1, 3),
        alpha: rand(0.6, 0.95),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-8, 8),
        maxLife: rand(0.3, 0.5),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }

    // Bright sparks — sharp bright points that pop against the smoke
    for (let i = 0; i < 3; i++) {
      const angle = rand(-1, 1);
      const speed = rand(120, 300);
      engine.spawn({
        x: x + rand(-6, 6),
        y: baseY + rand(-10, 10),
        vx: -dir * Math.abs(Math.cos(angle)) * speed + rand(-20, 20),
        vy: Math.sin(angle) * speed * 0.4,
        gravity: 200,
        drag: 0.95,
        size: rand(3, 6),
        sizeEnd: rand(1, 2),
        alpha: rand(0.7, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-5, 5),
        maxLife: rand(0.15, 0.3),
        texture: pick([engine.textures.circle, engine.textures.circleIce]),
        blendMode: "lighter",
      });
    }

    // Wispy ring fragment — expanding ring that breaks up the solid cloud
    if (Math.random() < 0.35) {
      engine.spawn({
        x: x + -dir * rand(5, 20),
        y: baseY + rand(-5, 5),
        vx: -dir * rand(60, 120),
        vy: rand(-10, 10),
        gravity: 0,
        drag: 0.96,
        size: 8,
        sizeEnd: rand(40, 65),
        alpha: rand(0.4, 0.6),
        alphaEnd: 0,
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-1, 1),
        ease: "outCubic",
        easeAlpha: "inQuad",
        maxLife: rand(0.3, 0.45),
        texture: pick([engine.textures.ring, engine.textures.ringAlt]),
        stretchX: rand(1.5, 2.5),
      });
    }
  },

  // Lighter sibling of cinematicKillTrail — fired on the *victim* of a
  // non-cinematic charged hit while they're being knocked back. Sells weight
  // without drowning the screen in debris like the cinematic-kill version.
  // Only speed-lines + a few small puffs; no chunks, no big smoke balls.
  // direction = direction of victim's flight (matches knockbackDirection).
  // Trail spawns BEHIND that flight (-direction).
  chargedHitKnockbackTrail(engine, { x, y, direction }) {
    const dir = direction || 1;
    const baseY = GAME_H - y - 60;

    for (let i = 0; i < 2; i++) {
      engine.spawn({
        x: x + -dir * rand(8, 30),
        y: baseY + rand(-18, 14),
        vx: -dir * rand(140, 320),
        vy: rand(-8, 8),
        gravity: 0,
        drag: 0.93,
        size: rand(20, 38),
        sizeEnd: rand(6, 14),
        alpha: rand(0.5, 0.78),
        alphaEnd: 0,
        ease: "outExpo",
        easeAlpha: "inQuad",
        rotation: dir > 0 ? 0 : Math.PI,
        rotationSpeed: 0,
        maxLife: rand(0.15, 0.28),
        texture: pick([engine.textures.speedLine, engine.textures.speedLineThin]),
        stretchX: rand(2.0, 3.5),
      });
    }

    if (Math.random() < 0.55) {
      const size = rand(10, 18);
      engine.spawn({
        x: x + -dir * rand(4, 16) + rand(-6, 6),
        y: baseY + rand(-18, 14),
        vx: -dir * rand(60, 140),
        vy: rand(-30, 8),
        gravity: rand(15, 35),
        drag: 0.91,
        size,
        sizeEnd: size * rand(0.7, 1.1),
        alpha: rand(0.4, 0.6),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.2, 0.4),
        texture: pickSmallPuff(engine.textures),
      });
    }
  },

  cinematicKillImpact(engine, { x, y }) {
    const footY = GAME_H - y;

    // Massive expanding ring at impact point
    engine.spawn({
      x,
      y: footY,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 8,
      sizeEnd: 120,
      alpha: 0.95,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic", easeAlpha: "outCubic",
      maxLife: 0.45,
      texture: engine.textures.ringThick,
      stretchX: 2.0,
    });

    // Second ring, slightly delayed
    engine.spawn({
      x,
      y: footY,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 5,
      sizeEnd: 80,
      alpha: 0.8,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic", easeAlpha: "outCubic",
      maxLife: 0.35,
      texture: engine.textures.ring,
      stretchX: 2.4,
      delay: 0.06,
    });

    // Burst of puffs radiating outward
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = rand(100, 200);
      const size = rand(25, 45);
      engine.spawn({
        x: x + Math.cos(angle) * 10,
        y: footY + Math.sin(angle) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5,
        gravity: 20,
        drag: 0.88,
        size,
        sizeEnd: size * rand(0.3, 0.5),
        alpha: rand(0.7, 0.9),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-1.5, 1.5),
        maxLife: rand(0.35, 0.55),
        texture: pickPuff(engine.textures),
      });
    }

    // Bright sparks
    for (let i = 0; i < 10; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(150, 350);
      engine.spawn({
        x: x + rand(-5, 5),
        y: footY + rand(-5, 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6,
        gravity: 300,
        drag: 0.95,
        size: rand(3, 7),
        sizeEnd: rand(1, 2),
        alpha: rand(0.8, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-5, 5),
        maxLife: rand(0.25, 0.45),
        texture: pick([engine.textures.chunk, engine.textures.circle]),
        blendMode: "lighter",
      });
    }
  },

  // Slap parry clash — two-player slap collision. Central burst, radial sparks, expanding ring.
  // `intensity` scales with consecutive parries (1.0 = first, up to ~1.6 for 4th).
  slapParryClash(engine, { x, y, p1x, p2x, intensity = 1 }) {
    const clashX = x;
    const clashY = GAME_H - y - 50;
    const footY = GAME_H - y;
    const s = Math.min(intensity, 1.6);

    // ── CENTRAL FLASH — bright white burst at the impact point ──
    const flashSize = 30 * s;
    engine.spawn({
      x: clashX,
      y: clashY,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: flashSize,
      sizeEnd: flashSize * 2.5,
      alpha: 1.0,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outExpo", easeAlpha: "outCubic",
      maxLife: 0.12 * s,
      texture: engine.textures.circle,
      blendMode: "lighter",
    });

    // ── EXPANDING SHOCKWAVE RINGS — horizontally stretched ──
    const ringTextures = [engine.textures.ring, engine.textures.ringAlt, engine.textures.ringThick];
    const ringCount = s > 1.2 ? 3 : 2;
    for (let i = 0; i < ringCount; i++) {
      const scale = 1 + i * 0.06;
      engine.spawn({
        x: clashX,
        y: clashY + 10,
        vx: 0, vy: 0, gravity: 0, drag: 1,
        size: 8 * scale,
        sizeEnd: (55 + i * 8) * s * scale,
        alpha: Math.min(0.95, 0.85 * s),
        alphaEnd: 0,
        rotation: 0, rotationSpeed: 0,
        ease: "outCubic", easeAlpha: "outCubic",
        maxLife: 0.28 + i * 0.04,
        texture: ringTextures[i % ringTextures.length],
        stretchX: 1.8,
        delay: i * 0.025,
      });
    }

    // ── RADIAL SPARKS — bright points bursting from center ──
    const sparkCount = Math.round(8 * s);
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + rand(-0.4, 0.4);
      const speed = rand(180, 380) * s;
      const horizontalBias = 1.6;
      engine.spawn({
        x: clashX + rand(-4, 4),
        y: clashY + rand(-8, 8),
        vx: Math.cos(angle) * speed * horizontalBias,
        vy: Math.sin(angle) * speed * 0.6,
        gravity: 300,
        drag: 0.93,
        size: rand(4, 8) * s,
        sizeEnd: rand(1, 3),
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.15, 0.3),
        texture: pick([engine.textures.spark, engine.textures.sparkSmall, engine.textures.circle]),
        blendMode: "lighter",
      });
    }

    // ── SPEED LINES — horizontal streaks radiating from impact ──
    const lineCount = Math.round(6 * s);
    for (let i = 0; i < lineCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const stretch = rand(14, 24) * s;
      engine.spawn({
        x: clashX + side * rand(8, 30),
        y: clashY + rand(-25, 25),
        vx: side * rand(100, 250),
        vy: rand(-15, 15),
        gravity: 0,
        drag: 0.94,
        size: rand(3, 5),
        sizeEnd: rand(2, 3),
        alpha: rand(0.8, 1.0),
        alphaEnd: 0,
        rotation: side > 0 ? 0 : Math.PI,
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.1, 0.2),
        texture: pick([engine.textures.speedLine, engine.textures.speedLineThin, engine.textures.speedLineThick]),
        stretchX: stretch,
      });
    }

    // ── SMOKE PUFFS — bilateral clouds at body height ──
    const puffCount = Math.round(5 * s);
    for (let i = 0; i < puffCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const size = rand(22, 40) * s;
      engine.spawn({
        x: clashX + side * rand(5, 25),
        y: clashY + rand(-10, 15),
        vx: side * rand(60, 140) * s,
        vy: rand(-30, 10),
        gravity: 15,
        drag: 0.88,
        size,
        sizeEnd: size * rand(0.3, 0.5),
        alpha: rand(0.65, 0.85),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-1.5, 1.5),
        maxLife: rand(0.3, 0.5),
        texture: pickPuff(engine.textures),
        delay: rand(0, 0.02),
      });
    }

    // ── ICE CHUNKS — tumbling debris from the impact ──
    const chunkCount = Math.round(6 * s);
    for (let i = 0; i < chunkCount; i++) {
      const angle = rand(-1.5, 1.5);
      const speed = rand(80, 200) * s;
      engine.spawn({
        x: clashX + rand(-8, 8),
        y: clashY + rand(-5, 10),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 + rand(-30, -5),
        gravity: 400,
        drag: 0.95,
        size: rand(3, 6),
        sizeEnd: rand(1, 2),
        alpha: rand(0.6, 0.9),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-6, 6),
        maxLife: rand(0.25, 0.4),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }

    // ── GROUND DUST — kicked up at the feet from the force ──
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const size = rand(16, 28);
      engine.spawn({
        x: clashX + side * rand(10, 40),
        y: footY - size * 0.3,
        vx: side * rand(50, 100),
        vy: rand(-8, -2),
        gravity: 20,
        drag: 0.9,
        size,
        sizeEnd: size * rand(0.3, 0.5),
        alpha: rand(0.5, 0.7),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-0.6, 0.6),
        maxLife: rand(0.25, 0.35),
        texture: pickSmallPuff(engine.textures),
      });
    }
  },

  // Parry activation — blue smoke burst on press, rising from both sides.
  parryActivation(engine, { x, y, facing }) {
    const dir = facing || 1;
    const bodyX = x + dir * 10;
    const footY = GAME_H - y - 12;
    const midY = GAME_H - y - 65;

    // Rising smoke from left and right sides — 5 per side
    for (let i = 0; i < 10; i++) {
      const side = i < 5 ? -1 : 1;
      const spawnX = bodyX + side * rand(30, 58);
      const spawnY = rand(midY + 15, footY);
      const size = rand(18, 32);
      engine.spawn({
        x: spawnX,
        y: spawnY,
        vx: side * rand(15, 45) + rand(-8, 8),
        vy: rand(-160, -70),
        gravity: rand(-20, -8),
        drag: 0.95,
        size,
        sizeEnd: size * rand(0.5, 0.8),
        alpha: rand(0.55, 0.75),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-1, 1),
        maxLife: rand(0.4, 0.6),
        texture: pickBluePuff(engine.textures),
        blendMode: "lighter",
        rawParryBlueHold: true,
      });
    }

    // Shoulder/head smoke — spawns at the top of the character, spread wide
    const headY = GAME_H - y - 105;
    for (let i = 0; i < 5; i++) {
      const spawnX = bodyX + rand(-60, 60);
      const spawnY = rand(headY - 5, headY + 15);
      const size = rand(18, 30);
      engine.spawn({
        x: spawnX,
        y: spawnY,
        vx: rand(-18, 18),
        vy: rand(-140, -50),
        gravity: rand(-20, -8),
        drag: 0.95,
        size,
        sizeEnd: size * rand(0.5, 0.8),
        alpha: rand(0.5, 0.7),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-1, 1),
        maxLife: rand(0.45, 0.65),
        texture: pickBluePuff(engine.textures),
        blendMode: "lighter",
        rawParryBlueHold: true,
      });
    }

    // Blue sparks rising from body area
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      engine.spawn({
        x: bodyX + side * rand(20, 50),
        y: rand(midY, footY),
        vx: side * rand(20, 60),
        vy: rand(-200, -80),
        gravity: -15,
        drag: 0.95,
        size: rand(3, 5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.8, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-4, 4),
        maxLife: rand(0.2, 0.35),
        texture: pick([engine.textures.circleBlue, engine.textures.circle]),
        blendMode: "lighter",
        rawParryBlueHold: true,
      });
    }

    // Ground dust at feet
    for (let i = 0; i < 3; i++) {
      const side = i === 0 ? -1 : i === 1 ? 1 : (Math.random() > 0.5 ? 1 : -1);
      const size = rand(18, 28);
      engine.spawn({
        x: bodyX + side * rand(8, 35),
        y: footY,
        vx: side * rand(40, 80),
        vy: rand(-10, -3),
        gravity: 15,
        drag: 0.9,
        size,
        sizeEnd: size * rand(0.3, 0.5),
        alpha: rand(0.5, 0.7),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-1, 1),
        maxLife: rand(0.2, 0.3),
        texture: pickBluePuff(engine.textures),
        rawParryBlueHold: true,
      });
    }
  },

  // Parry stance — rising blue smoke from both sides of the character.
  parryStance(engine, { x, y, facing, intensity = 0.5 }) {
    const dir = facing || 1;
    const bodyX = x + dir * 10;
    const footY = GAME_H - y - 12;
    const midY = GAME_H - y - 65;

    // Rising smoke — explicitly from left AND right sides
    const perSide = intensity > 0.7 ? 3 : 2;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < perSide; i++) {
        const spawnX = bodyX + s * rand(28, 55);
        const spawnY = rand(midY + 10, footY);
        const size = rand(14, 24) * intensity + 6;
        engine.spawn({
          x: spawnX,
          y: spawnY,
          vx: s * rand(5, 22) + rand(-6, 6),
          vy: rand(-110, -45),
          gravity: rand(-15, -5),
          drag: 0.96,
          size,
          sizeEnd: size * rand(0.5, 0.8),
          alpha: rand(0.4, 0.6) * intensity,
          alphaEnd: 0,
          ease: "outCubic",
          easeAlpha: "outQuad",
          rotationSpeed: rand(-0.8, 0.8),
          maxLife: rand(0.5, 0.8),
          texture: pickBluePuff(engine.textures),
          blendMode: "lighter",
          rawParryBlueHold: true,
        });
      }
    }

    // Shoulder/head smoke — spawns at the top, spread wide to the sides
    const headY = GAME_H - y - 105;
    const topCount = intensity > 0.7 ? 4 : 3;
    for (let i = 0; i < topCount; i++) {
      const spawnX = bodyX + rand(-60, 60);
      const spawnY = rand(headY - 5, headY + 20);
      const size = rand(16, 26) * intensity + 6;
      engine.spawn({
        x: spawnX,
        y: spawnY,
        vx: rand(-25, 25),
        vy: rand(-90, -35),
        gravity: rand(-15, -6),
        drag: 0.96,
        size,
        sizeEnd: size * rand(0.5, 0.8),
        alpha: rand(0.35, 0.55) * intensity,
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-0.8, 0.8),
        maxLife: rand(0.5, 0.8),
        texture: pickBluePuff(engine.textures),
        blendMode: "lighter",
        rawParryBlueHold: true,
      });
    }

    // Occasional rising spark from either side
    if (Math.random() < 0.5 * intensity) {
      const s = Math.random() > 0.5 ? 1 : -1;
      engine.spawn({
        x: bodyX + s * rand(25, 50),
        y: rand(midY, footY),
        vx: s * rand(10, 30),
        vy: rand(-90, -40),
        gravity: -10,
        drag: 0.96,
        size: rand(2, 4),
        sizeEnd: rand(1, 2),
        alpha: rand(0.6, 0.85) * intensity,
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.25, 0.4),
        texture: pick([engine.textures.circleBlue, engine.textures.chunkBlue]),
        blendMode: "lighter",
        rawParryBlueHold: true,
      });
    }
  },

  // MATADOR activation — same plume recipe as regular AP, gold tint.
  matadorActivation(engine, { x, y, facing }) {
    const dir = facing || 1;
    const bodyX = x + dir * 10;
    const footY = GAME_H - y - 12;
    const midY = GAME_H - y - 65;

    // Rising smoke from left and right sides — 5 per side
    for (let i = 0; i < 10; i++) {
      const side = i < 5 ? -1 : 1;
      const spawnX = bodyX + side * rand(30, 58);
      const spawnY = rand(midY + 15, footY);
      const size = rand(18, 32);
      engine.spawn({
        x: spawnX,
        y: spawnY,
        vx: side * rand(15, 45) + rand(-8, 8),
        vy: rand(-160, -70),
        gravity: rand(-20, -8),
        drag: 0.95,
        size,
        sizeEnd: size * rand(0.5, 0.8),
        alpha: rand(0.55, 0.75),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-1, 1),
        maxLife: rand(0.4, 0.6),
        texture: pickMatadorPuff(engine.textures),
        blendMode: "lighter",
        matadorGoldHold: true,
      });
    }

    // Shoulder/head smoke — spawns at the top of the character, spread wide
    const headY = GAME_H - y - 105;
    for (let i = 0; i < 5; i++) {
      const spawnX = bodyX + rand(-60, 60);
      const spawnY = rand(headY - 5, headY + 15);
      const size = rand(18, 30);
      engine.spawn({
        x: spawnX,
        y: spawnY,
        vx: rand(-18, 18),
        vy: rand(-140, -50),
        gravity: rand(-20, -8),
        drag: 0.95,
        size,
        sizeEnd: size * rand(0.5, 0.8),
        alpha: rand(0.5, 0.7),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-1, 1),
        maxLife: rand(0.45, 0.65),
        texture: pickMatadorPuff(engine.textures),
        blendMode: "lighter",
        matadorGoldHold: true,
      });
    }

    // Gold sparks rising from body area
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      engine.spawn({
        x: bodyX + side * rand(20, 50),
        y: rand(midY, footY),
        vx: side * rand(20, 60),
        vy: rand(-200, -80),
        gravity: -15,
        drag: 0.95,
        size: rand(3, 5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.8, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-4, 4),
        maxLife: rand(0.2, 0.35),
        texture: pick([engine.textures.circleMatador, engine.textures.circle]),
        blendMode: "lighter",
        matadorGoldHold: true,
      });
    }

    // Ground dust at feet
    for (let i = 0; i < 3; i++) {
      const side = i === 0 ? -1 : i === 1 ? 1 : (Math.random() > 0.5 ? 1 : -1);
      const size = rand(18, 28);
      engine.spawn({
        x: bodyX + side * rand(8, 35),
        y: footY,
        vx: side * rand(40, 80),
        vy: rand(-10, -3),
        gravity: 15,
        drag: 0.9,
        size,
        sizeEnd: size * rand(0.3, 0.5),
        alpha: rand(0.5, 0.7),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-1, 1),
        maxLife: rand(0.2, 0.3),
        texture: pickMatadorPuff(engine.textures),
        matadorGoldHold: true,
      });
    }
  },

  // Parry stance — rising gold smoke from both sides of the character.
  // MATADOR stance — same ongoing motes as regular AP, gold tint.
  matadorStance(engine, { x, y, facing, intensity = 0.5 }) {
    const dir = facing || 1;
    const bodyX = x + dir * 10;
    const footY = GAME_H - y - 12;
    const midY = GAME_H - y - 65;

    // Rising smoke — explicitly from left AND right sides
    const perSide = intensity > 0.7 ? 3 : 2;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < perSide; i++) {
        const spawnX = bodyX + s * rand(28, 55);
        const spawnY = rand(midY + 10, footY);
        const size = rand(14, 24) * intensity + 6;
        engine.spawn({
          x: spawnX,
          y: spawnY,
          vx: s * rand(5, 22) + rand(-6, 6),
          vy: rand(-110, -45),
          gravity: rand(-15, -5),
          drag: 0.96,
          size,
          sizeEnd: size * rand(0.5, 0.8),
          alpha: rand(0.4, 0.6) * intensity,
          alphaEnd: 0,
          ease: "outCubic",
          easeAlpha: "outQuad",
          rotationSpeed: rand(-0.8, 0.8),
          maxLife: rand(0.5, 0.8),
          texture: pickMatadorPuff(engine.textures),
          blendMode: "lighter",
          matadorGoldHold: true,
        });
      }
    }

    // Shoulder/head smoke — spawns at the top, spread wide to the sides
    const headY = GAME_H - y - 105;
    const topCount = intensity > 0.7 ? 4 : 3;
    for (let i = 0; i < topCount; i++) {
      const spawnX = bodyX + rand(-60, 60);
      const spawnY = rand(headY - 5, headY + 20);
      const size = rand(16, 26) * intensity + 6;
      engine.spawn({
        x: spawnX,
        y: spawnY,
        vx: rand(-25, 25),
        vy: rand(-90, -35),
        gravity: rand(-15, -6),
        drag: 0.96,
        size,
        sizeEnd: size * rand(0.5, 0.8),
        alpha: rand(0.35, 0.55) * intensity,
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-0.8, 0.8),
        maxLife: rand(0.5, 0.8),
        texture: pickMatadorPuff(engine.textures),
        blendMode: "lighter",
        matadorGoldHold: true,
      });
    }

    // Occasional rising spark from either side
    if (Math.random() < 0.5 * intensity) {
      const s = Math.random() > 0.5 ? 1 : -1;
      engine.spawn({
        x: bodyX + s * rand(25, 50),
        y: rand(midY, footY),
        vx: s * rand(10, 30),
        vy: rand(-90, -40),
        gravity: -10,
        drag: 0.96,
        size: rand(2, 4),
        sizeEnd: rand(1, 2),
        alpha: rand(0.6, 0.85) * intensity,
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.25, 0.4),
        texture: pick([engine.textures.circleMatador, engine.textures.chunkMatador]),
        blendMode: "lighter",
        matadorGoldHold: true,
      });
    }
  },

  // Perfect parry — tight electric-cyan spark ejecta at the body (not a gold
  // flame cloud). Short-lived additive shards + a few bright motes so the
  // clash reads as a steel spark, under the cinematic-kill particle budget.
  perfectParrySparkBurst(engine, { x, y, facing }) {
    const dir = facing || 1;
    const bodyX = x + dir * 8;
    const midY = GAME_H - y - 58;
    const T = engine.textures;

    // Bright core mote — snappy pop with a brief hold at contact height.
    engine.spawn({
      x: bodyX,
      y: midY,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 1,
      size: 28,
      sizeEnd: 56,
      alpha: 0.95,
      alphaEnd: 0,
      ease: "outCubic",
      easeAlpha: "outQuad",
      maxLife: 0.18,
      texture: T.circleBlue || T.circle,
      blendMode: "lighter",
      aboveFighters: true,
    });

    // Sharp radial shards — the "metal clash" read.
    for (let i = 0; i < 16; i++) {
      const ang = (Math.PI * 2 * i) / 16 + rand(-0.12, 0.12);
      const spd = rand(200, 480);
      engine.spawn({
        x: bodyX + Math.cos(ang) * rand(2, 8),
        y: midY + Math.sin(ang) * rand(2, 8),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.75 - rand(20, 80),
        gravity: 260,
        drag: 0.9,
        size: rand(3, 7),
        sizeEnd: rand(1, 2.5),
        alpha: rand(0.85, 1),
        alphaEnd: 0,
        ease: "outExpo",
        easeAlpha: "outQuad",
        rotation: ang,
        rotationSpeed: rand(-6, 6),
        stretchX: rand(1.6, 2.8),
        maxLife: rand(0.22, 0.36),
        texture: pick([T.chunkBlue, T.circleBlue, T.circle]),
        blendMode: "lighter",
        aboveFighters: true,
      });
    }

    // Soft cyan powder bloom — fills the gap under the sprite burst.
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const size = rand(14, 26);
      engine.spawn({
        x: bodyX + side * rand(10, 36),
        y: midY + rand(-18, 24),
        vx: side * rand(30, 90),
        vy: rand(-120, -40),
        gravity: rand(-8, 20),
        drag: 0.93,
        size,
        sizeEnd: size * rand(0.35, 0.55),
        alpha: rand(0.45, 0.7),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-1.2, 1.2),
        maxLife: rand(0.36, 0.52),
        texture: pickBluePuff(T),
        blendMode: "lighter",
      });
    }
  },

  // Legacy alias — gold flame path retired; keep name so any stray callers
  // still resolve to the cyan spark treatment.
  perfectParryFlameBurst(engine, opts) {
    PRESETS.perfectParrySparkBurst(engine, opts);
  },

  // ─── HIT VFX OVERHAUL (Phase A) — cel-burst impact ───────────────
  // The single hit preset. Replaces the old CSS ring glow + the deleted
  // radial `hitSpark*` spark blasts. Draws displaced-matter impacts in the
  // game's cel language (see `emitCelImpact`). `x`/`y` are game-space; `y`
  // is converted to screen-space here like the old presets did.
  //
  //   dir     — knockback sign (+1/-1); the ejecta crown fans this way.
  //   tier    — "slap" | "burst" | "charged".
  //   palette — status palette key (white / gold / purple / red / amber /
  //             volt). Precedence is resolved by the caller (GameFighter).
  hitImpact(engine, { x, y, dir = 1, tier = "slap", palette = "white" }) {
    emitCelImpact(engine, x, GAME_H - y, { tier, dir, palette });
  },

  // Premium center burst for the CSS hit ring — star flare, bloom, streaks.
  hitRingCore(engine, { x, y, dir = 1, tier = "slap", palette = "white" }) {
    emitHitRingCore(engine, x, GAME_H - y, { tier, dir, palette });
  },

  // ── GRAB ARMOR ABSORB ───────────────────────────────────────────────
  // ABIGAIL (SF5) STYLE — ONE ring that expands from a small bright
  // ring (with flashy content INSIDE) to a big ring that WRAPS around
  // the entire player. Same particle, same position, just expanding.
  //
  // It's important that this is ONE ring — small phase and big phase
  // are the SAME ring at different points in its size animation, NOT
  // two separately positioned rings. The whole effect lives at the
  // pulled-back-to-body position the caller passes (chest height,
  // centered on the absorber's body so the absorb sits IN THE MIDDLE
  // of the opponent absorbing, not at the slap-contact tip).
  //
  // 3D TILT — The ring is rendered with stretchX = 0.65, which is
  // canvas's analog of the parry effect's `rotateY(55deg)` transform.
  // Reads as a foreshortened ellipse → the ring looks like a 3D loop
  // tilted away from the camera, NOT a flat 2D circle pasted on top.
  //
  // WRAP ILLUSION — The ring is spawned on TWO layers simultaneously:
  //   • MIDDLE layer (zIndex 50, behind player at 101): the primary
  //     ring. Player sprite occludes the part of the ring that
  //     crosses the body → ring appears to go AROUND the player.
  //   • FRONT layer (zIndex 102, in front of player) at low alpha:
  //     keeps the ring visually CONTINUOUS where it crosses the body
  //     (so the silhouette doesn't appear to bite a chunk out of it)
  //     AND makes the ring visible during the SMALL phase when the
  //     middle-layer copy is fully hidden behind the player sprite.
  //
  // CONTENT INSIDE → EMPTY OUT — A bright cross flare + hot pinpoint
  // core have SHORT lifetimes (130–180ms). They're visible while the
  // ring is small (sit inside its perimeter), then fade by the time
  // the ring has expanded past them. Result: small ring has flashy
  // content INSIDE; big ring is empty around the player.
  grabArmorAbsorb(engine, { x, y, facing, followGetter }) {
    const cx = x;
    const cy = GAME_H - y;

    // Layer helpers — all share the followGetter so they track the
    // absorber as they lunge forward.
    //
    //   front  → aboveFighters (zIndex 102) — drawn IN FRONT of player
    //   middle → default canvas (zIndex 50) — drawn BEHIND player but
    //             in front of dohyo. THIS is what makes the ring
    //             appear to go around the player when expanded.
    const front = (cfg) => engine.spawn({
      ...cfg,
      aboveFighters: true,
      followGetter: followGetter || null,
    });
    const middle = (cfg) => engine.spawn({
      ...cfg,
      followGetter: followGetter || null,
    });

    // 3D foreshortening — ~rotateY(43°). Tilts the ring back so it
    // reads as a 3D loop, not a flat circle. Tuned in tandem with
    // RING_SIZE_END below so the ring's WIDTH (size × TILT_X) stays
    // ~130px while we shrink HEIGHT (= size). The engine only
    // supports horizontal stretch, so to shrink height without
    // shrinking width we compensate by bumping this factor.
    const TILT_X = 0.73;

    // ──────────────────────────────────────────────────────────────────
    // THE RING — one particle's lifecycle, expanding from small to
    // body-encompassing. Same position throughout. Spawned on TWO
    // layers (middle = wrap, front = continuity/visibility-when-small).
    // ──────────────────────────────────────────────────────────────────

    // RING_SIZE_END = canvas-space HEIGHT of the ring at peak. Width
    // is RING_SIZE_END × TILT_X. Currently 178 × 0.73 ≈ 130 wide ×
    // 178 tall — same width as before (was 200 × 0.65 = 130 × 200),
    // height shortened by ~11% so the ring fits the player's
    // silhouette more snugly instead of extending past top/bottom.
    const RING_LIFE = 0.55;
    const RING_SIZE_START = 28;
    const RING_SIZE_END = 178;

    // PRIMARY ring on MIDDLE layer (behind player).
    middle({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: RING_SIZE_START,
      sizeEnd: RING_SIZE_END,
      alpha: 1.0,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic",
      easeAlpha: "outCubic",
      maxLife: RING_LIFE,
      texture: engine.textures.armorAbsorbWrapRing,
      stretchX: TILT_X,
    });

    // FRONT-layer ring at moderate alpha — visible during the SMALL
    // phase (when middle-layer copy would be hidden behind the
    // player sprite) AND provides continuity across the body when
    // the ring is big (so the silhouette doesn't bite into it).
    // Additive blend so it brightens rather than obscures the body.
    // Alpha 0.72 is the sweet spot — opaque enough that the ring
    // crossing the body reads clearly (not "ghostly translucent"),
    // but still translucent enough that the body is visible behind
    // it instead of the ring stamping a solid pink shape over the
    // player's silhouette.
    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: RING_SIZE_START,
      sizeEnd: RING_SIZE_END,
      alpha: 0.72,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic",
      easeAlpha: "outCubic",
      maxLife: RING_LIFE,
      texture: engine.textures.armorAbsorbWrapRing,
      stretchX: TILT_X,
      blendMode: "lighter",
    });

    // ──────────────────────────────────────────────────────────────────
    // CONTENT INSIDE THE SMALL RING — decorated "energy contained"
    // beat. Goal is for the small-ring interior to read as a piece
    // of designed VFX (sharp 16-spoke star + glowing core + twinkling
    // inner sparks), not just a single bright dot floating in a soft
    // pink blob.
    //
    // Layered (back-to-front draw order):
    //   1. BLOOM — tight white→pink halo filling the ring interior
    //      with a contained glow. NOT a smokey blob (parry-style
    //      sharp falloff in the texture itself).
    //   2. INNER TWINKLE SPARKS — 5 tiny bright dots scattered inside
    //      the ring, staggered timings, each twinkling briefly. Adds
    //      "energy contained inside" detail to the interior so it
    //      doesn't read as empty space behind the cross.
    //   3. PRIMARY CROSS FLARE — 8-spoke starburst, the dominant
    //      visual. Rays extend to roughly the ring's edge at flash
    //      peak.
    //   4. SECONDARY CROSS FLARE — same 8-spoke flare rotated 22.5°
    //      so its rays interleave with the primary's, producing a
    //      densely packed 16-SPOKE STAR. This is the "cool design"
    //      detail that takes the flash from "cross + bloom" to
    //      "designed energy starburst".
    //   5. HOT PINPOINT — sharp white-hot center on top.
    //
    // Hard constraint: all of this must fully fade BEFORE the ring
    // becomes "big" (~150ms, ring size ≥150 wrapping the player) so
    // no flash detail lingers inside the wrapped ring.
    // ──────────────────────────────────────────────────────────────────

    // FLASH BLOOM — tight halo behind everything else. Sized larger
    // than before so it actually fills the small-ring interior with
    // a visible white→pink glow (not just a tiny dot). The texture's
    // sharp cutoff at 80% radius keeps it from reading as smokey.
    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 14,
      sizeEnd: 78,
      alpha: 0.95,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outExpo",
      easeAlpha: "linear",
      maxLife: 0.14,
      texture: engine.textures.armorAbsorbFlash,
      blendMode: "lighter",
    });

    // INNER TWINKLE SPARKS — 5 tiny bright dots scattered inside the
    // ring perimeter, each twinkling briefly with staggered delays.
    // Together they shimmer in the interior for the duration of the
    // flash, giving the impression of contained energy crackling
    // around the center. Tiny size (peak 5) and very short lives
    // (≤80ms each) so they read as sparkle detail, not as additional
    // particles cluttering the frame.
    for (let i = 0; i < 5; i++) {
      const sparkleAngle = rand(0, Math.PI * 2);
      const sparkleR = rand(10, 32);
      front({
        x: cx + Math.cos(sparkleAngle) * sparkleR,
        y: cy + Math.sin(sparkleAngle) * sparkleR * 0.85,
        vx: 0, vy: 0, gravity: 0, drag: 1,
        size: rand(1.2, 1.8),
        sizeEnd: rand(4, 5.5),
        alpha: 1.0,
        alphaEnd: 0,
        rotation: 0, rotationSpeed: 0,
        ease: "outExpo",
        easeAlpha: "outQuad",
        maxLife: rand(0.06, 0.09),
        delay: i * 0.018,
        texture: engine.textures.armorAbsorbSpark,
        blendMode: "lighter",
      });
    }

    // PRIMARY 8-POINT CROSS FLARE — first half of the 16-spoke star.
    // Rays at 0/45/90/135° (and reflections). Sized so the ray tips
    // reach the ring's edge at peak flash time.
    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 18,
      sizeEnd: 118,
      alpha: 1.0,
      alphaEnd: 0,
      rotation: rand(-0.06, 0.06),
      rotationSpeed: rand(-0.5, 0.5),
      ease: "outCubic",
      easeAlpha: "linear",
      maxLife: 0.16,
      texture: engine.textures.armorAbsorbCross,
      blendMode: "lighter",
    });

    // SECONDARY 8-POINT CROSS FLARE — rotated 22.5° (π/8) so its
    // rays land between the primary's spokes. Combined the two
    // particles paint a dense 16-SPOKE radial starburst — the
    // signature "cool design" inside the small ring. Slightly
    // smaller and dimmer than the primary so the overall pattern
    // has visible hierarchy (cardinal/diagonal spokes dominate, the
    // in-between filler spokes recede).
    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 14,
      sizeEnd: 96,
      alpha: 0.82,
      alphaEnd: 0,
      rotation: Math.PI / 8 + rand(-0.04, 0.04),
      rotationSpeed: rand(-0.4, 0.4),
      ease: "outCubic",
      easeAlpha: "linear",
      maxLife: 0.16,
      texture: engine.textures.armorAbsorbCross,
      blendMode: "lighter",
    });

    // HOT PINPOINT — sharp white-hot specular on top of everything.
    // Briefest of the flash elements; punctuates the very first
    // frame of the impact.
    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 6,
      sizeEnd: 46,
      alpha: 1.0,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outExpo",
      easeAlpha: "outQuad",
      maxLife: 0.11,
      texture: engine.textures.armorAbsorbCore,
      blendMode: "lighter",
    });

    // ──────────────────────────────────────────────────────────────────
    // SCATTER PARTICLES — burst outward from the ring's perimeter as
    // it reaches its expanded size. Spawn on the TILTED-ELLIPSE
    // perimeter so they shed off the ring's 3D shape consistently.
    // Delayed so they appear when the ring is at its expanded "around
    // the player" size, not during the small phase.
    // ──────────────────────────────────────────────────────────────────

    const SCATTER_COUNT = 10;
    const SCATTER_R = RING_SIZE_END * 0.45;
    for (let i = 0; i < SCATTER_COUNT; i++) {
      const angle = (i / SCATTER_COUNT) * Math.PI * 2 + rand(-0.18, 0.18);
      const spd = rand(60, 130);
      engine.spawn({
        x: cx + Math.cos(angle) * SCATTER_R * TILT_X,
        y: cy + Math.sin(angle) * SCATTER_R,
        vx: Math.cos(angle) * spd * TILT_X,
        vy: Math.sin(angle) * spd,
        gravity: 40,
        drag: 0.93,
        size: rand(2, 3.2),
        sizeEnd: 0.4,
        alpha: 0.95,
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outCubic",
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.32, 0.50),
        delay: 0.32 + rand(-0.04, 0.04),
        texture: engine.textures.armorAbsorbSpark,
        blendMode: "lighter",
      });
    }

    // ──────────────────────────────────────────────────────────────────
    // RESIDUAL MIST — soft trailing tail past the main ring fade so
    // the effect doesn't cut off when the ring vanishes.
    // ──────────────────────────────────────────────────────────────────

    for (let i = 0; i < 4; i++) {
      const angle = -Math.PI / 2 + rand(-0.5, 0.5);
      const spd = rand(28, 60);
      engine.spawn({
        x: cx + rand(-10, 10),
        y: cy + rand(-4, 4),
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        gravity: -25,
        drag: 0.94,
        size: rand(1.6, 2.4),
        sizeEnd: 0.4,
        alpha: 0.8,
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-2, 2),
        maxLife: rand(0.45, 0.70),
        delay: 0.45 + i * 0.04,
        texture: engine.textures.armorAbsorbSpark,
        blendMode: "lighter",
      });
    }
  },

  // ── MATADOR BREAK ───────────────────────────────────────────────────
  // Smaller/shorter shard burst than grabArmorBreak — same family ("defensive
  // structure shattered") without reading as full armor destruction.
  matadorBreak(engine, { x, y, facing }) {
    const dir = facing || 1;
    const cx = x;
    const cy = GAME_H - y;
    const front = (cfg) => engine.spawn({ ...cfg, aboveFighters: true });

    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 14,
      sizeEnd: 40,
      alpha: 0.9,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outExpo", easeAlpha: "outCubic",
      maxLife: 0.11,
      texture: engine.textures.circle,
      blendMode: "lighter",
    });

    const shardCount = 7;
    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2 + rand(-0.25, 0.25);
      const spd = rand(160, 300);
      const shardTex = pick([
        engine.textures.glassShard1,
        engine.textures.glassShard2,
        engine.textures.glassShard3,
        engine.textures.glassShard4,
      ]);
      engine.spawn({
        x: cx + Math.cos(angle) * 6,
        y: cy + Math.sin(angle) * 6,
        vx: Math.cos(angle) * spd + dir * rand(10, 30),
        vy: Math.sin(angle) * spd * 0.8 - rand(20, 60),
        gravity: 620,
        drag: 0.95,
        size: rand(14, 26),
        sizeEnd: rand(8, 14),
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        rotation: angle,
        rotationSpeed: rand(-8, 8),
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.28, 0.42),
        texture: shardTex,
        blendMode: "lighter",
      });
    }

    for (let i = 0; i < 6; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(180, 340);
      engine.spawn({
        x: cx + rand(-4, 4),
        y: cy + rand(-4, 4),
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - rand(10, 30),
        gravity: 560,
        drag: 0.94,
        size: rand(2, 4),
        sizeEnd: 1,
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.14, 0.24),
        texture: engine.textures.glassFleck,
        blendMode: "lighter",
      });
    }
  },

  // ── GRAB ARMOR BREAK ────────────────────────────────────────────────
  // Charged attack shatters the armor — glass shards + flecks only (no smoke
  // rings; those fought the charged hit-spark sprite). Caller anchors at the
  // charged hit-spark contact seam so the shatter reads ON the impact.
  grabArmorBreak(engine, { x, y, facing }) {
    const dir = facing || 1;
    const cx = x;
    const cy = GAME_H - y;
    const front = (cfg) => engine.spawn({ ...cfg, aboveFighters: true });

    // Bright central flash — sells the "shatter" instant under the hit spark
    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 22,
      sizeEnd: 70,
      alpha: 1.0,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outExpo", easeAlpha: "outCubic",
      maxLife: 0.16,
      texture: engine.textures.circle,
      blendMode: "lighter",
    });

    // 14 glass shards bursting outward — the shatter read. Arc up then fall.
    const shardCount = 14;
    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2 + rand(-0.3, 0.3);
      const spd = rand(240, 460);
      const shardTex = pick([
        engine.textures.glassShard1,
        engine.textures.glassShard2,
        engine.textures.glassShard3,
        engine.textures.glassShard4,
      ]);
      engine.spawn({
        x: cx + Math.cos(angle) * 8,
        y: cy + Math.sin(angle) * 8,
        vx: Math.cos(angle) * spd + dir * rand(20, 45),
        vy: Math.sin(angle) * spd * 0.85 - rand(40, 90),
        gravity: 600,
        drag: 0.96,
        size: rand(24, 42),
        sizeEnd: rand(14, 22),
        alpha: rand(0.9, 1.0),
        alphaEnd: 0,
        rotation: angle,
        rotationSpeed: rand(-9, 9),
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.5, 0.75),
        texture: shardTex,
        blendMode: "lighter",
      });
    }

    // 12 bright flecks — "glass dust" — fade fast and scatter wide
    for (let i = 0; i < 12; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(280, 520);
      engine.spawn({
        x: cx + rand(-5, 5),
        y: cy + rand(-5, 5),
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - rand(15, 40),
        gravity: 540,
        drag: 0.94,
        size: rand(3, 6),
        sizeEnd: rand(1, 2),
        alpha: rand(0.9, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.22, 0.36),
        texture: engine.textures.glassFleck,
        blendMode: "lighter",
      });
    }
  },

  // Generic liftoff plume — used by the rope jump (angled sheet, mirrored by
  // facing). `tilted` defaults true; pass dir = facing (±1) to flip.
  // `lift` = extra canvas-px above the grounded foot anchor (higher = up).
  // `yLift` = plume-center fraction of draw size (see LIFTOFF_SMOKE_Y_LIFT).
  liftoffSmoke(engine, { x, y, tilted = true, dir = 1, scale = 1, maxLife = 0.55, lift = 12, yLift }) {
    const footX = x;
    const footY = GAME_H - y - lift;
    spawnLiftoffSmoke(engine, footX, footY, {
      tilted,
      flip: dir < 0,
      scale,
      maxLife,
      yLift,
    });
  },

  // ── FLAP liftoff — vertical launch burst at the moment of takeoff ─────────
  // Layered like dashStart but aimed upward: ground ring + ice kick + wing
  // thrust lines + displaced-air puffs. Softer than throwLand (launch, not impact).
  flapLiftoff(engine, { x, y, facing, beatHDir }) {
    const dir = facing || 1;
    const hDir = beatHDir || 0;
    const lineTilt = hDir * 0.38;
    const footX = x;
    const footY = GAME_H - y - 12;
    const wingY = GAME_H - y - 78;
    const bodyX = footX;

    // Launch smoke plume (sprite): straight-up when neutral, angled when the
    // player is lunging with A/D. Mirror the tilted plume for leftward lunges.
    const tilted = hDir !== 0;
    spawnLiftoffSmoke(engine, footX, footY, {
      tilted,
      flip: hDir < 0,
    });

    // Ice chips kicked from the dohyo surface
    for (let i = 0; i < 3; i++) {
      const spread = rand(-0.6, 0.6);
      const speed = rand(90, 170);
      engine.spawn({
        x: footX + rand(-8, 8),
        y: footY - rand(2, 6),
        vx: Math.cos(spread) * speed + rand(-18, 18),
        vy: Math.abs(Math.sin(spread)) * speed * 0.45 + rand(10, 30),
        gravity: 320,
        drag: 0.95,
        size: rand(2, 4),
        sizeEnd: rand(1, 2),
        alpha: rand(0.55, 0.8),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-4, 4),
        maxLife: rand(0.16, 0.28),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }

    // Upward wing thrust lines — vertical when neutral, tilted with A/D lunge
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const thickness = rand(2.5, 4);
        engine.spawn({
          x: bodyX + side * dir * rand(34, 52) + hDir * rand(6, 14),
          y: wingY + rand(-6, 10),
          vx: 0,
          vy: 0,
          gravity: 0,
          drag: 1,
          size: thickness,
          sizeEnd: thickness,
          alpha: rand(0.85, 1.0),
          alphaEnd: 0,
          rotation: -Math.PI / 2 + lineTilt,
          rotationSpeed: 0,
          ease: "linear",
          easeAlpha: "inCubic",
          maxLife: rand(0.1, 0.18),
          texture: pick([engine.textures.speedLine, engine.textures.speedLineThin]),
          stretchX: rand(12, 18),
        });
      }
    }

    // Wing-tip sparks — mirrored outward from each wing
    for (const side of [-1, 1]) {
      engine.spawn({
        x: bodyX + side * dir * rand(38, 56),
        y: wingY + rand(4, 14),
        vx: side * dir * rand(40, 80),
        vy: rand(40, 80),
        gravity: 100,
        drag: 0.92,
        size: rand(3, 5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.1, 0.16),
        texture: pick([engine.textures.spark, engine.textures.sparkSmall]),
        blendMode: "lighter",
      });
    }
  },

  // ── FLAP air charge — cute down-feather puffs + ice sparkles ─────────────
  // Soft and playful to match the wing-beat animation; no speed lines.
  // beatHDir (-1 = A, 0 = neutral, 1 = D) biases puff size/velocity sideways.
  flapWingBeat(engine, { x, y, facing, beatHDir }) {
    const dir = facing || 1;
    const hDir = beatHDir || 0;
    const wingY = GAME_H - y - 82;
    const wakeY = GAME_H - y - 74;
    const bodyX = x;

    // Down-feather puffs — two soft blooms under each wing per beat (4 total)
    // for a fuller cluster. The second puff is slightly smaller/offset so they
    // read as a little burst rather than a clone.
    for (const side of [-1, 1]) {
      const leadBoost = hDir === 0 ? 1 : side === hDir ? rand(1.15, 1.32) : rand(0.88, 0.96);
      for (let k = 0; k < 2; k++) {
        const sizeMul = k === 0 ? 1 : rand(0.66, 0.82);
        const size = rand(64, 96) * leadBoost * sizeMul;
        spawnSmokePuff(engine, {
          x: bodyX + side * dir * rand(32, 52) + hDir * rand(8, 18) + rand(-10, 10),
          y: wakeY + rand(0, 8) + k * rand(4, 12),
          vx: side * dir * rand(18, 42) + hDir * rand(28, 58),
          vy: rand(40, 78),
          gravity: 24,
          drag: 0.91,
          size,
          sizeEnd: size * 1.05, // sheet does the bloom/dissipate itself
          alpha: rand(0.72, 0.9),
          alphaEnd: 0,
          ease: "outCubic",
          easeAlpha: "inCubic",
          maxLife: rand(0.34, 0.52),
          delay: k === 0 ? 0 : rand(0.02, 0.06),
        });
      }
    }

    // Ice sparkles — larger, brighter, always additive; spawn wide at wing tips
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const size = rand(7, 13);
      engine.spawn({
        x: bodyX + side * dir * rand(36, 56) + hDir * rand(6, 16),
        y: wingY + rand(-6, 8),
        vx: side * dir * rand(14, 36) + hDir * rand(18, 42),
        vy: rand(-55, -20),
        gravity: 40,
        drag: 0.92,
        size,
        sizeEnd: rand(3, 5),
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-8, 8),
        maxLife: rand(0.32, 0.5),
        texture: pick([
          engine.textures.circleIce,
          engine.textures.circle,
          engine.textures.chunkIce,
        ]),
        blendMode: "lighter",
      });
    }

    // Bright twinkle pinpoints — full spark texture, unmistakable glint
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      engine.spawn({
        x: bodyX + side * dir * rand(38, 58) + hDir * rand(8, 18),
        y: wingY + rand(-4, 8),
        vx: side * dir * rand(10, 26) + hDir * rand(14, 32),
        vy: rand(-42, -12),
        gravity: 30,
        drag: 0.9,
        size: rand(6, 10),
        sizeEnd: rand(2, 4),
        alpha: rand(0.9, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-3, 3),
        maxLife: rand(0.22, 0.38),
        texture: pick([engine.textures.spark, engine.textures.sparkSmall]),
        blendMode: "lighter",
      });
    }
  },

  // ── FLAP fast-fall — committed S-key dive trail ───────────────────────────
  // Streaks spawn ABOVE the tucked dive pose and shoot downward past the
  // player (original direction read). Wiggly rotation is intentional.
  flapFastFallTrail(engine, { x, y, facing }) {
    const dir = facing || 1;
    const bodyY = GAME_H - y - 68;
    const bodyX = x;

    // Vertical dive lines — above the body, streaking down
    for (let i = 0; i < 4; i++) {
      const thickness = rand(2.5, 4.5);
      const stretch = rand(12, 22);
      engine.spawn({
        x: bodyX + rand(-28, 28) + dir * rand(-8, 8),
        y: bodyY - rand(12, 32),
        vx: dir * rand(-25, 25),
        vy: rand(180, 340),
        gravity: 0,
        drag: 0.96,
        size: thickness,
        sizeEnd: thickness * 0.45,
        alpha: rand(0.8, 1.0),
        alphaEnd: 0,
        rotation: Math.PI / 2 + rand(-0.15, 0.15),
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.1, 0.2),
        texture: pick([engine.textures.speedLine, engine.textures.speedLineIce]),
        stretchX: stretch,
      });
    }

    // Thinner accent streaks flanking the dive, further above
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const thickness = rand(2, 3);
      engine.spawn({
        x: bodyX + side * dir * rand(32, 52),
        y: bodyY - rand(8, 24),
        vx: side * rand(15, 40),
        vy: rand(140, 260),
        gravity: 0,
        drag: 0.97,
        size: thickness,
        sizeEnd: thickness * 0.4,
        alpha: rand(0.65, 0.88),
        alphaEnd: 0,
        rotation: Math.PI / 2 + side * rand(0.05, 0.2),
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.08, 0.16),
        texture: engine.textures.speedLineThin,
        stretchX: rand(10, 16),
      });
    }

    // Torn-air wisps — ripped upward above the diving silhouette (animated
    // smoke-puff sprite).
    if (Math.random() < 0.7) {
      const size = rand(38, 58);
      spawnSmokePuff(engine, {
        x: bodyX + rand(-22, 22),
        y: bodyY - rand(4, 16),
        vx: rand(-40, 40),
        vy: rand(-80, -30),
        gravity: 20,
        drag: 0.9,
        size,
        sizeEnd: size * 1.05,
        alpha: rand(0.45, 0.65),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "outQuad",
        maxLife: rand(0.14, 0.24),
      });
    }

    // Dive sparks — bright points trailing from above
    if (Math.random() < 0.45) {
      engine.spawn({
        x: bodyX + rand(-20, 20),
        y: bodyY - rand(6, 20),
        vx: rand(-50, 50),
        vy: rand(60, 140),
        gravity: 80,
        drag: 0.93,
        size: rand(3, 5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.8, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.08, 0.14),
        texture: pick([engine.textures.spark, engine.textures.sparkSmall]),
        blendMode: "lighter",
      });
    }
  },
};

// ─── Engine ─────────────────────────────────────────────────────────

class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 0;
    this.drag = 1;
    this.size = 1;
    this.sizeEnd = 0;
    this.alpha = 1;
    this.alphaEnd = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.life = 0;
    this.maxLife = 1;
    this.texture = null;
    this.ease = "linear";
    this.easeAlpha = null;
    this.blendMode = null;
    this.stretchX = 1;
    this.groundY = Infinity;
    this.delay = 0;
    this.behindDohyo = false;
    this.behindDohyoWhenOutside = false;
    this.aboveFighters = false;
    // Optional follow target — if set, the particle's x/y are shifted each
    // frame by the delta from this getter, so the particle stays anchored
    // to a moving target (e.g. a player sprite) while still applying its
    // own local vx/vy motion (e.g. converging toward the target).
    this.followGetter = null;
    this.lastFollowX = 0;
    this.lastFollowY = 0;
    /** Cleared instantly when a perfect raw parry fires so gold burst isn't mixed with hold-VFX blues. */
    this.rawParryBlueHold = false;
    /** MATADOR amber hold plume — cleared when the window ends / success fires. */
    this.matadorGoldHold = false;
    // Optional animated sprite sheet. When `sheet` is set, the renderer steps
    // through frames [sheetStart..sheetEnd] of the grid over the particle's life
    // instead of drawing a static `texture`.
    this.sheet = null;
    this.sheetCols = 1;
    this.sheetRows = 1;
    this.sheetStart = 0;
    this.sheetEnd = 0;
  }
}

export class ParticleEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.canvasBehind = null;
    this.ctxBehind = null;
    this.canvasFront = null;
    this.ctxFront = null;
    this.particles = [];
    this.textures = null;
    // Per-player accent textures keyed by playerNumber (1 or 2). Each entry is
    // { haloRing, trailPuff } baked at color-pick time from the player's
    // mawashi color via setAccentTextures(). Presets that need player-color
    // particles read from this map (e.g. localPlayerHalo, sidestepTrail).
    this.accentTextures = {};
    this._rafId = null;
    this._lastTime = 0;
    this.frozen = false;
    // Idle-skip bookkeeping: how many particles were active after the last
    // _update, and whether we've already committed a final "empty" clear. Lets
    // _render skip three full-screen clearRects every frame when nothing is on
    // screen (which is most of the time) instead of paying that cost always.
    this._activeCount = 0;
    this._renderedEmpty = false;
    // Phase 3: when idle (no active particles, canvases cleared), stop scheduling
    // rAF entirely. spawn()/emit() call _wake(). Previously the loop ran forever
    // and scanned the 500-slot pool every frame even with nothing to draw.
    this._sleeping = false;
    // Rolling cursor for _acquire() so burst spawns don't re-scan from 0.
    this._acquireCursor = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(new Particle());
    }
  }

  init(canvas) {
    this.canvas = canvas;
    const dpr = getCanvasDpr();
    const rect = canvas.getBoundingClientRect();
    const physW = Math.round(rect.width * dpr);
    const physH = Math.round(rect.height * dpr);
    canvas.width = physW;
    canvas.height = physH;
    this.ctx = canvas.getContext("2d");
    this.ctx.scale(physW / GAME_W, physH / GAME_H);
    const texScale = Math.min(physW / GAME_W, 3);
    this.textures = generateTextures(texScale);
    this._start();
  }

  initBehind(canvas) {
    this.canvasBehind = canvas;
    const dpr = getCanvasDpr();
    const rect = canvas.getBoundingClientRect();
    const physW = Math.round(rect.width * dpr);
    const physH = Math.round(rect.height * dpr);
    canvas.width = physW;
    canvas.height = physH;
    this.ctxBehind = canvas.getContext("2d");
    this.ctxBehind.scale(physW / GAME_W, physH / GAME_H);
  }

  initFront(canvas) {
    this.canvasFront = canvas;
    const dpr = getCanvasDpr();
    const rect = canvas.getBoundingClientRect();
    const physW = Math.round(rect.width * dpr);
    const physH = Math.round(rect.height * dpr);
    canvas.width = physW;
    canvas.height = physH;
    this.ctxFront = canvas.getContext("2d");
    this.ctxFront.scale(physW / GAME_W, physH / GAME_H);
  }

  emit(presetName, opts) {
    const fn = PRESETS[presetName];
    if (!fn) return;
    this._wake();
    fn(this, opts);
  }

  /** Removes in-flight canvas particles from raw-parry hold (space) VFX only. */
  clearRawParryBlueHoldParticles() {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.active && p.rawParryBlueHold) p.active = false;
    }
  }

  clearMatadorGoldHoldParticles() {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.active && p.matadorGoldHold) p.active = false;
    }
  }

  /**
   * Removes in-flight palm-thrust force-cone particles for ONE owner. Called
   * when that thruster gets hit (isHit) so a whiffed cone doesn't hang frozen
   * in the air during the hit's hitstop while the player is knocked into a
   * totally different pose. Scoped by owner id so the VICTIM of a palm thrust
   * getting hit can't wipe the ATTACKER's cone (that made it look like the
   * cone cleared the instant it connected). Omit `owner` to clear all.
   */
  clearPalmThrustParticles(owner = null) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (
        p.active &&
        p.palmThrustFx &&
        (owner == null || p.palmThrustOwner === owner)
      ) {
        p.active = false;
      }
    }
  }

  // Bake per-player accent textures (halo ring + trail puff) tinted to the
  // player's mawashi color. Called by PlayerColorContext whenever a player's
  // color is applied, so the engine always has up-to-date colored textures
  // ready for sidestep / halo presets to consume.
  //
  // accents = { player1: { rgb: [r,g,b] }, player2: { rgb: [r,g,b] } }
  // (You can pass either or both — missing keys leave the existing entry
  // alone, so re-baking only one player doesn't wipe the other's textures.)
  //
  // Texture sizes are scaled by the same physW/GAME_W ratio used by
  // generateTextures() so the accent textures pixel-match the rest of the
  // texture set on this display.
  setAccentTextures(accents) {
    if (!this.canvas || !this.ctx) return;
    const dpr = getCanvasDpr();
    const rect = this.canvas.getBoundingClientRect();
    const physW = Math.round(rect.width * dpr);
    const texScale = Math.min(physW / GAME_W, 3);
    const r = (v) => Math.round(v * texScale);

    Object.entries(accents).forEach(([playerKey, data]) => {
      if (!data || !data.rgb) return;
      this.accentTextures[playerKey] = {
        // Built at ~3.7:1 aspect to match how localPlayerHalo renders
        // it (size 34 with stretchX 3.7) — symmetric per-axis scaling,
        // no stroke distortion.
        haloRing: createHaloRing(r(260), r(70), data.rgb),
        trailPuff: createColoredPuff(r(72), data.rgb, 4242),
      };
    });
  }

  spawn(cfg) {
    this._wake();
    const p = this._acquire();
    if (!p) return;
    p.active = true;
    p.x = cfg.x ?? 0;
    p.y = cfg.y ?? 0;
    p.vx = cfg.vx ?? 0;
    p.vy = cfg.vy ?? 0;
    p.gravity = cfg.gravity ?? 0;
    p.drag = cfg.drag ?? 0.98;
    p.size = cfg.size ?? 10;
    p.sizeEnd = cfg.sizeEnd ?? p.size;
    p.alpha = cfg.alpha ?? 1;
    p.alphaEnd = cfg.alphaEnd ?? 0;
    p.rotation = cfg.rotation ?? Math.random() * Math.PI * 2;
    p.rotationSpeed = cfg.rotationSpeed ?? 0;
    p.life = 0;
    p.maxLife = cfg.maxLife ?? 0.5;
    p.texture = cfg.texture ?? null;
    p.ease = cfg.ease ?? "linear";
    p.easeAlpha = cfg.easeAlpha ?? null;
    p.blendMode = cfg.blendMode ?? null;
    p.stretchX = cfg.stretchX ?? 1;
    p.groundY = cfg.groundY ?? Infinity;
    p.delay = cfg.delay ?? 0;
    p.behindDohyo = cfg.behindDohyo ?? false;
    // Dynamic variant: route to the behind-dohyo canvas only while the
    // particle's tracked X is past the ring boundary (e.g. the local-player
    // halo following its owner during a ring-out). Evaluated per-frame in
    // _render so it flips exactly when the player crosses the edge.
    p.behindDohyoWhenOutside = cfg.behindDohyoWhenOutside ?? false;
    p.aboveFighters = cfg.aboveFighters ?? false;
    p.followGetter = cfg.followGetter ?? null;
    if (p.followGetter) {
      const initial = p.followGetter();
      p.lastFollowX = initial?.x ?? 0;
      p.lastFollowY = initial?.y ?? 0;
    } else {
      p.lastFollowX = 0;
      p.lastFollowY = 0;
    }
    p.rawParryBlueHold = cfg.rawParryBlueHold ?? false;
    p.matadorGoldHold = cfg.matadorGoldHold ?? false;
    p.palmThrustFx = cfg.palmThrustFx ?? false;
    p.palmThrustOwner = cfg.palmThrustOwner ?? null;
    p.sheet = cfg.sheet ?? null;
    p.sheetCols = cfg.sheetCols ?? 1;
    p.sheetRows = cfg.sheetRows ?? 1;
    p.sheetStart = cfg.sheetStart ?? 0;
    p.sheetEnd = cfg.sheetEnd ?? 0;
  }

  _acquire() {
    // Rolling-cursor free-slot search. The old version restarted the scan from
    // index 0 every spawn, so a burst preset (e.g. perfectParryFlameBurst spawns
    // ~45 particles in one frame) re-walked the entire active prefix each call —
    // up to ~MAX_PARTICLES iterations per spawn, on the exact frame an
    // interaction lands. Starting from where the last slot was found makes the
    // common case ~O(1): consecutive spawns walk forward through free slots
    // instead of re-scanning the busy front. Worst case is still a full wrap.
    const n = this.particles.length;
    let idx = this._acquireCursor;
    for (let i = 0; i < n; i++) {
      if (!this.particles[idx].active) {
        this._acquireCursor = idx + 1 >= n ? 0 : idx + 1;
        return this.particles[idx];
      }
      idx = idx + 1 >= n ? 0 : idx + 1;
    }
    return null;
  }

  _wake() {
    if (!this.canvas) return; // destroyed
    if (!this._sleeping && this._rafId != null) return;
    this._sleeping = false;
    this._lastTime = performance.now();
    if (this._rafId == null) {
      this._rafId = requestAnimationFrame((now) => this._tick(now));
    }
  }

  _goToSleep() {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._sleeping = true;
    try {
      const perf = globalThis.__PUMO_PERF;
      if (perf?.enabled) perf.count("particles.sleep");
    } catch {
      /* ignore */
    }
  }

  _tick(now) {
    this._rafId = null;
    if (this._sleeping) return;
    const dt = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;
    if (!this.frozen) {
      this._update(dt);
    }
    this._render();
    // Sleep only after a committed empty frame. Hitstop (frozen) with
    // in-flight VFX keeps ticking because _activeCount > 0; emit/spawn wake.
    if (this._activeCount === 0 && this._renderedEmpty) {
      this._goToSleep();
      return;
    }
    this._rafId = requestAnimationFrame((t) => this._tick(t));
  }

  _start() {
    this._sleeping = false;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame((now) => this._tick(now));
  }

  _update(dt) {
    let active = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      if (p.delay > 0) {
        p.delay -= dt;
        active++;
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife || p.y >= p.groundY) {
        p.active = false;
        continue;
      }
      active++;

      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;

      // Apply follow target shift AFTER local-velocity integration. The
      // particle's own motion (vx/vy converging toward center, etc.) still
      // happens in its local frame; the follow shift just translates that
      // local frame to keep up with a moving anchor (e.g. a player who's
      // still moving forward during a 280ms absorb VFX).
      if (p.followGetter) {
        const pos = p.followGetter();
        if (pos) {
          p.x += pos.x - p.lastFollowX;
          p.y += pos.y - p.lastFollowY;
          p.lastFollowX = pos.x;
          p.lastFollowY = pos.y;
        }
      }
    }
    this._activeCount = active;
  }

  _renderParticle(ctx, p) {
    const rawT = p.life / p.maxLife;
    const easeFnSize = EASE[p.ease] || EASE.linear;
    const easeFnAlpha = EASE[p.easeAlpha] || easeFnSize;
    const tSize = easeFnSize(rawT);
    const tAlpha = easeFnAlpha(rawT);

    const alpha = p.alpha + (p.alphaEnd - p.alpha) * tAlpha;
    const size = p.size + (p.sizeEnd - p.size) * tSize;

    if (alpha <= 0.005 || size <= 0.5) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.blendMode) ctx.globalCompositeOperation = p.blendMode;
    ctx.translate(p.x, p.y);
    if (p.rotation) ctx.rotate(p.rotation);
    if (p.stretchX !== 1) ctx.scale(p.stretchX, 1);
    const half = size / 2;
    if (p.sheet) {
      // Animated sprite sheet: pick the frame for this point in the life, then
      // blit that frame's sub-rect scaled to the particle's draw size.
      const total = p.sheetEnd - p.sheetStart + 1;
      let fi = p.sheetStart + Math.floor(rawT * total);
      if (fi > p.sheetEnd) fi = p.sheetEnd;
      // Support both <img> (naturalWidth) and offscreen <canvas> (width) sheets.
      const sheetW = p.sheet.naturalWidth || p.sheet.width;
      const sheetH = p.sheet.naturalHeight || p.sheet.height;
      const fw = sheetW / p.sheetCols;
      const fh = sheetH / p.sheetRows;
      const sx = (fi % p.sheetCols) * fw;
      const sy = Math.floor(fi / p.sheetCols) * fh;
      ctx.drawImage(p.sheet, sx, sy, fw, fh, -half, -half, size, size);
    } else {
      ctx.drawImage(p.texture, -half, -half, size, size);
    }
    ctx.restore();
  }

  _render() {
    const { ctx, ctxBehind, ctxFront } = this;
    if (!ctx) return;

    // IDLE SKIP: when no particles are active, the canvases are already clear
    // from the last "empty" render, so skip the three full-screen clearRect
    // calls this frame. This removes a constant per-frame fillrate cost that
    // previously ran even with nothing on screen. Bypassed while frozen
    // (hitstop), since new impact VFX can be emitted mid-freeze and must draw.
    if (!this.frozen && this._activeCount === 0) {
      if (this._renderedEmpty) return;
      ctx.clearRect(0, 0, GAME_W, GAME_H);
      if (ctxBehind) ctxBehind.clearRect(0, 0, GAME_W, GAME_H);
      if (ctxFront) ctxFront.clearRect(0, 0, GAME_W, GAME_H);
      this._renderedEmpty = true;
      return;
    }
    this._renderedEmpty = false;

    ctx.clearRect(0, 0, GAME_W, GAME_H);
    if (ctxBehind) ctxBehind.clearRect(0, 0, GAME_W, GAME_H);
    if (ctxFront) ctxFront.clearRect(0, 0, GAME_W, GAME_H);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active || (!p.texture && !p.sheet) || p.delay > 0) continue;

      // `behindDohyoWhenOutside` particles (p.x is tracked in GAME-space)
      // route behind the dohyo only once their owner crosses the ring edge,
      // so the local-player halo sinks behind the platform on a ring-out and
      // sits on the floor normally otherwise.
      const behind =
        p.behindDohyo ||
        (p.behindDohyoWhenOutside &&
          (p.x < DOHYO_LEFT_BOUNDARY || p.x > DOHYO_RIGHT_BOUNDARY));

      if (behind && ctxBehind) {
        this._renderParticle(ctxBehind, p);
      } else if (p.aboveFighters && ctxFront) {
        this._renderParticle(ctxFront, p);
      } else {
        this._renderParticle(ctx, p);
      }
    }
  }

  destroy() {
    this._sleeping = true;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.canvasBehind = null;
    this.ctxBehind = null;
    this.canvasFront = null;
    this.ctxFront = null;
  }
}
