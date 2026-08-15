"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { GROUND_LEVEL, AIR_HIT_KB_BONUS_PX } = require("../../constants");
const {
  timeoutManager,
  isAirHitFallStrikeImmune,
  applyAirHitKnockbackBoost,
  beginAirHitFall,
} = require("../../gameUtils");
const { pxToKbVelocity } = require("../../momentumTransfer");
const {
  resolveOffensiveAerialPresentation,
  OFFENSIVE_AERIAL_PRESENTATION,
} = require("../../offensiveAerialPresentation");
const { evaluateHitCallouts } = require("../../collisionSystem");
const {
  createContactScenario,
  armSlap,
  placeInConnectRange,
  checkCollision,
} = require("../contact/helpers/contactSim");

const scenarios = [];
afterEach(() => {
  timeoutManager.clearAll();
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

describe("air-hit — anti-air send", () => {
  it("adds a fixed extra send on top of authored KB", () => {
    const victim = {
      x: 600,
      knockbackVelocity: { x: 1.09, y: 0 },
    };
    applyAirHitKnockbackBoost(victim, 0, { x: 500, facing: -1 });
    const expected = 1.09 + pxToKbVelocity(AIR_HIT_KB_BONUS_PX);
    assert.ok(Math.abs(victim.knockbackVelocity.x - expected) < 1e-6);
  });

  it("uses attacker side when authored KB is zero", () => {
    const victim = {
      x: 480,
      knockbackVelocity: { x: 0, y: 0 },
    };
    applyAirHitKnockbackBoost(victim, 0, { x: 500, facing: -1 });
    assert.ok(victim.knockbackVelocity.x < 0);
    assert.ok(
      Math.abs(Math.abs(victim.knockbackVelocity.x) - pxToKbVelocity(AIR_HIT_KB_BONUS_PX)) <
        1e-6
    );
  });

  it("does not lock the hurtbox — distance is the anti-follow-up", () => {
    assert.equal(isAirHitFallStrikeImmune({ isHitFalling: true }), false);
  });

  it("holds INTERRUPTED_AIRBORNE after stun ends", () => {
    const p = {
      isHitFalling: true,
      isHit: false,
      isSlideJumping: false,
      y: GROUND_LEVEL + 50,
    };
    assert.equal(
      resolveOffensiveAerialPresentation(p),
      OFFENSIVE_AERIAL_PRESENTATION.INTERRUPTED_AIRBORNE
    );
  });

  it("slide-jump flight is a COUNTER HIT, same as other startup stuffs", () => {
    const callouts = evaluateHitCallouts(
      { isSlideJumping: true, slideJumpPhase: "flight" },
      0
    );
    assert.equal(callouts.isCounterHit, true);
    assert.equal(callouts.isPunish, false);
  });

  it("slide-jump landing stays PUNISH, not counter", () => {
    const callouts = evaluateHitCallouts(
      { isSlideJumping: true, slideJumpPhase: "landing" },
      0
    );
    assert.equal(callouts.isPunish, true);
    assert.equal(callouts.isCounterHit, false);
  });

  it("W stuff emits COUNTER HIT and boosts KB", () => {
    const s = sc();
    placeInConnectRange(s.left, s.right, "slap");
    s.right.y = GROUND_LEVEL + 25;
    s.right.isSlideJumping = true;
    s.right.slideJumpPhase = "flight";
    s.right.slideJumpVelocityY = 8;
    const kbBefore = Math.abs(s.right.knockbackVelocity?.x || 0);
    armSlap(s.left, { now: s.simTime });
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    assert.equal(s.right.isHitFalling, true);
    const hit = s.io.last("player_hit")?.payload;
    assert.ok(hit, "must emit player_hit");
    assert.equal(hit.isCounterHit, true);
    assert.equal(hit.showCounterBanner, true);
    assert.equal(hit.showAirborneBanner, undefined);
    assert.ok(
      Math.abs(s.right.knockbackVelocity.x) >
        kbBefore + pxToKbVelocity(AIR_HIT_KB_BONUS_PX) * 0.5,
      "air send must include the bonus"
    );
  });

  it("same spacing on the ice is a normal hit", () => {
    const s = sc();
    placeInConnectRange(s.left, s.right, "slap");
    s.right.y = GROUND_LEVEL;
    s.right.isHitFalling = false;
    s.right.isSlideJumping = false;
    armSlap(s.left, { now: s.simTime });
    checkCollision(s.left, s.right, s.rooms, s.io);
    assert.equal(s.right.isHit, true);
    const hit = s.io.last("player_hit")?.payload;
    assert.equal(hit.isCounterHit, false);
    assert.equal(hit.showCounterBanner, false);
    assert.equal(s.right.isHitFalling, false);
  });
});
