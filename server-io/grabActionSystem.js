const {
  GRAB_ACTION_WINDOW,
  GRAB_PUSH_BURST_BASE, GRAB_PUSH_MOMENTUM_TRANSFER,
  GRAB_PUSH_DECAY_RATE, GRAB_PUSH_MIN_VELOCITY, GRAB_PUSH_MAX_DURATION,
  GRAB_PUSH_BACKWARD_GRACE,
  GRAB_PUSH_STAMINA_DRAIN_INTERVAL, GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL,
  GRAB_STAMINA_DRAIN_INTERVAL,
  GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER,
  PULL_REVERSAL_DISTANCE, PULL_REVERSAL_TWEEN_DURATION,
  PULL_REVERSAL_PULLED_LOCK, PULL_REVERSAL_PULLER_LOCK,
  RINGOUT_THROW_DURATION_MS,
  speedFactor,
} = require("./constants");

const {
  setPlayerTimeout,
  clearAllActionStates,
  triggerHitstop,
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("./gameUtils");

const { correctFacingAfterGrabOrThrow, executeDirectionalGrabBreak, executeGrabSeparation } = require("./grabMechanics");
const { activateBufferedInputAfterGrab, cleanupGrabStates, handleWinCondition } = require("./gameFunctions");

function updateGrabActions(player, room, io, delta, rooms) {
  // ============================================
  // NEW GRAB ACTION SYSTEM - Decision Window → Auto-Push / Pull / Throw
  // 1s decision window where both players hold still, then action phase
  // ============================================
  if (
    player.isGrabbing &&
    player.grabbedOpponent &&
    !player.isThrowing &&
    !player.isBeingThrown &&
    !player.isAttemptingGrabThrow &&  // Block during throw attempt
    !player.isAttemptingPull           // Block during pull attempt
  ) {
    const opponent = room.players.find(
      (p) => p.id === player.grabbedOpponent
    );
    if (opponent) {
      // Continuous stamina drain on GRABBER while grabbing
      if (!player.lastGrabStaminaDrainTime) {
        player.lastGrabStaminaDrainTime = player.grabStartTime;
      }
      const timeSinceLastDrain = Date.now() - player.lastGrabStaminaDrainTime;
      if (timeSinceLastDrain >= GRAB_STAMINA_DRAIN_INTERVAL) {
        player.stamina = Math.max(0, player.stamina - 1);
        player.lastGrabStaminaDrainTime = Date.now();
      }

      // Boundaries
      const leftBoundary = MAP_LEFT_BOUNDARY;
      const rightBoundary = MAP_RIGHT_BOUNDARY;

      // Keep opponent attached at fixed distance
      const baseDistance = Math.round(81 * 0.96);
      const distanceMultiplier = player.isAttemptingGrabThrow ? 1.15 : 1;
      const fixedDistance = baseDistance * distanceMultiplier * (opponent.sizeMultiplier || 1);

      // === IMMEDIATE PUSH (burst-with-decay, starts right after grab connects + hitstop) ===
      // Push is the DEFAULT action. Grabber can interrupt with pull (backward) or throw (W).
      if (player.isGrabPushing) {
        // Initialize push start time on first processing tick (after hitstop)
        if (!player.grabPushStartTime) {
          player.grabPushStartTime = Date.now();
          opponent.isBeingGrabPushed = true;
        }

        const pushElapsed = Date.now() - player.grabPushStartTime;
        const pushElapsedSec = pushElapsed / 1000;

        // Safety cap — force separation at max duration
        if (pushElapsed >= GRAB_PUSH_MAX_DURATION) {
          executeGrabSeparation(player, opponent, room, io);
          activateBufferedInputAfterGrab(player, rooms);
          activateBufferedInputAfterGrab(opponent, rooms);
          return;
        }

        // Calculate current push speed: burst with exponential decay
        // Initial speed = base burst + momentum transferred from approach velocity
        const initialPushSpeed = GRAB_PUSH_BURST_BASE + (player.grabApproachSpeed || 0) * GRAB_PUSH_MOMENTUM_TRANSFER;
        const currentPushSpeed = initialPushSpeed * Math.exp(-GRAB_PUSH_DECAY_RATE * pushElapsedSec);

        // End push when velocity decays below threshold
        // UNLESS pinned at boundary (let max duration + stamina drain handle that)
        if (currentPushSpeed < GRAB_PUSH_MIN_VELOCITY && pushElapsed > 200 && !player.isAtBoundaryDuringGrab) {
          executeGrabSeparation(player, opponent, room, io);
          activateBufferedInputAfterGrab(player, rooms);
          activateBufferedInputAfterGrab(opponent, rooms);
          return;
        }

        // === Check for PULL interrupt during push (backward input after grace period) ===
        if (pushElapsed >= GRAB_PUSH_BACKWARD_GRACE && !player.isAttemptingPull && !player.isAttemptingGrabThrow) {
          const backwardKey = player.facing === -1 ? 'a' : 'd';
          const forwardKey = player.facing === -1 ? 'd' : 'a';
          const isPressingBackward = player.keys[backwardKey] && !player.keys[forwardKey];

          if (isPressingBackward) {
            // Interrupt push → initiate pull reversal attempt
            player.isGrabPushing = false;
            player.isEdgePushing = false;
            player.isGrabWalking = false;
            opponent.isBeingGrabPushed = false;
            opponent.isBeingEdgePushed = false;
            opponent.lastGrabPushStaminaDrainTime = 0;

            // Reset opponent's counter state — they get a fresh read for each grab action
            opponent.grabCounterAttempted = false;
            opponent.grabCounterInput = null;

            player.isAttemptingPull = true;
            player.grabActionStartTime = Date.now();
            player.grabActionType = "pull";
            player.grabDurationPaused = true;
            player.grabDurationPausedAt = Date.now();
            player.actionLockUntil = Date.now() + GRAB_ACTION_WINDOW;

            setPlayerTimeout(
              player.id,
              () => {
                player.isAttemptingPull = false;
                player.grabDurationPaused = false;
                player.grabActionType = null;
                player.grabActionStartTime = 0;
                player.grabDecisionMade = false;
                player.grabPushEndTime = 0;

                const pullOpponent = room.players.find((p) => p.id !== player.id);
                if (player.isGrabBreakCountered || !pullOpponent || pullOpponent.isGrabBreaking || pullOpponent.isGrabBreakSeparating) {
                  return;
                }
                if (!player.isGrabbing) {
                  return;
                }

                // Opponent did NOT counter — execute pull reversal!
                const pullDirection = pullOpponent.x < player.x ? 1 : -1;
                // Don't clamp targetX — let it overshoot so the tween handler detects boundary
                const targetX = player.x + pullDirection * PULL_REVERSAL_DISTANCE;

                cleanupGrabStates(player, pullOpponent);
                pullOpponent.isBeingPullReversaled = true;
                pullOpponent.pullReversalPullerId = player.id; // Track who pulled us

                pullOpponent.isGrabBreakSeparating = true;
                pullOpponent.grabBreakSepStartTime = Date.now();
                pullOpponent.grabBreakSepDuration = PULL_REVERSAL_TWEEN_DURATION;
                pullOpponent.grabBreakStartX = pullOpponent.x;
                pullOpponent.grabBreakTargetX = targetX;

                pullOpponent.movementVelocity = 0;
                player.movementVelocity = 0;
                pullOpponent.isStrafing = false;
                player.isStrafing = false;

                // Lock both players equally (cleared early when tween ends or boundary hit)
                const pulledLockUntil = Date.now() + PULL_REVERSAL_PULLED_LOCK;
                pullOpponent.inputLockUntil = Math.max(pullOpponent.inputLockUntil || 0, pulledLockUntil);
                const pullerLockUntil = Date.now() + PULL_REVERSAL_PULLER_LOCK;
                player.inputLockUntil = Math.max(player.inputLockUntil || 0, pullerLockUntil);

                correctFacingAfterGrabOrThrow(player, pullOpponent);

                player.grabCooldown = true;
                setPlayerTimeout(player.id, () => { player.grabCooldown = false; }, 300, "pullReversalCooldown");

                io.in(room.id).emit("pull_reversal", {
                  grabberId: player.id,
                  opponentId: pullOpponent.id,
                  grabberX: player.x,
                  targetX: targetX,
                });
              },
              GRAB_ACTION_WINDOW
            );

            // Skip push processing this tick (pull takes over)
            player.movementVelocity = 0;
            return;
          }
        }
        // W (throw) interrupt is handled in the throw input section — allowed during push now.

        // === Push direction and movement ===
        const pushDirection = player.facing === -1 ? 1 : -1;

        // Stamina drain on pushed opponent (faster at edge)
        if (!opponent.lastGrabPushStaminaDrainTime) {
          opponent.lastGrabPushStaminaDrainTime = Date.now();
        }
        const drainInterval = player.isAtBoundaryDuringGrab
          ? GRAB_PUSH_EDGE_STAMINA_DRAIN_INTERVAL
          : GRAB_PUSH_STAMINA_DRAIN_INTERVAL;
        const timeSinceOpponentDrain = Date.now() - opponent.lastGrabPushStaminaDrainTime;
        if (timeSinceOpponentDrain >= drainInterval) {
          opponent.stamina = Math.max(0, opponent.stamina - 1);
          opponent.lastGrabPushStaminaDrainTime = Date.now();
        }

        // Apply push movement with current decaying speed
        const pushDelta = pushDirection * delta * speedFactor * currentPushSpeed;
        let newX = player.x + pushDelta;

        // Calculate where opponent would be
        const pushFixedDistance = baseDistance * (opponent.sizeMultiplier || 1);
        let newOpponentX = player.facing === 1
          ? newX - pushFixedDistance
          : newX + pushFixedDistance;

        // === BOUNDARY STAMINA GATING ===
        const opponentAtLeftBoundary = newOpponentX <= leftBoundary;
        const opponentAtRightBoundary = newOpponentX >= rightBoundary;

        if ((opponentAtLeftBoundary || opponentAtRightBoundary) && !room.gameOver) {
          if (opponent.stamina <= 0) {
            // Opponent has no stamina — ring-out sequence
            if (player.isAtBoundaryDuringGrab) {
              player.isGrabBellyFlopping = true;
              opponent.isBeingGrabBellyFlopped = true;
            } else {
              player.isGrabFrontalForceOut = true;
              opponent.isBeingGrabFrontalForceOut = true;
            }

            player.isRingOutFreezeActive = true;
            player.ringOutFreezeEndTime = Date.now() + 200;
            player.ringOutThrowDirection = opponentAtLeftBoundary ? -1 : 1;
            player.pendingRingOutThrowTarget = opponent.id;

            setPlayerTimeout(
              player.id,
              () => {
                const currentRoom = rooms.find((r) => r.id === room.id);
                if (!currentRoom) return;
                const grabberRef = currentRoom.players.find((p) => p.id === player.id);
                const grabbedRef = currentRoom.players.find((p) => p.id === opponent.id);
                if (!grabberRef || !grabbedRef) return;

                grabberRef.isRingOutFreezeActive = false;
                grabberRef.isGrabbing = false;
                grabberRef.grabbedOpponent = null;
                grabberRef.isGrabFrontalForceOut = false;
                grabberRef.isGrabBellyFlopping = false;
                grabberRef.isGrabPushing = false;
                grabberRef.isEdgePushing = false;
                grabberRef.isGrabWalking = false;
                grabbedRef.isBeingGrabbed = false;
                grabbedRef.isBeingGrabFrontalForceOut = false;
                grabbedRef.isBeingGrabBellyFlopped = false;
                grabbedRef.isBeingGrabPushed = false;
                grabbedRef.isBeingEdgePushed = false;

                grabberRef.isThrowing = true;
                grabberRef.throwStartTime = Date.now();
                grabberRef.throwEndTime = Date.now() + RINGOUT_THROW_DURATION_MS;
                grabberRef.throwOpponent = grabbedRef.id;

                clearAllActionStates(grabbedRef);
                grabbedRef.isBeingThrown = true;

                grabberRef.throwingFacingDirection = grabberRef.ringOutThrowDirection || 1;
                grabbedRef.beingThrownFacingDirection = grabbedRef.facing;

                grabberRef.isRingOutThrowCutscene = true;
                grabberRef.ringOutThrowDistance = 5;
                grabberRef.ringOutThrowDirection = null;
                grabberRef.pendingRingOutThrowTarget = null;
              },
              200,
              "ringOutFreezeDelay"
            );

            handleWinCondition(room, opponent, player, io);
            opponent.knockbackVelocity = { ...opponent.knockbackVelocity };
          } else {
            // Opponent has stamina — PIN at boundary
            player.isAtBoundaryDuringGrab = true;
            player.isEdgePushing = true;
            opponent.isBeingEdgePushed = true;

            if (opponentAtLeftBoundary) {
              newOpponentX = leftBoundary;
            } else {
              newOpponentX = rightBoundary;
            }

            newX = player.facing === 1
              ? newOpponentX + pushFixedDistance
              : newOpponentX - pushFixedDistance;

            player.x = newX;
            opponent.x = newOpponentX;
          }
        } else {
          // Not at boundary — normal push movement
          player.isAtBoundaryDuringGrab = false;
          player.isEdgePushing = false;
          opponent.isBeingEdgePushed = false;
          newX = Math.max(leftBoundary, Math.min(newX, rightBoundary));
          player.x = newX;

          opponent.x = player.facing === 1
            ? player.x - pushFixedDistance
            : player.x + pushFixedDistance;
        }

        // Update opponent facing
        if (!opponent.atTheRopesFacingDirection) {
          opponent.facing = -player.facing;
        }
      }
      // === SAFETY: Not pushing (shouldn't normally happen — push starts at grab connect) ===
      else if (!player.isGrabPushing) {
        opponent.x = player.facing === 1
          ? player.x - fixedDistance
          : player.x + fixedDistance;
        if (!opponent.atTheRopesFacingDirection) {
          opponent.facing = -player.facing;
        }
      }

      // Zero grabber movement velocity during grab
      player.movementVelocity = 0;
    }
  } else if (
    player.isAttemptingGrabThrow &&
    player.isGrabbing &&
    player.grabbedOpponent
  ) {
    // Handle throw attempt state - maintain opponent position with slightly increased separation
    const opponent = room.players.find(
      (p) => p.id === player.grabbedOpponent
    );
    if (opponent) {
      const baseDistance = Math.round(81 * 0.96);
      const fixedDistance = baseDistance * 1.15 * (opponent.sizeMultiplier || 1);
      opponent.x =
        player.facing === 1
          ? player.x - fixedDistance
          : player.x + fixedDistance;
      if (!opponent.atTheRopesFacingDirection) {
        opponent.facing = -player.facing;
      }

      // FIRST-INPUT-COMMITS counter system for throw
      // The grabbed player must commit to one directional input.
      // Correct input (S) = break. Wrong input (A or D) = locked out.
      if (!opponent.grabCounterAttempted && !opponent.isGrabBreaking && !opponent.isCounterGrabbed) {
        // Detect any directional counter input (S, A, or D)
        const pressedS = opponent.keys.s;
        const pressedA = opponent.keys.a;
        const pressedD = opponent.keys.d;
        if (pressedS || pressedA || pressedD) {
          opponent.grabCounterAttempted = true;
          // Lock in whichever key was pressed first (priority: S > A > D is arbitrary, 
          // but in practice only one should be intentional)
          opponent.grabCounterInput = pressedS ? 's' : (pressedA ? 'a' : 'd');
          
          if (opponent.grabCounterInput === 's') {
            // Correct counter — break the throw!
            executeDirectionalGrabBreak(player, opponent, room, io, triggerHitstop);
            return;
          }
          // Wrong input — locked out, throw will succeed when window ends
        }
      }
    }
  } else if (
    player.isAttemptingPull &&
    player.isGrabbing &&
    player.grabbedOpponent
  ) {
    // Handle pull attempt state - maintain opponent position with increased gap
    const opponent = room.players.find(
      (p) => p.id === player.grabbedOpponent
    );
    if (opponent) {
      const baseDistance = Math.round(81 * 0.96);
      const fixedDistance = baseDistance * GRAB_PULL_ATTEMPT_DISTANCE_MULTIPLIER * (opponent.sizeMultiplier || 1);
      opponent.x =
        player.facing === 1
          ? player.x - fixedDistance
          : player.x + fixedDistance;
      if (!opponent.atTheRopesFacingDirection) {
        opponent.facing = -player.facing;
      }

      // FIRST-INPUT-COMMITS counter system for pull
      // The correct counter is the direction matching the pull (opposite of grabber's backward).
      // Wrong input = locked out.
      const counterKey = player.facing === -1 ? 'd' : 'a';
      if (!opponent.grabCounterAttempted && !opponent.isGrabBreaking && !opponent.isCounterGrabbed) {
        const pressedS = opponent.keys.s;
        const pressedA = opponent.keys.a;
        const pressedD = opponent.keys.d;
        if (pressedS || pressedA || pressedD) {
          opponent.grabCounterAttempted = true;
          opponent.grabCounterInput = pressedS ? 's' : (pressedA ? 'a' : 'd');
          
          if (opponent.grabCounterInput === counterKey) {
            // Correct counter — break the pull!
            executeDirectionalGrabBreak(player, opponent, room, io, triggerHitstop);
            return;
          }
          // Wrong input — locked out, pull will succeed when window ends
        }
      }
    }
  } else if (player.isGrabbing && !player.grabbedOpponent) {
    const grabDuration = Date.now() - player.grabStartTime;
    if (grabDuration >= 500) {
      player.isGrabbing = false;
      // NOTE: Charging restart is handled by continuous mouse1 check below
    }
  }
}

module.exports = { updateGrabActions };
