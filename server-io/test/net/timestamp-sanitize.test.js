"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_PARRY_BACKDATE_MS,
  INPUT_BACKDATE_MIN_MS,
  INPUT_PRESS_MONOTONIC_SLACK_MS,
} = require("../../constants");
const {
  clampTrustedPressGameTime,
  getPlayerInputBackdateCapMs,
  resolvePlayerNetRttMs,
  lagCompensatedFromPress,
  updatePlayerNetEstimate,
} = require("../../gameUtils");

describe("timestamp sanitization (clinch-relevant)", () => {
  let player;

  beforeEach(() => {
    player = {
      netRttMs: 60,
      lastTrustedPressGameTime: 0,
    };
  });

  describe("resolvePlayerNetRttMs / backdate cap", () => {
    it("numeric 0 is a real RTT (not missing) → floor backdate cap", () => {
      player.netRttMs = 0;
      assert.equal(resolvePlayerNetRttMs(player), 0);
      // max(32, 0*0.5+16) = 32
      assert.equal(getPlayerInputBackdateCapMs(player), INPUT_BACKDATE_MIN_MS);
    });

    it('string "0" is a real RTT → floor backdate cap', () => {
      player.netRttMs = "0";
      assert.equal(resolvePlayerNetRttMs(player), 0);
      assert.equal(getPlayerInputBackdateCapMs(player), INPUT_BACKDATE_MIN_MS);
    });

    it("valid positive RTT values are used (clamped to 400)", () => {
      player.netRttMs = 1;
      assert.equal(resolvePlayerNetRttMs(player), 1);
      assert.equal(getPlayerInputBackdateCapMs(player), INPUT_BACKDATE_MIN_MS);

      player.netRttMs = 60;
      assert.equal(resolvePlayerNetRttMs(player), 60);
      assert.equal(getPlayerInputBackdateCapMs(player), 46); // max(32, 30+16)

      player.netRttMs = 200;
      assert.equal(resolvePlayerNetRttMs(player), 200);
      assert.equal(getPlayerInputBackdateCapMs(player), 116); // 100+16

      player.netRttMs = 400;
      assert.equal(resolvePlayerNetRttMs(player), 400);
      assert.equal(getPlayerInputBackdateCapMs(player), MAX_PARRY_BACKDATE_MS);

      player.netRttMs = 999;
      assert.equal(resolvePlayerNetRttMs(player), 400);
      assert.equal(getPlayerInputBackdateCapMs(player), MAX_PARRY_BACKDATE_MS);

      player.netRttMs = "80";
      assert.equal(resolvePlayerNetRttMs(player), 80);
    });

    it("missing / empty values fall back to default 60", () => {
      player.netRttMs = undefined;
      assert.equal(resolvePlayerNetRttMs(player), 60);
      player.netRttMs = null;
      assert.equal(resolvePlayerNetRttMs(player), 60);
      player.netRttMs = "";
      assert.equal(resolvePlayerNetRttMs(player), 60);
      assert.equal(resolvePlayerNetRttMs(null), 60);
      assert.equal(resolvePlayerNetRttMs({}), 60);
    });

    it("malformed / non-finite / negative values fall back to default 60", () => {
      for (const bad of [NaN, Infinity, -Infinity, -1, -0.5, "abc", "NaN", {}]) {
        player.netRttMs = bad;
        assert.equal(
          resolvePlayerNetRttMs(player),
          60,
          `expected default for ${String(bad)}`
        );
      }
    });

    it("backdate cap floors at INPUT_BACKDATE_MIN_MS and ceilings at MAX_PARRY_BACKDATE_MS", () => {
      player.netRttMs = 0;
      assert.equal(getPlayerInputBackdateCapMs(player), INPUT_BACKDATE_MIN_MS);
      player.netRttMs = 400;
      assert.equal(getPlayerInputBackdateCapMs(player), MAX_PARRY_BACKDATE_MS);
      player.netRttMs = undefined;
      assert.equal(getPlayerInputBackdateCapMs(player), 46); // default RTT 60
    });
  });

  it("rejects missing / falsy press times as 0", () => {
    assert.equal(clampTrustedPressGameTime(player, 0, 1000), 0);
    assert.equal(clampTrustedPressGameTime(player, null, 1000), 0);
  });

  it("clamps future press times down to receipt", () => {
    const receipt = 5000;
    const trusted = clampTrustedPressGameTime(player, receipt + 200, receipt);
    assert.equal(trusted, receipt);
  });

  it("clamps excessively old presses up to receipt - cap", () => {
    const receipt = 5000;
    const cap = getPlayerInputBackdateCapMs(player);
    const trusted = clampTrustedPressGameTime(player, receipt - 10_000, receipt);
    assert.equal(trusted, receipt - cap);
  });

  it("enforces near-monotonic presses with slack", () => {
    const receipt = 5000;
    player.lastTrustedPressGameTime = 4900;
    const trusted = clampTrustedPressGameTime(player, 4500, receipt);
    assert.ok(trusted >= 4900 - INPUT_PRESS_MONOTONIC_SLACK_MS);
  });

  it("lagCompensatedFromPress returns simNow when press missing or non-positive age", () => {
    assert.equal(lagCompensatedFromPress(player, 2000, 0, 2100), 2000);
    assert.equal(lagCompensatedFromPress(player, 2000, 2200, 2100), 2000);
  });

  it("lagCompensatedFromPress backdates by min(age, cap)", () => {
    const simNow = 10_000;
    const receipt = 10_050;
    const press = receipt - 40;
    const cap = getPlayerInputBackdateCapMs(player);
    const result = lagCompensatedFromPress(player, simNow, press, receipt);
    assert.equal(result, simNow - Math.min(40, cap));
  });

  it("lagCompensatedFromPress never backdates more than cap even with huge age", () => {
    const simNow = 10_000;
    const receipt = 10_050;
    const press = receipt - 5000;
    const cap = getPlayerInputBackdateCapMs(player);
    const result = lagCompensatedFromPress(player, simNow, press, receipt);
    assert.equal(result, simNow - cap);
  });

  it("zero-RTT player uses floor cap in lag compensation", () => {
    player.netRttMs = 0;
    const simNow = 10_000;
    const receipt = 10_050;
    const press = receipt - 5000;
    const result = lagCompensatedFromPress(player, simNow, press, receipt);
    assert.equal(result, simNow - INPUT_BACKDATE_MIN_MS);
  });

  it("updatePlayerNetEstimate ignores unsynced packets", () => {
    updatePlayerNetEstimate(player, { clientSynced: false, clientRtt: 200 });
    assert.equal(player.netRttMs, 60);
  });

  it("updatePlayerNetEstimate blends RTT when synced", () => {
    updatePlayerNetEstimate(player, {
      clientSynced: true,
      clientRtt: 100,
      clientOffset: 12,
    });
    assert.ok(player.netRttMs > 60 && player.netRttMs < 100);
    assert.equal(player.netClockOffsetMs, 12);
  });

  it("updatePlayerNetEstimate accepts numeric clientRtt of 0", () => {
    updatePlayerNetEstimate(player, {
      clientSynced: true,
      clientRtt: 0,
    });
    // EMA: 60*0.8 + 0*0.2 = 48
    assert.equal(player.netRttMs, 48);
  });

  it("malformed non-finite press age falls back to simNow", () => {
    assert.equal(
      lagCompensatedFromPress(player, 1111, Number.NaN, 2000),
      1111
    );
  });
});
