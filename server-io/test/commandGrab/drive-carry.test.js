"use strict";

/**
 * Command grab — the Drive carry.
 *
 * Drive is the bread and butter: a stamped tween that carries the victim toward
 * the rope, then releases. The rules that matter most here are the two that keep
 * it from becoming degenerate:
 *
 *   TAWARA  Reaching the rope always clamps unless the victim is gassed / at
 *           empty stamina. Entry speed still buys carry distance/duration, but
 *           not a free ring-out. While pinned, the victim's stamina burns hard
 *           so a mid-push gas-out can convert the same shove into a KO.
 *           Posture lethal does NOT waive — that finish belongs to throw/pull
 *           (and slap/palm at the clamp).
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
  CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC,
  CMD_DRIVE_RELEASE_SEPARATION,
  CMD_DRIVE_ATTACKER_RECOVERY_MS,
  CMD_DRIVE_DEFENDER_RECOVERY_MS,
  CMD_DRIVE_RELEASE_TWEEN_MS,
  CMD_DRIVE_RELEASE_VICTIM_SHARE,
  CLINCH_THROW_KILL_THRESHOLD,
  GRAB_RANGE,
  SLAP_STARTUP_MS,
  TICK_RATE,
  ICE_SLIDE_MAX_SPEED,
  speedFactor,
} = require("../../constants");
const { grabSeparationEase } = require("../../combatHelpers");
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

  await t.test("mid-ring, the loser eats the separation and the winner holds ground", () => {
    // Previously asserted an EVEN split, which is what made the release look like
    // magnetic repulsion: the fighter who won the drive retreated exactly as far as
    // the one who lost it. The winner still gives a little ground — a shove has a
    // reaction — but the travel belongs to the victim.
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration);
    const grabberAtEnd = s.grabber.x;
    const victimAtEnd = s.victim.x;
    s.advance(32);
    const grabberMoved = Math.abs((s.grabber.grabBreakTargetX ?? s.grabber.x) - grabberAtEnd);
    const victimMoved = Math.abs((s.victim.grabBreakTargetX ?? s.victim.x) - victimAtEnd);
    assert.ok(victimMoved > 1, "the victim should slide");
    assert.ok(grabberMoved > 1, "and the grabber should give some ground, not zero");
    assert.ok(
      victimMoved > grabberMoved * 3,
      `the loser must eat most of the separation, got grabber ${grabberMoved.toFixed(1)} ` +
        `vs victim ${victimMoved.toFixed(1)}`
    );
    const victimShare = victimMoved / (victimMoved + grabberMoved);
    assert.ok(
      Math.abs(victimShare - CMD_DRIVE_RELEASE_VICTIM_SHARE) < 0.02,
      `split should follow CMD_DRIVE_RELEASE_VICTIM_SHARE, got ${victimShare.toFixed(3)}`
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

  await t.test("the shove builds — no frame of it outruns the game", () => {
    // The release used to be the single fastest movement in PenguinPow. A cubic
    // ease-out peaks at 3x its own average, so 132px in 150ms put the victim at
    // ~2.3px/ms leaving the grip — five power slides, quicker than any attack
    // lunge. Motion that fast doesn't read as a push, it reads as a cut.
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(
      s.victim.grabBreakSepCurve,
      "shove",
      "the release must ask for the shove curve, not the hit curve"
    );

    const startX = s.victim.grabBreakStartX;
    const targetX = s.victim.grabBreakTargetX;
    const duration = s.victim.grabBreakSepDuration;
    const step = 1000 / TICK_RATE;
    let peak = 0;
    let prevX = startX;
    for (let elapsed = step; elapsed <= duration + step; elapsed += step) {
      const x =
        startX +
        (targetX - startX) *
          grabSeparationEase(Math.min(1, elapsed / duration), "shove");
      peak = Math.max(peak, Math.abs(x - prevX) / step);
      prevX = x;
    }

    const powerSlide = ICE_SLIDE_MAX_SPEED * speedFactor;
    assert.ok(
      peak < powerSlide * 2,
      `the shove peaks at ${peak.toFixed(2)}px/ms against a ${powerSlide.toFixed(2)}px/ms ` +
        `power slide — a shove can be forceful without being the fastest thing on the ice`
    );
    assert.ok(
      peak > powerSlide,
      `...but it still has to hit harder than walking, got ${peak.toFixed(2)}px/ms`
    );
    assert.ok(
      duration >= 200,
      `the separation has to last long enough to watch, got ${duration}ms`
    );
  });

  await t.test("the shoved fighter throws the palms, and drops them with the slide", () => {
    // Presentation only — the separation is caused by a fighter, not by the
    // engine pulling two sprites apart. It must never be an actual palm thrust.
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.victim.isGrabSeparatePalm, true, "the loser shoves off");
    assert.ok(!s.grabber.isGrabSeparatePalm, "the winner does not");
    assert.ok(
      !s.victim.isPalmThrust && !s.victim.isAttacking,
      "the pose must not smuggle in the move that owns it"
    );
    assert.equal(
      s.victim.grabBreakSepDuration,
      CMD_DRIVE_RELEASE_TWEEN_MS,
      "the pose is paced against the slide, so they have to be the same window"
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

  await t.test("recovery is bounded by the slide, and expires on the sim clock", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    // The lockout spans the separation slide on purpose — you are not free while
    // you are still visibly coming apart, and pretending otherwise is what let a
    // player press into a tween that owned their position. What must never
    // happen is the Drive costing MORE than the motion it produces.
    assert.ok(
      s.grabber.recoveryDuration <= CMD_DRIVE_RELEASE_TWEEN_MS,
      `the Drive must not outlast its own slide, got ${s.grabber.recoveryDuration}ms ` +
        `against a ${CMD_DRIVE_RELEASE_TWEEN_MS}ms separation`
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

  await t.test("input locks are per-side and carry the whole deficit", () => {
    const s = driveToStartOfCarry({ p2Balance: 100 });
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    const now = s.room.simTime;
    assert.ok(s.grabber.inputLockUntil > now - CMD_DRIVE_RELEASE_TWEEN_MS);
    assert.ok(s.victim.inputLockUntil > now - CMD_DRIVE_RELEASE_TWEEN_MS);
    assert.ok(
      s.grabber.inputLockUntil <= now + CMD_DRIVE_RELEASE_TWEEN_MS,
      "the release lock must not outlast its own tween"
    );
    // The release used to stamp ONE flat lock on both fighters, which capped the
    // defender at the attacker's number and silently shrank the advertised 60ms
    // deficit to 20. The locks now ARE the recoveries, so what the constants say
    // is what the players get.
    const lockDeficit = s.grabber.inputLockUntil - s.victim.inputLockUntil;
    assert.equal(
      lockDeficit,
      CMD_DRIVE_ATTACKER_RECOVERY_MS - CMD_DRIVE_DEFENDER_RECOVERY_MS,
      `the defender must actually get their frames back first, got ${lockDeficit}ms`
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

  await t.test("healthy tank at the rope → pin, not a win", () => {
    // Plenty of carry left used to auto-KO; stamina gate must catch that.
    const s = driveIntoRope({ ropeGap: 10, p2Balance: 100, p2Stamina: 100 });
    assert.equal(s.grabber.cmdGrabPhase, "carry");
    assert.equal(s.grabber.cmdGrabEdgeWaiver, false);
    s.advance(s.grabber.cmdGrabCarryDuration);
    assert.equal(s.room.gameOver, false, "full tank must clamp at the tawara");
    assert.ok(
      Math.abs(s.victim.x - MAP_RIGHT_BOUNDARY) < 1,
      "victim should be released pinned against the tawara"
    );
  });

  // Stage a carry that reaches the rope (near or far) — used for stamina-gate cases.
  function stageRopeContact(options = {}) {
    const probe = createCommandGrabScenario({ variant: "drive", ...options });
    probe.connect();
    probe.resolveNow();
    const carryDist = Math.abs(
      probe.grabber.cmdGrabCarryTargetX - probe.grabber.cmdGrabCarryStartX
    );
    const s = createCommandGrabScenario({
      variant: "drive",
      ...options,
      midX: MAP_RIGHT_BOUNDARY - probe.settledAttach / 2 - carryDist * 0.5,
    });
    s.connect();
    s.resolveNow();
    return s;
  }

  await t.test("carry expiring at the rope → pinned release, not a win", () => {
    const s = stageRopeContact({ p2Balance: 100, p2Stamina: 100 });
    assert.equal(s.grabber.cmdGrabEdgeWaiver, false, "healthy victim gets no waiver");
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.room.gameOver, false, "ungassed drive must not ring out");
    assert.ok(
      Math.abs(s.victim.x - MAP_RIGHT_BOUNDARY) < 1,
      "the victim should be released pinned against the tawara"
    );
  });

  await t.test("lethal posture alone does NOT waive the drive clamp", () => {
    // Posture finish belongs to throw/pull / slap/palm — not drive.
    const s = stageRopeContact({
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
      p2Stamina: 100,
    });
    assert.equal(
      s.grabber.cmdGrabEdgeWaiver,
      false,
      "posture lethal must not arm drive rope KO"
    );
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.room.gameOver, false);
  });

  await t.test("a gassed victim is forced out at the rope", () => {
    const s = stageRopeContact({ p2Gassed: true, p2Balance: 100, p2Stamina: 0 });
    assert.equal(s.grabber.cmdGrabEdgeWaiver, true);
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.room.gameOver, true);
    assert.equal(s.grabber.isRingOutPushCutscene, true);
    assert.equal(s.victim.isRingOutPushCutscene, true);
  });

  await t.test("an empty tank waives it too", () => {
    const s = stageRopeContact({ p2Stamina: 0, p2Balance: 100 });
    assert.equal(s.grabber.cmdGrabEdgeWaiver, true);
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(s.room.gameOver, true);
  });

  await t.test("clamp stamina drain can gas mid-push and convert the KO", () => {
    // Low tank + early rope contact: edge tax should empty them while carry runs.
    assert.ok(
      CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC >= 40,
      "edge drain must be hard enough to matter during a pin"
    );
    const s = driveIntoRope({ ropeGap: 8, p2Balance: 100, p2Stamina: 20 });
    assert.equal(s.grabber.cmdGrabEdgeWaiver, false);
    s.advance(s.grabber.cmdGrabCarryDuration + 32);
    assert.equal(
      s.room.gameOver,
      true,
      "draining to empty/gassed mid-pin should finish the shove"
    );
    assert.ok(s.victim.isGassed || s.victim.stamina <= 0);
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
