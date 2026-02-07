import { useContext, useEffect } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import Room from "./Room";
import { SocketContext } from "../SocketContext";
import { playButtonHoverSound, playButtonPressSound } from "../utils/soundUtils";
import { SnowCap, IcicleRow, Icicle } from "./Snowfall";

// ============================================
// ANIMATIONS
// ============================================

const fadeIn = keyframes`
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

const bannerDrop = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-30px) scale(0.95);
  }
  60% {
    transform: translateY(5px) scale(1.01);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const bannerSway = keyframes`
  0%, 100% { transform: rotate(-0.2deg); }
  50% { transform: rotate(0.2deg); }
`;

const tasselSway = keyframes`
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
`;

const titleGlow = keyframes`
  0%, 100% { 
    text-shadow: 
      3px 3px 0 #000,
      0 0 15px rgba(212, 175, 55, 0.3);
  }
  50% { 
    text-shadow: 
      3px 3px 0 #000,
      0 0 25px rgba(212, 175, 55, 0.5);
  }
`;

// ============================================
// MODAL OVERLAY
// ============================================

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: ${fadeIn} 0.3s ease-out;
`;

// ============================================
// BANNER CONTAINER
// ============================================

const BannerContainer = styled.div`
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: ${bannerDrop} 0.5s ease-out forwards, ${bannerSway} 12s ease-in-out 0.5s infinite;
  transform-origin: top center;
`;

const HangingBar = styled.div`
  width: 104%;
  height: clamp(16px, 2.2vh, 24px);
  background: linear-gradient(180deg,
    #5c4033 0%,
    #3d2817 50%,
    #2a1d14 100%
  );
  border-radius: 6px 6px 0 0;
  margin-left: -2%;
  position: relative;
  border: 3px solid #8b7355;
  border-bottom: none;
  box-shadow: 0 4px 15px rgba(0,0,0,0.6);
  flex-shrink: 0;
  
  /* Hanging rings */
  &::before, &::after {
    content: "";
    position: absolute;
    top: -10px;
    width: clamp(12px, 1.5vw, 18px);
    height: clamp(12px, 1.5vw, 18px);
    background: radial-gradient(circle at 30% 30%, #d4af37, #8b7355);
    border-radius: 50%;
    border: 2px solid #5c4033;
    box-shadow: 0 3px 6px rgba(0,0,0,0.5);
  }
  &::before { left: 18%; }
  &::after { right: 18%; }
`;

const BannerBody = styled.div`
  background: linear-gradient(180deg,
    #1a0a08 0%,
    #2d1510 30%,
    #1f0f0a 70%,
    #150805 100%
  );
  border: 3px solid #8b7355;
  border-top: none;
  border-radius: 0 0 clamp(10px, 1.2vw, 16px) clamp(10px, 1.2vw, 16px);
  box-shadow: 
    0 20px 60px rgba(0,0,0,0.7),
    inset 0 0 50px rgba(0,0,0,0.5),
    inset 0 2px 0 rgba(139, 115, 85, 0.1);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  
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
    z-index: 0;
  }
  
  /* Gold corner decoration */
  &::after {
    content: "";
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    bottom: 10px;
    border: 1px solid rgba(212, 175, 55, 0.1);
    border-radius: clamp(6px, 0.8vw, 12px);
    pointer-events: none;
    z-index: 0;
  }
`;

const TasselContainer = styled.div`
  position: absolute;
  bottom: -28px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 0 20%;
  pointer-events: none;
  z-index: 10;
`;

const Tassel = styled.div`
  width: clamp(7px, 1vw, 11px);
  height: clamp(22px, 3.5vh, 36px);
  background: linear-gradient(180deg, #d4af37 0%, #8b7355 100%);
  border-radius: 0 0 4px 4px;
  animation: ${tasselSway} ${props => 2 + props.$delay * 0.3}s ease-in-out infinite;
  animation-delay: ${props => props.$delay * 0.15}s;
  transform-origin: top center;
`;

// ============================================
// HEADER
// ============================================

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(16px, 2.5vh, 26px) clamp(20px, 3vw, 36px);
  border-bottom: 2px solid rgba(139, 115, 85, 0.4);
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  
  /* Decorative diamonds */
  &::after {
    content: "◆ ◆ ◆";
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    font-size: clamp(6px, 0.8vw, 10px);
    color: rgba(212, 175, 55, 0.4);
    letter-spacing: 1em;
  }
`;

const Title = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.2rem, 2.5vw, 1.8rem);
  color: #d4af37;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  animation: ${titleGlow} 3s ease-in-out infinite;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: clamp(8px, 1.5vw, 16px);
  align-items: center;
`;

const HeaderButton = styled.button`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.9vw, 0.7rem);
  background: ${props => props.$variant === "back" ? css`
    linear-gradient(180deg,
      #4a3525 0%,
      #3d2817 50%,
      #2a1d14 100%
    )
  ` : css`
    linear-gradient(180deg,
      #2a2a2a 0%,
      #1f1f1f 50%,
      #151515 100%
    )
  `};
  color: ${props => props.$variant === "back" ? '#d4af37' : '#888'};
  border: 2px solid ${props => props.$variant === "back" ? '#8b7355' : '#444'};
  border-radius: clamp(4px, 0.6vw, 7px);
  padding: clamp(8px, 1.2vh, 14px) clamp(14px, 2vw, 22px);
  cursor: pointer;
  transition: all 0.25s ease;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  box-shadow: 
    0 4px 12px rgba(0,0,0,0.4),
    inset 0 1px 0 rgba(255,255,255,0.08);
  text-shadow: 1px 1px 0 #000;
  display: flex;
  align-items: center;
  gap: clamp(4px, 0.6vw, 8px);
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
    border-radius: clamp(4px, 0.6vw, 7px);
    pointer-events: none;
  }

  .material-symbols-outlined {
    font-size: clamp(0.8rem, 1.2vw, 1rem);
  }

  &:hover {
    transform: translateY(-2px);
    ${props => props.$variant === "back" ? css`
      background: linear-gradient(180deg,
        #5c4530 0%,
        #4a3525 50%,
        #3d2817 100%
      );
      border-color: #d4af37;
      color: #f0d080;
    ` : css`
      background: linear-gradient(180deg,
        #3a3a3a 0%,
        #2a2a2a 50%,
        #1f1f1f 100%
      );
      border-color: #666;
      color: #bbb;
    `}
    box-shadow: 
      0 6px 18px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.1);
  }

  &:active {
    transform: translateY(0);
  }
`;

