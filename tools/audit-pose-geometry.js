#!/usr/bin/env node
/**
 * Development-only pose geometry audit.
 *
 * Scans gameplay fighter sprites for canvas size, opaque alpha bounds,
 * sole line, tip extents, and grounding consistency. Does NOT modify images.
 *
 * Usage (repo root):
 *   node tools/audit-pose-geometry.js
 *   node tools/audit-pose-geometry.js --json > /tmp/pose-geometry.json
 *   node tools/audit-pose-geometry.js --viz   # writes sheets under tools/pose-geometry-viz/
 *
 * Requires: sharp (already in repo root node_modules).
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "client/src/assets");
const ALPHA_THRESHOLD = 16;
const DESIGN_CANVAS = 960;
const DISPLAY_WIDTH_FRAC = 0.123;
const DESIGN_WIDTH = 1280;
const SPRITE_PX_TO_WORLD = (DESIGN_WIDTH * DISPLAY_WIDTH_FRAC) / DESIGN_CANVAS;

// Tip constants currently hardcoded in server-io/constants.js (for comparison).
const LIVE_TIP_CONSTANTS = {
  slap1: 478,
  slap2: 478,
  charged: 425,
  palm: 438,
};

/** Gameplay poses used by getImageSrc / fighterAssets (not cosmetics). */
const GAMEPLAY_SPRITES = [
  "pumo-idle.png",
  "pumo-ready-position.png",
  "pumo-tachiai-position.png",
  "attack.png",
  "slapAttack1.png",
  "slapAttack2.png",
  "slap-attack-1-blur-frame.png",
  "slap-attack-1-hit-frame.png",
  "slap-attack-2-blur-frame.png",
  "slap-attack-2-hit-frame.png",
  "palm-thrust.png",
  "palm-thrust-startup.png",
  "palm-thrust-smear.png",
  "kick.png",
  "dodging.png",
  "sliding.png",
  "throwing.png",
  "recovering.png",
  "charging.png",
  "blocking.png",
  "block-parry.png",
  "grabbing.png",
  "clinch-planting.png",
  "attempting-grab-throw.png",
  "is-attempting-pull.png",
  "hit.png",
  "at-the-ropes.png",
  "pumo-flap-1.png",
  "pumo-flap-2.png",
  "crouch-stance.png",
  "bow.png",
  "raw-parry-success.png",
  "raw-parry-success-frame-1.png",
  "raw-parry-success-frame-2.png",
  "cinematic-throw-kill-landing.png",
  "grab-attempt.png",
  "pumo-waddle.png",
  "is_perfect_parried.png",
  "is-perfect-parried.png",
];

/** Emit pose-key suggestions for Phase 11 registry (read-only diagnostics). */
function emitRegistryHints(sprites) {
  if (WANT_JSON) return;
  console.log("\n── Phase 11 registry hints (diagnostic only) ──");
  console.log(
    "  NOTE: attack.png HIGH_SOLE_FLOAT is intentional flying-headbutt art — do not sole-correct."
  );
  for (const s of sprites) {
    if (s.missing || s.empty) continue;
    const solePct = s.height ? s.soleFromBottom / s.height : 0;
    const floatWorld =
      (solePct - 0.021) * (1280 * 0.123);
    if (Math.abs(floatWorld) > 8 || (s.flags || []).includes("HIGH_SOLE_FLOAT")) {
      const intentional =
        s.file === "attack.png" ? " [INTENTIONAL_AIRBORNE]" : "";
      console.log(
        `  ${s.file}: sole%=${(solePct * 100).toFixed(1)} estFloatWorld=${floatWorld.toFixed(1)} flags=${(s.flags || []).join("|") || "—"}${intentional}`
      );
    }
  }
}

const WANT_JSON = process.argv.includes("--json");
const WANT_VIZ = process.argv.includes("--viz");

