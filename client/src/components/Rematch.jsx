import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import { playButtonHoverSound, playButtonPressSound, playButtonPressSound2 } from "../utils/soundUtils";

const readyGlow = keyframes`
  0%, 100% {
    box-shadow: 
      inset 0 0 8px rgba(74, 222, 128, 0.3),
      0 0 12px rgba(74, 222, 128, 0.2);
  }
  50% {
    box-shadow: 
      inset 0 0 12px rgba(74, 222, 128, 0.5),
      0 0 20px rgba(74, 222, 128, 0.4);
  }
`;

const RematchWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(10px, 1.5vh, 16px);
  width: 100%;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.2vh, 14px);
  width: 100%;
`;

// Wooden plaque style button
const RematchButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 1.3vw, 0.85rem);
  width: 100%;
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  color: #d4af37;
  border: 2px solid #8b7355;
  border-radius: clamp(4px, 0.7vw, 8px);
  padding: clamp(10px, 1.5vh, 16px) clamp(16px, 2.5vw, 28px);
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  box-shadow: 
    0 4px 12px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.1),
    inset 0 -2px 4px rgba(0,0,0,0.3);
  text-shadow: 
    2px 2px 0 #000,
    0 0 10px rgba(212, 175, 55, 0.3);
  position: relative;
  
  /* Wood grain */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      90deg,
      transparent 0px,
      rgba(255,255,255,0.02) 1px,
      transparent 3px
    );
    border-radius: clamp(4px, 0.7vw, 8px);
    pointer-events: none;
  }

  &:hover {
    background: linear-gradient(180deg,
      #5c4530 0%,
      #4a3525 50%,
      #3d2817 100%
    );
    border-color: #d4af37;
    transform: translateY(-2px);
    box-shadow: 
      0 6px 18px rgba(0,0,0,0.5),
      0 0 20px rgba(212, 175, 55, 0.2),
      inset 0 1px 0 rgba(255,255,255,0.15),
      inset 0 -2px 4px rgba(0,0,0,0.3);
    color: #f0d080;
  }

  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 900px) {
    font-size: clamp(0.45rem, 1.8vw, 0.7rem);
    padding: clamp(8px, 1.2vh, 12px) clamp(12px, 2vw, 20px);
  }
`;

// Cancel - darker/muted
const CancelButton = styled(RematchButton)`
  background: linear-gradient(180deg,
    #2a2a2a 0%,
    #1f1f1f 50%,
    #151515 100%
  );
  color: #999;
  border-color: #444;
  text-shadow: 1px 1px 0 #000;
  
  &:hover {
    background: linear-gradient(180deg,
      #3a3a3a 0%,
      #2a2a2a 50%,
      #1f1f1f 100%
    );
    border-color: #666;
    color: #ccc;
    box-shadow: 
      0 6px 18px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.1);
  }
`;

// Ready counter - like a small wooden sign
const ReadyCount = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.4vw, 1rem);
  color: ${props => props.$ready ? '#4ade80' : '#8b7355'};
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #0f0505 100%
  );
  padding: clamp(8px, 1.2vh, 12px) clamp(20px, 3vw, 32px);
  border: 2px solid ${props => props.$ready ? '#4ade80' : '#5c4033'};
  border-radius: clamp(4px, 0.6vw, 7px);
  text-align: center;
  letter-spacing: 0.12em;
  text-shadow: 
    1px 1px 0 #000,
    ${props => props.$ready ? '0 0 8px rgba(74, 222, 128, 0.5)' : 'none'};
  animation: ${props => props.$ready ? readyGlow : 'none'} 1.5s ease-in-out infinite;
  position: relative;
  
  /* Corner decorations */
  &::before, &::after {
    content: "●";
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: clamp(4px, 0.6vw, 7px);
    color: ${props => props.$ready ? '#4ade80' : '#5c4033'};
  }
  &::before { left: clamp(6px, 1vw, 10px); }
  &::after { right: clamp(6px, 1vw, 10px); }
  
  @media (max-width: 900px) {
    font-size: clamp(0.55rem, 2vw, 0.85rem);
    padding: clamp(6px, 1vh, 10px) clamp(14px, 2.5vw, 24px);
  }
`;

const ReadyLabel = styled.span`
  font-size: clamp(0.38rem, 0.8vw, 0.55rem);
  color: rgba(212, 175, 55, 0.7);
  display: block;
  margin-bottom: clamp(3px, 0.5vh, 5px);
  letter-spacing: 0.18em;
  
  @media (max-width: 900px) {
    font-size: clamp(0.32rem, 1.2vw, 0.45rem);
  }
`;

// Exit - subtle, like stamped text
const ExitButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.38rem, 0.8vw, 0.52rem);
  background: transparent;
  color: rgba(139, 115, 85, 0.6);
  border: none;
  padding: clamp(4px, 0.6vh, 8px) clamp(10px, 1.5vw, 16px);
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-top: clamp(4px, 0.8vh, 10px);
  position: relative;

  /* Underline decoration */
  &::after {
    content: "";
    position: absolute;
    bottom: 2px;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(139, 115, 85, 0.4), transparent);
    transition: all 0.2s ease;
  }

  &:hover {
    color: rgba(212, 175, 55, 0.8);
    
    &::after {
      left: 10%;
      right: 10%;
      background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.6), transparent);
    }
  }

  &:active {
    color: rgba(139, 115, 85, 0.5);
  }
  
  @media (max-width: 900px) {
    font-size: clamp(0.32rem, 1.1vw, 0.45rem);
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
          <ReadyLabel>FIGHTERS READY</ReadyLabel>
          {count} / 2
        </ReadyCount>
      </ButtonContainer>
      <ExitButton onClick={() => { handleExit(); playButtonPressSound(); }} onMouseEnter={playButtonHoverSound}>← Leave Dohyo</ExitButton>
    </RematchWrapper>
  );
};

Rematch.propTypes = {
  roomName: PropTypes.string.isRequired,
};

export default Rematch;
