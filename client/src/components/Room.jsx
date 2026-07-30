import { useContext } from "react";
import PropTypes from "prop-types";
import styled, { css, keyframes } from "styled-components";
import { SocketContext } from "../SocketContext";
import {
  playButtonHoverSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import {
  C,
  FONT_BODY,
  FONT_UI,
  FONT_WEIGHT,
  TRACK,
  slideInLeft,
  arrowNudge,
  livePulse,
  TEXT_SHADOW_DISPLAY,
  TEXT_SHADOW_UI,
} from "./menuTheme";
import { loadSave } from "../lib/saveStore";
import { getActiveOutfit } from "../lib/outfits";

/*
 * Room row — lacquer blade on the dohyo list.
 * Aligns to Rooms ColumnHeaders: Dohyo | Rikishi | Status | Join
 */

const subtlePulse = keyframes`
  0%, 100% {
    border-left-color: ${C.successDeep};
  }
  50% {
    border-left-color: ${C.success};
  }
`;

const RoomCard = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(70px, 0.7fr) minmax(64px, 0.55fr) auto;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  padding: clamp(11px, 1.5cqh, 15px) clamp(14px, 1.8cqw, 20px);
  background: ${(p) =>
    p.$isFull ? "rgba(12, 14, 20, 0.72)" : "rgba(23, 26, 32, 0.95)"};
  border: 1px solid
    ${(p) =>
      p.$isFull ? "rgba(245, 236, 217, 0.08)" : "rgba(245, 236, 217, 0.18)"};
  border-left: 3px solid
    ${(p) => (p.$isFull ? "rgba(245, 236, 217, 0.18)" : C.successDeep)};
  border-radius: 0;
  opacity: 0;
  animation: ${slideInLeft} 0.4s ease-out forwards;
  animation-delay: ${(p) => Math.min(p.$index ?? 0, 12) * 0.05}s;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);

  ${(p) =>
    !p.$isFull &&
    css`
      animation:
        ${slideInLeft} 0.4s ease-out forwards,
        ${subtlePulse} 3.2s ease-in-out infinite;
      animation-delay: ${Math.min(p.$index ?? 0, 12) * 0.05}s, 0.45s;
    `}

  &:hover {
    ${(p) =>
      !p.$isFull &&
      css`
        transform: translateX(5px);
        background: ${C.sumiSoft};
        border-color: rgba(245, 236, 217, 0.28);
      `}
  }
`;

const DohyoBlock = styled.div`
  display: flex;
  align-items: baseline;
  gap: clamp(10px, 1.3cqw, 14px);
  min-width: 0;
`;

const RowIndex = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.68cqw, 0.52rem);
  color: ${C.creamMute};
  letter-spacing: 0.12em;
  flex-shrink: 0;
  opacity: 0.7;
`;

const RoomId = styled.div`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.82rem, 1.35cqw, 1.05rem);
  color: ${(p) => (p.$isFull ? C.creamMute : C.cream)};
  letter-spacing: ${TRACK.meta};
  text-transform: uppercase;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: ${(p) => (p.$isFull ? "none" : TEXT_SHADOW_DISPLAY)};
`;

const RikishiBlock = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1cqw, 12px);
`;

const Seat = styled.div`
  width: clamp(11px, 1.3cqw, 14px);
  height: clamp(11px, 1.3cqw, 14px);
  border-radius: 50%;
  background: ${(p) => (p.$filled ? C.success : "transparent")};
  border: 1.5px solid
    ${(p) => (p.$filled ? C.success : "rgba(245, 236, 217, 0.28)")};
  box-shadow: ${(p) =>
    p.$filled ? `0 0 0 0 rgba(74, 222, 128, 0.45)` : "none"};
  ${(p) =>
    p.$filled &&
    css`
      animation: ${livePulse} 2.4s ease-out infinite;
    `}
`;

const SeatCount = styled.span`
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.58rem, 0.95cqw, 0.72rem);
  color: ${(p) => (p.$isFull ? C.creamMute : C.cream)};
  letter-spacing: ${TRACK.meta};
`;

const StatusBadge = styled.div`
  justify-self: start;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.42rem, 0.68cqw, 0.52rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  padding: clamp(4px, 0.55cqh, 6px) clamp(8px, 1.2cqw, 12px);
  border-radius: 0;

  ${(p) =>
    p.$isFull
      ? css`
          color: ${C.creamMute};
          background: rgba(245, 236, 217, 0.06);
          border: 1px solid rgba(245, 236, 217, 0.12);
        `
      : css`
          color: ${C.gold};
          background: rgba(232, 197, 71, 0.12);
          border: 1px solid rgba(232, 197, 71, 0.35);
          text-shadow: ${TEXT_SHADOW_UI}, 0 0 8px rgba(232, 197, 71, 0.22);
        `}
`;

const JoinButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
  padding: clamp(9px, 1.3cqh, 12px) clamp(16px, 2.2cqw, 24px);
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.62rem, 1cqw, 0.8rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  border-radius: 0;
  cursor: ${(p) => (p.$isFull ? "not-allowed" : "pointer")};
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease,
    box-shadow 0.18s ease, color 0.18s ease;

  ${(p) =>
    p.$isFull
      ? css`
          color: ${C.creamMute};
          background: rgba(245, 236, 217, 0.04);
          border: 1px solid rgba(245, 236, 217, 0.1);
          opacity: 0.55;
        `
      : css`
          color: ${C.inkTextStrong};
          background: ${C.success};
          border: 1px solid ${C.successDeep};
          box-shadow: 0 2px 0 ${C.successDeep};
        `}

  .arrow {
    font-family: ${FONT_BODY};
    font-weight: 700;
    transition: transform 0.2s ease;
  }

  ${(p) =>
    !p.$isFull &&
    css`
      &:hover {
        background: ${C.successBright};
        transform: translateY(-1px);
        box-shadow: 0 3px 0 ${C.successDeep};

        .arrow {
          animation: ${arrowNudge} 0.7s ease-in-out infinite;
        }
      }

      &:active {
        transform: translateY(1px);
        box-shadow: 0 1px 0 ${C.successDeep};
      }
    `}
`;

const Room = ({ room, setRoomName, handleJoinRoom, index }) => {
  const { socket } = useContext(SocketContext);
  const isFull = room.players.length === 2;
  const rowNum = String((index ?? 0) + 1).padStart(2, "0");

  const handleJoin = async () => {
    if (isFull) return;
    const save = await loadSave();
    const outfit = getActiveOutfit(save.customization);
    socket.emit("join_room", {
      socketId: socket.id,
      roomId: room.id,
      mawashiColor: outfit.mawashiColor,
      bodyColor: outfit.bodyColor,
      gearIds: Array.isArray(outfit.gearIds) ? outfit.gearIds : [],
    });
    setRoomName(room.id);
    handleJoinRoom();
  };

  return (
    <RoomCard $isFull={isFull} $index={index}>
      <DohyoBlock>
        <RowIndex>{rowNum}</RowIndex>
        <RoomId $isFull={isFull}>{room.id}</RoomId>
      </DohyoBlock>

      <RikishiBlock>
        <Seat $filled={room.players.length >= 1} />
        <Seat $filled={room.players.length >= 2} />
        <SeatCount $isFull={isFull}>{room.players.length}/2</SeatCount>
      </RikishiBlock>

      <StatusBadge $isFull={isFull}>{isFull ? "Full" : "Open"}</StatusBadge>

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
        {isFull ? "—" : "Join"}
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
