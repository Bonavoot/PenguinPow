import { useContext, useEffect, useState, useRef } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import Snowfall from "./Snowfall";
import lobbyBackground from "../assets/lobby-bkg.webp";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
} from "../utils/SpriteRecolorizer";
import pumo from "../assets/pumo.png";
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
  50%      { transform: scaleY(1.018); }
`;

const dotPulse = keyframes`
  0%, 100% { transform: scale(1);   opacity: 0.45; }
  50%      { transform: scale(1.3); opacity: 1; }
`;

const vsBeat = keyframes`
  0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 0 ${C.vermillionGlow}); }
  50%      { transform: scale(1.05); filter: drop-shadow(0 0 18px ${C.vermillionGlow}); }
`;

const panelDrop = keyframes`
  from { opacity: 0; transform: translateY(-14px); }
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
  min-height: 400px;
  background: ${C.snow};
  overflow: hidden;
  container-type: size;
  font-family: "Space Grotesk", sans-serif;
`;

const BackgroundImage = styled.div`
  position: absolute;
  inset: 0;
  background: url(${lobbyBackground}) center/cover;
  /*
   * On the snow theme the lobby backdrop becomes a faint frosted
   * suggestion of the arena, not a moody ink-wash. Brightness up,
   * saturation down so the colorful banners read as a soft pastel
   * watermark behind the snow surface.
   */
  opacity: 0.42;
  filter: saturate(0.78) brightness(1.18) blur(1.5px);
  z-index: 0;
`;

const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  /*
   * Snow-tinted readability wash. The lobby bg is showing through
   * at 42% opacity, so this overlay does the rest of the work to
   * lift the bg back toward a clean snowfield: a pale icy veil
   * that's strongest at the top (where the player cards sit) and
   * fades to clear in the middle (so a hint of the arena art
   * still breathes through). Soft cool corner shadows frame the
   * scene without collapsing it into a dark vignette.
   */
  background:
    radial-gradient(
      ellipse at 50% 100%,
      rgba(35, 70, 110, 0.18) 0%,
      transparent 55%
    ),
    linear-gradient(
      180deg,
      rgba(234, 241, 247, 0.65) 0%,
      rgba(234, 241, 247, 0.25) 30%,
      rgba(234, 241, 247, 0.25) 70%,
      rgba(234, 241, 247, 0.7) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.12;
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      rgba(35, 70, 110, 0.05) 1px,
      transparent 2px
    );
`;

// ============================================
// TOP BAR
// ============================================

const TopBar = styled.header`
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: clamp(12px, 2cqw, 28px);
  padding: clamp(14px, 2.4cqh, 26px) clamp(20px, 3.5cqw, 48px);
  /*
   * Sumi anchor band — frames the top of the lobby so the white
   * player cards have somewhere dark to sit against. Same
   * structural role as the bottom HUD on the main menu.
   */
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
  box-shadow: 0 3px 10px ${C.sumiShadow};
  animation: ${panelDrop} 0.5s ease-out;
`;

const TopBarLeft = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const TopBarRight = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const ExitButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  padding: clamp(8px, 1.2cqh, 12px) clamp(14px, 2cqw, 22px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.62rem, 0.95cqw, 0.78rem);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  /*
   * Dark-context ghost button. Sits on the sumi TopBar, so the
   * surface is transparent + cream hairline border (mirrors the
   * snow-context ghost SystemButton on the main menu). Stays
   * subordinate to the central DohyoBadge.
   */
  color: ${C.creamMute};
  background: transparent;
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease,
    transform 0.18s ease;

  .arrow {
    font-family: "Space Grotesk", sans-serif;
    font-weight: 700;
    transition: transform 0.2s ease;
  }

  &:hover {
    color: ${C.cream};
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

const DohyoBadge = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(6px, 1cqh, 10px) clamp(20px, 3cqw, 36px);
  /*
   * Small snow plaque sitting on the dark sumi TopBar — it's the
   * "room name plate" so it should pop as the only light surface
   * up here. Same treatment as a banzuke nameplate pinned to a
   * ribbon: cream-against-dark outside, dark-against-snow inside.
   */
  background: ${C.snowPanel};
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  box-shadow: 0 2px 8px ${C.sumiShadow};

  /* Single thin gold underline — quiet brand mark, picks up the
   * gold/cream punctuation echoing the banzuke header on the
   * main menu so the two screens feel related. */
  &::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: 24%;
    right: 24%;
    height: 2px;
    background: ${C.gold};
    opacity: 0.9;
  }
