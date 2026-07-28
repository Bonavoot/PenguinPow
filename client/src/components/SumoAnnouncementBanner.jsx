import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  TEXT_SHADOW_DISPLAY_SOFT,
} from "./menuTheme";

/*
 * SumoAnnouncementBanner — side INFO rail plaque.
 *
 * Lane: combat-read callouts you wouldn't fully know without the game
 * saying so — COUNTER HIT, PUNISH, COUNTER THROW, clinch reads, tech.
 * Hype moments (PERFECT / GRAB BREAK / COUNTER GRAB) use SumoHypeStamp
 * on a separate band above this rail.
 *
 * Edge-plaque language:
 *   dark lacquer dissolving toward ring center, cream Bungee,
 *   type-colored hairlines + soft type ambient for differentiation.
 * Copy sits on the INNER (ring-facing) end of the solid ink; kanji
 * stamps the OUTER edge.
 *
 * RAIL: ONE plaque per side. A new callout replaces the prior — old
 * snaps out, new owns the rail. Same-type repeats restrike in place.
 *
 * IMPORTANT: parents must keep this mounted for at least
 * ANNOUNCEMENT_DURATION_MS so the shared slide-away exit can finish.
 */

export const ANNOUNCEMENT_DURATION_S = 1.5;
export const ANNOUNCEMENT_DURATION_MS = 1500;

// ============================================
// COLOR THEMES — washi pigments, not arcade neon
// ============================================

const TYPE_COLORS = {
  punish: { color: "#c4a0e8", deep: "#3d2466" },
  counterhit: { color: C.gold, deep: C.goldDeep },
  counter: { color: C.vermillionBright, deep: C.vermillionDeep },
  countergrab: { color: "#e07098", deep: "#5a2048" },
  counterthrow: { color: "#e89a5c", deep: "#7a3a14" },
  braced: { color: "#9cbc6a", deep: "#3a5218" },
  deepgrip: { color: "#e0b85a", deep: "#6e4a10" },
  // MATADOR wrong-read punish — tangerine (matches matador plume; not CLAMP magenta).
  gored: { color: "#ff9628", deep: "#7a3208" },
  parry: { color: C.iceBright, deep: C.iceDeep },
  tech: { color: C.ice, deep: C.iceMid },
  break: { color: C.successBright, deep: C.successDeep },
  perfect: { color: C.gold, deep: C.goldDeep },
  perfectparry: {
    color: "#9ae8f5",
    deep: C.iceDeep,
    accent: C.cream,
    textAccent: "#e8f7fb",
  },
  default: { color: C.cream, deep: C.sumi },
};

const getTheme = (type) => TYPE_COLORS[type] || TYPE_COLORS.default;

const TYPE_KANJI = {
  punish: "罰",
  counterhit: "撃",
  counter: "反",
  countergrab: "掴",
  counterthrow: "投",
  braced: "耐",
  deepgrip: "締",
  gored: "突",
  parry: "受",
  tech: "技",
  break: "破",
  perfect: "極",
  perfectparry: "極",
};

// ============================================
// SIDE RAIL — one plaque, replace on conflict
// ============================================

const activeAnnouncementRails = {
  left: null,
  right: null,
};

const railListeners = new Set();
let announcementIdSeed = 0;

const getSideKey = (isLeftSide) => (isLeftSide ? "left" : "right");

const notifyRailListeners = () => {
  railListeners.forEach((listener) => listener());
};

const useAnnouncementRail = (isLeftSide, type) => {
  const idRef = useRef(null);
  if (idRef.current === null) {
    announcementIdSeed += 1;
    idRef.current = `sumo-announcement-${announcementIdSeed}`;
  }

  const sideKey = getSideKey(isLeftSide);
  const joinedRef = useRef(false);

  // Resolve handoff mode synchronously for correct first paint.
  const handoffRef = useRef(null);
  if (handoffRef.current === null) {
    const current = activeAnnouncementRails[sideKey];
    if (current && current.type === type) {
      handoffRef.current = "restrike";
    } else if (current) {
      handoffRef.current = "replace";
    } else {
      handoffRef.current = "fresh";
    }
  }

  const [railState, setRailState] = useState({
    evicted: false,
    replacedBySameType: false,
    handoff: handoffRef.current,
  });

  useEffect(() => {
    const id = idRef.current;
    activeAnnouncementRails[sideKey] = { id, type };
    joinedRef.current = true;

    const updateRailState = () => {
      const current = activeAnnouncementRails[sideKey];
      const stillOwner = current && current.id === id;
      setRailState({
        handoff: handoffRef.current,
        evicted: joinedRef.current && !stillOwner,
        replacedBySameType:
          joinedRef.current && !stillOwner && current?.type === type,
      });
    };

    railListeners.add(updateRailState);
    notifyRailListeners();

    return () => {
      railListeners.delete(updateRailState);
      if (activeAnnouncementRails[sideKey]?.id === id) {
        activeAnnouncementRails[sideKey] = null;
      }
      notifyRailListeners();
    };
  }, [sideKey, type]);

  return railState;
};

