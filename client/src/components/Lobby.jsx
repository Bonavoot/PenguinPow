import { useContext, useEffect, useState } from "react";
import Player from "./Player";
import { SocketContext } from "../SocketContext";
import { v4 as uuidv4 } from "uuid";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import lobbyBackground from "../assets/lobby-bkg.webp";

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

// ============================================
// HEADER - TOURNAMENT BANNER
// ============================================

const Header = styled.header`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: clamp(80px, 12vh, 120px) clamp(20px, 3vw, 40px) clamp(12px, 2vh, 20px);
  position: relative;
  z-index: 10;
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
  padding: clamp(12px, 2vh, 20px) clamp(24px, 4vw, 50px);
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
  font-family: "Bungee", cursive;
  font-size: clamp(0.45rem, 0.8vw, 0.55rem);
  color: #8b7355;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  text-shadow: 1px 1px 0 #000;
`;

const RoomCode = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.1rem, 2.2vw, 1.6rem);
  color: #d4af37;
  letter-spacing: 0.15em;
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
  padding: clamp(8px, 1.5vh, 16px);
  position: relative;
  z-index: 2;
`;

const DohyoContainer = styled.div`
  position: relative;
  width: clamp(500px, 75vw, 900px);
  height: clamp(280px, 45vh, 450px);
`;

// The circular dohyo ring
const DohyoRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: clamp(200px, 28vw, 340px);
  height: clamp(200px, 28vw, 340px);
  border-radius: 50%;
  background: radial-gradient(
    circle at center,
    #1a0a08 0%,
    #150805 40%,
    #0f0503 80%,
    #0a0505 100%
  );
  border: clamp(6px, 1vw, 12px) solid transparent;
  background-clip: padding-box;
  animation: ${dohyoPulse} 4s ease-in-out infinite;
  
  /* Ring border effect */
  &::before {
    position: absolute;
    top: -clamp(8px, 1.2vw, 14px);
    left: -clamp(8px, 1.2vw, 14px);
    right: -clamp(8px, 1.2vw, 14px);
    bottom: -clamp(8px, 1.2vw, 14px);
    border-radius: 50%;
    border: clamp(4px, 0.7vw, 8px) solid;
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
  font-size: clamp(2.5rem, 6vw, 4.5rem);
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
  width: clamp(170px, 24vw, 280px);
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
  
  /* Gold accent line on the side */
  &::after {
    content: "";
    position: absolute;
    top: 12px;
    ${props => props.$side === 'left' ? 'left: 10px;' : 'right: 10px;'}
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
  padding: clamp(14px, 2vh, 22px) clamp(16px, 2.2vw, 28px);
  border-bottom: 2px solid rgba(139, 115, 85, 0.3);
  position: relative;
  z-index: 3;
`;

const PlayerHeaderTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(6px, 1vh, 12px);
`;

const PlayerStatus = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.45rem, 0.8vw, 0.55rem);
  color: ${props => props.$connected ? '#4ade80' : '#5c4033'};
  text-transform: uppercase;
  letter-spacing: 0.1em;
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
  letter-spacing: 0.06em;
  text-shadow: 
    2px 2px 0 #000,
    0 0 10px rgba(0,0,0,0.5);
`;

const PlayerAvatarArea = styled.div`
  height: clamp(150px, 24vh, 240px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: clamp(10px, 1.5vh, 18px);
  
  /* Flip for left player */
  ${props => props.$side === 'left' && css`
    transform: scaleX(-1);
  `}
`;

const AvatarWrapper = styled.div`
  animation: ${breathe} 2s ease-in-out infinite;
  
  img {
    height: clamp(120px, 24vh, 240px);
    width: auto;
    filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6));
  }
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
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 1vw, 0.8rem);
  color: #5c4033;
  text-transform: uppercase;
  letter-spacing: 0.12em;
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
  padding: clamp(16px, 2.5vh, 28px) clamp(24px, 4vw, 50px);
  background: linear-gradient(180deg,
    rgba(0, 0, 0, 0.95) 0%,
    rgba(26, 10, 8, 0.98) 100%
  );
  border-top: 3px solid #8b7355;
  position: relative;
  z-index: 10;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
`;

const ExitButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.65rem, 1.1vw, 0.85rem);
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  color: #e8dcc8;
  border: 2px solid #8b7355;
  border-radius: clamp(6px, 1vw, 10px);
  padding: clamp(12px, 1.8vh, 18px) clamp(20px, 3vw, 32px);
  cursor: pointer;
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.2vw, 16px);
  box-shadow: 
    0 4px 15px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.05);
  text-shadow: 1px 1px 0 #000;

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
  flex-direction: column;
  align-items: center;
  gap: clamp(10px, 1.5vh, 18px);
