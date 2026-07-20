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
import { SPRITE_BASE_COLOR } from "../utils/SpriteRecolorizer";
import { buildIdlePortraitSrc } from "../utils/hatComposite";
import pumo from "../assets/pumo-idle.png";
import { SHADOW_GRADIENT } from "./PlayerShadow";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  fadeIn,
  fadeUp,
  broadcastSlideDown,
  clipRevealLeft,
  clipRevealRight,
  clipRevealUp,
  TEXT_SHADOW_DISPLAY,
  TEXT_SHADOW_DISPLAY_HEAVY,
} from "./menuTheme";
import { loadSave, writeSave, makeDefaultSave } from "../lib/saveStore";
import {
  makeDefaultCustomization,
  normalizeCustomization,
  getOutfitById,
  withActiveOutfitId,
  firstNonClashingOutfit,
  outfitClashesWith,
} from "../lib/outfits";

/*
 * Lobby — VS CPU + Custom Match prep room.
 *
 * Same printed-banzuke language as PreMatch / BashoHub / MainMenu:
 * locker-room stage, letterbox dim, cream type, vermillion rules.
 * Looks are built on Customize; lobby picks a saved outfit via the same
 * slim strip pattern as CPU Skill — under the nameplate. Bodies own the floor.
 */

const D = {
  page: "#080a0e",
  panel: "rgba(14, 16, 22, 0.92)",
  head: "#171a20",
  soft: "#22262d",
  deep: "#0c0e14",
  border: "rgba(245, 236, 217, 0.20)",
  borderSoft: "rgba(245, 236, 217, 0.10)",
  shadow: "rgba(0, 0, 0, 0.55)",
};

// ============================================
// LOCAL ANIMATIONS
// ============================================

const breathe = keyframes`
  0%, 100% { transform: scaleY(1); }
  50%      { transform: scaleY(1.022); }
`;

const dotPulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.45; }
  50%      { transform: scale(1.3); opacity: 1; }
`;

const vsStampIn = keyframes`
  0% {
    opacity: 0;
    transform: scale(1.85) rotate(-10deg);
  }
  52% {
    opacity: 1;
    transform: scale(0.9) rotate(2deg);
  }
  76% {
    transform: scale(1.05) rotate(-1deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
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
  background: ${D.page};
  overflow: hidden;
  container-type: size;
  font-family: ${FONT_BODY};
  animation: ${fadeIn} 0.28s ease-out;
`;

/*
 * Background — one light even blur. Soften AI detail without mush or
 * fake depth masks. Scaled past the frame to hide gaussian fringe.
 */
const BackgroundPlate = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: ${D.page};
`;

const BackgroundImage = styled.div`
  position: absolute;
  inset: -4%;
  background: url(${lobbyBackground}) center bottom / cover;
  /* Keep the room framed — no aggressive crop for floor chasing. */
  transform: scale(1.05) translateX(1.4%);
  transform-origin: 50% 100%;
  filter: blur(3px) saturate(0.65) brightness(0.74) contrast(1.06);
`;

const FrostScrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 70% 58% at 50% 48%,
      rgba(234, 241, 247, 0.09) 0%,
      rgba(234, 241, 247, 0.025) 45%,
      transparent 72%
    ),
    linear-gradient(
      180deg,
      rgba(18, 24, 36, 0.3) 0%,
      rgba(18, 24, 36, 0.09) 36%,
      rgba(18, 24, 36, 0.13) 62%,
      rgba(18, 24, 36, 0.4) 100%
    );
`;

const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 42% 40% at 26% 70%,
      transparent 0%,
      transparent 50%,
      rgba(4, 6, 10, 0.3) 100%
    ),
    radial-gradient(
      ellipse 42% 40% at 74% 70%,
      transparent 0%,
      transparent 50%,
      rgba(4, 6, 10, 0.3) 100%
    ),
    radial-gradient(
      ellipse 60% 50% at 50% 55%,
      transparent 0%,
      rgba(4, 6, 10, 0.12) 58%,
      rgba(4, 6, 10, 0.48) 100%
    ),
    linear-gradient(
      180deg,
      rgba(4, 6, 10, 0.48) 0%,
      rgba(4, 6, 10, 0.14) 20%,
      rgba(4, 6, 10, 0.04) 45%,
      rgba(4, 6, 10, 0.18) 72%,
      rgba(4, 6, 10, 0.52) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.2;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  background-size: 260px 260px;
`;

// ============================================
// TOP SLUG + LEAVE (floating chrome)
// ============================================

const TopSlug = styled.div`
  position: absolute;
  top: clamp(10px, 1.5cqh, 16px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  z-index: 30;
  will-change: transform, opacity;
  animation: ${broadcastSlideDown} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s
    backwards;
`;

const SlugText = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.72cqw, 0.56rem);
  color: ${(p) => (p.$accent ? C.ice : C.creamMute)};
  letter-spacing: 0.3em;
  text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  white-space: nowrap;

  strong {
    color: ${C.cream};
    letter-spacing: 0.1em;
  }
