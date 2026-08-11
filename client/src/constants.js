// Game constants shared between client and server
// These should match the values in server-io/gameUtils.js

// Match server broadcast rate (server-io/constants.js: TICK_RATE=64, BROADCAST_EVERY_N_TICKS=2 → 32 Hz)
// Used for interpolation: time between state updates from server
export const SERVER_BROADCAST_HZ = 32;

// Rope / win line — must match server-io/gameUtils.js (ring-out fires here).
export const MAP_LEFT_BOUNDARY = 340;
export const MAP_RIGHT_BOUNDARY = 935;
// Must match server-io/constants.js SLAP_ROPE_RESIST_BUFFER — non-KO slap/palm
// rest pose. Client hit-pin uses this so a bad packet can't freeze past the map.
export const SLAP_ROPE_RESIST_BUFFER = 12;

export function clampToRopeRest(x) {
  return Math.max(
    MAP_LEFT_BOUNDARY + SLAP_ROPE_RESIST_BUFFER,
    Math.min(x, MAP_RIGHT_BOUNDARY - SLAP_ROPE_RESIST_BUFFER)
  );
}

// Platform fall-off edge (wider than the rope). Past this, fighters drop
// behind the dohyo. Must match server-io/gameUtils.js.
export const DOHYO_LEFT_BOUNDARY = 250;
export const DOHYO_RIGHT_BOUNDARY = 1030;

// Ground level constant - should match the value in GameFighter.jsx
const GROUND_LEVEL = 140;

// How much to lower the player when they're outside the dohyo (in pixels)
export const DOHYO_FALL_DEPTH = 37; // Scaled for camera zoom (was 50)

// Check if player is outside the dohyo boundaries (horizontal or vertical)
// Player is outside if they're past the horizontal boundaries OR if they've fallen below ground level.
// Inclusive on X to match ring-out land checks (landX <= left || landX >= right).
export function isOutsideDohyo(x, y) {
  return (
    x <= DOHYO_LEFT_BOUNDARY ||
    x >= DOHYO_RIGHT_BOUNDARY ||
    y < (GROUND_LEVEL - DOHYO_FALL_DEPTH)
  );
}

/**
 * Off the ice disc — past the rope/win line (MAP) or fallen off the platform.
 * Ring-out / RoundResult losers sit past MAP long before they reach DOHYO fall,
 * so ground FX (ice reflection vs oval) must key off this, not isOutsideDohyo.
 */
export function isOffIce(x, y) {
  return (
    x <= MAP_LEFT_BOUNDARY ||
    x >= MAP_RIGHT_BOUNDARY ||
    y < GROUND_LEVEL - DOHYO_FALL_DEPTH
  );
}
