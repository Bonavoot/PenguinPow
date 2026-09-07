/**
 * Reaction Rig — body posture state machine (presentation only).
 * Run: node --no-warnings --loader ./scripts/extResolve.mjs --test src/combatPresentation/reactionRig.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createReactionRig,
  stepReactionRig,
  armReactionTier,
  observeRigDisplayX,
  rigPoseToCss,
  isIdentityRigPose,
  isRigBlockedState,
  RIG_PHASE,
  RIG_TIER,
  RIG_TUNING,
  RIG_FEATURES,
  RIG_FEATURES_ALL,
} from "./reactionRig.js";

const FRAME = 1000 / 60;
// Most behavioural tests exercise every channel; the "defaults" suite below
// pins what ships (grounded deformations off).
const ALL = RIG_FEATURES_ALL;

/** Advance the rig `n` frames with a constant input; returns the last pose. */
function run(rig, input, n, startMs = 0, features = ALL) {
  let pose = null;
  for (let i = 0; i < n; i++) {
    pose = stepReactionRig(rig, input, startMs + i * FRAME, FRAME, features);
  }
  return pose;
}

describe("reaction rig — idle", () => {
  it("returns an identity pose while nothing is happening", () => {
    const rig = createReactionRig();
    const pose = run(rig, { isHit: false, facing: 1, velX: 0 }, 10);
    assert.equal(pose.phase, RIG_PHASE.IDLE);
    assert.ok(isIdentityRigPose(pose));
    assert.equal(rigPoseToCss(pose), "none");
  });
});

describe("reaction rig — struck (hitstop)", () => {
  it("compresses and pre-bends in the knockback direction while frozen", () => {
    const rig = createReactionRig();
    run(rig, { isHit: false, facing: -1, velX: 0 }, 2);
    const pose = run(
      rig,
      { isHit: true, facing: -1, kbDir: 1, hitstopActive: true, velX: 0 },
      6,
      100
    );
    assert.equal(pose.phase, RIG_PHASE.STRUCK);
    assert.ok(pose.scaleY < 0.985, `expected squash, got scaleY=${pose.scaleY}`);
    assert.ok(pose.scaleX > 1.01, `expected widen, got scaleX=${pose.scaleX}`);
    assert.ok(pose.leanDeg > 0.5, `expected pre-lean right, got ${pose.leanDeg}`);
    assert.equal(pose.tiltDeg, 0, "grounded bend is a shear, never a tilt");
  });

  it("ignores the victim's own pre-hit motion when picking the direction", () => {
    const rig = createReactionRig();
    // Walking right at 200 px/s, then struck with a leftward knockback.
    run(rig, { isHit: false, facing: 1, velX: 200 }, 4);
    const pose = run(
      rig,
      { isHit: true, facing: 1, kbDir: -1, hitstopActive: true, velX: 200 },
      6,
      100
    );
    assert.ok(pose.leanDeg < 0, `expected lean left, got ${pose.leanDeg}`);
  });

  it("falls back to bending away from facing when no knockback hint exists", () => {
    const rig = createReactionRig();
    run(rig, { isHit: false, facing: 1, velX: 0 }, 2);
    const pose = run(
      rig,
      { isHit: true, facing: 1, kbDir: 0, hitstopActive: true, velX: 0 },
      6,
      100
    );
    // Facing right, struck from the front → pushed left → lean left (negative).
    assert.ok(pose.leanDeg < 0, `expected lean left, got ${pose.leanDeg}`);
  });
});

