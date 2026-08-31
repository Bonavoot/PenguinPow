/**
 * BashoHub — Single-player BASHO career/roguelite hub.
 *
 * Winter heya: ice wall, warm washi floor, cream dohyo portrait, solid
 * sumi plaques. Not the night charcoal stage.
 *   LEFT  — portrait (rank stamp / record / looks), then attributes.
 *   RIGHT — technique plate (rows + inspect).
 *   DOCK  — kachi-koshi pips + Start / Resume.
 *
 * All values read from the persisted save (saveStore); the run loop lives in
 * lib/bashoRun. GUARDRAIL: nothing here may affect PvP.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import { usePlayerColors } from "../context/PlayerColorContext";
import { SPRITE_BASE_COLOR } from "../utils/SpriteRecolorizer";
import { buildIdlePortraitSrc } from "../utils/hatComposite";
import { getEquippedHeadGearId } from "../config/cosmetics";
import {
  playButtonHoverSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import { useLowSpec } from "../utils/lowSpecMode";
import pumo from "../assets/pumo-idle.png";
import envelopeImg from "../assets/envelope.png";
import flapIcon from "../assets/flap-icon.png";
import shatterPalmIcon from "../assets/shatter-palm-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import Snowfall from "./Snowfall";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  FONT_UI,
  FONT_WEIGHT,
  TRACK,
  fadeIn,
  fadeUp,
  clipRevealLeft,
  clipRevealRight,
  clipRevealUp,
  TEXT_SHADOW_DISPLAY,
} from "./menuTheme";
import {
  ATTRIBUTES,
  STAT_BASE,
  STAT_MAX,
  LOADOUT_CATEGORIES,
  LOADOUT_OPTIONS,
  LOADOUT_BUDGET,
  loadoutSpent,
  migrateLoadout,
  UNLOCK_BY_ID,
  isUnlocked,
  DIVISIONS,
  getDivision,
  formatRank,
  boutsForRank,
} from "../config/bashoConfig";
import { BODY_COLORS, BELT_ALL } from "../config/customizeColors";
import {
  loadSave,
  patchSave,
  resetSave,
  makeDefaultSave,
} from "../lib/saveStore";
import {
  makeDefaultCustomization,
  normalizeCustomization,
  getOutfitById,
  getActiveOutfit,
  withActiveOutfitId,
  applyOutfitToPlayer1Setters,
} from "../lib/outfits";
import { createRun, ensureOpponentRanks } from "../lib/bashoRun";
import BanzukeBoard from "./BanzukeBoard";
import { SHADOW_GRADIENT } from "./PlayerShadow";

const DEBUG_FLAG_KEY = "bashoDebug";

/** Future catalog seats — empty wells, same count as a full row. */
const SLOTS_PER_CATEGORY = 5;

/**
 * D — winter heya. Ice wall, warm floor, cream dohyo, solid sumi plaques.
 * Gold is currency / unlock / kachi-koshi. Rank is vermillion hanko.
 */
const D = {
  page: "#d5e3ee",
  wall: "#cfe0ec",
  floor: "#ebe4d4",
  soft: C.sumiSoft,
  softHover: "#2c313a",
  deep: "#0c0e14",
  well: "#08090c",
  border: "rgba(245, 236, 217, 0.22)",
  borderSoft: "rgba(245, 236, 217, 0.12)",
  plateEdge: "rgba(8, 10, 14, 0.5)",
  shadow: "rgba(28, 52, 74, 0.14)",
  shadowStrong: "rgba(18, 36, 54, 0.22)",
  textMute: "rgba(15, 29, 46, 0.58)",
  textFaint: "rgba(15, 29, 46, 0.34)",
  plate: C.sumi,
  stageTop: "#faf4e8",
  stageMid: "#efe4cc",
  stageBottom: "#d4c09a",
};

/* Soft paper grain — faint, portrait stage only. Full-panel washi read as a
   busy grid. */
const WASHI_DARK_ON_LIGHT = `
  repeating-linear-gradient(
    90deg,
    transparent 0, transparent 3px,
    rgba(60, 40, 20, 0.03) 3px, rgba(60, 40, 20, 0.03) 4px
  ),
  repeating-linear-gradient(
    0deg,
    transparent 0, transparent 5px,
    rgba(60, 40, 20, 0.025) 5px, rgba(60, 40, 20, 0.025) 6px
  )
`;
/** Square icon + panel colors for loadout options (matches PowerUpSelection TYPE_COLORS). */
const LOADOUT_OPTION_ICONS = {
  flap: {
    icon: flapIcon,
    main: "#34e0c0",
    deep: "#15705f",
  },
  shattering_palm: {
    icon: shatterPalmIcon,
    // Bright armor-break yellow — flat muddy gold read poorly at small size.
    gradient:
      "linear-gradient(180deg, #fff9c4 0%, #ffe566 52%, #ffd024 100%)",
    main: "#ffe566",
    deep: "#c99200",
  },
  thick_blubber: {
    icon: thickBlubberIcon,
    // Pink absorb-ring color (matches the Thick Blubber VFX + power-up icon).
    main: "#ff5087",
    deep: "#a01f4a",
  },
};

function getLoadoutOptionIcon(optionId) {
  return LOADOUT_OPTION_ICONS[optionId] || null;
}

const CAT_ACCENT = {
  attack: C.gold,
  defense: C.ice,
  movement: "#34e0c0",
  grappling: "#ff5087",
  shinto: "#d4a84b",
};

// ============================================
// LOCAL ANIMATIONS
// ============================================

const breathe = keyframes`
  0%, 100% { transform: scaleX(-1) scaleY(1); }
  50%      { transform: scaleX(-1) scaleY(1.015); }
`;

const pipFill = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;

const detailShift = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
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
  overflow: hidden;
  container-type: size;
  font-family: ${FONT_BODY};
  background:
    radial-gradient(
      ellipse 90% 55% at 50% -8%,
      #eef5fa 0%,
      transparent 62%
    ),
    linear-gradient(
      180deg,
      ${D.wall} 0%,
      #dbe7f0 42%,
      #e4e4dc 68%,
      ${D.floor} 100%
    );
`;

const AtmosphereKanji = styled.div`
  position: absolute;
  top: 6%;
  left: 3%;
  z-index: 0;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(160px, 26cqw, 320px);
  line-height: 0.78;
  color: rgba(28, 74, 98, 0.07);
  pointer-events: none;
  user-select: none;
  letter-spacing: -0.06em;
`;

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(
    ellipse 118% 100% at 50% 42%,
    transparent 58%,
    rgba(40, 70, 95, 0.1) 100%
  );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.045;
  mix-blend-mode: multiply;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(40, 50, 60, 0.06) 0,
      transparent 1px,
      transparent 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(40, 50, 60, 0.04) 0,
      transparent 1px,
      transparent 4px
    );
`;

// ============================================
// TOP BAR (slim)
// ============================================

