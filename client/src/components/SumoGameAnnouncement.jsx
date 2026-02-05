import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";
import { useMemo } from "react";

// ============================================
// ANIMATIONS
// ============================================

// Explosive slam for HAKKIYOI - fight is starting!
const announcementSlam = keyframes`
  0% {
    opacity: 0;
    transform: scale(2.5) rotate(-6deg);
  }
  12% {
    opacity: 1;
    transform: scale(0.9) rotate(2deg);
  }
  20% {
    transform: scale(1.15) rotate(-1deg);
  }
  28% {
    transform: scale(0.97) rotate(0.5deg);
  }
  36% {
    transform: scale(1.03) rotate(0deg);
  }
  45% {
    transform: scale(1) rotate(0deg);
  }
  80% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.15) rotate(0deg);
  }
`;

// Preparatory slide for TE WO TSUITE - building tension
const preparationReveal = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.6) rotate(3deg);
    clip-path: inset(0 100% 0 0);
  }
  25% {
    opacity: 1;
    transform: scale(1.08) rotate(-1deg);
    clip-path: inset(0 0% 0 0);
  }
  35% {
    transform: scale(0.98) rotate(0.5deg);
  }
  45% {
    transform: scale(1.02) rotate(0deg);
  }
  55% {
    transform: scale(1) rotate(0deg);
  }
  80% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: scale(0.95) rotate(0deg);
  }
`;

// Screen flash effect
const screenFlash = keyframes`
  0% {
    opacity: 0;
  }
  8% {
    opacity: 0.6;
  }
  20% {
    opacity: 0.3;
  }
  35% {
    opacity: 0.4;
  }
  55% {
    opacity: 0.15;
  }
  100% {
    opacity: 0;
  }
`;

// Shockwave ring expanding outward
const shockwaveExpand = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.15);
    opacity: 0.85;
    border-width: 6px;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.4;
    border-width: 3px;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.2);
    opacity: 0;
    border-width: 1px;
  }
`;

// Ink splatter animation
const inkSplatter = keyframes`
  0% {
    transform: scale(0) rotate(0deg);
    opacity: 0;
  }
  18% {
    transform: scale(1.15) rotate(8deg);
    opacity: 0.7;
  }
  35% {
    transform: scale(1) rotate(-4deg);
    opacity: 0.55;
  }
  100% {
    transform: scale(1.08) rotate(0deg);
    opacity: 0;
  }
`;

// Floating ember/spark animation
const floatUp = keyframes`
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  50% {
    opacity: 0.75;
  }
  100% {
    transform: translateY(-100px) scale(0.25);
    opacity: 0;
  }
`;

// Corner decoration fade in
const cornerFadeIn = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  18% {
    opacity: 0;
    transform: scale(0.5);
  }
  35% {
    opacity: 1;
    transform: scale(1);
  }
  75% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.08);
  }
`;

// Brush stroke reveal with fade out
const brushReveal = keyframes`
  0% {
    clip-path: inset(0 100% 0 0);
    opacity: 0;
  }
  20% {
    clip-path: inset(0 0% 0 0);
    opacity: 1;
  }
  70% {
    clip-path: inset(0 0% 0 0);
    opacity: 1;
  }
  100% {
    clip-path: inset(0 0% 0 0);
    opacity: 0;
  }
`;

// Japanese character pulse (subtle)
const japanesePulse = keyframes`
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.9;
  }
`;

// Impact line burst
const impactLineBurst = keyframes`
  0% {
    transform: scaleX(0);
    opacity: 0;
  }
  15% {
    transform: scaleX(1);
    opacity: 1;
  }
  60% {
    transform: scaleX(1);
    opacity: 0.6;
  }
  100% {
    transform: scaleX(1.15);
    opacity: 0;
  }
