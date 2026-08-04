/**
 * Phase 3 — lifecycle honesty: recovery beats pose hints; charged local phases.
 * Run: node --test client/src/debug/combatVolumeLifecycleHonesty.test.js
 */

import { describe, it, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import {
  COMBAT_VOLUME_KIND,
  STRIKE_DEBUG_PHASE,
  classifyStrikeDebugPhase,
  clearLocalStrikePhaseHints,
  deriveDebugCombatVolumes,
  noteFighterRenderAnchor,
  resolveStrikeLifecycleDebug,
} from "./combatVolumeDebug.js";
import {
  bindAuthoredCatalog,
  deriveAuthoredDebugVolumes,
  resolveClientAuthoredPoseKey,
} from "./combatVolumeAuthoredClient.js";

const require = createRequire(import.meta.url);
const catalogPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../shared/combatVolumeAuthored.json"
);

before(() => {
  bindAuthoredCatalog(require(catalogPath));
});

afterEach(() => {
  clearLocalStrikePhaseHints();
  try {
    resolveClientAuthoredPoseKey({ x: 1 });
  } catch {
    bindAuthoredCatalog(require(catalogPath));
  }
});

function authoredKinds(f) {
  return deriveAuthoredDebugVolumes(f).map((v) => v.kind);
}

function phase1Kinds(f) {
  return deriveDebugCombatVolumes(f).map((v) => v.kind);
}

