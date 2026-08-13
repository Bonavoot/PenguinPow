/**
 * Run: node --no-warnings --loader ./scripts/extResolve.mjs --test src/combatPresentation/strikeLayer.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STRIKE_Z,
  isSlapLimbOut,
  isPalmLimbOut,
  isOpponentStrikeCompeting,
  resolveStrikeExtendZ,
} from "./strikeLayer.js";

describe("isSlapLimbOut", () => {
  it("is true for smear and hit pose, not windup or recovery", () => {
    assert.equal(isSlapLimbOut(0), false);
    assert.equal(isSlapLimbOut(1), true);
    assert.equal(isSlapLimbOut(2), true);
    assert.equal(isSlapLimbOut(3), false);
  });

  it("connect-hold keeps the limb out even on a recovery frame", () => {
    assert.equal(isSlapLimbOut(3, true), true);
    assert.equal(isSlapLimbOut(0, true), true);
  });
});

describe("isPalmLimbOut", () => {
  it("is true for smear and active, not startup or settle", () => {
    assert.equal(isPalmLimbOut(0), false);
    assert.equal(isPalmLimbOut(1), true);
    assert.equal(isPalmLimbOut(2), true);
    assert.equal(isPalmLimbOut(3), false);
  });
});

describe("isOpponentStrikeCompeting", () => {
  it("needs the pose flag AND isAttacking (recovery drops the hitbox)", () => {
    assert.equal(isOpponentStrikeCompeting(null), false);
    assert.equal(
      isOpponentStrikeCompeting({ isSlapAttack: true, isAttacking: true }),
      true
    );
    assert.equal(
      isOpponentStrikeCompeting({ isSlapAttack: true, isAttacking: false }),
      false
    );
    assert.equal(
      isOpponentStrikeCompeting({ isPalmThrust: true, isAttacking: true }),
      true
    );
    assert.equal(
      isOpponentStrikeCompeting({ isPalmThrust: true, isAttacking: false }),
      false
    );
  });
});

describe("resolveStrikeExtendZ", () => {
  it("returns null when the limb is in", () => {
    assert.equal(resolveStrikeExtendZ({ limbOut: false }), null);
  });

  it("solo swing sits at EXTEND — no confirm required", () => {
    assert.equal(
      resolveStrikeExtendZ({ limbOut: true, opponentCompeting: false }),
      STRIKE_Z.EXTEND
    );
  });

  it("simultaneous: earlier attackStartTime paints above", () => {
    assert.equal(
      resolveStrikeExtendZ({
        limbOut: true,
        selfStart: 100,
        opponentCompeting: true,
        opponentStart: 140,
        facing: -1,
      }),
      STRIKE_Z.EXTEND_LEAD
    );
    assert.equal(
      resolveStrikeExtendZ({
        limbOut: true,
        selfStart: 140,
        opponentCompeting: true,
        opponentStart: 100,
        facing: 1,
      }),
      STRIKE_Z.EXTEND
    );
  });

  it("tied or missing clocks: facing-right leads (grab-arm convention)", () => {
    assert.equal(
      resolveStrikeExtendZ({
        limbOut: true,
        opponentCompeting: true,
        facing: 1,
      }),
      STRIKE_Z.EXTEND_LEAD
    );
    assert.equal(
      resolveStrikeExtendZ({
        limbOut: true,
        opponentCompeting: true,
        facing: -1,
      }),
      STRIKE_Z.EXTEND
    );
    assert.equal(
      resolveStrikeExtendZ({
        limbOut: true,
        selfStart: 50,
        opponentCompeting: true,
        opponentStart: 50,
        facing: 1,
      }),
      STRIKE_Z.EXTEND_LEAD
    );
  });
});
