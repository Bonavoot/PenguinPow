import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled, { keyframes, css } from "styled-components";
import { FONT_DISPLAY, FONT_KANJI, FONT_BODY, C } from "./menuTheme";
import daySound from "../sounds/day-sound.ogg";
import { playBuffer } from "../utils/audioEngine";
import { getGlobalVolume } from "./Settings";
import {
  playPowerUpSelectionHoverSound,
  playPowerUpSelectionPressSound,
} from "../utils/soundUtils";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import { AI_ARCHETYPES } from "../config/bashoConfig";

/**
 * DayCard — the cinematic black "DAY X" interstitial shown between BASHO
 * bouts (spec §5.8). As of the Phase 7 rework it is also where the player
 * DRAFTS this bout's power-up before stepping onto the dohyo.
 *
 * Layout: a TWO-COLUMN stage — run framing (day / division / opponent /
 * record) on the left, the draft + Begin/Withdraw actions on the right. The
 * earlier single tall centered column overflowed at full-screen (the Withdraw
 * link fell off the bottom); splitting the content into two columns roughly
 * halves the vertical footprint so everything fits, and the whole stage still
 * lives in a scroll-safe shell as a last resort on very short viewports.
 *
 * The draft cards are lifted verbatim from PowerUpSelection (the cream washi
 * trading-card surface: colored art panel, letterpress name, usage hanko) so
 * the between-bout draft and the PvP/VS-CPU selection read as the same object.
 *
 * Single-player BASHO presentation only; never touches PvP / VS CPU.
 */

// ── DRAFT POOL DISPLAY (mirrors PowerUpSelection.powerUpInfo, minus Flap) ────
const DRAFT_INFO = {
  speed: {
    name: "Happy Feet",
    description: "Speed & dash",
    icon: happyFeetIcon,
    active: false,
  },
  power: {
    name: "Power Water",
    description: "+20% knockback",
    icon: powerWaterIcon,
    active: false,
  },
  snowball: {
    name: "Snowball",
    description: "Max 5 throws",
    icon: snowballImage,
    active: true,
  },
  pumo_army: {
    name: "Pumo Army",
    description: "3 clone waves",
    icon: pumoArmyIcon,
    active: true,
  },
  thick_blubber: {
    name: "Thick Blubber",
    description: "Block 1 hit",
    icon: thickBlubberIcon,
    active: false,
  },
};

// Power-type colors — identical set to PowerUpSelection's TYPE_COLORS.
const TYPE_COLORS = {
  speed: { main: "#00d2ff", deep: "#005f80", glow: "rgba(0, 210, 255, 0.45)" },
  power: { main: "#ff4444", deep: "#7a1c1c", glow: "rgba(255, 68, 68, 0.45)" },
  snowball: {
    main: "#74b9ff",
    deep: "#2a4a78",
    glow: "rgba(116, 185, 255, 0.45)",
  },
  pumo_army: {
    main: "#ffaa44",
    deep: "#8a5418",
    glow: "rgba(255, 170, 68, 0.45)",
  },
  thick_blubber: {
    main: "#aa77ff",
    deep: "#4a2c8a",
    glow: "rgba(170, 119, 255, 0.45)",
  },
};
const FALLBACK_TYPE = {
  main: C.gold,
  deep: C.goldDeep,
  glow: "rgba(232, 197, 71, 0.45)",
};
const getTypeColor = (type) => TYPE_COLORS[type] || FALLBACK_TYPE;

// ── ANIMATIONS ──────────────────────────────────────────────────────────────
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const dayKanjiIn = keyframes`
  0%   { opacity: 0; transform: scale(1.18); letter-spacing: 0.4em; }
  100% { opacity: 1; transform: scale(1); letter-spacing: 0.12em; }
`;

