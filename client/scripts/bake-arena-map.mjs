#!/usr/bin/env node
/**
 * Encode the in-match stadium for runtime.
 *
 * Master is game-map-444.png — original illustration, never edited.
 * Output is a smaller webp so the camera layer stays filter-free.
 *
 * Exposure is a linear RGB multiply (true one-stop dim). Do NOT use
 * sharp.modulate({ brightness }) — that is HSL/Lab and pumps saturation
 * on the painted seats. Upper bowl gets a small extra luma multiply so
 * the rafters recede; hue is never touched.
 *
 *   node client/scripts/bake-arena-map.mjs
 *   npm run encode:display   (also calls this)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "../src/assets");

const MAP_SRC = path.join(ASSETS, "game-map-444.png");
const MAP_OUT = path.join(ASSETS, "game-map-444.webp");
const MAP_W = 3840;
const MAP_H = 2560;
/** One stop down from the master so the ring and penguins stay the subject. */
const MAP_EXPOSURE = 0.78;
/** Extra linear dim at the top of the plate (rafters). 0 at mid-bowl. */
const MAP_TOP_EXTRA = 0.08;

const RAYS_OUT = path.join(ASSETS, "arena-god-rays.webp");
const RAYS_W = 2560;
const RAYS_H = 1440;

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

async function bakeMap() {
  if (!fs.existsSync(MAP_SRC)) {
    throw new Error(`missing map master: ${MAP_SRC}`);
  }

  const { data, info } = await sharp(MAP_SRC)
    .resize(MAP_W, MAP_H, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const denom = Math.max(1, height - 1);
  for (let y = 0; y < height; y++) {
    const ny = y / denom;
    // ny=0 is the rafters. Extra dim is gone by ~mid stands (0.42).
    const topMul = 1 - MAP_TOP_EXTRA * (1 - smoothstep(0.08, 0.42, ny));
    const mul = MAP_EXPOSURE * topMul;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      data[i] = Math.min(255, Math.round(data[i] * mul));
      data[i + 1] = Math.min(255, Math.round(data[i + 1] * mul));
      data[i + 2] = Math.min(255, Math.round(data[i + 2] * mul));
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .webp({ quality: 90, effort: 5, smartSubsample: false, alphaQuality: 90 })
    .toFile(MAP_OUT);

  const before = fs.statSync(MAP_SRC).size;
  const after = fs.statSync(MAP_OUT).size;
  console.log(
    `map: ${MAP_W}×${MAP_H} linear RGB ${MAP_EXPOSURE} + top ${MAP_TOP_EXTRA} — ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`,
  );
}

function paintGodRays() {
  const W = RAYS_W;
  const H = RAYS_H;
  const buf = Buffer.alloc(W * H * 4);

  const shafts = [
    { ox: 0.5, oy: -0.06, angle: 92, spread: 0.032, strength: 0.72, length: 0.7 },
    { ox: 0.41, oy: -0.08, angle: 83, spread: 0.024, strength: 0.48, length: 0.6 },
    { ox: 0.59, oy: -0.08, angle: 101, spread: 0.026, strength: 0.5, length: 0.62 },
    { ox: 0.33, oy: -0.1, angle: 76, spread: 0.018, strength: 0.28, length: 0.48 },
    { ox: 0.67, oy: -0.1, angle: 108, spread: 0.018, strength: 0.28, length: 0.48 },
    { ox: 0.5, oy: -0.04, angle: 90, spread: 0.055, strength: 0.22, length: 0.52 },
  ];

  const prepared = shafts.map((s) => {
    const rad = (s.angle * Math.PI) / 180;
    return {
      ...s,
      dx: Math.cos(rad),
      dy: Math.sin(rad),
      oxPx: s.ox * W,
      oyPx: s.oy * H,
      spreadPx: s.spread * W,
      lengthPx: s.length * H,
    };
  });

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (const s of prepared) {
        const vx = x - s.oxPx;
        const vy = y - s.oyPx;
        const along = vx * s.dx + vy * s.dy;
        if (along < 0 || along > s.lengthPx) continue;
        const px = x - (s.oxPx + s.dx * along);
        const py = y - (s.oyPx + s.dy * along);
        const dist = Math.hypot(px, py);
        const across = Math.exp(-((dist / s.spreadPx) ** 2));
        const fade = (1 - along / s.lengthPx) ** 1.35;
        const sideFade = 1 - smoothstep(0.72, 1.02, Math.abs(x / W - 0.5) * 2);
        acc += s.strength * across * fade * sideFade;
      }

      const nx = (x / W - 0.5) * 2;
      const ny = y / H;
      const wash =
        Math.exp(-(nx * nx) * 2.4) *
        Math.exp(-(((ny - 0.02) * 3.2) ** 2)) *
        0.18;
      acc += wash;

      const a = clamp01(acc);
      if (a <= 0.001) continue;
      const i = (y * W + x) * 4;
      buf[i] = 255;
      buf[i + 1] = 236;
      buf[i + 2] = 196;
      buf[i + 3] = Math.round(a * 255);
    }
  }

  return buf;
}

async function bakeGodRays() {
  const raw = paintGodRays();
  await sharp(raw, {
    raw: { width: RAYS_W, height: RAYS_H, channels: 4 },
  })
    .blur(11)
    .webp({ quality: 82, effort: 4, alphaQuality: 88 })
    .toFile(RAYS_OUT);

  console.log(
    `god-rays: ${RAYS_W}×${RAYS_H} preblurred webp — ${(fs.statSync(RAYS_OUT).size / 1024).toFixed(0)} KB`,
  );
}

export async function bakeArenaPresentation() {
  await bakeMap();
  await bakeGodRays();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  bakeArenaPresentation().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
