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
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, "..");
const ASSETS = path.join(CLIENT, "src/assets");
const SOUNDS = path.join(CLIENT, "src/sounds");

const MAP_SRC = path.join(ASSETS, "game-map-444.png");
const MAP_OUT = path.join(ASSETS, "game-map-444.webp");
const MAP_W = 3840;
const MAP_H = 2560;

const BATTLE_WAVS = [
  "battle-music-sound.wav",
  "battle-music-sound-2.wav",
  "battle-music-sound-3.wav",
];

function kb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

async function encodeMap() {
  if (!fs.existsSync(MAP_SRC)) {
    throw new Error(`missing map master: ${MAP_SRC}`);
  }
  await sharp(MAP_SRC)
    .resize(MAP_W, MAP_H, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 88, effort: 5, smartSubsample: true })
    .toFile(MAP_OUT);
  const before = fs.statSync(MAP_SRC).size;
  const after = fs.statSync(MAP_OUT).size;
  console.log(
    `map: ${MAP_W}×${MAP_H} webp q88 — ${kb(before)} → ${kb(after)}`,
  );
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
