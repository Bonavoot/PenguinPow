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
  top: 45%;
  left: 50%;
  width: min(400px, 30%);
  aspect-ratio: 4/3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: clamp(1rem, 2vw, 1.5rem);
  background: linear-gradient(
    145deg,
    rgba(139, 69, 19, 0.95),
    rgba(44, 24, 16, 0.95),
    rgba(139, 69, 19, 0.95)
  );
  border: 3px solid #d4af37;
  border-radius: 15px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6),
    inset 0 0 20px rgba(212, 175, 55, 0.2);
  animation: ${fadeIn} 0.5s ease-out forwards;
  z-index: 200;
  transform: translate(-50%, -50%);
`;

const ResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.3rem, 1vw, 0.5rem);
  width: 100%;
  padding: clamp(0.8rem, 2vw, 1.2rem);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 2px solid rgba(212, 175, 55, 0.3);
`;

const ResultText = styled.div`
  font-family: "Bungee";
  font-size: clamp(1.2rem, 3vw, 2rem);
  color: ${(props) => (props.isWinner ? "#54d437" : "#ff4444")};
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5);
  text-align: center;
  letter-spacing: 2px;
  line-height: 1.2;
`;

const SubText = styled.span`
  font-family: "Bungee";
  font-size: clamp(0.7rem, 1.5vw, 1rem);
  color: #ffffff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  opacity: 0.9;
  display: block;
  margin-top: clamp(0.2rem, 0.8vw, 0.4rem);
`;

const RematchContainer = styled.div`
  width: 85%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.3rem, 1vw, 0.5rem);
`;

const MatchOver = ({ winner, roomName, localId }) => {
  const isWinner = localId === winner.id;

  return (
    <MatchOverContainer>
      <ResultContainer>
        <ResultText isWinner={isWinner}>
          {isWinner ? "KATCHI-KOSHI" : "MAKE-KOSHI"}
          <SubText>{isWinner ? "(YOU WIN!)" : "(YOU LOSE!)"}</SubText>
        </ResultText>
      </ResultContainer>
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
