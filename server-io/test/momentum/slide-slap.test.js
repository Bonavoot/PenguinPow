"use strict";

/**
 * Ice-slide slap convert: arming, dump-skid on hit (no chase), louder send.
 * Pocket mash must stay the glued +0 string.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const M = require("../../momentumTransfer");
const {
  executeSlapAttack,
  queueDodgeHopSlideSlap,
  releaseQueuedSlideSlap,
} = require("../../gameFunctions");
const { beginPlayerDodge } = require("../../gameUtils");
const {
  createFoundationScenario,
  advanceSim,
} = require("../foundation/helpers/scenarioHarness");
const {
  createContactScenario,
  armSlap,
  placeInConnectRange,
  runBothCollisionOrders,
  SLAP_ACTIVE_TEST_OFFSET,
} = require("../contact/helpers/contactSim");
const {
  setCombatContactFidelityV2ForTests,
} = require("../../combatContactFidelityFlags");
const {
  SLAP_TOTAL_MS,
  SLAP_TOTAL_MS_SLIDE,
  SLIDE_SLAP_CHARGE_FULL_MS,
  SLIDE_SLAP_EXTRA_RECOVERY_MS,
  SLIDE_SLAP_ADVANTAGE_MS,
  SLIDE_SLAP_HITSTOP_FLOOR_MS,
  SLIDE_SLAP_HITSTOP_CAP_MS,
  SLIDE_SLAP_FOLLOW_VEL,
  SLIDE_SLAP_FOLLOW_VEL_MAX,
  SLIDE_SLAP_FOLLOW_FRICTION,
  DELTA_TRACKED_PROPS,
  TICK_RATE,
} = require("../../constants");

const TICK_MS = 1000 / TICK_RATE;

const scenarios = [];
afterEach(() => {
  setCombatContactFidelityV2ForTests(null);
  while (scenarios.length) scenarios.pop().dispose();
});

function foundation(opts) {
  const s = createFoundationScenario(opts);
  scenarios.push(s);
  return s;
}

function contact(opts) {
  setCombatContactFidelityV2ForTests(true);
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

describe("slide-slap convert — profiles", () => {
  it("sits between a pocket slap and a palm, and can out-send palm at the top", () => {
    const slap = M.profileFor("slap");
    const slide = M.profileFor("slideSlap");
    const palm = M.profileFor("palm");
    assert.ok(slide.floor > slap.floor, "min armed send must beat a standing slap");
    assert.ok(slide.ceil > palm.ceil, "full slide must be allowed to out-send palm");
    assert.ok(slide.floor >= palm.floor, "even a just-armed convert is a real shove");
    assert.ok(
      M.impactWeightFor("slideSlap") > M.impactWeightFor("slap"),
      "convert freeze must out-weigh a flurry tick"
    );
    assert.ok(
      M.impactWeightFor("slideSlap") < M.impactWeightFor("palm"),
      "convert must not steal palm's freeze identity"
    );
  });

  it("ships the arm flag on the fighter delta wire", () => {
    assert.ok(DELTA_TRACKED_PROPS.includes("slideSlapArmed"));
  });

  it("extra recovery is only a tail — startup+active stay slap-identical", () => {
    assert.equal(SLAP_TOTAL_MS_SLIDE, SLAP_TOTAL_MS + SLIDE_SLAP_EXTRA_RECOVERY_MS);
    assert.ok(SLIDE_SLAP_CHARGE_FULL_MS > 200 && SLIDE_SLAP_CHARGE_FULL_MS < 700);
    assert.ok(
      SLIDE_SLAP_EXTRA_RECOVERY_MS < SLAP_TOTAL_MS,
      "plant tail must stay shorter than a full pocket cycle"
    );
    assert.ok(
      SLIDE_SLAP_ADVANTAGE_MS < 80,
      "plus frames are a gap closer, not a freeze"
    );
  });

  it("follow-through is a fixed crawl, not a dump-skid", () => {
    assert.ok(SLIDE_SLAP_FOLLOW_VEL < 1.3, "must stay under a walk so it reads as a drift");
    assert.ok(SLIDE_SLAP_FOLLOW_VEL_MAX < 1.3, "full-charge drive must stay under a walk");
    assert.ok(SLIDE_SLAP_FOLLOW_VEL_MAX > SLIDE_SLAP_FOLLOW_VEL);
    assert.equal(SLIDE_SLAP_FOLLOW_FRICTION, 1, "no decay — decay was the chop");
  });

  it("floors and caps convert hitstop so the pause is a punch, not a poke or a cutscene", () => {
    const hs = M.hitstopMsFor(3.6, M.impactWeightFor("slideSlap"), 1, M.hitstopPowerWeightFor("slideSlap"));
    assert.ok(hs > SLIDE_SLAP_HITSTOP_CAP_MS, "uncapped freeze would overshoot");
    const fake = {
      movementVelocity: 2.4,
      facing: 1,
      slapEntryAligned: 2.4,
    };
    const victim = { x: 400, movementVelocity: 0, keys: {} };
    const resolved = M.resolveTransfer({
      attacker: fake,
      victim,
      moveKey: "slideSlap",
      dirToVictim: 1,
      nowSim: 1000,
      selfOverride: 2.4,
    });
    assert.ok(resolved.hitstopMs <= SLIDE_SLAP_HITSTOP_CAP_MS);
    assert.ok(resolved.hitstopMs >= SLIDE_SLAP_HITSTOP_FLOOR_MS);

    const glancing = M.resolveTransfer({
      attacker: {
        movementVelocity: 1.45,
        facing: 1,
        slapEntryAligned: 1.45,
      },
      victim: { x: 400, movementVelocity: 1.4, keys: {} },
      moveKey: "slideSlap",
      dirToVictim: 1,
      nowSim: 1000,
      selfOverride: 1.45,
    });
    assert.ok(
      glancing.hitstopMs >= SLIDE_SLAP_HITSTOP_FLOOR_MS,
      "low closing-speed convert must still freeze like a body check"
    );
    assert.ok(glancing.hitstopMs <= SLIDE_SLAP_HITSTOP_CAP_MS);
  });
});

describe("slide-slap convert — arming", () => {
  it("arms on ice slide + earned speed, and uses the longer cycle", () => {
    const s = foundation();
    s.left.isIceSliding = true;
    s.left.movementVelocity = 2.4;
    executeSlapAttack(s.left, s.rooms);
    assert.equal(s.left.slideSlapArmed, true);
    assert.equal(
      s.left.attackCooldownUntil - s.room.simTime,
      SLAP_TOTAL_MS_SLIDE
    );
  });

  it("does not arm a walk-up slap", () => {
    const s = foundation();
    s.left.isIceSliding = false;
    s.left.movementVelocity = 1.3;
    executeSlapAttack(s.left, s.rooms);
    assert.equal(s.left.slideSlapArmed, false);
    assert.equal(
      s.left.attackCooldownUntil - s.room.simTime,
      SLAP_TOTAL_MS
    );
  });

  it("arms a planted ice slide instead of falling through to a slap", () => {
    const s = foundation();
    s.left.isIceSliding = true;
    s.left.movementVelocity = 0.25;
    s.left.iceSlideMovingMs = 0;
    executeSlapAttack(s.left, s.rooms);
    assert.equal(s.left.slideSlapArmed, true);
    assert.equal(
      s.left.attackCooldownUntil - s.room.simTime,
      SLAP_TOTAL_MS_SLIDE
    );
    assert.equal(s.left.slideSlapCharge, 0);
  });

  it("a mouse1 during the dodge hop does not cancel the hop", () => {
    const s = foundation();
    const now = s.room.simTime;
    beginPlayerDodge(s.left, { nowSim: now, direction: 1 });
    s.left.y += 14;
    const hopY = s.left.y;
    executeSlapAttack(s.left, s.rooms);
    assert.equal(s.left.isDodging, true);
    assert.equal(s.left.y, hopY);
    assert.equal(s.left.isSlapAttack, false);
    assert.equal(s.left.pendingSlideSlap, true);
  });

  it("a hop-queued press releases as a belly bump after the hop lands", () => {
    const s = foundation();
    const now = s.room.simTime;
    beginPlayerDodge(s.left, { nowSim: now, direction: 1 });
    s.left.y += 14;
    queueDodgeHopSlideSlap(s.left, now + 20);
    s.left.isDodging = false;
    s.left.isDodgeStartup = false;
    s.left.isIceSliding = true;
    s.left.iceSlideMovingMs = 0;
    s.left.actionLockUntil = now + 100;
    const released = releaseQueuedSlideSlap(s.left, s.rooms, now + 110);
    assert.equal(released, true);
    assert.equal(s.left.isDodging, false);
    assert.equal(s.left.slideSlapArmed, true);
    assert.equal(s.left.isSlapAttack, true);
    assert.equal(s.left.slideSlapCharge, 0);
  });

  it("slide time raises send and follow without dropping the short bump", () => {
    const shortCharge = M.slideSlapChargeFromMovingMs(0);
    const longCharge = M.slideSlapChargeFromMovingMs(SLIDE_SLAP_CHARGE_FULL_MS);
    const shortV = M.slideSlapVSelfForCharge(shortCharge);
    const longV = M.slideSlapVSelfForCharge(longCharge);
    assert.equal(shortCharge, 0);
    assert.equal(longCharge, 1);
    assert.ok(shortV > 1.6, "shortest bump must already be a real shove");
    assert.ok(longV > shortV);
    const victim = { x: 400, movementVelocity: 0, keys: {} };
    const attacker = { movementVelocity: 0, facing: 1, slapEntryAligned: 0 };
    const short = M.resolveTransfer({
      attacker,
      victim,
      moveKey: "slideSlap",
      dirToVictim: 1,
      nowSim: 1000,
      selfOverride: shortV,
      slideSlapCharge: shortCharge,
    });
    const long = M.resolveTransfer({
      attacker,
      victim,
      moveKey: "slideSlap",
      dirToVictim: 1,
      nowSim: 1000,
      selfOverride: longV,
      slideSlapCharge: longCharge,
    });
    assert.ok(long.sendPx > short.sendPx);
    assert.ok(short.sendPx > M.profileFor("slap").floor + 80);
    assert.ok(long.hitstopMs >= short.hitstopMs);
    assert.ok(long.hitstopMs <= SLIDE_SLAP_HITSTOP_CAP_MS);
    assert.ok(M.slideSlapFollowVelForCharge(1) > M.slideSlapFollowVelForCharge(0));
    assert.ok(M.slideSlapFollowVelForCharge(1) < 1.3);
  });

  it("a follow-up swing after the convert is a normal slap", () => {
    const s = foundation();
    s.left.isIceSliding = true;
    s.left.movementVelocity = 2.4;
    executeSlapAttack(s.left, s.rooms);
    assert.equal(s.left.slideSlapArmed, true);

    // Cycle end re-enters executeSlapAttack. Ice slide is already over
    // (isAttacking cleared it in the live tick; we drop it here).
    s.left.isSlapAttack = false;
    s.left.isAttacking = false;
    s.left.isIceSliding = false;
    s.left.movementVelocity = 0;
    executeSlapAttack(s.left, s.rooms);
    assert.equal(s.left.slideSlapArmed, false);
  });
});

describe("slide-slap convert — dodge buffer", () => {
  function runPastConvert(s) {
    const until = SLAP_TOTAL_MS_SLIDE + 4 * TICK_MS;
    for (let elapsed = 0; elapsed < until; elapsed += TICK_MS) {
      advanceSim(s, TICK_MS);
    }
  }

  it("a Shift tap during the plant dodges on the first free frame", () => {
    const s = foundation();
    s.left.isIceSliding = true;
    s.left.movementVelocity = 2.4;
    executeSlapAttack(s.left, s.rooms);
    s.left.currentSlapHitConnected = true;
    s.left.pendingSlapCount = 1;
    s.left.bufferedAction = { type: "dash", direction: 1 };
    s.left.bufferExpiryTime = s.room.simTime + 500;

    runPastConvert(s);

    assert.equal(s.left.isDodging, true, "buffered dodge must fire at plant end");
    assert.equal(s.left.pendingSlapCount, 0, "dodge must beat a mashed slap");
    assert.equal(s.left.isAttacking, false);
  });

  it("held Shift from the ice slide does not auto-dodge", () => {
    const s = foundation();
    s.left.isIceSliding = true;
    s.left.movementVelocity = 2.4;
    s.left.keys.shift = true;
    executeSlapAttack(s.left, s.rooms);
    s.left.currentSlapHitConnected = true;
    s.left.bufferedAction = null;

    runPastConvert(s);

    assert.equal(
      s.left.isDodging,
      false,
      "sprint hold must not become a hop"
    );
  });
});

describe("slide-slap convert — on hit", () => {
  it("crawls the attacker forward and sends farther than a pocket slap", () => {
    const pocket = contact({ gap: 110 });
    const nowP = pocket.room.simTime;
    armSlap(pocket.left, { now: nowP });
    pocket.left.attackCooldownUntil = pocket.left.attackStartTime + SLAP_TOTAL_MS;
    pocket.left.slideSlapArmed = false;
    pocket.left.slapEntryAligned = 0;
    placeInConnectRange(pocket.left, pocket.right, "slap");
    runBothCollisionOrders(pocket.left, pocket.right, pocket.rooms, pocket.io);
    assert.equal(pocket.right.isHit, true, "pocket slap must connect");
    const pocketChase = Math.abs(pocket.left.movementVelocity || 0);
    const pocketSend = Math.abs(pocket.right.knockbackVelocity?.x || 0);
    assert.ok(pocketChase > 0.5, "pocket mash must chase");
    assert.equal(pocket.left.isSlapSliding, true);

    const slide = contact({ gap: 110 });
    const nowS = slide.room.simTime;
    armSlap(slide.left, { now: nowS });
    slide.left.attackCooldownUntil = slide.left.attackStartTime + SLAP_TOTAL_MS_SLIDE;
    slide.left.slideSlapArmed = true;
    slide.left.slapEntryAligned = 2.4;
    slide.left.movementVelocity = 2.4;
    placeInConnectRange(slide.left, slide.right, "slap");
    runBothCollisionOrders(slide.left, slide.right, slide.rooms, slide.io);
    assert.equal(slide.right.isHit, true, "slide slap must connect");
    const follow = Math.abs(slide.left.movementVelocity || 0);
    assert.ok(
      Math.abs(follow - SLIDE_SLAP_FOLLOW_VEL) < 0.05,
      `convert must crawl at the fixed follow, got ${follow.toFixed(2)}`
    );
    assert.equal(slide.left.isSlapSliding, true, "drift is committed, not brakeable");
    assert.ok(
      Math.abs(slide.left.grantedVelocity || 0) >= SLIDE_SLAP_FOLLOW_VEL - 0.05,
      "follow-through must be granted so it cannot power the next slap"
    );
    const slideSend = Math.abs(slide.right.knockbackVelocity?.x || 0);
    assert.ok(
      slideSend > pocketSend,
      `convert send ${slideSend.toFixed(2)} must beat pocket ${pocketSend.toFixed(2)}`
    );

    const hits = slide.io.find("player_hit");
    assert.ok(hits.length >= 1);
    assert.equal(hits[0].payload.slideSlap, true);

    // Convert is +X: victim stays locked after the attacker is free.
    const victimLock = slide.right.inputLockUntil - nowS;
    const remainingConvert = SLAP_TOTAL_MS_SLIDE - SLAP_ACTIVE_TEST_OFFSET;
    assert.ok(
      Math.abs(victimLock - (remainingConvert + SLIDE_SLAP_ADVANTAGE_MS)) <= 5,
      `victim stun ${victimLock}ms must be convert remaining + ${SLIDE_SLAP_ADVANTAGE_MS}ms advantage`
    );
    assert.ok(
      victimLock > remainingConvert,
      "opponent must not be free before the attacker"
    );
  });
});
