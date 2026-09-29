"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyTachiaiCall,
  tachiaiDodgeHopY,
  tachiaiDodgeClearsSlap,
  pickCpuTachiaiCall,
  cpuTachiaiWeights,
  tachiaiCaption,
  noteTachiaiContact,
  isTachiaiLive,
  endTachiaiAction,
  TACHIAI_CALL,
  TACHIAI_DODGE_HOP_HEIGHT,
  TACHIAI_DODGE_HOP_MS,
  TACHIAI_DODGE_SLAP_CLEAR_PX,
  TACHIAI_SIDESTEP_TRAVEL,
  sealTachiai,
} = require("../../tachiai");
const {
  SLAP_STEP_IN_DISTANCE,
  SLAP_APPROACH_WINDOW_MS,
  SLAP_APPROACH_VELOCITY,
  SLAP_COAST_VELOCITY,
  approachTravelPx,
  armStandingSlapStep,
  settleSlapApproach,
} = require("../../slapStepIn");
const { executeSlapAttack } = require("../../gameFunctions");
const { commitTachiai } = require("../../tachiaiResolve");
const { updateCommandGrab } = require("../../commandGrabSystem");
const { beginChargeHold } = require("../../gameUtils");
const {
  createFoundationScenario,
  advanceSim,
  stepCollisionBothOrders,
} = require("../foundation/helpers/scenarioHarness");
const { SLAP_STARTUP_MS, ICE_COAST_FRICTION, speedFactor, TICK_RATE } = require("../../constants");
const { getConnectDistance } = require("../../strikeContact");

describe("tachiai call", () => {
  it("a released tap still counts, and a chord still held wins", () => {
    const scenario = createFoundationScenario({ gap: 192 });
    try {
      scenario.left.tachiaiHeld = {};
      scenario.left.tachiaiBufferedCall = "charge";
      scenario.right.tachiaiHeld = { mouse1: true };
      sealTachiai(scenario.room);
      assert.equal(scenario.left.tachiaiCall, "charge");
      assert.equal(scenario.right.tachiaiCall, "slap");
    } finally {
      scenario.dispose();
    }
  });

  it("the opening closes when that move ends, so a later hit cannot darken", () => {
    const player = {
      tachiaiCall: "slap",
      tachiaiActionPending: true,
      tachiaiUntil: 9000,
    };
    assert.equal(isTachiaiLive(player, 1000), true);
    endTachiaiAction(player, "slap");
    assert.equal(isTachiaiLive(player, 1000), false);
    assert.equal(endTachiaiAction(player, "charge"), false);
  });

  it("classifies the opening chords from positions, not a stored facing", () => {
    const left = 543;
    const right = 735;
    assert.equal(classifyTachiaiCall({ mouse1: true }, left, right), "slap");
    assert.equal(
      classifyTachiaiCall({ mouse1: true, s: true, d: true }, left, right),
      "charge"
    );
    assert.equal(
      classifyTachiaiCall({ mouse1: true, a: true }, left, right),
      "palm"
    );
    assert.equal(classifyTachiaiCall({ mouse2: true }, left, right), "grab");
    assert.equal(classifyTachiaiCall({ shift: true, s: true }, left, right), "henka");
    assert.equal(classifyTachiaiCall({ shift: true, d: true }, left, right), "dodgeIn");
    assert.equal(classifyTachiaiCall({ shift: true, a: true }, left, right), "dodgeBack");
    assert.equal(classifyTachiaiCall({ " ": true }, left, right), "parry");
    assert.equal(classifyTachiaiCall({ " ": true, a: true }, left, right), "matador");
    assert.equal(classifyTachiaiCall({}, left, right), "stand");
    assert.equal(
      classifyTachiaiCall({ mouse1: true, s: true, a: true }, right, left),
      "charge"
    );
  });

  it("gives a charge-happy opponent more henka, and a henka more grab", () => {
    const plain = cpuTachiaiWeights("aggressive", null);
    const vsCharge = cpuTachiaiWeights("aggressive", "charge");
    const vsHenka = cpuTachiaiWeights("balanced", "henka");
    assert.ok(vsCharge.henka > plain.henka);
    assert.ok(vsHenka.grab > cpuTachiaiWeights("balanced", null).grab);
    assert.equal(pickCpuTachiaiCall("aggressive", null, () => 0), "charge");
  });

  it("captions a real collision and stays quiet when both stand", () => {
    assert.equal(tachiaiCaption("stand", "stand"), null);
    assert.equal(tachiaiCaption("charge", "henka"), "CHARGE  HENKA");
  });

  it("the opening hop is above a slap before the arm is active", () => {
    const ageWhenSlapGoesActive = SLAP_STARTUP_MS - 50;
    const y = tachiaiDodgeHopY(Math.max(ageWhenSlapGoesActive, 1));
    assert.ok(
      y >= TACHIAI_DODGE_SLAP_CLEAR_PX,
      `hop ${y.toFixed(1)}px at slap-active should clear ${TACHIAI_DODGE_SLAP_CLEAR_PX}`
    );
    assert.equal(TACHIAI_DODGE_HOP_HEIGHT > 16, true);
    assert.ok(TACHIAI_SIDESTEP_TRAVEL > 192);
  });
});

