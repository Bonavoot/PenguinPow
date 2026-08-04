#!/usr/bin/env node
/**
 * Development-only authored-limb band measurement.
 *
 * Reproduces the Phase 4A method recorded in
 * shared/combatVolumeAuthored.json → meta.phase4aLimbMeasurement:
 *
 *   world outerForward = (canvasCx - frontmostOpaqueX) * SPRITE_PX_TO_WORLD
 *   world up           = (soleY - y) * SPRITE_PX_TO_WORLD
 *   soleY              = height * (1 - soleFracFromBottom)
 *
 * Prints the frontmost opaque column per world-`up` row so the ARM band can be
 * identified by eye and separated from feet / body / stray specks. Read-only.
 *
 * Usage (repo root):
 *   node tools/measure-limb-band.js palm-thrust.png
 *   node tools/measure-limb-band.js palm-thrust.png --band 40:100
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "client/src/assets");
const ALPHA_THRESHOLD = 16;
const DESIGN_CANVAS = 960;
const SPRITE_PX_TO_WORLD = (1280 * 0.123) / DESIGN_CANVAS; // 0.164
const SOLE_FRAC_FROM_BOTTOM = 0.021;

function parseBand(argv) {
  const i = argv.indexOf("--band");
  if (i === -1 || !argv[i + 1]) return null;
  const [lo, hi] = argv[i + 1].split(":").map(Number);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return { lo, hi };
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node tools/measure-limb-band.js <sprite.png> [--band lo:hi]");
    process.exit(2);
  }
  const full = path.join(ASSETS, file);
  if (!fs.existsSync(full)) {
    console.error(`missing sprite: ${full}`);
    process.exit(2);
  }
  const band = parseBand(process.argv);

  const { data, info } = await sharp(full)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Scale so a non-960 source still reports in the 960 design space the server
  // transform assumes.
  const pxScale = DESIGN_CANVAS / info.width;
  // meta.phase4aLimbMeasurement.rootXpx = 480 → width/2, NOT (width-1)/2.
  const canvasCx = info.width / 2;
  const soleY = info.height * (1 - SOLE_FRAC_FROM_BOTTOM);

  console.log(`file=${file} canvas=${info.width}x${info.height} soleY=${soleY.toFixed(2)}`);
  console.log(`spritePxToWorld=${SPRITE_PX_TO_WORLD} alphaThreshold=${ALPHA_THRESHOLD}`);
  console.log("up   | tipPx | outerWorld | rowSpanPx");

  let bandTipPx = -Infinity;
  let bandTipUp = null;
  let bandMinUp = Infinity;
  let bandMaxUp = -Infinity;

  for (let y = 0; y < info.height; y++) {
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    if (minX === -1) continue;
    const up = (soleY - y) * pxScale * SPRITE_PX_TO_WORLD;
    const tipPx = (canvasCx - minX) * pxScale;
    const outerWorld = tipPx * SPRITE_PX_TO_WORLD;
    if (band && up >= band.lo && up <= band.hi) {
      if (tipPx > bandTipPx) {
        bandTipPx = tipPx;
        bandTipUp = up;
      }
      if (up < bandMinUp) bandMinUp = up;
      if (up > bandMaxUp) bandMaxUp = up;
    }
    if (!band || (up >= band.lo - 8 && up <= band.hi + 8)) {
      console.log(
        `${up.toFixed(1).padStart(5)} | ${tipPx.toFixed(0).padStart(5)} | ` +
          `${outerWorld.toFixed(3).padStart(10)} | ${(maxX - minX + 1).toString().padStart(4)}`
      );
    }
  }

  if (band) {
    const outer = bandTipPx * SPRITE_PX_TO_WORLD;
    console.log(
      `\nBAND up[${band.lo},${band.hi}] → tipPx=${bandTipPx.toFixed(0)} ` +
        `outerForward=${outer.toFixed(3)} (at up≈${bandTipUp?.toFixed(1)}) ` +
        `rowsPresent=[${bandMinUp.toFixed(1)},${bandMaxUp.toFixed(1)}]`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
