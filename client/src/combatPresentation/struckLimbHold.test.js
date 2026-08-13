/**
 * Phase 4A — struck-limb contact-pose hold (presentation only).
 * Run: node --no-warnings --loader ./scripts/extResolve.mjs --test src/combatPresentation/struckLimbHold.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createStruckLimbHold,
  armStruckLimbHold,
  armVictimContactHold,
  resolveStruckLimbHold,
  struckLimbHoldNeedsTick,
  isStruckLimbHoldEligible,
  struckLimbEventId,
  STRUCK_LIMB_HOLD_BRIDGE_MS,
  resolveFighterDisplaySprite,
  formatStruckLimbHoldHudLine,
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

/**
 * Phase 4B — the payload switched to generic `victimLimb*` fields so palm data
 * is not smuggled through slap-named keys. A Phase 4A payload must keep working.
 */
describe("struck-limb hold — Phase 4B generic limb stamp", () => {
  /** Stand-in for getStruckLimbPoseSrc, mirroring the real palm rules. */
  const resolveLimbSrc = (poseKey, variant) => {
    if (poseKey === "slap_active") {
      return String(variant) === "2" ? "slap2Hit.png" : "slap1Hit.png";
    }
    if (poseKey === "slap_recovery") return "palmThrustStartup.png";
    if (poseKey === "palm_active") return "palmThrust.png";
    if (poseKey === "palm_recovery") {
      return String(variant) === "true" ? "palmThrust.png" : null;
    }
    return null;
  };

  const palmHit = (overrides = {}) => ({
    hitId: "p1",
    victimId: VICTIM,
    attackerId: ATTACKER,
    limbOnlyContact: true,
    victimHurtRegion: "frontArm",
    victimHurtKind: "HURT_LIMB",
    victimLimbFamily: "palm",
    victimLimbPoseKey: "palm_active",
    victimLimbPhase: "active",
    victimLimbVariant: null,
    victimLimbMirrorFacing: 1,
    // Phase 4A fields are explicitly null for a non-slap family.
    victimSlapPoseKey: null,
    victimSlapVariant: null,
    victimSlapPhase: null,
    victimSlapMirrorFacing: null,
    ...overrides,
  });

  it("holds the extended palm pose for an active-palm limb hit", () => {
    const hold = createStruckLimbHold();
    assert.equal(
      armStruckLimbHold(hold, palmHit(), VICTIM, 1000, 1180, resolveLimbSrc),
      true
    );
    assert.equal(hold.src, "palmThrust.png");
    assert.equal(hold.poseKey, "palm_active");
    assert.equal(resolveStruckLimbHold(hold, 1000, 1180, true), true);
  });

  it("holds the palm's recovery pose only while it is still held out", () => {
    const held = createStruckLimbHold();
    armStruckLimbHold(
      held,
      palmHit({
        victimLimbPoseKey: "palm_recovery",
        victimLimbPhase: "recovery",
        victimLimbVariant: "true",
      }),
      VICTIM,
      1000,
      1180,
      resolveLimbSrc
    );
    assert.equal(held.src, "palmThrust.png");
    assert.equal(held.variant, "true");

    // Settled tail: no authorized pose, so no hold — ordinary hit reaction.
    const settled = createStruckLimbHold();
    assert.equal(
      armStruckLimbHold(
        settled,
        palmHit({
          victimLimbPoseKey: "palm_recovery",
          victimLimbPhase: "recovery",
          victimLimbVariant: null,
        }),
        VICTIM,
        1000,
        1180,
        resolveLimbSrc
      ),
      false
    );
    assert.equal(settled.src, null);
  });

  it("carries the palm's committed mirror facing, for both facings", () => {
    for (const facing of [1, -1]) {
      const hold = createStruckLimbHold();
      armStruckLimbHold(
        hold,
        palmHit({ victimLimbMirrorFacing: facing }),
        VICTIM,
        1000,
        1180,
        resolveLimbSrc
      );
      assert.equal(hold.mirrorFacing, facing);
    }
  });

  it("a Phase 4A slap payload still resolves through the slap-named fields", () => {
    const hold = createStruckLimbHold();
    assert.equal(
      armStruckLimbHold(hold, limbOnlyHit(), VICTIM, 1000, 1180, resolveLimbSrc),
      true
    );
    assert.equal(hold.src, "slap1Hit.png");
    assert.equal(hold.poseKey, "slap_active");
    assert.equal(hold.mirrorFacing, 1);
  });

  it("generic fields win when a server sends both namings", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(
      hold,
      limbOnlyHit({
        victimLimbFamily: "slap",
        victimLimbPoseKey: "slap_active",
        victimLimbVariant: "2",
        victimLimbMirrorFacing: -1,
      }),
      VICTIM,
      1000,
      1180,
      resolveLimbSrc
    );
    assert.equal(hold.src, "slap2Hit.png");
    assert.equal(hold.mirrorFacing, -1);
  });

  it("palm holds obey the same hitstop bound and dedup rules", () => {
    const hold = createStruckLimbHold();
    const data = palmHit();
    armStruckLimbHold(hold, data, VICTIM, 1000, 1180, resolveLimbSrc);
    // Duplicate delivery with a longer freeze must not extend the hold.
    assert.equal(
      armStruckLimbHold(hold, data, VICTIM, 1100, 1400, resolveLimbSrc),
      false
    );
    assert.equal(hold.until, 1180);
    // Released exactly when the freeze lapses.
    assert.equal(resolveStruckLimbHold(hold, 1179, 1180, true), true);
    assert.equal(resolveStruckLimbHold(hold, 1180, 1180, true), false);
    assert.equal(hold.src, null);
  });

  it("event id uses the generic pose key when no hitId is present", () => {
    const noId = palmHit({ hitId: null, timestamp: 777 });
    assert.equal(struckLimbEventId(noId), "limbhold:palm_active:777");
  });

  /**
   * getImageSrc imports PNG URLs, which Node cannot resolve (same limitation the
   * audio suite documents for WAVs), so the real resolver is checked at the
   * source level. The failure this guards against is concrete: holding the
   * RETRACTED palm sprite for a hit that authority resolved against the
   * EXTENDED arm would put the spark in empty space.
   */
  it("the real resolver holds the same palm sprite the renderer draws", () => {
    const src = readFileSync(
      new URL("../components/getImageSrc.js", import.meta.url),
      "utf8"
    );
    const resolver = src.slice(src.indexOf("export const getStruckLimbPoseSrc"));
    assert.match(
      resolver,
      /victimLimbPoseKey === "palm_active"\) return palmThrust;/,
      "palm_active must hold palm-thrust.png, the extended strike art"
    );
    assert.match(
      resolver,
      /String\(victimLimbVariant\) === "true" \? palmThrust : null/,
      "palm_recovery must hold the extended art ONLY for the authorized hold variant"
    );
    // The renderer's own active branch: smear lead-in, startup pose on recovery.
    assert.match(
      src,
      /if \(palmThrustFrame === 0\) return palmThrustSmear;/
    );
    assert.match(
      src,
      /if \(palmThrustFrame === 3\) return palmThrustStartup;\s*\n\s*return palmThrust;/
    );
    assert.ok(
      src.includes("export const getStruckSlapLimbSrc = getStruckLimbPoseSrc"),
      "the Phase 4A export name must keep working"
    );
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

/**
 * The defect this guards against is NOT "does the hold resolve true" — it is
 * "does the held sprite actually reach the DOM". `isHit` is authoritative and
 * `getImageSrc` turns it into a hit sprite every render; if that sprite ever
 * outranks the hold, the struck limb vanishes on the impact frame even though
 * every pure resolver above passes. GameFighter calls exactly this function, so
 * the ordering itself is under test.
 */
describe("struck-limb hold — final sprite precedence", () => {
  const resolveLimbSrc = (poseKey, variant) => {
    if (poseKey === "palm_active") return "palmThrust.png";
    if (poseKey === "palm_recovery") {
      return String(variant) === "true" ? "palmThrust.png" : null;
    }
    if (poseKey === "slap_active") {
      return String(variant) === "2" ? "slap2Hit.png" : "slap1Hit.png";
    }
    return null;
  };
  const palmHit = (overrides = {}) => ({
    hitId: "pp1",
    victimId: VICTIM,
    attackerId: ATTACKER,
    limbOnlyContact: true,
    victimHurtRegion: "frontArm",
    victimHurtKind: "HURT_LIMB",
    victimLimbFamily: "palm",
    victimLimbPoseKey: "palm_active",
    victimLimbPhase: "active",
    victimLimbVariant: null,
    victimLimbMirrorFacing: 1,
    ...overrides,
  });
  // What getImageSrc returns for an authoritative isHit victim.
  const HIT_SPRITE = "hit.png";
  const IDLE = "pumo.png";
  const RECOVERING = "recovering.png";

  const render = (hold, now, hitstopUntil, isHit, raw = HIT_SPRITE) =>
    resolveFighterDisplaySprite({
      struckLimbHoldSrc: resolveStruckLimbHold(hold, now, hitstopUntil, isHit)
        ? hold.src
        : null,
      inDashWindup: false,
      justLandedFromDodge: false,
      rawSpriteSrc: raw,
      idleSrc: IDLE,
      recoveringSrc: RECOVERING,
    });

  it("an active palm hold outranks the authoritative isHit sprite", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, palmHit(), VICTIM, 1000, 1180, resolveLimbSrc);
    assert.equal(render(hold, 1000, 1180, true), "palmThrust.png");
    assert.equal(render(hold, 1179, 1180, true), "palmThrust.png");
  });

  it("the extended palm_recovery variant is held the same way", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(
      hold,
      palmHit({
        hitId: "pp2",
        victimLimbPoseKey: "palm_recovery",
        victimLimbPhase: "recovery",
        victimLimbVariant: "true",
      }),
      VICTIM,
      1000,
      1180,
      resolveLimbSrc
    );
    assert.equal(render(hold, 1050, 1180, true), "palmThrust.png");
  });

  it("hitstop expiry hands the frame straight back to isHit", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, palmHit(), VICTIM, 1000, 1180, resolveLimbSrc);
    assert.equal(render(hold, 1179, 1180, true), "palmThrust.png");
    assert.equal(render(hold, 1180, 1180, true), HIT_SPRITE, "ends WITH hitstop");
    assert.equal(render(hold, 1181, 1180, true), HIT_SPRITE);
  });

  it("both packet orders reach the same held frame", () => {
    // player_hit → hitstop: the bridge preserves the hold WITHOUT drawing it
    // (Phase 4A contract — no invented duration), then adopts the real deadline.
    const a = createStruckLimbHold();
    armStruckLimbHold(a, palmHit(), VICTIM, 1000, 0, resolveLimbSrc);
    assert.equal(render(a, 1002, 0, true), HIT_SPRITE, "bridging draws nothing");
    assert.equal(a.state, "bridging");
    assert.equal(render(a, 1004, 1180, true), "palmThrust.png", "adopted");
    // hitstop → player_hit: deadline is known at arm time, so it draws at once.
    const b = createStruckLimbHold();
    armStruckLimbHold(b, palmHit({ hitId: "pp3" }), VICTIM, 1000, 1180, resolveLimbSrc);
    assert.equal(render(b, 1000, 1180, true), "palmThrust.png");
    // Both orders end on the same deadline.
    assert.equal(a.until, b.until);
  });

  it("a duplicate event cannot restart the hold past its deadline", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, palmHit(), VICTIM, 1000, 1180, resolveLimbSrc);
    assert.equal(
      armStruckLimbHold(hold, palmHit(), VICTIM, 1170, 1400, resolveLimbSrc),
      false
    );
    assert.equal(hold.decision, "duplicate");
    assert.equal(render(hold, 1180, 1400, true), HIT_SPRITE);
  });

  it("torso and torso-plus-limb palm contacts never take the frame", () => {
    for (const payload of [
      palmHit({ limbOnlyContact: false, victimHurtRegion: "torso", victimHurtKind: "HURT_BODY" }),
      palmHit({ limbOnlyContact: false }), // limb region, but body was also in reach
    ]) {
      const hold = createStruckLimbHold();
      assert.equal(
        armStruckLimbHold(hold, payload, VICTIM, 1000, 1180, resolveLimbSrc),
        false
      );
      assert.equal(hold.decision, "not_limb_only");
      assert.equal(render(hold, 1000, 1180, true), HIT_SPRITE);
    }
  });

  it("keeps the committed facing for both orientations", () => {
    for (const facing of [1, -1]) {
      const hold = createStruckLimbHold();
      armStruckLimbHold(
        hold,
        palmHit({ hitId: `f${facing}`, victimLimbMirrorFacing: facing }),
        VICTIM,
        1000,
        1180,
        resolveLimbSrc
      );
      assert.equal(render(hold, 1000, 1180, true), "palmThrust.png");
      assert.equal(hold.mirrorFacing, facing);
      assert.equal(hold.family, "palm");
    }
  });

  it("Phase 4A slap precedence is unchanged", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, limbOnlyHit({ victimSlapVariant: "2" }), VICTIM, 1000, 1180, resolveLimbSrc);
    assert.equal(render(hold, 1000, 1180, true), "slap2Hit.png");
    assert.equal(render(hold, 1180, 1180, true), HIT_SPRITE);
  });

  it("with no hold, every other branch keeps its old order", () => {
    const base = {
      struckLimbHoldSrc: null,
      inDashWindup: false,
      justLandedFromDodge: false,
      rawSpriteSrc: HIT_SPRITE,
      idleSrc: IDLE,
      recoveringSrc: RECOVERING,
    };
    assert.equal(resolveFighterDisplaySprite(base), HIT_SPRITE);
    assert.equal(
      resolveFighterDisplaySprite({ ...base, inDashWindup: true }),
      RECOVERING
    );
    assert.equal(
      resolveFighterDisplaySprite({
        ...base,
        justLandedFromDodge: true,
        rawSpriteSrc: IDLE,
      }),
      RECOVERING
    );
    assert.equal(
      resolveFighterDisplaySprite({ ...base, justLandedFromDodge: true }),
      HIT_SPRITE,
      "landing swap only replaces idle"
    );
  });

  it("GameFighter renders through this resolver, not an inline ternary", () => {
    const src = readFileSync(
      new URL("../components/GameFighter.jsx", import.meta.url),
      "utf8"
    );
    assert.match(src, /const displaySpriteSrc = resolveFighterDisplaySprite\(\{/);
    assert.match(src, /struckLimbHoldSrc: holdStruckLimbPose \? struckLimbHold\.src : null/);
    // Nothing downstream may re-derive the sprite from isHit.
    assert.match(src, /let effectiveSpriteSrc = displaySpriteSrc;/);
  });
});