describe("standing slap step", () => {
  it("reaches across the ready gap during the arm, then keeps a coast", () => {
    assert.ok(
      approachTravelPx(SLAP_APPROACH_VELOCITY, SLAP_APPROACH_WINDOW_MS) >= SLAP_STEP_IN_DISTANCE
    );
    const player = {
      movementVelocity: 0,
      currentSlapHitConnected: false,
      grantedVelocity: 0,
      grantedVelocityAt: 0,
    };
    assert.equal(armStandingSlapStep(player, 1, 0, 1000), true);
    settleSlapApproach(player, 1000 + SLAP_APPROACH_WINDOW_MS);
    assert.equal(player.movementVelocity, SLAP_COAST_VELOCITY);
    assert.equal(armStandingSlapStep(player, 1, player.movementVelocity, 2000), true);
    assert.equal(player.movementVelocity, SLAP_APPROACH_VELOCITY);
  });

  it("does not brake a slide that is already faster than the reach push", () => {
    const player = { movementVelocity: SLAP_APPROACH_VELOCITY + 1, currentSlapHitConnected: false };
    assert.equal(armStandingSlapStep(player, 1, SLAP_APPROACH_VELOCITY + 1, 1000), false);
    assert.equal(player.slapStepFixed, false);
    assert.equal(player.movementVelocity, SLAP_APPROACH_VELOCITY + 1);
  });

  it("a standing slap from the ready gap connects", () => {
    const scenario = createFoundationScenario({ gap: 192 });
    try {
      executeSlapAttack(scenario.left, scenario.rooms);
      assert.equal(scenario.left.slapApproachArmed, true);
      const connect = getConnectDistance("slap", scenario.left, scenario.right);
      const tick = 1000 / TICK_RATE;
      let hit = false;
      for (let i = 0; i < 20 && !hit; i++) {
        stepCollisionBothOrders(scenario);
        hit = !!scenario.left.currentSlapHitConnected;
        settleSlapApproach(scenario.left, scenario.room.simTime);
        scenario.left.movementVelocity *= ICE_COAST_FRICTION;
        scenario.left.x += tick * speedFactor * scenario.left.movementVelocity;
        advanceSim(scenario, tick);
      }
      assert.equal(hit, true, `gap left ${Math.abs(scenario.left.x - scenario.right.x).toFixed(1)} connect ${connect.toFixed(1)}`);
      assert.ok(Math.abs(scenario.left.movementVelocity) > 0);
    } finally {
      scenario.dispose();
    }
  });
});

