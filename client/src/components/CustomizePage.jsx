/**
 * CustomizePage — Wardrobe screen.
 *
 * Left: big rikishi (Prematch energy, no boxed portrait).
 * Right: one clear picker dock — outfit slots, then category tabs +
 * swatches in a fixed content area.
 *
 * Hair / Gear tabs are wired for a future item-grid layout.
 * Edits persist to saveStore.customization.outfits[].
 */

import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
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
import pumo from "../assets/pumo-idle.png";
import mainMenuBackground from "../assets/main-menu-bkg-3.webp";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  broadcastSlideDown,
  fadeIn,
  clipRevealLeft,
  clipRevealRight,
  clipRevealUp,
  TEXT_SHADOW_DISPLAY,
} from "./menuTheme";
import { SHADOW_GRADIENT } from "./PlayerShadow";
import {
  BELT_SOLIDS,
  BELT_PATTERNS,
  BODY_COLORS,
  BELT_ALL,
} from "../config/customizeColors";
import { loadSave, writeSave, makeDefaultSave } from "../lib/saveStore";
import {
  normalizeCustomization,
  getOutfitById,
  withOutfitPatch,
  withActiveOutfitId,
  applyOutfitToPlayer1Setters,
  makeDefaultCustomization,
} from "../lib/outfits";

const WARDROBE_TABS = [
  { id: "belt", label: "Belt", layout: "colors", ready: true },
  { id: "body", label: "Body", layout: "colors", ready: true },
  { id: "hair", label: "Hair", layout: "items", ready: false },
  { id: "accessories", label: "Gear", layout: "items", ready: false },
];

/*
 * BashoHub plaque tokens — opaque sumi lacquer + washi fibers.
 * Flat printed board, not translucent glass.
 */
const D = {
  panel: "#12151c",
  head: "#171a20",
  soft: "#22262d",
  softHover: "#2c313a",
  deep: "#0c0e14",
  chrome: "#14171e",
  border: "rgba(245, 236, 217, 0.20)",
  borderSoft: "rgba(245, 236, 217, 0.10)",
  shadow: "rgba(0, 0, 0, 0.62)",
};

const WASHI = `
  repeating-linear-gradient(
    90deg, transparent 0, transparent 3px,
    rgba(232, 210, 170, 0.045) 3px, rgba(232, 210, 170, 0.045) 4px
  ),
  repeating-linear-gradient(
    0deg, transparent 0, transparent 5px,
    rgba(232, 210, 170, 0.035) 5px, rgba(232, 210, 170, 0.035) 6px
  )
`;

// ============================================
// ANIMATIONS
// ============================================

const breathe = keyframes`
  0%, 100% { transform: scaleX(-1) scaleY(1); }
  50%      { transform: scaleX(-1) scaleY(1.03); }
`;

const brushDraw = keyframes`
  from { opacity: 0; transform: scaleX(0.15); }
  to   { opacity: 1; transform: scaleX(1); }
`;

const swatchPop = keyframes`
  from { opacity: 0; transform: scale(0.7); }
  to   { opacity: 1; transform: scale(1); }
`;

// ============================================
// SHELL
// ============================================

const PageContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: ${FONT_BODY};
  container-type: size;
  animation: ${fadeIn} 0.22s ease-out;
`;

const BackgroundImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  pointer-events: none;
`;

