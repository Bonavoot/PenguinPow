/**
 * Charged-attack phantom palm — production-equivalent composition tests.
 * Exercises live facing selection → Mouse1 classifier → predictor ownership → orch.
 *
 * Frozen contract (finalized / player-verified phantom-palm fix):
 * live facing > room summary; S+Forward > palm; kb/gp + mode parity; owned
 * provisional slap/palm; charge_start + auth cancel; no late fire; actor
 * isolation; long hold silent; one immediate lunge; legitimate palm/slap once.
 *
 * Run: node --test client/src/combatAudio/*.test.js client/src/prediction/liveLocalFighter.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCombatAudioOrchestrator } from "./combatAudioOrchestrator.js";
import {
  createStrikeAudioPredictor,
  classifyMouse1Strike,
  facingKeys,
} from "./strikeAudioPrediction.js";
import { selectMouse1StrikeCommand } from "./mouse1CommandSelection.js";
import { selectLiveLocalFighter } from "../prediction/liveLocalFighter.js";
import { CUE, SWING_STARTUP_MS } from "./cueRegistry.js";
import {
  clearAudioTrace,
  dumpAudioTrace,
  dumpChargePalmTrace,
  pushAudioTrace,
} from "./audioTrace.js";
import { isCombatAudioFidelityV1Enabled } from "./combatAudioFidelityFlags.js";

function makeHarness() {
  let t = 0;
  const timers = new Map();
  let timerSeq = 1;
  const played = [];
  const stopped = [];

  const setTimeoutFn = (fn, ms) => {
    const id = timerSeq++;
    timers.set(id, { fn, at: t + ms });
    return id;
  };
  const clearTimeoutFn = (id) => {
    timers.delete(id);
  };
  const advance = (ms) => {
    t += ms;
    const due = [...timers.entries()]
      .filter(([, v]) => v.at <= t)
      .sort((a, b) => a[1].at - b[1].at);
    for (const [id, v] of due) {
      timers.delete(id);
      v.fn();
    }
  };

  const orch = createCombatAudioOrchestrator({
    now: () => t,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    playLayers: (layers, meta) => {
      played.push({
        t,
        cue: meta.cueName,
        actionId: meta.ctx?.actionId,
        actorId: meta.ctx?.actorId,
        predicted: !!meta.ctx?.predicted,
      });
      const stopAll = (fadeMs) => {
        stopped.push({
          cue: meta.cueName,
          actorId: meta.ctx?.actorId,
          actionId: meta.ctx?.actionId,
          fadeMs,
          t,
        });
      };
      return { handles: [{ id: `voice-${played.length}` }], stopAll };
    },
  });

  return {
    orch,
    played,
    stopped,
    advance,
    now: () => t,
    setTime: (v) => {
      t = v;
    },
  };
}

/**
 * Production-equivalent Mouse1 seam: live fighter facing → classifier → predict.
 * Mirrors Game.jsx applyMouse1StrikeFromKeys + GameFighter onPredictedStrike.
 */
function composeMouse1Strike({
  localId,
  roomFacing,
  liveFacing,
  keys,
  modeLabel,
  predictor,
  inputPath = "keyboard",
}) {
  const sel = selectLiveLocalFighter({
    localId,
    roomPlayer: { id: localId, facing: roomFacing },
    getSharedState: () => ({
      player1: { id: localId, facing: liveFacing },
      player2: { id: "opp", facing: liveFacing === 1 ? -1 : 1 },
    }),
  });
  const selected = selectMouse1StrikeCommand({
    keys,
    facing: sel.facing,
    roomFacing: sel.roomFacing,
    liveFacing: sel.liveFacing,
    facingSource: sel.facingSource,
    modeLabel,
    attemptId: `${inputPath}:${localId}`,
    trace: true,
  });
  // Audio arm only for slap/palm; charge cancels provisional first.
  if (selected.command === "charge_start") {
    predictor.onChargeStart();
  } else {
    predictor.onPredictedStrike({
      command: selected.command,
      reason: selected.command === "palm_thrust" ? "palm_predict" : "slap_predict",
    });
  }
  return { sel, selected };
}

