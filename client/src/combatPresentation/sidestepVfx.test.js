/**
 * Phase 2 — sidestep client presentation helpers.
 * Run: node --test client/src/combatPresentation/sidestepVfx.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SIDESTEP_ACTIVE_MS,
  isSidestepActivePhase,
  resolveSidestepTravelDirection,
  sidestepTrailProgress,
} from "./sidestepVfx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Phase 2 — sidestep VFX presentation", () => {
  it("active duration is 400 — no 320 assumption in helpers", () => {
    assert.equal(SIDESTEP_ACTIVE_MS, 400);
  });

  it("trail follows travel direction, never facing", () => {
    assert.equal(
      resolveSidestepTravelDirection({ sidestepDirection: 1, facing: -1 }),
      1
    );
    assert.equal(
      resolveSidestepTravelDirection({ sidestepDirection: -1, facing: -1 }),
      -1
    );
    // Facing must not fill in when travel unknown
    assert.equal(
      resolveSidestepTravelDirection({ facing: 1, sidestepDirection: 0 }),
      null
    );
    assert.equal(resolveSidestepTravelDirection({ facing: -1 }), null);
  });

  it("predicted travel may be used until auth arrives; facing never", () => {
    assert.equal(
      resolveSidestepTravelDirection({
        predictedTravelDirection: -1,
        facing: 1,
      }),
      -1
    );
    assert.equal(
      resolveSidestepTravelDirection({
        sidestepDirection: 1,
        predictedTravelDirection: -1,
      }),
      1
    );
  });

  it("cross-up facing change does not reverse resolved travel", () => {
    const travel = resolveSidestepTravelDirection({ sidestepDirection: 1 });
    assert.equal(travel, 1);
    // Same travel after facing flip
    assert.equal(
      resolveSidestepTravelDirection({ sidestepDirection: travel, facing: 1 }),
      1
    );
    assert.equal(
      resolveSidestepTravelDirection({ sidestepDirection: travel, facing: -1 }),
      1
    );
  });

  it("active phase gating matches server flags; recovery clears trail phase", () => {
    assert.equal(
      isSidestepActivePhase({
        isSidestepping: true,
        isSidestepStartup: false,
        isSidestepRecovery: false,
      }),
      true
    );
    assert.equal(
      isSidestepActivePhase({
        isSidestepping: true,
        isSidestepStartup: true,
        isSidestepRecovery: false,
      }),
      false
    );
    assert.equal(
      isSidestepActivePhase({
        isSidestepping: true,
        isSidestepStartup: false,
        isSidestepRecovery: true,
      }),
      false
    );
    assert.equal(isSidestepActivePhase({ isSidestepping: false }), false);
  });

  it("trail progress uses 400 ms; interrupted/inactive stops at phase edge", () => {
    assert.equal(sidestepTrailProgress(0), 0);
    assert.ok(Math.abs(sidestepTrailProgress(200) - 0.5) < 1e-9);
    assert.equal(sidestepTrailProgress(400), 1);
    assert.equal(sidestepTrailProgress(999), 1);
    // Old 320 assumption would mark mid-arc differently
    assert.ok(sidestepTrailProgress(320) < 1);
    assert.ok(Math.abs(sidestepTrailProgress(320) - 0.8) < 1e-9);
  });

  it("GameFighter sidestep VFX source has no 320 active assumption or facing trail", () => {
    const fighterPath = path.join(
      __dirname,
      "../components/GameFighter.jsx"
    );
    const src = fs.readFileSync(fighterPath, "utf8");
    assert.equal(/ACTIVE_MS\s*=\s*320/.test(src), false);
    assert.equal(/SIDESTEP_ACTIVE_MS\s*=\s*320/.test(src), false);
    // Must not emit trail/start with facing as direction
    assert.equal(
      /emitParticles\(\s*"sidestep(?:Start|Trail)"[\s\S]{0,200}direction:\s*penguin\.facing/.test(
        src
      ),
      false
    );
    assert.ok(src.includes("resolveSidestepTravelDirection"));
    assert.ok(src.includes("SIDESTEP_ACTIVE_MS"));
  });
});
