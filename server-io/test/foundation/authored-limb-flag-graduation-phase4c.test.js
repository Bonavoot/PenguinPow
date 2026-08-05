"use strict";

/**
 * Phase 4C — AUTHORED_SLAP_HURTBOX_V1 graduation to default ON.
 *
 * These tests drive the REAL process.env through the real checkCollision path
 * rather than the test override, because the thing being graduated is the
 * parsing default itself: an override would happily pass even if the shipped
 * default were still OFF.
 *
 * Invariant under test: unset is now indistinguishable from explicit ON, and
 * only the four recognized OFF spellings restore exact legacy authority.
 */

const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setAuthoredSlapHurtboxForTests,
  isAuthoredSlapHurtboxV1Enabled,
} = require("../../authoredSlapHurtboxFlags");
const {
  resolveVictimLimbExposure,
  resolveAuthoredSlapHurtContact,
  refreshPalmLimbExtended,
  clearLastSlapHurtCommitted,
  getLastSlapHurtCommitted,
} = require("../../authoredSlapHurtTarget");
const {
  createFoundationScenario,
  armSlapPhase,
  armPalmPhase,
  stepCollisionBothOrders,
  placeAtGap,
  SLAP_STARTUP_MS,
  SLAP_ACTIVE_MS,
  SLAP_RECOVERY_MS,
} = require("./helpers/scenarioHarness");
const { limbOnlyGap, torsoGate } = require("./helpers/limbSpacing");
const { AP_LATE_PARRY_MS } = require("../../constants");
const { DELTA_TRACKED_PROPS } = require("../../constants");

const OFF_SPELLINGS = ["0", "false", "off", "no"];
const ON_SPELLINGS = ["1", "true", "on", "yes"];

const ENV_KEY = "AUTHORED_SLAP_HURTBOX_V1";
let savedEnv;

/** Drive the shipped parser, not the test override. `null` means unset. */
function withEnv(value) {
  setAuthoredSlapHurtboxForTests(null);
  if (value === null) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
}

function armDeepSlapActive(p, now) {
  armSlapPhase(p, "active", now);
  p.isInStartupFrames = false;
  p.attackStartTime = now - SLAP_STARTUP_MS - AP_LATE_PARRY_MS - 20;
  p.slapActiveEndTime = p.attackStartTime + SLAP_STARTUP_MS + SLAP_ACTIVE_MS;
  p.attackEndTime = p.slapActiveEndTime + SLAP_RECOVERY_MS;
}

/**
 * Attacker mid-slap, victim showing the named limb, placed at the spacing where
 * ONLY the authored limb can be reached (torso provably out of connect).
 */
function limbOnlyScenario(family, size = 0.85) {
  const s = createFoundationScenario({ sizeA: size, sizeB: size });
  const now = s.room.simTime;
  const victim = s.right;
  const attacker = s.left;
  if (family === "palm") {
    armPalmPhase(victim, "recovery", now, { holdElapsed: 10 });
    victim.chargingFacingDirection = 1;
  } else {
    armSlapPhase(victim, "recovery", now);
  }
  victim.facing = 1;
  refreshPalmLimbExtended(victim, now);
  armDeepSlapActive(attacker);
  armDeepSlapActive(attacker, now);
  attacker.slapFacingDirection = -1;
  attacker.facing = -1;
  const gap = limbOnlyGap("slap", attacker, victim, now);
  assert.ok(gap != null, `${family} must have a limb-only window`);
  assert.ok(
    gap > torsoGate("slap", attacker, victim),
    "the torso must be provably out of legacy connect at this spacing"
  );
  placeAtGap(s, gap);
  return { s, now, victim, attacker, gap };
}

function lastHit(io) {
  const h = io.last("player_hit");
  return h ? h.payload : null;
}

