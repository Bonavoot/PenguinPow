/**
 * BashoHub — Single-player BASHO career/roguelite hub.
 *
 * One-screen, no-scroll fighter dossier laid out as two columns:
 *   LEFT  — the rikishi: large portrait, persistent ATTRIBUTES, and
 *           outfit slots (same customization as Lobby / Customize).
 *   RIGHT — the LOADOUT board: one row per discipline, five slots each
 *           (real sidegrades + greyed "coming soon" placeholders), with an
 *           integrated detail strip that previews on hover and equips/buys on
 *           click. Locked sidegrades are bought inline with Kenshō — the shop
 *           is folded into the icons, no separate section.
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
import Snowfall from "./Snowfall";
import pumo from "../assets/pumo-idle.png";
import envelopeImg from "../assets/envelope.png";
import flapIcon from "../assets/flap-icon.png";
import shatterPalmIcon from "../assets/shatter-palm-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import lobbyBackground from "../assets/lockerroom.webp";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  fadeIn,
  fadeUp,
  clipRevealLeft,
  clipRevealRight,
  clipRevealUp,
  TEXT_SHADOW_DISPLAY,
  TEXT_SHADOW_DISPLAY_SOFT,
} from "./menuTheme";
import {
  ATTRIBUTES,
  STAT_BASE,
  STAT_MAX,
  LOADOUT_CATEGORIES,
  LOADOUT_OPTIONS,
  LOADOUT_BUDGET,
  loadoutSpent,
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
  writeSave,
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

/** Every discipline shows this many slots; short catalogs pad with "?". */
const SLOTS_PER_CATEGORY = 5;

/**
 * D — hub surface palette tuned to the PreMatch "printed banzuke" language.
 * Cream type on sumi ink, vermillion rules, gold ranks — not cool SaaS grey
 * glass. Panels are lacquer plaques (no blur, no ice bloom). Accents from C.
 * Contrast tuned for Steam-distance readability on the locker-room photo.
 */
const D = {
  page: "#06080c",
  panel: "rgba(12, 14, 20, 0.94)",
  panelSolid: "#141820",
  head: "#1a1f28",
  chrome: "#161a22",
  soft: "#252a34",
  softHover: "#303642",
  deep: "#0a0c12",
  border: "rgba(245, 236, 217, 0.28)",
  borderSoft: "rgba(245, 236, 217, 0.14)",
  shadow: "rgba(0, 0, 0, 0.5)",
  shadowStrong: "rgba(0, 0, 0, 0.72)",
  textHi: C.cream,
  text: C.creamWarm,
  textMute: "rgba(245, 236, 217, 0.78)",
  textFaint: "rgba(245, 236, 217, 0.4)",
  // Warm washi lightbox for the fighter — same paper stock as rank plaques.
  stageTop: "#faf4e8",
  stageMid: "#efe4cc",
  stageBottom: "#d4c09a",
};

/* Soft paper grain — kept VERY faint and only on a few surfaces (portrait
   stage, panel headers). Full-panel washi read as a busy grid. */
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
const WASHI_LIGHT_ON_DARK = `
  repeating-linear-gradient(
    90deg,
    transparent 0, transparent 4px,
    rgba(232, 210, 170, 0.025) 4px, rgba(232, 210, 170, 0.025) 5px
  ),
  repeating-linear-gradient(
    0deg,
    transparent 0, transparent 6px,
    rgba(232, 210, 170, 0.02) 6px, rgba(232, 210, 170, 0.02) 7px
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

const brushDraw = keyframes`
  from { opacity: 0; transform: scaleX(0.12); }
  to   { opacity: 1; transform: scaleX(1); }
`;

const slotGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 2px rgba(232, 197, 71, 0.4), 0 4px 14px rgba(232, 197, 71, 0.22); }
  50% { box-shadow: 0 0 0 2px rgba(232, 197, 71, 0.55), 0 6px 18px rgba(232, 197, 71, 0.34); }
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
  background: ${D.page};
  overflow: hidden;
  container-type: size;
  font-family: ${FONT_BODY};
`;

/* Locker-room art kept sharper — PreMatch wins because the place feels real.
   Light desat + vignette do the mood; heavy blur/sepia made it muddy. */
const BackgroundImage = styled.div`
  position: absolute;
  inset: 0;
  background: url(${lobbyBackground}) center bottom / cover;
  transform: scale(1.06) translateX(0.8%);
  transform-origin: 50% 100%;
  opacity: 1;
  filter: saturate(0.85) brightness(0.68) contrast(1.14);
  z-index: 0;
  pointer-events: none;
`;

