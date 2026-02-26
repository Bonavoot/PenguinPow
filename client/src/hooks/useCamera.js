import { useEffect, useRef } from "react";

// ── Tunable constants ──────────────────────────────────────────────
const GAME_WIDTH = 1280;

const MIN_SCALE = 1.08;      // widest zoom — slightly tighter than full map
const MAX_SCALE = 1.6;       // tightest zoom when players are very close
const DEFAULT_SCALE = 1.35;  // fallback before game starts

const CLOSE_DISTANCE = 100;  // player gap (game-coords) for max zoom
const FAR_DISTANCE = 700;    // player gap (game-coords) for min zoom

const SPRITE_HALF_W = 0;     // Sprites are now centred on player.x via CSS translate
const SMOOTH_FACTOR = 0.07;  // lerp speed per frame (0–1, higher = snappier)
const Y_OFFSET = 10;         // fixed vertical bias (%) — positive = show more top

// ── Impact shake ─────────────────────────────────────────────────
const SHAKE_MIN = 2;         // px — lightest hit (slap)
const SHAKE_MAX = 7;         // px — heaviest hit (full-charge + power-up)
const SHAKE_DECAY = 0.88;    // per-frame multiplier → ~150 ms at 60 fps
const SHAKE_STOP = 0.3;      // cut to zero below this

// ── Hit zoom punch-in ────────────────────────────────────────────
const PUNCH_MIN = 0.02;      // scale boost — light hit
const PUNCH_MAX = 0.06;      // scale boost — heavy hit
const PUNCH_DECAY = 0.92;    // per-frame multiplier → ~200 ms
const PUNCH_STOP = 0.001;    // cut to zero below this

// Knockback reference ceiling for normalising intensity
const KB_REF = 2.5;

