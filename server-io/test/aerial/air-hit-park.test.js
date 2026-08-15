"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { GROUND_LEVEL } = require("../../constants");
const {
  applyContactCorrection,
  applyAirHitContactCorrection,
  getHitParkDistance,
  AIR_HIT_UNSTACK_MAX_PX,
  AIR_HIT_UNSTACK_COMFORT_PX,
} = require("../../strikeContact");

function pair(ax, vx, extraA = {}, extraV = {}) {
  return {
    attacker: {
      x: ax,
      y: GROUND_LEVEL,
      facing: -1,
      attackType: "slap",
      slapAnimation: 1,
      ...extraA,
    },
    victim: {
      x: vx,
      y: GROUND_LEVEL + 40,
      ...extraV,
    },
  };
}

describe("air-hit contact — no snap to fist", () => {
  it("full tip park would teleport a stacked jumper; air correction does not", () => {
    const { attacker, victim } = pair(500, 508);
    const before = victim.x;
    const parkDist = getHitParkDistance("slap", attacker, victim);
    assert.ok(parkDist > 60, "torso park is tip-range");

    const ghost = { ...victim };
    applyContactCorrection(attacker, ghost, parkDist);
    assert.ok(
      Math.abs(ghost.x - before) > 40,
      "legacy park is the snap-to-fist"
    );

    applyAirHitContactCorrection(attacker, victim);
    assert.ok(
      Math.abs(victim.x - before) <= AIR_HIT_UNSTACK_MAX_PX + 0.01,
      "air hit only unglues"
    );
    assert.ok(victim.x > attacker.x, "stay on the side they already occupy");
  });

  it("already-spaced air hit does not move X", () => {
    const { attacker, victim } = pair(500, 500 + AIR_HIT_UNSTACK_COMFORT_PX + 10);
    const before = victim.x;
    assert.equal(applyAirHitContactCorrection(attacker, victim), false);
    assert.equal(victim.x, before);
  });

  it("dead-overlap pushes along attacker facing, not across the body", () => {
    const { attacker, victim } = pair(500, 500);
    applyAirHitContactCorrection(attacker, victim);
    // facing -1 attacks right (getAttackDir: facing 1 → -1, else +1)
    assert.ok(victim.x > 500);
    assert.ok(victim.x - 500 <= AIR_HIT_UNSTACK_MAX_PX + 0.01);
  });
});
