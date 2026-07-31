#!/usr/bin/env node
/**
 * Phase 1 static + unit regression checks (no browser).
 *
 * - Cosmetic BODY_SRCS ↔ stem alignment + FLAP stems
 * - No toDataURL in compositeHatOntoSpriteSync
 * - No nested requestAnimationFrame in preload Step 6
 * - assetReadiness completes without rAF (visibility-safe)
 * - FLAP/slide-jump pose stems exist for every head-gear table
 *
 * Usage: node client/scripts/perf/phase1Regression.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { awaitDecodedReadiness, yieldHiddenSafe } from "../../src/utils/assetReadiness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ── 1. Cosmetic mapping (delegate) ───────────────────────────────────
{
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, "validateCosmeticMappings.mjs")],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);
  console.log("ok - cosmetic mappings / FLAP stems");
}

// ── 2. Hat pipeline: async uses toBlob; sync may warm-miss encode ─────
{
  const src = read("client/src/utils/hatComposite.js");
  const syncFn = src.match(
    /export function compositeHatOntoSpriteSync\([\s\S]*?\n\}/,
  );
  assert.ok(syncFn, "compositeHatOntoSpriteSync not found");
  // Cache hit must not be gated on getDecodedImage returning null (stall bug)
  assert.ok(
    !/if \(!getDecodedImage\(hit\)\) \{\s*recordHatPath\("cachedTopperCold"/.test(
      syncFn[0],
    ),
    "cache hits must not return null when decoded lookup misses",
  );
  assert.ok(
    /getCachedHatComposite/.test(syncFn[0]),
    "sync path should check composite cache first",
  );
  // Async store path must use toBlob, not only toDataURL
  assert.ok(
    /canvasToBlobUrl|toBlob/.test(src),
    "async composite path should use toBlob",
  );
  console.log("ok - hat sync cache hits are non-blocking; async uses toBlob");
}

// ── 3. Preload Step 6 must not nest rAF ──────────────────────────────
{
  const src = read("client/src/context/PlayerColorContext.jsx");
  assert.ok(
    /awaitDecodedReadiness/.test(src),
    "preload must use awaitDecodedReadiness",
  );
  // The old triple-rAF pattern
  const tripleRaf =
    /requestAnimationFrame\(\s*\(\)\s*=>\s*\{\s*requestAnimationFrame\(\s*\(\)\s*=>\s*\{\s*requestAnimationFrame/;
  assert.ok(
    !tripleRaf.test(src),
    "PlayerColorContext must not use triple nested requestAnimationFrame",
  );
  console.log("ok - preload Step 6 is visibility-safe (no triple-rAF)");
}

// ── 4. assetReadiness unit test (no rAF) ─────────────────────────────
{
  const ready = new Set(["a", "b"]);
  const getDecoded = (src) =>
    ready.has(src)
      ? { complete: true, naturalWidth: 10, naturalHeight: 10 }
      : null;

  const t0 = Date.now();
  const immediate = await awaitDecodedReadiness(["a", "b"], getDecoded, {
    timeoutMs: 500,
    pollMs: 10,
  });
  assert.equal(immediate.ok, true);
  assert.ok(Date.now() - t0 < 100);

  let flips = 0;
  const getLate = (src) => {
    if (src === "cold" && flips < 2) {
      flips++;
      return null;
    }
    return { complete: true, naturalWidth: 1, naturalHeight: 1 };
  };
  const late = await awaitDecodedReadiness(["cold"], getLate, {
    timeoutMs: 500,
    pollMs: 10,
  });
  assert.equal(late.ok, true);
  assert.ok(late.ms >= 10);

  await yieldHiddenSafe(5);
  console.log("ok - awaitDecodedReadiness (timer-based, no rAF)");
}

// ── 5. FLAP / slide-jump torture pose list completeness ──────────────
{
  const src = read("client/src/config/cosmetics.js");
  const TORTURE_STEMS = [
    "sliding",
    "dodging",
    "pumo-flap-1",
    "pumo-flap-2",
    "recovering",
    "pumo-idle",
    "attack",
  ];
  for (const table of [
    "TOP_HAT_BY_STEM",
    "CROWN_BY_STEM",
    "HALO_BY_STEM",
    "PLUNGER_BY_STEM",
    "PONYTAIL_BY_STEM",
  ]) {
    for (const stem of TORTURE_STEMS) {
      const re = new RegExp(
        `const ${table} = \\{[\\s\\S]*?["']?${stem.replace(
          /-/g,
          "\\-",
        )}["']?\\s*:`,
      );
      assert.ok(re.test(src), `${table} missing torture stem ${stem}`);
    }
  }
  console.log("ok - FLAP/slide-jump torture stems on all gear tables");
}

// ── 6. GameFighter must advance pose (no hold-last-good stall) ───────
{
  const src = read("client/src/components/GameFighter.jsx");
  assert.ok(
    /resolveHattedSpriteSync|compositeHatOntoSpriteSync/.test(src),
    "GameFighter still uses sync hatted resolve helper",
  );
  assert.ok(
    !/lastGoodHattedRef|holdLastGoodHatted/.test(src),
    "hold-last-good removed — it stalled FLAP/slide pose swaps",
  );
  assert.ok(
    /validHatted \|\| recoloredSpriteSrc/.test(src),
    "staticBodySrc must advance with pose when hat composite is late",
  );
  console.log("ok - GameFighter advances pose (no hold-last-good stall)");
}

// ── 7. Rewarm single-flight ──────────────────────────────────────────
{
  const src = read("client/src/utils/SpriteRecolorizer.js");
  assert.ok(
    /return _rewarmInFlight/.test(src),
    "rewarmDecodedImages must return in-flight promise (single-flight)",
  );
  assert.ok(
    /failedDecodeKeys/.test(src),
    "decode failure set must exist",
  );
  assert.ok(
    /Do NOT insert into decodedImageCache/.test(src) ||
      /failed ≠ ready|failedDecodeKeys\.add/.test(src),
    "failed decodes must not be marked ready",
  );
  console.log("ok - rewarm single-flight + explicit decode failures");
}

console.log("\nPhase 1 regression: all checks passed");
