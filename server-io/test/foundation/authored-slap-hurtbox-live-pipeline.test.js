"use strict";

/**
 * Phase 4A live-runtime repair — real checkCollision / multi-tick pipeline.
 *
 * Reproduces the VS CPU Easy failure:
 *   Flag ON + both tip-live + limb-only spacing → later slap stuffed with
 *   ZERO hits (AP open-hit grace orphaned consumeLosingAttackInstance).
 *
 * Entry is always collisionSystem.checkCollision — never resolveAuthoredSlapHurtContact alone.
 */

const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  setAuthoredSlapHurtboxForTests,
  isAuthoredSlapHurtboxV1Enabled,
  AUTHORED_SLAP_HURTBOX_V1,
} = require("../../authoredSlapHurtboxFlags");
const {
  createFoundationScenario,
  armSlapPhase,
  stepCollisionBothOrders,
  advanceSim,
} = require("./helpers/scenarioHarness");
const {
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
  AP_LATE_PARRY_MS,
  TICK_RATE,
} = require("../../constants");
const {
  getConnectDistance,
  isWithinConnectRange,
} = require("../../strikeContact");
const {
  setAuthoredSlapHurtLiveTraceForTests,
  clearAuthoredSlapHurtLiveTrace,
  getAuthoredSlapHurtLiveTrace,
} = require("../../authoredSlapHurtLiveTrace");
const { createInitialPlayerState } = require("../../playerFactory");
const { checkCollision } = require("../../collisionSystem");

const { limbOnlyGap } = require("./helpers/limbSpacing");

const TICK_MS = 1000 / TICK_RATE;
// Nominal construction spacing only. Real limb-only spacing is DERIVED per
// victim pose after arming (see placeLiveLimbOnly) — the corrected authored arm
// no longer reaches a literal 160.
const LIMB_ONLY_GAP = 160;
const SIZE = 0.85;

/**
 * Re-space an armed live scenario into the honest limb-only band, keeping the
 * pair centred and preserving which fighter is on which side (cross-up cases
 * deliberately swap roots). Returns the applied gap, or null if no band exists.
 */
function placeLiveLimbOnly(s, kind, simTime, opts = {}) {
  const attacker = opts.attacker || s.left;
  const victim = opts.victim || s.right;
  const gap = limbOnlyGap(kind, attacker, victim, simTime, opts.bias);
  if (gap == null) return null;
  const mid = (s.left.x + s.right.x) / 2;
  const leftSign = s.left.x <= s.right.x ? -1 : 1;
  s.left.x = mid + (leftSign * gap) / 2;
  s.right.x = mid - (leftSign * gap) / 2;
  return gap;
}

function hitCount(io) {
  return io.find("player_hit").length;
}

function lastHit(io) {
  const hits = io.find("player_hit");
  return hits.length ? hits[hits.length - 1].payload : null;
}

/** Real-ish VS CPU Easy pair: size 0.85, CPU flag, grounded. */
function liveCpuScenario(opts = {}) {
  const gap = opts.gap != null ? opts.gap : LIMB_ONLY_GAP;
  const s = createFoundationScenario({
    gap,
    sizeA: SIZE,
    sizeB: SIZE,
    leftFacing: opts.leftFacing != null ? opts.leftFacing : -1,
    rightFacing: opts.rightFacing != null ? opts.rightFacing : 1,
    swapPlayerOrder: !!opts.swapPlayerOrder,
  });
  // Mirror live CPU construction extras that fixtures often omit.
  s.right.isCPU = true;
  s.right.cpuDifficulty = "EASY";
  s.left.isCPU = false;
  s.left.canMoveToReady = false;
  s.right.canMoveToReady = false;
  return s;
}

