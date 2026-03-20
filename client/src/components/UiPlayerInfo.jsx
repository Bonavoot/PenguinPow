import PropTypes from "prop-types";
import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";

// ============================================
// ANIMATIONS
// ============================================

const flashRedPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

const pulseWin = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.18); }
  100% { transform: scale(1); }
`;

/* Sweeping brass shine across the balance fill */
const iceShimmer = keyframes`
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
`;

/* Satin pearl sweep across the stamina fill */
const emberShimmer = keyframes`
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(250%); }
`;

/* Pulsing glow overlay during stamina regeneration */
const regenPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.85; }
`;

/* Bright green flash for parry stamina refund — punchy and unmissable */
const parryRefundFlash = keyframes`
  0% {
    opacity: 1;
    box-shadow: inset 0 0 20px rgba(74, 255, 160, 0.9), 0 0 16px rgba(74, 255, 160, 0.7);
  }
  30% {
    opacity: 0.9;
    box-shadow: inset 0 0 14px rgba(74, 255, 160, 0.6), 0 0 10px rgba(74, 255, 160, 0.4);
  }
  100% {
    opacity: 0;
    box-shadow: inset 0 0 0px rgba(74, 255, 160, 0), 0 0 0px rgba(74, 255, 160, 0);
  }
`;

/* Pulsing danger glow for the bar frame when stamina is critical */
const dangerFramePulse = keyframes`
  0%, 100% {
    box-shadow:
      inset 0 0 6px rgba(255, 40, 40, 0.05),
      0 0 4px rgba(255, 40, 40, 0.05),
      0 0 0 2px rgba(180, 130, 30, 0.6);
  }
  50% {
    box-shadow:
      inset 0 0 14px rgba(255, 40, 40, 0.25),
      0 0 16px rgba(255, 40, 40, 0.35),
      0 0 0 2px rgba(255, 60, 60, 0.7);
  }
`;

/* Gassed state — scrolling diagonal hazard stripes */
const gassedStripeScroll = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(22.63px); }
`;

/* Labored breathing pulse — slow, heavy */
const gassedBreathe = keyframes`
  0%, 100% { opacity: 0.92; }
  50% { opacity: 0.6; }
`;

/* Gassed text plate pulse — border brightens, tiny scale bump */
const gassedTextPulse = keyframes`
  0%, 100% {
    border-color: rgba(255, 40, 40, 0.5);
    transform: scale(1);
  }
  50% {
    border-color: rgba(255, 60, 60, 0.85);
    transform: scale(1.04);
  }
`;

/* Intense red frame pulse when fully gassed */
const gassedFramePulse = keyframes`
  0%, 100% {
    box-shadow:
      inset 0 0 10px rgba(255, 20, 20, 0.15),
      0 0 12px rgba(255, 20, 20, 0.35),
      0 0 24px rgba(255, 10, 10, 0.2),
      0 0 0 2px rgba(220, 30, 30, 0.8);
  }
  50% {
    box-shadow:
      inset 0 0 16px rgba(255, 20, 20, 0.4),
      0 0 28px rgba(255, 30, 30, 0.6),
      0 0 48px rgba(255, 10, 10, 0.3),
      0 0 0 2px rgba(255, 50, 50, 0.95);
  }
`;

/* Green-mint burst when recovering from gassed state — "second wind" */
const recoveryBurst = keyframes`
  0% {
    opacity: 1;
    box-shadow: inset 0 0 30px rgba(225, 255, 241, 0.96), 0 0 24px rgba(75, 231, 158, 0.84);
  }
  25% {
    opacity: 0.9;
    box-shadow: inset 0 0 20px rgba(225, 255, 241, 0.62), 0 0 16px rgba(75, 231, 158, 0.5);
  }
  100% {
    opacity: 0;
    box-shadow: inset 0 0 0px rgba(225, 255, 241, 0), 0 0 0px rgba(75, 231, 158, 0);
  }
`;

const recoveryTextPop = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  20% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.15);
  }
  35% {
    transform: translate(-50%, -50%) scale(0.95);
  }
  50% {
    transform: translate(-50%, -50%) scale(1);
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.05);
  }
`;

// ============================================
// MAIN HUD SHELL
// ============================================

const HudShell = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(7px, 1.2cqh, 12px) clamp(6px, 1cqw, 14px);
  padding-top: clamp(9px, 1.6cqh, 16px);
  opacity: ${(p) => (p.$matchOver ? 0.88 : 1)};
  filter: ${(p) =>
    p.$matchOver
      ? "saturate(0.84) brightness(0.86) contrast(0.97)"
      : "none"};
  transform: ${(p) => (p.$matchOver ? "translateY(2px)" : "none")};
  transition:
    opacity 260ms ease,
    filter 260ms ease,
    transform 260ms ease;

  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.88) 0%,
      rgba(0, 0, 0, 0.78) 20%,
      rgba(0, 0, 0, 0.5) 50%,
      rgba(0, 0, 0, 0.18) 78%,
      transparent 100%
    );

`;

// ============================================
// PLAYER WING  (one per side)
// ============================================

const PlayerWing = styled.div`
  flex: 0 1 48%;
  max-width: min(560px, 45%);
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 0.6cqh, 8px);
  transition: opacity 240ms ease, filter 240ms ease;
  opacity: ${(p) => (p.$matchOver ? 0.93 : 1)};
  filter: ${(p) => (p.$matchOver ? "brightness(0.94)" : "none")};
`;

// ============================================
// NAME BANNER  —  sumo shikona-style plate
// ============================================

const NameBanner = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  gap: clamp(4px, 0.5cqw, 8px);
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  background: none;
  min-height: clamp(18px, 2.2cqh, 26px);
  box-sizing: border-box;
  padding: 0;
  position: relative;
  margin-bottom: clamp(2px, 0.4cqh, 6px);
`;

const NameBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: ${(p) => (p.$isRight ? "flex-end" : "flex-start")};
  min-width: 0;
  flex: 1;
