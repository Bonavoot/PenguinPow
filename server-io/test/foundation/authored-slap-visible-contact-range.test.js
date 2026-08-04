"use strict";

/**
 * PHASE 4A — VISIBLE LIMB CONTACT RANGE.
 *
 * The defect this locks down: a limb-only contact could commit while a large
 * gap still separated the attacking hand from the exposed arm. Two independent
 * causes, both fixed here:
 *
 *   1. A second, hard-coded attacker probe (centre = full art tip, halfW 14)
 *      sat ~12 world units OUTSIDE the canonical authored HIT rail.
 *   2. `frontArm` was authored at forward 70 / halfW 36 → outer edge 106, while
 *      the widest slap art tip is 78.392 — ~27.6 units of invisible reach.
 *
 * Together they allowed ~41.6 units of air on a "connect". Every assertion below
 * is expressed in measurable root-to-root gaps derived from live authored
 * geometry, so the fixtures cannot silently drift back.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  setAuthoredSlapHurtboxForTests,
} = require("../../authoredSlapHurtboxFlags");
const {
  evaluateTipVersusSlapLimb,
  getAttackerHitRegion,
  getVictimSlapLimbAabb,
} = require("../../authoredSlapHurtTarget");
const {
  createFoundationScenario,
  armSlapPhase,
  armPalmPhase,
  armChargedPhase,
  placeAtGap,
} = require("./helpers/scenarioHarness");
const {
  VISIBLE_ARM_TIP,
  attackerProbeReach,
  victimLimbReach,
  limbReachGap,
  torsoGate,
  visibleTouchGap,
  limbOnlyGap,
} = require("./helpers/limbSpacing");
const {
  CHARGE_PRIORITY_THRESHOLD,
  PALM_THRUST_POWER,
  PALM_THRUST_STARTUP_MS,
} = require("../../constants");
const authoredCatalog = require("../../../shared/combatVolumeAuthored.json");

const SIZES = [1, 0.85];
/** Documented authored contact skin — the ONLY tolerance allowed past the art. */
const SKIN_EPSILON = 2.001;
/** One epsilon beyond a boundary must be a miss. */
const MISS_EPSILON = 0.5;

/** Old (defective) hard-coded probe + limb, for the regression deltas we report. */
const OLD_PROBE_HALF_W = 14;
const OLD_LIMB_OUTER = 106; // forward 70 + halfW 36

function armVictim(s, pose, now, variant) {
  if (variant != null) s.right.slapAnimation = variant;
  armSlapPhase(s.right, pose, now);
  if (variant != null) s.right.slapAnimation = variant;
}

function armAttacker(s, kind, now) {
  if (kind === "slap") {
    armSlapPhase(s.left, "active", now);
    s.left.isInStartupFrames = false;
  } else if (kind === "palm") {
    armPalmPhase(s.left, "active", now);
    s.left.chargeAttackPower = PALM_THRUST_POWER;
    s.left.isInStartupFrames = false;
    s.left.attackStartTime = now - PALM_THRUST_STARTUP_MS - 20;
    s.left.startupEndTime = s.left.attackStartTime + PALM_THRUST_STARTUP_MS;
  } else {
    armChargedPhase(s.left, "active", now);
    s.left.chargeAttackPower = CHARGE_PRIORITY_THRESHOLD;
    s.left.isInStartupFrames = false;
  }
  s.left.chargingFacingDirection = s.left.facing;
}

function limbOverlapsAtGap(s, kind, now, gap) {
  placeAtGap(s, gap);
  const r = evaluateTipVersusSlapLimb(s.left, s.right, {
    simTime: now,
    attackKind: kind,
  });
  return !!(r && r.hit);
}