`;

const DohyoLabel = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
`;

const DohyoCode = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.95rem, 1.6cqw, 1.25rem);
  color: ${C.inkText};
  letter-spacing: 0.14em;
  margin-top: 2px;
`;

// ============================================
// STAGE
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: clamp(120px, 16cqw, 240px);
  padding: clamp(16px, 3cqh, 36px) clamp(24px, 4cqw, 64px);
`;

const VSCenter = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.4cqh, 18px);
  height: 78%;
  z-index: 4;
  pointer-events: none;
`;

const VSLine = styled.div`
  width: 1px;
  flex: 1;
  background: linear-gradient(
    180deg,
    transparent 0%,
    ${C.snowBorder} 50%,
    transparent 100%
  );
`;

const VSBadge = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(56px, 7cqw, 96px);
  height: clamp(56px, 7cqw, 96px);
  font-family: "Bungee", cursive;
  font-size: clamp(1.1rem, 2.2cqw, 2rem);
  color: ${C.snowSoft};
  /*
   * Solid vermillion disc, gold ring. Dropped the gradient + glow
   * halo + inset highlight stack — on a snow page that recipe was
   * the strongest "AI-rendered glossy badge" tell. A single short
   * warm shadow gives it weight; the gold ring + outer ring keep
   * it ceremonial.
   */
  background: ${C.vermillion};
  border: 2px solid ${C.gold};
  border-radius: 50%;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 14px rgba(138, 31, 18, 0.4);
  flex-shrink: 0;

  &::before {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 1px solid ${C.gold};
    opacity: 0.55;
    pointer-events: none;
  }
`;

const VSBadgeAnimated = styled(VSBadge)`
  /* Reposition for absolute centering animation */
  animation: ${vsBeat} 2.4s ease-in-out infinite;
`;

// ============================================
// PLAYER CARD
// ============================================

const PlayerCardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  max-width: clamp(260px, 32cqw, 480px);
  min-width: 0;
  height: 100%;
  animation: ${(p) => (p.$side === "left" ? slideInLeft : slideInRight)} 0.5s
    ease-out 0.15s both;
