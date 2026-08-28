#!/usr/bin/env node
/**
 * Phase 4 static regression checks (audio / images / packaging).
 * Usage: node client/scripts/perf/phase4Regression.mjs
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

function size(rel) {
  return fs.statSync(path.join(ROOT, rel)).size;
}

// 1. Display map is WebP and wired into CSS / preloads
{
  assert.ok(exists("client/src/assets/game-map-444.webp"), "missing game-map-444.webp");
  const webp = size("client/src/assets/game-map-444.webp");
  assert.ok(webp < 2 * 1024 * 1024, `map webp too large: ${webp}`);
  const css = read("client/src/App.css");
  assert.ok(
    /game-map-444\.webp/.test(css),
    "App.css should use game-map-444.webp",
  );
  assert.ok(
    !/game-map-444\.png/.test(css),
    "App.css should not reference game-map-444.png",
  );
  const assets = read("client/src/components/fighterAssets.js");
  assert.ok(
    /game-map-444\.webp/.test(assets),
    "fighterAssets should preload webp map",
  );
  console.log(`ok - display map webp (${(webp / 1024).toFixed(0)} KB)`);
}

// 2. Battle music is streamed (not AudioBuffer-preloaded)
{
  const battleOgg = "client/src/sounds/battle-music.ogg";
  assert.ok(exists(battleOgg), "missing battle-music.ogg");

  const assets = read("client/src/components/fighterAssets.js");
  assert.ok(/battle-music\.ogg/.test(assets), "battle music imports ogg");
  assert.ok(
    /preloadMusicTracks\s*\(\s*\[\s*battleMusic\s*\]\s*\)/.test(assets),
    "battle track uses preloadMusicTracks",
  );
  const preloadBlock = assets.match(/preloadSounds\(\[([\s\S]*?)\]\)/);
  assert.ok(preloadBlock, "preloadSounds block missing");
  assert.ok(
    !/\bbattleMusic\b/.test(preloadBlock[1]),
    "battleMusic must not be decode-preloaded",
  );

  const engine = read("client/src/utils/audioEngine.js");
  assert.ok(/createStreamedCrossfadeLoop/.test(engine), "streamed loop present");
  assert.ok(/preloadMusicTracks/.test(engine), "preloadMusicTracks exported");
  console.log("ok - battle music streamed (not decode-preloaded)");
}

// 3. Match preload uses dohyo-display, not 6MB style
{
  const assets = read("client/src/components/fighterAssets.js");
  assert.ok(
    /dohyo-display\.webp/.test(assets),
    "fighterAssets should preload dohyo-display",
  );
  assert.ok(
    !/from ["'].*dohyo-style\.webp["']/.test(assets),
    "fighterAssets should not import dohyo-style for match preload",
  );
  console.log("ok - dohyo match preload is display bake");
}

// 4. Packaging excludes + async debugLog
{
  const pkg = read("package.json");
  assert.ok(/!server-io\/test\/\*\*/.test(pkg), "electron-builder excludes tests");
  const main = read("main.js");
  assert.ok(
    /fs\.appendFile\s*\(/.test(main),
    "debugLog uses async fs.appendFile",
  );
  assert.ok(
    !/fs\.appendFileSync\s*\(/.test(main),
    "debugLog must not call fs.appendFileSync",
  );
  assert.ok(/VERBOSE_DEBUG|PENGUINPOW_DEBUG/.test(main), "debug gate present");
  console.log("ok - packaging excludes + async debugLog");
}

// 5. Encode script exists
{
  assert.ok(
    exists("client/scripts/encodeDisplayAssets.mjs"),
    "encodeDisplayAssets.mjs missing",
  );
  console.log("ok - encodeDisplayAssets script present");
}

console.log("\nPhase 4 regression: checks passed");
