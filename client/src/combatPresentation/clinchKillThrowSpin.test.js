import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createKillThrowFlight,
  poseKillThrowFlight,
  resetKillThrowFlight,
  killThrowSpinFromProgress,
  KILL_THROW_ARC_HEIGHT,
} from "./clinchKillThrowSpin.js";

const GROUND = 286;
const FALL = 37;
const ARC = KILL_THROW_ARC_HEIGHT;

function step(flight, y, x, offDohyo) {
  return poseKillThrowFlight(flight, {
    y,
    x,
    offDohyo,
    ground: GROUND,
    arcHeight: ARC,
    fallDepth: FALL,
    dohyoLeft: 250,
    dohyoRight: 1030,
  });
}

function walk(ys, xs, offDohyo) {
  const flight = createKillThrowFlight();
  const poses = [];
  for (let i = 0; i < ys.length; i++) {
    poses.push(step(flight, ys[i], xs[i], offDohyo));
  }
  return poses;
}

describe("clinchKillThrowSpin", () => {
  it("starts upright and is flat at the end of the tumble", () => {
    assert.equal(killThrowSpinFromProgress(0).rotateDeg, 0);
    assert.equal(killThrowSpinFromProgress(1).rotateDeg, 90);
    assert.equal(killThrowSpinFromProgress(1).translateYPct, 18);
  });

  it("rotates continuously to flat on the ring", () => {
    const ys = [];
    for (let i = 0; i <= 16; i++) ys.push(GROUND + (ARC * i) / 16);
    for (let i = 1; i <= 16; i++) ys.push(GROUND + ARC + (GROUND - (GROUND + ARC)) * (i / 16));
    const xs = ys.map(() => 700);
    const poses = walk(ys, xs, false);
    for (let i = 1; i < poses.length; i++) {
      assert.ok(
        poses[i].rotateDeg + 0.01 >= poses[i - 1].rotateDeg,
        `rotation rewound ${poses[i - 1].rotateDeg} → ${poses[i].rotateDeg}`
      );
    }
    const last = poses[poses.length - 1];
    assert.equal(last.landY, GROUND);
    assert.ok(Math.abs(last.rotateDeg - 90) < 0.05, `landed at ${last.rotateDeg}`);
  });

  it("does not reset when the body crosses the dohyo edge, and lands flat on the lower apron", () => {
    const ys = [];
    for (let i = 0; i <= 16; i++) ys.push(GROUND + (ARC * i) / 16);
    const low = GROUND - FALL;
    for (let i = 1; i <= 20; i++) {
      ys.push(GROUND + ARC + (low - (GROUND + ARC)) * (i / 20));
    }
    // Cross 1030 halfway down, while still well above both grounds.
    const xs = ys.map((y, i) => (i < 24 ? 900 : 1100));
    const poses = walk(ys, xs, true);
    const cross = poses[24];
    assert.ok(cross.rotateDeg > 20, `still tumbling at the edge (${cross.rotateDeg})`);
    assert.ok(cross.rotateDeg < 80, `not already flat at the edge (${cross.rotateDeg})`);
    for (let i = 1; i < poses.length; i++) {
      assert.ok(
        poses[i].rotateDeg + 0.01 >= poses[i - 1].rotateDeg,
        `reset at sample ${i}: ${poses[i - 1].rotateDeg} → ${poses[i].rotateDeg}`
      );
    }
    const last = poses[poses.length - 1];
    assert.equal(last.landY, low);
    assert.ok(Math.abs(last.rotateDeg - 90) < 0.05, `lower apron land ${last.rotateDeg}`);
    assert.ok(Math.abs(last.translateYPct - 18) < 0.05);
  });

  it("keeps the tumble moving forward if the landing plane drops mid-fall", () => {
    const flight = createKillThrowFlight();
    const rise = [];
    for (let i = 0; i <= 16; i++) rise.push(GROUND + (ARC * i) / 16);
    for (const y of rise) step(flight, y, 900, false);
    let prev = step(flight, GROUND + ARC - 20, 900, false);
    // Still inside the ring, falling toward GROUND_LEVEL.
    prev = step(flight, 400, 1000, false);
    const before = prev.rotateDeg;
    // Edge crossed — apron is lower. Angle must not snap back toward upright.
    const after = step(flight, 400, 1100, true);
    assert.ok(after.rotateDeg + 0.01 >= before, `${before} → ${after.rotateDeg}`);
    const landed = step(flight, GROUND - FALL, 1100, true);
    assert.ok(Math.abs(landed.rotateDeg - 90) < 0.05);
    assert.equal(landed.landY, GROUND - FALL);
  });

  it("reset clears a finished flight", () => {
    const flight = createKillThrowFlight();
    step(flight, GROUND + ARC, 700, false);
    resetKillThrowFlight(flight);
    const again = step(flight, GROUND, 700, false);
    assert.ok(again.rotateDeg < 1);
  });
});
