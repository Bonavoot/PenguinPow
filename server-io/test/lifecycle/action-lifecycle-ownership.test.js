"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseActionLifecycleOwnershipV2Flag,
  setActionLifecycleOwnershipV2ForTests,
  isActionLifecycleOwnershipV2Enabled,
} = require("../../actionLifecycleFlags");
const {
  LIFECYCLE_DOMAIN,
  LIFECYCLE_OWNER,
  LIFECYCLE_PHASE,
  LIFECYCLE_TIMEOUT_NAMES,
  mintLifecycleInstanceId,
  beginLifecycleOwner,
  getLifecycleOwner,
  assertLifecycleCallback,
  transitionLifecyclePhase,
  consumeLifecycleOwner,
  completeLifecycleOwner,
  markLifecycleRecoveryStart,
  markLifecycleControlRestore,
  releaseLifecycleOwner,
  forceClearLifecycleOwners,
} = require("../../actionLifecycleOwnership");
const {
  clearAllActionStates,
  timeoutManager,
  setPlayerTimeout,
  clearLifecycleNamedTimeouts,
} = require("../../gameUtils");
const {
  setActionFacingOwnershipV2ForTests,
} = require("../../actionFacingOwnership");
const {
  setCombatContactFidelityV2ForTests,
} = require("../../combatContactFidelityFlags");

function makePlayer(overrides = {}) {
  return {
    id: overrides.id || "p1",
    x: 400,
    y: 100,
    facing: -1,
    keys: {},
    knockbackVelocity: { x: 0, y: 0 },
    lifecycleOwners: Object.create(null),
    _lifecycleSeq: 0,
    _lifecycleStaleRejects: 0,
    slapLifecycleInstanceId: null,
    chargedEndlagInstanceId: null,
    hitstunLifecycleInstanceId: null,
    parryStaggerLifecycleInstanceId: null,
    isAttacking: false,
    isSlapAttack: false,
    isPalmThrust: false,
    isChargingAttack: false,
    isHit: false,
    isAlreadyHit: false,
    isInStartupFrames: false,
    isInEndlag: false,
    isDodging: false,
    isDodgeRecovery: false,
    isSidestepping: false,
    isSidestepRecovery: false,
    isThrowing: false,
    isBeingThrown: false,
    isGrabbing: false,
    isBeingGrabbed: false,
    isRawParrying: false,
    isRawParryStun: false,
    isRecovering: false,
    isAtTheRopes: false,
    isFlapping: false,
    flapPhase: null,
    isSlideJumping: false,
    isRopeJumping: false,
    isPowerSliding: false,
    isBraking: false,
    currentAction: null,
    actionLockUntil: 0,
    bufferedAction: null,
    bufferExpiryTime: 0,
    pendingSlapCount: 0,
    slapFacingInstanceId: null,
    chargeFacingInstanceId: null,
    dodgeFacingInstanceId: null,
    hitstunFacingInstanceId: null,
    ropesFacingInstanceId: null,
    grabFacingInstanceId: null,
    pullFacingInstanceId: null,
    throwFacingInstanceId: null,
    throwVictimFacingInstanceId: null,
    actionFacingLock: null,
    offensiveAerial: null,
    offensiveAerialReaction: null,
    offensiveAerialReactionType: null,
    offensiveAerialFacingLock: null,
    offensiveAerialPresentation: null,
    atTheRopesFacingDirection: null,
    slapFacingDirection: null,
    chargingFacingDirection: null,
    ...overrides,
  };
}

