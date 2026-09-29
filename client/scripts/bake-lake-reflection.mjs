/**
 * Bake the Antarctica mountain reflection.
 *
 * The lake is a short band, so a 1:1 mirror only caught the foothills.
 * This lays the whole skyline into that band — peaks directly under the
 * peaks — then breaks it the way calm water does: a long swell, a little
 * horizontal shear that grows toward the near ice, and a faint aurora
 * in the gaps. Facets stay sharp. The painted iceberg reflections live
 * in the floor art and are not touched.
 *
 * Usage: node scripts/bake-lake-reflection.mjs
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "../src/assets");
const SRC = path.join(ASSETS, "game-map-antarctica2-floor.png");
const SKY = path.join(ASSETS, "map-antarctica-sky.webp");
const OUT = path.join(ASSETS, "map-antarctica-lake.webp");

// Image fractions. Must match .antarctica-water (top 60.2%, height 12.8%).
const STRIP_TOP = 0.602;
const STRIP_H = 0.128;
const SHORE = 0.6058;
const ICE = 0.726;
const PEAK = 0.2912;
// Full skyline is in frame by this fraction of the water's depth.
const REACH = 0.92;
const WOBBLE = 30;
const SHEAR = 22;
const BLUR = 1.6;
const SKY_MIX = 0.3;
const STRENGTH = 0.94;

const floor = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const FW = floor.info.width;
const FH = floor.info.height;
const FC = floor.info.channels;
const F = floor.data;

const skyImg = await sharp(SKY)
  .resize(FW, Math.round((1024 * FW) / 1536), { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const SW = skyImg.info.width;
const SH = skyImg.info.height;
const S = skyImg.data;
const SC = skyImg.info.channels;

const outH = Math.round(STRIP_H * FH);
const outW = FW;

function hash(ix, iy) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function sampleFloor(x, y) {
  const x0 = clamp(Math.floor(x), 0, FW - 1);
  const y0 = clamp(Math.floor(y), 0, FH - 1);
  const x1 = clamp(x0 + 1, 0, FW - 1);
  const y1 = clamp(y0 + 1, 0, FH - 1);
  const fx = clamp(x - Math.floor(x), 0, 1);
  const fy = clamp(y - Math.floor(y), 0, 1);
  const prem = (px, py) => {
    const i = (py * FW + px) * FC;
    const a = F[i + 3] / 255;
    return [F[i] * a, F[i + 1] * a, F[i + 2] * a, a];
  };
  const s00 = prem(x0, y0);
  const s10 = prem(x1, y0);
  const s01 = prem(x0, y1);
  const s11 = prem(x1, y1);
  const out = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const l = s00[k] + (s10[k] - s00[k]) * fx;
    const m = s01[k] + (s11[k] - s01[k]) * fx;
    out[k] = l + (m - l) * fy;
  }
  if (out[3] < 0.004) return [0, 0, 0, 0];
  return [out[0] / out[3], out[1] / out[3], out[2] / out[3], out[3] * 255];
}

function sampleSky(u, v) {
  const x = clamp(u, 0, 1) * (SW - 1);
  const y = clamp(v, 0, 1) * (SH - 1);
  const x0 = clamp(Math.floor(x), 0, SW - 1);
  const y0 = clamp(Math.floor(y), 0, SH - 1);
  const x1 = clamp(x0 + 1, 0, SW - 1);
  const y1 = clamp(y0 + 1, 0, SH - 1);
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const i00 = (y0 * SW + x0) * SC;
  const i10 = (y0 * SW + x1) * SC;
  const i01 = (y1 * SW + x0) * SC;
  const i11 = (y1 * SW + x1) * SC;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const a = S[i00 + k] + (S[i10 + k] - S[i00 + k]) * fx;
    const b = S[i01 + k] + (S[i11 + k] - S[i01 + k]) * fx;
    out[k] = a + (b - a) * fy;
  }
  return out;
}

function gradeMtn(r, g, b, t) {
  let R = r * 0.86 + 4;
  let G = g * 0.9 + 2;
  let B = b * 0.94 + 2;
  const melt = smoothstep(0.78, 1, t);
  R = R * (1 - melt * 0.4) + 48 * melt * 0.4;
  G = G * (1 - melt * 0.4) + 140 * melt * 0.4;
  B = B * (1 - melt * 0.4) + 196 * melt * 0.4;
  return [R, G, B];
}

function gradeSky(r, g, b) {
  const mix = 0.28;
  return [
    r * (1 - mix) + 40 * mix,
    g * (1 - mix) + 110 * mix,
    b * (1 - mix) + 160 * mix,
  ];
}

const sharpBuf = Buffer.alloc(outW * outH * 4);
for (let y = 0; y < outH; y++) {
  const fv = STRIP_TOP + ((y + 0.5) / outH) * STRIP_H;
  const t = (fv - SHORE) / (ICE - SHORE);
  for (let x = 0; x < outW; x++) {
    const o = (y * outW + x) * 4;
    if (t < 0) continue;
    const tc = clamp(t, 0, 1.15);
    const swell = noise(x * 0.0031, 1.7) - 0.5;
    const rip = noise(x * 0.011 + 4.2, tc * 1.6) - 0.5;
    const ampY = 2.5 + tc * tc * WOBBLE;
    const dy = swell * ampY + rip * ampY * 0.45;
    const band = noise(2.2, tc * 7.5) - 0.5;
    const ampX = tc * tc * SHEAR;
    const dx = band * ampX + rip * ampX * 0.28;
    const srcFrac = SHORE - (tc / REACH) * (SHORE - PEAK);
    const sy = srcFrac * (FH - 1) + dy;
    const sx = x + dx;
    const span = 2.8;
    const taps = [
      sampleFloor(sx, sy - span * 0.5),
      sampleFloor(sx, sy),
      sampleFloor(sx, sy + span * 0.5),
    ];
    let pr = 0;
    let pg = 0;
    let pb = 0;
    let pa = 0;
    for (const p of taps) {
      const a = p[3] / 255;
      pr += p[0] * a;
      pg += p[1] * a;
      pb += p[2] * a;
      pa += a;
    }
    pa /= 3;
    const rec = pa < 0.004 ? [0, 0, 0, 0] : [pr / 3 / pa, pg / 3 / pa, pb / 3 / pa, pa * 255];
    const cover = clamp(rec[3] / 255, 0, 1);
    const mtn = gradeMtn(rec[0], rec[1], rec[2], tc);
    let col = mtn;
    let alphaBase = cover;
    if (cover < 0.98) {
      const above = (PEAK - srcFrac) / 0.22;
      const skyV = clamp(0.34 - above * 0.16 - tc * 0.04, 0.08, 0.48);
      const sk = sampleSky(clamp(sx / (FW - 1), 0, 1), skyV);
      const skyCol = gradeSky(sk[0], sk[1], sk[2]);
      col = [
        skyCol[0] * (1 - cover) + mtn[0] * cover,
        skyCol[1] * (1 - cover) + mtn[1] * cover,
        skyCol[2] * (1 - cover) + mtn[2] * cover,
      ];
      alphaBase = cover + (1 - cover) * SKY_MIX;
    }
    const patch = smoothstep(0.62, 0.9, noise(x * 0.0034 + 2.0, tc * 0.8));
    const spec = patch * 0.07 * (0.4 + tc * 0.45);
    col[0] = clamp(col[0] + (248 - col[0]) * spec, 0, 255);
    col[1] = clamp(col[1] + (252 - col[1]) * spec, 0, 255);
    col[2] = clamp(col[2] + (255 - col[2]) * spec, 0, 255);
    const vis = 1 - smoothstep(0.86, 1.04, tc);
    const alpha = alphaBase * (STRENGTH * vis + 0.08 * (1 - vis));
    sharpBuf[o] = Math.round(col[0]);
    sharpBuf[o + 1] = Math.round(col[1]);
    sharpBuf[o + 2] = Math.round(col[2]);
    sharpBuf[o + 3] = Math.round(clamp(alpha * 255, 0, 255));
  }
}

const out = Buffer.alloc(outW * outH * 4);
for (let y = 0; y < outH; y++) {
  const fv = STRIP_TOP + ((y + 0.5) / outH) * STRIP_H;
  const t = clamp((fv - SHORE) / (ICE - SHORE), 0, 1);
  const rad = t < 0.45 ? t * 0.4 : 0.18 + ((t - 0.45) / 0.55) ** 2 * BLUR;
  if (rad < 0.6) {
    sharpBuf.copy(out, y * outW * 4, y * outW * 4, (y + 1) * outW * 4);
    continue;
  }
  const r = Math.ceil(rad * 2);
  const w = new Float32Array(r * 2 + 1);
  let ws = 0;
  for (let k = -r; k <= r; k++) {
    const g = Math.exp(-(k * k) / (2 * rad * rad));
    w[k + r] = g;
    ws += g;
  }
  for (let x = 0; x < outW; x++) {
    let R = 0;
    let G = 0;
    let B = 0;
    let A = 0;
    for (let k = -r; k <= r; k++) {
      const xx = clamp(x + k, 0, outW - 1);
      const i = (y * outW + xx) * 4;
      const wk = w[k + r];
      R += sharpBuf[i] * wk;
      G += sharpBuf[i + 1] * wk;
      B += sharpBuf[i + 2] * wk;
      A += sharpBuf[i + 3] * wk;
    }
    const o = (y * outW + x) * 4;
    out[o] = Math.round(R / ws);
    out[o + 1] = Math.round(G / ws);
    out[o + 2] = Math.round(B / ws);
    out[o + 3] = Math.round(A / ws);
  }
}

await sharp(out, { raw: { width: outW, height: outH, channels: 4 } })
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile(OUT);

console.log(`wrote ${OUT} ${outW}x${outH}`);