/* Prematch-style stage dim — letterbox + radial pool, center clearer. */
const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 52% 58% at 50% 40%,
      transparent 0%,
      rgba(4, 6, 10, 0.18) 46%,
      rgba(4, 6, 10, 0.82) 100%
    ),
    linear-gradient(
      180deg,
      rgba(4, 6, 10, 0.78) 0%,
      rgba(4, 6, 10, 0.2) 20%,
      rgba(4, 6, 10, 0.06) 46%,
      rgba(4, 6, 10, 0.48) 74%,
      rgba(4, 6, 10, 0.92) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
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

/* Giant atmospheric kanji — flat ink watermark, PreMatch GiantKanji recipe. */
const AtmosphereKanji = styled.div`
  position: absolute;
  top: 14%;
  right: 2%;
  z-index: 1;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(180px, 30cqw, 380px);
  line-height: 0.72;
  color: rgba(245, 236, 217, 0.055);
  pointer-events: none;
  user-select: none;
  letter-spacing: -0.04em;
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
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.56rem, 0.84cqw, 0.68rem);
  text-transform: uppercase;
  letter-spacing: 0.26em;
  color: ${D.textMute};
  background: linear-gradient(180deg, #1c212a 0%, ${C.sumi} 100%);
  border: 1px solid rgba(245, 236, 217, 0.28);
  border-radius: 0;
  cursor: pointer;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease,
    transform 0.18s ease;

  .arrow {
    font-weight: 700;
    transition: transform 0.2s ease;
  }
  &:hover {
    color: ${C.cream};
    border-color: rgba(245, 236, 217, 0.5);
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
  gap: 6px;
  will-change: transform, opacity;
  animation: ${fadeUp} 0.42s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s both;

  &::after {
    content: "";
    width: clamp(56px, 8cqw, 88px);
    height: 3px;
    margin-top: 2px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      ${C.vermillion} 18%,
      ${C.vermillionBright} 50%,
      ${C.vermillion} 82%,
      transparent 100%
    );
    transform-origin: center;
    animation: ${brushDraw} 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s both;
  }
`;

const PageTitle = styled.h1`
  margin: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.35rem, 2.5cqw, 2rem);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  line-height: 1;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
`;

const PageSubtitle = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.74cqw, 0.58rem);
  color: ${C.iceBright};
  text-transform: uppercase;
  letter-spacing: 0.32em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.75);
`;

// Currency readout — lacquer wallet plate with gold weight.
const Currency = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  min-height: 40px;
  padding: 0 clamp(12px, 1.4cqw, 16px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.68rem, 1.02cqw, 0.86rem);
  color: ${C.gold};
  letter-spacing: 0.06em;
  background: linear-gradient(180deg, #222836 0%, ${C.sumi} 100%);
  border: 1px solid rgba(232, 197, 71, 0.45);
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 244, 0.08),
    0 4px 14px rgba(0, 0, 0, 0.4);
  text-shadow: 0 0 12px rgba(232, 197, 71, 0.4);

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
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.68cqw, 0.52rem);
  letter-spacing: 0.2em;
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
// STAGE
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.14fr);
  align-items: stretch;
  gap: clamp(20px, 2.8cqw, 40px);
  padding: clamp(6px, 1.2cqh, 14px) clamp(22px, 3.6cqw, 54px)
    clamp(16px, 2.2cqh, 28px);
`;

/* Lacquer plaque — solid ink fill, cream rim, vermillion crown.
   No full-panel washi (that read as a busy grid). */
const Panel = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: linear-gradient(180deg, #1a1f28 0%, #12151c 55%, #0e1118 100%);
  border: 1px solid ${D.border};
  border-radius: 0;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.55),
    0 18px 42px ${D.shadowStrong},
    inset 0 1px 0 rgba(255, 252, 244, 0.06);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      ${C.vermillionDeep} 0%,
      ${C.vermillionBright} 35%,
      ${C.vermillion} 70%,
      ${C.vermillionDeep} 100%
    );
    z-index: 2;
  }
`;

const LeftPanel = styled(Panel)`
  will-change: transform, opacity;
  animation: ${clipRevealLeft} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.1s both;
