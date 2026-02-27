import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { SocketContext } from "../SocketContext";
import { v4 as uuidv4 } from "uuid";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import Snowfall, { SnowCap, IcicleRow, Icicle } from "./Snowfall";
import lobbyBackground from "../assets/lobby-bkg.webp";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
} from "../utils/SpriteRecolorizer";
// Base sprite for recoloring preview (UNIFIED: all sprites are blue)
import pumo from "../assets/pumo.png";

// ============================================
// ANIMATIONS
// ============================================

const fadeIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

const slideInLeft = keyframes`
  0% {
    opacity: 0;
    transform: translateX(-60px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

const slideInRight = keyframes`
  0% {
    opacity: 0;
    transform: translateX(60px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

const bannerSway = keyframes`
  0%, 100% { transform: rotate(-0.3deg); }
  50% { transform: rotate(0.3deg); }
`;

const tasselSway = keyframes`
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
`;

const breathe = keyframes`
  0%, 100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(1.02);
  }
`;

const dotPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
`;

const readyGlow = keyframes`
  0%, 100% {
    box-shadow: 
      inset 0 0 10px rgba(74, 222, 128, 0.3),
      0 0 15px rgba(74, 222, 128, 0.2),
      0 6px 20px rgba(0,0,0,0.5);
  }
  50% {
    box-shadow: 
      inset 0 0 15px rgba(74, 222, 128, 0.5),
      0 0 25px rgba(74, 222, 128, 0.4),
      0 6px 20px rgba(0,0,0,0.5);
  }
`;

const versusGlow = keyframes`
  0%, 100% {
    text-shadow: 
      3px 3px 0 #000,
      0 0 20px rgba(212, 175, 55, 0.4);
  }
  50% {
    text-shadow: 
      3px 3px 0 #000,
      0 0 40px rgba(212, 175, 55, 0.7);
  }
`;

const dohyoPulse = keyframes`
  0%, 100% {
    box-shadow: 
      0 0 60px rgba(212, 175, 55, 0.1),
      inset 0 0 60px rgba(0,0,0,0.5);
  }
  50% {
    box-shadow: 
      0 0 100px rgba(212, 175, 55, 0.2),
      inset 0 0 60px rgba(0,0,0,0.5);
  }
`;

const lanternGlow = keyframes`
  0%, 100% {
    opacity: 0.7;
    filter: drop-shadow(0 0 10px rgba(255, 100, 50, 0.5));
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 20px rgba(255, 100, 50, 0.8));
  }
`;

const ropeSwing = keyframes`
  0%, 100% { transform: rotate(-0.5deg); }
  50% { transform: rotate(0.5deg); }
`;

// ============================================
// MAIN CONTAINER
// ============================================

const LobbyContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: linear-gradient(180deg,
    #0a0505 0%,
    #150a08 30%,
    #1a0c0a 50%,
    #150a08 70%,
    #0a0505 100%
  );
  position: relative;
  overflow: hidden;
`;

const BackgroundImage = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url(${lobbyBackground}) center/cover;
  opacity: 0.05;
  z-index: 0;
`;

// Subtle vignette effect
const Vignette = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at center,
    transparent 30%,
    rgba(0, 0, 0, 0.6) 100%
  );
  pointer-events: none;
  z-index: 1;
`;

// ============================================
// DECORATIVE ELEMENTS - HANGING ROPE & LANTERNS
// ============================================

const TopDecoration = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: clamp(60px, 10cqh, 100px);
  z-index: 5;
  pointer-events: none;
`;

const HangingRope = styled.div`
  position: absolute;
  top: clamp(20px, 3cqh, 35px);
  left: 10%;
  right: 10%;
  height: 4px;
  background: linear-gradient(90deg,
    transparent 0%,
    #5c4033 5%,
    #8b7355 50%,
    #5c4033 95%,
    transparent 100%
  );
  border-radius: 2px;
  animation: ${ropeSwing} 8s ease-in-out infinite;
  transform-origin: center top;
  
  &::before, &::after {
    content: "";
    position: absolute;
    top: -8px;
    width: clamp(12px, 2cqw, 20px);
    height: clamp(12px, 2cqw, 20px);
    background: radial-gradient(circle at 30% 30%, #d4af37, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
  }
  &::before { left: 0; }
  &::after { right: 0; }
`;

const Lantern = styled.div`
  position: absolute;
  top: clamp(22px, 3.5cqh, 45px);
  width: clamp(22px, 3.2cqw, 45px);
  height: clamp(32px, 5cqh, 70px);
  background: linear-gradient(180deg,
    #cc3300 0%,
    #aa2200 50%,
    #881100 100%
  );
  border-radius: clamp(4px, 0.6cqw, 8px);
  animation: ${lanternGlow} 3s ease-in-out infinite;
  animation-delay: ${props => props.$delay || 0}s;
  
  /* Lantern top */
  &::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 8px;
    background: linear-gradient(180deg, #5c4033, #3d2817);
    border-radius: 2px 2px 0 0;
  }
  
  /* Gold kanji decoration */
  &::after {
    content: "福";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: "Noto Serif JP", serif;
    font-size: clamp(12px, 1.8cqw, 20px);
    color: #d4af37;
    text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
  }
`;

const LeftLantern = styled(Lantern)`
  left: 20%;
`;

const RightLantern = styled(Lantern)`
  right: 20%;
`;

const CenterLantern = styled(Lantern)`
  left: 50%;
  transform: translateX(-50%);
  
  &::after {
    content: "力";
    font-size: clamp(14px, 2cqw, 22px);
  }
`;

// Small snow cap for lantern tops
const LanternSnowCap = styled.div`
  position: absolute;
  top: -9px;
  left: -20%;
  right: -20%;
  height: 8px;
  z-index: 10;
  pointer-events: none;
  
  &::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 10%;
    right: 10%;
    height: 4px;
    background: linear-gradient(180deg,
      rgba(255, 255, 255, 0.9) 0%,
      rgba(225, 238, 255, 0.8) 100%
    );
    border-radius: 3px 3px 1px 1px;
  }
  
  &::after {
    content: "";
    position: absolute;
    bottom: 2px;
    left: 0;
    right: 0;
    height: 8px;
    background:
      radial-gradient(ellipse 10px 6px at 20% bottom, rgba(255,255,255,0.95) 50%, transparent 51%),
      radial-gradient(ellipse 14px 7px at 55% bottom, rgba(240,248,255,0.9) 50%, transparent 51%),
      radial-gradient(ellipse 10px 5px at 85% bottom, rgba(255,255,255,0.9) 50%, transparent 51%);
  }
`;

// Snow on the hanging rope
const RopeSnowCap = styled.div`
  position: absolute;
  top: -5px;
  left: 5%;
  right: 5%;
  height: 6px;
  z-index: 2;
  pointer-events: none;
  
  &::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.5) 15%,
      rgba(255, 255, 255, 0.7) 30%,
      rgba(240, 248, 255, 0.6) 50%,
      rgba(255, 255, 255, 0.7) 70%,
      rgba(255, 255, 255, 0.5) 85%,
      transparent 100%
    );
    border-radius: 2px;
  }