const cardDealIn = keyframes`
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ── SHELL ─────────────────────────────────────────────────────────────────
const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 12000;
  overflow-y: auto;
  background:
    radial-gradient(120% 90% at 50% 14%, rgba(40, 30, 18, 0.35) 0%, rgba(0, 0, 0, 0) 55%),
    #050505;
  color: ${C.cream};
  font-family: ${FONT_BODY};
  user-select: none;
`;

const Stage = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(1.4rem, 5vw, 4rem);
  padding: clamp(1.2rem, 4vmin, 2.6rem) clamp(1.4rem, 5vw, 3.5rem);
  box-sizing: border-box;
`;

// ── LEFT: RUN FRAMING ───────────────────────────────────────────────────────
const InfoCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: clamp(0.3rem, 1.2vmin, 0.7rem);
  flex: 0 1 auto;
`;

const KickerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.9rem;
  font-size: clamp(0.6rem, 1.3vmin, 0.86rem);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: ${C.creamMute};
  animation: ${fadeUp} 0.5s ease both;
`;

const KickerRule = styled.span`
  width: clamp(20px, 4vw, 48px);
  height: 1px;
  background: ${C.creamFaint};
`;

const DayKanji = styled.div`
  font-family: ${FONT_KANJI};
  font-size: clamp(1.4rem, 4vmin, 2.4rem);
  font-weight: 700;
  color: ${C.gold};
  letter-spacing: 0.12em;
  text-shadow: 0 6px 30px rgba(232, 197, 71, 0.25);
  animation: ${dayKanjiIn} 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
`;

const DayNumber = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(2.6rem, 9vmin, 5.4rem);
  line-height: 0.9;
  color: ${C.cream};
  animation: ${fadeUp} 0.6s ease both 0.08s;
`;

const DivisionLine = styled.div`
  font-size: clamp(0.7rem, 1.7vmin, 1rem);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: ${C.iceBright};
  animation: ${fadeUp} 0.6s ease both 0.16s;
`;

const Versus = styled.div`
  margin-top: clamp(0.4rem, 1.6vmin, 1rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  animation: ${fadeUp} 0.6s ease both 0.24s;
`;

const VsLabel = styled.span`
  font-size: clamp(0.58rem, 1.2vmin, 0.78rem);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: ${C.creamMute};
`;

const OpponentName = styled.span`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.3rem, 4vmin, 2.3rem);
  color: ${({ $boss }) => ($boss ? C.gold : C.vermillionBright)};
  ${({ $boss }) =>
    $boss &&
    css`
      text-shadow: 0 0 18px rgba(232, 197, 71, 0.45);
    `}
`;

const OpponentRank = styled.span`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.65rem, 1.5vmin, 0.95rem);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${C.gold};
`;

// Rival fighting-style tag (archetype kanji + label) shown under the name.
const StyleTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: ${FONT_BODY};
  font-size: clamp(0.5rem, 1vmin, 0.66rem);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${C.creamMute};
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  padding: 0.18rem 0.6rem;

  .kanji {
    font-family: ${FONT_KANJI};
    font-size: 1.25em;
    letter-spacing: 0;
    color: ${C.iceBright};
  }
`;

// Gold "gatekeeper" badge that marks a division boss.
const BossBadge = styled.span`
  font-family: ${FONT_BODY};
  font-size: clamp(0.5rem, 1vmin, 0.66rem);
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: ${C.ink};
  background: linear-gradient(180deg, #f1d061, ${C.gold});
  border-radius: 4px;
  padding: 0.2rem 0.55rem;
  box-shadow: 0 0 16px rgba(232, 197, 71, 0.5);
  animation: ${fadeUp} 0.6s ease both 0.2s;
`;

const Records = styled.div`
  display: flex;
  gap: clamp(1.4rem, 5vw, 2.8rem);
  margin-top: clamp(0.3rem, 1.2vmin, 0.8rem);
  animation: ${fadeUp} 0.6s ease both 0.3s;
`;

const RecordCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const RecordWho = styled.span`
  font-size: clamp(0.54rem, 1.1vmin, 0.74rem);
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: ${C.creamMute};
`;

const RecordVal = styled.span`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1rem, 2.8vmin, 1.6rem);
  color: ${C.cream};
