import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import {
  C,
  FONT_DISPLAY,
  FONT_KANJI,
  TEXT_SHADOW_COMBAT,
} from "./menuTheme";

/*
 * SumoHypeStamp — floating overprint mark for hype moments.
 *
 * Two registers:
 *   hero  — PERFECT / MATADOR: circular hanko seal + bigger ink press
 *   mark  — GRAB BREAK / COUNTER GRAB / MATADOR BREAK: cut-through stamp
 *
 * Band: ~26–44cqh. Info rail starts ~54cqh.
 */

export const HYPE_DURATION_S = 1.25;
export const HYPE_DURATION_MS = 1250;

const HYPE_THEMES = {
  // Ice cyan — same pigment family as perfect-parry VFX rings/sparks.
  // Hero seal structure (ring + ghost) still differentiates it from utility stamps.
  perfect: {
    color: "#9ae8f5",
    deep: C.iceDeep,
    kanji: "極",
    label: "PERFECT",
    bang: true,
    hero: true,
  },
  break: {
    color: C.successBright,
    deep: C.successDeep,
    kanji: "破",
    label: "GRAB\nBREAK",
    bang: false,
    hero: false,
  },
  countergrab: {
    color: "#e07098",
    deep: "#5a2048",
    kanji: "掴",
    label: "COUNTER\nGRAB",
    bang: false,
    hero: false,
  },
  matador: {
    color: "#f0d060",
    deep: "#6e4a10",
    kanji: "誘",
    label: "MATADOR",
    bang: true,
    hero: true,
  },
  matadorbreak: {
    color: "#ff9628",
    deep: "#7a3208",
    kanji: "破",
    label: "MATADOR\nBREAK",
    bang: false,
    hero: false,
  },
};

const getTheme = (type) => HYPE_THEMES[type] || HYPE_THEMES.perfect;

const withSpacedBang = (text) => {
  if (typeof text !== "string") return text;
  if (/\u00A0!+\s*$/.test(text) || /\s!+\s*$/.test(text)) {
    return text.replace(/\s*!+\s*$/, "\u00A0!");
  }
  return `${text.replace(/\s*!+\s*$/, "")}\u00A0!`;
};

// ============================================
// SIDE HYPE RAIL
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
  60%  { opacity: 1; transform: translateY(2px) scale(0.99); }
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
  0%   { opacity: 0; transform: scale(1.45) rotate(-14deg); }
  50%  { opacity: 1; transform: scale(0.96) rotate(-7deg); }
  100% { opacity: 1; transform: scale(1) rotate(-8deg); }
`;

const sealIn = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.25) rotate(-20deg); }
  55%  { opacity: 1; transform: translate(-50%, -50%) scale(0.97) rotate(-6deg); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(-8deg); }
`;

const labelSettle = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.08); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

// ============================================
// LAYOUT
// ============================================

const StampWrapper = styled.div`
  position: absolute;
  top: clamp(155px, 26cqh, 210px);
  ${(p) => (p.$isLeftSide ? "left: 2.5%;" : "right: 2.5%;")}
  pointer-events: none;
  z-index: 221;
  display: flex;
  justify-content: ${(p) => (p.$isLeftSide ? "flex-start" : "flex-end")};

  @media (max-width: 900px) {
    top: clamp(140px, 24cqh, 190px);
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
    const enterDur = p.$restrike ? RESTRIKE_S : 0.2;
    const hold = Math.max(0.45, (p.$duration || HYPE_DURATION_S) - EXIT_S);

    return css`
      animation:
        ${enter} ${enterDur}s cubic-bezier(0.18, 0.85, 0.22, 1) both,
        ${stampOut} ${EXIT_S}s ease-in forwards;
      animation-delay: 0s, ${hold}s;
    `;
  }}
`;