`;

// ============================================
// HEADER - TOURNAMENT BANNER
// ============================================

const Header = styled.header`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: clamp(68px, 12cqh, 130px) clamp(16px, 2.5cqw, 40px) clamp(2px, 0.5cqh, 10px);
  margin-bottom: clamp(-8px, -1cqh, -16px);
  position: relative;
  z-index: 10;
  flex-shrink: 0;
`;

const TournamentBanner = styled.div`
  position: relative;
  animation: ${fadeIn} 0.5s ease-out, ${bannerSway} 10s ease-in-out 0.5s infinite;
  transform-origin: top center;
`;

const BannerHangingBar = styled.div`
  width: 110%;
  height: clamp(12px, 1.8cqh, 18px);
  background: linear-gradient(180deg,
    #5c4033 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border-radius: 4px 4px 0 0;
  margin-left: -5%;
  position: relative;
  border: 2px solid #8b7355;
  border-bottom: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  
  &::before, &::after {
    content: "";
    position: absolute;
    top: -6px;
    width: clamp(8px, 1.2cqw, 14px);
    height: clamp(8px, 1.2cqw, 14px);
    background: radial-gradient(circle at 30% 30%, #d4af37, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  &::before { left: 15%; }
  &::after { right: 15%; }
`;

const BannerBody = styled.div`
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #2d1510 30%,
    #1f0f0a 70%,
    #150805 100%
  );
  border: 3px solid #8b7355;
  border-top: none;
  border-radius: 0 0 clamp(6px, 1cqw, 12px) clamp(6px, 1cqw, 12px);
  padding: clamp(5px, 1cqh, 16px) clamp(12px, 2.5cqw, 40px);
  box-shadow: 
    0 10px 40px rgba(0,0,0,0.6),
    inset 0 0 30px rgba(0,0,0,0.4);
  position: relative;
  text-align: center;
  
  /* Subtle texture */
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
        rgba(255,255,255,0.008) 1px,
        transparent 2px
      );
    pointer-events: none;
    border-radius: 0 0 clamp(6px, 1cqw, 12px) clamp(6px, 1cqw, 12px);
  }
`;

const BannerTassels = styled.div`
  position: absolute;
  bottom: -20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 20%;
  pointer-events: none;
`;

const Tassel = styled.div`
  width: clamp(5px, 0.8cqw, 8px);
  height: clamp(18px, 2.8cqh, 28px);
  background: linear-gradient(180deg, #d4af37 0%, #8b7355 100%);
  border-radius: 0 0 2px 2px;
  animation: ${tasselSway} ${props => 2 + props.$delay * 0.3}s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.15}s;
  transform-origin: top center;
`;

const RoomCodeSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.6cqh, 8px);
`;

const RoomLabel = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.85cqw, 0.6rem);
  color: #8b7355;
  text-transform: uppercase;
  letter-spacing: 0.25em;
  text-shadow: 1px 1px 0 #000;
`;

const RoomCode = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.1rem, 2.2cqw, 1.6rem);
  color: #d4af37;
  letter-spacing: 0.18em;
  text-shadow: 
    2px 2px 0 #000,
    0 0 20px rgba(212, 175, 55, 0.3);
`;

// ============================================
// ARENA SECTION - DOHYO RING
// ============================================

const ArenaSection = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(4px, 1.5cqh, 24px) clamp(16px, 3cqw, 60px);
  position: relative;
  z-index: 2;
  min-height: 0;
  overflow: hidden;
`;

const ArenaLayout = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(16px, 4cqw, 60px);
  width: 100%;
  max-width: 1400px;
  height: 100%;
`;

const DohyoContainer = styled.div`
  position: relative;
  flex: 1;
  max-width: 1100px;
  height: 100%;
  min-height: 0;
`;

