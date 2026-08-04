"use strict";

/**
 * Phase 3 — legacy tip-rail vs authored-volume SHADOW comparison.
 *
 * INERT: never mutates players, never deals damage, never called from the
 * normal production tick. Callers must gate with isCombatVolumeShadowEnabled().
 */

const {
  isWithinConnectRange,
  attackKindFromPlayer,
  getConnectDistance,
} = require("./strikeContact");
const {
  queryAuthoredCombatVolumes,
  queryAuthoredCandidateContacts,
} = require("./combatVolumeQuery");
const { isCombatVolumeShadowEnabled } = require("./combatVolumeShadowFlags");
const { COMBAT_VOLUME_KIND } = require("./combatVolumeVocabulary");

const SHADOW_MISMATCH = Object.freeze({
  LEGACY_HIT_CANDIDATE_MISS: "LEGACY_HIT_CANDIDATE_MISS",
  LEGACY_MISS_CANDIDATE_HIT_BODY: "LEGACY_MISS_CANDIDATE_HIT_BODY",
  LEGACY_MISS_CANDIDATE_HIT_LIMB: "LEGACY_MISS_CANDIDATE_HIT_LIMB",
  PHASE_DISAGREEMENT: "PHASE_DISAGREEMENT",
  FACING_OR_MIRROR_DISAGREEMENT: "FACING_OR_MIRROR_DISAGREEMENT",
  SCALE_OR_SIZE_DISAGREEMENT: "SCALE_OR_SIZE_DISAGREEMENT",
  VERTICAL_DISAGREEMENT: "VERTICAL_DISAGREEMENT",
  ORDER_OR_MULTI_CONTACT_DISAGREEMENT: "ORDER_OR_MULTI_CONTACT_DISAGREEMENT",
  UNSUPPORTED_ACTION_FALLBACK: "UNSUPPORTED_ACTION_FALLBACK",
  AGREEMENT: "AGREEMENT",
});

const AGG_CAP = 64;
const _aggregates = new Map();
let _aggregateTotal = 0;

function noteAggregate(code) {
  _aggregateTotal += 1;
  const prev = _aggregates.get(code) || 0;
  if (_aggregates.size >= AGG_CAP && ! _aggregates.has(code)) {
    return;
  }
  _aggregates.set(code, prev + 1);
}

function getShadowAggregates() {
  return {
    total: _aggregateTotal,
    byCode: Object.fromEntries(_aggregates.entries()),
  };
}

function clearShadowAggregates() {
  _aggregates.clear();
  _aggregateTotal = 0;
}

function legacyStrikeWouldConnect(attacker, victim) {
  if (!attacker || !victim) return false;
  if (!attacker.isAttacking) return false;
  const kind = attackKindFromPlayer(attacker);
  if (!kind || kind === "none") return false;
  // Active-phase check left to caller via authored phase; legacy connect is
  // geometric tip-meets-body only.
  return isWithinConnectRange(attacker, victim, kind);
}

/**
 * Compare one attacker→victim pair. Pure. No gameplay side effects.
 */
