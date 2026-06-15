// Impossible CPU AI — Pure reactive counter-machine
// Design: Zero reaction delay, always-optimal counters, grab-heavy offense.
// Every opponent action has a hard counter that this AI executes frame-perfectly.

const { ROPE_JUMP_BOUNDARY_ZONE, ROPE_JUMP_STAMINA_COST,
        CLINCH_THROW_LAND_THRESHOLD, CLINCH_THROW_KILL_THRESHOLD,
        GROUND_LEVEL, POWER_UP_TYPES,
        FLAP_CHARGE_COOLDOWN_MS, FLAP_STAMINA_COST,
        BALANCE_MAX } = require("./constants");
const { MAP_LEFT_BOUNDARY: GAME_MAP_LEFT, MAP_RIGHT_BOUNDARY: GAME_MAP_RIGHT, simNowForPlayer } = require("./gameUtils");

// Flap power-up tuning (impossible flavor — reactive & punish-focused)
const FLAP_DIVE_ALIGN = 50;        // |dx| under this → over the opponent, commit the dive
const FLAP_DIVE_KEEP_HEIGHT = 70;  // air-flap to keep altitude while closing if below this
const FLAP_DEF_RANGE = 155;        // horizontal threat band of an incoming slam
const FLAP_DEF_REACT_HEIGHT = 135; // flapper height (px) at which to commit a parry/dash
const FLAP_PUNISH_RANGE = 480;     // slam-punish a whiff/recovery from this far
const FLAP_ENGAGE_MIN = 110;       // mid-range engage lower bound
const FLAP_ENGAGE_MAX = 380;       // mid-range engage upper bound
const FLAP_COOLDOWN = 2600;        // min ms between liftoff attempts

const MAP_LEFT_BOUNDARY = 340;
const MAP_RIGHT_BOUNDARY = 940;
const MAP_CENTER = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;

const GRAB_RANGE = 136;
const SLAP_RANGE = 125;
const EDGE_DANGER_ZONE = 89;
const CORNER_CRITICAL_ZONE = 59;
const DECISION_COOLDOWN = 50;
const CHARGED_PARRY_DELAY = 60;
const PARRY_HOLD_DURATION = 110;

// ─── State management ──────────────────────────────────────────────

const aiStates = new Map();

function getState(playerId) {
  if (!aiStates.has(playerId)) {
    aiStates.set(playerId, {
      lastDecisionTime: 0,

      // Key release scheduling
      mouse1ReleaseTime: 0,
      mouse2ReleaseTime: 0,
      sReleaseTime: 0,
      shiftReleaseTime: 0,
      fReleaseTime: 0,

      // Parry timing for charged attacks
      pendingChargedParry: false,
      chargedParryFireTime: 0,

      // Pending parry hold
      pendingParry: false,
      parryReleaseTime: 0,

      // Grab strategy
      grabDecisionMade: false,
      grabStrategy: null,
      grabActionDelay: 0,

      // Grab clash
      grabClashLastMashTime: 0,

      // Grab break
      grabBreakReactionDecided: false,
      grabBreakReactS: false,
      grabBreakReactDirection: false,
      grabResistStartTime: 0,

      // Post-clinch-break "thinking" delay — prevents zero-reaction-time
      // CPU advantage when both players unlock simultaneously after a clinch
      // break. Mechanics stay symmetric (both players' inputLockUntil is
      // identical in mid-ring); this only adds a human-like delay before the
      // CPU can act on the neutral resume.
      wasInClinchBreak: false,
      postClinchBreakReactionUntil: 0,

      // Rope jump
      lastRopeJumpTime: 0,

      // Power-up
      lastPowerUpTime: 0,

      // Clinch system
      clinchLastThrowCheck: 0,
      clinchPushPlantDecision: null,
      clinchPushPlantUntil: 0,

      // Flap power-up
      spaceReleaseTime: 0,
      lastFlapTime: 0,
      flapDiveCommitted: false,
      flapReacted: false,        // whether we've committed a reaction this descent
    });
  }
  return aiStates.get(playerId);
}

function clearImpossibleAIState(playerId) {
  aiStates.delete(playerId);
}

// ─── Utility functions ─────────────────────────────────────────────

function getDistance(a, b) { return Math.abs(a.x - b.x); }
function distanceToLeftEdge(p) { return p.x - MAP_LEFT_BOUNDARY; }
function distanceToRightEdge(p) { return MAP_RIGHT_BOUNDARY - p.x; }

function getDirectionToOpponent(cpu, human) {
  return cpu.x < human.x ? 1 : -1;
}

function getDirectionToCenter(player) {
  return player.x < MAP_CENTER ? 1 : -1;
}

