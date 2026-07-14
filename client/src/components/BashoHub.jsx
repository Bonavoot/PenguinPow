/**
 * BashoHub — Single-player BASHO career/roguelite hub.
 *
 * One-screen, no-scroll fighter dossier laid out as two columns:
 *   LEFT  — the rikishi: large portrait, persistent ATTRIBUTES, and
 *           belt/body appearance controls (popovers).
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
  slideInLeft,
  slideInRight,
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
import {
  BELT_SOLIDS,
  BELT_PATTERNS,
  BODY_COLORS,
  BELT_ALL,
} from "../config/customizeColors";
import {
  loadSave,
  writeSave,
  resetSave,
  makeDefaultSave,
} from "../lib/saveStore";
import { createRun, ensureOpponentRanks } from "../lib/bashoRun";
import BanzukeBoard from "./BanzukeBoard";
import { SHADOW_GRADIENT } from "./PlayerShadow";

const DEBUG_FLAG_KEY = "bashoDebug";

/** Every discipline shows this many slots; short catalogs pad with "?". */
const SLOTS_PER_CATEGORY = 5;

/**
 * D — the hub's dusk surface palette. Same cool sumi / ice / vermillion /
 * gold world as the in-game HUD (menuTheme C), but tuned as layered charcoal
 * with room for frost and the locker-room art to breathe. Dark chrome still
 * anchors headers and footers; mid surfaces sit a step lighter and cooler so
 * the dossier doesn't read as "dark mode on dark." Accents still come from C.
 *
 * Surfaces climb in three steps — deep (inset) < panel (base) < soft (raised)
 * — which is what gives the UI depth: recessed tracks, floating cards, and
 * chrome bands all read as distinct planes under one cool light.
 */
const D = {
  page: "#12161c", // page fallthrough — cool slate, not pure black
  panelTop: "#2a323c", // panel gradient — lit cool charcoal
  panelBottom: "#1a2028", // panel gradient — sinks cooler at the base
  panel: "#222933", // panel solid fallback
  headTop: "#343c48", // header nameplate band (elevated, still dark)
  headBottom: "#242b34",
  chromeTop: "#1e2530", // footer chrome band
  chromeBottom: "#141920",
  soft: "#323a46", // raised surface — rows, slots, buttons
  softHover: "#3e4755",
  deep: "#12171e", // recessed inset — empty pips, placeholders
  frost: "rgba(203, 219, 231, 0.10)", // icy wash over dark content bands
  frostStrong: "rgba(234, 241, 247, 0.14)",
  border: "rgba(234, 241, 247, 0.18)", // cleaner cool-white hairline
  borderSoft: "rgba(234, 241, 247, 0.10)",
  shadow: "rgba(12, 18, 28, 0.38)",
  shadowStrong: "rgba(8, 12, 20, 0.52)",
  textHi: "#f5f8fb", // headings — near-white
  text: "#dce4ed", // body — cool light gray
  textMute: "#9aa6b4", // meta / captions — muted gray
  textFaint: "rgba(210, 220, 232, 0.32)", // disabled / hints
  // Single accent glow — the character's mawashi ice-blue.
  accentGlow: C.iceGlow,
  // Bright washi stage the fighter stands on (high-contrast "lightbox").
  stageTop: "#fdfaf2",
  stageMid: "#efe6d3",
  stageBottom: "#e2d3b6",
};

/* Washi paper weave — same crosshatch recipe as the PowerUpSelection
   cards and the in-game RankPlaque, so every printed surface reads as
   the same paper stock. Two variants: dark ink fibers for light
   surfaces (the portrait stage), faint cream fibers for dark chrome
   (panel headers). Used sparingly, only for tactile depth. */
const WASHI_DARK_ON_LIGHT = `
  repeating-linear-gradient(
    90deg,
    transparent 0, transparent 2px,
    rgba(60, 40, 20, 0.05) 2px, rgba(60, 40, 20, 0.05) 3px
  ),
  repeating-linear-gradient(
    0deg,
    transparent 0, transparent 4px,
    rgba(60, 40, 20, 0.04) 4px, rgba(60, 40, 20, 0.04) 5px
  )
`;
const WASHI_LIGHT_ON_DARK = `
  repeating-linear-gradient(
    90deg,
    transparent 0, transparent 3px,
    rgba(232, 210, 170, 0.045) 3px, rgba(232, 210, 170, 0.045) 4px
  ),
  repeating-linear-gradient(
    0deg,
    transparent 0, transparent 5px,
    rgba(232, 210, 170, 0.035) 5px, rgba(232, 210, 170, 0.035) 6px
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
    imgSize: "86%",
    imgScale: 1.08,
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
  0%, 100% { transform: scaleY(1);     }
  50%      { transform: scaleY(1.018); }
`;

const pipFill = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;

const popIn = keyframes`
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
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
  background: ${D.page};
  overflow: hidden;
  container-type: size;
  font-family: "Space Grotesk", sans-serif;
`;

// Backdrop mirrors the VS CPU lobby: locker-room art on center-bottom cover,
// nudged/zoomed, dimmed and blurred for shallow DoF.
const BackgroundImage = styled.div`
  position: absolute;
  inset: 0;
  background: url(${lobbyBackground}) center bottom / cover;
  transform: scale(1.04) translateX(1.1%);
  transform-origin: 50% 100%;
  opacity: 0.9;
  filter: saturate(0.62) brightness(0.86) contrast(1.07) sepia(0.08)
    blur(2.4px);
  z-index: 0;
  pointer-events: none;
`;

