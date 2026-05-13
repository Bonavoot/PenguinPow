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

/* Balance bar danger alarm — strobes the BalTrack's vermillion border
 * + outer glow ring on the same 0.78s cadence as the gassed lane's
 * alarm pulse, so the two danger signals feel like one shared
 * vocabulary when both are active.
 *
 * Crucially this only animates the box-shadow stack (the border ring +
 * outer glow). The track's gradient stays put — the kill-zone red /
 * throw-zone gold backgrounds are already painted at full saturation
 * inside the gradient, and strobing the WHOLE track via filter would
 * drown out the ice-blue fill on top of them. The ring is the alarm
 * signal; the rest of the bar reads as "the instrument" and stays
 * stable.
 *
 * Amplitude is deliberately gentler than the gassed pulse since
 * balance danger triggers far more often than gassed — a heavier
 * strobe would become constant visual noise. */
const balanceAlarmPulse = keyframes`
  0%, 100% {
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.85),
      inset 0 -1px 1px rgba(0, 0, 0, 0.4),
      inset 0 0 0 1px rgba(216, 59, 39, 0.78),
      inset 0 0 0 2px rgba(8, 10, 18, 0.85),
      0 1px 2px rgba(0, 0, 0, 0.5);
  }
  50% {
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.85),
      inset 0 -1px 1px rgba(0, 0, 0, 0.4),
      inset 0 0 0 1.5px rgba(238, 81, 65, 1),
      inset 0 0 0 2.5px rgba(8, 10, 18, 0.85),
      0 1px 2px rgba(0, 0, 0, 0.5);
  }
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

/* Balance-gain flash — fires on perfect parry. Ice blue/cream wash that
 * matches the BalFill palette so the gain reads as "more of the same
 * stuff filling in" rather than a foreign green-stamina overlay. The
 * inset glow + outer halo punches the bar without obscuring the fill
 * level (we still want to read the new balance value at a glance). */
const balanceGainFlash = keyframes`
  0% {
    opacity: 0;
    box-shadow:
      inset 0 0 18px rgba(245, 252, 255, 0.95),
      0 0 14px rgba(170, 220, 255, 0.85);
    transform: scaleY(1);
  }
  18% {
    opacity: 1;
    box-shadow:
      inset 0 0 22px rgba(245, 252, 255, 1),
      0 0 22px rgba(170, 220, 255, 0.95);
    transform: scaleY(1.18);
  }
  60% {
    opacity: 0.7;
    box-shadow:
      inset 0 0 14px rgba(200, 235, 255, 0.6),
      0 0 12px rgba(170, 220, 255, 0.45);
    transform: scaleY(1.05);
  }
  100% {
    opacity: 0;
    box-shadow:
      inset 0 0 0 rgba(245, 252, 255, 0),
      0 0 0 rgba(170, 220, 255, 0);
    transform: scaleY(1);
  }
`;

/* Balance-gain sweep — bright cream highlight rolls outward from the
 * anchor edge along the new fill, selling the "topped up" direction
 * without making the rest of the bar look like it changed. Companion
 * to balanceGainFlash; runs slightly slower so you read the sweep
 * after the initial pulse instead of both blurring together. */
const balanceGainSweep = keyframes`
  0%   { transform: translateX(-110%); opacity: 0.0; }
  10%  { opacity: 1; }
  85%  { opacity: 0.9; }
  100% { transform: translateX(110%); opacity: 0; }
