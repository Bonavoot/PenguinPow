/**
 * Phase 4A — struck-limb contact-pose hold (presentation only).
 * Run: node --no-warnings --loader ./scripts/extResolve.mjs --test src/combatPresentation/struckLimbHold.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createStruckLimbHold,
  armStruckLimbHold,
  resolveStruckLimbHold,
  struckLimbHoldNeedsTick,
  isStruckLimbHoldEligible,
  struckLimbEventId,
  STRUCK_LIMB_HOLD_BRIDGE_MS,
} from "./struckLimbHold.js";

const VICTIM = "victim-1";
const ATTACKER = "attacker-1";

/** Stand-in for getStruckSlapLimbSrc — asserts the server stamp drives the pick. */
const resolveSrc = (poseKey, variant) => {
  if (poseKey === "slap_active") {
    return String(variant) === "2" ? "slap2Hit.png" : "slap1Hit.png";
  }
  if (poseKey === "slap_recovery") return "palmThrustStartup.png";
  return null;
};

function limbOnlyHit(overrides = {}) {
  return {
    hitId: "h1",
    victimId: VICTIM,
    attackerId: ATTACKER,
    limbOnlyContact: true,
    victimHurtRegion: "frontArm",
    victimHurtKind: "HURT_LIMB",
    victimSlapPoseKey: "slap_active",
    victimSlapVariant: "1",
    victimSlapPhase: "active",
    victimSlapMirrorFacing: 1,
    ...overrides,
  };
}

describe("struck-limb hold — eligibility", () => {
  it("arms only for a GENUINE limb-only contact on this fighter", () => {
    assert.equal(isStruckLimbHoldEligible(limbOnlyHit(), VICTIM), true);
    assert.equal(
      isStruckLimbHoldEligible(limbOnlyHit(), ATTACKER),
      false,
      "the attacker instance must never hold a struck pose"
    );
  });

  it("torso contact gets no hold", () => {
    const torso = limbOnlyHit({
      limbOnlyContact: false,
      victimHurtRegion: "body",
      victimHurtKind: "HURT_BODY",
      victimSlapPoseKey: null,
    });
    assert.equal(isStruckLimbHoldEligible(torso, VICTIM), false);
  });

  it("torso-PLUS-limb body contact gets no hold (never keys off HURT_LIMB)", () => {
    // Server stamped frontArm identity for VFX, but the torso was also in legacy
    // connect — ordinary hit presentation must win.
    const torsoPlusLimb = limbOnlyHit({
      limbOnlyContact: false,
      victimHurtRegion: "frontArm",
      victimHurtKind: "HURT_LIMB",
    });
    assert.equal(isStruckLimbHoldEligible(torsoPlusLimb, VICTIM), false);
    const hold = createStruckLimbHold();
    assert.equal(
      armStruckLimbHold(hold, torsoPlusLimb, VICTIM, 1000, 1200, resolveSrc),
      false
    );
    assert.equal(hold.src, null);
  });

  it("cinematic kills keep their own choreography", () => {
    assert.equal(
      isStruckLimbHoldEligible(limbOnlyHit({ cinematicKill: true }), VICTIM),
      false
    );
  });

  it("a payload with no resolvable slap pose does not arm", () => {
    const hold = createStruckLimbHold();
    const armed = armStruckLimbHold(
      hold,
      limbOnlyHit({ victimSlapPoseKey: "slap_startup" }),
      VICTIM,
      1000,
      1200,
      resolveSrc
    );
    assert.equal(armed, false);
    assert.equal(hold.src, null);
  });
});

describe("struck-limb hold — which frame is held", () => {
  it("active-limb contact holds the server-stamped slap variant", () => {
    for (const [variant, expected] of [
      ["1", "slap1Hit.png"],
      ["2", "slap2Hit.png"],
    ]) {
      const hold = createStruckLimbHold();
      armStruckLimbHold(
        hold,
        limbOnlyHit({ victimSlapVariant: variant }),
        VICTIM,
        1000,
        1200,
        resolveSrc
      );
      assert.equal(hold.src, expected, `variant ${variant}`);
      assert.equal(hold.variant, variant);
      assert.equal(hold.poseKey, "slap_active");
    }
  });

  it("recovery-limb contact holds the ACTUAL recovery pose (no fabricated reach)", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(
      hold,
      limbOnlyHit({
        victimSlapPoseKey: "slap_recovery",
        victimSlapPhase: "recovery",
        victimSlapVariant: null,
      }),
      VICTIM,
      1000,
      1200,
      resolveSrc
    );
    assert.equal(hold.src, "palmThrustStartup.png");
    assert.equal(hold.poseKey, "slap_recovery");
    assert.notEqual(hold.src, "slap1Hit.png");
    assert.notEqual(hold.src, "slap2Hit.png");
  });

  it("carries the committed mirror facing, for both facings", () => {
    for (const facing of [1, -1]) {
      const hold = createStruckLimbHold();
      armStruckLimbHold(
        hold,
        limbOnlyHit({ victimSlapMirrorFacing: facing }),
        VICTIM,
        1000,
        1200,
        resolveSrc
      );
      assert.equal(hold.mirrorFacing, facing);
    }
  });
});