// The circular dohyo ring
const DohyoRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: clamp(60px, 10cqw, 180px);
  height: clamp(60px, 10cqw, 180px);
  border-radius: 50%;
  background: radial-gradient(
    circle at center,
    #1a0a08 0%,
    #150805 40%,
    #0f0503 80%,
    #0a0505 100%
  );
  border: clamp(4px, 0.8cqw, 10px) solid transparent;
  background-clip: padding-box;
  animation: ${dohyoPulse} 4s ease-in-out infinite;
  
  /* Ring border effect */
  &::before {
    position: absolute;
    top: -clamp(6px, 1cqw, 12px);
    left: -clamp(6px, 1cqw, 12px);
    right: -clamp(6px, 1cqw, 12px);
    bottom: -clamp(6px, 1cqw, 12px);
    border-radius: 50%;
    border: clamp(3px, 0.6cqw, 7px) solid;
    border-color: #8b7355;
    box-shadow: 
      inset 0 0 20px rgba(139, 115, 85, 0.3),
      0 0 30px rgba(139, 115, 85, 0.15);
  }
  
  /* Inner circle marking */
  &::after {
    content: "";
    position: absolute;
    top: 15%;
    left: 15%;
    right: 15%;
    bottom: 15%;
    border-radius: 50%;
    border: 2px solid rgba(139, 115, 85, 0.25);
  }
`;

// Versus badge in center of dohyo
const VersusBadge = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-family: "Bungee", cursive;
  font-size: clamp(0.9rem, 2.2cqw, 2.2rem);
  color: #d4af37;
  z-index: 5;
  animation: ${versusGlow} 3s ease-in-out infinite;
  user-select: none;
  letter-spacing: 0.05em;
`;

// ============================================
// PLAYER BANNERS
// ============================================

const PlayersContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(60px, 20cqw, 360px);
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 3;
`;

const PlayerBannerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${props => props.$side === 'left' ? slideInLeft : slideInRight} 0.6s ease-out ${props => props.$side === 'left' ? '0.2s' : '0.35s'} both;
`;

const PlayerBanner = styled.div`
  width: clamp(170px, 24cqw, 340px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #2d1510 20%,
    #251210 50%,
    #1f0f0a 80%,
    #150805 100%
  );
  border: 3px solid ${props => props.$hasPlayer ? '#8b7355' : '#5c4033'};
  border-radius: clamp(10px, 1.4cqw, 16px);
  overflow: hidden;
  position: relative;
  box-shadow: 
    0 10px 40px rgba(0,0,0,0.6),
    inset 0 0 30px rgba(0,0,0,0.4);
  transition: border-color 0.3s ease;
  
  /* Subtle texture */
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
        rgba(255,255,255,0.008) 1px,
        transparent 2px
      );
    pointer-events: none;
    z-index: 1;
  }
  
  /* Gold accent line on the side (human/left only; no accent on CPU/right) */
  &::after {
    display: ${props => props.$side === 'right' ? 'none' : 'block'};
    content: "";
    position: absolute;
    top: 12px;
    left: 10px;
    width: 3px;
    bottom: 12px;
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(212, 175, 55, 0.2) 20%,
      rgba(212, 175, 55, 0.35) 50%,
      rgba(212, 175, 55, 0.2) 80%,
      transparent 100%
    );
    border-radius: 2px;
  }
`;

const PlayerHeader = styled.div`
  background: linear-gradient(180deg,
    rgba(45, 21, 16, 0.98) 0%,
    rgba(26, 10, 8, 0.95) 100%
  );
  padding: clamp(6px, 1.2cqh, 18px) clamp(8px, 1.4cqw, 22px);
  border-bottom: 2px solid rgba(139, 115, 85, 0.3);
  position: relative;
  z-index: 3;
`;

const PlayerHeaderTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(2px, 0.4cqh, 8px);
`;

const PlayerStatus = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.85cqw, 0.6rem);
  color: ${props => props.$connected ? '#4ade80' : '#5c4033'};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  display: flex;
  align-items: center;
  gap: clamp(5px, 0.7cqw, 8px);
  text-shadow: 1px 1px 0 #000;
  
  &::before {
    content: "";
    width: clamp(6px, 0.8cqw, 9px);
    height: clamp(6px, 0.8cqw, 9px);
    background: ${props => props.$connected ? '#4ade80' : '#5c4033'};
    border-radius: 50%;
    ${props => props.$connected && css`
      box-shadow: 0 0 10px rgba(74, 222, 128, 0.6);
    `}
  }
`;

const PlayerRankBadge = styled.div`
  background: linear-gradient(135deg, #d4af37 0%, #8b7355 100%);
  padding: clamp(3px, 0.5cqh, 5px) clamp(10px, 1.4cqw, 16px);
  border-radius: clamp(3px, 0.5cqw, 5px);
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.7cqw, 0.5rem);
  color: #1a0a08;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
`;

const PlayerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 1.8cqw, 1.4rem);
  color: ${props => props.$hasPlayer ? '#f0ebe5' : '#5c4033'};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 
    2px 2px 0 #000,
    0 0 10px rgba(0,0,0,0.5);
