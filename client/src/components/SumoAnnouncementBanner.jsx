import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { C, FONT_KANJI } from "./menuTheme";

/*
 * SumoAnnouncementBanner — fighting-game impact callout.
 *
 * DESIGN: broadcast "sumi-ink lower-third".
 *   A dark ink slab attached to the frame edge, carrying a big Bungee
 *   headline, a type-color spine, and a large faint kanji print. It fuses two
 *   references: the premium broadcast/esports lower-third (a shaped dark plate
 *   bled to the frame edge with a bold accent bar) and this game's own
 *   sumi/washi/hanko identity (ink slab + stamped calligraphy + the extruded
 *   impact-type recipe RoundResult uses for the kimarite call). The result is
 *   a callout that reads as deliberately designed chrome rather than colored
 *   text floating over the crowd.
 *
 *   Why the previous pass fell short: it was bare colored text + a thin
 *   underline slash with no backing plate, floating at ~38cqh up in the busy
 *   crowd. With nothing to frame it, it read as "text slapped on top", and the
 *   4px slash read as a generic UI divider. The slab fixes both — it gives the
 *   type a plate to sit on (instant contrast + a designed silhouette) and the
 *   thin slash is replaced by a proper type-color spine.
 *
 * SHAPE:
 *   - Anchored to and bled off the triggering player's frame edge (left =
 *     player 1, right = player 2), so the spatial "who did this?" cue is
 *     preserved and the center column of the dohyo stays clear for the fight.
 *   - Sumi ink slab (sumiSoft → sumi → near-black gradient, cool top hairline,
 *     inner vignette). The inner edge — the one facing the ring center — is
 *     sheared into a forward-leaning parallelogram so it reads as a dynamic
 *     name tag, not a flat rectangle. Outer edge stays flush to the frame.
 *   - Type-color spine on the inner edge (the mechanic color + directional
 *     "emitting toward the ring" cue). Replaces the old underline rule.
 *   - Large faint kanji print pressed into the slab behind the headline,
 *     bleeding off the frame edge (banzuke-poster seal vocabulary), clipped to
 *     the slab silhouette. Never covers a glyph of the message.
 *   - Headline: big Bungee in the type color with the extruded 3D-stamp
 *     treatment (offset drop in the type's deep tone + soft ambient) — the
 *     same premium impact-type recipe RoundResult uses.
 *   - Optional subtext (existing `subText` prop; preserved).
 *   - A soft contrast haze seats the whole slab on the crowd (same job the
 *     ContrastHaze in RoundResult does for the center kimarite call).
 *   - Sits in the LOWER THIRD (~57cqh) near the tawara so it reads as part of
 *     the action, not chrome up by the HUD.
 *
 * MOTION — fighting-game impact, not informational fade:
 *   Entrance beats: slab slides in from its frame edge with a tiny overshoot
 *   (~200ms) → kanji presses in like a stamp → headline slams from oversized
 *   with a frame-one hit-flash → spine drops down the inner edge. Hold for the
 *   bulk of the duration prop, then a single ~320ms fade-up exit. Every beat
 *   is one-shot — no infinite loops.
 *
 * COLOR / TYPE MAPPING:
 *   These are the GAME'S canonical action colors, not the
 *   menu palette — punish is purple in the game (always has
 *   been), counterhit is gold, parry is bright blue, etc.
 *   Players associate each color with the action mechanic,
 *   not with a UI palette. The previous rewrite recolored
 *   them into the menu's vermillion/cream world and broke
 *   that association — restored here.
 *
 *     punish        → purple           (the game's signature PUNISH purple)
 *     counterhit    → gold             (SF6 / fighting-game canonical)
 *     counter       → hot red-pink     (the signature counter color)
 *     countergrab   → red              (with purple accent in deep)
 *     parry         → bright blue      (defensive cool)
 *     tech          → light blue       (defensive cool, lighter than parry)
 *     break         → bright green     (success / breakthrough)
 *     perfect       → gold             (premium accent)
 *     default       → cream            (neutral fallback)
 *
 * NOTICEABILITY DESIGN NOTES:
 *   The four moves that buy peripheral noticeability without
 *   needing to dominate the screen:
 *     (a) BIG TYPE — clamp(1.6rem, 3.6cqw, 3rem) is roughly
 *         3-4× the previous pass's text size.
 *     (b) HARD COLOR FILL on the text — saturated type-color
 *         glyphs catch the eye in peripheral vision much
 *         faster than cream-on-stencil.
 *     (c) HARD STENCIL STROKE on those colored glyphs — the
 *         black outline guarantees legibility against any
 *         arena background while preserving the color signal.
 *     (d) DIRECTIONAL MOTION on entrance — slide-from-edge
 *         is what the eye picks up in peripheral first
 *         (motion > color > shape > text in peripheral
 *         vision). Combined with the text scale-slam, the
 *         callout REGISTERS in <300ms even if you're not
 *         looking directly at it.
 */

