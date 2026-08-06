const { MASTERY_P1_MOMENTUM } = require("./masteryFlags");
const {
  isActionFacingOwnershipV2Enabled,
  acquireActionFacingLock,
  releaseActionFacingLock,
  mintActionFacingInstanceId,
  ACTION_FACING_OWNER,
  ACTION_FACING_REASON,
  ACTION_FACING_RELEASE,
} = require("./actionFacingOwnership");

const {
  GRAB_PUSH_BURST_BASE, GRAB_PUSH_MOMENTUM_TRANSFER,
  GRAB_PUSH_MOMENTUM_TRANSFER_MASTERY,
  GRAB_PUSH_DECAY_RATE, GRAB_PUSH_MIN_VELOCITY,
  ARM_CLAMP_BURST_MULT, ARM_CLAMP_BURST_DECAY_RATE,
  ARM_CLAMP_BURST_END_VELOCITY, ARM_CLAMP_MAX_BURST_MS,
  GRAB_PUSH_STAMINA_DRAIN_INTERVAL, GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL,
  GRAB_STAMINA_DRAIN_INTERVAL,
  RINGOUT_PUSH_DURATION_MS,
  RINGOUT_PUSH_DISTANCE,
  RINGOUT_PUSH_IDLE_DELAY_MS,
  RINGOUT_PUSH_SEPARATE_DELAY_MS,
  RINGOUT_PUSH_DEFEAT_DELAY_MS,
  BALANCE_MAX,
  CLINCH_PUSH_BASE_SPEED,
  CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC,
  CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC,
  CLINCH_PUSH_VS_PLANT_SPEED_MULT,
  CLINCH_PLANT_BALANCE_REGEN_PER_SEC,
  CLINCH_PLANT_STAMINA_DRAIN_INTERVAL,
  CLINCH_NEUTRAL_STAMINA_REGEN_PER_SEC,
  CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL,
  CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL,
  CLINCH_PUSH_VS_PUSH_DEADZONE,
  CLINCH_PUSH_VS_PUSH_SOFT_MAX_DIFF,
  CLINCH_PUSH_VS_PUSH_MIN_SPEED,
  CLINCH_PUSH_VS_PUSH_MAX_SPEED,
  CLINCH_PUSH_VS_PUSH_LOSER_BAL_DRAIN_PER_SEC,
  CLINCH_PUSH_VS_PUSH_LOSER_STAM_DRAIN_PER_SEC,
  CLINCH_PUSH_SELF_STAMINA_DRAIN_INTERVAL,
  CLINCH_EDGE_PIN_HOLD_MS,
  CLINCH_EDGE_PIN_OPEN_HOLD_MS,
  CLINCH_PUSH_RAMP_DELAY_MS,
  CLINCH_PUSH_RAMP_RISE_MS,
  CLINCH_PUSH_RAMP_MAX_MULT,
  CLINCH_MAX_SHOVE_SPEED,
  CLINCH_GASSED_PUSH_MULT,
  CLINCH_STALEMATE_DURATION_MS,
  CLINCH_STALEMATE_MOVEMENT_THRESHOLD,
  CLINCH_STALEMATE_BALANCE_THRESHOLD,
  CLINCH_ATTACHED_DISTANCE,
  CLINCH_ATTACH_LERP_PER_SEC,
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_THROW_STAMINA_COST,
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_REQUEST_PUSH_CAP_MULT,
  CLINCH_THROW_BALANCE_DRAIN_VS_PUSH,
  CLINCH_THROW_BALANCE_DRAIN_VS_PLANT,
  CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL,
  CLINCH_THROW_FAIL_BALANCE_DRAIN,
  CLINCH_THROW_FAIL_SELF_BALANCE_DRAIN,
  CLINCH_THROW_FAIL_STAMINA_COST,
  CLINCH_PULL_BALANCE_DRAIN_VS_PUSH,
  CLINCH_PULL_BALANCE_DRAIN_VS_PLANT,
  CLINCH_PULL_BALANCE_DRAIN_VS_NEUTRAL,
  CLINCH_PULL_FAIL_SELF_BALANCE_DRAIN,
  CLINCH_LIGHT_DRIVE_MS,
  CLINCH_LIGHT_DRIVE_SPEED_MULT,
  CLINCH_OPEN_PUNISH_RAMP_FLOOR,
  CLINCH_OPEN_PUNISH_EASE_MS,
  CLINCH_DRIVE_PLANT_CANCEL_MS,
  CLINCH_PUSH_LOSS_OPEN_T,
  CLINCH_PUSH_LOSS_OPEN_MS,
  CLINCH_PUSH_LOSS_OPEN_DURATION_MS,
  CLINCH_PERFECT_BRACE_OPEN_MS,
  CLINCH_PERFECT_BRACE_HITSTOP_MS,
  CLINCH_THROW_RESISTED_HITSTOP_MS,
  CLINCH_PERFECT_BRACE_FLASH_MS,
  CLINCH_BRACE_IMPACT_SLACK_MS,
  CLINCH_BRACE_LATCH_MS,
  CLINCH_BRACE_ACTIVE_MS,
  CLINCH_BRACE_SETTLE_MS,
  CLINCH_BRACE_ATTEMPT_STAMINA_COST,
  CLINCH_OPEN_TUMBLE_MS,
  CLINCH_OPEN_JOLT_INTO_DRIVE_MS,
  CLINCH_TUMBLE_STAMINA_COST,
  CLINCH_TUMBLE_BALANCE_DRAIN,
  CLINCH_THROW_DISTANCE_MIN,
  CLINCH_THROW_DISTANCE_MAX,
  CLINCH_THROW_ARC_HEIGHT_MIN,
  CLINCH_THROW_ARC_HEIGHT_MAX,
  CLINCH_THROW_DURATION_MIN_MS,
  CLINCH_THROW_DURATION_MAX_MS,
  CLINCH_PULL_DISTANCE_MIN,
  CLINCH_PULL_DISTANCE_MAX,
  CLINCH_EDGE_ZONE_THRESHOLD,
  CLINCH_EDGE_BALANCE_DRAIN_MULT,
  CLINCH_EDGE_THROW_DRAIN_BONUS,
  CLINCH_EDGE_PULL_DRAIN_BONUS,
  CLINCH_THROW_KILL_THRESHOLD,
  CLINCH_CLASH_ANIMATION_MS,
  CLINCH_PULL_ANIMATION_MS,
  CLINCH_DEEP_GRIP_THROW_ANIMATION_MS,
  CLINCH_DEEP_GRIP_PULL_ANIMATION_MS,
  CLINCH_PULL_DISTANCE,
  CLINCH_PULL_TWEEN_DURATION,
  CLINCH_PULL_INPUT_LOCK_MS,
  HITSTOP_THROW_MS,
  speedFactor,
  CLINCH_KILL_THROW_DURATION_MS,
  CLINCH_KILL_PULL_DISTANCE,
  CLINCH_KILL_PULL_TWEEN_DURATION,
  CLINCH_KILL_PULL_INPUT_LOCK_MS,
  CLINCH_JOLT_ANIMATION_MS,
  CLINCH_JOLT_RECOVERY_MS,
  CLINCH_JOLT_STAMINA_COST,
  CLINCH_JOLT_BALANCE_VS_PLANT,
  CLINCH_JOLT_BALANCE_VS_NEUTRAL,
  CLINCH_JOLT_BALANCE_VS_PUSH,
  CLINCH_JOLT_PUSH_VS_PLANT,
  CLINCH_JOLT_PUSH_VS_NEUTRAL,
  CLINCH_JOLT_PUSH_VS_PUSH,
  CLINCH_JOLT_MUTUAL_BALANCE,
  CLINCH_JOLT_CLASH_WINDOW_MS,
  CLINCH_JOLT_HITSTOP_MS,
  CLINCH_JOLT_MUTUAL_HITSTOP_MS,
  CLINCH_JOLT_PLANT_INTERRUPT_MS,
  CLINCH_JOLT_RECOIL_MS,
  CLINCH_JOLT_GASSED_MULT,
  CLINCH_JOLT_LOCKOUT_VS_PLANT,
  CLINCH_JOLT_LOCKOUT_VS_NEUTRAL,
  CLINCH_JOLT_LOCKOUT_VS_PUSH,
  CLINCH_JOLT_SELF_BALANCE_VS_PUSH,
  PULL_BOUNDARY_MARGIN,
  CLINCH_THROW_BOUNDARY_MARGIN,
  CLINCH_THROW_MIN_SEPARATION,
  CLINCH_PULL_SWAP_TWEEN_DURATION,
  CLINCH_PUSH_STAMINA_FLOOR,
  CLINCH_THROW_FAIL_STAGGER_MS,
  DEEP_GRIP_PUSH_MULT,
  DEEP_GRIP_PUSH_WIN_MS,
  GRAB_BREAK_STAMINA_COST,
  GRAB_BREAK_FORCED_DISTANCE,
  GRAB_BREAK_TWEEN_DURATION,
  GRAB_BREAK_INPUT_LOCK_MS,
  GRAB_BREAK_GRAB_IMMUNITY_MS,
  GRAB_BREAK_REACTION_LOCK_MS,
  GROUND_LEVEL,
} = require("./constants");

