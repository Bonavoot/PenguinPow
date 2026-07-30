"use strict";

/**
 * Regression: competing Throw/Pull commits must use authoritative request
 * timestamps — never grabber identity or iteration order.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { CLINCH_THROW_CLASH_WINDOW_MS } = require("../../../constants");
const { createClinchScenario, withRoleSwap } = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

const W = CLINCH_THROW_CLASH_WINDOW_MS;
const TYPE_PAIRS = [
  ["throw", "throw"],
  ["pull", "pull"],
  ["throw", "pull"],
  ["pull", "throw"],
];

/**
 * Both requests already past the per-request simul buffer so both are eligible
 * to commit on the same tick. offsetMs = later.time - earlier.time must be > W
 * for outside-window priority (or == 0 / <= W for simul cases).
 */
function setupBothEligible(s, {
  earlier,
  later,
  earlierType,
  laterType,
  earlierTime,
  laterTime,
}) {
  s.setThrowRequest(earlier, earlierType, earlierTime);
  s.setThrowRequest(later, laterType, laterTime);
}

describe("Technique commit priority (no grabber/iteration bias)", () => {
  describe("outside simul window: earlier sanitized request wins", () => {
    for (const [typeA, typeB] of TYPE_PAIRS) {
      it(`${typeA} vs ${typeB}: earlier wins regardless of who is grabber`, () => {
        withRoleSwap({}, (s, label) => {
          // P1 earlier by W+1
          const t0 = s.now() - 200;
          setupBothEligible(s, {
            earlier: s.p1,
            later: s.p2,
            earlierType: typeA,
            laterType: typeB,
            earlierTime: t0,
            laterTime: t0 + W + 1,
          });
          s.stepOnce();
          assert.equal(
            s.p1.clinchThrowActive,
            true,
            `${label}: P1 earlier must commit (${typeA})`
          );
          assert.equal(s.p1.clinchThrowType, typeA);
          assert.equal(s.p2.clinchThrowActive, false, `${label}: P2 cleared`);
          assert.equal(s.p2.clinchThrowRequest, null);
        });
      });

      it(`${typeA} vs ${typeB}: P2 earlier wins even when P1 is grabber`, () => {
        withRoleSwap({}, (s, label) => {
          const t0 = s.now() - 200;
          setupBothEligible(s, {
            earlier: s.p2,
            later: s.p1,
            earlierType: typeB,
            laterType: typeA,
            earlierTime: t0,
            laterTime: t0 + W + 1,
          });
          s.stepOnce();
          assert.equal(
            s.p2.clinchThrowActive,
            true,
            `${label}: P2 earlier must commit (${typeB})`
          );
          assert.equal(s.p2.clinchThrowType, typeB);
          assert.equal(s.p1.clinchThrowActive, false, `${label}: P1 cleared`);
          assert.equal(s.p1.clinchThrowRequest, null);
        });
      });
    }

    it("grabbed acting earlier beats grabber later (role-swapped)", () => {
      withRoleSwap({}, (s, label) => {
        const t0 = s.now() - 200;
        s.setThrowRequest(s.grabbed, "throw", t0);
        s.setThrowRequest(s.grabber, "pull", t0 + W + 1);
        s.stepOnce();
        assert.equal(
          s.grabbed.clinchThrowActive,
          true,
          `${label}: grabbed earlier wins`
        );
        assert.equal(s.grabber.clinchThrowActive, false);
      });
    });

    it("1ms outside window: earlier wins (not simultaneous)", () => {
      withRoleSwap({}, (s, label) => {
        const t0 = s.now() - 200;
        s.setThrowRequest(s.p1, "throw", t0);
        s.setThrowRequest(s.p2, "throw", t0 + W + 1);
        s.stepOnce();
        assert.equal(s.p1.isClinchClashing, false, label);
        assert.equal(s.p1.clinchThrowActive, true, label);
        assert.equal(s.p2.clinchThrowActive, false, label);
      });
    });

    it("exactly on window boundary (±W): simultaneous, not time-order commit", () => {
      withRoleSwap({}, (s, label) => {
        const t0 = s.now();
        s.setThrowRequest(s.p1, "throw", t0);
        s.setThrowRequest(s.p2, "pull", t0 + W);
        s.stepOnce();
        assert.equal(s.p1.isClinchClashing, true, `${label}: +W is simultaneous`);
        assert.equal(s.p1.clinchThrowActive, false);
        assert.equal(s.p2.clinchThrowActive, false);
      });

      withRoleSwap({}, (s, label) => {
        const t0 = s.now();
        s.setThrowRequest(s.p1, "throw", t0);
        s.setThrowRequest(s.p2, "pull", t0 - W);
        s.stepOnce();
        assert.equal(s.p1.isClinchClashing, true, `${label}: -W is simultaneous`);
      });
    });

    it("1ms inside window: simultaneous tumble (no Deep Grip)", () => {
      withRoleSwap({}, (s, label) => {
        const t0 = s.now();
        s.setThrowRequest(s.p1, "throw", t0);
        s.setThrowRequest(s.p2, "throw", t0 + W - 1);
        s.stepOnce();
        assert.equal(s.p1.isClinchClashing, true, label);
        assert.equal(s.p2.isClinchClashing, true, label);
      });
    });
  });

  describe("identical timestamps resolve as simultaneous", () => {
    for (const [typeA, typeB] of TYPE_PAIRS) {
      it(`${typeA} vs ${typeB} at 0ms offset tumbles (role-swapped)`, () => {
        withRoleSwap({}, (s, label) => {
          const t0 = s.now();
          s.setThrowRequest(s.p1, typeA, t0);
          s.setThrowRequest(s.p2, typeB, t0);
          s.stepOnce();
          assert.equal(s.p1.isClinchClashing, true, label);
          assert.equal(s.p2.isClinchClashing, true, label);
          assert.equal(s.p1.clinchThrowActive, false);
          assert.equal(s.p2.clinchThrowActive, false);
        });
      });
    }
  });

  describe("Deep Grip inside simultaneous window (unchanged)", () => {
    it("Deep Grip on earlier or later identity wins; grabber irrelevant", () => {
      withRoleSwap({}, (s, label) => {
        s.setDeepGrip(s.grabbed);
        const t0 = s.now();
        s.setThrowRequest(s.grabber, "throw", t0);
        s.setThrowRequest(s.grabbed, "pull", t0 + 10);
        s.stepOnce();
        assert.equal(s.grabber.clinchThrowRequest, null, label);
        assert.equal(s.grabbed.clinchThrowRequest, "pull", label);
        assert.equal(s.grabber.isClinchClashing, false, label);
      });
    });

    it("Deep Grip winner still commits after buffer; loser stays cleared", () => {
      withRoleSwap({}, (s, label) => {
        s.setDeepGrip(s.p2);
        const t0 = s.now() - (W + 1);
        s.setThrowRequest(s.p1, "throw", t0);
        s.setThrowRequest(s.p2, "throw", t0);
        // First tick: simul Deep Grip clears P1; P2 may also commit same tick
        // because its request age already exceeds the buffer.
        s.stepOnce();
        assert.equal(s.p1.clinchThrowRequest, null, label);
        assert.equal(s.p1.clinchThrowActive, false, label);
        if (!s.p2.clinchThrowActive) {
          assert.equal(s.p2.clinchThrowRequest, "throw", label);
          s.advance(W + 2);
        }
        assert.equal(s.p2.clinchThrowActive, true, label);
        assert.equal(s.p1.clinchThrowActive, false, label);
      });
    });
  });

  describe("one valid request vs one blocked/ineligible", () => {
    it("Open earlier request does not block later valid commit", () => {
      withRoleSwap({}, (s, label) => {
        s.setOpen(s.p1, s.now() + 5000);
        const t0 = s.now() - 200;
        // P1 earlier but Open; P2 later but valid — outside simul so no tumble
        s.setThrowRequest(s.p1, "throw", t0);
        s.setThrowRequest(s.p2, "pull", t0 + W + 1);
        s.stepOnce();
        assert.equal(s.p1.clinchThrowActive, false, `${label}: Open cannot commit`);
        assert.equal(s.p2.clinchThrowActive, true, `${label}: valid partner commits`);
        // commitTechnique clears the target's pending request (existing rule).
        assert.equal(s.p1.clinchThrowRequest, null, `${label}: cleared on partner commit`);
      });
    });

    it("input-locked earlier request does not block later valid commit", () => {
      withRoleSwap({}, (s, label) => {
        s.setInputLock(s.p1, s.now() + 5000);
        const t0 = s.now() - 200;
        s.setThrowRequest(s.p1, "throw", t0);
        s.setThrowRequest(s.p2, "throw", t0 + W + 1);
        s.stepOnce();
        assert.equal(s.p1.clinchThrowActive, false, label);
        assert.equal(s.p2.clinchThrowActive, true, label);
        assert.equal(s.p1.clinchThrowRequest, null, label);
      });
    });

    it("jolt-recovery earlier request does not block later valid commit", () => {
      withRoleSwap({}, (s, label) => {
        s.p1.clinchJoltRecovery = true;
        const t0 = s.now() - 200;
        s.setThrowRequest(s.p1, "pull", t0);
        s.setThrowRequest(s.p2, "throw", t0 + W + 1);
        s.stepOnce();
        assert.equal(s.p1.clinchThrowActive, false, label);
        assert.equal(s.p2.clinchThrowActive, true, label);
      });
    });

    it("request still inside its own simul buffer does not block opponent past buffer", () => {
      withRoleSwap({}, (s, label) => {
        const now = s.now();
        // P1 requested just now — buffer not expired (age 0)
        s.setThrowRequest(s.p1, "throw", now);
        // P2 requested long ago — buffer expired, eligible
        s.setThrowRequest(s.p2, "pull", now - (W + 5));
        // Offset between them is W+5 > W → not simultaneous clash
        s.stepOnce();
        assert.equal(s.p1.clinchThrowActive, false, `${label}: fresh buffer waits`);
        assert.equal(s.p2.clinchThrowActive, true, `${label}: expired buffer commits`);
        assert.equal(s.p1.clinchThrowRequest, null, `${label}: cleared as late counter`);
      });
    });
  });

  describe("1ms apart outside window", () => {
    it("earlier by exactly W+1ms wins both orientations", () => {
      withRoleSwap({}, (s, label) => {
        const earlier = s.now() - 200;
        const later = earlier + W + 1; // first ms outside the simul window
        s.setThrowRequest(s.grabber, "pull", later);
        s.setThrowRequest(s.grabbed, "throw", earlier);
        s.stepOnce();
        assert.equal(s.grabbed.clinchThrowActive, true, `${label}: earlier (grabbed)`);
        assert.equal(s.grabber.clinchThrowActive, false, label);
      });
    });
  });

  it("player identity alone never decides: swap only who requested earlier", () => {
    const results = [];
    for (const swapRoles of [false, true]) {
      for (const p1Earlier of [true, false]) {
        const s = sc({ swapRoles });
        const t0 = s.now() - 200;
        if (p1Earlier) {
          s.setThrowRequest(s.p1, "throw", t0);
          s.setThrowRequest(s.p2, "throw", t0 + W + 1);
        } else {
          s.setThrowRequest(s.p2, "throw", t0);
          s.setThrowRequest(s.p1, "throw", t0 + W + 1);
        }
        s.stepOnce();
        results.push({
          swapRoles,
          p1Earlier,
          winner: s.p1.clinchThrowActive ? "p1" : s.p2.clinchThrowActive ? "p2" : "none",
        });
        s.dispose();
        scenarios.pop();
      }
    }
    for (const r of results) {
      assert.equal(
        r.winner,
        r.p1Earlier ? "p1" : "p2",
        `swap=${r.swapRoles} p1Earlier=${r.p1Earlier}`
      );
    }
  });
});