describe("tachiai execution", () => {
  afterEach(() => {});

  it("starts a sealed slap and announces it", () => {
    const scenario = createFoundationScenario({ gap: 192 });
    try {
      scenario.left.tachiaiHeld = { mouse1: true };
      scenario.right.tachiaiHeld = {};
      sealTachiai(scenario.room);
      const caption = commitTachiai(scenario.room, scenario.rooms, scenario.io);
      assert.equal(scenario.left.isSlapAttack, true);
      assert.equal(scenario.right.isAttacking, false);
      assert.equal(caption, null);
      assert.equal(scenario.io.find("tachiai_resolve").length, 0);
      noteTachiaiContact(scenario.room, scenario.io, "HATAKIKOMI");
      assert.equal(scenario.io.find("tachiai_resolve").length, 1);
      noteTachiaiContact(scenario.room, scenario.io, "HATAKIKOMI");
      assert.equal(scenario.io.find("tachiai_resolve").length, 1);
    } finally {
      scenario.dispose();
    }
  });

  it("a grab call against a sidestep connects straight into a drive toward the rope", () => {
    const scenario = createFoundationScenario({ gap: 192 });
    try {
      scenario.room.tachiaiSealed = true;
      scenario.left.tachiaiCall = TACHIAI_CALL.GRAB;
      scenario.right.tachiaiCall = TACHIAI_CALL.HENKA;
      commitTachiai(scenario.room, scenario.rooms, scenario.io);
      updateCommandGrab(scenario.left, scenario.room, scenario.io, scenario.tickMs, scenario.rooms);
      assert.equal(scenario.left.cmdGrabPhase, "carry");
      assert.equal(scenario.left.cmdGrabVariant, "drive");
      assert.equal(scenario.right.tachiaiRopeAfterDrive, true);
      const towardRight = scenario.left.x < scenario.right.x;
      const rope = towardRight ? 935 : 340;
      const target = scenario.left.cmdGrabCarryTargetX;
      assert.ok(Math.abs(target - rope) < 160, `drive target ${target} should aim at rope ${rope}`);
    } finally {
      scenario.dispose();
    }
  });

  it("a sidestep call starts clear of startup, and a charge launches at full power without the hop-back", () => {
    const scenario = createFoundationScenario({ gap: 192 });
    try {
      scenario.room.tachiaiSealed = true;
      scenario.left.tachiaiCall = "henka";
      scenario.right.tachiaiCall = "charge";
      commitTachiai(scenario.room, scenario.rooms, scenario.io);
      assert.equal(scenario.left.isSidestepping, true);
      assert.equal(scenario.left.sidestepStartupEndTime, scenario.left.sidestepStartTime);
      assert.equal(scenario.right.attackType, "charged");
      assert.equal(scenario.right.chargeAttackPower, 100);
      assert.equal(scenario.right.isChargeHopping, false);
      assert.equal(scenario.right.isPalmThrust, false);
    } finally {
      scenario.dispose();
    }
  });

  it("a charge buffered across the shout does not hop back", () => {
    const scenario = createFoundationScenario({ gap: 192 });
    try {
      const now = scenario.room.simTime;
      scenario.left.tachiaiInputGraceUntil = now + 500;
      scenario.left.tachiaiLaunched = true;
      assert.equal(beginChargeHold(scenario.left, scenario.rooms), false);
      assert.equal(scenario.left.isChargeHopping, false);

      scenario.left.tachiaiLaunched = false;
      assert.equal(beginChargeHold(scenario.left, scenario.rooms), true);
      assert.equal(scenario.left.isChargeHopping, false);
      assert.equal(scenario.left.attackType, "charged");
      assert.equal(scenario.left.chargeAttackPower, 100);
    } finally {
      scenario.dispose();
    }
  });

  it("the opening hop reports a slap clear once it is up", () => {
    const now = 5000;
    const player = {
      isDodging: true,
      isDodgeStartup: false,
      tachiaiCall: "dodgeIn",
      tachiaiActionPending: true,
      tachiaiUntil: now + 800,
      dodgeStartupEndTime: now - 20,
      tachiaiDodgeHopHeight: TACHIAI_DODGE_HOP_HEIGHT,
      tachiaiDodgeHopMs: TACHIAI_DODGE_HOP_MS,
    };
    assert.equal(tachiaiDodgeClearsSlap(player, now), true);
    player.tachiaiCall = "stand";
    assert.equal(tachiaiDodgeClearsSlap(player, now), false);
  });
});
