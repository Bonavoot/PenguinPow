import { useCallback, useContext, useEffect, useState, useRef } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import Snowfall from "./Snowfall";
import lobbyBackground from "../assets/lockerroom.webp";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
} from "../utils/SpriteRecolorizer";
import pumo from "../assets/pumo-idle.png";
import {
  C,
  slideInLeft,
  slideInRight,
  clipRevealUp,
  arrowNudge,
  livePulse,
} from "./menuTheme";

// ============================================
// LOCAL ANIMATIONS
// ============================================

const breathe = keyframes`
  0%, 100% { transform: scaleY(1);     }
  50%      { transform: scaleY(1.022); }
`;

const dotPulse = keyframes`
  0%, 100% { transform: scale(1);   opacity: 0.45; }
  50%      { transform: scale(1.3); opacity: 1; }
`;

/*
 * VS hanko stamp — quick downward press / settle / brief lift.
 * Reads as a stamp pressing into paper, not a generic UI pulse.
 */
const stampPress = keyframes`
  0%, 100% { transform: rotate(-4deg) scale(1); }
  48%      { transform: rotate(-4deg) scale(1.04); }
  52%      { transform: rotate(-4deg) scale(0.98); }
`;

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const swatchPop = keyframes`
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1); }
`;

// ============================================
// SHELL
// ============================================

const LobbyContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 360px;
  background: ${C.snow};
  overflow: hidden;
  container-type: size;
  font-family: "Space Grotesk", sans-serif;
`;

/*
 * BackgroundImage — the locker room backdrop.
 *
 * SHALLOW-DEPTH-OF-FIELD PASS (the filter stack):
 *   The previous filter stack was tuned for SUBTLE AI dampening — sub-
 *   pixel softening, mild saturation pull, a hint of warmth. Plausible
 *   deniability, but on a sharp display the lockers, banzuke board,
 *   robe folds and wall tiling all still read crisply enough to feel
 *   "rendered" rather than "shot". This pass goes further and commits
 *   to a real cinematic look: the penguin sprites and UI sit in sharp
 *   foreground, and the locker room recedes into out-of-focus backstage
 *   atmosphere — the standard fighting-game character-select move
 *   (Tekken, Street Fighter, etc.).
 *
 *   The filter stack:
 *     - blur(2.4px): real shallow DoF, not pixel-edge cleanup. AI
 *       art's #1 tell is suspiciously perfect linework; out-of-focus
 *       backgrounds ARE the cinematographer's standard answer to
 *       "the set is too detailed and competing with the actors".
 *       2.4px is enough to dissolve the pixel-perfect grout lines and
 *       banzuke micro-text but not so much that the 相撲 noren kanji
 *       stop reading — they soften into "yep, that's a banner with
 *       sumo on it" rather than disappearing.
 *     - brightness(0.86): pushes the room behind the action so the
 *       bright customizable penguins and cream MatchCardBar pop
 *       forward instead of competing with the AI's saturated palette.
 *     - saturate(0.62): heavier pull toward a graded palette. AI
 *       defaults to candy color; films grade it down.
 *     - contrast(1.07): small tonal lift to keep the dimmed image
 *       from going muddy.
 *     - sepia(0.08): a touch of warm toward the highlights, the
 *       universal "this was through a film stock" cue.
 *
 *   Combined with the spotlight-pool CinematicOverlay below and the
 *   paper-grain GrainOverlay, the locker room reads as a backstage
 *   tunnel under stage lighting — fighters about to walk out — rather
 *   than a fresh diffusion render placed behind the UI.
 */
const BackgroundImage = styled.div`
  position: absolute;
  inset: 0;
  /*
   * The user redrew the bg art at a 16:9 aspect (1672x941) with the
   * icicles already removed at the source, so plain cover works
   * cleanly now — no cropping at typical viewports, no need for
   * contain + backdrop-color fallback. Anchored to bottom so the
   * floor stays planted under the penguins on any non-16:9
   * viewport (any vertical overflow gets trimmed off the top,
   * which is wall, instead of off the bottom, which is floor).
   */
  background: url(${lobbyBackground}) center bottom / cover;
  /*
   * Horizontal nudge to the right (+1.1%) WITH a small zoom-in
   * (scale 1.04) so the shift has room to land without exposing
   * the container edge.
   *
   * Why we can't just use background-position: the bg art is 16:9
   * (1672x941) and the lobby is 16:9, so background-size: cover
   * scales the image to EXACTLY fill the container — no overflow
   * on either axis means background-position is a no-op (it only
   * controls clipping when the image is larger than its frame).
   *
   * transform: scale(1.04) on this layer makes the layer 4%
   * larger than the container in BOTH dimensions, regardless of
   * the actual viewport aspect (works on 16:9, ultrawide, and
   * windowed). cover then fills the now-larger layer, which
   * gives us 2% of horizontal overflow on each side — pan
   * headroom for the rightward shift.
   *
   * translateX(1.1%) shifts the layer to the right by 1.1% of
   * the original container width. With 2% headroom on the left,
   * we keep ~0.9% of safety margin against ever exposing the
   * container's left edge.
   *
   * transform-origin: 50% 100% anchors the scale to the bottom
   * center, so the floor stays planted (penguins keep their
   * grounding) and the zoom expands upward and outward.
   *
   * The scale has the nice side effect of slightly tightening
   * the framing — the locker room reads as a touch closer-in,
   * which works in our favor against the shallow-DoF treatment.
   */
  transform: scale(1.04) translateX(1.1%);
  transform-origin: 50% 100%;
  opacity: 0.9;
  filter: saturate(0.62) brightness(0.86) contrast(1.07) sepia(0.08)
    blur(2.4px);
  z-index: 0;
`;

/*
 * CinematicOverlay — backstage stage-light pool + atmospheric dim.
 *
 * Two layered jobs, both sized for the actual composition (penguins
 * standing on the floor at roughly 25%/75% horizontal, floor at the
 * lower third):
 *
 *   1. WIDE SPOTLIGHT POOL — a horizontally-stretched elliptical
 *      gradient centered at 50% 70% (the floor between the fighters).
 *      Transparent at the center, darkening out to a near-black sumi
 *      tone at the corners. This isn't a literal Hollywood spotlight
 *      circle (those look tacky on flat 2D bg), it's a soft pool of
 *      stage light wide enough that BOTH penguins stand inside the
 *      lit zone with no visible "spot edge" on either of them. Side
 *      effect: the AI bg's most artifact-prone zones (corners, top
 *      edges of the locker rims, the framed banzuke board top-right,
 *      the robe folds top-left) all fall into shadow exactly where
 *      we want detail to recede.
 *
 *   2. TOP-DOWN ATMOSPHERIC DIM — a soft vertical wash that drops
 *      luminance over the upper third of the room (where the locker
 *      interiors, towel stacks, banzuke kanji rows and noren rod
 *      live — the AI-detail hotspots). The wash fades back to clear
 *      across the middle and re-darkens at the very bottom so the
 *      cream BottomDeck has a quiet shadow gradient to sit on rather
 *      than a hard edge against bright floor.
 *
 * The two stack additively — corners get hit by both layers and go
 * darkest; the floor pool stays brightest; the upper room sits at
 * mid-dim. Net result: the eye is led to the fighters and the noren
 * banner between them, and the rest of the locker room reads as
 * supporting atmosphere instead of art.
 */
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

/*
 * GrainOverlay — paper grain on top of everything.
 *
 * This is the single most important AI-hiding move. AI imagery is
 * defined by SUSPICIOUS CLEANNESS — every pixel is exactly right,
 * no surface texture, no print artifacts. Real illustration that
 * got reproduced (printed in a program, scanned from a poster, or
 * shipped in a video game with grading) ALWAYS picks up some grain
 * along the way. Adding a low-opacity cross-hatch + speckle grain
 * here makes the bg feel like it lives on a physical surface rather
 * than rendered fresh on a GPU.
 *
 * Two layers stacked: a fine repeating cross-hatch (paper tooth) +
 * a coarser radial speckle (printed dot pattern). Both at low
 * opacity. The mix-blend-mode overlay lets them interact with the
 * underlying color rather than just sitting flat on top.
 */
/*
 * Cross-hatch only — the previous version layered a few large
 * radial-gradient "speckles" on top of the cross-hatch for a
 * printed-dot feel, but with mix-blend-mode: overlay those big
 * radials clustered visibly against flat saturated regions of
 * the bg (noticeable as patchy lighter blobs on the deep blue
 * 相撲 noren). The cross-hatch is uniformly distributed so it
 * doesn't pool against any one color region. Trade: slightly
 * less "printed paper" feel, but no more patches.
 */
const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  /*
   * Bumped from 0.28 → 0.34 to keep the paper-tooth grain present
   * against the now-darker, blurred bg under the spotlight-pool
   * CinematicOverlay. Without this, grain reads at the corners
   * (where the bg is dark and grain is mid-warm) but disappears
   * over the lit floor pool. 0.34 keeps it consistent across the
   * whole frame without becoming visible as a pattern.
   */
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
// TOP BAR — printed match-card header (cream washi paper strip)
// ============================================

/*
 * MatchCardBar — the lobby's printed-program header.
 *
 * Replaces the old generic dark sumi top bar with a CREAM washi
 * paper strip that reads as a printed match card / fight program
 * pinned across the top of the locker room. This gives the
 * lobby a real visual identity at the top instead of yet another
 * dark utility bar.
 *
 * Composition is editorial, not utilitarian:
 *   - left:   Leave button (small, ghost on cream)
 *   - center: TONIGHT'S BOUT label + dohyo / room code, set in
 *             display type with a kanji accent
 *   - right:  match-mode chip (1V1 / VS CPU)
 *
 * Two thin vermillion rules above and below print as the brand
 * "stamp marks" on either edge of the printed program — nothing
 * else uses them, so they read as unique to the header.
 */
const MatchCardBar = styled.header`
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: clamp(10px, 1.8cqw, 22px);
  padding: clamp(8px, 1.4cqh, 14px) clamp(18px, 3cqw, 36px);
  background: ${C.cream};
  border-top: 2px solid ${C.vermillion};
  border-bottom: 2px solid ${C.vermillion};
  /* Soft warm shadow under the printed paper, not on the page */
  box-shadow: 0 3px 10px rgba(50, 30, 10, 0.18);
  animation: ${slideDown} 0.5s ease-out;

  /* Faint grain so the cream reads as paper, not a flat panel */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(
        0deg,
        rgba(60, 40, 20, 0.04) 0,
        transparent 1px,
        transparent 3px
      );
    pointer-events: none;
  }
