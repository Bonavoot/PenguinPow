/**
 * Bake transparent 1:1 head-gear overlays from hat-tweaks.json (v2).
 *
 * Each gear has its own poses { x, y, rotationDeg } + widthPct.
 * Top Hat is the default tuning baseline; Crown (etc.) can diverge per pose.
 *
 * Usage: node scripts/bake-hat-overlays.mjs
 *        node scripts/bake-hat-overlays.mjs crown
 *        node scripts/bake-hat-overlays.mjs top_hat crown halo plunger
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "client/src/assets");
const OUT_DIR = path.join(ASSETS, "cosmetics/overlays");
const TWEAKS_PATH = path.join(ASSETS, "cosmetics/hat-tweaks.json");
const MANIFEST = path.join(OUT_DIR, "manifest.json");

const GEARS = {
  top_hat: {
    file: path.join(ASSETS, "cosmetics/top-hat.png"),
    meta: path.join(ASSETS, "cosmetics/top-hat.json"),
    prefix: "hat",
  },
  crown: {
    file: path.join(ASSETS, "cosmetics/crown.png"),
    meta: path.join(ASSETS, "cosmetics/crown.json"),
    prefix: "crown",
  },
  halo: {
    file: path.join(ASSETS, "cosmetics/halo.png"),
    meta: path.join(ASSETS, "cosmetics/halo.json"),
    prefix: "halo",
  },
  plunger: {
    file: path.join(ASSETS, "cosmetics/plunger.png"),
    meta: path.join(ASSETS, "cosmetics/plunger.json"),
    prefix: "plunger",
    // After rotate/resize, pink cup AA can bleed a reddish fringe into the wood handle.
    cleanWoodBleed: true,
  },
};

/** Flat fills used by plunger.png — keep in sync with the source art. */
const PLUNGER_WOOD = [232, 201, 160]; // #e8c9a0
const PLUNGER_PINK = [254, 59, 99]; // hot pink from Clip Studio export
const PLUNGER_OUTLINE = [0, 0, 0];

function rgb2hsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s, l };
}

/**
 * Grow flat wood into muddy AA around the handle stroke.
 * Keeps alpha (smooth edges) — only rewrites RGB of fringe crumbs.
 */
async function cleanPlungerWoodBleed(pngBuf) {
  const { data, info } = await sharp(pngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  const isOutline = (r, g, b, a) => a > 40 && r < 70 && g < 70 && b < 70;

  const isWood = (r, g, b, a) =>
    a > 80 &&
    !isOutline(r, g, b, a) &&
    Math.abs(r - PLUNGER_WOOD[0]) < 24 &&
    Math.abs(g - PLUNGER_WOOD[1]) < 24 &&
    Math.abs(b - PLUNGER_WOOD[2]) < 28 &&
    g > b + 5;

  const dist2 = (r, g, b, c) => {
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    return dr * dr + dg * dg + db * db;
  };

  const isSolidCupPink = (r, g, b, a) =>
    a > 180 && dist2(r, g, b, PLUNGER_PINK) < 32 * 32;

  /** Muddy / rose pixel that should not sit against the wood fill. */
  const isHandleFringe = (r, g, b, a) => {
    if (a < 40 || isOutline(r, g, b, a) || isWood(r, g, b, a)) return false;
    const { h, s, l } = rgb2hsl(r, g, b);
    if (s < 0.05) return false;
    // rose / red / orange-brown mud (includes cup-pink AA crumbs on the handle)
    if (h < 55 || h > 320) return true;
    return l < 0.7 && r > 90 && g > 70 && b > 60 && r >= g && g >= b - 10;
  };

  // Direct pass: any rose/brown crumb between wood + outline → wood
  for (let pass = 0; pass < 4; pass++) {
    let changed = 0;
    const snap = Buffer.from(out);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        const r = snap[i];
        const g = snap[i + 1];
        const b = snap[i + 2];
        const a = snap[i + 3];
        if (!isHandleFringe(r, g, b, a)) continue;

        let nearWood = false;
        let nearOutline = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const j = ((y + dy) * width + (x + dx)) * 4;
            if (isWood(snap[j], snap[j + 1], snap[j + 2], snap[j + 3])) nearWood = true;
            if (isOutline(snap[j], snap[j + 1], snap[j + 2], snap[j + 3])) nearOutline = true;
          }
        }
        if (!nearWood) continue;
        // Cup / neck pink must never become wood — that creates the "handle dip"
        // into the collar after rotate. Only rewrite crumbs that sit on the handle.
        let nearPink = false;
        let woodN = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (!dx && !dy) continue;
            const yy = y + dy;
            const xx = x + dx;
            if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
            const j = (yy * width + xx) * 4;
            if (isSolidCupPink(snap[j], snap[j + 1], snap[j + 2], snap[j + 3])) {
              nearPink = true;
            }
            if (isWood(snap[j], snap[j + 1], snap[j + 2], snap[j + 3])) woodN++;
          }
        }
        if (isSolidCupPink(r, g, b, a)) continue;
        if (nearPink && woodN < 3) continue;

        out[i] = PLUNGER_WOOD[0];
        out[i + 1] = PLUNGER_WOOD[1];
        out[i + 2] = PLUNGER_WOOD[2];
        changed++;
      }
    }
    if (!changed) break;
  }

  return sharp(out, { raw: { width, height, channels } }).png().toBuffer();
}

