import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

import pumo from "../assets/pumo.png";
import {
  SPRITE_BASE_COLOR,
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
} from "../utils/SpriteRecolorizer";
import { C } from "./menuTheme";

/*
 * PreMatchScreen — "broadcast lower-third over the live dohyo".
 *
 * Design intent (rewritten from a much busier earlier pass):
 *   - The dohyo, gyoji and crowd are rendering behind us. They are the
 *     star. We sit on top as a confident NHK-style broadcast overlay,
 *     not as a fullscreen splash.
 *   - The center of the frame is *transparent* — the gyoji standing
 *     between the two wrestler vignettes IS the visual "VS". We do
 *     not draw a sunburst, hotspot or glowing "VS" on top of him.
 *   - Color is rationed. Vermillion is the broadcast accent (LIVE,
 *     hanko stamp, single inner rule). Each player's mawashi color
 *     is their *only* personal color signature. No more red-tinted
 *     vs blue-tinted player cards.
 *   - One staggered fade-up animation. No shimmer, no halo drift, no
 *     conic sun rays, no multi-glow text shadows.
 */

// ============================================
// ANIMATIONS
// ============================================
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const liveRedPulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(238, 81, 65, 0.65); }
  60%      { opacity: 0.85; box-shadow: 0 0 0 6px rgba(238, 81, 65, 0); }
`;

// ============================================
// SCREEN BASE
// ============================================
const ScreenContainer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10000;
  animation: ${fadeIn} 0.3s ease-out;
  overflow: hidden;
  font-family: "Outfit", sans-serif;
  pointer-events: auto;
`;

/*
 * Soft radial vignette only. The in-game HUD is hidden via CSS while
 * the prematch screen is up (see App.css `.game-hud.is-prematch-hidden`),
 * so we no longer need a heavy top scrim to mask it — the top of the
 * frame can stay open and let the dohyo / arena ceiling read through.
 * Center stays nearly clear so the gyoji + crowd + ring breathe; the
 * corners darken just enough to give the lower-third chrome a base
 * to sit on.
 */
const SceneVignette = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at 50% 55%,
    rgba(7, 6, 10, 0.0) 0%,
    rgba(7, 6, 10, 0.22) 38%,
    rgba(7, 6, 10, 0.62) 82%,
    rgba(7, 6, 10, 0.82) 100%
  );
`;

/* Paper-grain / film texture — same family as MainMenu. Kept very subtle. */
const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.22;
  mix-blend-mode: overlay;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.022) 0px,
      transparent 1px,
      transparent 2px,
      rgba(255, 255, 255, 0.018) 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.025) 0px,
      transparent 1px,
      transparent 3px
    );
`;

/* Cinematic letterbox bars — anchor the page top/bottom like MainMenu. */
const Letterbox = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  height: clamp(3px, 0.5cqh, 5px);
  background: linear-gradient(180deg, ${C.ink}, ${C.inkSoft});
  z-index: 30;
  pointer-events: none;
  ${(p) => (p.$top ? "top: 0;" : "bottom: 0;")}
