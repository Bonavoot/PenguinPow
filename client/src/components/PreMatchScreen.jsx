import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

import pumo from "../assets/pumo.png";
import { SPRITE_BASE_COLOR, recolorImage, BLUE_COLOR_RANGES, GREY_BODY_RANGES } from "../utils/SpriteRecolorizer";

// ============================================
// ANIMATIONS
// ============================================
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideInLeft = keyframes`
  from { transform: translateX(-80px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideInRight = keyframes`
  from { transform: translateX(80px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
`;

// ============================================
// LAYOUT
// ============================================
const ScreenContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: ${fadeIn} 0.3s ease-out;
  overflow: hidden;
`;

const BlurredBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
`;

const DarkOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
`;

// The card is a CSS grid with transparent background.
// Individual panels (character, info) are opaque cream boxes.
// Gaps and the center column show the game scene through.
const MatchCard = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr clamp(70px, 12cqw, 180px) 1fr;
  grid-template-rows: 1fr auto;
  gap: clamp(5px, 0.55cqw, 10px);
  padding: clamp(8px, 0.8cqw, 14px);
  width: 90%;
  height: 80%;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px, transparent 3px,
      rgba(212, 175, 55, 0.012) 3px, rgba(212, 175, 55, 0.012) 4px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0px, transparent 3px,
      rgba(212, 175, 55, 0.008) 3px, rgba(212, 175, 55, 0.008) 4px
    ),
    linear-gradient(
      180deg,
      rgba(44, 24, 16, 0.92) 0%,
      rgba(35, 18, 12, 0.94) 30%,
      rgba(26, 14, 10, 0.95) 60%,
      rgba(35, 18, 12, 0.94) 80%,
      rgba(44, 24, 16, 0.92) 100%
    );
  border: clamp(2.5px, 0.2cqw, 5px) solid #b8860b;
  border-radius: clamp(4px, 0.4cqw, 8px);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    0 0 0 clamp(4px, 0.35cqw, 7px) rgba(92, 64, 51, 0.7),
    0 0 0 clamp(5px, 0.45cqw, 9px) rgba(180, 130, 30, 0.4),
    inset 0 1px 0 rgba(255, 200, 100, 0.1),
    inset 0 -2px 8px rgba(0, 0, 0, 0.4),
    0 clamp(8px, 0.78cqw, 15px) clamp(30px, 3.13cqw, 60px) rgba(0, 0, 0, 0.7);
  animation: ${fadeIn} 0.5s ease-out 0.2s both;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: clamp(3px, 0.24cqw, 6px);
    background: linear-gradient(
      90deg,
      #6b4c12 0%, #c9a22e 15%, #f0d060 35%,
      #ffe87a 50%,
      #f0d060 65%, #c9a22e 85%, #6b4c12 100%
    );
    border-radius: clamp(4px, 0.4cqw, 8px) clamp(4px, 0.4cqw, 8px) 0 0;
    z-index: 10;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: clamp(3px, 0.24cqw, 6px);
    background: linear-gradient(
      90deg,
      #6b4c12 0%, #c9a22e 15%, #f0d060 35%,
      #ffe87a 50%,
      #f0d060 65%, #c9a22e 85%, #6b4c12 100%
    );
    border-radius: 0 0 clamp(4px, 0.4cqw, 8px) clamp(4px, 0.4cqw, 8px);
    z-index: 10;
    pointer-events: none;
  }
`;


// ============================================
// ROW 1: Character Panels + Transparent Center
// ============================================
const PANEL_PATTERNS = {
  left: `
    background-color: #0a4a6b;
    background-image:
      repeating-conic-gradient(
        from 0deg at 50% 110%,
        #0a4a6b 0deg 10deg,
        #0e6e9e 10deg 20deg
      ),
      radial-gradient(circle at 30% 20%, rgba(0, 255, 255, 0.25) 0%, transparent 40%),
      radial-gradient(circle at 70% 80%, rgba(56, 189, 248, 0.2) 0%, transparent 35%),
      radial-gradient(circle at 50% 110%, rgba(212, 175, 55, 0.35) 0%, transparent 35%);
    background-blend-mode: screen;
  `,
  right: `
    background-color: #0a4a6b;
    background-image:
      repeating-conic-gradient(
        from 0deg at 50% 110%,
        #0a4a6b 0deg 10deg,
        #0e6e9e 10deg 20deg
      ),
      radial-gradient(circle at 30% 20%, rgba(0, 255, 255, 0.25) 0%, transparent 40%),
      radial-gradient(circle at 70% 80%, rgba(56, 189, 248, 0.2) 0%, transparent 35%),
      radial-gradient(circle at 50% 110%, rgba(212, 175, 55, 0.35) 0%, transparent 35%);
    background-blend-mode: screen;
  `,
};

const CharacterPanel = styled.div`
  grid-row: 1;
  ${props => PANEL_PATTERNS[props.$side]}
  border: clamp(1.5px, 0.12cqw, 3px) solid rgba(180, 130, 30, 0.5);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  animation: ${props => props.$side === 'left' ? slideInLeft : slideInRight} 0.6s ease-out 0.3s both;
