/**
 * Ensures public/baked exists before vite build.
 *
 * Priority when SKIP_BAKE=1 or NETLIFY=true (and FORCE_BAKE is unset):
 *   1. Download BAKE_ARCHIVE_URL (GitHub Release tarball) into public/baked
 *   2. Reuse an existing local public/baked/manifest.json
 *   3. Fail with a clear message (never run the full hat bake on Netlify)
 *
 * Local `npm run build` (no SKIP_BAKE) still runs `npm run bake`.
 * Force bake anywhere: FORCE_BAKE=1.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.join(__dirname, "..");
const BAKED_DIR = path.join(CLIENT_ROOT, "public/baked");
const MANIFEST = path.join(BAKED_DIR, "manifest.json");

function logManifest(prefix) {
  try {
    const { generatedAt, bakeTag } = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    console.log(
      `${prefix}` +
        (generatedAt ? ` (${generatedAt}` : "") +
        (bakeTag ? `${generatedAt ? ", " : " ("}tag ${bakeTag}` : "") +
        (generatedAt || bakeTag ? ")" : "")
    );
  } catch {
    console.log(prefix);
  }
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts,
  });
  return result.status ?? 1;
}

function downloadAndExtract(url) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pumo-bake-"));
  const archivePath = path.join(tmpDir, "baked.tar.gz");

  console.log(`[bake] downloading archive:\n       ${url}`);
  const curlStatus = run("curl", [
    "-fL",
    "--retry",
    "3",
    "--retry-delay",
    "2",
    "-o",
    archivePath,
    url,
  ]);
  if (curlStatus !== 0) {
    console.error("[bake] download failed");
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return false;
  }

  fs.mkdirSync(path.join(CLIENT_ROOT, "public"), { recursive: true });
  // Replace any partial baked dir so extract is clean.
  fs.rmSync(BAKED_DIR, { recursive: true, force: true });

  // Archive layout: baked/manifest.json + baked/*.png|webp
  const tarStatus = run("tar", ["-xzf", archivePath, "-C", path.join(CLIENT_ROOT, "public")]);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (tarStatus !== 0) {
    console.error("[bake] extract failed");
    return false;
  }
  if (!fs.existsSync(MANIFEST)) {
    console.error(
      "[bake] archive extracted but public/baked/manifest.json is missing.\n" +
        "       Pack with: npm run bake:pack (from client/)"
    );
    return false;
  }
  logManifest("[bake] archive ready");
  return true;
}

const forceBake = process.env.FORCE_BAKE === "1";
const skipRequested =
  process.env.SKIP_BAKE === "1" || process.env.NETLIFY === "true";
const archiveUrl = (process.env.BAKE_ARCHIVE_URL || "").trim();

if (!forceBake && skipRequested) {
  if (archiveUrl) {
    if (!downloadAndExtract(archiveUrl)) process.exit(1);
    process.exit(0);
  }

  if (fs.existsSync(MANIFEST)) {
    logManifest("[bake] skipped — using local public/baked");
    process.exit(0);
  }

  console.error(
    "[bake] public/baked/manifest.json missing and BAKE_ARCHIVE_URL unset.\n" +
      "       For Netlify: pack with `npm run bake:pack`, upload baked.tar.gz as a\n" +
      "       GitHub Release asset, set BAKE_ARCHIVE_URL in netlify.toml.\n" +
      "       Locally: run `npm run bake`, or set FORCE_BAKE=1."
  );
  process.exit(1);
}

const result = spawnSync("npm", ["run", "bake"], {
  stdio: "inherit",
  cwd: CLIENT_ROOT,
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