function isFacingOpponent(cpu, human) {
  const opponentIsRight = human.x > cpu.x;
  return (cpu.facing === -1 && opponentIsRight) || (cpu.facing === 1 && !opponentIsRight);
}

function isOpponentGrabbable(human) {
  return !human.isBeingThrown &&
         !human.isBeingGrabbed &&
         !human.isGrabWhiffRecovery &&
         !human.isGrabTeching &&
         !human.isGrabBreaking &&
         !human.isGrabBreakSeparating &&
         !human.isSidestepping;
}

function isNearEdge(player) {
  return distanceToLeftEdge(player) < EDGE_DANGER_ZONE ||
         distanceToRightEdge(player) < EDGE_DANGER_ZONE;
}

function getCorneredSide(player) {
  // Wider zone than Hard AI — impossible AI escapes earlier and more aggressively
  if (distanceToLeftEdge(player) < EDGE_DANGER_ZONE) return -1;
  if (distanceToRightEdge(player) < EDGE_DANGER_ZONE) return 1;
  return 0;
}

function createEmptyKeys() {
  return { w: false, a: false, s: false, d: false, " ": false,
           shift: false, e: false, f: false, mouse1: false, mouse2: false };
}

function resetAllKeys(cpu) {
  if (!cpu.keys) {
    cpu.keys = createEmptyKeys();
    return;
  }
  const k = cpu.keys;
  k.w = false;
  k.a = false;
  k.s = false;
  k.d = false;
  k[" "] = false;
  k.shift = false;
  k.e = false;
  k.f = false;
  k.mouse1 = false;
  k.mouse2 = false;
}

// ─── Capability checks ────────────────────────────────────────────

function canAct(cpu) {
  const now = simNowForPlayer(cpu);
  return !cpu.isHit && !cpu.isBeingThrown && !cpu.isThrowing &&
         !cpu.isDodging && !cpu.isRecovering && !cpu.isRawParryStun &&
         !cpu.isThrowTeching && !cpu.canMoveToReady &&
         !cpu.isThrowingSalt && !cpu.isSpawningPumoArmy &&
         !cpu.isThrowingSnowball && !cpu.isAtTheRopes &&
         !cpu.isInEndlag && !cpu.isInStartupFrames &&
         !cpu.isGrabStartup && !cpu.isWhiffingGrab &&
         !cpu.isGrabWhiffRecovery && !cpu.isGrabTeching &&
         !cpu.isGrabbingMovement && !cpu.isBeingGrabbed &&
         !cpu.isGrabBreaking && !cpu.isGrabBreakCountered &&
         !cpu.isGrabBreakSeparating && !cpu.isGrabClashing &&
         !cpu.isAttacking && !cpu.isGrabbing && !cpu.isChargingAttack &&
         !cpu.isRawParrying &&
         !(cpu.attackCooldownUntil && simNowForPlayer(cpu) < cpu.attackCooldownUntil) &&
         !(cpu.inputLockUntil && now < cpu.inputLockUntil) &&
         !(cpu.actionLockUntil && now < cpu.actionLockUntil);
}

function canAttack(cpu) {
  return canAct(cpu) && !cpu.isAttacking && !cpu.isGrabbing &&
         !cpu.isBeingGrabbed && !cpu.isRawParrying && !cpu.isChargingAttack;
}

function canGrab(cpu) {
  return canAct(cpu) && !cpu.isAttacking && !cpu.isGrabbing &&
         !cpu.isBeingGrabbed && !cpu.isChargingAttack &&
         !cpu.grabCooldown && !cpu.isGrabWhiffRecovery &&
         !cpu.isGrabTeching && !cpu.isGrabStartup;
}

function canParry(cpu) {
  return canAct(cpu) && !cpu.isAttacking && !cpu.isGrabbing &&
         !cpu.isBeingGrabbed && !cpu.isRawParrying && !cpu.isChargingAttack;
}



// ─── Key release handling ──────────────────────────────────────────

function handlePendingKeyReleases(cpu, st, now) {
  if (st.mouse1ReleaseTime > 0 && now >= st.mouse1ReleaseTime) {
    cpu.keys.mouse1 = false;
    st.mouse1ReleaseTime = 0;
  }
  if (st.mouse2ReleaseTime > 0 && now >= st.mouse2ReleaseTime) {
    cpu.keys.mouse2 = false;
    st.mouse2ReleaseTime = 0;
  }
  if (st.sReleaseTime > 0 && now >= st.sReleaseTime) {
    cpu.keys.s = false;
    st.sReleaseTime = 0;
  }
  if (st.shiftReleaseTime > 0 && now >= st.shiftReleaseTime) {
    cpu.keys.shift = false;
    cpu.keys.a = false;
    cpu.keys.d = false;
    st.shiftReleaseTime = 0;
  }
  if (st.fReleaseTime > 0 && now >= st.fReleaseTime) {
    cpu.keys.f = false;
    st.fReleaseTime = 0;
  }
  if (st.spaceReleaseTime > 0 && now >= st.spaceReleaseTime) {
    cpu.keys[" "] = false;
    st.spaceReleaseTime = 0;
  }
}

