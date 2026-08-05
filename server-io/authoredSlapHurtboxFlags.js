"use strict";

/**
 * Phase 4A/4B/4C — authored target hurt regions (Phase 4C: default ON).
 *
 * When ON / unset: opponent strikes may also confirm against the victim's
 * authored HURT_LIMB during approved exposure — Phase 4A slap active +
 * recovery, and Phase 4B palm active + the palm's held recovery pose.
 * Offensive HIT remains the existing authored rail; this flag only adds a
 * victim surface.
 *
 * When explicitly OFF: exact legacy tip-meets-body contact only.
 *
 * Phase 4B shipped under this SAME gate (no second flag) and Phase 4C
 * graduates that one gate to default ON, so a single switch still gives an
 * exact rollback. The name is kept for compatibility even though it now
 * governs both the slap and palm surfaces.
 *
 * Ordinary development (no env var needed):
 *   npm run dev:web
 * Exact legacy rollback:
 *   AUTHORED_SLAP_HURTBOX_V1=0 npm run dev:web
 *   (`false`, `off` and `no` are equivalent; case and surrounding whitespace
 *    are ignored, matching the project's other env-flag parsers.)
 */

/** Only these exact spellings turn the graduated feature back off. */
const OFF_VALUES = new Set(["0", "false", "off", "no"]);
const ON_VALUES = new Set(["1", "true", "on", "yes"]);

function parseAuthoredSlapHurtboxFlag(raw) {
  // Phase 4C: unset / empty is the shipped default, which is now ON.
  if (raw === undefined || raw === null || raw === "") {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (OFF_VALUES.has(v)) return false;
  if (ON_VALUES.has(v)) return true;
  // A typo must not silently hand one machine legacy combat while every other
  // machine runs the graduated default — rollback has to be deliberate.
  console.warn(
    `[authoredSlapHurtbox] unrecognized AUTHORED_SLAP_HURTBOX_V1=${JSON.stringify(
      String(raw)
    )}; using default ON (explicit 0/false/off/no is the legacy rollback)`
  );
  return true;
}

const AUTHORED_SLAP_HURTBOX_V1 = parseAuthoredSlapHurtboxFlag(
  typeof process !== "undefined" && process.env
    ? process.env.AUTHORED_SLAP_HURTBOX_V1
    : undefined
);

let _override = null;

function setAuthoredSlapHurtboxForTests(value) {
  _override = value == null ? null : !!value;
}

function isAuthoredSlapHurtboxV1Enabled(envValue) {
  if (envValue !== undefined) {
    return parseAuthoredSlapHurtboxFlag(envValue);
  }
  if (_override != null) return _override;
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.AUTHORED_SLAP_HURTBOX_V1
      : undefined;
  if (raw !== undefined && raw !== null && raw !== "") {
    return parseAuthoredSlapHurtboxFlag(raw);
  }
  return AUTHORED_SLAP_HURTBOX_V1;
}

/**
 * One-shot development/server-startup diagnostic. Not networked.
 * Reports flag parse, allowlisted poses, and catalog fingerprint.
 */
function logAuthoredSlapHurtboxStartupDiagnostic(opts = {}) {
  const enabled = isAuthoredSlapHurtboxV1Enabled();
  let allowlist = ["slap_active", "slap_recovery"];
  let catalogFp = "n/a";
  try {
    const {
      EXPOSED_LIMB_POSES,
      isAuthoredLimbPoseAuthorityReady,
    } = require("./authoredSlapHurtTarget");
    allowlist = Object.keys(EXPOSED_LIMB_POSES || {}).filter((k) =>
      isAuthoredLimbPoseAuthorityReady(k)
    );
  } catch {
    /* allowlist module may be mid-load in odd test graphs */
  }
  try {
    const crypto = require("crypto");
    const fs = require("fs");
    const path = require("path");
    const catalogPath = path.join(
      __dirname,
      "../shared/combatVolumeAuthored.json"
    );
    catalogFp = crypto
      .createHash("sha256")
      .update(fs.readFileSync(catalogPath))
      .digest("hex")
      .slice(0, 16);
  } catch {
    catalogFp = "unavailable";
  }
  const portPart =
    opts.port != null ? ` port=${opts.port}` : opts.extra ? ` ${opts.extra}` : "";
  const line =
    `[authoredSlapHurtbox] AUTHORED_SLAP_HURTBOX_V1=${enabled ? "ON" : "OFF"}` +
    ` allowlist=[${allowlist.join(",")}]` +
    ` catalogFp=${catalogFp}` +
    portPart;
  console.log(line);
  return { enabled, allowlist, catalogFp, line };
}

module.exports = {
  AUTHORED_SLAP_HURTBOX_V1,
  parseAuthoredSlapHurtboxFlag,
  isAuthoredSlapHurtboxV1Enabled,
  setAuthoredSlapHurtboxForTests,
  logAuthoredSlapHurtboxStartupDiagnostic,
};
