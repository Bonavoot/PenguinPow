"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  smashLaunchAmount,
  smashBallisticY,
  smashDecayTravel,
  smashLaunchVy,
  smashLaunchVx,
  smashDecayKForThrow,
  smashDecayKForPull,
  smashResidualPxPerSec,
  launchIceCoastVelocity,
  THROW_DECAY_K,
  PULL_DECAY_K,
  ICE_CONTINUE_CAP,
} = require("../../smashLaunchMotion");
const { ICE_MAX_SPEED } = require("../../constants");

test("posture weight is continuous — no 52-to-44 mode switch", () => {
  assert.equal(smashLaunchAmount(0), 0);
  assert.equal(smashLaunchAmount(0.2), 0.2);
  assert.equal(smashLaunchAmount(0.44), 0.44);
  assert.equal(smashLaunchAmount(0.52), 0.52);
  assert.equal(smashLaunchAmount(1), 1);
  assert.ok(
    smashLaunchAmount(0.52) - smashLaunchAmount(0.44) < 0.15,
    "eight points of bar must not flip the movie"
  );
});

test("ballistic Y is a constant-g parabola — peak at mid-flight, symmetric", () => {
  const h = 100;
  assert.equal(smashBallisticY(0, h), 0);
  assert.equal(smashBallisticY(1, h), 0);
  assert.ok(Math.abs(smashBallisticY(0.5, h) - h) < 1e-9);
  for (const d of [0.1, 0.2, 0.35]) {
    assert.ok(
      Math.abs(smashBallisticY(0.5 - d, h) - smashBallisticY(0.5 + d, h)) < 1e-9,
      `rise/fall must match at ±${d}`
    );
  }
  assert.ok(
    Math.abs(smashBallisticY(0.25, h) - h * 4 * 0.25 * 0.75) < 1e-9
  );
});

test("air-drag send is a decaying burst, not a cruise", () => {
  const k = THROW_DECAY_K;
  assert.equal(smashDecayTravel(0, k), 0);
  assert.equal(smashDecayTravel(1, k), 1);
  assert.equal(smashDecayTravel(0.5, 0), 0.5, "k=0 is a linear cruise");
  const firstHalf = smashDecayTravel(0.5, k);
  const lastQuarter = 1 - smashDecayTravel(0.75, k);
  assert.ok(
    smashDecayTravel(0.25, k) > 0.42,
    `hard hit must leave immediately, got ${smashDecayTravel(0.25, k).toFixed(3)}`
  );
  assert.ok(
    firstHalf > 0.70,
    `first half does most of the send (resistance), got ${firstHalf.toFixed(3)}`
  );
  assert.ok(
    firstHalf > 1 - firstHalf,
    "first half must out-travel the second — that is the drag read"
  );
  assert.ok(
    lastQuarter > 0.05 && lastQuarter < 0.18,
    `last quarter is a crawl, not a stop and not a cruise: ${lastQuarter.toFixed(3)}`
  );
});

test("shorter clock + same height is a faster launch (Smash v0 = 2H/T)", () => {
  const healthyVy = smashLaunchVy(50, 400);
  const brokenVy = smashLaunchVy(112, 325);
  assert.ok(
    brokenVy > healthyVy * 2.4,
    `broken rise must be a real launch: ${healthyVy.toFixed(0)} vs ${brokenVy.toFixed(0)}`
  );
  const healthyVx = smashLaunchVx(185, 400, 0);
  const brokenVx = smashLaunchVx(245, 325, smashDecayKForThrow(1));
  assert.ok(
    brokenVx > healthyVx * 2.4,
    `broken X launch: ${healthyVx.toFixed(0)} vs ${brokenVx.toFixed(0)}`
  );
});

test("throw/pull leftover speed becomes a DI-able ice coast", () => {
  assert.equal(smashDecayKForThrow(0), 0);
  assert.equal(smashDecayKForPull(0), 0);
  assert.ok(Math.abs(smashDecayKForThrow(1) - THROW_DECAY_K) < 1e-9);
  assert.ok(Math.abs(smashDecayKForPull(1) - PULL_DECAY_K) < 1e-9);
  assert.equal(smashResidualPxPerSec(245, 325, 0), 0);
  assert.equal(
    launchIceCoastVelocity({
      distancePx: 245,
      durationMs: 325,
      power: 0,
      dir: 1,
      kind: "throw",
    }),
    0,
    "healthy plant — no extra ice"
  );

  const throwCoast = launchIceCoastVelocity({
    distancePx: 245,
    durationMs: 325,
    power: 1,
    dir: 1,
    kind: "throw",
  });
  assert.ok(
    throwCoast > 0.28 && throwCoast <= ICE_CONTINUE_CAP + 1e-9,
    `throw ice leftover should be a scoot, got ${throwCoast.toFixed(3)}`
  );
  assert.ok(
    ICE_CONTINUE_CAP < ICE_MAX_SPEED,
    "coast cap stays under walk-top so it cannot rewrite KO range"
  );
});