// ============================================
// COLOR THEMES
// ============================================

const TYPE_COLORS = {
  punish: { color: "#b975ff", deep: "#5a2299" },
  /*
   * counterhit — bumped from the previous muted gold (#ffd54a) to a
   * brighter pop-yellow (#ffe066). The old shade leaned amber and
   * read closer to "warm gold" than to "electric counter-hit
   * yellow"; the bump pushes it firmly into the high-energy SF6 /
   * arcade-fighter "POW!" yellow zone so the call lands with more
   * snap. Deep amber under-stripe is unchanged — it still gives the
   * right grounding contrast on the rule beneath the brighter body.
   */
  counterhit: { color: "#ffe066", deep: "#a07020" },
  counter: { color: "#ff5577", deep: "#a01b3a" },
  countergrab: { color: "#ff4477", deep: "#5e2bb3" },
  /*
   * counterthrow — hot ember orange. The clinch stance-read reward (threw an
   * opponent mid-push, 20 balance drain vs 10). Sits between counterhit's
   * yellow and counter's red so the "you read them" family stays warm while
   * each call stays distinguishable.
   */
  counterthrow: { color: "#ff8a3d", deep: "#a04a10" },
  /*
   * braced — matcha green. Defensive clinch read (plant blunted a throw to a
   * 5-drain chip). Green = "your defense worked", distinct from break's
   * spring green by leaning earthy/warm.
   */
  braced: { color: "#a8e063", deep: "#4a7a1e" },
  /*
   * deepgrip — burnished gold. The clinch's earned-advantage state (throws
   * land earlier, stronger push). Warmer and richer than counterhit's
   * pop-yellow — "you seized something valuable", not "you landed a hit".
   */
  deepgrip: { color: "#ffc247", deep: "#8a5510" },
  parry: { color: "#3ecbff", deep: "#005f80" },
  tech: { color: "#7ed6ff", deep: "#2266aa" },
  break: { color: "#3eea88", deep: "#008844" },
  perfect: { color: "#ffd54a", deep: "#a07020" },
  /*
   * perfectparry — saturated electric cyan, bumped up from the
   * previous #4dd6ff so it doesn't read as the same shade as the
   * grab tech / parry tech blues (which sit around #64c8ff–#7ed6ff).
   * Pulling the red channel down to 0 and the green up to ~210 gives
   * a vivid almost-pure cyan that reads as "premium electric blue"
   * rather than "another washed cyan in the cyan family".
   *
   * The "premium" treatment now lives in two places, not one:
   *   1. textAccent (yellow #ffd84a) — used by MainText as a single
   *      hard offset under-shelf below the cyan glyphs, replacing
   *      the dark drop + halo. No fuzzy glow, no stacked extrusion
   *      layers — just one solid offset of the accent color, the
   *      simplest version of the "3D effect text" feel without the
   *      heavy comic-book layering that didn't land in the previous
   *      pass.
   *   2. accent (white) — used by the Rule as its background, so
   *      the underline is a clean white plate against the cyan text
   *      with the yellow under-shelf above it.
   *
   * Combined read: cyan text on a yellow shelf over a white
   * underline — three distinct callout colors stacked vertically,
   * each doing one job, no glow, no haze.
   *
   *   color:       electric cyan body (matches the in-arena ring blue)
   *   deep:        deeper electric blue for the rule 1px separator
   *   accent:      white — Rule body override
   *   textAccent:  bright yellow — MainText hard offset under-shelf
   */
  perfectparry: {
    color: "#00d4ff",
    deep: "#003a55",
    accent: "#ffffff",
    textAccent: "#ffd84a",
  },
  default: { color: C.cream, deep: C.sumi },
};

