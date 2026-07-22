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
  },
};

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

    const overlayBuf = await placeGear(gearMeta, gear.file, widthPct, {
      x,
      y,
      rotationDeg,
      canvasW: W,
      canvasH: H,
    });
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
