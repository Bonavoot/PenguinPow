"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  createContactScenario,
  armSlap,
  placeInConnectRange,
  runBothCollisionOrders,
} = require("./helpers/contactSim");

const scenarios = [];
afterEach(() => {
  while (scenarios.length) scenarios.pop().dispose();
});

function sc(opts) {
  const s = createContactScenario(opts);
  scenarios.push(s);
  return s;
}

function armGuard(player) {
  player.isRawParrying = true;
  player.isGuarding = true;
  player.apActiveUntil = 0;
  player.stamina = 80;
  return player;
}

describe("Guard block consumes the incoming string", () => {
  it("blocked slap dies — attacker cannot keep the cycle", () => {
    const s = sc({ gap: 80 });
    const now = s.simTime;
    armSlap(s.left, { now });
    armGuard(s.right);
    placeInConnectRange(s.left, s.right, "slap");
    runBothCollisionOrders(s.left, s.right, s.rooms, s.io);

    assert.equal(s.left.isAttacking, false, "hitbox must die");
    assert.equal(s.left.isSlapAttack, false, "slap pose must drop");
    assert.equal(s.left.isRecovering, true, "short settle");
    assert.equal(s.right.isHit, false, "guard is not a hit");
    assert.ok(s.right.balance < 100, "blocker ate chip");
    assert.ok(
      (s.left.inputLockUntil || 0) > now,
      "attacker locked through the settle"
    );
  });
});