const getTheme = (type) => TYPE_COLORS[type] || TYPE_COLORS.default;

/*
 * Kanji seal per type — a small rotated hanko chip that stamps in beside the
 * roman text after the slam. Same seal vocabulary as the GASSED stamp and the
 * RoundResult kimarite chips, so the callouts join the game's existing
 * sumo-calligraphy language instead of being pure western SFX text.
 * Types without a mapping simply render no seal.
 */
const TYPE_KANJI = {
  punish: "罰",
  counterhit: "撃",
  counter: "反",
  countergrab: "掴",
  counterthrow: "投",
  braced: "耐",
  deepgrip: "締",
  parry: "受",
  tech: "技",
  break: "破",
  perfect: "極",
  perfectparry: "極",
};

// ============================================
// SIDE STACK COORDINATION
// ============================================

const activeAnnouncementStacks = {
  left: [],
  right: [],
};

const stackListeners = new Set();
let announcementIdSeed = 0;

const getSideKey = (isLeftSide) => (isLeftSide ? "left" : "right");

const notifyStackListeners = () => {
  stackListeners.forEach((listener) => listener());
};

const getStackSnapshot = (id, sideKey) => {
  const sideStack = activeAnnouncementStacks[sideKey];
  const slotIndex = sideStack.findIndex((entry) => entry.id === id);

  return {
    slotIndex: slotIndex === -1 ? 0 : slotIndex,
  };
};

const removeFromStacks = (id) => {
  activeAnnouncementStacks.left = activeAnnouncementStacks.left.filter(
    (entry) => entry.id !== id,
  );
  activeAnnouncementStacks.right = activeAnnouncementStacks.right.filter(
    (entry) => entry.id !== id,
  );
};

const useAnnouncementStack = (isLeftSide) => {
  const idRef = useRef(null);
  if (idRef.current === null) {
    announcementIdSeed += 1;
    idRef.current = `sumo-announcement-${announcementIdSeed}`;
  }

  const sideKey = getSideKey(isLeftSide);
  const [stackState, setStackState] = useState(() =>
    getStackSnapshot(idRef.current, sideKey),
  );

  useEffect(() => {
    const id = idRef.current;
    removeFromStacks(id);
    activeAnnouncementStacks[sideKey].unshift({
      id,
    });

    const updateStackState = () => {
      setStackState(getStackSnapshot(id, sideKey));
    };

    stackListeners.add(updateStackState);
    notifyStackListeners();

    return () => {
      stackListeners.delete(updateStackState);
      removeFromStacks(id);
      notifyStackListeners();
    };
  }, [sideKey]);

  return stackState;
};

// ============================================
// ANIMATIONS
// ============================================

/*
 * The slab slides in from its anchor (frame) edge and settles with a tiny
 * overshoot — a broadcast lower-third snapping into frame. Stack opacity
 * lives on the outer wrapper so older callouts can tuck upward smoothly when
 * a new one arrives; these keyframes only own the per-banner entrance/exit.
 */
const slabInFromLeft = keyframes`
  0%   { opacity: 0; transform: translateX(-48px); }
  70%  { opacity: 1; transform: translateX(4px); }
  100% { opacity: 1; transform: translateX(0); }
`;

