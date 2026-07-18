import { useCallback, useContext, useEffect, useState, useRef } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import Snowfall from "./Snowfall";
import lobbyBackground from "../assets/lockerroom.webp";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
} from "../utils/SpriteRecolorizer";
import pumo from "../assets/pumo-idle.png";
import { SHADOW_GRADIENT } from "./PlayerShadow";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  fadeIn,
  fadeUp,
  broadcastSlideDown,
  clipRevealLeft,
  clipRevealRight,
  clipRevealUp,
} from "./menuTheme";

/*
 * Lobby — VS CPU + Custom Match prep room.
 *
 * Same printed-banzuke language as PreMatch / BashoHub / MainMenu:
 * locker-room stage, letterbox dim, cream type, vermillion rules.
 * No full-width header or footer bars — floating slug, corner leave,
 * identity type, and compact control clusters only.
 */

const D = {
  page: "#080a0e",
  panel: "rgba(14, 16, 22, 0.92)",
  head: "#171a20",
  soft: "#22262d",
  deep: "#0c0e14",
  border: "rgba(245, 236, 217, 0.20)",
  borderSoft: "rgba(245, 236, 217, 0.10)",
  shadow: "rgba(0, 0, 0, 0.55)",
};

// ============================================
// LOCAL ANIMATIONS
// ============================================

const breathe = keyframes`
  0%, 100% { transform: scaleY(1); }
  50%      { transform: scaleY(1.022); }
`;

const dotPulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.45; }
  50%      { transform: scale(1.3); opacity: 1; }
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

const swatchPop = keyframes`
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1); }
`;

// ============================================
// SHELL
// ============================================

const LobbyContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 360px;
  background: ${D.page};
  overflow: hidden;
  container-type: size;
  font-family: ${FONT_BODY};
  animation: ${fadeIn} 0.28s ease-out;
`;

/*
 * Background — obscure AI detail without a black cave or blur mush.
 * Desat + frost scrim + vignette + dense grain = room as atmosphere.
 */
const BackgroundImage = styled.div`
  position: absolute;
  inset: 0;
  background: url(${lobbyBackground}) center bottom / cover;
  transform: scale(1.08) translateX(1.7%);
  transform-origin: 50% 100%;
  opacity: 1;
  filter: saturate(0.42) brightness(0.78) contrast(1.1);
  z-index: 0;
  pointer-events: none;
`;

/* Translucent frost — softens AI micro-detail while keeping the room lit. */
const FrostScrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 70% 58% at 50% 48%,
      rgba(234, 241, 247, 0.14) 0%,
      rgba(234, 241, 247, 0.04) 45%,
      transparent 72%
    ),
    linear-gradient(
      180deg,
      rgba(18, 24, 36, 0.38) 0%,
      rgba(18, 24, 36, 0.12) 36%,
      rgba(18, 24, 36, 0.18) 62%,
      rgba(18, 24, 36, 0.5) 100%
    );
`;

const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 42% 40% at 26% 70%,
      transparent 0%,
      transparent 50%,
      rgba(4, 6, 10, 0.35) 100%
    ),
    radial-gradient(
      ellipse 42% 40% at 74% 70%,
      transparent 0%,
      transparent 50%,
      rgba(4, 6, 10, 0.35) 100%
    ),
    radial-gradient(
      ellipse 60% 50% at 50% 55%,
      transparent 0%,
      rgba(4, 6, 10, 0.18) 58%,
      rgba(4, 6, 10, 0.55) 100%
    ),
    linear-gradient(
      180deg,
      rgba(4, 6, 10, 0.55) 0%,
      rgba(4, 6, 10, 0.18) 20%,
      rgba(4, 6, 10, 0.06) 45%,
      rgba(4, 6, 10, 0.22) 72%,
      rgba(4, 6, 10, 0.58) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.38;
  mix-blend-mode: overlay;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(60, 40, 20, 0.07) 0,
      transparent 1px,
      transparent 2px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(60, 40, 20, 0.05) 0,
      transparent 1px,
      transparent 3px
    );
