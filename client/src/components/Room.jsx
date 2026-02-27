import { useContext } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import { SocketContext } from "../SocketContext";
import { playButtonHoverSound, playButtonPressSound2 } from "../utils/soundUtils";

// ============================================
// ANIMATIONS
// ============================================

const slideIn = keyframes`
  0% {
    opacity: 0;
    transform: translateX(-20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
`;

const pulseAvailable = keyframes`
  0%, 100% {
    box-shadow: 
      0 4px 15px rgba(0,0,0,0.4),
      0 0 0 rgba(74, 222, 128, 0),
      inset 0 0 20px rgba(0,0,0,0.4);
  }
  50% {
    box-shadow: 
      0 4px 15px rgba(0,0,0,0.4),
      0 0 15px rgba(74, 222, 128, 0.15),
      inset 0 0 20px rgba(0,0,0,0.4);
  }
`;

// ============================================
// ROOM CARD
// ============================================

const RoomCard = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #241210 50%,
    #1a0a08 100%
  );
  border: 2px solid ${props => props.$isFull ? '#4a3a2a' : '#8b7355'};
  border-radius: clamp(6px, 0.8cqw, 10px);
  padding: clamp(14px, 2cqh, 22px) clamp(18px, 2.5cqw, 28px);
  position: relative;
  transition: all 0.25s ease;
  animation: ${slideIn} 0.4s ease-out;
  
  ${props => !props.$isFull && css`
    animation: ${slideIn} 0.4s ease-out, ${pulseAvailable} 3s ease-in-out infinite;
    animation-delay: 0s, 0.4s;
  `}
  
  /* Fabric texture */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        rgba(255,255,255,0.01) 1px,
        transparent 2px
      );
    pointer-events: none;
    border-radius: clamp(6px, 0.8cqw, 10px);
  }

  &:hover {
    transform: translateX(6px);
    background: linear-gradient(180deg,
      #241210 0%,
      #2d1815 50%,
      #241210 100%
    );
    border-color: ${props => props.$isFull ? '#5c4a3a' : '#d4af37'};
  }
`;

const RoomInfo = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(16px, 2.5cqw, 32px);
`;

const RoomIdSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.3cqh, 4px);
`;

const RoomLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.7cqw, 0.5rem);
  color: #5c4033;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const RoomId = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.4cqw, 1.15rem);
  color: #e8dcc8;
  text-shadow: 2px 2px 0 #000;
  letter-spacing: 0.05em;
`;

const PlayerCount = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(6px, 0.8cqw, 10px);
`;

const PlayerDot = styled.div`
  width: clamp(10px, 1.2cqw, 14px);
  height: clamp(10px, 1.2cqw, 14px);
  border-radius: 50%;
  background: ${props => props.$filled ? '#4ade80' : 'rgba(92, 64, 51, 0.5)'};
  border: 2px solid ${props => props.$filled ? '#4ade80' : '#5c4033'};
  ${props => props.$filled && css`
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
  `}
`;

const PlayerCountText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1cqw, 0.8rem);
  color: ${props => props.$isFull ? '#5c4033' : '#8b7355'};
  text-shadow: 1px 1px 0 #000;
`;

const StatusBadge = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.7cqw, 0.55rem);
  color: ${props => props.$isFull ? '#5c4033' : '#4ade80'};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: clamp(4px, 0.6cqh, 7px) clamp(10px, 1.5cqw, 16px);
  background: ${props => props.$isFull 
    ? 'rgba(92, 64, 51, 0.2)' 
    : 'rgba(74, 222, 128, 0.1)'};
  border: 1px solid ${props => props.$isFull ? '#4a3a2a' : 'rgba(74, 222, 128, 0.3)'};
  border-radius: clamp(3px, 0.4cqw, 5px);
  ${props => !props.$isFull && css`
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.1);
  `}
`;

// ============================================
// JOIN BUTTON
// ============================================

const JoinButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1cqw, 0.8rem);
  background: ${props => props.$isFull ? css`
    linear-gradient(180deg,
      #2a2a2a 0%,
      #1f1f1f 50%,
      #151515 100%
    )
  ` : css`
    linear-gradient(180deg,
      #2d5a2d 0%,
      #1f4a1f 50%,
      #153815 100%
    )
  `};
  color: ${props => props.$isFull ? '#555' : '#4ade80'};
  border: 2px solid ${props => props.$isFull ? '#3a3a3a' : '#4ade80'};
  border-radius: clamp(4px, 0.6cqw, 8px);
  padding: clamp(10px, 1.4cqh, 16px) clamp(20px, 2.8cqw, 32px);
  cursor: ${props => props.$isFull ? 'not-allowed' : 'pointer'};
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  box-shadow: ${props => props.$isFull 
    ? '0 4px 12px rgba(0,0,0,0.3)' 
    : '0 4px 12px rgba(0,0,0,0.4), 0 0 15px rgba(74, 222, 128, 0.15)'};
  text-shadow: ${props => props.$isFull 
    ? 'none' 
    : '0 0 10px rgba(74, 222, 128, 0.3), 1px 1px 0 #000'};
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
    border-radius: clamp(4px, 0.6cqw, 8px);
    pointer-events: none;
  }

  ${props => !props.$isFull && css`
    &:hover {
      background: linear-gradient(180deg,
        #3d6a3d 0%,
        #2d5a2d 50%,
        #1f4a1f 100%
      );
      border-color: #6ade90;
      transform: translateY(-3px);
      box-shadow: 
        0 8px 20px rgba(0,0,0,0.5),
        0 0 25px rgba(74, 222, 128, 0.25);
      color: #8afe9f;
    }

    &:active {
      transform: translateY(-1px);
    }
  `}
`;

// ============================================
// COMPONENT
// ============================================

const Room = ({ room, setRoomName, handleJoinRoom }) => {
  const { socket } = useContext(SocketContext);
  const isFull = room.players.length === 2;

  const handleJoin = () => {
    if (!isFull) {
      socket.emit("join_room", { socketId: socket.id, roomId: room.id });
      setRoomName(room.id);
      handleJoinRoom();
    }
  };

  return (
    <RoomCard $isFull={isFull}>
      <RoomInfo>
        <RoomIdSection>
          <RoomLabel>Dohyo</RoomLabel>
          <RoomId>{room.id}</RoomId>
        </RoomIdSection>
        <PlayerCount>
          <PlayerDot $filled={room.players.length >= 1} />
          <PlayerDot $filled={room.players.length >= 2} />
          <PlayerCountText $isFull={isFull}>
            {room.players.length}/2
          </PlayerCountText>
        </PlayerCount>
        <StatusBadge $isFull={isFull}>
          {isFull ? "Full" : "Open"}
        </StatusBadge>
      </RoomInfo>
      <JoinButton
        $isFull={isFull}
        onClick={() => { 
          if (!isFull) {
            handleJoin(); 
            playButtonPressSound2(); 
          }
        }}
        onMouseEnter={() => !isFull && playButtonHoverSound()}
        disabled={isFull}
      >
        {isFull ? "Full" : "Join"}
      </JoinButton>
    </RoomCard>
  );
};

Room.propTypes = {
  room: PropTypes.shape({
    id: PropTypes.string.isRequired,
    players: PropTypes.array.isRequired,
  }).isRequired,
  setRoomName: PropTypes.func.isRequired,
  handleJoinRoom: PropTypes.func.isRequired,
};

export default Room;
