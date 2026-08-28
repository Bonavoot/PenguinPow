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
// Flap is a Movement sidegrade: slide-jump takeoffs grant air-flap charges.
// It does NOT touch parry. Legacy saves may still store `flap` under defense —
// both categories are accepted here so old careers keep working.

// `selected` = { attack: [], defense: [], movement: ["flap"], ... }
// Returns the flag set read by the combat sites. Tolerant of a missing/oddly
// shaped argument so a corrupt save can never throw here.
function deriveLoadout(selected = {}) {
  const attack = Array.isArray(selected && selected.attack)
    ? selected.attack
    : [];
  const defense = Array.isArray(selected && selected.defense)
    ? selected.defense
    : [];
  const movement = Array.isArray(selected && selected.movement)
    ? selected.movement
    : [];
  const grappling = Array.isArray(selected && selected.grappling)
    ? selected.grappling
    : [];
  return {
    // ATTACK sidegrade: palm thrust always stuffs a live grab (anti-grab meaty).
    palmBreaksGrabArmor: attack.includes("shattering_palm"),
    // MOVEMENT sidegrade: slide-jump takeoffs grant FLAP air charges.
    // Also accepts legacy defense-slot saves that still list "flap".
    hasFlap: movement.includes("flap") || defense.includes("flap"),
    // GRAPPLING sidegrade: Thick Blubber — absorb one strike that would have
    // stuffed the grab (refreshed every grab attempt). Grabs-only; does not
    // protect palm thrust or charged attacks. A late slap after the grip is
    // on already loses without this perk.
    thickBlubberGrabs: grappling.includes("thick_blubber"),
  };
}

module.exports = { deriveLoadout };