function armLiveSlapActive(player, now, agePastStartupMs) {
  player.isAttacking = true;
  player.isSlapAttack = true;
  player.attackType = "slap";
  player.slapAnimation = player.slapAnimation === 2 ? 2 : 1;
  player.slapFacingDirection = player.facing;
  player.currentAction = "slap";
  player.isInStartupFrames = false;
  player.isRecovering = false;
  player.attackStartTime = now - SLAP_STARTUP_MS - agePastStartupMs;
  player.slapActiveEndTime =
    player.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
  player.attackEndTime = player.slapActiveEndTime + SLAP_RECOVERY_MS;
  player.movementVelocity = 0;
  return player;
}

function armLiveSlapRecovery(player, now) {
  player.isAttacking = true;
  player.isSlapAttack = true;
  player.attackType = "slap";
  player.slapAnimation = 1;
  player.slapFacingDirection = player.facing;
  player.currentAction = "slap";
  player.isInStartupFrames = false;
  player.isRecovering = false;
  player.attackStartTime =
    now - SLAP_STARTUP_MS - SLAP_ACTIVE_MS - 10;
  player.slapActiveEndTime =
    player.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
  player.attackEndTime = player.slapActiveEndTime + SLAP_RECOVERY_MS;
  return player;
}

function assertLimbOnlySpacing(attacker, victim) {
  const dist = Math.abs(victim.x - attacker.x);
  const connect = getConnectDistance("slap", attacker, victim);
  assert.equal(
    isWithinConnectRange(dist, connect),
    false,
    `expected torso-whiff spacing dist=${dist} connect=${connect}`
  );
}

describe("Phase 4A live-pipeline — orphan slap-vs-slap AP grace (root cause)", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
    setAuthoredSlapHurtLiveTraceForTests(null);
    clearAuthoredSlapHurtLiveTrace();
  });

  it("flag ON: reciprocal limb-only while earlier in AP grace must land ONE hit (not orphan later)", () => {
    setAuthoredSlapHurtboxForTests(true);
    setAuthoredSlapHurtLiveTraceForTests(true);
    const s = liveCpuScenario({ gap: LIMB_ONLY_GAP });
    const t0 = s.room.simTime;
    // CPU earlier, still inside AP grace window (age 95 < 100).
    armLiveSlapActive(s.right, t0, 40);
    // P1 later, just cleared startup (age 55) — inside grace too.
    armLiveSlapActive(s.left, t0, 0);
    assert.ok(placeLiveLimbOnly(s, "slap", t0) != null);
    assertLimbOnlySpacing(s.left, s.right);

    const leftAtkBefore = s.left.isAttacking;
    stepCollisionBothOrders(s);

    assert.equal(hitCount(s.io), 1, "must emit exactly one player_hit");
    const payload = lastHit(s.io);
    assert.equal(payload.victimHurtRegion, "frontArm");
    assert.equal(payload.authoredSlapHurtboxV1, true);
    // Later (P1) is the victim of earlier CPU limb hit — legitimate stop.
    assert.equal(s.left.isHit, true);
    assert.equal(s.right.isHit, false);
    // Must not be the old orphan: later cleared with zero hits.
    assert.ok(leftAtkBefore === true);
    assert.equal(hitCount(s.io) > 0, true);

    const trace = getAuthoredSlapHurtLiveTrace();
    assert.ok(trace.length >= 1, "live trace must record the contact tick");
    assert.equal(trace.some((r) => r.tipLimbOverlap === true), true);
    assert.equal(trace.some((r) => r.poseReady === true), true);
    s.dispose();
  });

  it("flag OFF: same reciprocal limb spacing never connects and never stuffs via limb", () => {
    setAuthoredSlapHurtboxForTests(false);
    const s = liveCpuScenario({ gap: LIMB_ONLY_GAP });
    const t0 = s.room.simTime;
    armLiveSlapActive(s.right, t0, 40);
    armLiveSlapActive(s.left, t0, 0);
    assertLimbOnlySpacing(s.left, s.right);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 0);
    assert.equal(s.left.isHit, false);
    assert.equal(s.right.isHit, false);
    // Both tip-live slaps remain live — no orphan consume from limb candidate.
    assert.equal(s.left.isAttacking, true);
    assert.equal(s.right.isAttacking, true);
    s.dispose();
  });

  it("rejected limb candidate (neutral victim) does not stop attacker animation", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = liveCpuScenario({ gap: LIMB_ONLY_GAP });
    const t0 = s.room.simTime;
    armLiveSlapActive(s.left, t0, 50); // past AP grace
    s.right.isAttacking = false;
    s.right.isSlapAttack = false;
    s.right.attackType = null;
    s.right.slapActiveEndTime = 0;
    assertLimbOnlySpacing(s.left, s.right);
    stepCollisionBothOrders(s);
    assert.equal(hitCount(s.io), 0);
    assert.equal(s.left.isAttacking, true, "miss must not cancel attacker slap");
    assert.equal(s.left.isHit, false);
    assert.equal(s.left._strikeContactOverride == null, true);
    s.dispose();
  });
});

