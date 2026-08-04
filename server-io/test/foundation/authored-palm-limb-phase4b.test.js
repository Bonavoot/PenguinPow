"use strict";

/**
 * PHASE 4B — AUTHORED PALM LIMB CONTACT.
 *
 * Phase 4A proved the principle on slap. Phase 4B extends it to the open-palm
 * thrust, whose extended arm is the game's most visible whiff-punish target:
 *
 *   palm_active   — the 90ms strike window.
 *   palm_recovery — ONLY while the arm is still held out (PALM_THRUST_HOLD_MS
 *                   into recovery). After that the art retracts to the ready
 *                   stance and there is no honest limb-only window left.
 *
 * Everything here is derived from live authored geometry via helpers/limbSpacing,
 * never from baked-in gaps — the Phase 4A defect this guards against was a
 * fixture that only passed while the volume over-reached its art.
 */

const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  setAuthoredSlapHurtboxForTests,
} = require("../../authoredSlapHurtboxFlags");
const {
  resolveVictimLimbExposure,
  getVictimLimbAabb,
  isPalmLimbHoldWindow,
  refreshPalmLimbExtended,
  resolveAuthoredSlapHurtContact,
  clearLastSlapHurtCommitted,
  getLastSlapHurtCommitted,
  EXPOSED_LIMB_POSES,
  isAuthoredLimbPoseAuthorityReady,
} = require("../../authoredSlapHurtTarget");
const {
  createFoundationScenario,
  armSlapPhase,
  armPalmPhase,
  stepCollisionBothOrders,
  placeAtGap,
  clearActionState,
  PALM_THRUST_HOLD_MS,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
} = require("./helpers/scenarioHarness");
const {
  limbOnlyGap,
  limbReachGap,
  torsoGate,
  visibleTouchGap,
  victimLimbReach,
  attackerProbeReach: limbSpacingProbeReach,
  VISIBLE_ARM_TIP,
  CONTACT_SNAP_EPSILON,
} = require("./helpers/limbSpacing");
const { COMBAT_VOLUME_KIND } = require("../../combatVolumeVocabulary");
const {
  AP_LATE_PARRY_MS,
  SLAP_GRACE_CONFIRM_SLACK_PX,
} = require("../../constants");
const { getStrikeTipWorld, getConnectDistance } = require("../../strikeContact");
const authoredCatalog = require("../../../shared/combatVolumeAuthored.json");

/** Sub-pixel guard for float round-trips through placeAtGap. Not a tolerance. */
const BOUNDARY_NUDGE = 1e-6;

/** Deep-active slap attacker: past the late-parry grace, tip genuinely live. */
function armDeepSlapActive(p, now) {
  armSlapPhase(p, "active", now);
  p.isInStartupFrames = false;
  p.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 20;
  p.slapActiveEndTime = p.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
  p.attackEndTime = p.slapActiveEndTime + SLAP_RECOVERY_MS;
}

/** Victim shows its palm; its own committed facing points AT the attacker. */
function armPalmVictim(victim, attacker, now, phase, opts) {
  armPalmPhase(victim, phase, now, opts);
  const towardAttacker = attacker.x < victim.x ? 1 : -1;
  victim.chargingFacingDirection = towardAttacker;
  victim.facing = towardAttacker;
  refreshPalmLimbExtended(victim, now);
  return victim;
}

function lastHit(io) {
  const h = io.last("player_hit");
  return h ? h.payload : null;
}

/**
 * One palm exposure fixture. `mirrored` swaps which root is on the left so both
 * facings (and the cross-up query side) are exercised by the same table.
 */
function palmScenario({ size = 0.85, phase = "active", mirrored = false, opts }) {
  const s = createFoundationScenario({
    sizeA: size,
    sizeB: size,
    ...(mirrored
      ? { leftX: 700, rightX: 580, leftFacing: 1, rightFacing: -1 }
      : {}),
  });
  const now = s.room.simTime;
  const victim = mirrored ? s.left : s.right;
  const attacker = mirrored ? s.right : s.left;
  armPalmVictim(victim, attacker, now, phase, opts);
  armDeepSlapActive(attacker, now);
  attacker.slapFacingDirection = attacker.x < victim.x ? -1 : 1;
  attacker.facing = attacker.slapFacingDirection;
  return { s, now, victim, attacker };
}

