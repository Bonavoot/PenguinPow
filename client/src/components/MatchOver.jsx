import Rematch from "./Rematch";
import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";

// ═══════════════════════════════════════════════
//  PHASE 1 — Cinematic backdrop reveal
// ═══════════════════════════════════════════════

const backdropReveal = keyframes`
  0% {
    opacity: 0;
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 1;
  }
`;

const vignetteClose = keyframes`
  0% {
    opacity: 0;
    transform: scale(1.15);
  }
  40% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
`;

// ═══════════════════════════════════════════════
//  PHASE 2 — Banner entrance
// ═══════════════════════════════════════════════

const bannerReveal = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-14%) scale(0.88);
    filter: blur(6px);
  }
  50% {
    opacity: 1;
    filter: blur(1px);
  }
  72% {
    transform: translateY(1%) scale(1.008);
    filter: blur(0px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0px);
  }
`;

const bannerFloat = keyframes`
  0%, 100% { transform: rotate(-0.25deg) translateY(0); }
  50% { transform: rotate(0.25deg) translateY(0.3%); }
`;

// ═══════════════════════════════════════════════
//  Ambient animations
// ═══════════════════════════════════════════════

const victoryGlow = keyframes`
  0%, 100% {
    text-shadow:
      3px 3px 0 #1a0e06,
      6px 6px 0 rgba(18, 10, 4, 0.6),
      0 0 6px rgba(68, 173, 7, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
  50% {
    text-shadow:
      3px 3px 0 #1a0e06,
      6px 6px 0 rgba(18, 10, 4, 0.6),
      0 0 14px rgba(68, 173, 7, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
`;

const defeatPulse = keyframes`
  0%, 100% {
    text-shadow:
      3px 3px 0 #3a0a0a,
      6px 6px 0 rgba(40, 8, 8, 0.6),
      0 0 6px rgba(200, 50, 50, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
  50% {
    text-shadow:
      3px 3px 0 #3a0a0a,
      6px 6px 0 rgba(40, 8, 8, 0.6),
      0 0 14px rgba(200, 50, 50, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.6);
  }
`;

const tasselSway = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
`;

const rayDrift = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const moteFade = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(0, 8px, 0) scale(0.6);
  }
  15% { opacity: var(--peak-opacity); }
  85% { opacity: var(--peak-opacity); }
  100% {
    opacity: 0;
    transform: translate3d(var(--tx), var(--ty), 0) scale(1.1);
  }
`;

const innerShimmer = keyframes`
  0% { transform: translateX(-120%); opacity: 0; }
  18% { opacity: 0.45; }
  44% { transform: translateX(120%); opacity: 0.08; }
  100% { transform: translateX(120%); opacity: 0; }
`;

const grainFlicker = keyframes`
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-2%, -3%); }
  30% { transform: translate(3%, 1%); }
  50% { transform: translate(-1%, 3%); }
  70% { transform: translate(2%, -2%); }
  90% { transform: translate(-3%, 1%); }
`;

// ═══════════════════════════════════════════════
//  Root overlay — orchestrates the full reveal
// ═══════════════════════════════════════════════

const MatchOverOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  pointer-events: none;
`;

// ═══════════════════════════════════════════════
//  Backdrop — cinematic darken + blur
// ═══════════════════════════════════════════════

const BackdropScrim = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  animation: ${backdropReveal} 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  background:
    linear-gradient(
      180deg,
      rgba(4, 5, 12, 0.72) 0%,
      rgba(4, 6, 14, 0.55) 20%,
      rgba(4, 6, 14, 0.50) 50%,
      rgba(3, 5, 12, 0.68) 100%
    );
`;

// ═══════════════════════════════════════════════
//  Vignette — elegant edge darkening
// ═══════════════════════════════════════════════

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  animation: ${vignetteClose} 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.15s forwards;
  background:
    radial-gradient(
      ellipse 72% 65% at 50% 50%,
      transparent 0%,
      rgba(0, 0, 0, 0.04) 40%,
      rgba(0, 0, 0, 0.35) 70%,
      rgba(0, 0, 0, 0.7) 100%
    );

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        90deg,
        rgba(0, 0, 0, 0.28) 0%,
        transparent 15%,
        transparent 85%,
        rgba(0, 0, 0, 0.28) 100%
      ),
      linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.22) 0%,
        transparent 20%,
        transparent 80%,
        rgba(0, 0, 0, 0.26) 100%
      );
    opacity: 0.7;
  }
`;

// ═══════════════════════════════════════════════
//  Subtle light rays (replaces the blob)
// ═══════════════════════════════════════════════

const LightRays = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(110vw, 1400px);
  height: min(110vh, 900px);
  transform: translate(-50%, -50%);
  pointer-events: none;
  opacity: 0;
  animation: ${vignetteClose} 1.6s ease-out 0.4s forwards;

  &::before {
    content: "";
    position: absolute;
    inset: -20%;
    background: ${(p) =>
      p.$isWinner
        ? `conic-gradient(
            from 0deg at 50% 50%,
            rgba(212, 175, 55, 0.01) 0deg,
            rgba(212, 175, 55, 0.03) 30deg,
            rgba(255, 215, 120, 0.015) 60deg,
            rgba(212, 175, 55, 0.025) 90deg,
            rgba(255, 215, 120, 0.01) 120deg,
            rgba(212, 175, 55, 0.03) 150deg,
            rgba(255, 215, 120, 0.015) 180deg,
            rgba(212, 175, 55, 0.025) 210deg,
            rgba(255, 215, 120, 0.01) 240deg,
            rgba(212, 175, 55, 0.03) 270deg,
            rgba(255, 215, 120, 0.02) 300deg,
            rgba(212, 175, 55, 0.015) 330deg,
            rgba(212, 175, 55, 0.01) 360deg
          )`
        : `conic-gradient(
            from 0deg at 50% 50%,
            rgba(180, 180, 200, 0.008) 0deg,
            rgba(160, 160, 180, 0.018) 45deg,
            rgba(180, 180, 200, 0.008) 90deg,
            rgba(160, 160, 180, 0.015) 135deg,
            rgba(180, 180, 200, 0.008) 180deg,
            rgba(160, 160, 180, 0.018) 225deg,
            rgba(180, 180, 200, 0.008) 270deg,
            rgba(160, 160, 180, 0.015) 315deg,
            rgba(180, 180, 200, 0.008) 360deg
          )`};
    animation: ${rayDrift} 120s linear infinite;
    will-change: transform;
  }
`;

// ═══════════════════════════════════════════════
//  Film grain — cinematic texture
// ═══════════════════════════════════════════════

const FilmGrain = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.035;
  mix-blend-mode: overlay;
  animation: ${grainFlicker} 2s steps(3) infinite;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  background-size: 256px 256px;
  will-change: transform;
`;

// ═══════════════════════════════════════════════
//  Mote particles — refined floating specs
// ═══════════════════════════════════════════════

const MoteField = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  opacity: 0;
  animation: ${vignetteClose} 2s ease-out 0.8s forwards;
`;

const Mote = styled.span`
  position: absolute;
  left: var(--left);
  top: var(--top);
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: ${(p) =>
    p.$isWinner
      ? "radial-gradient(circle, rgba(255, 229, 165, 0.9) 0%, rgba(255, 205, 96, 0.3) 50%, transparent 75%)"
      : "radial-gradient(circle, rgba(200, 200, 220, 0.7) 0%, rgba(160, 160, 180, 0.2) 50%, transparent 75%)"};
  box-shadow: 0 0 6px ${(p) =>
    p.$isWinner ? "rgba(255, 215, 0, 0.12)" : "rgba(160, 160, 180, 0.1)"};
  animation: ${moteFade} var(--dur) linear infinite;
  animation-delay: var(--delay);
  --peak-opacity: ${(p) => (p.$isWinner ? "0.4" : "0.25")};
`;

// ═══════════════════════════════════════════════
//  Stage — centers the banner
// ═══════════════════════════════════════════════

const MatchOverStage = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(52px, 8vh, 88px) clamp(24px, 4vw, 40px);
  pointer-events: none;
`;

// ═══════════════════════════════════════════════
//  Banner container — nobori-style, premium entrance
// ═══════════════════════════════════════════════

const MatchOverContainer = styled.div`
  position: relative;
  width: clamp(328px, 33cqw, 462px);
  max-width: min(92vw, 462px);
  z-index: 1;
  pointer-events: auto;
  opacity: 0;
  animation:
    ${bannerReveal} 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.55s forwards,
    ${bannerFloat} 8s ease-in-out 1.4s infinite;

  @media (max-width: 1200px) {
    width: clamp(300px, 37cqw, 418px);
  }
  @media (max-width: 900px) {
    width: clamp(278px, 45cqw, 360px);
  }
`;

// Subtle glow behind the banner (winner only)
const BannerGlow = styled.div`
  position: absolute;
  inset: -30px -40px -44px;
  border-radius: 36px;
  pointer-events: none;
  opacity: 0;
  animation: ${vignetteClose} 1.4s ease-out 0.7s forwards;
  background: ${(p) =>
    p.$isWinner
      ? "radial-gradient(circle, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.04) 25%, rgba(212, 175, 55, 0.015) 45%, transparent 70%)"
      : "radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 25%, rgba(255, 255, 255, 0.004) 45%, transparent 70%)"};
`;

const HangingBar = styled.div`
  width: 112%;
  height: clamp(16px, 2.1cqh, 24px);
  background: linear-gradient(180deg,
    #7a5943 0%,
    #5c4033 18%,
    #3d2817 58%,
    #2a1d14 100%
  );
  border-radius: 4px 4px 0 0;
  margin-left: -6%;
  position: relative;
  border: 2px solid #b19062;
  border-bottom: none;
  box-shadow:
    0 4px 12px rgba(0,0,0,0.5),
    0 0 18px rgba(0,0,0,0.24),
    inset 0 1px 0 rgba(255, 230, 180, 0.22);

  &::before, &::after {
    content: "";
    position: absolute;
    top: -8px;
    width: clamp(10px, 1.5cqw, 16px);
    height: clamp(10px, 1.5cqw, 16px);
    background: radial-gradient(circle at 30% 30%, #f3d376, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  &::before { left: 15%; }
  &::after { right: 15%; }
`;

const TasselContainer = styled.div`
  position: absolute;
  bottom: -25px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 8%;
  pointer-events: none;
`;

const Tassel = styled.div`
  width: clamp(6px, 1cqw, 10px);
  height: clamp(20px, 3cqh, 35px);
  background: linear-gradient(180deg, #d4af37 0%, #8b7355 100%);
  border-radius: 0 0 3px 3px;
  animation: ${tasselSway} ${(props) => 2 + props.$delay * 0.3}s ease-in-out infinite;
  animation-delay: ${(props) => props.$delay * 0.15}s;
  transform-origin: top center;

  &::after {
    content: "";
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 8px;
    background: linear-gradient(180deg, #8b7355 0%, #5c4033 100%);
    border-radius: 0 0 2px 2px;
  }
`;

const BannerBody = styled.div`
  background: linear-gradient(180deg,
    #2a120d 0%,
    #1d0d0a 16%,
    #120707 52%,
    #0d0404 100%
  );
  border: 3px solid #9f8058;
  border-top: none;
  border-radius: 0 0 clamp(12px, 1.5cqw, 20px) clamp(12px, 1.5cqw, 20px);
  padding: clamp(28px, 4cqh, 44px) clamp(20px, 2.7cqw, 34px) clamp(28px, 3.6cqh, 40px);
  box-shadow:
    0 15px 50px rgba(0,0,0,0.7),
    inset 0 0 40px rgba(0,0,0,0.6),
    inset 0 2px 0 rgba(255, 221, 180, 0.14),
    inset 0 -18px 30px rgba(0, 0, 0, 0.32);
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        rgba(255,255,255,0.018) 1px,
        transparent 2px
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(255,255,255,0.012) 1px,
        transparent 2px
      ),
      linear-gradient(
        180deg,
        rgba(255, 221, 180, 0.06) 0%,
        transparent 26%,
        transparent 72%,
        rgba(255, 221, 180, 0.03) 100%
      );
    pointer-events: none;
    border-radius: 0 0 clamp(12px, 1.5cqw, 20px) clamp(12px, 1.5cqw, 20px);
  }

  &::after {
    content: "";
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    bottom: 10px;
    border: 1px solid rgba(212, 175, 55, 0.18);
    border-radius: clamp(8px, 1cqw, 12px);
    pointer-events: none;
  }

  /* backdrop-filter removed — live blur is expensive with animated content behind */

  @media (max-width: 900px) {
    padding: clamp(22px, 3cqh, 32px) clamp(16px, 2.2cqw, 24px) clamp(22px, 2.8cqh, 30px);
    border-width: 2px;
  }
`;

const ResultSection = styled.div`
  text-align: center;
  margin-bottom: clamp(20px, 2.6cqh, 30px);
  padding-bottom: clamp(18px, 2.2cqh, 24px);
  position: relative;

  &::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: min(100%, 260px);
    height: 1px;
    transform: translateX(-50%);
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(212, 175, 55, 0.14) 14%,
      rgba(212, 175, 55, 0.42) 50%,
      rgba(212, 175, 55, 0.14) 86%,
      transparent 100%
    );
  }

  &::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -4px;
    width: clamp(7px, 0.75cqw, 10px);
    height: clamp(7px, 0.75cqw, 10px);
    transform: translateX(-50%) rotate(45deg);
    background: linear-gradient(135deg, #f3d376 0%, #c2932e 100%);
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
  }
`;

const ResultText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1.28rem, 3.25cqw, 2rem);
  color: ${(props) => (props.$isWinner ? "#4ade80" : "#e36b6b")};
  -webkit-text-stroke: ${(props) =>
    props.$isWinner
      ? "clamp(1.5px, 0.15cqw, 3px) #1a0e06"
      : "clamp(1.5px, 0.15cqw, 3px) #3a0a0a"};
  paint-order: stroke fill;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 0.94;
  animation: ${(props) => (props.$isWinner ? victoryGlow : defeatPulse)} 2s ease-in-out infinite;

  @media (max-width: 900px) {
    font-size: clamp(1rem, 4cqw, 1.55rem);
  }
`;

const SubText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.56rem, 1.2cqw, 0.78rem);
  color: #f2e6d0;
  margin-top: clamp(10px, 1.3cqh, 14px);
  letter-spacing: 0.18em;
  text-shadow: 2px 2px 0 #000;

  @media (max-width: 900px) {
    font-size: clamp(0.46rem, 1.9cqw, 0.66rem);
  }
`;

const RematchSection = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  padding-top: clamp(10px, 1.3cqh, 16px);
`;

const InnerShimmer = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;

  &::before {
    content: "";
    position: absolute;
    top: -8%;
    bottom: -8%;
    width: 34%;
    left: 0;
    background: ${(p) =>
      p.$isWinner
        ? "linear-gradient(100deg, transparent 0%, rgba(255, 228, 156, 0.02) 28%, rgba(255, 228, 156, 0.14) 52%, rgba(255, 228, 156, 0.02) 76%, transparent 100%)"
        : "linear-gradient(100deg, transparent 0%, rgba(255, 150, 150, 0.02) 28%, rgba(255, 150, 150, 0.08) 52%, rgba(255, 150, 150, 0.02) 76%, transparent 100%)"};
    transform: translateX(-120%);
    animation: ${innerShimmer} ${(p) => (p.$isWinner ? "5.6s" : "7.4s")} ease-in-out infinite;
    animation-delay: 1.8s;
  }
`;

// ═══════════════════════════════════════════════
//  Horizontal accent lines (top & bottom)
// ═══════════════════════════════════════════════

const horizLineReveal = keyframes`
  0% { transform: scaleX(0); opacity: 0; }
  100% { transform: scaleX(1); opacity: 1; }
`;

const AccentLine = styled.div`
  position: absolute;
  left: 10%;
  right: 10%;
  height: 1px;
  pointer-events: none;
  transform-origin: center;
  transform: scaleX(0);
  opacity: 0;
  animation: ${horizLineReveal} 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.6s forwards;

  ${(p) =>
    p.$position === "top"
      ? css`
          top: 38%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            ${p.$isWinner ? "rgba(212, 175, 55, 0.08)" : "rgba(160, 160, 180, 0.06)"} 20%,
            ${p.$isWinner ? "rgba(212, 175, 55, 0.2)" : "rgba(160, 160, 180, 0.12)"} 50%,
            ${p.$isWinner ? "rgba(212, 175, 55, 0.08)" : "rgba(160, 160, 180, 0.06)"} 80%,
            transparent 100%
          );
        `
      : css`
          bottom: 38%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            ${p.$isWinner ? "rgba(212, 175, 55, 0.06)" : "rgba(160, 160, 180, 0.04)"} 20%,
            ${p.$isWinner ? "rgba(212, 175, 55, 0.15)" : "rgba(160, 160, 180, 0.09)"} 50%,
            ${p.$isWinner ? "rgba(212, 175, 55, 0.06)" : "rgba(160, 160, 180, 0.04)"} 80%,
            transparent 100%
          );
        `}
`;

