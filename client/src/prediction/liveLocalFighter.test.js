/**
 * Live local-fighter selection for input classification.
 * Run: node --test client/src/prediction/liveLocalFighter.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectLiveLocalFighter } from "./liveLocalFighter.js";
import { selectMouse1StrikeCommand } from "../combatAudio/mouse1CommandSelection.js";

describe("selectLiveLocalFighter", () => {
  it("prefers live snapshot facing over stale room summary", () => {
    const sel = selectLiveLocalFighter({
      localId: "p1",
      roomPlayer: { id: "p1", facing: -1 },
      getSharedState: () => ({
        player1: { id: "p1", facing: 1 },
        player2: { id: "p2", facing: -1 },
      }),
    });
    assert.equal(sel.facing, 1);
    assert.equal(sel.facingSource, "live_snapshot");
    assert.equal(sel.roomFacing, -1);
    assert.equal(sel.liveFacing, 1);
  });

  it("never picks opponent snapshot as local", () => {
    const sel = selectLiveLocalFighter({
      localId: "p1",
      roomPlayer: { id: "p1", facing: 1 },
      getSharedState: () => ({
        player1: { id: "p2", facing: -1 },
        player2: { id: "p2", facing: -1 },
      }),
    });
    assert.equal(sel.facingSource, "room_summary_fallback");
    assert.equal(sel.facing, 1);
  });

  it("falls back to room summary before any snapshot", () => {
    const sel = selectLiveLocalFighter({
      localId: "p1",
      roomPlayer: { id: "p1", facing: -1 },
      getSharedState: () => ({ player1: null, player2: null }),
    });
    assert.equal(sel.facing, -1);
    assert.equal(sel.facingSource, "room_summary_fallback");
  });
});

describe("stale room facing → charge (production input seam)", () => {
  it("S+A+Mouse1 with live facing 1 charges (not palm)", () => {
    const sel = selectLiveLocalFighter({
      localId: "local",
      roomPlayer: { id: "local", facing: -1 },
      getSharedState: () => ({
        player1: { id: "local", facing: 1 },
        player2: { id: "cpu", facing: -1 },
      }),
    });
    const cmd = selectMouse1StrikeCommand({
      keys: { s: true, a: true, mouse1: true },
      facing: sel.facing,
      roomFacing: sel.roomFacing,
      liveFacing: sel.liveFacing,
      facingSource: sel.facingSource,
      modeLabel: "vs_cpu",
      trace: false,
    });
    assert.equal(cmd.command, "charge_start");
    assert.notEqual(cmd.command, "palm_thrust");
  });

  it("mirrored: S+D+Mouse1 with live facing -1 charges", () => {
    const sel = selectLiveLocalFighter({
      localId: "local",
      roomPlayer: { id: "local", facing: 1 },
      getSharedState: () => ({
        player1: { id: "local", facing: -1 },
        player2: { id: "opp", facing: 1 },
      }),
    });
    const cmd = selectMouse1StrikeCommand({
      keys: { s: true, d: true, mouse1: true },
      facing: sel.facing,
      roomFacing: sel.roomFacing,
      liveFacing: sel.liveFacing,
      facingSource: sel.facingSource,
      modeLabel: "basho",
      trace: false,
    });
    assert.equal(cmd.command, "charge_start");
  });

  it("mode label does not change classification (pvp/cpu/basho)", () => {
    const keys = { s: true, a: true, mouse1: true };
    const facing = 1;
    const modes = ["custom_pvp", "vs_cpu", "basho"];
    const results = modes.map((modeLabel) =>
      selectMouse1StrikeCommand({
        keys,
        facing,
        roomFacing: -1,
        liveFacing: 1,
        facingSource: "live_snapshot",
        modeLabel,
        trace: false,
      }).command
    );
    assert.deepEqual(results, [
      "charge_start",
      "charge_start",
      "charge_start",
    ]);
  });
});