`;

// ============================================
// TOP BROADCAST STRIP
// ============================================

/*
 * Flat sumi-ink strip with a single hairline bottom rule — no decorative
 * vermillion side bars, no double border. Reads like real broadcast type
 * sitting on a thin lower-third bar.
 */
const BroadcastBar = styled.div`
  position: absolute;
  top: clamp(14px, 2.2cqh, 24px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  padding: clamp(5px, 0.7cqh, 7px) clamp(16px, 2cqw, 24px);
  background: rgba(7, 6, 10, 0.72);
  border-bottom: 1px solid rgba(245, 236, 217, 0.18);
  backdrop-filter: blur(6px);
  z-index: 40;
  animation: ${fadeUp} 0.45s ease-out 0.05s backwards;
`;

const BroadcastChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.72cqw, 0.58rem);
  color: ${(p) => (p.$accent ? C.gold : C.creamMute)};
  letter-spacing: 0.24em;
  text-transform: uppercase;
  white-space: nowrap;

  strong {
    color: ${C.cream};
    font-weight: 700;
    letter-spacing: 0.06em;
  }
`;

const BroadcastDivider = styled.span`
  width: 1px;
  height: 11px;
  background: rgba(245, 236, 217, 0.18);
`;

/*
 * LIVE indicator — flat red square block, single bright dot. No pillowy
 * gradient, no inner-highlight, no puffy glow. Reads like an actual
 * studio "ON-AIR" tally light, not a button.
 */
const LiveIndicator = styled.div`
  position: absolute;
  top: clamp(14px, 2.2cqh, 24px);
  right: clamp(20px, 2.6cqw, 36px);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: clamp(5px, 0.7cqh, 7px) clamp(11px, 1.4cqw, 16px);
  background: rgba(7, 6, 10, 0.85);
  border: 1px solid ${C.vermillion};
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.95cqw, 0.78rem);
  color: ${C.cream};
  letter-spacing: 0.3em;
  text-transform: uppercase;
  z-index: 40;
  backdrop-filter: blur(6px);
  animation: ${fadeUp} 0.45s ease-out 0.05s backwards;
`;

const LiveDot = styled.span`
  width: 8px;
  height: 8px;
  background: ${C.vermillionBright};
  animation: ${liveRedPulse} 1.6s ease-out infinite;
`;

// ============================================
// HANKO STAMP — replaces the old VS sunburst
// ============================================

/*
 * A small, dignified vermillion hanko stamp sits in the upper-center of
 * the screen, ABOVE the action so it does not cover the gyoji. The
 * gyoji standing between the two wrestlers does the work of "VS" on
 * his own — we just need a tiny title card. Two characters, 取組
 * (torikumi = "the matchup"), in a serif Mincho stamp face. This is
 * specifically rare in fighting-game UI; it reads like a real sumo
 * program rather than a shounen anime intercard.
 */
const HankoStamp = styled.div`
  position: absolute;
  top: clamp(54px, 7cqh, 88px);
  left: 50%;
  transform: translateX(-50%) rotate(-2deg);
  width: clamp(56px, 6.5cqw, 88px);
  height: clamp(56px, 6.5cqw, 88px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 2px 4px;
  background: ${C.vermillion};
  border: 1.5px solid ${C.vermillionDeep};
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.55),
    inset 0 0 0 2px rgba(245, 236, 217, 0.12);
  z-index: 25;
  animation: ${fadeUp} 0.6s ease-out 0.35s backwards;

  /* tiny inkbleed corner notch — looks like an old worn stamp */
  &::after {
    content: "";
    position: absolute;
    top: -2px;
    right: -2px;
    width: 4px;
    height: 4px;
    background: ${C.vermillion};
    transform: rotate(45deg);
    opacity: 0.6;
  }
`;

const HankoKanji = styled.div`
  font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  font-weight: 900;
  font-size: clamp(14px, 1.7cqw, 22px);
  color: ${C.cream};
  line-height: 1;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
`;

const HankoVs = styled.div`
  margin-top: 2px;
  font-family: "Bungee", cursive;
  font-size: clamp(7px, 0.85cqw, 10px);
  color: ${C.cream};
  letter-spacing: 0.18em;
  line-height: 1;
  opacity: 0.85;
`;

// ============================================
// STAGE — left wrestler | open center | right wrestler
// ============================================

/*
 * Three-column grid. The center column is intentionally empty so the
 * gyoji and dohyo read through cleanly. The two wrestler panels live
 * in the outer columns and frame the scene like a real broadcast
 * pre-bout split-screen.
 */
const Stage = styled.div`
  position: absolute;
  top: clamp(72px, 11cqh, 118px);
  left: clamp(40px, 8cqw, 140px);
  right: clamp(40px, 8cqw, 140px);
  bottom: clamp(180px, 26cqh, 280px);
  display: grid;
  grid-template-columns: 1fr clamp(140px, 16cqw, 240px) 1fr;
  gap: clamp(8px, 1.2cqw, 18px);
  align-items: stretch;
  pointer-events: none;
`;

/*
 * Wrestler panel — a deliberately understated window. Compared to the
 * earlier loud version this has:
 *   - NO per-side color tinting (no red wash on East, no blue wash on West)
 *   - NO glowing vermillion+gold "torii" bar at the inner edge
 *   - NO halo glow behind the penguin
 * What it DOES keep, intentionally, is the trading-card composition:
 * the panel is a tall rectangle with overflow:hidden, and the wrestler
 * image extends below the panel's bottom edge so the feet are cropped
 * naturally. This gives the wrestler a confident "above the fold"
 * presence and lets the head + belly + mawashi do the work.
 */
const WrestlerPanel = styled.div`
  position: relative;
  align-self: stretch;
  ${(p) => (p.$side === "left" ? "justify-self: end;" : "justify-self: start;")}
  width: 100%;
  max-width: clamp(260px, 30cqw, 400px);
  overflow: hidden;
  background:
    /* faint inkwash floor — anchors the wrestler without boxing them in */
    linear-gradient(
      180deg,
      rgba(7, 6, 10, 0.18) 0%,
      rgba(7, 6, 10, 0.42) 65%,
      rgba(7, 6, 10, 0.78) 100%
    );
  border: 1px solid rgba(245, 236, 217, 0.16);
  box-shadow:
    0 14px 30px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(245, 236, 217, 0.05);
  animation: ${fadeUp} 0.55s ease-out 0.2s backwards;
`;

/*
 * Big cream kanji watermark behind the wrestler. No color tint, no glow —
 * reads like real sumi-ink brushwork on washi paper, not a colored decal.
 * Sized to fill the panel, anchored to the side closest to its column
 * edge so it reads as a stamp behind the wrestler.
 */
const KanjiWatermark = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.$side === "left" ? "flex-start" : "flex-end")};
  font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  font-weight: 900;
  font-size: clamp(220px, 38cqw, 520px);
  line-height: 0.78;
  letter-spacing: -0.04em;
  color: rgba(245, 236, 217, 0.13);
  pointer-events: none;
  user-select: none;
  z-index: 1;
  text-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
  ${(p) =>
    p.$side === "left"
      ? "transform: translateX(-6%) translateY(-2%);"
      : "transform: translateX(6%) translateY(-2%);"}
