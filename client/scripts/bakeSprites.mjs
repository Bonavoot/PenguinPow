/**
 * bakeSprites — build-time sprite baker.
 *
 * Produces:
 *  1) Recolored body/spritesheet PNGs for known (sprite, mawashi, body, tint)
 *  2) Flattened body+topper WebPs for known (gear, pose, mawashi, body, tint)
 *  3) manifest.json with `sprites` + `hats` maps
 *
 * Runtime (utils/bakedSprites.js) resolves these first; arbitrary custom colors
 * fall back to live recolor / composite outside the normal Steam match path.
 *
 * Usage:  npm run bake   (from client/)
 *         BAKE_GEARS=ponytail npm run bake:hats   # merge one topper into existing bake
 *
 * Output: client/public/baked/*  +  client/public/baked/manifest.json
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { BAKE_SOURCES, bakeKey } from "../src/config/bakeSources.js";
import {
  HAT_GEAR_IDS,
  HAT_POSE_SOURCES,
  HAT_UNDER_BODY,
  HAT_RECOLOR_OVERLAY,
  hatBakeKey,
  overlayFileFor,
} from "../src/config/bakeHatSources.js";
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
const BAKE_VERSION = "v2-hats";

/** Skip menu-only topper poses in the match bake (still bake combat/portrait). */
const BAKE_MENU_HATS = process.env.BAKE_MENU_HATS === "1";

/**
 * Optional gear filter for hat rebakes, e.g. BAKE_GEARS=ponytail
 * (comma-separated). Empty = all HAT_GEAR_IDS.
 */
const BAKE_GEARS = (process.env.BAKE_GEARS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Merge into an existing public/baked/manifest.json instead of wiping the
 * output dir. Pair with BAKE_HATS_ONLY=1 + BAKE_GEARS=… to refresh one topper
 * after overlay art changes (basho/combat resolve flattened hats first).
 */
const BAKE_MERGE = process.env.BAKE_MERGE === "1";
const BAKE_HATS_ONLY = process.env.BAKE_HATS_ONLY === "1";

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

// Include source pixel tag so updating a PNG (e.g. frame-3-bald) changes the
// baked *path*, not only ?v=. Filenames keyed only by color were cache-sticky
// in Electron/Chromium even after rebake.
function fileNameForKey(key, sourceTag = "") {
  return (
    crypto
      .createHash("sha1")
      .update(`${key}|${sourceTag}`)
      .digest("hex")
      .slice(0, 20) + ".png"
  );
}

/** Short fingerprint of source bytes so rebakes change manifest URLs and bust HTTP caches. */
function sourceContentTag(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10);
}

