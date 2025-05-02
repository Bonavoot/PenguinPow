import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";

const glow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 3px rgba(255, 221, 0, 0.4)); }
  50% { filter: drop-shadow(0 0 8px rgba(219, 255, 38, 0.6)); }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const slideIn = keyframes`
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const PlayerInfoContainer = styled.div`
  height: clamp(60px, 8vh, 80px);
  width: 100%;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.9),
    rgba(0, 0, 0, 0.7)
  );
  display: flex;
  gap: clamp(1%, 2vw, 3%);
  justify-content: space-between;
  align-items: center;
  color: white;
  text-align: center;
  font-family: "Bungee", "Impact", sans-serif;
  padding: 0 clamp(1%, 2vw, 3%);
  box-sizing: border-box;
  border-top: clamp(2px, 0.2vh, 3px) solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: clamp(2px, 0.2vh, 3px);
    background: linear-gradient(
      90deg,
      #ff6b6b,
      #ffd700,
      #4ecdc4,
      #ffd700,
      #ff6b6b
    );
    animation: ${glow} 3s infinite;
  }
`;

const RankRecordContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: clamp(45px, 70%, 60px);
  width: clamp(140px, 18%, 220px);
  min-width: 140px;
  max-width: 220px;
  background: linear-gradient(
    145deg,
    rgba(60, 60, 60, 0.95),
    rgba(30, 30, 30, 0.95)
  );
  padding: clamp(6px, 1vh, 8px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  border: clamp(1px, 0.15vh, 2px) solid rgba(255, 215, 0, 0.3);
  border-radius: clamp(4px, 0.6vh, 8px);
  animation: ${slideIn} 0.5s ease-out;
`;

const Rank = styled.div`
  font-size: clamp(0.8rem, 1.2vw + 0.2rem, 1.4rem);
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
  margin-bottom: clamp(2px, 0.4vh, 4px);
  letter-spacing: clamp(1px, 0.2vw, 2px);
  animation: ${glow} 2s infinite;
  font-weight: bold;
  text-transform: uppercase;
`;

const Record = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(4px, 0.8vw, 8px);
  font-size: clamp(0.7rem, 0.9vw + 0.1rem, 1.1rem);
  background: rgba(0, 0, 0, 0.3);
  padding: clamp(3px, 0.4vh, 4px) clamp(6px, 1vw, 8px);
  border-radius: clamp(8px, 1.5vh, 16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const PlayerName = styled.div`
  height: clamp(45px, 70%, 60px);
  width: clamp(120px, 18%, 200px);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: clamp(0.9rem, 1.5vw + 0.2rem, 2rem);
  background: linear-gradient(
    145deg,
    rgba(80, 80, 80, 0.95),
    rgba(40, 40, 40, 0.95)
  );
  padding: clamp(6px, 0.8vh, 8px) clamp(10px, 1.5vw, 16px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.7);
  border: clamp(1px, 0.15vh, 2px) solid rgba(255, 215, 0, 0.3);
  border-radius: clamp(4px, 0.6vh, 8px);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      45deg,
      transparent 0%,
      rgba(255, 215, 0, 0.1) 50%,
      transparent 100%
    );
    animation: ${pulse} 2s infinite;
  }
`;

const Scoreboard = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(1vw, 2vw, 3vw);
  padding: 0 clamp(2vw, 3vw, 4vw);
  height: clamp(45px, 70%, 60px);
  background: linear-gradient(
    145deg,
    rgba(70, 70, 70, 0.95),
    rgba(40, 40, 40, 0.95)
  );
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  border: clamp(1px, 0.15vh, 2px) solid rgba(255, 215, 0, 0.3);
  border-radius: clamp(4px, 0.6vh, 8px);
  position: relative;
  overflow: hidden;

  &::before {
    content: "VS";
    position: absolute;
    font-size: clamp(1.2rem, 2vw + 0.5rem, 3rem);
    color: rgba(255, 215, 0, 0.1);
    font-weight: bold;
    transform: rotate(-15deg);
  }
`;

const WinCount = styled.div`
  font-size: clamp(1rem, 2vw + 0.5rem, 3rem);
  color: ${(props) => (props.isPlayer1 ? "#00FFFF" : "#FF6B6B")};
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.7);
  font-weight: bold;
  animation: ${pulse} 2s infinite;
`;

const Dash = styled.div`
  font-size: clamp(1rem, 2vw + 0.5rem, 3rem);
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
  margin: 0 clamp(6px, 1vw, 8px);
  font-weight: bold;
`;

const WinCircle = styled.div`
  width: clamp(8px, 1vh, 12px);
  height: clamp(8px, 1vh, 12px);
  border-radius: 50%;
  background: #4caf50;
  box-shadow: 0 0 12px rgba(76, 175, 80, 0.7);
  animation: ${pulse} 2s infinite;
`;

const LossCircle = styled.div`
  width: clamp(8px, 1vh, 12px);
  height: clamp(8px, 1vh, 12px);
  border-radius: 50%;
  background: #ff4444;
  box-shadow: 0 0 12px rgba(255, 68, 68, 0.7);
  animation: ${pulse} 2s infinite;
`;

const UiPlayerInfo = ({ playerOneWinCount, playerTwoWinCount }) => {
  return (
    <PlayerInfoContainer>
      <RankRecordContainer>
        <Rank>UNRANKED</Rank>
        <Record>
          <WinCircle />
          <span>{playerOneWinCount}</span>
          <LossCircle />
          <span>{playerTwoWinCount}</span>
        </Record>
      </RankRecordContainer>

      <PlayerName>PLAYER 1</PlayerName>
      <Scoreboard>
        <WinCount isPlayer1>{playerOneWinCount}</WinCount>
        <Dash>-</Dash>
        <WinCount>{playerTwoWinCount}</WinCount>
      </Scoreboard>
      <PlayerName>PLAYER 2</PlayerName>
      <RankRecordContainer>
        <Rank>UNRANKED</Rank>
        <Record>
          <WinCircle />
          <span>{playerTwoWinCount}</span>
          <LossCircle />
          <span>{playerOneWinCount}</span>
        </Record>
      </RankRecordContainer>
    </PlayerInfoContainer>
  );
};

UiPlayerInfo.propTypes = {
  playerOneWinCount: PropTypes.number.isRequired,
  playerTwoWinCount: PropTypes.number.isRequired,
};

export default UiPlayerInfo;
