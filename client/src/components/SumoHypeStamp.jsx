import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import {
  C,
  FONT_DISPLAY,
  FONT_KANJI,
  TEXT_SHADOW_DISPLAY_SOFT,
} from "./menuTheme";

/*
 * SumoHypeStamp — floating overprint mark for hype moments.
 *
 * NOT an edge plaque (that's the info rail). This is a hanko overprint:
 * solid kanji with cream Bungee through the middle. Lives under the HUD
 * nameplate band so it never stacks on Counter Hit / Punish.
 *
 * PERFECT / GRAB BREAK / COUNTER GRAB.
 */

export const HYPE_DURATION_S = 1.25;
export const HYPE_DURATION_MS = 1250;

const HYPE_THEMES = {
  perfect: {
    color: "#9ae8f5",
    deep: C.iceDeep,
    kanji: "極",
    label: "PERFECT",
    hype: true,
  },
  break: {
    color: C.successBright,
    deep: C.successDeep,
    kanji: "破",
    label: "GRAB BREAK",
    hype: false,
  },
  countergrab: {
    color: "#e07098",
    deep: "#5a2048",
    kanji: "掴",
    label: "COUNTER GRAB",
    hype: false,
  },
};

const getTheme = (type) => HYPE_THEMES[type] || HYPE_THEMES.perfect;

// ============================================
// SIDE HYPE RAIL — one stamp per side
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

const stampIn = keyframes`
  0%   { opacity: 0; transform: translateY(-10px) scale(1.08); }
  70%  { opacity: 1; transform: translateY(1px) scale(0.995); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const stampRestrike = keyframes`
  0%   { opacity: 0.75; transform: scale(0.96); }
  45%  { opacity: 1; transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1); }
`;

const stampOut = keyframes`
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-10px) scale(0.96); }
`;

const stampReplaceOut = keyframes`
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-14px) scale(0.92); }
`;

const kanjiPress = keyframes`
  0%   { opacity: 0; transform: scale(1.28) rotate(-10deg); }
  55%  { opacity: 1; transform: scale(0.98) rotate(-5deg); }
  100% { opacity: 1; transform: scale(1) rotate(-6deg); }
`;

const labelSettle = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.08);
    letter-spacing: 0.14em;
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    letter-spacing: 0.06em;
  }
`;

// ============================================
// LAYOUT
// ============================================

const StampWrapper = styled.div`
  position: absolute;
  /* Combo-counter band — mid-side, clear of HUD and info rail (~58cqh). */
  top: clamp(195px, 34cqh, 265px);
  ${(p) => (p.$isLeftSide ? "left: 3.5%;" : "right: 3.5%;")}
  pointer-events: none;
  z-index: 221;
  display: flex;
  justify-content: ${(p) => (p.$isLeftSide ? "flex-start" : "flex-end")};

  @media (max-width: 900px) {
    top: clamp(175px, 32cqh, 240px);
  }
`;

const EXIT_S = 0.24;
const REPLACE_EXIT_S = 0.14;
const RESTRIKE_S = 0.16;

const StampMotion = styled.div`
  position: relative;
  transform-origin: center center;
  ${(p) => {
    if (p.$evicted) {
      return css`
        animation: ${stampReplaceOut} ${REPLACE_EXIT_S}s
          cubic-bezier(0.4, 0, 1, 1) forwards;
      `;
    }

    const enter = p.$restrike ? stampRestrike : stampIn;
    const enterDur = p.$restrike ? RESTRIKE_S : 0.22;
    const hold = Math.max(0.45, (p.$duration || HYPE_DURATION_S) - EXIT_S);

    return css`
      animation:
        ${enter} ${enterDur}s cubic-bezier(0.18, 0.85, 0.22, 1) both,
        ${stampOut} ${EXIT_S}s ease-in forwards;
      animation-delay: 0s, ${hold}s;
    `;
  }}
`;

