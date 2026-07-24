import { memo, forwardRef } from "react";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";
import { SHADOW_GROUND_LEVEL } from "./PlayerShadow";

const GROUND_LEVEL = SHADOW_GROUND_LEVEL;

/**
 * How far to lift the reflection (as % of the 720 design height) so the
 * silhouette meets the sprite feet. Fighter art has empty padding under the
 * soles; without this nudge the flip hangs a visible gap under the toes.
 * Kept in sync with GameFighter's imperative position writes.
 */
export const ICE_REFLECTION_FOOT_NUDGE_PCT = 2.1;

/** Standing opacity — present but subtle on the ice. */
export const ICE_REFLECTION_BASE_OPACITY = 0.28;
/** Quieter while the fighter is in the sidestep depth lane. */
export const ICE_REFLECTION_SIDESTEP_OPACITY = 0.12;
/** Height above ground (design px) at which the reflection fully fades out. */
export const ICE_REFLECTION_HEIGHT_FADE_PX = 96;

/**
 * Hide when fallen off the platform, or RoundResult force-hides the loser.
 * Overflow onto rope/dirt is handled by the shared `.ice-reflection-clip`
 * ellipse — no per-sprite MAP math.
 */
export function iceReflectionShouldShow(x, y, { forceHide = false } = {}) {
  if (forceHide) return false;
  return !isOutsideDohyo(x, y);
}

/**
 * Reflection stays pinned to the ice (except sidestep, which tracks the lane dip).
 * Exported so GameFighter's per-frame writes use the same rule.
 */
export function iceReflectionBottomY(
  y,
  { isSidestepping = false, pinY = null } = {}
) {
  if (pinY != null) return pinY;
  return isSidestepping ? y : GROUND_LEVEL;
}

/**
 * Base opacity × airborne height fade — puddle stays on the ice and softens
 * as the fighter leaves the ground (no floating clone).
 * Always 0 when fallen / force-hidden so the rAF path can hide it immediately.
 * When `pinY` is set (fixed ground actor), skip the airborne fade.
 */
export function iceReflectionOpacity(
  x,
  y,
  { isSidestepping = false, forceHide = false, pinY = null } = {}
) {
  if (!iceReflectionShouldShow(x, y, { forceHide })) return 0;
  const base = isSidestepping
    ? ICE_REFLECTION_SIDESTEP_OPACITY
    : ICE_REFLECTION_BASE_OPACITY;
  if (pinY != null) return base;
  const heightAbove = Math.max(0, y - GROUND_LEVEL);
  const fade = Math.max(0, 1 - heightAbove / ICE_REFLECTION_HEIGHT_FADE_PX);
  return base * fade;
}

/**
 * Frosted-ice reflection under a fighter — the main ground read on the dohyo.
 * Flipped silhouette, tipped onto the rink plane, pinned when airborne.
 * Must be portaled into `.ice-reflection-clip` so only the ice disc shows it.
 */