`;

const SlugRule = styled.span`
  width: 16px;
  height: 1px;
  background: rgba(245, 236, 217, 0.35);
`;

const LeaveButton = styled.button`
  position: absolute;
  top: clamp(10px, 1.5cqh, 16px);
  left: clamp(14px, 2.2cqw, 28px);
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  min-height: 38px;
  padding: clamp(7px, 1cqh, 10px) clamp(13px, 1.8cqw, 20px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.52rem, 0.8cqw, 0.64rem);
  text-transform: uppercase;
  letter-spacing: 0.28em;
  color: ${C.creamMute};
  background: ${C.sumi};
  border: 1px solid rgba(245, 236, 217, 0.22);
  border-radius: 0;
  cursor: pointer;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease,
    transform 0.18s ease;
  animation: ${fadeIn} 0.35s ease both;

  .arrow {
    font-weight: 700;
    transition: transform 0.2s ease;
  }

  &:hover {
    color: ${C.cream};
    border-color: rgba(245, 236, 217, 0.4);

    .arrow {
      transform: translateX(-3px);
    }
  }

  &:active {
    transform: scale(0.98);
  }
`;

// ============================================
// FIGHTER STAGE
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr minmax(64px, 10cqw) 1fr;
  align-items: stretch;
  /*
   * Bottom pad = Ready clearance. Ready sits raised under the bout,
   * so fighters need extra floor room above it.
   */
  padding: clamp(48px, 6.5cqh, 60px) clamp(18px, 3cqw, 48px)
    clamp(96px, 15cqh, 128px);
  overflow: hidden;
`;

/* Soft ground plane under the bout — sells contact with the room floor. */
const FloorPlane = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: min(34%, 280px);
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    to top,
    rgba(4, 6, 10, 0.55) 0%,
    rgba(4, 6, 10, 0.22) 42%,
    transparent 100%
  );
`;

const FighterColumn = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(10px, 1.6cqh, 16px);
  min-height: 0;
  min-width: 0;
  will-change: transform, opacity;
  animation: ${(p) => (p.$side === "left" ? clipRevealLeft : clipRevealRight)}
    0.55s cubic-bezier(0.2, 0.7, 0.2, 1) 0.08s both;
`;

const FighterPortrait = styled.div`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  flex: 0 1 auto;
  min-height: 0;
  z-index: 4;
`;

const FloorShadow = styled.div`
  position: absolute;
  left: 50%;
  bottom: clamp(1px, 0.35cqh, 4px);
  transform: translateX(-50%) scaleY(0.85);
  width: clamp(150px, 21cqw, 240px);
  height: clamp(22px, 3.4cqh, 36px);
  border-radius: 50%;
  background: ${SHADOW_GRADIENT};
  opacity: 0.95;
  z-index: 1;
  pointer-events: none;
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
`;

const PreviewImage = styled.img`
  max-height: clamp(170px, 40cqh, 340px);
  height: auto;
  max-width: min(100%, 42cqw);
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000);
`;