describe("Phase 4A live-pipeline — multi-tick limb authority", () => {
  afterEach(() => {
    setAuthoredSlapHurtboxForTests(null);
  });

  it("flag ON recovery limb-only: multi-tick through AP grace then ONE punish", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = liveCpuScenario({ gap: LIMB_ONLY_GAP });
    const t0 = s.room.simTime;
    armLiveSlapRecovery(s.right, t0);
    armLiveSlapActive(s.left, t0, 0); // enters grace
    // Slap is the only attacker whose authored rail out-reaches legacy torso
    // connect against the retracted recovery arm (size 0.85 only).
    assert.ok(placeLiveLimbOnly(s, "slap", t0) != null);
    assertLimbOnlySpacing(s.left, s.right);

    let landedAt = -1;
    for (let i = 0; i < 16; i++) {
      stepCollisionBothOrders(s);
      if (s.right.isHit) {
        landedAt = i;
        break;
      }
      assert.equal(
        s.left.isAttacking,
        true,
        `attacker must stay live while deferred i=${i}`
      );
      advanceSim(s, TICK_MS);
    }
    assert.ok(landedAt >= 0, "must eventually land");
    assert.equal(hitCount(s.io), 1);
    assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");
    assert.equal(lastHit(s.io).isPunish, true);
    // Following ticks must not double-hit.
    for (let i = 0; i < 4; i++) {
      advanceSim(s, TICK_MS);
      stepCollisionBothOrders(s);
    }
    assert.equal(hitCount(s.io), 1);
    s.dispose();
  });

  it("flag ON active limb-only: P1 vs CPU, order swap, cross-up retained facing", () => {
    setAuthoredSlapHurtboxForTests(true);
    // Standard: P1 left → CPU right
    {
      const s = liveCpuScenario({ gap: LIMB_ONLY_GAP });
      const t0 = s.room.simTime;
      armLiveSlapRecovery(s.right, t0);
      armLiveSlapActive(s.left, t0, 60);
      assert.ok(placeLiveLimbOnly(s, "slap", t0) != null);
      assertLimbOnlySpacing(s.left, s.right);
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 1, "P1→CPU");
      assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");
      s.dispose();
    }
    // Player-array order swap (CPU checked first)
    {
      const s = liveCpuScenario({ gap: LIMB_ONLY_GAP, swapPlayerOrder: true });
      const t0 = s.room.simTime;
      armLiveSlapRecovery(s.right, t0);
      armLiveSlapActive(s.left, t0, 60);
      assert.ok(placeLiveLimbOnly(s, "slap", t0) != null);
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 1, "order-swap");
      s.dispose();
    }
    // Cross-up: roots swapped, action-facing retained toward opponent
    {
      const s = liveCpuScenario({ gap: LIMB_ONLY_GAP });
      const t0 = s.room.simTime;
      const lx = s.left.x;
      const rx = s.right.x;
      s.left.x = rx;
      s.right.x = lx;
      // Facing still committed as if original sides (action-facing retention)
      s.left.facing = -1;
      s.right.facing = 1;
      armLiveSlapRecovery(s.right, t0);
      armLiveSlapActive(s.left, t0, 60);
      // After swap they face away from geometric opponent — flip commit so
      // slapFacing still aims at the limb (retained toward target).
      s.left.facing = 1;
      s.left.slapFacingDirection = 1;
      s.right.facing = -1;
      s.right.slapFacingDirection = -1;
      // Re-space AFTER the cross-up swap and facing commit — placement preserves
      // sides, so retained action-facing is what the probe reads.
      assert.ok(placeLiveLimbOnly(s, "slap", t0) != null);
      assertLimbOnlySpacing(s.left, s.right);
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 1, "cross-up retained facing");
      assert.equal(lastHit(s.io).victimHurtRegion, "frontArm");
      s.dispose();
    }
  });

  it("retracted / neutral victim: limb-only miss; torso+limb once at close range", () => {
    setAuthoredSlapHurtboxForTests(true);
    // Retracted
    {
      const s = liveCpuScenario({ gap: LIMB_ONLY_GAP });
      const t0 = s.room.simTime;
      armLiveSlapActive(s.left, t0, 60);
      s.right.isAttacking = false;
      s.right.isSlapAttack = false;
      s.right.attackType = null;
      s.right.currentAction = null;
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 0);
      s.dispose();
    }
    // Torso + limb overlap → once
    {
      const s = liveCpuScenario({ gap: 120 });
      const t0 = s.room.simTime;
      armLiveSlapRecovery(s.right, t0);
      armLiveSlapActive(s.left, t0, 60);
      stepCollisionBothOrders(s);
      assert.equal(hitCount(s.io), 1);
      for (let i = 0; i < 3; i++) {
        advanceSim(s, TICK_MS);
        stepCollisionBothOrders(s);
      }
      assert.equal(hitCount(s.io), 1);
      s.dispose();
    }
  });
});