`;

// ============================================
// TOP SLUG + LEAVE (floating chrome)
// ============================================

const TopSlug = styled.div`
  position: absolute;
  top: clamp(10px, 1.5cqh, 16px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  z-index: 30;
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
  white-space: nowrap;

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

const LeaveButton = styled.button`
  position: absolute;
  top: clamp(10px, 1.5cqh, 16px);
  left: clamp(14px, 2.2cqw, 28px);
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  min-height: 38px;
  padding: clamp(7px, 1cqh, 10px) clamp(13px, 1.8cqw, 20px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.52rem, 0.8cqw, 0.64rem);
  text-transform: uppercase;
  letter-spacing: 0.28em;
  color: ${C.creamMute};
  background: ${C.sumi};
  border: 1px solid rgba(245, 236, 217, 0.22);
  border-radius: 0;
  cursor: pointer;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease,
    transform 0.18s ease;
  animation: ${fadeIn} 0.35s ease both;

  .arrow {
    font-weight: 700;
    transition: transform 0.2s ease;
  }

  &:hover {
    color: ${C.cream};
    border-color: rgba(245, 236, 217, 0.4);

    .arrow {
      transform: translateX(-3px);
    }
  }

  &:active {
    transform: scale(0.98);
  }
`;

// ============================================
// FIGHTER STAGE
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr minmax(64px, 10cqw) 1fr;
  align-items: stretch;
  padding: clamp(44px, 6.5cqh, 58px) clamp(18px, 3cqw, 48px)
    clamp(64px, 10cqh, 88px);
  overflow: hidden;
`;

const FighterColumn = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(56px, 10cqh, 110px);
  min-height: 0;
  min-width: 0;
  will-change: transform, opacity;
  animation: ${(p) => (p.$side === "left" ? clipRevealLeft : clipRevealRight)}
    0.55s cubic-bezier(0.2, 0.7, 0.2, 1) 0.08s both;
`;

const FighterPortrait = styled.div`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  flex: 0 1 auto;
  min-height: 0;
  z-index: 4;
`;

const FloorShadow = styled.div`
  position: absolute;
  left: 50%;
  bottom: clamp(0px, 0.2cqh, 4px);
  transform: translateX(-50%);
  width: clamp(150px, 20cqw, 240px);
  height: clamp(28px, 4.2cqh, 48px);
  border-radius: 50%;
  background: ${SHADOW_GRADIENT};
  z-index: 1;
  pointer-events: none;
`;

const AvatarFrame = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;

  ${(p) =>
    p.$side === "left" &&
    css`
      transform: scaleX(-1);
    `}
`;

const AvatarBreath = styled.div`
  animation: ${breathe} 2.6s ease-in-out infinite;
  transform-origin: center bottom;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
`;

const PreviewImage = styled.img`
  max-height: clamp(220px, 52cqh, 460px);
  height: auto;
  max-width: 100%;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000);
`;

const WaitingState = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 100%;
`;

const WaitingSilhouette = styled.img`
  max-height: clamp(220px, 52cqh, 460px);
  height: auto;
  max-width: 100%;
  width: auto;
  object-fit: contain;
  filter: brightness(0) opacity(0.16);
  ${(p) =>
    p.$side === "left" &&
    css`
      transform: scaleX(-1);
    `}
`;

