import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  TEXT_SHADOW_COMBAT,
} from "./menuTheme";

/*
 * SumoAnnouncementBanner — side INFO rail plaque.
 *
 * Lane: combat-read callouts you wouldn't fully know without the game
 * saying so — COUNTER HIT, COUNTER GRAB, PUNISH, GRAB BREAK, COUNTER
 * THROW, clinch reads, tech. Hype moments (PERFECT / MATADOR /
 * MATADOR BREAK) use SumoHypeStamp on a separate band above this rail.
 *
 * Edge-plaque language:
 *   opaque lacquer parallelogram via clip-path (no dissolve, no skew),
 *   cream Bungee (same face as HUD), type-colored accent + hanko kanji.
 *   Subtle tier hierarchy. Spaced " !" on every callout.
 *
 * Band contract (per side, must not collide with SumoHypeStamp):
 *   hype stamps own ~26–44cqh; this rail owns ~54cqh+.
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
// COLOR THEMES — lacquer pigments, hard fills
// ============================================

const TYPE_COLORS = {
  punish: { color: "#c4a0e8", deep: "#3d2466" },
  counterhit: { color: C.gold, deep: C.goldDeep },
  counter: { color: C.vermillionBright, deep: C.vermillionDeep },
  countergrab: { color: "#e07098", deep: "#5a2048" },
  counterthrow: { color: "#e89a5c", deep: "#7a3a14" },
  deepgrip: { color: "#e0b85a", deep: "#6e4a10" },
  parry: { color: C.iceBright, deep: C.iceDeep },
  tech: { color: C.ice, deep: C.iceMid },
  break: { color: C.successBright, deep: C.successDeep },
  perfect: { color: C.gold, deep: C.goldDeep },
  perfectbrace: {
    color: "#f0d078",
    deep: "#5a3a08",
    accent: C.cream,
    textAccent: "#fff6d8",
  },
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
  deepgrip: "締",
  parry: "受",
  tech: "技",
  break: "破",
  perfect: "極",
  perfectbrace: "構",
  perfectparry: "極",
};

/*
 * Tier drives size + vertical seat. Same plaque language, quiet weight
 * differences — readable hierarchy without a billboard COUNTER HIT plaque.
 * All seats sit below the hype-stamp band (~44cqh clear).
 */
const TYPE_TIER = {
  counterhit: "hero",
  countergrab: "hero",
  counter: "primary",
  counterthrow: "primary",
  perfect: "primary",
  perfectbrace: "primary",
  perfectparry: "primary",
  punish: "secondary",
  parry: "secondary",
  break: "secondary",
  deepgrip: "secondary",
  tech: "secondary",
  default: "primary",
};

const getTier = (type) => TYPE_TIER[type] || "primary";

const TIER_LAYOUT = {
  hero: {
    top: "clamp(345px, 54cqh, 410px)",
    topMobile: "clamp(300px, 52cqh, 365px)",
    fontSize: "clamp(1.05rem, 1.85cqw, 1.4rem)",
    fontSizeMobile: "clamp(0.9rem, 2.2cqw, 1.15rem)",
    /* Kanji oversized vs plaque so it reads as a pressed hanko, not chrome. */
    kanjiSize: "clamp(2.15rem, 3.9cqw, 2.9rem)",
    /* Single-line labels — keep pad tight to the word height. */
    padBlock: "clamp(5px, 0.65cqh, 8px)",
    minWidth: "clamp(195px, 20cqw, 290px)",
  },
  primary: {
    top: "clamp(375px, 59cqh, 440px)",
    topMobile: "clamp(325px, 57cqh, 390px)",
    fontSize: "clamp(0.95rem, 1.65cqw, 1.25rem)",
    fontSizeMobile: "clamp(0.82rem, 2cqw, 1.05rem)",
    kanjiSize: "clamp(1.95rem, 3.5cqw, 2.65rem)",
    padBlock: "clamp(4px, 0.55cqh, 7px)",
    minWidth: "clamp(180px, 18.5cqw, 265px)",
  },
  secondary: {
    top: "clamp(410px, 65cqh, 480px)",
    topMobile: "clamp(355px, 62cqh, 420px)",
    fontSize: "clamp(0.82rem, 1.4cqw, 1.05rem)",
    fontSizeMobile: "clamp(0.72rem, 1.85cqw, 0.95rem)",
    kanjiSize: "clamp(1.7rem, 3.1cqw, 2.3rem)",
    padBlock: "clamp(4px, 0.5cqh, 6px)",
    minWidth: "clamp(145px, 15cqw, 215px)",
  },
};

