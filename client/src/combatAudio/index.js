export {
  isCombatAudioFidelityV1Enabled,
} from "./combatAudioFidelityFlags.js";

export {
  CUE,
  CUE_DEFINITIONS,
  STRIKE_CHORD_MS,
  SWING_STARTUP_MS,
  getCueDefinition,
} from "./cueRegistry.js";

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
