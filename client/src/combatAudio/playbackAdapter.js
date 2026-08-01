/**
 * Resolves cue sampleKey layers against fighterAssets and plays via playBuffer.
 */

import {
  attackSound,
  palmThrustWhiffSound,
  flapSound,
  glassBreakSound,
  isTechingSound,
  slapParrySound,
  slapWhiffSounds,
  pickRandomSound,
  playSound,
} from "../components/fighterAssets.js";

const SAMPLE_MAP = {
  attack: () => attackSound,
  palmThrustWhiff: () => palmThrustWhiffSound,
  flap: () => flapSound,
  glassBreak: () => glassBreakSound,
  isTeching: () => isTechingSound,
  slapParry: () => slapParrySound,
  slapWhiff: () => pickRandomSound(slapWhiffSounds),
};

export function resolveSample(sampleKey) {
  const fn = SAMPLE_MAP[sampleKey];
  return fn ? fn() : null;
}

export function playCueLayers(layers, { pan = 0, pitchVary = 0 } = {}) {
  if (!Array.isArray(layers)) return;
  for (const layer of layers) {
    const sample = resolveSample(layer.sampleKey);
    if (!sample) continue;
    let rate = layer.rate != null ? layer.rate : 1;
    if (pitchVary > 0) {
      rate *= 1 + (Math.random() * 2 - 1) * pitchVary;
    }
    const gain = layer.gain != null ? layer.gain : 0.02;
    const duration =
      layer.durationMs != null && layer.durationMs > 0
        ? layer.durationMs
        : null;
    playSound(sample, gain, duration, rate, pan ?? 0);
  }
}
