import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SLIDE_FOOT_LEFT,
  SLIDE_FOOT_RIGHT,
  STANDING_SOLE_BIAS,
  contactPoseFromFighter,
  iceContactStyle,
  worldFootXs,
} from "./spriteFeet.js";

describe("sprite feet", () => {
  it("mirrors the standing sole about the body", () => {
    const right = worldFootXs(640, -1, "standing")[0];
    const left = worldFootXs(640, 1, "standing")[0];
    assert.equal(right, 640 - STANDING_SOLE_BIAS);
    assert.equal(left, 640 + STANDING_SOLE_BIAS);
  });

  it("places slide pads on the smoke feet, mirrored", () => {
    const faceRight = worldFootXs(500, -1, "sliding");
    assert.deepEqual(faceRight, [
      500 - SLIDE_FOOT_LEFT,
      500 - SLIDE_FOOT_RIGHT,
    ]);
    assert.ok(faceRight[0] > 500);
    assert.ok(faceRight[1] < 500);
  });

  it("hides contact in the air and uses two pads only while sliding", () => {
    assert.equal(
      contactPoseFromFighter({ isDodging: true, y: 286 }, 286),
      "air"
    );
    assert.equal(
      contactPoseFromFighter({ isIceSliding: true }, 286),
      "sliding"
    );
    assert.equal(
      contactPoseFromFighter({ isSidestepping: true }, 270),
      "sidestep"
    );
    assert.equal(contactPoseFromFighter({}, 286), "standing");
    assert.equal(
      contactPoseFromFighter({}, 310),
      "air"
    );
  });

  it("shifts the oval onto the sole instead of box center", () => {
    const stand = iceContactStyle("standing", -1, 0);
    assert.match(stand.shift, /^-/);
    assert.notEqual(stand.shift, "0%");
    const slide = iceContactStyle("sliding", 1, 1);
    assert.equal(slide.width, "70%");
    assert.equal(iceContactStyle("air", -1, 1).width, "22%");
  });
});