/* ------------------------------------------------------------------ *
 * 1. Authorization surface
 * ------------------------------------------------------------------ */

describe("Phase 4B — palm authorization surface", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));

  it("catalog and server agree on exactly which palm poses are authoritative", () => {
    assert.deepEqual(authoredCatalog.meta.phase4bPalmAllowlist, [
      "palm_active",
      "palm_recovery",
    ]);
    for (const key of authoredCatalog.meta.phase4bPalmAllowlist) {
      assert.equal(
        authoredCatalog.poses[key].phase4bAuthority,
        true,
        `${key} must be marked authoritative in the catalog`
      );
      assert.equal(isAuthoredLimbPoseAuthorityReady(key), true, key);
    }
    // Startup stays overlay-only, exactly like slap_startup.
    assert.equal(EXPOSED_LIMB_POSES.palm_startup, undefined);
    assert.equal(isAuthoredLimbPoseAuthorityReady("palm_startup"), false);
    assert.equal(
      authoredCatalog.poses.palm_startup.phase4bAuthority,
      undefined,
      "palm_startup art is corrected but never authorized"
    );
  });

  it("every authored palm frontArm equals its measured visible arm tip", () => {
    const measured = {
      palm_startup: 54.448,
      palm_active: 71.832,
      palm_recovery: 54.448,
    };
    for (const [poseKey, tip] of Object.entries(measured)) {
      const arm = authoredCatalog.poses[poseKey].regions.find(
        (r) => r.label === "frontArm"
      );
      assert.ok(arm, poseKey);
      assert.equal(
        Number((arm.forward + arm.halfW).toFixed(3)),
        tip,
        `${poseKey} outer edge must equal the measured art tip`
      );
    }
    // The held variant carries the EXTENDED measurement.
    const held = authoredCatalog.poses.palm_recovery.variants.true.regionOverrides.find(
      (r) => r.label === "frontArm"
    );
    assert.equal(Number((held.forward + held.halfW).toFixed(3)), 71.832);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Exposure window (table-driven)
 * ------------------------------------------------------------------ */

describe("Phase 4B — palm exposure window", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));

  const EXPOSURE_TABLE = [
    { phase: "startup", exposed: false, poseKey: "palm_startup", variant: null },
    { phase: "active", exposed: true, poseKey: "palm_active", variant: null },
    {
      phase: "recovery",
      opts: { holdElapsed: 0 },
      exposed: true,
      poseKey: "palm_recovery",
      variant: "true",
      label: "hold opens at recovery start",
    },
    {
      phase: "recovery",
      opts: { holdElapsed: PALM_THRUST_HOLD_MS - 1 },
      exposed: true,
      poseKey: "palm_recovery",
      variant: "true",
      label: "last held ms",
    },
    {
      phase: "recovery",
      opts: { holdElapsed: PALM_THRUST_HOLD_MS },
      exposed: false,
      poseKey: "palm_recovery",
      variant: null,
      label: "art retracts — window closes",
    },
    {
      phase: "recovery_settled",
      exposed: false,
      poseKey: "palm_recovery",
      variant: null,
    },
  ];

  for (const row of EXPOSURE_TABLE) {
    const name = row.label || row.phase;
    it(`${name} → exposed=${row.exposed} (${row.poseKey})`, () => {
      const { s, now, victim } = palmScenario({
        phase: row.phase,
        opts: row.opts,
      });
      const exp = resolveVictimLimbExposure(victim, now);
      assert.equal(exp.exposed, row.exposed, exp.reason);
      assert.equal(exp.poseKey, row.poseKey);
      assert.equal(exp.variantKey, row.variant);
      const limb = getVictimLimbAabb(victim, now);
      assert.equal(!!limb, row.exposed);
      if (row.exposed) {
        assert.equal(Number(limb.reachForward.toFixed(3)), 71.832);
      }
      s.dispose();
    });
  }

  it("the hold window never outlives the extended art (whiff and connect)", () => {
    // Whiff recovery is HOLD+END (320); a connect settles in 200. Both keep the
    // extended sprite up for their whole duration, so both stay honest.
    for (const duration of [320, 200]) {
      const { s, now, victim } = palmScenario({
        phase: "recovery",
        opts: { holdElapsed: 0 },
      });
      victim.recoveryDuration = duration;
      assert.equal(isPalmLimbHoldWindow(victim, now), true, `d=${duration}`);
      assert.equal(
        isPalmLimbHoldWindow(victim, now + PALM_THRUST_HOLD_MS),
        false,
        `d=${duration}: hold must end at PALM_THRUST_HOLD_MS regardless`
      );
      s.dispose();
    }
  });

  it("malformed recovery state refuses instead of guessing", () => {
    for (const broken of [
      { recoveryStartTime: 0 },
      { recoveryStartTime: null },
      { recoveryStartTime: NaN },
      { isRecovering: false },
    ]) {
      const { s, now, victim } = palmScenario({ phase: "recovery" });
      Object.assign(victim, broken);
      const exp = resolveVictimLimbExposure(victim, now);
      assert.equal(
        exp.exposed,
        false,
        `${JSON.stringify(broken)} must not expose a limb`
      );
      assert.equal(getVictimLimbAabb(victim, now), null);
      s.dispose();
    }
  });

  it("an unknown palmLimbExtended value falls back to the RETRACTED volume", () => {
    // The variant is derived server-side, but the resolver must still be safe if
    // a pose is queried with a junk key — never advertise the longer reach.
    const { s, now, victim } = palmScenario({ phase: "recovery_settled" });
    victim.palmLimbExtended = "banana";
    const reach = victimLimbReach(
      Object.assign({}, victim, { isRecovering: true, recoveryStartTime: now }),
      now
    );
    // Still inside the hold window here, so the honest answer is the extended
    // volume — the point is that the JUNK key alone can never select it.
    assert.equal(Number(reach.toFixed(3)), 71.832);
    const settled = authoredCatalog.poses.palm_recovery.regions.find(
      (r) => r.label === "frontArm"
    );
    assert.equal(
      authoredCatalog.poses.palm_recovery.variantDefault,
      undefined,
      "no variantDefault — a missing key can never resolve the extended box"
    );
    assert.equal(Number((settled.forward + settled.halfW).toFixed(3)), 54.448);
    s.dispose();
  });
});

