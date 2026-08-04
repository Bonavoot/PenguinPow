/**
 * Phase 3 — Vite/ESM client adapter for authored combat-volume JSON.
 *
 * Vite natively transforms JSON imports into ESM default exports.
 * Binding happens at module evaluation so CombatFidelityDebug can call
 * derive helpers synchronously. Bare Node unit tests must NOT import this
 * file — they inject the catalog via bindAuthoredCatalog(createRequire(...)).
 */

import catalog from "../../../shared/combatVolumeAuthored.json";
import { bindAuthoredCatalog } from "./combatVolumeAuthoredClient";

bindAuthoredCatalog(catalog);

export { catalog };
