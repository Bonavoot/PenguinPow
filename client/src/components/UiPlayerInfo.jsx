import PropTypes from "prop-types";
import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import flapIcon from "../assets/flap-icon.png";
import shatterPalmIcon from "../assets/shatter-palm-icon.png";
import {
  C,
  FONT_DISPLAY,
  FONT_KANJI,
  FONT_RENDER,
  FONT_UI,
  FONT_WEIGHT,
  TEXT_SHADOW_COMBAT,
  TEXT_SHADOW_DISPLAY,
  TEXT_SHADOW_UI,
  TRACK,
} from "./menuTheme";
import BalanceGauge from "./BalanceGauge";

/*
 * Pumo Pumo HUD — "Ice Dohyo Broadcast" chrome.
 *
 * Palette: ink / cream / gold / ice / stam / vermillion (menuTheme).
 * Lacquered sumi plates + gold-leaf hairlines + frost edge catches.
 *
 * Stamina fill is smooth jade liquid (stam*) — vitality you spend.
 * Posture is a compact secondary ice meter with throw/kill notches
 * (ice → gold → vermillion) — composure for grabs. Danger / gassed stay
 * vermillion.
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

/* Subtle danger pulse — modulates the frame border opacity gently when
 * stamina is critical. Was a multi-layer red glow halo for the old
 * chiseled gold-ring frame; with the minimalist hairline border, the
 * border color (vermillionBright at $danger) is the alarm signal,
 * and this pulse just breathes the brightness so the bar doesn't sit
 * dead at the danger threshold. Same brightness/saturation approach
 * the gassed pulse uses, slightly punchier amplitude since $danger
 * fires at higher stamina than $gassed. */
const dangerFramePulse = keyframes`
  0%, 100% { filter: brightness(1)    saturate(1); }
  50%      { filter: brightness(1.18) saturate(1.2); }
`;

/* Quick pulse alarm — strobes the red wash dim → bright → dim on a
 * fast cadence, like an actual warning indicator light blinking. Uses
 * brightness + saturation modulation so the underlying red stays
 * solid (the lane never fades to transparent) but its luminance
 * pulses dramatically.
 *
 * Replaces the previous slow opacity breath. That recipe animated
 * the overlay's alpha from 0.6 → 0.92, which during the dim phase
 * let the empty stamina bar bleed through underneath. Reading "the
 * red overlay is fading away" works against the alarm intent — the
 * overlay isn't going anywhere, the wrestler is still gassed.
 *
 * Brightness ramps 0.78 (dim drained crimson) ↔ 1.42 (vibrant alarm
 * vermillion) with a coordinated saturation lift at the peak so the
 * red actually feels hot at the apex rather than just lighter. The
 * combination reads as a single strobing surface rather than a
 * surface that's fading in and out. */
const gassedAlarmPulse = keyframes`
  0%, 100% { filter: brightness(0.72) saturate(0.92); }
  50%      { filter: brightness(1.02) saturate(1); }
`;

/* Subtle vermillion frame intensity pulse when gassed.
 *
 * Replaces the previous multi-layer red glow halo (4 stacked box-shadows
 * fanning red light up to 48px out from the bar). That was loud but
 * read as "the bar is leaking red gas" rather than "the wrestler is in
 * danger". The new approach colors the FRAME ITSELF vermillion (handled
 * directly in BarFrame's box-shadow ramp), and this keyframe just
 * gently breathes the intensity of that vermillion ring — slow heartbeat
 * cadence, narrow alpha range, no outer glow blooming.
 *
 * The dramatic alarm signal is the COLOR SHIFT of the hardware (gold →
 * vermillion). The pulse is just life on top of that shift. */
const gassedFramePulse = keyframes`
  0%, 100% { filter: brightness(1) saturate(1); }
  50%      { filter: brightness(1.12) saturate(1.15); }
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

/* Subtle vertical wobble on the fill's top edge — tells the eye "this is alive" */
const fillWobble = keyframes`
  0%, 100% { transform: translateY(0)    scaleY(1);     }
  50%      { transform: translateY(-0.5px) scaleY(1.02); }
`;

/* Impact strike — a thin sharp vertical hairline at the trailing edge of
 * the stamina fill. Replaces the previous radial-blob ImpactSpark which
 * (a) lagged behind the bar's width transition because it was positioned
 * by data-value while the bar animated, and (b) read as a soft AI-style
 * white smudge instead of a designed mark. The new strike is mounted as
 * a CHILD of BarFill, pinned to the parent's trailing edge — so it
 * tracks the bar's animated width pixel-perfect with no transition
 * mismatch. Single quick squeeze + fade, no blur, no mix-blend-mode. */
const impactStrike = keyframes`
  0% {
    opacity: 0.95;
    transform: scaleY(1);
  }
  100% {
    opacity: 0;
    transform: scaleY(0.6);
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

/* Slow horizontal drift on the gassed slash overlay — keeps the strain
 * pattern alive without being twitchy.
 *
 * IMPORTANT — implementation note. This used to animate
 * `background-position-x` on the gradient itself, which had two
 * problems on the gassed lane:
 *
 *   1) Layer thrash. The parent (GassedBackdrop) is already animating
 *      a `filter` (gassedAlarmPulse, 0.78s) and the BarFrame above
 *      that is animating ANOTHER `filter` (gassedFramePulse, 1.6s).
 *      Both filters force composited layers. Animating background-
 *      position on a descendant of those layers forces a full repaint
 *      of the filtered surface every frame, which the compositor
 *      then re-rasterizes with the active filter. The result on
 *      lower-end machines and even on capable ones is a frame-rate-
 *      coupled wobble — the slashes appear to micro-stutter or
 *      "glitch" in time with the strobe.
 *
 *   2) Subpixel resampling. background-position interpolation feeds
 *      a fractional offset into the gradient, which the renderer
 *      re-samples on each paint. The resampled bands subtly shift
 *      between adjacent paints and read as flicker on the thin
 *      (3px) slash strokes.
 *
 * Switched to `transform: translate3d` on a widened ::before. The
 * gradient itself never moves relative to the ::before — the
 * RASTERIZED ::before layer is shifted by the compositor, which is
 * (a) GPU-accelerated, (b) does not repaint, (c) does not re-sample
 * the gradient, and (d) does not collide with the parent's filter
 * compositing. Loop math is identical: -22px ≈ one full X-period of
 * the -55deg / 18px-axis stripe pattern, so the visible window at
 * translateX(-22px) matches translateX(0) and the loop is seamless. */
const gassedSlashDrift = keyframes`
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-22px, 0, 0); }
`;

/* Hanko stamp impression for the GASSED text plate — single landing.
 * Quick scale-down from oversized + tiny rotation settle, like a real
 * vermillion seal being pressed onto paper. After the stamp lands it
 * sits still — no infinite pulse, no droop. The stamp IS the alarm. */
const gassedStamp = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.6) rotate(-6deg);
  }
  60% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.92) rotate(-2deg);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(-3deg);
  }
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