/**
 * Phase 4C graduated the server flag to default ON, but the explicit-OFF
 * rollback must still be complete on the client: legacy payloads carry no
 * authored limb identity at all, so no hold can arm and the hit reaction is
 * the only presentation. The client must never manufacture identity locally.
 */
describe("struck-limb hold — legacy (flag OFF) payloads", () => {
  const resolveLimbSrc = (poseKey, variant) => {
    if (poseKey === "palm_active") return "palmThrust.png";
    if (poseKey === "palm_recovery") {
      return String(variant) === "true" ? "palmThrust.png" : null;
    }
    if (poseKey === "slap_active") {
      return String(variant) === "2" ? "slap2Hit.png" : "slap1Hit.png";
    }
    return null;
  };

  // Exactly what the server emits with AUTHORED_SLAP_HURTBOX_V1=0: a torso hit
  // with every authored-limb field absent (not false — absent).
  const legacyHit = (overrides = {}) => ({
    hitId: "legacy-1",
    victimId: VICTIM,
    attackerId: ATTACKER,
    attackType: "slap",
    victimHurtRegion: "torso",
    victimHurtKind: "HURT_BODY",
    ...overrides,
  });

  it("a legacy torso payload cannot arm the hold", () => {
    const hold = createStruckLimbHold();
    assert.equal(isStruckLimbHoldEligible(legacyHit(), VICTIM), false);
    assert.equal(
      armStruckLimbHold(hold, legacyHit(), VICTIM, 1000, 1180, resolveLimbSrc),
      false
    );
    assert.equal(hold.src, null);
    assert.equal(resolveStruckLimbHold(hold, 1000, 1180, true), false);
  });

  it("absent limb identity is not inferred from the hurt region alone", () => {
    // Even if a legacy build ever labelled the region, the limb-only flag is
    // the sole gate — a region name must never be enough.
    const hold = createStruckLimbHold();
    const payload = legacyHit({
      victimHurtRegion: "frontArm",
      victimHurtKind: "HURT_LIMB",
    });
    assert.equal(
      armStruckLimbHold(hold, payload, VICTIM, 1000, 1180, resolveLimbSrc),
      false
    );
    assert.equal(hold.decision, "not_limb_only");
    assert.equal(hold.src, null);
  });

  it("the ordinary isHit sprite owns every legacy frame", () => {
    const hold = createStruckLimbHold();
    armStruckLimbHold(hold, legacyHit(), VICTIM, 1000, 1180, resolveLimbSrc);
    for (const now of [1000, 1100, 1180, 1300]) {
      const src = resolveFighterDisplaySprite({
        struckLimbHoldSrc: resolveStruckLimbHold(hold, now, 1180, true)
          ? hold.src
          : null,
        inDashWindup: false,
        justLandedFromDodge: false,
        rawSpriteSrc: "hit.png",
        idleSrc: "pumo.png",
        recoveringSrc: "recovering.png",
      });
      assert.equal(src, "hit.png", `legacy frame at ${now}`);
    }
  });
});

