/**
 * Phase 1 — client-side diagnostic combat volumes for CombatFidelityDebug.
 *
 * Derives shapes locally from fighter flags + optional pose-director phase hints.
 * Does NOT receive geometry over the network. Does NOT affect gameplay.
 *
 * HIT-phase policy (Phase 1 completion):
 *   - Exact HIT only when strike phase is known active (director hint or
 *     authoritative startup flag cleared with no recovery markers).
 *   - Recovery never shows an offensive HIT volume.
 *   - When phase is uncertain (typical remote wire: isAttacking/isSlapAttack
 *     without attackStartTime), HIT is omitted — not approximated as truth.
 *   - Exact remote active/startup/recovery needs a future phase payload
 *     (attackStartTime or compact strikePhase) before HIT can be exact for both
 *     slots; that belongs to Phase 2/3, not a production delta in this pass.
 */

export const COMBAT_VOLUME_KIND = Object.freeze({
  PUSH: "PUSH",
  HURT_BODY: "HURT_BODY",
  HURT_LIMB: "HURT_LIMB",
  HIT: "HIT",
  GRAB: "GRAB",
  LANDING: "LANDING",
});

export const COMBAT_VOLUME_DEBUG_COLOR = Object.freeze({
  PUSH: "#2196f3",
  HURT_BODY: "#4caf50",
  HURT_LIMB: "#a5d6a7",
  HIT: "#f44336",
  GRAB: "#ffeb3b",
  LANDING: "#00bcd4",
});

/** Strike phase classification for debug volumes. */
export const STRIKE_DEBUG_PHASE = Object.freeze({
  NEUTRAL: "neutral",
  STARTUP: "startup",
  ACTIVE: "active",
  RECOVERY: "recovery",
  UNCERTAIN: "uncertain",
});

/**
 * Per-slot pose-director phase hints written by GameFighter render
 * (dev/debug only). Allows the P1-owned overlay to read P2's local frames.
 * Cleared to null when that slot is not in a slap/palm director cycle.
 */
const localStrikePhaseHints = Object.create(null);

/** @param {"player 1"|"player 2"} fighterKey @param {"startup"|"active"|"recovery"|null} hint */
export function noteLocalStrikePhaseHint(fighterKey, hint) {
  if (fighterKey !== "player 1" && fighterKey !== "player 2") return;
  localStrikePhaseHints[fighterKey] =
    hint === "startup" || hint === "active" || hint === "recovery" ? hint : null;
}

export function getLocalStrikePhaseHint(fighterKey) {
  return localStrikePhaseHints[fighterKey] ?? null;
}

/**
 * Per-slot struck-limb hold summary published by GameFighter (dev/debug only).
 * Presentation state lives in a component ref; the HUD is rendered by the
 * P1-owned overlay, so it needs this read-only bridge to show both fighters.
 */
const struckLimbHoldDebugLines = Object.create(null);

/** @param {"player 1"|"player 2"} fighterKey @param {string|null} line */
export function noteStruckLimbHoldDebug(fighterKey, line) {
  if (fighterKey !== "player 1" && fighterKey !== "player 2") return;
  struckLimbHoldDebugLines[fighterKey] =
    typeof line === "string" && line ? line : null;
}

export function getStruckLimbHoldDebugLines() {
  return ["player 1", "player 2"]
    .map((k, i) => {
      const line = struckLimbHoldDebugLines[k];
      return line ? `P${i + 1} ${line}` : null;
    })
    .filter(Boolean);
}

/** Test / rematch helper — clears stale director hints. */
export function clearLocalStrikePhaseHints() {
  delete localStrikePhaseHints["player 1"];
  delete localStrikePhaseHints["player 2"];
  delete struckLimbHoldDebugLines["player 1"];
  delete struckLimbHoldDebugLines["player 2"];
  clearFighterRenderAnchors();
  clearSupportedStrikeLatches();
}

const DESIGN_W = 1280;
const DESIGN_H = 720;
const HITBOX_HALF = 65;
const GRAB_RANGE = 146;
const GROUND_LEVEL = 286;
const DISPLAY_WIDTH_FRAC = 0.123;
const SPRITE_WORLD_SIZE = DESIGN_W * DISPLAY_WIDTH_FRAC;
const LEGACY_SOLE_FROM_BOTTOM_PCT = 0.021;
const SPRITE_PX_TO_WORLD = (DESIGN_W * 0.123) / 960;
const TIP_SLAP = 478 * SPRITE_PX_TO_WORLD;
const TIP_PALM = 438 * SPRITE_PX_TO_WORLD;
const TIP_CHARGED = 425 * SPRITE_PX_TO_WORLD;

