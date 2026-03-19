import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { SocketContext } from "../SocketContext";
import {
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
} from "../utils/soundUtils";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";

// Banner drop animation
const bannerDrop = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-30px) scale(0.9);
  }
  60% {
    transform: translateY(5px) scale(1.01);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

// Gentle sway
const bannerSway = keyframes`
  0%, 100% { transform: rotate(-0.3deg); }
  50% { transform: rotate(0.3deg); }
`;

// Tassel sway
const tasselSway = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
`;

// Card entrance
const cardSlide = keyframes`
  0% { 
    opacity: 0; 
    transform: translateY(10px);
  }
  100% { 
    opacity: 1; 
    transform: translateY(0);
  }
`;

// Selected pulse
const selectedPulse = keyframes`
  0%, 100% { 
    box-shadow: 
      0 0 0 2px var(--type-color),
      0 4px 12px rgba(0,0,0,0.4);
  }
  50% { 
    box-shadow: 
      0 0 0 3px var(--type-color),
      0 0 20px var(--type-color),
      0 4px 12px rgba(0,0,0,0.4);
  }
`;

// Timer urgency
const urgentFlash = keyframes`
  0%, 100% { color: #ff3333; }
  50% { color: #ffcc00; }
`;

const overlayReveal = keyframes`
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

const scrimPulse = keyframes`
  0%, 100% {
    opacity: 0.9;
  }
  50% {
    opacity: 1;
  }
`;

const shimmerSweep = keyframes`
  0% {
    transform: translateX(-135%);
    opacity: 0;
  }
  18% {
    opacity: 0.5;
  }
  50% {
    transform: translateX(135%);
    opacity: 0.08;
  }
  100% {
    transform: translateX(135%);
    opacity: 0;
  }
`;

const glowPulse = keyframes`
  0%, 100% {
    opacity: 0.55;
    transform: scale(0.98);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.02);
  }
`;

const timerCorePulse = keyframes`
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(255, 220, 140, 0.14),
      0 0 22px rgba(212, 175, 55, 0.16),
      inset 0 1px 0 rgba(255, 236, 198, 0.24);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(255, 220, 140, 0.22),
      0 0 34px rgba(212, 175, 55, 0.26),
      inset 0 1px 0 rgba(255, 236, 198, 0.34);
  }
`;

// Same layering as MatchOver — portalled into #game-hud
const PowerUpSelectionOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  pointer-events: none;
  opacity: 0;
  animation: ${overlayReveal} 0.28s ease-out forwards;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 32%, rgba(212, 175, 55, 0.09) 0%, rgba(212, 175, 55, 0.03) 26%, transparent 58%),
      radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 26%, rgba(0, 0, 0, 0.2) 68%, rgba(0, 0, 0, 0.62) 100%),
      linear-gradient(180deg, rgba(4, 5, 12, 0.2) 0%, rgba(4, 6, 14, 0.06) 24%, rgba(3, 5, 12, 0.38) 100%);
    pointer-events: none;
    animation: ${scrimPulse} 5.5s ease-in-out infinite;
  }

  @supports (backdrop-filter: blur(1px)) {
    backdrop-filter: blur(3px) saturate(0.9) brightness(0.92);
    -webkit-backdrop-filter: blur(3px) saturate(0.9) brightness(0.92);
  }
`;

// Mirrors MatchOverStage — centers the banner in the HUD viewport
const PowerUpSelectionStage = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(52px, 8vh, 88px) clamp(24px, 4vw, 40px);
  pointer-events: none;
`;

const BannerContainer = styled.div`
  width: fit-content;
  max-width: min(84cqw, 790px);
  pointer-events: auto;
  animation: ${bannerDrop} 0.5s ease-out forwards, ${bannerSway} 8s ease-in-out 0.5s infinite;
  transform-origin: center center;
  position: relative;
  
  @media (max-width: 1200px) {
    max-width: min(86cqw, 720px);
  }
  
  @media (max-width: 900px) {
    max-width: min(89cqw, 645px);
  }
  
  @media (max-width: 600px) {
    max-width: min(93cqw, 520px);
  }
`;

