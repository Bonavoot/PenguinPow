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
  SPRITE_BASE_COLOR,
} from "../utils/SpriteRecolorizer";
// Base sprite for recoloring preview (UNIFIED: all sprites are blue)
import pumo2 from "../assets/pumo2.png";

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
  width: 100vw;
  height: 100vh;
  min-height: 500px;
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
  height: clamp(60px, 10vh, 100px);
  z-index: 5;
  pointer-events: none;
`;

const HangingRope = styled.div`
  position: absolute;
  top: clamp(20px, 3vh, 35px);
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
    width: clamp(12px, 2vw, 20px);
    height: clamp(12px, 2vw, 20px);
    background: radial-gradient(circle at 30% 30%, #d4af37, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
  }
  &::before { left: 0; }
  &::after { right: 0; }
`;

const Lantern = styled.div`
  position: absolute;
  top: clamp(28px, 4vh, 45px);
  width: clamp(28px, 4vw, 45px);
  height: clamp(42px, 6vh, 70px);
  background: linear-gradient(180deg,
    #cc3300 0%,
    #aa2200 50%,
    #881100 100%
  );
  border-radius: clamp(4px, 0.6vw, 8px);
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
    font-size: clamp(12px, 1.8vw, 20px);
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
    font-size: clamp(14px, 2vw, 22px);
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
  padding: clamp(90px, 14vh, 140px) clamp(20px, 3vw, 40px) clamp(4px, 1vh, 10px);
  margin-bottom: clamp(-20px, -3vh, -30px);
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
  height: clamp(12px, 1.8vh, 18px);
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
    width: clamp(8px, 1.2vw, 14px);
    height: clamp(8px, 1.2vw, 14px);
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
  border-radius: 0 0 clamp(6px, 1vw, 12px) clamp(6px, 1vw, 12px);
  padding: clamp(8px, 1.5vh, 16px) clamp(18px, 3vw, 40px);
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
    border-radius: 0 0 clamp(6px, 1vw, 12px) clamp(6px, 1vw, 12px);
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
  width: clamp(5px, 0.8vw, 8px);
  height: clamp(18px, 2.8vh, 28px);
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
  gap: clamp(4px, 0.6vh, 8px);
`;

const RoomLabel = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.85vw, 0.6rem);
  color: #8b7355;
  text-transform: uppercase;
  letter-spacing: 0.25em;
  text-shadow: 1px 1px 0 #000;
`;

const RoomCode = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.1rem, 2.2vw, 1.6rem);
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
  padding: clamp(4px, 1vh, 12px) clamp(8px, 1vw, 16px);
  position: relative;
  z-index: 2;
  min-height: 0;
  overflow: hidden;
`;

const ArenaLayout = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.5vw, 20px);
  width: 100%;
  max-width: 1400px;
  height: 100%;
`;

const DohyoContainer = styled.div`
  position: relative;
  flex: 1;
  max-width: 1000px;
  height: 100%;
  min-height: clamp(200px, 35vh, 400px);
`;

// The circular dohyo ring
const DohyoRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: clamp(140px, 22vw, 280px);
  height: clamp(140px, 22vw, 280px);
  border-radius: 50%;
  background: radial-gradient(
    circle at center,
    #1a0a08 0%,
    #150805 40%,
    #0f0503 80%,
    #0a0505 100%
  );
  border: clamp(4px, 0.8vw, 10px) solid transparent;
  background-clip: padding-box;
  animation: ${dohyoPulse} 4s ease-in-out infinite;
  
  /* Ring border effect */
  &::before {
    position: absolute;
    top: -clamp(6px, 1vw, 12px);
    left: -clamp(6px, 1vw, 12px);
    right: -clamp(6px, 1vw, 12px);
    bottom: -clamp(6px, 1vw, 12px);
    border-radius: 50%;
    border: clamp(3px, 0.6vw, 7px) solid;
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
  font-size: clamp(1.8rem, 4.5vw, 3.5rem);
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
  justify-content: space-between;
  align-items: center;
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
  width: clamp(160px, 22vw, 280px);
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
  border-radius: clamp(10px, 1.4vw, 16px);
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
  padding: clamp(10px, 1.5vh, 18px) clamp(12px, 1.8vw, 22px);
  border-bottom: 2px solid rgba(139, 115, 85, 0.3);
  position: relative;
  z-index: 3;
`;

const PlayerHeaderTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(4px, 0.7vh, 8px);
`;

const PlayerStatus = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.85vw, 0.6rem);
  color: ${props => props.$connected ? '#4ade80' : '#5c4033'};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  display: flex;
  align-items: center;
  gap: clamp(5px, 0.7vw, 8px);
  text-shadow: 1px 1px 0 #000;
  
  &::before {
    content: "";
    width: clamp(6px, 0.8vw, 9px);
    height: clamp(6px, 0.8vw, 9px);
    background: ${props => props.$connected ? '#4ade80' : '#5c4033'};
    border-radius: 50%;
    ${props => props.$connected && css`
      box-shadow: 0 0 10px rgba(74, 222, 128, 0.6);
    `}
  }