async function main() {
  const combos = buildCombos();
  const gearIds = BAKE_GEARS.length
    ? HAT_GEAR_IDS.filter((id) => BAKE_GEARS.includes(id))
    : HAT_GEAR_IDS;
  if (BAKE_GEARS.length && gearIds.length === 0) {
    throw new Error(
      `[bake] BAKE_GEARS=${BAKE_GEARS.join(",")} matched no HAT_GEAR_IDS`,
    );
  }

  let existing = null;
  if (BAKE_MERGE || BAKE_HATS_ONLY) {
    if (!fs.existsSync(MANIFEST_PATH)) {
      throw new Error(
        "[bake] BAKE_MERGE/BAKE_HATS_ONLY requires an existing public/baked/manifest.json",
      );
    }
    existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  }

  console.log(
    BAKE_HATS_ONLY
      ? `[bake] hats-only merge: ${gearIds.join(",")} × ${combos.length} combos`
      : `[bake] ${combos.length} color combos × ${BAKE_SOURCES.length} sources × ${BAKE_TINTS.length} tint → baking…`,
  );

  if (!BAKE_MERGE && !BAKE_HATS_ONLY) {
    // Fresh output dir.
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Decode each source once; reuse across all combos.
  const decoded = new Map();
  const sourceTagById = new Map();
  if (!BAKE_HATS_ONLY) {
    for (const src of BAKE_SOURCES) {
      const abs = path.join(ASSETS_DIR, src.file);
      if (!fs.existsSync(abs)) {
        console.warn(`[bake] MISSING source, skipping: ${src.file}`);
        continue;
      }
      decoded.set(src.id, await decodePng(abs));
      sourceTagById.set(src.id, sourceContentTag(abs));
    }
  }

  // Bake-wide cache buster: changes whenever ANY source PNG changes so every
  // manifest URL invalidates browser/Electron image caches (filenames alone are
  // keyed by color tuple, not pixel content). For hats-only merges, also fold
  // in overlay bytes so a topper art update busts ?v= without a full rebake.
  let bakeTag;
  if (BAKE_HATS_ONLY) {
    const overlayTag = crypto.createHash("sha1");
    for (const gearId of gearIds) {
      for (const pose of HAT_POSE_SOURCES) {
        const ovAbs = path.join(ASSETS_DIR, overlayFileFor(gearId, pose.hairedStem));
        if (fs.existsSync(ovAbs)) {
          overlayTag.update(gearId);
          overlayTag.update(fs.readFileSync(ovAbs));
        }
      }
    }
    bakeTag = crypto
      .createHash("sha1")
      .update(String(existing?.bakeTag || ""))
      .update(overlayTag.digest("hex"))
      .digest("hex")
      .slice(0, 10);
  } else {
    bakeTag = crypto
      .createHash("sha1")
      .update([...sourceTagById.entries()].sort().join("|"))
      .digest("hex")
      .slice(0, 10);
  }

  const manifest = existing?.sprites ? { ...existing.sprites } : {};
  let count = 0;
  let skipped = 0;
  const startedAt = Date.now();

  if (!BAKE_HATS_ONLY) {
    // Full / body bake replaces sprite map entries (merge keeps prior keys for
    // sources we skip; wipe mode starts empty above when not merging).
    if (!BAKE_MERGE) {
      for (const k of Object.keys(manifest)) delete manifest[k];
    }
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
          if (manifest[key] && BAKE_MERGE) continue;

          const out = recolorBitmap(srcPng, combo.mawashi, combo.body, tint);
          const sourceTag = sourceTagById.get(src.id) || "";
          const fileName = fileNameForKey(key, sourceTag);
          const absOut = path.join(OUT_DIR, fileName);
          await encodePng(out, absOut, special);
          // Path changes when source pixels change; ?v= still busts manifest clients.
          manifest[key] = `/baked/${fileName}?v=${bakeTag}`;
          count++;
          if (count % 200 === 0) {
            const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
            console.log(`[bake]   ${count} PNGs written (${secs}s)…`);
          }
        }
      }
    }
  }

  // ── Phase 2: flattened body + topper composites ─────────────────────
  const hats = existing?.hats ? { ...existing.hats } : {};
  // Drop stale keys for gears we're rebaking so removed poses can't linger.
  if (BAKE_HATS_ONLY || BAKE_GEARS.length) {
    for (const key of Object.keys(hats)) {
      const gearId = key.split("|")[1];
      if (gearIds.includes(gearId)) delete hats[key];
    }
  } else if (!BAKE_MERGE) {
    for (const key of Object.keys(hats)) delete hats[key];
  }
  let hatCount = 0;
  let hatDeduped = 0;
  const hatContentToFile = new Map(); // sha1 → filename.webp

  const poseList = HAT_POSE_SOURCES.filter(
    (p) => BAKE_MENU_HATS || !p.menuOnly,
  );
  console.log(
    `[bake] hats: ${gearIds.length} gears × ${poseList.length} poses × ${combos.length} combos…`,
  );

  // Decode hat bodies + overlays once.
  const hatBodyDecoded = new Map();
  const hatOverlayDecoded = new Map();
  for (const pose of poseList) {
    const abs = path.join(ASSETS_DIR, pose.bodyFile);
    if (!fs.existsSync(abs)) {
      console.warn(`[bake] MISSING hat body, skipping pose: ${pose.bodyFile}`);
      continue;
    }
    hatBodyDecoded.set(pose.bodySpriteId, await decodePng(abs));
    for (const gearId of gearIds) {
      const ovRel = overlayFileFor(gearId, pose.hairedStem);
      const ovAbs = path.join(ASSETS_DIR, ovRel);
      if (!fs.existsSync(ovAbs)) {
        console.warn(`[bake] MISSING overlay: ${ovRel}`);
        continue;
      }
      const ovKey = `${gearId}|${pose.hairedStem}`;
      if (!hatOverlayDecoded.has(ovKey)) {
        hatOverlayDecoded.set(ovKey, await decodePng(ovAbs));
      }
    }
  }

  function compositeRgba(bodyPng, overlayPng, underBody) {
    const width = bodyPng.width;
    const height = bodyPng.height;
    const out = Buffer.alloc(width * height * 4);
    const srcA = underBody ? overlayPng.data : bodyPng.data;
    const srcB = underBody ? bodyPng.data : overlayPng.data;
    // Layer A (full copy), then straight-alpha over with layer B.
    Buffer.from(srcA).copy(out);
    for (let i = 0; i < out.length; i += 4) {
      const ba = srcB[i + 3] / 255;
      if (ba <= 0) continue;
      const br = srcB[i];
      const bg = srcB[i + 1];
      const bb = srcB[i + 2];
      if (ba >= 1) {
        out[i] = br;
        out[i + 1] = bg;
        out[i + 2] = bb;
        out[i + 3] = 255;
        continue;
      }
      const aa = out[i + 3] / 255;
      const outA = ba + aa * (1 - ba);
      if (outA <= 0) {
        out[i + 3] = 0;
        continue;
      }
      out[i] = Math.round((br * ba + out[i] * aa * (1 - ba)) / outA);
      out[i + 1] = Math.round((bg * ba + out[i + 1] * aa * (1 - ba)) / outA);
      out[i + 2] = Math.round((bb * ba + out[i + 2] * aa * (1 - ba)) / outA);
      out[i + 3] = Math.round(outA * 255);
    }
    return { width, height, data: out };
  }

  // Cache recolored hat bodies: (bodySpriteId|mawashi|body|tint) → rgba
  const recoloredHatBodyCache = new Map();

  async function encodeHatWebp(rgba, absOut) {
    await sharp(rgba.data, {
      raw: { width: rgba.width, height: rgba.height, channels: 4 },
    })
      .webp({
        // 70 keeps package size closer to Steam budgets while preserving
        // transparent edges; override with BAKE_HAT_WEBP_QUALITY=82 etc.
        quality: Number(process.env.BAKE_HAT_WEBP_QUALITY || 70),
        alphaQuality: 85,
        effort: 4,
      })
      .toFile(absOut);
  }

  for (const combo of combos) {
    for (const gearId of gearIds) {
      const underBody = !!HAT_UNDER_BODY[gearId];
      const recolorOv = !!HAT_RECOLOR_OVERLAY[gearId];
      for (const pose of poseList) {
        const bodySrc = hatBodyDecoded.get(pose.bodySpriteId);
        const ovKey = `${gearId}|${pose.hairedStem}`;
        const ovSrc = hatOverlayDecoded.get(ovKey);
        if (!bodySrc || !ovSrc) continue;

        for (const tint of BAKE_TINTS) {
          const key = hatBakeKey(
            gearId,
            pose.bodySpriteId,
            combo.mawashi,
            combo.body,
            tint,
          );
          if (hats[key]) continue;

          const bodyCacheKey = `${pose.bodySpriteId}|${combo.mawashi}|${combo.body}|${tint}`;
          let bodyRgba = recoloredHatBodyCache.get(bodyCacheKey);
          if (!bodyRgba) {
            bodyRgba = isNoOpBase(combo.mawashi, combo.body, tint)
              ? {
                  width: bodySrc.width,
                  height: bodySrc.height,
                  data: Buffer.from(bodySrc.data),
                }
              : recolorBitmap(bodySrc, combo.mawashi, combo.body, tint);
            recoloredHatBodyCache.set(bodyCacheKey, bodyRgba);
          }

          let overlayRgba = ovSrc;
          if (recolorOv && !isNoOpBase(combo.mawashi, null, "base")) {
            overlayRgba = recolorBitmap(ovSrc, combo.mawashi, null, "base");
          }

          // Resize overlay if needed (rare)
          if (
            overlayRgba.width !== bodyRgba.width ||
            overlayRgba.height !== bodyRgba.height
          ) {
            const { data, info } = await sharp(overlayRgba.data, {
              raw: {
                width: overlayRgba.width,
                height: overlayRgba.height,
                channels: 4,
              },
            })
              .resize(bodyRgba.width, bodyRgba.height, { fit: "fill" })
              .raw()
              .toBuffer({ resolveWithObject: true });
            overlayRgba = {
              width: info.width,
              height: info.height,
              data,
            };
          }

          const flat = compositeRgba(bodyRgba, overlayRgba, underBody);
          const contentHash = crypto
            .createHash("sha1")
            .update(flat.data)
            .digest("hex")
            .slice(0, 20);
          let fileName = hatContentToFile.get(contentHash);
          if (!fileName) {
            fileName = `h${contentHash}.webp`;
            hatContentToFile.set(contentHash, fileName);
            await encodeHatWebp(flat, path.join(OUT_DIR, fileName));
            hatCount++;
          } else {
            hatDeduped++;
          }
          hats[key] = `/baked/${fileName}?v=${bakeTag}`;
          if (hatCount > 0 && hatCount % 200 === 0) {
            const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
            console.log(`[bake]   ${hatCount} hat WebPs written (${secs}s)…`);
          }
        }
      }
    }
  }

  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        version: BAKE_VERSION,
        generatedAt: new Date().toISOString(),
        bakeTag,
        sprites: manifest,
        hats,
      },
      null,
      0
    )
  );

  const secs = ((Date.now() - startedAt) / 1000).toFixed(0);
  const hatBytes = [...hatContentToFile.values()].reduce((s, f) => {
    try {
      return s + fs.statSync(path.join(OUT_DIR, f)).size;
    } catch {
      return s;
    }
  }, 0);
  console.log(
    `[bake] DONE: ${count} body PNGs (${skipped} no-op skipped), ` +
      `${hatCount} hat WebPs (${hatDeduped} deduped refs, ${(hatBytes / 1024 / 1024).toFixed(1)} MB), ` +
      `manifest sprites=${Object.keys(manifest).length} hats=${Object.keys(hats).length}, ` +
      `${secs}s → ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error("[bake] FAILED:", err);
  process.exit(1);
});
