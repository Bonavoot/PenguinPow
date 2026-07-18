import { useContext, useEffect } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import Room from "./Room";
import Snowfall from "./Snowfall";
import { SocketContext } from "../SocketContext";
import lobbyBackground from "../assets/lockerroom.webp";
import {
  playButtonHoverSound,
  playButtonPressSound,
  playButtonPressSound2,
} from "../utils/soundUtils";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  fadeIn,
  fadeUp,
  broadcastSlideDown,
  clipRevealLeft,
  clipRevealRight,
} from "./menuTheme";

/*
 * Rooms — Custom Match server browser.
 *
 * Same stage language as Lobby / BashoHub / PreMatch: locker room,
 * letterbox dim, cream type, vermillion crowns. No header/footer bars —
 * floating slug + corner controls, then a two-column dohyo board.
 */

const D = {
  page: "#080a0e",
  panel: "rgba(14, 16, 22, 0.92)",
  head: "#171a20",
  soft: "#22262d",
  deep: "#0c0e14",
  border: "rgba(245, 236, 217, 0.20)",
  borderSoft: "rgba(245, 236, 217, 0.10)",
  shadow: "rgba(0, 0, 0, 0.55)",
};

const WASHI_LIGHT_ON_DARK = `
  repeating-linear-gradient(
    90deg,
    transparent 0, transparent 3px,
    rgba(232, 210, 170, 0.045) 3px, rgba(232, 210, 170, 0.045) 4px
  ),
  repeating-linear-gradient(
    0deg,
    transparent 0, transparent 5px,
    rgba(232, 210, 170, 0.035) 5px, rgba(232, 210, 170, 0.035) 6px
  )
`;

const panelDrop = keyframes`
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

// ============================================
// SHELL
// ============================================

const PageContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  container-type: size;
  font-family: ${FONT_BODY};
  background: ${D.page};
  animation: ${fadeIn} 0.28s ease-out;
`;

const BackgroundImage = styled.div`
  position: absolute;
  inset: 0;
  background: url(${lobbyBackground}) center bottom / cover;
  transform: scale(1.06) translateX(0.8%);
  transform-origin: 50% 100%;
  opacity: 1;
  filter: saturate(0.78) brightness(0.55) contrast(1.12);
  z-index: 0;
  pointer-events: none;
`;

const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 48% 56% at 50% 42%,
      transparent 0%,
      rgba(4, 6, 10, 0.28) 48%,
      rgba(4, 6, 10, 0.82) 100%
    ),
    linear-gradient(
      180deg,
      rgba(4, 6, 10, 0.78) 0%,
      rgba(4, 6, 10, 0.28) 22%,
      rgba(4, 6, 10, 0.18) 48%,
      rgba(4, 6, 10, 0.55) 74%,
      rgba(4, 6, 10, 0.92) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.2;
  mix-blend-mode: overlay;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(60, 40, 20, 0.05) 0,
      transparent 1px,
      transparent 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(60, 40, 20, 0.04) 0,
      transparent 1px,
      transparent 4px
    );
`;

const AtmosphereKanji = styled.div`
  position: absolute;
  top: 16%;
  right: 3%;
  z-index: 1;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(160px, 28cqw, 340px);
  line-height: 0.72;
  color: rgba(245, 236, 217, 0.04);
  pointer-events: none;
  user-select: none;
  letter-spacing: -0.04em;
`;

// ============================================
// FLOATING CHROME
// ============================================

const TopSlug = styled.div`
  position: absolute;
  top: clamp(10px, 1.5cqh, 16px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  z-index: 30;
  will-change: transform, opacity;
  animation: ${broadcastSlideDown} 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s
    backwards;
`;

const SlugText = styled.span`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.72cqw, 0.56rem);
  color: ${(p) => (p.$accent ? C.ice : C.creamMute)};
  letter-spacing: 0.3em;
  text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  white-space: nowrap;

  strong {
    color: ${C.cream};
    letter-spacing: 0.1em;
  }
`;

const SlugRule = styled.span`
  width: 16px;
  height: 1px;
  background: rgba(245, 236, 217, 0.35);
