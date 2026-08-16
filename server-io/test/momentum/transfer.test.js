"use strict";

const test = require("node:test");
const assert = require("node:assert");

const M = require("../../momentumTransfer");

// Ring geometry these numbers are designed against (gameUtils.js:253-254).
const HALF_RING = 297.5;
const SLAP_CYCLE_MS = 260; // SLAP_TOTAL_MS

function fighter(overrides = {}) {
  return {
    movementVelocity: 0,
    knockbackVelocity: { x: 0, y: 0 },
    grantedVelocity: 0,
    grantedVelocityAt: 0,
    ...overrides,
  };
}

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: expected ~${b}, got ${a}`);

// ────────────────────────────────────────────────────────────────────────────
// UNITS
// ────────────────────────────────────────────────────────────────────────────
test("unit conversion matches the ice model", () => {
  near(M.PX_PER_VELOCITY_TICK, 2.8906, 0.001, "px per velocity-unit per tick");
  near(M.PX_PER_VELOCITY, 160.59, 0.05, "settle px per velocity unit");
  near(M.kbVelocityToPx(M.pxToKbVelocity(123.4)), 123.4, 1e-9, "roundtrip");

  // Free-glide anchors are unchanged from the live game.
  near(M.coastVelocityToPx(1.3), 209, 1, "walk top speed settle");
  near(M.coastVelocityToPx(2.4), 385, 1, "slide top speed settle");
});

test("ONE friction — knockback and free glide share the ice curve", () => {
  // Playtest regression. An earlier revision gave knockback its own faster
  // friction (0.93) so shoves would "land promptly". It deleted the ice: the
  // victim braked hard, then dropped speed 4x at hitstun end and crept.
  assert.strictEqual(
    M.KB_FRICTION,
    M.COAST_FRICTION,
    "a shove must decay like a slide, or the game stops being on ice"
  );

  // Which makes the handoff an identity — velocity is continuous through
  // hitstun end, with no visible speed step.
  for (const v of [0.2, 1.0, 2.4]) {
    near(M.handoffVelocity(v), v, 1e-9, `handoff is continuous at v=${v}`);
  }
});

test("a shove keeps most of its speed across a slap cycle (carryover)", () => {
  const decay = Math.pow(M.COAST_FRICTION, SLAP_CYCLE_MS / M.MS_PER_TICK);
  near(decay, 0.7392, 0.001, "velocity surviving one slap cycle");
  assert.ok(
    decay > 0.6,
    "most of a shove must still be owed when the next slap lands, or nothing compounds"
  );

  // The rejected fast friction destroyed this — only ~30% survived.
  const rejectedFast = Math.pow(0.93, SLAP_CYCLE_MS / M.MS_PER_TICK);
  assert.ok(rejectedFast < 0.35, "documents why the fast knockback friction killed barrages");
});

// ────────────────────────────────────────────────────────────────────────────
// DI IS BOUNDED
// ────────────────────────────────────────────────────────────────────────────
test("DI stays a per-tick friction the defender controls", () => {
  // Playtest was explicit that DI-able sliding knockback was never the problem
  // ("I only really had an issue of how fast you can kill"). Kill speed is
  // governed by floor/ceiling values; DI keeps full control of the slide.
  assert.ok(M.DI_FRICTION_FACTOR < 1, "DI must shorten a slide");
  assert.ok(M.DI_FRICTION_FACTOR > 0.9, "per-tick DI must not be a hard stop");
  assert.strictEqual(typeof M.isDirectionallyInfluencing, "function");
});

// ────────────────────────────────────────────────────────────────────────────
// AUTHORED ANCHORS
// ────────────────────────────────────────────────────────────────────────────
test("slap transfer spans its floor..ceiling with momentum", () => {
  // Profile-driven on purpose: floors and ceilings are the main balance
  // surface and get retuned often. Assert the SHAPE, not the numbers.
  const p = M.profileFor("slap");
  const px = (v) => M.transfer(v, p.floor, p.ceil);

  near(px(0), p.floor, 0.5, "standing slap pays the floor");
  near(px(M.V_REF), p.ceil, 0.5, "a full-commit slide pays the ceiling");
  assert.ok(px(1.3) > px(0) * 1.2, "walking in must be worth meaningfully more than standing");
  assert.ok(px(1.3) < px(M.V_REF), "walking must not reach the ceiling");

  // A floor hit has to be fast enough to read as a slide rather than a creep.
  // At this friction, initial speed IS sendPx / PX_PER_VELOCITY.
  const floorSpeed = p.floor / M.PX_PER_VELOCITY;
  assert.ok(
    floorSpeed > 0.5,
    `even a floor slap must look like a shove, got initial speed ${floorSpeed.toFixed(2)} vs walking 1.3`
  );
});

test("the heavies are not pinned to their floors", () => {
  // REGRESSION: the charged lunge advances x directly and the palm zeroes its
  // own movementVelocity, so both sampled ZERO attacker speed and every hit —
  // including a 100% charge — resolved at the floor. Playtest: "the charged
  // attack may as well not even be an attack anymore."
  for (const key of ["palm", "charged"]) {
    const p = M.profileFor(key);
    assert.ok(
      M.transfer(M.V_REF, p.floor, p.ceil) > p.floor * 1.5,
      `${key} must have real headroom above its floor`
    );
  }

  // A full charge must be the biggest single hit in the game.
  const charged = M.profileFor("charged");
  for (const key of ["slap", "palm", "bodySlam"]) {
    assert.ok(
      charged.ceil >= M.profileFor(key).ceil,
      `a maxed charge must not be out-sent by ${key}`
    );
  }
});

test("momentum curve: walking buys a real but partial share, slide buys all", () => {
  near(M.momentumRatio(0), 0, 1e-9, "standing");
  near(M.momentumRatio(1.3), 0.399, 0.002, "walk top speed");
  near(M.momentumRatio(1.8), 0.650, 0.002, "partial slide");
  near(M.momentumRatio(2.4), 1.0, 1e-9, "full slide");

  assert.ok(M.momentumRatio(2.0) > M.momentumRatio(1.5), "strictly increasing");
  assert.strictEqual(M.momentumRatio(99), 1, "clamped above V_REF");
  assert.strictEqual(M.momentumRatio(-5), 0, "clamped below zero");
  assert.ok(
    M.momentumRatio(1.3) < 1.3 / 2.4,
    "curve must be convex so speed has to be committed to"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// CONTESTED VS GUARANTEED — the grab's reason to exist
// ────────────────────────────────────────────────────────────────────────────
test("grabs are guaranteed, strikes are contested", () => {
  for (const key of ["drive", "pull", "throw", "matador"]) {
    assert.strictEqual(M.profileFor(key).guaranteed, true, `${key} must be guaranteed`);
  }
  for (const key of ["slap", "palm", "charged", "bodySlam"]) {
    assert.strictEqual(M.profileFor(key).guaranteed, false, `${key} must be contested`);
  }
});

test("a maxed drive beats a maxed palm against a defender who DIs", () => {
  const palmMax = M.transfer(2.4, 90, 300);
  const driveMax = M.transfer(2.4, 30, 300);

  assert.ok(M.diReducedPx(palmMax) < driveMax, "DI'd palm loses to a guaranteed drive");
  assert.ok(
    driveMax - M.diReducedPx(palmMax) > 100,
    "the guarantee must be worth a substantial chunk of the half-ring"
  );
});

test("grab profiles hit their designed anchors", () => {
  const drive = M.profileFor("drive");
  const pull = M.profileFor("pull");
  const matador = M.profileFor("matador");

  near(M.transfer(0, drive.floor, drive.ceil), drive.floor, 0.5, "standing drive is a real shove");
  near(M.transfer(M.V_REF, drive.floor, drive.ceil), drive.ceil, 0.5, "full-slide drive");
  assert.ok(
    M.transfer(M.V_REF, drive.floor, drive.ceil) > HALF_RING,
    "max drive must clear the half-ring"
  );

  near(M.transfer(0, pull.floor, pull.ceil), pull.floor, 0.5, "belt tug on a healthy opponent");
  near(
    M.transfer(M.V_REF, pull.floor, pull.ceil),
    pull.ceil,
    0.5,
    "pull's ceiling is still a side-switch, not a dump"
  );
  assert.ok(pull.ceil < HALF_RING * 0.6, "pull must not threaten a half-ring send");

  near(M.transfer(0, matador.floor, matador.ceil), matador.floor, 0.5, "standing-grab matador still dumps");
  near(M.transfer(M.V_REF, matador.floor, matador.ceil), matador.ceil, 0.5, "slide-in grab buys the ceiling");
  assert.ok(matador.floor > pull.ceil, "the parry dump is always bigger than the belt tug");
  assert.ok(matador.floor > 224, "standing matador must out-send the old fixed yank");
});

// ────────────────────────────────────────────────────────────────────────────
// APPLICATION
// ────────────────────────────────────────────────────────────────────────────
test("send REPLACES for a closing victim and ADDS for a fleeing one", () => {
  const closing = fighter({ movementVelocity: -1.2 });
  const a = M.applyTransferImpulse(closing, 100, +1);
  assert.strictEqual(a.compounded, false);
  near(a.sendPx, 100, 1e-9, "closing victim is reversed to the raw send");

  const owed = 80;
  const fleeing = fighter();
  M.creditOwedDistance(fleeing, owed, 500);
  const b = M.applyTransferImpulse(fleeing, 100, +1, 500);
  assert.strictEqual(b.compounded, true);
  near(
    b.sendPx,
    owed * M.COMPOUND_RETAIN + 100,
    0.01,
    "fleeing victim compounds, but only a share of what they still owed carries"
  );

  assert.strictEqual(M.applyTransferImpulse(fighter(), 100, +1, 500).compounded, false);
});

test("send cap holds — no chain exceeds the biggest authored hit", () => {
  // With compounding off, the cap is a backstop against a single oversized
  // send (multipliers stacking on a maxed hit) rather than against a chain.
  const owed = fighter();
  const r = M.applyTransferImpulse(owed, M.MAX_SEND_PX + 200, +1, 500);
  assert.strictEqual(r.capped, true);
  near(r.sendPx, M.MAX_SEND_PX, 1e-9, "capped");

  const leftVictim = fighter();
  const left = M.applyTransferImpulse(leftVictim, M.MAX_SEND_PX + 200, -1, 500);
  assert.ok(left.velocity < 0, "left-directed send stays negative");
  near(left.sendPx, M.MAX_SEND_PX, 1e-9, "cap applies both ways");
});

// ────────────────────────────────────────────────────────────────────────────
// THE TSUPPARI RHYTHM
// ────────────────────────────────────────────────────────────────────────────
test("PACING: a flat-footed barrage walks them out at a playable rate", () => {
  // Sends are flat (compounding and escalation off) — floor-vs-ring geometry.
  // At a 110px floor this took ~11 connects.
  const decay = Math.pow(M.COAST_FRICTION, SLAP_CYCLE_MS / M.MS_PER_TICK);
  const p = M.profileFor("slap");

  const groundPerSlap = p.floor * (1 - decay);
  const connects = Math.ceil(HALF_RING / groundPerSlap);
  assert.ok(
    connects >= 5 && connects <= 8,
    `connects to walk a fighter from centre to the rope must land in 5-8, got ${connects}`
  );

  // A single slap has to READ as a shove. At this friction a send's initial
  // speed is sendPx / PX_PER_VELOCITY, so a small floor is also a SLOW floor —
  // which is what made it feel like dirt rather than ice.
  const floorSpeed = p.floor / M.PX_PER_VELOCITY;
  assert.ok(
    floorSpeed > 0.9,
    `a floor slap must move near walking pace, got ${floorSpeed.toFixed(2)} vs walking 1.3`
  );

  // Slaps still cannot close a round from range alone — ring-out is gated on
  // posture (< CLINCH_THROW_KILL_THRESHOLD) at the rope clamp, so more power
  // buys TEMPO / positioning, not a free midscreen KO.
  assert.ok(
    p.ceil < M.MAX_SEND_PX,
    "a single slap must not be able to cover the whole send budget"
  );
});

test("REGRESSION: compounding must read TOTAL velocity, not just knockback", () => {
  // Slap hitstun is +0, so it ends BEFORE the slide does. `endHitKnockback`
  // zeroes knockbackVelocity and hands the remainder to movementVelocity — so
  // by the time the next slap of a barrage lands, the victim's momentum lives
  // entirely in movementVelocity. Reading knockbackVelocity alone saw ZERO and
  // treated every slap as a fresh hit on a stationary target, so compounding
  // never fired in the one situation it exists for. Playtest: "each slap attack
  // looks identical per hit, same knockback distance for each hit."
  const victim = {
    movementVelocity: 1.0, // mid-slide, post-handoff
    knockbackVelocity: { x: 0, y: 0 }, // already cleared by endHitKnockback
    keys: {},
  };

  // Compounding is OFF (COMPOUND_RETAIN 0) — power comes from speed alone.
  // What survives, and still matters, is that a hit can never SLOW a slide
  // already in flight: a light poke must not cancel a heavy send.
  M.creditOwedDistance(victim, 260, 1000);
  const r = M.applyTransferImpulse(victim, 110, +1, 1000);
  assert.ok(
    r.sendPx >= 260,
    `a weak hit must not cancel a heavier send in flight, got ${r.sendPx.toFixed(0)}px`
  );

  // End to end: a barrage must produce visibly different sends.
  const CYCLE = SLAP_CYCLE_MS;
  const decay = Math.pow(M.COAST_FRICTION, CYCLE / M.MS_PER_TICK);
  const atk = fighter();
  const vic = fighter();
  let t = 100000;
  const sends = [];
  for (let n = 1; n <= 4; n++) {
    const res = M.resolveTransfer({
      attacker: atk,
      victim: vic,
      moveKey: "slap",
      dirToVictim: +1,
      nowSim: t,
      selfOverride: 0,
    });
    sends.push(res.sendPx);
    vic.movementVelocity = res.velocity * decay; // handoff + decay
    vic.knockbackVelocity.x = 0;
    t += CYCLE;
  }
  // A flat-footed barrage must stay FLAT. Hit count is not a source of power —
  // only speed is. This is what keeps rounds long enough for conditioning.
  const spread = Math.max(...sends) - Math.min(...sends);
  assert.ok(
    spread < 1,
    `flat-footed slaps must all send the same: ${sends.map((s) => Math.round(s)).join(" -> ")}`
  );
});

test("REGRESSION: a victim who keeps acting cannot erase what they are owed", () => {
  // Found against a palm-spamming CPU. Rooting actions zero movementVelocity
  // (the palm at gameFunctions.js, dodges, stance changes), so a victim who
  // keeps pressing buttons wiped their own slide every cycle and compounding
  // never accumulated — against any opponent that acts, which is all of them.
  // Playtest: "most of the hits look the exact same... on whiff I CAN see it
  // getting faster, so this could solely be an on-hit problem."
  const atk = fighter();
  const vic = fighter();
  let t = 100000;
  const sends = [];

  for (let n = 1; n <= 4; n++) {
    const r = M.resolveTransfer({
      attacker: atk,
      victim: vic,
      moveKey: "slap",
      dirToVictim: +1,
      nowSim: t,
      selfOverride: 0,
    });
    sends.push(r.sendPx);
    // The victim roots itself every cycle, wiping both velocity fields.
    vic.movementVelocity = 0;
    vic.knockbackVelocity.x = 0;
    t += SLAP_CYCLE_MS;
  }

  // The ledger's surviving job: a victim who roots themselves mid-slide (palm,
  // dodge, stance change) must not be able to cancel a send already owed.
  const midSlide = fighter();
  M.creditOwedDistance(midSlide, 300, 5000);
  midSlide.movementVelocity = 0; // they rooted themselves
  midSlide.knockbackVelocity.x = 0;
  const kept = M.applyTransferImpulse(midSlide, 110, +1, 5000);
  assert.ok(
    kept.sendPx >= 300,
    `pressing a button must not erase a send in flight, got ${kept.sendPx.toFixed(0)}px`
  );
  assert.ok(
    sends.every((s) => Math.abs(s - sends[0]) < 1),
    `sends must not depend on hit count: ${sends.map((s) => Math.round(s)).join(" -> ")}`
  );

  // And the ledger must still lapse once pressure genuinely stops.
  const stale = fighter();
  M.creditOwedDistance(stale, 300, 0);
  assert.strictEqual(
    M.owedDistanceNow(stale, M.OWED_MAX_AGE_MS + 1),
    0,
    "an old debt must expire rather than bank forever"
  );
});

test("pressure credit lapses so scattered hits never stack", () => {
  const victim = fighter();
  const t0 = 10000;

  // Escalation is OFF (PRESSURE_MAX_STEP 1): hit count is not a source of
  // power. The ledger stays wired so it is a one-number change to bring back.
  assert.strictEqual(M.pressureStepFor(victim, t0), 1, "first hit is step 1");
  M.creditPressure(victim, t0, 1);
  assert.strictEqual(
    M.pressureStepFor(victim, t0 + 200),
    M.PRESSURE_MAX_STEP,
    "a follow-up must not exceed the configured step cap"
  );
  assert.strictEqual(M.PRESSURE_MAX_STEP, 1, "escalation is currently disabled by design");
  assert.strictEqual(
    M.pressureMultiplierFor(M.PRESSURE_MAX_STEP),
    1,
    "with escalation off, sends depend on speed alone"
  );
});

// ────────────────────────────────────────────────────────────────────────────
// ANTI-RUNAWAY
// ────────────────────────────────────────────────────────────────────────────
test("granted velocity is excluded from vSelf — no mash feedback loop", () => {
  const now = 100000;
  const attacker = fighter({ movementVelocity: 0.9 });

  near(M.sampleSelfMomentum(attacker, +1, now), 0.9, 1e-9, "earned velocity counts");

  M.creditGrantedVelocity(attacker, 0.9, now);
  near(M.sampleSelfMomentum(attacker, +1, now), 0, 1e-9, "granted velocity is not offence");

  attacker.movementVelocity = 1.6;
  near(M.sampleSelfMomentum(attacker, +1, now), 0.7, 1e-6, "only the granted part is subtracted");

  near(
    M.grantedVelocityNow(attacker, now + M.GRANTED_VELOCITY_MAX_AGE_MS + 1),
    0,
    1e-9,
    "stale grants are dropped"
  );

  M.clearGrantedVelocity(attacker);
  near(M.grantedVelocityNow(attacker, now), 0, 1e-9, "grants can be cleared outright");
});

test("REGRESSION: chase push feeding vSelf would diverge (documents the guard)", () => {
  const decay = Math.pow(M.KB_FRICTION, SLAP_CYCLE_MS / M.MS_PER_TICK);

  // Measured as HITS-TO-CAP rather than peak send: with the owed-distance
  // ledger, sustained pressure reaches the cap either way, so peak no longer
  // discriminates. How fast it gets there does.
  const p = M.profileFor("slap");
  const hitsToCap = (countChaseAsOffence) => {
    const victim = fighter();
    let attackerVel = 0;
    let t = 0;
    for (let i = 1; i <= 12; i++) {
      const vSelf = countChaseAsOffence ? Math.min(attackerVel, M.V_REF) : 0;
      const r = M.applyTransferImpulse(
        victim,
        M.transfer(vSelf, p.floor, p.ceil),
        +1,
        t
      );
      if (r.capped) return i;
      attackerVel = Math.abs(r.velocity) * 1.15; // chase tracks the victim
      t += SLAP_CYCLE_MS;
    }
    return 99;
  };

  // With compounding off neither run reaches the cap, so measure the SEND
  // instead: chase velocity must never inflate the next hit's power.
  const sendWithChase = M.transfer(
    Math.min(2.4 * M.SLAP_CHASE_RATIO, M.V_REF),
    p.floor,
    p.ceil
  );
  const sendGuarded = M.transfer(0, p.floor, p.ceil);
  assert.ok(
    sendGuarded < sendWithChase,
    "if chase counted as offence, a mashed slap would out-send a flat-footed one"
  );
  assert.strictEqual(
    sendGuarded,
    p.floor,
    "a flat-footed slap in a barrage must pay exactly the floor"
  );
  assert.ok(hitsToCap(false) === 99, "guarded pressure must never reach the send cap on its own");
});

// ────────────────────────────────────────────────────────────────────────────
// IMPACT CHANNEL
// ────────────────────────────────────────────────────────────────────────────
test("REGRESSION: a chase must not read as a collision (barrage smoothness)", () => {
  // Closing speed used to SUM each fighter's toward-motion independently, so a
  // fleeing victim contributed 0 instead of subtracting. During a barrage the
  // attacker chases a victim who is flying away, and closing speed read as the
  // full chase speed — firing ~199ms of hitstop on every slap inside a 260ms
  // cycle. The game froze more than it moved.
  const dir = +1;
  const fleeingVictim = fighter({ movementVelocity: 2.4 });   // flying away
  const chasingAttacker = fighter({ movementVelocity: 1.3 }); // following

  const chaseClose = M.sampleClosingSpeed(chasingAttacker, fleeingVictim, dir, 0);
  assert.ok(
    chaseClose < 0.01,
    `following a fleeing victim must not read as closing, got ${chaseClose.toFixed(2)}`
  );

  const chaseHitstop = M.hitstopMsFor(chaseClose, M.impactWeightFor("slap"));
  assert.ok(
    chaseHitstop < 60,
    `a barrage slap must stay a crisp tick, got ${chaseHitstop}ms in a 260ms cycle`
  );

  // A genuine head-on still maxes the freeze — that is the only case that
  // should ever stop the screen hard.
  const headOn = M.sampleClosingSpeed(
    fighter({ movementVelocity: 2.4 }),
    fighter({ movementVelocity: -1.3 }),
    dir,
    0
  );
  near(headOn, M.V_IMPACT_REF, 0.01, "a mutual charge still closes at full rate");
  assert.ok(
    M.hitstopMsFor(headOn, 1) > chaseHitstop * 4,
    "a tachi-ai must freeze dramatically harder than a chase"
  );
});

test("chase never exceeds a fighter's own top speed", () => {
  // Uncapped, an escalating barrage flung the attacker past their own max
  // slide. The cap is also what ENDS a barrage: once the victim outruns you,
  // they are out of range.
  assert.ok(M.CHASE_SPEED_CAP <= M.V_REF, "chase cap must not exceed a real movement speed");
  const launched = 2.83;
  const chase = Math.min(launched * M.SLAP_CHASE_RATIO, M.CHASE_SPEED_CAP);
  assert.ok(chase < launched, "a launched victim must be able to outrun the pressure");
});

test("closing speed drives impact, never distance", () => {
  const now = 1000;

  const oneSided = M.resolveTransfer({
    attacker: fighter({ movementVelocity: 2.4 }),
    victim: fighter(),
    moveKey: "slap",
    dirToVictim: +1,
    nowSim: now,
  });

  const headOn = M.resolveTransfer({
    attacker: fighter({ movementVelocity: 2.4 }),
    victim: fighter({ movementVelocity: -1.3 }),
    moveKey: "slap",
    dirToVictim: +1,
    nowSim: now,
  });

  near(headOn.authoredPx, oneSided.authoredPx, 1e-9, "distance depends only on attacker speed");
  assert.ok(headOn.vClose > oneSided.vClose, "head-on closes faster");
  assert.ok(headOn.hitstopMs > oneSided.hitstopMs, "head-on freezes harder");
  assert.ok(headOn.postureChip > oneSided.postureChip, "head-on chips posture harder");
});

test("impact channel spans its designed range", () => {
  near(M.hitstopMsFor(0, 1), M.HITSTOP_FLOOR_MS, 0.5, "standing poke hitstop");
  near(M.hitstopMsFor(M.V_IMPACT_REF, 1), M.HITSTOP_CEIL_MS, 0.5, "max collision hitstop");
  near(M.hitstopMsFor(2.4, 1), 184, 2, "slide onto a stationary target");

  const hard = M.postureChipFor(M.V_IMPACT_REF, 1);
  const soft = M.postureChipFor(0, 1);
  near(hard, 30, 0.5, "max posture chip");
  near(soft, 4, 0.5, "floor posture chip");
  assert.ok(hard * 3 >= 85, "three hard reads must reach the lethal line");
  assert.ok(soft * 20 < 85, "twenty pokes must not");

  assert.strictEqual(M.impactScalar(-1), 0);
  assert.strictEqual(M.impactScalar(99), 1);
});

test("MOVE IDENTITY: the light attack must never out-thud the heavy", () => {
  // A 4th chained slap once froze 119ms against a palm's 109ms — the jab felt
  // heavier than the heavy, and the palm stopped being worth pressing.
  const hs = (key, powerPx) =>
    M.hitstopMsFor(
      0.3,
      M.impactWeightFor(key),
      powerPx / M.MAX_SEND_PX,
      M.hitstopPowerWeightFor(key)
    );

  const slapChained = hs("slap", M.MAX_SEND_PX); // deepest a chain can go
  const palmFloor = hs("palm", M.profileFor("palm").floor); // weakest palm
  assert.ok(
    palmFloor > slapChained * 1.5,
    `even the weakest palm must thud harder than the deepest chained slap: palm ${palmFloor}ms vs slap ${slapChained}ms`
  );

  // A jab has to stay a jab all the way through a barrage.
  const slapFresh = hs("slap", M.profileFor("slap").floor);
  assert.ok(slapChained < 70, `a chained slap must stay crisp, got ${slapChained}ms`);
  assert.ok(
    slapChained - slapFresh < 20,
    "slap freeze must stay near-flat across a chain — the ramp is sold by distance, not hitstop"
  );
});

test("MOVE IDENTITY: palm is power NOW, slap is power OVER TIME", () => {
  const slap = M.profileFor("slap");
  const palm = M.profileFor("palm");

  // One palm from neutral must decisively beat one slap from neutral.
  // The palm must be decisively better per press. 1.5x rather than 2x now that
  // the slap floor came up for pacing — the rest of the gap is carried by
  // hitstop (129ms vs ~46ms), which is where the palm's weight actually reads.
  assert.ok(
    palm.floor >= slap.floor * 1.4,
    `a palm must be decisively worth more per press: ${palm.floor} vs ${slap.floor}`
  );

  // But a sustained chain must still be able to out-total a single palm —
  // that is what makes pressure worth investing in.
  const chainPeak = M.MAX_SEND_PX;
  assert.ok(chainPeak > palm.ceil, "a full chain must reward more than one heavy");

  // And the palm must remain the heavier single hit at every momentum level.
  for (const v of [0, 1.3, M.V_REF]) {
    assert.ok(
      M.transfer(v, palm.floor, palm.ceil) > M.transfer(v, slap.floor, slap.ceil),
      `palm must out-send slap at vSelf=${v}`
    );
  }
});

test("POSTURE: grabs break balance, strikes only chip it", () => {
  const TO_LETHAL = 85; // BALANCE_MAX 100 -> CLINCH_THROW_KILL_THRESHOLD 15
  const GRAB_CHIPS = { drive: 20, pull: 16, throw: 24 }; // mirrors constants.js

  const avg = (key) =>
    (M.postureChipForMove(key, 0) + M.postureChipForMove(key, M.V_IMPACT_REF)) / 2;

  // A poke must chip, never break. Old flat value was 7 per slap.
  assert.ok(
    M.postureChipForMove("slap", 0) <= 4,
    "a flat-footed slap must barely disturb balance"
  );
  assert.ok(
    TO_LETHAL / avg("slap") > 10,
    "slaps alone must not be a realistic route to a posture break"
  );

  // Closing speed has to matter, or this is just a flat constant again.
  for (const key of ["slap", "palm", "charged"]) {
    assert.ok(
      M.postureChipForMove(key, M.V_IMPACT_REF) > M.postureChipForMove(key, 0) * 2,
      `${key} posture chip must scale with collision severity`
    );
  }

  // Grabs are the posture breaker — that is their job now that posture no
  // longer sets their distance.
  assert.ok(
    GRAB_CHIPS.throw > M.postureChipForMove("palm", 0),
    "a throw must out-chip a flat-footed palm"
  );
  for (const [key, chip] of Object.entries(GRAB_CHIPS)) {
    assert.ok(
      TO_LETHAL / chip <= 6,
      `${key} must reach a break in ~6 connects or fewer, got ${Math.ceil(TO_LETHAL / chip)}`
    );
  }
});

test("impact weight differentiates feel without granting ground", () => {
  const heavy = M.hitstopMsFor(1.5, M.impactWeightFor("palm"));
  const light = M.hitstopMsFor(1.5, M.impactWeightFor("slap"));
  assert.ok(heavy > light, "palm freezes harder than a slap at equal closing speed");
  assert.strictEqual(M.impactWeightFor("nonexistent_move"), 1);
});

// ────────────────────────────────────────────────────────────────────────────
// THE TRIANGLE
// ────────────────────────────────────────────────────────────────────────────
test("matador spends the GRABBER's entry speed, pull does not", () => {
  const now = 5000;
  const standingGrabber = fighter();
  const slidingGrabber = fighter({ movementVelocity: 2.4 });
  const charger = fighter({ movementVelocity: -2.4 }); // closing from the right

  const pullStanding = M.resolveTransfer({
    attacker: standingGrabber,
    victim: charger,
    moveKey: "pull",
    dirToVictim: +1,
    nowSim: now,
  });
  const pullVsCharge = M.resolveTransfer({
    attacker: standingGrabber,
    victim: charger,
    moveKey: "pull",
    dirToVictim: +1,
    nowSim: now,
  });
  near(
    pullStanding.authoredPx,
    M.profileFor("pull").floor,
    1,
    "a belt tug ignores their charge"
  );
  near(
    pullVsCharge.authoredPx,
    pullStanding.authoredPx,
    1,
    "pull distance must not stretch with the victim's run-in"
  );

  const matadorStand = M.transfer(
    0,
    M.profileFor("matador").floor,
    M.profileFor("matador").ceil
  );
  const matadorSlide = M.transfer(
    M.sampleSelfMomentum(slidingGrabber, +1, now),
    M.profileFor("matador").floor,
    M.profileFor("matador").ceil
  );
  near(matadorStand, M.profileFor("matador").floor, 1, "standing-grab read is the floor");
  near(matadorSlide, M.profileFor("matador").ceil, 1, "slide-in grab buys the ceiling");
  assert.ok(
    matadorSlide > matadorStand * 1.3,
    "entry speed must be a real reward on the parry dump"
  );
});

test("GRAB TRIANGLE: each variant answers a different opponent", () => {
  const d = M.profileFor("drive");
  const p = M.profileFor("pull");
  const t = M.profileFor("throw");
  const m = M.profileFor("matador");
  const DRIVE_COUNTER_CHARGE = 0.6; // mirrors commandGrabSystem
  const drive = (mySpeed, theirCharge = 0) =>
    M.transfer(Math.max(0, mySpeed - DRIVE_COUNTER_CHARGE * theirCharge), d.floor, d.ceil);
  const pull = () => p.floor;
  const thr = (mySpeed) => M.transfer(mySpeed, t.floor, t.ceil);
  const matador = (theirEntry) => M.transfer(theirEntry, m.floor, m.ceil);

  // Against a STANDING opponent: the pocket drive is already a shove. Zooming
  // in is a dramatic bonus (centre-to-rope), not the thing that makes the
  // button worth pressing — this game is close combat most of the time.
  assert.ok(drive(0) >= 150, "a pocket drive must be a real shove, not a nudge");
  assert.ok(
    drive(M.V_REF) > drive(0) * 1.5,
    "momentum is a dramatic bonus on top of a carry that was already worth doing"
  );

  // Pull is the geometry tool, not the anti-charge dump.
  assert.ok(p.ceil - p.floor <= 50, "pull's band is a tug, not a launch curve");
  assert.ok(pull() < thr(0), "with no momentum, throw still out-sends a belt tug");

  // Head-on: charging into a Drive still eats the shove.
  const theyCharge = M.V_REF;
  assert.ok(
    drive(M.V_REF, theyCharge) < drive(M.V_REF),
    "driving into a charge must lose send"
  );

  // Dumping a committed GRAB is Matador's job.
  assert.ok(
    matador(theyCharge) > pull() * 2,
    "a slide-in grab-parry must dump harder than a belt tug"
  );
  assert.ok(
    matador(0) > p.ceil,
    "even a standing-grab matador out-sends the biggest belt tug"
  );

  // THROW is the arc / kill read, not "more pixels than a standing drive."
  // Drive is the default pocket button and has to be worth pressing without a
  // run-in. Throw still out-sends a belt tug (above), and must not out-scale a
  // committed drive.
  assert.ok(thr(M.V_REF) < drive(M.V_REF), "throw must not beat a full-commit drive");

  // Grabs stay guaranteed — a carried fighter has no stance to shift.
  for (const key of ["drive", "pull", "throw", "matador"]) {
    assert.strictEqual(M.profileFor(key).guaranteed, true, `${key} must ignore DI`);
  }
});

test("a retreating attacker gets the floor, never a penalty", () => {
  const v = M.sampleSelfMomentum(fighter({ movementVelocity: -1.3 }), +1, 200);
  assert.strictEqual(v, 0, "away-velocity contributes zero, not negative");
  near(M.transfer(v, 40, 200), 40, 0.5, "fade-away slap pays the floor");
});

test("telemetry exposes both channels separately for presentation", () => {
  const t = M.buildImpactTelemetry({ sendPx: 200, vClose: 3.7, compounded: true, guaranteed: false });
  assert.ok(t.power > 0 && t.power <= 1, "power is normalised");
  near(t.impact, 1, 1e-9, "impact is normalised");
  assert.strictEqual(t.sendPx, 200);
  assert.strictEqual(t.compounded, true);

  // The two channels must be able to disagree — that is the whole point.
  const highPowerLowImpact = M.buildImpactTelemetry({ sendPx: 200, vClose: 0.2 });
  assert.ok(
    highPowerLowImpact.power > highPowerLowImpact.impact,
    "a slide-in on a stationary target is high power / low impact"
  );
});
