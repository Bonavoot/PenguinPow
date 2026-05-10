const MAX_PARTICLES = 500;
const GAME_W = 1280;
const GAME_H = 720;

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

// Angular wedge with a bright leading edge — reads as a thin shard of glass
// when spawned at random rotations. Multiple seeds produce subtly different
// silhouettes so a burst of shards doesn't look stamped from one cookie cutter.
function createGlassShard(size, seed) {
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

  // Edge-lit gradient: bright white-yellow tip, fading to pale yellow tail
  const grad = ctx.createLinearGradient(tailX, half, tipX, half);
  grad.addColorStop(0, "rgba(255,235,140,0)");
  grad.addColorStop(0.18, "rgba(255,240,170,0.55)");
  grad.addColorStop(0.55, "rgba(255,250,210,0.85)");
  grad.addColorStop(0.85, "rgba(255,255,240,1.0)");
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
  tipGrad.addColorStop(0.6, "rgba(255,250,210,0.6)");
  tipGrad.addColorStop(1, "rgba(255,235,140,0)");
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

function createCrossFlare(size, r, g, b) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const half = size / 2;

  // Hot white-pink core. Bright nucleus the rays radiate from.
  const core = ctx.createRadialGradient(half, half, 0, half, half, size * 0.32);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.35, "rgba(255,235,242,0.95)");
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
    drawTaperedRay(half * 0.96, size * 0.05, 1.0, "255,170,200");
    ctx.restore();
  }

  // 4 SECONDARY rays — shorter, thinner, on the diagonals. Adds the
  // 8-point flare silhouette without competing with the primaries.
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
    drawTaperedRay(half * 0.62, size * 0.022, 0.7, "255,200,220");
    ctx.restore();
  }

  return c;
}