const TopBar = styled.header`
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: clamp(12px, 1.7cqh, 18px) clamp(18px, 2.8cqw, 36px);
  background: transparent;
  border-bottom: none;
  animation: ${fadeIn} 0.35s ease both;
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

const GhostButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  min-height: 40px;
  padding: clamp(8px, 1.1cqh, 11px) clamp(14px, 1.9cqw, 22px);
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.56rem, 0.84cqw, 0.68rem);
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  color: ${D.textMute};
  background: transparent;
  border: none;
  border-radius: 0;
  cursor: pointer;
  box-shadow: none;
  transition: color 0.18s ease, transform 0.18s ease;

  .arrow {
    font-weight: 700;
    transition: transform 0.2s ease;
  }
  &:hover {
    color: ${C.inkText};
    .arrow {
      transform: translateX(-3px);
    }
  }
  &:active {
    transform: scale(0.98);
  }
`;

const TitleBlock = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  will-change: transform, opacity;
  animation: ${fadeUp} 0.42s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s both;
`;

const TitleKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-weight: 700;
  font-size: clamp(0.55rem, 0.82cqw, 0.7rem);
  color: ${C.iceDeep};
  letter-spacing: 0.42em;
  line-height: 1;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.55rem, 2.8cqw, 2.15rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: ${TRACK.displayWide};
  line-height: 0.9;
`;

/* Hard 1px keyline — outline, not a drop shadow. */
const PAPER_STROKE = `
  -1px -1px 0 #0a0c10,
   1px -1px 0 #0a0c10,
  -1px  1px 0 #0a0c10,
   1px  1px 0 #0a0c10,
  -1px  0   0 #0a0c10,
   1px  0   0 #0a0c10,
   0   -1px 0 #0a0c10,
   0    1px 0 #0a0c10
`;

const TitleRank = styled.button`
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 0.28em 0.5em 0.22em;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.58rem, 0.86cqw, 0.72rem);
  color: #fffaf0;
  text-transform: uppercase;
  letter-spacing: ${TRACK.displayTight};
  line-height: 1.05;
  background: ${C.vermillion};
  border: 1px solid ${C.vermillionDeep};
  box-shadow: 0 1px 0 rgba(255, 250, 240, 0.18) inset;
  cursor: pointer;
  pointer-events: auto;
  transform: rotate(-2.5deg);
  transform-origin: top left;
  transition: filter 0.15s ease, transform 0.15s ease;

  &:hover {
    filter: brightness(1.08);
    transform: rotate(-2.5deg) scale(1.04);
  }
`;

const Currency = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.85rem, 1.2cqw, 1.05rem);
  color: ${C.goldDeep};
  letter-spacing: ${TRACK.meta};
  background: none;
  border: none;
  box-shadow: none;

  .envelope {
    display: block;
    height: clamp(44px, 5.8cqh, 56px);
    width: auto;
    object-fit: contain;
    object-position: center;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(15, 29, 46, 0.28));
  }
`;

const DebugToggle = styled.button`
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: clamp(5px, 0.8cqh, 9px) clamp(10px, 1.4cqw, 14px);
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.68cqw, 0.52rem);
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  color: ${(p) => (p.$active ? C.sumi : C.creamMute)};
  background: ${(p) => (p.$active ? C.gold : C.sumi)};
  border: 1px solid ${(p) => (p.$active ? C.gold : "rgba(245, 236, 217, 0.22)")};
  border-radius: 0;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: ${(p) => (p.$active ? C.sumi : C.cream)};
    border-color: ${C.gold};
  }
`;

// ============================================
// STAGE — open heya, not twin admin cards
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.18fr);
  align-items: stretch;
  gap: clamp(16px, 2.4cqw, 32px);
  padding: clamp(2px, 0.6cqh, 8px) clamp(22px, 3.6cqw, 54px)
    clamp(6px, 1cqh, 12px);
`;

const HeyaColumn = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: clamp(8px, 1.1cqh, 12px);
  will-change: transform, opacity;
  animation: ${clipRevealLeft} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.1s both;
`;

const BoardColumn = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: clamp(10px, 1.2cqh, 14px);
  padding: clamp(12px, 1.4cqh, 16px) clamp(14px, 1.6cqw, 20px);
  background: ${D.plate};
  border: 1px solid ${D.plateEdge};
  border-top: 3px solid ${C.vermillion};
  box-shadow: 0 18px 36px ${D.shadowStrong};
  will-change: transform, opacity;
  animation: ${clipRevealRight} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.16s both;
`;

const BoardHead = styled.header`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-shrink: 0;
  min-height: 1.15em;
  margin: 0 0 clamp(6px, 0.7cqh, 8px);
`;

const BoardMeta = styled.div`
  display: inline-flex;
  align-items: center;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.52rem, 0.78cqw, 0.64rem);
  color: ${(p) => (p.$accent ? C.gold : C.creamMute)};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  pointer-events: none;
`;

// ============================================
// LEFT — PORTRAIT + ATTRIBUTES
// ============================================

const PortraitFrame = styled.div`
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(90, 60, 30, 0.2);
  box-shadow: 0 16px 32px ${D.shadowStrong};
`;

const PortraitStage = styled.div`
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: clamp(4px, 0.6cqh, 8px) clamp(6px, 1cqw, 12px)
    clamp(6px, 0.9cqh, 10px);
  position: relative;
  overflow: hidden;
  background: radial-gradient(
    ellipse 90% 70% at 50% 28%,
    ${D.stageTop} 0%,
    ${D.stageMid} 52%,
    ${D.stageBottom} 100%
  );
  box-shadow:
    inset 0 0 0 1px rgba(60, 40, 20, 0.16),
    inset 0 -28px 44px -18px rgba(70, 48, 24, 0.45),
    inset 0 18px 32px -18px rgba(255, 252, 244, 0.5);
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: ${WASHI_DARK_ON_LIGHT};
    opacity: 0.4;
    pointer-events: none;
  }
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 72% 58% at 50% 38%,
      transparent 42%,
      rgba(40, 28, 14, 0.16) 100%
    );
    pointer-events: none;
    z-index: 1;
  }
`;

/* Shrink-wraps to the sprite so ring + shadow center on him, not the stage. */
const FighterFigure = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
  max-height: 100%;
  width: fit-content;
  max-width: 100%;
`;

/* Soft dohyo ring — sized to the figure, not the full stage. */
const PortraitRing = styled.div`
  position: absolute;
  left: 50%;
  bottom: 1%;
  transform: translateX(-50%);
  width: 86%;
  height: 12%;
  min-height: 20px;
  max-height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(90, 60, 30, 0.2);
  box-shadow:
    inset 0 0 0 1px rgba(255, 248, 230, 0.3),
    0 0 0 4px rgba(90, 60, 30, 0.05);
  z-index: 1;
  pointer-events: none;
`;

// Ground shadow — centered on FighterFigure (same recipe as CustomizePage).
const PortraitFloor = styled.div`
  position: absolute;
  left: 50%;
  bottom: 1%;
  transform: translateX(-50%);
  width: 66%;
  height: 10%;
  min-height: 16px;
  max-height: 34px;
  border-radius: 50%;
  background: ${SHADOW_GRADIENT};
  z-index: 1;
  pointer-events: none;
