/**
 * Prediction eligibility around an airborne opponent.
 * Run: node --test client/src/prediction/movementPredictor.eligibility.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPredictionEligible,
  PREDICTION_CONSTANTS as C,
} from "./movementPredictor.js";

const KEYS_D = {
  a: false,
  d: true,
  " ": false,
  mouse1: false,
  mouse2: false,
};

function groundedSelf(x) {
  return {
    x,
    y: C.GROUND_LEVEL,
    sizeMultiplier: 0.85,
    movementVelocity: 0.4,
  };
}

describe("isPredictionEligible — airborne opponent is not a pushbox wall", () => {
  it("stays eligible walking under a slide-jump in flight", () => {
    const self = groundedSelf(500);
    const opponent = {
      x: 540,
      y: C.GROUND_LEVEL + 90,
      sizeMultiplier: 0.85,
      isSlideJumping: true,
      slideJumpPhase: "flight",
    };
    assert.equal(isPredictionEligible(self, opponent, KEYS_D, true), true);
  });

  it("still suspends when walking into a standing pushbox", () => {
    const self = groundedSelf(500);
    const opponent = {
      x: 540,
      y: C.GROUND_LEVEL,
      sizeMultiplier: 0.85,
      isSlideJumping: false,
    };
    assert.equal(isPredictionEligible(self, opponent, KEYS_D, true), false);
  });
});
