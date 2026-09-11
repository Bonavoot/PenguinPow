import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  throwTossCrowdIntensity,
  throwTossSmear,
  throwTossLandIntensity,
  isStrongSend,
  opponentPlayerNumber,
  playerNumberFromIds,
} from "./throwTossFeel.js";

describe("throwTossFeel", () => {
  it("only mid/high power asks the crowd to react", () => {
    assert.equal(throwTossCrowdIntensity(0.2), null);
    assert.equal(throwTossCrowdIntensity(0.55), "medium");
    assert.equal(throwTossCrowdIntensity(0.9), "heavy");
  });

  it("smear is a broken-posture tell, not a healthy hop", () => {
    assert.equal(throwTossSmear(0.2), false);
    assert.equal(throwTossSmear(0.5), true);
  });

  it("whoosh and smoke only arm on a really strong send", () => {
    assert.equal(isStrongSend(0.4), false);
    assert.equal(isStrongSend(0.55), true);
  });

  it("belt color resolves the attacker, not the victim", () => {
    assert.equal(opponentPlayerNumber(1), 2);
    assert.equal(opponentPlayerNumber(2), 1);
    assert.equal(playerNumberFromIds("p1", "p1", 1), 1);
    assert.equal(playerNumberFromIds("p1", "p2", 1), 2);
  });

  it("land chip intensity grades with power", () => {
    assert.ok(throwTossLandIntensity(0) >= 0.6);
    assert.ok(throwTossLandIntensity(1) > 0.9);
    assert.ok(throwTossLandIntensity(1) <= 1);
  });
});
