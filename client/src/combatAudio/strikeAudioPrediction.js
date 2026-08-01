/**
 * Provisional strike-audio classification aligned with the 50ms command chord
 * window. Charge lunge whoosh is immediate at CHARGED_LUNGE_BEGIN — never
 * release+150ms.
 */

import { CUE, STRIKE_CHORD_MS, SWING_STARTUP_MS } from "./cueRegistry.js";
import { pushAudioTrace } from "./audioTrace.js";

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

export function createStrikeAudioPredictor({
  orchestrator,
  now = () => performance.now(),
  actorId = "local",
}) {
  /** @type {null | { actionId: string, inputTs: number, kind: string, handleId: string|null }} */
  let provisional = null;
  let lungeActionId = null;

  function clearProvisional(reason) {
    if (!provisional) return;
    if (provisional.actionId) {
      orchestrator.cancelCombatAudioForAction(provisional.actionId, reason);
    }
    pushAudioTrace({
      cue: CUE.SLAP_WHIFF,
      actorId,
      actionId: provisional.actionId,
      status: "PROVISIONAL_SLAP_CANCELED",
      reason,
    });
    provisional = null;
  }

  function onStrikePress({ keys, facing, pan = 0 }) {
    const classified = classifyMouse1Strike(keys, facing);
    const inputTs = now();

    if (classified.command === "charge_start") {
      clearProvisional("reclass_charge_immediate");
      pushAudioTrace({
        cue: "*",
        actorId,
        status: "CHARGE_HOLD_BEGIN",
        reason: "immediate_chord",
      });
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
    pushAudioTrace({
      cue: CUE.SLAP_WHIFF,
      actorId,
      actionId,
      status: "PROVISIONAL_SLAP_SCHEDULED",
      playAt,
    });
    return { command: "slap", actionId, inputTs };
  }

  function onKeysWhileMouse1Held({ keys, facing }) {
    if (!provisional || provisional.kind !== "slap") return null;
    const age = now() - provisional.inputTs;
    if (age > STRIKE_CHORD_MS) return null;
    const classified = classifyMouse1Strike(keys, facing);
    if (classified.command !== "charge_start") return null;
    clearProvisional("reclass_charge_chord");
    pushAudioTrace({
      cue: "*",
      actorId,
      status: "PROVISIONAL_SLAP_RECLASSIFIED",
      reason: "chord_window",
    });
    return { command: "charge_start", actionId: null };
  }

  function onChargeStart() {
    clearProvisional("charge_start");
    pushAudioTrace({
      cue: "*",
      actorId,
      status: "CHARGE_HOLD_BEGIN",
      reason: "charge_start",
    });
  }

  function onAuthoritativeCharging() {
    clearProvisional("auth_charging");
  }

  /**
   * Charged lunge begins — play whoosh immediately (no +150ms).
   * Call only when execution actually starts (not deferred/dodging hold).
   */
  function onChargedLungeBegin({ pan = 0 } = {}) {
    const actionId = mintStrikeActionId(actorId, "charged_lunge");
    lungeActionId = actionId;
    const result = orchestrator.playCombatCue(CUE.CHARGED_LUNGE_BEGIN, {
      actorId,
      actionId,
      local: true,
      predicted: true,
      pan,
    });
    pushAudioTrace({
      cue: CUE.CHARGED_LUNGE_BEGIN,
      actorId,
      actionId,
      status: "CHARGED_LUNGE_BEGIN",
      reason: "local_predict",
    });
    return { actionId, handleId: result.handleId || null, playAt: now() };
  }

  /** @deprecated use onChargedLungeBegin — kept so old call sites fail loudly if misused */
  function onChargeRelease(opts = {}) {
    if (opts.dodging) return null;
    return onChargedLungeBegin(opts);
  }

  function onChargeInterrupted(reason = "charge_interrupted") {
    clearProvisional(reason);
    if (lungeActionId) {
      orchestrator.cancelCombatAudioForAction(lungeActionId, reason);
      lungeActionId = null;
    }
  }

  function cancelAction(actionId, reason) {
    if (actionId) orchestrator.cancelCombatAudioForAction(actionId, reason);
    if (provisional?.actionId === actionId) provisional = null;
    if (lungeActionId === actionId) lungeActionId = null;
  }

  function getProvisional() {
    return provisional;
  }

  function getLungeActionId() {
    return lungeActionId;
  }

  return {
    onStrikePress,
    onKeysWhileMouse1Held,
    onChargeStart,
    onAuthoritativeCharging,
    onChargedLungeBegin,
    onChargeRelease,
    onChargeInterrupted,
    cancelAction,
    clearProvisional,
    getProvisional,
    getLungeActionId,
  };
}
