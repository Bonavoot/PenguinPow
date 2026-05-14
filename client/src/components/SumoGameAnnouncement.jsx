import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useMemo } from "react";

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

// ── Impact line burst ──
const impactBurst = keyframes`
  0%   { transform: scaleX(0.18); opacity: 0; }
  14%  { transform: scaleX(1); opacity: 0.82; }
  50%  { transform: scaleX(1.04); opacity: 0.42; }
  100% { transform: scaleX(1.1); opacity: 0; }
`;

// ── Fade in then out ──
const fadeIO = keyframes`
  0%   { opacity: 0; }
  16%  { opacity: 0; }
  28%  { opacity: 1; }
  75%  { opacity: 1; }
  100% { opacity: 0; }
`;

// ── Dark vignette behind HAKKIYOI text for contrast ──
const vignettePulse = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  12%  { opacity: 0.85; transform: translate(-50%, -50%) scale(1.05); }
  20%  { transform: translate(-50%, -50%) scale(0.97); }
  30%  { transform: translate(-50%, -50%) scale(1); }
  78%  { opacity: 0.85; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
`;

// ── Subtle brush reveal (TE WO TSUITE) ──
const brushReveal = keyframes`
  0%   { clip-path: inset(0 100% 0 0); opacity: 0; }
  22%  { clip-path: inset(0 0% 0 0); opacity: 0.7; }
  70%  { clip-path: inset(0 0% 0 0); opacity: 0.7; }
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
      ? `radial-gradient(ellipse at 50% 25%, rgba(255,215,0,0.5) 0%, rgba(255,200,50,0.2) 25%, transparent 55%)`
      : `radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 20%, transparent 45%)`};
`;

// ============================================
// HAKKIYOI STYLED COMPONENTS
// ============================================

/* Dark radial vignette behind the text — keeps the call grounded in the arena */
const DarkVignette = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  width: clamp(480px, 60cqw, 820px);
  height: clamp(130px, 20cqh, 230px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 1001;

  background:
    radial-gradient(
      ellipse at center,
      rgba(16, 8, 6, 0.76) 0%,
      rgba(16, 8, 6, 0.54) 30%,
      rgba(16, 8, 6, 0.18) 56%,
      transparent 78%
    ),
    radial-gradient(
      ellipse at center,
      rgba(255, 214, 102, 0.05) 0%,
      rgba(255, 214, 102, 0.02) 34%,
      transparent 58%
    );
  filter: blur(10px);

  animation: ${vignettePulse} ${(p) => p.$duration} ease-out forwards;

  @media (max-width: 900px) {
    width: clamp(360px, 54cqw, 620px);
    height: clamp(95px, 17cqh, 170px);
  }
  @media (max-width: 600px) {
    width: clamp(260px, 50cqw, 420px);
    height: clamp(72px, 13cqh, 120px);
  }
`;

/* The ceremonial gold haze used to live here as a second blurred
 * radial gradient stacked on top of DarkVignette. Two stacked blurred
 * radials sitting concentric is the canonical "AI-rendered hero shot"
 * fingerprint — it's what every templated fighting-game/3D-render
 * intro that's never been art-directed reaches for. Removed entirely;
 * the HakkiyoiBrush below the text already carries the gold band that
 * this haze was duplicating, and the warm color on the HakkiyoiText
 * is more than enough warmth in the frame without a halo around it.
 * Keeping DarkVignette alone gives the call its grounding without
 * the AI-rendered double-glow signature. */

/* Impact streaks — support the slam without reading like a reticle */
const ImpactLine = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  width: clamp(240px, 34cqw, 420px);
  height: clamp(2px, 0.25cqh, 4px);
  margin-left: calc(-0.5 * clamp(240px, 34cqw, 420px));
  margin-top: ${(p) => p.$yOffset || "0px"};
  pointer-events: none;
  z-index: 1003;
  opacity: 0;

  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 215, 0, 0.12) 12%,
    rgba(255, 215, 0, 0.6) 32%,
    #fff6d8 50%,
    rgba(255, 215, 0, 0.6) 68%,
    rgba(255, 215, 0, 0.12) 88%,
    transparent 100%
  );
  transform-origin: center center;
  animation: ${impactBurst} 0.45s ease-out forwards;
  animation-delay: ${(p) => p.$delay || "0.04s"};
  filter: blur(0.4px);

  @media (max-width: 900px) {
    width: clamp(190px, 30cqw, 320px);
    margin-left: calc(-0.5 * clamp(190px, 30cqw, 320px));
  }
  @media (max-width: 600px) {
    width: clamp(140px, 28cqw, 220px);
    margin-left: calc(-0.5 * clamp(140px, 28cqw, 220px));
  }
