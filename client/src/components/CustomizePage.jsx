/**
 * CustomizePage — Wardrobe.
 *
 * Left: rikishi on the stage.
 * Right: fixed lacquer plaque — Looks, Body / Belt / Head, picker.
 * Head is the exclusive topper slot. Edits auto-save to outfits[].
 */

import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import { usePlayerColors } from "../context/PlayerColorContext";
import { SPRITE_BASE_COLOR } from "../utils/SpriteRecolorizer";
import {
  playButtonHoverSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import pumo from "../assets/pumo-idle.png";
import {
  C,
  FONT_BODY,
  FONT_UI,
  FONT_WEIGHT,
  TRACK,
  broadcastSlideDown,
  fadeIn,
  clipRevealLeft,
  clipRevealRight,
  clipRevealUp,
  TEXT_SHADOW_DISPLAY,
} from "./menuTheme";
import {
  BELT_SOLIDS,
  BELT_PATTERNS,
  BODY_COLORS,
  BELT_ALL,
} from "../config/customizeColors";
import {
  HEAD_CATALOG,
  getEquippedHeadGearId,
  getGearById,
  withHeadGear,
} from "../config/cosmetics";
import { buildIdlePortraitSrc } from "../utils/hatComposite";
import { loadSave, patchSave } from "../lib/saveStore";
import {
  normalizeCustomization,
  getOutfitById,
  withOutfitPatch,
  withActiveOutfitId,
  applyOutfitToPlayer1Setters,
  makeDefaultCustomization,
} from "../lib/outfits";

const TABS = [
  { id: "body", label: "Body" },
  { id: "belt", label: "Belt" },
  { id: "head", label: "Head" },
];

/* Fixed plaque footprint — never grows/shrinks with tab content */
const DOCK_H = "min(68cqh, 520px)";

const D = {
  head: "#171a20",
  soft: "#22262d",
  softHover: "#2c313a",
  deep: "#0c0e14",
  chrome: "#14171e",
  border: "rgba(245, 236, 217, 0.22)",
  borderSoft: "rgba(245, 236, 217, 0.12)",
  shadow: "rgba(0, 0, 0, 0.62)",
};

const WASHI = `
  repeating-linear-gradient(
    90deg, transparent 0, transparent 3px,
    rgba(232, 210, 170, 0.04) 3px, rgba(232, 210, 170, 0.04) 4px
  ),
  repeating-linear-gradient(
    0deg, transparent 0, transparent 5px,
    rgba(232, 210, 170, 0.03) 5px, rgba(232, 210, 170, 0.03) 6px
  )
`;

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

const paneIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ============================================
// SHELL
// ============================================

const STUDIO_FLOOR_H = "36%";

const PageContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: ${FONT_BODY};
  container-type: size;
  animation: ${fadeIn} 0.22s ease-out;
  background: #f0f0ee;
`;

/*
 * Photo studio — lit white wall, pale floor that falls off toward camera.
 * Seam + contact shadow sell the corner; floor stays light, not muddy.
 */
const StudioWall = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 52% 48% at 36% 32%,
      #ffffff 0%,
      #f8f8f6 55%,
      #f1f1ef 100%
    ),
    linear-gradient(180deg, #fcfcfb 0%, #f4f4f2 100%);
`;

const StudioFloor = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${STUDIO_FLOOR_H};
  z-index: 1;
  pointer-events: none;
  background:
    /* near-white floor; slight falloff toward camera */
    linear-gradient(
      180deg,
      #f4f4f2 0%,
      #f0f0ee 40%,
      #e9e9e7 75%,
      #e2e2e0 100%
    );

  /* Seam — warm charcoal, soft at edges */
  &::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(40, 38, 34, 0.18) 10%,
      rgba(40, 38, 34, 0.26) 50%,
      rgba(40, 38, 34, 0.18) 90%,
      transparent 100%
    );
  }

  /* Contact shadow on the floor just under the seam — sells the corner */
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 1px;
    height: clamp(28px, 5cqh, 48px);
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0.04) 45%,
      transparent 100%
    );
    pointer-events: none;
  }