const StageDim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 50% 58% at 36% 46%,
      transparent 0%,
      rgba(4, 6, 10, 0.2) 50%,
      rgba(4, 6, 10, 0.8) 100%
    ),
    linear-gradient(
      180deg,
      rgba(4, 6, 10, 0.7) 0%,
      rgba(4, 6, 10, 0.12) 28%,
      rgba(4, 6, 10, 0.1) 52%,
      rgba(4, 6, 10, 0.52) 78%,
      rgba(4, 6, 10, 0.9) 100%
    ),
    linear-gradient(
      90deg,
      rgba(4, 6, 10, 0.15) 0%,
      transparent 40%,
      rgba(4, 6, 10, 0.55) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.18;
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
// TOP
// ============================================

const BackButton = styled.button`
  position: absolute;
  top: clamp(14px, 2.2cqh, 24px);
  left: clamp(18px, 2.6cqw, 36px);
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.5rem, 0.8cqw, 0.64rem);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: ${C.creamMute};
  background: none;
  border: none;
  cursor: pointer;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  transition: color 0.18s ease;
  animation: ${clipRevealLeft} 0.4s ease-out 0.05s both;

  .arrow {
    transition: transform 0.2s ease;
  }

  &:hover {
    color: ${C.cream};
    .arrow {
      transform: translateX(-3px);
    }
  }
`;

const TopSlug = styled.div`
  position: absolute;
  top: clamp(12px, 1.8cqh, 20px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  animation: ${broadcastSlideDown} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s
    both;
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
// STAGE
// ============================================

const Stage = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  /*
   * Fighter left, then dock pulled inward (not edge-hugging).
   * Trailing empty track keeps air on the right.
   */
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px) minmax(24px, 8cqw);
  align-items: center;
  gap: clamp(16px, 2.5cqw, 32px);
  padding:
    clamp(52px, 8cqh, 72px)
    clamp(20px, 3cqw, 40px)
    clamp(24px, 4cqh, 40px)
    clamp(20px, 3cqw, 40px);

  @media (max-width: 780px) {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
    align-items: end;
    gap: clamp(12px, 2cqh, 20px);
    padding-bottom: clamp(14px, 2.5cqh, 24px);
  }
`;

// --------------------------------------------
// LEFT — fighter + identity BELOW (never over the sprite)
// --------------------------------------------

const FighterColumn = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  min-width: 0;
  min-height: 0;
  height: min(84cqh, 740px);
  animation: ${clipRevealLeft} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.08s both;

  @media (max-width: 780px) {
    height: min(46cqh, 360px);
    align-items: center;
  }
`;

const Portrait = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: min(100%, 480px);
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;

  @media (max-width: 780px) {
    justify-content: center;
    max-width: none;
  }
`;

/* Shrink-wraps to the sprite so the shadow can center on him, not the column. */
const FighterFigure = styled.div`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
  width: fit-content;
  max-width: 100%;
`;

const FloorShadow = styled.div`
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 72%;
  max-width: clamp(200px, 28cqw, 330px);
  height: clamp(44px, 6cqw, 74px);
  border-radius: 50%;
  background: ${SHADOW_GRADIENT};
  z-index: 1;
  pointer-events: none;
`;

const FighterImg = styled.img`
  position: relative;
  z-index: 2;
  height: 108%;
  max-height: 108%;
  width: auto;
  max-width: min(100%, 52cqw);
  object-fit: contain;
  object-position: center bottom;
  transform-origin: center bottom;
  transform: scaleX(-1) scaleY(1);
  animation: ${breathe} 1.5s ease-in-out infinite;
  filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000)
    drop-shadow(0 14px 22px rgba(0, 0, 0, 0.45));
  opacity: ${(p) => (p.$ready ? 1 : 0.55)};
  transition: opacity 0.22s ease-out;

  @media (max-width: 780px) {
    max-width: 78vw;
  }
`;

const IdentityBlock = styled.div`
  position: relative;
  z-index: 3;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: clamp(10px, 1.6cqh, 18px);
  padding-left: clamp(4px, 0.8cqw, 12px);
  animation: ${clipRevealUp} 0.4s ease-out 0.28s both;

  @media (max-width: 780px) {
    align-items: center;
    text-align: center;
    padding-left: 0;
  }
`;

const SideLabel = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${(p) => p.$accent || C.ice};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  line-height: 1;
  margin-bottom: clamp(4px, 0.5cqh, 7px);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
`;

const FighterName = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(22px, 3.4cqw, 42px);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 0.92;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  white-space: nowrap;
`;

const BrushStroke = styled.div`
  width: clamp(110px, 15cqw, 200px);
  height: 3px;
  margin-top: clamp(5px, 0.7cqh, 8px);
  background: ${(p) => p.$gradient || p.$color};
  transform-origin: left center;
  clip-path: polygon(
    0 30%,
    8% 0%,
    40% 20%,
    70% 0%,
    100% 35%,
    94% 100%,
    60% 80%,
    30% 100%,
    0 70%
  );
  animation: ${brushDraw} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.4s both;

  @media (max-width: 780px) {
    transform-origin: center;
  }
`;

const MetaItem = styled.span`
  margin-top: clamp(6px, 0.85cqh, 10px);
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.4rem, 0.65cqw, 0.5rem);
  color: rgba(245, 236, 217, 0.5);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
`;

// --------------------------------------------
// RIGHT — BashoHub lacquer plaque (opaque, washi, vermillion crown)
// --------------------------------------------

const PickerDock = styled.aside`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  /* Fixed footprint — tab content scrolls inside, dock never resizes */
  height: min(68cqh, 520px);
  min-height: 0;
  justify-self: stretch;
  background:
    ${WASHI},
    linear-gradient(180deg, #161a22 0%, #10141b 100%);
  border: 1px solid ${D.border};
  border-radius: 0;
  overflow: hidden;
  box-shadow: 0 16px 36px ${D.shadow};
  animation: ${clipRevealRight} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.14s both;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${C.vermillion};
    z-index: 3;
  }

  @media (max-width: 780px) {
    height: min(38cqh, 320px);
  }
`;

const PanelHead = styled.header`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: clamp(9px, 1.2cqh, 13px) clamp(14px, 1.8cqw, 22px);
  background: ${D.head};
  border-bottom: 1px solid ${D.borderSoft};

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: ${WASHI};
    opacity: 0.7;
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }
`;

const HeadTitle = styled.h2`
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.68rem, 1.05cqw, 0.88rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow: ${TEXT_SHADOW_DISPLAY};

  &::before {
    content: "";
    width: clamp(14px, 1.8cqw, 20px);
    height: 2px;
    background: ${C.vermillion};
  }
`;

const HeadMeta = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.62cqw, 0.48rem);
  color: ${(p) => (p.$accent ? C.ice : C.creamMute)};
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const OutfitSlotBar = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: clamp(6px, 0.9cqw, 8px);
  padding: clamp(10px, 1.3cqh, 12px) clamp(14px, 1.8cqw, 20px) 0;
  background: ${D.chrome};