`;

const PortraitSpotlight = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center 42%,
    rgba(255, 252, 240, 0.42) 0%,
    rgba(232, 197, 71, 0.1) 34%,
    transparent 62%
  );
  pointer-events: none;
  z-index: 1;
`;

const PortraitImage = styled.img`
  position: relative;
  z-index: 2;
  height: 100%;
  max-height: 100%;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  object-position: center bottom;
  transform-origin: center bottom;
  transform: scaleX(-1) scaleY(1);
  animation: ${breathe} 2.4s ease-in-out infinite;
  filter: drop-shadow(0 0 1.5px #000)
    drop-shadow(0 8px 14px rgba(40, 28, 14, 0.2));
  pointer-events: none;
`;

const NameplateOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  padding: clamp(8px, 1cqh, 12px) clamp(10px, 1.2cqw, 14px);
`;

const IdentityRecord = styled.div`
  position: absolute;
  right: clamp(10px, 1.2cqw, 14px);
  bottom: clamp(8px, 1cqh, 12px);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
`;

const NameplateRecord = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.78rem, 1.12cqw, 0.95rem);
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: baseline;
  gap: 0.22em;
  font-variant-numeric: tabular-nums;

  .w {
    color: ${C.stam};
  }
  .l {
    color: ${C.vermillion};
  }
  .sep {
    color: rgba(40, 28, 14, 0.4);
  }
`;

const PrepDock = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.85cqh, 10px);
`;

const Block = styled.div`
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1cqh, 12px);
  padding: clamp(10px, 1.2cqh, 14px) clamp(12px, 1.5cqw, 16px);
  background: ${D.plate};
  border: 1px solid ${D.plateEdge};
  box-shadow: 0 12px 28px ${D.shadow};
`;

const BlockHead = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-shrink: 0;
  min-height: 1.15em;
`;

const BlockMeta = styled.div`
  display: inline-flex;
  align-items: center;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.52rem, 0.78cqw, 0.64rem);
  color: ${(p) => (p.$accent ? C.gold : C.creamMute)};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  pointer-events: none;
`;

const StatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.85cqh, 9px);
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: 6.9em minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(8px, 0.9cqw, 12px);
`;

const StatIdentity = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.4em;
  min-width: 0;
`;

const StatLabel = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.58rem, 0.86cqw, 0.72rem);
  color: ${C.creamWarm};
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  white-space: nowrap;
`;

const StatKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-weight: 700;
  font-size: 0.95em;
  color: ${C.creamMute};
  line-height: 1;
`;

const PipTrack = styled.div`
  display: flex;
  align-items: stretch;
  gap: 2px;
  min-width: 0;
  height: clamp(10px, 1.15cqh, 13px);
  padding: 2px;
  background: #050608;
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.7),
    inset 0 0 0 1px rgba(245, 236, 217, 0.1);
`;

const Pip = styled.div`
  flex: 1;
  height: 100%;
  background: ${(p) =>
    p.$filled
      ? "linear-gradient(180deg, #fffaf0 0%, #e8dcc8 100%)"
      : "transparent"};
  box-shadow: ${(p) =>
    p.$filled ? "inset 0 1px 0 rgba(255, 255, 255, 0.35)" : "none"};
  transform-origin: left center;
  ${(p) =>
    p.$filled &&
    css`
      animation: ${pipFill} 0.3s ease-out both;
      animation-delay: ${Math.min(p.$index ?? 0, 10) * 0.03}s;
    `}
`;

const StatControls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StepButton = styled.button`
  width: 1.35em;
  height: 1.35em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.72rem, 1cqw, 0.88rem);
  line-height: 1;
  color: ${(p) => (p.$armed ? C.gold : C.cream)};
  background: ${C.sumiSoft};
  border: 1px solid
    ${(p) => (p.$armed ? C.gold : "rgba(245, 236, 217, 0.16)")};
  cursor: pointer;
  transition: color 0.12s ease, border-color 0.12s ease, transform 0.1s ease;

  &:hover:not(:disabled) {
    color: #fff;
    border-color: ${C.cream};
  }
  &:active:not(:disabled) {
    transform: scale(0.92);
  }
  &:disabled {
    opacity: 0.28;
    cursor: default;
    color: ${C.creamMute};
    border-color: rgba(245, 236, 217, 0.08);
  }
`;

const StatValue = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(0.78rem, 1.15cqw, 0.98rem);
  color: #fff8ee;
  letter-spacing: ${TRACK.none};
  min-width: 1.35em;
  text-align: center;
  font-variant-numeric: tabular-nums;
`;

const AppearanceDock = styled.div`
  position: absolute;
  left: clamp(10px, 1.2cqw, 14px);
  bottom: clamp(8px, 1cqh, 12px);
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
`;

const PaintButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: clamp(22px, 2.6cqh, 26px);
  padding: 0.2em 0.55em 0.16em;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.48rem, 0.7cqw, 0.58rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  color: ${C.cream};
  background: ${C.sumi};
  border: 1px solid rgba(15, 29, 46, 0.45);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, transform 0.12s ease;

  &:hover:not(:disabled) {
    color: #fff;
    border-color: ${C.inkText};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

const OutfitChipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const OutfitChip = styled.button`
  position: relative;
  display: flex;
  width: clamp(22px, 2.6cqw, 28px);
  height: clamp(22px, 2.6cqw, 28px);
  padding: 0;
  overflow: hidden;
  background: none;
  border: 1px solid ${(p) => (p.$active ? C.inkText : "rgba(15, 29, 46, 0.28)")};
  cursor: pointer;
  touch-action: manipulation;
  transition: border-color 0.15s ease, transform 0.12s ease;

  &:hover:not(:disabled) {
    border-color: ${C.inkText};
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
`;

const OutfitChipBelt = styled.span`
  flex: 1.1;
  background: ${(p) => p.$gradient || p.$color || SPRITE_BASE_COLOR};
`;

const OutfitChipBody = styled.span`
  flex: 1;
  background: ${(p) => p.$gradient || p.$color || "#888"};
`;

const OutfitChipCheck = styled.span`
  position: absolute;
  top: 1px;
  right: 2px;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: 0.62rem;
  line-height: 1;
  color: ${C.gold};
  text-shadow: ${PAPER_STROKE};
  pointer-events: none;
`;

// ============================================
// RIGHT — LOADOUT BOARD + DETAIL + START
// ============================================

const LoadoutBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;
  background: transparent;
`;

const LoadoutBoard = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 10px);
  overflow: visible;
`;

const CategoryRow = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 7.4em minmax(0, 1fr);
  align-items: center;
  gap: clamp(10px, 1.2cqw, 16px);
`;

const CategoryIdentity = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-left: 0.55em;
  border-left: 2px solid ${(p) => p.$accent || "rgba(245, 236, 217, 0.28)"};
`;

const CategoryNameRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.45em;
`;

const CategoryKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-weight: 700;
  font-size: 0.95em;
  color: ${C.creamMute};
  line-height: 1;
