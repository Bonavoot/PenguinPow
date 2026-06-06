import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

import pumo from "../assets/pumo-idle.png";
import {
  SPRITE_BASE_COLOR,
  recolorImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  hexToRgb,
} from "../utils/SpriteRecolorizer";
import {
  C,
  broadcastSlideDown,
  broadcastSlideDownRight,
  clipRevealUp,
  clipRevealLeft,
  clipRevealRight,
  stampImpression,
} from "./menuTheme";

/*
 * PreMatchScreen — printed banzuke program inserted into the broadcast.
 *
 * THE REWRITE (vs. the previous "broadcast glass over live dohyo" pass):
 *   The previous pass was structurally good but textured wrong. It
 *   leaned on dark sumi-glass panels (rgba(7,6,10,0.72) +
 *   backdrop-filter: blur(6-8px) + cream hairline borders) — which
 *   is the same recipe as every templated AI broadcast overlay on
 *   the internet. Three problems with that:
 *
 *     1. AI TELL. Glassmorphism + semi-transparent dark + cream
 *        hairline border is the single most over-used UI pattern
 *        in current AI-generated UI. The PRE-MATCH should not be
 *        the place the game accidentally announces "this surface
 *        was generated".
 *     2. PALETTE DRIFT. The lobby, customize, rooms screens all
 *        use a printed-paper world: C.cream washi, vermillion top
 *        and bottom rules, faint warm grain, gold rank accents,
 *        hand-stamped feel. The prematch sat over that with a
 *        completely different surface (dark glass), making it
 *        feel like a second app spliced on at game-start.
 *     3. ACTUAL BUG. Translucent panels let the not-yet-recolored
 *        player sprites bleed through during the brief window
 *        between PreMatchScreen mount and the SpriteRecolorizer
 *        finishing — you saw the default blue/grey penguins under
 *        the cards before the picked colors loaded.
 *
 *   This pass keeps the layout (top broadcast chip, hanko stamp,
 *   two side wrestler cards, lower-third matchup card, loading
 *   bar) but flips the entire surface treatment to match the rest
 *   of the game's printed-program world:
 *
 *     - Solid OPAQUE cream washi paper (no backdrop-filter, no
 *       see-through). Each panel reads as a printed card pinned
 *       into the broadcast frame, not a glass overlay.
 *     - Vermillion top + bottom rules on chrome, vermillion
 *       inner-edge accent on each wrestler card (printed-program
 *       gutter facing the dohyo).
 *     - Sumi-ink kanji watermarks on cream (was cream on dark).
 *     - Gold rank plaques on cream (was gold-trimmed dark glass).
 *     - Asymmetric vermillion ink-bleed at each card's OUTER top
 *       corner — not mirrored. Two cards stamped independently.
 *     - Vermillion ON-AIR tally for LIVE (cream-on-vermillion;
 *       reads as a real studio tally light, not a button).
 *     - Faint warm paper grain on every cream surface, same as
 *       the lobby's MatchCardBar / NamePlate.
 *
 *   The center column stays open so the gyoji + dohyo + crowd
 *   read through unchanged — the gyoji standing between the two
 *   cream wrestler cards still does the visual "VS" work, exactly
 *   as before. The opaque side cards cover the ~25%/~75% screen
 *   positions where the live player sprites stand, killing the
 *   recolor bleed-through. Belt-and-suspenders: Game.jsx also
 *   adds `is-prematch-hidden` to the .ui layer (the GameFighter
 *   sprites only) while the prematch is up, so even the corners
 *   of the cards / fade-in window can't expose un-recolored
 *   penguins.
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
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(238, 81, 65, 0.55); }
  60%      { opacity: 0.85; box-shadow: 0 0 0 6px rgba(238, 81, 65, 0); }
`;

/* Arcade-style marching stripes on the load fill — reads as “tape
   winding / attract mode” without glow or floating particles. */
const loadingStripeMarch = keyframes`
  from { background-position: 0 0; }
  to   { background-position: 16px 0; }
`;

/* Must keep translateX(-50%) in the keyframes: if we animate a generic
   fadeUp’s transform here, it replaces `left:50%` centering and the bar
   sits wrong until the animation ends. */
