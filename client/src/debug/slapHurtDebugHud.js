/**
 * Phase 4A — temporally honest slap-hurt diagnostics for CombatFidelityDebug.
 * Observation only. Never authors hits.
 */

import { resolveClientAuthoredPoseKey } from "./combatVolumeAuthoredClient";

/** localStorage twin for HUD — must match server AUTHORED_SLAP_HURTBOX_V1 for playtest. */
export const AUTHORED_SLAP_HURTBOX_HUD_KEY = "pumo_authored_slap_hurtbox_v1";

/** Last committed contact is labeled EXPIRED after this wall age (ms). */
export const LAST_COMMITTED_FRESH_MS = 700;

const SLAP_STARTUP_MS = 55;

export function readAuthoredSlapHurtboxHudFlag() {
  try {
    const v = localStorage.getItem(AUTHORED_SLAP_HURTBOX_HUD_KEY);
    if (v === "1" || v === "true" || v === "on") return "ON";
    if (v === "0" || v === "false" || v === "off") return "OFF";
  } catch {
    /* ignore */
  }
  return "UNKNOWN";
}

/**
 * Infer current slap victim phase from wire/local fields + authored pose helper.
 * When attackStartTime + slapActiveEndTime + _overlaySimTime are present, clocks win.
 */
export function inferCurrentSlapVictimDebug(fighter) {
  if (!fighter) {
    return {
      phase: "neutral",
      exposed: false,
      poseKey: null,
      mirror: null,
      reason: "no_fighter",
    };
  }

  const mirror =
    fighter.slapFacingDirection === 1 || fighter.slapFacingDirection === -1
      ? fighter.slapFacingDirection
      : fighter.facing === 1 || fighter.facing === -1
        ? fighter.facing
        : null;

  const slapFamily = !!(
    fighter.isSlapAttack ||
    (fighter.isAttacking && fighter.attackType === "slap") ||
    (fighter.isRecovering && fighter.currentAction === "slap")
  );
  if (!slapFamily) {
    return {
      phase: "neutral",
      exposed: false,
      poseKey: "neutral",
      mirror,
      reason: "not_slap_family",
    };
  }

  let phase = null;
  let reason = "inferred";

  if (
    typeof fighter.attackStartTime === "number" &&
    typeof fighter.slapActiveEndTime === "number" &&
    typeof fighter._overlaySimTime === "number"
  ) {
    const t = fighter._overlaySimTime;
    const start = fighter.attackStartTime;
    const activeEnd = fighter.slapActiveEndTime;
    if (fighter.isInStartupFrames === true || t - start < SLAP_STARTUP_MS) {
      phase = "startup";
      reason = "clock_startup";
    } else if (t < activeEnd) {
      phase = "active";
      reason = "clock_active";
    } else if (fighter.isSlapAttack || fighter.isAttacking) {
      phase = "recovery";
      reason = "clock_recovery";
    } else {
      phase = "neutral";
      reason = "clock_cleared";
    }
  } else if (fighter.isInStartupFrames === true) {
    phase = "startup";
    reason = "isInStartupFrames";
  } else {
    const authored = resolveClientAuthoredPoseKey(fighter);
    if (authored.poseKey === "slap_startup") {
      phase = "startup";
      reason = "authored_pose";
    } else if (authored.poseKey === "slap_active") {
      phase = "active";
      reason = "authored_pose";
    } else if (authored.poseKey === "slap_recovery") {
      phase = "recovery";
      reason = "authored_pose";
    } else if (fighter.isSlapAttack && fighter.isAttacking) {
      phase = "active|recovery";
      reason = "wire_ambiguous_no_clocks";
    } else {
      phase = "unsupported";
      reason = authored.poseKey || "unsupported";
    }
  }

  const exposed = phase === "active" || phase === "recovery";
  const poseKey =
    phase === "startup"
      ? "slap_startup"
      : phase === "active"
        ? "slap_active"
        : phase === "recovery"
          ? "slap_recovery"
          : phase === "active|recovery"
            ? "slap_active|slap_recovery"
            : phase === "neutral"
              ? "neutral"
              : null;

  return { phase, exposed, poseKey, mirror, reason };
}

/**
 * Local CURRENT QUERY summary for the fidelity HUD.
 * Server accept/reject authority stays in noteSlapHurtQuery (tests); this line
 * must never look like LAST COMMITTED. Prefer an optional lastServerQuery stamp.
 */