`;

const ReadyButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.75rem, 1.4vw, 1.1rem);
  background: linear-gradient(180deg,
    #5a8a3a 0%,
    #4a7a2a 50%,
    #3a6a1a 100%
  );
  color: #e8f0e0;
  border: 3px solid #6aa040;
  border-radius: clamp(8px, 1.2vw, 12px);
  padding: clamp(14px, 2vh, 22px) 0;
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
  width: clamp(160px, 24vw, 220px);
  box-sizing: border-box;
  text-align: center;

  &:hover {
    background: linear-gradient(180deg,
      #6a9a4a 0%,
      #5a8a3a 50%,
      #4a7a2a 100%
    );
    border-color: #8ac060;
    transform: translateY(-4px);
    box-shadow: 
      0 10px 30px rgba(0,0,0,0.6),
      0 0 25px rgba(106, 160, 64, 0.3),
      inset 0 1px 0 rgba(255,255,255,0.2);
    color: #fff;
  }

  &:active {
    transform: translateY(-2px);
  }
`;

const CancelButton = styled(ReadyButton)`
  background: linear-gradient(180deg,
    #6a4a4a 0%,
    #5a3a3a 50%,
    #4a2a2a 100%
  );
  color: #f0e0e0;
  border-color: #8a5a5a;
  
  &:hover {
    background: linear-gradient(180deg,
      #7a5a5a 0%,
      #6a4a4a 50%,
      #5a3a3a 100%
    );
    border-color: #aa7a7a;
    box-shadow: 
      0 10px 30px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(255,255,255,0.1);
  }
`;

const ReadyCount = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.3vw, 1rem);
  color: ${props => props.$ready ? '#4ade80' : '#8b7355'};
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #0f0505 100%
  );
  padding: clamp(10px, 1.4vh, 16px) 0;
  border: 2px solid ${props => props.$ready ? '#4ade80' : '#5c4033'};
  border-radius: clamp(6px, 1vw, 10px);
  text-align: center;
  letter-spacing: 0.12em;
  text-shadow: 1px 1px 0 #000;
  width: clamp(160px, 24vw, 220px);
  box-sizing: border-box;
  ${props => props.$ready && css`
    animation: ${readyGlow} 1.5s ease-in-out infinite;
  `}
`;

const ReadyLabel = styled.span`
  font-size: 0.6em;
  color: rgba(212, 175, 55, 0.6);
  display: block;
  margin-bottom: clamp(4px, 0.6vh, 8px);
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

// ============================================
// COMPONENT
// ============================================

const Lobby = ({ rooms, roomName, handleGame, setCurrentPage, isCPUMatch = false }) => {
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const { socket } = useContext(SocketContext);

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

    socket.on("initial_game_start", () => {
      console.log("game start");
      socket.emit("game_reset", true);
      handleGame();
    });

    return () => {
      socket.off("lobby");
      socket.off("ready_count");
      socket.off("player_left");
      socket.off("initial_game_start");
    };
  }, [roomName, socket, handleGame]);

  const handleLeaveDohyo = () => {
    playButtonPressSound();
    socket.emit("leave_room", { roomId: roomName });
    setCurrentPage("mainMenu");
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
      
      {/* Decorative top elements */}
      <TopDecoration>
        <HangingRope />
        <LeftLantern $delay={0} />
        <CenterLantern $delay={0.5} />
        <RightLantern $delay={1} />
      </TopDecoration>
      
      {/* Tournament Banner Header */}
      <Header>
        <TournamentBanner>
          <BannerHangingBar />
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
                      <Player index={0} fighter={players[0].fighter} />
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

            {/* Player 2 (Right/West) */}
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
                <PlayerAvatarArea $side="right">
                  {players[1]?.fighter ? (
                    <AvatarWrapper>
                      <Player index={1} fighter={players[1].fighter} />
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
              </PlayerBanner>
            </PlayerBannerWrapper>
          </PlayersContainer>
        </DohyoContainer>
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
              <ReadyCount $ready={readyCount > 0}>
                <ReadyLabel>Fighters Ready</ReadyLabel>
                {readyCount} / 2
              </ReadyCount>
            </>
          )}
        </ReadySection>
      </ControlsFooter>
    </LobbyContainer>
  );
};

Lobby.propTypes = {
  rooms: PropTypes.array.isRequired,
  roomName: PropTypes.string.isRequired,
  handleGame: PropTypes.func.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  isCPUMatch: PropTypes.bool,
};

export default Lobby;
