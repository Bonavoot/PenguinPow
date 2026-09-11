"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BALANCE_MAX,
  CLINCH_THROW_KILL_THRESHOLD,
  SETUP_THROW_ARC_HEIGHT,
  SETUP_THROW_DURATION_MS,
  SETUP_THROW_TRAVEL_PX,
  SETUP_THROW_RICOCHET_DURATION_MS,
  SETUP_THROW_CHASE_LOCK_MS,
  SETUP_THROW_SLAP_TIP_GAP_PX,
  SETUP_THROW_PUSHBOX_GAP_PX,
  SETUP_THROW_CHASE_ARRIVE_GAP_PX,
  SETUP_THROW_CHASE_SLIDE_PX,
  GROUND_LEVEL,
  CLINCH_KILL_THROW_ARC_HEIGHT,
  CMD_THROW_LAUNCH_HITSTOP_MS,
  HITSTOP_THROW_MS,
  speedFactor,
  ICE_SLIDE_MAX_SPEED,
} = require("../../constants");
const {
  isThrowerLocked,
  clampSetupThrowChaseStandoffX,
  DEFAULT_PLAYER_SIZE_MULTIPLIER,
} = require("../../gameUtils");
const { adjustPlayerPositions } = require("../../gameFunctions");
const {
  tossArcY,
  tossTravelX,
  throwTossPeakAt,
  describeThrowToss,
  sampleSetupThrowX,
  sampleSetupThrowY,
} = require("../../throwTossMotion");
const { planSetupThrow, throwTravelPx } = require("../../commandGrabSystem");
const { createCommandGrabScenario } = require("./harness/scenario");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../../gameUtils");

test("toss arc is a constant-g parabola for every power", () => {
  const h = 80;
  assert.equal(tossArcY(0, h, 0), 0);
  assert.equal(tossArcY(1, h, 1), 0);
  assert.equal(throwTossPeakAt(0), 0.5);
  assert.equal(throwTossPeakAt(1), 0.5);
  const healthyPeak = tossArcY(0.5, h, 0);
  const brokenPeak = tossArcY(0.5, h, 1);
  assert.ok(Math.abs(healthyPeak - h) < 0.5);
  assert.ok(Math.abs(brokenPeak - h) < 0.5);
  for (const t of [0.15, 0.25, 0.4, 0.6, 0.8]) {
    const classic = h * 4 * t * (1 - t);
    assert.ok(
      Math.abs(tossArcY(t, h, 0) - classic) < 1e-9,
      `power 0 at t=${t}`
    );
    assert.ok(
      Math.abs(tossArcY(t, h, 1) - classic) < 1e-9,
      `power 1 must keep the same g-family, not an early-peak float`
    );
  }
});

test("setup dump is an ease-out to a readable spot, not a Smash yeet", () => {
  assert.ok(Math.abs(tossTravelX(0.5, 0) - 0.75) < 1e-6);
  assert.ok(tossTravelX(0.25, 1) < 0.5, "ease-out leaves slower than a drag send");
  assert.ok(tossTravelX(0.75, 0) > 0.9, "they settle onto the land early enough to read");
  const healthy = describeThrowToss(BALANCE_MAX);
  const broken = describeThrowToss(CLINCH_THROW_KILL_THRESHOLD);
  assert.equal(healthy.durationMs, broken.durationMs);
  assert.equal(healthy.arcHeight, broken.arcHeight);
  assert.equal(healthy.durationMs, SETUP_THROW_DURATION_MS);
  assert.equal(healthy.arcHeight, SETUP_THROW_ARC_HEIGHT);
  assert.ok(healthy.power < 0.05);
  assert.ok(broken.power > 0.95);
  assert.ok(
    broken.arcHeight < CLINCH_KILL_THROW_ARC_HEIGHT * 0.45,
    "setup hop must stay a dump next to the cinematic kill"
  );
  assert.ok(broken.launchHitstopMs >= CMD_THROW_LAUNCH_HITSTOP_MS);
  assert.ok(broken.landHitstopMs >= HITSTOP_THROW_MS);
  assert.ok(broken.landShakeScale > healthy.landShakeScale);
});