`;

const StudioCorner = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: min(24cqw, 300px);
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.055) 0%,
    rgba(0, 0, 0, 0.02) 50%,
    transparent 100%
  );
`;

const StudioLight = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 58% 30% at 36% -2%,
      rgba(255, 255, 255, 0.95) 0%,
      transparent 68%
    ),
    radial-gradient(
      ellipse 40% 36% at 34% 40%,
      rgba(255, 255, 255, 0.4) 0%,
      transparent 70%
    ),
    linear-gradient(
      90deg,
      transparent 0%,
      transparent 58%,
      rgba(0, 0, 0, 0.04) 85%,
      rgba(0, 0, 0, 0.1) 100%
    );
`;

const StudioGrain = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.03;
  mix-blend-mode: multiply;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.04) 0,
      transparent 1px,
      transparent 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.03) 0,
      transparent 1px,
      transparent 4px
    );
`;

const BackButton = styled.button`
  position: absolute;
  top: clamp(14px, 2.2cqh, 24px);
  left: clamp(18px, 2.6cqw, 36px);
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.5rem, 0.8cqw, 0.64rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  color: rgba(40, 32, 24, 0.55);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.18s ease;
  animation: ${clipRevealLeft} 0.4s ease-out 0.05s both;

  .arrow {
    transition: transform 0.2s ease;
  }

  &:hover {
    color: rgba(40, 32, 24, 0.9);
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
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.42rem, 0.72cqw, 0.56rem);
  color: ${(p) => (p.$accent ? C.vermillion : "rgba(40, 32, 24, 0.45)")};
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;

  strong {
    color: rgba(40, 32, 24, 0.85);
    letter-spacing: 0.1em;
  }
`;

const SlugRule = styled.span`
  width: 16px;
  height: 1px;
  background: rgba(40, 32, 24, 0.22);
`;

// ============================================
// STAGE — fighter left, dock right (fixed)
// ============================================

const Stage = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
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
    grid-template-rows: minmax(0, 1fr) ${DOCK_H};
    align-items: end;
    gap: clamp(12px, 2cqh, 20px);
    padding-bottom: clamp(14px, 2.5cqh, 24px);
  }
`;

/* Big rikishi — owns the whole left column. */
const FighterColumn = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  min-width: 0;
  min-height: 0;
  width: 100%;
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
  max-width: min(100%, 520px);
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;

  @media (max-width: 780px) {
    justify-content: center;
    max-width: none;
  }
`;

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
  background:
    radial-gradient(
      ellipse 38% 48% at 50% 50%,
      rgba(0, 0, 0, 0.3) 0%,
      rgba(0, 0, 0, 0.12) 42%,
      transparent 72%
    ),
    radial-gradient(
      ellipse 85% 75% at 50% 50%,
      rgba(0, 0, 0, 0.1) 0%,
      transparent 70%
    );
  z-index: 1;
  pointer-events: none;
`;

const FighterSpriteStack = styled.div`
  position: relative;
  z-index: 2;
  width: min(56cqw, 100%, calc(min(84cqh, 740px) * 0.9));
  aspect-ratio: 1 / 1;
  height: auto;
  transform-origin: center bottom;
  transform: scaleX(-1) scaleY(1);
  animation: ${breathe} 1.5s ease-in-out infinite;
  filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.18));
  opacity: ${(p) => (p.$ready ? 1 : 0.55)};
  transition: opacity 0.22s ease-out;
  /* Decorative — never steal clicks from the picker dock. */
  pointer-events: none;

  @media (max-width: 780px) {
    width: min(78vw, calc(min(46cqh, 360px) * 0.95));
  }
`;

const FighterImg = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
`;

const IdentityBlock = styled.div`
  position: relative;
  z-index: 3;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: clamp(8px, 1.2cqh, 14px);
  padding-left: clamp(4px, 0.8cqw, 12px);
  animation: ${clipRevealUp} 0.4s ease-out 0.28s both;

  @media (max-width: 780px) {
    align-items: center;
    text-align: center;
    padding-left: 0;
  }
`;

