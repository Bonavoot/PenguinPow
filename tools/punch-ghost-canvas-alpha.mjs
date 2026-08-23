/**
 * Zero near-transparent canvas fill on fighter PNGs.
 *
 * Many pose/spritesheet exports leave a=1–4 black over the empty frame.
 * CSS drop-shadow on those frames paints a dark rectangle the size of the
 * canvas. This rewrites only still PNGs (skips APNG/GIF).
 *
 * Usage (repo root):
 *   node tools/punch-ghost-canvas-alpha.mjs          # write dirty files
 *   node tools/punch-ghost-canvas-alpha.mjs --dry      # report only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { BAKE_SOURCES } from "../client/src/config/bakeSources.js";
import {
  GHOST_CANVAS_ALPHA,
  punchGhostCanvasAlpha,
} from "../client/src/utils/recolorCore.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "client/src/assets");
const DRY = process.argv.includes("--dry");

const EXTRA_STILLS = [
  "salt.png",
  "throwing.png",
  "pumo-waddle.png",
  "pumo-army.png",
  "bow.png",
  "grab-attempt.png",
  "hit.png",
  "snowball-throw.png",
  "at-the-ropes.png",
  "crouch-strafing.png",
  "is_perfect_parried.png",
  "is-perfect-parried.png",
];

function isApng(buf) {
  return buf.includes(Buffer.from("acTL"));
}

function collectFiles() {
  const files = new Set();
  for (const src of BAKE_SOURCES) {
    files.add(path.join(ASSETS, src.file));
  }
  for (const extra of EXTRA_STILLS) {
    files.add(path.join(ASSETS, extra));
  }
  for (const dir of ["spritesheets", "bald"]) {
    const abs = path.join(ASSETS, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (name.toLowerCase().endsWith(".png")) {
        files.add(path.join(abs, name));
      }
    }
  }
  return [...files].filter((f) => fs.existsSync(f)).sort();
}

async function punchFile(file) {
  const buf = fs.readFileSync(file);
  if (isApng(buf)) {
    return { file, skipped: "apng" };
  }

  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels < 4) return { file, skipped: "no-alpha" };

  const before = Buffer.from(data);
  punchGhostCanvasAlpha(data, GHOST_CANVAS_ALPHA);

  let punched = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (before[i] !== data[i]) punched++;
  }
  if (punched === 0) return { file, punched: 0, width, height };

  const pct = ((100 * punched) / (width * height)).toFixed(2);
  if (!DRY) {
    await sharp(data, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(file);
  }
  return { file, punched, width, height, pct };
}

const results = [];
for (const file of collectFiles()) {
  results.push(await punchFile(file));
}

const changed = results.filter((r) => r.punched > 0);
const skipped = results.filter((r) => r.skipped);
console.log(
  `${DRY ? "DRY " : ""}ghost-alpha punch  threshold=${GHOST_CANVAS_ALPHA}`
);
console.log(
  `scanned ${results.length}  dirty ${changed.length}  skipped ${skipped.length}`
);
for (const r of changed.sort((a, b) => b.punched - a.punched)) {
  console.log(
    `  ${r.pct.padStart(6)}%  ${r.punched.toString().padStart(8)} px  ${path.relative(ROOT, r.file)}`
  );
}
if (skipped.length) {
  console.log("skipped:");
  for (const r of skipped) {
    console.log(`  ${r.skipped}  ${path.relative(ROOT, r.file)}`);
  }
}