// ─── Sub-behaviors ─────────────────────────────────────────────────

function handleKnockbackDI(cpu) {
  const dir = cpu.knockbackVelocity.x > 0 ? 1 : -1;
  if (dir > 0) { cpu.keys.a = true; cpu.keys.d = false; }
  else         { cpu.keys.a = false; cpu.keys.d = true; }
}

// Impossible clinch: instant grip-up, optimal push/plant, always-correct throw timing.
function handleClinchBehavior(cpu, opponent, st, now) {
  resetAllKeys(cpu);

  if (cpu.clinchThrowActive || cpu.isClinchClashing || cpu.isClinchThrowing ||
      cpu.isBeingLifted || cpu.isResistingThrow || cpu.isResistingPull ||
      cpu.isGrabSeparating) {
    return;
  }
  if (opponent.clinchThrowActive || opponent.isClinchClashing || opponent.isClinchThrowing) {
    return;
  }

  // Let burst push ride as grabber
  if (cpu.isGrabPushing) return;

  const towardKey = cpu.x < opponent.x ? 'd' : 'a';
  const awayKey = cpu.x < opponent.x ? 'a' : 'd';
  const cpuDistLeft = cpu.x - MAP_LEFT_BOUNDARY;
  const cpuDistRight = MAP_RIGHT_BOUNDARY - cpu.x;
  const oppDistLeft = opponent.x - MAP_LEFT_BOUNDARY;
  const oppDistRight = MAP_RIGHT_BOUNDARY - opponent.x;
  const cpuNearestEdge = Math.min(cpuDistLeft, cpuDistRight);
  const oppNearestEdge = Math.min(oppDistLeft, oppDistRight);

  // Instant grip-up
  if (!cpu.hasGrip && cpu.inClinch) {
    cpu.hasGrip = true;
    cpu.clinchAction = "neutral";
    return;
  }

  const opponentBalance = opponent.balance;
  const cpuBalance = cpu.balance;
  const cpuStamina = cpu.stamina;

  const canRequestAction = cpu.hasGrip && !cpu.clinchThrowActive &&
                           !cpu.clinchThrowCooldown && !cpu.clinchThrowRequest &&
                           !cpu.isClinchClashing;
  const canLand = opponentBalance <= CLINCH_THROW_LAND_THRESHOLD;
  const canKill = opponentBalance < CLINCH_THROW_KILL_THRESHOLD;

  const cpuBackedToEdge = cpuNearestEdge < EDGE_DANGER_ZONE && cpuNearestEdge < oppNearestEdge;

  // --- EDGE ESCAPE URGENCY ---
  // When backed against the boundary, throw/lift to escape even in fail zone
  if (cpuBackedToEdge && canRequestAction) {
    const staminaCritical = cpuStamina < 35;
    const edgeCheckInterval = staminaCritical ? 100 : 200;

    if (now - (st.clinchLastThrowCheck || 0) > edgeCheckInterval) {
      st.clinchLastThrowCheck = now;
      // Lift moves both players away from CPU's edge — always the best escape
      // Fall back to throw if lift isn't ideal
      let action;
      if (canKill) {
        action = cpuNearestEdge > 80 ? "lift" : "throw";
      } else {
        action = "lift";
      }
      cpu.clinchThrowRequest = action;
      cpu.clinchThrowRequestTime = now;
      // Skip normal throw decision — edge escape takes priority
    }
  }

  // --- NORMAL THROW / PULL / LIFT DECISION ---
  if (!st.clinchLastThrowCheck) st.clinchLastThrowCheck = 0;
  const checkInterval = canKill ? 150 : 400;
  if (canRequestAction && !cpu.clinchThrowRequest && now - st.clinchLastThrowCheck > checkInterval) {
    st.clinchLastThrowCheck = now;

    if (canKill) {
      const liftViable = cpuNearestEdge > 80;
      let action;
      if (liftViable) {
        action = "lift";
      } else {
        action = "throw";
      }
      cpu.clinchThrowRequest = action;
      cpu.clinchThrowRequestTime = now;
    } else if (canLand) {
      let action;
      if (cpuNearestEdge > 120) {
        action = "lift";
      } else if (oppNearestEdge > cpuNearestEdge) {
        action = "throw";
      } else {
        action = "pull";
      }
      cpu.clinchThrowRequest = action;
      cpu.clinchThrowRequestTime = now;
    }
  }

  // Stay neutral when a throw request is active (avoid push penalty on throw)
  if (cpu.clinchThrowRequest) return;

  // Push/plant: optimal choice every 200ms
  if (!st.clinchPushPlantUntil || now > st.clinchPushPlantUntil) {
    st.clinchPushPlantUntil = now + 200;

    const opponentNearEdge = oppNearestEdge < EDGE_DANGER_ZONE;
    const cpuNearEdge = cpuNearestEdge < EDGE_DANGER_ZONE;

    if (cpuBackedToEdge) {
      // At edge: push to resist, but plant if stamina is critical (plant regens now)
      st.clinchPushPlantDecision = cpuStamina < 15 ? "plant" : "push";
    } else if (opponentNearEdge && cpuBalance > 20) {
      // Opponent near edge — push hard (edge zone amplifies balance drain)
      st.clinchPushPlantDecision = "push";
    } else if (cpuStamina < 35) {
      // Plant recovers stamina — plant to regroup when stamina is moderate-low
      st.clinchPushPlantDecision = "plant";
    } else if (cpuBalance < 30) {
      st.clinchPushPlantDecision = "plant";
    } else if (cpuBalance > opponentBalance + 5) {
      st.clinchPushPlantDecision = "push";
    } else {
      st.clinchPushPlantDecision = "plant";
    }
  }

  if (st.clinchPushPlantDecision === "push") {
    cpu.keys[towardKey] = true;
  } else if (st.clinchPushPlantDecision === "plant") {
    cpu.keys.s = true;
    cpu.keys[awayKey] = true;
  }
}