const fadeUpCentered = keyframes`
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;

// ============================================
// SCREEN BASE
// ============================================

/*
 * Faster fade-in than the previous 0.3s. The old fade was visible
 * enough that you'd see the not-yet-recolored player sprites
 * underneath even before the panels finished animating in. With
 * opaque cream panels + .ui hidden via App.css, this fade is
 * cosmetic — but keeping it short means the prematch lands fast.
 */
const ScreenContainer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10000;
  animation: ${fadeIn} 0.18s ease-out;
  overflow: hidden;
  font-family: "Space Grotesk", sans-serif;
  pointer-events: auto;
`;

/*
 * Note on a previously-removed element:
 *   This file used to have a `PrintRule` styled-div pinned to the
 *   top and bottom edges of the screen — a 4px solid vermillion
 *   bar at z-index 35. It was meant as a "printing-press
 *   registration mark" anchoring the whole frame, but combined
 *   with the wrestler cards' vermillion accents, the LowerThird's
 *   vermillion top + bottom rules, the hanko, and the LIVE tally,
 *   it pushed the total vermillion count past where the design
 *   could carry it. The screen edges read as "outlined in red"
 *   instead of "printed program with red accents". Removed.
 *   Coverage at the screen edges is now carried by the cream
 *   cards (BroadcastBar at top, LowerThird at bottom) and the
 *   warm shadows under each, which is sufficient grounding.
 */

/*
 * Top-most paper-grain wash — sits above every other layer so the
 * cream panels AND the visible slivers of the live arena (center
 * column, top corners, bottom corners) all sit under the same
 * paper texture. Warm-shifted to match cream washi. Mix-blend
 * overlay lets it interact rather than sitting flat on top.
 *
 * Real photographed/printed material always carries some grain.
 * Adding it uniformly across the screen is the single highest-
 * leverage move against the "AI rendered this fresh on a GPU"
 * read — it gives the whole frame a physical surface.
 */
const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 90;
  opacity: 0.3;
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
// TOP BROADCAST CHIP — printed-program micro-card
// ============================================

/*
 * Small cream washi chip pinned at top-center. Same surface
 * formula as the lobby's MatchCardBar: cream fill, vermillion
 * top + bottom rules, faint warm grain, soft warm shadow. At
 * chip scale, reads like a printed program slug ("VER. HATSU |
 * Day 01") clipped into the broadcast feed.
 *
 * The previous rgba(7,6,10,0.72) + backdrop-filter blur(6px)
 * version was the single most "templated AI" element on the
 * old screen — exactly the recipe you see in every generated
 * dashboard hero. This is the opposite of that: a flat,
 * confidently colored printed card.
 */
const BroadcastBar = styled.div`
  position: absolute;
  top: clamp(16px, 2.4cqh, 26px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  padding: clamp(5px, 0.7cqh, 8px) clamp(16px, 2.2cqw, 26px);
  background: ${C.cream};
  border: 1px solid rgba(60, 40, 20, 0.22);
  border-top: 2px solid ${C.vermillion};
  border-bottom: 2px solid ${C.vermillion};
  box-shadow: 0 3px 10px rgba(50, 30, 10, 0.22);
  z-index: 40;
  will-change: transform, opacity;
  animation: ${broadcastSlideDown} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1)
    0.05s backwards;

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

const BroadcastChip = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.72cqw, 0.58rem);
  color: ${(p) => (p.$accent ? C.vermillionDeep : C.inkTextMute)};
  letter-spacing: 0.24em;
  text-transform: uppercase;
  white-space: nowrap;

  strong {
    color: ${C.inkText};
    font-weight: 700;
    letter-spacing: 0.06em;
  }
`;

const BroadcastDivider = styled.span`
  position: relative;
  width: 1px;
  height: 11px;
  background: rgba(60, 40, 20, 0.22);
`;

// ============================================
// LIVE INDICATOR — vermillion ON-AIR tally
// ============================================

/*
 * Inverted from the cream BroadcastBar next to it: solid
 * vermillion fill, cream text. Reads as a real broadcast tally
 * light rather than a "danger" button. The 2px vermillionDeep
 * inner border gives it the slight "bezel" feel of a physical
 * tally lamp.
 */