/**
 * Per-slot render anchors written by GameFighter (DEV/debug only).
 * Used so overlay volumes share the same stage root as the sprite CSS box.
 */
const fighterRenderAnchors = Object.create(null);

/**
 * @param {"player 1"|"player 2"} fighterKey
 * @param {{ simX:number, simY:number, renderX:number, renderY:number, soleFromBottomPct?:number, facing?:number }|null} anchor
 */
export function noteFighterRenderAnchor(fighterKey, anchor) {
  if (fighterKey !== "player 1" && fighterKey !== "player 2") return;
  if (!anchor) {
    delete fighterRenderAnchors[fighterKey];
    // Slot vacated — drop any latched strike identity for that fighter.
    clearSupportedStrikeLatch(fighterKey);
    return;
  }
  fighterRenderAnchors[fighterKey] = {
    simX: anchor.simX,
    simY: anchor.simY,
    renderX: anchor.renderX,
    renderY: anchor.renderY,
    soleFromBottomPct:
      typeof anchor.soleFromBottomPct === "number"
        ? anchor.soleFromBottomPct
        : LEGACY_SOLE_FROM_BOTTOM_PCT,
    facing: anchor.facing,
    t: performance.now(),
  };
}

export function getFighterRenderAnchor(fighterKey) {
  return fighterRenderAnchors[fighterKey] || null;
}

export function clearFighterRenderAnchors() {
  delete fighterRenderAnchors["player 1"];
  delete fighterRenderAnchors["player 2"];
}

/**
 * Resolve the debug volume root from the same values GameFighter uses for CSS:
 * prefer renderX/renderY (pose-adjusted sprite box), else sim x/y.
 */
export function resolveDebugVolumeRoot(fighter) {
  const simX = typeof fighter?.x === "number" ? fighter.x : 0;
  const simY = typeof fighter?.y === "number" ? fighter.y : GROUND_LEVEL;
  const rootX = typeof fighter?.renderX === "number" ? fighter.renderX : simX;
  const rootY = typeof fighter?.renderY === "number" ? fighter.renderY : simY;
  const solePct =
    typeof fighter?.soleFromBottomPct === "number"
      ? fighter.soleFromBottomPct
      : LEGACY_SOLE_FROM_BOTTOM_PCT;
  const spriteSize =
    typeof fighter?.spriteWorldSize === "number"
      ? fighter.spriteWorldSize
      : SPRITE_WORLD_SIZE;
  return {
    simX,
    simY,
    rootX,
    rootY,
    solePct,
    spriteSize,
    visualFootY: rootY + solePct * spriteSize,
  };
}

function attackDir(facing) {
  return facing === 1 ? -1 : 1;
}

export function resolveMirrorFacing(f) {
  if (!f) return 1;
  if (f.isSlapAttack && (f.slapFacingDirection === 1 || f.slapFacingDirection === -1)) {
    return f.slapFacingDirection;
  }
  if (
    (f.isPalmThrust || f.isChargingAttack || f.attackType === "charged") &&
    (f.chargingFacingDirection === 1 || f.chargingFacingDirection === -1)
  ) {
    return f.chargingFacingDirection;
  }
  return f.facing === 1 || f.facing === -1 ? f.facing : 1;
}

function localToWorld(forward, up, halfW, halfH, rootX, rootY, facing) {
  const dir = attackDir(facing);
  const cx = rootX + dir * forward;
  const cy = rootY + up;
  return {
    left: cx - halfW,
    right: cx + halfW,
    bottom: cy - halfH,
    top: cy + halfH,
  };
}

function isPassThrough(f) {
  return !!(
    f.isDodging ||
    f.isSidestepping ||
    (f.isRopeJumping && f.ropeJumpPhase === "active") ||
    (f.isSlideJumping && f.slideJumpPhase === "flight")
  );
}

function isStrikeCommitted(f) {
  return !!(
    f?.isAttacking ||
    f?.isSlapAttack ||
    f?.isPalmThrust ||
    (f?.isChargingAttack && f?.attackType === "charged")
  );
}

