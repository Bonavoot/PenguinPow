const {
  GROUND_LEVEL, DOHYO_FALL_DEPTH, DOHYO_FALL_SPEED,
  speedFactor,
  POWER_UP_TYPES,
  PERFECT_PARRY_WINDOW, PERFECT_PARRY_ANIMATION_LOCK, PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK,
  RAW_PARRY_STAMINA_REFUND, PARRY_SUCCESS_DURATION,
  PERFECT_PARRY_BALANCE_REFUND, BALANCE_MAX,
  SIDESTEP_HIT_RETURN_BASE_MS,
  SIDESTEP_HIT_RETURN_MIN_MS,
} = require("./constants");

const {
  setPlayerTimeout,
  simNow,
  clearAllActionStates,
  canApplyKnockback,
  setKnockbackImmunity,
  emitThrottledScreenShake,
  DOHYO_LEFT_BOUNDARY,
  DOHYO_RIGHT_BOUNDARY,
  clearHitFall,
  clearSidestepHitReturn,
} = require("./gameUtils");

// Swept 1D collision: horizontal distance from targetX to the segment the
// projectile traversed this tick. Fast projectiles (reflected snowballs move
// ~12px/tick) can otherwise tunnel across a hit/parry threshold edge between
// two discrete position samples.
function sweptHorizDistance(fromX, toX, targetX) {
  const lo = Math.min(fromX, toX);
  const hi = Math.max(fromX, toX);
  if (targetX < lo) return lo - targetX;
  if (targetX > hi) return targetX - hi;
  return 0; // target inside the swept span
}