`;

const PlayerCard = styled.div`
  --accent: ${(p) => (p.$hasPlayer ? C.vermillion : C.iceMid)};
  --accentBright: ${(p) =>
    p.$hasPlayer ? C.vermillionBright : C.iceDeep};

  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  /*
   * Snow panel body — pure white tile with a crisp ice-blue border
   * when occupied, deeper grey-ice border when empty. The hero
   * vermillion accent strip across the top still owns the "primary
   * moment" semantic; the gold side-bar still marks the side. No
   * backdrop-filter, no inset highlight, no multi-stop body
   * gradient — just one clean snow tile per fighter.
   */
  background: ${C.snowPanel};
  border: 1.5px solid
    ${(p) => (p.$hasPlayer ? C.iceMid : C.snowBorder)};
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 8px 22px ${C.snowShadow};
  transition: border-color 0.3s ease, box-shadow 0.3s ease;

  /* Top accent line */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent);
    opacity: ${(p) => (p.$hasPlayer ? 1 : 0.45)};
  }

  /* Side-specific subtle accent bar */
  &::after {
    content: "";
    position: absolute;
    top: 14px;
    bottom: 14px;
    width: 2px;
    ${(p) =>
      p.$side === "left"
        ? css`
            left: 10px;
          `
        : css`
            right: 10px;
          `}
    background: linear-gradient(
      180deg,
      transparent 0%,
      ${(p) => (p.$hasPlayer ? C.gold : C.snowBorder)} 50%,
      transparent 100%
    );
    opacity: 0.55;
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: ${(p) =>
    p.$side === "left" ? "space-between" : "space-between"};
  gap: clamp(8px, 1.4cqw, 14px);
  padding: clamp(10px, 1.6cqh, 16px) clamp(14px, 2cqw, 22px);
  border-bottom: 1px solid ${C.snowBorderSoft};
  background: ${C.snowSoft};
  position: relative;
  z-index: 2;

  ${(p) =>
    p.$side === "right" &&
    css`
      flex-direction: row-reverse;
    `}
`;

const RankBadge = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.9cqw, 0.7rem);
  color: ${C.goldDeep};
  background: rgba(232, 197, 71, 0.18);
  border: 1px solid ${C.gold};
  border-radius: 2px;
  padding: clamp(4px, 0.6cqh, 6px) clamp(10px, 1.4cqw, 16px);
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const StatusPill = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(6px, 0.8cqw, 9px);
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.5rem, 0.78cqw, 0.62rem);
  color: ${(p) => (p.$connected ? C.successDeep : C.inkTextMute)};
  text-transform: uppercase;
  letter-spacing: 0.22em;
`;

const StatusDot = styled.span`
  width: clamp(7px, 0.9cqw, 9px);
  height: clamp(7px, 0.9cqw, 9px);
  border-radius: 50%;
  background: ${(p) => (p.$connected ? C.success : C.snowBorder)};
  ${(p) =>
    p.$connected &&
    css`
      animation: ${livePulse} 2s ease-in-out infinite;
    `}
`;

const CardBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(10px, 1.4cqh, 18px);
  position: relative;
  z-index: 2;
  overflow: hidden;
`;

const AvatarFrame = styled.div`
  display: flex;
  align-items: center;
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
  filter: drop-shadow(0 12px 14px rgba(35, 70, 110, 0.32));
`;

const PreviewImage = styled.img`
  height: clamp(160px, 40cqh, 380px);
  max-height: 100%;
  width: auto;
  max-width: 100%;
  object-fit: contain;
`;

const WaitingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(10px, 1.4cqh, 16px);
`;

const WaitingText = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.55rem, 0.95cqw, 0.72rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
`;

const LoadingDots = styled.div`
  display: flex;
  gap: clamp(6px, 1cqw, 10px);
`;

const Dot = styled.div`
  width: clamp(7px, 1cqw, 11px);
  height: clamp(7px, 1cqw, 11px);
  background: ${C.vermillion};
  border-radius: 50%;
  animation: ${dotPulse} 1.4s ease-in-out infinite;
  animation-delay: ${(p) => p.$delay * 0.18}s;
`;

const CardFooter = styled.div`
  padding: clamp(10px, 1.5cqh, 14px) clamp(14px, 2cqw, 22px);
  border-top: 1px solid ${C.snowBorderSoft};
  background: ${C.snowSoft};
  position: relative;
  z-index: 2;
  ${(p) =>
    p.$side === "right" &&
    css`
      text-align: right;
    `}
`;

const PlayerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.5cqw, 1.15rem);
  color: ${(p) => (p.$hasPlayer ? C.inkText : C.inkTextMute)};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  line-height: 1.05;
`;

const PlayerSubtext = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.78cqw, 0.62rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.22em;
  margin-top: 4px;
`;

// ============================================
// CPU DIFFICULTY LIST
// ============================================

const DifficultyList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1cqh, 10px);
  width: 100%;
  height: 100%;
  padding: clamp(4px, 0.6cqh, 8px);
`;

const DifficultyButton = styled.button`
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: clamp(8px, 1.2cqh, 14px) clamp(14px, 2cqw, 22px);
  /*
   * Snow-tile rows. Selection is carried by chrome:
   *   selected   → solid 1.5px iceMid border + 4px iceMid left rule
   *   available  → thin snow border
   *   unavailable→ snow border, dimmed
   * "Selected = ice" matches the existing semantic from the
   * customize tab indicator and the active mawashi swatch ring.
   * Body stays a clean snow tile in every state — no gradient
   * sweeps, no glow halos.
   */
  background: ${(p) => (p.$selected ? C.snowSoft : C.snowPanel)};
  border: ${(p) => (p.$selected ? "1.5px" : "1px")} solid
    ${(p) =>
      p.$selected
        ? C.iceMid
        : p.$available
          ? C.snowBorder
          : C.snowBorderSoft};
  border-left: ${(p) =>
    p.$selected ? `4px solid ${C.iceMid}` : "1px solid transparent"};
  border-radius: 2px;
  cursor: ${(p) => (p.$available ? "pointer" : "not-allowed")};
  opacity: ${(p) => (p.$available ? 1 : 0.6)};
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease,
    box-shadow 0.18s ease;
  font-family: inherit;
  text-align: left;

  ${(p) =>
    p.$selected &&
    css`
      box-shadow: 0 2px 8px rgba(28, 78, 110, 0.18);
    `}

  &:hover {
    ${(p) =>
      p.$available &&
      !p.$selected &&
      css`
        background: ${C.snowSoft};
        border-color: ${C.iceMid};
        transform: translateX(2px);
      `}
  }

  &:active {
    ${(p) =>
      p.$available &&
      css`
        transform: scale(0.99);
      `}
  }
`;

const DifficultyLabel = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.1cqw, 0.95rem);
  color: ${(p) =>
    p.$selected ? C.iceDeep : p.$available ? C.inkText : C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const DifficultyMeta = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.7cqw, 0.55rem);
  color: ${(p) => (p.$selected ? C.iceMid : C.inkTextMute)};
  text-transform: uppercase;
  letter-spacing: 0.22em;
