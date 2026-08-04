/**
 * Phase 4A — temporally honest slapHurt HUD helpers.
 * Run: node --no-warnings --loader ./scripts/extResolve.mjs --test src/debug/slapHurtDebugHud.test.js
 */

import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  formatSlapHurtHudLines,
  inferCurrentSlapVictimDebug,
  LAST_COMMITTED_FRESH_MS,
  AUTHORED_SLAP_HURTBOX_HUD_KEY,
} from "./slapHurtDebugHud.js";
import { bindAuthoredCatalog } from "./combatVolumeAuthoredClient.js";
import { clearLocalStrikePhaseHints } from "./combatVolumeDebug.js";

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
    globalThis.localStorage?.removeItem?.(AUTHORED_SLAP_HURTBOX_HUD_KEY);
  } catch {
    /* ignore */
  }
});

describe("Phase 4A slapHurt HUD honesty", () => {
  it("CURRENT neutral when no slap flags — does not inherit LAST COMMITTED phase", () => {
    const now = 10_000;
    const lines = formatSlapHurtHudLines({
      p1: { x: 400, y: 286, facing: -1 },
      p2: { x: 700, y: 286, facing: 1 },
      lastCommitted: {
        t: now - 100,
        victimHurtRegion: "frontArm",
        victimHurtKind: "HURT_LIMB",
        victimSlapPhase: "active",
        victimSlapPoseKey: "slap_active",
        authoredSlapHurtboxV1: true,
        isPunish: false,
      },
      nowMs: now,
      flagHud: "ON",
    });
    assert.match(lines.flagLine, /SERVER AUTHORITY=CONFIRMED_ON/);
    assert.match(lines.flagLine, /CLIENT HUD EXPECT=ON/);
    assert.equal(lines.flagLine.includes("AUTHORITY ON"), false);
    assert.match(lines.currentLine, /P1 phase=neutral/);
    assert.match(lines.currentLine, /exposed=N/);
    assert.match(lines.queryLine, /CURRENT QUERY/);
    assert.match(lines.queryLine, /no active attacker/);
    assert.match(lines.lastLine, /LAST COMMITTED/);
    assert.match(lines.lastLine, /vPhase=active/);
    assert.equal(lines.lastLine.includes("EXPIRED"), false);
  });

  it("startup attacker CURRENT QUERY is startup-pending, never invents interruption", () => {
    const now = 12_000;
    const lines = formatSlapHurtHudLines({
      p1: {
        x: 400,
        y: 286,
        facing: -1,
        isAttacking: true,
        isSlapAttack: true,
        attackType: "slap",
        isInStartupFrames: true,
      },
      p2: {
        x: 560,
        y: 286,
        facing: 1,
        isSlapAttack: true,
        isAttacking: true,
        attackType: "slap",
        attackStartTime: now - 200,
        slapActiveEndTime: now - 50,
        _overlaySimTime: now,
      },
      lastCommitted: {
        t: now - 50,
        victimHurtRegion: "frontArm",
        victimSlapPhase: "active",
        victimSlapPoseKey: "slap_active",
        authoredSlapHurtboxV1: true,
      },
      nowMs: now,
      flagHud: "ON",
    });
    assert.match(lines.queryLine, /startup-pending/);
    assert.equal(lines.queryLine.includes("interrupted-before-active"), false);
    assert.match(lines.currentLine, /P2 phase=recovery/);
    assert.match(lines.lastLine, /vPhase=active/);
  });

  it("LAST COMMITTED becomes EXPIRED after fresh window", () => {
    const now = 20_000;
    const lines = formatSlapHurtHudLines({
      p1: { x: 1, y: 286, facing: -1 },
      p2: { x: 2, y: 286, facing: 1 },
      lastCommitted: {
        t: now - LAST_COMMITTED_FRESH_MS - 50,
        victimHurtRegion: "frontArm",
        victimSlapPhase: "active",
        victimSlapPoseKey: "slap_active",
        authoredSlapHurtboxV1: true,
      },
      nowMs: now,
      flagHud: "OFF",
    });
    assert.match(lines.lastLine, /LAST COMMITTED EXPIRED/);
    assert.match(lines.currentLine, /phase=neutral/);
  });

  it("localStorage ON alone never claims SERVER AUTHORITY confirmed", () => {
    const lines = formatSlapHurtHudLines({
      p1: { x: 1, y: 286, facing: -1 },
      p2: { x: 2, y: 286, facing: 1 },
      lastCommitted: null,
      nowMs: 1000,
      flagHud: "ON",
    });
    assert.match(lines.flagLine, /SERVER AUTHORITY=UNKNOWN/);
    assert.match(lines.flagLine, /CLIENT HUD EXPECT=ON/);
    assert.equal(/SERVER AUTHORITY=CONFIRMED_ON/.test(lines.flagLine), false);
  });

  it("clock recovery exposure is current, not last-committed active", () => {
    const f = {
      x: 500,
      y: 286,
      facing: -1,
      isSlapAttack: true,
      isAttacking: true,
      attackType: "slap",
      attackStartTime: 1000,
      slapActiveEndTime: 1185,
      _overlaySimTime: 1190,
      slapFacingDirection: -1,
    };
    const cur = inferCurrentSlapVictimDebug(f);
    assert.equal(cur.phase, "recovery");
    assert.equal(cur.exposed, true);
    assert.equal(cur.poseKey, "slap_recovery");
  });
});
