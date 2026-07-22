const {
  GRAB_STATES, GROUND_LEVEL,
  HITBOX_DISTANCE_VALUE, CHARGED_HITBOX_DISTANCE_VALUE, SLAP_HITBOX_DISTANCE_VALUE,
  SIDESTEP_RECOVERY_OVERLAP_THRESHOLD,
  SLAP_PARRY_WINDOW, SLAP_PARRY_NEUTRAL_WINDOW_MS, SLAP_PARRY_HITSTOP_MS,
  SLAP_PARRY_RECOVERY_MS,
  SLAP_PARRY_KNOCKBACK_WINNER, SLAP_PARRY_KNOCKBACK_LOSER, SLAP_PARRY_KNOCKBACK_NEUTRAL,
  SLAP_PARRY_TIP_SEPARATION,
  DOHYO_FALL_DEPTH,
  POWER_UP_TYPES,
  PERFECT_PARRY_WINDOW, PERFECT_PARRY_KNOCKBACK,
  PERFECT_PARRY_ANIMATION_LOCK, PERFECT_PARRY_ATTACKER_STUN_DURATION,
  PARRY_SUCCESS_DURATION,
  RAW_PARRY_KNOCKBACK, RAW_PARRY_SLAP_KNOCKBACK,
  RAW_PARRY_STAMINA_REFUND, RAW_PARRY_COOLDOWN_MS,
  PERFECT_PARRY_BALANCE_REFUND,
  PERFECT_PARRY_ATTACKER_STUN_MAX, PERFECT_PARRY_KNOCKBACK_MAX,
  PERFECT_PARRY_BALANCE_REFUND_MAX,
  SLAP_TIP_DISTANCE, SLAP_TIP_POSTURE_MULT, SLAP_TIP_DRIFT_MULT,
  CLASH_MARGIN_MIN_MS, CLASH_MARGIN_MAX_MS,
  CLASH_LOSER_KB_MIN, CLASH_LOSER_KB_MAX,
  CLASH_WINNER_KB_MAX, CLASH_WINNER_KB_MIN,
  FOLLOW_THROUGH_TOWARD_SHIFT, FOLLOW_THROUGH_AWAY_SHIFT,
  FOLLOW_THROUGH_TOWARD_RECOVERY_MS, FOLLOW_THROUGH_AWAY_RECOVERY_MS,
  CPU_FOLLOW_THROUGH_PUSHER, CPU_FOLLOW_THROUGH_COUNTER_FADE,
  CPU_FOLLOW_THROUGH_EDGE_RANGE,
  COUNTER_HIT_INTENT_WINDOW_MS,
  SLAP_CHAIN_HIT_GAP_MS,
  HITSTOP_SLAP_MS, HITSTOP_BURST_MS, HITSTOP_PARRY_MS, HITSTOP_SLAP_PARRY_MS, HITSTOP_PERFECT_PARRY_MS, HITSTOP_CHARGED_MIN_MS, HITSTOP_CHARGED_MAX_MS,
  SLAP_HIT_VICTIM_STAMINA_DRAIN, CHARGED_HIT_VICTIM_STAMINA_DRAIN,
  PALM_THRUST_HIT_VICTIM_STAMINA_DRAIN,
  BALANCE_MAX, BALANCE_SLAP_HIT_DRAIN, BALANCE_CHARGED_HIT_DRAIN,
  BALANCE_SLAP_HIT_DRAIN_P2, BALANCE_CHARGED_HIT_DRAIN_P2, BALANCE_PALM_HIT_DRAIN_P2,
  BALANCE_SLAP_HIT_DRAIN_ENHANCED, CADENCE_STEP_IN_MULT,
  POSTURE_COUNTER_DRAIN_MULT,
  KILLBAND_MOMENTUM, KILLBAND_MOMENTUM_REF, KILLBAND_POSTURE, KILLBAND_CAP,
  POSTURE_CHARGED_KILL_REACH_MULT,
  MOMENTUM_HIT_MULT_THRESHOLD,
  CHARGE_CLASH_RECOVERY_DURATION, CHARGE_CLASH_BASE_KNOCKBACK,
  CHARGE_CLASH_MIN_KNOCKBACK, CHARGE_CLASH_ADVANTAGE_SCALE,
  CHARGE_PRIORITY_THRESHOLD, CHARGE_VS_SLAP_ATTACKER_PENALTY,
  SLAP_KILL_RANGE,
  BURST_STUN_MS,
  SLAP_ONHIT_ATTACKER_PUSH,
  SLAP_ONHIT_VICTIM_DRIFT,
  K_SLAP_KB_INHERIT,
  SLAP_ONHIT_ATTACKER_PUSH_CAP,
  SLAP_ONHIT_VICTIM_DRIFT_CAP,
  K_VICTIM_INTO,
  K_VICTIM_BRACE,
  VICTIM_KB_SCALE_MIN,
  VICTIM_KB_SCALE_MAX,
  K_PALM_MATADOR,
  PALM_MATADOR_KB_CAP,
  SLAP_COUNTER_HIT_BONUS_MS,
  SLAP_COUNTER_KB_MULT,
  SLAP_MIN_HITSTUN_MS,
  SLAP_RECOVERY_MS,
  CHARGED_KILL_REACH_MIN,
  CHARGED_KILL_REACH_MAX,
  CHARGED_KILL_REACH_CAP,
  CHARGED_KILL_MULT_MIN,
  CHARGED_KILL_MULT_MAX,
  CHARGED_ATTACKER_RECOIL_BASE,
  CHARGED_ATTACKER_RECOIL_CHARGE_SCALE,
  CHARGED_HIT_RECOVERY_MS,
  CHARGE_FULL_POWER_MS,
  CINEMATIC_KILL_HITSTOP_MS,
  CINEMATIC_KILL_KNOCKBACK_BOOST,
  SIDESTEP_HIT_RETURN_BASE_MS,
  SIDESTEP_HIT_RETURN_MIN_MS,
  COUNTER_HIT_WINDOW_MS,
  SLAP_STARTUP_MS,
  CHARGED_STARTUP_MS,
  PALM_THRUST_HIT_RECOVERY_MS,
  PALM_THRUST_HITBOX_DISTANCE_VALUE,
  PALM_THRUST_KB_VELOCITY,
  PALM_THRUST_ACTIVE_MS,
  LOW_KICK_HIT_RECOVERY_MS,
  LOW_KICK_HITBOX_DISTANCE_VALUE,
  LOW_KICK_KB_VELOCITY,
  LOW_KICK_BALANCE_DRAIN,
  LOW_KICK_BALANCE_DRAIN_VS_PARRY,
  LOW_KICK_BALANCE_DRAIN_COUNTER,
  FLAP_BODYSLAM_KB_VELOCITY,
  AP_ACTIVE_MS,
  AP_LATE_PARRY_MS,
  AP_FLOW_WINDOW_MS,
  AP_KILL_THRESHOLD,
  AP_PERFECT_KILL_THRESHOLD,
  AP_BALANCE_DRAIN,
  AP_PERFECT_BALANCE_DRAIN,
  AP_ATTACKER_KNOCKBACK,
  AP_PERFECT_ATTACKER_KNOCKBACK,
  AP_HITSTOP_MS,
  AP_PERFECT_HITSTOP_MS,
  AP_KILL_HITSTOP_MS,
  AP_PERFECT_BALANCE_REFUND,
  AP_STAGGER_SLAP_MS,
  AP_STAGGER_PALM_MS,
  AP_STAGGER_FLAP_MS,
  AP_PERFECT_ADVANTAGE_MS,
  AP_SUCCESS_RECOVERY_MS,
  AP_COOLDOWN_MS,
  AP_STAMINA_COST,
  AP_KILL_SLIDE_DISTANCE,
  AP_KILL_SLIDE_DURATION_MS,
  GUARD_SLAP_BALANCE_CHIP,
  GUARD_PALM_BALANCE_CHIP,
  GUARD_SLAP_STAMINA_DRAIN,
  GUARD_PALM_STAMINA_DRAIN,
  GUARD_SLAP_PUSHBACK,
  GUARD_PALM_PUSHBACK,
  GUARD_HITSTOP_MS,
  GUARD_CRUSH_STUN_MS,
  SLAP_TRADE_WINDOW_MS,
  SLAP_TRADE_KNOCKBACK,
} = require("./constants");

const {
  setPlayerTimeout,
  simNow,
  simNowForPlayer,
  clearAllActionStates,
  triggerHitstop,
  triggerHitstopAndEmit,
  emitThrottledScreenShake,
  canApplyKnockback,
  setKnockbackImmunity,
  getChargedHitstop,
  timeoutManager,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  clearHitFall,
  clearSidestepHitReturn,
  hasHitAbsorption,
  consumeHitAbsorption,
  schedulePalmThrustVisualEnd,
  alignedEntryVelocity,
  grantAttackParryFlurryCover,
} = require("./gameUtils");

// MASTERY OVERHAUL feature flags (Phase 1: momentum; Phase 2: posture;
// Phase 3: cadence; Phase 4: analog resolutions & risk dials).
const { MASTERY_P1_MOMENTUM, MASTERY_P2_POSTURE, MASTERY_P3_CADENCE, MASTERY_P4_ANALOG, MASTERY_P5_ASSISTS } = require("./masteryFlags");

const {
  grabSlipsSlap,
  isOpponentCloseEnoughForGrab,
  isOpponentInFrontOfGrabber,
} = require("./combatHelpers");

// handleWinCondition is used by the lethal AP slap-down. gameFunctions does not
// require collisionSystem, so this top-level require introduces no cycle.
const { handleWinCondition } = require("./gameFunctions");

function playerPalmBreaksGrabArmor(player) {
  return (
    !!player.loadout?.palmBreaksGrabArmor ||
    player.activePowerUp === POWER_UP_TYPES.SHATTER_PALM
  );
}

// Charged cinematic-kill "kill reach": how far (px) from the rope, in the
// knockback direction, a charged hit can still ring the victim OUT. Scales with
// the full power of the hit (finalKnockbackMultiplier — charge %, POWER
// power-up / Power Water, BASHO power/resistance, counter-hit, punish) and is
// hard-capped so a NO-KILL deadzone always survives in the middle of the ring.
// See constants.js (CHARGED_KILL_* dials) for the geometry rationale.
function chargedKillReach(finalMultiplier) {
  const slope =
    (CHARGED_KILL_REACH_MAX - CHARGED_KILL_REACH_MIN) /
    (CHARGED_KILL_MULT_MAX - CHARGED_KILL_MULT_MIN);
  const raw =
    CHARGED_KILL_REACH_MIN +
    (finalMultiplier - CHARGED_KILL_MULT_MIN) * slope;
  return Math.max(0, Math.min(raw, CHARGED_KILL_REACH_CAP));
}

// MASTERY Phase 2 (2.4) — OSHI conversion. The slap/palm/flap-slam edge kill
// band EXPANDS with earned quality: the attacker's carried momentum
// (slapEntryAligned) plus whether the victim's POSTURE is broken. It can only
// widen (never shrink) and is hard-capped at KILLBAND_CAP so a wide midscreen
// no-kill deadzone always survives (invariant #3). Palm/flap carry no
// slapEntryAligned (rooted / airborne) so their momentum term is 0 — only the
// posture term widens their band. With the flag OFF this collapses to exactly
// SLAP_KILL_RANGE (byte-identical, invariants #2 & #4).
function slapKillBand(attacker, victim) {
  if (!MASTERY_P2_POSTURE) return SLAP_KILL_RANGE;
  const aligned = Math.min(attacker.slapEntryAligned || 0, KILLBAND_MOMENTUM_REF);
  const band =
    SLAP_KILL_RANGE +
    KILLBAND_MOMENTUM * (aligned / KILLBAND_MOMENTUM_REF) +
    (victim.isPostureBroken ? KILLBAND_POSTURE : 0);
  return Math.min(band, KILLBAND_CAP);
}

// MASTERY Phase 4 (4.1) — PARRY QUALITY CURVE. Inside the perfect window, the
// payout is graded by HOW EARLY the parry landed: `quality` 1 = frame-perfect,
// 0 = at the very edge of the window. Every term lerps from today's base
// constant (quality 0) up to its Phase-4 max (quality 1), so a just-barely
// perfect parry pays exactly today's stun/shove/refund (floor preserved) while
// a frame-perfect read pays the ceiling. Only ever called behind
// MASTERY_P4_ANALOG; the flag-off path keeps the flat base constants
// (byte-identical, invariants #2 & #4).
function gradePerfectParry(parryDuration) {
  const quality = Math.max(0, Math.min(1, 1 - parryDuration / PERFECT_PARRY_WINDOW));
  const lerp = (a, b) => a + (b - a) * quality;
  return {
    quality,
    attackerStun: lerp(PERFECT_PARRY_ATTACKER_STUN_DURATION, PERFECT_PARRY_ATTACKER_STUN_MAX),
    parryShove: lerp(PERFECT_PARRY_KNOCKBACK, PERFECT_PARRY_KNOCKBACK_MAX),
    postureRefund: Math.round(lerp(PERFECT_PARRY_BALANCE_REFUND, PERFECT_PARRY_BALANCE_REFUND_MAX)),
  };
}

// MASTERY Phase 4 (4.5) — FOLLOW-THROUGH risk dial. On a slap connect the
// attacker's held direction is a player-chosen bet: +1 = holding TOWARD the
// victim (commit — bigger shift, +recovery/slightly minus), −1 = holding AWAY
// (fade — smaller shift, −recovery/slightly plus), 0 = NEUTRAL (today's +0
// default). Humans read raw key state (a/d relative to the push direction);
// CPUs derive intent from archetype so their movement/facing is untouched — a
// pusher biases follow-through, a counter biases fade, and IMPOSSIBLE presses
// the edge on a broken-posture victim near their rope. Only called behind
// MASTERY_P4_ANALOG.
function resolveSlapFollowThrough(attacker, victim, pushDirection, room) {
  const towardSign = Math.sign(pushDirection) || 1;
  if (attacker.isCPU) {
    const diff = room && room.cpuDifficulty;
    // Difficulty firewall: EASY/NORMAL gain no new capability — they keep the
    // neutral +0 slap. Follow-through is a HARD+ ceiling behavior.
    if (diff !== "HARD" && diff !== "IMPOSSIBLE") return 0;
    if (diff === "IMPOSSIBLE" && victim.isPostureBroken) {
      const distToRope = towardSign > 0
        ? MAP_RIGHT_BOUNDARY - victim.x
        : victim.x - MAP_LEFT_BOUNDARY;
      if (distToRope <= CPU_FOLLOW_THROUGH_EDGE_RANGE) return 1;
    }
    const arch = attacker.aiArchetype;
    if (arch === "pusher") return Math.random() < CPU_FOLLOW_THROUGH_PUSHER ? 1 : 0;
    if (arch === "counter") return Math.random() < CPU_FOLLOW_THROUGH_COUNTER_FADE ? -1 : 0;
    return 0;
  }
  const keys = attacker.keys || {};
  const heldDir = keys.d && !keys.a ? 1 : keys.a && !keys.d ? -1 : 0;
  if (heldDir === 0) return 0;
  return heldDir === towardSign ? 1 : -1;
}