`;

const TopLeft = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const TopRight = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const ExitButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  padding: clamp(6px, 0.9cqh, 10px) clamp(11px, 1.6cqw, 18px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.55rem, 0.85cqw, 0.7rem);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: ${C.inkTextSoft};
  background: transparent;
  border: 1px solid rgba(60, 40, 20, 0.22);
  border-radius: 0;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease,
    transform 0.18s ease;

  .arrow {
    font-weight: 700;
    transition: transform 0.2s ease;
  }

  &:hover {
    color: ${C.vermillionDeep};
    border-color: ${C.vermillion};
    background: rgba(216, 59, 39, 0.06);
    .arrow { transform: translateX(-3px); }
  }
  &:active { transform: scale(0.98); }
`;

/*
 * MatchCardCenter — the printed center block of the program.
 *
 * Uses display type for the dohyo/room name (the headline of the
 * program) with a small caption row below. The kanji 番付 (banzuke
 * — "ranking sheet") sits as a single-character mark to the left
 * of the headline, giving the printed page a real cultural anchor
 * without leaning on it.
 */
const MatchCardCenter = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 16px);
`;

const MatchCardKanji = styled.span`
  font-family: "Noto Serif JP", serif;
  font-weight: 700;
  font-size: clamp(1.05rem, 1.7cqw, 1.45rem);
  color: ${C.vermillion};
  line-height: 0.9;
`;

const MatchCardLabels = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
`;

const MatchCardCaption = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.65cqw, 0.52rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.36em;
  text-transform: uppercase;
`;

const MatchCardTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.95rem, 1.55cqw, 1.2rem);
  color: ${C.inkText};
  letter-spacing: 0.16em;
  line-height: 1;
  text-transform: uppercase;
`;

/*
 * MatchModeChip — top right "1V1 / VS CPU" mode badge.
 * Compact pill on the cream surface, accented with the gold leaf
 * to balance the vermillion rules at top + bottom of the bar.
 */
const MatchModeChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 10px);
  padding: clamp(5px, 0.7cqh, 8px) clamp(10px, 1.5cqw, 16px);
  background: rgba(15, 20, 30, 0.04);
  border: 1px solid rgba(60, 40, 20, 0.22);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.46rem, 0.72cqw, 0.58rem);
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: ${C.inkTextSoft};

  strong {
    color: ${C.vermillion};
    font-weight: 800;
    letter-spacing: 0.14em;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${C.gold};
  }
`;

// ============================================
// STAGE — penguins in the locker room (no fake dohyo)
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: grid;
  /*
   * Two equal columns now (was 1fr/auto/1fr with a middle "VS"
   * column). The VS wordmark is now positioned absolutely inside
   * Stage instead of occupying its own grid column, which lets
   * each fighter column expand cleanly into half the available
   * width AND lets the VS wordmark center against the full Stage
   * width rather than a narrow auto column.
   */
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
  gap: clamp(16px, 3cqw, 56px);
  padding: clamp(10px, 2cqh, 26px) clamp(24px, 4cqw, 70px)
    clamp(6px, 1.2cqh, 16px);
  /*
   * Hard overflow guard — the locker-room background fills
   * everything beneath, so any fighter sprite that would otherwise
   * overflow into the bottom deck on a non-16:9 viewport gets
   * cleanly clipped here instead of showing through.
   */
  overflow: hidden;
`;

const FighterColumn = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  /*
   * IMPORTANT: min-height: 0 lets this flex child shrink below its
   * intrinsic content size. Without it, the NamePlate + caption +
   * difficulty strip would force the column above the grid row's
   * available height on portrait viewports, pushing the penguin
   * sprite down past the Stage and into the bottom deck — which is
   * exactly what was breaking scaling before.
   */
  min-height: 0;
  height: 100%;
  min-width: 0;
  gap: clamp(6px, 1cqh, 10px);
  animation: ${(p) => (p.$side === "left" ? slideInLeft : slideInRight)} 0.5s
    ease-out 0.15s both;
`;

// ============================================
// HORIZONTAL NAMEPLATE (above each penguin)
// ============================================

/*
 * NamePlate — the small horizontal name card that sits above each
 * fighter. Replaces the old vertical Nobori entirely. Reads as a
 * fighter intro card pinned to the locker (East/West side label,
 * fighter name, status dot), all on one short horizontal row so
 * it doesn't eat the Stage's vertical real estate.
 *
 * Cream washi surface to visually rhyme with the MatchCardBar at
 * the top — both are "printed paper" elements pinned to the locker
 * room. Solid vermillion left rule when occupied, faded ice rule
 * when empty.
 */
const NamePlate = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.2cqw, 14px);
  padding: clamp(5px, 0.7cqh, 8px) clamp(10px, 1.5cqw, 16px)
    clamp(5px, 0.7cqh, 8px) clamp(12px, 1.8cqw, 20px);
  background: ${C.cream};
  border: 1px solid rgba(60, 40, 20, 0.22);
  /* Crisp left accent rule — vermillion for occupied, faded for empty */
  border-left: 4px solid
    ${(p) => (p.$hasFighter ? C.vermillion : "rgba(60, 40, 20, 0.2)")};
  box-shadow: 0 2px 6px rgba(50, 30, 10, 0.18);
  flex-shrink: 0;
  max-width: 92%;
`;

const NamePlateSide = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.78cqw, 0.62rem);
  color: ${C.vermillionDeep};
  letter-spacing: 0.24em;
  text-transform: uppercase;
  padding-right: clamp(8px, 1.1cqw, 12px);
  border-right: 1px solid rgba(60, 40, 20, 0.18);
`;

const NamePlateName = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.1cqw, 0.9rem);
  color: ${(p) => (p.$hasFighter ? C.inkText : C.inkTextMute)};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: clamp(80px, 14cqw, 180px);
`;

const NamePlateStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.4rem, 0.62cqw, 0.5rem);
  color: ${(p) => (p.$connected ? C.successDeep : C.inkTextMute)};
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding-left: clamp(6px, 0.9cqw, 10px);
  border-left: 1px solid rgba(60, 40, 20, 0.18);
`;

const StatusDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(p) => (p.$connected ? C.success : "rgba(60, 40, 20, 0.3)")};
  ${(p) =>
    p.$connected &&
    css`
      animation: ${livePulse} 2s ease-in-out infinite;
    `}
`;

// ============================================
// FIGHTER PORTRAIT (penguin standing in the locker room)
// ============================================

const FighterPortrait = styled.div`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;

  /*
   * Ground shadow — uses the SAME radial gradient as the in-game
   * PlayerShadow component (rgba(0,0,0,0.86) → transparent at 70%)
   * so the lobby shadow visually matches what the player will see
   * once the bout starts. Sized to match the game's player shadow
   * footprint roughly (the game uses width: 9.15% / height: 3.70%
   * of a 1280×720 stage, which is a flat ~4:1 oval).
   */
  &::before {
    content: "";
    position: absolute;
    bottom: clamp(2px, 0.4cqh, 6px);
    left: 50%;
    /* Sized to match the PreviewImage footprint at 43cqh midpoint. */
    width: clamp(140px, 18cqw, 210px);
    height: clamp(23px, 3.5cqh, 38px);
    border-radius: 50%;
    background: radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0.86) 0%,
      rgba(0, 0, 0, 0) 70%
    );
    transform: translateX(-50%);
    z-index: 1;
    pointer-events: none;
  }
`;

const AvatarFrame = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;

  ${(p) =>
    p.$side === "left" &&
    css`
      transform: scaleX(-1);
    `}
`;

const AvatarBreath = styled.div`
  animation: ${breathe} 2.6s ease-in-out infinite;
  transform-origin: center bottom;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  /*
   * No drop-shadow filter — the ground shadow on FighterPortrait
   * does the grounding work, matching how the in-game penguin sits
   * over PlayerShadow (no sprite-edge glow stacked on top).
   */
