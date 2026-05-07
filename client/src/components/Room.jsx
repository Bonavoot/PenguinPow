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
    box-shadow: 0 2px 6px ${C.snowShadow};
  }
  50% {
    box-shadow: 0 2px 6px ${C.snowShadow}, 0 0 12px rgba(22, 163, 74, 0.18);
  }
`;

// ============================================
// ROOM CARD (blade-button style)
// ============================================

const RoomCard = styled.div`
  --accent: ${(p) => (p.$isFull ? C.snowBorder : C.successDeep)};
  --accentBright: ${(p) =>
    p.$isFull ? C.snowBorder : C.success};

  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(14px, 2cqw, 22px);
  padding: clamp(12px, 1.7cqh, 18px) clamp(18px, 2.4cqw, 26px);
  /*
   * Snow plaque rows. Joinable = clean white tile (snowPanel) so the
   * card POPS as the brightest, most-actionable element on the new
   * snowPanelDeep modal lane behind it. Full = snowFrost (one step
   * DARKER than the lane) so the card reads as recessed/sunken
   * rather than just a duplicate surface — the room is closed, the
   * tile sits below the surrounding snow line.
   *
   * Previously full used snowPanelDeep, but now that the Rooms
   * Panel/RoomListContainer were pulled down to snowPanelDeep
   * themselves (to fix the "too white" feel), full cards on that
   * tone would disappear into the lane. Pulling them to snowFrost
   * keeps them visible AND clearly recessed.
   *
   * Single short cool drop shadow — no inset highlights, no gradient
   * stripes. The clip-path angle on the right gives these rows
   * their blade-card character without depending on stacked effects.
   */
  background: ${(p) => (p.$isFull ? C.snowFrost : C.snowPanel)};
  border: 1px solid ${C.snowBorder};
  border-left: 3px solid var(--accent);
  border-radius: 2px;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease,
    box-shadow 0.18s ease;
  box-shadow: 0 2px 6px ${C.snowShadow};
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
        /* Soft icy hover background — body shifts to a pale ice
         * tile, green border deepens, single soft cool shadow
         * grows. No glow halo (was the AI-default tell). */
        background: #e0eef9;
        border-color: var(--accentBright);
        box-shadow: 0 4px 12px ${C.snowShadowStrong};
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
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.42rem, 0.68cqw, 0.5rem);
  color: ${C.inkTextMute};
  text-transform: uppercase;
  letter-spacing: 0.28em;
`;

const RoomId = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.4cqw, 1.1rem);
  color: ${C.inkText};
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
  background: ${(p) => (p.$filled ? C.iceMid : "transparent")};
  border: 1.5px solid
    ${(p) => (p.$filled ? C.iceMid : C.snowBorder)};
`;

const PlayerCountText = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.6rem, 1cqw, 0.75rem);
  color: ${(p) => (p.$isFull ? C.inkTextMute : C.inkText)};
  letter-spacing: 0.06em;
`;

const StatusBadge = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.42rem, 0.7cqw, 0.55rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: clamp(4px, 0.6cqh, 6px) clamp(9px, 1.3cqw, 14px);
  border-radius: 2px;
  flex-shrink: 0;

  ${(p) =>
    p.$isFull
      ? css`
          /* Snow tone (was snowPanelDeep) — sits one step lighter
           * than the recessed full-card body (snowFrost), so the
           * Full pill still has a hint of contrast against the tile
           * it lives on rather than disappearing into it. */
          color: ${C.inkTextMute};
          background: ${C.snow};
          border: 1px solid ${C.snowBorder};
        `
      : css`
          color: ${C.goldDeep};
          background: rgba(232, 197, 71, 0.18);
          border: 1px solid ${C.gold};
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
  /*
   * Slightly wider tracking than the dark-on-dark CTAs. Bungee gets
   * dense fast on a bright tile — a hair more letter-spacing lets each
   * letter breathe so it reads as confident signage instead of squeezed.
   */
  letter-spacing: 0.18em;
  text-transform: uppercase;
  border-radius: 2px;
  cursor: ${(p) => (p.$isFull ? "not-allowed" : "pointer")};
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease,
    box-shadow 0.2s ease, color 0.2s ease;
  flex-shrink: 0;

  ${(p) =>
    p.$isFull
      ? css`
          /* Disabled full-state button — snow (was snowPanelDeep)
           * to match the StatusBadge above it, so the right edge
           * of the card has a consistent "ghosted/locked" treatment
           * sitting on the recessed snowFrost tile body. */
          color: ${C.inkTextMute};
          background: ${C.snow};
          border: 1px solid ${C.snowBorder};
          opacity: 0.7;
        `
      : css`
          /*
           * "Go" green CTA — flat solid green tile with dark ink
           * text. Reserved exclusively for accept / join /
           * ready-to-fight CTAs. Dropped the gradient + glow halo
           * + inset highlight stack from the dark theme; on a snow
           * page that recipe reads as glossy SaaS chrome. The
           * single short cool drop shadow is enough to give the
           * pill some lift.
           */
          color: ${C.inkTextStrong};
          background: ${C.success};
          border: 1px solid ${C.successDeep};
          box-shadow: 0 2px 6px rgba(22, 163, 74, 0.32);
        `}

  .arrow {
    font-family: "Space Grotesk", sans-serif;
    font-weight: 700;
    color: ${(p) => (p.$isFull ? C.inkTextFaint : C.inkTextStrong)};
    transition: transform 0.2s ease;
  }

  ${(p) =>
    !p.$isFull &&
    css`
      &:hover {
        background: ${C.successBright};
        border-color: ${C.successDeep};
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(22, 163, 74, 0.4);

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
