import { useEffect, useRef } from "react";
import { valueNoise } from "../utils/shakeNoise";
import {
  addTrauma,
  addShake,
  holdTrauma,
  getShakeState,
  resetShakeBias,
} from "../lib/cameraShake";

// ── Tunable constants ──────────────────────────────────────────────
const GAME_WIDTH = 1280;

const CLOSE_DISTANCE = 100; // player gap (game-coords) for max zoom
const FAR_DISTANCE = 700; // player gap (game-coords) for min zoom

const SPRITE_HALF_W = 0; // Sprites are now centred on player.x via CSS translate
// Vertical framing bias (%) — positive = pan down to favour the ring + crowd over
// empty map sky. Nudged back toward 12 for NHK-style lower-third wrestler framing
// (was 9 after the dohyo.webp re-bake; the asset edge is clean enough to tolerate this).
const Y_OFFSET = 12;

// ── Flight (flap power-up) vertical follow ──────────────────────────
// When a wrestler takes flight the camera pans UP a little so the airborne
// penguin stays framed without losing the grounded opponent. Deliberately
// subtle and hard-capped — the per-frame edge clamp (maxPanY) still bounds
// how far this can nudge within available headroom.
const FLIGHT_GROUND_Y = 286; // server GROUND_LEVEL (game-coords) — airborne = y above this
const FLIGHT_REF_HEIGHT = 300; // server FLAP_MAX_HEIGHT — normalises height → 0..1
const FLIGHT_PAN_UP = 9; // max extra upward pan (%) at full flight height (kept modest on purpose)

// Zoom range — nudged ~1.3% wider so more of the dohyo rope/platform reads in
// frame without shrinking the wrestlers noticeably. MIN_SCALE must still satisfy
// the edge clamp: 50 * (scale - 1) >= Y_OFFSET  →  scale >= 1 + Y_OFFSET/50.
const MIN_SCALE = Math.max(1.225, 1 + Y_OFFSET / 50); // widest zoom (~1.2% out vs old 1.24)
const MAX_SCALE = 1.555; // tightest zoom when players are very close
const DEFAULT_SCALE = 1.292; // fallback before game starts

// ── Frame-rate independence ─────────────────────────────────────────
// Every smoothing/decay constant in this file is authored against a 60fps
// reference frame. At runtime each is re-derived for the ACTUAL frame delta, so
// the camera feels identical — and hits carry identical weight — at 30/60/120/144Hz.
// (Previously these were applied raw per-frame: at 144Hz the camera settled ~2.4×
// faster and shake decayed ~2× faster, literally weakening hits on fast monitors.)
const REF_FRAME_MS = 1000 / 60; // 60fps reference frame (~16.67ms)
const MAX_DT_FRAMES = 4; // clamp huge deltas (tab refocus / GC stalls)

// Pan smoothing (authored per 60fps frame)
const SMOOTH_FACTOR = 0.07; // lerp speed per frame (0–1, higher = snappier)
// Asymmetric zoom: snap toward the action a touch faster than we ease apart, so
// approaches feel responsive and separations read as calm/deliberate.
const SMOOTH_ZOOM_IN = 0.1; // players closing → quicker push-in
const SMOOTH_ZOOM_OUT = 0.05; // players separating → slower pull-out

// Ready stance positions (must match server-io/gameFunctions.js handleReadyPositions)
const PLAYER1_READY_X = 543;
const PLAYER2_READY_X = 735;

// ── Unified trauma shake (Eiserloh model) ───────────────────────────
// All shake — hits AND events (parries, clashes, landings, ring-out…) — flows
// through the trauma bus (lib/cameraShake). Trauma is 0..1; the rendered offset
// is trauma², which front-loads the energy: a hit reads as a sharp spike that
// settles fast (the premium "crack") instead of a slow low-amplitude sway (the
// old "wobble"). The noise path keeps it organic + frame-rate independent, a
// directional bias gives real recoil, and translation is hard-clamped so map
// edges can never be exposed even with the micro-roll added.
const SHAKE_MAX_OFFSET_X = 34; // px at trauma = 1 (heaviest event)
const SHAKE_MAX_OFFSET_Y = 24; // px at trauma = 1 (vertical reads as ground impact)
const TRAUMA_DECAY = 3.0; // trauma units per second → trauma 1.0 settles in ~0.33s
const TRAUMA_STOP = 0.002; // cut to zero below this
const SHAKE_FREQ_HZ = 22; // oscillation frequency of the smooth shake path
const SHAKE_DIR_BIAS = 0.5; // share of amplitude given to directional recoil (rest = noise)