describe("struck-limb hold — event / hitstop ordering", () => {
  it("hitstop BEFORE player_hit: deadline adopted immediately", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 1180, resolveSrc);
    assert.equal(hold.until, 1180);
    assert.equal(hold.pendingHitId, null, "no bridge needed");
    assert.equal(resolveStruckLimbHold(hold, 1000, 1180, true), true);
  });

  it("player_hit BEFORE hitstop: bridges one render, then adopts the deadline", () => {
    const hold = createStruckLimbHold();
    // Hitstop not published yet (deadline in the past).
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 0, resolveSrc);
    assert.equal(hold.until, 0);
    assert.equal(hold.pendingHitId, "limbhold:h1");
    // Bridge render with still-no hitstop: hold not shown, but not discarded.
    assert.equal(resolveStruckLimbHold(hold, 1005, 0, true), false);
    assert.ok(hold.src, "must not be released while the bridge is open");
    // Hitstop arrives — adopted, and the pose shows.
    assert.equal(resolveStruckLimbHold(hold, 1010, 1180, true), true);
    assert.equal(hold.until, 1180);
    assert.equal(hold.pendingHitId, null);
  });

  it("abandons the hold if hitstop never arrives (no invented duration)", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 0, resolveSrc);
    const past = 1000 + STRUCK_LIMB_HOLD_BRIDGE_MS + 1;
    assert.equal(resolveStruckLimbHold(hold, past, 0, true), false);
    assert.equal(hold.pendingHitId, null);
    assert.equal(hold.src, null, "hold released, never shown");
  });

  it("a duplicate / retransmitted event does not restart the hold", () => {
    const hold = createStruckLimbHold();
    const data = limbOnlyHit();
    assert.equal(
      armStruckLimbHold(hold, data, VICTIM, 1000, 1180, resolveSrc),
      true
    );
    const firstUntil = hold.until;
    // Same hitId re-delivered later with a LONGER hitstop — must be ignored.
    assert.equal(
      armStruckLimbHold(hold, data, VICTIM, 1100, 1400, resolveSrc),
      false
    );
    assert.equal(hold.until, firstUntil, "deadline must not be extended");
  });

  it("a genuinely new contact does arm again", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 1180, resolveSrc);
    assert.equal(
      armStruckLimbHold(
        hold,
        limbOnlyHit({ hitId: "h2", victimSlapVariant: "2" }),
        VICTIM,
        1200,
        1400,
        resolveSrc
      ),
      true
    );
    assert.equal(hold.src, "slap2Hit.png");
    assert.equal(hold.until, 1400);
  });

  it("events without hitId still de-duplicate on pose + timestamp", () => {
    const noId = limbOnlyHit({ hitId: null, timestamp: 555 });
    assert.equal(struckLimbEventId(noId), "limbhold:slap_active:555");
    const hold = createStruckLimbHold();
    assert.equal(armStruckLimbHold(hold, noId, VICTIM, 10, 200, resolveSrc), true);
    assert.equal(armStruckLimbHold(hold, noId, VICTIM, 20, 300, resolveSrc), false);
  });
});

describe("struck-limb hold — release", () => {
  it("generic hit sprite returns the instant hitstop lapses", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 1180, resolveSrc);
    assert.equal(resolveStruckLimbHold(hold, 1179, 1180, true), true);
    // One ms later the freeze is over — pose released on this very frame.
    assert.equal(resolveStruckLimbHold(hold, 1180, 1180, true), false);
    assert.equal(hold.src, null);
    assert.equal(hold.until, 0);
  });

  it("never outlives the hit reaction either", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 1180, resolveSrc);
    // Reaction ended early (isHit cleared) while hitstop still nominally runs.
    assert.equal(resolveStruckLimbHold(hold, 1050, 1180, false), false);
    assert.equal(hold.src, null);
  });

  it("a longer later hitstop cannot stretch an adopted deadline", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 1180, resolveSrc);
    resolveStruckLimbHold(hold, 1010, 9999, true);
    assert.equal(hold.until, 1180, "adopted deadline is final");
  });

  it("works identically for local and remote victims (id match is the only gate)", () => {
    for (const id of ["local-abc", "remote-xyz"]) {
      const hold = createStruckLimbHold();
      const armed = armStruckLimbHold(
        hold,
        limbOnlyHit({ victimId: id }),
        id,
        1000,
        1180,
        resolveSrc
      );
      assert.equal(armed, true, id);
      assert.equal(resolveStruckLimbHold(hold, 1000, 1180, true), true, id);
    }
  });
});

describe("struck-limb hold — render scheduling", () => {
  it("requests a tick at expiry so the handoff commits", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 1180, resolveSrc);
    assert.equal(struckLimbHoldNeedsTick(hold, 1100, true), false);
    assert.equal(struckLimbHoldNeedsTick(hold, 1180, true), true);
  });

  it("requests ticks while the packet-order bridge is open", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 0, resolveSrc);
    assert.equal(struckLimbHoldNeedsTick(hold, 1010, false), true);
    assert.equal(
      struckLimbHoldNeedsTick(hold, 1000 + STRUCK_LIMB_HOLD_BRIDGE_MS, false),
      false,
      "bridge is bounded"
    );
  });

  it("idle hold requests nothing", () => {
    assert.equal(
      struckLimbHoldNeedsTick(createStruckLimbHold(), 1000, false),
      false
    );
  });
});
