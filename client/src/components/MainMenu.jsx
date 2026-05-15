import { useState, useEffect, useContext, Fragment } from "react";
import PropTypes from "prop-types";

import Lobby from "./Lobby";
import Rooms from "./Rooms";
import Game from "./Game";
import Settings from "./Settings";
// hello
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
  FONT_BODY,
  FONT_DISPLAY,
  fadeIn,
  fadeUp,
  slideInLeft,
  clipRevealUp,
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

/*
 * Banzuke "pinned poster" entrance — combines the bottom-up rise of
 * clipRevealUp with a STATIC hand-pinned rotation that's preserved
 * through the animation. Can't reuse clipRevealUp directly because
 * its `transform: translateY(...)` would overwrite the rotation
 * during animation and the card would briefly "straighten up" then
 * tilt — visually wrong for a poster that should already be hanging.
 */
const banzukePin = keyframes`
  from {
    opacity: 0;
    transform: translateY(18px) rotate(-1.5deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) rotate(-1.5deg);
  }
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
  filter: saturate(1.04) brightness(1) contrast(1) blur(1.25px);
  animation: ${kenBurns} 22s ease-in-out infinite alternate;
`;

/*
 * Cinematic overlay — re-tuned for the snow theme.
 *
 * On the dark theme this overlay was a left-column DARK readability
 * wash + a dark vignette to pull the eye to the arena entrance. On
 * the snow theme we keep the screen light, but the overlay now reads as
 * cold blue air and snow haze rather than a white paint layer. That keeps
 * the arena color alive while giving the menu side enough calm value for
 * dark type.
 *
 * Layered:
 *   1. Left-column frost veil — cooler and thinner than the previous
 *      white wash, tapering off before it reaches Pumo.
 *   2. Snowdrift at the bottom so the HUD strip still belongs to the
 *      ground plane without bleaching the whole screen.
 *   3. Low-opacity ice/sumi framing to restore depth without returning
 *      to the old dark-theme spotlight.
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
      rgba(203, 219, 231, 0.72) 0%,
      rgba(221, 233, 241, 0.48) 21%,
      rgba(234, 241, 247, 0.16) 37%,
      rgba(234, 241, 247, 0) 49%,
      rgba(234, 241, 247, 0) 100%
    ),
    /* sky-cool top wash, fading to a colder snowdrift at the bottom */
    linear-gradient(
        180deg,
        rgba(126, 203, 240, 0.2) 0%,
        rgba(203, 219, 231, 0.1) 24%,
        transparent 54%,
        rgba(221, 233, 241, 0.58) 100%
      ),
    /* cool corner framing, kept well below dark-theme strength */
    radial-gradient(
        ellipse at 52% 54%,
        transparent 48%,
        rgba(28, 78, 110, 0.1) 78%,
        rgba(23, 26, 32, 0.18) 100%
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
//
// REDESIGN NOTE (steam-ready menu):
//   Each item is bare display type, no chrome. Hierarchy is carried by
//   SCALE (primary ~30% larger), not by boxes/borders/shadows.
//
//   Hover indicator is a vermillion vertical bar that slides in from the
//   left of the row — a JRPG/Hades-style "menu cursor" that visually
//   rhymes with the vertical nobori banners hanging in the background
//   arena art. Deliberately NOT an underline / brush stroke under the
//   text (that read as a generic modern-web animated underline pattern,
//   even with the irregular SVG contour). A left-anchored cursor mark
//   reads as a real game menu, not a webpage.

const MenuList = styled.nav`
  display: flex;
  flex-direction: column;
  /*
   * Generous gap — each row is bare typography, so whitespace is the
   * only thing separating one row from the next. The upper bound is
   * deliberately constrained (16px, not 22px) because the column also
   * has to fit the bottom-left BanzukeCard underneath; pushing gaps
   * too wide here causes the menu to overrun the banzuke at large
   * viewport sizes.
   */
  gap: clamp(11px, 1.7cqh, 16px);
  position: relative;
  /*
   * Push the menu well below the title so the left column reads as
   * "title up top, menu in the middle band, banzuke at the bottom"
   * instead of a top-bunched stack. Capped lower than the gap-driven
   * size would otherwise allow so we don't push the menu DOWN into
   * the banzuke at large viewport sizes.
   */
  margin-top: clamp(38px, 6cqh, 64px);
  max-width: clamp(360px, 42cqw, 520px);
`;

const MenuButton = styled.button`
  position: relative;
  display: inline-flex;
  /*
   * Center-align (was baseline) so the much smaller SoonMark span sits
   * at the OPTICAL center of the Bungee label's cap-height instead of
   * sharing its baseline. With baseline alignment, a 0.4em annotation
   * drops to the bottom of the line and reads as "floating low and to
   * the side"; centering aligns the visual midpoints, which is what
   * an editorial annotation should do.
   */
  align-items: center;
  gap: clamp(8px, 1.1cqw, 14px);
  align-self: flex-start;
  background: none;
  border: none;
  /*
   * Left padding reserves dedicated space for the cursor bar so the
   * text doesn't reflow when the bar appears on hover. The bar lives
   * inside this reserved gutter at left:0.
   */
  padding: clamp(2px, 0.4cqh, 5px) clamp(4px, 0.6cqw, 8px)
    clamp(2px, 0.4cqh, 5px) clamp(16px, 2cqw, 24px);
  margin: 0;
  cursor: ${(p) => (p.$disabled ? "default" : "pointer")};
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) =>
    p.$primary
      ? "clamp(1.5rem, 2.55cqw, 2.05rem)"
      : "clamp(1.05rem, 1.75cqw, 1.45rem)"};
  font-weight: 400;
  /*
   * Near-natural tracking on a display face. Wide 0.18em tracking on
   * uppercase Bungee is a generic-AI-tech-UI tell; tight tracking
   * lets the carved-wood letterforms carry the character.
   */
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: left;
  line-height: 0.95;
  color: ${(p) => (p.$disabled ? C.inkTextFaint : C.inkText)};
  -webkit-font-smoothing: auto;
  transition:
    transform 0.28s cubic-bezier(0.2, 0.85, 0.2, 1),
    color 0.2s ease;
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.55 + p.$index * 0.07}s;

  /*
   * Vermillion cursor bar — the ONE piece of decoration. A short
   * vertical rectangle sized to the cap-height of the row, vermillion
   * fill (sumo ring red / nobori banner red). At rest it lives off
   * to the left at scaleY 0.35 + opacity 0; on hover it slides in to
   * its home position and grows to full height.
   *
   * Visually rhymes with the tall vertical nobori banners in the
   * arena background, so the menu feels rooted in the world rather
   * than wearing a generic UI cursor.
   */
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: ${(p) => (p.$primary ? "4px" : "3px")};
    height: ${(p) => (p.$primary ? "0.62em" : "0.7em")};
    background: ${C.vermillion};
    border-radius: 1px;
    transform: translate(-12px, -50%) scaleY(0.35);
    transform-origin: center;
    opacity: 0;
    transition:
      transform 0.32s cubic-bezier(0.25, 0.85, 0.2, 1),
      opacity 0.22s ease;
    pointer-events: none;
  }

  ${(p) =>
    !p.$disabled &&
    css`
      &:hover {
        color: ${C.vermillionDeep};
        transform: translateX(clamp(6px, 0.9cqw, 12px));
      }
      &:hover::before {
        transform: translate(0, -50%) scaleY(1);
        opacity: 1;
      }
      &:active {
        transform: translateX(clamp(3px, 0.5cqw, 6px)) scale(0.99);
      }
    `}
`;

/*
 * Inline "soon" annotation for menu items that aren't shipping yet.
 *
 * Sits as a small italic lowercase body annotation next to the Bungee
 * label, with a leading em-dash. Vertical alignment is delegated to
 * the parent MenuButton's `align-items: center` so the mark is
 * optically centered against the cap-height of the label — earlier
 * passes used `vertical-align` and `transform: translateY` here
 * directly, which fought the parent's baseline alignment and produced
 * the "floating up high" / "floating down low" inconsistency.
 */
const SoonMark = styled.span`
  display: inline-block;
  font-family: ${FONT_BODY};
  font-style: italic;
  font-weight: 500;
  font-size: 0.42em;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  color: ${C.inkTextMute};
  margin-left: 0.9em;
  /*
   * Tighten the line-height around the small annotation so it
   * doesn't inherit the Bungee row's 0.95 line-height and end up
   * with extra cross-axis whitespace, which would offset the centered
   * alignment by a few pixels.
   */
  line-height: 1;

  &::before {
    content: "— ";
    opacity: 0.55;
    font-style: normal;
    margin-right: 0.05em;
  }
`;

/*
 * Options at the bottom of the menu.
 *
 * Earlier passes treated this as a different visual language (Space
 * Grotesk uppercase + leading hairline tick), which broke the
 * typographic system — the menu list above it was Bungee, then
 * suddenly the system row was a tracked sans, and the leading rule
 * read as a stray hyphen next to the word.
 *
 * This pass keeps Options in the SAME interaction language as the
 * menu items above it (Bungee, same left cursor-bar gutter, same
 * vermillion bar slide-in on hover) so the whole column reads as one
 * consistent menu. It's demoted purely by SCALE and COLOR — much
 * smaller font size and a softer ink tone — not by changing typeface.
 */
const SystemButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  margin-top: clamp(20px, 3cqh, 34px);
  background: none;
  border: none;
  /* Same left gutter as MenuButton so the cursor bars line up vertically */
  padding: clamp(2px, 0.4cqh, 5px) clamp(4px, 0.6cqw, 8px)
    clamp(2px, 0.4cqh, 5px) clamp(16px, 2cqw, 24px);
  margin-left: 0;
  cursor: pointer;
  font-family: ${FONT_DISPLAY};
  font-weight: 400;
  font-size: clamp(0.72rem, 1.18cqw, 0.95rem);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
  line-height: 0.95;
  color: ${C.inkTextSoft};
  -webkit-font-smoothing: auto;
  transition:
    color 0.2s ease,
    transform 0.28s cubic-bezier(0.2, 0.85, 0.2, 1);
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.55 + p.$index * 0.07}s;

  /* Vermillion cursor bar — identical interaction to MenuButton above */
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 3px;
    height: 0.7em;
    background: ${C.vermillion};
    border-radius: 1px;
    transform: translate(-12px, -50%) scaleY(0.35);
    transform-origin: center;
    opacity: 0;
    transition:
      transform 0.32s cubic-bezier(0.25, 0.85, 0.2, 1),
      opacity 0.22s ease;
    pointer-events: none;
  }

  &:hover {
    color: ${C.vermillionDeep};
    transform: translateX(clamp(6px, 0.9cqw, 12px));
  }
  &:hover::before {
    transform: translate(0, -50%) scaleY(1);
    opacity: 1;
  }
  &:active {
    transform: translateX(clamp(3px, 0.5cqw, 6px)) scale(0.99);
  }
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
 * BanzukeCard — washi paper notice pinned to the wall, bottom-LEFT.
 *
 * Earlier passes oscillated between "fully bordered UI card" (which
 * stacked awkwardly against the dark BottomHud and used a different
 * visual language than the menu) and "pure typography" (which just
 * read as more text in the same column as the menu, with no visual
 * differentiation between menu and stats).
 *
 * This pass gives the banzuke its OWN physical identity instead of
 * reusing either UI chrome or the menu's typographic language: it's
 * a small piece of warm cream washi paper that's been pinned to the
 * snowy wall at a slight angle. The metaphor works because:
 *   - The arena background is ALREADY full of hanging printed banners
 *     and noborr — a paper notice belongs to that world.
 *   - Cream + ink is a separate color story from the snow + ink menu,
 *     so the eye stops conflating the two.
 *   - A subtle (-1.5deg) hand-pinned tilt + a layered warm drop
 *     shadow read as "real object lifted off the page", not as a UI
 *     panel. This is the difference between "designed" and
 *     "AI-generated card with rounded corners".
 *   - One vermillion accent (the date, stamped) provides the brand
 *     red without piling on extra decoration.
 *
 * Restraint is doing the work here: NO corner clips, NO tape, NO
 * paper-grain texture overlay, NO border. Just cream surface + tilt +
 * shadow + one stamp of red. Adding any of those would push it from
 * "deliberate paper artifact" to "AI cute UI element".
 */
