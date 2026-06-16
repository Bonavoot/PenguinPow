const {
  GRAB_STATES, GROUND_LEVEL, TICK_RATE, speedFactor,
  HITBOX_DISTANCE_VALUE, CHARGED_HITBOX_DISTANCE_VALUE, SLAP_HITBOX_DISTANCE_VALUE,
  SIDESTEP_RECOVERY_OVERLAP_THRESHOLD,
  SLAP_PARRY_WINDOW, SLAP_PARRY_RECOVERY_MS, SLAP_PARRY_HITSTOP_MS,
  SLAP_PARRY_KNOCKBACK_STRENGTH, SLAP_PARRY_CONSECUTIVE_DECAY_MS,
  DOHYO_FALL_DEPTH,
  POWER_UP_TYPES,
  PERFECT_PARRY_WINDOW, PERFECT_PARRY_KNOCKBACK,
  PERFECT_PARRY_ANIMATION_LOCK, PERFECT_PARRY_ATTACKER_STUN_DURATION,
  PARRY_SUCCESS_DURATION,
  RAW_PARRY_KNOCKBACK, RAW_PARRY_SLAP_KNOCKBACK,
  RAW_PARRY_STAMINA_REFUND, RAW_PARRY_COOLDOWN_MS,
  PERFECT_PARRY_BALANCE_REFUND,
  SLAP_CHAIN_HIT_GAP_MS,
  HITSTOP_SLAP_MS, HITSTOP_SLAP_STRING_MS, SLAP_STRING_ATTACKER_HITSTOP_RELIEF_MS, HITSTOP_SLAP_HIT3_MS, HITSTOP_PARRY_MS, HITSTOP_SLAP_PARRY_MS, HITSTOP_PERFECT_PARRY_MS, HITSTOP_CHARGED_MIN_MS, HITSTOP_CHARGED_MAX_MS,
  SLAP_HIT_VICTIM_STAMINA_DRAIN, CHARGED_HIT_VICTIM_STAMINA_DRAIN,
  BALANCE_MAX, BALANCE_SLAP_HIT_DRAIN, BALANCE_CHARGED_HIT_DRAIN,
  CHARGE_CLASH_RECOVERY_DURATION, CHARGE_CLASH_BASE_KNOCKBACK,
  CHARGE_CLASH_MIN_KNOCKBACK, CHARGE_CLASH_ADVANTAGE_SCALE,
  CHARGE_PRIORITY_THRESHOLD, CHARGE_VS_SLAP_ATTACKER_PENALTY,
  SLAP_STRING_LIGHT_KB_VELOCITY,
  SLAP_NEUTRAL_KB_MULTIPLIER,
  SLAP_HIT3_KB_VELOCITY,
  SLAP_KILL_RANGE,
  SLAP_STRING_HIT_STUN_MS,
  SLAP_HIT3_STUN_MS,
  SLAP_ONHIT_ATTACKER_PUSH,
  CINEMATIC_KILL_MIN_MULTIPLIER,
  CHARGE_FULL_POWER_MS,
  CINEMATIC_KILL_HITSTOP_MS,
  CINEMATIC_KILL_KNOCKBACK_BOOST,
  CINEMATIC_KB_FRICTION,
  CINEMATIC_KB_DI_FRICTION,
  CINEMATIC_KB_MOVEMENT_TRANSFER,
  CINEMATIC_KB_MOVEMENT_FRICTION,
  SIDESTEP_HIT_RETURN_BASE_MS,
  SIDESTEP_HIT_RETURN_MIN_MS,
  COUNTER_HIT_WINDOW_MS,
  SLAP_STARTUP_MS,
  CHARGED_STARTUP_MS,
  GRAB_STARTUP_ARMOR_STAGGER_MS,
  FLAP_BODYSLAM_KB_VELOCITY,
  FLAP_HIT_LANDING_PUSHBACK,
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
} = require("./gameUtils");

const { grabBeatsSlap } = require("./combatHelpers");

const SIM_DELTA = 1000 / TICK_RATE;