`;

const FighterName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(11px, 1.55cqw, 19px);
  color: #ffffff;
  text-shadow:
    clamp(2px, 0.16cqw, 4px) clamp(2px, 0.16cqw, 4px) 0 #000,
    clamp(-2px, -0.16cqw, -1px) clamp(-2px, -0.16cqw, -1px) 0 #000,
    clamp(2px, 0.16cqw, 4px) clamp(-2px, -0.16cqw, -1px) 0 #000,
    clamp(-2px, -0.16cqw, -1px) clamp(2px, 0.16cqw, 4px) 0 #000,
    0 0 clamp(12px, 1.4cqw, 24px) rgba(0, 0, 0, 0.8),
    0 0 clamp(4px, 0.4cqw, 8px) rgba(0, 0, 0, 1),
    0 0 6px rgba(255, 255, 255, 0.25),
    0 0 3px rgba(255, 255, 255, 0.15);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ============================================
// RANK PLAQUE — sumo banzuke-style ranking plate
// ============================================

/* Sits below the stamina bar — symmetrical sumo banzuke plate */
const RankPlaque = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.5cqw, 8px);
  padding: clamp(4px, 0.55cqh, 8px) clamp(12px, 1.5cqw, 22px);
  position: relative;

  /* Dark lacquered plaque with subtle grain */
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px, transparent 3px,
      rgba(212, 175, 55, 0.015) 3px, rgba(212, 175, 55, 0.015) 4px
    ),
    linear-gradient(
      180deg,
      rgba(14, 18, 36, 0.92) 0%,
      rgba(10, 14, 28, 0.95) 50%,
      rgba(8, 10, 22, 0.92) 100%
    );
  border-radius: 3px;
  border: 1.5px solid rgba(180, 130, 30, 0.35);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 200, 100, 0.06),
    inset 0 -1px 3px rgba(0, 0, 0, 0.3);

  /* Gold ornamental bracket — LEFT side */
  &::before {
    content: "";
    position: absolute;
    top: 3px; bottom: 3px;
    left: -1px;
    width: 3px;
    background: linear-gradient(
      180deg,
      rgba(180, 130, 30, 0.2) 0%,
      #d4af37 20%,
      #ffd700 50%,
      #d4af37 80%,
      rgba(180, 130, 30, 0.2) 100%
    );
    border-radius: 2px;
  }

  /* Gold ornamental bracket — RIGHT side */
  &::after {
    content: "";
    position: absolute;
    top: 3px; bottom: 3px;
    right: -1px;
    width: 3px;
    background: linear-gradient(
      180deg,
      rgba(180, 130, 30, 0.2) 0%,
      #d4af37 20%,
      #ffd700 50%,
      #d4af37 80%,
      rgba(180, 130, 30, 0.2) 100%
    );
    border-radius: 2px;
  }
`;

const RankText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(10px, 1.4cqw, 17px);
  color: #ffd700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 1;
  text-shadow:
    0 0 10px rgba(255, 215, 0, 0.4),
    0 0 4px rgba(212, 175, 55, 0.5),
    0 1px 3px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
`;

// ============================================
// STAMINA BAR  — THE HERO OF THE HUD
// ============================================

/* Ornamental outer frame — gold ring with danger state */
const BarFrame = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 4px;

  /* Multi-ring gold frame — same thickness as banner bottom border */
  border: clamp(2px, 0.16cqw, 4px) solid transparent;
  box-shadow:
    /* Gold outer ring */
    0 0 0 clamp(2px, 0.16cqw, 4px) rgba(180, 130, 30, 0.6),
    /* Dark outer gap */
    0 0 0 clamp(4px, 0.32cqw, 8px) rgba(0, 0, 0, 0.5),
    /* Depth shadow */
    0 clamp(3px, 0.24cqw, 6px) clamp(12px, 1cqw, 24px) rgba(0, 0, 0, 0.5);
  opacity: ${(p) => (p.$matchOver ? 0.95 : 1)};
  filter: ${(p) => (p.$matchOver ? "brightness(0.97)" : "none")};
  transition: opacity 220ms ease, filter 220ms ease;

  /* Danger mode: pulsing crimson frame */
  ${(p) =>
    p.$gassed
      ? css`
          animation: ${gassedFramePulse} ${p.$matchOver ? "1.9s" : "1.2s"} ease-in-out infinite;
        `
      : p.$danger &&
        css`
          animation: ${dangerFramePulse} ${p.$matchOver ? "1.15s" : "0.7s"} ease-in-out infinite;
        `}
`;

/* Dark inner track — unified height for dual-gauge layout */
const BarTrack = styled.div`
  position: relative;
  width: 100%;
  height: clamp(16px, 3.2cqh, 32px);
  border-radius: 3px;
  overflow: hidden;

  background:
    linear-gradient(
      ${(p) => (p.$isRight ? "280deg" : "100deg")},
      rgba(2, 2, 2, 0.97) 0%,
      rgba(6, 6, 6, 0.95) 50%,
      rgba(10, 10, 10, 0.92) 100%
    );
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.6),
    inset 0 -1px 3px rgba(0, 0, 0, 0.25);
`;

/* Stamina gauge line — sits behind the fill so it only shows in drained areas */
const StaTickMark = styled.div`
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: ${(p) => p.$pct}%;
  transform: translateX(-50%);
  width: 1px;
  z-index: 1;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: -1px 0 0 rgba(255, 255, 255, 0.05), 1px 0 0 rgba(255, 255, 255, 0.05);
`;

/* Mint-lime frost stamina fill — playful arcade energy */
const BarFill = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  transition: width 0.3s ease;
  z-index: 2;
  overflow: hidden;

  background: ${(p) =>
    p.$danger
      ? p.$isRight
        ? "linear-gradient(90deg, #dc2626 0%, #ef4444 40%, #f87171 80%, #fca5a5 100%)"
        : "linear-gradient(90deg, #fca5a5 0%, #f87171 20%, #ef4444 60%, #dc2626 100%)"
      : p.$isRight
        ? "linear-gradient(90deg, #14663d 0%, #1c9b52 14%, #46d46a 34%, #95f07a 56%, #caffae 78%, #f0ffe4 100%)"
        : "linear-gradient(90deg, #f0ffe4 0%, #caffae 18%, #95f07a 40%, #46d46a 64%, #1c9b52 84%, #14663d 100%)"};

  box-shadow: ${(p) =>
    p.$danger
      ? "0 0 14px rgba(239, 68, 68, 0.6), inset 0 0 4px rgba(255, 100, 100, 0.2)"
      : "0 0 14px rgba(149, 240, 122, 0.34), 0 0 6px rgba(202, 255, 174, 0.24), inset 0 0 6px rgba(240, 255, 228, 0.18)"};

  animation: ${(p) =>
    p.$danger
      ? css`${flashRedPulse} 0.6s ease-in-out infinite`
      : "none"};

  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 40%;
    background: linear-gradient(
      180deg,
      rgba(249, 255, 241, 0.42) 0%,
      rgba(236, 255, 214, 0.14) 52%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  /* Frost-glass sweep (only when not danger) */
  &::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    width: 34%;
    background: linear-gradient(
      103deg,
      transparent 0%,
      transparent 28%,
      rgba(238, 255, 219, 0.12) 40%,
      rgba(252, 255, 243, 0.3) 50%,
      rgba(219, 255, 184, 0.16) 58%,
      transparent 70%,
      transparent 100%
    );
    animation: ${emberShimmer} 3.6s ease-in-out infinite;
    animation-delay: ${(p) => (p.$isRight ? "2s" : "0s")};
    pointer-events: none;
    opacity: ${(p) => (p.$danger ? 0 : 1)};
  }
`;

/* Ghost bar — smoked white glass trailing indicator */
const BarGhost = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
    transition: p.$catching
      ? "width 0.55s ease-out"
      : "width 0.05s linear",
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  z-index: 1;
  pointer-events: none;

  background:
    radial-gradient(
      120% 95% at 50% 12%,
      rgba(255, 255, 255, 0.75) 0%,
      rgba(255, 255, 255, 0.22) 38%,
      rgba(255, 255, 255, 0) 68%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.92) 0%,
      rgba(248, 251, 255, 0.8) 16%,
      rgba(225, 233, 245, 0.62) 42%,
      rgba(180, 192, 214, 0.42) 72%,
      rgba(104, 115, 136, 0.32) 100%
    );

  opacity: 0.88;
  box-shadow:
    0 0 12px rgba(255, 255, 255, 0.18),
    0 0 4px rgba(184, 205, 238, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    inset 0 -2px 6px rgba(38, 46, 60, 0.35);

  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 38%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.58) 0%,
      rgba(255, 255, 255, 0.2) 48%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 8%;
    width: 42%;
    background: linear-gradient(
      100deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.1) 32%,
      rgba(255, 255, 255, 0.26) 48%,
      rgba(255, 255, 255, 0.08) 62%,
      rgba(255, 255, 255, 0) 100%
    );
    opacity: 0.9;
    pointer-events: none;
  }
`;