const LiveIndicator = styled.div`
  position: absolute;
  top: clamp(16px, 2.4cqh, 26px);
  right: clamp(20px, 2.6cqw, 36px);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: clamp(5px, 0.7cqh, 8px) clamp(11px, 1.5cqw, 16px);
  background: ${C.vermillion};
  border: 2px solid ${C.vermillionDeep};
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 0.95cqw, 0.78rem);
  color: ${C.cream};
  letter-spacing: 0.3em;
  text-transform: uppercase;
  z-index: 40;
  box-shadow: 0 3px 10px rgba(70, 18, 8, 0.32);
  text-shadow: 0 1px 0 rgba(70, 18, 8, 0.5);
  will-change: transform, opacity;
  animation: ${broadcastSlideDownRight} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1)
    0.05s backwards;
`;

const LiveDot = styled.span`
  width: 8px;
  height: 8px;
  background: ${C.cream};
  animation: ${liveRedPulse} 1.6s ease-out infinite;
`;

// ============================================
// HANKO STAMP — vermillion seal pressed into cream
// ============================================

/*
 * Almost unchanged from before — this element was already on the
 * right track (vermillion stamp + 取組 kanji + slight rotation +
 * stampImpression keyframe). Tweaks here are narrow:
 *   - Warm-shifted box shadow (rgba(70,18,8,*) instead of
 *     rgba(0,0,0,*)) so the drop matches the cream-paper world.
 *   - The corner ink-bleed got a second satellite blob via
 *     box-shadow, so it reads as actual ink pulling away from
 *     the stamp's edge instead of a single perfectly-formed
 *     decorative dot.
 */
const HankoStamp = styled.div`
  position: absolute;
  top: clamp(58px, 7.6cqh, 96px);
  left: 50%;
  transform: translateX(-50%) rotate(-2deg);
  width: clamp(58px, 6.8cqw, 92px);
  height: clamp(58px, 6.8cqw, 92px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 2px 4px;
  background: ${C.vermillion};
  border: 1.5px solid ${C.vermillionDeep};
  box-shadow:
    0 8px 18px rgba(70, 18, 8, 0.45),
    inset 0 0 0 2px rgba(245, 236, 217, 0.12);
  z-index: 25;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
  animation: ${stampImpression} 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)
    0.35s backwards;

  &::after {
    content: "";
    position: absolute;
    top: -3px;
    right: -3px;
    width: 5px;
    height: 5px;
    background: ${C.vermillion};
    transform: rotate(45deg);
    opacity: 0.75;
    box-shadow: -2px 7px 0 -1px rgba(216, 59, 39, 0.4);
  }
`;

