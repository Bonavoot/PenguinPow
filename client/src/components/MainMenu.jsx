import { useState, useEffect, useContext, Fragment } from "react";
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
import mainMenuBackground from "../assets/main-menu-bkg-4.png";
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
  slideInRight,
  clipRevealUp,
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
  background: ${C.snow};
  font-family: "Space Grotesk", sans-serif;
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
   * Penguin Kokugikan arena. On the snow theme we PUSH the image a
   * touch brighter (no longer dragging it down toward an inky bg)
   * and keep the very mild blur so it sits behind the foreground
   * type without smearing the nobori banners. Saturation stays close
   * to natural — the colorful banners are part of the brand and
   * desaturating them was reading as "stock illustration filtered
   * for a hero section" rather than as a real arena scene.
   */
  object-position: 50% 55%;
  transform: scale(1.08);
  filter: saturate(1.02) brightness(1.04) contrast(0.98) blur(1.5px);
  animation: ${kenBurns} 22s ease-in-out infinite alternate;
`;

/*
 * Cinematic overlay — re-tuned for the snow theme.
 *
 * On the dark theme this overlay was a left-column DARK readability
 * wash + a dark vignette to pull the eye to the arena entrance. On
 * the snow theme we invert: the overlay is a soft icy WHITE wash
 * (so dark navy menu type stays legible against the colorful arena
 * art) plus a gentle cool corner-shadow framing.
 *
 * Layered:
 *   1. Left-column snow wash — a frosted veil over the menu side
 *      of the screen. Tapers off by ~45% across so the arena
 *      illustration breathes on the right.
 *   2. Top sky-blue → bottom snow band so the HUD strip blends
 *      into a snowdrift instead of sitting on a hard cut.
 *   3. Soft cool corner shadows — frames the scene without
 *      collapsing the bright daytime art into a stage spotlight.
 */
const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    /* left-column frosted readability veil */
    linear-gradient(
      90deg,
      rgba(234, 241, 247, 0.86) 0%,
      rgba(234, 241, 247, 0.6) 22%,
      rgba(234, 241, 247, 0.2) 38%,
      rgba(234, 241, 247, 0) 50%,
      rgba(234, 241, 247, 0) 100%
    ),
    /* sky-cool top wash, fading to snow at the bottom for HUD blend */
    linear-gradient(
        180deg,
        rgba(203, 219, 231, 0.55) 0%,
        transparent 30%,
        transparent 60%,
        rgba(234, 241, 247, 0.7) 100%
      ),
    /* soft cool corner framing — replaces the previous black vignette */
    radial-gradient(
        ellipse at 50% 55%,
        transparent 50%,
        rgba(35, 70, 110, 0.18) 100%
      );
`;

/*
 * Paper-grain texture overlay — softened for the snow theme.
 * On the dark version this was at opacity 0.35 with mix-blend-mode
 * overlay (which threw flecks of white onto the dark surface as a
 * subtle "newsprint" texture). On snow that mode either disappears
 * or muddies the field, so we drop the blend mode and dial the
 * opacity way back. The grain still adds the faint paper tooth that
 * keeps a pure-color background from looking like a flat screen
 * grab, but it no longer fights the lightness of the snow.
 */
const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.18;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(35, 70, 110, 0.04) 0px,
      transparent 1px,
      transparent 2px,
      rgba(35, 70, 110, 0.03) 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(35, 70, 110, 0.03) 0px,
      transparent 1px,
      transparent 3px
    );
`;

/* Thin top + bottom letterbox bars in icy snow tones */
const Letterbox = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  height: clamp(3px, 0.5cqh, 5px);
  background: ${C.snowFrost};
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
  font-family: "Space Grotesk", sans-serif;
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
  font-family: "Space Grotesk", sans-serif;
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
    background: ${C.creamFaint};
  }

  span.tag {
    color: ${C.creamMute};
  }
`;

const LiveDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${C.success};
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
  padding: clamp(28px, 4.5cqh, 60px) clamp(28px, 3.5cqw, 56px)
    clamp(20px, 2.8cqh, 36px);
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

/*
 * The wordmark stands on its own — no decorative left bar, no gradient
 * accent. A single confident lockup reads as a real game logo; the
 * old vertical gradient rule was fighting the type for attention and
 * making the two PUMO halves feel like two separate brands.
 */