// ── Zoom punch-in ─────────────────────────────────────────────────
// The coupled scale push is the single biggest "weight" cue, but it's also the
// most disorienting if overused — so it's RARE by design (only heavy hits,
// perfect parry, KO, round start opt in via profile). Snappy decay keeps it a
// crisp punch, not a lingering/floaty zoom.
const PUNCH_DECAY = 0.86; // per-frame multiplier → ~110 ms (snappy)
const PUNCH_STOP = 0.001; // cut to zero below this

// ── Round-start "GO!" punch ──────────────────────────────────────
const ROUND_START_PUNCH_AMOUNT = 0.035;

// ── Cinematic kill camera ────────────────────────────────────────
const CINEMATIC_ZOOM_SCALE = 1.98; // ~10% out from 2.2
const CINEMATIC_SHAKE_TRAUMA = 0.9; // trauma floor held during freeze (heaviest in game)
const CINEMATIC_SHAKE_DECAY = 0.94;
const CINEMATIC_ZOOM_IN_SPEED = 0.18;
const CINEMATIC_PAN_SPEED = 0.12;

// Zoom-punch on cinematic-kill impact: briefly overshoot target zoom by this amount
// in the first 90ms of freeze. Sharp visual exclamation point — sells the moment of
// the killing blow before the cinematic lerp takes over.
const CINEMATIC_PUNCH_BOOST = 0.14;
const CINEMATIC_PUNCH_DURATION_MS = 90;
// On release (when cinematic exits freeze), pull back slightly past the locked scale
// for ~120ms before settling — a small "exhale" that reads as "the moment is over."
const CINEMATIC_RELEASE_PULL = 0.05;
const CINEMATIC_RELEASE_DURATION_MS = 120;
// ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getCameraTargetForPositions(p1x, p2x) {
  const distance = Math.abs(p1x - p2x);
  const midFraction =
    (p1x + SPRITE_HALF_W + (p2x + SPRITE_HALF_W)) / 2 / GAME_WIDTH;
  const t = clamp(
    (distance - CLOSE_DISTANCE) / (FAR_DISTANCE - CLOSE_DISTANCE),
    0,
    1,
  );
  const scale = lerp(MAX_SCALE, MIN_SCALE, t);
  return {
    scale,
    x: -(midFraction - 0.5) * scale * 100,
    y: Y_OFFSET,
  };
}

const READY_CAMERA = getCameraTargetForPositions(PLAYER1_READY_X, PLAYER2_READY_X);

// Pre-match broadcast wide shot — full pull-back so the dohyo + crowd read
// behind the banzuke program overlay (widest zoom, centered on the ring).
const PREMATCH_CAMERA = {
  scale: MIN_SCALE,
  x: 0,
  y: Y_OFFSET,
};

