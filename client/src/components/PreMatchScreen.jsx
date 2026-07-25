import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

import pumo from "../assets/pumo-idle.png";
import { SPRITE_BASE_COLOR } from "../utils/SpriteRecolorizer";
import { buildIdlePortraitSrc } from "../utils/hatComposite";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  broadcastSlideDown,
  TEXT_SHADOW_DISPLAY,
  TEXT_SHADOW_DISPLAY_HEAVY,
} from "./menuTheme";
import { SHADOW_GRADIENT } from "./PlayerShadow";

/*
 * PreMatchScreen — printed banzuke face-off over the live arena.
 *
 * Floating identity (no boxed containers). Rank plaque matches
 * UiPlayerInfo exactly. No glass scrims, color washes, or glow blooms.
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
    transform: translate(-40px, 16px);
  }
  to {
    opacity: 1;
    transform: translate(0, 0);
  }
`;

const identityInRight = keyframes`
  from {
    opacity: 0;
    transform: translate(40px, 16px);
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
  font-weight: 700;
  font-size: clamp(0.42rem, 0.72cqw, 0.56rem);
  color: ${(p) => (p.$accent ? C.ice : C.creamMute)};
  letter-spacing: 0.3em;
  text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);

  strong {
    color: ${C.cream};
    letter-spacing: 0.1em;
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
  /* Clear the identity block so sprites aren't chopped by names */
  bottom: clamp(118px, 19cqh, 160px);
  display: grid;
  /* Narrower center corridor — fighters sit closer over the dohyo */
  grid-template-columns: 1fr minmax(64px, 10cqw) 1fr;
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
  top: 6%;
  /* Raised off the identity strip so feet sit on the dohyo surface */
  bottom: clamp(36px, 6.5cqh, 56px);
  /* Equal inward pull toward the ring center */
  ${(p) =>
    p.$side === "left"
      ? "left: 28%; right: -4%;"
      : "right: 28%; left: -4%;"}
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
  width: clamp(160px, 23cqw, 270px);
  height: clamp(36px, 5.2cqw, 60px);
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
  height: 80%;
  max-width: min(100%, 33cqw);
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
  justify-content: center;
  z-index: 25;
  padding-top: 32%;
  padding-bottom: 0;
  /* Subtle left bias — less than the left fighter nudge */
  transform: translateX(-0.15cqw);
`;

const VsMark = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.6cqh, 8px);
  will-change: transform, opacity;
  animation: ${vsStampIn} 0.58s cubic-bezier(0.34, 1.5, 0.64, 1) 0.18s both;
`;

const VsRule = styled.div`
  width: clamp(36px, 5cqw, 56px);
  height: 2px;
  background: ${C.vermillion};
  flex-shrink: 0;
`;

const VsLetters = styled.div`
  position: relative;
  z-index: 2;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(44px, 7cqw, 88px);
  color: #ffffff;
  letter-spacing: 0.04em;
  line-height: 0.82;
  text-shadow: ${TEXT_SHADOW_DISPLAY_HEAVY};
`;

/* Solid plate so mode + loading stay readable over the live arena. */
const VsMetaPlate = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  padding: clamp(5px, 0.7cqh, 8px) clamp(12px, 1.6cqw, 18px);
  background: ${C.sumi};
  border: 1px solid rgba(245, 236, 217, 0.22);
`;

const VsMode = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.52rem, 0.9cqw, 0.7rem);
  color: ${C.cream};
  letter-spacing: 0.28em;
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
// IDENTITY — floating type, no containers
// ============================================

const IdentityStage = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: clamp(14px, 2.2cqh, 28px);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: clamp(20px, 4cqw, 48px);
  padding: 0 clamp(18px, 3cqw, 40px);
  z-index: 30;
  pointer-events: none;
`;

const IdentityBlock = styled.div`
  position: relative;
  flex: 1 1 0;
  max-width: min(46cqw, 560px);
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$side === "left" ? "flex-start" : "flex-end")};
  text-align: ${(p) => (p.$side === "left" ? "left" : "right")};
  will-change: transform, opacity;
  animation: ${(p) =>
      p.$side === "left" ? identityInLeft : identityInRight}
    0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.28s both;
`;

const SideTag = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: clamp(4px, 0.55cqh, 8px);
`;

const SideLabel = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${(p) => p.$accent};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  line-height: 1;
`;

const FighterName = styled.div`
  position: relative;
  z-index: 2;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(24px, 3.8cqw, 48px);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 0.92;
  /* Soft ambient seat — hard 1px stroke read as jagged at these sizes */
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* Rank sits on its own row under the name — never shares the name line. */
const RankRow = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: ${(p) =>
    p.$side === "left" ? "flex-start" : "flex-end"};
  margin-top: clamp(6px, 0.75cqh, 10px);
`;