describe("Phase 4A live-pipeline — fixture vs live fighter fields", () => {
  it("createInitialPlayerState exposes the fields Phase 4A reads (no fixture-only clocks)", () => {
    const p = createInitialPlayerState({
      id: "cpu-audit",
      fighter: "player 2",
      x: 700,
      facing: 1,
      sizeMultiplier: 0.85,
    });
    p.isCPU = true;
    const required = [
      "x",
      "y",
      "facing",
      "sizeMultiplier",
      "isAttacking",
      "isSlapAttack",
      "attackType",
      "isInStartupFrames",
      "attackStartTime",
      "slapActiveEndTime",
      "slapFacingDirection",
      "slapAnimation",
      "currentAction",
      "isHit",
      "isAlreadyHit",
      "lastCheckedAttackTime",
    ];
    for (const k of required) {
      assert.ok(k in p, `missing live field ${k}`);
    }
    assert.equal(p.sizeMultiplier, 0.85);
    // Defaults must not invent slap exposure.
    assert.equal(p.isSlapAttack, false);
    assert.equal(p.slapActiveEndTime || 0, 0);
    // Live factory omits isRecovering; slap recovery uses clocks + isAttacking.
    assert.equal("isRecovering" in p, false);
  });

  // Phase 4C graduated this gate: the accepted slap/palm limb authority is the
  // shipped default, and only an explicit OFF spelling rolls back to legacy.
  it("module default flag is ON, with the explicit rollback intact", () => {
    setAuthoredSlapHurtboxForTests(null);
    assert.equal(AUTHORED_SLAP_HURTBOX_V1, true);
    assert.equal(isAuthoredSlapHurtboxV1Enabled(""), true);
    assert.equal(isAuthoredSlapHurtboxV1Enabled(undefined), true);
    for (const off of ["0", "false", "off", "no"]) {
      assert.equal(isAuthoredSlapHurtboxV1Enabled(off), false, off);
    }
  });
});