/* Full-bar green overlay that pulses when stamina is regenerating */
const RegenGlow = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  z-index: 3;
  pointer-events: none;
  transition: width 0.3s ease;

  /* Green gradient — stronger toward the leading (growing) edge */
  background: linear-gradient(
    ${(p) => (p.$isRight ? "270deg" : "90deg")},
    rgba(52, 211, 153, 0.06) 0%,
    rgba(52, 211, 153, 0.18) 40%,
    rgba(52, 211, 153, 0.35) 75%,
    rgba(74, 222, 170, 0.5) 100%
  );

  box-shadow:
    inset 0 0 10px rgba(52, 211, 153, 0.25),
    inset ${(p) => (p.$isRight ? "-6px" : "6px")} 0 14px rgba(52, 211, 153, 0.3);

  animation: ${regenPulse} 0.8s ease-in-out infinite;
`;

/* Instant bright green flash overlay for parry stamina refund — sized to current fill */
const ParryRefundFlash = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  z-index: 6;
  pointer-events: none;
  transition: width 0.3s ease;
  background: linear-gradient(
    180deg,
    rgba(74, 255, 160, 0.5) 0%,
    rgba(52, 211, 153, 0.7) 40%,
    rgba(16, 185, 129, 0.7) 60%,
    rgba(52, 211, 153, 0.5) 100%
  );
  animation: ${parryRefundFlash} 0.5s ease-out forwards;
`;

/* Gassed overlay — hazard stripes with breathing pulse */
const GassedOverlay = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 3px;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;
  animation: ${gassedBreathe} ${(p) => (p.$matchOver ? "1.9s" : "1.2s")} ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p) => (p.$matchOver ? 0.88 : 1)};
  transition: opacity 220ms ease;

  &::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    right: -50%;
    bottom: -50%;
    background: repeating-linear-gradient(
      -45deg,
      rgba(180, 20, 20, 0.8) 0px,
      rgba(180, 20, 20, 0.8) 8px,
      rgba(40, 5, 5, 0.85) 8px,
      rgba(40, 5, 5, 0.85) 16px
    );
    animation: ${gassedStripeScroll} ${(p) => (p.$matchOver ? "1.2s" : "0.8s")} linear infinite;
  }
`;

const GassedText = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(9px, 1.3cqh, 16px);
  color: #fff;
  text-shadow:
    0 0 6px rgba(255, 40, 40, 0.7),
    0 0 12px rgba(255, 20, 20, 0.4);
  letter-spacing: 0.3em;
  position: relative;
  z-index: 1;
  background: rgba(0, 0, 0, 0.82);
  padding: clamp(2px, 0.3cqh, 4px) clamp(8px, 1.2cqw, 18px);
  border: 1.5px solid rgba(255, 40, 40, 0.5);
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.6);
  animation: ${gassedTextPulse} 1.2s ease-in-out infinite;
`;

/* Gassed recovery burst — bright green-mint flash when "second wind" kicks in */
const RecoveryFlash = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 3px;
  z-index: 7;
  pointer-events: none;
  background: linear-gradient(180deg,
    rgba(225, 255, 241, 0.58) 0%,
    rgba(151, 245, 201, 0.8) 30%,
    rgba(75, 231, 158, 0.84) 60%,
    rgba(25, 201, 119, 0.62) 100%);
  animation: ${recoveryBurst} 0.7s ease-out forwards;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    width: 60%;
    background: linear-gradient(
      100deg,
      transparent 0%,
      transparent 30%,
      rgba(255, 255, 255, 0.35) 45%,
      rgba(255, 255, 255, 0.55) 50%,
      rgba(255, 255, 255, 0.35) 55%,
      transparent 70%,
      transparent 100%
    );
    animation: ${iceShimmer} 0.6s ease-out forwards;
  }
`;

const RecoveryText = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 1cqh, 13px);
  color: #e6fff2;
  text-shadow:
    0 0 10px rgba(151, 245, 201, 0.9),
    0 0 20px rgba(25, 201, 119, 0.62),
    -1px -1px 0 #000, 1px -1px 0 #000,
    -1px 1px 0 #000, 1px 1px 0 #000;
  letter-spacing: 0.15em;
  white-space: nowrap;
  z-index: 8;
  pointer-events: none;
  animation: ${recoveryTextPop} 0.8s ease-out forwards;
`;

/* Thin gold divider between the two gauge rows */
const GaugeDivider = styled.div`
  height: 1px;
  margin: 3px 0 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(212, 175, 55, 0.15) 15%,
    rgba(212, 175, 55, 0.25) 50%,
    rgba(212, 175, 55, 0.15) 85%,
    transparent 100%
  );
  pointer-events: none;
`;

/* STA label inside the bar */
const BarLabel = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) => (p.$isRight ? "left: clamp(6px, 1cqw, 14px);" : "right: clamp(6px, 1cqw, 14px);")}
  font-family: "Bungee", cursive;
  font-size: clamp(8px, 0.95cqw, 12px);
  color: rgba(255, 255, 255, 0.82);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow:
    1px 1px 3px rgba(0, 0, 0, 1),
    0 0 8px rgba(0, 0, 0, 0.8),
    0 0 2px rgba(0, 0, 0, 1);
  z-index: 6;
  pointer-events: none;
  user-select: none;
`;

// ============================================
// POWER-UP — medal / charm style
// ============================================

const SLOT_SIZE = `clamp(34px, 4.5cqw, 54px)`;

/* Invisible spacer to align rank plaque & name with stamina bar (same width as PowerUpSlot) */
const BarRowSpacer = styled.div`
  width: ${SLOT_SIZE};
  flex-shrink: 0;
  min-height: 0;
`;

// ============================================
// BALANCE BAR — thinner bar below stamina
// ============================================

const BalanceBarTrack = styled.div`
  position: relative;
  width: 100%;
  height: clamp(16px, 3.2cqh, 32px);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 3px;
  background:
    linear-gradient(
      ${(p) => (p.$isRight ? "280deg" : "100deg")},
      rgba(2, 2, 2, 0.97) 0%,
      rgba(6, 6, 6, 0.95) 50%,
      rgba(10, 10, 10, 0.92) 100%
    );
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.6),
    inset 0 -1px 3px rgba(0, 0, 0, 0.25);