// Shared vertical rhythm between HUD strips (stamina ↔ balance, name row ↔ stamina).
const gaugeStripGap = "clamp(8px, 1cqh, 14px)";

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
  padding-top: clamp(24px, 3cqh, 34px);
  opacity: ${(p) => (p.$matchOver ? 0.88 : 1)};
  filter: ${(p) =>
    p.$matchOver
      ? "saturate(0.84) brightness(0.86) contrast(0.97)"
      : "none"};
  /* No transform shift on matchOver. Previous pass added a 2px
     translateY downshift as a "stepped back" cue, but combined
     with the dimming below it produced a visible un-gradient'd
     strip at the very top of the screen — the gradient appeared
     to detach from the screen edge. The opacity + filter desat
     alone are enough to communicate the match-over state, and
     the gradient stays flush with the top edge where it belongs. */
  transition:
    opacity 260ms ease,
    filter 260ms ease;

  background:
    /* Cool frost wash — ties the letterbox to the ice dohyo instead of
       a generic black cinema bar. */
    linear-gradient(
      180deg,
      rgba(18, 32, 48, 0.22) 0%,
      rgba(12, 22, 36, 0.1) 28%,
      transparent 62%
    ),
    linear-gradient(
      180deg,
      rgba(6, 8, 14, 0.92) 0%,
      rgba(6, 8, 14, 0.78) 18%,
      rgba(6, 8, 14, 0.48) 46%,
      rgba(6, 8, 14, 0.2) 72%,
      rgba(6, 8, 14, 0.06) 88%,
      transparent 100%
    );

  /* Thin gold-leaf rule at the very top — broadcast frame, not a panel. */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 8%;
    right: 8%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(232, 197, 71, 0.15) 18%,
      rgba(232, 197, 71, 0.42) 50%,
      rgba(232, 197, 71, 0.15) 82%,
      transparent 100%
    );
    pointer-events: none;
  }
`;

// ============================================
// PLAYER WING  (one per side)
// ============================================

const PlayerWing = styled.div`
  flex: 0 1 48%;
  max-width: min(560px, 45%);
  display: flex;
  flex-direction: column;
  gap: 0;
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
  margin-bottom: ${gaugeStripGap};
`;

const NameBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: ${(p) => (p.$isRight ? "flex-end" : "flex-start")};
  align-self: ${(p) => (p.$alignToMarkBottom ? "flex-end" : "auto")};
  min-width: 0;
  flex: 1;
`;

const FighterName = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(11px, 1.55cqw, 19px);
  color: ${C.cream};
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ============================================
// RANK PLAQUE — sumo banzuke-style ranking plate
// ============================================

/* Sumo banzuke plate — lacquered ink with a gold-leaf hairline.
 *
 * Side ornaments are thin gold ticks (not brackets / rivets) so the
 * plate reads as a printed banzuke entry without competing with the
 * stamina bar for "premium hardware" attention. */
const RankPlaque = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(5px, 0.55cqw, 9px);
  padding: ${(p) =>
    p.$compact
      ? "clamp(3px, 0.4cqh, 6px) clamp(8px, 1cqw, 14px)"
      : "clamp(4px, 0.55cqh, 8px) clamp(12px, 1.5cqw, 22px)"};
  position: relative;

  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 2px,
      rgba(245, 236, 217, 0.028) 2px,
      rgba(245, 236, 217, 0.028) 3px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 4px,
      rgba(245, 236, 217, 0.018) 4px,
      rgba(245, 236, 217, 0.018) 5px
    ),
    linear-gradient(
      180deg,
      rgba(22, 28, 40, 0.96) 0%,
      rgba(12, 16, 26, 0.98) 48%,
      rgba(8, 10, 18, 0.96) 100%
    );
  border-radius: 3px;
  border: 1px solid rgba(232, 197, 71, 0.42);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 246, 210, 0.14),
    inset 0 -1px 3px rgba(0, 0, 0, 0.4);

  &::before,
  &::after {
    content: "";
    width: 2px;
    height: 55%;
    border-radius: 1px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(232, 197, 71, 0.55) 30%,
      rgba(232, 197, 71, 0.75) 50%,
      rgba(232, 197, 71, 0.55) 70%,
      transparent 100%
    );
    flex-shrink: 0;
  }
`;

const RankText = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(10px, 1.2cqw, 14px);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  line-height: 1;
  ${FONT_RENDER}
  text-shadow:
    ${TEXT_SHADOW_UI},
    0 0 8px rgba(232, 197, 71, 0.18);
  white-space: nowrap;
`;

// ============================================
// STAMINA BAR  — THE HERO OF THE HUD
// ============================================

/* Stamina bar frame — lacquered track with a frost/gold hairline.
 *
 * Deliberately NOT the old chiseled brass ring + corner rivets. Those
 * read as arcade-cabinet cosplay. This is a tighter broadcast gauge:
 * cream/ice hairline by default, vermillion when gassed/danger, inset
 * catch-light so the bar lifts off the dohyo, quiet L-brackets at the
 * outer corners for a ceremonial frame without hardware clutter.
 *
 * Fill + impact strike + gassed overlay still carry the bar's identity;
 * the frame just stops looking like a placeholder rectangle. */
const shoveWinPulse = keyframes`
  0%, 100% { filter: brightness(1) saturate(1); }
  50% { filter: brightness(1.12) saturate(1.15); }
`;

const ShoveLeadTag = styled.div`
  position: absolute;
  top: 50%;
  ${(p) => (p.$isRight ? "left: 6px;" : "right: 6px;")}
  transform: translateY(-50%);
  z-index: 4;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(7px, 0.78cqw, 9px);
  letter-spacing: ${TRACK.meta};
  line-height: 1;
  pointer-events: none;
  user-select: none;
  color: ${(p) =>
    p.$lead > 0
      ? "rgba(255, 236, 170, 0.95)"
      : p.$lead < 0
        ? "rgba(255, 170, 150, 0.92)"
        : "rgba(210, 220, 230, 0.88)"};
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_UI};
`;

