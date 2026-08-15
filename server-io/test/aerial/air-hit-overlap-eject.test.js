"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  HIT_FALL_GRAVITY,
  HIT_FALL_MAX_FALL_SPEED,
  HITBOX_DISTANCE_VALUE,
} = require("../../constants");
const { beginAirHitFall, finishAirHitFallLanding, clearHitFall } = require("../../gameUtils");
const {
  estimateHitFallTicks,
  beginAirHitOverlapEject,
  applyAirHitOverlapEject,
  clearAirHitOverlapEject,
} = require("../../airHitOverlapEject");

const PUSHBOX = HITBOX_DISTANCE_VALUE * 2;

function fighter(x, y, extra = {}) {
  return {
    x,
    y,
    facing: -1,
    sizeMultiplier: 1,
    knockbackVelocity: { x: 0, y: 0 },
    isRecovering: false,
    isJumping: false,
    ...extra,
  };
}

function stepHitFallY(player) {
  player.hitFallVelocityY = (player.hitFallVelocityY || 0) - HIT_FALL_GRAVITY;
  if (player.hitFallVelocityY < -HIT_FALL_MAX_FALL_SPEED) {
    player.hitFallVelocityY = -HIT_FALL_MAX_FALL_SPEED;
  }
  player.y += player.hitFallVelocityY;
}

describe("air-hit overlap eject", () => {
  it("estimateHitFallTicks matches the hit-fall integrator", () => {
    const y0 = GROUND_LEVEL + 40;
    const predicted = estimateHitFallTicks(y0, 0);
    const ghost = { y: y0, hitFallVelocityY: 0 };
    let n = 0;
    while (ghost.y > GROUND_LEVEL) {
      stepHitFallY(ghost);
      n += 1;
    }
    assert.equal(predicted, n);
  });

  it("does not arm when already outside pushbox range", () => {
    const attacker = fighter(500, GROUND_LEVEL);
    const victim = fighter(500 + PUSHBOX + 10, GROUND_LEVEL + 40);
    victim.hitFallVelocityY = 0;
    assert.equal(beginAirHitOverlapEject(victim, attacker), false);
    assert.equal(victim.airHitEjectActive, false);
  });

  it("does not arm on the ground", () => {
    const attacker = fighter(500, GROUND_LEVEL);
    const victim = fighter(508, GROUND_LEVEL);
    assert.equal(beginAirHitOverlapEject(victim, attacker), false);
  });

  it("beginAirHitFall does not arm eject — the bonus send owns X", () => {
    const attacker = fighter(500, GROUND_LEVEL, { facing: -1 });
    const victim = fighter(508, GROUND_LEVEL + 40);
    victim.knockbackVelocity.x = 1.09;
    beginAirHitFall(victim, { attacker, carryVelY: 4 });
    assert.ok(!victim.airHitEjectActive);
    assert.equal(victim.knockbackVelocity.x, 1.09, "fall start does not rewrite KB");
    assert.equal(victim.isHitFalling, true);
  });

  it("already-spaced air hit keeps authored KB and does not eject", () => {
    const attacker = fighter(500, GROUND_LEVEL);
    const victim = fighter(500 + PUSHBOX + 12, GROUND_LEVEL + 50);
    victim.knockbackVelocity.x = 2.4;
    const x0 = victim.x;
    beginAirHitFall(victim, { attacker, carryVelY: 0 });
    assert.ok(!victim.airHitEjectActive);
    assert.equal(victim.knockbackVelocity.x, 2.4);
    assert.equal(applyAirHitOverlapEject(victim, attacker), 0);
    assert.equal(victim.x, x0);
  });

  it("direct eject helper still clears a stacked overlap", () => {
    const attacker = fighter(500, GROUND_LEVEL, { facing: -1 });
    const victim = fighter(500, GROUND_LEVEL + 40);
    victim.hitFallVelocityY = 0;
    assert.equal(beginAirHitOverlapEject(victim, attacker), true);
    assert.equal(victim.airHitEjectDir, 1);
    applyAirHitOverlapEject(victim, attacker);
    assert.ok(victim.x > 500);
  });

  it("clearHitFall drops a leftover eject flag", () => {
    const attacker = fighter(500, GROUND_LEVEL);
    const victim = fighter(508, GROUND_LEVEL + 40);
    victim.hitFallVelocityY = 0;
    beginAirHitOverlapEject(victim, attacker);
    assert.equal(victim.airHitEjectActive, true);
    clearHitFall(victim);
    assert.equal(victim.airHitEjectActive, false);

    const victim2 = fighter(508, GROUND_LEVEL + 40);
    victim2.knockbackVelocity.x = 1;
    beginAirHitFall(victim2, { attacker });
    finishAirHitFallLanding(victim2);
    assert.equal(victim2.airHitEjectActive, false);
    clearAirHitOverlapEject(victim2);
  });
});