const HankoKanji = styled.div`
  font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
  font-weight: 900;
  font-size: clamp(15px, 1.8cqw, 23px);
  color: ${C.cream};
  line-height: 1;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 0 rgba(70, 18, 8, 0.5);
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
 * Wrestler card — printed banzuke fighter card pinned beside the
 * dohyo. Two earlier moves on this element have been pulled back
 * in this pass:
 *
 *   1. The mini dohyo-ring outline behind the wrestler (the
 *      sumi-ink ellipse at the card's lower ~35%) is REMOVED. It
 *      was meant to read as "the wrestler is standing in a ring",
 *      but at this scale, against the wrestler sprite that
 *      already extends past the card's bottom edge, it just
 *      looked like a stray oval drawn behind the penguin. Not a
 *      "character" detail; it didn't add what it was supposed to.
 *   2. The mawashi-color inner-edge accent rule (was a 5px solid
 *      band on the side facing the dohyo) is REMOVED. With the
 *      player's mawashi color already announced strongly on the
 *      LowerThird PlayerSlot (top border + thicker bottom sash),
 *      a third loud color band on the wrestler card was
 *      redundant — and it was visually competing with the
 *      wrestler sprite and the kanji watermark inside the same
 *      card. The card no longer needs to fight for color
 *      identity; the lower-third does that job cleanly.
 *
 * What's left is a deliberately quiet card:
 *   - Solid C.cream washi paper (the bug-fix opacity from the
 *     previous pass — covers the un-recolored player sprite
 *     position behind it).
 *   - A soft radial wash of the player's mawashi color centered
 *     on the wrestler (alpha ~0.18). This is the ONLY card-level
 *     color signature now — it's subtle by design, and is the
 *     single hook that future "custom card background" work will
 *     plug into via the $washColor prop.
 *   - 1px warm-brown paper edge on all sides (no inner-edge
 *     accent — symmetric paper edge).
 *   - Kanji watermark + paper grain layered behind.
 *   - Two-layer warm drop shadow grounding the card on the live
 *     arena.
 *
 * `$washColor` stays as a prop; `$accentColor` is no longer
 * consumed here (the prop wiring is dropped in the JSX).
 */
const WrestlerPanel = styled.div`
  position: relative;
  align-self: stretch;
  ${(p) => (p.$side === "left" ? "justify-self: end;" : "justify-self: start;")}
  width: 100%;
  max-width: clamp(280px, 32cqw, 420px);
  overflow: hidden;
  background:
    radial-gradient(
      ellipse 75% 55% at 50% 65%,
      ${(p) => p.$washColor} 0%,
      transparent 70%
    ),
    ${C.cream};
  border: 1px solid rgba(60, 40, 20, 0.22);
  box-shadow:
    0 3px 10px rgba(50, 30, 10, 0.22),
    0 14px 28px rgba(50, 30, 10, 0.3);
  will-change: transform, opacity;
  animation: ${(p) => (p.$side === "left" ? clipRevealLeft : clipRevealRight)}
    0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s backwards;

  /* Paper grain — same formula as BroadcastBar + LowerThird so the
     three cream surfaces read as cuts of the same washi sheet. */
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
      ),
      repeating-linear-gradient(
        90deg,
        rgba(60, 40, 20, 0.025) 0,
        transparent 1px,
        transparent 4px
      );
    pointer-events: none;
    z-index: 2;
  }
`;

/*
 * Big sumi-ink 東 / 西 watermark behind the wrestler. On cream
 * paper now, so the kanji is rendered in low-opacity warm dark
 * ink (rgba(20,12,8,0.10)) instead of low-opacity cream-on-dark.
 * Reads as real brushwork seeping through the back of a printed
 * page rather than a colored decal.
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
  color: rgba(20, 12, 8, 0.09);
  pointer-events: none;
  user-select: none;
  z-index: 1;
  ${(p) =>
    p.$side === "left"
      ? "transform: translateX(-6%) translateY(-2%);"
      : "transform: translateX(6%) translateY(-2%);"}
`;

/*
 * East / West side tag — small Bungee label with a vermillion
 * kanji glyph. Kanji color flipped to vermillion (was cream) to
 * give the corner a small print-program color hit, and to match
 * the vermillion accent rule on the card's inner edge.
 */
const SideTag = styled.div`
  position: absolute;
  top: clamp(10px, 1.4cqh, 16px);
  ${(p) =>
    p.$side === "left"
      ? "left: clamp(12px, 1.4cqw, 18px);"
      : "right: clamp(12px, 1.4cqw, 18px);"}
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  z-index: 5;
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.85cqw, 0.65rem);
  color: ${C.inkTextSoft};
  letter-spacing: 0.32em;
  text-transform: uppercase;

  span.kanji {
    font-family: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
    font-weight: 700;
    color: ${C.vermillion};
    letter-spacing: 0;
    font-size: 1.4em;
  }
`;

/*
 * Rank plaque — must match the in-game `RankPlaque` in
 * UiPlayerInfo.jsx so a player who sees "JONOKUCHI" on the
 * pre-match screen sees the SAME plaque sitting on the HUD when
 * the bout starts. Continuity > local design optimization here.
 *
 * The in-game design is:
 *   - Layered dark-navy sumi-ink gradient base (nearly black,
 *     not pure black — sits warmer/cooler than the surrounding
 *     scene)
 *   - Two repeating-linear-gradient washes for vertical washi
 *     paper-fibre grain + horizontal weave (very subtle cream
 *     fibres at <2% alpha — adds physical texture without being
 *     visible as a pattern)
 *   - 1px cream-faint border + inset top highlight + inset bottom
 *     shadow (the "pressed plate" feel)
 *   - Bungee text in #ffe56c (warm yellow-gold) with stacked
 *     gold-glow text-shadow + dark drop, reading as gold leaf
 *     glowing under spotlight on a lacquered ink plate
 *
 * Adaptations for the pre-match context:
 *   - Same exact background, border, and shadow stack as in-game.
 *   - Slightly smaller font cap (1.2cqw → 14px) so the plaque
 *     fits cleanly inside the wrestler card corner without
 *     fighting the SideTag for space — the in-game version sits
 *     on the HUD with more horizontal room.
 *   - The optional rank number (#1, #2, etc.) keeps its diamond
 *     separator, with the diamond now glowing gold to match the
 *     RankText treatment.
 */