// Cinematic darkener — same stage-light pool + top/bottom atmospheric dim
// used on the VS CPU lobby.
const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 70% 42% at 50% 70%,
      transparent 0%,
      rgba(20, 14, 8, 0.22) 55%,
      rgba(10, 8, 4, 0.62) 100%
    ),
    linear-gradient(
      180deg,
      rgba(12, 10, 6, 0.42) 0%,
      rgba(12, 10, 6, 0.18) 22%,
      rgba(12, 10, 6, 0) 44%,
      rgba(12, 10, 6, 0) 78%,
      rgba(8, 12, 20, 0.34) 100%
    );
`;

// Paper-grain pass — same recipe/strength as the VS CPU lobby.
const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.34;
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
  padding: clamp(8px, 1.3cqh, 13px) clamp(16px, 2.4cqw, 30px);
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
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

const GhostButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  min-height: 38px;
  padding: clamp(7px, 1cqh, 10px) clamp(13px, 1.8cqw, 20px);
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.58rem, 0.88cqw, 0.72rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: ${C.creamMute};
  background: transparent;
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease,
    transform 0.18s ease;

  .arrow {
    font-weight: 700;
    transition: transform 0.2s ease;
  }
  &:hover {
    color: ${D.textHi};
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
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.92rem, 1.6cqw, 1.28rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.2em;
  line-height: 1;
`;

const PageSubtitle = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.42rem, 0.66cqw, 0.52rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.34em;
`;

// Currency readout — the Kenshō balance sits directly in the top bar as
// free-standing chrome (envelope glyph + gold figure), NOT boxed in its own
// plate. A container here just added a competing rectangle next to the
// title; the icon + gold weight are enough to read it as the wallet.
const Currency = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(6px, 0.9cqw, 10px);
  min-height: 38px;
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.6rem, 0.94cqw, 0.78rem);
  color: ${C.gold};
  letter-spacing: 0.1em;

  .envelope {
    height: 2.7em;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
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
// STAGE
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.18fr);
  align-items: stretch;
  gap: clamp(16px, 2.4cqw, 34px);
  padding: clamp(10px, 1.8cqh, 22px) clamp(22px, 3.6cqw, 54px);
`;

// Shared panel shell — dusk-charcoal plaque with a cool frost sheen so the
// locker-room art can tint through. Top→bottom light falloff, cool hairline,
// soft top inner-glow, and a glowing accent bar across the crown.
const Panel = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: linear-gradient(
    180deg,
    rgba(42, 50, 60, 0.90) 0%,
    rgba(26, 32, 40, 0.93) 100%
  );
  border: 1px solid ${D.border};
  border-radius: 4px;
  overflow: hidden;
  box-shadow:
    0 18px 40px ${D.shadowStrong},
    0 0 0 1px rgba(126, 203, 240, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${(p) => p.$accent || C.ice};
    box-shadow: 0 0 14px ${(p) => p.$glow || C.iceGlow};
    z-index: 2;
  }
`;

const LeftPanel = styled(Panel)`
  animation: ${slideInLeft} 0.5s ease-out 0.12s both;
`;

const RightPanel = styled(Panel)`
  animation: ${slideInRight} 0.5s ease-out 0.18s both;
`;

// Slim header — a thin elevated nameplate band. Slightly lighter than the
// panel body so it reads as a raised spine the title sits on, closed off by
// a cool hairline.
const PanelHead = styled.header`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: clamp(7px, 1cqh, 11px) clamp(12px, 1.7cqw, 20px);
  background: linear-gradient(180deg, ${D.headTop} 0%, ${D.headBottom} 100%);
  border-bottom: 1px solid ${D.border};
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);

  /* Faint printed-paper weave for tactile depth on the nameplate band. */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: ${WASHI_LIGHT_ON_DARK};
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
  gap: clamp(7px, 1cqw, 11px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.6rem, 0.94cqw, 0.8rem);
  color: ${D.textHi};
  text-transform: uppercase;
  letter-spacing: 0.2em;

  &::before {
    content: "";
    width: clamp(14px, 1.8cqw, 20px);
    height: 2px;
    background: ${(p) => p.$accent || C.ice};
  }
`;

const HeadMeta = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.66cqw, 0.52rem);
  color: ${(p) => (p.$accent ? D.textHi : D.textMute)};
  text-transform: uppercase;
  letter-spacing: 0.22em;
`;

const RankChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: clamp(5px, 0.7cqw, 8px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.76cqw, 0.6rem);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.14em;
  background: linear-gradient(
    180deg,
    rgba(232, 197, 71, 0.12) 0%,
    rgba(232, 197, 71, 0.05) 100%
  );
  border: 1px solid rgba(232, 197, 71, 0.32);
  border-radius: 999px;
  padding: clamp(3px, 0.5cqh, 5px) clamp(9px, 1.2cqw, 13px);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease,
    box-shadow 0.15s ease;

  .ladder {
    font-size: 1.05em;
    line-height: 1;
    opacity: 0.7;
  }
  &:hover {
    border-color: ${C.gold};
    color: ${C.cream};
    background: linear-gradient(
      180deg,
      rgba(232, 197, 71, 0.22) 0%,
      rgba(232, 197, 71, 0.10) 100%
    );
    box-shadow: 0 0 14px rgba(232, 197, 71, 0.22);
  }