describe("Phase 4A — attacker probe is the canonical authored HIT rail", () => {
  afterEach(() => setAuthoredSlapHurtboxForTests(null));

  it("probe geometry is read from the authored catalog, not hard-coded", () => {
    for (const [kind, poseKey] of [
      ["slap", "slap_active"],
      ["palm", "palm_active"],
      ["charged", "charged_active"],
    ]) {
      const hit = getAttackerHitRegion(kind);
      assert.ok(hit, `${kind}: supported HIT definition must resolve`);
      assert.equal(hit.poseKey, poseKey);
      const authored = authoredCatalog.poses[poseKey].regions.find(
        (r) => r.kind === "HIT"
      );
      assert.ok(authored, `${poseKey} must author a HIT region`);
      assert.equal(hit.region.forward, authored.forward);
      assert.equal(hit.region.halfW, authored.halfW);
      assert.equal(hit.region.halfH, authored.halfH);
      assert.equal(hit.region.up, authored.up);
    }
  });

  it("palmThrust aliases palm; unsupported kinds fail explicitly (null)", () => {
    assert.deepEqual(
      getAttackerHitRegion("palmThrust").region,
      getAttackerHitRegion("palm").region
    );
    assert.equal(getAttackerHitRegion("lowKick"), null);
    assert.equal(getAttackerHitRegion("flap"), null);
    assert.equal(getAttackerHitRegion(null), null);
  });

  it("probe reach is independent of sizeMultiplier (sprites do not scale)", () => {
    const reach = {};
    for (const size of SIZES) {
      const s = createFoundationScenario({ sizeA: size, sizeB: size });
      const now = s.room.simTime;
      for (const kind of ["slap", "palm", "charged"]) {
        armAttacker(s, kind, now);
        const r = attackerProbeReach(kind);
        if (reach[kind] == null) reach[kind] = r;
        assert.equal(r, reach[kind], `${kind} probe must not scale with size`);
      }
      s.dispose();
    }
  });

  it("corrected probe sits INSIDE the old hard-coded probe by ~12 units", () => {
    const { getStrikeTipWorld } = require("../../strikeContact");
    const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
    const rows = [];
    for (const kind of ["slap", "palm", "charged"]) {
      if (kind === "slap") s.left.slapAnimation = 2;
      const oldOuter = getStrikeTipWorld(kind, s.left) + OLD_PROBE_HALF_W;
      const newOuter = attackerProbeReach(kind);
      rows.push({ kind, oldOuter, newOuter });
      assert.ok(
        newOuter < oldOuter,
        `${kind}: corrected probe (${newOuter}) must not exceed the old hard-coded probe (${oldOuter})`
      );
    }
    // The old probe was centred on the art tip; the authored rail is centred
    // inboard of it, so every kind loses ~12 units of phantom outward reach.
    for (const r of rows) {
      assert.ok(
        r.oldOuter - r.newOuter > 9,
        `${r.kind}: expected ~12 units removed, got ${(r.oldOuter - r.newOuter).toFixed(3)}`
      );
    }
    s.dispose();
  });
});

describe("Phase 4A — authored frontArm never exceeds the visible limb", () => {
  afterEach(() => setAuthoredSlapHurtboxForTests(null));

  it("each frontArm outer edge equals its measured visible arm tip", () => {
    setAuthoredSlapHurtboxForTests(true);
    const cases = [
      { pose: "active", variant: 1, tip: VISIBLE_ARM_TIP.slap_active[1] },
      { pose: "active", variant: 2, tip: VISIBLE_ARM_TIP.slap_active[2] },
      { pose: "recovery", variant: 1, tip: VISIBLE_ARM_TIP.slap_recovery[1] },
    ];
    for (const c of cases) {
      for (const size of SIZES) {
        const s = createFoundationScenario({ sizeA: size, sizeB: size });
        const now = s.room.simTime;
        armVictim(s, c.pose, now, c.variant);
        const reach = victimLimbReach(s.right, now);
        assert.ok(reach != null, `${c.pose} v${c.variant}: limb must resolve`);
        assert.ok(
          reach <= c.tip + SKIN_EPSILON,
          `${c.pose} v${c.variant}@${size}: authored ${reach.toFixed(3)} must not ` +
            `exceed visible ${c.tip} (+skin)`
        );
        // …and must not under-reach either: the arm IS hittable anatomy.
        assert.ok(
          reach >= c.tip - SKIN_EPSILON,
          `${c.pose} v${c.variant}@${size}: authored ${reach.toFixed(3)} under-reaches visible ${c.tip}`
        );
        s.dispose();
      }
    }
  });

  it("the old 106-unit frontArm outer edge is gone for every pose/variant", () => {
    setAuthoredSlapHurtboxForTests(true);
    for (const pose of ["active", "recovery"]) {
      for (const variant of [1, 2]) {
        const s = createFoundationScenario({ sizeA: 1, sizeB: 1 });
        const now = s.room.simTime;
        armVictim(s, pose, now, variant);
        const reach = victimLimbReach(s.right, now);
        assert.ok(
          reach < OLD_LIMB_OUTER - 20,
          `${pose} v${variant}: ${reach.toFixed(3)} must be far inside the old ${OLD_LIMB_OUTER}`
        );
        s.dispose();
      }
    }
  });

  it("the two active slap variants get variant-specific volumes (never averaged)", () => {
    setAuthoredSlapHurtboxForTests(true);
    const reach = {};
    for (const variant of [1, 2]) {
      const s = createFoundationScenario({ sizeA: 1, sizeB: 1 });
      const now = s.room.simTime;
      armVictim(s, "active", now, variant);
      const limb = getVictimSlapLimbAabb(s.right, now);
      assert.equal(limb.variantKey, String(variant));
      reach[variant] = limb.reachForward;
      s.dispose();
    }
    assert.notEqual(
      reach[1],
      reach[2],
      "the hit frames differ by ~3.1 units — one shared volume would be dishonest"
    );
    assert.ok(reach[2] > reach[1], "variant 2 draws the longer arm");
  });

  it("an unknown slap variant falls back to the SHORTER volume", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: 1, sizeB: 1 });
    const now = s.room.simTime;
    armVictim(s, "active", now, 1);
    const shortest = victimLimbReach(s.right, now);
    s.right.slapAnimation = 99;
    const unknown = victimLimbReach(s.right, now);
    assert.equal(
      unknown,
      shortest,
      "an unknown variant must never claim reach it does not draw"
    );
    s.dispose();
  });

  it("victim limb reach is independent of sizeMultiplier", () => {
    setAuthoredSlapHurtboxForTests(true);
    for (const pose of ["active", "recovery"]) {
      const seen = new Set();
      for (const size of SIZES) {
        const s = createFoundationScenario({ sizeA: size, sizeB: size });
        const now = s.room.simTime;
        armVictim(s, pose, now, 1);
        seen.add(victimLimbReach(s.right, now));
        s.dispose();
      }
      assert.equal(seen.size, 1, `${pose}: sprite reach must not scale`);
    }
  });
});