const RankPlaque = styled.div`
  position: absolute;
  top: clamp(10px, 1.4cqh, 16px);
  ${(p) =>
    p.$side === "left"
      ? "right: clamp(8px, 1cqw, 14px);"
      : "left: clamp(8px, 1cqw, 14px);"}
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.5cqw, 8px);
  padding: clamp(4px, 0.55cqh, 8px) clamp(10px, 1.3cqw, 18px);
  z-index: 6;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 2px,
      rgba(245, 236, 217, 0.018) 2px,
      rgba(245, 236, 217, 0.018) 3px
    ),
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

/* MUST match `RankText` in `UiPlayerInfo.jsx`. Both surfaces are the
 * same identity tag for the same wrestler — they need to render in the
 * same color family, at the same scale, with the same glow weight. See
 * the long comment on the in-game RankText for why the gold was pulled
 * off the previous candy-warm #ffe56c onto the canonical saffron
 * `C.gold` (#e8c547) and the halo alphas were softened. Keep these two
 * blocks in lockstep when you tune either. */
const RankText = styled.span`
  font-family: "Bungee", cursive;
  font-size: clamp(10px, 1.2cqw, 14px);
  color: ${C.gold};
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 1;
  text-shadow:
    0 0 8px rgba(232, 197, 71, 0.35),
    0 0 3px rgba(232, 197, 71, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
`;

const RankDiamond = styled.span`
  width: 4px;
  height: 4px;
  background: ${C.gold};
  transform: rotate(45deg);
  flex-shrink: 0;
  box-shadow: 0 0 3px rgba(232, 197, 71, 0.4);
`;

/*
 * Portrait zone — bottom-anchored so the sprite's feet stay clipped
 * by the card edge even when scaled up. The shorter pumo-idle canvas
 * (more transparent padding above the head) left the old top-aligned
 * 100%-height layout looking sunken; oversizing + flex-end fills the
 * card without losing the "cut off at the belt" look.
 */
const WrestlerImageWrap = styled.div`
  position: absolute;
  top: clamp(22px, 2.8cqh, 38px);
  left: 0;
  right: 0;
  bottom: -28%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: clamp(8px, 1.8cqh, 20px);
  z-index: 4;
`;

const WrestlerImage = styled.img`
  width: auto;
  height: 138%;
  max-width: 118%;
  object-fit: contain;
  object-position: center bottom;
  transform-origin: center bottom;
  transform: ${(p) =>
    p.$flip
      ? "translateY(-5%) scaleX(1)"
      : "translateY(-5%) scaleX(-1)"};
  /* Warm contact shadow (was generic cool black) — keeps the
     penguin grounded on the cream paper instead of looking
     pasted-on from a different lighting environment. */
  filter: drop-shadow(0 12px 12px rgba(50, 30, 10, 0.42));
  opacity: ${(p) => (p.$ready ? 1 : 0)};
  transition: opacity 0.25s ease-out;
`;

// ============================================
// LOWER-THIRD MATCHUP CARD
// ============================================

/*
 * Broadcast lower-third — flipped from cream washi to dark sumi
 * chrome. Previous pass had this as a third large cream slab
 * stacked under the two cream wrestler cards, which was the
 * single biggest "too much tan, reads as cheap" contributor on
 * the screen. Real broadcast graphics (and every reference
 * fighting game lower-third — SF6, Tekken 8, KOF) use a dark
 * chyron under bright portraits for two reasons:
 *
 *   1. Visual hierarchy. Top half = printed banzuke cards.
 *      Bottom half = broadcast chrome. Two surface tones doing
 *      two jobs, instead of one tone trying to do both.
 *   2. Continuity into the live HUD. The in-game bottom HUD bar
 *      is already C.sumi — when this LowerThird transitions out
 *      and the live HUD takes its place, the dark band stays
 *      where the dark band was. Cohesive frame.
 *
 * Surface choice: C.sumi (the canonical "dark structural
 * chrome" token in menuTheme). Same color family as the rank
 * plaques sitting on the wrestler cards above, so the plaques
 * now read as little pressed plates from the same dark family
 * as the band underneath them, instead of orphaned dark spots
 * floating on cream.
 *
 * Removed:
 *   - The warm paper-grain ::before. Paper grain belongs on the
 *     cream washi cards; the dark sumi band is a different
 *     surface metaphor (lacquered chrome / broadcast plate),
 *     and faking paper texture on it was the templated-AI move.
 *
 * Border + shadow swapped to the cool sumi family so the band
 * sits in the same lighting environment as the rank plaques and
 * the in-game HUD chrome — no warm-brown spillover from the
 * cream-paper world above.
 */
const LowerThird = styled.div`
  position: absolute;
  left: clamp(40px, 8cqw, 140px);
  right: clamp(40px, 8cqw, 140px);
  bottom: clamp(48px, 7cqh, 88px);
  display: grid;
  grid-template-columns: 1fr clamp(120px, 14cqw, 200px) 1fr;
  align-items: stretch;
  background: ${C.sumi};
  border: 1px solid ${C.sumiBorder};
  box-shadow:
    0 -4px 14px rgba(0, 0, 0, 0.35),
    0 14px 28px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(245, 236, 217, 0.06);
  will-change: transform, opacity;
  animation: ${clipRevealUp} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.4s
    backwards;
`;

/*
 * Each player slot now carries the mawashi color on BOTH its top
 * and bottom edges (top via border-top, bottom via the thicker
 * MawashiSash). The slot reads as a printed page bordered top and
 * bottom in the wrestler's color band, rather than a generic
 * cream cell with a thin colored sliver. Solves the "belt color
 * is barely noticeable" problem head-on: the player color is now
 * an unmissable frame around their info, not a 4px afterthought.
 */
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
  z-index: 2;
  border-top: 3px solid ${(p) => p.$accentColor};
`;

/*
 * Stable / dojo line — small gold caption on the dark band.
 * Color picked to visually rhyme with the gold-leaf rank plaque
 * text on the wrestler cards above (same family, same broadcast
 * "printed metal caption" energy). Vermillion would have been
 * the alternative but vermillion is already carrying the LIVE
 * tally + hanko + WrestlerPanel side-tag kanji — gold gives the
 * bottom band its own quiet accent role instead of piling on more red.
 */
const StableLine = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.5rem, 0.82cqw, 0.66rem);
  color: ${C.gold};
  letter-spacing: 0.26em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
