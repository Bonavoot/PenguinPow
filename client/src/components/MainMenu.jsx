import { useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";

import Lobby from "./Lobby";
import Rooms from "./Rooms";
import Game from "./Game";
import Settings from "./Settings";
import CustomizePage from "./CustomizePage";
import styled, { keyframes, css } from "styled-components";
import { SocketContext } from "../SocketContext";
import lobbyBackground from "../assets/lobby-bkg.webp";

import pumo from "../assets/pumo.png";
/*
 * Hero portrait for the main menu — dignified pre-match pose with the
 * ceremonial kesho-mawashi. Distinct from the in-game pumo.png sprite
 * (which stays imported for preloading + use in lobby/game).
 */
import pumoMainMenu from "../assets/pumo-main-menu.png";
/*
 * Single locked-in hero scene for the main menu — the two-penguins-fighting
 * sketch reads as "this is what the game IS." We deliberately do not cycle
 * a slideshow here; a static hero image feels more confident and on-brand
 * for a Steam main menu.
 */
import mainMenuBackground from "../assets/main-menu-bkg-3.png";
import {
  playButtonHoverSound,
  playButtonPressSound2,
  playBackgroundMusic,
  stopBackgroundMusic,
} from "../utils/soundUtils";
import Snowfall from "./Snowfall";

import {
  C,
  fadeIn,
  fadeUp,
  slideInLeft,
  arrowNudge,
  livePulse,
} from "./menuTheme";

// ============================================
// LOCAL ANIMATIONS
// ============================================

const kenBurns = keyframes`
  0%   { transform: scale(1.06) translate(0, 0); }
  100% { transform: scale(1.14) translate(-1.5%, -1%); }
`;

const tickerScroll = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
`;

// ============================================
// MAIN CONTAINER + BACKGROUND LAYERS
// ============================================

const MainMenuContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: ${C.ink};
  font-family: "Outfit", sans-serif;
`;

const BackgroundImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  pointer-events: none;
  /*
   * Backdrop is ambient atmosphere only \u2014 not a focal scene. We heavily
   * fade and slightly blur the ink illustration so it reads as texture
   * behind the menu and Pumo, instead of competing with them as a
   * detailed foreground image.
   */
  filter: saturate(0.55) brightness(0.42) contrast(0.95) blur(1px);
  animation: ${kenBurns} 22s ease-in-out infinite alternate;
`;

/* Cinematic letterbox + side gradients to focus the eye */
const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    /* left readability gradient */
    linear-gradient(
      90deg,
      rgba(7, 10, 20, 0.92) 0%,
      rgba(7, 10, 20, 0.7) 28%,
      rgba(7, 10, 20, 0.25) 50%,
      rgba(7, 10, 20, 0.55) 100%
    ),
    /* ice-blue wash up top, fading to ink at the bottom */
    linear-gradient(
      180deg,
      rgba(28, 78, 110, 0.32) 0%,
      transparent 40%,
      rgba(7, 10, 20, 0.6) 100%
    ),
    /* vignette */
    radial-gradient(
      ellipse at 35% 55%,
      transparent 30%,
      rgba(0, 0, 0, 0.55) 100%
    );
`;

/* Subtle paper-grain / film texture overlay */
const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.35;
  mix-blend-mode: overlay;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.025) 0px,
      transparent 1px,
      transparent 2px,
      rgba(255, 255, 255, 0.02) 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.03) 0px,
      transparent 1px,
      transparent 3px
    );
`;

/* Cinematic top + bottom letterbox bars (very thin) */
const Letterbox = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  height: clamp(3px, 0.5cqh, 5px);
  background: linear-gradient(180deg, ${C.ink}, ${C.inkSoft});
  z-index: 3;
  pointer-events: none;
  ${(p) => (p.$top ? "top: 0;" : "bottom: 0;")}
`;

// ============================================
// BOTTOM-BAR STATUS PIECES (inline w/ ticker)
// ============================================

const LiveStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.78cqw, 0.6rem);
  color: ${C.cream};
  letter-spacing: 0.18em;
  text-transform: uppercase;
  white-space: nowrap;