const BarFrame = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 4px;
  border: 1.5px solid ${(p) =>
    p.$gassed
      ? "rgba(216, 59, 39, 0.95)"
      : p.$danger
        ? "rgba(238, 81, 65, 0.85)"
        : p.$shoveLead > 0
          ? "rgba(232, 197, 71, 0.92)"
          : p.$shoveLead < 0
            ? "rgba(200, 120, 100, 0.75)"
            : p.$shoveLead === 0 && p.$shoveActive
              ? "rgba(170, 190, 210, 0.65)"
              : "rgba(232, 197, 71, 0.38)"};
  box-shadow:
    0 clamp(2px, 0.18cqw, 4px) clamp(10px, 0.85cqw, 18px) rgba(0, 0, 0, 0.58),
    0 0 0 1px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 246, 210, 0.16),
    inset 0 -1px 0 rgba(0, 0, 0, 0.35);
  opacity: ${(p) => (p.$matchOver ? 0.95 : 1)};
  transition: border-color 240ms ease, opacity 220ms ease, box-shadow 240ms ease;
  overflow: visible;

  /* Quiet corner brackets — outer corners only (away from center screen). */
  &::before,
  &::after {
    content: "";
    position: absolute;
    width: clamp(7px, 0.7cqw, 11px);
    height: clamp(7px, 0.7cqw, 11px);
    pointer-events: none;
    z-index: 3;
    opacity: ${(p) => (p.$gassed || p.$danger ? 0.35 : 0.7)};
    border-color: ${(p) =>
      p.$gassed || p.$danger
        ? "rgba(238, 81, 65, 0.85)"
        : "rgba(232, 197, 71, 0.7)"};
    border-style: solid;
    border-width: 0;
  }

  ${(p) =>
    p.$isRight
      ? css`
          &::before {
            top: -1px;
            right: -1px;
            border-top-width: 1.5px;
            border-right-width: 1.5px;
            border-top-right-radius: 3px;
          }
          &::after {
            bottom: -1px;
            right: -1px;
            border-bottom-width: 1.5px;
            border-right-width: 1.5px;
            border-bottom-right-radius: 3px;
          }
        `
      : css`
          &::before {
            top: -1px;
            left: -1px;
            border-top-width: 1.5px;
            border-left-width: 1.5px;
            border-top-left-radius: 3px;
          }
          &::after {
            bottom: -1px;
            left: -1px;
            border-bottom-width: 1.5px;
            border-left-width: 1.5px;
            border-bottom-left-radius: 3px;
          }
        `}

  ${(p) => {
    const gassedDur = p.$matchOver ? "2.4s" : "1.6s";
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
    if (p.$shoveLead > 0 && !p.$matchOver) {
      return css`animation: ${shoveWinPulse} 0.9s ease-in-out infinite;`;
    }
    return "";
  }}
`;

/* Dark inner track — stamina gauge with a quiet jade well tint */
const BarTrack = styled.div`
  position: relative;
  width: 100%;
  height: clamp(22px, 4cqh, 40px);
  border-radius: 3px;
  overflow: hidden;

  background:
    linear-gradient(
      180deg,
      rgba(61, 184, 106, 0.06) 0%,
      transparent 45%
    ),
    linear-gradient(
      ${(p) => (p.$isRight ? "280deg" : "100deg")},
      rgba(4, 6, 12, 0.98) 0%,
      rgba(8, 10, 16, 0.96) 50%,
      rgba(12, 14, 22, 0.94) 100%
    );
  box-shadow:
    inset 0 2px 7px rgba(0, 0, 0, 0.65),
    inset 0 -1px 3px rgba(0, 0, 0, 0.3);
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

/* Smooth jade stamina fill — liquid energy vs posture's stance plates.
 *
 * Bright enough to read as vitality, without a heavy neon bloom.
 * Regen overlays still punch via success* flashes on top.
 *
 * Danger: vermillion ramp (unchanged semantics). */
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
        ? "linear-gradient(90deg, #8f1515 0%, #c41e1e 35%, #e23a3a 70%, #f07171 100%)"
        : "linear-gradient(90deg, #f07171 0%, #e23a3a 30%, #c41e1e 65%, #8f1515 100%)"
      : p.$isRight
        ? `linear-gradient(90deg, ${C.stamMid} 0%, ${C.stam} 45%, ${C.stamBright} 100%)`
        : `linear-gradient(90deg, ${C.stamBright} 0%, ${C.stam} 55%, ${C.stamMid} 100%)`};

  box-shadow: ${(p) =>
    p.$danger
      ? "inset 0 1px 0 rgba(255, 200, 190, 0.28), inset 0 -2px 4px rgba(80, 10, 10, 0.35), inset 0 0 5px rgba(255, 100, 100, 0.18)"
      : `inset 0 1px 0 rgba(220, 255, 236, 0.35), inset 0 -1px 3px rgba(10, 60, 30, 0.2), 0 0 5px ${C.stamGlow}`};

  animation: ${(p) =>
    p.$danger
      ? css`${flashRedPulse} 0.6s ease-in-out infinite`
      : css`${fillWobble} 2.4s ease-in-out infinite`};

  /* Soft mint catch on the upper lip. */
  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 40%;
    background: linear-gradient(
      180deg,
      rgba(230, 255, 240, 0.3) 0%,
      rgba(95, 217, 138, 0.08) 55%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  /* Soft energy sweep. */
  &::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    width: 34%;
    background: linear-gradient(
      103deg,
      transparent 0%,
      transparent 32%,
      rgba(200, 255, 220, 0.12) 44%,
      rgba(255, 255, 255, 0.16) 50%,
      rgba(200, 255, 220, 0.12) 56%,
      transparent 68%,
      transparent 100%
    );
    animation: ${emberShimmer} 3.6s ease-in-out infinite;
    animation-delay: ${(p) => (p.$isRight ? "2s" : "0s")};
    pointer-events: none;
    opacity: ${(p) => (p.$danger ? 0 : 1)};
  }
`;

/* Impact strike — crisp 2px cream hairline pinned to the trailing edge
 * of the BarFill. Mounts as a CHILD of BarFill so it follows the bar's
 * animated width transition without lag — by construction, the strike
 * sits exactly where the fill currently ends, no matter what frame of
 * the 0.3s width transition we're in.
 *
 * Replaces the previous ImpactSpark which (a) used a radial-gradient
 * blob with blur + screen-blend (the AI-tell rendering pattern), and
 * (b) was positioned by stamina value while the bar's width transitioned,
 * so the spark snapped to the FINAL position while the bar was still
 * draining — visible misalignment for ~300ms.
 *
 * No blur, no mix-blend-mode, no radial gradient. Just a deliberate
 * thin stroke that fades in 0.18s. Subtle by design.
 *
 * Position: anchored to the trailing edge of the fill, which is the
 * OPPOSITE side from where BarFill is positioned (BarFill anchored on
 * left → trailing edge on right; anchored on right → trailing on left). */
const ImpactStrike = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "right: 0;" : "left: 0;")}
  width: 2px;
  background: rgba(245, 236, 217, 0.95);
  box-shadow:
    0 0 3px rgba(245, 236, 217, 0.7),
    0 0 1px rgba(245, 236, 217, 0.95);
  z-index: 5;
  pointer-events: none;
  transform-origin: center;
  animation: ${impactStrike} 0.18s ease-out forwards;
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

/* Gassed overlay — designed strain marks, not blurred AI smoke.
 *
 * Previous pass was a stack of: crimson-black radial gradient base +
 * three blurred red radial-gradient "heatwave blobs" with screen-blend +
 * hairline strain marks built from repeating linear gradients. Six
 * partially-transparent red layers summed up to one mushy red blob —
 * loud but shapeless, exactly the "AI rendered an effect" pattern that
 * everything else in this codebase has been working away from.
 *
 * Replaced with two layers, both deliberate:
 *
 *   Base — a flat solid deep crimson with one quiet vertical gradient
 *          for shading. No radial gradients. Reads as "this lane is
 *          drained" instead of "this lane is on fire". The base alpha
 *          is high enough that the stamina gauge underneath disappears
 *          (which is the point — you ARE gassed; the gauge is moot).
 *
 *   Slashes — bold sumi-brush diagonal hatching across the fill, drawn
 *             with a repeating-linear-gradient at thick strokes. Slow
 *             horizontal drift via gassedSlashDrift. Reads as a hand-
 *             cancelled banzuke entry — "this wrestler is OUT" — rather
 *             than a heatwave. Sharp, designed mark instead of blurred
 *             noise. Width and angle are chunky enough that the pattern
 *             holds its shape at HUD scale.
 *
 * Slow opacity breath retained on gassedBreathe so the whole overlay
 * still lives — that pulse is the labored-breath cadence and it works.
 * Just narrowed the alpha range so it doesn't strobe. */
/* GassedOverlay is now just a positioning + clipping container.
 * The painted visuals (red wash + drifting slashes) live on
 * GassedBackdrop as a sibling of GassedText — that lets the alarm
 * pulse animation be applied via `filter` to ONLY the backdrop
 * subtree, leaving the GASSED hanko stamp solid and unaffected. If
 * the pulse is applied to the parent (as it was previously), the
 * filter cascades to every child including the stamp, which then
 * strobes along with the wash. The stamp is the alarm's identity —
 * it has to stay rock solid so the eye can read it. */
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
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p) => (p.$matchOver ? 0.92 : 1)};
  transition: opacity 220ms ease;
`;