/*
 * Rank plaque — kept in lockstep with UiPlayerInfo so prematch and HUD
 * print the same lacquered banzuke plate (gold-leaf hairline + side ticks).
 */
const RankPlaque = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(5px, 0.55cqw, 9px);
  flex-shrink: 0;
  padding: clamp(3px, 0.4cqh, 6px) clamp(8px, 1cqw, 14px);
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 2px,
      rgba(245, 236, 217, 0.028) 2px,
      rgba(245, 236, 217, 0.028) 3px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 4px,
      rgba(245, 236, 217, 0.018) 4px,
      rgba(245, 236, 217, 0.018) 5px
    ),
    linear-gradient(
      180deg,
      rgba(22, 28, 40, 0.96) 0%,
      rgba(12, 16, 26, 0.98) 48%,
      rgba(8, 10, 18, 0.96) 100%
    );
  border-radius: 3px;
  border: 1px solid rgba(232, 197, 71, 0.42);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 246, 210, 0.14),
    inset 0 -1px 3px rgba(0, 0, 0, 0.4);

  &::before,
  &::after {
    content: "";
    width: 2px;
    height: 55%;
    border-radius: 1px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(232, 197, 71, 0.55) 30%,
      rgba(232, 197, 71, 0.75) 50%,
      rgba(232, 197, 71, 0.55) 70%,
      transparent 100%
    );
    flex-shrink: 0;
  }
`;

const RankText = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(10px, 1.2cqw, 14px);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 1;
  text-shadow:
    0 0 10px rgba(232, 197, 71, 0.4),
    0 0 3px rgba(232, 197, 71, 0.35),
    0 1px 3px rgba(0, 0, 0, 0.95);
  white-space: nowrap;
`;

/*
 * Painted brush stroke — uneven edges via polygon, mawashi color.
 * Origin flips per side so it draws outward from the name.
 */
const BrushStroke = styled.div`
  position: relative;
  z-index: 1;
  width: min(100%, clamp(140px, 24cqw, 280px));
  height: 4px;
  margin-top: clamp(6px, 0.75cqh, 9px);
  background: ${(p) => p.$gradient || p.$color};
  transform-origin: ${(p) => (p.$side === "left" ? "left center" : "right center")};
  clip-path: ${(p) =>
    p.$side === "left"
      ? "polygon(0 30%, 8% 0%, 40% 20%, 70% 0%, 100% 35%, 94% 100%, 60% 80%, 30% 100%, 0 70%)"
      : "polygon(0 35%, 6% 100%, 40% 80%, 70% 100%, 100% 70%, 100% 30%, 92% 0%, 60% 20%, 30% 0%)"};
  animation: ${brushDraw} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.48s both;
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
  margin-top: clamp(8px, 1cqh, 12px);
  max-width: 100%;
`;

const MetaItem = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.48rem, 0.78cqw, 0.62rem);
  color: rgba(245, 236, 217, 0.58);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  white-space: nowrap;
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
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.55rem, 0.9cqw, 0.75rem);
  color: ${C.cream};
  letter-spacing: 0.08em;

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
  gold: "#D4A520",
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

const DOJO_NAMES = [
  "Ice Floe Dojo",
  "Blizzard Hall",
  "Glacier Peak",
  "Frostbite Stable",
  "Snowdrift Gym",
  "Penguin Palace",
  "Arctic Thunder",
  "Frozen Tundra",
];

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
  player2Color = "#D94848",
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

  const player1Dojo = getSeededValue(player1Name, DOJO_NAMES);
  const player2Dojo = getSeededValue(player2Name, DOJO_NAMES);
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
        <IdentityBlock $side="left">
          <SideTag>
            <SideLabel $accent={p1Accent}>East</SideLabel>
          </SideTag>
          <FighterName>{player1Name}</FighterName>
          <RankRow $side="left">
            <RankPlaque>
              <RankText>{formatRankLabel(player1Rank)}</RankText>
            </RankPlaque>
          </RankRow>
          <BrushStroke
            $side="left"
            $color={p1Accent}
            $gradient={p1Gradient}
            aria-hidden
          />
          <MetaRow $side="left">
            <MetaItem>{player1Dojo}</MetaItem>
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

        <IdentityBlock $side="right">
          <SideTag>
            <SideLabel $accent={p2Accent}>West</SideLabel>
          </SideTag>
          <FighterName>{player2Name}</FighterName>
          <RankRow $side="right">
            <RankPlaque>
              <RankText>{formatRankLabel(player2Rank)}</RankText>
            </RankPlaque>
          </RankRow>
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
            <MetaItem>{player2Dojo}</MetaItem>
          </MetaRow>
        </IdentityBlock>
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
