/**
 * BashoHub — Single-player BASHO career/roguelite hub.
 *
 * One-screen, no-scroll career hub on the same lit-black stage as DayCard:
 *   LEFT  — portrait frame (rank / record / outfit brush), then attributes.
 *   RIGHT — technique plate (rows + inspect), same chrome as attributes.
 *   DOCK  — kachi-koshi line + Start / Resume, no footer bar.
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
import pumo from "../assets/pumo-idle.png";
import envelopeImg from "../assets/envelope.png";
import flapIcon from "../assets/flap-icon.png";
import shatterPalmIcon from "../assets/shatter-palm-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
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
  TEXT_SHADOW_UI,
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
 * D — DayCard studio black + cream type. Gold is rank / currency / unlock
 * only. Plates are solid ink so they read on the black stage.
 */
const D = {
  page: "#050505",
  soft: C.sumiSoft,
  softHover: "#2c313a",
  deep: "#0c0e14",
  border: "rgba(245, 236, 217, 0.22)",
  borderSoft: "rgba(245, 236, 217, 0.12)",
  shadow: "rgba(0, 0, 0, 0.5)",
  shadowStrong: "rgba(0, 0, 0, 0.72)",
  textMute: "rgba(245, 236, 217, 0.78)",
  textFaint: "rgba(245, 236, 217, 0.4)",
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

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.12 0-.93.74-1.66 1.67-1.66h2C19.5 16.4 22 13.89 22 10.84 22 6.01 17.52 2 12 2zm1.5 5.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm4.1 3.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM8.5 6.9a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM6.5 12a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 6.5 12z"
      />
    </svg>
  );
}

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
  /* Same lit near-black stage as DayCard — warm top pool, cool floor, #050505. */
  background:
    radial-gradient(
      130% 100% at 50% -8%,
      rgba(232, 197, 71, 0.1) 0%,
      rgba(0, 0, 0, 0) 46%
    ),
    radial-gradient(
      120% 82% at 50% 116%,
      rgba(28, 78, 110, 0.16) 0%,
      rgba(0, 0, 0, 0) 54%
    ),
    #050505;
`;

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(
    ellipse 118% 100% at 50% 46%,
    transparent 54%,
    rgba(5, 4, 8, 0.5) 100%
  );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.22;
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
  text-shadow: ${TEXT_SHADOW_UI};
  box-shadow: none;
  transition: color 0.18s ease, transform 0.18s ease;

  .arrow {
    font-weight: 700;
    transition: transform 0.2s ease;
  }
  &:hover {
    color: ${C.cream};
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
  will-change: transform, opacity;
  animation: ${fadeUp} 0.42s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s both;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.35rem, 2.5cqw, 2rem);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: ${TRACK.display};
  line-height: 1;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
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
  gap: 8px;
  margin: 0;
  padding: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.72rem, 1.05cqw, 0.9rem);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  text-shadow: ${PAPER_STROKE};
  background: none;
  border: none;
  cursor: pointer;
  pointer-events: auto;
  transition: color 0.15s ease;

  .ladder {
    font-family: ${FONT_BODY};
    font-size: 0.88em;
    line-height: 1;
    opacity: 0.7;
  }
  &:hover {
    color: #ffe07a;
    .ladder {
      opacity: 1;
    }
  }
`;

const Currency = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  padding: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.72rem, 1.08cqw, 0.9rem);
  color: ${C.gold};
  letter-spacing: ${TRACK.meta};
  background: none;
  border: none;
  box-shadow: none;
  text-shadow: ${TEXT_SHADOW_UI}, 0 0 8px rgba(232, 197, 71, 0.22);

  .envelope {
    height: 2.35em;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
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
  border: 1px solid ${D.borderSoft};
  box-shadow: 0 18px 40px ${D.shadowStrong};
  will-change: transform, opacity;
  animation: ${clipRevealRight} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.16s both;
`;

const BoardHead = styled.header`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
`;

const BoardTitle = styled.h2`
  margin: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.58rem, 0.86cqw, 0.72rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
`;

const BoardMeta = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.52rem, 0.78cqw, 0.64rem);
  color: ${(p) => (p.$accent ? C.cream : C.creamMute)};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
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
  border: 1px solid ${D.borderSoft};
  box-shadow: 0 18px 40px ${D.shadowStrong};
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

const NameplateLabel = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.64cqw, 0.52rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  text-shadow: ${PAPER_STROKE};
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
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(0.95rem, 1.4cqw, 1.18rem);
  letter-spacing: ${TRACK.none};
  display: inline-flex;
  align-items: baseline;
  gap: 0.14em;
  text-shadow: ${PAPER_STROKE};

  .w {
    color: ${C.successBright};
  }
  .l {
    color: ${C.vermillionBright};
  }
  .sep {
    color: ${C.cream};
  }
`;

const PrepDock = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.85cqh, 10px);
`;

const Block = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.2cqh, 14px);
  padding: clamp(10px, 1.2cqh, 14px) clamp(12px, 1.5cqw, 16px);
  background: ${D.plate};
  border: 1px solid ${D.borderSoft};
  box-shadow: 0 12px 28px ${D.shadow};
`;

const BlockHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const BlockLabel = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 0.8cqw, 9px);
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.58rem, 0.86cqw, 0.72rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
`;

const BlockMeta = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.52rem, 0.78cqw, 0.64rem);
  color: ${(p) => (p.$accent ? C.cream : C.creamMute)};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
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
  align-items: center;
  gap: 3px;
  min-width: 0;
`;

const Pip = styled.div`
  flex: 1;
  height: clamp(6px, 0.82cqh, 8px);
  background: ${(p) => (p.$filled ? "#fff8ee" : "#08090c")};
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
  width: 1.15em;
  height: 1.15em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.78rem, 1.1cqw, 0.95rem);
  line-height: 1;
  color: ${C.cream};
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.12s ease, transform 0.1s ease;

  &:hover:not(:disabled) {
    color: #fff;
  }
  &:active:not(:disabled) {
    transform: scale(0.9);
  }
  &:disabled {
    opacity: 0.22;
    cursor: default;
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
  width: clamp(26px, 3cqw, 32px);
  height: clamp(26px, 3cqw, 32px);
  padding: 0;
  color: ${C.inkText};
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease, transform 0.12s ease;

  svg {
    width: 1.35em;
    height: 1.35em;
  }

  &:hover:not(:disabled) {
    color: ${C.inkTextStrong};
    transform: scale(1.06);
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
  overflow: hidden;
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

const CategorySub = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.4rem, 0.6cqw, 0.5rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: ${TRACK.meta};
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
  background: ${(p) => p.$gradient || p.$main || D.deep};
  border: 1px solid
    ${(p) =>
      p.$focused || p.$selected ? C.cream : "transparent"};
  border-radius: 0;
  cursor: ${(p) => (p.$interactive ? "pointer" : "default")};
  transition: border-color 0.15s ease, transform 0.1s ease;

  img {
    width: ${(p) => p.$imgSize || "82%"};
    height: ${(p) => p.$imgSize || "82%"};
    object-fit: contain;
    transform: scale(${(p) => p.$imgScale ?? 1});
    pointer-events: none;
  }

  &:hover {
    border-color: ${(p) => (p.$interactive ? C.cream : "transparent")};
  }
  &:active {
    transform: ${(p) => (p.$interactive ? "scale(0.96)" : "none")};
  }
`;

const LockedSlot = styled(Slot)`
  img {
    opacity: 0.78;
    filter: saturate(0.72) brightness(0.86);
  }
`;

const PlaceholderSlot = styled.div`
  width: min(100%, clamp(48px, 8.2cqh, 72px));
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #08090c;
`;

const PlaceholderGlyph = styled.span`
  font-family: ${FONT_KANJI};
  font-weight: 700;
  font-size: clamp(0.7rem, 1cqw, 0.88rem);
  color: rgba(245, 236, 217, 0.22);
  line-height: 1;
`;

const SlotKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-size: clamp(0.95rem, 1.35cqw, 1.2rem);
  color: ${C.cream};
  line-height: 1;
`;

const SlotCheck = styled.span`
  position: absolute;
  top: 2px;
  right: 4px;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: 0.62rem;
  line-height: 1;
  color: ${C.gold};
  pointer-events: none;
`;

const SlotLock = styled.span`
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 0.7em;
  height: 0.7em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${C.cream};
  pointer-events: none;

  svg {
    width: 100%;
    height: 100%;
  }