describe("struck-limb hold — debug line", () => {
  it("reports family, pose, state and remaining hitstop without touching state", () => {
    const hold = createStruckLimbHold();
    assert.match(formatStruckLimbHoldHudLine(hold, 1000, 0), /state=idle/);
    armStruckLimbHold(
      hold,
      {
        hitId: "d1",
        victimId: VICTIM,
        limbOnlyContact: true,
        victimHurtKind: "HURT_LIMB",
        victimLimbFamily: "palm",
        victimLimbPoseKey: "palm_recovery",
        victimLimbVariant: "true",
        victimLimbMirrorFacing: -1,
      },
      VICTIM,
      1000,
      1180,
      () => "palm-thrust.png"
    );
    resolveStruckLimbHold(hold, 1040, 1180, true);
    const line = formatStruckLimbHoldHudLine(hold, 1040, 1180);
    assert.match(line, /state=active/);
    assert.match(line, /decision=armed/);
    assert.match(line, /family=palm/);
    assert.match(line, /pose=palm_recovery/);
    assert.match(line, /variant=true/);
    assert.match(line, /face=-1/);
    assert.match(line, /src=palm-thrust\.png/);
    assert.match(line, /left=140ms/);
    assert.match(line, /hitstopIn=140ms/);
    // Purely a read: the hold is still exactly as resolved.
    assert.equal(hold.src, "palm-thrust.png");
    assert.equal(hold.until, 1180);
  });
});