describe("reaction rig — reeling with the slide", () => {
  function slideScenario(tier, speed) {
    const rig = createReactionRig();
    if (tier) armReactionTier(rig, tier);
    run(rig, { isHit: false, facing: -1, velX: 0 }, 2);
    // 5 frames of hitstop, then the slide starts.
    run(rig, { isHit: true, facing: -1, kbDir: 1, hitstopActive: true, velX: 0 }, 5, 100);
    let peak = 0;
    let pose;
    for (let i = 0; i < 12; i++) {
      pose = stepReactionRig(rig, { isHit: true, facing: -1, kbDir: 1, hitstopActive: false, velX: speed }, 200 + i * FRAME, FRAME, ALL);
      peak = Math.max(peak, pose.leanDeg);
    }
    return { rig, pose, peak };
  }

  it("bends into the travel direction, scaled by displayed speed", () => {
    const slow = slideScenario(null, 200);
    const fast = slideScenario(null, 800);
    assert.equal(slow.pose.phase, RIG_PHASE.REELING);
    assert.ok(slow.peak > 4, `slow shove should still visibly bend (${slow.peak})`);
    assert.ok(fast.peak > slow.peak, "faster slide must bend further");
    assert.ok(
      fast.peak <= RIG_TUNING.LEAN_MAX_DEG * 1.15,
      `bend must respect the ordinary cap (${fast.peak})`
    );
    assert.equal(fast.pose.tiltDeg, 0, "grounded reeling never tilts");
  });

  it("re-decides direction from the actual travel once it is unambiguous", () => {
    // Server said "right" but the body actually flies left (overlap eject).
    const rig = createReactionRig();
    run(rig, { isHit: false, facing: 1, velX: 0 }, 2);
    run(rig, { isHit: true, facing: 1, kbDir: 1, hitstopActive: true, velX: 0 }, 5, 100);
    const pose = run(rig, { isHit: true, facing: 1, kbDir: 1, velX: -600 }, 14, 200);
    assert.ok(pose.leanDeg < -3, `bend must follow the real travel (${pose.leanDeg})`);
  });

  it("decisive tier bends further than ordinary at the same speed", () => {
    const ord = slideScenario(RIG_TIER.ORDINARY, 700);
    const dec = slideScenario(RIG_TIER.DECISIVE, 700);
    assert.ok(dec.peak > ord.peak * 1.15, `decisive ${dec.peak} vs ordinary ${ord.peak}`);
  });

  it("recovers upright with a small overshoot once the slide dies", () => {
    const { rig } = slideScenario(null, 700);
    let minAngle = Infinity;
    let pose;
    let t = 400;
    // Slide decays; hit flag clears at 260 ms like a real slap.
    for (let i = 0; i < 90; i++) {
      const velX = Math.max(0, 700 * Math.exp(-i / 14));
      pose = stepReactionRig(rig, { isHit: i < 4, facing: -1, kbDir: 1, hitstopActive: false, velX }, t, FRAME, ALL);
      t += FRAME;
      minAngle = Math.min(minAngle, pose.leanDeg);
    }
    assert.equal(pose.phase, RIG_PHASE.IDLE);
    assert.ok(isIdentityRigPose(pose), `should settle to identity (${pose.leanDeg})`);
    assert.ok(minAngle < -0.3, `expected a visible overshoot past upright (${minAngle})`);
    assert.ok(minAngle > -6, `overshoot must stay subtle (${minAngle})`);
  });
});

describe("reaction rig — airborne hit and touchdown", () => {
  function airScenario() {
    const rig = createReactionRig();
    run(rig, { isHit: false, facing: 1, velX: 0, heightPx: 0 }, 2);
    run(
      rig,
      { isHit: true, facing: 1, kbDir: -1, hitstopActive: true, velX: 0, heightPx: 120 },
      4,
      100
    );
    return rig;
  }

  it("tilts (rotation) while carried through the air, top leading the travel", () => {
    const rig = airScenario();
    const pose = run(
      rig,
      { isHit: true, isHitFalling: true, facing: 1, kbDir: -1, velX: -500, heightPx: 120 },
      14,
      200
    );
    assert.ok(pose.tiltDeg < -6, `expected a leftward tilt (${pose.tiltDeg})`);
    assert.ok(Math.abs(pose.leanDeg) < 0.5, `airborne bend must not shear (${pose.leanDeg})`);
  });

  it("hands tilt over to shear as the displayed height reaches the ground", () => {
    const rig = airScenario();
    run(
      rig,
      { isHit: true, isHitFalling: true, facing: 1, kbDir: -1, velX: -500, heightPx: 120 },
      14,
      200
    );
    // Descend through the blend band.
    let pose;
    let t = 500;
    for (let h = 30; h >= 0; h -= 6) {
      pose = stepReactionRig(rig, { isHit: false, isHitFalling: h > 0, facing: 1, kbDir: -1, velX: -450, heightPx: h }, t, FRAME, ALL);
      t += FRAME;
    }
    // Just landed: mostly shear, little tilt, and a compression beat started.
    assert.ok(Math.abs(pose.leanDeg) > Math.abs(pose.tiltDeg), `shear should dominate on landing (lean ${pose.leanDeg}, tilt ${pose.tiltDeg})`);
    assert.ok(pose.scaleY < 0.97, `expected a landing squash (${pose.scaleY})`);
  });

  it("holds the bend through touchdown instead of snapping upright", () => {
    const rig = airScenario();
    run(
      rig,
      { isHit: true, isHitFalling: true, facing: 1, kbDir: -1, velX: -500, heightPx: 120 },
      14,
      200
    );
    const before = stepReactionRig(rig, { isHit: false, isHitFalling: false, facing: 1, velX: -450, heightPx: 2 }, 500, FRAME, ALL);
    const after = stepReactionRig(rig, { isHit: false, isHitFalling: false, facing: 1, velX: -430, heightPx: 0 }, 500 + FRAME, FRAME, ALL);
    const bendBefore = before.leanDeg + before.tiltDeg;
    const bendAfter = after.leanDeg + after.tiltDeg;
    assert.ok(
      Math.abs(bendAfter - bendBefore) < 2.5,
      `touchdown must not snap the bend (${bendBefore} → ${bendAfter})`
    );
  });
});

