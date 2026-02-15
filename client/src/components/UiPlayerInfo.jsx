import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import happyFeetIcon from "../assets/happy-feet.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import { SnowCap, IcicleRow, Icicle } from "./Snowfall";

// ============================================
// ANIMATIONS
// ============================================

const flashRedPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

const pulseWin = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.18); }
  100% { transform: scale(1); }
`;

/* Sweeping ice-shine across the stamina fill */
const iceShimmer = keyframes`
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
`;

/* Pulsing glow overlay during stamina regeneration */
const regenPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.85; }
`;

/* Pulsing danger glow for the bar frame when stamina is critical */
const dangerFramePulse = keyframes`
  0%, 100% {
    box-shadow:
      inset 0 0 6px rgba(255, 40, 40, 0.05),
      0 0 4px rgba(255, 40, 40, 0.05),
      0 0 0 2px rgba(180, 130, 30, 0.6);
  }
  50% {
    box-shadow:
      inset 0 0 14px rgba(255, 40, 40, 0.25),
      0 0 16px rgba(255, 40, 40, 0.35),
      0 0 0 2px rgba(255, 60, 60, 0.7);
  }
`;

/* Subtle breathing for the center crest */
const crestBreath = keyframes`
  0%, 100% { filter: brightness(1); }
  50%      { filter: brightness(1.06); }
`;

// ============================================
// MAIN HUD SHELL
// ============================================

const HudShell = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(7px, 1.2vh, 12px) clamp(6px, 1vw, 14px);
  padding-top: clamp(9px, 1.6vh, 16px);

  /* Rich layered dark — darker up top, fading out toward gameplay */
  background:
    /* Subtle seigaiha wave pattern — traditional Japanese, very faint gold */
    radial-gradient(circle at 100% 150%, transparent 24%, rgba(212,175,55,0.018) 24.5%, rgba(212,175,55,0.018) 27.5%, transparent 28%) 0 0 / 28px 14px,
    radial-gradient(circle at 0% 150%, transparent 24%, rgba(212,175,55,0.018) 24.5%, rgba(212,175,55,0.018) 27.5%, transparent 28%) 0 0 / 28px 14px,
    linear-gradient(
      180deg,
      rgba(4, 6, 16, 0.96) 0%,
      rgba(6, 9, 22, 0.92) 20%,
      rgba(6, 9, 22, 0.72) 50%,
      rgba(6, 9, 22, 0.28) 78%,
      transparent 100%
    );

  /* ── Thick gold-over-crimson top beam (dohyo roof feel) ── */
  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: clamp(4px, 0.4vw, 8px);
    background: linear-gradient(
      90deg,
      transparent 0%,
      #3d0e0e 4%,
      #8B1A1A 8%,
      #c9a22e 18%,
      #FFD700 30%,
      #f5e278 42%,
      #FFD700 50%,
      #f5e278 58%,
      #FFD700 70%,
      #c9a22e 82%,
      #8B1A1A 92%,
      #3d0e0e 96%,
      transparent 100%
    );
    z-index: 10;
    pointer-events: none;
  }

  /* ── Thin crimson accent under the gold ── */
  &::after {
    content: "";
    position: absolute;
    top: clamp(4px, 0.4vw, 8px); left: 0; right: 0;
    height: clamp(2px, 0.16vw, 4px);
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(139, 26, 26, 0.7) 10%,
      rgba(180, 40, 40, 0.4) 30%,
      rgba(139, 26, 26, 0.5) 50%,
      rgba(180, 40, 40, 0.4) 70%,
      rgba(139, 26, 26, 0.7) 90%,
      transparent 100%
    );
    z-index: 10;
    pointer-events: none;
  }
`;

// ============================================
// PLAYER WING  (one per side)
// ============================================

const PlayerWing = styled.div`
  flex: 0 1 40%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 0.6vh, 8px);
`;

// ============================================
// NAME BANNER  —  sumo shikona-style plate
// ============================================

const NameBanner = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  gap: clamp(5px, 0.8vw, 10px);
  flex-direction: ${(p) => (p.$isRight ? "row-reverse" : "row")};
  /* Angled banner edge — fighting game energy */
  clip-path: ${(p) =>
    p.$isRight
      ? "polygon(10px 0, 100% 0, 100% 100%, 0 100%)"
      : "polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)"};
  background: linear-gradient(
    ${(p) => (p.$isRight ? "270deg" : "90deg")},
    rgba(10, 16, 38, 0.95) 0%,
    rgba(18, 24, 50, 0.88) 60%,
    rgba(28, 18, 18, 0.75) 100%
  );
  /* Match the full stamina bar height (BarTrack + BarTrack border + BarFrame border) */
  height: calc(clamp(20px, 4.2vh, 46px) + 8px);
  box-sizing: border-box;
  padding: 0 clamp(10px, 1.5vw, 20px);
  ${(p) => p.$isRight
    ? "padding-left: clamp(16px, 2.5vw, 30px);"
    : "padding-right: clamp(16px, 2.5vw, 30px);"}
  position: relative;

  /* Gold gradient bottom edge — renders above the avatar so it continues through it */
  &::after {
    content: "";
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: clamp(2px, 0.16vw, 4px);
    background: linear-gradient(
      ${(p) => (p.$isRight ? "270deg" : "90deg")},
      #d4af37 0%, #b8860b 60%, transparent 100%
    );
    pointer-events: none;
    z-index: 4;
  }

  /* Colored accent edge — east(teal)/west(crimson) sumo tradition */
  &::before {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    ${(p) => (p.$isRight ? "right: 0;" : "left: 0;")}
    width: clamp(3px, 0.3vw, 6px);
    background: ${(p) =>
      p.$isRight
        ? "linear-gradient(180deg, #b83232, #8B1A1A, #5c0e0e)"
        : "linear-gradient(180deg, #1a7a8a, #0d5a6c, #073d4a)"};
    z-index: 2;
  }
`;