`;

/* Broad ceremonial brush under the call — ties it into the stage presentation */
const HakkiyoiBrush = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(22px, 3.5cqh, 44px));
  left: 50%;
  transform: translateX(-50%) rotate(-0.5deg);
  width: clamp(260px, 40cqw, 540px);
  height: clamp(8px, 1.1cqh, 15px);
  pointer-events: none;
  z-index: 1003;
  border-radius: 60% 25% 45% 50% / 80% 50% 40% 65%;
  filter: blur(0.8px);

  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 215, 0, 0.12) 7%,
    rgba(255, 215, 0, 0.42) 22%,
    rgba(255, 215, 0, 0.74) 44%,
    rgba(255, 215, 0, 0.78) 52%,
    rgba(255, 215, 0, 0.48) 72%,
    rgba(255, 215, 0, 0.14) 92%,
    transparent
  );

  animation: ${brushReveal} ${(p) => p.$duration} ease-out forwards;

  @media (max-width: 900px) {
    width: clamp(210px, 36cqw, 410px);
  }
  @media (max-width: 600px) {
    width: clamp(170px, 34cqw, 320px);
  }
`;

/* Main HAKKIYOI text — solid gold, thick outline, heavy shadows = very readable */
const HakkiyoiText = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  z-index: 1004;
  pointer-events: none;

  font-family: "Bungee", "Impact", sans-serif;
  font-size: clamp(2.2rem, 6.5cqw, 5.8rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;

  color: #ffd700;
  -webkit-text-stroke: clamp(1.5px, 0.25cqw, 3px) #3d0e0e;

  /* The gold halo glow that used to live here as the first two
   * shadows (0 0 8px gold @ 0.6, 0 0 20px gold @ 0.3) is removed.
   * Two stacked gold blur halos around bright gold text on a dark
   * vignette is the canonical AI-generated fighting-game intro
   * fingerprint — every templated render uses this exact recipe.
   * The hard sumi stencil stroke + the hard offset shadow stack
   * below it already do the broadcast-callout work; the halo was
   * pure AI-tell noise on top of it. */
  text-shadow:
    clamp(3px, 0.24cqw, 6px) clamp(3px, 0.24cqw, 6px) 0 #200404,
    5px 5px 0 rgba(20, 4, 4, 0.7),
    7px 7px 0 rgba(20, 4, 4, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.8);

  /* Sharp out-expo decel so the scale snaps to 1.0 without rebounding
     past it — the "weighted impact" curve. See slamIn keyframes
     comment for the full motion rationale. */
  animation: ${css`
      ${slamIn}`} ${(p) => p.$duration} cubic-bezier(0.16, 1, 0.3, 1)
    forwards;

  @media (max-width: 900px) {
    font-size: clamp(1.8rem, 5.6cqw, 4.2rem);
    letter-spacing: 0.08em;
  }
  @media (max-width: 600px) {
    font-size: clamp(1.4rem, 5cqw, 3rem);
    letter-spacing: 0.06em;
  }
`;

/* Japanese subtitle 八卦良い — gold, below the main text */
const HakkiyoiKanji = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(28px, 4.5cqh, 48px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1004;
  pointer-events: none;

  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-size: clamp(0.8rem, 1.7cqw, 1.4rem);
  color: rgba(244, 220, 138, 0.92);
  letter-spacing: 0.35em;
  opacity: 0;
  animation: ${fadeIO} ${(p) => p.$duration} ease-out forwards;
  animation-delay: 0.14s;

  text-shadow:
    0 0 10px rgba(212, 175, 55, 0.22),
    1px 1px 2px rgba(0, 0, 0, 0.9);

  @media (max-width: 600px) {
    font-size: clamp(0.65rem, 1.5cqw, 1rem);
    letter-spacing: 0.25em;
    top: calc(${ANNOUNCE_Y} + clamp(22px, 3.5cqh, 38px));
  }
`;

/* Sumi-ink flecks beside the brushstroke.
 *
 * Replaces the previous "5 floating ice crystals that drift up, rotate,
 * and fade out" particle system. That particle system was THE textbook
 * AI-UI fighting-game fingerprint — floating motes that radiate from
 * text on impact. Every AI-generated fighting game intro has them, and
 * they pull the design straight into the "generic templated render"
 * category the rest of this game's UI works hard to stay out of.
 *
 * What we want instead: the brush already exists below the text as a
 * hand-painted gold band. A real hand-painted brushstroke flicks small
 * ink flecks at its endpoints — that's a physical fact of bristle on
 * paper, not a stylization. So we add two anchored gold flecks that
 * APPEAR (clip-reveal in) at the brush endpoints, settle, and fade
 * with the call. They never drift, never rotate, never animate after
 * landing. Hand-made, not particle-system. Two flecks total — anything
 * more starts to look intentional in the wrong way. */
const InkFleck = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(20px, 3.3cqh, 42px));
  left: 50%;
  pointer-events: none;
  z-index: 1003;
  width: ${(p) => p.$size};
  height: calc(${(p) => p.$size} * 0.55);
  /* Irregular blob shape via asymmetric border-radius — the same
     technique HakkiyoiBrush uses to read as a hand-painted shape
     rather than a div. Mirrored per side via two corner sets. */
  border-radius: ${(p) =>
    p.$side === "left"
      ? "60% 20% 50% 80% / 70% 30% 60% 40%"
      : "20% 60% 80% 40% / 30% 70% 40% 60%"};
  margin-left: ${(p) => p.$offsetX};
  background: rgba(255, 215, 0, ${(p) => p.$alpha});
  filter: blur(0.5px);

  /* Brush-reveal in, settle, brush-reveal out — same beat as the
     HakkiyoiBrush itself so the flecks read as part of the same
     brushstroke event. */
  animation: ${brushReveal} ${(p) => p.$duration} ease-out forwards;
  animation-delay: ${(p) => p.$delay};
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

  font-family: "Bungee", "Impact", sans-serif;
  font-size: clamp(1.65rem, 5cqw, 4.4rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;

  color: #ffffff;
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
    rgba(255, 255, 255, 0.1) 15%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0.1) 85%,
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