`;

const PreviewImage = styled.img`
  /*
   * Critical: use max-height (not height) so the sprite ALWAYS
   * scales down to fit the FighterPortrait's available vertical
   * space. This was the core scaling bug — the old fixed-height
   * sprite would overflow below the Stage on any window that wasn't
   * 16:9. Auto height + max-height: 100% lets the browser shrink
   * the sprite as needed without distortion.
   *
   * Sizing balance: the original 36cqh midpoint felt too small
   * against the zoomed-in bg, the bumped 51cqh felt too big once
   * the bg was redrawn at proper proportions. Splitting the
   * difference at 43cqh keeps the penguin a clear focal element
   * while reading as "smaller than a locker", matching the cute
   * scale of the bg art (penguins ~2/3 the height of a locker).
   */
  max-height: clamp(180px, 43cqh, 380px);
  height: auto;
  max-width: 100%;
  width: auto;
  object-fit: contain;
`;

/*
 * WaitingState — empty fighter slot. Faded silhouette of a penguin
 * (a "ghost" opponent) under the standard nameplate. Reads as
 * "this corner is empty, waiting for a challenger" — not a generic
 * loading spinner.
 */
const WaitingState = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 100%;
  gap: clamp(6px, 1cqh, 10px);
`;

const WaitingSilhouette = styled.img`
  /*
   * Match PreviewImage sizing so the empty fighter slot reads as
   * the same "weight" on the stage as the actual penguin across
   * from it — silhouette and sprite share a baseline AND a scale.
   */
  max-height: clamp(180px, 43cqh, 380px);
  height: auto;
  max-width: 100%;
  width: auto;
  object-fit: contain;
  filter: brightness(0) opacity(0.18);
  ${(p) =>
    p.$side === "left" &&
    css`
      transform: scaleX(-1);
    `}
`;

const WaitingText = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.45rem, 0.7cqw, 0.58rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
`;

const LoadingDots = styled.span`
  display: inline-flex;
  gap: 5px;
`;

const Dot = styled.span`
  width: 5px;
  height: 5px;
  background: ${C.vermillion};
  border-radius: 50%;
  animation: ${dotPulse} 1.4s ease-in-out infinite;
  animation-delay: ${(p) => p.$delay * 0.18}s;
`;

// ============================================
// VS CENTER — typographic + hanko stamp
// ============================================

/*
 * VSWordmark — direct child of Stage, absolutely positioned dead
 * center horizontally and at 75% vertically.
 *
 * Previously this lived inside a VSCenter wrapper that took the
 * middle column of a 1fr/auto/1fr grid. The wrapper's narrow
 * width + grid-cell positioning was making the wordmark visually
 * off-center against the full Stage. Hoisting it directly into
 * Stage and centering with left: 50% + translate(-50%) means it's
 * centered against the full Stage width — guaranteed.
 *
 * Treatment: cream fill with a vermillion stroke (multi-shadow
 * 8-direction outline) plus a deep dark drop. Cream-on-vermillion
 * is the same chrome the rest of the game uses (Ready button,
 * status pills, header), so the wordmark reads as a NATIVE game
 * element rather than a floating typographic experiment. The
 * stroke also gives it strong legibility against the busy locker
 * room bg without needing a card backing.
 *
 * No rotation — the previous tilt was the main "looks weird"
 * complaint. A flat, square wordmark reads as confident and
 * intentional.
 */
const VSWordmark = styled.div`
  position: absolute;
  top: 75%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  pointer-events: none;

  font-family: "Bungee", cursive;
  font-size: clamp(2.6rem, 5.6cqw, 4.6rem);
  font-weight: 400;
  color: ${C.cream};
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;

  /*
   * Vermillion stroke via 8-direction text-shadow stack (more
   * cross-browser reliable than -webkit-text-stroke), then a deep
   * dark drop for grounded depth against the bg. Order matters:
   * stroke layers first so they read as one solid outline, drop
   * shadow last so it sits behind everything.
   */
  text-shadow:
    -2px 0 0 ${C.vermillionDeep},
    2px 0 0 ${C.vermillionDeep},
    0 -2px 0 ${C.vermillionDeep},
    0 2px 0 ${C.vermillionDeep},
    -2px -2px 0 ${C.vermillionDeep},
    2px -2px 0 ${C.vermillionDeep},
    -2px 2px 0 ${C.vermillionDeep},
    2px 2px 0 ${C.vermillionDeep},
    0 5px 0 rgba(20, 8, 4, 0.42),
    0 10px 22px rgba(20, 8, 4, 0.5);
`;

// ============================================
// CPU SKILL CARD (cream washi "challenger card" right of CPU)
// ============================================

/*
 * DifficultyCard — vertical cream washi "challenger card" pinned
 * to the locker wall to the right of the CPU portrait.
 *
 * Replaces the dark horizontal DifficultyStrip that used to sit
 * absolutely-positioned below the CPU NamePlate. That strip had
 * three problems:
 *   1. EASY TO MISS — small dark slab under the nameplate. With
 *      the locker bg blurred behind it, it visually disappeared
 *      against the CinematicOverlay's corner shadows.
 *   2. WRONG VISUAL LANGUAGE — the cream washi NamePlate above and
 *      cream MatchCardBar across the top set the surface metaphor
 *      for the whole lobby ("printed cards pinned to a locker"),
 *      then the difficulty selector dropped a dark sumi panel into
 *      that world. Read as "different feature bolted on".
 *   3. SUBTITLE NOISE — every pill carried a meta caption
 *      (Casual / Standard / Challenge / Brutal / Soon) that the
 *      eye had to parse before getting to the actionable name.
 *
 * The replacement is the same surface language as the NamePlate
 * + MatchCardBar — cream paper, vermillion left rule, faint warm
 * grain, soft warm shadow — but vertical and prominent. Reads as
 * another printed card in the same program rather than a separate
 * UI panel. Position is absolute inside the Stage, anchored to the
 * RIGHT edge and vertically centered against the portrait area, so
 * it sits next to the CPU penguin without compressing the
 * symmetric two-column fighter layout.
 *
 * Side effect: the asymmetry (player column is bare, CPU column has
 * a card pinned beside it) visually communicates "the CPU has
 * different controls than you" — you don't customize a CPU's
 * mawashi, you set its skill tier.
 */
const DifficultyCard = styled.div`
  position: absolute;
  /*
   * Anchored to the right edge of Stage with a small inset that
   * matches the Stage's right padding floor. On wider viewports
   * the card sits in the empty space to the right of the CPU
   * portrait (over the blurred banzuke board area in the bg art),
   * which is where the fighter column's natural negative space
   * already lives.
   */
  right: clamp(16px, 2.4cqw, 36px);
  /*
   * Vertically centered slightly below midline (55%) so the card
   * lines up against the CPU portrait's center rather than the
   * column's geometric center — the nameplate occupies the top
   * of the column, so the portrait's optical center sits below
   * the column's true center.
   */
  top: 55%;
  transform: translateY(-50%);
  z-index: 6;
  display: flex;
  flex-direction: column;
  background: ${C.cream};
  border: 1px solid rgba(60, 40, 20, 0.22);
  border-left: 4px solid ${C.vermillion};
  box-shadow: 0 3px 12px rgba(50, 30, 10, 0.22);
  min-width: clamp(120px, 13cqw, 160px);
  animation: ${slideInRight} 0.5s ease-out 0.4s both;
  pointer-events: auto;

  /* Faint paper grain — same treatment as MatchCardBar / NamePlate
   * so all three surfaces read as cuts of the same washi stock. */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      0deg,
      rgba(60, 40, 20, 0.04) 0,
      transparent 1px,
      transparent 3px
    );
    pointer-events: none;
  }
`;

const DifficultyHeader = styled.div`
  position: relative;
  padding: clamp(7px, 1cqh, 10px) clamp(11px, 1.5cqw, 16px)
    clamp(5px, 0.7cqh, 8px);
  border-bottom: 1px solid rgba(60, 40, 20, 0.18);
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const DifficultyHeaderCaption = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.32em;
  text-transform: uppercase;
`;

const DifficultyHeaderTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.05cqw, 0.85rem);
  color: ${C.inkText};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1;
`;