`;

const GhostButton = styled.button`
  position: absolute;
  top: clamp(10px, 1.5cqh, 16px);
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: clamp(7px, 1cqw, 11px);
  min-height: 38px;
  padding: clamp(7px, 1cqh, 10px) clamp(13px, 1.8cqw, 20px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.52rem, 0.8cqw, 0.64rem);
  text-transform: uppercase;
  letter-spacing: 0.28em;
  color: ${C.creamMute};
  background: ${C.sumi};
  border: 1px solid rgba(245, 236, 217, 0.22);
  border-radius: 0;
  cursor: pointer;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease,
    transform 0.18s ease;
  animation: ${fadeIn} 0.35s ease both;

  .arrow {
    font-weight: 700;
    transition: transform 0.2s ease;
  }

  .material-symbols-outlined {
    font-size: 1.15em;
    transition: transform 0.3s ease;
  }

  &:hover {
    color: ${C.cream};
    border-color: rgba(245, 236, 217, 0.4);

    .arrow {
      transform: translateX(-3px);
    }
    .material-symbols-outlined {
      transform: rotate(90deg);
    }
  }

  &:active {
    transform: scale(0.98);
  }
`;

const BackButton = styled(GhostButton)`
  left: clamp(14px, 2.2cqw, 28px);
`;

const RefreshButton = styled(GhostButton)`
  right: clamp(14px, 2.2cqw, 28px);
`;

const TitleBlock = styled.div`
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: clamp(48px, 7.5cqh, 68px) clamp(18px, 2.8cqw, 36px)
    clamp(10px, 1.5cqh, 16px);
  will-change: transform, opacity;
  animation: ${fadeUp} 0.42s cubic-bezier(0.2, 0.7, 0.2, 1) 0.04s both;

  &::after {
    content: "";
    width: clamp(48px, 7cqw, 72px);
    height: 2px;
    margin-top: clamp(8px, 1.2cqh, 12px);
    background: ${C.vermillion};
  }
`;

const PageTitle = styled.h1`
  margin: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.15rem, 2.2cqw, 1.7rem);
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  line-height: 1;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    0 2px 0 rgba(0, 0, 0, 0.85);
`;

const PageSubtitle = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.68cqw, 0.52rem);
  color: ${C.ice};
  text-transform: uppercase;
  letter-spacing: 0.34em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
`;

// ============================================
// STAGE — two-column dossier
// ============================================

const Stage = styled.main`
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
  align-items: stretch;
  gap: clamp(18px, 2.6cqw, 36px);
  padding: clamp(8px, 1.4cqh, 16px) clamp(22px, 3.6cqw, 54px)
    clamp(18px, 2.6cqh, 32px);

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${D.panel};
  border: 1px solid ${D.border};
  border-radius: 0;
  overflow: hidden;
  box-shadow: 0 16px 36px ${D.shadow};
  animation: ${panelDrop} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${C.vermillion};
    z-index: 2;
  }
`;

const BriefPanel = styled(Panel)`
  will-change: transform, opacity;
  animation: ${clipRevealLeft} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.1s both;

  @media (max-width: 720px) {
    display: none;
  }
`;

const ListPanel = styled(Panel)`
  background:
    ${WASHI_LIGHT_ON_DARK},
    linear-gradient(180deg, #161a22 0%, #10141b 100%);
  will-change: transform, opacity;
  animation: ${clipRevealRight} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) 0.16s both;
`;

const PanelLabel = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: clamp(10px, 1.3cqh, 14px) clamp(14px, 1.8cqw, 22px);
  background: ${D.head};
  border-bottom: 1px solid ${D.borderSoft};

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: ${WASHI_LIGHT_ON_DARK};
    opacity: 0.7;
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }
`;

const HeadTitle = styled.h2`
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 1.1cqw, 12px);
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.68rem, 1.05cqw, 0.88rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.18em;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;

  &::before {
    content: "";
    width: clamp(14px, 1.8cqw, 20px);
    height: 2px;
    background: ${C.vermillion};
  }
`;

const HeadMeta = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.42rem, 0.66cqw, 0.52rem);
  color: ${(p) => (p.$accent ? C.ice : C.creamMute)};
  text-transform: uppercase;
  letter-spacing: 0.22em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
`;

// ============================================
// LEFT — briefing
// ============================================

const BriefBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: clamp(18px, 2.6cqh, 28px) clamp(16px, 2.2cqw, 26px);
  gap: clamp(16px, 2.4cqh, 24px);
`;

const BriefKanji = styled.div`
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(3.2rem, 6.5cqw, 5rem);
  line-height: 0.85;
  color: ${C.vermillion};
  letter-spacing: -0.04em;
  text-shadow: 0 2px 0 ${C.vermillionDeep};
  transform: rotate(-2deg);
  align-self: flex-start;
