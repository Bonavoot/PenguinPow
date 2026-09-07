/**
 * First-bout priority list — pure function.
 * Run: node --test client/src/lib/firstBoutPriority.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  listFirstBoutSources,
  isFirstBoutSpriteId,
  FIRST_BOUT_SPRITE_IDS,
  FIRST_BOUT_ARENA_IDS,
  FIRST_BOUT_HUD_IDS,
} from "./firstBoutPriority.js";

describe("listFirstBoutSources", () => {
  it("returns both fighters' base / walk / slap / grab / hit / dodge / slide plus dohyo + HUD", () => {
    const srcs = listFirstBoutSources({
      player1Color: "#DA1B44",
      player2Color: "#4169E1",
      player1BodyColor: null,
      player2BodyColor: "#f5d0a0",
      player1GearIds: [],
      player2GearIds: [],
    });
    const must = [
      "pumo-idle",
      "pumo-waddle_spritesheet",
      "slapAttack1",
      "grabbing",
      "hit_spritesheet",
      "dodging",
      "sliding",
      "palm-thrust",
      "charging",
      "blocking",
      "recovering",
    ];
    for (const id of must) {
      assert.ok(
        srcs.some((s) => s.includes(id)),
        `missing ${id} in ${srcs.slice(0, 8).join(",")}…`
      );
    }
    for (const id of FIRST_BOUT_ARENA_IDS) {
      assert.ok(srcs.includes(`arena:${id}`), `missing arena ${id}`);
    }
    for (const id of FIRST_BOUT_HUD_IDS) {
      assert.ok(srcs.includes(`hud:${id}`), `missing hud ${id}`);
    }
    assert.ok(srcs.some((s) => s.includes("#DA1B44")));
    assert.ok(srcs.some((s) => s.includes("#4169E1")));
    assert.ok(srcs.some((s) => s.includes("#f5d0a0")));
  });

  it("includes gear tokens only when a fighter wears gear", () => {
    const bare = listFirstBoutSources({ player1GearIds: [], player2GearIds: [] });
    const hatted = listFirstBoutSources({
      player1GearIds: ["top_hat"],
      player2GearIds: [],
    });
    assert.ok(!bare.some((s) => s.startsWith("gear:")));
    assert.ok(hatted.some((s) => s.startsWith("gear:top_hat:")));
    assert.ok(hatted.length > bare.length);
  });

  it("keeps fighter poses before arena/HUD, and is far smaller than the full catalog", () => {
    const srcs = listFirstBoutSources({
      player1Color: "#111111",
      player2Color: "#222222",
    });
    const firstArena = srcs.findIndex((s) => s.startsWith("arena:"));
    const lastSprite = Math.max(
      ...srcs.map((s, i) => (s.startsWith("sprite:") || s.startsWith("tint:") ? i : -1))
    );
    assert.ok(firstArena > lastSprite, "arena comes after fighter poses");
    assert.ok(srcs.length < 200, `priority list ${srcs.length} should stay well under the 743-source dump`);
    assert.equal(FIRST_BOUT_SPRITE_IDS.length, 30);
  });

  it("is deterministic for the same colors/gear", () => {
    const a = listFirstBoutSources({
      player1Color: "#abc",
      player2Color: "#def",
      player1GearIds: ["crown"],
    });
    const b = listFirstBoutSources({
      player1Color: "#abc",
      player2Color: "#def",
      player1GearIds: ["crown"],
    });
    assert.deepEqual(a, b);
  });

  it("treats bald underlays of first-bout poses as first-bout", () => {
    assert.equal(isFirstBoutSpriteId("pumo-idle"), true);
    assert.equal(isFirstBoutSpriteId("pumo-idle-bald"), true);
    assert.equal(isFirstBoutSpriteId("palm-thrust-bald"), true);
    assert.equal(isFirstBoutSpriteId("pumo-army_spritesheet"), false);
  });
});