`;

const PlayerAvatarArea = styled.div`
  box-sizing: border-box;
  height: clamp(120px, 30cqh, 360px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: clamp(4px, 0.8cqh, 16px);
  
  /* Flip for left player */
  ${props => props.$side === 'left' && css`
    transform: scaleX(-1);
  `}
`;

const AvatarWrapper = styled.div`
  animation: ${breathe} 2s ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const WaitingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(10px, 1.5cqh, 18px);
  
  /* Unflip text if parent is flipped */
  ${props => props.$side === 'left' && css`
    transform: scaleX(-1);
  `}
`;

const WaitingText = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.6rem, 1.1cqw, 0.85rem);
  color: #5c4033;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow: 1px 1px 0 #000;
`;

const LoadingDots = styled.div`
  display: flex;
  gap: clamp(6px, 1cqw, 12px);
`;

const Dot = styled.div`
  width: clamp(8px, 1.1cqw, 14px);
  height: clamp(8px, 1.1cqw, 14px);
  background: #d4af37;
  border-radius: 50%;
  animation: ${dotPulse} 1.4s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.2}s;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
`;

// ============================================
// FOOTER - CONTROLS
// ============================================

const ControlsFooter = styled.footer`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(6px, 1.2cqh, 20px) clamp(12px, 2.5cqw, 40px);
  background: linear-gradient(180deg,
    rgba(0, 0, 0, 0.95) 0%,
    rgba(26, 10, 8, 0.98) 100%
  );
  border-top: 3px solid #8b7355;
  position: relative;
  z-index: 10;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
  flex-shrink: 0;
`;

const ExitButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.85cqw, 0.8rem);
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  color: #e8dcc8;
  border: 2px solid #8b7355;
  border-radius: clamp(5px, 0.8cqw, 10px);
  padding: clamp(6px, 1cqh, 14px) clamp(10px, 1.8cqw, 24px);
  cursor: pointer;
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: clamp(4px, 0.8cqw, 12px);
  box-shadow: 
    0 4px 15px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.05);
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;

  &:hover {
    background: linear-gradient(180deg,
      #5c4530 0%,
      #4a3525 50%,
      #3d2817 100%
    );
    border-color: #d4af37;
    color: #f0ebe5;
    transform: translateY(-2px);
    box-shadow: 
      0 6px 20px rgba(0,0,0,0.5),
      0 0 15px rgba(212, 175, 55, 0.15),
      inset 0 1px 0 rgba(255,255,255,0.08);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const ExitIcon = styled.span`
  font-size: 1.2em;
`;

const ReadySection = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: clamp(8px, 1.5cqw, 24px);
`;

const ReadyButton = styled.button`
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  font-size: clamp(0.65rem, 1.1cqw, 1.1rem);
  background: linear-gradient(180deg,
    #5a8a3a 0%,
    #4a7a2a 50%,
    #3a6a1a 100%
  );
  color: #e8f0e0;
  border: 3px solid #6aa040;
  border-radius: clamp(5px, 0.8cqw, 10px);
  padding: clamp(7px, 1.2cqh, 18px) clamp(16px, 2.5cqw, 40px);
  cursor: pointer;
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  box-shadow: 
    0 6px 20px rgba(0,0,0,0.5),
    inset 0 1px 0 rgba(255,255,255,0.15),
    inset 0 -3px 6px rgba(0,0,0,0.2);
  text-shadow: 2px 2px 0 rgba(0,0,0,0.4);
  position: relative;
  box-sizing: border-box;
  text-align: center;
  white-space: nowrap;

  &:hover {
    background: linear-gradient(180deg,
      #6a9a4a 0%,
      #5a8a3a 50%,
      #4a7a2a 100%
    );
    border-color: #8ac060;
    transform: translateY(-3px);
    box-shadow: 
      0 10px 30px rgba(0,0,0,0.6),
      0 0 25px rgba(106, 160, 64, 0.3),
      inset 0 1px 0 rgba(255,255,255,0.2);
    color: #fff;
  }

  &:active {
    transform: translateY(-1px);
  }
`;

const CancelButton = styled(ReadyButton)`
  background: linear-gradient(180deg,
    #8a3a3a 0%,
    #6a2a2a 50%,
    #4a1a1a 100%
  );
  color: #f5e0e0;
  border-color: #a04040;
  
  &:hover {
    background: linear-gradient(180deg,
      #9a4a4a 0%,
      #7a3a3a 50%,
      #5a2a2a 100%
    );
    border-color: #c05050;
    box-shadow: 
      0 10px 30px rgba(0,0,0,0.6),
      0 0 20px rgba(160, 64, 64, 0.25),
      inset 0 1px 0 rgba(255,255,255,0.1);
  }
`;

const ReadyCount = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.95cqw, 0.9rem);
  color: ${props => props.$ready ? '#4ade80' : '#8b7355'};
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #0f0505 100%
  );
  padding: clamp(5px, 1cqh, 14px) clamp(10px, 1.5cqw, 24px);
  border: 2px solid ${props => props.$ready ? '#4ade80' : '#5c4033'};
  border-radius: clamp(6px, 1cqw, 10px);
  text-align: center;
  letter-spacing: 0.1em;
  text-shadow: 1px 1px 0 #000;
  box-sizing: border-box;
  white-space: nowrap;
  ${props => props.$ready && css`
    animation: ${readyGlow} 1.5s ease-in-out infinite;
  `}
`;

const ReadyLabel = styled.span`
  font-size: 0.55em;
  color: rgba(212, 175, 55, 0.6);
  display: block;
  margin-bottom: clamp(2px, 0.4cqh, 4px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

// ============================================
// COLOR PICKER PANEL
// ============================================

const PickerPanel = styled.div`
  display: ${props => props.$hidden ? 'none' : 'flex'};
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 1cqh, 14px);
  padding: clamp(10px, 1.4cqh, 20px) clamp(16px, 2cqw, 32px);
  background: linear-gradient(180deg,
    rgba(26, 10, 8, 0.97) 0%,
    rgba(35, 16, 12, 0.96) 40%,
    rgba(26, 10, 8, 0.97) 100%
  );
  border: 2px solid #8b7355;
  border-radius: clamp(8px, 1cqw, 14px);
  box-shadow:
    0 6px 30px rgba(0,0,0,0.7),
    inset 0 1px 0 rgba(212, 175, 55, 0.08);
  width: 88%;
  max-width: 800px;
  margin: clamp(4px, 1cqh, 16px) auto clamp(4px, 0.8cqh, 12px);
  z-index: 10;
  flex-shrink: 0;
  position: relative;

  /* Inner gold accent border */
  &::before {
    content: "";
    position: absolute;
    top: 4px;
    left: 4px;
    right: 4px;
    bottom: 4px;
    border: 1px solid rgba(212, 175, 55, 0.12);
    border-radius: clamp(5px, 0.7cqw, 10px);
    pointer-events: none;
  }
