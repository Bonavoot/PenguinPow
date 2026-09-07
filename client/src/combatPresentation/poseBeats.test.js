/**
 * Pose beats — authored, time-boxed pose holds that replace idle only.
 * Run: node --no-warnings --loader ./scripts/extResolve.mjs --test src/combatPresentation/poseBeats.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  POSE_BEAT,
  POSE_BEAT_TIMING,
  createPoseBeats,
  armPoseBeat,
  clearPoseBeats,
  isPoseBeatActive,
  resolvePoseBeat,
  poseBeatNeedsTick,
  shouldArmPostHitSettle,
  shouldArmSlideSlapPlant,
} from "./poseBeats.js";
import { resolveFighterDisplaySprite } from "./struckLimbHold.js";

const IDLE = "pumo-idle.png";
const RECOVERING = "recovering.png";
const READY = "palm-thrust-startup.png";
const WADDLE = "pumo-waddle.png";
const HIT = "hit.png";

describe("poseBeats — arming and expiry", () => {
  it("arms a beat with a fixed deadline and reports it active until then", () => {
    const b = createPoseBeats();
    assert.equal(
      armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 1000, POSE_BEAT_TIMING.POST_HIT_SETTLE_MS),
      true
    );
    assert.equal(isPoseBeatActive(b, 1000), true);
    assert.equal(isPoseBeatActive(b, 1000 + POSE_BEAT_TIMING.POST_HIT_SETTLE_MS - 1), true);
    assert.equal(isPoseBeatActive(b, 1000 + POSE_BEAT_TIMING.POST_HIT_SETTLE_MS), false);
  });

  it("refuses to arm without a sprite or a positive duration", () => {
    const b = createPoseBeats();
    assert.equal(armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, null, 0, 100), false);
    assert.equal(armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 0), false);
    assert.equal(isPoseBeatActive(b, 0), false);
  });

  it("a newer beat replaces an older one", () => {
    const b = createPoseBeats();
    armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 100);
    armPoseBeat(b, POSE_BEAT.SLIDE_SLAP_PLANT, READY, 50, 80);
    assert.equal(b.kind, POSE_BEAT.SLIDE_SLAP_PLANT);
    assert.equal(resolvePoseBeat(b, 60, IDLE, IDLE), READY);
  });

  it("clear records why the beat ended", () => {
    const b = createPoseBeats();
    armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 100);
    clearPoseBeats(b, "round_reset");
    assert.equal(b.kind, null);
    assert.equal(b.endedBy, "round_reset");
  });
});

describe("poseBeats — resolution contract (replaces idle only)", () => {
  it("draws the beat where idle would draw, for exactly the authored window", () => {
    const b = createPoseBeats();
    armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 100);
    assert.equal(resolvePoseBeat(b, 0, IDLE, IDLE), RECOVERING);
    assert.equal(resolvePoseBeat(b, 99, IDLE, IDLE), RECOVERING);
    assert.equal(resolvePoseBeat(b, 100, IDLE, IDLE), null);
    assert.equal(b.endedBy, "expired");
  });

  it("any other body owner CANCELS the beat — it never resumes", () => {
    const b = createPoseBeats();
    armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 100);
    // Player strafes on the first free frame → waddle owns the body.
    assert.equal(resolvePoseBeat(b, 16, WADDLE, IDLE), null);
    assert.equal(b.endedBy, "owned");
    // Back to idle 20 ms later: the beat must NOT come back.
    assert.equal(resolvePoseBeat(b, 36, IDLE, IDLE), null);
    assert.equal(isPoseBeatActive(b, 36), false);
  });

  it("an explicit bodyOwned signal cancels even when the sprite is idle", () => {
    const b = createPoseBeats();
    armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 100);
    assert.equal(resolvePoseBeat(b, 10, IDLE, IDLE, true), null);
    assert.equal(b.endedBy, "owned");
  });

  it("a fresh hit during the settle hands the body straight to the hit sprite", () => {
    const b = createPoseBeats();
    armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 100);
    assert.equal(resolvePoseBeat(b, 30, HIT, IDLE), null);
    assert.equal(b.kind, null);
  });

  it("needsTick fires only on the frame the shown beat expires", () => {
    const b = createPoseBeats();
    armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 100);
    assert.equal(poseBeatNeedsTick(b, 50, true), false);
    assert.equal(poseBeatNeedsTick(b, 100, true), true);
    assert.equal(poseBeatNeedsTick(b, 100, false), false);
  });

  it("composes with the display-sprite precedence: struck-limb hold still wins", () => {
    const b = createPoseBeats();
    armPoseBeat(b, POSE_BEAT.POST_HIT_SETTLE, RECOVERING, 0, 100);
    const beatSrc = resolvePoseBeat(b, 10, IDLE, IDLE);
    assert.equal(
      resolveFighterDisplaySprite({
        struckLimbHoldSrc: "slap1Hit.png",
        inDashWindup: false,
        justLandedFromDodge: false,
        rawSpriteSrc: IDLE,
        idleSrc: IDLE,
        recoveringSrc: RECOVERING,
        dodgeLandSrc: "sliding.png",
        poseBeatSrc: beatSrc,
      }),
      "slap1Hit.png"
    );
    assert.equal(
      resolveFighterDisplaySprite({
        struckLimbHoldSrc: null,
        inDashWindup: false,
        justLandedFromDodge: false,
        rawSpriteSrc: IDLE,
        idleSrc: IDLE,
        recoveringSrc: RECOVERING,
        dodgeLandSrc: "sliding.png",
        poseBeatSrc: beatSrc,
      }),
      RECOVERING
    );
  });

  it("does not override the tap-dodge land squat", () => {
    assert.equal(
      resolveFighterDisplaySprite({
        struckLimbHoldSrc: null,
        inDashWindup: false,
        justLandedFromDodge: true,
        rawSpriteSrc: IDLE,
        idleSrc: IDLE,
        recoveringSrc: RECOVERING,
        dodgeLandSrc: "sliding.png",
        poseBeatSrc: RECOVERING,
      }),
      "sliding.png"
    );
  });
});

describe("poseBeats — POST_HIT_SETTLE edge rule", () => {
  const base = { wasHit: true, isHit: false };
  it("arms on the grounded isHit falling edge", () => {
    assert.equal(shouldArmPostHitSettle(base), true);
  });
  it("does not arm while still hit, or on a rising edge", () => {
    assert.equal(shouldArmPostHitSettle({ wasHit: true, isHit: true }), false);
    assert.equal(shouldArmPostHitSettle({ wasHit: false, isHit: false }), false);
    assert.equal(shouldArmPostHitSettle({ wasHit: false, isHit: true }), false);
  });
  it("air victims keep their own landing resolution", () => {
    assert.equal(shouldArmPostHitSettle({ ...base, isHitFalling: true }), false);
    assert.equal(shouldArmPostHitSettle({ ...base, grounded: false }), false);
  });
  it("ring-out, stun, grab, throw, ropes, death and ready own the body", () => {
    assert.equal(shouldArmPostHitSettle({ ...base, isRingOutLoser: true }), false);
    assert.equal(shouldArmPostHitSettle({ ...base, isRawParryStun: true }), false);
    assert.equal(shouldArmPostHitSettle({ ...base, isBeingGrabbed: true }), false);
    assert.equal(shouldArmPostHitSettle({ ...base, isBeingThrown: true }), false);
    assert.equal(shouldArmPostHitSettle({ ...base, isAtTheRopes: true }), false);
    assert.equal(shouldArmPostHitSettle({ ...base, isDead: true }), false);
    assert.equal(shouldArmPostHitSettle({ ...base, isReady: true }), false);
  });
});

describe("poseBeats — SLIDE_SLAP_PLANT edge rule", () => {
  it("arms when a connected slide-armed slap cycle ends", () => {
    assert.equal(
      shouldArmSlideSlapPlant({
        wasSlapAttack: true,
        isSlapAttack: false,
        wasSlideSlapArmed: true,
        bumpConnected: true,
      }),
      true
    );
  });
  it("a whiffed bump, a pocket slap, or a mid-cycle render never arms", () => {
    assert.equal(
      shouldArmSlideSlapPlant({ wasSlapAttack: true, isSlapAttack: false, wasSlideSlapArmed: true, bumpConnected: false }),
      false
    );
    assert.equal(
      shouldArmSlideSlapPlant({ wasSlapAttack: true, isSlapAttack: false, wasSlideSlapArmed: false, bumpConnected: true }),
      false
    );
    assert.equal(
      shouldArmSlideSlapPlant({ wasSlapAttack: true, isSlapAttack: true, wasSlideSlapArmed: true, bumpConnected: true }),
      false
    );
  });
});