const {
  setPlayerTimeout,
  simNow,
  clearAllActionStates,
  triggerHitstop,
  triggerHitstopAndEmit,
  emitThrottledScreenShake,
  emitStaminaBlocked,
  tryEnterGassed,
  timeoutManager,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");

const { correctFacingAfterGrabOrThrow, executeClinchSeparation } = require("./grabMechanics");
const { cleanupGrabStates, handleWinCondition } = require("./gameFunctions");
const {
  CLINCH_INTERACTION,
  CLINCH_EFFECT_MID_Y,
  CLINCH_GRIP_CONTACT_Y,
  ensureClinchInstanceId,
  buildClinchPresentation,
  attachCombatPresentation,
} = require("./combatPresentationEvent");

// Continuous fatigue: push force lerps from 1.0 (full stamina) to the floor
// (0 stamina). Gassed overrides with the hard cliff — the arc is
// 100 stamina → floor → gassed cliff → partial recovery.
function getPushForceMult(player) {
  const deepGripMult = player.hasDeepGrip ? DEEP_GRIP_PUSH_MULT : 1;
  if (player.isGassed) return CLINCH_GASSED_PUSH_MULT * deepGripMult;
  const staminaRatio = Math.max(0, Math.min(100, player.stamina)) / 100;
  return (CLINCH_PUSH_STAMINA_FLOOR + (1 - CLINCH_PUSH_STAMINA_FLOOR) * staminaRatio) * deepGripMult;
}

// Momentum ramp multiplier for an unanswered push. 1.0 until the delay
// elapses, then linear up to the max over the rise window. The timer
// (clinchPushRampStart) is maintained in the movement section each tick.
// `floorMult` pre-matures the ramp without touching clinchPushRampStart, so an
// Open-punish shove can start strong while ordinary ramp timing stays honest.
function getPushRampMult(player, now, floorMult = 1) {
  let mult = 1;
  if (player.clinchPushRampStart) {
    const held = now - player.clinchPushRampStart;
    if (held > CLINCH_PUSH_RAMP_DELAY_MS) {
      const t = Math.min(
        1,
        (held - CLINCH_PUSH_RAMP_DELAY_MS) / CLINCH_PUSH_RAMP_RISE_MS
      );
      mult = 1 + (CLINCH_PUSH_RAMP_MAX_MULT - 1) * t;
    }
  }
  return Math.max(mult, floorMult);
}

// Ordinary shove multiplier: Light Drive tax, plant braking, or committed ramp.
function getOrdinaryShoveMult(pusher, targetAction, now) {
  if (!pusher.isClinchCommittedDrive) {
    let mult = CLINCH_LIGHT_DRIVE_SPEED_MULT;
    if (targetAction === "plant") mult *= CLINCH_PUSH_VS_PLANT_SPEED_MULT;
    return mult;
  }
  if (targetAction === "plant") return CLINCH_PUSH_VS_PLANT_SPEED_MULT;
  return getPushRampMult(pusher, now);
}

// Eased 0→1 weighting for the Open-punish shove. A plain boolean would step the
// velocity on the tick Open begins and ends; this ramps over
// CLINCH_OPEN_PUNISH_EASE_MS in both directions. Delta-driven, so it stays
// deterministic and tick-rate independent.
function updateOpenPunishBlend(pusher, target, pusherAction, deltaMs) {
  const want = pusherAction === "push" && isClinchOpen(target) ? 1 : 0;
  const current = pusher.clinchOpenPunishBlend || 0;
  const step =
    CLINCH_OPEN_PUNISH_EASE_MS > 0
      ? Math.max(0, deltaMs) / CLINCH_OPEN_PUNISH_EASE_MS
      : 1;
  const next =
    want > current
      ? Math.min(want, current + step)
      : Math.max(want, current - step);
  pusher.clinchOpenPunishBlend = next;
  return next;
}

// Full shove multiplier. Shared by both push directions so they cannot drift.
// Shove speed is normally a contest and Light Drive is the price of entering it;
// an Open opponent contests nothing, so the punish shove skips that tax and
// starts the ramp pre-matured. It never DOWNGRADES an already-stronger ramp.
function getShoveMult(pusher, target, targetAction, now) {
  const ordinary = getOrdinaryShoveMult(pusher, targetAction, now);
  const blend = pusher.clinchOpenPunishBlend || 0;
  if (blend <= 0) return ordinary;
  const punish = Math.max(
    ordinary,
    getPushRampMult(pusher, now, CLINCH_OPEN_PUNISH_RAMP_FLOOR)
  );
  return ordinary + (punish - ordinary) * blend;
}

// Hard ceiling for every shove, applied where speed becomes displacement so no
// path can bypass it. Sign-preserving: both push directions clamp identically.
// The tuned clinch paths all sit under CLINCH_MAX_SHOVE_SPEED, so this only bites
// on the grab burst, whose momentum term has no bound of its own.
function clampShoveSpeed(speed) {
  if (!Number.isFinite(speed)) return 0;
  if (speed > CLINCH_MAX_SHOVE_SPEED) return CLINCH_MAX_SHOVE_SPEED;
  if (speed < -CLINCH_MAX_SHOVE_SPEED) return -CLINCH_MAX_SHOVE_SPEED;
  return speed;
}

// Push-war shove power = stamina tank (× deep grip / gassed). Balance is NOT
// in this contest — it's the throw meter. Equal stamina ⇒ standstill.
function getShovePower(player) {
  const stam = Math.max(0, Math.min(100, player.stamina || 0));
  const deep = player.hasDeepGrip ? DEEP_GRIP_PUSH_MULT : 1;
  if (player.isGassed) return stam * CLINCH_GASSED_PUSH_MULT * deep;
  return stam * deep;
}

// Push-vs-push speed from shove-power difference. Returns { speed, t } where t
// is advantage intensity in [0,1] (loser balance pressure). Deadzone → ease-out
// from MIN_SPEED up to MAX_SPEED. Sign: positive = grabber winning.
function getPushVsPushSpeed(powerDiff) {
  const abs = Math.abs(powerDiff);
  if (abs <= CLINCH_PUSH_VS_PUSH_DEADZONE) {
    return { speed: 0, t: 0 };
  }
  const span = Math.max(1, CLINCH_PUSH_VS_PUSH_SOFT_MAX_DIFF - CLINCH_PUSH_VS_PUSH_DEADZONE);
  let t = Math.min(1, (abs - CLINCH_PUSH_VS_PUSH_DEADZONE) / span);
  // Ease-out quadratic: modest leads punch above linear, extremes compress into the cap.
  t = 1 - (1 - t) * (1 - t);
  const mag =
    CLINCH_PUSH_VS_PUSH_MIN_SPEED +
    (CLINCH_PUSH_VS_PUSH_MAX_SPEED - CLINCH_PUSH_VS_PUSH_MIN_SPEED) * t;
  return { speed: Math.sign(powerDiff) * mag, t };
}

// DEEP GRIP — grant the earned-advantage state. Exclusive: taking it strips
// the opponent's. Emits the callout event so the client can announce it.
function grantDeepGrip(holder, other, room, io, source) {
  if (holder.hasDeepGrip) return;
  holder.hasDeepGrip = true;
  other.hasDeepGrip = false;
  other.deepGripPushStart = 0;
  const gripId = `deep-grip-${simNow(room)}-${holder.id}`;
  const clinchId = ensureClinchInstanceId(holder, other, simNow(room));
  io.in(room.id).emit(
    "deep_grip",
    attachCombatPresentation(
      {
        playerId: holder.id,
        playerNumber: room.players.indexOf(holder) === 0 ? 1 : 2,
        source,
        gripId,
      },
      buildClinchPresentation({
        interactionType: CLINCH_INTERACTION.DEEP_GRIP,
        clinchInstanceId: clinchId,
        actionInstanceId: gripId,
        initiator: holder,
        responder: other,
        outcome: "GRANTED",
        gripState: "deep",
        contactX: holder.x,
        contactY: CLINCH_EFFECT_MID_Y,
        salt: source || "deep_grip",
      })
    )
  );
}

// OPEN — punishable vulnerability. Blocks clinch offense / stance until clear.
// Client shows stun stars while Open / jolt recovery — except mutual throw/pull
// tumble (`hideStars`), where separation already sells the lockout.
// `stumble` adds the fail-stagger pose (resisted techniques / tumble).
function applyClinchOpen(player, durationMs, room, options = {}) {
  if (!player || durationMs <= 0) return;
  const stumble = options.stumble !== false;
  const now = room ? simNow(room) : Date.now();
  player.isClinchOpen = true;
  player.clinchOpenHideStars = !!options.hideStars;
  if (stumble) player.clinchThrowFailStagger = true;
  player.clinchOpenUntil = now + durationMs;
  player.clinchAction = "neutral";
  player.isClinchPushing = false;
  player.isClinchPlanting = false;
  // Open must be a real turn loss: void buffered offense and the chord windows
  // that feed it, so nothing auto-fires the instant Open expires. Holding or
  // re-buffering Throw/Pull through the recovery cannot skip it.
  player.clinchThrowRequest = null;
  player.clinchThrowRequestTime = 0;
  player.clinchMouse2BufferTime = 0;
  player.clinchWTapTime = 0;
  player.clinchAwayTapTime = 0;
  player.clinchJoltRequest = false;
  player.clinchJoltRequestTime = 0;
  player.clinchBreakRequest = false;
  player.clinchBreakRequestTime = 0;
  // Defensive state dies with the turn too. The socket layer already refuses to
  // stamp a Plant activation while Open, but any stamp taken just BEFORE Open
  // must not survive either: Open means "no stance, no read, no arm", so there is
  // nothing left for the opponent's punish technique to be measured against.
  player.clinchBraceArmedTechnique = null;
  player.clinchBraceSimTime = 0;
  player.clinchBraceLatchUntil = 0;
  player.clinchBracePressGameTime = 0;
  // Eating a 550–650ms recovery is punishment enough; do not also leave them
  // mid-settle. They still need a genuine post-Open edge to attempt again.
  clearBraceAttempt(player);
  timeoutManager.clearPlayerSpecific(player.id, "clinchThrowFailStagger");
  setPlayerTimeout(player.id, () => {
    player.clinchThrowFailStagger = false;
    player.isClinchOpen = false;
    player.clinchOpenUntil = 0;
    player.clinchOpenHideStars = false;
  }, durationMs, "clinchThrowFailStagger");
}

function isClinchOpen(player) {
  return !!(player && (player.isClinchOpen || player.clinchThrowFailStagger));
}

function isInEdgeZone(playerX) {
  return playerX <= MAP_LEFT_BOUNDARY + CLINCH_EDGE_ZONE_THRESHOLD ||
         playerX >= MAP_RIGHT_BOUNDARY - CLINCH_EDGE_ZONE_THRESHOLD;
}

function clearEdgePinHold(...players) {
  for (const p of players) {
    if (p) p.clinchEdgePinHeldMs = 0;
  }
}

// Edge pin ring-out while actively driving someone into the boundary:
//   • Gassed / empty tank → through immediately (nothing left to hold with)
//   • Open              → reduced hold, CLINCH_EDGE_PIN_OPEN_HOLD_MS
//   • Otherwise         → full hold, CLINCH_EDGE_PIN_HOLD_MS
// The hold is ACCUMULATED drive time, advanced by deltaMs on each tick where the
// pusher is genuinely driving the victim into the wall. It is only reset by
// clearEdgePinHold — i.e. by the victim leaving the boundary or the pusher easing
// off — never by an input.
//
// It used to be `now - clinchEdgePinStart`, which broke in both directions: a
// technique in startup returns before the movement section, so the stamp kept
// accruing wall time the pusher had not earned; and a mere technique REQUEST
// wiped the stamp outright (see the isGrabPushing/eitherThrowRequest cancel), so
// a cornered player could hold the tawara indefinitely by mashing throw. That
// stall is the reason Open was originally made an instant force-out.
// Returns true if a ring-out fired.
function tryEdgePinRingOut(pusher, victim, room, io, rooms, dir, deltaMs) {
  if (victim.stamina <= 0 || !!victim.isGassed) {
    clearEdgePinHold(victim);
    triggerRingOut(pusher, victim, room, io, rooms, dir);
    return true;
  }

  const required = isClinchOpen(victim)
    ? CLINCH_EDGE_PIN_OPEN_HOLD_MS
    : CLINCH_EDGE_PIN_HOLD_MS;

  const step = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
  victim.clinchEdgePinHeldMs = (victim.clinchEdgePinHeldMs || 0) + step;

  if (victim.clinchEdgePinHeldMs >= required) {
    clearEdgePinHold(victim);
    triggerRingOut(pusher, victim, room, io, rooms, dir);
    return true;
  }
  return false;
}

// Committed Drive → Plant cancel lock. Raw Plant input is only a request;
// Plant is not active until now >= clinchDrivePlantCancelUntil.
// When `now` is omitted, fail closed (treat as still transitioning) so defense
// never reads raw intent as active Plant mid-cancel.
function isDrivePlantCancelPending(player, now) {
  const until = player.clinchDrivePlantCancelUntil || 0;
  if (!until) return false;
  if (now == null || !Number.isFinite(now)) return true;
  return now < until;
}

function getClinchAction(player, opponent, now = null) {
  if (!player.hasGrip) return "neutral";
  // Open / jolt recovery: visible vulnerability — no push or plant until clear.
  if (player.clinchJoltRecovery || player.isClinchOpen || player.clinchThrowFailStagger) {
    return "neutral";
  }
  const plantIntent = getPlantIntent(player, opponent);
  // Committed Drive → Plant cancel has a short transition (not instant).
  if (plantIntent && isDrivePlantCancelPending(player, now)) {
    return "neutral";
  }
  if (plantIntent) return "plant";

  const towardKey = player.x < opponent.x ? 'd' : 'a';
  const pressingToward = player.keys[towardKey] && !player.keys[player.x < opponent.x ? 'a' : 'd'];
  if (pressingToward) return "push";
  return "neutral";
}

// Authoritative Plant for technique defense / visuals (not raw keys).
function isActivelyPlanting(player, opponent, now) {
  return getClinchAction(player, opponent, now) === "plant";
}

// Balance-scaled non-kill technique distance (P2).
function scaledClinchTechniqueDistance(balance, minDist, maxDist) {
  const bal = Math.max(
    CLINCH_THROW_KILL_THRESHOLD,
    Math.min(BALANCE_MAX, typeof balance === "number" ? balance : BALANCE_MAX)
  );
  const span = Math.max(1, BALANCE_MAX - CLINCH_THROW_KILL_THRESHOLD);
  const t = 1 - (bal - CLINCH_THROW_KILL_THRESHOLD) / span; // 0 at full, 1 at kill
  return Math.round(minDist + (maxDist - minDist) * Math.max(0, Math.min(1, t)));
}

// ── BRACE ATTEMPT CYCLE ─────────────────────────────────────────────────────
// One deliberate Back/S press = ONE attempt, shaped like this codebase's neutral
// parry (active window, then recovery, with the cost refunded on a correct read):
//
//   ACTIVE  (CLINCH_BRACE_ACTIVE_MS)  can arm Perfect Brace
//   SETTLE  (CLINCH_BRACE_SETTLE_MS)  weight resetting — no new attempt
//   READY                              a genuinely new edge may attempt again
//
// ACTIVE deliberately exceeds the longest startup + impact slack, so ANY press
// landing inside a visible startup is guaranteed to still be active at impact.
// The window therefore never invalidates a legitimate reaction; its job is to
// give the cycle a real length so mashing spends most of its time in SETTLE.
//
// Held Plant stays a passive stance the whole time (isActivelyPlanting reads
// intent, not this cycle), so a defender caught mid-SETTLE still resists a raw
// technique — but cannot produce the active read that Deep Grip demands.
function braceCyclePhase(player, now) {
  const start = player.clinchBraceAttemptStart || 0;
  if (!start) return "ready";
  const elapsed = now - start;
  if (elapsed < 0) return "ready";
  if (elapsed < CLINCH_BRACE_ACTIVE_MS) return "active";
  if (elapsed < CLINCH_BRACE_ACTIVE_MS + CLINCH_BRACE_SETTLE_MS) return "settle";
  return "ready";
}

function isBraceReady(player, now) {
  return braceCyclePhase(player, now) === "ready";
}

// Begin one attempt. Returns false when Brace is not READY — in which case the
// edge is completely inert: it does not arm, is not queued for when the cycle
// ends, and must not restart, extend, or shorten the cycle in progress.
function beginBraceAttempt(player, now) {
  if (!player || !isBraceReady(player, now)) return false;
  player.clinchBraceAttemptStart = now;
  player.clinchBraceAttemptRefunded = false;
  // The real anti-spam: stamina IS shove power in the clinch, so fishing visibly
  // weakens your own drive. Refunded below when the read was correct.
  player.stamina = Math.max(
    0,
    (player.stamina || 0) - CLINCH_BRACE_ATTEMPT_STAMINA_COST
  );
  return true;
}

// A correct read is free — only fishing costs anything.
function refundBraceAttempt(player) {
  if (!player || !player.clinchBraceAttemptStart) return;
  if (player.clinchBraceAttemptRefunded) return;
  player.clinchBraceAttemptRefunded = true;
  player.stamina = Math.min(
    100,
    (player.stamina || 0) + CLINCH_BRACE_ATTEMPT_STAMINA_COST
  );
}

function clearBraceAttempt(player) {
  if (!player) return;
  player.clinchBraceAttemptStart = 0;
  player.clinchBraceAttemptRefunded = false;
  player.clinchBracePhase = null;
}

// Presentation mirror of the cycle. Higher-priority combat poses (throw, jolt,
// Open, clash, tech) own the body when they are active, so this is only ever the
// quiet stance layer — see the pose priority chain in fighterStyledComponents.
function updateBracePosePhase(player, now) {
  if (!player) return;
  // Open owns the body and the rules: no attempt may be in flight, so the cycle
  // is invalidated here rather than only at the applyClinchOpen entry point. A
  // staggered player therefore always leaves Open with a fresh cycle instead of
  // an inherited lockout, and cannot bank an attempt across the stagger.
  if (player.isClinchOpen || player.clinchThrowFailStagger) {
    clearBraceAttempt(player);
    return;
  }
  const phase = braceCyclePhase(player, now);
  player.clinchBracePhase = phase === "ready" ? null : phase;
}

// Plant activation clock for Perfect Brace. Drive→Plant cancel defers
// clinchBraceSimTime to clinchDrivePlantCancelUntil; if a raw re-press
// overwrites the stamp early, still prefer the cancel completion time.
function getPlantActivationTime(target) {
  const brace = target.clinchBraceSimTime || 0;
  const until = target.clinchDrivePlantCancelUntil || 0;
  if (until && (!brace || brace < until)) return until;
  return brace;
}

// SINGLE SOURCE OF TRUTH for a live technique's startup length.
//
// Read from the snapshot taken at commit (clinchThrowUsedDeepGrip), never from
// mutable Deep Grip ownership: the grip is consumed on the same tick the
// technique commits, and a Perfect Brace hands it to the defender mid-startup,
// so recomputing it later would silently change the length of a technique that
// is already in the air. Server impact, the Brace window, and the duration
// broadcast to the client all resolve through here, so they cannot disagree.
//
// The Deep Grip values are currently equal to the ordinary ones — the plumbing
// is in place so that giving Deep Grip a faster tell is a one-constant change
// rather than a hunt through every consumer.
function selectTechniqueAnimationMs(type, usedDeepGrip) {
  const isPull = type === "pull";
  if (usedDeepGrip) {
    return isPull
      ? CLINCH_DEEP_GRIP_PULL_ANIMATION_MS
      : CLINCH_DEEP_GRIP_THROW_ANIMATION_MS;
  }
  return isPull ? CLINCH_PULL_ANIMATION_MS : CLINCH_THROW_ANIMATION_MS;
}

function getTechniqueAnimationMs(actor) {
  if (!actor) return CLINCH_THROW_ANIMATION_MS;
  // Prefer the value stamped at commit — that is the number broadcast to the
  // client, so reading it back guarantees server and presentation agree even if
  // the snapshot fields are cleared during resolution.
  if (Number.isFinite(actor.clinchThrowAnimMs) && actor.clinchThrowAnimMs > 0) {
    return actor.clinchThrowAnimMs;
  }
  return selectTechniqueAnimationMs(
    actor.clinchThrowType,
    !!actor.clinchThrowUsedDeepGrip
  );
}

// One authoritative reaction window per technique: clinchThrowStartTime is the
// tick the tell becomes visible (commitTechnique sets isClinchThrowing /
// isAttemptingGrabThrow / isAttemptingPull on the same tick, and those are what
// the client animates). The buffered request time is deliberately NOT used — it
// is invisible to the defender.
function getTechniqueBraceWindow(actor, animDuration) {
  if (!Number.isFinite(actor?.clinchThrowStartTime)) return null;
  const start = actor.clinchThrowStartTime;
  return {
    start,
    impact: start + animDuration,
    end: start + animDuration + CLINCH_BRACE_IMPACT_SLACK_MS,
  };
}

// FRESH Brace = a Plant activation that happened in response to *this* tell.
// Activation strictly before the tell is a prediction (passive Plant); at or
// after it is an active response, whether it lands on the first, middle, or last
// frame of startup. clinchBraceSimTime / cancelUntil encode Plant *activation*
// time (not raw press when cancelling Committed Drive).
function isFreshBraceActivation(actor, target, animDuration) {
  const braceTime = getPlantActivationTime(target);
  if (!braceTime) return false;
  const win = getTechniqueBraceWindow(actor, animDuration);
  if (!win) return false;
  if (braceTime < win.start || braceTime > win.end) return false;
  // A Committed Drive → Plant cancel that has not completed by impact was still
  // a Drive when the technique landed. The impact slack covers input-arrival
  // granularity, not finishing a pending stance change.
  if (isDrivePlantCancelPending(target, win.impact)) return false;
  return true;
}

// Identity of the specific technique a Brace response is armed against, so an
// arm can never leak into the next exchange.
function techniqueBraceKey(actor) {
  return `${actor.id}:${actor.clinchThrowStartTime || 0}`;
}

// A fresh Brace stays armed until impact. It is lost only when the defender
// clearly stops bracing under the existing rules: interrupted (Open / jolt /
// grip lost) or cancelled into an unambiguous Drive commitment. Simply
// releasing the key does NOT drop it — that is the dead zone the generic
// CLINCH_BRACE_LATCH_MS grace used to create when startup outlived the latch.
function isBraceArmBroken(target, actor) {
  if (!target.hasGrip) return true;
  if (target.isClinchOpen || target.clinchThrowFailStagger) return true;
  if (
    target.clinchJoltRecovery ||
    target.isClinchJolting ||
    target.isBeingClinchJolted
  ) {
    return true;
  }
  const towardKey = target.x < actor.x ? "d" : "a";
  const awayKey = target.x < actor.x ? "a" : "d";
  const keys = target.keys || {};
  // Unambiguous toward = Drive commitment. toward+away cancel to neutral, which
  // is a release, not a cancel.
  return !!(keys[towardKey] && !keys[awayKey]);
}

// Clearing the activation stamp is what makes a cancel stick: re-arming then
// requires a genuinely new Plant edge, not the stale stamp of the abandoned one.
function disarmTechniqueBrace(target) {
  target.clinchBraceArmedTechnique = null;
  target.clinchBraceSimTime = 0;
}

// Run every tick of a live technique AND once more at impact, so no in-window
// press can slip between the last startup tick and the resolve tick.
function updateTechniqueBraceArm(actor, target, animDuration) {
  if (!actor || !target || !actor.clinchThrowActive) return;
  const key = techniqueBraceKey(actor);
  const armed = target.clinchBraceArmedTechnique === key;
  if (isBraceArmBroken(target, actor)) {
    if (armed) disarmTechniqueBrace(target);
    return;
  }
  if (armed) return;
  if (isFreshBraceActivation(actor, target, animDuration)) {
    target.clinchBraceArmedTechnique = key;
  }
}

function isPerfectBraceTiming(actor, target, animDuration) {
  if (
    target.clinchBraceArmedTechnique &&
    target.clinchBraceArmedTechnique === techniqueBraceKey(actor)
  ) {
    return true;
  }
  return isFreshBraceActivation(actor, target, animDuration);
}

// Short grace after a real Plant activation / hold. Mid Drive→Plant cancel
// never refreshes this (not actively planting yet).
function isBraceLatched(player, now) {
  if (!player?.hasGrip) return false;
  if (player.clinchJoltRecovery || player.isClinchOpen || player.clinchThrowFailStagger) {
    return false;
  }
  const until = player.clinchBraceLatchUntil || 0;
  if (!until || now == null || !Number.isFinite(now)) return false;
  return now <= until;
}

function refreshBraceLatch(player, opponent, now) {
  if (!isActivelyPlanting(player, opponent, now)) return;
  player.clinchBraceLatchUntil = now + CLINCH_BRACE_LATCH_MS;
}

// Throw/Pull impact defense.
//   bracing      — PASSIVE held Plant: must still be active (or inside the short
//                  release latch) at impact. Resists a normal technique only.
//   perfectBrace — ACTIVE response to this tell: a fresh Brace anywhere in the
//                  visible startup. Not gated on `bracing`, because an honest
//                  early reaction must not expire on the generic latch.
function getClinchThrowDefense(actor, target, now, animDuration) {
  const activelyPlanting = isActivelyPlanting(target, actor, now);
  const latched = isBraceLatched(target, now);
  const bracing = activelyPlanting || latched;
  const perfectBrace = isPerfectBraceTiming(actor, target, animDuration);
  return {
    activelyPlanting,
    latched,
    perfectBrace,
    bracing,
  };
}

// Plant/brace stance intent from raw keys: pull-back (away) alone, or S alone —
// both dead inputs in the clinch before this, and pull-back is the natural
// panic motion against an incoming throw. Holding toward overrides S (active
// aggression wins over a stray S), and toward+away cancel each other out.
// REQUEST only — defense must use isActivelyPlanting / getClinchAction.
function getPlantIntent(player, opponent) {
  const towardKey = player.x < opponent.x ? 'd' : 'a';
  const awayKey = player.x < opponent.x ? 'a' : 'd';
  const toward = player.keys[towardKey];
  return (player.keys[awayKey] && !toward) || (player.keys.s && !toward);
}

function updateGrabActions(player, room, io, delta, rooms) {
  // Only process for the player who initiated the grab (isGrabbing)
  if (!player.isGrabbing || !player.grabbedOpponent) return;
  // FORCE OUT cutscene owns movement/poses after the win — don't run clinch AI.
  if (player.isRingOutPushCutscene || room.gameOver) return;
  // Skip during throw/pull animation states (Phase 4 will handle these)
  if (player.isThrowing || player.isBeingThrown) return;

  const opponent = room.players.find((p) => p.id === player.grabbedOpponent);
  if (!opponent) {
    // Orphan grab safety
    const grabDuration = simNow(room) - player.grabStartTime;
    if (grabDuration >= 500) {
      player.isGrabbing = false;
      player.grabbedOpponent = null;
    }
    return;
  }

  // Push-war HUD lead — null when not in a mutual shove; 0 = EVEN standstill.
  player.clinchShoveLead = null;
  opponent.clinchShoveLead = null;

  const deltaSec = delta / 1000;
  const leftBoundary = MAP_LEFT_BOUNDARY;
  const rightBoundary = MAP_RIGHT_BOUNDARY;

  // Clinch is always a belt grip — M2 is throw/pull chord only, not a pose toggle.
  for (const p of [player, opponent]) {
    p.isClinchBeltHolding = true;
  }
  const sizeMult = opponent.sizeMultiplier || 1;
  const targetAttach = CLINCH_ATTACHED_DISTANCE * sizeMult;
  if (!(player.clinchAttachDistance > 0)) {
    player.clinchAttachDistance = targetAttach;
  } else {
    const lerp = Math.min(1, deltaSec * CLINCH_ATTACH_LERP_PER_SEC);
    player.clinchAttachDistance +=
      (targetAttach - player.clinchAttachDistance) * lerp;
  }
  const fixedDistance = player.clinchAttachDistance;

  // ============================================
  // PHASE A: SHORT AUTO-BURST PUSH (first-grab reward)
  // Both players already have grip on connect. Burst rides isGrabPushing and
  // decays quickly. Either side's throw/pull/break cancels it; during a normal
  // burst both sides can still plant/jolt/throw if they react fast enough.
  // ARM CLAMP (counter-grab): strong advantage — victim offense locked
  // (push/throw/jolt/break), but Plant brace remains. Not a free/untechable throw.
  // ============================================
  const eitherThrowRequest = !!(player.clinchThrowRequest || opponent.clinchThrowRequest);
  if (player.isGrabPushing && eitherThrowRequest) {
    player.isGrabPushing = false;
    opponent.isBeingGrabPushed = false;
    player.isEdgePushing = false;
    opponent.isBeingEdgePushed = false;
    player.isAtBoundaryDuringGrab = false;
    player.grabPushStartTime = 0;
    // The BURST is cancelled so the technique can process — but the pin hold is
    // deliberately NOT cleared here. Wiping it made a buffered technique a free
    // "get off the tawara" button: a cornered player could mash throw and never
    // be forced out, no matter how long they were actually held against the wall.
    // Accrued pin now only resets by leaving the boundary or the pusher easing
    // off, both handled in the drive movement section below.
    // Fall through — throw request processed below
  }

  let burstMovementApplied = false;
  if (player.isGrabPushing) {
    if (!player.grabPushStartTime) {
      player.grabPushStartTime = simNow(room);
      opponent.isBeingGrabPushed = true;
    }

    const pushElapsed = simNow(room) - player.grabPushStartTime;
    const pushElapsedSec = pushElapsed / 1000;

    // Calculate burst push speed (exponential decay).
    // MASTERY Phase 1: the grab is the TEMPLATE inheritance mechanic (it already
    // transfers approach speed into the burst) — raise the transfer so a
    // dash/power-slide grab bites harder. Flag off ⇒ base transfer.
    const grabMomentumTransfer = MASTERY_P1_MOMENTUM
      ? GRAB_PUSH_MOMENTUM_TRANSFER_MASTERY
      : GRAB_PUSH_MOMENTUM_TRANSFER;
    // Clamp gets its own shove power — regular connect stays a short reward
    // nudge; counter-grab should feel like a real parry punish.
    const clampMult = opponent.isArmClamped ? ARM_CLAMP_BURST_MULT : 1;
    const burstDecay = opponent.isArmClamped
      ? ARM_CLAMP_BURST_DECAY_RATE
      : GRAB_PUSH_DECAY_RATE;
    const initialPushSpeed =
      (GRAB_PUSH_BURST_BASE +
        (player.grabApproachSpeed || 0) * grabMomentumTransfer) *
      clampMult;
    let currentPushSpeed =
      initialPushSpeed * Math.exp(-burstDecay * pushElapsedSec);

    // When burst decays below threshold, transition to manual clinch push.
    // ARM CLAMP: end while the shove is still lively (velocity floor + hard
    // duration cap), not in a crawl — keeps the punish window sharp.
    const burstEndVelocity = opponent.isArmClamped
      ? ARM_CLAMP_BURST_END_VELOCITY
      : GRAB_PUSH_MIN_VELOCITY;
    const armClampBurstTimedOut =
      opponent.isArmClamped && pushElapsed >= ARM_CLAMP_MAX_BURST_MS;
    if (
      (currentPushSpeed < burstEndVelocity || armClampBurstTimedOut) &&
      pushElapsed > 80
    ) {
      player.isGrabPushing = false;
      opponent.isBeingGrabPushed = false;
      player.grabPushStartTime = 0;
      player.clinchAction = "neutral";
      opponent.clinchAction = "neutral";
      // Fall through to clinch processing below
    } else {
      // Stamina drain during burst push — pusher always drains
      if (!player.lastGrabStaminaDrainTime) {
        player.lastGrabStaminaDrainTime = simNow(room);
      }
      if (simNow(room) - player.lastGrabStaminaDrainTime >= GRAB_STAMINA_DRAIN_INTERVAL) {
        player.stamina = Math.max(0, player.stamina - 1);
        player.lastGrabStaminaDrainTime = simNow(room);
      }

      // Opponent stamina drain during burst push (slower than pusher, faster at edge)
      if (!opponent.lastGrabPushStaminaDrainTime) {
        opponent.lastGrabPushStaminaDrainTime = simNow(room);
      }
      const drainInterval = player.isAtBoundaryDuringGrab
        ? GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL
        : GRAB_PUSH_STAMINA_DRAIN_INTERVAL;
      if (simNow(room) - opponent.lastGrabPushStaminaDrainTime >= drainInterval) {
        opponent.stamina = Math.max(0, opponent.stamina - 1);
        opponent.lastGrabPushStaminaDrainTime = simNow(room);
      }

      // Still in burst push — apply movement (actions still process below)
      const pushDirection = player.x < opponent.x ? 1 : -1;
      const pushDelta =
        pushDirection * delta * speedFactor * clampShoveSpeed(currentPushSpeed);
      let newX = player.x + pushDelta;
      let newOpponentX = player.x < opponent.x
        ? newX + fixedDistance
        : newX - fixedDistance;

      // Boundary check with stamina gating
      const opponentAtLeft = newOpponentX <= leftBoundary;
      const opponentAtRight = newOpponentX >= rightBoundary;

      if ((opponentAtLeft || opponentAtRight) && !room.gameOver) {
        const pinDir = opponentAtLeft ? -1 : 1;
        // ARM CLAMP ends at boundary contact — don't stack edge pin with the
        // offense lock. Plant was still available under clamp; clearing here
        // restores break/jolt so the victim isn't a near-spectator at the rope.
        if (opponent.isArmClamped) {
          opponent.isArmClamped = false;
          opponent.clinchAction = "neutral";
        }
        if (tryEdgePinRingOut(player, opponent, room, io, rooms, pinDir, delta)) {
          return;
        }
        // Pin at boundary
        player.isAtBoundaryDuringGrab = true;
        player.isEdgePushing = true;
        opponent.isBeingEdgePushed = true;
        newOpponentX = opponentAtLeft ? leftBoundary : rightBoundary;
        newX = player.x < opponent.x
          ? newOpponentX - fixedDistance
          : newOpponentX + fixedDistance;
      } else {
        player.isAtBoundaryDuringGrab = false;
        player.isEdgePushing = false;
        opponent.isBeingEdgePushed = false;
        clearEdgePinHold(opponent);
        newX = Math.max(leftBoundary, Math.min(newX, rightBoundary));
      }

      player.x = newX;
      opponent.x = player.x < opponent.x
        ? player.x + fixedDistance
        : player.x - fixedDistance;

      if (!opponent.atTheRopesFacingDirection) {
        opponent.facing = -player.facing;
      }
      player.movementVelocity = 0;
      burstMovementApplied = true;
    }
  }

  // ============================================
  // PHASE B: MUTUAL CLINCH
  // Both have grip from connect. Push/plant/jolt/throw/break are live.
  // While burst movement owns this tick, skip Phase B shove displacement.
  // ============================================

  // ARM CLAMP release: lasts through the burst carry and any technique the
  // grabber filed during it (still Plant-defendable). Once the burst is over
  // and no throw is pending/active, clear the clamp for a fair clinch.
  if (
    opponent.isArmClamped &&
    !player.isGrabPushing &&
    !player.clinchThrowRequest &&
    !player.clinchThrowActive
  ) {
    opponent.isArmClamped = false;
    opponent.clinchAction = "neutral";
  }

  const now = simNow(room);

  // Arm-clamped stance: offense locked → force plant-or-neutral resolution
  // (same Plant authority as getClinchAction; push/throw intents ignored).
  const clampedOpponentAction = (() => {
    if (!opponent.isArmClamped) return null;
    return isActivelyPlanting(opponent, player, now) ? "plant" : "neutral";
  })();

  // Determine each player's clinch action. Arm-clamped victims cannot push /
  // throw / jolt / break, but may still Plant-brace against techniques.
  const grabberActionPass1 = getClinchAction(player, opponent, now);
  const opponentActionPass1 = clampedOpponentAction ?? getClinchAction(opponent, player, now);

  // Committed Drive → Plant: arm a short cancel lock on the transition edge.
  // Defer Perfect Brace / activation clock to when Plant actually becomes active.
  for (const [p, action] of [[player, grabberActionPass1], [opponent, opponentActionPass1]]) {
    const wasCommitted = !!p.isClinchCommittedDrive;
    if (wasCommitted && action === "plant") {
      const activateAt = now + CLINCH_DRIVE_PLANT_CANCEL_MS;
      p.clinchDrivePlantCancelUntil = activateAt;
      // Bailing out of a Drive into Plant is a Brace attempt like any other, so
      // it spends the same cycle. If Brace is mid-cycle the stance change still
      // happens (and still costs the cancel transition) — it just cannot produce
      // an active read, which is what stops Drive↔Plant from being a free rearm.
      if (beginBraceAttempt(p, now)) {
        p.clinchBraceSimTime = activateAt;
      }
    }
  }
  // Re-resolve if cancel lock just armed this tick (plant → neutral beat).
  const grabberAction = getClinchAction(player, opponent, now);
  const opponentAction = clampedOpponentAction ?? getClinchAction(opponent, player, now);

  player.clinchAction = grabberAction;
  opponent.clinchAction = opponentAction;

  updateBracePosePhase(player, now);
  updateBracePosePhase(opponent, now);

  // Drive hold timers — Light vs Committed
  for (const [p, action] of [
    [player, grabberAction],
    [opponent, opponentAction],
  ]) {
    if (action === "push") {
      if (!p.clinchDriveHoldStart) p.clinchDriveHoldStart = now;
      p.isClinchCommittedDrive = now - p.clinchDriveHoldStart >= CLINCH_LIGHT_DRIVE_MS;
    } else {
      if (p.clinchDriveHoldStart) p.clinchDriveHoldStart = 0;
      p.isClinchCommittedDrive = false;
    }
  }

  // Brace latch: refresh only while Plant is authoritatively active. Release
  // keeps Throw/Pull defense armed for CLINCH_BRACE_LATCH_MS.
  refreshBraceLatch(player, opponent, now);
  refreshBraceLatch(opponent, player, now);

  // Set visual states
  player.inClinch = true;
  opponent.inClinch = true;

  // Clinch action visual flags (driven by clinchAction, reset every tick)
  player.isClinchPushing = (grabberAction === "push");
  player.isClinchPlanting = (grabberAction === "plant");
  opponent.isClinchPushing = (opponentAction === "push");
  opponent.isClinchPlanting = (opponentAction === "plant");

  // --- Stalemate timer ---
  // Reset on meaningful movement/balance change takes priority over expiration
  // on the same tick — otherwise a just-reset timer can still separate using a
  // stale elapsed value computed before the reset.
  if (!player.clinchStalemateStart) {
    player.clinchStalemateStart = now;
    player.clinchStalemateLastX = player.x;
    player.clinchStalemateLastBalance = player.balance;
  }
  const stalemateElapsed = now - player.clinchStalemateStart;
  const posChanged = Math.abs(player.x - (player.clinchStalemateLastX || player.x)) > CLINCH_STALEMATE_MOVEMENT_THRESHOLD;
  const balChanged = Math.abs(player.balance - (player.clinchStalemateLastBalance || player.balance)) > CLINCH_STALEMATE_BALANCE_THRESHOLD;
  if (posChanged || balChanged) {
    player.clinchStalemateStart = now;
    player.clinchStalemateLastX = player.x;
    player.clinchStalemateLastBalance = player.balance;
  } else if (stalemateElapsed >= CLINCH_STALEMATE_DURATION_MS && !room.gameOver) {
    executeClinchSeparation(player, opponent, room, io);
    return;
  }

  // ============================================
  // CLINCH BREAK (Spacebar) — defensive escape from mutual clinch
  // Processed before jolt/throw/lift/push so a break preempts everything else,
  // including an opposing throw/pull that is still in startup.
  // Gated on mutual grip in socketHandlers; gates here must stay in sync.
  // ============================================
  for (const breaker of [player, opponent]) {
    if (!breaker.clinchBreakRequest) continue;
    const target = breaker === player ? opponent : player;

    // Drop early requests (e.g. latched during grab hitstop before reaction lock opens).
    // No carry — player must press Space again after the lock.
    const gripAt = breaker.gripAcquiredTime || 0;
    if (gripAt && now - gripAt < GRAB_BREAK_REACTION_LOCK_MS) {
      breaker.clinchBreakRequest = false;
      breaker.clinchBreakRequestTime = 0;
      continue;
    }

    // Late safety gates — must match socketHandlers acceptance.
    // Break CAN interrupt an opposing technique startup (expensive escape);
    // only the breaker's own committed throw / other self-locks block it.
    // Stamina (gassed) is the soft fail with feedback; everything else is a
    // hard gate that should also have rejected the input up-front.
    const blockedByGas = breaker.isGassed;
    const blocked = blockedByGas ||
      breaker.clinchThrowActive ||
      breaker.isClinchClashing ||
      breaker.isClinchJolting || breaker.isClinchJoltClashing ||
      breaker.clinchJoltRecovery ||
      breaker.clinchThrowFailStagger || breaker.isClinchOpen ||
      breaker.isArmClamped ||
      !breaker.hasGrip || !target.hasGrip;

    breaker.clinchBreakRequest = false;
    breaker.clinchBreakRequestTime = 0;

    if (blocked) {
      if (blockedByGas) emitStaminaBlocked(breaker, "grabBreak", io);
      continue;
    }

    // Interrupts opposing throw/pull startup — cleanupGrabStates clears it.
    executeClinchBreak(breaker, target, room, io);
    return; // Clinch is ending — skip rest of clinch processing this tick
  }

  // ============================================
  // CLINCH JOLT (Mouse1) — telegraphed chest-shove
  // Startup (250ms) is visible commitment; impact resolves at the end against
  // the opponent's CURRENT plant/push/neutral. Mutual clash uses overlapping
  // startups within CLINCH_JOLT_CLASH_WINDOW_MS of each start time.
  // Processed before throw/pull/lift — recovery blocks those actions.
  // ============================================

  const beginClinchJoltRecovery = (p, opts = {}) => {
    if (p.clinchJoltRecovery) return;
    p.clinchJoltRecovery = true;
    // Punishable recovery — Open without stumble pose, unless a worse Open
    // (e.g. jolt into committed Drive) already armed a stumble window.
    if (!opts.skipOpen && !isClinchOpen(p)) {
      applyClinchOpen(p, CLINCH_JOLT_RECOVERY_MS, room, { stumble: false });
    }
    setPlayerTimeout(p.id, () => {
      p.clinchJoltRecovery = false;
    }, CLINCH_JOLT_RECOVERY_MS, "clinchJoltRecovery");
  };

  const cancelPhaseABurst = () => {
    if (!player.isGrabPushing) return;
    player.isGrabPushing = false;
    opponent.isBeingGrabPushed = false;
    player.isEdgePushing = false;
    opponent.isBeingEdgePushed = false;
    player.isAtBoundaryDuringGrab = false;
    player.grabPushStartTime = 0;
  };

  // Drop early jolt requests (same fresh-press floor as grab break).
  // No carry — player must press Mouse1 again after the lock.
  for (const p of [player, opponent]) {
    if (!p.clinchJoltRequest) continue;
    const gripAt = p.gripAcquiredTime || 0;
    if (gripAt && now - gripAt < GRAB_BREAK_REACTION_LOCK_MS) {
      p.clinchJoltRequest = false;
      p.clinchJoltRequestTime = 0;
    }
  }

  // --- Clear expired recoil / plant-interrupt (impact aftermath) ---
  for (const p of [player, opponent]) {
    if (p.isBeingClinchJolted && p.clinchJoltRecoilStart && now - p.clinchJoltRecoilStart >= CLINCH_JOLT_RECOIL_MS) {
      p.isBeingClinchJolted = false;
    }
    if (p.clinchJoltPlantInterrupt && p.clinchJoltPlantInterruptStart && now - p.clinchJoltPlantInterruptStart >= CLINCH_JOLT_PLANT_INTERRUPT_MS) {
      p.clinchJoltPlantInterrupt = false;
    }
  }

  // --- Accept jolt requests → begin 250ms telegraphed startup (no impact yet) ---
  for (const jolter of [player, opponent]) {
    if (!jolter.clinchJoltRequest) continue;

    if (
      jolter.isClinchJolting ||
      jolter.isClinchJoltClashing ||
      jolter.clinchJoltRecovery ||
      isClinchOpen(jolter) ||
      jolter.clinchThrowActive ||
      jolter.isClinchClashing ||
      jolter.isResistingThrow ||
      jolter.isResistingPull ||
      !jolter.hasGrip
    ) {
      jolter.clinchJoltRequest = false;
      jolter.clinchJoltRequestTime = 0;
      continue;
    }

    // Stamina never hard-blocks jolt — gassed / empty tank can still hand-fight
    // (CLINCH_JOLT_GASSED_MULT weakens impact). Pay what you can; floor at 0.
    jolter.clinchJoltRequest = false;
    jolter.clinchJoltRequestTime = 0;
    jolter.isClinchJolting = true;
    jolter.clinchJoltStartTime = now;
    jolter.stamina = Math.max(0, (jolter.stamina || 0) - CLINCH_JOLT_STAMINA_COST);
    tryEnterGassed(jolter, now);
    cancelPhaseABurst();
  }

  // --- Mutual clash: both committed startups within the 120ms window ---
  if (
    player.isClinchJolting &&
    opponent.isClinchJolting &&
    !player.clinchJoltRecovery &&
    !opponent.clinchJoltRecovery
  ) {
    const timeDiff = Math.abs(
      (player.clinchJoltStartTime || 0) - (opponent.clinchJoltStartTime || 0)
    );
    if (timeDiff <= CLINCH_JOLT_CLASH_WINDOW_MS) {
      player.isClinchJoltClashing = true;
      opponent.isClinchJoltClashing = true;
    }
  }

  // --- Resolve impact when startup completes ---
  const playerStartupDone =
    player.isClinchJolting &&
    player.clinchJoltStartTime &&
    now - player.clinchJoltStartTime >= CLINCH_JOLT_ANIMATION_MS;
  const opponentStartupDone =
    opponent.isClinchJolting &&
    opponent.clinchJoltStartTime &&
    now - opponent.clinchJoltStartTime >= CLINCH_JOLT_ANIMATION_MS;
  // Impact clears isClinchJolting; keep this tick from falling into push/throw.
  let joltImpactResolved = false;

  // Mutual: first to reach impact resolves the clash for both (cuts short the later startup).
  if (
    player.isClinchJoltClashing &&
    opponent.isClinchJoltClashing &&
    (playerStartupDone || opponentStartupDone)
  ) {
    player.isClinchJolting = false;
    opponent.isClinchJolting = false;
    player.isClinchJoltClashing = false;
    opponent.isClinchJoltClashing = false;
    player.clinchJoltStartTime = 0;
    opponent.clinchJoltStartTime = 0;

    player.balance = Math.max(0, player.balance - CLINCH_JOLT_MUTUAL_BALANCE);
    opponent.balance = Math.max(0, opponent.balance - CLINCH_JOLT_MUTUAL_BALANCE);

    player.isBeingClinchJolted = true;
    opponent.isBeingClinchJolted = true;
    player.clinchJoltRecoilStart = now;
    opponent.clinchJoltRecoilStart = now;
    player.inputLockUntil = Math.max(player.inputLockUntil || 0, now + CLINCH_JOLT_RECOIL_MS);
    opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, now + CLINCH_JOLT_RECOIL_MS);

    // Jolt won priority — erase uncommitted techniques; already-active
    // clinchThrowActive startups are left alone.
    for (const p of [player, opponent]) {
      if (!p.clinchThrowActive) {
        p.clinchThrowRequest = null;
        p.clinchThrowRequestTime = 0;
      }
    }

    beginClinchJoltRecovery(player);
    beginClinchJoltRecovery(opponent);
    joltImpactResolved = true;

    triggerHitstopAndEmit(io, room, CLINCH_JOLT_MUTUAL_HITSTOP_MS, "clinch_jolt_mutual");
    emitThrottledScreenShake(room, io, { type: "clinch_jolt", scale: 1.1 });
    {
      const contactX = (player.x + opponent.x) / 2;
      const joltActionId = `jolt-mutual-${now}-${player.id}`;
      const clinchId = ensureClinchInstanceId(player, opponent, now);
      io.in(room.id).emit(
        "clinch_jolt",
        attachCombatPresentation(
          {
            jolterId: player.id,
            targetId: opponent.id,
            jolterX: player.x,
            targetX: opponent.x,
            type: "mutual",
            direction: 0,
            contactX,
            contactY: CLINCH_GRIP_CONTACT_Y,
            joltId: joltActionId,
          },
          buildClinchPresentation({
            interactionType: CLINCH_INTERACTION.CLINCH_JOLT_MUTUAL,
            clinchInstanceId: clinchId,
            actionInstanceId: joltActionId,
            initiator: player,
            responder: opponent,
            outcome: "MUTUAL",
            contactX,
            contactY: CLINCH_GRIP_CONTACT_Y,
            movementX: 0,
            salt: "jolt_mutual",
          })
        )
      );
    }

    player.clinchStalemateStart = now;
    opponent.clinchStalemateStart = now;
    player.clinchStalemateLastBalance = player.balance;
    opponent.clinchStalemateLastBalance = opponent.balance;
    player.clinchStalemateLastX = player.x;
    opponent.clinchStalemateLastX = opponent.x;
  } else {
    // Single jolt impact — snapshot opponent keys NOW (after the telegraph).
    for (const [jolter, target] of [[player, opponent], [opponent, player]]) {
      const startupDone =
        jolter === player ? playerStartupDone : opponentStartupDone;
      if (
        !startupDone ||
        jolter.isClinchJoltClashing ||
        !jolter.isClinchJolting
      ) {
        continue;
      }

      jolter.isClinchJolting = false;
      jolter.clinchJoltStartTime = 0;

      const targetAction = target === player ? grabberAction : opponentAction;

      // Light Drive reads closer to neutral; Committed Drive is the full
      // "jolt into their force" disaster (self-damage + Open).
      const targetCommitted = targetAction === "push" && !!target.isClinchCommittedDrive;
      const targetLightDrive = targetAction === "push" && !targetCommitted;

      let balanceDmg, pushDist, lockoutMs;
      if (targetAction === "plant") {
        balanceDmg = CLINCH_JOLT_BALANCE_VS_PLANT;
        pushDist = CLINCH_JOLT_PUSH_VS_PLANT;
        lockoutMs = CLINCH_JOLT_LOCKOUT_VS_PLANT;
      } else if (targetCommitted) {
        balanceDmg = CLINCH_JOLT_BALANCE_VS_PUSH;
        pushDist = CLINCH_JOLT_PUSH_VS_PUSH;
        lockoutMs = CLINCH_JOLT_LOCKOUT_VS_PUSH;
      } else if (targetLightDrive) {
        balanceDmg = CLINCH_JOLT_BALANCE_VS_NEUTRAL;
        pushDist = CLINCH_JOLT_PUSH_VS_NEUTRAL;
        lockoutMs = CLINCH_JOLT_LOCKOUT_VS_NEUTRAL;
      } else {
        balanceDmg = CLINCH_JOLT_BALANCE_VS_NEUTRAL;
        pushDist = CLINCH_JOLT_PUSH_VS_NEUTRAL;
        lockoutMs = CLINCH_JOLT_LOCKOUT_VS_NEUTRAL;
      }

      const gassedMult = jolter.isGassed ? CLINCH_JOLT_GASSED_MULT : 1;
      balanceDmg = Math.round(balanceDmg * gassedMult);
      pushDist = Math.round(pushDist * gassedMult);

      target.balance = Math.max(0, target.balance - balanceDmg);

      if (targetCommitted) {
        jolter.balance = Math.max(0, jolter.balance - CLINCH_JOLT_SELF_BALANCE_VS_PUSH);
        applyClinchOpen(
          jolter,
          Math.max(CLINCH_OPEN_JOLT_INTO_DRIVE_MS, CLINCH_JOLT_RECOVERY_MS),
          room,
          { stumble: true }
        );
      }

      // Chest-bump: target takes 70% of push, jolter advances 30%
      const pushDir = jolter.x < target.x ? 1 : -1;
      if (pushDist > 0) {
        const targetPush = pushDist * 0.7;
        const jolterPush = pushDist * 0.3;
        jolter.x = Math.max(leftBoundary, Math.min(rightBoundary, jolter.x + pushDir * jolterPush));
        target.x = Math.max(leftBoundary, Math.min(rightBoundary, target.x + pushDir * targetPush));
      }

      // Committed Drive BEATS Jolt (0 balance damage, 0 push, 0 lockout). The
      // winner must not also play the jolted-recoil pose or eat the recoil's
      // technique gate — that read as if they had lost, and `isBeingClinchJolted`
      // blocks canCommitTechnique, contradicting the documented free throw
      // window. Only a jolt that actually connected staggers the target.
      if (!targetCommitted) {
        target.isBeingClinchJolted = true;
        target.clinchJoltRecoilStart = now;
      }

      if (lockoutMs > 0) {
        target.inputLockUntil = Math.max(target.inputLockUntil || 0, now + lockoutMs);
      }

      // Jolt landed first — cancel the target's buffered technique so it
      // cannot commit during lock/recoil. Authoritative clinchThrowActive
      // (already committed) is not cleared. A Committed Drive that beat the jolt
      // keeps its buffered technique — that free window is the reward.
      if (!targetCommitted && !target.clinchThrowActive) {
        target.clinchThrowRequest = null;
        target.clinchThrowRequestTime = 0;
      }

      if (targetAction === "plant") {
        target.clinchJoltPlantInterrupt = true;
        target.clinchJoltPlantInterruptStart = now;
      }

      // DEEP GRIP: a jolt that CONNECTS strips the target's deep grip, and
      // jolting a PLANTED opponent (posture broken, hand slips inside) earns it.
      // A jolt swallowed by Committed Drive connected with nothing — it must not
      // strip the Deep Grip of the player who won the exchange.
      if (!targetCommitted && target.hasDeepGrip) target.hasDeepGrip = false;
      if (targetAction === "plant") {
        grantDeepGrip(jolter, target, room, io, "jolt");
      }

      beginClinchJoltRecovery(jolter, { skipOpen: targetCommitted });
      joltImpactResolved = true;

      triggerHitstopAndEmit(io, room, CLINCH_JOLT_HITSTOP_MS, "clinch_jolt");
      emitThrottledScreenShake(room, io, { type: "clinch_jolt" });
      {
        const contactX = (jolter.x + target.x) / 2;
        const joltActionId = `jolt-${now}-${jolter.id}`;
        const clinchId = ensureClinchInstanceId(jolter, target, now);
        io.in(room.id).emit(
          "clinch_jolt",
          attachCombatPresentation(
            {
              jolterId: jolter.id,
              targetId: target.id,
              jolterX: jolter.x,
              targetX: target.x,
              type: "single",
              direction: pushDir,
              intoCommittedDrive: targetCommitted,
              contactX,
              contactY: CLINCH_GRIP_CONTACT_Y,
              joltId: joltActionId,
            },
            buildClinchPresentation({
              interactionType: CLINCH_INTERACTION.CLINCH_JOLT,
              clinchInstanceId: clinchId,
              actionInstanceId: joltActionId,
              initiator: jolter,
              responder: target,
              outcome: targetCommitted ? "INTO_DRIVE" : "HIT",
              contactX,
              contactY: CLINCH_GRIP_CONTACT_Y,
              movementX: pushDir,
              salt: "jolt",
            })
          )
        );
      }

      jolter.clinchStalemateStart = now;
      target.clinchStalemateStart = now;
      jolter.clinchStalemateLastBalance = jolter.balance;
      target.clinchStalemateLastBalance = target.balance;
      jolter.clinchStalemateLastX = jolter.x;
      target.clinchStalemateLastX = target.x;
    }
  }

  // --- Block actions during jolt recovery / Open ---
  for (const p of [player, opponent]) {
    if (isClinchOpen(p)) {
      // Authority-layer guarantee that Open is a real turn loss. The input
      // layer already refuses to file offense while Open and applyClinchOpen
      // voids anything pending, so this only ever catches a request that
      // survived some other path — it must never queue past the recovery.
      p.clinchThrowRequest = null;
      p.clinchThrowRequestTime = 0;
      p.clinchJoltRequest = false;
      p.clinchJoltRequestTime = 0;
      p.clinchBreakRequest = false;
      p.clinchBreakRequestTime = 0;
      // Same for DEFENSIVE edges: a Back/S press made while helpless must never
      // be carried forward and read as an active Brace against the punish.
      p.clinchBraceSimTime = 0;
      p.clinchBraceArmedTechnique = null;
      p.clinchBraceLatchUntil = 0;
    }
    if (p.clinchJoltRecovery || isClinchOpen(p)) {
      p.clinchAction = "neutral";
      if (p === player) {
        player.isClinchPushing = false;
        player.isClinchPlanting = false;
      } else {
        opponent.isClinchPushing = false;
        opponent.isClinchPlanting = false;
      }
    }
  }

  // --- Skip throw/pull/lift/push/plant during startup and the impact tick ---
  if (player.isClinchJolting || opponent.isClinchJolting ||
      player.isClinchJoltClashing || opponent.isClinchJoltClashing ||
      joltImpactResolved) {
    maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary);
    return;
  }

  // ============================================
  // CLINCH ACTIONS: Throw / Pull (both are throws)
  // Clinch Flow P1: short simul window → Deep Grip wins or mutual tumble.
  // Outside that window the first technique owns; Plant resists at impact.
  // Request times are lag-compensated with trusted receipt/RTT clamps — raw
  // client timestamps must not freely reorder the 60ms collision window.
  // ============================================

  const canCommitTechnique = (p) =>
    p.clinchThrowRequest &&
    !p.clinchThrowActive &&
    !isClinchOpen(p) &&
    !p.isResistingThrow &&
    !p.isResistingPull &&
    !p.clinchJoltRecovery &&
    !p.isClinchJolting &&
    !p.isBeingClinchJolted &&
    !(p.inputLockUntil && now < p.inputLockUntil) &&
    p.hasGrip;

  const bufferExpired = (p) =>
    (now - (p.clinchThrowRequestTime || 0)) > CLINCH_THROW_CLASH_WINDOW_MS;

  // --- True simultaneous techniques ---
  if (
    player.clinchThrowRequest &&
    opponent.clinchThrowRequest &&
    !player.clinchThrowActive &&
    !opponent.clinchThrowActive
  ) {
    const timeDiff = Math.abs(
      (player.clinchThrowRequestTime || 0) - (opponent.clinchThrowRequestTime || 0)
    );
    if (timeDiff <= CLINCH_THROW_CLASH_WINDOW_MS) {
      const pDeep = !!player.hasDeepGrip;
      const oDeep = !!opponent.hasDeepGrip;
      if (pDeep !== oDeep) {
        // Deep Grip wins the collision — loser's request is erased.
        const winner = pDeep ? player : opponent;
        const loser = pDeep ? opponent : player;
        loser.clinchThrowRequest = null;
        loser.clinchThrowRequestTime = 0;
        // Winner keeps request; commits below once buffer expires / immediately.
      } else {
        // Mutual tumble — funny, final, ends the clinch. No throw-tech loop.
        player.clinchThrowRequest = null;
        player.clinchThrowRequestTime = 0;
        opponent.clinchThrowRequest = null;
        opponent.clinchThrowRequestTime = 0;
        player.isClinchClashing = true;
        opponent.isClinchClashing = true;
        player.clinchClashStartTime = now;
        opponent.clinchClashStartTime = now;
        player.stamina = Math.max(0, player.stamina - CLINCH_TUMBLE_STAMINA_COST);
        opponent.stamina = Math.max(0, opponent.stamina - CLINCH_TUMBLE_STAMINA_COST);
        player.balance = Math.max(0, player.balance - CLINCH_TUMBLE_BALANCE_DRAIN);
        opponent.balance = Math.max(0, opponent.balance - CLINCH_TUMBLE_BALANCE_DRAIN);
        // Discrete TECH presentation at clash start (not per-tick). Reuses
        // clinch_callout transport with type grab_tech — HUD handler ignores it.
        {
          const techId = `clinch-tech-${now}-${player.id}`;
          const seamX = (player.x + opponent.x) / 2;
          const clinchId = ensureClinchInstanceId(player, opponent, now);
          const nx = player.x < opponent.x ? 1 : -1;
          io.in(room.id).emit(
            "clinch_callout",
            attachCombatPresentation(
              {
                type: "grab_tech",
                actorId: player.id,
                targetId: opponent.id,
                calloutId: techId,
                x: seamX,
                techId,
              },
              buildClinchPresentation({
                interactionType: CLINCH_INTERACTION.CLINCH_TECH,
                clinchInstanceId: clinchId,
                actionInstanceId: techId,
                initiator: player,
                responder: opponent,
                outcome: "TECH",
                contactX: seamX,
                contactY: CLINCH_EFFECT_MID_Y,
                movementX: nx,
                salt: "tech",
              })
            )
          );
        }
      }
    }
  }

  // --- Mutual tumble flash → separate + Open ---
  if (player.isClinchClashing || opponent.isClinchClashing) {
    const clashElapsed = now - (player.clinchClashStartTime || opponent.clinchClashStartTime || now);
    if (clashElapsed >= CLINCH_CLASH_ANIMATION_MS) {
      player.isClinchClashing = false;
      opponent.isClinchClashing = false;
      player.clinchClashStartTime = 0;
      opponent.clinchClashStartTime = 0;
      {
        const tumbleId = `clinch-tumble-${now}-${player.id}`;
        const seamX = (player.x + opponent.x) / 2;
        const clinchId = ensureClinchInstanceId(player, opponent, now);
        // Tech rings already fired on clash rising edge (client). Tumble carries
        // identity for shake/cleanup — not a second TECH spawn.
        io.in(room.id).emit(
          "clinch_tumble",
          attachCombatPresentation(
            {
              player1Id: player.id,
              player2Id: opponent.id,
              x: seamX,
              tumbleId,
            },
            buildClinchPresentation({
              interactionType: CLINCH_INTERACTION.CLINCH_TUMBLE,
              clinchInstanceId: clinchId,
              actionInstanceId: tumbleId,
              initiator: player,
              responder: opponent,
              outcome: "SEPARATE",
              contactX: seamX,
              contactY: CLINCH_EFFECT_MID_Y,
              salt: "tumble",
            })
          )
        );
      }
      emitThrottledScreenShake(room, io, { type: "clinch_tumble" });
      executeClinchSeparation(player, opponent, room, io);
      // Separation already reads as "can't act" — skip stun stars for this Open.
      applyClinchOpen(player, CLINCH_OPEN_TUMBLE_MS, room, { hideStars: true });
      applyClinchOpen(opponent, CLINCH_OPEN_TUMBLE_MS, room, { hideStars: true });
      return;
    }
    maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary);
    return;
  }

  // --- Commit technique after short simul window (no 175ms freeze) ---
  // Collect ALL eligible committers first, then choose by authoritative
  // request time — never by grabber identity or array iteration order.
  // Inside-window pairs are already resolved above (Deep Grip / tumble).
  const eligibleCommitters = [];
  if (canCommitTechnique(player) && bufferExpired(player)) {
    eligibleCommitters.push(player);
  }
  if (canCommitTechnique(opponent) && bufferExpired(opponent)) {
    eligibleCommitters.push(opponent);
  }

  const commitTechnique = (actor, target) => {
    const actionType = actor.clinchThrowRequest;
    if (actionType !== "throw" && actionType !== "pull") {
      actor.clinchThrowRequest = null;
      actor.clinchThrowRequestTime = 0;
      return;
    }

    actor.clinchThrowRequest = null;
    actor.clinchThrowRequestTime = 0;
    actor.clinchThrowActive = true;
    actor.clinchThrowType = actionType;
    actor.clinchThrowStartTime = now;
    actor.stamina = Math.max(0, actor.stamina - CLINCH_THROW_STAMINA_COST);

    // Consume Deep Grip on commit — snapshot whether it can break held Plant.
    actor.clinchThrowUsedDeepGrip = !!actor.hasDeepGrip;
    if (actor.hasDeepGrip) actor.hasDeepGrip = false;
    // Freeze the startup length now. A Perfect Brace hands the grip to the
    // defender mid-startup, so anything derived later would change a technique
    // that is already in the air. This value is also what the client animates
    // the windup over, so the tell completes exactly at impact.
    actor.clinchThrowAnimMs = selectTechniqueAnimationMs(
      actionType,
      actor.clinchThrowUsedDeepGrip
    );

    // Attacker leaves stance visuals; defender KEEPS Plant intent for brace.
    actor.isGrabPushing = false;
    actor.isEdgePushing = false;
    actor.isGrabWalking = false;
    actor.isAtBoundaryDuringGrab = false;
    actor.isClinchPushing = false;
    actor.isClinchPlanting = false;
    target.isBeingGrabPushed = false;
    target.isBeingEdgePushed = false;
    target.lastGrabPushStaminaDrainTime = 0;

    actor.isClinchThrowing = true;
    actor.isAttemptingGrabThrow = actionType === "throw";
    actor.isAttemptingPull = actionType === "pull";
    target.isResistingThrow = actionType === "throw";
    target.isResistingPull = actionType === "pull";

    // Defender is NOT fully input-locked — they may keep/start Plant brace.
    // Erase only a late counter-technique request (first technique owns).
    target.clinchThrowRequest = null;
    target.clinchThrowRequestTime = 0;

    const targetAction = getClinchAction(target, actor, now);
    // Kill uses Balance at commit (before initiation drain) so the advertised
    // <15 danger line matches the lethal check. Initiation drain still lands
    // on current Balance for travel scale and post-survive pressure.
    actor.clinchThrowKillBalance = typeof target.balance === "number" ? target.balance : 0;
    let stanceDrain;
    if (actionType === "pull") {
      stanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_NEUTRAL;
      if (targetAction === "push") stanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_PUSH;
      else if (targetAction === "plant") stanceDrain = CLINCH_PULL_BALANCE_DRAIN_VS_PLANT;
    } else {
      stanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_NEUTRAL;
      if (targetAction === "push") stanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_PUSH;
      else if (targetAction === "plant") stanceDrain = CLINCH_THROW_BALANCE_DRAIN_VS_PLANT;
    }
    let edgeBonus = 0;
    if (isInEdgeZone(target.x)) {
      edgeBonus = actionType === "pull"
        ? CLINCH_EDGE_PULL_DRAIN_BONUS
        : CLINCH_EDGE_THROW_DRAIN_BONUS;
    }
    const balanceDrain = stanceDrain + edgeBonus;
    target.balance = Math.max(0, target.balance - balanceDrain);
    // Remember for resist refund: successful Plant keeps only plant-tier (+ edge).
    actor.clinchThrowInitiationDrain = balanceDrain;
    actor.clinchThrowInitiationEdgeBonus = edgeBonus;

    // Snapshot for callout at LAND only — resisted/Perfect-Braced counters
    // must not flash COUNTER THROW.
    actor.clinchThrowWasCounter = targetAction === "push";
    actor.clinchStalemateStart = now;
  };

  if (eligibleCommitters.length === 1) {
    const actor = eligibleCommitters[0];
    const target = actor === player ? opponent : player;
    if (!target.clinchThrowActive) {
      commitTechnique(actor, target);
    }
  } else if (eligibleCommitters.length === 2) {
    const a = eligibleCommitters[0];
    const b = eligibleCommitters[1];
    const ta = a.clinchThrowRequestTime || 0;
    const tb = b.clinchThrowRequestTime || 0;
    const timeDiff = Math.abs(ta - tb);
    // Outside the simul window: earlier sanitized request time owns the commit.
    // Equal / inside-window pairs must not fall through to iteration order —
    // the simul block above owns those (Deep Grip priority or mutual tumble).
    if (timeDiff > CLINCH_THROW_CLASH_WINDOW_MS) {
      const actor = ta < tb ? a : b;
      const target = actor === player ? opponent : player;
      if (!target.clinchThrowActive) {
        commitTechnique(actor, target);
      }
    }
  }

  // --- Safety: clear stale target states when no active action exists ---
  const activeActor = player.clinchThrowActive ? player : (opponent.clinchThrowActive ? opponent : null);
  if (!activeActor) {
    if (player.isResistingThrow) player.isResistingThrow = false;
    if (opponent.isResistingThrow) opponent.isResistingThrow = false;
    if (player.isResistingPull) player.isResistingPull = false;
    if (opponent.isResistingPull) opponent.isResistingPull = false;
  }

  // --- Process active throw/pull ---
  if (activeActor && (activeActor.clinchThrowType === "throw" || activeActor.clinchThrowType === "pull")) {
    const activeTarget = activeActor === player ? opponent : player;
    const elapsed = now - activeActor.clinchThrowStartTime;
    const animDuration = getTechniqueAnimationMs(activeActor);

    // Arm / disarm the defender's Perfect Brace response every tick of the
    // readable startup, so a valid reaction survives a key release and a real
    // cancel sticks.
    updateTechniqueBraceArm(activeActor, activeTarget, animDuration);

    // Brace visuals: active Plant, post-release latch, or an armed fresh Brace
    // during this technique. Mid Committed→Plant cancel still must not look like
    // a completed Plant.
    if (
      isActivelyPlanting(activeTarget, activeActor, now) ||
      isBraceLatched(activeTarget, now) ||
      activeTarget.clinchBraceArmedTechnique === techniqueBraceKey(activeActor)
    ) {
      activeTarget.isClinchPlanting = true;
      activeTarget.isClinchPushing = false;
      activeTarget.clinchAction = "plant";
    } else {
      activeTarget.isClinchPlanting = false;
      if (isDrivePlantCancelPending(activeTarget, now)) {
        activeTarget.isClinchPushing = false;
        activeTarget.clinchAction = "neutral";
      }
    }

    if (elapsed >= animDuration) {
      resolveClinchThrow(activeActor, activeTarget, room, io, rooms);
    }
    maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary);
    return;
  }

  // Soft latch: while a technique request waits out the short simul window,
  // cap opposing push instead of freezing the clinch entirely.
  const requestBuffering =
    (player.clinchThrowRequest && !bufferExpired(player)) ||
    (opponent.clinchThrowRequest && !bufferExpired(opponent));
  if (requestBuffering) {
    player._clinchRequestPushCap = CLINCH_THROW_REQUEST_PUSH_CAP_MULT;
    opponent._clinchRequestPushCap = CLINCH_THROW_REQUEST_PUSH_CAP_MULT;
  } else {
    player._clinchRequestPushCap = 1;
    opponent._clinchRequestPushCap = 1;
  }

  // --- Balance and stamina effects ---
  // Identity: pressure taxes the LOSER. Pusher self-stam is a light lean (~2/s).
  // Plant is a paid brake (stam upkeep under push ≈ 4.5/s, bal regen nets ~0 mid-ring).

  // Grabber pushing
  if (grabberAction === "push") {
    player.balance = Math.max(0, player.balance - CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC * deltaSec);

    // Light lean cost (not the old 6.7/s "punished for winning" tax)
    if (!player.lastGrabStaminaDrainTime) player.lastGrabStaminaDrainTime = now;
    if (now - player.lastGrabStaminaDrainTime >= CLINCH_PUSH_SELF_STAMINA_DRAIN_INTERVAL) {
      player.stamina = Math.max(0, player.stamina - 1);
      player.lastGrabStaminaDrainTime = now;
    }

    if (opponentAction !== "push") {
      const edgeMult = isInEdgeZone(opponent.x) ? CLINCH_EDGE_BALANCE_DRAIN_MULT : 1;
      opponent.balance = Math.max(0, opponent.balance - CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC * edgeMult * deltaSec);
      // Neutral: pressure spends THEIR tank. Planters pay via plant upkeep.
      if (opponentAction !== "plant") {
        if (!opponent.lastGrabPushStaminaDrainTime) opponent.lastGrabPushStaminaDrainTime = now;
        if (now - opponent.lastGrabPushStaminaDrainTime >= CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL) {
          opponent.stamina = Math.max(0, opponent.stamina - 1);
          opponent.lastGrabPushStaminaDrainTime = now;
        }
      }
    }
  }

  // Grabber planting — brake: regen bal, pay stam (more under push)
  if (grabberAction === "plant") {
    if (!player.clinchJoltPlantInterrupt) {
      player.balance = Math.min(BALANCE_MAX, player.balance + CLINCH_PLANT_BALANCE_REGEN_PER_SEC * deltaSec);
    }
    const drainInterval = opponentAction === "push"
      ? CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL
      : CLINCH_PLANT_STAMINA_DRAIN_INTERVAL;
    if (!player.lastPlantStaminaDrainTime) player.lastPlantStaminaDrainTime = now;
    if (now - player.lastPlantStaminaDrainTime >= drainInterval) {
      player.stamina = Math.max(0, player.stamina - 1);
      player.lastPlantStaminaDrainTime = now;
    }
  }

  // Opponent pushing (only if they have grip)
  if (opponentAction === "push") {
    opponent.balance = Math.max(0, opponent.balance - CLINCH_PUSH_BALANCE_DRAIN_SELF_PER_SEC * deltaSec);

    if (!opponent.lastGrabStaminaDrainTime) opponent.lastGrabStaminaDrainTime = now;
    if (now - opponent.lastGrabStaminaDrainTime >= CLINCH_PUSH_SELF_STAMINA_DRAIN_INTERVAL) {
      opponent.stamina = Math.max(0, opponent.stamina - 1);
      opponent.lastGrabStaminaDrainTime = now;
    }

    if (grabberAction !== "push") {
      const edgeMult = isInEdgeZone(player.x) ? CLINCH_EDGE_BALANCE_DRAIN_MULT : 1;
      player.balance = Math.max(0, player.balance - CLINCH_PUSH_BALANCE_DRAIN_OPPONENT_PER_SEC * edgeMult * deltaSec);
      if (grabberAction !== "plant") {
        if (!player.lastGrabPushStaminaDrainTime) player.lastGrabPushStaminaDrainTime = now;
        if (now - player.lastGrabPushStaminaDrainTime >= CLINCH_PUSH_OPPONENT_STAMINA_DRAIN_INTERVAL) {
          player.stamina = Math.max(0, player.stamina - 1);
          player.lastGrabPushStaminaDrainTime = now;
        }
      }
    }
  }

  // Opponent planting — brake: regen bal, pay stam (more under push)
  if (opponentAction === "plant") {
    if (!opponent.clinchJoltPlantInterrupt) {
      opponent.balance = Math.min(BALANCE_MAX, opponent.balance + CLINCH_PLANT_BALANCE_REGEN_PER_SEC * deltaSec);
    }
    const drainInterval = grabberAction === "push"
      ? CLINCH_PLANT_STAMINA_DRAIN_PUSHED_INTERVAL
      : CLINCH_PLANT_STAMINA_DRAIN_INTERVAL;
    if (!opponent.lastPlantStaminaDrainTime) opponent.lastPlantStaminaDrainTime = now;
    if (now - opponent.lastPlantStaminaDrainTime >= drainInterval) {
      opponent.stamina = Math.max(0, opponent.stamina - 1);
      opponent.lastPlantStaminaDrainTime = now;
    }
  }

  // --- Neutral = breathing: recover stamina while not being pushed ---
  // Gassed players are excluded (the gassed system owns their recovery), and
  // being pushed while neutral stays a net loss — rest must be earned.
  for (const [p, pAction, oAction] of [
    [player, grabberAction, opponentAction],
    [opponent, opponentAction, grabberAction],
  ]) {
    if (pAction === "neutral" && oAction !== "push" && !p.isGassed && p.stamina < 100) {
      p.stamina = Math.min(100, p.stamina + CLINCH_NEUTRAL_STAMINA_REGEN_PER_SEC * deltaSec);
    }
  }

  // --- Deep grip: winning the push ---
  // Pushing continuously while the opponent doesn't answer with their own
  // push (they plant or stand neutral) for DEEP_GRIP_PUSH_WIN_MS earns the
  // deep grip. Any break in the condition resets the timer. Skip during the
  // Phase A burst and while the opponent is arm-clamped.
  for (const [p, o, pAction, oAction] of [
    [player, opponent, grabberAction, opponentAction],
    [opponent, player, opponentAction, grabberAction],
  ]) {
    const winningPush = pAction === "push" && oAction !== "push" &&
      p.hasGrip && o.hasGrip && !p.hasDeepGrip &&
      !player.isGrabPushing && !o.isArmClamped;
    if (winningPush) {
      if (!p.deepGripPushStart) {
        p.deepGripPushStart = now;
      } else if (now - p.deepGripPushStart >= DEEP_GRIP_PUSH_WIN_MS) {
        grantDeepGrip(p, o, room, io, "push");
        p.deepGripPushStart = 0;
      }
    } else if (p.deepGripPushStart) {
      p.deepGripPushStart = 0;
    }
  }

  // --- Push momentum ramp timer (committed drive vs neutral only) ---
  for (const [p, pAction, oAction] of [
    [player, grabberAction, opponentAction],
    [opponent, opponentAction, grabberAction],
  ]) {
    if (pAction === "push" && p.isClinchCommittedDrive && oAction === "neutral") {
      if (!p.clinchPushRampStart) p.clinchPushRampStart = now;
    } else if (p.clinchPushRampStart) {
      p.clinchPushRampStart = 0;
    }
  }

  // --- Open-punish shove blend (eased, so Open's edges don't snap velocity) ---
  updateOpenPunishBlend(player, opponent, grabberAction, delta);
  updateOpenPunishBlend(opponent, player, opponentAction, delta);

  // --- Major push-war loss → brief Open (readable shove collapse) ---
  if (grabberAction === "push" && opponentAction === "push") {
    const { speed, t } = getPushVsPushSpeed(
      getShovePower(player) - getShovePower(opponent)
    );
    if (t >= CLINCH_PUSH_LOSS_OPEN_T && speed !== 0) {
      const loser = speed > 0 ? opponent : player;
      const winner = speed > 0 ? player : opponent;
      if (!loser.clinchPushLossStart) loser.clinchPushLossStart = now;
      winner.clinchPushLossStart = 0;
      if (
        !isClinchOpen(loser) &&
        now - loser.clinchPushLossStart >= CLINCH_PUSH_LOSS_OPEN_MS
      ) {
        applyClinchOpen(loser, CLINCH_PUSH_LOSS_OPEN_DURATION_MS, room);
        loser.clinchPushLossStart = 0;
      }
    } else {
      player.clinchPushLossStart = 0;
      opponent.clinchPushLossStart = 0;
    }
  } else {
    player.clinchPushLossStart = 0;
    opponent.clinchPushLossStart = 0;
  }

  // --- Movement ---
  // Burst owns displacement this tick — don't double-apply Phase B shove.
  if (burstMovementApplied) {
    return;
  }

  let netPushSpeed = 0; // positive = toward opponent's side

  if (grabberAction === "push" && opponentAction === "push") {
    // Stamina tank decides who walks. Loser bleeds stam (walk snowballs) +
    // balance (throw window) — scaled by advantage. Winner only pays light lean.
    const { speed, t } = getPushVsPushSpeed(
      getShovePower(player) - getShovePower(opponent)
    );
    netPushSpeed = speed;
    if (speed > 0) {
      player.clinchShoveLead = 1;
      opponent.clinchShoveLead = -1;
    } else if (speed < 0) {
      player.clinchShoveLead = -1;
      opponent.clinchShoveLead = 1;
    } else {
      // Equal tanks — honest standstill. HUD shows EVEN.
      player.clinchShoveLead = 0;
      opponent.clinchShoveLead = 0;
    }
    if (t > 0) {
      const loser = speed >= 0 ? opponent : player;
      const edgeMult = isInEdgeZone(loser.x) ? CLINCH_EDGE_BALANCE_DRAIN_MULT : 1;
      loser.balance = Math.max(
        0,
        loser.balance - CLINCH_PUSH_VS_PUSH_LOSER_BAL_DRAIN_PER_SEC * t * edgeMult * deltaSec
      );
      loser.stamina = Math.max(
        0,
        loser.stamina - CLINCH_PUSH_VS_PUSH_LOSER_STAM_DRAIN_PER_SEC * t * deltaSec
      );
    }
  } else if (grabberAction === "push") {
    netPushSpeed =
      CLINCH_PUSH_BASE_SPEED *
      getPushForceMult(player) *
      getShoveMult(player, opponent, opponentAction, now);
  } else if (opponentAction === "push") {
    // negative = toward grabber's side
    netPushSpeed =
      -1 *
      CLINCH_PUSH_BASE_SPEED *
      getPushForceMult(opponent) *
      getShoveMult(opponent, player, grabberAction, now);
  }

  // Soft latch during short technique simul window — cap shove, don't freeze.
  const pushCap = Math.min(
    player._clinchRequestPushCap || 1,
    opponent._clinchRequestPushCap || 1
  );
  if (pushCap < 1) netPushSpeed *= pushCap;

  // Apply movement
  if (Math.abs(netPushSpeed) > 0.001) {
    // Determine direction: positive netPushSpeed = grabber pushes opponent back
    const pushDir = player.x < opponent.x ? 1 : -1;
    const moveDelta =
      pushDir * clampShoveSpeed(netPushSpeed) * delta * speedFactor;

    let newX = player.x + moveDelta;
    let newOppX = player.x < opponent.x
      ? newX + fixedDistance
      : newX - fixedDistance;

    // Boundary checks
    const oppAtLeft = newOppX <= leftBoundary;
    const oppAtRight = newOppX >= rightBoundary;
    const grabberAtLeft = newX <= leftBoundary;
    const grabberAtRight = newX >= rightBoundary;

    // Check opponent boundary (being pushed to edge)
    if ((oppAtLeft || oppAtRight) && !room.gameOver && netPushSpeed > 0) {
      player.isAtBoundaryDuringGrab = true;
      player.isEdgePushing = true;
      opponent.isBeingEdgePushed = true;
      clearEdgePinHold(player); // only the victim accumulates hold time
      // Extra stamina drain at edge — races the 1.5s positional hold
      if (!opponent.lastGrabPushStaminaDrainTime) opponent.lastGrabPushStaminaDrainTime = now;
      if (now - opponent.lastGrabPushStaminaDrainTime >= GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL) {
        opponent.stamina = Math.max(0, opponent.stamina - 1);
        opponent.lastGrabPushStaminaDrainTime = now;
      }
      if (tryEdgePinRingOut(player, opponent, room, io, rooms, oppAtLeft ? -1 : 1, delta)) {
        return;
      }
      newOppX = oppAtLeft ? leftBoundary : rightBoundary;
      newX = player.x < opponent.x
        ? newOppX - fixedDistance
        : newOppX + fixedDistance;
    }
    // Check grabber boundary (being pushed back to edge)
    else if ((grabberAtLeft || grabberAtRight) && !room.gameOver && netPushSpeed < 0) {
      opponent.isAtBoundaryDuringGrab = true;
      opponent.isEdgePushing = true;
      player.isBeingEdgePushed = true;
      clearEdgePinHold(opponent);
      if (!player.lastGrabPushStaminaDrainTime) player.lastGrabPushStaminaDrainTime = now;
      if (now - player.lastGrabPushStaminaDrainTime >= GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL) {
        player.stamina = Math.max(0, player.stamina - 1);
        player.lastGrabPushStaminaDrainTime = now;
      }
      if (tryEdgePinRingOut(opponent, player, room, io, rooms, grabberAtLeft ? -1 : 1, delta)) {
        return;
      }
      newX = grabberAtLeft ? leftBoundary : rightBoundary;
      newOppX = player.x < opponent.x
        ? newX + fixedDistance
        : newX - fixedDistance;
    } else {
      player.isAtBoundaryDuringGrab = false;
      player.isEdgePushing = false;
      opponent.isBeingEdgePushed = false;
      opponent.isAtBoundaryDuringGrab = false;
      opponent.isEdgePushing = false;
      player.isBeingEdgePushed = false;
      clearEdgePinHold(player, opponent);
    }

    newX = Math.max(leftBoundary, Math.min(newX, rightBoundary));
    newOppX = Math.max(leftBoundary, Math.min(newOppX, rightBoundary));

    player.x = newX;
    opponent.x = newOppX;
  } else {
    // No movement — keep attached; pin hold breaks if shove isn't driving the wall
    player.isAtBoundaryDuringGrab = false;
    player.isEdgePushing = false;
    opponent.isBeingEdgePushed = false;
    opponent.isAtBoundaryDuringGrab = false;
    opponent.isEdgePushing = false;
    player.isBeingEdgePushed = false;
    clearEdgePinHold(player, opponent);

    opponent.x = player.x < opponent.x
      ? player.x + fixedDistance
      : player.x - fixedDistance;
  }

  // Keep facing locked
  if (!opponent.atTheRopesFacingDirection) {
    opponent.facing = player.x < opponent.x ? 1 : -1;
  }
  if (!player.atTheRopesFacingDirection) {
    player.facing = player.x < opponent.x ? -1 : 1;
  }

  player.movementVelocity = 0;
  opponent.movementVelocity = 0;
}