const slabInFromRight = keyframes`
  0%   { opacity: 0; transform: translateX(48px); }
  70%  { opacity: 1; transform: translateX(-4px); }
  100% { opacity: 1; transform: translateX(0); }
`;

const fadeOutUp = keyframes`
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-14px); }
`;

/*
 * Text slam — scale-from-oversized with a frame-one hit flash (brightness +
 * desaturate crush) that snaps to full color as the glyphs settle, plus a
 * letter-spacing lock on landing. The canonical fighting-game "POW!" beat.
 */
const textSlam = keyframes`
  0% {
    opacity: 0;
    transform: skewX(-5deg) scale(1.42);
    filter: brightness(2.4) saturate(0.25);
    letter-spacing: 0.12em;
  }
  38% {
    opacity: 1;
    transform: skewX(-5deg) scale(0.95);
    filter: brightness(1.7) saturate(0.6);
  }
  62% { filter: brightness(1.05); }
  /* Settle slightly BRIGHTER + more saturated than neutral (not back to 1) so
     the type color stays punchy and lifted instead of reading flat — a color
     pop, not a fuzzy glow. This persists because the animation is forwards. */
  100% {
    opacity: 1;
    transform: skewX(-5deg) scale(1);
    filter: brightness(1.1) saturate(1.14);
    letter-spacing: 0.03em;
  }
`;

/*
 * Kanji print — the large calligraphy glyph pressed into the slab like an ink
 * stamp: lands oversized + tilted, settles into its low-opacity resting state
 * a beat BEFORE the roman text so the composition builds back-to-front.
 */
const kanjiPress = keyframes`
  0%   { opacity: 0; transform: scale(1.6) rotate(-10deg); }
  50%  { opacity: 0.34; transform: scale(0.97) rotate(-9deg); }
  100% { opacity: 0.28; transform: scale(1) rotate(-9deg); }
`;

/*
 * Type-color spine drops down the inner edge of the slab — the directional
 * accent that reads as the call "emitting" toward the center of the dohyo.
 */
const spineDrop = keyframes`
  0%   { opacity: 0; transform: skewX(var(--spine-skew)) scaleY(0); }
  100% { opacity: 1; transform: skewX(var(--spine-skew)) scaleY(1); }
`;

const subTextRise = keyframes`
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
`;

// ============================================
// LAYOUT
// ============================================

/*
 * Slab geometry, shared by every side/type. Kept as tokens so the clip-path
 * shape, the spine, and the kanji clip all reference the same numbers.
 */
const SLAB_SLANT = "clamp(6px, 0.8cqw, 11px)"; // inner-edge parallelogram lean
const SLAB_RADIUS = "clamp(3px, 0.45cqw, 6px)";

const BannerWrapper = styled.div`
  position: absolute;
  /* Lower third of the frame, near the tawara / front row rather than up in
     the crowd by the HUD. The previous pass sat at ~38cqh (mid-screen crowd);
     dropped to ~57cqh so the callout reads as "attached to the action" while
     the side anchor keeps it clear of the fighters in the center column. */
  top: clamp(348px, 57cqh, 430px);
  /* Bleeds to the frame edge like a broadcast lower-third. The slab supplies
     its own inner padding so the text never jams against the screen edge. */
  ${(p) => (p.$isLeftSide ? "left: 0;" : "right: 0;")}
  pointer-events: none;
  opacity: var(--announcement-stack-opacity);
  transform:
    translateY(var(--announcement-stack-y))
    scale(var(--announcement-stack-scale));
  transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
  transition:
    transform 0.16s cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 0.16s ease-out;
  will-change: transform, opacity;
  --announcement-stack-y: calc(
    ${(p) => Math.min(p.$stackIndex, 3)} * clamp(-40px, -4.2cqh, -28px)
  );
  --announcement-stack-scale: ${(p) =>
    Math.max(0.66, 1 - Math.min(p.$stackIndex, 3) * 0.13)};
  --announcement-stack-opacity: ${(p) =>
    Math.max(0.34, 0.96 - Math.min(p.$stackIndex, 3) * 0.3)};
  z-index: ${(p) => 220 - Math.min(p.$stackIndex, 5)};

  @media (max-width: 900px) {
    top: clamp(300px, 54cqh, 380px);
  }
`;

