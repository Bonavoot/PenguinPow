const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  BOUT_SECONDS,
  BOUT_CARD_MS,
  HANTEI_TIE_EPSILON,
  describeBout,
  ringFromBoundaries,
  ringSafety,
  hanteiScore,
  resolveHantei,
} = require("../boutClock");

/** Roughly the live dohyo: players spawn at x 220 / 900. */
const RING = { centerX: 560, halfWidth: 340 };

function fighter(over) {
  return { x: RING.centerX, stamina: 100, balance: 100, ...over };
}

describe("boutClock — ring safety", () => {
  it("is 1 at dead center and 0 at either tawara", () => {
    assert.equal(ringSafety(560, 560, 340), 1);
    assert.equal(ringSafety(220, 560, 340), 0);
    assert.equal(ringSafety(900, 560, 340), 0);
  });

  it("is symmetric — mirrored positions score identically", () => {
    // The whole point of normalizing: on the west side a LARGER x means
    // closer to going out, so raw x can never be compared directly.
    assert.equal(ringSafety(390, 560, 340), ringSafety(730, 560, 340));
    assert.equal(ringSafety(300, 560, 340), ringSafety(820, 560, 340));
  });

  it("clamps rather than going negative past the straw", () => {
    assert.equal(ringSafety(-500, 560, 340), 0);
    assert.equal(ringSafety(5000, 560, 340), 0);
  });

  it("survives a degenerate ring instead of dividing by zero", () => {
    assert.equal(ringSafety(100, 0, 0), 1);
    assert.equal(ringSafety(Number.NaN, 560, 340), 1);
  });
});

describe("boutClock — hantei score", () => {
  it("tops out at 100 for an untouched wrestler in the center", () => {
    assert.equal(hanteiScore(fighter(), RING), 100);
  });

  it("bottoms out at 0 on the straw with nothing left", () => {
    assert.equal(
      hanteiScore(fighter({ x: 220, stamina: 0, balance: 0 }), RING),
      0
    );
  });

  it("weights ring control above the bars", () => {
    // Backed onto the straw but pristine: 0 position + full bars = 40.
    const cornered = hanteiScore(
      fighter({ x: 220, stamina: 100, balance: 100 }),
      RING
    );
    // Dead center but spent: full position + empty bars = 60.
    const spent = hanteiScore(
      fighter({ x: 560, stamina: 0, balance: 0 }),
      RING
    );
    assert.equal(cornered, 40);
    assert.equal(spent, 60);
    assert.ok(spent > cornered, "ring control must outrank the bars");
  });

  it("treats missing bars as empty rather than crashing", () => {
    assert.equal(hanteiScore({ x: 560 }, RING), 60);
  });
});

describe("boutClock — resolving an expired bout", () => {
  it("awards the wrestler further from the straw", () => {
    const west = resolveHantei(
      fighter({ x: 300 }), // near the east straw
      fighter({ x: 600 }), // near the middle
      RING
    );
    assert.equal(west.winner, "player2");
    assert.ok(west.scores.player2 > west.scores.player1);
  });

  it("is side-agnostic — the same geometry mirrored flips the winner", () => {
    const a = resolveHantei(fighter({ x: 300 }), fighter({ x: 600 }), RING);
    const b = resolveHantei(fighter({ x: 820 }), fighter({ x: 520 }), RING);
    assert.equal(a.winner, "player2");
    assert.equal(b.winner, "player2");
  });

  it("falls through to the bars when position is level", () => {
    const r = resolveHantei(
      fighter({ x: 460, stamina: 80 }),
      fighter({ x: 660, stamina: 20 }), // mirrored position, less gas
      RING
    );
    assert.equal(r.winner, "player1");
  });

  it("lets posture decide when position and stamina are both level", () => {
    const r = resolveHantei(
      fighter({ x: 460, stamina: 50, balance: 90 }),
      fighter({ x: 660, stamina: 50, balance: 30 }),
      RING
    );
    assert.equal(r.winner, "player1");
  });

  it("calls a perfect mirror a torinaoshi", () => {
    const r = resolveHantei(fighter({ x: 460 }), fighter({ x: 660 }), RING);
    assert.equal(r.winner, null);
    assert.equal(r.scores.player1, r.scores.player2);
  });

  it("does not call a merely close bout a torinaoshi", () => {
    const r = resolveHantei(
      fighter({ x: 460, stamina: 62 }),
      fighter({ x: 660, stamina: 50 }),
      RING
    );
    assert.equal(r.winner, "player1");
    assert.ok(
      r.scores.player1 - r.scores.player2 >= HANTEI_TIE_EPSILON,
      "a 12-point stamina gap must clear the tie band"
    );
  });
});

describe("boutClock — ring from boundaries", () => {
  it("derives center and half-width from the rope line", () => {
    // MAP_LEFT_BOUNDARY / MAP_RIGHT_BOUNDARY in gameUtils.js.
    const ring = ringFromBoundaries(340, 935);
    assert.equal(ring.centerX, 637.5);
    assert.equal(ring.halfWidth, 297.5);
    // Scoring must hit exactly 0 where a ring-out is actually called.
    assert.equal(ringSafety(340, ring.centerX, ring.halfWidth), 0);
    assert.equal(ringSafety(935, ring.centerX, ring.halfWidth), 0);
  });
});

describe("boutClock — bout card", () => {
  it("counts rounds in versus", () => {
    assert.deepEqual(describeBout({ winsP1: 0, winsP2: 0 }), {
      label: "ROUND 1",
      final: false,
    });
    assert.deepEqual(describeBout({ winsP1: 1, winsP2: 0 }), {
      label: "ROUND 2",
      final: false,
    });
  });

  it("calls one fall apiece the final round", () => {
    assert.deepEqual(describeBout({ winsP1: 1, winsP2: 1 }), {
      label: "FINAL ROUND",
      final: true,
    });
  });

  it("counts days in basho", () => {
    const opts = { matchMode: "basho", bashoTotalBouts: 15 };
    assert.deepEqual(describeBout({ ...opts, bashoBout: 0 }), {
      label: "DAY 1",
      final: false,
    });
    assert.deepEqual(describeBout({ ...opts, bashoBout: 6 }), {
      label: "DAY 7",
      final: false,
    });
    assert.deepEqual(describeBout({ ...opts, bashoBout: 14 }), {
      label: "DAY 15",
      final: true,
    });
  });

  it("survives being called with nothing", () => {
    assert.deepEqual(describeBout(), { label: "ROUND 1", final: false });
  });
});

describe("boutClock — constants", () => {
  it("keeps the bout short enough that the clock looks alive", () => {
    assert.ok(BOUT_SECONDS > 0 && BOUT_SECONDS <= 99);
  });

  it("keeps a warmup length for the versus card", () => {
    assert.ok(BOUT_CARD_MS > 0);
  });
});