/* Tight seat under the mark — short falloff, no blur mush. */
const InkSeat = styled.div`
  position: absolute;
  z-index: 0;
  left: 50%;
  top: 50%;
  width: 130%;
  height: 95%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  background: ${(p) => {
    const { deep } = getTheme(p.$type);
    return css`radial-gradient(
      ellipse 55% 48% at 50% 50%,
      color-mix(in srgb, ${deep} 65%, #050608) 0%,
      rgba(5, 6, 8, 0.7) 45%,
      transparent 68%
    )`;
  }};
`;

const Mark = styled.div`
  position: relative;
  z-index: 1;
  width: ${(p) =>
    getTheme(p.$type).hype
      ? "clamp(140px, 15.5cqw, 190px)"
      : "clamp(120px, 13.5cqw, 168px)"};
  height: ${(p) =>
    getTheme(p.$type).hype
      ? "clamp(100px, 12.5cqh, 140px)"
      : "clamp(88px, 11cqh, 122px)"};
`;

const Kanji = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: ${(p) =>
    getTheme(p.$type).hype
      ? "clamp(4.6rem, 8.8cqw, 6.2rem)"
      : "clamp(3.8rem, 7.2cqw, 5.2rem)"};
  line-height: 1;
  color: ${(p) => getTheme(p.$type).color};
  opacity: 0;
  transform-origin: center center;
  animation: ${kanjiPress} 0.28s cubic-bezier(0.25, 1.05, 0.35, 1) forwards;
  /* Solid stamp — full opacity, hard shelf. */
  text-shadow:
    0 2px 0 rgba(0, 0, 0, 0.7),
    0 0 1px rgba(0, 0, 0, 0.9);
  user-select: none;
`;

/*
 * Tight dark cushion under the word only — lifts cream off the solid kanji
 * without becoming a chrome card. Soft edges, short falloff.
 */
const LabelSeat = styled.div`
  position: absolute;
  left: 50%;
  top: 52%;
  z-index: 2;
  width: 118%;
  height: 38%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  background: radial-gradient(
    ellipse 70% 55% at 50% 50%,
    rgba(6, 8, 12, 0.82) 0%,
    rgba(6, 8, 12, 0.45) 48%,
    transparent 72%
  );
  filter: blur(3px);
`;

const Label = styled.div`
  position: absolute;
  left: 50%;
  top: 52%;
  z-index: 3;
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) =>
    getTheme(p.$type).hype
      ? "clamp(1.2rem, 2.2cqw, 1.65rem)"
      : "clamp(0.95rem, 1.75cqw, 1.3rem)"};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 0.95;
  white-space: pre-line;
  text-align: center;
  color: ${C.cream};
  /*
   * Soft language (not arcade stroke), but a denser black under-glow so
   * cream still separates from the solid kanji behind it.
   */
  text-shadow: ${(p) => {
    const { color } = getTheme(p.$type);
    return css`
      0 0 3px rgba(0, 0, 0, 0.95),
      0 0 8px rgba(0, 0, 0, 0.8),
      0 2px 2px rgba(0, 0, 0, 0.85),
      0 0 12px color-mix(in srgb, ${color} 18%, transparent),
      ${TEXT_SHADOW_DISPLAY_SOFT}
    `;
  }};
  opacity: 0;
  transform-origin: center center;
  animation: ${labelSettle} 0.22s cubic-bezier(0.22, 1, 0.36, 1) 0.04s forwards;
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
  const label = text || theme.label;

  return (
    <StampWrapper $isLeftSide={isLeftSide}>
      <StampMotion $evicted={evicted} $restrike={restrike} $duration={duration}>
        <InkSeat $type={type} aria-hidden />
        <Mark $type={type}>
          <Kanji $type={type} aria-hidden>
            {theme.kanji}
          </Kanji>
          <LabelSeat aria-hidden />
          <Label $type={type}>{label}</Label>
        </Mark>
      </StampMotion>
    </StampWrapper>
  );
};

SumoHypeStamp.propTypes = {
  type: PropTypes.oneOf(["perfect", "break", "countergrab"]),
  isLeftSide: PropTypes.bool,
  duration: PropTypes.number,
  text: PropTypes.string,
};

export default SumoHypeStamp;
