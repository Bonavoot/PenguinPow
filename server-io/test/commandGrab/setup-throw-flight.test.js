"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { GROUND_LEVEL, SETUP_THROW_DURATION_MS } = require("../../constants");
const { beginGrabStartup } = require("../../gameUtils");
const { CLINCH_THROW_KILL_THRESHOLD } = require("../../constants");
const { MAP_RIGHT_BOUNDARY } = require("../../gameUtils");
const { isAirborneForGroundCollision } = require("../../groundCollision");
const {
  isSetupThrowFlightLive,
  stepSetupThrowFlight,
  abortLiveSetupThrowOnInterrupt,
} = require("../../setupThrowFlight");
const { createCommandGrabScenario } = require("./harness/scenario");

test("resolve stamps the dump on the victim, not just the thrower", () => {
  const s = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
  s.connect().resolveNow();
  assert.equal(isSetupThrowFlightLive(s.victim), true);
  assert.equal(s.victim.throwLandX, s.grabber.throwLandX);
  assert.equal(s.victim.throwEndTime, s.grabber.throwEndTime);
  assert.ok(Number.isFinite(s.victim.throwStartX));
  assert.equal(abortLiveSetupThrowOnInterrupt(s.victim), false);
});

test("kill throw does not stamp a setup dump on the victim", () => {
  const kill = createCommandGrabScenario({
    variant: "throw",
    p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    midX: MAP_RIGHT_BOUNDARY - 40,
  });
  kill.connect().resolveNow();
  assert.equal(kill.grabber.isClinchKillThrow, true);
  assert.equal(isSetupThrowFlightLive(kill.victim), false);
  assert.equal(abortLiveSetupThrowOnInterrupt(kill.victim), true);
});

test("grab mid-dump does not freeze the victim in the air", () => {
  const s = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
  s.connect().resolveNow();
  const startX = s.victim.x;
  const startY = s.victim.y;

  beginGrabStartup(s.grabber, s.room);
  assert.equal(s.grabber.isGrabStartup, true);
  assert.equal(s.grabber.isThrowing, true, "grab attempt must not clear the toss");
  assert.equal(isSetupThrowFlightLive(s.victim), true);

  let maxY = startY;
  let lastX = startX;
  let moved = false;
  const stepMs = 16;
  for (let t = 0; t < SETUP_THROW_DURATION_MS - 16; t += stepMs) {
    s.advanceTime(stepMs);
    const pose = stepSetupThrowFlight(s.victim, s.room.simTime);
    assert.equal(pose.progressed, true);
    assert.equal(pose.landed, false);
    maxY = Math.max(maxY, s.victim.y);
    if (Math.abs(s.victim.x - lastX) > 0.5) moved = true;
    lastX = s.victim.x;
  }

  assert.ok(maxY > startY + 20, `must keep arcing during grab, maxY=${maxY}`);
  assert.ok(moved, "X must keep traveling while the thrower is in grab startup");
  assert.equal(s.victim.isBeingThrown, true);

  s.advanceTime(32);
  const land = stepSetupThrowFlight(s.victim, s.room.simTime);
  assert.equal(land.landed, true);
  assert.ok(Math.abs(s.victim.y - GROUND_LEVEL) < 1);
  assert.ok(Math.abs(s.victim.x - s.victim.throwLandX) < 1);
});

test("a being-thrown penguin is airborne for grab even at ice height", () => {
  assert.equal(
    isAirborneForGroundCollision(
      { isBeingThrown: true, y: GROUND_LEVEL },
      { forGrab: true }
    ),
    true
  );
  assert.equal(
    isAirborneForGroundCollision({ isBeingThrown: false, y: GROUND_LEVEL }),
    false
  );
});