const BannerGlow = styled.div`
  position: absolute;
  inset: -26px -34px -46px;
  border-radius: 34px;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 28%, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.08) 28%, transparent 64%),
    radial-gradient(circle at 50% 70%, rgba(0, 200, 255, 0.08) 0%, transparent 55%);
  filter: blur(18px);
  animation: ${glowPulse} 4.5s ease-in-out infinite;
`;

// Top hanging bar (matches MatchOver)
const HangingBar = styled.div`
  width: 108%;
  height: clamp(16px, 2.1cqh, 24px);
  background: linear-gradient(180deg,
    #7a5943 0%,
    #5c4033 18%,
    #3d2817 58%,
    #2a1d14 100%
  );
  border-radius: 4px 4px 0 0;
  margin-left: -4%;
  position: relative;
  border: 2px solid #b19062;
  border-bottom: none;
  box-shadow:
    0 4px 12px rgba(0,0,0,0.5),
    0 0 18px rgba(0,0,0,0.2),
    inset 0 1px 0 rgba(255, 230, 180, 0.2);
  
  /* Hanging rings */
  &::before, &::after {
    content: "";
    position: absolute;
    top: -8px;
    width: clamp(10px, 1.5cqw, 16px);
    height: clamp(10px, 1.5cqw, 16px);
    background: radial-gradient(circle at 30% 30%, #f3d376, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  &::before { left: 16%; }
  &::after { right: 16%; }
`;

// Main banner body (matches MatchOver style)
const BannerBody = styled.div`
  background: linear-gradient(180deg,
    #2a120d 0%,
    #1d0d0a 16%,
    #120707 52%,
    #0d0404 100%
  );
  border: 3px solid #9f8058;
  border-top: none;
  border-radius: 0 0 clamp(12px, 1.5cqw, 18px) clamp(12px, 1.5cqw, 18px);
  padding: clamp(18px, 2.8cqh, 30px) clamp(18px, 2.2cqw, 30px) clamp(18px, 2.5cqh, 26px);
  box-shadow: 
    0 15px 50px rgba(0,0,0,0.7),
    inset 0 0 40px rgba(0,0,0,0.6),
    inset 0 2px 0 rgba(255, 221, 180, 0.14),
    inset 0 -18px 30px rgba(0, 0, 0, 0.32);
  position: relative;
  
  /* Fabric texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        rgba(255,255,255,0.015) 1px,
        transparent 2px
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(255,255,255,0.012) 1px,
        transparent 2px
      ),
      linear-gradient(
        180deg,
        rgba(255, 221, 180, 0.06) 0%,
        transparent 26%,
        transparent 72%,
        rgba(255, 221, 180, 0.03) 100%
      );
    pointer-events: none;
    border-radius: 0 0 clamp(12px, 1.5cqw, 18px) clamp(12px, 1.5cqw, 18px);
  }
  
  /* Gold corner decoration */
  &::after {
    content: "";
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    bottom: 10px;
    border: 1px solid rgba(212, 175, 55, 0.18);
    border-radius: clamp(8px, 1cqw, 12px);
    pointer-events: none;
  }

  @supports (backdrop-filter: blur(1px)) {
    backdrop-filter: blur(1.5px);
    -webkit-backdrop-filter: blur(1.5px);
  }
  
  @media (max-width: 900px) {
    padding: clamp(14px, 2.2cqh, 22px) clamp(12px, 1.8cqw, 20px) clamp(14px, 1.8cqh, 18px);
    border-width: 2px;
  }
`;

const InnerShimmer = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;

  &::before {
    content: "";
    position: absolute;
    top: -8%;
    bottom: -8%;
    width: 34%;
    left: 0;
    background: linear-gradient(
      100deg,
      transparent 0%,
      rgba(255, 228, 156, 0.02) 28%,
      rgba(255, 228, 156, 0.13) 52%,
      rgba(255, 228, 156, 0.02) 76%,
      transparent 100%
    );
    transform: translateX(-135%);
    animation: ${shimmerSweep} 5.6s ease-in-out infinite;
    animation-delay: 0.8s;
  }
