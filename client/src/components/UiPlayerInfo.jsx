import PropTypes from "prop-types";
import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import { C } from "./menuTheme";

/*
 * Pumo Pumo HUD — palette aligned with the canonical menuTheme tokens
 * (ink / cream / gold / ice / vermillion). All warm-brown gold has been
 * migrated to theme saffron gold (`C.gold` / `#e8c547`) and a deeper
 * cool-saffron shadow (`#c9a614` — same hue/saturation as C.gold but
 * darker, so it reads as deep gold instead of brown). The legacy
 * darkgoldenrod (`#b8860b`) and old-gold (`#d4af37`) values have been
 * fully removed because they read as brown next to the menu's saffron
 * gold token. Greens (regen) and reds (stamina danger) are intentionally
 * preserved — they carry semantic meaning that overrides the cool
 * palette. The balance-bar danger fill DOES use the brand vermillion
 * (`C.vermillion`) so the kill-marker tassel and the danger fill speak
 * the same color language.
 */

// ============================================
// ANIMATIONS
// ============================================

const flashRedPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

const pulseWin = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.18); }
  100% { transform: scale(1); }
`;

/* Sweeping brass shine across the balance fill */
const iceShimmer = keyframes`
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
`;

/* Satin pearl sweep across the stamina fill */
const emberShimmer = keyframes`
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(250%); }
`;

/* Pulsing glow overlay during stamina regeneration */
const regenPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.85; }
`;

/* Bright green flash for parry stamina refund — punchy and unmissable */
const parryRefundFlash = keyframes`
  0% {
    opacity: 1;
    box-shadow: inset 0 0 20px rgba(74, 255, 160, 0.9), 0 0 16px rgba(74, 255, 160, 0.7);
  }
  30% {
    opacity: 0.9;
    box-shadow: inset 0 0 14px rgba(74, 255, 160, 0.6), 0 0 10px rgba(74, 255, 160, 0.4);
  }
  100% {
    opacity: 0;
    box-shadow: inset 0 0 0px rgba(74, 255, 160, 0), 0 0 0px rgba(74, 255, 160, 0);
  }
`;

/* Pulsing danger glow for the bar frame when stamina is critical.
 * Uses clean gold (C.gold) for the calm-state ring instead of the previous
 * muddy brown-gold, then transitions to a vermillion-tinged ring on the
 * pulse peak so the gold→red shift reads as "the frame itself is alarming". */
const dangerFramePulse = keyframes`
  0%, 100% {
    box-shadow:
      inset 0 0 6px rgba(255, 40, 40, 0.05),
      0 0 4px rgba(255, 40, 40, 0.05),
      0 0 0 2px rgba(232, 197, 71, 0.75);
  }
  50% {
    box-shadow:
      inset 0 0 14px rgba(255, 40, 40, 0.28),
      0 0 18px rgba(238, 81, 65, 0.45),
      0 0 0 2px rgba(238, 81, 65, 0.85);
  }
`;

/* Labored breathing pulse — slow, heavy */
const gassedBreathe = keyframes`
  0%, 100% { opacity: 0.92; }
  50% { opacity: 0.6; }
`;

/* Gassed text plate pulse — border brightens, tiny scale bump */
const gassedTextPulse = keyframes`
  0%, 100% {
    border-color: rgba(255, 40, 40, 0.5);
    transform: scale(1);
  }
  50% {
    border-color: rgba(255, 60, 60, 0.85);
    transform: scale(1.04);
  }
`;

/* Intense red frame pulse when fully gassed */
const gassedFramePulse = keyframes`
  0%, 100% {
    box-shadow:
      inset 0 0 10px rgba(255, 20, 20, 0.15),
      0 0 12px rgba(255, 20, 20, 0.35),
      0 0 24px rgba(255, 10, 10, 0.2),
      0 0 0 2px rgba(220, 30, 30, 0.8);
  }
  50% {
    box-shadow:
      inset 0 0 16px rgba(255, 20, 20, 0.4),
      0 0 28px rgba(255, 30, 30, 0.6),
      0 0 48px rgba(255, 10, 10, 0.3),
      0 0 0 2px rgba(255, 50, 50, 0.95);
  }
`;

/* Green-mint burst when recovering from gassed state — "second wind" */
const recoveryBurst = keyframes`
  0% {
    opacity: 1;
    box-shadow: inset 0 0 30px rgba(225, 255, 241, 0.96), 0 0 24px rgba(75, 231, 158, 0.84);
  }
  25% {
    opacity: 0.9;
    box-shadow: inset 0 0 20px rgba(225, 255, 241, 0.62), 0 0 16px rgba(75, 231, 158, 0.5);
  }
  100% {
    opacity: 0;
    box-shadow: inset 0 0 0px rgba(225, 255, 241, 0), 0 0 0px rgba(75, 231, 158, 0);
  }
`;

const recoveryTextPop = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  20% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.15);
  }
  35% {
    transform: translate(-50%, -50%) scale(0.95);
  }
  50% {
    transform: translate(-50%, -50%) scale(1);
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.05);
  }
`;

/* Drifting motes inside the stamina fill — slow horizontal drift with a
 * soft fade-in/out at each end, so the bar always feels *alive* without
 * needing a separate persistent leading-edge spark. Direction matches
 * the player's anchor side. */
const moteDrift = keyframes`
  0%   { transform: translateX(0)    translateY(0);   opacity: 0; }
  18%  { opacity: 0.85; }
  60%  { opacity: 0.7;  }
  100% { transform: translateX(-90px) translateY(-2px); opacity: 0; }
`;
const moteDriftReverse = keyframes`
  0%   { transform: translateX(0)   translateY(0);   opacity: 0; }
  18%  { opacity: 0.85; }
  60%  { opacity: 0.7;  }
  100% { transform: translateX(90px) translateY(-2px); opacity: 0; }
`;

/* Subtle vertical wobble on the fill's top edge — tells the eye "this is alive" */
const fillWobble = keyframes`
  0%, 100% { transform: translateY(0)    scaleY(1);     }
  50%      { transform: translateY(-0.5px) scaleY(1.02); }
`;

/* One-shot impact spark at the trailing edge when stamina takes a hit */
const impactSpark = keyframes`
  0% {
    opacity: 1;
    transform: translateY(-50%) scaleX(0.4) scaleY(1);
    filter: brightness(2.5);
  }
  35% {
    opacity: 0.95;
    transform: translateY(-50%) scaleX(1.1) scaleY(1.4);
    filter: brightness(1.8);
  }
  100% {
    opacity: 0;
    transform: translateY(-50%) scaleX(2.2) scaleY(0.4);
    filter: brightness(1);
  }
`;

/* One-shot frame shake on big stamina drops */
const frameShake = keyframes`
  0%, 100% { transform: translate(0, 0); }
  15%      { transform: translate(-1.5px, 0.5px); }
  30%      { transform: translate(1.5px, -0.5px); }
  45%      { transform: translate(-1px, -0.5px); }
  60%      { transform: translate(1px, 0.5px); }
  80%      { transform: translate(-0.5px, 0); }
`;

/* Ascending icy mist particle — used in regen overlay */
const mistRise = keyframes`
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.6);
  }
  20% {
    opacity: 0.85;
    transform: translateY(-30%) scale(0.9);
  }
  70% {
    opacity: 0.45;
    transform: translateY(-110%) scale(1.05);
  }
  100% {
    opacity: 0;
    transform: translateY(-160%) scale(0.7);
  }
`;

/* Chevron scroll pattern for regen — subtle directional energy */
const chevronScrollRight = keyframes`
  from { background-position: 0 0; }
  to   { background-position: 22px 0; }
`;
const chevronScrollLeft = keyframes`
  from { background-position: 0 0; }
  to   { background-position: -22px 0; }
`;

/* Gassed steam — wavy heatwave shimmer rising off the bar.
 * Combines a slow horizontal drift with a vertical "breath" that swells
 * the overlay, so the heat blobs feel like they're being pushed by the
 * wrestler's labored breathing. */
const gassedSteam = keyframes`
  0%   { transform: translateX(0)    translateY(0)    scaleY(1);    opacity: 0.55; }
  50%  { transform: translateX(8px)  translateY(-2px) scaleY(1.05); opacity: 0.9;  }
  100% { transform: translateX(-6px) translateY(0)    scaleY(1);    opacity: 0.55; }
`;

/* Animated hairline cracks — appear/fade as the metal "strains" */
const gassedCracks = keyframes`
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 0.7;  }
`;

/* GASSED letter droop — each letter dips on the breathing pulse */
const gassedTextDroop = keyframes`
  0%, 100% { transform: translateY(0)    scaleY(1);    letter-spacing: 0.3em; }
  50%      { transform: translateY(0.5px) scaleY(0.94); letter-spacing: 0.34em; }
`;

/* Go-stone place ripple — single radial ring expanding outward */
const stonePlaceRipple = keyframes`
  0% {
    opacity: 0.9;
    transform: translate(-50%, -50%) scale(0.6);
  }
  60% {
    opacity: 0.4;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.4);
  }
`;

/* Balance bar in-danger wobble — tilts ±1° + mild shake. Subtle, not nauseating. */
const balanceTilt = keyframes`
  0%, 100% { transform: rotate(-1deg)   translateX(0); }
  25%      { transform: rotate(1deg)    translateX(0.5px); }
  50%      { transform: rotate(-0.5deg) translateX(-0.5px); }
  75%      { transform: rotate(0.6deg)  translateX(0.3px); }
`;

/* Quiet expanding ring around the kill threshold notch — runs constantly
 * so the danger boundary is always readable without needing to make the
 * whole strip pulsate. Soft and slow on purpose. */
const killMarkerPulse = keyframes`
  0%   { opacity: 0.7; transform: translate(-50%, -50%) scale(0.6); }
  100% { opacity: 0;   transform: translate(-50%, -50%) scale(1.6); }