function willGuaranteeRingOut(victimX, knockbackDir, finalMultiplier) {
  let kbVel = 1.7 * knockbackDir * finalMultiplier;
  let mvVel = 1.2 * knockbackDir * finalMultiplier;
  let x = victimX;

  for (let i = 0; i < 300; i++) {
    kbVel *= CINEMATIC_KB_FRICTION;
    kbVel *= CINEMATIC_KB_DI_FRICTION;
    mvVel = kbVel * CINEMATIC_KB_MOVEMENT_TRANSFER;
    mvVel *= CINEMATIC_KB_MOVEMENT_FRICTION;

    x += SIM_DELTA * speedFactor * (kbVel + mvVel);

    if (x <= MAP_LEFT_BOUNDARY || x >= MAP_RIGHT_BOUNDARY) return true;
    if (Math.abs(kbVel) < 0.01 && Math.abs(mvVel) < 0.01) break;
  }
  return false;
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
      : CHARGED_HITBOX_DISTANCE_VALUE * (player.sizeMultiplier || 1);

  // For slap attacks, only check horizontal distance and ensure opponent is in front
  if (player.attackType === "slap") {
    const deltaX = otherPlayer.x - player.x;
    const attackDir = player.facing === 1 ? -1 : 1;
    const opponentInFront = deltaX * attackDir >= 0;
    const horizontalDistance = Math.abs(deltaX);
    if (opponentInFront && horizontalDistance < hitboxDistance) {
      if (otherPlayer.isAttacking && otherPlayer.attackType === "slap") {
        // Slap parry: both slaps active within the parry window
        if (player.isSlapParryRecovering || otherPlayer.isSlapParryRecovering) return;
        const timeDifference = Math.abs(
          player.attackStartTime - otherPlayer.attackStartTime
        );
        if (timeDifference <= SLAP_PARRY_WINDOW) {
          const currentRoom = rooms.find((room) =>
            room.players.some((p) => p.id === player.id)
          );
          if (currentRoom) {
            resolveSlapParry(player, otherPlayer, currentRoom, io);
          }
          return;
        }
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

      // First-to-active wins: if defender is in grab startup, timing determines winner
      if (otherPlayer.isGrabStartup && grabBeatsSlap(otherPlayer, player)) {
        return; // Grab wins — don't process slap hit, grab will connect
      }

      // ── GRAB STARTUP SLAP ARMOR ─────────────────────────────────────
      // Grab loses the timing race against this slap, but it's the defender's
      // FIRST slap during this grab attempt — armor absorbs the hit so the
      // grab can complete its commitment. The defender still pays the slap's
      // normal balance/stamina drain (the armor isn't free), and the slapper's
      // attack proceeds normally (no punish, but no "stuff the grab" reward).
      // Charged attacks bypass armor entirely (handled separately below) —
      // armor ONLY exists for slap. Multi-hit setups still beat grab because
      // armor consumes after one hit.
      if (
        otherPlayer.isGrabStartup &&
        !otherPlayer.grabStartupArmorUsed &&
        !otherPlayer.isRawParrying &&
        !eitherHasSlapParryImmunity
      ) {
        applyGrabStartupArmor(player, otherPlayer, rooms, io);
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
    if (player.isAttacking && otherPlayer.isAttacking) {
      if (otherPlayer.attackType === "charged") {
        // === CHARGED vs CHARGED ===
        // Check thick blubber first — one-sided blubber wins outright
        const playerHasThickBlubber =
          player.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
          !player.hitAbsorptionUsed;
        const otherPlayerHasThickBlubber =
          otherPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
          !otherPlayer.hitAbsorptionUsed;

        if (playerHasThickBlubber && !otherPlayerHasThickBlubber) {
          processHit(player, otherPlayer, rooms, io);
        } else if (otherPlayerHasThickBlubber && !playerHasThickBlubber) {
          processHit(otherPlayer, player, rooms, io);
        } else {
          // Both or neither have thick blubber → charge clash
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

function resolveSlapParry(player1, player2, room, io) {
  // Sim clock — parry triggers hitstop, so its own recovery deadlines must
  // live on the clock that pauses with it.
  const now = simNow(room);
  const knockbackDirection1 = player1.x < player2.x ? -1 : 1;
  const knockbackDirection2 = -knockbackDirection1;

  // Track consecutive parries for escalation
  const lastParryTime = Math.max(player1.lastSlapParryTime || 0, player2.lastSlapParryTime || 0);
  const isConsecutive = (now - lastParryTime) < SLAP_PARRY_CONSECUTIVE_DECAY_MS;
  const consecutiveCount = isConsecutive
    ? Math.min((player1.slapParryConsecutiveCount || 0) + 1, 4)
    : 1;

  [player1, player2].forEach((p) => {
    p.lastSlapParryTime = now;
    p.slapParryConsecutiveCount = consecutiveCount;
  });

  const escalation = 1 + (consecutiveCount - 1) * 0.15;

  // When one player is pinned at the boundary, their knockback has nowhere to go.
  // Compensate by boosting the non-cornered player's knockback so they visually
  // separate instead of overlapping at the wall.
  const BOUNDARY_PROXIMITY = 30;
  const p1NearWall = player1.x <= MAP_LEFT_BOUNDARY + BOUNDARY_PROXIMITY ||
                     player1.x >= MAP_RIGHT_BOUNDARY - BOUNDARY_PROXIMITY;
  const p2NearWall = player2.x <= MAP_LEFT_BOUNDARY + BOUNDARY_PROXIMITY ||
                     player2.x >= MAP_RIGHT_BOUNDARY - BOUNDARY_PROXIMITY;

  let p1KbScale = escalation;
  let p2KbScale = escalation;
  if (p1NearWall && !p2NearWall) {
    p2KbScale *= 1.6;
  } else if (p2NearWall && !p1NearWall) {
    p1KbScale *= 1.6;
  }

  applyParryEffect(player1, knockbackDirection1, p1KbScale);
  applyParryEffect(player2, knockbackDirection2, p2KbScale);

  [player1, player2].forEach((p) => {
    p.isSlapSliding = false;
    p.isSlapParryRecovering = true;

    p.slapStringPosition = 0;
    p.slapStringWindowUntil = 0;
    p.slapWhiffCount = 0;
    p.isSlapWhiffPausing = false;
    p.pendingSlapCount = 0;

    if (p.slapCycleEndCallback) {
      timeoutManager.clearPlayerSpecific(p.id, "slapCycle");
      p.attackCooldownUntil = now + SLAP_PARRY_RECOVERY_MS;
      setPlayerTimeout(p.id, () => {
        p.isAttacking = false;
        p.isSlapAttack = false;
        p.attackType = null;
        p.isSlapSliding = false;
        p.slapFacingDirection = null;
        p.isInStartupFrames = false;
        p.slapActiveEndTime = 0;
        p.currentAction = null;
        p.slapCycleEndCallback = null;
        p.isSlapParryRecovering = false;
      }, SLAP_PARRY_RECOVERY_MS, "slapCycle");
    }
  });

  // Hitstop — brief freeze sells the clash impact. Kept FLAT (not escalated): a
  // longer freeze on consecutive clashes used to make a mash-war progressively
  // slower, which is exactly the "molasses" feel we're removing. Escalation now
  // only drives visual juice (knockback pop + screen shake + VFX intensity), so
  // repeated clashes feel BIGGER without the cadence ever slowing down.
  triggerHitstopAndEmit(io, room, SLAP_PARRY_HITSTOP_MS, "slap_parry");

  // Screen shake — crisp rattle, NO zoom (slap_parry profile), scales a touch
  // with consecutive clashes so a mash-war feels bigger without zoom-pumping.
  emitThrottledScreenShake(room, io, {
    type: "slap_parry",
    scale: Math.min(1 + (consecutiveCount - 1) * 0.12, 1.45),
  });

  const midpointX = (player1.x + player2.x) / 2;
  const midpointY = (player1.y + player2.y) / 2;
  io.in(room.id).emit("slap_parry", {
    x: midpointX,
    y: midpointY,
    intensity: escalation,
    consecutiveCount,
    p1x: player1.x,
    p2x: player2.x,
  });
}

function applyParryEffect(player, knockbackDirection, escalation) {
  player.slapParryKnockbackVelocity = SLAP_PARRY_KNOCKBACK_STRENGTH * knockbackDirection * escalation;

  player.slapParryImmunityUntil = simNowForPlayer(player) + SLAP_PARRY_RECOVERY_MS + SLAP_PARRY_WINDOW;
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

    if (p.keys && p.keys.mouse1) {
      p.mouse1HeldDuringAttack = true;
      if (!p.mouse1PressTime) p.mouse1PressTime = simNowForPlayer(p);
    }
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

// ─── GRAB STARTUP SLAP ARMOR ───────────────────────────────────────────
// Single-use absorption that lets a committed grab eat one neutral slap and
// continue its startup. The grabber pays the slap's normal balance + stamina
// drain, so mashing slap into grab still chips the grabber's resources — it
// just doesn't stuff the grab outright. Multi-hit setups (slap chains, charged
// follow-ups) still beat grab because armor is consumed after one hit.
//
// CRITICAL: armor also extends the remaining grab startup by a stagger window.
// Without that, a single slap absorbs and the grab still connects on schedule —
// since slap chain cycle (~195ms) is longer than the 180ms base startup, the
// slapper can't fit a second slap inside the grab window, so armor becomes
// mathematically unbeatable by slaps. The stagger opens a real "chain to break
// armor" window and gives the slapper a beat to cancel into something else.
function applyGrabStartupArmor(attacker, defender, rooms, io) {
  defender.grabStartupArmorUsed = true;

  // Stagger: extend grab startup so a chained slap (or sidestep / parry) can
  // actually catch the grabber. This is the main fix for "armor too strong" —
  // without it, single slaps were a free chip-and-lose interaction for the slapper.
  defender.grabStartupDuration = (defender.grabStartupDuration || 0) + GRAB_STARTUP_ARMOR_STAGGER_MS;
  defender.actionLockUntil = (defender.actionLockUntil || 0) + GRAB_STARTUP_ARMOR_STAGGER_MS;

  // Defender pays the slap's normal balance + stamina drain — armor isn't free.
  defender.balance = Math.max(0, defender.balance - BALANCE_SLAP_HIT_DRAIN);
  defender.stamina = Math.max(0, defender.stamina - SLAP_HIT_VICTIM_STAMINA_DRAIN);

  // End the attacker's slap so it doesn't re-collide on subsequent ticks.
  // executeSlapAttack's recovery timeout will still fire and clean up cleanly
  // (clearing already-cleared state is a no-op). Slap player still goes through
  // their normal recovery window — they aren't punished for the hit attempt.
  attacker.isAttacking = false;
  attacker.attackStartTime = 0;
  attacker.attackEndTime = 0;

  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === attacker.id)
  );
  if (currentRoom) {
    io.in(currentRoom.id).emit("grab_armor_absorb", {
      defenderId: defender.id,
      attackerId: attacker.id,
      x: defender.x,
      y: defender.y,
      facing: defender.facing,
      armorId: `armor-absorb-${Date.now()}-${defender.id}`,
    });
  }
}

function processHit(player, otherPlayer, rooms, io) {
  // Find the current room
  const currentRoom = rooms.find((room) =>
    room.players.some((p) => p.id === player.id)
  );

  // Sim clock — every combat timestamp written here (lastHitTime, counter-hit
  // windows, burst knockback) lives on the room's pausable clock so it freezes
  // in lockstep with the hitstop this hit is about to trigger.
  const currentTime = simNow(currentRoom);

  // Use the stored attack type instead of checking isSlapAttack
  const isSlapAttack = player.attackType === "slap";

  // ── ARMOR BREAK VFX ───────────────────────────────────────────────
  // Charged attack landing during a grab attempt's startup is the canonical
  // "armor break" — slap armor exists, charged shatters it. This is a visual
  // annotation of the existing rock-paper-scissors (charged > grab); the hit
  // proceeds normally below. Skip if thick blubber will absorb the hit anyway,
  // or if the defender is raw parrying (parry plays its own VFX).
  if (
    !isSlapAttack &&
    otherPlayer.isGrabStartup &&
    !otherPlayer.isRawParrying &&
    !(
      otherPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
      !otherPlayer.hitAbsorptionUsed
    )
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
  const counterHitFromIntent = timeSinceAttackIntent <= COUNTER_HIT_WINDOW_MS;
  // Charged shattering grab armor has its own VFX (grab_armor_break) — don't
  // also fire the counter-hit banner/effect, it doubles up visually. Slap
  // stuffing grab (after armor consumed) IS still a counter hit — that's a
  // skilled chain breaking commitment, and the boost reads correctly there.
  const isChargedArmorBreak = !isSlapAttack &&
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
    || (otherPlayer.isRopeJumping && otherPlayer.ropeJumpPhase === "landing")
    || otherPlayer.isSidestepRecovery;

  // Counter hit and punish are conceptually mutually exclusive: counter = startup
  // read, punish = recovery exposure. If the victim is in a recovery phase (e.g.
  // sidestep recovery), it's a punish — even if they had a recent attack-intent
  // press (e.g. buffering an attack out of recovery), which would otherwise
  // incorrectly stack a counter-hit bonus on top of the punish bonus.
  const isCounterHit = counterHitRaw && !isPunish;

  // ── SLAP STRING COUNTER/PUNISH LATCH ────────────────────────────────────
  // A slap string that STARTS on a counter or punish keeps that hit-effect
  // styling (VFX + layered sound) for every following hit of the same string.
  // After hit 1 the victim is in hitstun, so hits 2 & 3 can never re-detect a
  // counter/punish on their own — without this latch they'd render as plain
  // hits even though the whole string was earned off a hard read.
  //
  // Visual/audio only: the knockback + hit-stun bonuses below still key off the
  // genuine per-hit isCounterHit/isPunish, so combo damage and balance are
  // unchanged — only the presentation carries through.
  if (isSlapAttack) {
    const slapStringPos = player.slapStringPosition || 0;
    if (slapStringPos <= 1) {
      // First hit of a (new) string — latch reflects this hit's real read.
      player.slapStringCounterLatched = isCounterHit;
      player.slapStringPunishLatched = isPunish;
    } else {
      // Continuation — preserve the latch (OR-in any genuine fresh read).
      player.slapStringCounterLatched = player.slapStringCounterLatched || isCounterHit;
      player.slapStringPunishLatched = player.slapStringPunishLatched || isPunish;
    }
  }
  const effectiveCounterHit = isSlapAttack
    ? !!player.slapStringCounterLatched
    : isCounterHit;
  const effectivePunish = isSlapAttack
    ? !!player.slapStringPunishLatched
    : isPunish;

  // Store the charge power before resetting states
  const chargePercentage = player.chargeAttackPower;

  // Check for thick blubber hit absorption (only if defender is executing charged attack or grab and hasn't used absorption)
  const isDefenderGrabbing = otherPlayer.isGrabStartup || otherPlayer.isGrabbingMovement || otherPlayer.isGrabbing;
  if (
    otherPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
    ((otherPlayer.isAttacking && otherPlayer.attackType === "charged") || isDefenderGrabbing) &&
    !otherPlayer.hitAbsorptionUsed &&
    !otherPlayer.isRawParrying
  ) {
    // Raw parry should still work normally

    // Mark absorption as used for this charge session
    otherPlayer.hitAbsorptionUsed = true;

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
      
      // Track if mouse1 is held — enables charge resume after recovery without re-press
      if (player.keys.mouse1) {
        player.mouse1HeldDuringAttack = true;
        if (!player.mouse1PressTime) {
          player.mouse1PressTime = currentTime;
        }
      }
      
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

    // Emit a special effect or sound for absorption if needed
    if (currentRoom) {
      io.in(currentRoom.id).emit("thick_blubber_absorption", {
        playerId: otherPlayer.id,
        x: otherPlayer.x,
        y: otherPlayer.y,
      });
    }

    // Early return - no further hit processing for the defender
    return;
  }

  // For charged attacks, end the attack immediately on hit
  if (!isSlapAttack) {
    // Set hit tracking flag for charged attacks
    player.chargedAttackHit = true;

    // Reset all attack states first
    player.isAttacking = false;
    player.attackStartTime = 0;
    player.attackEndTime = 0;
    player.chargingFacingDirection = null;
    player.isChargingAttack = false;
    player.chargeStartTime = 0;
    player.chargeAttackPower = 0;

    // Track if mouse1 is held — enables charge resume after recovery without re-press
    if (player.keys.mouse1) {
      player.mouse1HeldDuringAttack = true;
      // Ensure press time is tracked (may already be set from re-press during animation)
      if (!player.mouse1PressTime) {
        player.mouse1PressTime = currentTime;
      }
    }

    // Set recovery state for successful hits
    player.isRecovering = true;
    player.recoveryStartTime = currentTime;
    player.recoveryDuration = 400;
    player.recoveryDirection = player.facing;
    // Initialize knockback velocity in the opposite direction of the attack
    player.knockbackVelocity = {
      x: player.facing * -2, // Static knockback amount
      y: 0,
    };
  }
  // For slap attacks: no special handling - executeSlapAttack timeout handles everything

  // Check if the other player is blocking (crouching)
  if (otherPlayer.isRawParrying) {
    // Determine if this is a slap attack being parried
    const isSlapBeingParried = player.attackType === "slap" || isSlapAttack;

    // Check if this is a perfect parry (within 100ms of parry start)
    // Sim clock — rawParryStartTime is written on the sim clock too.
    const currentTime = simNowForPlayer(otherPlayer);
    const parryDuration = currentTime - otherPlayer.rawParryStartTime;
    const isPerfectParry = parryDuration <= PERFECT_PARRY_WINDOW;

    // Apply appropriate knockback based on attack type
    const knockbackAmount = isSlapBeingParried
      ? RAW_PARRY_SLAP_KNOCKBACK
      : RAW_PARRY_KNOCKBACK;

    // Apply knockback to the attacking player
    // Calculate knockback direction based on relative positions to ensure attacker is always pushed away from defender
    const knockbackDirection = player.x < otherPlayer.x ? -1 : 1;
    
    // CRITICAL: Clear ALL action states before setting isHit
    clearAllActionStates(player);
    player.y = GROUND_LEVEL;
    
    player.knockbackVelocity.x = knockbackAmount * knockbackDirection;
    player.knockbackVelocity.y = 0;
    player.isHit = true;
    player.isParryKnockback = true;
    player.lastHitTime = currentTime; // Track hit time for safety mechanism

    // Side-switch fix: set parried player's facing to face the parrier immediately so is_perfect_parried
    // (and parry stun) plays the correct direction from frame one. When the parrier dodged through and
    // is "inside" them, the main loop only updates the non-hit player's facing so the parried player
    // would otherwise correct later and the animation would flip. Use "face parrier" (not face knockback)
    // so it's correct both when sides switched and when they didn't.
    if (!player.isAtTheRopes && !player.atTheRopesFacingDirection) {
      player.facing = player.x < otherPlayer.x ? -1 : 1; // Face the parrier (right = -1, left = 1)
    }

    // Set parry success state for the defending player
    // Both regular and perfect parries refund the flat parry cost
    otherPlayer.stamina = Math.min(100, otherPlayer.stamina + RAW_PARRY_STAMINA_REFUND);

    // Perfect parries also refund a chunk of balance — net defensive gain on a correct read
    let perfectParryBalanceGain = 0;
    if (isPerfectParry) {
      const balanceBefore = otherPlayer.balance;
      otherPlayer.balance = Math.min(BALANCE_MAX, otherPlayer.balance + PERFECT_PARRY_BALANCE_REFUND);
      perfectParryBalanceGain = otherPlayer.balance - balanceBefore;
    }

    if (isPerfectParry) {
      // Perfect parry: keep isRawParrying active and lock movement
      otherPlayer.isRawParrying = true;
      otherPlayer.isPerfectRawParrySuccess = true;
      otherPlayer.inputLockUntil = Math.max(otherPlayer.inputLockUntil || 0, currentTime + PERFECT_PARRY_ANIMATION_LOCK);
    } else {
      // Regular parry: neutral advantage — parrier can reposition but can't attack freely.
      // 350ms lock vs 400ms attacker isHit = 50ms advantage (not enough for guaranteed follow-up)
      otherPlayer.isRawParrySuccess = true;
      otherPlayer.rawParryMinDurationMet = true;
      otherPlayer.inputLockUntil = Math.max(otherPlayer.inputLockUntil || 0, currentTime + 350);
    }

    // Emit raw parry success event for visual effect
    // Send both players' positions so client can calculate center (like grab break)
    // Determine which player number (1 or 2) performed the parry
    const parryingPlayerNumber = currentRoom ? 
      (currentRoom.players.findIndex(p => p.id === otherPlayer.id) + 1) : 1;
    const parryData = {
      attackerX: player.x,
      parrierX: otherPlayer.x,
      facing: player.facing,
      isPerfect: isPerfectParry,
      timestamp: Date.now(),
      parryId: `${otherPlayer.id}_parry_${Date.now()}`,
      playerNumber: parryingPlayerNumber, // 1 or 2
      parrierId: otherPlayer.id,
      balanceGain: perfectParryBalanceGain, // 0 for non-perfect; drives client balance gain anim
    };
    if (currentRoom) {
      io.to(currentRoom.id).emit("raw_parry_success", parryData);
    }

    // Clear parry success state after duration
    if (isPerfectParry) {
      // For perfect parry: clear the parry pose after animation lock duration
      setPlayerTimeout(
        otherPlayer.id,
        () => {
          otherPlayer.isRawParrying = false;
          otherPlayer.isPerfectRawParrySuccess = false;
          otherPlayer.rawParryCooldownUntil = simNowForPlayer(otherPlayer) + RAW_PARRY_COOLDOWN_MS;
        },
        PERFECT_PARRY_ANIMATION_LOCK,
        "perfectParryAnimationEnd"
      );
    } else {
      // For regular parry: clear success state after normal duration
      setPlayerTimeout(
        otherPlayer.id,
        () => {
          otherPlayer.isRawParrySuccess = false;
        },
        PARRY_SUCCESS_DURATION,
        "parrySuccess"
      );
    }

    // Knockback duration: 400ms of sim time. The sim clock (and this timer)
    // pause during the parry hitstop, so the full slide window survives the
    // freeze with no manual +hitstop compensation.
    setPlayerTimeout(
      player.id,
      () => {
        player.isHit = false;
        player.isAlreadyHit = false;
        player.isParryKnockback = false;
      },
      400,
      "parryKnockbackReset"
    );

    // Brief post-freeze input lock (sim clock — freeze itself doesn't consume it)
    player.inputLockUntil = Math.max(player.inputLockUntil || 0, currentTime + 100);

    // Apply stun for perfect parries (separate from knockback)
    if (isPerfectParry) {
      // Perfect parries stun the attacker for 1.1s (fixed duration, no mash reduction)
      const baseStunDuration = PERFECT_PARRY_ATTACKER_STUN_DURATION;
      player.isRawParryStun = true;
      
      // Apply stronger knockback velocity for perfect parry (causes sliding on ice)
      const pushDirection = player.x < otherPlayer.x ? -1 : 1;

      // When overlapping (e.g. dodge cancel inside opponent), boost knockback velocity
      // to compensate for the overlap distance. This keeps the slide smooth (no teleport)
      // while ensuring the stunned player always ends up at the same final distance from
      // the parrier regardless of how deep the overlap was.
      // ~110px of displacement per 1.0 velocity unit over the 400ms knockback window
      // (derived from 64Hz tick, 0.185 speedFactor, 0.985 friction, 0.8x mvVel transfer)
      const ppDistance = Math.abs(player.x - otherPlayer.x);
      const ppMinSep = HITBOX_DISTANCE_VALUE * 2 * Math.max(player.sizeMultiplier || 1, otherPlayer.sizeMultiplier || 1);
      const overlapAmount = Math.max(0, ppMinSep - ppDistance);
      const overlapCompensation = overlapAmount / 110;

      player.knockbackVelocity.x = (PERFECT_PARRY_KNOCKBACK + overlapCompensation) * pushDirection;
      player.knockbackVelocity.y = 0;
      
      // Track stun start time (sim clock)
      player.perfectParryStunStartTime = currentTime;
      
      // Clear any previous perfect parry stun timeout
      if (player.perfectParryStunBaseTimeout) {
        timeoutManager.clearPlayerSpecific(player.id, "perfectParryStunReset");
      }

      // Perfect-parry screen shake is driven client-side by useCamera's
      // "perfect_parry" listener (addShake("perfect_parry")) so the heavy
      // trauma+zoom+roll fires exactly with the freeze and can't be dropped by
      // the shake throttle.
      if (currentRoom) {

        triggerHitstopAndEmit(io, currentRoom, HITSTOP_PERFECT_PARRY_MS, "perfect_parry");

        // Emit perfect parry event
        io.in(currentRoom.id).emit("perfect_parry", {
          parryingPlayerId: otherPlayer.id,
          attackingPlayerId: player.id,
          stunnedPlayerX: player.x,
          stunnedPlayerY: player.y,
          stunnedPlayerFighter: player.fighter, // Add fighter info to help with positioning
          showStarStunEffect: true, // Explicit flag for the star stun effect
          balanceGain: perfectParryBalanceGain, // Drives balance bar gain animation on client
        });
      }

      // Stun duration on the sim clock — the timer pauses through the
      // perfect-parry freeze, so the full stun window is available for
      // follow-up attacks post-freeze without manual +hitstop compensation.
      setPlayerTimeout(
        player.id,
        () => {
          player.isRawParryStun = false;
          player.perfectParryStunStartTime = 0;
          player.perfectParryStunBaseTimeout = null;
        },
        baseStunDuration,
        "perfectParryStunReset"
      );
      
      // Store that we have an active stun timeout
      player.perfectParryStunBaseTimeout = true;
    } else {
      // Regular parry - lighter rattle, no zoom (parry profile)
      if (currentRoom) {
        emitThrottledScreenShake(currentRoom, io, { type: "parry" });
        // Hitstop on parry
        triggerHitstopAndEmit(io, currentRoom, HITSTOP_PARRY_MS, "parry");
      }
      // If movement ended or was interrupted without grabbing, clear telegraph
      if (
        !player.isGrabbingMovement &&
        !player.isGrabbing &&
        !player.isGrabClashing
      ) {
        player.grabState = GRAB_STATES.INITIAL;
        player.grabAttemptType = null;
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
    otherPlayer.lastHitType = isSlapAttack ? "slap" : "charged";

    // Block multiple hits from this same attack
    otherPlayer.isAlreadyHit = true;

    // Increment hit counter for reliable hit sound triggering
    otherPlayer.hitCounter = (otherPlayer.hitCounter || 0) + 1;

    // Drain victim's stamina on hit (victim loses more than attacker spent)
    if (isSlapAttack) {
      otherPlayer.stamina = Math.max(0, otherPlayer.stamina - SLAP_HIT_VICTIM_STAMINA_DRAIN);
      otherPlayer.balance = Math.max(0, otherPlayer.balance - BALANCE_SLAP_HIT_DRAIN);
    } else {
      otherPlayer.stamina = Math.max(0, otherPlayer.stamina - CHARGED_HIT_VICTIM_STAMINA_DRAIN);
      otherPlayer.balance = Math.max(0, otherPlayer.balance - BALANCE_CHARGED_HIT_DRAIN);
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
    if (isSlapAttack) {
    } else {
    }

    // Calculate knockback multiplier based on attack type and string position
    // String hits 1&2: fixed velocity (not multiplier-based). Hit 3 and solo slaps use multiplier.
    let finalKnockbackMultiplier;
    if (isSlapAttack) {
      finalKnockbackMultiplier = SLAP_NEUTRAL_KB_MULTIPLIER;
    } else {
      finalKnockbackMultiplier = 0.45 + Math.pow(chargePercentage / 100, 1.3) * 0.75;
    }

    if (isCounterHit) {
      finalKnockbackMultiplier *= 1.25;
    }

    // Armor-break punch: charged shattering grab armor isn't tagged as a
    // counter hit (separate VFX), but it should still hit harder than a
    // neutral charged confirm — the grabber committed hard and ate the read.
    if (isChargedArmorBreak) {
      finalKnockbackMultiplier *= 1.4;
    }

    if (isPunish) {
      finalKnockbackMultiplier *= 1.25;
    }

    if (otherPlayer.isCrouchStance) {
      finalKnockbackMultiplier *= 0.9;
    }

    if (player.activePowerUp === POWER_UP_TYPES.POWER) {
      if (isSlapAttack) {
        finalKnockbackMultiplier *= player.powerUpMultiplier * 0.923;
      } else {
        finalKnockbackMultiplier *= player.powerUpMultiplier;
      }
    }

    let isCinematicKill = false;
    const knockbackAllowed = canApplyKnockback(otherPlayer);

    if (knockbackAllowed || isSlapAttack) {
      if (isSlapAttack) {
        const stringPos = player.slapStringPosition || 0;
        const pushDirection = player.facing === 1 ? -1 : 1;

        // HIT-CONFIRM (unconditional): a slap that connects is a confirmed hit
        // even while the victim is knockback-immune. These flags (and the
        // VFX/hitstop below) must NOT sit behind canApplyKnockback: when slap1
        // connects LATE in its active window, the 150ms immunity it grants
        // still covers slap2's connect moment — gating the confirm there made
        // slap2 land as a silent "phantom hit" (victim stunned, but no VFX,
        // no hitstop, string reset as if it whiffed → the "5-slap" bug).
        player.movementVelocity = pushDirection * SLAP_ONHIT_ATTACKER_PUSH;
        player.isSlapSliding = true;
        player.lastSlapHitLandedTime = currentTime;
        player.currentSlapHitConnected = true;

        if (knockbackAllowed) {
          otherPlayer.isSlapKnockback = true;

          // ROPE RESISTANCE GATE (per-hit): this slap may only push the victim
          // OUT of the ring if the hit landed while they were already within
          // SLAP_KILL_RANGE of the boundary they're being knocked toward.
          // Otherwise the rope catches them (clamped at the edge in the isHit
          // movement block). Measured at connect time using the knockback
          // direction so it's the same intuition for slap1/2/3.
          const distanceToBoundaryInKbDir = knockbackDirection > 0
            ? MAP_RIGHT_BOUNDARY - otherPlayer.x
            : otherPlayer.x - MAP_LEFT_BOUNDARY;
          otherPlayer.slapKnockbackCanRingOut =
            distanceToBoundaryInKbDir <= SLAP_KILL_RANGE;

          if (stringPos === 3) {
            // STRING HIT 3: physics-based knockback — velocity impulse, no DI
            otherPlayer.isBurstKnockback = true;
            otherPlayer.burstKnockbackStartTime = currentTime;
            otherPlayer.knockbackVelocity.x = knockbackDirection * SLAP_HIT3_KB_VELOCITY;
            otherPlayer.movementVelocity = 0;
          } else {
            // STRING HITS 1 & 2 (and pos-0 fallback): cinematic combo push —
            // both players slide forward together. Victim drifts via
            // knockbackVelocity (active during isHit), attacker drifts via
            // movementVelocity (ice physics). Same speed = locked pair.
            otherPlayer.knockbackVelocity.x = pushDirection * SLAP_ONHIT_ATTACKER_PUSH;
          }
        }

      } else {
        otherPlayer.isSlapKnockback = false;
        otherPlayer.slapKnockbackCanRingOut = false;
        otherPlayer.knockbackVelocity.x = 0;
        otherPlayer.movementVelocity = 0;

        isCinematicKill =
          finalKnockbackMultiplier >= CINEMATIC_KILL_MIN_MULTIPLIER &&
          willGuaranteeRingOut(otherPlayer.x, knockbackDirection, finalKnockbackMultiplier);

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
        otherPlayer.knockbackVelocity.x =
          2.7 * knockbackDirection * finalKnockbackMultiplier * kbBoost;
        otherPlayer.movementVelocity = 0;

        const attackerBounceDirection = -knockbackDirection;
        const attackerBounceMultiplier = 0.3 + (chargePercentage / 100) * 0.5;
        if (isCinematicKill) {
          player.movementVelocity = 0;
        } else {
          player.movementVelocity =
            2 * attackerBounceDirection * attackerBounceMultiplier;
        }
        player.knockbackVelocity = { x: 0, y: 0 };
      }

      if (!isSlapAttack) {
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
        io.in(currentRoom.id).emit("player_hit", {
          x: otherPlayer.x,
          y: otherPlayer.y,
          facing: otherPlayer.facing,
          attackType: isSlapAttack ? "slap" : "charged",
          stringPos: isSlapAttack ? (player.slapStringPosition || 0) : 0,
          // Drives the client charged-hit shake scaling (heavier charge = bigger crunch).
          chargePercentage: isSlapAttack ? 0 : chargePercentage,
          timestamp: Date.now(),
          hitId: Math.random().toString(36).substr(2, 9),
          // Latched for slap strings so hits 2 & 3 keep the counter/punish
          // styling of the read that started the string (see latch above).
          isCounterHit: effectiveCounterHit,
          isPunish: effectivePunish,
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
          isPowered: player.activePowerUp === POWER_UP_TYPES.POWER,
          // attackerId lets the client trigger an attacker-side hit-confirm flash
          // on the attacker's sprite only — distinct from the victim's hit VFX.
          // Without this the attacker has no proprioceptive cue that they "landed it",
          // which is the AAA-feel detail every premium fighting game has.
          attackerId: player.id,
          victimId: otherPlayer.id,
        });

        // Emit counter hit banner event (separate from hit effect for side banner display)
        if (isCounterHit) {
          // Determine which player number hit the counter (for side banner positioning)
          const attackerPlayerNumber = currentRoom.players.findIndex(p => p.id === player.id) + 1;
          io.in(currentRoom.id).emit("counter_hit", {
            x: otherPlayer.x,
            y: otherPlayer.y,
            playerNumber: attackerPlayerNumber,
            counterId: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
          });
        }

        // Punish: only side text (no hit effect) when hitting opponent during recovery
        if (isPunish) {
          const attackerPlayerNumber = currentRoom.players.findIndex(p => p.id === player.id) + 1;
          io.in(currentRoom.id).emit("punish_banner", {
            grabberPlayerNumber: attackerPlayerNumber,
            counterId: `punish-hit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          });
        }
        
        // ============================================
        // SMASH-STYLE HITSTOP & SCREEN SHAKE
        // Every hit has impact - both hitstop AND screen shake
        // Slaps: snappy, punchy feel
        // Charged: heavy, powerful feel scaling with charge
        // ============================================
        if (isSlapAttack) {
          // Hitstop scales with string position: snappy lights (1 & 2), heavy finisher (3).
          // Solo/pos-0 is a defensive fallback — in practice every active slap is pos 1-3.
          const slapPos = player.slapStringPosition || 0;
          const isBurstHitLocal = slapPos === 3;
          const isChainableStringHit = slapPos === 1 || slapPos === 2;
          const slapHitstopMs = isBurstHitLocal
            ? HITSTOP_SLAP_HIT3_MS
            : isChainableStringHit
              ? HITSTOP_SLAP_STRING_MS
              : HITSTOP_SLAP_MS;
          triggerHitstopAndEmit(io, currentRoom, slapHitstopMs, isBurstHitLocal ? "slap_burst" : "slap");

          // === ATTACKER-FAVORED HITSTOP RELIEF (chainable hits only) ===
          // The sim clock pauses during hitstop, so the attacker's cycle and the
          // victim's stun freeze together automatically — no compensation needed.
          // On hits 1 & 2 we additionally pull the ATTACKER's pending deadlines
          // EARLIER by `relief` ms, so they un-freeze slightly ahead of the victim
          // → snappier, more aggressive chain (and a tighter, but still-present,
          // escape window). Same net frame math as the old wall-clock compensation.
          const attackerRelief = isChainableStringHit ? SLAP_STRING_ATTACKER_HITSTOP_RELIEF_MS : 0;
          if (attackerRelief > 0 && player.slapCycleEndCallback) {
            player.attackEndTime = Math.max(currentTime, player.attackEndTime - attackerRelief);
            if (player.slapActiveEndTime) {
              player.slapActiveEndTime = Math.max(currentTime, player.slapActiveEndTime - attackerRelief);
            }
            player.attackCooldownUntil = Math.max(currentTime, player.attackCooldownUntil - attackerRelief);
            timeoutManager.advanceNamed(player.id, "slapCycle", attackerRelief);
          }

          // Screen shake is handled client-side by useCamera (driven by hitCounter +
          // knockback magnitude) — no need to double-shake from the server here.
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
    // String hits 1 & 2: 260ms stun vs the attacker's 195ms base cycle = ~65ms of guaranteed
    //   advantage, which is what makes the chain a true combo. All slaps share 55ms startup;
    //   the gap that lets a defender contest comes from the cycle/stun delta, not startup.
    //   (Hitstop is added symmetrically to both, so it cancels out of this guarantee.)
    // Hit 3: SLAP_HIT3_STUN_MS (burst finisher).
    const stringPos = isSlapAttack ? (player.slapStringPosition || 0) : 0;
    let hitStateDuration;
    if (isSlapAttack) {
      hitStateDuration = SLAP_STRING_HIT_STUN_MS;
    } else {
      hitStateDuration = 380;
    }
    if (isCinematicKill) {
      hitStateDuration = 3000;
    } else if (isCounterHit) {
      hitStateDuration = Math.round(hitStateDuration * 1.4);
    }
    if (isPunish && !isCinematicKill) {
      hitStateDuration = Math.round(hitStateDuration * 1.4);
    }

    // No hitstop extension needed: the stun timer below runs on the sim clock,
    // which freezes during hitstop — victim stun and attacker cycle pause in
    // perfect lockstep, so the true-combo margin is frame-exact by construction.

    // Update the last hit time for tracking
    otherPlayer.lastHitTime = currentTime;
    otherPlayer.lastHitByStringPos = stringPos;

    const isBurstHit = isSlapAttack && stringPos === 3;
    const stunDuration = isBurstHit ? SLAP_HIT3_STUN_MS : hitStateDuration;

    setPlayerTimeout(
      otherPlayer.id,
      () => {
        if (isBurstHit) {
          if (Math.abs(otherPlayer.knockbackVelocity.x) > 0.01) {
            otherPlayer.movementVelocity = otherPlayer.knockbackVelocity.x;
          }
        } else if (Math.abs(otherPlayer.knockbackVelocity.x) > 0.01) {
          otherPlayer.movementVelocity = otherPlayer.knockbackVelocity.x;
        }
        otherPlayer.knockbackVelocity.x = 0;
        otherPlayer.isHit = false;
        otherPlayer.isSlapKnockback = false;
        otherPlayer.slapKnockbackCanRingOut = false;
        otherPlayer.isBurstKnockback = false;
        otherPlayer.burstKnockbackStartTime = 0;

        const isStringHit = isSlapAttack && (stringPos === 1 || stringPos === 2);
        if (isSlapAttack && SLAP_CHAIN_HIT_GAP_MS > 0 && !isStringHit) {
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

    // Input lockout - slaps have moderate lock so hit animation is visible
    // (sim clock — locks freeze through hitstop instead of being eaten by it)
    const victimLockMs = isSlapAttack ? 180 : hitStateDuration;
    // Attacker: brief lock for slaps creates commitment to each strike (rekka feel)
    const attackerLockMs = isSlapAttack ? 50 : 200;
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

    // Encourage clearer turn-taking: set wantsToRestartCharge only on intentional hold
    if (player.keys && player.keys.mouse1) {
      player.wantsToRestartCharge = true;
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
  const currentTime = simNowForPlayer(opponent);
  const parryDuration = currentTime - opponent.rawParryStartTime;
  const isPerfectParry = parryDuration <= PERFECT_PARRY_WINDOW;

  // End the flapper's flight and ground them (the parry beats the slam). The
  // connect can only happen within FLAP_BODYSLAM_CONTACT_HEIGHT of the ground,
  // so this snap is small.
  clearAllActionStates(flapper);
  flapper.y = GROUND_LEVEL;

  const knockbackDirection = flapper.x < opponent.x ? -1 : 1;
  flapper.knockbackVelocity.x = RAW_PARRY_KNOCKBACK * knockbackDirection;
  flapper.knockbackVelocity.y = 0;
  flapper.isHit = true;
  flapper.isParryKnockback = true;
  flapper.lastHitTime = currentTime;
  if (!flapper.isAtTheRopes && !flapper.atTheRopesFacingDirection) {
    flapper.facing = flapper.x < opponent.x ? -1 : 1;
  }

  // Defender rewards — refund parry cost (+ balance on a perfect read).
  opponent.stamina = Math.min(100, opponent.stamina + RAW_PARRY_STAMINA_REFUND);
  let perfectParryBalanceGain = 0;
  if (isPerfectParry) {
    const balanceBefore = opponent.balance;
    opponent.balance = Math.min(BALANCE_MAX, opponent.balance + PERFECT_PARRY_BALANCE_REFUND);
    perfectParryBalanceGain = opponent.balance - balanceBefore;
  }

  if (isPerfectParry) {
    opponent.isRawParrying = true;
    opponent.isPerfectRawParrySuccess = true;
    opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, currentTime + PERFECT_PARRY_ANIMATION_LOCK);
  } else {
    opponent.isRawParrySuccess = true;
    opponent.rawParryMinDurationMet = true;
    opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, currentTime + 350);
  }

  const parryingPlayerNumber = currentRoom
    ? currentRoom.players.findIndex((p) => p.id === opponent.id) + 1
    : 1;
  if (currentRoom) {
    io.to(currentRoom.id).emit("raw_parry_success", {
      attackerX: flapper.x,
      parrierX: opponent.x,
      facing: flapper.facing,
      isPerfect: isPerfectParry,
      timestamp: Date.now(),
      parryId: `${opponent.id}_parry_${Date.now()}`,
      playerNumber: parryingPlayerNumber,
      parrierId: opponent.id,
      balanceGain: perfectParryBalanceGain,
    });
  }

  if (isPerfectParry) {
    setPlayerTimeout(
      opponent.id,
      () => {
        opponent.isRawParrying = false;
        opponent.isPerfectRawParrySuccess = false;
        opponent.rawParryCooldownUntil = simNowForPlayer(opponent) + RAW_PARRY_COOLDOWN_MS;
      },
      PERFECT_PARRY_ANIMATION_LOCK,
      "perfectParryAnimationEnd"
    );
  } else {
    setPlayerTimeout(
      opponent.id,
      () => {
        opponent.isRawParrySuccess = false;
      },
      PARRY_SUCCESS_DURATION,
      "parrySuccess"
    );
  }

  // Reset the flapper's knockback/hit state after the slide window.
  setPlayerTimeout(
    flapper.id,
    () => {
      flapper.isHit = false;
      flapper.isAlreadyHit = false;
      flapper.isParryKnockback = false;
    },
    400,
    "parryKnockbackReset"
  );
  flapper.inputLockUntil = Math.max(flapper.inputLockUntil || 0, currentTime + 100);

  if (isPerfectParry) {
    // Perfect parry stuns the flapper (the big punish), like a strike.
    flapper.isRawParryStun = true;
    const pushDirection = flapper.x < opponent.x ? -1 : 1;
    flapper.knockbackVelocity.x = PERFECT_PARRY_KNOCKBACK * pushDirection;
    flapper.knockbackVelocity.y = 0;
    flapper.perfectParryStunStartTime = currentTime;
    if (flapper.perfectParryStunBaseTimeout) {
      timeoutManager.clearPlayerSpecific(flapper.id, "perfectParryStunReset");
    }
    if (currentRoom) {
      triggerHitstopAndEmit(io, currentRoom, HITSTOP_PERFECT_PARRY_MS, "perfect_parry");
      io.in(currentRoom.id).emit("perfect_parry", {
        parryingPlayerId: opponent.id,
        attackingPlayerId: flapper.id,
        stunnedPlayerX: flapper.x,
        stunnedPlayerY: flapper.y,
        stunnedPlayerFighter: flapper.fighter,
        showStarStunEffect: true,
        balanceGain: perfectParryBalanceGain,
      });
    }
    setPlayerTimeout(
      flapper.id,
      () => {
        flapper.isRawParryStun = false;
        flapper.perfectParryStunStartTime = 0;
        flapper.perfectParryStunBaseTimeout = null;
      },
      PERFECT_PARRY_ATTACKER_STUN_DURATION,
      "perfectParryStunReset"
    );
    flapper.perfectParryStunBaseTimeout = true;
  } else if (currentRoom) {
    emitThrottledScreenShake(currentRoom, io, { type: "parry" });
    triggerHitstopAndEmit(io, currentRoom, HITSTOP_PARRY_MS, "parry");
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

  // Connecting ENDS the flight. The flapper can't keep flying after a slam —
  // they're auto-grounded into a recovery that's synced to the victim's stun
  // (set below) so the slam grants NO frame advantage. The smooth descent +
  // small pushback is tweened in the game loop's "landing" branch.
  flapper.flapHitLanded = true;
  flapper.flapPhase = "landing";
  flapper.flapVelocityY = 0;
  flapper.flapVelocityX = 0;
  flapper.flapLandingTime = currentTime;
  flapper.flapHitLandStartY = flapper.y;
  flapper.flapHitLandStartX = flapper.x;
  // Push the flapper back AWAY from the opponent a touch (non-hit recoil).
  const flapperPushDir = flapper.x < opponent.x ? -1 : 1;
  flapper.flapHitLandTargetX = flapper.x + flapperPushDir * FLAP_HIT_LANDING_PUSHBACK;
  // Recover in lockstep with the victim's hitstun → no advantage on landing.
  flapper.flapHitRecoverDuration = SLAP_HIT3_STUN_MS;
  flapper.actionLockUntil = currentTime + SLAP_HIT3_STUN_MS;
  flapper.currentAction = null;

  // Knockback away from the flapper (burst model — no DI, like slap3).
  const knockbackDirection = opponent.x >= flapper.x ? 1 : -1;

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
  opponent.knockbackVelocity.x = knockbackDirection * FLAP_BODYSLAM_KB_VELOCITY;
  opponent.knockbackVelocity.y = 0;
  opponent.movementVelocity = 0;

  // ROPE RESISTANCE (same treatment as slap3): the slam may only send the
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
  opponent.slapKnockbackCanRingOut = distanceToBoundaryInKbDir <= SLAP_KILL_RANGE;

  if (!opponent.isAtTheRopes && !opponent.atTheRopesFacingDirection) {
    opponent.facing = flapper.x < opponent.x ? 1 : -1;
  }

  opponent.stamina = Math.max(0, opponent.stamina - SLAP_HIT_VICTIM_STAMINA_DRAIN);
  opponent.balance = Math.max(0, opponent.balance - BALANCE_SLAP_HIT_DRAIN);

  setKnockbackImmunity(opponent);

  if (currentRoom) {
    io.in(currentRoom.id).emit("player_hit", {
      x: opponent.x,
      y: opponent.y,
      facing: opponent.facing,
      attackType: "flap",
      stringPos: 0,
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
    });

    triggerHitstopAndEmit(io, currentRoom, HITSTOP_SLAP_HIT3_MS, "slap_burst");
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
    SLAP_HIT3_STUN_MS,
    "hitStateReset"
  );

  opponent.inputLockUntil = Math.max(
    opponent.inputLockUntil || 0,
    currentTime + SLAP_HIT3_STUN_MS
  );
}

module.exports = { checkCollision, processHit, checkFlapBodySlam, resolveSlapParry, applyParryEffect, resolveChargeClash };