`;

/* Balance-gain track ring — brief outer outline pulse on the track itself,
 * harmonized with the BalTrack's existing border tone. Runs at the same
 * cadence as the inner flash so the inside-fill and outside-frame land
 * the moment together. */
const balanceGainTrackPulse = keyframes`
  0% {
    box-shadow:
      inset 0 0 0 1px rgba(245, 252, 255, 0.95),
      0 0 18px rgba(170, 220, 255, 0.9),
      inset 0 0 0 2px rgba(8, 10, 18, 0.85),
      0 1px 2px rgba(0, 0, 0, 0.5);
  }
  100% {
    box-shadow:
      inset 0 0 0 1px rgba(245, 236, 217, 0.32),
      inset 0 0 0 2px rgba(8, 10, 18, 0.85),
      0 1px 2px rgba(0, 0, 0, 0.5);
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
 * pattern alive without being twitchy. 18s sweep, opacity holds steady
 * so it doesn't flicker. */
const gassedSlashDrift = keyframes`
  from { background-position: 0 0; }
  to   { background-position: 36px 0; }
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

/* Stamina bar frame — minimalist hairline.
 *
 * Stripped HARD from the previous "chiseled banzuke plate" treatment
 * (cream highlight rim + 4px gold-leaf ring + 4px dark gunmetal
 * underlayer + 4 corner rivets via stacked radial gradients). That
 * stack was the single most "premium hardware overdesign" element on
 * the HUD — it read as a brass-fitted arcade cabinet UI, not a
 * minimalist game UI. Trying too hard to look expensive is exactly
 * what reads as cheap.
 *
 * What's left:
 *   1. A single 1.5px hairline border. Cream by default for legibility
 *      against the dim arena; vermillion when $gassed, so the alarm
 *      signal is the one piece of color information the frame carries.
 *   2. A short warm drop shadow underneath, so the bar lifts off the
 *      dohyo backdrop. Bar still reads as a discrete "thing" sitting
 *      on top of the scene rather than a flat decal.
 *
 * That's it. No rivets, no rings, no chiselling. The bar's identity
 * comes from its FILL (the matcha-green stamina + the impact strike +
 * the gassed overlay), not from ornamental hardware around it.
 *
 * The dangerFramePulse + gassedFramePulse animations are still wired
 * up — they now just modulate brightness/saturation gently (the color
 * shift to vermillion handles the visual alarm; the pulse is the
 * life on top of the shift). */
const BarFrame = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 3px;
  border: 1.5px solid ${(p) =>
    p.$gassed
      ? "rgba(216, 59, 39, 0.95)"
      : p.$danger
        ? "rgba(238, 81, 65, 0.85)"
        : "rgba(245, 236, 217, 0.32)"};
  box-shadow: 0 clamp(2px, 0.18cqw, 4px) clamp(8px, 0.7cqw, 16px)
    rgba(0, 0, 0, 0.55);
  opacity: ${(p) => (p.$matchOver ? 0.95 : 1)};
  transition: border-color 240ms ease, opacity 220ms ease;

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

/* Matcha-moss stamina fill — pigmented green that reads as "regenerative
 * energy" without the candy-bar arcade neon. Previous pass ramped through
 * #14663d → #1c9b52 → #46d46a → #95f07a → #caffae → #f0ffe4 — six
 * stops climbing into near-white highlights, which is what made it look
 * Mountain Dew. The new ramp is FOUR stops, lower-saturation, narrower
 * value range, and the brightest stop is a warm sage instead of neon
 * white-green. Reads as dyed cloth / hand-painted gauge instead of LCD.
 *
 * Still unmistakably green, still tells the eye "this regenerates", but
 * it sits in the same hand-painted Edo-print world as the menus rather
 * than fighting them with arcade chroma.
 *
 * Vertical wobble + top highlight + diagonal frost sweep all preserved
 * as before — the change is COLOR, not behaviour. */
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
        ? "linear-gradient(90deg, #b91c1c 0%, #dc2626 40%, #ef4444 80%, #f87171 100%)"
        : "linear-gradient(90deg, #f87171 0%, #ef4444 20%, #dc2626 60%, #b91c1c 100%)"
      : p.$isRight
        ? "linear-gradient(90deg, #2d6638 0%, #4f9852 28%, #7dc46a 62%, #b6e088 100%)"
        : "linear-gradient(90deg, #b6e088 0%, #7dc46a 38%, #4f9852 72%, #2d6638 100%)"};

  /* Outer glows removed — they bled into BarTrack's 2px inset gap
     above and below the fill, making the fill appear flush with
     (or taller than) the dark track. The inner glow alone gives
     the fill internal lighting character without extending its
     visual height past its actual pixel bounds. */
  box-shadow: ${(p) =>
    p.$danger
      ? "inset 0 0 4px rgba(255, 100, 100, 0.22)"
      : "inset 0 0 6px rgba(182, 224, 136, 0.22)"};

  animation: ${(p) =>
    p.$danger
      ? css`${flashRedPulse} 0.6s ease-in-out infinite`
      : css`${fillWobble} 2.4s ease-in-out infinite`};

  /* Top highlight — pulled back from the previous near-white cream
   * stops because on the muted moss base they read as a neon strip.
   * Cream-faint warm highlight now, just enough to catch the eye on
   * the upper lip of the bar. */
  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 40%;
    background: linear-gradient(
      180deg,
      rgba(245, 236, 217, 0.22) 0%,
      rgba(245, 236, 217, 0.06) 60%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  /* Cream sweep across the fill (only when not danger). Was a bright
   * lime-tinted "frost-glass" sweep, now a cream washi sweep that
   * matches the warm highlight above. */
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
      rgba(245, 236, 217, 0.08) 44%,
      rgba(245, 236, 217, 0.2) 50%,
      rgba(245, 236, 217, 0.08) 56%,
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

/* ── Perfect-parry balance gain VFX ───────────────────────────────────
 *
 * Sits inside the BalTrack, sized to the current balance width so it
 * "fills" exactly the visible mawashi-blue zone. Two stacked layers:
 *
 *   1. BalanceGainFlash — ice-blue / cream wash that pulses the whole
 *      fill once (inset glow + outer halo + brief vertical scale).
 *      Reads as "the bar got recharged."
 *
 *   2. BalanceGainSweep — single bright cream stripe that travels
 *      across the fill from the anchor edge to the leading edge.
 *      Reads as "energy poured in" with a directional read that
 *      reinforces which side is the current balance level.
 *
 * Companion BalanceGainGlow on the track adds an outer outline pulse
 * — the inner flash and outer ring land on the same beat so the gauge
 * "snaps" with the perfect-parry hitstop.
 */
const BalanceGainFlash = styled.div.attrs((p) => ({
  style: {
    width: `${p.$balance}%`,
  },
}))`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  border-radius: 1px;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgba(245, 252, 255, 0.95) 0%,
    rgba(200, 235, 255, 0.65) 50%,
    rgba(170, 220, 255, 0.85) 100%
  );
  animation: ${balanceGainFlash} 0.7s ease-out forwards;
  transform-origin: center;
