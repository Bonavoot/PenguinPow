#!/usr/bin/env node
/**
 * Phase 3 static regression checks (client frame-time).
 * Usage: node client/scripts/perf/phase3Regression.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// 1. ParticleEngine sleeps when idle and wakes on spawn/emit
{
  const src = read("client/src/particles/ParticleEngine.js");
  assert.ok(/_goToSleep\s*\(/.test(src), "ParticleEngine has _goToSleep");
  assert.ok(/_wake\s*\(/.test(src), "ParticleEngine has _wake");
  assert.ok(/this\._sleeping/.test(src), "ParticleEngine tracks _sleeping");
  assert.ok(
    /spawn\s*\([^)]*\)\s*\{[\s\S]*?this\._wake\(\)/.test(src),
    "spawn() wakes the loop",
  );
  assert.ok(
    /emit\s*\([^)]*\)\s*\{[\s\S]*?this\._wake\(\)/.test(src),
    "emit() wakes the loop",
  );
  assert.ok(
    /_activeCount === 0 && this\._renderedEmpty/.test(src),
    "sleep gated on empty committed frame",
  );
  console.log("ok - ParticleEngine idle sleep/wake");
}

// 2. SnowEffect pauses while document is hidden
{
  const src = read("client/src/components/SnowEffect.jsx");
  assert.ok(
    /visibilitychange/.test(src),
    "SnowEffect listens for visibilitychange",
  );
  assert.ok(/document\.hidden/.test(src), "SnowEffect checks document.hidden");
  console.log("ok - SnowEffect visibility pause");
}

console.log("\nPhase 3 regression: checks passed");