const IceReflection = memo(
  forwardRef(
    (
      {
        x,
        y,
        facing,
        src,
        isAnimated,
        frameCount = 1,
        fps = 30,
        loop = true,
        isSidestepping,
        forceHide,
        /** Optional fixed ice Y (design px) — gyoji / non-fighter actors. */
        pinY = null,
        /** Optional width override (fighters default to min(12.1%, 372px)). */
        width = "min(12.1%, 372px)",
        /**
         * Optional CSS % placement — when set, skips design-space x/y → % math.
         * Use with left-edge anchors (e.g. gyoji) so the puddle shares the
         * sprite's exact plant instead of a parallel center-based coordinate.
         */
        leftPct = null,
        bottomPct = null,
        /** When true with leftPct, left is the box edge (no translate -50%). */
        anchorLeftEdge = false,
        /** Optional visual overrides (gyoji keeps a quieter supporting-cast puddle). */
        opacity: opacityOverride = null,
        squash: squashOverride = null,
        planeTipDeg: planeTipOverride = null,
        zIndex = 2,
      },
      ref
    ) => {
      const show =
        (bottomPct != null || iceReflectionShouldShow(x, y, { forceHide })) &&
        !!src;
      if (!show) {
        return (
          <div
            ref={ref}
            style={{ display: "none", opacity: 0, visibility: "hidden" }}
            aria-hidden="true"
          />
        );
      }

      const bottomY = iceReflectionBottomY(y, { isSidestepping, pinY });
      const frames = Math.max(1, frameCount | 0);
      const duration = frames / (fps || 30);
      const face = facing === 1 ? 1 : -1;

      // Foreshorten onto the tilted ice; keep enough height that the body
      // silhouette still reads (not a foot-smudge).
      const squash = squashOverride ?? 0.34;
      const planeTipDeg = planeTipOverride ?? 22;
      const reflectOpacity =
        opacityOverride != null
          ? opacityOverride
          : bottomPct != null
            ? ICE_REFLECTION_BASE_OPACITY
            : iceReflectionOpacity(x, y, {
                isSidestepping,
                forceHide,
                pinY,
              });

      const left =
        leftPct != null ? `${leftPct}%` : `${(x / 1280) * 100}%`;
      const bottom =
        bottomPct != null
          ? `${bottomPct}%`
          : `${(bottomY / 720) * 100 + ICE_REFLECTION_FOOT_NUDGE_PCT}%`;

      return (
        <div
          ref={ref}
          aria-hidden="true"
          style={{
            position: "absolute",
            left,
            bottom,
            width,
            aspectRatio: "1",
            // Fighters / center anchors: left is the midline. Left-edge anchors
            // (gyoji) share the sprite's `left` and skip the -50% shift.
            ...(anchorLeftEdge ? {} : { translate: "-50%" }),
            pointerEvents: "none",
            zIndex,
            opacity: reflectOpacity,
            visibility: "visible",
            display: "block",
            willChange: "bottom, left, opacity",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              transform: `perspective(360px) rotateX(${planeTipDeg}deg) scaleX(${face}) scaleY(${-squash})`,
              transformOrigin: "center bottom",
              // Strongest at the feet, then a smooth dissolve upward into the ice
              WebkitMaskImage:
                "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.62) 22%, rgba(0,0,0,0.34) 48%, rgba(0,0,0,0.12) 72%, rgba(0,0,0,0) 92%)",
              maskImage:
                "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.62) 22%, rgba(0,0,0,0.34) 48%, rgba(0,0,0,0.12) 72%, rgba(0,0,0,0) 92%)",
              filter: "brightness(0.55) saturate(0.45) blur(1.15px)",
              mixBlendMode: "multiply",
            }}
          >
            {isAnimated && frames > 1 ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                }}
              >
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  decoding="async"
                  style={{
                    display: "block",
                    height: "100%",
                    width: "auto",
                    maxWidth: "none",
                    backfaceVisibility: "hidden",
                    animation: `spritesheet-${frames} ${duration}s steps(${
                      frames - 1
                    }) ${loop !== false ? "infinite" : "forwards"}`,
                  }}
                />
              </div>
            ) : (
              <img
                src={src}
                alt=""
                draggable={false}
                decoding="async"
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "center bottom",
                  backfaceVisibility: "hidden",
                }}
              />
            )}
          </div>
        </div>
      );
    }
  )
);

IceReflection.displayName = "IceReflection";

IceReflection.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  src: PropTypes.string,
  isAnimated: PropTypes.bool,
  frameCount: PropTypes.number,
  fps: PropTypes.number,
  loop: PropTypes.bool,
  isSidestepping: PropTypes.bool,
  forceHide: PropTypes.bool,
  pinY: PropTypes.number,
  width: PropTypes.string,
  leftPct: PropTypes.number,
  bottomPct: PropTypes.number,
  anchorLeftEdge: PropTypes.bool,
  opacity: PropTypes.number,
  squash: PropTypes.number,
  planeTipDeg: PropTypes.number,
  zIndex: PropTypes.number,
};

export default IceReflection;
