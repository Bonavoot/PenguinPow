import { useContext, useEffect, useState } from "react";
import Player from "./Player";
import { SocketContext } from "../SocketContext";
import { v4 as uuidv4 } from "uuid";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import lobbyBackground from "../assets/lobby-bkg.webp";

// ============================================
// ANIMATIONS
// ============================================

const fadeIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

const slideInLeft = keyframes`
  0% {
    opacity: 0;
    transform: translateX(-30px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
`;

const slideInRight = keyframes`
  0% {
    opacity: 0;
    transform: translateX(30px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
`;

const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 
      0 0 20px rgba(212, 175, 55, 0.2),
      inset 0 0 30px rgba(0,0,0,0.5);
  }
  50% {
    box-shadow: 
      0 0 30px rgba(212, 175, 55, 0.35),
      inset 0 0 30px rgba(0,0,0,0.5);
  }
`;

const breathe = keyframes`
  0%, 100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(1.02);
  }
`;

const dotPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
`;

const readyGlow = keyframes`
  0%, 100% {
    box-shadow: 
      inset 0 0 8px rgba(74, 222, 128, 0.3),
      0 0 12px rgba(74, 222, 128, 0.2),
      0 4px 12px rgba(0,0,0,0.4);
  }
  50% {
    box-shadow: 
      inset 0 0 12px rgba(74, 222, 128, 0.5),
      0 0 20px rgba(74, 222, 128, 0.4),
      0 4px 12px rgba(0,0,0,0.4);
  }
`;

const versusFloat = keyframes`
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.05);
  }
`;

// ============================================
// MAIN CONTAINER
// ============================================

const LobbyContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(180deg,
    #0a0505 0%,
    #150a08 50%,
    #0a0505 100%
  );
  position: relative;
  overflow: hidden;
`;

const BackgroundImage = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url(${lobbyBackground}) center/cover;
  opacity: 0.08;
  z-index: 0;
`;

// ============================================
// HEADER
// ============================================

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(12px, 2vh, 20px) clamp(20px, 3vw, 40px);
  background: linear-gradient(180deg,
    rgba(26, 10, 8, 0.95) 0%,
    rgba(21, 8, 5, 0.9) 100%
  );
  border-bottom: 3px solid #8b7355;
  position: relative;
  z-index: 10;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  
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
  }
`;

const LogoSection = styled.div`
  animation: ${fadeIn} 0.4s ease-out;
`;

const LobbyTitle = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.2rem, 2.8vw, 2rem);
  color: #d4af37;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 
    3px 3px 0 #000,
    0 0 20px rgba(212, 175, 55, 0.3);
`;

const LobbySubtitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.45rem, 0.9vw, 0.7rem);
  color: #8b7355;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-top: clamp(2px, 0.3vh, 4px);
  text-shadow: 1px 1px 0 #000;
`;

const RoomBadge = styled.div`
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #0f0505 100%
  );
  padding: clamp(8px, 1.2vh, 14px) clamp(14px, 2vw, 24px);
  border: 2px solid #8b7355;
  border-radius: clamp(4px, 0.6vw, 8px);
  text-align: center;
  animation: ${fadeIn} 0.4s ease-out 0.1s both;
  box-shadow: 
    0 4px 12px rgba(0,0,0,0.4),
    inset 0 0 20px rgba(0,0,0,0.4);
`;

const RoomLabel = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.8vw, 0.55rem);
  color: #8b7355;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: clamp(2px, 0.4vh, 6px);
`;

const RoomCode = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.7rem, 1.4vw, 1rem);
  color: #d4af37;
  letter-spacing: 0.08em;
  text-shadow: 1px 1px 0 #000;
`;

// ============================================
// ARENA SECTION
// ============================================

const ArenaSection = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 3vh, 32px);
  position: relative;
  z-index: 1;
`;

const ArenaContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(40px, 8vw, 120px);
  position: relative;
  width: 100%;
  max-width: 1100px;
`;

// Versus badge in center
const VersusBadge = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-family: "Noto Serif JP", serif;
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  color: #d4af37;
  text-shadow: 
    4px 4px 0 #000,
    0 0 30px rgba(212, 175, 55, 0.4);
  z-index: 5;
  animation: ${versusFloat} 3s ease-in-out infinite;
  
  &::before, &::after {
    content: "";
    position: absolute;
    top: 50%;
    width: clamp(30px, 5vw, 60px);
    height: 3px;
    background: linear-gradient(90deg, transparent, #8b7355, transparent);
  }
  &::before { right: 100%; margin-right: 15px; }
  &::after { left: 100%; margin-left: 15px; }
`;