`;

/* Butter-gold balance fill — lacquered footing gauge */
const BalanceBarFill = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$balance}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  transition: width 0.25s ease;
  z-index: 2;
  overflow: hidden;

  background: ${(p) =>
    p.$danger
      ? p.$isRight
        ? "linear-gradient(90deg, #dc2626 0%, #ef4444 40%, #f87171 80%, #fca5a5 100%)"
        : "linear-gradient(90deg, #fca5a5 0%, #f87171 20%, #ef4444 60%, #dc2626 100%)"
      : p.$isRight
        ? "linear-gradient(90deg, #8c7300 0%, #b89a08 14%, #e0c52a 34%, #f7e164 56%, #fff2a8 80%, #fffce0 100%)"
        : "linear-gradient(90deg, #fffce0 0%, #fff2a8 18%, #f7e164 40%, #e0c52a 64%, #b89a08 84%, #8c7300 100%)"};

  box-shadow: ${(p) =>
    p.$danger
      ? "0 0 10px rgba(239, 68, 68, 0.5), inset 0 0 3px rgba(255, 100, 100, 0.15)"
      : "0 0 10px rgba(247, 225, 100, 0.24), 0 0 4px rgba(255, 252, 192, 0.16), inset 0 0 5px rgba(255, 252, 224, 0.16)"};

  animation: ${(p) =>
    p.$danger
      ? css`${flashRedPulse} 0.8s ease-in-out infinite`
      : "none"};

  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 40%;
    background: linear-gradient(
      180deg,
      rgba(255, 253, 231, 0.42) 0%,
      rgba(255, 244, 170, 0.12) 48%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  /* Lacquered glint (only when not danger) */
  &::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    width: 26%;
    background: linear-gradient(
      96deg,
      transparent 0%,
      transparent 32%,
      rgba(255, 246, 175, 0.08) 44%,
      rgba(255, 255, 240, 0.22) 50%,
      rgba(255, 238, 150, 0.1) 56%,
      transparent 68%,
      transparent 100%
    );
    animation: ${iceShimmer} 4.8s ease-in-out infinite;
    animation-delay: ${(p) => (p.$isRight ? "1.8s" : "0s")};
    pointer-events: none;
    opacity: ${(p) => (p.$danger ? 0 : 1)};
  }
`;

/* Balance ghost bar — smoked white glass trailing indicator */
const BalanceBarGhost = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$balance}% - 4px)`,
    transition: p.$catching
      ? "width 0.55s ease-out"
      : "width 0.05s linear",
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  z-index: 1;
  pointer-events: none;

  background:
    radial-gradient(
      120% 95% at 50% 12%,
      rgba(255, 255, 255, 0.75) 0%,
      rgba(255, 255, 255, 0.22) 38%,
      rgba(255, 255, 255, 0) 68%
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.92) 0%,
      rgba(248, 251, 255, 0.8) 16%,
      rgba(225, 233, 245, 0.62) 42%,
      rgba(180, 192, 214, 0.42) 72%,
      rgba(104, 115, 136, 0.32) 100%
    );

  opacity: 0.88;
  box-shadow:
    0 0 12px rgba(255, 255, 255, 0.18),
    0 0 4px rgba(184, 205, 238, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    inset 0 -2px 6px rgba(38, 46, 60, 0.35);

  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 38%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.58) 0%,
      rgba(255, 255, 255, 0.2) 48%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 8%;
    width: 42%;
    background: linear-gradient(
      100deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.1) 32%,
      rgba(255, 255, 255, 0.26) 48%,
      rgba(255, 255, 255, 0.08) 62%,
      rgba(255, 255, 255, 0) 100%
    );
    opacity: 0.9;
    pointer-events: none;
  }
`;

const BalanceBarLabel = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) => (p.$isRight ? "left: clamp(6px, 1cqw, 14px);" : "right: clamp(6px, 1cqw, 14px);")}
  font-family: "Bungee", cursive;
  font-size: clamp(8px, 0.95cqw, 12px);
  color: rgba(255, 255, 255, 0.82);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow:
    1px 1px 3px rgba(0, 0, 0, 1),
    0 0 8px rgba(0, 0, 0, 0.8),
    0 0 2px rgba(0, 0, 0, 1);
  z-index: 6;
  pointer-events: none;
  user-select: none;
`;

/* Balance 50% throw-zone line — behind fill, visible only in drained area */
const BalThrowMark = styled.div`
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  z-index: 1;
  pointer-events: none;
  background: rgba(255, 236, 184, 0.18);
  box-shadow: -1px 0 0 rgba(255, 236, 184, 0.06), 1px 0 0 rgba(255, 236, 184, 0.06);
`;

/* Balance 15% kill-zone line — behind fill, red-tinted for danger */
const BalKillMark = styled.div`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 15%;" : "right: 15%;")}
  transform: translateX(${(p) => (p.$isRight ? "-50%" : "50%")});
  width: 1.5px;
  z-index: 1;
  pointer-events: none;
  background: rgba(255, 100, 80, 0.25);
  box-shadow: -1px 0 0 rgba(255, 80, 60, 0.08), 1px 0 0 rgba(255, 80, 60, 0.08);
`;

/* Stack below the dual gauge — rank plaque aligned with bar left/right */
const SubBarRow = styled.div`
  display: flex;
  flex-direction: ${(p) => (p.$isRight ? "row-reverse" : "row")};
  align-items: center;
  gap: clamp(4px, 0.5cqw, 8px);
  margin-top: clamp(3px, 0.5cqh, 6px);
  width: 100%;
`;

/* Row that holds the stamina bar + power-up icon side-by-side */
const BarRow = styled.div`
  display: flex;
  align-items: center;
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  gap: clamp(4px, 0.5cqw, 8px);
  width: 100%;
`;

/* Power-up panel — square, gold ring frame matching bars */
const PowerUpSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${SLOT_SIZE};
  align-self: stretch;
  border-radius: 4px;
  box-sizing: border-box;
  position: relative;
  transition: all 0.25s ease;
  flex-shrink: 0;

  border: clamp(2px, 0.16cqw, 4px) solid transparent;

  background: ${(p) => {
    if (!p.$active)
      return "linear-gradient(145deg, rgba(2, 2, 2, 0.97), rgba(6, 6, 6, 0.95), rgba(10, 10, 10, 0.92))";
    if (p.$cooldown)
      return "linear-gradient(135deg, #4a5568, #2d3748)";
    switch (p.$active) {
      case "speed":
        return "linear-gradient(135deg, #00d2ff, #0066cc)";
      case "power":
        return "linear-gradient(135deg, var(--edo-sakura, #ff8fa3), #dc2626)";
      case "snowball":
        return "linear-gradient(135deg, #e0f6ff, #87ceeb)";
      case "pumo_army":
        return "linear-gradient(135deg, #ffcc80, #ff8c00)";
      case "thick_blubber":
        return "linear-gradient(135deg, #9c88ff, #7c4dff)";
      default:
        return "linear-gradient(135deg, #6c757d, #343a40)";
    }
  }};

  box-shadow:
    0 0 0 clamp(2px, 0.16cqw, 4px) rgba(180, 130, 30, 0.6),
    0 0 0 clamp(4px, 0.32cqw, 8px) rgba(0, 0, 0, 0.5),
    0 clamp(3px, 0.24cqw, 6px) clamp(12px, 1cqw, 24px) rgba(0, 0, 0, 0.5),
    inset 0 2px 6px rgba(0, 0, 0, 0.6),
    inset 0 -1px 3px rgba(0, 0, 0, 0.25);

  opacity: ${(p) => (p.$active ? 1 : 0.7)};

  img {
    width: 76%;
    height: 76%;
    object-fit: contain;
    filter: ${(p) => (p.$cooldown ? "brightness(0.5) grayscale(0.35)" : "brightness(1)")};
  }
`;