`;

const CategoryName = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.58rem, 0.86cqw, 0.72rem);
  color: ${C.creamWarm};
  text-transform: uppercase;
  letter-spacing: ${TRACK.meta};
  white-space: nowrap;
`;

const SlotStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;
  justify-items: center;
  gap: clamp(6px, 0.8cqw, 10px);
  width: 100%;
  height: 100%;
  min-width: 0;
`;

const Slot = styled.button`
  position: relative;
  width: min(100%, clamp(48px, 8.2cqh, 72px));
  aspect-ratio: 1;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  background: ${(p) => p.$gradient || p.$main || D.deep};
  border: 2px solid
    ${(p) =>
      p.$state === "on"
        ? C.gold
        : p.$state === "buy"
          ? "rgba(232, 197, 71, 0.45)"
          : p.$focused
            ? C.cream
            : "rgba(245, 236, 217, 0.18)"};
  border-radius: 0;
  box-shadow: ${(p) =>
    p.$state === "on"
      ? `0 0 0 1px ${C.goldDeep}, 0 0 14px rgba(232, 197, 71, 0.45)`
      : p.$focused
        ? "0 0 0 1px rgba(245, 236, 217, 0.55)"
        : "inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -3px 6px rgba(0, 0, 0, 0.28)"};
  cursor: ${(p) => (p.$interactive ? "pointer" : "default")};
  transition: border-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;

  img {
    position: absolute;
    left: 2px;
    top: 2px;
    width: calc(100% - 4px);
    height: ${(p) =>
      p.$state === "owned" ? "calc(100% - 4px)" : "calc(84% - 2px)"};
    object-fit: contain;
    object-position: center;
    pointer-events: none;
    filter: ${(p) =>
      p.$state === "buy" ? "saturate(0.25) brightness(0.45)" : "none"};
  }

  &:hover {
    border-color: ${(p) =>
      p.$interactive
        ? p.$state === "on"
          ? C.gold
          : C.cream
        : p.$state === "on"
          ? C.gold
          : "rgba(245, 236, 217, 0.18)"};
  }
  &:active {
    transform: ${(p) => (p.$interactive ? "scale(0.96)" : "none")};
  }

  ${(p) =>
    p.$state === "buy" &&
    css`
      &::after {
        content: "";
        position: absolute;
        inset: 0 0 22% 0;
        background: rgba(0, 0, 0, 0.45);
        pointer-events: none;
      }
    `}
`;

const SlotBanner = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 22%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.34rem, 0.52cqw, 0.42rem);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  color: ${(p) => (p.$state === "on" ? C.sumi : C.gold)};
  background: ${(p) =>
    p.$state === "on" ? C.gold : "rgba(8, 9, 12, 0.92)"};
  pointer-events: none;
  z-index: 1;
`;

const PlaceholderSlot = styled.div`
  width: min(100%, clamp(48px, 8.2cqh, 72px));
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${D.well};
  border: 2px solid rgba(245, 236, 217, 0.06);
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(245, 236, 217, 0.04);

  &::after {
    content: "";
    width: 26%;
    height: 26%;
    border: 1px solid rgba(245, 236, 217, 0.1);
  }
`;

const SlotKanji = styled.span`
  position: absolute;
  inset: ${(p) => (p.$banner ? "2px 2px 22% 2px" : "2px")};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_KANJI};
  font-size: clamp(0.95rem, 1.35cqw, 1.2rem);
  color: ${C.cream};
  line-height: 1;
`;

// --- Inspect plaque (same footprint as before — board keeps the vertical room) ---

const DetailStrip = styled.div`
  position: relative;
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: clamp(12px, 1.4cqw, 16px);
  height: clamp(84px, 10.5cqh, 100px);
  min-height: clamp(84px, 10.5cqh, 100px);
  margin: clamp(8px, 1cqh, 12px) clamp(-14px, -1.6cqw, -20px)
    clamp(-12px, -1.4cqh, -16px);
  padding: 0 clamp(16px, 1.8cqw, 22px) 0 clamp(18px, 2cqw, 24px);
  overflow: hidden;
  background:
    linear-gradient(
      90deg,
      ${(p) => (p.$accent ? `${p.$accent}22` : "transparent")} 0%,
      transparent 42%
    ),
    ${D.well};
  border-top: 1px solid ${D.borderSoft};
  box-shadow: inset 0 1px 0 rgba(245, 236, 217, 0.07);

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: ${(p) => p.$accent || "transparent"};
    box-shadow: ${(p) =>
      p.$accent ? `0 0 14px ${p.$accent}` : "none"};
    pointer-events: none;
  }
`;

const DetailIcon = styled.div`
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  align-self: center;
  box-sizing: border-box;
  width: clamp(48px, 5.4cqh, 56px);
  height: clamp(48px, 5.4cqh, 56px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  background: ${(p) => p.$gradient || p.$main || D.deep};
  border: 2px solid
    ${(p) =>
      p.$state === "on"
        ? C.gold
        : p.$state === "buy"
          ? "rgba(232, 197, 71, 0.45)"
          : "rgba(245, 236, 217, 0.16)"};
  box-shadow: ${(p) =>
    p.$state === "on"
      ? `0 0 0 1px ${C.goldDeep}, 0 0 12px rgba(232, 197, 71, 0.4)`
      : "inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -3px 6px rgba(0, 0, 0, 0.28)"};
  filter: ${(p) =>
    p.$state === "buy" ? "saturate(0.45) brightness(0.7)" : "none"};

  img {
    position: absolute;
    inset: 2px;
    width: calc(100% - 4px);
    height: ${(p) =>
      p.$state === "owned" ? "calc(100% - 4px)" : "calc(78% - 2px)"};
    object-fit: contain;
    object-position: center;
    pointer-events: none;
  }

  ${SlotBanner} {
    z-index: 2;
  }
`;

const DetailIconKanji = styled.span`
  position: absolute;
  inset: ${(p) => (p.$banner ? "2px 2px 22% 2px" : "2px")};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_KANJI};
  font-size: clamp(1.15rem, 1.8cqw, 1.5rem);
  color: ${C.cream};
  line-height: 1;
`;

const DetailBody = styled.div`
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  align-self: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(5px, 0.7cqh, 8px);
  min-width: 0;
  animation: ${detailShift} 0.18s ease-out;
`;

const DetailHead = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1cqw, 12px);
  min-width: 0;
`;

const DetailName = styled.span`
  flex: 0 0 auto;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.78rem, 1.18cqw, 0.98rem);
  color: #fff8ee;
  text-transform: uppercase;
  letter-spacing: ${TRACK.displayTight};
  line-height: 1;
  white-space: nowrap;
`;

const DetailCost = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.32em;
  padding: 0.18em 0.5em 0.14em;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(0.58rem, 0.82cqw, 0.7rem);
  color: ${C.gold};
  letter-spacing: ${TRACK.meta};
  line-height: 1;
  font-variant-numeric: tabular-nums;
  background: rgba(232, 197, 71, 0.1);
  border: 1px solid rgba(232, 197, 71, 0.38);
  box-shadow: inset 0 1px 0 rgba(255, 250, 240, 0.12);

  span {
    font-size: 0.62em;
    font-weight: ${FONT_WEIGHT.bold};
    color: ${C.creamMute};
    letter-spacing: ${TRACK.label};
    text-transform: uppercase;
  }
`;

