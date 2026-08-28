"use strict";

/**
 * Command grab — connect beat, variant resolution, and lethality.
 *
 * Shape under test:
 *   connect → STARTUP (per-variant read beat; Drive has none) → resolve
 *
 * The STARTUP beat is uninterruptible: there is no post-connect Grab Break and no
 * Brace, so nothing may cancel it and nothing may change the outcome after connect.
 *
 * Lethality is one rule for all three variants — posture below the threshold AT
 * CONNECT ends the round — and it is a property of the victim's posture, never of
 * the attacker's strength, so a gassed attacker keeps every kill.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createCommandGrabScenario } = require("./harness/scenario");
const { profileFor } = require("../../momentumTransfer");
const { grabTellAnimMs } = require("../../commandGrabSystem");
const {
  CMD_DRIVE_CINCH_FRACTION,
  CMD_GRAB_CINCH_MS,
  CMD_GRAB_STAMINA_COST,
  CMD_DRIVE_POSTURE_CHIP,
  CMD_PULL_POSTURE_CHIP,
  CMD_THROW_POSTURE_CHIP,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_THROW_DISTANCE_MIN,
  CLINCH_THROW_DISTANCE_MAX,
  GRAB_RANGE,
} = require("../../constants");

test("command grab connect beat", async (t) => {
  await t.test("connect opens the belt-grip read on both fighters", () => {
    const s = createCommandGrabScenario({ variant: "drive" }).connect();
    assert.equal(s.grabber.cmdGrabPhase, "startup");
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

  await t.test("each variant chips posture by its own amount", () => {
    const cases = [
      ["drive", CMD_DRIVE_POSTURE_CHIP],
      ["pull", CMD_PULL_POSTURE_CHIP],
      ["throw", CMD_THROW_POSTURE_CHIP],
    ];
    for (const [variant, chip] of cases) {
      const s = createCommandGrabScenario({ variant, p2Balance: 100 }).connect();
      assert.equal(s.victim.balance, 100 - chip, `${variant} chip`);
    }
  });

  await t.test("startup poses match the locked variant", () => {
    const drive = createCommandGrabScenario({ variant: "drive" }).connect();
    assert.equal(drive.grabber.isClinchPushing, true);
    assert.equal(drive.grabber.isAttemptingGrabThrow, false);
    assert.equal(drive.grabber.isAttemptingPull, false);

    const throwS = createCommandGrabScenario({ variant: "throw" }).connect();
    assert.equal(throwS.grabber.isAttemptingGrabThrow, true);

    const pull = createCommandGrabScenario({ variant: "pull" }).connect();
    assert.equal(pull.grabber.isAttemptingPull, true);
  });

  await t.test("the held victim shows the belt grip, never the generic hit pose", () => {
    // isResistingThrow / isResistingPull resolve to `hit` on the client, which was
    // right when there was something to resist. Nothing is resisted now — the victim
    // is simply held — so those must stay clear and let the grip body win.
    for (const variant of ["drive", "throw", "pull"]) {
      const s = createCommandGrabScenario({ variant }).connect();
      assert.equal(s.victim.isResistingThrow, false, `${variant}: no resist-throw`);
      assert.equal(s.victim.isResistingPull, false, `${variant}: no resist-pull`);
      assert.equal(s.victim.hasGrip, true, `${variant}: grip drives the victim pose`);
    }
  });

  await t.test("the carry tells pusher from pushed by posture", () => {
    // The core readability fix: both fighters used to resolve to the same hunched
    // grabbing body, so a drive looked like two identical sprites gliding sideways.
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

  await t.test("the grabber holds position through the read beat", () => {
    const s = createCommandGrabScenario({ variant: "throw" }).connect();
    const gx = s.grabber.x;
    const gap = s.gap();
    s.advance(s.startupMs - 20);
    assert.equal(s.grabber.cmdGrabPhase, "startup");
    assert.ok(Math.abs(s.grabber.x - gx) < 0.001, "grabber must not drift");
    assert.ok(
      Math.abs(s.gap() - gap) < 0.001,
      "already at grip spacing — nothing to cinch, so spacing must hold"
    );
  });

  await t.test("a far connect cinches fast, then holds — never snaps, never drifts", () => {
    // A grab can connect anywhere inside GRAB_RANGE while grip spacing is ~61px.
    // Closing that instantly would teleport. Stretching it across the whole tell
    // made the pair glide together like magnets. Cinch has its own short beat.
    const farGap = GRAB_RANGE - 1;
    const s = createCommandGrabScenario({ variant: "throw", connectGap: farGap });
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
    assert.equal(s.grabber.cmdGrabPhase, "startup", "tell continues after the grip is closed");

    const heldGap = s.gap();
    s.advance(s.startupMs - CMD_GRAB_CINCH_MS - s.tickMs - 16);
    if (s.grabber.cmdGrabPhase === "startup") {
      assert.ok(
        Math.abs(s.gap() - heldGap) < 1,
        `once cinched, spacing must hold through the rest of the tell, got ${s.gap()} vs ${heldGap}`
      );
    }
  });

  await t.test("resolution waits for the full startup, then fires", () => {
    const s = createCommandGrabScenario({ variant: "throw" }).connect();
    s.advance(s.startupMs - 16);
    assert.equal(s.grabber.isThrowing, false, "must not resolve early");
    s.advance(32);
    assert.equal(s.grabber.isThrowing, true);
  });

  await t.test("Drive has NO read beat — the shove starts immediately", () => {
    // A pause before a shove reads as the game hitching, and it would flatten any
    // future scaling of the carry off approach speed.
    const s = createCommandGrabScenario({ variant: "drive" }).connect();
    assert.equal(s.startupMs, 0, "drive must have no startup beat");
    s.advance(s.tickMs);
    assert.equal(
      s.grabber.cmdGrabPhase,
      "carry",
      "the very first tick after connect should already be carrying"
    );
  });

  await t.test("Drive closes its grip on the move, not in a pause", () => {
    // With no startup beat there is nowhere to cinch, so it happens during the carry.
    // A far connect must still never snap the victim inward.
    const s = createCommandGrabScenario({ variant: "drive", connectGap: 140 });
    s.connect();
    s.advance(s.tickMs);
    const firstTickGap = s.gap();
    assert.ok(
      firstTickGap > s.settledAttach + 20,
      `grip must still be open on the first carry tick, got ${firstTickGap}`
    );
    s.advance(s.grabber.cmdGrabCarryDuration * CMD_DRIVE_CINCH_FRACTION);
    assert.ok(
      Math.abs(s.gap() - s.settledAttach) < 6,
      `grip should be closed by the end of the cinch slice, got ${s.gap()}`
    );
  });

  await t.test("Pull keeps a short beat; Throw keeps a longer one", () => {
    const pull = createCommandGrabScenario({ variant: "pull" });
    const throwS = createCommandGrabScenario({ variant: "throw" });
    assert.ok(pull.startupMs > 0, "the yank windup needs to register");
    assert.ok(
      throwS.startupMs > pull.startupMs,
      "the throw is the finisher and earns the longer look"
    );
  });

  await t.test("the client tell duration is stamped on connect", () => {
    const drive = createCommandGrabScenario({ variant: "drive" }).connect();
    assert.equal(
      drive.grabber.clinchThrowAnimMs,
      0,
      "a shove has no windup to pace"
    );

    const pull = createCommandGrabScenario({ variant: "pull" }).connect();
    assert.equal(pull.grabber.clinchThrowAnimMs, grabTellAnimMs("pull", false));
    assert.ok(
      pull.grabber.clinchThrowAnimMs > pull.startupMs,
      "CSS runs during hitstop, so the tell must cover freeze + startup"
    );

    const throwS = createCommandGrabScenario({ variant: "throw" }).connect();
    assert.equal(throwS.grabber.clinchThrowAnimMs, grabTellAnimMs("throw", false));
  });

  await t.test("kill grabs hold the tell longer than non-kills", () => {
    const healthy = createCommandGrabScenario({
      variant: "throw",
      p2Balance: 100,
    });
    const lethal = createCommandGrabScenario({
      variant: "throw",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    assert.ok(
      lethal.startupMs > healthy.startupMs,
      `kill throw tell ${lethal.startupMs} must outlast non-kill ${healthy.startupMs}`
    );

    const healthyPull = createCommandGrabScenario({
      variant: "pull",
      p2Balance: 100,
    });
    const lethalPull = createCommandGrabScenario({
      variant: "pull",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    assert.ok(lethalPull.startupMs > healthyPull.startupMs);

    lethal.connect();
    assert.equal(lethal.grabber.clinchThrowAnimMs, grabTellAnimMs("throw", true));
    assert.equal(lethal.grabber.cmdGrabIsKill, true);
  });

  await t.test("pull keeps the tell duration through the yank; throw drops it", () => {
    const pull = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    pull.connect().resolveNow();
    assert.equal(
      pull.grabber.clinchThrowAnimMs,
      grabTellAnimMs("pull", false),
      "restarting the 600ms fallback mid-yank would replay the windup"
    );

    const throwS = createCommandGrabScenario({
      variant: "throw",
      p2Balance: 100,
    });
    throwS.connect().resolveNow();
    assert.equal(
      throwS.grabber.clinchThrowAnimMs,
      0,
      "the thrower leaves the windup pose for the arc"
    );
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

  await t.test("throw travel scales with the victim's posture", () => {
    const healthy = createCommandGrabScenario({ variant: "throw", p2Balance: 100 });
    healthy.connect().resolveNow();
    const battered = createCommandGrabScenario({ variant: "throw", p2Balance: 30 });
    battered.connect().resolveNow();
    assert.ok(
      battered.grabber.clinchThrowArcDistance >
        healthy.grabber.clinchThrowArcDistance,
      "a battered opponent must travel further from the same input"
    );
    assert.ok(
      healthy.grabber.clinchThrowArcDistance >= profileFor("throw").floor - 1,
      "throw arc uses the momentum profile floor"
    );
    assert.ok(battered.grabber.clinchThrowArcDistance <= CLINCH_THROW_DISTANCE_MAX);
  });

  await t.test("throw is lethal below the threshold at connect", () => {
    const s = createCommandGrabScenario({
      variant: "throw",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    s.connect().resolveNow();
    assert.equal(s.grabber.isClinchKillThrow, true);
    assert.equal(s.victim.isClinchKillThrowVictim, true);
  });

  await t.test("lethality reads posture at connect, not after the chip", () => {
    // Posture sits just above the line; the variant's own chip pushes it under.
    // The kill must NOT trigger — otherwise the advertised danger line would move
    // under the player between committing and connecting.
    const above = CLINCH_THROW_KILL_THRESHOLD + 1;
    assert.ok(
      above - CMD_THROW_POSTURE_CHIP < CLINCH_THROW_KILL_THRESHOLD,
      "fixture must actually straddle the line"
    );
    const s = createCommandGrabScenario({ variant: "throw", p2Balance: above });
    s.connect().resolveNow();
    assert.equal(s.grabber.isClinchKillThrow, false);
  });

  await t.test("a gassed attacker still kills", () => {
    const s = createCommandGrabScenario({
      variant: "throw",
      p1Gassed: true,
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    s.connect().resolveNow();
    assert.equal(
      s.grabber.isClinchKillThrow,
      true,
      "lethality belongs to the victim's posture, not the attacker's tank"
    );
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
    assert.equal(s.grabber.isAttemptingPull, true, "yank pose must be re-armed");
    assert.equal(s.grabber.cmdGrabPhase, null);
  });

  await t.test("non-kill pull stamps a shared lock — settle is +0", () => {
    const s = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    s.connect().resolveNow();
    const yank = s.victim.grabBreakSepDuration;
    assert.ok(yank > 0, "the yank must still exist");
    assert.equal(
      s.grabber.actionLockUntil,
      s.victim.actionLockUntil,
      "the puller must not be jailed after the victim is free"
    );
    assert.equal(s.grabber.inputLockUntil, s.victim.inputLockUntil);
    assert.equal(
      s.grabber.actionLockUntil,
      s.room.simTime + yank,
      "the lock must die with the yank"
    );
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
    const sent = Math.abs(target - grabberX);
    const p = profileFor("pull");
    assert.ok(
      sent >= p.floor - 1 && sent <= p.ceil + 1,
      `belt tug must stay in the side-switch band, got ${sent}`
    );
  });

  await t.test("pull does not stretch with the victim's run-in", () => {
    const standing = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    standing.connect().resolveNow();
    const standingDist = Math.abs(
      standing.victim.grabBreakTargetX - standing.grabber.x
    );

    const rushing = createCommandGrabScenario({ variant: "pull", p2Balance: 100 });
    rushing.connect();
    rushing.grabber.cmdGrabVictimApproach = 2.4;
    rushing.resolveNow();
    const rushingDist = Math.abs(
      rushing.victim.grabBreakTargetX - rushing.grabber.x
    );

    assert.ok(
      Math.abs(standingDist - rushingDist) < 1,
      `their charge is Matador's dump, not Pull's: standing ${standingDist} vs rushing ${rushingDist}`
    );
  });

  await t.test("pull is lethal below the threshold", () => {
    const s = createCommandGrabScenario({
      variant: "pull",
      p2Balance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    s.connect().resolveNow();
    assert.equal(
      s.victim.isClinchKillPullVictim,
      true,
      "every grab kills below the line — the variant only picks the kimarite"
    );
    assert.equal(s.room.gameOver, true);
  });
});
