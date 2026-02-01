import styled, { keyframes, css } from "styled-components";
import PropTypes from "prop-types";

// ============================================
// ANIMATIONS
// ============================================

// Banner drops in from top with subtle swing
const bannerDropIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-100%) rotate(var(--swing-start));
  }
  35% {
    opacity: 1;
    transform: translateY(3%) rotate(calc(var(--swing-start) * -0.15));
  }
  55% {
    transform: translateY(-1%) rotate(calc(var(--swing-start) * 0.05));
  }
  75% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
`;

// Tassel sway animation - subtle movement
const tasselSway = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
`;

// Text glow pulse
const textGlow = keyframes`
  0%, 100% {
    text-shadow: 
      -2px -2px 0 #000, 2px -2px 0 #000, 
      -2px 2px 0 #000, 2px 2px 0 #000,
      0 0 8px var(--glow-color);
  }
  50% {
    text-shadow: 
      -2px -2px 0 #000, 2px -2px 0 #000, 
      -2px 2px 0 #000, 2px 2px 0 #000,
      0 0 15px var(--glow-color),
      0 0 25px var(--glow-color);
  }
`;

// ============================================
// STYLED COMPONENTS
// ============================================

// Color themes for different actions
const getThemeColors = (type) => {
  switch (type) {
    case "parry":
      return {
        primary: "#00BFFF",
        secondary: "#006699",
        glow: "rgba(0, 191, 255, 0.8)",
        accent: "#87CEEB",
      };
    case "perfect":
      return {
        primary: "#FFD700",
        secondary: "#B8860B",
        glow: "rgba(255, 215, 0, 0.8)",
        accent: "#FFF8DC",
      };
    case "counter":
      return {
        primary: "#FF3366",
        secondary: "#9933FF",
        glow: "rgba(255, 51, 102, 0.8)",
        accent: "#FF99AA",
      };
    case "break":
      return {
        primary: "#00FF88",
        secondary: "#008844",
        glow: "rgba(0, 255, 136, 0.8)",
        accent: "#88FFBB",
      };
    default:
      return {
        primary: "#d4af37",
        secondary: "#8b7355",
        glow: "rgba(212, 175, 55, 0.8)",
        accent: "#f0d080",
      };
  }
};

const BannerWrapper = styled.div`
  position: fixed;
  top: clamp(160px, 38%, 250px);
  ${props => props.$isLeftSide ? 'left: 1.5%;' : 'right: 1.5%;'}
  z-index: 200;
  pointer-events: none;
  --swing-start: ${props => props.$isLeftSide ? '-8deg' : '8deg'};
  --glow-color: ${props => getThemeColors(props.$type).glow};
  animation: ${bannerDropIn} ${props => props.$duration || 1.5}s ease-out forwards;
  transform-origin: top center;
  
  @media (max-width: 900px) {
    top: clamp(130px, 30%, 190px);
  }
`;

const BannerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

// Hanging rope/cord at top
const HangingCord = styled.div`
  width: 2px;
  height: clamp(6px, 1vh, 10px);
  background: linear-gradient(180deg, #5c4033 0%, #3d2817 100%);
  border-radius: 2px;
`;

// Top wooden bar
const TopBar = styled.div`
  width: clamp(62px, 10vw, 115px);
  height: clamp(7px, 1.1vh, 12px);
  background: linear-gradient(180deg,
    #5c4033 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border-radius: 3px 3px 0 0;
  border: 1px solid #8b7355;
  border-bottom: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  position: relative;
  
  /* Small gold decorative caps */
  &::before, &::after {
    content: "";
    position: absolute;
    top: -2px;
    width: clamp(5px, 0.9vw, 9px);
    height: clamp(5px, 0.9vw, 9px);
    background: radial-gradient(circle at 30% 30%, #d4af37, #8b7355);
    border-radius: 50%;
    border: 1px solid #5c4033;
  }
  &::before { left: 8%; }
  &::after { right: 8%; }
  
  @media (max-width: 900px) {
    width: clamp(50px, 13vw, 90px);
  }
`;