`;

/*
 * Tiny corner tag for East / West. Quiet broadcast type, no chip,
 * no diamond — just a label that lives inside the panel corner.
 */
const SideTag = styled.div`
  position: absolute;
  top: clamp(10px, 1.4cqh, 16px);
  ${(p) => (p.$side === "left" ? "left: clamp(12px, 1.4cqw, 18px);" : "right: clamp(12px, 1.4cqw, 18px);")}
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  z-index: 5;
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.85cqw, 0.65rem);
  color: ${C.creamMute};
  letter-spacing: 0.32em;
  text-transform: uppercase;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);

  span.kanji {
    font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
    font-weight: 700;
    color: ${C.cream};
    letter-spacing: 0;
    font-size: 1.3em;
  }
`;

/*
 * Rank plaque — restrained gold-on-ink chip. One thin gold left rule
 * is the only color accent.
 */
const RankPlaque = styled.div`
  position: absolute;
  top: clamp(10px, 1.4cqh, 16px);
  ${(p) => (p.$side === "left" ? "right: clamp(8px, 1cqw, 14px);" : "left: clamp(8px, 1cqw, 14px);")}
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  background: rgba(7, 6, 10, 0.78);
  border: 1px solid rgba(232, 197, 71, 0.32);
  border-left: 2px solid ${C.gold};
  z-index: 6;
  backdrop-filter: blur(4px);
`;

const RankText = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(9px, 1.1cqw, 13px);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.18em;
  line-height: 1;
  text-shadow: 0 1px 0 #000;
  white-space: nowrap;
`;

const RankDiamond = styled.span`
  width: 4px;
  height: 4px;
  background: ${C.gold};
  transform: rotate(45deg);
  flex-shrink: 0;
`;

/*
 * Wrestler image — anchored to the TOP of the panel with the bottom
 * extending past the panel edge so the feet are clipped naturally by
 * the panel's overflow:hidden. Same trading-card crop as a real sumo
 * banzuke or wrestler card: head sits high, belly fills the middle,
 * lower body cropped past the edge. One tight contact shadow only,
 * no cream halo, no double drop.
 */