`;

// ── RIGHT: DRAFT + ACTIONS ──────────────────────────────────────────────────
const DraftCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.7rem, 2vmin, 1.3rem);
  flex: 0 1 auto;
`;

const DraftLabel = styled.div`
  font-size: clamp(0.64rem, 1.4vmin, 0.9rem);
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: ${C.gold};
  animation: ${fadeUp} 0.6s ease both 0.36s;
`;

const CardsRow = styled.div`
  display: flex;
  gap: clamp(12px, 1.6vw, 22px);
  justify-content: center;
  align-items: stretch;
  flex-wrap: nowrap;
  /* Reserve room for the hover/selected lift so cards don't clip. */
  padding-top: clamp(14px, 2vmin, 22px);
`;

// Card surface — copied from PowerUpSelection.PowerCard (cream washi trading
// card). $dimmed (rather than disabled) so the player can still re-pick.
const PowerCard = styled.button`
  --type-color: ${(p) => getTypeColor(p.$type).main};
  --type-deep: ${(p) => getTypeColor(p.$type).deep};
  --type-glow: ${(p) => getTypeColor(p.$type).glow};

  position: relative;
  flex: 0 0 auto;
  width: clamp(116px, 12.5vw, 152px);
  aspect-ratio: 5 / 6;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: ${C.cream};
  border: 2px solid rgba(60, 40, 20, 0.55);
  cursor: pointer;
  font-family: "Space Grotesk", sans-serif;
  padding: 0;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45), 0 2px 0 rgba(60, 40, 20, 0.55);
  opacity: 0;
  animation: ${cardDealIn} 0.38s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
  animation-delay: ${(p) => 0.42 + p.$index * 0.08}s;
  transition: transform 0.18s cubic-bezier(0.2, 0.7, 0.2, 1),
    border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.22s ease,
    filter 0.22s ease;
  will-change: transform, opacity;

  &::after {
    content: "";
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(60, 40, 20, 0.32);
    pointer-events: none;
    z-index: 3;
  }

  &:hover {
    transform: translateY(-12px) scale(1.025);
    border-color: var(--type-color);
    box-shadow: 0 22px 34px rgba(0, 0, 0, 0.55),
      0 2px 0 rgba(60, 40, 20, 0.55), 0 0 0 1px var(--type-color),
      0 0 32px var(--type-glow);
  }

  &:active {
    transform: translateY(-6px) scale(1.005);
    transition: transform 0.08s ease;
  }

  ${(p) =>
    p.$selected &&
    css`
      transform: translateY(-16px) scale(1.035);
      border-color: var(--type-color);
      box-shadow: 0 28px 40px rgba(0, 0, 0, 0.6),
        0 2px 0 rgba(60, 40, 20, 0.55), 0 0 0 2px var(--type-color),
        0 0 44px var(--type-glow);
    `}

  ${(p) =>
    p.$dimmed &&
    css`
      opacity: 0.28;
      filter: saturate(0.3) brightness(0.9);
      transform: translateY(0) scale(0.97);
      &:hover {
        opacity: 0.6;
        filter: saturate(0.6) brightness(0.95);
        transform: translateY(-6px) scale(1);
      }
    `}
`;

const CardHeader = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 48%;
  background: var(--type-color);
  box-shadow: inset 0 -2px 0 var(--type-deep),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);

  img {
    width: clamp(48px, 6.2vw, 74px);
    height: clamp(48px, 6.2vw, 74px);
    object-fit: contain;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.5));
  }
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: clamp(4px, 0.6vmin, 7px);
  padding: clamp(11px, 1.5vmin, 15px) clamp(9px, 1.1vw, 13px)
    clamp(22px, 3vmin, 30px);
  position: relative;
  flex: 1;
  border-top: 1px solid rgba(60, 40, 20, 0.35);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
        90deg,
        transparent 0,
        transparent 2px,
        rgba(60, 40, 20, 0.055) 2px,
        rgba(60, 40, 20, 0.055) 3px
      ),
      repeating-linear-gradient(
        0deg,
        transparent 0,
        transparent 4px,
        rgba(60, 40, 20, 0.04) 4px,
        rgba(60, 40, 20, 0.04) 5px
      );
    pointer-events: none;
  }