function readStrikePhaseHint(fighter) {
  if (!fighter) return null;
  if (
    fighter.strikePhaseHint === "startup" ||
    fighter.strikePhaseHint === "active" ||
    fighter.strikePhaseHint === "recovery"
  ) {
    return {
      hint: fighter.strikePhaseHint,
      source: "pose_director_hint",
    };
  }
  if (fighter.fighter === "player 1" || fighter.fighter === "player 2") {
    const slotted = getLocalStrikePhaseHint(fighter.fighter);
    if (slotted === "startup" || slotted === "active" || slotted === "recovery") {
      return { hint: slotted, source: "local_pose_director" };
    }
  }
  return null;
}

function isSlapFamily(f) {
  return !!(
    f?.isSlapAttack ||
    f?.attackType === "slap" ||
    f?.currentAction === "slap"
  );
}

function isPalmFamily(f) {
  return !!(
    f?.isPalmThrust ||
    f?.attackType === "palm" ||
    f?.currentAction === "palm"
  );
}

function isChargedFamily(f) {
  return !!(
    f?.attackType === "charged" ||
    f?.currentAction === "charged" ||
    (f?.isChargingAttack && !f?.isPalmThrust && !f?.isSlapAttack)
  );
}

/**
 * Debug-only per-slot last supported strike kind.
 *
 * Needed because charged recovery clears attackType/currentAction/isAttacking
 * on the wire while keeping isRecovering — unlike palm (isPalmThrust held) or
 * slap (isSlapAttack typically held). Not a timer; only consumed while
 * recovering/endlag; overwritten by the next positively identified strike.
 */
const lastSupportedStrikeByFighter = Object.create(null);

function fighterSlotKey(fighter) {
  return fighter?.fighter === "player 1" || fighter?.fighter === "player 2"
    ? fighter.fighter
    : null;
}

function rememberSupportedStrike(fighter, move) {
  const key = fighterSlotKey(fighter);
  if (!key) return;
  if (move !== "slap" && move !== "palm" && move !== "charged") return;
  lastSupportedStrikeByFighter[key] = { move };
}

function clearSupportedStrikeLatch(fighterOrKey) {
  if (fighterOrKey === "player 1" || fighterOrKey === "player 2") {
    delete lastSupportedStrikeByFighter[fighterOrKey];
    return;
  }
  const key = fighterSlotKey(fighterOrKey);
  if (key) delete lastSupportedStrikeByFighter[key];
}

function getLatchedSupportedStrike(fighter) {
  const key = fighterSlotKey(fighter);
  if (!key) return null;
  const entry = lastSupportedStrikeByFighter[key];
  return entry?.move === "slap" ||
    entry?.move === "palm" ||
    entry?.move === "charged"
    ? entry.move
    : null;
}

/** Test / rematch helper — clear debug strike-identity latches. */
export function clearSupportedStrikeLatches() {
  delete lastSupportedStrikeByFighter["player 1"];
  delete lastSupportedStrikeByFighter["player 2"];
}

function recoveryPoseForMove(move) {
  if (move === "slap") return "slap_recovery";
  if (move === "palm") return "palm_recovery";
  if (move === "charged") return "charged_recovery";
  return null;
}

function resolveRecoveryMove(fighter) {
  if (isSlapFamily(fighter)) return { move: "slap", identitySource: "live_flags" };
  if (isPalmFamily(fighter)) return { move: "palm", identitySource: "live_flags" };
  if (isChargedFamily(fighter)) {
    return { move: "charged", identitySource: "live_flags" };
  }
  const latched = getLatchedSupportedStrike(fighter);
  if (latched) {
    return { move: latched, identitySource: "debug_strike_latch" };
  }
  return { move: null, identitySource: null };
}

/**
 * Single coherent lifecycle resolver for debug volumes + authored poses.
 *
 * Precedence (one snapshot):
 *   1. Explicit recovery / endlag  — ALWAYS beats pose-director hints
 *   2. Charge hold (charging, not attacking)
 *   3. Authoritative startup flag
 *   4. Pose-director / local hint (startup|active|recovery)
 *   5. Charged attacking with lifecycle flags (not slap/palm wire ambiguity)
 *   6. Committed slap/palm without exact phase → uncertain (omit HIT)
 *   7. Neutral
 *
 * @returns {{
 *   phase: string,
 *   exact: boolean,
 *   source: string,
 *   move: "slap"|"palm"|"charged"|null,
 *   poseKey: string|null,
 *   support: "supported"|"unsupported",
 *   identitySource?: string|null,
 * }}
 */