describe("Phase 4C — flag graduation: unset now equals explicit ON", () => {
  before(() => {
    savedEnv = process.env[ENV_KEY];
  });
  after(() => {
    if (savedEnv === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = savedEnv;
    setAuthoredSlapHurtboxForTests(null);
  });
  afterEach(() => clearLastSlapHurtCommitted());

  for (const family of ["slap", "palm"]) {
    it(`${family}: unset produces the same committed contact as explicit ON`, () => {
      const results = [];
      for (const env of [null, ...ON_SPELLINGS]) {
        withEnv(env);
        assert.equal(isAuthoredSlapHurtboxV1Enabled(), true, String(env));
        const { s } = limbOnlyScenario(family);
        stepCollisionBothOrders(s);
        const p = lastHit(s.io);
        assert.ok(p, `${family} limb hit must land with env=${env}`);
        results.push({
          env,
          limbOnly: p.limbOnlyContact,
          family: p.victimLimbFamily,
          pose: p.victimLimbPoseKey,
          region: p.victimHurtRegion,
          kind: p.victimHurtKind,
          authored: p.authoredSlapHurtboxV1,
          park: getLastSlapHurtCommitted().parkPolicy,
        });
        s.dispose();
        clearLastSlapHurtCommitted();
      }
      const [unset, ...explicitOn] = results;
      assert.equal(unset.limbOnly, true);
      assert.equal(unset.family, family);
      assert.equal(unset.region, "frontArm");
      assert.equal(unset.authored, true);
      assert.equal(unset.park, "skip_limb_only", "limb-only must not torso-park");
      for (const r of explicitOn) {
        assert.deepEqual(
          { ...r, env: null },
          { ...unset, env: null },
          `explicit ${r.env} must be identical to unset`
        );
      }
    });
  }

  it("malformed values behave exactly like the shipped default, not like legacy", () => {
    withEnv("nope");
    assert.equal(isAuthoredSlapHurtboxV1Enabled(), true);
    const { s } = limbOnlyScenario("palm");
    stepCollisionBothOrders(s);
    assert.equal(lastHit(s.io).limbOnlyContact, true);
    s.dispose();
  });
});

describe("Phase 4C — every explicit-OFF spelling is exact legacy", () => {
  before(() => {
    savedEnv = process.env[ENV_KEY];
  });
  after(() => {
    if (savedEnv === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = savedEnv;
    setAuthoredSlapHurtboxForTests(null);
  });
  afterEach(() => clearLastSlapHurtCommitted());

  for (const spelling of OFF_SPELLINGS) {
    for (const family of ["slap", "palm"]) {
      it(`${spelling}: ${family} limb-only spacing is a clean miss again`, () => {
        withEnv(spelling);
        assert.equal(isAuthoredSlapHurtboxV1Enabled(), false);
        const { s, victim } = limbOnlyScenario(family);
        stepCollisionBothOrders(s);
        assert.equal(victim.isHit, false, "no limb window under legacy authority");
        assert.equal(lastHit(s.io), null, "and therefore no hit event at all");
        // No authored identity can be stamped when nothing committed.
        assert.equal(getLastSlapHurtCommitted(), null);
        s.dispose();
      });
    }
  }

  it("case and whitespace variants roll back identically", () => {
    for (const spelling of ["OFF", " 0 ", "False", "NO"]) {
      withEnv(spelling);
      assert.equal(isAuthoredSlapHurtboxV1Enabled(), false, spelling);
      const { s, victim } = limbOnlyScenario("palm");
      stepCollisionBothOrders(s);
      assert.equal(victim.isHit, false, spelling);
      s.dispose();
    }
  });

  it("OFF refuses to open a limb window for slap or palm recovery", () => {
    withEnv("0");
    for (const family of ["slap", "palm"]) {
      const { s, now, victim, attacker, gap } = limbOnlyScenario(family);
      // resolveVictimLimbExposure stays a DESCRIPTIVE lifecycle query (what the
      // victim is drawing) and is deliberately not flag-gated; the flag gates
      // the authority layer below, which is what may never open a window.
      const res = resolveAuthoredSlapHurtContact(attacker, victim, {
        simTime: now,
        attackKind: "slap",
        bodyEligible: false,
        torsoEligible: false,
        bodyDist: gap,
        attackDir: -1,
      });
      assert.equal(res.mode, "legacy", `${family} must resolve on the legacy path`);
      assert.equal(res.connect, false, `${family} limb must not connect`);
      assert.equal(res.limb, null, `${family} limb must not even be evaluated`);
      assert.equal(res.winner, null);
      s.dispose();
    }
  });

  it("OFF keeps genuine torso contact landing, parked the legacy way", () => {
    withEnv("off");
    const { s, victim, attacker } = limbOnlyScenario("palm");
    placeAtGap(s, torsoGate("slap", attacker, victim) - 2);
    stepCollisionBothOrders(s);
    const p = lastHit(s.io);
    assert.ok(p, "ordinary torso hits are untouched by the rollback");
    assert.equal(victim.isHit, true);
    // Legacy stamps carry no authored victim-limb identity. Absent and false
    // are equally legacy here — the fields are simply never authored.
    assert.ok(!p.limbOnlyContact);
    assert.equal(p.victimLimbFamily ?? null, null);
    assert.equal(p.victimLimbPoseKey ?? null, null);
    assert.equal(p.victimLimbVariant ?? null, null);
    assert.ok(!p.authoredSlapHurtboxV1, "no authored-limb authority stamp");
    s.dispose();
  });

  it("OFF never selects the limb-only park policy", () => {
    withEnv("no");
    const { s, victim, attacker } = limbOnlyScenario("slap");
    placeAtGap(s, torsoGate("slap", attacker, victim) - 2);
    stepCollisionBothOrders(s);
    const committed = getLastSlapHurtCommitted();
    if (committed) {
      assert.notEqual(committed.parkPolicy, "skip_limb_only");
    }
    s.dispose();
  });
});

describe("Phase 4C — graduation changes no wire contract", () => {
  before(() => {
    savedEnv = process.env[ENV_KEY];
  });
  after(() => {
    if (savedEnv === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = savedEnv;
    setAuthoredSlapHurtboxForTests(null);
  });

  it("the delta-tracked property set is identical either way", () => {
    withEnv("1");
    const on = [...DELTA_TRACKED_PROPS];
    withEnv("0");
    const off = [...DELTA_TRACKED_PROPS];
    withEnv(null);
    assert.deepEqual(on, off, "the flag must not add or remove networked props");
    assert.deepEqual([...DELTA_TRACKED_PROPS], on);
    assert.ok(
      DELTA_TRACKED_PROPS.includes("palmLimbExtended"),
      "the Phase 4B overlay-parity boolean ships in both states"
    );
  });

  it("authority ignores forged wire state regardless of flag state", () => {
    for (const env of ["1", "0", null]) {
      withEnv(env);
      const s = createFoundationScenario({ sizeA: 0.85, sizeB: 0.85 });
      const now = s.room.simTime;
      // Neutral victim claiming an extended palm on the wire.
      s.right.palmLimbExtended = true;
      assert.equal(
        resolveVictimLimbExposure(s.right, now).exposed,
        false,
        `env=${env}: a neutral fighter is never exposed just because the wire says so`
      );
      s.dispose();
    }
  });
});