/* The painted backdrop — red wash + drifting sumi-brush slashes,
 * both pulsing together as the alarm strobe. The wash carries the
 * "drained / dangerous" base color; the slashes drift slowly across
 * it so the lane reads as a hand-cancelled banzuke entry rather
 * than a flat painted decal.
 *
 * The brightness/saturation pulse lives on this element via filter,
 * so it animates BOTH the gradient (the element's own background)
 * AND the slashes (the ::before pseudo-element) together — they
 * read as one cohesive backdrop that flashes dim → bright → dim.
 * The GASSED stamp is a sibling element above this in the JSX
 * tree, so the filter has no effect on it. */
const GassedBackdrop = styled.div`
  position: absolute;
  inset: 0;
  /* Base crimson lifted out of the previous near-black range
     (108,14,14 → 48,4,4) into a properly red alarm range. Still
     deep at the bottom so the lane feels "drained from below"
     rather than uniformly bright; still saturated enough at the
     top that the lane reads UNMISTAKABLY as a red warning state
     at a glance. The pulse animation modulates this base via
     filter rather than its alpha. */
  background: linear-gradient(
    180deg,
    rgba(168, 30, 26, 0.95) 0%,
    rgba(126, 18, 16, 0.96) 50%,
    rgba(82, 10, 10, 0.97) 100%
  );
  /* Quick alarm strobe — fast cadence during active play (~0.78s
     beat), notably slower during the post-round freeze so the alarm
     reads as "still gassed at end of round" rather than continuing
     to scream urgency. */
  animation: ${gassedAlarmPulse}
    ${(p) => (p.$matchOver ? "1.6s" : "0.78s")} ease-in-out infinite;

  /* Sumi-brush diagonal slashes — thick crimson-on-darker-crimson
     hatching that drifts slowly across the bar. The pattern uses
     larger strokes than typical hazard tape so it reads as
     deliberate brushwork at HUD scale instead of fine pinstripes.
     Lives as ::before of the backdrop so it inherits the alarm
     pulse along with the wash beneath it.
     
     Geometry:
     - width: calc(100% + 44px) extends the layer two X-periods past
       the right edge of the parent. The drift animates a leftward
       translateX of one X-period (22px) per cycle, so the buffer
       guarantees the right edge of the pattern never enters the
       visible viewport at any animation frame. No "torn off" edge
       visible mid-drift.
     - left: 0 anchors the layer; the buffer hangs off the right.
       Parent (GassedBackdrop, inset:0 inside BarTrack which has
       overflow: hidden) clips the overhang so it never paints past
       the bar's rounded corners.
     - will-change: transform promotes this to its own GPU layer so
       the translate is a pure composite operation. The repeating-
       gradient is rasterized once when the layer is laid out, then
       transformed each frame without ever being re-sampled. */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: calc(100% + 44px);
    background-image: repeating-linear-gradient(
      -55deg,
      rgba(20, 4, 4, 0) 0px,
      rgba(20, 4, 4, 0) 9px,
      rgba(20, 4, 4, 0.55) 9px,
      rgba(20, 4, 4, 0.55) 12px,
      rgba(20, 4, 4, 0) 12px,
      rgba(20, 4, 4, 0) 18px
    );
    /* 5s per cycle of one X-period (22px). With the layer now GPU-
       composited via translate3d, the cycle is mathematically and
       visually seamless — the compositor shows the rasterized
       gradient at the new sub-pixel offset each frame without any
       re-rasterization or re-sampling. */
    animation: ${gassedSlashDrift} 5s linear infinite;
    will-change: transform;
    backface-visibility: hidden;
    pointer-events: none;
  }
`;

/* GASSED text plate — single hanko stamp landing.
 *
 * Previous pass infinitely pulsed the border + vertically drooped the
 * letters. Two infinite animations on the same plate read as "the UI is
 * malfunctioning" rather than "this wrestler is exhausted". Replaced
 * with a single stamp impression on mount: scales down from oversized,
 * tiny rotation, then sits still at -3deg (like a real vermillion seal
 * pressed onto paper). The DECISION of the stamp is the alarm.
 *
 * Vermillion fill + cream text + dark stroke, no glow halo. The kanji
 * 疲 (tsukareru, "to be exhausted/tired") sits inline before the
 * Romanized label — adds the same Edo-print character the hanko stamp
 * on the prematch screen has, anchors the design to the rest of the
 * game's aesthetic instead of looking like generic FPS damage UI. */