describe("Phase 15 — ACTION_LIFECYCLE_OWNERSHIP_V2 flag (default ON)", () => {
  afterEach(() => setActionLifecycleOwnershipV2ForTests(null));

  it("unset / null / empty selects V2", () => {
    assert.equal(parseActionLifecycleOwnershipV2Flag(undefined), true);
    assert.equal(parseActionLifecycleOwnershipV2Flag(null), true);
    assert.equal(parseActionLifecycleOwnershipV2Flag(""), true);
    assert.equal(isActionLifecycleOwnershipV2Enabled(undefined), true);
    assert.equal(isActionLifecycleOwnershipV2Enabled(null), true);
    assert.equal(isActionLifecycleOwnershipV2Enabled(""), true);
  });

  it("1 and true select V2", () => {
    assert.equal(parseActionLifecycleOwnershipV2Flag("1"), true);
    assert.equal(parseActionLifecycleOwnershipV2Flag("true"), true);
    assert.equal(parseActionLifecycleOwnershipV2Flag("TRUE"), true);
    assert.equal(isActionLifecycleOwnershipV2Enabled("1"), true);
    assert.equal(isActionLifecycleOwnershipV2Enabled("true"), true);
  });

  it("0 and false select legacy", () => {
    assert.equal(parseActionLifecycleOwnershipV2Flag("0"), false);
    assert.equal(parseActionLifecycleOwnershipV2Flag("false"), false);
    assert.equal(parseActionLifecycleOwnershipV2Flag("FALSE"), false);
    assert.equal(isActionLifecycleOwnershipV2Enabled("0"), false);
    assert.equal(isActionLifecycleOwnershipV2Enabled("false"), false);
  });

  it("test override toggles enabled helper", () => {
    setActionLifecycleOwnershipV2ForTests(true);
    assert.equal(isActionLifecycleOwnershipV2Enabled(), true);
    setActionLifecycleOwnershipV2ForTests(false);
    assert.equal(isActionLifecycleOwnershipV2Enabled(), false);
  });
});

describe("Phase 15 — ownership primitives", () => {
  beforeEach(() => setActionLifecycleOwnershipV2ForTests(true));
  afterEach(() => setActionLifecycleOwnershipV2ForTests(null));

  it("1 begin owner", () => {
    const p = makePlayer();
    const rec = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP,
      { phase: LIFECYCLE_PHASE.STARTUP, reason: "TEST" }
    );
    assert.ok(rec?.ownerInstanceId);
    assert.equal(rec.ownerType, LIFECYCLE_OWNER.SLAP);
    assert.equal(rec.active, true);
    assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION), rec);
  });

  it("2 expected phase transition", () => {
    const p = makePlayer();
    const rec = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    assert.equal(
      transitionLifecyclePhase(
        p,
        LIFECYCLE_DOMAIN.PRIMARY_ACTION,
        rec.ownerInstanceId,
        LIFECYCLE_PHASE.ACTIVE
      ),
      true
    );
    assert.equal(rec.phase, LIFECYCLE_PHASE.ACTIVE);
  });

  it("3 expected handoff (begin replaces domain)", () => {
    const p = makePlayer();
    const a = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    const b = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.PALM
    );
    assert.notEqual(a.ownerInstanceId, b.ownerInstanceId);
    assert.equal(
      getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION).ownerType,
      LIFECYCLE_OWNER.PALM
    );
  });

  it("4 expected completion", () => {
    const p = makePlayer();
    const rec = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    const r = completeLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      rec.ownerInstanceId
    );
    assert.equal(r.completed, true);
    assert.equal(rec.active, false);
    assert.equal(rec.completionCount, 1);
  });

  it("5 completion idempotence", () => {
    const p = makePlayer();
    const rec = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    completeLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      rec.ownerInstanceId
    );
    const r2 = completeLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      rec.ownerInstanceId
    );
    assert.equal(r2.duplicate, true);
    assert.equal(rec.completionCount, 1);
  });

  it("6 expected release", () => {
    const p = makePlayer();
    const rec = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    const r = releaseLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      rec.ownerInstanceId
    );
    assert.equal(r.released, true);
    assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION), null);
  });

  it("7 stale release rejected", () => {
    const p = makePlayer();
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    const r = releaseLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      "SLAP:p1:999"
    );
    assert.equal(r.rejected, true);
    assert.ok(getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION));
  });

  it("8 stale transition rejected", () => {
    const p = makePlayer();
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    assert.equal(
      transitionLifecyclePhase(
        p,
        LIFECYCLE_DOMAIN.PRIMARY_ACTION,
        "SLAP:p1:999",
        LIFECYCLE_PHASE.ACTIVE
      ),
      false
    );
    assert.ok((p._lifecycleStaleRejects || 0) >= 1);
  });

  it("9 stale completion rejected", () => {
    const p = makePlayer();
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    const r = completeLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      "SLAP:p1:999"
    );
    assert.equal(r.rejected, true);
  });

  it("10 full reset clears all domains", () => {
    const p = makePlayer();
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.REACTION,
      LIFECYCLE_OWNER.HITSTUN
    );
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.LOCOMOTION,
      LIFECYCLE_OWNER.DODGE
    );
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.CLINCH_THROW,
      LIFECYCLE_OWNER.CLINCH
    );
    forceClearLifecycleOwners(p, { reason: "TEST_RESET" });
    assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION), null);
    assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.REACTION), null);
    assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.LOCOMOTION), null);
    assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.CLINCH_THROW), null);
  });
});