// ── Cinematic kill camera ────────────────────────────────────────
const CINEMATIC_ZOOM_SCALE = 2.2;
const CINEMATIC_SHAKE_INTENSITY = 12;
const CINEMATIC_SHAKE_DECAY = 0.94;
const CINEMATIC_ZOOM_IN_SPEED = 0.18;
const CINEMATIC_PAN_SPEED = 0.12;
const CINEMATIC_MIN_HOLD_MS = 2000;
// ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function useCamera(containerRef, socket) {
  const posRef = useRef({ p1x: null, p2x: null });
  const camRef = useRef({
    scale: DEFAULT_SCALE,
    x: 0,
    y: Y_OFFSET,
  });
  const rafId = useRef(null);

  // Impact state — written by the socket handler, consumed by the rAF loop
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });
  const punchRef = useRef({ amount: 0 });
  const hitTrackRef = useRef({ p1: 0, p2: 0 });

  // Cinematic kill state
  const cinematicRef = useRef({
    active: false,
    phase: "none",       // "freeze" | "release" | "none"
    impactFraction: 0.5,
    startTime: 0,
    hitstopMs: 0,
    targetScale: CINEMATIC_ZOOM_SCALE,
    shakeIntensity: 0,
    knockbackDir: 1,
    holdStartTime: 0,
    // Saved pre-freeze camera state
    preScale: DEFAULT_SCALE,
    preX: 0,
    preY: Y_OFFSET,
  });

  useEffect(() => {
    if (!socket) return;

    // ── Trigger an impact effect scaled by knockback strength ──
    const triggerImpact = (knockbackX) => {
      const t = clamp(Math.abs(knockbackX) / KB_REF, 0.3, 1);
      const shake = SHAKE_MIN + t * (SHAKE_MAX - SHAKE_MIN);
      const punch = PUNCH_MIN + t * (PUNCH_MAX - PUNCH_MIN);

      shakeRef.current.intensity = Math.max(shakeRef.current.intensity, shake);
      punchRef.current.amount = Math.max(punchRef.current.amount, punch);
    };

    const onFighterAction = (data) => {
      const p1 = data.player1;
      const p2 = data.player2;

      // ── Position tracking (existing) ──
      if (p1 && p2 && typeof p1.x === "number" && typeof p2.x === "number") {
        posRef.current.p1x = p1.x;
        posRef.current.p2x = p2.x;
      }

      // ── Hit detection via hitCounter (most reliable signal) ──
      const track = hitTrackRef.current;
      if (p1?.hitCounter != null) {
        if (p1.hitCounter > track.p1) {
          triggerImpact(p1.knockbackVelocity?.x ?? 1);
        }
        track.p1 = p1.hitCounter;
      }
      if (p2?.hitCounter != null) {
        if (p2.hitCounter > track.p2) {
          triggerImpact(p2.knockbackVelocity?.x ?? 1);
        }
        track.p2 = p2.hitCounter;
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
      cin.shakeIntensity = CINEMATIC_SHAKE_INTENSITY;
      cin.knockbackDir = data.knockbackDirection || 1;

      // Suppress normal impact effects during cinematic
      shakeRef.current.intensity = 0;
      punchRef.current.amount = 0;
    };

    socket.on("fighter_action", onFighterAction);
    socket.on("cinematic_kill", onCinematicKill);

    const tick = () => {
      const { p1x, p2x } = posRef.current;
      const el = containerRef?.current;

      if (el && p1x !== null && p2x !== null) {
        const distance = Math.abs(p1x - p2x);
        const midFraction =
          ((p1x + SPRITE_HALF_W) + (p2x + SPRITE_HALF_W)) / 2 / GAME_WIDTH;

        // ── Target zoom ──
        const t = clamp(
          (distance - CLOSE_DISTANCE) / (FAR_DISTANCE - CLOSE_DISTANCE),
          0,
          1,
        );
        const normalTargetScale = lerp(MAX_SCALE, MIN_SCALE, t);
        const normalTargetX = -(midFraction - 0.5) * normalTargetScale * 100;
        const normalTargetY = Y_OFFSET;

        const cam = camRef.current;
        const cin = cinematicRef.current;

        if (cin.active) {
          const elapsed = performance.now() - cin.startTime;

          if (cin.phase === "freeze") {
            // Zoom IN toward impact point
            const cinematicTargetX = -(cin.impactFraction - 0.5) * cin.targetScale * 100;
            const cinematicTargetY = Y_OFFSET + 2;

            cam.scale = lerp(cam.scale, cin.targetScale, CINEMATIC_ZOOM_IN_SPEED);
            cam.x = lerp(cam.x, cinematicTargetX, CINEMATIC_ZOOM_IN_SPEED);
            cam.y = lerp(cam.y, cinematicTargetY, CINEMATIC_ZOOM_IN_SPEED);

            // Heavy screen shake during freeze
            cin.shakeIntensity *= CINEMATIC_SHAKE_DECAY;
            if (cin.shakeIntensity > SHAKE_STOP) {
              shakeRef.current.intensity = cin.shakeIntensity;
            }

            if (elapsed >= cin.hitstopMs) {
              cin.phase = "release";
              // Snap scale and Y back to pre-freeze state immediately
              cam.scale = cin.preScale;
              cam.y = cin.preY;
            }
          } else if (cin.phase === "release") {
            // Lock scale at pre-freeze level — no zooming out further
            cam.scale = cin.preScale;
            cam.y = lerp(cam.y, normalTargetY, SMOOTH_FACTOR);

            // Pan toward the knockout edge at locked zoom
            const maxPan = 50 * (cam.scale - 1);
            const edgeTargetX = cin.knockbackDir < 0 ? maxPan : -maxPan;
            cam.x = lerp(cam.x, edgeTargetX, CINEMATIC_PAN_SPEED);

            if (Math.abs(cam.x - edgeTargetX) < 0.5) {
              cam.x = edgeTargetX;
              cin.phase = "hold";
              cin.holdStartTime = performance.now();
            }
          } else if (cin.phase === "hold") {
            // Stay locked at the edge until players are close again (next round)
            cam.scale = cin.preScale;
            const maxPan = 50 * (cam.scale - 1);
            const edgeTargetX = cin.knockbackDir < 0 ? maxPan : -maxPan;
            cam.x = edgeTargetX;
            cam.y = lerp(cam.y, normalTargetY, SMOOTH_FACTOR);

            const holdElapsed = performance.now() - cin.holdStartTime;
            if (holdElapsed >= CINEMATIC_MIN_HOLD_MS && distance < FAR_DISTANCE) {
              cin.active = false;
              cin.phase = "none";
            }
          }
        } else {
          // ── Normal camera behavior ──
          cam.scale = lerp(cam.scale, normalTargetScale, SMOOTH_FACTOR);
          cam.x = lerp(cam.x, normalTargetX, SMOOTH_FACTOR);
          cam.y = lerp(cam.y, normalTargetY, SMOOTH_FACTOR);
        }

        // ── Clamp so map edges are never exposed ──
        const maxPanX = 50 * (cam.scale - 1);
        const maxPanY = 50 * (cam.scale - 1);
        cam.x = clamp(cam.x, -maxPanX, maxPanX);
        cam.y = clamp(cam.y, -maxPanY, maxPanY);

        // ── Decay impact effects ──
        const shake = shakeRef.current;
        if (shake.intensity > SHAKE_STOP) {
          shake.x = (Math.random() - 0.5) * 2 * shake.intensity;
          shake.y = (Math.random() - 0.5) * 2 * shake.intensity;
          shake.intensity *= SHAKE_DECAY;
        } else {
          shake.x = 0;
          shake.y = 0;
          shake.intensity = 0;
        }

        const punch = punchRef.current;
        if (punch.amount > PUNCH_STOP) {
          punch.amount *= PUNCH_DECAY;
        } else {
          punch.amount = 0;
        }

        // ── Snap values and write CSS custom properties ──
        const cw = el.offsetWidth;
        const ch = el.offsetHeight;

        // Effective scale includes the punch-in boost
        const effectiveScale = cam.scale + punch.amount;

        // Recompute edge limits using effective scale so the punch's
        // extra zoom gives more pan headroom — shake never exposes edges.
        const maxPxX = Math.floor(50 * (effectiveScale - 1) * cw / 100);
        const maxPxY = Math.floor(50 * (effectiveScale - 1) * ch / 100);

        const snappedScale = Math.round(effectiveScale * 1000) / 1000;
        const pixelX = clamp(
          Math.round(cam.x * cw / 100 + shake.x),
          -maxPxX, maxPxX,
        );
        const pixelY = clamp(
          Math.round(cam.y * ch / 100 + shake.y),
          -maxPxY, maxPxY,
        );

        el.style.setProperty("--cam-scale", snappedScale);
        el.style.setProperty("--cam-x", pixelX + "px");
        el.style.setProperty("--cam-y", pixelY + "px");
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => {
      socket.off("fighter_action", onFighterAction);
      socket.off("cinematic_kill", onCinematicKill);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [containerRef, socket]);
}