export function resolveStrikeLifecycleDebug(fighter) {
  if (!fighter) {
    return {
      phase: STRIKE_DEBUG_PHASE.NEUTRAL,
      exact: true,
      source: "empty",
      move: null,
      poseKey: null,
      support: "unsupported",
      identitySource: null,
    };
  }

  const hintInfo = readStrikePhaseHint(fighter);
  const hint = hintInfo?.hint || null;

  // 1) Explicit recovery wins over pose hints (palm director ACTIVE_END lags
  // server isRecovering by hundreds of ms — never allow active HIT here).
  // Charged recovery clears attackType/currentAction — use debug latch then.
  if (fighter.isRecovering || fighter.isInEndlag) {
    const source = fighter.isInEndlag ? "isInEndlag" : "isRecovering";
    const { move, identitySource } = resolveRecoveryMove(fighter);
    const poseKey = recoveryPoseForMove(move);
    if (move && poseKey) {
      return {
        phase: STRIKE_DEBUG_PHASE.RECOVERY,
        exact: true,
        source,
        move,
        poseKey,
        support: "supported",
        identitySource,
      };
    }
    return {
      phase: STRIKE_DEBUG_PHASE.RECOVERY,
      exact: true,
      source,
      move: null,
      poseKey: null,
      support: "unsupported",
      identitySource: null,
    };
  }

  // 2) Charge hold
  if (fighter.isChargingAttack && !fighter.isAttacking) {
    rememberSupportedStrike(fighter, "charged");
    return {
      phase: STRIKE_DEBUG_PHASE.STARTUP,
      exact: true,
      source: "charge_hold",
      move: "charged",
      poseKey: "charged_hold",
      support: "supported",
      identitySource: "live_flags",
    };
  }

  // 3) Authoritative startup flag
  if (fighter.isInStartupFrames === true) {
    if (isSlapFamily(fighter)) {
      rememberSupportedStrike(fighter, "slap");
      return {
        phase: STRIKE_DEBUG_PHASE.STARTUP,
        exact: true,
        source: "isInStartupFrames",
        move: "slap",
        poseKey: "slap_startup",
        support: "supported",
        identitySource: "live_flags",
      };
    }
    if (isPalmFamily(fighter)) {
      rememberSupportedStrike(fighter, "palm");
      return {
        phase: STRIKE_DEBUG_PHASE.STARTUP,
        exact: true,
        source: "isInStartupFrames",
        move: "palm",
        poseKey: "palm_startup",
        support: "supported",
        identitySource: "live_flags",
      };
    }
    if (isChargedFamily(fighter) || fighter.attackType === "charged") {
      rememberSupportedStrike(fighter, "charged");
      return {
        phase: STRIKE_DEBUG_PHASE.STARTUP,
        exact: true,
        source: "isInStartupFrames",
        move: "charged",
        poseKey: "charged_hold",
        support: "supported",
        identitySource: "live_flags",
      };
    }
    return {
      phase: STRIKE_DEBUG_PHASE.STARTUP,
      exact: true,
      source: "isInStartupFrames",
      move: null,
      poseKey: null,
      support: "unsupported",
      identitySource: null,
    };
  }

  // 4) Pose-director / local hint — geometry aid only; never overrides recovery
  if (hint === "startup" || hint === "active" || hint === "recovery") {
    const source = hintInfo.source;
    if (isSlapFamily(fighter)) {
      if (hint === "startup" || hint === "active") {
        rememberSupportedStrike(fighter, "slap");
      }
      return {
        phase: hint,
        exact: true,
        source,
        move: "slap",
        poseKey:
          hint === "startup"
            ? "slap_startup"
            : hint === "active"
              ? "slap_active"
              : "slap_recovery",
        support: "supported",
        identitySource: "live_flags",
      };
    }
    if (isPalmFamily(fighter)) {
      if (hint === "startup" || hint === "active") {
        rememberSupportedStrike(fighter, "palm");
      }
      return {
        phase: hint,
        exact: true,
        source,
        move: "palm",
        poseKey:
          hint === "startup"
            ? "palm_startup"
            : hint === "active"
              ? "palm_active"
              : "palm_recovery",
        support: "supported",
        identitySource: "live_flags",
      };
    }
    if (isChargedFamily(fighter)) {
      if (hint === "startup" || hint === "active") {
        rememberSupportedStrike(fighter, "charged");
      }
      return {
        phase: hint,
        exact: true,
        source,
        move: "charged",
        poseKey:
          hint === "startup"
            ? "charged_hold"
            : hint === "active"
              ? "charged_active"
              : "charged_recovery",
        support: "supported",
        identitySource: "live_flags",
      };
    }
    return {
      phase: hint,
      exact: true,
      source,
      move: null,
      poseKey: null,
      support: "unsupported",
      identitySource: null,
    };
  }

  // 5) Charged release/active — lifecycle flags are enough (no director clock).
  // Slap/palm MUST NOT use this path: wire keeps isAttacking through recovery.
  if (
    fighter.isAttacking &&
    fighter.attackType === "charged" &&
    !fighter.isPalmThrust &&
    !fighter.isSlapAttack
  ) {
    rememberSupportedStrike(fighter, "charged");
    return {
      phase: STRIKE_DEBUG_PHASE.ACTIVE,
      exact: true,
      source: "charged_lifecycle_active",
      move: "charged",
      poseKey: "charged_active",
      support: "supported",
      identitySource: "live_flags",
    };
  }

  // 6) Committed slap/palm (or unknown strike) without exact phase → omit HIT
  if (isStrikeCommitted(fighter) || isSlapFamily(fighter) || isPalmFamily(fighter)) {
    return {
      phase: STRIKE_DEBUG_PHASE.UNCERTAIN,
      exact: false,
      source: "wire_flags_insufficient",
      move: isPalmFamily(fighter)
        ? "palm"
        : isSlapFamily(fighter)
          ? "slap"
          : isChargedFamily(fighter)
            ? "charged"
            : null,
      poseKey: null,
      support: "unsupported",
      identitySource: null,
    };
  }

  // Neutral — drop latch so the next attack cannot inherit identity.
  clearSupportedStrikeLatch(fighter);
  return {
    phase: STRIKE_DEBUG_PHASE.NEUTRAL,
    exact: true,
    source: "idle",
    move: null,
    poseKey: "neutral",
    support: "supported",
    identitySource: null,
  };
}

