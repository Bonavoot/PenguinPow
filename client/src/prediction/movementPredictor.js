// ============================================
// CLIENT-SIDE MOVEMENT PREDICTION
// ============================================
// Predicts the LOCAL player's basic ground movement (strafe / crouch-strafe /
// brake / coast) by running the exact same ice physics the server runs, so
// movement responds on the same frame the key is pressed instead of after a
// full network round trip. The server stays 100% authoritative: every server
// snapshot is reconciled against a short history of predicted positions, and
// any disagreement is folded back in as a smooth visual correction.
//
// SCOPE (deliberately narrow):
//   - Predicted:  A/D strafing, S+A/D crouch strafing, braking, ice coasting,
//                 map boundary clamps, edge friction zones, speed power-up.
//   - NOT predicted (prediction suspends, rendering falls back to the normal
//     server interpolation): attacks, dodges, sidesteps, grabs, clinch,
//     knockback, throws, power slides, rope jumps, hitstop — anything where
//     the server runs special-case physics.
//
// The physics constants and step logic below are a transliteration of the
// strafing block in server-io/index.js (tick()) + getIceFriction() in
// server-io/gameUtils.js. `client/scripts/test-movement-prediction.mjs`
// verifies the constants against server-io/constants.js and exercises the
// step function + reconciliation offline — run it after changing either side.
//
// Kill switch (for live A/B testing):
//   localStorage.setItem("disableMovementPrediction", "1")  // off
//   localStorage.removeItem("disableMovementPrediction")    // on (default)

// ---- Mirrored server constants (see server-io/constants.js) ----
export const PREDICTION_CONSTANTS = {
  TICK_MS: 1000 / 64, // server fixed timestep (15.625ms)
  SPEED_FACTOR: 0.185,
  ICE_ACCELERATION: 0.08,
  ICE_MAX_SPEED: 1.3,
  ICE_INITIAL_BURST: 0.28,
  ICE_COAST_FRICTION: 0.982,
  ICE_MOVING_FRICTION: 0.988,
  ICE_BRAKE_FRICTION: 0.8,
  ICE_STOP_THRESHOLD: 0.025,
  ICE_TURN_BURST: 0.18,
  ICE_EDGE_BRAKE_BONUS: 0.06,
  ICE_EDGE_SLIDE_PENALTY: 0.004,
  DOHYO_EDGE_PANIC_ZONE: 89,
  // see server-io/gameUtils.js
  MAP_LEFT_BOUNDARY: 340,
  MAP_RIGHT_BOUNDARY: 940,
  DOHYO_LEFT_BOUNDARY: 250,
  DOHYO_RIGHT_BOUNDARY: 1030,
  GROUND_LEVEL: 286,
  HITBOX_DISTANCE_VALUE: 68, // Math.round(71 * 0.96) — pushbox half-width
  // Crouch strafe modifiers (inline numbers in the server strafe block)
  CROUCH_TURN_FRICTION: 0.3,
  CROUCH_ACCEL_FACTOR: 0.2,
  CROUCH_MAX_SPEED_FACTOR: 0.3,
  CROUCH_SPEED_FACTOR: 0.5,
  OUTSIDE_DOHYO_VELOCITY_PENALTY: 0.92,
};

const C = PREDICTION_CONSTANTS;

// ---- Tuning for reconciliation / blending (client-only, not server-mirrored) ----
const HISTORY_MAX_AGE_MS = 1000;
const HARD_SNAP_ERROR_PX = 80; // beyond this, teleport/reset — snap, don't bleed
const ERROR_DEADZONE_PX = 1.5; // ignore sub-pixel disagreement (timing noise)
const OFFSET_TAU_MS = 60; // exp decay time constant for corrections/handoffs
const OFFSET_MAX_RATE_PX_PER_MS = 0.2; // cap bleed speed so big errors glide
const VELOCITY_RESYNC_THRESHOLD = 0.35;
const MAX_FRAME_DT_MS = 100; // clamp huge frame gaps (tab switch etc.)
const CONTACT_SUSPEND_MARGIN_PX = 30;