// ============================================
// PLAYER CARD
// ============================================

const PlayerSlot = styled.div`
  width: clamp(200px, 28vw, 320px);
  animation: ${props => props.$side === 'left' ? slideInLeft : slideInRight} 0.5s ease-out ${props => props.$side === 'left' ? '0.2s' : '0.3s'} both;
`;

const PlayerCard = styled.div`
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #2d1510 30%,
    #1f0f0a 70%,
    #150805 100%
  );
  border: 3px solid ${props => props.$hasPlayer ? '#8b7355' : '#5c4033'};
  border-radius: clamp(8px, 1.2vw, 14px);
  overflow: hidden;
  position: relative;
  box-shadow: 
    0 10px 40px rgba(0,0,0,0.6),
    inset 0 0 30px rgba(0,0,0,0.5);
  ${props => props.$hasPlayer && css`
    animation: ${pulseGlow} 3s ease-in-out infinite;
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
        rgba(255,255,255,0.012) 1px,
        transparent 2px
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        rgba(255,255,255,0.008) 1px,
        transparent 2px
      );
    pointer-events: none;
    z-index: 1;
  }
  
  /* Gold corner decoration */
  &::after {
    content: "";
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    bottom: 8px;
    border: 1px solid rgba(212, 175, 55, 0.1);
    border-radius: clamp(4px, 0.8vw, 10px);
    pointer-events: none;
    z-index: 2;
  }
`;

const PlayerHeader = styled.div`
  background: linear-gradient(180deg,
    rgba(45, 21, 16, 0.95) 0%,
    rgba(26, 10, 8, 0.95) 100%
  );
  padding: clamp(10px, 1.5vh, 16px) clamp(12px, 1.8vw, 20px);
  border-bottom: 2px solid rgba(139, 115, 85, 0.4);
  position: relative;
  z-index: 3;
`;

const PlayerStatus = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.4rem, 0.75vw, 0.55rem);
  color: ${props => props.$connected ? '#4ade80' : '#5c4033'};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: clamp(2px, 0.3vh, 4px);
  display: flex;
  align-items: center;
  gap: 6px;
  
  &::before {
    content: "";
    width: 6px;
    height: 6px;
    background: ${props => props.$connected ? '#4ade80' : '#5c4033'};
    border-radius: 50%;
    ${props => props.$connected && css`
      box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
    `}
  }
`;

const PlayerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.75rem, 1.4vw, 1.1rem);
  color: ${props => props.$hasPlayer ? '#e8dcc8' : '#5c4033'};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-shadow: 2px 2px 0 #000;
`;

const PlayerAvatarArea = styled.div`
  height: clamp(180px, 28vh, 280px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  
  /* Flip for left player */
  ${props => props.$side === 'left' && css`
    transform: scaleX(-1);
  `}
`;

const AvatarWrapper = styled.div`
  animation: ${breathe} 2s ease-in-out infinite;
  
  img {
    height: clamp(150px, 24vh, 240px);
    width: auto;
    filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5));
  }
`;

const WaitingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.2vh, 14px);
  
  /* Unflip text if parent is flipped */
  ${props => props.$side === 'left' && css`
    transform: scaleX(-1);
  `}
`;

const WaitingText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.1vw, 0.85rem);
  color: #5c4033;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 1px 1px 0 #000;
`;

const LoadingDots = styled.div`
  display: flex;
  gap: clamp(6px, 0.8vw, 10px);
`;

const Dot = styled.div`
  width: clamp(8px, 1vw, 12px);
  height: clamp(8px, 1vw, 12px);
  background: #d4af37;
  border-radius: 50%;
  animation: ${dotPulse} 1.4s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.2}s;
`;

// ============================================
// CONTROLS FOOTER
// ============================================

const ControlsFooter = styled.footer`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(12px, 2vh, 20px) clamp(20px, 3vw, 40px);
  background: linear-gradient(180deg,
    rgba(21, 8, 5, 0.9) 0%,
    rgba(26, 10, 8, 0.95) 100%
  );
  border-top: 3px solid #8b7355;
  position: relative;
  z-index: 10;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
  
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
  }
