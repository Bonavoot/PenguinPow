import { useState, useEffect, useLayoutEffect, useRef, useContext } from "react";
import PropTypes from "prop-types";

import Lobby from "./Lobby";
import Rooms from "./Rooms";
import Game from "./Game";
import Settings from "./Settings";
import CustomizePage from "./CustomizePage";
import HatTuner from "./HatTuner";
import BashoHub from "./BashoHub";
import DayCard from "./DayCard";
import BashoResults from "./BashoResults";
import { acquireCursor, releaseCursor } from "../ui/cursorGate";
import { usePlayerColors } from "../context/PlayerColorContext";
import { patchSave, makeDefaultSave, loadSave } from "../lib/saveStore";
import {
  getActiveOutfit,
  applyOutfitToPlayer1Setters,
} from "../lib/outfits";
import { getEquippedHeadGearId } from "../config/cosmetics";
import { buildIdlePortraitSrc } from "../utils/hatComposite";
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
  migrateLoadout,
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
import styled, { css, keyframes } from "styled-components";
import { SocketContext } from "../SocketContext";
import { selectGameServer } from "../lib/serverConnection";

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
 * Hero portrait for the main menu — player's active outfit on the
 * dedicated main-menu-pumo pose (recolored + head-gear when overlays exist).
 */
import mainMenuPumo from "../assets/main-menu-pumo.png";
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
import { useLowSpec } from "../utils/lowSpecMode";
import PumoLogo from "./PumoLogo";

import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_KANJI,
  FONT_UI,
  FONT_WEIGHT,
  TRACK,
  fadeIn,
  fadeUp,
  slideInLeft,
  broadcastSlideDown,
  FONT_RENDER,
  TEXT_SHADOW_DISPLAY,
  TEXT_SHADOW_DISPLAY_SOFT,
} from "./menuTheme";

// ============================================
// LOCAL ANIMATIONS
// ============================================

const kenBurns = keyframes`
  0%   { transform: scale(1.05) translate(0, 0); }
  100% { transform: scale(1.11) translate(-1%, -0.6%); }
`;

const grainDrift = keyframes`
  0%   { transform: translate(0, 0); }
  100% { transform: translate(-1.2%, 0.8%); }
`;

/* Same idle breathe as Lobby / BashoHub portraits — scale from the feet. */
const pumoBreathe = keyframes`
  0%, 100% { transform: scaleY(1); }
  50%      { transform: scaleY(1.022); }
`;

const brushIn = keyframes`
  from { transform: scaleX(0); opacity: 0; }
  to   { transform: scaleX(1); opacity: 1; }
`;

const hintFade = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
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

/*
 * Scene plate: sharp courtyard + hero pocket; soft only at far edges
 * so the render feels cinematic without fogging the ground under Pumo.
 */
const BackgroundPlate = styled.div`
  position: absolute;
  inset: -3%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  /* Low Spec: freeze Ken Burns — animating a filtered plate forces re-blur. */
  ${(p) =>
    p.$lowSpec
      ? css`
          animation: none;
          will-change: auto;
        `
      : css`
          animation: ${kenBurns} 40s ease-in-out infinite alternate;
          will-change: transform;
        `}
`;

const BackgroundImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 52%;
  /*
   * Light global soften — the main "AI coverup": kills hyper-sharp
   * gen artifacts without turning the plate into mud.
   * Low Spec: same grade, no live blur.
   */
  filter: ${(p) =>
    p.$lowSpec
      ? "saturate(1.06) brightness(0.88) contrast(1.06)"
      : "saturate(1.06) brightness(0.88) contrast(1.06) blur(0.7px)"};
