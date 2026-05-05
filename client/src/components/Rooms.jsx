import { useContext, useEffect } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import Room from "./Room";
import { SocketContext } from "../SocketContext";
import { playButtonHoverSound, playButtonPressSound } from "../utils/soundUtils";
import { C, fadeIn, fadeUp } from "./menuTheme";

// ============================================
// ANIMATIONS
// ============================================

const panelDrop = keyframes`
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

// ============================================
// MODAL OVERLAY
// ============================================

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  /*
   * Soft cool dim, no backdrop-filter blur. Glassmorphism stacking
   * is the most-recognized AI-generated UI tell — we replace it
   * with a flat slate-tinted overlay that just dims the menu
   * behind the modal without smearing it. Reads as "the lights
   * dimmed in the room" instead of "everything went out of focus."
   */
  background: rgba(15, 29, 46, 0.55);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: ${fadeIn} 0.25s ease-out;
  padding: clamp(20px, 4cqw, 60px);
`;

// ============================================
// PANEL CONTAINER
// ============================================

const Panel = styled.div`
  position: relative;
  width: 100%;
  max-width: clamp(480px, 78cqw, 920px);
  max-height: 88cqh;
  display: flex;
  flex-direction: column;
  background: ${C.snowPanel};
  border: 1px solid ${C.snowBorder};
  border-radius: 3px;
  box-shadow: 0 18px 38px rgba(15, 29, 46, 0.28);
  overflow: hidden;
  animation: ${panelDrop} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;

  /* Vermillion → gold → vermillion top accent strip — the one
   * "hero accent" for this surface (canonical brand mark). */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      ${C.vermillion} 0%,
      ${C.gold} 50%,
      ${C.vermillion} 100%
    );
  }
`;

// ============================================
// HEADER
// ============================================

const Header = styled.header`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: clamp(12px, 2cqw, 24px);
  padding: clamp(18px, 2.6cqh, 26px) clamp(22px, 3cqw, 36px);
  /*
   * Sumi anchor band — turns the modal into a banzuke poster:
   * dark spine across the top with the "SERVER BROWSER" lockup
   * in cream + a thin meta line, snow body below for the room
   * list. Same chrome pattern as the main menu's BanzukeCard
   * header so the two screens read as one design family.
   */
  background: ${C.sumi};
  border-bottom: 1px solid ${C.sumiBorder};
  flex-shrink: 0;
`;

const TitleBlock = styled.div`
  /*
   * No vertical accent bar here — the Panel's top horizontal
   * vermillion→gold→vermillion strip is the one "hero accent" for
   * this screen. Doubling it with a vertical accent on the title was
   * the kind of decorative repetition that makes UI read as
   * AI-generated chrome rather than as designed restraint.
   */
  padding-left: 0;
  flex: 1;
  min-width: 0;
`;

const Title = styled.h1`
  font-family: "Bungee", cursive;
  font-size: clamp(1.1rem, 1.9cqw, 1.55rem);
  color: ${C.cream};
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1.1;
`;

const TitleMeta = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.45rem, 0.75cqw, 0.58rem);
  color: ${C.creamMute};
  letter-spacing: 0.32em;
  text-transform: uppercase;
  margin-top: 4px;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(6px, 1cqw, 10px);
  flex-shrink: 0;
`;

const HeaderButton = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(5px, 0.7cqw, 8px);
  padding: clamp(8px, 1.2cqh, 12px) clamp(13px, 1.8cqw, 20px);
  /*
   * Dark-context ghost button — sits on the sumi modal Header.
   * Both Back and Refresh are secondary controls; the JOIN buttons
   * in the room list own the primary affordance.
   */
  background: transparent;
  border: 1px solid ${C.sumiBorder};
  border-radius: 2px;
  font-family: "Bungee", cursive;
  font-size: clamp(0.5rem, 0.85cqw, 0.65rem);
  color: ${C.creamMute};
  letter-spacing: 0.13em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.18s ease, color 0.18s ease, background 0.18s ease,
    border-color 0.18s ease;

  .material-symbols-outlined {
    font-size: clamp(0.85rem, 1.3cqw, 1rem);
    transition: transform 0.3s ease;
  }

  &:hover {
    color: ${C.cream};
    background: rgba(234, 241, 247, 0.06);
    border-color: ${C.iceMid};
    transform: translateY(-1px);

    .material-symbols-outlined {
      transform: ${(p) => (p.$variant === "refresh" ? "rotate(90deg)" : "translateX(-2px)")};
    }
  }

  &:active {
    transform: translateY(0);
  }
`;

// ============================================
// ROOM LIST
// ============================================

const ListMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: clamp(10px, 1.4cqh, 14px) clamp(22px, 3cqw, 36px);
  border-bottom: 1px solid ${C.snowBorderSoft};
  background: ${C.snowSoft};
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.45rem, 0.72cqw, 0.55rem);
  color: ${C.inkTextMute};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  flex-shrink: 0;

  span.count {
    color: ${C.goldDeep};
    font-weight: 700;
  }

  span.spacer {
    flex: 1;
  }

  span.legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${C.inkTextMute};

    &::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${C.iceMid};
    }
  }