`;

const PlayerRankBadge = styled.div`
  background: linear-gradient(135deg, #d4af37 0%, #8b7355 100%);
  padding: clamp(3px, 0.5vh, 5px) clamp(10px, 1.4vw, 16px);
  border-radius: clamp(3px, 0.5vw, 5px);
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.7vw, 0.5rem);
  color: #1a0a08;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
`;

const PlayerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 1.8vw, 1.4rem);
  color: ${props => props.$hasPlayer ? '#f0ebe5' : '#5c4033'};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 
    2px 2px 0 #000,
    0 0 10px rgba(0,0,0,0.5);
`;

const PlayerAvatarArea = styled.div`
  box-sizing: border-box;
  height: clamp(140px, 28vh, 280px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: clamp(8px, 1.2vh, 16px);
  
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
  gap: clamp(10px, 1.5vh, 18px);
  
  /* Unflip text if parent is flipped */
  ${props => props.$side === 'left' && css`
    transform: scaleX(-1);
  `}
`;

const WaitingText = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.6rem, 1.1vw, 0.85rem);
  color: #5c4033;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow: 1px 1px 0 #000;
`;

const LoadingDots = styled.div`
  display: flex;
  gap: clamp(6px, 1vw, 12px);
`;

const Dot = styled.div`
  width: clamp(8px, 1.1vw, 14px);
  height: clamp(8px, 1.1vw, 14px);
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
  padding: clamp(10px, 1.8vh, 20px) clamp(16px, 3vw, 40px);
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
  font-size: clamp(0.55rem, 0.95vw, 0.8rem);
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  color: #e8dcc8;
  border: 2px solid #8b7355;
  border-radius: clamp(6px, 1vw, 10px);
  padding: clamp(8px, 1.4vh, 14px) clamp(14px, 2.2vw, 24px);
  cursor: pointer;
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: clamp(6px, 1vw, 12px);
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
  gap: clamp(12px, 2vw, 24px);