function updateProjectiles(room, io, delta) {
  const [player1, player2] = room.players;

  // Handle snowball updates
  [player1, player2].forEach((player) => {
    // Store initial snowball count to detect removals
    const initialSnowballCount = player.snowballs.length;

    // Update snowball positions and check for collisions
    player.snowballs = player.snowballs.filter((snowball) => {
      // Move snowball (keep pre-move position for swept collision)
      const snowballPrevX = snowball.x;
      snowball.x += snowball.velocityX * delta * speedFactor;

      // Check if snowball is off-screen
      if (snowball.x < -50 || snowball.x > 1330) {
        return false; // Remove snowball
      }

      // Check collision with target player
      // For reflected snowballs, target is the original thrower; otherwise target is opponent
      const opponent = room.players.find((p) => p.id !== player.id);
      const targetPlayer = snowball.reflectedByPerfectParry 
        ? player  // Hit the thrower (reflected back)
        : opponent; // Hit the opponent (normal)
      
      if (
        targetPlayer &&
        !targetPlayer.isDodging &&
        !targetPlayer.isRawParrying &&
        !snowball.hasHit
      ) {
        const distance = sweptHorizDistance(snowballPrevX, snowball.x, targetPlayer.x);
        const sizeMul = targetPlayer.sizeMultiplier || 1;
        const horizThresh = Math.round(45 * 0.96) * sizeMul;
        const vertThresh = Math.round(27 * 0.96) * sizeMul;
        if (
          distance < horizThresh &&
          Math.abs(snowball.y - targetPlayer.y) < vertThresh
        ) {
          // If either player is actually IN the grab (connected), snowball passes through
          // Grab startup (attempting) can still be hit; only connected grab states are immune
          const isTargetInConnectedGrab =
            targetPlayer.isGrabbingMovement ||
            targetPlayer.isGrabbing ||
            targetPlayer.isBeingGrabbed;
          if (isTargetInConnectedGrab) {
            return true; // Keep snowball in flight, don't register hit
          }

          // Check for thick blubber hit absorption
          const isTargetGrabbing = targetPlayer.isGrabStartup || targetPlayer.isGrabbingMovement || targetPlayer.isGrabbing;
          if (
            targetPlayer.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
            ((targetPlayer.isAttacking && targetPlayer.attackType === "charged") || isTargetGrabbing) &&
            !targetPlayer.hitAbsorptionUsed
          ) {
            // Mark absorption as used for this charge session
            targetPlayer.hitAbsorptionUsed = true;

            // Remove snowball but don't hit the player
            snowball.hasHit = true;

            // Collision resolves on a 64Hz tick between 32Hz broadcasts; force
            // an immediate broadcast so the consumed ball reaches clients now
            // instead of lingering at its last sampled spot for a frame.
            room.forceBroadcast = true;

            // Emit absorption effect
            io.in(room.id).emit("thick_blubber_absorption", {
              playerId: targetPlayer.id,
              x: targetPlayer.x,
              y: targetPlayer.y,
            });

            return false; // Remove snowball after absorption
          }

          // Hit target player normally
          snowball.hasHit = true;

          // Collision resolves on a 64Hz tick between 32Hz broadcasts; force an
          // immediate broadcast so the ball is removed on clients right as it
          // lands instead of freezing at its last sampled spot for a frame.
          room.forceBroadcast = true;

          // Emit snowball hit effect for visual clarity (facing = hit player's facing for effect offset)
          io.in(room.id).emit("snowball_hit", {
            x: targetPlayer.x,
            y: targetPlayer.y,
            facing: targetPlayer.facing,
            hitId: `snowball-hit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          });
          
          // If target was grabbing someone, clear the grabbed player's state first
          if (targetPlayer.isGrabbing && targetPlayer.grabbedOpponent) {
            const grabbedPlayer = room.players.find(p => p.id === targetPlayer.grabbedOpponent);
            if (grabbedPlayer) {
              grabbedPlayer.isBeingGrabbed = false;
            }
          }
          
          // CRITICAL: If target was throwing someone, clear the thrown player's state
          // This prevents isBeingThrown from getting stuck when thrower is interrupted
          if (targetPlayer.isThrowing && targetPlayer.throwOpponent) {
            const thrownPlayer = room.players.find(p => p.id === targetPlayer.throwOpponent);
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
          
          // CRITICAL: Clear ALL action states before setting isHit
          clearAllActionStates(targetPlayer);

          if (targetPlayer.y > GROUND_LEVEL) {
            clearSidestepHitReturn(targetPlayer);
            targetPlayer.isHitFalling = true;
            targetPlayer.hitFallStartTime = simNow(room);
            targetPlayer.hitFallStartY = targetPlayer.y;
          } else if (targetPlayer.y < GROUND_LEVEL) {
            clearHitFall(targetPlayer);
            const depthRatio = (GROUND_LEVEL - targetPlayer.y) / 55;
            const duration = SIDESTEP_HIT_RETURN_MIN_MS + (SIDESTEP_HIT_RETURN_BASE_MS - SIDESTEP_HIT_RETURN_MIN_MS) * Math.min(depthRatio, 1);
            targetPlayer.isSidestepHitReturn = true;
            targetPlayer.sidestepHitReturnStartTime = simNow(room);
            targetPlayer.sidestepHitReturnStartY = targetPlayer.y;
            targetPlayer.sidestepHitReturnDuration = duration;
          } else {
            targetPlayer.y = GROUND_LEVEL;
          }

          targetPlayer.isHit = true;
          targetPlayer.lastHitType = "snowball";
          targetPlayer.isAlreadyHit = true;
          targetPlayer.lastHitTime = simNow(room);

          // Apply knockback only if not immune
          if (canApplyKnockback(targetPlayer)) {
            const knockbackDirection = snowball.velocityX > 0 ? 1 : -1;

            targetPlayer.isSlapKnockback = false;
            targetPlayer.isBurstKnockback = false;
            targetPlayer.burstKnockbackStartTime = 0;

            targetPlayer.knockbackVelocity.x = knockbackDirection * 1.55;
            targetPlayer.movementVelocity = 0;

            setKnockbackImmunity(targetPlayer);
          }

          setPlayerTimeout(
            targetPlayer.id,
            () => {
              if (Math.abs(targetPlayer.knockbackVelocity.x) > 0.01) {
                targetPlayer.movementVelocity = targetPlayer.knockbackVelocity.x;
              }
              targetPlayer.knockbackVelocity.x = 0;
              targetPlayer.isHit = false;
              targetPlayer.isAlreadyHit = false;
              targetPlayer.isSlapKnockback = false;
              targetPlayer.isBurstKnockback = false;
              targetPlayer.burstKnockbackStartTime = 0;
            },
            300
          );

          return false; // Remove snowball after hit
        }
      }

      // Check collision with raw parrying opponent (snowball is blocked or reflected)
      if (opponent && opponent.isRawParrying && !snowball.hasHit) {
        const distance = sweptHorizDistance(snowballPrevX, snowball.x, opponent.x);
        const sizeMul = opponent.sizeMultiplier || 1;
        const horizThresh = Math.round(45 * 0.96) * sizeMul;
        const vertThresh = Math.round(27 * 0.96) * sizeMul;
        if (
          distance < horizThresh &&
          Math.abs(snowball.y - opponent.y) < vertThresh
        ) {
          // Parry resolves on a 64Hz collision tick that may fall between the
          // 32Hz broadcasts. Force an immediate broadcast so the destroyed/
          // reflected snowball reaches clients without waiting for the next
          // scheduled frame — keeps the impact crisp with no lingering ball.
          room.forceBroadcast = true;

          // Check if this is a perfect parry (within 100ms of parry start)
          const currentTime = simNow(room);
          const parryDuration = currentTime - opponent.rawParryStartTime;
          const isPerfectParry = parryDuration <= PERFECT_PARRY_WINDOW;
          
          // Find the snowball thrower
          const thrower = room.players.find(p => p.id === player.id);
          
          // Check if snowball was already reflected - if so, block it instead of reflecting again
          const canReflect = isPerfectParry && !snowball.reflectedByPerfectParry;
          
          // Set parry success state for the defending player
          // Refund parry stamina cost on any successful parry
          opponent.stamina = Math.min(100, opponent.stamina + RAW_PARRY_STAMINA_REFUND);

          // Perfect parries also refund balance — net defensive gain on a correct read
          let perfectParryBalanceGain = 0;
          if (isPerfectParry) {
            const balanceBefore = opponent.balance;
            opponent.balance = Math.min(BALANCE_MAX, opponent.balance + PERFECT_PARRY_BALANCE_REFUND);
            perfectParryBalanceGain = opponent.balance - balanceBefore;
          }

          if (canReflect) {
            // Perfect parry on non-reflected snowball: reflect it back!
            opponent.isRawParrying = true;
            opponent.isPerfectRawParrySuccess = true;
            opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, simNow(room) + PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK);
            // REFLECT THE SNOWBALL BACK - faster than original
            snowball.hasHit = false; // Reset hit flag so it can hit the thrower
            snowball.velocityX = -snowball.velocityX * 1.3; // Reverse direction and make it 30% faster
            snowball.reflectedByPerfectParry = true; // Mark as reflected to prevent infinite reflection
            // Emit screen shake for perfect parry (throttled)
            emitThrottledScreenShake(room, io, {
              intensity: 0.7,
              duration: 300,
            });
          } else {
            // Regular parry OR already-reflected snowball: block and destroy it
            snowball.hasHit = true;
            if (isPerfectParry) {
              opponent.isPerfectRawParrySuccess = true;
              opponent.isRawParrying = true;
              opponent.inputLockUntil = Math.max(opponent.inputLockUntil || 0, simNow(room) + PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK);
            } else {
              opponent.isRawParrySuccess = true;
              opponent.rawParryMinDurationMet = true;
            }
          }
          
          // Emit raw parry success event for visual effect and sound
          const parryingPlayerNumber = room.players.findIndex(p => p.id === opponent.id) + 1;
          io.in(room.id).emit("raw_parry_success", {
            attackerX: thrower ? thrower.x : snowball.x,
            parrierX: opponent.x,
            facing: thrower ? thrower.facing : -opponent.facing,
            isPerfect: isPerfectParry,
            timestamp: Date.now(),
            parryId: `${opponent.id}_snowball_parry_${Date.now()}`,
            playerNumber: parryingPlayerNumber,
            parrierId: opponent.id,
            balanceGain: perfectParryBalanceGain, // 0 for non-perfect; drives client balance gain anim
          });
          
          // Clear parry success state after duration
          if (canReflect) {
            // For perfect parry with reflection: clear the parry pose after reduced snowball lock
            setPlayerTimeout(
              opponent.id,
              () => {
                opponent.isRawParrying = false;
                opponent.isPerfectRawParrySuccess = false;
              },
              PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK,
              "perfectParryAnimationEnd"
            );
            
            // Return true to KEEP the snowball (it's been reflected)
            return true;
          } else if (isPerfectParry) {
            // Perfect parry but already reflected: treat like perfect parry block
            setPlayerTimeout(
              opponent.id,
              () => {
                opponent.isRawParrying = false;
                opponent.isPerfectRawParrySuccess = false;
              },
              PERFECT_PARRY_SNOWBALL_ANIMATION_LOCK,
              "perfectParryAnimationEnd"
            );
            
            // Return false to REMOVE the snowball (it was blocked)
            return false;
          } else {
            // For regular parry: clear success state after normal duration
            setPlayerTimeout(
              opponent.id,
              () => {
                opponent.isRawParrySuccess = false;
              },
              PARRY_SUCCESS_DURATION,
              "parrySuccess"
            );
            
            // Return false to REMOVE the snowball (it was blocked)
            return false;
          }
        }
      }

      return true; // Keep snowball
    });

    // Check if snowballs were removed and reset cooldown if no snowballs remain
    if (
      initialSnowballCount > player.snowballs.length &&
      player.snowballs.length === 0
    ) {
      player.snowballCooldown = false;
    }
  });

  // Handle pumo army updates
  [player1, player2].forEach((player) => {
    const currentTime = simNow(room);

    // Update pumo army positions and check for collisions
    player.pumoArmy = player.pumoArmy.filter((clone) => {
      // Check if clone has expired
      if (currentTime - clone.spawnTime >= clone.lifespan) {
        return false; // Remove expired clone
      }

      // Move clone horizontally (keep pre-move position for swept collision)
      const clonePrevX = clone.x;
      clone.x += clone.velocityX * delta * speedFactor;

      // Apply dohyo height logic with buffer zone for climbing
      const CLIMB_BUFFER = 55;
      const isOutsideDohyo = clone.x < (DOHYO_LEFT_BOUNDARY - CLIMB_BUFFER +40) || clone.x > (DOHYO_RIGHT_BOUNDARY + CLIMB_BUFFER + 30);
      const climbSpeed = DOHYO_FALL_SPEED;
      
      if (isOutsideDohyo) {
        const targetY = GROUND_LEVEL - DOHYO_FALL_DEPTH;
        if (clone.y > targetY) {
          clone.y = Math.max(targetY, clone.y - climbSpeed);
        } else if (clone.y < targetY) {
          clone.y = Math.min(targetY, clone.y + climbSpeed);
        }
      } else {
        const targetY = clone.targetY !== undefined ? clone.targetY : (GROUND_LEVEL + 5);
        if (clone.y < targetY) {
          clone.y = Math.min(targetY, clone.y + climbSpeed);
        } else if (clone.y > targetY) {
          clone.y = Math.max(targetY, clone.y - climbSpeed);
        }
      }

      // Check if clone is off-screen (extended range to allow full travel)
      if (clone.x < -150 || clone.x > 1250) {
        return false; // Remove off-screen clone
      }

      // Check collision with opponent
      const opponent = room.players.find((p) => p.id !== player.id);
      const isFlanker = clone.lane === 'top' || clone.lane === 'bottom';
      if (
        opponent &&
        !opponent.isDodging &&
        !opponent.isRawParrying &&
        !clone.hasHit &&
        (!isFlanker || opponent.isSidestepping)
      ) {
        const distance = sweptHorizDistance(clonePrevX, clone.x, opponent.x);
        const sizeMul = opponent.sizeMultiplier || 1;
        const horizThresh = Math.round(54 * 0.96) * sizeMul;
        const vertThresh = isFlanker ? 60 * sizeMul : Math.round(36 * 0.96) * sizeMul;
        if (
          distance < horizThresh &&
          Math.abs(clone.y - opponent.y) < vertThresh
        ) {
          // Clone should pass through any connected grab state.
          // Grab startup / whiff attempts are intentionally still vulnerable.
          const isOpponentInConnectedGrabState =
            opponent.isGrabbingMovement ||
            opponent.isGrabbing ||
            opponent.isBeingGrabbed ||
            opponent.isThrowing ||
            opponent.isBeingThrown ||
            opponent.isGrabTeching ||
            opponent.isGrabClashing ||
            opponent.isGrabPushing ||
            opponent.isBeingGrabPushed ||
            opponent.isEdgePushing ||
            opponent.isBeingEdgePushed ||
            opponent.isAttemptingPull ||
            opponent.isBeingPullReversaled ||
            opponent.isGrabSeparating ||
            opponent.isGrabBellyFlopping ||
            opponent.isBeingGrabBellyFlopped ||
            opponent.isGrabFrontalForceOut ||
            opponent.isBeingGrabFrontalForceOut;
          if (isOpponentInConnectedGrabState) {
            return true; // Keep clone in flight, don't register hit
          }

          // Check for thick blubber hit absorption
          const isOpponentGrabbingClone = opponent.isGrabStartup || opponent.isGrabbingMovement || opponent.isGrabbing;
          if (
            opponent.activePowerUp === POWER_UP_TYPES.THICK_BLUBBER &&
            ((opponent.isAttacking && opponent.attackType === "charged") || isOpponentGrabbingClone) &&
            !opponent.hitAbsorptionUsed
          ) {
            // Mark absorption as used for this charge session
            opponent.hitAbsorptionUsed = true;

            // Remove clone but don't hit the player
            clone.hasHit = true;

            // Emit absorption effect
            io.in(room.id).emit("thick_blubber_absorption", {
              playerId: opponent.id,
              x: opponent.x,
              y: opponent.y,
            });

            return false; // Remove clone after absorption
          }

          // Hit opponent normally
          clone.hasHit = true;
          
          // If opponent was grabbing someone, clear the grabbed player's state first
          if (opponent.isGrabbing && opponent.grabbedOpponent) {
            const grabbedPlayer = room.players.find(p => p.id === opponent.grabbedOpponent);
            if (grabbedPlayer) {
              grabbedPlayer.isBeingGrabbed = false;
            }
          }
          
          // CRITICAL: If opponent was throwing someone, clear the thrown player's state
          // This prevents isBeingThrown from getting stuck when thrower is interrupted
          if (opponent.isThrowing && opponent.throwOpponent) {
            const thrownPlayer = room.players.find(p => p.id === opponent.throwOpponent);
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
          
          // CRITICAL: Clear ALL action states before setting isHit
          clearAllActionStates(opponent);

          if (opponent.y > GROUND_LEVEL) {
            clearSidestepHitReturn(opponent);
            opponent.isHitFalling = true;
            opponent.hitFallStartTime = simNow(room);
            opponent.hitFallStartY = opponent.y;
          } else if (opponent.y < GROUND_LEVEL) {
            clearHitFall(opponent);
            const depthRatio = (GROUND_LEVEL - opponent.y) / 55;
            const duration = SIDESTEP_HIT_RETURN_MIN_MS + (SIDESTEP_HIT_RETURN_BASE_MS - SIDESTEP_HIT_RETURN_MIN_MS) * Math.min(depthRatio, 1);
            opponent.isSidestepHitReturn = true;
            opponent.sidestepHitReturnStartTime = simNow(room);
            opponent.sidestepHitReturnStartY = opponent.y;
            opponent.sidestepHitReturnDuration = duration;
          } else {
            opponent.y = GROUND_LEVEL;
          }

          opponent.isHit = true;
          opponent.lastHitType = "pumoClone";
          opponent.isAlreadyHit = true;
          opponent.lastHitTime = simNow(room);

          // Apply knockback only if not immune (lighter than normal slap)
          if (canApplyKnockback(opponent)) {
            const knockbackDirection = clone.velocityX > 0 ? 1 : -1;

            opponent.isSlapKnockback = false;
            opponent.isBurstKnockback = false;
            opponent.burstKnockbackStartTime = 0;

            opponent.knockbackVelocity.x = knockbackDirection * 1.6;
            opponent.movementVelocity = 0;

            setKnockbackImmunity(opponent);
          }

          setPlayerTimeout(
            opponent.id,
            () => {
              if (Math.abs(opponent.knockbackVelocity.x) > 0.01) {
                opponent.movementVelocity = opponent.knockbackVelocity.x;
              }
              opponent.knockbackVelocity.x = 0;
              opponent.isHit = false;
              opponent.isAlreadyHit = false;
              opponent.isSlapKnockback = false;
              opponent.isBurstKnockback = false;
              opponent.burstKnockbackStartTime = 0;
            },
            200
          );

          return false; // Remove clone after hit
        }
      }

      // Check collision with raw parrying opponent (clone is blocked but destroyed)
      // Flanker clones pass through — only the middle clone can be parried
      if (opponent && opponent.isRawParrying && !clone.hasHit && !isFlanker) {
        const distance = sweptHorizDistance(clonePrevX, clone.x, opponent.x);
        const sizeMul = opponent.sizeMultiplier || 1;
        const horizThresh = Math.round(54 * 0.96) * sizeMul;
        const vertThresh = Math.round(36 * 0.96) * sizeMul;
        if (
          distance < horizThresh &&
          Math.abs(clone.y - opponent.y) < vertThresh
        ) {
          // Clone is blocked - destroy it but don't apply knockback
          clone.hasHit = true;
          
          // Refund parry stamina cost on successful parry
          opponent.stamina = Math.min(100, opponent.stamina + RAW_PARRY_STAMINA_REFUND);
          // Trigger parry success animation and sound + allow early exit
          opponent.isRawParrySuccess = true;
          opponent.rawParryMinDurationMet = true;
          // Emit raw parry success event for visual effect and sound
          // Send both positions so client can calculate center
          const parryingPlayerNumber = room.players.findIndex(p => p.id === opponent.id) + 1;
          const spawner = room.players.find(p => p.id === player.id);
          io.in(room.id).emit("raw_parry_success", {
            attackerX: spawner ? spawner.x : clone.x,
            parrierX: opponent.x,
            facing: spawner ? spawner.facing : -opponent.facing, // Use attacker's facing for consistency with melee
            isPerfect: false,
            timestamp: Date.now(),
            parryId: `${opponent.id}_pumo_parry_${Date.now()}`,
            playerNumber: parryingPlayerNumber,
          });
          
          // Clear parry success state after duration
          setPlayerTimeout(
            opponent.id,
            () => {
              opponent.isRawParrySuccess = false;
            },
            PARRY_SUCCESS_DURATION,
            "parrySuccess"
          );
          
          return false; // Remove clone after being blocked
        }
      }

      return true; // Keep clone
    });

    // pumoArmyCooldown is cleared when a spawn animation finishes (socketHandlers / CPU AI),
    // allowing multiple army charges per round; charges are tracked on pumoArmySpawnsRemaining.
  });
}

module.exports = { updateProjectiles };