`;

const RightPanel = styled(Panel)`
  background: linear-gradient(180deg, #1c222c 0%, #141820 50%, #0f131a 100%);
  will-change: transform, opacity;
  animation: ${clipRevealRight} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.16s both;
`;

const PanelHead = styled.header`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: clamp(8px, 1cqh, 11px) clamp(12px, 1.5cqw, 18px);
  background: linear-gradient(180deg, #222836 0%, ${D.head} 100%);
  border-bottom: 1px solid ${D.borderSoft};

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: ${WASHI_LIGHT_ON_DARK};
    opacity: 0.35;
    pointer-events: none;
  }

  /* Ice sash — secondary accent under the vermillion crown. */
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(126, 203, 240, 0.35) 30%,
      rgba(126, 203, 240, 0.55) 50%,
      rgba(126, 203, 240, 0.35) 70%,
      transparent 100%
    );
    z-index: 1;
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
  font-size: clamp(0.78rem, 1.15cqw, 0.98rem);
  color: #fff8ee;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  text-shadow: ${TEXT_SHADOW_DISPLAY};

  &::before {
    content: "";
    width: clamp(16px, 2cqw, 24px);
    height: 3px;
    background: ${C.vermillion};
    box-shadow: 0 0 8px rgba(216, 59, 39, 0.45);
  }
`;

const HeadMeta = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.72cqw, 0.58rem);
  color: ${(p) => (p.$accent ? C.iceBright : D.textMute)};
  text-transform: uppercase;
  letter-spacing: 0.2em;
  text-shadow: ${TEXT_SHADOW_DISPLAY_SOFT};
`;

/* Lacquer rank plaque — matches PreMatch / HUD, not a pill chip. */
const RankChip = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 0.8cqw, 9px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.52rem, 0.8cqw, 0.66rem);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: linear-gradient(
    180deg,
    rgba(28, 34, 56, 0.98) 0%,
    rgba(14, 18, 36, 0.99) 100%
  );
  border: 1px solid rgba(232, 197, 71, 0.4);
  border-radius: 2px;
  padding: clamp(5px, 0.65cqh, 7px) clamp(11px, 1.4cqw, 15px);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 244, 0.1),
    0 3px 10px rgba(0, 0, 0, 0.4);
  text-shadow: 0 0 12px rgba(232, 197, 71, 0.4);
  transition: border-color 0.15s ease, color 0.15s ease, transform 0.12s ease,
    box-shadow 0.15s ease;

  .ladder {
    font-family: ${FONT_BODY};
    font-size: 0.95em;
    line-height: 1;
    opacity: 0.7;
  }
  &:hover {
    border-color: ${C.gold};
    color: #ffe07a;
    transform: translateY(-1px);
    box-shadow:
      inset 0 1px 0 rgba(255, 252, 244, 0.12),
      0 4px 14px rgba(232, 197, 71, 0.2);
  }
`;

// ============================================
// LEFT — PORTRAIT + ATTRIBUTES + APPEARANCE
// ============================================

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
  height: 96%;
  max-height: 100%;
  width: fit-content;
  max-width: 96%;
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
`;

const Block = styled.div`
  flex-shrink: 0;
  padding: clamp(5px, 0.7cqh, 8px) clamp(12px, 1.5cqw, 16px);
  border-top: 1px solid ${D.borderSoft};
  background: linear-gradient(180deg, #1a1f28 0%, ${D.chrome} 100%);
`;

const BlockHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: clamp(3px, 0.5cqh, 6px);
`;

const BlockLabel = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 0.8cqw, 9px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.46rem, 0.7cqw, 0.56rem);
  color: #fff8ee;
  text-transform: uppercase;
  letter-spacing: 0.22em;

  &::before {
    content: "";
    width: clamp(10px, 1.2cqw, 14px);
    height: 2px;
    background: ${C.vermillion};
  }
`;

const BlockMeta = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${(p) => (p.$accent ? C.iceBright : D.textMute)};
  text-transform: uppercase;
  letter-spacing: 0.16em;
`;

// --- Attribute rows (compact — keep portrait dominant) ---

const StatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: clamp(20px, 2.2cqw, 24px) minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(5px, 0.7cqw, 8px);
  padding: clamp(2px, 0.3cqh, 3px) clamp(3px, 0.45cqw, 5px);
  border-radius: 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid ${D.borderSoft};

  &:last-child {
    border-bottom: none;
  }
`;