`;

// ============================================
// THEME COLORS
// ============================================

const getThemeColors = (type) => {
  switch (type) {
    case "hakkiyoi":
      // Fiery gold/orange for the fight start
      return {
        primary: "#FFD700",
        secondary: "#FF8C00",
        tertiary: "#FF4500",
        glow: "rgba(255, 215, 0, 0.4)",
        flash: "rgba(255, 200, 50, 0.5)",
        text: "#FFFAF0",
        textStroke: "#8B4513",
        gradient: "linear-gradient(145deg, #FFFFFF 0%, #FFFFA0 12%, #FFD700 30%, #FFA500 55%, #FF6B00 75%, #FF4500 100%)",
        shadowGradient: "#CC8800",
      };
    case "tewotsuite":
      // Clean white with dark outline - readable and calm
      return {
        primary: "#FFFFFF",
        secondary: "#E0E0E0",
        tertiary: "#2A2A2A",
        glow: "rgba(255, 255, 255, 0.3)",
        flash: "rgba(255, 255, 255, 0.35)",
        text: "#FFFFFF",
        textStroke: "#1A1A1A",
        gradient: "linear-gradient(145deg, #FFFFFF 0%, #F5F5F5 30%, #E8E8E8 60%, #DDDDDD 100%)",
        shadowGradient: "#333333",
      };
    default:
      return {
        primary: "#FFD700",
        secondary: "#FFA500",
        tertiary: "#FF6B00",
        glow: "rgba(255, 215, 0, 0.8)",
        flash: "rgba(255, 200, 50, 0.85)",
        text: "#FFFAF0",
        textStroke: "#8B4513",
        gradient: "linear-gradient(145deg, #FFFFFF 0%, #FFD700 40%, #FFA500 70%, #FF6B00 100%)",
        shadowGradient: "#CC8800",
      };
  }
};

// ============================================
// STYLED COMPONENTS
// ============================================

// Screen flash overlay
const ScreenFlash = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: ${props => {
    const colors = getThemeColors(props.$type);
    return `radial-gradient(circle at 42% 25%, ${colors.flash} 0%, ${colors.glow} 12%, transparent 35%)`;
  }};
  animation: ${screenFlash} 0.7s ease-out forwards;
  pointer-events: none;
  z-index: 1000;
`;

// Shockwave ring effect
const ShockwaveRing = styled.div`
  position: fixed;
  top: clamp(100px, 25%, 180px);
  left: 50%;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  border: 6px solid ${props => getThemeColors(props.$type).primary};
  background: transparent;
  animation: ${shockwaveExpand} 0.55s ease-out forwards;
  animation-delay: ${props => props.$delay || '0s'};
  pointer-events: none;
  z-index: 1002;
  
  @media (max-width: 900px) {
    width: 180px;
    height: 180px;
  }
  
  @media (max-width: 600px) {
    width: 130px;
    height: 130px;
  }
`;

// Impact line (single)
const ImpactLine = styled.div`
  position: fixed;
  top: clamp(100px, 25%, 180px);
  left: 50%;
  width: 350px;
  height: 3px;
  background: ${props => {
    const colors = getThemeColors(props.$type);
    return `linear-gradient(90deg, transparent 0%, ${colors.primary}CC 25%, ${colors.text} 50%, ${colors.primary}CC 75%, transparent 100%)`;
  }};
  transform-origin: center center;
  animation: ${impactLineBurst} 0.45s ease-out forwards;
  animation-delay: ${props => props.$delay || '0.05s'};
  opacity: 0;
  z-index: 1001;
  margin-left: -175px;
  
  @media (max-width: 900px) {
    width: 260px;
    margin-left: -130px;
    height: 2px;
  }
  
  @media (max-width: 600px) {
    width: 180px;
    margin-left: -90px;
  }
`;

// Container for impact lines
const ImpactLinesContainer = styled.div`
  position: fixed;
  top: clamp(100px, 25%, 180px);
  left: 50%;
  transform: translate(-50%, 0);
  width: 1px;
  height: 1px;
  z-index: 1001;
`;

