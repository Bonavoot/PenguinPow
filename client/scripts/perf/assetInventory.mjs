#!/usr/bin/env node
/**
 * Phase 0 — Static asset inventory for PUMO PUMO !
 *
 * Scans client/src/assets + client/src/sounds, reports compressed sizes,
 * PNG dimensions, and theoretical RGBA footprints. Writes JSON + markdown
 * under client/scripts/perf/out/.
 *
 * Usage: node client/scripts/perf/assetInventory.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const CLIENT_SRC = path.join(ROOT, "client/src");
const OUT_DIR = path.join(__dirname, "out");

const RASTER_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const AUDIO_EXT = new Set([".wav", ".mp3", ".ogg", ".m4a", ".aac", ".flac"]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function pngSize(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    if (buf.toString("ascii", 1, 4) !== "PNG") return null;
    if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function mb(n) {
  return Number((n / 1024 / 1024).toFixed(3));
}

function collect() {
  const dirs = [
    path.join(CLIENT_SRC, "assets"),
    path.join(CLIENT_SRC, "sounds"),
    path.join(CLIENT_SRC, "components"), // some icons live beside components
  ];
  const files = dirs.flatMap((d) => walk(d));

  const rasters = [];
  const audio = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const st = fs.statSync(file);
    if (RASTER_EXT.has(ext)) {
      const dim = ext === ".png" ? pngSize(file) : null;
      const decodedBytes = dim ? dim.w * dim.h * 4 : null;
      rasters.push({
        path: rel(file),
        ext,
        compressedBytes: st.size,
        width: dim?.w ?? null,
        height: dim?.h ?? null,
        decodedRgbaBytes: decodedBytes,
        flags: {
          backup: /backup|original|raw|pre-enhance|_old/i.test(file),
          bald: /\/bald\//i.test(file) || /-bald\./i.test(file),
          cosmetic: /cosmetics/i.test(file),
          mapOrDohyo: /game-map|dohyo|arena/i.test(path.basename(file)),
        },
      });
    } else if (AUDIO_EXT.has(ext)) {
      // Rough PCM estimate for WAV: file size is near 16-bit stereo payload;
      // decodeAudioData typically yields float32 → ~2× WAV payload for stereo 16-bit.
      const estimatedDecodedFloat =
        ext === ".wav" ? Math.round(st.size * 2) : null;
      audio.push({
        path: rel(file),
        ext,
        compressedBytes: st.size,
        estimatedDecodedFloatBytes: estimatedDecodedFloat,
        flags: {
          battleMusic: /battle-music/i.test(file),
          longForm: /battle-music|eeshi/i.test(file),
        },
      });
    }
  }

  rasters.sort((a, b) => b.compressedBytes - a.compressedBytes);
  audio.sort((a, b) => b.compressedBytes - a.compressedBytes);

  const sum = (arr, key) => arr.reduce((s, x) => s + (x[key] || 0), 0);

  const summary = {
    generatedAt: new Date().toISOString(),
    rasterCount: rasters.length,
    rasterCompressedMB: mb(sum(rasters, "compressedBytes")),
    rasterDecodedRgbaKnownMB: mb(sum(rasters, "decodedRgbaBytes")),
    audioCount: audio.length,
    audioCompressedMB: mb(sum(audio, "compressedBytes")),
    battleMusicCompressedMB: mb(
      sum(
        audio.filter((a) => a.flags.battleMusic),
        "compressedBytes",
      ),
    ),
    battleMusicEstimatedDecodedMB: mb(
      sum(
        audio.filter((a) => a.flags.battleMusic),
        "estimatedDecodedFloatBytes",
      ),
    ),
    backupOrAlternateCount: rasters.filter((r) => r.flags.backup).length,
    backupOrAlternateCompressedMB: mb(
      sum(
        rasters.filter((r) => r.flags.backup),
        "compressedBytes",
      ),
    ),
    baldCount: rasters.filter((r) => r.flags.bald).length,
    baldDecodedMB: mb(
      sum(
        rasters.filter((r) => r.flags.bald),
        "decodedRgbaBytes",
      ),
    ),
    cosmeticCount: rasters.filter((r) => r.flags.cosmetic).length,
    cosmeticCompressedMB: mb(
      sum(
        rasters.filter((r) => r.flags.cosmetic),
        "compressedBytes",
      ),
    ),
    cosmeticDecodedMB: mb(
      sum(
        rasters.filter((r) => r.flags.cosmetic),
        "decodedRgbaBytes",
      ),
    ),
    top25Compressed: rasters.slice(0, 25).map((r) => ({
      path: r.path,
      compressedMB: mb(r.compressedBytes),
      decodedMB: r.decodedRgbaBytes != null ? mb(r.decodedRgbaBytes) : null,
      size: r.width && r.height ? `${r.width}x${r.height}` : null,
    })),
  };

  return { summary, rasters, audio };
}

function toMarkdown(summary) {
  const lines = [
    "# Asset Inventory (static)",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Raster files | ${summary.rasterCount} |`,
    `| Raster compressed | ${summary.rasterCompressedMB} MB |`,
    `| Raster theoretical RGBA (known PNGs) | ${summary.rasterDecodedRgbaKnownMB} MB |`,
    `| Audio files | ${summary.audioCount} |`,
    `| Audio compressed | ${summary.audioCompressedMB} MB |`,
    `| Battle music compressed | ${summary.battleMusicCompressedMB} MB |`,
    `| Battle music estimated decoded float | ${summary.battleMusicEstimatedDecodedMB} MB |`,
    `| Bald bodies | ${summary.baldCount} (~${summary.baldDecodedMB} MB RGBA) |`,
    `| Cosmetic rasters | ${summary.cosmeticCount} (${summary.cosmeticCompressedMB} MB / ~${summary.cosmeticDecodedMB} MB RGBA) |`,
    `| Backup/alternate candidates | ${summary.backupOrAlternateCount} (${summary.backupOrAlternateCompressedMB} MB) |`,
    "",
    "## Top 25 largest rasters",
    "",
    `| Compressed | Decoded RGBA | Size | Path |`,
    `| --- | --- | --- | --- |`,
    ...summary.top25Compressed.map(
      (r) =>
        `| ${r.compressedMB} MB | ${r.decodedMB ?? "?"} MB | ${r.size ?? "?"} | \`${r.path}\` |`,
    ),
    "",
    "> Theoretical RGBA assumes every known PNG is decoded at once. Production",
    "> working set is measured separately by the runtime PerfRecorder.",
    "",
  ];
  return lines.join("\n");
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const data = collect();
  const jsonPath = path.join(OUT_DIR, "asset-inventory.json");
  const mdPath = path.join(OUT_DIR, "asset-inventory.md");
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(mdPath, toMarkdown(data.summary));
  console.log(toMarkdown(data.summary));
  console.log(`Wrote ${rel(jsonPath)}`);
  console.log(`Wrote ${rel(mdPath)}`);
}

main();
