import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { FONT_DISPLAY } from "./menuTheme";
import {
  GYOJI_CENTER_PCT,
  GYOJI_MOUTH_BOTTOM,
} from "./gyojiLayout";
import handsDownBubble from "../assets/gyoji-hands-down-v2.svg";
import handsDownWordmark from "../assets/gyoji-hands-down-wordmark-v1.svg";

// ============================================
// SHARED Y-POSITION (RoundResult / PowerUpReveal)
// ============================================
/** Shared with PowerUpReveal — upper-arena band just under the HUD. */
export const ANNOUNCE_Y = "clamp(100px, 28cqh, 190px)";

/** Pro fight-call budget: snap → brief hold → gone as play opens. */
export const DEFAULT_HAKKIYOI_DURATION = 0.75;
export const DEFAULT_TEWOTSUITE_DURATION = 2;

/*
 * Restored working widths (pre diagonal-tail / vw revision), then scaled:
 *   HANDS DOWN...  × 0.70
 * Same cqw clamp coordinate system as the centered Gyoji version.
 */
const HANDS_BUBBLE_WIDTH = "clamp(132px, 17cqw, 226px)"; // ~90% of prior restored×0.70

/** Vertical seat — raise above the mouth plant. */
const BUBBLE_RAISE = "4.5cqh";

// ============================================
// HAKKI-YOI MOTION — recovered from pre-bubble HEAD (b21793bd)
// ============================================

/* HAKKI-YOI — scale punch-in, no rebound.
 *
 * Iteration history on this animation:
 *   v1 (original): scale 2.8 → 0.88 → 1.14 → 0.96 → 1.03 → 1.0
 *                  with a rotation wobble. Five overshoots before
 *                  settling. Cartoon-fighter squash-and-stretch.
 *   v2 (clip-path): single left-to-right clip-path calligraphy
 *                  reveal. No scale, no translate. Read as boring
 *                  and lifeless — wipes don't have weight.
 *   v3 (this):     scale 1.18 → 1.0 with sharp ease-out and NO
 *                  rebound past 1.0. The text PUNCHES into its
 *                  final size in ~160ms then holds. That's the
 *                  weight v2 was missing without the cartoon
 *                  rebound v1 had.
 *
 * The bezier on the animation property is cubic-bezier(0.16, 1,
 * 0.3, 1) — the "out-expo"-style decel curve. It starts fast and
 * decelerates aggressively into the final value. Critically, it
 * never overshoots 1.0, so the scale snaps cleanly to its final
 * size with no rubber-band rebound — that's the difference between
 * "weighted impact" and "boingy cartoon".
 *
 * HAKKI-YOI is the BOUT-START call — the moment of energy release
 * when both wrestlers explode out of their crouch. Scale-driven
 * entry matches that release-of-energy feel. */
const slamIn = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.18); }
  9%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  80%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
`;

// ── Screen flash ──
const screenFlash = keyframes`
  0%   { opacity: 0; }
  8%   { opacity: 0.55; }
  22%  { opacity: 0.25; }
  40%  { opacity: 0.35; }
  60%  { opacity: 0.12; }
  100% { opacity: 0; }
`;

// ── Soft seat behind HAKKIYOI ──
const vignettePulse = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
  14%  { opacity: 0.7; transform: translate(-50%, -50%) scale(1.02); }
  78%  { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
`;

// ── Hairline / brush reveal ──
const brushReveal = keyframes`
  0%   { clip-path: inset(0 100% 0 0); opacity: 0; }
  22%  { clip-path: inset(0 0% 0 0); opacity: 0.85; }
  70%  { clip-path: inset(0 0% 0 0); opacity: 0.85; }
  100% { clip-path: inset(0 0% 0 0); opacity: 0; }
`;

// ============================================
// HANDS DOWN MOTION — current bubble ceremony (unchanged)
// ============================================

/* HANDS DOWN — restrained settle from the Gyoji/tail. */
const handsDownIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.94);
  }
  14% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  82% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-3px) scale(0.98);
  }
`;

// ============================================
// HAKKIYOI STYLED COMPONENTS — pre-bubble HEAD restore
// (no Japanese subtitle; spaced "HAKKI-YOI !" text)
// ============================================

const ScreenFlash = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  animation: ${screenFlash} 0.65s ease-out forwards;

  background: radial-gradient(
    ellipse at 50% 28%,
    rgba(232, 197, 71, 0.28) 0%,
    rgba(232, 197, 71, 0.1) 32%,
    transparent 56%
  );
`;