`;

// ============================================
// LEFT — PORTRAIT + ATTRIBUTES + APPEARANCE
// ============================================

const PortraitStage = styled.div`
  /* Takes ALL leftover column height after the fixed chrome (head, attrs,
     appearance, footer). No hard min-height — that was clipping the footer
     on shorter viewports. On tall screens this still grows the fighter. */
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(4px, 0.8cqh, 10px) clamp(10px, 1.5cqw, 18px);
  position: relative;
  overflow: hidden;
  /* High-contrast lightbox: the fighter stands on bright washi paper, lit
     from above and framed by a soft inset vignette — reads as a premium
     character-viewer pod set into the dark panel. */
  background: radial-gradient(
    ellipse at 50% 32%,
    ${D.stageTop} 0%,
    ${D.stageMid} 58%,
    ${D.stageBottom} 100%
  );
  box-shadow:
    inset 0 0 0 1px rgba(60, 40, 20, 0.12),
    inset 0 -24px 42px -18px rgba(70, 48, 24, 0.42),
    inset 0 16px 30px -18px rgba(255, 252, 244, 0.7);
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: ${WASHI_DARK_ON_LIGHT};
    pointer-events: none;
  }
  /* Thin ice frame — behind the fighter so it frames the stage, not the sprite. */
  &::after {
    content: "";
    position: absolute;
    inset: 5px;
    border: 1px solid rgba(126, 203, 240, 0.22);
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px rgba(255, 252, 244, 0.35);
    pointer-events: none;
    z-index: 1;
  }
`;

// Ground shadow — same three-zone cool slate recipe as in-game PlayerShadow
// (contact / core / ambient). Footprint scaled to the portrait sprite
// (~4.4:1 oval); no warm brown drop-shadow on the sprite itself.
const PortraitFloor = styled.div`
  position: absolute;
  left: 50%;
  bottom: clamp(8px, 1.5cqh, 17px);
  transform: translateX(-50%);
  width: clamp(120px, 16cqw, 190px);
  height: clamp(27px, 3.6cqh, 43px);
  border-radius: 50%;
  background: ${SHADOW_GRADIENT};
  z-index: 1;
  pointer-events: none;
`;

const PortraitSpotlight = styled.div`
  position: absolute;
  inset: 0;
  /* Stronger mawashi-blue halo — ties the bright stage to the ice accent
     and keeps the lightbox from reading as a flat beige card. */
  background: radial-gradient(
    ellipse at center 44%,
    rgba(126, 203, 240, 0.22) 0%,
    rgba(168, 224, 255, 0.08) 38%,
    transparent 62%
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
`;

const PortraitImage = styled.img`
  height: 108%;
  max-height: 108%;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  transform: scaleX(-1);
  transform-origin: center bottom;
`;

// Section block for Attributes + Appearance in the left column. Cool frost
// wash separates it from the portrait stage without going pure dark — still
// reads as one carved plaque, but with a brighter ice band under the stats.
const Block = styled.div`
  flex-shrink: 0;
  padding: clamp(6px, 0.9cqh, 10px) clamp(12px, 1.6cqw, 18px);
  border-top: 1px solid rgba(126, 203, 240, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  background: linear-gradient(
    180deg,
    ${D.frostStrong} 0%,
    ${D.frost} 48%,
    transparent 100%
  );
`;

const BlockHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: clamp(4px, 0.6cqh, 7px);
`;

const BlockLabel = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 10px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.74cqw, 0.6rem);
  color: ${D.textHi};
  text-transform: uppercase;
  letter-spacing: 0.24em;

  &::before {
    content: "";
    width: clamp(10px, 1.4cqw, 14px);
    height: 2px;
    background: ${C.ice};
    box-shadow: 0 0 8px ${C.iceGlow};
  }
`;

const BlockMeta = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.62cqw, 0.48rem);
  color: ${(p) => (p.$accent ? C.iceBright : D.textMute)};
  text-transform: uppercase;
  letter-spacing: 0.18em;
  ${(p) =>
    p.$accent &&
    css`
      text-shadow: 0 0 10px ${C.iceGlow};
    `}
`;

// --- Attribute rows (compact for the narrow column) ---

const StatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.4cqh, 4px);
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: clamp(22px, 2.6cqw, 28px) minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(6px, 0.9cqw, 10px);
  padding: clamp(2px, 0.35cqh, 4px) clamp(5px, 0.7cqw, 8px);
  border-radius: 3px;
  background: rgba(8, 12, 18, 0.28);
  border: 1px solid rgba(234, 241, 247, 0.06);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
