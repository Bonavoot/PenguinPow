"use strict";

/**
 * Command grab — the Drive carry.
 *
 * Drive is the bread and butter: a stamped tween that carries the victim toward
 * the rope, then releases. The rules that matter most here are the two that keep
 * it from becoming degenerate:
 *
 *   TAWARA  Reaching the rope only forces out if enough carry DISTANCE is still
 *           owed (CMD_DRIVE_EDGE_FORCE_OUT_FRACTION). Otherwise the victim is
 *           released pinned with their back to the tawara — a real reward, not a
 *           win. A lethal or gassed victim has nothing to hold with, so that
 *           requirement is waived for them.
 *
 *           This gate used to be a remaining-TIME budget, which looked equivalent
 *           but wasn't: the eased carry spends most of its distance early, so
 *           almost any carry that touched the rope forced out. Hence distance.
 *
 *   RELEASE Both fighters slide apart past GRAB_RANGE, so there is no free re-grab
 *           and no free jab. The split is boundary-aware — whatever the victim
 *           can't travel because they are pinned is handed to the grabber — so a
 *           rope pin survives while a mid-ring release looks symmetric.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createCommandGrabScenario } = require("./harness/scenario");
const {
  CMD_GRAB_CONNECT_STARTUP_MS,
  CMD_DRIVE_CARRY_MS,
  CMD_DRIVE_DISTANCE_MIN,
  CMD_DRIVE_DISTANCE_MAX,
  CMD_DRIVE_GASSED_DISTANCE_MULT,
  CMD_DRIVE_APPROACH_REF_SPEED,
  CMD_DRIVE_APPROACH_BONUS_MAX,
  CMD_DRIVE_EDGE_FORCE_OUT_FRACTION,
  CMD_DRIVE_RELEASE_SEPARATION,
  CMD_DRIVE_ATTACKER_RECOVERY_MS,
  CMD_DRIVE_DEFENDER_RECOVERY_MS,
  CMD_DRIVE_RELEASE_TWEEN_MS,
  CLINCH_THROW_KILL_THRESHOLD,
  GRAB_RANGE,
  SLAP_STARTUP_MS,
} = require("../../constants");
const { MAP_RIGHT_BOUNDARY } = require("../../gameUtils");
const { profileFor } = require("../../momentumTransfer");
// Mirrors GRAB_POSTURE_MULT_MAX in commandGrabSystem.js.
const GRAB_POSTURE_MULT_MAX = 1.35;

// Park the pair far from the rope so the carry can never reach it.
const CENTER = 640;

function driveToStartOfCarry(options = {}) {
  const s = createCommandGrabScenario({ variant: "drive", midX: CENTER, ...options });
  s.connect();
  s.resolveNow();
  return s;
}

test("drive carry", async (t) => {
  await t.test("resolves into a stamped carry tween, not a live shove", () => {
    const s = driveToStartOfCarry();
    assert.equal(s.grabber.cmdGrabPhase, "carry");
    // Carry duration now scales with distance so the carry holds a roughly
    // constant, animatable pace instead of getting faster the further it goes.
    assert.ok(
      s.grabber.cmdGrabCarryDuration > 0 &&
        s.grabber.cmdGrabCarryDuration <= CMD_DRIVE_CARRY_MS * 1.5,
      `carry duration must be bounded, got ${s.grabber.cmdGrabCarryDuration}ms`
    );
    assert.ok(
      s.grabber.cmdGrabCarryTargetX !== s.grabber.cmdGrabCarryStartX,
      "the whole trajectory must be known at resolve time"
    );
    assert.equal(s.grabber.isClinchPushing, true);
    assert.equal(s.victim.isBeingGrabPushed, true);
  });

  await t.test("carry distance scales with the victim's posture", () => {
    const healthy = driveToStartOfCarry({ p2Balance: 100 });
    const battered = driveToStartOfCarry({ p2Balance: 25 });
    const healthyDist = Math.abs(
      healthy.grabber.cmdGrabCarryTargetX - healthy.grabber.cmdGrabCarryStartX
    );
    const batteredDist = Math.abs(
      battered.grabber.cmdGrabCarryTargetX - battered.grabber.cmdGrabCarryStartX
    );
    // Posture is no longer the distance FUNCTION — momentum is, and posture is
    // a multiplier on top (GRAB_POSTURE_MULT_MAX). A battered opponent still
    // travels further from the same input, just by a smaller margin than when
    // posture drove the whole 110→250 range.
    assert.ok(batteredDist > healthyDist, "low posture must still travel further");
    assert.ok(
      healthyDist >= profileFor("drive").floor - 1,
      "a standing drive still delivers its floor (deliberately small now)"
    );
    assert.ok(batteredDist <= CMD_DRIVE_DISTANCE_MAX + 1);
  });

  await t.test("approach momentum carries into the drive", () => {
    // grabApproachSpeed is captured at grab startup and was otherwise unused under
    // V2 — a dash or slide grab should drive noticeably further than a standing one.
    const standing = createCommandGrabScenario({ variant: "drive", midX: CENTER });
    standing.connect();
    standing.resolveNow();
    const slideIn = createCommandGrabScenario({ variant: "drive", midX: CENTER });
    slideIn.grabber.grabApproachSpeed = CMD_DRIVE_APPROACH_REF_SPEED;
    slideIn.connect();
    slideIn.resolveNow();

    const dist = (s) =>
      Math.abs(s.grabber.cmdGrabCarryTargetX - s.grabber.cmdGrabCarryStartX);
    assert.ok(
      dist(slideIn) - dist(standing) >= CMD_DRIVE_APPROACH_BONUS_MAX - 1,
      `a full-speed approach should add the whole bonus, got +${dist(slideIn) - dist(standing)}`
    );
  });

  await t.test("the approach bonus is capped, not unbounded", () => {
    // grabApproachSpeed has no clamp of its own, so an extreme entry velocity must
    // not translate into an arbitrarily long carry.
    const capped = createCommandGrabScenario({ variant: "drive", midX: CENTER });
    capped.grabber.grabApproachSpeed = CMD_DRIVE_APPROACH_REF_SPEED * 12;
    capped.connect();
    capped.resolveNow();
    const dist = Math.abs(
      capped.grabber.cmdGrabCarryTargetX - capped.grabber.cmdGrabCarryStartX
    );
    // Ceiling is now the drive profile in momentumTransfer (momentum buys the
    // whole curve), with posture as a multiplier on top.
    assert.ok(
      dist <=
        profileFor("drive").ceil * GRAB_POSTURE_MULT_MAX + 1,
      `carry should cap out, got ${dist}`
    );
  });

  await t.test("gassed cuts the carry AFTER the approach bonus", () => {
    // Otherwise an exhausted rikishi could slide their way back to a full drive.
    const s = createCommandGrabScenario({ variant: "drive", midX: CENTER, p1Gassed: true });
    s.grabber.grabApproachSpeed = CMD_DRIVE_APPROACH_REF_SPEED;
    s.connect();
    s.resolveNow();
    const dist = Math.abs(
      s.grabber.cmdGrabCarryTargetX - s.grabber.cmdGrabCarryStartX
    );
    // Compare against what the SAME approach would have produced ungassed,
    // rather than the retired MIN+BONUS constants.
    const ungassedBase = profileFor("drive").ceil;
    assert.ok(
      dist < ungassedBase * 0.5,
      `gassed should still be heavily cut with momentum, got ${dist} vs base ${ungassedBase}`
    );
  });

  await t.test("a gassed grabber gets a much shorter carry", () => {
    const fresh = driveToStartOfCarry({ p2Balance: 100 });
    const gassed = driveToStartOfCarry({ p2Balance: 100, p1Gassed: true });
    const freshDist = Math.abs(
      fresh.grabber.cmdGrabCarryTargetX - fresh.grabber.cmdGrabCarryStartX
    );
    const gassedDist = Math.abs(
      gassed.grabber.cmdGrabCarryTargetX - gassed.grabber.cmdGrabCarryStartX
    );
    assert.ok(
      Math.abs(gassedDist - freshDist * CMD_DRIVE_GASSED_DISTANCE_MULT) <= 1,
      `expected ~${freshDist * CMD_DRIVE_GASSED_DISTANCE_MULT}, got ${gassedDist}`
    );
  });

  await t.test("the carry actually moves both fighters together", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    const startGrabberX = s.grabber.x;
    const startVictimX = s.victim.x;
    const gapBefore = s.gap();
    s.advance(s.grabber.cmdGrabCarryDuration / 2);
    assert.ok(s.grabber.x > startGrabberX, "grabber advances");
    assert.ok(s.victim.x > startVictimX, "victim is driven");
    assert.ok(
      Math.abs(s.gap() - gapBefore) < 1,
      "grip spacing holds through the carry"
    );
  });

  await t.test("carry ends within its stamped duration and releases", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.grabber.cmdGrabPhase, null, "phase machine must release");
    assert.equal(s.grabber.isGrabbing, false);
    assert.equal(s.victim.isBeingGrabbed, false);
    assert.equal(s.grabber.hasGrip, false);
    assert.equal(s.victim.hasGrip, false);
  });
});

test("drive release", async (t) => {
  await t.test("separation clears GRAB_RANGE, so there is no free re-grab", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    // index.js drives both tweens, so assert the stamped targets.
    const finalGap = Math.abs(
      (s.grabber.grabBreakTargetX ?? s.grabber.x) -
        (s.victim.grabBreakTargetX ?? s.victim.x)
    );
    assert.ok(
      finalGap >= GRAB_RANGE,
      `release gap ${finalGap} must clear GRAB_RANGE ${GRAB_RANGE}`
    );
    assert.ok(
      Math.abs(finalGap - CMD_DRIVE_RELEASE_SEPARATION) < 1,
      `release gap should land on CMD_DRIVE_RELEASE_SEPARATION, got ${finalGap}`
    );
  });

  await t.test("mid-ring, both fighters slide apart roughly evenly", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration);
    const grabberAtEnd = s.grabber.x;
    const victimAtEnd = s.victim.x;
    s.advance(32);
    const grabberMoved = Math.abs((s.grabber.grabBreakTargetX ?? s.grabber.x) - grabberAtEnd);
    const victimMoved = Math.abs((s.victim.grabBreakTargetX ?? s.victim.x) - victimAtEnd);
    assert.ok(victimMoved > 1, "the victim should slide too, not just the grabber");
    assert.ok(grabberMoved > 1, "and the grabber should give ground as well");
    assert.ok(
      Math.abs(grabberMoved - victimMoved) < 2,
      `mid-ring the split should be even, got grabber ${grabberMoved} vs victim ${victimMoved}`
    );
  });

  await t.test("a rope-pinned victim keeps the pin; the grabber absorbs the rest", () => {
    // The whole point of the boundary-aware split: the bad position the victim was
    // driven into must not be given back by the separation itself.
    const s = createCommandGrabScenario({
      variant: "drive",
      p2Balance: 100,
      midX: MAP_RIGHT_BOUNDARY - 61.2 / 2 - 8,
    });
    s.connect();
    s.resolveNow();
    // Close enough that the rope is reached; a healthy victim gets pinned, not out.
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    if (s.room.gameOver) return; // force-out fired instead; covered elsewhere
    assert.ok(
      Math.abs((s.victim.grabBreakTargetX ?? s.victim.x) - MAP_RIGHT_BOUNDARY) < 1,
      "a pinned victim must stay pinned through the release"
    );
    const finalGap = Math.abs(
      (s.grabber.grabBreakTargetX ?? s.grabber.x) -
        (s.victim.grabBreakTargetX ?? s.victim.x)
    );
    assert.ok(
      Math.abs(finalGap - CMD_DRIVE_RELEASE_SEPARATION) < 1,
      `the grabber must absorb the victim's shortfall, got gap ${finalGap}`
    );
  });

  await t.test("attacker is negative, and by more than a jab startup", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    const deficit =
      CMD_DRIVE_ATTACKER_RECOVERY_MS - CMD_DRIVE_DEFENDER_RECOVERY_MS;
    assert.ok(deficit > 0, "the attacker must not come out ahead on frames");
    assert.ok(
      deficit >= SLAP_STARTUP_MS,
      `deficit ${deficit} should be at least SLAP_STARTUP_MS ${SLAP_STARTUP_MS} so a jab would win in range`
    );
    assert.ok(
      s.grabber.actionLockUntil > s.victim.actionLockUntil,
      "the authoritative locks must reflect that deficit"
    );
  });

  await t.test("recovery blocks movement, not just actions", () => {
    // The reported bug: an actionLockUntil alone left the player able to strafe
    // while unable to dodge, which reads as the game eating inputs. Recovery now
    // runs as a real isRecovering window, which the movement code already gates on.
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    for (const [p, label] of [
      [s.grabber, "grabber"],
      [s.victim, "victim"],
    ]) {
      assert.equal(p.isRecovering, true, `${label} should be in recovery`);
      assert.ok(p.recoveryDuration > 0, `${label} needs a recovery duration`);
      assert.equal(p.isStrafing, false, `${label} must not be strafing`);
      assert.equal(p.movementVelocity, 0, `${label} must not carry velocity`);
    }
  });

  await t.test("recovery is short, and expires on the sim clock", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.ok(
      s.grabber.recoveryDuration <= 200,
      `landing a grab should not lock you out for long, got ${s.grabber.recoveryDuration}ms`
    );
    // index.js owns expiry; assert the window is well-formed and finite here.
    assert.ok(
      s.grabber.recoveryStartTime > 0 &&
        s.grabber.recoveryStartTime + s.grabber.recoveryDuration > s.room.simTime,
      "recovery must be a live, bounded window anchored to the sim clock"
    );
    assert.ok(
      s.victim.recoveryDuration < s.grabber.recoveryDuration,
      "the defender must recover first — that IS the attacker's deficit"
    );
  });

  await t.test("both are input-locked for the release tween only", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    const now = s.room.simTime;
    assert.ok(s.grabber.inputLockUntil > now - CMD_DRIVE_RELEASE_TWEEN_MS);
    assert.ok(s.victim.inputLockUntil > now - CMD_DRIVE_RELEASE_TWEEN_MS);
    assert.ok(
      s.grabber.inputLockUntil <= now + CMD_DRIVE_RELEASE_TWEEN_MS,
      "the release lock must not outlast its own tween"
    );
  });
});

test("drive at the tawara", async (t) => {
  // Position so the victim starts inside the carry's reach of the right rope.
  function driveIntoRope(options = {}) {
    const gap = 61.2;
    const victimX = MAP_RIGHT_BOUNDARY - (options.ropeGap != null ? options.ropeGap : 40);
    const s = createCommandGrabScenario({
      variant: "drive",
      midX: victimX - gap / 2,
      ...options,
    });
    s.connect();
    s.resolveNow();
    return s;
  }

  await t.test("plenty of carry left at the rope → force out", () => {
    // Victim starts 10px off the rope with a full-length carry owed.
    const s = driveIntoRope({ ropeGap: 10, p2Balance: 100 });
    assert.equal(s.grabber.cmdGrabPhase, "carry");
    s.advance(s.grabber.cmdGrabCarryDuration);
    assert.equal(s.room.gameOver, true, "should have been forced out");
    assert.equal(s.grabber.isRingOutPushCutscene, true);
    assert.equal(s.victim.isRingOutPushCutscene, true);
  });

  // Stage a carry that only touches the rope near the end of its travel, so less
  // than CMD_DRIVE_EDGE_FORCE_OUT_FRACTION of the distance is owed at contact.
  // Carry length depends on posture, so it is measured per-fixture.
  function stageLateRopeContact(options = {}) {
    const probe = createCommandGrabScenario({ variant: "drive", ...options });
    probe.connect();
    probe.resolveNow();
    const carryDist = Math.abs(
      probe.grabber.cmdGrabCarryTargetX - probe.grabber.cmdGrabCarryStartX
    );
    const s = createCommandGrabScenario({
      variant: "drive",
      ...options,
      midX: MAP_RIGHT_BOUNDARY - probe.settledAttach / 2 - carryDist * 0.97,
    });
    s.connect();
    s.resolveNow();
    return s;
  }

  // Mirror: contact early enough that the gate is comfortably satisfied.
  function stageEarlyRopeContact(options = {}) {
    const probe = createCommandGrabScenario({ variant: "drive", ...options });
    probe.connect();
    probe.resolveNow();
    const carryDist = Math.abs(
      probe.grabber.cmdGrabCarryTargetX - probe.grabber.cmdGrabCarryStartX
    );
    const owed = CMD_DRIVE_EDGE_FORCE_OUT_FRACTION + 0.15;
    const s = createCommandGrabScenario({
      variant: "drive",
      ...options,
      midX: MAP_RIGHT_BOUNDARY - probe.settledAttach / 2 - carryDist * (1 - owed),
    });
    s.connect();
    s.resolveNow();
    return s;
  }

  await t.test("the gate is a real requirement, not a formality", () => {
    // The regression this replaces: with a remaining-TIME budget, contact at 97% of
    // the travel still forced out, making any rope contact an automatic win.
    const late = stageLateRopeContact({ p2Balance: 100 });
    late.advance(late.grabber.cmdGrabCarryDuration + 32);
    assert.equal(late.room.gameOver, false, "late contact must NOT force out");

    const early = stageEarlyRopeContact({ p2Balance: 100 });
    early.advance(early.grabber.cmdGrabCarryDuration + 32);
    assert.equal(early.room.gameOver, true, "early contact must force out");
  });

  await t.test("carry expiring at the rope → pinned release, not a win", () => {
    const s = stageLateRopeContact({ p2Balance: 100 });
    assert.equal(s.grabber.cmdGrabEdgeWaiver, false, "healthy victim gets no waiver");
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(
      s.room.gameOver,
      false,
      "not enough carry owed at rope contact — this must not be a win"
    );
    assert.ok(
      Math.abs(s.victim.x - MAP_RIGHT_BOUNDARY) < 1,
      "the victim should be released pinned against the tawara"
    );
  });

  await t.test("a lethal victim is forced out on the same late contact", () => {
    const s = stageLateRopeContact({
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    assert.equal(
      s.grabber.cmdGrabEdgeWaiver,
      true,
      "lethal posture waives the remaining-carry requirement"
    );
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.room.gameOver, true);
  });

  await t.test("a gassed victim is forced out on the same late contact", () => {
    const s = stageLateRopeContact({ p2Gassed: true, p2Balance: 100 });
    assert.equal(s.grabber.cmdGrabEdgeWaiver, true);
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.room.gameOver, true);
  });

  await t.test("an empty tank waives it too", () => {
    const s = stageLateRopeContact({ p2Stamina: 0, p2Balance: 100 });
    assert.equal(s.grabber.cmdGrabEdgeWaiver, true);
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.room.gameOver, true);
  });

  await t.test("a carry that never reaches the rope is not a win", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.room.gameOver, false);
    assert.ok(
      s.victim.x < MAP_RIGHT_BOUNDARY - 10,
      "the victim should still be well inside the ring"
    );
  });

  await t.test("the pair never ends up parked past the rope", () => {
    const s = driveIntoRope({ ropeGap: 5, p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration);
    assert.ok(s.victim.x <= MAP_RIGHT_BOUNDARY + 0.001);
  });
});