const SideLabel = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${(p) => p.$accent || C.vermillion};
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  line-height: 1;
  margin-bottom: clamp(4px, 0.5cqh, 7px);
`;

const FighterName = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(22px, 3.4cqw, 42px);
  color: #1a1410;
  text-transform: uppercase;
  letter-spacing: ${TRACK.meta};
  line-height: 0.92;
  white-space: nowrap;
`;

const BrushStroke = styled.div`
  width: clamp(110px, 15cqw, 200px);
  height: 3px;
  margin-top: clamp(5px, 0.7cqh, 8px);
  background: ${(p) => p.$gradient || p.$color || C.vermillion};
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
  animation: ${brushDraw} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) both;

  @media (max-width: 780px) {
    transform-origin: center;
  }
`;

const MetaItem = styled.span`
  margin-top: clamp(6px, 0.85cqh, 10px);
  font-family: ${FONT_BODY};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.4rem, 0.65cqw, 0.5rem);
  color: rgba(40, 32, 24, 0.4);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
`;

// --------------------------------------------
// RIGHT — lacquer plaque (FIXED height)
// --------------------------------------------

const PickerDock = styled.aside`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: ${DOCK_H};
  min-height: ${DOCK_H};
  max-height: ${DOCK_H};
  justify-self: stretch;
  background:
    ${WASHI},
    linear-gradient(180deg, #161a22 0%, #10141b 100%);
  border: 1px solid ${D.border};
  overflow: hidden;
  box-shadow: 0 16px 36px ${D.shadow};
  animation: ${clipRevealRight} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.14s both;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      ${C.vermillionDeep},
      ${C.vermillionBright},
      ${C.vermillionDeep}
    );
    z-index: 3;
  }

  @media (max-width: 780px) {
    height: 100%;
    min-height: 0;
    max-height: none;
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
    opacity: 0.55;
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
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.68rem, 1.05cqw, 0.88rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  text-shadow: ${TEXT_SHADOW_DISPLAY};

  &::before {
    content: "";
    width: clamp(14px, 1.8cqw, 20px);
    height: 2px;
    background: ${C.vermillion};
  }
`;

const HeadMeta = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.4rem, 0.62cqw, 0.48rem);
  color: ${C.creamMute};
  letter-spacing: ${TRACK.label};
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
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  min-width: 0;
  min-height: clamp(40px, 5cqh, 48px);
  padding: clamp(6px, 0.8cqh, 8px);
  background: ${(p) => (p.$active ? D.softHover : D.soft)};
  border: 1px solid ${(p) => (p.$active ? C.gold : D.borderSoft)};
  cursor: pointer;
  touch-action: manipulation;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    border-color: ${(p) => (p.$active ? C.gold : "rgba(245, 236, 217, 0.35)")};
    background: ${D.softHover};
  }

  &:disabled {
    cursor: default;
    opacity: 0.55;
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
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.38rem, 0.58cqw, 0.46rem);
  letter-spacing: ${TRACK.label};
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
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: clamp(36px, 4.5cqh, 44px);
  padding: clamp(6px, 0.8cqh, 9px) 4px;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.48rem, 0.74cqw, 0.6rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  color: ${(p) => (p.$active ? C.cream : C.creamMute)};
  background: ${(p) => (p.$active ? D.softHover : D.soft)};
  border: 1px solid ${(p) => (p.$active ? C.cream : D.borderSoft)};
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;

  &:hover {
    color: ${C.cream};
    border-color: ${(p) => (p.$active ? C.cream : "rgba(245, 236, 217, 0.35)")};
    background: ${D.softHover};
  }
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

const Pane = styled.div`
  flex: 1;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  animation: ${paneIn} 0.22s ease-out both;
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

const GroupLabel = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 10px);
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.48rem, 0.74cqw, 0.6rem);
  color: ${C.cream};
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;

  &::before {
    content: "";
    width: clamp(10px, 1.4cqw, 14px);
    height: 2px;
    background: ${C.vermillion};
  }
`;

const SwatchGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: clamp(9px, 1.1cqw, 12px);
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
      ? `0 0 0 2px rgba(232, 197, 71, 0.4), 0 2px 6px ${D.shadow}`
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

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(8px, 1.1cqw, 12px);
  width: 100%;
`;

const ItemSlot = styled.button`
  aspect-ratio: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0;
  padding: clamp(6px, 0.9cqw, 9px);
  background: ${(p) => (p.$selected ? D.softHover : D.deep)};
  border: 1px solid ${(p) => (p.$selected ? C.gold : D.borderSoft)};
  box-shadow: ${(p) =>
    p.$selected ? `inset 0 0 0 1px ${C.gold}` : "none"};
  color: ${(p) => (p.$selected ? C.cream : "rgba(245, 236, 217, 0.45)")};
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.65cqw, 0.52rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${D.softHover};
    color: ${C.cream};
  }
`;

/** Fixed icon well — images never dictate tile height. */
const ItemIcon = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    display: block;
    max-width: 78%;
    max-height: 78%;
    width: auto;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));
    transform: ${(p) => p.$iconTransform || "none"};
    transform-origin: center center;
  }
`;

const ItemLabel = styled.span`
  flex: 0 0 auto;
  display: block;
  width: 100%;
  margin-top: 4px;
  height: 1.35em;
  line-height: 1.35em;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const UnequipSlot = styled(ItemSlot)`
  color: rgba(245, 236, 217, 0.35);
  align-items: center;
  justify-content: center;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.7rem, 1.1cqw, 0.9rem);
`;

const HatTunerLink = styled.button`
  margin-top: clamp(10px, 1.4cqh, 14px);
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.68cqw, 0.52rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  color: rgba(245, 236, 217, 0.4);
  transition: color 0.15s ease;

  &:hover {
    color: ${C.gold};
  }
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
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.4rem, 0.62cqw, 0.48rem);
  color: rgba(245, 236, 217, 0.4);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
`;

const ResetButton = styled.button`
  min-height: 32px;
  padding: 6px 14px;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.68cqw, 0.52rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  color: ${C.creamMute};
  background: ${D.soft};
  border: 1px solid ${D.borderSoft};
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
  if (!color || color === SPRITE_BASE_COLOR) return C.gold;
  return color;
}