// ============================================
// ANIMATIONS
// ============================================

const slabInFromLeft = keyframes`
  0%   { opacity: 0; transform: translateX(-44px) scaleX(0.9); }
  65%  { opacity: 1; transform: translateX(4px) scaleX(1.015); }
  100% { opacity: 1; transform: translateX(0) scaleX(1); }
`;

const slabInFromRight = keyframes`
  0%   { opacity: 0; transform: translateX(44px) scaleX(0.9); }
  65%  { opacity: 1; transform: translateX(-4px) scaleX(1.015); }
  100% { opacity: 1; transform: translateX(0) scaleX(1); }
`;

const slabOutToLeft = keyframes`
  0%   { opacity: 1; transform: translateX(0) scaleX(1); }
  100% { opacity: 0; transform: translateX(-28px) scaleX(0.94); }
`;

const slabOutToRight = keyframes`
  0%   { opacity: 1; transform: translateX(0) scaleX(1); }
  100% { opacity: 0; transform: translateX(28px) scaleX(0.94); }
`;

/* Replaced by a different callout — snap up/out so the rail clears cleanly. */
const slabReplaceOutLeft = keyframes`
  0%   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
  100% { opacity: 0; transform: translate3d(-8px, -18px, 0) scale(0.88); filter: blur(2px); }
`;

const slabReplaceOutRight = keyframes`
  0%   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
  100% { opacity: 0; transform: translate3d(8px, -18px, 0) scale(0.88); filter: blur(2px); }
`;

/* Same-type restrike — old plaque dissolves in place under the punch. */
const slabRestrikeOut = keyframes`
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.96); }
`;

/* Same-type restrike — punch the rail instead of a twin. */
const slabRestrikeLeft = keyframes`
  0%   { opacity: 0.75; transform: translateX(-8px) scale(0.96); }
  40%  { opacity: 1; transform: translateX(3px) scale(1.03); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
`;

const slabRestrikeRight = keyframes`
  0%   { opacity: 0.75; transform: translateX(8px) scale(0.96); }
  40%  { opacity: 1; transform: translateX(-3px) scale(1.03); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
`;

const textSettle = keyframes`
  0% {
    opacity: 0;
    transform: scale(1.08);
    letter-spacing: 0.14em;
  }
  55% {
    opacity: 1;
    transform: scale(0.99);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    letter-spacing: 0.1em;
  }
`;

const kanjiPress = keyframes`
  0%   { opacity: 0; transform: scale(1.35) rotate(-8deg); }
  55%  { opacity: 0.3; transform: scale(0.98) rotate(-7deg); }
  100% { opacity: 0.26; transform: scale(1) rotate(-7deg); }
`;

const ruleDraw = keyframes`
  0%   { opacity: 0; transform: scaleX(0); }
  100% { opacity: 1; transform: scaleX(1); }
`;

const subTextRise = keyframes`
  0%   { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
`;

// ============================================
// LAYOUT
// ============================================

const BannerWrapper = styled.div`
  position: absolute;
  top: clamp(360px, 58cqh, 440px);
  ${(p) => (p.$isLeftSide ? "left: 0;" : "right: 0;")}
  pointer-events: none;
  z-index: 220;

  @media (max-width: 900px) {
    top: clamp(310px, 55cqh, 390px);
  }
`;

const EXIT_DURATION_S = 0.28;
const REPLACE_EXIT_DURATION_S = 0.18;
const RESTRIKE_IN_DURATION_S = 0.18;
const REPLACE_ENTER_DELAY_S = 0.07;

