import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useMemo } from "react";

// ============================================
// SHARED Y-POSITION (both announcements live here — below the HUD)
// ============================================
const ANNOUNCE_Y = "clamp(120px, 32%, 220px)";

// ============================================
// ANIMATIONS
// ============================================

// ── HAKKIYOI: explosive slam entrance ──
const slamIn = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(2.8) rotate(-5deg); }
  10%  { opacity: 1; transform: translate(-50%, -50%) scale(0.88) rotate(2deg); }
  18%  { transform: translate(-50%, -50%) scale(1.14) rotate(-1deg); }
  26%  { transform: translate(-50%, -50%) scale(0.96) rotate(0.5deg); }
  34%  { transform: translate(-50%, -50%) scale(1.03) rotate(0deg); }
  44%  { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  78%  { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1) rotate(0deg); }
`;

// ── TE WO TSUITE: quiet slide-in ──
const slideIn = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); clip-path: inset(0 100% 0 0); }
  22%  { opacity: 1; transform: translate(-50%, -50%) scale(1.05); clip-path: inset(0 0% 0 0); }
  32%  { transform: translate(-50%, -50%) scale(0.98); }
  42%  { transform: translate(-50%, -50%) scale(1); }
  78%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
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

// ── Shockwave ring ──
const shockwaveExpand = keyframes`
  0%   { transform: translate(-50%, -50%) scale(0.12); opacity: 0.8; border-width: 5px; }
  50%  { transform: translate(-50%, -50%) scale(1.3); opacity: 0.3; border-width: 2px; }
  100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; border-width: 1px; }
`;

// ── Impact line burst ──
const impactBurst = keyframes`
  0%   { transform: scaleX(0); opacity: 0; }
  14%  { transform: scaleX(1); opacity: 0.9; }
  55%  { transform: scaleX(1); opacity: 0.5; }
  100% { transform: scaleX(1.2); opacity: 0; }
`;

// ── Gold rule extends from center ──
const ruleExtend = keyframes`
  0%   { transform: translateX(-50%) scaleX(0); opacity: 0; }
  15%  { transform: translateX(-50%) scaleX(1.05); opacity: 1; }
  22%  { transform: translateX(-50%) scaleX(0.97); }
  30%  { transform: translateX(-50%) scaleX(1); }
  78%  { opacity: 1; transform: translateX(-50%) scaleX(1); }
  100% { opacity: 0; transform: translateX(-50%) scaleX(1); }
`;

// ── Fade in then out ──
const fadeIO = keyframes`
  0%   { opacity: 0; }
  16%  { opacity: 0; }
  28%  { opacity: 1; }
  75%  { opacity: 1; }
  100% { opacity: 0; }
`;

// ── Ice crystal float ──
const crystalDrift = keyframes`
  0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.9; }
  50%  { opacity: 0.6; }
  100% { transform: translateY(-70px) rotate(50deg) scale(0.15); opacity: 0; }
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
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 1000;
  animation: ${screenFlash} 0.65s ease-out forwards;

  background: ${p => p.$type === "hakkiyoi"
    ? `radial-gradient(ellipse at 50% 25%, rgba(255,215,0,0.5) 0%, rgba(255,200,50,0.2) 25%, transparent 55%)`
    : `radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 20%, transparent 45%)`
  };