// ═══════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════

const MatchOver = ({ winner, roomName, localId }) => {
  const isWinner = localId === winner.id;

  const motes = [
    { left: "12%", top: "20%", size: "4px", tx: "-18px", ty: "-50px", dur: "7.5s", delay: "-1.2s" },
    { left: "25%", top: "68%", size: "3px", tx: "12px", ty: "-62px", dur: "8.2s", delay: "-3.5s" },
    { left: "44%", top: "15%", size: "5px", tx: "-8px", ty: "-44px", dur: "7.8s", delay: "-2.8s" },
    { left: "58%", top: "75%", size: "3px", tx: "20px", ty: "-56px", dur: "8.6s", delay: "-1.0s" },
    { left: "73%", top: "22%", size: "3px", tx: "-14px", ty: "-48px", dur: "7.1s", delay: "-4.8s" },
    { left: "82%", top: "62%", size: "4px", tx: "8px", ty: "-66px", dur: "9.0s", delay: "-0.4s" },
    { left: "36%", top: "42%", size: "3px", tx: "-6px", ty: "-40px", dur: "8.8s", delay: "-5.2s" },
    { left: "66%", top: "48%", size: "3px", tx: "14px", ty: "-52px", dur: "7.4s", delay: "-2.0s" },
  ];

  return (
    <MatchOverOverlay>
      <BackdropScrim />
      <Vignette />
      <LightRays $isWinner={isWinner} />
      <FilmGrain />
      <AccentLine $position="top" $isWinner={isWinner} />
      <AccentLine $position="bottom" $isWinner={isWinner} />
      <MoteField aria-hidden="true">
        {motes.map((mote, index) => (
          <Mote
            key={`${mote.left}-${mote.top}-${index}`}
            $isWinner={isWinner}
            style={{
              "--left": mote.left,
              "--top": mote.top,
              "--size": mote.size,
              "--tx": mote.tx,
              "--ty": mote.ty,
              "--dur": mote.dur,
              "--delay": mote.delay,
            }}
          />
        ))}
      </MoteField>
      <MatchOverStage>
        <MatchOverContainer>
          <BannerGlow $isWinner={isWinner} />
          <HangingBar />
          <BannerBody>
            <InnerShimmer $isWinner={isWinner} />
            <ResultSection $isWinner={isWinner}>
              <ResultText $isWinner={isWinner}>
                {isWinner ? "KACHI-KOSHI" : "MAKE-KOSHI"}
              </ResultText>
              <SubText>{isWinner ? "Victory!" : "Defeat"}</SubText>
            </ResultSection>
            <RematchSection>
              <Rematch roomName={roomName} />
            </RematchSection>
            <TasselContainer>
              <Tassel $delay={0} />
              <Tassel $delay={1} />
              <Tassel $delay={2} />
            </TasselContainer>
          </BannerBody>
        </MatchOverContainer>
      </MatchOverStage>
    </MatchOverOverlay>
  );
};

MatchOver.propTypes = {
  winner: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }).isRequired,
  roomName: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
};

export default MatchOver;