`;

// ============================================
// MAIN HUD SHELL
// ============================================

const HudShell = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(7px, 1.2cqh, 12px) clamp(6px, 1cqw, 14px);
  padding-top: clamp(16px, 2.4cqh, 26px);
  opacity: ${(p) => (p.$matchOver ? 0.88 : 1)};
  filter: ${(p) =>
    p.$matchOver
      ? "saturate(0.84) brightness(0.86) contrast(0.97)"
      : "none"};
  transform: ${(p) => (p.$matchOver ? "translateY(2px)" : "none")};
  transition:
    opacity 260ms ease,
    filter 260ms ease,
    transform 260ms ease;

  background:
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.88) 0%,
      rgba(0, 0, 0, 0.78) 20%,
      rgba(0, 0, 0, 0.5) 50%,
      rgba(0, 0, 0, 0.18) 78%,
      transparent 100%
    );

`;

// ============================================
// PLAYER WING  (one per side)
// ============================================

const PlayerWing = styled.div`
  flex: 0 1 48%;
  max-width: min(560px, 45%);
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 0.6cqh, 8px);
  transition: opacity 240ms ease, filter 240ms ease;
  opacity: ${(p) => (p.$matchOver ? 0.93 : 1)};
  filter: ${(p) => (p.$matchOver ? "brightness(0.94)" : "none")};
`;

// ============================================
// NAME BANNER  —  sumo shikona-style plate
// ============================================

const NameBanner = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  gap: clamp(4px, 0.5cqw, 8px);
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  background: none;
  min-height: clamp(18px, 2.2cqh, 26px);
  box-sizing: border-box;
  padding: 0;
  position: relative;
  margin-bottom: clamp(2px, 0.4cqh, 6px);
`;

const NameBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: ${(p) => (p.$isRight ? "flex-end" : "flex-start")};
  min-width: 0;
  flex: 1;
`;

const FighterName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(11px, 1.55cqw, 19px);
  color: #ffffff;
  text-shadow:
    clamp(2px, 0.16cqw, 4px) clamp(2px, 0.16cqw, 4px) 0 #000,
    clamp(-2px, -0.16cqw, -1px) clamp(-2px, -0.16cqw, -1px) 0 #000,
    clamp(2px, 0.16cqw, 4px) clamp(-2px, -0.16cqw, -1px) 0 #000,
    clamp(-2px, -0.16cqw, -1px) clamp(2px, 0.16cqw, 4px) 0 #000,
    0 0 clamp(12px, 1.4cqw, 24px) rgba(0, 0, 0, 0.8),
    0 0 clamp(4px, 0.4cqw, 8px) rgba(0, 0, 0, 1),
    0 0 6px rgba(255, 255, 255, 0.25),
    0 0 3px rgba(255, 255, 255, 0.15);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ============================================
// RANK PLAQUE — sumo banzuke-style ranking plate
// ============================================

/* Sumo banzuke plate — sits below the stamina bar.
 *
 * Lacquered ink base with a hint of vertical washi paper grain. The
 * previous version had ornamental gold-leaf side BRACKETS plus a
 * 1.5px gold border — a third piece of "premium hardware" on the
 * HUD competing with the stamina bar AND the power-up slot. Stripped
 * to a quiet cream-faint border so the rank text + the gold rank
 * letters do the work; the plate itself is just a backdrop. */
const RankPlaque = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.5cqw, 8px);
  padding: clamp(4px, 0.55cqh, 8px) clamp(12px, 1.5cqw, 22px);
  position: relative;

  background:
    /* vertical washi paper-fibre grain — barely visible */
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 2px,
      rgba(245, 236, 217, 0.018) 2px,
      rgba(245, 236, 217, 0.018) 3px
    ),
    /* very faint horizontal weave to add a second axis of texture */
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 4px,
      rgba(245, 236, 217, 0.012) 4px,
      rgba(245, 236, 217, 0.012) 5px
    ),
    linear-gradient(
      180deg,
      rgba(14, 18, 36, 0.94) 0%,
      rgba(10, 14, 28, 0.97) 50%,
      rgba(8, 10, 22, 0.94) 100%
    );
  border-radius: 3px;
  border: 1px solid rgba(245, 236, 217, 0.18);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(245, 236, 217, 0.08),
    inset 0 -1px 3px rgba(0, 0, 0, 0.32);
`;

const RankText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(10px, 1.4cqw, 17px);
  color: #ffe56c;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 1;
  text-shadow:
    0 0 10px rgba(232, 197, 71, 0.5),
    0 0 4px rgba(232, 197, 71, 0.55),
    0 1px 3px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
`;

// ============================================
// STAMINA BAR  — THE HERO OF THE HUD
// ============================================

/* Ornamental outer frame — chiseled banzuke plate.
 *
 * Layered like a real piece of metal hardware:
 *   1. Cream highlight rim (inset)        — top-light catch on the inner edge
 *   2. Clean gold leaf ring (box-shadow)  — primary color (C.gold), no brown
 *   3. Dark gunmetal underlayer           — cool ink, replaces the old "dark gap"
 *   4. Soft drop shadow                   — lift off the background
 *
 * The ::after pseudo paints 4 corner rivets via stacked radial gradients —
 * a single-element trick that gives the "premium plated armor" look without
 * extra DOM nodes.
 *
 * NOTE: this used to be paired with a persistent leading-edge spark and
 * drifting motes inside the fill. The leading-edge spark was the source
 * of the "competing effects" / messy overlap with the ghost bar during
 * damage and has stayed removed; the motes have been restored. */
const BarFrame = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 4px;

  border: clamp(2px, 0.16cqw, 4px) solid transparent;
  box-shadow:
    inset 0 0 0 1px rgba(245, 236, 217, 0.22),
    0 0 0 clamp(2px, 0.16cqw, 4px) rgba(232, 197, 71, 0.85),
    0 0 0 clamp(4px, 0.32cqw, 8px) rgba(20, 23, 30, 0.95),
    0 clamp(3px, 0.24cqw, 6px) clamp(12px, 1cqw, 24px) rgba(0, 0, 0, 0.55);
  opacity: ${(p) => (p.$matchOver ? 0.95 : 1)};
  filter: ${(p) => (p.$matchOver ? "brightness(0.97)" : "none")};
  transition: opacity 220ms ease, filter 220ms ease;

  /* Corner rivets — 4 small gold dots painted via stacked radial gradients */
  &::after {
    content: "";
    position: absolute;
    inset: clamp(-3px, -0.24cqw, -6px);
    border-radius: 4px;
    pointer-events: none;
    z-index: 1;
    background-image:
      radial-gradient(circle at 0 0,
        rgba(255, 252, 220, 0.95) 0%,
        rgba(232, 197, 71, 0.85) 35%,
        rgba(232, 197, 71, 0) 55%),
      radial-gradient(circle at 100% 0,
        rgba(255, 252, 220, 0.95) 0%,
        rgba(232, 197, 71, 0.85) 35%,
        rgba(232, 197, 71, 0) 55%),
      radial-gradient(circle at 0 100%,
        rgba(255, 252, 220, 0.95) 0%,
        rgba(232, 197, 71, 0.85) 35%,
        rgba(232, 197, 71, 0) 55%),
      radial-gradient(circle at 100% 100%,
        rgba(255, 252, 220, 0.95) 0%,
        rgba(232, 197, 71, 0.85) 35%,
        rgba(232, 197, 71, 0) 55%);
    background-size: clamp(6px, 0.7cqw, 9px) clamp(6px, 0.7cqw, 9px);
    background-repeat: no-repeat;
    background-position:
      0 0,
      100% 0,
      0 100%,
      100% 100%;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.7));
  }

  /* Composed animation: optional one-shot shake (on big hits) + the
   * appropriate looping pulse for gassed/danger states. The shake comes
   * first so it visibly punches through the steady-state pulse.
   * We branch on each combination so styled-components resolves the
   * keyframes references (interpolated css\`\`) to their generated names. */
  ${(p) => {
    const gassedDur = p.$matchOver ? "1.9s" : "1.2s";
    const dangerDur = p.$matchOver ? "1.15s" : "0.7s";
    if (p.$shake && p.$gassed) {
      return css`animation: ${frameShake} 0.32s ease-out, ${gassedFramePulse} ${gassedDur} ease-in-out infinite;`;
    }
    if (p.$shake && p.$danger) {
      return css`animation: ${frameShake} 0.32s ease-out, ${dangerFramePulse} ${dangerDur} ease-in-out infinite;`;
    }
    if (p.$shake) {
      return css`animation: ${frameShake} 0.32s ease-out;`;
    }
    if (p.$gassed) {
      return css`animation: ${gassedFramePulse} ${gassedDur} ease-in-out infinite;`;
    }
    if (p.$danger) {
      return css`animation: ${dangerFramePulse} ${dangerDur} ease-in-out infinite;`;
    }
    return "";
  }}
`;

/* Dark inner track — stamina gauge */
const BarTrack = styled.div`
  position: relative;
  width: 100%;
  height: clamp(22px, 4cqh, 40px);
  border-radius: 3px;
  overflow: hidden;

  background:
    linear-gradient(
      ${(p) => (p.$isRight ? "280deg" : "100deg")},
      rgba(2, 2, 2, 0.97) 0%,
      rgba(6, 6, 6, 0.95) 50%,
      rgba(10, 10, 10, 0.92) 100%
    );
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.6),
    inset 0 -1px 3px rgba(0, 0, 0, 0.25);
`;

/* Stamina gauge tally — kanji-style tick. A short top notch + a longer
 * bottom stem evokes a hand-cut tally mark on a banzuke, giving the bar
 * more identity than the previous plain 1px line while staying subtle. */
const StaTickMark = styled.div`
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: ${(p) => p.$pct}%;
  transform: translateX(-50%);
  width: 2px;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.0) 0%,
    rgba(255, 255, 255, 0.22) 18%,
    rgba(255, 255, 255, 0.18) 78%,
    rgba(0, 0, 0, 0.35) 100%
  );
  box-shadow:
    -1px 0 0 rgba(0, 0, 0, 0.18),
     1px 0 0 rgba(255, 255, 255, 0.06);

  /* Tiny notch cap on top — sells the "tally mark" feel. */
  &::before {
    content: "";
    position: absolute;
    top: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 2px;
    background: rgba(255, 255, 255, 0.28);
    border-radius: 1px;
  }
