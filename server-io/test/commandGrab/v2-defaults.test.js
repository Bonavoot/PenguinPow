"use strict";

/**
 * Command grab — flag + tuning invariants.
 *
 * The harness calls beginCommandGrab / updateCommandGrab directly, so the rest of
 * the suite would pass even if the flag were accidentally shipped OFF. This file
 * pins the flag and the relationships between constants that the design actually
 * depends on, so a well-meaning tuning pass can't quietly break a rule.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CMD_GRAB_VARIANT,
  CMD_GRAB_VARIANT_PREBUFFER_MS,
  CMD_GRAB_CONNECT_STARTUP_MS,
  CMD_DRIVE_CARRY_MS,
  CMD_DRIVE_DISTANCE_MIN,
  CMD_DRIVE_DISTANCE_MAX,
  CMD_DRIVE_EDGE_FORCE_OUT_FRACTION,
  CMD_DRIVE_CINCH_FRACTION,
  CMD_DRIVE_RELEASE_SEPARATION,
  CMD_DRIVE_ATTACKER_RECOVERY_MS,
  CMD_DRIVE_DEFENDER_RECOVERY_MS,
  CMD_THROW_RECOVERY_TAIL_MS,
  CMD_PULL_RECOVERY_TAIL_MS,
  CMD_DRIVE_POSTURE_CHIP,
  CMD_GRAB_CONNECT_HITSTOP_MS,
  CMD_THROW_LAUNCH_HITSTOP_MS,
  CMD_PULL_LAUNCH_HITSTOP_MS,
  CMD_GRAB_CINCH_GRABBER_SHARE,
  CLINCH_PULL_INPUT_LOCK_MS,
  CLINCH_THROW_DURATION_MIN_MS,
  HITSTOP_GRAB_MS,
  HITSTOP_THROW_MS,
  GRAB_RANGE,
  GRAB_STARTUP_MS,
  SLAP_STARTUP_MS,
  CLINCH_THROW_KILL_THRESHOLD,
  BALANCE_MAX,
} = require("../../constants");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../../gameUtils");

test("command grab defaults", async (t) => {
  await t.test("the legacy clinch subgame is gone, not dormant", () => {
    // The command grab shipped behind a migration flag with the old clinch still
    // present as a fallback. Both are now deleted; this guards against either
    // creeping back as a second, dormant grab system.
    const fs = require("fs");
    const path = require("path");
    const root = path.join(__dirname, "../..");
    for (const gone of ["grabActionSystem.js", "commandGrabFlags.js"]) {
      assert.equal(
        fs.existsSync(path.join(root, gone)),
        false,
        `${gone} must stay deleted`
      );
    }
  });

  await t.test("exactly three variants", () => {
    assert.deepEqual(Object.keys(CMD_GRAB_VARIANT).sort(), [
      "DRIVE",
      "PULL",
      "THROW",
    ]);
  });

  await t.test("release separation clears grab range", () => {
    assert.ok(
      CMD_DRIVE_RELEASE_SEPARATION > GRAB_RANGE,
      "the anti-loop valve is distance: a Drive release must not leave a free re-grab"
    );
  });

  await t.test("attacker is negative after a Drive, past a jab startup", () => {
    const deficit =
      CMD_DRIVE_ATTACKER_RECOVERY_MS - CMD_DRIVE_DEFENDER_RECOVERY_MS;
    assert.ok(deficit > 0, "landing a Drive must not also hand over frame advantage");
    assert.ok(
      deficit >= SLAP_STARTUP_MS,
      "the deficit should be enough that a jab would win the exchange in range"
    );
    assert.ok(
      deficit < GRAB_STARTUP_MS,
      "but not so large that the defender gets a guaranteed grab of their own"
    );
  });

  await t.test("conversions commit far harder than the Drive", () => {
    // Compared as TOTAL commitment from resolution, because the throw/pull numbers
    // are tails on top of their own travel, not standalone windows. The relative
    // order of Pull vs Throw is a tuning detail; what must hold is that Drive is
    // the safe pressure tool and both conversions spend your turn.
    const driveTotal = CMD_DRIVE_ATTACKER_RECOVERY_MS;
    const pullTotal = CLINCH_PULL_INPUT_LOCK_MS + CMD_PULL_RECOVERY_TAIL_MS;
    const throwTotal = CLINCH_THROW_DURATION_MIN_MS + CMD_THROW_RECOVERY_TAIL_MS;
    assert.ok(
      pullTotal > driveTotal * 2,
      `Pull should cost far more than a Drive, got ${pullTotal} vs ${driveTotal}`
    );
    assert.ok(
      throwTotal > driveTotal * 2,
      `Throw should cost far more than a Drive, got ${throwTotal} vs ${driveTotal}`
    );
  });

  await t.test("recovery tails do not double-bill the travel they follow", () => {
    // Regression: these used to be stacked on top of the full arc/tween, so landing
    // a throw locked the attacker for nearly a second.
    assert.ok(
      CMD_THROW_RECOVERY_TAIL_MS < CLINCH_THROW_DURATION_MIN_MS / 2,
      "the throw tail must be a tail, not a second commitment"
    );
    assert.ok(
      CMD_PULL_RECOVERY_TAIL_MS < CLINCH_PULL_INPUT_LOCK_MS / 2,
      "the pull tail must be a tail, not a second commitment"
    );
  });

  await t.test("connect freeze is extra weight on top of the shared grab latch", () => {
    // Every grab already gets HITSTOP_GRAB_MS from the shared connect path, so these
    // are additive. Drive adds nothing — it must start moving — while the two
    // committed conversions get a heavier landing than a plain grab.
    const { drive, pull, throw: thr } = CMD_GRAB_CONNECT_HITSTOP_MS;
    assert.equal(drive, 0, "a shove cannot afford a freeze before it starts");
    assert.ok(
      HITSTOP_GRAB_MS + pull > HITSTOP_GRAB_MS,
      "pull should land heavier than a plain latch"
    );
    assert.ok(thr > pull, "the throw should be the heaviest connect of the three");
  });

  await t.test("only the throw gets a launch freeze", () => {
    // Drive and Pull are continuous motions (a shove, a yank). Freezing them reads
    // as a hitch rather than as weight, so the beat is reserved for the throw.
    assert.equal(
      CMD_PULL_LAUNCH_HITSTOP_MS,
      0,
      "a mid-yank freeze reads as a hitch"
    );
    assert.ok(
      CMD_THROW_LAUNCH_HITSTOP_MS > HITSTOP_THROW_MS,
      "the throw is the finisher — its launch should land heavier than an ordinary throw"
    );
  });

  await t.test("the grabber closes most of the connect gap, not the victim", () => {
    assert.ok(
      CMD_GRAB_CINCH_GRABBER_SHARE > 0.5,
      "otherwise a max-range connect reads as teleporting the opponent into your hands"
    );
    assert.ok(
      CMD_GRAB_CINCH_GRABBER_SHARE < 1,
      "some victim movement keeps it reading as a collision rather than a snap"
    );
  });

  await t.test("the tawara gate demands a real slice of the carry", () => {
    // Expressed as remaining DISTANCE, not remaining time: the eased carry spends
    // most of its distance early, so a time budget let almost any rope contact
    // force out. Too low here and the tawara becomes an auto-win again.
    assert.ok(
      CMD_DRIVE_EDGE_FORCE_OUT_FRACTION >= 0.25,
      "below ~25% owed, reaching the rope at all is effectively a free win"
    );
    assert.ok(
      CMD_DRIVE_EDGE_FORCE_OUT_FRACTION < 0.75,
      "above ~75% owed the force-out would be nearly unreachable"
    );
  });

  await t.test("a full-posture force-out demands edge-zone positioning", () => {
    // The distance the victim may be from the rope and still be forced out.
    const reach = CMD_DRIVE_DISTANCE_MIN * (1 - CMD_DRIVE_EDGE_FORCE_OUT_FRACTION);
    assert.ok(
      reach < 70,
      `a healthy opponent should have to be inside the danger zone already, got ${reach}px`
    );
  });

  await t.test("variant window is more generous than the old chord window", () => {
    const total = CMD_GRAB_VARIANT_PREBUFFER_MS + GRAB_STARTUP_MS;
    assert.ok(
      total > 220,
      `total selection tolerance ${total}ms should beat the 220ms chord window it replaces`
    );
  });

  await t.test("read beats are per-variant, and the Drive has none", () => {
    const { drive, pull, throw: thr } = CMD_GRAB_CONNECT_STARTUP_MS;
    assert.equal(
      drive,
      0,
      "a pause before a shove reads as a hitch, and would flatten approach-speed scaling later"
    );
    assert.ok(pull > 0 && pull < thr, "pull gets a short look, throw the longest");
    assert.ok(
      thr < 220,
      "with no Brace to host, the old 220ms technique tell would be dead air"
    );
  });

  await t.test("Drive's grip closes within its own carry", () => {
    assert.ok(
      CMD_DRIVE_CINCH_FRACTION > 0 && CMD_DRIVE_CINCH_FRACTION < 0.6,
      "the grip should close early in the carry, not drag on through it"
    );
  });

  await t.test("max carry is a meaningful but not decisive slice of the ring", () => {
    const ringWidth = MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY;
    assert.ok(CMD_DRIVE_DISTANCE_MAX / ringWidth > 0.25, "must be a real threat");
    assert.ok(
      CMD_DRIVE_DISTANCE_MAX / ringWidth < 0.5,
      "a single Drive from centre must not reach the rope on its own"
    );
    assert.ok(CMD_DRIVE_DISTANCE_MIN < CMD_DRIVE_DISTANCE_MAX);
  });

  await t.test("a Drive cannot solo-kill a healthy opponent", () => {
    const chipsToLethal = Math.ceil(
      (BALANCE_MAX - CLINCH_THROW_KILL_THRESHOLD) / CMD_DRIVE_POSTURE_CHIP
    );
    assert.ok(
      chipsToLethal >= 5,
      `grabs ladder toward lethality (${chipsToLethal} chips) — strikes stay the posture engine`
    );
  });
});