const DifficultyOption = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: clamp(7px, 1cqh, 10px) clamp(11px, 1.5cqw, 16px);
  /*
   * Selected option fills with vermillion (matches the Body/Belt
   * customize tab pattern), available options are transparent, and
   * unavailable options have no fill change — their state is
   * communicated entirely by faded ink color + not-allowed cursor.
   * Dropping the "Soon" subtitle from each row cuts the visual
   * noise; the disabled state IS the message.
   */
  background: ${(p) => (p.$selected ? C.vermillion : "transparent")};
  border: 0;
  cursor: ${(p) => (p.$available ? "pointer" : "not-allowed")};
  font-family: "Bungee", cursive;
  font-size: clamp(0.62rem, 0.95cqw, 0.78rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: left;
  line-height: 1;
  color: ${(p) =>
    p.$selected
      ? C.cream
      : p.$available
        ? C.inkText
        : C.inkTextFaint};
  transition: background 0.16s ease, color 0.16s ease;

  & + & {
    border-top: 1px solid rgba(60, 40, 20, 0.12);
  }

  &:hover {
    ${(p) =>
      p.$available &&
      !p.$selected &&
      css`
        background: rgba(216, 59, 39, 0.08);
        color: ${C.vermillionDeep};
      `}
  }
`;

// ============================================
// BOTTOM DECK — combined customize + READY in a single bar
// ============================================

/*
 * BottomDeck — the consolidated control bar at the bottom of the
 * lobby. Replaces the previous TWO separate stacked bars
 * (CustomizePanel + BottomBar) which were:
 *   1. Eating ~140-180px of vertical space (forcing the penguin
 *      sprites to overflow the Stage on any non-16:9 window).
 *   2. Visually disconnected — customize was a small white toolbar
 *      floating in front of a darker action bar, with no shared
 *      visual language.
 *
 * Now a single dark sumi anchor band runs across the bottom with
 * THREE columns:
 *   LEFT   — Customize (Body/Belt tabs + swatches + selected chip)
 *   CENTER — vertical divider rule
 *   RIGHT  — READY action (big stamped button + ready chip)
 *
 * The dark surface lets the vermillion READY CTA pop, while keeping
 * the chrome ONE bar instead of two stacked.
 */
const BottomDeck = styled.footer`
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  display: grid;
  /*
   * minmax(0, 1fr) instead of 1fr is REQUIRED for the swatch row's
   * internal horizontal scrolling to engage. A bare 1fr is internally
   * minmax(auto, 1fr) — the track's minimum size is its content's
   * min-content size. Without minmax(0, ...) the CustomizeArea column
   * simply expanded to fit ALL the swatches at intrinsic width and
   * overflowed the deck horizontally (clipped by the container) — the
   * SwatchSection itself never saw overflow, so its overflow-x: auto
   * never engaged. minmax(0, 1fr) lets the track shrink below content
   * size, which is what forces the overflow into SwatchSection where
   * we want it.
   */
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: stretch;
  gap: clamp(10px, 1.6cqw, 22px);
  /*
   * Tighter vertical padding (was clamp(8px, 1.2cqh, 14px)) — the
   * deck was sitting at a 92px min-height with a ~55px-tall ReadyButton
   * inside it, leaving ~37px of dead vertical space top+bottom of the
   * controls. The new values let the controls dictate the deck's
   * height instead of the deck enforcing a thick band.
   */
  padding: clamp(6px, 0.85cqh, 10px) clamp(16px, 2.6cqw, 32px);
  background: ${C.sumi};
  /*
   * Single hairline gold rule along the top — a quiet brand mark
   * (gold leaf) that mirrors the vermillion rules on the cream
   * MatchCardBar at the top of the page without adding noise.
   */
  border-top: 1px solid ${C.gold};
  box-shadow: 0 -3px 12px ${C.sumiShadow};
  animation: ${slideUp} 0.45s ease-out 0.25s both;
  /*
   * min-height trimmed from clamp(64px, 9cqh, 92px) → clamp(54px,
   * 6.4cqh, 68px). 68px at full size still leaves a comfortable
   * frame around the ReadyButton + kanji subtitle without enforcing
   * a band of empty space. The 54px floor protects against tiny
   * viewports collapsing the swatches into the button.
   */
  min-height: clamp(54px, 6.4cqh, 68px);
`;

const CustomizeArea = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.4cqw, 18px);
  min-width: 0;
  flex: 1;
`;

const TabGroup = styled.div`
  display: flex;
  align-items: stretch;
  gap: 2px;
  flex-shrink: 0;
  border: 1px solid rgba(245, 236, 217, 0.18);
`;

const Tab = styled.button`
  position: relative;
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.5rem, 0.78cqw, 0.62rem);
  text-transform: uppercase;
  letter-spacing: 0.24em;
  padding: clamp(7px, 1cqh, 11px) clamp(11px, 1.5cqw, 16px);
  background: ${(p) => (p.$active ? C.vermillion : "transparent")};
  border: 0;
  color: ${(p) => (p.$active ? C.cream : C.creamMute)};
  cursor: pointer;
  transition: color 0.18s ease, background 0.18s ease;

  & + & {
    border-left: 1px solid rgba(245, 236, 217, 0.18);
  }

  &:hover {
    color: ${C.cream};
    ${(p) =>
      !p.$active &&
      css`
        background: rgba(245, 236, 217, 0.06);
      `}
  }
`;

/*
 * SwatchSection — horizontal swatch row.
 *
 * NOWRAP + HORIZONTAL SCROLL:
 *   Previously this was flex-wrap: wrap, which had a nasty failure
 *   mode at narrow viewports: when the swatch row's intrinsic width
 *   exceeded its lane, ALL the swatches popped onto a second line
 *   in a single hard jump — and that second line ALSO doubled the
 *   deck's height (since min-height now allows growth from content).
 *   It looked broken at any window size below ~1100px.
 *
 *   Switching to nowrap + overflow-x: auto + hidden scrollbar gives
 *   the row a graceful failure mode: at typical viewports nothing
 *   changes (all swatches fit on one row, no scroll appears); at
 *   narrow viewports the row stays one line tall and silently
 *   becomes horizontally scrollable instead of growing the deck.
 *   Mouse wheel, trackpad swipe, and arrow keys all work; the
 *   scrollbar is hidden because a visible scrollbar in this band
 *   would look junky against the dark sumi.
 *
 *   min-width: 0 is required so the flex parent doesn't try to fit
 *   the row's intrinsic width and instead lets overflow-x kick in.
 *
 *   Physical padding-inline (not scroll-padding alone) is required so
 *   the first/last swatches' gold selection ring isn't clipped by
 *   overflow-x: scroll-padding only affects snap / scrollIntoView and
 *   does not inset the flex content.
 */
const SwatchSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: clamp(3px, 0.5cqw, 6px);
  flex-wrap: nowrap;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  /*
   * Padding INSIDE the scroll container — required so the selected
   * swatch's gold ring (2px border + 2px box-shadow spread ≈ 4px past
   * the border box on every side) doesn't get clipped by overflow.
   *
   * We can't switch overflow-y to visible: per CSS spec, when one
   * overflow axis is auto/scroll and the other is visible, browsers
   * compute the visible side back to auto. So padding inside the
   * scroll area is the right move — it gives the rings physical
   * room within the clipped lane.
   *
   * 6px at full size (clamp top): comfortably accommodates the
   * selection ring on both ColorSwatch (26px max) and PatternSwatch
   * (30px max). The hover scale (×1.18) may still get a hair of
   * clipping at the very edge, but hover is transient — the
   * persistent selected-state ring is what matters and now fits.
   */
  padding-block: clamp(4px, 0.6cqh, 6px);
  padding-inline: clamp(4px, 0.6cqw, 6px);
  scroll-padding-inline: clamp(4px, 0.6cqw, 6px);
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

/*
 * SwatchLane — positioning context for the swatch row + scroll arrows.
 *
 * Wraps SwatchSection so we can absolutely-position the left/right
 * scroll affordances on top of it without making the SwatchSection
 * itself a positioned ancestor (which would interfere with its
 * native scroll behavior). Also sets the flex grow + min-width: 0 at
 * this level so SwatchSection can simply be flex: 1 inside.
 */
const SwatchLane = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
`;

/*
 * ScrollArrow — left/right edge scroll affordance.
 *
 * Two jobs at once:
 *   1. EDGE FADE — a sumi-to-transparent gradient at each edge so
 *      swatches at that edge appear to "fade under" the chevron.
 *      This is the universal "more content this way" cue and works
 *      even at a glance, before the user reads the chevron itself.
 *   2. CHEVRON — a clickable ‹ / › that nudges the lane by ~70% of
 *      its width on click. Smooth scroll, so the motion confirms
 *      to the user "yes, you can scroll, here's what was hidden".
 *
 * Visibility is driven by parent React state (canScrollLeft /
 * canScrollRight). When invisible, pointer-events: none ensures the
 * arrow doesn't accidentally block clicks on swatches at that edge.
 *
 * The gradient is only ~38px wide so it doesn't visibly cover
 * swatches that are fully in view — it just kisses the edge of
 * whatever is right at the threshold.
 */
const ScrollArrow = styled.button`
  position: absolute;
  top: 0;
  bottom: 0;
  ${(p) => (p.$dir === "left" ? "left: 0;" : "right: 0;")}
  width: clamp(28px, 3.2cqw, 38px);
  display: inline-flex;
  align-items: center;
  justify-content: ${(p) => (p.$dir === "left" ? "flex-start" : "flex-end")};
  padding: 0 clamp(4px, 0.6cqw, 7px);
  border: 0;
  cursor: pointer;
  background: linear-gradient(
    ${(p) => (p.$dir === "left" ? "90deg" : "270deg")},
    ${C.sumi} 0%,
    rgba(20, 15, 12, 0.92) 35%,
    rgba(20, 15, 12, 0) 100%
  );
  color: ${C.gold};
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(13px, 1.4cqw, 17px);
  line-height: 1;
  z-index: 2;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: ${(p) => (p.$visible ? "auto" : "none")};
  transition: opacity 0.18s ease, color 0.18s ease, transform 0.15s ease;

  &:hover {
    color: ${C.cream};
  }

  &:active {
    transform: scale(0.92);
  }

  /* Subtle pulse on the chevron itself when first appearing as a hint */
  span {
    display: inline-block;
    transition: transform 0.18s ease;
  }
  &:hover span {
    transform: ${(p) =>
      p.$dir === "left" ? "translateX(-2px)" : "translateX(2px)"};
  }
`;

const SwatchDivider = styled.div`
  width: 1px;
  height: clamp(18px, 2.4cqh, 26px);
  background: rgba(245, 236, 217, 0.22);
  margin: 0 clamp(2px, 0.4cqw, 5px);
  flex-shrink: 0;
`;

/*
 * ColorSwatch — circular belt/body chips. Rim must read perfectly even:
 * no inset 0 1px highlights (those hug only the top inner edge and
 * fake a thicker top border), and no ultra-high radial focal point.
 * Pattern squares override gloss/shadows separately — those stay richer.
 */
const ColorSwatch = styled.button`
  position: relative;
  /*
   * Min size dropped from 20px → 18px and middle from 2.2cqw → 2.0cqw
   * so the row of 10 solids + 5 patterns fits comfortably in the
   * lane down to a smaller viewport before SwatchSection's
   * horizontal scroll fallback engages.
   */
  width: clamp(18px, 2.0cqw, 26px);
  height: clamp(18px, 2.0cqw, 26px);
  border-radius: 50%;
  border: 2px solid
    ${(p) => (p.$selected ? C.gold : "rgba(245, 236, 217, 0.32)")};
  background: ${(p) => p.$gradient || p.$color};
  cursor: ${(p) => (p.$taken ? "not-allowed" : "pointer")};
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  flex-shrink: 0;
  animation: ${swatchPop} 0.35s ease-out both;
  animation-delay: ${(p) => Math.min(p.$index ?? 0, 20) * 0.015}s;
  overflow: hidden;

  box-shadow: ${(p) =>
    p.$selected
      ? `inset 0 0 6px 1px rgba(0, 0, 0, 0.26),
         0 0 0 2px rgba(232, 197, 71, 0.45),
         0 0 8px rgba(232, 197, 71, 0.2),
         0 3px 8px rgba(0, 0, 0, 0.52)`
      : `inset 0 0 5px 1px rgba(0, 0, 0, 0.2),
         0 2px 6px rgba(0, 0, 0, 0.48)`};

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      circle at 50% 44%,
      rgba(255, 255, 255, 0.18) 0%,
      transparent 58%
    );
    pointer-events: none;
    z-index: 0;
  }

  ${(p) =>
    p.$taken &&
    css`
      opacity: 0.35;
      &::after {
        content: "✕";
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: clamp(9px, 1.2cqw, 13px);
        color: ${C.cream};
        z-index: 2;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
      }
    `}

  &:hover {
    transform: ${(p) => (p.$taken ? "none" : "scale(1.18)")};
    border-color: ${(p) =>
      p.$taken
        ? "rgba(245, 236, 217, 0.32)"
        : p.$selected
          ? C.gold
          : C.cream};
    ${(p) =>
      !p.$taken &&
      css`
        box-shadow: ${p.$selected
          ? `inset 0 0 7px 1px rgba(0, 0, 0, 0.24),
             0 0 0 2px rgba(232, 197, 71, 0.52),
             0 0 10px rgba(232, 197, 71, 0.28),
             0 4px 10px rgba(0, 0, 0, 0.56)`
          : `inset 0 0 6px 1px rgba(0, 0, 0, 0.18),
             0 0 0 1px rgba(245, 236, 217, 0.22),
             0 4px 10px rgba(0, 0, 0, 0.5)`};
      `}
  }
  &:active {
    transform: ${(p) => (p.$taken ? "none" : "scale(0.94)")};
  }
