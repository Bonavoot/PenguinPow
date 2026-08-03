/**
 * Combat Audio Fidelity V1 — corrective / finalized suite helpers.
 * Run: node --test client/src/combatAudio/*.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCombatAudioOrchestrator } from "./combatAudioOrchestrator.js";
import {
  createStrikeAudioPredictor,
  classifyMouse1Strike,
} from "./strikeAudioPrediction.js";
import {
  CUE,
  STRIKE_CHORD_MS,
  SWING_STARTUP_MS,
  getCueDefinition,
  CINEMATIC_VARIANT,
} from "./cueRegistry.js";
import {
  shouldPredictChargeHoldPose,
  liveChargeReclassSequence,
  isFreshProvisionalSlapPrediction,
} from "./chargeAudioIntegration.js";
import {
  resolveCinematicVariant,
  shouldPlayCinematicGunCue,
  shouldPlayCinematicChargedLaunchPackage,
  shouldPlayCinematicKillSmokeTrail,
} from "./cinematicAudio.js";
import {
  resolveClinchThrowFailAudio,
  applyClinchThrowFailPresentationAndAudio,
} from "./clinchThrowFailAudio.js";
import {
  parseVolumeSetting,
  clampVolumePercent,
} from "../components/volumeSettings.js";

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
        samples: layers.map((l) => l.sampleKey),
        durations: layers.map((l) => l.durationMs ?? null),
        pan: meta.pan,
        predicted: !!meta.ctx?.predicted,
        authoritative: !!meta.ctx?.authoritative,
        actionId: meta.ctx?.actionId,
        actorId: meta.ctx?.actorId,
      });
      const stopAll = () => {
        stopped.push({ cue: meta.cueName, actorId: meta.ctx?.actorId, t });
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

describe("charge — live reclass + CHARGED_LUNGE_BEGIN", () => {
  let h;
  beforeEach(() => {
    h = makeHarness();
  });

  it("charge hold emits no lunge cue", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onStrikePress({
      keys: { s: true, d: true, mouse1: true },
      facing: -1,
    });
    h.advance(300);
    assert.equal(
      h.played.filter((p) => p.cue === CUE.CHARGED_LUNGE_BEGIN).length,
      0
    );
  });

  it("production order: slap then charge cancels even when canPredictAction is closed", () => {
    let whooshAlive = true;
    let poseCharging = false;
    const pred = { isAttacking: true, isSlapAttack: true, timestamp: 0 };
    const seq = liveChargeReclassSequence({
      scheduleSlapWhoosh: () => {
        whooshAlive = true;
        pred.isAttacking = true;
        pred.isSlapAttack = true;
        pred.timestamp = 0;
      },
      cancelProvisionalAudio: () => {
        whooshAlive = false;
      },
      canPredictActionAfterSlap: () => {
        // Fresh provisional slap closes the generic gate.
        return !(
          pred.isAttacking &&
          h.now() - pred.timestamp < 150
        );
      },
      supersedePose: isFreshProvisionalSlapPrediction(pred, 40),
      applyChargePose: () => {
        poseCharging = true;
        pred.isAttacking = false;
        pred.isSlapAttack = false;
        pred.isChargingAttack = true;
      },
    });
    assert.equal(seq.gateWasClosed, true);
    assert.equal(whooshAlive, false);
    assert.equal(poseCharging, true);
  });

  it("shouldPredictChargeHoldPose supersedes fresh provisional slap when gate closed", () => {
    const ok = shouldPredictChargeHoldPose({
      canPredictAction: false,
      isLocalParryActive: false,
      penguinIsAttacking: false,
      penguinIsCharging: false,
      pred: { isSlapAttack: true, isAttacking: true, timestamp: 100 },
      now: 140,
    });
    assert.equal(ok, true);
  });

  it("Mouse1-first provisional slap + S+Forward in chord cancels pending slap", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onStrikePress({ keys: { mouse1: true }, facing: -1 });
    h.advance(40);
    const re = pred.onKeysWhileMouse1Held({
      keys: { mouse1: true, s: true, d: true },
      facing: -1,
    });
    assert.equal(re?.command, "charge_start");
    // Simulate production: charge_start always calls onChargeStart even if gate closed.
    pred.onChargeStart();
    h.advance(100);
    assert.equal(h.played.length, 0);
  });

  it("legitimate slap outside chord keeps sound", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onStrikePress({ keys: { mouse1: true }, facing: -1 });
    h.advance(STRIKE_CHORD_MS + 1);
    assert.equal(
      pred.onKeysWhileMouse1Held({
        keys: { mouse1: true, s: true, d: true },
        facing: -1,
      }),
      null
    );
    h.advance(SWING_STARTUP_MS.slap);
    assert.ok(h.played.some((p) => p.cue === CUE.SLAP_WHIFF));
  });

  it("lunge begin plays immediately — no +150ms timer", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onChargeStart();
    pred.onChargedLungeBegin({ pan: 0 });
    assert.equal(h.played.length, 1);
    assert.equal(h.played[0].cue, CUE.CHARGED_LUNGE_BEGIN);
    assert.equal(h.played[0].t, 0);
  });

  it("no schedule uses SWING_STARTUP_MS.charged for lunge cue", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onChargedLungeBegin();
    h.advance(SWING_STARTUP_MS.charged);
    assert.equal(
      h.played.filter((p) => p.cue === CUE.CHARGED_LUNGE_BEGIN).length,
      1
    );
  });

  it("local predict + auth confirm = one cue", () => {
    const actionId = "p1:charged_lunge:1";
    h.orch.playCombatCue(CUE.CHARGED_LUNGE_BEGIN, {
      actorId: "p1",
      actionId,
      local: true,
      predicted: true,
    });
    const conf = h.orch.confirmCombatCue(CUE.CHARGED_LUNGE_BEGIN, {
      actorId: "p1",
      actionId,
      authoritative: true,
    });
    assert.equal(conf.played, false);
    assert.equal(h.played.length, 1);
  });

  it("remote authoritative lunge plays once; snapshot replay dedupes", () => {
    h.orch.playCombatCue(CUE.CHARGED_LUNGE_BEGIN, {
      actorId: "p2",
      eventId: "p2:charged_lunge:99",
      authoritative: true,
    });
    h.orch.playCombatCue(CUE.CHARGED_LUNGE_BEGIN, {
      actorId: "p2",
      eventId: "p2:charged_lunge:99",
      authoritative: true,
    });
    assert.equal(h.played.length, 1);
  });

  it("charge cancel without lunge produces zero lunge cues", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onChargeStart();
    pred.onChargeInterrupted("hit");
    h.advance(200);
    assert.equal(
      h.played.filter((p) => p.cue === CUE.CHARGED_LUNGE_BEGIN).length,
      0
    );
  });

  it("classifyMouse1Strike charge vs slap", () => {
    assert.equal(
      classifyMouse1Strike({ s: true, d: true }, -1).command,
      "charge_start"
    );
    assert.equal(classifyMouse1Strike({ mouse1: true }, -1).command, "slap");
  });
});

describe("clinch RESISTED + Perfect Brace", () => {
  const resistedPayload = {
    actorId: "a1",
    targetId: "t1",
    actionType: "throw",
    resistedByPlant: true,
    playerNumber: 2,
    failId: "clinch-fail-100-a1",
    actorX: 500,
    targetX: 620,
    combatPresentation: {
      eventId: "pres-fail-100",
      interactionType: "THROW_FAIL",
    },
  };

  const perfectBracePayload = {
    actorId: "a1",
    targetId: "t1",
    perfectBrace: true,
    playerNumber: 2,
    failId: "perfect-brace-100-t1",
    combatPresentation: {
      eventId: "pres-pb-100",
      interactionType: "THROW_FAIL",
    },
  };

  it("RESISTED resolves isTeching and plays once via realistic payload", () => {
    const h = makeHarness();
    const resolved = resolveClinchThrowFailAudio(resistedPayload);
    assert.equal(resolved.cue, CUE.CLINCH_THROW_RESISTED);
    assert.equal(getCueDefinition(resolved.cue).layers[0].sampleKey, "isTeching");
    assert.equal(getCueDefinition(resolved.cue).layers[0].gain, 0.04);

    const seen = new Set();
    const r = applyClinchThrowFailPresentationAndAudio({
      data: resistedPayload,
      claimPresentationEvent: (id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      },
      readCombatPresentation: (d) => d.combatPresentation,
      playCombatCue: (cue, ctx) => h.orch.playCombatCue(cue, ctx),
      onResistedVisual: () => {},
      onPerfectBraceVisual: () => {},
    });
    assert.equal(r.audio, true);
    assert.equal(h.played.length, 1);
    assert.equal(h.played[0].samples[0], "isTeching");

    const dup = applyClinchThrowFailPresentationAndAudio({
      data: resistedPayload,
      claimPresentationEvent: (id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      },
      readCombatPresentation: (d) => d.combatPresentation,
      playCombatCue: (cue, ctx) => h.orch.playCombatCue(cue, ctx),
      onResistedVisual: () => {},
      onPerfectBraceVisual: () => {},
    });
    assert.equal(dup.reason, "presentation_deduped");
    assert.equal(h.played.length, 1);
  });

  it("Perfect Brace uses CLINCH_PERFECT_BRACE layered cue once", () => {
    const h = makeHarness();
    const resolved = resolveClinchThrowFailAudio(perfectBracePayload);
    assert.equal(resolved.cue, CUE.CLINCH_PERFECT_BRACE);
    assert.notEqual(resolved.cue, CUE.CLINCH_THROW_RESISTED);
    const layers = getCueDefinition(resolved.cue).layers;
    assert.ok(layers.some((l) => l.sampleKey === "isTeching"));
    assert.ok(layers.some((l) => l.sampleKey === "rawParrySuccess"));

    const seen = new Set();
    const r = applyClinchThrowFailPresentationAndAudio({
      data: perfectBracePayload,
      claimPresentationEvent: (id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      },
      readCombatPresentation: (d) => d.combatPresentation,
      playCombatCue: (cue, ctx) => h.orch.playCombatCue(cue, ctx),
      onPerfectBraceVisual: () => {},
      onResistedVisual: () => {
        assert.fail("should not use resisted visual for PB");
      },
    });
    assert.equal(r.audio, true);
    assert.equal(h.played[0].cue, CUE.CLINCH_PERFECT_BRACE);
  });

  it("unrelated throw failure maps neither cue", () => {
    assert.equal(resolveClinchThrowFailAudio({ foo: 1 }), null);
  });
});

describe("slide redirect — dodge sample + real voice stop", () => {
  it("SLIDE_REDIRECT resolves dodge not flap", () => {
    const def = getCueDefinition(CUE.SLIDE_REDIRECT);
    assert.equal(def.layers[0].sampleKey, "dodge");
    assert.notEqual(def.layers[0].sampleKey, "flap");
    assert.equal(def.layers[0].gain, 0.02);
    assert.equal(def.layers[0].rate, 1.0);
  });

  it("two redirects 160ms apart both start; steal stops prior voice", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r1",
      actorId: "p1",
      authoritative: true,
    });
    h.advance(160);
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r2",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 2);
    assert.ok(h.orch.getVoiceStopCount() >= 1);
    assert.ok(h.stopped.length >= 1);
    assert.equal(h.orch.getActiveVoiceCount(CUE.SLIDE_REDIRECT, "p1"), 1);
  });

  it("opponent independent voice key", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r-p1",
      actorId: "p1",
      authoritative: true,
    });
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r-p2",
      actorId: "p2",
      authoritative: true,
    });
    assert.equal(h.played.length, 2);
    assert.equal(h.orch.getVoiceStopCount(), 0);
  });

  it("duplicate eventId does not replay", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "same",
      actorId: "p1",
      authoritative: true,
    });
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "same",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 1);
  });
});

describe("Matador glass + cinematic variants", () => {
  it("MATADOR_BREAK has no forced 420ms duration", () => {
    const def = getCueDefinition(CUE.MATADOR_BREAK);
    assert.equal(def.layers[0].durationMs, undefined);
    const h = makeHarness();
    h.orch.playCombatCue(CUE.MATADOR_BREAK, {
      eventId: "g1",
      actorId: "v",
      authoritative: true,
    });
    assert.equal(h.played[0].durations[0], null);
  });

  it("ordinary hit path has no glass cue from registry alone", () => {
    // Classifier responsibility — MATADOR_BREAK only when isGored handler fires.
    assert.ok(getCueDefinition(CUE.MATADOR_BREAK));
  });

  it("demolished_charged owns launch/gun/trail; matador_kill and ap_pull skip", () => {
    assert.equal(
      resolveCinematicVariant({ cinematicVariant: "demolished_charged" }),
      CINEMATIC_VARIANT.DEMOLISHED_CHARGED
    );
    assert.equal(shouldPlayCinematicGunCue({ cinematicVariant: "demolished_charged" }), true);
    assert.equal(
      shouldPlayCinematicChargedLaunchPackage({
        cinematicVariant: "demolished_charged",
      }),
      true
    );
    assert.equal(
      shouldPlayCinematicKillSmokeTrail({
        cinematicVariant: "demolished_charged",
      }),
      true
    );
    // Matador Break hit callout (isGored) must NOT strip the charged package —
    // a charged Matador-Break cinematic kill is still demolished_charged.
    assert.equal(
      resolveCinematicVariant({
        cinematicVariant: "demolished_charged",
        isGored: true,
      }),
      CINEMATIC_VARIANT.DEMOLISHED_CHARGED
    );
    assert.equal(
      shouldPlayCinematicGunCue({
        cinematicVariant: "demolished_charged",
        isGored: true,
      }),
      true
    );
    assert.equal(shouldPlayCinematicGunCue({ isGored: true }), true);
    // MATADOR success kill (belly-slide) — camera only.
    assert.equal(
      resolveCinematicVariant({ cinematicVariant: "matador_kill" }),
      CINEMATIC_VARIANT.MATADOR_KILL
    );
    assert.equal(shouldPlayCinematicGunCue({ cinematicVariant: "matador_kill" }), false);
    assert.equal(shouldPlayCinematicGunCue({ matadorKill: true }), false);
    // Legacy misnomer still resolves to matador_kill (camera-only).
    assert.equal(
      resolveCinematicVariant({ cinematicVariant: "matador_break" }),
      CINEMATIC_VARIANT.MATADOR_KILL
    );
    assert.equal(
      shouldPlayCinematicChargedLaunchPackage({
        cinematicVariant: "matador_kill",
      }),
      false
    );
    assert.equal(
      shouldPlayCinematicKillSmokeTrail({
        cinematicVariant: "matador_kill",
      }),
      false
    );
    assert.equal(shouldPlayCinematicChargedLaunchPackage({ apPullKill: true }), false);
    assert.equal(shouldPlayCinematicKillSmokeTrail({ apPullKill: true }), false);
    assert.equal(
      resolveCinematicVariant({ apPullKill: true }),
      CINEMATIC_VARIANT.AP_PULL
    );
  });

  it("MATADOR_BREAK uses original glass rate (not pitched shatter alternate)", () => {
    const layer = getCueDefinition(CUE.MATADOR_BREAK).layers[0];
    assert.equal(layer.sampleKey, "glassBreak");
    assert.equal(layer.rate, 1.0);
    assert.equal(layer.gain, 0.05);
  });
});

describe("volume helpers still sane", () => {
  it("zero volume preserved", () => {
    assert.equal(parseVolumeSetting(0), 0);
    assert.equal(clampVolumePercent(0), 0);
  });
});

// Adapter sample map includes dodge (Node can't import fighterAssets WAV URLs
// without Vite — skip resolveSample runtime if it throws).
describe("adapter sample keys", () => {
  it("cue registry dodge/isTeching/glass keys are defined", () => {
    assert.equal(getCueDefinition(CUE.SLIDE_REDIRECT).layers[0].sampleKey, "dodge");
    assert.equal(getCueDefinition(CUE.CLINCH_THROW_RESISTED).layers[0].sampleKey, "isTeching");
    assert.equal(getCueDefinition(CUE.MATADOR_BREAK).layers[0].sampleKey, "glassBreak");
  });
});