export default function useCamera(containerRef, socket, showPreMatchScreen = false) {
  const posRef = useRef({
    p1x: null,
    p2x: null,
    p1y: null,
    p2y: null,
    // Last-known flap flags. fighter_action is delta-encoded so isFlapping only
    // arrives on the ticks it changes — persist it so the flight pan stays gated
    // to actual flappers (and never tracks, e.g., a clinch-thrown player's Y).
    p1Flap: false,
    p2Flap: false,
  });
  const camRef = useRef({
    scale: PREMATCH_CAMERA.scale,
    x: PREMATCH_CAMERA.x,
    y: PREMATCH_CAMERA.y,
  });
  const rafId = useRef(null);

  // Impact state lives on the shared trauma bus (lib/cameraShake) so hits and
  // events all feed one renderer. Per-frame shake offsets are computed in the
  // rAF loop below from the bus's trauma value.

  // Frame-rate independence + smooth-shake timing
  const lastFrameRef = useRef(performance.now());
  const shakeClockRef = useRef(0); // accumulated wall-clock ms, drives the noise phase

  // Player-tracking is off during power-up selection, ready-up, and gyoji
  // calls — camera stays centered until HAKKIYOI (game_start).
  const trackingEnabledRef = useRef(false);

  const prematchRef = useRef(showPreMatchScreen);
  prematchRef.current = showPreMatchScreen;

  // Cinematic kill state
  const cinematicRef = useRef({
    active: false,
    phase: "none", // "freeze" | "release" | "hold" | "none"
    impactFraction: 0.5,
    startTime: 0,
    hitstopMs: 0,
    targetScale: CINEMATIC_ZOOM_SCALE,
    shakeTrauma: 0,
    knockbackDir: 1,
    holdStartTime: 0,
    releaseStartTime: 0,
    // Saved pre-freeze camera state
    preScale: DEFAULT_SCALE,
    preX: 0,
    preY: Y_OFFSET,
  });

  useEffect(() => {
    if (!socket) return;

    const onFighterAction = (data) => {
      const p1 = data.player1;
      const p2 = data.player2;

      // ── Position tracking ──
      // Hit shake is no longer derived here: it's driven explicitly by the
      // `player_hit` event (which carries attack type + string position) so we
      // can give the BIG hits (charged, slap-string finisher) a distinctly
      // crunchier profile than light pokes. See GameFighter handlePlayerHit.
      if (p1 && p2 && typeof p1.x === "number" && typeof p2.x === "number") {
        posRef.current.p1x = p1.x;
        posRef.current.p2x = p2.x;
        // Y is tracked too so the camera can follow flight (flap power-up).
        if (typeof p1.y === "number") posRef.current.p1y = p1.y;
        if (typeof p2.y === "number") posRef.current.p2y = p2.y;
        // Persist flap state across deltas (see posRef init note).
        if (typeof p1.isFlapping === "boolean") posRef.current.p1Flap = p1.isFlapping;
        if (typeof p2.isFlapping === "boolean") posRef.current.p2Flap = p2.isFlapping;
      }
    };

    const onCinematicKill = (data) => {
      const cin = cinematicRef.current;
      const cam = camRef.current;

      // Save current camera state before zoom-in
      cin.preScale = cam.scale;
      cin.preX = cam.x;
      cin.preY = cam.y;

      cin.active = true;
      cin.phase = "freeze";
      cin.impactFraction = (data.impactX ?? 640) / GAME_WIDTH;
      cin.startTime = performance.now();
      cin.hitstopMs = data.hitstopMs || 550;
      cin.targetScale = CINEMATIC_ZOOM_SCALE;
      cin.shakeTrauma = CINEMATIC_SHAKE_TRAUMA;
      cin.knockbackDir = data.knockbackDirection || 1;

      // Suppress normal impact effects during cinematic
      const s = getShakeState();
      s.trauma = 0;
      s.punch = 0;
    };

    const onGameReset = () => {
      const cin = cinematicRef.current;
      cin.active = false;
      cin.phase = "none";
      // Sync with server resetRoomAndPlayers — players teleport to spawn
      // positions and power-up selection begins on this same event.
      trackingEnabledRef.current = false;
    };

    // Round-start camera "GO!" punch.
    // Tiny zoom-in pulse at hakkiyoi (every round, including 2 & 3) so the start
    // of a round reads as a kick-off moment rather than a quiet fade-in. Reuses
    // the existing punch-decay loop, so this self-clears in ~200ms with no
    // dedicated state. Pulse is intentionally LIGHTER than a slap punch — the
    // moment should feel ceremonial, not violent. Skipped when the cinematic
    // camera is active so it can't interrupt a kill cinematic.
    // NOTE: User has a more fleshed-out "tachiai" system planned. This is a
    // placeholder/teaser. Deletion is trivial: remove this block + the .off().
    const onGameStart = () => {
      trackingEnabledRef.current = true;
      if (cinematicRef.current.active) return;
      // Ceremonial pulse — zoom only, no trauma (it's a kick-off, not a hit).
      addTrauma(0, { punch: ROUND_START_PUNCH_AMOUNT });
    };

    // Perfect parry: fire the dedicated heavy shake (trauma + zoom + roll).
    // Skipped during a kill cinematic so it can never step on the KO moment.
    const onPerfectParry = () => {
      if (cinematicRef.current.active) return;
      addShake("perfect_parry");
    };

    // ── Unified event shake — ALL server-emitted shakes route here ──
    // The server tags each shake with a `type` (mapped to a tuned profile) and
    // an optional `scale` (escalation / charge power) and `dirX` (recoil axis).
    // Falls back to a trauma derived from the legacy `intensity` if untyped.
    const onScreenShake = (data) => {
      if (cinematicRef.current.active) return;
      if (data?.type) {
        addShake(data.type, { scale: data.scale ?? 1, dirX: data.dirX ?? 0 });
      } else if (typeof data?.intensity === "number") {
        addTrauma(clamp(data.intensity * 0.45, 0, 1), { dirX: data.dirX ?? 0 });
      }
    };

    socket.on("fighter_action", onFighterAction);
    socket.on("cinematic_kill", onCinematicKill);
    socket.on("game_reset", onGameReset);
    socket.on("game_start", onGameStart);
    socket.on("perfect_parry", onPerfectParry);
    socket.on("screen_shake", onScreenShake);

    const tick = () => {
      const { p1x, p2x } = posRef.current;
      const el = containerRef?.current;

      // ── Frame-delta (measured every frame, even when idle) ──
      const now = performance.now();
      let dtMs = now - lastFrameRef.current;
      lastFrameRef.current = now;
      if (!isFinite(dtMs) || dtMs <= 0) dtMs = REF_FRAME_MS;
      shakeClockRef.current += dtMs;
      const dtFrames = Math.min(dtMs / REF_FRAME_MS, MAX_DT_FRAMES);
      // Re-derive a per-frame smoothing/decay rate for the actual delta.
      const lerpT = (perFrame) => 1 - Math.pow(1 - perFrame, dtFrames);
      const decayT = (perFrame) => Math.pow(perFrame, dtFrames);

      if (el && p1x !== null && p2x !== null) {
        const { scale: normalTargetScale, x: normalTargetX, y: normalTargetY } =
          getCameraTargetForPositions(p1x, p2x);

        const cam = camRef.current;
        const cin = cinematicRef.current;

        if (cin.active) {
          const elapsed = performance.now() - cin.startTime;

          if (cin.phase === "freeze") {
            // Zoom IN toward impact point.
            // Zoom-punch: for the first CINEMATIC_PUNCH_DURATION_MS we aim past the
            // target scale (overshoot), then settle. Reads as a sharp exclamation
            // point at the exact frame of impact — the AAA "I just got KO'd" feel.
            const cinematicTargetX =
              -(cin.impactFraction - 0.5) * cin.targetScale * 100;
            const cinematicTargetY = Y_OFFSET + 2;

            const punchT = Math.min(elapsed / CINEMATIC_PUNCH_DURATION_MS, 1);
            // Bell curve: 0 → 1 → 0 over the punch duration.
            const punchEnvelope = punchT < 1 ? Math.sin(punchT * Math.PI) : 0;
            const punchedTarget = cin.targetScale + CINEMATIC_PUNCH_BOOST * punchEnvelope;

            cam.scale = lerp(
              cam.scale,
              punchedTarget,
              lerpT(CINEMATIC_ZOOM_IN_SPEED),
            );
            cam.x = lerp(cam.x, cinematicTargetX, lerpT(CINEMATIC_ZOOM_IN_SPEED));
            cam.y = lerp(cam.y, cinematicTargetY, lerpT(CINEMATIC_ZOOM_IN_SPEED));

            // Heavy screen shake during freeze — drive the trauma floor.
            cin.shakeTrauma *= decayT(CINEMATIC_SHAKE_DECAY);
            if (cin.shakeTrauma > TRAUMA_STOP) {
              holdTrauma(cin.shakeTrauma);
            }

            if (elapsed >= cin.hitstopMs) {
              cin.phase = "release";
              cin.releaseStartTime = performance.now();
              // DON'T snap scale — let release phase ease the pull-back so we
              // get a smooth "exhale" instead of a hard cut.
              cam.y = cin.preY;
            }
          } else if (cin.phase === "release") {
            // "Exhale" pull: for ~120ms after freeze ends, pull the camera
            // slightly *past* the locked scale (zoom out a hair) before settling.
            // Tiny detail, big impact — reads as the camera relaxing after the kill.
            const lockedScale = Math.max(cin.preScale, DEFAULT_SCALE);
            const releaseElapsed = performance.now() - cin.releaseStartTime;
            const pullT = Math.min(releaseElapsed / CINEMATIC_RELEASE_DURATION_MS, 1);
            const pullEnvelope = pullT < 1 ? Math.sin(pullT * Math.PI) : 0;
            const releaseTargetScale = lockedScale - CINEMATIC_RELEASE_PULL * pullEnvelope;
            cam.scale = lerp(cam.scale, releaseTargetScale, lerpT(CINEMATIC_ZOOM_IN_SPEED));
            cam.y = lerp(cam.y, normalTargetY, lerpT(SMOOTH_FACTOR));

            // Pan toward the knockout edge at locked zoom
            const maxPan = 50 * (cam.scale - 1);
            const edgeTargetX = cin.knockbackDir < 0 ? maxPan : -maxPan;
            cam.x = lerp(cam.x, edgeTargetX, lerpT(CINEMATIC_PAN_SPEED));

            if (Math.abs(cam.x - edgeTargetX) < 0.5 && pullT >= 1) {
              cam.x = edgeTargetX;
              cam.scale = lockedScale;
              cin.phase = "hold";
              cin.holdStartTime = performance.now();
            }
          } else if (cin.phase === "hold") {
            // Stay locked at the edge — only game_reset clears cinematic state
            cam.scale = Math.max(cin.preScale, DEFAULT_SCALE);
            const maxPan = 50 * (cam.scale - 1);
            const edgeTargetX = cin.knockbackDir < 0 ? maxPan : -maxPan;
            cam.x = edgeTargetX;
            cam.y = lerp(cam.y, normalTargetY, lerpT(SMOOTH_FACTOR));
          }
        } else if (trackingEnabledRef.current) {
          // ── Normal camera behavior — track players during active rounds ──
          // Asymmetric zoom: push IN faster than we pull OUT.
          const zoomRate =
            normalTargetScale > cam.scale ? SMOOTH_ZOOM_IN : SMOOTH_ZOOM_OUT;
          cam.scale = lerp(cam.scale, normalTargetScale, lerpT(zoomRate));
          cam.x = lerp(cam.x, normalTargetX, lerpT(SMOOTH_FACTOR));

          // Vertical flight follow: pan up a touch ONLY when a FLAPPING wrestler
          // is airborne (flap take-off). Gated on the flap flag so other sources
          // of altitude — e.g. a clinch/grab cinematic throw arcing a player up —
          // never drag the camera's Y. Scaled by the highest flapper, hard-capped
          // at FLIGHT_PAN_UP, and still subject to the maxPanY clamp below.
          const { p1y, p2y, p1Flap, p2Flap } = posRef.current;
          const air1 =
            p1Flap && typeof p1y === "number" ? p1y - FLIGHT_GROUND_Y : 0;
          const air2 =
            p2Flap && typeof p2y === "number" ? p2y - FLIGHT_GROUND_Y : 0;
          const maxAir = Math.max(0, air1, air2);
          const flightPanUp =
            clamp(maxAir / FLIGHT_REF_HEIGHT, 0, 1) * FLIGHT_PAN_UP;
          cam.y = lerp(cam.y, normalTargetY + flightPanUp, lerpT(SMOOTH_FACTOR));
        } else {
          // ── Pre-fight / between rounds — prematch = wide broadcast, else ready stance ──
          const idleTarget = prematchRef.current ? PREMATCH_CAMERA : READY_CAMERA;
          cam.scale = lerp(cam.scale, idleTarget.scale, lerpT(SMOOTH_FACTOR));
          cam.x = lerp(cam.x, idleTarget.x, lerpT(SMOOTH_FACTOR));
          cam.y = lerp(cam.y, idleTarget.y, lerpT(SMOOTH_FACTOR));
        }

        // ── Clamp so map edges are never exposed ──
        const maxPanX = 50 * (cam.scale - 1);
        const maxPanY = 50 * (cam.scale - 1);
        cam.x = clamp(cam.x, -maxPanX, maxPanX);
        cam.y = clamp(cam.y, -maxPanY, maxPanY);

        // ── Unified trauma shake — trauma² envelope + directional recoil ──
        // Rendered offset scales with trauma² so energy is front-loaded (sharp
        // spike, fast settle = "crack", not "wobble"). X blends a directional
        // recoil (along the impact axis) with smooth value-noise; Y is pure
        // noise (vertical reads as ground impact); a tiny noise-driven roll adds
        // AAA snap. Translation is hard-clamped below so edges stay hidden.
        const shakeState = getShakeState();
        let shakeX = 0;
        let shakeY = 0;
        let shakeRot = 0;
        if (shakeState.trauma > TRAUMA_STOP) {
          const amt = shakeState.trauma * shakeState.trauma; // perceptual curve
          const phase = (shakeClockRef.current / 1000) * SHAKE_FREQ_HZ;
          const nx = valueNoise(phase);
          const ny = valueNoise(phase + 37.3); // decorrelated channel
          const nr = valueNoise(phase + 71.7); // decorrelated roll channel
          const dir = shakeState.dirX * SHAKE_DIR_BIAS;
          shakeX = (dir + nx * (1 - SHAKE_DIR_BIAS)) * amt * SHAKE_MAX_OFFSET_X;
          shakeY = ny * amt * SHAKE_MAX_OFFSET_Y;
          shakeRot = nr * amt * shakeState.rot;
          // Time-based linear trauma decay (frame-rate independent).
          shakeState.trauma = Math.max(
            0,
            shakeState.trauma - TRAUMA_DECAY * (dtMs / 1000),
          );
        } else {
          shakeState.trauma = 0;
          resetShakeBias();
        }

        // Zoom-punch decays per-frame (independent of trauma so a punch can
        // outlast / precede the rattle, e.g. the ceremonial round-start pulse).
        if (shakeState.punch > PUNCH_STOP) {
          shakeState.punch *= decayT(PUNCH_DECAY);
        } else {
          shakeState.punch = 0;
        }

        // ── Snap values and write CSS custom properties ──
        const cw = el.offsetWidth;
        const ch = el.offsetHeight;

        // Effective scale includes the punch-in boost
        const effectiveScale = cam.scale + shakeState.punch;

        // Recompute edge limits using effective scale so the punch's
        // extra zoom gives more pan headroom — shake never exposes edges.
        const maxPxX = Math.floor((50 * (effectiveScale - 1) * cw) / 100);
        const maxPxY = Math.floor((50 * (effectiveScale - 1) * ch) / 100);

        const snappedScale = Math.round(effectiveScale * 1000) / 1000;
        const pixelX = clamp(
          Math.round((cam.x * cw) / 100 + shakeX),
          -maxPxX,
          maxPxX,
        );
        const pixelY = clamp(
          Math.round((cam.y * ch) / 100 + shakeY),
          -maxPxY,
          maxPxY,
        );

        el.style.setProperty("--cam-scale", snappedScale);
        el.style.setProperty("--cam-x", pixelX + "px");
        el.style.setProperty("--cam-y", pixelY + "px");
        el.style.setProperty("--cam-rot", shakeRot.toFixed(3) + "deg");
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      socket.off("fighter_action", onFighterAction);
      socket.off("cinematic_kill", onCinematicKill);
      socket.off("game_reset", onGameReset);
      socket.off("game_start", onGameStart);
      socket.off("perfect_parry", onPerfectParry);
      socket.off("screen_shake", onScreenShake);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [containerRef, socket]);
}
