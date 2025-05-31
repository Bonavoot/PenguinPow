import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";

const subtlePulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

const woodGrain = keyframes`
  0% { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
`;

const PlayerInfoContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: clamp(65px, 7vh, 80px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 clamp(20px, 3vw, 60px);
  background: linear-gradient(
    135deg,
    rgba(139, 69, 19, 0.98),
    rgba(101, 67, 33, 0.95)
  );
  border-bottom: 3px solid rgba(212, 175, 55, 0.6);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  font-family: "Bungee", cursive;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%238b4513' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E");
    opacity: 0.15;
    animation: ${woodGrain} 8s linear infinite;
    pointer-events: none;
  }

  @media (max-width: 1200px) {
    height: clamp(60px, 6.5vh, 75px);
    padding: 0 clamp(15px, 2vw, 40px);
  }

  @media (max-width: 768px) {
    height: clamp(55px, 6vh, 70px);
    padding: 0 clamp(10px, 1.5vw, 20px);
  }
`;

const PlayerSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(3px, 0.4vh, 6px);
  width: clamp(120px, 15vw, 160px);
  flex-shrink: 0;
  min-width: 0;
  height: 100%;
  justify-content: center;

  @media (max-width: 768px) {
    width: clamp(100px, 12vw, 130px);
    gap: clamp(2px, 0.3vh, 4px);
  }
`;

const Rank = styled.div`
  font-size: clamp(9px, 1.2vw, 11px);
  color: #d4af37;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
  letter-spacing: clamp(1px, 0.2vw, 1.5px);
  font-weight: 600;
  text-transform: uppercase;
  background: linear-gradient(
    145deg,
    rgba(44, 24, 16, 0.98),
    rgba(34, 14, 6, 0.98)
  );
  padding: clamp(2px, 0.3vh, 3px) clamp(6px, 1vw, 10px);
  border-radius: 4px;
  border: 1px solid rgba(212, 175, 55, 0.6);
  white-space: nowrap;
  backdrop-filter: blur(2px);
  line-height: 1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const PlayerName = styled.div`
  height: clamp(32px, 3.8vh, 38px);
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: clamp(14px, 1.8vw, 20px);
  background: linear-gradient(
    145deg,
    rgba(44, 24, 16, 0.98),
    rgba(34, 14, 6, 0.98)
  );
  padding: 0 clamp(8px, 1vw, 16px);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
  text-shadow: 2px 2px 3px rgba(0, 0, 0, 0.4);
  border: 2px solid rgba(212, 175, 55, 0.6);
  border-radius: 8px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color:rgb(255, 255, 255);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  min-width: 0;
  line-height: 1;

  @media (max-width: 768px) {
    height: clamp(28px, 3.5vh, 34px);
    font-size: clamp(12px, 1.6vw, 18px);
  }
`;

const ScoreContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(6px, 1vw, 12px);
  padding: 0 clamp(12px, 1.5vw, 24px);
  height: clamp(40px, 4.5vh, 50px);
  background: linear-gradient(
    145deg,
    rgba(44, 24, 16, 0.98),
    rgba(34, 14, 6, 0.98)
  );
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
  border: 2px solid rgba(212, 175, 55, 0.6);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  min-width: 0;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      45deg,
      transparent 0%,
      rgba(212, 175, 55, 0.05) 50%,
      transparent 100%
    );
    animation: ${woodGrain} 8s linear infinite;
  }

  @media (max-width: 768px) {
    height: clamp(36px, 4vh, 46px);
    padding: 0 clamp(8px, 1vw, 16px);
    gap: clamp(4px, 0.8vw, 8px);
  }
`;

const ScoreCircle = styled.div`
  width: clamp(14px, 1.8vw, 18px);
  height: clamp(14px, 1.8vw, 18px);
  border-radius: 50%;
  border: 2px solid rgba(212, 175, 55, 0.8);
  background: ${(props) =>
    props.$isFilled ? (props.$isWin ? "#ffffff" : "#000000") : "transparent"};
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  animation: ${(props) => (props.$isFilled ? subtlePulse : "none")} 3s infinite;
  flex-shrink: 0;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 50%;
    background: radial-gradient(
      circle at center,
      rgba(212, 175, 55, 0.2) 0%,
      transparent 70%
    );
    opacity: ${(props) => (props.$isFilled ? 1 : 0)};
    transition: opacity 0.3s ease;
  }

  @media (max-width: 768px) {
    width: clamp(12px, 1.6vw, 16px);
    height: clamp(12px, 1.6vw, 16px);
  }
`;

const UiPlayerInfo = ({ playerOneWinCount, playerTwoWinCount }) => {
  const renderScoreCircles = (winCount, isPlayerOne = false) => {
    const circles = [];
    for (let i = 0; i < 4; i++) {
      const index = isPlayerOne ? 3 - i : i;
      circles.push(
        <ScoreCircle key={i} $isFilled={index < winCount} $isWin={true} />
      );
    }
    return circles;
  };

  return (
    <PlayerInfoContainer>
      <PlayerSection>
        <Rank>Jonokuchi</Rank>
        <PlayerName>PLAYER 1</PlayerName>
      </PlayerSection>
      <ScoreContainer>
        {renderScoreCircles(playerOneWinCount, true)}
      </ScoreContainer>
      <ScoreContainer>
        {renderScoreCircles(playerTwoWinCount, false)}
      </ScoreContainer>
      <PlayerSection>
        <Rank>Jonokuchi</Rank>
        <PlayerName>PLAYER 2</PlayerName>
      </PlayerSection>
    </PlayerInfoContainer>
  );
};

UiPlayerInfo.propTypes = {
  playerOneWinCount: PropTypes.number.isRequired,
  playerTwoWinCount: PropTypes.number.isRequired,
};

export default UiPlayerInfo;
