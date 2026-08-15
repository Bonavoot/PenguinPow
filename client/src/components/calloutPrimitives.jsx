import PropTypes from "prop-types";
import styled from "styled-components";
import { C, HUD } from "./menuTheme";

/*
 * Shared geometry + copy for combat slabs and hype marks.
 *
 * Slabs are one shared well parallelogram — the same near-black as the
 * stamina track and empty power-up slot. No cream stroke, no inner
 * keyline. Those belong on persistent instruments. A combat callout is
 * an event: well field + typed color.
 *
 * Type ink (hue-separated, same weight so they feel like one stamp set):
 *   COUNTER HIT   — neon yellow-orange, mostly yellow. Tempo steal.
 *                   Not lemon, not mustard. Leaf-gold stays on MATADOR.
 *   PUNISH        — neon violet. Recovery cash-in. Same family as the
 *                   purple hit ring, pushed to sign-brightness.
 *   MATADOR BREAK — hanko vermillion. Gored / exposed RPS. Brand violence.
 *   COUNTER GRAB  — rose. Grab-side steal. Not gold (that's a strike
 *                   counter) and not vermillion (that's Matador Break).
 */

export const CALLOUT_KEYLINE = HUD.keyline;
export const CALLOUT_CREAM = HUD.heroType;
export const CALLOUT_SLAB = HUD.well;

export const CALLOUT_PIGMENT = {
  counterhit: "#ffd800",
  punish: "#9b4dff",
  matadorbreak: C.vermillion,
  countergrab: "#ff3d88",
};

export const withSpacedBang = (text) => {
  if (typeof text !== "string") return text;
  if (/\u00A0!+\s*$/.test(text) || /\s!+\s*$/.test(text)) {
    return text.replace(/\s*!+\s*$/, "\u00A0!");
  }
  return `${text.replace(/\s*!+\s*$/, "")}\u00A0!`;
};

export const parallelogramPoints = (
  slant = 8,
  insetX = 2.4,
  insetY = 8,
  mirror = false,
) => {
  if (mirror) {
    return `${insetX},${insetY} ${100 - insetX - slant},${insetY} ${100 - insetX},${100 - insetY} ${insetX + slant},${100 - insetY}`;
  }
  return `${insetX + slant},${insetY} ${100 - insetX},${insetY} ${100 - insetX - slant},${100 - insetY} ${insetX},${100 - insetY}`;
};

const FillSvg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  pointer-events: none;
`;

export const CalloutParallelogram = ({
  color,
  slant = 8,
  strokeWidth = 0,
  insetY = 8,
  mirror = false,
}) => {
  const pts = parallelogramPoints(slant, 2.4, insetY, mirror);
  return (
    <FillSvg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon
        points={pts}
        fill={color}
        stroke={strokeWidth > 0 ? CALLOUT_KEYLINE : "none"}
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
        strokeMiterlimit={2.2}
        vectorEffect="non-scaling-stroke"
      />
    </FillSvg>
  );
};

CalloutParallelogram.propTypes = {
  color: PropTypes.string.isRequired,
  slant: PropTypes.number,
  strokeWidth: PropTypes.number,
  insetY: PropTypes.number,
  mirror: PropTypes.bool,
};
