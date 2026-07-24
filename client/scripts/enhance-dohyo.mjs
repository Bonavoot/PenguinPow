/**
 * Enhance dohyo-style.webp — ICE ONLY.
 *
 * Does NOT touch snow, dirt, sides, or shikirisen. Prior snow erode/fill
 * passes destroyed the cel-shaded deck; this rebake restores those from
 * the pre-enhance backup and only regrades the ice disc + light rope frost.
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
const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

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
    b > r + 40 &&
    b > 155 &&
    g > 130 &&
    h > 185 &&
    h < 225 &&
    s > 0.28 &&
    l > 0.35 &&
    l < 0.88
  );
}

function isRopePixel(r, g, b, a) {
  if (a < 16) return false;
  const [h, s, l] = rgbToHsl(r, g, b);
  return (
    r > 150 &&
    g > 110 &&
    b < 190 &&
    r > b + 25 &&
    g > b + 10 &&
    h > 15 &&
    h < 55 &&
    s > 0.18 &&
    l > 0.35 &&
    l < 0.9
  );
}

async function main() {
  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(SRC, BACKUP);
    console.log("Backed up current asset →", path.basename(BACKUP));
  }

  const inputPath = BACKUP;
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  console.log(`Processing ${w}×${h} from ${path.basename(inputPath)} (ice-only)`);

  const cx = w * 0.5;
  const cy = h * 0.44;
  const rx = w * 0.28;
  const ry = h * 0.28;

  const out = Buffer.from(data);
  let iceCount = 0;
  let ropeCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c;
      const a = data[i + 3];
      if (a < 16) continue;

      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];

      const nx = (x - cx) / (rx * 1.15);
      const ny = (y - cy) / (ry * 1.05);
      const discR2 = nx * nx + ny * ny;
      const insideDisc = discR2 < 1.05;
      const ed = Math.sqrt(discR2);

      if (insideDisc && isIcePixel(r0, g0, b0, a)) {
        iceCount++;
        const [hh, ss, ll] = rgbToHsl(r0, g0, b0);
        const targetH = mix(198, 206, smoothstep(0.2, 0.95, ed));
        const targetS = mix(0.28, 0.38, smoothstep(0.0, 0.85, ed));
        const edgeDark = mix(1.0, 0.9, smoothstep(0.55, 1.05, ed));
        const centerLift = mix(1.05, 1.0, smoothstep(0.0, 0.4, ed));
        const targetL = ll * 0.98 * edgeDark * centerLift;

        let [nr, ng, nb] = hslToRgb(
          mix(hh, targetH, 0.8),
          mix(ss, targetS, 0.72),
          clamp(targetL * 255) / 255
        );

        const streak =
          Math.exp(-Math.pow((nx * 0.9 + ny * 0.5 + 0.12) * 2.6, 2)) *
          Math.exp(-Math.pow(ed * 0.95, 2)) *
          0.3;
        const pool =
          Math.exp(
            -Math.pow((nx + 0.06) * 1.9, 2) - Math.pow((ny + 0.22) * 2.2, 2)
          ) * 0.16;
        const gloss = streak + pool;

        nr = mix(nr, 242, gloss);
        ng = mix(ng, 248, gloss);
        nb = mix(nb, 252, gloss);

        if (r0 > 220 && g0 > 230 && b0 > 235) {
          nr = mix(nr, r0, 0.7);
          ng = mix(ng, g0, 0.7);
          nb = mix(nb, b0, 0.7);
        }

        out[i] = clamp(Math.round(nr));
        out[i + 1] = clamp(Math.round(ng));
        out[i + 2] = clamp(Math.round(nb));
        continue;
      }

      if (discR2 < 1.3 && isRopePixel(r0, g0, b0, a)) {
        ropeCount++;
        const [, , ll] = rgbToHsl(r0, g0, b0);
        const highlight = smoothstep(0.62, 0.88, ll);
        if (highlight > 0.05) {
          const amt = highlight * 0.18;
          out[i] = clamp(Math.round(mix(r0, 216, amt)));
          out[i + 1] = clamp(Math.round(mix(g0, 224, amt)));
          out[i + 2] = clamp(Math.round(mix(b0, 230, amt * 1.1)));
        }
      }
      // snow / dirt / sides / shikirisen: untouched source pixels
    }
  }

  console.log({ iceCount, ropeCount });

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 95, alphaQuality: 100, effort: 6 })
    .toFile(OUT);

  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    return [out[i], out[i + 1], out[i + 2]];
  };
  console.log("samples", {
    iceCenter: sample(2400, 1400),
    snow: sample(600, 1000),
    snow2: sample(1100, 2200),
    shiki: sample(2229, 1365),
  });
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