`;

// --- Detail strip (compact — board/icons get the vertical room) ---

const DetailStrip = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.3cqw, 14px);
  min-height: clamp(56px, 7.6cqh, 72px);
  padding-top: clamp(10px, 1.2cqh, 14px);
  border-top: 1px solid ${D.borderSoft};
`;

const DetailIcon = styled.div`
  position: relative;
  flex-shrink: 0;
  width: clamp(40px, 5cqw, 52px);
  height: clamp(40px, 5cqw, 52px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => p.$gradient || p.$main || D.deep};

  img {
    width: ${(p) => p.$imgSize || "80%"};
    height: ${(p) => p.$imgSize || "80%"};
    object-fit: contain;
    opacity: ${(p) => (p.$locked ? 0.78 : 1)};
    filter: ${(p) =>
      p.$locked ? "saturate(0.72) brightness(0.86)" : "none"};
  }

  .lock {
    position: absolute;
    bottom: 3px;
    right: 3px;
    width: 0.7em;
    height: 0.7em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${C.cream};

    svg {
      width: 100%;
      height: 100%;
    }
  }
`;

const DetailIconKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-size: clamp(1.15rem, 1.8cqw, 1.5rem);
  color: ${C.cream};
`;

const DetailBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(3px, 0.55cqh, 6px);
  min-width: 0;
  flex: 1;
  animation: ${detailShift} 0.18s ease-out;
`;

const DetailTopRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: clamp(7px, 1.1cqw, 12px);
  flex-wrap: wrap;
`;

const DetailName = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.7rem, 1.05cqw, 0.88rem);
  color: #fff8ee;
  text-transform: uppercase;
  letter-spacing: ${TRACK.meta};
`;

const DetailTag = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.62cqw, 0.52rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
`;

const DetailEmpty = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  min-height: inherit;
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
  font-size: clamp(0.52rem, 0.76cqw, 0.62rem);
  color: rgba(245, 236, 217, 0.88);
  letter-spacing: 0.01em;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DetailAction = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: clamp(28px, 3.4cqh, 34px);
  padding: 0;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.52rem, 0.76cqw, 0.64rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  white-space: nowrap;
  background: none;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: color 0.12s ease, opacity 0.15s ease, transform 0.1s ease;

  .envelope {
    height: 1.15em;
    width: auto;
    object-fit: contain;
  }

  ${(p) =>
    p.$variant === "buy" &&
    css`
      color: ${C.gold};
      &:hover:not(:disabled) {
        color: #ffe07a;
      }
    `}
  ${(p) =>
    p.$variant === "equip" &&
    css`
      color: #fff8ee;
      &:hover:not(:disabled) {
        color: #fff;
      }
    `}
  ${(p) =>
    p.$variant === "equipped" &&
    css`
      color: ${C.gold};
    `}

  &:active:not(:disabled) {
    transform: scale(0.96);
  }
  &:disabled {
    cursor: default;
    opacity: 0.35;
    color: ${C.creamMute};
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

const StartNote = styled.div`
  flex: 1;
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.52rem, 0.78cqw, 0.66rem);
  color: ${D.textMute};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  line-height: 1.35;
  text-shadow: ${TEXT_SHADOW_UI};

  em {
    font-style: normal;
    color: ${C.gold};
    font-weight: 700;
    text-shadow: ${TEXT_SHADOW_UI}, 0 0 8px rgba(232, 197, 71, 0.22);
  }
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

/** Crisp inline padlock — replaces the emoji lock so the locked badge
 *  renders identically on every platform and matches the UI's line weight. */
function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="10"
        rx="2"
        fill="currentColor"
      />
      <path
        d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** First real option so the detail strip always has something to show. */
function firstFocus() {
  for (const cat of LOADOUT_CATEGORIES) {
    const opts = LOADOUT_OPTIONS[cat.key] || [];
    if (opts.length) return { catKey: cat.key, optId: opts[0].id };
  }
  return null;
}