function checkCollision(player, otherPlayer, rooms, io) {
  // Reset isAlreadyHit only once per attack to allow exactly one hit per attack
  if (player.isAttacking && player.attackStartTime) {
    // Only reset if this is a different attack (different start time)
    if (
      !player.lastCheckedAttackTime ||
      player.lastCheckedAttackTime !== player.attackStartTime
    ) {
      // Reset the hit blocker for this new attack
      otherPlayer.isAlreadyHit = false;
      player.lastCheckedAttackTime = player.attackStartTime;
    }
  }

  // Rope jump: full immunity during airborne (active) phase.
  // No ground attack can reach an airborne target — punish the startup or landing instead.
  if (otherPlayer.isRopeJumping && otherPlayer.ropeJumpPhase === "active") {
    return;
  }

  // Flap: full immunity for the entire airborne flight (liftoff → landing).
  // Punish the grounded startup telegraph or the landing recovery instead.
  if (otherPlayer.isFlapping && otherPlayer.flapPhase === "flight") {
    return;
  }

  // Check for startup frames on all attacks - disable collision during startup
  // Use isInStartupFrames flag for accurate timing (set by executeSlapAttack/executeChargedAttack)
  if (player.isAttacking && player.isInStartupFrames) {
    return; // Skip collision detection during startup frames - attack not active yet
  }
  
  // Fallback: Check startup timing if flag not set (for backward compatibility).
  // Pulled from shared constants — single source of truth, no drift.
  if (player.isAttacking && player.attackStartTime && !player.startupEndTime) {
    const startupDelay =
      player.attackType === "slap"
        ? SLAP_STARTUP_MS
        : CHARGED_STARTUP_MS;
    const attackAge = simNowForPlayer(player) - player.attackStartTime;

    if (attackAge < startupDelay) {
      return; // Skip collision detection during startup frames
    }
  }

  // Skip collision if the attack's active frames have ended (in recovery phase of attack)
  if (player.attackType === "slap" && player.slapActiveEndTime && simNowForPlayer(player) > player.slapActiveEndTime) {
    return;
  }
  if (player.attackType === "charged" && player.chargedActiveEndTime && simNowForPlayer(player) > player.chargedActiveEndTime) {
    return;
  }
  if (player.attackType === "lowKick" && player.lowKickActiveEndTime && simNowForPlayer(player) > player.lowKickActiveEndTime) {
    return;
  }

  // Dodge no longer grants i-frames against ANY attack type.
  // Previously dodge i-framed charged attacks during its active phase, but that
  // made charged whiff against a well-timed dodge with no counterplay. Charged
  // now hits dodge as a normal hit (no counter-hit, no punish — see counter-hit
  // suppression below). Slap was never i-framed by dodge to begin with.
  // Sim clock — slapParryImmunityUntil is a sim-clock deadline (pauses with hitstop)
  const now = simNowForPlayer(player);
  const otherInDodgeIFrames = false;
  const playerInDodgeIFrames = false;

  // Sidestep grants i-frames vs ALL strikes during the ACTIVE phase, AND
  // during RECOVERY while still LITERALLY clipping the opponent's body
  // (within SIDESTEP_RECOVERY_OVERLAP_THRESHOLD = 80px, the same threshold
  // the recovery-slide logic uses to decide whether to push out). Once the
  // sidestepper is geometrically separated, recovery becomes normally
  // vulnerable so opponents get a real punish window.
  //
  // IMPORTANT: this overlap-iframe ONLY applies to SUCCESSFUL sidesteps
  // (passedOpponent = true). A failed sidestep that didn't reach past the
  // opponent and ended overlapping is supposed to be punished hard — that's
  // the design intent of "bad timing/range gets exposed". Without the
  // passedOpponent gate, a failed sidestep would get a free i-frame pass
  // for the entire recovery while held in place inside the opponent.
  //
  // Threshold history: was HITBOX_DISTANCE_VALUE*2*sizeMult (~116px @ 0.85
  // size). With LANDING_SEP=120, the recovery slide ended only 4px past
  // threshold, so cubic ease-out kept the sidestepper i-framed until t≈0.65
  // of the 150ms recovery — leaving only ~53ms of vulnerable window, which
  // is shorter than slap startup (55ms) so punishes effectively never landed.
  // Tightening to 80px (literal clipping) crosses threshold at t≈0.24,
  // giving ~114ms of real vulnerable window without changing move duration.
  const overlapThreshold = SIDESTEP_RECOVERY_OVERLAP_THRESHOLD;
  const sidestepPushboxOverlap = Math.abs(player.x - otherPlayer.x) < overlapThreshold;
  const otherPassedPlayer = otherPlayer.isSidestepping &&
    (otherPlayer.x - player.x) * (otherPlayer.sidestepDirection || 0) > 0;
  const playerPassedOther = player.isSidestepping &&
    (player.x - otherPlayer.x) * (player.sidestepDirection || 0) > 0;
  const otherInSidestepIFrames = otherPlayer.isSidestepping &&
    !otherPlayer.isSidestepStartup &&
    (!otherPlayer.isSidestepRecovery || (sidestepPushboxOverlap && otherPassedPlayer));
  const playerInSidestepIFrames = player.isSidestepping &&
    !player.isSidestepStartup &&
    (!player.isSidestepRecovery || (sidestepPushboxOverlap && playerPassedOther));

  const eitherHasSlapParryImmunity =
    (player.slapParryImmunityUntil && now < player.slapParryImmunityUntil) ||
    (otherPlayer.slapParryImmunityUntil && now < otherPlayer.slapParryImmunityUntil);

  if (
    !player.isAttacking ||
    otherPlayer.isAlreadyHit ||
    otherPlayer.isDead ||
    otherInDodgeIFrames ||
    playerInDodgeIFrames ||
    otherInSidestepIFrames ||
    playerInSidestepIFrames ||
    player.isBeingThrown ||
    otherPlayer.isBeingThrown
  ) {
    return;
  }

  if (eitherHasSlapParryImmunity) {
    const bothInNonFinisherSlaps =
      player.attackType === "slap" &&
      otherPlayer.isAttacking && otherPlayer.attackType === "slap";
    if (!bothInNonFinisherSlaps) {
      return;
    }
  }

  // Calculate hitbox distance based on attack type
  // Slap: fixed reach (not scaled by body size — it's arm reach, not body width)
  // Charged: scaled by size multiplier (body-based hitbox)
  const hitboxDistance =
    player.attackType === "slap"
      ? SLAP_HITBOX_DISTANCE_VALUE
      : player.attackType === "lowKick"
        ? LOW_KICK_HITBOX_DISTANCE_VALUE
        : player.isPalmThrust
          ? PALM_THRUST_HITBOX_DISTANCE_VALUE * (player.sizeMultiplier || 1)
          : CHARGED_HITBOX_DISTANCE_VALUE * (player.sizeMultiplier || 1);

  // For slap attacks, only check horizontal distance and ensure opponent is in front
  if (player.attackType === "slap") {
    const deltaX = otherPlayer.x - player.x;
    const attackDir = player.facing === 1 ? -1 : 1;
    const opponentInFront = deltaX * attackDir >= 0;
    const horizontalDistance = Math.abs(deltaX);
    if (opponentInFront && horizontalDistance < hitboxDistance) {
      if (otherPlayer.isAttacking && otherPlayer.attackType === "slap") {
        // ── SLAP vs SLAP: earlier-connect wins; same-tick tie TRADES ──────────
        // The old clash ("slap parry") is gone. Resolution is now purely by who
        // connected first (judged on attackStartTime, so it's order-independent —
        // no P1 bias). Only a genuine ~1-tick tie is a TRADE (both take a hit).
        const diff = player.attackStartTime - otherPlayer.attackStartTime;
        if (Math.abs(diff) <= SLAP_TRADE_WINDOW_MS) {
          // Genuine tie → TRADE. resolveSlapTrade applies BOTH hits and clears
          // both attacks, so the reciprocal checkCollision(other, player) this
          // tick self-skips (its isAttacking gate is now false).
          resolveSlapTrade(player, otherPlayer, rooms, io);
          return;
        }
        if (diff > 0) {
          // player pressed LATER → the earlier otherPlayer wins; this slap is
          // stuffed. otherPlayer's own checkCollision call lands their hit.
          return;
        }
        // diff < 0 → player pressed EARLIER → fall through to processHit (wins clean).
      }

      // Slap vs Charged: if opponent is executing a charged attack above the
      // priority threshold AND their charged hitbox reaches us, defer to the
      // charged branch (charged attack wins through with a graze penalty).
      if (
        otherPlayer.isAttacking &&
        otherPlayer.attackType === "charged" &&
        !otherPlayer.isInStartupFrames &&
        (otherPlayer.chargeAttackPower || 0) >= CHARGE_PRIORITY_THRESHOLD
      ) {
        const chargedHitboxDist = CHARGED_HITBOX_DISTANCE_VALUE * (otherPlayer.sizeMultiplier || 1);
        const dxFromCharged = player.x - otherPlayer.x;
        const chargedAtkDir = otherPlayer.facing === 1 ? -1 : 1;
        const inFrontOfCharged = dxFromCharged * chargedAtkDir >= 0;
        if (inFrontOfCharged && Math.abs(dxFromCharged) < chargedHitboxDist) {
          return; // Charged attack has priority — that branch will process the hit
        }
      }

      // GRAB SLIPS SLAP: if the defender is in grab startup and this slap's
      // hitbox came out AFTER their grab began, the grab evades it — the slap
      // whiffs and the grab startup survives to connect. This is the anti-spam
      // read (see grabSlipsSlap): a committed grab beats mashed slaps, but a
      // slap already active before the grab started still connects below.
      if (otherPlayer.isGrabStartup && grabSlipsSlap(otherPlayer, player)) {
        return; // Grab slips it — don't process slap hit, grab will connect
      }

      // Slap was already active before the grab began → it stuffs the grab and
      // connects cleanly (processHit). There is NO free damage-absorb armor;
      // the ONLY thing that absorbs here is the Thick Blubber loadout/power-up,
      // resolved grabs-only inside processHit.
      if (eitherHasSlapParryImmunity) return;
      processHit(player, otherPlayer, rooms, io);
    }
    return;
  }

  // ── LOW KICK / TRIP ───────────────────────────────────────────────────────
  // Rooted poke: beats parry/guard (falls through processHit — not in the
  // slap/palm parry gate) and grab startup (no grabSlipsSlap). Loses to live
  // slap / palm / charged hitboxes on trade.
  if (player.attackType === "lowKick") {
    const deltaX = otherPlayer.x - player.x;
    const attackDir = player.facing === 1 ? -1 : 1;
    const opponentInFront = deltaX * attackDir >= 0;
    const horizontalDistance = Math.abs(deltaX);
    if (opponentInFront && horizontalDistance < hitboxDistance) {
      if (
        otherPlayer.isAttacking &&
        !otherPlayer.isInStartupFrames &&
        (otherPlayer.attackType === "slap" ||
          otherPlayer.attackType === "charged" ||
          otherPlayer.isPalmThrust)
      ) {
        // Strike wins the trade — their checkCollision lands the hit.
        return;
      }
      if (
        otherPlayer.isAttacking &&
        otherPlayer.attackType === "lowKick" &&
        !otherPlayer.isInStartupFrames
      ) {
        const diff = player.attackStartTime - otherPlayer.attackStartTime;
        if (Math.abs(diff) <= SLAP_TRADE_WINDOW_MS) {
          // Simultaneous kicks — both chip lightly via mutual slap-trade shove.
          resolveSlapTrade(player, otherPlayer, rooms, io);
          return;
        }
        if (diff > 0) return; // later kick loses
      }
      // Already in an active clinch — can't trip through a completed grab.
      if (
        otherPlayer.isGrabbing &&
        isOpponentCloseEnoughForGrab(otherPlayer, player) &&
        isOpponentInFrontOfGrabber(otherPlayer, player)
      ) {
        return;
      }
      if (eitherHasSlapParryImmunity) return;
      processHit(player, otherPlayer, rooms, io);
    }
    return;
  }

  // For charged attacks, use the same directional distance check as slap
  const chargedDeltaX = otherPlayer.x - player.x;
  const chargedAttackDir = player.facing === 1 ? -1 : 1;
  const chargedOpponentInFront = chargedDeltaX * chargedAttackDir >= 0;
  const chargedHorizontalDistance = Math.abs(chargedDeltaX);

  if (chargedOpponentInFront && chargedHorizontalDistance < hitboxDistance) {
    // PALM THRUST vs a grab: there is no default grab-startup armor, so a palm
    // that reaches a grabber stuffs the grab like any other strike (resolved in
    // processHit, where only the grabs-only Thick Blubber can absorb it). We
    // still block the palm from connecting through an ALREADY-active grab
    // (clinch) — that's a completed grab, not a startup to be stuffed.
    if (
      player.isPalmThrust &&
      isOpponentCloseEnoughForGrab(otherPlayer, player) &&
      isOpponentInFrontOfGrabber(otherPlayer, player)
    ) {
      // Already clinching us (active grab) — the palm can't connect.
      if (otherPlayer.isGrabbing) {
        return;
      }
    }
    if (player.isAttacking && otherPlayer.isAttacking) {
      if (otherPlayer.attackType === "charged") {
        // === CHARGED vs CHARGED ===
        // Thick Blubber is grabs-only now — it does NOT influence a charge
        // clash. Two charged attacks always resolve as a clash.
        const currentRoom = rooms.find((room) =>
          room.players.some((p) => p.id === player.id)
        );
        if (currentRoom) {
          resolveChargeClash(
            player, otherPlayer,
            player.chargeAttackPower || 0,
            otherPlayer.chargeAttackPower || 0,
            currentRoom, io
          );
        }
      } else if (otherPlayer.attackType === "slap") {
        // === CHARGED vs SLAP ===
        const chargeLevel = player.chargeAttackPower || 0;
        if (chargeLevel >= CHARGE_PRIORITY_THRESHOLD) {
          // Charged attack has priority — hit the slap player
          processHit(player, otherPlayer, rooms, io);
          // Slap graze penalty: amplify the charged attacker's recovery knockback
          player.knockbackVelocity.x *= CHARGE_VS_SLAP_ATTACKER_PENALTY;
        }
        // Below threshold: skip — the slap branch handles it (slap wins)
      } else {
        processHit(player, otherPlayer, rooms, io);
      }
    } else {
      processHit(player, otherPlayer, rooms, io);
    }
  }
}

