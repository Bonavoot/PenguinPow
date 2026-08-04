/**
 * Phase 3 — client authored volume derive (shadow overlay).
 * Run: node --test client/src/debug/combatVolumeAuthoredClient.test.js
 *
 * Loads shared JSON via createRequire (Node) — does NOT import the Vite bind
 * module, which would require Vite's JSON transform.
 */

import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  bindAuthoredCatalog,
  unbindAuthoredCatalogForTests,
  deriveAuthoredDebugVolumes,
  resolveClientAuthoredPoseKey,
  getAuthoredCatalog,
} from "./combatVolumeAuthoredClient.js";

const require = createRequire(import.meta.url);
const catalogPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../shared/combatVolumeAuthored.json"
);

before(() => {
  bindAuthoredCatalog(require(catalogPath));
});

afterEach(() => {
  // Keep catalog bound for suite; re-bind if a test unbound.
  try {
    getAuthoredCatalog();
  } catch {
    bindAuthoredCatalog(require(catalogPath));
  }
});

describe("Phase 3 — client authored volumes", () => {
  it("loads shared catalog via bind (same JSON as server)", () => {
    const c = getAuthoredCatalog();
    assert.equal(c.version, 1);
    assert.ok(c.poses.slap_active);
    assert.equal(c.meta.definitionOwner, "shared/combatVolumeAuthored.json");
  });

  it("neutral / slap phases / uncertain remote", () => {
    assert.equal(
      resolveClientAuthoredPoseKey({ x: 1, facing: -1 }).poseKey,
      "neutral"
    );
    assert.equal(
      resolveClientAuthoredPoseKey({
        x: 1,
        isSlapAttack: true,
        isAttacking: true,
        strikePhaseHint: "startup",
      }).poseKey,
      "slap_startup"
    );
    assert.equal(
      resolveClientAuthoredPoseKey({
        x: 1,
        isSlapAttack: true,
        isAttacking: true,
        strikePhaseHint: "active",
      }).poseKey,
      "slap_active"
    );
    assert.equal(
      resolveClientAuthoredPoseKey({
        x: 1,
        isSlapAttack: true,
        isAttacking: true,
        strikePhaseHint: "recovery",
      }).poseKey,
      "slap_recovery"
    );
    assert.equal(
      resolveClientAuthoredPoseKey({
        x: 1,
        isSlapAttack: true,
        isAttacking: true,
      }).support,
      "unsupported"
    );
    const vols = deriveAuthoredDebugVolumes({
      x: 400,
      y: 286,
      isSlapAttack: true,
      isAttacking: true,
    });
    assert.equal(vols.length, 0);
  });

  it("active has tip HIT; recovery has LIMB no HIT", () => {
    const active = deriveAuthoredDebugVolumes({
      x: 400,
      y: 286,
      facing: -1,
      isSlapAttack: true,
      isAttacking: true,
      strikePhaseHint: "active",
      slapFacingDirection: -1,
    });
    assert.ok(active.some((v) => v.kind === "HIT"));
    assert.ok(active.some((v) => v.kind === "HURT_LIMB"));

    const rec = deriveAuthoredDebugVolumes({
      x: 400,
      y: 286,
      facing: -1,
      isSlapAttack: true,
      isAttacking: true,
      strikePhaseHint: "recovery",
      slapFacingDirection: -1,
    });
    assert.equal(rec.some((v) => v.kind === "HIT"), false);
    assert.ok(rec.some((v) => v.kind === "HURT_LIMB"));
  });

  it("unbind fails closed — no silent empty catalog", () => {
    unbindAuthoredCatalogForTests();
    assert.throws(() => getAuthoredCatalog(), /catalog not bound/);
    bindAuthoredCatalog(require(catalogPath));
  });

  it("palm active hint + isRecovering resolves palm_recovery with zero HIT", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isPalmThrust: true,
      isAttacking: true,
      isRecovering: true,
      strikePhaseHint: "active",
    };
    assert.equal(resolveClientAuthoredPoseKey(f).poseKey, "palm_recovery");
    assert.equal(
      deriveAuthoredDebugVolumes(f).some((v) => v.kind === "HIT"),
      false
    );
  });

  it("local charged active resolves charged_active with HIT", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isAttacking: true,
      attackType: "charged",
    };
    assert.equal(resolveClientAuthoredPoseKey(f).poseKey, "charged_active");
    assert.ok(deriveAuthoredDebugVolumes(f).some((v) => v.kind === "HIT"));
  });
});
