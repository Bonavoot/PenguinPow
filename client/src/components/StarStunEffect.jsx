import React, { useEffect, useState, memo, forwardRef } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

// Fixed height above the feet — clears a halo topper, but does NOT follow
// the halo's pose attach / tilt. Orbit itself stays the original 3D ring.
// Must match the rAF write in GameFighter.
export const STAR_STUN_BOTTOM_OFFSET_PCT = 19.8;

const orbit3D = keyframes`
  0% {
    transform: rotateX(65deg) rotateZ(0deg);
  }
  100% {
    transform: rotateX(65deg) rotateZ(360deg);
  }
`;

const starTwinkle = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.12);
    opacity: 0.85;
  }
`;

// Undo parent orbit so each ★ stays screen-upright while circling the ring.
const counterRotate = keyframes`
  0% {
    transform: rotateZ(0deg) rotateX(-65deg);
  }
  100% {
    transform: rotateZ(-360deg) rotateX(-65deg);
  }
`;

const StarStunContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100 + STAR_STUN_BOTTOM_OFFSET_PCT}%`,
    transform: "translateX(-50%)",
    zIndex: 1001,
    pointerEvents: "none",
    opacity: props.$variant === "self" ? 0.88 : 1,
  },
}))`
  width: 3.4cqw;
  height: 3.4cqw;
  perspective: 200px;
  contain: layout style size;
`;

const OrbitContainer = styled.div`
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  animation: ${orbit3D} 1.2s linear infinite;
`;

// Same bright yellow for self/foe/parry — stun stars should read as one effect,
// not team colors. Self is only slightly softer so it doesn't fight your own sprite.
const starPalette = {
  self: {
    color: "#ffe34a",
    glow: "rgba(255, 227, 74, 0.9)",
    stroke: "#1a1400",
  },
  foe: {
    color: "#ffe34a",
    glow: "rgba(255, 227, 74, 0.95)",
    stroke: "#1a1400",
  },
  parry: {
    color: "#ffe34a",
    glow: "rgba(255, 227, 74, 0.95)",
    stroke: "#1a1400",
  },
};

const StarSeat = styled.div`
  position: absolute;
  width: 1em;
  height: 1em;
  margin-left: -0.5em;
  margin-top: -0.5em;
  font-size: 0.85cqw;
  transform-style: preserve-3d;
  animation: ${counterRotate} 1.2s linear infinite;

  &:nth-child(1) {
    top: 0;
    left: 50%;
  }
  &:nth-child(2) {
    top: 50%;
    left: 100%;
  }
  &:nth-child(3) {
    top: 100%;
    left: 50%;
  }
  &:nth-child(4) {
    top: 50%;
    left: 0;
  }
`;

const StarGlyph = styled.div`
  line-height: 1;
  color: ${(props) => starPalette[props.$variant]?.color || starPalette.parry.color};
  -webkit-text-stroke: 1.5px
    ${(props) => starPalette[props.$variant]?.stroke || "#000"};
  paint-order: stroke fill;
  text-shadow:
    0 0 8px ${(props) => starPalette[props.$variant]?.glow || "rgba(255, 215, 0, 0.9)"},
    0 0 14px ${(props) => starPalette[props.$variant]?.glow || "rgba(255, 215, 0, 0.5)"};
  animation: ${starTwinkle} 0.5s ease-in-out infinite;

  ${StarSeat}:nth-child(1) & { animation-delay: 0s; }
  ${StarSeat}:nth-child(2) & { animation-delay: 0.125s; }
  ${StarSeat}:nth-child(3) & { animation-delay: 0.25s; }
  ${StarSeat}:nth-child(4) & { animation-delay: 0.375s; }
`;

/**
 * @param {"self"|"foe"|"parry"} variant
 *   self  — local Open/recovery (cooler)
 *   foe   — opponent Open (warmer)
 *   parry — raw-parry stun gold
 */
const StarStunEffect = forwardRef(function StarStunEffect(
  { x, y, isActive, facing, variant = "parry" },
  ref
) {
  const [showEffect, setShowEffect] = useState(false);
  const resolved = variant === "self" || variant === "foe" ? variant : "parry";

  useEffect(() => {
    if (isActive && typeof x === "number" && typeof y === "number") {
      setShowEffect(true);
    } else if (!isActive) {
      setShowEffect(false);
    }
  }, [isActive, x, y]);

  if (!showEffect || typeof x !== "number" || typeof y !== "number") return null;

  return (
    <StarStunContainer
      ref={ref}
      $x={x}
      $y={y}
      $facing={facing}
      $variant={resolved}
    >
      <OrbitContainer>
        <StarSeat>
          <StarGlyph $variant={resolved}>★</StarGlyph>
        </StarSeat>
        <StarSeat>
          <StarGlyph $variant={resolved}>★</StarGlyph>
        </StarSeat>
        <StarSeat>
          <StarGlyph $variant={resolved}>★</StarGlyph>
        </StarSeat>
        <StarSeat>
          <StarGlyph $variant={resolved}>★</StarGlyph>
        </StarSeat>
      </OrbitContainer>
    </StarStunContainer>
  );
});

StarStunEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
  facing: PropTypes.number.isRequired,
  variant: PropTypes.oneOf(["self", "foe", "parry"]),
};

export default memo(StarStunEffect, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.x === nextProps.x &&
    prevProps.y === nextProps.y &&
    prevProps.facing === nextProps.facing &&
    prevProps.variant === nextProps.variant
  );
});
