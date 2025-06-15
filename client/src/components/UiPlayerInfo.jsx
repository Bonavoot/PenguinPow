import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";

const subtlePulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const scoreGlow = keyframes`
  /* 0% { box-shadow: 0 0 5px rgba(212, 175, 55, 0.3); }
  50% { box-shadow: 0 0 15px rgba(212, 175, 55, 0.6); }
  100% { box-shadow: 0 0 5px rgba(212, 175, 55, 0.3); } */
`;

const PlayerInfoContainer = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: clamp(900px, 85vw, 1400px);
  height: clamp(80px, 8vh, 100px);
  display: flex;
  align-items: center;
  border-radius: 12px;
  z-index: 1000;
  font-family: "Bungee", cursive;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0.3;
    border-radius: 9px;
    pointer-events: none;
  }

  @media (max-width: 1200px) {
    width: clamp(800px, 80vw, 1200px);
    height: clamp(70px, 7vh, 90px);
    top: 15px;
  }

  @media (max-width: 768px) {
    width: clamp(90vw, 95vw, 600px);
    height: clamp(60px, 6vh, 80px);
    top: 10px;
  }
`;

const PlayerSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 clamp(10px, 1.5vw, 20px);
  gap: clamp(12px, 1.5vw, 20px);
  position: relative;
  min-width: 0;

  @media (max-width: 1200px) {
    padding: 0 clamp(8px, 1.2vw, 18px);
  }

  @media (max-width: 768px) {
    padding: 0 clamp(6px, 1vw, 15px);
    gap: clamp(8px, 1vw, 12px);
    flex-direction: column;
    text-align: center;
  }
`;

const PlayerDetails = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.5vh, 6px);
  width: 100%;
  max-width: clamp(140px, 16vw, 180px);
  flex-shrink: 0;

  @media (max-width: 768px) {
    align-items: center;
    gap: clamp(2px, 0.3vh, 4px);
    max-width: clamp(120px, 14vw, 150px);
  }
`;

const Rank = styled.div`
  font-size: clamp(10px, 1.1vw, 12px);
  color: #d4af37;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.6);
  letter-spacing: clamp(0.5px, 0.1vw, 1px);
  font-weight: 600;
  text-transform: uppercase;
  background: linear-gradient(135deg, #121213, rgba(20, 19, 19, 0.9));
  padding: clamp(2px, 0.3vh, 4px) clamp(8px, 1vw, 12px);
  border-radius: 6px;
  border: 1px solid rgba(212, 175, 55, 0.7);
  white-space: nowrap;
  backdrop-filter: blur(4px);
  line-height: 1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const PlayerName = styled.div`
  font-size: clamp(16px, 2vw, 22px);
  background: linear-gradient(135deg, #121213, rgba(20, 19, 19, 0.95));
  padding: clamp(6px, 0.8vh, 10px) clamp(12px, 1.5vw, 20px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(212, 175, 55, 0.7);
  border-radius: 8px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgb(255, 255, 255);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  line-height: 1;
  min-width: clamp(100px, 12vw, 140px);
  text-align: center;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transition: left 0.6s ease;
  }

  @media (max-width: 768px) {
    font-size: clamp(14px, 1.8vw, 18px);
    min-width: clamp(80px, 10vw, 120px);
  }
`;

const CenterScoreSection = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(35px, 5vw, 60px);
  padding: 0 clamp(30px, 3vw, 45px);

  @media (max-width: 768px) {
    gap: clamp(20px, 3vw, 30px);
    padding: 0 clamp(15px, 2vw, 25px);
  }
`;

const ScoreContainer = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.2vw, 16px);
  padding: clamp(8px, 1vh, 12px) clamp(12px, 1.5vw, 16px);
  background: linear-gradient(135deg, #121213, rgba(20, 19, 19, 0.98));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4),
    inset 0 2px 4px rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(212, 175, 55, 0.8);
  border-radius: 10px;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(4px);
  animation: ${(props) => (props.$hasWins ? scoreGlow : "none")} 2s ease-in-out
    infinite;

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
      rgba(212, 175, 55, 0.08) 50%,
      transparent 100%
    );
  }

  @media (max-width: 768px) {
    gap: clamp(6px, 0.8vw, 10px);
    padding: clamp(6px, 0.8vh, 10px) clamp(8px, 1vw, 12px);
  }
`;

const ScoreCircle = styled.div`
  width: clamp(16px, 2vw, 20px);
  height: clamp(16px, 2vw, 20px);
  border-radius: 50%;
  border: 2px solid rgba(212, 175, 55, 0.9);
  background: ${(props) => (props.$isFilled ? "#ffffff" : "transparent")};
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${(props) =>
    props.$isFilled
      ? "0 0 12px rgba(255, 255, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)"
      : "0 2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.1)"};
  animation: ${(props) => (props.$isFilled ? subtlePulse : "none")} 2s infinite;
  flex-shrink: 0;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 60%;
    height: 60%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: ${(props) =>
      props.$isFilled
        ? "radial-gradient(circle, rgba(212, 175, 55, 0.8) 0%, rgba(212, 175, 55, 0.2) 100%)"
        : "none"};
    opacity: ${(props) => (props.$isFilled ? 0.6 : 0)};
    transition: opacity 0.4s ease;
  }

  @media (max-width: 768px) {
    width: clamp(14px, 1.8vw, 18px);
    height: clamp(14px, 1.8vw, 18px);
  }
`;

const VSText = styled.div`
  font-size: clamp(14px, 1.6vw, 18px);
  color: #d4af37;
  font-weight: 700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  letter-spacing: 2px;
  background: linear-gradient(135deg, #121213, rgba(20, 19, 19, 0.95));
  padding: clamp(4px, 0.6vh, 8px) clamp(8px, 1vw, 12px);
  border: 2px solid rgba(212, 175, 55, 0.6);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);

  @media (max-width: 768px) {
    font-size: clamp(12px, 1.4vw, 16px);
    letter-spacing: 1px;
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
      <PlayerSection $isLeft={true}>
        <PlayerDetails $isLeft={true}>
          <Rank>Jonokuchi</Rank>
          <PlayerName>PLAYER 1</PlayerName>
        </PlayerDetails>
      </PlayerSection>

      <CenterScoreSection>
        <ScoreContainer $hasWins={playerOneWinCount > 0}>
          {renderScoreCircles(playerOneWinCount, true)}
        </ScoreContainer>

        <VSText>VS</VSText>

        <ScoreContainer $hasWins={playerTwoWinCount > 0}>
          {renderScoreCircles(playerTwoWinCount, false)}
        </ScoreContainer>
      </CenterScoreSection>

      <PlayerSection $isLeft={false}>
        <PlayerDetails $isLeft={false}>
          <Rank>Jonokuchi</Rank>
          <PlayerName>PLAYER 2</PlayerName>
        </PlayerDetails>
      </PlayerSection>
    </PlayerInfoContainer>
  );
};

UiPlayerInfo.propTypes = {
  playerOneWinCount: PropTypes.number.isRequired,
  playerTwoWinCount: PropTypes.number.isRequired,
};

export default UiPlayerInfo;
