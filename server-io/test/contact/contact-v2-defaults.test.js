"use strict";

/**
 * Phase 14 — COMBAT_CONTACT_FIDELITY_V2 default ON + explicit rollback.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  parseCombatContactFidelityV2Flag,
  COMBAT_CONTACT_FIDELITY_V2,
} = require("../../combatContactFidelityFlags");

const SERVER_IO = path.resolve(__dirname, "../..");

function loadFlagsInSubprocess(extraEnv) {
  const env = { ...process.env };
  delete env.COMBAT_CONTACT_FIDELITY_V2;
  for (const [k, v] of Object.entries(extraEnv || {})) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  const script = `
    const m = require(${JSON.stringify(
      path.join(SERVER_IO, "combatContactFidelityFlags.js")
    )});
    console.log(JSON.stringify({
      v2: m.COMBAT_CONTACT_FIDELITY_V2,
      enabled: m.isCombatContactFidelityV2Enabled(),
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

describe("Phase 14 — COMBAT_CONTACT_FIDELITY_V2 defaults ON", () => {
  it("parse: unset/empty → V2", () => {
    assert.equal(parseCombatContactFidelityV2Flag(undefined), true);
    assert.equal(parseCombatContactFidelityV2Flag(null), true);
    assert.equal(parseCombatContactFidelityV2Flag(""), true);
  });

  it("parse: 1/true → V2; 0/false → legacy", () => {
    assert.equal(parseCombatContactFidelityV2Flag("1"), true);
    assert.equal(parseCombatContactFidelityV2Flag("true"), true);
    assert.equal(parseCombatContactFidelityV2Flag("0"), false);
    assert.equal(parseCombatContactFidelityV2Flag("false"), false);
  });

  it("subprocess: unset → V2 on", () => {
    const r = loadFlagsInSubprocess({});
    assert.equal(r.v2, true);
    assert.equal(r.enabled, true);
  });

  it("subprocess: COMBAT_CONTACT_FIDELITY_V2=1 → V2 on", () => {
    assert.equal(
      loadFlagsInSubprocess({ COMBAT_CONTACT_FIDELITY_V2: "1" }).v2,
      true
    );
  });

  it("subprocess: COMBAT_CONTACT_FIDELITY_V2=true → V2 on", () => {
    assert.equal(
      loadFlagsInSubprocess({ COMBAT_CONTACT_FIDELITY_V2: "true" }).v2,
      true
    );
  });

  it("subprocess: COMBAT_CONTACT_FIDELITY_V2=0 → legacy off", () => {
    assert.equal(
      loadFlagsInSubprocess({ COMBAT_CONTACT_FIDELITY_V2: "0" }).v2,
      false
    );
  });

  it("subprocess: COMBAT_CONTACT_FIDELITY_V2=false → legacy off", () => {
    assert.equal(
      loadFlagsInSubprocess({ COMBAT_CONTACT_FIDELITY_V2: "false" }).v2,
      false
    );
  });

  it("current process default is ON when env does not force-off", () => {
    if (!process.env.COMBAT_CONTACT_FIDELITY_V2) {
      assert.equal(COMBAT_CONTACT_FIDELITY_V2, true);
    }
  });
});
