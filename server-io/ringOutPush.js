// ============================================
// FORCE OUT (oshidashi) — ring-out by pushing past the rope
// ============================================
// Lifted verbatim out of grabActionSystem so the command-grab system and the
// legacy clinch can share one implementation. This is presentation-heavy but it
// is the win path for a Drive that reaches the tawara, so it outlives the clinch
// subgame it originally shipped with.
//
// No freeze and no throw hop: the live push pose is held and both fighters walk a
// short distance past the rope during the round-result callout.

const {
  RINGOUT_PUSH_DURATION_MS,
  RINGOUT_PUSH_DISTANCE,
  RINGOUT_PUSH_IDLE_DELAY_MS,
  RINGOUT_PUSH_SEPARATE_DELAY_MS,
  RINGOUT_PUSH_DEFEAT_DELAY_MS,
  GROUND_LEVEL,
} = require("./constants");

const { setPlayerTimeout, simNow } = require("./gameUtils");
const { handleWinCondition } = require("./gameFunctions");

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

function triggerRingOut(pusher, victim, room, io, rooms, direction) {
  const pushDir = direction || (pusher.x < victim.x ? 1 : -1);
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

module.exports = {
  triggerRingOut,
  clearRingOutPushPoseToIdle,
};
