/**
 * Zero near-transparent canvas fill on fighter PNGs.
 *
 * Many pose/spritesheet exports leave a=1–4 black over the empty frame.
 * CSS drop-shadow on those frames paints a dark rectangle the size of the
 * canvas. This rewrites still PNGs (skips APNG/GIF) and baked PNG/WebP.
 *
 * Usage (repo root):
 *   node tools/punch-ghost-canvas-alpha.mjs          # write dirty files
 *   node tools/punch-ghost-canvas-alpha.mjs --dry      # report only
 */

import crypto from "node:crypto";
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
const BAKED_DIR = path.join(ROOT, "client/public/baked");
const MANIFEST_PATH = path.join(BAKED_DIR, "manifest.json");
const DRY = process.argv.includes("--dry");
const CONCURRENCY = 8;

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
  if (fs.existsSync(BAKED_DIR)) {
    for (const name of fs.readdirSync(BAKED_DIR)) {
      const lower = name.toLowerCase();
      if (lower.endsWith(".png") || lower.endsWith(".webp")) {
        files.add(path.join(BAKED_DIR, name));
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

  const ext = path.extname(file).toLowerCase();
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

  const ratio = punched / (width * height);
  const pct = (100 * ratio).toFixed(2);
  // Lossy hat WebPs: only rewrite when the leftover fill is a real canvas
  // rectangle. Tiny fringe (≪2%) is not the visible box, and recompressing
  // ~6k hats would add generation loss for no in-game change.
  if (ext === ".webp" && ratio < 0.02) {
    return { file, punched: 0, width, height, skipped: "webp-fringe" };
  }
  if (!DRY) {
    const img = sharp(data, { raw: { width, height, channels: 4 } });
    if (ext === ".webp") {
      await img
        .webp({ quality: 70, alphaQuality: 85, effort: 4 })
        .toFile(file);
    } else {
      await img
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(file);
    }
  }
  return { file, punched, width, height, pct };
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

function bumpBakedManifestTag() {
  if (DRY || !fs.existsSync(MANIFEST_PATH)) return null;
  let raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  const man = JSON.parse(raw);
  const oldTag = man.bakeTag;
  if (!oldTag) return null;
  const newTag = crypto.randomBytes(5).toString("hex");
  raw = raw.replace(`"bakeTag":"${oldTag}"`, `"bakeTag":"${newTag}"`);
  raw = raw.replace(`"bakeTag": "${oldTag}"`, `"bakeTag": "${newTag}"`);
  // URLs may still carry an older ?v= than bakeTag (merge bakes). Bust all.
  raw = raw.replace(/\?v=[0-9a-f]+/g, `?v=${newTag}`);
  fs.writeFileSync(MANIFEST_PATH, raw);
  return { oldTag, newTag };
}

const files = collectFiles();
console.log(
  `${DRY ? "DRY " : ""}ghost-alpha punch  threshold=${GHOST_CANVAS_ALPHA}  files=${files.length}`
);

const results = await mapPool(files, CONCURRENCY, punchFile);

const changed = results.filter((r) => r.punched > 0);
const skipped = results.filter((r) => r.skipped);
console.log(
  `scanned ${results.length}  dirty ${changed.length}  skipped ${skipped.length}`
);
changed.sort((a, b) => b.punched - a.punched);
const shown = changed.slice(0, 40);
for (const r of shown) {
  console.log(
    `  ${r.pct.padStart(6)}%  ${r.punched.toString().padStart(8)} px  ${path.relative(ROOT, r.file)}`
  );
}
if (changed.length > shown.length) {
  console.log(`  … ${changed.length - shown.length} more`);
}
if (skipped.length) {
  const reasons = {};
  for (const r of skipped) {
    reasons[r.skipped] = (reasons[r.skipped] || 0) + 1;
  }
  console.log(
    `skipped ${skipped.length} (${Object.entries(reasons)
      .map(([k, n]) => `${k}:${n}`)
      .join(", ")})`
  );
}

const tag = bumpBakedManifestTag();
if (tag) {
  console.log(`bakeTag ${tag.oldTag} → ${tag.newTag} (cache bust)`);
}