`;

// ============================================
// HAKKIYOI STYLED COMPONENTS
// ============================================

/* Dark radial vignette behind the text — gives contrast without a boxy banner */
const DarkVignette = styled.div`
  position: fixed;
  top: ${ANNOUNCE_Y};
  left: 50%;
  width: clamp(420px, 55cqw, 700px);
  height: clamp(110px, 16cqh, 180px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 1001;

  background: radial-gradient(
    ellipse at center,
    rgba(15, 5, 5, 0.82) 0%,
    rgba(15, 5, 5, 0.6) 30%,
    rgba(15, 5, 5, 0.25) 55%,
    transparent 75%
  );
  filter: blur(6px);

  animation: ${vignettePulse} ${p => p.$duration} ease-out forwards;

  @media (max-width: 900px) {
    width: clamp(320px, 50cqw, 520px);
    height: clamp(80px, 14cqh, 140px);
  }
  @media (max-width: 600px) {
    width: clamp(240px, 48cqw, 380px);
    height: clamp(60px, 12cqh, 110px);
  }
`;

/* Shockwave ring — gold */
const Shockwave = styled.div`
  position: fixed;
  top: ${ANNOUNCE_Y};
  left: 50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 4px solid rgba(255, 215, 0, 0.7);
  background: transparent;
  pointer-events: none;
  z-index: 1002;
  animation: ${shockwaveExpand} 0.5s ease-out forwards;

  @media (max-width: 900px) { width: 150px; height: 150px; }
  @media (max-width: 600px) { width: 100px; height: 100px; }
`;

/* Impact lines — gold, radiating from the text center */
const ImpactLine = styled.div`
  position: fixed;
  top: ${ANNOUNCE_Y};
  left: 50%;
  width: 340px;
  height: 2px;
  margin-left: -170px;
  margin-top: -1px;
  pointer-events: none;
  z-index: 1001;
  opacity: 0;

  background: linear-gradient(
    90deg,
    transparent 0%, rgba(255,215,0,0.7) 20%, #FFFAF0 50%, rgba(255,215,0,0.7) 80%, transparent 100%
  );
  transform-origin: center center;
  animation: ${impactBurst} 0.45s ease-out forwards;
  animation-delay: ${p => p.$delay || "0.04s"};

  @media (max-width: 900px) { width: 250px; margin-left: -125px; }
  @media (max-width: 600px) { width: 170px; margin-left: -85px; }
`;

/* Main HAKKIYOI text — solid gold, thick outline, heavy shadows = very readable */
const HakkiyoiText = styled.div`
  position: fixed;
  top: ${ANNOUNCE_Y};
  left: 50%;
  z-index: 1004;
  pointer-events: none;

  font-family: "Bungee", cursive;
  font-size: clamp(2.4rem, 7cqw, 6rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;

  /* Solid gold — no background-clip tricks, fully readable */
  color: #FFD700;
  -webkit-text-stroke: clamp(1.5px, 0.25cqw, 3px) #3d0e0e;

  text-shadow:
    0 0 8px rgba(255, 215, 0, 0.6),
    0 0 20px rgba(255, 180, 0, 0.3),
    clamp(3px, 0.24cqw, 6px) clamp(3px, 0.24cqw, 6px) 0 #200404,
    5px 5px 0 rgba(20, 4, 4, 0.7),
    7px 7px 0 rgba(20, 4, 4, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.8);

  animation: ${css`${slamIn}`} ${p => p.$duration} cubic-bezier(0.22, 0.61, 0.36, 1) forwards;

  @media (max-width: 900px) {
    font-size: clamp(1.8rem, 6cqw, 4.2rem);
    letter-spacing: 0.1em;
  }
  @media (max-width: 600px) {
    font-size: clamp(1.4rem, 5.5cqw, 3rem);
    letter-spacing: 0.08em;
  }
`;

/* Japanese subtitle 八卦良い — gold, below the main text */
const HakkiyoiKanji = styled.div`
  position: fixed;
  top: calc(${ANNOUNCE_Y} + clamp(28px, 4.5cqh, 48px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1004;
  pointer-events: none;

  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-size: clamp(0.85rem, 1.8cqw, 1.5rem);
  color: #d4af37;
  letter-spacing: 0.35em;
  opacity: 0;
  animation: ${fadeIO} ${p => p.$duration} ease-out forwards;
  animation-delay: 0.1s;

  text-shadow:
    0 0 6px rgba(212, 175, 55, 0.3),
    1px 1px 2px rgba(0, 0, 0, 0.9);

  @media (max-width: 600px) {
    font-size: clamp(0.65rem, 1.5cqw, 1rem);
    letter-spacing: 0.25em;
    top: calc(${ANNOUNCE_Y} + clamp(22px, 3.5cqh, 38px));
  }
`;

/* Gold ornamental rules — extend horizontally from the text */
const GoldRule = styled.div`
  position: fixed;
  top: ${ANNOUNCE_Y};
  left: 50%;
  height: 2.5px;
  pointer-events: none;
  z-index: 1003;
  transform-origin: center center;

  width: clamp(350px, 50cqw, 600px);
  margin-top: ${p => p.$offset || "0px"};

  background: linear-gradient(
    90deg,
    transparent 0%,
    #6b4c12 8%,
    #c9a22e 20%,
    #ffe87a 50%,
    #c9a22e 80%,
    #6b4c12 92%,
    transparent 100%
  );

  animation: ${ruleExtend} ${p => p.$duration} ease-out forwards;
  animation-delay: 0.06s;

  @media (max-width: 900px) { width: clamp(260px, 45cqw, 450px); }
  @media (max-width: 600px) { width: clamp(190px, 42cqw, 320px); height: 2px; }
`;

/* Small gold diamond accent */
const Diamond = styled.div`
  position: fixed;
  top: ${ANNOUNCE_Y};
  z-index: 1004;
  pointer-events: none;
  width: clamp(7px, 0.7cqw, 10px);
  height: clamp(7px, 0.7cqw, 10px);
  background: linear-gradient(135deg, #d4af37, #FFD700, #b8860b);
  transform: rotate(45deg);
  margin-top: clamp(-4px, -0.35cqw, -5px);
  opacity: 0;
  animation: ${fadeIO} ${p => p.$duration} ease-out forwards;
  animation-delay: 0.12s;
  box-shadow: 0 0 5px rgba(255, 215, 0, 0.4);

  ${p => p.$side === "left" && `left: calc(50% - clamp(180px, 26cqw, 310px));`}
  ${p => p.$side === "right" && `left: calc(50% + clamp(172px, 25.3cqw, 300px));`}

  @media (max-width: 900px) {
    ${p => p.$side === "left" && `left: calc(50% - clamp(135px, 23cqw, 235px));`}
    ${p => p.$side === "right" && `left: calc(50% + clamp(127px, 22.3cqw, 225px));`}
  }
  @media (max-width: 600px) {
    ${p => p.$side === "left" && `left: calc(50% - clamp(100px, 22cqw, 170px));`}
    ${p => p.$side === "right" && `left: calc(50% + clamp(92px, 21cqw, 160px));`}
  }
`;

/* Ice crystal particle */
const IceCrystal = styled.div`
  position: fixed;
  top: ${ANNOUNCE_Y};
  pointer-events: none;
  z-index: 1005;
  width: ${p => p.$size || "5px"};
  height: ${p => p.$size || "5px"};
  border-radius: 2px;
  transform: rotate(45deg);
  left: ${p => p.$x || "50%"};
  margin-top: ${p => p.$yOff || "0px"};
  opacity: 0;

  background: radial-gradient(circle, #e0f2fe 0%, #38bdf8 50%, #0284c7 100%);
  box-shadow: 0 0 4px rgba(56, 189, 248, 0.5);

  animation: ${crystalDrift} ${p => p.$dur || "1.2s"} ease-out forwards;
  animation-delay: ${p => p.$delay || "0.15s"};
`;

// ============================================
// TE WO TSUITE STYLED COMPONENTS
// ============================================

/* TE WO TSUITE text — smaller, clean white, subtle */
const TeWoTsuiteText = styled.div`
  position: fixed;
  top: ${ANNOUNCE_Y};
  left: 50%;
  z-index: 1004;
  pointer-events: none;

  font-family: "Bungee", cursive;
  font-size: clamp(1.3rem, 3.8cqw, 3rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  white-space: nowrap;

  color: #FFFFFF;
  -webkit-text-stroke: clamp(1px, 0.15cqw, 2px) rgba(0, 0, 0, 0.8);

  text-shadow:
    clamp(-4px, -0.15cqw, -2px) clamp(-4px, -0.15cqw, -2px) 0 #000,
    clamp(2px, 0.15cqw, 4px) clamp(-4px, -0.15cqw, -2px) 0 #000,
    clamp(-4px, -0.15cqw, -2px) clamp(2px, 0.15cqw, 4px) 0 #000,
    clamp(2px, 0.15cqw, 4px) clamp(2px, 0.15cqw, 4px) 0 #000,
    0 0 clamp(8px, 0.8cqw, 16px) rgba(0, 0, 0, 0.7),
    0 0 clamp(16px, 1.6cqw, 32px) rgba(0, 0, 0, 0.3);

  animation: ${css`${slideIn}`} ${p => p.$duration} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;

  @media (max-width: 900px) {
    font-size: clamp(1rem, 3.2cqw, 2.2rem);
    letter-spacing: 0.14em;
  }
  @media (max-width: 600px) {
    font-size: clamp(0.85rem, 2.8cqw, 1.7rem);
    letter-spacing: 0.1em;
  }
`;

/* Subtle brush stroke under TE WO TSUITE */
const TeWoBrush = styled.div`
  position: fixed;
  top: calc(${ANNOUNCE_Y} + clamp(16px, 2.5cqh, 28px));
  left: 50%;
  transform: translateX(-50%);
  width: clamp(200px, 32cqw, 380px);
  height: clamp(10px, 1.5cqh, 18px);
  z-index: 1003;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(1px);

  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.1) 15%,
    rgba(255,255,255,0.2) 50%,
    rgba(255,255,255,0.1) 85%,
    transparent 100%
  );

  animation: ${brushReveal} ${p => p.$duration} ease-out forwards;

  @media (max-width: 900px) {
    width: clamp(160px, 28cqw, 290px);
    top: calc(${ANNOUNCE_Y} + clamp(12px, 2cqh, 22px));
  }
  @media (max-width: 600px) {
    width: clamp(120px, 26cqw, 210px);
    top: calc(${ANNOUNCE_Y} + clamp(10px, 1.8cqh, 18px));
  }
`;

/* Japanese subtitle for TE WO TSUITE — very faint */
const TeWoKanji = styled.div`
  position: fixed;
  top: calc(${ANNOUNCE_Y} + clamp(18px, 3cqh, 32px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1004;
  pointer-events: none;

  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-size: clamp(0.65rem, 1.3cqw, 1rem);
  color: rgba(255, 255, 255, 0.65);
  letter-spacing: 0.3em;
  opacity: 0;
  animation: ${fadeIO} ${p => p.$duration} ease-out forwards;
  animation-delay: 0.1s;

  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);

  @media (max-width: 600px) {
    font-size: clamp(0.55rem, 1.1cqw, 0.8rem);
    top: calc(${ANNOUNCE_Y} + clamp(14px, 2.5cqh, 24px));
  }
`;

// ============================================
// COMPONENT
// ============================================

const SumoGameAnnouncement = ({
  type = "hakkiyoi",
  duration = null,
}) => {
  const actualDuration = duration || (type === "hakkiyoi" ? 1.8 : 2);
  const durationStr = `${actualDuration}s`;

  // Impact line angles (HAKKIYOI)
  const impactLines = useMemo(() => [
    { rotation: 0, delay: "0.03s" },
    { rotation: 45, delay: "0.06s" },
    { rotation: 90, delay: "0.09s" },
    { rotation: 135, delay: "0.12s" },
  ], []);

  // Ice crystal particles (HAKKIYOI)
  const crystals = useMemo(() => [
    { id: 0, x: "calc(50% - 80px)", yOff: "10px",  size: "5px", delay: "0.18s", dur: "1.1s" },
    { id: 1, x: "calc(50% - 35px)", yOff: "-5px",  size: "6px", delay: "0.24s", dur: "1.3s" },
    { id: 2, x: "50%",              yOff: "12px",   size: "4px", delay: "0.14s", dur: "1.0s" },
    { id: 3, x: "calc(50% + 40px)", yOff: "-3px",   size: "6px", delay: "0.28s", dur: "1.2s" },
    { id: 4, x: "calc(50% + 85px)", yOff: "8px",    size: "5px", delay: "0.20s", dur: "1.35s" },
  ], []);

  // ─── HAKKIYOI ───
  if (type === "hakkiyoi") {
    return (
      <>
        <ScreenFlash $type="hakkiyoi" />

        {/* Dark vignette behind text for contrast */}
        <DarkVignette $duration={durationStr} />

        {/* Shockwave ring */}
        <Shockwave />

        {/* Impact lines */}
        {impactLines.map((line, i) => (
          <ImpactLine
            key={i}
            $delay={line.delay}
            style={{ transform: `rotate(${line.rotation}deg)` }}
          />
        ))}

        {/* Gold ornamental rules above & below text */}
        <GoldRule $duration={durationStr} $offset="clamp(-24px, -3.5cqh, -40px)" />
        <GoldRule $duration={durationStr} $offset="clamp(20px, 3cqh, 34px)" />

        {/* Diamond accents at rule ends */}
        <Diamond $side="left" $duration={durationStr} />
        <Diamond $side="right" $duration={durationStr} />

        {/* Main text */}
        <HakkiyoiText $duration={durationStr}>HAKKI-YOI !</HakkiyoiText>

        {/* Japanese subtitle */}
        <HakkiyoiKanji $duration={durationStr}>八卦良い</HakkiyoiKanji>

        {/* Ice crystals */}
        {crystals.map((c) => (
          <IceCrystal
            key={c.id}
            $x={c.x}
            $yOff={c.yOff}
            $size={c.size}
            $delay={c.delay}
            $dur={c.dur}
          />
        ))}
      </>
    );
  }

  // ─── TE WO TSUITE ───
  return (
    <>
      <ScreenFlash $type="tewotsuite" />
      <TeWoTsuiteText $duration={durationStr}>TE WO TSUITE !</TeWoTsuiteText>
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