`;

const BalanceGainSweep = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  width: 50%;
  pointer-events: none;
  background: linear-gradient(
    ${(p) => (p.$isRight ? "90deg" : "270deg")},
    transparent 0%,
    rgba(245, 252, 255, 0) 15%,
    rgba(245, 252, 255, 0.85) 50%,
    rgba(245, 252, 255, 0) 85%,
    transparent 100%
  );
  filter: blur(0.4px);
  animation: ${balanceGainSweep} 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  ${(p) => (p.$isRight ? "" : "transform: translateX(110%);")}
`;

/* Outer-track halo applied to BalTrack while a gain is active. Driven
 * by a $gaining prop so the track itself can opt-in to the pulse for
 * the duration of the inner flash. */
const balanceGainTrackOverlay = css`
  animation: ${balanceGainTrackPulse} 0.7s ease-out forwards;
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
     pulse along with the wash beneath it. */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      -55deg,
      rgba(20, 4, 4, 0) 0px,
      rgba(20, 4, 4, 0) 9px,
      rgba(20, 4, 4, 0.55) 9px,
      rgba(20, 4, 4, 0.55) 12px,
      rgba(20, 4, 4, 0) 12px,
      rgba(20, 4, 4, 0) 18px
    );
    animation: ${gassedSlashDrift} 6s linear infinite;
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
  font-family: "Bungee", cursive;
  font-size: clamp(9px, 1.3cqh, 16px);
  color: ${C.cream};
  letter-spacing: 0.22em;
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
  font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
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
 * Sits beneath the stamina BarFrame with breathing room — the previous
 * pass had this glued tight against the bottom edge of the stamina
 * bar, which made the two gauges read as one merged element. Bumped
 * margin-top so the balance gauge has its own visual lane.
 *
 * No tilt/wobble animation on danger anymore — the previous balanceTilt
 * keyframe rotated the whole strip ±1deg in a danger state, which read
 * as the UI being broken rather than the wrestler being unsteady. The
 * track's vermillion danger ring + the bright kill-zone background
 * behind a tiny ice-blue fill sliver carry the alarm cleanly on their
 * own — no animation needed for the danger reading. */
const BalStripWrap = styled.div`
  display: flex;
  align-items: center;
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  gap: clamp(5px, 0.6cqw, 9px);
  width: 50%;
  align-self: ${(p) => (p.$isRight ? "flex-start" : "flex-end")};
  margin-top: clamp(8px, 1cqh, 14px);
