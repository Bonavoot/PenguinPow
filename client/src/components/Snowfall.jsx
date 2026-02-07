import { useMemo } from "react";
import styled, { keyframes } from "styled-components";

// ============================================
// SNOWFLAKE DRIFT ANIMATIONS (3 variants)
// ============================================

const drift1 = keyframes`
  0% { transform: translate(0, -10px); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 0.6; }
  100% { transform: translate(25px, 105vh); opacity: 0; }
`;

const drift2 = keyframes`
  0% { transform: translate(0, -10px); opacity: 0; }
  10% { opacity: 0.8; }
  50% { transform: translate(-18px, 52vh); }
  90% { opacity: 0.4; }
  100% { transform: translate(12px, 105vh); opacity: 0; }
`;

const drift3 = keyframes`
  0% { transform: translate(0, -10px); opacity: 0; }
  10% { opacity: 0.9; }
  30% { transform: translate(12px, 32vh); }
  60% { transform: translate(-8px, 62vh); }
  90% { opacity: 0.5; }
  100% { transform: translate(6px, 105vh); opacity: 0; }
`;

const frostPulse = keyframes`
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
`;

const driftAnimations = [drift1, drift2, drift3];

// ============================================
// SNOWFLAKE ELEMENTS
// ============================================

const SnowContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: ${(props) => props.$zIndex || 2};
`;

const Snowflake = styled.div`
  position: absolute;
  top: -10px;
  left: ${(props) => props.$left}%;
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, ${(props) => props.$opacity}) 0%,
    rgba(210, 230, 255, ${(props) => props.$opacity * 0.4}) 50%,
    transparent 70%
  );
  border-radius: 50%;
  animation: ${(props) => driftAnimations[props.$variant]}
    ${(props) => props.$duration}s linear infinite;
  animation-delay: ${(props) => props.$delay}s;
  filter: blur(${(props) => props.$blur}px);
`;

// ============================================
// FROST CORNER OVERLAY
// ============================================

const FrostOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: ${(props) => props.$zIndex || 2};
  background: radial-gradient(
      ellipse at top left,
      rgba(200, 230, 255, 0.08) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at top right,
      rgba(180, 220, 255, 0.06) 0%,
      transparent 45%
    ),
    radial-gradient(
      ellipse at bottom left,
      rgba(200, 230, 255, 0.04) 0%,
      transparent 40%
    ),
    radial-gradient(
      ellipse at bottom right,
      rgba(190, 225, 255, 0.07) 0%,
      transparent 48%
    );
  animation: ${frostPulse} 8s ease-in-out infinite;
`;

// ============================================
// SNOW CAP (for banner bars)
// ============================================

export const SnowCap = styled.div`
  position: absolute;
  top: -6px;
  left: -1%;
  right: -1%;
  height: 10px;
  z-index: 10;
  pointer-events: none;

  /* Base snow layer */
  &::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 3%;
    right: 3%;
    height: 5px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.92) 0%,
      rgba(225, 238, 255, 0.82) 100%
    );
    border-radius: 3px 3px 1px 1px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }

  /* Lumpy snow mounds */
  &::after {
    content: "";
    position: absolute;
    bottom: 3px;
    left: 0;
    right: 0;
    height: 10px;
    background: radial-gradient(
        ellipse 20px 8px at 10% bottom,
        rgba(255, 255, 255, 0.95) 50%,
        transparent 51%
      ),
      radial-gradient(
        ellipse 28px 10px at 28% bottom,
        rgba(240, 248, 255, 0.9) 50%,
        transparent 51%
      ),
      radial-gradient(
        ellipse 24px 9px at 50% bottom,
        rgba(255, 255, 255, 0.93) 50%,
        transparent 51%
      ),
      radial-gradient(
        ellipse 18px 7px at 70% bottom,
        rgba(235, 245, 255, 0.88) 50%,
        transparent 51%
      ),
      radial-gradient(
        ellipse 22px 8px at 88% bottom,
        rgba(255, 255, 255, 0.9) 50%,
        transparent 51%
      );
  }
`;

// ============================================
// ICICLES (hanging from elements)
// ============================================

export const IcicleRow = styled.div`
  position: absolute;
  bottom: ${(props) => props.$bottom || "-10px"};
  left: 8%;
  right: 8%;
  display: flex;
  justify-content: space-evenly;
  align-items: flex-start;
  z-index: ${(props) => props.$zIndex || 4};
  pointer-events: none;
`;

export const Icicle = styled.div`
  width: ${(props) => props.$w || 3}px;
  height: ${(props) => props.$h || 8}px;
  background: linear-gradient(
    180deg,
    rgba(210, 235, 255, 0.9) 0%,
    rgba(185, 220, 255, 0.5) 50%,
    rgba(170, 215, 255, 0.15) 100%
  );
  border-radius: 1px 1px 50% 50%;
  flex-shrink: 0;
`;

// ============================================
// MAIN SNOWFALL COMPONENT
// ============================================

/**
 * Snowfall - Renders falling snowflakes and optional frost overlay.
 * @param {number} intensity - Number of snowflakes (default 30)
 * @param {boolean} showFrost - Show frost corner overlay (default true)
 * @param {number} zIndex - z-index layering (default 2)
 */
function Snowfall({ intensity = 30, showFrost = true, zIndex = 2 }) {
  const snowflakes = useMemo(() => {
    return Array.from({ length: intensity }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 5,
      opacity: 0.3 + Math.random() * 0.5,
      duration: 12 + Math.random() * 18,
      delay: -(Math.random() * 20), // Negative = start mid-animation (no initial gap)
      variant: Math.floor(Math.random() * 3),
      blur: Math.random() < 0.3 ? 1 : 0, // Some slightly blurry for depth
    }));
  }, [intensity]);

  return (
    <>
      {showFrost && <FrostOverlay $zIndex={zIndex} />}
      <SnowContainer $zIndex={zIndex}>
        {snowflakes.map((flake) => (
          <Snowflake
            key={flake.id}
            $left={flake.left}
            $size={flake.size}
            $opacity={flake.opacity}
            $duration={flake.duration}
            $delay={flake.delay}
            $variant={flake.variant}
            $blur={flake.blur}
          />
        ))}
      </SnowContainer>
    </>
  );
}

export default Snowfall;