async function analyzeSprite(file) {
  const full = path.join(ASSETS, file);
  if (!fs.existsSync(full)) {
    return { file, missing: true };
  }

  const meta = await sharp(full).metadata();
  const { data, info } = await sharp(full)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > ALPHA_THRESHOLD) {
        count++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return {
      file,
      width: meta.width,
      height: meta.height,
      empty: true,
    };
  }

  const canvasCx = (info.width - 1) / 2;
  const canvasCy = (info.height - 1) / 2;
  // Sprites face left; forward tip = leftmost opaque column from canvas center.
  const tipFromCenterPx = canvasCx - minX;
  const rearFromCenterPx = maxX - canvasCx;
  const soleFromBottom = info.height - 1 - maxY;
  const padL = minX;
  const padR = info.width - 1 - maxX;
  const padT = minY;
  const padB = soleFromBottom;
  const opaqueW = maxX - minX + 1;
  const opaqueH = maxY - minY + 1;
  const centroidX = sumX / count;
  const centroidY = sumY / count;
  const tipWorldGuess = tipFromCenterPx * (SPRITE_PX_TO_WORLD * (DESIGN_CANVAS / info.width));

  return {
    file,
    missing: false,
    empty: false,
    width: meta.width,
    height: meta.height,
    is960: meta.width === 960 && meta.height === 960,
    opaque: { w: opaqueW, h: opaqueH, minX, minY, maxX, maxY },
    padding: { left: padL, right: padR, top: padT, bottom: padB },
    soleY: maxY,
    soleFromBottom: padB,
    frontX: minX,
    rearX: maxX,
    tipFromCenterPx: Math.round(tipFromCenterPx * 10) / 10,
    rearFromCenterPx: Math.round(rearFromCenterPx * 10) / 10,
    tipWorldGuessPx: Math.round(tipWorldGuess * 10) / 10,
    centroid: {
      x: Math.round(centroidX * 10) / 10,
      y: Math.round(centroidY * 10) / 10,
      biasX: Math.round((centroidX - canvasCx) * 10) / 10,
      biasY: Math.round((centroidY - canvasCy) * 10) / 10,
    },
    alphaPx: count,
    groundedLikely: padB <= 45 && padB >= 10,
    flags: [],
  };
}

function flagIssues(row, allSoleBottoms) {
  const flags = [];
  if (row.missing) {
    flags.push("MISSING");
    return flags;
  }
  if (row.empty) {
    flags.push("EMPTY_ALPHA");
    return flags;
  }
  if (!row.is960) flags.push(`NON_960_${row.width}x${row.height}`);
  if (row.padding.bottom > 60) flags.push("HIGH_SOLE_FLOAT");
  if (row.padding.bottom < 8) flags.push("SOLE_NEAR_EDGE");
  if (Math.abs(row.centroid.biasX) > 40) flags.push("STRONG_H_BIAS");
  if (row.padding.left < 5 || row.padding.right < 5) flags.push("EDGE_CLIP_RISK");
  if (row.opaque.w / row.width > 0.95) flags.push("NEAR_FULL_WIDTH");
  const medianSole =
    allSoleBottoms.slice().sort((a, b) => a - b)[
      Math.floor(allSoleBottoms.length / 2)
    ] || 30;
  if (Math.abs(row.padding.bottom - medianSole) > 40) {
    flags.push("SOLE_OUTLIER_VS_MEDIAN");
  }
  return flags;
}

