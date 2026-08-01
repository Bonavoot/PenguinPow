/**
 * Semantic combat-cue registry.
 * Gameplay code requests cue names; asset/layer choices live here.
 *
 * Placeholder mappings use existing library samples — tunable for playtest.
 * Durations in ms when cropping long assets for short cues.
 */

/** Matches server-io/inputCommandReliability.js PALM_DIR_CHORD_MS */
export const STRIKE_CHORD_MS = 50;

export const SWING_STARTUP_MS = Object.freeze({
  slap: 55,
  palm: 90,
  lowKick: 95,
  charged: 150,
});

export const CUE = Object.freeze({
  SLAP_WHIFF: "SLAP_WHIFF",
  PALM_WHIFF: "PALM_WHIFF",
  CHARGED_ATTACK_RELEASE: "CHARGED_ATTACK_RELEASE",
  CLINCH_THROW_RESISTED: "CLINCH_THROW_RESISTED",
  ROPE_JUMP_LAUNCH: "ROPE_JUMP_LAUNCH",
  SLIDE_JUMP_LAUNCH: "SLIDE_JUMP_LAUNCH",
  SLIDE_REDIRECT: "SLIDE_REDIRECT",
  MATADOR_BREAK: "MATADOR_BREAK",
  SLAP_PARRY: "SLAP_PARRY",
});

/**
 * sampleKey values are resolved by the playback adapter against fighterAssets.
 * Keeping keys (not URLs) here keeps the registry free of bundler imports.
 */
export const CUE_DEFINITIONS = Object.freeze({
  [CUE.SLAP_WHIFF]: {
    label: "Slap whiff",
    layers: [{ sampleKey: "slapWhiff", gain: 0.02, rate: 1.0 }],
    pitchVary: 0.04,
    minIntervalMs: 0,
    maxVoices: 4,
    voiceSteal: "none",
    cancelable: true,
    authority: "reconcilable",
    priority: 40,
  },
  [CUE.PALM_WHIFF]: {
    label: "Palm thrust whiff",
    layers: [{ sampleKey: "palmThrustWhiff", gain: 0.05, rate: 1.0 }],
    pitchVary: 0,
    minIntervalMs: 0,
    maxVoices: 3,
    voiceSteal: "none",
    cancelable: true,
    authority: "reconcilable",
    priority: 40,
  },
  [CUE.CHARGED_ATTACK_RELEASE]: {
    label: "Charged attack release swoosh",
    layers: [{ sampleKey: "attack", gain: 0.05, rate: 1.0 }],
    pitchVary: 0,
    minIntervalMs: 80,
    maxVoices: 2,
    voiceSteal: "oldest",
    cancelable: true,
    authority: "reconcilable",
    priority: 50,
  },
  [CUE.CLINCH_THROW_RESISTED]: {
    label: "Clinch throw RESISTED",
    // Existing grab-tech / is-teching placeholder — moderate gain, once per outcome.
    layers: [{ sampleKey: "isTeching", gain: 0.035, rate: 1.0 }],
    pitchVary: 0.03,
    minIntervalMs: 120,
    maxVoices: 2,
    voiceSteal: "none",
    cancelable: false,
    authority: "authoritative",
    priority: 70,
  },
  [CUE.ROPE_JUMP_LAUNCH]: {
    label: "Rope Jump liftoff",
    layers: [
      { sampleKey: "flap", gain: 0.018, rate: 1.05 },
      { sampleKey: "attack", gain: 0.012, rate: 1.15, durationMs: 120 },
    ],
    pitchVary: 0.04,
    minIntervalMs: 100,
    maxVoices: 2,
    voiceSteal: "oldest",
    cancelable: false,
    authority: "authoritative",
    priority: 35,
  },
  [CUE.SLIDE_JUMP_LAUNCH]: {
    label: "Slide Jump liftoff",
    layers: [
      { sampleKey: "flap", gain: 0.016, rate: 0.92 },
      { sampleKey: "attack", gain: 0.01, rate: 1.25, durationMs: 100 },
    ],
    pitchVary: 0.04,
    minIntervalMs: 100,
    maxVoices: 2,
    voiceSteal: "oldest",
    cancelable: false,
    authority: "authoritative",
    priority: 35,
  },
  [CUE.SLIDE_REDIRECT]: {
    label: "Ice Slide redirect",
    // Short transient only — full dodge (~1s) would muddy at ~160ms cadence.
    layers: [{ sampleKey: "flap", gain: 0.014, rate: 1.35, durationMs: 70 }],
    pitchVary: 0.05,
    minIntervalMs: 40,
    maxVoices: 2,
    voiceSteal: "oldest",
    cancelable: false,
    authority: "authoritative",
    priority: 30,
  },
  [CUE.MATADOR_BREAK]: {
    label: "Matador Break shatter",
    // Cropped glass accent — shorter/quieter than full grab-armor break.
    layers: [{ sampleKey: "glassBreak", gain: 0.028, rate: 1.12, durationMs: 420 }],
    pitchVary: 0.02,
    minIntervalMs: 200,
    maxVoices: 1,
    voiceSteal: "reject",
    cancelable: false,
    authority: "authoritative",
    priority: 80,
  },
  [CUE.SLAP_PARRY]: {
    label: "Slap parry",
    layers: [{ sampleKey: "slapParry", gain: 0.01, rate: 1.0 }],
    pitchVary: 0,
    minIntervalMs: 40,
    maxVoices: 2,
    voiceSteal: "oldest",
    cancelable: false,
    authority: "authoritative",
    priority: 60,
  },
});

export function getCueDefinition(cueName) {
  return CUE_DEFINITIONS[cueName] || null;
}
