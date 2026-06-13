// Shared shake noise — used by BOTH screen-shake systems (useCamera hit shake
// and GameFighter event shake) so the whole game shakes with one cohesive,
// organic motion instead of two different jitters.
//
// White noise (a fresh Math.random() per frame) teleports the frame every tick
// and reads as a cheap high-frequency buzz whose texture also changes with
// refresh rate. Smooth 1D value noise instead interpolates between hashed
// integer steps, so sampling it over wall-clock time yields a continuous arc at
// a fixed Hz — frame-rate independent and weighty.

// Deterministic 0–1 hash for a given integer step.
function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smooth 1D value noise in [-1, 1] with a smoothstep interpolation curve.
export function valueNoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}
