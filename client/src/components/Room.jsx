import { useContext } from "react";
import PropTypes from "prop-types";
import styled, { css, keyframes } from "styled-components";
import { SocketContext } from "../SocketContext";
import {
  playButtonHoverSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import { C, slideInLeft, arrowNudge } from "./menuTheme";

// ============================================
// ANIMATIONS
// ============================================

const subtlePulse = keyframes`
  0%, 100% {
    box-shadow:
      0 4px 14px rgba(0, 0, 0, 0.45),
      0 0 0 rgba(238, 81, 65, 0),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  50% {
    box-shadow:
      0 4px 14px rgba(0, 0, 0, 0.45),
      0 0 16px rgba(238, 81, 65, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
`;

// ============================================
// ROOM CARD (blade-button style)
// ============================================

const RoomCard = styled.div`
  --accent: ${(p) => (p.$isFull ? "rgba(94, 122, 200, 0.25)" : C.vermillion)};
  --accentBright: ${(p) => (p.$isFull ? "rgba(94, 122, 200, 0.4)" : C.vermillionBright)};

  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(14px, 2cqw, 22px);
  padding: clamp(12px, 1.7cqh, 18px) clamp(18px, 2.4cqw, 26px);
  background: linear-gradient(
    100deg,
    ${(p) =>
      p.$isFull
        ? "rgba(15, 18, 30, 0.7) 0%, rgba(8, 11, 24, 0.6) 60%, rgba(8, 11, 24, 0.5) 100%"
        : "rgba(31, 42, 77, 0.45) 0%, rgba(8, 11, 24, 0.55) 70%, rgba(8, 11, 24, 0.4) 100%"}
  );
  border: 1px solid
    ${(p) =>
      p.$isFull
        ? "rgba(245, 236, 217, 0.08)"
        : "rgba(94, 122, 200, 0.32)"};
  border-left: 3px solid var(--accent);
  border-radius: 2px;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease,
    box-shadow 0.2s ease;
  backdrop-filter: blur(3px);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  opacity: 0;
  animation: ${slideInLeft} 0.4s ease-out forwards;
  animation-delay: ${(p) => Math.min(p.$index ?? 0, 12) * 0.05}s;
  clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);

  ${(p) =>
    !p.$isFull &&
    css`
      animation:
        ${slideInLeft} 0.4s ease-out forwards,
        ${subtlePulse} 4s ease-in-out infinite;
      animation-delay: ${Math.min(p.$index ?? 0, 12) * 0.05}s, 0.5s;
    `}

  &:hover {
    ${(p) =>
      !p.$isFull &&
      css`
        transform: translateX(6px);
        background: linear-gradient(
          100deg,
          rgba(58, 74, 133, 0.55) 0%,
          rgba(8, 11, 24, 0.55) 70%,
          rgba(8, 11, 24, 0.35) 100%
        );
        border-color: var(--accentBright);
        box-shadow:
          0 6px 22px rgba(0, 0, 0, 0.55),
          0 0 22px ${C.vermillionGlow},
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
      `}
  }
`;

// ============================================
// ROOM INFO
// ============================================

const InfoBlock = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(14px, 2.4cqw, 28px);
  flex: 1;
  min-width: 0;
`;

const RoomIdSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: clamp(80px, 9cqw, 110px);
`;

const RoomLabel = styled.div`
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.68cqw, 0.5rem);
  color: ${C.creamMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const RoomId = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.4cqw, 1.1rem);
  color: ${C.cream};
  text-shadow: 0 2px 0 #000;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.05;
`;

const PlayerCount = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(6px, 0.9cqw, 10px);
  flex-shrink: 0;
`;

const PlayerDot = styled.div`
  width: clamp(9px, 1.1cqw, 12px);
  height: clamp(9px, 1.1cqw, 12px);
  border-radius: 50%;
  background: ${(p) => (p.$filled ? C.ice : "transparent")};
  border: 1.5px solid
    ${(p) => (p.$filled ? C.ice : "rgba(245, 236, 217, 0.3)")};
  ${(p) =>
    p.$filled &&
    css`
      box-shadow: 0 0 8px rgba(126, 203, 240, 0.55);
    `}
`;

const PlayerCountText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1cqw, 0.75rem);
  color: ${(p) => (p.$isFull ? C.creamMute : C.cream)};
  letter-spacing: 0.06em;
  text-shadow: 0 2px 0 #000;
`;

const StatusBadge = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: clamp(4px, 0.6cqh, 6px) clamp(9px, 1.3cqw, 14px);
  border-radius: 2px;
  text-shadow: none;
  flex-shrink: 0;

  ${(p) =>
    p.$isFull
      ? css`
          color: ${C.creamMute};
          background: rgba(245, 236, 217, 0.05);
          border: 1px solid rgba(245, 236, 217, 0.12);
        `
      : css`
          color: ${C.gold};
          background: rgba(232, 197, 71, 0.08);
          border: 1px solid rgba(232, 197, 71, 0.35);
        `}
`;

// ============================================
// JOIN BUTTON
// ============================================

const JoinButton = styled.button`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: clamp(10px, 1.4cqh, 13px) clamp(18px, 2.5cqw, 28px);
  font-family: "Bungee", cursive;
  font-size: clamp(0.65rem, 1.05cqw, 0.85rem);
  letter-spacing: 0.13em;
  text-transform: uppercase;
  text-shadow: 0 2px 0 #000;
  border-radius: 2px;
  cursor: ${(p) => (p.$isFull ? "not-allowed" : "pointer")};
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease,
    box-shadow 0.2s ease, color 0.2s ease;
  flex-shrink: 0;

  ${(p) =>
    p.$isFull
      ? css`
          color: ${C.creamMute};
          background: rgba(245, 236, 217, 0.05);
          border: 1px solid rgba(245, 236, 217, 0.12);
          opacity: 0.6;
        `
      : css`
          color: ${C.cream};
          background: linear-gradient(
            180deg,
            ${C.vermillion} 0%,
            ${C.vermillionDeep} 100%
          );
          border: 1px solid ${C.vermillionBright};
          box-shadow:
            0 4px 14px rgba(0, 0, 0, 0.45),
            0 0 18px rgba(238, 81, 65, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        `}

  .arrow {
    font-family: "Outfit", sans-serif;
    font-weight: 700;
    color: ${(p) => (p.$isFull ? "rgba(245, 236, 217, 0.3)" : C.cream)};
    transition: transform 0.2s ease;
  }

  ${(p) =>
    !p.$isFull &&
    css`
      &:hover {
        background: linear-gradient(
          180deg,
          ${C.vermillionBright} 0%,
          ${C.vermillion} 100%
        );
        border-color: ${C.gold};
        transform: translateY(-1px);
        box-shadow:
          0 6px 22px rgba(0, 0, 0, 0.55),
          0 0 28px rgba(238, 81, 65, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.22);

        .arrow {
          animation: ${arrowNudge} 0.7s ease-in-out infinite;
        }
      }

      &:active {
        transform: translateY(0) scale(0.98);
      }
    `}
`;

// ============================================
// COMPONENT
// ============================================

const Room = ({ room, setRoomName, handleJoinRoom, index }) => {
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
    <RoomCard $isFull={isFull} $index={index}>
      <InfoBlock>
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
      </InfoBlock>

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
        {!isFull && <span className="arrow">▶</span>}
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
  index: PropTypes.number,
};

export default Room;
