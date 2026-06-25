/**
 * BashoHub — Single-player BASHO career/roguelite hub.
 *
 * Phase 1: the real hub UI shell, built from the CustomizePage template.
 * Large recolored penguin preview (left) + a dossier panel (right) with
 * the 5 persistent ATTRIBUTES, the 5 LOADOUT categories (catalog empty /
 * "Coming soon" for now), the current banzuke rank, an envelopes count,
 * and a prominent START BASHO button. All values read from in-memory
 * placeholder state — persistence lands in Phase 2, the run loop in
 * Phase 3. A dev/debug panel (gated behind a flag / key combo) lets us
 * test without grinding (spec §9).
 *
 * GUARDRAIL: nothing here may affect PvP. This is a single-player sandbox.
 */

import { useState, useEffect, useRef, useCallback } from "react";
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
import envelopeImg from "../assets/envelope.png";
import mainMenuBackground from "../assets/main-menu-bkg-4.webp";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  fadeIn,
  fadeUp,
  slideInLeft,
  slideInRight,
  livePulse,
} from "./menuTheme";
import {
  ATTRIBUTES,
  STAT_BASE,
  STAT_MAX,
  LOADOUT_CATEGORIES,
  LOADOUT_OPTIONS,
  LOADOUT_DEFAULTS,
  LOADOUT_BUDGET,
  loadoutSpent,
  UNLOCKS,
  isUnlocked,
  DIVISIONS,
  getDivision,
  formatRank,
  boutsForRank,
} from "../config/bashoConfig";
import {
  loadSave,
  writeSave,
  resetSave,
  makeDefaultSave,
  isElectronSave,
} from "../lib/saveStore";
import { createRun } from "../lib/bashoRun";
import BanzukeBoard from "./BanzukeBoard";

const DEBUG_FLAG_KEY = "bashoDebug";

// ============================================
// LOCAL ANIMATIONS
// ============================================

const breathe = keyframes`
  0%, 100% { transform: scaleY(1);     }
  50%      { transform: scaleY(1.018); }
`;

const pipFill = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
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

// ============================================
// TOP BAR
// ============================================

const TopBar = styled.header`
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: clamp(10px, 1.8cqh, 18px) clamp(16px, 2.4cqw, 28px);
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
  box-shadow: 0 2px 10px ${C.sumiShadow};
  animation: ${fadeIn} 0.4s ease both;
`;

const TopBarLeft = styled.div`
  display: flex;
  justify-content: flex-start;
`;

const TopBarRight = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: clamp(8px, 1.2cqw, 14px);
`;

const BackButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  min-height: 44px;
  padding: clamp(8px, 1.2cqh, 12px) clamp(14px, 2cqw, 22px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.62rem, 0.95cqw, 0.78rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
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

const EnvelopeChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 0.9cqw, 10px);
  min-height: 44px;
  padding: clamp(6px, 1cqh, 10px) clamp(12px, 1.6cqw, 18px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.55rem, 0.85cqw, 0.68rem);
  color: ${C.gold};
  background: ${C.sumiSoft};
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  text-transform: uppercase;
  letter-spacing: 0.14em;

  .envelope {
    height: 1.7em;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
    margin-right: 0.1em;
  }

  .label {
    color: ${C.creamMute};
    font-weight: 600;
    letter-spacing: 0.24em;
    font-size: 0.82em;
  }
`;

const SaveIndicator = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 0.9cqw, 10px);
  min-height: 44px;
  padding: clamp(6px, 1cqh, 10px) clamp(12px, 1.6cqw, 18px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.72cqw, 0.55rem);
  color: ${C.creamMute};
  background: ${C.sumiSoft};
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  white-space: nowrap;
`;

const SaveDot = styled.span`
  width: clamp(6px, 0.8cqw, 8px);
  height: clamp(6px, 0.8cqw, 8px);
  border-radius: 50%;
  background: ${(p) => (p.$busy ? C.gold : C.success)};
  animation: ${livePulse} 2s ease-in-out infinite;
`;

const DebugToggle = styled.button`
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: clamp(6px, 1cqh, 10px) clamp(10px, 1.4cqw, 14px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.45rem, 0.7cqw, 0.55rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${(p) => (p.$active ? C.sumi : C.creamMute)};
  background: ${(p) => (p.$active ? C.gold : "transparent")};
  border: 1px solid ${(p) => (p.$active ? C.gold : C.sumiBorder)};
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: ${(p) => (p.$active ? C.sumi : C.cream)};
    border-color: ${C.gold};
  }
`;

// ============================================
// STAGE LAYOUT
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
  padding: clamp(18px, 3cqh, 36px) clamp(24px, 4cqw, 64px);
`;

// ============================================
// PREVIEW PANEL (LEFT)
// ============================================

const PreviewPanel = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
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
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
`;

const PanelLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 0.95cqw, 0.78rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.22em;
`;

const RankChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: clamp(5px, 0.7cqw, 8px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.5rem, 0.78cqw, 0.62rem);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.16em;
  background: transparent;
  border: 1px solid ${C.sumiBorder};
  border-radius: 6px;
  padding: clamp(3px, 0.6cqh, 6px) clamp(7px, 1cqw, 11px);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;

  .ladder {
    font-size: 1.1em;
    line-height: 1;
    opacity: 0.8;
  }

  &:hover {
    border-color: ${C.gold};
    background: rgba(232, 197, 71, 0.08);
  }
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
  background: ${C.snowSoft};
`;

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
  /* max-height (not height) so the high-res sprite always scales DOWN to fit
     without overflowing, and stays smoothly resampled — the old
     image-rendering: pixelated made this hand-drawn (non-pixel-art) penguin
     look jagged versus the crisp VS-CPU lobby. scaleX(-1) faces him toward the
     dossier/center like the lobby fighters. */
  max-height: clamp(200px, 46cqh, 440px);
  height: auto;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  transform: scaleX(-1);
`;

const PanelFooter = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(12px, 1.8cqw, 22px);
  padding: clamp(12px, 1.8cqh, 18px) clamp(16px, 2.2cqw, 24px);
  background: ${C.sumi};
  border-top: 1px solid ${C.sumiBorder};
`;

const RankStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RankCategory = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.68cqw, 0.55rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
`;

const RankName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.95rem, 1.5cqw, 1.2rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const RecordStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
`;

const RecordLabel = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.68cqw, 0.55rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const RecordValue = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.8rem, 1.3cqw, 1.05rem);
  color: ${C.iceBright};
  letter-spacing: 0.06em;
`;

// ============================================
// DOSSIER PANEL (RIGHT)
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

const DossierHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: clamp(10px, 1.6cqh, 16px) clamp(16px, 2.2cqw, 24px);
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
`;

const DossierMeta = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.65cqw, 0.5rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
`;

const ControlsBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2.4cqh, 26px);
  padding: clamp(16px, 2.4cqh, 26px) clamp(18px, 2.4cqw, 28px);
  overflow-y: auto;

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

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2cqh, 12px);
  animation: ${fadeUp} 0.4s ease-out both;
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
  font-weight: 700;
  font-size: clamp(0.42rem, 0.65cqw, 0.5rem);
  color: ${(p) => (p.$accent ? C.vermillion : C.inkTextMute)};
  text-transform: uppercase;
  letter-spacing: 0.24em;
`;

// --- Attribute rows ---

const StatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(7px, 1cqh, 11px);
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: clamp(20px, 2.4cqw, 28px) minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(8px, 1.2cqw, 14px);
`;

const StatKanji = styled.div`
  font-family: ${FONT_KANJI};
  font-size: clamp(0.85rem, 1.4cqw, 1.1rem);
  color: ${C.iceDeep};
  text-align: center;
  line-height: 1;
`;

const StatBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(3px, 0.5cqh, 5px);
  min-width: 0;
`;

const StatLabelRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
`;

const StatLabel = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.5rem, 0.8cqw, 0.62rem);
  color: ${C.inkText};
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const StatDesc = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PipTrack = styled.div`
  display: flex;
  gap: clamp(2px, 0.4cqw, 4px);
`;

const Pip = styled.div`
  flex: 1;
  height: clamp(5px, 0.8cqh, 7px);
  border-radius: 1px;
  background: ${(p) => (p.$filled ? C.iceMid : C.snowPanelDeep)};
  border: 1px solid
    ${(p) => (p.$filled ? C.iceDeep : C.snowBorderSoft)};
  transform-origin: left center;
  ${(p) =>
    p.$filled &&
    css`
      animation: ${pipFill} 0.3s ease-out both;
      animation-delay: ${Math.min(p.$index ?? 0, 10) * 0.03}s;
    `}
`;

const StatValue = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.7rem, 1.1cqw, 0.9rem);
  color: ${C.inkText};
  letter-spacing: 0.04em;
  min-width: clamp(30px, 3.4cqw, 40px);
  text-align: center;

  .max {
    color: ${C.inkTextMute};
    font-size: 0.7em;
  }
`;

const StatControls = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(3px, 0.5cqw, 6px);
`;

const StepButton = styled.button`
  width: clamp(20px, 2.4cqw, 26px);
  height: clamp(20px, 2.4cqw, 26px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.85rem, 1.3cqw, 1.05rem);
  line-height: 1;
  color: ${C.inkText};
  background: ${C.snowSoft};
  border: 1px solid ${C.snowBorder};
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 0.12s ease,
    border-color 0.12s ease,
    transform 0.1s ease;

  &:hover:not(:disabled) {
    color: ${C.vermillion};
    border-color: ${C.vermillion};
  }
  &:active:not(:disabled) {
    transform: scale(0.9);
  }
  &:disabled {
    opacity: 0.28;
    cursor: default;
  }
`;

// --- Loadout rows ---