const tweaks = JSON.parse(fs.readFileSync(TWEAKS_PATH, "utf8"));

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const requested = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const gearIds = requested.length ? requested : Object.keys(GEARS);

/** Resolve pose table for a gear (v2 gears.* or legacy top-level poses). */
function posesForGear(gearId) {
  if (tweaks.gears?.[gearId]?.poses) return tweaks.gears[gearId].poses;
  if (tweaks.poses) return tweaks.poses;
  // Fall back to top_hat poses if crown missing
  return tweaks.gears?.top_hat?.poses || {};
}

function widthPctForGear(gearId, gearMeta) {
  return (
    tweaks.gears?.[gearId]?.widthPct ??
    gearMeta.widthPct ??
    tweaks.global?.widthPct ??
    0.351
  );
}

async function placeGear(gearMeta, gearFile, widthPct, { x, y, rotationDeg, canvasW, canvasH }) {
  const scale = (canvasW * widthPct) / gearMeta.width;
  const hatW = Math.round(gearMeta.width * scale);
  const hatH = Math.round(gearMeta.height * scale);
  const pivotX = gearMeta.pivot.x * scale;
  const pivotY = gearMeta.pivot.y * scale;

  const hatBuf = await sharp(gearFile).resize(hatW, hatH).png().toBuffer();
  const rotated = await sharp(hatBuf)
    .rotate(rotationDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const rm = await sharp(rotated).metadata();

  const ox = pivotX - hatW / 2;
  const oy = pivotY - hatH / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = ox * cos - oy * sin;
  const ry = ox * sin + oy * cos;

  let left = Math.round(x - (rm.width / 2 + rx));
  let top = Math.round(y - (rm.height / 2 + ry));
  let sx = 0;
  let sy = 0;
  let sw = rm.width;
  let sh = rm.height;
  if (left < 0) {
    sx = -left;
    sw += left;
    left = 0;
  }
  if (top < 0) {
    sy = -top;
    sh += top;
    top = 0;
  }
  if (left + sw > canvasW) sw = canvasW - left;
  if (top + sh > canvasH) sh = canvasH - top;

  const clipped = await sharp(rotated)
    .extract({
      left: sx,
      top: sy,
      width: Math.max(1, sw),
      height: Math.max(1, sh),
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: clipped, left, top }])
    .png()
    .toBuffer();
}

const manifest = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
  : {};

for (const gearId of gearIds) {
  const gear = GEARS[gearId];
  if (!gear) {
    console.warn("unknown gear", gearId);
    continue;
  }
  const gearMeta = JSON.parse(fs.readFileSync(gear.meta, "utf8"));
  const poses = posesForGear(gearId);
  const widthPct = widthPctForGear(gearId, gearMeta);
  if (!manifest[gearId] || Array.isArray(manifest[gearId])) manifest[gearId] = {};

  console.log(`\n── ${gearId} (prefix=${gear.prefix}, widthPct=${widthPct}) ──`);
  for (const [stem, pose] of Object.entries(poses)) {
    const bodyPath = path.join(ASSETS, pose.file);
    if (!fs.existsSync(bodyPath)) {
      console.warn("skip missing body", pose.file);
      continue;
    }
    const meta = await sharp(bodyPath).metadata();
    const W = meta.width;
    const H = meta.height;
    const x = Number(pose.x);
    const y = Number(pose.y);
    const rotationDeg = Number(pose.rotationDeg ?? 0);

    let overlayBuf = await placeGear(gearMeta, gear.file, widthPct, {
      x,
      y,
      rotationDeg,
      canvasW: W,
      canvasH: H,
    });
    if (gear.cleanWoodBleed) {
      overlayBuf = await cleanPlungerWoodBleed(overlayBuf);
    }
    const outName = `${gear.prefix}-${stem}.png`;
    fs.writeFileSync(path.join(OUT_DIR, outName), overlayBuf);

    manifest[gearId][stem] = {
      overlay: `overlays/${outName}`,
      attach: { x, y, rotationDeg },
      canvas: { w: W, h: H },
      widthPct,
    };
    console.log("✓", outName, `x=${x} y=${y} rot=${rotationDeg}`);
  }
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`\nDone.`);
