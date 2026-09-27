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
  CMD_PULL_TWEEN_MIN_MS,
  CMD_PULL_TWEEN_BROKEN_MS,
  CMD_PULL_TWEEN_MAX_MS,
  CMD_PULL_DISTANCE_MIN,
  CMD_PULL_DISTANCE_MAX,
  CMD_DRIVE_POSTURE_CHIP,
  CMD_GRAB_CONNECT_HITSTOP_MS,
  CMD_THROW_LAUNCH_HITSTOP_MS,
  CMD_PULL_LAUNCH_HITSTOP_MS,
  CMD_GRAB_CINCH_GRABBER_SHARE,
  CMD_GRAB_CINCH_MS,
  CLINCH_THROW_DURATION_MIN_MS,
  SETUP_THROW_DURATION_MS,
  SETUP_THROW_CHASE_LOCK_MS,
  SETUP_THROW_SLAP_TIP_GAP_PX,
  SETUP_THROW_PUSHBOX_GAP_PX,
  SETUP_THROW_CHASE_ARRIVE_GAP_PX,
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

  await t.test("Throw is a setup — victim dump clock, thrower chases after the toss pose", () => {
    const driveTotal = CMD_DRIVE_ATTACKER_RECOVERY_MS;
    assert.equal(
      CMD_THROW_RECOVERY_TAIL_MS,
      0,
      "the thrower chases; a leftover tail would eat the slide"
    );
    assert.ok(
      CMD_PULL_TWEEN_MS > driveTotal,
      `the yank itself must still be a real commitment, got ${CMD_PULL_TWEEN_MS} vs ${driveTotal}`
    );
    assert.ok(
      CLINCH_THROW_DURATION_MIN_MS > driveTotal,
      `the victim dump must outlast Drive recovery so throw → slide can arrive, got ${CLINCH_THROW_DURATION_MIN_MS} vs ${driveTotal}`
    );
    assert.ok(
      SETUP_THROW_CHASE_LOCK_MS > 0 &&
        SETUP_THROW_CHASE_LOCK_MS < SETUP_THROW_DURATION_MS,
      "toss pose holds, then a chase window remains before they land"
    );
    assert.ok(
      SETUP_THROW_CHASE_ARRIVE_GAP_PX > SETUP_THROW_PUSHBOX_GAP_PX &&
        SETUP_THROW_CHASE_ARRIVE_GAP_PX < SETUP_THROW_SLAP_TIP_GAP_PX,
      "authored arrive gap is the meaty pocket between pushbox and slap tip"
    );
  });

  await t.test("far pulls buy a heavier readable yank, not a faster fling", () => {
    assert.equal(CMD_PULL_TWEEN_MS, CMD_PULL_TWEEN_MIN_MS);
    assert.ok(
      CMD_PULL_TWEEN_BROKEN_MS > CMD_PULL_TWEEN_MIN_MS,
      "broken posture must take longer to read — it's a heavy penguin"
    );
    assert.ok(
      CMD_PULL_TWEEN_BROKEN_MS <= 520,
      "but not so long it becomes a crawl"
    );
    const distRatio = CMD_PULL_DISTANCE_MAX / CMD_PULL_DISTANCE_MIN;
    assert.ok(
      distRatio > 2,
      `extra travel is still Smash-visible: dist ${distRatio.toFixed(2)}`
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

  await t.test("connect freeze is shared — no per-variant extra on the latch", () => {
    const { drive, pull, throw: thr } = CMD_GRAB_CONNECT_HITSTOP_MS;
    assert.equal(drive, 0);
    assert.equal(pull, 0);
    assert.equal(thr, 0);
    assert.ok(HITSTOP_GRAB_MS > 0, "the handshake still thunks");
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

  await t.test("latch is a shared grip for every verb", () => {
    const {
      CMD_GRAB_LATCH_MS,
      CMD_GRAB_LATCH_MIN_COMMIT_MS,
    } = require("../../constants");
    assert.ok(
      CMD_GRAB_LATCH_MS >= 320 && CMD_GRAB_LATCH_MS <= 560,
      `latch ${CMD_GRAB_LATCH_MS}ms must read as a belt grip, not a pause or a cutscene`
    );
    assert.equal(
      CMD_GRAB_LATCH_MIN_COMMIT_MS,
      CMD_GRAB_LATCH_MS,
      "pull and throw wait out the same grip as drive"
    );
    assert.ok(
      CMD_GRAB_CINCH_MS < CMD_GRAB_LATCH_MS,
      `cinch ${CMD_GRAB_CINCH_MS}ms must finish inside the grip`
    );
    const { drive, pull, throw: thr } = CMD_GRAB_CONNECT_STARTUP_MS;
    assert.equal(drive, pull);
    assert.equal(pull, thr);
    assert.equal(drive, CMD_GRAB_LATCH_MS);
  });

  await t.test("tell duration rides the delta wire", () => {
    assert.ok(
      DELTA_TRACKED_PROPS.includes("clinchThrowAnimMs"),
      "stamping clinchThrowAnimMs does nothing if the client never receives it"
    );
    assert.ok(
      DELTA_TRACKED_PROPS.includes("pullYankPower"),
      "client hop dust / squash need pullYankPower on the wire"
    );
    assert.ok(
      DELTA_TRACKED_PROPS.includes("throwTossPower"),
      "client throw squash / smear need throwTossPower on the wire"
    );
    assert.ok(
      DELTA_TRACKED_PROPS.includes("throwTossDurationMs"),
      "throw squash must use the live toss duration"
    );
    assert.ok(
      DELTA_TRACKED_PROPS.includes("throwSetupChase"),
      "chase pose / slide unlock must ride the wire"
    );
    assert.ok(
      DELTA_TRACKED_PROPS.includes("throwRicochet"),
      "tawara bounce must be visible to the client"
    );
    assert.ok(
      DELTA_TRACKED_PROPS.includes("grabBreakSepDuration"),
      "hop dust must use the live yank duration, not a hardcoded 650"
    );
    assert.ok(
      DELTA_TRACKED_PROPS.includes("grabBreakSepCurve"),
      "healthy yanks are power 0 — the curve flag is how the client knows it's weighted"
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

  await t.test("Pull posture band is Smash-visible; Matador is still the dump", () => {
    const pull = profileFor("pull");
    const matador = profileFor("matador");
    const ringWidth = MAP_RIGHT_BOUNDARY - MAP_LEFT_BOUNDARY;
    assert.ok(
      pull.ceil - pull.floor >= 120,
      `pull's posture swing must be obvious, got ${pull.ceil - pull.floor}`
    );
    assert.ok(
      pull.ceil < ringWidth / 2,
      `max pull ${pull.ceil} must not solo-kill from centre`
    );
    assert.ok(
      matador.floor > pull.floor,
      "a standing matador still out-sends a full-posture belt tug"
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
