"use strict";

/**
 * Phase 4A/4B — authored target hurt regions (default OFF).
 *
 * When OFF / unset: exact legacy tip-meets-body contact only.
 * When ON: opponent strikes may also confirm against the victim's authored
 * HURT_LIMB during approved exposure — Phase 4A slap active + recovery, and
 * Phase 4B palm active + the palm's held recovery pose. Offensive HIT remains
 * the existing authored rail; this flag only adds a victim surface.
 *
 * Phase 4B ships under this SAME gate (no second flag): the palm surfaces are
 * the same authored-limb system, so one switch keeps rollback exact.
 *
 * Enable:
 *   AUTHORED_SLAP_HURTBOX_V1=1 npm run dev:web
 * Rollback / unset:
 *   unset AUTHORED_SLAP_HURTBOX_V1
 *   AUTHORED_SLAP_HURTBOX_V1=0
 */

function parseAuthoredSlapHurtboxFlag(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return false;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  console.warn(
    `[authoredSlapHurtbox] unrecognized AUTHORED_SLAP_HURTBOX_V1=${JSON.stringify(
      String(raw)
    )}; defaulting OFF`
  );
  return false;
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