/* ------------------------------------------------------------------ *
 * 3. Contact boundary, sizes, facings (table-driven)
 * ------------------------------------------------------------------ */

describe("Phase 4B — palm limb contact boundary", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));
  afterEach(() => clearLastSlapHurtCommitted());

  const CONTACT_TABLE = [];
  for (const size of [1, 0.85]) {
    for (const mirrored of [false, true]) {
      for (const phase of ["active", "recovery"]) {
        CONTACT_TABLE.push({ size, mirrored, phase });
      }
    }
  }

  for (const row of CONTACT_TABLE) {
    const tag = `size ${row.size} · ${row.mirrored ? "mirrored" : "normal"} · ${row.phase}`;

    it(`${tag}: a genuine limb-only band exists`, () => {
      const { s, now, victim, attacker } = palmScenario(row);
      const reach = limbReachGap("slap", victim, now);
      const gate = torsoGate("slap", attacker, victim);
      assert.ok(
        reach > gate,
        `${tag}: authored palm (${reach.toFixed(2)}) must poke past torso connect (${gate.toFixed(2)})`
      );
      s.dispose();
    });

    it(`${tag}: connects at the visible-touch boundary`, () => {
      const { s, now, victim } = palmScenario(row);
      // BOUNDARY_NUDGE only absorbs the IEEE754 error of the root round-trip
      // (placeAtGap recomputes both roots from a midpoint, which can land the
      // touching edges ~1e-13 apart). Contact itself is exact-touch inclusive.
      placeAtGap(s, limbReachGap("slap", victim, now) - BOUNDARY_NUDGE);
      stepCollisionBothOrders(s);
      assert.equal(victim.isHit, true, `${tag}: must connect at the arm tip`);
      const p = lastHit(s.io);
      assert.equal(p.victimHurtRegion, "frontArm");
      assert.equal(p.victimHurtKind, COMBAT_VOLUME_KIND.HURT_LIMB);
      assert.equal(p.limbOnlyContact, true);
      s.dispose();
    });

    it(`${tag}: misses just beyond the documented epsilon`, () => {
      const { s, now, victim } = palmScenario(row);
      placeAtGap(s, limbReachGap("slap", victim, now) + CONTACT_SNAP_EPSILON + 1);
      stepCollisionBothOrders(s);
      assert.equal(victim.isHit, false, `${tag}: empty air must stay a whiff`);
      assert.equal(lastHit(s.io), null);
      s.dispose();
    });

    it(`${tag}: limb-only contact applies no torso park`, () => {
      const { s, now, victim, attacker } = palmScenario(row);
      const gap = limbOnlyGap("slap", attacker, victim, now);
      assert.ok(gap != null, `${tag}: band required`);
      placeAtGap(s, gap);
      const attackerXBefore = attacker.x;
      stepCollisionBothOrders(s);
      assert.equal(victim.isHit, true);
      assert.equal(
        attacker.x,
        attackerXBefore,
        `${tag}: a limb hit must not suck the attacker to the torso`
      );
      s.dispose();
    });
  }

  it("authored reach matches the measured art tip at BOTH sizes", () => {
    // Sprite width is fixed, so reach must NOT scale with sizeMultiplier.
    for (const size of [1, 0.85]) {
      for (const [phase, poseKey] of [
        ["active", "palm_active"],
        ["recovery", "palm_recovery"],
      ]) {
        const { s, now, victim } = palmScenario({ size, phase });
        const limb = getVictimLimbAabb(victim, now);
        assert.equal(
          Number(limb.reachForward.toFixed(3)),
          VISIBLE_ARM_TIP[poseKey][poseKey === "palm_active" ? 1 : "true"],
          `${poseKey} @ size ${size}`
        );
        s.dispose();
      }
    }
  });

  it("palm victims get NO more slack than slap victims already had", () => {
    // The attacker's authored tip rail is a box, so its outer edge sits a fixed
    // amount past the visible sprite tip. That overhang is accepted Phase 4A
    // attacker geometry; what Phase 4B must guarantee is that the palm victim
    // adds none of its own — the same seam-to-contact offset as a slap victim.
    const attacker = { x: 0, sizeMultiplier: 1, facing: -1 };
    const railOverhang =
      limbSpacingProbeReach("slap") - getStrikeTipWorld("slap", attacker);

    const cases = [
      { phase: "active", poseKey: "palm_active", variant: 1 },
      { phase: "recovery", poseKey: "palm_recovery", variant: "true" },
    ];
    for (const c of cases) {
      const { s, now, victim, attacker: atk } = palmScenario({ phase: c.phase });
      const visible = visibleTouchGap("slap", atk, c.poseKey, c.variant);
      const reach = limbReachGap("slap", victim, now);
      assert.ok(
        Math.abs(reach - visible - railOverhang) < 1e-9,
        `${c.poseKey}: authored contact (${reach.toFixed(3)}) must be the visible seam (${visible.toFixed(3)}) plus only the shared rail overhang (${railOverhang.toFixed(3)})`
      );
      s.dispose();
    }

    // Same offset for a Phase 4A slap victim — palm introduces nothing new.
    const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "active", now);
    s.right.slapAnimation = 2;
    armDeepSlapActive(s.left, now);
    const slapVisible = visibleTouchGap("slap", s.left, "slap_active", 2);
    const slapReach = limbReachGap("slap", s.right, now);
    assert.ok(Math.abs(slapReach - slapVisible - railOverhang) < 1e-9);
    assert.ok(
      railOverhang < CONTACT_SNAP_EPSILON + 1,
      "the shared rail overhang must stay sub-tolerance, not a reach buff"
    );
    s.dispose();
  });
});