async function writeViz(row) {
  if (row.missing || row.empty) return;
  const outDir = path.join(__dirname, "pose-geometry-viz");
  fs.mkdirSync(outDir, { recursive: true });
  const full = path.join(ASSETS, row.file);
  const base = await sharp(full).ensureAlpha().png().toBuffer();
  const { width, height } = row;
  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#666" stroke-width="2"/>
      <rect x="${row.opaque.minX}" y="${row.opaque.minY}" width="${row.opaque.w}" height="${row.opaque.h}"
            fill="none" stroke="#00e676" stroke-width="2"/>
      <line x1="0" y1="${row.soleY}" x2="${width}" y2="${row.soleY}" stroke="#ffeb3b" stroke-width="2"/>
      <line x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}" stroke="#29b6f6" stroke-width="1" stroke-dasharray="6 4"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="6" fill="#29b6f6"/>
      <circle cx="${row.centroid.x}" cy="${row.centroid.y}" r="6" fill="#ff7043"/>
      <circle cx="${row.frontX}" cy="${(row.opaque.minY + row.opaque.maxY) / 2}" r="5" fill="#e040fb"/>
      <text x="12" y="28" fill="#fff" font-size="20" font-family="monospace">${row.file}</text>
    </svg>
  `);
  const out = path.join(outDir, row.file.replace(/\.png$/i, "-audit.png"));
  await sharp(base)
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toFile(out);
}

async function main() {
  const rows = [];
  for (const file of GAMEPLAY_SPRITES) {
    rows.push(await analyzeSprite(file));
  }
  const soleBottoms = rows
    .filter((r) => !r.missing && !r.empty)
    .map((r) => r.padding.bottom);
  for (const row of rows) {
    row.flags = flagIssues(row, soleBottoms);
  }

  if (WANT_VIZ) {
    for (const row of rows) {
      await writeViz(row);
    }
  }

  // Tip comparison for key contact poses (960 canvases; sprites face left).
  const tipCompare = {
    "slap-attack-1-hit-frame.png": { key: "slap1", measured: null },
    "slap-attack-2-hit-frame.png": { key: "slap2", measured: null },
    "attack.png": { key: "charged", measured: null },
    "palm-thrust.png": { key: "palm", measured: null },
  };
  for (const row of rows) {
    if (tipCompare[row.file] && !row.missing && !row.empty) {
      tipCompare[row.file].measured = row.tipFromCenterPx;
      tipCompare[row.file].live = LIVE_TIP_CONSTANTS[tipCompare[row.file].key];
      tipCompare[row.file].delta =
        Math.round((row.tipFromCenterPx - LIVE_TIP_CONSTANTS[tipCompare[row.file].key]) * 10) /
        10;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    alphaThreshold: ALPHA_THRESHOLD,
    spritePxToWorld: SPRITE_PX_TO_WORLD,
    designAssumptions: {
      canvas: DESIGN_CANVAS,
      displayWidthFrac: DISPLAY_WIDTH_FRAC,
      designWidth: DESIGN_WIDTH,
      note: "Server strikeContact uses SPRITE_PX_TO_WORLD = (1280*0.123)/960 regardless of actual PNG size.",
    },
    tipConstantComparison: tipCompare,
    summary: {
      total: rows.length,
      missing: rows.filter((r) => r.missing).length,
      non960: rows.filter((r) => !r.missing && !r.empty && !r.is960).length,
      highSoleFloat: rows.filter((r) => r.flags.includes("HIGH_SOLE_FLOAT")).length,
      soleOutliers: rows.filter((r) => r.flags.includes("SOLE_OUTLIER_VS_MEDIAN")).length,
    },
    sprites: rows,
  };

  if (WANT_JSON) {
    process.stdout.write(JSON.stringify(report, null, 2));
    return;
  }

  console.log("=== PUMO PUMO Pose Geometry Audit ===");
  console.log(`Sprites scanned: ${report.summary.total}`);
  console.log(`Missing: ${report.summary.missing}`);
  console.log(`Non-960: ${report.summary.non960}`);
  console.log(`High sole float: ${report.summary.highSoleFloat}`);
  console.log(`Sole outliers: ${report.summary.soleOutliers}`);
  console.log(`SPRITE_PX_TO_WORLD: ${SPRITE_PX_TO_WORLD.toFixed(6)}`);
  console.log("\n--- Tip constant vs measured (960 hit poses) ---");
  for (const [file, t] of Object.entries(tipCompare)) {
    console.log(
      `${file}: measured=${t.measured} live=${t.live} delta=${t.delta}`
    );
  }
  console.log("\n--- Per-sprite ---");
  for (const row of rows) {
    if (row.missing) {
      console.log(`MISSING  ${row.file}`);
      continue;
    }
    if (row.empty) {
      console.log(`EMPTY    ${row.file} ${row.width}x${row.height}`);
      continue;
    }
    console.log(
      [
        row.is960 ? "960" : `${row.width}x${row.height}`,
        row.file.padEnd(36),
        `opaque=${row.opaque.w}x${row.opaque.h}`,
        `padB=${row.padding.bottom}`,
        `tip=${row.tipFromCenterPx}`,
        `biasX=${row.centroid.biasX}`,
        row.flags.length ? `FLAGS=${row.flags.join(",")}` : "ok",
      ].join(" | ")
    );
  }
  emitRegistryHints(rows);
  if (WANT_VIZ) {
    console.log("\nVisualization sheets written to tools/pose-geometry-viz/");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
