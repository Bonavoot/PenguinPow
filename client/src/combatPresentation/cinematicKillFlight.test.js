import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCinematicKillFlight,
  armCinematicKillFlight,
  clearCinematicKillFlight,
  stepCinematicKillFlight,
  CINEMATIC_KILL_FLIGHT,
} from "./cinematicKillFlight.js";

describe("cinematicKillFlight", () => {
  it("first step after arm seeds without leaping", () => {
    const f = createCinematicKillFlight();
    armCinematicKillFlight(f, 800);
    const p = stepCinematicKillFlight(f, {
      nowMs: 1000,
      kbX: 11.2,
      authorityX: 800,
      y: 286,
    });
    assert.equal(p.x, 800);
    assert.equal(p.y, 286);
  });

  it("integrates at the server px/ms rate (smooth across display frames)", () => {
    const f = createCinematicKillFlight();
    armCinematicKillFlight(f, 800);
    stepCinematicKillFlight(f, { nowMs: 0, kbX: 11.2, authorityX: 800, y: 286 });
    const a = stepCinematicKillFlight(f, {
      nowMs: 16.667,
      kbX: 11.2,
      authorityX: 800 + 11.2 * 16.667 * CINEMATIC_KILL_FLIGHT.SPEED_FACTOR,
      y: 286,
    });
    const expected = 800 + 11.2 * 16.667 * CINEMATIC_KILL_FLIGHT.SPEED_FACTOR;
    assert.ok(Math.abs(a.x - expected) < 1.5, `x ${a.x} ≈ ${expected}`);
  });

  it("does not leak toward a 32px snapshot step", () => {
    const f = createCinematicKillFlight();
    armCinematicKillFlight(f, 800);
    stepCinematicKillFlight(f, { nowMs: 0, kbX: 11.2, authorityX: 800, y: 286 });
    const p = stepCinematicKillFlight(f, {
      nowMs: 16,
      kbX: 11.2,
      authorityX: 832,
      y: 286,
    });
    const integrated = 800 + 11.2 * 16 * CINEMATIC_KILL_FLIGHT.SPEED_FACTOR;
    assert.ok(
      Math.abs(p.x - integrated) < 0.01,
      `integrator should ignore the 32px snapshot (got ${p.x}, want ${integrated})`
    );
  });

  it("does not inherit a 32px snapshot step as a visible hitch", () => {
    const f = createCinematicKillFlight();
    armCinematicKillFlight(f, 800);
    stepCinematicKillFlight(f, { nowMs: 0, kbX: 11.2, authorityX: 800, y: 286 });
    const xs = [];
    for (let i = 1; i <= 6; i++) {
      const t = i * 8;
      const authority = 800 + Math.floor(t / 16) * 32;
      const p = stepCinematicKillFlight(f, {
        nowMs: t,
        kbX: 11.2,
        authorityX: authority,
        y: 286,
      });
      xs.push(p.x);
    }
    for (let i = 1; i < xs.length; i++) {
      const step = xs[i] - xs[i - 1];
      assert.ok(
        step > 0 && step < 20,
        `display step ${step.toFixed(2)}px should be a glide, not a 32px snap`
      );
    }
  });

  it("hard-snaps if the integrator drifted off the rocket", () => {
    const f = createCinematicKillFlight();
    armCinematicKillFlight(f, 800);
    stepCinematicKillFlight(f, { nowMs: 0, kbX: 11.2, authorityX: 800, y: 286 });
    f.x = 400;
    const p = stepCinematicKillFlight(f, {
      nowMs: 16,
      kbX: 11.2,
      authorityX: 832,
      y: 286,
    });
    assert.ok(Math.abs(p.x - 832) < 1, `snapped to authority, got ${p.x}`);
  });

  it("clear disarms the integrator", () => {
    const f = createCinematicKillFlight();
    armCinematicKillFlight(f, 800);
    clearCinematicKillFlight(f);
    assert.equal(
      stepCinematicKillFlight(f, { nowMs: 16, kbX: 11.2, authorityX: 800, y: 286 }),
      null
    );
  });
});