`;

const VersionChip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.72cqw, 0.55rem);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  white-space: nowrap;

  span.version {
    color: ${C.gold};
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  span.divider {
    width: 1px;
    height: 10px;
    background: rgba(245, 236, 217, 0.2);
  }

  span.tag {
    color: ${C.creamMute};
  }
`;

const LiveDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  animation: ${livePulse} 2s ease-out infinite;
`;

// ============================================
// HERO LAYOUT (middle stage)
// ============================================

const HeroStage = styled.main`
  position: relative;
  z-index: 10;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: clamp(20px, 3cqw, 60px);
  padding: clamp(28px, 4.5cqh, 60px) clamp(28px, 3.5cqw, 56px) clamp(20px, 2.8cqh, 36px);
  align-items: stretch;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: clamp(18px, 2.8cqh, 32px);
  min-width: 0;
`;

// --- Title block ---

const TitleBlock = styled.div`
  position: relative;
  padding-left: clamp(14px, 1.8cqw, 22px);

  &::before {
    /* vertical vermillion accent bar */
    content: "";
    position: absolute;
    left: 0;
    top: 6%;
    bottom: 6%;
    width: 4px;
    background: linear-gradient(180deg, ${C.vermillion} 0%, ${C.gold} 50%, ${C.vermillion} 100%);
    box-shadow: 0 0 16px ${C.vermillionGlow};
    border-radius: 2px;
    opacity: 0;
    animation: ${fadeIn} 0.6s ease-out 0.25s forwards;
  }
`;

const MainTitle = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.85rem, 4.55cqw, 3.45rem);
  margin: 0;
  line-height: 0.94;
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.012em;
  white-space: nowrap;
  position: relative;
  /*
   * Static, restrained shadow. Tiny vermillion offset for color depth,
   * a soft ambient drop shadow for lift. No animated neon glow.
   */
  text-shadow:
    1px 2px 0 ${C.vermillionDeep},
    0 4px 14px rgba(0, 0, 0, 0.55);
  animation: ${slideInLeft} 0.6s ease-out 0.35s backwards;

  span {
    display: inline-block;
  }

  span.accent {
    color: ${C.vermillionBright};
  }
`;

// --- Menu list ---

const MenuList = styled.nav`
  display: flex;
  flex-direction: column;
  gap: clamp(7px, 1cqh, 11px);
  position: relative;
  /* Drift the menu down toward visual center, leaving the title pinned up top */
  margin-top: clamp(28px, 5cqh, 56px);
`;

