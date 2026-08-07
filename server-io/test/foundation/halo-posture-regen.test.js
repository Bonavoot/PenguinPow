"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  BALANCE_MAX,
  BALANCE_REGEN_DELAY_MS,
  BALANCE_REGEN_PER_SEC,
  BALANCE_GASSED_REGEN_MULT,
  AP_PERFECT_BALANCE_REFUND,
  PERFECT_PARRY_BALANCE_REFUND,
} = require("../../constants");
const { applyBalanceDamage } = require("../../gameUtils");

function tickHaloRegen(player, simTime, deltaMs) {
  if (player.balance >= BALANCE_MAX || player.inClinch || player.gameOver) return;
  const lastDmg = player.lastPostureDamageTime || 0;
  const delayElapsed =
    lastDmg === 0 || simTime - lastDmg >= BALANCE_REGEN_DELAY_MS;
  if (!delayElapsed) return;
  let rate = BALANCE_REGEN_PER_SEC;
  rate *= player.statMods?.balanceRegen ?? 1;
  if (player.isGassed) rate *= BALANCE_GASSED_REGEN_MULT;
  player.balance = Math.min(
    BALANCE_MAX,
    player.balance + rate * (deltaMs / 1000)
  );
}

function freshPlayer(balance = 50) {
  return {
    balance,
    lastPostureDamageTime: 0,
    inClinch: false,
    isGassed: false,
    statMods: {},
  };
}

describe("Halo posture regen", () => {
  it("applyBalanceDamage stamps lastPostureDamageTime", () => {
    const p = freshPlayer(80);
    const dealt = applyBalanceDamage(p, 12, 5000);
    assert.equal(dealt, 12);
    assert.equal(p.balance, 68);
    assert.equal(p.lastPostureDamageTime, 5000);
  });

  it("does not regen during the 1.75s delay after damage", () => {
    const p = freshPlayer(40);
    applyBalanceDamage(p, 10, 1000);
    tickHaloRegen(p, 1000 + BALANCE_REGEN_DELAY_MS - 1, 16);
    assert.equal(p.balance, 30);
  });

  it("regens at 35/s once the delay elapses", () => {
    const p = freshPlayer(40);
    applyBalanceDamage(p, 10, 1000);
    tickHaloRegen(p, 1000 + BALANCE_REGEN_DELAY_MS, 1000);
    assert.ok(Math.abs(p.balance - 65) < 0.001, `got ${p.balance}`);
  });

  it("damage during regen stops regen and restarts the delay", () => {
    const p = freshPlayer(40);
    applyBalanceDamage(p, 10, 1000);
    tickHaloRegen(p, 1000 + BALANCE_REGEN_DELAY_MS, 500);
    assert.ok(Math.abs(p.balance - 47.5) < 0.001);
    applyBalanceDamage(p, 5, 1000 + BALANCE_REGEN_DELAY_MS + 500);
    assert.equal(p.balance, 42.5);
    tickHaloRegen(p, 1000 + BALANCE_REGEN_DELAY_MS + 500 + 1000, 1000);
    // Still inside new delay window — no regen
    assert.equal(p.balance, 42.5);
  });

  it("never regens while in clinch", () => {
    const p = freshPlayer(40);
    p.inClinch = true;
    p.lastPostureDamageTime = 0;
    tickHaloRegen(p, 100000, 1000);
    assert.equal(p.balance, 40);
  });

  it("perfect parry refunds are zeroed", () => {
    assert.equal(AP_PERFECT_BALANCE_REFUND, 0);
    assert.equal(PERFECT_PARRY_BALANCE_REFUND, 0);
  });
});
