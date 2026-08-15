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
// ZOOM POLICY: the trauma-shake bus does NOT zoom for combat hits. The only
// zoom-punches in the game are the ceremonial hakkiyoi pulse (useCamera
// onGameStart), the cinematic-kill camera (CINEMATIC_PUNCH_BOOST), and the
// kill_throw_land comic slam. Perfect parry gets weight from a sharp trauma
// crack + roll — its "punch" lives on the VFX burst (scale pop / flash /
// spokes), not the camera. Every other profile is punch: 0.
export const SHAKE_PROFILES = {
  // ── Per-hit tiers (driven by player_hit: attackType) ──
  // Slap pokes — snappy directional kick. Replace-mode so a barrage reads as
  // discrete cracks, not a stacked wobble (same idea as rope_clamp_hit).
  slap_hit:        { trauma: 0.44, punch: 0.0, rot: 0.0, replace: true, dirBias: 0.72 },
  // Charged hit — heavy crunch + roll + micro zoom-punch (caller scales by charge %).
  charged_hit:     { trauma: 0.92, punch: 0.06, rot: 0.55 },

  // ── Light / repeatable events ──
  parry:           { trauma: 0.46, punch: 0.0, rot: 0.0 },
  power_up_reveal: { trauma: 0.30, punch: 0.0, rot: 0.0 },
  round_start:     { trauma: 0.28, punch: 0.0, rot: 0.0 }, // hakkiyoi zoom is in useCamera onGameStart
  danger_zone:     { trauma: 0.46, punch: 0.0, rot: 0.0 },
  projectile:      { trauma: 0.46, punch: 0.0, rot: 0.0 },

  // ── Medium events — rattle + slight roll ──
  rope_landing:    { trauma: 0.52, punch: 0.0, rot: 0.20 },
  // Tawara kick-off — slide/redirect off the rope toward center. Louder than
  // a normal land so the speed burst is impossible to miss.
  rope_kickoff:    { trauma: 0.68, punch: 0.0, rot: 0.28, replace: true, dirBias: 0.8 },
  throw_landing:   { trauma: 0.55, punch: 0.0, rot: 0.20 },
  // Legacy / non-hit edge events (danger tell). Combat clamp hits use
  // rope_clamp_hit — stacking edge_pin on barrages read as a continuous wobble.
  edge_pin:        { trauma: 0.58, punch: 0.0, rot: 0.20 },
  // Rope-clamp slap/palm — FG-style impact kick: hard directional spike,
  // NO roll (roll + 22Hz noise was the "weird wobble"), replace-mode so
  // barrage rehitas crack instead of accumulating into a sustained shake.
  rope_clamp_hit:  {
    trauma: 0.82,
    punch: 0.0,
    rot: 0.0,
    replace: true,
    dirBias: 0.88,
  },
  clinch_jolt:     { trauma: 0.58, punch: 0.0, rot: 0.28 },
  clinch_tumble:   { trauma: 0.64, punch: 0.0, rot: 0.32 },
  // MATADOR success yank — snappy lateral read, under slap_parry / perfect.
  matador:         { trauma: 0.56, punch: 0.0, rot: 0.22 },
  grab_clash:      { trauma: 0.62, punch: 0.0, rot: 0.30 },

  // ── Heavy "this mattered" moments ──
  // Slap clash — now RARE + DECISIVE, so it reads as a real event: heavy thump
  // with a clear roll (no zoom). Sits with the other "that mattered" hits.
  slap_parry:      { trauma: 0.72, punch: 0.0, rot: 0.40 },
  // Perfect parry — decisive read. Sharp crack + roll, no camera zoom (the
  // burst itself punches). Sits under charged_hit / cinematic kill ceiling.
  perfect_parry:   { trauma: 0.86, punch: 0.0, rot: 0.52 },
  charge_clash:    { trauma: 0.72, punch: 0.0, rot: 0.45 },
  ring_out:        { trauma: 0.78, punch: 0.0, rot: 0.40 },
  // Legacy alias — clinch kill-throw landing now uses kill_throw_land.
  kill_throw:      { trauma: 0.92, punch: 0.0, rot: 0.60 },
  // Clinch kill-throw BODY SLAM — comically over-the-top, this landing only.
  // amp multiplies rendered shake offsets past the normal trauma=1 ceiling;
  // punch is the rare zoom exception reserved for this comic landing.
  kill_throw_land: { trauma: 1.0, punch: 0.15, rot: 2.6, amp: 2.15 },

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
  amp: 1, // rendered offset multiplier (kill_throw_land goes >1 for comic slam)
  dirBias: null, // optional per-impulse override of useCamera's SHAKE_DIR_BIAS
  _dirWeight: 0, // internal: strongest impulse so far owns the recoil direction
};

// Add a raw trauma impulse. Used directly by the hit-shake path (which derives
// its own amount/dir/punch from knockback) and indirectly by addShake().
// `replace: true` snaps trauma to the new spike (keeping a soft floor of the
// prior value) instead of stacking — required for rapid clamp barrages so
// each hit reads as a discrete kick, not a sustained wobble.
export function addTrauma(amount, opts = {}) {
  const {
    dirX = 0,
    punch = 0,
    rot = 0,
    amp = 1,
    replace = false,
    dirBias = null,
  } = opts;
  if (replace) {
    state.trauma = Math.min(1, Math.max(amount, state.trauma * 0.28));
  } else {
    state.trauma = Math.min(1, state.trauma + amount);
  }
  // Strongest impulse wins the recoil direction (so a big hit isn't overridden
  // by a tiny one landing a frame later). Replace-mode always claims direction
  // so each clamp rehit kicks along THIS hit's axis.
  if (replace || amount >= state._dirWeight) {
    state.dirX = Math.sign(dirX) || 0;
    state._dirWeight = amount;
  }
  state.punch = Math.min(PUNCH_CAP, Math.max(state.punch, punch));
  // Replace-mode overwrites roll (clamp profile wants 0 — don't inherit a
  // leftover charged-hit roll into the barrage).
  state.rot = replace ? rot : Math.max(state.rot, rot);
  state.amp = Math.max(state.amp, amp || 1);
  if (dirBias != null) state.dirBias = dirBias;
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
    amp: p.amp || 1,
    replace: !!p.replace,
    dirBias: p.dirBias != null ? p.dirBias : null,
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
  state.amp = 1;
  state.dirBias = null;
  state._dirWeight = 0;
}