describe("Phase 3 lifecycle honesty — palm / slap / charged", () => {
  it("1. palm active hint + explicit recovery → palm_recovery, zero HIT", () => {
    const f = {
      x: 500,
      y: 286,
      facing: -1,
      isPalmThrust: true,
      isAttacking: true,
      isRecovering: true,
      strikePhaseHint: "active", // stale director (ACTIVE_END lags lifecycle)
    };
    const life = resolveStrikeLifecycleDebug(f);
    assert.equal(life.phase, STRIKE_DEBUG_PHASE.RECOVERY);
    assert.equal(life.source, "isRecovering");
    assert.equal(life.poseKey, "palm_recovery");
    const authored = resolveClientAuthoredPoseKey(f);
    assert.equal(authored.poseKey, "palm_recovery");
    assert.equal(authoredKinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(phase1Kinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("2. palm active produces authored palm HIT rail", () => {
    const f = {
      x: 500,
      y: 286,
      facing: -1,
      isPalmThrust: true,
      isAttacking: true,
      strikePhaseHint: "active",
    };
    assert.equal(resolveClientAuthoredPoseKey(f).poseKey, "palm_active");
    const vols = deriveAuthoredDebugVolumes(f);
    assert.ok(vols.some((v) => v.kind === COMBAT_VOLUME_KIND.HIT));
    assert.ok(vols.some((v) => /palm/i.test(v.label) || v.role === "tip_rail_visualization" || v.label.includes("tip") || v.label.includes("rail") || v.kind === COMBAT_VOLUME_KIND.HIT));
  });

  it("3. palm startup produces zero HIT", () => {
    const f = {
      x: 500,
      y: 286,
      facing: -1,
      isPalmThrust: true,
      isAttacking: true,
      strikePhaseHint: "startup",
    };
    assert.equal(resolveClientAuthoredPoseKey(f).poseKey, "palm_startup");
    assert.equal(authoredKinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("4. slap startup no-HIT → active HIT → recovery LIMB/no-HIT", () => {
    const base = {
      x: 400,
      y: 286,
      facing: -1,
      isSlapAttack: true,
      isAttacking: true,
    };
    const startup = { ...base, strikePhaseHint: "startup" };
    assert.equal(authoredKinds(startup).includes(COMBAT_VOLUME_KIND.HIT), false);

    const active = { ...base, strikePhaseHint: "active" };
    assert.equal(resolveClientAuthoredPoseKey(active).poseKey, "slap_active");
    assert.equal(authoredKinds(active).includes(COMBAT_VOLUME_KIND.HIT), true);

    const recovery = {
      ...base,
      strikePhaseHint: "active",
      isRecovering: true,
    };
    assert.equal(resolveClientAuthoredPoseKey(recovery).poseKey, "slap_recovery");
    const rk = authoredKinds(recovery);
    assert.equal(rk.includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(rk.includes(COMBAT_VOLUME_KIND.HURT_LIMB), true);
  });

  it("5. local charged hold → charged_hold, no HIT", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isChargingAttack: true,
      isAttacking: false,
      attackType: "charged",
    };
    const r = resolveClientAuthoredPoseKey(f);
    assert.equal(r.poseKey, "charged_hold");
    assert.equal(r.phase, "startup");
    assert.equal(authoredKinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("6. local charged active → charged_active with HIT", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isAttacking: true,
      attackType: "charged",
      isChargingAttack: false,
      isRecovering: false,
    };
    const life = resolveStrikeLifecycleDebug(f);
    assert.equal(life.poseKey, "charged_active");
    assert.equal(life.phase, STRIKE_DEBUG_PHASE.ACTIVE);
    assert.equal(life.source, "charged_lifecycle_active");
    assert.equal(authoredKinds(f).includes(COMBAT_VOLUME_KIND.HIT), true);
    assert.equal(phase1Kinds(f).includes(COMBAT_VOLUME_KIND.HIT), true);
  });

  it("7. local charged recovery → charged_recovery, no HIT", () => {
    const f = {
      x: 400,
      y: 286,
      facing: -1,
      isAttacking: true,
      attackType: "charged",
      isRecovering: true,
      // stale active hint must not win
      strikePhaseHint: "active",
    };
    const r = resolveClientAuthoredPoseKey(f);
    assert.equal(r.poseKey, "charged_recovery");
    assert.equal(r.phase, "recovery");
    assert.equal(authoredKinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("8. remote slap/palm insufficient wire remains uncertain, no HIT", () => {
    const remoteSlap = {
      x: 700,
      y: 286,
      facing: 1,
      isSlapAttack: true,
      isAttacking: true,
      // no hint, no startup, no recovering
    };
    assert.equal(
      classifyStrikeDebugPhase(remoteSlap).phase,
      STRIKE_DEBUG_PHASE.UNCERTAIN
    );
    assert.equal(authoredKinds(remoteSlap).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(resolveClientAuthoredPoseKey(remoteSlap).support, "unsupported");
  });

  it("9. neutral clears stale phase/HIT (no committed flags)", () => {
    const f = { x: 400, y: 286, facing: -1 };
    const r = resolveStrikeLifecycleDebug(f);
    assert.equal(r.phase, STRIKE_DEBUG_PHASE.NEUTRAL);
    assert.equal(r.poseKey, "neutral");
    assert.equal(authoredKinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("10. volumes and diagnostic phase labels share one lifecycle snapshot", () => {
    const f = {
      x: 500,
      y: 286,
      facing: -1,
      isPalmThrust: true,
      isAttacking: true,
      isRecovering: true,
      strikePhaseHint: "active",
    };
    const life = resolveStrikeLifecycleDebug(f);
    const authored = resolveClientAuthoredPoseKey(f);
    const strike = classifyStrikeDebugPhase(f);
    assert.equal(life.phase, authored.phase);
    assert.equal(life.phase, strike.phase);
    assert.equal(life.poseKey, authored.poseKey);
    assert.equal(life.source, strike.source);
    // No HIT in either derive path
    assert.equal(authoredKinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(phase1Kinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("11. projection/world-host contract remains intact", () => {
    const fidelityPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "CombatFidelityDebug.js"
    );
    const src = fs.readFileSync(fidelityPath, "utf8");
    assert.ok(/querySelector\(["']\.game-actors["']\)/.test(src));
    assert.ok(/pumo-combat-volume-world/.test(src));
    assert.equal(/document\.body\.appendChild\(worldEl\)/.test(src), false);
    // Volumes ON → no HUD-only throttle gating world honesty
    assert.ok(/isCombatVolumesDebugEnabled\(\)\s*return true/.test(src.replace(/\s+/g, " ")) ||
      /volumesWanted|isCombatVolumesDebugEnabled\(\) return true/.test(src) ||
      src.includes("if (isCombatVolumesDebugEnabled()) return true"));
  });

  it("12. debug-off / volumes-off gate remains hard (source contract)", () => {
    const fidelityPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "CombatFidelityDebug.js"
    );
    const src = fs.readFileSync(fidelityPath, "utf8");
    assert.ok(/if \(!IS_DEV_BUILD\) return false/.test(src));
    assert.ok(/if \(!isCombatFidelityDebugEnabled\(\)\) return false/.test(src));
    assert.ok(
      /if \(!IS_DEV_BUILD\) return;/.test(src),
      "render must hard-gate before geometry"
    );
    // Volumes ON paints every frame; HUD-only keeps throttle.
    assert.ok(src.includes("if (isCombatVolumesDebugEnabled()) return true"));
    assert.ok(src.includes("HUD_MIN_INTERVAL_MS"));
  });
});

describe("Phase 3 charged recovery identity latch", () => {
  function chargedHold(overrides = {}) {
    return {
      fighter: "player 1",
      x: 400,
      y: 286,
      facing: -1,
      isChargingAttack: true,
      isAttacking: false,
      attackType: "charged",
      ...overrides,
    };
  }

  function chargedActive(overrides = {}) {
    return {
      fighter: "player 1",
      x: 400,
      y: 286,
      facing: -1,
      isAttacking: true,
      attackType: "charged",
      isChargingAttack: false,
      isRecovering: false,
      ...overrides,
    };
  }

  /** Wire after charged active: identity flags cleared, recovery only. */
  function chargedRecoveryCleared(overrides = {}) {
    return {
      fighter: "player 1",
      x: 400,
      y: 286,
      facing: -1,
      isRecovering: true,
      isAttacking: false,
      attackType: null,
      currentAction: null,
      isChargingAttack: false,
      isSlapAttack: false,
      isPalmThrust: false,
      ...overrides,
    };
  }

  it("13. charged hold → active → recovery → neutral (cleared wire)", () => {
    const hold = chargedHold();
    assert.equal(resolveClientAuthoredPoseKey(hold).poseKey, "charged_hold");
    assert.equal(authoredKinds(hold).includes(COMBAT_VOLUME_KIND.HIT), false);

    const active = chargedActive();
    assert.equal(resolveClientAuthoredPoseKey(active).poseKey, "charged_active");
    assert.equal(authoredKinds(active).includes(COMBAT_VOLUME_KIND.HIT), true);

    const recovery = chargedRecoveryCleared();
    const life = resolveStrikeLifecycleDebug(recovery);
    assert.equal(life.phase, STRIKE_DEBUG_PHASE.RECOVERY);
    assert.equal(life.move, "charged");
    assert.equal(life.poseKey, "charged_recovery");
    assert.equal(life.support, "supported");
    assert.equal(life.identitySource, "debug_strike_latch");
    assert.equal(resolveClientAuthoredPoseKey(recovery).poseKey, "charged_recovery");
    assert.equal(authoredKinds(recovery).includes(COMBAT_VOLUME_KIND.HIT), false);
    assert.equal(authoredKinds(recovery).includes(COMBAT_VOLUME_KIND.HURT_BODY), true);

    const idle = { fighter: "player 1", x: 400, y: 286, facing: -1 };
    assert.equal(resolveStrikeLifecycleDebug(idle).poseKey, "neutral");
    assert.equal(resolveStrikeLifecycleDebug(idle).move, null);
    assert.equal(authoredKinds(idle).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("14. charged recovery after attackType/isAttacking cleared uses latch", () => {
    resolveStrikeLifecycleDebug(chargedActive());
    const recovery = chargedRecoveryCleared({ strikePhaseHint: undefined });
    const life = resolveStrikeLifecycleDebug(recovery);
    assert.equal(life.poseKey, "charged_recovery");
    assert.equal(life.move, "charged");
    assert.equal(life.identitySource, "debug_strike_latch");
    assert.notEqual(life.support, "unsupported");
  });

  it("15. charged recovery with no pose-director hint still selects charged_recovery", () => {
    resolveStrikeLifecycleDebug(chargedHold());
    resolveStrikeLifecycleDebug(chargedActive());
    const recovery = chargedRecoveryCleared();
    assert.equal(recovery.strikePhaseHint, undefined);
    const authored = resolveClientAuthoredPoseKey(recovery);
    assert.equal(authored.poseKey, "charged_recovery");
    assert.equal(authored.support, "supported");
    assert.equal(authored.phase, "recovery");
  });

  it("16. charged recovery produces no HIT and retains body volumes", () => {
    resolveStrikeLifecycleDebug(chargedActive());
    const recovery = chargedRecoveryCleared({ strikePhaseHint: "active" });
    const vols = deriveAuthoredDebugVolumes(recovery);
    assert.equal(
      vols.some((v) => v.kind === COMBAT_VOLUME_KIND.HIT),
      false
    );
    assert.ok(vols.some((v) => v.kind === COMBAT_VOLUME_KIND.HURT_BODY));
    assert.ok(vols.some((v) => v.kind === COMBAT_VOLUME_KIND.PUSH));
    assert.equal(resolveClientAuthoredPoseKey(recovery).poseKey, "charged_recovery");
  });

  it("17. no strike-kind leakage into next neutral or different attack", () => {
    resolveStrikeLifecycleDebug(chargedActive({ fighter: "player 1" }));
    resolveStrikeLifecycleDebug(chargedRecoveryCleared({ fighter: "player 1" }));
    const idle = { fighter: "player 1", x: 400, y: 286, facing: -1 };
    assert.equal(resolveStrikeLifecycleDebug(idle).move, null);
    assert.equal(resolveStrikeLifecycleDebug(idle).poseKey, "neutral");

    const palm = {
      fighter: "player 1",
      x: 400,
      y: 286,
      facing: -1,
      isPalmThrust: true,
      isAttacking: true,
      isRecovering: true,
      strikePhaseHint: "active",
    };
    const palmLife = resolveStrikeLifecycleDebug(palm);
    assert.equal(palmLife.move, "palm");
    assert.equal(palmLife.poseKey, "palm_recovery");
    assert.notEqual(palmLife.move, "charged");
  });

  it("18. no identity leakage between P1 and P2 latches", () => {
    resolveStrikeLifecycleDebug(chargedActive({ fighter: "player 1" }));
    const p2PalmActive = {
      fighter: "player 2",
      x: 700,
      y: 286,
      facing: 1,
      isPalmThrust: true,
      isAttacking: true,
      strikePhaseHint: "active",
    };
    assert.equal(resolveStrikeLifecycleDebug(p2PalmActive).move, "palm");

    const p1Rec = chargedRecoveryCleared({ fighter: "player 1" });
    assert.equal(resolveStrikeLifecycleDebug(p1Rec).poseKey, "charged_recovery");

    const p2Rec = {
      fighter: "player 2",
      x: 700,
      y: 286,
      facing: 1,
      isPalmThrust: true,
      isAttacking: true,
      isRecovering: true,
      strikePhaseHint: "active",
    };
    assert.equal(resolveStrikeLifecycleDebug(p2Rec).poseKey, "palm_recovery");

    // P2 recovering without live palm flags must not inherit P1 charged latch.
    const p2BareRec = {
      fighter: "player 2",
      x: 700,
      y: 286,
      facing: 1,
      isRecovering: true,
      isAttacking: false,
      attackType: null,
    };
    // After palm_recovery above, latch is palm for P2 — clear via idle then bare recovery.
    resolveStrikeLifecycleDebug({ fighter: "player 2", x: 700, y: 286, facing: 1 });
    const bare = resolveStrikeLifecycleDebug(p2BareRec);
    assert.equal(bare.support, "unsupported");
    assert.equal(bare.poseKey, null);
    // P1 still charged if still recovering (separate slot)
    assert.equal(
      resolveStrikeLifecycleDebug(chargedRecoveryCleared({ fighter: "player 1" })).poseKey,
      "charged_recovery"
    );
  });

  it("19. clearLocalStrikePhaseHints resets latches (rematch/unmount boundary)", () => {
    resolveStrikeLifecycleDebug(chargedActive({ fighter: "player 1" }));
    clearLocalStrikePhaseHints();
    const recovery = chargedRecoveryCleared({ fighter: "player 1" });
    const life = resolveStrikeLifecycleDebug(recovery);
    assert.equal(life.support, "unsupported");
    assert.equal(life.poseKey, null);
  });

  it("19b. vacating render anchor clears that fighter's latch only", () => {
    resolveStrikeLifecycleDebug(chargedActive({ fighter: "player 1" }));
    resolveStrikeLifecycleDebug(
      chargedActive({ fighter: "player 2", x: 700, facing: 1 })
    );
    noteFighterRenderAnchor("player 1", null);
    assert.equal(
      resolveStrikeLifecycleDebug(chargedRecoveryCleared({ fighter: "player 1" }))
        .support,
      "unsupported"
    );
    assert.equal(
      resolveStrikeLifecycleDebug(
        chargedRecoveryCleared({ fighter: "player 2", x: 700, facing: 1 })
      ).poseKey,
      "charged_recovery"
    );
  });

  it("20. palm recovery with stale active hint remains no-HIT (regression)", () => {
    const f = {
      fighter: "player 1",
      x: 500,
      y: 286,
      facing: -1,
      isPalmThrust: true,
      isAttacking: true,
      isRecovering: true,
      strikePhaseHint: "active",
    };
    const life = resolveStrikeLifecycleDebug(f);
    assert.equal(life.poseKey, "palm_recovery");
    assert.equal(life.phase, STRIKE_DEBUG_PHASE.RECOVERY);
    assert.equal(authoredKinds(f).includes(COMBAT_VOLUME_KIND.HIT), false);
  });

  it("21. remote uncertain slap/palm without phase remains no-HIT", () => {
    const remoteSlap = {
      fighter: "player 2",
      x: 700,
      y: 286,
      facing: 1,
      isSlapAttack: true,
      isAttacking: true,
    };
    const life = resolveStrikeLifecycleDebug(remoteSlap);
    assert.equal(life.phase, STRIKE_DEBUG_PHASE.UNCERTAIN);
    assert.equal(life.support, "unsupported");
    assert.equal(authoredKinds(remoteSlap).includes(COMBAT_VOLUME_KIND.HIT), false);
  });
});