`;

// Tassels container
const TasselContainer = styled.div`
  position: absolute;
  bottom: -25px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 0 15%;
  pointer-events: none;
`;

const Tassel = styled.div`
  width: clamp(6px, 1cqw, 10px);
  height: clamp(20px, 3cqh, 35px);
  background: linear-gradient(180deg, #d4af37 0%, #8b7355 100%);
  border-radius: 0 0 3px 3px;
  animation: ${tasselSway} ${props => 2 + props.$delay * 0.3}s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.15}s;
  transform-origin: top center;
  
  &::after {
    content: "";
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 8px;
    background: linear-gradient(180deg, #8b7355 0%, #5c4033 100%);
    border-radius: 0 0 2px 2px;
  }
`;

// Title section with decorative border
const TitleSection = styled.div`
  text-align: center;
  margin-bottom: clamp(14px, 1.85cqh, 20px);
  padding-bottom: clamp(12px, 1.4cqh, 16px);
  position: relative;
  
  &::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: min(100%, 320px);
    height: 1px;
    transform: translateX(-50%);
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(212, 175, 55, 0.14) 14%,
      rgba(212, 175, 55, 0.42) 50%,
      rgba(212, 175, 55, 0.14) 86%,
      transparent 100%
    );
  }

  &::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -4px;
    width: clamp(7px, 0.75cqw, 10px);
    height: clamp(7px, 0.75cqw, 10px);
    transform: translateX(-50%) rotate(45deg);
    background: linear-gradient(135deg, #f3d376 0%, #c2932e 100%);
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
  }
`;

const Title = styled.h1`
  font-family: "Bungee Inline", "Bungee", cursive;
  font-size: clamp(0.92rem, 2.1cqw, 1.32rem);
  margin: 0 0 clamp(5px, 0.7cqh, 8px) 0;
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  text-shadow: 
    3px 3px 0 #1a0e06,
    6px 6px 0 rgba(18, 10, 4, 0.45),
    0 0 16px rgba(212, 175, 55, 0.22);
  
  @media (max-width: 900px) {
    font-size: clamp(0.74rem, 2.8cqw, 1.02rem);
  }
`;

const Subtitle = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.86cqw, 0.6rem);
  color: #e9dbc2;
  text-transform: uppercase;
  letter-spacing: 0.28em;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.9);
  opacity: 0.9;

  @media (max-width: 900px) {
    font-size: clamp(0.38rem, 1.3cqw, 0.52rem);
    letter-spacing: 0.22em;
  }
`;

// Cards grid
const CardsContainer = styled.div`
  display: flex;
  gap: clamp(8px, 1.5cqw, 16px);
  justify-content: center;
  flex-wrap: nowrap;
  position: relative;
  z-index: 1;
  
  @media (max-width: 600px) {
    gap: clamp(6px, 1.3cqw, 12px);
  }
`;

// Type color helper
const getTypeColor = (type) => {
  switch (type) {
    case "speed": return { main: "#00d2ff", dark: "#006688", light: "#66e5ff" };
    case "power": return { main: "#ff4444", dark: "#882222", light: "#ff7777" };
    case "snowball": return { main: "#74b9ff", dark: "#3366aa", light: "#a8d4ff" };
    case "pumo_army": return { main: "#ffaa44", dark: "#996622", light: "#ffcc88" };
    case "thick_blubber": return { main: "#aa77ff", dark: "#553399", light: "#cc99ff" };
    default: return { main: "#d4af37", dark: "#8b7355", light: "#f0d080" };
  }
};