`;

const PowerName = styled.div`
  font-family: "Bungee", cursive;
  font-size: clamp(0.66rem, 1vw, 0.9rem);
  color: ${C.inkText};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.05;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 1px 0 rgba(255, 252, 244, 0.7);
`;

const PowerDesc = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  font-size: clamp(0.48rem, 0.78vw, 0.64rem);
  color: ${C.inkTextSoft};
  text-align: center;
  line-height: 1.25;
  letter-spacing: 0.03em;
`;

const UsageChip = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-weight: 700;
  font-size: clamp(0.4rem, 0.58vw, 0.5rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 2px clamp(6px, 0.8vw, 9px);
  position: absolute;
  bottom: clamp(7px, 1vmin, 10px);
  right: clamp(7px, 0.9vw, 11px);
  background: ${(p) => (p.$active ? C.vermillion : "transparent")};
  color: ${(p) => (p.$active ? C.cream : C.inkTextMute)};
  border: 1px solid
    ${(p) => (p.$active ? C.vermillionDeep : "rgba(60, 40, 20, 0.32)")};
  ${(p) =>
    p.$active &&
    css`
      box-shadow: inset 0 0 0 1px rgba(245, 236, 217, 0.18),
        0 1px 0 rgba(0, 0, 0, 0.18);
      text-shadow: 0 1px 0 rgba(70, 18, 8, 0.5);
    `}
  z-index: 4;
  white-space: nowrap;
`;

// ── ACTIONS ───────────────────────────────────────────────────────────────
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.45rem, 1.4vmin, 0.9rem);
  margin-top: clamp(0.3rem, 1.2vmin, 0.8rem);
  animation: ${fadeUp} 0.6s ease both 0.5s;
`;

const BeginButton = styled.button`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.95rem, 2.2vmin, 1.4rem);
  letter-spacing: 0.08em;
  color: #1a1205;
  background: linear-gradient(160deg, ${C.gold} 0%, ${C.goldDeep} 100%);
  border: none;
  border-radius: 10px;
  padding: clamp(0.6rem, 1.6vmin, 0.95rem) clamp(2rem, 6vw, 3.2rem);
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(232, 197, 71, 0.28);
  transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease,
    opacity 0.12s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.06);
    box-shadow: 0 14px 38px rgba(232, 197, 71, 0.4);
  }
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    filter: saturate(0.5);
    box-shadow: none;
  }
`;

const BeginHint = styled.div`
  font-size: clamp(0.58rem, 1.2vmin, 0.78rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${C.creamFaint};
  min-height: 1em;
`;

const WithdrawLink = styled.button`
  font-family: ${FONT_BODY};
  font-size: clamp(0.6rem, 1.2vmin, 0.8rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${C.creamMute};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  transition: color 0.12s ease;

  &:hover {
    color: ${C.vermillionBright};
  }
`;

// Dev-only — shown only when the bashoDebug flag is on (Ctrl+Shift+B in the
// hub). Fast-forwards the run to the final day for testing the results screen.
const DevLink = styled.button`
  margin-top: 0.4rem;
  font-family: ${FONT_BODY};
  font-size: clamp(0.55rem, 1.1vmin, 0.72rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${C.iceBright};
  background: none;
  border: 1px dashed ${C.creamFaint};
  border-radius: 4px;
  cursor: pointer;
  padding: 0.3rem 0.7rem;
  opacity: 0.7;
  transition: opacity 0.12s ease, color 0.12s ease;

  &:hover {
    opacity: 1;
  }
`;

// ── WITHDRAW CONFIRM ────────────────────────────────────────────────────────
const ConfirmBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 38ch;
  text-align: center;
  animation: ${fadeUp} 0.4s ease both;
`;

const ConfirmTitle = styled.div`
  font-family: ${FONT_DISPLAY};
  font-size: clamp(1.2rem, 3.4vmin, 2rem);
  color: ${C.vermillionBright};
`;

const ConfirmText = styled.span`
  font-size: clamp(0.72rem, 1.5vmin, 0.94rem);
  color: ${C.creamWarm};
  line-height: 1.55;
`;

const ConfirmButtons = styled.div`
  display: flex;
  gap: 0.8rem;
  margin-top: 0.3rem;
`;

const SmallButton = styled.button`
  font-family: ${FONT_BODY};
  font-size: clamp(0.7rem, 1.5vmin, 0.92rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.55rem 1.4rem;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$danger ? C.vermillion : C.creamFaint)};
  background: ${(p) => (p.$danger ? "rgba(216, 59, 39, 0.18)" : "transparent")};
  color: ${(p) => (p.$danger ? C.vermillionBright : C.creamMute)};
  transition: background 0.12s ease, color 0.12s ease;

  &:hover {
    background: ${(p) =>
      p.$danger ? "rgba(216, 59, 39, 0.3)" : "rgba(245, 236, 217, 0.08)"};
    color: ${(p) => (p.$danger ? "#fff" : C.cream)};
  }