const WaitingText = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  margin-top: clamp(2px, 0.4cqh, 4px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.65cqw, 0.52rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
`;

const LoadingDots = styled.span`
  display: inline-flex;
  gap: 5px;
`;

const Dot = styled.span`
  width: 5px;
  height: 5px;
  background: ${C.vermillion};
  border-radius: 50%;
  animation: ${dotPulse} 1.4s ease-in-out infinite;
  animation-delay: ${(p) => p.$delay * 0.18}s;
`;

// ============================================
// IDENTITY — floating type ABOVE each fighter
// ============================================

const IdentityBlock = styled.div`
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(2px, 0.4cqh, 5px);
  padding: 0;
  flex-shrink: 0;
  max-width: 92%;
  margin-top: auto;
  animation: ${fadeUp} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.22s both;
`;

const SideLabel = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${(p) => (p.$hasFighter ? C.vermillion : C.creamMute)};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
`;

const FighterName = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.05rem, 2cqw, 1.55rem);
  color: ${(p) => (p.$hasFighter ? "#ffffff" : C.creamMute)};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 0.95;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    0 2px 0 rgba(0, 0, 0, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const IdentityRule = styled.div`
  width: clamp(36px, 5cqw, 56px);
  height: 2px;
  margin-top: 2px;
  background: ${(p) => (p.$hasFighter ? C.vermillion : "rgba(245, 236, 217, 0.2)")};
`;

// ============================================
// CENTER VS — same stamp as PreMatchScreen
// ============================================

const VsColumn = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 6;
  /* Drop the stamp toward the fighter midsection. */
  padding-top: clamp(160px, 32cqh, 280px);
  pointer-events: none;
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

const VsKanji = styled.div`
  position: relative;
  z-index: 2;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(14px, 1.8cqw, 22px);
  color: ${C.cream};
  letter-spacing: 0.28em;
  line-height: 1;
  margin-right: -0.28em;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
`;

const VsLetters = styled.div`
  position: relative;
  z-index: 2;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(44px, 7cqw, 88px);
  color: #ffffff;
  letter-spacing: 0.04em;
  line-height: 0.82;
  text-shadow:
    -2px -2px 0 #000,
    2px -2px 0 #000,
    -2px 2px 0 #000,
    2px 2px 0 #000,
    0 3px 0 rgba(0, 0, 0, 0.9);
`;

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

// ============================================
// CPU SKILL — slim strip under West identity
// ============================================

const SkillStrip = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(5px, 0.7cqh, 8px);
  margin-top: clamp(4px, 0.7cqh, 8px);
  animation: ${fadeUp} 0.4s ease-out 0.28s both;
`;

const SkillCaption = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.38rem, 0.58cqw, 0.46rem);
  color: ${C.creamMute};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
`;

const SkillOptions = styled.div`
  display: flex;
  align-items: stretch;
  border: 1px solid rgba(245, 236, 217, 0.28);
  background: rgba(14, 16, 22, 0.82);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
`;

const SkillOption = styled.button`
  padding: clamp(6px, 0.9cqh, 9px) clamp(8px, 1.1cqw, 12px);
  background: ${(p) => (p.$selected ? C.vermillion : "transparent")};
  border: 0;
  cursor: pointer;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.48rem, 0.72cqw, 0.58rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1;
  color: ${(p) => (p.$selected ? C.cream : C.creamMute)};
  transition: background 0.15s ease, color 0.15s ease;

  & + & {
    border-left: 1px solid rgba(245, 236, 217, 0.18);
  }

  &:hover {
    ${(p) =>
      !p.$selected &&
      css`
        color: ${C.cream};
        background: rgba(245, 236, 217, 0.06);
      `}
  }
`;

// ============================================
// CONTROL DOCK — floating clusters (not a footer bar)
// ============================================

const ControlDock = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(12px, 2cqw, 24px);
  padding: 0 clamp(14px, 2.4cqw, 32px) clamp(12px, 2cqh, 22px);
  pointer-events: none;
  animation: ${clipRevealUp} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s both;

  & > * {
    pointer-events: auto;
  }
`;

const CustomizePlaque = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.2cqw, 14px);
  min-width: 0;
  max-width: min(62cqw, 720px);
  min-height: clamp(44px, 5.2cqh, 52px);
  padding: clamp(8px, 1.1cqh, 12px) clamp(10px, 1.4cqw, 16px);
  background: ${D.panel};
  border: 1px solid ${D.border};
  box-shadow: 0 10px 28px ${D.shadow};
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${C.vermillion};
    z-index: 2;
  }
`;

const TabGroup = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0;
  flex-shrink: 0;
  border: 1px solid rgba(245, 236, 217, 0.18);
`;

const Tab = styled.button`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.74cqw, 0.58rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  padding: clamp(7px, 1cqh, 10px) clamp(10px, 1.4cqw, 14px);
  background: ${(p) => (p.$active ? C.vermillion : "transparent")};
  border: 0;
  color: ${(p) => (p.$active ? C.cream : C.creamMute)};
  cursor: pointer;
  transition: color 0.18s ease, background 0.18s ease;

  & + & {
    border-left: 1px solid rgba(245, 236, 217, 0.18);
  }

  &:hover {
    color: ${C.cream};
    ${(p) =>
      !p.$active &&
      css`
        background: rgba(245, 236, 217, 0.06);
      `}
  }
`;

const SwatchLane = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
`;

const SwatchSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: clamp(3px, 0.5cqw, 6px);
  flex-wrap: nowrap;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-block: clamp(4px, 0.6cqh, 6px);
  padding-inline: clamp(4px, 0.6cqw, 6px);
  scroll-padding-inline: clamp(4px, 0.6cqw, 6px);
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const ScrollArrow = styled.button`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$dir === "left" ? "left: 0;" : "right: 0;")}
  width: clamp(26px, 3cqw, 34px);
  display: inline-flex;
  align-items: center;
  justify-content: ${(p) => (p.$dir === "left" ? "flex-start" : "flex-end")};
  padding: 0 clamp(3px, 0.5cqw, 6px);
  border: 0;
  cursor: pointer;
  background: linear-gradient(
    ${(p) => (p.$dir === "left" ? "90deg" : "270deg")},
    ${D.deep} 0%,
    rgba(12, 14, 20, 0.92) 35%,
    rgba(12, 14, 20, 0) 100%
  );
  color: ${C.gold};
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(13px, 1.4cqw, 17px);
  line-height: 1;
  z-index: 2;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: ${(p) => (p.$visible ? "auto" : "none")};
  transition: opacity 0.18s ease, color 0.18s ease, transform 0.15s ease;

  &:hover {
    color: ${C.cream};
  }

  &:active {
    transform: scale(0.92);
  }

  span {
    display: inline-block;
    transition: transform 0.18s ease;
  }

  &:hover span {
    transform: ${(p) =>
      p.$dir === "left" ? "translateX(-2px)" : "translateX(2px)"};
  }
`;

const SwatchDivider = styled.div`
  width: 1px;
  height: clamp(18px, 2.4cqh, 26px);
  background: rgba(245, 236, 217, 0.22);
  margin: 0 clamp(2px, 0.4cqw, 5px);
  flex-shrink: 0;
`;

const ColorSwatch = styled.button`
  position: relative;
  width: clamp(18px, 2cqw, 26px);
  height: clamp(18px, 2cqw, 26px);
  border-radius: 50%;
  border: 2px solid
    ${(p) => (p.$selected ? C.gold : "rgba(245, 236, 217, 0.32)")};
  background: ${(p) => p.$gradient || p.$color};
  cursor: ${(p) => (p.$taken ? "not-allowed" : "pointer")};
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  flex-shrink: 0;
  animation: ${swatchPop} 0.35s ease-out both;
  animation-delay: ${(p) => Math.min(p.$index ?? 0, 20) * 0.015}s;
  overflow: hidden;
  box-shadow: ${(p) =>
    p.$selected
      ? `inset 0 0 6px 1px rgba(0, 0, 0, 0.26),
         0 0 0 2px rgba(232, 197, 71, 0.45),
         0 3px 8px rgba(0, 0, 0, 0.52)`
      : `inset 0 0 5px 1px rgba(0, 0, 0, 0.2),
         0 2px 6px rgba(0, 0, 0, 0.48)`};

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      circle at 50% 44%,
      rgba(255, 255, 255, 0.18) 0%,
      transparent 58%
    );
    pointer-events: none;
  }

  ${(p) =>
    p.$taken &&
    css`
      opacity: 0.35;
      &::after {
        content: "✕";
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: clamp(9px, 1.2cqw, 13px);
        color: ${C.cream};
        z-index: 2;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
      }
    `}

  &:hover {
    transform: ${(p) => (p.$taken ? "none" : "scale(1.18)")};
    border-color: ${(p) =>
      p.$taken
        ? "rgba(245, 236, 217, 0.32)"
        : p.$selected
          ? C.gold
          : C.cream};
  }

  &:active {
    transform: ${(p) => (p.$taken ? "none" : "scale(0.94)")};
  }
`;

const PatternSwatch = styled(ColorSwatch)`
  width: clamp(21px, 2.3cqw, 30px);
  height: clamp(21px, 2.3cqw, 30px);
  border-radius: 5px;

  &::before {
    background: radial-gradient(
      ellipse 100% 78% at 50% 20%,
      rgba(255, 255, 255, 0.24) 0%,
      transparent 58%
    );
  }
`;

const SelectedBlock = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  border-left: 1px solid rgba(245, 236, 217, 0.18);
  padding-left: clamp(10px, 1.4cqw, 14px);
  min-width: clamp(96px, 11cqw, 132px);
  flex-shrink: 0;
`;

const SelectedSwatchPreview = styled.div`
  position: relative;
  width: clamp(20px, 2.2cqw, 26px);
  height: clamp(20px, 2.2cqw, 26px);
  border-radius: 50%;
  background: ${(p) => p.$gradient || p.$color};
  border: 2px solid ${C.gold};
  flex-shrink: 0;
  overflow: hidden;
  box-shadow:
    inset 0 0 5px 1px rgba(0, 0, 0, 0.22),
    0 1px 5px rgba(0, 0, 0, 0.42);
`;

const SelectedNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`;

const SelectedCategory = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.38rem, 0.58cqw, 0.46rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.24em;
`;

const SelectedNameLabel = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.52rem, 0.82cqw, 0.68rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ActionCluster = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 16px);
  flex-shrink: 0;
`;

const readyPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 18px rgba(216, 59, 39, 0.45);
  }
  50% {
    box-shadow: 0 0 28px rgba(238, 81, 65, 0.7);
  }
