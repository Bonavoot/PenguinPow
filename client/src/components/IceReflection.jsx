import { memo, forwardRef } from "react";
import PropTypes from "prop-types";
import { isOutsideDohyo } from "../constants";
import { useLowSpec } from "../utils/lowSpecMode";
import { SHADOW_GROUND_LEVEL } from "./PlayerShadow";

const GROUND_LEVEL = SHADOW_GROUND_LEVEL;

/**
 * How far to lift the reflection (as % of the 720 design height) so the
 * silhouette meets the sprite feet. Fighter art has empty padding under the
 * soles; without this nudge the flip hangs a visible gap under the toes.
 * Kept in sync with GameFighter's imperative position writes.
 */
export const ICE_REFLECTION_FOOT_NUDGE_PCT = 2.1;

/** Standing opacity — colored multiply on cyan ice, not a shadow stain. */
export const ICE_REFLECTION_BASE_OPACITY = 0.44;
/**
 * Near-camera cap (sidestep lane dip toward the viewer). Ice is more
 * mirror-like at a glancing angle (Fresnel) — the opposite of the old
 * "quiet the puddle" sidestep dim.
 */
export const ICE_REFLECTION_NEAR_OPACITY = 0.58;
/** Design-px of downward dip that reaches full near Fresnel. */
export const ICE_REFLECTION_FRESNEL_DIP_PX = 48;
/** Height above ground (design px) at which the reflection fully fades out. */
export const ICE_REFLECTION_HEIGHT_FADE_PX = 96;

/** Foreshorten onto the tilted ice — tall enough that belly + mawashi still read. */
const DEFAULT_SQUASH = 0.45;
const DEFAULT_PLANE_TIP_DEG = 22;

// Frost at the soles, distance fade in the body — still a flipped silhouette.
const SHARP_MASK =
  "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.9) 8%, rgba(0,0,0,0.5) 28%, rgba(0,0,0,0.1) 44%, transparent 52%)";
const SOFT_MASK =
  "linear-gradient(to top, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.2) 10%, rgba(0,0,0,0.68) 28%, rgba(0,0,0,0.5) 54%, rgba(0,0,0,0.16) 74%, transparent 90%)";
const SHARP_FILTER =
  "brightness(0.82) contrast(1.22) saturate(1.24) drop-shadow(0.6px 0 0 rgba(70, 190, 255, 0.34)) drop-shadow(-0.45px 0 0 rgba(220, 70, 50, 0.13)) blur(0.4px)";
const SOFT_FILTER =
  "brightness(0.72) contrast(1.14) saturate(1.14) blur(1.85px)";

/**
 * Hide when fallen off the platform, or RoundResult force-hides the loser.
 * Overflow onto tawara / dirt / snow is handled by `.ice-reflection-clip`'s
 * ice-mask.webp — that mask IS the tawara interior (ice + tachiai) measured
 * from dohyo-display.webp. Gameplay rects (MAP / DOHYO X) are not the ice shape.
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

/** Actor-space ice disc (matches dohyo-display.webp / ice-mask.webp). */
const ICE_ELLIPSE_CX = 640;
const ICE_ELLIPSE_RX = 314;

/**
 * Base opacity × airborne height fade, with Fresnel toward camera and
 * toward the left/right rim of the ice ellipse (more mirror at glancing angles).
 * Always 0 when fallen / force-hidden so the rAF path can hide it immediately.
 * When `pinY` is set (fixed ground actor), skip airborne fade and Fresnel.
 */
export function iceReflectionOpacity(
  x,
  y,
  { isSidestepping = false, forceHide = false, pinY = null } = {}
) {
  if (!iceReflectionShouldShow(x, y, { forceHide })) return 0;
  if (pinY != null) return ICE_REFLECTION_BASE_OPACITY;
  let fresnel = 0;
  if (isSidestepping) {
    const dip = Math.max(0, GROUND_LEVEL - y);
    fresnel = Math.min(1, dip / ICE_REFLECTION_FRESNEL_DIP_PX);
  }
  const rim = Math.min(1, Math.abs(x - ICE_ELLIPSE_CX) / ICE_ELLIPSE_RX);
  fresnel = Math.max(fresnel, rim * 0.45);
  const base =
    ICE_REFLECTION_BASE_OPACITY +
    (ICE_REFLECTION_NEAR_OPACITY - ICE_REFLECTION_BASE_OPACITY) * fresnel;
  const heightAbove = Math.max(0, y - GROUND_LEVEL);
  const fade = Math.max(0, 1 - heightAbove / ICE_REFLECTION_HEIGHT_FADE_PX);
  return base * fade;
}

function ReflectionSprite({
  src,
  isAnimated,
  frames,
  duration,
  loop,
}) {
  if (isAnimated && frames > 1) {
    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
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
    );
  }
  return (
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
  );
}

