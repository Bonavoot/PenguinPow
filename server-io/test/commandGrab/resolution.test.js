"use strict";

/**
 * Command grab — connect latch, variant resolution, and lethality.
 *
 *   connect → LATCH (aim) → resolve
 *
 * Drive, Pull, and Throw all wait out the grip before they move.
 * Throw kills when posture is already below the line AND the toss would
 * land past the tawara. Pull predicts a trip when posture is below the
 * line AND the yank hits the clamp behind you; the belly-slide waits until
 * they actually reach the map line.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createCommandGrabScenario } = require("./harness/scenario");
const { profileFor } = require("../../momentumTransfer");
const {
  grabTellAnimMs,
  throwTravelPx,
  pullTravelPx,
  getPullBoundaryRead,
  shouldKillPull,
  maybeArmPullTrip,
} = require("../../commandGrabSystem");
const { correctFacingAfterGrabOrThrow } = require("../../grabMechanics");
const { facingTowardOpponent } = require("../../facingSystem");
const {
  CMD_GRAB_CINCH_MS,
  CMD_GRAB_STAMINA_COST,
  CMD_DRIVE_POSTURE_CHIP,
  CMD_PULL_POSTURE_CHIP,
  CMD_THROW_POSTURE_CHIP,
  CMD_GRAB_LATCH_MS,
  CLINCH_THROW_KILL_THRESHOLD,
  CMD_PULL_KILL_CLAMP_ROOM_PX,
  GRAB_RANGE,
} = require("../../constants");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../../gameUtils");

test("command grab connect beat", async (t) => {
  await t.test("connect opens the belt latch on both fighters", () => {
    const s = createCommandGrabScenario({ variant: "drive" }).connect();
    assert.equal(s.grabber.cmdGrabPhase, "latch");
    assert.equal(s.grabber.isClinchBeltHolding, true);
    assert.equal(s.victim.isClinchBeltHolding, true);
    assert.equal(s.grabber.hasGrip, true);
    assert.equal(s.victim.hasGrip, true);
  });

  await t.test("stamina is billed once, on connect", () => {
    const s = createCommandGrabScenario({ variant: "drive", p1Stamina: 100 });
    s.connect();
    assert.equal(s.grabber.stamina, 100 - CMD_GRAB_STAMINA_COST);
    s.resolveNow();
    assert.equal(
      s.grabber.stamina,
      100 - CMD_GRAB_STAMINA_COST,
      "the carry must not keep draining — a grab is one discrete price"
    );
  });

  await t.test("each variant chips posture on resolve, not connect", () => {
    const cases = [
      ["drive", CMD_DRIVE_POSTURE_CHIP],
      ["pull", CMD_PULL_POSTURE_CHIP],
      ["throw", CMD_THROW_POSTURE_CHIP],
    ];
    for (const [variant, chip] of cases) {
      const s = createCommandGrabScenario({ variant, p2Balance: 100 }).connect();
      assert.equal(s.victim.balance, 100, `${variant} must not chip on connect`);
      s.resolveNow();
      assert.equal(s.victim.balance, 100 - chip, `${variant} chip`);
    }
  });

  await t.test("latch poses follow the aimed variant", () => {
    const drive = createCommandGrabScenario({ variant: "drive" }).connect();
    drive.advance(drive.tickMs);
    assert.equal(drive.grabber.isClinchPushing, true);
    assert.equal(drive.grabber.isAttemptingGrabThrow, false);
    assert.equal(drive.grabber.isAttemptingPull, false);

    const throwS = createCommandGrabScenario({ variant: "throw" }).connect();
    throwS.advance(throwS.tickMs);
    assert.equal(throwS.grabber.isAttemptingGrabThrow, true);

    const pull = createCommandGrabScenario({ variant: "pull" }).connect();
    pull.advance(pull.tickMs);
    assert.equal(pull.grabber.isAttemptingPull, true);
  });

  await t.test("the held victim shows the belt grip, never the generic hit pose", () => {
    for (const variant of ["drive", "throw", "pull"]) {
      const s = createCommandGrabScenario({ variant }).connect();
      assert.equal(s.victim.isResistingThrow, false, `${variant}: no resist-throw`);
      assert.equal(s.victim.isResistingPull, false, `${variant}: no resist-pull`);
      assert.equal(s.victim.hasGrip, true, `${variant}: grip drives the victim pose`);
    }
  });

  await t.test("the carry tells pusher from pushed by posture", () => {
    const s = createCommandGrabScenario({ variant: "drive", p2Balance: 100 });
    s.connect().resolveNow();
    assert.equal(s.grabber.cmdGrabPhase, "carry");
    assert.equal(s.grabber.isClinchPushing, true, "pusher drives");
    assert.equal(s.grabber.isClinchCommittedDrive, true, "pusher gets the lean");
    assert.equal(s.grabber.isClinchPlanting, false);
    assert.equal(s.victim.isClinchPlanting, true, "pushed one braces");
    assert.equal(s.victim.isClinchPushing, false);
    assert.equal(s.victim.isBeingGrabPushed, true);
  });

  await t.test("the grabber holds position through the latch", () => {
    const s = createCommandGrabScenario({ variant: "drive" }).connect();
    const gx = s.grabber.x;
    const gap = s.gap();
    s.advance(s.startupMs - 20);
    assert.equal(s.grabber.cmdGrabPhase, "latch");
    assert.ok(Math.abs(s.grabber.x - gx) < 0.001, "grabber must not drift");
    assert.ok(
      Math.abs(s.gap() - gap) < 0.001,
      "already at grip spacing — nothing to cinch, so spacing must hold"
    );
  });

  await t.test("a far connect cinches fast, then holds — never snaps, never drifts", () => {
    const farGap = GRAB_RANGE - 1;
    const s = createCommandGrabScenario({ variant: "drive", connectGap: farGap });
    s.connect();
    assert.ok(
      Math.abs(s.gap() - farGap) < 0.001,
      "connect must preserve the gap the grab actually landed at"
    );
    const victimStartX = s.victim.x;
    s.advance(s.tickMs);
    const afterOne = s.gap();
    assert.ok(
      afterOne < farGap && afterOne > s.settledAttach,
      `first tick must move partway, got ${afterOne}`
    );
    assert.ok(
      Math.abs(s.victim.x - victimStartX) < 30,
      "no teleport — the victim is pulled in, not snapped"
    );

    s.advance(CMD_GRAB_CINCH_MS);
    assert.ok(
      Math.abs(s.gap() - s.settledAttach) < 6,
      `grip should be closed by the cinch beat, got ${s.gap()} vs ${s.settledAttach}`
    );
    assert.equal(s.grabber.cmdGrabPhase, "latch", "latch continues after the grip is closed");

    const heldGap = s.gap();
    s.advance(s.startupMs - CMD_GRAB_CINCH_MS - s.tickMs - 16);
    if (s.grabber.cmdGrabPhase === "latch") {
      assert.ok(
        Math.abs(s.gap() - heldGap) < 1,
        `once cinched, spacing must hold through the rest of the latch, got ${s.gap()} vs ${heldGap}`
      );
    }
  });

  await t.test("Drive, Pull, and Throw all wait out the grip", () => {
    for (const variant of ["drive", "throw", "pull"]) {
      const s = createCommandGrabScenario({ variant }).connect();
      s.advance(CMD_GRAB_LATCH_MS - 16);
      assert.equal(s.grabber.cmdGrabPhase, "latch", `${variant} must show the hold`);
      if (variant === "throw") assert.equal(s.grabber.isThrowing, false);
      if (variant === "pull") assert.equal(s.victim.isBeingPullReversaled, false);
    }
    const done = createCommandGrabScenario({ variant: "throw" }).connect();
    done.advance(CMD_GRAB_LATCH_MS + done.tickMs);
    assert.equal(done.grabber.isThrowing, true);
  });

  await t.test("the client tell duration covers freeze + latch", () => {
    const drive = createCommandGrabScenario({ variant: "drive" }).connect();
    assert.equal(drive.grabber.clinchThrowAnimMs, grabTellAnimMs("drive", false));

    const pull = createCommandGrabScenario({ variant: "pull" }).connect();
    pull.advance(pull.tickMs);
    assert.equal(pull.grabber.clinchThrowAnimMs, grabTellAnimMs("pull", false));
  });
});

test("command grab throw resolution", async (t) => {
  await t.test("non-kill throw hands off to the surviving arc simulator", () => {
    const s = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
    s.connect().resolveNow();
    assert.equal(s.grabber.isThrowing, true);
    assert.equal(s.victim.isBeingThrown, true);
    assert.equal(s.grabber.throwOpponent, s.victim.id);
    assert.ok(s.grabber.throwEndTime > s.grabber.throwStartTime);
    assert.ok(
      s.grabber.clinchThrowArcDistance > 0 && s.grabber.clinchThrowArcHeight > 0,
      "arc fields feed index.js — a zero arc would drop the victim in place"
    );
    assert.equal(s.grabber.isClinchKillThrow, false);
    assert.equal(s.grabber.cmdGrabPhase, null, "phase machine must release");
  });

  await t.test("throw dumps to a fixed setup spot, posture only juices", () => {
    const healthy = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
    healthy.connect().resolveNow();
    const battered = createCommandGrabScenario({ variant: "throw", p2Balance: 20 });
    battered.connect().resolveNow();
    assert.equal(
      healthy.grabber.clinchThrowArcDistance,
      battered.grabber.clinchThrowArcDistance,
      "setup throw land is authored — posture must not move X"
    );
    assert.equal(
      healthy.grabber.clinchThrowArcDistance,
      profileFor("throw").floor
    );
    assert.equal(healthy.grabber.throwSetupChase, true);
    assert.equal(healthy.grabber.throwRicochet, false);
    assert.ok(healthy.victim.throwTossPower < battered.victim.throwTossPower);
  });

  await t.test("a mid-ring throw is not lethal even at 0 posture", () => {
    const s = createCommandGrabScenario({
      variant: "throw",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    s.connect().resolveNow();
    assert.equal(
      s.grabber.isClinchKillThrow,
      false,
      "centre-to-rope is longer than a max toss"
    );
    assert.equal(s.grabber.isThrowing, true);
  });

  await t.test("throw is lethal when posture is broken AND the land is out", () => {
    const s = createCommandGrabScenario({
      variant: "throw",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
      midX: MAP_RIGHT_BOUNDARY - 40,
    });
    s.connect().resolveNow();
    assert.equal(s.grabber.isClinchKillThrow, true);
    assert.equal(s.victim.isClinchKillThrowVictim, true);
    assert.equal(
      s.victim.clinchKillThrowOffDohyo,
      true,
      "a kill from the rope clears the dohyo edge"
    );
  });

  await t.test("high posture near the rope does not convert a toss into a kill", () => {
    const s = createCommandGrabScenario({
      variant: "throw",
      p2Balance: 100,
      midX: MAP_RIGHT_BOUNDARY - 40,
    });
    s.connect().resolveNow();
    assert.equal(s.grabber.isClinchKillThrow, false);
    assert.equal(s.grabber.throwRicochet, true, "healthy rope throw must bounce, not clamp");
    assert.ok(
      s.grabber.throwLandX < MAP_RIGHT_BOUNDARY,
      "ricochet land stays in play"
    );
  });

  await t.test("lethality reads posture at connect, not after the chip", () => {
    const above = CLINCH_THROW_KILL_THRESHOLD + 1;
    assert.ok(
      above - CMD_THROW_POSTURE_CHIP < CLINCH_THROW_KILL_THRESHOLD,
      "fixture must actually straddle the line"
    );
    const s = createCommandGrabScenario({
      variant: "throw",
      p2Balance: above,
      midX: MAP_RIGHT_BOUNDARY - 40,
    });
    s.connect().resolveNow();
    assert.equal(s.grabber.isClinchKillThrow, false);
  });
});

test("command grab pull resolution", async (t) => {
  await t.test("non-kill pull drives the surviving pull tween", () => {
    const s = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    s.connect().resolveNow();
    assert.equal(s.victim.isBeingPullReversaled, true);
    assert.equal(s.victim.pullReversalPullerId, s.grabber.id);
    assert.equal(s.victim.isGrabBreakSeparating, true);
    assert.ok(s.victim.grabBreakSepDuration > 0);
    assert.equal(s.victim.grabBreakSepCurve, "yank");
    assert.equal(s.grabber.isAttemptingPull, true, "yank pose must be re-armed");
    assert.equal(s.grabber.cmdGrabPhase, null);
  });

  await t.test("non-kill pull stamps a shared lock — settle is +0", () => {
    const s = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    s.connect().resolveNow();
    const yank = s.victim.grabBreakSepDuration;
    assert.ok(yank > 0, "the yank must still exist");
    assert.equal(s.grabber.actionLockUntil, s.victim.actionLockUntil);
    assert.equal(s.grabber.inputLockUntil, s.victim.inputLockUntil);
    assert.equal(s.grabber.actionLockUntil, s.room.simTime + yank);
  });

  await t.test("pull sends the victim past the puller (side switch)", () => {
    const s = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    const grabberX = s.grabber.x;
    const victimStartX = s.victim.x;
    s.connect().resolveNow();
    const target = s.victim.grabBreakTargetX;
    assert.ok(
      victimStartX > grabberX ? target < grabberX : target > grabberX,
      "the victim must end up on the far side of the puller"
    );
  });

  await t.test("pull locks the victim only — puller stays live, victim unlocks on settle", () => {
    const s = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    s.connect();
    s.resolveNow();
    assert.equal(s.victim.pullFacingDirection, s.victim.facing);
    assert.equal(
      s.grabber.pullFacingDirection,
      null,
      "the player doing the pull must not be facing-locked"
    );
    const destVictim = s.victim.grabBreakTargetX < s.grabber.x ? -1 : 1;
    assert.notEqual(
      s.victim.facing,
      destVictim,
      "being dragged past you must not turn them toward the landing side yet"
    );

    s.victim.x = s.victim.grabBreakTargetX;
    s.victim.isBeingPullReversaled = false;
    correctFacingAfterGrabOrThrow(s.victim, s.grabber);
    assert.equal(s.victim.pullFacingDirection, null);
    assert.equal(s.victim.facing, facingTowardOpponent(s.victim, s.grabber));
    assert.equal(s.grabber.facing, facingTowardOpponent(s.grabber, s.victim));
  });

  await t.test("pull travel scales hard with posture, not their run-in", () => {
    const healthy = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    healthy.connect().resolveNow();
    const healthyDist = Math.abs(
      healthy.victim.grabBreakTargetX - healthy.grabber.x
    );

    const battered = createCommandGrabScenario({ variant: "pull", p2Balance: 20 });
    battered.connect().resolveNow();
    const batteredDist = Math.abs(
      battered.victim.grabBreakTargetX - battered.grabber.x
    );

    assert.ok(
      batteredDist > healthyDist * 1.5,
      `pull must feel like Smash percent, got ${healthyDist} vs ${batteredDist}`
    );

    const rushing = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    rushing.connect();
    rushing.grabber.cmdGrabVictimApproach = 2.4;
    rushing.resolveNow();
    const rushingDist = Math.abs(
      rushing.victim.grabBreakTargetX - rushing.grabber.x
    );
    assert.ok(
      Math.abs(healthyDist - rushingDist) < 1,
      `their charge is Matador's dump, not Pull's: ${healthyDist} vs ${rushingDist}`
    );
  });

  await t.test("a mid-ring pull is not lethal even at 0 posture", () => {
    const s = createCommandGrabScenario({
      variant: "pull",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    s.connect().resolveNow();
    assert.equal(s.victim.isClinchKillPullVictim, false);
    assert.equal(s.victim.pendingPullTrip, false);
    assert.equal(s.room.gameOver, false);
    assert.equal(s.victim.isBoundaryPullSwap, false);
  });

  await t.test("low posture alone, still off the rope, is not a kill", () => {
    // Old pull-kill was "broken = belly-slam from anywhere." A 230px yank
    // from here would have cleared the map line under that rule.
    const s = createCommandGrabScenario({
      variant: "pull",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
      midX: MAP_LEFT_BOUNDARY + 200,
    });
    s.connect().resolveNow();
    assert.equal(s.victim.isClinchKillPullVictim, false);
    assert.equal(s.victim.pendingPullTrip, false);
    assert.equal(s.room.gameOver, false);
  });

  await t.test("pull is lethal when posture is broken AND the yank hits the clamp", () => {
    const s = createCommandGrabScenario({
      variant: "pull",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
      midX: MAP_LEFT_BOUNDARY + 70,
    });
    s.connect().resolveNow();
    assert.equal(
      s.victim.pendingPullTrip,
      true,
      "resolve predicts the trip — it does not belly-slam yet"
    );
    assert.equal(s.victim.isClinchKillPullVictim, false);
    assert.equal(s.room.gameOver, false);
    assert.equal(
      s.victim.isBoundaryPullSwap,
      false,
      "the clarity swap must not eat the rope trip"
    );
    assert.ok(
      s.victim.grabBreakTargetX < MAP_LEFT_BOUNDARY,
      "kill pull must be allowed past the clamp"
    );
    assert.equal(
      maybeArmPullTrip(s.victim, s.room, s.io),
      false,
      "still in-bounds — still standing"
    );
    s.victim.x = MAP_LEFT_BOUNDARY;
    assert.equal(maybeArmPullTrip(s.victim, s.room, s.io), true);
    assert.equal(s.victim.isClinchKillPullVictim, true);
    assert.equal(s.room.gameOver, true);
    assert.equal(s.victim.pendingPullTrip, false);
  });

  await t.test("healthy pull with your back to the wall is the clarity swap, not a kill", () => {
    const s = createCommandGrabScenario({
      variant: "pull",
      p2Balance: 100,
      midX: MAP_LEFT_BOUNDARY + 70,
    });
    s.connect().resolveNow();
    assert.equal(s.victim.isClinchKillPullVictim, false);
    assert.equal(s.room.gameOver, false);
    assert.equal(s.victim.isBoundaryPullSwap, true);
  });

  await t.test("a far connect at the rope still kills — cinch cannot flip it to a swap", () => {
    // Grabber plants on the straw (~400) and cinches ~82px inward during the
    // latch. Live X is then past the kill-clamp room; the connect plant must
    // still count as a trip, not the visual swap.
    const s = createCommandGrabScenario({
      variant: "pull",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
      midX: 487.5,
      connectGap: GRAB_RANGE,
    });
    s.connect();
    const plantedX = s.grabber.cmdGrabCinchFromX;
    s.resolveNow();
    assert.ok(
      plantedX < MAP_LEFT_BOUNDARY + 80,
      `fixture must plant on the straw, got ${plantedX}`
    );
    assert.ok(
      s.grabber.x > plantedX + 60,
      `cinch must walk the grabber off the straw, planted ${plantedX} live ${s.grabber.x}`
    );
    assert.equal(s.victim.pendingPullTrip, true);
    assert.equal(s.victim.isClinchKillPullVictim, false);
    assert.equal(s.room.gameOver, false);
    assert.equal(s.victim.isBoundaryPullSwap, false);
    s.victim.x = MAP_LEFT_BOUNDARY - 1;
    assert.equal(maybeArmPullTrip(s.victim, s.room, s.io), true);
    assert.equal(s.victim.isClinchKillPullVictim, true);
    assert.equal(s.room.gameOver, true);
  });
});

test("pull clamp read is shared by kill and swap", async (t) => {
  const leftRope = (grabberX, victimX, pullDist) =>
    getPullBoundaryRead({ x: grabberX }, { x: victimX }, pullDist);

  await t.test("mid-ring yank does not reach the kill clamp", () => {
    const centre = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    const read = leftRope(centre, centre + 60, pullTravelPx(0));
    assert.equal(read.dir, -1);
    assert.equal(read.hitsClamp, false);
    assert.equal(read.reachesKillClamp, false);
    assert.equal(shouldKillPull({ x: centre }, { x: centre + 60 }, pullTravelPx(0), 0), false);
  });

  await t.test("back to the wall: yank hits the clamp and has no side-switch room", () => {
    const read = leftRope(MAP_LEFT_BOUNDARY + 40, MAP_LEFT_BOUNDARY + 100, 230);
    assert.equal(read.hitsClamp, true);
    assert.equal(read.noRoomForSideSwitch, true);
    assert.equal(read.reachesKillClamp, true);
    assert.equal(
      shouldKillPull(
        { x: MAP_LEFT_BOUNDARY + 40 },
        { x: MAP_LEFT_BOUNDARY + 100 },
        230,
        0
      ),
      true
    );
    assert.equal(
      shouldKillPull(
        { x: MAP_LEFT_BOUNDARY + 40 },
        { x: MAP_LEFT_BOUNDARY + 100 },
        230,
        100
      ),
      false,
      "healthy posture at the same spot is the swap, not a kill"
    );
  });

  await t.test("a long yank that merely clips the clamp from deep in is not a trip", () => {
    // Old fly-off rule: 230px from here clears the map line. New rule: the
    // grabber is still more than CMD_PULL_KILL_CLAMP_ROOM_PX from the clamp.
    const grabberX = MAP_LEFT_BOUNDARY + 200;
    const read = leftRope(grabberX, grabberX + 60, 230);
    assert.equal(read.hitsClamp, true);
    assert.ok(read.distPastActor >= CMD_PULL_KILL_CLAMP_ROOM_PX);
    assert.equal(read.reachesKillClamp, false);
    assert.equal(shouldKillPull({ x: grabberX }, { x: grabberX + 60 }, 230, 0), false);
  });
});

test("grab travel helpers stay in-bounds from centre", async (t) => {
  await t.test("max throw / pull from centre cannot clear a rope", () => {
    const centre = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    const throwDist = throwTravelPx(0, 2);
    const pullDist = pullTravelPx(0);
    assert.ok(
      centre + throwDist <= MAP_RIGHT_BOUNDARY,
      `max throw ${throwDist} from centre ${centre} must land in`
    );
    assert.ok(
      centre - pullDist >= MAP_LEFT_BOUNDARY,
      `max pull ${pullDist} from centre ${centre} must stay in`
    );
  });
});
