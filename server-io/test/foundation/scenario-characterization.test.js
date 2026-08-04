"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  createFoundationScenario,
  advanceSim,
  stepPushbox,
  captureTrace,
  tracesEqual,
  runScript,
  armSlapPhase,
  armPalmPhase,
  armChargedPhase,
  armLowKickPhase,
  armGrabStartup,
  armGrabWhiff,
  armDodge,
  armSidestepPhase,
  resetRematch,
  freezeSimForHitstopCharacterization,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  GROUND_LEVEL,
} = require("./helpers/scenarioHarness");
const { getMinimumCenterDistance } = require("../../pushboxGeometry");
const { COMBAT_PHASE } = require("../../combatVolumeVocabulary");

const live = [];
afterEach(() => {
  while (live.length) live.pop().dispose();
});

function sc(opts) {
  const s = createFoundationScenario(opts);
  live.push(s);
  return s;
}

function runTwice(buildAndScript) {
  const s1 = sc();
  const t1 = buildAndScript(s1);
  const s2 = sc();
  const t2 = buildAndScript(s2);
  return { t1, t2 };
}

describe("Phase 1 — scenario characterization (live paths + diagnostic volumes)", () => {
  it("idle vs idle trace is deterministic across two runs", () => {
    const { t1, t2 } = runTwice((s) => {
      advanceSim(s, s.tickMs);
      stepPushbox(s, s.tickMs);
      return captureTrace(s, { comparable: true });
    });
    assert.equal(tracesEqual(t1, t2), true);
    assert.equal(t1.playersByRole[0].phase, COMBAT_PHASE.NEUTRAL);
  });

  it("movement into pushbox separates via real adjustPlayerPositions", () => {
    const s = sc({ gap: 40 }); // deep overlap for 0.85 sizes (min ~110.5)
    const minDist = getMinimumCenterDistance(
      s.left.sizeMultiplier,
      s.right.sizeMultiplier
    );
    assert.ok(Math.abs(s.left.x - s.right.x) < minDist);
    for (let i = 0; i < 40; i++) {
      stepPushbox(s, s.tickMs);
      advanceSim(s, s.tickMs);
    }
    const gap = Math.abs(s.left.x - s.right.x);
    assert.ok(gap + 0.5 >= minDist, `gap ${gap} should reach minDist ${minDist}`);
    const trace = captureTrace(s);
    assert.equal(trace.players.every((p) => p.phase === COMBAT_PHASE.NEUTRAL), true);
  });

  it("slap / palm / charged / low-kick / grab / dodge / sidestep phases characterize", () => {
    const s = sc({ gap: 180 });
    const now = s.room.simTime;
    const phases = [];

    const phaseOf = (fighter) =>
      captureTrace(s).players.find((p) => p.fighter === fighter).phase;

    armSlapPhase(s.left, "startup", now);
    phases.push(phaseOf("player 1"));
    armSlapPhase(s.left, "active", now);
    phases.push(phaseOf("player 1"));
    armSlapPhase(s.left, "recovery", now);
    phases.push(phaseOf("player 1"));

    armPalmPhase(s.right, "active", now);
    phases.push(phaseOf("player 2"));

    armChargedPhase(s.left, "hold", now);
    phases.push(phaseOf("player 1"));
    armChargedPhase(s.left, "lunge", now);
    phases.push(phaseOf("player 1"));

    armLowKickPhase(s.right, "active", now);
    phases.push(phaseOf("player 2"));

    armGrabStartup(s.left, now);
    phases.push(phaseOf("player 1"));
    armGrabWhiff(s.left, now);
    phases.push(phaseOf("player 1"));

    armDodge(s.right, now, 1);
    phases.push(phaseOf("player 2"));

    armSidestepPhase(s.left, "startup", now, -1);
    phases.push(phaseOf("player 1"));
    armSidestepPhase(s.left, "active", now, -1);
    phases.push(phaseOf("player 1"));
    armSidestepPhase(s.left, "recovery", now, -1);
    phases.push(phaseOf("player 1"));

    assert.deepEqual(phases.slice(0, 3), [
      COMBAT_PHASE.STARTUP,
      COMBAT_PHASE.ACTIVE,
      COMBAT_PHASE.RECOVERY,
    ]);
    assert.ok(phases.includes(COMBAT_PHASE.PASS_THROUGH) || phases.includes(COMBAT_PHASE.STARTUP));
    // Sidestep recovery
    assert.equal(phases[phases.length - 1], COMBAT_PHASE.RECOVERY);
  });

  it("cross-up and same-center fallback capture finite volumes", () => {
    const cross = sc({ gap: 120 });
    cross.left.facing = 1;
    cross.right.facing = -1;
    // Crossed facing vs position (both look away / crossed)
    const tCross = captureTrace(cross);
    assert.ok(tCross.players.every((p) => p.volumes.length >= 2));

    const same = sc({ gap: 0 });
    same.left.x = same.right.x = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    stepPushbox(same, same.tickMs);
    const tSame = captureTrace(same);
    assert.ok(
      tSame.players.every((p) =>
        p.volumes.every((v) => Number.isFinite(v.left) && Number.isFinite(v.right))
      )
    );
  });

  it("both ring boundaries clamp positions used by volume roots", () => {
    const leftEdge = sc({
      leftX: MAP_LEFT_BOUNDARY,
      rightX: MAP_LEFT_BOUNDARY + 120,
      gap: 120,
    });
    const rightEdge = sc({
      leftX: MAP_RIGHT_BOUNDARY - 120,
      rightX: MAP_RIGHT_BOUNDARY,
      gap: 120,
    });
    assert.equal(
      captureTrace(leftEdge).players.find((p) => p.fighter === "player 1").x,
      MAP_LEFT_BOUNDARY
    );
    assert.equal(
      captureTrace(rightEdge).players.find((p) => p.fighter === "player 2").x,
      MAP_RIGHT_BOUNDARY
    );
  });

  it("size multiplier combinations remain deterministic", () => {
    const a = sc();
    a.left.sizeMultiplier = 0.7;
    a.right.sizeMultiplier = 1.35;
    const b = sc();
    b.left.sizeMultiplier = 0.7;
    b.right.sizeMultiplier = 1.35;
    assert.equal(
      tracesEqual(
        captureTrace(a, { comparable: true }),
        captureTrace(b, { comparable: true })
      ),
      true
    );
  });

  it("hitstop characterization freezes simTime (no wall-clock dependency)", () => {
    const s = sc();
    const t0 = s.room.simTime;
    freezeSimForHitstopCharacterization(s.room, true);
    advanceSim(s, 100);
    assert.equal(s.room.simTime, t0);
    freezeSimForHitstopCharacterization(s.room, false);
    advanceSim(s, 100);
    assert.equal(s.room.simTime, t0 + 100);
    const trace = captureTrace(s);
    assert.equal(trace.hitstopFreeze, false);
  });

  it("reset/rematch clears action flags and diagnostic limb fixture identity", () => {
    const s = sc();
    const now = s.room.simTime;
    armSlapPhase(s.left, "recovery", now);
    s.left._phase1SlapRecoveryLimb = true;
    armSidestepPhase(s.right, "active", now, 1);
    resetRematch(s);
    assert.equal(s.left.isAttacking, false);
    assert.equal(s.left._phase1SlapRecoveryLimb, false);
    assert.equal(s.right.isSidestepping, false);
    assert.equal(s.left.y, GROUND_LEVEL);
    const trace = captureTrace(s);
    assert.equal(
      trace.players.every((p) => p.phase === COMBAT_PHASE.NEUTRAL),
      true
    );
    assert.equal(
      trace.players.every(
        (p) => !p.volumes.some((v) => v.kind === "HURT_LIMB" || v.kind === "HIT")
      ),
      true
    );
  });

  it("player-array order does not change playersByRole geometry trace", () => {
    const a = sc({ gap: 150 });
    const b = sc({
      gap: 150,
      swapPlayerOrder: true,
    });
    // Align state
    b.left.x = a.left.x;
    b.right.x = a.right.x;
    b.left.facing = a.left.facing;
    b.right.facing = a.right.facing;
    armSlapPhase(a.left, "active", a.room.simTime);
    armSlapPhase(b.left, "active", b.room.simTime);
    const ta = captureTrace(a, { comparable: true });
    const tb = captureTrace(b, { comparable: true });
    assert.equal(
      JSON.stringify(ta.playersByRole),
      JSON.stringify(tb.playersByRole)
    );
  });

  it("runScript helper produces identical captures for a fixed script", () => {
    const s1 = sc();
    const s2 = sc();
    const script = (scenario, api) => {
      armSlapPhase(scenario.left, "active", scenario.room.simTime);
      api.tick(2);
      return captureTrace(scenario, { comparable: true });
    };
    const t1 = runScript(s1, script);
    const t2 = runScript(s2, script);
    assert.equal(tracesEqual(t1, t2), true);
  });
});