const WaitingState = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 100%;
`;

const WaitingSilhouette = styled.img`
  max-height: clamp(170px, 40cqh, 340px);
  height: auto;
  max-width: min(100%, 42cqw);
  width: auto;
  object-fit: contain;
  filter: brightness(0) opacity(0.16);
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
  margin-top: clamp(2px, 0.4cqh, 4px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.65cqw, 0.52rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
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
// IDENTITY — floating type ABOVE each fighter
// ============================================

/*
 * Nameplate + control strip sit above the fighter. Bodies own the
 * floor band below — keeps chrome out of the ground contact zone.
 */
const IdentityStack = styled.div`
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(10px, 1.4cqh, 14px);
  width: 100%;
  max-width: 92%;
  margin-top: auto;
  flex-shrink: 0;
  animation: ${fadeUp} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.22s both;
`;

const IdentityBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(2px, 0.4cqh, 5px);
  padding: 0;
`;

const SideLabel = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${(p) => (p.$hasFighter ? C.vermillion : C.creamMute)};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
`;

const FighterName = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.05rem, 2cqw, 1.55rem);
  color: ${(p) => (p.$hasFighter ? "#ffffff" : C.creamMute)};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 0.95;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const IdentityRule = styled.div`
  width: clamp(36px, 5cqw, 56px);
  height: 2px;
  margin-top: 2px;
  background: ${(p) => (p.$hasFighter ? C.vermillion : "rgba(245, 236, 217, 0.2)")};
`;

// ============================================
// CENTER VS — same stamp as PreMatchScreen
// ============================================

const VsColumn = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  z-index: 6;
  /* Drop the stamp onto fighter chests — not floating at nameplate height. */
  padding-bottom: clamp(72px, 14cqh, 120px);
  pointer-events: none;
`;

const VsMark = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.6cqh, 8px);
  width: 100%;
  will-change: transform, opacity;
  animation: ${vsStampIn} 0.58s cubic-bezier(0.34, 1.5, 0.64, 1) 0.18s both;
`;

const VsRule = styled.div`
  width: clamp(36px, 5cqw, 56px);
  height: 2px;
  background: ${C.vermillion};
  flex-shrink: 0;
`;

const VsKanji = styled.div`
  position: relative;
  z-index: 2;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(14px, 1.8cqw, 22px);
  color: ${C.cream};
  letter-spacing: 0.28em;
  line-height: 1;
  padding-left: 0.28em;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
`;

const VsLetters = styled.div`
  position: relative;
  z-index: 2;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(44px, 7cqw, 88px);
  color: #ffffff;
  letter-spacing: 0.04em;
  line-height: 0.82;
  text-align: center;
  text-shadow: ${TEXT_SHADOW_DISPLAY_HEAVY};
`;

const VsMetaPlate = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
  padding: clamp(5px, 0.7cqh, 8px) clamp(12px, 1.6cqw, 18px);
  background: ${C.sumi};
  border: 1px solid rgba(245, 236, 217, 0.22);
`;

const VsMode = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.52rem, 0.9cqw, 0.7rem);
  color: ${C.cream};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  line-height: 1;
  padding-left: 0.28em;
`;

// ============================================
// FIGHTER CONTROL STRIP — CPU skill / outfit
// Same slim segmented control under each nameplate.
// ============================================

const ControlStrip = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.55cqh, 6px);
  flex-shrink: 0;
  white-space: nowrap;
  /* Invisible twin keeps opposing nameplate controls level. */
  visibility: ${(p) => (p.$ghost ? "hidden" : "visible")};
  pointer-events: ${(p) => (p.$ghost ? "none" : "auto")};
`;

const StripCaption = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(7px, 0.9cqw, 10px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.38rem, 0.58cqw, 0.46rem);
  color: ${C.creamMute};
  letter-spacing: 0.3em;
  margin-right: -0.3em;
  text-transform: uppercase;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);

  &::before,
  &::after {
    content: "";
    width: clamp(10px, 1.4cqw, 16px);
    height: 1px;
    background: ${C.vermillion};
    opacity: 0.85;
  }
`;

/*
 * Shared footprint for Outfit + CPU Skill — compact lacquer stamps
 * under the nameplate (same width keeps East/West level).
 */
const StripOptions = styled.div`
  display: flex;
  align-items: stretch;
  gap: 3px;
  width: clamp(200px, 24cqw, 280px);
  height: clamp(28px, 3.4cqh, 34px);
`;

