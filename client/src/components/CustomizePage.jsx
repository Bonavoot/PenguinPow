/**
 * CustomizePage — Full-page character customization screen.
 *
 * Premium, cinematic single-screen wardrobe inspired by AAA fighter character
 * editors. Uses the shared "Aizome Banzuke" palette (sumi ink, ice,
 * vermillion, cream, gold) defined in menuTheme.js.
 */

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
} from "../utils/SpriteRecolorizer";
import {
  playButtonHoverSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import Snowfall from "./Snowfall";
import pumo from "../assets/pumo-idle.png";
import mainMenuBackground from "../assets/main-menu-bkg-3.png";
import {
  C,
  fadeIn,
  fadeUp,
  slideInLeft,
  slideInRight,
  livePulse,
} from "./menuTheme";

// ============================================
// LOCAL ANIMATIONS
// ============================================

const breathe = keyframes`
  0%, 100% { transform: scaleY(1);     }
  50%      { transform: scaleY(1.018); }
`;

const swatchPop = keyframes`
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1); }
`;

// ============================================
// SHELL
// ============================================

const PageContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: ${C.snow};
  overflow: hidden;
  container-type: size;
  font-family: "Space Grotesk", sans-serif;
`;

const BackgroundImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /*
   * Soft frosted suggestion of the arena bg — brightness up,
   * saturation slightly down so the colorful banners read as
   * a pale watermark behind the snow surface, not a competing
   * mid-tone.
   */
  opacity: 0.45;
  filter: saturate(0.78) brightness(1.18) blur(1.5px);
  z-index: 0;
  pointer-events: none;
`;

const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  /*
   * Snow-tinted readability veil. Mirrors the lobby treatment so
   * both screens read as part of the same Hokkaido-winter world.
   * Stronger at the top (where the page header sits) and the
   * bottom (where panels anchor), faintly transparent through the
   * middle so the arena watermark breathes.
   */
  background:
    radial-gradient(
      ellipse at 50% 100%,
      rgba(35, 70, 110, 0.18) 0%,
      transparent 55%
    ),
    linear-gradient(
      180deg,
      rgba(234, 241, 247, 0.7) 0%,
      rgba(234, 241, 247, 0.25) 30%,
      rgba(234, 241, 247, 0.25) 70%,
      rgba(234, 241, 247, 0.7) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.12;
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0px,
    rgba(35, 70, 110, 0.05) 1px,
    transparent 2px
  );
`;

// ============================================
// TOP BAR
// ============================================

const TopBar = styled.header`
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: clamp(12px, 2cqw, 28px);
  padding: clamp(14px, 2.4cqh, 26px) clamp(20px, 3.5cqw, 48px);
  /*
   * Sumi anchor band — same role as Lobby's TopBar. Frames the
   * page so the snow PreviewPanel + ControlsPanel below have
   * dark chrome to sit against, not just float in white space.
   */
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
  box-shadow: 0 3px 10px ${C.sumiShadow};
  animation: ${fadeIn} 0.5s ease-out;
`;

const TopBarLeft = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const TopBarRight = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const BackButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  padding: clamp(8px, 1.2cqh, 12px) clamp(14px, 2cqw, 22px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.62rem, 0.95cqw, 0.78rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  /*
   * Dark-context ghost button (matches Lobby ExitButton). Lives on
   * the sumi TopBar so it stays subordinate to the central PageTitle.
   */
  color: ${C.creamMute};
  background: transparent;
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;

  .arrow {
    font-family: "Space Grotesk", sans-serif;
    font-weight: 700;
    transition: transform 0.2s ease;
  }

  &:hover {
    color: ${C.cream};
    border-color: ${C.iceMid};
    background: rgba(234, 241, 247, 0.06);

    .arrow {
      transform: translateX(-3px);
    }
  }

  &:active {
    transform: scale(0.98);
  }
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 1.8cqw, 1.4rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.18em;
  line-height: 1;
`;

const PageSubtitle = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.7cqw, 0.55rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
`;

const SaveIndicator = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 0.9cqw, 10px);
  padding: clamp(6px, 1cqh, 10px) clamp(12px, 1.6cqw, 18px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.72cqw, 0.55rem);
  /*
   * Plate-on-plate dark chip on the sumi TopBar — slightly elevated
   * (sumiSoft) so it reads as a status pill on the bunting strip
   * without competing with the PageTitle for attention.
   */
  color: ${C.creamMute};
  background: ${C.sumiSoft};
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const SaveDot = styled.span`
  width: clamp(7px, 0.9cqw, 9px);
  height: clamp(7px, 0.9cqw, 9px);
  border-radius: 50%;
  background: ${(p) => (p.$busy ? C.gold : C.success)};
  animation: ${livePulse} 2s ease-in-out infinite;
`;

// ============================================
// STAGE
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  align-items: stretch;
  gap: clamp(20px, 3cqw, 48px);
  padding: clamp(20px, 3cqh, 36px) clamp(24px, 4cqw, 64px);
`;

// ============================================
// PREVIEW PANEL (LEFT)
// ============================================

const PreviewPanel = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  /*
   * Snow panel — pure white card with a vermillion top accent
   * strip (the canonical brand mark for this surface). Solid fill,
   * crisp 1px ice-blue border, single soft cool shadow. Mirrors
   * the Lobby PlayerCard treatment so both screens read as part
   * of one design language.
   */
  background: ${C.snowPanel};
  border: 1px solid ${C.snowBorder};
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 8px 22px ${C.snowShadow};
  animation: ${slideInLeft} 0.5s ease-out 0.15s both;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${C.vermillion};
  }