// Maintain fixed distance between clinched players (used when movement is paused)
function maintainClinchPositions(player, opponent, fixedDistance, leftBoundary, rightBoundary) {
  opponent.x = player.x < opponent.x
    ? player.x + fixedDistance
    : player.x - fixedDistance;
  // Boundary clamp: hard-attaching the opponent can place them past the map
  // edge when the grabber stands near it (jolt/clash freezes). Shift the PAIR
  // back inside while preserving the clinch distance — mirrors the boundary
  // pin used by the burst-push path.
  if (opponent.x > rightBoundary) {
    player.x -= opponent.x - rightBoundary;
    opponent.x = rightBoundary;
  } else if (opponent.x < leftBoundary) {
    player.x += leftBoundary - opponent.x;
    opponent.x = leftBoundary;
  }
  if (!opponent.atTheRopesFacingDirection) opponent.facing = player.x < opponent.x ? 1 : -1;
  if (!player.atTheRopesFacingDirection) player.facing = player.x < opponent.x ? -1 : 1;
  player.movementVelocity = 0;
  opponent.movementVelocity = 0;
}

// Clear active clinch throw/pull state
function clearClinchThrowState(actor) {
  actor.clinchThrowActive = false;
  actor.clinchThrowType = null;
  actor.clinchThrowStartTime = 0;
  actor.clinchThrowAnimMs = 0;
  actor.clinchThrowKillBalance = null;
  actor.clinchThrowInitiationDrain = 0;
  actor.clinchThrowInitiationEdgeBonus = 0;
  actor.isClinchThrowing = false;
  actor.isAttemptingGrabThrow = false;
  actor.isAttemptingPull = false;
}