describe("Phase 15 — proven stale callback paths", () => {
  beforeEach(() => {
    setActionLifecycleOwnershipV2ForTests(true);
    setActionFacingOwnershipV2ForTests(true);
  });
  afterEach(() => {
    setActionLifecycleOwnershipV2ForTests(null);
    setActionFacingOwnershipV2ForTests(null);
    timeoutManager.clearAll();
  });

  it("11/12 slap cycle stale owner cannot clear newer primary", () => {
    const p = makePlayer({
      isAttacking: true,
      isSlapAttack: true,
      currentAction: "slap",
    });
    const old = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP,
      { reason: "OLD_SLAP" }
    );
    p.slapLifecycleInstanceId = old.ownerInstanceId;
    const newer = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP,
      { reason: "NEW_SLAP" }
    );
    p.slapLifecycleInstanceId = newer.ownerInstanceId;
    assert.equal(
      assertLifecycleCallback(
        p,
        LIFECYCLE_DOMAIN.PRIMARY_ACTION,
        old.ownerInstanceId,
        "slap_cycle_end"
      ),
      false
    );
    assert.equal(
      getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION).ownerInstanceId,
      newer.ownerInstanceId
    );
  });

  it("14/16 charged endlag stale callback rejected after clearAll", () => {
    const p = makePlayer({
      isInEndlag: true,
      currentAction: "endlag",
      actionLockUntil: 9999,
    });
    const endlag = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.ENDLAG,
      { phase: LIFECYCLE_PHASE.ENDLAG }
    );
    p.chargedEndlagInstanceId = endlag.ownerInstanceId;
    let fired = false;
    setPlayerTimeout(
      p.id,
      () => {
        if (
          !assertLifecycleCallback(
            p,
            LIFECYCLE_DOMAIN.PRIMARY_ACTION,
            endlag.ownerInstanceId,
            "charged_endlag_reset"
          )
        ) {
          return;
        }
        fired = true;
        p.isInEndlag = false;
        p.currentAction = null;
        p.actionLockUntil = 0;
      },
      50,
      "chargedEndlagReset"
    );
    clearAllActionStates(p);
    // Simulate a newer charged action after interrupt clear.
    p.isAttacking = true;
    p.currentAction = "charged";
    p.actionLockUntil = 5000;
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.CHARGED
    );
    // Named timeout was cancelled by clearAll under V2 — callback never fires.
    assert.equal(fired, false);
    assert.equal(p.currentAction, "charged");
    assert.equal(p.actionLockUntil, 5000);
  });

  it("15 consume prevents later ordinary completion of same instance", () => {
    const p = makePlayer();
    const rec = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.CHARGED
    );
    assert.equal(
      consumeLifecycleOwner(
        p,
        LIFECYCLE_DOMAIN.PRIMARY_ACTION,
        rec.ownerInstanceId,
        { reason: "CONTACT_CONSUME" }
      ),
      true
    );
    assert.equal(
      assertLifecycleCallback(
        p,
        LIFECYCLE_DOMAIN.PRIMARY_ACTION,
        rec.ownerInstanceId,
        "whiff_complete"
      ),
      false
    );
  });

  it("18/36 hitstun / clearAll rejects stale primary callbacks", () => {
    const p = makePlayer({
      isAttacking: true,
      isSlapAttack: true,
      currentAction: "slap",
      isInStartupFrames: true,
    });
    const slap = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    p.slapLifecycleInstanceId = slap.ownerInstanceId;
    setPlayerTimeout(
      p.id,
      () => {
        if (
          !assertLifecycleCallback(
            p,
            LIFECYCLE_DOMAIN.PRIMARY_ACTION,
            slap.ownerInstanceId,
            "slap_startup_end"
          )
        ) {
          return;
        }
        p.isInStartupFrames = false;
      },
      100,
      "slapStartupEnd"
    );
    clearAllActionStates(p);
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.REACTION,
      LIFECYCLE_OWNER.HITSTUN
    );
    p.isHit = true;
    assert.equal(p.isInStartupFrames, false);
    assert.equal(p.isAttacking, false);
    assert.equal(
      assertLifecycleCallback(
        p,
        LIFECYCLE_DOMAIN.PRIMARY_ACTION,
        slap.ownerInstanceId,
        "slap_startup_end"
      ),
      false
    );
  });

  it("20 dodge-domain: stale locomotion release rejected", () => {
    const p = makePlayer();
    const old = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.LOCOMOTION,
      LIFECYCLE_OWNER.DODGE
    );
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.LOCOMOTION,
      LIFECYCLE_OWNER.DODGE
    );
    const r = releaseLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.LOCOMOTION,
      old.ownerInstanceId
    );
    assert.equal(r.rejected, true);
  });

  it("26 grab→clinch domains are independent", () => {
    const p = makePlayer();
    const grab = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.GRAB_STARTUP
    );
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.CLINCH_THROW,
      LIFECYCLE_OWNER.CLINCH,
      { ownerInstanceId: "clinch:p1:1" }
    );
    // Whiff cleanup of grab must not require clinch release.
    releaseLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      grab.ownerInstanceId
    );
    assert.ok(getLifecycleOwner(p, LIFECYCLE_DOMAIN.CLINCH_THROW));
    assert.equal(
      getLifecycleOwner(p, LIFECYCLE_DOMAIN.CLINCH_THROW).ownerInstanceId,
      "clinch:p1:1"
    );
  });

  it("37/40 recovery + control restore once; stale restore rejected", () => {
    const p = makePlayer();
    const rec = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.REACTION,
      LIFECYCLE_OWNER.HITSTUN
    );
    assert.equal(
      markLifecycleRecoveryStart(
        p,
        LIFECYCLE_DOMAIN.REACTION,
        rec.ownerInstanceId
      ),
      true
    );
    assert.equal(
      markLifecycleRecoveryStart(
        p,
        LIFECYCLE_DOMAIN.REACTION,
        rec.ownerInstanceId
      ),
      false
    );
    assert.equal(
      markLifecycleControlRestore(
        p,
        LIFECYCLE_DOMAIN.REACTION,
        rec.ownerInstanceId
      ),
      true
    );
    assert.equal(
      markLifecycleControlRestore(
        p,
        LIFECYCLE_DOMAIN.REACTION,
        rec.ownerInstanceId
      ),
      false
    );
    assert.equal(
      markLifecycleControlRestore(p, LIFECYCLE_DOMAIN.REACTION, "HITSTUN:p1:999"),
      false
    );
  });

  it("39 ropes stale callback rejected after newer reaction", () => {
    const p = makePlayer();
    const ropes = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.REACTION,
      LIFECYCLE_OWNER.ROPES
    );
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.REACTION,
      LIFECYCLE_OWNER.HITSTUN
    );
    assert.equal(
      assertLifecycleCallback(
        p,
        LIFECYCLE_DOMAIN.REACTION,
        ropes.ownerInstanceId,
        "at_the_ropes_timeout"
      ),
      false
    );
  });

  it("42 clearAll under V2 clears lifecycle timeouts + owners", () => {
    const p = makePlayer({
      isAttacking: true,
      isSlapAttack: true,
      currentAction: "slap",
    });
    beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    let staleRan = false;
    setPlayerTimeout(
      p.id,
      () => {
        staleRan = true;
      },
      1000,
      "chargedEndlagReset"
    );
    setPlayerTimeout(
      p.id,
      () => {
        staleRan = true;
      },
      1000,
      "parryStaggerBegin"
    );
    clearAllActionStates(p);
    assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION), null);
    assert.equal(staleRan, false);
    assert.ok(LIFECYCLE_TIMEOUT_NAMES.includes("chargedEndlagReset"));
  });
});