// Power card - wooden plaque style (like Rematch button)
const PowerCard = styled.div`
  --type-color: ${props => getTypeColor(props.$type).main};
  --power-card-text-gap: clamp(5px, 0.5cqh, 8px);
  /* Slightly more than name→desc so Passive / Press F sits a bit lower */
  --power-card-desc-to-hint-gap: calc(
    var(--power-card-text-gap) + clamp(8px, 0.85cqh, 16px)
  );

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: clamp(88px, 12.4cqw, 142px);
  aspect-ratio: 1 / 1.04;
  height: auto;
  padding: clamp(10px, 1.15cqh, 14px) clamp(8px, 1cqw, 12px) clamp(9px, 1.05cqh, 12px);
  box-sizing: border-box;
  background: linear-gradient(180deg,
    rgba(91, 67, 48, 0.98) 0%,
    rgba(60, 39, 26, 0.98) 38%,
    rgba(30, 18, 14, 0.98) 100%
  );
  border: 2px solid ${props => props.$selected ? getTypeColor(props.$type).main : '#8b7355'};
  border-radius: clamp(8px, 0.9cqw, 12px);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  animation: ${cardSlide} 0.4s ease-out forwards;
  animation-delay: ${props => props.$index * 0.06}s;
  opacity: 0;
  flex-shrink: 0;
  box-shadow: 
    0 10px 22px rgba(0,0,0,0.42),
    0 0 0 1px rgba(255,255,255,0.025),
    inset 0 1px 0 rgba(255,255,255,0.12),
    inset 0 -10px 14px rgba(0,0,0,0.3);
  
  /* Wood grain */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      90deg,
      transparent 0px,
      rgba(255,255,255,0.02) 1px,
      transparent 3px
    );
    border-radius: inherit;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 6px;
    border-radius: clamp(6px, 0.7cqw, 10px);
    border: 1px solid rgba(212, 175, 55, 0.1);
    background: linear-gradient(
      180deg,
      rgba(255, 230, 180, 0.045) 0%,
      transparent 35%,
      transparent 72%,
      rgba(0, 0, 0, 0.12) 100%
    );
    pointer-events: none;
  }
  
  ${props => props.$selected && css`
    animation: ${cardSlide} 0.4s ease-out forwards, ${selectedPulse} 1.5s ease-in-out infinite;
    animation-delay: ${props.$index * 0.06}s, 0.4s;
    background: linear-gradient(180deg,
      ${getTypeColor(props.$type).dark}88 0%,
      rgba(61, 40, 23, 0.98) 38%,
      rgba(30, 18, 14, 0.98) 100%
    );
  `}
  
  &:hover {
    transform: translateY(-6px) scale(1.015);
    border-color: ${props => getTypeColor(props.$type).main};
    box-shadow: 
      0 14px 28px rgba(0,0,0,0.5),
      0 0 22px ${props => getTypeColor(props.$type).main}33,
      inset 0 1px 0 rgba(255,255,255,0.16);
  }
  
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none;
  }
  
  @media (max-width: 600px) {
    width: clamp(74px, 16.5cqw, 108px);
    padding: clamp(8px, 0.9cqh, 11px) clamp(6px, 0.8cqw, 9px) clamp(7px, 0.9cqh, 10px);
  }
`;

// Square icon with type color
const IconSquare = styled.div`
  width: clamp(30px, 4.3cqw, 44px);
  height: clamp(30px, 4.3cqw, 44px);
  background: linear-gradient(135deg,
    ${props => getTypeColor(props.$type).light} 0%,
    ${props => getTypeColor(props.$type).main} 35%,
    ${props => getTypeColor(props.$type).dark} 100%
  );
  border: 2px solid rgba(18, 10, 6, 0.95);
  border-radius: clamp(8px, 0.8cqw, 10px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(7px, 0.7cqh, 9px);
  flex-shrink: 0;
  box-shadow: 
    inset 0 2px 5px rgba(255,255,255,0.36),
    inset 0 -4px 8px rgba(0,0,0,0.35),
    0 6px 14px rgba(0,0,0,0.35);
  position: relative;
  
  img {
    width: 68%;
    height: 68%;
    object-fit: contain;
    filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.55));
  }

  &::after {
    content: "";
    position: absolute;
    inset: 2px;
    border-radius: inherit;
    border: 1px solid rgba(255, 255, 255, 0.2);
    pointer-events: none;
  }
  
  @media (max-width: 600px) {
    width: clamp(26px, 5.9cqw, 38px);
    height: clamp(26px, 5.9cqw, 38px);
    margin-bottom: clamp(5px, 0.55cqh, 7px);
  }
`;