// On Plant resist / Perfect Brace: refund initiation above plant-tier so a
// successful brace doesn't keep the push/neutral tax from commit. Edge bonus
// stays (rope danger). Landed techniques keep the full initiation drain.
function refundResistedThrowInitiation(target, actionType, paid, edgeBonus) {
  const plantTier =
    actionType === "pull"
      ? CLINCH_PULL_BALANCE_DRAIN_VS_PLANT
      : CLINCH_THROW_BALANCE_DRAIN_VS_PLANT;
  const paidAmt = typeof paid === "number" ? paid : 0;
  const edgeAmt = typeof edgeBonus === "number" ? edgeBonus : 0;
  const refund = Math.max(0, paidAmt - (plantTier + edgeAmt));
  if (refund > 0) {
    target.balance = Math.min(BALANCE_MAX, target.balance + refund);
  }
}

// Execute a clinch break — defensive escape from mutual clinch.
// Breaker pays heavy stamina (gasses if under-budget). Stamina only — no posture cost.
// Both players are knocked apart symmetrically (boundary-clamped, so edge stress
// is preserved — the breaker can't escape an edge corner this way).
// Breaker gets brief grab-immunity after the tween so the opponent can't immediately re-clinch.
function executeClinchBreak(breaker, opponent, room, io) {
  const now = simNow(room);

  // Apply stamina cost to the breaker. Soft-gate: stamina goes negative-clamped, and
  // the natural gassed mechanism in index.js auto-triggers when stamina hits 0.
  breaker.stamina = Math.max(0, breaker.stamina - GRAB_BREAK_STAMINA_COST);

  cleanupGrabStates(breaker, opponent);

  // Set break visual states — both players animate together.
  breaker.isGrabBreaking = true;
  opponent.isGrabBreakCountered = true;

  // Symmetric separation tween. Boundary clamp preserves edge position
  // (a breaker pinned at the edge stays at the edge — they can't escape positionally).
  const halfDist = GRAB_BREAK_FORCED_DISTANCE / 2;
  const breakerDir = breaker.x < opponent.x ? -1 : 1;
  const opponentDir = -breakerDir;
  const breakerTargetX = Math.max(MAP_LEFT_BOUNDARY,
    Math.min(MAP_RIGHT_BOUNDARY, breaker.x + breakerDir * halfDist));
  const opponentTargetX = Math.max(MAP_LEFT_BOUNDARY,
    Math.min(MAP_RIGHT_BOUNDARY, opponent.x + opponentDir * halfDist));

  // Wire the tween — index.js drives it via grabBreakSepStartTime/Duration/Start/Target,
  // and the same end-of-tween handler clears isGrabBreaking/isGrabBreakCountered.
  for (const [p, targetX] of [[breaker, breakerTargetX], [opponent, opponentTargetX]]) {
    p.isGrabBreakSeparating = true;
    p.grabBreakSepStartTime = now;
    p.grabBreakSepDuration = GRAB_BREAK_TWEEN_DURATION;
    p.grabBreakStartX = p.x;
    p.grabBreakTargetX = targetX;
    p.movementVelocity = 0;
    p.knockbackVelocity.x = 0;
    p.knockbackVelocity.y = 0;
    p.isStrafing = false;
  }

  // Symmetric input lock for both players — clinch break always resolves to a
  // 100% neutral state regardless of breaker position. Boundary-clamped slides
  // (one or both players being unable to slide the full halfDist because of the
  // map edge) do NOT shorten or lengthen the recovery window; the lock is a
  // fixed 350ms timer independent of actual distance traveled.
  //
  // Corner stress is already preserved through the positional and resource
  // costs (breaker stays pinned at the edge, loses 30 stamina) — there's no
  // need to layer a timing disadvantage on top of those.
  breaker.inputLockUntil = Math.max(breaker.inputLockUntil || 0, now + GRAB_BREAK_INPUT_LOCK_MS);
  opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, now + GRAB_BREAK_INPUT_LOCK_MS);

  // Re-grab protection on the breaker — covers the tween + a small post-tween window
  // so the opponent can't punish-grab the moment they recover.
  breaker.grabImmune = true;
  breaker.grabImmuneEndTime = now + GRAB_BREAK_INPUT_LOCK_MS + GRAB_BREAK_GRAB_IMMUNITY_MS;

  // Facing — players face each other after separating
  correctFacingAfterGrabOrThrow(breaker, opponent);

  // Reset stalemate timers (the clinch is ending)
  breaker.clinchStalemateStart = 0;
  opponent.clinchStalemateStart = 0;

  // Emit visual/audio event. breakerPlayerNumber: room.players[0] = 1, [1] = 2.
  const breakerPlayerNumber = room.players.indexOf(breaker) === 0 ? 1 : 2;
  const breakId = `break-${now}-${breaker.id}`;
  const seamX = (breaker.x + opponent.x) / 2;
  const clinchId = ensureClinchInstanceId(breaker, opponent, now);
  io.in(room.id).emit(
    "grab_break",
    attachCombatPresentation(
      {
        breakerId: breaker.id,
        grabberId: opponent.id,
        breakerX: breaker.x,
        grabberX: opponent.x,
        breakId,
        breakerPlayerNumber,
      },
      buildClinchPresentation({
        interactionType: CLINCH_INTERACTION.GRAB_BREAK,
        clinchInstanceId: clinchId,
        actionInstanceId: breakId,
        initiator: breaker,
        responder: opponent,
        outcome: "BREAK",
        contactX: seamX,
        contactY: CLINCH_EFFECT_MID_Y,
        salt: "break",
      })
    )
  );
}