const InkSeat = styled.div`
  position: absolute;
  z-index: 0;
  left: 50%;
  top: 50%;
  width: ${(p) => (getTheme(p.$type).hero ? "140%" : "125%")};
  height: ${(p) => (getTheme(p.$type).hero ? "105%" : "90%")};
  transform: translate(-50%, -50%);
  pointer-events: none;
  background: ${(p) => {
    const { deep, hero } = getTheme(p.$type);
    const core = hero ? 88 : 80;
    return css`radial-gradient(
      ellipse 52% 46% at 50% 50%,
      color-mix(in srgb, ${deep} ${core}%, #050608) 0%,
      rgba(5, 6, 8, 0.88) 42%,
      transparent 65%
    )`;
  }};
`;

const Mark = styled.div`
  position: relative;
  z-index: 1;
  overflow: visible;
  width: ${(p) =>
    getTheme(p.$type).hero
      ? "clamp(148px, 16cqw, 200px)"
      : "clamp(128px, 14cqw, 172px)"};
  height: ${(p) =>
    getTheme(p.$type).hero
      ? "clamp(118px, 14cqh, 155px)"
      : "clamp(100px, 12cqh, 132px)"};
`;

/* Circular hanko ring — hero stamps only. */
const SealRing = styled.div`
  position: absolute;
  left: 50%;
  top: 48%;
  z-index: 1;
  width: 78%;
  aspect-ratio: 1;
  border: 3px solid ${(p) => getTheme(p.$type).color};
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, ${(p) => getTheme(p.$type).color} 35%, transparent),
    0 2px 0 rgba(0, 0, 0, 0.55);
  opacity: 0;
  pointer-events: none;
  animation: ${sealIn} 0.3s cubic-bezier(0.2, 1.15, 0.35, 1) forwards;
`;

const Kanji = styled.div`
  position: absolute;
  inset: ${(p) => (getTheme(p.$type).hero ? "-4% -2%" : "-8% -4%")};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: ${(p) =>
    getTheme(p.$type).hero
      ? "clamp(4.8rem, 8.8cqw, 6.4rem)"
      : "clamp(4.4rem, 8cqw, 5.8rem)"};
  line-height: 1;
  color: ${(p) => getTheme(p.$type).color};
  opacity: 0;
  transform-origin: center center;
  animation: ${kanjiPress} 0.28s cubic-bezier(0.2, 1.2, 0.35, 1) forwards;
  text-shadow: ${(p) =>
    getTheme(p.$type).hero
      ? `0 2px 0 rgba(0, 0, 0, 0.9), 2px 4px 0 rgba(0, 0, 0, 0.5),
         -1px 0 0 color-mix(in srgb, ${getTheme(p.$type).deep} 70%, transparent)`
      : `0 2px 0 rgba(0, 0, 0, 0.85), 2px 3px 0 rgba(0, 0, 0, 0.4)`};
  user-select: none;
`;

/*
 * Ghost impression — second kanji offset behind the hero seal,
 * like the stamp hit twice. Cheap depth without blur filters.
 */
const KanjiGhost = styled.div`
  position: absolute;
  inset: -2% 0% -6% 4%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(4.8rem, 8.8cqw, 6.4rem);
  line-height: 1;
  color: ${(p) => getTheme(p.$type).deep};
  opacity: 0.35;
  transform: rotate(-11deg);
  pointer-events: none;
  user-select: none;
  z-index: 0;
`;

const LabelSeat = styled.div`
  position: absolute;
  left: 50%;
  top: 52%;
  z-index: 2;
  width: ${(p) => (getTheme(p.$type).hero ? "118%" : "112%")};
  height: ${(p) => {
    if (p.$stacked) return "44%";
    return getTheme(p.$type).hero ? "34%" : "30%";
  }};
  transform: translate(-50%, -50%);
  pointer-events: none;
  background: ${(p) => {
    const { deep, color, hero } = getTheme(p.$type);
    if (hero) {
      return css`linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, ${deep} 70%, #06080c) 10%,
        color-mix(in srgb, ${deep} 55%, #0a0c10) 50%,
        color-mix(in srgb, ${deep} 70%, #06080c) 90%,
        transparent 100%
      )`;
    }
    return css`linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, ${deep} 45%, #06080c) 14%,
      #06080c 50%,
      color-mix(in srgb, ${deep} 45%, #06080c) 86%,
      transparent 100%
    )`;
  }};
  border-top: ${(p) =>
    getTheme(p.$type).hero
      ? `1px solid color-mix(in srgb, ${getTheme(p.$type).color} 55%, transparent)`
      : "none"};
  border-bottom: ${(p) =>
    getTheme(p.$type).hero
      ? `1px solid color-mix(in srgb, ${getTheme(p.$type).color} 40%, transparent)`
      : "none"};
  clip-path: ${(p) =>
    p.$isLeftSide
      ? "polygon(0 0, 100% 0, 94% 100%, 0 100%)"
      : "polygon(6% 0, 100% 0, 100% 100%, 0 100%)"};
`;

const Label = styled.div`
  position: absolute;
  left: 50%;
  top: 52%;
  z-index: 3;
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) =>
    getTheme(p.$type).hero
      ? "clamp(1.2rem, 2.15cqw, 1.6rem)"
      : "clamp(1.05rem, 1.9cqw, 1.4rem)"};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 0.95;
  white-space: ${(p) => (p.$nowrap ? "nowrap" : "pre-line")};
  text-align: center;
  color: ${C.cream};
  text-shadow: ${TEXT_SHADOW_COMBAT};
  opacity: 0;
  transform-origin: center center;
  animation: ${labelSettle} 0.2s cubic-bezier(0.22, 1, 0.36, 1) 0.03s forwards;
  -webkit-font-smoothing: antialiased;
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
  let label = text || theme.label;
  if (theme.bang) label = withSpacedBang(label);
  const stacked = typeof label === "string" && label.includes("\n");

  return (
    <StampWrapper $isLeftSide={isLeftSide}>
      <StampMotion $evicted={evicted} $restrike={restrike} $duration={duration}>
        <InkSeat $type={type} aria-hidden />
        <Mark $type={type}>
          {theme.hero && (
            <>
              <KanjiGhost $type={type} aria-hidden>
                {theme.kanji}
              </KanjiGhost>
              <SealRing $type={type} aria-hidden />
            </>
          )}
          <Kanji $type={type} aria-hidden>
            {theme.kanji}
          </Kanji>
          <LabelSeat
            $type={type}
            $stacked={stacked}
            $isLeftSide={isLeftSide}
            aria-hidden
          />
          <Label $type={type} $nowrap={!stacked}>
            {label}
          </Label>
        </Mark>
      </StampMotion>
    </StampWrapper>
  );
};

SumoHypeStamp.propTypes = {
  type: PropTypes.oneOf([
    "perfect",
    "break",
    "countergrab",
    "matador",
    "matadorbreak",
  ]),
  isLeftSide: PropTypes.bool,
  duration: PropTypes.number,
  text: PropTypes.string,
};

export default SumoHypeStamp;