`;

// Exit button - subtle like in Rematch
const ExitButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.9vw, 0.7rem);
  background: transparent;
  color: rgba(139, 115, 85, 0.7);
  border: none;
  padding: clamp(8px, 1.2vh, 14px) clamp(14px, 2vw, 24px);
  cursor: pointer;
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(6px, 0.8vw, 10px);

  /* Underline decoration */
  &::after {
    content: "";
    position: absolute;
    bottom: 6px;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(139, 115, 85, 0.3), transparent);
    transition: all 0.25s ease;
  }

  &:hover {
    color: #d4af37;
    
    &::after {
      left: 10%;
      right: 10%;
      background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.5), transparent);
    }
  }
`;

// Ready section
const ReadySection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.2vh, 14px);
`;

const ReadyButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.65rem, 1.2vw, 0.9rem);
  background: linear-gradient(180deg,
    #4a3525 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  color: #d4af37;
  border: 2px solid #8b7355;
  border-radius: clamp(4px, 0.7vw, 8px);
  padding: clamp(10px, 1.5vh, 16px) clamp(24px, 3.5vw, 40px);
  cursor: pointer;
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  box-shadow: 
    0 4px 12px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.1),
    inset 0 -2px 4px rgba(0,0,0,0.3);
  text-shadow: 2px 2px 0 #000;
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
    transform: translateY(-3px);
    box-shadow: 
      0 8px 20px rgba(0,0,0,0.5),
      0 0 20px rgba(212, 175, 55, 0.2),
      inset 0 1px 0 rgba(255,255,255,0.15);
    color: #f0d080;
  }

  &:active {
    transform: translateY(-1px);
  }
`;

const CancelButton = styled(ReadyButton)`
  background: linear-gradient(180deg,
    #2a2a2a 0%,
    #1f1f1f 50%,
    #151515 100%
  );
  color: #888;
  border-color: #444;
  text-shadow: 1px 1px 0 #000;
  
  &:hover {
    background: linear-gradient(180deg,
      #3a3a3a 0%,
      #2a2a2a 50%,
      #1f1f1f 100%
    );
    border-color: #666;
    color: #bbb;
    box-shadow: 
      0 8px 20px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.1);
  }
`;

const ReadyCount = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1.1vw, 0.85rem);
  color: ${props => props.$ready ? '#4ade80' : '#8b7355'};
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #0f0505 100%
  );
  padding: clamp(6px, 1vh, 12px) clamp(16px, 2.5vw, 28px);
  border: 2px solid ${props => props.$ready ? '#4ade80' : '#5c4033'};
  border-radius: clamp(4px, 0.6vw, 7px);
  text-align: center;
  letter-spacing: 0.1em;
  text-shadow: 1px 1px 0 #000;
  ${props => props.$ready && css`
    animation: ${readyGlow} 1.5s ease-in-out infinite;
  `}
`;

const ReadyLabel = styled.span`
  font-size: 0.7em;
  color: rgba(212, 175, 55, 0.6);
  display: block;
  margin-bottom: clamp(2px, 0.4vh, 5px);
  letter-spacing: 0.15em;
