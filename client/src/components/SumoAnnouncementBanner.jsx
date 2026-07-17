import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { C, FONT_KANJI } from "./menuTheme";

/*
 * SumoAnnouncementBanner — fighting-game impact callout.
 *
 * DESIGN: SF6-style horizontal impact bar.
 *   Thin type-color rules top + bottom, a soft translucent wash between
 *   them, cream headline with a restrained type-color bloom, and a faint
 *   kanji watermark. Color lives in the RULES and the WASH — not in a
 *   neon text stroke or a thick plastic slab. Side-anchored so P1/P2
 *   spatial cue stays intact; center column of the dohyo stays clear.
 *
 * SHAPE:
 *   - Anchored to and bled off the triggering player's frame edge.
 *   - Horizontal bar solid against the frame edge, dissolving toward the
 *     ring center — open end + kanji on the inner side.
 *   - Thin type-color hairlines on top + bottom (the signature SF6
 *     chrome), with a soft bloom so they read as lit, not drawn.
 *   - Large faint kanji print as a watermark (our sumo identity).
 *   - Headline: cream/white Bungee, soft type-color ambient only —
 *     no hard colored stroke (that was the jagged/goofy failure mode).
 *   - Optional subtext preserved.
 *   - Soft type-tinted haze seats the bar on the crowd.
 *   - Lower third (~57cqh), near the tawara.
 *
 * MOTION — fighting-game impact, not informational fade:
 *   Bar slides in from its frame edge with a tiny overshoot (~200ms) →
 *   kanji presses in → headline settles → hold → ~300ms slide-out
 *   back into the frame edge. One-shot beats only.
 *
 * STACK — SF6-style toast queue per side (max 3):
 *   Newest = primary slot (full size). Older bump up with mild scale/
 *   opacity falloff. Exit retreats sideways so it never fights the
 *   upward reflow. Cap overflow is evicted and exits immediately.
 *
 * COLOR / TYPE MAPPING (game canonical action colors):
 *     punish / counterhit / counter / countergrab / counterthrow /
 *     braced / deepgrip / parry / tech / break / perfect / perfectparry /
 *     default — see TYPE_COLORS below.
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

const MAX_ANNOUNCEMENT_STACK = 3;

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
    inStack: slotIndex !== -1,
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
  const joinedRef = useRef(false);
  const [stackState, setStackState] = useState({
    slotIndex: 0,
    evicted: false,
  });

  useEffect(() => {
    const id = idRef.current;
    removeFromStacks(id);
    activeAnnouncementStacks[sideKey].unshift({ id });
    // Cap: drop oldest beyond max so the column never piles up.
    if (activeAnnouncementStacks[sideKey].length > MAX_ANNOUNCEMENT_STACK) {
      activeAnnouncementStacks[sideKey].length = MAX_ANNOUNCEMENT_STACK;
    }
    joinedRef.current = true;

    const updateStackState = () => {
      const snap = getStackSnapshot(id, sideKey);
      setStackState((prev) => ({
        // Keep last slot on eviction so the banner doesn't jump to primary
        // while it slides out.
        slotIndex: snap.inStack ? snap.slotIndex : prev.slotIndex,
        evicted: joinedRef.current && !snap.inStack,
      }));
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

const slabInFromLeft = keyframes`
  0%   { opacity: 0; transform: translateX(-40px) scaleX(0.92); }
  70%  { opacity: 1; transform: translateX(3px) scaleX(1.01); }
  100% { opacity: 1; transform: translateX(0) scaleX(1); }
`;

const slabInFromRight = keyframes`
  0%   { opacity: 0; transform: translateX(40px) scaleX(0.92); }
  70%  { opacity: 1; transform: translateX(-3px) scaleX(1.01); }
  100% { opacity: 1; transform: translateX(0) scaleX(1); }
`;

/* Exit retreats into the frame edge — never up, so it doesn't fight the stack. */
const slabOutToLeft = keyframes`
  0%   { opacity: 1; transform: translateX(0) scaleX(1); }
  100% { opacity: 0; transform: translateX(-28px) scaleX(0.94); }
`;

const slabOutToRight = keyframes`
  0%   { opacity: 1; transform: translateX(0) scaleX(1); }
  100% { opacity: 0; transform: translateX(28px) scaleX(0.94); }
`;

/*
 * Text settle — soft brightness flash into place. No heavy skew/slam;
 * SF6's type arrives clean, not comic-book stamped.
 */
