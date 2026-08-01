"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  beginOffensiveAerialTrace,
  recordOffensiveAerialTick,
} = require("../../offensiveAerialTrace");

describe("offensive aerial trace bounds", () => {
  it("caps retained samples so debug sessions cannot grow without limit", () => {
    const player = { id: "p-trace" };
    beginOffensiveAerialTrace(player, { simTime: 0 });
    for (let i = 0; i < 400; i++) {
      recordOffensiveAerialTick(player, { tick: i, simTime: i });
    }
    assert.ok(player._offensiveAerialTrace.samples.length <= 256);
    assert.equal(player._offensiveAerialTrace.samples.length, 256);
    assert.equal(player._offensiveAerialTrace.samples[0].tick, 144);
    assert.equal(player._offensiveAerialTrace.samples[255].tick, 399);
  });
});
