/**
 * Run: node --test src/combatPresentation/dodgeStartAudio.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  claimDodgeStartAudio,
  clearDodgeStartAudio,
} from "./dodgeStartAudio.js";

beforeEach(() => {
  clearDodgeStartAudio();
});

describe("claimDodgeStartAudio", () => {
  it("predict then confirm of the same hop is one claim", () => {
    assert.equal(claimDodgeStartAudio("p1", null), true);
    assert.equal(claimDodgeStartAudio("p1", 1000), false);
  });

  it("same dodgeStartTime after remount does not replay", () => {
    assert.equal(claimDodgeStartAudio("p1", 2000), true);
    assert.equal(claimDodgeStartAudio("p1", 2000), false);
  });

  it("late confirm still consumes the pending predict", async () => {
    assert.equal(claimDodgeStartAudio("p1", null), true);
    await new Promise((r) => setTimeout(r, 210));
    assert.equal(claimDodgeStartAudio("p1", 3000), false);
  });

  it("a later hop can sound again", async () => {
    assert.equal(claimDodgeStartAudio("p1", 1), true);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(claimDodgeStartAudio("p1", 2), true);
  });

  it("two fighters do not suppress each other", () => {
    assert.equal(claimDodgeStartAudio("p1", null), true);
    assert.equal(claimDodgeStartAudio("p2", null), true);
  });
});