const MenuButton = styled.button`
  /*
   * Secondary palette = "Pumo ice" (the mawashi belt color), not the generic
   * indigo from the shared theme. This is THE penguin's blue. Primary stays
   * vermillion for the torii / sumo ring identity.
   */
  --accent: ${(p) => (p.$primary ? C.vermillion : C.ice)};
  --accentBright: ${(p) => (p.$primary ? C.vermillionBright : C.iceBright)};
  --accentGlow: ${(p) =>
    p.$primary ? C.vermillionGlow : "rgba(126, 203, 240, 0.45)"};

  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  width: 100%;
  max-width: clamp(380px, 44cqw, 560px);
  /* More compact vertical rhythm — shorter buttons, same horizontal weight */
  padding: ${(p) =>
    p.$primary
      ? "clamp(8px, 1.15cqh, 12px) clamp(20px, 2.4cqw, 30px)"
      : "clamp(6px, 0.9cqh, 9px) clamp(18px, 2.2cqw, 26px)"};
  background: linear-gradient(
    100deg,
    ${(p) =>
      p.$primary
        ? "rgba(216, 59, 39, 0.22) 0%, rgba(8, 11, 24, 0.55) 60%, rgba(8, 11, 24, 0.4) 100%"
        : "rgba(28, 78, 110, 0.4) 0%, rgba(8, 11, 24, 0.55) 70%, rgba(8, 11, 24, 0.35) 100%"}
  );
  border: 1px solid
    ${(p) =>
      p.$primary
        ? "rgba(238, 81, 65, 0.55)"
        : "rgba(126, 203, 240, 0.35)"};
  border-left: 3px solid var(--accent);
  border-radius: 2px;
  cursor: ${(p) => (p.$disabled ? "default" : "pointer")};
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  color: ${(p) => (p.$disabled ? "rgba(245, 236, 217, 0.35)" : C.cream)};
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow: 0 2px 0 #000;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease,
    box-shadow 0.2s ease;
  backdrop-filter: blur(3px);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.55 + p.$index * 0.07}s;
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);

  /* diagonal slash underline accent */
  &::after {
    content: "";
    position: absolute;
    left: 18px;
    right: 26px;
    bottom: 4px;
    height: 1px;
    background: linear-gradient(
      90deg,
      var(--accent) 0%,
      transparent 80%
    );
    transform: scaleX(${(p) => (p.$primary ? 1 : 0.4)});
    transform-origin: left;
    opacity: ${(p) => (p.$disabled ? 0.2 : 0.7)};
    transition: transform 0.25s ease, opacity 0.25s ease;
  }

  ${(p) =>
    !p.$disabled &&
    css`
      &:hover {
        transform: translateX(8px);
        background: linear-gradient(
          100deg,
          ${p.$primary
              ? "rgba(238, 81, 65, 0.4) 0%, rgba(8, 11, 24, 0.55) 60%, rgba(8, 11, 24, 0.4) 100%"
              : "rgba(54, 130, 170, 0.5) 0%, rgba(8, 11, 24, 0.55) 70%, rgba(8, 11, 24, 0.35) 100%"}
        );
        border-color: var(--accentBright);
        box-shadow:
          0 6px 22px rgba(0, 0, 0, 0.55),
          0 0 24px var(--accentGlow),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);

        &::after {
          transform: scaleX(1);
          opacity: 1;
        }

        .menu-arrow {
          color: var(--accentBright);
          animation: ${arrowNudge} 0.8s ease-in-out infinite;
        }
      }

      &:active {
        transform: translateX(4px) scale(0.99);
      }
    `}

  /* Tooltip reveal on hover (works for disabled buttons too) */
  &:hover .menu-tooltip {
    opacity: 1;
    transform: translateX(0);
  }
`;

/*
 * Tooltip — appears to the right of a menu button on hover.
 * Used for SOON items (e.g. ranked Play Online) to softly
 * redirect the player to a working alternative.
 */
const MenuTooltip = styled.span.attrs({ className: "menu-tooltip" })`
  position: absolute;
  top: 50%;
  left: calc(100% + 14px);
  transform: translate(-6px, -50%);
  padding: clamp(7px, 1cqh, 10px) clamp(12px, 1.6cqw, 18px);
  background: ${C.inkPanelStrong};
  border: 1px solid rgba(245, 236, 217, 0.18);
  border-left: 2px solid ${C.vermillion};
  border-radius: 2px;
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.78cqw, 0.6rem);
  color: ${C.cream};
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: 0 1px 0 #000;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  z-index: 5;
  transition: opacity 0.2s ease, transform 0.2s ease;

  strong {
    color: ${C.gold};
    font-weight: 700;
  }

  /* Left-pointing arrow */
  &::before {
    content: "";
    position: absolute;
    top: 50%;
    left: -6px;
    transform: translateY(-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: ${C.inkPanelStrong};
    border-left: 1px solid ${C.vermillion};
    border-bottom: 1px solid rgba(245, 236, 217, 0.18);
  }
`;

const MenuArrow = styled.span.attrs({ className: "menu-arrow" })`
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  font-size: ${(p) => (p.$primary ? "clamp(0.95rem, 1.5cqw, 1.15rem)" : "clamp(0.7rem, 1.1cqw, 0.85rem)")};
  color: ${(p) => (p.$disabled ? "rgba(245, 236, 217, 0.25)" : "var(--accent)")};
  transition: color 0.2s ease;
  text-shadow: 0 0 12px var(--accentGlow);
  &::after {
    content: "▶";
  }
`;

const MenuLabels = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
`;

const MenuLabel = styled.div`
  font-size: ${(p) => (p.$primary ? "clamp(0.95rem, 1.6cqw, 1.18rem)" : "clamp(0.72rem, 1.2cqw, 0.92rem)")};
  line-height: 1.05;