/* Remaining card height: centers description + usage under the title */
const PowerCardMeta = styled.div`
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--power-card-desc-to-hint-gap);
  position: relative;
  z-index: 1;
  transform: translateY(clamp(-6px, -0.45cqh, -2px));
`;

const PowerName = styled.div`
  font-family: "Bungee Inline", "Bungee", cursive;
  font-size: clamp(0.5rem, 1cqw, 0.72rem);
  color: ${props => props.$selected ? getTypeColor(props.$type).light : getTypeColor(props.$type).main};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
  line-height: 1.05;
  flex-shrink: 0;
  margin-bottom: var(--power-card-text-gap);
  text-shadow:
    1px 1px 0 rgba(0,0,0,0.92),
    0 0 10px rgba(0,0,0,0.35);
  
  @media (max-width: 600px) {
    font-size: clamp(0.42rem, 1.7cqw, 0.6rem);
  }
`;

const PowerDesc = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  font-size: clamp(0.48rem, 0.95cqw, 0.66rem);
  color: rgba(234, 239, 246, 0.92);
  text-align: center;
  line-height: 1.2;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.95),
    0 0 8px rgba(0, 0, 0, 0.22);
  margin: 0;
  
  @media (max-width: 600px) {
    font-size: clamp(0.4rem, 1.48cqw, 0.54rem);
  }
`;

const UsageHint = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.38rem, 0.72cqw, 0.52rem);
  letter-spacing: 0.04em;
  text-transform: none;
  text-align: center;
  line-height: 1.2;
  margin: 0;
  padding: 0;
  align-self: stretch;
  color: ${(p) =>
    p.$isActive ? "rgba(124, 218, 168, 0.95)" : "rgba(255, 255, 255, 0.58)"};
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);

  @media (max-width: 600px) {
    font-size: clamp(0.32rem, 1.15cqw, 0.44rem);
  }
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: clamp(14px, 1.8cqh, 20px);
  position: relative;
  z-index: 1;
`;

const TimerDisplay = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  position: relative;
  z-index: 1;
  min-width: clamp(170px, 21.8cqw, 214px);
  padding: clamp(5px, 0.5cqh, 7px);
  border-radius: clamp(10px, 0.8cqw, 14px);
  border: 1px solid rgba(212, 175, 55, 0.22);
  background: linear-gradient(
    180deg,
    rgba(62, 40, 26, 0.94) 0%,
    rgba(28, 16, 10, 0.98) 100%
  );
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 8px 18px rgba(0,0,0,0.26);
  overflow: hidden;
  
  ${props => props.$urgent && css`
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.08),
      0 8px 18px rgba(0,0,0,0.26),
      0 0 16px rgba(255, 74, 74, 0.12);
  `}
`;

const TimerLabel = styled.span`
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  font-size: clamp(0.38rem, 0.72cqw, 0.5rem);
  color: rgba(243, 231, 206, 0.82);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.92),
    0 0 8px rgba(212, 175, 55, 0.08);
  padding: 0 clamp(16px, 1.8cqw, 22px) 0 clamp(14px, 1.6cqw, 18px);
  justify-self: center;
  white-space: nowrap;
`;

const TimerValue = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  min-width: clamp(72px, 8.7cqw, 92px);
  padding: clamp(5px, 0.55cqh, 7px) clamp(10px, 1.05cqw, 13px);
  border-radius: 0 clamp(8px, 0.65cqw, 10px) clamp(8px, 0.65cqw, 10px) 0;
  background: linear-gradient(
    180deg,
    rgba(38, 18, 10, 0.98) 0%,
    rgba(12, 5, 4, 0.98) 100%
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 228, 180, 0.08),
    inset 10px 0 18px rgba(0,0,0,0.16);
  animation: ${timerCorePulse} 2.4s ease-in-out infinite;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: clamp(8px, 0.9cqw, 12px);
    background: linear-gradient(
      90deg,
      rgba(255, 226, 168, 0.12) 0%,
      rgba(255, 226, 168, 0.04) 24%,
      rgba(0, 0, 0, 0.18) 58%,
      transparent 100%
    );
    pointer-events: none;
  }
`;

