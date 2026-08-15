/**
 * No-slam slide-jump land-on-body settle.
 *
 * Flight stays pass-through. On a clean land into a standing body, do not dump
 * the 130px pushbox in one tick. Ice speed is the collision; settle only eases
 * the leftover overlap (≤18px/tick, side from actual centers).
 *
 * Not a combat hit. Not a plant. Not the rope-jump vault planner.
 * Episode lives on the jumper so it outlasts slideJumpPhase (continue-slide
 * landDone is immediate).
 */

const {
  LANDING_SETTLE_MAX_PX_PER_TICK,
  LANDING_SETTLE_OVERLAP_EPS_PX,
  CENTER_COINCIDENCE_EPS_PX,
} = require("./landingResolution");
const { getMinimumCenterDistance } = require("./pushboxGeometry");
const { SLIDE_JUMP_LAND_SETTLE_MS } = require("./constants");

const DEAD_ON_CENTER_FRAC = 1 / 3;
const SPEED_EPS = 0.15;

function clearSlideJumpLandSettle(player) {
  if (!player) return;
  player.slideJumpLandSettleActive = false;
  player.slideJumpLandSettleUntil = 0;
  player.slideJumpLandSettleJumperIsLeft = null;
  player.slideJumpLandSettleTravelDir = 0;
  player.slideJumpLandSettleCase = null;
}

function travelDirOf(player) {
  const v = player?.movementVelocity || 0;
  if (v > 1e-6) return 1;
  if (v < -1e-6) return -1;
  const h = player?.slideJumpVelocityX || 0;
  if (h > 1e-6) return 1;
  if (h < -1e-6) return -1;
  if (player?.iceSlideDir) return player.iceSlideDir > 0 ? 1 : -1;
  if (player?.facing === -1) return 1;
  if (player?.facing === 1) return -1;
  return 1;
}

function overlapBetween(jumper, opponent) {
  const minDist = getMinimumCenterDistance(
    jumper?.sizeMultiplier,
    opponent?.sizeMultiplier
  );
  return Math.max(0, minDist - Math.abs((jumper?.x || 0) - (opponent?.x || 0)));
}

function classifyLandSettleCase(jumper, opponent, travelDir) {
  const minDist = getMinimumCenterDistance(
    jumper.sizeMultiplier,
    opponent.sizeMultiplier
  );
  const dist = Math.abs(jumper.x - opponent.x);
  if (dist <= CENTER_COINCIDENCE_EPS_PX || dist <= minDist * DEAD_ON_CENTER_FRAC) {
    return "dead";
  }
  const jumperIsLeft = jumper.x < opponent.x;
  const onFarSide = travelDir > 0 ? !jumperIsLeft : jumperIsLeft;
  return onFarSide ? "far" : "near";
}

function beginSlideJumpLandSettle(jumper, opponent, now) {
  if (!jumper || !opponent) return null;
  const overlap = overlapBetween(jumper, opponent);
  if (overlap <= LANDING_SETTLE_OVERLAP_EPS_PX) return null;

  const travelDir = travelDirOf(jumper);
  const hasSpeed = Math.abs(jumper.movementVelocity || 0) > SPEED_EPS;
  const coincident =
    Math.abs(jumper.x - opponent.x) <= CENTER_COINCIDENCE_EPS_PX;
  // Speed land: lock the far shoulder so a pocket jump finishes through
  // instead of bouncing off the near side like a wall.
  const jumperIsLeft = hasSpeed
    ? travelDir < 0
    : coincident
      ? travelDir < 0
      : jumper.x < opponent.x;
  const settleCase = hasSpeed
    ? "cross"
    : classifyLandSettleCase(jumper, opponent, travelDir);

  jumper.slideJumpLandSettleActive = true;
  jumper.slideJumpLandSettleUntil = (now || 0) + SLIDE_JUMP_LAND_SETTLE_MS;
  jumper.slideJumpLandSettleJumperIsLeft = jumperIsLeft;
  jumper.slideJumpLandSettleTravelDir = travelDir;
  jumper.slideJumpLandSettleCase = settleCase;
  return { overlap, settleCase, jumperIsLeft, travelDir };
}

