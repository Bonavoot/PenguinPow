import { useState, useEffect, useRef, useContext } from "react";
import PropTypes from "prop-types";

import Lobby from "./Lobby";
import Rooms from "./Rooms";
import Game from "./Game";
import Settings from "./Settings";
import CustomizePage from "./CustomizePage";
import BashoHub from "./BashoHub";
import DayCard from "./DayCard";
import BashoResults from "./BashoResults";
import { usePlayerColors } from "../context/PlayerColorContext";
import { writeSave, makeDefaultSave, loadSave } from "../lib/saveStore";
import {
  getActiveOutfit,
  applyOutfitToPlayer1Setters,
} from "../lib/outfits";
import {
  startDay,
  currentOpponent,
  recordBout,
  isRunComplete,
  applyRunResult,
  ensureOpponentRanks,
} from "../lib/bashoRun";
import {
  getDivision,
  STAT_BASE,
  ATTRIBUTES,
  LOADOUT_OPTION_BY_ID,
  isUnlocked,
  rollDraftOptions,
  effectiveDifficulty,
  DIFFICULTY_ORDER,
  formatRank,
  boutLadderPosition,
} from "../config/bashoConfig";
import {
  applyBashoDraftPick,
  normalizeBashoDraftList,
} from "../config/powerUpConfig";
import styled, { keyframes } from "styled-components";
import { SocketContext } from "../SocketContext";

/*
 * Difficulty for a specific bout: the HIGHER of the intra-basho ramp
 * (effectiveDifficulty — division base + back-third bump) and the opponent's
 * own floor (a division boss can be IMPOSSIBLE regardless of the ramp). Keeps
 * a boss from being softened, while still letting the ramp upgrade a normal day.
 */
function boutDifficulty(run, boutIndex) {
  const ramp = effectiveDifficulty(run, boutIndex);
  const oppFloor = run?.opponents?.[boutIndex]?.difficulty;
  const ri = DIFFICULTY_ORDER.indexOf(ramp);
  const oi = DIFFICULTY_ORDER.indexOf(oppFloor);
  return oi > ri ? oppFloor : ramp;
}
import lobbyBackground from "../assets/lobby-bkg.webp";

import pumo from "../assets/pumo-idle.png";
/*
 * Hero portrait for the main menu — dignified pre-match pose with the
 * ceremonial kesho-mawashi. Distinct from the in-game pumo-idle.png sprite
 * (which stays imported for preloading + use in lobby/game).
 */
import pumoMainMenu from "../assets/pumo-main-menu.png";
import pumoLogo from "../assets/pumo-logo.png";
/*
 * Single locked-in hero scene — the two-penguins-fighting sketch reads as
 * "this is what the game IS." Static hero image; no slideshow.
 */
import mainMenuBackground from "../assets/main-menu-bkg-4.webp";
import {
  playButtonHoverSound,
  playButtonPressSound2,
  playBackgroundMusic,
  stopBackgroundMusic,
} from "../utils/soundUtils";
import Snowfall from "./Snowfall";

import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  fadeIn,
  fadeUp,
  slideInLeft,
  broadcastSlideDown,
  TEXT_SHADOW_DISPLAY,
  TEXT_SHADOW_DISPLAY_SOFT,
} from "./menuTheme";

// ============================================
// LOCAL ANIMATIONS
// ============================================

const kenBurns = keyframes`
  0%   { transform: scale(1.05) translate(0, 0); }
  100% { transform: scale(1.12) translate(-1.2%, -0.8%); }
`;

const pumoBreathe = keyframes`
  0%, 100% { transform: scaleY(1); }
  50%      { transform: scaleY(1.018); }
`;

// ============================================
// SHELL — PreMatch / BashoHub printed-banzuke language
// ============================================

const MainMenuContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #080a0e;
  container-type: size;
  font-family: ${FONT_BODY};
`;

const BackgroundImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 55%;
  z-index: 0;
  pointer-events: none;
  transform: scale(1.08);
  /*
   * Obscure plate that still keeps festival color — dim + slight blur so
   * the arena sits behind the UI instead of fighting it for focus.
   */
  filter: saturate(1.06) brightness(0.78) contrast(1.08) blur(1.2px);
  animation: ${kenBurns} 28s ease-in-out infinite alternate;
`;

/*
 * Obscure grade without the old icy-blue mud: neutral sumi dim + a real
 * left rail for type. Snowfall owns frost; we don't double-wash here.
 */