`;

const ReadyButton = styled.button`
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  font-size: clamp(0.75rem, 1.3vw, 1.1rem);
  background: linear-gradient(180deg,
    #5a8a3a 0%,
    #4a7a2a 50%,
    #3a6a1a 100%
  );
  color: #e8f0e0;
  border: 3px solid #6aa040;
  border-radius: clamp(6px, 1vw, 10px);
  padding: clamp(10px, 1.5vh, 18px) clamp(24px, 3vw, 40px);
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
  font-size: clamp(0.65rem, 1.1vw, 0.9rem);
  color: ${props => props.$ready ? '#4ade80' : '#8b7355'};
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #0f0505 100%
  );
  padding: clamp(8px, 1.2vh, 14px) clamp(16px, 2vw, 24px);
  border: 2px solid ${props => props.$ready ? '#4ade80' : '#5c4033'};
  border-radius: clamp(6px, 1vw, 10px);
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
  margin-bottom: clamp(2px, 0.4vh, 4px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

// Side Color Picker - positioned on the sides of the arena
const SideColorPicker = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 1vh, 10px);
  padding: clamp(8px, 1.2vh, 14px) clamp(6px, 0.8vw, 12px);
  background: linear-gradient(180deg,
    rgba(26, 10, 8, 0.95) 0%,
    rgba(45, 21, 16, 0.9) 50%,
    rgba(26, 10, 8, 0.95) 100%
  );
  border: 2px solid ${props => props.$isOwn ? '#8b7355' : '#5c4033'};
  border-radius: clamp(8px, 1vw, 12px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  opacity: ${props => props.$hidden ? 0 : (props.$isOwn ? 1 : 0.6)};
  visibility: ${props => props.$hidden ? 'hidden' : 'visible'};
  pointer-events: ${props => props.$hidden ? 'none' : (props.$isOwn ? 'auto' : 'none')};
  flex-shrink: 0;
  min-width: clamp(50px, 6vw, 80px);
`;

const ColorPickerTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.65vw, 0.55rem);
  color: ${props => props.$isOwn ? '#d4af37' : '#666'};
  text-shadow: 1px 1px 0 #000;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  text-align: center;
  line-height: 1.3;
`;

const ColorSwatchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: clamp(4px, 0.5vw, 6px);
`;

const ColorSwatch = styled.button`
  width: clamp(22px, 2.8vw, 32px);
  height: clamp(22px, 2.8vw, 32px);
  border-radius: 4px;
  border: 2px solid ${props => props.$selected ? '#fff' : 'transparent'};
  background-color: ${props => props.$color};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: transform 0.1s, border-color 0.1s;
  box-shadow: ${props => props.$selected ? '0 0 8px rgba(255, 255, 255, 0.8)' : '0 2px 4px rgba(0,0,0,0.3)'};
  opacity: ${props => props.$disabled ? 0.5 : 1};

  &:hover {
    transform: ${props => props.$disabled ? 'none' : 'scale(1.15)'};
    border-color: ${props => props.$disabled ? 'transparent' : 'rgba(255, 255, 255, 0.5)'};
  }

  &:active {
    transform: ${props => props.$disabled ? 'none' : 'scale(0.95)'};
  }
`;

const YourColorLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.6vw, 0.5rem);
  color: #4ade80;
  text-shadow: 1px 1px 0 #000;
  text-transform: uppercase;
  text-align: center;
`;

// CPU difficulty selector (VS CPU lobby) — same total height as PlayerAvatarArea so cards match
const DifficultyListContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: clamp(8px, 1.4vh, 14px);
  padding: clamp(6px, 1vh, 12px) clamp(8px, 1vw, 12px);
  height: clamp(140px, 28vh, 280px);
  min-height: 0;
`;

const DifficultyOptionRow = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(10px, 1.2vw, 14px);
  min-height: 0;
  background: ${props => props.$selected
    ? 'linear-gradient(180deg, rgba(139, 115, 85, 0.4) 0%, rgba(92, 64, 51, 0.35) 100%)'
    : 'linear-gradient(180deg, rgba(26, 10, 8, 0.6) 0%, rgba(15, 5, 3, 0.5) 100%)'};
  border: 2px solid ${props => props.$selected ? '#8b7355' : '#5c4033'};
  border-radius: clamp(5px, 0.7vw, 8px);
  cursor: ${props => props.$available ? 'pointer' : 'default'};
  opacity: ${props => props.$available ? 1 : 0.7};
  transition: border-color 0.2s ease, background 0.2s ease;
`;

const DifficultyLabel = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.1vw, 0.9rem);
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
  font-size: clamp(1.5rem, 3vw, 2.5rem);
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
  height: clamp(130px, 26vh, 260px);
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6));
`;

/**
 * ColoredPlayerPreview - Shows a recolored penguin sprite based on selected color
 */
function ColoredPlayerPreview({ color }) {
  const [imageSrc, setImageSrc] = useState(pumo2);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  
  useEffect(() => {
    // If color is the sprite base color (blue), no recoloring needed
    if (!color || color === SPRITE_BASE_COLOR) {
      setImageSrc(pumo2);
      return;
    }
    
    // Recolor the blue sprite to the selected color
    recolorImage(pumo2, BLUE_COLOR_RANGES, color)
      .then((recolored) => {
        if (mountedRef.current) {
          setImageSrc(recolored);
        }
      })
      .catch((error) => {
        console.error("Failed to recolor preview:", error);
        if (mountedRef.current) {
          setImageSrc(pumo2);
        }
      });
  }, [color]);
  
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
  const { player1Color, player2Color, setPlayer1Color, setPlayer2Color } = usePlayerColors();
  
  // Determine which player slot the current user is in (0 = East/Player1, 1 = West/Player2)
  const myPlayerIndex = players.findIndex(p => p.id === socket.id);
  const isPlayer1 = myPlayerIndex === 0;
  const isPlayer2 = myPlayerIndex === 1;
  
  // Get colors from server player data (synced across all clients) — P1 light blue, P2 red defaults
  const serverPlayer1Color = players[0]?.mawashiColor || "#5BC0DE";
  const serverPlayer2Color = players[1]?.mawashiColor || "#DC143C";
  
  // PvP: other player's color is not selectable (only when both players present and not CPU match)
  const isPvP = !isCPUMatch && players[0]?.fighter && players[1]?.fighter && !players[1]?.isCPU;
  const otherPlayerColor = isPlayer1 ? serverPlayer2Color : serverPlayer1Color;
  const isColorTakenByOther = (hex) => isPvP && otherPlayerColor && hex?.toLowerCase() === otherPlayerColor.toLowerCase();
  
  // Color options
  const colorOptions = [
    { name: "Black", hex: "#252525" },
    { name: "Navy", hex: "#000080" },
    { name: "Purple", hex: "#9932CC" },
    { name: "Green", hex: "#32CD32" },
    { name: "Red", hex: "#DC143C" },
    { name: "Orange", hex: "#FF8C00" },
    { name: "Pink", hex: "#FFB6C1" },
    { name: "Gold", hex: "#FFD700" },
    { name: "Brown", hex: "#5D3A1A" },
    { name: "Silver", hex: "#A8A8A8" },
    { name: "Light Blue", hex: "#5BC0DE" },
    { name: "Maroon", hex: "#800000" },
  ];
  
  // Handle color selection - emits to server (no-op if color is other player's in PvP)
  const handleColorSelect = (color) => {
    if (myPlayerIndex === -1) return; // Not in room yet
    if (isColorTakenByOther(color)) return; // PvP: can't pick opponent's color
    
    socket.emit("update_mawashi_color", {
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

  const currentRoom = rooms.find((room) => room.id === roomName);
  const playerCount = currentRoom ? currentRoom.players.length : 0;
  const canShowReadyButton = isCPUMatch || playerCount > 1;

  useEffect(() => {
    socket.emit("lobby", { roomId: roomName });
    socket.on("lobby", (playerData) => {
      console.log("Received lobby data:", playerData);
      setPlayers(playerData);
    });

    socket.on("player_left", () => {
      console.log("Player left event received");
      setReady(false);
      setReadyCount(0);
    });

    socket.on("ready_count", (count) => {
      console.log("ready count activated");
      setReadyCount(count);
    });

    socket.on("initial_game_start", (payload) => {
      console.log("game start - navigating to game (preloading handled in Game.jsx)...");
      // Apply server player data (including mawashiColor) before navigating so PreMatchScreen always shows correct colors
      if (payload?.players && Array.isArray(payload.players) && setRooms) {
        const roomId = payload.roomId || roomName;
        if (payload.players[0]?.mawashiColor) setPlayer1Color(payload.players[0].mawashiColor);
        if (payload.players[1]?.mawashiColor) setPlayer2Color(payload.players[1].mawashiColor);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  players: r.players.map((rp, i) => ({
                    ...rp,
                    ...(payload.players[i] || {}),
                    mawashiColor: payload.players[i]?.mawashiColor ?? rp.mawashiColor,
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
  }, [roomName, socket, handleGame, setRooms, setPlayer1Color, setPlayer2Color]);

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
          {/* Left Side Color Picker (Player 1) */}
          {players[0]?.fighter && (
            <SideColorPicker $isOwn={isPlayer1}>
              {isPlayer1 && <YourColorLabel>Your Color</YourColorLabel>}
              <ColorPickerTitle $isOwn={isPlayer1}>
                {isPlayer1 ? "Mawashi" : "P1 Color"}
              </ColorPickerTitle>
              <ColorSwatchGrid>
                {colorOptions.map((color) => {
                  const takenByOther = isColorTakenByOther(color.hex);
                  return (
                    <ColorSwatch
                      key={color.name}
                      $color={color.hex}
                      $selected={serverPlayer1Color === color.hex}
                      $disabled={!isPlayer1 || takenByOther}
                      onClick={() => isPlayer1 && !takenByOther && handleColorSelect(color.hex)}
                      title={takenByOther ? "Opponent's color" : color.name}
                    />
                  );
                })}
              </ColorSwatchGrid>
            </SideColorPicker>
          )}
          
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

              {/* Player 2 (Right/West) — VS CPU: difficulty selector; online: avatar + colors */}
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
          
          {/* Right Side Color Picker (Player 2) — always in layout for alignment; hidden in VS CPU or until opponent joins (online) */}
          {(players[1]?.fighter || !isCPUMatch) && (
            <SideColorPicker $isOwn={isPlayer2} $hidden={isCPUMatch || !players[1]?.fighter}>
              {isPlayer2 && <YourColorLabel>Your Color</YourColorLabel>}
              <ColorPickerTitle $isOwn={isPlayer2}>
                {isPlayer2 ? "Mawashi" : "P2 Color"}
              </ColorPickerTitle>
              <ColorSwatchGrid>
                {colorOptions.map((color) => {
                  const takenByOther = isColorTakenByOther(color.hex);
                  return (
                    <ColorSwatch
                      key={color.name}
                      $color={color.hex}
                      $selected={serverPlayer2Color === color.hex}
                      $disabled={!isPlayer2 || takenByOther}
                      onClick={() => isPlayer2 && !takenByOther && handleColorSelect(color.hex)}
                      title={takenByOther ? "Opponent's color" : color.name}
                    />
                  );
                })}
              </ColorSwatchGrid>
            </SideColorPicker>
          )}
        </ArenaLayout>
      </ArenaSection>

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
