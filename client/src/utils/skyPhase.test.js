/**
 * Run: node --test client/src/utils/skyPhase.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { skyPhaseIndex, skyPhaseName } from "./skyPhase.js";

describe("skyPhaseIndex", () => {
  it("splits a 15-day basho into three equal acts", () => {
    const phases = Array.from({ length: 15 }, (_, i) => skyPhaseIndex(i + 1, 15));
    assert.deepEqual(phases.slice(0, 5), [0, 0, 0, 0, 0]);
    assert.deepEqual(phases.slice(5, 10), [1, 1, 1, 1, 1]);
    assert.deepEqual(phases.slice(10, 15), [2, 2, 2, 2, 2]);
  });

  it("splits a 7-day basho 3 / 2 / 2", () => {
    const names = Array.from({ length: 7 }, (_, i) => skyPhaseName(i + 1, 7));
    assert.deepEqual(names, [
      "day",
      "day",
      "day",
      "afternoon",
      "afternoon",
      "night",
      "night",
    ]);
  });

  it("gives best-of-3 one phase per round", () => {
    assert.equal(skyPhaseName(1, 3), "day");
    assert.equal(skyPhaseName(2, 3), "afternoon");
    assert.equal(skyPhaseName(3, 3), "night");
  });

  it("clamps a step past the end of the run", () => {
    assert.equal(skyPhaseName(9, 3), "night");
    assert.equal(skyPhaseIndex(0, 15), 0);
  });
});