const StatKanji = styled.div`
  width: clamp(20px, 2.2cqw, 24px);
  height: clamp(20px, 2.2cqw, 24px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_KANJI};
  font-size: clamp(0.68rem, 0.95cqw, 0.82rem);
  color: #fff8ee;
  line-height: 1;
  border-radius: 0;
  background: linear-gradient(180deg, #1e2430 0%, ${D.deep} 100%);
  border: 1px solid rgba(245, 236, 217, 0.2);
`;

const StatBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
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
  font-weight: 700;
  font-size: clamp(0.42rem, 0.64cqw, 0.52rem);
  color: ${D.textMute};
  letter-spacing: 0.1em;
  text-transform: uppercase;
`;

const PipTrack = styled.div`
  display: flex;
  gap: 2px;
  padding: 1px;
  border-radius: 0;
  background: ${D.deep};
  border: 1px solid rgba(245, 236, 217, 0.1);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45);
`;

const Pip = styled.div`
  flex: 1;
  height: clamp(3px, 0.5cqh, 5px);
  border-radius: 0;
  background: ${(p) =>
    p.$filled
      ? `linear-gradient(180deg, ${C.iceBright} 0%, ${C.ice} 45%, ${C.iceMid} 100%)`
      : "rgba(245, 236, 217, 0.07)"};
  border: 1px solid ${(p) => (p.$filled ? "rgba(168, 224, 255, 0.55)" : "transparent")};
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
  gap: 2px;
`;

const StepButton = styled.button`
  width: clamp(14px, 1.7cqw, 18px);
  height: clamp(14px, 1.7cqw, 18px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.6rem, 0.9cqw, 0.74rem);
  line-height: 1;
  color: ${C.cream};
  background: ${D.soft};
  border: 1px solid ${D.border};
  border-radius: 0;
  cursor: pointer;
  transition: color 0.12s ease, border-color 0.12s ease, transform 0.1s ease,
    background 0.12s ease;

  &:hover:not(:disabled) {
    color: #fff;
    border-color: ${C.cream};
    background: ${D.softHover};
  }
  &:active:not(:disabled) {
    transform: scale(0.9);
  }
  &:disabled {
    opacity: 0.28;
    cursor: default;
  }
`;

const StatValue = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.48rem, 0.72cqw, 0.6rem);
  color: #ffffff;
  letter-spacing: 0.02em;
  min-width: clamp(20px, 2.2cqw, 26px);
  text-align: center;
  text-shadow: ${TEXT_SHADOW_DISPLAY};

  .max {
    color: ${D.textFaint};
    font-size: 0.68em;
    text-shadow: none;
  }
`;

// --- Appearance (outfit slots — same system as Lobby / Customize) ---

const OutfitSlotBar = styled.div`
  display: flex;
  gap: clamp(4px, 0.6cqw, 6px);
`;

const OutfitSlot = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  min-width: 0;
  padding: clamp(4px, 0.55cqh, 6px);
  background: ${(p) => (p.$active ? D.softHover : D.soft)};
  border: 1px solid ${(p) => (p.$active ? C.gold : D.borderSoft)};
  border-radius: 0;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.12s ease;

  &:hover:not(:disabled) {
    border-color: ${(p) => (p.$active ? C.gold : "rgba(245, 236, 217, 0.4)")};
    background: ${D.softHover};
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const OutfitSlotSwatches = styled.span`
  display: flex;
  height: clamp(8px, 1cqh, 11px);
  border: 1px solid rgba(245, 236, 217, 0.2);
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
  font-size: clamp(0.36rem, 0.54cqw, 0.44rem);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${(p) => (p.$active ? C.cream : D.textMute)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
`;

const IdentityFooter = styled.footer`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: clamp(6px, 0.85cqh, 10px) clamp(12px, 1.5cqw, 16px);
  border-top: 1px solid ${D.borderSoft};
  background: linear-gradient(180deg, #1c212a 0%, ${C.sumi} 100%);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 12%;
    right: 12%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(232, 197, 71, 0.45),
      transparent
    );
  }
`;

const IdentityStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: ${(p) => (p.$right ? "flex-end" : "flex-start")};
`;

const IdentityLabel = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.36rem, 0.54cqw, 0.44rem);
  color: ${D.textMute};
  text-transform: uppercase;
  letter-spacing: 0.24em;
`;

const IdentityRank = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.72rem, 1.05cqw, 0.92rem);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: 0 0 14px rgba(232, 197, 71, 0.42);
`;

const IdentityRecord = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.72rem, 1.05cqw, 0.92rem);
  letter-spacing: 0.04em;
  display: inline-flex;
  align-items: baseline;
  gap: 0.14em;
  text-shadow: ${TEXT_SHADOW_DISPLAY};

  .w {
    color: ${C.successBright};
  }
  .l {
    color: ${C.vermillionBright};
  }
  .sep {
    color: ${D.textFaint};
    text-shadow: none;
  }
`;

