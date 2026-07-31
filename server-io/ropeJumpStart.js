/**
 * Shared rope-jump initiation — human (socketHandlers) and CPU use the same path.
 * Keeps raw-target + landing-state init from drifting between call sites.
 */

const {
  ROPE_JUMP_STARTUP_MS,
  ROPE_JUMP_STAMINA_COST,
  ROPE_JUMP_CENTER_FRACTION,
} = require("./constants");
const { initRopeJumpLandingState } = require("./landingResolution");
const { ROPE_JUMP_LANDING_V2 } = require("./landingFlags");

/**
 * Begin rope-jump startup on `player`. Caller must have already validated
 * gates (boundary zone, stamina, locks, etc.).
 *
 * @param {object} player
 * @param {{
 *   now: number,
 *   jumpDirection: 1|-1,
 *   mapLeft: number,
 *   mapRight: number,
 *   facing?: 1|-1,
 *   useV2?: boolean,
 *   rawTargetX?: number,
 * }} opts
 * @returns {{ rawTargetX: number }}
 */
function startRopeJump(player, opts) {
  const {
    now,
    jumpDirection,
    mapLeft,
    mapRight,
    facing = jumpDirection >= 0 ? -1 : 1,
    useV2 = ROPE_JUMP_LANDING_V2,
  } = opts;

  const mapMidpoint = (mapLeft + mapRight) / 2;
  const rawTargetX =
    opts.rawTargetX != null
      ? opts.rawTargetX
      : Math.max(
          mapLeft,
          Math.min(
            player.x + (mapMidpoint - player.x) * ROPE_JUMP_CENTER_FRACTION,
            mapRight
          )
        );

  player.movementVelocity = 0;
  player.isStrafing = false;
  player.isPowerSliding = false;
  player.isBraking = false;

  player.facing = facing;
  player.isRopeJumping = true;
  player.ropeJumpPhase = "startup";
  player.ropeJumpStartTime = now;
  player.ropeJumpStartX = player.x;
  player.ropeJumpTargetX = rawTargetX;
  player.ropeJumpDirection = jumpDirection >= 0 ? 1 : -1;
  player.ropeJumpActiveStartTime = 0;
  player.ropeJumpLandingTime = 0;
  player.ropeJumpBufferedAttackRelease = 0;
  initRopeJumpLandingState(player, rawTargetX, !!useV2);
  player.currentAction = "ropeJump";
  player.actionLockUntil = now + ROPE_JUMP_STARTUP_MS;
  player.stamina = Math.max(0, player.stamina - ROPE_JUMP_STAMINA_COST);

  return { rawTargetX };
}

module.exports = {
  startRopeJump,
};