`;

const MenuMeta = styled.div`
  font-family: "Noto Sans JP", sans-serif;
  font-weight: 500;
  font-size: clamp(0.46rem, 0.78cqw, 0.6rem);
  color: ${C.creamMute};
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 #000;
  margin-top: 2px;
`;

/*
 * Thin horizontal divider between game-mode buttons and
 * system-level entries (e.g. Options). Signals visual hierarchy.
 */
const MenuDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: clamp(380px, 44cqw, 560px);
  margin: clamp(3px, 0.5cqh, 6px) 0 clamp(2px, 0.3cqh, 4px);
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.4rem, 0.65cqw, 0.5rem);
  color: ${C.creamMute};
  letter-spacing: 0.32em;
  text-transform: uppercase;
  opacity: 0;
  animation: ${fadeIn} 0.5s ease-out forwards;
  animation-delay: ${(p) => 0.55 + (p.$index ?? 5) * 0.07}s;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(245, 236, 217, 0.12);
  }
`;

/*
 * SystemButton — slimmer, lower-contrast version of MenuButton
 * used for system-level entries like Options. Same color
 * language but visually de-emphasized so it doesn't compete
 * with the primary game-mode list above it.
 */
const SystemButton = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  width: 100%;
  max-width: clamp(380px, 44cqw, 560px);
  padding: clamp(7px, 1cqh, 10px) clamp(18px, 2.2cqw, 26px);
  background: transparent;
  border: 1px solid rgba(245, 236, 217, 0.12);
  border-radius: 2px;
  cursor: pointer;
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  color: ${C.creamMute};
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow: 0 2px 0 #000;
  font-size: clamp(0.65rem, 1.05cqw, 0.82rem);
  transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease,
    border-color 0.2s ease, box-shadow 0.2s ease;
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.55 + p.$index * 0.07}s;

  .system-icon {
    display: grid;
    place-items: center;
    width: clamp(16px, 1.6cqw, 22px);
    height: clamp(16px, 1.6cqw, 22px);
    color: ${C.creamMute};
    transition: color 0.2s ease, transform 0.4s ease;
  }
  .system-icon .material-symbols-outlined {
    font-size: clamp(0.85rem, 1.4cqw, 1.05rem);
  }

  &:hover {
    color: ${C.cream};
    background: rgba(28, 78, 110, 0.32);
    border-color: rgba(126, 203, 240, 0.4);
    transform: translateX(6px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);

    .system-icon {
      color: ${C.iceBright};
      transform: rotate(45deg);
    }
  }

  &:active {
    transform: translateX(3px) scale(0.99);
  }
`;

const SoonTag = styled.span`
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${C.gold};
  letter-spacing: 0.22em;
  padding: 3px 7px;
  border: 1px solid rgba(232, 197, 71, 0.35);
  border-radius: 2px;
  background: rgba(232, 197, 71, 0.06);
  text-shadow: none;
`;

// --- Right column: Pumo hero + Banzuke (today's stats) panel ---

const RightColumn = styled.aside`
  position: relative;
  height: 100%;
  min-width: 0;

  @media (max-width: 720px) {
    display: none;
  }
`;

/*
 * Pumo hero breathing — same subtle scaleY pattern used by the
 * breathing characters in Lobby + CustomizePage so the menu reads
 * as part of one consistent animation system across pages.
 */
const pumoBreathe = keyframes`
  0%, 100% { transform: scaleY(1);     }
  50%      { transform: scaleY(1.018); }
`;

const PumoHero = styled.img`
  position: absolute;
  right: clamp(-90px, -5cqw, -32px);
  /*
   * Pushed down so his lower body extends past HeroStage and gets clipped
   * by MainMenuContainer's overflow:hidden / hidden behind the BottomHud.
   * Reads as "Pumo emerging at the bottom-right edge of the page" — only
   * his head, chest, and mawashi are visible above the cutoff line.
   */
  bottom: clamp(-220px, -28cqh, -160px);
  height: clamp(460px, 94cqh, 680px);
  width: auto;
  z-index: 1;
  pointer-events: none;
  user-select: none;
  /*
   * Anchor the breathing scale to his feet so his planted base stays put
   * and only the chest/head subtly rise on the inhale.
   */
  transform-origin: 50% 100%;
  /*
   * Pumo stays full-color (he's the brand) and crisp \u2014 no mask, no fade.
   * The faded backdrop already gives him room to read; here we just nudge
   * his luminance down a hair so he doesn't punch out of the scene, and
   * drop a soft ground-shadow underneath plus a subtle ice-blue rim glow
   * to anchor him.
   */
  filter: saturate(0.96) brightness(0.94)
          drop-shadow(0 14px 22px rgba(0, 0, 0, 0.6))
          drop-shadow(0 0 28px rgba(126, 203, 240, 0.12));
  animation: ${pumoBreathe} 3s ease-in-out infinite,
             ${fadeUp} 0.8s ease-out 0.3s backwards;
