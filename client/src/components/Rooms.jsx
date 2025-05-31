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

const snowFall = keyframes`
  0% {
    background-position: 0px 0px;
  }
  100% {
    background-position: 500px 1000px, 400px 400px, 300px 300px;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: ${fadeIn} 0.3s ease-out;
`;

const RoomsContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 90%;
  max-width: 1000px;
  max-height: 80vh;
  background: linear-gradient(
    135deg,
    rgba(28, 28, 28, 0.95),
    rgba(18, 18, 18, 0.95)
  );
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  position: relative;
  overflow: hidden;
  border: 2px solid #8b4513;
  animation: ${fadeIn} 0.3s ease-out;

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
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 2px solid #8b4513;
  background: rgba(18, 18, 18, 0.95);
`;

const Title = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  color: #d4af37;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  font-weight: 700;
  letter-spacing: 1px;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const Button = styled.button`
  background: ${(props) =>
    props.variant === "back"
      ? "linear-gradient(45deg, #2c2c2c, #1a1a1a)"
      : "linear-gradient(145deg, rgba(40, 40, 40, 0.1), rgba(20, 20, 20, 0.05))"};
  border: 2px solid
    ${(props) =>
      props.variant === "back" ? "#d4af37" : "rgba(139, 69, 19, 0.2)"};
  border-radius: 4px;
  padding: 0.8rem 1.5rem;
  font-size: clamp(0.9rem, 1.5vw, 1.2rem);
  color: ${(props) =>
    props.variant === "back" ? "#ffffff" : "rgba(255, 255, 255, 0.7)"};
  font-family: "Bungee", cursive;
  cursor: pointer;
  transition: all 0.3s ease;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  letter-spacing: 1px;

  &:hover {
    transform: translateY(-2px);
    background: ${(props) =>
      props.variant === "back"
        ? "linear-gradient(45deg, #1a1a1a, #0a0a0a)"
        : "linear-gradient(145deg, rgba(50, 50, 50, 0.2), rgba(30, 30, 30, 0.1))"};
    color: ${(props) =>
      props.variant === "back" ? "#ffffff" : "rgba(255, 255, 255, 0.9)"};
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
  max-height: calc(80vh - 100px);

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(30, 30, 30, 0.1);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(139, 69, 19, 0.2);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(139, 69, 19, 0.3);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #ffffff;
  font-family: "Bungee", cursive;
  font-size: clamp(1rem, 2vw, 1.5rem);
  text-align: center;
  padding: 2rem;
  animation: ${fadeIn} 0.5s ease-out;
  font-weight: 500;
  letter-spacing: 1px;
`;

const Rooms = ({ rooms, setRoomName, handleJoinRoom, handleMainMenuPage }) => {
  const { getRooms } = useContext(SocketContext);

  const handleRefresh = () => {
    getRooms();
  };

  useEffect(() => {
    getRooms();
    // Clean up any existing listeners when component unmounts
    return () => {
      // Cleanup if needed
    };
  }, [getRooms]);

  return (
    <ModalOverlay>
      <RoomsContainer>
        <Header>
          <Title>SERVER BROWSER</Title>
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
    </ModalOverlay>
  );
};

Rooms.propTypes = {
  rooms: PropTypes.array.isRequired,
  setRoomName: PropTypes.func.isRequired,
  handleJoinRoom: PropTypes.func.isRequired,
  handleMainMenuPage: PropTypes.func.isRequired,
};

export default Rooms;