`;

/*
 * Ready CTA — same footprint, louder presence.
 * Bright vermillion + soft red pulse. No cream/white trim.
 */
const ReadyButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.1cqw, 12px);
  height: clamp(44px, 5.2cqh, 52px);
  padding: 0 clamp(28px, 3.6cqw, 52px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.82rem, 1.2cqw, 1.05rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: #ffffff;
  background: linear-gradient(
    180deg,
    ${C.vermillionBright} 0%,
    ${C.vermillion} 55%,
    ${C.vermillionDeep} 100%
  );
  border: 1px solid ${C.vermillionDeep};
  border-radius: 0;
  cursor: pointer;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
  animation: ${readyPulse} 1.8s ease-in-out infinite;
  transition: background 0.16s ease, transform 0.12s ease, filter 0.16s ease;

  &:hover {
    filter: brightness(1.08);
    animation: none;
    box-shadow: 0 0 32px rgba(238, 81, 65, 0.75);
  }

  &:active {
    transform: scale(0.98);
    filter: brightness(0.95);
  }
`;

const CancelButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: clamp(44px, 5.2cqh, 52px);
  padding: 0 clamp(28px, 3.6cqw, 52px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.82rem, 1.2cqw, 1.05rem);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: ${C.creamMute};
  background: transparent;
  border: 1px solid rgba(245, 236, 217, 0.32);
  border-radius: 0;
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease,
    transform 0.12s ease;

  &:hover {
    color: ${C.cream};
    border-color: rgba(245, 236, 217, 0.55);
    background: rgba(14, 16, 22, 0.55);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const ReadyChip = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: clamp(44px, 5.2cqh, 52px);
  padding: 0 clamp(12px, 1.6cqw, 18px);
  background: ${C.sumi};
  border: 1px solid ${(p) => (p.$ready ? C.gold : "rgba(245, 236, 217, 0.22)")};
  min-width: clamp(80px, 10cqw, 112px);
`;

const ReadyChipLabel = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.38rem, 0.58cqw, 0.46rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.26em;
`;

const ReadyChipCount = styled.span`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.78rem, 1.2cqw, 1rem);
  color: ${(p) => (p.$ready ? C.gold : C.cream)};
  letter-spacing: 0.16em;
`;

// ============================================
// COLORED PLAYER PREVIEW
// ============================================

function ColoredPlayerPreview({ color, bodyColor }) {
  const [imageSrc, setImageSrc] = useState(pumo);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const needsMawashiRecolor = color && color !== SPRITE_BASE_COLOR;
    const needsBodyRecolor = !!bodyColor;

    if (!needsMawashiRecolor && !needsBodyRecolor) {
      setImageSrc(pumo);
      return;
    }

    const options = {};
    if (needsBodyRecolor) {
      options.bodyColorRange = GREY_BODY_RANGES;
      options.bodyColorHex = bodyColor;
    }

    recolorImage(
      pumo,
      BLUE_COLOR_RANGES,
      needsMawashiRecolor ? color : SPRITE_BASE_COLOR,
      options
    )
      .then((recolored) => {
        if (mountedRef.current) {
          setImageSrc(recolored);
        }
      })
      .catch((error) => {
        console.error("Failed to recolor preview:", error);
        if (mountedRef.current) {
          setImageSrc(pumo);
        }
      });
  }, [color, bodyColor]);

  return <PreviewImage src={imageSrc} alt="Player Preview" />;
}

