"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  facingTowardOpponent,
  getLockedFacing,
  enforcePlayerFacing,
  enforcePairFacing,
} = require("../../facingSystem");

function makePlayer(overrides = {}) {
  return {
    id: overrides.id || "p",
    x: 100,
    facing: -1,
    slapFacingDirection: null,
    chargingFacingDirection: null,
    atTheRopesFacingDirection: null,
    beingThrownFacingDirection: null,
    isAttacking: false,
    isChargingAttack: false,
    isDodging: false,
    isSidestepping: false,
    isFlapping: false,
    isSlideJumping: false,
    isRopeJumping: false,
    isIceSliding: false,
    isHit: false,
    isThrowing: false,
    isBeingThrown: false,
    isClinchKillPullVictim: false,
    isRingOutPushCutscene: false,
    ...overrides,
  };
}

describe("facingSystem hard rule", () => {
  it("facingTowardOpponent uses relative X ( -1 faces right, 1 faces left )", () => {
    const left = makePlayer({ x: 100 });
    const right = makePlayer({ x: 200 });
    assert.equal(facingTowardOpponent(left, right), -1);
    assert.equal(facingTowardOpponent(right, left), 1);
  });

  it("neutral players always face each other after a side switch", () => {
    // After crossing, both still look right (facing === -1) — the classic bug
    const p1 = makePlayer({ id: "p1", x: 300, facing: -1 });
    const p2 = makePlayer({ id: "p2", x: 100, facing: -1 });
    assert.equal(p1.facing, p2.facing);

    enforcePairFacing(p1, p2);

    assert.equal(p1.facing, 1); // look left toward p2
    assert.equal(p2.facing, -1); // look right toward p1
    assert.notEqual(p1.facing, p2.facing);
  });

  it("ice-slide / rope-jump are NOT locks — face opponent through side switch", () => {
    const slider = makePlayer({
      id: "slider",
      x: 250,
      facing: -1, // travel-facing stale
      isIceSliding: true,
    });
    const grounded = makePlayer({ id: "ground", x: 100, facing: -1 });

    assert.equal(getLockedFacing(slider), null);
    enforcePairFacing(slider, grounded);
    assert.equal(slider.facing, 1);
    assert.equal(grounded.facing, -1);
  });

  it("flap excludes flier from auto-face; grounded opponent still faces them", () => {
    const flier = makePlayer({
      id: "flier",
      x: 250,
      facing: -1, // free air facing — auto-face must not overwrite
      isFlapping: true,
    });
    const grounded = makePlayer({ id: "ground", x: 100, facing: 1 });

    assert.equal(getLockedFacing(flier), -1);
    assert.equal(getLockedFacing(grounded), null);
    enforcePairFacing(flier, grounded);
    assert.equal(flier.facing, -1); // untouched by auto-face
    assert.equal(grounded.facing, -1); // looks at flier
  });

  it("dodge hop freezes facing (travel is dodgeDirection)", () => {
    const dodger = makePlayer({
      id: "dodge",
      x: 250,
      facing: -1, // locked looking right even though now on the right
      isDodging: true,
    });
    const other = makePlayer({ id: "other", x: 100, facing: 1 });

    assert.equal(getLockedFacing(dodger), -1);
    enforcePairFacing(dodger, other);
    assert.equal(dodger.facing, -1); // still frozen
    assert.equal(other.facing, -1); // other faces the dodger
  });

  it("slapFacingDirection / attack / ropes / throw victim stay locked", () => {
    const cases = [
      makePlayer({ slapFacingDirection: 1, facing: -1, x: 300 }),
      makePlayer({ isAttacking: true, chargingFacingDirection: 1, facing: -1, x: 300 }),
      makePlayer({ atTheRopesFacingDirection: 1, facing: -1, x: 300 }),
      makePlayer({ beingThrownFacingDirection: 1, facing: -1, x: 300 }),
      makePlayer({ isClinchKillPullVictim: true, facing: 1, x: 300 }),
      makePlayer({ isChargingAttack: true, chargingFacingDirection: 1, facing: -1, x: 300 }),
    ];
    const opp = makePlayer({ x: 100 });

    for (const p of cases) {
      enforcePlayerFacing(p, opp);
      // All locked looking left (1) despite being on the right of opp
      assert.equal(p.facing, 1, `expected lock to hold for ${JSON.stringify(p)}`);
    }
  });

  it("when both are hit, neither facing is auto-corrected", () => {
    const p1 = makePlayer({ id: "p1", x: 300, facing: -1, isHit: true });
    const p2 = makePlayer({ id: "p2", x: 100, facing: -1, isHit: true });
    enforcePairFacing(p1, p2);
    assert.equal(p1.facing, -1);
    assert.equal(p2.facing, -1);
  });

  it("sidestep freezes; after sidestep ends, pair re-faces", () => {
    const p1 = makePlayer({
      id: "p1",
      x: 300,
      facing: -1,
      isSidestepping: true,
    });
    const p2 = makePlayer({ id: "p2", x: 100, facing: 1 });

    enforcePairFacing(p1, p2);
    assert.equal(p1.facing, -1);

    p1.isSidestepping = false;
    enforcePairFacing(p1, p2);
    assert.equal(p1.facing, 1);
    assert.equal(p2.facing, -1);
  });
});