`;

const SoonTag = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.42rem, 0.65cqw, 0.5rem);
  color: ${C.goldDeep};
  background: rgba(232, 197, 71, 0.18);
  border: 1px solid ${C.gold};
  border-radius: 2px;
  padding: 3px 8px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
`;

// ============================================
// CUSTOMIZE PANEL
// ============================================

const CustomizePanel = styled.section`
  position: relative;
  z-index: 5;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  gap: clamp(10px, 1.6cqw, 20px);
  width: min(94%, 980px);
  margin: clamp(8px, 1.2cqh, 14px) auto 0;
  padding: clamp(8px, 1cqh, 12px) clamp(14px, 2cqw, 22px);
  background: ${C.snowPanel};
  border: 1px solid ${C.snowBorder};
  border-radius: 2px;
  box-shadow: 0 4px 14px ${C.snowShadow};
  /*
   * Wipes up from its own bottom edge — it lives at the bottom of
   * the lobby and should read as "the customize tray sliding open"
   * rather than another generic fade-up panel.
   */
  animation: ${clipRevealUp} 0.5s ease-out 0.3s both;

  /* Single thin gold center accent — keeps the panel from feeling
   * undecorated without piling on another full-width gradient strip
   * (those are already overused across menu surfaces). */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 30%;
    right: 30%;
    height: 2px;
    background: ${C.gold};
    opacity: 0.7;
  }
`;

const TabGroup = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(2px, 0.4cqw, 4px);
  border-right: 1px solid ${C.snowBorder};
  padding-right: clamp(10px, 1.5cqw, 16px);
  flex-shrink: 0;
`;

const Tab = styled.button`
  position: relative;
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.55rem, 0.85cqw, 0.68rem);
  text-transform: uppercase;
  letter-spacing: 0.24em;
  padding: clamp(7px, 1cqh, 11px) clamp(12px, 1.6cqw, 18px);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 2px;
  color: ${(p) => (p.$active ? C.iceDeep : C.inkTextMute)};
  cursor: pointer;
  transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease;

  ${(p) =>
    p.$active &&
    css`
      background: ${C.snowPanelDeep};
      border-color: ${C.iceMid};

      &::after {
        content: "";
        position: absolute;
        bottom: -4px;
        left: 25%;
        right: 25%;
        height: 2px;
        background: ${C.vermillion};
      }
    `}

  &:hover {
    color: ${C.inkText};
    ${(p) =>
      !p.$active &&
      css`
        background: ${C.snowSoft};
      `}
  }
`;

const SwatchSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: clamp(5px, 0.7cqw, 8px);
  flex-wrap: wrap;
  min-width: 0;
`;

const SwatchDivider = styled.div`
  width: 1px;
  height: clamp(20px, 2.6cqh, 28px);
  background: ${C.snowBorder};
  margin: 0 clamp(2px, 0.4cqw, 6px);
  flex-shrink: 0;
`;

const SelectedBlock = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1cqw, 12px);
  border-left: 1px solid ${C.snowBorder};
  padding-left: clamp(12px, 1.6cqw, 18px);
  min-width: clamp(120px, 14cqw, 160px);
  flex-shrink: 0;
`;

const SelectedSwatchPreview = styled.div`
  width: clamp(24px, 2.6cqw, 30px);
  height: clamp(24px, 2.6cqw, 30px);
  border-radius: 50%;
  background: ${(p) => p.$gradient || p.$color};
  border: 2px solid ${C.gold};
  box-shadow: 0 2px 5px ${C.snowShadow};
  flex-shrink: 0;