describe("armVictimContactHold — body slap/palm freeze", () => {
  function bodySlap(overrides = {}) {
    return {
      hitId: "body-1",
      victimId: VICTIM,
      attackerId: ATTACKER,
      attackType: "slap",
      limbOnlyContact: false,
      timestamp: 1000,
      ...overrides,
    };
  }

  it("arms a body slap with the pre-hit snapshot and holds through hitstop", () => {
    const hold = createStruckLimbHold();
    assert.equal(
      armVictimContactHold(hold, bodySlap(), VICTIM, 1000, 1180, "idle.png"),
      true
    );
    assert.equal(hold.decision, "armed_contact");
    assert.equal(hold.src, "idle.png");
    assert.equal(hold.family, "slap");
    assert.equal(resolveStruckLimbHold(hold, 1000, 1180, true), true);
    assert.equal(resolveFighterDisplaySprite({
      struckLimbHoldSrc: hold.src,
      inDashWindup: false,
      justLandedFromDodge: false,
      rawSpriteSrc: "hit.png",
      idleSrc: "pumo.png",
      recoveringSrc: "recovering.png",
    }), "idle.png");
    assert.equal(resolveStruckLimbHold(hold, 1180, 1180, true), false);
  });

  it("refuses limb-only (those stay on the server-stamp path)", () => {
    const hold = createStruckLimbHold();
    assert.equal(
      armVictimContactHold(
        hold,
        bodySlap({ limbOnlyContact: true }),
        VICTIM,
        1000,
        1180,
        "idle.png"
      ),
      false
    );
  });

  it("refuses charged / missing snapshot / cinematic", () => {
    const hold = createStruckLimbHold();
    assert.equal(
      armVictimContactHold(
        hold,
        bodySlap({ attackType: "charged" }),
        VICTIM,
        1000,
        1180,
        "idle.png"
      ),
      false
    );
    assert.equal(
      armVictimContactHold(hold, bodySlap(), VICTIM, 1000, 1180, null),
      false
    );
    assert.equal(
      armVictimContactHold(
        hold,
        bodySlap({ cinematicKill: true }),
        VICTIM,
        1000,
        1180,
        "idle.png"
      ),
      false
    );
  });

  it("duplicate body hit does not restart", () => {
    const hold = createStruckLimbHold();
    assert.equal(
      armVictimContactHold(hold, bodySlap(), VICTIM, 1000, 1180, "walk.png"),
      true
    );
    assert.equal(
      armVictimContactHold(hold, bodySlap(), VICTIM, 1010, 1400, "other.png"),
      false
    );
    assert.equal(hold.src, "walk.png");
    assert.equal(hold.until, 1180);
  });
});
