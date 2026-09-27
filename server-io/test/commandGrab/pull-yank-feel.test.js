"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CMD_PULL_DISTANCE_MIN,
  CMD_PULL_DISTANCE_MAX,
  CMD_PULL_TWEEN_MIN_MS,
  CMD_PULL_TWEEN_BROKEN_MS,
  BALANCE_MAX,
  CLINCH_THROW_KILL_THRESHOLD,
  speedFactor,
} = require("../../constants");
const {
  yankEase,
  yankSnapEnd,
  yankHandoffVelocity,
  yankEndPxPerSec,
  YANK_TAKE_END,
  YANK_SNAP_END,
  YANK_TAKE_DIST,
  HEAVY_TAKE_END,
  HEAVY_SNAP_END,
  HEAVY_TAKE_DIST,
  describePullYank,
  pullYankDurationMs,
  pullYankHopProfile,
  sampleYankPeakPxPerSec,
  sampleYankSpeedAt,
} = require("../../pullYankMotion");
const { smashLaunchAmount } = require("../../smashLaunchMotion");
const { grabSeparationEase } = require("../../combatHelpers");
const { createCommandGrabScenario } = require("./harness/scenario");
const { pullTravelPx } = require("../../commandGrabSystem");

function hitEasePeakPxPerSec(distancePx, durationMs, steps = 240) {
  const dt = durationMs / steps / 1000;
  let peak = 0;
  let prev = 0;
  for (let i = 1; i <= steps; i++) {
    const x = grabSeparationEase(i / steps, "hit") * distancePx;
    const v = Math.abs(x - prev) / dt;
    if (v > peak) peak = v;
    prev = x;
  }
  return peak;
}

test("healthy yank still has inertia, then a snap, then a long slide", () => {
  assert.equal(yankEase(0), 0);
  assert.equal(yankEase(1), 1);
  assert.ok(
    yankEase(YANK_TAKE_END) <= YANK_TAKE_DIST + 0.001,
    "TAKE must barely move them — that is the weight"
  );
  assert.ok(
    yankEase(0.08) < 0.04,
    `early TAKE must look planted, got ${yankEase(0.08)}`
  );
  const midSnap = yankEase((YANK_TAKE_END + YANK_SNAP_END) / 2);
  assert.ok(midSnap > 0.2 && midSnap < 0.55, `snap mid ${midSnap}`);
  assert.ok(
    yankEase(YANK_SNAP_END) >= 0.55 && yankEase(YANK_SNAP_END) <= 0.62,
    `most of the send happens by the end of the snap, got ${yankEase(YANK_SNAP_END)}`
  );
  const slideTravel = 1 - yankEase(YANK_SNAP_END);
  assert.ok(
    slideTravel >= 0.35,
    `slide must carry real remaining distance (weight), got ${slideTravel}`
  );
});

test("low-posture yank is a heavy take, then a strong decaying pull", () => {
  assert.equal(smashLaunchAmount(1), 1);
  assert.ok(smashLaunchAmount(0.55) > 0.5 && smashLaunchAmount(0.55) < 1);
  assert.equal(yankEase(0, 1), 0);
  assert.equal(yankEase(1, 1), 1);
  assert.ok(
    Math.abs(yankEase(0.3, 0.44) - yankEase(0.3, 0.52)) < 0.08,
    "a few points of posture must not change the yank's movie"
  );
  assert.ok(
    yankEase(0.08, 1) < 0.04,
    `heavy TAKE must still look planted, got ${yankEase(0.08, 1).toFixed(3)}`
  );
  assert.ok(
    yankEase(HEAVY_TAKE_END, 1) <= HEAVY_TAKE_DIST + 0.001,
    "the belt loads before they move — that is the penguin"
  );
  assert.ok(
    yankEase(HEAVY_SNAP_END, 1) >= 0.54 && yankEase(HEAVY_SNAP_END, 1) <= 0.62,
    `snap delivers the pull, got ${yankEase(HEAVY_SNAP_END, 1).toFixed(3)}`
  );
  const tail = 1 - yankEase(0.75, 1);
  assert.ok(
    tail > 0.08 && tail < 0.28,
    `decay tail must still be traveling at 75%: remaining ${tail.toFixed(3)}`
  );
  const peak = sampleYankPeakPxPerSec(
    CMD_PULL_DISTANCE_MAX,
    CMD_PULL_TWEEN_BROKEN_MS,
    1
  );
  const late = sampleYankSpeedAt(
    0.88,
    CMD_PULL_DISTANCE_MAX,
    CMD_PULL_TWEEN_BROKEN_MS,
    1
  );
  assert.ok(
    late > peak * 0.10 && late < peak * 0.45,
    `late speed is leftover drag, not a cruise: late ${late.toFixed(0)} vs peak ${peak.toFixed(0)}`
  );
});

