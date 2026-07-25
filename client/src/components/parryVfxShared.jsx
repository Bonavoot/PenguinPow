import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";
import SumoHypeStamp from "./SumoHypeStamp";

// ── Shared parry color identity ─────────────────────────────────────────────
// Burst sheet is now the white grab-break star (mask+fill in Slap/RawParry
// effects). These CSS-filter helpers remain for any leftover callers; Perfect
// stays a hotter ELECTRIC ice-cyan vs regular steel-cyan.
export const REGULAR_PARRY_FILTER =
  "grayscale(1) sepia(1) hue-rotate(185deg) saturate(2.6) brightness(1.18) drop-shadow(0 0 4px rgba(120, 195, 255, 0.55))";

export const PERFECT_PARRY_FILTER =
  "grayscale(1) sepia(1) hue-rotate(200deg) saturate(3.35) brightness(1.42) drop-shadow(0 0 3px rgba(220, 250, 255, 1)) drop-shadow(0 0 10px rgba(0, 220, 255, 0.95)) drop-shadow(0 0 22px rgba(40, 180, 255, 0.55))";

export const parryFilterFor = (isPerfect) =>
  isPerfect ? PERFECT_PARRY_FILTER : REGULAR_PARRY_FILTER;

// ── White-hot → electric-cyan contact flash ─────────────────────────────────
// Snappy pop, brief hold at peak, then fade — linger without bloating the beat.
const coreFlash = keyframes`
  0%   { transform: translate(-50%, 50%) scale(0.15); opacity: 1; }
  14%  { transform: translate(-50%, 50%) scale(1.05); opacity: 1; }
  48%  { transform: translate(-50%, 50%) scale(1.18); opacity: 0.8; }
  100% { transform: translate(-50%, 50%) scale(1.7); opacity: 0; }
`;

const haloFlash = keyframes`
  0%   { transform: translate(-50%, 50%) scale(0.4); opacity: 0.7; }
  22%  { transform: translate(-50%, 50%) scale(1.15); opacity: 0.5; }
  55%  { transform: translate(-50%, 50%) scale(1.45); opacity: 0.28; }
  100% { transform: translate(-50%, 50%) scale(2.15); opacity: 0; }
`;

const FlashAnchor = styled.div`
  position: absolute;
  left: ${(p) => (p.$x / 1280) * 100}%;
  bottom: ${(p) => (p.$y / 720) * 100}%;
  width: 0;
  height: 0;
  /* Above fighters (~99) and level with the star burst (170). */
  z-index: 171;
  pointer-events: none;
`;

const CoreBloom = styled.div`
  position: absolute;
  left: 0;
  bottom: 0;
  width: ${(p) => p.$size}cqw;
  height: ${(p) => p.$size}cqw;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 1) 0%,
    rgba(200, 250, 255, 0.95) 22%,
    rgba(0, 220, 255, 0.55) 48%,
    rgba(0, 160, 255, 0) 72%
  );
  animation: ${coreFlash} 280ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
  will-change: transform, opacity;
`;

const HaloBloom = styled.div`
  position: absolute;
  left: 0;
  bottom: 0;
  width: ${(p) => p.$size}cqw;
  height: ${(p) => p.$size}cqw;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(120, 240, 255, 0.35) 0%,
    rgba(0, 200, 255, 0.18) 40%,
    rgba(0, 140, 255, 0) 70%
  );
  animation: ${haloFlash} 380ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  will-change: transform, opacity;
`;

export const PerfectParryImpactFlash = ({ x, y, size = 10 }) => (
  <FlashAnchor $x={x} $y={y}>
    <HaloBloom $size={size * 1.55} />
    <CoreBloom $size={size} />
  </FlashAnchor>
);

PerfectParryImpactFlash.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  size: PropTypes.number,
};

// ── Regular contact pin ─────────────────────────────────────────────────────
// Tiny white→cyan pin at the clash seam. Gives the thin grab-break filaments a
// solid "hit point" the eye locks onto without borrowing Perfect's bloom/banner.
const regularCoreFlash = keyframes`
  0%   { transform: translate(-50%, 50%) scale(0.2); opacity: 1; }
  22%  { transform: translate(-50%, 50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, 50%) scale(1.35); opacity: 0; }
`;

const RegularCore = styled.div`
  position: absolute;
  left: 0;
  bottom: 0;
  width: ${(p) => p.$size}cqw;
  height: ${(p) => p.$size}cqw;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 1) 0%,
    rgba(210, 245, 255, 0.95) 28%,
    rgba(78, 200, 255, 0.55) 52%,
    rgba(78, 200, 255, 0) 72%
  );
  animation: ${regularCoreFlash} 180ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
  will-change: transform, opacity;
`;

export const RegularParryContactFlash = ({ x, y, size = 4.2 }) => (
  <FlashAnchor $x={x} $y={y}>
    <RegularCore $size={size} />
  </FlashAnchor>
);

RegularParryContactFlash.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  size: PropTypes.number,
};

// ── PERFECT hype stamp ──────────────────────────────────────────────────────
// Parents MUST keep this mounted for HYPE_DURATION_MS. The parry sprite
// burst is much shorter; stamp lifetime is owned by Raw/SlapParryEffect.
export const PerfectParryBanner = ({ playerNumber = 1 }) => {
  const isLeftSide = playerNumber === 1;
  const hudEl =
    typeof document !== "undefined"
      ? document.getElementById("game-hud-callouts")
      : null;
  if (!hudEl) return null;
  return createPortal(
    <SumoHypeStamp type="perfect" isLeftSide={isLeftSide} />,
    hudEl
  );
};

PerfectParryBanner.propTypes = {
  playerNumber: PropTypes.number,
};

// Perfect-tier contact extras that sit UNDER / WITH the sprite burst.
// Banner is intentionally NOT bundled here — host it on the shared
// announcement timer so it can slide away like COUNTER HIT.
export const PerfectParryExtras = ({ x, y }) => (
  <PerfectParryImpactFlash x={x} y={y} size={11} />
);

PerfectParryExtras.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
};
