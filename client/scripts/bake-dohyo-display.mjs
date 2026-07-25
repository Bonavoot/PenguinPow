/**
 * Bake a 2× supersampled flat dohyo plate for in-game use.
 *
 * Reads knobs from dohyoOverlayData.js, projects dohyo-style.webp through the
 * same CSS 3D stack into 2560×1440. Game draws dohyo-display.webp full-bleed
 * with no runtime transform. Editor keeps live CSS 3D via .dohyo-overlay--live.
 *
 * Usage: node scripts/bake-dohyo-display.mjs
 *        npm run bake:dohyo
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "../src/assets");
const SRC = path.join(ASSETS, "dohyo-style.webp");
const OUT = path.join(ASSETS, "dohyo-display.webp");

const LOGIC_W = 1280;
const LOGIC_H = 720;
const SCALE = 2;
const CW = LOGIC_W * SCALE;
const CH = LOGIC_H * SCALE;

function loadKnobs() {
  // Parse baked defaults from dohyoOverlayData.js without pulling React/localStorage.
  const text = fs.readFileSync(
    path.join(__dirname, "../src/components/dohyoOverlayData.js"),
    "utf8",
  );
  const m = text.match(/const DOHYO_OVERLAY = (\{[\s\S]*?\});/);
  if (!m) throw new Error("Could not parse DOHYO_OVERLAY from dohyoOverlayData.js");
  // JSON5-ish: keys are bare, trailing ok — eval in sandbox via Function
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${m[1]});`)();
}

function sampleBilinear(data, w, h, ch, x, y) {
  if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) {
    const ix = Math.max(0, Math.min(w - 1, Math.round(x)));
    const iy = Math.max(0, Math.min(h - 1, Math.round(y)));
    const i = (iy * w + ix) * ch;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const i00 = (y0 * w + x0) * ch;
  const i10 = (y0 * w + x1) * ch;
  const i01 = (y1 * w + x0) * ch;
  const i11 = (y1 * w + x1) * ch;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = data[i00 + c];
    const v10 = data[i10 + c];
    const v01 = data[i01 + c];
    const v11 = data[i11 + c];
    out[c] =
      v00 * (1 - fx) * (1 - fy) +
      v10 * fx * (1 - fy) +
      v01 * (1 - fx) * fy +
      v11 * fx * fy;
  }
  return out;
}

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Missing ${path.basename(SRC)} — run enhance-dohyo.mjs first`);
  }
  const knobs = loadKnobs();
  console.log("Knobs", {
    sizeW: knobs.sizeW,
    sizeH: knobs.sizeH,
    posX: knobs.posX,
    posY: knobs.posY,
    perspective: knobs.perspective,
    rotateX: knobs.rotateX,
    scaleY: knobs.scaleY,
    translateY: knobs.translateY,
  });

  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;

  // Percent knobs — perspective scales with render resolution (CSS px).
  const BG_SIZE_W = knobs.sizeW / 100;
  const BG_SIZE_H = knobs.sizeH / 100;
  const BG_POS_X = knobs.posX / 100;
  const BG_POS_Y = knobs.posY / 100;
  const ORIGIN_X = knobs.originX / 100;
  const ORIGIN_Y = knobs.originY / 100;
  const SCALE_Y = knobs.scaleY;
  const TRANSLATE_Y = knobs.translateY / 100;
  const PERSPECTIVE = knobs.perspective * SCALE;
  const ROTATE_X_DEG = knobs.rotateX;

  const bgW = BG_SIZE_W * CW;
  const bgH = BG_SIZE_H * CH;
  const offX = (CW - bgW) * BG_POS_X;
  const offY = (CH - bgH) * BG_POS_Y;
  const ox = ORIGIN_X * CW;
  const oy = ORIGIN_Y * CH;
  const tY = TRANSLATE_Y * CH;
  const cos = Math.cos((ROTATE_X_DEG * Math.PI) / 180);
  const sin = Math.sin((ROTATE_X_DEG * Math.PI) / 180);
  const P = PERSPECTIVE;

  /**
   * Inverse of CSS: perspective() rotateX() scaleY() translateY()
   * (points apply right-to-left — same as measure-ice-clip projectToActor).
   * Screen (sx,sy) → source image (ix,iy). Returns null if outside plate.
   */
  function unproject(sx, sy) {
    const lx = sx - ox;
    const ly = sy - oy;
    // ly_scaled after scaleY+translateY, before rotateX
    const denom = cos * P + ly * sin;
    if (Math.abs(denom) < 1e-6) return null;
    const lyScaled = (ly * P) / denom;
    const z2 = lyScaled * sin;
    if (P - z2 <= 1e-6) return null;
    const persp = P / (P - z2);
    const lx0 = lx / persp;
    const lyBeforeScale = lyScaled / SCALE_Y;
    const lyBefore = lyBeforeScale - tY;
    const x = lx0 + ox;
    const y = lyBefore + oy;
    const ix = ((x - offX) / bgW) * W;
    const iy = ((y - offY) / bgH) * H;
    if (ix < -1 || iy < -1 || ix > W || iy > H) return null;
    return { ix, iy };
  }

  // 2×2 subpixel AA — softens stair-steps on diagonals from the inverse
  // projection without an unsharp pass (which made cel AA look jagged).
  const SUB = 2;
  const out = Buffer.alloc(CW * CH * 4);
  let hits = 0;
  for (let sy = 0; sy < CH; sy++) {
    for (let sx = 0; sx < CW; sx++) {
      const i = (sy * CW + sx) * 4;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let n = 0;
      for (let oy = 0; oy < SUB; oy++) {
        for (let ox = 0; ox < SUB; ox++) {
          const uv = unproject(
            sx + (ox + 0.5) / SUB,
            sy + (oy + 0.5) / SUB,
          );
          if (!uv) continue;
          const [r, g, b, a] = sampleBilinear(data, W, H, ch, uv.ix, uv.iy);
          if (a < 8) continue;
          rSum += r;
          gSum += g;
          bSum += b;
          aSum += a;
          n++;
        }
      }
      if (!n) {
        out[i + 3] = 0;
        continue;
      }
      out[i] = Math.round(rSum / n);
      out[i + 1] = Math.round(gSum / n);
      out[i + 2] = Math.round(bSum / n);
      out[i + 3] = Math.round(aSum / n);
      hits++;
    }
    if (sy % 360 === 0) {
      process.stdout.write(`  bake row ${sy}/${CH}\r`);
    }
  }
  console.log(`\nOpaque-ish pixels: ${hits}`);

  // Lossless — this plate is the in-game hero layer; keep every edge.
  await sharp(out, { raw: { width: CW, height: CH, channels: 4 } })
    .webp({
      lossless: true,
      alphaQuality: 100,
      effort: 6,
    })
    .toFile(OUT);

  const st = fs.statSync(OUT);
  console.log(`Wrote ${OUT} (${CW}×${CH}, ${(st.size / 1e6).toFixed(2)} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
