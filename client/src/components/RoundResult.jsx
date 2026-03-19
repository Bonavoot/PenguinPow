        import React, { memo, useMemo } from "react";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";

const ANNOUNCE_Y = "clamp(120px, 32cqh, 220px)";

const WIN_TYPE_CONFIG = {
  slap: { english: "THRUST OUT !", japanese: "突き出し" },
  charged: { english: "PUSH OUT !", japanese: "押し出し" },
  cinematicKill: { english: "DEMOLISHED !", japanese: "破壊された" },
  grabPush: { english: "FORCE OUT !", japanese: "寄り切り" },
  grabThrow: { english: "OVERARM THROW !", japanese: "上手投げ" },
  okuridashi: { english: "REAR PUSH OUT!", japanese: "送り出し" },
  snowball: { english: "RING OUT !", japanese: "場外" },
  pumoClone: { english: "RING OUT !", japanese: "場外" },
  ringOut: { english: "RING OUT !", japanese: "場外" },
};

// ============================================
// ANIMATIONS
// ============================================

const screenFlash = keyframes`
  0%   { opacity: 0; }
  6%   { opacity: 0.45; }
  16%  { opacity: 0.18; }
  30%  { opacity: 0.06; }
  100% { opacity: 0; }
`;

const hazePulse = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  12%  { opacity: 0.75; transform: translate(-50%, -50%) scale(1.05); }
  22%  { transform: translate(-50%, -50%) scale(1); }
  78%  { opacity: 0.75; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
`;

const textDrop = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) translateY(-180%) scaleY(1.2) scaleX(0.92); }
  5%   { opacity: 0; }
  14%  { opacity: 1; transform: translate(-50%, -50%) translateY(6%) scaleY(0.82) scaleX(1.12); }
  22%  { transform: translate(-50%, -50%) translateY(-4%) scaleY(1.06) scaleX(0.97); }
  30%  { transform: translate(-50%, -50%) translateY(2%) scaleY(0.97) scaleX(1.02); }
  38%  { transform: translate(-50%, -50%) translateY(-1%) scaleY(1.01) scaleX(1); }
  46%  { transform: translate(-50%, -50%) translateY(0%) scaleY(1) scaleX(1); }
  78%  { opacity: 1; transform: translate(-50%, -50%) scaleY(1) scaleX(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scaleY(0.97) scaleX(1.02); }
`;

const brushPaint = keyframes`
  0%   { clip-path: inset(0 100% 0 0); opacity: 0; }
  8%   { opacity: 0; }
  14%  { opacity: 1; }
  30%  { clip-path: inset(0 0% 0 0); }
  78%  { clip-path: inset(0 0% 0 0); opacity: 1; }
  100% { clip-path: inset(0 0% 0 0); opacity: 0; }
`;

const splashAppear = keyframes`
  0%   { opacity: 0; transform: rotate(15deg) scale(0.3); }
  26%  { opacity: 0; transform: rotate(15deg) scale(0.3); }
  34%  { opacity: 0.65; transform: rotate(15deg) scale(1.1); }
  42%  { opacity: 0.5; transform: rotate(15deg) scale(1); }
  78%  { opacity: 0.5; }
  100% { opacity: 0; }
`;

const subtitleTrack = keyframes`
  0%   { opacity: 0; letter-spacing: 0.8em; }
  24%  { opacity: 0; letter-spacing: 0.8em; }
  42%  { opacity: 1; letter-spacing: 0.3em; }
  78%  { opacity: 1; letter-spacing: 0.3em; }
  100% { opacity: 0; letter-spacing: 0.25em; }
`;

const shardFly = keyframes`
  0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
  14%  { opacity: 0; }
  20%  { opacity: 0.8; transform: translate(0, 0) scale(1); }
  70%  { opacity: 0.2; }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.1) rotate(var(--rot)); }
`;

// ============================================
// STYLED COMPONENTS
// ============================================

const ScreenFlash = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  animation: ${screenFlash} 0.6s ease-out forwards;
  background: ${(p) =>
    p.$isVictory
      ? "radial-gradient(ellipse at 50% 25%, rgba(255,230,180,0.5) 0%, rgba(255,210,120,0.2) 28%, transparent 55%)"
      : "radial-gradient(ellipse at 50% 25%, rgba(0,0,0,0.4) 0%, rgba(10,10,20,0.2) 30%, transparent 55%)"};
`;

const ContrastHaze = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  width: clamp(440px, 58cqw, 720px);
  height: clamp(120px, 18cqh, 200px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 1001;

  background: ${(p) =>
    p.$isVictory
      ? `radial-gradient(
        ellipse at center,
        rgba(18, 12, 5, 0.6) 0%,
        rgba(12, 8, 3, 0.38) 28%,
        rgba(6, 4, 2, 0.14) 55%,
        transparent 78%
      )`
      : `radial-gradient(
        ellipse at center,
        rgba(5, 5, 14, 0.6) 0%,
        rgba(4, 4, 10, 0.38) 28%,
        rgba(2, 2, 6, 0.14) 55%,
        transparent 78%
      )`};
  filter: blur(8px);

  animation: ${hazePulse} 3s ease-out forwards;

  @media (max-width: 900px) {
    width: clamp(340px, 55cqw, 580px);
    height: clamp(100px, 16cqh, 170px);
  }
  @media (max-width: 600px) {
    width: clamp(280px, 58cqw, 440px);
    height: clamp(85px, 15cqh, 145px);
  }
`;

const MainText = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  z-index: 1005;
  pointer-events: none;

  font-family: "Bungee", "Impact", sans-serif;
  font-size: clamp(2.2rem, 6.5cqw, 5.8rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;

  color: #ffffff;
  -webkit-text-stroke: ${(p) =>
    p.$isVictory
      ? "clamp(1.5px, 0.22cqw, 3px) #1a1008"
      : "clamp(1.5px, 0.22cqw, 3px) #0c0c18"};

  text-shadow: ${(p) =>
    p.$isVictory
      ? `
      clamp(2px, 0.18cqw, 4px) clamp(2px, 0.18cqw, 4px) 0 #1a0e06,
      clamp(4px, 0.35cqw, 7px) clamp(4px, 0.35cqw, 7px) 0 rgba(18,10,4,0.8),
      clamp(6px, 0.5cqw, 10px) clamp(6px, 0.5cqw, 10px) 0 rgba(12,6,2,0.5),
      clamp(8px, 0.65cqw, 13px) clamp(8px, 0.65cqw, 13px) 0 rgba(8,4,1,0.25),
      0 clamp(3px, 0.3cqw, 6px) clamp(12px, 1cqw, 22px) rgba(0,0,0,0.7)
    `
      : `
      clamp(2px, 0.18cqw, 4px) clamp(2px, 0.18cqw, 4px) 0 #0e0e1a,
      clamp(4px, 0.35cqw, 7px) clamp(4px, 0.35cqw, 7px) 0 rgba(10,10,22,0.8),
      clamp(6px, 0.5cqw, 10px) clamp(6px, 0.5cqw, 10px) 0 rgba(5,5,15,0.5),
      clamp(8px, 0.65cqw, 13px) clamp(8px, 0.65cqw, 13px) 0 rgba(2,2,10,0.25),
      0 clamp(3px, 0.3cqw, 6px) clamp(12px, 1cqw, 22px) rgba(0,0,0,0.7)
    `};

  animation: ${css`
      ${textDrop}`} 3s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  will-change: transform, opacity;

  @media (max-width: 900px) {
    font-size: clamp(1.8rem, 5.6cqw, 4.2rem);
    letter-spacing: 0.08em;
  }
  @media (max-width: 600px) {
    font-size: clamp(1.4rem, 5cqw, 3rem);
    letter-spacing: 0.06em;
  }
`;

const BrushStroke = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(22px, 3.5cqh, 48px));
  left: 50%;
  transform: translateX(-50%) rotate(-0.8deg);
  width: clamp(240px, 38cqw, 480px);
  height: clamp(7px, 1cqh, 14px);
  pointer-events: none;
  z-index: 1004;
  border-radius: 60% 25% 45% 50% / 80% 50% 40% 65%;
  filter: blur(0.5px);

  background: ${(p) =>
    p.$isVictory
      ? `linear-gradient(90deg,
        transparent,
        rgba(255,215,0,0.2) 5%,
        rgba(255,215,0,0.55) 16%,
        rgba(255,215,0,0.8) 38%,
        rgba(255,215,0,0.85) 52%,
        rgba(255,215,0,0.6) 72%,
        rgba(255,215,0,0.3) 90%,
        transparent)`
      : `linear-gradient(90deg,
        transparent,
        rgba(180,40,40,0.18) 5%,
        rgba(200,50,50,0.45) 16%,
        rgba(210,55,55,0.7) 38%,
        rgba(210,55,55,0.75) 52%,
        rgba(200,50,50,0.5) 72%,
        rgba(180,40,40,0.22) 90%,
        transparent)`};

  animation: ${brushPaint} 3s ease-out forwards;

  @media (max-width: 900px) {
    width: clamp(200px, 35cqw, 380px);
  }
  @media (max-width: 600px) {
    width: clamp(160px, 34cqw, 300px);
  }
`;

const BrushSplash = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(24px, 3.8cqh, 50px));
  left: calc(50% + clamp(100px, 16cqw, 200px));
  width: clamp(10px, 1.5cqw, 20px);
  height: clamp(4px, 0.5cqh, 7px);
  pointer-events: none;
  z-index: 1004;
  border-radius: 50% 30% 45% 55% / 60% 40% 55% 45%;

  background: ${(p) =>
    p.$isVictory ? "rgba(255,215,0,0.5)" : "rgba(200,50,50,0.4)"};

  animation: ${splashAppear} 3s ease-out forwards;

  @media (max-width: 900px) {
    left: calc(50% + clamp(80px, 14cqw, 160px));
  }
  @media (max-width: 600px) {
    left: calc(50% + clamp(65px, 14cqw, 125px));
  }
`;

const KimariteText = styled.div`
  position: absolute;
  top: calc(${ANNOUNCE_Y} + clamp(36px, 5.5cqh, 68px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1005;
  pointer-events: none;

  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-size: clamp(0.8rem, 1.7cqw, 1.4rem);
  font-weight: 700;
  color: ${(p) => (p.$isVictory ? "#F5E6C8" : "#D0D4DE")};
  letter-spacing: 0.3em;

  text-shadow: ${(p) =>
    p.$isVictory
      ? "1px 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(255,220,140,0.12)"
      : "1px 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(160,170,200,0.1)"};

  animation: ${subtitleTrack} 3s ease-out forwards;

  @media (max-width: 600px) {
    font-size: clamp(0.65rem, 1.4cqw, 1rem);
    top: calc(${ANNOUNCE_Y} + clamp(30px, 4.5cqh, 56px));
  }
`;

const Shard = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: ${(p) => p.$x};
  margin-top: ${(p) => p.$yOff};
  z-index: 1006;
  pointer-events: none;
  width: ${(p) => p.$size};
  height: ${(p) => p.$size};
  border-radius: 1px;

  background: ${(p) =>
    p.$isVictory
      ? "linear-gradient(135deg, #FFFAD0, #FFD700)"
      : "linear-gradient(135deg, #E8E4E0, #9A9590)"};
  box-shadow: 0 0 3px
    ${(p) => (p.$isVictory ? "rgba(255,215,0,0.4)" : "rgba(160,155,150,0.35)")};

  --tx: ${(p) => p.$tx};
  --ty: ${(p) => p.$ty};
  --rot: ${(p) => p.$rot};

  animation: ${shardFly} ${(p) => p.$dur} ease-out forwards;
`;

// ============================================
// COMPONENT
// ============================================

const RoundResult = ({ isVictory, winType }) => {
  const config = WIN_TYPE_CONFIG[winType] || WIN_TYPE_CONFIG.ringOut;
  const hasKimarite = !!config.japanese;

  const shards = useMemo(
    () => [
      {
        id: 0,
        x: "calc(50% - 95px)",
        yOff: "-8px",
        size: "5px",
        tx: "-55px",
        ty: "-40px",
        rot: "120deg",
        dur: "1.9s",
      },
      {
        id: 1,
        x: "calc(50% - 45px)",
        yOff: "10px",
        size: "4px",
        tx: "-35px",
        ty: "42px",
        rot: "-95deg",
        dur: "1.6s",
      },
      {
        id: 2,
        x: "calc(50% + 8px)",
        yOff: "-14px",
        size: "6px",
        tx: "12px",
        ty: "-48px",
        rot: "175deg",
        dur: "2.1s",
      },
      {
        id: 3,
        x: "calc(50% + 55px)",
        yOff: "6px",
        size: "4px",
        tx: "42px",
        ty: "38px",
        rot: "55deg",
        dur: "1.7s",
      },
      {
        id: 4,
        x: "calc(50% + 105px)",
        yOff: "-5px",
        size: "5px",
        tx: "58px",
        ty: "-32px",
        rot: "-145deg",
        dur: "2s",
      },
      {
        id: 5,
        x: "calc(50% - 72px)",
        yOff: "14px",
        size: "3px",
        tx: "-48px",
        ty: "28px",
        rot: "40deg",
        dur: "1.5s",
      },
    ],
    [],
  );

  return (
    <>
      <ScreenFlash $isVictory={isVictory} />
      <ContrastHaze $isVictory={isVictory} />

      <MainText $isVictory={isVictory}>{config.english}</MainText>

      <BrushStroke $isVictory={isVictory} />
      <BrushSplash $isVictory={isVictory} />

      {hasKimarite && (
        <KimariteText $isVictory={isVictory}>{config.japanese}</KimariteText>
      )}

      {shards.map((s) => (
        <Shard
          key={s.id}
          $isVictory={isVictory}
          $x={s.x}
          $yOff={s.yOff}
          $size={s.size}
          $tx={s.tx}
          $ty={s.ty}
          $rot={s.rot}
          $dur={s.dur}
        />
      ))}
    </>
  );
};

RoundResult.propTypes = {
  isVictory: PropTypes.bool.isRequired,
  winType: PropTypes.string,
};

export default memo(RoundResult);
