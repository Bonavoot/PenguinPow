// Game constants shared between client and server
// These should match the values in server-io/gameUtils.js

// Match server broadcast rate (server-io/constants.js BROADCAST_EVERY_N_TICKS)
// Used for interpolation: time between state updates from server
export const SERVER_BROADCAST_HZ = 64;

export const MAP_LEFT_BOUNDARY = 80;
export const MAP_RIGHT_BOUNDARY = 982;

// Dohyo (ring) boundaries - players fall when outside these
// Adjust these values to match the visual dohyo boundaries in the image
export const DOHYO_LEFT_BOUNDARY = -40;
export const DOHYO_RIGHT_BOUNDARY = 1092;

// Ground level constant - should match the value in GameFighter.jsx
const GROUND_LEVEL = 120;

// How much to lower the player when they're outside the dohyo (in pixels)
export const DOHYO_FALL_DEPTH = 50; // Simulates falling 3 feet down

// Check if player is outside the dohyo boundaries (horizontal or vertical)
// Player is outside if they're past the horizontal boundaries OR if they've fallen below ground level
export function isOutsideDohyo(x, y) {
  return (
    x < DOHYO_LEFT_BOUNDARY ||
    x > DOHYO_RIGHT_BOUNDARY ||
    y < (GROUND_LEVEL - DOHYO_FALL_DEPTH)
  );
}