// Exponential decay toward zero, rate-capped so that large corrections bleed
// as a smooth glide (max ~3.3px per 60fps frame) instead of a visible pop.
function decayOffset(offset, dtMs) {
  if (offset === 0) return 0;
  const target = offset * Math.exp(-dtMs / OFFSET_TAU_MS);
  let delta = offset - target;
  const maxDelta = OFFSET_MAX_RATE_PX_PER_MS * dtMs;
  if (Math.abs(delta) > maxDelta) delta = Math.sign(delta) * maxDelta;
  const next = offset - delta;
  return Math.abs(next) < 0.1 ? 0 : next;
}

// Server state flags that indicate special-case physics — prediction must
// suspend while any of these are truthy on the local player. All of these
// are in the server's DELTA_TRACKED_PROPS so the client always has them.
const BLOCKING_FLAGS = [
  "isHit",
  "isAttacking",
  "isSlapAttack",
  "isChargingAttack",
  "isDodging",
  "isSidestepping",
  "isSidestepStartup",
  "isSidestepRecovery",
  "isSidestepHitReturn",
  "isHitFalling",
  "isRopeJumping",
  "isFlapping",
  "isThrowing",
  "isBeingThrown",
  "isThrowTeching",
  "isGrabbing",
  "isBeingGrabbed",
  "isGrabbingMovement",
  "isWhiffingGrab",
  "isGrabWhiffRecovery",
  "isGrabTeching",
  "isGrabStartup",
  "isGrabSeparating",
  "isGrabBreaking",
  "isGrabBreakCountered",
  "isRawParrying",
  "isRawParryStun",
  "isRawParrySuccess",
  "isPerfectRawParrySuccess",
  "isRecovering",
  "isThrowingSnowball",
  "isSpawningPumoArmy",
  "isThrowingSalt",
  "isAtTheRopes",
  "isPowerSliding",
  "isBowing",
  "isBeingPulled",
  "isBeingPushed",
  "isGrabPushing",
  "isBeingGrabPushed",
  "isEdgePushing",
  "isBeingEdgePushed",
  "inClinch",
  "hasGrip",
  "isBeingLifted",
  "isClinchThrowing",
  "isClinchClashing",
  "isClinchLifting",
  "isClinchPushing",
  "isClinchPlanting",
  "isResistingThrow",
  "isResistingPull",
  "isClinchKillThrowVictim",
  "isClinchKillPullVictim",
  "isClinchJolting",
  "isBeingClinchJolted",
  "isClinchJoltClashing",
  "clinchJoltRecovery",
  "isInRitualPhase",
  "isDead",
];

// ---- Kill switch ----
let cachedEnabled = null;
export function isMovementPredictionEnabled() {
  if (cachedEnabled === null) {
    try {
      cachedEnabled =
        typeof localStorage !== "undefined" &&
        localStorage.getItem("disableMovementPrediction") === "1"
          ? false
          : true;
    } catch {
      cachedEnabled = true;
    }
  }
  return cachedEnabled;
}

// ============================================
// PHYSICS STEP — transliteration of the server strafe block
// ============================================

function nearEdge(x) {
  return (
    Math.min(x - C.MAP_LEFT_BOUNDARY, C.MAP_RIGHT_BOUNDARY - x) <
    C.DOHYO_EDGE_PANIC_ZONE
  );
}

function edgeProximity(x) {
  const nearest = Math.min(x - C.MAP_LEFT_BOUNDARY, C.MAP_RIGHT_BOUNDARY - x);
  return Math.max(0, 1 - nearest / C.DOHYO_EDGE_PANIC_ZONE);
}

// Mirrors getIceFriction() for the non-power-slide path.
function iceFriction(isActiveBraking, anyMoveKeyHeld, x) {
  if (isActiveBraking) {
    let f = C.ICE_BRAKE_FRICTION;
    if (nearEdge(x)) f -= C.ICE_EDGE_BRAKE_BONUS * edgeProximity(x);
    return f;
  }
  if (anyMoveKeyHeld) return C.ICE_MOVING_FRICTION;
  let f = C.ICE_COAST_FRICTION;
  if (nearEdge(x)) f += C.ICE_EDGE_SLIDE_PENALTY * edgeProximity(x);
  return f;
}

/**
 * Advance one 64Hz tick of neutral-state ground movement.
 * `sim`: { x, v, wasStrafingRight, wasStrafingLeft, isStrafing, isBraking }
 * `keys`: { a, d, s } booleans (subset of the game key state)
 * `speedMult`: 1 normally, powerUpMultiplier with the speed power-up
 * Mutates and returns `sim`. Must stay in lockstep with server-io/index.js.
 */