describe("Phase 4A — visible-touch boundary is the contact boundary", () => {
  afterEach(() => setAuthoredSlapHurtboxForTests(null));

  /**
   * For every supported attacker × exposed victim pose × variant × size × facing:
   *   • the limb overlaps at the visible-touch gap (silhouettes touching), and
   *   • one documented epsilon past the authored outer edge is a MISS.
   */
  it("touch connects; one epsilon past the authored edge misses", () => {
    setAuthoredSlapHurtboxForTests(true);
    const rows = [];
    for (const kind of ["slap", "palm", "charged"]) {
      for (const pose of ["active", "recovery"]) {
        for (const variant of pose === "active" ? [1, 2] : [1]) {
          for (const size of SIZES) {
            for (const facing of ["normal", "mirrored"]) {
              const s = createFoundationScenario({
                sizeA: size,
                sizeB: size,
                leftFacing: facing === "normal" ? -1 : 1,
                rightFacing: facing === "normal" ? 1 : -1,
              });
              const now = s.room.simTime;
              if (facing === "mirrored") {
                // Swap sides so they still face each other.
                const mid = (s.left.x + s.right.x) / 2;
                s.left.x = mid + 80;
                s.right.x = mid - 80;
              }
              armVictim(s, pose, now, variant);
              armAttacker(s, kind, now);

              const poseKey = pose === "active" ? "slap_active" : "slap_recovery";
              const touch = visibleTouchGap(kind, s.left, poseKey, variant);
              const edge = limbReachGap(kind, s.right, now);
              const label = `${kind}→${pose}v${variant}@${size}/${facing}`;

              // Authored edge is the visible tip plus the documented skin only.
              assert.ok(
                edge <= touch + SKIN_EPSILON,
                `${label}: authored edge ${edge.toFixed(3)} exceeds visible touch ${touch.toFixed(3)} + skin`
              );
              // Silhouettes touching ⇒ contact.
              assert.equal(
                limbOverlapsAtGap(s, kind, now, touch),
                true,
                `${label}: visible touch must connect`
              );
              // Clear air ⇒ miss.
              assert.equal(
                limbOverlapsAtGap(s, kind, now, edge + MISS_EPSILON),
                false,
                `${label}: one epsilon past the edge must miss`
              );
              rows.push({ label, touch, edge });
              s.dispose();
            }
          }
        }
      }
    }
    assert.equal(rows.length, 3 * 3 * 2 * 2, "full matrix must be covered");
  });

  it("charged only reaches the limb where its own authored HIT rail does", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armVictim(s, "active", now, 2);
    armAttacker(s, "charged", now);
    const edge = limbReachGap("charged", s.right, now);
    // Charged's rail is the SHORTEST of the three, so its limb window is the
    // tightest — it must not inherit slap's longer reach.
    assert.ok(edge < limbReachGap("slap", s.right, now));
    assert.equal(limbOverlapsAtGap(s, "charged", now, edge - 0.25), true);
    assert.equal(limbOverlapsAtGap(s, "charged", now, edge + MISS_EPSILON), false);
    s.dispose();
  });

  it("cross-up keeps committed action-facing (roots swap, contact holds)", () => {
    setAuthoredSlapHurtboxForTests(true);
    const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armVictim(s, "active", now, 1);
    armAttacker(s, "slap", now);
    // Swap roots but keep the committed facings — action-facing retention.
    const lx = s.left.x;
    s.left.x = s.right.x;
    s.right.x = lx;
    s.left.facing = 1;
    s.left.slapFacingDirection = 1;
    s.right.facing = -1;
    s.right.slapFacingDirection = -1;
    const edge = limbReachGap("slap", s.right, now);
    assert.equal(limbOverlapsAtGap(s, "slap", now, edge - 0.25), true);
    assert.equal(limbOverlapsAtGap(s, "slap", now, edge + MISS_EPSILON), false);
    s.dispose();
  });

  it("flag OFF: the authored limb query is not consulted at limb spacing", () => {
    setAuthoredSlapHurtboxForTests(false);
    const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armVictim(s, "active", now, 2);
    armAttacker(s, "slap", now);
    // Derived while OFF (geometry helpers are flag-independent by design).
    const gap = limbOnlyGap("slap", s.left, s.right, now);
    assert.ok(gap != null);
    placeAtGap(s, gap);
    const r = evaluateTipVersusSlapLimb(s.left, s.right, {
      simTime: now,
      attackKind: "slap",
    });
    assert.equal(r, null, "flag OFF must not produce an authored limb contact");
    s.dispose();
  });
});

