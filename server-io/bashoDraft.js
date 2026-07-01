// ============================================================================
// BASHO in-run power-up draft → server effect mapping (Phase 7)
// ============================================================================
//
// Mirrors bashoStatMods.js / bashoLoadout.js: a pure function that turns the
// human BASHO fighter's drafted power-up list into a derived `bashoDraft`
// object the combat code folds in with neutral defaults. Passives STACK for the
// whole run (passives multiply, blubber adds a charge). Draft actives stack
// uses within one type, but only one active (Snowball OR Pumo Army) is kept —
// picking the other replaces it. It is only ever attached to the BASHO human
// player, so PvP / VS CPU never see it (the firewall: `player.bashoDraft?.x ?? neutral`).
//
// Flap is intentionally NOT draftable — it lives in the persistent loadout
// (Defense sidegrade). One effect, one home (§5.4).

const { POWER_UP_TYPES, POWER_UP_EFFECTS } = require("./constants");

const SNOWBALL_THROWS_PER_PICK = 5; // matches the PvP reveal grant
const PUMO_SPAWNS_PER_PICK = 3;

// BASHO draft tuning — weaker than PvP's POWER_UP_EFFECTS.power (1.3) because
// picks stack across the run. PvP / VS CPU never read this constant.
const BASHO_DRAFT_POWER_MULT = 1.05; // +5% knockback per pick

// Happy Feet (movement speed) stacks with DIMINISHING RETURNS toward a hard
// ceiling instead of pure multiplicative growth. The old 1.4^N exploded
// (2 picks = 1.96×, 3 = 2.74×, …): not just overpowered, but the resulting
// speed outran what the client could render — the movement predictor (which
// integrates walk locomotion locally) had no knowledge of the buff and fell
// progressively behind the true server position, so the camera appeared to run
// ahead of the sprite and the sprite "caught up" (looked like slowing down)
// near the boundary. Capping the multiplier keeps displacement renderable.
//
// Shape: pick 1 reproduces the PvP single-Happy-Feet value EXACTLY (parity of a
// lone pick), each further pick adds a shrinking slice of the remaining
// headroom, and the total asymptotes to SPEED_STACK_CAP. The ceiling is a pure
// BALANCE knob, not a render limit: now that the client predictor shares this
// exact multiplier (and the camera follows the reconciled sprite), movement
// speed is renderable well past anything reachable here. It's tuned so that
// deep stacks still feel like a real payoff while staying under the old
// multiplicative curve at every count (old 3-stack 1.4^3 = 2.74 was the "too
// crazy" mark; here even 7 stacks lands below it). Example values:
//   1 pick → 1.400 (unchanged)   2 → ~1.693   3 → ~1.908
//   5 → ~2.182   7 → ~2.329   ∞ → 2.500
const SPEED_STACK_CAP = 2.5; // ceiling for stacked Happy Feet movement multiplier

function stackedSpeedMult(picks) {
  if (picks <= 0) return 1;
  const base = POWER_UP_EFFECTS[POWER_UP_TYPES.SPEED]; // single-pick value (1.4)
  // Guard: if the ceiling isn't above a single pick, fall back to the base so
  // one pick still matches PvP and we never produce a decreasing curve.
  if (SPEED_STACK_CAP <= base) return base;
  const headroom = SPEED_STACK_CAP - 1;
  // Decay anchored so that picks === 1 reproduces `base` exactly.
  const decay = 1 - (base - 1) / headroom;
  return 1 + headroom * (1 - Math.pow(decay, picks));
}

const BASHO_DRAFT_ACTIVES = [
  POWER_UP_TYPES.SNOWBALL,
  POWER_UP_TYPES.PUMO_ARMY,
];

function isBashoDraftActive(type) {
  return BASHO_DRAFT_ACTIVES.includes(type);
}

/** Legacy saves may hold both actives; keep only the most recently picked. */
function normalizeBashoDraftList(list = []) {
  const base = Array.isArray(list) ? list : [];
  let lastActive = null;
  for (const type of base) {
    if (isBashoDraftActive(type)) lastActive = type;
  }
  return base.filter(
    (type) => !isBashoDraftActive(type) || type === lastActive
  );
}

/** Stack a new pick; picking a different active replaces the previous one. */
function applyBashoDraftPick(list = [], pickedType) {
  if (!pickedType) return normalizeBashoDraftList(list);
  const base = normalizeBashoDraftList(list);
  if (!isBashoDraftActive(pickedType)) return [...base, pickedType];
  const otherActives = BASHO_DRAFT_ACTIVES.filter((t) => t !== pickedType);
  return [...base.filter((t) => !otherActives.includes(t)), pickedType];
}

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
  const list = normalizeBashoDraftList(drafted);

  const speedPicks = countOf(list, POWER_UP_TYPES.SPEED);
  const powerPicks = countOf(list, POWER_UP_TYPES.POWER);
  const snowballPicks = countOf(list, POWER_UP_TYPES.SNOWBALL);
  const pumoPicks = countOf(list, POWER_UP_TYPES.PUMO_ARMY);
  const blubberPicks = countOf(list, POWER_UP_TYPES.THICK_BLUBBER);

  return {
    speedMult: stackedSpeedMult(speedPicks),
    powerMult: Math.pow(BASHO_DRAFT_POWER_MULT, powerPicks),
    blubberCharges: blubberPicks,
    snowball: snowballPicks > 0,
    pumo: pumoPicks > 0,
    snowballThrows: snowballPicks * SNOWBALL_THROWS_PER_PICK,
    pumoSpawns: pumoPicks * PUMO_SPAWNS_PER_PICK,
  };
}

module.exports = {
  deriveBashoDraft,
  normalizeBashoDraftList,
  applyBashoDraftPick,
};
