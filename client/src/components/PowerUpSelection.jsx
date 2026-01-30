import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
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

// Simplified animation for entrance - removed expensive blur
const slideIn = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, 0) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
`;

// Tassel sway animation
const tasselSway = keyframes`
  0%, 100% {
    transform: rotate(-3deg);
  }
  50% {
    transform: rotate(3deg);
  }
`;

// Subtle glow pulse for the wooden shelf
const shelfGlow = keyframes`
  0%, 100% {
    box-shadow: 
      0 4px 15px rgba(0, 0, 0, 0.5),
      inset 0 2px 4px rgba(255, 255, 255, 0.1),
      0 0 20px rgba(212, 175, 55, 0.15);
  }
  50% {
    box-shadow: 
      0 4px 15px rgba(0, 0, 0, 0.5),
      inset 0 2px 4px rgba(255, 255, 255, 0.1),
      0 0 30px rgba(212, 175, 55, 0.25);
  }
`;

// Urgent timer animation with Japanese sumo colors
const urgentPulse = keyframes`
  0%, 100% { 
    color: #ff4757;
  }
  50% { 
    color: #ffffff;
  }
`;

const PowerUpSelectionOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  pointer-events: all;
`;

// Shimenawa (sacred rope) inspired top banner
const SacredRopeBanner = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: clamp(320px, 58vw, 700px);
  height: clamp(12px, 1.8vw, 20px);
  background: linear-gradient(180deg, 
    #8B5A2B 0%, 
    #A0522D 30%, 
    #8B4513 60%,
    #654321 100%
  );
  border-bottom: clamp(2px, 0.3vw, 4px) solid #4a3728;
  border-radius: 0 0 clamp(4px, 0.6vw, 8px) clamp(4px, 0.6vw, 8px);
  z-index: 5;
  
  /* Rope texture */
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
      rgba(0, 0, 0, 0.1) 2px,
      transparent 4px,
      rgba(255, 255, 255, 0.05) 6px
    );
    border-radius: 0 0 clamp(4px, 0.6vw, 8px) clamp(4px, 0.6vw, 8px);
  }
  
  @media (max-width: 1200px) {
    width: clamp(280px, 60vw, 600px);
    height: clamp(10px, 1.5vw, 16px);
  }
  
  @media (max-width: 900px) {
    width: clamp(250px, 65vw, 500px);
    height: clamp(8px, 1.2vw, 12px);
  }
`;

// Hanging tassels (like shide paper streamers)
const TasselContainer = styled.div`
  position: absolute;
  top: clamp(10px, 1.6vw, 18px);
  left: 50%;
  transform: translateX(-50%);
  width: clamp(300px, 54vw, 660px);
  display: flex;
  justify-content: space-between;
  z-index: 4;
  pointer-events: none;
  
  @media (max-width: 1200px) {
    width: clamp(260px, 56vw, 560px);
    top: clamp(8px, 1.3vw, 14px);
  }
  
  @media (max-width: 900px) {
    width: clamp(230px, 62vw, 460px);
    top: clamp(6px, 1vw, 10px);
  }