/**
 * Classify strike phase for debug volumes (thin wrapper over lifecycle resolver).
 * @returns {{ phase: string, exact: boolean, source: string }}
 */
export function classifyStrikeDebugPhase(fighter) {
  const r = resolveStrikeLifecycleDebug(fighter);
  return {
    phase: r.phase,
    exact: r.exact,
    source: r.source,
  };
}

/**
 * Map local slap pose-director frame → strikePhaseHint.
 * Frames: 0 windup, 1 smear, 2 hit/active, 3 recovery (see GameFighter SLAP_ANIM).
 */
export function slapFrameToStrikePhaseHint(slapFrame) {
  if (slapFrame == null || slapFrame < 0) return null;
  if (slapFrame <= 1) return "startup";
  if (slapFrame === 2) return "active";
  return "recovery";
}

/** Palm frames: 0 startup, 1 smear, 2 active, 3 recovery. */
export function palmFrameToStrikePhaseHint(palmFrame) {
  return slapFrameToStrikePhaseHint(palmFrame);
}

/**
 * Derive Phase 1 diagnostic volumes for overlay (fixture rectangles).
 * Phase 3 authored shapes: use deriveAuthoredDebugVolumes from
 * combatVolumeAuthoredClient.js when shadow overlay mode is on.
 */