/* Square seal avatar (hanko stamp feel) — full banner height, flush to side accent */
const AvatarSeal = styled.div`
  width: clamp(24px, 4.5vh, 50px);
  align-self: stretch;
  /* Push flush to the banner edge, covering the side accent */
  ${(p) => p.$isRight
    ? "margin-right: calc(-1 * clamp(10px, 1.5vw, 20px));"
    : "margin-left: calc(-1 * clamp(10px, 1.5vw, 20px));"}
  /* Bottom aligns with banner's gold bottom edge */
  margin-bottom: 0;
  background: radial-gradient(
    circle at 35% 35%,
    #5c1a1a, #3d0a0a 70%, #200404
  );
  border: clamp(2px, 0.16vw, 4px) solid #d4af37;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(11px, 1.8vw, 20px);
  font-weight: 900;
  color: #ffd700;
  text-shadow:
    0 0 clamp(6px, 0.6vw, 12px) rgba(255, 215, 0, 0.4),
    0 clamp(1.5px, 0.12vw, 3px) 0 rgba(0, 0, 0, 0.8);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    inset 0 0 8px rgba(0, 0, 0, 0.5),
    0 3px 10px rgba(0, 0, 0, 0.5);
  flex-shrink: 0;
  position: relative;
  z-index: 3;

  /* Subtle diagonal stamp-mark texture */
  &::after {
    content: "";
    position: absolute;
    inset: 2px;
    background: repeating-linear-gradient(
      -45deg,
      transparent 0px,
      transparent 3px,
      rgba(212, 175, 55, 0.04) 3px,
      rgba(212, 175, 55, 0.04) 4px
    );
    border-radius: 2px;
    pointer-events: none;
  }
`;

const NameBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: ${(p) => (p.$isRight ? "flex-end" : "flex-start")};
  min-width: 0;
  flex: 1;
`;

const FighterName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(10px, 1.6vw, 20px);
  color: #f5f0e8;
  text-shadow:
    clamp(1.5px, 0.12vw, 3px) clamp(1.5px, 0.12vw, 3px) 0 #000, clamp(-2px, -0.08vw, -1px) clamp(-2px, -0.08vw, -1px) 0 #000,
    clamp(1px, 0.08vw, 2px) clamp(-2px, -0.08vw, -1px) 0 #000, clamp(-2px, -0.08vw, -1px) clamp(1px, 0.08vw, 2px) 0 #000,
    0 0 clamp(8px, 0.9vw, 16px) rgba(0, 0, 0, 0.6);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ============================================
// RANK PLAQUE — sumo banzuke-style ranking plate
// ============================================

/* Sits below the stamina bar — symmetrical sumo banzuke plate */
const RankPlaque = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 0.5vw, 8px);
  padding: clamp(3px, 0.4vh, 6px) clamp(10px, 1.2vw, 18px);
  position: relative;

  /* Dark lacquered plaque with subtle grain */
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0px, transparent 3px,
      rgba(212, 175, 55, 0.015) 3px, rgba(212, 175, 55, 0.015) 4px
    ),
    linear-gradient(
      180deg,
      rgba(14, 18, 36, 0.92) 0%,
      rgba(10, 14, 28, 0.95) 50%,
      rgba(8, 10, 22, 0.92) 100%
    );
  border-radius: 3px;
  border: 1.5px solid rgba(180, 130, 30, 0.35);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 200, 100, 0.06),
    inset 0 -1px 3px rgba(0, 0, 0, 0.3);

  /* Gold ornamental bracket — LEFT side */
  &::before {
    content: "";
    position: absolute;
    top: 3px; bottom: 3px;
    left: -1px;
    width: 3px;
    background: linear-gradient(
      180deg,
      rgba(180, 130, 30, 0.2) 0%,
      #d4af37 20%,
      #ffd700 50%,
      #d4af37 80%,
      rgba(180, 130, 30, 0.2) 100%
    );
    border-radius: 2px;
  }

  /* Gold ornamental bracket — RIGHT side */
  &::after {
    content: "";
    position: absolute;
    top: 3px; bottom: 3px;
    right: -1px;
    width: 3px;
    background: linear-gradient(
      180deg,
      rgba(180, 130, 30, 0.2) 0%,
      #d4af37 20%,
      #ffd700 50%,
      #d4af37 80%,
      rgba(180, 130, 30, 0.2) 100%
    );
    border-radius: 2px;
  }
`;

const RankText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(8px, 1.1vw, 14px);
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  line-height: 1;
  text-shadow:
    0 0 6px rgba(212, 175, 55, 0.25),
    0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
