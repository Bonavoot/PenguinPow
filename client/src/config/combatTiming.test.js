/**
 * Run: node --test src/config/combatTiming.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PALM_THRUST_STARTUP_MS,
  PALM_THRUST_ANIM,
  resolvePalmThrustFrame,
  shouldRestartPalmThrustClock,
} from "./combatTiming.js";

describe("PALM_THRUST_ANIM", () => {
  it("ends smear exactly when the server hitbox opens", () => {
    assert.equal(PALM_THRUST_ANIM.SMEAR_END, PALM_THRUST_STARTUP_MS);
    assert.ok(PALM_THRUST_ANIM.STARTUP_END < PALM_THRUST_ANIM.SMEAR_END);
  });

  it("maps startup → smear → active → recovery", () => {
    assert.equal(resolvePalmThrustFrame(0), 0);
    assert.equal(resolvePalmThrustFrame(PALM_THRUST_ANIM.STARTUP_END - 1), 0);
    assert.equal(resolvePalmThrustFrame(PALM_THRUST_ANIM.STARTUP_END), 1);
    assert.equal(resolvePalmThrustFrame(PALM_THRUST_ANIM.SMEAR_END - 1), 1);
    assert.equal(resolvePalmThrustFrame(PALM_THRUST_ANIM.SMEAR_END), 2);
    assert.equal(resolvePalmThrustFrame(PALM_THRUST_ANIM.ACTIVE_END - 1), 2);
    assert.equal(resolvePalmThrustFrame(PALM_THRUST_ANIM.ACTIVE_END), 3);
  });

  it("does not rewind a predicted thrust when fxId first confirms", () => {
    assert.equal(shouldRestartPalmThrustClock(0, 1, 20), false);
    assert.equal(
      shouldRestartPalmThrustClock(0, 1, PALM_THRUST_ANIM.SMEAR_END - 1),
      false
    );
  });

  it("restarts for a new thrust after smear, and for drive-release swaps", () => {
    assert.equal(
      shouldRestartPalmThrustClock(1, 2, PALM_THRUST_ANIM.SMEAR_END),
      true
    );
    assert.equal(shouldRestartPalmThrustClock(1, 1, 200), false);
    assert.equal(shouldRestartPalmThrustClock(4, "sep", 10), true);
    assert.equal(shouldRestartPalmThrustClock("sep", 5, 10), true);
  });
});