`;

function fmtRecord(r) {
  return `${r?.wins ?? 0}–${r?.losses ?? 0}`;
}

function DayCard({
  day,
  totalBouts,
  divisionLabel,
  opponentName,
  opponentRankLabel,
  opponentRecord,
  opponentArchetype,
  opponentIsBoss,
  playerRecord,
  draftOptions,
  onBegin,
  onWithdraw,
  onSkipToFinalDay,
}) {
  // Resolve the rival's fighting-style metadata for the style tag. `balanced`
  // is the neutral default and shows no tag (only flavored styles surface).
  const archetypeMeta =
    opponentArchetype && opponentArchetype !== "balanced"
      ? AI_ARCHETYPES[opponentArchetype]
      : null;
  // Read the bashoDebug flag (toggled with Ctrl+Shift+B in the hub) so the
  // skip-to-final-day affordance only appears for developers.
  const devEnabled = (() => {
    try {
      return localStorage.getItem("bashoDebug") === "1";
    } catch {
      return false;
    }
  })();
  const isFinalDay = day >= totalBouts;
  const [confirming, setConfirming] = useState(false);
  const [picked, setPicked] = useState(null);
  const playedRef = useRef(false);

  const options = Array.isArray(draftOptions) ? draftOptions : [];
  const draftReady = options.length === 0 || picked != null;

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    try {
      playBuffer(daySound, 0.18 * getGlobalVolume());
    } catch {
      /* sound is non-critical */
    }
  }, []);

  const handlePick = (type) => {
    playPowerUpSelectionPressSound();
    setPicked(type);
  };

  const handleBegin = () => {
    if (!draftReady) return;
    onBegin(picked);
  };

  if (confirming) {
    return (
      <Screen>
        <Stage>
          <ConfirmBox>
            <ConfirmTitle>Withdraw — Kyūjō</ConfirmTitle>
            <ConfirmText>
              Withdraw from the basho? Your banzuke movement is resolved on your
              current record ({fmtRecord(playerRecord)}). This ends the run.
            </ConfirmText>
            <ConfirmButtons>
              <SmallButton onClick={() => setConfirming(false)}>
                Keep Fighting
              </SmallButton>
              <SmallButton $danger onClick={onWithdraw}>
                Withdraw
              </SmallButton>
            </ConfirmButtons>
          </ConfirmBox>
        </Stage>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stage>
        <InfoCol>
          <KickerRow>
            <KickerRule />
            Honbasho · Day {day} of {totalBouts}
            <KickerRule />
          </KickerRow>
          <DayKanji>第{day}日目</DayKanji>
          <DayNumber>DAY {day}</DayNumber>
          <DivisionLine>{divisionLabel}</DivisionLine>
          <Versus>
            <VsLabel>{opponentIsBoss ? "Division Gatekeeper" : "Next Opponent"}</VsLabel>
            <OpponentName $boss={opponentIsBoss}>{opponentName}</OpponentName>
            {opponentRankLabel && (
              <OpponentRank>{opponentRankLabel}</OpponentRank>
            )}
            {opponentIsBoss && <BossBadge>Boss</BossBadge>}
            {archetypeMeta && (
              <StyleTag>
                <span className="kanji">{archetypeMeta.kanji}</span>
                {archetypeMeta.label}
              </StyleTag>
            )}
          </Versus>
          <Records>
            <RecordCol>
              <RecordWho>You</RecordWho>
              <RecordVal>{fmtRecord(playerRecord)}</RecordVal>
            </RecordCol>
            <RecordCol>
              <RecordWho>{opponentName}</RecordWho>
              <RecordVal>{fmtRecord(opponentRecord)}</RecordVal>
            </RecordCol>
          </Records>
        </InfoCol>

        <DraftCol>
          {options.length > 0 && (
            <>
              <DraftLabel>Draft · Choose Your Edge</DraftLabel>
              <CardsRow>
                {options.map((type, index) => {
                  const info = DRAFT_INFO[type];
                  if (!info) return null;
                  const isSelected = picked === type;
                  const isDimmed = picked != null && !isSelected;
                  return (
                    <PowerCard
                      key={type}
                      type="button"
                      $type={type}
                      $selected={isSelected}
                      $dimmed={isDimmed}
                      $index={index}
                      onClick={() => handlePick(type)}
                      onMouseEnter={playPowerUpSelectionHoverSound}
                    >
                      <CardHeader>
                        <img src={info.icon} alt={info.name} />
                      </CardHeader>
                      <CardBody>
                        <PowerName>{info.name}</PowerName>
                        <PowerDesc>{info.description}</PowerDesc>
                        <UsageChip $active={info.active}>
                          {info.active ? "F To Use" : "Passive"}
                        </UsageChip>
                      </CardBody>
                    </PowerCard>
                  );
                })}
              </CardsRow>
            </>
          )}

          <Actions>
            <BeginButton onClick={handleBegin} disabled={!draftReady} autoFocus>
              Begin Bout →
            </BeginButton>
            <BeginHint>
              {options.length > 0 && !picked ? "Select a power-up" : ""}
            </BeginHint>
            <WithdrawLink onClick={() => setConfirming(true)}>
              Withdraw — Fake Injury (Kyūjō)
            </WithdrawLink>
            {devEnabled && onSkipToFinalDay && !isFinalDay && (
              <DevLink onClick={() => onSkipToFinalDay()}>
                ⚡ Dev: Skip to Final Day
              </DevLink>
            )}
          </Actions>
        </DraftCol>
      </Stage>
    </Screen>
  );
}

DayCard.propTypes = {
  day: PropTypes.number,
  totalBouts: PropTypes.number,
  divisionLabel: PropTypes.string,
  opponentName: PropTypes.string,
  opponentRankLabel: PropTypes.string,
  opponentRecord: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  opponentArchetype: PropTypes.string,
  opponentIsBoss: PropTypes.bool,
  playerRecord: PropTypes.shape({
    wins: PropTypes.number,
    losses: PropTypes.number,
  }),
  draftOptions: PropTypes.arrayOf(PropTypes.string),
  onBegin: PropTypes.func,
  onWithdraw: PropTypes.func,
  onSkipToFinalDay: PropTypes.func,
};

export default DayCard;
