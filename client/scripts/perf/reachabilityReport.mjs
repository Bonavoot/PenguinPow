#!/usr/bin/env node
/**
 * Phase 0 — Production reachability / bundle report.
 *
 * 1. Walks client/src import graph from known entrypoints (static string imports).
 * 2. If client/dist exists, inventories hashed build outputs.
 *
 * This is a static approximation (dynamic import() / CSS url() covered separately).
 *
 * Usage: node client/scripts/perf/reachabilityReport.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const CLIENT = path.join(ROOT, "client");
const SRC = path.join(CLIENT, "src");
const DIST = path.join(CLIENT, "dist");
const OUT_DIR = path.join(__dirname, "out");

const CODE_EXT = [".js", ".jsx", ".mjs", ".ts", ".tsx", ".css", ".json"];
const ASSET_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ".wav",
  ".mp3",
  ".ogg",
  ".m4a",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
]);

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

function mb(n) {
  return Number((n / 1024 / 1024).toFixed(3));
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const base = spec.startsWith("/")
    ? path.join(SRC, spec.slice(1))
    : path.resolve(path.dirname(fromFile), spec);

  const candidates = [
    base,
    ...CODE_EXT.map((e) => base + e),
    ...CODE_EXT.map((e) => path.join(base, "index" + e)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const IMPORT_RE =
  /(?:import\s+(?:[^'"\n]+from\s+)?|export\s+[^'"\n]*from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;
const CSS_URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;

function extractRefs(file, text) {
  const refs = new Set();
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(text))) refs.add(m[1]);
  if (file.endsWith(".css")) {
    CSS_URL_RE.lastIndex = 0;
    while ((m = CSS_URL_RE.exec(text))) {
      if (!m[1].startsWith("data:")) refs.add(m[1]);
    }
  }
  return [...refs];
}

function walkImportGraph(entries) {
  const reachable = new Set();
  const assets = new Set();
  const missing = [];
  const queue = [...entries];

  while (queue.length) {
    const file = queue.pop();
    if (!file || reachable.has(file)) continue;
    if (!fs.existsSync(file)) {
      missing.push(file);
      continue;
    }
    reachable.add(file);
    const ext = path.extname(file).toLowerCase();
    if (ASSET_EXT.has(ext)) {
      assets.add(file);
      continue;
    }
    if (![...CODE_EXT, ".css"].some((e) => file.endsWith(e))) continue;

    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const spec of extractRefs(file, text)) {
      const resolved = resolveImport(file, spec);
      if (resolved) queue.push(resolved);
    }
  }

  return { reachable, assets, missing };
}

function walkAllAssets() {
  const roots = [
    path.join(SRC, "assets"),
    path.join(SRC, "sounds"),
  ];
  const all = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ASSET_EXT.has(path.extname(p).toLowerCase())) all.push(p);
    }
  };
  roots.forEach(walk);
  return all;
}

function inventoryDist() {
  if (!fs.existsSync(DIST)) {
    return { present: false, files: [], totalBytes: 0 };
  }
  const files = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else {
        const st = fs.statSync(p);
        files.push({ path: rel(p), bytes: st.size });
      }
    }
  };
  walk(DIST);
  files.sort((a, b) => b.bytes - a.bytes);
  return {
    present: true,
    fileCount: files.length,
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
    top40: files.slice(0, 40).map((f) => ({
      path: f.path,
      mb: mb(f.bytes),
    })),
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const entries = [
    path.join(SRC, "main.jsx"),
    path.join(SRC, "App.jsx"),
    path.join(SRC, "App.css"),
  ];
  const graph = walkImportGraph(entries);
  const allAssets = walkAllAssets();
  const reachableAssetSet = new Set(
    [...graph.assets].map((p) => path.resolve(p)),
  );
  // CSS / JS under src that import assets are in reachable; also count any
  // asset path string that appeared via resolved graph.
  const unreachable = allAssets.filter(
    (p) => !reachableAssetSet.has(path.resolve(p)),
  );
  const reachableAssets = allAssets.filter((p) =>
    reachableAssetSet.has(path.resolve(p)),
  );

  const sizeOf = (list) =>
    list.reduce((s, p) => s + fs.statSync(p).size, 0);

  const dist = inventoryDist();
  const report = {
    generatedAt: new Date().toISOString(),
    entrypoints: entries.map(rel),
    sourceModulesReachable: graph.reachable.size,
    sourceAssetsReachable: reachableAssets.length,
    sourceAssetsReachableMB: mb(sizeOf(reachableAssets)),
    sourceAssetsTotal: allAssets.length,
    sourceAssetsTotalMB: mb(sizeOf(allAssets)),
    sourceAssetsUnreachableByStaticGraph: unreachable.length,
    sourceAssetsUnreachableMB: mb(sizeOf(unreachable)),
    unreachableSample: unreachable.slice(0, 80).map(rel),
    dist,
    notes: [
      "Static import graph undercounts dynamic paths and some CSS url() forms.",
      "Unreachable ≠ safe to delete; verify with Vite bundle + runtime loads.",
      "electron-builder ships client/dist + server-io + assets/** (see root package.json).",
    ],
  };

  const outJson = path.join(OUT_DIR, "reachability-report.json");
  const outMd = path.join(OUT_DIR, "reachability-report.md");
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

  const md = [
    "# Reachability / Bundle Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Source import graph",
    "",
    `- Modules reachable: **${report.sourceModulesReachable}**`,
    `- Assets reachable (static): **${report.sourceAssetsReachable}** (${report.sourceAssetsReachableMB} MB)`,
    `- Assets on disk under assets/sounds: **${report.sourceAssetsTotal}** (${report.sourceAssetsTotalMB} MB)`,
    `- Not reached by static graph: **${report.sourceAssetsUnreachableByStaticGraph}** (${report.sourceAssetsUnreachableMB} MB)`,
    "",
    "## client/dist",
    "",
    dist.present
      ? [
          `- Files: **${dist.fileCount}**`,
          `- Total: **${mb(dist.totalBytes)} MB**`,
          "",
          "### Top 40 dist outputs",
          "",
          `| MB | Path |`,
          `| --- | --- |`,
          ...dist.top40.map((f) => `| ${f.mb} | \`${f.path}\` |`),
        ].join("\n")
      : "_No client/dist present — run `npm run build:client` for a production inventory._",
    "",
    "## Notes",
    "",
    ...report.notes.map((n) => `- ${n}`),
    "",
  ].join("\n");
  fs.writeFileSync(outMd, md);
  console.log(md);
  console.log(`Wrote ${rel(outJson)}`);
  console.log(`Wrote ${rel(outMd)}`);
}

main();
