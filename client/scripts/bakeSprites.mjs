/**
 * bakeSprites — build-time sprite baker.
 *
 * Produces real PNG files for every (sprite, mawashi, body, tint) the game's
 * KNOWN color set needs, plus a manifest mapping each tuple to its file URL.
 * Runtime (utils/bakedSprites.js) resolves these first and only falls back to
 * live canvas recolor for arbitrary custom colors not in the set.
 *
 * Pixel parity: this script calls the SAME processImageData() from
 * recolorCore.js that the Web Worker / main-thread path use, and decodes/encodes
 * straight-alpha RGBA via pngjs (matching canvas getImageData), so baked PNGs
 * are pixel-identical to the runtime recolor.
 *
 * Usage:  node scripts/bakeSprites.mjs        (from the client/ dir)
 *         npm run bake
 *
 * Output: client/public/baked/<hash>.png  +  client/public/baked/manifest.json
 * (both gitignored — regenerate via this script / the build).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { BAKE_SOURCES, bakeKey } from "../src/config/bakeSources.js";
import {
  COLOR_PRESETS,
  BODY_COLOR_PRESETS,
  SPRITE_BASE_COLOR,
  DEFAULT_COLORS,
  DEFAULT_BODY_COLORS,
} from "../src/config/colorPresets.js";
import { getRosterColorCombos } from "../src/lib/bashoRun.js";
import {
  processImageData,
  getHslFromHex,
  SPECIAL_COLORS,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
} from "../src/utils/recolorCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, "../src/assets");
const OUT_DIR = path.join(__dirname, "../public/baked");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");

// Bump to force a full rebuild after an algorithm change (mirrors the runtime
// cache-version idea). Stored in the manifest so the runtime can sanity-check.
const BAKE_VERSION = "v1";

// SCOPE: bake the BASE tint only. The brief hit/charge/blubber/armor flash
// tints stay on the runtime recolor path (they're momentary overlays and
// baking all 5 variants ~4×'d the shipped footprint for little benefit — the
// stuck-color / ghost-frame bugs are about the persistent BASE render, which
// the baked base file fixes). getBakedSprite() misses for those tints and the
// caller falls back to the existing live recolor + cache.
const BAKE_TINTS = ["base"];

// ── Build the color combo set (mirrors PlayerColorContext.installAllColors) ──
function buildCombos() {
  const combos = [];
  const seen = new Set();
  const add = (color, body) => {
    const c = color || SPRITE_BASE_COLOR;
    const b = body || null;
    const key = `${c}|${b}`;
    if (seen.has(key)) return;
    seen.add(key);
    combos.push({ mawashi: c, body: b });
  };

  add(DEFAULT_COLORS.player1, DEFAULT_BODY_COLORS.player1);
  add(DEFAULT_COLORS.player2, DEFAULT_BODY_COLORS.player2);
  Object.values(COLOR_PRESETS).forEach((p) => add(p.hex, null));
  Object.values(BODY_COLOR_PRESETS).forEach((p) => {
    if (p.hex) add(SPRITE_BASE_COLOR, p.hex);
  });
  getRosterColorCombos().forEach((c) => add(c.mawashiColor, c.bodyColor));

  return combos;
}

// Decode a source PNG to a straight (non-premultiplied) RGBA bitmap, matching
// the browser's canvas getImageData layout the runtime recolor operates on.
async function decodePng(absPath) {
  const { data, info } = await sharp(absPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/**
 * Encode a recolored RGBA bitmap to a PNG file.
 * - normal recolors → 256-color palette (huge size win, visually lossless on
 *   flat mawashi/body recolors)
 * - special gradient modes (rainbow/fire/.../galaxy/gold) → full-RGBA, max zlib
 *   (palette would band the smooth gradients; these are few files so size is ok)
 */
function encodePng(out, absOut, special) {
  const img = sharp(out.data, {
    raw: { width: out.width, height: out.height, channels: 4 },
  });
  const opts = special
    ? { palette: false, compressionLevel: 9, effort: 10 }
    : { palette: true, quality: 90, effort: 7, compressionLevel: 9 };
  return img.png(opts).toFile(absOut);
}

