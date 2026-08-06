"use strict";

/**
 * How far can a Push actually drive an OPEN opponent, and does that turn a
 * center-ring mistake into a free ring-out?
 *
 * Measures the victim's REAL room: the distance from where they stand to the
 * tawara they are being driven toward. Center-to-tawara is the wrong yardstick —
 * the victim straddles center by half the attach distance on the push side, so
 * they always have ~CLINCH_ATTACHED_DISTANCE/2 LESS room than the ring's radius.
 * An earlier version of this script compared against the radius and reported a
 * comfortable margin while the punish was in fact walking the victim onto the
 * line.
 *
 * Covers both push directions and both authoritative branches (the grabber
 * pushing and the grabbed pushing are separate code paths in updateGrabActions
 * and can drift apart).
 *
 * Run: node scripts/report-open-punish-displacement.js [floorOverride]
 */

const {
  CLINCH_THROW_FAIL_STAGGER_MS,
  CLINCH_PERFECT_BRACE_OPEN_MS,
  CLINCH_OPEN_PUNISH_RAMP_FLOOR,
  CLINCH_PUSH_RAMP_MAX_MULT,
  CLINCH_LIGHT_DRIVE_SPEED_MULT,
  CLINCH_EDGE_ZONE_THRESHOLD,
  CLINCH_ATTACHED_DISTANCE,
} = require("../constants");
const { MAP_LEFT_BOUNDARY, MAP_RIGHT_BOUNDARY } = require("../gameUtils");
const { createClinchScenario } = require("../test/clinch/harness");

const CENTER = (MAP_LEFT_BOUNDARY + MAP_RIGHT_BOUNDARY) / 2;
const TICK_MS = 1000 / 64;

// A center-ring punish should end "on the brink" — deep in the edge zone is fine
// and dramatic, but it must leave real daylight to the tawara so the pusher still
// has to finish the job. 12px is roughly two ticks of shove: close enough to be
// terrifying, far enough that the punish alone is not the round.
//
// Note this margin is governed by OPEN DURATION, not by the punish multiplier —
// 650ms of unresisted push covers most of the ring radius at any multiplier. The
// multiplier invariant is asserted separately below.
const MIN_MARGIN_PX = 12;

/**
 * @param pusherRole "grabber" | "grabbed" — selects which authoritative branch runs.
 * @param swapRoles  false ⇒ p1 is grabber (left); true ⇒ p2 is grabber (right).
 */
function measure({ pusherRole, swapRoles, openMs, deepGrip, stamina }) {
  const s = createClinchScenario({ midX: CENTER, tickMs: TICK_MS, swapRoles });
  try {
    const pusher = pusherRole === "grabber" ? s.grabber : s.grabbed;
    const victim = pusherRole === "grabber" ? s.grabbed : s.grabber;

    // Let clinchAttachDistance lerp to its runtime value before measuring, then
    // re-center on the settled gap. Otherwise the first push tick also absorbs
    // the attach settle — and because the GRABBER is the movement anchor, that
    // shift lands entirely on the other player, which reads as a phantom
    // role-dependent asymmetry of exactly (placement attach - runtime attach).
    s.holdNeutral(s.grabber);
    s.holdNeutral(s.grabbed);
    s.advance(200);
    const gap = Math.abs(s.grabber.x - s.grabbed.x);
    const leftPlayer = s.grabber.x < s.grabbed.x ? s.grabber : s.grabbed;
    const rightPlayer = leftPlayer === s.grabber ? s.grabbed : s.grabber;
    leftPlayer.x = CENTER - gap / 2;
    rightPlayer.x = CENTER + gap / 2;

    s.setStamina(pusher, stamina);
    if (deepGrip) s.setDeepGrip(pusher);
    else s.clearDeepGrip();
    s.setOpen(victim, s.now() + openMs);
    s.holdToward(pusher, victim);

    // Which tawara are they being driven toward? Sign of (victim - pusher).
    const towardRight = victim.x > pusher.x;
    const wall = towardRight ? MAP_RIGHT_BOUNDARY : MAP_LEFT_BOUNDARY;
    const startX = victim.x;
    const room = Math.abs(wall - startX);

    const end = s.now() + openMs;
    while (s.now() < end) s.advance(TICK_MS);

    const moved = Math.abs(victim.x - startX);
    const left = Math.abs(wall - victim.x);
    return {
      dir: towardRight ? "→ right" : "← left ",
      room,
      moved,
      left,
      gap,
      onLine: left <= 0.01,
    };
  } finally {
    s.dispose();
  }
}

const ORIENTATIONS = [
  ["grabber pushes, victim right", { pusherRole: "grabber", swapRoles: false }],
  ["grabber pushes, victim left ", { pusherRole: "grabber", swapRoles: true }],
  ["grabbed pushes, victim left ", { pusherRole: "grabbed", swapRoles: false }],
  ["grabbed pushes, victim right", { pusherRole: "grabbed", swapRoles: true }],
];