`;

/*
 * Stronger edge DOF — soft periphery sells depth + hides gen edges;
 * courtyard / hero pocket stay clearer than the rim.
 */
const BackgroundDepth = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 52%;
  filter: blur(14px) saturate(1.04) brightness(0.86);
  transform: scale(1.06);
  opacity: 0.88;
  -webkit-mask-image: radial-gradient(
    ellipse 70% 64% at 54% 46%,
    transparent 0%,
    transparent 34%,
    rgba(0, 0, 0, 0.45) 60%,
    #000 86%
  );
  mask-image: radial-gradient(
    ellipse 70% 64% at 54% 46%,
    transparent 0%,
    transparent 34%,
    rgba(0, 0, 0, 0.45) 60%,
    #000 86%
  );
`;

/* Festival grade — authored film look over the raw plate. */
const AtmosphereGrade = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  mix-blend-mode: soft-light;
  opacity: 0.8;
  background:
    radial-gradient(
      ellipse 70% 42% at 52% 14%,
      rgba(255, 196, 120, 0.5) 0%,
      transparent 60%
    ),
    radial-gradient(
      ellipse 45% 40% at 70% 68%,
      rgba(255, 236, 200, 0.16) 0%,
      transparent 65%
    ),
    linear-gradient(
      160deg,
      rgba(255, 220, 170, 0.22) 0%,
      transparent 36%,
      rgba(30, 48, 80, 0.22) 100%
    );
`;

/* Sky atmosphere only — no courtyard milk. */
const AtmosphereHaze = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(160, 190, 220, 0.16) 0%,
    rgba(160, 190, 220, 0.05) 16%,
    transparent 34%
  );
`;

/*
 * Poster frame — soft letterbox + light left seat for type.
 * Courtyard stays open; no panel wash.
 */
const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      rgba(4, 6, 10, 0.55) 0%,
      rgba(4, 6, 10, 0.28) 16%,
      rgba(4, 6, 10, 0.08) 32%,
      transparent 48%
    ),
    radial-gradient(
      ellipse 50% 55% at 78% 62%,
      rgba(255, 248, 235, 0.05) 0%,
      transparent 58%
    ),
    radial-gradient(
      ellipse 72% 68% at 52% 42%,
      transparent 0%,
      rgba(4, 6, 10, 0.12) 60%,
      rgba(4, 6, 10, 0.48) 100%
    ),
    linear-gradient(
      180deg,
      rgba(4, 6, 10, 0.45) 0%,
      transparent 20%,
      transparent 76%,
      rgba(4, 6, 10, 0.38) 100%
    );
`;

/* Giant ink watermark — depth behind the title stack (Startup kin). */
const AtmosphereKanji = styled.div`
  position: absolute;
  top: 46%;
  left: clamp(12px, 2cqw, 40px);
  transform: translateY(-50%);
  z-index: 2;
  font-family: ${FONT_KANJI};
  font-weight: 700;
  font-size: clamp(9rem, 28cqh, 18rem);
  line-height: 1;
  letter-spacing: 0.06em;
  color: #fff;
  opacity: 0.045;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
`;

/* Film grain — the other half of the coverup. */
const GrainOverlay = styled.div`
  position: absolute;
  inset: -8%;
  z-index: 2;
  pointer-events: none;
  opacity: 0.14;
  mix-blend-mode: overlay;
  animation: ${grainDrift} 10s linear infinite;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(60, 40, 20, 0.08) 0,
      transparent 1px,
      transparent 2px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(60, 40, 20, 0.06) 0,
      transparent 1px,
      transparent 3px
    ),
    radial-gradient(
      circle at 40% 35%,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 45%
    );
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
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.48rem, 0.78cqw, 0.62rem);
  color: ${(p) =>
    p.$warn ? C.vermillionBright : p.$accent ? C.ice : C.creamMute};
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  ${FONT_RENDER}
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
  display: flex;
  align-items: center;
  padding: clamp(56px, 9cqh, 88px) clamp(40px, 5.5cqw, 80px)
    clamp(48px, 7cqh, 72px);
`;

/*
 * Title stack — festival program over the courtyard.
 * Negative space is deliberate; density comes from hierarchy,
 * whisper meta, and ink — not boxes.
 */
const LeftColumn = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: clamp(28px, 4.2cqh, 44px);
  min-width: 0;
  max-width: clamp(300px, 34cqw, 400px);
  will-change: transform, opacity;
  animation: ${slideInLeft} 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) 0.12s both;
`;

const BrandBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  /* Logo sits a touch left of the mode column — optical lockup. */
  margin-left: clamp(-18px, -1.6cqw, -10px);
`;

const MenuList = styled.nav`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: clamp(12px, 1.8cqh, 18px);
`;

/*
 * Mode rows — open type with a calligraphy brush focus.
 * Featured mode carries a whisper line; hover draws the same
 * brush under siblings. No plates, ticks, or glow bars.
 */
const MenuButton = styled.button`
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.28em;
  background: none;
  border: none;
  padding: 0 0 0.42em;
  margin: 0;
  cursor: pointer;
  text-align: left;
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.4 + p.$index * 0.07}s;

  .mode-label {
    font-family: ${FONT_DISPLAY};
    font-size: ${(p) =>
      p.$primary
        ? "clamp(1.65rem, 2.75cqw, 2.25rem)"
        : "clamp(1.05rem, 1.65cqw, 1.35rem)"};
    font-weight: 400;
    letter-spacing: ${TRACK.display};
    text-transform: uppercase;
    line-height: 0.95;
    color: ${(p) =>
      p.$primary ? C.cream : "rgba(245, 236, 217, 0.7)"};
    ${FONT_RENDER}
    text-shadow: ${(p) =>
      p.$primary ? TEXT_SHADOW_DISPLAY : TEXT_SHADOW_DISPLAY_SOFT};
    transition: color 0.22s ease;
  }

  .mode-hint {
    font-family: ${FONT_UI};
    font-weight: ${FONT_WEIGHT.medium};
    font-size: clamp(0.5rem, 0.78cqw, 0.62rem);
    letter-spacing: ${TRACK.label};
    text-transform: uppercase;
    color: ${C.iceBright};
    ${FONT_RENDER}
    text-shadow: ${TEXT_SHADOW_DISPLAY_SOFT};
    animation: ${hintFade} 0.4s ease-out 0.7s both;
  }

  &::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: 0;
    height: 2px;
    width: 100%;
    max-width: ${(p) => (p.$primary ? "4.5em" : "0")};
    background: linear-gradient(
      90deg,
      ${C.vermillionBright} 0%,
      ${C.vermillion} 55%,
      transparent 100%
    );
    transform-origin: left center;
    opacity: ${(p) => (p.$primary ? 1 : 0)};
    transition:
      max-width 0.32s cubic-bezier(0.25, 0.85, 0.2, 1),
      opacity 0.22s ease,
      background 0.22s ease;
    pointer-events: none;
    ${(p) =>
      p.$primary &&
      css`
        animation: ${brushIn} 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) 0.75s both;
      `}
  }

  &:hover .mode-label {
    color: ${C.cream};
  }
  &:hover::after {
    max-width: 4.5em;
    opacity: 1;
    background: linear-gradient(
      90deg,
      ${(p) => (p.$primary ? C.vermillionBright : C.iceBright)} 0%,
      ${(p) => (p.$primary ? C.vermillion : C.ice)} 55%,
      transparent 100%
    );
  }
  &:active .mode-label {
    opacity: 0.88;
  }
`;

const SystemButton = styled.button`
  display: inline-flex;
  align-items: center;
  margin-top: clamp(6px, 1.2cqh, 12px);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.medium};
  font-size: clamp(0.68rem, 1.05cqw, 0.84rem);
  letter-spacing: ${TRACK.label};
  text-transform: uppercase;
  text-align: left;
  line-height: 1;
  color: rgba(245, 236, 217, 0.4);
  ${FONT_RENDER}
  text-shadow: ${TEXT_SHADOW_DISPLAY_SOFT};
  transition: color 0.2s ease;
  opacity: 0;
  animation: ${slideInLeft} 0.45s ease-out forwards;
  animation-delay: ${(p) => 0.4 + p.$index * 0.07}s;

  &:hover {
    color: rgba(245, 236, 217, 0.88);
  }
