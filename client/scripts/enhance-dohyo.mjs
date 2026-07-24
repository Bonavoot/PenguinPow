/**
 * Enhance dohyo-style.webp — ICE ONLY (lighter blue).
 *
 * Restores dirt / snow / rope / sides from dohyo-style-pre-enhance.webp.
 * Lightens the ice disc toward a brighter cool blue while preserving the
 * source's existing streaks, rim, and value detail (no new gloss/grain).
 *
 * Usage: node scripts/enhance-dohyo.mjs
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "../src/assets");
const SRC = path.join(ASSETS, "dohyo-style.webp");
const BACKUP = path.join(ASSETS, "dohyo-style-pre-enhance.webp");
const OUT = path.join(ASSETS, "dohyo-style.webp");

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const mix = (a, b, t) => a + (b - a) * t;

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

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0,
    gp = 0,
    bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [
    clamp(Math.round((rp + m) * 255)),
    clamp(Math.round((gp + m) * 255)),
    clamp(Math.round((bp + m) * 255)),
  ];
}

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

/** Flood-fill ice from center; rope + geometric cap keep fill inside the disc. */
function buildIceMask(data, w, h, c, cx, cy, rx, ry) {
  const ice = new Uint8Array(w * h);
  const rope = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (isRopePixel(r, g, b, a)) rope[y * w + x] = 1;
      else if (isIcePixel(r, g, b, a)) ice[y * w + x] = 1;
    }
  }

  const mask = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const sx = Math.floor(cx);
  const sy = Math.floor(cy);
  if (ice[sy * w + sx] && !rope[sy * w + sx]) {
    mask[sy * w + sx] = 1;
    qx[tail] = sx;
    qy[tail] = sy;
    tail++;
  }
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
        const enx = (px - cx) / (rx * 1.12);
        const eny = (py - cy) / (ry * 1.02);
        if (enx * enx + eny * eny > 0.96) continue;
        mask[idx] = 1;
        qx[tail] = px;
        qy[tail] = py;
        tail++;
      }
    }
  }
  return mask;
}

async function main() {
  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(SRC, BACKUP);
    console.log("Backed up current asset →", path.basename(BACKUP));
  }

  // Always start from pre-enhance so dirt/snow are the originals.
  const { data, info } = await sharp(BACKUP)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  console.log(`Processing ${w}×${h} — ice lighten only, dirt/snow restored`);

  const cx = w * 0.5;
  const cy = h * 0.44;
  const rx = w * 0.28;
  const ry = h * 0.28;
  const iceMask = buildIceMask(data, w, h, c, cx, cy, rx, ry);

  const out = Buffer.from(data);
  let iceCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c;
      const a = data[i + 3];
      if (a < 16) continue;
      if (!iceMask[y * w + x]) continue;

      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      if (!isIcePixel(r0, g0, b0, a)) continue;

      iceCount++;
      const [hh, ss, ll] = rgbToHsl(r0, g0, b0);

      // Lighter cool blue — lift value, ease sat a touch so it stays soft
      // sky-ice rather than chalk. Hue stays in the source family.
      // Relative L lift preserves streaks / rim / painted detail.
      const targetH = mix(hh, 202, 0.35);
      const targetS = mix(ss, Math.min(ss, 0.58), 0.35);
      const targetL = clamp(ll * 1.12 + 0.04);

      let [nr, ng, nb] = hslToRgb(targetH, targetS, targetL);

      // Keep near-white paint (shikirisen bleed / existing highlights).
      if (r0 > 220 && g0 > 230 && b0 > 235) {
        nr = mix(nr, r0, 0.9);
        ng = mix(ng, g0, 0.9);
        nb = mix(nb, b0, 0.9);
      }

      out[i] = clamp(Math.round(nr));
      out[i + 1] = clamp(Math.round(ng));
      out[i + 2] = clamp(Math.round(nb));
    }
  }

  console.log({ iceCount });

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 95, alphaQuality: 100, effort: 6 })
    .toFile(OUT);

  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    return [out[i], out[i + 1], out[i + 2]];
  };
  console.log("samples", {
    iceCenter: sample(Math.floor(w * 0.5), Math.floor(h * 0.44)),
    dirt: sample(Math.floor(w * 0.12), Math.floor(h * 0.55)),
    snow: sample(Math.floor(w * 0.22), Math.floor(h * 0.35)),
  });
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