// ============================================
// RIGHT — LOADOUT BOARD + DETAIL + START
// ============================================

const LoadoutBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: clamp(8px, 1.1cqh, 12px) clamp(12px, 1.5cqw, 18px);
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
  padding: clamp(8px, 1cqh, 12px) clamp(8px, 1cqw, 12px);
  background: linear-gradient(180deg, #0e1118 0%, #080a0f 100%);
  border: 1px solid rgba(245, 236, 217, 0.2);
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 244, 0.05),
    inset 0 0 20px rgba(0, 0, 0, 0.3);
  /* Room for corner check badges that poke outside slots. */
  overflow: visible;
`;

const CategoryRow = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: clamp(72px, 9.5cqw, 108px) minmax(0, 1fr);
  align-items: center;
  gap: clamp(6px, 0.9cqw, 12px);
  padding: 0;
  background: transparent;
  overflow: visible;
`;

const CategoryLabel = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(5px, 0.7cqw, 8px);
  min-width: 0;
  padding-left: clamp(8px, 1cqw, 12px);

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 18%;
    bottom: 18%;
    width: 2px;
    background: linear-gradient(
      180deg,
      ${C.vermillionBright} 0%,
      ${C.vermillion} 100%
    );
  }
`;

const CategoryKanji = styled.div`
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(0.95rem, 1.45cqw, 1.25rem);
  color: #fff8ee;
  line-height: 1;
  flex-shrink: 0;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
`;

const CategoryNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
`;

const CategoryName = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.72cqw, 0.58rem);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
`;

const CategorySub = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.34rem, 0.5cqw, 0.42rem);
  color: ${D.textMute};
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

/* Slots fill their strip cells; max size grows with board height.
   Overflow visible so corner checkmarks can sit outside. */
const SlotStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: center;
  justify-items: center;
  width: 100%;
  min-width: 0;
  gap: clamp(5px, 0.75cqw, 9px);
  padding: clamp(5px, 0.7cqh, 8px) clamp(6px, 0.85cqw, 10px);
  background: #050608;
  border: 1px solid rgba(245, 236, 217, 0.12);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.55);
  box-sizing: border-box;
  overflow: visible;
`;

const Slot = styled.button`
  position: relative;
  width: min(100%, clamp(44px, 7.8cqh, 68px));
  aspect-ratio: 1;
  height: auto;
  max-height: min(100%, clamp(44px, 7.8cqh, 68px));
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  padding: 0;
  box-sizing: border-box;
  background: ${(p) => p.$gradient || p.$main || D.deep};
  border: 2px solid
    ${(p) =>
      p.$selected
        ? C.gold
        : p.$focused
          ? C.cream
          : p.$deep || "rgba(245, 236, 217, 0.18)"};
  border-radius: 2px;
  cursor: ${(p) => (p.$interactive ? "pointer" : "default")};
  box-shadow: ${(p) =>
    p.$selected
      ? `0 0 0 1px rgba(232, 197, 71, 0.45), 0 2px 8px rgba(0, 0, 0, 0.4)`
      : `inset 0 -1px 0 rgba(0,0,0,0.2), 0 1px 3px ${D.shadow}`};
  transition: transform 0.12s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  ${(p) =>
    p.$selected &&
    css`
      animation: ${slotGlow} 2.2s ease-in-out infinite;
    `}

  img {
    width: ${(p) => p.$imgSize || "82%"};
    height: ${(p) => p.$imgSize || "82%"};
    object-fit: contain;
    transform: scale(${(p) => p.$imgScale ?? 1});
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
    pointer-events: none;
  }

  &:hover {
    transform: ${(p) => (p.$interactive ? "translateY(-1px)" : "none")};
    border-color: ${(p) =>
      !p.$interactive
        ? p.$deep || D.border
        : p.$selected
          ? C.gold
          : C.cream};
    z-index: 3;
  }
  &:active {
    transform: ${(p) => (p.$interactive ? "scale(0.96)" : "none")};
  }
`;

