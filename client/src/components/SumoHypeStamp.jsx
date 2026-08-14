import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { FONT_DISPLAY, FONT_RENDER } from "./menuTheme";
import {
  CALLOUT_CREAM,
  withSpacedBang,
} from "./calloutPrimitives";

/*
 * SumoHypeStamp — combo-counter register.
 *
 * PERFECT (timed attack parry) and MATADOR (grab-line parry) sit above the
 * combat rail, where other fighting games put the hit counter. The word
 * is the object: oversized cream Bungee, no underline. Color lives in a
 * glow stroke on the glyphs — ice on Perfect, yellow on Matador.
 *
 * Band: ~24–40cqh. Combat rail starts ~59cqh.
 */

export const HYPE_DURATION_S = 1.45;
export const HYPE_DURATION_MS = 1450;

const HYPE_THEMES = {
  perfect: {
    label: "PERFECT",
    stroke: "#3ec8f0",
    glow: "rgba(70, 210, 255, 0.9)",
  },
  perfectbrace: {
    label: "PERFECT BRACE",
    stroke: "#f0d24a",
    glow: "rgba(255, 220, 90, 0.9)",
  },
  matador: {
    label: "MATADOR",
    stroke: "#f0d24a",
    glow: "rgba(255, 220, 90, 0.9)",
  },
  matadorbreak: {
    label: "MATADOR BREAK",
    stroke: "#ff9a3a",
    glow: "rgba(255, 160, 60, 0.9)",
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
  0%   { transform: translateY(-16px); }
  62%  { transform: translateY(3px); }
  100% { transform: translateY(0); }
`;

const markRestrike = keyframes`
  0%   { transform: translateY(0); }
  40%  { transform: translateY(-6px); }
  100% { transform: translateY(0); }
`;

const markReplaceOut = keyframes`
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-12px); }
`;

const wordSlam = keyframes`
  0%   { opacity: 0; transform: translateY(-10px); }
  100% { opacity: 1; transform: translateY(0); }
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
  top: clamp(155px, 26cqh, 210px);
  ${(p) =>
    p.$isLeftSide
      ? css`left: clamp(8px, 1.15cqw, 16px);`
      : css`right: clamp(8px, 1.15cqw, 16px);`}
  pointer-events: none;
  z-index: 222;
  display: flex;
  justify-content: ${(p) => (p.$isLeftSide ? "flex-start" : "flex-end")};

  @media (max-width: 900px) {
    top: clamp(140px, 24cqh, 190px);
  }
`;

const EXIT_S = 0.2;
const REPLACE_EXIT_S = 0.14;
const RESTRIKE_S = 0.16;

const StampMotion = styled.div`
  position: relative;
  width: max-content;
  ${(p) => {
    if (p.$evicted) {
      return css`
        animation: ${markReplaceOut} ${REPLACE_EXIT_S}s
          cubic-bezier(0.4, 0, 1, 1) forwards;
      `;
    }

    const enter = p.$restrike ? markRestrike : markIn;
    const enterDur = p.$restrike ? RESTRIKE_S : 0.22;

    return css`
      animation: ${enter} ${enterDur}s cubic-bezier(0.18, 0.85, 0.22, 1) both;
    `;
  }}
`;

const Word = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) =>
    p.$long
      ? "clamp(1.55rem, 3.15cqw, 2.45rem)"
      : "clamp(2.05rem, 4.15cqw, 3.35rem)"};
  text-transform: uppercase;
  letter-spacing: 0.03em;
  line-height: 0.9;
  white-space: nowrap;
  text-align: ${(p) => (p.$isLeftSide ? "right" : "left")};
  color: ${CALLOUT_CREAM};
  -webkit-text-stroke: 2.5px ${(p) => p.$stroke};
  paint-order: stroke fill;
  text-shadow:
    0 0 2px ${(p) => p.$stroke},
    0 0 6px ${(p) => p.$glow},
    0 2px 0 rgba(0, 0, 0, 0.5);
  ${FONT_RENDER}
  user-select: none;
  ${(p) => {
    if (p.$evicted) {
      return css`
        animation: ${wordOff} 0.04s linear forwards;
      `;
    }

    const snapDelay = p.$restrike ? 0 : 0.05;
    const hold = Math.max(0.55, (p.$duration || HYPE_DURATION_S) - EXIT_S);

    return css`
      animation:
        ${wordSlam} 0.16s cubic-bezier(0.2, 0.9, 0.22, 1) ${snapDelay}s both,
        ${wordOff} 0.04s linear forwards;
      animation-delay: ${snapDelay}s, ${hold}s;
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
          $stroke={theme.stroke}
          $glow={theme.glow}
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