const GassedText = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: baseline;
  gap: clamp(4px, 0.6cqw, 8px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(9px, 1.3cqh, 16px);
  color: ${C.cream};
  letter-spacing: 0.22em;
  ${FONT_RENDER}
  /* Sits ABOVE the GassedBackdrop sibling so the stamp stays
     readable while the backdrop strobes underneath it. */
  z-index: 2;
  background: ${C.vermillion};
  padding: clamp(2px, 0.3cqh, 4px) clamp(10px, 1.4cqw, 20px);
  border: 1.5px solid ${C.vermillionDeep};
  border-radius: 2px;
  text-shadow: 0 1px 0 rgba(70, 18, 8, 0.6);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(245, 236, 217, 0.12);
  transform-origin: 50% 50%;
  opacity: 0;
  animation: ${gassedStamp} 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
`;

/* Inline kanji glyph inside the GASSED stamp. Rendered slightly larger
 * than the Romanized text so it carries a touch more visual weight,
 * matching the proportion the prematch hanko uses. */
const GassedKanji = styled.span`
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: 1.35em;
  line-height: 1;
  color: ${C.cream};
  letter-spacing: 0;
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
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(7px, 1cqh, 13px);
  color: #e6fff2;
  ${FONT_RENDER}
  text-shadow:
    ${TEXT_SHADOW_UI},
    0 0 8px rgba(75, 231, 158, 0.28);
  letter-spacing: ${TRACK.meta};
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
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(8px, 0.95cqw, 12px);
  color: rgba(245, 236, 217, 0.82);
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_UI};
  z-index: 6;
  pointer-events: none;
  user-select: none;
`;

/* "YOU" — bare in-bar type on the outer end of the local stamina track.
 * No plate, no border: hard shelf only (no 4-way stroke + soft bloom). */
const YouLabel = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) =>
    p.$isRight
      ? "right: clamp(6px, 0.9cqw, 14px);"
      : "left: clamp(6px, 0.9cqw, 14px);"}
  z-index: 6;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(8px, 0.95cqw, 12px);
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: ${TRACK.meta};
  /* Cancel trailing tracking so the glyph cluster doesn't look right-heavy. */
  margin-inline-end: -0.08em;
  line-height: 1;
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_COMBAT};
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
  position: relative;
  overflow: visible;
`;

/* Balance strip — inner half of the gauge stack (toward center).
 * Outer half is reserved for BASHO boons via BoonAnchor — keep these
 * widths matched so they never collide. */
const BalStripWrap = styled.div`
  width: 50%;
  align-self: ${(p) => (p.$isRight ? "flex-start" : "flex-end")};
  margin-top: ${gaugeStripGap};
`;

/* BASHO boons — outer half of the gauge stack; out of flow so
 * stamina / posture / power slot stay put. */
const BoonAnchor = styled.div`
  position: absolute;
  top: calc(clamp(22px, 4cqh, 40px) + ${gaugeStripGap});
  width: 50%;
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 2;

  ${(p) =>
    p.$isRight
      ? css`
          right: 0;
          padding-right: clamp(4px, 0.55cqw, 8px);
          justify-content: flex-end;
        `
      : css`
          left: 0;
          padding-left: clamp(4px, 0.55cqw, 8px);
        `}

  & > * {
    pointer-events: auto;
  }
`;

/* Rank plaque — tucked below balance (non-BASHO layout). */
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
 * of communicating which power-up is equipped.
 *
 * One-shot activation pulse:
 * The slot does a single soft scale + brightness pulse the moment a
 * new power-up is assigned to it. This is the smallest possible
 * "you've been handed a new tool" beat — not an infinite glow, not
 * a particle burst, not a flashing border. Just one settle. It
 * exists because without it the icon would silently appear in the
 * slot during the round-start sequence and the player might never
 * register that the slot changed state.
 *
 * Triggering: the JSX render sites pass a stable `key` derived from
 * the active power-up name. When the power-up changes (null → snowball,
 * or snowball → pumo_army between matches), React unmounts the slot
 * and mounts a new one — which re-runs the `slotMountPulse` keyframe
 * from scratch. When only the cooldown state changes within a single
 * power-up, the key is unchanged, no remount happens, no pulse runs.
 * Empty slots ($active falsy) opt out of the animation entirely. */
/* Activation pulse — confident landing, no overshoot.
 *
 * First pass used a cubic-bezier(0.34, 1.56, 0.64, 1) overshoot that
 * rebounded past 1.0 to 1.05 before settling. That was the same
 * cartoon-physics rubber-band vocabulary the round announcement
 * animations were using, and on a HUD element it reads as the slot
 * "boinging" into place — wrong tone for a sumo broadcast UI.
 *
 * New recipe: one ease-out from 0.94 → 1.0 with a brightness flash
 * from 1.35 → 1.0. The element grows into its final scale and the
 * brightness drops off — reads as "this slot just lit up" rather
 * than "this slot bounced in". 0.35s total, fast enough to not
 * pull focus away from gameplay, slow enough to be felt. */
const slotMountPulse = keyframes`
  0%   { transform: scale(0.94); filter: brightness(1.35); }
  100% { transform: scale(1);    filter: brightness(1); }
`;

const PowerUpIconFrame = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(26px, 3.5cqw, 42px);
  height: clamp(26px, 3.5cqw, 42px);
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    object-fit: contain;
    position: relative;
    z-index: 1;
    filter: ${(p) =>
      p.$cooldown ? "brightness(0.5) grayscale(0.35)" : "brightness(1)"};
  }
`;

/* Charge count — stroked numeral at the bottom-right of the icon frame
   (same vocabulary as boon stack marks). Sits outside the artwork. */
const PowerUpChargeMark = styled.span`
  position: absolute;
  bottom: clamp(-6px, -0.5cqw, -3px);
  right: clamp(-3px, -0.3cqw, -1px);
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(10px, 1.05cqw, 13px);
  line-height: 1;
  color: #fff;
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_COMBAT};
  pointer-events: none;
  z-index: 3;
`;

const PowerUpSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${SLOT_SIZE};
  align-self: stretch;
  border-radius: 4px;
  box-sizing: border-box;
  position: relative;
  transition: all 0.25s ease;
  flex-shrink: 0;
  /* Clip only the BASHO N/A strike — charge mark sits outside the frame. */
  overflow: ${(p) => (!p.$active && p.$bashoNa ? "hidden" : "visible")};

  border: 1px solid
    ${(p) =>
      !p.$active && p.$bashoNa
        ? "rgba(245, 236, 217, 0.2)"
        : p.$active
          ? "rgba(232, 197, 71, 0.4)"
          : "rgba(245, 236, 217, 0.28)"};
  border-style: ${(p) => (!p.$active && p.$bashoNa ? "dashed" : "solid")};

  background: ${(p) => {
    if (!p.$active)
      return `
        linear-gradient(180deg, rgba(126, 203, 240, 0.06) 0%, transparent 40%),
        linear-gradient(145deg, rgba(14, 18, 28, 0.98), rgba(6, 8, 14, 0.97), rgba(4, 6, 10, 0.96))
      `;
    if (p.$cooldown)
      return "linear-gradient(135deg, #4a5568, #2d3748)";
    switch (p.$active) {
      case "speed":
        return "linear-gradient(145deg, #4de0ff 0%, #00a8e0 45%, #0066cc 100%)";
      case "power":
        return "linear-gradient(145deg, #ffb0c0 0%, #ff8fa3 40%, #dc2626 100%)";
      case "snowball":
        return "linear-gradient(145deg, #f4fcff 0%, #c8ebf8 42%, #6eb8d8 100%)";
      case "pumo_army":
        return "linear-gradient(145deg, #ffd9a0 0%, #ffb040 45%, #e07000 100%)";
      case "thick_blubber":
        return "linear-gradient(145deg, #ff7aa8 0%, #ff5087 45%, #a01f4a 100%)";
      case "flap":
        return "linear-gradient(145deg, #6af0d4 0%, #34e0c0 45%, #15705f 100%)";
      case "shatter_palm":
        return "linear-gradient(145deg, #fff6c8 0%, #ffe056 45%, #e0a010 100%)";
      default:
        return "linear-gradient(145deg, #6c757d, #343a40)";
    }
  }};

  box-shadow:
    0 clamp(2px, 0.18cqw, 4px) clamp(10px, 0.85cqw, 18px) rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -2px 5px rgba(0, 0, 0, 0.35);

  opacity: ${(p) => (p.$active ? 1 : 0.78)};

  /* BASHO empty slot — reads as "no active" rather than a dead black tile. */
  ${(p) =>
    !p.$active &&
    p.$bashoNa &&
    css`
      &::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        width: 82%;
        height: 1px;
        background: rgba(245, 236, 217, 0.2);
        transform: translate(-50%, -50%) rotate(-42deg);
        pointer-events: none;
        z-index: 0;
      }
    `}

  /* Activation pulse — fires once on mount of an active slot (see the
     comment above the styled-component for triggering details). Empty
     slots skip the animation entirely; otherwise every empty slot in
     the match would also pulse on its first appearance, which would
     be the opposite of the signal we want. */
  ${(p) =>
    p.$active &&
    css`
      animation: ${slotMountPulse} 0.35s ease-out;
    `}
`;

