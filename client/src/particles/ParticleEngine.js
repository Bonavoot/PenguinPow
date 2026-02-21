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
  },

  dodgeLand(engine, { x, y }) {
    const footX = x;
    const footY = GAME_H - y;

    // IMPACT PUFFS — forced spread: 2 left, 2 right, 1 center
    // Each side gets a near and far slot so they never stack
    const landSlots = [
      { side: -1, dist: rand(6, 14) },
      { side: -1, dist: rand(22, 32) },
      { side:  1, dist: rand(6, 14) },
      { side:  1, dist: rand(22, 32) },
      { side: (Math.random() > 0.5 ? 1 : -1), dist: rand(35, 48) },
    ];
    for (let i = 0; i < 5; i++) {
      const { side, dist } = landSlots[i];
      const size = rand(26, 40);
      engine.spawn({
        x: footX + side * dist,
        y: footY - size / 2 + rand(-3, 3),
        vx: side * rand(50, 140),
        vy: rand(-20, 3),
        gravity: 20,
        drag: 0.92,
        size,
        sizeEnd: size * rand(0.4, 0.55),
        alpha: rand(0.7, 0.9),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-1, 1),
        maxLife: rand(0.3, 0.5),
        texture: pickPuff(engine.textures),
      });
    }

    // SMALL RISING PUFFS — a couple drifting up from the impact
    for (let i = 0; i < 2; i++) {
      const size = rand(14, 22);
      const side = i === 0 ? -1 : 1;
      engine.spawn({
        x: footX + side * rand(4, 12),
        y: footY - size / 2 - rand(4, 10),
        vx: side * rand(10, 30),
        vy: rand(-45, -15),
        gravity: 10,
        drag: 0.93,
        size,
        sizeEnd: size * rand(0.4, 0.6),
        alpha: rand(0.5, 0.75),
        alphaEnd: 0,
        ease: "outCubic",
        easeAlpha: "inCubic",
        rotationSpeed: rand(-0.8, 0.8),
        maxLife: rand(0.3, 0.45),
        texture: pickSmallPuff(engine.textures),
      });
    }

    // ICE DEBRIS — scattering chunks
    for (let i = 0; i < 7; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(80, 210);
      engine.spawn({
        x: footX + rand(-6, 6),
        y: footY - rand(2, 8),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 - rand(25, 60),
        gravity: 380,
        drag: 0.97,
        size: rand(2, 6),
        sizeEnd: rand(1, 2),
        alpha: rand(0.7, 1.0),
        alphaEnd: 0,
        ease: "linear",
        easeAlpha: "outQuad",
        rotationSpeed: rand(-8, 8),
        maxLife: rand(0.15, 0.3),
        texture: pick([engine.textures.chunk, engine.textures.chunkIce]),
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
