import PropTypes from "prop-types";
import styled from "styled-components";

// Full-screen theming overlay composed of multiple lightweight layers
// Applies a cohesive "Edo Nightfall" aesthetic via color grade, vignette, scanlines and grain
const OverlayRoot = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$zIndex", "$opacity"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      inset: 0,
      zIndex: props.$zIndex ?? 150,
      pointerEvents: "none",
      opacity: props.$opacity ?? 1,
    },
  }))``;

// Subtle color grading using layered radial/linear gradients (lighter bias)
const ColorGrade = styled.div
  .withConfig({ shouldForwardProp: () => true })
  .attrs((props) => ({
    style: {
      position: "absolute",
      inset: 0,
      mixBlendMode: props.$blendMode ?? "soft-light",
      opacity: props.$intensity ?? 0.22,
      background:
        // Center glow + gentle top/bottom tints (reduced darkness)
        "radial-gradient(120% 80% at 50% 35%, rgba(68,58,92,0.18) 0%, rgba(16,12,24,0.28) 68%, rgba(8,6,12,0.42) 100%)," +
        "linear-gradient(180deg, rgba(16,12,24,0.12) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 65%, rgba(10,8,14,0.18) 100%)",
    },
  }))``;

// Filmic vignette
const Vignette = styled.div
  .withConfig({ shouldForwardProp: () => true })
  .attrs((props) => ({
    style: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(80% 65% at 50% 55%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.25) 85%, rgba(0,0,0,0.45) 100%)",
      opacity: props.$strength ?? 0.6,
    },
  }))``;

// CRT-style scanlines (very subtle)
const Scanlines = styled.div
  .withConfig({ shouldForwardProp: () => true })
  .attrs((props) => ({
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage:
        "repeating-linear-gradient(to bottom, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)",
      mixBlendMode: "soft-light",
      opacity: props.$alpha ?? 0.08,
    },
  }))``;

// Paper/grain texture using a dotted pattern
const Grain = styled.div
  .withConfig({ shouldForwardProp: () => true })
  .attrs((props) => ({
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage:
        "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
      backgroundSize: "3px 3px",
      mixBlendMode: "soft-light",
      opacity: props.$alpha ?? 0.12,
      filter: "contrast(120%) brightness(100%)",
    },
  }))``;

// Center bloom/highlights
const Bloom = styled.div
  .withConfig({ shouldForwardProp: () => true })
  .attrs((props) => ({
    style: {
      position: "absolute",
      inset: 0,
      background:
        // central white bloom and subtle warm bloom higher up
        "radial-gradient(38% 28% at 50% 58%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.0) 62%)," +
        "radial-gradient(42% 32% at 50% 36%, rgba(255, 211, 120, 0.12) 0%, rgba(255, 211, 120, 0.0) 60%)",
      mixBlendMode: "screen",
      opacity: props.$alpha ?? 0.16,
      filter: "blur(0.2px)",
    },
  }))``;

// Warm corner lantern glows
const LanternGlow = styled.div
  .withConfig({ shouldForwardProp: () => true })
  .attrs((props) => ({
    style: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(26% 22% at 8% 10%, rgba(212, 175, 55, 0.16) 0%, rgba(212, 175, 55, 0.0) 60%)," +
        "radial-gradient(26% 22% at 92% 12%, rgba(255, 107, 107, 0.14) 0%, rgba(255, 107, 107, 0.0) 60%)," +
        "radial-gradient(24% 20% at 12% 88%, rgba(0, 255, 255, 0.14) 0%, rgba(0, 255, 255, 0.0) 60%)",
      mixBlendMode: "soft-light",
      opacity: props.$alpha ?? 0.14,
      filter: "saturate(110%)",
    },
  }))``;

const ThemeOverlay = ({
  theme = "edo-nightfall",
  intensity = 0.18,
  vignette = 0.18,
  scanlines = 0.04,
  grain = 0.06,
  bloom = 0.18,
  lanterns = 0.12,
  zIndex = 150,
  opacity = 1,
}) => {
  // Future: switch per-theme variants. For now, we keep one curated stack.
  return (
    <OverlayRoot $zIndex={zIndex} $opacity={opacity} data-theme={theme}>
      <ColorGrade $intensity={intensity} />
      <Bloom $alpha={bloom} />
      <LanternGlow $alpha={lanterns} />
      <Vignette $strength={vignette} />
      <Scanlines $alpha={scanlines} />
      <Grain $alpha={grain} />
    </OverlayRoot>
  );
};

ThemeOverlay.propTypes = {
  theme: PropTypes.string,
  intensity: PropTypes.number,
  vignette: PropTypes.number,
  scanlines: PropTypes.number,
  grain: PropTypes.number,
  bloom: PropTypes.number,
  lanterns: PropTypes.number,
  zIndex: PropTypes.number,
  opacity: PropTypes.number,
};

export default ThemeOverlay;


