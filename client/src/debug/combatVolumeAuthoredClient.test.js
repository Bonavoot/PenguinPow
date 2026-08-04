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
  resolveAuthoredPoseRegions,
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

describe("Phase 4A — overlay honours per-variant frontArm volumes", () => {
  /** Measured visible arm tips (meta.phase4aLimbMeasurement) — authority's values. */
  const EXPECTED_OUTER = { 1: 75.276, 2: 78.392 };

  function frontArmOuter(poseKey, slapAnimation) {
    const pose = getAuthoredCatalog().poses[poseKey];
    const regions = resolveAuthoredPoseRegions(pose, { slapAnimation });
    const arm = regions.find((r) => r.label === "frontArm");
    assert.ok(arm, `${poseKey} must author a frontArm`);
    return arm.forward + arm.halfW;
  }

  it("each slap variant draws its own measured arm length", () => {
    for (const variant of [1, 2]) {
      assert.equal(
        frontArmOuter("slap_active", variant),
        EXPECTED_OUTER[variant],
        `variant ${variant} overlay must match authority`
      );
    }
    assert.notEqual(
      frontArmOuter("slap_active", 1),
      frontArmOuter("slap_active", 2),
      "one shared box would misdraw one of the two hit frames"
    );
  });

  it("unknown / missing variant falls back to the SHORTER volume", () => {
    for (const bogus of [99, null, undefined, "x"]) {
      assert.equal(
        frontArmOuter("slap_active", bogus),
        EXPECTED_OUTER[1],
        `variant ${bogus} must never draw reach the fighter does not have`
      );
    }
  });

  it("recovery has no variants and keeps its retracted arm", () => {
    // The settle-back frame draws one arm regardless of which slap preceded it.
    for (const variant of [1, 2]) {
      assert.ok(
        Math.abs(frontArmOuter("slap_recovery", variant) - 54.448) < 1e-6,
        `variant ${variant}: recovery arm must stay retracted`
      );
    }
  });

  it("poses without variants are returned untouched (same array)", () => {
    const neutral = getAuthoredCatalog().poses.neutral;
    assert.equal(
      resolveAuthoredPoseRegions(neutral, { slapAnimation: 2 }),
      neutral.regions
    );
  });

  it("the drawn overlay volume reflects the live variant", () => {
    const outers = [1, 2].map((slapAnimation) => {
      const vols = deriveAuthoredDebugVolumes({
        x: 400,
        y: 286,
        facing: -1,
        isAttacking: true,
        isSlapAttack: true,
        strikePhaseHint: "active",
        slapAnimation,
      });
      const limb = vols.find((v) => v.kind === "HURT_LIMB");
      assert.ok(limb, `variant ${slapAnimation}: overlay must draw the limb`);
      // Facing -1 ⇒ forward is +X, so the outer edge is the max side.
      return Math.max(limb.aabb.left, limb.aabb.right);
    });
    assert.notEqual(
      outers[0],
      outers[1],
      "overlay must not draw the same arm box for both hit frames"
    );
  });
});

describe("Phase 4B — overlay mirrors the palm's authoritative hold window", () => {
  /** Measured visible arm tips (meta.phase4bLimbMeasurement). */
  const PALM_EXTENDED = 71.832;
  const PALM_RETRACTED = 54.448;

  const near = (actual, expected, msg) =>
    assert.ok(
      Math.abs(actual - expected) < 1e-6,
      `${msg} (got ${actual}, want ${expected})`
    );

  function palmArmOuter(poseKey, fighter) {
    const pose = getAuthoredCatalog().poses[poseKey];
    const arm = resolveAuthoredPoseRegions(pose, fighter).find(
      (r) => r.label === "frontArm"
    );
    assert.ok(arm, `${poseKey} must author a frontArm`);
    return arm.forward + arm.halfW;
  }

  it("palm_active draws the measured extended arm", () => {
    near(palmArmOuter("palm_active", {}), PALM_EXTENDED, "palm_active");
  });

  it("palm_recovery follows palmLimbExtended, the server's own hold boolean", () => {
    near(
      palmArmOuter("palm_recovery", { palmLimbExtended: true }),
      PALM_EXTENDED,
      "while the arm is held out the overlay must draw the box authority queries"
    );
    near(
      palmArmOuter("palm_recovery", { palmLimbExtended: false }),
      PALM_RETRACTED,
      "once the art settles the overlay must retract with it"
    );
  });

  it("unknown / missing palmLimbExtended falls back to the RETRACTED volume", () => {
    for (const bogus of [undefined, null, "banana", 0, 1, "true "]) {
      near(
        palmArmOuter("palm_recovery", { palmLimbExtended: bogus }),
        PALM_RETRACTED,
        `${JSON.stringify(bogus)} must never draw reach the fighter does not have`
      );
    }
    assert.equal(
      getAuthoredCatalog().poses.palm_recovery.variantDefault,
      undefined,
      "a variantDefault would let a missing field resolve the longer box"
    );
  });

  it("palm_startup is corrected to the retracted art it actually draws", () => {
    // Overlay-only pose: never authoritative, so it must under-draw, not over.
    near(palmArmOuter("palm_startup", {}), PALM_RETRACTED, "palm_startup");
  });

  it("the drawn overlay volume tracks the live hold flag", () => {
    const outerFor = (palmLimbExtended) => {
      const vols = deriveAuthoredDebugVolumes({
        x: 400,
        y: 286,
        facing: -1,
        isPalmThrust: true,
        isRecovering: true,
        currentAction: "palm",
        palmLimbExtended,
      });
      const limb = vols.find((v) => v.kind === "HURT_LIMB");
      assert.ok(limb, `palmLimbExtended=${palmLimbExtended}: limb must draw`);
      // Facing -1 ⇒ forward is +X, so the outer edge is the max side.
      return Math.max(limb.aabb.left, limb.aabb.right);
    };
    near(
      outerFor(true) - outerFor(false),
      PALM_EXTENDED - PALM_RETRACTED,
      "overlay must shrink by exactly the authored retraction when the hold ends"
    );
  });

  it("server recovery state beats the client palm animation clock", () => {
    // The client director keeps palm-thrust.png up ~20ms past the server hold.
    // isRecovering is authoritative, so the overlay must resolve palm_recovery
    // (variant-gated) rather than palm_active (always extended).
    const resolved = resolveClientAuthoredPoseKey({
      x: 400,
      isPalmThrust: true,
      isRecovering: true,
      currentAction: "palm",
      strikePhaseHint: "active",
    });
    assert.equal(resolved.poseKey, "palm_recovery");
    assert.equal(resolved.phase, "recovery");
  });
});
