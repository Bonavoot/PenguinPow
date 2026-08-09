"use strict";

/**
 * Command grab — simultaneous grab.
 *
 * The old system dropped overlapping grab startups into a shared neutral clinch,
 * which a cornered player could fish for as a free reset. With no clinch to fall
 * into — and with a faster grab making mutual attempts far more common — this has
 * to be a MUTUAL WHIFF: brief belt-grip clash, small pushback, and the ordinary
 * grab whiff recovery for both. Bad for both, so nobody goes looking for it.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createCommandGrabScenario } = require("./harness/scenario");
const { executeCommandGrabClash } = require("../../commandGrabSystem");
const {
  GRAB_WHIFF_RECOVERY_MS,
  CMD_GRAB_CLASH_PUSHBACK,
  CMD_GRAB_CLASH_POSE_MS,
} = require("../../constants");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../../gameUtils");

function clashScenario() {
  const s = createCommandGrabScenario({ variant: "drive" });
  // Reset to a pre-connect, both-attempting state.
  for (const p of [s.p1, s.p2]) {
    p.isGrabbing = false;
    p.isBeingGrabbed = false;
    p.grabbedOpponent = null;
    p.hasGrip = false;
    p.inClinch = false;
    p.isGrabStartup = true;
    p.grabStartupStartTime = s.room.simTime;
    p.grabVariant = "throw";
    p.grabVariantLocked = true;
  }
  return s;
}

test("simultaneous grab", async (t) => {
  await t.test("neither fighter ends up gripped or in a clinch", () => {
    const s = clashScenario();
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    for (const p of [s.p1, s.p2]) {
      assert.equal(p.hasGrip, false);
      assert.equal(p.inClinch, false);
      assert.equal(p.isGrabbing, false);
      assert.equal(p.isGrabStartup, false);
      assert.equal(p.cmdGrabPhase, null);
    }
  });

  await t.test("both eat the ordinary grab whiff recovery", () => {
    const s = clashScenario();
    const before = s.room.simTime;
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    for (const p of [s.p1, s.p2]) {
      assert.equal(p.isWhiffingGrab, true);
      assert.equal(p.grabCooldown, true);
      assert.ok(
        p.actionLockUntil >= before + GRAB_WHIFF_RECOVERY_MS,
        "the clash must be at least as punishing as a plain whiff"
      );
    }
  });

  await t.test("the clash beat shows the belt grip, not the grab-attempt pose", () => {
    // isGrabWhiffRecovery forces the grab-attempt sprite, so it is deliberately
    // deferred: for the clash beat both fighters should be locked in the grip.
    const s = clashScenario();
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    for (const p of [s.p1, s.p2]) {
      assert.equal(p.isClinchBeltHolding, true, "belt grip during the beat");
      assert.equal(p.isClinchPushing, true, "which resolves to the grabbing body");
      assert.equal(
        p.isGrabWhiffRecovery,
        false,
        "the whiff pose must not preempt the grip beat"
      );
    }
  });

  await t.test("after the grip beat it drops to the whiff-recovery pose", () => {
    const s = clashScenario();
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    s.advanceTime(CMD_GRAB_CLASH_POSE_MS + 16);
    for (const p of [s.p1, s.p2]) {
      assert.equal(p.isClinchBeltHolding, false);
      assert.equal(p.isClinchPushing, false);
      assert.equal(p.isGrabWhiffRecovery, true);
      assert.equal(p.isWhiffingGrab, true, "still recovering, just a different pose");
    }
  });

  await t.test("recovery actually expires", () => {
    const s = clashScenario();
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    // The clash freezes the sim clock for its own hitstop; advanceTime clears that
    // first, which is what keeps the harness deterministic.
    s.advanceTime(GRAB_WHIFF_RECOVERY_MS + 32);
    for (const p of [s.p1, s.p2]) {
      assert.equal(p.isWhiffingGrab, false);
      assert.equal(p.isGrabWhiffRecovery, false);
      assert.equal(p.grabCooldown, false);
      assert.equal(p.isClinchBeltHolding, false, "clash pose must not linger");
    }
  });

  await t.test("the collision forces grip overlap before anything else", () => {
    // Both fighters lunged into each other, so they must end up AT clinch spacing —
    // pushing them apart on the same tick left a wide gap where the collision
    // should have been.
    const s = clashScenario();
    s.p1.x = 560;
    s.p2.x = 560 + 140; // connected near max grab range
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    assert.ok(
      Math.abs(s.gap() - s.settledAttach) < 0.001,
      `expected forced overlap at ${s.settledAttach}, got ${s.gap()}`
    );
  });

  await t.test("the collision is centred, so neither fighter is teleported", () => {
    const s = clashScenario();
    s.p1.x = 560;
    s.p2.x = 700;
    const midBefore = (s.p1.x + s.p2.x) / 2;
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    assert.ok(
      Math.abs((s.p1.x + s.p2.x) / 2 - midBefore) < 0.001,
      "the pair should close on their shared midpoint"
    );
  });

  await t.test("separation happens AFTER the grip beat, and is mutual", () => {
    const s = clashScenario();
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    const gapAtGrip = s.gap();
    s.advanceTime(CMD_GRAB_CLASH_POSE_MS + 16);
    const p1Target = s.p1.grabBreakTargetX ?? s.p1.x;
    const p2Target = s.p2.grabBreakTargetX ?? s.p2.x;
    const gapAfter = Math.abs(p1Target - p2Target);
    assert.ok(
      Math.abs(gapAfter - (gapAtGrip + CMD_GRAB_CLASH_PUSHBACK)) < 0.001,
      `expected the pair to separate by ${CMD_GRAB_CLASH_PUSHBACK}, got ${gapAfter - gapAtGrip}`
    );
    assert.ok(
      Math.abs(p1Target - s.p1.x) > 1 && Math.abs(p2Target - s.p2.x) > 1,
      "both fighters should be thrown apart, not just one"
    );
  });

  await t.test("the freeze lands on the collision, not on the separation", () => {
    const s = clashScenario();
    s.room.hitstopUntil = 0;
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    assert.ok(
      s.room.hitstopUntil > 0,
      "the collision must freeze so the grip reads before they come apart"
    );
  });

  await t.test("variant selection is discarded, not carried into the next grab", () => {
    const s = clashScenario();
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    for (const p of [s.p1, s.p2]) {
      assert.equal(p.grabVariant, null);
      assert.equal(p.grabVariantLocked, false);
      assert.equal(p.grabWTapTime, 0);
    }
  });

  await t.test("the clash never pushes anyone out of the ring", () => {
    const s = clashScenario();
    s.p1.x = MAP_LEFT_BOUNDARY;
    s.p2.x = MAP_LEFT_BOUNDARY + 40;
    executeCommandGrabClash(s.p1, s.p2, s.room, s.io);
    assert.ok(s.p1.x >= MAP_LEFT_BOUNDARY);
    assert.ok(s.p2.x <= MAP_RIGHT_BOUNDARY);
    s.advanceTime(CMD_GRAB_CLASH_POSE_MS + 16);
    for (const p of [s.p1, s.p2]) {
      const target = p.grabBreakTargetX ?? p.x;
      assert.ok(
        target >= MAP_LEFT_BOUNDARY && target <= MAP_RIGHT_BOUNDARY,
        "the separation target must stay inside the ring"
      );
    }
  });
});
