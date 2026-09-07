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
  DELTA_TRACKED_PROPS,
  ALL_TRACKED_PROPS,
} = require("../../constants");
const { MAP_RIGHT_BOUNDARY } = require("../../gameUtils");
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

function expectedLiveChargedVel(chargePct) {
  const chargeFraction = Math.max(0, Math.min(chargePct / 100, 1));
  const vSelf = MomentumTransfer.V_REF * chargeFraction;
  const profile = MomentumTransfer.MOVE_TRANSFER.charged;
  const sendPx = Math.min(
    MomentumTransfer.transfer(vSelf, profile.floor, profile.ceil, 1),
    MomentumTransfer.MAX_SEND_PX
  );
  return MomentumTransfer.pxToKbVelocity(sendPx);
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
    const expectedRocket = applyCinematicKillSpeed(expectedLive);

    assert.ok(
      Math.abs(liveVel - expectedLive) < 0.08,
      `midscreen stays on the live send (${liveVel.toFixed(2)} vs ${expectedLive.toFixed(2)})`
    );
    assert.ok(
      Math.abs(cinematicVel - expectedRocket) < 0.08,
      `cinematic is the boosted send (${cinematicVel.toFixed(2)} vs ${expectedRocket.toFixed(2)})`
    );
    assert.ok(
      cinematicVel > liveVel * 3,
      `rocket must beat the live crawl (${cinematicVel.toFixed(2)} vs ${liveVel.toFixed(2)})`
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
});