`;

/* Stance gauge track — three-zone precision instrument.
 *
 * The threshold zones are baked INTO the track itself, in the empty
 * space behind the fill. Three regions, with a sumi ink stroke between
 * kill and throw (14–16%):
 *
 *   safe zone  — dark ink (no balance pressure)
 *   throw zone — gold (muted toward ink so it reads in the well)
 *   kill zone  — vermillion (muted toward ink; throw = round over)
 *
 * Zone fills are `color-mix`ed with sumi ink so red/gold keep brand hue
 * but sit *inside* the track like tinted glass — not flat neon slabs.
 * The ice-blue BalFill still pops on top.
 * Direction set so kill zone sits on the side the bar drains INTO.
 *
 * Danger ring: when balance is in the kill zone, the inner cream
 * hairline border swaps to vermillion + a small outer vermillion glow.
 * The whole instrument turns red as a unit. */
const BalTrack = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  height: clamp(8px, 1.3cqh, 12px);
  border-radius: 1px;
  overflow: hidden;
  /* Single sumi divider at the kill→throw boundary. The previous
     cream hairlines (rgba 245,236,217,0.7) read as glitches/seams
     at HUD scale instead of as deliberate partitions, and they
     dropped to near-zero contrast against the gold throw zone.
     Sumi reads as a printed-banzuke ink stroke and holds against
     both the bright vermillion kill zone AND the gold throw zone.
     Slightly bumped width (1.5% → 2%) so the partition reads as
     a deliberate ink mark rather than a 1px artifact.
     The throw→safe boundary drops its divider entirely — gold→dark
     has massive natural contrast and a hairline there was only
     adding visual noise. */
  background:
    linear-gradient(
      ${(p) => (p.$isRight ? "to right" : "to left")},
      color-mix(in srgb, ${C.vermillionBright} 70%, ${C.ink} 30%) 0%,
      color-mix(in srgb, ${C.vermillionBright} 70%, ${C.ink} 30%) 14%,
      rgba(8, 10, 18, 0.96) 14%,
      rgba(8, 10, 18, 0.96) 16%,
      color-mix(in srgb, ${C.gold} 74%, ${C.ink} 26%) 16%,
      color-mix(in srgb, ${C.gold} 74%, ${C.ink} 26%) 50%,
      rgba(8, 10, 18, 0.96) 50%,
      rgba(8, 10, 18, 0.96) 100%
    );
  /* Box-shadow stack reads outermost → innermost:
       1. inset 0 1px 2px / inset 0 -1px 1px — top + bottom
          recessed shadows that give the bar a "pressed-in well"
          feel (unchanged from before).
       2. inset 0 0 0 1px <border> — the visible 1px border ring
          on the inside edge. Cream at rest, vermillion in danger.
       3. inset 0 0 0 2px <sumi mat> — a 1px DARK sumi mat sitting
          INSIDE the border ring. Renders behind the border so only
          the inner 1px is visible. Critical for danger state: when
          the border goes vermillion, this mat keeps it visually
          separated from the vermillion kill zone — without the mat
          the red border and the red kill zone read as one
          continuous red blob. Also helps every other zone (the
          gold throw zone has cleaner edges, the dark safe zone
          gets a subtle inner frame).
       4. 0 1px 2px outer drop shadow — sits the bar on the HUD
          gradient. */
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.85),
    inset 0 -1px 1px rgba(0, 0, 0, 0.4),
    inset 0 0 0 1px ${(p) =>
      p.$danger
        ? "rgba(216, 59, 39, 0.95)"
        : "rgba(245, 236, 217, 0.32)"},
    inset 0 0 0 2px rgba(8, 10, 18, 0.85),
    0 1px 2px rgba(0, 0, 0, 0.5);
  /* Static box-shadow above is the resting / non-danger ring. When
     $danger fires, the alarm pulse keyframe takes over the box-shadow
     property entirely on a 0.78s strobe — same cadence as the gassed
     lane's alarm pulse so both danger signals beat in sync. */
  transition: box-shadow 220ms ease;
  /* Animation priority: a perfect-parry gain pulse briefly preempts the
   * danger strobe so the reward is visible even when balance is low.
   * When the gain animation finishes ($gaining is reset by the parent
   * after 700ms), the danger strobe resumes naturally on next render. */
  ${(p) =>
    p.$gaining
      ? balanceGainTrackOverlay
      : p.$danger &&
        css`
          animation: ${balanceAlarmPulse} 0.78s ease-in-out infinite;
        `}
`;