`;

/* Mint-lime frost stamina fill — playful arcade energy with living micro-motion.
 * The fill keeps its existing color language (mint→red, no green→blue swap)
 * but gets a subtle vertical wobble (telling the eye it's *energy*, not paint),
 * plus the existing top highlight + diagonal frost sweep. */
const BarFill = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  transition: width 0.3s ease;
  z-index: 2;
  overflow: hidden;
  transform-origin: ${(p) => (p.$isRight ? "left center" : "right center")};

  background: ${(p) =>
    p.$danger
      ? p.$isRight
        ? "linear-gradient(90deg, #dc2626 0%, #ef4444 40%, #f87171 80%, #fca5a5 100%)"
        : "linear-gradient(90deg, #fca5a5 0%, #f87171 20%, #ef4444 60%, #dc2626 100%)"
      : p.$isRight
        ? "linear-gradient(90deg, #14663d 0%, #1c9b52 14%, #46d46a 34%, #95f07a 56%, #caffae 78%, #f0ffe4 100%)"
        : "linear-gradient(90deg, #f0ffe4 0%, #caffae 18%, #95f07a 40%, #46d46a 64%, #1c9b52 84%, #14663d 100%)"};

  box-shadow: ${(p) =>
    p.$danger
      ? "0 0 14px rgba(239, 68, 68, 0.6), inset 0 0 4px rgba(255, 100, 100, 0.2)"
      : "0 0 14px rgba(149, 240, 122, 0.34), 0 0 6px rgba(202, 255, 174, 0.24), inset 0 0 6px rgba(240, 255, 228, 0.18)"};

  animation: ${(p) =>
    p.$danger
      ? css`${flashRedPulse} 0.6s ease-in-out infinite`
      : css`${fillWobble} 2.4s ease-in-out infinite`};

  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 40%;
    background: linear-gradient(
      180deg,
      rgba(249, 255, 241, 0.42) 0%,
      rgba(236, 255, 214, 0.14) 52%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  /* Frost-glass sweep (only when not danger) */
  &::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    width: 34%;
    background: linear-gradient(
      103deg,
      transparent 0%,
      transparent 28%,
      rgba(238, 255, 219, 0.12) 40%,
      rgba(252, 255, 243, 0.3) 50%,
      rgba(219, 255, 184, 0.16) 58%,
      transparent 70%,
      transparent 100%
    );
    animation: ${emberShimmer} 3.6s ease-in-out infinite;
    animation-delay: ${(p) => (p.$isRight ? "2s" : "0s")};
    pointer-events: none;
    opacity: ${(p) => (p.$danger ? 0 : 1)};
  }
`;

/* Drifting energy motes inside the fill — sparse soft white dots that
 * slowly traverse the fill, telling the eye "this is contained energy."
 * Sits ABOVE the BarFill but UNDER the regen/parry overlays. Only renders
 * when not in danger (motes would compete with the red flash pulse).
 *
 * NOTE: the previous LeadingSpark companion was deliberately NOT
 * restored — the persistent bright-edge glow was the source of the
 * messy overlap with the ghost-bar trailing indicator during damage.
 * Motes alone keep the bar lively without crowding the damage moment. */
const FillMotes = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
  transition: width 0.3s ease;

  /* Three small motes via stacked radial gradients on a single ::before.
   * Each gets a different drift speed/delay so the motion feels organic. */
  &::before,
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 0 30%,
        rgba(255, 255, 255, 0.85) 0%,
        rgba(255, 255, 255, 0.4) 40%,
        rgba(255, 255, 255, 0) 70%),
      radial-gradient(circle at 0 70%,
        rgba(240, 255, 228, 0.7) 0%,
        rgba(240, 255, 228, 0.3) 40%,
        rgba(240, 255, 228, 0) 70%),
      radial-gradient(circle at 0 50%,
        rgba(255, 255, 255, 0.6) 0%,
        rgba(255, 255, 255, 0) 60%);
    background-size: 3px 3px, 2.5px 2.5px, 2px 2px;
    background-repeat: no-repeat;
    background-position: 100% 30%, 60% 70%, 30% 50%;
    animation-name: ${(p) => (p.$isRight ? moteDriftReverse : moteDrift)};
    animation-duration: 4.2s;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
    opacity: 0.9;
  }
  &::after {
    background-position: 80% 60%, 40% 30%, 20% 70%;
    animation-duration: 6s;
    animation-delay: 1.4s;
    opacity: 0.7;
  }
`;

/* One-shot impact spark on heavy hits — sits at the trailing edge of the
 * fill (the side that just shrank inward), painting a quick flash of light
 * to sell the visceral "energy bleeding out" feel. Key-driven remount so
 * each hit gets a fresh animation.
 *
 * Uses .attrs() to inject the dynamic position via inline style so each
 * impact doesn't generate a new styled-components class. */
const ImpactSpark = styled.div.attrs((p) => ({
  style: p.$isRight
    ? { left: `calc(${p.$stamina}% - 4px)` }
    : { right: `calc(${p.$stamina}% - 4px)` },
}))`
  position: absolute;
  top: 50%;
  width: clamp(8px, 1.2cqw, 13px);
  height: 70%;
  transform: translateY(-50%);
  transform-origin: center;
  z-index: 5;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 230, 215, 0.55) 40%,
    rgba(255, 140, 130, 0.3) 70%,
    transparent 100%
  );
  filter: blur(0.6px);
  mix-blend-mode: screen;
  animation: ${impactSpark} 0.26s ease-out forwards;
`;

/* Ghost bar — matte trailing damage indicator.
 *
 * Dialed back from the previous smoked-glass treatment (radial highlight +
 * vertical sheen + diagonal sweep + dual box-shadow + double pseudo-element
 * highlights) which competed with the impact spark and the fill's own
 * sheen during damage. Now it's a flat slightly-translucent matte panel
 * with one subtle top edge highlight — clear "this is where stamina was"
 * without piling on extra glass effects. */
const BarGhost = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
    transition: p.$catching
      ? "width 0.55s ease-out"
      : "width 0.05s linear",
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  z-index: 1;
  pointer-events: none;

  background: linear-gradient(
    180deg,
    rgba(220, 226, 238, 0.72) 0%,
    rgba(178, 188, 206, 0.55) 60%,
    rgba(110, 122, 142, 0.35) 100%
  );

  opacity: 0.78;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);

  /* Single thin top edge highlight so the ghost has a defined upper edge
   * but doesn't bloom into a glass shine. */
  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 32%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.32) 0%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  /* (The diagonal moving sweep was removed — created a glint that fought
   * the impact spark during damage.) */
`;

/* Regen overlay — "catch your breath" treatment.
 *
 * Three layered visuals replace the old flat green tint:
 *   1. Soft green-mint base wash    — keeps the existing readability
 *   2. Directional chevron pattern  — slow scrolling ↑↑↑ inside the bar,
 *                                     hinting at ascending energy
 *   3. Ascending icy mist particles — small white-blue puffs rise and
 *                                     dissolve (this is the "penguin
 *                                     breathing cold air" beat)
 *
 * Sits over the live fill but under the parry-refund flash. */
const RegenGlow = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  z-index: 3;
  pointer-events: none;
  transition: width 0.3s ease;
  overflow: hidden;

  background: linear-gradient(
    ${(p) => (p.$isRight ? "270deg" : "90deg")},
    rgba(52, 211, 153, 0.06) 0%,
    rgba(52, 211, 153, 0.18) 40%,
    rgba(52, 211, 153, 0.32) 75%,
    rgba(74, 222, 170, 0.45) 100%
  );

  box-shadow:
    inset 0 0 10px rgba(52, 211, 153, 0.22),
    inset ${(p) => (p.$isRight ? "-6px" : "6px")} 0 14px rgba(52, 211, 153, 0.28);

  animation: ${regenPulse} 0.9s ease-in-out infinite;

  /* Scrolling chevron pattern — built from a repeating linear gradient that
   * paints angled stripes. Direction matches the regen flow (toward the
   * leading edge of the fill). Subtle opacity so it never dominates. */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      ${(p) => (p.$isRight ? "65deg" : "115deg")},
      rgba(225, 255, 241, 0.0) 0px,
      rgba(225, 255, 241, 0.0) 7px,
      rgba(225, 255, 241, 0.22) 8px,
      rgba(225, 255, 241, 0.22) 10px,
      rgba(225, 255, 241, 0.0) 11px,
      rgba(225, 255, 241, 0.0) 22px
    );
    background-size: 22px 100%;
    animation: ${(p) => (p.$isRight ? chevronScrollLeft : chevronScrollRight)}
      0.8s linear infinite;
    pointer-events: none;
    mix-blend-mode: screen;
  }

  /* Ascending mist particles — three soft white-blue dots that rise and
   * dissolve. Positioned along the fill so they read as breath rising
   * out of multiple points. Stacked on ::after so we get all three from
   * a single pseudo via radial-gradient stacking. */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 0 100%,
        rgba(225, 255, 241, 0.85) 0%,
        rgba(168, 224, 255, 0.55) 30%,
        rgba(168, 224, 255, 0) 60%),
      radial-gradient(circle at 0 100%,
        rgba(225, 255, 241, 0.75) 0%,
        rgba(168, 224, 255, 0.45) 30%,
        rgba(168, 224, 255, 0) 60%),
      radial-gradient(circle at 0 100%,
        rgba(225, 255, 241, 0.7) 0%,
        rgba(168, 224, 255, 0.4) 30%,
        rgba(168, 224, 255, 0) 60%);
    background-size: 6px 6px, 5px 5px, 4px 4px;
    background-repeat: no-repeat;
    background-position: 25% 90%, 55% 90%, 80% 90%;
    animation: ${mistRise} 1.4s ease-out infinite;
    filter: blur(0.4px);
    pointer-events: none;
  }
`;

/* Instant bright green flash overlay for parry stamina refund — sized to current fill */
const ParryRefundFlash = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "left: 2px;" : "right: 2px;")}
  border-radius: 2px;
  z-index: 6;
  pointer-events: none;
  transition: width 0.3s ease;
  background: linear-gradient(
    180deg,
    rgba(74, 255, 160, 0.5) 0%,
    rgba(52, 211, 153, 0.7) 40%,
    rgba(16, 185, 129, 0.7) 60%,
    rgba(52, 211, 153, 0.5) 100%
  );
  animation: ${parryRefundFlash} 0.5s ease-out forwards;
`;