/* Spaced " !" — PUMO signature. Non-breaking space so ! can't wrap alone. */
const withSpacedBang = (text) => {
  if (typeof text !== "string") return text;
  if (/\u00A0!+\s*$/.test(text) || /\s!+\s*$/.test(text)) {
    return text.replace(/\s*!+\s*$/, "\u00A0!");
  }
  return `${text.replace(/\s*!+\s*$/, "")}\u00A0!`;
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
// Shape slant lives on PlaqueFill via clip-path — NOT transform:skew
// (skew + filter:drop-shadow are what made the type look soft).
// ============================================

const slabInFromLeft = keyframes`
  0%   { opacity: 0; transform: translateX(-40px) scaleX(0.94); }
  70%  { opacity: 1; transform: translateX(3px) scaleX(1.01); }
  100% { opacity: 1; transform: translateX(0) scaleX(1); }
`;

const slabInFromRight = keyframes`
  0%   { opacity: 0; transform: translateX(40px) scaleX(0.94); }
  70%  { opacity: 1; transform: translateX(-3px) scaleX(1.01); }
  100% { opacity: 1; transform: translateX(0) scaleX(1); }
`;

const slabOutToLeft = keyframes`
  0%   { opacity: 1; transform: translateX(0) scaleX(1); }
  100% { opacity: 0; transform: translateX(-28px) scaleX(0.96); }
`;

const slabOutToRight = keyframes`
  0%   { opacity: 1; transform: translateX(0) scaleX(1); }
  100% { opacity: 0; transform: translateX(28px) scaleX(0.96); }
`;

const slabReplaceOutLeft = keyframes`
  0%   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
  100% { opacity: 0; transform: translate3d(-6px, -12px, 0) scale(0.94); }
`;

const slabReplaceOutRight = keyframes`
  0%   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
  100% { opacity: 0; transform: translate3d(6px, -12px, 0) scale(0.94); }
`;

const slabRestrikeOut = keyframes`
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.97); }
`;

const slabRestrikeLeft = keyframes`
  0%   { opacity: 0.8; transform: translateX(-6px) scale(0.97); }
  40%  { opacity: 1; transform: translateX(2px) scale(1.02); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
`;

const slabRestrikeRight = keyframes`
  0%   { opacity: 0.8; transform: translateX(6px) scale(0.97); }
  40%  { opacity: 1; transform: translateX(-2px) scale(1.02); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
`;

const textSettle = keyframes`
  0%   { opacity: 0; transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1); }
`;

const kanjiPress = keyframes`
  0%   { opacity: 0; transform: scale(1.4) rotate(-12deg); }
  55%  { opacity: 0.95; transform: scale(0.97) rotate(-7deg); }
  100% { opacity: 0.9; transform: scale(1) rotate(-8deg); }
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
  top: ${(p) => TIER_LAYOUT[getTier(p.$type)].top};
  ${(p) => (p.$isLeftSide ? "left: 0;" : "right: 0;")}
  pointer-events: none;
  z-index: 220;

  @media (max-width: 900px) {
    top: ${(p) => TIER_LAYOUT[getTier(p.$type)].topMobile};
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
    const enterDuration = isRestrike ? RESTRIKE_IN_DURATION_S : 0.22;
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
 * Layout shell — padding + overflow for the hanko stamp.
 * Paint lives on PlaqueFill (clip-path slant) so English type stays
 * axis-aligned and sharp.
 */
const Slab = styled.div`
  position: relative;
  z-index: 1;
  overflow: visible;
  min-width: ${(p) => TIER_LAYOUT[getTier(p.$type)].minWidth};
  max-width: 32cqw;
  padding-block: ${(p) => TIER_LAYOUT[getTier(p.$type)].padBlock};
  ${(p) =>
    p.$isLeftSide
      ? css`
          padding-left: clamp(36px, 3.8cqw, 52px);
          padding-right: clamp(18px, 2cqw, 28px);
          text-align: right;
        `
      : css`
          padding-left: clamp(18px, 2cqw, 28px);
          padding-right: clamp(36px, 3.8cqw, 52px);
          text-align: left;
        `}
`;

const PlaqueFill = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  ${(p) =>
    p.$isLeftSide
      ? css`
          border-left: 2px solid ${getTheme(p.$type).color};
          clip-path: polygon(0 0, 100% 0, 92% 100%, 0 100%);
        `
      : css`
          border-right: 2px solid ${getTheme(p.$type).color};
          clip-path: polygon(8% 0, 100% 0, 100% 100%, 0 100%);
        `}
  background: ${(p) => {
    const { deep } = getTheme(p.$type);
    const dir = p.$isLeftSide ? "90deg" : "270deg";
    return css`linear-gradient(
      ${dir},
      color-mix(in srgb, ${deep} 28%, #0a0c10) 0%,
      #0c0f14 55%,
      #0c0f14 100%
    )`;
  }};
  box-shadow: ${(p) =>
    p.$isLeftSide
      ? "2px 2px 0 rgba(0, 0, 0, 0.45)"
      : "-2px 2px 0 rgba(0, 0, 0, 0.45)"};

  &::before,
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    pointer-events: none;
    transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
    animation: ${ruleDraw} 0.2s cubic-bezier(0.2, 0.7, 0.2, 1) 0.03s both;
    background: ${(p) => {
      const { color } = getTheme(p.$type);
      const dir = p.$isLeftSide ? "90deg" : "270deg";
      return css`linear-gradient(
        ${dir},
        ${color} 0%,
        color-mix(in srgb, ${color} 40%, transparent) 62%,
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
  ${(p) =>
    p.$isLeftSide
      ? css`left: clamp(-6px, -0.4cqw, -2px);`
      : css`right: clamp(-6px, -0.4cqw, -2px);`}
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: ${(p) => TIER_LAYOUT[getTier(p.$type)].kanjiSize};
  line-height: 1;
  color: ${(p) => getTheme(p.$type).color};
  opacity: 0;
  pointer-events: none;
  transform-origin: center center;
  animation: ${kanjiPress} 0.3s cubic-bezier(0.22, 1.15, 0.4, 1) forwards;
  margin-top: -0.55em;
  text-shadow:
    0 2px 0 rgba(0, 0, 0, 0.85),
    2px 3px 0 rgba(0, 0, 0, 0.4);
`;

const Content = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$isLeftSide ? "flex-end" : "flex-start")};
  width: 100%;
  gap: clamp(2px, 0.25cqh, 3px);
`;

const MainText = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) => TIER_LAYOUT[getTier(p.$type)].fontSize};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1;
  white-space: nowrap;
  text-align: inherit;
  transform-origin: ${(p) => (p.$isLeftSide ? "right center" : "left center")};
  color: ${C.cream};
  text-shadow: ${TEXT_SHADOW_COMBAT};
  opacity: 0;
  animation: ${textSettle} 0.22s cubic-bezier(0.22, 1, 0.36, 1) 0.03s forwards;
  -webkit-font-smoothing: antialiased;

  @media (max-width: 900px) {
    font-size: ${(p) => TIER_LAYOUT[getTier(p.$type)].fontSizeMobile};
  }
`;

const SubText = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.45rem, 0.75cqw, 0.62rem);
  color: ${(p) => {
    const { color } = getTheme(p.$type);
    return css`color-mix(in srgb, ${color} 45%, ${C.creamMute})`;
  }};
  text-transform: uppercase;
  letter-spacing: 0.2em;
  text-align: inherit;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.9);
  opacity: 0;
  animation: ${subTextRise} 0.22s ease-out 0.16s forwards;

  @media (max-width: 900px) {
    font-size: clamp(0.45rem, 1.35cqw, 0.66rem);
    letter-spacing: 0.16em;
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
  // Side-rail labels are single-line; collapse any leftover breaks/whitespace.
  let label =
    typeof text === "string"
      ? text.replace(/\s+/g, " ").trim()
      : text;
  label = withSpacedBang(label);

  return (
    <BannerWrapper $isLeftSide={isLeftSide} $type={type}>
      <BannerMotion
        $isLeftSide={isLeftSide}
        $duration={duration}
        $evicted={evicted}
        $replacedBySameType={replacedBySameType}
        $handoff={handoff}
      >
        <Slab $isLeftSide={isLeftSide} $type={type}>
          <PlaqueFill $isLeftSide={isLeftSide} $type={type} aria-hidden />
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
    "perfectbrace",
    "perfectparry",
    "counter",
    "counterhit",
    "counterthrow",
    "deepgrip",
    "punish",
    "countergrab",
    "break",
    "tech",
    "default",
  ]),
  isLeftSide: PropTypes.bool,
  duration: PropTypes.number,
  subText: PropTypes.string,
};

export default SumoAnnouncementBanner;