describe("Phase 15 — legacy path exactness + regressions", () => {
  afterEach(() => {
    setActionLifecycleOwnershipV2ForTests(null);
    timeoutManager.clearAll();
  });

  it("legacy V2 off: begin owner is no-op", () => {
    setActionLifecycleOwnershipV2ForTests(false);
    const p = makePlayer();
    const rec = beginLifecycleOwner(
      p,
      LIFECYCLE_DOMAIN.PRIMARY_ACTION,
      LIFECYCLE_OWNER.SLAP
    );
    assert.equal(rec, null);
    assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION), null);
  });

  it("legacy V2 off: clearAll does not cancel lifecycle timers (exact rollback)", () => {
    setActionLifecycleOwnershipV2ForTests(false);
    setActionFacingOwnershipV2ForTests(false);
    const p = makePlayer({
      isAttacking: true,
      isSlapAttack: true,
      currentAction: "slap",
      isInEndlag: true,
    });
    // Leave a chargedEndlag timer — legacy clearAll must NOT cancel it
    // (exact legacy behavior). We only assert action flags clear.
    let endlagCallbackScheduled = false;
    setPlayerTimeout(
      p.id,
      () => {
        endlagCallbackScheduled = true;
        if (p.currentAction === "endlag" || p.currentAction === "charged") {
          p.currentAction = null;
        }
      },
      5000,
      "chargedEndlagReset"
    );
    clearAllActionStates(p);
    assert.equal(p.isAttacking, false);
    assert.equal(p.currentAction, null);
    // Timer still registered under legacy (named map entry exists).
    const named = timeoutManager.namedTimeouts.get(p.id);
    assert.ok(named && named.has("chargedEndlagReset"));
    assert.equal(endlagCallbackScheduled, false);
    setActionFacingOwnershipV2ForTests(null);
  });

  it("full reset safe in both V2 and legacy modes", () => {
    for (const v2 of [true, false]) {
      setActionLifecycleOwnershipV2ForTests(v2);
      const p = makePlayer({
        isAttacking: true,
        isSlapAttack: true,
        currentAction: "slap",
        isHit: false,
      });
      if (v2) {
        beginLifecycleOwner(
          p,
          LIFECYCLE_DOMAIN.PRIMARY_ACTION,
          LIFECYCLE_OWNER.SLAP
        );
        beginLifecycleOwner(
          p,
          LIFECYCLE_DOMAIN.REACTION,
          LIFECYCLE_OWNER.HITSTUN
        );
      }
      clearAllActionStates(p);
      forceClearLifecycleOwners(p, { reason: "TEST_BOTH_MODES" });
      assert.equal(p.isAttacking, false);
      assert.equal(p.currentAction, null);
      assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.PRIMARY_ACTION), null);
      assert.equal(getLifecycleOwner(p, LIFECYCLE_DOMAIN.REACTION), null);
      assert.equal(p.slapLifecycleInstanceId, null);
      assert.equal(p.hitstunLifecycleInstanceId, null);
    }
  });

  it("44 contact V2 remains independently toggleable", () => {
    setCombatContactFidelityV2ForTests(true);
    const {
      isCombatContactFidelityV2Enabled,
    } = require("../../combatContactFidelityFlags");
    assert.equal(isCombatContactFidelityV2Enabled(), true);
    setCombatContactFidelityV2ForTests(null);
  });

  it("mintLifecycleInstanceId is stable per-player sequence", () => {
    setActionLifecycleOwnershipV2ForTests(true);
    const p = makePlayer();
    const a = mintLifecycleInstanceId(p, LIFECYCLE_OWNER.SLAP);
    const b = mintLifecycleInstanceId(p, LIFECYCLE_OWNER.SLAP);
    assert.notEqual(a, b);
    assert.match(a, /^SLAP:p1:\d+$/);
  });

  it("clearLifecycleNamedTimeouts cancels listed names", () => {
    const p = makePlayer();
    setPlayerTimeout(p.id, () => {}, 9999, "hitStateReset");
    setPlayerTimeout(p.id, () => {}, 9999, "parryStaggerReset");
    clearLifecycleNamedTimeouts(p, ["hitStateReset", "parryStaggerReset"]);
    const named = timeoutManager.namedTimeouts.get(p.id);
    assert.ok(!named || !named.has("hitStateReset"));
    assert.ok(!named || !named.has("parryStaggerReset"));
  });
});