const BannerMotion = styled.div`
  position: relative;
  transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
  ${(p) => {
    if (p.$evicted) {
      if (p.$replacedBySameType) {
        return css`
          animation: ${slabRestrikeOut} 0.12s ease-in forwards;
        `;
      }
      return css`
        animation: ${p.$isLeftSide ? slabReplaceOutLeft : slabReplaceOutRight}
          ${REPLACE_EXIT_DURATION_S}s cubic-bezier(0.4, 0, 1, 1) forwards;
      `;
    }

    const isRestrike = p.$handoff === "restrike";
    const isReplace = p.$handoff === "replace";
    const enterAnim = isRestrike
      ? p.$isLeftSide
        ? slabRestrikeLeft
        : slabRestrikeRight
      : p.$isLeftSide
        ? slabInFromLeft
        : slabInFromRight;
    const enterDuration = isRestrike ? RESTRIKE_IN_DURATION_S : 0.24;
    const enterEase = isRestrike
      ? "cubic-bezier(0.22, 0.9, 0.2, 1)"
      : "cubic-bezier(0.2, 0.72, 0.2, 1)";
    const enterDelay = isReplace ? REPLACE_ENTER_DELAY_S : 0;
    const exitAnim = p.$isLeftSide ? slabOutToLeft : slabOutToRight;
    const hold =
      Math.max(0.4, (p.$duration || ANNOUNCEMENT_DURATION_S) - EXIT_DURATION_S) +
      enterDelay;

    return css`
      animation:
        ${enterAnim} ${enterDuration}s ${enterEase} both,
        ${exitAnim} ${EXIT_DURATION_S}s ease-in forwards;
      animation-delay: ${enterDelay}s, ${hold}s;
    `;
  }}
`;

/*
 * Soft ambient seat under the SOLID outer half only — never a box-shadow.
 * A rectangular box-shadow reads as a hard grey slab at the dissolve tip
 * because the transparent gradient end still casts a full rect.
 */
const Haze = styled.div`
  position: absolute;
  z-index: 0;
  top: 50%;
  ${(p) => (p.$isLeftSide ? "left: -2%;" : "right: -2%;")}
  transform: translateY(-50%);
  width: 72%;
  height: 170%;
  pointer-events: none;
  background: ${(p) => {
    const { deep } = getTheme(p.$type);
    const at = p.$isLeftSide ? "18% 50%" : "82% 50%";
    return css`radial-gradient(
      ellipse 85% 70% at ${at},
      color-mix(in srgb, ${deep} 18%, rgba(8, 10, 16, 0.55)) 0%,
      rgba(8, 10, 16, 0.22) 38%,
      transparent 70%
    )`;
  }};
  filter: blur(12px);
`;

/*
 * Dark sumi plaque — ink dominant, light type tint, type-colored hairlines.
 * Solid ink holds farther toward ring center so inner-aligned copy stays
 * readable; dissolve still clears the dohyo. No box-shadow (see Haze).
 */
const Slab = styled.div`
  position: relative;
  z-index: 1;
  overflow: visible;
  min-width: clamp(190px, 20cqw, 300px);
  max-width: 38cqw;
  padding-block: clamp(10px, 1.35cqh, 15px);
  ${(p) =>
    p.$isLeftSide
      ? css`
          /* Outer pad clears kanji stamp; copy sits ring-facing. */
          padding-left: clamp(36px, 3.8cqw, 52px);
          padding-right: clamp(18px, 2cqw, 28px);
          text-align: right;
        `
      : css`
          padding-left: clamp(18px, 2cqw, 28px);
          padding-right: clamp(36px, 3.8cqw, 52px);
          text-align: left;
        `}
  background: ${(p) => {
    const { color, deep } = getTheme(p.$type);
    const dir = p.$isLeftSide ? "90deg" : "270deg";
    return css`linear-gradient(
      ${dir},
      color-mix(in srgb, ${deep} 22%, rgba(16, 20, 28, 0.97)) 0%,
      color-mix(in srgb, ${color} 7%, rgba(12, 15, 22, 0.95)) 28%,
      rgba(12, 15, 22, 0.9) 52%,
      rgba(12, 15, 22, 0.55) 72%,
      rgba(12, 15, 22, 0.18) 88%,
      transparent 100%
    )`;
  }};

  &::before,
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    pointer-events: none;
    transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
    animation: ${ruleDraw} 0.28s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s both;
    background: ${(p) => {
      const { color } = getTheme(p.$type);
      const dir = p.$isLeftSide ? "90deg" : "270deg";
      return css`linear-gradient(
        ${dir},
        ${color} 0%,
        color-mix(in srgb, ${color} 70%, transparent) 48%,
        color-mix(in srgb, ${color} 22%, transparent) 76%,
        transparent 100%
      )`;
    }};
  }

  &::before {
    top: 0;
  }

  &::after {
    bottom: 0;
  }
`;

