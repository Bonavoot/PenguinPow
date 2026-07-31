#!/usr/bin/env node
/**
 * Phase 2 static regression checks.
 * Usage: node client/scripts/perf/phase2Regression.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HAT_GEAR_IDS,
  HAT_POSE_SOURCES,
  hatBakeKey,
  overlayFileFor,
} from "../../src/config/bakeHatSources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const ASSETS = path.join(ROOT, "client/src/assets");
const MANIFEST = path.join(ROOT, "client/public/baked/manifest.json");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// 1. Overlay + body files exist for combat poses
{
  let missing = 0;
  for (const pose of HAT_POSE_SOURCES.filter((p) => !p.menuOnly)) {
    const body = path.join(ASSETS, pose.bodyFile);
    assert.ok(fs.existsSync(body), `missing body ${pose.bodyFile}`);
    for (const gearId of HAT_GEAR_IDS) {
      const ov = overlayFileFor(gearId, pose.hairedStem);
      if (!fs.existsSync(path.join(ASSETS, ov))) {
        console.warn("missing overlay", ov);
        missing++;
      }
    }
  }
  assert.equal(missing, 0, `${missing} missing overlays`);
  console.log("ok - hat pose body/overlay files present");
}

// 2. Runtime prefers baked resolve
{
  const hat = read("client/src/utils/hatComposite.js");
  assert.ok(/getBakedHattedSprite/.test(hat), "hatComposite uses baked hats");
  assert.ok(/resolveHattedSpriteSync/.test(hat), "resolveHattedSpriteSync exported");
  const gf = read("client/src/components/GameFighter.jsx");
  assert.ok(/resolveHattedSpriteSync/.test(gf), "GameFighter uses resolveHattedSpriteSync");
  console.log("ok - runtime wired to baked toppers");
}

// 3. Byte budget exists
{
  const src = read("client/src/utils/SpriteRecolorizer.js");
  assert.ok(/MAX_DECODED_BYTES/.test(src), "decoded byte budget present");
  console.log("ok - decoded byte budget present");
}

// 4. Manifest hats (if bake has been run)
{
  if (!fs.existsSync(MANIFEST)) {
    console.log("skip - no baked manifest yet (run npm run bake)");
  } else {
    const json = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    assert.ok(json.hats, "manifest.hats missing — rebake with v2-hats");
    const keys = Object.keys(json.hats);
    assert.ok(keys.length > 100, `expected many hat entries, got ${keys.length}`);
    // Spot-check FLAP + top_hat + default-ish key shape
    const sample = hatBakeKey(
      "top_hat",
      "pumo-flap-1-bald",
      "#da1b44",
      null,
      "base",
    );
    // May or may not include this exact combo; at least key format matches
    assert.ok(sample.startsWith("hat|top_hat|pumo-flap-1-bald|"));
    const flapKeys = keys.filter((k) => k.includes("pumo-flap-1-bald"));
    assert.ok(flapKeys.length > 0, "no baked flap-1 hat entries");
    console.log(
      `ok - manifest hats=${keys.length} flap1Entries=${flapKeys.length} version=${json.version}`,
    );
  }
}

console.log("\nPhase 2 regression: checks passed");
