import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { FONT_DISPLAY, FONT_RENDER } from "./menuTheme";
import { withSpacedBang } from "./calloutPrimitives";

/*
 * SumoHypeStamp — combo-counter register.
 *
 * PERFECT (timed attack parry) and MATADOR (grab-line parry) sit above the
 * combat rail, where other fighting games put the hit counter. The word
 * is the object: oversized Bungee, one pigment, a thin ink contour,
 * and a single ink seat so it grounds over the crowd. No foil split,
 * no colored extrusion, no glow.
 *
 * Band: just under the round-result stack (English + kimarite),
 * still clear of the headline. A winning PERFECT / MATADOR has
 * to stay readable when the result stamps in, so this rail no
 * longer shares ANNOUNCE_Y.
 */

export const HYPE_DURATION_S = 2.4;
export const HYPE_DURATION_MS = 2400;

export const HYPE_RAIL_EDGE = "clamp(14px, 1.6cqw, 22px)";
export const HYPE_RAIL_TOP = "clamp(224px, 35cqh, 272px)";
export const HYPE_RAIL_TOP_MOBILE = "clamp(208px, 33cqh, 256px)";

const HYPE_INK = "rgba(4, 6, 12, 0.95)";

const HYPE_THEMES = {
  perfect: {
    label: "PERFECT",
    fill: "#22f6ff",
  },
  perfectbrace: {
    label: "PERFECT BRACE",
    fill: "#ffe135",
  },
  matador: {
    label: "MATADOR",
    fill: "#ffe135",
  },
  matadorbreak: {
    label: "MATADOR BREAK",
    fill: "#ee5141",
  },
};

const getTheme = (type) => HYPE_THEMES[type] || HYPE_THEMES.perfect;

// ============================================
// SIDE HYPE RAIL — one mark per side
// ============================================

const activeHypeRails = { left: null, right: null };
const hypeListeners = new Set();
let hypeIdSeed = 0;

const getSideKey = (isLeftSide) => (isLeftSide ? "left" : "right");

const notifyHypeListeners = () => {
  hypeListeners.forEach((listener) => listener());
};

const useHypeRail = (isLeftSide, type) => {
  const idRef = useRef(null);
  if (idRef.current === null) {
    hypeIdSeed += 1;
    idRef.current = `sumo-hype-${hypeIdSeed}`;
  }

  const sideKey = getSideKey(isLeftSide);
  const joinedRef = useRef(false);
  const restrikeRef = useRef(null);
  if (restrikeRef.current === null) {
    const current = activeHypeRails[sideKey];
    restrikeRef.current = !!(current && current.type === type);
  }

  const [state, setState] = useState({
    evicted: false,
    restrike: restrikeRef.current,
  });

  useEffect(() => {
    const id = idRef.current;
    activeHypeRails[sideKey] = { id, type };
    joinedRef.current = true;

    const update = () => {
      const current = activeHypeRails[sideKey];
      const stillOwner = current && current.id === id;
      setState({
        restrike: restrikeRef.current,
        evicted: joinedRef.current && !stillOwner,
      });
    };

    hypeListeners.add(update);
    notifyHypeListeners();

    return () => {
      hypeListeners.delete(update);
      if (activeHypeRails[sideKey]?.id === id) {
        activeHypeRails[sideKey] = null;
      }
      notifyHypeListeners();
    };
  }, [sideKey, type]);

  return state;
};

// ============================================
// ANIMATIONS
// ============================================

const markIn = keyframes`
  0%   { transform: scale(1.32); }
  58%  { transform: scale(0.97); }
  100% { transform: scale(1); }
`;

const markRestrike = keyframes`
  0%   { transform: scale(1); }
  40%  { transform: scale(1.08); }
  100% { transform: scale(1); }
`;

const markReplaceOut = keyframes`
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.92); }
`;

const wordOff = keyframes`
  0%   { opacity: 1; }
  100% { opacity: 0; }
`;