`;

const SelectedNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const SelectedCategory = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.65cqw, 0.5rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const SelectedNameLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 0.95cqw, 0.78rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ColorSwatch = styled.button`
  position: relative;
  width: clamp(22px, 2.4cqw, 28px);
  height: clamp(22px, 2.4cqw, 28px);
  border-radius: 50%;
  border: 2px solid
    ${(p) => (p.$selected ? C.gold : C.snowBorder)};
  background: ${(p) => p.$gradient || p.$color};
  cursor: ${(p) => (p.$taken ? "not-allowed" : "pointer")};
  transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  box-shadow: ${(p) =>
    p.$selected
      ? `0 0 0 2px rgba(232, 197, 71, 0.45), 0 2px 6px ${C.snowShadow}`
      : `0 2px 5px ${C.snowShadow}`};
  flex-shrink: 0;
  animation: ${swatchPop} 0.35s ease-out both;
  animation-delay: ${(p) => Math.min(p.$index ?? 0, 20) * 0.015}s;

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
        font-size: clamp(10px, 1.3cqw, 15px);
        color: ${C.vermillionDeep};
      }
    `}

  &:hover {
    transform: ${(p) => (p.$taken ? "none" : "scale(1.18)")};
    border-color: ${(p) =>
      p.$taken ? C.snowBorder : p.$selected ? C.gold : C.iceMid};
  }

  &:active {
    transform: ${(p) => (p.$taken ? "none" : "scale(0.94)")};
  }
`;

const PatternSwatch = styled(ColorSwatch)`
  width: clamp(26px, 2.8cqw, 32px);
  height: clamp(26px, 2.8cqw, 32px);
  border-radius: 4px;
`;

// ============================================
// BOTTOM BAR
// ============================================

const BottomBar = styled.footer`
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(14px, 2.2cqw, 28px);
  padding: clamp(14px, 2.2cqh, 26px) clamp(20px, 3.5cqw, 48px);
  /*
   * Sumi anchor band — closes the lobby frame at the bottom so the
   * white player cards are bracketed top-and-bottom by dark chrome.
   * The vermillion READY CTA pops cleanly off the dark.
   */
  background: ${C.sumi};
  border-top: 1px solid ${C.sumiBorder};
  box-shadow: 0 -3px 10px ${C.sumiShadow};
`;

const ReadyButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.3cqw, 1.05rem);
  color: ${C.snowSoft};
  /*
   * Solid vermillion CTA. Dropped the gradient + glow halo +
   * inset highlight stack — on a snow page that recipe was the
   * loudest "AI hero button" tell. The single warm shadow gives
   * it lift, the gold hover ring is the sumo "go" cue.
   */
  background: ${C.vermillion};
  border: 1.5px solid ${C.vermillionDeep};
  border-radius: 2px;
  padding: clamp(12px, 1.7cqh, 18px) clamp(28px, 4cqw, 56px);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease,
    box-shadow 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  box-shadow: 0 4px 12px rgba(138, 31, 18, 0.32);

  .arrow {
    transition: transform 0.2s ease;
  }

  &:hover {
    background: ${C.vermillionBright};
    border-color: ${C.gold};
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(138, 31, 18, 0.4);

    .arrow {
      animation: ${arrowNudge} 0.7s ease-in-out infinite;
    }
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }
`;

const CancelButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.3cqw, 1.05rem);
  /*
   * Dark-context ghost button. Sits on the sumi BottomBar opposite
   * the vermillion READY CTA. Transparent with cream hairline so
   * READY clearly owns the primary action.
   */
  color: ${C.creamMute};
  background: transparent;
  border: 1.5px solid ${C.sumiBorder};
  border-radius: 2px;
  padding: clamp(12px, 1.7cqh, 18px) clamp(28px, 4cqw, 56px);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease,
    color 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.22em;

  &:hover {
    background: rgba(234, 241, 247, 0.06);
    border-color: ${C.iceMid};
    color: ${C.cream};
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }
`;