`;

/*
 * BanzukeCard — clean stats panel.
 * The numeric values are wired to placeholders for now;
 * swap the StatValue children for live data once the
 * relevant socket events / stats endpoints exist:
 *   - wrestlersOnline -> server-reported player count
 *   - matchesToday    -> server-reported daily match count
 *   - playerRank      -> player's own rank / tier
 */
/*
 * BanzukeCard — slim "today's stats" panel, pinned to the top-RIGHT of
 * the HeroStage so it sits opposite the title (top-left). Pumo lives
 * lower in the right column so the banzuke card has clear airspace
 * above his head. Background is the same ice-blue → ink gradient as the
 * StatusBlock in the bottom HUD so it reads as part of one panel family.
 */
const BanzukeCard = styled.section`
  position: absolute;
  top: clamp(44px, 6cqh, 76px);
  right: clamp(44px, 5cqw, 76px);
  z-index: 2;
  width: clamp(200px, 23cqw, 270px);
  padding: clamp(10px, 1.4cqh, 14px) clamp(14px, 1.8cqw, 20px);
  background: linear-gradient(
    180deg,
    rgba(28, 78, 110, 0.42) 0%,
    rgba(8, 11, 24, 0.85) 100%
  );
  border: 1px solid rgba(126, 203, 240, 0.2);
  border-left: 3px solid ${C.gold};
  border-radius: 2px;
  backdrop-filter: blur(6px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
  opacity: 0;
  animation: ${fadeUp} 0.6s ease-out 0.55s forwards;
`;

const BanzukeHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: clamp(6px, 0.8cqh, 8px);
  margin-bottom: clamp(8px, 1cqh, 11px);
  border-bottom: 1px solid rgba(245, 236, 217, 0.1);
`;

const BanzukeTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1cqw, 0.75rem);
  color: ${C.gold};
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-shadow: 1px 1px 0 #000;
`;

const BanzukeDate = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.45rem, 0.72cqw, 0.55rem);
  color: ${C.creamMute};
  letter-spacing: 0.22em;
  text-transform: uppercase;
`;

const StatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 9px);
`;

const StatRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`;

const StatLabel = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.8cqw, 0.62rem);
  color: ${C.creamMute};
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const StatValue = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.75rem, 1.25cqw, 0.95rem);
  color: ${(p) => (p.$muted ? C.creamMute : C.cream)};
  letter-spacing: 0.06em;
  text-shadow: 0 2px 0 #000;

  ${(p) =>
    p.$accent &&
    css`
      color: ${C.vermillionBright};
    `}
`;

// --- Connection error ---

const ConnectionErrorBanner = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: clamp(10px, 1.4cqh, 14px) clamp(18px, 2.4cqw, 28px);
  background: linear-gradient(
    180deg,
    ${C.vermillionDeep} 0%,
    rgba(96, 22, 14, 0.95) 100%
  );
  border: 1px solid ${C.vermillionBright};
  border-radius: 4px;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.6),
    0 0 30px ${C.vermillionGlow};
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.9cqw, 0.72rem);
  color: ${C.cream};
  letter-spacing: 0.14em;
  text-shadow: 1px 1px 0 #000;
  animation: ${fadeIn} 0.4s ease-out;

  &::before {
    content: "⚠";
    color: ${C.gold};
    font-size: 1.4em;
  }
`;

// ============================================
// BOTTOM HUD — broadcast-style: status pills + scrolling ticker
// ============================================