test("command grab throw stamps the setup dump", async (t) => {
  await t.test("healthy vs battered: same land, heavier juice", () => {
    const healthy = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
    healthy.connect().resolveNow();
    const battered = createCommandGrabScenario({ variant: "throw", p2Balance: 20 });
    battered.connect().resolveNow();

    assert.equal(
      battered.grabber.clinchThrowArcDistance,
      healthy.grabber.clinchThrowArcDistance
    );
    assert.equal(healthy.grabber.clinchThrowArcDistance, SETUP_THROW_TRAVEL_PX);
    assert.equal(
      battered.grabber.throwEndTime - battered.grabber.throwStartTime,
      healthy.grabber.throwEndTime - healthy.grabber.throwStartTime
    );
    assert.ok(battered.victim.throwTossPower > healthy.victim.throwTossPower);
    assert.equal(healthy.grabber.throwSetupChase, true);
    assert.equal(
      healthy.grabber.actionLockUntil,
      healthy.room.simTime + SETUP_THROW_CHASE_LOCK_MS
    );
    assert.equal(
      healthy.grabber.throwChaseUnlockAt,
      healthy.room.simTime + SETUP_THROW_CHASE_LOCK_MS
    );
    assert.equal(healthy.victim.throwLandX, healthy.grabber.throwLandX);
    assert.equal(healthy.victim.throwEndTime, healthy.grabber.throwEndTime);
    assert.equal(healthy.victim.throwStartX, healthy.grabber.throwStartX);
  });

  await t.test("emits throw_toss juice with the live duration and power", () => {
    const s = createCommandGrabScenario({ variant: "throw", p2Balance: 20 });
    s.connect().resolveNow();
    const ev = s.io.last("throw_toss");
    assert.ok(ev, "throw_toss must fire for a regular toss");
    assert.equal(ev.payload.victimId, s.victim.id);
    assert.ok(ev.payload.durationMs === s.grabber.throwTossDurationMs);
    assert.ok(ev.payload.power > 0.5);
    assert.ok(ev.payload.hitstopMs > 0);
    assert.equal(ev.payload.ricochet, false);
    assert.ok(ev.payload.combatPresentation);
    assert.equal(
      ev.payload.combatPresentation.interactionType,
      "throw_toss"
    );
    const shakes = s.io.find("screen_shake");
    assert.equal(
      shakes.some((e) => e.payload?.type === "throw_toss"),
      false,
      "launch must not shake — weight lives on throw_landing"
    );
  });

  await t.test("kill throw does not steal the weighted toss", () => {
    const kill = createCommandGrabScenario({
      variant: "throw",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
      midX: MAP_RIGHT_BOUNDARY - 40,
    });
    kill.connect().resolveNow();
    assert.equal(kill.grabber.isClinchKillThrow, true);
    assert.equal(kill.grabber.throwTossPower, 0);
    assert.equal(kill.victim.throwTossPower, 0);
    assert.equal(kill.grabber.throwSetupChase, false);
    assert.equal(kill.grabber.throwChaseUnlockAt || 0, 0);
    assert.equal(kill.io.last("throw_toss"), null);
    assert.ok(kill.io.last("clinch_kill_throw"), "kill keeps its own launch");
  });
});

test("setup throw path is a dump, ricochet is a tawara bounce", () => {
  const centre = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
  const mid = planSetupThrow({ x: centre }, { x: centre + 60 }, throwTravelPx());
  assert.equal(mid.ricochet, false);
  assert.equal(mid.landX, centre + SETUP_THROW_TRAVEL_PX);
  assert.equal(mid.durationMs, SETUP_THROW_DURATION_MS);

  const rope = planSetupThrow(
    { x: MAP_RIGHT_BOUNDARY - 40 },
    { x: MAP_RIGHT_BOUNDARY - 10 },
    throwTravelPx()
  );
  assert.equal(rope.ricochet, true);
  assert.equal(rope.durationMs, SETUP_THROW_RICOCHET_DURATION_MS);
  assert.ok(rope.landX < rope.hitX, "bounce comes back off the straw");
  assert.ok(rope.landX < MAP_RIGHT_BOUNDARY);
  assert.ok(rope.hitX < MAP_RIGHT_BOUNDARY);

  const yMid = sampleSetupThrowY(0.5, {
    ricochet: false,
    height: SETUP_THROW_ARC_HEIGHT,
  });
  assert.ok(Math.abs(yMid - SETUP_THROW_ARC_HEIGHT) < 0.5);

  const bouncePeak = sampleSetupThrowY(0.75, {
    ricochet: true,
    height: SETUP_THROW_ARC_HEIGHT,
    bounceHeight: 54,
    hitAt: 0.5,
  });
  assert.ok(bouncePeak > 40, "second hop must clear the ice");
  assert.equal(
    sampleSetupThrowY(0.5, {
      ricochet: true,
      height: SETUP_THROW_ARC_HEIGHT,
      bounceHeight: 54,
      hitAt: 0.5,
    }),
    0,
    "they hit the tawara at the seam"
  );

  const x0 = sampleSetupThrowX(0, {
    startX: 500,
    landX: 690,
    ricochet: false,
  });
  const x1 = sampleSetupThrowX(1, {
    startX: 500,
    landX: 690,
    ricochet: false,
  });
  assert.equal(x0, 500);
  assert.equal(x1, 690);
});