/* Gassed overlay — "out of breath", not "construction site".
 *
 * Replaces the previous diagonal hazard stripes with a layered heatwave
 * effect that reads as exhaustion/strain instead of caution-tape:
 *
 *   Base layer    — deep crimson-black gradient (the dohyo at dusk)
 *   ::before      — drifting smoke/heat blobs (large blurred radial
 *                   gradients that slowly shift, evoking heatwaves
 *                   rising off an exhausted wrestler)
 *   ::after       — a wavy hairline near the bottom of the bar that
 *                   sells the "this metal is straining" feel without
 *                   needing extra DOM nodes
 *
 * The whole overlay still breathes (slow opacity pulse) on the existing
 * gassedBreathe rhythm — that's the labored-breath cadence you want. */
const GassedOverlay = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 3px;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;
  animation: ${gassedBreathe} ${(p) => (p.$matchOver ? "1.9s" : "1.2s")} ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p) => (p.$matchOver ? 0.88 : 1)};
  transition: opacity 220ms ease;

  background:
    radial-gradient(
      ellipse at 30% 50%,
      rgba(60, 12, 12, 0.55) 0%,
      rgba(28, 6, 6, 0.85) 60%,
      rgba(14, 4, 4, 0.95) 100%
    ),
    linear-gradient(
      180deg,
      rgba(50, 10, 10, 0.85) 0%,
      rgba(20, 4, 4, 0.95) 100%
    );

  /* Drifting heatwave / smoke blobs — three soft red-black radial gradients
   * that slowly translate horizontally, giving the overlay a breathing,
   * shimmering interior. Heavy blur sells the "rising heat" feel. */
  &::before {
    content: "";
    position: absolute;
    top: -25%;
    left: -25%;
    right: -25%;
    bottom: -25%;
    background:
      radial-gradient(
        ellipse 60% 80% at 20% 50%,
        rgba(190, 32, 32, 0.55) 0%,
        rgba(80, 12, 12, 0.0) 70%
      ),
      radial-gradient(
        ellipse 45% 100% at 55% 60%,
        rgba(220, 60, 40, 0.42) 0%,
        rgba(80, 12, 12, 0.0) 70%
      ),
      radial-gradient(
        ellipse 55% 70% at 85% 40%,
        rgba(160, 26, 26, 0.5) 0%,
        rgba(60, 8, 8, 0.0) 70%
      );
    background-size: 100% 100%, 100% 100%, 100% 100%;
    background-repeat: no-repeat;
    animation: ${gassedSteam} ${(p) => (p.$matchOver ? "3.4s" : "2.2s")} ease-in-out infinite;
    filter: blur(3px);
    mix-blend-mode: screen;
    pointer-events: none;
  }

  /* Hairline strain marks across top + bottom of the bar — the "metal
   * fatigue" detail. Built from a single repeating linear-gradient so
   * they tile cleanly along the length without extra nodes. */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      /* top hairline strain */
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 10%,
        rgba(255, 80, 60, 0.0) 14%,
        rgba(255, 100, 80, 0.7) 18%,
        rgba(255, 80, 60, 0.0) 22%,
        transparent 30%,
        transparent 50%,
        rgba(255, 100, 80, 0.6) 56%,
        transparent 62%,
        transparent 75%,
        rgba(255, 100, 80, 0.7) 80%,
        transparent 86%,
        transparent 100%
      ),
      /* bottom hairline strain */
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 8%,
        rgba(255, 80, 60, 0.0) 12%,
        rgba(255, 100, 80, 0.55) 16%,
        rgba(255, 80, 60, 0.0) 20%,
        transparent 38%,
        rgba(255, 100, 80, 0.55) 44%,
        transparent 50%,
        transparent 70%,
        rgba(255, 100, 80, 0.6) 76%,
        transparent 82%,
        transparent 100%
      );
    background-size: 100% 1px, 100% 1px;
    background-position: 0 1px, 0 calc(100% - 1px);
    background-repeat: no-repeat;
    animation: ${gassedCracks} ${(p) => (p.$matchOver ? "1.9s" : "1.2s")} ease-in-out infinite;
    pointer-events: none;
  }
`;

/* GASSED text plate — letter droop animation on top of the existing
 * border-pulse, so the word literally sags on each breath (matches the
 * labored-breath cadence of the overlay). */
const GassedText = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(9px, 1.3cqh, 16px);
  color: #fff;
  text-shadow:
    0 0 6px rgba(255, 40, 40, 0.75),
    0 0 12px rgba(255, 20, 20, 0.45),
    0 1px 0 #000;
  letter-spacing: 0.3em;
  position: relative;
  z-index: 1;
  background: rgba(0, 0, 0, 0.85);
  padding: clamp(2px, 0.3cqh, 4px) clamp(8px, 1.2cqw, 18px);
  border: 1.5px solid rgba(255, 40, 40, 0.5);
  border-radius: 2px;
  box-shadow:
    0 0 10px rgba(0, 0, 0, 0.6),
    inset 0 0 8px rgba(120, 20, 20, 0.35);
  /* Two animations: the existing border-pulse + a new vertical droop
   * that runs slightly slower, so the text and the border breathe out of
   * phase — the word feels alive, not robotically synced. */
  animation:
    ${gassedTextPulse} 1.2s ease-in-out infinite,
    ${gassedTextDroop} 1.6s ease-in-out infinite;
`;

/* Gassed recovery burst — bright green-mint flash when "second wind" kicks in */
const RecoveryFlash = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 3px;
  z-index: 7;
  pointer-events: none;
  background: linear-gradient(180deg,
    rgba(225, 255, 241, 0.58) 0%,
    rgba(151, 245, 201, 0.8) 30%,
    rgba(75, 231, 158, 0.84) 60%,
    rgba(25, 201, 119, 0.62) 100%);
  animation: ${recoveryBurst} 0.7s ease-out forwards;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    width: 60%;
    background: linear-gradient(
      100deg,
      transparent 0%,
      transparent 30%,
      rgba(255, 255, 255, 0.35) 45%,
      rgba(255, 255, 255, 0.55) 50%,
      rgba(255, 255, 255, 0.35) 55%,
      transparent 70%,
      transparent 100%
    );
    animation: ${iceShimmer} 0.6s ease-out forwards;
  }
`;

const RecoveryText = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 1cqh, 13px);
  color: #e6fff2;
  text-shadow:
    0 0 10px rgba(151, 245, 201, 0.9),
    0 0 20px rgba(25, 201, 119, 0.62),
    -1px -1px 0 #000, 1px -1px 0 #000,
    -1px 1px 0 #000, 1px 1px 0 #000;
  letter-spacing: 0.15em;
  white-space: nowrap;
  z-index: 8;
  pointer-events: none;
  animation: ${recoveryTextPop} 0.8s ease-out forwards;
`;


/* STA label inside the bar */
const BarLabel = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) => (p.$isRight ? "left: clamp(6px, 1cqw, 14px);" : "right: clamp(6px, 1cqw, 14px);")}
  font-family: "Bungee", cursive;
  font-size: clamp(8px, 0.95cqw, 12px);
  color: rgba(255, 255, 255, 0.82);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow:
    1px 1px 3px rgba(0, 0, 0, 1),
    0 0 8px rgba(0, 0, 0, 0.8),
    0 0 2px rgba(0, 0, 0, 1);
  z-index: 6;
  pointer-events: none;
  user-select: none;
`;

/* "YOU" label on the outer side of the local player's stamina bar */
const YouLabel = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) => (p.$isRight ? "right: clamp(6px, 1cqw, 14px);" : "left: clamp(6px, 1cqw, 14px);")}
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(8px, 0.95cqw, 12px);
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.14em;
  text-shadow:
    1px 1px 3px rgba(0, 0, 0, 1),
    0 0 8px rgba(0, 0, 0, 0.8),
    0 0 2px rgba(0, 0, 0, 1);
  z-index: 6;
  pointer-events: none;
  user-select: none;
`;

// ============================================
// POWER-UP — medal / charm style
// ============================================

const SLOT_SIZE = `clamp(34px, 4.5cqw, 54px)`;

/* Invisible spacer to align rank plaque & name with stamina bar (same width as PowerUpSlot) */
const BarRowSpacer = styled.div`
  width: ${SLOT_SIZE};
  flex-shrink: 0;
  min-height: 0;
`;

// ============================================
// BALANCE BAR — compact stability gauge
// ============================================

/* Vertical stack: stamina bar + balance strip — sits beside power-up slot */
const GaugeStack = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

/* Balance strip — STANCE GAUGE.
 *
 * The whole strip can subtly tilt and wobble when balance crosses the
 * kill threshold (the "losing footing" feel). The tilt only kicks in on
 * the danger prop so it's never disorienting outside of real danger.
 *
 * Transform-origin sits on the INNER edge so the wobble pivots from
 * "where the wrestler is planted" rather than spinning around the
 * geometric center. */
const BalStripWrap = styled.div`
  display: flex;
  align-items: center;
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  gap: clamp(5px, 0.6cqw, 9px);
  width: 50%;
  align-self: ${(p) => (p.$isRight ? "flex-start" : "flex-end")};
  margin-top: clamp(6px, 0.8cqh, 10px);
  transform-origin: ${(p) => (p.$isRight ? "left center" : "right center")};
  transition: transform 220ms ease;

  ${(p) =>
    p.$danger &&
    !p.$matchOver &&
    css`
      animation: ${balanceTilt} 0.55s ease-in-out infinite;
    `}
`;

/* "BAL" label — clean cream text, semantically separate from the gold
 * threshold notches. The label names the gauge; the gold/vermillion
 * notches name the THRESHOLDS. Different colors = different roles. */
const BalLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(6px, 0.7cqw, 9px);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.18em;
  white-space: nowrap;
  flex-shrink: 0;
  user-select: none;
  text-shadow:
    0 1px 0 #000,
    0 0 4px rgba(0, 0, 0, 0.7);
`;

/* Outer container — taller than the inner track so threshold notches
 * can sit ABOVE the bar (not on top of the fill, where they'd disappear
 * into the gold). The tick marks render in this top strip, the bar
 * itself sits centered. */
const BalTrackOuter = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  height: clamp(15px, 2.2cqh, 22px);
`;