describe("reaction rig — stun sway", () => {
  it("sways as a shear within the stun amplitude and bobs", () => {
    const rig = createReactionRig();
    let maxAbs = 0;
    let sawBothSigns = { pos: false, neg: false };
    let pose;
    for (let i = 0; i < 120; i++) {
      pose = stepReactionRig(rig, { isHit: false, isStunned: true, facing: 1, velX: 0 }, i * FRAME, FRAME, ALL);
      maxAbs = Math.max(maxAbs, Math.abs(pose.leanDeg));
      if (pose.leanDeg > 1) sawBothSigns.pos = true;
      if (pose.leanDeg < -1) sawBothSigns.neg = true;
      assert.equal(pose.tiltDeg, 0, "a stunned body keeps its feet planted");
    }
    assert.equal(pose.phase, RIG_PHASE.STUNNED);
    assert.ok(maxAbs > 2.5 && maxAbs <= RIG_TUNING.STUN_SWAY_DEG + 1.5, `sway amp ${maxAbs}`);
    assert.ok(sawBothSigns.pos && sawBothSigns.neg, "sway must cross upright");
    assert.ok(pose.scaleY <= 1, "bob compresses, never stretches");
  });

  it("returns upright after the stun ends", () => {
    const rig = createReactionRig();
    run(rig, { isHit: false, isStunned: true, facing: 1, velX: 0 }, 30);
    const pose = run(rig, { isHit: false, isStunned: false, facing: 1, velX: 0 }, 90, 600);
    assert.equal(pose.phase, RIG_PHASE.IDLE);
    assert.ok(isIdentityRigPose(pose));
  });
});

describe("reaction rig — belly-bump drive", () => {
  it("bends the attacker forward and eases out over the drive window", () => {
    const rig = createReactionRig();
    let peak = 0;
    let pose;
    for (let i = 0; i < 24; i++) {
      pose = stepReactionRig(rig, { isHit: false, facing: 1, velX: 150, driveDir: 1 }, i * FRAME, FRAME, ALL);
      peak = Math.max(peak, pose.leanDeg);
    }
    assert.equal(pose.phase, RIG_PHASE.DRIVING);
    assert.ok(peak > 4, `drive should visibly bend forward (${peak})`);
    assert.ok(pose.leanDeg < peak, "drive eases out as the drift dies");
    const settled = run(rig, { isHit: false, facing: 1, velX: 0 }, 90, 1000);
    assert.ok(isIdentityRigPose(settled));
  });
});