`;

const BriefLead = styled.p`
  margin: 0;
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.85rem, 1.35cqw, 1.1rem);
  color: ${C.cream};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.25;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
`;

const BriefCopy = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.58rem, 0.9cqw, 0.72rem);
  color: ${C.creamMute};
  letter-spacing: 0.04em;
  line-height: 1.65;
  max-width: 32ch;
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(8px, 1.2cqw, 12px);
  margin-top: auto;
`;

const StatPlaque = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: clamp(10px, 1.4cqh, 14px) clamp(12px, 1.5cqw, 16px);
  background: ${D.deep};
  border: 1px solid ${D.borderSoft};
  border-top: 2px solid ${(p) => (p.$accent === "gold" ? C.gold : C.success)};
`;

const StatLabel = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.62cqw, 0.48rem);
  color: ${C.creamMute};
  letter-spacing: 0.26em;
  text-transform: uppercase;
`;

const StatValue = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.1rem, 1.9cqw, 1.55rem);
  color: ${(p) => (p.$accent === "gold" ? C.gold : C.cream)};
  letter-spacing: 0.06em;
  line-height: 1;
  text-shadow: ${(p) =>
    p.$accent === "gold" ? "0 0 10px rgba(232, 197, 71, 0.35)" : "none"};
`;

const BriefTip = styled.div`
  padding: clamp(10px, 1.3cqh, 13px) clamp(12px, 1.5cqw, 16px);
  background: ${D.soft};
  border: 1px solid ${D.borderSoft};
  border-left: 3px solid ${C.vermillion};
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.48rem, 0.75cqw, 0.58rem);
  color: ${C.creamMute};
  letter-spacing: 0.04em;
  line-height: 1.55;

  strong {
    color: ${C.gold};
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin-right: 6px;
  }
`;

// ============================================
// RIGHT — dohyo list
// ============================================

const ListBody = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ColumnHeaders = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(70px, 0.7fr) minmax(64px, 0.55fr) auto;
  align-items: center;
  gap: clamp(10px, 1.4cqw, 18px);
  padding: clamp(8px, 1.1cqh, 11px) clamp(16px, 2.2cqw, 24px);
  border-bottom: 1px solid ${D.borderSoft};
  background: ${D.deep};
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.4rem, 0.62cqw, 0.48rem);
  color: ${C.creamMute};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  flex-shrink: 0;
`;

const RoomList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.9cqh, 10px);
  padding: clamp(12px, 1.8cqh, 18px) clamp(14px, 1.8cqw, 22px);
  overflow-y: auto;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: ${D.deep};
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(245, 236, 217, 0.16);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(245, 236, 217, 0.28);
  }
`;

// ============================================
// EMPTY STATE
// ============================================

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(32px, 5cqh, 64px) clamp(20px, 3cqw, 40px);
  text-align: center;
  animation: ${fadeUp} 0.5s ease-out 0.15s backwards;
`;

const EmptyHanko = styled.div`
  width: clamp(64px, 8cqw, 92px);
  height: clamp(64px, 8cqw, 92px);
  display: grid;
  place-items: center;
  margin-bottom: clamp(16px, 2.2cqh, 22px);
  background: ${C.vermillion};
  color: ${C.cream};
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(1.6rem, 2.6cqw, 2.2rem);
  border-radius: 2px;
  box-shadow:
    0 3px 0 ${C.vermillionDeep},
    0 10px 22px rgba(138, 31, 18, 0.4);
  transform: rotate(-3deg);

  &::after {
    content: "空";
  }
`;

const EmptyTitle = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1rem, 1.7cqw, 1.3rem);
  color: ${C.cream};
  text-transform: uppercase;
  letter-spacing: 0.14em;
  margin-bottom: clamp(8px, 1.2cqh, 12px);
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
`;

const EmptySubtext = styled.div`
  font-family: ${FONT_BODY};
  font-weight: 500;
  font-size: clamp(0.55rem, 0.9cqw, 0.7rem);
  color: ${C.creamMute};
  letter-spacing: 0.08em;
  max-width: 36ch;
  line-height: 1.65;
`;

const CreateHint = styled.div`
  margin-top: clamp(18px, 2.6cqh, 28px);
  font-family: ${FONT_BODY};
  font-weight: 700;
  font-size: clamp(0.48rem, 0.75cqw, 0.58rem);
  color: ${C.ice};
  letter-spacing: 0.22em;
  text-transform: uppercase;