test("grabSeparationEase yank matches the motion module", () => {
  for (const t of [0, 0.1, 0.16, 0.3, 0.38, 0.7, 1]) {
    assert.ok(Math.abs(grabSeparationEase(t, "yank") - yankEase(t)) < 1e-9);
    assert.ok(Math.abs(grabSeparationEase(t, "yank", 1) - yankEase(t, 1)) < 1e-9);
  }
});

test("pull duration grows and hops stay after the snap on a heavy victim", () => {
  const healthy = describePullYank(BALANCE_MAX);
  const broken = describePullYank(CLINCH_THROW_KILL_THRESHOLD);
  assert.equal(healthy.durationMs, CMD_PULL_TWEEN_MIN_MS);
  assert.equal(broken.durationMs, CMD_PULL_TWEEN_BROKEN_MS);
  assert.ok(broken.durationMs > healthy.durationMs);
  assert.ok(healthy.power < 0.05);
  assert.ok(broken.power > 0.95);
  assert.equal(healthy.curve, "yank");
  assert.equal(healthy.hops.hopCount, 2);
  assert.ok(healthy.hops.hopHeights[0] <= 6, "healthy hops are scrapes");
  assert.equal(broken.hops.hopCount, 2);
  assert.ok(broken.hops.hopHeights[0] >= 9 && broken.hops.hopHeights[0] <= 12);
  assert.equal(healthy.hops.hopDelay, YANK_SNAP_END);
  assert.ok(
    broken.hops.hopDelay >= healthy.hops.hopDelay,
    "hops must wait for the take/snap — they sell the slide"
  );
  assert.equal(yankSnapEnd(0), YANK_SNAP_END);
  assert.ok(yankSnapEnd(1) <= broken.hops.hopDelay);
  assert.equal(pullYankHopProfile(0).hopCount, pullYankHopProfile(1).hopCount);
});

test("a max-power yank is a heavy pull, not the old light-speed fling", () => {
  const oldPeak = hitEasePeakPxPerSec(CMD_PULL_DISTANCE_MAX, 320);
  const newPeak = sampleYankPeakPxPerSec(
    CMD_PULL_DISTANCE_MAX,
    CMD_PULL_TWEEN_BROKEN_MS,
    1
  );
  const healthyPeak = sampleYankPeakPxPerSec(
    CMD_PULL_DISTANCE_MIN,
    CMD_PULL_TWEEN_MIN_MS,
    0
  );
  assert.ok(
    newPeak < oldPeak * 0.70,
    `heavy peak ${newPeak.toFixed(0)} must stay well under the old ${oldPeak.toFixed(0)} px/s fling`
  );
  assert.ok(
    newPeak > healthyPeak * 1.15,
    `heavy still hits harder (more distance): ${healthyPeak.toFixed(0)} vs ${newPeak.toFixed(0)}`
  );
  assert.ok(
    newPeak < 1400,
    `must be digestible, not a blink: ${newPeak.toFixed(0)} px/s`
  );
});

