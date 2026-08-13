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
});
