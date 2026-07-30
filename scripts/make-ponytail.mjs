/**
 * Import hand-drawn client/src/assets/pony-tail.png into cosmetics/ponytail.png.
 *
 * - Preserves black outlines (keeps black only near hair/tie fill)
 * - Does NOT recolor the hair tie
 * - Does NOT modify hat-tweaks.json (positions / widthPct stay yours)
 *
 * Usage: node scripts/make-ponytail.mjs
 * Then:  node scripts/bake-hat-overlays.mjs ponytail
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "client/src/assets/pony-tail.png");
const OUT_DIR = path.join(ROOT, "client/src/assets/cosmetics");

if (!fs.existsSync(SRC)) {
  console.error("Missing", SRC);
  process.exit(1);
}

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const N = W * H;

function isNearBlack(r, g, b, a) {
  return a >= 16 && r < 40 && g < 40 && b < 40;
}
function isFillColor(r, g, b, a) {
  return a >= 40 && !(r < 40 && g < 40 && b < 40);
}
function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const fill = new Uint8Array(N);
for (let p = 0; p < N; p++) {
  const i = p * 4;
  if (isFillColor(data[i], data[i + 1], data[i + 2], data[i + 3])) fill[p] = 1;
}

const keep = new Uint8Array(N);
keep.set(fill);
const RADIUS = 8;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!fill[y * W + x]) continue;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        if (dx * dx + dy * dy > RADIUS * RADIUS) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        const i = np * 4;
        if (isNearBlack(data[i], data[i + 1], data[i + 2], data[i + 3])) {
          keep[np] = 1;
        }
      }
    }
  }
}

const out = Buffer.alloc(W * H * 4);
let minX = W;
let minY = H;
let maxX = 0;
let maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    const i = p * 4;
    if (!keep[p]) {
      out[i + 3] = 0;
      continue;
    }
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    let a = data[i + 3];
    if (isNearBlack(r, g, b, a)) {
      r = 0;
      g = 0;
      b = 0;
      a = 255;
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = a < 16 ? 255 : a;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
}

// Drop soft muddy fringe that reads as white halo after composite.
for (let y = Math.max(1, minY); y <= Math.min(H - 2, maxY); y++) {
  for (let x = Math.max(1, minX); x <= Math.min(W - 2, maxX); x++) {
    const i = (y * W + x) * 4;
    const a = out[i + 3];
    if (a === 0) continue;
    let nearT = false;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (out[((y + dy) * W + (x + dx)) * 4 + 3] < 20) {
        nearT = true;
        break;
      }
    }
    if (!nearT) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    if (a < 180 && sat < 0.35) {
      out[i + 3] = 0;
      continue;
    }
    if (luma(r, g, b) < 45 && sat < 0.35) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
    }
  }
}

minX = W;
minY = H;
maxX = 0;
maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (out[(y * W + x) * 4 + 3] < 16) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
}

function isBlue(r, g, b, a) {
  return a >= 128 && b > 140 && g > 100 && r < 120 && b > r + 40;
}
let sx = 0;
let sy = 0;
let n = 0;
for (let y = minY; y <= maxY; y++) {
  for (let x = minX; x <= maxX; x++) {
    const i = (y * W + x) * 4;
    if (isBlue(out[i], out[i + 1], out[i + 2], out[i + 3])) {
      sx += x;
      sy += y;
      n++;
    }
  }
}
if (!n) {
  console.error("No blue hair-tie found");
  process.exit(1);
}

const pad = 12;
const cropL = Math.max(0, minX - pad);
const cropT = Math.max(0, minY - pad);
const cropW = Math.min(W - 1, maxX + pad) - cropL + 1;
const cropH = Math.min(H - 1, maxY + pad) - cropT + 1;
const tmpFull = path.join(OUT_DIR, ".pony-tmp.png");
await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .png()
  .toFile(tmpFull);

const outPng = path.join(OUT_DIR, "ponytail.png");
await sharp(tmpFull)
  .extract({ left: cropL, top: cropT, width: cropW, height: cropH })
  .png()
  .toFile(outPng);
fs.unlinkSync(tmpFull);

const meta = await sharp(outPng).metadata();
const localPivotX = sx / n - cropL;
const localPivotY = sy / n - cropT;
fs.writeFileSync(
  path.join(OUT_DIR, "ponytail.json"),
  JSON.stringify(
    {
      file: "ponytail.png",
      width: meta.width,
      height: meta.height,
      pivot: { x: +localPivotX.toFixed(1), y: +localPivotY.toFixed(1) },
    },
    null,
    2,
  ) + "\n",
);
await sharp(outPng).png().toFile(path.join(OUT_DIR, "ponytail-icon.png"));

console.log("Imported", SRC, "→", outPng);
console.log("pivot", {
  x: +localPivotX.toFixed(1),
  y: +localPivotY.toFixed(1),
});
console.log("NOTE: hat-tweaks.json was NOT modified. Rebake overlays next:");
console.log("  node scripts/bake-hat-overlays.mjs ponytail");
console.log(
  "WARNING: if pivot changed, you may need to re-tune attach points in HatTuner.",
);