const DetailEmpty = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.52rem, 0.78cqw, 0.64rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
`;

const DetailDesc = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.62rem, 0.9cqw, 0.74rem);
  color: rgba(245, 236, 217, 0.92);
  letter-spacing: 0.01em;
  line-height: 1.35;
`;

const DetailAction = styled.div`
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  align-self: stretch;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1cqw, 12px);
  padding-left: clamp(12px, 1.5cqw, 18px);
  border-left: 1px solid ${D.borderSoft};
`;

const ActionButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 7.6em;
  min-height: clamp(40px, 4.8cqh, 48px);
  padding: 0.12em 0.85em 0.08em;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.58rem, 0.84cqw, 0.72rem);
  letter-spacing: ${TRACK.label};
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  background: none;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: color 0.12s ease, opacity 0.15s ease, transform 0.1s ease,
    background 0.12s ease, border-color 0.12s ease, filter 0.12s ease;

  .envelope {
    display: block;
    height: clamp(32px, 4.2cqh, 40px);
    width: auto;
    object-fit: contain;
    object-position: center;
    flex-shrink: 0;
  }

  ${(p) =>
    p.$variant === "buy" &&
    css`
      color: ${C.sumi};
      background: ${C.gold};
      padding: 0 0.85em 0 0.95em;
      box-shadow: inset 0 1px 0 rgba(255, 250, 240, 0.28);
      &:hover:not(:disabled) {
        background: #ffe07a;
      }
    `}
  ${(p) =>
    p.$variant === "equip" &&
    css`
      color: #fff8ee;
      border: 2px solid rgba(245, 236, 217, 0.42);
      &:hover:not(:disabled) {
        color: #fff;
        border-color: ${C.cream};
        background: rgba(245, 236, 217, 0.06);
      }
    `}
  ${(p) =>
    p.$variant === "equipped" &&
    css`
      color: ${C.sumi};
      background: ${C.gold};
      box-shadow: inset 0 1px 0 rgba(255, 250, 240, 0.28);
      &:hover:not(:disabled) {
        background: #ffe07a;
      }
    `}

  &:active:not(:disabled) {
    transform: scale(0.96);
  }
  &:disabled {
    cursor: default;
    opacity: 0.35;
    color: ${C.creamMute};
    background: transparent;
    border-color: rgba(245, 236, 217, 0.12);
    box-shadow: none;
  }
`;

const StartDock = styled.footer`
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: clamp(12px, 1.6cqw, 20px);
  flex-shrink: 0;
  margin: 0 clamp(22px, 3.6cqw, 54px) clamp(14px, 2cqh, 22px);
  padding: clamp(6px, 0.9cqh, 10px) 0;
  background: none;
  border: none;
  box-shadow: none;
  animation: ${clipRevealUp} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.22s both;
`;

const KachiMeter = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  min-width: 0;
`;

const KachiRecord = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(0.95rem, 1.4cqw, 1.18rem);
  letter-spacing: ${TRACK.none};
  display: inline-flex;
  align-items: baseline;
  gap: 0.14em;
  flex-shrink: 0;

  .w {
    color: ${C.stam};
  }
  .l {
    color: ${C.vermillion};
  }
  .sep {
    color: ${D.textFaint};
  }
`;

const KachiPips = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 3px;
  min-width: 0;
  flex: 1;
  max-width: 280px;
`;

const KachiPip = styled.div`
  flex: 1;
  height: 8px;
  background: ${(p) =>
    p.$outcome === "win"
      ? C.stam
      : p.$outcome === "loss"
        ? C.vermillion
        : "rgba(15, 29, 46, 0.16)"};
`;

const KachiWord = styled.div`
  flex-shrink: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.5rem, 0.74cqw, 0.62rem);
  color: ${(p) =>
    p.$kind === "mk" ? C.vermillion : C.goldDeep};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
`;

const readyPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(216, 59, 39, 0.5), 0 4px 14px rgba(0, 0, 0, 0.4);
  }
  50% {
    box-shadow: 0 0 34px rgba(238, 81, 65, 0.78), 0 6px 18px rgba(0, 0, 0, 0.45);
  }
`;

/*
 * Start CTA — same footprint as Lobby Ready, louder presence.
 * Bright vermillion + soft red pulse. No cream/white trim.
 */
const StartButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.1cqw, 12px);
  min-height: clamp(40px, 4.8cqh, 48px);
  padding: clamp(8px, 1.1cqh, 12px) clamp(24px, 3.2cqw, 44px);
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(0.78rem, 1.1cqw, 0.95rem);
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  color: #ffffff;
  background: linear-gradient(
    180deg,
    ${C.vermillionBright} 0%,
    ${C.vermillion} 52%,
    ${C.vermillionDeep} 100%
  );
  border: 1px solid ${C.vermillionDeep};
  border-radius: 0;
  cursor: pointer;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  animation: ${readyPulse} 1.8s ease-in-out infinite;
  transition: background 0.16s ease, transform 0.12s ease, filter 0.16s ease;

  &::before {
    content: "";
    position: absolute;
    inset: 1px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    pointer-events: none;
  }

  &:hover {
    filter: brightness(1.1);
    animation: none;
    box-shadow: 0 0 38px rgba(238, 81, 65, 0.82), 0 6px 18px rgba(0, 0, 0, 0.45);
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.98);
    filter: brightness(0.95);
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
    animation: none;
    filter: none;
    transform: none;
    box-shadow: none;
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
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.55rem, 0.85cqw, 0.68rem);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  margin-bottom: 2px;
`;

const DevButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 34px;
  padding: clamp(6px, 0.9cqh, 9px) clamp(10px, 1.3cqw, 13px);
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.5rem, 0.75cqw, 0.6rem);
  text-transform: uppercase;
  letter-spacing: ${TRACK.meta};
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

/** First real option so the detail strip always has something to show. */
function firstFocus() {
  for (const cat of LOADOUT_CATEGORIES) {
    const opts = LOADOUT_OPTIONS[cat.key] || [];
    if (opts.length) return { catKey: cat.key, optId: opts[0].id };
  }
  return null;
}

