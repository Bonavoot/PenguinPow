import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled from "styled-components";
import { playButtonHoverSound, playButtonPressSound, playButtonPressSound2 } from "../utils/soundUtils";

const RematchWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.3rem, 1vw, 0.5rem);
  width: 100%;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  width: 100%;
`;

const RematchButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.8rem, 2vw, 1.2rem);
  background: linear-gradient(45deg, #8b4513, #6b3410);
  color: #d4af37;
  border: 2px solid #d4af37;
  border-radius: 8px;
  padding: clamp(0.4rem, 1.5vw, 0.8rem) clamp(0.8rem, 2vw, 1.2rem);
  cursor: pointer;
  transition: all 0.3s ease;
  width: min(100%, 200px);
  text-transform: uppercase;
  letter-spacing: 2px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);

  &:hover {
    transform: translateY(-2px);
    background: linear-gradient(45deg, #6b3410, #4a2410);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

const CancelButton = styled(RematchButton)`
  background: linear-gradient(45deg, #6b3410, #4a2410);
  color: #ff4444;
  border-color: #ff4444;

  &:hover {
    background: linear-gradient(45deg, #4a2410, #2c1810);
  }
`;

const ReadyCount = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.5vw, 0.9rem);
  color: rgb(255, 255, 255);
  background: rgba(0, 0, 0, 0.3);
  padding: clamp(0.2rem, 0.8vw, 0.4rem) clamp(0.8rem, 1.5vw, 1.2rem);
  border: 1px solid #d4af37;
  border-top: none;
  text-align: center;
  min-width: min(80px, 60%);
`;

const ExitButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.5vw, 0.8rem);
  background: linear-gradient(45deg, #2c2c2c, #1a1a1a);
  color: rgb(255, 255, 255);
  border: 2px solid #d4af37;
  border-radius: 6px;
  padding: clamp(0.3rem, 1.2vw, 0.6rem) clamp(0.6rem, 1.5vw, 1.2rem);
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  width: min(100%, 150px);

  &:hover {
    transform: translateY(-2px);
    background: linear-gradient(45deg, #1a1a1a, #0a0a0a);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Rematch = ({ roomName }) => {
  const [rematch, setRematch] = useState(false);
  const [count, setCount] = useState(0);
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    socket.on("rematch_count", (rematchCount) => {
      setCount(rematchCount);
    });
  });

  const handleRematch = (e) => {
    if (e.target.textContent === "REMATCH") {
      setRematch(true);
      socket.emit("rematch_count", {
        playerId: socket.id,
        acceptedRematch: true,
        roomId: roomName,
      });
    } else {
      setRematch(false);
      socket.emit("rematch_count", {
        playerId: socket.id,
        acceptedRematch: false,
        roomId: roomName,
      });
    }
  };

  const handleExit = () => {
    setCount(0);
    window.location.reload(false);
  };

  return (
    <RematchWrapper>
      <ButtonContainer>
        {rematch ? (
          <CancelButton onClick={(e) => { handleRematch(e); playButtonPressSound(); }} onMouseEnter={playButtonHoverSound}>CANCEL</CancelButton>
        ) : (
          <RematchButton onClick={(e) => { handleRematch(e); playButtonPressSound2(); }} onMouseEnter={playButtonHoverSound}>REMATCH</RematchButton>
        )}
        <ReadyCount>{count} / 2</ReadyCount>
      </ButtonContainer>
      <ExitButton onClick={() => { handleExit(); playButtonPressSound(); }} onMouseEnter={playButtonHoverSound}>EXIT</ExitButton>
    </RematchWrapper>
  );
};

Rematch.propTypes = {
  roomName: PropTypes.string.isRequired,
};

export default Rematch;
