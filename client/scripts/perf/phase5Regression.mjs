#!/usr/bin/env node
/**
 * Phase 5 static regression checks (network / server capacity).
 * Usage: node client/scripts/perf/phase5Regression.mjs
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

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// 1. Server stamps seq/simTime/keyframes
{
  const constants = read("server-io/constants.js");
  assert.ok(
    /KEYFRAME_EVERY_N_BROADCASTS/.test(constants),
    "KEYFRAME_EVERY_N_BROADCASTS defined",
  );
  const broadcast = read("server-io/fighterBroadcast.js");
  assert.ok(/buildFighterActionPacket/.test(broadcast), "packet builder present");
  assert.ok(/isKeyframe/.test(broadcast), "keyframe flag");
  assert.ok(/\bseq\b/.test(broadcast), "seq on packet");
  assert.ok(/simTime/.test(broadcast), "simTime on packet");
  const index = read("server-io/index.js");
  assert.ok(
    /buildFighterActionPacket/.test(index),
    "tick loop uses packet builder",
  );
  const handlers = read("server-io/socketHandlers.js");
  assert.ok(
    /request_fighter_resync/.test(handlers),
    "resync handler registered",
  );
  console.log("ok - server seq/keyframe/resync");
}

// 2. Client shared bus + resync
{
  assert.ok(
    exists("client/src/net/fighterSnapshotBus.js"),
    "fighterSnapshotBus missing",
  );
  const bus = read("client/src/net/fighterSnapshotBus.js");
  assert.ok(/mergeFighterPacket/.test(bus), "merge exported");
  assert.ok(/requestFighterResync/.test(bus), "resync helper");
  assert.ok(/seq_gap|net\.seqGap/.test(bus), "gap telemetry");

  const gf = read("client/src/components/GameFighter.jsx");
  assert.ok(
    /fighterSnapshotBus/.test(gf),
    "GameFighter uses snapshot bus",
  );
  assert.ok(
    !/const sharedFighterState = \{/.test(gf),
    "GameFighter must not own a private accumulator",
  );
  assert.ok(
    /subscribeFighterSnapshot/.test(gf),
    "GameFighter subscribes to bus fan-out",
  );
  assert.ok(
    !/socket\.on\(\s*["']fighter_action["']/.test(gf),
    "GameFighter must not socket.on fighter_action directly",
  );

  const cam = read("client/src/hooks/useCamera.js");
  assert.ok(/subscribeFighterSnapshot/.test(cam), "useCamera subscribes to bus");
  assert.ok(
    !/socket\.on\(\s*["']fighter_action["']/.test(cam),
    "useCamera must not socket.on fighter_action",
  );
  const tech = read("client/src/components/ThrowTechEffect.jsx");
  assert.ok(
    /subscribeFighterSnapshot/.test(tech),
    "ThrowTechEffect subscribes to bus",
  );
  const game = read("client/src/components/Game.jsx");
  assert.ok(
    /requestFighterResync/.test(game),
    "Game requests resync on visibility",
  );
  assert.ok(
    /retainFighterSocket/.test(game),
    "Game retains single fighter_action socket owner",
  );
  assert.ok(/retainFighterSocket/.test(bus), "retainFighterSocket exported");
  console.log("ok - client snapshot bus + visibility resync + fan-out");
}

// 3. No naive volatile deltas
{
  const serverJs = [
    "server-io/index.js",
    "server-io/fighterBroadcast.js",
    "server-io/socketHandlers.js",
  ];
  for (const rel of serverJs) {
    const src = read(rel);
    assert.ok(
      !/\.volatile\b/.test(src),
      `${rel} must not use volatile emits`,
    );
  }
  console.log("ok - no volatile fighter snapshots");
}

// 4. Load harness is measured (not scaffold-only)
{
  const harness = read("server-io/scripts/roomLoadBaseline.mjs");
  assert.ok(/measured_synthetic|buildFighterActionPacket/.test(harness));
  assert.ok(!/scaffold_only/.test(harness), "harness must not be scaffold-only");
  console.log("ok - room load harness measures synthetic capacity");
}

// 5. Post-5 soak + dohyo-style not in always-loaded CSS
{
  assert.ok(
    exists("server-io/scripts/liveRoomSoak.mjs"),
    "liveRoomSoak.mjs missing",
  );
  const css = read("client/src/App.css");
  assert.ok(
    !/url\([^)]*dohyo-style\.webp/.test(css),
    "App.css must not url() dohyo-style.webp",
  );
  const crowd = read("client/src/components/CrowdLayer.jsx");
  assert.ok(/lazy\(\s*\(\s*\)\s*=>\s*import\(\s*["'].*CrowdEditor/.test(crowd),
    "CrowdEditor should be lazy-loaded");
  console.log("ok - live soak script + dohyo-style lazy path");
}

console.log("\nPhase 5 regression: checks passed");