describe("reaction rig — ring-out topple", () => {
  it("tips over rigidly in the fall direction, lands once, and stays down", () => {
    const rig = createReactionRig();
    const events = [];
    let pose;
    let landedAt = null;
    for (let i = 0; i < 80; i++) {
      const t = i * FRAME;
      pose = stepReactionRig(rig, { isHit: true, facing: 1, velX: -300, ringOut: true, ringOutDir: -1 }, t, FRAME, ALL);
      if (pose.events) {
        events.push(...pose.events);
        if (landedAt === null) landedAt = t;
      }
    }
    assert.equal(pose.phase, RIG_PHASE.DOWNED);
    assert.ok(
      Math.abs(pose.tiltDeg + RIG_TUNING.TOPPLE_DEG) < 0.5,
      `should rest at -${RIG_TUNING.TOPPLE_DEG} (got ${pose.tiltDeg})`
    );
    assert.equal(pose.leanDeg, 0, "a fall is a rotation, not a shear");
    assert.deepEqual(events, ["topple_land"]);
    assert.ok(
      landedAt >= RIG_TUNING.TOPPLE_MS - FRAME && landedAt <= RIG_TUNING.TOPPLE_MS + 2 * FRAME,
      `land event at ${landedAt}ms`
    );
  });

  it("accelerates into the fall (ease-in), not a linear tip", () => {
    const rig = createReactionRig();
    const input = { isHit: true, facing: 1, velX: 0, ringOut: true, ringOutDir: 1 };
    stepReactionRig(rig, input, 0, FRAME, ALL);
    const early = stepReactionRig(rig, input, RIG_TUNING.TOPPLE_MS * 0.3, FRAME, ALL).tiltDeg;
    const late = stepReactionRig(rig, input, RIG_TUNING.TOPPLE_MS * 0.9, FRAME, ALL).tiltDeg;
    assert.ok(early < RIG_TUNING.TOPPLE_DEG * 0.1, `early ${early}`);
    assert.ok(late > RIG_TUNING.TOPPLE_DEG * 0.6, `late ${late}`);
  });

  it("snaps back upright when the round resets", () => {
    const rig = createReactionRig();
    run(rig, { isHit: true, facing: 1, velX: 0, ringOut: true, ringOutDir: 1 }, 60);
    const pose = run(rig, { isHit: false, facing: 1, velX: 0 }, 2, 2000);
    assert.ok(isIdentityRigPose(pose));
    assert.equal(pose.phase, RIG_PHASE.IDLE);
  });
});

describe("reaction rig — blocked states", () => {
  it("drains any bend quickly when another system owns the body", () => {
    const rig = createReactionRig();
    run(rig, { isHit: false, facing: -1, velX: 0 }, 2);
    run(rig, { isHit: true, facing: -1, kbDir: 1, hitstopActive: true, velX: 0 }, 5, 100);
    run(rig, { isHit: true, facing: -1, kbDir: 1, velX: 800 }, 10, 200);
    const pose = run(rig, { isHit: true, blocked: true, facing: -1, velX: 0 }, 20, 400);
    assert.ok(Math.abs(pose.leanDeg) < 1, `blocked should drain bend (${pose.leanDeg})`);
  });

  it("classifies the states that must block the rig", () => {
    assert.equal(isRigBlockedState({ isBeingGrabbed: true }), true);
    assert.equal(isRigBlockedState({ isSlideJumping: true }), true);
    assert.equal(isRigBlockedState({ isAtTheRopes: true }), true);
    assert.equal(isRigBlockedState({ isCinematicKillVictim: true }), true);
    assert.equal(isRigBlockedState({ lastHitType: "cinematicKill" }), true);
    assert.equal(isRigBlockedState({ isHit: true }), false);
    assert.equal(isRigBlockedState({ isRawParryStun: true }), false);
  });
});

describe("reaction rig — display velocity estimator", () => {
  it("estimates px/s from frame positions and ignores teleports", () => {
    const rig = createReactionRig();
    observeRigDisplayX(rig, 100, 0);
    let v = 0;
    for (let i = 1; i <= 12; i++) v = observeRigDisplayX(rig, 100 + i * 8, i * FRAME);
    // 8 px per 16.7 ms ≈ 480 px/s (EMA-smoothed, so allow a band).
    assert.ok(v > 300 && v < 500, `velocity ${v}`);
    const afterTeleport = observeRigDisplayX(rig, 900, 13 * FRAME);
    assert.ok(afterTeleport < v, "teleport must not spike the velocity");
  });
});

