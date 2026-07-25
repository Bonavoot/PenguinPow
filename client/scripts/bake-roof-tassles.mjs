/**
 * Bake traditional sumo fusa color variants from tassel-3d.png.
 *
 * Source is cream with soft shading + black ink. We multiply fills by a
 * target midtone so luminance/shading survives; near-black ink is preserved.
 *
 * Usage: node scripts/bake-roof-tassles.mjs
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "../src/assets");
const SRC = path.join(ASSETS, "tassel-3d.png");

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
      break;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function multiplyRecolor(data, { r: tr, g: tg, b: tb, paper = 245, lift = 0 }) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    if (a < 8) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const { l } = rgbToHsl(r, g, b);
    const chroma = max - min;

    // Keep ink + dark anti-aliased outlines
    if (max < 50 || l < 15) continue;
    if (l < 26 && chroma < 20) continue;

    out[i] = Math.min(255, Math.round((r / paper) * tr + lift));
    out[i + 1] = Math.min(255, Math.round((g / paper) * tg + lift));
    out[i + 2] = Math.min(255, Math.round((b / paper) * tb + lift));
  }
  return out;
}

async function writeVariant(name, data, width, height) {
  const outPath = path.join(ASSETS, name);
  await sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log("wrote", name, fs.statSync(outPath).size);
}

const variants = [
  { name: "roof-tassle-green.png", r: 28, g: 140, b: 78 },
  { name: "roof-tassle-red.png", r: 196, g: 36, b: 42 },
  { name: "roof-tassle-black.png", r: 58, g: 58, b: 64, lift: 4 },
];

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

await sharp(SRC).png({ compressionLevel: 9 }).toFile(path.join(ASSETS, "roof-tassle.png"));
console.log("wrote roof-tassle.png (cream/white)");

for (const v of variants) {
  await writeVariant(v.name, multiplyRecolor(data, v), info.width, info.height);
}