export function inferCurrentAttackQueryDebug(p1, p2, lastServerQuery) {
  if (
    lastServerQuery &&
    typeof lastServerQuery.ageMs === "number" &&
    lastServerQuery.ageMs <= LAST_COMMITTED_FRESH_MS
  ) {
    const q = lastServerQuery;
    return {
      source: "server",
      line: `CURRENT QUERY src=server life=${q.attackerPhase || "—"} type=${
        q.attackType || "—"
      } tip=${q.tipX != null ? Math.round(q.tipX) : "—"} region=${
        q.candidateRegion || "—"
      } exposed=${q.limbExposed ? "Y" : "N"} overlap=${
        q.overlap ? "Y" : "N"
      } ${q.accepted ? "accepted" : "rejected"} reason=${
        q.rejectReason || "—"
      }`,
    };
  }

  const pick = () => {
    if (p1?.isAttacking && p1.isInStartupFrames) return { atk: p1, vic: p2, label: "P1" };
    if (p2?.isAttacking && p2.isInStartupFrames) return { atk: p2, vic: p1, label: "P2" };
    if (p1?.isAttacking) return { atk: p1, vic: p2, label: "P1" };
    if (p2?.isAttacking) return { atk: p2, vic: p1, label: "P2" };
    return null;
  };
  const pair = pick();
  if (!pair) {
    return {
      source: "local",
      line: "CURRENT QUERY: — (no active attacker; not LAST COMMITTED)",
    };
  }
  const { atk, vic, label } = pair;
  const atkType = atk.isPalmThrust
    ? "palm"
    : atk.attackType || (atk.isSlapAttack ? "slap" : "—");
  const atkPhase = atk.isInStartupFrames
    ? "startup"
    : atk.isAttacking
      ? "active"
      : "neutral";
  const vicDbg = inferCurrentSlapVictimDebug(vic);
  // Local HUD must NEVER invent server interruption causes. Startup is pending.
  const reason =
    atkPhase === "startup"
      ? "startup-pending"
      : vicDbg.exposed
        ? "local_observe_only_no_server_query"
        : "local_observe_victim_not_exposed";
  return {
    source: "local",
    line: `CURRENT QUERY src=local(observe) atk=${label} life=${atkPhase} type=${atkType} tip=— region=${
      vicDbg.exposed ? "frontArm?" : "—"
    } exposed=${vicDbg.exposed ? "Y" : "N"} overlap=? pending reason=${reason}`,
  };
}

export function formatSlapHurtHudLines({
  p1,
  p2,
  lastCommitted,
  nowMs,
  flagHud,
  lastServerQuery,
}) {
  const flag = flagHud || readAuthoredSlapHurtboxHudFlag();
  const c1 = inferCurrentSlapVictimDebug(p1);
  const c2 = inferCurrentSlapVictimDebug(p2);

  const cur = (label, c, p) =>
    `${label} phase=${c.phase} exposed=${c.exposed ? "Y" : "N"} pose=${
      c.poseKey || "—"
    } face=${c.mirror ?? "—"} why=${c.reason} atk=${
      p?.isAttacking ? p.attackType || "Y" : "—"
    }`;

  let lastLine = "LAST COMMITTED: —";
  if (lastCommitted && lastCommitted.t != null) {
    const age = Math.max(0, Math.round(nowMs - lastCommitted.t));
    const expired = age > LAST_COMMITTED_FRESH_MS;
    lastLine = `LAST COMMITTED${expired ? " EXPIRED" : ""} age=${age}ms region=${
      lastCommitted.victimHurtRegion || "—"
    } kind=${lastCommitted.victimHurtKind || "—"} vPhase=${
      lastCommitted.victimSlapPhase || "—"
    } pose=${lastCommitted.victimSlapPoseKey || "—"} punish=${
      lastCommitted.isPunish ? "Y" : "N"
    } auth=${lastCommitted.authoredSlapHurtboxV1 ? "limb" : "body/legacy"}`;
  }

  const query = inferCurrentAttackQueryDebug(
    p1,
    p2,
    lastServerQuery
      ? {
          ...lastServerQuery,
          ageMs:
            lastServerQuery.t != null
              ? Math.max(0, nowMs - lastServerQuery.t)
              : LAST_COMMITTED_FRESH_MS + 1,
        }
      : null
  );

  // Honesty: localStorage never proves server authority.
  // CONFIRMED_ON only after a server-stamped limb contact on the wire.
  let serverAuthority = "UNKNOWN";
  if (lastCommitted && lastCommitted.authoredSlapHurtboxV1 === true) {
    serverAuthority = "CONFIRMED_ON";
  } else if (
    lastCommitted &&
    lastCommitted.authoredSlapHurtboxV1 === false &&
    lastCommitted.victimHurtRegion
  ) {
    // Body/legacy stamp — does not prove the server flag is OFF.
    serverAuthority = "UNKNOWN";
  }
  const clientExpect =
    flag === "ON" || flag === "OFF" || flag === "UNKNOWN" ? flag : "UNKNOWN";
  const flagLine =
    `SERVER AUTHORITY=${serverAuthority}` +
    ` · CLIENT HUD EXPECT=${clientExpect}` +
    ` (localStorage ${AUTHORED_SLAP_HURTBOX_HUD_KEY}; not server proof)` +
    (serverAuthority === "CONFIRMED_ON"
      ? " · limb stamp on last commit"
      : " · prove ON via server console [authoredSlapHurtbox]");

  return {
    flagLine,
    currentLine: `CURRENT ${cur("P1", c1, p1)} · ${cur("P2", c2, p2)}`,
    queryLine: query.line,
    lastLine,
    c1,
    c2,
    serverAuthority,
    clientExpect,
  };
}
