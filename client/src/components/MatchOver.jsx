import Rematch from "./Rematch";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
`;

const winPulse = keyframes`
  0%, 100% {
    text-shadow: 
      -2px -2px 0 #000,
      2px -2px 0 #000,
      -2px 2px 0 #000,
      2px 2px 0 #000,
      0 0 20px rgba(84, 212, 55, 0.8);
  }
  50% {
    text-shadow: 
      -2px -2px 0 #000,
      2px -2px 0 #000,
      -2px 2px 0 #000,
      2px 2px 0 #000,
      0 0 35px rgba(84, 212, 55, 1);
  }
`;

const losePulse = keyframes`
  0%, 100% {
    text-shadow: 
      -2px -2px 0 #000,
      2px -2px 0 #000,
      -2px 2px 0 #000,
      2px 2px 0 #000,
      0 0 15px rgba(255, 68, 68, 0.6);
  }
  50% {
    text-shadow: 
      -2px -2px 0 #000,
      2px -2px 0 #000,
      -2px 2px 0 #000,
      2px 2px 0 #000,
      0 0 25px rgba(255, 68, 68, 0.9);
  }
`;

// Main container with parchment-style background
const MatchOverContainer = styled.div`
  position: absolute;
  top: 45%;
  left: 50%;
  width: clamp(260px, 28vw, 380px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(12px, 2vw, 24px);
  /* Parchment paper background */
  background: linear-gradient(135deg, #f9f3e8 0%, #ebe0cf 50%, #ddd2bd 100%);
  /* Red sumo border */
  border: clamp(2px, 0.3vw, 4px) solid #c41e3a;
  border-radius: clamp(8px, 1.2vw, 14px);
  box-shadow: 
    0 6px 24px rgba(0, 0, 0, 0.5),
    inset 0 2px 4px rgba(255, 255, 255, 0.4),
    0 0 0 clamp(2px, 0.25vw, 3px) #000;
  animation: ${slideIn} 0.4s ease-out forwards;
  z-index: 200;
  transform: translate(-50%, -50%);
  
  /* Paper texture overlay */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: clamp(6px, 1vw, 12px);
    background-image: 
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(139, 119, 101, 0.03) 2px,
        rgba(139, 119, 101, 0.03) 4px
      );
    pointer-events: none;
    opacity: 0.6;
  }
  
  /* Inner decorative border */
  &::after {
    content: "";
    position: absolute;
    top: clamp(4px, 0.6vw, 8px);
    left: clamp(4px, 0.6vw, 8px);
    right: clamp(4px, 0.6vw, 8px);
    bottom: clamp(4px, 0.6vw, 8px);
    border: 1px solid rgba(196, 30, 58, 0.3);
    border-radius: clamp(5px, 0.8vw, 9px);
    pointer-events: none;
  }
  
  @media (max-width: 1200px) {
    width: clamp(220px, 32vw, 340px);
    padding: clamp(10px, 1.8vw, 20px);
  }
  
  @media (max-width: 900px) {
    width: clamp(180px, 38vw, 280px);
    padding: clamp(8px, 1.5vw, 16px);
  }
  
  @media (max-height: 700px) {
    top: 42%;
  }
`;

// Top banner with sumo colors
const ResultBanner = styled.div`
  width: calc(100% + clamp(24px, 4vw, 48px));
  margin: clamp(-12px, -2vw, -24px) 0 clamp(8px, 1.5vw, 16px) 0;
  padding: clamp(8px, 1.2vw, 14px) clamp(12px, 1.5vw, 20px);
  background: ${props => props.$isWinner 
    ? 'linear-gradient(135deg, #2d5a27 0%, #1e3d1a 50%, #2d5a27 100%)'
    : 'linear-gradient(135deg, #8b1e3a 0%, #5c1428 50%, #8b1e3a 100%)'
  };
  border-bottom: 2px solid ${props => props.$isWinner ? '#54d437' : '#ff4444'};
  border-radius: clamp(6px, 1vw, 12px) clamp(6px, 1vw, 12px) 0 0;
  text-align: center;
  position: relative;
  z-index: 2;
  
  @media (max-width: 1200px) {
    width: calc(100% + clamp(20px, 3.6vw, 40px));
    margin: clamp(-10px, -1.8vw, -20px) 0 clamp(6px, 1.2vw, 12px) 0;
    padding: clamp(6px, 1vw, 10px) clamp(10px, 1.2vw, 16px);
  }
  
  @media (max-width: 900px) {
    width: calc(100% + clamp(16px, 3vw, 32px));
    margin: clamp(-8px, -1.5vw, -16px) 0 clamp(5px, 1vw, 10px) 0;
    padding: clamp(5px, 0.8vw, 8px) clamp(8px, 1vw, 12px);
  }
`;

const ResultText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.9rem, 2.2vw, 1.5rem);
  color: ${props => props.$isWinner ? '#54d437' : '#ff4444'};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  animation: ${props => props.$isWinner ? winPulse : losePulse} 2s ease-in-out infinite;
  
  @media (max-width: 1200px) {
    font-size: clamp(0.8rem, 2vw, 1.3rem);
  }
  
  @media (max-width: 900px) {
    font-size: clamp(0.65rem, 2.2vw, 1rem);
    letter-spacing: 0.08em;
  }
`;

const SubText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 1.1vw, 0.75rem);
  color: #ffffff;
  text-shadow: 
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
  margin-top: clamp(2px, 0.4vw, 6px);
  letter-spacing: 0.08em;
  
  @media (max-width: 1200px) {
    font-size: clamp(0.45rem, 1vw, 0.65rem);
  }
  
  @media (max-width: 900px) {
    font-size: clamp(0.38rem, 1.1vw, 0.55rem);
    margin-top: clamp(1px, 0.3vw, 4px);
  }
`;

// Divider with sumo rope style
const Divider = styled.div`
  width: 80%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #c41e3a, #d4af37, #c41e3a, transparent);
  margin: clamp(5px, 0.8vw, 10px) 0;
  position: relative;
  z-index: 2;
  
  @media (max-width: 900px) {
    height: 1px;
    margin: clamp(3px, 0.6vw, 7px) 0;
  }
`;

const RematchContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 2;
`;

const MatchOver = ({ winner, roomName, localId }) => {
  const isWinner = localId === winner.id;

  return (
    <MatchOverContainer>
      <ResultBanner $isWinner={isWinner}>
        <ResultText $isWinner={isWinner}>
          {isWinner ? "KACHI-KOSHI" : "MAKE-KOSHI"}
        </ResultText>
        <SubText>{isWinner ? "VICTORY!" : "DEFEAT!"}</SubText>
      </ResultBanner>
      <Divider />
      <RematchContainer>
        <Rematch roomName={roomName} />
      </RematchContainer>
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
