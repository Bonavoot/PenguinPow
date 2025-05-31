import { useContext } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import { SocketContext } from "../SocketContext";
import { playButtonHoverSound, playButtonPressSound2 } from "../utils/soundUtils";

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const snowFall = keyframes`
  0% {
    background-position: 0px 0px;
  }
  100% {
    background-position: 500px 1000px, 400px 400px, 300px 300px;
  }
`;

const RoomContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(
    145deg,
    rgba(28, 28, 28, 0.95),
    rgba(18, 18, 18, 0.95)
  );
  border-radius: 8px;
  padding: 1.2rem 2.5rem;
  border: 2px solid #8b4513;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  will-change: transform;
  transform: translateZ(0);
  transition: transform 0.2s ease;
  animation: ${fadeIn} 0.3s ease-out;
  position: relative;
  overflow: hidden;
  min-height: 60px;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(
        2px 2px at 20px 30px,
        rgba(212, 175, 55, 0.2) 50%,
        rgba(0, 0, 0, 0)
      ),
      radial-gradient(
        2px 2px at 40px 70px,
        rgba(212, 175, 55, 0.2) 50%,
        rgba(0, 0, 0, 0)
      ),
      radial-gradient(
        2px 2px at 50px 160px,
        rgba(212, 175, 55, 0.2) 50%,
        rgba(0, 0, 0, 0)
      );
    background-size: 200px 200px;
    animation: ${snowFall} 8s linear infinite;
    opacity: 0.2;
    pointer-events: none;
  }

  &:hover {
    transform: translateX(5px) translateZ(0);
    background: linear-gradient(
      145deg,
      rgba(35, 35, 35, 0.95),
      rgba(25, 25, 25, 0.95)
    );
  }
`;

const RoomInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 2.5rem;
`;

const RoomId = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.2rem, 1.5vw, 1.6rem);
  color: #ffffff;
  margin: 0;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  font-weight: 700;
  letter-spacing: 1px;
`;

const PlayerCount = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 1.2vw, 1.3rem);
  color: #ffffff;
  font-weight: 600;
`;

const PlayerCountCircle = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${(props) =>
    props.$isFull ? "rgba(40, 40, 40, 0.2)" : "rgba(30, 30, 30, 0.2)"};
  border: 2px solid ${(props) => (props.$isFull ? "#8b4513" : "#d4af37")};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: ${(props) => (props.$isFull ? "#8b4513" : "#ffffff")};
  box-shadow: 0 0 10px
    ${(props) =>
      props.$isFull ? "rgba(40, 40, 40, 0.3)" : "rgba(30, 30, 30, 0.3)"};
  font-weight: 600;
`;

const JoinButton = styled.button`
  background: ${(props) =>
    props.$isFull
      ? "linear-gradient(145deg, rgba(40, 40, 40, 0.2), rgba(20, 20, 20, 0.1))"
      : "linear-gradient(45deg,rgb(3, 150, 3),rgb(0, 150, 0))"};
  border: 2px solid ${(props) => (props.$isFull ? "#8b4513" : "rgb(3, 150, 3)")};
  border-radius: 4px;
  padding: 0.75rem 2rem;
  font-size: clamp(0.9rem, 1.2vw, 1.2rem);
  color: ${(props) => (props.$isFull ? "rgba(255, 255, 255, 0.5)" : "#ffffff")};
  font-family: "Noto Sans JP", sans-serif;
  cursor: ${(props) => (props.$isFull ? "default" : "pointer")};
  will-change: transform;
  transform: translateZ(0);
  transition: all 0.3s ease;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: ${(props) =>
    props.$isFull
      ? "0 4px 15px rgba(0, 0, 0, 0.2)"
      : "0 0 5px rgba(0, 255, 0, 0.3)"};
  min-width: 120px;
  font-weight: 600;
  letter-spacing: 1px;
  height: fit-content;

  &:hover {
    transform: ${(props) =>
      props.$isFull ? "none" : "translateY(-2px) translateZ(0)"};
    background: ${(props) =>
      props.$isFull
        ? "linear-gradient(145deg, rgba(40, 40, 40, 0.2), rgba(20, 20, 20, 0.1))"
        : "linear-gradient(45deg, #00cc00, #009900)"};
    color: ${(props) =>
      props.$isFull ? "rgba(255, 255, 255, 0.5)" : "#ffffff"};
    box-shadow: ${(props) =>
      props.$isFull
        ? "0 4px 15px rgba(0, 0, 0, 0.2)"
        : "0 0 8px rgba(0, 255, 0, 0.4)"};
  }

  &:active {
    transform: ${(props) =>
      props.$isFull ? "none" : "translateY(0) translateZ(0)"};
    box-shadow: ${(props) =>
      props.$isFull
        ? "0 4px 15px rgba(0, 0, 0, 0.2)"
        : "0 0 3px rgba(0, 255, 0, 0.2)"};
  }
`;

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
    <RoomContainer>
      <RoomInfo>
        <RoomId>{room.id}</RoomId>
        <PlayerCount>
          <PlayerCountCircle $isFull={isFull}>
            {room.players.length}
          </PlayerCountCircle>
          / 2
        </PlayerCount>
      </RoomInfo>
      <JoinButton
        $isFull={isFull}
        onClick={() => { handleJoin(); playButtonPressSound2(); }}
        onMouseEnter={playButtonHoverSound}
      >
        {isFull ? "FULL" : "JOIN"}
      </JoinButton>
    </RoomContainer>
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