export function deriveDebugCombatVolumes(fighter) {
  if (!fighter || typeof fighter.x !== "number") return [];
  const { rootX, rootY } = resolveDebugVolumeRoot(fighter);
  const size =
    typeof fighter.sizeMult === "number"
      ? fighter.sizeMult
      : typeof fighter.sizeMultiplier === "number"
        ? fighter.sizeMultiplier
        : 1;
  const half = HITBOX_HALF * (size || 1);
  const mirror = resolveMirrorFacing(fighter);
  const volumes = [];
  const pass = isPassThrough(fighter);
  const strike = classifyStrikeDebugPhase(fighter);

  volumes.push({
    kind: COMBAT_VOLUME_KIND.PUSH,
    color: COMBAT_VOLUME_DEBUG_COLOR.PUSH,
    aabb: localToWorld(0, 55, half, 55, rootX, rootY, mirror),
    dashed: pass,
    label: pass ? "PUSH (intangible)" : "PUSH",
    exact: true,
  });

  if (rootY >= GROUND_LEVEL - 2) {
    volumes.push({
      kind: COMBAT_VOLUME_KIND.LANDING,
      color: COMBAT_VOLUME_DEBUG_COLOR.LANDING,
      aabb: localToWorld(0, 4, half, 4, rootX, GROUND_LEVEL, mirror),
      dashed: false,
      label: "LAND",
      exact: true,
    });
  }

  if (!pass) {
    volumes.push({
      kind: COMBAT_VOLUME_KIND.HURT_BODY,
      color: COMBAT_VOLUME_DEBUG_COLOR.HURT_BODY,
      aabb: localToWorld(0, 55, half, 55, rootX, rootY, mirror),
      dashed: false,
      label: "HURT",
      exact: true,
    });
  }

  // HURT_LIMB — only when recovery is exact (never invent limb during uncertain).
  const showLimb =
    fighter._phase1SlapRecoveryLimb === true ||
    (strike.exact &&
      strike.phase === STRIKE_DEBUG_PHASE.RECOVERY &&
      (fighter.isSlapAttack ||
        fighter.isPalmThrust ||
        fighter.currentAction === "slap" ||
        fighter._phase1SlapRecoveryLimb));
  if (showLimb) {
    volumes.push({
      kind: COMBAT_VOLUME_KIND.HURT_LIMB,
      color: COMBAT_VOLUME_DEBUG_COLOR.HURT_LIMB,
      aabb: localToWorld(70, 70, 36, 18, rootX, rootY, mirror),
      dashed: false,
      label: "LIMB",
      exact: true,
    });
  }

  // Offensive HIT — ONLY exact active. Never during recovery or uncertain.
  // Uncertain → omit (do not paint a red box that could be recovery).
  if (
    strike.exact &&
    strike.phase === STRIKE_DEBUG_PHASE.ACTIVE &&
    (fighter.isAttacking || fighter.isSlapAttack || fighter.isPalmThrust)
  ) {
    let tip = TIP_SLAP;
    if (fighter.isPalmThrust) tip = TIP_PALM;
    else if (fighter.attackType === "charged" && !fighter.isPalmThrust) {
      tip = TIP_CHARGED;
    }
    volumes.push({
      kind: COMBAT_VOLUME_KIND.HIT,
      color: COMBAT_VOLUME_DEBUG_COLOR.HIT,
      aabb: localToWorld(tip - 12, 70, 14, 16, rootX, rootY, mirror),
      dashed: false,
      label: "HIT",
      exact: true,
    });
  }

  if (fighter.isGrabStartup) {
    const grabHalf = (GRAB_RANGE * size) * 0.5;
    volumes.push({
      kind: COMBAT_VOLUME_KIND.GRAB,
      color: COMBAT_VOLUME_DEBUG_COLOR.GRAB,
      aabb: localToWorld(grabHalf, 50, grabHalf, 50, rootX, rootY, mirror),
      dashed: false,
      label: "GRAB",
      exact: true,
    });
  }

  return volumes;
}

/**
 * World AABB → CSS box using the same stage math as fighters:
 *   left = x / 1280, bottom = y / 720 (feet / minY at element bottom).
 * The host layer MUST live under `.game-actors` so camera/app zoom apply.
 */
export function aabbToCssBox(aabb) {
  if (!aabb) return null;
  const { left, right, top, bottom } = aabb;
  if (
    ![left, right, top, bottom].every(
      (n) => typeof n === "number" && Number.isFinite(n)
    )
  ) {
    return null;
  }
  if (right < left || top < bottom) return null;
  const leftPct = (left / DESIGN_W) * 100;
  const widthPct = ((right - left) / DESIGN_W) * 100;
  const bottomPct = (bottom / DESIGN_H) * 100;
  const heightPct = ((top - bottom) / DESIGN_H) * 100;
  return { leftPct, widthPct, bottomPct, heightPct };
}

