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
const {
  CMD_DRIVE_CARRY_MS,
  CMD_DRIVE_CINCH_FRACTION,
  CMD_GRAB_STAMINA_COST,
  CMD_DRIVE_POSTURE_CHIP,
  CMD_PULL_POSTURE_CHIP,
  CMD_THROW_POSTURE_CHIP,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_THROW_DISTANCE_MIN,
  CLINCH_THROW_DISTANCE_MAX,
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

  await t.test("a far connect cinches into grip spacing, never snaps", () => {
    // A grab can connect anywhere inside GRAB_RANGE (146) while grip spacing is
    // ~61px. Closing that instantly would teleport the victim on the first tick.
    const s = createCommandGrabScenario({ variant: "throw", connectGap: 140 });
    s.connect();
    assert.ok(
      Math.abs(s.gap() - 140) < 0.001,
      "connect must preserve the gap the grab actually landed at"
    );
    const victimStartX = s.victim.x;
    // Production connects inside a tick, so the first update for this grab runs on
    // the NEXT tick — advance then update, which is what `advance` does.
    s.advance(s.tickMs);
    const afterOne = s.gap();
    assert.ok(
      afterOne < 140 && afterOne > s.settledAttach,
      `first tick must move partway, got ${afterOne}`
    );
    assert.ok(
      Math.abs(s.victim.x - victimStartX) < 30,
      "no teleport — the victim is pulled in, not snapped"
    );

    // Monotonic close, right up to the last tick still in startup.
    let previous = afterOne;
    let lastStartupGap = afterOne;
    while (s.grabber.cmdGrabPhase === "startup") {
      s.advance(s.tickMs);
      if (s.grabber.cmdGrabPhase !== "startup") break;
      const current = s.gap();
      assert.ok(current <= previous + 0.001, "the grip must never widen mid-cinch");
      previous = current;
      lastStartupGap = current;
    }
    assert.ok(
      lastStartupGap - s.settledAttach < 15,
      `grip should be essentially closed by resolution, got ${lastStartupGap} vs ${s.settledAttach}`
    );
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
    s.advance(CMD_DRIVE_CARRY_MS * CMD_DRIVE_CINCH_FRACTION);
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
