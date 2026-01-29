// Game constants shared between client and server
// These should match the values in server-io/gameUtils.js

export const MAP_LEFT_BOUNDARY = 120;
export const MAP_RIGHT_BOUNDARY = 945;

// Dohyo (ring) boundaries - players fall when outside these
// Adjust these values to match the visual dohyo boundaries in the image
export const DOHYO_LEFT_BOUNDARY = 0;
export const DOHYO_RIGHT_BOUNDARY = 1055;

// Check if player is outside the dohyo boundaries (horizontal only)
export function isOutsideDohyo(x, y) {
  return (
    x < DOHYO_LEFT_BOUNDARY ||
    x > DOHYO_RIGHT_BOUNDARY
  );
}

// How much to lower the player when they're outside the dohyo (in pixels)
export const DOHYO_FALL_DEPTH = 50; // Simulates falling 3 feet down
