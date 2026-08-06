/**
 * Semantic combat-cue registry.
 * Gameplay code requests cue names; asset/layer choices live here.
 */

/** Matches server-io/inputCommandReliability.js PALM_DIR_CHORD_MS */
export const STRIKE_CHORD_MS = 50;

export const SWING_STARTUP_MS = Object.freeze({
  slap: 55,
  /** MUST match server-io/constants.js PALM_THRUST_STARTUP_MS */
  palm: 90,
  lowKick: 95,
  /** Hitbox startup only — NOT the charged lunge whoosh seam. */
  charged: 150,
});

export const CUE = Object.freeze({
  SLAP_WHIFF: "SLAP_WHIFF",
  PALM_WHIFF: "PALM_WHIFF",
  /** Whoosh when charged forward locomotion begins (not hold, not hitbox active). */
  CHARGED_LUNGE_BEGIN: "CHARGED_LUNGE_BEGIN",
  /** @deprecated alias — maps to CHARGED_LUNGE_BEGIN definition */
  CHARGED_ATTACK_RELEASE: "CHARGED_LUNGE_BEGIN",
  CLINCH_THROW_RESISTED: "CLINCH_THROW_RESISTED",
  CLINCH_PERFECT_BRACE: "CLINCH_PERFECT_BRACE",
  ROPE_JUMP_LAUNCH: "ROPE_JUMP_LAUNCH",
  SLIDE_JUMP_LAUNCH: "SLIDE_JUMP_LAUNCH",
  SLIDE_REDIRECT: "SLIDE_REDIRECT",
  MATADOR_BREAK: "MATADOR_BREAK",
  SLAP_PARRY: "SLAP_PARRY",
});

export const CINEMATIC_VARIANT = Object.freeze({
  DEMOLISHED_CHARGED: "demolished_charged",
  // MATADOR success kill (belly-slide) — camera/darken only.
  // NOT Matador Break (isGored strike-beats-matador hit callout).
  MATADOR_KILL: "matador_kill",
  /** @deprecated legacy misnomer — resolveCinematicVariant maps to MATADOR_KILL */
  MATADOR_BREAK: "matador_break",
  AP_PULL: "ap_pull",
});

/**
 * sampleKey values are resolved by the playback adapter against fighterAssets.
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
  [CUE.CHARGED_LUNGE_BEGIN]: {
    label: "Charged lunge begin whoosh",
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
    // Match proven grab-tech path gain (playSound(isTechingSound, 0.04)).
    layers: [{ sampleKey: "isTeching", gain: 0.04, rate: 1.0 }],
    pitchVary: 0.02,
    minIntervalMs: 80,
    maxVoices: 2,
    voiceSteal: "none",
    cancelable: false,
    authority: "authoritative",
    priority: 70,
  },
  [CUE.CLINCH_PERFECT_BRACE]: {
    label: "Clinch Perfect Brace",
    // Tech base + quiet perfect-parry accent — more prestigious than RESISTED.
    layers: [
      { sampleKey: "isTeching", gain: 0.04, rate: 1.02 },
      { sampleKey: "rawParrySuccess", gain: 0.018, rate: 1.08 },
    ],
    pitchVary: 0.02,
    minIntervalMs: 80,
    maxVoices: 2,
    voiceSteal: "none",
    cancelable: false,
    authority: "authoritative",
    priority: 75,
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
    // Same Dodge vocabulary at dodge gain; one voice/actor with real steal.
    layers: [{ sampleKey: "dodge", gain: 0.02, rate: 1.0 }],
    pitchVary: 0,
    minIntervalMs: 40,
    maxVoices: 1,
    voiceSteal: "oldest",
    cancelable: false,
    authority: "authoritative",
    priority: 30,
  },
  [CUE.MATADOR_BREAK]: {
    label: "Matador Break shatter",
    // Original glass-break sample at natural rate — not a pitched "shatter palm"
    // alternate (armor-break uses the same file @ 1.0 / 0.05).
    layers: [{ sampleKey: "glassBreak", gain: 0.05, rate: 1.0 }],
    pitchVary: 0,
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
  if (cueName === "CHARGED_ATTACK_RELEASE") {
    return CUE_DEFINITIONS[CUE.CHARGED_LUNGE_BEGIN] || null;
  }
  return CUE_DEFINITIONS[cueName] || null;
}