function BashoHub({ onBack, onStartRun }) {
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
  const focusedCost = focusedOpt?.cost || 0;
  const focusedPointAffordable =
    !!focusedSelected || focusedCost <= loadoutRemaining;
  const focusedEnvAffordable = focusedUnlock
    ? (career.envelopes || 0) >= focusedUnlock.cost
    : true;

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
      <GrainOverlay />
      <Vignette />

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
                  title="View the banzuke ladder"
                >
                  {rankLabel}
                  <span className="ladder" aria-hidden>
                    ☰
                  </span>
                </TitleRank>
                <IdentityRecord>
                  <NameplateLabel>Lifetime</NameplateLabel>
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
                  title="Outfit"
                >
                  <PaletteIcon />
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
                <BlockLabel>Attributes</BlockLabel>
                <BlockMeta $accent={!runLocked && career.statPoints.available > 0}>
                  {runLocked
                    ? "Locked"
                    : `${career.statPoints.available} pts`}
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
            <BoardTitle>Techniques</BoardTitle>
            <BoardMeta $accent={!runLocked && loadoutRemaining > 0}>
              {runLocked
                ? "Locked during basho"
                : `${loadoutUsed} / ${LOADOUT_BUDGET} pts spent`}
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
                    <CategoryIdentity>
                      <CategoryNameRow>
                        <CategoryName>{cat.label}</CategoryName>
                        <CategoryKanji aria-hidden>{cat.kanji}</CategoryKanji>
                      </CategoryNameRow>
                      <CategorySub>{cat.sub}</CategorySub>
                    </CategoryIdentity>

                    <SlotStrip>
                      {options.map((opt) => {
                        const locked = optionLocked(opt);
                        const isOn = !locked && selected.includes(opt.id);
                        const isFocused =
                          focused?.catKey === cat.key &&
                          focused?.optId === opt.id;
                        const visual = getLoadoutOptionIcon(opt.id);
                        const SlotEl = locked ? LockedSlot : Slot;
                        return (
                          <SlotEl
                            key={opt.id}
                            type="button"
                            $interactive={!runLocked}
                            $selected={isOn}
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
                              <SlotKanji aria-hidden>{opt.kanji}</SlotKanji>
                            )}
                            {isOn && <SlotCheck aria-hidden>✓</SlotCheck>}
                            {locked && (
                              <SlotLock aria-hidden>
                                <LockGlyph />
                              </SlotLock>
                            )}
                          </SlotEl>
                        );
                      })}
                      {Array.from({ length: placeholders }).map((_, i) => (
                        <PlaceholderSlot
                          key={`ph-${i}`}
                          title="Technique sealed — coming later"
                          aria-label="Technique sealed — coming later"
                        >
                          <PlaceholderGlyph aria-hidden>未</PlaceholderGlyph>
                        </PlaceholderSlot>
                      ))}
                    </SlotStrip>
                  </CategoryRow>
                );
              })}
            </LoadoutBoard>

            {/* DETAIL — hover to preview, click/CTA to equip or buy */}
            <DetailStrip>
              {focusedOpt ? (
                <>
                  {focusedVisual ? (
                    <DetailIcon
                      $main={focusedVisual.main}
                      $deep={focusedVisual.deep}
                      $gradient={focusedVisual.gradient}
                      $imgSize={focusedVisual.imgSize}
                      $locked={focusedLocked}
                      aria-hidden
                    >
                      <img src={focusedVisual.icon} alt="" />
                      {focusedLocked && (
                        <span className="lock">
                          <LockGlyph />
                        </span>
                      )}
                    </DetailIcon>
                  ) : (
                    <DetailIcon $locked={focusedLocked} aria-hidden>
                      <DetailIconKanji>{focusedOpt.kanji}</DetailIconKanji>
                      {focusedLocked && (
                        <span className="lock">
                          <LockGlyph />
                        </span>
                      )}
                    </DetailIcon>
                  )}

                  <DetailBody key={focusedOpt.id}>
                    <DetailTopRow>
                      <DetailName>{focusedOpt.label}</DetailName>
                      {focusedOpt.replaces && (
                        <DetailTag>Replaces {focusedOpt.replaces}</DetailTag>
                      )}
                      {!focusedLocked && (
                        <DetailTag>
                          {focusedCost} pt{focusedCost === 1 ? "" : "s"}
                        </DetailTag>
                      )}
                    </DetailTopRow>
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
                            Unlock · {focusedUnlock.cost}
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
                        {focusedSelected ? "Equipped ✓" : "Equip"}
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
        <StartNote>
          {bouts} bouts &middot;{" "}
          {division.kk ? (
            <>
              {division.kk} wins = <em>kachi-koshi</em>
            </>
          ) : (
            <em>title defense</em>
          )}
        </StartNote>
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
