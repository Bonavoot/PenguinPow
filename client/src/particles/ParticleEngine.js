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

function generateTextures() {
  return {
    // Several anime cloud puffs with different shapes (different seeds)
    puff1: createAnimePuff(96, 1234),
    puff2: createAnimePuff(96, 5678),
    puff3: createAnimePuff(96, 9012),
    puff4: createAnimePuff(96, 3456),
    puff5: createAnimePuff(112, 7890),

    // Smaller puffs for variety
    puffSm1: createAnimePuffSmall(64, 2345),
    puffSm2: createAnimePuffSmall(64, 6789),
    puffSm3: createAnimePuffSmall(64, 1357),

    // Tiny ice chunks
    chunk: createChunk(12, 255, 255, 255, 0.85),
    chunkIce: createChunk(12, 210, 235, 255, 0.75),

    // Clean soft circles
    circle: createChunk(24, 255, 255, 255, 0.9),
    circleIce: createChunk(24, 220, 240, 255, 0.8),

    // Cloudy smoke rings (dense layered blobs along a circle)
    ring: createCloudRing(160, 14, 4321),
    ringAlt: createCloudRing(160, 14, 8765),
    ringThick: createCloudRing(160, 17, 1597),

    // Speed lines (sharp pointed dashes, not soft blobs)
    speedLine: createSpeedLine(80, 3, 255, 255, 255, 0.95),
    speedLineIce: createSpeedLine(80, 3, 220, 240, 255, 0.85),
    speedLineThin: createSpeedLine(60, 2, 255, 255, 255, 0.8),
    speedLineThick: createSpeedLine(80, 5, 255, 255, 255, 0.9),
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

const PRESETS = {

  dodgeStart(engine, { x, y, direction, facing }) {
    const dir = direction || facing || 1;
    const footX = x;
    const footY = GAME_H - y;

    // MAIN CLOUD PUFFS — evenly spaced trail behind the dodge
    const mainSlots = [8, 26, 44];
    for (let i = 0; i < 3; i++) {
      const size = rand(28, 42);
      engine.spawn({
        x: footX + -dir * (mainSlots[i] + rand(-4, 4)),
        y: footY - size / 2 + rand(-4, 4),
        vx: -dir * rand(40, 110),
        vy: rand(-18, 3),
        gravity: 15,
        drag: 0.92,
        size,
        sizeEnd: size * rand(0.4, 0.6),
        alpha: rand(0.7, 0.9),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-0.8, 0.8),
        maxLife: rand(0.35, 0.55),
        texture: pickPuff(engine.textures),
      });
    }

    // SMALLER PUFFS — interleaved between main puffs for fill
    const smallSlots = [17, 35];
    for (let i = 0; i < 2; i++) {
      const size = rand(16, 24);
      engine.spawn({
        x: footX + -dir * (smallSlots[i] + rand(-5, 5)) + rand(-6, 6),
        y: footY - size / 2 + rand(-3, 3),
        vx: -dir * rand(50, 140) + rand(-15, 15),
        vy: rand(-25, 0),
        gravity: 20,
        drag: 0.93,
        size,
        sizeEnd: size * rand(0.35, 0.55),
        alpha: rand(0.6, 0.85),
        alphaEnd: 0,
        ease: "outQuad",
        easeAlpha: "inQuad",
        rotationSpeed: rand(-1.2, 1.2),
        maxLife: rand(0.25, 0.4),
        texture: pickSmallPuff(engine.textures),
      });
    }

    // ICE CHIPS — small fast chunks scattering
    for (let i = 0; i < 6; i++) {
      const spread = rand(-0.6, 0.6);
      const speed = rand(100, 250);
      engine.spawn({
        x: footX + rand(-6, 6),
        y: footY - rand(2, 8),
        vx: -dir * Math.cos(spread) * speed + rand(-30, 30),
        vy: -Math.abs(Math.sin(spread)) * speed * 0.4 + rand(-30, 0),
        gravity: 320,
        drag: 0.97,
        size: rand(3, 7),
        sizeEnd: rand(1, 2),
        alpha: rand(0.7, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-6, 6),
        maxLife: rand(0.18, 0.33),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
      });
    }

    // CIRCLES — soft round puffs that pop out and fade
    for (let i = 0; i < 4; i++) {
      const size = rand(8, 16);
      engine.spawn({
        x: footX + -dir * rand(4, 30) + rand(-10, 10),
        y: footY - rand(4, 18),
        vx: -dir * rand(30, 100) + rand(-15, 15),
        vy: rand(-35, -8),
        gravity: 40,
        drag: 0.95,
        size,
        sizeEnd: size * rand(0.3, 0.5),
        alpha: rand(0.6, 0.9),
        alphaEnd: 0,
        ease: "outQuad",
        easeAlpha: "inQuad",
        rotationSpeed: 0,
        maxLife: rand(0.25, 0.45),
        texture: pick([engine.textures.circle, engine.textures.circleIce]),
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

  // Expanding ring for dodge landing. Biggest ring.
  dodgeLand(engine, { x, y, slideVelocity = 0 }) {
    const slideOffset = slideVelocity * 28;
    const footX = x + slideOffset;
    const footY = GAME_H - y - 12;
    const textures = [engine.textures.ring, engine.textures.ringAlt, engine.textures.ringThick];
    for (let i = 0; i < 3; i++) {
      const scale = 1 + i * 0.05;
      engine.spawn({
        x: footX,
        y: footY,
        vx: 0, vy: 0, gravity: 0, drag: 1,
        size: 14 * scale,
        sizeEnd: 58 * scale,
        alpha: 0.95,
        alphaEnd: 0,
        rotation: 0, rotationSpeed: 0,
        ease: "outCubic", easeAlpha: "outCubic",
        maxLife: 0.38 + i * 0.02,
        texture: textures[i],
        stretchX: 2.4,
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
  }
}

export class ParticleEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.textures = null;
    this._rafId = null;
    this._lastTime = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(new Particle());
    }
  }

  init(canvas) {
    this.canvas = canvas;
    canvas.width = GAME_W;
    canvas.height = GAME_H;
    this.ctx = canvas.getContext("2d");
    this.textures = generateTextures();
    this._start();
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
      this._update(dt);
      this._render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _update(dt) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
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

  _render() {
    const { ctx, canvas } = this;
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active || !p.texture) continue;

      const rawT = p.life / p.maxLife;
      const easeFnSize = EASE[p.ease] || EASE.linear;
      const easeFnAlpha = EASE[p.easeAlpha] || easeFnSize;
      const tSize = easeFnSize(rawT);
      const tAlpha = easeFnAlpha(rawT);

      const alpha = p.alpha + (p.alphaEnd - p.alpha) * tAlpha;
      const size = p.size + (p.sizeEnd - p.size) * tSize;

      if (alpha <= 0.005 || size <= 0.5) continue;

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
  }

  destroy() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.canvas = null;
    this.ctx = null;
  }
}
