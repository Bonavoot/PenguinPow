import Rematch from "./Rematch";
import styled, { keyframes } from "styled-components";
import PropTypes from "prop-types";

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -60%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
`;

const MatchOverContainer = styled.div`
  position: absolute;
  top: 40%;
  left: 50%;
  width: 40%;
  height: 55%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    145deg,
    rgba(0, 0, 0, 0.9),
    rgba(20, 20, 20, 0.9),
    rgba(0, 0, 0, 0.9)
  );
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  animation: ${fadeIn} 0.5s ease-out forwards;
  z-index: 200;
  transform: translate(-50%, -50%);
`;

const WinnerText = styled.div`
  font-family: "Bungee";
  font-size: clamp(1.5rem, 4vw, 3rem);
  color: ${(props) => (props.isWinner ? "#4CAF50" : "#FF4444")};
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin-bottom: 0.5rem;
  text-align: center;
`;

const ResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
`;

const ResultText = styled.span`
  font-family: "Bungee";
  font-size: clamp(0.8rem, 2vw, 1.5rem);
  color: #ffffff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
`;

const MatchOver = ({ winner, roomName, localId }) => {
  const isWinner = localId === winner.id;

  return (
    <MatchOverContainer>
      <ResultContainer>
        <WinnerText isWinner={isWinner}>
          {isWinner ? "KATCHI-KOSHI" : "MAKE-KOSHI"}
        </WinnerText>
        <ResultText>{isWinner ? "(YOU WIN!)" : "(YOU LOSE!)"}</ResultText>
      </ResultContainer>
      <Rematch roomName={roomName} />
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