describe("Phase 4A — old vs corrected maximum legal gaps", () => {
  afterEach(() => setAuthoredSlapHurtboxForTests(null));

  /**
   * Reported for every supported attacker / target-pose pair. `old` is the
   * defective pair (hard-coded probe + 106-unit arm); `corrected` is the authored
   * rail + measured arm. `invisibleAllowance` is how much air a connect could
   * legally contain — it must collapse to the documented skin.
   */
  it("invisible allowance collapses from ~41.6 units to the authored skin", () => {
    setAuthoredSlapHurtboxForTests(true);
    const { getStrikeTipWorld } = require("../../strikeContact");
    const report = [];
    for (const kind of ["slap", "palm", "charged"]) {
      for (const pose of ["active", "recovery"]) {
        for (const variant of pose === "active" ? [1, 2] : [1]) {
          const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
          const now = s.room.simTime;
          armVictim(s, pose, now, variant);
          if (kind === "slap") s.left.slapAnimation = variant;
          armAttacker(s, kind, now);
          const poseKey = pose === "active" ? "slap_active" : "slap_recovery";
          const oldMax =
            getStrikeTipWorld(kind, s.left) + OLD_PROBE_HALF_W + OLD_LIMB_OUTER;
          const corrected = limbReachGap(kind, s.right, now);
          const touch = visibleTouchGap(kind, s.left, poseKey, variant);
          report.push({
            pair: `${kind}→${pose}v${variant}`,
            oldMax,
            corrected,
            touch,
            oldAllowance: oldMax - touch,
            newAllowance: corrected - touch,
          });
          s.dispose();
        }
      }
    }
    for (const r of report) {
      assert.ok(
        r.oldAllowance > 35,
        `${r.pair}: old allowance should be large, got ${r.oldAllowance.toFixed(3)}`
      );
      assert.ok(
        r.newAllowance <= SKIN_EPSILON,
        `${r.pair}: corrected allowance ${r.newAllowance.toFixed(3)} must be within the authored skin`
      );
      assert.ok(
        r.corrected < r.oldMax,
        `${r.pair}: corrected max gap must be tighter than the old one`
      );
    }
  });

  it("documents which pairings retain a limb-ONLY band", () => {
    setAuthoredSlapHurtboxForTests(true);
    // The retracted recovery arm (54.448) barely clears — and at size 1 does not
    // clear — the legacy torso rail (65×size, plus palm's own overhang). This is
    // a geometric consequence of honest bounds, NOT a tolerance to be widened.
    const expected = {
      "1|slap|active": true,
      "1|palm|active": true,
      "1|charged|active": true,
      "1|slap|recovery": false,
      "1|palm|recovery": false,
      "1|charged|recovery": false,
      "0.85|slap|active": true,
      "0.85|palm|active": true,
      "0.85|charged|active": true,
      "0.85|slap|recovery": true,
      "0.85|palm|recovery": false,
      "0.85|charged|recovery": true,
    };
    for (const size of SIZES) {
      for (const kind of ["slap", "palm", "charged"]) {
        for (const pose of ["active", "recovery"]) {
          const s = createFoundationScenario({ sizeA: size, sizeB: size });
          const now = s.room.simTime;
          armVictim(s, pose, now, 1);
          armAttacker(s, kind, now);
          const key = `${size}|${kind}|${pose}`;
          assert.equal(
            limbReachGap(kind, s.right, now) > torsoGate(kind, s.left, s.right),
            expected[key],
            `${key}: limb-only band presence changed`
          );
          s.dispose();
        }
      }
    }
  });
});