// Cornered neutral: only called from neutral game section (AFTER reactive core).
// Never dashes. Grabs to escape, rope jumps if far enough, walks otherwise.
function handleCorneredNeutral(cpu, human, st, now, distance) {
  const corneredSide = getCorneredSide(cpu);
  if (corneredSide === 0) return false;

  const opponentBlocksEscape = (corneredSide === -1 && human.x > cpu.x) ||
                                (corneredSide === 1 && human.x < cpu.x);
  if (!opponentBlocksEscape) return false;

  resetAllKeys(cpu);

  // Rope jump when opponent is far enough (startup is punishable up close)
  const nearLeftBound = cpu.x - GAME_MAP_LEFT < ROPE_JUMP_BOUNDARY_ZONE + 10;
  const nearRightBound = GAME_MAP_RIGHT - cpu.x < ROPE_JUMP_BOUNDARY_ZONE + 10;
  if ((nearLeftBound || nearRightBound) &&
      distance > 130 &&
      now - st.lastRopeJumpTime > 4000 &&
      !cpu.isGassed) {
    cpu.keys.w = true;
    if (nearLeftBound) cpu.keys.d = true;
    else cpu.keys.a = true;
    st.lastRopeJumpTime = now;
    st.lastDecisionTime = now;
    return true;
  }

  // Close range: grab (throw to escape) or slap
  if (distance < GRAB_RANGE) {
    if (canGrab(cpu) && isOpponentGrabbable(human) && isFacingOpponent(cpu, human)) {
      cpu.keys.mouse2 = true;
      st.mouse2ReleaseTime = now + 50;
      st.lastDecisionTime = now;
      return true;
    }
    if (canAttack(cpu)) {
      cpu.keys.mouse1 = true;
      st.mouse1ReleaseTime = now + 40;
      st.lastDecisionTime = now;
      return true;
    }
    // Both on cooldown — just wait, reactive core handles defense
    return false;
  }

  // Walk toward center (never dash)
  const escapeDir = -corneredSide;
  if (escapeDir === 1) cpu.keys.d = true;
  else cpu.keys.a = true;
  st.lastDecisionTime = now;
  return true;
}

function handlePowerUp(cpu, human, st, now, distance) {
  const snowballReady = cpu.activePowerUp === "snowball" &&
    (cpu.snowballThrowsRemaining ?? 5) > 0 &&
    !cpu.snowballCooldown && !cpu.isThrowingSnowball;
  const pumoReady = cpu.activePowerUp === "pumo_army" &&
    (cpu.pumoArmySpawnsRemaining ?? 3) > 0 &&
    !cpu.pumoArmyCooldown && !cpu.isSpawningPumoArmy;

  if (!snowballReady && !pumoReady) return false;
  if (cpu.isAttacking || cpu.isGrabbing || cpu.isBeingGrabbed ||
      cpu.isThrowing || cpu.isBeingThrown || cpu.isDodging ||
      cpu.isHit || cpu.isRawParryStun || cpu.isRecovering ||
      cpu.isThrowingSnowball || cpu.isSpawningPumoArmy) return false;

  const cooldown = snowballReady ? 600 : 250;
  if (now - st.lastPowerUpTime < cooldown) return false;

  resetAllKeys(cpu);
  cpu.keys.f = true;
  st.fReleaseTime = now + 150;
  st.lastPowerUpTime = now;
  st.lastDecisionTime = now;
  return true;
}