`;

const OutfitSlot = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  min-width: 0;
  padding: clamp(6px, 0.8cqh, 8px);
  background: ${(p) => (p.$active ? D.softHover : D.soft)};
  border: 1px solid ${(p) => (p.$active ? C.gold : D.borderSoft)};
  border-radius: 0;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: ${(p) => (p.$active ? C.gold : "rgba(245, 236, 217, 0.35)")};
    background: ${D.softHover};
  }
`;

const OutfitSlotSwatches = styled.span`
  display: flex;
  height: clamp(10px, 1.3cqh, 14px);
  border: 1px solid rgba(245, 236, 217, 0.18);
  overflow: hidden;
`;

const OutfitSlotBelt = styled.span`
  flex: 1.15;
  background: ${(p) => p.$gradient || p.$color || SPRITE_BASE_COLOR};
`;

const OutfitSlotBody = styled.span`
  flex: 1;
  background: ${(p) => p.$gradient || p.$color || "#888"};
`;

const OutfitSlotLabel = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.38rem, 0.58cqw, 0.46rem);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${(p) => (p.$active ? C.cream : C.creamMute)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
`;

const TabBar = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: clamp(6px, 0.9cqw, 8px);
  padding: clamp(10px, 1.3cqh, 14px) clamp(14px, 1.8cqw, 20px);
  background: ${D.chrome};
  border-bottom: 1px solid ${D.borderSoft};
`;

const Tab = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  min-height: clamp(36px, 4.5cqh, 44px);
  padding: clamp(6px, 0.8cqh, 9px) 4px;
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.74cqw, 0.6rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${(p) => {
    if (p.$active) return C.cream;
    if (!p.$ready) return "rgba(245, 236, 217, 0.28)";
    return C.creamMute;
  }};
  background: ${(p) => (p.$active ? D.softHover : D.soft)};
  border: 1px solid
    ${(p) => (p.$active ? C.cream : D.borderSoft)};
  border-radius: 0;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;

  &:hover {
    color: ${(p) => (!p.$ready && !p.$active ? "rgba(245, 236, 217, 0.4)" : C.cream)};
    border-color: ${(p) => (p.$active ? C.cream : "rgba(245, 236, 217, 0.35)")};
    background: ${D.softHover};
  }
`;

const TabSoon = styled.span`
  font-size: 0.72em;
  letter-spacing: 0.16em;
  color: ${C.gold};
  opacity: 0.85;
`;

const PickerBody = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  padding: clamp(14px, 1.9cqh, 20px) clamp(14px, 1.8cqw, 20px);

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${C.vermillion};
  }
`;

/* Stable content shell — every tab fills the same body region */
const Pane = styled.div`
  flex: 1;
  min-height: 100%;
  display: flex;
  flex-direction: column;
`;

const ColorGroup = styled.section`
  display: flex;
  flex-direction: column;
  gap: clamp(9px, 1.2cqh, 12px);
  margin-bottom: clamp(16px, 2.2cqh, 22px);

  &:last-child {
    margin-bottom: 0;
  }
`;

const GroupHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const GroupLabel = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 10px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.74cqw, 0.6rem);
  color: ${C.cream};
  letter-spacing: 0.26em;
  text-transform: uppercase;

  &::before {
    content: "";
    width: clamp(10px, 1.4cqw, 14px);
    height: 2px;
    background: ${C.vermillion};
  }