`;

const PanelHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: clamp(10px, 1.6cqh, 16px) clamp(16px, 2.2cqw, 24px);
  /*
   * Sumi header band over the snow PreviewStage. Same banzuke-poster
   * pattern as the BanzukeCard on the main menu: dark band on top of
   * a snow body, framed by the panel's vermillion top accent.
   */
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
`;

const PanelHeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const PanelLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 0.95cqw, 0.78rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.22em;
`;

const PanelMeta = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.65cqw, 0.5rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
`;

const LiveBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(5px, 0.7cqw, 8px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.42rem, 0.65cqw, 0.5rem);
  color: ${(p) => (p.$busy ? C.gold : C.success)};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const LiveDot = styled.span`
  width: clamp(6px, 0.8cqw, 8px);
  height: clamp(6px, 0.8cqw, 8px);
  border-radius: 50%;
  background: ${(p) => (p.$busy ? C.gold : C.success)};
  animation: ${livePulse} 2s ease-in-out infinite;
`;

const PreviewStage = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 2.4cqh, 28px);
  position: relative;
  overflow: hidden;
  /*
   * Subtle icy stage — flat color, no inset highlights. Acts as
   * the "snowfield Pumo is standing on" inside the panel.
   */
  background: ${C.snowSoft};
`;

/*
 * Pumo backdrop wash — replaces the previous warm vermillion
 * spotlight (which read as a red glow on a white floor and
 * fought the icy brand). A single soft cool ambient pool puts
 * Pumo on a faint "snow halo" without competing with the panel.
 */
const PreviewSpotlight = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center 65%,
    rgba(126, 203, 240, 0.18) 0%,
    transparent 60%
  );
  pointer-events: none;
`;

const AvatarBreath = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  animation: ${breathe} 2.8s ease-in-out infinite;
  transform-origin: center bottom;
  filter: drop-shadow(0 14px 18px rgba(35, 70, 110, 0.32));
`;

const PreviewImage = styled.img`
  height: clamp(220px, 50cqh, 480px);
  max-height: 100%;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;

const PanelFooter = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(12px, 1.8cqw, 22px);
  padding: clamp(12px, 1.8cqh, 18px) clamp(16px, 2.2cqw, 24px);
  /*
   * Sumi footer band closes the bottom of the PreviewPanel so the
   * snow body is bracketed top-and-bottom by dark chrome (matching
   * the banzuke header pattern). Holds the "currently selected
   * swatch" label + the dark-ghost reset button.
   */
  background: ${C.sumi};
  border-top: 1px solid ${C.sumiBorder};
`;

const CurrentSelection = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 14px);
`;

const CurrentSwatch = styled.div`
  width: clamp(28px, 3cqw, 36px);
  height: clamp(28px, 3cqw, 36px);
  border-radius: 50%;
  background: ${(p) => p.$gradient || p.$color};
  border: 2px solid ${C.gold};
  box-shadow: 0 2px 6px ${C.sumiShadow};
  flex-shrink: 0;
`;

const CurrentNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const CurrentCategory = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.68cqw, 0.55rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
`;

const CurrentName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.4cqw, 1.1rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ResetButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 0.9cqw, 10px);
  padding: clamp(7px, 1cqh, 10px) clamp(12px, 1.6cqw, 18px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.5rem, 0.78cqw, 0.62rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  /* Dark-context ghost — sits on the sumi PanelFooter. */
  color: ${C.creamMute};
  background: transparent;
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;

  &:hover {
    color: ${C.cream};
    border-color: ${C.iceMid};
    background: rgba(234, 241, 247, 0.06);
  }

  &:active {
    transform: scale(0.98);
  }
`;

// ============================================
// CONTROLS PANEL (RIGHT)
// ============================================

const ControlsPanel = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  background: ${C.snowPanel};
  border: 1px solid ${C.snowBorder};
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 8px 22px ${C.snowShadow};
  animation: ${slideInRight} 0.5s ease-out 0.2s both;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 30%;
    right: 30%;
    height: 2px;
    background: ${C.gold};
    opacity: 0.85;
  }
`;

const TabBar = styled.div`
  display: flex;
  align-items: stretch;
  gap: clamp(2px, 0.4cqw, 4px);
  padding: clamp(10px, 1.4cqh, 14px) clamp(16px, 2.2cqw, 24px) 0;
  /*
   * Sumi tab strip — same banzuke header pattern as PreviewPanel.
   * The active tab is a snow plate that "pulls down" out of the
   * dark bunting and merges with the snow ControlsBody beneath,
   * making the bar/body read as one continuous panel folded over
   * a dark spine.
   */
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
`;

const Tab = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.2cqw, 12px);
  font-family: "Bungee", cursive;
  font-size: clamp(0.65rem, 1cqw, 0.85rem);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  padding: clamp(10px, 1.4cqh, 14px) clamp(18px, 2.4cqw, 28px);
  background: ${(p) => (p.$active ? C.snowPanel : "transparent")};
  border: 1px solid ${(p) => (p.$active ? C.snowPanel : "transparent")};
  border-bottom: ${(p) =>
    p.$active ? `1px solid ${C.snowPanel}` : "none"};
  border-radius: 2px 2px 0 0;
  color: ${(p) => (p.$active ? C.iceDeep : C.creamMute)};
  cursor: pointer;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease;
  margin-bottom: -1px;

  ${(p) =>
    p.$active &&
    css`
      &::after {
        content: "";
        position: absolute;
        top: -1px;
        left: 18%;
        right: 18%;
        height: 2px;
        background: ${C.vermillion};
      }
    `}

  &:hover {
    color: ${(p) => (p.$active ? C.iceDeep : C.cream)};
    ${(p) =>
      !p.$active &&
      css`
        background: rgba(234, 241, 247, 0.06);
      `}
  }
`;

const TabIcon = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: 1.1em;
  opacity: 0.85;
`;

const ControlsBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(14px, 2cqh, 22px);
  padding: clamp(16px, 2.4cqh, 26px) clamp(18px, 2.4cqw, 28px);
  overflow-y: auto;

  /* Ice scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: ${C.snowPanelDeep};
  }
  &::-webkit-scrollbar-thumb {
    background: ${C.iceMid};
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: ${C.iceDeep};
  }
`;

const CategorySection = styled.section`
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2cqh, 12px);
  animation: ${fadeUp} 0.4s ease-out;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: clamp(6px, 0.8cqh, 8px);
  border-bottom: 1px solid ${C.snowBorderSoft};
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-family: "Bungee", cursive;
  font-size: clamp(0.65rem, 1cqw, 0.82rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: 0.22em;
`;

const SectionMeta = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.65cqw, 0.5rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const SwatchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols ?? 9}, minmax(0, 1fr));
  gap: clamp(7px, 1cqw, 12px);
`;

const SwatchCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.6cqh, 6px);
`;

const ColorSwatch = styled.button`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid
    ${(p) => (p.$selected ? C.gold : C.snowBorder)};
  background: ${(p) => p.$gradient || p.$color};
  cursor: pointer;
  transition:
    transform 0.15s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: ${(p) =>
    p.$selected
      ? `0 0 0 2px rgba(232, 197, 71, 0.5), 0 2px 6px ${C.snowShadow}`
      : `0 2px 5px ${C.snowShadow}`};
  animation: ${swatchPop} 0.3s ease-out both;
  animation-delay: ${(p) => Math.min(p.$index ?? 0, 16) * 0.02}s;

  &:hover {
    transform: scale(1.12);
    border-color: ${(p) => (p.$selected ? C.gold : C.iceMid)};
  }

  &:active {
    transform: scale(0.94);
  }
`;

