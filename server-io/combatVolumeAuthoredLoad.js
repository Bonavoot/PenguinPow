"use strict";

/**
 * Phase 3 — CommonJS server adapter for authored combat-volume definitions.
 *
 * Source of truth: ../shared/combatVolumeAuthored.json (static data only).
 * Synchronous require — safe for query paths. No functions in the JSON.
 */

module.exports = require("../shared/combatVolumeAuthored.json");
