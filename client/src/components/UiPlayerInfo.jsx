import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";

const glow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.4)); }
  50% { filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.6)); }
`;

const PlayerInfoContainer = styled.div`
  height: 10%;
  width: 100%;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.8),
    rgba(0, 0, 0, 0.6)
  );
  display: flex;
  gap: 5%;
  justify-content: space-between;
  align-items: center;
  color: white;
  text-align: center;
  font-family: "Bungee";
  padding: 0 2%;
  box-sizing: border-box;
  border-top: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      #ff6b6b,
      #4ecdc4,
      #45b7d1,
      #96e6a1,
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
  height: 80%;
  width: 20%;
  min-width: 120px;
  max-width: 200px;
  background: linear-gradient(
    145deg,
    rgba(40, 40, 40, 0.9),
    rgba(20, 20, 20, 0.9)
  );
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.1);
`;

const Rank = styled.div`
  font-size: clamp(0.8rem, 1.2vw, 1.2rem);
  color: #ffd700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin-bottom: 4px;
  letter-spacing: 1px;
  animation: ${glow} 2s infinite;
`;

const Record = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-size: clamp(0.7rem, 1vw, 1rem);
`;

const PlayerName = styled.div`
  height: 80%;
  width: 20%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: clamp(0.8rem, 1.5vw, 1.8rem);
  background: linear-gradient(
    145deg,
    rgba(60, 60, 60, 0.9),
    rgba(30, 30, 30, 0.9)
  );
  border-radius: 16px;
  padding: 8px 16px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.1);
  transition: background 0.3s ease;

  &:hover {
    background: linear-gradient(
      145deg,
      rgba(70, 70, 70, 0.9),
      rgba(40, 40, 40, 0.9)
    );
  }
`;

const Scoreboard = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1vw;
  padding: 0 2vw;
  background: linear-gradient(
    145deg,
    rgba(50, 50, 50, 0.9),
    rgba(30, 30, 30, 0.9)
  );
  border-radius: 16px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.1);
`;

const WinCount = styled.div`
  font-size: clamp(1rem, 2vw, 2.5rem);
  color: ${(props) => (props.isPlayer1 ? "#00FFFF" : "#FF6B6B")};
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
`;

const Dash = styled.div`
  font-size: clamp(1rem, 2vw, 2.5rem);
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin: 0 8px;
`;

const WinCircle = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #4caf50;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
  animation: ${glow} 2s infinite;
`;

const LossCircle = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff4444;
  box-shadow: 0 0 8px rgba(255, 68, 68, 0.5);
  animation: ${glow} 2s infinite;
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
