"use strict";

/**
 * Charged DEMOLISHED fly-out speed.
 *
 * The live-hit send cap (MAX_SEND_PX) used to swallow CINEMATIC_KILL_KNOCKBACK_BOOST
 * when it was passed as a transfer `mult`, so a cinematic KO crawled off at
 * ordinary charged-slide speed. Flight speed is a separate channel: boost the
 * live send, then clamp so smoke-trail backfill can keep up.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  CINEMATIC_KILL_KNOCKBACK_BOOST,
  CINEMATIC_KILL_SPEED_CAP,
  CHARGED_HIT_RECOVERY_MS,
  CHARGED_HITSTUN_MAX_MS,
  CHARGED_HITSTUN_COMBO_CAP_MS,
  CHARGE_MIN_HOLD_MS,
  SLAP_STARTUP_MS,
  DELTA_TRACKED_PROPS,
  ALL_TRACKED_PROPS,
} = require("../../constants");
const { MAP_RIGHT_BOUNDARY, timeoutManager } = require("../../gameUtils");
const { chargedHitRecoilVelocity } = require("../../chargedHeadbuttContact");
const MomentumTransfer = require("../../momentumTransfer");
const {
  applyCinematicKillSpeed,
  processHit,
} = require("../../collisionSystem");
const {
  createContactScenario,
  armCharged,
  placeInConnectRange,
} = require("../contact/helpers/contactSim");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
  timeoutManager.clearAll();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

function landCharged(s, { power, attackerX }) {
  const now = s.simTime;
  s.left.x = attackerX;
  s.left.facing = -1;
  s.right.facing = 1;
  armCharged(s.left, { power, now });
  s.left.chargedReleasePower = power;
  s.left.chargeAttackPower = power;
  placeInConnectRange(s.left, s.right, "charged");
  processHit(s.left, s.right, s.rooms, s.io);
  return s;
}

function expectedChargedSendPx(chargePct) {
  const chargeFraction = Math.max(0, Math.min(chargePct / 100, 1));
  const vSelf = MomentumTransfer.V_REF * chargeFraction;
  const profile = MomentumTransfer.MOVE_TRANSFER.charged;
  const raw = MomentumTransfer.transfer(vSelf, profile.floor, profile.ceil, 1);
  const cap = profile.maxSend > 0 ? profile.maxSend : MomentumTransfer.MAX_SEND_PX;
  return Math.min(raw, cap);
}

function expectedLiveChargedVel(chargePct) {
  const profile = MomentumTransfer.MOVE_TRANSFER.charged;
  return MomentumTransfer.velocityForSendPx(
    expectedChargedSendPx(chargePct),
    profile.kbFriction
  );
}

function expectedCinematicChargedVel(chargePct) {
  return Math.abs(
    applyCinematicKillSpeed(
      MomentumTransfer.pxToKbVelocity(expectedChargedSendPx(chargePct))
    )
  );
}

describe("applyCinematicKillSpeed", () => {
  it("rockets the live send by the authored boost", () => {
    const live = 2.8;
    const out = applyCinematicKillSpeed(live);
    assert.ok(
      Math.abs(out - live * CINEMATIC_KILL_KNOCKBACK_BOOST) < 1e-9,
      `boosted ${out} from live ${live}`
    );
  });

  it("preserves direction", () => {
    assert.ok(applyCinematicKillSpeed(-2.5) < 0);
    assert.ok(applyCinematicKillSpeed(2.5) > 0);
  });

  it("caps stacked juice so trails can keep up", () => {
    const over = applyCinematicKillSpeed(CINEMATIC_KILL_SPEED_CAP);
    assert.equal(Math.abs(over), CINEMATIC_KILL_SPEED_CAP);
    assert.equal(applyCinematicKillSpeed(-99), -CINEMATIC_KILL_SPEED_CAP);
  });
});

describe("charged cinematic kill flight speed", () => {
  it("a full-charge edge KO is a rocket, not a MAX_SEND crawl", () => {
    const edge = landCharged(sc(), { power: 100, attackerX: MAP_RIGHT_BOUNDARY - 140 });
    const mid = landCharged(sc(), { power: 100, attackerX: 560 });

    assert.equal(!!edge.right.isCinematicKillVictim, true, "edge 100% is cinematic");
    assert.equal(!!mid.right.isCinematicKillVictim, false, "midscreen 100% is not");
    assert.equal(!!mid.right.isHit, true, "midscreen still lands a live charged hit");
    assert.equal(edge.io.find("cinematic_kill").length, 1);

    const cinematicVel = Math.abs(edge.right.knockbackVelocity.x);
    const liveVel = Math.abs(mid.right.knockbackVelocity.x);
    const expectedLive = expectedLiveChargedVel(100);
    const expectedRocket = expectedCinematicChargedVel(100);

    assert.ok(
      Math.abs(liveVel - expectedLive) < 0.08,
      `midscreen stays on the live send (${liveVel.toFixed(2)} vs ${expectedLive.toFixed(2)})`
    );
    assert.ok(
      Math.abs(cinematicVel - expectedRocket) < 0.08,
      `cinematic is the boosted ice send (${cinematicVel.toFixed(2)} vs ${expectedRocket.toFixed(2)})`
    );
    assert.ok(
      liveVel < CINEMATIC_KILL_SPEED_CAP - 2,
      `live shove stays under the kill cap (${liveVel.toFixed(2)})`
    );
    assert.ok(
      cinematicVel > liveVel + 3,
      `rocket must clearly beat the live shove (${cinematicVel.toFixed(2)} vs ${liveVel.toFixed(2)})`
    );
    assert.ok(
      cinematicVel <= CINEMATIC_KILL_SPEED_CAP + 1e-9,
      `stays under the VFX cap (${cinematicVel} <= ${CINEMATIC_KILL_SPEED_CAP})`
    );
  });

  it("flight speed still scales with charge under the cap", () => {
    const full = landCharged(sc(), { power: 100, attackerX: MAP_RIGHT_BOUNDARY - 140 });
    const commit = landCharged(sc(), { power: 80, attackerX: MAP_RIGHT_BOUNDARY - 140 });

    assert.equal(full.right.isCinematicKillVictim, true);
    assert.equal(commit.right.isCinematicKillVictim, true);

    const fullVel = Math.abs(full.right.knockbackVelocity.x);
    const commitVel = Math.abs(commit.right.knockbackVelocity.x);
    assert.ok(
      commitVel < fullVel - 0.4,
      `80% (${commitVel.toFixed(2)}) must be slower than 100% (${fullVel.toFixed(2)})`
    );
    assert.ok(
      commitVel > expectedLiveChargedVel(100),
      "even an 80% KO still outruns a live full-charge slide"
    );
  });

  it("ships isCinematicKillVictim on the fighter wire so the client can glide", () => {
    assert.ok(DELTA_TRACKED_PROPS.includes("isCinematicKillVictim"));
    assert.ok(ALL_TRACKED_PROPS.includes("isCinematicKillVictim"));
  });

  it("a live full charge plants short, and their stun ends before a follow-up can hit", () => {
    const mid = landCharged(sc(), { power: 100, attackerX: 560 });
    assert.equal(!!mid.right.isCinematicKillVictim, false);
    assert.equal(mid.right.isHit, true);
    assert.equal(mid.left.chargedOnHitLockMs, undefined);

    mid.room.hitstopUntil = 0;
    timeoutManager.processRoom(mid.room);

    assert.equal(mid.left.isRecovering, true);
    assert.equal(mid.left.recoveryDuration, CHARGED_HIT_RECOVERY_MS);
    assert.ok(mid.right.isHit, "the shove is still playing when you plant");
    const victimStun = CHARGED_HITSTUN_MAX_MS;
    assert.ok(
      victimStun <= CHARGED_HITSTUN_COMBO_CAP_MS,
      "counter scaling must not push stun back into a combo"
    );
    assert.ok(
      victimStun < CHARGED_HIT_RECOVERY_MS + SLAP_STARTUP_MS,
      "they can act before a slap thrown on the first free frame is active"
    );
    assert.ok(
      victimStun < CHARGED_HIT_RECOVERY_MS + CHARGE_MIN_HOLD_MS,
      "a second headbutt cannot release while they are still stunned"
    );
  });

  it("attacker freezes on the strike pose, then plants like a live charged connect", () => {
    const edge = landCharged(sc(), { power: 100, attackerX: MAP_RIGHT_BOUNDARY - 140 });
    assert.equal(edge.right.isCinematicKillVictim, true);
    assert.equal(edge.left.chargedConnectPoseHold, true);
    assert.equal(edge.left.isAttacking, true);
    assert.equal(edge.left.attackType, "charged");
    assert.equal(edge.left.isRecovering, false);
    assert.equal(edge.left.isChargedHitRecoil, false);

    // First tick after the cinematic freeze — same connect-hold release as a live hit.
    edge.room.hitstopUntil = 0;
    timeoutManager.processRoom(edge.room);

    assert.equal(edge.left.chargedConnectPoseHold, false);
    assert.equal(edge.left.isAttacking, false);
    assert.equal(edge.left.isRecovering, true);
    assert.equal(edge.left.recoveryDuration, CHARGED_HIT_RECOVERY_MS);
    assert.equal(edge.left.isChargedHitRecoil, false);
    assert.equal(chargedHitRecoilVelocity(edge.left), 0);
    assert.equal(edge.left.movementVelocity, 0);
  });
});
