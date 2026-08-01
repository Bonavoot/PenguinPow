/**
 * Pack public/baked into dist-bake/baked.tar.gz for GitHub Release upload.
 *
 * Usage (from client/):
 *   npm run bake        # if assets are stale
 *   npm run bake:pack
 *
 * Then upload dist-bake/baked.tar.gz to a GitHub Release, e.g. tag bake-v2-hats,
 * and set BAKE_ARCHIVE_URL in netlify.toml to:
 *   https://github.com/<owner>/<repo>/releases/download/<tag>/baked.tar.gz
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.join(__dirname, "..");
const BAKED_DIR = path.join(CLIENT_ROOT, "public/baked");
const MANIFEST = path.join(BAKED_DIR, "manifest.json");
const OUT_DIR = path.join(CLIENT_ROOT, "dist-bake");
const OUT_FILE = path.join(OUT_DIR, "baked.tar.gz");

if (!fs.existsSync(MANIFEST)) {
  console.error(
    "[bake:pack] public/baked/manifest.json missing. Run `npm run bake` first."
  );
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(OUT_FILE)) fs.unlinkSync(OUT_FILE);

console.log("[bake:pack] creating", OUT_FILE);
const result = spawnSync(
  "tar",
  ["-czf", OUT_FILE, "-C", path.join(CLIENT_ROOT, "public"), "baked"],
  { stdio: "inherit" }
);

if ((result.status ?? 1) !== 0) {
  console.error("[bake:pack] tar failed");
  process.exit(result.status ?? 1);
}

const mb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
let meta = "";
try {
  const { generatedAt, bakeTag } = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  meta = ` (${generatedAt || "?"}, tag ${bakeTag || "?"})`;
} catch {
  /* ignore */
}

console.log(`[bake:pack] done: ${OUT_FILE} (${mb} MB)${meta}`);
console.log(
  "[bake:pack] upload to a GitHub Release, then set BAKE_ARCHIVE_URL in netlify.toml"
);
