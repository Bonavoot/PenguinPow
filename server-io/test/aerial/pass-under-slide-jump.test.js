"use strict";

/**
 * Grounded fighters must pass under a slide-jump that is still in the air.
 * The old grab-run latch park (and any leftover X wall) froze them at the
 * jumper's belly as if the flyer still had a standing pushbox.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  GROUND_LEVEL,
  GRAB_LUNGE_FRICTION,
  TICK_RATE,
  speedFactor,
} = require("../../constants");
const { timeoutManager, beginGrabStartup } = require("../../gameUtils");
const {
  arePlayersColliding,
  adjustPlayerPositions,
} = require("../../gameFunctions");
const {
  inGrabLatchRange,
  shouldHoldGrabAtLatch,
  canGrabLatchThisTick,
} = require("../../grabStartupArmor");
const { isAirborneForGroundCollision } = require("../../groundCollision");
const {
  createSlideJumpScenario,
  beginSlideJumpFlight,
} = require("./helpers/slideJumpSim");
const {
  createFoundationScenario,
} = require("../foundation/helpers/scenarioHarness");

const TICK_MS = 1000 / TICK_RATE;

const live = [];
afterEach(() => {
  timeoutManager.clearAll();
  while (live.length) {
    const s = live.pop();
    if (typeof s.dispose === "function") s.dispose();
  }
});

function placeOverlappingX(grounded, jumper, gap = 40) {
  grounded.x = 500;
  jumper.x = 500 + gap;
  grounded.y = GROUND_LEVEL;
  jumper.y = GROUND_LEVEL + 80;
  jumper.isSlideJumping = true;
  jumper.slideJumpPhase = "flight";
}

function stepGrabRun(grabber, opponent) {
  if (grabber.grabMovementDirection) {
    grabber.grabMovementVelocity =
      grabber.grabMovementDirection *
      Math.abs(grabber.grabMovementVelocity);
  }
  if (!shouldHoldGrabAtLatch(grabber, opponent)) {
    grabber.x += TICK_MS * speedFactor * grabber.grabMovementVelocity;
    grabber.grabMovementVelocity *= GRAB_LUNGE_FRICTION;
  }
  if (arePlayersColliding(grabber, opponent)) {
    adjustPlayerPositions(grabber, opponent, TICK_MS);
  }
}

function stepWalk(walker, opponent, dir) {
  walker.x += dir * 4;
  if (arePlayersColliding(walker, opponent)) {
    adjustPlayerPositions(walker, opponent, TICK_MS);
  }
}

describe("pass under slide-jump flight", () => {
  it("flight + elevated Y is airborne for ground collision", () => {
    assert.equal(
      isAirborneForGroundCollision({
        isSlideJumping: true,
        slideJumpPhase: "flight",
        y: GROUND_LEVEL + 40,
      }),
      true
    );
    assert.equal(
      isAirborneForGroundCollision({
        isSlideJumping: false,
        y: GROUND_LEVEL,
      }),
      false
    );
    assert.equal(
      isAirborneForGroundCollision(
        { isDodging: true, y: GROUND_LEVEL + 20 },
        { forGrab: true }
      ),
      false
    );
  });

  it("pushbox does not separate a walker from a flyer above them", () => {
    const s = createSlideJumpScenario({
      name: "walk_under",
      attackerX: 560,
      defenderX: 500,
      attackerY: GROUND_LEVEL + 90,
      velY: 4,
      hSpeed: 0,
    });
    live.push(s);
    const walker = s.defender;
    const jumper = s.attacker;
    walker.y = GROUND_LEVEL;
    const startX = walker.x;
    assert.equal(arePlayersColliding(walker, jumper), false);
    for (let i = 0; i < 40; i++) stepWalk(walker, jumper, 1);
    assert.ok(
      walker.x > jumper.x + 10,
      `walker should cross under jumper (walker=${walker.x.toFixed(1)} jumper=${jumper.x.toFixed(1)} from ${startX})`
    );
    assert.equal(jumper.isSlideJumping, true);
    assert.equal(jumper.slideJumpPhase, "flight");
  });

  it("elevated Y alone (no flight flag) is still not a ground wall", () => {
    const s = createFoundationScenario({ gap: 40 });
    live.push(s);
    s.right.y = GROUND_LEVEL + 60;
    s.right.isSlideJumping = false;
    s.right.slideJumpPhase = null;
    assert.equal(arePlayersColliding(s.left, s.right), false);
    const start = s.left.x;
    for (let i = 0; i < 30; i++) stepWalk(s.left, s.right, 1);
    assert.ok(s.left.x > start + 80, "must walk through the elevated body");
  });

  it("grab run does not park at latch under a slide-jump", () => {
    const s = createFoundationScenario({ gap: 180 });
    live.push(s);
    const grabber = s.left;
    const jumper = s.right;
    beginGrabStartup(grabber, s.room);
    placeOverlappingX(grabber, jumper, 40);
    grabber.x = jumper.x - 40;
    assert.equal(inGrabLatchRange(grabber, jumper), true);
    assert.equal(shouldHoldGrabAtLatch(grabber, jumper), false);
    assert.equal(
      canGrabLatchThisTick(grabber, jumper, s.room.simTime + 200),
      false
    );

    const startX = grabber.x;
    for (let i = 0; i < 50; i++) stepGrabRun(grabber, jumper);
    assert.ok(
      grabber.x > jumper.x + 8,
      `grab run must pass under the flyer (grabber=${grabber.x.toFixed(1)} jumper=${jumper.x} from ${startX})`
    );
  });

  it("grab run still parks at latch against a standing body", () => {
    const s = createFoundationScenario({ gap: 40 });
    live.push(s);
    const grabber = s.left;
    const victim = s.right;
    beginGrabStartup(grabber, s.room);
    victim.y = GROUND_LEVEL;
    victim.isSlideJumping = false;
    assert.equal(shouldHoldGrabAtLatch(grabber, victim), true);
    const parked = grabber.x;
    for (let i = 0; i < 12; i++) {
      if (grabber.grabMovementDirection) {
        grabber.grabMovementVelocity =
          grabber.grabMovementDirection *
          Math.abs(grabber.grabMovementVelocity);
      }
      if (!shouldHoldGrabAtLatch(grabber, victim)) {
        grabber.x += TICK_MS * speedFactor * grabber.grabMovementVelocity;
      }
    }
    assert.ok(
      Math.abs(grabber.x - parked) < 0.01,
      "standing latch must still hold the run"
    );
  });

  it("takeoff flight disables pushbox the first airborne tick", () => {
    const s = createSlideJumpScenario({
      name: "takeoff_pushbox",
      startGrounded: true,
      attackerX: 520,
      defenderX: 500,
    });
    live.push(s);
    beginSlideJumpFlight(s.attacker, {
      now: s.room.simTime,
      dir: 1,
      armFlap: false,
    });
    s.attacker.y = GROUND_LEVEL + 20;
    s.defender.y = GROUND_LEVEL;
    assert.equal(arePlayersColliding(s.attacker, s.defender), false);
    const defX = s.defender.x;
    adjustPlayerPositions(s.attacker, s.defender, TICK_MS);
    assert.equal(s.defender.x, defX);
  });
});