/* Stance gauge track — clean ink well with a quiet cream-faint rim.
 *
 * Previously this rim was gold (0.55 alpha) to "mirror the stamina
 * BarFrame at a smaller scale". That mirroring was the problem: it
 * made the balance gauge look like a smaller copy of the hero
 * hardware, so the eye couldn't tell which gauge was the priority.
 *
 * Now the rim is a thin cream hairline — same color language as the
 * other menu surfaces, NOT the chiseled gold leaf reserved for the
 * stamina bar. The track keeps its deep ink fill + ice-blue fill
 * (which still ties it semantically to the mawashi), but it no
 * longer pretends to be premium hardware. */
const BalTrack = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 0;
  right: 0;
  height: clamp(8px, 1.3cqh, 12px);
  border-radius: 100px;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgba(4, 6, 14, 0.98) 0%,
    rgba(12, 16, 30, 0.95) 50%,
    rgba(6, 8, 18, 0.98) 100%
  );
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.85),
    inset 0 -1px 1px rgba(0, 0, 0, 0.4),
    inset 0 0 0 1px rgba(245, 236, 217, 0.18),
    0 1px 2px rgba(0, 0, 0, 0.5);
`;

/* Stance gauge fill — ICE BLUE.
 *
 * The previous saffron-gold fill was a bad idea: it gave us "yellow on
 * yellow" against the gold-rimmed track and the gold throw notch above,
 * and there was no semantic reason for the fill to be gold (gold's
 * already doing the threshold-marker job).
 *
 * Ice blue is canonical for this game: it's the color of the wrestler's
 * MAWASHI (the thick belt). The balance bar represents the wrestler's
 * footing/stance — directly tied to the mawashi. So pumo's stance gauge
 * being mawashi-blue is thematically perfect, and gives us THREE distinct
 * colors on the strip:
 *   • ice blue   — fill body  (the stance / mawashi)
 *   • gold       — rim + throw notch (structural / safe threshold)
 *   • vermillion — kill notch + danger fill (alarm)
 *
 * Each color owns one role. No more yellow on yellow.
 *
 * Vertical gradient (bright top → mid → deep) gives the polished metal
 * sheen regardless of which side the bar is anchored on — drops the
 * direction-dependent horizontal gradient the gold version used. */
const BalFill = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$balance}% - 2px)`,
  },
}))`
  position: absolute;
  top: 1px;
  bottom: 1px;
  ${(p) => (p.$isRight ? "left: 1px;" : "right: 1px;")}
  border-radius: 100px;
  transition: width 0.25s ease;
  z-index: 1;
  overflow: hidden;

  background: ${(p) =>
    p.$danger
      ? `linear-gradient(180deg, ${C.vermillionBright} 0%, ${C.vermillion} 50%, ${C.vermillionDeep} 100%)`
      : `linear-gradient(180deg, ${C.iceBright} 0%, ${C.ice} 50%, ${C.iceMid} 100%)`};

  box-shadow: ${(p) =>
    p.$danger
      ? `0 0 4px ${C.vermillionGlow}, inset 0 -1px 1px rgba(0, 0, 0, 0.45)`
      : `0 0 5px ${C.iceGlow}, inset 0 -1px 1px rgba(0, 0, 0, 0.5)`};

  animation: ${(p) =>
    p.$danger
      ? css`${flashRedPulse} 0.8s ease-in-out infinite`
      : "none"};

  /* Top sheen — frosty white catch on the upper half, sells the polished
   * mawashi-silk surface. */
  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 45%;
    background: linear-gradient(
      180deg,
      rgba(245, 252, 255, 0.55) 0%,
      rgba(220, 240, 255, 0.15) 70%,
      transparent 100%
    );
    border-radius: 100px 100px 0 0;
    pointer-events: none;
  }
`;

/* Threshold notch marker — replaces the fusa tassels.
 *
 * The fusa tassels were too detailed for the actual rendering size: the
 * skirt strands didn't read, and the gold-on-gold throw bead disappeared
 * inside the gold fill at high balance. The new notches sit ABOVE the
 * bar (anchored to the top of BalTrackOuter, NOT inside the track), so
 * they're always readable regardless of fill level — they aren't fighting
 * the fill for visual space.
 *
 * Two flavors:
 *   • throw  — thin gold tick at the 50% midpoint  (subtle, neutral)
 *   • kill   — chunky vermillion notch with quiet pulse halo at the
 *              kill threshold (15% from anchor)    (clear danger marker)
 *
 * Both render as small downward-pointing trapezoids ("notch heads") with
 * a thin "stem" line dropping toward the track top — like indicators on
 * a real precision gauge. Stays out of the bar's way; the bar can do its
 * own thing underneath. */
const ThresholdNotch = styled.div`
  position: absolute;
  top: 0;
  ${(p) => {
    if (p.$type === "throw") return `left: 50%; transform: translateX(-50%);`;
    return p.$isRight
      ? `left: 15%;  transform: translateX(-50%);`
      : `right: 15%; transform: translateX(50%);`;
  }}
  width: ${(p) => (p.$type === "kill" ? "clamp(5px, 0.7cqh, 7px)" : "clamp(2px, 0.32cqh, 3px)")};
  height: clamp(7px, 1.1cqh, 10px);
  z-index: 3;
  pointer-events: none;

  background: ${(p) =>
    p.$type === "kill"
      ? `linear-gradient(180deg, ${C.vermillionBright} 0%, ${C.vermillion} 55%, ${C.vermillionDeep} 100%)`
      : `linear-gradient(180deg, #ffe56c 0%, ${C.gold} 60%, #c9a614 100%)`};
  border-radius: 1px 1px 1.5px 1.5px;
  box-shadow:
    inset 0 1px 0 ${(p) =>
      p.$type === "kill"
        ? "rgba(255, 200, 180, 0.55)"
        : "rgba(255, 252, 220, 0.6)"},
    0 1px 2px rgba(0, 0, 0, 0.7);
  /* Subtle outline so the notch reads cleanly against any fill state. */
  outline: 0.5px solid ${(p) =>
    p.$type === "kill"
      ? "rgba(138, 31, 18, 0.85)"
      : "rgba(0, 0, 0, 0.5)"};

  /* Quiet pulse halo on the kill notch — never on the throw notch.
   * Renders as a soft expanding ring. Subtle so it never feels like
   * the whole HUD is throbbing. */
  ${(p) =>
    p.$type === "kill" &&
    css`
      &::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 200%;
        height: 200%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(
          circle,
          ${C.vermillionGlow} 0%,
          rgba(216, 59, 39, 0) 60%
        );
        animation: ${killMarkerPulse} 1.6s ease-out infinite;
        pointer-events: none;
      }
    `}
`;

/* Rank plaque — tucked up close to the balance strip */
const SubBarRow = styled.div`
  display: flex;
  flex-direction: ${(p) => (p.$isRight ? "row-reverse" : "row")};
  align-items: center;
  gap: clamp(12px, 2cqw, 24px);
  margin-top: clamp(-4px, -0.4cqh, -2px);
  width: 100%;
`;

/* Row that holds the stamina bar + power-up icon side-by-side */
const BarRow = styled.div`
  display: flex;
  align-items: center;
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  gap: clamp(4px, 0.5cqw, 8px);
  width: 100%;
`;

/* Power-up panel — visibly DEMOTED from the stamina BarFrame.
 *
 * Previously this slot used the *same* chiseled treatment as the
 * BarFrame (gold leaf ring + ink underlayer + corner rivets), which
 * meant the HUD had two pieces of "premium hardware" competing for
 * the eye instead of one hero. The stamina bar is the hero; the
 * power-up slot is supporting hardware and should read as such.
 *
 * Stripped to:
 *   - single 1px cream-faint border (no double-band ring)
 *   - one quiet drop shadow (no gold halo)
 *   - inner shadow for the recessed inset feel (kept — it stops the
 *     icon from looking pasted on)
 *   - no corner rivets
 *
 * The slot's tinted background gradient + the icon do all the work
 * of communicating which power-up is equipped. */
const PowerUpSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${SLOT_SIZE};
  align-self: stretch;
  border-radius: 3px;
  box-sizing: border-box;
  position: relative;
  transition: all 0.25s ease;
  flex-shrink: 0;

  border: 1px solid rgba(245, 236, 217, 0.22);

  background: ${(p) => {
    if (!p.$active)
      return "linear-gradient(145deg, rgba(2, 2, 2, 0.97), rgba(6, 6, 6, 0.95), rgba(10, 10, 10, 0.92))";
    if (p.$cooldown)
      return "linear-gradient(135deg, #4a5568, #2d3748)";
    switch (p.$active) {
      case "speed":
        return "linear-gradient(135deg, #00d2ff, #0066cc)";
      case "power":
        return "linear-gradient(135deg, var(--edo-sakura, #ff8fa3), #dc2626)";
      case "snowball":
        return "linear-gradient(135deg, #e0f6ff, #87ceeb)";
      case "pumo_army":
        return "linear-gradient(135deg, #ffcc80, #ff8c00)";
      case "thick_blubber":
        return "linear-gradient(135deg, #9c88ff, #7c4dff)";
      default:
        return "linear-gradient(135deg, #6c757d, #343a40)";
    }
  }};

  box-shadow:
    0 clamp(2px, 0.18cqw, 4px) clamp(8px, 0.8cqw, 16px) rgba(0, 0, 0, 0.5),
    inset 0 1px 2px rgba(255, 255, 255, 0.05),
    inset 0 2px 4px rgba(0, 0, 0, 0.4);

  opacity: ${(p) => (p.$active ? 1 : 0.78)};

  img {
    width: 65%;
    height: auto;
    max-width: clamp(26px, 3.5cqw, 42px);
    max-height: clamp(26px, 3.5cqw, 42px);
    object-fit: contain;
    filter: ${(p) => (p.$cooldown ? "brightness(0.5) grayscale(0.35)" : "brightness(1)")};
    position: relative;
    z-index: 1;
  }
`;

const SnowballCountBadge = styled.div`
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: clamp(13px, 1.5cqw, 18px);
  height: clamp(13px, 1.5cqw, 18px);
  padding: 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 0.8cqw, 10px);
  line-height: 1;
  color: #fff;
  background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
  border: 1px solid rgba(168, 212, 255, 0.7);
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  z-index: 2;
  pointer-events: none;
`;

// ============================================
// CENTER ROUND INDICATOR — bare floating text
// ============================================

const CenterRound = styled.div`
  position: absolute;
  top: clamp(24px, 4cqh, 46px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  opacity: ${(p) => (p.$matchOver ? 0.7 : 1)};
  transition: opacity 260ms ease;
`;

// ============================================
// WIN/LOSS ROW — stones above player bars
// ============================================

/* P2's row uses row-reverse so the FIRST go-stone (index 0, the first
 * round won) sits closest to "PLAYER 2" — matching P1, where index 0
 * also sits closest to "PLAYER 1". Without this, P2's stones fill from
 * the center of the screen outward while P1's fill from the name
 * outward, breaking the mirrored symmetry across the HUD. */
const WinLossRow = styled.div`
  display: flex;
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  align-items: center;
  gap: clamp(3px, 0.4cqw, 6px);
  justify-content: ${(p) => (p.$isRight ? "flex-start" : "flex-end")};
`;

/* Traditional go-stones: white = win, black = loss.
 *
 * When a stone is freshly placed (round just ended), a one-shot ::after
 * ring expands outward like a stone being dropped on a goban — sells
 * the moment of round resolution without needing extra DOM. */
const GoStone = styled.div`
  width: clamp(9px, 1.3cqw, 17px);
  height: clamp(9px, 1.3cqw, 17px);
  border-radius: 50%;
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease;

  background: ${(p) => {
    if (p.$isEmpty)
      return "linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02))";
    return p.$isWin
      ? "radial-gradient(55% 55% at 32% 32%, #fff 0%, #f0f0f0 55%, #d8d8d8 100%)"
      : "radial-gradient(55% 55% at 32% 32%, #555 0%, #1a1a1a 55%, #050505 100%)";
  }};

  border: ${(p) => {
    if (p.$isEmpty) return "clamp(1.5px, 0.12cqw, 2.5px) solid rgba(255, 255, 255, 0.35)";
    return p.$isWin
      ? "clamp(2px, 0.16cqw, 4px) solid rgba(255, 255, 255, 0.9)"
      : "clamp(2px, 0.16cqw, 4px) solid rgba(255, 255, 255, 0.5)";
  }};

  box-shadow: ${(p) => {
    if (p.$isEmpty) return "inset 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 4px rgba(255, 255, 255, 0.08)";
    return p.$isWin
      ? "0 0 8px rgba(255, 255, 255, 0.65), 0 0 3px rgba(232, 197, 71, 0.4), inset 0 -1px 2px rgba(0, 0, 0, 0.15)"
      : "0 0 5px rgba(232, 197, 71, 0.32), 0 0 2px rgba(232, 197, 71, 0.22), inset 0 1px 3px rgba(60, 60, 60, 0.45)";
  }};

  animation: ${(p) =>
    p.$isWin && !p.$isEmpty ? pulseWin : "none"} 2s infinite;

  /* Place ripple — only renders when this stone was just dropped (the
   * parent tracks roundHistory length and passes $ripple to the newest
   * stone). The ::after expands outward and fades. */
  ${(p) =>
    p.$ripple &&
    css`
      &::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 2px solid
          ${p.$isWin
            ? "rgba(255, 255, 255, 0.85)"
            : "rgba(245, 236, 217, 0.55)"};
        box-shadow: 0 0 10px
          ${p.$isWin
            ? "rgba(255, 246, 194, 0.6)"
            : "rgba(232, 197, 71, 0.45)"};
        animation: ${stonePlaceRipple} 0.7s ease-out forwards;
        pointer-events: none;
      }
    `}
`;