const SnowballCountBadge = styled.div`
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: clamp(13px, 1.5cqw, 18px);
  height: clamp(13px, 1.5cqw, 18px);
  padding: 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 0.8cqw, 10px);
  line-height: 1;
  color: #fff;
  background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
  border: 1px solid rgba(168, 212, 255, 0.7);
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  z-index: 2;
  pointer-events: none;
`;

// ============================================
// CENTER ROUND INDICATOR — bare floating text
// ============================================

const CenterRound = styled.div`
  position: absolute;
  top: clamp(24px, 4cqh, 46px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  opacity: ${(p) => (p.$matchOver ? 0.7 : 1)};
  transition: opacity 260ms ease;
`;

// ============================================
// WIN/LOSS ROW — stones above player bars
// ============================================

const WinLossRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: clamp(3px, 0.4cqw, 6px);
  justify-content: ${(p) => (p.$isRight ? "flex-start" : "flex-end")};
`;

/* Traditional go-stones: white = win, black = loss */
const GoStone = styled.div`
  width: clamp(9px, 1.3cqw, 17px);
  height: clamp(9px, 1.3cqw, 17px);
  border-radius: 50%;
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease;

  background: ${(p) => {
    if (p.$isEmpty)
      return "linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02))";
    return p.$isWin
      ? "radial-gradient(55% 55% at 32% 32%, #fff 0%, #f0f0f0 55%, #d8d8d8 100%)"
      : "radial-gradient(55% 55% at 32% 32%, #555 0%, #1a1a1a 55%, #050505 100%)";
  }};

  border: ${(p) => {
    if (p.$isEmpty) return "clamp(1.5px, 0.12cqw, 2.5px) solid rgba(255, 255, 255, 0.35)";
    return p.$isWin
      ? "clamp(2px, 0.16cqw, 4px) solid rgba(255, 255, 255, 0.9)"
      : "clamp(2px, 0.16cqw, 4px) solid rgba(255, 255, 255, 0.5)";
  }};

  box-shadow: ${(p) => {
    if (p.$isEmpty) return "inset 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 4px rgba(255, 255, 255, 0.08)";
    return p.$isWin
      ? "0 0 8px rgba(255, 255, 255, 0.65), 0 0 3px rgba(212, 175, 55, 0.35), inset 0 -1px 2px rgba(0, 0, 0, 0.15)"
      : "0 0 5px rgba(139, 105, 20, 0.35), 0 0 2px rgba(212, 175, 55, 0.2), inset 0 1px 3px rgba(60, 60, 60, 0.45)";
  }};

  animation: ${(p) =>
    p.$isWin && !p.$isEmpty ? pulseWin : "none"} 2s infinite;
`;

const RoundNum = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(28px, 5cqw, 72px);
  color: #fff;
  -webkit-text-stroke: clamp(1.5px, 0.2cqw, 3px) rgba(0, 0, 0, 0.9);
  text-shadow:
    0 0 24px rgba(255, 215, 0, 0.5),
    0 0 8px rgba(255, 215, 0, 0.6),
    0 0 48px rgba(255, 200, 60, 0.2),
    0 3px 8px rgba(0, 0, 0, 0.95);
  line-height: 1;
  user-select: none;
`;

