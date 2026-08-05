"use strict";

/**
 * Deploy-shape contract for the authored combat-volume catalog.
 *
 * server-io/ ships as the Heroku app root (`/app`), so `../shared/` does not
 * exist at runtime. A require reaching above this directory boots fine locally
 * and then crashes every dyno with MODULE_NOT_FOUND, which is exactly how
 * Phase 4A took the live server down.
 *
 * Guards both halves of the arrangement that replaced it:
 *   1. server-io/combatVolumeAuthored.json stays byte-identical to shared/.
 *   2. No runtime module in server-io/ requires anything above server-io/.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SERVER_DIR = path.join(__dirname, "../..");
const SHARED_JSON = path.join(SERVER_DIR, "../shared/combatVolumeAuthored.json");
const MIRROR_JSON = path.join(SERVER_DIR, "combatVolumeAuthored.json");

// Test-only dirs plus vendored deps: none of these load on a dyno.
const NON_RUNTIME_DIRS = new Set(["node_modules", "test", "scripts"]);
const ESCAPING_REQUIRE = /require\(\s*["'](\.\.\/[^"']*)["']\s*\)/g;

function collectRuntimeModules(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!NON_RUNTIME_DIRS.has(entry.name)) {
        collectRuntimeModules(path.join(dir, entry.name), acc);
      }
    } else if (entry.name.endsWith(".js")) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

describe("authored catalog deploy mirror", () => {
  it("keeps the server-io copy byte-identical to the shared source of truth", () => {
    const shared = fs.readFileSync(SHARED_JSON);
    const mirror = fs.readFileSync(MIRROR_JSON);
    assert.ok(
      shared.equals(mirror),
      "server-io/combatVolumeAuthored.json drifted from shared/combatVolumeAuthored.json — " +
        "re-copy shared/ over it rather than editing the mirror."
    );
  });

  it("resolves the catalog without leaving server-io/", () => {
    const loaded = require("../../combatVolumeAuthoredLoad");
    const shared = JSON.parse(fs.readFileSync(SHARED_JSON, "utf8"));
    assert.deepEqual(loaded, shared);
    assert.equal(loaded.meta.definitionOwner, "shared/combatVolumeAuthored.json");
  });

  it("has no runtime require reaching above the deployed app root", () => {
    const offenders = [];
    for (const file of collectRuntimeModules(SERVER_DIR)) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(ESCAPING_REQUIRE)) {
        offenders.push(`${path.relative(SERVER_DIR, file)} -> ${match[1]}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `server-io/ is the Heroku app root; these requires cannot resolve on a dyno:\n${offenders.join(
        "\n"
      )}`
    );
  });
});