describe("reaction rig — css contract", () => {
  it("emits rotate / skewX (negated) / scale about the sole, or none", () => {
    assert.equal(
      rigPoseToCss({ leanDeg: 12.3456, tiltDeg: 0, scaleX: 1.04567, scaleY: 0.9321 }),
      "skewX(-12.35deg) scale(1.046, 0.932)"
    );
    assert.equal(
      rigPoseToCss({ leanDeg: 0, tiltDeg: -82, scaleX: 1, scaleY: 1 }),
      "rotate(-82.00deg)"
    );
    assert.equal(rigPoseToCss({ leanDeg: 0, tiltDeg: 0, scaleX: 1, scaleY: 1 }), "none");
  });
});

describe("reaction rig — shipped defaults (grounded deformations off)", () => {
  it("does not shear a grounded hit victim, sway a stunned one, or bend a driver", () => {
    assert.equal(RIG_FEATURES.groundBend, false);
    assert.equal(RIG_FEATURES.stunSway, false);
    assert.equal(RIG_FEATURES.bellyDrive, false);
    assert.equal(RIG_FEATURES.struckSquash, false);

    const rig = createReactionRig();
    run(rig, { isHit: false, facing: -1, velX: 0 }, 2, 0, RIG_FEATURES);
    let pose = run(
      rig,
      { isHit: true, facing: -1, kbDir: 1, hitstopActive: true, velX: 0 },
      6,
      100,
      RIG_FEATURES
    );
    assert.ok(isIdentityRigPose(pose), "no struck squash / pre-lean by default");
    pose = run(rig, { isHit: true, facing: -1, kbDir: 1, velX: 800 }, 20, 250, RIG_FEATURES);
    assert.equal(pose.leanDeg, 0, "no grounded shear by default");
    assert.equal(pose.tiltDeg, 0, "no grounded tilt either");

    const stunned = createReactionRig();
    pose = run(stunned, { isHit: false, isStunned: true, facing: 1, velX: 0 }, 60, 0, RIG_FEATURES);
    assert.ok(isIdentityRigPose(pose), "no stun sway by default");

    const driver = createReactionRig();
    pose = run(driver, { isHit: false, facing: 1, velX: 150, driveDir: 1 }, 20, 0, RIG_FEATURES);
    assert.ok(isIdentityRigPose(pose), "no belly drive bend by default");
  });

  it("still tilts an airborne victim, levels out before touchdown, and squashes on landing", () => {
    const rig = createReactionRig();
    run(rig, { isHit: false, facing: 1, velX: 0, heightPx: 0 }, 2, 0, RIG_FEATURES);
    run(
      rig,
      { isHit: true, facing: 1, kbDir: -1, hitstopActive: true, velX: 0, heightPx: 140 },
      4,
      100,
      RIG_FEATURES
    );
    const inAir = run(
      rig,
      { isHit: true, isHitFalling: true, facing: 1, kbDir: -1, velX: -500, heightPx: 140 },
      16,
      200,
      RIG_FEATURES
    );
    assert.ok(inAir.tiltDeg < -6, `airborne tilt expected (${inAir.tiltDeg})`);
    assert.equal(inAir.leanDeg, 0);

    // Descend through the level-out band to the ground.
    let pose;
    let t = 500;
    for (let h = RIG_TUNING.AIR_BLEND_PX; h >= 0; h -= 5) {
      pose = stepReactionRig(
        rig,
        { isHit: false, isHitFalling: h > 0, facing: 1, velX: -400, heightPx: h },
        t,
        FRAME,
        RIG_FEATURES
      );
      t += FRAME;
    }
    assert.ok(Math.abs(pose.tiltDeg) < 3, `tilt should be nearly level at touchdown (${pose.tiltDeg})`);
    assert.equal(pose.leanDeg, 0, "never converts to a shear");
    assert.ok(pose.scaleY < 0.97, `landing squash expected (${pose.scaleY})`);
    const settled = run(rig, { isHit: false, facing: 1, velX: 0, heightPx: 0 }, 60, t, RIG_FEATURES);
    assert.ok(isIdentityRigPose(settled));
  });

  it("keeps the ring-out topple", () => {
    const rig = createReactionRig();
    const pose = run(
      rig,
      { isHit: true, facing: 1, velX: 0, ringOut: true, ringOutDir: 1 },
      60,
      0,
      RIG_FEATURES
    );
    assert.equal(pose.phase, RIG_PHASE.DOWNED);
    assert.ok(Math.abs(pose.tiltDeg - RIG_TUNING.TOPPLE_DEG) < 0.5);
  });
});