// ── SLAP TRADE ──────────────────────────────────────────────────────────────
// Applies ONE slap hit to `victim` (as if struck by `attacker`). Used only for a
// genuine same-tick tie, so it deliberately skips the MASTERY momentum nuances
// (a trade is a rare 1-tick event): balance/stamina chip, a slap knockback with
// the standard rope-resistance ring-out gate, hit VFX/SFX. The main-loop
// knockback + boundary logic converts a boundary-side victim into a ring-out —
// and since both players are shoved toward OPPOSITE ropes while inside slap
// range of each other, at most ONE can ever be in kill range (no double-KO).
function applyTradeHit(victim, attacker, room, io) {
  const currentTime = simNow(room);
  const knockbackDirection = attacker.x < victim.x ? 1 : -1; // shove victim away from attacker

  const slapDrain = MASTERY_P2_POSTURE ? BALANCE_SLAP_HIT_DRAIN_P2 : BALANCE_SLAP_HIT_DRAIN;
  victim.balance = Math.max(0, victim.balance - slapDrain);
  victim.stamina = Math.max(0, victim.stamina - SLAP_HIT_VICTIM_STAMINA_DRAIN);

  clearAllActionStates(victim);
  victim.y = GROUND_LEVEL;
  victim.cadenceChain = 0;
  if (!victim.isAtTheRopes && !victim.atTheRopesFacingDirection) {
    victim.facing = attacker.x < victim.x ? 1 : -1; // face the attacker
  }

  victim.isHit = true;
  victim.isAlreadyHit = true;
  victim.lastHitType = "slap";
  victim.hitCounter = (victim.hitCounter || 0) + 1;
  victim.isSlapKnockback = true;
  victim.isChargedKnockback = false;
  victim.isBurstKnockback = false;

  const distToBoundaryInKbDir = knockbackDirection > 0
    ? MAP_RIGHT_BOUNDARY - victim.x
    : victim.x - MAP_LEFT_BOUNDARY;
  victim.slapKnockbackCanRingOut = distToBoundaryInKbDir <= slapKillBand(attacker, victim);

  // Hard mutual shove (not the normal on-hit drift) so a trade SPACES both
  // players out of slap range — they must re-approach, which breaks the +0
  // "sync-lock" that would otherwise make synced mashers re-trade every cycle.
  victim.knockbackVelocity = { x: knockbackDirection * SLAP_TRADE_KNOCKBACK, y: 0 };
  victim.movementVelocity = 0;
  victim.lastHitTime = currentTime;
  victim.inputLockUntil = Math.max(victim.inputLockUntil || 0, currentTime + SLAP_MIN_HITSTUN_MS);

  timeoutManager.clearPlayerSpecific(victim.id, "hitStateReset");
  setPlayerTimeout(
    victim.id,
    () => {
      // Hand the leftover knockback off to the ice coast (movementVelocity) so
      // the shove flows into a smooth slide-to-stop — exactly like a normal slap
      // victim. Without this the trade slide hard-stopped and read as "no slide".
      if (Math.abs(victim.knockbackVelocity.x) > 0.01) {
        victim.movementVelocity = victim.knockbackVelocity.x;
      }
      victim.knockbackVelocity.x = 0;
      victim.isHit = false;
      victim.isAlreadyHit = false;
      victim.isSlapKnockback = false;
      victim.slapKnockbackCanRingOut = false;
    },
    SLAP_MIN_HITSTUN_MS + 60,
    "hitStateReset"
  );

  const attackerPlayerNumber = room.players.findIndex((p) => p.id === attacker.id) + 1;
  io.in(room.id).emit("player_hit", {
    x: victim.x,
    y: victim.y,
    facing: victim.facing,
    attackType: "slap",
    isPalmThrust: false,
    chargePercentage: 0,
    timestamp: Date.now(),
    hitId: Math.random().toString(36).substr(2, 9),
    isCounterHit: false,
    isPunish: false,
    showCounterBanner: false,
    showPunishBanner: false,
    attackerPlayerNumber,
    cinematicKill: false,
    knockbackDirection,
    isArmorBreak: false,
    isPowered: false,
    attackerId: attacker.id,
    victimId: victim.id,
    isCadence: false,
    cadenceChain: 0,
    momentumHit: false,
    braked: false,
  });
}

// Genuine same-tick slap tie → both take a hit. Clears both attacks (so the
// reciprocal checkCollision self-skips this tick), applies a symmetric slap hit
// to each, and freezes once.
function resolveSlapTrade(player1, player2, rooms, io) {
  const room = rooms.find((r) => r.players.some((p) => p.id === player1.id));
  if (!room) return;
  applyTradeHit(player1, player2, room, io); // player1 struck by player2's slap
  applyTradeHit(player2, player1, room, io); // player2 struck by player1's slap
  // One symmetric freeze (the sim clock pauses for both).
  triggerHitstopAndEmit(io, room, HITSTOP_SLAP_MS, "slap");
}

function resolveChargeClash(player1, player2, p1Charge, p2Charge, room, io) {
  const knockbackDir1 = player1.x < player2.x ? -1 : 1;
  const knockbackDir2 = -knockbackDir1;

  // Charge advantage: positive = player1 charged more, negative = player2 charged more
  const chargeDiff = p1Charge - p2Charge;
  const advantage = chargeDiff / 100; // -1 to 1

  // Higher charge = less knockback (they "won" the clash positionally)
  const p1Knockback = Math.max(
    CHARGE_CLASH_MIN_KNOCKBACK,
    CHARGE_CLASH_BASE_KNOCKBACK * (1 - advantage * CHARGE_CLASH_ADVANTAGE_SCALE)
  );
  const p2Knockback = Math.max(
    CHARGE_CLASH_MIN_KNOCKBACK,
    CHARGE_CLASH_BASE_KNOCKBACK * (1 + advantage * CHARGE_CLASH_ADVANTAGE_SCALE)
  );

  // Clear attack states for both players
  [player1, player2].forEach((p) => {
    p.isAttacking = false;
    p.isChargingAttack = false;
    p.chargeStartTime = 0;
    p.chargeAttackPower = 0;
    p.chargingFacingDirection = null;
    p.attackType = null;
    p.attackStartTime = 0;
    p.attackEndTime = 0;
    p.chargedAttackHit = false;
    p.isSlapAttack = false;
    p.isInStartupFrames = false;
    p.startupEndTime = 0;
  });

  // Put both in recovery (uses the charged-recovery animation).
  // All recovery/cooldown/lock deadlines: sim clock (pause through the
  // clash hitstop triggered below).
  const clashSimNow = simNow(room);
  player1.isRecovering = true;
  player1.recoveryStartTime = clashSimNow;
  player1.recoveryDuration = CHARGE_CLASH_RECOVERY_DURATION;
  player1.recoveryDirection = player1.facing;
  player1.knockbackVelocity = { x: p1Knockback * knockbackDir1, y: 0 };
  player1.movementVelocity = p1Knockback * knockbackDir1 * 0.5;
  player1.actionLockUntil = clashSimNow + CHARGE_CLASH_RECOVERY_DURATION;
  player1.attackCooldownUntil = clashSimNow + CHARGE_CLASH_RECOVERY_DURATION + 150;

  player2.isRecovering = true;
  player2.recoveryStartTime = clashSimNow;
  player2.recoveryDuration = CHARGE_CLASH_RECOVERY_DURATION;
  player2.recoveryDirection = player2.facing;
  player2.knockbackVelocity = { x: p2Knockback * knockbackDir2, y: 0 };
  player2.movementVelocity = p2Knockback * knockbackDir2 * 0.5;
  player2.actionLockUntil = clashSimNow + CHARGE_CLASH_RECOVERY_DURATION;
  player2.attackCooldownUntil = clashSimNow + CHARGE_CLASH_RECOVERY_DURATION + 150;

  // Hitstop + screen shake scaled to combined charge power
  const combinedCharge = (p1Charge + p2Charge) / 200; // 0-1 range
  const hitstopMs = HITSTOP_CHARGED_MIN_MS + (HITSTOP_CHARGED_MAX_MS - HITSTOP_CHARGED_MIN_MS) * combinedCharge;
  triggerHitstopAndEmit(io, room, hitstopMs, "charge_clash");
  emitThrottledScreenShake(room, io, {
    type: "charge_clash",
    scale: 0.85 + combinedCharge * 0.4,
  });

  // Emit charge clash VFX event
  const midpointX = (player1.x + player2.x) / 2;
  const midpointY = (player1.y + player2.y) / 2;
  io.in(room.id).emit("charge_clash", {
    x: midpointX,
    y: midpointY,
    combinedCharge: p1Charge + p2Charge,
  });
}

// resolveSlap3Clash removed — hit 3 no longer part of slap string

// (The default grab-startup slap armor was removed: grabs no longer get a free
// one-hit absorb. The absorb behavior now lives ONLY in the grabs-only Thick
// Blubber loadout/power-up, resolved inside processHit.)

