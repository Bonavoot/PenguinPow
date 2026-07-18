import React, { memo } from "react";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { ANNOUNCE_Y } from "./SumoGameAnnouncement";

const WIN_TYPE_CONFIG = {
  slap: { english: "THRUST OUT!", japanese: "突き出し" },
  charged: { english: "PUSH OUT!", japanese: "押し出し" },
  cinematicKill: { english: "DEMOLISHED!", japanese: "破壊された" },
  grabPush: { english: "FORCE OUT!", japanese: "寄り切り" },
  grabThrow: { english: "OVERARM THROW!", japanese: "上手投げ" },
  clinchKillThrow: { english: "CRUSHING THROW!", japanese: "掛け投げ" },
  clinchKillPull: { english: "PULL DOWN!", japanese: "引き落とし" },
  okuridashi: { english: "REAR PUSH OUT!", japanese: "送り出し" },
  flap: { english: "BODY SLAM!", japanese: "浴びせ倒し" },
  snowball: { english: "RING OUT!", japanese: "場外" },
  pumoClone: { english: "RING OUT!", japanese: "場外" },
  ringOut: { english: "RING OUT!", japanese: "場外" },
};

/**
 * Look up the kimarite (winning-move) label for a winType. Shared with the
 * BASHO results strip so the post-run summary can name each day's finish.
 * Falls back to the generic ring-out call for unknown/missing types.
 */
export function kimariteFor(winType) {
  return WIN_TYPE_CONFIG[winType] || WIN_TYPE_CONFIG.ringOut;
}

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

/* Hanko stamp — anchored on the English line only (same Y center as
 * HAKKI-YOI / HANDS DOWN). Brush + kanji hang below and must NOT be
 * included in the centered box, or the hero text rides too high. */
const stackStamp = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.35) rotate(-1.5deg); }
  10%  { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  78%  { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
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

/* Sized by MainText only so translate(-50%, -50%) lands on the same
 * band as HAKKI-YOI / HANDS DOWN. Support layers hang below. */
const CalloutAnchor = styled.div`
  position: absolute;
  top: ${ANNOUNCE_Y};
  left: 50%;
  z-index: 1005;
  pointer-events: none;
  max-width: 92cqw;

  animation: ${css`
      ${stackStamp}`} 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  will-change: transform, opacity;
`;

const MainText = styled.div`
  font-family: "Bungee", "Impact", sans-serif;
  font-size: clamp(2.2rem, 6.5cqw, 5.8rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  text-align: center;

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

  @media (max-width: 900px) {
    font-size: clamp(1.8rem, 5.6cqw, 4.2rem);
    letter-spacing: 0.08em;
  }
  @media (max-width: 600px) {
    font-size: clamp(1.4rem, 5cqw, 3rem);
    letter-spacing: 0.06em;
  }
`;

const SupportStack = styled.div`
  position: absolute;
  top: calc(100% + clamp(5px, 0.75cqh, 10px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(5px, 0.75cqh, 10px);
`;

const BrushRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(240px, 38cqw, 480px);
  height: clamp(7px, 1cqh, 14px);
  flex-shrink: 0;

  @media (max-width: 900px) {
    width: clamp(200px, 35cqw, 380px);
  }
  @media (max-width: 600px) {
    width: clamp(160px, 34cqw, 300px);
  }
`;

const BrushStroke = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 60% 25% 45% 50% / 80% 50% 40% 65%;
  filter: blur(0.5px);
  transform: rotate(-0.8deg);

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
`;

const BrushSplash = styled.div`
  position: absolute;
  right: clamp(-6px, -0.8cqw, -2px);
  top: 50%;
  width: clamp(10px, 1.5cqw, 20px);
  height: clamp(4px, 0.5cqh, 7px);
  border-radius: 50% 30% 45% 55% / 60% 40% 55% 45%;
  transform-origin: center center;

  background: ${(p) =>
    p.$isVictory ? "rgba(255,215,0,0.5)" : "rgba(200,50,50,0.4)"};

  animation: ${splashAppear} 3s ease-out forwards;
`;

const KimariteText = styled.div`
  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-size: clamp(0.8rem, 1.7cqw, 1.4rem);
  font-weight: 700;
  color: ${(p) => (p.$isVictory ? "#F5E6C8" : "#D0D4DE")};
  letter-spacing: 0.3em;
  padding-left: 0.3em;
  text-align: center;
  white-space: nowrap;

  text-shadow: ${(p) =>
    p.$isVictory
      ? "1px 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(255,220,140,0.12)"
      : "1px 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(160,170,200,0.1)"};

  animation: ${subtitleTrack} 3s ease-out forwards;

  @media (max-width: 600px) {
    font-size: clamp(0.65rem, 1.4cqw, 1rem);
  }
`;

// ============================================
// COMPONENT
// ============================================

const RoundResult = ({ isVictory, winType }) => {
  const config = WIN_TYPE_CONFIG[winType] || WIN_TYPE_CONFIG.ringOut;
  const hasKimarite = !!config.japanese;

  return (
    <>
      <ScreenFlash $isVictory={isVictory} />
      <ContrastHaze $isVictory={isVictory} />

      <CalloutAnchor>
        <MainText $isVictory={isVictory}>{config.english}</MainText>
        <SupportStack>
          <BrushRow>
            <BrushStroke $isVictory={isVictory} />
            <BrushSplash $isVictory={isVictory} />
          </BrushRow>
          {hasKimarite && (
            <KimariteText $isVictory={isVictory}>
              {config.japanese}
            </KimariteText>
          )}
        </SupportStack>
      </CalloutAnchor>
    </>
  );
};

RoundResult.propTypes = {
  isVictory: PropTypes.bool.isRequired,
  winType: PropTypes.string,
};

export default memo(RoundResult);
