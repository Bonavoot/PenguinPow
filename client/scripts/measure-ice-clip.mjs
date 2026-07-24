/**
 * Measure the blue ice disc in dohyo-style.webp and emit the CSS
 * `.ice-reflection-clip` clip-path that matches it in actor/camera space.
 *
 * Pipeline:
 *  1. Classify ice pixels (same rules as enhance-dohyo.mjs)
 *  2. Fit an axis-aligned ellipse in IMAGE space (ray-cast + least squares)
 *  3. Densely sample that mathematical ellipse (not raw ice rays — those
 *     leave gaps where the classifier misses edge pixels and the convex
 *     hull then chords across, which read as a "squared" left side)
 *  4. Project each sample through .dohyo-overlay background placement +
 *     full transform (translateY → scaleY → rotateX under perspective)
 *  5. Emit clip-path: polygon(...) in angular order
 *
 * Usage: node scripts/measure-ice-clip.mjs
 *        node scripts/measure-ice-clip.mjs --write
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "../src/assets/dohyo-style.webp");
const CSS_PATH = path.join(__dirname, "../src/App.css");
const WRITE = process.argv.includes("--write");

// Must match .dohyo-overlay in App.css
const CW = 1280;
const CH = 720;
const BG_SIZE_W = 0.9;
const BG_SIZE_H = 0.78;
const BG_POS_X = 0.5;
const BG_POS_Y = 0.18;
const ORIGIN_X = 0.48;
const ORIGIN_Y = 1.08;
const SCALE_Y = 0.86;
const TRANSLATE_Y = 0.09;
const PERSPECTIVE = 380;
const ROTATE_X_DEG = 5;
/** Outward pad in design-px so reflection blur isn't shaved at the lip. */
const EDGE_PAD_PX = 2;
/** Dense ellipse samples — more = smoother projected polygon. */
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

/** Same classifier as enhance-dohyo.mjs */
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

// Ray-cast to fit ellipse radii only (LS ignores short/gappy rays via LS)
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

const bgW = BG_SIZE_W * CW;
const bgH = BG_SIZE_H * CH;
const offX = (CW - bgW) * BG_POS_X;
const offY = (CH - bgH) * BG_POS_Y;
const ox = ORIGIN_X * CW;
const oy = ORIGIN_Y * CH;
const tY = TRANSLATE_Y * CH;
const cos = Math.cos((ROTATE_X_DEG * Math.PI) / 180);
const sin = Math.sin((ROTATE_X_DEG * Math.PI) / 180);

/**
 * CSS: transform: perspective() rotateX() scaleY() translateY()
 * Points experience transforms right-to-left around transform-origin.
 */
function projectToActor(ix, iy) {
  let x = offX + (ix / W) * bgW;
  let y = offY + (iy / H) * bgH;
  let lx = x - ox;
  let ly = y - oy;
  ly += tY;
  ly *= SCALE_Y;
  const y2 = ly * cos;
  const z2 = ly * sin;
  const persp = PERSPECTIVE / (PERSPECTIVE - z2);
  lx *= persp;
  ly = y2 * persp;
  return { x: lx + ox, y: ly + oy };
}

// Dense mathematical ellipse in image space → project (keeps both sides rounded)
const projected = [];
for (let i = 0; i < SAMPLES; i++) {
  const th = (i / SAMPLES) * Math.PI * 2;
  const ix = cx + rxImg * Math.cos(th);
  const iy = cy + ryImg * Math.sin(th);
  projected.push(projectToActor(ix, iy));
}

const ring = padFromCentroid(projected, EDGE_PAD_PX);

const poly = ring
  .map(
    (p) =>
      `${((p.x / CW) * 100).toFixed(3)}% ${((p.y / CH) * 100).toFixed(3)}%`
  )
  .join(", ");

const clipPath = `polygon(${poly})`;

const minX = Math.min(...ring.map((p) => p.x));
const maxX = Math.max(...ring.map((p) => p.x));
const minY = Math.min(...ring.map((p) => p.y));
const maxY = Math.max(...ring.map((p) => p.y));

// Chord-length sanity: longest step should be tiny with dense sampling
let longest = 0;
for (let i = 0; i < ring.length; i++) {
  const a = ring[i];
  const b = ring[(i + 1) % ring.length];
  longest = Math.max(longest, Math.hypot(b.x - a.x, b.y - a.y));
}

console.log(`Ice pixels: ${n}`);
console.log(
  `Image ellipse: cx=${((cx / W) * 100).toFixed(2)}% cy=${((cy / H) * 100).toFixed(2)}% rx=${((rxImg / W) * 100).toFixed(2)}% ry=${((ryImg / H) * 100).toFixed(2)}%`
);
console.log(
  `Projected AABB: x ${((minX / CW) * 100).toFixed(2)}%–${((maxX / CW) * 100).toFixed(2)}%  y ${((minY / CH) * 100).toFixed(2)}%–${((maxY / CH) * 100).toFixed(2)}%`
);
console.log(
  `Samples: ${SAMPLES}, longest step: ${((longest / CW) * 100).toFixed(3)}% of width`
);
console.log("");
console.log("clip-path:");
console.log(`  ${clipPath.slice(0, 120)}… (${ring.length} verts)`);

if (WRITE) {
  let css = fs.readFileSync(CSS_PATH, "utf8");
  const blockRe = /(\.ice-reflection-clip\s*\{)([\s\S]*?)(\n\})/;
  if (!blockRe.test(css)) {
    console.error("Could not find .ice-reflection-clip block in App.css");
    process.exit(1);
  }
  const nextBody = `
  /* Measured ice silhouette — regenerate with:
     node scripts/measure-ice-clip.mjs --write */
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
