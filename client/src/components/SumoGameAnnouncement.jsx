import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { C, FONT_DISPLAY, FONT_KANJI } from "./menuTheme";

// ============================================
// SHARED Y-POSITION (both announcements live here — below the HUD)
// ============================================
/** Shared with PowerUpReveal — upper-arena band just under the HUD. */
export const ANNOUNCE_Y = "clamp(100px, 28cqh, 190px)";

// ============================================
// ANIMATIONS
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

/* TE WO TSUITE — quiet rise.
 *
 * Te-wo-tsuite is the call before the bout: both wrestlers crouch
 * into starting position and put their hands on the ground. It's a
 * moment of held breath, not action. The motion should reflect that:
 * the text rises gently into its final position over ~360ms and
 * holds. No scale, no rotation, no rebound. Pure positional motion.
 *
 * Distinct from HAKKI-YOI (scale punch-in) and RoundResult (stamp
 * impression) — using a translate-only entrance here gives each
 * round-state call its own motion axis instead of layering the same
 * choreography three times. */
const slideIn = keyframes`
  0%   { opacity: 0; transform: translate(-50%, calc(-50% + 10px)); }
  18%  { opacity: 1; transform: translate(-50%, -50%); }
  80%  { opacity: 1; transform: translate(-50%, -50%); }
  100% { opacity: 0; transform: translate(-50%, -50%); }
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

// ── Fade in then out ──
const fadeIO = keyframes`
  0%   { opacity: 0; }
  16%  { opacity: 0; }
  28%  { opacity: 1; }
  75%  { opacity: 1; }
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
// SCREEN FLASH (shared — both types)
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

  background: ${(p) =>
    p.$type === "hakkiyoi"
      ? `radial-gradient(ellipse at 50% 28%, rgba(232,197,71,0.28) 0%, rgba(232,197,71,0.1) 32%, transparent 56%)`
      : `radial-gradient(ellipse at 50% 25%, rgba(245,236,217,0.22) 0%, rgba(245,236,217,0.08) 22%, transparent 45%)`};
`;

// ============================================
// HAKKIYOI STYLED COMPONENTS
// ============================================

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
  font-size: clamp(2.1rem, 6cqw, 5.4rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  white-space: nowrap;

  color: #f0d56a;
  -webkit-text-stroke: clamp(1.2px, 0.17cqw, 2.1px) rgba(18, 12, 6, 0.92);

  text-shadow:
    0 1px 0 rgba(255, 244, 200, 0.35),
    0 2px 0 rgba(120, 78, 12, 0.55),
    0 3px 10px rgba(0, 0, 0, 0.65),
    0 0 18px rgba(232, 197, 71, 0.22);

  animation: ${css`
      ${slamIn}`} ${(p) => p.$duration} cubic-bezier(0.16, 1, 0.3, 1)
    forwards;

  @media (max-width: 900px) {
    font-size: clamp(1.7rem, 5.2cqw, 4rem);
    letter-spacing: 0.09em;
  }
  @media (max-width: 600px) {
    font-size: clamp(1.35rem, 4.8cqw, 2.8rem);
    letter-spacing: 0.07em;
  }
`;

/* Japanese subtitle — matching leaf gold, quieter than the roman. */
const HakkiyoiKanji = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(30px, 4.6cqh, 52px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1004;
  pointer-events: none;

  font-family: ${FONT_KANJI};
  font-size: clamp(0.72rem, 1.45cqw, 1.15rem);
  color: rgba(240, 213, 106, 0.88);
  letter-spacing: 0.4em;
  text-indent: 0.4em;
  opacity: 0;
  animation: ${fadeIO} ${(p) => p.$duration} ease-out forwards;
  animation-delay: 0.12s;

  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);

  @media (max-width: 600px) {
    font-size: clamp(0.58rem, 1.3cqw, 0.9rem);
    letter-spacing: 0.28em;
    text-indent: 0.28em;
    top: calc(${ANNOUNCE_Y} + clamp(24px, 4cqh, 42px));
  }
