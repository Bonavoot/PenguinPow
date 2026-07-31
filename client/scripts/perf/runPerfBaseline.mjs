#!/usr/bin/env node
/**
 * Phase 0 — Run static baseline reports (inventory, reachability, live loops).
 * Does not launch Electron; runtime traces are captured in-app via ?perf=1.
 *
 * Usage: node client/scripts/perf/runPerfBaseline.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(__dirname, "out");

function run(script) {
  console.log(`\n=== ${path.basename(script)} ===\n`);
  const r = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

function envProbe() {
  const electronPath = path.join(ROOT, "node_modules/electron/dist/electron");
  let electronVersions = null;
  if (fs.existsSync(electronPath) || fs.existsSync(electronPath + ".exe")) {
    const bin =
      process.platform === "win32" ? electronPath + ".exe" : electronPath;
    const r = spawnSync(
      bin,
      [
        "-e",
        "console.log(JSON.stringify({electron:process.versions.electron,chrome:process.versions.chrome,node:process.versions.node}))",
      ],
      { encoding: "utf8" },
    );
    try {
      electronVersions = JSON.parse((r.stdout || "").trim().split("\n").pop());
    } catch {
      electronVersions = { raw: r.stdout, err: r.stderr };
    }
  }

  const probe = {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    electronVersions,
    cwd: ROOT,
    notes: [
      "Runtime FPS baselines require a production Electron package + ?perf=1 scenarios.",
      "This script only produces static inventories and environment metadata.",
    ],
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "environment.json"),
    JSON.stringify(probe, null, 2),
  );
  console.log(JSON.stringify(probe, null, 2));
}

envProbe();
run(path.join(__dirname, "assetInventory.mjs"));
run(path.join(__dirname, "reachabilityReport.mjs"));
run(path.join(__dirname, "liveLoopInventory.mjs"));

console.log(`\nPhase 0 static baseline written to ${path.relative(ROOT, OUT)}`);