function handleSnowballDefense(cpu, human, st, now) {
  if (!human.snowballs || human.snowballs.length === 0) return false;

  for (const sb of human.snowballs) {
    if (sb.hasHit) continue;
    const dx = sb.x - cpu.x;
    const dist = Math.abs(dx);
    if (dist > 300) continue;
    const movingToward = (sb.velocityX > 0 && dx < 0) || (sb.velocityX < 0 && dx > 0);
    if (!movingToward) continue;

    if (canParry(cpu)) {
      resetAllKeys(cpu);
      cpu.keys.s = true;
      st.sReleaseTime = now + PARRY_HOLD_DURATION;
      st.lastDecisionTime = now;
      return true;
    }
  }
  return false;
}

// ─── FLAP power-up ─────────────────────────────────────────────────

function pickFleeDir(cpu, human) {
  let dir = cpu.x < human.x ? -1 : 1; // away from the opponent
  if (dir === -1 && distanceToLeftEdge(cpu) < 120) dir = 1;
  else if (dir === 1 && distanceToRightEdge(cpu) < 120) dir = -1;
  return dir;
}

// Pilot our own flight: steer over the opponent, air-flap to keep altitude while
// closing, then dive (no flap) so the body-slam drops on them. Startup/landing
// phases are locked — just hold.
function pilotFlap(cpu, human, st, now) {
  resetAllKeys(cpu);
  if (cpu.flapPhase !== "flight") return;

  const horiz = cpu.x - human.x;
  const absH = Math.abs(horiz);
  const aligned = absH <= FLAP_DIVE_ALIGN;
  const heightAbove = cpu.y - GROUND_LEVEL;
  const canAirFlap =
    cpu.flapCharges > 0 && now - (cpu.lastFlapChargeTime || 0) >= FLAP_CHARGE_COOLDOWN_MS;

  cpu.facing = horiz > 0 ? 1 : -1;
  if (!aligned) {
    if (horiz > 0) cpu.keys.a = true;
    else cpu.keys.d = true;
  }
  if (aligned) st.flapDiveCommitted = true;

  if (!st.flapDiveCommitted && canAirFlap && !aligned && heightAbove < FLAP_DIVE_KEEP_HEIGHT) {
    cpu.keys[" "] = true;
    st.spaceReleaseTime = now + 50;
    if (horiz > 0) cpu.keys.a = true;
    else cpu.keys.d = true;
  }
}