// ============================================
// CENTER ROUND / DAY — lacquered broadcast seal
// ============================================

/* Center day/round — bare broadcast numerals, no plate.
 *
 * The lacquered box fought the rank plaques for center-screen space and
 * read as a floating UI card rather than match chrome. Fixed width keeps
 * 1-digit and 2-digit days from shifting the wings; the type does the work. */
const CenterRound = styled.div`
  position: absolute;
  /* Anchor on the stamina-bar midline (HudShell pad + name row + gaps +
     half bar height), then translateY(-50%) so the numeral stack centers
     on the bar rather than floating in the top letterbox. */
  top: calc(
    clamp(24px, 3cqh, 34px) + clamp(18px, 2.2cqh, 26px) +
      clamp(8px, 1cqh, 14px) + clamp(4px, 0.55cqh, 8px) +
      (clamp(22px, 4cqh, 40px) * 0.5)
  );
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  opacity: ${(p) => (p.$matchOver ? 0.7 : 1)};
  transition: opacity 260ms ease;
  box-sizing: border-box;
  width: clamp(52px, 6.5cqw, 78px);
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
/* Round number — arabic numerals.
 *
 * Tried roman numerals (I / II / III) for one pass to rhyme with the
 * banzuke vocabulary. Reverted: Bungee renders the roman numerals as
 * three identical vertical bars (II = ‖, III = ‖‖‖) with no shape
 * differentiation. At HUD scale that becomes a column of indistinct
 * pipes — visually unreadable and competing badly with the other
 * Bungee type on the HUD. Arabic 1/2/3 in this same font has
 * actually-distinct glyph shapes and reads at a glance. The
 * "ceremonial enumeration" idea wasn't worth the legibility loss. */
const RoundNum = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.black};
  font-size: clamp(24px, 4cqw, 56px);
  color: #f3ede2;
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  line-height: 1;
  user-select: none;
  width: 100%;
  text-align: center;
`;