`;

/* Small decorative diamond separator */
const RankDiamond = styled.span`
  display: inline-block;
  width: clamp(4px, 0.4vw, 6px);
  height: clamp(4px, 0.4vw, 6px);
  background: linear-gradient(135deg, #d4af37 0%, #ffd700 50%, #b8860b 100%);
  transform: rotate(45deg);
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(212, 175, 55, 0.3);
`;

// ============================================
// STAMINA BAR  — THE HERO OF THE HUD
// ============================================

/* Ornamental outer frame — gold ring with danger state */
const BarFrame = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 4px;

  /* Multi-ring gold frame — same thickness as banner bottom border */
  border: clamp(2px, 0.16vw, 4px) solid transparent;
  box-shadow:
    /* Gold outer ring */
    0 0 0 clamp(2px, 0.16vw, 4px) rgba(180, 130, 30, 0.6),
    /* Dark outer gap */
    0 0 0 clamp(4px, 0.32vw, 8px) rgba(0, 0, 0, 0.5),
    /* Depth shadow */
    0 clamp(3px, 0.24vw, 6px) clamp(12px, 1vw, 24px) rgba(0, 0, 0, 0.5);

  /* Danger mode: pulsing crimson frame */
  ${(p) =>
    p.$danger &&
    css`
      animation: ${dangerFramePulse} 0.7s ease-in-out infinite;
    `}
`;

/* Dark inner track with frost-crack texture — height tuned so bar total matches power-up slot */
const BarTrack = styled.div`
  position: relative;
  width: 100%;
  height: calc(clamp(20px, 4.2vh, 46px) - 3px);
  border-radius: 3px;
  overflow: hidden;

  /* Deep dark track — like looking into ice */
  background:
    /* Subtle frost-crack pattern */
    linear-gradient(137deg, transparent 48%, rgba(168,212,255,0.025) 49%, rgba(168,212,255,0.025) 51%, transparent 52%),
    linear-gradient(-137deg, transparent 48%, rgba(168,212,255,0.015) 49%, rgba(168,212,255,0.015) 51%, transparent 52%),
    linear-gradient(
      ${(p) => (p.$isRight ? "280deg" : "100deg")},
      rgba(4, 8, 22, 0.97) 0%,
      rgba(8, 14, 35, 0.93) 50%,
      rgba(12, 20, 45, 0.88) 100%
    );
  border: 1.5px solid rgba(168, 212, 255, 0.12);
  box-shadow:
    inset 0 3px 8px rgba(0, 0, 0, 0.65),
    inset 0 -1px 4px rgba(0, 0, 0, 0.3),
    inset 0 0 6px rgba(168, 212, 255, 0.03);
`;

/* Tick marks at 25%, 50%, 75% — readability */
const BarTicks = styled.div`
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  z-index: 4;
  pointer-events: none;

  &::before, &::after {
    content: "";
    position: absolute;
    top: 15%;
    bottom: 15%;
    width: 1px;
    background: rgba(255, 255, 255, 0.1);
  }
  &::before { left: 25%; }
  &::after  { left: 75%; }
`;

/* Extra center tick (50% mark — most important for reads) */
const BarCenterTick = styled.div`
  position: absolute;
  top: 10%;
  bottom: 10%;
  left: 50%;
  width: 1.5px;
  background: rgba(255, 255, 255, 0.15);
  z-index: 4;
  pointer-events: none;
`;

/* Icy blue stamina fill — the glowing glacier bar */
const BarFill = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "right: 2px;" : "left: 2px;")}
  border-radius: 2px;
  transition: width 0.3s ease;
  z-index: 2;
  overflow: hidden;

  /* ── Color states ── */
  background: ${(p) =>
    p.$danger
      ? p.$isRight
        ? "linear-gradient(270deg, #dc2626 0%, #ef4444 40%, #f87171 80%, #fca5a5 100%)"
        : "linear-gradient(90deg, #fca5a5 0%, #f87171 20%, #ef4444 60%, #dc2626 100%)"
      : p.$isRight
        ? "linear-gradient(270deg, #0369a1 0%, #0284c7 15%, #0ea5e9 35%, #38bdf8 60%, #7dd3fc 85%, #bae6fd 100%)"
        : "linear-gradient(90deg, #bae6fd 0%, #7dd3fc 15%, #38bdf8 40%, #0ea5e9 65%, #0284c7 85%, #0369a1 100%)"};

  box-shadow: ${(p) =>
    p.$danger
      ? "0 0 14px rgba(239, 68, 68, 0.6), inset 0 0 4px rgba(255, 100, 100, 0.2)"
      : "0 0 12px rgba(14, 165, 233, 0.45), 0 0 4px rgba(56, 189, 248, 0.3), inset 0 0 4px rgba(186, 230, 253, 0.12)"};

  animation: ${(p) =>
    p.$danger
      ? css`${flashRedPulse} 0.6s ease-in-out infinite`
      : "none"};

  /* Top highlight — glass bevel */
  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 40%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.32) 0%,
      rgba(255, 255, 255, 0.08) 60%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }

  /* ── Sweeping ice-shine (only when not danger) ── */
  &::after {
    content: "";
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    width: 45%;
    background: linear-gradient(
      100deg,
      transparent 0%,
      transparent 35%,
      rgba(255, 255, 255, 0.10) 42%,
      rgba(255, 255, 255, 0.22) 50%,
      rgba(255, 255, 255, 0.10) 58%,
      transparent 65%,
      transparent 100%
    );
    animation: ${iceShimmer} 3.5s ease-in-out infinite;
    animation-delay: ${(p) => (p.$isRight ? "1.8s" : "0s")};
    pointer-events: none;
    opacity: ${(p) => (p.$danger ? 0 : 1)};
  }
