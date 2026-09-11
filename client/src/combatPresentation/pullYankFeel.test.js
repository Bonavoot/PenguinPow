import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pullYankHopProfile,
  pullYankHopSchedule,
  pullYankCrowdIntensity,
  smashLaunchAmount,
  yankSnapEnd,
  YANK_SNAP_END,
} from "./pullYankFeel.js";

describe("pullYankFeel", () => {
  it("healthy hops are short scrapes after the snap", () => {
    const hops = pullYankHopProfile(0);
    assert.equal(hops.hopDelay, YANK_SNAP_END);
    assert.equal(hops.hopCount, 2);
    assert.ok(hops.hopHeights[0] <= 6);
  });

  it("heavy hops stay on the decay — the take/snap must play first", () => {
    const hops = pullYankHopProfile(1);
    assert.equal(hops.hopCount, 2);
    assert.ok(hops.hopHeights[0] >= 9 && hops.hopHeights[0] <= 12);
    assert.ok(hops.hopDelay > YANK_SNAP_END);
    assert.ok(yankSnapEnd(1) <= hops.hopDelay);
    assert.equal(smashLaunchAmount(0.55), 1);
  });

  it("schedules landings from the live duration and snap", () => {
    const short = pullYankHopSchedule(380, 0);
    const hard = pullYankHopSchedule(460, 1);
    assert.ok(hard.hopDelay >= short.hopDelay);
    assert.ok(hard.hopDuration > 80);
    assert.equal(short.hopCount, 2);
    assert.equal(hard.hopCount, 2);
  });

  it("only mid/high power asks the crowd to react", () => {
    assert.equal(pullYankCrowdIntensity(0.2), null);
    assert.equal(pullYankCrowdIntensity(0.55), "medium");
    assert.equal(pullYankCrowdIntensity(0.9), "heavy");
  });
});