const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    /* menu rail — dark enough that white Bungee never meets bright snow */
    linear-gradient(
      90deg,
      rgba(4, 6, 10, 0.62) 0%,
      rgba(4, 6, 10, 0.36) 18%,
      rgba(4, 6, 10, 0.12) 34%,
      transparent 48%
    ),
    /* soft pool of light around the hero — keeps Pumo readable */
    radial-gradient(
      ellipse 46% 58% at 72% 48%,
      rgba(255, 248, 235, 0.07) 0%,
      transparent 62%
    ),
    /* vignette — obscure edges, open center */
    radial-gradient(
      ellipse 58% 60% at 56% 42%,
      transparent 0%,
      rgba(4, 6, 10, 0.22) 52%,
      rgba(4, 6, 10, 0.62) 100%
    ),
    /* letterbox */
    linear-gradient(
      180deg,
      rgba(4, 6, 10, 0.5) 0%,
      rgba(4, 6, 10, 0.12) 20%,
      rgba(4, 6, 10, 0.04) 48%,
      rgba(4, 6, 10, 0.28) 76%,
      rgba(4, 6, 10, 0.72) 100%
    );
`;

const GrainOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.08;
  mix-blend-mode: soft-light;
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

/* Giant atmospheric kanji — whisper only; never compete with Pumo. */
const AtmosphereKanji = styled.div`
  position: absolute;
  top: 6%;
  right: -2%;
  z-index: 1;
  font-family: ${FONT_KANJI};
  font-weight: 900;
  font-size: clamp(180px, 34cqw, 400px);
  line-height: 0.72;
  color: rgba(245, 236, 217, 0.035);
  pointer-events: none;
  user-select: none;
  letter-spacing: -0.04em;
  transform: rotate(-6deg);
`;

// ============================================
// TOP SLUG — PreMatch broadcast chrome
// ============================================

const TopSlug = styled.div`
  position: absolute;
  top: clamp(12px, 1.8cqh, 20px);
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
  font-size: clamp(0.48rem, 0.78cqw, 0.62rem);
  color: ${(p) =>
    p.$warn ? C.vermillionBright : p.$accent ? C.ice : C.creamMute};
  letter-spacing: 0.28em;
  text-transform: uppercase;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-shadow: ${TEXT_SHADOW_DISPLAY_SOFT};
  white-space: nowrap;
  opacity: 0.92;

  strong {
    color: ${C.cream};
    letter-spacing: 0.12em;
  }
`;

const SlugRule = styled.span`
  width: 18px;
  height: 1px;
  background: rgba(245, 236, 217, 0.45);
`;

// ============================================
// HERO STAGE
// ============================================

const HeroStage = styled.main`
  position: relative;
  z-index: 10;
  flex: 1;
  min-height: 0;
  display: grid;
  /* Menu narrower, portrait wider — character owns the frame. */
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr);
  gap: clamp(12px, 2cqw, 32px);
  padding: clamp(48px, 7cqh, 72px) clamp(28px, 4cqw, 64px)
    clamp(20px, 3cqh, 40px);
  align-items: stretch;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    padding-top: clamp(64px, 10cqh, 96px);
  }
`;

/*
 * Fighting-game title stack: logo + vermillion rule + menu as one
 * vertically centered unit. Intentional empty space around the stack —
 * no tagline / rank filler under the brand.
 */
const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: clamp(22px, 3.2cqh, 36px);
  min-width: 0;
  max-width: clamp(320px, 38cqw, 440px);
  will-change: transform, opacity;
  animation: ${slideInLeft} 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) 0.12s both;
`;

const BrandBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: clamp(12px, 1.8cqh, 18px);
  /* Same left rail as MenuButton cursor gutter */
  padding-left: clamp(16px, 2cqw, 24px);
`;

const LogoImage = styled.img`
  display: block;
  width: clamp(12.5rem, 27cqw, 19.5rem);
  height: auto;
  object-fit: contain;
  /* Soft lift — hard 2px shelf made the logo mark read as aliased. */
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.65))
    drop-shadow(0 18px 32px rgba(0, 0, 0, 0.45));
`;

/* Structural accent under logo — short vermillion underline with soft seat. */
const BrandRule = styled.div`
  width: clamp(56px, 8cqw, 84px);
  height: 3px;
  border-radius: 1px;
  background: ${C.vermillion};
  box-shadow: 0 0 12px rgba(196, 48, 38, 0.45);
  opacity: 0;
  animation: ${fadeIn} 0.4s ease-out 0.4s forwards;