`;

const GroupMeta = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.62cqw, 0.48rem);
  color: rgba(245, 236, 217, 0.35);
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const SwatchGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: clamp(9px, 1.1cqw, 12px);
  padding: 4px;
  margin: -4px;
`;

const ColorSwatch = styled.button`
  width: clamp(32px, 3.8cqw, 42px);
  height: clamp(32px, 3.8cqw, 42px);
  flex: 0 0 auto;
  border-radius: ${(p) => (p.$square ? "2px" : "50%")};
  border: 2px solid ${(p) => (p.$selected ? C.gold : D.border)};
  background: ${(p) => p.$gradient || p.$color};
  cursor: pointer;
  box-shadow: ${(p) =>
    p.$selected
      ? `0 0 0 2px rgba(232, 197, 71, 0.45), 0 2px 6px ${D.shadow}`
      : `0 2px 5px ${D.shadow}`};
  animation: ${swatchPop} 0.24s ease-out both;
  animation-delay: ${(p) => Math.min(p.$index ?? 0, 14) * 0.015}s;
  transition: transform 0.14s ease, border-color 0.16s ease;

  &:hover {
    transform: scale(1.1);
    border-color: ${(p) => (p.$selected ? C.gold : C.cream)};
    z-index: 1;
  }

  &:active {
    transform: scale(0.94);
  }
`;

const SoonWrap = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: clamp(12px, 1.8cqh, 18px);
  padding: clamp(6px, 1cqh, 12px) 0;
`;

const SoonTitle = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.72rem, 1.1cqw, 0.9rem);
  color: ${C.gold};
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
`;

const SoonCopy = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.7rem, 0.98cqw, 0.82rem);
  color: ${C.creamMute};
  letter-spacing: 0.03em;
  line-height: 1.45;
  max-width: 32ch;
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(8px, 1.1cqw, 12px);
  width: 100%;
`;

const ItemSlot = styled.div`
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${D.deep};
  border: 1px solid ${D.borderSoft};
  color: rgba(245, 236, 217, 0.22);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.85rem, 1.3cqw, 1.1rem);
`;

const PickerFooter = styled.footer`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: clamp(10px, 1.3cqh, 14px) clamp(14px, 1.8cqw, 20px);
  border-top: 1px solid ${D.borderSoft};
  background: ${D.chrome};