function processHit(player, otherPlayer, rooms, io) {
  // Find the current room
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );

  // Sim clock — every combat timestamp written here (lastHitTime, counter-hit
  // windows, burst knockback) lives on the room's pausable clock so it freezes
  // in lockstep with the hitstop this hit is about to trigger.
  const currentTime = simNow(currentRoom);

  // MASTERY Phase 1 (1.3): snapshot the VICTIM's signed velocity at the moment
  // of connect, BEFORE clearAllActionStates(otherPlayer) below zeroes it. Used
  // to scale knockback by whether they were moving INTO the hit (charging in →
  // more shove) or BRACING away (well-timed brake → less) — the trainable
  // upgrade to the previously-invisible DI. Only read behind the flag.
  const victimEntryV = otherPlayer.movementVelocity || 0;

  // Use the stored attack type instead of checking isSlapAttack
  const isSlapAttack = player.attackType === "slap";
  const isLowKick = player.attackType === "lowKick" || !!player.isLowKick;
  // Capture before clearAllActionStates — trip bonus for beating Space.
  const victimWasDefending =
    !!(otherPlayer.isRawParrying || otherPlayer.isGuarding);

  // ── ARMOR BREAK VFX ───────────────────────────────────────────────
  // Charged / low-kick landing during a grab attempt's startup is the
  // "armor break" tell. Slap does not play this VFX. Skip if thick blubber
  // will absorb, or if the defender is raw parrying (parry plays its own VFX).
  const palmBreaksGrabArmor =
    player.isPalmThrust && playerPalmBreaksGrabArmor(player);
  if (
    !isSlapAttack &&
    (!player.isPalmThrust || palmBreaksGrabArmor || isLowKick) &&
    otherPlayer.isGrabStartup &&
    !otherPlayer.isRawParrying &&
    !hasHitAbsorption(otherPlayer)
  ) {
    if (currentRoom) {
      io.in(currentRoom.id).emit("grab_armor_break", {
        defenderId: otherPlayer.id,
        attackerId: player.id,
        x: otherPlayer.x,
        y: otherPlayer.y,
        facing: otherPlayer.facing,
        breakId: `armor-break-${currentTime}-${otherPlayer.id}`,
      });
    }
  }

  // ============================================
  // COUNTER HIT DETECTION
  // Counter hit occurs when attacker's active frames hit opponent's startup frames.
  // Time-based window (COUNTER_HIT_WINDOW_MS, see constants.js) is forgiving enough
  // to catch the "I just pressed attack and got hit first" case.
  // ============================================

  // Check if opponent recently started an attack (either in startup or just started)
  const timeSinceAttackAttempt = otherPlayer.attackAttemptTime 
    ? (currentTime - otherPlayer.attackAttemptTime) 
    : Infinity;
  
  // Also check if opponent just pressed mouse1 but attack hasn't started yet
  // This catches the case where you get hit right as you click to attack
  const timeSinceAttackIntent = otherPlayer.attackIntentTime
    ? (currentTime - otherPlayer.attackIntentTime)
    : Infinity;
  
  // ============================================
  // COUNTER HIT DETECTION
  // Counter hit = hitting opponent during STARTUP frames of their move
  // ============================================
  const counterHitFromAttacking = otherPlayer.isAttacking && timeSinceAttackAttempt <= COUNTER_HIT_WINDOW_MS;
  // MASTERY Phase 4 (4.5): counter-hit honesty. The PURE-INTENT counter (the
  // victim only pressed — no active startup yet) now feeds a ×1.5 posture drain
  // (Phase 2), so it must be an earned read: its window shrinks 150→100ms with
  // the flag on. The active-startup counter (counterHitFromAttacking) keeps the
  // full window. Flag off ⇒ both use COUNTER_HIT_WINDOW_MS (byte-identical).
  const intentWindow = MASTERY_P4_ANALOG ? COUNTER_HIT_INTENT_WINDOW_MS : COUNTER_HIT_WINDOW_MS;
  const counterHitFromIntent = timeSinceAttackIntent <= intentWindow;
  // Charged shattering grab armor has its own VFX (grab_armor_break) — don't
  // also fire the counter-hit banner/effect, it doubles up visually. Slap
  // stuffing grab (after armor consumed) IS still a counter hit — that's a
  // skilled chain breaking commitment, and the boost reads correctly there.
  const isChargedArmorBreak = !isSlapAttack &&
    (!player.isPalmThrust || palmBreaksGrabArmor) &&
    (otherPlayer.isGrabStartup === true || otherPlayer.isGrabbingMovement === true);
  const counterHitFromGrabAttempt = !isChargedArmorBreak &&
    (otherPlayer.isGrabStartup === true || otherPlayer.isGrabbingMovement === true);
  const counterHitFromRopeJumpStartup = otherPlayer.isRopeJumping && otherPlayer.ropeJumpPhase === "startup";
  const counterHitFromSidestepStartup = otherPlayer.isSidestepStartup === true;
  const counterHitFromFlapStartup =
    otherPlayer.isFlapping && otherPlayer.flapPhase === "startup";
  // Dodge is a pure movement ability, not an attack — hits against any phase
  // of a dodge land as a clean normal hit (no counter-hit, no punish). Other
  // movement-ish actions (sidestep, rope jump, flap liftoff) ARE still
  // counter-hittable on startup because they're committed defensive reads with
  // bigger payoffs; dodge is a quick reposition with no defensive payoff to
  // "earn" a counter.
  const counterHitRaw = counterHitFromAttacking || counterHitFromIntent || counterHitFromGrabAttempt
    || counterHitFromRopeJumpStartup || counterHitFromSidestepStartup || counterHitFromFlapStartup;

  // ============================================
  // PUNISH DETECTION
  // Punish = hitting opponent during RECOVERY frames of their move.
  // NOTE: Dodge has no punishable recovery (DODGE_RECOVERY_MS = 0); spam is gated
  // by the post-dodge cooldown instead, so isDodgeRecovery is intentionally excluded.
  // ============================================
  const isPunish = otherPlayer.isRecovering
    || otherPlayer.isWhiffingGrab
    || otherPlayer.isGrabWhiffRecovery
    || otherPlayer.isApWhiffRecovering // a whiffed Attack Parry is punishable
    || (otherPlayer.isRopeJumping && otherPlayer.ropeJumpPhase === "landing")
    || otherPlayer.isSidestepRecovery;

  // Counter hit and punish are conceptually mutually exclusive: counter = startup
  // read, punish = recovery exposure. If the victim is in a recovery phase (e.g.
  // sidestep recovery), it's a punish — even if they had a recent attack-intent
  // press (e.g. buffering an attack out of recovery), which would otherwise
  // incorrectly stack a counter-hit bonus on top of the punish bonus.
  const isCounterHit = counterHitRaw && !isPunish;

  // Store the charge power before resetting states
  const chargePercentage = player.chargeAttackPower;

  // Thick Blubber hit absorption — GRABS ONLY. The defender must be in a grab
  // (startup / dash / clinch) for blubber to eat the hit; it no longer applies
  // to charged attacks or palm thrust. One absorb per grab attempt (refreshed
  // when a grab starts), so a blubber grappler can trade the first strike for
  // the grab, but a second hit stuffs it.
  const isDefenderGrabbing = otherPlayer.isGrabStartup || otherPlayer.isGrabbingMovement || otherPlayer.isGrabbing;
  if (
    hasHitAbsorption(otherPlayer) &&
    isDefenderGrabbing &&
    !otherPlayer.isRawParrying
  ) {
    // Raw parry should still work normally

    // Mark absorption as used (single-slot power-up) or spend a stacked BASHO
    // blubber charge.
    consumeHitAbsorption(otherPlayer);

    // CRITICAL: End the attacker's attack to prevent multiple collisions on subsequent ticks
    // For charged attacks, put attacker in recovery state
    if (!isSlapAttack) {
      player.chargedAttackHit = true;
      player.isAttacking = false;
      player.attackStartTime = 0;
      player.attackEndTime = 0;
      player.chargingFacingDirection = null;
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;

      // Set recovery state for the attacker
      player.isRecovering = true;
      player.recoveryStartTime = currentTime;
      player.recoveryDuration = 400;
      player.recoveryDirection = player.facing;
      player.knockbackVelocity = {
        x: player.facing * -2,
        y: 0,
      };
    }
    // For slap attacks, end the attack to prevent further collisions
    else {
      player.isAttacking = false;
      player.attackStartTime = 0;
      player.attackEndTime = 0;
    }

    // Absorb VFX: the pink "wrap ring" (formerly the grab-armor absorb) is now
    // the Thick Blubber animation. Payload matches the ring handler (defender-
    // gated, facing-aware).
    if (currentRoom) {
      io.in(currentRoom.id).emit("grab_armor_absorb", {
        defenderId: otherPlayer.id,
        attackerId: player.id,
        x: otherPlayer.x,
        y: otherPlayer.y,
        facing: otherPlayer.facing,
      });
    }

    // Early return - no further hit processing for the defender
    return;
  }

  // Low kick: keep the strike pose briefly, then settle into hit recovery.
  if (isLowKick) {
    player.currentLowKickHitConnected = true;
    player.lowKickActiveEndTime = 0; // kill hitbox; pose stays via isLowKick
    timeoutManager.clearPlayerSpecific(player.id, "lowKickCycle");
    setPlayerTimeout(
      player.id,
      () => {
        player.isAttacking = false;
        player.isLowKick = false;
        player.attackType = null;
        player.isInStartupFrames = false;
        player.lowKickActiveEndTime = 0;
        player.currentAction = null;
        player.currentLowKickHitConnected = false;
      },
      LOW_KICK_HIT_RECOVERY_MS,
      "lowKickCycle"
    );
  }

  // For charged attacks, end the attack immediately on hit — EXCEPT palm thrust,
  // which keeps isAttacking alive through the active window (like slap).
  if (!isSlapAttack && !isLowKick) {
    // Set hit tracking flag for charged attacks
    player.chargedAttackHit = true;

    if (player.isPalmThrust) {
      // Palm thrust: defer recovery until attackEndTime — safelyEndChargedAttack
      // transitions to on-hit recovery when the active window finishes. Do NOT
      // zero attackEndTime here or the pose snaps to recovery on connect frame
      // (and ring-out wins cut it even shorter via handleWinCondition).
      //
      // Late connects (counter hits, hitstop drift) can leave only a few ms of
      // active left — guarantee at least a full active window from this frame.
      // Strike sprite stays up through the full on-hit recovery (scheduled
      // precisely when recovery starts in safelyEndChargedAttack).
      const activeRemain = Math.max(
        PALM_THRUST_ACTIVE_MS,
        player.attackEndTime - currentTime
      );
      player.attackEndTime = currentTime + activeRemain;
      player.chargedActiveEndTime = player.attackEndTime;
      schedulePalmThrustVisualEnd(
        player,
        currentTime + activeRemain + PALM_THRUST_HIT_RECOVERY_MS
      );
    } else {
      // Reset all attack states first
      player.isAttacking = false;
      player.attackStartTime = 0;
      player.attackEndTime = 0;
      player.chargingFacingDirection = null;
      player.isChargingAttack = false;
      player.chargeStartTime = 0;
      player.chargeAttackPower = 0;

      // Set recovery state for successful hits. Shorter than the victim's
      // hitstun → the landed charge is PLUS on hit (see CHARGED_HIT_RECOVERY_MS).
      player.isRecovering = true;
      player.recoveryStartTime = currentTime;
      player.recoveryDuration = CHARGED_HIT_RECOVERY_MS;
      player.recoveryDirection = player.facing;
      // Initialize knockback velocity in the opposite direction of the attack
      player.knockbackVelocity = {
        x: player.facing * -2, // Static knockback amount
        y: 0,
      };
    }
  }
  // For slap attacks: no special handling - executeSlapAttack timeout handles everything

  // ── Early-active slap grace (AP_LATE_PARRY_MS) ─────────────────────────────
  // First N ms of slap ACTIVE: live PARRY/GUARD still resolve immediately, but
  // open hits are deferred so a slightly-late tap can arm and catch. Palm /
  // charged are unchanged. After the grace, open hits land as usual.
  if (
    isSlapAttack &&
    player.attackStartTime &&
    !otherPlayer.isRawParrying
  ) {
    const slapAge = simNowForPlayer(player) - player.attackStartTime;
    if (
      slapAge >= SLAP_STARTUP_MS &&
      slapAge < SLAP_STARTUP_MS + AP_LATE_PARRY_MS
    ) {
      return;
    }
  }

  // ── GUARD & PARRY ─────────────────────────────────────────────────────────
  // The defender is in the Space stance (a live PARRY window OR holding GUARD)
  // and the incoming move is a SLAP or PALM THRUST (a charged non-palm attack
  // BLOWS THROUGH — it falls to the normal hit path below, the anti-defense hard
  // read; grabs never reach here — a grab vs the stance is the counter-grab in
  // index.js). A live parry window (a timed tap) deflects for a reward, graded
  // regular vs PERFECT; otherwise the defender is GUARDING and eats chip.
  //
  // Pre-clear stale flurry linger: Space UP + window expired + not guarding.
  // Without this, the block below would phantom-chip instead of a clean hit.
  if (otherPlayer.isRawParrying && !otherPlayer.isGuarding) {
    const _apNow = simNowForPlayer(otherPlayer);
    const _apHeld = otherPlayer.isCPU ? !!otherPlayer.keys.s : !!otherPlayer.keys[" "];
    if (!_apHeld && _apNow >= (otherPlayer.apActiveUntil || 0)) {
      otherPlayer.isRawParrying = false;
      otherPlayer.apActiveUntil = 0;
    }
  }
  if (otherPlayer.isRawParrying && (isSlapAttack || player.isPalmThrust)) {
    const attacker = player;
    const parrier = otherPlayer;
    const currentTime = simNowForPlayer(parrier);
    const knockbackDirection = attacker.x < parrier.x ? -1 : 1;
    const isPalm = !!player.isPalmThrust;
    const parryingPlayerNumber = currentRoom
      ? currentRoom.players.findIndex((p) => p.id === parrier.id) + 1
      : 1;

    // A live PARRY window (a timed tap that hasn't lapsed into guard) deflects
    // for a reward; anything else means the defender is GUARDING → block chip.
    const inParryWindow =
      !parrier.isGuarding && currentTime < (parrier.apActiveUntil || 0);

    if (!inParryWindow) {
      // ── GUARD BLOCK — chip + ground lost + stamina bled, NO reward ──────────
      // The attacker is NOT nullified (their slap cycle continues, keeping
      // pressure); the guard just mitigates. Dedup via isAlreadyHit so the same
      // active window chips once. Stamina to 0 while guarding = guard-crush.
      const chip = isPalm ? GUARD_PALM_BALANCE_CHIP : GUARD_SLAP_BALANCE_CHIP;
      const stamDrain = isPalm ? GUARD_PALM_STAMINA_DRAIN : GUARD_SLAP_STAMINA_DRAIN;
      const pushback = isPalm ? GUARD_PALM_PUSHBACK : GUARD_SLAP_PUSHBACK;
      const guardPushDir = parrier.x < attacker.x ? -1 : 1;

      parrier.balance = Math.max(0, parrier.balance - chip);
      parrier.stamina = Math.max(0, parrier.stamina - stamDrain);
      parrier.slapParryKnockbackVelocity = pushback * guardPushDir;
      // One chip per attack: the per-attack isAlreadyHit reset (top of
      // checkCollision, keyed to attackStartTime) clears this before the NEXT
      // swing, so the current active window can't re-chip. No timeout needed.
      parrier.isAlreadyHit = true;
      parrier.apChainCount = 0;    // a block breaks the parry chain
      parrier.apFlurryUntil = 0;   // block breaks tap-every-slap flurry cover

      // GUARD CRUSH — bled dry while blocking: drop the guard into a brief stun,
      // then the stamina<=0 gassed path (index.js) takes over.
      const guardCrushed = parrier.stamina <= 0;
      if (guardCrushed) {
        parrier.isRawParrying = false;
        parrier.isGuarding = false;
        parrier.apActiveUntil = 0;
        parrier.isRawParrySuccess = false;
        parrier.isPerfectRawParrySuccess = false;
        parrier.isRawParryStun = true;
        parrier.inputLockUntil = Math.max(parrier.inputLockUntil || 0, currentTime + GUARD_CRUSH_STUN_MS);
        timeoutManager.clearPlayerSpecific(parrier.id, "guardCrushReset");
        setPlayerTimeout(
          parrier.id,
          () => { parrier.isRawParryStun = false; },
          GUARD_CRUSH_STUN_MS,
          "guardCrushReset"
        );
      }

      if (currentRoom) {
        triggerHitstopAndEmit(io, currentRoom, GUARD_HITSTOP_MS, "guard_block");
        io.in(currentRoom.id).emit("guard_block", {
          attackerX: attacker.x,
          parrierX: parrier.x,
          // ATTACKER facing — RawParryEffect's world/CSS front offsets are
          // calibrated for this (same as snowball/pumo-clone parry emits).
          // Parrier facing inverts the "in front" nudge on one side.
          facing: attacker.facing,
          isPalm,
          guardCrushed,
          timestamp: Date.now(),
          blockId: `${parrier.id}_guard_${Date.now()}`,
          playerNumber: parryingPlayerNumber,
          parrierId: parrier.id,
        });
      }
      return; // guard handled — never fall through to the normal-hit path
    }

    // ── PARRY — graded regular vs PERFECT by how dead-on the tap landed ───────
    const parryDuration = currentTime - (parrier.rawParryStartTime || currentTime);
    const isPerfect = parryDuration >= 0 && parryDuration <= PERFECT_PARRY_WINDOW;

    // KILL CHECK — attacker already inside the kill band when parried ⇒ slap-down
    // KO. A perfect parry finishes a hair higher.
    const killThreshold = isPerfect ? AP_PERFECT_KILL_THRESHOLD : AP_KILL_THRESHOLD;
    const isApKill =
      attacker.balance < killThreshold && currentRoom && !currentRoom.gameOver;

    attacker.cadenceChain = 0;
    if (!attacker.isAtTheRopes && !attacker.atTheRopesFacingDirection) {
      attacker.facing = attacker.x < parrier.x ? -1 : 1; // face the parrier
    }

    if (isApKill) {
      // ── LETHAL AP SLAP-DOWN — FREEZE FRAME, then the PULL-KILL slam ─────────
      // FREEZE (during the hitstop): the victim is held on their SLAP HIT frame
      // — keep isSlapAttack so the client slap animation freezes mid-hit through
      // the hitstop — and the parrier holds the raw-parry-success (impact) pose.
      // We only kill the hitbox + motion here; the pose is NOT cleared yet.
      const pullDirection = attacker.x < parrier.x ? 1 : -1;
      const victimFacingBeforeKill = attacker.facing;

      attacker.isAttacking = false; // stop collision processing (pose stays via isSlapAttack)
      attacker.slapActiveEndTime = 0;
      attacker.isSlapSliding = false;
      attacker.movementVelocity = 0;
      attacker.knockbackVelocity = { x: 0, y: 0 };
      attacker.isStrafing = false;
      attacker.isHit = false;
      timeoutManager.clearPlayerSpecific(attacker.id, "slapCycle");

      // Parrier holds the impact pose through the freeze.
      parrier.isRawParrying = false;
      parrier.isRawParrySuccess = true;
      parrier.apActiveUntil = 0;
      parrier.isApWhiffRecovering = false;
      parrier.apFlowUntil = 0;

      if (currentRoom) {
        // Heavy finisher freeze — the moment of impact is held.
        triggerHitstopAndEmit(io, currentRoom, AP_KILL_HITSTOP_MS, "cinematic_kill");
        // Charged-kill cinematic CAMERA beat (zoom + screen-darken), but noPan so
        // the camera stays centered (the victim belly-slides, doesn't fly across).
        // apPullKill tells the client to skip the charged flight VFX.
        io.in(currentRoom.id).emit("cinematic_kill", {
          attackerId: parrier.id,
          victimId: attacker.id,
          victimX: attacker.x,
          victimY: attacker.y,
          attackerX: parrier.x,
          attackerY: parrier.y,
          knockbackDirection: pullDirection,
          hitstopMs: AP_KILL_HITSTOP_MS,
          impactX: (parrier.x + attacker.x) / 2,
          impactY: attacker.y,
          apPullKill: true,
          noPan: true,
        });
        // Blue AP burst + slap-parry clang at the contact point.
        io.in(currentRoom.id).emit("raw_parry_success", {
          attackerX: attacker.x,
          parrierX: parrier.x,
          facing: parrier.facing,
          isPerfect,
          isAttackParry: true,
          isKill: true,
          timestamp: Date.now(),
          parryId: `${parrier.id}_apkill_${Date.now()}`,
          playerNumber: parryingPlayerNumber,
          parrierId: parrier.id,
          balanceGain: 0,
        });
      }

      // After the freeze: SLAM. The victim is dragged THROUGH the parrier and
      // belly-slides out the far side, then the round ends. Scheduled on the sim
      // clock (frozen during the hitstop) so it fires right as the freeze ends.
      setPlayerTimeout(
        attacker.id,
        () => {
          clearAllActionStates(attacker);
          attacker.y = GROUND_LEVEL;
          attacker.isClinchKillPullVictim = true;
          attacker.isBeingPullReversaled = true; // belly-slide jolt+slide tween
          attacker.pullReversalPullerId = parrier.id;
          attacker.isGrabBreakSeparating = true;
          attacker.grabBreakSepStartTime = simNow(currentRoom);
          attacker.grabBreakSepDuration = AP_KILL_SLIDE_DURATION_MS;
          attacker.grabBreakStartX = attacker.x;
          attacker.grabBreakTargetX = parrier.x + pullDirection * AP_KILL_SLIDE_DISTANCE;
          attacker.movementVelocity = 0;
          attacker.knockbackVelocity = { x: 0, y: 0 };
          attacker.isStrafing = false;
          attacker.facing = victimFacingBeforeKill; // belly-lay keeps original facing
          handleWinCondition(currentRoom, attacker, parrier, io, "clinchKillPull");
        },
        20, // tiny sim delay → fires ~1 tick after the (sim-frozen) hitstop ends
        "apKillSlam"
      );
    } else {
      // ── NON-LETHAL PARRY — FREEZE-FRAME the attacker, then shove + recover ───
      // SFV-style: the attacker is NOT thrown into a hurt animation. Their hitbox
      // dies but their ATTACK pose is kept, so during the hitstop the swing
      // FREEZES mid-strike. After the freeze they slide back (via the smooth
      // slap-parry slide, NOT knockbackVelocity+isHit) in their own move's
      // recovery — reads as "my swing got deflected and I stumbled back", never
      // as "I got hit". Position is the payout: the shove sends them OUT of range
      // so the parrier REVERSES the ground. Perfect adds bigger shove/drain,
      // a balance refund, and real frame advantage (a guaranteed poke).
      attacker.isAttacking = false;      // kill the hitbox (pose stays via isSlapAttack/isPalmThrust)
      attacker.slapActiveEndTime = 0;
      attacker.chargedActiveEndTime = 0;
      attacker.attackEndTime = 0;        // cancel the normal recovery handoff (loop reads this)
      attacker.isChargingAttack = false;
      attacker.isSlapSliding = false;
      attacker.isHit = false;            // NEVER hit.png on a parry
      attacker.isParryKnockback = false;
      attacker.knockbackVelocity = { x: 0, y: 0 };
      attacker.movementVelocity = 0;
      attacker.isStrafing = false;
      attacker.slapParryKnockbackVelocity = 0; // applied after the freeze
      attacker.lastHitTime = currentTime;
      timeoutManager.clearPlayerSpecific(attacker.id, "slapCycle");
      timeoutManager.clearPlayerSpecific(attacker.id, "palmThrustVisualEnd");
      timeoutManager.clearPlayerSpecific(attacker.id, "palmThrustStartupEnd");
      timeoutManager.clearPlayerSpecific(attacker.id, "parryStaggerBegin");
      timeoutManager.clearPlayerSpecific(attacker.id, "parryStaggerReset");

      const drain = isPerfect ? AP_PERFECT_BALANCE_DRAIN : AP_BALANCE_DRAIN;
      attacker.balance = Math.max(0, attacker.balance - drain);

      const shove = isPerfect ? AP_PERFECT_ATTACKER_KNOCKBACK : AP_ATTACKER_KNOCKBACK;
      // Lockout keyed to the committed move. A slap recovers ~with the parrier
      // (regular = near-neutral by design); palm's long recovery is already a
      // free punish. A PERFECT slap parry adds advantage so even the fast slap
      // becomes a guaranteed poke.
      let staggerMs = isSlapAttack ? AP_STAGGER_SLAP_MS : AP_STAGGER_PALM_MS;
      if (isPerfect && isSlapAttack) staggerMs += AP_PERFECT_ADVANTAGE_MS;
      // Immediate lock covers the freeze + stagger (can't act during the freeze).
      attacker.inputLockUntil = Math.max(attacker.inputLockUntil || 0, currentTime + staggerMs);

      // After the freeze (~1 tick past the sim-frozen hitstop): drop the attack
      // pose into recovery and apply the shove slide.
      const shoveVel = shove * knockbackDirection;
      setPlayerTimeout(
        attacker.id,
        () => {
          attacker.isSlapAttack = false;
          attacker.isPalmThrust = false;
          attacker.attackType = null;
          attacker.isRecovering = true;
          attacker.slapParryKnockbackVelocity = shoveVel;
          attacker.inputLockUntil = Math.max(attacker.inputLockUntil || 0, simNow(currentRoom) + staggerMs);
          timeoutManager.clearPlayerSpecific(attacker.id, "parryStaggerReset");
          setPlayerTimeout(
            attacker.id,
            () => { attacker.isRecovering = false; },
            staggerMs,
            "parryStaggerReset"
          );
        },
        20,
        "parryStaggerBegin"
      );

      // If the attacker's grab telegraph is stale, clear it.
      if (
        !attacker.isGrabbingMovement &&
        !attacker.isGrabbing &&
        !attacker.isGrabClashing
      ) {
        attacker.grabState = GRAB_STATES.INITIAL;
        attacker.grabAttemptType = null;
      }

      // ── PARRIER reward. Each parry costs stamina (re-tapping a flurry drains
      // you). Post-deflect: NEVER auto-enter GUARD from a continued hold — that
      // made fast release→re-press eat block on the next slap. Drop the stance
      // floor; success + isApPostParryLocked plant for AP_SUCCESS_RECOVERY_MS
      // (same for regular/perfect). Rising-edge re-tap still arms immediately
      // (clears pose, lock flag survives). Perfect refunds balance.
      const stillHolding = parrier.isCPU ? !!parrier.keys.s : !!parrier.keys[" "];
      parrier.stamina = Math.max(0, parrier.stamina - AP_STAMINA_COST);
      parrier.isGuarding = false;
      parrier.isRawParrying = false;
      parrier.apSpaceConsumed = false; // next rising edge may re-arm immediately
      if (stillHolding) {
        parrier.apGuardNeedsRelease = true;
      }
      parrier.isRawParrySuccess = !isPerfect;
      parrier.isPerfectRawParrySuccess = isPerfect;
      parrier.apActiveUntil = 0;         // consume the window (re-tap to parry again)
      parrier.apChainCount = (parrier.apChainCount || 0) + 1;
      parrier.isApWhiffRecovering = false;
      parrier.apRecoveryUntil = 0;
      // Tap-every-slap: next rising-edge re-arm may extend to cover ASAP follow-up.
      grantAttackParryFlurryCover(parrier, currentTime, staggerMs);

      let perfectBalanceGain = 0;
      if (isPerfect) {
        const before = parrier.balance;
        parrier.balance = Math.min(BALANCE_MAX, parrier.balance + AP_PERFECT_BALANCE_REFUND);
        perfectBalanceGain = parrier.balance - before;
      }

      // Shared plant for regular + perfect. isApPostParryLocked survives flurry
      // re-taps (which clear success pose only).
      parrier.isApPostParryLocked = true;
      parrier.apPostParryLockUntil = currentTime + AP_SUCCESS_RECOVERY_MS;
      timeoutManager.clearPlayerSpecific(parrier.id, "parrySuccess");
      setPlayerTimeout(
        parrier.id,
        () => {
          parrier.isRawParrySuccess = false;
          parrier.isPerfectRawParrySuccess = false;
          parrier.isApPostParryLocked = false;
          parrier.apPostParryLockUntil = 0;
        },
        AP_SUCCESS_RECOVERY_MS,
        "parrySuccess"
      );

      if (currentRoom) {
        const hitstop = isPerfect ? AP_PERFECT_HITSTOP_MS : AP_HITSTOP_MS;
        triggerHitstopAndEmit(io, currentRoom, hitstop, isPerfect ? "perfect_parry" : "slap_parry");
        emitThrottledScreenShake(currentRoom, io, { type: isPerfect ? "perfect_parry" : "parry" });
        io.in(currentRoom.id).emit("raw_parry_success", {
          attackerX: attacker.x,
          parrierX: parrier.x,
          facing: parrier.facing,
          isPerfect,
          isAttackParry: true,
          isKill: false,
          chainCount: parrier.apChainCount,
          timestamp: Date.now(),
          parryId: `${parrier.id}_ap_${Date.now()}`,
          playerNumber: parryingPlayerNumber,
          parrierId: parrier.id,
          balanceGain: perfectBalanceGain,
        });
      }
    }
  } else {
    // === ROCK-SOLID HIT PROCESSING ===
    // Clear any existing hit state cleanup to prevent conflicts
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "hitStateReset");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "parryKnockbackReset");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "perfectParryStunReset");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "grabMovementTimeout");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "atTheRopesTimeout");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "slapEndlagReset");
    timeoutManager.clearPlayerSpecific(otherPlayer.id, "chargedEndlagReset");

    // If otherPlayer was grabbing someone, clear the grabbed player's state first
    if (otherPlayer.isGrabbing && otherPlayer.grabbedOpponent) {
      const grabbedPlayer = currentRoom.players.find(p => p.id === otherPlayer.grabbedOpponent);
      if (grabbedPlayer) {
        grabbedPlayer.isBeingGrabbed = false;
      }
    }
    
    // CRITICAL: If otherPlayer was throwing someone, clear the thrown player's state
    // This prevents isBeingThrown from getting stuck when thrower is interrupted
    if (otherPlayer.isThrowing && otherPlayer.throwOpponent) {
      const thrownPlayer = currentRoom.players.find(p => p.id === otherPlayer.throwOpponent);
      if (thrownPlayer) {
        thrownPlayer.isBeingThrown = false;
        thrownPlayer.beingThrownFacingDirection = null;
        // Set Y based on whether they're outside the dohyo
        const outsideDohyo = thrownPlayer.x <= DOHYO_LEFT_BOUNDARY || thrownPlayer.x >= DOHYO_RIGHT_BOUNDARY;
        thrownPlayer.y = outsideDohyo ? (GROUND_LEVEL - DOHYO_FALL_DEPTH) : GROUND_LEVEL;
        if (outsideDohyo) thrownPlayer.isFallingOffDohyo = true;
        thrownPlayer.knockbackVelocity = { x: 0, y: 0 };
      }
    }
    
    // CRITICAL: Clear ALL action states - ensures only ONE state at a time
    // TAP-style: clearAllActionStates now preserves charge power when mouse1 is held
    clearAllActionStates(otherPlayer);
    
    // Clear parry success states when hit
    otherPlayer.isRawParrySuccess = false;
    otherPlayer.isPerfectRawParrySuccess = false;

    otherPlayer.isHit = true;
    otherPlayer.lastHitType = isSlapAttack ? "slap" : isLowKick ? "lowKick" : "charged";
    // MASTERY Phase 3: taking a hit breaks the victim's tsuppari rhythm.
    otherPlayer.cadenceChain = 0;

    // Block multiple hits from this same attack
    otherPlayer.isAlreadyHit = true;

    // Increment hit counter for reliable hit sound triggering
    otherPlayer.hitCounter = (otherPlayer.hitCounter || 0) + 1;

    // MASTERY Phase 4 (4.2 tip/deep spacing) + (4.5 follow-through). Resolved
    // ONCE here (positions are still at the connect moment) so the posture-drain
    // block, the on-hit ground transfer, and the recovery adjustment all read
    // the same values. All collapse to today's behavior with the flag off:
    //   isTipSlap = false, followThroughDir = 0.
    // 4.2: a slap that connects at the TIP of its range (attacker↔victim
    //   distance > SLAP_TIP_DISTANCE) rewards the spacing — deeper posture
    //   damage + a touch more drift; a point-blank (deep) slap is baseline.
    // 4.5: the attacker's held direction at connect (or CPU archetype intent)
    //   dials the pair-shift and their own recovery (see resolveSlapFollowThrough).
    const isTipSlap =
      MASTERY_P4_ANALOG &&
      isSlapAttack &&
      Math.abs(player.x - otherPlayer.x) > SLAP_TIP_DISTANCE;
    let followThroughDir = 0;
    if (MASTERY_P4_ANALOG && isSlapAttack) {
      const ftPushDir = player.facing === 1 ? -1 : 1;
      followThroughDir = resolveSlapFollowThrough(player, otherPlayer, ftPushDir, currentRoom);
    }
    const followShiftMult =
      followThroughDir > 0
        ? FOLLOW_THROUGH_TOWARD_SHIFT
        : followThroughDir < 0
        ? FOLLOW_THROUGH_AWAY_SHIFT
        : 1;
    const tipDriftMult = isTipSlap ? SLAP_TIP_DRIFT_MULT : 1;

    // Light stamina chip on hit; balance (POSTURE) is the primary hit tax.
    // Slap: no stam drain. Charged: ~one slap cost. Palm: even lighter chip.
    // MASTERY Phase 2 (2.2): posture drains deepen (tsuppari breaks posture,
    // the palm is the dedicated posture-breaker) and a COUNTER hit drains ×1.5
    // (its frame bonus is unchanged). Flag off ⇒ today's BALANCE_* values with
    // no counter multiplier (byte-identical).
    const postureCounterMult =
      MASTERY_P2_POSTURE && isCounterHit ? POSTURE_COUNTER_DRAIN_MULT : 1;
    if (isLowKick) {
      otherPlayer.stamina = Math.max(0, otherPlayer.stamina - SLAP_HIT_VICTIM_STAMINA_DRAIN);
      let kickDrain = LOW_KICK_BALANCE_DRAIN;
      if (victimWasDefending) kickDrain = LOW_KICK_BALANCE_DRAIN_VS_PARRY;
      else if (isCounterHit) kickDrain = LOW_KICK_BALANCE_DRAIN_COUNTER;
      otherPlayer.balance = Math.max(0, otherPlayer.balance - kickDrain * postureCounterMult);
    } else if (isSlapAttack) {
      otherPlayer.stamina = Math.max(0, otherPlayer.stamina - SLAP_HIT_VICTIM_STAMINA_DRAIN);
      // MASTERY Phase 3: an enhanced (cadence) slap breaks posture harder than a
      // normal one — the rhythm player's tsuppari bites. Falls back to the P2
      // drain (then today's base if P2 is off), so flag off ⇒ unchanged.
      const slapDrainBase =
        MASTERY_P3_CADENCE && player.isEnhancedSlap
          ? BALANCE_SLAP_HIT_DRAIN_ENHANCED
          : (MASTERY_P2_POSTURE ? BALANCE_SLAP_HIT_DRAIN_P2 : BALANCE_SLAP_HIT_DRAIN);
      // MASTERY Phase 4 (4.2): a tip slap breaks posture harder (spacing reward);
      // deep/point-blank is baseline. tipPostureMult === 1 with the flag off.
      const tipPostureMult = isTipSlap ? SLAP_TIP_POSTURE_MULT : 1;
      const slapDrain = slapDrainBase * postureCounterMult * tipPostureMult;
      otherPlayer.balance = Math.max(0, otherPlayer.balance - slapDrain);
    } else if (player.isPalmThrust) {
      otherPlayer.stamina = Math.max(0, otherPlayer.stamina - PALM_THRUST_HIT_VICTIM_STAMINA_DRAIN);
      const palmDrain = (MASTERY_P2_POSTURE ? BALANCE_PALM_HIT_DRAIN_P2 : BALANCE_CHARGED_HIT_DRAIN) * postureCounterMult;
      otherPlayer.balance = Math.max(0, otherPlayer.balance - palmDrain);
    } else {
      otherPlayer.stamina = Math.max(0, otherPlayer.stamina - CHARGED_HIT_VICTIM_STAMINA_DRAIN);
      const chargedDrain = (MASTERY_P2_POSTURE ? BALANCE_CHARGED_HIT_DRAIN_P2 : BALANCE_CHARGED_HIT_DRAIN) * postureCounterMult;
      otherPlayer.balance = Math.max(0, otherPlayer.balance - chargedDrain);
    }

    // Update opponent's facing direction based on attacker's position
    // UNLESS they're at the ropes OR have locked atTheRopes facing direction
    // The atTheRopesFacingDirection should persist through hits until:
    // - They're brought back into the ring (cleared below)
    // - Or until round reset
    if (!otherPlayer.isAtTheRopes && !otherPlayer.atTheRopesFacingDirection) {
      otherPlayer.facing = player.x < otherPlayer.x ? 1 : -1;
    }

    // Calculate knockback direction
    // For both slap and charged attacks, use the attacker's facing direction to ensure consistent knockback
    // The opponent should always be knocked back in the direction the attacker is facing
    // This prevents visual confusion when a player dodges through the opponent and releases a charged attack,
    // where they might pass back through the opponent during the attack movement
    const knockbackDirection = player.facing === 1 ? -1 : 1;

    // MASTERY Phase 1 (1.3): victim-side momentum. `intoHit` (+) = the victim
    // was moving INTO the hit (charging in → carries more distance); (−) = they
    // were BRACING away (a well-timed brake → less distance). `victimKbScale`
    // multiplies the knockback for slap and charged below; the palm uses
    // `victimIntoHit` for its matador base instead (see palm branch). Kill-band
    // checks still evaluate at the connect position (unchanged) and every rope
    // clamp still applies (invariant #3). Flag off ⇒ 1 / 0, no change.
    let victimKbScale = 1;
    let victimIntoHit = 0;
    // MASTERY Phase 5 (5.2): legibility tell computed here, emitted in player_hit.
    // A "momentum hit" (heavier spark + deeper SFX) is set in the slap branch once
    // the on-hit ground-transfer mult clears MOMENTUM_HIT_MULT_THRESHOLD.
    let momentumHitTell = false;
    if (MASTERY_P1_MOMENTUM) {
      victimIntoHit = alignedEntryVelocity(victimEntryV, knockbackDirection * -1);
      victimKbScale =
        1 +
        K_VICTIM_INTO * Math.max(0, victimIntoHit) -
        K_VICTIM_BRACE * Math.max(0, -victimIntoHit);
      victimKbScale = Math.max(
        VICTIM_KB_SCALE_MIN,
        Math.min(victimKbScale, VICTIM_KB_SCALE_MAX)
      );
    }

    // Calculate knockback multiplier based on attack type.
    // Slap: base 1.0 — its knockback is the fixed ground-transfer drift; the
    // multiplier only carries counter/power/basho scaling into that drift.
    let finalKnockbackMultiplier;
    if (isSlapAttack) {
      finalKnockbackMultiplier = 1.0;
    } else {
      finalKnockbackMultiplier = 0.45 + Math.pow(chargePercentage / 100, 1.3) * 0.75;
    }

    if (isCounterHit) {
      finalKnockbackMultiplier *= isSlapAttack ? SLAP_COUNTER_KB_MULT : 1.25;
    }

    // Armor-break punch: charged shattering grab armor isn't tagged as a
    // counter hit (separate VFX), but it should still hit harder than a
    // neutral charged confirm — the grabber committed hard and ate the read.
    if (isChargedArmorBreak) {
      finalKnockbackMultiplier *= 1.4;
    }

    // PUNISH IS A LABEL, GAME-WIDE: no knockback bonus, no stun bonus, no
    // ring-out bypass. The free hit itself is the whole prize — the banner
    // just tells both players what happened.

    if (player.activePowerUp === POWER_UP_TYPES.POWER) {
      if (isSlapAttack) {
        finalKnockbackMultiplier *= player.powerUpMultiplier * 0.923;
      } else {
        finalKnockbackMultiplier *= player.powerUpMultiplier;
      }
    }

    // BASHO attribute mods: POWER scales knockback DEALT (attacker), RESISTANCE
    // scales knockback RECEIVED (victim). Both default to 1.0 for any player
    // without statMods (PvP, VS CPU, and the BASHO CPU opponent) → identical to
    // today. Folded into finalKnockbackMultiplier so it flows into the charged
    // knockback velocity AND the cinematic-kill predictor consistently; the
    // fixed slap-finisher velocity is scaled separately below.
    // BASHO draft: stacked Power Water scales knockback DEALT (+5% per pick,
    // stacks across the run). Guarded so an undrafted BASHO fighter keeps
    // powerMult === 1; undefined → 1 for every non-BASHO player.
    const draftPowerMult = player.bashoDraft?.powerMult ?? 1;
    // BASHO draft power is +5% per pick (vs PvP's +30%) — skip the slap
    // dampening PvP uses (×0.923) so the stated boost actually lands on slaps.
    const draftPower = draftPowerMult;
    const bashoKbFactor =
      (player.statMods?.power ?? 1) *
      (otherPlayer.statMods?.resistance ?? 1) *
      draftPower;
    finalKnockbackMultiplier *= bashoKbFactor;

    let isCinematicKill = false;
    const knockbackAllowed = canApplyKnockback(otherPlayer);

    if (knockbackAllowed || isSlapAttack || isLowKick) {
      if (isSlapAttack) {
        const pushDirection = player.facing === 1 ? -1 : 1;

        // MASTERY Phase 1 (1.2): on-hit ground transfer INHERITS the attacker's
        // entry momentum. momentumMult scales BOTH the attacker's forward slide
        // and the victim's drift by the same factor, so a dash-in slap shoves
        // for real ground while a flat-footed slap is exactly today's value
        // (slapEntryAligned 0 ⇒ momentumMult 1). Each is separately capped.
        const slapMomentumMult = MASTERY_P1_MOMENTUM
          ? 1 + K_SLAP_KB_INHERIT * (player.slapEntryAligned || 0)
          : 1;
        // MASTERY Phase 5 (5.2): tag the hit as a "momentum hit" for the heavy
        // spark/SFX tell once the carried entry clears the threshold. Pure
        // presentation — gated on P5 so it's absent with the flag off.
        momentumHitTell =
          MASTERY_P5_ASSISTS && slapMomentumMult > MOMENTUM_HIT_MULT_THRESHOLD;
        // MASTERY Phase 3: an enhanced (cadence) slap shifts the pair ~15% more
        // (step-in). Scales BOTH the attacker push and the victim drift equally
        // (so it's a positional pair-shift, not a knockback change) and stays
        // under the same Phase 1 caps. cadenceStepMult === 1 with the flag off or
        // on a normal slap ⇒ byte-identical.
        const cadenceStepMult =
          MASTERY_P3_CADENCE && player.isEnhancedSlap ? CADENCE_STEP_IN_MULT : 1;
        // MASTERY Phase 4 (4.5): follow-through scales the pair-shift — holding
        // TOWARD commits (×1.35 shift), holding AWAY fades (×0.8). Applied to
        // BOTH the attacker push and the victim drift so it stays a positional
        // pair-shift under the existing caps. followShiftMult === 1 (neutral /
        // flag off) ⇒ byte-identical. The tip drift bonus (4.2) rides the drift
        // only (tipDriftMult === 1 when deep / flag off).
        const attackerPush = MASTERY_P1_MOMENTUM
          ? Math.min(SLAP_ONHIT_ATTACKER_PUSH * slapMomentumMult * cadenceStepMult * followShiftMult, SLAP_ONHIT_ATTACKER_PUSH_CAP)
          : Math.min(SLAP_ONHIT_ATTACKER_PUSH * cadenceStepMult * followShiftMult, SLAP_ONHIT_ATTACKER_PUSH_CAP);

        // HIT-CONFIRM (unconditional): a slap that connects is a confirmed hit
        // even while the victim is knockback-immune. These flags (and the
        // VFX/hitstop below) must NOT sit behind canApplyKnockback: when a slap
        // connects LATE in its active window, the immunity it grants can still
        // cover the next slap's connect moment — gating the confirm there would
        // make it land as a silent "phantom hit" (victim stunned, but no VFX,
        // no hitstop).
        player.movementVelocity = pushDirection * attackerPush;
        player.isSlapSliding = true;
        player.lastSlapHitLandedTime = currentTime;
        player.currentSlapHitConnected = true;

        if (knockbackAllowed) {
          otherPlayer.isSlapKnockback = true;
          // Clear any stale charged-knockback marker so a prior charged hit's
          // rope-clamp gate can't catch this slap knockback.
          otherPlayer.isChargedKnockback = false;

          // ROPE RESISTANCE GATE (per-hit): a slap may only push the victim
          // OUT of the ring if the hit landed while they were already within
          // SLAP_KILL_RANGE of the boundary they're being knocked toward.
          // No exceptions (punish included) — otherwise the rope catches them
          // (clamped at the edge in the isHit movement block).
          const distanceToBoundaryInKbDir = knockbackDirection > 0
            ? MAP_RIGHT_BOUNDARY - otherPlayer.x
            : otherPlayer.x - MAP_LEFT_BOUNDARY;
          // MASTERY Phase 2 (2.4): the kill band expands with the attacker's
          // carried momentum + the victim's broken posture (flag off ⇒
          // SLAP_KILL_RANGE, unchanged).
          otherPlayer.slapKnockbackCanRingOut =
            distanceToBoundaryInKbDir <= slapKillBand(player, otherPlayer);

          // GROUND TRANSFER: both players slide toward the victim's rope, but
          // the victim drifts slightly FASTER (SLAP_ONHIT_VICTIM_DRIFT >
          // attacker push), so back-to-back slaps self-space out of range.
          // finalKnockbackMultiplier carries counter (×1.25) / POWER / BASHO
          // scaling into the drift — extra shove on an earned read.
          // MASTERY Phase 1: the drift also inherits the attacker's entry
          // (slapMomentumMult, 1.2) AND the victim's into/brace momentum
          // (victimKbScale, 1.3), capped in total. Flag off ⇒ today's formula.
          otherPlayer.knockbackVelocity.x = MASTERY_P1_MOMENTUM
            ? pushDirection *
              Math.min(
                SLAP_ONHIT_VICTIM_DRIFT * slapMomentumMult * finalKnockbackMultiplier * victimKbScale * cadenceStepMult * followShiftMult * tipDriftMult,
                SLAP_ONHIT_VICTIM_DRIFT_CAP
              )
            : pushDirection * SLAP_ONHIT_VICTIM_DRIFT * finalKnockbackMultiplier * cadenceStepMult * followShiftMult * tipDriftMult;
        }

      } else if (isLowKick) {
        // LOW KICK: small slap-sized shove, NEVER rings out. Posture tool.
        isCinematicKill = false;
        otherPlayer.isSlapKnockback = true;
        otherPlayer.isBurstKnockback = true;
        otherPlayer.isChargedKnockback = false;
        otherPlayer.burstKnockbackStartTime = currentTime;
        otherPlayer.knockbackVelocity.x =
          knockbackDirection * LOW_KICK_KB_VELOCITY * bashoKbFactor;
        otherPlayer.knockbackVelocity.y = 0;
        otherPlayer.movementVelocity = 0;
        otherPlayer.slapKnockbackCanRingOut = false;

        player.movementVelocity = 0;
        player.knockbackVelocity = { x: 0, y: 0 };
      } else if (player.isPalmThrust) {
        // PALM THRUST: NOT a charged-style finisher. It delivers a burst
        // knockback with the rope-resistance clamp, so it can only ring a
        // victim out if they were ALREADY within SLAP_KILL_RANGE of the
        // boundary they're shoved toward. From mid-ring the rope catches them
        // at the edge (clamped in the isHit movement block, gated on
        // isSlapKnockback) — no cinematic KO from range. This keeps the palm
        // a spacing / wall-carry tool, not a kill move.
        isCinematicKill = false;

        // HEAVY single hit — now the game's big committal ground-based shove
        // (slaps only gain ground; the palm SENDS them). Burst DELIVERY
        // (isBurstKnockback → smooth ICE_COAST decay) with its own tunable
        // velocity (PALM_THRUST_KB_VELOCITY). isSlapKnockback + the
        // SLAP_KILL_RANGE gate still clamp the victim at the boundary unless
        // they were already in kill range — no midscreen ring-out.
        otherPlayer.isSlapKnockback = true;
        otherPlayer.isBurstKnockback = true;
        otherPlayer.isChargedKnockback = false;
        otherPlayer.burstKnockbackStartTime = currentTime;
        // MASTERY Phase 1 (1.6): matador. The palm stays rooted, but a read on a
        // CHARGING opponent turns their own closing speed against them —
        // victimIntoHit (+) is the victim advancing into the thrust. Capped at
        // PALM_MATADOR_KB_CAP so the flap body-slam (3.1) stays the heaviest
        // strike. This IS the palm's momentum treatment (it deliberately skips
        // the generic 1.3 victim scale to avoid double-counting closing speed).
        // Flag off / closing speed 0 ⇒ today's PALM_THRUST_KB_VELOCITY.
        const palmBase = MASTERY_P1_MOMENTUM
          ? Math.min(
              PALM_THRUST_KB_VELOCITY + K_PALM_MATADOR * Math.max(0, victimIntoHit),
              PALM_MATADOR_KB_CAP
            )
          : PALM_THRUST_KB_VELOCITY;
        otherPlayer.knockbackVelocity.x = knockbackDirection * palmBase * bashoKbFactor;
        otherPlayer.knockbackVelocity.y = 0;
        otherPlayer.movementVelocity = 0;

        const distanceToBoundaryInKbDir =
          knockbackDirection > 0
            ? MAP_RIGHT_BOUNDARY - otherPlayer.x
            : otherPlayer.x - MAP_LEFT_BOUNDARY;
        // MASTERY Phase 2 (2.4): the palm (rooted → no momentum term) still gets
        // the broken-posture band extension. Flag off ⇒ SLAP_KILL_RANGE.
        otherPlayer.slapKnockbackCanRingOut =
          distanceToBoundaryInKbDir <= slapKillBand(player, otherPlayer);

        // Palm holds its ground — no backward recoil on a connected hit.
        player.movementVelocity = 0;
        player.knockbackVelocity = { x: 0, y: 0 };
      } else {
        otherPlayer.isSlapKnockback = false;
        otherPlayer.slapKnockbackCanRingOut = false;
        otherPlayer.knockbackVelocity.x = 0;
        otherPlayer.movementVelocity = 0;

        // ── CHARGED CINEMATIC KILL — one continuous "kill reach" rule ─────────
        // The KO is decided by a single, learnable question: at contact, is the
        // victim within `killReach` of the ROPE (MAP_*_BOUNDARY 340/935) they're
        // being knocked toward? killReach scales with the FULL power of THIS hit
        // (finalKnockbackMultiplier already folds in charge %, the POWER power-up
        // / Power Water, BASHO power & resistance stat mods, and counter-hit
        // ×1.25 — punish adds NOTHING, it's a label), so power sources extend
        // the reach even at lower charge — but a HARD CAP keeps a wide NO-KILL
        // deadzone in the middle of the 595px ring: from midscreen a charged hit
        // can never ring out regardless of power. It rope-clamps the victim at
        // the edge instead (below + index.js), where the NEXT hit is earned.
        // No invisible read bypass, no charge cliff — just power vs. distance.
        const distToBoundaryChargedKb = knockbackDirection > 0
          ? MAP_RIGHT_BOUNDARY - otherPlayer.x
          : otherPlayer.x - MAP_LEFT_BOUNDARY;

        let killReach = chargedKillReach(finalKnockbackMultiplier);
        // MASTERY Phase 2 (2.4): a charged hit reaches farther into a
        // broken-posture victim (×1.25), still re-capped at
        // CHARGED_KILL_REACH_CAP so the 325px midscreen deadzone survives
        // (invariant #3). Flag off / posture intact ⇒ unchanged.
        if (MASTERY_P2_POSTURE && otherPlayer.isPostureBroken) {
          killReach = Math.min(
            killReach * POSTURE_CHARGED_KILL_REACH_MULT,
            CHARGED_KILL_REACH_CAP
          );
        }
        isCinematicKill = distToBoundaryChargedKb <= killReach;

        // Marker + gate for the index.js rope clamp: a charged hit that is NOT a
        // cinematic kill slams the victim TO the rope, not through it.
        otherPlayer.isChargedKnockback = true;
        otherPlayer.chargedKnockbackCanRingOut = isCinematicKill;

        if (isCinematicKill) {
          otherPlayer.isCinematicKillVictim = true;
          otherPlayer.lastHitType = "cinematicKill";
          player.isRecovering = false;
          player.isAttacking = true;
          player.attackType = "charged";
          // Hold the attack pose exactly through the cinematic freeze: sim
          // timers don't tick during hitstop, so a 0-delay timer fires on the
          // first tick AFTER the freeze ends (the old version used a wall-clock
          // delay of CINEMATIC_KILL_HITSTOP_MS to approximate this).
          setPlayerTimeout(player.id, () => {
            player.isAttacking = false;
            player.isRecovering = true;
            player.recoveryStartTime = simNowForPlayer(player);
            player.recoveryDuration = 400;
          }, 0, "cinematicAttackerRecovery");
        }

        const kbBoost = isCinematicKill ? CINEMATIC_KILL_KNOCKBACK_BOOST : 1;
        // MASTERY Phase 1 (1.3): a victim charging INTO a charged hit carries
        // farther; a braced victim eats less. The kill gate above already
        // resolved at the connect position, so this only changes carry distance
        // (rope clamps still apply). victimKbScale is exactly 1 when the flag is
        // off ⇒ byte-identical.
        otherPlayer.knockbackVelocity.x =
          2.7 * knockbackDirection * finalKnockbackMultiplier * kbBoost * victimKbScale;
        otherPlayer.movementVelocity = 0;

        const attackerBounceDirection = -knockbackDirection;
        // Charge-scaled recoil: a harder charge kicks the attacker back with a
        // punchy initial pop (that front-loaded snap is the "hard, quick" impact
        // feel). Palm thrust and cinematic kills hold their ground (no recoil).
        const attackerBounceMultiplier =
          CHARGED_ATTACKER_RECOIL_BASE +
          (chargePercentage / 100) * CHARGED_ATTACKER_RECOIL_CHARGE_SCALE;
        if (isCinematicKill || player.isPalmThrust) {
          player.movementVelocity = 0;
          player.isChargedHitRecoil = false;
        } else {
          player.movementVelocity =
            2 * attackerBounceDirection * attackerBounceMultiplier;
          // Settle this recoil on the fast recoil friction (snappy pop, short
          // slide) rather than the slow global ice coast — see index.js.
          player.isChargedHitRecoil = true;
        }
        player.knockbackVelocity = { x: 0, y: 0 };
      }

      if (!isSlapAttack && !isLowKick) {
        const minSepDist = HITBOX_DISTANCE_VALUE * 2 * Math.max(player.sizeMultiplier || 1, otherPlayer.sizeMultiplier || 1);
        const currentDist = Math.abs(player.x - otherPlayer.x);
        if (currentDist < minSepDist) {
          const deficit = minSepDist - currentDist;
          const pushDir = otherPlayer.x >= player.x ? 1 : -1;
          otherPlayer.x += pushDir * deficit;
        }
      }

      // Immunity refresh only when knockback was actually applied — a no-knockback
      // slap confirm must not extend the immunity window it was suppressed by.
      if (knockbackAllowed) {
        setKnockbackImmunity(otherPlayer);
      }

      // Emit hit effect at the hit player's position
      if (currentRoom) {
        // PERF: the counter-hit and punish side banners used to be TWO extra
        // socket events (`counter_hit` / `punish_banner`) emitted in this same
        // tick right after `player_hit`. On the client each arrived as its own
        // socket callback → its own (unbatched) full GameFighter re-render, so
        // every counter/punish cost an EXTRA heavy reconciliation back-to-back
        // with the hit render. That doubled render is the counter-hit hitch.
        // The banners are now folded into the player_hit payload (the client
        // triggers them from the single handler), so a counter/punish costs the
        // same one render as a normal hit.
        const attackerPlayerNumber =
          currentRoom.players.findIndex((p) => p.id === player.id) + 1;
        io.in(currentRoom.id).emit("player_hit", {
          x: otherPlayer.x,
          y: otherPlayer.y,
          facing: otherPlayer.facing,
          attackType: isSlapAttack ? "slap" : isLowKick ? "lowKick" : "charged",
          // Palm thrust rides the charged hit path but uses the big burst
          // spark on the client (not the charged sheet).
          isPalmThrust: !!player.isPalmThrust,
          isLowKick: !!isLowKick,
          // Drives the client charged-hit shake scaling (heavier charge = bigger crunch).
          chargePercentage: isSlapAttack ? 0 : chargePercentage,
          timestamp: Date.now(),
          hitId: Math.random().toString(36).substr(2, 9),
          // Drives hit VFX styling (counter = special color, punish = label
          // styling only — no mechanical bonus behind it).
          isCounterHit: isCounterHit,
          isPunish: isPunish,
          // Attacker side: client triggers the COUNTER HIT / PUNISH side
          // banner off these (folded in from the old separate events).
          showCounterBanner: isCounterHit,
          showPunishBanner: isPunish,
          attackerPlayerNumber,
          cinematicKill: isCinematicKill || false,
          knockbackDirection: knockbackDirection,
          // Charged attack shattering grab armor — client recolors the
          // charged hit VFX from orange to white/yellow to visually match
          // the glass-shard armor break (instead of looking like a normal
          // counter/charged confirm).
          isArmorBreak: isChargedArmorBreak === true,
          // POWER power-up active on the attacker → client recolors the normal
          // (non-counter / non-punish) white hit VFX to red, signalling the
          // boosted knockback. Counter/punish keep their own special colors.
          isPowered:
            player.activePowerUp === POWER_UP_TYPES.POWER ||
            (player.bashoDraft?.powerMult ?? 1) > 1,
          // attackerId lets the client trigger an attacker-side hit-confirm flash
          // on the attacker's sprite only — distinct from the victim's hit VFX.
          // Without this the attacker has no proprioceptive cue that they "landed it",
          // which is the AAA-feel detail every premium fighting game has.
          attackerId: player.id,
          victimId: otherPlayer.id,
          // MASTERY Phase 3 (tsuppari cadence): flag an enhanced slap so the
          // client layers a sharper, rising-pitch "crack" (pitch climbs with the
          // consecutive-enhanced chain) + hand-flash. 0 / false with the flag off.
          isCadence: MASTERY_P3_CADENCE && isSlapAttack && !!player.isEnhancedSlap,
          cadenceChain: player.cadenceChain || 0,
          // MASTERY Phase 5 (5.2) legibility tells (client-only presentation):
          //  • momentumHit — a dash-in / carried-momentum slap: heavier hitspark
          //    variant + deeper SFX so a big-momentum hit reads across the room.
          //  • braked — the victim BRACED into the hit (their brace reduction
          //    applied): a "dig-in" ice-chip puff + skid SFX rewards the read.
          // Both false with the flag off ⇒ the client renders today's VFX.
          momentumHit: momentumHitTell,
          braked: MASTERY_P5_ASSISTS && MASTERY_P1_MOMENTUM && victimIntoHit < 0,
        });
        
        // ============================================
        // SMASH-STYLE HITSTOP & SCREEN SHAKE
        // Every hit has impact - both hitstop AND screen shake
        // Slaps: snappy, punchy feel
        // Charged: heavy, powerful feel scaling with charge
        // ============================================
        if (isSlapAttack || isLowKick) {
          // One flat, snappy freeze per slap — every slap is an individual hit.
          // Low kick shares the slap freeze (light confirm, not charged weight).
          // Symmetric (the sim clock pauses for BOTH players), so the +0 frame
          // math is untouched by hitstop.
          triggerHitstopAndEmit(io, currentRoom, HITSTOP_SLAP_MS, "slap");

          // Screen shake is handled client-side by useCamera (driven by hitCounter +
          // knockback magnitude) — no need to double-shake from the server here.
        } else if (player.isPalmThrust) {
          // Palm thrust is a burst hit — heavier freeze than a slap poke.
          triggerHitstopAndEmit(io, currentRoom, HITSTOP_BURST_MS, "slap");
        } else {
          // Charged attacks scale hitstop with charge power
          const hitstopDuration = isCinematicKill
            ? CINEMATIC_KILL_HITSTOP_MS
            : getChargedHitstop(chargePercentage / 100);
          triggerHitstopAndEmit(io, currentRoom, hitstopDuration, isCinematicKill ? "cinematic_kill" : "charged");

          if (isCinematicKill) {
            io.in(currentRoom.id).emit("cinematic_kill", {
              attackerId: player.id,
              victimId: otherPlayer.id,
              victimX: otherPlayer.x,
              victimY: otherPlayer.y,
              attackerX: player.x,
              attackerY: player.y,
              knockbackDirection: knockbackDirection,
              hitstopMs: CINEMATIC_KILL_HITSTOP_MS,
              impactX: (player.x + otherPlayer.x) / 2,
              impactY: otherPlayer.y,
            });
          }
          // Charged-hit shake also handled by useCamera via hitCounter + knockback magnitude.
        }
      }
    }

    otherPlayer.knockbackVelocity.y = 0;

    if (otherPlayer.y > GROUND_LEVEL) {
      clearSidestepHitReturn(otherPlayer);
      otherPlayer.isHitFalling = true;
      otherPlayer.hitFallStartTime = currentTime;
      otherPlayer.hitFallStartY = otherPlayer.y;
    } else if (otherPlayer.y < GROUND_LEVEL) {
      clearHitFall(otherPlayer);
      const depthRatio = (GROUND_LEVEL - otherPlayer.y) / 55;
      const duration = SIDESTEP_HIT_RETURN_MIN_MS + (SIDESTEP_HIT_RETURN_BASE_MS - SIDESTEP_HIT_RETURN_MIN_MS) * Math.min(depthRatio, 1);
      otherPlayer.isSidestepHitReturn = true;
      otherPlayer.sidestepHitReturnStartTime = currentTime;
      otherPlayer.sidestepHitReturnStartY = otherPlayer.y;
      otherPlayer.sidestepHitReturnDuration = duration;
    } else {
      otherPlayer.y = GROUND_LEVEL;
    }

    // === HIT STUN DURATION ===
    // SLAP: +0 BY CONSTRUCTION. The victim's hitstun equals the attacker's
    //   remaining attack cycle at the moment of connect, so BOTH players become
    //   actionable at the exact same sim-clock instant — no matter when in the
    //   active window the hit landed. No combo, no frame advantage; the reward
    //   is ground. (Hitstop pauses the sim clock for both, so it cancels out.)
    //   A COUNTER HIT adds a flat SLAP_COUNTER_HIT_BONUS_MS on top — the one
    //   earned exception: your next press wins a mash-vs-mash clash, but a
    //   parry still answers it.
    // CHARGED: fixed 380ms stun (counter ×1.4). Punish adds nothing — label only.
    let hitStateDuration;
    if (isLowKick) {
      // Short burst stun — trip is a read/posture tool, not a combo starter.
      hitStateDuration = BURST_STUN_MS;
      if (isCounterHit || victimWasDefending) {
        hitStateDuration += SLAP_COUNTER_HIT_BONUS_MS;
      }
    } else if (isSlapAttack) {
      const attackerFreeAt = player.attackCooldownUntil || (currentTime + SLAP_RECOVERY_MS);
      hitStateDuration = Math.max(attackerFreeAt - currentTime, SLAP_MIN_HITSTUN_MS);
      if (isCounterHit) {
        hitStateDuration += SLAP_COUNTER_HIT_BONUS_MS;
      }
    } else {
      hitStateDuration = 380;
      if (isCinematicKill) {
        hitStateDuration = 3000;
      } else if (isCounterHit) {
        hitStateDuration = Math.round(hitStateDuration * 1.4);
      }
    }

    // MASTERY Phase 4 (4.5): follow-through recovery dial. The victim's hitstun
    // above is derived from the BASE cycle, so shifting the ATTACKER's cycle
    // here makes the exchange deliberately ±0 instead of +0 (invariant #1's
    // explicit Phase-4 frame exception): holding TOWARD lengthens the attacker's
    // recovery (slightly minus — the victim can answer), holding AWAY shortens it
    // (slightly plus, but they gained less ground). We push BOTH the cooldown
    // gate and the pending "slapCycle" timeout (which clears isAttacking / fires
    // the buffered follow-up) by the same offset so actionability matches.
    // followThroughDir === 0 (neutral / flag off) ⇒ no shift, the +0 default.
    if (isSlapAttack && followThroughDir !== 0) {
      const recoveryOffset =
        followThroughDir > 0
          ? FOLLOW_THROUGH_TOWARD_RECOVERY_MS
          : -FOLLOW_THROUGH_AWAY_RECOVERY_MS;
      player.attackCooldownUntil = (player.attackCooldownUntil || currentTime) + recoveryOffset;
      // advanceNamed pulls a deadline EARLIER by its arg, so negate the offset:
      // +offset (toward) → later cycle end; −offset (away) → earlier.
      timeoutManager.advanceNamed(player.id, "slapCycle", -recoveryOffset);
    }

    // No hitstop extension needed: the stun timer below runs on the sim clock,
    // which freezes during hitstop — victim stun and attacker cycle pause in
    // perfect lockstep, so the +0 margin is frame-exact by construction.

    // Update the last hit time for tracking
    otherPlayer.lastHitTime = currentTime;

    // Palm delivers a burst (isBurstKnockback), so it uses the short no-DI
    // window (BURST_STUN_MS) instead of the generic 380ms charged stun.
    // Low kick already chose its stun above (burst + optional counter bonus).
    const isBurstHit = player.isPalmThrust === true;
    const stunDuration = isLowKick
      ? hitStateDuration
      : isBurstHit
        ? BURST_STUN_MS
        : hitStateDuration;

    setPlayerTimeout(
      otherPlayer.id,
      () => {
        if (Math.abs(otherPlayer.knockbackVelocity.x) > 0.01) {
          otherPlayer.movementVelocity = otherPlayer.knockbackVelocity.x;
        }
        otherPlayer.knockbackVelocity.x = 0;
        otherPlayer.isHit = false;
        otherPlayer.isSlapKnockback = false;
        otherPlayer.slapKnockbackCanRingOut = false;
        otherPlayer.isBurstKnockback = false;
        otherPlayer.burstKnockbackStartTime = 0;

        if (isSlapAttack && SLAP_CHAIN_HIT_GAP_MS > 0) {
          setPlayerTimeout(
            otherPlayer.id,
            () => { otherPlayer.isAlreadyHit = false; },
            SLAP_CHAIN_HIT_GAP_MS,
            "chainHitGap"
          );
        } else {
          otherPlayer.isAlreadyHit = false;
        }
      },
      stunDuration,
      "hitStateReset"
    );

    // Input lockout (sim clock — locks freeze through hitstop instead of being
    // eaten by it). SLAP: the victim's lock matches the +0 hitstun exactly — a
    // shorter fixed lock would silently hand the victim early inputs, a longer
    // one would make them minus.
    const victimLockMs = hitStateDuration;
    // Attacker: brief lock for slaps creates commitment to each strike
    const attackerLockMs = isSlapAttack || isLowKick ? 50 : 200;
    otherPlayer.inputLockUntil = Math.max(
      otherPlayer.inputLockUntil || 0,
      currentTime + victimLockMs
    );
    if (attackerLockMs > 0) {
      player.inputLockUntil = Math.max(
        player.inputLockUntil || 0,
        currentTime + attackerLockMs
      );
    }

  }
}

