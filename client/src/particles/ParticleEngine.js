const MAX_PARTICLES = 500;
const GAME_W = 1280;
const GAME_H = 720;

// ─── Easing ─────────────────────────────────────────────────────────

const EASE = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t * t * t,
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
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

  // Pass 1: light gray shadow blobs offset downward for subtle depth
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2 + srand() * 0.4;
    const jitter = (srand() - 0.5) * bandWidth * 0.5;
    const bx = half + Math.cos(angle) * (ringR + jitter);
    const by = half + Math.sin(angle) * (ringR + jitter) + bandWidth * 0.3;
    const br = bandWidth * (0.6 + srand() * 0.5);
    drawBlob(bx, by, br, 210, 215, 220, 1.0);
  }

  // Pass 2: near-white body
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2 + srand() * 0.45;
    const jitter = (srand() - 0.5) * bandWidth * 0.55;
    const bx = half + Math.cos(angle) * (ringR + jitter);
    const by = half + Math.sin(angle) * (ringR + jitter);
    const br = bandWidth * (0.5 + srand() * 0.5);
    drawBlob(bx, by, br, 250, 252, 255, 1.0);
  }

  // Pass 3: pure white highlights offset upward
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2 + srand() * 0.5;
    const jitter = (srand() - 0.5) * bandWidth * 0.4;
    const bx = half + Math.cos(angle) * (ringR + jitter);
    const by = half + Math.sin(angle) * (ringR + jitter) - bandWidth * 0.2;
    const br = bandWidth * (0.3 + srand() * 0.4);
    drawBlob(bx, by, br, 255, 255, 255, 1.0);
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
    this._rafId = null;
    this._lastTime = 0;
    this.frozen = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(new Particle());
    }
  }

  init(canvas) {
    this.canvas = canvas;
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
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
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
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
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
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