`;

const Tassel = styled.div`
  width: clamp(6px, 1vw, 10px);
  height: clamp(20px, 3vw, 35px);
  background: linear-gradient(180deg, 
    #d4af37 0%, 
    #ffd700 20%,
    #d4af37 40%,
    #b8860b 100%
  );
  border-radius: 0 0 clamp(2px, 0.3vw, 4px) clamp(2px, 0.3vw, 4px);
  animation: ${tasselSway} 3s ease-in-out infinite;
  animation-delay: ${props => props.$delay || '0s'};
  transform-origin: top center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  
  /* Tassel fringe at bottom */
  &::after {
    content: "";
    position: absolute;
    bottom: -3px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: clamp(4px, 0.6vw, 8px);
    background: linear-gradient(180deg, #b8860b 0%, #8b6914 100%);
    border-radius: 0 0 2px 2px;
  }
  
  @media (max-width: 900px) {
    width: clamp(4px, 0.8vw, 7px);
    height: clamp(14px, 2.5vw, 25px);
  }
`;

// Wooden shelf/platform under the cards (like dohyo edge or shrine shelf)
const WoodenShelf = styled.div`
  position: relative;
  background: linear-gradient(180deg,
    #8B5A2B 0%,
    #A0522D 15%,
    #8B4513 40%,
    #704214 70%,
    #5D3A1A 100%
  );
  padding: clamp(10px, 1.5vw, 18px) clamp(14px, 2vw, 24px);
  border-radius: clamp(6px, 1vw, 12px);
  border: clamp(2px, 0.3vw, 4px) solid #4a3728;
  animation: ${shelfGlow} 4s ease-in-out infinite;
  margin-top: clamp(8px, 1.2vw, 14px);
  
  /* Wood grain texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: clamp(4px, 0.8vw, 10px);
    background: 
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(0, 0, 0, 0.03) 1px,
        transparent 2px,
        rgba(255, 255, 255, 0.02) 3px,
        transparent 8px
      ),
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        rgba(0, 0, 0, 0.02) 20px,
        rgba(139, 90, 43, 0.1) 40px,
        transparent 60px
      );
    pointer-events: none;
  }
  
  /* Gold corner accents */
  &::after {
    content: "";
    position: absolute;
    top: clamp(4px, 0.6vw, 8px);
    left: clamp(4px, 0.6vw, 8px);
    right: clamp(4px, 0.6vw, 8px);
    bottom: clamp(4px, 0.6vw, 8px);
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: clamp(4px, 0.7vw, 8px);
    pointer-events: none;
  }
  
  @media (max-width: 1200px) {
    padding: clamp(8px, 1.2vw, 14px) clamp(10px, 1.6vw, 18px);
    margin-top: clamp(6px, 1vw, 10px);
  }
  
  @media (max-width: 900px) {
    padding: clamp(6px, 1vw, 10px) clamp(8px, 1.2vw, 14px);
    margin-top: clamp(4px, 0.8vw, 8px);
  }
`;

// Small salt pile decorations on the sides
const SaltPile = styled.div`
  position: absolute;
  bottom: clamp(-6px, -0.8vw, -10px);
  ${props => props.$side === 'left' ? 'left: clamp(8px, 1.2vw, 14px);' : 'right: clamp(8px, 1.2vw, 14px);'}
  width: clamp(12px, 1.8vw, 22px);
  height: clamp(8px, 1.2vw, 14px);
  background: radial-gradient(ellipse at center bottom,
    #ffffff 0%,
    #f5f5f5 40%,
    #e8e8e8 70%,
    #ddd 100%
  );
  border-radius: 50% 50% 45% 45%;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.2),
    inset 0 -1px 2px rgba(0, 0, 0, 0.1);
  z-index: 10;
  
  /* Sparkle effect */
  &::before {
    content: "";
    position: absolute;
    top: 20%;
    left: 30%;
    width: 2px;
    height: 2px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 0 3px 1px rgba(255, 255, 255, 0.8);
  }
  
  @media (max-width: 900px) {
    width: clamp(8px, 1.4vw, 16px);
    height: clamp(5px, 1vw, 10px);
    bottom: clamp(-4px, -0.6vw, -7px);
  }
`;

// Red sumo banner behind title
const TitleBanner = styled.div`
  background: linear-gradient(135deg, 
    #c41e3a 0%, 
    #8b1428 50%, 
    #c41e3a 100%
  );
  padding: clamp(6px, 1vw, 12px) clamp(20px, 3vw, 40px);
  border-radius: clamp(4px, 0.6vw, 8px);
  border: 2px solid #000;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.2);
  margin-bottom: clamp(8px, 1.2vw, 14px);
  position: relative;
  
  /* Gold trim at bottom */
  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 10%;
    right: 10%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #d4af37, transparent);
  }
  
  @media (max-width: 900px) {
    padding: clamp(4px, 0.8vw, 8px) clamp(14px, 2.5vw, 30px);
    margin-bottom: clamp(5px, 1vw, 10px);
  }
