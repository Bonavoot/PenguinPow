// Impossible CPU AI — Pure reactive counter-machine
// Design: Zero reaction delay, always-optimal counters, grab-heavy offense.
// Every opponent action has a hard counter that this AI executes frame-perfectly.

const { ROPE_JUMP_BOUNDARY_ZONE, ROPE_JUMP_STAMINA_COST } = require("./constants");
const { MAP_LEFT_BOUNDARY: GAME_MAP_LEFT, MAP_RIGHT_BOUNDARY: GAME_MAP_RIGHT } = require("./gameUtils");

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

      // Rope jump
      lastRopeJumpTime: 0,

      // Power-up
      lastPowerUpTime: 0,
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
  cpu.keys = createEmptyKeys();
}

// ─── Capability checks ────────────────────────────────────────────

function canAct(cpu) {
  const now = Date.now();
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
         !(cpu.attackCooldownUntil && now < cpu.attackCooldownUntil) &&
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
}

// ─── Sub-behaviors ─────────────────────────────────────────────────

function handleKnockbackDI(cpu) {
  const dir = cpu.knockbackVelocity.x > 0 ? 1 : -1;
  if (dir > 0) { cpu.keys.a = true; cpu.keys.d = false; }
  else         { cpu.keys.a = false; cpu.keys.d = true; }
}

function handleGrabClashMashing(cpu, st, now) {
  const MASH_INTERVAL = 50;
  const mashKeys = ['w', 'a', 's', 'd', 'mouse1', 'mouse2'];
  if (now - st.grabClashLastMashTime >= MASH_INTERVAL) {
    resetAllKeys(cpu);
    cpu.keys[mashKeys[Math.floor(Math.random() * mashKeys.length)]] = true;
    st.grabClashLastMashTime = now;
  }
}

function handleGrabBreak(cpu, grabber, st, now) {
  if (!cpu.isBeingGrabbed || cpu.grabCounterAttempted) return;

  const pullCounterKey = grabber.facing === -1 ? 'd' : 'a';

  if (!grabber.isAttemptingGrabThrow && !grabber.isAttemptingPull) {
    st.grabBreakReactionDecided = false;
    resetAllKeys(cpu);
    // Instantly resist the push
    const pushResistKey = grabber.facing === -1 ? 'a' : 'd';
    cpu.keys[pushResistKey] = true;
    return;
  }

  // 100% correct counter — always break
  resetAllKeys(cpu);
  if (grabber.isAttemptingGrabThrow) {
    cpu.keys.s = true;
  } else if (grabber.isAttemptingPull) {
    cpu.keys[pullCounterKey] = true;
  }
}

function handleGrabDecision(cpu, human, st, now) {
  cpu.keys.a = false; cpu.keys.d = false; cpu.keys.w = false;
  cpu.keys.s = false; cpu.keys.shift = false; cpu.keys.e = false;
  cpu.keys.mouse1 = false; cpu.keys.mouse2 = false;

  if (cpu.isAttemptingGrabThrow || cpu.isAttemptingPull) return;
  if (!cpu.grabStartTime) return;

  if (!st.grabDecisionMade) {
    st.grabDecisionMade = true;

    const distBehindCpu = cpu.facing === 1
      ? distanceToRightEdge(cpu) : distanceToLeftEdge(cpu);
    const distFrontCpu = cpu.facing === 1
      ? distanceToLeftEdge(cpu) : distanceToRightEdge(cpu);

    if (distFrontCpu < 280) {
      // Opponent is near front edge — let the push carry them off
      st.grabStrategy = 'push';
    } else if (distBehindCpu < 250) {
      // Our back is near edge — always throw to escape
      st.grabStrategy = 'throw';
    } else {
      // Mid-map: push toward nearest edge, or throw if that's better
      const leftDist = distanceToLeftEdge(human);
      const rightDist = distanceToRightEdge(human);
      const nearestEdgeDist = Math.min(leftDist, rightDist);
      st.grabStrategy = nearestEdgeDist < 300 ? 'push' : 'throw';
    }

    st.grabActionDelay = now + 80;
  }

  if (st.grabStrategy === 'push') return;
  if (now < st.grabActionDelay) return;

  if (st.grabStrategy === 'throw') {
    cpu.keys.w = true;
  } else if (st.grabStrategy === 'pull') {
    const backKey = cpu.facing === 1 ? 'd' : 'a';
    cpu.keys[backKey] = true;
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
    (cpu.snowballThrowsRemaining ?? 3) > 0 &&
    !cpu.snowballCooldown && !cpu.isThrowingSnowball;
  const pumoReady = cpu.activePowerUp === "pumo_army" &&
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

// ─── Main decision function ────────────────────────────────────────

function updateImpossibleAI(cpu, human, room, currentTime) {
  if (!cpu || !human || !cpu.isCPU) return;

  if (room.gameOver || room.matchOver || !room.gameStart || room.hakkiyoiCount === 0) {
    resetAllKeys(cpu);
    return;
  }

  if (cpu.isGrabBreaking || cpu.isGrabBreakCountered || cpu.isGrabBreakSeparating ||
      human.isGrabBreaking || human.isGrabBreakCountered || human.isGrabBreakSeparating) {
    resetAllKeys(cpu);
    return;
  }

  const st = getState(cpu.id);
  const distance = getDistance(cpu, human);

  if (!cpu.keys) cpu.keys = createEmptyKeys();
  handlePendingKeyReleases(cpu, st, currentTime);

  // ── ALWAYS: DI during knockback ──
  if (cpu.isHit && cpu.knockbackVelocity && Math.abs(cpu.knockbackVelocity.x) > 0.1) {
    handleKnockbackDI(cpu);
  }

  // ── Grab clash: mash faster than any human ──
  if (cpu.isGrabClashing) {
    handleGrabClashMashing(cpu, st, currentTime);
    return;
  }

  // ── Currently grabbing: execute optimal throw ──
  if (cpu.isGrabbing && cpu.grabbedOpponent) {
    st.grabDecisionMade = st.grabDecisionMade || false;
    handleGrabDecision(cpu, human, st, currentTime);
    return;
  } else {
    st.grabDecisionMade = false;
    st.grabStrategy = null;
    st.grabActionDelay = 0;
  }

  // ── Being grabbed: 100% break ──
  if (cpu.isBeingGrabbed && !cpu.isBeingThrown) {
    handleGrabBreak(cpu, human, st, currentTime);
    return;
  } else {
    st.grabBreakReactionDecided = false;
    st.grabBreakReactS = false;
    st.grabBreakReactDirection = false;
    st.grabResistStartTime = 0;
  }

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

  // ── COUNTER: Opponent is charging (hasn't released yet) ──
  // Walk forward to close distance; parry will fire on release detection.
  if (human.isChargingAttack && canAct(cpu)) {
    resetAllKeys(cpu);
    const dir = getDirectionToOpponent(cpu, human);
    if (dir === 1) cpu.keys.d = true;
    else cpu.keys.a = true;
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
