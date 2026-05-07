import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { C } from "./menuTheme";

/*
 * SumoAnnouncementBanner — fighting-game impact callout.
 *
 * THE REWRITE (vs. the previous "wooden hanging sumo banner" pass):
 *   The previous pass was a tall narrow vertical scroll pinned
 *   to the side of the arena: dark chocolate-brown lacquered
 *   body, gold corner caps, hanging cord at the top, infinitely
 *   swaying tassels at the bottom, infinite text-glow pulse
 *   loop. Two problems:
 *
 *     1. SAME DARK-BROWN VOCABULARY the user explicitly killed
 *        from PowerUpReveal and PowerUpSelection. The wooden
 *        sumo-banner chrome was the centerpiece offender —
 *        dark brown gradient body + gold trim + infinite
 *        ambient motion is exactly the templated AI-render
 *        look the rest of the in-game UI moved away from.
 *     2. NOTICEABILITY. At ~110px wide with 0.85rem text, the
 *        banner read as a small decorative side scroll, not
 *        an impact callout. In a fighting-game context — fast
 *        reads, eyes locked on the dohyo center — peripheral
 *        callouts have to be BIG, BOLD, and FAST or they
 *        register as background noise.
 *
 *   The rewrite drops the entire wooden-banner vocabulary and
 *   rejoins the broadcast-SFX typography world the rest of
 *   the in-game callout family lives in (PowerUpReveal big
 *   Bungee with sumi stroke, the cream/sumi/vermillion menu
 *   palette). It treats the announcement the way Street
 *   Fighter 6 / anime fighters / arcade fighters treat impact
 *   text: large, colored, briefly violent in motion, gone in
 *   under a second-and-a-half.
 *
 * SHAPE:
 *   - No container, no panel, no wooden bar, no cord, no
 *     tassels, no gold caps. Just text + a single colored
 *     slash rule under it. Same vocabulary as PowerUpReveal
 *     scaled up to impact size.
 *   - Anchored to the triggering side of the arena (the side
 *     where the player who triggered the call lives) so the
 *     spatial cue ("who did this?") is preserved, and the
 *     center column of the dohyo stays clear for the actual
 *     fight.
 *   - BIG Bungee text in the type color (vermillion for
 *     punish/counter/countergrab, amber for counterhit, ice
 *     for parry/tech, success-green for break, gold for
 *     perfect). Heavy sumi stencil stroke + warm halo so the
 *     colored type reads against ANY arena content under it
 *     without needing a background plate. This is the canonical
 *     comic / SF6 / anime-fighter SFX text recipe — colored
 *     fill, black outline.
 *   - One thick color slash rule beneath the text in the
 *     same type color, sized to the full text width via
 *     align-self: stretch (same trick PowerUpReveal uses).
 *   - Optional subtext below the rule for context lines
 *     (the existing API exposes a `subText` prop; preserved).
 *
 * MOTION — fighting-game impact, not informational fade:
 *   Three-beat entrance:
 *     1. Whole banner slides in from its anchor edge (~180ms).
 *        Aggressive easing — overshoots tiny, settles. Reads
 *        as the call landing into frame from the side it
 *        belongs to.
 *     2. Main text "slams" with a scale-from-oversized
 *        (1.45 → 0.95 → 1.0) — 220ms, snappy. Same beat
 *        comic-book SFX text uses for "WHAM!" / "POW!".
 *     3. Color rule wipes in left→right (or right→left for
 *        right-anchored banners) ~80ms after entrance.
 *
 *   Hold for the bulk of the duration prop, then a single
 *   320ms fade-up exit. No infinite text-glow loop, no
 *   infinite tassel sway, no swing rotation. Each beat is
 *   one shot.
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

// ============================================
// ANIMATIONS
// ============================================

/*
 * Whole banner slides in from its anchor edge. No rotation,
 * no swing — the previous pass's swing-on-entry was sumo-
 * banner flavor that doesn't fit the broadcast-SFX direction.
 * Aggressive easing settles it like a call landing into frame.
 */
/*
 * The end-of-entrance and start-of-exit opacities are capped
 * at 0.92 (not 1) so the colored type sits at a slight
 * broadcast-graphic transparency throughout its visible
 * window. Caps in the keyframes themselves (rather than via
 * a static opacity: 0.92 on the wrapper) because the wrapper's
 * animations would otherwise override any static opacity.
 */
const slideInFromLeft = keyframes`
  0% {
    opacity: 0;
    transform: translateX(-44px);
  }
  100% {
    opacity: 0.92;
    transform: translateX(0);
  }
`;

const slideInFromRight = keyframes`
  0% {
    opacity: 0;
    transform: translateX(44px);
  }
  100% {
    opacity: 0.92;
    transform: translateX(0);
  }
`;