const StripOption = styled.button`
  position: relative;
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 clamp(2px, 0.4cqw, 5px);
  overflow: hidden;
  white-space: nowrap;
  background: ${(p) =>
    p.$selected
      ? `linear-gradient(180deg, ${C.vermillionBright} 0%, ${C.vermillion} 55%, ${C.vermillionDeep} 100%)`
      : "linear-gradient(180deg, #1c212b 0%, #12161e 100%)"};
  border: 1px solid
    ${(p) =>
      p.$taken
        ? "rgba(245, 236, 217, 0.1)"
        : p.$selected
          ? "rgba(245, 236, 217, 0.45)"
          : "rgba(245, 236, 217, 0.22)"};
  border-radius: 0;
  box-shadow: ${(p) =>
    p.$selected
      ? `inset 0 1px 0 rgba(255, 255, 255, 0.18),
         0 0 0 1px rgba(216, 59, 39, 0.35),
         0 6px 14px rgba(0, 0, 0, 0.45)`
      : `inset 0 1px 0 rgba(255, 255, 255, 0.05),
         0 4px 10px rgba(0, 0, 0, 0.4)`};
  cursor: ${(p) => (p.$taken ? "not-allowed" : "pointer")};
  opacity: ${(p) => (p.$taken ? 0.38 : 1)};
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.44rem, 0.66cqw, 0.54rem);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
  color: ${(p) => (p.$selected ? "#ffffff" : C.creamMute)};
  text-shadow: ${(p) =>
    p.$selected ? TEXT_SHADOW_DISPLAY : "0 1px 2px rgba(0, 0, 0, 0.65)"};
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease,
    box-shadow 0.15s ease, transform 0.12s ease;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${(p) => (p.$selected ? C.gold : "rgba(245, 236, 217, 0.12)")};
    opacity: ${(p) => (p.$selected ? 1 : 0.7)};
  }

  &:hover {
    ${(p) =>
      !p.$selected &&
      !p.$taken &&
      css`
        color: ${C.cream};
        border-color: rgba(245, 236, 217, 0.4);
        background: linear-gradient(180deg, #252b38 0%, #171c26 100%);
        transform: translateY(-1px);
      `}
  }

  &:active {
    transform: ${(p) => (p.$taken ? "none" : "translateY(0) scale(0.98)")};
  }
`;

// ============================================
// CONTROL DOCK — Ready cluster only (not a footer bar)
// ============================================

const ControlDock = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  /*
   * Raised under the bout — part of the stage composition, not
   * chrome glued to the viewport edge.
   */
  bottom: clamp(40px, 6.5cqh, 64px);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, 2cqw, 24px);
  padding: 0 clamp(14px, 2.4cqw, 32px);
  pointer-events: none;
  animation: ${clipRevealUp} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s both;

  & > * {
    pointer-events: auto;
  }
`;

const ActionCluster = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 16px);
  flex-shrink: 0;
`;

const readyPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 18px rgba(216, 59, 39, 0.45);
  }
  50% {
    box-shadow: 0 0 28px rgba(238, 81, 65, 0.7);
  }
`;

/*
 * Ready CTA — same footprint, louder presence.
 * Bright vermillion + soft red pulse. No cream/white trim.
 */
const ReadyButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.1cqw, 12px);
  height: clamp(44px, 5.2cqh, 52px);
  padding: 0 clamp(28px, 3.6cqw, 52px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.82rem, 1.2cqw, 1.05rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: #ffffff;
  background: linear-gradient(
    180deg,
    ${C.vermillionBright} 0%,
    ${C.vermillion} 55%,
    ${C.vermillionDeep} 100%
  );
  border: 1px solid ${C.vermillionDeep};
  border-radius: 0;
  cursor: pointer;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  animation: ${readyPulse} 1.8s ease-in-out infinite;
  transition: background 0.16s ease, transform 0.12s ease, filter 0.16s ease;

  &:hover {
    filter: brightness(1.08);
    animation: none;
    box-shadow: 0 0 32px rgba(238, 81, 65, 0.75);
  }

  &:active {
    transform: scale(0.98);
    filter: brightness(0.95);
  }
`;

const CancelButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: clamp(44px, 5.2cqh, 52px);
  padding: 0 clamp(28px, 3.6cqw, 52px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.82rem, 1.2cqw, 1.05rem);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: ${C.creamMute};
  background: transparent;
  border: 1px solid rgba(245, 236, 217, 0.32);
  border-radius: 0;
  cursor: pointer;
  transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease,
    transform 0.12s ease;

  &:hover {
    color: ${C.cream};
    border-color: rgba(245, 236, 217, 0.55);
    background: rgba(14, 16, 22, 0.55);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const ReadyChip = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: clamp(44px, 5.2cqh, 52px);
  padding: 0 clamp(12px, 1.6cqw, 18px);
  background: ${C.sumi};
  border: 1px solid ${(p) => (p.$ready ? C.gold : "rgba(245, 236, 217, 0.22)")};
  min-width: clamp(80px, 10cqw, 112px);
`;

const ReadyChipLabel = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.38rem, 0.58cqw, 0.46rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.26em;
`;

const ReadyChipCount = styled.span`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.78rem, 1.2cqw, 1rem);
  color: ${(p) => (p.$ready ? C.gold : C.cream)};
  letter-spacing: 0.16em;
`;

// ============================================
// COLORED PLAYER PREVIEW
// ============================================

function ColoredPlayerPreview({ color, bodyColor, gearIds }) {
  const [imageSrc, setImageSrc] = useState(pumo);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    buildIdlePortraitSrc({
      baseSrc: pumo,
      mawashiColor: color,
      bodyColor,
      gearIds,
    })
      .then((src) => {
        if (!cancelled && mountedRef.current) setImageSrc(src);
      })
      .catch((error) => {
        console.error("Failed to build lobby preview:", error);
        if (!cancelled && mountedRef.current) setImageSrc(pumo);
      });
    return () => {
      cancelled = true;
    };
  }, [color, bodyColor, JSON.stringify(gearIds || [])]);

  return <PreviewImage src={imageSrc} alt="Player Preview" />;
}

ColoredPlayerPreview.propTypes = {
  color: PropTypes.string,
  bodyColor: PropTypes.string,
  gearIds: PropTypes.arrayOf(PropTypes.string),
};

// ============================================
// LOBBY COMPONENT
// ============================================

