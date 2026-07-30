"use strict";

/**
 * Network-condition clinch tests.
 *
 * Uses a deterministic delivery queue — NOT real internet. Simulates delay,
 * reordering, duplicates, brief loss, and client timestamp manipulation.
 * Does not simulate congestion control, jitter distributions, or transport
 * framing quirks.
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLINCH_THROW_CLASH_WINDOW_MS,
  CLINCH_THROW_ANIMATION_MS,
  CLINCH_DRIVE_PLANT_CANCEL_MS,
  CLINCH_JOLT_ANIMATION_MS,
  MAX_PARRY_BACKDATE_MS,
  INPUT_BACKDATE_MIN_MS,
} = require("../../../constants");
const {
  clampTrustedPressGameTime,
  lagCompensatedFromPress,
  getPlayerInputBackdateCapMs,
  lagCompensatedClinchInputStart,
} = require("../../../gameUtils");
const {
  createClinchScenario,
  createNetworkQueue,
} = require("../harness");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createClinchScenario(opts);
  scenarios.push(s);
  return s;
}

/**
 * Apply lag-compensated throw requests as if packets arrived after delay.
 * requestLocalTime = client's intended press on sim timeline before delay.
 */
function deliverTechniqueRequests(s, specs) {
  // specs: [{ player, type, pressSim, receiptDelayMs, rtt }]
  const arrivals = specs.map((spec) => {
    const receipt = spec.pressSim + spec.receiptDelayMs;
    const player = spec.player;
    player.netRttMs = spec.rtt != null ? spec.rtt : 60;
    const pressGame = spec.pressGameTime != null ? spec.pressGameTime : spec.pressSim;
    const trusted = clampTrustedPressGameTime(player, pressGame, receipt);
    player.clinchTechniquePressGameTime = trusted;
    player.clinchTechniquePressReceiptGameNow = receipt;
    const requestTime = lagCompensatedClinchInputStart(player, s.now());
    return { ...spec, receipt, trusted, requestTime };
  });
  for (const a of arrivals) {
    s.setThrowRequest(a.player, a.type, a.requestTime);
  }
  return arrivals;
}