const WrestlerImageWrap = styled.div`
  position: absolute;
  top: clamp(36px, 4.8cqh, 60px);
  left: 0;
  right: 0;
  bottom: -28%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 4;
`;

const WrestlerImage = styled.img`
  width: auto;
  height: 100%;
  max-width: 110%;
  object-fit: contain;
  transform: ${(p) => (p.$flip ? "scaleX(1)" : "scaleX(-1)")};
  filter: drop-shadow(0 18px 14px rgba(0, 0, 0, 0.6));
  opacity: ${(p) => (p.$ready ? 1 : 0)};
  transition: opacity 0.3s ease-out;
`;

// ============================================
// LOWER-THIRD MATCHUP CARD
// ============================================

/*
 * One unified bottom strip with three cells: left player | center meta
 * | right player. Same desaturated chrome on both sides — the only
 * per-side color signature is the mawashi sash beneath each player.
 */
const LowerThird = styled.div`
  position: absolute;
  left: clamp(40px, 8cqw, 140px);
  right: clamp(40px, 8cqw, 140px);
  bottom: clamp(48px, 7cqh, 88px);
  display: grid;
  grid-template-columns: 1fr clamp(120px, 14cqw, 200px) 1fr;
  align-items: stretch;
  background: rgba(7, 6, 10, 0.86);
  border-top: 1px solid rgba(245, 236, 217, 0.18);
  border-bottom: 1px solid rgba(245, 236, 217, 0.1);
  backdrop-filter: blur(8px);
  box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.55);
  animation: ${fadeUp} 0.55s ease-out 0.4s backwards;
`;

const PlayerSlot = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(3px, 0.45cqh, 6px);
  padding: clamp(12px, 1.5cqh, 18px) clamp(18px, 2.2cqw, 30px)
    clamp(16px, 1.9cqh, 22px);
  text-align: ${(p) => (p.$side === "left" ? "left" : "right")};
  align-items: ${(p) => (p.$side === "left" ? "flex-start" : "flex-end")};
  overflow: hidden;
`;

const StableLine = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.5rem, 0.82cqw, 0.66rem);
  color: ${C.gold};
  letter-spacing: 0.26em;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const PlayerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(16px, 2.4cqw, 32px);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.05;
  text-shadow: 0 2px 0 #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

/*
 * One row of meta type that combines style + record. No chips, no
 * pills, no per-side colored backgrounds — just typography with thin
 * vertical separators.
 */
const MetaRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-direction: ${(p) => (p.$side === "left" ? "row" : "row-reverse")};
  gap: clamp(8px, 1cqw, 14px);
  margin-top: clamp(2px, 0.3cqh, 4px);
`;

const StyleLabel = styled.span`
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  font-size: clamp(0.5rem, 0.82cqw, 0.65rem);
  color: ${C.cream};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #000;
`;

const MetaSep = styled.span`
  width: 1px;
  height: 12px;
  background: rgba(245, 236, 217, 0.22);
`;

const RecordText = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1cqw, 0.85rem);
  color: ${C.cream};
  letter-spacing: 0.04em;
  text-shadow: 0 1px 0 #000;

  small {
    font-size: 0.7em;
    color: ${C.creamMute};
    letter-spacing: 0.1em;
  }
`;

/*
 * Mawashi sash — a clean flat band of the player's actual mawashi
 * color along the bottom edge. NO outer glow, no halo — the mawashi
 * IS the player's color signature, so we let it be confident on its
 * own. Special-pattern mawashis (rainbow / camo / etc) keep their
 * pattern but lose the gold-glow shadow that previously tried to
 * "celebrate" them.
 */
const MawashiSash = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: clamp(3px, 0.4cqh, 5px);
  background: ${(p) => p.$gradient || p.$color || C.ice};
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
`;

/*
 * Center pillar in the lower third — type only, sits on the same flat
 * sumi-ink ground as the rest of the strip. No colored gradient
 * background, no double border accents. The vertical hairlines on
 * either side give it just enough separation.
 */
const CenterPillar = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.5cqh, 7px);
  padding: clamp(12px, 1.5cqh, 18px) clamp(8px, 1cqw, 14px);
  border-left: 1px solid rgba(245, 236, 217, 0.14);
  border-right: 1px solid rgba(245, 236, 217, 0.14);