`;

const MenuList = styled.nav`
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.6cqh, 16px);
`;

const MenuButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  background: none;
  border: none;
  padding: clamp(2px, 0.4cqh, 5px) clamp(4px, 0.6cqw, 8px)
    clamp(2px, 0.4cqh, 5px) clamp(16px, 2cqw, 24px);
  margin: 0;
  cursor: pointer;
  font-family: ${FONT_DISPLAY};
  font-size: ${(p) =>
    p.$primary
      ? "clamp(1.7rem, 2.9cqw, 2.35rem)"
      : "clamp(1.05rem, 1.7cqw, 1.4rem)"};
  font-weight: 400;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: left;
  line-height: 0.95;
  /* Secondary items sit quieter until hover — clearer fighting-game hierarchy */
  color: ${(p) => (p.$primary ? C.cream : "rgba(255, 255, 255, 0.78)")};
  /*
   * Soft ambient seat — same lesson as SumoAnnouncementBanner.
   * The old 4-way 1px black stroke + hard shelf made Bungee look
   * jagged / "sharpness too high" at these sizes.
   */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-shadow: ${TEXT_SHADOW_DISPLAY};
  transition:
    transform 0.28s cubic-bezier(0.2, 0.85, 0.2, 1),
    color 0.2s ease;
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.4 + p.$index * 0.07}s;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: ${(p) => (p.$primary ? "4px" : "3px")};
    height: ${(p) => (p.$primary ? "0.68em" : "0.7em")};
    background: ${C.vermillion};
    border-radius: 1px;
    box-shadow: 0 0 10px rgba(196, 48, 38, 0.55);
    transform: ${(p) =>
      p.$primary
        ? "translate(0, -50%) scaleY(1)"
        : "translate(-12px, -50%) scaleY(0.35)"};
    transform-origin: center;
    opacity: ${(p) => (p.$primary ? 1 : 0)};
    transition:
      transform 0.32s cubic-bezier(0.25, 0.85, 0.2, 1),
      opacity 0.22s ease;
    pointer-events: none;
  }

  &:hover {
    color: ${C.cream};
    transform: translateX(clamp(6px, 0.9cqw, 12px));
  }
  &:hover::before {
    transform: translate(0, -50%) scaleY(1);
    opacity: 1;
  }
  &:active {
    transform: translateX(clamp(3px, 0.5cqw, 6px)) scale(0.99);
  }
`;

const SystemButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  margin-top: clamp(10px, 1.8cqh, 18px);
  background: none;
  border: none;
  padding: clamp(2px, 0.4cqh, 5px) clamp(4px, 0.6cqw, 8px)
    clamp(2px, 0.4cqh, 5px) clamp(16px, 2cqw, 24px);
  cursor: pointer;
  font-family: ${FONT_DISPLAY};
  font-weight: 400;
  font-size: clamp(0.72rem, 1.15cqw, 0.92rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;
  line-height: 0.95;
  color: rgba(245, 236, 217, 0.48);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-shadow: ${TEXT_SHADOW_DISPLAY_SOFT};
  transition:
    color 0.2s ease,
    transform 0.28s cubic-bezier(0.2, 0.85, 0.2, 1);
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.4 + p.$index * 0.07}s;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 3px;
    height: 0.7em;
    background: ${C.vermillion};
    border-radius: 1px;
    transform: translate(-12px, -50%) scaleY(0.35);
    transform-origin: center;
    opacity: 0;
    transition:
      transform 0.32s cubic-bezier(0.25, 0.85, 0.2, 1),
      opacity 0.22s ease;
    pointer-events: none;
  }

  &:hover {
    color: ${C.cream};
    transform: translateX(clamp(6px, 0.9cqw, 12px));
  }
  &:hover::before {
    transform: translate(0, -50%) scaleY(1);
    opacity: 1;
  }
  &:active {
    transform: translateX(clamp(3px, 0.5cqw, 6px)) scale(0.99);
  }
`;

const RightColumn = styled.aside`
  position: relative;
  height: 100%;
  min-width: 0;

  @media (max-width: 720px) {
    display: none;
  }
`;

const PumoHeroWrapper = styled.div`
  position: absolute;
  right: clamp(-120px, -7cqw, -48px);
  bottom: clamp(-240px, -30cqh, -160px);
  height: clamp(540px, 108cqh, 820px);
  width: auto;
  z-index: 2;
  pointer-events: none;
  user-select: none;
  will-change: opacity, transform;
  animation: ${fadeUp} 0.8s ease-out 0.22s backwards;

  /* Ground contact shadow — stops the "sticker on the art" look */
  &::after {
    content: "";
    position: absolute;
    left: 18%;
    right: 22%;
    bottom: 14%;
    height: 7%;
    background: radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0.55) 0%,
      rgba(0, 0, 0, 0.22) 42%,
      transparent 72%
    );
    filter: blur(10px);
    z-index: 0;
    pointer-events: none;
  }
