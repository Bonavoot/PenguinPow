import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { trailAnchors, trailDistances } from "./motionTrail.js";

describe("motion trail anchors", () => {
  it("parks ghosts on the path behind the body, not on it", () => {
    const samples = [
      { x: 0, y: 286, src: "a" },
      { x: 20, y: 286, src: "b" },
      { x: 40, y: 286, src: "c" },
    ];
    const [near, far] = trailAnchors(samples, [16, 34]);
    assert.ok(Math.abs(near.x - 24) < 0.01);
    assert.equal(near.y, 286);
    assert.equal(near.src, "b");
    assert.ok(Math.abs(far.x - 6) < 0.01);
    assert.equal(far.src, "a");
  });

  it("returns nothing when the body has barely moved", () => {
    const samples = [
      { x: 100, y: 286 },
      { x: 104, y: 286 },
    ];
    const [near] = trailAnchors(samples, [16]);
    assert.equal(near, null);
  });

  it("follows a hop, not just X", () => {
    const samples = [
      { x: 0, y: 286 },
      { x: 0, y: 320 },
    ];
    const [g] = trailAnchors(samples, [20]);
    assert.equal(g.x, 0);
    assert.ok(Math.abs(g.y - 300) < 0.01);
  });

  it("low spec asks for a single echo", () => {
    assert.deepEqual(trailDistances(true), [22]);
    assert.equal(trailDistances(false).length, 2);
  });
});