`;

const RankPlaque = styled.div`
  position: absolute;
  top: clamp(6px, 0.63cqw, 12px);
  ${props => props.$side === 'left' ? `left: clamp(6px, 0.63cqw, 12px);` : `right: clamp(6px, 0.63cqw, 12px);`}
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.5cqw, 8px);
  padding: clamp(4px, 0.55cqw, 8px) clamp(10px, 1.2cqw, 20px);
  z-index: 10;

  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px, transparent 3px,
      rgba(212, 175, 55, 0.015) 3px, rgba(212, 175, 55, 0.015) 4px
    ),
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

const RankText = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(9px, 1.2cqw, 16px);
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

const RankDiamond = styled.span`
  display: inline-block;
  width: clamp(4px, 0.4cqw, 6px);
  height: clamp(4px, 0.4cqw, 6px);
  background: linear-gradient(135deg, #d4af37 0%, #ffd700 50%, #b8860b 100%);
  transform: rotate(45deg);
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(212, 175, 55, 0.3);
`;

const CharacterImageContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: -20%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`;

const CharacterImage = styled.img`
  max-width: 85%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  transform: ${props => props.$flip ? 'scaleX(1)' : 'scaleX(-1)'};
  filter: drop-shadow(4px 4px 8px rgba(0, 0, 0, 0.4));
  opacity: ${props => props.$ready ? 1 : 0};
  transition: opacity 0.25s ease-out;
`;

const CenterTop = styled.div`
  grid-row: 1;
  grid-column: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(6px, 0.8cqw, 14px);
  padding: clamp(8px, 1cqw, 16px) clamp(4px, 0.5cqw, 8px);
`;

const GameLogo = styled.div`
  font-size: clamp(9px, 1.3cqw, 20px);
  font-family: "Bungee", cursive;
  color: #1a1a1a;
  text-shadow:
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff;
  letter-spacing: 0.15em;
  text-align: center;
  animation: ${float} 3s ease-in-out infinite;

  &:nth-child(2) {
    animation-delay: 0.5s;
  }
`;

const VsText = styled.div`
  font-size: clamp(24px, 5cqw, 70px);
  font-family: "Bungee", cursive;
  color: #ffd700;
  -webkit-text-stroke: clamp(1px, 0.1cqw, 2px) #000;
  text-shadow:
    0 0 12px rgba(255, 215, 0, 0.5),
    0 0 6px rgba(212, 175, 55, 0.6),
    0 2px 4px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.1em;
`;

// ============================================
// ROW 2: Single spanning bottom section with internal 3-col grid
// ============================================
const BottomSection = styled.div`
  grid-row: 2;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr clamp(70px, 12cqw, 180px) 1fr;
  column-gap: clamp(5px, 0.55cqw, 10px);
  animation: ${slideUp} 0.5s ease-out 0.5s both;
`;

const cellBorder = 'clamp(1px, 0.1cqw, 2px) solid rgba(180, 130, 30, 0.5)';
const cellDivider = 'clamp(1px, 0.1cqw, 2px) solid rgba(180, 130, 30, 0.2)';

const InfoCell = styled.div`
  background: linear-gradient(180deg, #d4c4a8 0%, #c8b898 50%, #bead8e 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${props => props.$isName
    ? 'clamp(6px, 0.8cqw, 14px) clamp(8px, 1cqw, 16px) clamp(4px, 0.5cqw, 8px)'
    : 'clamp(4px, 0.55cqw, 10px) clamp(8px, 1cqw, 16px)'};
  border-left: ${cellBorder};
  border-right: ${cellBorder};
  border-radius: 2px;
  ${props => props.$isFirst
    ? `border-top: ${cellBorder}; border-bottom: ${cellBorder}; margin-bottom: clamp(5px, 0.55cqw, 10px);`
    : props.$isLast
      ? `border-top: ${cellDivider}; border-bottom: ${cellBorder};`
      : `border-top: ${cellBorder}; border-bottom: none;`
  }
