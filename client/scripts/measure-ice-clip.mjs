/**
 * Measure the blue ice disc and emit the CSS `.ice-reflection-clip` clip-path
 * that matches it in actor/camera space.
 *
 * In-game the dohyo is a flat full-bleed bake (dohyo-display.webp) — ice pixels
 * map 1:1 into 1280×720 actor space.
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
const STYLE = path.join(__dirname, "../src/assets/dohyo-style.webp");
const CSS_PATH = path.join(__dirname, "../src/App.css");
const WRITE = process.argv.includes("--write");

const CW = 1280;
const CH = 720;
const EDGE_PAD_PX = 2;
const SAMPLES = 720;

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

function isIcePixel(r, g, b, a) {
  if (a < 16) return false;
  const [h, s, l] = rgbToHsl(r, g, b);
  return (
    b > r + 25 &&
    b > 140 &&
    g > 110 &&
    h > 175 &&
    h < 235 &&
    s > 0.12 &&
    l > 0.38 &&
    l < 0.95 &&
    !(r > 210 && g > 210 && b > 210)
  );
}

function padFromCentroid(pts, padPx) {
  if (padPx <= 0 || pts.length < 3) return pts;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * padPx, y: p.y + (dy / len) * padPx };
  });
}

const SRC = fs.existsSync(DISPLAY) ? DISPLAY : STYLE;
if (!fs.existsSync(DISPLAY)) {
  console.warn(
    "dohyo-display.webp missing — measuring style asset (run bake-dohyo-display.mjs)",
  );
}

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels } = info;

const ice = new Uint8Array(W * H);
let sumX = 0;
let sumY = 0;
let n = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * channels;
    if (isIcePixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      ice[y * W + x] = 1;
      sumX += x;
      sumY += y;
      n++;
    }
  }
}
if (!n) {
  console.error("No ice pixels found in", SRC);
  process.exit(1);
}

const cx = sumX / n;
const cy = sumY / n;

const radii = [];
for (let a = 0; a < 360; a++) {
  const rad = (a * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  let last = 0;
  for (let t = 0; t < Math.max(W, H); t += 0.5) {
    const x = Math.round(cx + dx * t);
    const y = Math.round(cy + dy * t);
    if (x < 0 || y < 0 || x >= W || y >= H) break;
    if (ice[y * W + x]) last = t;
  }
  radii.push(last);
}

let Scc = 0;
let Scs = 0;
let Sss = 0;
let Sc = 0;
let Ss = 0;
for (let a = 0; a < 360; a++) {
  const r = radii[a];
  if (r < 10) continue;
  const th = (a * Math.PI) / 180;
  const c2 = Math.cos(th) ** 2;
  const s2 = Math.sin(th) ** 2;
  const invR2 = 1 / (r * r);
  Scc += c2 * c2;
  Scs += c2 * s2;
  Sss += s2 * s2;
  Sc += c2 * invR2;
  Ss += s2 * invR2;
}
const det = Scc * Sss - Scs * Scs;
const u = (Sss * Sc - Scs * Ss) / det;
const v = (Scc * Ss - Scs * Sc) / det;
const rxImg = 1 / Math.sqrt(u);
const ryImg = 1 / Math.sqrt(v);

function toActor(ix, iy) {
  return { x: (ix / W) * CW, y: (iy / H) * CH };
}

const projected = [];
for (let i = 0; i < SAMPLES; i++) {
  const th = (i / SAMPLES) * Math.PI * 2;
  const ix = cx + rxImg * Math.cos(th);
  const iy = cy + ryImg * Math.sin(th);
  projected.push(toActor(ix, iy));
}

const ring = padFromCentroid(projected, EDGE_PAD_PX);

const poly = ring
  .map(
    (p) =>
      `${((p.x / CW) * 100).toFixed(3)}% ${((p.y / CH) * 100).toFixed(3)}%`,
  )
  .join(", ");

const clipPath = `polygon(${poly})`;

const minX = Math.min(...ring.map((p) => p.x));
const maxX = Math.max(...ring.map((p) => p.x));
const minY = Math.min(...ring.map((p) => p.y));
const maxY = Math.max(...ring.map((p) => p.y));

let longest = 0;
for (let i = 0; i < ring.length; i++) {
  const a = ring[i];
  const b = ring[(i + 1) % ring.length];
  longest = Math.max(longest, Math.hypot(b.x - a.x, b.y - a.y));
}

console.log(`Source: ${path.basename(SRC)} (${W}×${H}) — flat bake path`);
console.log(`Ice pixels: ${n}`);
console.log(
  `Image ellipse: cx=${((cx / W) * 100).toFixed(2)}% cy=${((cy / H) * 100).toFixed(2)}% rx=${((rxImg / W) * 100).toFixed(2)}% ry=${((ryImg / H) * 100).toFixed(2)}%`,
);
console.log(
  `Actor AABB: x ${((minX / CW) * 100).toFixed(2)}%–${((maxX / CW) * 100).toFixed(2)}%  y ${((minY / CH) * 100).toFixed(2)}%–${((maxY / CH) * 100).toFixed(2)}%`,
);
console.log(
  `Samples: ${SAMPLES}, longest step: ${((longest / CW) * 100).toFixed(3)}% of width`,
);

if (WRITE) {
  let css = fs.readFileSync(CSS_PATH, "utf8");
  const blockRe = /(\.ice-reflection-clip\s*\{)([\s\S]*?)(\n\})/;
  if (!blockRe.test(css)) {
    console.error("Could not find .ice-reflection-clip block in App.css");
    process.exit(1);
  }
  const nextBody = `
  /* Measured ice silhouette from dohyo-display.webp (flat bake) — regenerate:
     npm run bake:dohyo   or   node scripts/measure-ice-clip.mjs --write */
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  clip-path: ${clipPath};
`;
  css = css.replace(blockRe, `$1${nextBody}$3`);
  fs.writeFileSync(CSS_PATH, css);
  console.log("\nUpdated", path.relative(process.cwd(), CSS_PATH));
}