test("heavy yank leftover hands off 1:1 onto ice — no plant hitch", () => {
  assert.equal(
    yankHandoffVelocity(CMD_PULL_DISTANCE_MIN, CMD_PULL_TWEEN_MIN_MS, 0, 1),
    0,
    "healthy ease-out plants"
  );
  const endPx = yankEndPxPerSec(
    CMD_PULL_DISTANCE_MAX,
    CMD_PULL_TWEEN_BROKEN_MS,
    1
  );
  const coast = yankHandoffVelocity(
    CMD_PULL_DISTANCE_MAX,
    CMD_PULL_TWEEN_BROKEN_MS,
    1,
    -1
  );
  assert.ok(endPx > 80, `must still be sliding at unlock, got ${endPx.toFixed(0)} px/s`);
  const expected = endPx / (1000 * speedFactor);
  assert.ok(
    Math.abs(Math.abs(coast) - expected) < 0.02,
    `handoff must match last tween speed: ice ${Math.abs(coast).toFixed(3)} vs ${expected.toFixed(3)}`
  );
  assert.ok(coast < 0, "pull leftover keeps yank direction");
});

test("command grab pull stamps the weighted yank", async (t) => {
  await t.test("healthy vs battered: farther AND heavier, same lock as travel", () => {
    const healthy = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    healthy.connect().resolveNow();
    const battered = createCommandGrabScenario({ variant: "pull", p2Balance: 20 });
    battered.connect().resolveNow();

    const hDist = Math.abs(healthy.victim.grabBreakTargetX - healthy.grabber.x);
    const bDist = Math.abs(battered.victim.grabBreakTargetX - battered.grabber.x);
    assert.ok(bDist > hDist * 1.5);
    assert.equal(healthy.victim.grabBreakSepCurve, "yank");
    assert.equal(battered.victim.grabBreakSepCurve, "yank");
    assert.ok(battered.victim.grabBreakSepDuration > healthy.victim.grabBreakSepDuration);
    assert.equal(
      healthy.grabber.actionLockUntil,
      healthy.room.simTime + healthy.victim.grabBreakSepDuration
    );
    assert.equal(
      battered.victim.grabBreakSepDuration,
      pullYankDurationMs(20)
    );
    assert.ok(battered.victim.pullYankPower > healthy.victim.pullYankPower);
  });

  await t.test("emits pull_yank juice with the live duration and power", () => {
    const s = createCommandGrabScenario({ variant: "pull", p2Balance: 20 });
    s.connect().resolveNow();
    const ev = s.io.last("pull_yank");
    assert.ok(ev, "pull_yank must fire for a regular yank");
    assert.equal(ev.payload.victimId, s.victim.id);
    assert.ok(ev.payload.durationMs === s.victim.grabBreakSepDuration);
    assert.ok(ev.payload.power > 0.5);
    assert.ok(ev.payload.combatPresentation);
    assert.equal(
      ev.payload.combatPresentation.interactionType,
      "pull_yank"
    );
    const shake = s.io.last("screen_shake");
    assert.equal(shake?.payload?.type, "pull_yank");
  });

  await t.test("kill and swap do not steal the weighted curve", () => {
    const kill = createCommandGrabScenario({
      variant: "pull",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
      midX: require("../../gameUtils").MAP_LEFT_BOUNDARY + 70,
    });
    kill.connect().resolveNow();
    assert.notEqual(kill.victim.grabBreakSepCurve, "yank");

    const travel = pullTravelPx(100);
    const wall = createCommandGrabScenario({
      variant: "pull",
      p2Balance: 100,
      midX: require("../../gameUtils").MAP_LEFT_BOUNDARY + 40,
    });
    wall.connect().resolveNow();
    if (wall.victim.isBoundaryPullSwap) {
      assert.notEqual(wall.victim.grabBreakSepCurve, "yank");
    }
    assert.ok(travel > 0);
  });
});