`;

const PickerTitle = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1cqw, 16px);
  width: 100%;
  justify-content: center;

  &::before, &::after {
    content: "";
    flex: 1;
    max-width: 80px;
    height: 1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(212, 175, 55, 0.4) 50%,
      transparent 100%
    );
  }
`;

const PickerTitleText = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.8cqw, 0.7rem);
  color: rgba(212, 175, 55, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.3em;
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;
`;

const PickerControlRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, 2cqw, 28px);
  width: 100%;
`;

const PickerTabGroup = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(2px, 0.3cqw, 4px);
  background: rgba(0, 0, 0, 0.3);
  border-radius: clamp(5px, 0.6cqw, 8px);
  padding: 2px;
  border: 1px solid rgba(92, 64, 51, 0.5);
`;

const PickerTab = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.75cqw, 0.65rem);
  padding: clamp(5px, 0.6cqh, 8px) clamp(12px, 1.4cqw, 20px);
  border: none;
  border-radius: clamp(4px, 0.5cqw, 7px);
  background: ${props => props.$active
    ? 'linear-gradient(180deg, #5c4033 0%, #3d2817 100%)'
    : 'transparent'};
  color: ${props => props.$active ? '#d4af37' : '#665544'};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  text-shadow: 1px 1px 0 #000;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: ${props => props.$active
    ? '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
    : 'none'};

  &:hover {
    color: ${props => props.$active ? '#d4af37' : '#998877'};
    background: ${props => props.$active
      ? 'linear-gradient(180deg, #5c4033 0%, #3d2817 100%)'
      : 'rgba(92, 64, 51, 0.2)'};
  }
`;

const PickerDivider = styled.div`
  width: 1px;
  height: clamp(18px, 2.5cqh, 28px);
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(139, 115, 85, 0.4) 50%,
    transparent 100%
  );
`;

const SelectedColorInfo = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(6px, 0.8cqw, 12px);
`;

const SelectedColorPreview = styled.div`
  width: clamp(18px, 2cqw, 26px);
  height: clamp(18px, 2cqw, 26px);
  border-radius: 50%;
  background: ${props => props.$gradient || props.$color || '#888'};
  border: 2px solid rgba(212, 175, 55, 0.5);
  box-shadow:
    0 0 8px rgba(0,0,0,0.5),
    inset 0 1px 2px rgba(255,255,255,0.15);
  flex-shrink: 0;
`;

const SelectedColorName = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.55rem, 0.85cqw, 0.75rem);
  color: #e8dcc8;
  text-shadow: 1px 1px 0 #000;
  text-transform: uppercase;
  letter-spacing: 0.15em;
`;

const SwatchContainer = styled.div`
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: clamp(3px, 0.4cqw, 7px);
  width: 100%;
  padding: clamp(4px, 0.5cqh, 8px) 0;
`;

const ColorSwatch = styled.button`
  width: clamp(22px, 2.5cqw, 32px);
  height: clamp(22px, 2.5cqw, 32px);
  border-radius: 50%;
  border: 2.5px solid ${props => props.$selected ? '#d4af37' : 'rgba(0,0,0,0.3)'};
  background: ${props => props.$gradient || props.$color};
  cursor: ${props => props.$taken ? 'not-allowed' : 'pointer'};
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: ${props => props.$selected
    ? '0 0 0 2px rgba(212, 175, 55, 0.3), 0 0 12px rgba(212, 175, 55, 0.25), 0 2px 6px rgba(0,0,0,0.5)'
    : '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.1)'};
  position: relative;
  flex-shrink: 0;

  ${props => props.$taken && css`
    opacity: 0.4;
    &::after {
      content: "✕";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: clamp(10px, 1.2cqw, 16px);
      color: #ff4444;
      text-shadow: 0 0 5px rgba(0,0,0,0.9);
      border-radius: inherit;
    }
  `}

  &:hover {
    transform: ${props => props.$taken ? 'none' : 'scale(1.2)'};
    border-color: ${props => props.$taken ? 'rgba(0,0,0,0.3)' : (props.$selected ? '#d4af37' : 'rgba(212, 175, 55, 0.5)')};
  }

  &:active {
    transform: ${props => props.$taken ? 'none' : 'scale(0.92)'};
  }
`;

const DifficultyListContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: clamp(4px, 0.8cqh, 12px);
  padding: clamp(4px, 0.8cqh, 12px) clamp(6px, 0.8cqw, 12px);
  height: clamp(120px, 30cqh, 360px);
  min-height: 0;
`;

const DifficultyOptionRow = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(10px, 1.2cqw, 14px);
  min-height: 0;
  background: ${props => props.$selected
    ? 'linear-gradient(180deg, rgba(139, 115, 85, 0.4) 0%, rgba(92, 64, 51, 0.35) 100%)'
    : 'linear-gradient(180deg, rgba(26, 10, 8, 0.6) 0%, rgba(15, 5, 3, 0.5) 100%)'};
  border: 2px solid ${props => props.$selected ? '#8b7355' : '#5c4033'};
  border-radius: clamp(5px, 0.7cqw, 8px);
  cursor: ${props => props.$available ? 'pointer' : 'default'};
  opacity: ${props => props.$available ? 1 : 0.7};
  transition: border-color 0.2s ease, background 0.2s ease;
`;

const DifficultyLabel = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.1cqw, 0.9rem);
  color: ${props => props.$selected ? '#d4af37' : '#8b7355'};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-shadow: 1px 1px 0 #000;