const LoadoutList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 9px);
`;

const LoadoutRow = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 14px);
  padding: clamp(8px, 1.2cqh, 12px) clamp(10px, 1.4cqw, 14px);
  background: ${C.snowSoft};
  border: 1px solid ${C.snowBorderSoft};
  border-radius: 2px;
`;

const LoadoutKanji = styled.div`
  font-family: ${FONT_KANJI};
  font-size: clamp(1rem, 1.6cqw, 1.3rem);
  color: ${C.iceDeep};
  line-height: 1;
  flex-shrink: 0;
`;

const LoadoutNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
`;

const LoadoutName = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.55rem, 0.85cqw, 0.68rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const LoadoutSub = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.42rem, 0.62cqw, 0.5rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.16em;
  text-transform: uppercase;
`;

const ComingSoonTag = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.2em;
  padding: clamp(3px, 0.5cqh, 5px) clamp(7px, 1cqw, 10px);
  border: 1px dashed ${C.snowBorder};
  border-radius: 999px;
  flex-shrink: 0;
`;

// --- Loadout point-buy cards ---

const LoadoutCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 9px);
  padding: clamp(8px, 1.2cqh, 12px) clamp(10px, 1.4cqw, 14px);
  background: ${C.snowSoft};
  border: 1px solid ${C.snowBorderSoft};
  border-radius: 2px;
`;

const LoadoutCardHead = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 14px);
`;

const DefaultChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: clamp(4px, 0.6cqw, 6px);
`;

const DefaultChip = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.4rem, 0.58cqw, 0.46rem);
  color: ${(p) => (p.$struck ? C.inkTextMute : C.inkText)};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: clamp(2px, 0.4cqh, 4px) clamp(6px, 0.9cqw, 9px);
  background: ${C.snowPanel};
  border: 1px solid ${C.snowBorderSoft};
  border-radius: 999px;
  text-decoration: ${(p) => (p.$struck ? "line-through" : "none")};
  opacity: ${(p) => (p.$struck ? 0.55 : 1)};
`;

const OptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(5px, 0.7cqh, 7px);
`;

const OptionButton = styled.button`
  display: flex;
  align-items: flex-start;
  gap: clamp(8px, 1.1cqw, 12px);
  width: 100%;
  text-align: left;
  padding: clamp(7px, 1cqh, 10px) clamp(9px, 1.2cqw, 12px);
  background: ${(p) => (p.$selected ? "rgba(126, 203, 240, 0.16)" : C.snowPanel)};
  border: 1px solid
    ${(p) => (p.$selected ? C.iceDeep : C.snowBorderSoft)};
  border-radius: 2px;
  cursor: pointer;
  transition:
    background 0.14s ease,
    border-color 0.14s ease,
    transform 0.1s ease,
    opacity 0.14s ease;

  &:hover:not(:disabled) {
    border-color: ${(p) => (p.$selected ? C.iceDeep : C.iceMid)};
    background: ${(p) =>
      p.$selected ? "rgba(126, 203, 240, 0.22)" : C.snowSoft};
  }
  &:active:not(:disabled) {
    transform: scale(0.99);
  }
  &:disabled {
    cursor: default;
    opacity: ${(p) => (p.$selected ? 0.85 : 0.4)};
  }
`;

const OptionCheck = styled.span`
  flex-shrink: 0;
  width: clamp(14px, 1.8cqw, 18px);
  height: clamp(14px, 1.8cqw, 18px);
  margin-top: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.6rem, 0.9cqw, 0.75rem);
  line-height: 1;
  color: ${(p) => (p.$selected ? C.sumi : C.inkTextMute)};
  background: ${(p) => (p.$selected ? C.iceBright : "transparent")};
  border: 1px solid ${(p) => (p.$selected ? C.iceDeep : C.snowBorder)};
  border-radius: 2px;
`;

const OptionBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

const OptionTopRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
`;

const OptionName = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.52rem, 0.8cqw, 0.64rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const OptionCost = styled.span`
  flex-shrink: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.42rem, 0.62cqw, 0.5rem);
  color: ${(p) => (p.$affordable ? C.vermillion : C.inkTextMute)};
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const OptionReplaces = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.38rem, 0.56cqw, 0.44rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const OptionDesc = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.02em;
  line-height: 1.35;
`;

// --- Kenshō shop (unlocks) ---

const ShopList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 9px);
`;

const ShopRow = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 14px);
  padding: clamp(8px, 1.2cqh, 12px) clamp(10px, 1.4cqw, 14px);
  background: ${C.snowSoft};
  border: 1px solid
    ${(p) => (p.$owned ? C.iceDeep : C.snowBorderSoft)};
  border-radius: 2px;
`;

const ShopBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`;

const ShopDesc = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.02em;
  line-height: 1.35;