// ── FLAP body-slam ────────────────────────────────────────────────────────
// The descending flapper is an attacker: dropping onto a grounded opponent
// deals a burst hit equal to HALF a slap-string finisher (slap3). This is NOT
// a regular `isAttacking` strike, so it lives outside checkCollision and is
// polled each tick from the game loop while the flapper is airborne. One
// connect per flight (flapHitLanded latches it), and only while DESCENDING.
// Hitbox tuning — kept deliberately modest so the slam isn't oppressive.
// CONTACT_HEIGHT is the bottom of the slam window raised UP (smaller = the
// flapper must be nearer the ground to connect). WIDTH_SCALE narrows the
// left/right reach relative to a full pushbox.
const FLAP_BODYSLAM_CONTACT_HEIGHT = 60; // Y-offset above ground at which the drop "lands" on a body
const FLAP_BODYSLAM_WIDTH_SCALE = 0.7;   // Horizontal reach as a fraction of pushbox width

// A grounded defender raw-parrying the flap drop. Mirrors the strike-vs-parry
// resolution in processHit, but scoped to the flap: the parry ENDS the flight
// (clearAllActionStates grounds the flapper), bonks the flapper back, and
// rewards the defender (regular OR perfect). Flap is not a slap, so it uses the
// non-slap knockback values.
function resolveFlapRawParry(flapper, opponent, currentRoom, io) {
  // GUARD/PARRY vs the flap body-slam: ends the flight and grounds the flapper
  // (their landing recovery is fully punishable). A live PARRY window grades
  // regular vs PERFECT; GUARDING still stuffs the slam (flap is a huge
  // commitment) but at the regular tier. A parried flap can KILL if the flapper
  // is inside the kill band.
  const currentTime = simNowForPlayer(opponent);
  const knockbackDirection = flapper.x < opponent.x ? -1 : 1;
  const parryingPlayerNumber = currentRoom
    ? currentRoom.players.findIndex((p) => p.id === opponent.id) + 1
    : 1;

  const inParryWindow =
    !opponent.isGuarding && currentTime < (opponent.apActiveUntil || 0);
  const parryDuration = currentTime - (opponent.rawParryStartTime || currentTime);
  const isPerfect =
    inParryWindow && parryDuration >= 0 && parryDuration <= PERFECT_PARRY_WINDOW;

  const killThreshold = isPerfect ? AP_PERFECT_KILL_THRESHOLD : AP_KILL_THRESHOLD;
  const isApKill =
    flapper.balance < killThreshold && currentRoom && !currentRoom.gameOver;

  // End the flight and ground the flapper (the parry beats the slam).
  clearAllActionStates(flapper);
  flapper.y = GROUND_LEVEL;
  flapper.cadenceChain = 0;
  if (!flapper.isAtTheRopes && !flapper.atTheRopesFacingDirection) {
    flapper.facing = flapper.x < opponent.x ? -1 : 1;
  }

  if (isApKill) {
    // Lethal slap-down — the pull cinematic, fully (same as the strike AP kill):
    // the victim is dragged THROUGH the parrier and belly-slides out the far side.
    const nowSim = simNow(currentRoom);
    const victimFacingBeforeKill = flapper.facing;
    const pullDirection = flapper.x < opponent.x ? 1 : -1;
    flapper.isClinchKillPullVictim = true;
    flapper.isBeingPullReversaled = true;
    flapper.pullReversalPullerId = opponent.id;
    flapper.isGrabBreakSeparating = true;
    flapper.grabBreakSepStartTime = nowSim;
    flapper.grabBreakSepDuration = AP_KILL_SLIDE_DURATION_MS;
    flapper.grabBreakStartX = flapper.x;
    flapper.grabBreakTargetX = opponent.x + pullDirection * AP_KILL_SLIDE_DISTANCE;
    flapper.movementVelocity = 0;
    flapper.knockbackVelocity = { x: 0, y: 0 };
    flapper.isStrafing = false;
    flapper.facing = victimFacingBeforeKill;

    opponent.isRawParrying = false;
    opponent.isRawParrySuccess = true;
    opponent.apActiveUntil = 0;
    opponent.isApWhiffRecovering = false;

    if (currentRoom) {
      triggerHitstopAndEmit(io, currentRoom, AP_KILL_HITSTOP_MS, "cinematic_kill");
      io.in(currentRoom.id).emit("cinematic_kill", {
        attackerId: opponent.id,
        victimId: flapper.id,
        victimX: flapper.x,
        victimY: flapper.y,
        attackerX: opponent.x,
        attackerY: opponent.y,
        knockbackDirection: pullDirection,
        hitstopMs: AP_KILL_HITSTOP_MS,
        impactX: (opponent.x + flapper.x) / 2,
        impactY: flapper.y,
        apPullKill: true,
        noPan: true,
      });
      io.in(currentRoom.id).emit("raw_parry_success", {
        attackerX: flapper.x,
        parrierX: opponent.x,
        facing: opponent.facing,
        isPerfect,
        isAttackParry: true,
        isKill: true,
        timestamp: Date.now(),
        parryId: `${opponent.id}_apkill_${Date.now()}`,
        playerNumber: parryingPlayerNumber,
        parrierId: opponent.id,
        balanceGain: 0,
      });
    }
    handleWinCondition(currentRoom, flapper, opponent, io, "clinchKillPull");
    return;
  }

  // ── NON-LETHAL: grounded + shoved back in RECOVERY (no hit.png) + drain ──
  const drain = isPerfect ? AP_PERFECT_BALANCE_DRAIN : AP_BALANCE_DRAIN;
  const shove = isPerfect ? AP_PERFECT_ATTACKER_KNOCKBACK : AP_ATTACKER_KNOCKBACK;
  flapper.balance = Math.max(0, flapper.balance - drain);
  flapper.knockbackVelocity = { x: 0, y: 0 };
  flapper.slapParryKnockbackVelocity = shove * knockbackDirection;
  flapper.isHit = false;
  flapper.isParryKnockback = false;
  flapper.isRecovering = true;
  flapper.lastHitTime = currentTime;
  flapper.inputLockUntil = Math.max(flapper.inputLockUntil || 0, currentTime + AP_STAGGER_FLAP_MS);
  timeoutManager.clearPlayerSpecific(flapper.id, "parryStaggerReset");
  setPlayerTimeout(
    flapper.id,
    () => {
      flapper.isRecovering = false;
      flapper.isAlreadyHit = false;
    },
    AP_STAGGER_FLAP_MS,
    "parryStaggerReset"
  );

  // Parrier reward. Same as slap AP: no auto-GUARD on continued hold; require
  // release before HOLD can block again. Perfect refunds balance. Chain increments.
  const stillHolding = opponent.isCPU ? !!opponent.keys.s : !!opponent.keys[" "];
  opponent.stamina = Math.max(0, opponent.stamina - AP_STAMINA_COST);
  opponent.isGuarding = false;
  opponent.isRawParrying = false;
  opponent.apSpaceConsumed = false;
  if (stillHolding) opponent.apGuardNeedsRelease = true;
  opponent.isRawParrySuccess = !isPerfect;
  opponent.isPerfectRawParrySuccess = isPerfect;
  opponent.apActiveUntil = 0;
  opponent.apChainCount = (opponent.apChainCount || 0) + 1;
  opponent.isApWhiffRecovering = false;
  opponent.apRecoveryUntil = 0;
  grantAttackParryFlurryCover(opponent, currentTime, AP_STAGGER_FLAP_MS);

  let perfectBalanceGain = 0;
  if (isPerfect) {
    const before = opponent.balance;
    opponent.balance = Math.min(BALANCE_MAX, opponent.balance + AP_PERFECT_BALANCE_REFUND);
    perfectBalanceGain = opponent.balance - before;
  }

  opponent.isApPostParryLocked = true;
  opponent.apPostParryLockUntil = currentTime + AP_SUCCESS_RECOVERY_MS;
  timeoutManager.clearPlayerSpecific(opponent.id, "parrySuccess");
  setPlayerTimeout(
    opponent.id,
    () => {
      opponent.isRawParrySuccess = false;
      opponent.isPerfectRawParrySuccess = false;
      opponent.isApPostParryLocked = false;
      opponent.apPostParryLockUntil = 0;
    },
    AP_SUCCESS_RECOVERY_MS,
    "parrySuccess"
  );

  if (currentRoom) {
    const hitstop = isPerfect ? AP_PERFECT_HITSTOP_MS : AP_HITSTOP_MS;
    triggerHitstopAndEmit(io, currentRoom, hitstop, isPerfect ? "perfect_parry" : "slap_parry");
    emitThrottledScreenShake(currentRoom, io, { type: isPerfect ? "perfect_parry" : "parry" });
    io.in(currentRoom.id).emit("raw_parry_success", {
      attackerX: flapper.x,
      parrierX: opponent.x,
      facing: opponent.facing,
      isPerfect,
      isAttackParry: true,
      isKill: false,
      chainCount: opponent.apChainCount,
      timestamp: Date.now(),
      parryId: `${opponent.id}_ap_${Date.now()}`,
      playerNumber: parryingPlayerNumber,
      parrierId: opponent.id,
      balanceGain: perfectBalanceGain,
    });
  }
}

