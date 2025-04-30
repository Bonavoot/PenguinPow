import { useContext, useEffect } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import Room from "./Room";
import { SocketContext } from "../SocketContext";

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const RoomsContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1280px;
  height: auto;
  aspect-ratio: 16 / 9;
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.95),
    rgba(20, 20, 20, 0.9)
  );
  border-radius: 16px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), transparent);
`;

const Title = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  color: white;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const Button = styled.button`
  background: ${(props) =>
    props.variant === "back"
      ? "linear-gradient(145deg, #FF4444, #CC0000)"
      : "linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))"};
  border: none;
  border-radius: 8px;
  padding: 0.8rem 1.5rem;
  font-size: clamp(0.9rem, 1.5vw, 1.2rem);
  color: white;
  font-family: "Bungee", cursive;
  cursor: pointer;
  transition: all 0.3s ease;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    transform: translateY(-2px);
    background: ${(props) =>
      props.variant === "back"
        ? "linear-gradient(145deg, #FF6666, #FF0000)"
        : "linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1))"};
  }

  &:active {
    transform: translateY(0);
  }
`;

const RoomList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  overflow-y: auto;
  max-height: calc(100% - 100px);

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.5);
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 2vw, 1.5rem);
  text-align: center;
  padding: 2rem;
  animation: ${fadeIn} 0.5s ease-out;
`;

const Rooms = ({ rooms, setRoomName, handleJoinRoom, handleMainMenuPage }) => {
  const { getRooms } = useContext(SocketContext);

  const handleRefresh = () => {
    getRooms();
  };

  useEffect(() => {
    getRooms();
  }, []);

  return (
    <RoomsContainer>
      <Header>
        <Title>Available Rooms</Title>
        <ButtonContainer>
          <Button variant="back" onClick={handleMainMenuPage}>
            BACK
          </Button>
          <Button onClick={handleRefresh}>
            <span className="material-symbols-outlined">refresh</span>
          </Button>
        </ButtonContainer>
      </Header>
      <RoomList>
        {rooms.length === 0 ? (
          <EmptyState>
            No rooms available
            <br />
            Create a new room to start playing!
          </EmptyState>
        ) : (
          rooms.map((room) => (
            <Room
              key={room.id}
              room={room}
              setRoomName={setRoomName}
              handleJoinRoom={handleJoinRoom}
            />
          ))
        )}
      </RoomList>
    </RoomsContainer>
  );
};

Rooms.propTypes = {
  rooms: PropTypes.array.isRequired,
  setRoomName: PropTypes.func.isRequired,
  handleJoinRoom: PropTypes.func.isRequired,
  handleMainMenuPage: PropTypes.func.isRequired,
};

export default Rooms;