const KanjiPrint = styled.div`
  position: absolute;
  z-index: 1;
  top: 50%;
  /* Stamp on the solid outer edge — opposite the ring-facing copy. */
  ${(p) =>
    p.$isLeftSide
      ? css`left: clamp(6px, 0.7cqw, 12px);`
      : css`right: clamp(6px, 0.7cqw, 12px);`}
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(1.9rem, 3.8cqw, 2.95rem);
  line-height: 1;
  color: ${(p) => getTheme(p.$type).color};
  opacity: 0;
  pointer-events: none;
  transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
  animation: ${kanjiPress} 0.34s cubic-bezier(0.3, 1.2, 0.5, 1) forwards;
  will-change: transform, opacity;
  margin-top: -0.52em;
`;

const Content = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$isLeftSide ? "flex-end" : "flex-start")};
  width: 100%;
  gap: clamp(3px, 0.4cqh, 5px);
`;

const MainText = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.95rem, 1.7cqw, 1.32rem);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  line-height: 1;
  white-space: nowrap;
  text-align: inherit;
  transform-origin: ${(p) => (p.$isLeftSide ? "right center" : "left center")};
  color: ${C.cream};
  text-shadow: ${(p) => {
    const { color } = getTheme(p.$type);
    return css`
      0 0 12px color-mix(in srgb, ${color} 24%, transparent),
      ${TEXT_SHADOW_DISPLAY_SOFT}
    `;
  }};
  opacity: 0;
  animation: ${textSettle} 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.05s forwards;
  will-change: transform, opacity;

  @media (max-width: 900px) {
    font-size: clamp(0.78rem, 2.1cqw, 1.05rem);
  }
`;

const SubText = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.45rem, 0.75cqw, 0.62rem);
  color: ${(p) => {
    const { color } = getTheme(p.$type);
    return css`color-mix(in srgb, ${color} 35%, ${C.creamMute})`;
  }};
  text-transform: uppercase;
  letter-spacing: 0.24em;
  text-align: inherit;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
  opacity: 0;
  animation: ${subTextRise} 0.24s ease-out 0.2s forwards;

  @media (max-width: 900px) {
    font-size: clamp(0.45rem, 1.35cqw, 0.66rem);
    letter-spacing: 0.2em;
  }
`;

// ============================================
// COMPONENT
// ============================================

const SumoAnnouncementBanner = ({
  text,
  type = "default",
  isLeftSide = true,
  duration = ANNOUNCEMENT_DURATION_S,
  subText = null,
}) => {
  const { evicted, replacedBySameType, handoff } = useAnnouncementRail(
    isLeftSide,
    type,
  );
  const kanji = TYPE_KANJI[type];
  const label = typeof text === "string" ? text.replace(/\s*\n\s*/g, " ") : text;

  return (
    <BannerWrapper $isLeftSide={isLeftSide}>
      <BannerMotion
        $isLeftSide={isLeftSide}
        $duration={duration}
        $evicted={evicted}
        $replacedBySameType={replacedBySameType}
        $handoff={handoff}
      >
        <Haze $isLeftSide={isLeftSide} $type={type} aria-hidden />
        <Slab $isLeftSide={isLeftSide} $type={type}>
          {kanji && (
            <KanjiPrint $type={type} $isLeftSide={isLeftSide} aria-hidden>
              {kanji}
            </KanjiPrint>
          )}
          <Content $isLeftSide={isLeftSide}>
            <MainText $type={type} $isLeftSide={isLeftSide}>
              {label}
            </MainText>
            {subText && <SubText $type={type}>{subText}</SubText>}
          </Content>
        </Slab>
      </BannerMotion>
    </BannerWrapper>
  );
};

SumoAnnouncementBanner.propTypes = {
  text: PropTypes.string.isRequired,
  type: PropTypes.oneOf([
    "parry",
    "perfect",
    "perfectparry",
    "counter",
    "counterhit",
    "counterthrow",
    "braced",
    "deepgrip",
    "punish",
    "countergrab",
    "gored",
    "break",
    "tech",
    "default",
  ]),
  isLeftSide: PropTypes.bool,
  duration: PropTypes.number,
  subText: PropTypes.string,
};

export default SumoAnnouncementBanner;