function BashoHub({ onBack, onStartRun }) {
  const lowSpec = useLowSpec();
  const {
    player1Color,
    player1BodyColor,
    setPlayer1Color,
    setPlayer1BodyColor,
  } = usePlayerColors();

  const [career, setCareer] = useState(() => makeDefaultSave().career);
  const [resumeRun, setResumeRun] = useState(null);
  const [customization, setCustomization] = useState(() =>
    makeDefaultCustomization(),
  );
  const [activeOutfitId, setActiveOutfitId] = useState(
    () => makeDefaultCustomization().activeOutfitId,
  );

  const saveDocRef = useRef(null);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const careerRef = useRef(career);
  careerRef.current = career;
  const [saveReady, setSaveReady] = useState(false);

  const [previewSrc, setPreviewSrc] = useState(pumo);
  const mountedRef = useRef(true);

  const [showBanzuke, setShowBanzuke] = useState(false);
  const [outfitOpen, setOutfitOpen] = useState(false);
  const outfitDockRef = useRef(null);

  // Option shown in the detail strip. Updated on hover + click of REAL slots.
  const [focused, setFocused] = useState(() => firstFocus());

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
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Flush pending career edits so a quick Start / leave doesn't drop them.
      if (loadedRef.current) {
        patchSave({ career: careerRef.current });
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSave().then((doc) => {
      if (cancelled) return;
      saveDocRef.current = doc;
      setCareer({
        ...doc.career,
        loadout: migrateLoadout(doc.career?.loadout),
      });
      const c = normalizeCustomization(doc.customization);
      setCustomization(c);
      setActiveOutfitId(c.activeOutfitId);
      applyOutfitToPlayer1Setters(getActiveOutfit(c), {
        setPlayer1Color,
        setPlayer1BodyColor,
      });
      if (doc.bashoRun?.active) {
        const migrated = ensureOpponentRanks(doc.bashoRun);
        if (migrated !== doc.bashoRun) {
          patchSave({ bashoRun: migrated }).then((updated) => {
            saveDocRef.current = updated;
          });
          setResumeRun(migrated);
        } else {
          setResumeRun(doc.bashoRun);
        }
      }
      loadedRef.current = true;
      setSaveReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [setPlayer1Color, setPlayer1BodyColor]);

  useEffect(() => {
    if (!outfitOpen) return;
    const onPointer = (event) => {
      if (!outfitDockRef.current?.contains(event.target)) {
        setOutfitOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOutfitOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [outfitOpen]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const written = await patchSave({ career });
      saveDocRef.current = written;
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [career]);

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

  const activeOutfit = getOutfitById(customization, activeOutfitId);
  const equippedHeadGearId = getEquippedHeadGearId(activeOutfit);

  useEffect(() => {
    let cancelled = false;
    buildIdlePortraitSrc({
      baseSrc: pumo,
      mawashiColor: player1Color,
      bodyColor: player1BodyColor,
      gearIds: activeOutfit?.gearIds,
    })
      .then((src) => {
        if (!cancelled && mountedRef.current) setPreviewSrc(src);
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) setPreviewSrc(pumo);
      });
    return () => {
      cancelled = true;
    };
  }, [player1Color, player1BodyColor, equippedHeadGearId, activeOutfitId]);

  const handleStart = useCallback(async () => {
    if (!saveReady || !onStartRun) return;
    playButtonPressSound2();
    // Flush any pending career debounce before creating the match.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    // Patch career onto disk first so a Customize outfit write can't be
    // clobbered by a stale in-memory saveDoc snapshot.
    const flushed = await patchSave({ career });
    saveDocRef.current = flushed;
    if (resumeRun) {
      await onStartRun({ run: resumeRun, save: flushed });
      return;
    }
    const run = createRun(career);
    await onStartRun({ run, save: { ...flushed, bashoRun: run } });
  }, [career, resumeRun, onStartRun, saveReady]);

  // Editing is LOCKED while a basho is in progress (no mid-tournament respec).
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

  const unlockAll = career.unlocks.includes("__all__");

  const optionLocked = (opt) =>
    !!opt.unlock && !unlockAll && !career.unlocks.includes(opt.unlock);

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

  const buyUnlock = (unlockId) => {
    if (runLocked) return;
    const item = UNLOCK_BY_ID[unlockId];
    if (!item) return;
    if (isUnlocked(career, item.id)) return;
    if ((career.envelopes || 0) < item.cost) return;
    playButtonPressSound2();
    setCareer((c) => ({
      ...c,
      envelopes: (c.envelopes || 0) - item.cost,
      unlocks: [...(c.unlocks || []), item.id],
    }));
  };

  // Click a real slot: focus it; if owned + unlocked, toggle equip. Locked
  // slots only focus (buy is the explicit CTA in the detail strip).
  const handleSlotClick = (catKey, opt) => {
    setFocused({ catKey, optId: opt.id });
    if (runLocked) return;
    if (optionLocked(opt)) return;
    toggleLoadoutOption(catKey, opt);
  };

  const handleSlotHover = (catKey, opt) => {
    playButtonHoverSound();
    setFocused({ catKey, optId: opt.id });
  };

  const handleOutfitSelect = (outfitId) => {
    if (!saveReady || outfitId === activeOutfitId) return;
    playButtonPressSound2();
    const outfit = getOutfitById(customization, outfitId);
    const next = withActiveOutfitId(customization, outfitId);
    setCustomization(next);
    setActiveOutfitId(outfitId);
    applyOutfitToPlayer1Setters(outfit, {
      setPlayer1Color,
      setPlayer1BodyColor,
    });
    patchSave({ customization: next }).then((doc) => {
      saveDocRef.current = doc;
    });
  };

  // ---- Debug actions (in-memory only) ----

  const devMaxStats = () => {
    playButtonPressSound2();
    const spent = ATTRIBUTES.reduce((acc, a) => {
      acc[a.key] = STAT_MAX - STAT_BASE;
      return acc;
    }, {});
    setCareer((c) => ({ ...c, statPoints: { available: 0, spent } }));
  };

  const devClearStats = () => {
    playButtonPressSound2();
    const fresh = makeDefaultSave().career.statPoints;
    setCareer((c) => ({
      ...c,
      statPoints: { available: fresh.available, spent: { ...fresh.spent } },
    }));
  };

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
    const c = normalizeCustomization(doc.customization);
    setCustomization(c);
    setActiveOutfitId(c.activeOutfitId);
    applyOutfitToPlayer1Setters(getActiveOutfit(c), {
      setPlayer1Color,
      setPlayer1BodyColor,
    });
    setResumeRun(null);
  };

  // ---- Derived display values ----

  const division = getDivision(career.rank);
  const rankLabel = formatRank(career.rank);
  const bouts = boutsForRank(career.rank);

  const loadoutUsed = loadoutSpent(career.loadout);
  const loadoutRemaining = LOADOUT_BUDGET - loadoutUsed;

  // Focused option → detail strip state.
  const focusedOpt = focused
    ? (LOADOUT_OPTIONS[focused.catKey] || []).find((o) => o.id === focused.optId)
    : null;
  const focusedLocked = focusedOpt ? optionLocked(focusedOpt) : false;
  const focusedSelected =
    focusedOpt &&
    !focusedLocked &&
    (career.loadout?.[focused.catKey] || []).includes(focusedOpt.id);
  const focusedUnlock = focusedOpt?.unlock ? UNLOCK_BY_ID[focusedOpt.unlock] : null;
  const focusedVisual = focusedOpt ? getLoadoutOptionIcon(focusedOpt.id) : null;
  const focusedSlotState = focusedLocked
    ? "buy"
    : focusedSelected
      ? "on"
      : focusedOpt
        ? "owned"
        : null;
  const focusedCost = focusedOpt?.cost || 0;
  const focusedPointAffordable =
    !!focusedSelected || focusedCost <= loadoutRemaining;
  const focusedEnvAffordable = focusedUnlock
    ? (career.envelopes || 0) >= focusedUnlock.cost
    : true;
  const runWins = resumeRun?.record?.wins ?? 0;
  const runLosses = resumeRun?.record?.losses ?? 0;
  const runResults = resumeRun?.results || [];
  const kkNeeded = division.kk;
  const kachiLocked = kkNeeded != null && runWins >= kkNeeded;
  const makeLocked =
    kkNeeded != null && runLosses > bouts - kkNeeded;
  const kachiKind = makeLocked ? "mk" : kachiLocked ? "kk" : "goal";
  const kachiLabel =
    kkNeeded == null
      ? "Title defense"
      : kachiLocked
        ? "Kachi-koshi"
        : makeLocked
          ? "Make-koshi"
          : `${kkNeeded - runWins} for kachi-koshi`;

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
      <AtmosphereKanji aria-hidden>場</AtmosphereKanji>
      <GrainOverlay />
      <Vignette />
      {!lowSpec && <Snowfall intensity={8} showFrost={false} zIndex={1} />}

      <TopBar>
        <TopBarLeft>
          <GhostButton
            onClick={() => {
              playButtonPressSound2();
              onBack();
            }}
            onMouseEnter={playButtonHoverSound}
          >
            <span className="arrow">&larr;</span>
            Back
          </GhostButton>
        </TopBarLeft>

        <TitleBlock>
          <TitleKanji aria-hidden>場所</TitleKanji>
          <PageTitle>Basho</PageTitle>
        </TitleBlock>

        <TopBarRight>
          <Currency>
            <img
              className="envelope"
              src={envelopeImg}
              alt="Kenshō"
              aria-hidden
            />
            {career.envelopes.toLocaleString()}
          </Currency>
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
        {/* LEFT — rikishi in the heya */}
        <HeyaColumn>
          <PortraitFrame>
            <PortraitStage>
              <PortraitSpotlight />
              <FighterFigure>
                <PortraitRing aria-hidden />
                <PortraitFloor />
                <PortraitImage
                  src={previewSrc}
                  alt="Your wrestler"
                  onError={(e) => {
                    // Dead hat-composite blob after a match teardown used to leave
                    // the flipped alt text ("relts erw ruoY") in the portrait.
                    if (e.currentTarget.src !== pumo) {
                      e.currentTarget.src = pumo;
                    }
                  }}
                />
              </FighterFigure>
              <NameplateOverlay>
                <TitleRank
                  type="button"
                  onClick={() => {
                    playButtonPressSound2();
                    setShowBanzuke(true);
                  }}
                  onMouseEnter={playButtonHoverSound}
                  title="View the banzuke"
                  aria-label={`${rankLabel}, view the banzuke`}
                >
                  {rankLabel}
                </TitleRank>
                <IdentityRecord>
                  <NameplateRecord>
                    <span className="w">{career.lifetime.boutsWon}</span>
                    <span className="sep">–</span>
                    <span className="l">{career.lifetime.boutsLost}</span>
                  </NameplateRecord>
                </IdentityRecord>
              </NameplateOverlay>
              <AppearanceDock ref={outfitDockRef}>
                <PaintButton
                  type="button"
                  aria-label="Change outfit"
                  aria-expanded={outfitOpen}
                  disabled={!saveReady}
                  onClick={() => {
                    playButtonPressSound2();
                    setOutfitOpen((open) => !open);
                  }}
                  onMouseEnter={saveReady ? playButtonHoverSound : undefined}
                  title="Looks"
                >
                  Looks
                </PaintButton>
                {outfitOpen && (
                  <OutfitChipRow role="listbox" aria-label="Outfit presets">
                    {customization.outfits.map((outfit) => {
                      const belt = BELT_ALL.find(
                        (c) => c.hex === outfit.mawashiColor,
                      );
                      const body = BODY_COLORS.find(
                        (c) => c.hex === outfit.bodyColor,
                      );
                      const active = outfit.id === activeOutfitId;
                      return (
                        <OutfitChip
                          key={outfit.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          $active={active}
                          disabled={!saveReady}
                          onClick={() => handleOutfitSelect(outfit.id)}
                          onMouseEnter={
                            saveReady ? playButtonHoverSound : undefined
                          }
                          title={outfit.name}
                        >
                          <OutfitChipBelt
                            $color={outfit.mawashiColor || SPRITE_BASE_COLOR}
                            $gradient={belt?.gradient}
                          />
                          <OutfitChipBody
                            $color={outfit.bodyColor || "#888"}
                            $gradient={body?.gradient}
                          />
                          {active && <OutfitChipCheck>✓</OutfitChipCheck>}
                        </OutfitChip>
                      );
                    })}
                  </OutfitChipRow>
                )}
              </AppearanceDock>
            </PortraitStage>
          </PortraitFrame>

          <PrepDock>
            <Block>
              <BlockHead>
                <BlockMeta
                  $accent={!runLocked && career.statPoints.available > 0}
                >
                  {career.statPoints.available} pts
                </BlockMeta>
              </BlockHead>
              <StatList>
                {ATTRIBUTES.map((attr) => {
                  const spent = career.statPoints.spent[attr.key] || 0;
                  const value = STAT_BASE + spent;
                  return (
                    <StatRow key={attr.key} title={attr.desc}>
                      <StatIdentity>
                        <StatLabel>{attr.label}</StatLabel>
                        <StatKanji aria-hidden>{attr.kanji}</StatKanji>
                      </StatIdentity>
                      <PipTrack>
                        {Array.from({ length: STAT_MAX }).map((_, i) => (
                          <Pip key={i} $filled={i < value} $index={i} />
                        ))}
                      </PipTrack>
                      <StatControls>
                        <StepButton
                          aria-label={`Lower ${attr.label}`}
                          onClick={() => refundStat(attr.key)}
                          onMouseEnter={playButtonHoverSound}
                          disabled={runLocked || spent <= 0}
                        >
                          &minus;
                        </StepButton>
                        <StatValue>{value}</StatValue>
                        <StepButton
                          aria-label={`Raise ${attr.label}`}
                          onClick={() => spendStat(attr.key)}
                          onMouseEnter={playButtonHoverSound}
                          $armed={
                            !runLocked &&
                            career.statPoints.available > 0 &&
                            value < STAT_MAX
                          }
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
            </Block>
          </PrepDock>
        </HeyaColumn>

        {/* RIGHT — hanging technique board */}
        <BoardColumn>
          <BoardHead>
            <BoardMeta
              $accent={!runLocked && loadoutRemaining > 0}
            >
              {loadoutRemaining} pt{loadoutRemaining === 1 ? "" : "s"}
            </BoardMeta>
          </BoardHead>

          <LoadoutBody>
            <LoadoutBoard>
              {LOADOUT_CATEGORIES.map((cat) => {
                const options = LOADOUT_OPTIONS[cat.key] || [];
                const selected = career.loadout?.[cat.key] || [];
                const placeholders = Math.max(
                  0,
                  SLOTS_PER_CATEGORY - options.length,
                );
                return (
                  <CategoryRow key={cat.key}>
                    <CategoryIdentity $accent={CAT_ACCENT[cat.key]}>
                      <CategoryNameRow>
                        <CategoryName>{cat.label}</CategoryName>
                        <CategoryKanji aria-hidden>{cat.kanji}</CategoryKanji>
                      </CategoryNameRow>
                    </CategoryIdentity>

                    <SlotStrip>
                      {options.map((opt) => {
                        const locked = optionLocked(opt);
                        const isOn = !locked && selected.includes(opt.id);
                        const isFocused =
                          focused?.catKey === cat.key &&
                          focused?.optId === opt.id;
                        const visual = getLoadoutOptionIcon(opt.id);
                        const slotState = locked
                          ? "buy"
                          : isOn
                            ? "on"
                            : "owned";
                        return (
                          <Slot
                            key={opt.id}
                            type="button"
                            $interactive={!runLocked}
                            $state={slotState}
                            $focused={isFocused}
                            $main={visual?.main}
                            $deep={visual?.deep}
                            $gradient={visual?.gradient}
                            $imgSize={visual?.imgSize}
                            $imgScale={visual?.imgScale}
                            title={opt.label}
                            aria-label={opt.label}
                            aria-pressed={isOn}
                            onClick={() => handleSlotClick(cat.key, opt)}
                            onMouseEnter={() => handleSlotHover(cat.key, opt)}
                          >
                            {visual ? (
                              <img src={visual.icon} alt="" aria-hidden />
                            ) : (
                              <SlotKanji
                                $banner={slotState !== "owned"}
                                aria-hidden
                              >
                                {opt.kanji}
                              </SlotKanji>
                            )}
                            {slotState !== "owned" && (
                              <SlotBanner $state={slotState}>
                                {locked ? "Buy" : "Equipped"}
                              </SlotBanner>
                            )}
                          </Slot>
                        );
                      })}
                      {Array.from({ length: placeholders }).map((_, i) => (
                        <PlaceholderSlot
                          key={`ph-${i}`}
                          title="Technique sealed — coming later"
                          aria-label="Technique sealed"
                        />
                      ))}
                    </SlotStrip>
                  </CategoryRow>
                );
              })}
            </LoadoutBoard>

            {/* DETAIL — hover to preview, click/CTA to equip or buy */}
            <DetailStrip $accent={focusedOpt ? CAT_ACCENT[focused.catKey] : null}>
              {focusedOpt ? (
                <>
                  {focusedVisual ? (
                    <DetailIcon
                      $main={focusedVisual.main}
                      $deep={focusedVisual.deep}
                      $gradient={focusedVisual.gradient}
                      $state={focusedSlotState}
                      aria-hidden
                    >
                      <img src={focusedVisual.icon} alt="" />
                      {focusedSlotState !== "owned" && (
                        <SlotBanner $state={focusedSlotState}>
                          {focusedLocked ? "Buy" : "Equipped"}
                        </SlotBanner>
                      )}
                    </DetailIcon>
                  ) : (
                    <DetailIcon $state={focusedSlotState} aria-hidden>
                      <DetailIconKanji
                        $banner={focusedSlotState !== "owned"}
                        aria-hidden
                      >
                        {focusedOpt.kanji}
                      </DetailIconKanji>
                      {focusedSlotState !== "owned" && (
                        <SlotBanner $state={focusedSlotState}>
                          {focusedLocked ? "Buy" : "Equipped"}
                        </SlotBanner>
                      )}
                    </DetailIcon>
                  )}

                  <DetailBody key={focusedOpt.id}>
                    <DetailHead>
                      <DetailName>{focusedOpt.label}</DetailName>
                      {!focusedLocked && (
                        <DetailCost>
                          {focusedCost}
                          <span>pt{focusedCost === 1 ? "" : "s"}</span>
                        </DetailCost>
                      )}
                    </DetailHead>
                    <DetailDesc>{focusedOpt.desc}</DetailDesc>
                  </DetailBody>

                  <DetailAction>
                    {focusedLocked ? (
                      <ActionButton
                        type="button"
                        $variant="buy"
                        disabled={
                          runLocked || !focusedUnlock || !focusedEnvAffordable
                        }
                        onClick={() =>
                          focusedUnlock && buyUnlock(focusedUnlock.id)
                        }
                        onMouseEnter={playButtonHoverSound}
                        title={
                          focusedEnvAffordable
                            ? "Purchase with Kenshō"
                            : "Not enough Kenshō"
                        }
                      >
                        {focusedUnlock ? (
                          <>
                            Buy {focusedUnlock.cost}
                            <img
                              className="envelope"
                              src={envelopeImg}
                              alt=""
                              aria-hidden
                            />
                          </>
                        ) : (
                          "Locked"
                        )}
                      </ActionButton>
                    ) : (
                      <ActionButton
                        type="button"
                        $variant={focusedSelected ? "equipped" : "equip"}
                        disabled={
                          runLocked || (!focusedSelected && !focusedPointAffordable)
                        }
                        onClick={() =>
                          toggleLoadoutOption(focused.catKey, focusedOpt)
                        }
                        onMouseEnter={playButtonHoverSound}
                        title={
                          focusedSelected
                            ? "Unequip"
                            : focusedPointAffordable
                              ? "Equip"
                              : "No loadout points left"
                        }
                      >
                        {focusedSelected ? "Unequip" : "Equip"}
                      </ActionButton>
                    )}
                  </DetailAction>
                </>
              ) : (
                <DetailEmpty>Select a technique</DetailEmpty>
              )}
            </DetailStrip>
          </LoadoutBody>
        </BoardColumn>
      </Stage>

      <StartDock>
        <KachiMeter>
          <KachiRecord>
            <span className="w">{runWins}</span>
            <span className="sep">–</span>
            <span className="l">{runLosses}</span>
          </KachiRecord>
          <KachiPips
            role="img"
            aria-label={
              kkNeeded == null
                ? `${runWins} wins, ${runLosses} losses of ${bouts} bouts, title defense`
                : kachiLocked
                  ? `Kachi-koshi, ${runWins} wins, ${runLosses} losses`
                  : makeLocked
                    ? `Make-koshi, ${runWins} wins, ${runLosses} losses`
                    : `${runWins} wins, ${runLosses} losses. ${kkNeeded - runWins} more wins for kachi-koshi of ${bouts} bouts`
            }
          >
            {Array.from({ length: bouts }).map((_, i) => {
              const day = runResults.find((r) => r.day === i + 1);
              return (
                <KachiPip
                  key={i}
                  $outcome={
                    day ? (day.won ? "win" : "loss") : null
                  }
                />
              );
            })}
          </KachiPips>
          <KachiWord $kind={kachiKind}>{kachiLabel}</KachiWord>
        </KachiMeter>
        <StartButton
          onClick={handleStart}
          onMouseEnter={saveReady ? playButtonHoverSound : undefined}
          disabled={!saveReady}
        >
          {resumeRun ? "Resume Basho" : "Start Basho"}
        </StartButton>
      </StartDock>

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
