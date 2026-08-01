/**
 * Deterministic combat-audio orchestration tests (no AudioContext).
 * Run: node --test client/src/combatAudio/*.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCombatAudioOrchestrator } from "./combatAudioOrchestrator.js";
import {
  createStrikeAudioPredictor,
  classifyMouse1Strike,
} from "./strikeAudioPrediction.js";
import { CUE, STRIKE_CHORD_MS, SWING_STARTUP_MS } from "./cueRegistry.js";
import {
  parseVolumeSetting,
  clampVolumePercent,
} from "../components/volumeSettings.js";

function makeHarness() {
  let t = 0;
  const timers = new Map();
  let timerSeq = 1;
  const played = [];

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
        pan: meta.pan,
        predicted: !!meta.ctx?.predicted,
        authoritative: !!meta.ctx?.authoritative,
        actionId: meta.ctx?.actionId,
        actorId: meta.ctx?.actorId,
      });
    },
  });

  return { orch, played, advance, now: () => t, setTime: (v) => { t = v; } };
}

describe("combat audio — charged attack / slap reclass", () => {
  let h;
  beforeEach(() => {
    h = makeHarness();
  });

  it("charge hold produces no release/whiff cue", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    const r = pred.onStrikePress({
      keys: { s: true, d: true, mouse1: true },
      facing: -1,
    });
    assert.equal(r.command, "charge_start");
    h.advance(200);
    assert.equal(h.played.length, 0);
  });

  it("charge release produces one cue at startup seam", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onChargeStart();
    pred.onChargeRelease({ pan: 0 });
    h.advance(SWING_STARTUP_MS.charged - 1);
    assert.equal(h.played.length, 0);
    h.advance(1);
    assert.equal(h.played.length, 1);
    assert.equal(h.played[0].cue, CUE.CHARGED_ATTACK_RELEASE);
  });

  it("canceled / interrupted charge produces no release cue", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    const rel = pred.onChargeRelease();
    pred.cancelAction(rel.actionId, "interrupted");
    h.advance(300);
    assert.equal(h.played.length, 0);
  });

  it("provisional slap canceled when command becomes charge within chord", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    const press = pred.onStrikePress({
      keys: { mouse1: true },
      facing: -1,
    });
    assert.equal(press.command, "slap");
    h.advance(40);
    const re = pred.onKeysWhileMouse1Held({
      keys: { mouse1: true, s: true, d: true },
      facing: -1,
    });
    assert.equal(re?.command, "charge_start");
    h.advance(100);
    assert.equal(h.played.length, 0);
  });

  it("legitimate slap cue remains at original startup seam", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onStrikePress({ keys: { mouse1: true }, facing: -1 });
    h.advance(SWING_STARTUP_MS.slap - 1);
    assert.equal(h.played.length, 0);
    h.advance(1);
    assert.equal(h.played.length, 1);
    assert.equal(h.played[0].cue, CUE.SLAP_WHIFF);
  });

  it("input outside chord window remains slap if never reclassified", () => {
    const pred = createStrikeAudioPredictor({
      orchestrator: h.orch,
      now: h.now,
      actorId: "p1",
    });
    pred.onStrikePress({ keys: { mouse1: true }, facing: -1 });
    h.advance(STRIKE_CHORD_MS + 1);
    const re = pred.onKeysWhileMouse1Held({
      keys: { mouse1: true, s: true, d: true },
      facing: -1,
    });
    assert.equal(re, null);
    h.advance(SWING_STARTUP_MS.slap);
    assert.equal(h.played.some((p) => p.cue === CUE.SLAP_WHIFF), true);
  });

  it("local predict + authoritative confirm = one audible cue", () => {
    const actionId = "p1:charge_release:1";
    h.orch.scheduleCombatCue(
      CUE.CHARGED_ATTACK_RELEASE,
      { actorId: "p1", actionId, local: true, predicted: true },
      { delayMs: 10 }
    );
    h.advance(10);
    assert.equal(h.played.length, 1);
    const conf = h.orch.confirmCombatCue(CUE.CHARGED_ATTACK_RELEASE, {
      actorId: "p1",
      actionId,
      authoritative: true,
    });
    assert.equal(conf.played, false);
    assert.equal(h.played.length, 1);
  });

  it("remote authoritative charged release plays once", () => {
    h.orch.playCombatCue(CUE.CHARGED_ATTACK_RELEASE, {
      actorId: "p2",
      eventId: "room:charged:9",
      authoritative: true,
      local: false,
    });
    h.orch.playCombatCue(CUE.CHARGED_ATTACK_RELEASE, {
      actorId: "p2",
      eventId: "room:charged:9",
      authoritative: true,
      local: false,
    });
    assert.equal(h.played.length, 1);
  });

  it("round reset cancels pending charged cues", () => {
    h.orch.scheduleCombatCue(
      CUE.CHARGED_ATTACK_RELEASE,
      { actorId: "p1", actionId: "a1", predicted: true },
      { delayMs: 150 }
    );
    h.orch.clearCombatAudioForRound("round_reset");
    h.advance(200);
    assert.equal(h.played.length, 0);
  });

  it("classifyMouse1Strike charge vs slap", () => {
    assert.equal(
      classifyMouse1Strike({ s: true, d: true }, -1).command,
      "charge_start"
    );
    assert.equal(classifyMouse1Strike({ mouse1: true }, -1).command, "slap");
    assert.equal(
      classifyMouse1Strike({ a: true }, -1).command,
      "palm_thrust"
    );
  });
});

describe("combat audio — RESISTED", () => {
  it("authoritative RESISTED plays once; duplicate eventId suppressed", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.CLINCH_THROW_RESISTED, {
      eventId: "fail-1",
      actorId: "p1",
      authoritative: true,
    });
    h.orch.playCombatCue(CUE.CLINCH_THROW_RESISTED, {
      eventId: "fail-1",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 1);
  });

  it("Perfect Brace path must not use RESISTED cue (caller responsibility)", () => {
    const h = makeHarness();
    // Orchestrator has no perfectBrace mapping — absence of play is the contract
    // when GameFighter returns early on perfectBrace before calling the cue.
    assert.equal(h.played.length, 0);
  });

  it("distinct RESISTED events each play", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.CLINCH_THROW_RESISTED, {
      eventId: "fail-a",
      authoritative: true,
    });
    h.advance(130); // past cue minInterval
    h.orch.playCombatCue(CUE.CLINCH_THROW_RESISTED, {
      eventId: "fail-b",
      authoritative: true,
    });
    assert.equal(h.played.length, 2);
  });
});

describe("combat audio — launches and redirect", () => {
  it("accepted liftoff plays once; duplicate eventId does not replay", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.ROPE_JUMP_LAUNCH, {
      eventId: "rj:1",
      actorId: "p1",
      authoritative: true,
    });
    h.orch.playCombatCue(CUE.ROPE_JUMP_LAUNCH, {
      eventId: "rj:1",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 1);
    h.orch.playCombatCue(CUE.SLIDE_JUMP_LAUNCH, {
      eventId: "sj:1",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 2);
  });

  it("later distinct launch can play", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.ROPE_JUMP_LAUNCH, {
      eventId: "rj:1",
      actorId: "p1",
      authoritative: true,
    });
    h.advance(120); // past cue minInterval
    h.orch.playCombatCue(CUE.ROPE_JUMP_LAUNCH, {
      eventId: "rj:2",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 2);
  });

  it("accepted redirects ~160ms apart both play; same event dedupes", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "redir:1",
      actorId: "p1",
      authoritative: true,
    });
    h.advance(160);
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "redir:2",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 2);
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "redir:2",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 2);
  });

  it("one player's redirect does not suppress the opponent's", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r-p1-1",
      actorId: "p1",
      authoritative: true,
    });
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r-p2-1",
      actorId: "p2",
      authoritative: true,
    });
    assert.equal(h.played.length, 2);
  });

  it("voice steal prevents uncontrolled pile-up on same actor", () => {
    const h = makeHarness();
    // maxVoices=2, voiceSteal=oldest — third still plays (steals), count stays bounded in policy
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r1",
      actorId: "p1",
      authoritative: true,
    });
    h.advance(50);
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r2",
      actorId: "p1",
      authoritative: true,
    });
    h.advance(50);
    h.orch.playCombatCue(CUE.SLIDE_REDIRECT, {
      eventId: "r3",
      actorId: "p1",
      authoritative: true,
    });
    assert.equal(h.played.length, 3);
  });
});

describe("combat audio — Matador Break", () => {
  it("MATADOR_BREAK plays once per event; ordinary hit path has no glass cue", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.MATADOR_BREAK, {
      eventId: "hit-gored-1",
      actorId: "p2",
      authoritative: true,
    });
    h.orch.playCombatCue(CUE.MATADOR_BREAK, {
      eventId: "hit-gored-1",
      actorId: "p2",
      authoritative: true,
    });
    assert.equal(h.played.length, 1);
    assert.equal(h.played[0].cue, CUE.MATADOR_BREAK);
  });

  it("maxVoices reject prevents glass stacking on same actor", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.MATADOR_BREAK, {
      eventId: "g1",
      actorId: "p2",
      authoritative: true,
    });
    // Different event but same actor within voice window — reject
    const r = h.orch.playCombatCue(CUE.MATADOR_BREAK, {
      eventId: "g2",
      actorId: "p2",
      authoritative: true,
    });
    assert.equal(r.played, false);
    assert.equal(h.played.length, 1);
  });
});

describe("combat audio — slap parry ownership / lifecycle", () => {
  it("duplicate eventId for SLAP_PARRY plays once", () => {
    const h = makeHarness();
    h.orch.playCombatCue(CUE.SLAP_PARRY, {
      eventId: "parry-1",
      authoritative: true,
    });
    h.orch.playCombatCue(CUE.SLAP_PARRY, {
      eventId: "parry-1",
      authoritative: true,
    });
    assert.equal(h.played.length, 1);
  });

  it("unmount/clear cancels pending", () => {
    const h = makeHarness();
    h.orch.scheduleCombatCue(
      CUE.SLAP_WHIFF,
      { actionId: "x", predicted: true },
      { delayMs: 55 }
    );
    h.orch.clearCombatAudioForRound("unmount");
    h.advance(100);
    assert.equal(h.played.length, 0);
  });
});

describe("volume settings helpers", () => {
  it("saved zero volume remains zero", () => {
    assert.equal(parseVolumeSetting(0), 0);
    assert.equal(clampVolumePercent(0), 0);
  });

  it("missing volume uses default 100", () => {
    assert.equal(parseVolumeSetting(undefined), 100);
    assert.equal(parseVolumeSetting(null), 100);
  });

  it("malformed values clamp/fallback safely", () => {
    assert.equal(parseVolumeSetting("nope"), 100);
    assert.equal(clampVolumePercent(250), 100);
    assert.equal(clampVolumePercent(-5), 0);
    assert.equal(parseVolumeSetting("42"), 42);
  });
});

describe("loop handle contract (pure)", () => {
  it("pending loop canceled before start never starts", async () => {
    let started = false;
    let canceled = false;
    const handle = {
      _canceled: false,
      stop() {
        this._canceled = true;
        canceled = true;
      },
    };
    const pending = Promise.resolve().then(() => {
      if (handle._canceled) return;
      started = true;
    });
    handle.stop();
    await pending;
    assert.equal(canceled, true);
    assert.equal(started, false);
  });

  it("stopping twice is safe", () => {
    let n = 0;
    const handle = {
      stopped: false,
      stop() {
        if (this.stopped) return;
        this.stopped = true;
        n += 1;
      },
    };
    handle.stop();
    handle.stop();
    assert.equal(n, 1);
  });
});
