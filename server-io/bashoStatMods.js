// ============================================================================
// BASHO attribute → combat-modifier mapping (Phase 4)
// ============================================================================
//
// Maps the five BASHO attributes (each an effective value 1..10) to a set of
// combat multipliers. These mods are attached to the BASHO match's HUMAN player
// ONLY (via createInitialPlayerState overrides in create_basho_match). Every
// other player — PvP, VS CPU, and the BASHO CPU opponent — has no `statMods`, so
// every combat site reads `(player.statMods?.x ?? 1) === 1` and behaves EXACTLY
// as it does today. This is the firewall: the modifiers literally cannot apply
// to a non-BASHO fighter because the object key isn't there.
//
// Tuning (signed off): the PvP baseline sits at stat value 4 — i.e. a fighter
// with all stats at 4 is identical to a stock PvP/VS CPU fighter (every mod =
// 1.0). Below 4 is a functional floor (slightly weaker); above 4 climbs to the
// cap at 10. Deliberately moderate-wide with floors: an *edge*, not a hard gate.
//   POWER       0.85 → 1.00 → 1.30   (outgoing knockback ×)
//   RESISTANCE  1.15 → 1.00 → 0.72   (incoming knockback ×; 0.72 floor still
//                                      lets a patient pusher ring you out)
//   MOVE SPEED  0.91 → 1.00 → 1.18   (walk displacement ×)
//   STAMINA     0.90 → 1.00 → 1.25   (stamina regen rate ×)
//   BALANCE     0.90 → 1.00 → 1.25   (balance regen rate ×)
//
// NOTE: STAMINA/BALANCE scale REGEN only for now — not the 100 pool. The pool is
// clamped in ~30 places; making it variable safely needs its own audited pass.
// Regen scaling is measurable (sustain pressure / recover clinch stability) and
// touches a single site each, so it can't leak a pool bug into PvP.

const BASELINE_STAT = 4; // stat value that equals the PvP baseline (mod = 1.0)

// Piecewise-linear through (1 → v1), (BASELINE_STAT → v4 = neutral), (10 → v10).
// Two segments so the baseline lands exactly at stat 4 regardless of the floor.
function curve(stat, v1, v4, v10) {
  const s = Math.max(1, Math.min(10, Number(stat) || 1));
  if (s <= BASELINE_STAT) {
    return v1 + (v4 - v1) * ((s - 1) / (BASELINE_STAT - 1));
  }
  return v4 + (v10 - v4) * ((s - BASELINE_STAT) / (10 - BASELINE_STAT));
}

// `stats` = { power, moveSpeed, resistance, stamina, balance } as effective 1..10
// values. Returns the modifier set consumed by the combat code.
function deriveStatMods(stats = {}) {
  return {
    power: curve(stats.power, 0.85, 1.0, 1.3), // outgoing knockback ×
    resistance: curve(stats.resistance, 1.15, 1.0, 0.72), // incoming knockback ×
    moveSpeed: curve(stats.moveSpeed, 0.91, 1.0, 1.18), // walk displacement ×
    staminaRegen: curve(stats.stamina, 0.9, 1.0, 1.25), // stamina regen ×
    balanceRegen: curve(stats.balance, 0.9, 1.0, 1.25), // balance regen ×
  };
}

module.exports = { deriveStatMods, BASELINE_STAT };