// Recolor one bitmap for a (mawashi, body, tint) — params mirror recolorImage().
function recolorBitmap(srcPng, mawashi, body, tint) {
  const specialMode = SPECIAL_COLORS.has(mawashi) ? mawashi : null;
  const hitTintRed = tint === "hit";
  const chargeTintWhite = tint === "charge";
  const blubberTintPurple = tint === "blubber";
  const armorTintPink = tint === "armor";

  let targetHue, targetSat, targetLight;
  if (specialMode) {
    targetHue = 0;
    targetSat = 90;
    targetLight = 50;
  } else {
    const hsl = getHslFromHex(mawashi);
    targetHue = hsl.h;
    targetSat = hsl.s;
    targetLight = hsl.l;
  }

  const referenceLightness =
    (BLUE_COLOR_RANGES.minLightness + BLUE_COLOR_RANGES.maxLightness) / 2;

  const bodyColorRange = body ? GREY_BODY_RANGES : null;
  let bodyTargetHue = 0,
    bodyTargetSat = 0,
    bodyTargetLight = 50,
    bodyRefLight = 49;
  if (bodyColorRange && body) {
    const bodyHsl = getHslFromHex(body);
    bodyTargetHue = bodyHsl.h;
    bodyTargetSat = bodyHsl.s;
    bodyTargetLight = bodyHsl.l;
    bodyRefLight =
      (GREY_BODY_RANGES.minLightness + GREY_BODY_RANGES.maxLightness) / 2;
  }

  const skipMawashiRecolor =
    !specialMode && !hitTintRed && mawashi === SPRITE_BASE_COLOR;

  // Work on a copy so the decoded source can be reused for every combo.
  const out = {
    width: srcPng.width,
    height: srcPng.height,
    data: Buffer.from(srcPng.data),
  };

  processImageData(
    out,
    BLUE_COLOR_RANGES,
    targetHue,
    targetSat,
    targetLight,
    referenceLightness,
    specialMode,
    hitTintRed,
    out.width,
    out.height,
    chargeTintWhite,
    blubberTintPurple,
    armorTintPink,
    bodyColorRange,
    bodyTargetHue,
    bodyTargetSat,
    bodyTargetLight,
    bodyRefLight,
    skipMawashiRecolor
  );

  return out;
}

// A (mawashi, body, base) combo that recolors to a pixel-identical copy of the
// source needs no baked file (runtime uses the raw source). That's the default
// blue mawashi with no body color, base tint.
function isNoOpBase(mawashi, body, tint) {
  return tint === "base" && mawashi === SPRITE_BASE_COLOR && !body;
}

function fileNameForKey(key) {
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 20) + ".png";
}

async function main() {
  const combos = buildCombos();
  console.log(
    `[bake] ${combos.length} color combos × ${BAKE_SOURCES.length} sources × ${BAKE_TINTS.length} tint → baking…`
  );

  // Fresh output dir.
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Decode each source once; reuse across all combos.
  const decoded = new Map();
  for (const src of BAKE_SOURCES) {
    const abs = path.join(ASSETS_DIR, src.file);
    if (!fs.existsSync(abs)) {
      console.warn(`[bake] MISSING source, skipping: ${src.file}`);
      continue;
    }
    decoded.set(src.id, await decodePng(abs));
  }

  const manifest = {};
  let count = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const combo of combos) {
    const special = SPECIAL_COLORS.has(combo.mawashi);
    for (const src of BAKE_SOURCES) {
      const srcPng = decoded.get(src.id);
      if (!srcPng) continue;
      for (const tint of BAKE_TINTS) {
        if (isNoOpBase(combo.mawashi, combo.body, tint)) {
          skipped++;
          continue;
        }
        const key = bakeKey(src.id, combo.mawashi, combo.body, tint);
        if (manifest[key]) continue; // already produced (dedup safety)

        const out = recolorBitmap(srcPng, combo.mawashi, combo.body, tint);
        const fileName = fileNameForKey(key);
        const absOut = path.join(OUT_DIR, fileName);
        await encodePng(out, absOut, special);
        manifest[key] = `/baked/${fileName}`;
        count++;
        if (count % 200 === 0) {
          const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
          console.log(`[bake]   ${count} PNGs written (${secs}s)…`);
        }
      }
    }
  }

  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      { version: BAKE_VERSION, generatedAt: new Date().toISOString(), sprites: manifest },
      null,
      0
    )
  );

  const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(
    `[bake] DONE: ${count} PNGs (${skipped} no-op skipped), manifest ${
      Object.keys(manifest).length
    } entries, ${secs}s → ${OUT_DIR}`
  );
}

main().catch((err) => {
  console.error("[bake] FAILED:", err);
  process.exit(1);
});