`;

const SoonBadge = styled.span`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: 0.65em;
  color: #666;
  margin-left: auto;
  padding-left: 1em;
  letter-spacing: 0.08em;
`;

// Loading Overlay for sprite preloading
const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const LoadingText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.5rem, 3cqw, 2.5rem);
  color: #d4af37;
  text-shadow: 2px 2px 0 #000, 0 0 20px rgba(212, 175, 55, 0.5);
  margin-bottom: 20px;
  animation: ${css`
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `};
  animation: pulse 1.5s ease-in-out infinite;
`;

const LoadingSpinner = styled.div`
  width: 60px;
  height: 60px;
  border: 4px solid rgba(212, 175, 55, 0.2);
  border-top: 4px solid #d4af37;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// ============================================
// COLORED PLAYER PREVIEW COMPONENT
// ============================================

const PreviewImage = styled.img`
  height: 90%;
  max-height: clamp(100px, 28cqh, 340px);
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6));
`;

/**
 * ColoredPlayerPreview - Shows a recolored penguin sprite based on selected color
 */
function ColoredPlayerPreview({ color, bodyColor }) {
  const [imageSrc, setImageSrc] = useState(pumo);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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

    recolorImage(pumo, BLUE_COLOR_RANGES, needsMawashiRecolor ? color : SPRITE_BASE_COLOR, options)
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

// ============================================
// LOBBY COMPONENT
// ============================================

// Only HARD is implemented for VS CPU; others show "Soon"
const CPU_DIFFICULTIES = ["EASY", "NORMAL", "HARD", "IMPOSSIBLE"];
const AVAILABLE_CPU_DIFFICULTY = "HARD";

const Lobby = ({ rooms, setRooms, roomName, handleGame, setCurrentPage, onLeaveDohyo, isCPUMatch = false }) => {
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const { socket } = useContext(SocketContext);
  
  // Color customization - using global context so colors persist to game
  const { player1Color, player2Color, setPlayer1Color, setPlayer2Color, player1BodyColor, player2BodyColor, setPlayer1BodyColor, setPlayer2BodyColor } = usePlayerColors();
  
  // Tab state for color picker: "body" (default first) or "mawashi"
  const [colorTab, setColorTab] = useState("body");
  
  // Determine which player slot the current user is in (0 = East/Player1, 1 = West/Player2)
  const myPlayerIndex = players.findIndex(p => p.id === socket.id);
  const isPlayer1 = myPlayerIndex === 0;
  const isPlayer2 = myPlayerIndex === 1;
  
  // Get colors from server player data (synced across all clients)
  const serverPlayer1Color = players[0]?.mawashiColor || SPRITE_BASE_COLOR;
  const serverPlayer2Color = players[1]?.mawashiColor || "#D94848";
  const serverPlayer1BodyColor = players[0]?.bodyColor || null;
  const serverPlayer2BodyColor = players[1]?.bodyColor || null;
  
  // PvP: other player's color is not selectable (only when both players present and not CPU match)
  const isPvP = !isCPUMatch && players[0]?.fighter && players[1]?.fighter && !players[1]?.isCPU;
  const otherPlayerMawashi = isPlayer1 ? serverPlayer2Color : serverPlayer1Color;
  const otherPlayerBody = isPlayer1 ? serverPlayer2BodyColor : serverPlayer1BodyColor;
  const isColorTakenByOther = (hex) => isPvP && otherPlayerMawashi && hex?.toLowerCase() === otherPlayerMawashi.toLowerCase();
  const isBodyColorTakenByOther = (hex) => isPvP && hex !== null && otherPlayerBody !== null && hex?.toLowerCase() === otherPlayerBody?.toLowerCase();

  const myMawashiColor = isPlayer1 ? serverPlayer1Color : serverPlayer2Color;
  const myBodyColor = isPlayer1 ? serverPlayer1BodyColor : serverPlayer2BodyColor;
  
  // Mawashi color options (default + Club Penguin-inspired warm palette + special patterns)
  const colorOptions = [
    { name: "Default", hex: SPRITE_BASE_COLOR },
    { name: "Graphite", hex: "#525252" },
    { name: "Cobalt", hex: "#3B5EB0" },
    { name: "Orchid", hex: "#A85DBF" },
    { name: "Emerald", hex: "#2E9E5A" },
    { name: "Teal", hex: "#1A7A8A" },
    { name: "Tangerine", hex: "#E8913A" },
    { name: "Coral", hex: "#E87070" },
    { name: "Gold", hex: "#D4A520" },
    { name: "Caramel", hex: "#A07348" },
    { name: "Pewter", hex: "#6E8495" },
    { name: "Powder", hex: "#88C4D8" },
    { name: "Scarlet", hex: "#D94848" },
    { name: "Rainbow", hex: "rainbow", gradient: "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)" },
    { name: "Fire", hex: "fire", gradient: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)" },
    { name: "Vaporwave", hex: "vaporwave", gradient: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)" },
    { name: "Camo", hex: "camo", gradient: "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)" },
    { name: "Galaxy", hex: "galaxy", gradient: "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)" },
    { name: "Shiny Gold", hex: "gold", gradient: "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)" },
  ];

  // Body color options (Club Penguin-inspired warm palette, no special patterns)
  const bodyColorOptions = [
    { name: "Default", hex: null, gradient: "linear-gradient(135deg, #888 0%, #aaa 50%, #888 100%)" },
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

  const selectedMawashiOption = colorOptions.find(c => c.hex === myMawashiColor);
  const selectedBodyOption = bodyColorOptions.find(c => c.hex === myBodyColor);
  const selectedMawashiName = selectedMawashiOption?.name || "Default";
  const selectedBodyName = selectedBodyOption?.name || "Default";
  const activeColorName = colorTab === "body" ? selectedBodyName : selectedMawashiName;
  const activeColorHex = colorTab === "body" ? (myBodyColor || "#888") : (myMawashiColor || SPRITE_BASE_COLOR);
  const activeColorGradient = colorTab === "body" ? selectedBodyOption?.gradient : selectedMawashiOption?.gradient;
  
  // Handle mawashi color selection
  const handleColorSelect = (color) => {
    if (myPlayerIndex === -1) return;
    if (isColorTakenByOther(color)) return;
    
    socket.emit("update_mawashi_color", {
      roomId: roomName,
      playerId: socket.id,
      color,
    });
  };

  // Handle body color selection
  const handleBodyColorSelect = (color) => {
    if (myPlayerIndex === -1) return;
    if (isBodyColorTakenByOther(color)) return;
    
    socket.emit("update_body_color", {
      roomId: roomName,
      playerId: socket.id,
      color,
    });
  };
  
  // Sync server colors to global context (for use in game)
  useEffect(() => {
    if (serverPlayer1Color) setPlayer1Color(serverPlayer1Color);
    if (serverPlayer2Color) setPlayer2Color(serverPlayer2Color);
  }, [serverPlayer1Color, serverPlayer2Color, setPlayer1Color, setPlayer2Color]);

  useEffect(() => {
    setPlayer1BodyColor(serverPlayer1BodyColor);
    setPlayer2BodyColor(serverPlayer2BodyColor);
  }, [serverPlayer1BodyColor, serverPlayer2BodyColor, setPlayer1BodyColor, setPlayer2BodyColor]);

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
        if (payload.players[0]?.mawashiColor) setPlayer1Color(payload.players[0].mawashiColor);
        if (payload.players[1]?.mawashiColor) setPlayer2Color(payload.players[1].mawashiColor);
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
                    mawashiColor: payload.players[i]?.mawashiColor ?? rp.mawashiColor,
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
  }, [roomName, socket, handleGame, setRooms, setPlayer1Color, setPlayer2Color, setPlayer1BodyColor, setPlayer2BodyColor]);

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
    const isReadyAction = e.target.textContent === "READY";
    setReady(isReadyAction);
    socket.emit("ready_count", {
      playerId: socket.id,
      isReady: isReadyAction,
      roomId: roomName,
    });
  };

  return (
    <LobbyContainer>
      <BackgroundImage />
      <Vignette />
      <Snowfall intensity={20} showFrost={true} zIndex={2} />
      
      {/* Decorative top elements */}
      <TopDecoration>
        <HangingRope>
          <RopeSnowCap />
        </HangingRope>
        <LeftLantern $delay={0}>
          <LanternSnowCap />
        </LeftLantern>
        <CenterLantern $delay={0.5}>
          <LanternSnowCap />
        </CenterLantern>
        <RightLantern $delay={1}>
          <LanternSnowCap />
        </RightLantern>
      </TopDecoration>
      
      {/* Tournament Banner Header */}
      <Header>
        <TournamentBanner>
          <BannerHangingBar>
            <SnowCap />
            <IcicleRow $bottom="-8px">
              <Icicle $w={2} $h={6} />
              <Icicle $w={3} $h={10} />
              <Icicle $w={2} $h={7} />
              <Icicle $w={3} $h={12} />
              <Icicle $w={2} $h={8} />
            </IcicleRow>
          </BannerHangingBar>
          <BannerBody>
            <RoomCodeSection>
              <RoomLabel>Dohyo Code</RoomLabel>
              <RoomCode>{isCPUMatch ? "VS CPU" : roomName}</RoomCode>
            </RoomCodeSection>
            <BannerTassels>
              <Tassel $delay={0} />
              <Tassel $delay={1} />
            </BannerTassels>
          </BannerBody>
        </TournamentBanner>
      </Header>

      {/* Arena Section with Dohyo Ring */}
      <ArenaSection>
        <ArenaLayout>
          <DohyoContainer>
            <DohyoRing />
            <VersusBadge>VS</VersusBadge>
            
            <PlayersContainer>
              {/* Player 1 (Left/East) */}
              <PlayerBannerWrapper $side="left">
                <PlayerBanner $hasPlayer={!!players[0]?.fighter} $side="left">
                  <PlayerHeader>
                    <PlayerHeaderTop>
                      <PlayerStatus $connected={!!players[0]?.fighter}>
                        {players[0]?.fighter ? "Connected" : "Waiting"}
                      </PlayerStatus>
                      <PlayerRankBadge>East</PlayerRankBadge>
                    </PlayerHeaderTop>
                    <PlayerName $hasPlayer={!!players[0]?.fighter}>
                      {players[0]?.isCPU ? "CPU" : (players[0]?.fighter || "Awaiting...")}
                    </PlayerName>
                  </PlayerHeader>
                  <PlayerAvatarArea $side="left">
                    {players[0]?.fighter ? (
                      <AvatarWrapper>
                        <ColoredPlayerPreview 
                          color={serverPlayer1Color}
                          bodyColor={serverPlayer1BodyColor}
                        />
                      </AvatarWrapper>
                    ) : (
                      <WaitingState $side="left">
                        <WaitingText>Waiting For Pumo</WaitingText>
                        <LoadingDots>
                          <Dot $delay={0} />
                          <Dot $delay={1} />
                          <Dot $delay={2} />
                        </LoadingDots>
                      </WaitingState>
                    )}
                  </PlayerAvatarArea>
                </PlayerBanner>
              </PlayerBannerWrapper>

              {/* Player 2 (Right/West) -- VS CPU: difficulty selector; online: avatar + colors */}
              <PlayerBannerWrapper $side="right">
                <PlayerBanner $hasPlayer={!!players[1]?.fighter} $side="right">
                  <PlayerHeader>
                    <PlayerHeaderTop>
                      <PlayerStatus $connected={!!players[1]?.fighter}>
                        {players[1]?.fighter ? "Connected" : "Waiting"}
                      </PlayerStatus>
                      <PlayerRankBadge>West</PlayerRankBadge>
                    </PlayerHeaderTop>
                    <PlayerName $hasPlayer={!!players[1]?.fighter}>
                      {players[1]?.isCPU ? "CPU" : (players[1]?.fighter || "Opponent")}
                    </PlayerName>
                  </PlayerHeader>
                  {isCPUMatch ? (
                    <DifficultyListContainer>
                      {CPU_DIFFICULTIES.map((diff) => {
                        const available = diff === AVAILABLE_CPU_DIFFICULTY;
                        const selected = diff === AVAILABLE_CPU_DIFFICULTY;
                        return (
                          <DifficultyOptionRow
                            key={diff}
                            $available={available}
                            $selected={selected}
                          >
                            <DifficultyLabel $selected={selected}>{diff}</DifficultyLabel>
                            {!available && <SoonBadge>Soon</SoonBadge>}
                          </DifficultyOptionRow>
                        );
                      })}
                    </DifficultyListContainer>
                  ) : (
                    <PlayerAvatarArea $side="right">
                      {players[1]?.fighter ? (
                        <AvatarWrapper>
                          <ColoredPlayerPreview 
                            color={serverPlayer2Color}
                            bodyColor={serverPlayer2BodyColor}
                          />
                        </AvatarWrapper>
                      ) : (
                        <WaitingState $side="right">
                          <WaitingText>Waiting For Pumo</WaitingText>
                          <LoadingDots>
                            <Dot $delay={0} />
                            <Dot $delay={1} />
                            <Dot $delay={2} />
                          </LoadingDots>
                        </WaitingState>
                      )}
                    </PlayerAvatarArea>
                  )}
                </PlayerBanner>
              </PlayerBannerWrapper>
            </PlayersContainer>
          </DohyoContainer>
        </ArenaLayout>
      </ArenaSection>

      {/* Color Picker Panel */}
      <PickerPanel $hidden={myPlayerIndex === -1}>
        <PickerTitle>
          <PickerTitleText>Customize</PickerTitleText>
        </PickerTitle>

        <PickerControlRow>
          <PickerTabGroup>
            <PickerTab $active={colorTab === "body"} onClick={() => setColorTab("body")}>Body</PickerTab>
            <PickerTab $active={colorTab === "mawashi"} onClick={() => setColorTab("mawashi")}>Belt</PickerTab>
          </PickerTabGroup>

          <PickerDivider />

          <SelectedColorInfo>
            <SelectedColorPreview $color={activeColorHex} $gradient={activeColorGradient} />
            <SelectedColorName>{activeColorName}</SelectedColorName>
          </SelectedColorInfo>
        </PickerControlRow>

        <SwatchContainer>
          {colorTab === "mawashi" ? (
            colorOptions.map((color) => {
              const taken = isColorTakenByOther(color.hex);
              return (
                <ColorSwatch
                  key={color.name}
                  $color={color.hex}
                  $gradient={color.gradient}
                  $selected={myMawashiColor === color.hex}
                  $taken={taken}
                  onClick={() => !taken && handleColorSelect(color.hex)}
                  title={taken ? `Taken by opponent` : color.name}
                />
              );
            })
          ) : (
            bodyColorOptions.map((color) => {
              const taken = isBodyColorTakenByOther(color.hex);
              return (
                <ColorSwatch
                  key={color.name}
                  $color={color.hex || "#888"}
                  $gradient={color.gradient}
                  $selected={myBodyColor === color.hex}
                  $taken={taken}
                  onClick={() => !taken && handleBodyColorSelect(color.hex)}
                  title={taken ? `Taken by opponent` : color.name}
                />
              );
            })
          )}
        </SwatchContainer>
      </PickerPanel>

      {/* Controls Footer */}
      <ControlsFooter>
        <ExitButton
          onClick={handleLeaveDohyo}
          onMouseEnter={playButtonHoverSound}
        >
          <ExitIcon>←</ExitIcon>
          Leave Dohyo
        </ExitButton>
        
        <ReadySection>
          {canShowReadyButton && (
            <>
              {ready ? (
                <CancelButton
                  onClick={(e) => {
                    handleReady(e);
                    playButtonPressSound();
                  }}
                  onMouseEnter={playButtonHoverSound}
                >
                  CANCEL
                </CancelButton>
              ) : (
                <ReadyButton
                  onClick={(e) => {
                    handleReady(e);
                    playButtonPressSound2();
                  }}
                  onMouseEnter={playButtonHoverSound}
                >
                  READY
                </ReadyButton>
              )}
              {!isCPUMatch && (
                <ReadyCount $ready={readyCount > 0}>
                  <ReadyLabel>Fighters Ready</ReadyLabel>
                  {readyCount} / 2
                </ReadyCount>
              )}
            </>
          )}
        </ReadySection>
      </ControlsFooter>
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
