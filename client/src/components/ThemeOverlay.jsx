import { memo } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

// PERFORMANCE OPTIMIZED: Reduced from 6 layers to 2 using combined backgrounds
// Full-screen theming overlay - simplified for better performance
const OverlayRoot = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${props => props.$zIndex ?? 150};
  pointer-events: none;
  opacity: ${props => props.$opacity ?? 1};
  contain: strict;
`;

// Combined visual layer - merges color grade, vignette, and bloom into one
const CombinedOverlay = styled.div`
  position: absolute;
  inset: 0;
  opacity: ${props => props.$intensity ?? 0.2};
  background:
    /* Vignette */
    radial-gradient(80% 65% at 50% 55%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.2) 85%, rgba(0,0,0,0.35) 100%),
    /* Color grade */
    radial-gradient(120% 80% at 50% 35%, rgba(68,58,92,0.15) 0%, rgba(16,12,24,0.2) 68%, rgba(8,6,12,0.3) 100%),
    /* Subtle bloom */
    radial-gradient(38% 28% at 50% 58%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 62%);
  mix-blend-mode: soft-light;
`;

// Simplified lantern glow - optional, can be disabled for more performance
const LanternGlow = styled.div`
  position: absolute;
  inset: 0;
  opacity: ${props => props.$alpha ?? 0.1};
  background:
    radial-gradient(26% 22% at 8% 10%, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0) 60%),
    radial-gradient(26% 22% at 92% 12%, rgba(255, 107, 107, 0.1) 0%, rgba(255, 107, 107, 0) 60%);
  mix-blend-mode: soft-light;
`;

const ThemeOverlay = memo(({
  theme = "edo-nightfall",
  intensity = 0.18,
  lanterns = 0.12,
  zIndex = 150,
  opacity = 1,
}) => {
  // Simplified to 2 layers instead of 6 for better performance
  return (
    <OverlayRoot $zIndex={zIndex} $opacity={opacity} data-theme={theme}>
      <CombinedOverlay $intensity={intensity} />
      {lanterns > 0 && <LanternGlow $alpha={lanterns} />}
    </OverlayRoot>
  );
});

ThemeOverlay.displayName = 'ThemeOverlay';

ThemeOverlay.propTypes = {
  theme: PropTypes.string,
  intensity: PropTypes.number,
  lanterns: PropTypes.number,
  zIndex: PropTypes.number,
  opacity: PropTypes.number,
};

export default ThemeOverlay;