`;

// ============================================
// COMPONENT
// ============================================

const Lobby = ({ rooms, roomName, handleGame, setCurrentPage, isCPUMatch = false }) => {
  const [players, setPlayers] = useState([]);
  const [ready, setReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const { socket } = useContext(SocketContext);

  // Find room and safely get player count
  const currentRoom = rooms.find((room) => room.id === roomName);
  const playerCount = currentRoom ? currentRoom.players.length : 0;
  const canShowReadyButton = isCPUMatch || playerCount > 1;

  useEffect(() => {
    socket.emit("lobby", { roomId: roomName });
    socket.on("lobby", (playerData) => {
      console.log("Received lobby data:", playerData);
      setPlayers(playerData);
    });

    socket.on("player_left", () => {
      console.log("Player left event received");
      setReady(false);
      setReadyCount(0);
    });

    socket.on("ready_count", (count) => {
      console.log("ready count activated");
      setReadyCount(count);
    });

    socket.on("initial_game_start", () => {
      console.log("game start");
      socket.emit("game_reset", true);
      handleGame();
    });

    return () => {
      socket.off("lobby");
      socket.off("ready_count");
      socket.off("player_left");
      socket.off("initial_game_start");
    };
  }, [roomName, socket, handleGame]);

  const handleLeaveDohyo = () => {
    playButtonPressSound();
    socket.emit("leave_room", { roomId: roomName });
    setCurrentPage("mainMenu");
  };

  const handleReady = (e) => {
    const isReadyAction = e.target.textContent === "READY";
    setReady(isReadyAction);
    socket.emit("ready_count", {
      playerId: socket.id,
      isReady: isReadyAction,
      roomId: roomName,
    });
  };

  return (
    <LobbyContainer>
      <BackgroundImage />
      
      <Header>
        <LogoSection>
          <LobbyTitle>Pumo Lobby</LobbyTitle>
          <LobbySubtitle>Prepare for Battle</LobbySubtitle>
        </LogoSection>
        <RoomBadge>
          <RoomLabel>Dohyo Code</RoomLabel>
          <RoomCode>{isCPUMatch ? "VS CPU" : roomName}</RoomCode>
        </RoomBadge>
      </Header>

      <ArenaSection>
        <ArenaContainer>
          {/* Player 1 (Left) */}
          <PlayerSlot $side="left">
            <PlayerCard $hasPlayer={!!players[0]?.fighter}>
              <PlayerHeader>
                <PlayerStatus $connected={!!players[0]?.fighter}>
                  {players[0]?.fighter ? "Connected" : "Empty"}
                </PlayerStatus>
                <PlayerName $hasPlayer={!!players[0]?.fighter}>
                  {players[0]?.isCPU ? "CPU" : (players[0]?.fighter || "Waiting...")}
                </PlayerName>
              </PlayerHeader>
              <PlayerAvatarArea $side="left">
                {players[0]?.fighter ? (
                  <AvatarWrapper>
                    <Player index={0} fighter={players[0].fighter} />
                  </AvatarWrapper>
                ) : (
                  <WaitingState $side="left">
                    <WaitingText>Awaiting Pumo</WaitingText>
                    <LoadingDots>
                      <Dot $delay={0} />
                      <Dot $delay={1} />
                      <Dot $delay={2} />
                    </LoadingDots>
                  </WaitingState>
                )}
              </PlayerAvatarArea>
            </PlayerCard>
          </PlayerSlot>

          <VersusBadge>対</VersusBadge>

          {/* Player 2 (Right) */}
          <PlayerSlot $side="right">
            <PlayerCard $hasPlayer={!!players[1]?.fighter}>
              <PlayerHeader>
                <PlayerStatus $connected={!!players[1]?.fighter}>
                  {players[1]?.fighter ? "Connected" : "Empty"}
                </PlayerStatus>
                <PlayerName $hasPlayer={!!players[1]?.fighter}>
                  {players[1]?.isCPU ? "CPU" : (players[1]?.fighter || "Opponent")}
                </PlayerName>
              </PlayerHeader>
              <PlayerAvatarArea $side="right">
                {players[1]?.fighter ? (
                  <AvatarWrapper>
                    <Player index={1} fighter={players[1].fighter} />
                  </AvatarWrapper>
                ) : (
                  <WaitingState $side="right">
                    <WaitingText>Awaiting Pumo</WaitingText>
                    <LoadingDots>
                      <Dot $delay={0} />
                      <Dot $delay={1} />
                      <Dot $delay={2} />
                    </LoadingDots>
                  </WaitingState>
                )}
              </PlayerAvatarArea>
            </PlayerCard>
          </PlayerSlot>
        </ArenaContainer>
      </ArenaSection>

      <ControlsFooter>
        <ExitButton
          onClick={handleLeaveDohyo}
          onMouseEnter={playButtonHoverSound}
        >
          <span>←</span>
          Leave Dohyo
        </ExitButton>
        
        <ReadySection>
          {canShowReadyButton && (
            <>
              {ready ? (
                <CancelButton
                  onClick={(e) => {
                    handleReady(e);
                    playButtonPressSound();
                  }}
                  onMouseEnter={playButtonHoverSound}
                >
                  CANCEL
                </CancelButton>
              ) : (
                <ReadyButton
                  onClick={(e) => {
                    handleReady(e);
                    playButtonPressSound2();
                  }}
                  onMouseEnter={playButtonHoverSound}
                >
                  READY
                </ReadyButton>
              )}
              <ReadyCount $ready={readyCount > 0}>
                <ReadyLabel>Fighters Ready</ReadyLabel>
                {readyCount} / 2
              </ReadyCount>
            </>
          )}
        </ReadySection>
      </ControlsFooter>
    </LobbyContainer>
  );
};

Lobby.propTypes = {
  rooms: PropTypes.array.isRequired,
  roomName: PropTypes.string.isRequired,
  handleGame: PropTypes.func.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  isCPUMatch: PropTypes.bool,
};

export default Lobby;