const TimerNumber = styled.span`
  font-family: "Bungee Inline", "Bungee", cursive;
  font-size: clamp(1.08rem, 2.08cqw, 1.46rem);
  line-height: 0.9;
  color: ${props => props.$urgent ? '#ff6a5a' : '#d4af37'};
  text-shadow:
    2px 2px 0 ${props => props.$urgent ? '#2a0906' : '#1a0e06'},
    0 0 12px ${props => props.$urgent ? 'rgba(255, 96, 72, 0.22)' : 'rgba(212, 175, 55, 0.32)'};
  letter-spacing: 0.08em;
  
  @media (max-width: 600px) {
    font-size: clamp(0.86rem, 2.6cqw, 1.14rem);
  }
`;

const TimerUnit = styled.span`
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  font-size: clamp(0.38rem, 0.72cqw, 0.52rem);
  line-height: 1;
  color: ${props => props.$urgent ? '#ff8d7a' : '#8b7355'};
  text-shadow: 1px 1px 0 #000;
  margin-left: 2px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  
  @media (max-width: 600px) {
    font-size: clamp(0.34rem, 1cqw, 0.48rem);
  }
`;

const PowerUpSelection = ({
  roomId,
  playerId,
  onSelectionComplete,
  onSelectionStateChange,
}) => {
  const { socket } = useContext(SocketContext);
  const [selectedPowerUp, setSelectedPowerUp] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [availablePowerUps, setAvailablePowerUps] = useState([]);

  const powerUpInfo = useMemo(
    () => ({
      speed: {
        name: "Happy Feet",
        description: "Speed & dash",
        icon: happyFeetIcon,
      },
      power: {
        name: "Power Water",
        description: "+20% knockback",
        icon: powerWaterIcon,
      },
      snowball: {
        name: "Snowball",
        description: "Max 3 throws",
        icon: snowballImage,
      },
      pumo_army: {
        name: "Pumo Army",
        description: "Summon clones",
        icon: pumoArmyIcon,
      },
      thick_blubber: {
        name: "Thick Blubber",
        description: "Block 1 hit",
        icon: thickBlubberIcon,
      },
    }),
    []
  );

  const timerNumber = useMemo(() => {
    return timeLeft > 0 ? timeLeft : "0";
  }, [timeLeft]);

  const countdownIntervalRef = useRef(null);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startCountdownTimer = useCallback(() => {
    clearCountdownInterval();
    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdownInterval]);

  useEffect(() => {
    const handlePowerUpSelectionStart = (data) => {
      // If the countdown is already running (duplicate event from
      // request_power_up_selection_state), just update power-ups without
      // restarting the timer — keeps the client in sync with the server.
      if (countdownIntervalRef.current) {
        setAvailablePowerUps(data.availablePowerUps || []);
        return;
      }
      setIsVisible(true);
      setSelectedPowerUp(null);
      setTimeLeft(15);
      setAvailablePowerUps(data.availablePowerUps || []);
      startCountdownTimer();
      if (onSelectionStateChange) {
        onSelectionStateChange(true);
      }
    };

    const handlePowerUpSelectionComplete = () => {
      setIsVisible(false);
      setTimeLeft(15);
      setAvailablePowerUps([]);
      clearCountdownInterval();
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
      if (onSelectionComplete) {
        onSelectionComplete();
      }
    };

    const handleGameReset = () => {
      setIsVisible(false);
      setSelectedPowerUp(null);
      setTimeLeft(15);
      setAvailablePowerUps([]);
      clearCountdownInterval();
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
    };

    socket.on("power_up_selection_start", handlePowerUpSelectionStart);
    socket.on("power_up_selection_complete", handlePowerUpSelectionComplete);
    socket.on("game_reset", handleGameReset);

    return () => {
      socket.off("power_up_selection_start", handlePowerUpSelectionStart);
      socket.off("power_up_selection_complete", handlePowerUpSelectionComplete);
      socket.off("game_reset", handleGameReset);
      clearCountdownInterval();
    };
  }, [
    startCountdownTimer,
    clearCountdownInterval,
    onSelectionComplete,
    onSelectionStateChange,
    playerId,
    roomId,
    socket,
  ]);

  useEffect(() => {
    const requestPowerUpState = () => {
      socket.emit("request_power_up_selection_state", {
        roomId,
        playerId,
      });
    };

    requestPowerUpState();
    const stateRequestTimeout = setTimeout(requestPowerUpState, 500);

    return () => {
      clearTimeout(stateRequestTimeout);
    };
  }, [socket, playerId, roomId]);

  const handlePowerUpSelect = useCallback(
    (powerUpType) => {
      if (selectedPowerUp) return;
      playPowerUpSelectionPressSound();
      setSelectedPowerUp(powerUpType);
      socket.emit("power_up_selected", {
        roomId,
        playerId,
        powerUpType,
      });
    },
    [selectedPowerUp, socket, roomId, playerId]
  );

  if (!isVisible) return null;

  const hudEl = document.getElementById("game-hud");
  if (!hudEl) return null;

  return createPortal(
    <PowerUpSelectionOverlay>
      <PowerUpSelectionStage>
        <BannerContainer>
          <BannerGlow />
          <HangingBar />
          <BannerBody>
            <InnerShimmer />
            <TitleSection>
              <Title>Select Power</Title>
              <Subtitle>Choose Your Sumo Edge</Subtitle>
            </TitleSection>

            <CardsContainer>
              {availablePowerUps.map((type, index) => {
                const info = powerUpInfo[type];
                if (!info) return null;

                return (
                  <PowerCard
                    key={type}
                    $type={type}
                    $selected={selectedPowerUp === type}
                    $index={index}
                    onClick={() => handlePowerUpSelect(type)}
                    onMouseEnter={playPowerUpSelectionHoverSound}
                    disabled={selectedPowerUp && selectedPowerUp !== type}
                  >
                    <IconSquare $type={type}>
                      <img src={info.icon} alt={info.name} />
                    </IconSquare>
                    <PowerName $type={type} $selected={selectedPowerUp === type}>
                      {info.name}
                    </PowerName>
                    <PowerCardMeta>
                      <PowerDesc>{info.description}</PowerDesc>
                      <UsageHint $isActive={type === "snowball" || type === "pumo_army"}>
                        {type === "snowball" || type === "pumo_army"
                          ? "Press F to use"
                          : "Passive"}
                      </UsageHint>
                    </PowerCardMeta>
                  </PowerCard>
                );
              })}
            </CardsContainer>

            <FooterRow>
              <TimerDisplay $urgent={timeLeft <= 5}>
                <TimerLabel>Lock In</TimerLabel>
                <TimerValue>
                  <TimerNumber $urgent={timeLeft <= 5}>{timerNumber}</TimerNumber>
                  <TimerUnit $urgent={timeLeft <= 5}>s</TimerUnit>
                </TimerValue>
              </TimerDisplay>
            </FooterRow>

            <TasselContainer>
              <Tassel $delay={0} />
              <Tassel $delay={1} />
              <Tassel $delay={2} />
              <Tassel $delay={3} />
              <Tassel $delay={4} />
            </TasselContainer>
          </BannerBody>
        </BannerContainer>
      </PowerUpSelectionStage>
    </PowerUpSelectionOverlay>,
    hudEl
  );
};

PowerUpSelection.propTypes = {
  roomId: PropTypes.string.isRequired,
  playerId: PropTypes.string.isRequired,
  onSelectionComplete: PropTypes.func,
  onSelectionStateChange: PropTypes.func,
};

export default PowerUpSelection;