const RoundText = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(7px, 0.9cqw, 12px);
  color: rgba(232, 197, 71, 0.78);
  text-transform: uppercase;
  letter-spacing: ${TRACK.label};
  text-indent: ${TRACK.label};
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_UI};
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
  player1RankLabel = null,
  player2RankLabel = null,
  player1Stamina,
  player1ActivePowerUp = null,
  player1SnowballCooldown = false,
  player1SnowballThrowsRemaining = null,
  player1PumoArmyCooldown = false,
  player1PumoArmySpawnsRemaining = null,
  player1IsGassed = false,
  player1ParryRefund = 0,
  player1Balance = 100,
  player1BalanceGain = 0,
  player1TipDrain = 0,
  player1HasDeepGrip = false,
  player1PostureBroken = false,
  player1ShoveLead = null,
  player2Stamina,
  player2ActivePowerUp = null,
  player2SnowballCooldown = false,
  player2SnowballThrowsRemaining = null,
  player2PumoArmyCooldown = false,
  player2PumoArmySpawnsRemaining = null,
  player2IsGassed = false,
  player2ParryRefund = 0,
  player2Balance = 100,
  player2BalanceGain = 0,
  player2TipDrain = 0,
  player2HasDeepGrip = false,
  player2PostureBroken = false,
  player2ShoveLead = null,
  matchOver = false,
  player1TopMarks = undefined,
  player2TopMarks = undefined,
  centerContent = undefined,
  player2Name = "PLAYER 2",
  nameAlignToMarkBottom = false,
  bashoPowerUpSlots = false,
  rankInTopMarks = false,
  player1SubMarks = undefined,
  player2SubMarks = undefined,
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

  // ── Perfect-parry balance gain flash ──
  // Each truthy value (a server timestamp) drives a 700ms inner-fill +
  // outer-track pulse on the balance gauge. The state stores the
  // timestamp so it can also serve as the React key that remounts the
  // overlay components, replaying their CSS animation cleanly.
  const [p1BalGainKey, setP1BalGainKey] = useState(0);
  const [p2BalGainKey, setP2BalGainKey] = useState(0);
  const p1BalGainTimer = useRef(null);
  const p2BalGainTimer = useRef(null);
  // Tip-slap posture drain flinch keys (clear after the flash finishes).
  const [p1TipDrainKey, setP1TipDrainKey] = useState(0);
  const [p2TipDrainKey, setP2TipDrainKey] = useState(0);
  const p1TipDrainTimer = useRef(null);
  const p2TipDrainTimer = useRef(null);

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
  // p1Impact / p2Impact are bumped on each heavy hit; the bump's value is
  // used as the React `key` on <ImpactStrike> so each hit remounts the
  // component and replays the strike animation. The strike anchors itself
  // to the trailing edge of <BarFill> via CSS (right: 0 / left: 0), so
  // we no longer need to track the stamina value at the moment of impact —
  // the strike rides whatever edge the bar's width-transition is at.
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

  // Perfect-parry balance gain — bump the state to a fresh value (the
  // server timestamp) so child overlays remount and replay animation,
  // then clear after 700ms so the track's $gaining flag releases and
  // any underlying $danger pulse can resume.
  useEffect(() => {
    if (player1BalanceGain > 0) {
      setP1BalGainKey(player1BalanceGain);
      if (p1BalGainTimer.current) clearTimeout(p1BalGainTimer.current);
      p1BalGainTimer.current = setTimeout(() => setP1BalGainKey(0), 700);
    }
    return () => {
      if (p1BalGainTimer.current) clearTimeout(p1BalGainTimer.current);
    };
  }, [player1BalanceGain]);

  useEffect(() => {
    if (player2BalanceGain > 0) {
      setP2BalGainKey(player2BalanceGain);
      if (p2BalGainTimer.current) clearTimeout(p2BalGainTimer.current);
      p2BalGainTimer.current = setTimeout(() => setP2BalGainKey(0), 700);
    }
    return () => {
      if (p2BalGainTimer.current) clearTimeout(p2BalGainTimer.current);
    };
  }, [player2BalanceGain]);

  // Tip-slap posture drain — brief vermillion bite on the victim's gauge.
  useEffect(() => {
    if (player1TipDrain > 0) {
      setP1TipDrainKey(player1TipDrain);
      if (p1TipDrainTimer.current) clearTimeout(p1TipDrainTimer.current);
      p1TipDrainTimer.current = setTimeout(() => setP1TipDrainKey(0), 420);
    }
    return () => {
      if (p1TipDrainTimer.current) clearTimeout(p1TipDrainTimer.current);
    };
  }, [player1TipDrain]);

  useEffect(() => {
    if (player2TipDrain > 0) {
      setP2TipDrainKey(player2TipDrain);
      if (p2TipDrainTimer.current) clearTimeout(p2TipDrainTimer.current);
      p2TipDrainTimer.current = setTimeout(() => setP2TipDrainKey(0), 420);
    }
    return () => {
      if (p2TipDrainTimer.current) clearTimeout(p2TipDrainTimer.current);
    };
  }, [player2TipDrain]);

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
      // Heavy-hit feedback: edge strike + frame shake on meaningful drops
      const drop = prev - s1;
      if (drop >= IMPACT_DROP_THRESHOLD) {
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
    pumoArmyCooldown,
    pumoArmySpawnsRemaining
  ) => {
    switch (powerUpType) {
      case "snowball":
        return snowballCooldown;
      case "pumo_army":
        return (
          pumoArmyCooldown ||
          (Number.isFinite(pumoArmySpawnsRemaining) &&
            pumoArmySpawnsRemaining <= 0)
        );
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
      case "flap": return flapIcon;
      case "shatter_palm": return shatterPalmIcon;
      default: return "";
    }
  };

  const renderPowerUpChargeMark = (
    activePowerUp,
    snowballRemaining,
    pumoRemaining
  ) => {
    if (activePowerUp === "snowball" && Number.isFinite(snowballRemaining)) {
      return (
        <PowerUpChargeMark aria-hidden="true">
          {Math.max(0, snowballRemaining)}
        </PowerUpChargeMark>
      );
    }
    if (activePowerUp === "pumo_army" && Number.isFinite(pumoRemaining)) {
      return (
        <PowerUpChargeMark aria-hidden="true">
          {Math.max(0, pumoRemaining)}
        </PowerUpChargeMark>
      );
    }
    return null;
  };

  const p1Danger = shouldShowLowStaminaWarning(p1DisplayStamina);
  const p2Danger = shouldShowLowStaminaWarning(p2DisplayStamina);
  // Push-war HUD: null = not in mutual shove; 0 = EVEN; ±1 = walk lead.
  const p1ShoveActive = player1ShoveLead === 0 || player1ShoveLead === 1 || player1ShoveLead === -1;
  const p2ShoveActive = player2ShoveLead === 0 || player2ShoveLead === 1 || player2ShoveLead === -1;
  const shoveTag = (lead) => (lead > 0 ? "PUSH" : lead < 0 ? "BACK" : "EVEN");

  const renderRankPlaque = (label, compact = false) => (
    <RankPlaque $compact={compact}>
      <RankText>{(label || "JONOKUCHI").toUpperCase()}</RankText>
    </RankPlaque>
  );

  const renderP1TopMarks = () => {
    if (rankInTopMarks) return renderRankPlaque(player1RankLabel, true);
    if (player1TopMarks !== undefined) return player1TopMarks;
    return renderCenterMarks("player1");
  };

  const renderP2TopMarks = () => {
    if (rankInTopMarks) return renderRankPlaque(player2RankLabel, true);
    if (player2TopMarks !== undefined) return player2TopMarks;
    return renderCenterMarks("player2");
  };

  return (
    <HudShell $matchOver={matchOver}>
      {/* ═══ PLAYER 1 — East (Higashi) ═══ */}
      <PlayerWing $matchOver={matchOver}>
        <NameBanner $isRight={false}>
          <WinLossRow $isRight={false}>
            {renderP1TopMarks()}
          </WinLossRow>
          <NameBlock $isRight={false} $alignToMarkBottom={nameAlignToMarkBottom}>
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
              $shoveLead={p1ShoveActive ? player1ShoveLead : null}
              $shoveActive={p1ShoveActive}
            >
              <BarTrack $isRight={false}>
                {isPlayer1Local && <YouLabel $isRight={false}>YOU</YouLabel>}
                {p1ShoveActive && (
                  <ShoveLeadTag $isRight={false} $lead={player1ShoveLead}>
                    {shoveTag(player1ShoveLead)}
                  </ShoveLeadTag>
                )}
                <BarFill
                  $stamina={p1DisplayStamina}
                  $danger={p1Danger}
                  $isRight={false}
                >
                  {p1Impact > 0 && !player1IsGassed && (
                    <ImpactStrike
                      key={`p1-impact-${p1Impact}`}
                      $isRight={false}
                    />
                  )}
                </BarFill>
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
                    <GassedBackdrop $matchOver={matchOver} />
                    <GassedText>
                      <GassedKanji>疲</GassedKanji>
                      GASSED
                    </GassedText>
                  </GassedOverlay>
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
            <BalStripWrap $isRight={false} $matchOver={matchOver}>
              <BalanceGauge
                balance={b1}
                isRight={false}
                danger={b1Danger}
                broken={player1PostureBroken}
                gainKey={p1BalGainKey}
                drainKey={p1TipDrainKey}
                deepGripThreat={player2HasDeepGrip}
                deepGripHold={player1HasDeepGrip}
              />
            </BalStripWrap>
            {player1SubMarks && (
              <BoonAnchor $isRight={false}>{player1SubMarks}</BoonAnchor>
            )}
          </GaugeStack>
          <PowerUpSlot
            /* Stable on cooldown / charge-count changes, changes only
               when the assigned power-up itself changes. Drives the
               one-shot slotMountPulse — see the styled-component
               comment for the full rationale. */
            key={`p1-pu-${player1ActivePowerUp || "empty"}`}
            $active={player1ActivePowerUp}
            $bashoNa={bashoPowerUpSlots}
            $cooldown={getPowerUpIsOnCooldown(
              player1ActivePowerUp,
              player1SnowballCooldown,
              player1PumoArmyCooldown,
              player1PumoArmySpawnsRemaining
            )}
          >
            {player1ActivePowerUp && (
              <PowerUpIconFrame
                $cooldown={getPowerUpIsOnCooldown(
                  player1ActivePowerUp,
                  player1SnowballCooldown,
                  player1PumoArmyCooldown,
                  player1PumoArmySpawnsRemaining
                )}
              >
                <img
                  src={getPowerUpIcon(player1ActivePowerUp)}
                  alt={player1ActivePowerUp}
                />
                {renderPowerUpChargeMark(
                  player1ActivePowerUp,
                  player1SnowballThrowsRemaining,
                  player1PumoArmySpawnsRemaining
                )}
              </PowerUpIconFrame>
            )}
          </PowerUpSlot>
        </BarRow>

        {!rankInTopMarks && (
          <SubBarRow $isRight={false}>
            <BarRowSpacer />
            {renderRankPlaque(player1RankLabel)}
          </SubBarRow>
        )}
      </PlayerWing>

      {/* ═══ CENTER ROUND ═══ */}
      <CenterRound
        $matchOver={matchOver}
        $customCenter={centerContent != null}
      >
        {centerContent ?? (
          <>
            <RoundNum>{currentRound}</RoundNum>
            <RoundText>ROUND</RoundText>
          </>
        )}
      </CenterRound>

      {/* ═══ PLAYER 2 — West (Nishi) ═══ */}
      <PlayerWing $matchOver={matchOver}>
        <NameBanner $isRight={true}>
          <WinLossRow $isRight={true}>
            {renderP2TopMarks()}
          </WinLossRow>
          <NameBlock $isRight={true} $alignToMarkBottom={nameAlignToMarkBottom}>
            <FighterName>{player2Name.toUpperCase()}</FighterName>
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
              $shoveLead={p2ShoveActive ? player2ShoveLead : null}
              $shoveActive={p2ShoveActive}
            >
              <BarTrack $isRight={true}>
                {!isPlayer1Local && <YouLabel $isRight={true}>YOU</YouLabel>}
                {p2ShoveActive && (
                  <ShoveLeadTag $isRight={true} $lead={player2ShoveLead}>
                    {shoveTag(player2ShoveLead)}
                  </ShoveLeadTag>
                )}
                <BarFill
                  $stamina={p2DisplayStamina}
                  $danger={p2Danger}
                  $isRight={true}
                >
                  {p2Impact > 0 && !player2IsGassed && (
                    <ImpactStrike
                      key={`p2-impact-${p2Impact}`}
                      $isRight={true}
                    />
                  )}
                </BarFill>
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
                    <GassedBackdrop $matchOver={matchOver} />
                    <GassedText>
                      <GassedKanji>疲</GassedKanji>
                      GASSED
                    </GassedText>
                  </GassedOverlay>
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
            <BalStripWrap $isRight={true} $matchOver={matchOver}>
              <BalanceGauge
                balance={b2}
                isRight={true}
                danger={b2Danger}
                broken={player2PostureBroken}
                gainKey={p2BalGainKey}
                drainKey={p2TipDrainKey}
                deepGripThreat={player1HasDeepGrip}
                deepGripHold={player2HasDeepGrip}
              />
            </BalStripWrap>
            {player2SubMarks && (
              <BoonAnchor $isRight={true}>{player2SubMarks}</BoonAnchor>
            )}
          </GaugeStack>
          <PowerUpSlot
            key={`p2-pu-${player2ActivePowerUp || "empty"}`}
            $active={player2ActivePowerUp}
            $bashoNa={bashoPowerUpSlots}
            $cooldown={getPowerUpIsOnCooldown(
              player2ActivePowerUp,
              player2SnowballCooldown,
              player2PumoArmyCooldown,
              player2PumoArmySpawnsRemaining
            )}
          >
            {player2ActivePowerUp && (
              <PowerUpIconFrame
                $cooldown={getPowerUpIsOnCooldown(
                  player2ActivePowerUp,
                  player2SnowballCooldown,
                  player2PumoArmyCooldown,
                  player2PumoArmySpawnsRemaining
                )}
              >
                <img
                  src={getPowerUpIcon(player2ActivePowerUp)}
                  alt={player2ActivePowerUp}
                />
                {renderPowerUpChargeMark(
                  player2ActivePowerUp,
                  player2SnowballThrowsRemaining,
                  player2PumoArmySpawnsRemaining
                )}
              </PowerUpIconFrame>
            )}
          </PowerUpSlot>
        </BarRow>

        {!rankInTopMarks && (
          <SubBarRow $isRight={true}>
            <BarRowSpacer />
            {renderRankPlaque(player2RankLabel)}
          </SubBarRow>
        )}
      </PlayerWing>
    </HudShell>
  );
};

