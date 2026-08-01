export {
  isCombatAudioFidelityV1Enabled,
} from "./combatAudioFidelityFlags.js";

export {
  CUE,
  CUE_DEFINITIONS,
  CINEMATIC_VARIANT,
  STRIKE_CHORD_MS,
  SWING_STARTUP_MS,
  getCueDefinition,
} from "./cueRegistry.js";

export {
  shouldPredictChargeHoldPose,
  isFreshProvisionalSlapPrediction,
  liveChargeReclassSequence,
  PROVISIONAL_SLAP_SUPERSEDE_MS,
} from "./chargeAudioIntegration.js";

export {
  resolveCinematicVariant,
  shouldPlayCinematicGunCue,
  shouldPlayCinematicChargedLaunchPackage,
  shouldPlayCinematicKillSmokeTrail,
} from "./cinematicAudio.js";

export {
  resolveClinchThrowFailAudio,
  applyClinchThrowFailPresentationAndAudio,
} from "./clinchThrowFailAudio.js";

export {
  createCombatAudioOrchestrator,
  getSharedCombatAudioOrchestrator,
  resetSharedCombatAudioOrchestrator,
} from "./combatAudioOrchestrator.js";

export {
  createStrikeAudioPredictor,
  classifyMouse1Strike,
  facingKeys,
  mintStrikeActionId,
} from "./strikeAudioPrediction.js";

export { playCueLayers, resolveSample } from "./playbackAdapter.js";

export {
  pushAudioTrace,
  dumpAudioTrace,
  summarizeAudioTrace,
  clearAudioTrace,
  installAudioTraceGlobal,
} from "./audioTrace.js";

export {
  ensureCombatAudioRuntime,
  getCombatAudioRuntime,
  combatAudioEnabled,
} from "./runtime.js";