function compareLegacyVsCandidate(attacker, victim, opts = {}) {
  if (!isCombatVolumeShadowEnabled(opts.envValue) && !opts.force) {
    return {
      skipped: true,
      reason: "shadow_flag_off",
      mismatches: [],
    };
  }

  const simTime = opts.simTime;
  const atkQ = queryAuthoredCombatVolumes(attacker, {
    simTime,
    ownerSlot: opts.attackerSlot != null ? opts.attackerSlot : 0,
  });
  const vicQ = queryAuthoredCombatVolumes(victim, {
    simTime,
    ownerSlot: opts.victimSlot != null ? opts.victimSlot : 1,
  });

  if (
    atkQ.support === "unsupported" ||
    atkQ.classification === "UNSUPPORTED_ACTION_FALLBACK"
  ) {
    const m = {
      code: SHADOW_MISMATCH.UNSUPPORTED_ACTION_FALLBACK,
      attackerPose: atkQ.poseKey,
      victimPose: vicQ.poseKey,
      reason: atkQ.reason,
    };
    noteAggregate(m.code);
    return {
      skipped: false,
      legacyHit: false,
      candidateHit: false,
      candidateLimbOnly: false,
      mismatches: [m],
      attackerQuery: atkQ,
      victimQuery: vicQ,
    };
  }

  const kind = attackKindFromPlayer(attacker);
  const legacyHit =
    !!attacker.isAttacking &&
    atkQ.actionPhase === "active" &&
    legacyStrikeWouldConnect(attacker, victim);

  const contacts = queryAuthoredCandidateContacts(attacker, victim, {
    simTime,
    ownerSlotA: opts.attackerSlot != null ? opts.attackerSlot : 0,
    ownerSlotB: opts.victimSlot != null ? opts.victimSlot : 1,
  });

  // Only attacker→victim direction for primary compare
  const atkSlot = opts.attackerSlot != null ? opts.attackerSlot : 0;
  const directed = contacts.candidates.filter((c) => c.attackerSlot === atkSlot);
  const bodyHit = directed.some(
    (c) =>
      c.victimKind === COMBAT_VOLUME_KIND.HURT_BODY &&
      (c.victimRegion === "torso" || c.victimRegion === "head" || c.victimLabel === "torso" || c.victimLabel === "head" || c.victimLabel === "hurt_body")
  );
  const limbHit = directed.some(
    (c) => c.victimKind === COMBAT_VOLUME_KIND.HURT_LIMB
  );
  // Also treat generic hurt_body labels from pose
  const anyHurt = directed.length > 0;
  const candidateHitBody =
    bodyHit ||
    directed.some(
      (c) =>
        c.victimKind === COMBAT_VOLUME_KIND.HURT_BODY &&
        c.victimRegion !== "frontArm"
    );
  const candidateHitLimb = limbHit && !candidateHitBody;
  const candidateHit = anyHurt;

  const mismatches = [];

  if (legacyHit && !candidateHit) {
    mismatches.push({ code: SHADOW_MISMATCH.LEGACY_HIT_CANDIDATE_MISS });
  }
  if (!legacyHit && candidateHitBody) {
    mismatches.push({ code: SHADOW_MISMATCH.LEGACY_MISS_CANDIDATE_HIT_BODY });
  }
  if (!legacyHit && candidateHitLimb) {
    mismatches.push({
      code: SHADOW_MISMATCH.LEGACY_MISS_CANDIDATE_HIT_LIMB,
      victimRegion: directed.find((c) => c.victimKind === COMBAT_VOLUME_KIND.HURT_LIMB)
        ?.victimRegion,
      contact: directed.find((c) => c.victimKind === COMBAT_VOLUME_KIND.HURT_LIMB) || null,
      attackerPhase: atkQ.actionPhase,
      victimPhase: vicQ.actionPhase,
      attackerRoot: { x: attacker.x, y: attacker.y },
      victimRoot: { x: victim.x, y: victim.y },
      attackerMirror: atkQ.mirrorFacing,
      victimMirror: vicQ.mirrorFacing,
      attackerFacing: attacker.facing,
      victimFacing: victim.facing,
      sizeA: attacker.sizeMultiplier,
      sizeB: victim.sizeMultiplier,
      legacyHit,
      candidateHit: true,
    });
  }

  if (
    atkQ.mirrorFacing !== (attacker.slapFacingDirection || attacker.chargingFacingDirection || attacker.facing) &&
    attacker.isSlapAttack &&
    attacker.slapFacingDirection &&
    atkQ.mirrorFacing !== attacker.slapFacingDirection
  ) {
    mismatches.push({ code: SHADOW_MISMATCH.FACING_OR_MIRROR_DISAGREEMENT });
  }

  if (
    typeof attacker.sizeMultiplier === "number" &&
    typeof victim.sizeMultiplier === "number" &&
    Math.abs(attacker.sizeMultiplier - victim.sizeMultiplier) > 0.01 &&
    legacyHit !== candidateHit
  ) {
    mismatches.push({ code: SHADOW_MISMATCH.SCALE_OR_SIZE_DISAGREEMENT });
  }

  if (directed.length > 1) {
    // Multi-region overlaps are expected (torso+limb); flag only unordered churn
    const labels = directed.map((c) => `${c.victimRegion}:${c.depth}`).join("|");
    const labelsRev = directed
      .slice()
      .reverse()
      .map((c) => `${c.victimRegion}:${c.depth}`)
      .join("|");
    if (labels === labelsRev && directed.length > 2) {
      mismatches.push({ code: SHADOW_MISMATCH.ORDER_OR_MULTI_CONTACT_DISAGREEMENT });
    }
  }

  if (mismatches.length === 0) {
    noteAggregate(SHADOW_MISMATCH.AGREEMENT);
  } else {
    for (let i = 0; i < mismatches.length; i++) {
      noteAggregate(mismatches[i].code);
    }
  }

  return {
    skipped: false,
    legacyHit,
    candidateHit,
    candidateHitBody,
    candidateLimbOnly: candidateHitLimb,
    connectDistance:
      kind && kind !== "none" ? getConnectDistance(kind, attacker, victim) : null,
    mismatches,
    attackerQuery: atkQ,
    victimQuery: vicQ,
    directedCandidates: directed,
  };
}

module.exports = {
  SHADOW_MISMATCH,
  compareLegacyVsCandidate,
  legacyStrikeWouldConnect,
  getShadowAggregates,
  clearShadowAggregates,
  AGG_CAP,
};