// ─── Hit Spark textures ─────────────────────────────────────────────
// Irregular starburst — hand-drawn-looking star with jagged rays
function createHitStarburst(size, seed, r = 255, g = 220, b = 100) {
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

  const rays = 5 + Math.floor(srand() * 4);
  const baseAngle = srand() * Math.PI * 2;

  for (let i = 0; i < rays; i++) {
    const angle = baseAngle + (i / rays) * Math.PI * 2 + (srand() - 0.5) * 0.4;
    const rayLen = half * (0.55 + srand() * 0.4);
    const tipWidth = size * (0.03 + srand() * 0.04);
    const baseWidth = size * (0.08 + srand() * 0.07);

    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(angle);

    const grad = ctx.createLinearGradient(0, 0, rayLen, 0);
    grad.addColorStop(0, `rgba(255,255,255,0.95)`);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},0.9)`);
    grad.addColorStop(0.7, `rgba(${r},${Math.max(0, g - 60)},${Math.max(0, b - 40)},0.6)`);
    grad.addColorStop(1, `rgba(${r},${Math.max(0, g - 80)},0,0)`);

    ctx.beginPath();
    ctx.moveTo(0, -baseWidth);
    const ctrl1x = rayLen * (0.3 + srand() * 0.2);
    const ctrl1y = -baseWidth * (0.5 + srand() * 0.5);
    const ctrl2x = rayLen * (0.6 + srand() * 0.2);
    const ctrl2y = -tipWidth * (0.3 + srand() * 0.7);
    ctx.bezierCurveTo(ctrl1x, ctrl1y, ctrl2x, ctrl2y, rayLen, 0);
    ctx.bezierCurveTo(ctrl2x, tipWidth * (0.3 + srand() * 0.7), ctrl1x, baseWidth * (0.5 + srand() * 0.5), 0, baseWidth);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // White-hot center glow
  const coreGrad = ctx.createRadialGradient(half, half, 0, half, half, half * 0.35);
  coreGrad.addColorStop(0, "rgba(255,255,255,1)");
  coreGrad.addColorStop(0.5, "rgba(255,255,255,0.7)");
  coreGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(half, half, half * 0.35, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

// Organic slash mark — tapered curved brushstroke
function createHitSlash(length, thickness, seed) {
  const c = document.createElement("canvas");
  const pad = thickness * 2;
  c.width = length + pad * 2;
  c.height = thickness * 4 + pad * 2;
  const ctx = c.getContext("2d");

  let s = seed;
  const srand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const cy = c.height / 2;
  const startX = pad;
  const endX = length + pad;
  const curveAmt = thickness * (0.5 + srand() * 1.5) * (srand() > 0.5 ? 1 : -1);

  const steps = 16;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const curve = Math.sin(t * Math.PI) * curveAmt;
    const thickHere = thickness * Math.sin(t * Math.PI) * (0.8 + srand() * 0.4);
    const jitterY = (srand() - 0.5) * thickness * 0.3;
    points.push({ x, y: cy + curve + jitterY, thick: thickHere });
  }

  // Build upper and lower edges
  const upper = points.map(p => ({ x: p.x, y: p.y - p.thick }));
  const lower = points.map(p => ({ x: p.x, y: p.y + p.thick })).reverse();

  ctx.beginPath();
  ctx.moveTo(upper[0].x, upper[0].y);
  for (let i = 1; i < upper.length; i++) {
    const prev = upper[i - 1];
    const cur = upper[i];
    ctx.quadraticCurveTo(
      (prev.x + cur.x) / 2, prev.y + (srand() - 0.5) * thickness * 0.2,
      cur.x, cur.y
    );
  }
  for (let i = 0; i < lower.length; i++) {
    const cur = lower[i];
    ctx.lineTo(cur.x, cur.y);
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(startX, 0, endX, 0);
  grad.addColorStop(0, "rgba(255,200,80,0)");
  grad.addColorStop(0.15, "rgba(255,240,200,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.85, "rgba(255,240,200,0.9)");
  grad.addColorStop(1, "rgba(255,200,80,0)");
  ctx.fillStyle = grad;
  ctx.fill();

  return c;
}

// Organic smear — short thick splatter mark
function createHitSmear(size, seed) {
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

  const blobs = 5 + Math.floor(srand() * 4);
  const drift = srand() * Math.PI * 2;

  for (let i = 0; i < blobs; i++) {
    const t = i / blobs;
    const dist = half * (0.05 + t * 0.45 + (srand() - 0.5) * 0.15);
    const angle = drift + (srand() - 0.5) * 1.2;
    const bx = half + Math.cos(angle) * dist;
    const by = half + Math.sin(angle) * dist;
    const br = size * (0.12 + srand() * 0.14) * (1 - t * 0.3);

    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, `rgba(255,255,255,${0.9 - t * 0.2})`);
    grad.addColorStop(0.4, `rgba(255,${220 - t * 40},${120 - t * 30},${0.8 - t * 0.15})`);
    grad.addColorStop(0.8, `rgba(255,${180 - t * 50},${60 - t * 20},${0.4 - t * 0.1})`);
    grad.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(bx, by, br, br * (0.6 + srand() * 0.5), srand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
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

    hitStar1: createHitStarburst(r(64), 1111),
    hitStar2: createHitStarburst(r(64), 3333),
    hitStar3: createHitStarburst(r(64), 5555),
    hitStarBig1: createHitStarburst(r(96), 7777),
    hitStarBig2: createHitStarburst(r(96), 9999),

    hitSlash1: createHitSlash(r(80), r(6), 2222),
    hitSlash2: createHitSlash(r(80), r(6), 4444),
    hitSlash3: createHitSlash(r(60), r(5), 6666),

    hitSmear1: createHitSmear(r(48), 1357),
    hitSmear2: createHitSmear(r(48), 2468),
    hitSmear3: createHitSmear(r(48), 3579),

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

    // Grab-armor break: white-yellow glass shards + a brighter break ring
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

const PRESETS = {

  // Fired once at dash start — smoke puffs, speed lines, ice chips, and burst ring
  dashStart(engine, { x, y, direction, facing }) {
    const dir = direction || facing || 1;
    const footX = x;
    const footY = GAME_H - y;

    // ── GROUND DUST — tight compact cluster behind the character ──
    const puffOffsets = [4, 18, 34];
    for (let i = 0; i < puffOffsets.length; i++) {
      const t = i / (puffOffsets.length - 1);
      const size = rand(28, 38) + t * 12;
      engine.spawn({
        x: footX + -dir * (puffOffsets[i] + rand(-2, 2)),
        y: footY - size * 0.45 + rand(0, 3),
        vx: -dir * rand(60, 100),
        vy: rand(-2, 2),
        gravity: 20,
        drag: 0.88,
        size,
        sizeEnd: size * rand(0.3, 0.45),
        alpha: rand(0.75, 0.9),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-0.6, 0.6),
        maxLife: rand(0.28, 0.38),
        texture: pickPuff(engine.textures),
      });
    }

    // ── SPEED LINES — sharp streaks at body height in dash direction ──
    const bodyY = footY - 55;
    for (let i = 0; i < 3; i++) {
      const thickness = rand(2.5, 4);
      const stretch = rand(14, 22);
      engine.spawn({
        x: footX + dir * rand(5, 20),
        y: bodyY + rand(-20, 20),
        vx: dir * rand(180, 320),
        vy: rand(-8, 8),
        gravity: 0,
        drag: 0.92,
        size: thickness,
        sizeEnd: thickness * 0.6,
        alpha: rand(0.8, 1.0),
        alphaEnd: 0,
        rotation: 0,
        rotationSpeed: 0,
        ease: "linear",
        easeAlpha: "inCubic",
        maxLife: rand(0.1, 0.16),
        texture: pick([engine.textures.speedLine, engine.textures.speedLineThin]),
        stretchX: stretch,
      });
    }

    // ── ICE CHIPS — a few small chunks kicked from the ground ────
    for (let i = 0; i < 4; i++) {
      const spread = rand(-0.4, 0.4);
      const speed = rand(100, 200);
      engine.spawn({
        x: footX + rand(-6, 6),
        y: footY - rand(2, 6),
        vx: -dir * Math.cos(spread) * speed + rand(-20, 20),
        vy: -Math.abs(Math.sin(spread)) * speed * 0.35 + rand(-8, 0),
        gravity: 400,
        drag: 0.96,
        size: rand(2, 5),
        sizeEnd: rand(1, 2),
        alpha: rand(0.6, 0.9),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-5, 5),
        maxLife: rand(0.18, 0.3),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }

    // ── BURST RING — fast-expanding horizontal shockwave at the feet ──
    const ringTextures = [engine.textures.ring, engine.textures.ringAlt];
    for (let i = 0; i < 2; i++) {
      engine.spawn({
        x: footX - dir * 8,
        y: footY - 14,
        vx: 0, vy: 0, gravity: 0, drag: 1,
        size: 6 * (1 + i * 0.08),
        sizeEnd: 36 * (1 + i * 0.08),
        alpha: rand(0.75, 0.9),
        alphaEnd: 0,
        rotation: 0, rotationSpeed: 0,
        ease: "outExpo", easeAlpha: "outCubic",
        maxLife: 0.22 + i * 0.03,
        texture: ringTextures[i],
        stretchX: 2.4,
        delay: i * 0.02,
      });
    }

    // ── INITIAL SPARKS — bright points that burst from the feet at launch ──
    for (let i = 0; i < 5; i++) {
      const angle = rand(-1.0, 0.6);
      const spd = rand(120, 260);
      engine.spawn({
        x: footX + rand(-4, 4),
        y: footY - rand(3, 10),
        vx: -dir * Math.cos(angle) * spd + rand(-15, 15),
        vy: -Math.abs(Math.sin(angle)) * spd * 0.5 + rand(-30, -5),
        gravity: 500,
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

  // Expanding ring for pull reversal hop landings. Scales with intensity.
  // 3 overlapping rings build up opacity like stacked clouds.
  pullReversalLand(engine, { x, y, intensity }) {
    const footX = x;
    const footY = GAME_H - y - 12;
    const s = Math.min(Math.max(intensity || 0.5, 0), 1);
    const textures = [engine.textures.ring, engine.textures.ringAlt, engine.textures.ringThick];
    for (let i = 0; i < 3; i++) {
      const scale = 1 + i * 0.06;
      engine.spawn({
        x: footX,
        y: footY,
        vx: 0, vy: 0, gravity: 0, drag: 1,
        size: 8 * (0.5 + s * 0.5) * scale,
        sizeEnd: 43 * (0.5 + s * 0.5) * scale,
        alpha: Math.min(1, 0.95 * s),
        alphaEnd: 0,
        rotation: 0, rotationSpeed: 0,
        ease: "outCubic", easeAlpha: "outCubic",
        maxLife: 0.32 + i * 0.02,
        texture: textures[i],
        stretchX: 2.1,
      });
    }
  },

  // Expanding ring for throw landing. Bigger impact than pull reversal.
  throwLand(engine, { x, y }) {
    const footX = x;
    const footY = GAME_H - y - 12;
    const textures = [engine.textures.ring, engine.textures.ringAlt, engine.textures.ringThick];
    for (let i = 0; i < 3; i++) {
      const scale = 1 + i * 0.05;
      engine.spawn({
        x: footX,
        y: footY,
        vx: 0, vy: 0, gravity: 0, drag: 1,
        size: 12 * scale,
        sizeEnd: 62 * scale,
        alpha: 0.95,
        alphaEnd: 0,
        rotation: 0, rotationSpeed: 0,
        ease: "outCubic", easeAlpha: "outCubic",
        maxLife: 0.37 + i * 0.02,
        texture: textures[i],
        stretchX: 2.3,
      });
    }
  },

  clinchKillThrowLand(engine, { x, y, behindDohyo }) {
    const footX = x;
    const footY = GAME_H - y - 12;

    const ringTextures = [engine.textures.ring, engine.textures.ringAlt, engine.textures.ringThick];
    for (let i = 0; i < 4; i++) {
      const scale = 1 + i * 0.08;
      engine.spawn({
        x: footX,
        y: footY,
        vx: 0, vy: 0, gravity: 0, drag: 1,
        size: 14 * scale,
        sizeEnd: 90 * scale,
        alpha: 0.95,
        alphaEnd: 0,
        rotation: 0, rotationSpeed: 0,
        ease: "outCubic", easeAlpha: "outCubic",
        maxLife: 0.45 + i * 0.03,
        texture: ringTextures[i % 3],
        stretchX: 2.5,
        delay: i * 0.015,
        behindDohyo: !!behindDohyo,
      });
    }
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
      });
    }
  },

  // ─── Hit Spark presets ──────────────────────────────────────────
  // Layered on top of existing CSS hit effects for organic texture

  hitSparkSlap(engine, { x, y, facing }) {
    const dir = facing || 1;
    const cx = x;
    const cy = GAME_H - y;
    const front = (cfg) => engine.spawn({ ...cfg, aboveFighters: true });

    // Starburst sparks — irregular star shapes radiating out
    for (let i = 0; i < 3; i++) {
      const angle = rand(-0.8, 0.8) + (dir === 1 ? Math.PI * 0.8 : Math.PI * 0.2);
      const spd = rand(120, 260);
      const size = rand(18, 30);
      front({
        x: cx + rand(-6, 6),
        y: cy + rand(-8, 8),
        vx: Math.cos(angle) * spd + dir * rand(20, 60),
        vy: Math.sin(angle) * spd,
        gravity: rand(80, 200),
        drag: 0.92,
        size,
        sizeEnd: size * rand(0.1, 0.3),
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-4, 4),
        ease: "outCubic",
        easeAlpha: "outQuad",
        maxLife: rand(0.12, 0.22),
        texture: pick([engine.textures.hitStar1, engine.textures.hitStar2, engine.textures.hitStar3]),
        blendMode: "lighter",
      });
    }

    // Slash marks — curved brushstrokes at random angles
    for (let i = 0; i < 2; i++) {
      const slashAngle = rand(0, Math.PI * 2);
      const size = rand(14, 22);
      front({
        x: cx + rand(-10, 10),
        y: cy + rand(-10, 10),
        vx: dir * rand(30, 80),
        vy: rand(-20, 20),
        gravity: 0,
        drag: 0.9,
        size,
        sizeEnd: size * 0.4,
        alpha: rand(0.8, 0.95),
        alphaEnd: 0,
        rotation: slashAngle,
        rotationSpeed: rand(-2, 2),
        ease: "outCubic",
        easeAlpha: "inQuad",
        maxLife: rand(0.1, 0.18),
        texture: pick([engine.textures.hitSlash1, engine.textures.hitSlash2, engine.textures.hitSlash3]),
        stretchX: rand(1.5, 2.5),
        blendMode: "lighter",
      });
    }

    // Smear blobs — organic paint-splatter feel
    for (let i = 0; i < 2; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(60, 140);
      const size = rand(12, 20);
      front({
        x: cx + rand(-4, 4),
        y: cy + rand(-6, 6),
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        gravity: rand(100, 250),
        drag: 0.91,
        size,
        sizeEnd: size * 0.2,
        alpha: rand(0.7, 0.9),
        alphaEnd: 0,
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-3, 3),
        ease: "outCubic",
        easeAlpha: "outQuad",
        maxLife: rand(0.14, 0.24),
        texture: pick([engine.textures.hitSmear1, engine.textures.hitSmear2, engine.textures.hitSmear3]),
        blendMode: "lighter",
      });
    }

    // Bright point sparks — tiny hot dots that scatter fast
    for (let i = 0; i < 5; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(200, 400);
      front({
        x: cx + rand(-3, 3),
        y: cy + rand(-3, 3),
        vx: Math.cos(angle) * spd + dir * rand(30, 60),
        vy: Math.sin(angle) * spd,
        gravity: rand(300, 600),
        drag: 0.93,
        size: rand(3, 6),
        sizeEnd: rand(1, 2),
        alpha: rand(0.9, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.1, 0.2),
        texture: pick([engine.textures.spark, engine.textures.sparkSmall]),
        blendMode: "lighter",
      });
    }
  },

  hitSparkCharged(engine, { x, y, facing }) {
    const dir = facing || 1;
    const cx = x;
    const cy = GAME_H - y;
    const front = (cfg) => engine.spawn({ ...cfg, aboveFighters: true });

    // Large starburst sparks
    for (let i = 0; i < 5; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(140, 320);
      const size = rand(26, 44);
      front({
        x: cx + rand(-8, 8),
        y: cy + rand(-10, 10),
        vx: Math.cos(angle) * spd + dir * rand(20, 50),
        vy: Math.sin(angle) * spd,
        gravity: rand(60, 160),
        drag: 0.93,
        size,
        sizeEnd: size * rand(0.1, 0.25),
        alpha: rand(0.9, 1.0),
        alphaEnd: 0,
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-5, 5),
        ease: "outCubic",
        easeAlpha: "outQuad",
        maxLife: rand(0.18, 0.32),
        texture: pick([engine.textures.hitStarBig1, engine.textures.hitStarBig2, engine.textures.hitStar1, engine.textures.hitStar2]),
        blendMode: "lighter",
      });
    }

    // Big slash marks
    for (let i = 0; i < 3; i++) {
      const slashAngle = rand(0, Math.PI * 2);
      const size = rand(20, 32);
      front({
        x: cx + rand(-14, 14),
        y: cy + rand(-14, 14),
        vx: dir * rand(40, 100),
        vy: rand(-30, 30),
        gravity: 0,
        drag: 0.88,
        size,
        sizeEnd: size * 0.3,
        alpha: rand(0.85, 1.0),
        alphaEnd: 0,
        rotation: slashAngle,
        rotationSpeed: rand(-2, 2),
        ease: "outCubic",
        easeAlpha: "inQuad",
        maxLife: rand(0.14, 0.26),
        texture: pick([engine.textures.hitSlash1, engine.textures.hitSlash2, engine.textures.hitSlash3]),
        stretchX: rand(2, 3.5),
        blendMode: "lighter",
      });
    }

    // Smear blobs — larger, more dramatic
    for (let i = 0; i < 4; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(80, 180);
      const size = rand(16, 28);
      front({
        x: cx + rand(-6, 6),
        y: cy + rand(-8, 8),
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        gravity: rand(80, 200),
        drag: 0.92,
        size,
        sizeEnd: size * 0.15,
        alpha: rand(0.75, 0.95),
        alphaEnd: 0,
        rotation: rand(0, Math.PI * 2),
        rotationSpeed: rand(-3, 3),
        ease: "outCubic",
        easeAlpha: "outQuad",
        maxLife: rand(0.18, 0.3),
        texture: pick([engine.textures.hitSmear1, engine.textures.hitSmear2, engine.textures.hitSmear3]),
        blendMode: "lighter",
      });
    }

    // Bright point sparks — more, faster, longer lived
    for (let i = 0; i < 8; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(250, 500);
      front({
        x: cx + rand(-4, 4),
        y: cy + rand(-4, 4),
        vx: Math.cos(angle) * spd + dir * rand(20, 50),
        vy: Math.sin(angle) * spd,
        gravity: rand(250, 550),
        drag: 0.94,
        size: rand(4, 8),
        sizeEnd: rand(1, 2),
        alpha: rand(0.9, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: 0,
        maxLife: rand(0.14, 0.28),
        texture: pick([engine.textures.spark, engine.textures.sparkSmall]),
        blendMode: "lighter",
      });
    }

    // Expanding organic ring (using cloud ring texture)
    front({
      x: cx,
      y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 8,
      sizeEnd: 50,
      alpha: 0.7,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outExpo", easeAlpha: "outCubic",
      maxLife: 0.25,
      texture: pick([engine.textures.ring, engine.textures.ringAlt]),
      stretchX: 1.2,
      blendMode: "lighter",
    });
  },

  hitSparkBurst(engine, opts) {
    PRESETS.hitSparkCharged(engine, opts);
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
      front({
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
      front({
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

  // ── GRAB ARMOR BREAK ────────────────────────────────────────────────
  // Charged attack shatters the armor — bright white-yellow break ring with
  // a burst of glass shards that arc outward and fall under gravity. Same
  // tilted-ring idiom, but bigger, brighter, and longer-lived than the absorb.
  // Sized to read at a glance even in the chaos of a charged-attack confirm.
  grabArmorBreak(engine, { x, y, facing }) {
    const dir = facing || 1;
    const cx = x;
    // Same chest-level position math as grabArmorAbsorb / hitSparkSlap.
    const cy = GAME_H - y;
    const front = (cfg) => engine.spawn({ ...cfg, aboveFighters: true });

    // Same tilted-back ring style as the absorb — keeps the break visually
    // related to the absorb (it IS the armor's last gasp). Bigger but still
    // tilted (stretchX < 1) so the ring reads as foreshortened, not as a
    // wide flat shockwave. The drama comes from the glass shards, not from
    // a giant ring.
    const TILT_X = 0.6;

    // Bright central flash — sells the "shatter" instant
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

    // Primary tilted break ring — same footprint shape as the absorb but
    // brighter, longer, and a touch larger to read as a shatter.
    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 12,
      sizeEnd: 86,
      alpha: 1.0,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic", easeAlpha: "outCubic",
      maxLife: 0.4,
      texture: engine.textures.armorBreakRing,
      stretchX: TILT_X,
    });

    // Secondary ring trailing slightly — gives the break a real "double pop"
    front({
      x: cx, y: cy,
      vx: 0, vy: 0, gravity: 0, drag: 1,
      size: 9,
      sizeEnd: 64,
      alpha: 0.75,
      alphaEnd: 0,
      rotation: 0, rotationSpeed: 0,
      ease: "outCubic", easeAlpha: "outCubic",
      maxLife: 0.34,
      texture: engine.textures.armorBreakRing,
      stretchX: TILT_X,
      delay: 0.06,
    });

    // 14 glass shards bursting outward — the real noticeability lives here.
    // Shards arc up then fall under gravity. Wide scatter sells the shatter
    // without needing a huge ring.
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
      front({
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
      front({
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
    this.aboveFighters = false;
    // Optional follow target — if set, the particle's x/y are shifted each
    // frame by the delta from this getter, so the particle stays anchored
    // to a moving target (e.g. a player sprite) while still applying its
    // own local vx/vy motion (e.g. converging toward the target).
    this.followGetter = null;
    this.lastFollowX = 0;
    this.lastFollowY = 0;
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
    if (fn) fn(this, opts);
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
  }

  _acquire() {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) return this.particles[i];
    }
    return null;
  }

  _start() {
    this._lastTime = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - this._lastTime) / 1000, 0.05);
      this._lastTime = now;
      if (!this.frozen) {
        this._update(dt);
      }
      this._render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _update(dt) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife || p.y >= p.groundY) {
        p.active = false;
        continue;
      }

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
    ctx.drawImage(p.texture, -half, -half, size, size);
    ctx.restore();
  }

  _render() {
    const { ctx, ctxBehind, ctxFront } = this;
    if (!ctx) return;

    ctx.clearRect(0, 0, GAME_W, GAME_H);
    if (ctxBehind) ctxBehind.clearRect(0, 0, GAME_W, GAME_H);
    if (ctxFront) ctxFront.clearRect(0, 0, GAME_W, GAME_H);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active || !p.texture || p.delay > 0) continue;

      if (p.behindDohyo && ctxBehind) {
        this._renderParticle(ctxBehind, p);
      } else if (p.aboveFighters && ctxFront) {
        this._renderParticle(ctxFront, p);
      } else {
        this._renderParticle(ctx, p);
      }
    }
  }

  destroy() {
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
