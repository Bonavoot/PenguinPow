/**
 * Bake ice-mask.webp (+ ice-rim-mask.webp) from dohyo-display.webp.
 *
 * The mask is the tawara interior (ice + original shikiri-sen). Those
 * markings stay as painted in the plate — including their crop-stroke.
 * Hard-filling them white aliased at camera zoom. Not a fitted ellipse.
 *
 * Usage: node scripts/measure-ice-clip.mjs
 *        node scripts/measure-ice-clip.mjs --write
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISPLAY = path.join(__dirname, "../src/assets/dohyo-display.webp");
const MASK_OUT = path.join(__dirname, "../src/assets/ice-mask.webp");
const RIM_OUT = path.join(__dirname, "../src/assets/ice-rim-mask.webp");
const WRITE = process.argv.includes("--write");

// Close must be ≥ half the tachiai width (~39px at 2×) so the white
// rectangles fill. No extra erode — a 6px erode was the "gap at the rope".
// 1px dilate after close covers the ice/tawara AA fringe.
const CLOSE_PX = 24;
const EDGE_DILATE_PX = 1;
const RIM_PX = 9; // thin curb lip at 2× (~4.5 game px) — not a blurry brown haze

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

// Match enhance-dohyo.mjs — strict so sky / clothing don't count as ice.
function isIcePixel(r, g, b, a) {
  if (a < 16) return false;
  const [h, s, l] = rgbToHsl(r, g, b);
  return (
    b > r + 35 &&
    b > 140 &&
    g > 120 &&
    h > 185 &&
    h < 230 &&
    s > 0.22 &&
    l > 0.32 &&
    l < 0.9
  );
}

function isRopePixel(r, g, b, a) {
  if (a < 16) return false;
  const [h, s, l] = rgbToHsl(r, g, b);
  return (
    r > 145 &&
    g > 105 &&
    b < 200 &&
    r > b + 20 &&
    g > b + 5 &&
    h > 12 &&
    h < 58 &&
    s > 0.14 &&
    l > 0.32 &&
    l < 0.92
  );
}

function isWhite(r, g, b) {
  return r > 210 && g > 210 && b > 210;
}

function dilate1(src, w, h) {
  const out = new Uint8Array(src);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) continue;
      if (x > 0) out[y * w + x - 1] = 1;
      if (x < w - 1) out[y * w + x + 1] = 1;
      if (y > 0) out[(y - 1) * w + x] = 1;
      if (y < h - 1) out[(y + 1) * w + x] = 1;
    }
  }
  return out;
}

function invert(src) {
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] ? 0 : 1;
  return out;
}

function morph(src, w, h, n, erode) {
  let m = erode ? invert(src) : src;
  for (let i = 0; i < n; i++) m = dilate1(m, w, h);
  return erode ? invert(m) : m;
}

function floodIce(ice, rope, w, h, cx, cy, rx, ry) {
  const mask = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const sx = Math.floor(cx);
  const sy = Math.floor(cy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return mask;
  if (!ice[sy * w + sx] || rope[sy * w + sx]) return mask;
  mask[sy * w + sx] = 1;
  qx[tail] = sx;
  qy[tail] = sy;
  tail++;
  const rxCap = rx * 1.08;
  const ryCap = ry * 1.08;
  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    head++;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const idx = py * w + px;
        if (mask[idx] || !ice[idx] || rope[idx]) continue;
        const enx = (px - cx) / rxCap;
        const eny = (py - cy) / ryCap;
        if (enx * enx + eny * eny > 1) continue;
        mask[idx] = 1;
        qx[tail] = px;
        qy[tail] = py;
        tail++;
      }
    }
  }
  return mask;
}

function rimAlpha(interior, w, h, maxD) {
  const alpha = new Uint8Array(w * h);
  let layer = interior;
  for (let d = 0; d < maxD; d++) {
    const next = morph(layer, w, h, 1, true);
    const t = 1 - d / maxD;
    const a = Math.round(255 * Math.pow(t, 2.35));
    for (let i = 0; i < layer.length; i++) {
      if (layer[i] && !next[i]) alpha[i] = a;
    }
    layer = next;
  }
  return alpha;
}

function count(mask) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  return n;
}

function aabb(mask, w, h) {
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY };
}

if (!fs.existsSync(DISPLAY)) {
  console.error("Missing dohyo-display.webp — run bake-dohyo-display.mjs first");
  process.exit(1);
}

const { data, info } = await sharp(DISPLAY)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: c } = info;

const ice = new Uint8Array(W * H);
const rope = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * c;
    const idx = y * W + x;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (isRopePixel(r, g, b, a)) rope[idx] = 1;
    else if (isIcePixel(r, g, b, a)) ice[idx] = 1;
  }
}

// Display plate: ice disc sits around 50% / 60%. Cap is a leak guard only;
// the flood still requires ice pixels, so it cannot paint tawara / dirt.
const seedX = W * 0.5;
const seedY = H * 0.603;
const capRx = W * 0.28;
const capRy = H * 0.16;

let mask = floodIce(ice, rope, W, H, seedX, seedY, capRx, capRy);
const flooded = count(mask);
if (flooded < 50_000) {
  console.error(`Ice flood too small (${flooded} px) — check seed / classifier`);
  process.exit(1);
}

mask = morph(mask, W, H, CLOSE_PX, false);
mask = morph(mask, W, H, CLOSE_PX, true);
if (EDGE_DILATE_PX > 0) mask = morph(mask, W, H, EDGE_DILATE_PX, false);

const kept = count(mask);
const box = aabb(mask, W, H);
const rim = rimAlpha(mask, W, H, RIM_PX);

let whiteInMask = 0;
let whiteInIceBox = 0;
for (let y = box.minY; y <= box.maxY; y++) {
  for (let x = box.minX; x <= box.maxX; x++) {
    const i = (y * W + x) * c;
    if (!isWhite(data[i], data[i + 1], data[i + 2])) continue;
    whiteInIceBox++;
    if (mask[y * W + x]) whiteInMask++;
  }
}

console.log(`Source: ${path.basename(DISPLAY)} (${W}×${H})`);
console.log(
  `Ice flood: ${flooded} px; after close ${CLOSE_PX} + edge dilate ${EDGE_DILATE_PX}: ${kept} px`
);
console.log(
  `Interior AABB: ${((box.minX / W) * 100).toFixed(2)}%–${((box.maxX / W) * 100).toFixed(2)}% x, ` +
    `${((box.minY / H) * 100).toFixed(2)}%–${((box.maxY / H) * 100).toFixed(2)}% y`
);
console.log(`Tachiai white in AABB: ${whiteInMask}/${whiteInIceBox} covered by mask`);

if (WRITE) {
  const maskBuf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    maskBuf[o] = 255;
    maskBuf[o + 1] = 255;
    maskBuf[o + 2] = 255;
    maskBuf[o + 3] = mask[i] ? 255 : 0;
  }
  await sharp(maskBuf, { raw: { width: W, height: H, channels: 4 } })
    .webp({ lossless: true, alphaQuality: 100, effort: 4 })
    .toFile(MASK_OUT);

  const rimBuf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    rimBuf[o] = 255;
    rimBuf[o + 1] = 255;
    rimBuf[o + 2] = 255;
    rimBuf[o + 3] = rim[i];
  }
  await sharp(rimBuf, { raw: { width: W, height: H, channels: 4 } })
    .webp({ lossless: true, alphaQuality: 100, effort: 4 })
    .toFile(RIM_OUT);

  const stM = fs.statSync(MASK_OUT);
  const stR = fs.statSync(RIM_OUT);
  console.log(`Wrote ${path.basename(MASK_OUT)} (${(stM.size / 1024).toFixed(1)} KB)`);
  console.log(`Wrote ${path.basename(RIM_OUT)} (${(stR.size / 1024).toFixed(1)} KB)`);
} else {
  console.log("Dry run — pass --write to emit ice-mask.webp and ice-rim-mask.webp");
}