`;

const BuyButton = styled.button`
  flex-shrink: 0;
  min-width: clamp(58px, 7cqw, 80px);
  min-height: clamp(28px, 3.4cqh, 36px);
  padding: clamp(5px, 0.8cqh, 8px) clamp(8px, 1.2cqw, 12px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.5rem, 0.78cqw, 0.62rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${(p) => (p.$owned ? C.iceDeep : C.cream)};
  background: ${(p) => (p.$owned ? "transparent" : C.vermillion)};
  border: 1px solid
    ${(p) => (p.$owned ? C.iceDeep : C.vermillionBright)};
  border-radius: 2px;
  cursor: ${(p) => (p.$owned ? "default" : "pointer")};
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease,
    opacity 0.15s ease;

  &:hover:not(:disabled) {
    background: ${C.vermillionBright};
  }
  &:active:not(:disabled) {
    transform: scale(0.96);
  }
  &:disabled {
    cursor: default;
    opacity: ${(p) => (p.$owned ? 1 : 0.4)};
    background: ${(p) => (p.$owned ? "transparent" : C.snowPanelDeep)};
    color: ${(p) => (p.$owned ? C.iceDeep : C.inkTextMute)};
    border-color: ${(p) => (p.$owned ? C.iceDeep : C.snowBorder)};
  }
`;

// --- Footer / Start ---

const DossierFooter = styled.footer`
  display: flex;
  align-items: center;
  gap: clamp(12px, 1.8cqw, 18px);
  padding: clamp(12px, 1.8cqh, 18px) clamp(18px, 2.4cqw, 28px);
  background: ${C.sumi};
  border-top: 1px solid ${C.sumiBorder};
`;

const StartNote = styled.div`
  flex: 1;
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.45rem, 0.68cqw, 0.55rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 1.4;
`;

const StartButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.1cqw, 12px);
  min-height: 48px;
  padding: clamp(12px, 1.7cqh, 17px) clamp(22px, 3cqw, 40px);
  font-family: "Bungee", cursive;
  font-size: clamp(0.72rem, 1.1cqw, 0.95rem);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: ${C.cream};
  background: ${C.vermillion};
  border: 1px solid ${C.vermillionBright};
  border-radius: 2px;
  cursor: pointer;
  box-shadow: 0 4px 14px ${C.vermillionGlow};
  transition:
    background 0.18s ease,
    transform 0.12s ease,
    box-shadow 0.18s ease;

  .arrow {
    font-family: "Space Grotesk", sans-serif;
    font-weight: 700;
    transition: transform 0.2s ease;
  }

  &:hover {
    background: ${C.vermillionBright};
    box-shadow: 0 6px 20px ${C.vermillionGlow};
    .arrow {
      transform: translateX(4px);
    }
  }

  &:active {
    transform: scale(0.97);
  }
`;

// ============================================
// DEV PANEL (spec §9 — gated)
// ============================================

const DevPanel = styled.div`
  position: absolute;
  z-index: 6;
  bottom: clamp(16px, 2.4cqh, 28px);
  left: clamp(16px, 2.4cqw, 28px);
  width: clamp(180px, 22cqw, 240px);
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 8px);
  padding: clamp(12px, 1.6cqh, 16px);
  background: ${C.sumi};
  border: 1px solid ${C.gold};
  border-radius: 2px;
  box-shadow: 0 10px 30px ${C.sumiShadow};
  animation: ${fadeUp} 0.25s ease-out both;
`;

const DevTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.85cqw, 0.68rem);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.18em;
  margin-bottom: 2px;
`;

const DevButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 36px;
  padding: clamp(6px, 0.9cqh, 9px) clamp(10px, 1.3cqw, 13px);
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.5rem, 0.75cqw, 0.6rem);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${C.cream};
  background: ${C.sumiSoft};
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.14s ease;

  &:hover {
    color: ${C.gold};
    border-color: ${C.gold};
  }

  &:active {
    transform: scale(0.98);
  }
`;

// ============================================
// COMPONENT
// ============================================