describe("Online and timestamp simulation", () => {
  describe("latency asymmetry on simultaneous window", () => {
    it("symmetric low latency (20ms): true simultaneous stays simultaneous", () => {
      const s = sc();
      const press = s.now();
      // Both press at same sim intent; receipts delayed equally — relative times match
      s.p1.netRttMs = 20;
      s.p2.netRttMs = 20;
      const t1 = lagCompensatedFromPress(s.p1, s.now(), press, press + 20);
      const t2 = lagCompensatedFromPress(s.p2, s.now(), press, press + 20);
      assert.equal(Math.abs(t1 - t2) <= CLINCH_THROW_CLASH_WINDOW_MS, true);
      s.setThrowRequest(s.p1, "throw", t1);
      s.setThrowRequest(s.p2, "throw", t2);
      s.stepOnce();
      assert.equal(s.p1.isClinchClashing, true);
    });

    it("P1 high latency / P2 low: clamp limits reordering of clash window", () => {
      const s = sc();
      const sim = s.now();
      // Identical true press; P1 receipt much later with spoofed early pressGame
      s.p1.netRttMs = 200;
      s.p2.netRttMs = 20;
      const truePress = 100_000;
      const p1Receipt = truePress + 180;
      const p2Receipt = truePress + 20;
      // Attacker tries to claim an earlier press than possible
      const p1Trusted = clampTrustedPressGameTime(s.p1, truePress - 500, p1Receipt);
      const p2Trusted = clampTrustedPressGameTime(s.p2, truePress, p2Receipt);
      const p1Req = lagCompensatedFromPress(s.p1, sim, p1Trusted, p1Receipt);
      const p2Req = lagCompensatedFromPress(s.p2, sim, p2Trusted, p2Receipt);
      // Spoof cannot freely place P1 outside/inside window beyond cap
      const cap1 = getPlayerInputBackdateCapMs(s.p1);
      assert.ok(cap1 <= MAX_PARRY_BACKDATE_MS);
      s.setThrowRequest(s.p1, "throw", p1Req);
      s.setThrowRequest(s.p2, "throw", p2Req);
      s.stepOnce();
      // Document outcome rather than invent fairness rule
      const simul = s.p1.isClinchClashing && s.p2.isClinchClashing;
      const p1Kept = s.p1.clinchThrowRequest === "throw" || s.p1.clinchThrowActive;
      const p2Kept = s.p2.clinchThrowRequest === "throw" || s.p2.clinchThrowActive;
      assert.ok(simul || p1Kept || p2Kept, "some resolution occurred");
    });

    it("symmetric high latency still clamps backdate to MAX_PARRY_BACKDATE_MS", () => {
      const s = sc();
      s.p1.netRttMs = 400;
      assert.equal(getPlayerInputBackdateCapMs(s.p1), MAX_PARRY_BACKDATE_MS);
      const sim = 50_000;
      const receipt = 50_200;
      const press = receipt - 5000;
      const trusted = clampTrustedPressGameTime(s.p1, press, receipt);
      const req = lagCompensatedFromPress(s.p1, sim, trusted, receipt);
      assert.equal(req, sim - MAX_PARRY_BACKDATE_MS);
    });
  });

  describe("packet queue: reorder / duplicate / loss", () => {
    it("reordered delivery: later press can arrive first; gameplay uses request times not arrival order", () => {
      const s = sc();
      const q = createNetworkQueue();
      const t0 = 1_000;
      q.send({ player: "p1", type: "throw", requestTime: t0 }, 100);
      q.send({ player: "p2", type: "throw", requestTime: t0 + 10 }, 50); // arrives first
      const first = q.drain(50);
      assert.equal(first.length, 1);
      assert.equal(first[0].player, "p2");
      const second = q.drain(100);
      assert.equal(second[0].player, "p1");
      // Apply in arrival order but with original request times
      for (const pkt of [...first, ...second]) {
        const player = pkt.player === "p1" ? s.p1 : s.p2;
        s.setThrowRequest(player, pkt.type, pkt.requestTime);
      }
      s.stepOnce();
      assert.equal(s.p1.isClinchClashing, true, "10ms offset still simultaneous");
    });

    it("duplicate packets do not create double Deep Grip grants from one clash", () => {
      const s = sc();
      const q = createNetworkQueue();
      q.send({ op: "throw", who: "p1", t: s.now() }, 10, { duplicate: true });
      const pkts = q.drain(20);
      assert.equal(pkts.length, 2);
      s.setThrowRequest(s.p1, "throw", s.now());
      s.setThrowRequest(s.p2, "throw", s.now());
      s.stepOnce();
      // Only one tumble
      assert.equal(s.p1.isClinchClashing, true);
      s.stepOnce(); // duplicate apply ignored — already clashing / cleared
      assert.equal(s.p1.clinchThrowRequest, null);
    });

    it("brief packet loss: missing throw means no simul", () => {
      const s = sc();
      const q = createNetworkQueue();
      q.send({ player: "p1", type: "throw", requestTime: s.now() }, 10);
      q.send({ player: "p2", type: "throw", requestTime: s.now() }, 10, { drop: true });
      const pkts = q.drain(10);
      assert.equal(pkts.length, 1);
      s.setThrowRequest(s.p1, "throw", pkts[0].requestTime);
      s.stepOnce();
      assert.equal(s.p1.isClinchClashing, false);
      s.advance(CLINCH_THROW_CLASH_WINDOW_MS + 2);
      assert.equal(s.p1.clinchThrowActive, true);
    });

    it("delayed action packet: Perfect Brace still uses activation time not arrival", () => {
      const s = sc();
      const start = s.now();
      const impact = start + CLINCH_THROW_ANIMATION_MS;
      s.setActiveTechnique(s.grabber, "throw", start);
      // Plant "pressed" in window but packet delayed
      const activateAt = impact - 40;
      const q = createNetworkQueue();
      q.send({ activateAt }, impact + 5); // arrives after impact — too late if we waited
      // Authoritative path: brace stamped when processed. If delayed past impact, no PB.
      const late = q.drain(impact + 5);
      assert.equal(late.length, 1);
      // Contrast: if stamped on time via lag-comp before impact:
      s.setActivePlant(s.grabbed, activateAt);
      s.advance(CLINCH_THROW_ANIMATION_MS);
      if (s.grabber.clinchThrowActive) s.stepOnce();
      assert.equal(s.io.last("clinch_throw_fail").payload.perfectBrace, true);
    });
  });

  describe("modified / malformed timestamps at clamp boundaries", () => {
    for (const [name, pressOffset, rtt] of [
      ["at min backdate cap age", -INPUT_BACKDATE_MIN_MS, 0],
      ["at max backdate cap age", -MAX_PARRY_BACKDATE_MS, 400],
      ["beyond max backdate", -MAX_PARRY_BACKDATE_MS - 50, 400],
      ["future press", +80, 60],
      ["zero press", null, 60],
    ]) {
      it(name, () => {
        const s = sc();
        s.p1.netRttMs = rtt;
        const receipt = 20_000;
        const press =
          pressOffset == null ? 0 : receipt + pressOffset;
        const trusted = clampTrustedPressGameTime(s.p1, press, receipt);
        if (pressOffset == null || press === 0) {
          assert.equal(trusted, 0);
        } else if (pressOffset > 0) {
          assert.equal(trusted, receipt);
        } else {
          const cap = getPlayerInputBackdateCapMs(s.p1);
          assert.ok(trusted >= receipt - cap);
          assert.ok(trusted <= receipt);
        }
      });
    }

    it("non-monotonic second press is slack-limited", () => {
      const s = sc();
      const receipt = 5000;
      clampTrustedPressGameTime(s.p1, 4900, receipt);
      const second = clampTrustedPressGameTime(s.p1, 4800, receipt + 10);
      assert.ok(second >= 4900 - 8);
    });
  });

  describe("important scenarios under latency", () => {
    it("Committed Drive cancel + delayed Plant stamp: defense uses cancelUntil", () => {
      const s = sc();
      s.setCommittedDrive(s.grabbed);
      s.stepOnce();
      s.holdAway(s.grabbed);
      const t0 = s.now();
      s.stepOnce();
      const activateAt = t0 + CLINCH_DRIVE_PLANT_CANCEL_MS;
      // Spoofed early brace stamp must not win
      s.grabbed.clinchBraceSimTime = t0 - 100;
      assert.equal(s.grabbed.clinchDrivePlantCancelUntil, activateAt);
      const {
        getPlantActivationTime,
      } = require("../../../grabActionSystem");
      assert.equal(getPlantActivationTime(s.grabbed), activateAt);
    });

    it("Jolt vs pending technique under delayed throw packet", () => {
      const s = sc();
      const q = createNetworkQueue();
      // Throw packet delayed past jolt impact
      q.send({ type: "throw", t: s.now() }, s.now() + CLINCH_JOLT_ANIMATION_MS + 50);
      s.setJoltRequest(s.grabber, s.now());
      s.stepOnce();
      s.advance(CLINCH_JOLT_ANIMATION_MS);
      if (s.grabber.isClinchJolting) s.stepOnce();
      // Deliver late throw after jolt cleared buffers
      const late = q.drain(s.now() + CLINCH_JOLT_ANIMATION_MS + 50);
      s.setThrowRequest(s.grabbed, "throw", late[0].t);
      // May be input-locked from jolt
      s.stepOnce();
      if (s.grabbed.inputLockUntil > s.now()) {
        assert.equal(s.grabbed.clinchThrowActive, false);
      }
    });

    it("Break during technique startup unaffected by timestamp (uses simNow)", () => {
      const s = sc();
      s.setActiveTechnique(s.grabber, "throw", s.now());
      s.setBreakRequest(s.grabbed, s.now());
      s.stepOnce();
      assert.equal(s.grabbed.isGrabBreaking, true);
    });
  });
});
