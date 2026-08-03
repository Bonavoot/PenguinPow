import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

import pumo from "../assets/pumo-idle.png";
import { SPRITE_BASE_COLOR } from "../utils/SpriteRecolorizer";
import { buildIdlePortraitSrc } from "../utils/hatComposite";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_UI,
  FONT_WEIGHT,
  broadcastSlideDown,
  FONT_RENDER,
  TEXT_SHADOW_DISPLAY,
  TEXT_SHADOW_DISPLAY_HEAVY,
  TEXT_SHADOW_UI,
  TRACK,
} from "./menuTheme";
import { SHADOW_GRADIENT } from "./PlayerShadow";

/*
 * PreMatchScreen — printed banzuke face-off over the live arena.
 *
 * Identity sits in each fighter column, outer-anchored so the side
 * band isn't empty. Names fit-to-width on one line (never clip or
 * stack). Rank lives in the meta row (gold type, no lacquer box).
 * HUD keeps the plaque. No glass scrims or glow blooms.
 *
 * Game.jsx still adds `is-prematch-hidden` on .ui while this is up.
 */

// ============================================
// ANIMATIONS
// ============================================
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const vsStampIn = keyframes`
  0% {
    opacity: 0;
    transform: scale(1.85) rotate(-10deg);
  }
  52% {
    opacity: 1;
    transform: scale(0.9) rotate(2deg);
  }
  76% {
    transform: scale(1.05) rotate(-1deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
`;

const loadPulse = keyframes`
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 1; }
`;

const fighterInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-64px) scale(1.07);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

const fighterInRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(64px) scale(1.07);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

const breathe = keyframes`
  /* In-game idle breathe — fighterStyledComponents.js */
  0%, 100% { transform: scaleX(var(--facing, 1)) scaleY(1); }
  50%      { transform: scaleX(var(--facing, 1)) scaleY(1.03); }
`;

const identityInLeft = keyframes`
  from {
    opacity: 0;
    transform: translate(-28px, 10px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
`;

const identityInRight = keyframes`
  from {
    opacity: 0;
    transform: translate(28px, 10px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
`;

const brushDraw = keyframes`
  from {
    opacity: 0;
    transform: scaleX(0.15);
  }
  to {
    opacity: 1;
    transform: scaleX(1);
  }
`;

// ============================================
// SCREEN
// ============================================

const ScreenContainer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10000;
  animation: ${fadeIn} 0.18s ease-out;
  overflow: hidden;
  font-family: ${FONT_BODY};
  pointer-events: auto;
  container-type: size;
`;

const StageDim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 44% 54% at 50% 44%,
      transparent 0%,
      rgba(4, 6, 10, 0.18) 50%,
      rgba(4, 6, 10, 0.72) 100%
    ),
    linear-gradient(
      180deg,
      rgba(4, 6, 10, 0.68) 0%,
      rgba(4, 6, 10, 0.08) 26%,
      rgba(4, 6, 10, 0.05) 48%,
      rgba(4, 6, 10, 0.45) 72%,
      rgba(4, 6, 10, 0.82) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  opacity: 0.2;
  mix-blend-mode: overlay;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(60, 40, 20, 0.05) 0,
      transparent 1px,
      transparent 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(60, 40, 20, 0.04) 0,
      transparent 1px,
      transparent 4px
    );
`;

// ============================================
// TOP SLUG
// ============================================

const TopSlug = styled.div`
  position: absolute;
  top: clamp(10px, 1.5cqh, 16px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  z-index: 40;
  will-change: transform, opacity;
  animation: ${broadcastSlideDown} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s
    backwards;
`;

const SlugText = styled.span`
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.42rem, 0.72cqw, 0.56rem);
  color: ${(p) => (p.$accent ? C.ice : C.creamMute)};
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  text-shadow: ${TEXT_SHADOW_UI};

  strong {
    color: ${C.cream};
    letter-spacing: ${TRACK.meta};
  }
`;

const SlugRule = styled.span`
  width: 16px;
  height: 1px;
  background: rgba(245, 236, 217, 0.35);
`;

// ============================================
// FIGHTER STAGE
// ============================================