const LockedSlot = styled(Slot)`
  background: ${(p) => p.$gradient || p.$main || D.deep};

  img {
    opacity: 0.82;
    filter: saturate(0.72) brightness(0.86)
      drop-shadow(0 1px 2px rgba(0, 0, 0, 0.34));
  }
`;

const PlaceholderSlot = styled(Slot)`
  overflow: hidden;
  background: #0c0e14;
  border-style: solid;
  border-color: rgba(245, 236, 217, 0.1);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
  color: ${D.textFaint};
  opacity: 0.75;
  cursor: default;
`;

const SlotKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-size: clamp(0.95rem, 1.35cqw, 1.2rem);
  color: ${C.cream};
  line-height: 1;
`;

const PlaceholderGlyph = styled.span`
  font-family: ${FONT_KANJI};
  font-weight: 700;
  font-size: clamp(0.7rem, 1cqw, 0.88rem);
  color: rgba(210, 220, 232, 0.28);
  line-height: 1;
  letter-spacing: 0;
`;

const SlotCheck = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  width: clamp(15px, 1.85cqw, 19px);
  height: clamp(15px, 1.85cqw, 19px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.52rem, 0.78cqw, 0.66rem);
  font-weight: 700;
  color: ${C.sumi};
  background: linear-gradient(180deg, #ffe07a 0%, ${C.gold} 100%);
  border: 1px solid ${C.goldDeep};
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  z-index: 2;
  pointer-events: none;
`;

const SlotLock = styled.span`
  position: absolute;
  bottom: -5px;
  right: -5px;
  width: clamp(14px, 1.7cqw, 18px);
  height: clamp(14px, 1.7cqw, 18px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: ${C.cream};
  background: ${C.sumi};
  border: 1px solid ${D.border};
  box-shadow: 0 1px 2px ${D.shadowStrong};
  pointer-events: none;
  z-index: 2;

  svg {
    width: 58%;
    height: 58%;
  }
`;

// --- Detail strip (compact — board/icons get the vertical room) ---