UiPlayerInfo.propTypes = {
  roundHistory: PropTypes.array,
  roundId: PropTypes.number,
  isPlayer1Local: PropTypes.bool,
  player1RankLabel: PropTypes.string,
  player2RankLabel: PropTypes.string,
  player1Stamina: PropTypes.number,
  player1ActivePowerUp: PropTypes.string,
  player1SnowballCooldown: PropTypes.bool,
  player1SnowballThrowsRemaining: PropTypes.number,
  player1PumoArmyCooldown: PropTypes.bool,
  player1PumoArmySpawnsRemaining: PropTypes.number,
  player1IsGassed: PropTypes.bool,
  player1ParryRefund: PropTypes.number,
  player1Balance: PropTypes.number,
  player1BalanceGain: PropTypes.number,
  player1TipDrain: PropTypes.number,
  player1HasDeepGrip: PropTypes.bool,
  player1PostureBroken: PropTypes.bool,
  player2Stamina: PropTypes.number,
  player2ActivePowerUp: PropTypes.string,
  player2SnowballCooldown: PropTypes.bool,
  player2SnowballThrowsRemaining: PropTypes.number,
  player2PumoArmyCooldown: PropTypes.bool,
  player2PumoArmySpawnsRemaining: PropTypes.number,
  player2IsGassed: PropTypes.bool,
  player2ParryRefund: PropTypes.number,
  player2Balance: PropTypes.number,
  player2BalanceGain: PropTypes.number,
  player2TipDrain: PropTypes.number,
  player2HasDeepGrip: PropTypes.bool,
  player2PostureBroken: PropTypes.bool,
  player1ShoveLead: PropTypes.number,
  player2ShoveLead: PropTypes.number,
  matchOver: PropTypes.bool,
  player1TopMarks: PropTypes.node,
  player2TopMarks: PropTypes.node,
  centerContent: PropTypes.node,
  player2Name: PropTypes.string,
  nameAlignToMarkBottom: PropTypes.bool,
  bashoPowerUpSlots: PropTypes.bool,
  rankInTopMarks: PropTypes.bool,
  player1SubMarks: PropTypes.node,
  player2SubMarks: PropTypes.node,
};

export default React.memo(UiPlayerInfo);