export function stepMovement(sim, keys, speedMult = 1) {
  const delta = C.TICK_MS;
  const csf = C.SPEED_FACTOR * speedMult;
  const crouch = !!keys.s;
  const left = C.MAP_LEFT_BOUNDARY;
  const right = C.MAP_RIGHT_BOUNDARY;

  if (crouch && keys.d && !keys.a) {
    // Crouch strafe RIGHT
    if (sim.v < 0) sim.v *= C.CROUCH_TURN_FRICTION;
    sim.v = Math.min(
      sim.v + C.ICE_ACCELERATION * C.CROUCH_ACCEL_FACTOR,
      C.ICE_MAX_SPEED * C.CROUCH_MAX_SPEED_FACTOR
    );
    const newX = sim.x + delta * (csf * C.CROUCH_SPEED_FACTOR) * sim.v;
    if (newX <= right) {
      sim.x = newX;
    } else {
      sim.x = right;
      sim.v = 0;
    }
    // NOTE: the server's crouch branch intentionally leaves isStrafing /
    // isBraking untouched (a carried-over isStrafing keeps applying the
    // post-step moving friction below) — mirror that exactly.
  } else if (crouch && keys.a && !keys.d) {
    // Crouch strafe LEFT
    if (sim.v > 0) sim.v *= C.CROUCH_TURN_FRICTION;
    sim.v = Math.max(
      sim.v - C.ICE_ACCELERATION * C.CROUCH_ACCEL_FACTOR,
      -C.ICE_MAX_SPEED * C.CROUCH_MAX_SPEED_FACTOR
    );
    const newX = sim.x + delta * (csf * C.CROUCH_SPEED_FACTOR) * sim.v;
    if (newX >= left) {
      sim.x = newX;
    } else {
      sim.x = left;
      sim.v = 0;
    }
  } else if (keys.d && !crouch) {
    // Ice strafe RIGHT
    const wasMovingLeft = sim.v < -C.ICE_STOP_THRESHOLD;
    if (wasMovingLeft) {
      sim.v *= iceFriction(true, true, sim.x);
      sim.isBraking = true;
      sim.isStrafing = false;
      if (Math.abs(sim.v) < C.ICE_STOP_THRESHOLD * 5) {
        sim.v = C.ICE_TURN_BURST;
        sim.wasStrafingRight = true;
        sim.wasStrafingLeft = false;
        sim.isBraking = false;
      }
    } else if (sim.v <= C.ICE_STOP_THRESHOLD && !sim.wasStrafingRight) {
      sim.v = C.ICE_INITIAL_BURST;
      sim.wasStrafingRight = true;
      sim.wasStrafingLeft = false;
      sim.isBraking = false;
      sim.isStrafing = true;
    } else {
      sim.v = Math.min(sim.v + C.ICE_ACCELERATION, C.ICE_MAX_SPEED);
      sim.isBraking = false;
      sim.isStrafing = true;
    }
    const newX = sim.x + delta * csf * sim.v;
    if (newX <= right) {
      sim.x = newX;
    } else {
      sim.x = right;
      sim.v = 0;
    }
  } else if (keys.a && !crouch) {
    // Ice strafe LEFT
    const wasMovingRight = sim.v > C.ICE_STOP_THRESHOLD;
    if (wasMovingRight) {
      sim.v *= iceFriction(true, true, sim.x);
      sim.isBraking = true;
      sim.isStrafing = false;
      if (Math.abs(sim.v) < C.ICE_STOP_THRESHOLD * 5) {
        sim.v = -C.ICE_TURN_BURST;
        sim.wasStrafingLeft = true;
        sim.wasStrafingRight = false;
        sim.isBraking = false;
      }
    } else if (sim.v >= -C.ICE_STOP_THRESHOLD && !sim.wasStrafingLeft) {
      sim.v = -C.ICE_INITIAL_BURST;
      sim.wasStrafingLeft = true;
      sim.wasStrafingRight = false;
      sim.isBraking = false;
      sim.isStrafing = true;
    } else {
      sim.v = Math.max(sim.v - C.ICE_ACCELERATION, -C.ICE_MAX_SPEED);
      sim.isBraking = false;
      sim.isStrafing = true;
    }
    const newX = sim.x + delta * csf * sim.v;
    if (newX >= left) {
      sim.x = newX;
    } else {
      sim.x = left;
      sim.v = 0;
    }
  } else {
    // COAST / BRAKE (no clean directional input)
    if (Math.abs(sim.v) > C.ICE_STOP_THRESHOLD) {
      const movingRight = sim.v > 0;
      const movingLeft = sim.v < 0;
      const holdingLeft = keys.a && !keys.d;
      const holdingRight = keys.d && !keys.a;
      const isActiveBraking =
        (movingRight && holdingLeft) || (movingLeft && holdingRight);
      sim.v *= iceFriction(isActiveBraking, !!(keys.a || keys.d), sim.x);
      if (sim.x < C.DOHYO_LEFT_BOUNDARY || sim.x > C.DOHYO_RIGHT_BOUNDARY) {
        sim.v *= C.OUTSIDE_DOHYO_VELOCITY_PENALTY;
      }
      sim.isBraking = isActiveBraking;
      sim.isStrafing = false;
      const newX = sim.x + delta * csf * sim.v;
      if (newX >= left && newX <= right) {
        sim.x = newX;
      } else {
        sim.x = newX < left ? left : right;
        sim.v = 0;
      }
    } else {
      sim.v = 0;
      sim.isBraking = false;
      sim.wasStrafingLeft = false;
      sim.wasStrafingRight = false;
    }
  }

  // Server applies moving friction AFTER the position update while strafing
  // ("you slide even while trying to move") — keep the same operation order.
  if (sim.isStrafing && Math.abs(sim.v) > C.ICE_STOP_THRESHOLD) {
    sim.v *= C.ICE_MOVING_FRICTION;
  }

  // Mirror the server's trailing "update strafing state" block: with no
  // movement keys held during active gameplay, isStrafing clears (so the
  // coast branch's friction selection sees the right flags next tick).
  if (!keys.a && !keys.d) {
    sim.isStrafing = false;
  }

  return sim;
}