const DetailStrip = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.3cqw, 14px);
  min-height: clamp(58px, 8cqh, 74px);
  margin-top: clamp(8px, 1.1cqh, 12px);
  padding: clamp(8px, 1.1cqh, 11px) clamp(10px, 1.3cqw, 14px);
  border: 1px solid ${D.border};
  border-top: 3px solid ${C.vermillion};
  border-radius: 0;
  background: linear-gradient(180deg, #1e2430 0%, ${C.sumi} 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 244, 0.06),
    0 4px 12px rgba(0, 0, 0, 0.3);
`;

const DetailIcon = styled.div`
  position: relative;
  flex-shrink: 0;
  width: clamp(40px, 5cqw, 52px);
  height: clamp(40px, 5cqw, 52px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  background: ${(p) => p.$gradient || p.$main || D.deep};
  border: 2px solid ${(p) => p.$deep || D.border};
  border-radius: 2px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    0 2px 6px ${D.shadow};

  img {
    width: ${(p) => p.$imgSize || "80%"};
    height: ${(p) => p.$imgSize || "80%"};
    object-fit: contain;
    opacity: ${(p) => (p.$locked ? 0.82 : 1)};
    filter: ${(p) =>
      p.$locked
        ? "saturate(0.72) brightness(0.86) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.34))"
        : "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.34))"};
  }

  .lock {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: clamp(14px, 1.7cqw, 18px);
    height: clamp(14px, 1.7cqw, 18px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: ${C.cream};
    background: ${C.sumi};
    border: 1px solid ${D.border};
    box-shadow: 0 1px 2px ${D.shadowStrong};

    svg {
      width: 58%;
      height: 58%;
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
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.62rem, 0.95cqw, 0.8rem);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
`;

const DetailTag = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.38rem, 0.56cqw, 0.46rem);
  color: ${(p) => (p.$accent ? C.gold : D.textMute)};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 3px 8px;
  border-radius: 0;
  background: ${(p) =>
    p.$accent ? "rgba(232, 197, 71, 0.16)" : "rgba(245, 236, 217, 0.06)"};
  border: 1px solid
    ${(p) => (p.$accent ? "rgba(232, 197, 71, 0.5)" : D.borderSoft)};
`;

const DetailEmpty = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.3cqw, 14px);
  width: 100%;
  min-height: inherit;
`;

const DetailEmptySeal = styled.div`
  flex-shrink: 0;
  width: clamp(42px, 5.2cqw, 54px);
  height: clamp(42px, 5.2cqw, 54px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(1.05rem, 1.55cqw, 1.3rem);
  color: rgba(238, 81, 65, 0.65);
  background: rgba(138, 31, 18, 0.2);
  border: 2px solid rgba(216, 59, 39, 0.4);
  transform: rotate(-6deg);
`;

const DetailEmptyCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  .title {
    font-family: ${FONT_BODY};
    font-weight: 700;
    font-size: clamp(0.54rem, 0.8cqw, 0.64rem);
    color: #fff8ee;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }
  .hint {
    font-family: ${FONT_BODY};
    font-weight: 500;
    font-size: clamp(0.48rem, 0.7cqw, 0.56rem);
    color: ${D.textMute};
    letter-spacing: 0.03em;
    line-height: 1.4;
  }
`;

const DetailDesc = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.44rem, 0.64cqw, 0.52rem);
  color: rgba(245, 236, 217, 0.88);
  letter-spacing: 0.01em;
  line-height: 1.35;
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
  gap: 5px;
  min-height: clamp(30px, 3.6cqh, 38px);
  padding: clamp(6px, 0.85cqh, 9px) clamp(12px, 1.5cqw, 16px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.48rem, 0.7cqw, 0.58rem);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  border-radius: 0;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease,
    transform 0.1s ease, opacity 0.15s ease, box-shadow 0.15s ease;

  ${(p) =>
    p.$variant === "buy" &&
    css`
      color: ${C.sumi};
      background: linear-gradient(180deg, #ffe07a 0%, ${C.gold} 100%);
      border: 1px solid ${C.goldDeep};
      font-weight: 700;
      &:hover:not(:disabled) {
        background: linear-gradient(180deg, ${C.gold} 0%, ${C.goldDeep} 100%);
        box-shadow: 0 4px 14px rgba(232, 197, 71, 0.35);
      }
    `}
  ${(p) =>
    p.$variant === "equip" &&
    css`
      color: #fff8ee;
      background: linear-gradient(180deg, ${C.iceMid} 0%, ${C.iceDeep} 100%);
      border: 1px solid ${C.ice};
      &:hover:not(:disabled) {
        background: linear-gradient(180deg, ${C.ice} 0%, ${C.iceMid} 100%);
        box-shadow: 0 4px 14px rgba(126, 203, 240, 0.3);
      }
    `}
  ${(p) =>
    p.$variant === "equipped" &&
    css`
      color: ${C.sumi};
      background: linear-gradient(180deg, #e8f7ff 0%, ${C.iceBright} 100%);
      border: 1px solid ${C.ice};
      &:hover:not(:disabled) {
        background: #dff3ff;
      }
    `}

  &:active:not(:disabled) {
    transform: scale(0.96);
  }
  &:disabled {
    cursor: default;
    opacity: 0.45;
    background: ${D.deep};
    color: ${D.textMute};
    border-color: ${D.border};
    box-shadow: none;
  }
`;

const StartFooter = styled.footer`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 16px);
  flex-shrink: 0;
  padding: clamp(8px, 1.1cqh, 12px) clamp(12px, 1.5cqw, 18px);
  border-top: 1px solid ${D.borderSoft};
  background: linear-gradient(180deg, #1c212a 0%, ${C.sumi} 100%);
  animation: ${clipRevealUp} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.22s both;
`;

const StartNote = styled.div`
  flex: 1;
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.62cqw, 0.52rem);
  color: ${D.textMute};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  line-height: 1.35;

  em {
    font-style: normal;
    color: ${C.gold};
    font-weight: 700;
    text-shadow: 0 0 10px rgba(232, 197, 71, 0.3);
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
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.78rem, 1.1cqw, 0.95rem);
  text-transform: uppercase;
  letter-spacing: 0.2em;
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
  font-family: ${FONT_DISPLAY};
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
  min-height: 34px;
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
      if (loadedRef.current && saveDocRef.current) {
        writeSave({ ...saveDocRef.current, career: careerRef.current });
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSave().then((doc) => {
      if (cancelled) return;
      saveDocRef.current = doc;
      setCareer(doc.career);
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
          const updated = { ...doc, bashoRun: migrated };
          saveDocRef.current = updated;
          writeSave(updated);
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
    if (!loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const doc = { ...(saveDocRef.current || makeDefaultSave()), career };
      const written = await writeSave(doc);
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
    const disk = await loadSave();
    const baseSave = {
      ...disk,
      career,
      customization: disk.customization,
    };
    saveDocRef.current = baseSave;
    if (resumeRun) {
      await onStartRun({ run: resumeRun, save: baseSave });
      return;
    }
    const run = createRun(career);
    await onStartRun({ run, save: { ...baseSave, bashoRun: run } });
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
    const doc = {
      ...(saveDocRef.current || makeDefaultSave()),
      customization: next,
    };
    saveDocRef.current = doc;
    writeSave(doc);
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
      <BackgroundImage />
      <CinematicOverlay />
      <GrainOverlay />
      <AtmosphereKanji aria-hidden>場所</AtmosphereKanji>
      <Snowfall intensity={8} showFrost={false} zIndex={2} />

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
          <PageSubtitle>Career Ladder</PageSubtitle>
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
        {/* LEFT — portrait + attributes + appearance */}
        <LeftPanel>
          <PanelHead>
            <HeadTitle>Your Rikishi</HeadTitle>
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
          </PanelHead>

          <PortraitStage>
            <PortraitSpotlight />
            <FighterFigure>
              <PortraitRing aria-hidden />
              <PortraitFloor />
              <PortraitImage src={previewSrc} alt="Your wrestler" />
            </FighterFigure>
          </PortraitStage>

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
                    <StatKanji aria-hidden>{attr.kanji}</StatKanji>
                    <StatBody>
                      <StatLabelRow>
                        <StatLabel>{attr.label}</StatLabel>
                      </StatLabelRow>
                      <PipTrack>
                        {Array.from({ length: STAT_MAX }).map((_, i) => (
                          <Pip key={i} $filled={i < value} $index={i} />
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
          </Block>

          <Block>
            <BlockHead>
              <BlockLabel>Outfit</BlockLabel>
              <BlockMeta>From Customize</BlockMeta>
            </BlockHead>
            <OutfitSlotBar role="listbox" aria-label="Outfit presets">
              {customization.outfits.map((outfit) => {
                const belt = BELT_ALL.find((c) => c.hex === outfit.mawashiColor);
                const body = BODY_COLORS.find((c) => c.hex === outfit.bodyColor);
                const active = outfit.id === activeOutfitId;
                return (
                  <OutfitSlot
                    key={outfit.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    $active={active}
                    disabled={!saveReady}
                    onClick={() => handleOutfitSelect(outfit.id)}
                    onMouseEnter={saveReady ? playButtonHoverSound : undefined}
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
          </Block>

          <IdentityFooter>
            <IdentityStack>
              <IdentityLabel>Rank</IdentityLabel>
              <IdentityRank>{division.label}</IdentityRank>
            </IdentityStack>
            <IdentityStack $right>
              <IdentityLabel>Lifetime</IdentityLabel>
              <IdentityRecord>
                <span className="w">{career.lifetime.boutsWon}</span>
                <span className="sep">–</span>
                <span className="l">{career.lifetime.boutsLost}</span>
              </IdentityRecord>
            </IdentityStack>
          </IdentityFooter>
        </LeftPanel>

        {/* RIGHT — loadout board + detail + start */}
        <RightPanel>
          <PanelHead>
            <HeadTitle>Loadout</HeadTitle>
            <HeadMeta $accent={!runLocked && loadoutRemaining > 0}>
              {runLocked
                ? "Locked during basho"
                : `${loadoutUsed} / ${LOADOUT_BUDGET} pts spent`}
            </HeadMeta>
          </PanelHead>

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
                    <CategoryLabel>
                      <CategoryKanji aria-hidden>{cat.kanji}</CategoryKanji>
                      <CategoryNameStack>
                        <CategoryName>{cat.label}</CategoryName>
                        <CategorySub>{cat.sub}</CategorySub>
                      </CategoryNameStack>
                    </CategoryLabel>

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
                          as="div"
                          $interactive={false}
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
                        <DetailTag $accent={focusedSelected}>
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
                        {focusedUnlock
                          ? `Unlock · ${focusedUnlock.cost} ◆`
                          : "Locked"}
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
                <DetailEmpty>
                  <DetailEmptySeal aria-hidden>技</DetailEmptySeal>
                  <DetailEmptyCopy>
                    <span className="title">Select a technique</span>
                    <span className="hint">
                      Hover a discipline slot to preview its sidegrade.
                    </span>
                  </DetailEmptyCopy>
                </DetailEmpty>
              )}
            </DetailStrip>
          </LoadoutBody>

          <StartFooter>
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
          </StartFooter>
        </RightPanel>
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