// Resolve throw/pull after startup. Both techniques share the same matrix:
// held Plant resists (unless Deep Grip was consumed on commit); Perfect Brace
// beats even Deep Grip. Balance only chooses kill vs non-kill + travel scale.
function resolveClinchThrow(actor, target, room, io, rooms) {
  const actionType = actor.clinchThrowType;
  // Post-initiation Balance: travel scale / survivor state after a non-kill land.
  const targetBalance = target.balance;
  // Pre-initiation Balance: kill decision only (matches UI danger at 15).
  const killBalance =
    typeof actor.clinchThrowKillBalance === "number"
      ? actor.clinchThrowKillBalance
      : targetBalance;
  const usedDeepGrip = !!actor.clinchThrowUsedDeepGrip;
  const wasCounter = !!actor.clinchThrowWasCounter;
  // Copy before clear — resist refund needs commit initiation amounts.
  const initiationDrain = actor.clinchThrowInitiationDrain;
  const initiationEdgeBonus = actor.clinchThrowInitiationEdgeBonus;
  // Read the startup length from the commit snapshot BEFORE clearing it, so the
  // Brace window resolved at impact is the same one the defender was watching.
  const animDuration = getTechniqueAnimationMs(actor);
  actor.clinchThrowUsedDeepGrip = false;
  actor.clinchThrowWasCounter = false;
  const impactNow = simNow(room);
  // Last chance to catch a Brace that landed after the final startup tick.
  updateTechniqueBraceArm(actor, target, animDuration);
  const { perfectBrace, bracing } = getClinchThrowDefense(
    actor,
    target,
    impactNow,
    animDuration
  );

  clearClinchThrowState(actor);
  target.clinchBraceArmedTechnique = null;
  target.isResistingThrow = false;
  target.isResistingPull = false;

  const emitCounterThrowCallout = () => {
    if (!wasCounter) return;
    const calloutId = `clinch-callout-${simNow(room)}-${actor.id}`;
    const seamX = (actor.x + target.x) / 2;
    const clinchId = ensureClinchInstanceId(actor, target, simNow(room));
    io.in(room.id).emit(
      "clinch_callout",
      attachCombatPresentation(
        {
          type: "counter_throw",
          actorId: actor.id,
          targetId: target.id,
          actionType,
          playerNumber: room.players.indexOf(actor) === 0 ? 1 : 2,
          calloutId,
          x: seamX,
        },
        buildClinchPresentation({
          interactionType: CLINCH_INTERACTION.COUNTER_THROW_CALLOUT,
          clinchInstanceId: clinchId,
          actionInstanceId: calloutId,
          initiator: actor,
          responder: target,
          outcome: "COUNTER_THROW",
          throwType: actionType,
          contactX: seamX,
          contactY: CLINCH_EFFECT_MID_Y,
          salt: "counter_throw",
        })
      )
    );
  };

  const applyResistedCosts = () => {
    // Successful Plant: keep plant-tier initiation only; thrower owns the fail.
    refundResistedThrowInitiation(
      target,
      actionType,
      initiationDrain,
      initiationEdgeBonus
    );
    if (CLINCH_THROW_FAIL_BALANCE_DRAIN > 0) {
      target.balance = Math.max(0, target.balance - CLINCH_THROW_FAIL_BALANCE_DRAIN);
    }
    const selfBalDrain = actionType === "pull"
      ? CLINCH_PULL_FAIL_SELF_BALANCE_DRAIN
      : CLINCH_THROW_FAIL_SELF_BALANCE_DRAIN;
    actor.balance = Math.max(0, actor.balance - selfBalDrain);
    actor.stamina = Math.max(0, actor.stamina - CLINCH_THROW_FAIL_STAMINA_COST);
  };

  // --- PERFECT BRACE: an active in-startup Brace beats even Deep Grip ---
  if (perfectBrace) {
    applyResistedCosts();
    // The attempt paid for itself: a correct read is free, so only fishing taxes
    // the tank that powers your shove. Refund first (it needs the attempt), then
    // retire the cycle — landing the read leaves you ready for the next
    // exchange, while a wasted press is still settling.
    refundBraceAttempt(target);
    clearBraceAttempt(target);
    try {
      const { noteCommandReject, INPUT_REJECT } = require("./inputCommandRejection");
      const { pushInputCommandTrace, INPUT_COMMAND_STAGE } = require("./inputCommandTrace");
      noteCommandReject(actor, INPUT_REJECT.DEFENDER_PERFECT_BRACE, {
        command: actionType === "pull" ? "clinch_pull" : "clinch_throw",
        stage: "RESOLVED_AND_DEFENDED",
      });
      pushInputCommandTrace(actor.id, INPUT_COMMAND_STAGE.COMMAND_REJECTED, {
        command: actionType,
        reason: INPUT_REJECT.DEFENDER_PERFECT_BRACE,
        concept: "THROW_ATTEMPT_RESOLVED_AND_DEFENDED",
        hasDeepGripUsed: !!usedDeepGrip,
      });
    } catch (_) { /* diagnostics optional */ }

    applyClinchOpen(actor, CLINCH_PERFECT_BRACE_OPEN_MS, room);
    grantDeepGrip(target, actor, room, io, "perfect_brace");

    // Impact beat: freeze harder than ordinary resistance, then hand the turn
    // over. Open timers run on the sim clock (frozen during hitstop), so the
    // freeze and the recovery add up instead of overlapping.
    triggerHitstopAndEmit(
      io,
      room,
      CLINCH_PERFECT_BRACE_HITSTOP_MS,
      "clinch_perfect_brace"
    );
    emitThrottledScreenShake(room, io, {
      type: "grab_clash",
      scale: 1.15,
      force: true,
    });

    target.isClinchPerfectBracing = true;
    setPlayerTimeout(target.id, () => {
      target.isClinchPerfectBracing = false;
    }, CLINCH_PERFECT_BRACE_FLASH_MS, "clinchPerfectBraceFlash");

    {
      const failId = `perfect-brace-${simNow(room)}-${target.id}`;
      const seamX = (actor.x + target.x) / 2;
      const clinchId = ensureClinchInstanceId(actor, target, simNow(room));
      io.in(room.id).emit(
        "clinch_throw_fail",
        attachCombatPresentation(
          {
            actorId: actor.id,
            targetId: target.id,
            actionType,
            actorX: actor.x,
            targetX: target.x,
            resistedByPlant: true,
            perfectBrace: true,
            playerNumber: room.players.indexOf(target) === 0 ? 1 : 2,
            failId,
          },
          buildClinchPresentation({
            interactionType: CLINCH_INTERACTION.PERFECT_BRACE,
            clinchInstanceId: clinchId,
            actionInstanceId: failId,
            initiator: target,
            responder: actor,
            outcome: "PERFECT_BRACE",
            throwType: actionType,
            contactX: seamX,
            contactY: CLINCH_EFFECT_MID_Y,
            salt: "perfect_brace",
          })
        )
      );
    }
    target.clinchBraceSimTime = 0;
    target.clinchBraceLatchUntil = 0;
    return;
  }

  // --- RESISTED: held Plant beats a normal technique; Deep Grip breaks Plant ---
  if (bracing && !usedDeepGrip) {
    applyResistedCosts();

    applyClinchOpen(actor, CLINCH_THROW_FAIL_STAGGER_MS, room);

    // Ordinary resistance still needs a readable contact beat — without it the
    // exchange resolved so fast that neither player could see what happened.
    // Deliberately lighter than Perfect Brace so the two stay distinguishable.
    triggerHitstopAndEmit(
      io,
      room,
      CLINCH_THROW_RESISTED_HITSTOP_MS,
      "clinch_throw_resisted"
    );
    emitThrottledScreenShake(room, io, {
      type: "clinch_jolt",
      scale: 0.85,
      force: true,
    });

    {
      const failId = `clinch-fail-${simNow(room)}-${actor.id}`;
      const seamX = (actor.x + target.x) / 2;
      const clinchId = ensureClinchInstanceId(actor, target, simNow(room));
      io.in(room.id).emit(
        "clinch_throw_fail",
        attachCombatPresentation(
          {
            actorId: actor.id,
            targetId: target.id,
            actionType,
            actorX: actor.x,
            targetX: target.x,
            resistedByPlant: true,
            playerNumber: room.players.indexOf(target) === 0 ? 1 : 2,
            failId,
          },
          buildClinchPresentation({
            interactionType: CLINCH_INTERACTION.THROW_FAIL,
            clinchInstanceId: clinchId,
            actionInstanceId: failId,
            initiator: actor,
            responder: target,
            outcome: "DEFENDED",
            throwType: actionType,
            contactX: seamX,
            contactY: CLINCH_EFFECT_MID_Y,
            salt: "throw_fail",
          })
        )
      );
    }
    target.clinchBraceSimTime = 0;
    target.clinchBraceLatchUntil = 0;
    return;
  }

  // --- KILL: Balance at commit below threshold → round over ---
  const isKill = killBalance < CLINCH_THROW_KILL_THRESHOLD && !room.gameOver;
  target.clinchBraceSimTime = 0;
  target.clinchBraceLatchUntil = 0;
  // Technique landed — counter callout only now (never on resist / Perfect Brace).
  emitCounterThrowCallout();

  if (actionType === "pull") {
    // Snapshot the victim's facing before any facing-correction — kill pulls
    // preserve it so the belly-laying slam stays oriented as the victim was.
    const targetFacingBeforeKill = target.facing;
    const pullDirection = target.x < actor.x ? 1 : -1;
    const pullDist = isKill
      ? CLINCH_KILL_PULL_DISTANCE
      : scaledClinchTechniqueDistance(
          targetBalance,
          CLINCH_PULL_DISTANCE_MIN,
          CLINCH_PULL_DISTANCE_MAX
        );
    const pullTweenDur = isKill ? CLINCH_KILL_PULL_TWEEN_DURATION : CLINCH_PULL_TWEEN_DURATION;
    const pullLockMs = isKill ? CLINCH_KILL_PULL_INPUT_LOCK_MS : CLINCH_PULL_INPUT_LOCK_MS;
    // Kill pull drives the opponent THROUGH the thrower and down — same travel
    // direction as the non-kill pull (past the puller), just slammed onto the ice.
    let targetX = actor.x + pullDirection * pullDist;

    // Boundary pull detection: when the puller's back is against a wall,
    // a normal pull can't send the target far enough past for a clean side switch.
    // Use a position swap instead — both players trade positions with a hop arc.
    // Kill pulls bypass this — the victim must fly past the puller and through
    // the dohyo edge for the cinematic, regardless of where the puller is standing.
    const leftBound = MAP_LEFT_BOUNDARY + PULL_BOUNDARY_MARGIN;
    const rightBound = MAP_RIGHT_BOUNDARY - PULL_BOUNDARY_MARGIN;
    const clampedTargetX = Math.max(leftBound, Math.min(targetX, rightBound));
    const distPastActor = pullDirection === -1
        ? actor.x - clampedTargetX
        : clampedTargetX - actor.x;
    const isBoundaryPull = !isKill && distPastActor < CLINCH_THROW_MIN_SEPARATION;

    let actorTweenTargetX = null;
    let effectiveTweenDur = pullTweenDur;
    let effectiveLockMs = pullLockMs;

    if (isBoundaryPull) {
      const actorOriginalX = actor.x;
      const targetOriginalX = target.x;
      targetX = Math.max(leftBound, Math.min(actorOriginalX, rightBound));
      actorTweenTargetX = targetOriginalX;
      effectiveTweenDur = CLINCH_PULL_SWAP_TWEEN_DURATION;
      effectiveLockMs = CLINCH_PULL_SWAP_TWEEN_DURATION;
    }

    cleanupGrabStates(actor, target);

    target.isBeingPullReversaled = true;
    target.pullReversalPullerId = actor.id;
    target.isGrabBreakSeparating = true;
    target.grabBreakSepStartTime = simNow(room);
    target.grabBreakSepDuration = effectiveTweenDur;
    target.grabBreakStartX = target.x;
    target.grabBreakTargetX = targetX;

    if (isBoundaryPull) {
      target.isBoundaryPullSwap = true;
      actor.isBoundaryPullSwap = true;
      actor.isGrabBreakSeparating = true;
      actor.grabBreakSepStartTime = simNow(room);
      actor.grabBreakSepDuration = effectiveTweenDur;
      actor.grabBreakStartX = actor.x;
      actor.grabBreakTargetX = actorTweenTargetX;
    }

    target.movementVelocity = 0;
    actor.movementVelocity = 0;
    target.isStrafing = false;
    actor.isStrafing = false;

    const lockUntil = simNow(room) + effectiveLockMs;
    target.inputLockUntil = Math.max(target.inputLockUntil || 0, lockUntil);
    actor.inputLockUntil = Math.max(actor.inputLockUntil || 0, lockUntil);

    // Face using post-pull destinations — the victim switches sides during the
    // tween, so correcting from current X leaves both facing away after the yank.
    // pullFacingDirection locks that commit until tween settle (facingSystem).
    const pullFacingAnchorX = isBoundaryPull ? actorTweenTargetX : actor.x;
    if (!actor.atTheRopesFacingDirection) {
      actor.facing = pullFacingAnchorX < targetX ? -1 : 1;
      actor.pullFacingDirection = actor.facing;
    }
    if (!target.atTheRopesFacingDirection) {
      target.facing = targetX < pullFacingAnchorX ? -1 : 1;
      target.pullFacingDirection = target.facing;
    }
    if (isActionFacingOwnershipV2Enabled()) {
      for (const p of [actor, target]) {
        if (p.atTheRopesFacingDirection) continue;
        const id = mintActionFacingInstanceId(p, ACTION_FACING_OWNER.PULL);
        p.pullFacingInstanceId = id;
        acquireActionFacingLock(p, {
          ownerType: ACTION_FACING_OWNER.PULL,
          ownerInstanceId: id,
          direction: p.facing,
          reason: ACTION_FACING_REASON.SIDE_SWITCH,
          allowDirectionUpdate: false,
          supersede: true,
          syncLegacy: false,
        });
      }
    }
    // clearClinchThrowState dropped the startup pull pose — re-arm for the yank.
    actor.isAttemptingPull = true;

    if (isKill) {
      target.isClinchKillPullVictim = true;
      handleWinCondition(room, target, actor, io, "clinchKillPull");
      // Re-assert after win cleanup so MAP boundary exemption stays armed.
      target.isClinchKillPullVictim = true;
      target.isBeingPullReversaled = true;
      target.pullReversalPullerId = actor.id;
      target.isGrabBreakSeparating = true;
      target.grabBreakSepStartTime = simNow(room);
      target.grabBreakSepDuration = effectiveTweenDur;
      target.grabBreakStartX = target.x;
      target.grabBreakTargetX = targetX;
      // Belly-laying finisher: the victim is slammed flat where they stand, so
      // keep whatever direction they were already facing (no flip toward the pull).
      target.facing = targetFacingBeforeKill;
    }

    actor.grabCooldown = true;
    setPlayerTimeout(actor.id, () => { actor.grabCooldown = false; }, 300, "pullCooldown");
  } else {
    // Throw lands: forward arc throw — pushes opponent away from thrower
    //
    // IMPORTANT: `throwDir` / `throwingFacingDirection` are WORLD TRAVEL signs
    // (+1 = +X, −1 = −X) for victim trajectory — NOT sprite facing.
    // Facing convention is inverted (facing −1 faces +X / right). Legacy
    // presentation freezes via `isThrowing → player.facing` and never applies
    // throwDir to the thrower’s sprite. An old over-the-head throw once used
    // throwDir as facing; forward W+Mouse2 must not revive that flip under V2.
    const throwDir = actor.x < target.x ? 1 : -1;
    // Non-kill: stamp distance / height / duration from the same Balance lerp so
    // weak tosses stay forward-biased (more X, less Y, snappier) instead of a hop.
    const throwDuration = isKill
      ? CLINCH_KILL_THROW_DURATION_MS
      : scaledClinchTechniqueDistance(
          targetBalance,
          CLINCH_THROW_DURATION_MIN_MS,
          CLINCH_THROW_DURATION_MAX_MS
        );
    const throwerPresentationFacing =
      actor.facing === 1 || actor.facing === -1 ? actor.facing : -1;

    cleanupGrabStates(actor, target);
    actor.isThrowing = true;
    actor.isClinchKillThrow = isKill;
    actor.clinchThrowArcDistance = isKill
      ? 0
      : scaledClinchTechniqueDistance(
          targetBalance,
          CLINCH_THROW_DISTANCE_MIN,
          CLINCH_THROW_DISTANCE_MAX
        );
    actor.clinchThrowArcHeight = isKill
      ? 0
      : scaledClinchTechniqueDistance(
          targetBalance,
          CLINCH_THROW_ARC_HEIGHT_MIN,
          CLINCH_THROW_ARC_HEIGHT_MAX
        );
    const hitstopMs = isKill ? 0 : HITSTOP_THROW_MS;
    // Sim clock pauses during the throw hitstop triggered below, so the throw
    // arc starts right after the freeze with NO manual +hitstopMs offset
    // (the old wall-clock version had to delay throwStartTime past the freeze).
    actor.throwStartTime = simNow(room);
    actor.throwEndTime = simNow(room) + throwDuration;
    actor.throwOpponent = target.id;
    actor.throwingFacingDirection = throwDir;
    if (isActionFacingOwnershipV2Enabled()) {
      const throwerId = mintActionFacingInstanceId(
        actor,
        ACTION_FACING_OWNER.THROWER
      );
      actor.throwFacingInstanceId = throwerId;
      acquireActionFacingLock(actor, {
        ownerType: ACTION_FACING_OWNER.THROWER,
        ownerInstanceId: throwerId,
        // Match flag-off: committed clinch/forward presentation facing.
        direction: throwerPresentationFacing,
        reason: ACTION_FACING_REASON.THROW,
        allowDirectionUpdate: false,
        supersede: true,
        syncLegacy: false,
      });
    }
    // Non-kill throws are repositioning tools — keep victim inside the margin so
    // the tick-order win check can't ring them out while still pinned at the edge.
    if (!isKill) {
      const leftBound = MAP_LEFT_BOUNDARY + CLINCH_THROW_BOUNDARY_MARGIN;
      const rightBound = MAP_RIGHT_BOUNDARY - CLINCH_THROW_BOUNDARY_MARGIN;
      target.x = Math.max(leftBound, Math.min(target.x, rightBound));
    }
    clearAllActionStates(target);
    target.isBeingThrown = true;
    target.isHit = true;
    target.beingThrownFacingDirection = target.facing;
    if (isActionFacingOwnershipV2Enabled()) {
      const victimId = mintActionFacingInstanceId(
        target,
        ACTION_FACING_OWNER.THROW_VICTIM
      );
      target.throwVictimFacingInstanceId = victimId;
      acquireActionFacingLock(target, {
        ownerType: ACTION_FACING_OWNER.THROW_VICTIM,
        ownerInstanceId: victimId,
        direction: target.facing,
        reason: ACTION_FACING_REASON.THROW,
        allowDirectionUpdate: false,
        supersede: true,
        syncLegacy: false,
      });
    }
    target.inputLockUntil = Math.max(target.inputLockUntil || 0, simNow(room) + throwDuration + 100);
    if (isKill) {
      target.isClinchKillThrowVictim = true;
      const launchId = `kill-throw-${simNow(room)}-${actor.id}`;
      const clinchId = ensureClinchInstanceId(actor, target, simNow(room));
      io.in(room.id).emit(
        "clinch_kill_throw",
        attachCombatPresentation(
          {
            victimId: target.id,
            throwerId: actor.id,
            victimX: target.x,
            hitstopMs: 0,
            durationMs: throwDuration,
            throwDir,
            launchId,
          },
          buildClinchPresentation({
            interactionType: CLINCH_INTERACTION.KILL_THROW_LAUNCH,
            clinchInstanceId: clinchId,
            actionInstanceId: launchId,
            initiator: actor,
            responder: target,
            outcome: "LAUNCH",
            throwType: "throw",
            contactX: target.x,
            contactY: target.y,
            movementX: throwDir,
            salt: "kill_launch",
          })
        )
      );
    }
    if (hitstopMs > 0) triggerHitstopAndEmit(io, room, hitstopMs, "clinch_throw");
  }
}