const RoundText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 0.9cqw, 13px);
  color: rgba(255, 215, 0, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.25em;
  text-shadow:
    0 0 6px rgba(255, 215, 0, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.95);
  margin-top: clamp(1px, 0.2cqh, 3px);
`;

// ============================================
// CONSTANTS
// ============================================

const LOW_STAMINA_WARNING_THRESHOLD = 25;

const clampStamina = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const clampBalance = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, n));
};

// ============================================
// COMPONENT
// ============================================

const UiPlayerInfo = ({
  roundHistory = [],
  roundId = 0,
  player1Stamina,
  player1ActivePowerUp = null,
  player1SnowballCooldown = false,
  player1SnowballThrowsRemaining = null,
  player1PumoArmyCooldown = false,
  player1IsGassed = false,
  player1ParryRefund = 0,
  player1Balance = 100,
  player2Stamina,
  player2ActivePowerUp = null,
  player2SnowballCooldown = false,
  player2SnowballThrowsRemaining = null,
  player2PumoArmyCooldown = false,
  player2IsGassed = false,
  player2ParryRefund = 0,
  player2Balance = 100,
  matchOver = false,
}) => {
  const s1 = clampStamina(player1Stamina);
  const s2 = clampStamina(player2Stamina);
  const b1 = clampBalance(player1Balance);
  const b2 = clampBalance(player2Balance);
  const BALANCE_DANGER_THRESHOLD = 15;
  const b1Danger = b1 < BALANCE_DANGER_THRESHOLD;
  const b2Danger = b2 < BALANCE_DANGER_THRESHOLD;

  // ── Display stamina (throttled regen for smooth bar animation) ──
  const [p1DisplayStamina, setP1DisplayStamina] = useState(s1);
  const [p2DisplayStamina, setP2DisplayStamina] = useState(s2);
  const [p1LastDecreaseAt, setP1LastDecreaseAt] = useState(0);
  const [p2LastDecreaseAt, setP2LastDecreaseAt] = useState(0);
  const MAX_INCREASE_PER_UPDATE = 15;

  // ── Ghost bar — trailing damage indicator ("white health" system) ──
  const [p1Ghost, setP1Ghost] = useState(s1);
  const [p2Ghost, setP2Ghost] = useState(s2);
  const [p1GhostCatching, setP1GhostCatching] = useState(false);
  const [p2GhostCatching, setP2GhostCatching] = useState(false);
  const p1GhostTimer = useRef(null);
  const p2GhostTimer = useRef(null);
  const p1PrevStamina = useRef(s1);
  const p2PrevStamina = useRef(s2);
  const p1LastDecreaseAtRef = useRef(0);
  const p2LastDecreaseAtRef = useRef(0);

  // ── Balance ghost bar — trailing indicator for balance changes ──
  const [p1BalGhost, setP1BalGhost] = useState(b1);
  const [p2BalGhost, setP2BalGhost] = useState(b2);
  const [p1BalGhostCatching, setP1BalGhostCatching] = useState(false);
  const [p2BalGhostCatching, setP2BalGhostCatching] = useState(false);
  const p1BalGhostTimer = useRef(null);
  const p2BalGhostTimer = useRef(null);
  const p1PrevBalance = useRef(b1);
  const p2PrevBalance = useRef(b2);
  const p1BalLastDecreaseAtRef = useRef(0);
  const p2BalLastDecreaseAtRef = useRef(0);

  // ── Regen indicator (green leading-edge glow) ──
  const [p1Regen, setP1Regen] = useState(false);
  const [p2Regen, setP2Regen] = useState(false);
  const p1RegenTimer = useRef(null);
  const p2RegenTimer = useRef(null);

  // ── Parry refund flash (instant green burst) ──
  const [p1ParryFlash, setP1ParryFlash] = useState(0);
  const [p2ParryFlash, setP2ParryFlash] = useState(0);
  const p1ParryRefundPending = useRef(false);
  const p2ParryRefundPending = useRef(false);

  // ── Gassed recovery ("second wind") ──
  const [p1Recovery, setP1Recovery] = useState(0);
  const [p2Recovery, setP2Recovery] = useState(0);
  const p1WasGassed = useRef(false);
  const p2WasGassed = useRef(false);
  const p1RecoveryPending = useRef(false);
  const p2RecoveryPending = useRef(false);

  useEffect(() => {
    if (player1ParryRefund > 0) {
      setP1ParryFlash(player1ParryRefund);
      p1ParryRefundPending.current = true;
    }
  }, [player1ParryRefund]);

  useEffect(() => {
    if (player2ParryRefund > 0) {
      setP2ParryFlash(player2ParryRefund);
      p2ParryRefundPending.current = true;
    }
  }, [player2ParryRefund]);

  // ── Post-reset throttle bypass ──
  // After a round reset, the first stamina update from the server may arrive
  // AFTER game_reset (race condition). This flag lets that first update snap
  // to the new value instead of being throttled by MAX_INCREASE_PER_UPDATE.
  const p1JustReset = useRef(false);
  const p2JustReset = useRef(false);

  // ── Round reset ──
  useEffect(() => {
    setP1DisplayStamina(s1);
    setP2DisplayStamina(s2);
    setP1Ghost(s1);
    setP2Ghost(s2);
    setP1GhostCatching(false);
    setP2GhostCatching(false);
    setP1Regen(false);
    setP2Regen(false);
    setP1LastDecreaseAt(0);
    setP2LastDecreaseAt(0);
    p1PrevStamina.current = s1;
    p2PrevStamina.current = s2;
    p1JustReset.current = true;
    p2JustReset.current = true;
    if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
    if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
    if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
    if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
    p1LastDecreaseAtRef.current = 0;
    p2LastDecreaseAtRef.current = 0;
    p1WasGassed.current = false;
    p2WasGassed.current = false;
    p1RecoveryPending.current = false;
    p2RecoveryPending.current = false;
    setP1Recovery(0);
    setP2Recovery(0);
    setP1BalGhost(b1);
    setP2BalGhost(b2);
    setP1BalGhostCatching(false);
    setP2BalGhostCatching(false);
    if (p1BalGhostTimer.current) clearTimeout(p1BalGhostTimer.current);
    if (p2BalGhostTimer.current) clearTimeout(p2BalGhostTimer.current);
    p1PrevBalance.current = b1;
    p2PrevBalance.current = b2;
    p1BalLastDecreaseAtRef.current = 0;
    p2BalLastDecreaseAtRef.current = 0;
  }, [roundId]);

  // ── Gassed → recovered transition detection ──
  useEffect(() => {
    if (!p1WasGassed.current && player1IsGassed) {
      setP1Ghost(0);
      setP1GhostCatching(false);
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
    }
    if (p1WasGassed.current && !player1IsGassed) {
      p1RecoveryPending.current = true;
      setP1Recovery((c) => c + 1);
    }
    p1WasGassed.current = player1IsGassed;
  }, [player1IsGassed]);

  useEffect(() => {
    if (!p2WasGassed.current && player2IsGassed) {
      setP2Ghost(0);
      setP2GhostCatching(false);
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
    }
    if (p2WasGassed.current && !player2IsGassed) {
      p2RecoveryPending.current = true;
      setP2Recovery((c) => c + 1);
    }
    p2WasGassed.current = player2IsGassed;
  }, [player2IsGassed]);

  // ── Player 1 stamina + ghost + regen ──
  useEffect(() => {
    const prev = p1PrevStamina.current;
    p1PrevStamina.current = s1;
    let next = s1;

    // After a round reset, snap immediately to the server value (bypass throttle)
    // BUT only if stamina didn't decrease — if it dropped, fall through to damage
    // logic so the ghost bar correctly trails the first hit
    if (p1JustReset.current) {
      p1JustReset.current = false;
      if (s1 >= prev) {
        setP1DisplayStamina(s1);
        setP1Ghost(s1);
        return;
      }
    }

    if (s1 < prev) {
      // ▼ DAMAGE — stamina decreased
      const now = Date.now();
      setP1LastDecreaseAt(now);
      p1LastDecreaseAtRef.current = now;
      // Ghost stays high (captures "where stamina was" before this drain sequence)
      setP1Ghost((g) => Math.max(g, p1DisplayStamina));
      setP1GhostCatching(false);
      // Schedule ghost catch-up after a visible delay
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
      const closureS1 = s1;
      const scheduleGhostCatchUp = (delay = 700) => {
        p1GhostTimer.current = setTimeout(() => {
          // During continuous drain (e.g. grab push), don't catch up mid-sequence — reschedule
          const elapsed = Date.now() - p1LastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP1GhostCatching(true);
          setP1Ghost(closureS1);
        }, delay);
      };
      scheduleGhostCatchUp(700);
      // Clear regen state
      setP1Regen(false);
      if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
    } else if (s1 > prev) {
      // ▲ REGEN — stamina increased
      // Ghost catches up so it doesn't show false damage ahead of the fill
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
      setP1GhostCatching(false);
      setP1Ghost(Math.min(s1, p1DisplayStamina));
      // Show regen glow (stays on for 500ms after last regen tick)
      setP1Regen(true);
      if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
      p1RegenTimer.current = setTimeout(() => setP1Regen(false), 500);
    }

    // Parry refund bypass: snap instantly, skip all throttling
    if (p1ParryRefundPending.current && s1 > prev) {
      p1ParryRefundPending.current = false;
      setP1DisplayStamina(s1);
      setP1Ghost(s1);
      return;
    }

    // Gassed recovery bypass: snap to new stamina when "second wind" kicks in
    if (p1RecoveryPending.current && s1 > prev) {
      p1RecoveryPending.current = false;
      setP1DisplayStamina(s1);
      setP1Ghost(s1);
      return;
    }

    // Throttle regen display (prevents jarring jumps after recent damage)
    const justDecreased =
      Date.now() - p1LastDecreaseAt < 600 || p1DisplayStamina === 0;
    if (next - p1DisplayStamina > 25 && justDecreased) {
      next = p1DisplayStamina;
    }
    if (next > p1DisplayStamina) {
      next = Math.min(next, p1DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP1DisplayStamina(next);

    return () => {
      if (p1GhostTimer.current) {
        clearTimeout(p1GhostTimer.current);
        p1GhostTimer.current = null;
      }
    };
  }, [s1]);

  // ── Player 2 stamina + ghost + regen ──
  useEffect(() => {
    const prev = p2PrevStamina.current;
    p2PrevStamina.current = s2;
    let next = s2;

    // After a round reset, snap immediately to the server value (bypass throttle)
    // BUT only if stamina didn't decrease — if it dropped, fall through to damage
    // logic so the ghost bar correctly trails the first hit
    if (p2JustReset.current) {
      p2JustReset.current = false;
      if (s2 >= prev) {
        setP2DisplayStamina(s2);
        setP2Ghost(s2);
        return;
      }
    }

    if (s2 < prev) {
      // ▼ DAMAGE
      const now = Date.now();
      setP2LastDecreaseAt(now);
      p2LastDecreaseAtRef.current = now;
      setP2Ghost((g) => Math.max(g, p2DisplayStamina));
      setP2GhostCatching(false);
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
      const closureS2 = s2;
      const scheduleGhostCatchUp = (delay = 700) => {
        p2GhostTimer.current = setTimeout(() => {
          // During continuous drain (e.g. grab push), don't catch up mid-sequence — reschedule
          const elapsed = Date.now() - p2LastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP2GhostCatching(true);
          setP2Ghost(closureS2);
        }, delay);
      };
      scheduleGhostCatchUp(700);
      setP2Regen(false);
      if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
    } else if (s2 > prev) {
      // ▲ REGEN
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
      setP2GhostCatching(false);
      setP2Ghost(Math.min(s2, p2DisplayStamina));
      setP2Regen(true);
      if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
      p2RegenTimer.current = setTimeout(() => setP2Regen(false), 500);
    }

    // Parry refund bypass: snap instantly, skip all throttling
    if (p2ParryRefundPending.current && s2 > prev) {
      p2ParryRefundPending.current = false;
      setP2DisplayStamina(s2);
      setP2Ghost(s2);
      return;
    }

    // Gassed recovery bypass: snap to new stamina when "second wind" kicks in
    if (p2RecoveryPending.current && s2 > prev) {
      p2RecoveryPending.current = false;
      setP2DisplayStamina(s2);
      setP2Ghost(s2);
      return;
    }

    const justDecreased =
      Date.now() - p2LastDecreaseAt < 600 || p2DisplayStamina === 0;
    if (next - p2DisplayStamina > 25 && justDecreased) {
      next = p2DisplayStamina;
    }
    if (next > p2DisplayStamina) {
      next = Math.min(next, p2DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP2DisplayStamina(next);

    return () => {
      if (p2GhostTimer.current) {
        clearTimeout(p2GhostTimer.current);
        p2GhostTimer.current = null;
      }
    };
  }, [s2]);

  // ── Player 1 balance ghost ──
  useEffect(() => {
    const prev = p1PrevBalance.current;
    p1PrevBalance.current = b1;

    if (b1 < prev) {
      const now = Date.now();
      p1BalLastDecreaseAtRef.current = now;
      setP1BalGhost((g) => Math.max(g, prev));
      setP1BalGhostCatching(false);
      if (p1BalGhostTimer.current) clearTimeout(p1BalGhostTimer.current);
      const closureB1 = b1;
      const scheduleGhostCatchUp = (delay = 700) => {
        p1BalGhostTimer.current = setTimeout(() => {
          const elapsed = Date.now() - p1BalLastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP1BalGhostCatching(true);
          setP1BalGhost(closureB1);
        }, delay);
      };
      scheduleGhostCatchUp(700);
    } else if (b1 > prev) {
      const elapsed = Date.now() - p1BalLastDecreaseAtRef.current;
      if (elapsed > 600) {
        if (p1BalGhostTimer.current) clearTimeout(p1BalGhostTimer.current);
        setP1BalGhostCatching(false);
        setP1BalGhost(b1);
      }
    }

    return () => {
      if (p1BalGhostTimer.current) {
        clearTimeout(p1BalGhostTimer.current);
        p1BalGhostTimer.current = null;
      }
    };
  }, [b1]);

  // ── Player 2 balance ghost ──
  useEffect(() => {
    const prev = p2PrevBalance.current;
    p2PrevBalance.current = b2;

    if (b2 < prev) {
      const now = Date.now();
      p2BalLastDecreaseAtRef.current = now;
      setP2BalGhost((g) => Math.max(g, prev));
      setP2BalGhostCatching(false);
      if (p2BalGhostTimer.current) clearTimeout(p2BalGhostTimer.current);
      const closureB2 = b2;
      const scheduleGhostCatchUp = (delay = 700) => {
        p2BalGhostTimer.current = setTimeout(() => {
          const elapsed = Date.now() - p2BalLastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP2BalGhostCatching(true);
          setP2BalGhost(closureB2);
        }, delay);
      };
      scheduleGhostCatchUp(700);
    } else if (b2 > prev) {
      const elapsed = Date.now() - p2BalLastDecreaseAtRef.current;
      if (elapsed > 600) {
        if (p2BalGhostTimer.current) clearTimeout(p2BalGhostTimer.current);
        setP2BalGhostCatching(false);
        setP2BalGhost(b2);
      }
    }

    return () => {
      if (p2BalGhostTimer.current) {
        clearTimeout(p2BalGhostTimer.current);
        p2BalGhostTimer.current = null;
      }
    };
  }, [b2]);

  // ── Derived match state ──
  const currentRound = Math.min(roundHistory.length + 1, 3);

  const renderCenterMarks = (playerName) => {
    const marks = [];
    const maxRounds = 3;
    for (let i = 0; i < maxRounds; i++) {
      if (i < roundHistory.length) {
        const isWin = roundHistory[i] === playerName;
        marks.push(
          <GoStone key={`r-${i}`} $isWin={isWin} $isEmpty={false} />
        );
      } else {
        marks.push(
          <GoStone key={`e-${i}`} $isWin={false} $isEmpty={true} />
        );
      }
    }
    return marks;
  };

  const shouldShowLowStaminaWarning = (stamina) =>
    stamina < LOW_STAMINA_WARNING_THRESHOLD;

  const getPowerUpIsOnCooldown = (
    powerUpType,
    snowballCooldown,
    pumoArmyCooldown
  ) => {
    switch (powerUpType) {
      case "snowball":
        return snowballCooldown;
      case "pumo_army":
        return pumoArmyCooldown;
      default:
        return false;
    }
  };

  const getPowerUpIcon = (powerUpType) => {
    switch (powerUpType) {
      case "speed": return happyFeetIcon;
      case "power": return powerWaterIcon;
      case "snowball": return snowballImage;
      case "pumo_army": return pumoArmyIcon;
      case "thick_blubber": return thickBlubberIcon;
      default: return "";
    }
  };

  const p1Danger = shouldShowLowStaminaWarning(p1DisplayStamina);
  const p2Danger = shouldShowLowStaminaWarning(p2DisplayStamina);

  return (
    <HudShell $matchOver={matchOver}>
      {/* ═══ PLAYER 1 — East (Higashi) ═══ */}
      <PlayerWing $matchOver={matchOver}>
        <NameBanner $isRight={false}>
          <WinLossRow $isRight={false}>
            {renderCenterMarks("player1")}
          </WinLossRow>
          <NameBlock $isRight={false}>
            <FighterName>PLAYER 1</FighterName>
          </NameBlock>
          <BarRowSpacer />
        </NameBanner>

        <BarRow $isRight={false}>
          <BarFrame
            $danger={p1Danger}
            $gassed={player1IsGassed}
            $isRight={false}
            $matchOver={matchOver}
          >
            <BarTrack $isRight={false}>
              <BarLabel $isRight={false}>STA</BarLabel>
              <BarFill
                $stamina={p1DisplayStamina}
                $danger={p1Danger}
                $isRight={false}
              />
              {!player1IsGassed && (
                <BarGhost
                  $stamina={p1Ghost}
                  $catching={p1GhostCatching}
                  $isRight={false}
                />
              )}
              {p1Regen && !player1IsGassed && (
                <RegenGlow
                  $stamina={p1DisplayStamina}
                  $isRight={false}
                />
              )}
              {player1IsGassed && (
                <GassedOverlay $matchOver={matchOver}>
                  <GassedText>GASSED</GassedText>
                </GassedOverlay>
              )}
              {p1ParryFlash > 0 && !player1IsGassed && (
                <ParryRefundFlash
                  key={p1ParryFlash}
                  $stamina={p1DisplayStamina}
                  $isRight={false}
                />
              )}
              {p1Recovery > 0 && (
                <RecoveryFlash key={`r1-${p1Recovery}`}>
                  <RecoveryText>SECOND WIND</RecoveryText>
                </RecoveryFlash>
              )}
              <StaTickMark $pct={25} />
              <StaTickMark $pct={50} />
              <StaTickMark $pct={75} />
            </BarTrack>
            <GaugeDivider />
            <BalanceBarTrack $isRight={false}>
              <BalanceBarLabel $isRight={false}>BAL</BalanceBarLabel>
              <BalanceBarGhost
                $balance={p1BalGhost}
                $catching={p1BalGhostCatching}
                $isRight={false}
              />
              <BalanceBarFill $balance={b1} $danger={b1Danger} $isRight={false} />
              <BalThrowMark />
              <BalKillMark $isRight={false} />
            </BalanceBarTrack>
          </BarFrame>
          <PowerUpSlot
            $active={player1ActivePowerUp}
            $cooldown={getPowerUpIsOnCooldown(
              player1ActivePowerUp,
              player1SnowballCooldown,
              player1PumoArmyCooldown
            )}
          >
            {player1ActivePowerUp && (
              <img
                src={getPowerUpIcon(player1ActivePowerUp)}
                alt={player1ActivePowerUp}
              />
            )}
            {player1ActivePowerUp === "snowball" &&
              Number.isFinite(player1SnowballThrowsRemaining) && (
                <SnowballCountBadge>
                  {Math.max(0, player1SnowballThrowsRemaining)}
                </SnowballCountBadge>
              )}
          </PowerUpSlot>
        </BarRow>

        <SubBarRow $isRight={false}>
          <BarRowSpacer />
          <RankPlaque $isRight={false}>
            <RankText>JONOKUCHI</RankText>
          </RankPlaque>
        </SubBarRow>
      </PlayerWing>

      {/* ═══ CENTER ROUND ═══ */}
      <CenterRound $matchOver={matchOver}>
        <RoundNum>{currentRound}</RoundNum>
        <RoundText>ROUND</RoundText>
      </CenterRound>

      {/* ═══ PLAYER 2 — West (Nishi) ═══ */}
      <PlayerWing $matchOver={matchOver}>
        <NameBanner $isRight={true}>
          <WinLossRow $isRight={true}>
            {renderCenterMarks("player2")}
          </WinLossRow>
          <NameBlock $isRight={true}>
            <FighterName>PLAYER 2</FighterName>
          </NameBlock>
          <BarRowSpacer />
        </NameBanner>

        <BarRow $isRight={true}>
          <BarFrame
            $danger={p2Danger}
            $gassed={player2IsGassed}
            $isRight={true}
            $matchOver={matchOver}
          >
            <BarTrack $isRight={true}>
              <BarLabel $isRight={true}>STA</BarLabel>
              <BarFill
                $stamina={p2DisplayStamina}
                $danger={p2Danger}
                $isRight={true}
              />
              {!player2IsGassed && (
                <BarGhost
                  $stamina={p2Ghost}
                  $catching={p2GhostCatching}
                  $isRight={true}
                />
              )}
              {p2Regen && !player2IsGassed && (
                <RegenGlow
                  $stamina={p2DisplayStamina}
                  $isRight={true}
                />
              )}
              {player2IsGassed && (
                <GassedOverlay $matchOver={matchOver}>
                  <GassedText>GASSED</GassedText>
                </GassedOverlay>
              )}
              {p2ParryFlash > 0 && !player2IsGassed && (
                <ParryRefundFlash
                  key={p2ParryFlash}
                  $stamina={p2DisplayStamina}
                  $isRight={true}
                />
              )}
              {p2Recovery > 0 && (
                <RecoveryFlash key={`r2-${p2Recovery}`}>
                  <RecoveryText>SECOND WIND</RecoveryText>
                </RecoveryFlash>
              )}
              <StaTickMark $pct={25} />
              <StaTickMark $pct={50} />
              <StaTickMark $pct={75} />
            </BarTrack>
            <GaugeDivider />
            <BalanceBarTrack $isRight={true}>
              <BalanceBarLabel $isRight={true}>BAL</BalanceBarLabel>
              <BalanceBarGhost
                $balance={p2BalGhost}
                $catching={p2BalGhostCatching}
                $isRight={true}
              />
              <BalanceBarFill $balance={b2} $danger={b2Danger} $isRight={true} />
              <BalThrowMark />
              <BalKillMark $isRight={true} />
            </BalanceBarTrack>
          </BarFrame>
          <PowerUpSlot
            $active={player2ActivePowerUp}
            $cooldown={getPowerUpIsOnCooldown(
              player2ActivePowerUp,
              player2SnowballCooldown,
              player2PumoArmyCooldown
            )}
          >
            {player2ActivePowerUp && (
              <img
                src={getPowerUpIcon(player2ActivePowerUp)}
                alt={player2ActivePowerUp}
              />
            )}
            {player2ActivePowerUp === "snowball" &&
              Number.isFinite(player2SnowballThrowsRemaining) && (
                <SnowballCountBadge>
                  {Math.max(0, player2SnowballThrowsRemaining)}
                </SnowballCountBadge>
              )}
          </PowerUpSlot>
        </BarRow>

        <SubBarRow $isRight={true}>
          <BarRowSpacer />
          <RankPlaque $isRight={true}>
            <RankText>JONOKUCHI</RankText>
          </RankPlaque>
        </SubBarRow>
      </PlayerWing>
    </HudShell>
  );
};

UiPlayerInfo.propTypes = {
  roundHistory: PropTypes.array,
  roundId: PropTypes.number,
  player1Stamina: PropTypes.number,
  player1ActivePowerUp: PropTypes.string,
  player1SnowballCooldown: PropTypes.bool,
  player1SnowballThrowsRemaining: PropTypes.number,
  player1PumoArmyCooldown: PropTypes.bool,
  player1IsGassed: PropTypes.bool,
  player1ParryRefund: PropTypes.number,
  player1Balance: PropTypes.number,
  player2Stamina: PropTypes.number,
  player2ActivePowerUp: PropTypes.string,
  player2SnowballCooldown: PropTypes.bool,
  player2SnowballThrowsRemaining: PropTypes.number,
  player2PumoArmyCooldown: PropTypes.bool,
  player2IsGassed: PropTypes.bool,
  player2ParryRefund: PropTypes.number,
  player2Balance: PropTypes.number,
  matchOver: PropTypes.bool,
};

export default React.memo(UiPlayerInfo);
