/**
 * Live-client combat-audio runtime (shared across GameFighter instances).
 */

import { isCombatAudioFidelityV1Enabled } from "./combatAudioFidelityFlags.js";
import {
  createCombatAudioOrchestrator,
  getSharedCombatAudioOrchestrator,
  resetSharedCombatAudioOrchestrator,
} from "./combatAudioOrchestrator.js";
import { playCueLayers } from "./playbackAdapter.js";
import { createStrikeAudioPredictor } from "./strikeAudioPrediction.js";
import { installAudioTraceGlobal } from "./audioTrace.js";

let predictor = null;
let bootstrapped = false;

export function ensureCombatAudioRuntime() {
  if (bootstrapped) {
    return {
      enabled: isCombatAudioFidelityV1Enabled(),
      orch: getSharedCombatAudioOrchestrator(),
      predictor,
    };
  }
  bootstrapped = true;
  installAudioTraceGlobal();
  const enabled = isCombatAudioFidelityV1Enabled();
  const orch = resetSharedCombatAudioOrchestrator({
    enabled: true, // orchestrator always constructed; callers gate player-facing use
    playLayers: playCueLayers,
  });
  predictor = createStrikeAudioPredictor({
    orchestrator: orch,
    actorId: "local",
  });
  return { enabled, orch, predictor };
}

export function getCombatAudioRuntime() {
  return ensureCombatAudioRuntime();
}

export function combatAudioEnabled() {
  return isCombatAudioFidelityV1Enabled();
}

export { createCombatAudioOrchestrator };