// ============================================
// ROOM LIST
// ============================================

const RoomListContainer = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const RoomList = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.5vh, 16px);
  padding: clamp(18px, 2.5vh, 28px) clamp(20px, 3vw, 36px);
  padding-bottom: clamp(40px, 5vh, 60px);
  overflow-y: auto;
  position: relative;
  z-index: 1;
  flex: 1;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(26, 10, 8, 0.5);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #5c4033, #3d2817);
    border-radius: 4px;
    border: 1px solid #8b7355;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #6d5040, #4e3928);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(40px, 6vh, 80px) clamp(20px, 3vw, 40px);
  text-align: center;
  position: relative;
  z-index: 1;
`;

const EmptyIcon = styled.div`
  font-size: clamp(2.5rem, 5vw, 4rem);
  margin-bottom: clamp(12px, 2vh, 20px);
  opacity: 0.6;
`;

const EmptyTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.9rem, 1.6vw, 1.2rem);
  color: #8b7355;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: clamp(8px, 1.2vh, 14px);
  text-shadow: 2px 2px 0 #000;
`;

const EmptySubtext = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.55rem, 1vw, 0.75rem);
  color: #5c4033;
  letter-spacing: 0.08em;
  text-shadow: 1px 1px 0 #000;
`;

const CreateRoomHint = styled.div`
  margin-top: clamp(20px, 3vh, 32px);
  padding: clamp(12px, 1.8vh, 20px) clamp(20px, 3vw, 32px);
  background: linear-gradient(180deg,
    rgba(74, 53, 37, 0.3) 0%,
    rgba(42, 29, 20, 0.3) 100%
  );
  border: 1px solid rgba(139, 115, 85, 0.3);
  border-radius: clamp(4px, 0.6vw, 8px);
`;

const HintText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.9vw, 0.65rem);
  color: #d4af37;
  letter-spacing: 0.08em;
  text-shadow: 1px 1px 0 #000;
  
  span {
    color: #e8dcc8;
    opacity: 0.8;
  }
`;

// ============================================
// COMPONENT
// ============================================

const Rooms = ({ rooms, setRoomName, handleJoinRoom, handleMainMenuPage }) => {
  const { getRooms } = useContext(SocketContext);

  const handleRefresh = () => {
    getRooms();
  };

  useEffect(() => {
    getRooms();
    return () => {
      // Cleanup if needed
    };
  }, [getRooms]);

  const filteredRooms = rooms.filter((room) => !room.isCPURoom);

  return (
    <ModalOverlay>
      <BannerContainer>
        <HangingBar>
          <SnowCap />
          <IcicleRow $bottom="-8px">
            <Icicle $w={2} $h={6} />
            <Icicle $w={3} $h={10} />
            <Icicle $w={2} $h={8} />
            <Icicle $w={3} $h={12} />
            <Icicle $w={2} $h={7} />
            <Icicle $w={3} $h={9} />
            <Icicle $w={2} $h={11} />
            <Icicle $w={3} $h={6} />
          </IcicleRow>
        </HangingBar>
        <BannerBody>
          <Header>
            <Title>Server Browser</Title>
            <ButtonContainer>
              <HeaderButton 
                $variant="back" 
                onClick={() => { handleMainMenuPage(); playButtonPressSound(); }} 
                onMouseEnter={playButtonHoverSound}
              >
                <span className="material-symbols-outlined">arrow_back</span>
                Back
              </HeaderButton>
              <HeaderButton 
                onClick={() => { handleRefresh(); playButtonPressSound(); }} 
                onMouseEnter={playButtonHoverSound}
              >
                <span className="material-symbols-outlined">refresh</span>
                Refresh
              </HeaderButton>
            </ButtonContainer>
          </Header>
          
          <RoomListContainer>
            <RoomList>
              {filteredRooms.length === 0 ? (
                <EmptyState>
                  <EmptyIcon>🐧</EmptyIcon>
                  <EmptyTitle>No Dohyos Available</EmptyTitle>
                  <EmptySubtext>Be the first to create a room!</EmptySubtext>
                  <CreateRoomHint>
                    <HintText>
                      Tip: <span>Rooms are created automatically when you join an empty server</span>
                    </HintText>
                  </CreateRoomHint>
                </EmptyState>
              ) : (
                filteredRooms.map((room) => (
                  <Room
                    key={room.id}
                    room={room}
                    setRoomName={setRoomName}
                    handleJoinRoom={handleJoinRoom}
                  />
                ))
              )}
            </RoomList>
          </RoomListContainer>
          
          <TasselContainer>
            <Tassel $delay={0} />
            <Tassel $delay={1} />
            <Tassel $delay={2} />
            <Tassel $delay={3} />
            <Tassel $delay={4} />
          </TasselContainer>
        </BannerBody>
      </BannerContainer>
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