// ============================================
// ELIGIBILITY — when is it safe to predict?
// ============================================

/**
 * True when the local player is in plain ground movement, i.e. the server
 * would run exactly the strafe/coast block we mirror. `self`/`opponent` are
 * the accumulated server state objects from the fighter_action stream.
 */
export function isPredictionEligible(self, opponent, keys, gameActive) {
  if (!gameActive || !self || !keys) return false;

  // Space (parry attempt), C/CTRL (power slide), and mouse buttons all gate
  // server movement or start non-movement actions — sit those out.
  if (keys[" "] || keys.c || keys.control || keys.mouse1 || keys.mouse2) {
    return false;
  }

  for (let i = 0; i < BLOCKING_FLAGS.length; i++) {
    if (self[BLOCKING_FLAGS[i]]) return false;
  }

  // Knockback runs on a separate velocity channel server-side.
  const kb = self.knockbackVelocity;
  if (kb && (Math.abs(kb.x || 0) > 0.01 || Math.abs(kb.y || 0) > 0.01)) {
    return false;
  }

  // Airborne / falling / cinematic Y movement — only predict on the ground.
  if (typeof self.y === "number" && self.y !== C.GROUND_LEVEL) return false;

  // Near the opponent's pushbox AND moving toward them: the server runs
  // overlap separation we don't simulate. Moving away is always safe.
  if (opponent && typeof opponent.x === "number") {
    const pushboxDistance =
      C.HITBOX_DISTANCE_VALUE *
        ((self.sizeMultiplier || 1) + (opponent.sizeMultiplier || 1)) +
      CONTACT_SUSPEND_MARGIN_PX;
    const dx = opponent.x - self.x;
    if (Math.abs(dx) < pushboxDistance) {
      const towardOpponent = dx > 0 ? keys.d : keys.a;
      if (towardOpponent) return false;
    }
  }

  return true;
}

// ============================================
// PREDICTOR — fixed-step sim + history + reconciliation + blending
// ============================================