const textSettle = keyframes`
  0% {
    opacity: 0;
    transform: scale(1.12);
    filter: brightness(2.2) saturate(0.4);
    letter-spacing: 0.14em;
  }
  45% {
    opacity: 1;
    transform: scale(0.98);
    filter: brightness(1.35) saturate(0.85);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1.05) saturate(1);
    letter-spacing: 0.08em;
  }
`;

const kanjiPress = keyframes`
  0%   { opacity: 0; transform: scale(1.4) rotate(-8deg); }
  55%  { opacity: 0.18; transform: scale(0.98) rotate(-7deg); }
  100% { opacity: 0.14; transform: scale(1) rotate(-7deg); }
`;

const ruleDraw = keyframes`
  0%   { opacity: 0; transform: scaleX(0); }
  100% { opacity: 1; transform: scaleX(1); }
`;

const subTextRise = keyframes`
  0%   { opacity: 0; transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0); }
`;

// ============================================
// LAYOUT
// ============================================

const BannerWrapper = styled.div`
  position: absolute;
  top: clamp(348px, 57cqh, 430px);
  ${(p) => (p.$isLeftSide ? "left: 0;" : "right: 0;")}
  pointer-events: none;
  opacity: var(--announcement-stack-opacity);
  transform:
    translateY(var(--announcement-stack-y))
    scale(var(--announcement-stack-scale));
  transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
  /* Slightly longer ease so survivors glide into vacated slots. */
  transition:
    transform 0.22s cubic-bezier(0.22, 0.8, 0.2, 1),
    opacity 0.2s ease-out;
  will-change: transform, opacity;
  --announcement-stack-y: calc(
    ${(p) => Math.min(p.$stackIndex, 2)} * clamp(-32px, -3.4cqh, -28px)
  );
  --announcement-stack-scale: ${(p) =>
    Math.max(0.84, 1 - Math.min(p.$stackIndex, 2) * 0.07)};
  --announcement-stack-opacity: ${(p) =>
    Math.max(0.72, 1 - Math.min(p.$stackIndex, 2) * 0.13)};
  z-index: ${(p) => 220 - Math.min(p.$stackIndex, 2)};

  @media (max-width: 900px) {
    top: clamp(300px, 54cqh, 380px);
  }
`;

const EXIT_DURATION_S = 0.3;

const BannerMotion = styled.div`
  position: relative;
  ${(p) =>
    p.$evicted
      ? css`
          /* Cap overflow: drop the enter timeline and retreat now. */
          animation: ${p.$isLeftSide ? slabOutToLeft : slabOutToRight}
            ${EXIT_DURATION_S}s ease-in forwards;
        `
      : css`
          animation:
            ${p.$isLeftSide ? slabInFromLeft : slabInFromRight}
              0.22s cubic-bezier(0.2, 0.7, 0.2, 1) both,
            ${p.$isLeftSide ? slabOutToLeft : slabOutToRight}
              ${EXIT_DURATION_S}s ease-in forwards;
          animation-delay: 0s,
            ${Math.max(0.4, (p.$duration || 1.2) - EXIT_DURATION_S)}s;
        `}
`;

/*
 * Soft type-tinted haze — seats the bar and gives the SF6 "lit atmosphere"
 * without a hard plate silhouette.
 */
const Haze = styled.div`
  position: absolute;
  z-index: 0;
  top: 50%;
  ${(p) => (p.$isLeftSide ? "left: -4%;" : "right: -4%;")}
  transform: translateY(-50%);
  width: 118%;
  height: 220%;
  pointer-events: none;
  background: ${(p) => {
    const { color, deep } = getTheme(p.$type);
    return css`radial-gradient(
      ellipse at center,
      color-mix(in srgb, ${deep} 45%, transparent) 0%,
      color-mix(in srgb, ${color} 12%, transparent) 40%,
      transparent 72%
    )`;
  }};
  filter: blur(10px);
`;

/*
 * The bar — SF6 recipe: soft translucent type-wash between two thin
 * type-color rules. Solid flush against the frame edge; dissolves toward
 * the ring center (open end) so it reads as chrome arriving from the side.
 */