`;

const FooterHint = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.62cqw, 0.48rem);
  color: rgba(245, 236, 217, 0.4);
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const ResetButton = styled.button`
  min-height: 32px;
  padding: 6px 14px;
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.68cqw, 0.52rem);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${C.creamMute};
  background: ${D.soft};
  border: 1px solid ${D.borderSoft};
  border-radius: 0;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    color: ${C.cream};
    border-color: rgba(245, 236, 217, 0.35);
    background: ${D.softHover};
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

// ============================================
// COMPONENT
// ============================================

function resolveAccent(color, gradient) {
  if (gradient) return C.gold;
  if (!color || color === SPRITE_BASE_COLOR) return C.ice;
  return color;
}

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
  const [customization, setCustomization] = useState(() =>
    makeDefaultCustomization(),
  );
  const [selectedOutfitId, setSelectedOutfitId] = useState(
    makeDefaultCustomization().activeOutfitId,
  );
  const [saveState, setSaveState] = useState("loading"); // loading | saved | saving
  const mountedRef = useRef(true);
  const saveDocRef = useRef(null);
  const saveTimerRef = useRef(null);
  const hydratedRef = useRef(false);
  const customizationRef = useRef(customization);
  const selectedOutfitIdRef = useRef(selectedOutfitId);
  customizationRef.current = customization;
  selectedOutfitIdRef.current = selectedOutfitId;

  const persistCustomization = useCallback(async (nextCustomization) => {
    const normalized = normalizeCustomization(nextCustomization);
    customizationRef.current = normalized;
    setCustomization(normalized);
    setSaveState("saving");
    const base = saveDocRef.current || makeDefaultSave();
    const written = await writeSave({
      ...base,
      customization: normalized,
    });
    if (!mountedRef.current) return;
    saveDocRef.current = written;
    setSaveState("saved");
  }, []);

  const schedulePersist = useCallback(
    (nextCustomization) => {
      const normalized = normalizeCustomization(nextCustomization);
      customizationRef.current = normalized;
      setCustomization(normalized);
      setSaveState("saving");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistCustomization(normalized);
      }, 280);
    },
    [persistCustomization],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSave().then((doc) => {
      if (cancelled) return;
      saveDocRef.current = doc;
      const c = normalizeCustomization(doc.customization);
      setCustomization(c);
      setSelectedOutfitId(c.activeOutfitId);
      const outfit = getOutfitById(c, c.activeOutfitId);
      applyOutfitToPlayer1Setters(outfit, {
        setPlayer1Color,
        setPlayer1BodyColor,
      });
      hydratedRef.current = true;
      setSaveState("saved");
    });
    return () => {
      cancelled = true;
    };
  }, [setPlayer1Color, setPlayer1BodyColor]);

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

  const activeTab = WARDROBE_TABS.find((t) => t.id === tab) || WARDROBE_TABS[0];
  const isBelt = tab === "belt";
  const isBody = tab === "body";
  const canReset = activeTab.ready && activeTab.layout === "colors";
  const editingOutfit = getOutfitById(customization, selectedOutfitId);

  const selectedBelt = BELT_ALL.find((c) => c.hex === player1Color);
  const selectedBody = BODY_COLORS.find((c) => c.hex === player1BodyColor);

  const showingBody = isBody;
  const currentName = showingBody
    ? selectedBody?.name || "Default"
    : selectedBelt?.name || "Default";
  const brushColor = showingBody
    ? player1BodyColor || "#888"
    : player1Color || SPRITE_BASE_COLOR;
  const brushGradient = showingBody
    ? selectedBody?.gradient
    : selectedBelt?.gradient;
  const accent = resolveAccent(brushColor, brushGradient);

  const handleTab = (id) => {
    if (id === tab) return;
    playButtonHoverSound();
    setTab(id);
  };

  const handleOutfitSelect = (outfitId) => {
    if (outfitId === selectedOutfitIdRef.current) return;
    playButtonPressSound2();
    const outfit = getOutfitById(customizationRef.current, outfitId);
    selectedOutfitIdRef.current = outfitId;
    setSelectedOutfitId(outfitId);
    applyOutfitToPlayer1Setters(outfit, {
      setPlayer1Color,
      setPlayer1BodyColor,
    });
    const next = withActiveOutfitId(customizationRef.current, outfitId);
    schedulePersist(next);
  };

  const commitOutfitPatch = (patch) => {
    if (!hydratedRef.current) return;
    const outfitId = selectedOutfitIdRef.current;
    let next = withOutfitPatch(customizationRef.current, outfitId, patch);
    next = withActiveOutfitId(next, outfitId);
    const outfit = getOutfitById(next, outfitId);
    applyOutfitToPlayer1Setters(outfit, {
      setPlayer1Color,
      setPlayer1BodyColor,
    });
    schedulePersist(next);
  };

  const handleBeltSelect = (hex) => {
    playButtonPressSound2();
    commitOutfitPatch({ mawashiColor: hex });
  };

  const handleBodySelect = (hex) => {
    playButtonPressSound2();
    commitOutfitPatch({ bodyColor: hex });
  };

  const handleReset = () => {
    if (!canReset) return;
    playButtonPressSound2();
    if (isBelt) commitOutfitPatch({ mawashiColor: SPRITE_BASE_COLOR });
    else if (isBody) commitOutfitPatch({ bodyColor: null });
  };

  const renderPickerContent = () => {
    if (activeTab.layout === "colors" && activeTab.ready) {
      if (isBelt) {
        return (
          <Pane>
            <ColorGroup>
              <GroupHead>
                <GroupLabel>Solids</GroupLabel>
                <GroupMeta>{BELT_SOLIDS.length}</GroupMeta>
              </GroupHead>
              <SwatchGrid>
                {BELT_SOLIDS.map((color, i) => (
                  <ColorSwatch
                    key={color.name}
                    type="button"
                    $index={i}
                    $color={color.hex}
                    $selected={player1Color === color.hex}
                    onClick={() => handleBeltSelect(color.hex)}
                    onMouseEnter={playButtonHoverSound}
                    title={color.name}
                    aria-label={color.name}
                  />
                ))}
              </SwatchGrid>
            </ColorGroup>
            <ColorGroup>
              <GroupHead>
                <GroupLabel>Patterns</GroupLabel>
                <GroupMeta>{BELT_PATTERNS.length}</GroupMeta>
              </GroupHead>
              <SwatchGrid>
                {BELT_PATTERNS.map((color, i) => (
                  <ColorSwatch
                    key={color.name}
                    type="button"
                    $square
                    $index={i + BELT_SOLIDS.length}
                    $color={color.hex}
                    $gradient={color.gradient}
                    $selected={player1Color === color.hex}
                    onClick={() => handleBeltSelect(color.hex)}
                    onMouseEnter={playButtonHoverSound}
                    title={color.name}
                    aria-label={color.name}
                  />
                ))}
              </SwatchGrid>
            </ColorGroup>
          </Pane>
        );
      }

      return (
        <Pane>
          <ColorGroup>
            <GroupHead>
              <GroupLabel>Hues</GroupLabel>
              <GroupMeta>{BODY_COLORS.length}</GroupMeta>
            </GroupHead>
            <SwatchGrid>
              {BODY_COLORS.map((color, i) => (
                <ColorSwatch
                  key={color.name}
                  type="button"
                  $index={i}
                  $color={color.hex || "#888"}
                  $gradient={color.gradient}
                  $selected={player1BodyColor === color.hex}
                  onClick={() => handleBodySelect(color.hex)}
                  onMouseEnter={playButtonHoverSound}
                  title={color.name}
                  aria-label={color.name}
                />
              ))}
            </SwatchGrid>
          </ColorGroup>
        </Pane>
      );
    }

    return (
      <Pane>
        <SoonWrap>
          <SoonTitle>Coming Soon</SoonTitle>
          <SoonCopy>
            {activeTab.label} unlocks later — topknots, ornaments, and
            kesho-mawashi pieces.
          </SoonCopy>
          <ItemGrid aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <ItemSlot key={i}>?</ItemSlot>
            ))}
          </ItemGrid>
        </SoonWrap>
      </Pane>
    );
  };

  return (
    <PageContainer>
      <BackgroundImage src={mainMenuBackground} alt="" />
      <StageDim />
      <GrainOverlay />

      <BackButton
        type="button"
        onClick={() => {
          playButtonPressSound2();
          onBack();
        }}
        onMouseEnter={playButtonHoverSound}
      >
        <span className="arrow">←</span>
        Back
      </BackButton>

      <TopSlug>
        <SlugText $accent>
          <strong>VER.</strong> HATSU
        </SlugText>
        <SlugRule aria-hidden />
        <SlugText>Wardrobe</SlugText>
      </TopSlug>

      <Stage>
        <FighterColumn>
          <Portrait>
            <FighterFigure>
              <FloorShadow />
              <FighterImg
                src={previewSrc}
                alt="Your wrestler"
                $ready={!isLoading}
              />
            </FighterFigure>
          </Portrait>
          <IdentityBlock>
            <SideLabel $accent={accent}>{editingOutfit.name}</SideLabel>
            <FighterName>{currentName}</FighterName>
            <BrushStroke $color={brushColor} $gradient={brushGradient} />
            <MetaItem>
              {isLoading
                ? "Updating…"
                : saveState === "saving"
                  ? "Saving…"
                  : saveState === "loading"
                    ? "Loading…"
                    : "Auto-saved"}
            </MetaItem>
          </IdentityBlock>
        </FighterColumn>

        <PickerDock>
          <PanelHead>
            <HeadTitle>Wardrobe</HeadTitle>
            <HeadMeta $accent={activeTab.ready}>
              {activeTab.ready ? activeTab.label : `${activeTab.label} · Soon`}
            </HeadMeta>
          </PanelHead>

          <OutfitSlotBar role="listbox" aria-label="Outfit presets">
            {customization.outfits.map((outfit) => {
              const belt = BELT_ALL.find((c) => c.hex === outfit.mawashiColor);
              const body = BODY_COLORS.find((c) => c.hex === outfit.bodyColor);
              const active = outfit.id === selectedOutfitId;
              return (
                <OutfitSlot
                  key={outfit.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  $active={active}
                  onClick={() => handleOutfitSelect(outfit.id)}
                  onMouseEnter={playButtonHoverSound}
                  title={outfit.name}
                >
                  <OutfitSlotSwatches>
                    <OutfitSlotBelt
                      $color={outfit.mawashiColor || SPRITE_BASE_COLOR}
                      $gradient={belt?.gradient}
                    />
                    <OutfitSlotBody
                      $color={outfit.bodyColor || "#888"}
                      $gradient={body?.gradient}
                    />
                  </OutfitSlotSwatches>
                  <OutfitSlotLabel $active={active}>
                    {outfit.name}
                  </OutfitSlotLabel>
                </OutfitSlot>
              );
            })}
          </OutfitSlotBar>

          <TabBar role="tablist" aria-label="Wardrobe categories">
            {WARDROBE_TABS.map((t) => (
              <Tab
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                $active={tab === t.id}
                $ready={t.ready}
                onClick={() => handleTab(t.id)}
                onMouseEnter={playButtonHoverSound}
                title={t.ready ? t.label : `${t.label} — coming soon`}
              >
                {t.label}
                {!t.ready && <TabSoon>Soon</TabSoon>}
              </Tab>
            ))}
          </TabBar>

          <PickerBody>{renderPickerContent()}</PickerBody>

          <PickerFooter>
            <FooterHint>
              {activeTab.ready
                ? `Editing ${editingOutfit.name}`
                : `${activeTab.label} catalog`}
            </FooterHint>
            <ResetButton
              type="button"
              disabled={!canReset}
              onClick={handleReset}
              onMouseEnter={canReset ? playButtonHoverSound : undefined}
            >
              Reset
            </ResetButton>
          </PickerFooter>
        </PickerDock>
      </Stage>
    </PageContainer>
  );
}

CustomizePage.propTypes = {
  onBack: PropTypes.func.isRequired,
};

export default CustomizePage;