/* ------------------------------------------------------------------ *
 * 4. Event identity + presentation contract
 * ------------------------------------------------------------------ */

describe("Phase 4B — palm hit-event identity", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));
  afterEach(() => clearLastSlapHurtCommitted());

  const IDENTITY_TABLE = [
    { phase: "active", poseKey: "palm_active", variant: null },
    { phase: "recovery", poseKey: "palm_recovery", variant: "true" },
  ];

  for (const row of IDENTITY_TABLE) {
    it(`${row.poseKey} stamps generic limb identity, not slap-named fields`, () => {
      const { s, now, victim, attacker } = palmScenario({ phase: row.phase });
      const committedMirror = victim.chargingFacingDirection;
      placeAtGap(s, limbOnlyGap("slap", attacker, victim, now));
      stepCollisionBothOrders(s);

      const p = lastHit(s.io);
      assert.ok(p, "must emit player_hit");
      assert.equal(p.limbOnlyContact, true);
      assert.equal(p.victimLimbFamily, "palm");
      assert.equal(p.victimLimbPoseKey, row.poseKey);
      assert.equal(p.victimLimbPhase, row.phase === "active" ? "active" : "recovery");
      assert.equal(p.victimLimbVariant, row.variant);
      assert.equal(p.victimLimbMirrorFacing, committedMirror);
      assert.equal(p.authoredSlapHurtboxV1, true);
      // Phase 4A slap-named fields must NOT carry palm data.
      assert.equal(p.victimSlapPoseKey, null);
      assert.equal(p.victimSlapPhase, null);
      assert.equal(p.victimSlapVariant, null);
      assert.equal(p.victimSlapMirrorFacing, null);
      s.dispose();
    });
  }

  it("slap contacts keep BOTH the Phase 4A fields and the generic ones", () => {
    const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    armDeepSlapActive(s.left, now);
    const gap = limbOnlyGap("slap", s.left, s.right, now);
    assert.ok(gap != null);
    placeAtGap(s, gap);
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p);
    assert.equal(p.victimSlapPoseKey, "slap_recovery", "Phase 4A field preserved");
    assert.equal(p.victimSlapPhase, "recovery");
    assert.equal(p.victimLimbFamily, "slap");
    assert.equal(p.victimLimbPoseKey, "slap_recovery");
    assert.equal(p.victimLimbPhase, "recovery");
    s.dispose();
  });

  /**
   * The slap open-hit grace lets a DEFERRED hit confirm up to
   * SLAP_GRACE_CONFIRM_SLACK_PX past tip-meets-body. That is a timing
   * allowance, not proof the torso is in reach — but it used to be fed in as
   * `bodyEligible`, so every limb contact inside the slack was labelled
   * torso-plus-limb. Consequences were both visible: the victim lost the
   * struck-limb hold (the arm vanished on the impact frame) and the pair was
   * parked forward onto a torso the tip never touched.
   *
   * The whole palm limb band sits inside that slack, so the palm reproduces it
   * on essentially every whiff-punish.
   */
  for (const row of IDENTITY_TABLE) {
    it(`${row.poseKey} stays limb-only when the open-hit grace confirms the hit`, () => {
      const withGrace = palmScenario({ phase: row.phase });
      const gap = limbOnlyGap(
        "slap",
        withGrace.attacker,
        withGrace.victim,
        withGrace.now
      );
      // Precondition: the torso is genuinely out of reach at this spacing, and
      // the grace slack genuinely covers it.
      const gate = torsoGate("slap", withGrace.attacker, withGrace.victim);
      assert.ok(gap > gate, "torso must be unreachable for this to mean anything");
      assert.ok(
        gap <=
          getConnectDistance("slap", withGrace.attacker, withGrace.victim) +
            SLAP_GRACE_CONFIRM_SLACK_PX,
        "and the grace slack must cover it, or this is not the defect"
      );

      withGrace.attacker.slapOpenHitPending = true;
      placeAtGap(withGrace.s, gap);
      stepCollisionBothOrders(withGrace.s);
      const graced = lastHit(withGrace.s.io);
      assert.ok(graced, "the grace still commits the hit");
      assert.equal(graced.limbOnlyContact, true, "grace must not relabel the limb");
      assert.equal(graced.victimLimbFamily, "palm");
      assert.equal(graced.victimLimbPoseKey, row.poseKey);
      assert.equal(graced.victimHurtRegion, "frontArm");
      const gracedCommit = getLastSlapHurtCommitted();
      assert.equal(gracedCommit.parkPolicy, "skip_limb_only", "no torso suction");
      withGrace.s.dispose();
      clearLastSlapHurtCommitted();

      // Identical spacing without the grace flag must classify identically.
      const plain = palmScenario({ phase: row.phase });
      placeAtGap(plain.s, gap);
      stepCollisionBothOrders(plain.s);
      const p = lastHit(plain.s.io);
      assert.equal(p.limbOnlyContact, true);
      assert.equal(
        getLastSlapHurtCommitted().parkPolicy,
        gracedCommit.parkPolicy,
        "the grace flag must not change classification at all"
      );
      plain.s.dispose();
    });
  }

  it("a grace confirm BEYOND the arm is an honest torso hit, not a fake limb", () => {
    const { s, now, victim, attacker } = palmScenario({ phase: "recovery" });
    const reach = limbReachGap("slap", victim, now);
    const beyond = reach + 2;
    assert.ok(
      beyond <=
        getConnectDistance("slap", attacker, victim) + SLAP_GRACE_CONFIRM_SLACK_PX,
      "still inside the grace slack"
    );
    attacker.slapOpenHitPending = true;
    placeAtGap(s, beyond);
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p, "the grace commits it");
    assert.equal(p.limbOnlyContact, false, "the arm was never touched");
    assert.equal(p.victimLimbFamily, null);
    assert.equal(p.victimLimbPoseKey, null);
    assert.equal(p.victimHurtRegion, "torso");
    s.dispose();
  });

  it("real torso range still parks and is still not limb-only, grace or not", () => {
    for (const pending of [false, true]) {
      const { s, victim, attacker } = palmScenario({ phase: "recovery" });
      attacker.slapOpenHitPending = pending;
      placeAtGap(s, torsoGate("slap", attacker, victim) - 2);
      stepCollisionBothOrders(s);
      assert.equal(lastHit(s.io).limbOnlyContact, false);
      assert.equal(getLastSlapHurtCommitted().parkPolicy, "torso_park");
      s.dispose();
      clearLastSlapHurtCommitted();
    }
  });

  it("Phase 4A slap victims get the same grace-band correction", () => {
    const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    armDeepSlapActive(s.left, now);
    s.left.slapOpenHitPending = true;
    placeAtGap(s, limbOnlyGap("slap", s.left, s.right, now));
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.equal(p.limbOnlyContact, true);
    assert.equal(p.victimSlapPoseKey, "slap_recovery");
    assert.equal(getLastSlapHurtCommitted().parkPolicy, "skip_limb_only");
    s.dispose();
  });

  it("torso-plus-limb palm contact is NOT reported as limb-only", () => {
    const { s, now, victim, attacker } = palmScenario({ phase: "active" });
    const gate = torsoGate("slap", attacker, victim);
    assert.ok(limbReachGap("slap", victim, now) > gate - 1);
    placeAtGap(s, gate - 2);
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p);
    assert.equal(
      p.limbOnlyContact,
      false,
      "body contact must keep ordinary hit presentation"
    );
    s.dispose();
  });

  it("ordinary torso contact against a neutral victim is unchanged", () => {
    const s = createFoundationScenario({ gap: 100, sizeA: 0.85, sizeB: 0.85 });
    const now = s.room.simTime;
    clearActionState(s.right);
    armDeepSlapActive(s.left, now);
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p, "torso hit must still emit");
    assert.notEqual(p.limbOnlyContact, true);
    assert.notEqual(p.victimHurtRegion, "frontArm");
    assert.equal(p.victimLimbPoseKey, null);
    assert.equal(p.victimLimbFamily, null);
    s.dispose();
  });

  it("one palm limb contact = exactly one event, and repeats do not duplicate", () => {
    const { s, now, victim, attacker } = palmScenario({ phase: "recovery" });
    placeAtGap(s, limbOnlyGap("slap", attacker, victim, now));
    stepCollisionBothOrders(s);
    assert.equal(s.io.find("player_hit").length, 1);
    assert.equal(victim.isHit, true, "authoritative reaction is NOT delayed");
    assert.ok(s.room.hitstopUntil > 0, "hitstop armed once");
    stepCollisionBothOrders(s);
    assert.equal(s.io.find("player_hit").length, 1, "no duplicate event");
    s.dispose();
  });

  it("flag OFF is exact legacy: no palm limb window, no identity fields", () => {
    setAuthoredSlapHurtboxForTests(false);
    for (const phase of ["active", "recovery"]) {
      const { s, now, victim, attacker } = palmScenario({ phase });
      // A gap that ONLY the authored limb could reach.
      const gap = limbOnlyGap("slap", attacker, victim, now);
      assert.ok(gap != null);
      placeAtGap(s, gap);
      stepCollisionBothOrders(s);
      assert.equal(
        victim.isHit,
        false,
        `${phase}: flag OFF must not confirm on an authored limb`
      );
      assert.equal(lastHit(s.io), null);
      // Pose exposure and limb geometry are pure bookkeeping (same as Phase 4A);
      // the FLAG is what decides whether contact resolution may consult them.
      const resolved = resolveAuthoredSlapHurtContact(attacker, victim, {
        simTime: now,
        attackKind: "slap",
      });
      assert.notEqual(
        resolved.mode,
        "authored_slap_hurtbox_v1",
        `${phase}: flag OFF must not run authored resolution`
      );
      assert.equal(resolved.winner, null);
      assert.equal(resolved.limb, null);
      s.dispose();
    }
    setAuthoredSlapHurtboxForTests(true);
  });
});

