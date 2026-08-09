"use strict";

/**
 * Command grab — CPU variant read.
 *
 * The CPU has no input packet, so it cannot select a variant through the shared
 * key-based selector; it commits one deliberately right after beginGrabStartup.
 * What is tested here is the READ: given a position and a posture, does it pick
 * the grab that actually converts?
 *
 * DIFF defaults to HARD, so these exercise the top-tier read. Note that reads are
 * never unanimous even there: clampChance caps every CPU probability at 0.95, a
 * house convention that keeps the top tier from being inhumanly perfect. So a
 * "correct" read shows up as dominant (~96-98%), not absolute, and the residual is
 * the intentional misread. Lower tiers misread far more often — that is the
 * difficulty surface, and it is why every tier still owns all three grabs.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { chooseCommandGrabVariant } = require("../../cpuAI");
const {
  CMD_GRAB_VARIANT,
  CMD_DRIVE_DISTANCE_MIN,
  CMD_DRIVE_DISTANCE_MAX,
  CLINCH_THROW_KILL_THRESHOLD,
} = require("../../constants");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../../gameUtils");

function pair({ cpuX, oppX, oppBalance = 100 }) {
  return [
    { id: "cpu", x: cpuX, balance: 100, stamina: 100 },
    { id: "opp", x: oppX, balance: oppBalance, stamina: 100 },
  ];
}

// Sample the read many times so probabilistic branches are observable.
const SAMPLES = 600;
function distribution(cpu, opp, n = SAMPLES) {
  const counts = { drive: 0, pull: 0, throw: 0, total: n };
  for (let i = 0; i < n; i += 1) {
    counts[chooseCommandGrabVariant(cpu, opp)] += 1;
  }
  return counts;
}

// A correct read should dominate but never be unanimous — clampChance's 0.95
// ceiling leaves ~5% deliberate misreads even at the top tier.
function assertDominant(counts, variant, label) {
  const ratio = counts[variant] / counts.total;
  assert.ok(
    ratio >= 0.93,
    `${label}: expected ${variant} to dominate, got ${(ratio * 100).toFixed(1)}% (${JSON.stringify(counts)})`
  );
  assert.ok(
    ratio < 1,
    `${label}: a top-tier read should still misread occasionally, not be perfect`
  );
}

// A read the situation rules out should only appear as part of that misread noise.
function assertAvoided(counts, variant, label) {
  const ratio = counts[variant] / counts.total;
  assert.ok(
    ratio <= 0.06,
    `${label}: ${variant} should be avoided here, got ${(ratio * 100).toFixed(1)}% (${JSON.stringify(counts)})`
  );
}

test("cpu command grab variant read", async (t) => {
  await t.test("no opponent falls back to DRIVE", () => {
    assert.equal(chooseCommandGrabVariant({ x: 500 }, null), CMD_GRAB_VARIANT.DRIVE);
  });

  await t.test("always returns one of the three variants", () => {
    const [cpu, opp] = pair({ cpuX: 600, oppX: 672 });
    const counts = distribution(cpu, opp);
    assert.equal(
      counts.drive + counts.pull + counts.throw,
      SAMPLES,
      "no read may return an unknown variant"
    );
  });

  await t.test("opponent pinned near the far rope → DRIVE (force-out is on)", () => {
    // Victim is to the CPU's right and only ~20px off the right rope, well inside
    // the carry's reach, so the Drive genuinely forces them out.
    const [cpu, opp] = pair({
      cpuX: MAP_RIGHT_BOUNDARY - 92,
      oppX: MAP_RIGHT_BOUNDARY - 20,
    });
    assertDominant(distribution(cpu, opp), "drive", "guaranteed force-out");
  });

  await t.test("lethal posture with a force-out available → DRIVE (oshidashi)", () => {
    const [cpu, opp] = pair({
      cpuX: MAP_RIGHT_BOUNDARY - 92,
      oppX: MAP_RIGHT_BOUNDARY - 20,
      oppBalance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    assertDominant(distribution(cpu, opp), "drive", "lethal at the rope");
  });

  await t.test("lethal posture mid-ring → avoids DRIVE (it cannot kill there)", () => {
    // Dead centre: even the maximum carry cannot reach a rope, so a Drive would
    // waste a kill. Throw and Pull both finish from anywhere.
    const centre = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    const [cpu, opp] = pair({
      cpuX: centre - 36,
      oppX: centre + 36,
      oppBalance: CLINCH_THROW_KILL_THRESHOLD - 1,
    });
    const counts = distribution(cpu, opp);
    assertAvoided(counts, "drive", "lethal mid-ring");
    assert.ok(counts.throw > 0 && counts.pull > 0, "both finishers should appear");
    assert.ok(
      counts.throw > counts.pull,
      "throw is the default finisher; pull is the archetype lean"
    );
  });

  await t.test("cornered with no force-out → PULL to reverse the geometry", () => {
    // CPU's own back is to the left rope, victim to its right but far from the
    // right rope, so driving only feeds the opponent more ring.
    const [cpu, opp] = pair({
      cpuX: MAP_LEFT_BOUNDARY + 20,
      oppX: MAP_LEFT_BOUNDARY + 92,
    });
    assertDominant(distribution(cpu, opp), "pull", "cornered escape");
  });

  await t.test("mid-ring neutral favours DRIVE but keeps all three live", () => {
    const centre = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
    const [cpu, opp] = pair({ cpuX: centre - 36, oppX: centre + 36 });
    const counts = distribution(cpu, opp, 1200);
    assert.ok(
      counts.drive > counts.throw && counts.drive > counts.pull,
      `Drive should be the default pressure tool, got ${JSON.stringify(counts)}`
    );
    assert.ok(
      counts.throw > 0 && counts.pull > 0,
      "the CPU must stay unpredictable, not become a Drive robot"
    );
  });

  await t.test("the read follows drive direction, not the victim's nearest rope", () => {
    // Victim sits just inside the LEFT rope, but the CPU is to their LEFT, so a
    // Drive pushes them RIGHT — away from the rope they happen to be near. The
    // force-out read must not fire.
    const [cpu, opp] = pair({
      cpuX: MAP_LEFT_BOUNDARY + 5,
      oppX: MAP_LEFT_BOUNDARY + 77,
    });
    // The CPU is itself cornered here, so the correct read is the PULL escape —
    // what matters is that DRIVE is not mistaken for a force-out.
    const counts = distribution(cpu, opp);
    assertAvoided(counts, "drive", "victim near the rope BEHIND the cpu");
  });

  await t.test("carry reach scales with posture, so the force-out read does too", () => {
    // A gap that a full-posture carry cannot close but a lethal-posture one can.
    const gap = (CMD_DRIVE_DISTANCE_MIN + CMD_DRIVE_DISTANCE_MAX) / 2;
    const oppX = MAP_RIGHT_BOUNDARY - gap;
    const healthy = distribution(
      ...pair({ cpuX: oppX - 72, oppX, oppBalance: 100 })
    );
    const battered = distribution(
      ...pair({ cpuX: oppX - 72, oppX, oppBalance: 20 })
    );
    assert.ok(
      healthy.drive / healthy.total < 0.9,
      `a healthy opponent is out of carry range, so DRIVE should not be forced (got ${JSON.stringify(healthy)})`
    );
    assertDominant(battered, "drive", "battered opponent within reach");
  });
});