const PatternSwatch = styled(ColorSwatch)`
  border-radius: 6px;
`;

const SwatchName = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.4rem, 0.62cqw, 0.5rem);
  color: ${(p) => (p.$selected ? C.inkText : C.inkTextMute)};
  text-transform: uppercase;
  letter-spacing: 0.14em;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
`;

// ============================================
// COLOR DATA
// ============================================

const BELT_SOLIDS = [
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

const BELT_PATTERNS = [
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

const BODY_COLORS = [
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

// ============================================
// COMPONENT
// ============================================

function CustomizePage({ onBack }) {
  const {
    player1Color,
    setPlayer1Color,
    player1BodyColor,
    setPlayer1BodyColor,
  } = usePlayerColors();

  const [previewSrc, setPreviewSrc] = useState(pumo);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState("belt");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Recolor preview whenever belt or body color changes
  useEffect(() => {
    const needsMawashi = player1Color && player1Color !== SPRITE_BASE_COLOR;
    const needsBody = !!player1BodyColor;

    if (!needsMawashi && !needsBody) {
      setPreviewSrc(pumo);
      return;
    }

    setIsLoading(true);
    const bodyOpts = needsBody
      ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: player1BodyColor }
      : {};
    recolorImage(
      pumo,
      BLUE_COLOR_RANGES,
      player1Color || SPRITE_BASE_COLOR,
      bodyOpts,
    )
      .then((recolored) => {
        if (mountedRef.current) setPreviewSrc(recolored);
      })
      .catch(() => {
        if (mountedRef.current) setPreviewSrc(pumo);
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
  }, [player1Color, player1BodyColor]);

  const handleBeltSelect = (hex) => {
    playButtonPressSound2();
    setPlayer1Color(hex);
  };

  const handleBodySelect = (hex) => {
    playButtonPressSound2();
    setPlayer1BodyColor(hex);
  };

  const handleTabChange = (next) => {
    if (next === tab) return;
    playButtonHoverSound();
    setTab(next);
  };

  const handleReset = () => {
    playButtonPressSound2();
    if (tab === "belt") {
      setPlayer1Color(SPRITE_BASE_COLOR);
    } else {
      setPlayer1BodyColor(null);
    }
  };

  // Resolve current selection details for the preview footer
  const allBelt = [...BELT_SOLIDS, ...BELT_PATTERNS];
  const selectedBelt = allBelt.find((c) => c.hex === player1Color);
  const selectedBody = BODY_COLORS.find((c) => c.hex === player1BodyColor);
  const isBeltTab = tab === "belt";

  const currentName = isBeltTab
    ? selectedBelt?.name || "Default"
    : selectedBody?.name || "Default";
  const currentCategoryLabel = isBeltTab
    ? selectedBelt?.gradient
      ? "Belt Pattern"
      : "Belt Color"
    : "Body Color";
  const currentColor = isBeltTab
    ? player1Color || SPRITE_BASE_COLOR
    : player1BodyColor || "#888";
  const currentGradient = isBeltTab
    ? selectedBelt?.gradient
    : selectedBody?.gradient;

  return (
    <PageContainer>
      <BackgroundImage src={mainMenuBackground} alt="" />
      <CinematicOverlay />
      <GrainOverlay />
      <Snowfall intensity={15} showFrost={false} zIndex={2} />

      <TopBar>
        <TopBarLeft>
          <BackButton
            onClick={() => {
              playButtonPressSound2();
              onBack();
            }}
            onMouseEnter={playButtonHoverSound}
          >
            <span className="arrow">←</span>
            Back
          </BackButton>
        </TopBarLeft>

        <TitleBlock>
          <PageTitle>Customize</PageTitle>
          <PageSubtitle>Edit Your Wrestler</PageSubtitle>
        </TitleBlock>

        <TopBarRight>
          <SaveIndicator>
            <SaveDot $busy={isLoading} />
            {isLoading ? "Saving" : "Auto-saved"}
          </SaveIndicator>
        </TopBarRight>
      </TopBar>

      <Stage>
        <PreviewPanel>
          <PanelHeader>
            <PanelHeaderLeft>
              <PanelLabel>Preview</PanelLabel>
              <PanelMeta>Mirror Reflection</PanelMeta>
            </PanelHeaderLeft>
            <LiveBadge $busy={isLoading}>
              <LiveDot $busy={isLoading} />
              {isLoading ? "Updating" : "Live"}
            </LiveBadge>
          </PanelHeader>

          <PreviewStage>
            <PreviewSpotlight />
            <AvatarBreath>
              <PreviewImage src={previewSrc} alt="Penguin preview" />
            </AvatarBreath>
          </PreviewStage>

          <PanelFooter>
            <CurrentSelection>
              <CurrentSwatch
                $color={currentColor}
                $gradient={currentGradient}
              />
              <CurrentNameStack>
                <CurrentCategory>{currentCategoryLabel}</CurrentCategory>
                <CurrentName>{currentName}</CurrentName>
              </CurrentNameStack>
            </CurrentSelection>
            <ResetButton
              onClick={handleReset}
              onMouseEnter={playButtonHoverSound}
            >
              Reset {isBeltTab ? "Belt" : "Body"}
            </ResetButton>
          </PanelFooter>
        </PreviewPanel>

        <ControlsPanel>
          <TabBar>
            <Tab
              $active={isBeltTab}
              onClick={() => handleTabChange("belt")}
              onMouseEnter={playButtonHoverSound}
            >
              <TabIcon>◉</TabIcon>
              Belt
            </Tab>
            <Tab
              $active={!isBeltTab}
              onClick={() => handleTabChange("body")}
              onMouseEnter={playButtonHoverSound}
            >
              <TabIcon>◍</TabIcon>
              Body
            </Tab>
          </TabBar>

          <ControlsBody>
            {isBeltTab ? (
              <>
                <CategorySection>
                  <SectionHeader>
                    <SectionTitle>Belt Colors</SectionTitle>
                    <SectionMeta>{BELT_SOLIDS.length} Solids</SectionMeta>
                  </SectionHeader>
                  <SwatchGrid $cols={9}>
                    {BELT_SOLIDS.map((color, i) => (
                      <SwatchCell key={color.name}>
                        <ColorSwatch
                          $index={i}
                          $color={color.hex}
                          $selected={player1Color === color.hex}
                          onClick={() => handleBeltSelect(color.hex)}
                          onMouseEnter={playButtonHoverSound}
                          title={color.name}
                          aria-label={color.name}
                        />
                        <SwatchName $selected={player1Color === color.hex}>
                          {color.name}
                        </SwatchName>
                      </SwatchCell>
                    ))}
                  </SwatchGrid>
                </CategorySection>

                <CategorySection>
                  <SectionHeader>
                    <SectionTitle>Special Patterns</SectionTitle>
                    <SectionMeta>{BELT_PATTERNS.length} Premium</SectionMeta>
                  </SectionHeader>
                  <SwatchGrid $cols={6}>
                    {BELT_PATTERNS.map((color, i) => (
                      <SwatchCell key={color.name}>
                        <PatternSwatch
                          $index={i + BELT_SOLIDS.length}
                          $color={color.hex}
                          $gradient={color.gradient}
                          $selected={player1Color === color.hex}
                          onClick={() => handleBeltSelect(color.hex)}
                          onMouseEnter={playButtonHoverSound}
                          title={color.name}
                          aria-label={color.name}
                        />
                        <SwatchName $selected={player1Color === color.hex}>
                          {color.name}
                        </SwatchName>
                      </SwatchCell>
                    ))}
                  </SwatchGrid>
                </CategorySection>
              </>
            ) : (
              <CategorySection>
                <SectionHeader>
                  <SectionTitle>Body Colors</SectionTitle>
                  <SectionMeta>{BODY_COLORS.length} Hues</SectionMeta>
                </SectionHeader>
                <SwatchGrid $cols={7}>
                  {BODY_COLORS.map((color, i) => (
                    <SwatchCell key={color.name}>
                      <ColorSwatch
                        $index={i}
                        $color={color.hex || "#888"}
                        $gradient={color.gradient}
                        $selected={player1BodyColor === color.hex}
                        onClick={() => handleBodySelect(color.hex)}
                        onMouseEnter={playButtonHoverSound}
                        title={color.name}
                        aria-label={color.name}
                      />
                      <SwatchName $selected={player1BodyColor === color.hex}>
                        {color.name}
                      </SwatchName>
                    </SwatchCell>
                  ))}
                </SwatchGrid>
              </CategorySection>
            )}
          </ControlsBody>
        </ControlsPanel>
      </Stage>
    </PageContainer>
  );
}

CustomizePage.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default CustomizePage;
