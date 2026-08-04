"use strict";

/**
 * Phase 3 repair — cross-runtime module contract + data equivalence.
 * Fails if server/client diverge from shared/combatVolumeAuthored.json.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SHARED_JSON = path.join(
  __dirname,
  "../../../shared/combatVolumeAuthored.json"
);

/**
 * Poses-only fingerprint (camera-sync projection + head/torso/limb art alignment).
 */
const EXPECTED_POSES_SHA256 =
  "628ecacfd2b7cd2e794eea2b09389cc9c1faa516ec2d6e52dd008429bf81c85c";

const REQUIRED_TOP_KEYS = ["version", "phase", "coordSystem", "meta", "poses"];
const REQUIRED_POSES = [
  "neutral",
  "crouch",
  "slap_startup",
  "slap_active",
  "slap_recovery",
  "palm_startup",
  "palm_active",
  "palm_recovery",
  "charged_hold",
  "charged_active",
  "charged_recovery",
  "sidestep_startup",
  "sidestep_active",
  "sidestep_recovery",
];

function posesFingerprint(catalog) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(catalog.poses))
    .digest("hex");
}

describe("Phase 3 repair — authored module contract", () => {
  it("shared JSON exists and has required schema keys/poses", () => {
    assert.ok(fs.existsSync(SHARED_JSON), "shared JSON must exist");
    const raw = JSON.parse(fs.readFileSync(SHARED_JSON, "utf8"));
    for (const k of REQUIRED_TOP_KEYS) {
      assert.ok(raw[k] != null, `missing top key ${k}`);
    }
    for (const p of REQUIRED_POSES) {
      assert.ok(raw.poses[p], `missing pose ${p}`);
    }
    assert.equal(raw.meta.provisional, undefined);
    assert.equal(raw.meta.definitionOwner, "shared/combatVolumeAuthored.json");
    assert.equal(raw.version, 1);
  });

  it("server CJS adapter loads synchronously and matches shared JSON byte-for-byte structurally", () => {
    const loaded = require("../../combatVolumeAuthoredLoad");
    const raw = JSON.parse(fs.readFileSync(SHARED_JSON, "utf8"));
    assert.deepEqual(loaded, raw);
    assert.equal(typeof loaded.poses.neutral.regions[0].forward, "number");
  });

  it("server combatVolumeDefs catalog is the same object graph as JSON", () => {
    const { getAuthoredCatalog } = require("../../combatVolumeDefs");
    const raw = JSON.parse(fs.readFileSync(SHARED_JSON, "utf8"));
    assert.deepEqual(getAuthoredCatalog(), raw);
  });

  it("poses fingerprint unchanged after module-format repair", () => {
    const raw = JSON.parse(fs.readFileSync(SHARED_JSON, "utf8"));
    assert.equal(posesFingerprint(raw), EXPECTED_POSES_SHA256);
  });

  it("legacy CJS shared .js is gone (Vite must not import CJS as default)", () => {
    const legacy = path.join(
      __dirname,
      "../../../shared/combatVolumeAuthored.js"
    );
    assert.equal(fs.existsSync(legacy), false);
  });

  it("client Vite bind source imports JSON default, not CJS .js", () => {
    const bindPath = path.join(
      __dirname,
      "../../../client/src/debug/combatVolumeAuthoredViteBind.js"
    );
    const src = fs.readFileSync(bindPath, "utf8");
    assert.ok(
      /from ["']\.\.\/\.\.\/\.\.\/shared\/combatVolumeAuthored\.json["']/.test(
        src
      ),
      "Vite bind must import shared JSON"
    );
    assert.equal(/combatVolumeAuthored\.js["']/.test(src), false);
    assert.ok(/bindAuthoredCatalog/.test(src));
  });

  it("client logic module does not static-import shared CJS/JS SoT", () => {
    const clientPath = path.join(
      __dirname,
      "../../../client/src/debug/combatVolumeAuthoredClient.js"
    );
    const src = fs.readFileSync(clientPath, "utf8");
    assert.equal(/from ["'][^"']*combatVolumeAuthored\.js["']/.test(src), false);
    assert.ok(/export function bindAuthoredCatalog/.test(src));
  });

  it("CombatFidelityDebug pulls Vite bind into the real module graph", () => {
    const fidelity = path.join(
      __dirname,
      "../../../client/src/debug/CombatFidelityDebug.js"
    );
    const src = fs.readFileSync(fidelity, "utf8");
    assert.ok(/combatVolumeAuthoredViteBind/.test(src));
  });
});