`;

/* Ghost bar — trailing damage indicator (fighting-game "white health") */
const BarGhost = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
    transition: p.$catching
      ? "width 0.55s ease-out"
      : "width 0.05s linear",
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "right: 2px;" : "left: 2px;")}
  border-radius: 2px;
  z-index: 1;
  pointer-events: none;

  /* Warm amber — immediately reads as "recent damage" against the dark track */
  background: linear-gradient(
    180deg,
    #fcd679 0%,
    #f5b944 20%,
    #ef8e19 45%,
    #dc6803 75%,
    #b54708 100%
  );

  opacity: 0.88;
  box-shadow:
    0 0 10px rgba(220, 104, 3, 0.45),
    inset 0 0 4px rgba(252, 214, 121, 0.15);

  /* Top highlight bevel (matches fill style) */
  &::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 40%;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.22) 0%,
      rgba(255, 255, 255, 0.06) 60%,
      transparent 100%
    );
    border-radius: 2px 2px 0 0;
    pointer-events: none;
  }
`;

/* Full-bar green overlay that pulses when stamina is regenerating */
const RegenGlow = styled.div.attrs((p) => ({
  style: {
    width: `calc(${p.$stamina}% - 4px)`,
  },
}))`
  position: absolute;
  top: 2px;
  bottom: 2px;
  ${(p) => (p.$isRight ? "right: 2px;" : "left: 2px;")}
  border-radius: 2px;
  z-index: 3;
  pointer-events: none;
  transition: width 0.3s ease;

  /* Green gradient — stronger toward the leading (growing) edge */
  background: linear-gradient(
    ${(p) => (p.$isRight ? "270deg" : "90deg")},
    rgba(52, 211, 153, 0.06) 0%,
    rgba(52, 211, 153, 0.18) 40%,
    rgba(52, 211, 153, 0.35) 75%,
    rgba(74, 222, 170, 0.5) 100%
  );

  box-shadow:
    inset 0 0 10px rgba(52, 211, 153, 0.25),
    inset ${(p) => (p.$isRight ? "-6px" : "6px")} 0 14px rgba(52, 211, 153, 0.3);

  animation: ${regenPulse} 0.8s ease-in-out infinite;
`;

/* STA label inside the bar */
const BarLabel = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) => (p.$isRight ? "right: clamp(6px, 1vw, 14px);" : "left: clamp(6px, 1vw, 14px);")}
  font-family: "Bungee", cursive;
  font-size: clamp(8px, 0.95vw, 12px);
  color: rgba(255, 255, 255, 0.82);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow:
    1px 1px 3px rgba(0, 0, 0, 1),
    0 0 8px rgba(0, 0, 0, 0.8),
    0 0 2px rgba(0, 0, 0, 1);
  z-index: 6;
  pointer-events: none;
  user-select: none;
`;

// ============================================
// POWER-UP — medal / charm style
// ============================================

/* Invisible spacer to align rank plaque with stamina bar (same width as PowerUpSlot) */
const BarRowSpacer = styled.div`
  width: clamp(30px, 3.8vw, 48px);
  flex-shrink: 0;
  min-height: 0;
`;

/* Stack below the stamina bar — rank plaque aligned with stamina bar left/right */
const SubBarRow = styled.div`
  display: flex;
  flex-direction: ${(p) => (p.$isRight ? "row-reverse" : "row")};
  align-items: center;
  gap: clamp(4px, 0.5vw, 8px);
  margin-top: clamp(3px, 0.5vh, 6px);
  width: 100%;
`;

/* Row that holds the stamina bar + power-up icon side-by-side */
const BarRow = styled.div`
  display: flex;
  align-items: center;
  flex-direction: ${(p) => (p.$isRight ? "row" : "row-reverse")};
  gap: clamp(4px, 0.5vw, 8px);
  width: 100%;
`;

/* Same height as stamina bar (BarTrack + BarFrame border only; box-shadow ring is drawn outside) */
const PowerUpSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(30px, 3.8vw, 48px);
  height: calc(clamp(20px, 4.2vh, 46px) + clamp(5px, 0.4vw, 10px));
  border-radius: 4px;
  border: clamp(1.5px, 0.15vw, 3px) solid;
  position: relative;
  transition: all 0.25s ease;
  flex-shrink: 0;

  background: ${(p) => {
    if (!p.$active)
      return "linear-gradient(145deg, rgba(18, 24, 48, 0.72), rgba(10, 14, 32, 0.78))";
    if (p.$cooldown)
      return "linear-gradient(135deg, #4a5568, #2d3748)";
    switch (p.$active) {
      case "speed":
        return "linear-gradient(135deg, #00d2ff, #0066cc)";
      case "power":
        return "linear-gradient(135deg, var(--edo-sakura, #ff8fa3), #dc2626)";
      case "snowball":
        return "linear-gradient(135deg, #e0f6ff, #87ceeb)";
      case "pumo_army":
        return "linear-gradient(135deg, #ffcc80, #ff8c00)";
      case "thick_blubber":
        return "linear-gradient(135deg, #9c88ff, #7c4dff)";
      default:
        return "linear-gradient(135deg, #6c757d, #343a40)";
    }
  }};

  border-color: ${(p) => {
    if (!p.$active)
      return "rgba(212, 175, 55, 0.32)";
    if (p.$cooldown)
      return "rgba(168, 212, 255, 0.15)";
    switch (p.$active) {
      case "speed": return "#0088dd";
      case "power": return "#dc2626";
      case "snowball": return "#4682b4";
      case "pumo_army": return "#cc6600";
      case "thick_blubber": return "#5e35b1";
      default: return "#d4af37";
    }
  }};

  box-shadow: ${(p) =>
    p.$active && !p.$cooldown
      ? "0 3px 12px rgba(0,0,0,0.4), 0 0 6px rgba(255,255,255,0.1)"
      : !p.$active
        ? "0 2px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(212, 175, 55, 0.08)"
        : "0 2px 6px rgba(0,0,0,0.3)"};
  opacity: ${(p) => (p.$active ? 1 : 0.7)};

  img {
    width: 76%;
    height: 76%;
    object-fit: contain;
    filter: ${(p) => (p.$cooldown ? "brightness(0.5) grayscale(0.35)" : "brightness(1)")};
  }
`;