`;

const StatKanji = styled.div`
  width: clamp(22px, 2.6cqw, 28px);
  height: clamp(22px, 2.6cqw, 28px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ${FONT_KANJI};
  font-size: clamp(0.7rem, 1cqw, 0.85rem);
  color: ${C.iceBright};
  line-height: 1;
  border-radius: 3px;
  background: linear-gradient(
    180deg,
    rgba(126, 203, 240, 0.16) 0%,
    rgba(54, 130, 170, 0.10) 100%
  );
  border: 1px solid rgba(126, 203, 240, 0.28);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 10px rgba(126, 203, 240, 0.12);
`;

const StatBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(1px, 0.3cqh, 3px);
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
  font-size: clamp(0.46rem, 0.72cqw, 0.58rem);
  color: ${D.text};
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const PipTrack = styled.div`
  display: flex;
  gap: clamp(2px, 0.3cqw, 3px);
  padding: 1px;
  border-radius: 2px;
  background: rgba(8, 12, 18, 0.45);
  border: 1px solid rgba(234, 241, 247, 0.05);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.28);
`;

const Pip = styled.div`
  flex: 1;
  height: clamp(4px, 0.55cqh, 5px);
  border-radius: 1px;
  background: ${(p) =>
    p.$filled
      ? "linear-gradient(180deg, #a8e0ff 0%, #4a9fc9 100%)"
      : "rgba(234, 241, 247, 0.04)"};
  border: 1px solid ${(p) => (p.$filled ? "#5bb3d9" : "transparent")};
  box-shadow: ${(p) =>
    p.$filled ? "0 0 4px rgba(126, 203, 240, 0.45)" : "none"};
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
  gap: clamp(2px, 0.35cqw, 4px);
`;

const StepButton = styled.button`
  width: clamp(16px, 2cqw, 22px);
  height: clamp(16px, 2cqw, 22px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.7rem, 1.05cqw, 0.88rem);
  line-height: 1;
  color: ${D.textHi};
  background: linear-gradient(180deg, ${D.softHover} 0%, ${D.soft} 100%);
  border: 1px solid ${D.border};
  border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: color 0.12s ease, border-color 0.12s ease, transform 0.1s ease,
    box-shadow 0.12s ease;

  &:hover:not(:disabled) {
    color: ${C.iceBright};
    border-color: ${C.iceMid};
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 0 10px rgba(126, 203, 240, 0.2);
  }
  &:active:not(:disabled) {
    transform: scale(0.9);
  }
  &:disabled {
    opacity: 0.26;
    cursor: default;
  }
`;

const StatValue = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.54rem, 0.82cqw, 0.7rem);
  color: ${D.textHi};
  letter-spacing: 0.02em;
  min-width: clamp(22px, 2.5cqw, 30px);
  text-align: center;

  .max {
    color: ${D.textFaint};
    font-size: 0.68em;
  }
`;

// --- Appearance (belt / body) ---

const AppearanceRow = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(6px, 0.9cqw, 10px);
`;

const AppearanceButton = styled.button`
  display: flex;
  align-items: center;
  gap: clamp(6px, 0.9cqw, 10px);
  width: 100%;
  text-align: left;
  padding: clamp(4px, 0.6cqh, 7px) clamp(7px, 1cqw, 10px);
  background: ${(p) =>
    p.$open
      ? "linear-gradient(180deg, rgba(72, 84, 98, 0.55) 0%, rgba(42, 50, 60, 0.7) 100%)"
      : "linear-gradient(180deg, rgba(42, 50, 60, 0.55) 0%, rgba(26, 32, 40, 0.7) 100%)"};
  border: 1px solid ${(p) => (p.$open ? C.iceMid : D.border)};
  border-radius: 3px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: ${C.iceMid};
    background: linear-gradient(
      180deg,
      rgba(72, 84, 98, 0.6) 0%,
      rgba(42, 50, 60, 0.75) 100%
    );
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 0 12px rgba(126, 203, 240, 0.12);
  }
`;

const AppearanceSwatch = styled.span`
  flex-shrink: 0;
  width: clamp(16px, 2cqw, 22px);
  height: clamp(16px, 2cqw, 22px);
  border-radius: 50%;
  background: ${(p) => p.$gradient || p.$color};
  border: 2px solid ${D.border};
  box-shadow: 0 1px 3px ${D.shadow};
`;

const AppearanceText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;

  .cat {
    font-family: ${FONT_BODY};
    font-weight: 600;
    font-size: clamp(0.38rem, 0.58cqw, 0.46rem);
    color: ${D.textMute};
    text-transform: uppercase;
    letter-spacing: 0.24em;
  }
  .name {
    font-family: ${FONT_BODY};
    font-weight: 700;
    font-size: clamp(0.48rem, 0.74cqw, 0.6rem);
    color: ${D.textHi};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Popover = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  gap: clamp(9px, 1.3cqh, 13px);
  padding: clamp(11px, 1.5cqh, 15px);
  max-height: min(46cqh, 380px);
  overflow-y: auto;
  background: ${D.panel};
  border: 1px solid ${D.border};
  border-radius: 4px;
  box-shadow: 0 14px 32px ${D.shadowStrong};
  animation: ${popIn} 0.16s ease-out both;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${C.iceMid};
    border-radius: 2px;
  }
`;

const PopoverGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 9px);
`;

const PopoverTitle = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${D.textMute};
  text-transform: uppercase;
  letter-spacing: 0.22em;
`;

const SwatchGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols ?? 6}, minmax(0, 1fr));
  gap: clamp(6px, 0.9cqw, 10px);