const BannerMotion = styled.div`
  position: relative;
  /*
   * Two animations chained on the same element:
   *   1) Slab slides in from the anchor edge (entrance, ~200ms).
   *   2) Fade-out-up (exit, ~320ms), delayed to fire near the end of the
   *      duration window so the flow reads land → hold → exit. The consumer
   *      unmounts shortly after, so the exit completes without a flicker.
   */
  animation:
    ${(p) => (p.$isLeftSide ? slabInFromLeft : slabInFromRight)}
      0.2s cubic-bezier(0.2, 0.7, 0.2, 1) both,
    ${fadeOutUp} 0.32s ease-in forwards;
  animation-delay: 0s,
    ${(p) => Math.max(0.4, (p.$duration || 1.2) - 0.32)}s;
`;

/*
 * Contrast haze — a soft dark radial seated behind the slab so its outer
 * transition into the busy crowd stays clean. Same job the ContrastHaze in
 * RoundResult does for the center kimarite call, scaled to a side callout.
 */
const Haze = styled.div`
  position: absolute;
  z-index: 0;
  top: 50%;
  ${(p) => (p.$isLeftSide ? "left: -6%;" : "right: -6%;")}
  transform: translateY(-50%);
  width: 128%;
  height: 190%;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    rgba(6, 8, 12, 0.55) 0%,
    rgba(6, 8, 12, 0.32) 42%,
    transparent 74%
  );
  filter: blur(6px);
`;

/*
 * The ink slab — a dark sumi plate the callout sits on. The inner edge (the
 * one facing the center of the dohyo) is sheared into a parallelogram so the
 * plate leans forward like a fighting-game name tag instead of reading as a
 * flat rectangle; the outer edge stays flush to the frame. A cool top hairline
 * (::before) makes it feel pressed rather than painted, and a low inner
 * vignette (::after) gives it a touch of depth. overflow: hidden clips the big
 * kanji print and the spine to the slab silhouette.
 */
const Slab = styled.div`
  position: relative;
  z-index: 1;
  overflow: hidden;
  /* Deliberately LONG. The headline is pushed to the inner (center-facing)
     end via text-align, and the kanji print stays parked at the outer frame
     edge, so the extra length is the open ink space between the two — a
     lower-third "name bar" read rather than a tight tag hugging the word. */
  min-width: clamp(158px, 15.5cqw, 235px);
  max-width: 46cqw;
  padding-block: clamp(5px, 0.9cqh, 9px);
  ${(p) =>
    p.$isLeftSide
      ? css`
          padding-left: clamp(12px, 1.6cqw, 26px);
          padding-right: clamp(20px, 2.4cqw, 38px);
          text-align: right;
          clip-path: polygon(
            0 0,
            100% 0,
            calc(100% - ${SLAB_SLANT}) 100%,
            0 100%
          );
          border-radius: 0 ${SLAB_RADIUS} ${SLAB_RADIUS} 0;
        `
      : css`
          padding-left: clamp(20px, 2.4cqw, 38px);
          padding-right: clamp(12px, 1.6cqw, 26px);
          text-align: left;
          clip-path: polygon(
            0 0,
            100% 0,
            100% 100%,
            ${SLAB_SLANT} 100%
          );
          border-radius: ${SLAB_RADIUS} 0 0 ${SLAB_RADIUS};
        `}
  background:
    linear-gradient(
      180deg,
      ${C.sumiSoft} 0%,
      ${C.sumi} 52%,
      #0e1014 100%
    );
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.42),
    0 1px 0 rgba(0, 0, 0, 0.5);

  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    background: ${C.sumiBorder};
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      120% 120% at ${(p) => (p.$isLeftSide ? "8% 40%" : "92% 40%")},
      transparent 52%,
      rgba(0, 0, 0, 0.32) 100%
    );
  }
`;

