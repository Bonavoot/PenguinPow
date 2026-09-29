const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { sampleKillThrowY, KILL_THROW_PEAK_AT } = require("../../killThrowArc");

const GROUND = 286;
const ARC = 240;
const FALL = 37;

describe("kill throw arc", () => {
  it("peaks once and returns to the ring", () => {
    const y0 = sampleKillThrowY(0, { ground: GROUND, arcHeight: ARC, landY: GROUND });
    const peak = sampleKillThrowY(KILL_THROW_PEAK_AT, {
      ground: GROUND,
      arcHeight: ARC,
      landY: GROUND,
    });
    const y1 = sampleKillThrowY(1, { ground: GROUND, arcHeight: ARC, landY: GROUND });
    assert.equal(y0, GROUND);
    assert.equal(peak, GROUND + ARC);
    assert.ok(Math.abs(y1 - GROUND) < 0.001);
  });

  it("on-ring fall matches the ease-in quad back to ground", () => {
    const p = 0.9;
    const fallT = (p - KILL_THROW_PEAK_AT) / (1 - KILL_THROW_PEAK_AT);
    const eased = fallT * fallT;
    const expected = GROUND + ARC * (1 - eased);
    const y = sampleKillThrowY(p, { ground: GROUND, arcHeight: ARC, landY: GROUND });
    assert.ok(Math.abs(y - expected) < 0.001, `${y} vs ${expected}`);
  });

  it("off-dohyo fall ends on the lower apron and stays continuous through the crown", () => {
    const landY = GROUND - FALL;
    const peakOn = sampleKillThrowY(KILL_THROW_PEAK_AT, {
      ground: GROUND,
      arcHeight: ARC,
      landY: GROUND,
    });
    const peakOff = sampleKillThrowY(KILL_THROW_PEAK_AT, {
      ground: GROUND,
      arcHeight: ARC,
      landY,
    });
    assert.equal(peakOn, peakOff);
    const end = sampleKillThrowY(1, { ground: GROUND, arcHeight: ARC, landY });
    assert.ok(Math.abs(end - landY) < 0.001, `ended at ${end}`);
    let prev = GROUND;
    for (let i = 1; i <= 48; i++) {
      const y = sampleKillThrowY(i / 100, {
        ground: GROUND,
        arcHeight: ARC,
        landY,
      });
      assert.ok(y >= prev - 0.001, "rise must not dip");
      prev = y;
    }
    for (let i = 49; i <= 100; i++) {
      const y = sampleKillThrowY(i / 100, {
        ground: GROUND,
        arcHeight: ARC,
        landY,
      });
      assert.ok(y <= prev + 0.001, "fall must not climb");
      prev = y;
    }
  });
});