const TitleBlock = styled.div`
  position: relative;
`;

const MainTitle = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.85rem, 4.55cqw, 3.45rem);
  margin: 0;
  line-height: 0.94;
  color: ${C.inkTextStrong};
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
  position: relative;
  /*
   * Stamped poster depth: a thin white emboss highlight up top makes
   * the letterforms feel pressed INTO the snow surface, a solid dark
   * drop at the bottom anchors the wordmark, and a soft cool ambient
   * shadow lifts it off the arena art behind. No more vermillion
   * misregistration — that was literally muddying the letterforms
   * and killing legibility.
   */
  text-shadow:
    0 -1px 0 rgba(255, 255, 255, 0.55),
    0 2px 0 rgba(15, 29, 46, 0.18),
    0 4px 0 rgba(15, 29, 46, 0.30),
    0 8px 18px ${C.snowShadowStrong};
  animation: ${slideInLeft} 0.6s ease-out 0.35s backwards;

  span {
    display: inline-block;
  }

  /*
   * Both PUMO halves now share the same deep ink — the wordmark
   * reads as ONE word. The exclamation is the single punch of red,
   * acting like a hanko seal at the end of the lockup.
   */
  span.bang {
    color: ${C.vermillion};
    margin-left: 0.08em;
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
   * Snow plaque buttons. Primary stays vermillion (sumo ring red),
   * secondary uses the deeper iceMid for a calm cool accent — both
   * pull double-duty as the LEFT RULE that anchors the row. The
   * body of every button is now a clean white tile with a crisp
   * solid border (no semi-transparent edges, no glow halos at
   * rest), which reads as "real signage on a wall" instead of the
   * previous SaaS card-with-inset-highlight.
   *
   * Primary differentiates by:
   *   - thicker border (1.5px vs 1px)
   *   - thicker left rule (5px vs 3px)
   *   - vermillion border color
   * Secondary uses the same body, just thinner ice-blue chrome.
   */
  --accent: ${(p) => (p.$primary ? C.vermillion : C.iceMid)};
  --accentBright: ${(p) => (p.$primary ? C.vermillionDeep : C.iceDeep)};

  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  width: 100%;
  max-width: clamp(380px, 44cqw, 560px);
  padding: ${(p) =>
    p.$primary
      ? "clamp(8px, 1.15cqh, 12px) clamp(20px, 2.4cqw, 30px)"
      : "clamp(6px, 0.9cqh, 9px) clamp(18px, 2.2cqw, 26px)"};
  background: ${(p) => (p.$disabled ? C.snowSoft : C.snowPanel)};
  border: ${(p) => (p.$primary ? "1.5px" : "1px")} solid
    ${(p) => (p.$primary ? C.vermillion : C.snowBorder)};
  border-left: ${(p) => (p.$primary ? "5px" : "3px")} solid var(--accent);
  border-radius: 2px;
  cursor: ${(p) => (p.$disabled ? "default" : "pointer")};
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  color: ${(p) => (p.$disabled ? C.inkTextFaint : C.inkText)};
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  /*
   * Single short cool drop shadow — no glow halo, no inset
   * highlight. The visual hierarchy is carried by the LEFT RULE
   * width and color, not by stacking effects.
   */
  box-shadow: 0 2px 6px ${C.snowShadow};
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.55 + p.$index * 0.07}s;
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);

  ${(p) =>
    !p.$disabled &&
    css`
      &:hover {
        transform: translateX(8px);
        background: ${C.snowSoft};
        border-color: var(--accentBright);
        box-shadow: 0 4px 12px ${C.snowShadowStrong};

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
  background: ${C.inkText};
  border: 1px solid ${C.inkText};
  border-left: 2px solid ${C.vermillion};
  border-radius: 2px;
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.78cqw, 0.6rem);
  color: ${C.snowSoft};
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: 0 6px 14px ${C.snowShadowStrong};
  opacity: 0;
  pointer-events: none;
  z-index: 5;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;

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
    background: ${C.inkText};
    border-left: 1px solid ${C.vermillion};
    border-bottom: 1px solid ${C.inkText};
  }
`;

const MenuArrow = styled.span.attrs({ className: "menu-arrow" })`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: ${(p) =>
    p.$primary
      ? "clamp(0.95rem, 1.5cqw, 1.15rem)"
      : "clamp(0.7rem, 1.1cqw, 0.85rem)"};
  color: ${(p) => (p.$disabled ? C.inkTextFaint : "var(--accent)")};
  transition: color 0.2s ease;
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
  font-size: ${(p) =>
    p.$primary
      ? "clamp(0.95rem, 1.6cqw, 1.18rem)"
      : "clamp(0.72rem, 1.2cqw, 0.92rem)"};
  line-height: 1.05;
`;

const MenuMeta = styled.div`
  font-family: "Noto Sans JP", sans-serif;
  font-weight: 500;
  font-size: clamp(0.46rem, 0.78cqw, 0.6rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.22em;
  text-transform: uppercase;
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
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.4rem, 0.65cqw, 0.5rem);
  color: ${C.inkTextMute};
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
    background: ${C.snowBorder};
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
  /*
   * Deliberately low-contrast: transparent tile with just a hairline
   * snow border. OPTIONS is a SECONDARY action that sits below the
   * primary game-mode stack, so painting it as a solid plaque (whether
   * white or dark) competes with the primary list for attention.
   * Keeping it as a transparent ghost button visually demotes it
   * exactly as a "system row" should be.
   */
  background: transparent;
  border: 1px solid ${C.snowBorderSoft};
  border-radius: 2px;
  cursor: pointer;
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  color: ${C.inkTextSoft};
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: clamp(0.65rem, 1.05cqw, 0.82rem);
  transition:
    transform 0.2s ease,
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.55 + p.$index * 0.07}s;

  .system-icon {
    display: grid;
    place-items: center;
    width: clamp(16px, 1.6cqw, 22px);
    height: clamp(16px, 1.6cqw, 22px);
    color: ${C.inkTextMute};
    transition:
      color 0.2s ease,
      transform 0.4s ease;
  }
  .system-icon .material-symbols-outlined {
    font-size: clamp(0.85rem, 1.4cqw, 1.05rem);
  }

  &:hover {
    color: ${C.inkText};
    background: ${C.snowSoft};
    border-color: ${C.iceMid};
    transform: translateX(6px);
    box-shadow: 0 2px 6px ${C.snowShadow};

    .system-icon {
      color: ${C.iceDeep};
      transform: rotate(45deg);
    }
  }

  &:active {
    transform: translateX(3px) scale(0.99);
  }
`;

const SoonTag = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  color: ${C.goldDeep};
  letter-spacing: 0.22em;
  padding: 3px 7px;
  border: 1px solid ${C.gold};
  border-radius: 2px;
  background: rgba(232, 197, 71, 0.18);
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

/*
 * Pumo is a bust portrait — his feet are cropped well below the
 * BottomHud line, so any "ground lighting" reads as warmth glowing
 * in empty space (no floor visible to be lit).
 *
 * Instead, the only ambient lighting we add is a single soft halo
 * centered behind his head/shoulders — like a paper lantern in the
 * ante-room. It's positioned relative to Pumo's actual visible
 * center (which sits well right of the column's right edge because
 * the sprite extends past it), not to the column itself.
 */
const PumoHalo = styled.div`
  position: absolute;
  /*
   * Pumo extends ~32–90px past the right edge of RightColumn, and
   * his visible head sits in the upper-right of his bounding box.
   * Anchor the halo to his actual head position so it doesn't read
   * as biased to the left.
   *
   * On the snow theme the warm cream-and-gold halo (which lifted
   * Pumo off the dark sumi-ink ground) becomes a faint cool ICY
   * glow — like the ambient sky-light scattering off a snowfield
   * behind him. Warm halo + bright snow bg muddied into a beige
   * smear, so we replaced it with cool tones only.
   */
  right: clamp(-40px, -2cqw, 10px);
  top: clamp(40px, 8cqh, 90px);
  width: clamp(320px, 38cqw, 440px);
  height: clamp(320px, 38cqw, 440px);
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    circle at center,
    rgba(168, 224, 255, 0.32) 0%,
    rgba(126, 203, 240, 0.18) 35%,
    rgba(35, 70, 110, 0.08) 65%,
    transparent 80%
  );
  filter: blur(28px);
  opacity: 0;
  animation: ${fadeIn} 1.2s ease-out 0.45s forwards;
`;

/*
 * Pumo wrapper handles the on-load fade-up (opacity + translateY), and
 * the inner <img> handles the infinite breathing scale. They MUST be
 * split across two elements — running both animations on the same
 * element causes a visible stutter on page load because CSS animations
 * don't blend on a shared `transform` property; the breathing scale and
 * the fade-up translateY end up fighting and the image jumps when the
 * fade-up completes.
 */
const PumoHeroWrapper = styled.div`
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
  /* Hint the compositor so the fade-up runs on the GPU without flicker */
  will-change: opacity, transform;
  animation: ${fadeUp} 0.8s ease-out 0.3s backwards;
`;

const PumoHero = styled.img`
  display: block;
  height: 100%;
  width: auto;
  /*
   * Anchor the breathing scale to his feet so his planted base stays put
   * and only the chest/head subtly rise on the inhale.
   */
  transform-origin: 50% 100%;
  /*
   * Pumo grounding on snow: a soft COOL contact shadow directly
   * under him (replaces the previous near-black drop, which read
   * as a hard cutout against the snow field) plus a thin ice-blue
   * ambient halo. He keeps his natural color — no brightness
   * pull — because the snow background means we want him to
   * sit forward, not be pulled back into atmosphere.
   */
  filter: saturate(1.02) brightness(1)
    drop-shadow(0 18px 16px rgba(35, 70, 110, 0.32))
    drop-shadow(0 0 24px rgba(126, 203, 240, 0.18));
  will-change: transform;
  animation: ${pumoBreathe} 3s ease-in-out infinite;
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
  /*
   * Hybrid printed-banzuke panel: dark sumi header band on top,
   * crisp white body for the stats. Padding is delegated to
   * Header / StatList so the dark band hugs the rounded card
   * edges (overflow:hidden clips the band corners). The gold
   * left rule still runs the full height as the "frame".
   */
  background: ${C.snowPanel};
  border: 1px solid ${C.snowBorder};
  border-left: 3px solid ${C.gold};
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 6px 14px ${C.snowShadow};
  opacity: 0;
  /*
   * Slides in from the right edge — this card lives in the upper-right
   * corner so reading "it came from off-screen right" is more honest
   * than a generic fade-up.
   */
  animation: ${slideInRight} 0.55s ease-out 0.55s forwards;
`;

const BanzukeHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: clamp(8px, 1.1cqh, 11px) clamp(14px, 1.8cqw, 20px);
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
`;

const BanzukeTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1cqw, 0.75rem);
  color: ${C.gold};
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const BanzukeDate = styled.div`
  font-family: "Space Grotesk", sans-serif;
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
  padding: clamp(11px, 1.5cqh, 15px) clamp(14px, 1.8cqw, 20px);
`;

const StatRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`;

const StatLabel = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.8cqw, 0.62rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const StatValue = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.75rem, 1.25cqw, 0.95rem);
  color: ${(p) => (p.$muted ? C.inkTextMute : C.inkText)};
  letter-spacing: 0.06em;

  ${(p) =>
    p.$accent &&
    css`
      color: ${C.vermillion};
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
  background: ${C.vermillion};
  border: 2px solid ${C.vermillionDeep};
  border-radius: 2px;
  box-shadow: 0 8px 22px rgba(138, 31, 18, 0.4);
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.9cqw, 0.72rem);
  color: ${C.snowSoft};
  letter-spacing: 0.14em;
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
  /*
   * Sumi-ink anchor band. The all-snow main menu had nowhere for the
   * eye to rest — adding this dark band at the bottom gives the screen
   * a real broadcast frame again. Cream washi hairline along the top
   * sells it as a printed bunting strip, not a flat dark slab.
   */
  background: ${C.sumi};
  border-top: 1px solid ${C.sumiBorder};
  box-shadow: 0 -3px 10px ${C.sumiShadow};
  opacity: 0;
  /*
   * Wipes up from its own bottom edge rather than a generic fade —
   * the broadcast strip should read like it's being inserted along the
   * bottom of the frame, not floating in.
   */
  animation: ${clipRevealUp} 0.55s ease-out 0.6s forwards;
  min-height: clamp(28px, 3.6cqh, 40px);
`;

/* Fixed-width status block on the left edge of the bottom bar.
 * Slightly lighter (sumiSoft) so it reads as a separate plate-on-plate
 * within the dark HUD, kept distinct by the vermillion right rule. */
const StatusBlock = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.5cqw, 18px);
  padding: 0 clamp(16px, 2cqw, 26px);
  background: ${C.sumiSoft};
  border-right: 2px solid ${C.vermillion};
  flex-shrink: 0;
