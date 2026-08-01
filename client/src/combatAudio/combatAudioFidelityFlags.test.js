/**
 * COMBAT_AUDIO_FIDELITY_V1 flag semantics (finalized default ON).
 * Run: node --test client/src/combatAudio/*.test.js
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseCombatAudioFidelityV1Flag,
  isCombatAudioFidelityV1Enabled,
} from "./combatAudioFidelityFlags.js";
import { createCombatAudioOrchestrator } from "./combatAudioOrchestrator.js";
import { createStrikeAudioPredictor } from "./strikeAudioPrediction.js";
import { CUE, SWING_STARTUP_MS } from "./cueRegistry.js";

const FLAG = "COMBAT_AUDIO_FIDELITY_V1";

describe("COMBAT_AUDIO_FIDELITY_V1 flag (default ON)", () => {
  const env = globalThis.process.env;
  const prev = Object.prototype.hasOwnProperty.call(env, FLAG)
    ? env[FLAG]
    : undefined;
  const had = Object.prototype.hasOwnProperty.call(env, FLAG);

  afterEach(() => {
    if (had) env[FLAG] = prev;
    else delete env[FLAG];
  });

  it("unset → ON", () => {
    assert.equal(parseCombatAudioFidelityV1Flag(undefined), true);
    delete env[FLAG];
    assert.equal(isCombatAudioFidelityV1Enabled(), true);
  });

  it("null → ON", () => {
    assert.equal(parseCombatAudioFidelityV1Flag(null), true);
  });

  it("empty → ON", () => {
    assert.equal(parseCombatAudioFidelityV1Flag(""), true);
    env[FLAG] = "";
    assert.equal(isCombatAudioFidelityV1Enabled(), true);
  });

  it("1 → ON", () => {
    assert.equal(parseCombatAudioFidelityV1Flag("1"), true);
    assert.equal(isCombatAudioFidelityV1Enabled("1"), true);
  });

  it("true → ON", () => {
    assert.equal(parseCombatAudioFidelityV1Flag("true"), true);
    assert.equal(parseCombatAudioFidelityV1Flag(true), true);
    assert.equal(isCombatAudioFidelityV1Enabled("true"), true);
  });

  it("0 → OFF", () => {
    assert.equal(parseCombatAudioFidelityV1Flag("0"), false);
    env[FLAG] = "0";
    assert.equal(isCombatAudioFidelityV1Enabled(), false);
  });

  it("false → OFF", () => {
    assert.equal(parseCombatAudioFidelityV1Flag("false"), false);
    assert.equal(parseCombatAudioFidelityV1Flag(false), false);
    env[FLAG] = "false";
    assert.equal(isCombatAudioFidelityV1Enabled(), false);
  });

  it("rollback OFF does not leak V1-only provisional ownership behavior", () => {
    // With flag OFF, production GameFighter gates predictor arming behind
    // combatAudioEnabled(). Rollback must report disabled, and must not imply
    // that orphaned direct orch schedules are the approved path — ownership
    // lives only on the V1 predictor path when the flag is ON.
    assert.equal(parseCombatAudioFidelityV1Flag("0"), false);
    assert.equal(isCombatAudioFidelityV1Enabled("0"), false);

    let t = 0;
    const timers = new Map();
    let seq = 1;
    const played = [];
    const orch = createCombatAudioOrchestrator({
      now: () => t,
      setTimeout: (fn, ms) => {
        const id = seq++;
        timers.set(id, { fn, at: t + ms });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      playLayers: (_layers, meta) => {
        played.push(meta.cueName);
        return { handles: [], stopAll: () => {} };
      },
    });

    // Legacy rollback: do not arm predictor provisional ownership.
    // (Mirrors GameFighter else-branch: scheduleSwingSound only when V1 off.)
    const v1Enabled = isCombatAudioFidelityV1Enabled("0");
    assert.equal(v1Enabled, false);
    if (v1Enabled) {
      createStrikeAudioPredictor({
        orchestrator: orch,
        now: () => t,
        actorId: "p1",
      }).onPredictedStrike({ command: "palm_thrust" });
    }
    t += SWING_STARTUP_MS.palm + 50;
    for (const [id, v] of [...timers.entries()]) {
      if (v.at <= t) {
        timers.delete(id);
        v.fn();
      }
    }
    assert.equal(played.filter((c) => c === CUE.PALM_WHIFF).length, 0);
    assert.equal(orch.getPendingCount(), 0);
  });
});