`;

const PumoHero = styled.img`
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  width: auto;
  transform-origin: 50% 100%;
  filter: brightness(1.05) contrast(1.06) saturate(1.08)
    drop-shadow(0 0 clamp(1px, 0.08cqw, 2.5px) #000)
    drop-shadow(0 28px 40px rgba(0, 0, 0, 0.55));
  will-change: transform;
  animation: ${pumoBreathe} 3s ease-in-out infinite;
`;

const ConnectionErrorBanner = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: clamp(10px, 1.4cqh, 14px) clamp(18px, 2.4cqw, 28px);
  background: ${C.sumi};
  border: 1px solid rgba(245, 236, 217, 0.22);
  box-shadow:
    0 8px 22px rgba(0, 0, 0, 0.5),
    inset 0 2px 0 ${C.vermillion};
  font-family: ${FONT_DISPLAY};
  font-size: clamp(0.55rem, 0.9cqw, 0.72rem);
  color: ${C.cream};
  letter-spacing: 0.14em;
  animation: ${fadeIn} 0.4s ease-out;

  &::before {
    content: "⚠";
    color: ${C.gold};
    font-size: 1.4em;
  }
`;

// ============================================
// PRELOAD ASSETS
// ============================================

const preGameImages = [lobbyBackground, pumo, mainMenuBackground];

// ============================================
// MAIN COMPONENT
// ============================================

const MainMenu = ({
  rooms,
  setRooms,
  currentPage,
  setCurrentPage,
  localId,
  connectionError,
}) => {
  const [roomName, setRoomName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isCPUMatch, setIsCPUMatch] = useState(false);
  const { socket } = useContext(SocketContext);

  // ── BASHO run state machine (single-player only; gated from PvP/VS CPU) ──
  const {
    player1Color,
    player1BodyColor,
    setPlayer1Color,
    setPlayer2Color,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  } = usePlayerColors();
  const [isBashoMatch, setIsBashoMatch] = useState(false);
  const [bashoRun, setBashoRun] = useState(null);
  const [bashoResult, setBashoResult] = useState(null);
  // No-remount run presentation: the whole basho plays in ONE mounted Game.
  // `bashoPhase` toggles the DAY-card overlay; `bashoArmed` releases the bout
  // after the player dismisses the card; `bashoBoutToken` re-triggers Game's
  // pre-match (a light opponent recolor) for each new bout without a remount.
  const [bashoPhase, setBashoPhase] = useState(null); // null | "day" | "bout"
  const [bashoArmed, setBashoArmed] = useState(false);
  const [bashoBoutToken, setBashoBoutToken] = useState(0);
  // The 3 power-up options offered on the current DAY card (Phase 7 draft).
  const [bashoDraftOptions, setBashoDraftOptions] = useState(null);
  // Refs mirror the latest values for use inside once-registered socket
  // handlers without re-subscribing on every render.
  const bashoSaveRef = useRef(null);
  const bashoRunRef = useRef(null);
  const bashoRoomIdRef = useRef(null);
  const isBashoMatchRef = useRef(false);
  const boutResolvedRef = useRef(false);
  const resolveBoutRef = useRef(null);
  const player1ColorRef = useRef(player1Color);
  const player1BodyColorRef = useRef(player1BodyColor);
  player1ColorRef.current = player1Color;
  player1BodyColorRef.current = player1BodyColor;

  // Resolve a finished or withdrawn run: apply banzuke movement to the
  // career, persist, and show the results screen.
  const finishBasho = (run, withdrawn) => {
    const save = bashoSaveRef.current || makeDefaultSave();
    const career = save.career || makeDefaultSave().career;
    const { career: newCareer, movement, drip, earned, breakdown, tier } =
      applyRunResult(career, run);
    const newSave = {
      ...save,
      career: newCareer,
      bashoRun: { ...run, active: false },
    };
    bashoSaveRef.current = newSave;
    writeSave(newSave);
    isBashoMatchRef.current = false;
    setIsBashoMatch(false);
    setIsCPUMatch(false);
    setBashoPhase(null);
    setBashoArmed(false);
    setBashoRun(null);
    bashoRunRef.current = null;
    setBashoResult({
      run,
      movement,
      drip,
      earned,
      breakdown,
      tier,
      withdrawn: !!withdrawn,
    });
    setCurrentPage("bashoResults");
  };

  // Advance to the next bout WITHOUT remounting Game or creating a new room:
  // recolor the opponent, bump the bout token (re-shows the pre-match), and
  // raise the DAY card. The server has already reset the shared room and is
  // waiting for the next pre_match_complete.
  const goToNextDay = (run2) => {
    startDay(run2); // fills the next opponent's record in place
    bashoRunRef.current = run2;
    const opp = currentOpponent(run2);
    if (opp) {
      setPlayer2Color(opp.mawashiColor);
      setPlayer2BodyColor(opp.bodyColor || null);
    }
    boutResolvedRef.current = false;
    setBashoRun({ ...run2 });
    setBashoArmed(false);
    setBashoDraftOptions(rollDraftOptions(3));
    setBashoPhase("day");
    setBashoBoutToken((t) => t + 1);
    const save = { ...(bashoSaveRef.current || makeDefaultSave()), bashoRun: run2 };
    bashoSaveRef.current = save;
    writeSave(save);
    // The server held the bout-end pose and is awaiting our cue to reset the
    // shared room. Fire it on the next frame — after the (instantly opaque) DAY
    // card has painted — so the position reset happens fully behind the cover.
    const roomId = bashoRoomIdRef.current;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        socket.emit("basho_advance", { roomId });
      });
    });
  };

  // DEV (spec §9, bashoDebug flag): fast-forward the run so only the final day
  // remains to play — for testing the results/ceremony screen without grinding
  // a whole basho. Skipped days are auto-resolved with an ALTERNATING W/L split
  // so the final bout actually decides kachi-koshi vs make-koshi (lets us test
  // both outcomes). Never touches PvP/VS CPU; gated by the dev flag in DayCard.
  const skipToFinalDay = () => {
    let run = bashoRunRef.current;
    if (!run) return;
    let idx = 0;
    while (run.day < run.totalBouts) {
      const won = idx % 2 === 0;
      run = recordBout(run, won, won ? "slap" : "ringOut");
      idx += 1;
    }
    goToNextDay(run);
  };

  // Called after each bout's result is recorded: either set up the next day or
  // tear down the room and show results.
  const resolveBout = (run2) => {
    if (isRunComplete(run2)) {
      socket.emit("leave_room", { roomId: bashoRoomIdRef.current });
      finishBasho(run2, false);
    } else {
      goToNextDay(run2);
    }
  };
  resolveBoutRef.current = resolveBout;

  // DAY card "Begin Bout" → stack the drafted power-up into the run, persist,
  // and push the full stacked list to the server (applied to the BASHO human
  // only) BEFORE the bout's ritual. Then release the bout: the ritual + ready
  // walk run automatically, with no mid-match selection (§Phase 7 rework).
  const beginBashoBout = (pickedType) => {
    const run = bashoRunRef.current;
    if (run && pickedType) {
      const drafted = applyBashoDraftPick(run.draftedPowerUps || [], pickedType);
      const run2 = { ...run, draftedPowerUps: drafted };
      bashoRunRef.current = run2;
      setBashoRun({ ...run2 });
      const save = {
        ...(bashoSaveRef.current || makeDefaultSave()),
        bashoRun: run2,
      };
      bashoSaveRef.current = save;
      writeSave(save);
      socket.emit("basho_set_draft", {
        roomId: bashoRoomIdRef.current,
        draftedPowerUps: drafted,
      });
    }
    // Push the effective difficulty for THIS bout (division base + intra-basho
    // ramp) before the ritual, so the CPU brain is dialed correctly for the
    // upcoming fight. Computed client-side because the ramp depends on the
    // live record the client owns.
    if (run) {
      socket.emit("basho_set_difficulty", {
        roomId: bashoRoomIdRef.current,
        difficulty: boutDifficulty(run, Math.max(0, (run.day || 1) - 1)),
        // Phase 4.4: continuous ladder position drives an interpolated CPU
        // profile server-side; the discrete tier above stays as a fallback.
        ladderPosition: boutLadderPosition(run, Math.max(0, (run.day || 1) - 1)),
      });
    }
    setBashoDraftOptions(null);
    setBashoPhase("bout");
    setBashoArmed(true);
  };

  const withdrawBasho = () => {
    const run = bashoRunRef.current;
    if (!run) return;
    socket.emit("leave_room", { roomId: bashoRoomIdRef.current });
    finishBasho(run, true);
  };

  // Entry point called by BashoHub when starting OR resuming a run. Creates the
  // single basho room (handing the server the full opponent-color roster) and,
  // for a resume, the bout index to start from.
  const startBashoRun = ({ run, save }) => {
    bashoSaveRef.current = save || makeDefaultSave();
    const runWithRanks = ensureOpponentRanks(run);
    if (runWithRanks !== run) {
      bashoSaveRef.current = { ...bashoSaveRef.current, bashoRun: runWithRanks };
      writeSave(bashoSaveRef.current);
    }
    startDay(runWithRanks);
    bashoRunRef.current = runWithRanks;
    boutResolvedRef.current = false;
    setBashoRun({ ...runWithRanks });
    const opp = currentOpponent(runWithRanks);
    if (opp) {
      setPlayer2Color(opp.mawashiColor);
      setPlayer2BodyColor(opp.bodyColor || null);
    }
    const opponents = (runWithRanks.opponents || []).map((o) => ({
      mawashiColor: o.mawashiColor,
      bodyColor: o.bodyColor ?? null,
      difficulty: o.difficulty || "HARD",
      // Rival roster: AI personality archetype + (boss-only) combat edge. The
      // server applies stats/size/powerUps to the BASHO CPU per bout.
      archetype: o.archetype || "balanced",
      // Phase 4.3: the rival's division drives its CPU curriculum kit server-side
      // (narrow toolkits at low ranks). All rivals in a run share the run division.
      division: o.rank?.division || runWithRanks.division || null,
      boss: !!o.boss,
      stats: o.stats || null,
      size: o.size || null,
      powerUps: o.powerUps || [],
    }));
    // Effective attribute values (1..10) from the persistent career → the
    // server derives combat modifiers from these for the BASHO human ONLY.
    const spent = (bashoSaveRef.current?.career?.statPoints?.spent) || {};
    const stats = ATTRIBUTES.reduce((acc, a) => {
      acc[a.key] = STAT_BASE + (spent[a.key] || 0);
      return acc;
    }, {});
    // Persistent ability loadout (selected option ids per category) → the
    // server derives combat flags from these for the BASHO human ONLY. Filter
    // out any option the player doesn't actually own (e.g. a legacy save that
    // had a now-gated option toggled on) so the §6 unlock economy is the
    // authority on what applies.
    const career = bashoSaveRef.current?.career || {};
    const rawLoadout = career.loadout || {};
    const loadout = Object.fromEntries(
      Object.entries(rawLoadout).map(([cat, ids]) => [
        cat,
        (ids || []).filter((id) => {
          const opt = LOADOUT_OPTION_BY_ID[id];
          if (!opt) return false;
          return !opt.unlock || isUnlocked(career, opt.unlock);
        }),
      ]),
    );
    socket.emit("create_basho_match", {
      socketId: socket.id,
      player: {
        mawashiColor: player1ColorRef.current,
        bodyColor: player1BodyColorRef.current,
        stats,
        loadout,
        // Resume support: re-apply any picks already drafted this run.
        draftedPowerUps: normalizeBashoDraftList(run.draftedPowerUps || []),
      },
      opponents,
      totalBouts: run.totalBouts,
      startBout: Math.max(0, (run.day || 1) - 1), // resume support
      // Effective difficulty for the starting day — applies the §5.5 division
      // base + intra-basho ramp (depends on the live record, so it's computed
      // here, not baked into the static roster).
      difficulty: boutDifficulty(run, Math.max(0, (run.day || 1) - 1)),
      // Phase 4.4: continuous ladder position for the opening bout.
      ladderPosition: boutLadderPosition(run, Math.max(0, (run.day || 1) - 1)),
    });
  };

  // Apply saved active outfit to P1 context so VS CPU / Custom / BASHO
  // all start from the wardrobe loadout without visiting Customize first.
  useEffect(() => {
    let cancelled = false;
    loadSave().then((doc) => {
      if (cancelled) return;
      const outfit = getActiveOutfit(doc.customization);
      applyOutfitToPlayer1Setters(outfit, {
        setPlayer1Color,
        setPlayer1BodyColor,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [setPlayer1Color, setPlayer1BodyColor]);

  useEffect(() => {
    preGameImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    playBackgroundMusic();

    const handleCPUMatchCreated = (data) => {
      console.log("CPU match created:", data);
      setRoomName(data.roomId);
      setIsCPUMatch(true);
      setCurrentPage("lobby");
    };

    const handleCPUMatchFailed = (data) => {
      console.error("CPU match failed:", data.reason);
      alert("Failed to create CPU match: " + data.reason);
    };

    socket.on("cpu_match_created", handleCPUMatchCreated);
    socket.on("cpu_match_failed", handleCPUMatchFailed);

    return () => {
      stopBackgroundMusic();
      socket.off("cpu_match_created", handleCPUMatchCreated);
      socket.off("cpu_match_failed", handleCPUMatchFailed);
    };
  }, [socket, setCurrentPage]);

  // BASHO bout socket flow. Registered once; all dynamic state is read from
  // refs. Guarded by isBashoMatchRef so it never reacts to a PvP/VS CPU match.
  useEffect(() => {
    const handleBashoCreated = (data) => {
      bashoRoomIdRef.current = data.roomId;
      setRoomName(data.roomId);
      setIsCPUMatch(true); // reuse the CPU AI + auto-ready pipeline
      isBashoMatchRef.current = true;
      setIsBashoMatch(true);
      // Auto-ready the human; the server auto-readies the CPU opponent.
      socket.emit("ready_count", {
        playerId: socket.id,
        isReady: true,
        roomId: data.roomId,
      });
    };

    const handleBashoInitialStart = (payload) => {
      if (!isBashoMatchRef.current) return; // ignore non-BASHO matches
      const roomId = payload?.roomId || bashoRoomIdRef.current;
      const players = payload?.players;
      if (players?.[0]?.mawashiColor) setPlayer1Color(players[0].mawashiColor);
      setPlayer1BodyColor(players?.[0]?.bodyColor || null);
      if (players?.[1]?.mawashiColor) setPlayer2Color(players[1].mawashiColor);
      setPlayer2BodyColor(players?.[1]?.bodyColor || null);
      if (players && Array.isArray(players)) {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  players: r.players.map((rp, i) => ({
                    ...rp,
                    ...(players[i] || {}),
                    mawashiColor: players[i]?.mawashiColor ?? rp.mawashiColor,
                    bodyColor: players[i]?.bodyColor ?? rp.bodyColor,
                  })),
                }
              : r
          )
        );
      }
      socket.emit("game_reset", true);
      // First bout: raise DAY 1 card over the (now mounted) game and arm it on
      // Begin. Subsequent bouts are driven entirely by goToNextDay (no remount).
      setBashoArmed(false);
      setBashoBoutToken(0);
      setBashoDraftOptions(rollDraftOptions(3));
      setBashoPhase("day");
      setCurrentPage("game");
    };

    const handleBashoGameOver = (data) => {
      if (!isBashoMatchRef.current) return;
      if (boutResolvedRef.current) return;
      boutResolvedRef.current = true;
      const won = data?.winner?.id === localId;
      const winType = data?.winType || null;
      // Let the round-result kimarite banner play before transitioning.
      setTimeout(() => {
        const run2 = recordBout(bashoRunRef.current, won, winType);
        if (resolveBoutRef.current) resolveBoutRef.current(run2);
      }, 3300);
    };

    socket.on("basho_match_created", handleBashoCreated);
    socket.on("initial_game_start", handleBashoInitialStart);
    socket.on("game_over", handleBashoGameOver);

    return () => {
      socket.off("basho_match_created", handleBashoCreated);
      socket.off("initial_game_start", handleBashoInitialStart);
      socket.off("game_over", handleBashoGameOver);
    };
  }, [
    socket,
    localId,
    setCurrentPage,
    setRooms,
    setPlayer1Color,
    setPlayer2Color,
    setPlayer1BodyColor,
    setPlayer2BodyColor,
  ]);

  useEffect(() => {
    if (currentPage === "game") {
      stopBackgroundMusic();
    } else if (currentPage === "mainMenu") {
      playBackgroundMusic();
    }
  }, [currentPage]);

  const handleMainMenuPage = () => {
    setIsCPUMatch(false);
    setCurrentPage("mainMenu");
  };

  const handleDisplayRooms = () => {
    setCurrentPage("rooms");
  };

  const handleGame = () => {
    setCurrentPage("game");
  };

  const handleJoinRoom = () => {
    setIsCPUMatch(false);
    setCurrentPage("lobby");
  };

  const handleSettings = () => {
    setShowSettings((prev) => !prev);
  };

  const handleVsCPU = async () => {
    playButtonPressSound2();
    const save = await loadSave();
    const outfit = getActiveOutfit(save.customization);
    applyOutfitToPlayer1Setters(outfit, {
      setPlayer1Color,
      setPlayer1BodyColor,
    });
    socket.emit("create_cpu_match", {
      socketId: socket.id,
      mawashiColor: outfit.mawashiColor,
      bodyColor: outfit.bodyColor,
    });
  };

  const handleBasho = () => {
    playButtonPressSound2();
    setCurrentPage("basho");
  };

  const handleClickOutside = (e) => {
    if (
      showSettings &&
      !e.target.closest(".settings-container") &&
      !e.target.closest(".settings-button")
    ) {
      setShowSettings(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettings]);

  const renderMainMenu = () => {
    return (
      <MainMenuContainer>
        <BackgroundImage src={mainMenuBackground} alt="" />
        <CinematicOverlay />
        <GrainOverlay />
        <AtmosphereKanji aria-hidden>相撲</AtmosphereKanji>
        <Snowfall intensity={12} showFrost zIndex={3} />

        <TopSlug>
          <SlugText $accent>
            <strong>VER.</strong> HATSU
          </SlugText>
          <SlugRule aria-hidden />
          {connectionError ? (
            <SlugText $warn>Ring Closed</SlugText>
          ) : (
            <SlugText>Dohyo Open</SlugText>
          )}
        </TopSlug>

        {connectionError && (
          <ConnectionErrorBanner>
            CONNECTION LOST — RECONNECTING…
          </ConnectionErrorBanner>
        )}

        <HeroStage>
          <LeftColumn>
            <BrandBlock>
              <LogoImage src={pumoLogo} alt="Pumo Pumo!" />
              <BrandRule aria-hidden />
            </BrandBlock>

            <MenuList>
              <MenuButton
                $primary
                $index={0}
                onClick={handleBasho}
                onMouseEnter={playButtonHoverSound}
              >
                Basho
              </MenuButton>

              <MenuButton
                $index={1}
                onClick={() => {
                  handleDisplayRooms();
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                Custom Match
              </MenuButton>

              <MenuButton
                $index={2}
                onClick={handleVsCPU}
                onMouseEnter={playButtonHoverSound}
              >
                VS CPU
              </MenuButton>

              <MenuButton
                $index={3}
                onClick={() => {
                  playButtonPressSound2();
                  setCurrentPage("customize");
                }}
                onMouseEnter={playButtonHoverSound}
              >
                Customize
              </MenuButton>

              <SystemButton
                $index={4}
                className="settings-button"
                onClick={() => {
                  handleSettings();
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                Options
              </SystemButton>
            </MenuList>
          </LeftColumn>

          <RightColumn>
            <PumoHeroWrapper>
              <PumoHero src={pumoMainMenu} alt="Pumo" />
            </PumoHeroWrapper>
          </RightColumn>
        </HeroStage>

        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </MainMenuContainer>
    );
  };

  // Per-bout context handed to Game → PreMatchScreen during a BASHO run.
  const bashoOpp = isBashoMatch && bashoRun ? currentOpponent(bashoRun) : null;
  const bashoBout =
    isBashoMatch && bashoRun
      ? {
          day: bashoRun.day,
          totalBouts: bashoRun.totalBouts,
          opponentName: bashoOpp?.name,
          opponentRecord: bashoOpp?.record,
          playerRecord: bashoRun.record,
          // Real banzuke ranks (BASHO only) so the pre-match plaques show the
          // career rank instead of the legacy win-rate heuristic. The player
          // fights the whole basho at their entry rank; opponents are
          // division-mates, so they carry the division label.
          playerRankLabel: formatRank(bashoRun.startRank),
          // Raw rank for systems that key off division (e.g. crowd density).
          playerRank: bashoRun.startRank,
          opponentRankLabel: bashoOpp?.rank
            ? formatRank(bashoOpp.rank)
            : getDivision(bashoRun.startRank)?.label,
          draftedPowerUps: normalizeBashoDraftList(bashoRun.draftedPowerUps || []),
          opponentPowerUps: bashoOpp?.powerUps || [],
        }
      : null;

  switch (currentPage) {
    case "mainMenu":
      return <div className="current-page">{renderMainMenu()}</div>;
    case "rooms":
      return (
        <div className="current-page">
          <Rooms
            rooms={rooms}
            handleMainMenuPage={handleMainMenuPage}
            handleJoinRoom={handleJoinRoom}
            setRoomName={setRoomName}
          />
        </div>
      );
    case "lobby":
      return (
        <div className="current-page">
          <Lobby
            rooms={rooms}
            setRooms={setRooms}
            roomName={roomName}
            handleGame={handleGame}
            setCurrentPage={setCurrentPage}
            onLeaveDohyo={() => {
              setIsCPUMatch(false);
              setCurrentPage("mainMenu");
            }}
            isCPUMatch={isCPUMatch}
          />
        </div>
      );
    case "game":
      return (
        <div className="current-page">
          <Game
            localId={localId}
            rooms={rooms}
            roomName={roomName}
            setCurrentPage={setCurrentPage}
            isCPUMatch={isCPUMatch}
            isBashoMatch={isBashoMatch}
            bashoBout={bashoBout}
            bashoBoutToken={bashoBoutToken}
            bashoArmed={bashoArmed}
          />
          {isBashoMatch && bashoPhase === "day" && bashoRun && (
            <DayCard
              day={bashoRun.day}
              totalBouts={bashoRun.totalBouts}
              divisionLabel={getDivision({ division: bashoRun.division }).label}
              opponentName={bashoOpp?.name}
              opponentRankLabel={
                bashoOpp?.rank
                  ? formatRank(bashoOpp.rank)
                  : getDivision(bashoRun.startRank)?.label
              }
              opponentRecord={bashoOpp?.record}
              opponentArchetype={bashoOpp?.archetype}
              opponentIsBoss={bashoOpp?.boss}
              playerRecord={bashoRun.record}
              draftOptions={bashoDraftOptions}
              onBegin={beginBashoBout}
              onWithdraw={withdrawBasho}
              onSkipToFinalDay={skipToFinalDay}
            />
          )}
        </div>
      );
    case "customize":
      return (
        <div className="current-page">
          <CustomizePage
            onBack={() => {
              setIsCPUMatch(false);
              setCurrentPage("mainMenu");
            }}
          />
        </div>
      );
    case "basho":
      return (
        <div className="current-page">
          <BashoHub
            onBack={() => setCurrentPage("mainMenu")}
            onStartRun={startBashoRun}
          />
        </div>
      );
    case "bashoResults":
      return (
        <div className="current-page">
          {bashoResult && (
            <BashoResults
              run={bashoResult.run}
              movement={bashoResult.movement}
              drip={bashoResult.drip}
              earned={bashoResult.earned}
              breakdown={bashoResult.breakdown}
              tier={bashoResult.tier}
              withdrawn={bashoResult.withdrawn}
              onReturn={() => {
                setBashoResult(null);
                setCurrentPage("basho");
              }}
            />
          )}
        </div>
      );
    default:
      return <div className="current-page">{renderMainMenu()}</div>;
  }
};

MainMenu.propTypes = {
  rooms: PropTypes.array.isRequired,
  setRooms: PropTypes.func,
  currentPage: PropTypes.string.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  localId: PropTypes.string.isRequired,
  connectionError: PropTypes.bool,
};

export default MainMenu;