function CustomizePage({ onBack, onOpenHatTuner }) {
  const {
    player1Color,
    setPlayer1Color,
    player1BodyColor,
    setPlayer1BodyColor,
  } = usePlayerColors();

  const [previewSrc, setPreviewSrc] = useState(pumo);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState("body");
  const [customization, setCustomization] = useState(() =>
    makeDefaultCustomization(),
  );
  const [selectedOutfitId, setSelectedOutfitId] = useState(
    makeDefaultCustomization().activeOutfitId,
  );
  const [saveState, setSaveState] = useState("loading");
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
    // Patch only customization so a flush can't wipe bashoRun / career.
    const written = await patchSave({ customization: normalized });
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

  const flushCustomization = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!hydratedRef.current || !customizationRef.current) return;
    const normalized = normalizeCustomization(customizationRef.current);
    setSaveState("saving");
    const written = await patchSave({ customization: normalized });
    if (!mountedRef.current) return;
    saveDocRef.current = written;
    customizationRef.current = normalized;
    setCustomization(normalized);
    setSaveState("saved");
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Fire-and-forget safety net; Back awaits flushCustomization first.
      if (hydratedRef.current && customizationRef.current) {
        patchSave({
          customization: normalizeCustomization(customizationRef.current),
        });
      }
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
      applyOutfitToPlayer1Setters(getOutfitById(c, c.activeOutfitId), {
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

  const editingOutfit = getOutfitById(customization, selectedOutfitId);
  const equippedHeadGearId = getEquippedHeadGearId(editingOutfit);
  const equippedHeadGear = getGearById(equippedHeadGearId);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    buildIdlePortraitSrc({
      baseSrc: pumo,
      mawashiColor: player1Color,
      bodyColor: player1BodyColor,
      gearIds: editingOutfit?.gearIds,
    })
      .then((src) => {
        if (!cancelled && mountedRef.current) setPreviewSrc(src);
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) setPreviewSrc(pumo);
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [player1Color, player1BodyColor, equippedHeadGearId, selectedOutfitId]);

  const isBelt = tab === "belt";
  const isBody = tab === "body";
  const isHead = tab === "head";
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  const canReset = !isHead || !!equippedHeadGearId;

  const selectedBelt = BELT_ALL.find((c) => c.hex === player1Color);
  const selectedBody = BODY_COLORS.find((c) => c.hex === player1BodyColor);

  const currentName = isHead
    ? equippedHeadGear?.name || "Bare"
    : isBody
      ? selectedBody?.name || "Default"
      : selectedBelt?.name || "Default";

  const brushColor = isBody
    ? player1BodyColor || "#888"
    : isHead
      ? C.gold
      : player1Color || SPRITE_BASE_COLOR;
  const brushGradient = isBody
    ? selectedBody?.gradient
    : isHead
      ? null
      : selectedBelt?.gradient;
  const accent = resolveAccent(
    isHead ? C.gold : brushColor,
    brushGradient,
  );

  const commitOutfitPatch = (patch) => {
    if (!hydratedRef.current) return;
    const outfitId = selectedOutfitIdRef.current;
    let next = withOutfitPatch(customizationRef.current, outfitId, patch);
    next = withActiveOutfitId(next, outfitId);
    applyOutfitToPlayer1Setters(getOutfitById(next, outfitId), {
      setPlayer1Color,
      setPlayer1BodyColor,
    });
    schedulePersist(next);
  };

  const handleOutfitSelect = (outfitId) => {
    if (!hydratedRef.current) return;
    if (outfitId === selectedOutfitIdRef.current) return;
    playButtonPressSound2();
    selectedOutfitIdRef.current = outfitId;
    setSelectedOutfitId(outfitId);
    applyOutfitToPlayer1Setters(
      getOutfitById(customizationRef.current, outfitId),
      { setPlayer1Color, setPlayer1BodyColor },
    );
    schedulePersist(withActiveOutfitId(customizationRef.current, outfitId));
  };

  const handleBack = async () => {
    playButtonPressSound2();
    await flushCustomization();
    onBack();
  };

  const handleReset = () => {
    if (!canReset) return;
    playButtonPressSound2();
    if (isBelt) commitOutfitPatch({ mawashiColor: SPRITE_BASE_COLOR });
    else if (isBody) commitOutfitPatch({ bodyColor: null });
    else commitOutfitPatch({ gearIds: [] });
  };

  const saveLabel =
    isLoading
      ? "Updating…"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "loading"
          ? "Loading…"
          : "Auto-saved";

  const renderPicker = () => {
    if (isBelt) {
      return (
        <Pane key="belt">
          <ColorGroup>
            <GroupLabel>Solids</GroupLabel>
            <SwatchGrid>
              {BELT_SOLIDS.map((color, i) => (
                <ColorSwatch
                  key={color.name}
                  type="button"
                  $index={i}
                  $color={color.hex}
                  $selected={player1Color === color.hex}
                  onClick={() => {
                    playButtonPressSound2();
                    commitOutfitPatch({ mawashiColor: color.hex });
                  }}
                  onMouseEnter={playButtonHoverSound}
                  title={color.name}
                  aria-label={color.name}
                />
              ))}
            </SwatchGrid>
          </ColorGroup>
          <ColorGroup>
            <GroupLabel>Patterns</GroupLabel>
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
                  onClick={() => {
                    playButtonPressSound2();
                    commitOutfitPatch({ mawashiColor: color.hex });
                  }}
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

    if (isBody) {
      return (
        <Pane key="body">
          <ColorGroup>
            <GroupLabel>Colors</GroupLabel>
            <SwatchGrid>
              {BODY_COLORS.map((color, i) => (
                <ColorSwatch
                  key={color.name}
                  type="button"
                  $index={i}
                  $color={color.hex || "#888"}
                  $gradient={color.gradient}
                  $selected={player1BodyColor === color.hex}
                  onClick={() => {
                    playButtonPressSound2();
                    commitOutfitPatch({ bodyColor: color.hex });
                  }}
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
      <Pane key="head">
        <ColorGroup>
          <GroupLabel>Topper</GroupLabel>
          <ItemGrid>
            <UnequipSlot
              type="button"
              $selected={!equippedHeadGearId}
              onClick={() => {
                playButtonPressSound2();
                commitOutfitPatch({
                  gearIds: withHeadGear(
                    editingOutfit.gearIds,
                    equippedHeadGearId,
                    false,
                  ),
                });
              }}
              onMouseEnter={playButtonHoverSound}
              title="Bare"
              aria-label="Unequip topper"
            >
              —
            </UnequipSlot>
            {HEAD_CATALOG.map((gear) => {
              const selected = equippedHeadGearId === gear.id;
              return (
                <ItemSlot
                  key={gear.id}
                  type="button"
                  $selected={selected}
                  onClick={() => {
                    playButtonPressSound2();
                    commitOutfitPatch({
                      gearIds: withHeadGear(
                        editingOutfit.gearIds,
                        gear.id,
                        !selected,
                      ),
                    });
                  }}
                  onMouseEnter={playButtonHoverSound}
                  title={gear.name}
                  aria-label={gear.name}
                >
                  <ItemIcon $iconTransform={gear.iconTransform}>
                    <img src={gear.icon} alt="" />
                  </ItemIcon>
                  <ItemLabel>{gear.name}</ItemLabel>
                </ItemSlot>
              );
            })}
          </ItemGrid>
          {typeof onOpenHatTuner === "function" ? (
            <HatTunerLink
              type="button"
              onClick={() => {
                playButtonPressSound2();
                onOpenHatTuner();
              }}
              onMouseEnter={playButtonHoverSound}
            >
              Tune hat poses →
            </HatTunerLink>
          ) : null}
        </ColorGroup>
      </Pane>
    );
  };

  return (
    <PageContainer>
      <StudioWall />
      <StudioFloor />
      <StudioCorner />
      <StudioLight />
      <StudioGrain />

      <BackButton
        type="button"
        onClick={handleBack}
        onMouseEnter={playButtonHoverSound}
      >
        <span className="arrow">←</span>
        Back
      </BackButton>

      <TopSlug>
        <SlugText $accent>
          <strong>WARDROBE</strong>
        </SlugText>
        <SlugRule aria-hidden />
        <SlugText>Dress your rikishi</SlugText>
      </TopSlug>

      <Stage>
        <FighterColumn>
          <Portrait>
            <FighterFigure>
              <FloorShadow />
              <FighterSpriteStack $ready={!isLoading}>
                <FighterImg src={previewSrc} alt="Your wrestler" />
              </FighterSpriteStack>
            </FighterFigure>
          </Portrait>
          <IdentityBlock>
            <SideLabel $accent={accent}>{editingOutfit.name}</SideLabel>
            <FighterName>{currentName}</FighterName>
            <BrushStroke $color={brushColor} $gradient={brushGradient} />
            <MetaItem>{saveLabel}</MetaItem>
          </IdentityBlock>
        </FighterColumn>

        <PickerDock>
          <PanelHead>
            <HeadTitle>Look</HeadTitle>
            <HeadMeta>{activeTab.label}</HeadMeta>
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
                  disabled={saveState === "loading"}
                  onClick={() => handleOutfitSelect(outfit.id)}
                  onMouseEnter={
                    saveState === "loading" ? undefined : playButtonHoverSound
                  }
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

          <TabBar role="tablist" aria-label="Categories">
            {TABS.map((t) => (
              <Tab
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                $active={tab === t.id}
                onClick={() => {
                  if (t.id !== tab) {
                    playButtonHoverSound();
                    setTab(t.id);
                  }
                }}
                onMouseEnter={playButtonHoverSound}
              >
                {t.label}
              </Tab>
            ))}
          </TabBar>

          <PickerBody>{renderPicker()}</PickerBody>

          <PickerFooter>
            <FooterHint>Editing {editingOutfit.name}</FooterHint>
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
  onOpenHatTuner: PropTypes.func,
};

export default CustomizePage;