function triggerRingOut(pusher, victim, room, io, rooms, direction) {
  // FORCE OUT: no freeze / throw hop. Keep the live push pose and walk both
  // fighters a short distance past the rope during the round-result callout.
  const pushDir =
    direction || (pusher.x < victim.x ? 1 : -1);
  const pusherStartX = pusher.x;
  const victimStartX = victim.x;

  // Snapshot the exact clinch/push pose before win cleanup wipes it — loser
  // stays in gripped clinch (grabbing body + arms), not the beingGrabbed fall-back.
  const pose = {
    pusherGrabPushing: !!pusher.isGrabPushing,
    pusherClinchPushing: !!pusher.isClinchPushing,
    pusherEdgePushing: !!pusher.isEdgePushing,
    pusherCommittedDrive: !!pusher.isClinchCommittedDrive,
    pusherBeltHolding: !!pusher.isClinchBeltHolding,
    pusherAttach: pusher.clinchAttachDistance || 0,
    victimGrabPushed: !!victim.isBeingGrabPushed,
    victimEdgePushed: !!victim.isBeingEdgePushed,
    victimBeltHolding: !!victim.isClinchBeltHolding,
    victimAttach: victim.clinchAttachDistance || 0,
  };

  handleWinCondition(room, victim, pusher, io, "grabPush");

  const now = simNow(room);
  // Lock the PIXEL gap at the win — never a stale clinchAttach lerp target.
  // That gap stays enforced for the whole clinch-pose window.
  const liveAttach =
    Math.abs(victimStartX - pusherStartX) ||
    pose.pusherAttach ||
    pose.victimAttach ||
    Math.round(75 * 0.96);

  const applyPushCutscene = (p, startX) => {
    p.isRingOutPushCutscene = true;
    p.ringOutPushStartTime = now;
    p.ringOutPushDuration = RINGOUT_PUSH_DURATION_MS;
    p.ringOutPushStartX = startX;
    p.ringOutPushTargetX = startX + pushDir * RINGOUT_PUSH_DISTANCE;
    p.ringOutPushSettled = false;
    p.ringOutPushAttachDistance = liveAttach;
    p.ringOutPushAllowSeparate = false;
    p.y = GROUND_LEVEL;
    p.movementVelocity = 0;
    p.knockbackVelocity = { x: 0, y: 0 };
    p.isFallingOffDohyo = false;
    // Clear legacy throw / force-out plant poses — this win holds the push look.
    p.isRingOutFreezeActive = false;
    p.ringOutFreezeEndTime = 0;
    p.isRingOutThrowCutscene = false;
    p.ringOutThrowDistance = 0;
    p.ringOutThrowDirection = null;
    p.pendingRingOutThrowTarget = null;
    p.isThrowing = false;
    p.isBeingThrown = false;
    p.throwOpponent = null;
    p.isGrabFrontalForceOut = false;
    p.isBeingGrabFrontalForceOut = false;
    p.isGrabBellyFlopping = false;
    p.isBeingGrabBellyFlopped = false;
    p.isBowing = false;
    p.isGrabPushDefeat = false; // set on loser only when clinch poses drop
  };

  applyPushCutscene(pusher, pusherStartX);
  applyPushCutscene(victim, victimStartX);

  // Restore the live clinch push poses (no bow). Loser keeps gripped clinch
  // (grabbing body + arms via hasGrip) — not the ungripped beingGrabbed sprite.
  pusher.isGrabbing = true;
  pusher.grabbedOpponent = victim.id;
  pusher.inClinch = true;
  pusher.hasGrip = true;
  pusher.isGrabPushing = pose.pusherGrabPushing;
  pusher.isClinchPushing = pose.pusherClinchPushing || !pose.pusherGrabPushing;
  pusher.isEdgePushing = pose.pusherEdgePushing;
  pusher.isClinchCommittedDrive = pose.pusherCommittedDrive;
  pusher.isClinchBeltHolding = pose.pusherBeltHolding;
  pusher.clinchAttachDistance = liveAttach;

  victim.isBeingGrabbed = true; // grab link only; hasGrip ⇒ clinch grabbing sprite/arms
  victim.inClinch = true;
  victim.hasGrip = true;
  victim.isBeingGrabPushed = pose.victimGrabPushed;
  victim.isBeingEdgePushed = pose.victimEdgePushed;
  victim.isClinchBeltHolding = pose.victimBeltHolding;
  victim.clinchAttachDistance = liveAttach;

  // End beats: (1) both idle at clinch spacing, (2) pushbox separate,
  // (3) loser → push-defeat pose. Never move X in the same beat as clearing
  // clinch — client interpolates X before React swaps the sprite.
  setPlayerTimeout(
    pusher.id,
    () => {
      clearRingOutPushPoseToIdle(pusher);
      clearRingOutPushPoseToIdle(victim);
      setPlayerTimeout(
        pusher.id,
        () => {
          if (pusher.isRingOutPushCutscene) pusher.ringOutPushAllowSeparate = true;
          if (victim.isRingOutPushCutscene) victim.ringOutPushAllowSeparate = true;
        },
        RINGOUT_PUSH_SEPARATE_DELAY_MS,
        "ringOutPushSeparate"
      );
      setPlayerTimeout(
        victim.id,
        () => {
          if (!victim.isRingOutPushCutscene) return;
          victim.isGrabPushDefeat = true;
        },
        RINGOUT_PUSH_DEFEAT_DELAY_MS,
        "ringOutPushDefeatPose"
      );
    },
    RINGOUT_PUSH_DURATION_MS + RINGOUT_PUSH_IDLE_DELAY_MS,
    "ringOutPushIdle"
  );
}