`;

/*
 * PatternSwatch — belt specials stay square-ish. Same centered-depth
 * rules as circles so the pattern fill doesn’t look offset in the frame.
 */
const PatternSwatch = styled(ColorSwatch)`
  width: clamp(21px, 2.3cqw, 30px);
  height: clamp(21px, 2.3cqw, 30px);
  border-radius: 5px;

  /* Restore slightly directional tile gloss (user-approved); circles stay symmetric above */
  &::before {
    background: radial-gradient(
      ellipse 100% 78% at 50% 20%,
      rgba(255, 255, 255, 0.24) 0%,
      transparent 58%
    );
  }

  box-shadow: ${(p) =>
    p.$selected
      ? `inset 0 0 0 1px rgba(0, 0, 0, 0.24),
         inset 0 0 7px 1px rgba(0, 0, 0, 0.34),
         inset 0 1px 1px rgba(255, 255, 255, 0.22),
         0 0 0 2px rgba(232, 197, 71, 0.45),
         0 0 8px rgba(232, 197, 71, 0.2),
         0 3px 8px rgba(0, 0, 0, 0.52)`
      : `inset 0 0 0 1px rgba(0, 0, 0, 0.2),
         inset 0 0 6px 1px rgba(0, 0, 0, 0.28),
         inset 0 1px 1px rgba(255, 255, 255, 0.22),
         0 1px 0 rgba(245, 236, 217, 0.22),
         0 3px 7px rgba(0, 0, 0, 0.5)`};

  &:hover {
    ${(p) =>
      !p.$taken &&
      css`
        box-shadow: ${p.$selected
          ? `inset 0 0 0 1px rgba(0, 0, 0, 0.22),
             inset 0 0 8px 1px rgba(0, 0, 0, 0.3),
             inset 0 1px 2px rgba(255, 255, 255, 0.26),
             0 0 0 2px rgba(232, 197, 71, 0.52),
             0 0 10px rgba(232, 197, 71, 0.28),
             0 4px 10px rgba(0, 0, 0, 0.56)`
          : `inset 0 0 0 1px rgba(0, 0, 0, 0.16),
             inset 0 0 7px 1px rgba(0, 0, 0, 0.22),
             inset 0 1px 2px rgba(255, 255, 255, 0.26),
             0 0 0 1px rgba(245, 236, 217, 0.26),
             0 4px 10px rgba(0, 0, 0, 0.52)`};
      `}
  }
`;

const SelectedBlock = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  border-left: 1px solid rgba(245, 236, 217, 0.22);
  padding-left: clamp(10px, 1.4cqw, 16px);
  min-width: clamp(110px, 13cqw, 150px);
  flex-shrink: 0;
`;

const SelectedSwatchPreview = styled.div`
  position: relative;
  width: clamp(22px, 2.4cqw, 28px);
  height: clamp(22px, 2.4cqw, 28px);
  border-radius: 50%;
  background: ${(p) => p.$gradient || p.$color};
  border: 2px solid ${C.gold};
  flex-shrink: 0;
  overflow: hidden;
  box-shadow:
    inset 0 0 5px 1px rgba(0, 0, 0, 0.22),
    0 1px 5px rgba(0, 0, 0, 0.42);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      circle at 50% 44%,
      rgba(255, 255, 255, 0.16) 0%,
      transparent 58%
    );
    pointer-events: none;
  }
`;

const SelectedNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`;

const SelectedCategory = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.4rem, 0.6cqw, 0.48rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const SelectedNameLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.88cqw, 0.72rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DeckDivider = styled.div`
  width: 1px;
  align-self: stretch;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(245, 236, 217, 0.28) 50%,
    transparent 100%
  );
  margin: 0 clamp(2px, 0.4cqw, 6px);
`;

// ============================================
// READY ACTION (right side of the BottomDeck)
// ============================================

const ActionArea = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.5cqw, 18px);
  flex-shrink: 0;
`;

/*
 * ReadyButton — the headliner CTA. Larger and more theatrical than
 * the previous version: a vermillion stamped block with cream
 * Bungee headline, kanji subtitle (準備 — "ready/preparation") and
 * a directional arrow. Reads as "stamp yourself in for the bout"
 * rather than a generic submit pill.
 *
 * The two-line vertical layout (kanji over headline) gives the
 * button real visual weight against the rest of the dark deck
 * without needing to be physically huge.
 */
const ReadyButton = styled.button`
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  font-family: "Bungee", cursive;
  color: ${C.cream};
  background: ${C.vermillion};
  border: 2px solid ${C.gold};
  border-radius: 0;
  /*
   * Vertical padding tightened from clamp(8px, 1.3cqh, 14px) →
   * clamp(5px, 0.9cqh, 9px). The button's visual weight comes from
   * the kanji + headline two-line stack and the gold border, not
   * from a thick padding band. This keeps the button proportionate
   * inside the now-shorter BottomDeck.
   */
  padding: clamp(5px, 0.9cqh, 9px) clamp(28px, 4cqw, 56px);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: 0 4px 14px rgba(138, 31, 18, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08);

  .kanji {
    font-family: "Noto Serif JP", serif;
    font-weight: 700;
    font-size: clamp(0.42rem, 0.65cqw, 0.55rem);
    color: rgba(245, 236, 217, 0.85);
    letter-spacing: 0.4em;
    line-height: 1;
  }

  .headline {
    display: inline-flex;
    align-items: center;
    gap: clamp(6px, 0.9cqw, 10px);
    font-size: clamp(0.95rem, 1.5cqw, 1.2rem);
    letter-spacing: 0.24em;
    line-height: 1;
  }

  .arrow { transition: transform 0.2s ease; }

  &:hover {
    background: ${C.vermillionBright};
    transform: translateY(-2px);
    box-shadow: 0 7px 20px rgba(138, 31, 18, 0.55),
      inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    .arrow { animation: ${arrowNudge} 0.7s ease-in-out infinite; }
  }
  &:active { transform: translateY(0) scale(0.98); }
`;