/*
 * The type-color spine on the inner edge — the mechanic-color accent (purple
 * PUNISH, gold COUNTER HIT, green BREAK …) and the directional cue toward the
 * center of the ring. Replaces the old thin underline "rule". Themes with an
 * explicit accent (perfectparry → white) use it here.
 */
const Spine = styled.div`
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  ${(p) =>
    p.$isLeftSide
      ? css`right: 0;`
      : css`left: 0;`}
  width: clamp(2.5px, 0.32cqw, 4.5px);
  background: ${(p) => {
    const theme = getTheme(p.$type);
    const body = theme.accent || theme.color;
    return css`linear-gradient(180deg, #fff 0%, ${body} 18%, ${body} 82%, ${theme.deep} 100%)`;
  }};
  box-shadow: 0 0 12px
    ${(p) => {
      const theme = getTheme(p.$type);
      return theme.accent || theme.color;
    }};
  --spine-skew: ${(p) => (p.$isLeftSide ? "-9deg" : "9deg")};
  transform: skewX(var(--spine-skew)) scaleY(0);
  transform-origin: top center;
  animation: ${spineDrop} 0.26s cubic-bezier(0.2, 0.7, 0.2, 1) 0.12s both;
`;

/*
 * Kanji print — a LARGE calligraphy glyph pressed into the slab behind the
 * roman headline, anchored to and bleeding off the frame edge so it reads as
 * a stamped seal print (banzuke poster vocabulary), not a chip on top of the
 * text. overflow: hidden on the slab clips it to the plate. Sits under the
 * headline in z-order and never covers a glyph of the message.
 */
const KanjiPrint = styled.div`
  position: absolute;
  z-index: 1;
  top: 50%;
  ${(p) =>
    p.$isLeftSide
      ? css`left: clamp(-9px, -0.5cqw, -4px);`
      : css`right: clamp(-9px, -0.5cqw, -4px);`}
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(1.8rem, 3.7cqw, 2.9rem);
  line-height: 1;
  color: ${(p) => getTheme(p.$type).color};
  opacity: 0;
  pointer-events: none;
  transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
  animation: ${kanjiPress} 0.34s cubic-bezier(0.3, 1.2, 0.5, 1) forwards;
  /* Nudge the resting glyph back onto its vertical center; the keyframes
     drive scale/rotate/opacity, this handles the translate the animation
     can't (transform is fully owned by the animation while it runs). */
  will-change: transform, opacity;
  margin-top: -0.52em;
`;

const Content = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.5cqh, 5px);
`;

/*
 * The headline. Big Bungee in the type color, given the extruded "3D stamp"
 * treatment RoundResult uses (offset drop in the type's deep tone + a soft
 * ambient) so it reads as a premium impact word rather than flat text. On the
 * dark slab the saturated type color needs no outline to stay legible, so the
 * treatment is a crisp HARD emboss (top light-catch + deep-tone extrude, zero
 * blur) plus a brightness lift at the tail of the slam — dimension and pop
 * without a fuzzy drop shadow or cheap glow. Labels render single-line (the
 * component collapses any "\n" to a space). The whole block carries a slight
 * forward lean (skewX) matching the slab.
 */