`;

const CenterFormatLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.15cqw, 0.95rem);
  color: ${C.cream};
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-shadow: 0 2px 0 #000;
`;

const CenterFormatSub = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.46rem, 0.78cqw, 0.6rem);
  color: ${C.creamMute};
  letter-spacing: 0.32em;
  text-transform: uppercase;
`;

const CenterDivider = styled.span`
  width: 32px;
  height: 1px;
  background: ${C.vermillion};
  opacity: 0.7;
`;

// ============================================
// LOADING — bottom-center
// ============================================

const LoadingContainer = styled.div`
  position: absolute;
  bottom: clamp(16px, 2.4cqh, 28px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(5px, 0.7cqh, 8px);
  z-index: 100;
  animation: ${fadeUp} 0.5s ease-out 0.55s backwards;
`;

/* Slim flat progress bar — no gradient, no shimmer. Tick marks at
   25/50/75% give it a diagrammatic, broadcast-graphic feel. */
const LoadingBar = styled.div`
  position: relative;
  width: clamp(180px, 22cqw, 300px);
  height: clamp(3px, 0.32cqh, 4px);
  background: rgba(245, 236, 217, 0.12);
  overflow: hidden;

  /* tick marks */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, transparent 24.5%, rgba(245, 236, 217, 0.35) 24.5%, rgba(245, 236, 217, 0.35) 25.5%, transparent 25.5%),
      linear-gradient(90deg, transparent 49.5%, rgba(245, 236, 217, 0.35) 49.5%, rgba(245, 236, 217, 0.35) 50.5%, transparent 50.5%),
      linear-gradient(90deg, transparent 74.5%, rgba(245, 236, 217, 0.35) 74.5%, rgba(245, 236, 217, 0.35) 75.5%, transparent 75.5%);
    z-index: 2;
    pointer-events: none;
  }
`;

const LoadingProgress = styled.div`
  height: 100%;
  width: ${(p) => p.$progress}%;
  background: ${C.vermillion};
  transition: width 0.3s ease-out;
`;

const LoadingText = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.78cqw, 0.58rem);
  color: ${C.creamMute};
  letter-spacing: 0.36em;
  text-transform: uppercase;
`;

// ============================================
// HELPERS
// ============================================
export const SPECIAL_MAWASHI_GRADIENTS = {
  rainbow:
    "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
  fire: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)",
  vaporwave: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)",
  camo: "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)",
  galaxy: "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
  gold: "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
};

const DOJO_NAMES = [
  "Ice Floe Dojo",
  "Blizzard Hall",
  "Glacier Peak",
  "Frostbite Stable",
  "Snowdrift Gym",
  "Penguin Palace",
  "Arctic Thunder",
  "Frozen Tundra",
];

const FIGHTING_STYLES = [
  "Pusher",
  "Grappler",
  "Technician",
  "Power",
  "Speed",
  "Balanced",
];

const getSeededValue = (name, array) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash = hash & hash;
  }
  return array[Math.abs(hash) % array.length];
};

const getRank = (wins, losses) => {
  const total = wins + losses;
  const winRate = total > 0 ? wins / total : 0;

  if (wins >= 50 && winRate >= 0.7) return { title: "YOKOZUNA", number: "" };
  if (wins >= 30 && winRate >= 0.6) return { title: "OZEKI", number: "" };
  if (wins >= 20 && winRate >= 0.55) return { title: "SEKIWAKE", number: "" };
  if (wins >= 10)
    return {
      title: "KOMUSUBI",
      number: `#${Math.max(1, 10 - Math.floor(wins / 5))}`,
    };
  if (wins >= 5)
    return { title: "MAEGASHIRA", number: `#${Math.max(1, 15 - wins)}` };
  if (wins >= 2)
    return { title: "JONIDAN", number: `#${Math.max(1, 50 - wins * 10)}` };
  return { title: "JONOKUCHI", number: "" };
};