const BottomHud = styled.footer`
  position: relative;
  z-index: 20;
  display: flex;
  align-items: stretch;
  border-top: 1px solid rgba(245, 236, 217, 0.08);
  background: linear-gradient(
    0deg,
    rgba(7, 10, 20, 0.85) 0%,
    rgba(7, 10, 20, 0.45) 100%
  );
  opacity: 0;
  animation: ${fadeIn} 0.6s ease-out 0.6s forwards;
  min-height: clamp(28px, 3.6cqh, 40px);
`;

/* Fixed-width status block on the left edge of the bottom bar */
const StatusBlock = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.5cqw, 18px);
  padding: 0 clamp(16px, 2cqw, 26px);
  background: linear-gradient(
    180deg,
    rgba(28, 78, 110, 0.5) 0%,
    rgba(8, 11, 24, 0.85) 100%
  );
  border-right: 2px solid ${C.vermillion};
  box-shadow: inset 0 1px 0 rgba(245, 236, 217, 0.05);
  flex-shrink: 0;
`;

const StatusDivider = styled.span`
  width: 1px;
  height: 14px;
  background: rgba(245, 236, 217, 0.18);
`;

const Ticker = styled.div`
  position: relative;
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(216, 59, 39, 0.04) 50%,
    transparent 100%
  );

  &::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 60px;
    background: linear-gradient(90deg, ${C.ink}, transparent);
    z-index: 2;
    pointer-events: none;
  }
  &::after {
    content: "";
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 60px;
    background: linear-gradient(270deg, ${C.ink}, transparent);
    z-index: 2;
    pointer-events: none;
  }
`;

const TickerTrack = styled.div`
  display: inline-flex;
  white-space: nowrap;
  animation: ${tickerScroll} 45s linear infinite;
  font-family: "Outfit", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.85cqw, 0.65rem);
  color: ${C.creamMute};
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const TickerItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 0 28px;

  &::after {
    content: "◆";
    color: ${C.vermillion};
    font-size: 0.6em;
  }

  strong {
    color: ${C.gold};
    font-weight: 700;
    margin-right: 6px;
  }

  em {
    color: ${C.cream};
    font-style: normal;
    font-weight: 600;
  }