// Main banner body
const BannerBody = styled.div`
  width: clamp(58px, 9.5vw, 110px);
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #2d1510 30%,
    #1f0f0a 70%,
    #150805 100%
  );
  border: 2px solid ${props => getThemeColors(props.$type).primary};
  border-top: none;
  border-radius: 0 0 clamp(4px, 0.5vw, 7px) clamp(4px, 0.5vw, 7px);
  padding: clamp(8px, 1.1vh, 12px) clamp(6px, 0.9vw, 11px);
  box-shadow: 
    0 4px 15px rgba(0,0,0,0.5),
    inset 0 0 20px rgba(0,0,0,0.5),
    0 0 10px ${props => getThemeColors(props.$type).glow};
  position: relative;
  
  /* Fabric texture overlay */
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
        rgba(255,255,255,0.02) 1px,
        transparent 2px
      );
    pointer-events: none;
    border-radius: inherit;
  }
  
  @media (max-width: 900px) {
    width: clamp(46px, 12vw, 85px);
    padding: clamp(6px, 0.9vh, 10px) clamp(5px, 0.7vw, 9px);
  }
`;

// Japanese-style vertical text container
const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(2px, 0.3vh, 4px);
`;

// Main announcement text
const AnnouncementText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.48rem, 1vw, 0.85rem);
  color: ${props => getThemeColors(props.$type).primary};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
  line-height: 1.15;
  white-space: pre-line;
  animation: ${textGlow} 1.2s ease-in-out infinite;
  --glow-color: ${props => getThemeColors(props.$type).glow};
  
  @media (max-width: 900px) {
    font-size: clamp(0.4rem, 1.3vw, 0.68rem);
  }
`;

// Small decorative line separator
const Separator = styled.div`
  width: 60%;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    ${props => getThemeColors(props.$type).primary} 30%,
    ${props => getThemeColors(props.$type).accent} 50%,
    ${props => getThemeColors(props.$type).primary} 70%,
    transparent 100%
  );
  margin: clamp(3px, 0.4vh, 6px) 0;
`;

// Tassels at the bottom - positioned at corners of banner body
const TasselContainer = styled.div`
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 clamp(5px, 0.7vw, 10px);
`;

const Tassel = styled.div`
  width: clamp(3px, 0.45vw, 5px);
  height: clamp(10px, 1.4vh, 16px);
  background: linear-gradient(180deg, 
    ${props => getThemeColors(props.$type).primary} 0%, 
    ${props => getThemeColors(props.$type).secondary} 100%
  );
  border-radius: 0 0 2px 2px;
  animation: ${tasselSway} ${props => 1.5 + props.$delay * 0.3}s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.15}s;
  transform-origin: top center;
`;

// ============================================
// COMPONENT
// ============================================

const SumoAnnouncementBanner = ({ 
  text, 
  type = "default", 
  isLeftSide = true,
  duration = 1.5,
  subText = null 
}) => {
  return (
    <BannerWrapper $isLeftSide={isLeftSide} $type={type} $duration={duration}>
      <BannerContainer>
        <HangingCord />
        <TopBar />
        <BannerBody $type={type}>
          <TextContainer>
            <AnnouncementText $type={type}>
              {text}
            </AnnouncementText>
            {subText && (
              <>
                <Separator $type={type} />
                <AnnouncementText $type={type} style={{ fontSize: '0.7em', opacity: 0.8 }}>
                  {subText}
                </AnnouncementText>
              </>
            )}
          </TextContainer>
          {/* Tassels positioned at bottom corners */}
          <TasselContainer>
            <Tassel $type={type} $delay={0} />
            <Tassel $type={type} $delay={1} />
          </TasselContainer>
        </BannerBody>
      </BannerContainer>
    </BannerWrapper>
  );
};

SumoAnnouncementBanner.propTypes = {
  text: PropTypes.string.isRequired,
  type: PropTypes.oneOf(["parry", "perfect", "counter", "break", "default"]),
  isLeftSide: PropTypes.bool,
  duration: PropTypes.number,
  subText: PropTypes.string,
};

export default SumoAnnouncementBanner;