function BashoHub({ onBack, onStartRun }) {
  const { player1Color, player1BodyColor } = usePlayerColors();

  // Career state. Seeded with defaults so the UI renders instantly, then
  // overwritten once the persisted save loads (see effect below).
  const [career, setCareer] = useState(() => makeDefaultSave().career);

  // An in-progress basho from a prior session (resume support — spec §5.8).
  const [resumeRun, setResumeRun] = useState(null);

  // Full save document (everything outside `career`) is held in a ref so we
  // can re-persist the whole doc without re-rendering on every keystroke.
  const saveDocRef = useRef(null);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved

  // Recolored preview sprite.
  const [previewSrc, setPreviewSrc] = useState(pumo);
  const mountedRef = useRef(true);

  // Standalone banzuke-board overlay (static view of the current position).
  const [showBanzuke, setShowBanzuke] = useState(false);

  // Debug panel (spec §9): enabled via localStorage flag or Ctrl+Shift+B.
  const [debugEnabled, setDebugEnabled] = useState(() => {
    try {
      return localStorage.getItem(DEBUG_FLAG_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load the persisted save once on mount. loadSave() never throws and
  // always resolves to a fully-populated, migrated document.
  useEffect(() => {
    let cancelled = false;
    loadSave().then((doc) => {
      if (cancelled) return;
      saveDocRef.current = doc;
      setCareer(doc.career);
      // Surface a resumable run if one was left in progress.
      if (doc.bashoRun?.active) setResumeRun(doc.bashoRun);
      // Mark loaded on the next tick so the load-triggered setCareer above
      // doesn't immediately re-persist an identical document.
      loadedRef.current = true;
      setSaveStatus("saved");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist career changes (debounced). Skipped until the initial load
  // completes so we never clobber the save with the default seed.
  useEffect(() => {
    if (!loadedRef.current) return;
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const doc = { ...(saveDocRef.current || makeDefaultSave()), career };
      const written = await writeSave(doc);
      saveDocRef.current = written;
      if (mountedRef.current) setSaveStatus("saved");
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [career]);

  // Keyboard combo to toggle the debug flag on/off for testers.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        setDebugEnabled((prev) => {
          const next = !prev;
          try {
            localStorage.setItem(DEBUG_FLAG_KEY, next ? "1" : "0");
          } catch {
            /* ignore */
          }
          if (!next) setDevOpen(false);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Recolor the preview to match the player's chosen colors (same path as
  // CustomizePage / Lobby). Reuses the shared recolor cache.
  useEffect(() => {
    const needsMawashi = player1Color && player1Color !== SPRITE_BASE_COLOR;
    const needsBody = !!player1BodyColor;

    if (!needsMawashi && !needsBody) {
      setPreviewSrc(pumo);
      return;
    }

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
      });
  }, [player1Color, player1BodyColor]);

  const handleStart = useCallback(() => {
    playButtonPressSound2();
    if (!onStartRun) return;
    // Always hand the run controller the freshest career (so debug stat/rank
    // tweaks made this session are included even if a debounced save is still
    // pending).
    const baseSave = { ...(saveDocRef.current || makeDefaultSave()), career };
    if (resumeRun) {
      onStartRun({ run: resumeRun, save: baseSave });
      return;
    }
    const run = createRun(career);
    onStartRun({ run, save: { ...baseSave, bashoRun: run } });
  }, [career, resumeRun, onStartRun]);

  // Stat editing is LOCKED while a basho is in progress (resume pending) —
  // you can't respec mid-tournament (spec §10). It's only editable between runs.
  const runLocked = !!resumeRun;

  const spendStat = (key) => {
    if (runLocked) return;
    const cur = career.statPoints.spent[key] || 0;
    if (career.statPoints.available <= 0 || STAT_BASE + cur >= STAT_MAX) return;
    playButtonPressSound2();
    setCareer((c) => ({
      ...c,
      statPoints: {
        available: c.statPoints.available - 1,
        spent: { ...c.statPoints.spent, [key]: (c.statPoints.spent[key] || 0) + 1 },
      },
    }));
  };

  const refundStat = (key) => {
    if (runLocked) return;
    const cur = career.statPoints.spent[key] || 0;
    if (cur <= 0) return;
    playButtonPressSound2();
    setCareer((c) => ({
      ...c,
      statPoints: {
        available: c.statPoints.available + 1,
        spent: { ...c.statPoints.spent, [key]: (c.statPoints.spent[key] || 0) - 1 },
      },
    }));
  };

  // Toggle a loadout sidegrade on/off. Selecting draws from the shared budget;
  // an unaffordable option is a no-op. Locked while a basho is in progress —
  // you can't re-build your fighter mid-tournament (same rule as stats).
  const toggleLoadoutOption = (catKey, opt) => {
    if (runLocked) return;
    const cur = career.loadout?.[catKey] || [];
    const has = cur.includes(opt.id);
    if (!has) {
      const remaining = LOADOUT_BUDGET - loadoutSpent(career.loadout);
      if ((opt.cost || 0) > remaining) return; // can't afford
    }
    playButtonPressSound2();
    setCareer((c) => {
      const list = c.loadout?.[catKey] || [];
      const next = has
        ? list.filter((id) => id !== opt.id)
        : [...list, opt.id];
      return { ...c, loadout: { ...c.loadout, [catKey]: next } };
    });
  };

  // A loadout option is locked until its `unlock` is owned (or debug-unlocked).
  // Locked options can't be selected AND don't apply even if a legacy save had
  // them toggled on — the hub shows them as off and the send-time filter drops
  // them, so the gate is authoritative.
  const optionLocked = (opt) =>
    !!opt.unlock && !unlockAll && !career.unlocks.includes(opt.unlock);

  // Spend envelopes to permanently unlock a shop item. No-op if already owned,
  // unaffordable, or a run is in progress (you shop between bashos).
  const buyUnlock = (item) => {
    if (runLocked) return;
    if (isUnlocked(career, item.id)) return;
    if ((career.envelopes || 0) < item.cost) return;
    playButtonPressSound2();
    setCareer((c) => ({
      ...c,
      envelopes: (c.envelopes || 0) - item.cost,
      unlocks: [...(c.unlocks || []), item.id],
    }));
  };

  // ---- Debug actions (in-memory only) ----

  const devMaxStats = () => {
    playButtonPressSound2();
    const spent = ATTRIBUTES.reduce((acc, a) => {
      acc[a.key] = STAT_MAX - STAT_BASE;
      return acc;
    }, {});
    setCareer((c) => ({
      ...c,
      statPoints: { available: 0, spent },
    }));
  };

  const devClearStats = () => {
    playButtonPressSound2();
    const fresh = makeDefaultSave().career.statPoints;
    setCareer((c) => ({
      ...c,
      statPoints: { available: fresh.available, spent: { ...fresh.spent } },
    }));
  };

  // Grant the full spendable budget so testers can exercise the spend UI
  // (Max Stats leaves 0 available). Capped at the 20-point career budget.
  const devGrantPoints = () => {
    playButtonPressSound2();
    setCareer((c) => {
      const spentTotal = Object.values(c.statPoints.spent || {}).reduce(
        (a, b) => a + b,
        0,
      );
      return {
        ...c,
        statPoints: { ...c.statPoints, available: 20 - spentTotal },
      };
    });
  };

  const devGrantEnvelopes = () => {
    playButtonPressSound2();
    setCareer((c) => ({ ...c, envelopes: c.envelopes + 1000 }));
  };

  const devUnlockAll = () => {
    playButtonPressSound2();
    setCareer((c) => ({ ...c, unlocks: ["__all__"] }));
  };

  const devJumpRank = () => {
    playButtonPressSound2();
    setCareer((c) => {
      const idx = DIVISIONS.findIndex((d) => d.key === getDivision(c.rank).key);
      const next = DIVISIONS[Math.min(idx + 1, DIVISIONS.length - 1)];
      return {
        ...c,
        rank: {
          division: next.key,
          number: next.numbered ? next.maxNumber : null,
          title: next.numbered ? null : next.title,
          side: null,
        },
        bestDivisionReached: next.key,
      };
    });
  };

  const devReset = async () => {
    playButtonPressSound2();
    const doc = await resetSave();
    saveDocRef.current = doc;
    setCareer(doc.career);
    if (mountedRef.current) setSaveStatus("saved");
  };

  // ---- Derived display values ----

  const division = getDivision(career.rank);
  const rankLabel = formatRank(career.rank);
  const bouts = boutsForRank(career.rank);
  const record = `${career.lifetime.boutsWon}-${career.lifetime.boutsLost}`;
  const unlockAll = career.unlocks.includes("__all__");

  // Loadout point-buy budget (shared across all categories).
  const loadoutUsed = loadoutSpent(career.loadout);
  const loadoutRemaining = LOADOUT_BUDGET - loadoutUsed;

  if (showBanzuke) {
    return (
      <BanzukeBoard
        rank={career.rank}
        title="Banzuke"
        subtitle="Career Ladder"
        buttonLabel="Close"
        onReturn={() => setShowBanzuke(false)}
      />
    );
  }

  return (
    <PageContainer>
      <BackgroundImage src={mainMenuBackground} alt="" />
      <CinematicOverlay />
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
            <span className="arrow">&larr;</span>
            Back
          </BackButton>
        </TopBarLeft>

        <TitleBlock>
          <PageTitle>Basho</PageTitle>
          <PageSubtitle>Career Ladder</PageSubtitle>
        </TitleBlock>

        <TopBarRight>
          <SaveIndicator>
            <SaveDot $busy={saveStatus === "saving"} />
            {saveStatus === "saving"
              ? "Saving"
              : isElectronSave()
                ? "Saved"
                : "Saved locally"}
          </SaveIndicator>
          <EnvelopeChip>
            <img className="envelope" src={envelopeImg} alt="" aria-hidden />
            <span className="label">Kensho</span>
            {career.envelopes.toLocaleString()}
          </EnvelopeChip>
          {debugEnabled && (
            <DebugToggle
              $active={devOpen}
              onClick={() => {
                playButtonPressSound2();
                setDevOpen((o) => !o);
              }}
              onMouseEnter={playButtonHoverSound}
            >
              Dev
            </DebugToggle>
          )}
        </TopBarRight>
      </TopBar>

      <Stage>
        {/* LEFT — wrestler preview + rank */}
        <PreviewPanel>
          <PanelHeader>
            <PanelLabel>Your Rikishi</PanelLabel>
            <RankChip
              onClick={() => {
                playButtonPressSound2();
                setShowBanzuke(true);
              }}
              onMouseEnter={playButtonHoverSound}
              title="View the banzuke ladder"
            >
              {rankLabel}
              <span className="ladder" aria-hidden>
                ☰
              </span>
            </RankChip>
          </PanelHeader>

          <PreviewStage>
            <PreviewSpotlight />
            <AvatarBreath>
              <PreviewImage src={previewSrc} alt="Your wrestler" />
            </AvatarBreath>
          </PreviewStage>

          <PanelFooter>
            <RankStack>
              <RankCategory>Current Rank</RankCategory>
              <RankName>{division.label}</RankName>
            </RankStack>
            <RecordStack>
              <RecordLabel>Lifetime</RecordLabel>
              <RecordValue>{record}</RecordValue>
            </RecordStack>
          </PanelFooter>
        </PreviewPanel>

        {/* RIGHT — dossier (attributes + loadout + start) */}
        <ControlsPanel>
          <DossierHeader>
            <PanelLabel>Dossier</PanelLabel>
            <DossierMeta>Pre-Basho</DossierMeta>
          </DossierHeader>

          <ControlsBody>
            {/* ATTRIBUTES */}
            <Section>
              <SectionHeader>
                <SectionTitle>Attributes</SectionTitle>
                <SectionMeta $accent={!runLocked && career.statPoints.available > 0}>
                  {runLocked
                    ? "Locked during basho"
                    : `${career.statPoints.available} pts available`}
                </SectionMeta>
              </SectionHeader>
              <StatList>
                {ATTRIBUTES.map((attr) => {
                  const spent = career.statPoints.spent[attr.key] || 0;
                  const value = STAT_BASE + spent;
                  return (
                    <StatRow key={attr.key}>
                      <StatKanji aria-hidden>{attr.kanji}</StatKanji>
                      <StatBody>
                        <StatLabelRow>
                          <StatLabel>{attr.label}</StatLabel>
                          <StatDesc>{attr.desc}</StatDesc>
                        </StatLabelRow>
                        <PipTrack>
                          {Array.from({ length: STAT_MAX }).map((_, i) => (
                            <Pip
                              key={i}
                              $filled={i < value}
                              $index={i}
                            />
                          ))}
                        </PipTrack>
                      </StatBody>
                      <StatControls>
                        <StepButton
                          aria-label={`Lower ${attr.label}`}
                          onClick={() => refundStat(attr.key)}
                          onMouseEnter={playButtonHoverSound}
                          disabled={runLocked || spent <= 0}
                        >
                          &minus;
                        </StepButton>
                        <StatValue>
                          {value}
                          <span className="max">/{STAT_MAX}</span>
                        </StatValue>
                        <StepButton
                          aria-label={`Raise ${attr.label}`}
                          onClick={() => spendStat(attr.key)}
                          onMouseEnter={playButtonHoverSound}
                          disabled={
                            runLocked ||
                            career.statPoints.available <= 0 ||
                            value >= STAT_MAX
                          }
                        >
                          +
                        </StepButton>
                      </StatControls>
                    </StatRow>
                  );
                })}
              </StatList>
            </Section>

            {/* LOADOUT */}
            <Section>
              <SectionHeader>
                <SectionTitle>Loadout</SectionTitle>
                <SectionMeta $accent={!runLocked && loadoutRemaining > 0}>
                  {runLocked
                    ? "Locked during basho"
                    : `${loadoutUsed}/${LOADOUT_BUDGET} pts spent`}
                </SectionMeta>
              </SectionHeader>
              <LoadoutList>
                {LOADOUT_CATEGORIES.map((cat) => {
                  const options = LOADOUT_OPTIONS[cat.key] || [];
                  const selected = career.loadout?.[cat.key] || [];
                  const defaults = LOADOUT_DEFAULTS[cat.key] || [];
                  // A default is "struck" once an OWNED option that replaces it
                  // is on (locked options never apply, so they never strike).
                  const replaced = new Set(
                    options
                      .filter(
                        (o) =>
                          selected.includes(o.id) &&
                          !optionLocked(o) &&
                          o.replaces,
                      )
                      .map((o) => o.replaces),
                  );

                  if (options.length === 0) {
                    return (
                      <LoadoutRow key={cat.key}>
                        <LoadoutKanji aria-hidden>{cat.kanji}</LoadoutKanji>
                        <LoadoutNameStack>
                          <LoadoutName>{cat.label}</LoadoutName>
                          <LoadoutSub>{cat.sub}</LoadoutSub>
                        </LoadoutNameStack>
                        <ComingSoonTag>Coming soon</ComingSoonTag>
                      </LoadoutRow>
                    );
                  }

                  return (
                    <LoadoutCard key={cat.key}>
                      <LoadoutCardHead>
                        <LoadoutKanji aria-hidden>{cat.kanji}</LoadoutKanji>
                        <LoadoutNameStack>
                          <LoadoutName>{cat.label}</LoadoutName>
                          <LoadoutSub>{cat.sub}</LoadoutSub>
                        </LoadoutNameStack>
                      </LoadoutCardHead>

                      {defaults.length > 0 && (
                        <DefaultChips>
                          {defaults.map((d) => (
                            <DefaultChip key={d} $struck={replaced.has(d)}>
                              {d}
                              {replaced.has(d) ? " · replaced" : " · default"}
                            </DefaultChip>
                          ))}
                        </DefaultChips>
                      )}

                      <OptionList>
                        {options.map((opt) => {
                          // Options gated by the §6 economy require their
                          // unlock; absent `unlock` = freely selectable. A
                          // locked option reads as off regardless of the saved
                          // selection.
                          const locked = optionLocked(opt);
                          const isOn = !locked && selected.includes(opt.id);
                          const cost = opt.cost || 0;
                          const affordable = isOn || cost <= loadoutRemaining;
                          return (
                            <OptionButton
                              key={opt.id}
                              type="button"
                              $selected={isOn}
                              disabled={
                                runLocked || locked || (!isOn && !affordable)
                              }
                              onClick={() => toggleLoadoutOption(cat.key, opt)}
                              onMouseEnter={playButtonHoverSound}
                            >
                              <OptionCheck $selected={isOn} aria-hidden>
                                {isOn ? "✓" : ""}
                              </OptionCheck>
                              <OptionBody>
                                <OptionTopRow>
                                  <OptionName>{opt.label}</OptionName>
                                  <OptionCost $affordable={affordable}>
                                    {locked
                                      ? "Locked"
                                      : `${cost} pt${cost === 1 ? "" : "s"}`}
                                  </OptionCost>
                                </OptionTopRow>
                                {opt.replaces && (
                                  <OptionReplaces>
                                    Replaces {opt.replaces}
                                  </OptionReplaces>
                                )}
                                <OptionDesc>{opt.desc}</OptionDesc>
                              </OptionBody>
                            </OptionButton>
                          );
                        })}
                      </OptionList>
                    </LoadoutCard>
                  );
                })}
              </LoadoutList>
            </Section>

            {/* KENSHŌ SHOP (unlocks) */}
            <Section>
              <SectionHeader>
                <SectionTitle>Kenshō Shop</SectionTitle>
                <SectionMeta $accent={!runLocked && career.envelopes > 0}>
                  {runLocked
                    ? "Locked during basho"
                    : `${career.envelopes.toLocaleString()} kenshō`}
                </SectionMeta>
              </SectionHeader>
              <ShopList>
                {UNLOCKS.map((item) => {
                  const owned = isUnlocked(career, item.id);
                  const affordable = (career.envelopes || 0) >= item.cost;
                  return (
                    <ShopRow key={item.id} $owned={owned}>
                      <LoadoutKanji aria-hidden>{item.kanji}</LoadoutKanji>
                      <ShopBody>
                        <LoadoutName>{item.label}</LoadoutName>
                        {item.sub && <LoadoutSub>{item.sub}</LoadoutSub>}
                        <ShopDesc>{item.desc}</ShopDesc>
                      </ShopBody>
                      <BuyButton
                        type="button"
                        $owned={owned}
                        disabled={owned || runLocked || !affordable}
                        onClick={() => buyUnlock(item)}
                        onMouseEnter={playButtonHoverSound}
                      >
                        {owned ? "Owned" : `${item.cost} ◆`}
                      </BuyButton>
                    </ShopRow>
                  );
                })}
              </ShopList>
            </Section>
          </ControlsBody>

          <DossierFooter>
            <StartNote>
              {bouts} bouts &middot; {division.kk ? `${division.kk} wins = kachi-koshi` : "title defense"}
            </StartNote>
            <StartButton
              onClick={handleStart}
              onMouseEnter={playButtonHoverSound}
            >
              {resumeRun ? "Resume Basho" : "Start Basho"}
              <span className="arrow">&rarr;</span>
            </StartButton>
          </DossierFooter>
        </ControlsPanel>
      </Stage>

      {debugEnabled && devOpen && (
        <DevPanel>
          <DevTitle>Dev Tools</DevTitle>
          <DevButton onClick={devMaxStats} onMouseEnter={playButtonHoverSound}>
            Max Stats
          </DevButton>
          <DevButton onClick={devClearStats} onMouseEnter={playButtonHoverSound}>
            Clear Stats
          </DevButton>
          <DevButton onClick={devGrantPoints} onMouseEnter={playButtonHoverSound}>
            Grant Stat Pts
          </DevButton>
          <DevButton onClick={devJumpRank} onMouseEnter={playButtonHoverSound}>
            Jump Rank +1
          </DevButton>
          <DevButton onClick={devGrantEnvelopes} onMouseEnter={playButtonHoverSound}>
            +1000 Kensho
          </DevButton>
          <DevButton onClick={devUnlockAll} onMouseEnter={playButtonHoverSound}>
            Unlock All
          </DevButton>
          <DevButton onClick={devReset} onMouseEnter={playButtonHoverSound}>
            Reset Career
          </DevButton>
        </DevPanel>
      )}
    </PageContainer>
  );
}

BashoHub.propTypes = {
  onBack: PropTypes.func.isRequired,
  onStartRun: PropTypes.func,
};

export default BashoHub;