/* Stance gauge fill — ICE BLUE mawashi-cloth wrap.
 *
 * Sized FLUSH with the track (no inset on top/bottom/anchor edge), so
 * the colored zone background never looks bigger than the bar itself.
 *
 * Stays ice blue in EVERY state (no danger color shift). The previous
 * pass had a vermillion fill on top of a vermillion kill zone
 * background — red on red, the bar vanished. Keeping the fill ice
 * blue means it always pops against whatever zone it's sitting in
 * (blue on red kill / blue on gold throw / blue on ink safe), so you
 * can read your balance level at a glance regardless of the danger
 * state. The alarm reading is carried by the track border + outer
 * glow + the visible kill zone background behind the fill.
 *
 * THREE pieces of character added in this pass to fix the "boring
 * flat blue rectangle" feel:
 *
 *   1. Squared edges (1px chamfer instead of pill rounding). Reads as
 *      a printed precision marker rather than a candy capsule. Matches
 *      the squared-off broadcast aesthetic the rest of the HUD uses.
 *
 *   2. Fabric-weave horizontal bands inside the fill. Subtle 1px
 *      darker-blue stripes every ~3.5px, evoking the visible wrap
 *      layers on a real wrestler's mawashi belt. The stance gauge
 *      represents the wrestler's physical balance, which is held by
 *      the mawashi — so the bar literally looking like fabric layers
 *      is thematically tight. Subtle enough to not dominate, present
 *      enough to register as texture instead of flat paint.
 *
 *   3. Leading-edge cream marker (::after). A 3px bright cream stripe
 *      at the side of the fill that recedes as balance drains — the
 *      "current position" punctuation mark. Asymmetric on purpose,
 *      gives the bar a directional READ instead of being symmetric
 *      from both ends. As balance drops, this marker is what you
 *      visually track moving toward the kill zone.
 *
 * Vertical gradient (bright top → mid → deep) preserved for sheen. */