`;

const PlayerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(16px, 2.4cqw, 32px);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.6),
    0 2px 6px rgba(0, 0, 0, 0.35);
`;

const MetaRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-direction: ${(p) => (p.$side === "left" ? "row" : "row-reverse")};
  gap: clamp(8px, 1cqw, 14px);
  margin-top: clamp(2px, 0.3cqh, 4px);
`;

const StyleLabel = styled.span`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.5rem, 0.82cqw, 0.65rem);
  color: ${C.creamMute};
  letter-spacing: 0.28em;
  text-transform: uppercase;
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

  small {
    font-size: 0.7em;
    color: ${C.creamMute};
    letter-spacing: 0.1em;
  }
`;

/*
 * Mawashi sash — substantially beefed up. Was 4-6px which was
 * the user's exact complaint: "the belt color lines are barely
 * even noticeable". Bumping to 10-14px makes the player's actual
 * mawashi color a real horizontal banner along the bottom of
 * each player slot, not an afterthought stripe. Special-pattern
 * mawashi (rainbow / camo / fire / etc.) get the full pattern
 * displayed at this size — they finally have room to read.
 *
 * Inset highlight on top + inset shadow on bottom give the band
 * a slight "raised cloth" feel, like a real fabric sash sitting
 * on top of paper, instead of a flat printed swatch. Subtle but
 * gives it the physicality the rest of the screen has.
 */
const MawashiSash = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: clamp(10px, 1.2cqh, 14px);
  background: ${(p) => p.$gradient || p.$color || C.ice};
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
  z-index: 3;
`;