`;

const StatusDivider = styled.span`
  width: 1px;
  height: 14px;
  background: ${C.creamFaint};
`;

const Ticker = styled.div`
  position: relative;
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  /*
   * Sumi-toned ticker channel matching the bottom HUD body. Single
   * pixel vermillion top accent reads as the bunting hairline that
   * runs across both StatusBlock and Ticker, so the whole bar feels
   * like one printed strip. Edge fades use the sumi panel color so
   * scrolling text appears to slide IN and OUT of the bunting rather
   * than popping at the boundary.
   */
  background: ${C.sumi};
  box-shadow: inset 0 2px 0 ${C.vermillion};

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 60px;
    background: linear-gradient(90deg, ${C.sumi}, transparent);
    z-index: 2;
    pointer-events: none;
  }
  &::after {
    content: "";
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 60px;
    background: linear-gradient(270deg, ${C.sumi}, transparent);
    z-index: 2;
    pointer-events: none;
  }
`;

const TickerTrack = styled.div`
  display: inline-flex;
  white-space: nowrap;
  animation: ${tickerScroll} 45s linear infinite;
  font-family: "Space Grotesk", sans-serif;
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
  padding: 0 18px;

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

/*
 * Separator diamond between announcements. Lives as its own element
 * (rather than ::after on TickerItem) so it gets equal padding on
 * both sides — visually centered in the gap between two items
 * instead of glued to the trailing edge of one.
 */