test("first-frame baseline chase arrives in the outer meaty, not at tip or inside", () => {
  const slidePxPerSec = 1000 * speedFactor * ICE_SLIDE_MAX_SPEED;
  const slideMs = SETUP_THROW_DURATION_MS - SETUP_THROW_CHASE_LOCK_MS;
  const slidePx = (slideMs / 1000) * slidePxPerSec;
  const gapAtLand = SETUP_THROW_TRAVEL_PX - slidePx;
  const pushbox = SETUP_THROW_PUSHBOX_GAP_PX;
  const tip = SETUP_THROW_SLAP_TIP_GAP_PX;
  const slideTickPx = (15.625 / 1000) * slidePxPerSec;

  assert.ok(
    SETUP_THROW_CHASE_LOCK_MS < 320,
    "toss pose is a follow-through, not most of the dump"
  );
  assert.ok(slideMs > 120, "there must be a real chase window");
  assert.equal(
    SETUP_THROW_CHASE_SLIDE_PX,
    SETUP_THROW_TRAVEL_PX - SETUP_THROW_CHASE_ARRIVE_GAP_PX
  );
  assert.ok(
    Math.abs(gapAtLand - SETUP_THROW_CHASE_ARRIVE_GAP_PX) < 2,
    `baseline gap ${gapAtLand.toFixed(1)} should sit on arrive ${SETUP_THROW_CHASE_ARRIVE_GAP_PX}`
  );
  assert.ok(
    gapAtLand > pushbox && gapAtLand < tip,
    `outer meaty is between pushbox ${pushbox} and tip ${tip}; got ${gapAtLand.toFixed(1)}`
  );
  assert.ok(
    gapAtLand - pushbox >= slideTickPx * 2,
    `need two slide ticks of slack so plant does not eat the box; slack=${(gapAtLand - pushbox).toFixed(1)}`
  );
  assert.ok(
    tip - gapAtLand >= 4,
    "still inside tip — not the old parked-at-tip chase"
  );
});

function pushboxPair(overrides1 = {}, overrides2 = {}) {
  const left = {
    id: "chase",
    x: 500,
    y: GROUND_LEVEL,
    sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    movementVelocity: ICE_SLIDE_MAX_SPEED,
    isIceSliding: true,
    throwSetupChase: true,
    throwSetupPlant: false,
    isHit: false,
    isRawParryStun: false,
    isRawParrying: false,
    isThrowing: false,
    isBeingThrown: false,
    isSidestepping: false,
    isAttacking: false,
    isSlideJumping: false,
    isRopeJumping: false,
    isFlapping: false,
    isRingOutPushCutscene: false,
    ...overrides1,
  };
  const right = {
    id: "plant",
    x: 500 + SETUP_THROW_PUSHBOX_GAP_PX - 8,
    y: GROUND_LEVEL,
    sizeMultiplier: DEFAULT_PLAYER_SIZE_MULTIPLIER,
    movementVelocity: 0,
    isIceSliding: false,
    throwSetupChase: false,
    throwSetupPlant: true,
    isHit: false,
    isRawParryStun: false,
    isRawParrying: false,
    isThrowing: false,
    isBeingThrown: false,
    isSidestepping: false,
    isAttacking: false,
    isSlideJumping: false,
    isRopeJumping: false,
    isFlapping: false,
    isRingOutPushCutscene: false,
    ...overrides2,
  };
  return [left, right];
}

test("airborne chase standoff stops at arrive gap without killing slide speed", () => {
  const thrower = {
    x: 500,
    throwSetupChase: true,
    isClinchKillThrow: false,
  };
  const victim = { x: 500 + 200, isBeingThrown: true };
  const proposed = victim.x - 40;
  const clamped = clampSetupThrowChaseStandoffX(thrower, victim, proposed);
  assert.equal(clamped, victim.x - SETUP_THROW_CHASE_ARRIVE_GAP_PX);
  assert.equal(thrower.x, 500, "current X is not yanked");

  const alreadyInside = { ...thrower, x: victim.x - 40 };
  const held = clampSetupThrowChaseStandoffX(
    alreadyInside,
    victim,
    alreadyInside.x + 20
  );
  assert.equal(held, alreadyInside.x, "already inside: hold, do not bury more");

  const planted = clampSetupThrowChaseStandoffX(
    thrower,
    { ...victim, isBeingThrown: false },
    proposed
  );
  assert.equal(planted, proposed, "after plant the standoff releases");
});