/*
 * Center pillar — VS CPU / EXHIBITION title block. Slight
 * elevation off the surrounding sumi via C.sumiSoft so it reads
 * as the typographic "spine" between the two player slots —
 * one step lighter than the band but still firmly in the dark
 * chrome family. Thin vertical hairline rules on each side
 * preserve the printed-program column separation, now in the
 * cool sumiBorder family to match the LowerThird's outer edge.
 */
const CenterPillar = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.5cqh, 7px);
  padding: clamp(12px, 1.5cqh, 18px) clamp(8px, 1cqw, 14px);
  background: ${C.sumiSoft};
  border-left: 1px solid ${C.sumiBorder};
  border-right: 1px solid ${C.sumiBorder};
  z-index: 2;
`;

const CenterFormatLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.15cqw, 0.95rem);
  color: ${C.cream};
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.6),
    0 2px 6px rgba(0, 0, 0, 0.35);
`;

const CenterFormatSub = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.46rem, 0.78cqw, 0.6rem);
  color: ${C.creamMute};
  letter-spacing: 0.32em;
  text-transform: uppercase;
`;

const CenterDivider = styled.span`
  width: 32px;
  height: 1px;
  background: ${C.vermillionBright};
  opacity: 0.9;
`;

// ============================================
// LOADING — bottom-center, between LowerThird and bottom rule
// ============================================

/*
 * Coin-op style meter: inset track + sumi bezel + warm gold/amber fill
 * (lacquer / coin-slot read; avoids another ice swatch) with marching
 * pinstripes + cream leading edge. Centering uses fadeUpCentered so
 * transform animation never drops translateX(-50%).
 */
const LoadingContainer = styled.div`
  position: absolute;
  /* Sit in the strip under LowerThird; smaller footprint + lower bottom
     keeps a clear gap above the bezel without overlapping the chyron. */
  bottom: clamp(10px, 1.5cqh, 20px);
  left: 50%;
  transform: translateX(-50%) translateY(0);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.55cqh, 7px);
  z-index: 100;
  animation: ${fadeUpCentered} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.55s
    both;
`;

const LoadingBezel = styled.div`
  position: relative;
  padding: clamp(3px, 0.38cqh, 4px) clamp(4px, 0.5cqw, 5px);
  background: linear-gradient(180deg, ${C.sumiSoft} 0%, ${C.sumi} 100%);
  border: 1px solid ${C.sumiBorder};
  box-shadow:
    0 2px 0 rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(245, 236, 217, 0.07);
`;

const LoadingTrack = styled.div`
  position: relative;
  width: clamp(150px, 18cqw, 240px);
  height: clamp(7px, 0.72cqh, 10px);
  background: linear-gradient(
    180deg,
    #06080c 0%,
    #10141a 42%,
    #0b0e14 100%
  );
  border: 1px solid rgba(0, 0, 0, 0.65);
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.78),
    inset 0 -1px 0 rgba(245, 236, 217, 0.04);
  overflow: hidden;
`;

const LoadingFill = styled.div`
  position: relative;
  height: 100%;
  width: ${(p) => p.$progress}%;
  min-width: ${(p) => (p.$progress > 0.5 ? "3px" : "0")};
  max-width: 100%;
  /* Warm gold — rhymes with rank/stable accents, not another ice field */
  background: linear-gradient(
    180deg,
    #f2d878 0%,
    ${C.gold} 45%,
    ${C.goldDeep} 100%
  );
  transition: width 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  overflow: hidden;

  /* Hard “tape head” line at the advancing edge — not a glow. */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 2px;
    background: ${C.cream};
    opacity: 0.92;
    z-index: 2;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background-image: repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 5px,
      rgba(72, 42, 6, 0.28) 5px,
      rgba(72, 42, 6, 0.28) 7px
    );
    background-size: 16px 100%;
    animation: ${loadingStripeMarch} 0.5s linear infinite;
  }
`;

const LoadingText = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.45rem, 0.78cqw, 0.58rem);
  color: ${C.cream};
  letter-spacing: 0.36em;
  text-transform: uppercase;
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.5);
`;