const MainText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.78rem, 1.4cqw, 1.1rem);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
  text-align: inherit;
  transform: skewX(-5deg) scale(1.42);
  /* Pivot the slam from the inner (center-facing) end, where the headline now
     sits, so it blooms outward from the spine rather than the frame edge. */
  transform-origin: ${(p) => (p.$isLeftSide ? "right center" : "left center")};
  color: ${(p) => getTheme(p.$type).color};
  /*
   * CRISP, not blurry. Earlier passes stacked soft blurred drops
   * (0 3px 6px / 0 0 10px) under the glyphs, which fuzzed the edges
   * and read as flat + smudged. This is a HARD emboss instead:
   *   - a 1px light-catch on the TOP edge (a lit rim) gives the type
   *     dimension so it stops reading as flat,
   *   - a 1px extrude in the deep tone + a 1px black grounding line
   *     seat it on the slab.
   * Zero blur radius on every layer, so the letterforms stay sharp.
   * No text-stroke (it only thickened/muddied the glyphs). Brightness
   * lift lives at the tail of the slam keyframe so the color pops
   * without any fuzzy CSS glow.
   */
  text-shadow: ${(p) => {
    const theme = getTheme(p.$type);
    return css`
      0 -1px 0 rgba(255, 255, 255, 0.28),
      0 1px 0 ${theme.deep},
      0 2px 0 rgba(0, 0, 0, 0.5)
    `;
  }};
  opacity: 0;
  animation: ${textSlam} 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.06s forwards;
  will-change: transform, opacity, filter;

  @media (max-width: 900px) {
    font-size: clamp(0.66rem, 1.9cqw, 0.92rem);
  }
`;

/*
 * Optional subtitle. Small letter-spaced caps in cream — kept neutral so the
 * type color speaks only through the headline + spine. Rises in after the
 * headline slam.
 */
const SubText = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.42rem, 0.72cqw, 0.58rem);
  color: ${C.creamWarm};
  text-transform: uppercase;
  letter-spacing: 0.26em;
  text-align: inherit;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  opacity: 0;
  animation: ${subTextRise} 0.26s ease-out 0.26s forwards;

  @media (max-width: 900px) {
    font-size: clamp(0.44rem, 1.4cqw, 0.66rem);
    letter-spacing: 0.22em;
  }
`;

// ============================================
// COMPONENT
// ============================================

const SumoAnnouncementBanner = ({
  text,
  type = "default",
  isLeftSide = true,
  duration = 1.5,
  subText = null,
}) => {
  const { slotIndex } = useAnnouncementStack(isLeftSide);
  const kanji = TYPE_KANJI[type];
  // Callers historically pass two-line labels (e.g. "COUNTER\nHIT"); the
  // compact SF6-scale slab reads better on ONE line, so collapse any newlines
  // to a single space here rather than editing all the call sites.
  const label = typeof text === "string" ? text.replace(/\s*\n\s*/g, " ") : text;

  return (
    <BannerWrapper $isLeftSide={isLeftSide} $stackIndex={slotIndex}>
      <BannerMotion $isLeftSide={isLeftSide} $duration={duration}>
        <Haze $isLeftSide={isLeftSide} aria-hidden />
        <Slab $isLeftSide={isLeftSide} $type={type}>
          {kanji && (
            <KanjiPrint $type={type} $isLeftSide={isLeftSide} aria-hidden>
              {kanji}
            </KanjiPrint>
          )}
          <Spine $type={type} $isLeftSide={isLeftSide} aria-hidden />
          <Content>
            <MainText $type={type} $isLeftSide={isLeftSide}>
              {label}
            </MainText>
            {subText && <SubText>{subText}</SubText>}
          </Content>
        </Slab>
      </BannerMotion>
    </BannerWrapper>
  );
};

SumoAnnouncementBanner.propTypes = {
  text: PropTypes.string.isRequired,
  type: PropTypes.oneOf([
    "parry",
    "perfect",
    "perfectparry",
    "counter",
    "counterhit",
    "counterthrow",
    "braced",
    "deepgrip",
    "punish",
    "countergrab",
    "break",
    "tech",
    "default",
  ]),
  isLeftSide: PropTypes.bool,
  duration: PropTypes.number,
  subText: PropTypes.string,
};

export default SumoAnnouncementBanner;
