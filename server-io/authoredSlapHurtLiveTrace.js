"use strict";

/**
 * Phase 4A — development-only per-tick live contact trace.
 * Default OFF. Not networked. Enable:
 *   AUTHORED_SLAP_HURT_LIVE_TRACE=1
 * or setAuthoredSlapHurtLiveTraceForTests(true)
 */

const {
  isAuthoredSlapHurtboxV1Enabled,
} = require("./authoredSlapHurtboxFlags");
const {
  resolveSlapLimbExposure,
  isPhase4aSlapPoseAuthorityReady,
  getVictimSlapLimbAabb,
  buildAttackerTipProbeAabb,
  isSlapTipLive,
} = require("./authoredSlapHurtTarget");
const { aabbsOverlap } = require("./combatGeometry");

function parseLiveTraceFlag(raw) {
  if (raw === undefined || raw === null || raw === "") return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

const LIVE_TRACE_ENV = parseLiveTraceFlag(
  typeof process !== "undefined" && process.env
    ? process.env.AUTHORED_SLAP_HURT_LIVE_TRACE
    : undefined
);

let _override = null;
const TRACE_CAP = 128;
const _trace = [];
let _seq = 0;

function setAuthoredSlapHurtLiveTraceForTests(value) {
  _override = value == null ? null : !!value;
}

function isAuthoredSlapHurtLiveTraceEnabled() {
  if (_override != null) return _override;
  return LIVE_TRACE_ENV;
}

function clearAuthoredSlapHurtLiveTrace() {
  _trace.length = 0;
  _seq = 0;
}

function getAuthoredSlapHurtLiveTrace() {
  return _trace.slice();
}

/**
 * Capture one attacker→victim tick snapshot around checkCollision slap resolve.
 */
function noteAuthoredSlapHurtLiveTrace(entry) {
  if (!isAuthoredSlapHurtLiveTraceEnabled()) return null;
  if (!isAuthoredSlapHurtboxV1Enabled(entry && entry.envValue) && !entry.force) {
    // Allow OFF-flag miss proofs to still record when force:true
    if (!entry.force) return null;
  }
  const row = {
    seq: ++_seq,
    simTime: entry.simTime != null ? entry.simTime : null,
    attackerId: entry.attackerId || null,
    victimId: entry.victimId || null,
    attackerAttackType: entry.attackerAttackType || null,
    attackerPhase: entry.attackerPhase || null,
    victimActionType: entry.victimActionType || null,
    victimPhase: entry.victimPhase || null,
    victimSlapFlags: entry.victimSlapFlags || null,
    victimAttackStartTime: entry.victimAttackStartTime != null ? entry.victimAttackStartTime : null,
    victimSlapActiveEndTime:
      entry.victimSlapActiveEndTime != null ? entry.victimSlapActiveEndTime : null,
    victimSlapFacingDirection:
      entry.victimSlapFacingDirection != null ? entry.victimSlapFacingDirection : null,
    roots: entry.roots || null,
    sizes: entry.sizes || null,
    poseKey: entry.poseKey || null,
    poseReady: entry.poseReady == null ? null : !!entry.poseReady,
    limbAabb: entry.limbAabb || null,
    tipProbe: entry.tipProbe || null,
    tipLimbOverlap: entry.tipLimbOverlap == null ? null : !!entry.tipLimbOverlap,
    bodyEligible: entry.bodyEligible == null ? null : !!entry.bodyEligible,
    limbOnlyConnect: entry.limbOnlyConnect == null ? null : !!entry.limbOnlyConnect,
    selectedRegion: entry.selectedRegion || null,
    contactPoint: entry.contactPoint || null,
    stamped: entry.stamped == null ? null : !!entry.stamped,
    processHitCalled: entry.processHitCalled == null ? null : !!entry.processHitCalled,
    skipOpenHitGrace: entry.skipOpenHitGrace == null ? null : !!entry.skipOpenHitGrace,
    openHitDeferred: entry.openHitDeferred == null ? null : !!entry.openHitDeferred,
    damageBefore: entry.damageBefore != null ? entry.damageBefore : null,
    damageAfter: entry.damageAfter != null ? entry.damageAfter : null,
    hitstopBefore: entry.hitstopBefore != null ? entry.hitstopBefore : null,
    hitstopAfter: entry.hitstopAfter != null ? entry.hitstopAfter : null,
    attackerAttackingBefore: entry.attackerAttackingBefore == null ? null : !!entry.attackerAttackingBefore,
    attackerAttackingAfter: entry.attackerAttackingAfter == null ? null : !!entry.attackerAttackingAfter,
    victimAttackingBefore: entry.victimAttackingBefore == null ? null : !!entry.victimAttackingBefore,
    victimAttackingAfter: entry.victimAttackingAfter == null ? null : !!entry.victimAttackingAfter,
    victimIsHitAfter: entry.victimIsHitAfter == null ? null : !!entry.victimIsHitAfter,
    categoryHint: entry.categoryHint || null,
    slapVsSlapDecision: entry.slapVsSlapDecision || null,
  };
  _trace.push(row);
  if (_trace.length > TRACE_CAP) _trace.shift();
  return row;
}

function captureSlapPairSnapshot(attacker, victim, simTime) {
  const exposure = resolveSlapLimbExposure(victim, simTime);
  const poseReady = isPhase4aSlapPoseAuthorityReady(exposure.poseKey);
  const limb = getVictimSlapLimbAabb(victim, simTime);
  const tip = buildAttackerTipProbeAabb(attacker, "slap");
  const tipLimbOverlap = !!(limb && tip && aabbsOverlap(tip.aabb, limb.aabb));
  return {
    attackerPhase: attacker.isInStartupFrames
      ? "startup"
      : isSlapTipLive(attacker, simTime)
        ? "active"
        : attacker.isAttacking && attacker.attackType === "slap"
          ? "recovery_or_tip_dead"
          : "neutral",
    victimPhase: exposure.phase,
    victimSlapFlags: {
      isAttacking: !!victim.isAttacking,
      isSlapAttack: !!victim.isSlapAttack,
      attackType: victim.attackType || null,
      isInStartupFrames: !!victim.isInStartupFrames,
      isRecovering: !!victim.isRecovering,
      currentAction: victim.currentAction || null,
    },
    victimAttackStartTime: victim.attackStartTime || null,
    victimSlapActiveEndTime: victim.slapActiveEndTime || null,
    victimSlapFacingDirection: victim.slapFacingDirection || null,
    roots: { ax: attacker.x, ay: attacker.y, vx: victim.x, vy: victim.y },
    sizes: {
      a: attacker.sizeMultiplier || 1,
      v: victim.sizeMultiplier || 1,
    },
    poseKey: exposure.poseKey,
    poseReady,
    limbAabb: limb ? limb.aabb : null,
    tipProbe: tip
      ? { tipX: tip.tipX, tipY: tip.tipY, aabb: tip.aabb, facing: tip.facing }
      : null,
    tipLimbOverlap,
  };
}

module.exports = {
  isAuthoredSlapHurtLiveTraceEnabled,
  setAuthoredSlapHurtLiveTraceForTests,
  clearAuthoredSlapHurtLiveTrace,
  getAuthoredSlapHurtLiveTrace,
  noteAuthoredSlapHurtLiveTrace,
  captureSlapPairSnapshot,
};
