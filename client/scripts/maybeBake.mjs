/**
 * Runs sprite bake before vite build, unless assets are already present for CI.
 *
 * Netlify times out regenerating thousands of hat WebPs. Commit `public/baked/`
 * and this script skips bake when NETLIFY=true (or SKIP_BAKE=1).
 *
 * Local `npm run build` still bakes by default. Force skip: SKIP_BAKE=1.
 * Force bake on Netlify: FORCE_BAKE=1.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(__dirname, "../public/baked/manifest.json");

const forceBake = process.env.FORCE_BAKE === "1";
const skipRequested =
  process.env.SKIP_BAKE === "1" || process.env.NETLIFY === "true";

if (!forceBake && skipRequested) {
  if (!fs.existsSync(MANIFEST)) {
    console.error(
      "[bake] public/baked/manifest.json missing.\n" +
        "       Run `npm run bake` locally, commit client/public/baked/, and redeploy.\n" +
        "       Or set FORCE_BAKE=1 (may exceed Netlify's build time limit)."
    );
    process.exit(1);
  }
  const { generatedAt, bakeTag } = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  console.log(
    `[bake] skipped — using committed public/baked` +
      (generatedAt ? ` (${generatedAt}` : "") +
      (bakeTag ? `, tag ${bakeTag}` : "") +
      (generatedAt || bakeTag ? ")" : "")
  );
  process.exit(0);
}

const result = spawnSync("npm", ["run", "bake"], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
