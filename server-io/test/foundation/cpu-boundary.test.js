"use strict";

/**
 * Phase 2 — CPU uses authoritative arena boundaries (340 / 935).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../../gameUtils");

describe("Phase 2 — CPU boundary authority", () => {
  it("authoritative arena limits are 340 / 935", () => {
    assert.equal(MAP_LEFT_BOUNDARY, 340);
    assert.equal(MAP_RIGHT_BOUNDARY, 935);
  });

  it("cpuAI.js has no stale gameplay right-boundary literal 940", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../cpuAI.js"),
      "utf8"
    );
    assert.equal(/MAP_RIGHT_BOUNDARY\s*=\s*940/.test(src), false);
    assert.equal(/\b940\b/.test(src), false);
    assert.ok(/MAP_RIGHT_BOUNDARY\s*=\s*GAME_MAP_RIGHT/.test(src));
    assert.ok(/MAP_LEFT_BOUNDARY\s*=\s*GAME_MAP_LEFT/.test(src));
  });

  it("mirrored edge distance formulas use the same authority", () => {
    // Mirror of cpuAI distanceToLeftEdge / distanceToRightEdge
    const leftX = MAP_LEFT_BOUNDARY + 40;
    const rightX = MAP_RIGHT_BOUNDARY - 40;
    assert.equal(leftX - MAP_LEFT_BOUNDARY, 40);
    assert.equal(MAP_RIGHT_BOUNDARY - rightX, 40);
    assert.equal(MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY, 595);
  });
});