/*
 * CancelButton — paired ghost button when the player has already
 * pressed READY. Same physical footprint as ReadyButton so the
 * BottomDeck doesn't reflow when toggling state.
 */
const CancelButton = styled.button`
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  font-family: "Bungee", cursive;
  color: ${C.creamMute};
  background: transparent;
  border: 2px solid rgba(245, 236, 217, 0.4);
  border-radius: 0;
  /* Match ReadyButton padding so toggling state doesn't reflow */
  padding: clamp(5px, 0.9cqh, 9px) clamp(28px, 4cqw, 56px);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease,
    color 0.2s ease;

  .kanji {
    font-family: "Noto Serif JP", serif;
    font-weight: 700;
    font-size: clamp(0.42rem, 0.65cqw, 0.55rem);
    color: rgba(245, 236, 217, 0.55);
    letter-spacing: 0.4em;
    line-height: 1;
  }

  .headline {
    font-size: clamp(0.95rem, 1.5cqw, 1.2rem);
    letter-spacing: 0.24em;
    line-height: 1;
  }

  &:hover {
    background: rgba(245, 236, 217, 0.06);
    border-color: ${C.cream};
    color: ${C.cream};
    transform: translateY(-2px);
  }
  &:active { transform: translateY(0) scale(0.98); }
`;

const ReadyChip = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  /* Tightened from clamp(6px, 0.9cqh, 9px) to match leaner deck */
  padding: clamp(4px, 0.6cqh, 7px) clamp(12px, 1.7cqw, 18px);
  background: rgba(245, 236, 217, 0.06);
  border: 1px solid ${(p) => (p.$ready ? C.gold : "rgba(245, 236, 217, 0.18)")};
  min-width: clamp(86px, 11cqw, 124px);
`;

const ReadyChipLabel = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.4rem, 0.62cqw, 0.5rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const ReadyChipCount = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.78rem, 1.2cqw, 1rem);
  color: ${(p) => (p.$ready ? C.gold : C.cream)};
  letter-spacing: 0.16em;
`;

// ============================================
// COLORED PLAYER PREVIEW
// ============================================

function ColoredPlayerPreview({ color, bodyColor }) {
  const [imageSrc, setImageSrc] = useState(pumo);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const needsMawashiRecolor = color && color !== SPRITE_BASE_COLOR;
    const needsBodyRecolor = !!bodyColor;

    if (!needsMawashiRecolor && !needsBodyRecolor) {
      setImageSrc(pumo);
      return;
    }

    const options = {};
    if (needsBodyRecolor) {
      options.bodyColorRange = GREY_BODY_RANGES;
      options.bodyColorHex = bodyColor;
    }

    recolorImage(
      pumo,
      BLUE_COLOR_RANGES,
      needsMawashiRecolor ? color : SPRITE_BASE_COLOR,
      options
    )
      .then((recolored) => {
        if (mountedRef.current) {
          setImageSrc(recolored);
        }
      })
      .catch((error) => {
        console.error("Failed to recolor preview:", error);
        if (mountedRef.current) {
          setImageSrc(pumo);
        }
      });
  }, [color, bodyColor]);

  return <PreviewImage src={imageSrc} alt="Player Preview" />;
}

ColoredPlayerPreview.propTypes = {
  color: PropTypes.string,
  bodyColor: PropTypes.string,
};

// ============================================
// LOBBY COMPONENT
// ============================================

/*
 * CPU_DIFFICULTIES is just a list of tier ids now — the previous
 * meta captions ("Casual" / "Standard" / "Challenge" / "Brutal")
 * have been dropped from the UI. The greyed-out / not-allowed
 * cursor on unavailable rows in DifficultyCard is the disabled
 * state's only signal, no "Soon" caption needed.
 */
const CPU_DIFFICULTIES = ["EASY", "NORMAL", "HARD", "IMPOSSIBLE"];
// All four tiers are now real (one expert brain dialed up/down — see
// server-io/cpuAI.js DIFFICULTY_PROFILES); EASY/NORMAL are handicapped HARD.
const AVAILABLE_CPU_DIFFICULTIES = new Set([
  "EASY",
  "NORMAL",
  "HARD",
  "IMPOSSIBLE",
]);

