/**
 * Semantic combat-audio orchestrator.
 *
 * Separates cue meaning from samples, timing/authority, action-id dedupe,
 * and per-cue voice policy. Pure scheduling logic — inject clock + playLayers
 * for deterministic tests without AudioContext.
 */

import { CUE_DEFINITIONS, getCueDefinition } from "./cueRegistry.js";
import { pushAudioTrace } from "./audioTrace.js";

let nextHandleId = 1;

function defaultNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * @typedef {object} CueContext
 * @property {string} [actorId]
 * @property {string} [actionId]
 * @property {string} [eventId]
 * @property {boolean} [local]
 * @property {boolean} [predicted]
 * @property {boolean} [authoritative]
 * @property {number} [pan]
 * @property {number} [roundSeq]
 * @property {string} [roomId]
 * @property {string} [reason]
 */

export function createCombatAudioOrchestrator(opts = {}) {
  const nowFn = opts.now || defaultNow;
  const playLayers =
    opts.playLayers ||
    (() => {
      /* no-op adapter */
    });
  const enabled = opts.enabled !== false;

  /** @type {Map<string, object>} */
  const pendingByHandle = new Map();
  /** @type {Map<string, Set<string>>} */
  const pendingByAction = new Map();
  /** @type {Set<string>} */
  const claimedEventIds = new Set();
  /** @type {Map<string, number>} */
  const lastPlayByVoiceKey = new Map();
  /** @type {Map<string, Array<{ handleId: string, startedAt: number, stopAll?: Function, actionId?: string|null }>>} */
  const activeVoices = new Map();
  /** Exact-action active voices for late reconciliation (fade-stop one attempt). */
  /** @type {Map<string, { stopAll: Function, handleId: string, cueName: string, startedAt: number }>} */
  const activeByAction = new Map();
  /** @type {Map<string, string>} */
  const predictedByAction = new Map();
  /** Test/observability: count of real stopAll invocations from voice steal */
  let voiceStops = 0;
  const ACTIVE_ACTION_FADE_MS = 28;
  const ACTIVE_BY_ACTION_MAX = 48;

  let roundToken = 0;

  function voiceKey(cueName, ctx) {
    const actor = ctx.actorId || "global";
    // Per-actor voice keys so P1 cannot suppress P2.
    return `${cueName}:${actor}`;
  }

  function stopVoiceEntry(entry, cueName, ctx, reason) {
    if (!entry) return false;
    if (typeof entry.stopAll === "function") {
      try {
        entry.stopAll(30);
        voiceStops += 1;
        pushAudioTrace({
          cue: cueName,
          actorId: ctx?.actorId,
          status: "SLIDE_REDIRECT_VOICE_STOPPED",
          reason: reason || "voice_steal",
        });
        return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  }

  function claimEvent(eventId) {
    if (!eventId) return true;
    if (claimedEventIds.has(eventId)) return false;
    claimedEventIds.add(eventId);
    if (claimedEventIds.size > 512) {
      // Drop oldest-ish by recreating from recent pending (simple bound).
      const keep = [...claimedEventIds].slice(-256);
      claimedEventIds.clear();
      for (const id of keep) claimedEventIds.add(id);
    }
    return true;
  }

  function trackPending(handle) {
    pendingByHandle.set(handle.id, handle);
    if (handle.actionId) {
      let set = pendingByAction.get(handle.actionId);
      if (!set) {
        set = new Set();
        pendingByAction.set(handle.actionId, set);
      }
      set.add(handle.id);
    }
  }

  function untrackPending(handleId) {
    const handle = pendingByHandle.get(handleId);
    if (!handle) return;
    pendingByHandle.delete(handleId);
    if (handle.actionId) {
      const set = pendingByAction.get(handle.actionId);
      if (set) {
        set.delete(handleId);
        if (set.size === 0) pendingByAction.delete(handle.actionId);
      }
    }
    if (handle.timerId != null && opts.clearTimeout) {
      opts.clearTimeout(handle.timerId);
    } else if (handle.timerId != null) {
      clearTimeout(handle.timerId);
    }
  }

  function cancelHandle(handleId, reason) {
    const handle = pendingByHandle.get(handleId);
    if (!handle) return false;
    untrackPending(handleId);
    pushAudioTrace({
      cue: handle.cueName,
      actorId: handle.ctx.actorId,
      actionId: handle.actionId,
      eventId: handle.ctx.eventId,
      local: !!handle.ctx.local,
      predicted: !!handle.ctx.predicted,
      status: "canceled",
      reason: reason || "cancel",
      requestedAt: handle.requestedAt,
      playAt: handle.playAt,
      roundSeq: handle.roundToken,
    });
    return true;
  }

  function pruneActiveByAction() {
    if (activeByAction.size <= ACTIVE_BY_ACTION_MAX) return;
    const entries = [...activeByAction.entries()].sort(
      (a, b) => a[1].startedAt - b[1].startedAt
    );
    const drop = activeByAction.size - ACTIVE_BY_ACTION_MAX;
    for (let i = 0; i < drop; i += 1) {
      activeByAction.delete(entries[i][0]);
    }
  }

  function registerActiveVoice(vKey, handleId, stopAll, actionId = null, cueName = null) {
    let list = activeVoices.get(vKey);
    if (!list) {
      list = [];
      activeVoices.set(vKey, list);
    }
    list.push({ handleId, startedAt: nowFn(), stopAll, actionId });
    const cutoff = nowFn() - 2000;
    while (list.length && list[0].startedAt < cutoff) list.shift();
    if (actionId && typeof stopAll === "function") {
      activeByAction.set(actionId, {
        stopAll,
        handleId,
        cueName: cueName || "*",
        startedAt: nowFn(),
      });
      pruneActiveByAction();
    }
  }

  function applyVoicePolicy(cueName, ctx) {
    const def = getCueDefinition(cueName);
    if (!def) return { ok: false, reason: "unknown_cue" };
    const vKey = voiceKey(cueName, ctx);
    const last = lastPlayByVoiceKey.get(vKey);
    const t = nowFn();
    if (
      def.minIntervalMs > 0 &&
      last != null &&
      t - last < def.minIntervalMs
    ) {
      return { ok: false, reason: "min_interval", vKey };
    }
    let list = activeVoices.get(vKey) || [];
    const cutoff = t - 2000;
    list = list.filter((v) => v.startedAt >= cutoff);
    activeVoices.set(vKey, list);
    if (list.length >= (def.maxVoices || 4)) {
      if (def.voiceSteal === "oldest") {
        const oldest = list.shift();
        stopVoiceEntry(oldest, cueName, ctx, "oldest");
        activeVoices.set(vKey, list);
        pushAudioTrace({
          cue: cueName,
          actorId: ctx.actorId,
          status: "voice_stolen",
          reason: "oldest",
        });
      } else if (def.voiceSteal === "reject") {
        return { ok: false, reason: "max_voices", vKey };
      }
    }
    return { ok: true, vKey };
  }

  function executePlay(cueName, ctx, meta = {}) {
    const def = getCueDefinition(cueName);
    if (!def) {
      pushAudioTrace({
        cue: cueName,
        status: "rejected",
        reason: "unknown_cue",
        ...ctx,
      });
      return { played: false, reason: "unknown_cue" };
    }
    if (!enabled) {
      pushAudioTrace({
        cue: cueName,
        status: "rejected",
        reason: "disabled",
        actorId: ctx.actorId,
      });
      return { played: false, reason: "disabled" };
    }

    // Event-id / action-id authoritative dedupe (primary correctness).
    if (ctx.eventId && !claimEvent(ctx.eventId)) {
      pushAudioTrace({
        cue: cueName,
        actorId: ctx.actorId,
        eventId: ctx.eventId,
        status: "deduped",
        reason: "event_id",
        local: !!ctx.local,
        predicted: !!ctx.predicted,
        authoritative: !!ctx.authoritative,
      });
      return { played: false, reason: "deduped_event" };
    }

    // Predicted + authoritative reconcile: if we already predicted this action, claim don't replay.
    if (
      ctx.authoritative &&
      ctx.actionId &&
      predictedByAction.has(ctx.actionId)
    ) {
      predictedByAction.delete(ctx.actionId);
      // Cancel any still-pending predicted schedule for this action (already played path).
      cancelCombatAudioForAction(ctx.actionId, "reconciled");
      pushAudioTrace({
        cue: cueName,
        actorId: ctx.actorId,
        actionId: ctx.actionId,
        status: "reconciled",
        reason: "auth_after_predict",
        local: !!ctx.local,
        authoritative: true,
      });
      return { played: false, reason: "reconciled" };
    }

    const policy = applyVoicePolicy(cueName, ctx);
    if (!policy.ok) {
      pushAudioTrace({
        cue: cueName,
        actorId: ctx.actorId,
        actionId: ctx.actionId,
        eventId: ctx.eventId,
        status: policy.reason === "max_voices" ? "voice_stolen" : "rejected",
        reason: policy.reason,
      });
      return { played: false, reason: policy.reason };
    }

    const playAt = meta.playAt != null ? meta.playAt : nowFn();
    lastPlayByVoiceKey.set(policy.vKey, playAt);
    const handleId = `h${nextHandleId++}`;

    if (ctx.predicted && ctx.actionId) {
      predictedByAction.set(ctx.actionId, cueName);
    }

    const layers = def.layers || [];
    const played = playLayers(layers, {
      cueName,
      pan: ctx.pan ?? 0,
      pitchVary: def.pitchVary || 0,
      ctx,
    });
    const stopAll =
      played && typeof played.stopAll === "function" ? played.stopAll : null;
    registerActiveVoice(
      policy.vKey,
      handleId,
      stopAll,
      ctx.actionId || null,
      cueName
    );

    const statusTag =
      cueName === "SLIDE_REDIRECT"
        ? "SLIDE_REDIRECT_PLAYED"
        : cueName === "CLINCH_THROW_RESISTED"
          ? "CLINCH_THROW_RESISTED_PLAYED"
          : cueName === "CLINCH_PERFECT_BRACE"
            ? "CLINCH_PERFECT_BRACE_PLAYED"
            : cueName === "MATADOR_BREAK"
              ? "MATADOR_BREAK_PLAYED"
              : cueName === "CHARGED_LUNGE_BEGIN"
                ? "CHARGED_LUNGE_BEGIN"
                : "played";

    pushAudioTrace({
      cue: cueName,
      actorId: ctx.actorId,
      actionId: ctx.actionId,
      eventId: ctx.eventId,
      local: !!ctx.local,
      predicted: !!ctx.predicted,
      authoritative: !!ctx.authoritative,
      status: statusTag,
      reason: meta.reason || "play",
      requestedAt: meta.requestedAt ?? playAt,
      playAt,
      sample: layers.map((l) => l.sampleKey).join("+"),
      roundSeq: roundToken,
    });

    return { played: true, handleId, vKey: policy.vKey, stopAll };
  }

  function playCombatCue(cueName, context = {}) {
    return executePlay(cueName, context, { reason: "immediate" });
  }

  /**
   * Schedule a cue at an absolute time (preferred) or delay from now.
   * Timing uses the original input seam — callers should pass playAt = inputTs + startupMs
   * rather than adding classification grace on top of startup.
   */
  function scheduleCombatCue(cueName, context = {}, timing = {}) {
    const def = getCueDefinition(cueName);
    if (!def) return { handleId: null, reason: "unknown_cue" };
    if (!enabled) return { handleId: null, reason: "disabled" };

    if (context.eventId && !claimEvent(context.eventId)) {
      pushAudioTrace({
        cue: cueName,
        actorId: context.actorId,
        eventId: context.eventId,
        status: "deduped",
        reason: "event_id_schedule",
      });
      return { handleId: null, reason: "deduped_event" };
    }

    const requestedAt = nowFn();
    let playAt = timing.playAt;
    if (playAt == null) {
      const delay = Math.max(0, timing.delayMs || 0);
      playAt = requestedAt + delay;
    }
    const delayMs = Math.max(0, playAt - requestedAt);
    const handleId = `h${nextHandleId++}`;

    const handle = {
      id: handleId,
      cueName,
      ctx: context,
      actionId: context.actionId || null,
      requestedAt,
      playAt,
      roundToken,
      timerId: null,
    };

    const fire = () => {
      if (!pendingByHandle.has(handleId)) return;
      untrackPending(handleId);
      // Re-claim was already done at schedule for eventId; clear so executePlay
      // doesn't double-dedupe reject. Mark event consumed via side channel.
      const ctx = { ...context };
      if (ctx.eventId) {
        // Already claimed at schedule — skip second claim by clearing.
        delete ctx.eventId;
      }
      executePlay(cueName, ctx, {
        playAt,
        requestedAt,
        reason: "scheduled",
      });
    };

    if (delayMs <= 0) {
      trackPending(handle);
      fire();
      return { handleId, playAt, scheduled: false };
    }

    const setT = opts.setTimeout || setTimeout;
    handle.timerId = setT(fire, delayMs);
    trackPending(handle);

    pushAudioTrace({
      cue: cueName,
      actorId: context.actorId,
      actionId: context.actionId,
      eventId: context.eventId,
      local: !!context.local,
      predicted: !!context.predicted,
      status: "scheduled",
      reason: timing.reason || "schedule",
      requestedAt,
      playAt,
      roundSeq: roundToken,
    });

    return { handleId, playAt, scheduled: true };
  }

  function cancelCombatCue(handleOrId, reason = "cancel") {
    if (!handleOrId) return false;
    const id = typeof handleOrId === "string" ? handleOrId : handleOrId.id;
    return cancelHandle(id, reason);
  }

  function stopActiveCombatAudioForAction(actionId, reason = "action_cancel") {
    if (!actionId) return false;
    const active = activeByAction.get(actionId);
    if (!active) return false;
    if (typeof active.stopAll === "function") {
      try {
        active.stopAll(ACTIVE_ACTION_FADE_MS);
        voiceStops += 1;
      } catch {
        /* ignore adapter errors */
      }
    }
    activeByAction.delete(actionId);
    // Drop matching entries from per-voice lists so counts stay coherent.
    for (const [vKey, list] of activeVoices.entries()) {
      const next = list.filter((v) => v.actionId !== actionId);
      if (next.length) activeVoices.set(vKey, next);
      else activeVoices.delete(vKey);
    }
    pushAudioTrace({
      cue: active.cueName,
      actionId,
      status: "ACTIVE_ACTION_STOPPED",
      reason,
    });
    return true;
  }

  function cancelCombatAudioForAction(actionId, reason = "action_cancel") {
    if (!actionId) return 0;
    let n = 0;
    const set = pendingByAction.get(actionId);
    if (set) {
      const ids = [...set];
      for (const id of ids) {
        if (cancelHandle(id, reason)) n += 1;
      }
    }
    if (stopActiveCombatAudioForAction(actionId, reason)) n += 1;
    predictedByAction.delete(actionId);
    return n;
  }

  function clearCombatAudioForRound(reason = "round_reset") {
    const ids = [...pendingByHandle.keys()];
    for (const id of ids) cancelHandle(id, reason);
    predictedByAction.clear();
    claimedEventIds.clear();
    lastPlayByVoiceKey.clear();
    activeVoices.clear();
    activeByAction.clear();
    roundToken += 1;
    pushAudioTrace({
      cue: "*",
      status: "canceled",
      reason,
      roundSeq: roundToken,
    });
  }

  /**
   * Authoritative confirmation of a predicted cue — cancels pending duplicate
   * schedule and records reconcile without a second audible play when the
   * predicted instance already fired (or is still pending and will fire once).
   *
   * If a predicted schedule is still pending, leave it (it owns the seam).
   * If nothing pending and nothing predicted, play authoritative immediately.
   */
  function confirmCombatCue(cueName, context = {}) {
    const actionId = context.actionId;
    if (actionId && pendingByAction.has(actionId)) {
      pushAudioTrace({
        cue: cueName,
        actorId: context.actorId,
        actionId,
        status: "reconciled",
        reason: "auth_pending_predict_owns",
        authoritative: true,
      });
      if (context.eventId) claimEvent(context.eventId);
      return { played: false, reason: "pending_predict" };
    }
    if (actionId && predictedByAction.has(actionId)) {
      predictedByAction.delete(actionId);
      if (context.eventId) claimEvent(context.eventId);
      pushAudioTrace({
        cue: cueName,
        actorId: context.actorId,
        actionId,
        status: "reconciled",
        reason: "auth_after_predict_played",
        authoritative: true,
      });
      return { played: false, reason: "already_predicted" };
    }
    return playCombatCue(cueName, {
      ...context,
      authoritative: true,
      predicted: false,
    });
  }

  function getPendingCount() {
    return pendingByHandle.size;
  }

  function getVoiceStopCount() {
    return voiceStops;
  }

  function getActiveVoiceCount(cueName, actorId) {
    const list = activeVoices.get(`${cueName}:${actorId || "global"}`) || [];
    return list.length;
  }

  function getDebugState() {
    return {
      pending: pendingByHandle.size,
      claimedEvents: claimedEventIds.size,
      predictedActions: predictedByAction.size,
      activeByAction: activeByAction.size,
      roundToken,
      voiceStops,
      cues: Object.keys(CUE_DEFINITIONS),
    };
  }

  function getActiveActionCount() {
    return activeByAction.size;
  }

  return {
    playCombatCue,
    scheduleCombatCue,
    cancelCombatCue,
    cancelCombatAudioForAction,
    stopActiveCombatAudioForAction,
    clearCombatAudioForRound,
    confirmCombatCue,
    getPendingCount,
    getVoiceStopCount,
    getActiveVoiceCount,
    getActiveActionCount,
    getDebugState,
    claimEvent,
  };
}

/** Process-wide orchestrator for the live client (tests create their own). */
let shared = null;

export function getSharedCombatAudioOrchestrator(opts) {
  if (!shared) {
    shared = createCombatAudioOrchestrator(opts || {});
  }
  return shared;
}

export function resetSharedCombatAudioOrchestrator(opts) {
  if (shared) shared.clearCombatAudioForRound("reset_shared");
  shared = createCombatAudioOrchestrator(opts || {});
  return shared;
}
