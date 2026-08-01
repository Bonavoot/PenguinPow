"use strict";

/**
 * Phase 12 finalization — ACTION_FACING_OWNERSHIP_V2 default ON + rollback.
 * Subprocess isolation so env cases cannot contaminate module cache.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  parseActionFacingOwnershipV2Flag,
  ACTION_FACING_OWNERSHIP_V2,
} = require("../../actionFacingOwnership");

const SERVER_IO = path.resolve(__dirname, "../..");

function loadFlagsInSubprocess(extraEnv) {
  const env = { ...process.env };
  delete env.ACTION_FACING_OWNERSHIP_V2;
  for (const [k, v] of Object.entries(extraEnv || {})) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  const script = `
    const m = require(${JSON.stringify(
      path.join(SERVER_IO, "actionFacingOwnership.js")
    )});
    console.log(JSON.stringify({
      v2: m.ACTION_FACING_OWNERSHIP_V2,
      enabled: m.isActionFacingOwnershipV2Enabled(),
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

describe("Phase 12 finalization — ACTION_FACING_OWNERSHIP_V2 defaults", () => {
  it("parse: unset/empty → V2", () => {
    assert.equal(parseActionFacingOwnershipV2Flag(undefined), true);
    assert.equal(parseActionFacingOwnershipV2Flag(null), true);
    assert.equal(parseActionFacingOwnershipV2Flag(""), true);
  });

  it("parse: 1/true → V2; 0/false → legacy", () => {
    assert.equal(parseActionFacingOwnershipV2Flag("1"), true);
    assert.equal(parseActionFacingOwnershipV2Flag("true"), true);
    assert.equal(parseActionFacingOwnershipV2Flag("0"), false);
    assert.equal(parseActionFacingOwnershipV2Flag("false"), false);
  });

  it("subprocess: unset → V2 on", () => {
    const r = loadFlagsInSubprocess({});
    assert.equal(r.v2, true);
    assert.equal(r.enabled, true);
  });

  it("subprocess: ACTION_FACING_OWNERSHIP_V2=1 → V2 on", () => {
    assert.equal(
      loadFlagsInSubprocess({ ACTION_FACING_OWNERSHIP_V2: "1" }).v2,
      true
    );
  });

  it("subprocess: ACTION_FACING_OWNERSHIP_V2=true → V2 on", () => {
    assert.equal(
      loadFlagsInSubprocess({ ACTION_FACING_OWNERSHIP_V2: "true" }).v2,
      true
    );
  });

  it("subprocess: ACTION_FACING_OWNERSHIP_V2=0 → legacy off", () => {
    assert.equal(
      loadFlagsInSubprocess({ ACTION_FACING_OWNERSHIP_V2: "0" }).v2,
      false
    );
  });

  it("subprocess: ACTION_FACING_OWNERSHIP_V2=false → legacy off", () => {
    assert.equal(
      loadFlagsInSubprocess({ ACTION_FACING_OWNERSHIP_V2: "false" }).v2,
      false
    );
  });

  it("current process default is ON when env does not force-off", () => {
    if (!process.env.ACTION_FACING_OWNERSHIP_V2) {
      assert.equal(ACTION_FACING_OWNERSHIP_V2, true);
    }
  });
});
