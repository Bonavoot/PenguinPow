// ── Unified trauma-based screen shake — single source of truth ──────────────
// Eiserloh "Juicing Your Cameras" model. Events add TRAUMA (0..1); the renderer
// (useCamera) draws shake = trauma², so a hit reads as a sharp spike that settles
// fast (the premium "crack") instead of a slow low-amplitude sway (the old
// "wobble"). A coupled zoom-punch and an optional micro-roll sell weight.
//
// EVERYTHING shakes through here — hits, parries, clashes, landings, ring-outs,
// round start, edge pin, power-up reveal — so the whole game moves with one
// coherent motion and the feel is tuned from a single table below.
//
// Per-event tuning knobs:
//   trauma : how hard it hits (0..1). Bigger = stronger AND longer (decay is
//            time-based, so more trauma naturally lasts longer).
//   punch  : zoom push-in coupled to the shake. 0 = NO zoom — used for light,
//            repeatable events (slap parry) so back-to-back clashes can't
//            zoom-pump and disorient. Reserve real zoom for big "read" moments.
//   rot    : micro-roll amplitude in degrees. 0 for light/repeatable events;
//            a touch on heavy hits is the AAA "snap". Kept tiny so map edges
//            are never exposed (useCamera also hard-clamps translation).
// ZOOM POLICY: the trauma-shake bus does NOT zoom at all. The only zoom-punch
// in the game is the ceremonial hakkiyoi pulse (useCamera onGameStart) and the
// cinematic-kill camera (useCamera's own CINEMATIC_PUNCH_BOOST). Every profile
// here is therefore punch: 0 — shake is pure translation + roll. Smaller events
// still read as clearly lighter because the translation amplitude scales per
// event. (Per-event roll/trauma stay so each event keeps its distinct weight.)
export const SHAKE_PROFILES = {
  // ── Per-hit tiers (driven by player_hit: attackType + string position) ──
  // Light pokes (slap 1 & 2 and solo) — snappy rattle.
  slap_hit:        { trauma: 0.40, punch: 0.0, rot: 0.0 },
  // Slap-string FINISHER (slap3) — the "BOOM". Heavy crunch + roll.
  slap_finisher:   { trauma: 0.85, punch: 0.0, rot: 0.45 },
  // Charged hit — heavy crunch + roll (caller scales by charge %).
  charged_hit:     { trauma: 0.88, punch: 0.0, rot: 0.50 },

  // ── Light / repeatable events ──
  slap_parry:      { trauma: 0.50, punch: 0.0, rot: 0.0 },
  parry:           { trauma: 0.46, punch: 0.0, rot: 0.0 },
  power_up_reveal: { trauma: 0.30, punch: 0.0, rot: 0.0 },
  round_start:     { trauma: 0.28, punch: 0.0, rot: 0.0 }, // hakkiyoi zoom is in useCamera onGameStart
  danger_zone:     { trauma: 0.46, punch: 0.0, rot: 0.0 },
  projectile:      { trauma: 0.46, punch: 0.0, rot: 0.0 },

  // ── Medium events — rattle + slight roll ──
  rope_landing:    { trauma: 0.52, punch: 0.0, rot: 0.20 },
  throw_landing:   { trauma: 0.55, punch: 0.0, rot: 0.20 },
  edge_pin:        { trauma: 0.58, punch: 0.0, rot: 0.20 },
  clinch_jolt:     { trauma: 0.58, punch: 0.0, rot: 0.28 },
  grab_clash:      { trauma: 0.62, punch: 0.0, rot: 0.30 },

  // ── Heavy "this mattered" moments ──
  perfect_parry:   { trauma: 0.70, punch: 0.0, rot: 0.45 },
  charge_clash:    { trauma: 0.72, punch: 0.0, rot: 0.45 },
  ring_out:        { trauma: 0.78, punch: 0.0, rot: 0.40 },
  kill_throw:      { trauma: 0.92, punch: 0.0, rot: 0.60 },

  default:         { trauma: 0.50, punch: 0.0, rot: 0.10 },
};

// Hard ceiling on accumulated zoom-punch so rapid stacked events can never
// runaway-zoom (extra guard on top of per-event punch:0 for repeatable events).
const PUNCH_CAP = 0.15;

const state = {
  trauma: 0, // 0..1, decays over time (decay lives in useCamera's frame loop)
  dirX: 0, // -1 | 0 | 1 — recoil bias along the impact axis (0 = omnidirectional)
  punch: 0, // current zoom-punch amount, decays in useCamera
  rot: 0, // max roll (deg) for the active shake; cleared when trauma hits 0
  _dirWeight: 0, // internal: strongest impulse so far owns the recoil direction
};

// Add a raw trauma impulse. Used directly by the hit-shake path (which derives
// its own amount/dir/punch from knockback) and indirectly by addShake().
export function addTrauma(amount, opts = {}) {
  const { dirX = 0, punch = 0, rot = 0 } = opts;
  state.trauma = Math.min(1, state.trauma + amount);
  // Strongest impulse wins the recoil direction (so a big hit isn't overridden
  // by a tiny one landing a frame later).
  if (amount >= state._dirWeight) {
    state.dirX = Math.sign(dirX) || 0;
    state._dirWeight = amount;
  }
  state.punch = Math.min(PUNCH_CAP, Math.max(state.punch, punch));
  state.rot = Math.max(state.rot, rot);
}

// Add a named event's shake using the profile table. `scale` lets a caller
// nudge intensity (e.g. slap-parry escalation, charge-clash power) without
// inventing new profiles. `dirX` biases the recoil along an impact axis.
export function addShake(type, opts = {}) {
  const { scale = 1, dirX = 0 } = opts;
  const p = SHAKE_PROFILES[type] || SHAKE_PROFILES.default;
  addTrauma(p.trauma * scale, {
    dirX,
    punch: p.punch * scale,
    rot: p.rot,
  });
}

// Raise the trauma floor without accumulating (used by the cinematic-kill freeze,
// which drives its own decaying intensity each frame).
export function holdTrauma(v) {
  if (v > state.trauma) state.trauma = Math.min(1, v);
}

export function getShakeState() {
  return state;
}

// Reset transient direction/roll bookkeeping — called by the renderer once the
// shake has fully settled so the next event starts clean.
export function resetShakeBias() {
  state.dirX = 0;
  state.rot = 0;
  state._dirWeight = 0;
}