// Main announcement container
const AnnouncementContainer = styled.div`
  position: fixed;
  top: clamp(100px, 25%, 180px);
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1003;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

// Ink splatter background
const InkSplatter = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  margin-top: -190px;
  margin-left: -190px;
  width: 380px;
  height: 380px;
  border-radius: 50%;
  background: ${props => {
    const colors = getThemeColors(props.$type);
    return `radial-gradient(ellipse at center, ${colors.glow}70 0%, ${colors.primary}50 25%, ${colors.secondary}30 45%, transparent 65%)`;
  }};
  animation: ${inkSplatter} ${props => props.$duration || '2.5s'} ease-out forwards;
  z-index: -1;
  transform-origin: center center;
  
  /* Irregular splatter shape */
  clip-path: polygon(
    50% 0%, 62% 8%, 78% 5%, 83% 18%, 100% 22%, 
    94% 38%, 100% 48%, 94% 62%, 82% 72%, 88% 84%, 
    72% 88%, 62% 100%, 50% 94%, 38% 100%, 28% 88%, 
    12% 82%, 8% 68%, 0% 58%, 5% 42%, 0% 28%, 
    12% 18%, 22% 8%, 38% 4%
  );
  
  @media (max-width: 900px) {
    width: 280px;
    height: 280px;
    margin-top: -140px;
    margin-left: -140px;
  }
  
  @media (max-width: 600px) {
    width: 200px;
    height: 200px;
    margin-top: -100px;
    margin-left: -100px;
  }
`;

const SecondaryInkSplatter = styled(InkSplatter)`
  width: 280px;
  height: 280px;
  margin-top: -140px;
  margin-left: -140px;
  animation-delay: 0.08s;
  transform: rotate(40deg);
  opacity: 0.65;
  
  @media (max-width: 900px) {
    width: 200px;
    height: 200px;
    margin-top: -100px;
    margin-left: -100px;
  }
  
  @media (max-width: 600px) {
    width: 150px;
    height: 150px;
    margin-top: -75px;
    margin-left: -75px;
  }
`;

// Corner decorations
const CornerDecoration = styled.div`
  position: absolute;
  width: 55px;
  height: 55px;
  border: 3px solid ${props => getThemeColors(props.$type).primary}C0;
  animation: ${cornerFadeIn} ${props => props.$duration || '2.5s'} ease-out forwards;
  z-index: 1;
  
  ${props => props.$position === 'topLeft' && `
    top: -45px;
    left: -75px;
    border-right: none;
    border-bottom: none;
  `}
  ${props => props.$position === 'topRight' && `
    top: -45px;
    right: -75px;
    border-left: none;
    border-bottom: none;
  `}
  ${props => props.$position === 'bottomLeft' && `
    bottom: -45px;
    left: -75px;
    border-right: none;
    border-top: none;
  `}
  ${props => props.$position === 'bottomRight' && `
    bottom: -45px;
    right: -75px;
    border-left: none;
    border-top: none;
  `}
  
  @media (max-width: 900px) {
    width: 40px;
    height: 40px;
    border-width: 2px;
    
    ${props => props.$position === 'topLeft' && `top: -32px; left: -52px;`}
    ${props => props.$position === 'topRight' && `top: -32px; right: -52px;`}
    ${props => props.$position === 'bottomLeft' && `bottom: -32px; left: -52px;`}
    ${props => props.$position === 'bottomRight' && `bottom: -32px; right: -52px;`}
  }
  
  @media (max-width: 600px) {
    width: 28px;
    height: 28px;
    
    ${props => props.$position === 'topLeft' && `top: -22px; left: -38px;`}
    ${props => props.$position === 'topRight' && `top: -22px; right: -38px;`}
    ${props => props.$position === 'bottomLeft' && `bottom: -22px; left: -38px;`}
    ${props => props.$position === 'bottomRight' && `bottom: -22px; right: -38px;`}
  }
`;

// Diamond accents
const DiamondAccent = styled.div`
  position: absolute;
  width: 12px;
  height: 12px;
  background: ${props => getThemeColors(props.$type).primary};
  transform: rotate(45deg);
  animation: ${cornerFadeIn} ${props => props.$duration || '2.5s'} ease-out forwards;
  z-index: 2;
  
  ${props => props.$position === 'left' && `
    left: -95px;
    top: 50%;
    margin-top: -6px;
  `}
  ${props => props.$position === 'right' && `
    right: -95px;
    top: 50%;
    margin-top: -6px;
  `}
  
  @media (max-width: 900px) {
    width: 9px;
    height: 9px;
    ${props => props.$position === 'left' && `left: -65px; margin-top: -4px;`}
    ${props => props.$position === 'right' && `right: -65px; margin-top: -4px;`}
  }
  
  @media (max-width: 600px) {
    width: 6px;
    height: 6px;
    ${props => props.$position === 'left' && `left: -48px; margin-top: -3px;`}
    ${props => props.$position === 'right' && `right: -48px; margin-top: -3px;`}
  }
`;

