"use strict";

/**
 * Rope-rest park contract.
 *
 * Tip park / extension-sep used to write victim X past MAP_*_BOUNDARY at the
 * tawara, freeze that pose through hitstop, then slap rope resistance yanked
 * them back to MAP ± SLAP_ROPE_RESIST_BUFFER — the outside→snap-back bug on
 * clamp barrages. Park writers must never leave the rope rest.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  SLAP_ROPE_RESIST_BUFFER,
} = require("../../constants");
const {
  MAP_LEFT_BOUNDARY,
  MAP_RIGHT_BOUNDARY,
} = require("../../gameUtils");
const {
  applyContactCorrection,
  enforceStrikeExtensionSeparation,
  clampToRopeRest,
  getHitParkDistance,
} = require("../../strikeContact");

const REST_LEFT = MAP_LEFT_BOUNDARY + SLAP_ROPE_RESIST_BUFFER;
const REST_RIGHT = MAP_RIGHT_BOUNDARY - SLAP_ROPE_RESIST_BUFFER;

function fighter(overrides = {}) {
  return {
    x: 640,
    facing: 1,
    sizeMultiplier: 0.85,
    slapAnimation: 1,
    isAttacking: true,
    isInStartupFrames: false,
    attackType: "slap",
    attackStartTime: 0,
    ...overrides,
  };
}

describe("rope-rest park", () => {
  it("clampToRopeRest matches slap rope resistance rest", () => {
    assert.equal(clampToRopeRest(MAP_RIGHT_BOUNDARY + 40), REST_RIGHT);
    assert.equal(clampToRopeRest(MAP_LEFT_BOUNDARY - 40), REST_LEFT);
    assert.equal(clampToRopeRest(640), 640);
  });

  it("applyContactCorrection never parks the victim past the right rope rest", () => {
    // Attacker closed in; ideal tip park wants victim past MAP_RIGHT.
    const attacker = fighter({ x: REST_RIGHT - 100, facing: -1 });
    const victim = fighter({
      x: REST_RIGHT,
      facing: 1,
      isAttacking: false,
      attackType: undefined,
    });
    const parkDist = getHitParkDistance("slap", attacker, victim);
    assert.ok(parkDist > 100, `expected a real park distance, got ${parkDist}`);

    applyContactCorrection(attacker, victim, parkDist);

    assert.ok(
      victim.x <= REST_RIGHT + 1e-6,
      `victim must not park past rope rest, got ${victim.x} (rest ${REST_RIGHT})`
    );
    assert.ok(
      victim.x >= REST_LEFT - 1e-6,
      `victim must stay inside left rest too, got ${victim.x}`
    );
    // Spacing should still be approximately tip park (attacker pulled in).
    const gap = Math.abs(victim.x - attacker.x);
    assert.ok(
      Math.abs(gap - parkDist) < 1.5 || gap <= parkDist + 1e-6,
      `expected tip spacing ~${parkDist}, got ${gap}`
    );
  });

  it("applyContactCorrection never parks the victim past the left rope rest", () => {
    const attacker = fighter({ x: REST_LEFT + 100, facing: 1 });
    const victim = fighter({
      x: REST_LEFT,
      facing: -1,
      isAttacking: false,
      attackType: undefined,
    });
    const parkDist = getHitParkDistance("slap", attacker, victim);

    applyContactCorrection(attacker, victim, parkDist);

    assert.ok(
      victim.x >= REST_LEFT - 1e-6,
      `victim must not park past left rope rest, got ${victim.x}`
    );
  });

  it("enforceStrikeExtensionSeparation never shoves past rope rest", () => {
    const attacker = fighter({
      x: REST_RIGHT - 80,
      facing: -1,
      // Past AP grace so live sep runs.
      attackStartTime: 0,
    });
    const opponent = fighter({
      x: REST_RIGHT - 10,
      facing: 1,
      isAttacking: false,
      attackType: undefined,
    });
    // nowSim far past slap startup + late-parry grace
    enforceStrikeExtensionSeparation(attacker, opponent, 10_000);

    assert.ok(
      opponent.x <= REST_RIGHT + 1e-6,
      `live sep must not shove past rope rest, got ${opponent.x}`
    );
  });

  it("ideal mid-ring park is unchanged", () => {
    const attacker = fighter({ x: 600, facing: -1 });
    const victim = fighter({
      x: 700,
      facing: 1,
      isAttacking: false,
      attackType: undefined,
    });
    const parkDist = getHitParkDistance("slap", attacker, victim);
    applyContactCorrection(attacker, victim, parkDist);
    assert.ok(Math.abs(Math.abs(victim.x - attacker.x) - parkDist) < 1.5);
    assert.ok(victim.x > REST_LEFT && victim.x < REST_RIGHT);
  });
});