// ============================================
// CENTER CREST — crimson lacquer scoreboard
// ============================================

const CenterCrest = styled.div`
  position: absolute;
  top: clamp(14px, 3vh, 36px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;

  display: flex;
  align-items: center;
  gap: clamp(5px, 1vw, 16px);
  padding: clamp(5px, 0.8vh, 12px) clamp(8px, 1.4vw, 22px);

  /* Deep crimson lacquer (urushi) — authentic sumo */
  background:
    /* Very subtle fabric weave texture */
    repeating-linear-gradient(
      0deg,
      transparent 0px, transparent 2px,
      rgba(255, 200, 100, 0.012) 2px, rgba(255, 200, 100, 0.012) 3px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0px, transparent 2px,
      rgba(255, 200, 100, 0.008) 2px, rgba(255, 200, 100, 0.008) 3px
    ),
    linear-gradient(
      180deg,
      #6B1A1A 0%,
      #4A0E0E 30%,
      #350808 65%,
      #200404 100%
    );
  border: clamp(2.5px, 0.2vw, 5px) solid #b8860b;
  border-radius: clamp(5px, 0.8vw, 10px);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.5),
    0 5px 20px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 200, 100, 0.15),
    inset 0 -2px 8px rgba(0, 0, 0, 0.5),
    inset 0 0 16px rgba(80, 15, 15, 0.25);

  animation: ${crestBreath} 6s ease-in-out infinite;

  /* ── Gold ornamental top edge ── */
  &::before {
    content: "";
    position: absolute;
    top: clamp(-3px, -0.16vw, -2px); left: 0; right: 0;
    height: clamp(3px, 0.24vw, 6px);
    background: linear-gradient(
      90deg,
      #6b4c12 0%, #c9a22e 15%, #f0d060 35%,
      #ffe87a 50%,
      #f0d060 65%, #c9a22e 85%, #6b4c12 100%
    );
    border-radius: 6px 6px 0 0;
    pointer-events: none;
  }

  /* ── Gold ornamental bottom edge ── */
  &::after {
    content: "";
    position: absolute;
    bottom: clamp(-3px, -0.16vw, -2px); left: 0; right: 0;
    height: clamp(3px, 0.24vw, 6px);
    background: linear-gradient(
      90deg,
      #6b4c12 0%, #c9a22e 15%, #f0d060 35%,
      #ffe87a 50%,
      #f0d060 65%, #c9a22e 85%, #6b4c12 100%
    );
    border-radius: 0 0 6px 6px;
    pointer-events: none;
  }
`;

/* Stone tray — dark inset for go-stones */
const StoneTray = styled.div`
  display: flex;
  flex-direction: ${(p) => (p.$reverse ? "row-reverse" : "row")};
  gap: clamp(3px, 0.4vw, 5px);
  background: linear-gradient(
    145deg,
    rgba(8, 2, 2, 0.85) 0%,
    rgba(18, 4, 4, 0.6) 50%,
    rgba(8, 2, 2, 0.85) 100%
  );
  padding: clamp(3px, 0.5vw, 7px) clamp(4px, 0.6vw, 10px);
  border-radius: 4px;
  border: 1px solid rgba(139, 105, 20, 0.4);
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.55),
    inset 0 0 8px rgba(0, 0, 0, 0.3);
`;

/* Traditional go-stones: white = win, black = loss */
const GoStone = styled.div`
  width: clamp(9px, 1.3vw, 17px);
  height: clamp(9px, 1.3vw, 17px);
  border-radius: 50%;
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease;

  background: ${(p) => {
    if (p.$isEmpty)
      return "linear-gradient(145deg, rgba(80, 50, 30, 0.15), rgba(60, 35, 20, 0.08))";
    return p.$isWin
      ? "radial-gradient(55% 55% at 32% 32%, #fff 0%, #f0f0f0 55%, #d8d8d8 100%)"
      : "radial-gradient(55% 55% at 32% 32%, #555 0%, #1a1a1a 55%, #050505 100%)";
  }};

  border: ${(p) => {
    if (p.$isEmpty) return "clamp(1.5px, 0.12vw, 3px) solid rgba(139, 105, 20, 0.2)";
    return p.$isWin
      ? "clamp(2px, 0.16vw, 4px) solid rgba(255, 255, 255, 0.9)"
      : "clamp(2px, 0.16vw, 4px) solid rgba(255, 255, 255, 0.5)";
  }};

  box-shadow: ${(p) => {
    if (p.$isEmpty) return "inset 0 1px 3px rgba(0, 0, 0, 0.25)";
    return p.$isWin
      ? "0 0 8px rgba(255, 255, 255, 0.65), 0 0 3px rgba(212, 175, 55, 0.35), inset 0 -1px 2px rgba(0, 0, 0, 0.15)"
      : "0 0 5px rgba(139, 105, 20, 0.35), 0 0 2px rgba(212, 175, 55, 0.2), inset 0 1px 3px rgba(60, 60, 60, 0.45)";
  }};

  animation: ${(p) =>
    p.$isWin && !p.$isEmpty ? pulseWin : "none"} 2s infinite;
`;