/* ------------------------------------------------------------------ *
 * 5. Overlay parity
 * ------------------------------------------------------------------ */

describe("Phase 4B — palmLimbExtended overlay parity", () => {
  before(() => setAuthoredSlapHurtboxForTests(true));
  after(() => setAuthoredSlapHurtboxForTests(null));

  const PARITY_TABLE = [
    { phase: "active", opts: undefined, extended: false },
    { phase: "recovery", opts: { holdElapsed: 0 }, extended: true },
    {
      phase: "recovery",
      opts: { holdElapsed: PALM_THRUST_HOLD_MS - 1 },
      extended: true,
    },
    { phase: "recovery_settled", opts: undefined, extended: false },
  ];

  for (const row of PARITY_TABLE) {
    it(`${row.phase}${row.opts ? ` @${row.opts.holdElapsed}ms` : ""} publishes palmLimbExtended=${row.extended}`, () => {
      const { s, now, victim } = palmScenario({
        phase: row.phase,
        opts: row.opts,
      });
      assert.equal(refreshPalmLimbExtended(victim, now), row.extended);
      assert.equal(victim.palmLimbExtended, row.extended);
      // The overlay resolves palm_recovery's variant from this exact field, so
      // it must agree with the window authority derived independently.
      assert.equal(isPalmLimbHoldWindow(victim, now), row.extended);
      s.dispose();
    });
  }

  it("palmLimbExtended is networked and defaults false", () => {
    const { DELTA_TRACKED_PROPS } = require("../../constants");
    assert.ok(
      DELTA_TRACKED_PROPS.includes("palmLimbExtended"),
      "the overlay cannot mirror authority unless this field ships"
    );
    const { createInitialPlayerState } = require("../../playerFactory");
    assert.equal(createInitialPlayerState({ id: "x" }).palmLimbExtended, false);
  });

  it("a non-palm player is always published false", () => {
    const s = createFoundationScenario();
    const now = s.room.simTime;
    armSlapPhase(s.right, "recovery", now);
    assert.equal(refreshPalmLimbExtended(s.right, now), false);
    assert.equal(s.right.palmLimbExtended, false);
    s.dispose();
  });

  it("authority ignores a forged palmLimbExtended on the wire", () => {
    const { s, now, victim } = palmScenario({ phase: "recovery_settled" });
    victim.palmLimbExtended = true;
    assert.equal(
      resolveVictimLimbExposure(victim, now).exposed,
      false,
      "the settled tail must stay closed even if the field says otherwise"
    );
    assert.equal(getVictimLimbAabb(victim, now), null);
    s.dispose();
  });
});