// React to the opponent flying: dash out from under the landing or (if parry is
// available — FLAP itself replaces parry) parry the slam frame-perfectly.
function handleFlapDefense(cpu, human, st, now, distance) {
  if (!human.isFlapping || human.flapPhase !== "flight") return false;
  if (cpu.isFlapping) return false;
  if (!canAct(cpu)) return false;

  const horiz = Math.abs(cpu.x - human.x);
  const descending = (human.flapVelocityY ?? 0) <= 0;
  const flapperHeight = human.y - GROUND_LEVEL;

  // Not imminent (rising/far) — slide out of the landing lane.
  if (!descending || horiz > FLAP_DEF_RANGE) {
    if (horiz < FLAP_DEF_RANGE * 1.5) {
      resetAllKeys(cpu);
      const dir = pickFleeDir(cpu, human);
      if (dir === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      st.lastDecisionTime = now;
      return true;
    }
    return false;
  }

  if (st.flapReacted) return false; // one committed reaction per descent
  const aboutToLand = flapperHeight < FLAP_DEF_REACT_HEIGHT;
  if (!aboutToLand) {
    // Keep repositioning until the flapper is low enough to commit.
    resetAllKeys(cpu);
    const dir = pickFleeDir(cpu, human);
    if (dir === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    st.lastDecisionTime = now;
    return true;
  }
  st.flapReacted = true;

  const canParryHit = cpu.activePowerUp !== POWER_UP_TYPES.FLAP;
  // Counter-machine: parry the slam (also punishes the flapper) when able.
  if (canParryHit && canParry(cpu)) {
    resetAllKeys(cpu);
    cpu.keys.s = true;
    st.pendingParry = true;
    st.parryReleaseTime = now + PARRY_HOLD_DURATION;
    st.lastDecisionTime = now;
    return true;
  }
  // Otherwise dash clear of the landing.
  if (!cpu.isGassed) {
    resetAllKeys(cpu);
    cpu.keys.shift = true;
    const dir = pickFleeDir(cpu, human);
    if (dir === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    st.shiftReleaseTime = now + 80;
    st.lastDecisionTime = now;
    return true;
  }
  return false;
}

// Take flight to slam — primarily to punish an out-of-grab-range whiff/recovery,
// occasionally as a mid-range engage.
function handleFlapOffense(cpu, human, st, now, distance) {
  if (cpu.activePowerUp !== POWER_UP_TYPES.FLAP) return false;
  if (cpu.isFlapping || !canAct(cpu)) return false;
  if (cpu.isGassed || cpu.stamina < FLAP_STAMINA_COST + 8) return false;
  if (now - (st.lastFlapTime || 0) < FLAP_COOLDOWN) return false;
  if (human.isAttacking) return false;

  const horiz = Math.abs(cpu.x - human.x);
  const punishing =
    (human.isRecovering || human.isInEndlag || human.isWhiffingGrab ||
      human.isGrabWhiffRecovery || human.isRawParryStun) &&
    horiz < FLAP_PUNISH_RANGE;
  const engage = horiz >= FLAP_ENGAGE_MIN && horiz <= FLAP_ENGAGE_MAX;
  if (!punishing && !engage) return false;
  // Reactive identity: always punish a whiff, but only sometimes engage in neutral.
  if (!punishing && Math.random() > 0.4) return false;

  resetAllKeys(cpu);
  cpu.facing = cpu.x < human.x ? -1 : 1;
  cpu.keys[" "] = true;
  st.spaceReleaseTime = now + 60;
  st.lastFlapTime = now;
  st.flapDiveCommitted = false;
  st.lastDecisionTime = now;
  return true;
}

// ─── Main decision function ────────────────────────────────────────

function updateImpossibleAI(cpu, human, room, currentTime) {
  if (!cpu || !human || !cpu.isCPU) return;

  if (room.gameOver || room.matchOver || !room.gameStart || room.hakkiyoiCount === 0) {
    resetAllKeys(cpu);
    return;
  }

  const st = getState(cpu.id);

  const inClinchBreak = cpu.isGrabBreaking || cpu.isGrabBreakCountered || cpu.isGrabBreakSeparating ||
      human.isGrabBreaking || human.isGrabBreakCountered || human.isGrabBreakSeparating;
  if (inClinchBreak) {
    st.wasInClinchBreak = true;
    resetAllKeys(cpu);
    return;
  }

  // Just exited grab break — assign a human-like reaction delay before the
  // CPU is allowed to act again. See cpuAI.js for full rationale.
  if (st.wasInClinchBreak) {
    st.wasInClinchBreak = false;
    // Fast-but-not-instant reaction (60-120ms = ~3.5-7 frames @60fps).
    st.postClinchBreakReactionUntil = currentTime + (60 + Math.floor(Math.random() * 61));
  }
  if (st.postClinchBreakReactionUntil && currentTime < st.postClinchBreakReactionUntil) {
    resetAllKeys(cpu);
    return;
  }

  const distance = getDistance(cpu, human);

  if (!cpu.keys) cpu.keys = createEmptyKeys();
  handlePendingKeyReleases(cpu, st, currentTime);

  // ── ALWAYS: DI during knockback ──
  if (cpu.isHit && cpu.knockbackVelocity && Math.abs(cpu.knockbackVelocity.x) > 0.1) {
    handleKnockbackDI(cpu);
  }

  // ── Clinch behavior (mutual grab system) ──
  if (cpu.inClinch && (cpu.isGrabbing || cpu.isBeingGrabbed)) {
    handleClinchBehavior(cpu, human, st, currentTime);
    return;
  }
  // Clean up clinch state when not in clinch
  if (!cpu.inClinch && !cpu.isGrabbing && !cpu.isBeingGrabbed) {
    st.grabDecisionMade = false;
    st.grabStrategy = null;
    st.grabActionDelay = 0;
    st.clinchLastThrowCheck = 0;
    st.clinchPushPlantDecision = null;
    st.clinchPushPlantUntil = 0;
  }

  // Being grabbed outside clinch (edge case) — don't act
  if (cpu.isBeingGrabbed && !cpu.isBeingThrown) {
    return;
  }

  // ── FLAP: piloting our own flight overrides everything ──
  if (cpu.isFlapping) {
    pilotFlap(cpu, human, st, currentTime);
    return;
  }
  if (!human.isFlapping && st.flapReacted) st.flapReacted = false;

  // ── Pending parry hold: keep holding until release time ──
  if (st.pendingParry) {
    if (currentTime >= st.parryReleaseTime || !human.isAttacking) {
      cpu.keys.s = false;
      st.pendingParry = false;
    } else {
      cpu.keys.s = true;
    }
    return;
  }

  // ── Power-ups ──
  if (handlePowerUp(cpu, human, st, currentTime, distance)) return;

  // ── Snowball defense ──
  if (canAct(cpu) && handleSnowballDefense(cpu, human, st, currentTime)) return;

  // ═══════════════════════════════════════════════════════════════════
  //  REACTIVE CORE — Counter every opponent action optimally
  // ═══════════════════════════════════════════════════════════════════

  // ── COUNTER: Opponent flying (Flap) — dash the landing or parry the slam ──
  if (handleFlapDefense(cpu, human, st, currentTime, distance)) return;

  // ── COUNTER: Opponent rope jumping — punish every phase ──
  if (human.isRopeJumping) {
    resetAllKeys(cpu);

    if (human.ropeJumpPhase === "startup") {
      // Startup is 166ms — slap them out of it if close enough
      if (canAttack(cpu) && distance < SLAP_RANGE) {
        cpu.keys.mouse1 = true;
        st.mouse1ReleaseTime = currentTime + 40;
        st.lastDecisionTime = currentTime;
        return;
      }
      // Too far to punish startup — walk toward landing zone
      const landingX = human.ropeJumpTargetX;
      if (landingX) {
        if (landingX > cpu.x) cpu.keys.d = true;
        else cpu.keys.a = true;
      }
      return;
    }

    if (human.ropeJumpPhase === "active") {
      // Airborne (450ms) — immune to attacks. Walk to the landing zone.
      const landingX = human.ropeJumpTargetX;
      const distToLanding = landingX ? Math.abs(cpu.x - landingX) : distance;
      if (distToLanding > 30) {
        if (landingX > cpu.x) cpu.keys.d = true;
        else cpu.keys.a = true;
      }
      return;
    }

    if (human.ropeJumpPhase === "landing") {
      // Landing recovery is 183ms — free punish window
      if (distance < GRAB_RANGE && canGrab(cpu) &&
          isOpponentGrabbable(human) && isFacingOpponent(cpu, human)) {
        cpu.keys.mouse2 = true;
        st.mouse2ReleaseTime = currentTime + 50;
        st.lastDecisionTime = currentTime;
        return;
      }
      if (distance < SLAP_RANGE && canAttack(cpu)) {
        cpu.keys.mouse1 = true;
        st.mouse1ReleaseTime = currentTime + 40;
        st.lastDecisionTime = currentTime;
        return;
      }
      // Walk toward opponent to punish
      const dir = getDirectionToOpponent(cpu, human);
      if (dir === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
      return;
    }
  }

  // ── COUNTER: Opponent is attacking (slap or charged) ──
  // Detect DURING startup frames for frame-perfect parries.
  if (human.isAttacking && canParry(cpu)) {
    resetAllKeys(cpu);

    if (human.attackType === 'charged' && human.isInStartupFrames) {
      // Charged attack has 150ms startup — delay parry for perfect timing
      if (!st.pendingChargedParry) {
        st.pendingChargedParry = true;
        st.chargedParryFireTime = currentTime + CHARGED_PARRY_DELAY;
      }
      if (currentTime >= st.chargedParryFireTime) {
        cpu.keys.s = true;
        st.pendingParry = true;
        st.parryReleaseTime = currentTime + PARRY_HOLD_DURATION;
        st.pendingChargedParry = false;
        st.lastDecisionTime = currentTime;
      }
      return;
    }

    // Slap or charged that's already past startup — parry immediately
    cpu.keys.s = true;
    st.pendingParry = true;
    st.parryReleaseTime = currentTime + PARRY_HOLD_DURATION;
    st.pendingChargedParry = false;
    st.lastDecisionTime = currentTime;
    return;
  }

  // Clear charged parry tracking when opponent stops attacking
  st.pendingChargedParry = false;

  // ── COUNTER: Opponent is charging (visible wind-up) ──
  if (human.isChargingAttack && canAct(cpu)) {
    resetAllKeys(cpu);
    if (distance < GRAB_RANGE && canGrab(cpu) && isFacingOpponent(cpu, human)) {
      cpu.keys.mouse2 = true;
      st.mouse2ReleaseTime = currentTime + 50;
    } else {
      const dir = getDirectionToOpponent(cpu, human);
      if (dir === 1) cpu.keys.d = true;
      else cpu.keys.a = true;
    }
    return;
  }

  // ── COUNTER: Opponent is parrying → grab them (parry is grabbable) ──
  if (human.isRawParrying && canGrab(cpu) && distance < GRAB_RANGE &&
      isOpponentGrabbable(human) && isFacingOpponent(cpu, human)) {
    resetAllKeys(cpu);
    cpu.keys.mouse2 = true;
    st.mouse2ReleaseTime = currentTime + 50;
    st.lastDecisionTime = currentTime;
    return;
  }

  // ── COUNTER: Opponent grabbing (startup or lunging) → slap out or grab-tech ──
  if ((human.isGrabStartup || human.isGrabbingMovement) && distance < SLAP_RANGE) {
    resetAllKeys(cpu);
    if (canAttack(cpu)) {
      // Slap beats grab (55ms startup < 180ms startup)
      cpu.keys.mouse1 = true;
      st.mouse1ReleaseTime = currentTime + 40;
      st.lastDecisionTime = currentTime;
      return;
    }
    if (canGrab(cpu) && isFacingOpponent(cpu, human)) {
      // Can't slap (cooldown) — grab-tech instead → grab clash, AI wins with faster mashing
      cpu.keys.mouse2 = true;
      st.mouse2ReleaseTime = currentTime + 50;
      st.lastDecisionTime = currentTime;
      return;
    }
    return;
  }

  // ── COUNTER: Opponent whiffed/recovering/in endlag → grab punish (slap if grab unavailable) ──
  if ((human.isRecovering || human.isInEndlag || human.isWhiffingGrab ||
       human.isGrabWhiffRecovery || human.isRawParryStun) && distance < GRAB_RANGE) {
    if (canGrab(cpu) && isOpponentGrabbable(human) && isFacingOpponent(cpu, human)) {
      resetAllKeys(cpu);
      cpu.keys.mouse2 = true;
      st.mouse2ReleaseTime = currentTime + 50;
      st.lastDecisionTime = currentTime;
      return;
    }
    if (canAttack(cpu)) {
      resetAllKeys(cpu);
      cpu.keys.mouse1 = true;
      st.mouse1ReleaseTime = currentTime + 40;
      st.lastDecisionTime = currentTime;
      return;
    }
  }

  // ── COUNTER: Opponent is dodging → reposition, don't waste action ──
  if (human.isDodging) {
    resetAllKeys(cpu);
    const dir = getDirectionToOpponent(cpu, human);
    if (dir === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    return;
  }

  // ── COUNTER: Opponent stunned from our perfect parry → grab punish (slap if grab unavailable) ──
  if (human.isHit && distance < GRAB_RANGE) {
    if (canGrab(cpu) && isOpponentGrabbable(human) && isFacingOpponent(cpu, human)) {
      resetAllKeys(cpu);
      cpu.keys.mouse2 = true;
      st.mouse2ReleaseTime = currentTime + 50;
      st.lastDecisionTime = currentTime;
      return;
    }
    if (canAttack(cpu)) {
      resetAllKeys(cpu);
      cpu.keys.mouse1 = true;
      st.mouse1ReleaseTime = currentTime + 40;
      st.lastDecisionTime = currentTime;
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  NEUTRAL GAME — Menacing walk-forward into grab
  //  Reactive core already handled all opponent actions above.
  //  This section only runs when the opponent is idle/neutral.
  // ═══════════════════════════════════════════════════════════════════

  if (currentTime - st.lastDecisionTime < DECISION_COOLDOWN) return;

  if (!canAct(cpu)) return;

  resetAllKeys(cpu);

  // Cornered: escape via rope jump or grab/slap, then wait for reactive core
  if (handleCorneredNeutral(cpu, human, st, currentTime, distance)) return;

  // FLAP: take flight to slam (punish an out-of-range whiff, or engage)
  if (handleFlapOffense(cpu, human, st, currentTime, distance)) return;

  // Opponent near edge: walk in and grab for ring-out
  const humanNearLeftEdge = distanceToLeftEdge(human) < EDGE_DANGER_ZONE;
  const humanNearRightEdge = distanceToRightEdge(human) < EDGE_DANGER_ZONE;

  if (humanNearLeftEdge || humanNearRightEdge) {
    if (distance < GRAB_RANGE && canGrab(cpu) &&
        isOpponentGrabbable(human) && isFacingOpponent(cpu, human)) {
      cpu.keys.mouse2 = true;
      st.mouse2ReleaseTime = currentTime + 50;
      st.lastDecisionTime = currentTime;
      return;
    }
    const dir = getDirectionToOpponent(cpu, human);
    if (dir === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
    st.lastDecisionTime = currentTime;
    return;
  }

  // Close range: grab only. Never slap proactively — pure reactive.
  if (distance < GRAB_RANGE && canGrab(cpu) &&
      isOpponentGrabbable(human) && isFacingOpponent(cpu, human)) {
    cpu.keys.mouse2 = true;
    st.mouse2ReleaseTime = currentTime + 50;
    st.lastDecisionTime = currentTime;
    return;
  }

  // Walk forward slowly — menacing approach
  const dir = getDirectionToOpponent(cpu, human);
  if (dir === 1) cpu.keys.d = true;
  else cpu.keys.a = true;
  st.lastDecisionTime = currentTime;
}

module.exports = {
  updateImpossibleAI,
  clearImpossibleAIState,
};