const RoundSeal = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
  min-width: clamp(22px, 3vw, 40px);
`;

const RoundNum = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(14px, 2.6vw, 40px);
  color: #ffd700;
  -webkit-text-stroke: clamp(1px, 0.15vw, 3px) #000;
  text-shadow:
    0 0 clamp(8px, 0.8vw, 16px) rgba(255, 215, 0, 0.4),
    0 0 clamp(3px, 0.3vw, 6px) rgba(212, 175, 55, 0.5),
    0 clamp(2px, 0.16vw, 4px) clamp(4px, 0.32vw, 8px) rgba(0, 0, 0, 0.8);
  line-height: 1;
  user-select: none;
`;

const RoundText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(5px, 0.6vw, 8px);
  color: rgba(220, 185, 110, 0.75);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.8);
  margin-top: 1px;
`;

// ============================================
// CONSTANTS
// ============================================

const THROW_BREAK_STAMINA_THRESHOLD = 33;

// ============================================
// COMPONENT
// ============================================

const UiPlayerInfo = ({
  playerOneWinCount,
  playerTwoWinCount,
  roundHistory = [],
  roundId = 0,
  player1Stamina,
  player1ActivePowerUp = null,
  player1SnowballCooldown = false,
  player1PumoArmyCooldown = false,
  player2Stamina,
  player2ActivePowerUp = null,
  player2SnowballCooldown = false,
  player2PumoArmyCooldown = false,
}) => {
  const clampStamina = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  };

  const s1 = clampStamina(player1Stamina);
  const s2 = clampStamina(player2Stamina);

  // ── Display stamina (throttled regen for smooth bar animation) ──
  const [p1DisplayStamina, setP1DisplayStamina] = useState(s1);
  const [p2DisplayStamina, setP2DisplayStamina] = useState(s2);
  const [p1LastDecreaseAt, setP1LastDecreaseAt] = useState(0);
  const [p2LastDecreaseAt, setP2LastDecreaseAt] = useState(0);
  const MAX_INCREASE_PER_UPDATE = 15;

  // ── Ghost bar — trailing damage indicator ("white health" system) ──
  const [p1Ghost, setP1Ghost] = useState(s1);
  const [p2Ghost, setP2Ghost] = useState(s2);
  const [p1GhostCatching, setP1GhostCatching] = useState(false);
  const [p2GhostCatching, setP2GhostCatching] = useState(false);
  const p1GhostTimer = useRef(null);
  const p2GhostTimer = useRef(null);
  const p1PrevStamina = useRef(s1);
  const p2PrevStamina = useRef(s2);
  const p1LastDecreaseAtRef = useRef(0);
  const p2LastDecreaseAtRef = useRef(0);

  // ── Regen indicator (green leading-edge glow) ──
  const [p1Regen, setP1Regen] = useState(false);
  const [p2Regen, setP2Regen] = useState(false);
  const p1RegenTimer = useRef(null);
  const p2RegenTimer = useRef(null);

  // ── Post-reset throttle bypass ──
  // After a round reset, the first stamina update from the server may arrive
  // AFTER game_reset (race condition). This flag lets that first update snap
  // to the new value instead of being throttled by MAX_INCREASE_PER_UPDATE.
  const p1JustReset = useRef(false);
  const p2JustReset = useRef(false);

  // ── Round reset ──
  useEffect(() => {
    setP1DisplayStamina(s1);
    setP2DisplayStamina(s2);
    setP1Ghost(s1);
    setP2Ghost(s2);
    setP1GhostCatching(false);
    setP2GhostCatching(false);
    setP1Regen(false);
    setP2Regen(false);
    setP1LastDecreaseAt(0);
    setP2LastDecreaseAt(0);
    p1PrevStamina.current = s1;
    p2PrevStamina.current = s2;
    p1JustReset.current = true;
    p2JustReset.current = true;
    if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
    if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
    if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
    if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
    p1LastDecreaseAtRef.current = 0;
    p2LastDecreaseAtRef.current = 0;
  }, [roundId]);

  // ── Player 1 stamina + ghost + regen ──
  useEffect(() => {
    const prev = p1PrevStamina.current;
    p1PrevStamina.current = s1;
    let next = s1;

    // After a round reset, snap immediately to the server value (bypass throttle)
    if (p1JustReset.current) {
      p1JustReset.current = false;
      setP1DisplayStamina(s1);
      setP1Ghost(s1);
      return;
    }

    if (s1 < prev) {
      // ▼ DAMAGE — stamina decreased
      const now = Date.now();
      setP1LastDecreaseAt(now);
      p1LastDecreaseAtRef.current = now;
      // Ghost stays high (captures "where stamina was" before this drain sequence)
      setP1Ghost((g) => Math.max(g, p1DisplayStamina));
      setP1GhostCatching(false);
      // Schedule ghost catch-up after a visible delay
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
      const closureS1 = s1;
      const scheduleGhostCatchUp = (delay = 700) => {
        p1GhostTimer.current = setTimeout(() => {
          // During continuous drain (e.g. grab push), don't catch up mid-sequence — reschedule
          const elapsed = Date.now() - p1LastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP1GhostCatching(true);
          setP1Ghost(closureS1);
        }, delay);
      };
      scheduleGhostCatchUp(700);
      // Clear regen state
      setP1Regen(false);
      if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
    } else if (s1 > prev) {
      // ▲ REGEN — stamina increased
      // Ghost catches up so it doesn't show false damage ahead of the fill
      if (p1GhostTimer.current) clearTimeout(p1GhostTimer.current);
      setP1GhostCatching(false);
      setP1Ghost(Math.min(s1, p1DisplayStamina));
      // Show regen glow (stays on for 500ms after last regen tick)
      setP1Regen(true);
      if (p1RegenTimer.current) clearTimeout(p1RegenTimer.current);
      p1RegenTimer.current = setTimeout(() => setP1Regen(false), 500);
    }

    // Throttle regen display (prevents jarring jumps after recent damage)
    const justDecreased =
      Date.now() - p1LastDecreaseAt < 600 || p1DisplayStamina === 0;
    if (next - p1DisplayStamina > 25 && justDecreased) {
      next = p1DisplayStamina;
    }
    if (next > p1DisplayStamina) {
      next = Math.min(next, p1DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP1DisplayStamina(next);

    return () => {
      if (p1GhostTimer.current) {
        clearTimeout(p1GhostTimer.current);
        p1GhostTimer.current = null;
      }
    };
  }, [s1]);

  // ── Player 2 stamina + ghost + regen ──
  useEffect(() => {
    const prev = p2PrevStamina.current;
    p2PrevStamina.current = s2;
    let next = s2;

    // After a round reset, snap immediately to the server value (bypass throttle)
    if (p2JustReset.current) {
      p2JustReset.current = false;
      setP2DisplayStamina(s2);
      setP2Ghost(s2);
      return;
    }

    if (s2 < prev) {
      // ▼ DAMAGE
      const now = Date.now();
      setP2LastDecreaseAt(now);
      p2LastDecreaseAtRef.current = now;
      setP2Ghost((g) => Math.max(g, p2DisplayStamina));
      setP2GhostCatching(false);
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
      const closureS2 = s2;
      const scheduleGhostCatchUp = (delay = 700) => {
        p2GhostTimer.current = setTimeout(() => {
          // During continuous drain (e.g. grab push), don't catch up mid-sequence — reschedule
          const elapsed = Date.now() - p2LastDecreaseAtRef.current;
          if (elapsed < 500) {
            scheduleGhostCatchUp(400);
            return;
          }
          setP2GhostCatching(true);
          setP2Ghost(closureS2);
        }, delay);
      };
      scheduleGhostCatchUp(700);
      setP2Regen(false);
      if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
    } else if (s2 > prev) {
      // ▲ REGEN
      if (p2GhostTimer.current) clearTimeout(p2GhostTimer.current);
      setP2GhostCatching(false);
      setP2Ghost(Math.min(s2, p2DisplayStamina));
      setP2Regen(true);
      if (p2RegenTimer.current) clearTimeout(p2RegenTimer.current);
      p2RegenTimer.current = setTimeout(() => setP2Regen(false), 500);
    }

    const justDecreased =
      Date.now() - p2LastDecreaseAt < 600 || p2DisplayStamina === 0;
    if (next - p2DisplayStamina > 25 && justDecreased) {
      next = p2DisplayStamina;
    }
    if (next > p2DisplayStamina) {
      next = Math.min(next, p2DisplayStamina + MAX_INCREASE_PER_UPDATE);
    }
    setP2DisplayStamina(next);

    return () => {
      if (p2GhostTimer.current) {
        clearTimeout(p2GhostTimer.current);
        p2GhostTimer.current = null;
      }
    };
  }, [s2]);

  // ── Derived match state ──
  const currentRound = Math.min(roundHistory.length + 1, 3);

  const renderCenterMarks = (playerName) => {
    const marks = [];
    const maxRounds = 3;
    for (let i = 0; i < maxRounds; i++) {
      if (i < roundHistory.length) {
        const isWin = roundHistory[i] === playerName;
        marks.push(
          <GoStone key={`r-${i}`} $isWin={isWin} $isEmpty={false} />
        );
      } else {
        marks.push(
          <GoStone key={`e-${i}`} $isWin={false} $isEmpty={true} />
        );
      }
    }
    return marks;
  };

  const shouldShowLowStaminaWarning = (stamina) =>
    stamina < THROW_BREAK_STAMINA_THRESHOLD;

  const getPowerUpIsOnCooldown = (
    powerUpType,
    snowballCooldown,
    pumoArmyCooldown
  ) => {
    switch (powerUpType) {
      case "snowball":
        return snowballCooldown;
      case "pumo_army":
        return pumoArmyCooldown;
      default:
        return false;
    }
  };

  const getPowerUpIcon = (powerUpType) => {
    switch (powerUpType) {
      case "speed": return happyFeetIcon;
      case "power": return powerWaterIcon;
      case "snowball": return snowballImage;
      case "pumo_army": return pumoArmyIcon;
      case "thick_blubber": return thickBlubberIcon;
      default: return "";
    }
  };

  const p1Danger = shouldShowLowStaminaWarning(p1DisplayStamina);
  const p2Danger = shouldShowLowStaminaWarning(p2DisplayStamina);

  return (
    <HudShell>
      {/* ═══ PLAYER 1 — East (Higashi) ═══ */}
      <PlayerWing>
        <NameBanner $isRight={false}>
          <AvatarSeal $isRight={false}>力</AvatarSeal>
          <NameBlock $isRight={false}>
            <FighterName>PLAYER 1</FighterName>
          </NameBlock>
        </NameBanner>

        <BarRow $isRight={false}>
          <BarFrame $danger={p1Danger} $isRight={false}>
            <BarTrack $isRight={false}>
              <BarLabel $isRight={false}>STA</BarLabel>
              <BarFill
                $stamina={p1DisplayStamina}
                $danger={p1Danger}
                $isRight={false}
              />
              <BarGhost
                $stamina={p1Ghost}
                $catching={p1GhostCatching}
                $isRight={false}
              />
              {p1Regen && (
                <RegenGlow
                  $stamina={p1DisplayStamina}
                  $isRight={false}
                />
              )}
              <BarTicks />
              <BarCenterTick />
            </BarTrack>
          </BarFrame>
          <PowerUpSlot
            $active={player1ActivePowerUp}
            $cooldown={getPowerUpIsOnCooldown(
              player1ActivePowerUp,
              player1SnowballCooldown,
              player1PumoArmyCooldown
            )}
          >
            {player1ActivePowerUp && (
              <img
                src={getPowerUpIcon(player1ActivePowerUp)}
                alt={player1ActivePowerUp}
              />
            )}
          </PowerUpSlot>
        </BarRow>

        <SubBarRow $isRight={false}>
          <BarRowSpacer />
          <RankPlaque $isRight={false}>
            <RankText>JONOKUCHI</RankText>
          </RankPlaque>
        </SubBarRow>
      </PlayerWing>

      {/* ═══ CENTER SCOREBOARD ═══ */}
      <CenterCrest>
        <SnowCap />
        <StoneTray>{renderCenterMarks("player1")}</StoneTray>
        <RoundSeal>
          <RoundNum>{currentRound}</RoundNum>
          <RoundText>ROUND</RoundText>
        </RoundSeal>
        <StoneTray $reverse>{renderCenterMarks("player2")}</StoneTray>
        <IcicleRow $bottom="-12px">
          <Icicle $w={2} $h={6} />
          <Icicle $w={3} $h={9} />
          <Icicle $w={2} $h={7} />
          <Icicle $w={3} $h={11} />
          <Icicle $w={2} $h={8} />
        </IcicleRow>
      </CenterCrest>

      {/* ═══ PLAYER 2 — West (Nishi) ═══ */}
      <PlayerWing>
        <NameBanner $isRight={true}>
          <AvatarSeal $isRight={true}>闘</AvatarSeal>
          <NameBlock $isRight={true}>
            <FighterName>PLAYER 2</FighterName>
          </NameBlock>
        </NameBanner>

        <BarRow $isRight={true}>
          <BarFrame $danger={p2Danger} $isRight={true}>
            <BarTrack $isRight={true}>
              <BarLabel $isRight={true}>STA</BarLabel>
              <BarFill
                $stamina={p2DisplayStamina}
                $danger={p2Danger}
                $isRight={true}
              />
              <BarGhost
                $stamina={p2Ghost}
                $catching={p2GhostCatching}
                $isRight={true}
              />
              {p2Regen && (
                <RegenGlow
                  $stamina={p2DisplayStamina}
                  $isRight={true}
                />
              )}
              <BarTicks />
              <BarCenterTick />
            </BarTrack>
          </BarFrame>
          <PowerUpSlot
            $active={player2ActivePowerUp}
            $cooldown={getPowerUpIsOnCooldown(
              player2ActivePowerUp,
              player2SnowballCooldown,
              player2PumoArmyCooldown
            )}
          >
            {player2ActivePowerUp && (
              <img
                src={getPowerUpIcon(player2ActivePowerUp)}
                alt={player2ActivePowerUp}
              />
            )}
          </PowerUpSlot>
        </BarRow>

        <SubBarRow $isRight={true}>
          <BarRowSpacer />
          <RankPlaque $isRight={true}>
            <RankText>JONOKUCHI</RankText>
          </RankPlaque>
        </SubBarRow>
      </PlayerWing>
    </HudShell>
  );
};

UiPlayerInfo.propTypes = {
  playerOneWinCount: PropTypes.number.isRequired,
  playerTwoWinCount: PropTypes.number.isRequired,
  roundHistory: PropTypes.array,
  roundId: PropTypes.number,
  player1Stamina: PropTypes.number,
  player1ActivePowerUp: PropTypes.string,
  player1SnowballCooldown: PropTypes.bool,
  player1PumoArmyCooldown: PropTypes.bool,
  player2Stamina: PropTypes.number,
  player2ActivePowerUp: PropTypes.string,
  player2SnowballCooldown: PropTypes.bool,
  player2PumoArmyCooldown: PropTypes.bool,
};

export default UiPlayerInfo;
