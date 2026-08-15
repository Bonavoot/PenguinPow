"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { GROUND_LEVEL } = require("../../constants");
const {
  getStrikeLimbUpBand,
  strikeLimbReachesVictimY,
} = require("../../strikeLimbReach");

function fighter(extra = {}) {
  return {
    x: 500,
    y: GROUND_LEVEL,
    attackType: "slap",
    slapAnimation: 1,
    ...extra,
  };
}

describe("strike limb vertical reach", () => {
  it("grounded slap reaches a grounded body", () => {
    const atk = fighter();
    const vic = fighter({ x: 560 });
    assert.equal(strikeLimbReachesVictimY(atk, vic), true);
  });

  it("slap limb is the authored arm band, not a 140px column", () => {
    const band = getStrikeLimbUpBand(fighter());
    assert.ok(band.max < 100, `slap limb top ${band.max} must be arm height`);
    assert.ok(band.min > 40, `slap limb bottom ${band.min} is the arm, not the ice`);
  });

  it("low launch is in slap range; high jump is not", () => {
    const atk = fighter();
    const low = fighter({ y: GROUND_LEVEL + 25 });
    const high = fighter({ y: GROUND_LEVEL + 120 });
    assert.equal(strikeLimbReachesVictimY(atk, low), true);
    assert.equal(strikeLimbReachesVictimY(atk, high), false);
  });

  it("low kick cannot anti-air a mid jump", () => {
    const atk = fighter({ attackType: "lowKick", isLowKick: true });
    const mid = fighter({ y: GROUND_LEVEL + 50 });
    assert.equal(strikeLimbReachesVictimY(atk, mid), false);
    assert.equal(strikeLimbReachesVictimY(atk, fighter()), true);
  });

  it("palm and charged use limb/head height, not infinite Y", () => {
    const palm = fighter({ attackType: "charged", isPalmThrust: true });
    const charged = fighter({ attackType: "charged", isPalmThrust: false });
    const high = fighter({ y: GROUND_LEVEL + 120 });
    assert.equal(strikeLimbReachesVictimY(palm, high), false);
    assert.equal(strikeLimbReachesVictimY(charged, high), false);
    assert.equal(strikeLimbReachesVictimY(palm, fighter()), true);
    assert.equal(strikeLimbReachesVictimY(charged, fighter()), true);
  });
});