// Main text container
const TextContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: fit-content;
`;

// Main announcement text
const MainText = styled.div`
  font-family: "Bungee", cursive;
  font-size: ${props => props.$type === 'hakkiyoi' 
    ? 'clamp(2.2rem, 6.5vw, 5.5rem)' 
    : 'clamp(1.4rem, 4vw, 3.2rem)'};
  font-weight: 400;
  line-height: 1;
  letter-spacing: ${props => props.$type === 'hakkiyoi' ? '0.12em' : '0.18em'};
  text-transform: uppercase;
  white-space: nowrap;
  position: relative;
  color: ${props => getThemeColors(props.$type).text};
  animation: ${props => props.$type === 'hakkiyoi' 
    ? css`${announcementSlam} ${props.$duration || '2.5s'} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
    : css`${preparationReveal} ${props.$duration || '2s'} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
  };
  
  /* Deep 3D shadow effect - subtler for tewotsuite */
  text-shadow: ${props => {
    const colors = getThemeColors(props.$type);
    if (props.$type === 'hakkiyoi') {
      return `
        3px 3px 0 ${colors.shadowGradient},
        6px 6px 0 ${colors.secondary}CC,
        9px 9px 0 ${colors.tertiary}AA,
        12px 12px 0 rgba(0, 0, 0, 0.5),
        0 0 30px ${colors.glow}
      `;
    }
    // Clean black outline for tewotsuite readability
    return `
      -2px -2px 0 #000,
      2px -2px 0 #000,
      -2px 2px 0 #000,
      2px 2px 0 #000,
      0 0 10px rgba(0, 0, 0, 0.8)
    `;
  }};
  
  /* Gradient text fill - only for hakkiyoi */
  ${props => props.$type === 'hakkiyoi' ? `
    background: ${getThemeColors(props.$type).gradient};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  ` : `
    color: #FFFFFF;
    -webkit-text-fill-color: #FFFFFF;
  `}
  
  @media (max-width: 900px) {
    font-size: ${props => props.$type === 'hakkiyoi' 
      ? 'clamp(1.6rem, 5.5vw, 4rem)' 
      : 'clamp(1.1rem, 3.5vw, 2.4rem)'};
    letter-spacing: ${props => props.$type === 'hakkiyoi' ? '0.1em' : '0.15em'};
  }
  
  @media (max-width: 600px) {
    font-size: ${props => props.$type === 'hakkiyoi' 
      ? 'clamp(1.2rem, 5vw, 2.8rem)' 
      : 'clamp(0.9rem, 3vw, 1.8rem)'};
    letter-spacing: ${props => props.$type === 'hakkiyoi' ? '0.08em' : '0.12em'};
  }