/* Japanese subtitle 手を付いて below HANDS DOWN */
const TeWoKanji = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(24px, 4cqh, 46px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1004;
  pointer-events: none;

  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-size: clamp(0.65rem, 1.3cqw, 1.05rem);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.3em;
  opacity: 0;
  animation: ${fadeIO} ${(p) => p.$duration} ease-out forwards;
  animation-delay: 0.1s;

  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9);

  @media (max-width: 600px) {
    font-size: clamp(0.55rem, 1.1cqw, 0.8rem);
    top: calc(${ANNOUNCE_Y} + clamp(20px, 3.2cqh, 36px));
  }
`;

// ============================================
// COMPONENT
// ============================================

const SumoGameAnnouncement = ({ type = "hakkiyoi", duration = null }) => {
  const actualDuration = duration || (type === "hakkiyoi" ? 1.8 : 2);
  const durationStr = `${actualDuration}s`;

  // Impact line angles (HAKKIYOI)
  const impactLines = useMemo(
    () => [
      { rotation: -8, delay: "0.04s", yOffset: "clamp(-4px, -0.45cqh, -7px)" },
      { rotation: 8, delay: "0.08s", yOffset: "clamp(4px, 0.45cqh, 7px)" },
      { rotation: 0, delay: "0.12s", yOffset: "clamp(16px, 2.2cqh, 26px)" },
    ],
    [],
  );

  // ─── HAKKIYOI ───
  if (type === "hakkiyoi") {
    return (
      <>
        <ScreenFlash $type="hakkiyoi" />

        <DarkVignette $duration={durationStr} />
        {impactLines.map((line, i) => (
          <ImpactLine
            key={i}
            $delay={line.delay}
            $yOffset={line.yOffset}
            style={{ transform: `rotate(${line.rotation}deg)` }}
          />
        ))}

        <HakkiyoiText $duration={durationStr}>HAKKI-YOI !</HakkiyoiText>
        <HakkiyoiBrush $duration={durationStr} />
        <HakkiyoiKanji $duration={durationStr}>八卦良い</HakkiyoiKanji>

        {/* Two anchored gold ink flecks at the brush endpoints. See
            InkFleck comment for why this replaced the ice-crystal
            particle system. Positions deliberately asymmetric — a
            real brushstroke doesn't flick evenly. */}
        <InkFleck
          $side="left"
          $size="clamp(7px, 1.05cqw, 13px)"
          $offsetX="clamp(-180px, -22cqw, -130px)"
          $alpha={0.55}
          $duration={durationStr}
          $delay="0.08s"
        />
        <InkFleck
          $side="right"
          $size="clamp(5px, 0.85cqw, 10px)"
          $offsetX="clamp(130px, 22cqw, 180px)"
          $alpha={0.42}
          $duration={durationStr}
          $delay="0.14s"
        />
      </>
    );
  }

  // ─── TE WO TSUITE ───
  return (
    <>
      <ScreenFlash $type="tewotsuite" />
      <TeWoTsuiteText $duration={durationStr}>HANDS DOWN !</TeWoTsuiteText>
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