`;

const PowerUpContainer = styled.div`
  position: absolute;
  top: clamp(35px, 5vw, 55px);
  left: 50%;
  transform: translate(-50%, 0);
  background: transparent;
  border: none;
  padding: clamp(8px, 1.5vw, 20px);
  text-align: center;
  width: clamp(280px, 52vw, 620px);
  max-width: 90%;
  animation: ${slideIn} 0.3s ease-out forwards;
  color: #fff;
  will-change: transform, opacity;
  
  /* Better scaling for smaller screens */
  @media (max-width: 1200px) {
    width: clamp(260px, 55vw, 550px);
    top: clamp(30px, 4vw, 45px);
  }
  
  @media (max-width: 900px) {
    width: clamp(240px, 60vw, 480px);
    top: clamp(22px, 3.5vw, 35px);
    padding: clamp(6px, 1.2vw, 14px);
  }
  
  @media (max-height: 700px) {
    top: clamp(18px, 3vw, 30px);
  }
`;

const Title = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 2.5vw, 1.7rem);
  margin: 0;
  /* White color with strong contrast */
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  /* Black stroke for clean look */
  text-shadow: 
    -2px -2px 0 #000,
    2px -2px 0 #000,
    -2px 2px 0 #000,
    2px 2px 0 #000,
    -3px -3px 0 #000,
    3px -3px 0 #000,
    -3px 3px 0 #000,
    3px 3px 0 #000,
    0 4px 12px rgba(0, 0, 0, 0.8);
  position: relative;
  z-index: 1;
  
  @media (max-width: 900px) {
    font-size: clamp(0.65rem, 2.2vw, 1.2rem);
  }
`;

const Subtitle = styled.h2`
  font-family: "Bungee", cursive;
  /* Smaller font on small screens */
  font-size: clamp(0.5rem, 1.3vw, 0.85rem);
  margin: 0 0 clamp(8px, 1.8vw, 18px) 0;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: 1px 1px 0 #000;
  position: relative;
  z-index: 1;
  
  @media (max-width: 900px) {
    font-size: clamp(0.4rem, 1.1vw, 0.7rem);
    margin: 0 0 clamp(6px, 1.2vw, 12px) 0;
  }
`;

const PowerUpGrid = styled.div`
  display: flex;
  gap: clamp(10px, 1.8vw, 22px);
  justify-content: center;
  margin-bottom: 0;
  flex-wrap: nowrap;
  position: relative;
  z-index: 2;
  
  @media (max-width: 900px) {
    gap: clamp(6px, 1.2vw, 14px);
  }
`;