const ReadyChip = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: clamp(8px, 1.2cqh, 12px) clamp(16px, 2.2cqw, 24px);
  /*
   * Slim plate-on-plate chip on the sumi BottomBar. Slightly
   * elevated dark surface (sumiSoft) reads as a status pill on
   * the bunting strip without competing with the vermillion CTA
   * in the middle.
   */
  background: ${C.sumiSoft};
  border: 1px solid ${(p) => (p.$ready ? C.gold : C.sumiBorder)};
  border-radius: 2px;
  min-width: clamp(110px, 14cqw, 160px);
`;

const ReadyChipLabel = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.7cqw, 0.55rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const ReadyChipCount = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.3cqw, 1.05rem);
  color: ${(p) => (p.$ready ? C.gold : C.cream)};
  letter-spacing: 0.16em;
`;

const ReadyPlaceholder = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.55rem, 0.9cqw, 0.7rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.32em;
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

const CPU_DIFFICULTIES = [
  { id: "EASY", meta: "Casual" },
  { id: "NORMAL", meta: "Standard" },
  { id: "HARD", meta: "Challenge" },
  { id: "IMPOSSIBLE", meta: "Brutal" },
];
const AVAILABLE_CPU_DIFFICULTIES = new Set(["HARD", "IMPOSSIBLE"]);

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

  // Color customization - using global context so colors persist to game
  const {
    setPlayer1Color,
    setPlayer2Color,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  } = usePlayerColors();

  const [selectedDifficulty, setSelectedDifficulty] = useState("HARD");
  const [customizeTab, setCustomizeTab] = useState("body");

  const myPlayerIndex = players.findIndex((p) => p.id === socket.id);
  const isPlayer1 = myPlayerIndex === 0;

  // Server-synced colors
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

  // Mawashi (belt) solid colors — curated rainbow + 2 neutrals so all
  // 8 solids + 6 patterns fit on a single row of the customize panel.
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

  // Mawashi (belt) special patterns
  const beltPatterns = [
    {
      name: "Rainbow",
      hex: "rainbow",
      gradient: "linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet)",
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
      gradient: "linear-gradient(135deg, #2E0854, #4B0082, #6A0DAD, #9932CC, #4B0082)",
    },
    {
      name: "Shiny Gold",
      hex: "gold",
      gradient: "linear-gradient(135deg, #B8860B, #FFD700, #FFF8DC, #FFD700, #B8860B)",
    },
  ];

  // Body color options
  const bodyColors = [
    { name: "Default", hex: null, gradient: "linear-gradient(135deg, #888 0%, #aaa 50%, #888 100%)" },
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
  const selectedBeltOption = allBeltOptions.find((c) => c.hex === myMawashiColor);
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

  // Sync server colors to global context
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
    const isReadyAction = e.target.textContent.trim().startsWith("READY");
    setReady(isReadyAction);
    socket.emit("ready_count", {
      playerId: socket.id,
      isReady: isReadyAction,
      roomId: roomName,
    });
  };

  // ============ RENDER HELPERS ============

  const renderPlayerCard = (side) => {
    const isLeft = side === "left";
    const player = isLeft ? players[0] : players[1];
    const hasPlayer = !!player?.fighter;
    const playerColor = isLeft ? serverPlayer1Color : serverPlayer2Color;
    const playerBodyColor = isLeft
      ? serverPlayer1BodyColor
      : serverPlayer2BodyColor;
    const showCPUDifficulty = !isLeft && isCPUMatch;

    return (
      <PlayerCardWrapper $side={side}>
        <PlayerCard $hasPlayer={hasPlayer || showCPUDifficulty} $side={side}>
          <CardHeader $side={side}>
            <RankBadge>{isLeft ? "East" : "West"}</RankBadge>
            <StatusPill $connected={hasPlayer || showCPUDifficulty}>
              <StatusDot $connected={hasPlayer || showCPUDifficulty} />
              {showCPUDifficulty
                ? "CPU Ready"
                : hasPlayer
                  ? "Connected"
                  : "Waiting"}
            </StatusPill>
          </CardHeader>

          <CardBody>
            {showCPUDifficulty ? (
              <DifficultyList>
                {CPU_DIFFICULTIES.map((diff) => {
                  const available = AVAILABLE_CPU_DIFFICULTIES.has(diff.id);
                  const selected = diff.id === selectedDifficulty;
                  return (
                    <DifficultyButton
                      key={diff.id}
                      $available={available}
                      $selected={selected}
                      onClick={() => {
                        if (available && diff.id !== selectedDifficulty) {
                          playButtonPressSound2();
                          setSelectedDifficulty(diff.id);
                          socket.emit("set_cpu_difficulty", { difficulty: diff.id });
                        }
                      }}
                      onMouseEnter={() => available && playButtonHoverSound()}
                    >
                      <DifficultyLabel
                        $selected={selected}
                        $available={available}
                      >
                        {diff.id}
                      </DifficultyLabel>
                      {available ? (
                        <DifficultyMeta $selected={selected}>
                          {diff.meta}
                        </DifficultyMeta>
                      ) : (
                        <SoonTag>Soon</SoonTag>
                      )}
                    </DifficultyButton>
                  );
                })}
              </DifficultyList>
            ) : hasPlayer ? (
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
                <WaitingText>Waiting For Pumo</WaitingText>
                <LoadingDots>
                  <Dot $delay={0} />
                  <Dot $delay={1} />
                  <Dot $delay={2} />
                </LoadingDots>
              </WaitingState>
            )}
          </CardBody>

          <CardFooter $side={side}>
            <PlayerName $hasPlayer={hasPlayer || showCPUDifficulty}>
              {showCPUDifficulty
                ? "CPU Opponent"
                : player?.isCPU
                  ? "CPU"
                  : player?.fighter || (isLeft ? "Awaiting Fighter" : "Awaiting Opponent")}
            </PlayerName>
            <PlayerSubtext>
              {showCPUDifficulty
                ? `Difficulty · ${selectedDifficulty}`
                : hasPlayer
                  ? isLeft
                    ? "East Side · Player 1"
                    : "West Side · Player 2"
                  : "Empty Slot"}
            </PlayerSubtext>
          </CardFooter>
        </PlayerCard>
      </PlayerCardWrapper>
    );
  };

  const renderCustomizePanel = () => {
    if (myPlayerIndex === -1) return null;

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
      <CustomizePanel>
        <TabGroup>
          <Tab $active={isBody} onClick={() => handleTabChange("body")}>
            Body
          </Tab>
          <Tab $active={!isBody} onClick={() => handleTabChange("belt")}>
            Belt
          </Tab>
        </TabGroup>

        <SwatchSection>
          {isBody
            ? bodyColors.map((color, i) => {
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
            : (
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
      </CustomizePanel>
    );
  };

  return (
    <LobbyContainer>
      <BackgroundImage />
      <CinematicOverlay />
      <GrainOverlay />
      <Snowfall intensity={20} showFrost={false} zIndex={2} />

      <TopBar>
        <TopBarLeft>
          <ExitButton
            onClick={handleLeaveDohyo}
            onMouseEnter={playButtonHoverSound}
          >
            <span className="arrow">←</span>
            Leave Dohyo
          </ExitButton>
        </TopBarLeft>

        <DohyoBadge>
          <DohyoLabel>Dohyo</DohyoLabel>
          <DohyoCode>{isCPUMatch ? "VS CPU" : roomName}</DohyoCode>
        </DohyoBadge>

        <TopBarRight />
      </TopBar>

      <Stage>
        {renderPlayerCard("left")}

        <VSCenter>
          <VSLine />
          <VSBadgeAnimated>VS</VSBadgeAnimated>
          <VSLine />
        </VSCenter>

        {renderPlayerCard("right")}
      </Stage>

      {renderCustomizePanel()}

      <BottomBar>
        {canShowReadyButton ? (
          <>
            {ready ? (
              <CancelButton
                onClick={(e) => {
                  handleReady(e);
                  playButtonPressSound();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                CANCEL
              </CancelButton>
            ) : (
              <ReadyButton
                onClick={(e) => {
                  handleReady(e);
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                READY
                <span className="arrow">▶</span>
              </ReadyButton>
            )}
            {!isCPUMatch && (
              <ReadyChip $ready={readyCount > 0}>
                <ReadyChipLabel>Fighters Ready</ReadyChipLabel>
                <ReadyChipCount $ready={readyCount > 0}>
                  {readyCount} / 2
                </ReadyChipCount>
              </ReadyChip>
            )}
          </>
        ) : (
          <ReadyPlaceholder>
            Waiting for an opponent to enter the dohyo...
          </ReadyPlaceholder>
        )}
      </BottomBar>
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