`;

// ============================================
// TE WO TSUITE STYLED COMPONENTS
// ============================================

/* HANDS DOWN text — matches RoundResult style, slightly smaller than HAKKIYOI/RoundResult */
const TeWoTsuiteText = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  z-index: 1004;
  pointer-events: none;

  font-family: ${FONT_DISPLAY}, "Impact", sans-serif;
  font-size: clamp(1.65rem, 5cqw, 4.4rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;

  color: ${C.cream};
  -webkit-text-stroke: clamp(1.5px, 0.2cqw, 2.5px) rgba(10, 10, 10, 0.85);

  text-shadow:
    clamp(2px, 0.14cqw, 3px) clamp(2px, 0.14cqw, 3px) 0 rgba(10, 8, 6, 0.9),
    clamp(3px, 0.28cqw, 5px) clamp(3px, 0.28cqw, 5px) 0 rgba(10, 8, 6, 0.65),
    clamp(5px, 0.4cqw, 8px) clamp(5px, 0.4cqw, 8px) 0 rgba(8, 6, 4, 0.38),
    clamp(7px, 0.52cqw, 10px) clamp(7px, 0.52cqw, 10px) 0 rgba(5, 4, 2, 0.18),
    0 clamp(2px, 0.24cqw, 4px) clamp(8px, 0.8cqw, 16px) rgba(0, 0, 0, 0.6);

  animation: ${css`
      ${slideIn}`} ${(p) => p.$duration} cubic-bezier(0.25, 0.46, 0.45, 0.94)
    forwards;

  @media (max-width: 900px) {
    font-size: clamp(1.35rem, 4.4cqw, 3.2rem);
    letter-spacing: 0.08em;
  }
  @media (max-width: 600px) {
    font-size: clamp(1.1rem, 3.8cqw, 2.2rem);
    letter-spacing: 0.06em;
  }
`;

/* Brush stroke under HANDS DOWN */
const TeWoBrush = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(15px, 2.5cqh, 32px));
  left: 50%;
  transform: translateX(-50%);
  width: clamp(190px, 30cqw, 360px);
  height: clamp(10px, 1.5cqh, 18px);
  z-index: 1003;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(1px);

  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(245, 236, 217, 0.1) 15%,
    rgba(245, 236, 217, 0.22) 50%,
    rgba(245, 236, 217, 0.1) 85%,
    transparent 100%
  );

  animation: ${brushReveal} ${(p) => p.$duration} ease-out forwards;

  @media (max-width: 900px) {
    width: clamp(160px, 28cqw, 290px);
    top: calc(${ANNOUNCE_Y} + clamp(12px, 2cqh, 26px));
  }
  @media (max-width: 600px) {
    width: clamp(120px, 26cqw, 220px);
    top: calc(${ANNOUNCE_Y} + clamp(10px, 1.8cqh, 20px));
  }
`;

/* Japanese subtitle 手を付いて — below the brush */
const TeWoKanji = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(36px, 5.5cqh, 62px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1004;
  pointer-events: none;

  font-family: ${FONT_KANJI};
  font-size: clamp(0.65rem, 1.3cqw, 1.05rem);
  font-weight: 700;
  color: rgba(245, 236, 217, 0.78);
  letter-spacing: 0.3em;
  opacity: 0;
  animation: ${fadeIO} ${(p) => p.$duration} ease-out forwards;
  animation-delay: 0.1s;

  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9);

  @media (max-width: 600px) {
    font-size: clamp(0.55rem, 1.1cqw, 0.8rem);
    top: calc(${ANNOUNCE_Y} + clamp(28px, 4.5cqh, 50px));
  }
`;

// ============================================
// COMPONENT
// ============================================

const SumoGameAnnouncement = ({ type = "hakkiyoi", duration = null }) => {
  const actualDuration = duration || (type === "hakkiyoi" ? 1.8 : 2);
  const durationStr = `${actualDuration}s`;

  // ─── HAKKIYOI ───
  if (type === "hakkiyoi") {
    return (
      <>
        <ScreenFlash $type="hakkiyoi" />
        <DarkVignette $duration={durationStr} />
        <HakkiyoiText $duration={durationStr}>HAKKI-YOI!</HakkiyoiText>
        <HakkiyoiRule $duration={durationStr} aria-hidden />
        <HakkiyoiKanji $duration={durationStr}>八卦良い</HakkiyoiKanji>
      </>
    );
  }

  // ─── TE WO TSUITE ───
  return (
    <>
      <ScreenFlash $type="tewotsuite" />
      <TeWoTsuiteText $duration={durationStr}>HANDS DOWN!</TeWoTsuiteText>
      <TeWoKanji $duration={durationStr}>手を付いて</TeWoKanji>
      <TeWoBrush $duration={durationStr} />
    </>
  );
};

SumoGameAnnouncement.propTypes = {
  type: PropTypes.oneOf(["hakkiyoi", "tewotsuite"]),
  duration: PropTypes.number,
};

export default SumoGameAnnouncement;