// ============================================
// HELPERS
// ============================================

/*
 * Special mawashi colors (rainbow, fire, etc.) are NOT hex codes —
 * they're string identifiers that the SpriteRecolorizer maps to
 * per-pixel patterns (see SPECIAL_MAWASHI_GRADIENTS below). Solid
 * accents (the wrestler card inner-edge rule, the PlayerSlot top
 * border, the soft radial wash behind the wrestler) need a real
 * color value to render with, so we pick a representative single
 * hex per pattern. The MawashiSash itself still displays the full
 * gradient, so the special-pattern players don't lose their
 * identity — they just get a coordinated solid accent on the
 * card and slot edges.
 *
 * Picked with the goal of matching the dominant hue of each
 * pattern rather than its brightest highlight, so the accent
 * rules read as "this player's color" at a glance.
 */
const SPECIAL_REPRESENTATIVE_COLORS = {
  rainbow: "#FF6EC7",
  fire: "#FF8C00",
  vaporwave: "#DA70D6",
  camo: "#556B2F",
  galaxy: "#6A0DAD",
  gold: "#D4A520",
};

/*
 * Resolve any mawashi color value (solid hex OR special pattern
 * name) to a single solid hex color suitable for borders and
 * rgba conversion. Future-proof for the planned "customize card
 * background" feature: callers can ignore the special-mawashi
 * handling and just pass a hex of their choice, and the same
 * accent + wash pipeline downstream will Just Work.
 */
const resolveAccentColor = (color) => {
  if (!color) return C.ice;
  return SPECIAL_REPRESENTATIVE_COLORS[color] || color;
};

/*
 * Convert a mawashi color value to an rgba() string at the given
 * alpha, so we can use it inside a multi-stop gradient. CSS
 * doesn't let us "alpha-fy" an arbitrary hex value at runtime, so
 * we go through hexToRgb and reassemble. Falls back to C.ice if
 * the value can't be parsed (defensive — should never trip).
 */
const colorToRgba = (color, alpha) => {
  const hex = resolveAccentColor(color);
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(126, 203, 240, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

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

  // Solid accent colors derived from each player's mawashi. Drive the
  // wrestler card's inner-edge rule, the PlayerSlot top border, and
  // (via colorToRgba) the soft radial wash behind the wrestler. When
  // the user wires up custom card backgrounds later, this is the
  // single hook to override per player.
  const p1Accent = resolveAccentColor(p1MawashiColor);
  const p2Accent = resolveAccentColor(p2MawashiColor);
  const p1Wash = colorToRgba(p1MawashiColor, 0.18);
  const p2Wash = colorToRgba(p2MawashiColor, 0.18);

  return (
    <ScreenContainer>
      <BroadcastBar>
        <BroadcastChip $accent>
          <strong>VER.</strong> HATSU
        </BroadcastChip>
        <BroadcastDivider />
        <BroadcastChip>Day 01</BroadcastChip>
      </BroadcastBar>

      <LiveIndicator>
        <LiveDot />
        Live
      </LiveIndicator>

      {/* Hanko stamp sits high-center, above the gyoji, so it never
          covers the live action. The gyoji standing between the two
          wrestler cards still carries the visual "VS" on his own. */}
      <HankoStamp aria-hidden>
        <HankoKanji>取組</HankoKanji>
        <HankoVs>VS</HankoVs>
      </HankoStamp>

      <Stage>
        {/* LEFT WRESTLER — East / 東 */}
        <WrestlerPanel $side="left" $washColor={p1Wash}>
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
        <WrestlerPanel $side="right" $washColor={p2Wash}>
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
        <PlayerSlot $side="left" $accentColor={p1Accent}>
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

        <PlayerSlot $side="right" $accentColor={p2Accent}>
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
          <LoadingBezel
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(displayProgress)}
            aria-label="Match loading progress"
          >
            <LoadingTrack>
              <LoadingFill $progress={displayProgress} />
            </LoadingTrack>
          </LoadingBezel>
          <LoadingText>Preparing the Dohyo</LoadingText>
        </LoadingContainer>
      )}

      <GrainOverlay />
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