const FighterStage = styled.div`
  position: absolute;
  top: clamp(20px, 3.5cqh, 40px);
  left: 0;
  right: 0;
  /* Leave a band under the feet for the identity unit */
  bottom: clamp(100px, 16cqh, 140px);
  display: grid;
  /* Center corridor — fighters face off over the dohyo */
  grid-template-columns: 1fr minmax(52px, 8cqw) 1fr;
  z-index: 20;
  pointer-events: none;
`;

const FighterSide = styled.div`
  position: relative;
  overflow: visible;
  will-change: transform, opacity;
  animation: ${(p) => (p.$side === "left" ? fighterInLeft : fighterInRight)}
    0.6s cubic-bezier(0.2, 0.7, 0.2, 1) 0.06s both;
`;

const FighterWrap = styled.div`
  position: absolute;
  top: 4%;
  /* Mid-dohyo — just forward of the shikiri-sen, not the back rim */
  bottom: clamp(78px, 12.5cqh, 108px);
  /* Inward pull toward the ring center */
  ${(p) =>
    p.$side === "left"
      ? "left: 34%; right: -8%;"
      : "right: 34%; left: -8%;"}
  ${(p) =>
    p.$side === "left"
      ? "transform: translateX(2px);"
      : "transform: translateX(-6px);"}
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: visible;
  z-index: 4;
`;

/*
 * Same three-zone cool-slate recipe + flat ~4.4:1 footprint as
 * in-game PlayerShadow — but sized for the larger prematch sprites
 * (in-game footprint is ~9%×3.5% of a 1280×720 stage; these
 * portraits are much bigger, so the oval scales with them).
 */
const FloorShadow = styled.div`
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: clamp(148px, 21cqw, 250px);
  height: clamp(34px, 4.8cqw, 56px);
  border-radius: 50%;
  background: ${SHADOW_GRADIENT};
  z-index: 3;
  pointer-events: none;
`;

const FighterImg = styled.img`
  position: relative;
  z-index: 4;
  --facing: ${(p) => (p.$flip ? 1 : -1)};
  width: auto;
  height: 78%;
  max-width: min(100%, 32cqw);
  object-fit: contain;
  object-position: center bottom;
  transform-origin: center bottom;
  transform: scaleX(var(--facing, 1)) scaleY(1);
  animation: ${breathe} 1.5s ease-in-out infinite;
  filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000);
  opacity: ${(p) => (p.$ready ? 1 : 0)};
  transition: opacity 0.22s ease-out;
`;

// ============================================
// CENTER VS — clean stamp, no ring through the type
// ============================================

const VsColumn = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Pin from the stage floor so VS tracks mid-torso as fighters rise */
  justify-content: flex-end;
  z-index: 25;
  padding-top: 0;
  padding-bottom: clamp(128px, 32cqh, 212px);
  /* Subtle left bias — less than the left fighter nudge */
  transform: translateX(-0.15cqw);
`;

const VsMark = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(3px, 0.45cqh, 6px);
  will-change: transform, opacity;
  animation: ${vsStampIn} 0.58s cubic-bezier(0.34, 1.5, 0.64, 1) 0.18s both;
`;

const VsRule = styled.div`
  width: clamp(28px, 3.8cqw, 44px);
  height: 2px;
  background: ${C.vermillion};
  flex-shrink: 0;
`;

const VsLetters = styled.div`
  position: relative;
  z-index: 2;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(36px, 5.8cqw, 72px);
  color: #ffffff;
  letter-spacing: 0.04em;
  line-height: 0.82;
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_DISPLAY_HEAVY};
`;

/* Solid plate so mode + loading stay readable over the live arena. */
const VsMetaPlate = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  padding: clamp(4px, 0.55cqh, 6px) clamp(10px, 1.3cqw, 14px);
  background: ${C.sumi};
  border: 1px solid rgba(245, 236, 217, 0.22);
`;

const VsMode = styled.div`
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.45rem, 0.75cqw, 0.6rem);
  color: ${C.cream};
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  line-height: 1;
`;

const VsLoadDots = styled.div`
  display: flex;
  gap: 6px;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${C.cream};
    animation: ${loadPulse} 1.15s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.18s;
    }
    &:nth-child(3) {
      animation-delay: 0.36s;
    }
  }