const Slab = styled.div`
  position: relative;
  z-index: 1;
  overflow: visible;
  min-width: clamp(170px, 18cqw, 280px);
  max-width: 42cqw;
  padding-block: clamp(7px, 1.1cqh, 12px);
  ${(p) =>
    p.$isLeftSide
      ? css`
          padding-left: clamp(12px, 1.5cqw, 22px);
          padding-right: clamp(22px, 2.6cqw, 38px);
          text-align: left;
        `
      : css`
          padding-left: clamp(22px, 2.6cqw, 38px);
          padding-right: clamp(12px, 1.5cqw, 22px);
          text-align: right;
        `}
  background: ${(p) => {
    const { color, deep } = getTheme(p.$type);
    /* Solid at the frame edge, dissolves toward the ring center. */
    const dir = p.$isLeftSide ? "90deg" : "270deg";
    return css`linear-gradient(
      ${dir},
      color-mix(in srgb, ${color} 38%, ${deep}) 0%,
      color-mix(in srgb, ${deep} 55%, rgba(8, 10, 14, 0.72)) 42%,
      color-mix(in srgb, ${deep} 18%, transparent) 78%,
      transparent 100%
    )`;
  }};
  box-shadow: ${(p) => {
    const { color } = getTheme(p.$type);
    return css`
      0 0 18px color-mix(in srgb, ${color} 18%, transparent),
      0 4px 14px rgba(0, 0, 0, 0.28)
    `;
  }};

  /* Top + bottom type-color rules — the SF6 signature chrome. */
  &::before,
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 1.5px;
    pointer-events: none;
    transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
    animation: ${ruleDraw} 0.28s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s both;
    background: ${(p) => {
      const { color } = getTheme(p.$type);
      const dir = p.$isLeftSide ? "90deg" : "270deg";
      return css`linear-gradient(
        ${dir},
        ${color} 0%,
        color-mix(in srgb, ${color} 70%, transparent) 55%,
        transparent 100%
      )`;
    }};
    box-shadow: ${(p) => {
      const { color } = getTheme(p.$type);
      return css`0 0 8px color-mix(in srgb, ${color} 55%, transparent)`;
    }};
  }

  &::before {
    top: 0;
  }

  &::after {
    bottom: 0;
  }
`;

/*
 * Kanji watermark — parked on the open (center-facing) end where the
 * wash dissolves, so it reads as a seal on the fading trail.
 */
const KanjiPrint = styled.div`
  position: absolute;
  z-index: 1;
  top: 50%;
  ${(p) =>
    p.$isLeftSide
      ? css`right: clamp(-6px, -0.3cqw, -2px);`
      : css`left: clamp(-6px, -0.3cqw, -2px);`}
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(1.6rem, 3.2cqw, 2.5rem);
  line-height: 1;
  color: ${(p) => {
    const { color } = getTheme(p.$type);
    return css`color-mix(in srgb, ${color} 35%, #fff)`;
  }};
  opacity: 0;
  pointer-events: none;
  transform-origin: ${(p) => (p.$isLeftSide ? "right center" : "left center")};
  animation: ${kanjiPress} 0.34s cubic-bezier(0.3, 1.2, 0.5, 1) forwards;
  will-change: transform, opacity;
  margin-top: -0.52em;
`;

const Content = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.4cqh, 4px);
`;

/*
 * Headline — SF6 recipe: cream/white fill, NO colored stroke, soft
 * type-color ambient bloom only. A hairline dark shadow keeps edges
 * readable on the lit wash without looking outlined.
 */
const MainText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.82rem, 1.5cqw, 1.15rem);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1;
  white-space: nowrap;
  text-align: inherit;
  transform: scale(1.12);
  transform-origin: ${(p) => (p.$isLeftSide ? "left center" : "right center")};
  color: #f7f2e6;
  text-shadow: ${(p) => {
    const theme = getTheme(p.$type);
    return css`
      0 0 10px color-mix(in srgb, ${theme.color} 35%, transparent),
      0 0 22px color-mix(in srgb, ${theme.color} 18%, transparent),
      0 1px 2px rgba(0, 0, 0, 0.65)
    `;
  }};
  opacity: 0;
  animation: ${textSettle} 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0.06s forwards;
  will-change: transform, opacity, filter;

  @media (max-width: 900px) {
    font-size: clamp(0.7rem, 2cqw, 0.95rem);
  }
`;

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
  animation: ${subTextRise} 0.26s ease-out 0.22s forwards;

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
  const { slotIndex, evicted } = useAnnouncementStack(isLeftSide);
  const kanji = TYPE_KANJI[type];
  const label = typeof text === "string" ? text.replace(/\s*\n\s*/g, " ") : text;

  return (
    <BannerWrapper $isLeftSide={isLeftSide} $stackIndex={slotIndex}>
      <BannerMotion
        $isLeftSide={isLeftSide}
        $duration={duration}
        $evicted={evicted}
      >
        <Haze $isLeftSide={isLeftSide} $type={type} aria-hidden />
        <Slab $isLeftSide={isLeftSide} $type={type}>
          {kanji && (
            <KanjiPrint $type={type} $isLeftSide={isLeftSide} aria-hidden>
              {kanji}
            </KanjiPrint>
          )}
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