function isSlideJumpLandSettleActive(player, now = 0) {
  if (!player?.slideJumpLandSettleActive) return false;
  if (now >= (player.slideJumpLandSettleUntil || 0)) {
    clearSlideJumpLandSettle(player);
    return false;
  }
  return true;
}

function pickSlideJumpLandSettleJumper(player1, player2, now) {
  const a = isSlideJumpLandSettleActive(player1, now);
  const b = isSlideJumpLandSettleActive(player2, now);
  if (a && b) return "both";
  if (a) return player1;
  if (b) return player2;
  return null;
}

function resolveSlideJumpLandSettleOrdering(player1, player2, jumper) {
  const opponent = jumper === player1 ? player2 : player1;
  const dist = Math.abs(jumper.x - opponent.x);
  const travelDir = jumper.slideJumpLandSettleTravelDir || travelDirOf(jumper);
  const intendedLeft = travelDir < 0;
  let jumperIsLeft;

  if (jumper.slideJumpLandSettleCase === "cross") {
    const actualLeft = jumper.x < opponent.x;
    if (dist > CENTER_COINCIDENCE_EPS_PX && actualLeft === intendedLeft) {
      jumper.slideJumpLandSettleJumperIsLeft = actualLeft;
      jumper.slideJumpLandSettleCase = "far";
      jumperIsLeft = actualLeft;
    } else {
      jumperIsLeft = jumper.slideJumpLandSettleJumperIsLeft;
      if (jumperIsLeft == null) jumperIsLeft = intendedLeft;
    }
  } else if (dist <= CENTER_COINCIDENCE_EPS_PX) {
    jumperIsLeft = jumper.slideJumpLandSettleJumperIsLeft;
    if (jumperIsLeft == null) jumperIsLeft = intendedLeft;
  } else {
    jumperIsLeft = jumper.x < opponent.x;
    jumper.slideJumpLandSettleJumperIsLeft = jumperIsLeft;
    jumper.slideJumpLandSettleCase = classifyLandSettleCase(
      jumper,
      opponent,
      travelDir
    );
  }
  return {
    p1IsLeft: jumper === player1 ? jumperIsLeft : !jumperIsLeft,
    jumperIsLeft,
  };
}

function slideJumpLandSettleShares(jumper) {
  const hasSpeed = Math.abs(jumper?.movementVelocity || 0) > SPEED_EPS;
  const settleCase = jumper?.slideJumpLandSettleCase;
  if (settleCase === "cross") return { jumperShare: 0.7, opponentShare: 0.3 };
  if (settleCase === "near") return { jumperShare: 0.25, opponentShare: 0.75 };
  if (settleCase === "far") return { jumperShare: 0.8, opponentShare: 0.2 };
  if (hasSpeed) return { jumperShare: 0.65, opponentShare: 0.35 };
  return { jumperShare: 0.5, opponentShare: 0.5 };
}

function computeSlideJumpLandSettleCorrectionPx(overlap) {
  if (!(overlap > LANDING_SETTLE_OVERLAP_EPS_PX)) return 0;
  return Math.min(overlap, LANDING_SETTLE_MAX_PX_PER_TICK);
}

function releaseSlideJumpLandSettleIfClear(player, opponent, now) {
  if (!isSlideJumpLandSettleActive(player, now)) return false;
  if (overlapBetween(player, opponent) <= LANDING_SETTLE_OVERLAP_EPS_PX) {
    clearSlideJumpLandSettle(player);
    return true;
  }
  return false;
}

module.exports = {
  SLIDE_JUMP_LAND_SETTLE_MS,
  LANDING_SETTLE_MAX_PX_PER_TICK,
  LANDING_SETTLE_OVERLAP_EPS_PX,
  clearSlideJumpLandSettle,
  beginSlideJumpLandSettle,
  isSlideJumpLandSettleActive,
  pickSlideJumpLandSettleJumper,
  resolveSlideJumpLandSettleOrdering,
  slideJumpLandSettleShares,
  computeSlideJumpLandSettleCorrectionPx,
  releaseSlideJumpLandSettleIfClear,
  travelDirOf,
  classifyLandSettleCase,
  overlapBetween,
};
