import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";

const subtleGlow = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.8; }
`;

const subtlePulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const PlayerInfoContainer = styled.div`
  height: clamp(40px, 8vh, 90px);
  width: 100%;
  /* background: rgba(18, 18, 18, 0.95); */
  display: flex;
  gap: clamp(0.5%, 1.5vw, 3%);
  justify-content: space-between;
  align-items: center;
  color: white;
  text-align: center;
  font-family: "Bungee", "Impact", sans-serif;
  padding: 0 clamp(0.5%, 1.5vw, 3%);
  box-sizing: border-box;
  /* border-bottom: 1px solid rgba(255, 255, 255, 0.1); */
  /* box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2); */
  position: relative;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease-out;
  z-index: 1000;
`;

const RankRecordContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: clamp(35px, 65%, 65px);
  width: clamp(100px, 18%, 220px);
  min-width: 100px;
  max-width: 220px;
  background: rgba(28, 28, 28, 0.95);
  padding: clamp(4px, 1vh, 8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  animation: ${fadeIn} 0.5s ease-out;
`;

const Rank = styled.div`
  font-size: clamp(0.7rem, 1.2vw + 0.2rem, 1.6rem);
  color: #ffffff;
  text-shadow: none;
  margin-bottom: clamp(1px, 0.4vh, 4px);
  letter-spacing: 0.5px;
  font-weight: 600;
  text-transform: uppercase;
`;

const Record = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(2px, 0.8vw, 8px);
  font-size: clamp(0.6rem, 0.9vw + 0.1rem, 1.2rem);
  background: rgba(0, 0, 0, 0.2);
  padding: clamp(2px, 0.4vh, 4px) clamp(4px, 1vw, 8px);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
`;

const PlayerName = styled.div`
  height: clamp(35px, 65%, 65px);
  width: clamp(90px, 18%, 200px);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: clamp(0.8rem, 1.5vw + 0.2rem, 2.2rem);
  background: rgba(28, 28, 28, 0.95);
  padding: clamp(4px, 0.8vh, 8px) clamp(8px, 1.5vw, 16px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  text-shadow: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  letter-spacing: 0.5px;

  &:hover {
    background: rgba(35, 35, 35, 0.95);
  }
`;

const Scoreboard = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(0.3vw, 1vw, 1.5vw);
  padding: 0 clamp(1.5vw, 3vw, 4vw);
  height: clamp(40px, 65%, 65px);
  background: rgba(28, 28, 28, 0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
`;

const WinCount = styled.div`
  font-size: clamp(0.9rem, 2vw + 0.5rem, 3.5rem);
  color: ${(props) => (props.isPlayer1 ? "#00F0FF" : "#FF3D3D")};
  text-shadow: none;
  font-weight: 600;
  animation: ${subtlePulse} 3s infinite;
`;

const Dash = styled.div`
  font-size: clamp(0.9rem, 2vw + 0.5rem, 3.5rem);
  color: rgba(255, 255, 255, 0.3);
  text-shadow: none;
  margin: 0 clamp(4px, 1vw, 8px);
  font-weight: 300;
`;

const WinCircle = styled.div`
  width: clamp(6px, 1vh, 12px);
  height: clamp(6px, 1vh, 12px);
  border-radius: 50%;
  background: #00f0ff;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
  animation: ${subtleGlow} 3s infinite;
`;

const LossCircle = styled.div`
  width: clamp(6px, 1vh, 12px);
  height: clamp(6px, 1vh, 12px);
  border-radius: 50%;
  background: #ff3d3d;
  box-shadow: 0 0 8px rgba(255, 61, 61, 0.4);
  animation: ${subtleGlow} 3s infinite;
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
