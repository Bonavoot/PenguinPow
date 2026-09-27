/**
 * Belt-colored ice scars.
 *
 * Stamped at the painted soles (spriteFeet), drawn in 1280×720 space on
 * one canvas that lives inside the ice mask, so a scar cannot paint the
 * snow, the mountains, or the crowd. Ribbons are stored and redrawn;
 * nothing is left on the bitmap between frames, and nothing uses a CSS
 * filter.
 *
 * The belt is mixed toward the ice so a scarlet mawashi stays scarlet
 * but sits in the rink instead of reading as a UI sticker.
 */

import {
  soleLiftForPose,
  worldFootXs,
} from "./spriteFeet.js";

const GAME_W = 1280;
const GAME_H = 720;
const MAX_FULL = 28;
const MAX_LOW = 12;
const LIFE_TRAIL_MS = 420;
const LIFE_TRAIL_LOW_MS = 220;
const LIFE_BURST_MS = 280;
/**
 * Screen-up nudge for the new scar only (canvas px, top-down).
 * The belt mist in ParticleEngine stays at SLIDE_FOOT_Y_LIFT (6).
 * This scar started ~3px above the box bottom, in front of the toes.
 * 6px brings it up onto the pads without floating it at the knees.
 */
const SKID_RAISE_PX = 6;

/** @type {HTMLCanvasElement|null} */
let canvas = null;
/** @type {CanvasRenderingContext2D|null} */
let ctx = null;
let ribbons = [];
let lastTick = -1;
let sizedW = 0;
let sizedH = 0;
const lastStampAt = new Map();

export function bindIceSkidCanvas(node) {
  canvas = node || null;
  ctx = canvas ? canvas.getContext("2d", { alpha: true }) : null;
  sizedW = 0;
  sizedH = 0;
}

export function clearIceSkids() {
  ribbons = [];
  lastStampAt.clear();
  if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function parseBeltHex(hex) {
  if (typeof hex !== "string") return [47, 111, 224];
  const h = hex.trim().replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length !== 6 || Number.isNaN(parseInt(h, 16))) return [47, 111, 224];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** 0.62 belt, 0.38 ice. Colorful, not neon. */
export function beltIceRgb(hex) {
  const [r, g, b] = parseBeltHex(hex);
  const ice = [236, 246, 252];
  const m = 0.62;
  return [
    Math.round(ice[0] * (1 - m) + r * m),
    Math.round(ice[1] * (1 - m) + g * m),
    Math.round(ice[2] * (1 - m) + b * m),
  ];
}

function pushRibbon(ribbon, lowSpec) {
  ribbons.push(ribbon);
  const cap = lowSpec ? MAX_LOW : MAX_FULL;
  if (ribbons.length > cap) ribbons.splice(0, ribbons.length - cap);
}

/**
 * Continuous scar while sliding or being sent.
 * `x` / `y` are the fighter root in bottom-up game space (y = ground).
 * `dir` is travel (+1 right), not facing.
 */
export function stampIceSkid({
  id = "skid",
  x,
  y,
  facing = -1,
  dir = 1,
  color,
  speed = 1,
  pose = "standing",
  lowSpec = false,
  now = 0,
}) {
  if (typeof x !== "number" || typeof y !== "number") return 0;
  const prev = lastStampAt.get(id) || 0;
  if (now - prev < 32) return 0;
  lastStampAt.set(id, now);
  const travel = dir >= 0 ? 1 : -1;
  const feet = worldFootXs(x, facing, pose);
  const lift = soleLiftForPose(pose);
  const soleY = y + lift - 1;
  const rgb = beltIceRgb(color);
  const s = Math.max(0.25, Math.min(1.5, speed || 0.5));
  const life = lowSpec ? LIFE_TRAIL_LOW_MS : LIFE_TRAIL_MS;
  for (const footX of feet) {
    pushRibbon(
      {
        x: footX - travel * (8 + s * 6),
          y: GAME_H - soleY - SKID_RAISE_PX,
        len: 18 + s * 14,
        rgb,
        born: now,
        life,
        alpha: 0.55,
      },
      lowSpec
    );
  }
  return feet.length;
}

/**
 * One-shot fan at the soles on a heavy hit. Short, so it reads as the
 * ice giving under the feet and not as a second slide trail.
 */
export function burstIceSkid({
  x,
  y,
  facing = -1,
  dir = 1,
  color,
  pose = "standing",
  lowSpec = false,
  now = 0,
}) {
  if (typeof x !== "number" || typeof y !== "number") return 0;
  const travel = dir >= 0 ? 1 : -1;
  const feet = worldFootXs(x, facing, pose);
  const lift = soleLiftForPose(pose);
  const soleY = y + lift - 1;
  const rgb = beltIceRgb(color);
  const count = lowSpec ? 3 : 6;
  for (const footX of feet) {
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 7;
      pushRibbon(
        {
          x: footX - travel * (4 + i * 3) + spread * 0.15,
          y: GAME_H - soleY - SKID_RAISE_PX - Math.abs(spread) * 0.04,
          len: 10 + i * 2,
          rgb,
          born: now,
          life: LIFE_BURST_MS,
          alpha: 0.72,
        },
        lowSpec
      );
    }
  }
  return feet.length * count;
}

function ensureSize() {
  if (!canvas || !ctx) return false;
  const w = canvas.clientWidth | 0;
  const h = canvas.clientHeight | 0;
  if (w < 2 || h < 2) return false;
  const dpr = Math.min(
    Math.max((typeof window !== "undefined" && window.devicePixelRatio) || 1, 1),
    1.25
  );
  const physW = Math.round(w * dpr);
  const physH = Math.round(h * dpr);
  if (physW !== sizedW || physH !== sizedH) {
    canvas.width = physW;
    canvas.height = physH;
    sizedW = physW;
    sizedH = physH;
  }
  ctx.setTransform(physW / GAME_W, 0, 0, physH / GAME_H, 0, 0);
  return true;
}

/** Draw once per frame even if both fighters call it. */
export function tickIceSkids(now) {
  // Both fighters call this from their own rAF. One draw per frame.
  if (now - lastTick < 4) return;
  lastTick = now;
  if (!ribbons.length) {
    if (ctx && canvas && sizedW) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }
  ribbons = ribbons.filter((r) => now - r.born < r.life);
  if (!ensureSize()) return;
  ctx.clearRect(0, 0, GAME_W, GAME_H);
  for (const r of ribbons) {
    const t = (now - r.born) / r.life;
    const a = r.alpha * (1 - t) * (1 - t);
    if (a < 0.02) continue;
    const [cr, cg, cb] = r.rgb;
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    ctx.globalAlpha = a * 0.4;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.len * 0.55, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.len * 0.4, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function iceSkidCount() {
  return ribbons.length;
}
