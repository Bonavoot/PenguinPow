"use strict";

/**
 * Phase 3 — CommonJS server adapter for authored combat-volume definitions.
 *
 * Source of truth: shared/combatVolumeAuthored.json (static data only).
 *
 * server-io/ ships as the Heroku app root, so nothing above this directory
 * exists at runtime. combatVolumeAuthored.json alongside this file is a
 * byte-identical deploy mirror; test/foundation/authored-catalog-deploy-mirror
 * fails if it ever drifts from shared/.
 *
 * Synchronous require — safe for query paths. No functions in the JSON.
 */

module.exports = require("./combatVolumeAuthored.json");