const fadeOutUp = keyframes`
  0% {
    opacity: 0.92;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-12px);
  }
`;

/*
 * Text slam — scale-from-oversized with a tiny undershoot
 * settle. The exact "POW!" beat comic-book SFX text uses on
 * impact frames. Faster and louder than a normal UI fade.
 */
const textSlam = keyframes`
  0% {
    opacity: 0;
    transform: scale(1.45);
  }
  60% {
    opacity: 1;
    transform: scale(0.94);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
`;

const subTextRise = keyframes`
  0% {
    opacity: 0;
    transform: translateY(6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

/*
 * Color slash wipes from the anchor edge inward — same beat
 * the rule under PowerUpReveal's names uses. Direction tied
 * to which side the banner is anchored to.
 */
const ruleWipeFromLeft = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;

const ruleWipeFromRight = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;

// ============================================
// LAYOUT
// ============================================

const BannerWrapper = styled.div`
  position: absolute;
  /* Sits in the lower portion of the empty crowd dead-space —
     comfortably below the player nameplates and just above
     the prize baskets / dohyo edge. The previous pass at
     30cqh was still in the upper crowd area; bumped to 38cqh
     so the banner reads as "side callout near the action"
     rather than "hovering up by the HUD". */
  top: clamp(220px, 38cqh, 290px);
  ${(props) =>
    props.$isLeftSide
      ? css`
          left: clamp(20px, 3.5cqw, 56px);
          align-items: flex-start;
          text-align: left;
        `
      : css`
          right: clamp(20px, 3.5cqw, 56px);
          align-items: flex-end;
          text-align: right;
        `}
  display: flex;
  flex-direction: column;
  /* Cluster width tracks the widest child (the main text), so
     the rule beneath can stretch to that exact width via
     align-self: stretch. Same trick PowerUpReveal uses. */
  width: max-content;
  max-width: 42cqw;
  gap: clamp(3px, 0.55cqh, 6px);
  z-index: 200;
  pointer-events: none;
  will-change: transform, opacity;

  /*
   * Two animations chained on the same element:
   *   1) Slide-in from the anchor edge (entrance, ~180ms).
   *   2) Fade-out-up (exit, ~320ms) delayed to fire near the
   *      end of the duration prop window.
   *
   * Browser runs them in parallel; the second's start state
   * matches the first's end state, so the visual flow is
   * "land → hold → exit". The exit delay is computed so the
   * exit completes right at the duration boundary — the
   * consumer unmounts the component shortly after that and
   * the user never sees a flicker.
   */
  animation:
    ${(p) => (p.$isLeftSide ? slideInFromLeft : slideInFromRight)}
      0.18s cubic-bezier(0.2, 0.7, 0.2, 1) both,
    ${fadeOutUp} 0.32s ease-in forwards;
  animation-delay: 0s,
    ${(p) => Math.max(0.4, (p.$duration || 1.2) - 0.32)}s;

  @media (max-width: 900px) {
    top: clamp(170px, 32cqh, 240px);
    max-width: 56cqw;
    ${(p) =>
      p.$isLeftSide
        ? css`
            left: clamp(14px, 4cqw, 36px);
          `
        : css`
            right: clamp(14px, 4cqw, 36px);
          `}
  }
