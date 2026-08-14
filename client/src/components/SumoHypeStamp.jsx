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
 * is the object: oversized Bungee filled with the event color (ice /
 * leaf-gold), a hard ink contour, and a foil cap highlight. No glow —
 * bloom made these read as neon stickers.
 *
 * Band: ~24–40cqh. Combat rail starts ~59cqh.
 */

export const HYPE_DURATION_S = 1.45;
export const HYPE_DURATION_MS = 1450;

const HYPE_INK = "rgba(4, 6, 12, 0.95)";

const HYPE_THEMES = {
  perfect: {
    label: "PERFECT",
    fill: "#3ec8f0",
    shine: "#f0fcff",
    shelf: "rgba(8, 70, 100, 0.62)",
  },
  perfectbrace: {
    label: "PERFECT BRACE",
    fill: "#f0d24a",
    shine: "#fff6c8",
    shelf: "rgba(110, 70, 0, 0.58)",
  },
  matador: {
    label: "MATADOR",
    fill: "#f0d24a",
    shine: "#fff6c8",
    shelf: "rgba(110, 70, 0, 0.58)",
  },
  matadorbreak: {
    label: "MATADOR BREAK",
    fill: "#ee5141",
    shine: "#ffe4de",
    shelf: "rgba(90, 12, 8, 0.58)",
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
  letter-spacing: 0.03em;
  line-height: 0.9;
  white-space: nowrap;
  text-align: ${(p) => (p.$isLeftSide ? "right" : "left")};
  color: ${(p) => p.$fill};
  -webkit-text-stroke: clamp(2.4px, 0.28cqw, 3.6px) ${HYPE_INK};
  paint-order: stroke fill;
  text-shadow:
    0 2px 0 rgba(0, 0, 0, 0.82),
    0 3px 0 ${(p) => p.$shelf};
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

const Shine = styled.span`
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  padding: inherit;
  font: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  text-transform: inherit;
  text-align: inherit;
  white-space: inherit;
  color: ${(p) => p.$shine};
  -webkit-text-stroke: inherit;
  paint-order: stroke fill;
  text-shadow: none;
  clip-path: inset(0 0 56% 0);
  pointer-events: none;
  user-select: none;
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
          $shelf={theme.shelf}
        >
          {label}
          <Shine aria-hidden $shine={theme.shine}>
            {label}
          </Shine>
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