`;

// ============================================
// IDENTITY — under each fighter's feet, floating type only
// ============================================

const IdentityStage = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  /* Anchored up into the under-feet band — not a screen-edge footer */
  bottom: clamp(44px, 7.5cqh, 84px);
  display: grid;
  /* minmax(0, 1fr) so long names can shrink inside the column */
  grid-template-columns: minmax(0, 1fr) minmax(52px, 8cqw) minmax(0, 1fr);
  align-items: flex-end;
  z-index: 30;
  pointer-events: none;
`;

/* Slightly inset from the bezel — under each fighter's side of the ring. */
const IdentitySlot = styled.div`
  display: flex;
  justify-content: ${(p) => (p.$side === "left" ? "flex-start" : "flex-end")};
  /* Keep a hard gutter toward VS so long names never crowd the center. */
  padding: ${(p) =>
    p.$side === "left"
      ? "0 clamp(28px, 5.5cqw, 72px) 0 clamp(28px, 5.5cqw, 64px)"
      : "0 clamp(28px, 5.5cqw, 64px) 0 clamp(28px, 5.5cqw, 72px)"};
  min-width: 0;
  overflow: hidden;
`;

const IdentityBlock = styled.div`
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$side === "left" ? "flex-start" : "flex-end")};
  text-align: ${(p) => (p.$side === "left" ? "left" : "right")};
  will-change: transform, opacity;
  animation: ${(p) =>
      p.$side === "left" ? identityInLeft : identityInRight}
    0.48s cubic-bezier(0.2, 0.7, 0.2, 1) 0.26s both;
`;

const SideTag = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  margin-bottom: clamp(2px, 0.35cqh, 5px);
`;

const SideLabel = styled.span`
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${(p) => p.$accent};
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  line-height: 1;
`;

/*
 * Display shikona — starts at the hero clamp, then FitFighterName
 * measures and writes an exact px size so the full name always fits.
 */
const FighterName = styled.div`
  position: relative;
  z-index: 2;
  width: 100%;
  min-width: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(24px, 3.9cqw, 50px);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 0.92;
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  white-space: nowrap;
  overflow: hidden;
`;

const NAME_MIN_PX = 14;

/** Shrink font (then scaleX as a last resort) so the full name stays visible. */
function FitFighterName({ children, side }) {
  const ref = useRef(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.fontSize = "";
    el.style.transform = "";
    el.style.letterSpacing = "";

    const avail = el.clientWidth;
    if (avail <= 0) return;

    const maxPx = parseFloat(getComputedStyle(el).fontSize);
    if (!maxPx) return;

    let natural = el.scrollWidth;
    if (natural <= avail + 1) return;

    let next = maxPx * (avail / natural);
    if (next < NAME_MIN_PX) {
      el.style.fontSize = `${NAME_MIN_PX}px`;
      el.style.letterSpacing = "0.02em";
      natural = el.scrollWidth;
      if (natural > avail + 1) {
        const sx = avail / natural;
        el.style.transform = `scaleX(${sx})`;
        el.style.transformOrigin =
          side === "right" ? "right center" : "left center";
      }
      return;
    }

    el.style.fontSize = `${next}px`;
    if (next < maxPx * 0.72) el.style.letterSpacing = "0.02em";

    // Second pass — letter-spacing / subpixel can still overhang.
    if (el.scrollWidth > avail + 1) {
      next = Math.max(NAME_MIN_PX, next * (avail / el.scrollWidth));
      el.style.fontSize = `${next}px`;
      if (el.scrollWidth > avail + 1) {
        const sx = avail / el.scrollWidth;
        el.style.transform = `scaleX(${sx})`;
        el.style.transformOrigin =
          side === "right" ? "right center" : "left center";
      }
    }
  }, [children, side]);

  useLayoutEffect(() => {
    fit();
    const el = ref.current;
    if (!el) return undefined;

    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);

    let cancelled = false;
    const onFonts = () => {
      if (!cancelled) fit();
    };
    document.fonts?.ready?.then(onFonts);
    window.addEventListener("resize", fit);

    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [fit]);

  return (
    <FighterName ref={ref} title={typeof children === "string" ? children : undefined}>
      {children}
    </FighterName>
  );
}

FitFighterName.propTypes = {
  children: PropTypes.node,
  side: PropTypes.oneOf(["left", "right"]),
};

/*
 * Painted brush stroke — uneven edges via polygon, mawashi color.
 * Origin flips per side so it draws outward from the name.
 */
const BrushStroke = styled.div`
  position: relative;
  z-index: 1;
  width: min(100%, clamp(110px, 18cqw, 220px));
  height: 3px;
  margin-top: clamp(5px, 0.55cqh, 7px);
  background: ${(p) => p.$gradient || p.$color};
  transform-origin: ${(p) => (p.$side === "left" ? "left center" : "right center")};
  clip-path: ${(p) =>
    p.$side === "left"
      ? "polygon(0 30%, 8% 0%, 40% 20%, 70% 0%, 100% 35%, 94% 100%, 60% 80%, 30% 100%, 0 70%)"
      : "polygon(0 35%, 6% 100%, 40% 80%, 70% 100%, 100% 70%, 100% 30%, 92% 0%, 60% 20%, 30% 0%)"};
  animation: ${brushDraw} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.46s both;
