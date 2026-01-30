import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import { playButtonHoverSound, playButtonPressSound, playButtonPressSound2 } from "../utils/soundUtils";

const readyPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(84, 212, 55, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(84, 212, 55, 0);
  }
`;

const RematchWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.2vw, 14px);
  width: 100%;
  padding: clamp(4px, 0.8vw, 10px) 0;
  
  @media (max-width: 1200px) {
    gap: clamp(6px, 1vw, 10px);
    padding: clamp(3px, 0.6vw, 8px) 0;
  }
  
  @media (max-width: 900px) {
    gap: clamp(4px, 0.8vw, 8px);
    padding: clamp(2px, 0.5vw, 6px) 0;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 0.8vw, 8px);
  width: 100%;
  
  @media (max-width: 900px) {
    gap: clamp(3px, 0.6vw, 6px);
  }
`;

// Sumo-styled main button with red theme
const RematchButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.5vw, 0.95rem);
  /* Sumo red gradient */
  background: linear-gradient(135deg, #c41e3a 0%, #8b1428 50%, #c41e3a 100%);
  color: #ffffff;
  border: 2px solid #000;
  border-radius: clamp(4px, 0.8vw, 8px);
  padding: clamp(8px, 1.2vw, 14px) clamp(18px, 2.5vw, 32px);
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  box-shadow: 
    0 3px 10px rgba(0, 0, 0, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.2);
  text-shadow: 
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
  position: relative;
  overflow: hidden;

  /* Inner highlight */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-2px) scale(1.02);
    background: linear-gradient(135deg, #d4283f 0%, #a01830 50%, #d4283f 100%);
    box-shadow: 
      0 5px 14px rgba(0, 0, 0, 0.5),
      inset 0 1px 2px rgba(255, 255, 255, 0.3),
      0 0 15px rgba(196, 30, 58, 0.4);
  }

  &:active {
    transform: translateY(0) scale(1);
  }
  
  @media (max-width: 1200px) {
    font-size: clamp(0.55rem, 1.4vw, 0.85rem);
    padding: clamp(6px, 1vw, 11px) clamp(14px, 2vw, 26px);
  }
  
  @media (max-width: 900px) {
    font-size: clamp(0.45rem, 1.5vw, 0.7rem);
    padding: clamp(5px, 0.9vw, 9px) clamp(12px, 1.8vw, 22px);
    letter-spacing: 0.08em;
    border-radius: clamp(3px, 0.6vw, 6px);
  }
`;

// Cancel button with muted colors
const CancelButton = styled(RematchButton)`
  background: linear-gradient(135deg, #4a4a4a 0%, #2c2c2c 50%, #4a4a4a 100%);
  color: #ff6b6b;
  
  &:hover {
    background: linear-gradient(135deg, #5a5a5a 0%, #3c3c3c 50%, #5a5a5a 100%);
    box-shadow: 
      0 6px 18px rgba(0, 0, 0, 0.5),
      inset 0 1px 2px rgba(255, 255, 255, 0.2),
      0 0 15px rgba(255, 68, 68, 0.3);
  }
`;

// Ready indicator styled like a sumo match counter
const ReadyCount = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 1.1vw, 0.8rem);
  color: ${props => props.$ready ? '#54d437' : '#8b7355'};
  background: rgba(44, 24, 16, 0.9);
  padding: clamp(4px, 0.7vw, 8px) clamp(12px, 1.5vw, 20px);
  border: 2px solid ${props => props.$ready ? '#54d437' : '#8b7355'};
  border-radius: clamp(3px, 0.6vw, 6px);
  text-align: center;
  letter-spacing: 0.15em;
  text-shadow: 
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
  box-shadow: 
    0 2px 6px rgba(0, 0, 0, 0.3),
    inset 0 1px 3px rgba(0, 0, 0, 0.4);
  animation: ${props => props.$ready ? readyPulse : 'none'} 1.5s ease-in-out infinite;
  
  @media (max-width: 1200px) {
    font-size: clamp(0.5rem, 1vw, 0.7rem);
    padding: clamp(3px, 0.6vw, 6px) clamp(10px, 1.2vw, 16px);
  }
  
  @media (max-width: 900px) {
    font-size: clamp(0.4rem, 1.1vw, 0.6rem);
    padding: clamp(3px, 0.5vw, 5px) clamp(8px, 1vw, 12px);
    letter-spacing: 0.1em;
    border-width: 1px;
  }
`;

const ReadyLabel = styled.span`
  font-size: clamp(0.4rem, 0.8vw, 0.6rem);
  color: #d4af37;
  display: block;
  margin-bottom: clamp(1px, 0.3vw, 3px);
  letter-spacing: 0.12em;
  
  @media (max-width: 900px) {
    font-size: clamp(0.32rem, 0.7vw, 0.48rem);
  }
`;

// Exit button - smaller and less prominent
const ExitButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.45rem, 1vw, 0.65rem);
  background: linear-gradient(135deg, #3d2817 0%, #2c1810 50%, #3d2817 100%);
  color: #d4af37;
  border: 2px solid #5c3d2e;
  border-radius: clamp(3px, 0.6vw, 6px);
  padding: clamp(4px, 0.8vw, 8px) clamp(12px, 1.5vw, 20px);
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  text-shadow: 
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;

  &:hover {
    transform: translateY(-2px);
    background: linear-gradient(135deg, #4d3827 0%, #3c2820 50%, #4d3827 100%);
    border-color: #d4af37;
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.4),
      0 0 10px rgba(212, 175, 55, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 1200px) {
    font-size: clamp(0.4rem, 0.9vw, 0.58rem);
    padding: clamp(4px, 0.7vw, 7px) clamp(10px, 1.3vw, 16px);
  }
  
  @media (max-width: 900px) {
    font-size: clamp(0.35rem, 0.95vw, 0.5rem);
    padding: clamp(3px, 0.6vw, 6px) clamp(8px, 1.1vw, 14px);
    letter-spacing: 0.06em;
    border-width: 1px;
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
        <ReadyCount $ready={count > 0}>
          <ReadyLabel>READY</ReadyLabel>
          {count} / 2
        </ReadyCount>
      </ButtonContainer>
      <ExitButton onClick={() => { handleExit(); playButtonPressSound(); }} onMouseEnter={playButtonHoverSound}>EXIT DOHYO</ExitButton>
    </RematchWrapper>
  );
};

Rematch.propTypes = {
  roomName: PropTypes.string.isRequired,
};

export default Rematch;
