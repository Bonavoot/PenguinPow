/**
 * Resolves cue sampleKey layers against fighterAssets and plays via playBuffer.
 * Returns playback handles so the orchestrator can truly stop stolen voices.
 */

import {
  attackSound,
  palmThrustWhiffSound,
  flapSound,
  dodgeSound,
  glassBreakSound,
  isTechingSound,
  slapParrySound,
  slapWhiffSounds,
  rawParrySuccessSound,
  pickRandomSound,
  playSound,
} from "../components/fighterAssets.js";

const SAMPLE_MAP = {
  attack: () => attackSound,
  palmThrustWhiff: () => palmThrustWhiffSound,
  flap: () => flapSound,
  dodge: () => dodgeSound,
  glassBreak: () => glassBreakSound,
  isTeching: () => isTechingSound,
  slapParry: () => slapParrySound,
  slapWhiff: () => pickRandomSound(slapWhiffSounds),
  rawParrySuccess: () => rawParrySuccessSound,
};

export function resolveSample(sampleKey) {
  const fn = SAMPLE_MAP[sampleKey];
  return fn ? fn() : null;
}

function stopHandle(handle, fadeMs = 30) {
  if (!handle) return;
  if (typeof handle.stop === "function" && !handle.source) {
    try {
      handle.stop();
    } catch {
      /* pending loop */
    }
    return;
  }
  const source = handle.source;
  const gainNode = handle.gainNode;
  if (!source) return;
  try {
    if (gainNode && fadeMs > 0 && gainNode.context) {
      const ctx = gainNode.context;
      const now = ctx.currentTime;
      const cur = gainNode.gain.value;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(cur, now);
      gainNode.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      setTimeout(() => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      }, fadeMs + 10);
    } else {
      source.stop();
    }
  } catch {
    /* already stopped */
  }
}

/**
 * @returns {{ handles: object[], stopAll: Function }}
 */
export function playCueLayers(layers, { pan = 0, pitchVary = 0 } = {}) {
  const handles = [];
  if (!Array.isArray(layers)) {
    return { handles, stopAll: () => {} };
  }
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
    const h = playSound(sample, gain, duration, rate, pan ?? 0);
    if (h) handles.push(h);
  }
  return {
    handles,
    stopAll: (fadeMs = 30) => {
      for (const h of handles) stopHandle(h, fadeMs);
    },
  };
}

export { stopHandle };