// ============================================
// COMPONENT
// ============================================
const PreMatchScreen = ({
  player1Name = "Player 1",
  player2Name = "Player 2",
  player1Color = SPRITE_BASE_COLOR,
  player2Color = "#D94848",
  player1BodyColor = null,
  player2BodyColor = null,
  player1Record = { wins: 0, losses: 0 },
  player2Record = { wins: 0, losses: 0 },
  loadingProgress = 0,
  isLoading = true,
  isCPUMatch = false,
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [player1Sprite, setPlayer1Sprite] = useState(pumo);
  const [player2Sprite, setPlayer2Sprite] = useState(pumo);
  const [spritesReady, setSpritesReady] = useState(false);

  const player1Dojo = getSeededValue(player1Name, DOJO_NAMES);
  const player2Dojo = getSeededValue(player2Name, DOJO_NAMES);
  const player1Style = getSeededValue(player1Name + "style", FIGHTING_STYLES);
  const player2Style = getSeededValue(player2Name + "style", FIGHTING_STYLES);
  const player1Rank = getRank(player1Record.wins, player1Record.losses);
  const player2Rank = getRank(player2Record.wins, player2Record.losses);

  useEffect(() => {
    let cancelled = false;
    setSpritesReady(false);

    const recolorSprites = async () => {
      const p1BodyOpts = player1BodyColor
        ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: player1BodyColor }
        : {};
      const p2BodyOpts = player2BodyColor
        ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: player2BodyColor }
        : {};

      const p1Needs =
        (player1Color && player1Color !== SPRITE_BASE_COLOR) || player1BodyColor;
      const p2Needs =
        (player2Color && player2Color !== SPRITE_BASE_COLOR) || player2BodyColor;

      const p1Promise = p1Needs
        ? recolorImage(
            pumo,
            BLUE_COLOR_RANGES,
            player1Color || SPRITE_BASE_COLOR,
            p1BodyOpts
          ).catch((err) => {
            console.error("Failed to recolor player 1 sprite:", err);
            return pumo;
          })
        : Promise.resolve(pumo);

      const p2Promise = p2Needs
        ? recolorImage(
            pumo,
            BLUE_COLOR_RANGES,
            player2Color || SPRITE_BASE_COLOR,
            p2BodyOpts
          ).catch((err) => {
            console.error("Failed to recolor player 2 sprite:", err);
            return pumo;
          })
        : Promise.resolve(pumo);

      const [p1, p2] = await Promise.all([p1Promise, p2Promise]);
      if (cancelled) return;
      setPlayer1Sprite(p1);
      setPlayer2Sprite(p2);
      setSpritesReady(true);
    };

    recolorSprites();
    return () => {
      cancelled = true;
    };
  }, [player1Color, player2Color, player1BodyColor, player2BodyColor]);

  useEffect(() => {
    const target = Math.min(loadingProgress, 100);
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= target) {
          clearInterval(timer);
          return target;
        }
        return prev + 2;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [loadingProgress]);

  const p1MawashiColor =
    player1Color === SPRITE_BASE_COLOR ? C.ice : player1Color;
  const p2MawashiColor = player2Color;
  const p1Gradient = SPECIAL_MAWASHI_GRADIENTS[player1Color];
  const p2Gradient = SPECIAL_MAWASHI_GRADIENTS[player2Color];

  return (
    <ScreenContainer>
      <SceneVignette />
      <GrainOverlay />
      <Letterbox $top />
      <Letterbox />

      <BroadcastBar>
        <BroadcastChip $accent>
          <strong>BASHO</strong>·HATSU
        </BroadcastChip>
        <BroadcastDivider />
        <BroadcastChip>Day 01</BroadcastChip>
        <BroadcastDivider />
        <BroadcastChip>
          Bout&nbsp;<strong>01</strong>
        </BroadcastChip>
        <BroadcastDivider />
        <BroadcastChip>Pumo·Sports</BroadcastChip>
      </BroadcastBar>

      <LiveIndicator>
        <LiveDot />
        Live
      </LiveIndicator>

      {/* Hanko stamp sits high-center, above the gyoji, so it never
          covers the live action. The gyoji standing between the two
          wrestlers carries the visual "VS" on his own. */}
      <HankoStamp aria-hidden>
        <HankoKanji>取組</HankoKanji>
        <HankoVs>VS</HankoVs>
      </HankoStamp>

      <Stage>
        {/* LEFT WRESTLER — East / 東 */}
        <WrestlerPanel $side="left">
          <KanjiWatermark $side="left" aria-hidden>
            東
          </KanjiWatermark>
          <SideTag $side="left" aria-hidden>
            <span className="kanji">東</span> East
          </SideTag>
          <RankPlaque $side="left">
            <RankText>{player1Rank.title}</RankText>
            {player1Rank.number && (
              <>
                <RankDiamond />
                <RankText>{player1Rank.number}</RankText>
              </>
            )}
          </RankPlaque>
          <WrestlerImageWrap $side="left">
            <WrestlerImage
              src={player1Sprite}
              alt={player1Name}
              $flip={false}
              $ready={spritesReady}
            />
          </WrestlerImageWrap>
        </WrestlerPanel>

        {/* CENTER COLUMN — intentionally empty so the gyoji + dohyo
            scene reads through. */}
        <div />

        {/* RIGHT WRESTLER — West / 西 */}
        <WrestlerPanel $side="right">
          <KanjiWatermark $side="right" aria-hidden>
            西
          </KanjiWatermark>
          <SideTag $side="right" aria-hidden>
            West <span className="kanji">西</span>
          </SideTag>
          <RankPlaque $side="right">
            <RankText>{player2Rank.title}</RankText>
            {player2Rank.number && (
              <>
                <RankDiamond />
                <RankText>{player2Rank.number}</RankText>
              </>
            )}
          </RankPlaque>
          <WrestlerImageWrap $side="right">
            <WrestlerImage
              src={player2Sprite}
              alt={player2Name}
              $flip={true}
              $ready={spritesReady}
            />
          </WrestlerImageWrap>
        </WrestlerPanel>
      </Stage>

      <LowerThird>
        <PlayerSlot $side="left">
          <StableLine>{player1Dojo}</StableLine>
          <PlayerName>{player1Name}</PlayerName>
          <MetaRow $side="left">
            <StyleLabel>{player1Style}</StyleLabel>
            <MetaSep />
            <RecordText>
              {player1Record.wins}<small>W</small>
              <span style={{ opacity: 0.45, margin: "0 2px" }}>·</span>
              {player1Record.losses}<small>L</small>
            </RecordText>
          </MetaRow>
          <MawashiSash $color={p1MawashiColor} $gradient={p1Gradient} />
        </PlayerSlot>

        <CenterPillar>
          <CenterFormatLabel>
            {isCPUMatch ? "VS CPU" : "EXHIBITION"}
          </CenterFormatLabel>
          <CenterDivider />
          <CenterFormatSub>Match&nbsp;01</CenterFormatSub>
        </CenterPillar>

        <PlayerSlot $side="right">
          <StableLine>{player2Dojo}</StableLine>
          <PlayerName>{player2Name}</PlayerName>
          <MetaRow $side="right">
            <StyleLabel>{player2Style}</StyleLabel>
            <MetaSep />
            <RecordText>
              {player2Record.wins}<small>W</small>
              <span style={{ opacity: 0.45, margin: "0 2px" }}>·</span>
              {player2Record.losses}<small>L</small>
            </RecordText>
          </MetaRow>
          <MawashiSash $color={p2MawashiColor} $gradient={p2Gradient} />
        </PlayerSlot>
      </LowerThird>

      {isLoading && (
        <LoadingContainer>
          <LoadingBar>
            <LoadingProgress $progress={displayProgress} />
          </LoadingBar>
          <LoadingText>Preparing the Dohyo</LoadingText>
        </LoadingContainer>
      )}
    </ScreenContainer>
  );
};

PreMatchScreen.propTypes = {
  player1Name: PropTypes.string,
  player2Name: PropTypes.string,
  player1Color: PropTypes.string,
  player2Color: PropTypes.string,
  player1BodyColor: PropTypes.string,
  player2BodyColor: PropTypes.string,
  player1Record: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  player2Record: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  loadingProgress: PropTypes.number,
  isLoading: PropTypes.bool,
  isCPUMatch: PropTypes.bool,
};

export default PreMatchScreen;