export class MovementPredictor {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.sim = {
      x: 0,
      v: 0,
      wasStrafingRight: false,
      wasStrafingLeft: false,
      isStrafing: false,
      isBraking: false,
    };
    this.accumulatorMs = 0;
    this.lastUpdateMs = 0;
    // Position at the previous sim tick — rendering interpolates between
    // prevTickX and sim.x by the accumulator fraction. Without this, 64Hz
    // ticks sampled at 60fps alias into alternating 1-tick / 2-tick frames
    // (visible ~4px/~8px stutter at full speed).
    this.prevTickX = 0;
    // Visual correction: rendered = sim.x + visualOffset; decays to 0.
    this.visualOffset = 0;
    // Handoff blending when prediction deactivates mid-motion.
    this.handoffOffset = 0;
    this.handoffAtMs = 0;
    // Ring of { t, x } predicted samples for snapshot reconciliation.
    this.history = [];
  }

  // Called instead of update() during display hitstop so the freeze does not
  // accumulate into a burst of catch-up ticks afterwards.
  notePause(nowMs) {
    this.lastUpdateMs = nowMs;
  }

  _activate(nowMs, renderedX, self) {
    this.active = true;
    this.sim.x = renderedX;
    const serverV =
      typeof self.movementVelocity === "number" ? self.movementVelocity : 0;
    this.sim.v = serverV;
    this.sim.wasStrafingRight = serverV > C.ICE_STOP_THRESHOLD;
    this.sim.wasStrafingLeft = serverV < -C.ICE_STOP_THRESHOLD;
    this.sim.isStrafing = !!self.isStrafing;
    this.sim.isBraking = !!self.isBraking;
    this.accumulatorMs = 0;
    this.lastUpdateMs = nowMs;
    this.prevTickX = renderedX;
    this.visualOffset = 0;
    this.history.length = 0;
    this.history.push({ t: nowMs, x: this.sim.x, v: this.sim.v });
  }

  _deactivate(nowMs, serverRenderedX) {
    // Capture where we're rendering vs where the server stream renders, then
    // bleed the difference out so the sprite glides (never pops) back onto
    // the interpolated server position.
    const alpha = Math.min(this.accumulatorMs / C.TICK_MS, 1);
    const renderedX =
      this.prevTickX +
      (this.sim.x - this.prevTickX) * alpha +
      this.visualOffset;
    this.handoffOffset = renderedX - serverRenderedX;
    this.handoffAtMs = nowMs;
    this.active = false;
    this.visualOffset = 0;
    this.history.length = 0;
  }

  /**
   * Per-render-frame update. Returns the X the caller should render:
   *   { active: true,  x }            — render predicted position
   *   { active: false, offsetX }      — add offsetX to the server-interp X
   *                                     (handoff blending; 0 when settled)
   *
   * `serverRenderedX` is the X the normal interpolation path produced this
   * frame — used as the seed when activating and as the blend target when
   * deactivating.
   */
  update(nowMs, keys, self, opponent, gameActive, serverRenderedX) {
    const eligible = isPredictionEligible(self, opponent, keys, gameActive);

    if (!this.active) {
      const wantsToMove = !!(keys && (keys.a || keys.d));
      if (eligible && wantsToMove) {
        // Seed from the position we're currently RENDERING (server interp +
        // any residual handoff offset) so activation never pops; the first
        // snapshot reconciliations fold us back onto the server's line.
        const residual = this._decayedHandoff(nowMs);
        this.handoffOffset = 0;
        this._activate(nowMs, serverRenderedX + residual, self);
        return { active: true, x: this.sim.x };
      }
      return { active: false, offsetX: this._decayedHandoff(nowMs) };
    }

    // Active →
    if (!eligible) {
      this._deactivate(nowMs, serverRenderedX);
      return { active: false, offsetX: this._decayedHandoff(nowMs) };
    }

    // Advance the fixed-step sim by however much real time elapsed.
    let dt = nowMs - this.lastUpdateMs;
    if (!(dt >= 0)) dt = 0;
    if (dt > MAX_FRAME_DT_MS) dt = MAX_FRAME_DT_MS;
    this.lastUpdateMs = nowMs;
    this.accumulatorMs += dt;

    const speedMult =
      self.activePowerUp === "speed" && typeof self.powerUpMultiplier === "number"
        ? self.powerUpMultiplier
        : 1;

    let stepped = false;
    while (this.accumulatorMs >= C.TICK_MS) {
      this.accumulatorMs -= C.TICK_MS;
      this.prevTickX = this.sim.x;
      stepMovement(this.sim, keys, speedMult);
      stepped = true;
    }

    if (stepped) {
      this.history.push({ t: nowMs, x: this.sim.x, v: this.sim.v });
      const cutoff = nowMs - HISTORY_MAX_AGE_MS;
      while (this.history.length > 2 && this.history[0].t < cutoff) {
        this.history.shift();
      }
    }

    // Bleed visual corrections out (exponential, rate-capped).
    this.visualOffset = decayOffset(this.visualOffset, dt);

    // Came to a complete rest with no input → hand control back to the
    // normal interpolation path (it and the sim agree at rest anyway).
    if (
      !keys.a &&
      !keys.d &&
      this.sim.v === 0 &&
      this.visualOffset === 0
    ) {
      this._deactivate(nowMs, serverRenderedX);
      return { active: false, offsetX: this._decayedHandoff(nowMs) };
    }

    // Sub-tick interpolation: blend between the last two tick positions by
    // the accumulator fraction so 60fps rendering of the 64Hz sim is smooth.
    const alpha = Math.min(this.accumulatorMs / C.TICK_MS, 1);
    const renderX = this.prevTickX + (this.sim.x - this.prevTickX) * alpha;
    return { active: true, x: renderX + this.visualOffset };
  }

  _decayedHandoff(nowMs) {
    if (this.handoffOffset === 0) return 0;
    const dt = Math.max(0, nowMs - this.handoffAtMs);
    this.handoffAtMs = nowMs;
    this.handoffOffset = decayOffset(this.handoffOffset, dt);
    return this.handoffOffset;
  }

  /**
   * Reconcile against an authoritative server snapshot. `rttMs` is the
   * current round-trip estimate: a snapshot arriving now was simulated with
   * our inputs from roughly (now - rtt), so that's where we look up our own
   * predicted position for comparison.
   */
  onServerSnapshot(self, nowMs, rttMs) {
    if (!this.active || !self || typeof self.x !== "number") return;

    const lookupT = nowMs - (rttMs || 0);
    const predictedAt = this._historyXAt(lookupT);
    if (predictedAt === null) return;

    const error = self.x - predictedAt;

    if (Math.abs(error) > HARD_SNAP_ERROR_PX) {
      // Teleport / round reset / unmodeled mechanic — take the server state.
      this.sim.x = self.x;
      this.prevTickX = self.x;
      this.sim.v =
        typeof self.movementVelocity === "number" ? self.movementVelocity : 0;
      this.visualOffset = 0;
      this.history.length = 0;
      this.history.push({ t: nowMs, x: this.sim.x, v: this.sim.v });
      return;
    }

    if (Math.abs(error) > ERROR_DEADZONE_PX) {
      // Fold the error into the sim immediately (server-aligned) and cancel
      // it visually so the rendered position glides instead of jumping.
      this.sim.x += error;
      this.prevTickX += error;
      this.visualOffset -= error;
      for (let i = 0; i < this.history.length; i++) {
        this.history[i].x += error;
      }
    }

    // Velocity drift guard (e.g. server blocked movement we simulated).
    // Compare against our HISTORICAL velocity at the snapshot's timestamp —
    // the snapshot's velocity is ~RTT old, so comparing it to the current
    // velocity would false-positive during fast transitions (brake turns).
    if (typeof self.movementVelocity === "number") {
      const histV = this._historyVAt(lookupT);
      if (
        histV !== null &&
        Math.abs(histV - self.movementVelocity) > VELOCITY_RESYNC_THRESHOLD
      ) {
        this.sim.v = self.movementVelocity;
      }
    }
  }

  _historyXAt(t) {
    const h = this.history;
    if (h.length === 0) return null;
    if (t <= h[0].t) return h[0].x;
    if (t >= h[h.length - 1].t) return h[h.length - 1].x;
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i - 1].t <= t) {
        const a = h[i - 1];
        const b = h[i];
        const span = b.t - a.t;
        const f = span > 0 ? (t - a.t) / span : 1;
        return a.x + (b.x - a.x) * f;
      }
    }
    return h[0].x;
  }

  _historyVAt(t) {
    const h = this.history;
    if (h.length === 0) return null;
    if (t <= h[0].t) return h[0].v;
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].t <= t) return h[i].v;
    }
    return h[h.length - 1].v;
  }
}