const BalFill = styled.div.attrs((p) => ({
  style: {
    width: `${p.$balance}%`,
  },
}))`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$isRight ? "left: 0;" : "right: 0;")}
  border-radius: 1px;
  transition: width 0.25s ease;
  z-index: 1;
  overflow: hidden;

  background:
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 2.5px,
      rgba(20, 60, 90, 0.32) 2.5px,
      rgba(20, 60, 90, 0.32) 3.5px
    ),
    linear-gradient(
      180deg,
      ${C.iceBright} 0%,
      ${C.ice} 50%,
      ${C.iceMid} 100%
    );

  box-shadow:
    0 0 5px ${C.iceGlow},
    inset 0 -1px 1px rgba(0, 0, 0, 0.5);

  /* Top sheen — frosty white catch on the upper half, sells the polished
   * mawashi-silk surface. */
  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 45%;
    background: linear-gradient(
      180deg,
      rgba(245, 252, 255, 0.5) 0%,
      rgba(220, 240, 255, 0.12) 70%,
      transparent 100%
    );
    border-radius: 1px 1px 0 0;
    pointer-events: none;
  }

  /* Leading-edge marker — bright cream stripe pinned to the side that
   * recedes as balance drains. Acts as the gauge's "indicator tip" —
   * the moving punctuation mark you visually track as your balance
   * pushes toward the danger zones. Glow on the inner edge so it
   * reads as a lit marker instead of a flat decal. */
  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    ${(p) => (p.$isRight ? "right: 0;" : "left: 0;")}
    width: clamp(2px, 0.32cqh, 3px);
    background: linear-gradient(
      180deg,
      rgba(245, 252, 255, 0.95) 0%,
      rgba(245, 252, 255, 0.78) 100%
    );
    box-shadow:
      ${(p) =>
        p.$isRight
          ? "-1px 0 4px rgba(245, 252, 255, 0.55)"
          : "1px 0 4px rgba(245, 252, 255, 0.55)"};
    pointer-events: none;
  }
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

const PowerUpChargeBadge = styled.div`
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
  top: clamp(14px, 3cqh, 36px);
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
  player1PumoArmySpawnsRemaining = null,
  player1IsGassed = false,
  player1ParryRefund = 0,
  player1Balance = 100,
  player1BalanceGain = 0,
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

  // ── Perfect-parry balance gain flash ──
  // Each truthy value (a server timestamp) drives a 700ms inner-fill +
  // outer-track pulse on the balance gauge. The state stores the
  // timestamp so it can also serve as the React key that remounts the
  // overlay components, replaying their CSS animation cleanly.
  const [p1BalGainKey, setP1BalGainKey] = useState(0);
  const [p2BalGainKey, setP2BalGainKey] = useState(0);
  const p1BalGainTimer = useRef(null);
  const p2BalGainTimer = useRef(null);

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
            <BalStripWrap
              $isRight={false}
              $danger={b1Danger}
              $matchOver={matchOver}
            >
              <BalTrack
                $isRight={false}
                $danger={b1Danger}
                $gaining={p1BalGainKey > 0}
              >
                <BalFill $balance={b1} $danger={b1Danger} $isRight={false} />
                {p1BalGainKey > 0 && (
                  <>
                    <BalanceGainFlash
                      key={`p1bg-flash-${p1BalGainKey}`}
                      $balance={b1}
                      $isRight={false}
                    />
                    <BalanceGainSweep
                      key={`p1bg-sweep-${p1BalGainKey}`}
                      $isRight={false}
                    />
                  </>
                )}
              </BalTrack>
            </BalStripWrap>
          </GaugeStack>
          <PowerUpSlot
            $active={player1ActivePowerUp}
            $cooldown={getPowerUpIsOnCooldown(
              player1ActivePowerUp,
              player1SnowballCooldown,
              player1PumoArmyCooldown,
              player1PumoArmySpawnsRemaining
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
                <PowerUpChargeBadge>
                  {Math.max(0, player1SnowballThrowsRemaining)}
                </PowerUpChargeBadge>
              )}
            {player1ActivePowerUp === "pumo_army" &&
              Number.isFinite(player1PumoArmySpawnsRemaining) && (
                <PowerUpChargeBadge>
                  {Math.max(0, player1PumoArmySpawnsRemaining)}
                </PowerUpChargeBadge>
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
            <BalStripWrap
              $isRight={true}
              $danger={b2Danger}
              $matchOver={matchOver}
            >
              <BalTrack
                $isRight={true}
                $danger={b2Danger}
                $gaining={p2BalGainKey > 0}
              >
                <BalFill $balance={b2} $danger={b2Danger} $isRight={true} />
                {p2BalGainKey > 0 && (
                  <>
                    <BalanceGainFlash
                      key={`p2bg-flash-${p2BalGainKey}`}
                      $balance={b2}
                      $isRight={true}
                    />
                    <BalanceGainSweep
                      key={`p2bg-sweep-${p2BalGainKey}`}
                      $isRight={true}
                    />
                  </>
                )}
              </BalTrack>
            </BalStripWrap>
          </GaugeStack>
          <PowerUpSlot
            $active={player2ActivePowerUp}
            $cooldown={getPowerUpIsOnCooldown(
              player2ActivePowerUp,
              player2SnowballCooldown,
              player2PumoArmyCooldown,
              player2PumoArmySpawnsRemaining
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
                <PowerUpChargeBadge>
                  {Math.max(0, player2SnowballThrowsRemaining)}
                </PowerUpChargeBadge>
              )}
            {player2ActivePowerUp === "pumo_army" &&
              Number.isFinite(player2PumoArmySpawnsRemaining) && (
                <PowerUpChargeBadge>
                  {Math.max(0, player2PumoArmySpawnsRemaining)}
                </PowerUpChargeBadge>
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
  player1PumoArmySpawnsRemaining: PropTypes.number,
  player1IsGassed: PropTypes.bool,
  player1ParryRefund: PropTypes.number,
  player1Balance: PropTypes.number,
  player1BalanceGain: PropTypes.number,
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
  matchOver: PropTypes.bool,
};

export default React.memo(UiPlayerInfo);
