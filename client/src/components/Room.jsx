import { useContext } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import { SocketContext } from "../SocketContext";

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

const RoomContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(
    145deg,
    rgba(40, 40, 40, 0.9),
    rgba(20, 20, 20, 0.9)
  );
  border-radius: 12px;
  padding: 1.2rem 2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  will-change: transform;
  transform: translateZ(0);
  transition: transform 0.2s ease;
  animation: ${fadeIn} 0.3s ease-out;

  &:hover {
    transform: translateX(5px) translateZ(0);
    background: linear-gradient(
      145deg,
      rgba(50, 50, 50, 0.9),
      rgba(30, 30, 30, 0.9)
    );
  }
`;

const RoomInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 2rem;
`;

const RoomId = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 1.5vw, 1.5rem);
  color: white;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
`;

const PlayerCount = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: "Bungee", cursive;
  font-size: clamp(0.9rem, 1.2vw, 1.2rem);
  color: rgba(255, 255, 255, 0.8);
`;

const PlayerCountCircle = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${(props) =>
    props.isFull ? "rgba(255, 68, 68, 0.2)" : "rgba(76, 175, 80, 0.2)"};
  border: 2px solid ${(props) => (props.isFull ? "#FF4444" : "#4CAF50")};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: ${(props) => (props.isFull ? "#FF4444" : "#4CAF50")};
  box-shadow: 0 0 10px
    ${(props) =>
      props.isFull ? "rgba(255, 68, 68, 0.3)" : "rgba(76, 175, 80, 0.3)"};
`;

const JoinButton = styled.button`
  background: ${(props) =>
    props.isFull
      ? "linear-gradient(145deg, rgba(255, 68, 68, 0.2), rgba(255, 68, 68, 0.1))"
      : "linear-gradient(145deg, #4CAF50, #388E3C)"};
  border: none;
  border-radius: 8px;
  padding: 0.8rem 2rem;
  font-size: clamp(0.9rem, 1.2vw, 1.2rem);
  color: ${(props) => (props.isFull ? "rgba(255, 255, 255, 0.5)" : "white")};
  font-family: "Bungee", cursive;
  cursor: ${(props) => (props.isFull ? "default" : "pointer")};
  will-change: transform;
  transform: translateZ(0);
  transition: transform 0.2s ease;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  border: 1px solid
    ${(props) =>
      props.isFull ? "rgba(255, 68, 68, 0.3)" : "rgba(76, 175, 80, 0.3)"};
  min-width: 120px;

  &:hover {
    transform: ${(props) => (props.isFull ? "none" : "translateY(-2px) translateZ(0)")};
    background: ${(props) =>
      props.isFull
        ? "linear-gradient(145deg, rgba(255, 68, 68, 0.2), rgba(255, 68, 68, 0.1))"
        : "linear-gradient(145deg, #66BB6A, #43A047)"};
  }

  &:active {
    transform: ${(props) => (props.isFull ? "none" : "translateY(0) translateZ(0)")};
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
          <PlayerCountCircle isFull={isFull}>
            {room.players.length}
          </PlayerCountCircle>
          / 2
        </PlayerCount>
      </RoomInfo>
      <JoinButton isFull={isFull} onClick={handleJoin}>
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
