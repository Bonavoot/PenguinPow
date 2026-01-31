import Rematch from "./Rematch";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const bannerDrop = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -60%) scale(0.8);
  }
  60% {
    transform: translate(-50%, -48%) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
`;

const bannerSway = keyframes`
  0%, 100% { transform: translate(-50%, -50%) rotate(-0.5deg); }
  50% { transform: translate(-50%, -50%) rotate(0.5deg); }
`;

const victoryGlow = keyframes`
  0%, 100% { 
    text-shadow: 
      0 0 10px #4ade80,
      0 0 30px #22c55e,
      0 0 50px #16a34a,
      3px 3px 0 #000;
  }
  50% { 
    text-shadow: 
      0 0 20px #4ade80,
      0 0 40px #22c55e,
      0 0 70px #16a34a,
      3px 3px 0 #000;
  }
`;

const defeatPulse = keyframes`
  0%, 100% { 
    text-shadow: 
      0 0 8px #f87171,
      3px 3px 0 #000;
  }
  50% { 
    text-shadow: 
      0 0 15px #f87171,
      0 0 25px #ef4444,
      3px 3px 0 #000;
  }
`;

const tasselSway = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
`;

// Nobori-style banner container
const MatchOverContainer = styled.div`
  position: absolute;
  top: 48%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: clamp(220px, 25vw, 320px);
  z-index: 200;
  animation: ${bannerDrop} 0.5s ease-out forwards, ${bannerSway} 8s ease-in-out 0.5s infinite;
  
  @media (max-width: 1200px) {
    width: clamp(190px, 30vw, 280px);
  }
  
  @media (max-width: 900px) {
    width: clamp(170px, 38vw, 250px);
  }
`;

// Top hanging bar
const HangingBar = styled.div`
  width: 110%;
  height: clamp(14px, 2vh, 22px);
  background: linear-gradient(180deg,
    #5c4033 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border-radius: 4px 4px 0 0;
  margin-left: -5%;
  position: relative;
  border: 2px solid #8b7355;
  border-bottom: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  
  /* Hanging rings */
  &::before, &::after {
    content: "";
    position: absolute;
    top: -8px;
    width: clamp(10px, 1.5vw, 16px);
    height: clamp(10px, 1.5vw, 16px);
    background: radial-gradient(circle at 30% 30%, #d4af37, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  &::before { left: 15%; }
  &::after { right: 15%; }
`;

// Tassels
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
  width: clamp(6px, 1vw, 10px);
  height: clamp(20px, 3vh, 35px);
  background: linear-gradient(180deg, #d4af37 0%, #8b7355 100%);
  border-radius: 0 0 3px 3px;
  animation: ${tasselSway} ${props => 2 + props.$delay * 0.3}s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.15}s;
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

// Main banner body
const BannerBody = styled.div`
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #2d1510 30%,
    #1f0f0a 70%,
    #150805 100%
  );
  border: 3px solid #8b7355;
  border-top: none;
  border-radius: 0 0 clamp(8px, 1.2vw, 14px) clamp(8px, 1.2vw, 14px);
  padding: clamp(18px, 3vh, 30px) clamp(14px, 2vw, 24px) clamp(16px, 2.5vh, 26px);
  box-shadow: 
    0 15px 50px rgba(0,0,0,0.7),
    inset 0 0 40px rgba(0,0,0,0.6),
    inset 0 2px 0 rgba(139, 115, 85, 0.1);
  position: relative;
  
  /* Fabric texture */
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
        rgba(255,255,255,0.015) 1px,
        transparent 2px
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(255,255,255,0.01) 1px,
        transparent 2px
      );
    pointer-events: none;
    border-radius: 0 0 clamp(8px, 1.2vw, 14px) clamp(8px, 1.2vw, 14px);
  }
  
  /* Gold corner decorations */
  &::after {
    content: "";
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    bottom: 10px;
    border: 1px solid rgba(212, 175, 55, 0.15);
    border-radius: clamp(4px, 0.8vw, 10px);
    pointer-events: none;
  }
  
  @media (max-width: 900px) {
    padding: clamp(14px, 2.5vh, 22px) clamp(10px, 1.8vw, 18px) clamp(12px, 2vh, 18px);
    border-width: 2px;
  }
`;

// Result section
const ResultSection = styled.div`
  text-align: center;
  margin-bottom: clamp(14px, 2vh, 22px);
  padding-bottom: clamp(12px, 1.8vh, 18px);
  border-bottom: 2px solid ${props => props.$isWinner ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'};
  position: relative;
  
  /* Decorative end caps on border */
  &::before, &::after {
    content: "◆";
    position: absolute;
    bottom: -8px;
    font-size: clamp(8px, 1vw, 12px);
    color: ${props => props.$isWinner ? '#4ade80' : '#f87171'};
  }
  &::before { left: 20%; }
  &::after { right: 20%; }
`;

const ResultText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 2.8vw, 1.6rem);
  color: ${props => props.$isWinner ? '#4ade80' : '#f87171'};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  animation: ${props => props.$isWinner ? victoryGlow : defeatPulse} 2s ease-in-out infinite;
  
  @media (max-width: 900px) {
    font-size: clamp(0.85rem, 3.5vw, 1.3rem);
  }
`;

const SubText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 1.2vw, 0.75rem);
  color: #e8dcc8;
  margin-top: clamp(6px, 1vh, 10px);
  letter-spacing: 0.12em;
  text-shadow: 2px 2px 0 #000;
  
  @media (max-width: 900px) {
    font-size: clamp(0.42rem, 1.8vw, 0.65rem);
  }
`;

// Rematch section wrapper
const RematchSection = styled.div`
  position: relative;
  z-index: 1;
`;

const MatchOver = ({ winner, roomName, localId }) => {
  const isWinner = localId === winner.id;

  return (
    <MatchOverContainer>
      <HangingBar />
      <BannerBody>
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