ColoredPlayerPreview.propTypes = {
  color: PropTypes.string,
  bodyColor: PropTypes.string,
};

// ============================================
// LOBBY COMPONENT
// ============================================

const CPU_DIFFICULTIES = ["EASY", "NORMAL", "HARD", "IMPOSSIBLE"];

const Lobby = ({
  rooms,
  setRooms,
  roomName,
  handleGame,
  setCurrentPage,
  onLeaveDohyo,
  isCPUMatch = false,
}) => {
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const { socket } = useContext(SocketContext);

  const {
    setPlayer1Color,
    setPlayer2Color,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  } = usePlayerColors();

  const [selectedDifficulty, setSelectedDifficulty] = useState("HARD");
  const [customizeTab, setCustomizeTab] = useState("body");

  const swatchScrollRef = useRef(null);
  const [canScrollLeftSwatches, setCanScrollLeftSwatches] = useState(false);
  const [canScrollRightSwatches, setCanScrollRightSwatches] = useState(false);

  const measureSwatchScroll = useCallback(() => {
    const el = swatchScrollRef.current;
    if (!el) {
      setCanScrollLeftSwatches(false);
      setCanScrollRightSwatches(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeftSwatches(el.scrollLeft > 1);
    setCanScrollRightSwatches(el.scrollLeft < max - 1);
  }, []);

  const scrollSwatchesBy = useCallback((direction) => {
    const el = swatchScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * el.clientWidth * 0.72,
      behavior: "smooth",
    });
  }, []);

  const myPlayerIndex = players.findIndex((p) => p.id === socket.id);

  useEffect(() => {
    measureSwatchScroll();
    const el = swatchScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      measureSwatchScroll();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureSwatchScroll, customizeTab, myPlayerIndex]);

  const isPlayer1 = myPlayerIndex === 0;

  const serverPlayer1Color = players[0]?.mawashiColor || SPRITE_BASE_COLOR;
  const serverPlayer2Color = players[1]?.mawashiColor || "#D94848";
  const serverPlayer1BodyColor = players[0]?.bodyColor || null;
  const serverPlayer2BodyColor = players[1]?.bodyColor || null;

  const isPvP =
    !isCPUMatch &&
    players[0]?.fighter &&
    players[1]?.fighter &&
    !players[1]?.isCPU;
  const otherPlayerMawashi = isPlayer1 ? serverPlayer2Color : serverPlayer1Color;
  const otherPlayerBody = isPlayer1
    ? serverPlayer2BodyColor
    : serverPlayer1BodyColor;
  const isColorTakenByOther = (hex) =>
    isPvP &&
    otherPlayerMawashi &&
    hex?.toLowerCase() === otherPlayerMawashi.toLowerCase();
  const isBodyColorTakenByOther = (hex) =>
    isPvP &&
    hex !== null &&
    otherPlayerBody !== null &&
    hex?.toLowerCase() === otherPlayerBody?.toLowerCase();

  const myMawashiColor = isPlayer1 ? serverPlayer1Color : serverPlayer2Color;
  const myBodyColor = isPlayer1 ? serverPlayer1BodyColor : serverPlayer2BodyColor;

  const beltSolids = [
    { name: "Default", hex: SPRITE_BASE_COLOR },
    { name: "Graphite", hex: "#525252" },
    { name: "Scarlet", hex: "#D94848" },
    { name: "Coral", hex: "#E87070" },
    { name: "Tangerine", hex: "#E8913A" },
    { name: "Gold", hex: "#D4A520" },
    { name: "Emerald", hex: "#2E9E5A" },
    { name: "Cobalt", hex: "#3B5EB0" },
    { name: "Orchid", hex: "#A85DBF" },
  ];

  const beltPatterns = [
    {
      name: "Rainbow",
      hex: "rainbow",
      gradient:
        "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
    },
    {
      name: "Fire",
      hex: "fire",
      gradient: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)",
    },
    {
      name: "Vaporwave",
      hex: "vaporwave",
      gradient: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)",
    },
    {
      name: "Camo",
      hex: "camo",
      gradient:
        "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)",
    },
    {
      name: "Galaxy",
      hex: "galaxy",
      gradient:
        "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
    },
    {
      name: "Shiny Gold",
      hex: "gold",
      gradient:
        "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
    },
  ];

  const bodyColors = [
    {
      name: "Default",
      hex: null,
      gradient: "linear-gradient(135deg, #888 0%, #aaa 50%, #888 100%)",
    },
    { name: "Black", hex: "#4d4d4d" },
    { name: "Blue", hex: "#2656A8" },
    { name: "Purple", hex: "#9932CC" },
    { name: "Green", hex: "#32CD32" },
    { name: "Aqua", hex: "#17A8A0" },
    { name: "Orange", hex: "#E27020" },
    { name: "Pink", hex: "#FFB6C1" },
    { name: "Yellow", hex: "#F5C422" },
    { name: "Brown", hex: "#8B5E3C" },
    { name: "Silver", hex: "#A8A8A8" },
    { name: "Light Blue", hex: "#6ABED0" },
    { name: "Red", hex: "#CC3333" },
  ];

  const allBeltOptions = [...beltSolids, ...beltPatterns];
  const selectedBeltOption = allBeltOptions.find(
    (c) => c.hex === myMawashiColor
  );
  const selectedBodyOption = bodyColors.find((c) => c.hex === myBodyColor);
  const selectedBeltName = selectedBeltOption?.name || "Default";
  const selectedBodyName = selectedBodyOption?.name || "Default";

  const handleColorSelect = (color) => {
    if (myPlayerIndex === -1) return;
    if (isColorTakenByOther(color)) return;
    socket.emit("update_mawashi_color", {
      roomId: roomName,
      playerId: socket.id,
      color,
    });
  };

  const handleBodyColorSelect = (color) => {
    if (myPlayerIndex === -1) return;
    if (isBodyColorTakenByOther(color)) return;
    socket.emit("update_body_color", {
      roomId: roomName,
      playerId: socket.id,
      color,
    });
  };

  useEffect(() => {
    if (serverPlayer1Color) setPlayer1Color(serverPlayer1Color);
    if (serverPlayer2Color) setPlayer2Color(serverPlayer2Color);
  }, [serverPlayer1Color, serverPlayer2Color, setPlayer1Color, setPlayer2Color]);

  useEffect(() => {
    setPlayer1BodyColor(serverPlayer1BodyColor);
    setPlayer2BodyColor(serverPlayer2BodyColor);
  }, [
    serverPlayer1BodyColor,
    serverPlayer2BodyColor,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  ]);

  const currentRoom = rooms.find((room) => room.id === roomName);
  const playerCount = currentRoom ? currentRoom.players.length : 0;
  const canShowReadyButton = isCPUMatch || playerCount > 1;

  useEffect(() => {
    socket.emit("lobby", { roomId: roomName });
    socket.on("lobby", (playerData) => {
      setPlayers(playerData);
    });

    socket.on("player_left", () => {
      setReady(false);
      setReadyCount(0);
    });

    socket.on("ready_count", (count) => {
      setReadyCount(count);
    });

    socket.on("initial_game_start", (payload) => {
      if (payload?.players && Array.isArray(payload.players) && setRooms) {
        const roomId = payload.roomId || roomName;
        if (payload.players[0]?.mawashiColor)
          setPlayer1Color(payload.players[0].mawashiColor);
        if (payload.players[1]?.mawashiColor)
          setPlayer2Color(payload.players[1].mawashiColor);
        setPlayer1BodyColor(payload.players[0]?.bodyColor || null);
        setPlayer2BodyColor(payload.players[1]?.bodyColor || null);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  players: r.players.map((rp, i) => ({
                    ...rp,
                    ...(payload.players[i] || {}),
                    mawashiColor:
                      payload.players[i]?.mawashiColor ?? rp.mawashiColor,
                    bodyColor: payload.players[i]?.bodyColor ?? rp.bodyColor,
                  })),
                }
              : r
          )
        );
      }
      socket.emit("game_reset", true);
      handleGame();
    });

    return () => {
      socket.off("lobby");
      socket.off("ready_count");
      socket.off("player_left");
      socket.off("initial_game_start");
    };
  }, [
    roomName,
    socket,
    handleGame,
    setRooms,
    setPlayer1Color,
    setPlayer2Color,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  ]);

  const handleLeaveDohyo = () => {
    playButtonPressSound();
    socket.emit("leave_room", { roomId: roomName });
    if (onLeaveDohyo) {
      onLeaveDohyo();
    } else {
      setCurrentPage("mainMenu");
    }
  };

  const handleReady = (e) => {
    const isReadyAction = e.currentTarget.dataset.action === "ready";
    setReady(isReadyAction);
    socket.emit("ready_count", {
      playerId: socket.id,
      isReady: isReadyAction,
      roomId: roomName,
    });
  };

  const renderFighter = (side) => {
    const isLeft = side === "left";
    const player = isLeft ? players[0] : players[1];
    const hasPlayer = !!player?.fighter;
    const showAsCPU = !isLeft && isCPUMatch;
    const showFighter = hasPlayer || showAsCPU;
    const playerColor = isLeft ? serverPlayer1Color : serverPlayer2Color;
    const playerBodyColor = isLeft
      ? serverPlayer1BodyColor
      : serverPlayer2BodyColor;

    const sideLabel = isLeft ? "East" : "West";
    const fighterName = showAsCPU
      ? "CPU"
      : player?.isCPU
        ? "CPU"
        : player?.fighter || "Open Slot";
    const showSkillStrip = showAsCPU;

    return (
      <FighterColumn $side={side}>
        <IdentityBlock>
          <SideLabel $hasFighter={showFighter}>{sideLabel}</SideLabel>
          <FighterName $hasFighter={showFighter}>{fighterName}</FighterName>
          <IdentityRule $hasFighter={showFighter} aria-hidden />
          {!showFighter && (
            <WaitingText>
              Waiting
              <LoadingDots>
                <Dot $delay={0} />
                <Dot $delay={1} />
                <Dot $delay={2} />
              </LoadingDots>
            </WaitingText>
          )}
          {showSkillStrip && (
            <SkillStrip>
              <SkillCaption>CPU Skill</SkillCaption>
              <SkillOptions>
                {CPU_DIFFICULTIES.map((id) => {
                  const selected = id === selectedDifficulty;
                  return (
                    <SkillOption
                      key={id}
                      $selected={selected}
                      onClick={() => {
                        if (id !== selectedDifficulty) {
                          playButtonPressSound2();
                          setSelectedDifficulty(id);
                          socket.emit("set_cpu_difficulty", { difficulty: id });
                        }
                      }}
                      onMouseEnter={playButtonHoverSound}
                    >
                      {id}
                    </SkillOption>
                  );
                })}
              </SkillOptions>
            </SkillStrip>
          )}
        </IdentityBlock>

        <FighterPortrait>
          {showFighter ? (
            <>
              <FloorShadow />
              <AvatarFrame $side={side}>
                <AvatarBreath>
                  <ColoredPlayerPreview
                    color={playerColor}
                    bodyColor={playerBodyColor}
                  />
                </AvatarBreath>
              </AvatarFrame>
            </>
          ) : (
            <WaitingState>
              <WaitingSilhouette $side={side} src={pumo} alt="" />
            </WaitingState>
          )}
        </FighterPortrait>
      </FighterColumn>
    );
  };

  const renderCustomizePlaque = () => {
    if (myPlayerIndex === -1) return null;

    const isBody = customizeTab === "body";
    const isPattern = !isBody && !!selectedBeltOption?.gradient;
    const selectedColorHex = isBody ? myBodyColor || "#888" : myMawashiColor;
    const selectedColorGradient = isBody
      ? selectedBodyOption?.gradient
      : selectedBeltOption?.gradient;
    const selectedColorName = isBody ? selectedBodyName : selectedBeltName;
    const selectedCategoryLabel = isBody
      ? "Body Color"
      : isPattern
        ? "Belt Pattern"
        : "Belt Color";

    const handleTabChange = (tab) => {
      if (tab !== customizeTab) {
        playButtonHoverSound();
        setCustomizeTab(tab);
      }
    };

    return (
      <CustomizePlaque>
        <TabGroup>
          <Tab $active={isBody} onClick={() => handleTabChange("body")}>
            Body
          </Tab>
          <Tab $active={!isBody} onClick={() => handleTabChange("belt")}>
            Belt
          </Tab>
        </TabGroup>

        <SwatchLane>
          <SwatchSection ref={swatchScrollRef} onScroll={measureSwatchScroll}>
            {isBody
              ? bodyColors.map((color, i) => {
                  const taken = isBodyColorTakenByOther(color.hex);
                  return (
                    <ColorSwatch
                      key={color.name}
                      $index={i}
                      $color={color.hex || "#888"}
                      $gradient={color.gradient}
                      $selected={myBodyColor === color.hex}
                      $taken={taken}
                      onClick={() => !taken && handleBodyColorSelect(color.hex)}
                      onMouseEnter={() => !taken && playButtonHoverSound()}
                      title={taken ? "Taken by opponent" : color.name}
                    />
                  );
                })
              : (
                <>
                  {beltSolids.map((color, i) => {
                    const taken = isColorTakenByOther(color.hex);
                    return (
                      <ColorSwatch
                        key={color.name}
                        $index={i}
                        $color={color.hex}
                        $selected={myMawashiColor === color.hex}
                        $taken={taken}
                        onClick={() => !taken && handleColorSelect(color.hex)}
                        onMouseEnter={() => !taken && playButtonHoverSound()}
                        title={taken ? "Taken by opponent" : color.name}
                      />
                    );
                  })}
                  <SwatchDivider />
                  {beltPatterns.map((color, i) => {
                    const taken = isColorTakenByOther(color.hex);
                    return (
                      <PatternSwatch
                        key={color.name}
                        $index={i + beltSolids.length}
                        $color={color.hex}
                        $gradient={color.gradient}
                        $selected={myMawashiColor === color.hex}
                        $taken={taken}
                        onClick={() => !taken && handleColorSelect(color.hex)}
                        onMouseEnter={() => !taken && playButtonHoverSound()}
                        title={taken ? "Taken by opponent" : color.name}
                      />
                    );
                  })}
                </>
              )}
          </SwatchSection>
          <ScrollArrow
            $dir="left"
            $visible={canScrollLeftSwatches}
            onClick={() => scrollSwatchesBy(-1)}
            aria-label="Scroll colors left"
            tabIndex={canScrollLeftSwatches ? 0 : -1}
          >
            <span aria-hidden>‹</span>
          </ScrollArrow>
          <ScrollArrow
            $dir="right"
            $visible={canScrollRightSwatches}
            onClick={() => scrollSwatchesBy(1)}
            aria-label="Scroll colors right"
            tabIndex={canScrollRightSwatches ? 0 : -1}
          >
            <span aria-hidden>›</span>
          </ScrollArrow>
        </SwatchLane>

        <SelectedBlock>
          <SelectedSwatchPreview
            $color={selectedColorHex}
            $gradient={selectedColorGradient}
          />
          <SelectedNameStack>
            <SelectedCategory>{selectedCategoryLabel}</SelectedCategory>
            <SelectedNameLabel>{selectedColorName}</SelectedNameLabel>
          </SelectedNameStack>
        </SelectedBlock>
      </CustomizePlaque>
    );
  };

  const matchModeLabel = isCPUMatch ? "VS CPU" : "CUSTOM";
  const slugSecondary = isCPUMatch ? "Practice Bout" : roomName;

  return (
    <LobbyContainer>
      <BackgroundImage />
      <FrostScrim />
      <CinematicOverlay />
      <GrainOverlay />
      <Snowfall intensity={12} showFrost={false} zIndex={3} />

      <LeaveButton
        onClick={handleLeaveDohyo}
        onMouseEnter={playButtonHoverSound}
      >
        <span className="arrow">&larr;</span>
        Leave
      </LeaveButton>

      <TopSlug>
        <SlugText $accent>
          <strong>{matchModeLabel}</strong>
          {!isCPUMatch && " MATCH"}
        </SlugText>
        <SlugRule aria-hidden />
        <SlugText>{slugSecondary}</SlugText>
      </TopSlug>

      <Stage>
        {renderFighter("left")}

        <VsColumn>
          <VsMark>
            <VsKanji>取組</VsKanji>
            <VsRule aria-hidden />
            <VsLetters>VS</VsLetters>
            <VsRule aria-hidden />
            <VsMetaPlate>
              <VsMode>{isCPUMatch ? "VS CPU" : "EXHIBITION"}</VsMode>
            </VsMetaPlate>
          </VsMark>
        </VsColumn>

        {renderFighter("right")}
      </Stage>

      <ControlDock>
        {renderCustomizePlaque() || <div />}

        {canShowReadyButton ? (
          <ActionCluster>
            {ready ? (
              <CancelButton
                data-action="cancel"
                onClick={(e) => {
                  handleReady(e);
                  playButtonPressSound();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                Cancel
              </CancelButton>
            ) : (
              <ReadyButton
                data-action="ready"
                onClick={(e) => {
                  handleReady(e);
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                Ready
              </ReadyButton>
            )}
            {!isCPUMatch && (
              <ReadyChip $ready={readyCount > 0}>
                <ReadyChipLabel>Ready</ReadyChipLabel>
                <ReadyChipCount $ready={readyCount > 0}>
                  {readyCount} / 2
                </ReadyChipCount>
              </ReadyChip>
            )}
          </ActionCluster>
        ) : (
          <div />
        )}
      </ControlDock>
    </LobbyContainer>
  );
};

Lobby.propTypes = {
  rooms: PropTypes.array.isRequired,
  setRooms: PropTypes.func,
  roomName: PropTypes.string.isRequired,
  handleGame: PropTypes.func.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  onLeaveDohyo: PropTypes.func,
  isCPUMatch: PropTypes.bool,
};

export default Lobby;