`;

const RoomListContainer = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${C.snow};
`;

const RoomList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.1cqh, 12px);
  padding: clamp(16px, 2.2cqh, 24px) clamp(22px, 3cqw, 36px);
  overflow-y: auto;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: ${C.snowPanelDeep};
  }
  &::-webkit-scrollbar-thumb {
    background: ${C.iceMid};
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: ${C.iceDeep};
  }
`;

// ============================================
// EMPTY STATE
// ============================================

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(40px, 6cqh, 80px) clamp(20px, 3cqw, 40px);
  text-align: center;
  animation: ${fadeUp} 0.5s ease-out 0.15s backwards;
`;

const EmptyHanko = styled.div`
  width: clamp(56px, 7cqw, 86px);
  height: clamp(56px, 7cqw, 86px);
  display: grid;
  place-items: center;
  margin-bottom: clamp(14px, 2cqh, 20px);
  /*
   * Solid vermillion hanko stamp — flat color, just a soft cool
   * shadow underneath. Reads as a real ink seal pressed onto the
   * snow page, not a glossy "AI badge" with inset highlights.
   */
  background: ${C.vermillion};
  color: ${C.snowSoft};
  font-family: "Noto Serif JP", serif;
  font-weight: 900;
  font-size: clamp(1.4rem, 2.4cqw, 2rem);
  border-radius: 3px;
  box-shadow: 0 4px 10px rgba(138, 31, 18, 0.32);
  transform: rotate(-3deg);
  letter-spacing: 0;

  &::after {
    content: "空";
  }
`;

const EmptyTitle = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.95rem, 1.6cqw, 1.2rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: clamp(8px, 1.2cqh, 12px);
`;

const EmptySubtext = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.55rem, 0.95cqw, 0.7rem);
  color: ${C.inkTextSoft};
  letter-spacing: 0.12em;
  max-width: 36ch;
  line-height: 1.6;
`;

const EmptyHint = styled.div`
  margin-top: clamp(20px, 3cqh, 28px);
  padding: clamp(10px, 1.4cqh, 14px) clamp(16px, 2.4cqw, 24px);
  background: ${C.snowPanel};
  border: 1px solid ${C.snowBorder};
  border-left: 3px solid ${C.iceMid};
  border-radius: 2px;
  font-family: "Space Grotesk", sans-serif;
  font-weight: 500;
  font-size: clamp(0.5rem, 0.82cqw, 0.62rem);
  color: ${C.inkTextSoft};
  letter-spacing: 0.06em;
  line-height: 1.5;
  max-width: 44ch;
  text-align: left;

  strong {
    color: ${C.goldDeep};
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-right: 6px;
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
  }, [getRooms]);

  const filteredRooms = rooms.filter((room) => !room.isCPURoom);
  const openCount = filteredRooms.filter((r) => r.players.length < 2).length;

  return (
    <ModalOverlay>
      <Panel>
        <Header>
          <TitleBlock>
            <Title>Server Browser</Title>
            <TitleMeta>Find a Dohyo · Join the Bout</TitleMeta>
          </TitleBlock>

          <HeaderActions>
            <HeaderButton
              $variant="back"
              onClick={() => {
                handleMainMenuPage();
                playButtonPressSound();
              }}
              onMouseEnter={playButtonHoverSound}
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </HeaderButton>
            <HeaderButton
              $variant="refresh"
              onClick={() => {
                handleRefresh();
                playButtonPressSound();
              }}
              onMouseEnter={playButtonHoverSound}
            >
              <span className="material-symbols-outlined">refresh</span>
              Refresh
            </HeaderButton>
          </HeaderActions>
        </Header>

        <ListMeta>
          <span>
            <span className="count">{filteredRooms.length}</span> Dohyo
            {filteredRooms.length === 1 ? "" : "s"}
          </span>
          <span className="spacer" />
          {filteredRooms.length > 0 && (
            <span className="legend">
              {openCount} open · {filteredRooms.length - openCount} full
            </span>
          )}
        </ListMeta>

        <RoomListContainer>
          <RoomList>
            {filteredRooms.length === 0 ? (
              <EmptyState>
                <EmptyHanko />
                <EmptyTitle>No Dohyos Available</EmptyTitle>
                <EmptySubtext>
                  Be the first to step into the ring. Joining an empty server
                  will create a new dohyo.
                </EmptySubtext>
                <EmptyHint>
                  <strong>Tip</strong>
                  Hit Refresh to scan for newly opened bouts.
                </EmptyHint>
              </EmptyState>
            ) : (
              filteredRooms.map((room, idx) => (
                <Room
                  key={room.id}
                  room={room}
                  setRoomName={setRoomName}
                  handleJoinRoom={handleJoinRoom}
                  index={idx}
                />
              ))
            )}
          </RoomList>
        </RoomListContainer>
      </Panel>
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
