import PropTypes from "prop-types";
import styled from "styled-components";
import { C, HUD } from "./menuTheme";

/*
 * Shared geometry + copy for combat slabs and hype marks.
 *
 * Slabs are a pigment parallelogram — no HUD cream stroke, no inner
 * keyline. Those belong on persistent instruments (stamina, posture).
 * A combat callout is an event: color field + cream type.
 *
 * Pigment triad (hue-separated, same weight so they feel like one stamp set):
 *   COUNTER HIT   — hot gold. Tempo steal. Matches the gold hit ring.
 *                   Bright cadmium, not ochre — the darker amber read as
 *                   mustard. Not traffic-orange, not MATADOR's leaf-gold.
 *   PUNISH        — royal violet. Recovery cash-in. Same family as the
 *                   purple hit ring, pulled a step off neon so it sits
 *                   as paint next to the other two.
 *   MATADOR BREAK — hanko vermillion. Gored / exposed RPS. Brand violence
 *                   color, so it can never be mistaken for a counter.
 */

export const CALLOUT_KEYLINE = HUD.keyline;
export const CALLOUT_CREAM = HUD.heroType;

export const CALLOUT_PIGMENT = {
  counterhit: "#ffb400",
  punish: "#8a35e4",
  matadorbreak: C.vermillion,
};

export const withSpacedBang = (text) => {
  if (typeof text !== "string") return text;
  if (/\u00A0!+\s*$/.test(text) || /\s!+\s*$/.test(text)) {
    return text.replace(/\s*!+\s*$/, "\u00A0!");
  }
  return `${text.replace(/\s*!+\s*$/, "")}\u00A0!`;
};

export const parallelogramPoints = (slant = 8, insetX = 2.4, insetY = 8) => {
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
}) => {
  const pts = parallelogramPoints(slant, 2.4, insetY);
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
};