function clearRingOutPushPoseToIdle(p) {
  if (!p) return;
  p.isGrabbing = false;
  p.grabbedOpponent = null;
  p.isBeingGrabbed = false;
  p.inClinch = false;
  p.hasGrip = false;
  p.isGrabPushing = false;
  p.isClinchPushing = false;
  p.isEdgePushing = false;
  p.isBeingGrabPushed = false;
  p.isBeingEdgePushed = false;
  p.isClinchCommittedDrive = false;
  p.isClinchBeltHolding = false;
  p.clinchAttachDistance = 0;
  p.isBowing = false;
  p.isGrabPushDefeat = false; // loser gets this on a later timeout
  // Keep isRingOutPushCutscene + ringOutPushAttachDistance until separate
  // is allowed — parks them past the rope at clinch spacing under idle.
  // Inputs stay dead via room.gameOver.
}

module.exports = {
  updateGrabActions,
  grantDeepGrip,
  // Test / debug helpers — authoritative Plant vs raw intent
  getClinchAction,
  getPlantIntent,
  isDrivePlantCancelPending,
  isActivelyPlanting,
  getPlantActivationTime,
  isBraceLatched,
  isPerfectBraceTiming,
  isFreshBraceActivation,
  getTechniqueBraceWindow,
  techniqueBraceKey,
  updateTechniqueBraceArm,
  getClinchThrowDefense,
  // Brace attempt cycle — shared with the input layer so one press is one attempt
  braceCyclePhase,
  isBraceReady,
  beginBraceAttempt,
  selectTechniqueAnimationMs,
  getTechniqueAnimationMs,
  refundBraceAttempt,
  clearBraceAttempt,
};