/**
 * DEV anchor crosshairs — sim root, render (sprite CSS) root, visual foot, facing axis.
 * Allocates only when called from an enabled overlay paint.
 */
export function renderAnchorMarkersHtml(fighter, prefix) {
  if (!fighter || typeof fighter.x !== "number") return "";
  const a = resolveDebugVolumeRoot(fighter);
  const mirror = resolveMirrorFacing(fighter);
  const dir = attackDir(mirror);
  const mark = (x, y, color, label, size = 10) => {
    const left = (x / DESIGN_W) * 100;
    const bottom = (y / DESIGN_H) * 100;
    return `<div data-anchor="${prefix}-${label}" style="position:absolute;left:${left}%;bottom:${bottom}%;width:${size}px;height:${size}px;margin-left:-${size / 2}px;margin-bottom:-${size / 2}px;pointer-events:none;z-index:60">
      <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:${color};transform:translateX(-50%)"></div>
      <div style="position:absolute;top:50%;left:0;width:100%;height:1px;background:${color};transform:translateY(-50%)"></div>
      <span style="position:absolute;left:${size + 2}px;top:-2px;color:${color};font:9px/1 monospace;text-shadow:0 1px 2px #000;white-space:nowrap">${label}</span>
    </div>`;
  };
  const axisLen = 36;
  const axisX = a.rootX + dir * axisLen;
  const axisLeft = (Math.min(a.rootX, axisX) / DESIGN_W) * 100;
  const axisWidth = (Math.abs(axisLen) / DESIGN_W) * 100;
  const axisBottom = (a.rootY / DESIGN_H) * 100;
  let html = "";
  html += mark(a.simX, a.simY, "#ffeb3b", "sim");
  if (
    Math.abs(a.rootX - a.simX) > 0.25 ||
    Math.abs(a.rootY - a.simY) > 0.25
  ) {
    html += mark(a.rootX, a.rootY, "#80deea", "render");
  }
  html += mark(a.rootX, a.visualFootY, "#f48fb1", "foot", 8);
  html += `<div data-anchor="${prefix}-face" style="position:absolute;left:${axisLeft}%;bottom:${axisBottom}%;width:${axisWidth}%;height:2px;margin-bottom:-1px;background:#fff59d;opacity:0.9;pointer-events:none;z-index:59" title="action-facing axis"></div>`;
  html += mark(a.rootX, a.rootY, "#ea80fc", "vol", 6);
  return html;
}

export function renderVolumeBoxesHtml(fighter, prefix, volumes) {
  const vols = volumes || deriveDebugCombatVolumes(fighter);
  let html = "";
  for (let i = 0; i < vols.length; i++) {
    const v = vols[i];
    const box = aabbToCssBox(v.aabb);
    if (!box) {
      html += `<div data-vol="${prefix}-${v.kind}-INVALID" style="position:absolute;left:8px;top:${40 + i * 14}px;color:#ff5252;font:10px/1 monospace;pointer-events:none">INVALID ${prefix} ${v.kind}</div>`;
      continue;
    }
    const border = v.dashed ? "1px dashed" : "2px solid";
    const label = v.region && v.region !== v.label ? `${v.label}` : v.label;
    html += `<div data-vol="${prefix}-${v.kind}" style="position:absolute;left:${box.leftPct}%;bottom:${box.bottomPct}%;width:${box.widthPct}%;height:${box.heightPct}%;border:${border} ${v.color};background:${v.color}22;box-sizing:border-box;pointer-events:none">
      <span style="position:absolute;left:2px;top:0;color:${v.color};font:10px/1 monospace;text-shadow:0 1px 2px #000">${label}</span>
    </div>`;
  }
  return html;
}

/** Dev overlay footnote when HIT is omitted due to uncertain phase. */
export function formatStrikePhaseDebugLine(fighter, label) {
  const s = classifyStrikeDebugPhase(fighter);
  if (s.phase === STRIKE_DEBUG_PHASE.NEUTRAL) return null;
  const hitShown =
    s.exact && s.phase === STRIKE_DEBUG_PHASE.ACTIVE ? "HIT" : "no-HIT";
  return `${label} strike=${s.phase}${s.exact ? "" : "?"} src=${s.source} → ${hitShown}`;
}