/* Quiet ink seat — grounds the call without a muddy brown blot. */
const DarkVignette = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  width: clamp(420px, 52cqw, 720px);
  height: clamp(110px, 16cqh, 190px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 1001;

  background: radial-gradient(
    ellipse at center,
    rgba(8, 10, 16, 0.55) 0%,
    rgba(8, 10, 16, 0.28) 42%,
    transparent 74%
  );
  filter: blur(12px);

  animation: ${vignettePulse} ${(p) => p.$duration} ease-out forwards;

  @media (max-width: 900px) {
    width: clamp(320px, 48cqw, 560px);
    height: clamp(88px, 14cqh, 150px);
  }
  @media (max-width: 600px) {
    width: clamp(240px, 46cqw, 400px);
    height: clamp(70px, 12cqh, 110px);
  }
`;

/* Thin gold-leaf hairline — ceremony accent, not a fat arcade brush. */
const HakkiyoiRule = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(18px, 2.8cqh, 34px));
  left: 50%;
  transform: translateX(-50%);
  width: clamp(140px, 22cqw, 280px);
  height: 1.5px;
  pointer-events: none;
  z-index: 1003;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(232, 197, 71, 0.25) 18%,
    rgba(232, 197, 71, 0.85) 50%,
    rgba(232, 197, 71, 0.25) 82%,
    transparent 100%
  );
  animation: ${brushReveal} ${(p) => p.$duration} ease-out forwards;

  @media (max-width: 600px) {
    width: clamp(110px, 28cqw, 200px);
    top: calc(${ANNOUNCE_Y} + clamp(14px, 2.4cqh, 26px));
  }
`;

/*
 * HAKKI-YOI — gold leaf ceremony, not cream (too quiet) and not the old
 * arcade recipe (gold + vermillion stroke + hard 3D shelf).
 * Fill = warm leaf gold. Stroke = thin sumi ink. Seat = soft depth only.
 */
const HakkiyoiText = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  z-index: 1004;
  pointer-events: none;

  font-family: ${FONT_DISPLAY}, "Impact", sans-serif;
  font-size: clamp(2.45rem, 7cqw, 6.2rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;

  color: #f0d56a;
  -webkit-text-stroke: clamp(1.4px, 0.19cqw, 2.4px) rgba(18, 12, 6, 0.92);

  text-shadow:
    0 1px 0 rgba(255, 244, 200, 0.35),
    0 2px 0 rgba(120, 78, 12, 0.55),
    0 3px 10px rgba(0, 0, 0, 0.65),
    0 0 22px rgba(232, 197, 71, 0.28);

  animation: ${css`
      ${slamIn}`} ${(p) => p.$duration} cubic-bezier(0.16, 1, 0.3, 1)
    forwards;

  @media (max-width: 900px) {
    font-size: clamp(2rem, 6.1cqw, 4.7rem);
    letter-spacing: 0.085em;
  }
  @media (max-width: 600px) {
    font-size: clamp(1.55rem, 5.5cqw, 3.25rem);
    letter-spacing: 0.07em;
  }
`;

// ============================================
// HANDS DOWN — V2 bubble shell (geometry frozen)
// ============================================

/**
 * Planted on the Gyoji mouth/head — horizontally centered on the same
 * percentage + cqw space as `.gyoji`. Raised so the face stays clearer
 * under the tail. Seat only — no motion animation here.
 */
const BubbleRoot = styled.div`
  position: absolute;
  left: ${GYOJI_CENTER_PCT}%;
  bottom: calc(${GYOJI_MOUTH_BOTTOM} + ${BUBBLE_RAISE});
  z-index: 1;
  pointer-events: none;
  transform: translate(-50%, 0);
  width: ${HANDS_BUBBLE_WIDTH};
  aspect-ratio: 1200 / 440;
  height: auto;
`;

/** Motion layer — restrained settle from the tail tip. */
const BubbleMotion = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: 50% 100%;
  opacity: 0;
  animation: ${handsDownIn} ${(p) => p.$duration}
    cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
`;

/** Balloon + wordmark share this box (matched 1200×440 viewBoxes). */
const BubbleArt = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
`;

const BubbleWordmark = styled(BubbleArt)`
  z-index: 1;
`;

const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

// ============================================
// COMPONENT
// ============================================

const SumoGameAnnouncement = ({ type = "hakkiyoi", duration = null }) => {
  const actualDuration =
    duration ??
    (type === "hakkiyoi"
      ? DEFAULT_HAKKIYOI_DURATION
      : DEFAULT_TEWOTSUITE_DURATION);
  const durationStr = `${actualDuration}s`;

  // ─── HAKKIYOI — containerless pre-bubble presentation ───
  if (type === "hakkiyoi") {
    return (
      <>
        <ScreenFlash />
        <DarkVignette $duration={durationStr} />
        <HakkiyoiText $duration={durationStr}>HAKKI-YOI !</HakkiyoiText>
        <HakkiyoiRule $duration={durationStr} aria-hidden />
      </>
    );
  }

  // ─── HANDS DOWN — V2 Gyoji balloon + authored wordmark layer ───
  return (
    <BubbleRoot>
      <BubbleMotion $duration={durationStr}>
        <BubbleArt
          src={handsDownBubble}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <BubbleWordmark
          src={handsDownWordmark}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <SrOnly>HANDS DOWN...</SrOnly>
      </BubbleMotion>
    </BubbleRoot>
  );
};

SumoGameAnnouncement.propTypes = {
  type: PropTypes.oneOf(["hakkiyoi", "tewotsuite"]),
  duration: PropTypes.number,
};

export default SumoGameAnnouncement;