`;

const MetaRow = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: ${(p) =>
    p.$side === "left" ? "flex-start" : "flex-end"};
  gap: clamp(6px, 0.85cqw, 10px);
  margin-top: clamp(4px, 0.55cqh, 7px);
  max-width: 100%;
`;

const MetaItem = styled.span`
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.48rem, 0.78cqw, 0.62rem);
  color: rgba(245, 236, 217, 0.58);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  white-space: nowrap;
`;

/* Prematch only — gold type in the meta row (HUD keeps the plaque). */
const MetaRank = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.5rem, 0.85cqw, 0.7rem);
  color: ${C.gold};
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: ${TEXT_SHADOW_UI}, 0 0 8px rgba(232, 197, 71, 0.22);
`;

const MetaSep = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(245, 236, 217, 0.3);
  flex-shrink: 0;
  align-self: center;
`;

const RecordText = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(0.55rem, 0.9cqw, 0.75rem);
  color: ${C.cream};
  letter-spacing: ${TRACK.meta};

  small {
    font-size: 0.75em;
    color: rgba(245, 236, 217, 0.45);
  }
`;

// ============================================
// HELPERS
// ============================================

const SPECIAL_REPRESENTATIVE_COLORS = {
  rainbow: "#FF6EC7",
  fire: "#FF8C00",
  vaporwave: "#DA70D6",
  camo: "#556B2F",
  galaxy: "#6A0DAD",
  gold: "#E6BD37",
};

const resolveAccentColor = (color) => {
  if (!color) return C.ice;
  return SPECIAL_REPRESENTATIVE_COLORS[color] || color;
};

export const SPECIAL_MAWASHI_GRADIENTS = {
  rainbow:
    "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
  fire: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)",
  vaporwave: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)",
  camo: "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)",
  galaxy: "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
  gold: "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
};

const FIGHTING_STYLES = [
  "Pusher",
  "Grappler",
  "Technician",
  "Power",
  "Speed",
  "Balanced",
];

const getSeededValue = (name, array) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash = hash & hash;
  }
  return array[Math.abs(hash) % array.length];
};

const getRank = (wins, losses) => {
  const total = wins + losses;
  const winRate = total > 0 ? wins / total : 0;

  if (wins >= 50 && winRate >= 0.7) return { title: "YOKOZUNA", number: "" };
  if (wins >= 30 && winRate >= 0.6) return { title: "OZEKI", number: "" };
  if (wins >= 20 && winRate >= 0.55) return { title: "SEKIWAKE", number: "" };
  if (wins >= 10)
    return {
      title: "KOMUSUBI",
      number: `#${Math.max(1, 10 - Math.floor(wins / 5))}`,
    };
  if (wins >= 5)
    return { title: "MAEGASHIRA", number: `#${Math.max(1, 15 - wins)}` };
  if (wins >= 2)
    return { title: "JONIDAN", number: `#${Math.max(1, 50 - wins * 10)}` };
  return { title: "JONOKUCHI", number: "" };
};