`;

// Text shadow layer for depth
const TextShadow = styled.div`
  position: absolute;
  font-family: "Bungee", cursive;
  font-size: ${props => props.$type === 'hakkiyoi' 
    ? 'clamp(2.2rem, 6.5vw, 5.5rem)' 
    : 'clamp(1.4rem, 4vw, 3.2rem)'};
  font-weight: 400;
  line-height: 1;
  letter-spacing: ${props => props.$type === 'hakkiyoi' ? '0.12em' : '0.18em'};
  text-transform: uppercase;
  white-space: nowrap;
  top: ${props => props.$type === 'hakkiyoi' ? '5px' : '3px'};
  left: ${props => props.$type === 'hakkiyoi' ? '5px' : '3px'};
  color: ${props => getThemeColors(props.$type).tertiary};
  opacity: ${props => props.$type === 'hakkiyoi' ? '0.5' : '0.35'};
  z-index: -1;
  animation: ${props => props.$type === 'hakkiyoi' 
    ? css`${announcementSlam} ${props.$duration || '2.5s'} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
    : css`${preparationReveal} ${props.$duration || '2s'} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
  };
  
  @media (max-width: 900px) {
    font-size: ${props => props.$type === 'hakkiyoi' 
      ? 'clamp(1.6rem, 5.5vw, 4rem)' 
      : 'clamp(1.1rem, 3.5vw, 2.4rem)'};
    letter-spacing: ${props => props.$type === 'hakkiyoi' ? '0.1em' : '0.15em'};
    top: ${props => props.$type === 'hakkiyoi' ? '4px' : '2px'};
    left: ${props => props.$type === 'hakkiyoi' ? '4px' : '2px'};
  }
  
  @media (max-width: 600px) {
    font-size: ${props => props.$type === 'hakkiyoi' 
      ? 'clamp(1.2rem, 5vw, 2.8rem)' 
      : 'clamp(0.9rem, 3vw, 1.8rem)'};
    letter-spacing: ${props => props.$type === 'hakkiyoi' ? '0.08em' : '0.12em'};
    top: ${props => props.$type === 'hakkiyoi' ? '3px' : '2px'};
    left: ${props => props.$type === 'hakkiyoi' ? '3px' : '2px'};
  }
`;

// Japanese subtitle for authenticity
const JapaneseSubtext = styled.div`
  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-size: clamp(0.9rem, 2vw, 1.6rem);
  color: ${props => getThemeColors(props.$type).primary};
  letter-spacing: 0.3em;
  margin-top: clamp(6px, 1.2vh, 14px);
  opacity: 0;
  animation: ${cornerFadeIn} ${props => props.$duration || '2.5s'} ease-out forwards;
  animation-delay: 0.15s;
  text-shadow: 
    0 0 10px ${props => getThemeColors(props.$type).glow},
    2px 2px 4px rgba(0, 0, 0, 0.8);
  
  @media (max-width: 600px) {
    font-size: clamp(0.7rem, 1.8vw, 1.1rem);
    letter-spacing: 0.2em;
    margin-top: 4px;
  }
`;

// Brush stroke decoration
const BrushStroke = styled.div`
  position: absolute;
  width: clamp(280px, 45vw, 480px);
  height: clamp(18px, 2.5vh, 32px);
  left: 50%;
  transform: translateX(-50%);
  background: ${props => {
    const colors = getThemeColors(props.$type);
    return `linear-gradient(90deg, transparent 0%, ${colors.primary}40 12%, ${colors.secondary}60 35%, ${colors.primary}70 50%, ${colors.secondary}60 65%, ${colors.primary}40 88%, transparent 100%)`;
  }};
  bottom: clamp(-30px, -4vh, -45px);
  animation: ${brushReveal} ${props => props.$duration || '2.5s'} ease-out forwards;
  border-radius: 50%;
  filter: blur(1px);
  
  @media (max-width: 900px) {
    width: clamp(200px, 40vw, 350px);
    height: clamp(14px, 2vh, 24px);
    bottom: clamp(-22px, -3vh, -32px);
  }
  
  @media (max-width: 600px) {
    width: clamp(150px, 38vw, 250px);
    height: clamp(10px, 1.5vh, 18px);
    bottom: clamp(-16px, -2.5vh, -24px);
  }
`;

// Single ember particle
const Ember = styled.div`
  position: absolute;
  width: ${props => props.$size || '7px'};
  height: ${props => props.$size || '7px'};
  background: ${props => {
    const colors = getThemeColors(props.$type);
    return `radial-gradient(circle, ${colors.text} 0%, ${colors.primary}E0 35%, ${colors.secondary}90 60%, transparent 100%)`;
  }};
  border-radius: 50%;
  animation: ${floatUp} ${props => props.$duration || '1.4s'} ease-out forwards;
  animation-delay: ${props => props.$delay || '0.1s'};
  left: ${props => props.$left || '50%'};
  bottom: ${props => props.$bottom || '0'};
  z-index: 5;
  pointer-events: none;