`;

const ColorSwatch = styled.button`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: ${(p) => (p.$square ? "6px" : "50%")};
  border: 2px solid ${(p) => (p.$selected ? C.iceBright : D.border)};
  background: ${(p) => p.$gradient || p.$color};
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: ${(p) =>
    p.$selected
      ? `0 0 0 2px rgba(126, 203, 240, 0.55), 0 2px 6px ${D.shadow}`
      : `0 2px 5px ${D.shadow}`};

  &:hover {
    transform: scale(1.12);
    border-color: ${(p) => (p.$selected ? C.iceBright : C.iceMid)};
  }
  &:active {
    transform: scale(0.94);
  }
`;

const IdentityFooter = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: clamp(6px, 0.9cqh, 10px) clamp(12px, 1.6cqw, 18px);
  border-top: 1px solid ${D.border};
  background: linear-gradient(180deg, ${D.chromeTop} 0%, ${D.chromeBottom} 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 1px 0 rgba(0, 0, 0, 0.18);
`;

const IdentityStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: ${(p) => (p.$right ? "flex-end" : "flex-start")};
`;

const IdentityLabel = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.38rem, 0.6cqw, 0.48rem);
  color: ${D.textMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const IdentityRank = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.72rem, 1.1cqw, 0.95rem);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: 0 0 12px rgba(232, 197, 71, 0.28);
`;

const IdentityRecord = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.72rem, 1.1cqw, 0.95rem);
  letter-spacing: 0.04em;
  display: inline-flex;
  align-items: baseline;
  gap: 0.12em;

  .w {
    color: ${C.success};
  }
  .l {
    color: ${C.vermillionBright};
  }
  .sep {
    color: ${D.textFaint};
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
  padding: clamp(12px, 1.7cqh, 18px) clamp(14px, 1.9cqw, 24px);
  overflow: hidden;
  background: linear-gradient(
    180deg,
    ${D.frostStrong} 0%,
    transparent 28%,
    transparent 100%
  );
`;

const LoadoutBoard = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 10px);
`;

const CategoryRow = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: clamp(96px, 12.5cqw, 138px) minmax(0, 1fr);
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  padding: clamp(5px, 0.8cqh, 9px) clamp(10px, 1.4cqw, 15px);
  /* Cool slate shelf — lifted above the panel with a frost edge so each
     discipline reads as its own raised band instead of melting into dusk. */
  background: linear-gradient(
    180deg,
    rgba(72, 84, 98, 0.72) 0%,
    rgba(48, 58, 70, 0.78) 100%
  );
  border: 1px solid rgba(234, 241, 247, 0.16);
  border-radius: 4px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.22),
    0 3px 10px ${D.shadow};
`;

const CategoryLabel = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  min-width: 0;
  padding-left: clamp(8px, 1cqw, 11px);

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 12%;
    bottom: 12%;
    width: 2px;
    border-radius: 1px;
    background: ${C.ice};
    box-shadow: 0 0 8px ${C.iceGlow};
    opacity: 0.85;
  }
`;

const CategoryKanji = styled.div`
  font-family: ${FONT_KANJI};
  font-size: clamp(1.05rem, 1.7cqw, 1.45rem);
  color: ${C.iceBright};
  line-height: 1;
  flex-shrink: 0;
  text-shadow: 0 0 12px ${C.iceGlow};
`;

const CategoryNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`;

const CategoryName = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.5rem, 0.8cqw, 0.64rem);
  color: ${D.textHi};
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const CategorySub = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.38rem, 0.56cqw, 0.46rem);
  color: ${D.textMute};
  text-transform: uppercase;
  letter-spacing: 0.14em;
`;

const SlotStrip = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: clamp(6px, 1cqw, 12px);
`;

// Base square slot. Real options are vivid; placeholders/locked dim out.
const Slot = styled.button`
  position: relative;
  flex-shrink: 0;
  aspect-ratio: 1;
  height: clamp(40px, 6cqh, 62px);
  max-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  padding: 0;
  background: ${(p) => p.$gradient || p.$main || D.deep};
  border: 2px solid
    ${(p) =>
      p.$selected
        ? C.iceBright
        : p.$focused
          ? C.iceMid
          : p.$deep || D.border};
  border-radius: 6px;
  cursor: ${(p) => (p.$interactive ? "pointer" : "default")};
  box-shadow: ${(p) =>
    p.$selected
      ? `0 0 0 2px ${C.iceBright}, 0 0 16px ${D.accentGlow}, 0 4px 12px ${D.shadow}`
      : `inset 0 -2px 0 rgba(0,0,0,0.14), 0 2px 6px ${D.shadow}`};
  transition: transform 0.12s ease, border-color 0.15s ease, box-shadow 0.15s ease,
    filter 0.15s ease;

  img {
    width: ${(p) => p.$imgSize || "78%"};
    height: ${(p) => p.$imgSize || "78%"};
    object-fit: contain;
    transform: scale(${(p) => p.$imgScale ?? 1});
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.34));
  }

  &:hover {
    transform: ${(p) => (p.$interactive ? "translateY(-2px)" : "none")};
    border-color: ${(p) =>
      !p.$interactive
        ? p.$deep || D.border
        : p.$selected
          ? C.iceBright
          : C.iceMid};
  }
  &:active {
    transform: ${(p) => (p.$interactive ? "scale(0.95)" : "none")};
  }