const Lobby = ({
  rooms,
  setRooms,
  roomName,
  handleGame,
  setCurrentPage,
  onLeaveDohyo,
  isCPUMatch = false,
}) => {
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const { socket } = useContext(SocketContext);

  const {
    setPlayer1Color,
    setPlayer2Color,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  } = usePlayerColors();

  const [selectedDifficulty, setSelectedDifficulty] = useState("HARD");
  const [customizeTab, setCustomizeTab] = useState("body");

  /*
   * Swatch row scroll affordance state.
   *
   * SwatchSection scrolls horizontally when its swatches don't all
   * fit in the lane. We render left/right ScrollArrow chevrons over
   * the lane edges, but only when scrolling in that direction is
   * actually possible — measured here from the section's scrollLeft
   * / clientWidth / scrollWidth.
   *
   * Re-measured on:
   *   - mount
   *   - swatch row scroll (onScroll handler)
   *   - container resize (ResizeObserver)
   *   - swatch tab change (effect dep on customizeTab — Body and
   *     Belt tabs render different swatch sets with different
   *     intrinsic widths)
   *   - player join (effect dep on myPlayerIndex — when the local
   *     player's slot resolves from -1, the swatches mount for the
   *     first time and we need an initial measurement)
   */
  const swatchScrollRef = useRef(null);
  const [canScrollLeftSwatches, setCanScrollLeftSwatches] = useState(false);
  const [canScrollRightSwatches, setCanScrollRightSwatches] = useState(false);

  const measureSwatchScroll = useCallback(() => {
    const el = swatchScrollRef.current;
    if (!el) {
      setCanScrollLeftSwatches(false);
      setCanScrollRightSwatches(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeftSwatches(el.scrollLeft > 1);
    setCanScrollRightSwatches(el.scrollLeft < max - 1);
  }, []);

  const scrollSwatchesBy = useCallback((direction) => {
    const el = swatchScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * el.clientWidth * 0.72,
      behavior: "smooth",
    });
  }, []);

  const myPlayerIndex = players.findIndex((p) => p.id === socket.id);

  /*
   * Measure the swatch row's scrollability whenever:
   *   - the local player slot resolves (myPlayerIndex flips from -1)
   *   - the customize tab toggles between Body/Belt (different swatch
   *     counts → different intrinsic widths)
   *   - the lane container resizes (window/lobby resize)
   * The onScroll handler on SwatchSection covers the scroll case.
   */
  useEffect(() => {
    measureSwatchScroll();
    const el = swatchScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      measureSwatchScroll();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureSwatchScroll, customizeTab, myPlayerIndex]);
  const isPlayer1 = myPlayerIndex === 0;

  const serverPlayer1Color = players[0]?.mawashiColor || SPRITE_BASE_COLOR;
  const serverPlayer2Color = players[1]?.mawashiColor || "#D94848";
  const serverPlayer1BodyColor = players[0]?.bodyColor || null;
  const serverPlayer2BodyColor = players[1]?.bodyColor || null;

  const isPvP =
    !isCPUMatch &&
    players[0]?.fighter &&
    players[1]?.fighter &&
    !players[1]?.isCPU;
  const otherPlayerMawashi = isPlayer1 ? serverPlayer2Color : serverPlayer1Color;
  const otherPlayerBody = isPlayer1
    ? serverPlayer2BodyColor
    : serverPlayer1BodyColor;
  const isColorTakenByOther = (hex) =>
    isPvP &&
    otherPlayerMawashi &&
    hex?.toLowerCase() === otherPlayerMawashi.toLowerCase();
  const isBodyColorTakenByOther = (hex) =>
    isPvP &&
    hex !== null &&
    otherPlayerBody !== null &&
    hex?.toLowerCase() === otherPlayerBody?.toLowerCase();

  const myMawashiColor = isPlayer1 ? serverPlayer1Color : serverPlayer2Color;
  const myBodyColor = isPlayer1 ? serverPlayer1BodyColor : serverPlayer2BodyColor;

  const beltSolids = [
    { name: "Default", hex: SPRITE_BASE_COLOR },
    { name: "Graphite", hex: "#525252" },
    { name: "Scarlet", hex: "#D94848" },
    { name: "Coral", hex: "#E87070" },
    { name: "Tangerine", hex: "#E8913A" },
    { name: "Gold", hex: "#D4A520" },
    { name: "Emerald", hex: "#2E9E5A" },
    { name: "Cobalt", hex: "#3B5EB0" },
    { name: "Orchid", hex: "#A85DBF" },
  ];

  const beltPatterns = [
    {
      name: "Rainbow",
      hex: "rainbow",
      gradient:
        "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
    },
    {
      name: "Fire",
      hex: "fire",
      gradient: "linear-gradient(to bottom, #FFD700, #FF8C00, #DC143C, #8B0000)",
    },
    {
      name: "Vaporwave",
      hex: "vaporwave",
      gradient: "linear-gradient(to bottom, #FF69B4, #DA70D6, #9370DB, #00CED1)",
    },
    {
      name: "Camo",
      hex: "camo",
      gradient:
        "repeating-conic-gradient(#556B2F 0% 25%, #2E4E1A 25% 50%, #5D3A1A 50% 75%, #1a1a0a 75% 100%)",
    },
    {
      name: "Galaxy",
      hex: "galaxy",
      gradient:
        "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
    },
    {
      name: "Shiny Gold",
      hex: "gold",
      gradient:
        "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
    },
  ];

  const bodyColors = [
    {
      name: "Default",
      hex: null,
      gradient: "linear-gradient(135deg, #888 0%, #aaa 50%, #888 100%)",
    },
    { name: "Black", hex: "#4d4d4d" },
    { name: "Blue", hex: "#2656A8" },
    { name: "Purple", hex: "#9932CC" },
    { name: "Green", hex: "#32CD32" },
    { name: "Aqua", hex: "#17A8A0" },
    { name: "Orange", hex: "#E27020" },
    { name: "Pink", hex: "#FFB6C1" },
    { name: "Yellow", hex: "#F5C422" },
    { name: "Brown", hex: "#8B5E3C" },
    { name: "Silver", hex: "#A8A8A8" },
    { name: "Light Blue", hex: "#6ABED0" },
    { name: "Red", hex: "#CC3333" },
  ];

  const allBeltOptions = [...beltSolids, ...beltPatterns];
  const selectedBeltOption = allBeltOptions.find(
    (c) => c.hex === myMawashiColor
  );
  const selectedBodyOption = bodyColors.find((c) => c.hex === myBodyColor);
  const selectedBeltName = selectedBeltOption?.name || "Default";
  const selectedBodyName = selectedBodyOption?.name || "Default";

  const handleColorSelect = (color) => {
    if (myPlayerIndex === -1) return;
    if (isColorTakenByOther(color)) return;
    socket.emit("update_mawashi_color", {
      roomId: roomName,
      playerId: socket.id,
      color,
    });
  };

  const handleBodyColorSelect = (color) => {
    if (myPlayerIndex === -1) return;
    if (isBodyColorTakenByOther(color)) return;
    socket.emit("update_body_color", {
      roomId: roomName,
      playerId: socket.id,
      color,
    });
  };

  useEffect(() => {
    if (serverPlayer1Color) setPlayer1Color(serverPlayer1Color);
    if (serverPlayer2Color) setPlayer2Color(serverPlayer2Color);
  }, [serverPlayer1Color, serverPlayer2Color, setPlayer1Color, setPlayer2Color]);

  useEffect(() => {
    setPlayer1BodyColor(serverPlayer1BodyColor);
    setPlayer2BodyColor(serverPlayer2BodyColor);
  }, [
    serverPlayer1BodyColor,
    serverPlayer2BodyColor,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  ]);

  const currentRoom = rooms.find((room) => room.id === roomName);
  const playerCount = currentRoom ? currentRoom.players.length : 0;
  const canShowReadyButton = isCPUMatch || playerCount > 1;

  useEffect(() => {
    socket.emit("lobby", { roomId: roomName });
    socket.on("lobby", (playerData) => {
      setPlayers(playerData);
    });

    socket.on("player_left", () => {
      setReady(false);
      setReadyCount(0);
    });

    socket.on("ready_count", (count) => {
      setReadyCount(count);
    });

    socket.on("initial_game_start", (payload) => {
      if (payload?.players && Array.isArray(payload.players) && setRooms) {
        const roomId = payload.roomId || roomName;
        if (payload.players[0]?.mawashiColor)
          setPlayer1Color(payload.players[0].mawashiColor);
        if (payload.players[1]?.mawashiColor)
          setPlayer2Color(payload.players[1].mawashiColor);
        setPlayer1BodyColor(payload.players[0]?.bodyColor || null);
        setPlayer2BodyColor(payload.players[1]?.bodyColor || null);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  players: r.players.map((rp, i) => ({
                    ...rp,
                    ...(payload.players[i] || {}),
                    mawashiColor:
                      payload.players[i]?.mawashiColor ?? rp.mawashiColor,
                    bodyColor: payload.players[i]?.bodyColor ?? rp.bodyColor,
                  })),
                }
              : r
          )
        );
      }
      socket.emit("game_reset", true);
      handleGame();
    });

    return () => {
      socket.off("lobby");
      socket.off("ready_count");
      socket.off("player_left");
      socket.off("initial_game_start");
    };
  }, [
    roomName,
    socket,
    handleGame,
    setRooms,
    setPlayer1Color,
    setPlayer2Color,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  ]);

  const handleLeaveDohyo = () => {
    playButtonPressSound();
    socket.emit("leave_room", { roomId: roomName });
    if (onLeaveDohyo) {
      onLeaveDohyo();
    } else {
      setCurrentPage("mainMenu");
    }
  };

  const handleReady = (e) => {
    const isReadyAction = e.currentTarget.dataset.action === "ready";
    setReady(isReadyAction);
    socket.emit("ready_count", {
      playerId: socket.id,
      isReady: isReadyAction,
      roomId: roomName,
    });
  };

  // ============ RENDER HELPERS ============

  const renderFighter = (side) => {
    const isLeft = side === "left";
    const player = isLeft ? players[0] : players[1];
    const hasPlayer = !!player?.fighter;
    /*
     * In CPU mode the right slot is always semantically occupied
     * (the CPU is always present), so paint the fighter even if
     * the lobby socket payload hasn't echoed back the CPU player
     * yet. The default red mawashi (#D94848) used here matches the
     * hex the server seeds for player2's mawashiColor in CPU mode.
     */
    const showAsCPU = !isLeft && isCPUMatch;
    const showFighter = hasPlayer || showAsCPU;
    const playerColor = isLeft ? serverPlayer1Color : serverPlayer2Color;
    const playerBodyColor = isLeft
      ? serverPlayer1BodyColor
      : serverPlayer2BodyColor;

    const sideLabel = isLeft ? "East" : "West";
    /*
     * Empty-slot nameplate previously read "EAST · Awaiting Fighter"
     * and "WEST · STANDBY..." with a separate `WAITING` status pill
     * on the right — three separate "this slot is empty" signals on
     * a single 30px-tall plate, on top of the giant silhouette +
     * "Waiting…" text below. We strip the empty state down to a
     * single quiet label ("Open Slot") with the status section
     * hidden entirely; the silhouette + "Waiting…" caption below
     * carries the load.
     */
    const fighterName = showAsCPU
      ? "CPU"
      : player?.isCPU
        ? "CPU"
        : player?.fighter || "Open Slot";
    const statusLabel = showAsCPU ? "Ready" : "Connected";

    return (
      <FighterColumn $side={side}>
        <NamePlate $hasFighter={showFighter}>
          <NamePlateSide>{sideLabel}</NamePlateSide>
          <NamePlateName $hasFighter={showFighter}>{fighterName}</NamePlateName>
          {/*
           * Status section only renders for OCCUPIED slots. On an
           * empty slot, hiding the whole status block (instead of
           * just changing its text) is what stops the nameplate
           * from competing with the silhouette below — empty slots
           * are now visually quieter than filled ones, which is
           * the right hierarchy.
           */}
          {showFighter && (
            <NamePlateStatus $connected={showFighter}>
              <StatusDot $connected={showFighter} />
              {statusLabel}
            </NamePlateStatus>
          )}
        </NamePlate>

        <FighterPortrait>
          {showFighter ? (
            <AvatarFrame $side={side}>
              <AvatarBreath>
                <ColoredPlayerPreview
                  color={playerColor}
                  bodyColor={playerBodyColor}
                />
              </AvatarBreath>
            </AvatarFrame>
          ) : (
            <WaitingState>
              {/*
               * Order matters: text first, silhouette second. Combined
               * with justify-content: flex-end on WaitingState, this
               * pins the silhouette to the bottom of the column so it
               * shares a ground baseline with the opposing player's
               * actual penguin sprite — text floats above the ghost
               * rather than the ghost floating above the text.
               */}
              <WaitingText>
                Waiting
                <LoadingDots>
                  <Dot $delay={0} />
                  <Dot $delay={1} />
                  <Dot $delay={2} />
                </LoadingDots>
              </WaitingText>
              <WaitingSilhouette $side={side} src={pumo} alt="" />
            </WaitingState>
          )}
        </FighterPortrait>

      </FighterColumn>
    );
  };

  /*
   * CPU skill card is rendered as a sibling of the fighter columns
   * inside Stage (not as a child of the CPU FighterColumn), so it
   * can pin to the right edge of the stage frame regardless of
   * how the column itself flexes. See the DifficultyCard styled
   * component for the rest of the rationale.
   */
  const renderDifficultyCard = () => (
    <DifficultyCard>
      <DifficultyHeader>
        <DifficultyHeaderCaption>Challenger</DifficultyHeaderCaption>
        <DifficultyHeaderTitle>CPU Skill</DifficultyHeaderTitle>
      </DifficultyHeader>
      {CPU_DIFFICULTIES.map((id) => {
        const available = AVAILABLE_CPU_DIFFICULTIES.has(id);
        const selected = id === selectedDifficulty;
        return (
          <DifficultyOption
            key={id}
            $available={available}
            $selected={selected}
            onClick={() => {
              if (available && id !== selectedDifficulty) {
                playButtonPressSound2();
                setSelectedDifficulty(id);
                socket.emit("set_cpu_difficulty", { difficulty: id });
              }
            }}
            onMouseEnter={() => available && playButtonHoverSound()}
            disabled={!available}
          >
            {id}
          </DifficultyOption>
        );
      })}
    </DifficultyCard>
  );

  const renderCustomizeArea = () => {
    if (myPlayerIndex === -1) return <CustomizeArea />;

    const isBody = customizeTab === "body";
    const isPattern = !isBody && !!selectedBeltOption?.gradient;

    const selectedColorHex = isBody ? myBodyColor || "#888" : myMawashiColor;
    const selectedColorGradient = isBody
      ? selectedBodyOption?.gradient
      : selectedBeltOption?.gradient;
    const selectedColorName = isBody ? selectedBodyName : selectedBeltName;
    const selectedCategoryLabel = isBody
      ? "Body Color"
      : isPattern
        ? "Belt Pattern"
        : "Belt Color";

    const handleTabChange = (tab) => {
      if (tab !== customizeTab) {
        playButtonHoverSound();
        setCustomizeTab(tab);
      }
    };

    return (
      <CustomizeArea>
        <TabGroup>
          <Tab $active={isBody} onClick={() => handleTabChange("body")}>
            Body
          </Tab>
          <Tab $active={!isBody} onClick={() => handleTabChange("belt")}>
            Belt
          </Tab>
        </TabGroup>

        <SwatchLane>
          <SwatchSection
            ref={swatchScrollRef}
            onScroll={measureSwatchScroll}
          >
            {isBody ? (
              bodyColors.map((color, i) => {
                const taken = isBodyColorTakenByOther(color.hex);
                return (
                  <ColorSwatch
                    key={color.name}
                    $index={i}
                    $color={color.hex || "#888"}
                    $gradient={color.gradient}
                    $selected={myBodyColor === color.hex}
                    $taken={taken}
                    onClick={() => !taken && handleBodyColorSelect(color.hex)}
                    onMouseEnter={() => !taken && playButtonHoverSound()}
                    title={taken ? "Taken by opponent" : color.name}
                  />
                );
              })
            ) : (
              <>
                {beltSolids.map((color, i) => {
                  const taken = isColorTakenByOther(color.hex);
                  return (
                    <ColorSwatch
                      key={color.name}
                      $index={i}
                      $color={color.hex}
                      $selected={myMawashiColor === color.hex}
                      $taken={taken}
                      onClick={() => !taken && handleColorSelect(color.hex)}
                      onMouseEnter={() => !taken && playButtonHoverSound()}
                      title={taken ? "Taken by opponent" : color.name}
                    />
                  );
                })}
                <SwatchDivider />
                {beltPatterns.map((color, i) => {
                  const taken = isColorTakenByOther(color.hex);
                  return (
                    <PatternSwatch
                      key={color.name}
                      $index={i + beltSolids.length}
                      $color={color.hex}
                      $gradient={color.gradient}
                      $selected={myMawashiColor === color.hex}
                      $taken={taken}
                      onClick={() => !taken && handleColorSelect(color.hex)}
                      onMouseEnter={() => !taken && playButtonHoverSound()}
                      title={taken ? "Taken by opponent" : color.name}
                    />
                  );
                })}
              </>
            )}
          </SwatchSection>
          <ScrollArrow
            $dir="left"
            $visible={canScrollLeftSwatches}
            onClick={() => scrollSwatchesBy(-1)}
            aria-label="Scroll colors left"
            tabIndex={canScrollLeftSwatches ? 0 : -1}
          >
            <span aria-hidden>‹</span>
          </ScrollArrow>
          <ScrollArrow
            $dir="right"
            $visible={canScrollRightSwatches}
            onClick={() => scrollSwatchesBy(1)}
            aria-label="Scroll colors right"
            tabIndex={canScrollRightSwatches ? 0 : -1}
          >
            <span aria-hidden>›</span>
          </ScrollArrow>
        </SwatchLane>

        <SelectedBlock>
          <SelectedSwatchPreview
            $color={selectedColorHex}
            $gradient={selectedColorGradient}
          />
          <SelectedNameStack>
            <SelectedCategory>{selectedCategoryLabel}</SelectedCategory>
            <SelectedNameLabel>{selectedColorName}</SelectedNameLabel>
          </SelectedNameStack>
        </SelectedBlock>
      </CustomizeArea>
    );
  };

  return (
    <LobbyContainer>
      <BackgroundImage />
      <CinematicOverlay />
      <GrainOverlay />
      <Snowfall intensity={14} showFrost={false} zIndex={3} />

      <MatchCardBar>
        <TopLeft>
          <ExitButton
            onClick={handleLeaveDohyo}
            onMouseEnter={playButtonHoverSound}
          >
            <span className="arrow">←</span>
            Leave Dohyo
          </ExitButton>
        </TopLeft>

        <MatchCardCenter>
          <MatchCardKanji aria-hidden>番</MatchCardKanji>
          <MatchCardLabels>
            <MatchCardCaption>Tonight&apos;s Bout</MatchCardCaption>
            {/*
             * Title shows just the room name (or "VS CPU" for CPU
             * matches). Previously prefixed with "Dohyo · " on both
             * branches, which read as inaccurate (the player isn't
             * IN the dohyo yet — this is the prep room before the
             * bout) and visually redundant against the surrounding
             * 番付 banzuke kanji + the rest of the sumo-themed
             * chrome. The "TONIGHT'S BOUT" caption already carries
             * the bout context; the title can just be the identifier.
             */}
            <MatchCardTitle>
              {isCPUMatch ? "VS CPU" : roomName}
            </MatchCardTitle>
          </MatchCardLabels>
          <MatchCardKanji aria-hidden>付</MatchCardKanji>
        </MatchCardCenter>

        <TopRight>
          {/*
           * Mode chip simplified to a single label:
           *   PvP → "Custom"
           *   CPU → "VS CPU"
           *
           * The previous chip read "● 1V1 Custom" / "● VS CPU Solo".
           * "1V1" is meaningless in a 1v1-only fighting game (a
           * coffee shop labeling cups "DRINK"), and the trailing
           * "Custom"/"Solo" qualifier just doubled the label.
           * One flat word + accent dot reads as a confident status
           * pill rather than a configuration summary.
           */}
          <MatchModeChip>
            <span className="dot" />
            <strong>{isCPUMatch ? "VS CPU" : "Custom"}</strong>
          </MatchModeChip>
        </TopRight>
      </MatchCardBar>

      <Stage>
        {renderFighter("left")}

        <VSWordmark>VS</VSWordmark>

        {renderFighter("right")}

        {/*
         * CPU skill card lives at the Stage level rather than inside
         * the right FighterColumn so it positions absolutely against
         * the Stage frame instead of the column's flex flow. Only
         * shown for CPU matches; PvP gets the symmetric two-column
         * layout with no extra chrome.
         */}
        {isCPUMatch && renderDifficultyCard()}
      </Stage>

      <BottomDeck>
        {renderCustomizeArea()}

        {/*
         * DeckDivider + ActionArea only render when both fighter
         * slots are filled. Previously, when alone, this position
         * showed a "Waiting for an opponent…" placeholder — but
         * with the empty-slot silhouette + "Waiting…" caption
         * already telegraphing the same thing in the Stage above,
         * the bottom-corner text was a fourth redundant "waiting"
         * signal. Hiding the entire action region instead lets
         * the empty-slot stage state be the single source of truth
         * and gives the room for the Ready button to "appear" as a
         * meaningful reveal moment when the second player joins.
         */}
        {canShowReadyButton && (
          <>
            <DeckDivider />

            <ActionArea>
              {ready ? (
                <CancelButton
                  data-action="cancel"
                  onClick={(e) => {
                    handleReady(e);
                    playButtonPressSound();
                  }}
                  onMouseEnter={playButtonHoverSound}
                >
                  <span className="kanji">取消</span>
                  <span className="headline">Cancel</span>
                </CancelButton>
              ) : (
                <ReadyButton
                  data-action="ready"
                  onClick={(e) => {
                    handleReady(e);
                    playButtonPressSound2();
                  }}
                  onMouseEnter={playButtonHoverSound}
                >
                  <span className="kanji">準備</span>
                  <span className="headline">
                    Ready
                    <span className="arrow">▶</span>
                  </span>
                </ReadyButton>
              )}
              {!isCPUMatch && (
                <ReadyChip $ready={readyCount > 0}>
                  <ReadyChipLabel>Ready</ReadyChipLabel>
                  <ReadyChipCount $ready={readyCount > 0}>
                    {readyCount} / 2
                  </ReadyChipCount>
                </ReadyChip>
              )}
            </ActionArea>
          </>
        )}
      </BottomDeck>
    </LobbyContainer>
  );
};

Lobby.propTypes = {
  rooms: PropTypes.array.isRequired,
  setRooms: PropTypes.func,
  roomName: PropTypes.string.isRequired,
  handleGame: PropTypes.func.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  onLeaveDohyo: PropTypes.func,
  isCPUMatch: PropTypes.bool,
};

export default Lobby;