const CASES = [
  ["RESISTED", CLINCH_THROW_FAIL_STAGGER_MS, false],
  ["RESISTED + Deep Grip", CLINCH_THROW_FAIL_STAGGER_MS, true],
  ["PERFECT BRACE", CLINCH_PERFECT_BRACE_OPEN_MS, false],
  // A Perfect Brace ALWAYS grants the defender Deep Grip, so this row is the
  // default Perfect Brace punish — not a rare corner.
  ["PERFECT BRACE + Deep Grip", CLINCH_PERFECT_BRACE_OPEN_MS, true],
];

const probe = measure({
  ...ORIENTATIONS[0][1],
  openMs: CLINCH_PERFECT_BRACE_OPEN_MS,
  deepGrip: true,
  stamina: 100,
});

console.log("\nOPEN-PUNISH PUSH — can a center-ring mistake be a free ring-out?\n");
console.log(`  ring center                = ${CENTER}`);
console.log(`  ring radius (center→tawara)= ${(MAP_RIGHT_BOUNDARY - CENTER).toFixed(1)}px`);
console.log(`  victim starts              = ${(probe.room === 0 ? 0 : (MAP_RIGHT_BOUNDARY - CENTER) - probe.room).toFixed(1)}px past center, on the push side`);
console.log(`  (placement attach ${CLINCH_ATTACHED_DISTANCE}px settles to ${probe.gap.toFixed(1)}px at runtime)`);
console.log(`  VICTIM'S ACTUAL ROOM       = ${probe.room.toFixed(1)}px  <-- the number that matters`);
console.log(`  edge zone                  = last ${CLINCH_EDGE_ZONE_THRESHOLD}px before the tawara`);
console.log(`  required margin            = ${MIN_MARGIN_PX}px of daylight at the end of Open\n`);
console.log(`  light drive mult           = ${CLINCH_LIGHT_DRIVE_SPEED_MULT}`);
console.log(`  open-punish ramp floor     = ${CLINCH_OPEN_PUNISH_RAMP_FLOOR}`);
console.log(`  committed ramp max         = ${CLINCH_PUSH_RAMP_MAX_MULT}\n`);

let worst = null;
for (const stamina of [100, 40]) {
  console.log(`  --- stamina ${stamina}, pushing from a DEAD-CENTER clinch ---\n`);
  for (const [caseLabel, openMs, deepGrip] of CASES) {
    // Report the harshest orientation; assert on all of them.
    let harshest = null;
    const spread = [];
    for (const [, opts] of ORIENTATIONS) {
      const r = measure({ ...opts, openMs, deepGrip, stamina });
      spread.push(r.left);
      if (!harshest || r.left < harshest.left) harshest = r;
      if (!worst || r.left < worst.left) {
        worst = { ...r, caseLabel, stamina };
      }
    }
    const drift = Math.max(...spread) - Math.min(...spread);
    const verdict = harshest.onLine
      ? "ON THE TAWARA"
      : harshest.left < MIN_MARGIN_PX
        ? `only ${harshest.left.toFixed(1)}px left`
        : "ok";
    console.log(
      `    ${caseLabel.padEnd(27)} moved ${harshest.moved.toFixed(1).padStart(6)}px  ` +
        `${harshest.left.toFixed(1).padStart(6)}px to tawara  ` +
        `${harshest.left <= CLINCH_EDGE_ZONE_THRESHOLD ? "[in edge zone]" : "[safe ground]"}  ` +
        `${verdict}`
    );
    if (drift > 0.5) {
      console.log(
        `      !! orientation drift ${drift.toFixed(2)}px — the four push paths disagree`
      );
    }
  }
  console.log();
}

const marginOk = worst.left >= MIN_MARGIN_PX;
console.log(
  `  worst case: ${worst.caseLabel} @ stamina ${worst.stamina} ${worst.dir} → ` +
    `${worst.left.toFixed(1)}px from the tawara (need ${MIN_MARGIN_PX}px)`
);
console.log(
  marginOk
    ? "  PASS — a center-ring failed technique is driven to the brink, not out."
    : "  FAIL — a center-ring failed technique is effectively a force-out."
);

// The punish is entitled to full committed force, not to force nobody earned.
// A floor above the committed baseline invents speed that sustaining pressure is
// supposed to buy, and that is what put the victim on the line at 1.15.
const COMMITTED_BASELINE = 1.0;
const floorOk = CLINCH_OPEN_PUNISH_RAMP_FLOOR <= COMMITTED_BASELINE;
console.log(
  `\n  punish floor ${CLINCH_OPEN_PUNISH_RAMP_FLOOR} vs committed baseline ${COMMITTED_BASELINE}`
);
console.log(
  floorOk
    ? "  PASS — the punish removes the Light Drive / Plant taxes and nothing more.\n"
    : "  FAIL — the punish floor fabricates force above the committed baseline.\n"
);

process.exit(marginOk && floorOk ? 0 : 1);
