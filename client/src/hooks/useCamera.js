import { useEffect, useRef } from "react";

// ── Tunable constants ──────────────────────────────────────────────
const GAME_WIDTH = 1280;

const MIN_SCALE = 1.08;      // widest zoom — slightly tighter than full map
const MAX_SCALE = 1.6;       // tightest zoom when players are very close
const DEFAULT_SCALE = 1.35;  // fallback before game starts

const CLOSE_DISTANCE = 100;  // player gap (game-coords) for max zoom
const FAR_DISTANCE = 700;    // player gap (game-coords) for min zoom

const SPRITE_HALF_W = 80;    // ≈ half sprite width in game-coords (centres on penguin body)
const SMOOTH_FACTOR = 0.07;  // lerp speed per frame (0–1, higher = snappier)
const Y_OFFSET = 5;          // fixed vertical bias (%) — positive = show more top

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

    socket.on("fighter_action", onFighterAction);

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
        const targetScale = lerp(MAX_SCALE, MIN_SCALE, t);

        // ── Target pan ──
        const targetX = -(midFraction - 0.5) * targetScale * 100;
        const targetY = Y_OFFSET;

        // ── Smooth lerp ──
        const cam = camRef.current;
        cam.scale = lerp(cam.scale, targetScale, SMOOTH_FACTOR);
        cam.x = lerp(cam.x, targetX, SMOOTH_FACTOR);
        cam.y = lerp(cam.y, targetY, SMOOTH_FACTOR);

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
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [containerRef, socket]);
}