`;

// ============================================
// COMPONENT
// ============================================

const SumoGameAnnouncement = ({ 
  type = "hakkiyoi", // "hakkiyoi" or "tewotsuite"
  duration = null // auto-determined based on type if not provided
}) => {
  // Determine actual duration
  const actualDuration = duration || (type === "hakkiyoi" ? 1.8 : 2);
  const durationStr = `${actualDuration}s`;
  
  // Get display text
  const displayText = type === "hakkiyoi" ? "HAKKI-YOI !" : "TE WO TSUITE !";
  const japaneseText = type === "hakkiyoi" ? "八卦良い" : "手を付いて";
  
  // Generate stable ember positions using useMemo
  const embers = useMemo(() => {
    const positions = [];
    const emberCount = 5;
    for (let i = 0; i < emberCount; i++) {
      positions.push({
        id: i,
        left: `${30 + (i * 10)}%`,
        bottom: `${-5 + (i % 2) * 8}%`,
        size: `${5 + (i % 3) * 2}px`,
        delay: `${0.12 + (i * 0.08)}s`,
        duration: `${1.2 + (i % 2) * 0.3}s`
      });
    }
    return positions;
  }, []);
  
  // Impact line angles
  const impactLines = useMemo(() => [
    { rotation: 0, delay: '0.03s' },
    { rotation: 45, delay: '0.06s' },
    { rotation: 90, delay: '0.09s' },
    { rotation: 135, delay: '0.12s' },
  ], []);
  
  return (
    <>
      {/* Screen flash */}
      <ScreenFlash $type={type} />
      
      {/* Shockwave ring - only for HAKKIYOI */}
      {type === "hakkiyoi" && (
        <ShockwaveRing $type={type} $delay="0s" />
      )}
      
      {/* Impact lines - only for HAKKIYOI */}
      {type === "hakkiyoi" && impactLines.map((line, i) => (
        <ImpactLine 
          key={i}
          $type={type}
          $delay={line.delay}
          style={{ transform: `rotate(${line.rotation}deg)` }}
        />
      ))}
      
      <AnnouncementContainer>
        {/* Ink splatters - both for hakkiyoi, single subtle one for tewotsuite */}
        <InkSplatter $type={type} $duration={durationStr} />
        {type === "hakkiyoi" && (
          <SecondaryInkSplatter $type={type} $duration={durationStr} />
        )}
        
        {/* Corner decorations - only for hakkiyoi */}
        {type === "hakkiyoi" && (
          <>
            <CornerDecoration $type={type} $position="topLeft" $duration={durationStr} />
            <CornerDecoration $type={type} $position="topRight" $duration={durationStr} />
            <CornerDecoration $type={type} $position="bottomLeft" $duration={durationStr} />
            <CornerDecoration $type={type} $position="bottomRight" $duration={durationStr} />
          </>
        )}
        
        {/* Diamond accents - only for hakkiyoi */}
        {type === "hakkiyoi" && (
          <>
            <DiamondAccent $type={type} $position="left" $duration={durationStr} />
            <DiamondAccent $type={type} $position="right" $duration={durationStr} />
          </>
        )}
        
        <TextContainer>
          <TextShadow $type={type} $duration={durationStr}>{displayText}</TextShadow>
          <MainText $type={type} $duration={durationStr}>{displayText}</MainText>
          {type === "hakkiyoi" && (
            <JapaneseSubtext $type={type} $duration={durationStr}>{japaneseText}</JapaneseSubtext>
          )}
          <BrushStroke $type={type} $duration={durationStr} />
        </TextContainer>
        
        {/* Floating embers - only for hakkiyoi */}
        {type === "hakkiyoi" && embers.map(ember => (
          <Ember
            key={ember.id}
            $type={type}
            $left={ember.left}
            $bottom={ember.bottom}
            $size={ember.size}
            $delay={ember.delay}
            $duration={ember.duration}
          />
        ))}
      </AnnouncementContainer>
    </>
  );
};

SumoGameAnnouncement.propTypes = {
  type: PropTypes.oneOf(["hakkiyoi", "tewotsuite"]),
  duration: PropTypes.number,
};

export default SumoGameAnnouncement;