const TickerSeparator = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  color: ${C.vermillion};
  font-size: 0.55em;
  line-height: 1;
`;

// ============================================
// PRELOAD ASSETS
// ============================================

const preGameImages = [lobbyBackground, pumo, mainMenuBackground];

/*
 * Ticker copy lives here so the marquee can be a clean .map and the
 * separator can be interspersed (rather than baked into each item via
 * ::after, which makes the diamond hug the trailing item instead of
 * sitting centered between two items).
 */
const TICKER_ITEMS = [
  { label: "UPDATE 0.1", text: "Push & slap your way to glory in the dohyo" },
  { label: "NOW LIVE", text: "Worldwide ranked matchmaking is open" },
  {
    label: "HATSU SEASON",
    text: "Earn the Yokozuna title before the tournament closes",
  },
  {
    label: "DEV NOTE",
    text: "Steam release coming — wishlist now to support the dohyo",
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

const MainMenu = ({
  rooms,
  setRooms,
  currentPage,
  setCurrentPage,
  localId,
  connectionError,
}) => {
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
                <span>Pumo</span> <span>Pumo</span>
                <span className="bang">!</span>
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
              Pumo hero — the brand. A single soft cream halo sits
              behind his head/shoulders to lift him off the bg
              (paper lantern in the ante-room). No ground lighting:
              his feet are cropped below the BottomHud, so there is
              no visible floor to light.
            */}
            <PumoHalo aria-hidden />
            <PumoHeroWrapper>
              <PumoHero src={pumoMainMenu} alt="Pumo" />
            </PumoHeroWrapper>
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
              {[0, 1].map((dupe) => (
                <span
                  key={dupe}
                  style={{ display: "inline-flex", alignItems: "center" }}
                >
                  {TICKER_ITEMS.map((item, idx) => (
                    <Fragment key={idx}>
                      <TickerItem>
                        <strong>{item.label}</strong>
                        <em>{item.text}</em>
                      </TickerItem>
                      <TickerSeparator aria-hidden>◆</TickerSeparator>
                    </Fragment>
                  ))}
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
