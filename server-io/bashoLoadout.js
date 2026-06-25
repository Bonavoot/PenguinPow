// ============================================================================
// BASHO ability loadout → server flag mapping (Phase 5)
// ============================================================================
//
// Maps the player's persistent loadout selection (a { category: [optionId,...] }
// map sent from the client) to a compact set of server-side flags consumed by
// the combat code. Like statMods (Phase 4), this object is attached to the
// BASHO match's HUMAN player ONLY (via createInitialPlayerState overrides in
// create_basho_match). PvP, VS CPU, and the BASHO CPU opponent have no
// `loadout`, so every gate reads `player.loadout?.flag` → undefined → falsy and
// behaves EXACTLY as it does today. That's the firewall: a loadout sidegrade
// literally cannot apply to a non-BASHO fighter because the key isn't there.
//
// Phase 5 ships exactly ONE real sidegrade — the spec's canonical example,
// "Flap replaces Raw Parry" (DEFENSE). The flap mechanic already exists and is
// gated everywhere on `activePowerUp === FLAP`; this flag simply ORs a
// loadout-driven route into those same gates without ever touching the
// power-up/draft system. New options append to this mapping as they're
// designed (spec §8.2) — one flag per behavioral hook.

// `selected` = { attack: [], defense: ["flap"], movement: [], ... }
// Returns the flag set read by the combat sites. Tolerant of a missing/oddly
// shaped argument so a corrupt save can never throw here.
function deriveLoadout(selected = {}) {
  const defense = Array.isArray(selected && selected.defense)
    ? selected.defense
    : [];
  return {
    // DEFENSE sidegrade: swap the raw-parry-on-Space for the flight liftoff.
    flapReplacesParry: defense.includes("flap"),
  };
}

module.exports = { deriveLoadout };
