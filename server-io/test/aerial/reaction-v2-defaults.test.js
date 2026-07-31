"use strict";

/**
 * Offensive Aerial Reaction V2 finalization — default-on + legacy rollback.
 * Subprocess isolation so env cases cannot contaminate module cache.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  parseOffensiveAerialReactionV2Flag,
  OFFENSIVE_AERIAL_REACTION_V2,
  OFFENSIVE_AERIAL_REACTION_PRESET,
  setOffensiveAerialReactionV2ForTests,
  setOffensiveAerialReactionPresetForTests,
} = require("../../offensiveAerialFlags");
const {
  REACTION_PRESETS,
  getReactionPreset,
} = require("../../offensiveAerialReaction");
const { FLAP_FASTFALL_GRAVITY } = require("../../constants");
const { GROUND_LEVEL } = require("../../constants");
const {
  setSimRoomResolver,
  timeoutManager,
} = require("../../gameUtils");
const { OFFENSIVE_AERIAL_OUTCOME } = require("../../offensiveAerialOutcome");
const {
  createSlideJumpScenario,
  placeDescendingOverOpponent,
  stepSlideJumpTick,
  armDefenderParry,
} = require("./helpers/slideJumpSim");

const SERVER_IO = path.resolve(__dirname, "../..");

afterEach(() => {
  timeoutManager.clearAll();
  setSimRoomResolver(() => null);
  setOffensiveAerialReactionV2ForTests(null);
  setOffensiveAerialReactionPresetForTests(null);
});

function loadFlagsInSubprocess(extraEnv) {
  const env = { ...process.env };
  delete env.OFFENSIVE_AERIAL_REACTION_V2;
  delete env.OFFENSIVE_AERIAL_REACTION_PRESET;
  for (const [k, v] of Object.entries(extraEnv || {})) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  const script = `
    const f = require(${JSON.stringify(path.join(SERVER_IO, "offensiveAerialFlags.js"))});
    const r = require(${JSON.stringify(path.join(SERVER_IO, "offensiveAerialReaction.js"))});
    console.log(JSON.stringify({
      v2: f.OFFENSIVE_AERIAL_REACTION_V2,
      preset: f.OFFENSIVE_AERIAL_REACTION_PRESET,
      heavy: r.REACTION_PRESETS.heavy_short,
    }));
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    env,
    encoding: "utf8",
    cwd: SERVER_IO,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const line = (result.stdout || "").trim().split("\n").filter(Boolean).pop();
  return JSON.parse(line);
}

describe("offensive aerial reaction V2 finalization — env parsing", () => {
  it("parseOffensiveAerialReactionV2Flag: unset/1/true → on; 0/false → off", () => {
    assert.equal(parseOffensiveAerialReactionV2Flag(undefined), true);
    assert.equal(parseOffensiveAerialReactionV2Flag(null), true);
    assert.equal(parseOffensiveAerialReactionV2Flag(""), true);
    assert.equal(parseOffensiveAerialReactionV2Flag("1"), true);
    assert.equal(parseOffensiveAerialReactionV2Flag("true"), true);
    assert.equal(parseOffensiveAerialReactionV2Flag("TRUE"), true);
    assert.equal(parseOffensiveAerialReactionV2Flag("0"), false);
    assert.equal(parseOffensiveAerialReactionV2Flag("false"), false);
    assert.equal(parseOffensiveAerialReactionV2Flag("FALSE"), false);
  });

  it("subprocess: unset → V2 on + heavy_short", () => {
    const r = loadFlagsInSubprocess({});
    assert.equal(r.v2, true);
    assert.equal(r.preset, "heavy_short");
  });

  it("subprocess: OFFENSIVE_AERIAL_REACTION_V2=1 → V2 on", () => {
    assert.equal(
      loadFlagsInSubprocess({ OFFENSIVE_AERIAL_REACTION_V2: "1" }).v2,
      true
    );
  });

  it("subprocess: OFFENSIVE_AERIAL_REACTION_V2=true → V2 on", () => {
    assert.equal(
      loadFlagsInSubprocess({ OFFENSIVE_AERIAL_REACTION_V2: "true" }).v2,
      true
    );
  });

  it("subprocess: OFFENSIVE_AERIAL_REACTION_V2=0 → legacy off", () => {
    assert.equal(
      loadFlagsInSubprocess({ OFFENSIVE_AERIAL_REACTION_V2: "0" }).v2,
      false
    );
  });

  it("subprocess: OFFENSIVE_AERIAL_REACTION_V2=false → legacy off", () => {
    assert.equal(
      loadFlagsInSubprocess({ OFFENSIVE_AERIAL_REACTION_V2: "false" }).v2,
      false
    );
  });

  it("subprocess: unset preset → heavy_short", () => {
    assert.equal(loadFlagsInSubprocess({}).preset, "heavy_short");
  });
});

describe("offensive aerial reaction V2 finalization — approved heavy_short", () => {
  it("current process defaults match approved candidate when env unset", () => {
    if (!process.env.OFFENSIVE_AERIAL_REACTION_V2) {
      assert.equal(OFFENSIVE_AERIAL_REACTION_V2, true);
    }
    if (!process.env.OFFENSIVE_AERIAL_REACTION_PRESET) {
      assert.equal(OFFENSIVE_AERIAL_REACTION_PRESET, "heavy_short");
    }
    assert.equal(getReactionPreset().id, "heavy_short");
  });

  it("approved heavy_short values remain unchanged", () => {
    const p = REACTION_PRESETS.heavy_short;
    assert.equal(p.id, "heavy_short");
    assert.equal(p.lateralRecoilVx, 1.55);
    assert.equal(p.lateralLiftVy, 2.2);
    assert.equal(p.downwardRejectVy, 1.1);
    assert.equal(p.downwardRecoilVx, 0.85);
    assert.equal(p.diagonalRecoilVx, 1.2);
    assert.equal(p.diagonalLiftVy, 1.4);
    assert.equal(p.gravity, FLAP_FASTFALL_GRAVITY * 1.15);
    assert.equal(p.hFriction, 0.88);
    assert.equal(p.minLandRecoveryMs, 90);
    assert.equal(p.maxExtraConsequenceMs, 250);
  });

  it("legacy rollback remains operational (override OFF)", () => {
    const s = createSlideJumpScenario({
      armFlap: true,
      flapFlight: true,
      reactionV2: false,
    });
    placeDescendingOverOpponent(s, { height: 60 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.PARRIED);
    assert.equal(s.attacker.isSlideJumping, false);
    assert.equal(s.attacker.y, GROUND_LEVEL);
    assert.equal(s.attacker.isRecovering, true);
    assert.equal(s.attacker.offensiveAerialReaction, null);
  });

  it("V2 path uses PARRIED_RECOIL (heavy_short)", () => {
    const s = createSlideJumpScenario({
      armFlap: true,
      flapFlight: true,
      reactionV2: true,
    });
    placeDescendingOverOpponent(s, { height: 60 });
    armDefenderParry(s.defender, s.room.simTime, "regular");
    stepSlideJumpTick(s);
    assert.equal(s.attacker.offensiveAerial.outcome, OFFENSIVE_AERIAL_OUTCOME.PARRIED);
    assert.equal(s.attacker.isSlideJumping, true);
    assert.ok(s.attacker.y > GROUND_LEVEL);
    assert.equal(
      s.attacker.offensiveAerialReaction?.reactionType,
      "PARRIED_RECOIL"
    );
  });

  it("Rope Jump landing flag parsing remains independent", () => {
    const { parseRopeJumpLandingV2Flag, ROPE_JUMP_LANDING_V2 } = require("../../landingFlags");
    assert.equal(parseRopeJumpLandingV2Flag(undefined), true);
    assert.equal(parseRopeJumpLandingV2Flag("0"), false);
    // Finalization must not couple offensive-aerial env to rope-jump defaults.
    if (!process.env.ROPE_JUMP_LANDING_V2) {
      assert.equal(ROPE_JUMP_LANDING_V2, true);
    }
  });
});