// ============================================
// COMPONENT
// ============================================
const PreMatchScreen = ({
  player1Name = "Player 1",
  player2Name = "Player 2",
  player1Color = SPRITE_BASE_COLOR,
  player2Color = "#DA1B44",
  player1BodyColor = null,
  player2BodyColor = null,
  player1GearIds = null,
  player2GearIds = null,
  player1Record = { wins: 0, losses: 0 },
  player2Record = { wins: 0, losses: 0 },
  player1RankLabel = null,
  player2RankLabel = null,
  loadingProgress: _loadingProgress = 0,
  isLoading = true,
  isCPUMatch = false,
  isBashoMatch = false,
  dayLabel,
}) => {
  const [player1Sprite, setPlayer1Sprite] = useState(pumo);
  const [player2Sprite, setPlayer2Sprite] = useState(pumo);
  const [spritesReady, setSpritesReady] = useState(false);

  const player1Style = getSeededValue(player1Name + "style", FIGHTING_STYLES);
  const player2Style = getSeededValue(player2Name + "style", FIGHTING_STYLES);

  const labelToRank = (label) => {
    const m = String(label).match(/^(.*?)(?:\s*#\s*(\d+))?$/);
    return {
      title: (m?.[1] || label).toUpperCase(),
      number: m?.[2] ? `#${m[2]}` : "",
    };
  };
  const player1Rank = player1RankLabel
    ? labelToRank(player1RankLabel)
    : getRank(player1Record.wins, player1Record.losses);
  const player2Rank = player2RankLabel
    ? labelToRank(player2RankLabel)
    : getRank(player2Record.wins, player2Record.losses);

  useEffect(() => {
    let cancelled = false;
    setSpritesReady(false);

    const buildSprites = async () => {
      try {
        const [p1, p2] = await Promise.all([
          buildIdlePortraitSrc({
            baseSrc: pumo,
            mawashiColor: player1Color,
            bodyColor: player1BodyColor,
            gearIds: player1GearIds,
          }),
          buildIdlePortraitSrc({
            baseSrc: pumo,
            mawashiColor: player2Color,
            bodyColor: player2BodyColor,
            gearIds: player2GearIds,
          }),
        ]);
        if (cancelled) return;
        setPlayer1Sprite(p1);
        setPlayer2Sprite(p2);
        setSpritesReady(true);
      } catch (err) {
        console.error("Failed to build prematch sprites:", err);
        if (!cancelled) {
          setPlayer1Sprite(pumo);
          setPlayer2Sprite(pumo);
          setSpritesReady(true);
        }
      }
    };

    buildSprites();
    return () => {
      cancelled = true;
    };
  }, [
    player1Color,
    player2Color,
    player1BodyColor,
    player2BodyColor,
    JSON.stringify(player1GearIds || []),
    JSON.stringify(player2GearIds || []),
  ]);

  const p1MawashiColor =
    player1Color === SPRITE_BASE_COLOR ? C.ice : player1Color;
  const p2MawashiColor = player2Color;
  const p1Gradient = SPECIAL_MAWASHI_GRADIENTS[player1Color];
  const p2Gradient = SPECIAL_MAWASHI_GRADIENTS[player2Color];
  const p1Accent = resolveAccentColor(p1MawashiColor);
  const p2Accent = resolveAccentColor(p2MawashiColor);

  const formatRankLabel = (rank) =>
    [rank.title, rank.number].filter(Boolean).join(" ");

  const matchMode = isBashoMatch
    ? "BASHO"
    : isCPUMatch
      ? "VS CPU"
      : "EXHIBITION";

  const slugSecondary = isBashoMatch && dayLabel ? dayLabel : null;

  return (
    <ScreenContainer>
      <StageDim />
      <GrainOverlay />

      <TopSlug>
        <SlugText $accent>
          <strong>VER.</strong> HATSU
        </SlugText>
        {slugSecondary && (
          <>
            <SlugRule aria-hidden />
            <SlugText>{slugSecondary}</SlugText>
          </>
        )}
      </TopSlug>

      <FighterStage>
        <FighterSide $side="left">
          <FighterWrap $side="left">
            <FloorShadow $side="left" />
            <FighterImg
              src={player1Sprite}
              alt={player1Name}
              $flip={false}
              $ready={spritesReady}
            />
          </FighterWrap>
        </FighterSide>

        <VsColumn>
          <VsMark
            role="status"
            aria-live="polite"
            aria-label={isLoading ? "Loading match" : "Match ready"}
          >
            <VsRule aria-hidden />
            <VsLetters>VS</VsLetters>
            <VsRule aria-hidden />
            <VsMetaPlate>
              <VsMode>{matchMode}</VsMode>
              {isLoading && (
                <VsLoadDots aria-hidden>
                  <span />
                  <span />
                  <span />
                </VsLoadDots>
              )}
            </VsMetaPlate>
          </VsMark>
        </VsColumn>

        <FighterSide $side="right">
          <FighterWrap $side="right">
            <FloorShadow $side="right" />
            <FighterImg
              src={player2Sprite}
              alt={player2Name}
              $flip={true}
              $ready={spritesReady}
            />
          </FighterWrap>
        </FighterSide>
      </FighterStage>

      <IdentityStage>
        <IdentitySlot $side="left">
          <IdentityBlock $side="left">
            <SideTag>
              <SideLabel $accent={p1Accent}>East</SideLabel>
            </SideTag>
            <FitFighterName side="left">{player1Name}</FitFighterName>
            <BrushStroke
              $side="left"
              $color={p1Accent}
              $gradient={p1Gradient}
              aria-hidden
            />
            <MetaRow $side="left">
              <MetaRank>{formatRankLabel(player1Rank)}</MetaRank>
              <MetaSep />
              <MetaItem>{player1Style}</MetaItem>
              <MetaSep />
              <RecordText>
                {player1Record.wins}
                <small>W</small>
                <span style={{ opacity: 0.35, margin: "0 3px" }}>·</span>
                {player1Record.losses}
                <small>L</small>
              </RecordText>
            </MetaRow>
          </IdentityBlock>
        </IdentitySlot>

        <div aria-hidden />

        <IdentitySlot $side="right">
          <IdentityBlock $side="right">
            <SideTag>
              <SideLabel $accent={p2Accent}>West</SideLabel>
            </SideTag>
            <FitFighterName side="right">{player2Name}</FitFighterName>
            <BrushStroke
              $side="right"
              $color={p2Accent}
              $gradient={p2Gradient}
              aria-hidden
            />
            <MetaRow $side="right">
              <RecordText>
                {player2Record.wins}
                <small>W</small>
                <span style={{ opacity: 0.35, margin: "0 3px" }}>·</span>
                {player2Record.losses}
                <small>L</small>
              </RecordText>
              <MetaSep />
              <MetaItem>{player2Style}</MetaItem>
              <MetaSep />
              <MetaRank>{formatRankLabel(player2Rank)}</MetaRank>
            </MetaRow>
          </IdentityBlock>
        </IdentitySlot>
      </IdentityStage>
    </ScreenContainer>
  );
};

PreMatchScreen.propTypes = {
  player1Name: PropTypes.string,
  player2Name: PropTypes.string,
  player1Color: PropTypes.string,
  player2Color: PropTypes.string,
  player1BodyColor: PropTypes.string,
  player2BodyColor: PropTypes.string,
  player1GearIds: PropTypes.arrayOf(PropTypes.string),
  player2GearIds: PropTypes.arrayOf(PropTypes.string),
  player1Record: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  player2Record: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  player1RankLabel: PropTypes.string,
  player2RankLabel: PropTypes.string,
  loadingProgress: PropTypes.number,
  isLoading: PropTypes.bool,
  isCPUMatch: PropTypes.bool,
  isBashoMatch: PropTypes.bool,
  dayLabel: PropTypes.string,
};

export default PreMatchScreen;