`;

/*
 * Key-art poster — right third, intentional foot crop,
 * planted on the snow line. Classic fighting-game title sit.
 */
const PumoHeroWrapper = styled.div`
  position: absolute;
  right: clamp(-8px, 0.5cqw, 20px);
  bottom: clamp(-96px, -12cqh, -52px);
  height: clamp(460px, 90cqh, 720px);
  width: auto;
  z-index: 4;
  pointer-events: none;
  user-select: none;
  animation: ${fadeUp} 0.85s ease-out 0.18s backwards;

  &::after {
    content: "";
    position: absolute;
    left: 18%;
    right: 20%;
    bottom: 11%;
    height: 9%;
    background: radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0.45) 0%,
      rgba(0, 0, 0, 0.14) 48%,
      transparent 72%
    );
    filter: blur(12px);
    z-index: 0;
    pointer-events: none;
  }

  @media (max-width: 720px) {
    display: none;
  }
`;

const PumoHero = styled.img`
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  width: auto;
  transform-origin: center bottom;
  filter: brightness(0.98) contrast(1.02) saturate(1.04)
    drop-shadow(0 16px 28px rgba(0, 0, 0, 0.4));
  animation: ${pumoBreathe} 2.6s ease-in-out infinite;
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
  font-family: ${FONT_UI};
  font-weight: ${FONT_WEIGHT.bold};
  font-size: clamp(0.55rem, 0.9cqw, 0.72rem);
  color: ${C.cream};
  letter-spacing: ${TRACK.label};
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
  const lowSpec = useLowSpec();

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

  // Cursor: menus always; on the game page only DayCard (power select / rematch
  // are acquired inside Game / GameFighter when those UIs are actually up).
  useLayoutEffect(() => {
    if (currentPage !== "game") acquireCursor("menu");
    else releaseCursor("menu");
    return () => releaseCursor("menu");
  }, [currentPage]);

  useLayoutEffect(() => {
    if (currentPage === "game" && bashoPhase === "day") acquireCursor("daycard");
    else releaseCursor("daycard");
    return () => releaseCursor("daycard");
  }, [currentPage, bashoPhase]);
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
    patchSave({ career: newCareer, bashoRun: { ...run, active: false } });
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
    patchSave({ bashoRun: run2 }).then((doc) => {
      bashoSaveRef.current = doc;
    });
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
      patchSave({ bashoRun: run2 }).then((doc) => {
        bashoSaveRef.current = doc;
      });
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
  const startBashoRun = async ({ run, save }) => {
    // Prefer disk for cosmetics (Customize flushes on leave); keep career/run
    // from the hub payload so a mid-edit loadout still applies.
    // patchSave merges onto latest disk so a late Customize flush can't wipe
    // the new bashoRun (and a full writeSave can't wipe a newer outfit).
    const runWithRanks = ensureOpponentRanks(run);
    startDay(runWithRanks);
    const career = save?.career;
    const written = await patchSave({
      ...(career ? { career } : {}),
      bashoRun: runWithRanks,
    });
    bashoSaveRef.current = written;
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
    const careerSave = bashoSaveRef.current?.career || {};
    const rawLoadout = migrateLoadout(careerSave.loadout || {});
    const loadout = Object.fromEntries(
      Object.entries(rawLoadout).map(([cat, ids]) => [
        cat,
        (ids || []).filter((id) => {
          const opt = LOADOUT_OPTION_BY_ID[id];
          if (!opt) return false;
          return !opt.unlock || isUnlocked(careerSave, opt.unlock);
        }),
      ]),
    );
    // Same source as VS CPU: active outfit from the save, not a mix of live
    // color refs + stale gearIds.
    const bashoOutfit = getActiveOutfit(bashoSaveRef.current?.customization);
    applyOutfitToPlayer1Setters(bashoOutfit, {
      setPlayer1Color,
      setPlayer1BodyColor,
    });
    // Solo mode: route the game socket to the locally-spawned server so the
    // whole run plays at localhost latency (falls back to remote if the local
    // server isn't available). Must resolve BEFORE the emit so the room is
    // created on the right server.
    await selectGameServer("local");
    socket.emit("create_basho_match", {
      socketId: socket.id,
      player: {
        mawashiColor: bashoOutfit.mawashiColor,
        bodyColor: bashoOutfit.bodyColor,
        gearIds: Array.isArray(bashoOutfit?.gearIds) ? bashoOutfit.gearIds : [],
        stats,
        loadout,
        // Resume support: re-apply any picks already drafted this run.
        draftedPowerUps: normalizeBashoDraftList(runWithRanks.draftedPowerUps || []),
      },
      opponents,
      totalBouts: runWithRanks.totalBouts,
      startBout: Math.max(0, (runWithRanks.day || 1) - 1), // resume support
      // Effective difficulty for the starting day — applies the §5.5 division
      // base + intra-basho ramp (depends on the live record, so it's computed
      // here, not baked into the static roster).
      difficulty: boutDifficulty(
        runWithRanks,
        Math.max(0, (runWithRanks.day || 1) - 1),
      ),
      // Phase 4.4: continuous ladder position for the opening bout.
      ladderPosition: boutLadderPosition(
        runWithRanks,
        Math.max(0, (runWithRanks.day || 1) - 1),
      ),
    });
  };

  // Active outfit gear for the main-menu hero (colors live in PlayerColorContext).
  const heroGearIdsRef = useRef([]);
  const [heroHeadGearId, setHeroHeadGearId] = useState(null);
  const [heroSrc, setHeroSrc] = useState(mainMenuPumo);
  const heroMountedRef = useRef(true);

  // Apply saved active outfit to P1 context so VS CPU / Custom / BASHO
  // all start from the wardrobe loadout without visiting Customize first.
  // Re-run when returning to the main menu so Customize edits show up.
  useEffect(() => {
    if (currentPage !== "mainMenu") return;
    let cancelled = false;
    loadSave().then((doc) => {
      if (cancelled) return;
      const outfit = getActiveOutfit(doc.customization);
      applyOutfitToPlayer1Setters(outfit, {
        setPlayer1Color,
        setPlayer1BodyColor,
      });
      const gearIds = Array.isArray(outfit?.gearIds) ? outfit.gearIds : [];
      heroGearIdsRef.current = gearIds;
      setHeroHeadGearId(getEquippedHeadGearId(gearIds));
    });
    return () => {
      cancelled = true;
    };
  }, [currentPage, setPlayer1Color, setPlayer1BodyColor]);

  useEffect(() => {
    heroMountedRef.current = true;
    return () => {
      heroMountedRef.current = false;
    };
  }, []);

  // Build the hero from the player's outfit on the main-menu pose.
  useEffect(() => {
    let cancelled = false;
    buildIdlePortraitSrc({
      baseSrc: mainMenuPumo,
      mawashiColor: player1Color,
      bodyColor: player1BodyColor,
      gearIds: heroGearIdsRef.current,
      // Large hero makes body-recolor AA leaks obvious — restore ink after.
      preserveLinework: true,
    })
      .then((src) => {
        if (!cancelled && heroMountedRef.current) setHeroSrc(src);
      })
      .catch(() => {
        if (!cancelled && heroMountedRef.current) {
          setHeroSrc(mainMenuPumo);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [player1Color, player1BodyColor, heroHeadGearId]);

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
    const upsertBashoRoom = (roomId, players) => {
      if (!roomId || !Array.isArray(players)) return;
      const nextPlayers = players.map((p) => ({
        id: p.id,
        fighter: p.fighter,
        mawashiColor: p.mawashiColor,
        bodyColor: p.bodyColor ?? null,
        gearIds: Array.isArray(p.gearIds) ? p.gearIds : [],
        isCPU: !!p.isCPU,
        wins: p.wins || [],
        isReady: !!p.isReady,
      }));
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.id === roomId);
        if (idx === -1) {
          return [
            ...prev,
            {
              id: roomId,
              isCPURoom: true,
              readyCount: 0,
              players: nextPlayers,
            },
          ];
        }
        return prev.map((r, i) => {
          if (i !== idx) return r;
          const basePlayers =
            Array.isArray(r.players) && r.players.length > 0
              ? r.players
              : nextPlayers;
          return {
            ...r,
            players: nextPlayers.map((np, pi) => ({
              ...(basePlayers[pi] || {}),
              ...np,
              mawashiColor: np.mawashiColor ?? basePlayers[pi]?.mawashiColor,
              bodyColor: np.bodyColor ?? basePlayers[pi]?.bodyColor ?? null,
              gearIds: np.gearIds ?? basePlayers[pi]?.gearIds ?? [],
            })),
          };
        });
      });
    };

    const handleBashoCreated = (data) => {
      bashoRoomIdRef.current = data.roomId;
      setRoomName(data.roomId);
      setIsCPUMatch(true); // reuse the CPU AI + auto-ready pipeline
      isBashoMatchRef.current = true;
      setIsBashoMatch(true);
      // Seed client rooms immediately — don't wait on the broadcast race.
      upsertBashoRoom(data.roomId, data.players);
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
      upsertBashoRoom(roomId, players);
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
    // Solo mode: route the game socket to the locally-spawned server
    // (falls back to remote if the local server isn't available).
    await selectGameServer("local");
    socket.emit("create_cpu_match", {
      socketId: socket.id,
      mawashiColor: outfit.mawashiColor,
      bodyColor: outfit.bodyColor,
      gearIds: Array.isArray(outfit.gearIds) ? outfit.gearIds : [],
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
        <BackgroundPlate aria-hidden $lowSpec={lowSpec}>
          <BackgroundImage src={mainMenuBackground} alt="" $lowSpec={lowSpec} />
          {!lowSpec && (
            <BackgroundDepth src={mainMenuBackground} alt="" />
          )}
        </BackgroundPlate>
        {!lowSpec && <AtmosphereGrade aria-hidden />}
        <AtmosphereHaze aria-hidden />
        <CinematicOverlay />
        <AtmosphereKanji aria-hidden>相撲</AtmosphereKanji>
        {!lowSpec && <GrainOverlay aria-hidden />}
        {!lowSpec && <Snowfall intensity={13} showFrost zIndex={3} />}

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
              <PumoLogo size="menu" />
            </BrandBlock>

            <MenuList>
              <MenuButton
                $primary
                $index={0}
                onClick={handleBasho}
                onMouseEnter={playButtonHoverSound}
              >
                <span className="mode-label">Basho</span>
                <span className="mode-hint">Sumo career mode</span>
              </MenuButton>

              <MenuButton
                $index={1}
                onClick={() => {
                  handleDisplayRooms();
                  playButtonPressSound2();
                }}
                onMouseEnter={playButtonHoverSound}
              >
                <span className="mode-label">Custom Match</span>
              </MenuButton>

              <MenuButton
                $index={2}
                onClick={handleVsCPU}
                onMouseEnter={playButtonHoverSound}
              >
                <span className="mode-label">VS CPU</span>
              </MenuButton>

              <MenuButton
                $index={3}
                onClick={() => {
                  playButtonPressSound2();
                  setCurrentPage("customize");
                }}
                onMouseEnter={playButtonHoverSound}
              >
                <span className="mode-label">Customize</span>
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
        </HeroStage>

        <PumoHeroWrapper>
          <PumoHero src={heroSrc} alt="Your wrestler" />
        </PumoHeroWrapper>

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
            onOpenHatTuner={() => setCurrentPage("hatTuner")}
          />
        </div>
      );
    case "hatTuner":
      return (
        <div className="current-page">
          <HatTuner onBack={() => setCurrentPage("customize")} />
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
