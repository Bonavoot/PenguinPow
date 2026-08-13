#!/usr/bin/env node
/**
 * Phase 4 — regenerate display-tier assets from masters.
 *
 *   node client/scripts/encodeDisplayAssets.mjs
 *
 * Requires: sharp (client dep), ffmpeg on PATH for audio.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bakeArenaPresentation } from "./bake-arena-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, "..");
const SOUNDS = path.join(CLIENT, "src/sounds");

const BATTLE_WAVS = [
  "battle-music-sound.wav",
  "battle-music-sound-2.wav",
  "battle-music-sound-3.wav",
];

function kb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

async function encodeMap() {
  await bakeArenaPresentation();
}

function encodeBattleMusic() {
  for (const wav of BATTLE_WAVS) {
    const src = path.join(SOUNDS, wav);
    const out = path.join(SOUNDS, wav.replace(/\.wav$/i, ".ogg"));
    if (!fs.existsSync(src)) {
      console.warn(`skip missing ${wav}`);
      continue;
    }
    const r = spawnSync(
      "ffmpeg",
      ["-y", "-i", src, "-c:a", "libvorbis", "-q:a", "4", out],
      { encoding: "utf8" },
    );
    if (r.status !== 0) {
      throw new Error(`ffmpeg failed for ${wav}: ${r.stderr?.slice(-400)}`);
    }
    console.log(
      `music: ${wav} → ${path.basename(out)} — ${kb(fs.statSync(src).size)} → ${kb(fs.statSync(out).size)}`,
    );
  }
}

await encodeMap();
encodeBattleMusic();
console.log("encodeDisplayAssets: done");