`;

const CenterCell = styled.div`
  background: linear-gradient(180deg, #d4c4a8 0%, #c8b898 50%, #bead8e 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(2px, 0.3cqw, 6px) clamp(4px, 0.5cqw, 8px);
  border-left: ${cellBorder};
  border-right: ${cellBorder};
  border-radius: 2px;
  ${props => props.$isFirst
    ? `border-top: ${cellBorder}; border-bottom: ${cellBorder}; margin-bottom: clamp(5px, 0.55cqw, 10px);`
    : props.$isLast
      ? `border-top: ${cellDivider}; border-bottom: ${cellBorder};`
      : `border-top: ${cellBorder}; border-bottom: none;`
  }
`;

const StableName = styled.div`
  font-size: clamp(7px, 0.85cqw, 12px);
  color: #6b5a4a;
  letter-spacing: 0.15em;
  margin-bottom: clamp(1px, 0.15cqw, 3px);
  font-family: "Bungee", cursive;
  text-transform: uppercase;
`;

const PlayerName = styled.div`
  font-size: clamp(14px, 2.4cqw, 34px);
  font-family: "Bungee", cursive;
  color: #2a1d14;
  text-shadow:
    -1px -1px 0 rgba(255,255,255,0.4),
    1px 1px 0 rgba(0,0,0,0.15);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
  line-height: 1.1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SPECIAL_MAWASHI_GRADIENTS = {
  rainbow: "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
  fire: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)",
  vaporwave: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)",
  camo: "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)",
  galaxy: "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
  gold: "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
};

const MawashiIndicator = styled.div`
  width: 60%;
  height: clamp(4px, 0.42cqw, 8px);
  background: ${props => props.$gradient || props.$color || '#888'};
  margin-top: clamp(3px, 0.35cqw, 6px);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.3),
    inset 0 -1px 2px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(0, 0, 0, 0.3);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: clamp(6px, 0.7cqw, 14px);
    height: clamp(6px, 0.7cqw, 14px);
    background: ${props => props.$gradient || props.$color || '#888'};
    border: clamp(1px, 0.1cqw, 2px) solid rgba(0, 0, 0, 0.3);
    border-radius: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
`;


const RecordDisplay = styled.div`
  display: flex;
  align-items: baseline;
  gap: clamp(2px, 0.25cqw, 4px);
`;

const RecordNum = styled.span`
  font-size: clamp(14px, 2.2cqw, 32px);
  font-family: "Bungee", cursive;
  color: #2a1d14;
  line-height: 1;
  text-shadow:
    -1px -1px 0 rgba(255,255,255,0.4),
    1px 1px 0 rgba(0,0,0,0.15);
`;

const RecordLabel = styled.span`
  font-size: clamp(8px, 1cqw, 16px);
  font-family: "Bungee", cursive;
  color: #8b5a2b;
  text-transform: uppercase;
`;

const RecordSeparator = styled.span`
  font-size: clamp(10px, 1.3cqw, 22px);
  font-family: "Bungee", cursive;
  color: #8b7355;
  margin: 0 clamp(2px, 0.2cqw, 4px);
`;

const StyleValue = styled.span`
  font-size: clamp(9px, 1.1cqw, 16px);
  color: #5c4033;
  font-family: "Bungee", cursive;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;


const MatchLabel = styled.div`
  font-size: clamp(11px, 1.4cqw, 18px);
  color: #2a1d14;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-family: "Bungee", cursive;
  text-shadow:
    -1px -1px 0 rgba(255,255,255,0.4),
    1px 1px 0 rgba(0,0,0,0.15);
`;

const MatchSubLabel = styled.div`
  font-size: clamp(8px, 1cqw, 13px);
  color: #6b5a4a;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-family: "Bungee", cursive;
