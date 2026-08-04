#!/usr/bin/env node
/**
 * Development-only coverage audit for authored HIT / HURT_LIMB rectangles.
 *
 * Answers, without moving anything: does the authored rectangle cover the art it
 * claims to, on BOTH the forward and vertical axes? The forward answer is the
 * skin epsilon (box outer − art outer). The vertical answer compares the box's
 * up-span against the vertical span of the art that actually protrudes past the
 * body, which is the only art an opponent could visibly "pass through".
 *
 * Read-only. Usage (repo root): node tools/audit-limb-coverage.js
 */

const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "client/src/assets");
const catalog = require(path.join(ROOT, "shared/combatVolumeAuthored.json"));

const ALPHA_THRESHOLD = 16;
const DESIGN_CANVAS = 960;
const SPRITE_PX_TO_WORLD = (1280 * 0.123) / DESIGN_CANVAS;
const SOLE_FRAC_FROM_BOTTOM = 0.021;
/** Size-1 pushbox half — art past this is unambiguously outside the body. */
const PROTRUDE_THRESHOLD = 65;

const TARGETS = [
  { pose: "slap_active", variant: "1", label: "tip_rail_slap", kind: "HIT", file: "slap-attack-1-hit-frame.png" },
  { pose: "slap_active", variant: "2", label: "tip_rail_slap", kind: "HIT", file: "slap-attack-2-hit-frame.png" },
  { pose: "slap_active", variant: "1", label: "frontArm", kind: "HURT_LIMB", file: "slap-attack-1-hit-frame.png" },
  { pose: "slap_active", variant: "2", label: "frontArm", kind: "HURT_LIMB", file: "slap-attack-2-hit-frame.png" },
  { pose: "palm_active", variant: null, label: "tip_rail_palm", kind: "HIT", file: "palm-thrust.png" },
  { pose: "palm_active", variant: null, label: "frontArm", kind: "HURT_LIMB", file: "palm-thrust.png" },
  { pose: "palm_recovery", variant: "true", label: "frontArm", kind: "HURT_LIMB", file: "palm-thrust.png" },
  { pose: "palm_recovery", variant: null, label: "frontArm", kind: "HURT_LIMB", file: "palm-thrust-startup.png" },
];

function findRegion(poseKey, variant, label, kind) {
  const pose = catalog.poses[poseKey];
  if (!pose) return null;
  const pick = (list) =>
    (list || []).find((r) => (r.label || r.region) === label && r.kind === kind);
  if (variant != null && pose.variants && pose.variants[variant]) {
    const v = pose.variants[variant];
    const hit = pick(v.regionOverrides) || pick(v.regions);
    if (hit) return hit;
  }
  return pick(pose.regions);
}

async function measure(file) {
  const { data, info } = await sharp(path.join(ASSETS, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pxScale = DESIGN_CANVAS / info.width;
  const canvasCx = info.width / 2;
  const soleY = info.height * (1 - SOLE_FRAC_FROM_BOTTOM);
  const rows = [];
  for (let y = 0; y < info.height; y++) {
    let minX = -1;
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        minX = x;
        break;
      }
    }
    if (minX === -1) continue;
    rows.push({
      up: (soleY - y) * pxScale * SPRITE_PX_TO_WORLD,
      outer: (canvasCx - minX) * pxScale * SPRITE_PX_TO_WORLD,
    });
  }
  return rows;
}

(async () => {
  const cache = new Map();
  for (const t of TARGETS) {
    const r = findRegion(t.pose, t.variant, t.label, t.kind);
    const name = `${t.pose}${t.variant ? `/${t.variant}` : ""} ${t.kind}`;
    if (!r) {
      console.log(`${name}: (no authored region)\n`);
      continue;
    }
    if (!cache.has(t.file)) cache.set(t.file, await measure(t.file));
    const rows = cache.get(t.file);

    const boxOuter = r.forward + r.halfW;
    const boxInner = r.forward - r.halfW;
    const boxTop = r.up + r.halfH;
    const boxBottom = r.up - r.halfH;

    const inBand = rows.filter((q) => q.up >= boxBottom && q.up <= boxTop);
    const artOuter = inBand.length ? Math.max(...inBand.map((q) => q.outer)) : null;

    // Art that protrudes past the body silhouette — the visible limb itself.
    const protruding = rows.filter((q) => q.outer > PROTRUDE_THRESHOLD);
    const pTop = protruding.length ? Math.max(...protruding.map((q) => q.up)) : null;
    const pBottom = protruding.length ? Math.min(...protruding.map((q) => q.up)) : null;
    const uncovered = protruding.filter((q) => q.up > boxTop || q.up < boxBottom);
    const worstUncovered = uncovered.length
      ? Math.max(...uncovered.map((q) => q.outer))
      : null;

    console.log(
      `${name.padEnd(30)} box fwd[${boxInner.toFixed(2)}..${boxOuter.toFixed(
        2
      )}] up[${boxBottom.toFixed(2)}..${boxTop.toFixed(2)}]  (${t.file})`
    );
    console.log(
      `    forward: art outer in-band=${
        artOuter != null ? artOuter.toFixed(3) : "—"
      }  skinEpsilon=${
        artOuter != null ? (boxOuter - artOuter).toFixed(3) : "—"
      }`
    );
    console.log(
      `    vertical: protruding art (>${PROTRUDE_THRESHOLD}) spans up[${
        pBottom != null ? pBottom.toFixed(2) : "—"
      }..${pTop != null ? pTop.toFixed(2) : "—"}]  uncoveredRows=${
        uncovered.length
      }/${protruding.length}${
        worstUncovered != null
          ? `  deepestUncovered=${worstUncovered.toFixed(3)}`
          : ""
      }`
    );
    console.log("");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
