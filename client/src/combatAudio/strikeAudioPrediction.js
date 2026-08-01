/**
 * Provisional strike-audio classification aligned with the 50ms command chord
 * window (PALM_DIR_CHORD_MS / STRIKE_CHORD_MS).
 *
 * Does not delay gameplay prediction of a slap pose. It owns the *audio*
 * token so a Mouse1→S+Forward charge chord can cancel a provisional slap
 * whiff before the 55ms swing seam without adding chord grace on top of startup.
 */

import { CUE, STRIKE_CHORD_MS, SWING_STARTUP_MS } from "./cueRegistry.js";

let actionSeq = 0;

export function mintStrikeActionId(actorId, kind = "strike") {
  actionSeq += 1;
  return `${actorId || "local"}:${kind}:${actionSeq}`;
}

export function facingKeys(facing) {
  const forwardKey = facing === -1 ? "d" : "a";
  const backKey = facing === -1 ? "a" : "d";
  return { forwardKey, backKey };
}

/**
 * Classify open-game Mouse1 from held keys (mirrors Game.jsx / server hold rules).
 * Charge still requires held S+forward (not chord-grace alone), matching server
 * wantsChargedAttack. Chord grace is used to *reclassify* provisional slap audio
 * when S+forward appear shortly after Mouse1 — matching continuous charge check.
 */
export function classifyMouse1Strike(keys, facing) {
  if (facing == null) return { command: "slap", relativeDir: "neutral" };
  const { forwardKey, backKey } = facingKeys(facing);
  if (keys?.s && keys?.[forwardKey]) {
    return { command: "charge_start", relativeDir: "forward" };
  }
  if (keys?.[backKey] && !keys?.[forwardKey]) {
    return { command: "palm_thrust", relativeDir: "back" };
  }
  return {
    command: "slap",
    relativeDir: keys?.[forwardKey] ? "forward" : "neutral",
  };
}

/**
 * Create a small predictor that schedules provisional slap audio and can
 * reclassify to charge within STRIKE_CHORD_MS of the original input time.
 */
export function createStrikeAudioPredictor({
  orchestrator,
  now = () => performance.now(),
  actorId = "local",
}) {
  /** @type {null | { actionId: string, inputTs: number, kind: string, handleId: string|null }} */
  let provisional = null;

  function clearProvisional(reason) {
    if (!provisional) return;
    if (provisional.actionId) {
      orchestrator.cancelCombatAudioForAction(provisional.actionId, reason);
    }
    provisional = null;
  }

  /**
   * Call on local Mouse1-down classification.
   * Returns { command, actionId } for the caller to applyPrediction.
   */
  function onStrikePress({ keys, facing, pan = 0 }) {
    const classified = classifyMouse1Strike(keys, facing);
    const inputTs = now();

    if (classified.command === "charge_start") {
      clearProvisional("reclass_charge_immediate");
      return { command: "charge_start", actionId: null, inputTs };
    }

    if (classified.command === "palm_thrust") {
      clearProvisional("reclass_palm");
      const actionId = mintStrikeActionId(actorId, "palm");
      const playAt = inputTs + SWING_STARTUP_MS.palm;
      const { handleId } = orchestrator.scheduleCombatCue(
        CUE.PALM_WHIFF,
        {
          actorId,
          actionId,
          local: true,
          predicted: true,
          pan,
        },
        { playAt, reason: "palm_press" }
      );
      provisional = { actionId, inputTs, kind: "palm", handleId };
      return { command: "palm_thrust", actionId, inputTs };
    }

    // Provisional slap — scheduled at original input + startup (not + chord).
    const actionId = mintStrikeActionId(actorId, "slap");
    const playAt = inputTs + SWING_STARTUP_MS.slap;
    const { handleId } = orchestrator.scheduleCombatCue(
      CUE.SLAP_WHIFF,
      {
        actorId,
        actionId,
        local: true,
        predicted: true,
        pan,
      },
      { playAt, reason: "provisional_slap" }
    );
    provisional = { actionId, inputTs, kind: "slap", handleId };
    return { command: "slap", actionId, inputTs };
  }

  /**
   * While Mouse1 is held, if S+forward completes within the chord window of a
   * provisional slap, cancel slap audio and treat as charge hold (no release swoosh).
   */
  function onKeysWhileMouse1Held({ keys, facing }) {
    if (!provisional || provisional.kind !== "slap") return null;
    const age = now() - provisional.inputTs;
    if (age > STRIKE_CHORD_MS) return null;
    const classified = classifyMouse1Strike(keys, facing);
    if (classified.command !== "charge_start") return null;
    clearProvisional("reclass_charge_chord");
    return { command: "charge_start", actionId: null };
  }

  /** Explicit charge_start prediction path — kill any provisional strike audio. */
  function onChargeStart() {
    clearProvisional("charge_start");
  }

  /** Server confirmed charging — cancel incompatible provisional slap/palm audio. */
  function onAuthoritativeCharging() {
    clearProvisional("auth_charging");
  }

  function onChargeRelease({ pan = 0, dodging = false } = {}) {
    if (dodging) return null;
    const actionId = mintStrikeActionId(actorId, "charge_release");
    const inputTs = now();
    const playAt = inputTs + SWING_STARTUP_MS.charged;
    const { handleId } = orchestrator.scheduleCombatCue(
      CUE.CHARGED_ATTACK_RELEASE,
      {
        actorId,
        actionId,
        local: true,
        predicted: true,
        pan,
      },
      { playAt, reason: "charge_release" }
    );
    return { actionId, handleId, playAt, inputTs };
  }

  function onChargeInterrupted(reason = "charge_interrupted") {
    // Cancel any pending release tied to recent charge_release action ids via
    // caller-supplied actionId when available; also clear provisional press.
    clearProvisional(reason);
  }

  function cancelAction(actionId, reason) {
    if (actionId) orchestrator.cancelCombatAudioForAction(actionId, reason);
    if (provisional?.actionId === actionId) provisional = null;
  }

  function getProvisional() {
    return provisional;
  }

  return {
    onStrikePress,
    onKeysWhileMouse1Held,
    onChargeStart,
    onAuthoritativeCharging,
    onChargeRelease,
    onChargeInterrupted,
    cancelAction,
    clearProvisional,
    getProvisional,
  };
}