ReflectionSprite.propTypes = {
  src: PropTypes.string.isRequired,
  isAnimated: PropTypes.bool,
  frames: PropTypes.number.isRequired,
  duration: PropTypes.number.isRequired,
  loop: PropTypes.bool,
};

/**
 * Wet-rink reflection under a fighter.
 *
 * Must be portaled into `.ice-reflection-clip` — that host's mask is the
 * tawara interior on dohyo-display.webp (ice + tachiai), so this can only
 * paint inside the rope. The host lives in .game-scene (under the gyoji).
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
        /** Foot AO / wet meniscus / sparkles — off for supporting-cast actors. */
        contactFx = true,
      },
      ref
    ) => {
      // Blur + mask + 3D + multiply under camera motion is a top M1 cost.
      // Keep a hidden host so GameFighter's reflectionDomRef stays valid.
      const lowSpec = useLowSpec();
      const show =
        !lowSpec &&
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

      const squash = squashOverride ?? DEFAULT_SQUASH;
      const planeTipDeg = planeTipOverride ?? DEFAULT_PLANE_TIP_DEG;
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

      const spriteProps = {
        src,
        isAnimated,
        frames,
        duration,
        loop,
      };

      const maskStyle = (mask) => ({
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
      });

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
            ...(anchorLeftEdge ? {} : { translate: "-50%" }),
            pointerEvents: "none",
            opacity: reflectOpacity,
            visibility: "visible",
            display: "block",
          }}
        >
          {contactFx && (
            <>
              {/* Light wrapping through the ice — quiet pool under the body. */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "1.8%",
                  width: "44%",
                  height: "8%",
                  translate: "-50%",
                  borderRadius: "50%",
                  zIndex: 1,
                  pointerEvents: "none",
                  opacity: 0.28,
                  background:
                    "radial-gradient(ellipse at 50% 55%, rgba(186, 226, 255, 0.5) 0%, rgba(140, 198, 240, 0.14) 40%, transparent 68%)",
                }}
              />
              {/* Contact occlusion — tight sole stain, not a blurry oval. */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "1.6%",
                  width: "26%",
                  height: "3.6%",
                  translate: "-50%",
                  borderRadius: "50%",
                  zIndex: 1,
                  pointerEvents: "none",
                  background:
                    "radial-gradient(ellipse at 50% 50%, rgba(8, 24, 46, 0.42) 0%, rgba(12, 42, 72, 0.16) 40%, transparent 62%)",
                }}
              />
            </>
          )}

          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex,
              transform: `perspective(360px) rotateX(${planeTipDeg}deg) scaleX(${face}) scaleY(${-squash})`,
              transformOrigin: "center bottom",
            }}
          >
            {/* Soft body copy — distance blur + slight horizontal ice streak. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: "scaleX(1.08)",
                transformOrigin: "center bottom",
                ...maskStyle(SOFT_MASK),
                filter: SOFT_FILTER,
                opacity: 0.88,
              }}
            >
              <ReflectionSprite {...spriteProps} />
            </div>
            {/* Sharp contact copy — readable color at the soles. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                ...maskStyle(SHARP_MASK),
                filter: SHARP_FILTER,
              }}
            >
              <ReflectionSprite {...spriteProps} />
            </div>
          </div>

          {contactFx && (
            <>
              {/* Wet meniscus — hairline where soles meet the ice. */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "2.2%",
                  width: "38%",
                  height: "3.2%",
                  translate: "-50%",
                  borderRadius: "50%",
                  zIndex: 6,
                  pointerEvents: "none",
                  background:
                    "radial-gradient(ellipse at 50% 50%, rgba(245, 252, 255, 0.85) 0%, rgba(190, 230, 255, 0.35) 45%, transparent 72%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 6,
                  transform: `scaleX(${face})`,
                  transformOrigin: "center bottom",
                  pointerEvents: "none",
                }}
              >
                <span
                  className="ice-contact-sparkle"
                  style={{
                    left: "36%",
                    bottom: "3.4%",
                    width: "4.2%",
                    height: "4.2%",
                    animationDelay: "0s",
                  }}
                />
                <span
                  className="ice-contact-sparkle"
                  style={{
                    left: "58%",
                    bottom: "2.6%",
                    width: "3.1%",
                    height: "3.1%",
                    animationDelay: "0.85s",
                  }}
                />
                <span
                  className="ice-contact-sparkle"
                  style={{
                    left: "47%",
                    bottom: "4.8%",
                    width: "2.4%",
                    height: "2.4%",
                    animationDelay: "1.55s",
                  }}
                />
              </div>
            </>
          )}
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
  contactFx: PropTypes.bool,
};

export default IceReflection;
