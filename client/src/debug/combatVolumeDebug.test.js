/**
 * Phase 1 completion — HIT-phase policy for diagnostic combat volumes.
 * Run: node --test client/src/debug/combatVolumeDebug.test.js
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  COMBAT_VOLUME_KIND,
  STRIKE_DEBUG_PHASE,
  classifyStrikeDebugPhase,
  clearLocalStrikePhaseHints,
  deriveDebugCombatVolumes,
  noteLocalStrikePhaseHint,
  palmFrameToStrikePhaseHint,
  resolveDebugVolumeRoot,
  slapFrameToStrikePhaseHint,
} from "./combatVolumeDebug.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

afterEach(() => {
  clearLocalStrikePhaseHints();
});

function kinds(fighter) {
  return deriveDebugCombatVolumes(fighter).map((v) => v.kind);
}

describe("Phase 1 completion — strike phase / HIT policy", () => {
  it("maps slap/palm director frames to startup → active → recovery", () => {
    assert.equal(slapFrameToStrikePhaseHint(0), "startup");
    assert.equal(slapFrameToStrikePhaseHint(1), "startup");
    assert.equal(slapFrameToStrikePhaseHint(2), "active");
    assert.equal(slapFrameToStrikePhaseHint(3), "recovery");
    assert.equal(palmFrameToStrikePhaseHint(2), "active");
    assert.equal(palmFrameToStrikePhaseHint(3), "recovery");
  });

  it("slap startup has no HIT; active has HIT; recovery has LIMB not HIT", () => {
    const base = {
      x: 400,
      y: 286,
      facing: -1,
      isSlapAttack: true,
      isAttacking: true,
      sizeMult: 1,
    };

    const startup = { ...base, strikePhaseHint: "startup" };
    assert.equal(classifyStrikeDebugPhase(startup).phase, STRIKE_DEBUG_PHASE.STARTUP);
    assert.equal(kinds(startup).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(kinds(startup).includes(COMBAT_VOLUME_KIND.HURT_LIMB), false);

    const active = { ...base, strikePhaseHint: "active" };
    assert.equal(classifyStrikeDebugPhase(active).phase, STRIKE_DEBUG_PHASE.ACTIVE);
    assert.equal(kinds(active).includes(COMBAT_VOLUME_KIND.HIT), true);
    assert.equal(kinds(active).includes(COMBAT_VOLUME_KIND.HURT_LIMB), false);

    const recovery = { ...base, strikePhaseHint: "recovery" };
    assert.equal(classifyStrikeDebugPhase(recovery).phase, STRIKE_DEBUG_PHASE.RECOVERY);
    assert.equal(kinds(recovery).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(kinds(recovery).includes(COMBAT_VOLUME_KIND.HURT_LIMB), true);
  });

  it("palm recovery never shows offensive HIT", () => {
    const f = {
      x: 500,
      y: 286,
      facing: 1,
      isPalmThrust: true,
      isAttacking: true,
      strikePhaseHint: "recovery",
    };
    const k = kinds(f);
    assert.equal(k.includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(k.includes(COMBAT_VOLUME_KIND.HURT_LIMB), true);
  });

  it("wire-only isAttacking/isSlapAttack without phase → uncertain, omits HIT", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isSlapAttack: true,
      isAttacking: true,
      // no strikePhaseHint, no isInStartupFrames, no isRecovering
    };
    const c = classifyStrikeDebugPhase(f);
    assert.equal(c.phase, STRIKE_DEBUG_PHASE.UNCERTAIN);
    assert.equal(c.exact, false);
    assert.equal(kinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(kinds(f).includes(COMBAT_VOLUME_KIND.HURT_LIMB), false);
  });

  it("does not treat isAttacking && !isInStartupFrames as active HIT", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isAttacking: true,
      isSlapAttack: true,
      isInStartupFrames: false,
    };
    assert.equal(classifyStrikeDebugPhase(f).phase, STRIKE_DEBUG_PHASE.UNCERTAIN);
    assert.equal(kinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("local pose-director hint via fighter slot resolves active HIT", () => {
    noteLocalStrikePhaseHint("player 2", "active");
    const f = {
      fighter: "player 2",
      x: 700,
      y: 286,
      facing: 1,
      isSlapAttack: true,
      isAttacking: true,
    };
    assert.equal(classifyStrikeDebugPhase(f).source, "local_pose_director");
    assert.equal(kinds(f).includes(COMBAT_VOLUME_KIND.HIT), true);
  });

  it("charge hold is exact startup without HIT", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isChargingAttack: true,
      isAttacking: false,
      attackType: "charged",
    };
    assert.equal(classifyStrikeDebugPhase(f).phase, STRIKE_DEBUG_PHASE.STARTUP);
    assert.equal(kinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("charged release with lifecycle flags resolves active HIT (not unsupported)", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isAttacking: true,
      attackType: "charged",
      isChargingAttack: false,
      isRecovering: false,
    };
    assert.equal(classifyStrikeDebugPhase(f).phase, STRIKE_DEBUG_PHASE.ACTIVE);
    assert.equal(classifyStrikeDebugPhase(f).source, "charged_lifecycle_active");
    assert.equal(kinds(f).includes(COMBAT_VOLUME_KIND.HIT), true);
  });

  it("palm active hint cannot override explicit isRecovering (zero HIT)", () => {
    const f = {
      x: 500,
      y: 286,
      facing: 1,
      isPalmThrust: true,
      isAttacking: true,
      isRecovering: true,
      strikePhaseHint: "active",
    };
    assert.equal(classifyStrikeDebugPhase(f).phase, STRIKE_DEBUG_PHASE.RECOVERY);
    assert.equal(classifyStrikeDebugPhase(f).source, "isRecovering");
    assert.equal(kinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });
});

describe("Phase 3 visual — overlay projection contract", () => {
  it("prefers GameFighter renderX/renderY as volume root", () => {
    const a = resolveDebugVolumeRoot({
      x: 400,
      y: 286,
      renderX: 405,
      renderY: 280,
      soleFromBottomPct: 0.021,
    });
    assert.equal(a.simX, 400);
    assert.equal(a.simY, 286);
    assert.equal(a.rootX, 405);
    assert.equal(a.rootY, 280);
    assert.ok(Math.abs(a.visualFootY - (280 + 0.021 * 1280 * 0.123)) < 0.001);
  });

  it("CombatFidelityDebug mounts world volumes under .game-actors, not body-only", () => {
    const fidelityPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "CombatFidelityDebug.js"
    );
    const src = fs.readFileSync(fidelityPath, "utf8");
    assert.ok(/querySelector\(["']\.game-actors["']\)/.test(src));
    assert.ok(/pumo-combat-volume-world/.test(src));
    assert.ok(/teardownDebugLayers/.test(src));
    // Must not append volume world layer to document.body
    assert.equal(
      /document\.body\.appendChild\(worldEl\)/.test(src),
      false
    );
  });
});