`;

// ============================================
// COMPONENT
// ============================================

const Rooms = ({ rooms, setRoomName, handleJoinRoom, handleMainMenuPage }) => {
  const { getRooms } = useContext(SocketContext);

  useEffect(() => {
    getRooms();
  }, [getRooms]);

  const filteredRooms = rooms.filter((room) => !room.isCPURoom);
  const openCount = filteredRooms.filter((r) => r.players.length < 2).length;
  const fullCount = filteredRooms.length - openCount;

  return (
    <PageContainer>
      <BackgroundImage />
      <CinematicOverlay />
      <GrainOverlay />
      <AtmosphereKanji aria-hidden>土俵</AtmosphereKanji>
      <Snowfall intensity={8} showFrost={false} zIndex={2} />

      <BackButton
        onClick={() => {
          handleMainMenuPage();
          playButtonPressSound();
        }}
        onMouseEnter={playButtonHoverSound}
      >
        <span className="arrow">&larr;</span>
        Back
      </BackButton>

      <RefreshButton
        onClick={() => {
          getRooms();
          playButtonPressSound2();
        }}
        onMouseEnter={playButtonHoverSound}
      >
        <span className="material-symbols-outlined">refresh</span>
        Refresh
      </RefreshButton>

      <TopSlug>
        <SlugText $accent>
          <strong>CUSTOM</strong> MATCH
        </SlugText>
        <SlugRule aria-hidden />
        <SlugText>
          {filteredRooms.length > 0
            ? `${filteredRooms.length} Dohyo${filteredRooms.length === 1 ? "" : "s"}`
            : "Scanning"}
        </SlugText>
      </TopSlug>

      <TitleBlock>
        <PageTitle>Find a Dohyo</PageTitle>
        <PageSubtitle>1v1 Exhibition</PageSubtitle>
      </TitleBlock>

      <Stage>
        <BriefPanel>
          <PanelLabel>
            <HeadTitle>The Ring</HeadTitle>
            <HeadMeta $accent>Open Board</HeadMeta>
          </PanelLabel>
          <BriefBody>
            <BriefKanji aria-hidden>土</BriefKanji>
            <BriefLead>Step onto an open dohyo</BriefLead>
            <BriefCopy>
              Join a waiting rikishi or open a new ring. Empty servers create a
              fresh dohyo the moment you enter.
            </BriefCopy>

            <StatRow>
              <StatPlaque $accent="go">
                <StatLabel>Open</StatLabel>
                <StatValue>{openCount}</StatValue>
              </StatPlaque>
              <StatPlaque $accent="gold">
                <StatLabel>Full</StatLabel>
                <StatValue $accent="gold">{fullCount}</StatValue>
              </StatPlaque>
            </StatRow>

            <BriefTip>
              <strong>Tip</strong>
              Hit Refresh if a bout just opened — the board updates on demand.
            </BriefTip>
          </BriefBody>
        </BriefPanel>

        <ListPanel>
          <PanelLabel>
            <HeadTitle>Dohyos</HeadTitle>
            <HeadMeta $accent={filteredRooms.length > 0}>
              {filteredRooms.length > 0
                ? `${openCount} ready`
                : "None listed"}
            </HeadMeta>
          </PanelLabel>

          <ListBody>
            {filteredRooms.length === 0 ? (
              <EmptyState>
                <EmptyHanko />
                <EmptyTitle>No Dohyos Available</EmptyTitle>
                <EmptySubtext>
                  Be the first to step into the ring. Joining an empty server
                  will create a new dohyo.
                </EmptySubtext>
                <CreateHint>Refresh to scan again</CreateHint>
              </EmptyState>
            ) : (
              <>
                <ColumnHeaders>
                  <span>Dohyo</span>
                  <span>Rikishi</span>
                  <span>Status</span>
                  <span />
                </ColumnHeaders>
                <RoomList>
                  {filteredRooms.map((room, idx) => (
                    <Room
                      key={room.id}
                      room={room}
                      setRoomName={setRoomName}
                      handleJoinRoom={handleJoinRoom}
                      index={idx}
                    />
                  ))}
                </RoomList>
              </>
            )}
          </ListBody>
        </ListPanel>
      </Stage>
    </PageContainer>
  );
};

Rooms.propTypes = {
  rooms: PropTypes.array.isRequired,
  setRoomName: PropTypes.func.isRequired,
  handleJoinRoom: PropTypes.func.isRequired,
  handleMainMenuPage: PropTypes.func.isRequired,
};

export default Rooms;