// ============================================
// LAYOUT
// ============================================

const StampWrapper = styled.div`
  position: absolute;
  top: ${HYPE_RAIL_TOP};
  ${(p) =>
    p.$isLeftSide
      ? css`left: ${HYPE_RAIL_EDGE};`
      : css`right: ${HYPE_RAIL_EDGE};`}
  pointer-events: none;
  z-index: 222;
  display: flex;
  justify-content: ${(p) => (p.$isLeftSide ? "flex-start" : "flex-end")};

  @media (max-width: 900px) {
    top: ${HYPE_RAIL_TOP_MOBILE};
  }
`;

const EXIT_S = 0.2;
const REPLACE_EXIT_S = 0.12;
const RESTRIKE_S = 0.12;

const StampMotion = styled.div`
  position: relative;
  width: max-content;
  transform-origin: ${(p) => (p.$isLeftSide ? "right center" : "left center")};
  ${(p) => {
    if (p.$evicted) {
      return css`
        animation: ${markReplaceOut} ${REPLACE_EXIT_S}s
          cubic-bezier(0.4, 0, 1, 1) forwards;
      `;
    }

    const enter = p.$restrike ? markRestrike : markIn;
    const enterDur = p.$restrike ? RESTRIKE_S : 0.16;

    return css`
      animation: ${enter} ${enterDur}s cubic-bezier(0.2, 0.9, 0.22, 1) both;
    `;
  }}
`;

const Word = styled.div`
  position: relative;
  padding: 0.06em 0.12em 0.1em;
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) =>
    p.$long
      ? "clamp(1.55rem, 3.15cqw, 2.45rem)"
      : "clamp(2.05rem, 4.15cqw, 3.35rem)"};
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 0.9;
  white-space: nowrap;
  text-align: ${(p) => (p.$isLeftSide ? "right" : "left")};
  color: ${(p) => p.$fill};
  -webkit-text-stroke: clamp(2.8px, 0.32cqw, 4.2px) ${HYPE_INK};
  paint-order: stroke fill;
  text-shadow: 0 0.045em 0 ${HYPE_INK};
  ${FONT_RENDER}
  user-select: none;
  ${(p) => {
    if (p.$evicted) {
      return css`
        animation: ${wordOff} 0.04s linear forwards;
      `;
    }

    const hold = Math.max(0.55, (p.$duration || HYPE_DURATION_S) - EXIT_S);

    return css`
      animation: ${wordOff} 0.04s linear forwards;
      animation-delay: ${hold}s;
    `;
  }}
`;

// ============================================
// COMPONENT
// ============================================

const SumoHypeStamp = ({
  type = "perfect",
  isLeftSide = true,
  duration = HYPE_DURATION_S,
  text = null,
}) => {
  const { evicted, restrike } = useHypeRail(isLeftSide, type);
  const theme = getTheme(type);
  const raw = text || theme.label;
  let label = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : raw;
  label = withSpacedBang(label);
  const long =
    typeof label === "string" &&
    label.replace(/\u00A0!/, "").trim().length > 10;

  return (
    <StampWrapper $isLeftSide={isLeftSide}>
      <StampMotion
        $isLeftSide={isLeftSide}
        $evicted={evicted}
        $restrike={restrike}
      >
        <Word
          $isLeftSide={isLeftSide}
          $long={long}
          $evicted={evicted}
          $restrike={restrike}
          $duration={duration}
          $fill={theme.fill}
        >
          {label}
        </Word>
      </StampMotion>
    </StampWrapper>
  );
};

SumoHypeStamp.propTypes = {
  type: PropTypes.oneOf([
    "perfect",
    "perfectbrace",
    "matador",
    "matadorbreak",
  ]),
  isLeftSide: PropTypes.bool,
  duration: PropTypes.number,
  text: PropTypes.string,
};

export default SumoHypeStamp;
