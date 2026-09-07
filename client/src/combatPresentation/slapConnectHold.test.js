/**
 * Run: node --no-warnings --loader ./scripts/extResolve.mjs --test src/combatPresentation/slapConnectHold.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createSlapConnectHold,
  armSlapConnectHold,
  resolveSlapConnectHold,
  slapConnectHoldNeedsTick,
  isSlapConnectHoldEligible,
  isPalmConnectHoldEligible,
  isChargedConnectHoldEligible,
  clearSlapConnectHold,
  SLAP_CONNECT_HOLD_BRIDGE_MS,
} from "./slapConnectHold.js";

const ATTACKER = "a1";
const VICTIM = "v1";

function slapHit(overrides = {}) {
  return {
    hitId: "h1",
    attackerId: ATTACKER,
    victimId: VICTIM,
    attackType: "slap",
    timestamp: 1000,
    ...overrides,
  };
}

describe("slapConnectHold", () => {
  it("only arms the slap attacker, never palm / cinematic / victim", () => {
    assert.equal(isSlapConnectHoldEligible(slapHit(), ATTACKER), true);
    assert.equal(isSlapConnectHoldEligible(slapHit(), VICTIM), false);
    assert.equal(
      isSlapConnectHoldEligible(slapHit({ isPalmThrust: true }), ATTACKER),
      false
    );
    assert.equal(
      isSlapConnectHoldEligible(slapHit({ cinematicKill: true }), ATTACKER),
      false
    );
    assert.equal(
      isSlapConnectHoldEligible(slapHit({ attackType: "charged" }), ATTACKER),
      false
    );
    assert.equal(
      isChargedConnectHoldEligible(slapHit({ attackType: "charged" }), ATTACKER),
      true
    );
  });

  it("arms a landed flying headbutt so hitstop freezes forehead-on-body", () => {
    const chargedHit = {
      hitId: "c1",
      attackerId: ATTACKER,
      victimId: VICTIM,
      attackType: "charged",
      isPalmThrust: false,
      timestamp: 1000,
    };
    assert.equal(isChargedConnectHoldEligible(chargedHit, ATTACKER), true);
    assert.equal(isChargedConnectHoldEligible(chargedHit, VICTIM), false);
    assert.equal(
      isChargedConnectHoldEligible({ ...chargedHit, cinematicKill: true }, ATTACKER),
      false
    );
    assert.equal(
      isChargedConnectHoldEligible({ ...chargedHit, isPalmThrust: true }, ATTACKER),
      false
    );

    const hold = createSlapConnectHold();
    assert.equal(armSlapConnectHold(hold, chargedHit, ATTACKER, 1000, 1180), true);
    assert.equal(hold.kind, "charged");
    assert.equal(resolveSlapConnectHold(hold, 1000, 1180), true);
    assert.equal(resolveSlapConnectHold(hold, 1180, 1180), false);
  });

  it("arms a landed palm so hitstop cannot freeze the smear", () => {
    const palmHit = {
      hitId: "p1",
      attackerId: ATTACKER,
      victimId: VICTIM,
      attackType: "charged",
      isPalmThrust: true,
      timestamp: 1000,
    };
    assert.equal(isPalmConnectHoldEligible(palmHit, ATTACKER), true);
    assert.equal(isPalmConnectHoldEligible(palmHit, VICTIM), false);
    assert.equal(
      isPalmConnectHoldEligible({ ...palmHit, cinematicKill: true }, ATTACKER),
      false
    );
    assert.equal(isSlapConnectHoldEligible(palmHit, ATTACKER), false);

    const hold = createSlapConnectHold();
    assert.equal(armSlapConnectHold(hold, palmHit, ATTACKER, 1000, 1180), true);
    assert.equal(resolveSlapConnectHold(hold, 1000, 1180), true);
    assert.equal(resolveSlapConnectHold(hold, 1180, 1180), false);
  });

  it("adopts an existing hitstop deadline immediately", () => {
    const hold = createSlapConnectHold();
    assert.equal(
      armSlapConnectHold(hold, slapHit(), ATTACKER, 1000, 1180),
      true
    );
    assert.equal(resolveSlapConnectHold(hold, 1000, 1180), true);
    assert.equal(resolveSlapConnectHold(hold, 1179, 1180), true);
    assert.equal(resolveSlapConnectHold(hold, 1180, 1180), false);
  });

  it("bridges until hitstop arrives, then abandons if it never does", () => {
    const hold = createSlapConnectHold();
    armSlapConnectHold(hold, slapHit(), ATTACKER, 1000, 0);
    assert.equal(resolveSlapConnectHold(hold, 1010, 0), false);
    assert.equal(hold.pendingUntil, 1000 + SLAP_CONNECT_HOLD_BRIDGE_MS);
    assert.equal(resolveSlapConnectHold(hold, 1010, 1200), true);
    assert.equal(hold.until, 1200);

    const missed = createSlapConnectHold();
    armSlapConnectHold(missed, slapHit(), ATTACKER, 1000, 0);
    assert.equal(
      resolveSlapConnectHold(
        missed,
        1000 + SLAP_CONNECT_HOLD_BRIDGE_MS,
        0
      ),
      false
    );
    assert.equal(missed.pendingUntil, 0);
  });

  it("duplicate / retransmit does not restart the hold", () => {
    const hold = createSlapConnectHold();
    assert.equal(
      armSlapConnectHold(hold, slapHit(), ATTACKER, 1000, 1180),
      true
    );
    assert.equal(
      armSlapConnectHold(hold, slapHit(), ATTACKER, 1010, 1400),
      false
    );
    assert.equal(hold.until, 1180);
  });

  it("needs a tick when the freeze expires or a bridge is pending", () => {
    const hold = createSlapConnectHold();
    armSlapConnectHold(hold, slapHit(), ATTACKER, 1000, 1180);
    assert.equal(slapConnectHoldNeedsTick(hold, 1100, true), false);
    assert.equal(slapConnectHoldNeedsTick(hold, 1180, true), true);

    const bridging = createSlapConnectHold();
    armSlapConnectHold(bridging, slapHit(), ATTACKER, 1000, 0);
    assert.equal(slapConnectHoldNeedsTick(bridging, 1010, false), true);
  });

  it("clear drops a live hold so grab hitstop cannot restick the jab pose", () => {
    const hold = createSlapConnectHold();
    armSlapConnectHold(hold, slapHit(), ATTACKER, 1000, 1180);
    clearSlapConnectHold(hold);
    assert.equal(resolveSlapConnectHold(hold, 1100, 2000), false);
    assert.equal(hold.until, 0);
    assert.equal(hold.pendingUntil, 0);
  });
});