/* id is what the server expects; label is what fits the stamp strip. */
const CPU_DIFFICULTIES = [
  { id: "EASY", label: "EASY" },
  { id: "NORMAL", label: "NORMAL" },
  { id: "HARD", label: "HARD" },
  { id: "IMPOSSIBLE", label: "BRUTAL" },
];
const OUTFIT_MARKS = ["1", "2", "3"];

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
  const [customization, setCustomization] = useState(() =>
    makeDefaultCustomization(),
  );
  const [activeOutfitId, setActiveOutfitId] = useState(
    makeDefaultCustomization().activeOutfitId,
  );
  const saveDocRef = useRef(null);
  const clashResolvedRef = useRef(false);
  const myPlayerIndex = players.findIndex((p) => p.id === socket.id);
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

  const emitOutfitColors = useCallback(
    (outfit) => {
      if (myPlayerIndex === -1 || !outfit) return;
      socket.emit("update_mawashi_color", {
        roomId: roomName,
        playerId: socket.id,
        color: outfit.mawashiColor,
      });
      socket.emit("update_body_color", {
        roomId: roomName,
        playerId: socket.id,
        color: outfit.bodyColor,
      });
      socket.emit("update_gear", {
        roomId: roomName,
        playerId: socket.id,
        gearIds: Array.isArray(outfit.gearIds) ? outfit.gearIds : [],
      });
    },
    [myPlayerIndex, roomName, socket],
  );

  const persistActiveOutfit = useCallback(async (nextCustomization) => {
    const normalized = normalizeCustomization(nextCustomization);
    setCustomization(normalized);
    setActiveOutfitId(normalized.activeOutfitId);
    const base = saveDocRef.current || makeDefaultSave();
    const written = await writeSave({
      ...base,
      customization: normalized,
    });
    saveDocRef.current = written;
  }, []);

  const [saveReady, setSaveReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSave().then((doc) => {
      if (cancelled) return;
      saveDocRef.current = doc;
      const c = normalizeCustomization(doc.customization);
      setCustomization(c);
      setActiveOutfitId(c.activeOutfitId);
      setSaveReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPvP) clashResolvedRef.current = false;
  }, [isPvP]);

  // If the active outfit clashes with the opponent in PvP, auto-pick a free slot.
  useEffect(() => {
    if (!isPvP || myPlayerIndex === -1 || clashResolvedRef.current) return;
    const preferred = getOutfitById(customization, activeOutfitId);
    if (!outfitClashesWith(preferred, otherPlayerMawashi, otherPlayerBody)) {
      clashResolvedRef.current = true;
      return;
    }
    const nextOutfit = firstNonClashingOutfit(
      customization,
      otherPlayerMawashi,
      otherPlayerBody,
    );
    if (!nextOutfit || nextOutfit.id === preferred.id) {
      clashResolvedRef.current = true;
      return;
    }
    clashResolvedRef.current = true;
    const next = withActiveOutfitId(customization, nextOutfit.id);
    persistActiveOutfit(next);
    emitOutfitColors(nextOutfit);
  }, [
    isPvP,
    myPlayerIndex,
    customization,
    activeOutfitId,
    otherPlayerMawashi,
    otherPlayerBody,
    persistActiveOutfit,
    emitOutfitColors,
  ]);

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

  // Push wardrobe colors/gear once save + seat are both ready (avoids wiping
  // gearIds with the default empty outfit before loadSave finishes).
  useEffect(() => {
    if (!saveReady || myPlayerIndex === -1) return;
    const outfit = getOutfitById(customization, activeOutfitId);
    if (!outfit) return;
    emitOutfitColors(outfit);
  }, [saveReady, myPlayerIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOutfitSelect = (outfitId) => {
    if (myPlayerIndex === -1) return;
    const outfit = getOutfitById(customization, outfitId);
    if (outfitClashesWith(outfit, otherPlayerMawashi, otherPlayerBody)) return;
    playButtonPressSound2();
    const next = withActiveOutfitId(customization, outfitId);
    persistActiveOutfit(next);
    emitOutfitColors(outfit);
  };

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
                    gearIds: payload.players[i]?.gearIds ?? rp.gearIds,
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

  const renderOutfitStrip = ({ ghost = false } = {}) => (
    <ControlStrip
      $ghost={ghost}
      aria-hidden={ghost}
      role={ghost ? undefined : "listbox"}
      aria-label={ghost ? undefined : "Outfit"}
    >
      <StripCaption>Outfit</StripCaption>
      <StripOptions>
        {customization.outfits.map((outfit, index) => {
          const taken =
            !ghost &&
            isPvP &&
            outfitClashesWith(outfit, otherPlayerMawashi, otherPlayerBody);
          const selected = !ghost && outfit.id === activeOutfitId;
          const mark = OUTFIT_MARKS[index] || String(index + 1);
          return (
            <StripOption
              key={outfit.id}
              type="button"
              role={ghost ? undefined : "option"}
              aria-selected={ghost ? undefined : selected}
              $selected={selected}
              $taken={taken}
              tabIndex={ghost || taken ? -1 : 0}
              disabled={ghost || taken}
              onClick={() => {
                if (ghost || taken) return;
                handleOutfitSelect(outfit.id);
              }}
              onMouseEnter={
                ghost || taken ? undefined : playButtonHoverSound
              }
              title={
                ghost
                  ? undefined
                  : taken
                    ? `${outfit.name} — taken`
                    : outfit.name
              }
            >
              {mark}
            </StripOption>
          );
        })}
      </StripOptions>
    </ControlStrip>
  );

  const renderSkillStrip = ({ ghost = false } = {}) => (
    <ControlStrip $ghost={ghost} aria-hidden={ghost}>
      <StripCaption>Skill</StripCaption>
      <StripOptions>
        {CPU_DIFFICULTIES.map(({ id, label }) => {
          const selected = !ghost && id === selectedDifficulty;
          return (
            <StripOption
              key={id}
              type="button"
              $selected={selected}
              tabIndex={ghost ? -1 : 0}
              disabled={ghost}
              title={label}
              onClick={() => {
                if (ghost) return;
                if (id !== selectedDifficulty) {
                  playButtonPressSound2();
                  setSelectedDifficulty(id);
                  socket.emit("set_cpu_difficulty", { difficulty: id });
                }
              }}
              onMouseEnter={ghost ? undefined : playButtonHoverSound}
            >
              {label}
            </StripOption>
          );
        })}
      </StripOptions>
    </ControlStrip>
  );

  const renderFighter = (side) => {
    const isLeft = side === "left";
    const player = isLeft ? players[0] : players[1];
    const hasPlayer = !!player?.fighter;
    const showAsCPU = !isLeft && isCPUMatch;
    const showFighter = hasPlayer || showAsCPU;
    const playerColor = isLeft ? serverPlayer1Color : serverPlayer2Color;
    const playerBodyColor = isLeft
      ? serverPlayer1BodyColor
      : serverPlayer2BodyColor;

    const sideLabel = isLeft ? "East" : "West";
    const fighterName = showAsCPU
      ? "CPU"
      : player?.isCPU
        ? "CPU"
        : player?.fighter || "Open Slot";

    const isMySide =
      myPlayerIndex !== -1 &&
      ((isLeft && isPlayer1) || (!isLeft && !isPlayer1));

    /*
     * Controls live under the nameplate; bodies own the floor.
     *   VS CPU: East outfit / West skill
     *   Custom: my side outfit / other side ghost outfit
     */
    const showOutfit = isMySide;
    const showOutfitGhost = !isCPUMatch && myPlayerIndex !== -1 && !isMySide;
    const showSkill = showAsCPU;

    return (
      <FighterColumn $side={side}>
        <IdentityStack>
          <IdentityBlock>
            <SideLabel $hasFighter={showFighter}>{sideLabel}</SideLabel>
            <FighterName $hasFighter={showFighter}>{fighterName}</FighterName>
            <IdentityRule $hasFighter={showFighter} aria-hidden />
            {!showFighter && (
              <WaitingText>
                Waiting
                <LoadingDots>
                  <Dot $delay={0} />
                  <Dot $delay={1} />
                  <Dot $delay={2} />
                </LoadingDots>
              </WaitingText>
            )}
          </IdentityBlock>

          {showOutfit && renderOutfitStrip()}
          {showOutfitGhost && renderOutfitStrip({ ghost: true })}
          {showSkill && renderSkillStrip()}
        </IdentityStack>

        <FighterPortrait>
          {showFighter ? (
            <>
              <FloorShadow />
              <AvatarFrame $side={side}>
                <AvatarBreath>
                  <ColoredPlayerPreview
                    color={playerColor}
                    bodyColor={playerBodyColor}
                    gearIds={player?.gearIds}
                  />
                </AvatarBreath>
              </AvatarFrame>
            </>
          ) : (
            <WaitingState>
              <WaitingSilhouette $side={side} src={pumo} alt="" />
            </WaitingState>
          )}
        </FighterPortrait>
      </FighterColumn>
    );
  };

  const matchModeLabel = isCPUMatch ? "VS CPU" : "CUSTOM";
  const slugSecondary = isCPUMatch ? "Practice Bout" : roomName;

  return (
    <LobbyContainer>
      <BackgroundPlate>
        <BackgroundImage />
      </BackgroundPlate>
      <FrostScrim />
      <CinematicOverlay />
      <GrainOverlay />
      <Snowfall intensity={12} showFrost={false} zIndex={3} />

      <LeaveButton
        onClick={handleLeaveDohyo}
        onMouseEnter={playButtonHoverSound}
      >
        <span className="arrow">&larr;</span>
        Leave
      </LeaveButton>

      <TopSlug>
        <SlugText $accent>
          <strong>{matchModeLabel}</strong>
          {!isCPUMatch && " MATCH"}
        </SlugText>
        <SlugRule aria-hidden />
        <SlugText>{slugSecondary}</SlugText>
      </TopSlug>

      <Stage>
        <FloorPlane aria-hidden />
        {renderFighter("left")}

        <VsColumn>
          <VsMark>
            <VsKanji>取組</VsKanji>
            <VsRule aria-hidden />
            <VsLetters>VS</VsLetters>
            <VsRule aria-hidden />
            <VsMetaPlate>
              <VsMode>{isCPUMatch ? "VS CPU" : "EXHIBITION"}</VsMode>
            </VsMetaPlate>
          </VsMark>
        </VsColumn>

        {renderFighter("right")}
      </Stage>

      {canShowReadyButton && (
        <ControlDock>
          <ActionCluster>
            {ready ? (
              <CancelButton
                data-action="cancel"
                onClick={(e) => {
                  handleReady(e);
                  playButtonPressSound();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                Cancel
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
                Ready
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
          </ActionCluster>
        </ControlDock>
      )}
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
