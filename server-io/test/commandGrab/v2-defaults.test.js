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
  CMD_GRAB_KILL_CONNECT_STARTUP_MS,
  CMD_DRIVE_CARRY_MS,
  CMD_DRIVE_DISTANCE_MIN,
  CMD_DRIVE_DISTANCE_MAX,
  CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC,
  CMD_DRIVE_CINCH_FRACTION,
  CMD_DRIVE_RELEASE_SEPARATION,
  CMD_DRIVE_ATTACKER_RECOVERY_MS,
  CMD_DRIVE_DEFENDER_RECOVERY_MS,
  CMD_THROW_RECOVERY_TAIL_MS,
  CMD_PULL_RECOVERY_TAIL_MS,
  CMD_PULL_INPUT_LOCK_MS,
  CMD_PULL_TWEEN_MS,
  CMD_DRIVE_POSTURE_CHIP,
  CMD_GRAB_CONNECT_HITSTOP_MS,
  CMD_THROW_LAUNCH_HITSTOP_MS,
  CMD_PULL_LAUNCH_HITSTOP_MS,
  CMD_GRAB_CINCH_GRABBER_SHARE,
  CMD_GRAB_CINCH_MS,
  CLINCH_THROW_DURATION_MIN_MS,
  HITSTOP_GRAB_MS,
  HITSTOP_THROW_MS,
  GRAB_RANGE,
  GRAB_STARTUP_MS,
  GRAB_ACTIVE_MS,
  HITBOX_DISTANCE_VALUE,
  SLAP_STARTUP_MS,
  CLINCH_THROW_KILL_THRESHOLD,
  BALANCE_MAX,
  DELTA_TRACKED_PROPS,
} = require("../../constants");
const { getConnectDistance } = require("../../strikeContact");
const { getGrabThreatTravel, getGrabConnectDistance } = require("../../combatHelpers");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../../gameUtils");
const { profileFor } = require("../../momentumTransfer");

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

  await t.test("grab out-reaches the jab by a band you can stand in", () => {
    // The load-bearing relationship of the entire move, and the one that is easiest
    // to destroy by accident from the slap side of the ledger.
    //
    // The dive may START from far (lunge). The LATCH must sit inside slap
    // tip — otherwise the 175 vacuum grabs you before a tip poke can clang,
    // and two slaps are arithmetically impossible. At the old GRAB_RANGE of
    // 146 this *attempt* band was 3.6px wide; that number is not the latch.
    assert.ok(
      GRAB_ACTIVE_MS >= 650,
      `running-grab active ${GRAB_ACTIVE_MS}ms must last long enough to see and walk out`
    );
    const dummy = (id) => ({ id, x: 0, facing: -1, sizeMultiplier: 1 });
    const slapConnect = getConnectDistance("slap", dummy("a"), dummy("b"));
    const latch = getGrabConnectDistance(dummy("a"), dummy("b"));
    assert.ok(
      latch < slapConnect - 8,
      `grab latch ${latch.toFixed(1)} must sit inside slap tip ${slapConnect.toFixed(1)} ` +
        `or a tip poke can never land before the dive connects`
    );
    const band = GRAB_RANGE - slapConnect;

    assert.ok(
      band >= HITBOX_DISTANCE_VALUE * 0.4,
      `grab must out-reach the slap by a visible margin — got ${band.toFixed(1)}px ` +
        `(grab ${GRAB_RANGE} vs slap ${slapConnect.toFixed(1)}). Below ~26px there ` +
        `is no spacing a player can hold, and the grab loses its only safe opening.`
    );

    // Upper bound, so "give it reach" can't drift into "grab is a projectile".
    //
    // Threat is latch (pushbox-touch) plus how far the dive carries WHILE IT
    // CAN STILL CATCH. Not GRAB_RANGE — that is attempt/release daylight, not
    // arm length — and not the recovery skid.
    const ringWidth = MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY;
    const threatTravel = getGrabThreatTravel();
    const threat = latch + threatTravel;
    // A 1-second run covers real ground. It must not fullscreen the ring
    // from the far corner — walk-out still has to work.
    assert.ok(
      threat < ringWidth * 0.8,
      `grab threat range ${threat.toFixed(1)} must stay under 80% of the ` +
        `${ringWidth}px ring — beyond that it covers the whole dohyo`
    );
    assert.ok(
      threatTravel > 200,
      `the run must cover real ice while hot, got ${threatTravel.toFixed(1)}px`
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
    // Drive recovery is a post-release window. Throw still pays a tail on top
    // of the arc. Pull's commitment IS the yank — it settles +0, like a slap.
    const driveTotal = CMD_DRIVE_ATTACKER_RECOVERY_MS;
    const throwTotal = CLINCH_THROW_DURATION_MIN_MS + CMD_THROW_RECOVERY_TAIL_MS;
    assert.ok(
      CMD_PULL_TWEEN_MS > driveTotal,
      `the yank itself must still be a real commitment, got ${CMD_PULL_TWEEN_MS} vs ${driveTotal}`
    );
    assert.ok(
      throwTotal > driveTotal * 2,
      `Throw should cost far more than a Drive, got ${throwTotal} vs ${driveTotal}`
    );
  });

  await t.test("Pull settles +0 — the yank is the lock, not a second window", () => {
    assert.equal(
      CMD_PULL_INPUT_LOCK_MS,
      CMD_PULL_TWEEN_MS,
      "input lock must die with the yank, or the puller is still jailed when the victim is free"
    );
    assert.equal(
      CMD_PULL_RECOVERY_TAIL_MS,
      0,
      "a leftover attacker tail is a punish for landing a grab in pocket"
    );
  });

  await t.test("recovery tails do not double-bill the travel they follow", () => {
    // Regression: these used to be stacked on top of the full arc/tween, so landing
    // a throw locked the attacker for nearly a second.
    assert.ok(
      CMD_THROW_RECOVERY_TAIL_MS < CLINCH_THROW_DURATION_MIN_MS / 2,
      "the throw tail must be a tail, not a second commitment"
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

  await t.test("drive edge KO is stamina-taxed, not carry-fraction gated", () => {
    // Carry-fraction auto-KO is retired. The clamp burns stamina hard so an
    // ungassed pin can still convert if the tank empties mid-shove.
    assert.ok(
      CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC >= 40,
      "edge stamina drain must be a real grind station"
    );
    assert.ok(
      CMD_DRIVE_EDGE_STAMINA_DRAIN_PER_SEC <= 120,
      "edge drain should not empty a full tank in a single short pin"
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
    const kill = CMD_GRAB_KILL_CONNECT_STARTUP_MS;
    assert.equal(
      drive,
      0,
      "a pause before a shove reads as a hitch, and would flatten approach-speed scaling later"
    );
    assert.ok(pull > 0 && pull < thr, "pull gets a short look, throw the longest");
    assert.ok(
      pull >= 160 && pull <= 280,
      `pull tell ${pull}ms must be a tug, not a pose hold`
    );
    assert.ok(
      thr >= 220 && thr < 400,
      `throw tell ${thr}ms must be a readable windup, not a cutscene`
    );
    assert.ok(kill.drive === 0, "a lethal drive still starts moving immediately");
    assert.ok(
      kill.pull > pull && kill.throw > thr,
      "kill grabs hold longer so the finisher reads before travel"
    );
    assert.ok(kill.pull < kill.throw, "kill throw remains the longest look");
    assert.ok(
      CMD_GRAB_CINCH_MS < pull,
      `cinch ${CMD_GRAB_CINCH_MS}ms must finish before the shortest tell, or the pair drifts together through the windup`
    );
  });

  await t.test("tell duration rides the delta wire", () => {
    assert.ok(
      DELTA_TRACKED_PROPS.includes("clinchThrowAnimMs"),
      "stamping clinchThrowAnimMs does nothing if the client never receives it"
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

  await t.test("Pull stays a pocket side-switch; Matador is the dump", () => {
    const pull = profileFor("pull");
    const matador = profileFor("matador");
    assert.ok(
      pull.ceil < GRAB_RANGE,
      `belt tug ceil ${pull.ceil} must stay inside grab range ${GRAB_RANGE} — swap the pocket, don't reset`
    );
    assert.ok(
      pull.ceil - pull.floor <= 50,
      "pull's posture band is a tug, not a launch curve"
    );
    assert.ok(
      matador.floor > pull.ceil,
      "even a standing-grab matador must out-send the biggest belt tug"
    );
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
