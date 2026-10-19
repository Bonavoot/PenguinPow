"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  DODGE_STARTUP_MS,
  DODGE_HOP_MS,
  DODGE_HOP_HEIGHT,
  DODGE_COOLDOWN_MS,
  DODGE_BASE_SPEED,
  DODGE_TRAVEL_DISTANCE,
  DODGE_HOLD_SLIDE_SPEED,
  ICE_MAX_SPEED,
  ICE_SLIDE_MAX_SPEED,
  HITBOX_DISTANCE_VALUE,
  speedFactor,
  GROUND_LEVEL,
} = require("../../constants");
const { createInitialPlayerState } = require("../../playerFactory");
const {
  beginPlayerDodge,
  wantsDodgeLandSlide,
  dodgeLandSlideSpeed,
  rememberDodgeShiftRelease,
} = require("../../gameUtils");

const BODY_PX = HITBOX_DISTANCE_VALUE * 2 * 0.85;

describe("dash tap vs held slide", () => {
  it("the dash is a short hop: charge-hop timing, just under one body", () => {
    assert.equal(DODGE_STARTUP_MS, 0);
    assert.equal(DODGE_HOP_MS, 200);
    assert.equal(DODGE_HOP_HEIGHT, 32);
    assert.equal(
      DODGE_TRAVEL_DISTANCE,
      Math.round(speedFactor * DODGE_BASE_SPEED * DODGE_HOP_MS)
    );
    assert.ok(DODGE_TRAVEL_DISTANCE < BODY_PX);
    assert.ok(DODGE_TRAVEL_DISTANCE > BODY_PX * 0.8);
  });

  it("chained taps are slower than holding the slide", () => {
    const hopPx = speedFactor * DODGE_BASE_SPEED * DODGE_HOP_MS;
    const gapPx = speedFactor * ICE_MAX_SPEED * DODGE_COOLDOWN_MS;
    const tapPxPerMs = (hopPx + gapPx) / (DODGE_HOP_MS + DODGE_COOLDOWN_MS);
    const slidePxPerMs = speedFactor * DODGE_HOLD_SLIDE_SPEED;
    assert.ok(
      tapPxPerMs < slidePxPerMs,
      `tap ${tapPxPerMs.toFixed(3)} px/ms should lose to slide ${slidePxPerMs.toFixed(3)}`
    );
    assert.ok(DODGE_HOLD_SLIDE_SPEED < ICE_SLIDE_MAX_SPEED);
  });

  it("a release during the press is a tap, a clean hold can slide", () => {
    const held = createInitialPlayerState({
      id: "held",
      x: 500,
      y: GROUND_LEVEL,
      facing: -1,
      keys: { shift: true, d: true },
    });
    beginPlayerDodge(held, { nowSim: 1000, direction: 1 });
    assert.equal(held.shiftReleasedDuringDodge, false);
    assert.equal(held.isDodgeStartup, false);
    assert.equal(held.dodgeTargetX, 500 + DODGE_TRAVEL_DISTANCE);
    assert.equal(wantsDodgeLandSlide(held, 1), true);

    const tapped = createInitialPlayerState({
      id: "tapped",
      x: 500,
      y: GROUND_LEVEL,
      facing: -1,
      keys: { shift: true, d: true },
    });
    beginPlayerDodge(tapped, { nowSim: 1000, direction: 1, shiftFell: true });
    assert.equal(tapped.shiftReleasedDuringDodge, true);
    assert.equal(wantsDodgeLandSlide(tapped, 1), false);

    const released = createInitialPlayerState({
      id: "released",
      x: 500,
      y: GROUND_LEVEL,
      facing: -1,
      keys: { shift: false, d: true },
    });
    beginPlayerDodge(released, { nowSim: 1000, direction: 1 });
    assert.equal(released.shiftReleasedDuringDodge, true);
    rememberDodgeShiftRelease(held, true);
    assert.equal(held.shiftReleasedDuringDodge, true);
    assert.equal(wantsDodgeLandSlide(held, 1), false);
  });

  it("a held landing enters the slide faster than walk speed", () => {
    assert.equal(dodgeLandSlideSpeed(1.1), DODGE_HOLD_SLIDE_SPEED);
    assert.ok(dodgeLandSlideSpeed(1.1) > ICE_MAX_SPEED);
    assert.equal(dodgeLandSlideSpeed(2.5), 2.5);
  });
});