`;

// Locked sidegrade: the icon art stays visible but is dimmed + desaturated
// so it reads as "dormant / not yours yet" — the small corner padlock does
// the labelling instead of a big glyph stamped over the artwork.
const LockedSlot = styled(Slot)`
  background: ${(p) => p.$gradient || p.$main || D.deep};

  img {
    opacity: 0.82;
    filter: saturate(0.72) brightness(0.86)
      drop-shadow(0 2px 4px rgba(0, 0, 0, 0.34));
  }
`;

const PlaceholderSlot = styled(Slot)`
  /* Reserved technique plates — empty slots should feel intentional
     ("sealed for later") rather than unfinished UI. Soft ink wash +
     faint hanko ring + solid hairline; real equipped icons still win. */
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 50% 48%,
      rgba(126, 203, 240, 0.05) 0%,
      transparent 58%
    ),
    linear-gradient(180deg, #1a212b 0%, #12171e 100%);
  border-style: solid;
  border-color: rgba(234, 241, 247, 0.10);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 1px rgba(0, 0, 0, 0.25);
  color: ${D.textFaint};
  opacity: 0.72;
  cursor: default;

  &::before {
    content: "";
    position: absolute;
    inset: 18%;
    border-radius: 50%;
    border: 1px solid rgba(234, 241, 247, 0.08);
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: ${WASHI_LIGHT_ON_DARK};
    opacity: 0.55;
    pointer-events: none;
  }
`;

const SlotKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-size: clamp(1rem, 1.5cqw, 1.35rem);
  color: ${C.cream};
  line-height: 1;
`;

const PlaceholderGlyph = styled.span`
  position: relative;
  z-index: 1;
  font-family: ${FONT_KANJI};
  font-size: clamp(0.72rem, 1.1cqw, 0.92rem);
  color: rgba(210, 220, 232, 0.28);
  line-height: 1;
  letter-spacing: 0;
`;

const SlotCheck = styled.span`
  position: absolute;
  top: -7px;
  right: -7px;
  width: clamp(15px, 1.9cqw, 20px);
  height: clamp(15px, 1.9cqw, 20px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.55rem, 0.85cqw, 0.7rem);
  color: ${C.sumi};
  background: ${C.iceBright};
  border: 1px solid ${C.iceMid};
  border-radius: 50%;
  box-shadow: 0 1px 3px ${C.sumiShadow};
`;

// Small padlock badge pinned to the bottom-right corner — a dark disc with a
// cream lock, so it stays legible over any icon color without covering the
// artwork. Replaces the oversized centered padlock that hid half the icon.
const SlotLock = styled.span`
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: clamp(16px, 2cqw, 21px);
  height: clamp(16px, 2cqw, 21px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: ${C.cream};
  background: ${C.sumi};
  border: 1px solid ${D.border};
  box-shadow: 0 1px 3px ${D.shadowStrong};
  pointer-events: none;

  svg {
    width: 58%;
    height: 58%;
  }
`;

// --- Detail strip (integrated, reserved height, no boxed callout) ---

const DetailStrip = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: clamp(11px, 1.5cqw, 16px);
  min-height: clamp(70px, 10.5cqh, 92px);
  margin-top: clamp(10px, 1.5cqh, 16px);
  padding: clamp(10px, 1.5cqh, 14px) clamp(12px, 1.5cqw, 16px);
  border: 1px solid rgba(126, 203, 240, 0.18);
  border-radius: 4px;
  background: linear-gradient(
    180deg,
    rgba(234, 241, 247, 0.12) 0%,
    rgba(126, 203, 240, 0.06) 100%
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.10);
`;

const DetailIcon = styled.div`
  position: relative;
  flex-shrink: 0;
  width: clamp(46px, 5.8cqw, 60px);
  height: clamp(46px, 5.8cqw, 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  background: ${(p) => p.$gradient || p.$main || D.deep};
  border: 1px solid ${(p) => p.$deep || D.border};
  border-radius: 6px;
  box-shadow: 0 2px 6px ${D.shadow};

  img {
    width: ${(p) => p.$imgSize || "80%"};
    height: ${(p) => p.$imgSize || "80%"};
    object-fit: contain;
    opacity: ${(p) => (p.$locked ? 0.82 : 1)};
    filter: ${(p) =>
      p.$locked
        ? "saturate(0.72) brightness(0.86) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.34))"
        : "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.34))"};
  }

  /* Small padlock badge pinned to the true bottom-right corner — identical
     to the loadout slot lock (pokes just outside the icon) so both locks
     read as the same badge on the same shelf. */
  .lock {
    position: absolute;
    bottom: -6px;
    right: -6px;
    width: clamp(16px, 2cqw, 21px);
    height: clamp(16px, 2cqw, 21px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: ${C.cream};
    background: ${C.sumi};
    border: 1px solid ${D.border};
    box-shadow: 0 1px 3px ${D.shadowStrong};

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
  gap: clamp(2px, 0.5cqh, 5px);
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
  font-size: clamp(0.6rem, 0.94cqw, 0.78rem);
  color: ${D.textHi};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const DetailTag = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${(p) => (p.$accent ? C.iceBright : D.textMute)};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 2px 7px;
  border-radius: 2px;
  background: ${(p) =>
    p.$accent ? "rgba(126, 203, 240, 0.12)" : "rgba(234, 241, 247, 0.05)"};
  border: 1px solid
    ${(p) => (p.$accent ? "rgba(126, 203, 240, 0.28)" : D.borderSoft)};
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
  width: clamp(40px, 5cqw, 52px);
  height: clamp(40px, 5cqw, 52px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-family: ${FONT_KANJI};
  font-size: clamp(1rem, 1.5cqw, 1.25rem);
  color: rgba(126, 203, 240, 0.45);
  background: linear-gradient(180deg, #1a212b 0%, #12171e 100%);
  border: 1px solid rgba(126, 203, 240, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
`;

const DetailEmptyCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;

  .title {
    font-family: ${FONT_BODY};
    font-weight: 700;
    font-size: clamp(0.48rem, 0.72cqw, 0.58rem);
    color: ${D.textHi};
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }
  .hint {
    font-family: ${FONT_BODY};
    font-weight: 500;
    font-size: clamp(0.42rem, 0.64cqw, 0.52rem);
    color: ${D.textMute};
    letter-spacing: 0.04em;
    line-height: 1.35;
  }
`;

const DetailDesc = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.44rem, 0.66cqw, 0.54rem);
  color: ${D.text};
  letter-spacing: 0.01em;
  line-height: 1.42;
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
  min-height: clamp(32px, 3.8cqh, 40px);
  padding: clamp(7px, 1cqh, 10px) clamp(13px, 1.7cqw, 19px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.5rem, 0.76cqw, 0.62rem);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease,
    transform 0.1s ease, opacity 0.15s ease;

  ${(p) =>
    p.$variant === "buy" &&
    css`
      color: ${C.sumi};
      background: ${C.gold};
      border: 1px solid ${C.gold};
      font-weight: 700;
      &:hover:not(:disabled) {
        background: ${C.goldDeep};
        border-color: ${C.goldDeep};
      }
    `}
  ${(p) =>
    p.$variant === "equip" &&
    css`
      color: ${D.textHi};
      background: ${C.iceMid};
      border: 1px solid ${C.iceBright};
      &:hover:not(:disabled) {
        background: #4a9fc9;
      }
    `}
  ${(p) =>
    p.$variant === "equipped" &&
    css`
      color: ${C.inkText};
      background: linear-gradient(
        180deg,
        rgba(168, 224, 255, 0.92) 0%,
        rgba(126, 203, 240, 0.88) 100%
      );
      border: 1px solid ${C.iceBright};
      box-shadow: 0 0 14px ${C.iceGlow};
      &:hover:not(:disabled) {
        background: linear-gradient(
          180deg,
          #dff3ff 0%,
          rgba(168, 224, 255, 0.95) 100%
        );
      }
    `}

  &:active:not(:disabled) {
    transform: scale(0.96);
  }
  &:disabled {
    cursor: default;
    opacity: 0.4;
    background: ${D.deep};
    color: ${D.textMute};
    border-color: ${D.border};
  }
`;

// --- Start footer (light, prominent CTA) ---

const StartFooter = styled.footer`
  display: flex;
  align-items: center;
  gap: clamp(12px, 1.8cqw, 20px);
  flex-shrink: 0;
  padding: clamp(11px, 1.5cqh, 16px) clamp(14px, 1.9cqw, 24px);
  border-top: 1px solid ${D.border};
  background: linear-gradient(180deg, ${D.chromeTop} 0%, ${D.chromeBottom} 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 1px 0 rgba(0, 0, 0, 0.18);
`;

const StartNote = styled.div`
  flex: 1;
  font-family: ${FONT_BODY};
  font-weight: 600;
  font-size: clamp(0.44rem, 0.68cqw, 0.54rem);
  color: ${D.text};
  text-transform: uppercase;
  letter-spacing: 0.14em;
  line-height: 1.4;

  em {
    font-style: normal;
    color: ${C.gold};
    font-weight: 700;
  }
`;

const StartButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.1cqw, 12px);
  min-height: clamp(42px, 5cqh, 52px);
  padding: clamp(11px, 1.5cqh, 16px) clamp(22px, 3cqw, 42px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.7rem, 1.05cqw, 0.92rem);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: ${C.cream};
  background: ${C.vermillion};
  border: 1px solid ${C.vermillionBright};
  border-radius: 2px;
  cursor: pointer;
  /* Even halo: the vermillion glow is centered (0 offset) so it reads the
     same top and bottom; a separate neutral dark drop grounds the button
     without dragging the colored glow downward. */
  box-shadow: 0 0 18px ${C.vermillionGlow}, 0 3px 8px rgba(0, 0, 0, 0.35);
  transition: background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease;

  .arrow {
    font-family: ${FONT_BODY};
    font-weight: 700;
    transition: transform 0.2s ease;
  }
  &:hover {
    background: ${C.vermillionBright};
    box-shadow: 0 0 26px ${C.vermillionGlow}, 0 4px 10px rgba(0, 0, 0, 0.4);
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

  const saveDocRef = useRef(null);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef(null);

  const [previewSrc, setPreviewSrc] = useState(pumo);
  const mountedRef = useRef(true);

  const [showBanzuke, setShowBanzuke] = useState(false);

  // Appearance popover ("belt" | "body" | null).
  const [customizeOpen, setCustomizeOpen] = useState(null);
  const customizeRef = useRef(null);

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
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSave().then((doc) => {
      if (cancelled) return;
      saveDocRef.current = doc;
      setCareer(doc.career);
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
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Close the appearance popover on outside click / Escape.
  useEffect(() => {
    if (!customizeOpen) return;
    const onDown = (e) => {
      if (customizeRef.current && !customizeRef.current.contains(e.target)) {
        setCustomizeOpen(null);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setCustomizeOpen(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [customizeOpen]);

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
    const baseSave = { ...(saveDocRef.current || makeDefaultSave()), career };
    if (resumeRun) {
      onStartRun({ run: resumeRun, save: baseSave });
      return;
    }
    const run = createRun(career);
    onStartRun({ run, save: { ...baseSave, bashoRun: run } });
  }, [career, resumeRun, onStartRun]);

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

  const handleBeltSelect = (hex) => {
    playButtonPressSound2();
    setPlayer1Color(hex);
  };

  const handleBodySelect = (hex) => {
    playButtonPressSound2();
    setPlayer1BodyColor(hex);
  };

  const toggleCustomize = (which) => {
    playButtonPressSound2();
    setCustomizeOpen((cur) => (cur === which ? null : which));
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
  };

  // ---- Derived display values ----

  const division = getDivision(career.rank);
  const rankLabel = formatRank(career.rank);
  const bouts = boutsForRank(career.rank);

  const loadoutUsed = loadoutSpent(career.loadout);
  const loadoutRemaining = LOADOUT_BUDGET - loadoutUsed;

  const selectedBelt = BELT_ALL.find((c) => c.hex === player1Color);
  const selectedBody = BODY_COLORS.find((c) => c.hex === player1BodyColor);
  const beltName = selectedBelt?.name || "Default";
  const bodyName = selectedBody?.name || "Default";

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
      <Snowfall intensity={15} showFrost={false} zIndex={2} />

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
        <LeftPanel $accent={C.ice} $glow={C.iceGlow}>
          <PanelHead>
            <HeadTitle $accent={C.ice}>Your Rikishi</HeadTitle>
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
            <PortraitFloor />
            <AvatarBreath>
              <PortraitImage src={previewSrc} alt="Your wrestler" />
            </AvatarBreath>
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

          <Block ref={customizeRef}>
            <BlockHead>
              <BlockLabel>Appearance</BlockLabel>
            </BlockHead>
            <AppearanceRow>
              <AppearanceButton
                type="button"
                $open={customizeOpen === "belt"}
                onClick={() => toggleCustomize("belt")}
                onMouseEnter={playButtonHoverSound}
              >
                <AppearanceSwatch
                  $color={player1Color || SPRITE_BASE_COLOR}
                  $gradient={selectedBelt?.gradient}
                />
                <AppearanceText>
                  <span className="cat">Belt</span>
                  <span className="name">{beltName}</span>
                </AppearanceText>
              </AppearanceButton>

              <AppearanceButton
                type="button"
                $open={customizeOpen === "body"}
                onClick={() => toggleCustomize("body")}
                onMouseEnter={playButtonHoverSound}
              >
                <AppearanceSwatch
                  $color={player1BodyColor || "#888"}
                  $gradient={selectedBody?.gradient}
                />
                <AppearanceText>
                  <span className="cat">Body</span>
                  <span className="name">{bodyName}</span>
                </AppearanceText>
              </AppearanceButton>

              {customizeOpen === "belt" && (
                <Popover role="menu" aria-label="Belt colors">
                  <PopoverGroup>
                    <PopoverTitle>Belt Colors</PopoverTitle>
                    <SwatchGrid $cols={5}>
                      {BELT_SOLIDS.map((color) => (
                        <ColorSwatch
                          key={color.name}
                          $color={color.hex}
                          $selected={player1Color === color.hex}
                          onClick={() => handleBeltSelect(color.hex)}
                          onMouseEnter={playButtonHoverSound}
                          title={color.name}
                          aria-label={color.name}
                        />
                      ))}
                    </SwatchGrid>
                  </PopoverGroup>
                  <PopoverGroup>
                    <PopoverTitle>Special Patterns</PopoverTitle>
                    <SwatchGrid $cols={5}>
                      {BELT_PATTERNS.map((color) => (
                        <ColorSwatch
                          key={color.name}
                          $square
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
                  </PopoverGroup>
                </Popover>
              )}

              {customizeOpen === "body" && (
                <Popover role="menu" aria-label="Body colors">
                  <PopoverGroup>
                    <PopoverTitle>Body Colors</PopoverTitle>
                    <SwatchGrid $cols={5}>
                      {BODY_COLORS.map((color) => (
                        <ColorSwatch
                          key={color.name}
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
                  </PopoverGroup>
                </Popover>
              )}
            </AppearanceRow>
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
        <RightPanel $accent={C.ice} $glow={C.iceGlow}>
          <PanelHead>
            <HeadTitle $accent={C.ice}>Loadout</HeadTitle>
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
            <StartButton onClick={handleStart} onMouseEnter={playButtonHoverSound}>
              {resumeRun ? "Resume Basho" : "Start Basho"}
              <span className="arrow">&rarr;</span>
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