`;

const CenterLabelBox = styled.div`
  background: linear-gradient(180deg, #5c4033 0%, #3d2817 100%);
  color: #d4af37;
  padding: clamp(2px, 0.25cqw, 5px) clamp(6px, 0.7cqw, 14px);
  font-size: clamp(7px, 0.8cqw, 11px);
  font-family: "Bungee", cursive;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-shadow:
    0 0 6px rgba(212, 175, 55, 0.3),
    0 1px 2px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
  border: 1px solid rgba(180, 130, 30, 0.4);
  border-radius: 2px;
`;

// ============================================
// LOADING & LIVE INDICATORS
// ============================================
const LoadingContainer = styled.div`
  position: absolute;
  bottom: 2%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(5px, 0.52cqw, 10px);
  z-index: 100;
`;

const LoadingBar = styled.div`
  width: clamp(140px, 16cqw, 250px);
  height: clamp(4px, 0.42cqw, 8px);
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const LoadingProgress = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #d4af37, #ffd700, #d4af37);
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s linear infinite;
  width: ${props => props.$progress}%;
  transition: width 0.3s ease-out;
`;

const LoadingText = styled.div`
  color: #ffd700;
  font-size: clamp(9px, 1cqw, 14px);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-family: "Bungee", cursive;
  animation: ${pulse} 1.5s ease-in-out infinite;
  text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;
`;

const LiveIndicator = styled.div`
  position: absolute;
  top: clamp(8px, 1.04cqw, 20px);
  right: clamp(8px, 1.04cqw, 20px);
  display: flex;
  align-items: center;
  gap: clamp(5px, 0.52cqw, 10px);
  background: #c41e3a;
  color: white;
  padding: clamp(4px, 0.42cqw, 8px) clamp(8px, 0.94cqw, 18px);
  font-size: clamp(9px, 1cqw, 14px);
  font-family: "Bungee", cursive;
  letter-spacing: 0.1em;
  border-radius: 4px;
  z-index: 100;
  animation: ${pulse} 2s ease-in-out infinite;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;
`;

const LiveDot = styled.div`
  width: clamp(5px, 0.52cqw, 10px);
  height: clamp(5px, 0.52cqw, 10px);
  background: white;
  border-radius: 50%;
`;

// ============================================
// HELPER DATA
// ============================================
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
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
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
  if (wins >= 10) return { title: "KOMUSUBI", number: `#${Math.max(1, 10 - Math.floor(wins / 5))}` };
  if (wins >= 5) return { title: "MAEGASHIRA", number: `#${Math.max(1, 15 - wins)}` };
  if (wins >= 2) return { title: "JONIDAN", number: `#${Math.max(1, 50 - (wins * 10))}` };
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
  player1Record = { wins: 0, losses: 0 },
  player2Record = { wins: 0, losses: 0 },
  loadingProgress = 0,
  isLoading = true,
  isCPUMatch = false,
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [player1Sprite, setPlayer1Sprite] = useState(pumo);
  const [player2Sprite, setPlayer2Sprite] = useState(pumo);
  const [spritesReady, setSpritesReady] = useState(false);

  const player1Dojo = getSeededValue(player1Name, DOJO_NAMES);
  const player2Dojo = getSeededValue(player2Name, DOJO_NAMES);
  const player1Style = getSeededValue(player1Name + "style", FIGHTING_STYLES);
  const player2Style = getSeededValue(player2Name + "style", FIGHTING_STYLES);
  const player1Rank = getRank(player1Record.wins, player1Record.losses);
  const player2Rank = getRank(player2Record.wins, player2Record.losses);

  useEffect(() => {
    let cancelled = false;
    setSpritesReady(false);

    const recolorSprites = async () => {
      const p1BodyOpts = player1BodyColor ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: player1BodyColor } : {};
      const p2BodyOpts = player2BodyColor ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: player2BodyColor } : {};

      const p1Needs = (player1Color && player1Color !== SPRITE_BASE_COLOR) || player1BodyColor;
      const p2Needs = (player2Color && player2Color !== SPRITE_BASE_COLOR) || player2BodyColor;

      const p1Promise = p1Needs
          ? recolorImage(pumo, BLUE_COLOR_RANGES, player1Color || SPRITE_BASE_COLOR, p1BodyOpts).catch((err) => {
              console.error("Failed to recolor player 1 sprite:", err);
              return pumo;
            })
          : Promise.resolve(pumo);

      const p2Promise = p2Needs
          ? recolorImage(pumo, BLUE_COLOR_RANGES, player2Color || SPRITE_BASE_COLOR, p2BodyOpts).catch((err) => {
              console.error("Failed to recolor player 2 sprite:", err);
              return pumo;
            })
          : Promise.resolve(pumo);

      const [p1, p2] = await Promise.all([p1Promise, p2Promise]);
      if (cancelled) return;
      setPlayer1Sprite(p1);
      setPlayer2Sprite(p2);
      setSpritesReady(true);
    };

    recolorSprites();
    return () => { cancelled = true; };
  }, [player1Color, player2Color, player1BodyColor, player2BodyColor]);

  useEffect(() => {
    const target = Math.min(loadingProgress, 100);
    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= target) {
          clearInterval(timer);
          return target;
        }
        return prev + 2;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [loadingProgress]);

  const p1MawashiColor = player1Color === SPRITE_BASE_COLOR ? "#0891b2" : player1Color;
  const p2MawashiColor = player2Color;

  return (
    <ScreenContainer>
      <BlurredBackground />
      <DarkOverlay />

      <LiveIndicator>
        <LiveDot />
        LIVE
      </LiveIndicator>

      <MatchCard>
        {/* Row 1, Col 1 — Left character */}
        <CharacterPanel $side="left">
          <RankPlaque $side="left">
            <RankText>{player1Rank.title}</RankText>
            {player1Rank.number && <><RankDiamond /><RankText>{player1Rank.number}</RankText></>}
          </RankPlaque>
          <CharacterImageContainer>
            <CharacterImage src={player1Sprite} alt={player1Name} $flip={false} $ready={spritesReady} />
          </CharacterImageContainer>
        </CharacterPanel>

        {/* Row 1, Col 2 — Center branding (transparent) */}
        <CenterTop>
          <VsText>VS</VsText>
        </CenterTop>

        {/* Row 1, Col 3 — Right character (cream panel) */}
        <CharacterPanel $side="right">
          <RankPlaque $side="right">
            <RankText>{player2Rank.title}</RankText>
            {player2Rank.number && <><RankDiamond /><RankText>{player2Rank.number}</RankText></>}
          </RankPlaque>
          <CharacterImageContainer>
            <CharacterImage src={player2Sprite} alt={player2Name} $flip={true} $ready={spritesReady} />
          </CharacterImageContainer>
        </CharacterPanel>

        {/* Row 2 — Bottom section: row-aligned grid, visually unified panels */}
        <BottomSection>
          {/* Row 1: Names */}
          <InfoCell $isName $isFirst>
            <StableName>{player1Dojo}</StableName>
            <PlayerName>{player1Name}</PlayerName>
            <MawashiIndicator $color={p1MawashiColor} $gradient={SPECIAL_MAWASHI_GRADIENTS[player1Color]} />
          </InfoCell>
          <CenterCell $isFirst>
            <MatchLabel>MATCH</MatchLabel>
            <MatchSubLabel>{isCPUMatch ? "VS CPU" : "PVP"}</MatchSubLabel>
          </CenterCell>
          <InfoCell $isName $isFirst>
            <StableName>{player2Dojo}</StableName>
            <PlayerName>{player2Name}</PlayerName>
            <MawashiIndicator $color={p2MawashiColor} $gradient={SPECIAL_MAWASHI_GRADIENTS[player2Color]} />
          </InfoCell>

          {/* Row 2: Record */}
          <InfoCell>
            <RecordDisplay>
              <RecordNum>{player1Record.wins}</RecordNum>
              <RecordLabel>W</RecordLabel>
              <RecordSeparator>-</RecordSeparator>
              <RecordNum>{player1Record.losses}</RecordNum>
              <RecordLabel>L</RecordLabel>
            </RecordDisplay>
          </InfoCell>
          <CenterCell>
            <CenterLabelBox>RECORD</CenterLabelBox>
          </CenterCell>
          <InfoCell>
            <RecordDisplay>
              <RecordNum>{player2Record.wins}</RecordNum>
              <RecordLabel>W</RecordLabel>
              <RecordSeparator>-</RecordSeparator>
              <RecordNum>{player2Record.losses}</RecordNum>
              <RecordLabel>L</RecordLabel>
            </RecordDisplay>
          </InfoCell>

          {/* Row 3: Style */}
          <InfoCell $isLast>
            <StyleValue>{player1Style}</StyleValue>
          </InfoCell>
          <CenterCell $isLast>
            <CenterLabelBox>STYLE</CenterLabelBox>
          </CenterCell>
          <InfoCell $isLast>
            <StyleValue>{player2Style}</StyleValue>
          </InfoCell>
        </BottomSection>
      </MatchCard>

      {isLoading && (
        <LoadingContainer>
          <LoadingBar>
            <LoadingProgress $progress={displayProgress} />
          </LoadingBar>
          <LoadingText>Preparing Match...</LoadingText>
        </LoadingContainer>
      )}
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
  player1Record: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  player2Record: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  loadingProgress: PropTypes.number,
  isLoading: PropTypes.bool,
  isCPUMatch: PropTypes.bool,
};

export default PreMatchScreen;