const BanzukeCard = styled.section`
  position: absolute;
  bottom: clamp(16px, 2.4cqh, 30px);
  /*
   * Slightly more inset than the title rail so the card doesn't
   * appear to "claim" the same left edge as the menu — paper notices
   * don't perfectly align with the masthead, they're tacked up
   * wherever there's wall space.
   */
  left: clamp(34px, 4cqw, 64px);
  z-index: 2;
  width: clamp(210px, 24cqw, 270px);
  background: ${C.cream};
  padding: clamp(11px, 1.6cqh, 16px) clamp(14px, 1.9cqw, 19px)
    clamp(12px, 1.7cqh, 17px);
  display: flex;
  flex-direction: column;
  gap: clamp(7px, 1cqh, 11px);
  /*
   * Three-stop layered drop shadow — tight contact + medium ambient
   * + soft cast. Single shadow looks like a UI bevel; layered shadows
   * with warm undertones read as paper actually lifted off the snow
   * surface. The ~brown tint instead of cool grey matches the warm
   * cream paper rather than fighting it.
   */
  box-shadow:
    0 1px 2px rgba(50, 30, 10, 0.18),
    0 4px 10px rgba(50, 30, 10, 0.14),
    0 14px 28px rgba(50, 30, 10, 0.08);
  opacity: 0;
  animation: ${banzukePin} 0.6s ease-out 0.65s forwards;
`;

const BanzukeHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  /*
   * Hairline rule beneath the title row — the ONE line in the whole
   * card. Warm low-opacity ink (matches the cream paper color
   * family) rather than cool snowBorderSoft, so it reads as faded
   * print on the paper rather than a UI divider laid on top.
   */
  padding-bottom: clamp(5px, 0.8cqh, 8px);
  border-bottom: 1px solid rgba(60, 40, 20, 0.16);
`;

const BanzukeTitle = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.55rem, 0.92cqw, 0.7rem);
  color: ${C.inkText};
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const BanzukeDate = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  /*
   * Vermillion — the single brand-red accent on the cream paper.
   * Reads as a stamped "today's date" mark (a real banzuke has
   * black ink for ranks and a single red stamp for the issuing
   * association seal).
   */
  color: ${C.vermillion};
  letter-spacing: 0.22em;
  text-transform: uppercase;
`;

const StatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 0.6cqh, 7px);
`;

const StatRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`;

const StatLabel = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.46rem, 0.76cqw, 0.58rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.18em;
  text-transform: uppercase;
`;

const StatValue = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.6rem, 1cqw, 0.78rem);
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
        <Snowfall intensity={45} showFrost={false} zIndex={4} />
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
                Play Online
                <SoonMark>Soon</SoonMark>
              </MenuButton>

              <MenuButton
                $index={1}
                onClick={() => {
                  handleDisplayRooms();
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                Custom Match
              </MenuButton>

              <MenuButton
                $index={2}
                onClick={handleVsCPU}
                onMouseEnter={playButtonHoverSound}
              >
                VS CPU
              </MenuButton>

              <MenuButton
                $index={3}
                $disabled
                onMouseEnter={playButtonHoverSound}
              >
                Basho Tournament
                <SoonMark>Soon</SoonMark>
              </MenuButton>

              <MenuButton
                $index={4}
                onClick={() => {
                  playButtonPressSound2();
                  setCurrentPage("customize");
                }}
                onMouseEnter={playButtonHoverSound}
              >
                Customize
              </MenuButton>

              <MenuButton
                $index={5}
                $disabled
                onMouseEnter={playButtonHoverSound}
              >
                Career Stats
                <SoonMark>Soon</SoonMark>
              </MenuButton>

              <SystemButton
                $index={6}
                className="settings-button"
                onClick={() => {
                  handleSettings();
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
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
            either, so it positions against HeroStage. Anchored
            bottom-LEFT, aligned with the title/menu rail, so the left
            column reads as title → menu → banzuke top-to-bottom and
            Pumo gets the entire right column to himself. Values are
            placeholders until the server-side stats endpoints are
            wired up (wrestlersOnline, matchesToday, playerRank).
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
