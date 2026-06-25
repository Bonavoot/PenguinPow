// ============================================================================
// BASHO in-run power-up draft → server effect mapping (Phase 7)
// ============================================================================
//
// Mirrors bashoStatMods.js / bashoLoadout.js: a pure function that turns the
// human BASHO fighter's drafted power-up list into a derived `bashoDraft`
// object the combat code folds in with neutral defaults. Picks STACK for the
// whole run (passives multiply, blubber adds a charge, actives accumulate
// uses). It is only ever attached to the BASHO human player, so PvP / VS CPU
// never see it (the firewall: `player.bashoDraft?.x ?? neutral`).
//
// Flap is intentionally NOT draftable — it lives in the persistent loadout
// (Defense sidegrade). One effect, one home (§5.4).

const { POWER_UP_TYPES, POWER_UP_EFFECTS } = require("./constants");

const SNOWBALL_THROWS_PER_PICK = 5; // matches the PvP reveal grant
const PUMO_SPAWNS_PER_PICK = 3;

function countOf(list, type) {
  return list.reduce((n, id) => (id === type ? n + 1 : n), 0);
}

/**
 * @param {string[]} drafted - the run's accumulated picks, e.g. ["speed","snowball"]
 * @returns {{
 *   speedMult: number,        // multiply movement speed (1 = none)
 *   powerMult: number,        // multiply knockback dealt (1 = none)
 *   blubberCharges: number,   // hits absorbed this bout (0 = none)
 *   snowball: boolean,        // Snowball active ability available
 *   pumo: boolean,            // Pumo Army active ability available
 *   snowballThrows: number,   // total throws granted this bout
 *   pumoSpawns: number,       // total spawn waves granted this bout
 * }}
 */
function deriveBashoDraft(drafted = []) {
  const list = Array.isArray(drafted) ? drafted : [];

  const speedPicks = countOf(list, POWER_UP_TYPES.SPEED);
  const powerPicks = countOf(list, POWER_UP_TYPES.POWER);
  const snowballPicks = countOf(list, POWER_UP_TYPES.SNOWBALL);
  const pumoPicks = countOf(list, POWER_UP_TYPES.PUMO_ARMY);
  const blubberPicks = countOf(list, POWER_UP_TYPES.THICK_BLUBBER);

  return {
    speedMult: Math.pow(POWER_UP_EFFECTS[POWER_UP_TYPES.SPEED], speedPicks),
    powerMult: Math.pow(POWER_UP_EFFECTS[POWER_UP_TYPES.POWER], powerPicks),
    blubberCharges: blubberPicks,
    snowball: snowballPicks > 0,
    pumo: pumoPicks > 0,
    snowballThrows: snowballPicks * SNOWBALL_THROWS_PER_PICK,
    pumoSpawns: pumoPicks * PUMO_SPAWNS_PER_PICK,
  };
}

module.exports = { deriveBashoDraft };
