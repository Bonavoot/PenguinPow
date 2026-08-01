/**
 * Provisional strike-audio classification aligned with the 50ms command chord
 * window. Charge lunge whoosh is immediate at CHARGED_LUNGE_BEGIN — never
 * release+150ms.
 *
 * All provisional slap/palm cues are owned here with a stable actionId so
 * charge reclass / auth reconcile can cancel by exact attempt — never orphan
 * a standalone schedule outside this lifecycle.
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
  /** @type {null | { actionId: string, inputTs: number, kind: "slap"|"palm", handleId: string|null }} */
  let provisional = null;
  let lungeActionId = null;

  function provisionalCue(kind) {
    return kind === "palm" ? CUE.PALM_WHIFF : CUE.SLAP_WHIFF;
  }

  function clearProvisional(reason) {
    if (!provisional) return false;
    const { actionId, kind } = provisional;
    const cue = provisionalCue(kind);
    if (actionId) {
      orchestrator.cancelCombatAudioForAction(actionId, reason);
    }
    pushAudioTrace({
      cue,
      actorId,
      actionId,
      status: "canceled",
      reason,
      kind,
    });
    provisional = null;
    return true;
  }

  /**
   * Arm provisional audio for a command already selected at the input seam.
   * Prefer this over re-classifying with potentially stale facing.
   */
  function onPredictedStrike({ command, pan = 0, reason = null } = {}) {
    const inputTs = now();

    if (command === "charge_start") {
      clearProvisional("reclass_charge_local");
      pushAudioTrace({
        cue: "*",
        actorId,
        status: "CHARGE_HOLD_BEGIN",
        reason: reason || "reclass_charge_local",
      });
      return { command: "charge_start", actionId: null, inputTs };
    }

    if (command === "palm_thrust") {
      clearProvisional("replace_provisional");
      const actionId = mintStrikeActionId(actorId, "palm");
      const playAt = inputTs + SWING_STARTUP_MS.palm;
      const scheduleReason = reason || "palm_predict";
      const { handleId } = orchestrator.scheduleCombatCue(
        CUE.PALM_WHIFF,
        {
          actorId,
          actionId,
          local: true,
          predicted: true,
          pan,
        },
        { playAt, reason: scheduleReason }
      );
      provisional = { actionId, inputTs, kind: "palm", handleId };
      pushAudioTrace({
        cue: CUE.PALM_WHIFF,
        actorId,
        actionId,
        status: "scheduled",
        reason: scheduleReason,
        playAt,
      });
      return { command: "palm_thrust", actionId, inputTs };
    }

    // slap (default)
    clearProvisional("replace_provisional");
    const actionId = mintStrikeActionId(actorId, "slap");
    const playAt = inputTs + SWING_STARTUP_MS.slap;
    const scheduleReason = reason || "provisional_slap";
    const { handleId } = orchestrator.scheduleCombatCue(
      CUE.SLAP_WHIFF,
      {
        actorId,
        actionId,
        local: true,
        predicted: true,
        pan,
      },
      { playAt, reason: scheduleReason }
    );
    provisional = { actionId, inputTs, kind: "slap", handleId };
    pushAudioTrace({
      cue: CUE.SLAP_WHIFF,
      actorId,
      actionId,
      status: "scheduled",
      reason: scheduleReason,
      playAt,
    });
    return { command: "slap", actionId, inputTs };
  }

  function onStrikePress({ keys, facing, pan = 0 }) {
    const classified = classifyMouse1Strike(keys, facing);
    return onPredictedStrike({
      command: classified.command,
      pan,
      reason:
        classified.command === "palm_thrust"
          ? "palm_predict"
          : classified.command === "charge_start"
            ? "immediate_chord"
            : "provisional_slap",
    });
  }

  function onKeysWhileMouse1Held({ keys, facing }) {
    if (!provisional) return null;
    if (provisional.kind !== "slap" && provisional.kind !== "palm") return null;
    const age = now() - provisional.inputTs;
    if (age > STRIKE_CHORD_MS) return null;
    const classified = classifyMouse1Strike(keys, facing);
    if (classified.command !== "charge_start") return null;
    clearProvisional("reclass_charge_local");
    pushAudioTrace({
      cue: "*",
      actorId,
      status: "CHARGE_HOLD_BEGIN",
      reason: "chord_window",
    });
    return { command: "charge_start", actionId: null };
  }

  function onChargeStart() {
    clearProvisional("reclass_charge_local");
    pushAudioTrace({
      cue: "*",
      actorId,
      status: "CHARGE_HOLD_BEGIN",
      reason: "reclass_charge_local",
    });
  }

  function onAuthoritativeCharging() {
    clearProvisional("auth_charge_reconcile");
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

  /** Drop ownership without canceling — auth confirm / seam already owns the cue. */
  function releaseProvisional() {
    provisional = null;
  }

  function getLungeActionId() {
    return lungeActionId;
  }

  return {
    onStrikePress,
    onPredictedStrike,
    onKeysWhileMouse1Held,
    onChargeStart,
    onAuthoritativeCharging,
    onChargedLungeBegin,
    onChargeRelease,
    onChargeInterrupted,
    cancelAction,
    clearProvisional,
    releaseProvisional,
    getProvisional,
    getLungeActionId,
  };
}