`;

/*
 * The headline. Big colored Bungee in the type color with a
 * heavy sumi stencil stroke + dark warm halo. Two-line text
 * (e.g. "COUNTER\nHIT") works via white-space: pre-line +
 * the natural line-height; line height is kept tight (0.96)
 * so two-line headlines read as a single block, not two
 * stacked words.
 *
 * The transform-origin is set to the anchor edge so the
 * scale-slam pivots from the side the banner is anchored to
 * — the text "blooms" outward from its anchor rather than
 * pulsing from its own center, which keeps the directional
 * intent of the side-anchored banner consistent across both
 * the slide-in motion and the text-slam motion.
 */
const MainText = styled.div`
  font-family: "Bungee", cursive;
  /* Tuned to read slightly larger than the player nameplate
     in peripheral vision but well under the previous pass's
     1.6-3rem screen-takeover size. ~20% bump from the first
     dial-back so the callout registers without dominating
     the frame. */
  font-size: clamp(1.15rem, 2.4cqw, 1.9rem);
  color: ${(p) => getTheme(p.$type).color};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 0.98;
  white-space: pre-line;
  text-align: inherit;
  /*
   * Themes that define a textAccent get a hard offset under-shelf
   * in the accent color instead of the canonical dark drop + dark
   * halo. The under-shelf is a single solid 0/3px shadow with a
   * matching 0/4px so it reads as a sharp ~3-4px colored bar
   * directly beneath the glyphs — broadcast-SFX "shelf" feel,
   * none of the fuzzy glow the dark recipe carries. Sumi stencil
   * stroke is preserved either way so legibility stays the same.
   *
   * Currently only perfectparry uses textAccent (cyan glyphs +
   * yellow shelf + white rule); every other banner type falls
   * back to the original dark drop + halo recipe.
   */
  text-shadow: ${(p) => {
    const theme = getTheme(p.$type);
    const accent = theme.textAccent;
    if (accent) {
      return css`
        -1.5px 0 0 ${C.sumi}, 1.5px 0 0 ${C.sumi},
        0 -1.5px 0 ${C.sumi}, 0 1.5px 0 ${C.sumi},
        -1.5px -1.5px 0 ${C.sumi}, 1.5px -1.5px 0 ${C.sumi},
        -1.5px 1.5px 0 ${C.sumi}, 1.5px 1.5px 0 ${C.sumi},
        0 3px 0 ${accent},
        0 4px 0 ${accent}
      `;
    }
    return css`
      -1.5px 0 0 ${C.sumi}, 1.5px 0 0 ${C.sumi},
      0 -1.5px 0 ${C.sumi}, 0 1.5px 0 ${C.sumi},
      -1.5px -1.5px 0 ${C.sumi}, 1.5px -1.5px 0 ${C.sumi},
      -1.5px 1.5px 0 ${C.sumi}, 1.5px 1.5px 0 ${C.sumi},
      0 3px 0 rgba(0, 0, 0, 0.5),
      0 0 12px rgba(0, 0, 0, 0.6)
    `;
  }};
  opacity: 0;
  transform-origin: ${(p) =>
    p.$isLeftSide ? "left center" : "right center"};
  animation: ${textSlam} 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)
    0.05s forwards;
  will-change: transform, opacity;

  @media (max-width: 900px) {
    font-size: clamp(0.92rem, 3.1cqw, 1.4rem);
  }
`;

/*
 * Color slash beneath the text. align-self: stretch makes it
 * span the wrapper's width — which equals MainText's width
 * because MainText is the widest child — so the slash always
 * matches the headline's width regardless of how long the
 * action name is ("PUNISH" → short slash, "COUNTER HIT" →
 * long slash). Wipes in from the anchor edge.
 */
const Rule = styled.div`
  align-self: stretch;
  /* Proportionally trimmed alongside the smaller text — a 5px
     rule under 1.5rem text reads as a heavy bar; 3px reads as
     an underline beat. */
  height: 3px;
  /*
   * Themes that define an "accent" color use it as the rule's body
   * (currently only "perfectparry" — its rule is a clean white
   * plate beneath cyan text). Themes without an accent fall back
   * to the type's main color, which is the canonical behavior for
   * every other banner. The box-shadow recipe stays identical for
   * both cases — same 1px deep under-stripe, same soft glow halo
   * in the type's main color — so the rule's chrome is consistent
   * regardless of body color.
   */
  background: ${(p) => getTheme(p.$type).accent || getTheme(p.$type).color};
  box-shadow:
    0 1px 0 ${(p) => getTheme(p.$type).deep},
    0 0 10px ${(p) => getTheme(p.$type).color};
  transform: scaleX(0);
  transform-origin: ${(p) =>
    p.$isLeftSide ? "left center" : "right center"};
  animation:
    ${(p) => (p.$isLeftSide ? ruleWipeFromLeft : ruleWipeFromRight)}
    0.28s cubic-bezier(0.2, 0.7, 0.2, 1) 0.13s forwards;
`;

/*
 * Optional subtitle. Small letter-spaced caps, cream with
 * sumi stroke (so it stays neutral text — the type color
 * already speaks through the headline + rule, and subtitle
 * type-coloring would be visual noise). Rises into place
 * after the rule has wiped.
 */
const SubText = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.55rem, 1cqw, 0.8rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.32em;
  text-align: inherit;
  text-shadow:
    -1px 0 0 ${C.sumi}, 1px 0 0 ${C.sumi},
    0 -1px 0 ${C.sumi}, 0 1px 0 ${C.sumi},
    0 2px 0 rgba(0, 0, 0, 0.55),
    0 0 8px rgba(0, 0, 0, 0.6);
  opacity: 0;
  animation: ${subTextRise} 0.26s ease-out 0.28s forwards;

  @media (max-width: 900px) {
    font-size: clamp(0.46rem, 1.5cqw, 0.68rem);
    letter-spacing: 0.24em;
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
  return (
    <BannerWrapper $isLeftSide={isLeftSide} $duration={duration}>
      <MainText $type={type} $isLeftSide={isLeftSide}>
        {text}
      </MainText>
      <Rule $type={type} $isLeftSide={isLeftSide} />
      {subText && <SubText>{subText}</SubText>}
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