// Japanese Sumo-inspired PowerUpCard with traditional aesthetics
const PowerUpCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* Parchment paper background with noise texture */
  background: ${(props) => {
    if (props.$selected) {
      return `
        radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.15), transparent),
        linear-gradient(135deg, #f4e9d8 0%, #e8dcc5 50%, #ddc9b0 100%)
      `;
    }
    return `linear-gradient(135deg, #f9f3e8 0%, #ebe0cf 50%, #ddd2bd 100%)`;
  }};
  /* Colored borders based on power-up type */
  border: ${(props) => {
    let borderColor;
    switch (props.$type) {
      case "speed":
        borderColor = "#00d2ff"; // Cyan
        break;
      case "power":
        borderColor = "#ff6b6b"; // Red
        break;
      case "snowball":
        borderColor = "#74b9ff"; // Blue
        break;
      case "pumo_army":
        borderColor = "#ffcc80"; // Orange
        break;
      case "thick_blubber":
        borderColor = "#9c88ff"; // Purple
        break;
      default:
        borderColor = "#d4434a";
    }
    return props.$selected ? `4px solid ${borderColor}` : `3px solid ${borderColor}`;
  }};
  border-radius: clamp(6px, 1.5vw, 12px);
  padding: clamp(8px, 1.5vw, 16px);
  cursor: pointer;
  transition: all 0.3s ease-out;
  width: clamp(75px, 11vw, 145px);
  height: clamp(80px, 12vw, 155px);
  position: relative;
  flex-shrink: 0;
  
  @media (max-width: 1200px) {
    width: clamp(70px, 10vw, 130px);
    height: clamp(75px, 11vw, 140px);
    padding: clamp(6px, 1.2vw, 12px);
  }
  
  @media (max-width: 900px) {
    width: clamp(60px, 11vw, 110px);
    height: clamp(65px, 12vw, 120px);
    padding: clamp(5px, 1vw, 10px);
    border-width: 2px;
  }
  /* Soft shadow like paper on tatami mat */
  box-shadow: ${(props) => {
    let glowColor;
    switch (props.$type) {
      case "speed":
        glowColor = "0, 210, 255";
        break;
      case "power":
        glowColor = "255, 107, 107";
        break;
      case "snowball":
        glowColor = "116, 185, 255";
        break;
      case "pumo_army":
        glowColor = "255, 204, 128";
        break;
      case "thick_blubber":
        glowColor = "156, 136, 255";
        break;
      default:
        glowColor = "212, 67, 74";
    }
    
    if (props.$selected) {
      return `
        0 8px 20px rgba(0, 0, 0, 0.3),
        inset 0 2px 4px rgba(255, 255, 255, 0.4),
        0 0 30px rgba(${glowColor}, 0.6)
      `;
    }
    return `
      0 6px 15px rgba(0, 0, 0, 0.2),
      inset 0 2px 4px rgba(255, 255, 255, 0.3)
    `;
  }};

  /* Paper texture overlay */
  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: clamp(6px, 1.5vw, 12px);
    background-image: 
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(139, 119, 101, 0.03) 2px,
        rgba(139, 119, 101, 0.03) 4px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 2px,
        rgba(139, 119, 101, 0.03) 2px,
        rgba(139, 119, 101, 0.03) 4px
      );
    pointer-events: none;
    opacity: 0.6;
  }

  &:hover {
    transform: translateY(-6px) scale(1.03);
    box-shadow: ${(props) => {
      let glowColor;
      switch (props.$type) {
        case "speed":
          glowColor = "0, 210, 255";
          break;
        case "power":
          glowColor = "255, 107, 107";
          break;
        case "snowball":
          glowColor = "116, 185, 255";
          break;
        case "pumo_army":
          glowColor = "255, 204, 128";
          break;
        case "thick_blubber":
          glowColor = "156, 136, 255";
          break;
        default:
          glowColor = "212, 67, 74";
      }
      
      if (props.$selected) {
        return `
          0 12px 30px rgba(0, 0, 0, 0.4),
          inset 0 2px 4px rgba(255, 255, 255, 0.5),
          0 0 45px rgba(${glowColor}, 0.8)
        `;
      }
      return `
        0 10px 25px rgba(0, 0, 0, 0.3),
        inset 0 2px 4px rgba(255, 255, 255, 0.4),
        0 0 25px rgba(${glowColor}, 0.5)
      `;
    }};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Corner ornaments with type-specific color */
  &::before {
    content: "";
    position: absolute;
    top: 6px;
    left: 6px;
    right: 6px;
    bottom: 6px;
    border-radius: clamp(4px, 1vw, 8px);
    border: 1px solid ${(props) => {
      let borderColor;
      switch (props.$type) {
        case "speed":
          borderColor = "rgba(0, 210, 255, 0.3)";
          break;
        case "power":
          borderColor = "rgba(255, 107, 107, 0.3)";
          break;
        case "snowball":
          borderColor = "rgba(116, 185, 255, 0.3)";
          break;
        case "pumo_army":
          borderColor = "rgba(255, 204, 128, 0.3)";
          break;
        case "thick_blubber":
          borderColor = "rgba(156, 136, 255, 0.3)";
          break;
        default:
          borderColor = "rgba(212, 67, 74, 0.3)";
      }
      return borderColor;
    }};
    pointer-events: none;
    
    @media (max-width: 900px) {
      top: 4px;
      left: 4px;
      right: 4px;
      bottom: 4px;
    }
  }
`;

// Square PowerUpIcon with type-specific colors
const PowerUpIcon = styled.div`
  width: clamp(28px, 4.5vw, 55px);
  height: clamp(28px, 4.5vw, 55px);
  border-radius: clamp(4px, 0.8vw, 8px);
  /* Colored background based on power-up type */
  background: ${(props) => {
    let baseColor, darkColor;
    switch (props.$type) {
      case "speed":
        baseColor = "#00d2ff";
        darkColor = "#00a0cc";
        break;
      case "power":
        baseColor = "#ff6b6b";
        darkColor = "#cc4444";
        break;
      case "snowball":
        baseColor = "#74b9ff";
        darkColor = "#5599dd";
        break;
      case "pumo_army":
        baseColor = "#ffcc80";
        darkColor = "#ddaa66";
        break;
      case "thick_blubber":
        baseColor = "#9c88ff";
        darkColor = "#7766dd";
        break;
      default:
        baseColor = "#d4434a";
        darkColor = "#b8242e";
    }
    return `linear-gradient(135deg, ${baseColor} 0%, ${darkColor} 100%)`;
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(4px, 0.8vw, 10px);
  /* Black border for strong contrast */
  border: 2px solid #000000;
  box-shadow: ${(props) => {
    let glowColor;
    switch (props.$type) {
      case "speed":
        glowColor = "0, 210, 255";
        break;
      case "power":
        glowColor = "255, 107, 107";
        break;
      case "snowball":
        glowColor = "116, 185, 255";
        break;
      case "pumo_army":
        glowColor = "255, 204, 128";
        break;
      case "thick_blubber":
        glowColor = "156, 136, 255";
        break;
      default:
        glowColor = "212, 67, 74";
    }
    return `
      0 3px 6px rgba(0, 0, 0, 0.4),
      inset 0 1px 2px rgba(255, 255, 255, 0.3),
      0 0 12px rgba(${glowColor}, 0.5)
    `;
  }};
  font-size: clamp(0.8rem, 2vw, 1.5rem);
  font-weight: bold;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  position: relative;
  z-index: 2;

  /* Inner border decoration */
  &::before {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    right: 2px;
    bottom: 2px;
    border-radius: clamp(2px, 0.5vw, 5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    pointer-events: none;
  }

  img {
    width: 70%;
    height: 70%;
    object-fit: contain;
    filter: drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.5));
    position: relative;
    z-index: 3;
  }
  
  @media (max-width: 1200px) {
    width: clamp(24px, 4vw, 45px);
    height: clamp(24px, 4vw, 45px);
  }
  
  @media (max-width: 900px) {
    width: clamp(20px, 4.5vw, 38px);
    height: clamp(20px, 4.5vw, 38px);
    border-width: 2px;
    margin-bottom: clamp(3px, 0.6vw, 6px);
  }
`;

const PowerUpName = styled.h3`
  font-family: "Bungee", cursive;
  font-size: clamp(0.45rem, 1.2vw, 0.85rem);
  margin: 0 0 clamp(2px, 0.6vw, 5px) 0;
  /* Type-specific colors for ability names */
  color: ${(props) => {
    if (props.$selected) return "#b8860b"; // Dark golden rod for selected
    
    // Use type-specific colors
    switch (props.$type) {
      case "speed":
        return "#0099cc"; // Darker cyan
      case "power":
        return "#cc4444"; // Darker red
      case "snowball":
        return "#4488cc"; // Darker blue
      case "pumo_army":
        return "#cc8844"; // Darker orange
      case "thick_blubber":
        return "#7755cc"; // Darker purple
      default:
        return "#2c1810";
    }
  }};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  /* Subtle black stroke for ability names */
  text-shadow: ${(props) =>
    props.$selected
      ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 8px rgba(212, 175, 55, 0.5)"
      : "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"};
  line-height: 1.1;
  position: relative;
  z-index: 3;
  
  @media (max-width: 900px) {
    font-size: clamp(0.38rem, 1.1vw, 0.7rem);
    letter-spacing: 0.08em;
  }
`;

const PowerUpDescription = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.32rem, 0.85vw, 0.6rem);
  margin: 0 0 clamp(2px, 0.6vw, 5px) 0;
  /* Dark ink color for traditional look */
  color: ${(props) => (props.$selected ? "#3d2817" : "#4a3828")};
  text-align: center;
  line-height: 1.2;
  text-shadow: ${(props) =>
    props.$selected
      ? "0.5px 0.5px 1px rgba(255, 255, 255, 0.4)"
      : "0.5px 0.5px 1px rgba(255, 255, 255, 0.3)"};
  font-weight: 600;
  letter-spacing: 0.04em;
  position: relative;
  z-index: 3;
  
  @media (max-width: 900px) {
    font-size: clamp(0.28rem, 0.75vw, 0.5rem);
    line-height: 1.15;
  }
`;

const PowerUpType = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.32rem, 0.8vw, 0.58rem);
  margin: clamp(4px, 0.8vw, 8px) 0 0 0;
  /* Bright green for active, white for passive */
  color: ${(props) => {
    if (props.$selected) return "#ffd700"; // Bright gold for selected

    // Different colors for active vs passive based on the type text
    if (props.$isActive) {
      return "#00ff00"; // Bright green for active
    } else {
      return "#ffffff"; // White for passive
    }
  }};
  text-align: center;
  line-height: 1;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 400;
  /* Strong black stroke for readability */
  text-shadow: ${(props) => {
    if (props.$selected) {
      return `
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 0 6px rgba(255, 215, 0, 0.6)
      `;
    }
    // Black stroke with colored glow for active
    if (props.$isActive) {
      return `
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 0 6px rgba(0, 255, 0, 0.6)
      `;
    }
    // Black stroke for passive
    return `
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000
    `;
  }};
  
  // Prevent any hover effects on the text itself
  transition: none;
  pointer-events: none;
  position: relative;
  z-index: 3;
  
  @media (max-width: 900px) {
    font-size: clamp(0.28rem, 0.7vw, 0.48rem);
  }
`;

const StatusContainer = styled.div`
  padding-top: clamp(4px, 0.8vw, 8px);
  margin-top: clamp(4px, 0.8vw, 8px);
  position: relative;
  z-index: 1;
  
  @media (max-width: 900px) {
    padding-top: clamp(2px, 0.5vw, 5px);
    margin-top: clamp(2px, 0.5vw, 5px);
  }
`;

const StatusText = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.45rem, 1.1vw, 0.75rem);
  margin: clamp(3px, 0.8vw, 6px) 0;
  /* White text with strong contrast */
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: 
    2px 2px 0 #000,
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    0 2px 6px rgba(0, 0, 0, 0.6);
    
  @media (max-width: 900px) {
    font-size: clamp(0.38rem, 0.9vw, 0.6rem);
  }
`;

// Timer with Japanese aesthetic
const TimerText = styled.p`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 1.1vw, 0.85rem);
  margin: clamp(4px, 1vw, 8px) 0 0 0;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.06em;

  ${(props) =>
    props.$urgent
      ? css`
          animation: ${urgentPulse} 1s ease-in-out infinite;
          /* Gold outline for urgency */
          text-shadow: 
            -1px -1px 0 #d4af37,
            1px -1px 0 #d4af37,
            -1px 1px 0 #d4af37,
            1px 1px 0 #d4af37,
            -2px -2px 0 #000,
            2px -2px 0 #000,
            -2px 2px 0 #000,
            2px 2px 0 #000,
            0 3px 8px rgba(0, 0, 0, 0.8);
        `
      : css`
          color: #ffffff;
          text-shadow: 
            2px 2px 0 #000,
            -1px -1px 0 #000,
            1px -1px 0 #000,
            -1px 1px 0 #000,
            0 2px 6px rgba(0, 0, 0, 0.6);
        `}
        
  @media (max-width: 900px) {
    font-size: clamp(0.42rem, 0.9vw, 0.7rem);
    margin: clamp(3px, 0.7vw, 6px) 0 0 0;
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
  const [selectionStatus, setSelectionStatus] = useState({
    selectedCount: 0,
    totalPlayers: 2,
  });
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [availablePowerUps, setAvailablePowerUps] = useState([]);

  // Memoize power up info to prevent recreation on every render
  const powerUpInfo = useMemo(
    () => ({
      speed: {
        name: "Happy Feet",
        description: "Enhanced movement & dodge speed",
        icon: happyFeetIcon,
      },
      power: {
        name: "Power Water",
        description: "Increase knockback by 20%",
        icon: powerWaterIcon,
      },
      snowball: {
        name: "Snowball",
        description: "Throw snowball with F key",
        icon: snowballImage,
      },
      pumo_army: {
        name: "Pumo Army",
        description: "Spawn mini clones with F key",
        icon: pumoArmyIcon,
      },
      thick_blubber: {
        name: "Thick Blubber",
        description: "Charged attack and grab absorbs 1 hit",
        icon: thickBlubberIcon,
      },
    }),
    []
  );

  // Memoize the timer status message to prevent unnecessary re-renders
  const statusMessage = useMemo(() => {
    if (selectedPowerUp) {
      return `${powerUpInfo[selectedPowerUp].name} Selected - Waiting for opponent...`;
    }
    return "Select a power-up to continue";
  }, [selectedPowerUp, powerUpInfo]);

  // Memoize timer text to prevent unnecessary re-renders
  const timerMessage = useMemo(() => {
    return timeLeft > 0
      ? `${timeLeft} seconds remaining`
      : "Auto-selecting power-up...";
  }, [timeLeft]);

  // Use ref to store countdown interval to prevent multiple intervals
  const countdownIntervalRef = useRef(null);

  // Clear any existing countdown interval
  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start countdown timer
  const startCountdownTimer = useCallback(() => {
    // Clear any existing timer first
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
      console.log(
        `🟢 PowerUpSelection: Received power_up_selection_start for player ${playerId} in room ${roomId}`,
        data
      );
      setIsVisible(true);
      setSelectedPowerUp(null);
      setSelectionStatus({ selectedCount: 0, totalPlayers: 2 });
      setTimeLeft(15);
      setAvailablePowerUps(data.availablePowerUps || []);

      // Start countdown timer
      startCountdownTimer();

      // Notify parent that selection is now active
      if (onSelectionStateChange) {
        onSelectionStateChange(true);
      }
    };

    const handlePowerUpSelectionStatus = (data) => {
      console.log(
        `🟡 PowerUpSelection: Received power_up_selection_status for player ${playerId}`,
        data
      );
      setSelectionStatus(data);
    };

    const handlePowerUpSelectionComplete = () => {
      console.log(
        `🔴 PowerUpSelection: Received power_up_selection_complete for player ${playerId}`
      );
      setIsVisible(false);
      setTimeLeft(15);
      setAvailablePowerUps([]);

      // Clear countdown timer
      clearCountdownInterval();

      // Notify parent that selection is no longer active
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
      if (onSelectionComplete) {
        onSelectionComplete();
      }
    };

    // Add game_reset handler to ensure clean slate
    const handleGameReset = () => {
      console.log(
        `🔵 PowerUpSelection: Received game_reset for player ${playerId}, clearing state`
      );
      setIsVisible(false);
      setSelectedPowerUp(null);
      setSelectionStatus({ selectedCount: 0, totalPlayers: 2 });
      setTimeLeft(15);
      setAvailablePowerUps([]);

      // Clear countdown timer
      clearCountdownInterval();

      // Notify parent that selection is no longer active
      if (onSelectionStateChange) {
        onSelectionStateChange(false);
      }
    };

    // Set up socket listeners with logging
    console.log(
      `🔵 PowerUpSelection: Setting up socket listeners for player ${playerId} in room ${roomId}`
    );
    socket.on("power_up_selection_start", handlePowerUpSelectionStart);
    socket.on("power_up_selection_status", handlePowerUpSelectionStatus);
    socket.on("power_up_selection_complete", handlePowerUpSelectionComplete);
    socket.on("game_reset", handleGameReset);

    return () => {
      console.log(
        `🔴 PowerUpSelection: Cleaning up socket listeners for player ${playerId}`
      );
      socket.off("power_up_selection_start", handlePowerUpSelectionStart);
      socket.off("power_up_selection_status", handlePowerUpSelectionStatus);
      socket.off("power_up_selection_complete", handlePowerUpSelectionComplete);
      socket.off("game_reset", handleGameReset);

      // Clear countdown timer
      clearCountdownInterval();
    };
  }, [
    startCountdownTimer,
    clearCountdownInterval,
    onSelectionComplete,
    onSelectionStateChange,
    playerId,
    roomId,
  ]);

  // Separate effect for requesting power-up state (to avoid re-running socket listeners)
  useEffect(() => {
    // Request current power-up selection state in case we missed the initial event
    const requestPowerUpState = () => {
      console.log(
        `🔵 PowerUpSelection: Requesting power-up selection state for player ${playerId} in room ${roomId}`
      );
      socket.emit("request_power_up_selection_state", {
        roomId,
        playerId,
      });
    };

    // Request state immediately and after a short delay
    requestPowerUpState();
    const stateRequestTimeout = setTimeout(requestPowerUpState, 500);

    return () => {
      clearTimeout(stateRequestTimeout);
    };
  }, [socket, playerId, roomId]); // Only depend on what's actually needed for the request

  // Memoize the power up select handler to prevent recreation
  const handlePowerUpSelect = useCallback(
    (powerUpType) => {
      if (selectedPowerUp) return; // Prevent changing selection

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

  return (
    <PowerUpSelectionOverlay>
      {/* Sacred rope banner at top */}
      <SacredRopeBanner />
      
      {/* Hanging gold tassels */}
      <TasselContainer>
        <Tassel $delay="0s" />
        <Tassel $delay="0.5s" />
        <Tassel $delay="1s" />
        <Tassel $delay="0.3s" />
        <Tassel $delay="0.8s" />
      </TasselContainer>
      
      <PowerUpContainer>
        {/* Red sumo banner with title */}
        <TitleBanner>
          <Title>CHOOSE A POWER UP</Title>
        </TitleBanner>

        {/* Wooden shelf holding the cards */}
        <WoodenShelf>
          {/* Salt piles on sides */}
          <SaltPile $side="left" />
          <SaltPile $side="right" />
          
          <PowerUpGrid>
            {availablePowerUps.map((type) => {
              const info = powerUpInfo[type];
              if (!info) return null;

              return (
                <PowerUpCard
                  key={type}
                  $type={type}
                  $selected={selectedPowerUp === type}
                  onClick={() => handlePowerUpSelect(type)}
                  onMouseEnter={playPowerUpSelectionHoverSound}
                  disabled={selectedPowerUp && selectedPowerUp !== type}
                >
                  <PowerUpIcon $type={type} $selected={selectedPowerUp === type}>
                    {type === "speed" ||
                    type === "power" ||
                    type === "snowball" ||
                    type === "pumo_army" ||
                    type === "thick_blubber" ? (
                      <img src={info.icon} alt={info.name} />
                    ) : (
                      info.icon
                    )}
                  </PowerUpIcon>
                  <PowerUpName $type={type} $selected={selectedPowerUp === type}>
                    {info.name}
                  </PowerUpName>
                  <PowerUpDescription $selected={selectedPowerUp === type}>
                    {info.description}
                  </PowerUpDescription>
                  <PowerUpType
                    $selected={selectedPowerUp === type}
                    $isActive={type === "snowball" || type === "pumo_army"}
                  >
                    {type === "snowball" || type === "pumo_army"
                      ? "(active)"
                      : "(passive)"}
                  </PowerUpType>
                </PowerUpCard>
              );
            })}
          </PowerUpGrid>
        </WoodenShelf>

        <StatusContainer>
          <TimerText $urgent={timeLeft <= 5}>{timerMessage}</TimerText>
        </StatusContainer>
      </PowerUpContainer>
    </PowerUpSelectionOverlay>
  );
};

PowerUpSelection.propTypes = {
  roomId: PropTypes.string.isRequired,
  playerId: PropTypes.string.isRequired,
  onSelectionComplete: PropTypes.func,
  onSelectionStateChange: PropTypes.func,
};

export default PowerUpSelection;