/* Center round counter — uses the canonical theme gold (`C.gold` /
 * #e8c547) for the surrounding glow halos so the center indicator and
 * the chiseled bar frame ring speak the same gold tone.
 *
 * Halo intensities dialed back from the previous version so the round
 * counter no longer "blooms" against the dark backdrop above the
 * dohyo. Just one short ambient halo + the strong drop shadow that
 * lifts the digit off the scene. */
const RoundNum = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(28px, 5cqw, 72px);
  color: #fff;
  -webkit-text-stroke: clamp(1.5px, 0.2cqw, 3px) rgba(0, 0, 0, 0.9);
  text-shadow:
    0 0 12px rgba(232, 197, 71, 0.32),
    0 3px 8px rgba(0, 0, 0, 0.95);
  line-height: 1;
  user-select: none;
`;

const RoundText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 0.9cqw, 13px);
  color: rgba(232, 197, 71, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.25em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  margin-top: clamp(1px, 0.2cqh, 3px);
`;

// ============================================
// CONSTANTS
// ============================================

const LOW_STAMINA_WARNING_THRESHOLD = 25;

const clampStamina = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const clampBalance = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, n));
};

// ============================================
// COMPONENT
// ============================================

const UiPlayerInfo = ({
  roundHistory = [],
  roundId = 0,
  isPlayer1Local = true,
  player1Stamina,
  player1ActivePowerUp = null,
  player1SnowballCooldown = false,
  player1SnowballThrowsRemaining = null,
  player1PumoArmyCooldown = false,
  player1IsGassed = false,
  player1ParryRefund = 0,
  player1Balance = 100,
  player2Stamina,
  player2ActivePowerUp = null,
  player2SnowballCooldown = false,
  player2SnowballThrowsRemaining = null,
  player2PumoArmyCooldown = false,
  player2IsGassed = false,
  player2ParryRefund = 0,
  player2Balance = 100,
  matchOver = false,
}) => {
  const s1 = clampStamina(player1Stamina);
  const s2 = clampStamina(player2Stamina);
  const b1 = clampBalance(player1Balance);
  const b2 = clampBalance(player2Balance);
  const BALANCE_DANGER_THRESHOLD = 15;
  const b1Danger = b1 < BALANCE_DANGER_THRESHOLD;
  const b2Danger = b2 < BALANCE_DANGER_THRESHOLD;

  // ── Display stamina (throttled regen for smooth bar animation) ──
  const [p1DisplayStamina, setP1DisplayStamina] = useState(s1);
  const [p2DisplayStamina, setP2DisplayStamina] = useState(s2);
  const [p1LastDecreaseAt, setP1LastDecreaseAt] = useState(0);
  const [p2LastDecreaseAt, setP2LastDecreaseAt] = useState(0);
  const MAX_INCREASE_PER_UPDATE = 15;

  // ── Ghost bar — trailing damage indicator ("white health" system) ──
  const [p1Ghost, setP1Ghost] = useState(s1);
  const [p2Ghost, setP2Ghost] = useState(s2);
  const [p1GhostCatching, setP1GhostCatching] = useState(false);
  const [p2GhostCatching, setP2GhostCatching] = useState(false);
  const p1GhostTimer = useRef(null);
  const p2GhostTimer = useRef(null);
  const p1PrevStamina = useRef(s1);
  const p2PrevStamina = useRef(s2);
  const p1LastDecreaseAtRef = useRef(0);
  const p2LastDecreaseAtRef = useRef(0);


  // ── Regen indicator (green leading-edge glow) ──
  const [p1Regen, setP1Regen] = useState(false);
  const [p2Regen, setP2Regen] = useState(false);
  const p1RegenTimer = useRef(null);
  const p2RegenTimer = useRef(null);

  // ── Parry refund flash (instant green burst) ──
  const [p1ParryFlash, setP1ParryFlash] = useState(0);
  const [p2ParryFlash, setP2ParryFlash] = useState(0);
  const p1ParryRefundPending = useRef(false);
  const p2ParryRefundPending = useRef(false);

  // ── Gassed recovery ("second wind") ──
  const [p1Recovery, setP1Recovery] = useState(0);
  const [p2Recovery, setP2Recovery] = useState(0);
  const p1WasGassed = useRef(false);
  const p2WasGassed = useRef(false);
  const p1RecoveryPending = useRef(false);
  const p2RecoveryPending = useRef(false);

  // ── Impact feedback (heavy hits) ──
  // Bumping the impact counter remounts the ImpactSpark via `key` so its
  // animation runs fresh on every hit. p1Shake/p2Shake are booleans toggled
  // by a side-effect chain (false → next-frame true → 340ms later false) so
  // the BarFrame's CSS shake animation restarts cleanly on each hit instead
  // of getting stuck "running" across rapid back-to-back hits.
  const [p1Impact, setP1Impact] = useState(0);
  const [p2Impact, setP2Impact] = useState(0);
  const [p1Shake, setP1Shake] = useState(false);
  const [p2Shake, setP2Shake] = useState(false);
  const [p1ImpactStamina, setP1ImpactStamina] = useState(0);
  const [p2ImpactStamina, setP2ImpactStamina] = useState(0);
  const p1ShakeTimer = useRef(null);
  const p2ShakeTimer = useRef(null);
  // Min stamina drop (in points) needed to register as a "heavy" hit. Tuned
  // low enough that meaningful damage feels punchy, high enough that idle
  // drain (e.g. crouch holds losing 1 sta) doesn't constantly spark.
  const IMPACT_DROP_THRESHOLD = 4;

  // ── Go-stone place ripple ──
  // When roundHistory grows by one, the new stone (always the last one)
  // gets a one-shot expanding ring overlay. Both wings render the same
  // history, so both stones (winner's white, loser's black) ripple in sync.
  const [rippleStoneIdx, setRippleStoneIdx] = useState(-1);
  const prevRoundCount = useRef(roundHistory.length);

  useEffect(() => {
    if (player1ParryRefund > 0) {
      setP1ParryFlash(player1ParryRefund);
      p1ParryRefundPending.current = true;
    }
  }, [player1ParryRefund]);

  useEffect(() => {
    if (player2ParryRefund > 0) {
      setP2ParryFlash(player2ParryRefund);
      p2ParryRefundPending.current = true;
    }
  }, [player2ParryRefund]);

  // ── Post-reset throttle bypass ──
  // After a round reset, the first stamina update from the server may arrive
  // AFTER game_reset (race condition). This flag lets that first update snap
  // to the new value instead of being throttled by MAX_INCREASE_PER_UPDATE.
  const p1JustReset = useRef(false);
  const p2JustReset = useRef(false);

  // ── Round reset ──
  useEffect(() => {
    setP1DisplayStamina(s1);
    setP2DisplayStamina(s2);
    setP1Ghost(s1);
    setP2Ghost(s2);
    setP1GhostCatching(false);
    setP2GhostCatching(false);
    setP1Regen(false);
    setP2Regen(false);
    setP1LastDecreaseAt(0);
    setP2LastDecreaseAt(0);
    p1PrevStamina.current = s1;
    p2PrevStamina.current = s2;
    p1JustReset.current = true;
    p2JustReset.current = true;
    if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
    if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
    if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
    if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
    p1LastDecreaseAtRef.current = 0;
    p2LastDecreaseAtRef.current = 0;
    p1WasGassed.current = false;
    p2WasGassed.current = false;
    p1RecoveryPending.current = false;
    p2RecoveryPending.current = false;
    setP1Recovery(0);
    setP2Recovery(0);
    // Clear any in-flight shake / impact state so a new round starts clean.
    if (p1ShakeTimer.current) clearTimeout(p1ShakeTimer.current);
    if (p2ShakeTimer.current) clearTimeout(p2ShakeTimer.current);
    setP1Shake(false);
    setP2Shake(false);
  }, [roundId]);

  // ── Gassed → recovered transition detection ──
  useEffect(() => {
    if (!p1WasGassed.current && player1IsGassed) {
      setP1Ghost(0);
      setP1GhostCatching(false);
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
    }
    if (p1WasGassed.current && !player1IsGassed) {
      p1RecoveryPending.current = true;
      setP1Recovery((c) => c + 1);
    }
    p1WasGassed.current = player1IsGassed;
  }, [player1IsGassed]);

  useEffect(() => {
    if (!p2WasGassed.current && player2IsGassed) {
      setP2Ghost(0);
      setP2GhostCatching(false);
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
    }
    if (p2WasGassed.current && !player2IsGassed) {
      p2RecoveryPending.current = true;
      setP2Recovery((c) => c + 1);
    }
    p2WasGassed.current = player2IsGassed;
  }, [player2IsGassed]);

  // ── Shake retrigger on each impact ──
  // Force the CSS animation to restart on every hit by going through a
  // false → rAF(true) → setTimeout(false) cycle. The intermediate `false`
  // render is what makes the browser drop the previous animation instance
  // so the next `true` render starts a fresh one (rather than letting the
  // existing animation continue mid-cycle).
  useEffect(() => {
    if (p1Impact === 0) return undefined;
    setP1Shake(false);
    if (p1ShakeTimer.current) clearTimeout(p1ShakeTimer.current);
    const raf = requestAnimationFrame(() => setP1Shake(true));
    p1ShakeTimer.current = setTimeout(() => setP1Shake(false), 340);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [p1Impact]);

  useEffect(() => {
    if (p2Impact === 0) return undefined;
    setP2Shake(false);
    if (p2ShakeTimer.current) clearTimeout(p2ShakeTimer.current);
    const raf = requestAnimationFrame(() => setP2Shake(true));
    p2ShakeTimer.current = setTimeout(() => setP2Shake(false), 340);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [p2Impact]);

  // ── Stone ripple on round-end ──
  // Depend on length, not the array reference, so a new array prop with the
  // same content doesn't spuriously fire the ripple. When the match resets
  // (length shrinks), we just sync prevRoundCount without animating.
  useEffect(() => {
    const len = roundHistory.length;
    if (len > prevRoundCount.current) {
      setRippleStoneIdx(len - 1);
      const t = setTimeout(() => setRippleStoneIdx(-1), 800);
      prevRoundCount.current = len;
      return () => clearTimeout(t);
    }
    prevRoundCount.current = len;
    return undefined;
  }, [roundHistory.length]);

  // ── Player 1 stamina + ghost + regen ──
  useEffect(() => {
    const prev = p1PrevStamina.current;
    p1PrevStamina.current = s1;
    let next = s1;

    // After a round reset, snap immediately to the server value (bypass throttle)
    // BUT only if stamina didn't decrease — if it dropped, fall through to damage
    // logic so the ghost bar correctly trails the first hit
    if (p1JustReset.current) {
      p1JustReset.current = false;
      if (s1 >= prev) {
        setP1DisplayStamina(s1);
        setP1Ghost(s1);
        return;
      }
    }

    if (s1 < prev) {
      // ▼ DAMAGE — stamina decreased
      const now = Date.now();
      setP1LastDecreaseAt(now);
      p1LastDecreaseAtRef.current = now;
      // Heavy-hit feedback: spark + frame shake on meaningful drops only
      const drop = prev - s1;
      if (drop >= IMPACT_DROP_THRESHOLD) {
        setP1ImpactStamina(s1);
        setP1Impact((k) => k + 1);
      }
      // Ghost stays high (captures "where stamina was" before this drain sequence)
      setP1Ghost((g) => Math.max(g, p1DisplayStamina));
      setP1GhostCatching(false);
      // Schedule ghost catch-up after a visible delay
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
      const closureS1 = s1;
      const scheduleGhostCatchUp = (delay = 700) => {
        p1GhostTimer.current = setTimeout(() => {
          // During continuous drain (e.g. grab push), don't catch up mid-sequence — reschedule
          const elapsed = Date.now() - p1LastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP1GhostCatching(true);
          setP1Ghost(closureS1);
        }, delay);
      };
      scheduleGhostCatchUp(700);
      // Clear regen state
      setP1Regen(false);
      if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
    } else if (s1 > prev) {
      // ▲ REGEN — stamina increased
      // Ghost catches up so it doesn't show false damage ahead of the fill
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
      setP1GhostCatching(false);
      setP1Ghost(Math.min(s1, p1DisplayStamina));
      // Show regen glow (stays on for 500ms after last regen tick)
      setP1Regen(true);
      if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
      p1RegenTimer.current = setTimeout(() => setP1Regen(false), 500);
    }

    // Parry refund bypass: snap instantly, skip all throttling
    if (p1ParryRefundPending.current && s1 > prev) {
      p1ParryRefundPending.current = false;
      setP1DisplayStamina(s1);
      setP1Ghost(s1);
      return;
    }

    // Gassed recovery bypass: snap to new stamina when "second wind" kicks in
    if (p1RecoveryPending.current && s1 > prev) {
      p1RecoveryPending.current = false;
      setP1DisplayStamina(s1);
      setP1Ghost(s1);
      return;
    }

    // Throttle regen display (prevents jarring jumps after recent damage)
    const justDecreased =
      Date.now() - p1LastDecreaseAt < 600 || p1DisplayStamina === 0;
    if (next - p1DisplayStamina > 25 && justDecreased) {
      next = p1DisplayStamina;
    }
    if (next > p1DisplayStamina) {
      next = Math.min(next, p1DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP1DisplayStamina(next);

    return () => {
      if (p1GhostTimer.current) {
        clearTimeout(p1GhostTimer.current);
        p1GhostTimer.current = null;
      }
    };
  }, [s1]);

  // ── Player 2 stamina + ghost + regen ──
  useEffect(() => {
    const prev = p2PrevStamina.current;
    p2PrevStamina.current = s2;
    let next = s2;

    // After a round reset, snap immediately to the server value (bypass throttle)
    // BUT only if stamina didn't decrease — if it dropped, fall through to damage
    // logic so the ghost bar correctly trails the first hit
    if (p2JustReset.current) {
      p2JustReset.current = false;
      if (s2 >= prev) {
        setP2DisplayStamina(s2);
        setP2Ghost(s2);
        return;
      }
    }

    if (s2 < prev) {
      // ▼ DAMAGE
      const now = Date.now();
      setP2LastDecreaseAt(now);
      p2LastDecreaseAtRef.current = now;
      const drop = prev - s2;
      if (drop >= IMPACT_DROP_THRESHOLD) {
        setP2ImpactStamina(s2);
        setP2Impact((k) => k + 1);
      }
      setP2Ghost((g) => Math.max(g, p2DisplayStamina));
      setP2GhostCatching(false);
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
      const closureS2 = s2;
      const scheduleGhostCatchUp = (delay = 700) => {
        p2GhostTimer.current = setTimeout(() => {
          // During continuous drain (e.g. grab push), don't catch up mid-sequence — reschedule
          const elapsed = Date.now() - p2LastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP2GhostCatching(true);
          setP2Ghost(closureS2);
        }, delay);
      };
      scheduleGhostCatchUp(700);
      setP2Regen(false);
      if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
    } else if (s2 > prev) {
      // ▲ REGEN
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
      setP2GhostCatching(false);
      setP2Ghost(Math.min(s2, p2DisplayStamina));
      setP2Regen(true);
      if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
      p2RegenTimer.current = setTimeout(() => setP2Regen(false), 500);
    }

    // Parry refund bypass: snap instantly, skip all throttling
    if (p2ParryRefundPending.current && s2 > prev) {
      p2ParryRefundPending.current = false;
      setP2DisplayStamina(s2);
      setP2Ghost(s2);
      return;
    }

    // Gassed recovery bypass: snap to new stamina when "second wind" kicks in
    if (p2RecoveryPending.current && s2 > prev) {
      p2RecoveryPending.current = false;
      setP2DisplayStamina(s2);
      setP2Ghost(s2);
      return;
    }

    const justDecreased =
      Date.now() - p2LastDecreaseAt < 600 || p2DisplayStamina === 0;
    if (next - p2DisplayStamina > 25 && justDecreased) {
      next = p2DisplayStamina;
    }
    if (next > p2DisplayStamina) {
      next = Math.min(next, p2DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP2DisplayStamina(next);

    return () => {
      if (p2GhostTimer.current) {
        clearTimeout(p2GhostTimer.current);
        p2GhostTimer.current = null;
      }
    };
  }, [s2]);


  // ── Derived match state ──
  const currentRound = Math.min(roundHistory.length + 1, 3);

  const renderCenterMarks = (playerName) => {
    const marks = [];
    const maxRounds = 3;
    for (let i = 0; i < maxRounds; i++) {
      if (i < roundHistory.length) {
        const isWin = roundHistory[i] === playerName;
        // The ripple flag stays on for ~800ms after the stone is placed.
        // We pass a stable key (`r-${i}`) so the stone itself doesn't
        // remount when ripple turns off — the ::after pseudo just stops
        // rendering, leaving the stone in place.
        marks.push(
          <GoStone
            key={`r-${i}`}
            $isWin={isWin}
            $isEmpty={false}
            $ripple={i === rippleStoneIdx}
          />
        );
      } else {
        marks.push(
          <GoStone key={`e-${i}`} $isWin={false} $isEmpty={true} />
        );
      }
    }
    return marks;
  };

  const shouldShowLowStaminaWarning = (stamina) =>
    stamina < LOW_STAMINA_WARNING_THRESHOLD;

  const getPowerUpIsOnCooldown = (
    powerUpType,
    snowballCooldown,
    pumoArmyCooldown
  ) => {
    switch (powerUpType) {
      case "snowball":
        return snowballCooldown;
      case "pumo_army":
        return pumoArmyCooldown;
      default:
        return false;
    }
  };

  const getPowerUpIcon = (powerUpType) => {
    switch (powerUpType) {
      case "speed": return happyFeetIcon;
      case "power": return powerWaterIcon;
      case "snowball": return snowballImage;
      case "pumo_army": return pumoArmyIcon;
      case "thick_blubber": return thickBlubberIcon;
      default: return "";
    }
  };

  const p1Danger = shouldShowLowStaminaWarning(p1DisplayStamina);
  const p2Danger = shouldShowLowStaminaWarning(p2DisplayStamina);

  return (
    <HudShell $matchOver={matchOver}>
      {/* ═══ PLAYER 1 — East (Higashi) ═══ */}
      <PlayerWing $matchOver={matchOver}>
        <NameBanner $isRight={false}>
          <WinLossRow $isRight={false}>
            {renderCenterMarks("player1")}
          </WinLossRow>
          <NameBlock $isRight={false}>
            <FighterName>PLAYER 1</FighterName>
          </NameBlock>
          <BarRowSpacer />
        </NameBanner>

        <BarRow $isRight={false}>
          <GaugeStack>
            <BarFrame
              $danger={p1Danger}
              $gassed={player1IsGassed}
              $shake={p1Shake}
              $isRight={false}
              $matchOver={matchOver}
            >
              <BarTrack $isRight={false}>
                {isPlayer1Local && <YouLabel $isRight={false}>You</YouLabel>}
                <BarFill
                  $stamina={p1DisplayStamina}
                  $danger={p1Danger}
                  $isRight={false}
                />
                {!player1IsGassed && !p1Danger && (
                  <FillMotes
                    $stamina={p1DisplayStamina}
                    $isRight={false}
                  />
                )}
                {!player1IsGassed && (
                  <BarGhost
                    $stamina={p1Ghost}
                    $catching={p1GhostCatching}
                    $isRight={false}
                  />
                )}
                {p1Regen && !player1IsGassed && (
                  <RegenGlow
                    $stamina={p1DisplayStamina}
                    $isRight={false}
                  />
                )}
                {player1IsGassed && (
                  <GassedOverlay $matchOver={matchOver}>
                    <GassedText>GASSED</GassedText>
                  </GassedOverlay>
                )}
                {p1Impact > 0 && !player1IsGassed && (
                  <ImpactSpark
                    key={`p1-impact-${p1Impact}`}
                    $stamina={p1ImpactStamina}
                    $isRight={false}
                  />
                )}
                {p1ParryFlash > 0 && !player1IsGassed && (
                  <ParryRefundFlash
                    key={p1ParryFlash}
                    $stamina={p1DisplayStamina}
                    $isRight={false}
                  />
                )}
                {p1Recovery > 0 && (
                  <RecoveryFlash key={`r1-${p1Recovery}`}>
                    <RecoveryText>SECOND WIND</RecoveryText>
                  </RecoveryFlash>
                )}
                <StaTickMark $pct={25} />
                <StaTickMark $pct={50} />
                <StaTickMark $pct={75} />
              </BarTrack>
            </BarFrame>
            <BalStripWrap
              $isRight={false}
              $danger={b1Danger}
              $matchOver={matchOver}
            >
              <BalLabel>BAL</BalLabel>
              <BalTrackOuter>
                <BalTrack>
                  <BalFill $balance={b1} $danger={b1Danger} $isRight={false} />
                </BalTrack>
                <ThresholdNotch $type="throw" />
                <ThresholdNotch $type="kill" $isRight={false} />
              </BalTrackOuter>
            </BalStripWrap>
          </GaugeStack>
          <PowerUpSlot
            $active={player1ActivePowerUp}
            $cooldown={getPowerUpIsOnCooldown(
              player1ActivePowerUp,
              player1SnowballCooldown,
              player1PumoArmyCooldown
            )}
          >
            {player1ActivePowerUp && (
              <img
                src={getPowerUpIcon(player1ActivePowerUp)}
                alt={player1ActivePowerUp}
              />
            )}
            {player1ActivePowerUp === "snowball" &&
              Number.isFinite(player1SnowballThrowsRemaining) && (
                <SnowballCountBadge>
                  {Math.max(0, player1SnowballThrowsRemaining)}
                </SnowballCountBadge>
              )}
          </PowerUpSlot>
        </BarRow>

        <SubBarRow $isRight={false}>
          <BarRowSpacer />
          <RankPlaque>
            <RankText>JONOKUCHI</RankText>
          </RankPlaque>
        </SubBarRow>
      </PlayerWing>

      {/* ═══ CENTER ROUND ═══ */}
      <CenterRound $matchOver={matchOver}>
        <RoundNum>{currentRound}</RoundNum>
        <RoundText>ROUND</RoundText>
      </CenterRound>

      {/* ═══ PLAYER 2 — West (Nishi) ═══ */}
      <PlayerWing $matchOver={matchOver}>
        <NameBanner $isRight={true}>
          <WinLossRow $isRight={true}>
            {renderCenterMarks("player2")}
          </WinLossRow>
          <NameBlock $isRight={true}>
            <FighterName>PLAYER 2</FighterName>
          </NameBlock>
          <BarRowSpacer />
        </NameBanner>

        <BarRow $isRight={true}>
          <GaugeStack>
            <BarFrame
              $danger={p2Danger}
              $gassed={player2IsGassed}
              $shake={p2Shake}
              $isRight={true}
              $matchOver={matchOver}
            >
              <BarTrack $isRight={true}>
                {!isPlayer1Local && <YouLabel $isRight={true}>You</YouLabel>}
                <BarFill
                  $stamina={p2DisplayStamina}
                  $danger={p2Danger}
                  $isRight={true}
                />
                {!player2IsGassed && !p2Danger && (
                  <FillMotes
                    $stamina={p2DisplayStamina}
                    $isRight={true}
                  />
                )}
                {!player2IsGassed && (
                  <BarGhost
                    $stamina={p2Ghost}
                    $catching={p2GhostCatching}
                    $isRight={true}
                  />
                )}
                {p2Regen && !player2IsGassed && (
                  <RegenGlow
                    $stamina={p2DisplayStamina}
                    $isRight={true}
                  />
                )}
                {player2IsGassed && (
                  <GassedOverlay $matchOver={matchOver}>
                    <GassedText>GASSED</GassedText>
                  </GassedOverlay>
                )}
                {p2Impact > 0 && !player2IsGassed && (
                  <ImpactSpark
                    key={`p2-impact-${p2Impact}`}
                    $stamina={p2ImpactStamina}
                    $isRight={true}
                  />
                )}
                {p2ParryFlash > 0 && !player2IsGassed && (
                  <ParryRefundFlash
                    key={p2ParryFlash}
                    $stamina={p2DisplayStamina}
                    $isRight={true}
                  />
                )}
                {p2Recovery > 0 && (
                  <RecoveryFlash key={`r2-${p2Recovery}`}>
                    <RecoveryText>SECOND WIND</RecoveryText>
                  </RecoveryFlash>
                )}
                <StaTickMark $pct={25} />
                <StaTickMark $pct={50} />
                <StaTickMark $pct={75} />
              </BarTrack>
            </BarFrame>
            <BalStripWrap
              $isRight={true}
              $danger={b2Danger}
              $matchOver={matchOver}
            >
              <BalLabel>BAL</BalLabel>
              <BalTrackOuter>
                <BalTrack>
                  <BalFill $balance={b2} $danger={b2Danger} $isRight={true} />
                </BalTrack>
                <ThresholdNotch $type="throw" />
                <ThresholdNotch $type="kill" $isRight={true} />
              </BalTrackOuter>
            </BalStripWrap>
          </GaugeStack>
          <PowerUpSlot
            $active={player2ActivePowerUp}
            $cooldown={getPowerUpIsOnCooldown(
              player2ActivePowerUp,
              player2SnowballCooldown,
              player2PumoArmyCooldown
            )}
          >
            {player2ActivePowerUp && (
              <img
                src={getPowerUpIcon(player2ActivePowerUp)}
                alt={player2ActivePowerUp}
              />
            )}
            {player2ActivePowerUp === "snowball" &&
              Number.isFinite(player2SnowballThrowsRemaining) && (
                <SnowballCountBadge>
                  {Math.max(0, player2SnowballThrowsRemaining)}
                </SnowballCountBadge>
              )}
          </PowerUpSlot>
        </BarRow>

        <SubBarRow $isRight={true}>
          <BarRowSpacer />
          <RankPlaque>
            <RankText>JONOKUCHI</RankText>
          </RankPlaque>
        </SubBarRow>
      </PlayerWing>
    </HudShell>
  );
};

UiPlayerInfo.propTypes = {
  roundHistory: PropTypes.array,
  roundId: PropTypes.number,
  isPlayer1Local: PropTypes.bool,
  player1Stamina: PropTypes.number,
  player1ActivePowerUp: PropTypes.string,
  player1SnowballCooldown: PropTypes.bool,
  player1SnowballThrowsRemaining: PropTypes.number,
  player1PumoArmyCooldown: PropTypes.bool,
  player1IsGassed: PropTypes.bool,
  player1ParryRefund: PropTypes.number,
  player1Balance: PropTypes.number,
  player2Stamina: PropTypes.number,
  player2ActivePowerUp: PropTypes.string,
  player2SnowballCooldown: PropTypes.bool,
  player2SnowballThrowsRemaining: PropTypes.number,
  player2PumoArmyCooldown: PropTypes.bool,
  player2IsGassed: PropTypes.bool,
  player2ParryRefund: PropTypes.number,
  player2Balance: PropTypes.number,
  matchOver: PropTypes.bool,
};

export default React.memo(UiPlayerInfo);