describe("charge/palm parity — live facing + owned lifecycle", () => {
  let h;
  let pred;
  beforeEach(() => {
    h = makeHarness();
    clearAudioTrace();
    // Force traces on under node test (pushAudioTrace checks DEV/localStorage).
    globalThis.process.env.NODE_ENV = "test";
    pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
  });

  it("1. live facing overrides stale room — charge not palm", () => {
    const { selected } = composeMouse1Strike({
      localId: "p1",
      roomFacing: -1,
      liveFacing: 1,
      keys: { s: true, a: true, mouse1: true },
      modeLabel: "basho",
      predictor: pred,
    });
    assert.equal(selected.command, "charge_start");
    h.advance(200);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 0);
  });

  it("2. mirrored stale facing — charge not palm", () => {
    const { selected } = composeMouse1Strike({
      localId: "p1",
      roomFacing: 1,
      liveFacing: -1,
      keys: { s: true, d: true, mouse1: true },
      modeLabel: "vs_cpu",
      predictor: pred,
    });
    assert.equal(selected.command, "charge_start");
  });

  it("3. mode parity — identical command across pvp/cpu/basho", () => {
    const keys = { s: true, a: true, mouse1: true };
    const cmds = ["custom_pvp", "vs_cpu", "basho"].map((modeLabel) => {
      const p = createStrikeAudioPredictor({
        orchestrator: h.orch,
        now: h.now,
        actorId: "p1",
      });
      return composeMouse1Strike({
        localId: "p1",
        roomFacing: -1,
        liveFacing: 1,
        keys,
        modeLabel,
        predictor: p,
      }).selected.command;
    });
    assert.deepEqual(cmds, ["charge_start", "charge_start", "charge_start"]);
  });

  it("4. keyboard/gamepad parity on stale-room scenario", () => {
    const keys = { s: true, a: true, mouse1: true };
    const kb = composeMouse1Strike({
      localId: "p1",
      roomFacing: -1,
      liveFacing: 1,
      keys,
      modeLabel: "custom_pvp",
      predictor: pred,
      inputPath: "keyboard",
    });
    const gpPred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1b",
    });
    const gp = composeMouse1Strike({
      localId: "p1",
      roomFacing: -1,
      liveFacing: 1,
      keys,
      modeLabel: "custom_pvp",
      predictor: gpPred,
      inputPath: "gamepad",
    });
    assert.equal(kb.selected.command, gp.selected.command);
    assert.equal(kb.selected.facingSource, "live_snapshot");
    assert.equal(gp.selected.facingSource, "live_snapshot");
  });

  it("5. false palm reclassified to charge before +90ms never plays", () => {
    // Simulate mispredict then local charge reclass (ownership path).
    pred.onPredictedStrike({ command: "palm_thrust", reason: "palm_predict" });
    const actionId = pred.getProvisional()?.actionId;
    assert.ok(actionId);
    h.advance(40);
    pred.onChargeStart();
    assert.equal(pred.getProvisional(), null);
    h.advance(200);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 0);
    assert.equal(h.orch.getPendingCount(), 0);
    const dump = dumpAudioTrace();
    assert.ok(dump.some((r) => r.cue === CUE.PALM_WHIFF && r.status === "scheduled"));
    assert.ok(
      dump.some(
        (r) =>
          r.cue === CUE.PALM_WHIFF &&
          r.status === "canceled" &&
          r.reason === "reclass_charge_local" &&
          r.actionId === actionId
      )
    );
  });

  it("6. authoritative charge backstop cancels mispredicted palm", () => {
    pred.onPredictedStrike({ command: "palm_thrust", reason: "palm_predict" });
    const actionId = pred.getProvisional().actionId;
    h.advance(30);
    pred.onAuthoritativeCharging();
    h.advance(200);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 0);
    const dump = dumpAudioTrace();
    assert.ok(
      dump.some(
        (r) =>
          r.cue === CUE.PALM_WHIFF &&
          r.status === "canceled" &&
          r.reason === "auth_charge_reconcile" &&
          r.actionId === actionId
      )
    );
  });

  it("6b. late reconcile fade-stops only the exact active palm action", () => {
    pred.onPredictedStrike({ command: "palm_thrust", reason: "palm_predict" });
    const p1Action = pred.getProvisional().actionId;
    // Opponent legitimate palm (separate actor/action).
    h.orch.scheduleCombatCue(
      CUE.PALM_WHIFF,
      {
        actorId: "p2",
        actionId: "p2:palm:legit",
        predicted: true,
      },
      { playAt: h.now() + SWING_STARTUP_MS.palm, reason: "palm_remote" }
    );
    h.advance(SWING_STARTUP_MS.palm);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 2);
    // Late auth charge — stop only p1's active voice.
    h.orch.cancelCombatAudioForAction(p1Action, "auth_charge_reconcile");
    assert.ok(
      h.stopped.some((s) => s.actionId === p1Action && s.fadeMs === 28)
    );
    assert.equal(
      h.stopped.filter((s) => s.actionId === "p2:palm:legit").length,
      0
    );
  });

  it("7. legitimate palm plays once; auth confirm does not double", () => {
    const r = pred.onPredictedStrike({
      command: "palm_thrust",
      reason: "palm_predict",
    });
    h.advance(SWING_STARTUP_MS.palm);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 1);
    const conf = h.orch.confirmCombatCue(CUE.PALM_WHIFF, {
      actorId: "p1",
      actionId: r.actionId,
      authoritative: true,
    });
    assert.equal(conf.played, false);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 1);
  });

  it("8. legitimate neutral slap schedules/plays once", () => {
    pred.onPredictedStrike({ command: "slap", reason: "slap_predict" });
    h.advance(SWING_STARTUP_MS.slap);
    assert.equal(h.played.filter((p) => p.cue === CUE.SLAP_WHIFF).length, 1);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 0);
  });

  it("9. Mouse1-first then S+Forward in chord cancels provisional", () => {
    pred.onPredictedStrike({ command: "slap", reason: "slap_predict" });
    h.advance(30);
    const re = pred.onKeysWhileMouse1Held({
      keys: { mouse1: true, s: true, a: true },
      facing: 1,
    });
    assert.equal(re?.command, "charge_start");
    pred.onChargeStart();
    h.advance(200);
    assert.equal(h.played.length, 0);
  });

  it("9b. Mouse1-first false palm then chord charge cancels palm", () => {
    pred.onPredictedStrike({ command: "palm_thrust", reason: "palm_predict" });
    h.advance(25);
    assert.ok(
      pred.onKeysWhileMouse1Held({
        keys: { mouse1: true, s: true, a: true },
        facing: 1,
      })
    );
    h.advance(200);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 0);
  });

  it("10. long charge hold — zero slap/palm/lunge before release", () => {
    pred.onChargeStart();
    h.advance(2500);
    assert.equal(h.played.filter((p) => p.cue === CUE.SLAP_WHIFF).length, 0);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 0);
    assert.equal(
      h.played.filter((p) => p.cue === CUE.CHARGED_LUNGE_BEGIN).length,
      0
    );
  });

  it("11. lunge begin immediate; auth confirm does not duplicate", () => {
    pred.onChargeStart();
    const { actionId } = pred.onChargedLungeBegin({ pan: 0 });
    assert.equal(h.played[0].cue, CUE.CHARGED_LUNGE_BEGIN);
    assert.equal(h.played[0].t, h.now());
    const conf = h.orch.confirmCombatCue(CUE.CHARGED_LUNGE_BEGIN, {
      actorId: "p1",
      actionId,
      authoritative: true,
    });
    assert.equal(conf.played, false);
    assert.equal(
      h.played.filter((p) => p.cue === CUE.CHARGED_LUNGE_BEGIN).length,
      1
    );
  });

  it("12. interrupt/reset clears pending provisional palm", () => {
    pred.onPredictedStrike({ command: "palm_thrust", reason: "palm_predict" });
    pred.clearProvisional("hit");
    h.advance(200);
    assert.equal(h.played.length, 0);
    pred.onPredictedStrike({ command: "palm_thrust", reason: "palm_predict" });
    h.orch.clearCombatAudioForRound("round_reset");
    pred.clearProvisional("round_reset");
    h.advance(200);
    assert.equal(h.played.filter((p) => p.cue === CUE.PALM_WHIFF).length, 0);
  });

  it("13. actor isolation — P1 cancel does not kill P2 palm", () => {
    const p1 = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    const p2 = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p2",
    });
    p1.onPredictedStrike({ command: "palm_thrust" });
    p2.onPredictedStrike({ command: "palm_thrust" });
    p1.onChargeStart();
    h.advance(SWING_STARTUP_MS.palm);
    assert.equal(
      h.played.filter((p) => p.cue === CUE.PALM_WHIFF && p.actorId === "p1")
        .length,
      0
    );
    assert.equal(
      h.played.filter((p) => p.cue === CUE.PALM_WHIFF && p.actorId === "p2")
        .length,
      1
    );
  });

  it("14. feature flag default is ON; classifier remains independent of mode", () => {
    // Unset process key so default-ON semantics apply under node:test.
    const flag = "COMBAT_AUDIO_FIDELITY_V1";
    const env = globalThis.process.env;
    const had = Object.prototype.hasOwnProperty.call(env, flag);
    const prev = env[flag];
    delete env[flag];
    try {
      assert.equal(isCombatAudioFidelityV1Enabled(), true);
    } finally {
      if (had) env[flag] = prev;
      else delete env[flag];
    }
    assert.equal(
      classifyMouse1Strike({ s: true, a: true, mouse1: true }, 1).command,
      "charge_start"
    );
  });

  it("clearProvisional traces PALM_WHIFF for palm kind (not SLAP_WHIFF)", () => {
    pred.onPredictedStrike({ command: "palm_thrust" });
    pred.clearProvisional("reclass_charge_local");
    const canceled = dumpAudioTrace().filter(
      (r) => r.status === "canceled" && r.reason === "reclass_charge_local"
    );
    assert.ok(canceled.some((r) => r.cue === CUE.PALM_WHIFF));
    assert.ok(!canceled.some((r) => r.cue === CUE.SLAP_WHIFF));
  });

  it("dumpChargePalmTrace gathers charge/palm/input records", () => {
    pushAudioTrace({
      cue: "*",
      status: "MOUSE1_COMMAND_SELECTED",
      command: "charge_start",
    });
    pred.onPredictedStrike({ command: "palm_thrust" });
    pred.onChargeStart();
    const filtered = dumpChargePalmTrace();
    assert.ok(filtered.length >= 2);
    assert.ok(filtered.every((r) => r.status || r.cue));
  });

  it("A+D together never classifies as palm", () => {
    assert.equal(
      classifyMouse1Strike({ a: true, d: true, mouse1: true }, 1).command,
      "slap"
    );
    assert.equal(
      classifyMouse1Strike({ a: true, d: true, s: true, mouse1: true }, 1)
        .command,
      "charge_start"
    );
  });

  it("facingKeys matches historical forward/back mapping", () => {
    assert.deepEqual(facingKeys(1), { forwardKey: "a", backKey: "d" });
    assert.deepEqual(facingKeys(-1), { forwardKey: "d", backKey: "a" });
  });
});

describe("charge pose supersede includes false palm", () => {
  it("fresh palm prediction is supersedable for charge pose", async () => {
    const { isFreshProvisionalSlapPrediction } = await import(
      "./chargeAudioIntegration.js"
    );
    assert.equal(
      isFreshProvisionalSlapPrediction(
        { isPalmThrust: true, isAttacking: true, timestamp: 0 },
        40
      ),
      true
    );
  });
});