function checkFlapBodySlam(flapper, opponent, rooms, io) {
  // Must be a descending flapper that hasn't already connected this flight.
  if (
    !flapper ||
    !opponent ||
    !flapper.isFlapping ||
    flapper.flapPhase !== "flight" ||
    flapper.flapVelocityY > 0 || // only while falling (≤ 0 = descending/apex)
    flapper.flapHitLanded
  ) {
    return;
  }

  // Contact band: low enough that the body is dropping onto the opponent.
  if (flapper.y - GROUND_LEVEL > FLAP_BODYSLAM_CONTACT_HEIGHT) return;

  // Opponent must be a grounded, hittable target. Airborne/immune/dead/locked
  // defenders can't be body-slammed (mirror the strike i-frame rules).
  if (
    opponent.isDead ||
    opponent.isAlreadyHit ||
    opponent.isHit ||
    opponent.isDodging ||
    opponent.isBeingThrown ||
    opponent.isBeingGrabbed ||
    opponent.isGrabbing ||
    (opponent.isRopeJumping && opponent.ropeJumpPhase === "active") ||
    (opponent.isFlapping && opponent.flapPhase === "flight") ||
    (opponent.isSidestepping && !opponent.isSidestepStartup) ||
    !canApplyKnockback(opponent)
  ) {
    return;
  }

  // Horizontal overlap: bodies must be within a (narrowed) pushbox-width.
  const bodyWidth =
    HITBOX_DISTANCE_VALUE * 2 * FLAP_BODYSLAM_WIDTH_SCALE *
    Math.max(flapper.sizeMultiplier || 1, opponent.sizeMultiplier || 1);
  if (Math.abs(flapper.x - opponent.x) > bodyWidth) return;

  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === flapper.id)
  );
  const currentTime = simNow(currentRoom);

  // The grounded defender can RAW PARRY the drop — the parry beats the slam,
  // ends the flight, and punishes the flapper instead of damaging the defender.
  if (opponent.isRawParrying) {
    resolveFlapRawParry(flapper, opponent, currentRoom, io);
    return;
  }

  // Connecting latches this flight (no double-hit), burns all remaining air
  // charges, and schedules synced recovery once the flapper naturally touches
  // down. Flight physics keep running — no self pushback / scripted descent.
  flapper.flapHitLanded = true;
  flapper.flapCharges = 0;
  flapper.flapHitRecoverDuration = BURST_STUN_MS;

  // Knockback away from the flapper (burst model — no DI).
  const knockbackDirection = opponent.x >= flapper.x ? 1 : -1;

  // MASTERY Phase 1 (1.3): victim-side momentum — capture the victim's velocity
  // BEFORE clearAllActionStates zeroes it. Charging under a descending slam eats
  // more; bracing eats less. Flag off ⇒ 1 (byte-identical).
  let flapKbScale = 1;
  let flapBraked = false;
  if (MASTERY_P1_MOMENTUM) {
    const intoHit = alignedEntryVelocity(
      opponent.movementVelocity || 0,
      knockbackDirection * -1
    );
    flapKbScale =
      1 +
      K_VICTIM_INTO * Math.max(0, intoHit) -
      K_VICTIM_BRACE * Math.max(0, -intoHit);
    flapKbScale = Math.max(
      VICTIM_KB_SCALE_MIN,
      Math.min(flapKbScale, VICTIM_KB_SCALE_MAX)
    );
    // MASTERY Phase 5 (5.2): the victim braced into the slam (brace reduction
    // applied) → "dig-in" tell client-side. Gated on P5 for the emit below.
    flapBraked = intoHit < 0;
  }

  clearAllActionStates(opponent);
  opponent.isRawParrySuccess = false;
  opponent.isPerfectRawParrySuccess = false;
  opponent.isHit = true;
  opponent.lastHitType = "flap";
  opponent.lastHitTime = currentTime;
  opponent.isAlreadyHit = true;
  opponent.hitCounter = (opponent.hitCounter || 0) + 1;
  opponent.isBurstKnockback = true;
  opponent.burstKnockbackStartTime = currentTime;
  opponent.knockbackVelocity.x =
    knockbackDirection * FLAP_BODYSLAM_KB_VELOCITY * flapKbScale;
  opponent.knockbackVelocity.y = 0;
  opponent.movementVelocity = 0;

  // ROPE RESISTANCE (same treatment as the slap/palm): the slam may only send the
  // victim OUT of the ring if they were already within SLAP_KILL_RANGE of the
  // boundary they're knocked toward at connect time. From mid-ring the rope
  // catches them at the edge instead (clamped in the isHit movement block,
  // gated on isSlapKnockback). isBurstKnockback already governs the friction
  // curve, so this flag only enables the rope clamp — no other behavior change.
  opponent.isSlapKnockback = true;
  const distanceToBoundaryInKbDir =
    knockbackDirection > 0
      ? MAP_RIGHT_BOUNDARY - opponent.x
      : opponent.x - MAP_LEFT_BOUNDARY;
  // MASTERY Phase 2 (2.4): flap body-slam (airborne → no momentum term) still
  // gets the broken-posture band extension. Flag off ⇒ SLAP_KILL_RANGE.
  opponent.slapKnockbackCanRingOut =
    distanceToBoundaryInKbDir <= slapKillBand(flapper, opponent);

  if (!opponent.isAtTheRopes && !opponent.atTheRopesFacingDirection) {
    opponent.facing = flapper.x < opponent.x ? 1 : -1;
  }

  opponent.stamina = Math.max(0, opponent.stamina - SLAP_HIT_VICTIM_STAMINA_DRAIN);
  // MASTERY Phase 2 (2.2): slap-class posture drain while the flag is on.
  opponent.balance = Math.max(
    0,
    opponent.balance - (MASTERY_P2_POSTURE ? BALANCE_SLAP_HIT_DRAIN_P2 : BALANCE_SLAP_HIT_DRAIN)
  );

  setKnockbackImmunity(opponent);

  if (currentRoom) {
    io.in(currentRoom.id).emit("player_hit", {
      x: opponent.x,
      y: opponent.y,
      facing: opponent.facing,
      attackType: "flap",
      chargePercentage: 0,
      timestamp: Date.now(),
      hitId: Math.random().toString(36).substr(2, 9),
      isCounterHit: false,
      isPunish: false,
      cinematicKill: false,
      knockbackDirection: knockbackDirection,
      isArmorBreak: false,
      attackerId: flapper.id,
      victimId: opponent.id,
      // MASTERY Phase 5 (5.2): braked-knockback "dig-in" tell (false w/ flag off).
      momentumHit: false,
      braked: MASTERY_P5_ASSISTS && flapBraked,
    });

    triggerHitstopAndEmit(io, currentRoom, HITSTOP_BURST_MS, "slap_burst");
  }

  // Burst stun → hand the residual velocity to the ice coast when it ends.
  setPlayerTimeout(
    opponent.id,
    () => {
      if (Math.abs(opponent.knockbackVelocity.x) > 0.01) {
        opponent.movementVelocity = opponent.knockbackVelocity.x;
      }
      opponent.knockbackVelocity.x = 0;
      opponent.isHit = false;
      opponent.isBurstKnockback = false;
      opponent.burstKnockbackStartTime = 0;
      opponent.isAlreadyHit = false;
    },
    BURST_STUN_MS,
    "hitStateReset"
  );

  opponent.inputLockUntil = Math.max(
    opponent.inputLockUntil || 0,
    currentTime + BURST_STUN_MS
  );
}

module.exports = { checkCollision, processHit, checkFlapBodySlam, resolveSlapTrade, resolveChargeClash };
