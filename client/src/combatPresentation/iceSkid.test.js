import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  beltIceRgb,
  burstIceSkid,
  clearIceSkids,
  iceSkidCount,
  parseBeltHex,
  stampIceSkid,
} from "./iceSkid.js";

describe("ice skids", () => {
  it("keeps a scarlet belt scarlet and pulls it toward ice", () => {
    const [r, g, b] = beltIceRgb("#DA1B44");
    assert.ok(r > g && r > b);
    assert.ok(r > 218);
    assert.deepEqual(parseBeltHex("#abc"), [
      parseInt("aa", 16),
      parseInt("bb", 16),
      parseInt("cc", 16),
    ]);
  });

  it("stamps one ribbon per slide foot and throttles the next call", () => {
    clearIceSkids();
    const n = stampIceSkid({
      id: "p1",
      x: 640,
      y: 286,
      facing: -1,
      dir: 1,
      color: "#2266cc",
      speed: 1,
      pose: "sliding",
      now: 1000,
    });
    assert.equal(n, 2);
    assert.equal(iceSkidCount(), 2);
    const again = stampIceSkid({
      id: "p1",
      x: 650,
      y: 286,
      facing: -1,
      dir: 1,
      color: "#2266cc",
      pose: "sliding",
      now: 1010,
    });
    assert.equal(again, 0);
    assert.equal(iceSkidCount(), 2);
    clearIceSkids();
  });

  it("bursts at the standing sole, not once per pad", () => {
    clearIceSkids();
    const n = burstIceSkid({
      x: 640,
      y: 286,
      facing: 1,
      dir: -1,
      color: "#DA1B44",
      pose: "standing",
      now: 0,
    });
    assert.equal(n, 6);
    assert.equal(iceSkidCount(), 6);
    clearIceSkids();
  });
});