test("pushbox eject on throw plant keeps the chase slide alive", () => {
  const [slider, planted] = pushboxPair();
  const speedBefore = slider.movementVelocity;
  adjustPlayerPositions(slider, planted, 15.625);
  assert.ok(
    Math.abs(slider.x - planted.x) >= SETUP_THROW_PUSHBOX_GAP_PX - 1,
    "they stay solid — eject still separates"
  );
  assert.equal(
    slider.movementVelocity,
    speedBefore,
    "plant eject must not zero ice speed or the belly bump dies"
  );

  const [normalSlider, standing] = pushboxPair({}, { throwSetupPlant: false });
  adjustPlayerPositions(normalSlider, standing, 15.625);
  assert.equal(
    normalSlider.movementVelocity,
    0,
    "ordinary ice-into-body still dies — plant is the only exemption"
  );
});

test("setup throw holds the toss pose until chase unlock, then SHIFT slides", () => {
  const { tryBeginSetupThrowChaseSlide } = require("../../gameUtils");
  const s = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
  s.connect().resolveNow();
  s.grabber.keys.shift = true;
  s.grabber.keys.d = true;

  assert.equal(isThrowerLocked(s.grabber), true);
  assert.equal(tryBeginSetupThrowChaseSlide(s.grabber, s.room.simTime), false);
  assert.equal(s.grabber.isIceSliding, false);

  s.advanceTime(SETUP_THROW_CHASE_LOCK_MS);
  assert.equal(isThrowerLocked(s.grabber), false);
  assert.equal(tryBeginSetupThrowChaseSlide(s.grabber, s.room.simTime, s.victim), true);
  assert.equal(s.grabber.isIceSliding, true);
  assert.ok(s.grabber.movementVelocity > 0, "D-held chase must travel +X");
});

test("SHIFT with no A/D chases the facing direction, never the wrong-way unsigned slide", () => {
  const { tryBeginSetupThrowChaseSlide, beginIceSlide } = require("../../gameUtils");
  const { ICE_SLIDE_MAX_SPEED } = require("../../constants");

  const dummy = { x: 640, movementVelocity: 0, keys: {} };
  const left = beginIceSlide(dummy, -1, ICE_SLIDE_MAX_SPEED, 1000);
  assert.equal(left.ok, true);
  assert.equal(left.ropeKickoff, false);
  assert.equal(
    dummy.movementVelocity,
    -ICE_SLIDE_MAX_SPEED,
    "beginIceSlide must sign speed by dir — unsigned +speed used to skate right on a left toss"
  );

  const s = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
  s.connect().resolveNow();
  s.advanceTime(SETUP_THROW_CHASE_LOCK_MS);
  s.grabber.keys.shift = true;
  s.grabber.keys.a = false;
  s.grabber.keys.d = false;
  s.grabber.facing = -1;
  s.victim.x = s.grabber.x + 80;

  assert.equal(tryBeginSetupThrowChaseSlide(s.grabber, s.room.simTime, s.victim), true);
  assert.equal(s.grabber.isIceSliding, true);
  assert.equal(s.grabber.iceSlideDir, 1);
  assert.ok(
    s.grabber.movementVelocity > 0,
    `no-dir chase must go where they look, got vel=${s.grabber.movementVelocity}`
  );
  assert.equal(s.grabber.isDodging, false);
});

test("a latch-buffered dodge becomes a chase slide, not a hop the wrong way", () => {
  const { tryBeginSetupThrowChaseSlide } = require("../../gameUtils");
  const s = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
  s.connect().resolveNow();
  s.advanceTime(SETUP_THROW_CHASE_LOCK_MS);
  s.grabber.keys.shift = true;
  s.grabber.inputBuffer = { type: "dodge", timestamp: s.room.simTime };
  s.grabber.facing = -1;
  s.victim.x = s.grabber.x + 90;

  const started = tryBeginSetupThrowChaseSlide(
    s.grabber,
    s.room.simTime,
    s.victim
  );
  assert.equal(started, true);
  assert.equal(s.grabber.isDodging, false);
  assert.equal(s.grabber.isIceSliding, true);
  assert.ok(s.grabber.movementVelocity > 0);
});