`;

// ============================================
// PRELOAD ASSETS
// ============================================

const preGameImages = [
  lobbyBackground,
  pumo,
  mainMenuBackground,
];

// ============================================
// MAIN COMPONENT
// ============================================

const MainMenu = ({ rooms, setRooms, currentPage, setCurrentPage, localId, connectionError }) => {
  const [roomName, setRoomName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isCPUMatch, setIsCPUMatch] = useState(false);
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    preGameImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    playBackgroundMusic();

    const handleCPUMatchCreated = (data) => {
      console.log("CPU match created:", data);
      setRoomName(data.roomId);
      setIsCPUMatch(true);
      setCurrentPage("lobby");
    };

    const handleCPUMatchFailed = (data) => {
      console.error("CPU match failed:", data.reason);
      alert("Failed to create CPU match: " + data.reason);
    };

    socket.on("cpu_match_created", handleCPUMatchCreated);
    socket.on("cpu_match_failed", handleCPUMatchFailed);

    return () => {
      stopBackgroundMusic();
      socket.off("cpu_match_created", handleCPUMatchCreated);
      socket.off("cpu_match_failed", handleCPUMatchFailed);
    };
  }, [socket, setCurrentPage]);

  useEffect(() => {
    if (currentPage === "game") {
      stopBackgroundMusic();
    } else if (currentPage === "mainMenu") {
      playBackgroundMusic();
    }
  }, [currentPage]);

  const handleMainMenuPage = () => {
    setIsCPUMatch(false);
    setCurrentPage("mainMenu");
  };

  const handleDisplayRooms = () => {
    setCurrentPage("rooms");
  };

  const handleGame = () => {
    setCurrentPage("game");
  };

  const handleJoinRoom = () => {
    setIsCPUMatch(false);
    setCurrentPage("lobby");
  };

  const handleSettings = () => {
    setShowSettings((prev) => !prev);
  };

  const handleVsCPU = () => {
    playButtonPressSound2();
    console.log("Starting VS CPU match...");
    socket.emit("create_cpu_match", { socketId: socket.id });
  };

  const handleClickOutside = (e) => {
    if (
      showSettings &&
      !e.target.closest(".settings-container") &&
      !e.target.closest(".settings-button")
    ) {
      setShowSettings(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettings]);

  const renderMainMenu = () => {
    return (
      <MainMenuContainer>
        <BackgroundImage src={mainMenuBackground} alt="" />
        <CinematicOverlay />
        <GrainOverlay />
        <Snowfall intensity={18} showFrost={false} zIndex={4} />
        <Letterbox $top />
        <Letterbox />

        {/* Connection error */}
        {connectionError && (
          <ConnectionErrorBanner>
            CONNECTION LOST — RECONNECTING…
          </ConnectionErrorBanner>
        )}

        {/* HERO STAGE */}
        <HeroStage>
          <LeftColumn>
            <TitleBlock>
              <MainTitle>
                <span>Pumo</span>{" "}
                <span className="accent">Pumo&nbsp;!</span>
              </MainTitle>
            </TitleBlock>

            <MenuList>
              <MenuButton
                $primary
                $disabled
                $index={0}
                onMouseEnter={playButtonHoverSound}
              >
                <MenuArrow $primary $disabled />
                <MenuLabels>
                  <MenuLabel $primary>Play Online</MenuLabel>
                  <MenuMeta>Ranked Matchmaking</MenuMeta>
                </MenuLabels>
                <SoonTag>Soon</SoonTag>
                <MenuTooltip>
                  Coming soon — try <strong>Custom&nbsp;Match</strong>
                </MenuTooltip>
              </MenuButton>

              <MenuButton
                $index={1}
                onClick={() => {
                  handleDisplayRooms();
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                <MenuArrow />
                <MenuLabels>
                  <MenuLabel>Custom Match</MenuLabel>
                  <MenuMeta>Create or Join a Room · Unranked</MenuMeta>
                </MenuLabels>
              </MenuButton>

              <MenuButton
                $index={2}
                onClick={handleVsCPU}
                onMouseEnter={playButtonHoverSound}
              >
                <MenuArrow />
                <MenuLabels>
                  <MenuLabel>VS CPU</MenuLabel>
                  <MenuMeta>Practice vs AI</MenuMeta>
                </MenuLabels>
              </MenuButton>

              <MenuButton
                $index={3}
                $disabled
                onMouseEnter={playButtonHoverSound}
              >
                <MenuArrow $disabled />
                <MenuLabels>
                  <MenuLabel>Basho Tournament</MenuLabel>
                  <MenuMeta>Multi-Round Championship</MenuMeta>
                </MenuLabels>
                <SoonTag>Soon</SoonTag>
              </MenuButton>

              <MenuButton
                $index={4}
                onClick={() => {
                  playButtonPressSound2();
                  setCurrentPage("customize");
                }}
                onMouseEnter={playButtonHoverSound}
              >
                <MenuArrow />
                <MenuLabels>
                  <MenuLabel>Customize</MenuLabel>
                  <MenuMeta>Edit Your Wrestler</MenuMeta>
                </MenuLabels>
              </MenuButton>

              <MenuButton
                $index={5}
                $disabled
                onMouseEnter={playButtonHoverSound}
              >
                <MenuArrow $disabled />
                <MenuLabels>
                  <MenuLabel>Career Stats</MenuLabel>
                  <MenuMeta>Records &amp; Replays</MenuMeta>
                </MenuLabels>
                <SoonTag>Soon</SoonTag>
              </MenuButton>

              <MenuDivider $index={6}>System</MenuDivider>

              <SystemButton
                $index={7}
                className="settings-button"
                onClick={() => {
                  handleSettings();
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                <span className="system-icon">
                  <span className="material-symbols-outlined">settings</span>
                </span>
                Options
              </SystemButton>
            </MenuList>
          </LeftColumn>

          <RightColumn>
            {/*
              Pumo hero — the brand. Stays in front of the faded battle
              scene backdrop, idles softly to feel alive.
            */}
            <PumoHero src={pumoMainMenu} alt="Pumo" />
          </RightColumn>

          {/*
            BanzukeCard — sibling of the columns rather than a child of
            either, so it positions against HeroStage and lives in the
            empty space below the menu without colliding with Pumo on
            the right. Values are placeholders until the server-side
            stats endpoints are wired up (wrestlersOnline,
            matchesToday, playerRank).
          */}
          <BanzukeCard>
            <BanzukeHeader>
              <BanzukeTitle>Today&apos;s Banzuke</BanzukeTitle>
              <BanzukeDate>
                {new Date().toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </BanzukeDate>
            </BanzukeHeader>
            <StatList>
              <StatRow>
                <StatLabel>Wrestlers Online</StatLabel>
                <StatValue>—</StatValue>
              </StatRow>
              <StatRow>
                <StatLabel>Matches Today</StatLabel>
                <StatValue>—</StatValue>
              </StatRow>
              <StatRow>
                <StatLabel>Your Rank</StatLabel>
                <StatValue $muted>Unranked</StatValue>
              </StatRow>
            </StatList>
          </BanzukeCard>
        </HeroStage>

        {/* BOTTOM HUD — broadcast-style: status block + scrolling ticker */}
        <BottomHud>
          <StatusBlock>
            <LiveStatus>
              <LiveDot />
              Servers Online
            </LiveStatus>
            <StatusDivider />
            <VersionChip>
              <span className="version">v0.1.0</span>
              <span className="divider" />
              <span className="tag">Early Access</span>
            </VersionChip>
          </StatusBlock>

          <Ticker>
            <TickerTrack>
              {[0, 1].map((i) => (
                <span key={i} style={{ display: "inline-flex" }}>
                  <TickerItem>
                    <strong>UPDATE 0.1</strong>
                    <em>Push & slap your way to glory in the dohyo</em>
                  </TickerItem>
                  <TickerItem>
                    <strong>NOW LIVE</strong>
                    <em>Worldwide ranked matchmaking is open</em>
                  </TickerItem>
                  <TickerItem>
                    <strong>HATSU SEASON</strong>
                    <em>Earn the Yokozuna title before the tournament closes</em>
                  </TickerItem>
                  <TickerItem>
                    <strong>DEV NOTE</strong>
                    <em>Steam release coming — wishlist now to support the dohyo</em>
                  </TickerItem>
                </span>
              ))}
            </TickerTrack>
          </Ticker>
        </BottomHud>

        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </MainMenuContainer>
    );
  };

  switch (currentPage) {
    case "mainMenu":
      return (
        <div className="current-page">
          {renderMainMenu()}
          {currentPage === "rooms" && (
              <Rooms
                rooms={rooms}
                handleMainMenuPage={handleMainMenuPage}
                handleJoinRoom={handleJoinRoom}
                setRoomName={setRoomName}
              />
          )}
        </div>
      );
    case "lobby":
      return (
        <div className="current-page">
            <Lobby
              rooms={rooms}
              setRooms={setRooms}
              roomName={roomName}
              handleGame={handleGame}
              setCurrentPage={setCurrentPage}
              onLeaveDohyo={() => {
                setIsCPUMatch(false);
                setCurrentPage("mainMenu");
              }}
              isCPUMatch={isCPUMatch}
            />
        </div>
      );
    case "game":
      return (
        <div className="current-page">
            <Game
              localId={localId}
              rooms={rooms}
              roomName={roomName}
              setCurrentPage={setCurrentPage}
              isCPUMatch={isCPUMatch}
            />
        </div>
      );
    case "customize":
      return (
        <div className="current-page">
            <CustomizePage onBack={() => setCurrentPage("mainMenu")} />
        </div>
      );
    default:
      return (
        <div className="current-page">
          {renderMainMenu()}
          {currentPage === "rooms" && (
              <Rooms
                rooms={rooms}
                handleMainMenuPage={handleMainMenuPage}
                handleJoinRoom={handleJoinRoom}
                setRoomName={setRoomName}
              />
          )}
        </div>
      );
  }
};

MainMenu.propTypes = {
  rooms: PropTypes.array.isRequired,
  setRooms: PropTypes.func,
  currentPage: PropTypes.string.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  localId: PropTypes.string.isRequired,
  connectionError: PropTypes.bool,
};

export default MainMenu;
