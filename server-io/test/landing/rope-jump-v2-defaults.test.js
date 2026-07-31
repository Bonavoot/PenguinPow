"use strict";

/**
 * Rope Jump V2 finalization — default-on + legacy rollback parsing.
 * Uses subprocess isolation so env cases cannot contaminate module cache.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  parseRopeJumpLandingV2Flag,
  ROPE_JUMP_LANDING_V2,
  ROPE_JUMP_VAULT_PRESET,
  DEFAULT_VAULT_PRESET_NAME,
} = require("../../landingFlags");
const {
  getVaultProfile,
  DEFAULT_PRESET_NAME,
  authoredHorizProgress,
  getRopeJumpLandingContactDistance,
  resolveVaultPresetName,
} = require("../../ropeJumpVault");
const {
  makeFighter,
  simulateRopeJump,
  computeRawRopeJumpTargetX,
  MAP_LEFT_BOUNDARY,
  GROUND_LEVEL,
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_ACTIVE_MS,
  ROPE_JUMP_LANDING_RECOVERY_MS,
} = require("./helpers/ropeJumpSim");

const SERVER_IO = path.resolve(__dirname, "../..");

function loadFlagsInSubprocess(extraEnv) {
  const env = { ...process.env };
  delete env.ROPE_JUMP_LANDING_V2;
  delete env.ROPE_JUMP_VAULT_PRESET;
  for (const [k, v] of Object.entries(extraEnv || {})) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  const script = `
    const f = require(${JSON.stringify(path.join(SERVER_IO, "landingFlags.js"))});
    const v = require(${JSON.stringify(path.join(SERVER_IO, "ropeJumpVault.js"))});
    const p = v.getVaultProfile();
    const contact = v.getRopeJumpLandingContactDistance(0.85, 0.85, p);
    console.log(JSON.stringify({
      v2: f.ROPE_JUMP_LANDING_V2,
      flagPreset: f.ROPE_JUMP_VAULT_PRESET,
      profileName: p.name,
      apex: p.apexHeight,
      hAtApex: v.authoredHorizProgress(p.apexT, p),
      decisionT: p.decisionT,
      allow: p.settleAllowancePx,
      contact,
      cap: p.endpointCorrectionCapPx,
      curve: p.curveModel,
      resolvedName: v.resolveVaultPresetName(process.env.ROPE_JUMP_VAULT_PRESET)
    }));
  `;
  const r = spawnSync(process.execPath, ["-e", script], {
    env,
    encoding: "utf8",
    cwd: SERVER_IO,
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const line = (r.stdout || "").trim().split("\n").filter(Boolean).pop();
  return JSON.parse(line);
}

describe("rope-jump V2 finalization — env parsing", () => {
  it("parseRopeJumpLandingV2Flag: unset/1/true → on; 0/false → off", () => {
    assert.equal(parseRopeJumpLandingV2Flag(undefined), true);
    assert.equal(parseRopeJumpLandingV2Flag(null), true);
    assert.equal(parseRopeJumpLandingV2Flag(""), true);
    assert.equal(parseRopeJumpLandingV2Flag("1"), true);
    assert.equal(parseRopeJumpLandingV2Flag("true"), true);
    assert.equal(parseRopeJumpLandingV2Flag("TRUE"), true);
    assert.equal(parseRopeJumpLandingV2Flag("0"), false);
    assert.equal(parseRopeJumpLandingV2Flag("false"), false);
    assert.equal(parseRopeJumpLandingV2Flag("FALSE"), false);
  });

  it("subprocess: unset → V2 on + reference_contact_9", () => {
    const r = loadFlagsInSubprocess({});
    assert.equal(r.v2, true);
    assert.equal(r.profileName, "reference_contact_9");
    assert.equal(r.flagPreset, "reference_contact_9");
  });

  it("subprocess: ROPE_JUMP_LANDING_V2=1 → V2 on", () => {
    assert.equal(loadFlagsInSubprocess({ ROPE_JUMP_LANDING_V2: "1" }).v2, true);
  });

  it("subprocess: ROPE_JUMP_LANDING_V2=true → V2 on", () => {
    assert.equal(loadFlagsInSubprocess({ ROPE_JUMP_LANDING_V2: "true" }).v2, true);
  });

  it("subprocess: ROPE_JUMP_LANDING_V2=0 → legacy off", () => {
    assert.equal(loadFlagsInSubprocess({ ROPE_JUMP_LANDING_V2: "0" }).v2, false);
  });

  it("subprocess: ROPE_JUMP_LANDING_V2=false → legacy off", () => {
    assert.equal(loadFlagsInSubprocess({ ROPE_JUMP_LANDING_V2: "false" }).v2, false);
  });
});

describe("rope-jump V2 finalization — approved preset", () => {
  it("current process defaults match approved candidate", () => {
    // When CI/local does not force-off V2, module default is on.
    if (!process.env.ROPE_JUMP_LANDING_V2) {
      assert.equal(ROPE_JUMP_LANDING_V2, true);
    }
    assert.equal(DEFAULT_VAULT_PRESET_NAME, "reference_contact_9");
    assert.equal(DEFAULT_PRESET_NAME, "reference_contact_9");
    if (!process.env.ROPE_JUMP_VAULT_PRESET) {
      assert.equal(ROPE_JUMP_VAULT_PRESET, "reference_contact_9");
    }
    const p = getVaultProfile("reference_contact_9");
    assert.equal(p.apexHeight, 156);
    assert.equal(authoredHorizProgress(p.apexT, p), 0.75);
    assert.equal(p.decisionT, 0.42);
    assert.equal(p.settleAllowancePx, 9);
    assert.equal(getRopeJumpLandingContactDistance(0.85, 0.85, p), 101.5);
    assert.equal(p.endpointCorrectionCapPx, 40);
    assert.equal(p.curveModel, "piecewise_linear_sincos");
  });

  it("invalid preset falls back to reference_contact_9", () => {
    const name = resolveVaultPresetName("not_a_real_preset");
    assert.equal(name, "reference_contact_9");
    assert.equal(getVaultProfile("not_a_real_preset").name, "reference_contact_9");
  });

  it("rounded cannot be the implicit production default", () => {
    assert.equal(DEFAULT_PRESET_NAME, "reference_contact_9");
    assert.notEqual(DEFAULT_PRESET_NAME, "rounded");
    assert.notEqual(DEFAULT_PRESET_NAME, "rounded_rejected_floaty");
    const rounded = getVaultProfile("rounded");
    assert.equal(rounded.rejected, true);
    assert.notEqual(getVaultProfile("intended").curveModel, rounded.curveModel);
    assert.equal(getVaultProfile("intended").settleAllowancePx, 9);
  });

  it("subprocess: no preset env selects reference_contact_9 with approved values", () => {
    const r = loadFlagsInSubprocess({});
    assert.equal(r.profileName, "reference_contact_9");
    assert.equal(r.apex, 156);
    assert.equal(r.hAtApex, 0.75);
    assert.equal(r.decisionT, 0.42);
    assert.equal(r.allow, 9);
    assert.equal(r.contact, 101.5);
    assert.equal(r.cap, 40);
    assert.equal(r.curve, "piecewise_linear_sincos");
  });

  it("subprocess: invalid preset env falls back to reference_contact_9", () => {
    const r = loadFlagsInSubprocess({
      ROPE_JUMP_VAULT_PRESET: "totally_invalid",
    });
    assert.equal(r.profileName, "reference_contact_9");
    assert.equal(r.resolvedName, "reference_contact_9");
  });
});

describe("rope-jump V2 finalization — legacy rollback still works", () => {
  it("explicit useV2:false keeps legacy shallow arc operational", () => {
    const jumper = makeFighter({ id: "j", x: MAP_LEFT_BOUNDARY });
    const opponent = makeFighter({
      id: "o",
      x: computeRawRopeJumpTargetX(MAP_LEFT_BOUNDARY),
    });
    const trace = simulateRopeJump(jumper, opponent, {
      useV2: false,
      jumpDirection: 1,
    });
    assert.equal(trace.useV2, false);
    assert.ok(trace.touchdown);
    const maxY = Math.max(...trace.samples.map((s) => s.y || 0));
    // Legacy parabola apex uses ROPE_JUMP_ARC_HEIGHT 120, not vault 156.
    assert.ok(maxY < GROUND_LEVEL + 140);
    assert.ok(maxY > GROUND_LEVEL + 100);
  });

  it("gameplay durations unchanged during finalization", () => {
    assert.equal(ROPE_JUMP_STARTUP_MS, 166);
    assert.equal(ROPE_JUMP_ACTIVE_MS, 450);
    assert.equal(ROPE_JUMP_LANDING_RECOVERY_MS, 183);
  });
});
