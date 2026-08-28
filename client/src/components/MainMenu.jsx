import { useState, useEffect, useLayoutEffect, useRef, useContext, useCallback } from "react";
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
import { buildIdlePortraitSrc } from "../utils/hatComposite";
import { protectBlobUrl, unprotectBlobUrl } from "../utils/SpriteRecolorizer";
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
import { SPRITE_BASE_COLOR } from "../config/colorPresets";

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
import pumo from "../assets/pumo-idle.png";
/*
 * Hero portrait — dedicated main-menu pose, recolored + head-gear
 * from the active outfit.
 */
import mainMenuPumo from "../assets/main-menu-pumo.png";
/*
 * Title plate is the live match stage (sky + floor plate), not the
 * older zoomed-out look-test.
 */
import titleSky from "../assets/map-antarctica-sky.webp";
import titleWorld from "../assets/game-map-floor.png";
import {
  playButtonHoverSound,
  playButtonPressSound2,
  setMusic,
  cueForPage,
  resultsCue,
  silenceResultStingers,
} from "../utils/soundUtils";
import Snowfall from "./Snowfall";
import { useLowSpec } from "../utils/lowSpecMode";
import PumoLogo from "./PumoLogo";

import {
  C,
  FONT_BODY,
  FONT_UI,
  FONT_WEIGHT,
  TRACK,
  fadeIn,
  fadeUp,
  slideInLeft,
  FONT_RENDER,
} from "./menuTheme";

// ============================================
// LOCAL ANIMATIONS
// ============================================

const kenBurns = keyframes`
  0%   { transform: scale(1.02) translate(0, 0); }
  100% { transform: scale(1.06) translate(-1.2%, -0.4%); }
`;

/* Same idle breathe as Lobby / BashoHub portraits — scale from the feet. */
const pumoBreathe = keyframes`
  0%, 100% { transform: scaleY(1); }
  50%      { transform: scaleY(1.022); }
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
  background: #10161f;
  container-type: size;
  font-family: ${FONT_BODY};
`;

/*
 * Title plate: real stage, not a second illustration.
 * Sky fills the hole in the ice shelf. Ken Burns is a slow poster drift.
 */
const BackgroundPlate = styled.div`
  position: absolute;
  inset: -4%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  ${(p) =>
    p.$lowSpec
      ? css`
          animation: none;
          will-change: auto;
        `
      : css`
          animation: ${kenBurns} 48s ease-in-out infinite alternate;
          will-change: transform;
        `}
`;

const SkyImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 22%;
  filter: saturate(0.98) brightness(0.82) contrast(1.08);
`;

const WorldImage = styled.img`
  position: absolute;
  /* Ice is the ground the wrestler stands on. Sky still has room above
   * the mountains — not the old snow-field crop, not a sliver at the lip. */
  left: -14%;
  top: -2%;
  width: 128%;
  height: 128%;
  object-fit: fill;
  filter: saturate(0.96) brightness(0.9) contrast(1.05);
`;

/*
 * Poster frame only: left air for type, letterbox, cool rim.
 * No panel, no plaque, no gold wash.
 */
const CinematicOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      rgba(6, 10, 18, 0.78) 0%,
      rgba(6, 10, 18, 0.42) 16%,
      rgba(6, 10, 18, 0.12) 30%,
      transparent 46%
    ),
    linear-gradient(
      180deg,
      rgba(6, 10, 18, 0.18) 0%,
      transparent 18%,
      transparent 92%,
      rgba(6, 10, 18, 0.12) 100%
    ),
    radial-gradient(
      ellipse 64% 58% at 80% 42%,
      transparent 0%,
      rgba(6, 10, 18, 0.12) 70%,
      rgba(6, 10, 18, 0.32) 100%
    );
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
  align-items: flex-start;
  padding: clamp(52px, 8cqh, 72px) clamp(40px, 5.5cqw, 80px)
    clamp(32px, 5cqh, 48px);
`;

/*
 * Title stack — brand mark, then a type list in open air.
 * The stage is the poster; the menu is ink on it, not a panel.
 */
const LeftColumn = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: clamp(28px, 4.2cqh, 40px);
  min-width: 0;
  max-width: clamp(280px, 36cqw, 420px);
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
  gap: clamp(18px, 2.8cqh, 28px);
`;

/*
 * Open type. Selection is vermillion + a left rule — never a box.
 * Featured items are larger. Quiet items are chrome (Back / Options).
 */
const MenuButton = styled.button`
  position: relative;
  display: block;
  margin: 0;
  padding: 0 0 0 0.9em;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  animation: ${slideInLeft} 0.4s ease-out backwards;
  animation-delay: ${(p) => 0.28 + p.$index * 0.06}s;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 3px;
    height: 0.72em;
    border-radius: 1px;
    background: ${C.vermillionBright};
    transform: translateY(-50%) scaleY(${(p) => (p.$active ? 1 : 0.35)});
    opacity: ${(p) => (p.$active ? 1 : 0)};
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }

  .mode-label {
    display: flex;
    align-items: baseline;
    gap: 0.55em;
    font-family: ${FONT_UI};
    font-size: ${(p) =>
      p.$quiet
        ? "clamp(0.88rem, 1.32cqw, 1.06rem)"
        : p.$featured
          ? "clamp(1.9rem, 3.2cqw, 2.55rem)"
          : "clamp(1.18rem, 1.95cqw, 1.48rem)"};
    font-weight: ${(p) =>
      p.$quiet
        ? FONT_WEIGHT.medium
        : p.$featured
          ? FONT_WEIGHT.bold
          : FONT_WEIGHT.semibold};
    letter-spacing: ${(p) =>
      p.$quiet ? "0.16em" : p.$featured ? "0.04em" : "0.06em"};
    text-transform: uppercase;
    line-height: 1;
    color: ${(p) =>
      p.$active
        ? C.vermillionBright
        : p.$quiet
          ? "rgba(245, 236, 217, 0.62)"
          : "rgba(255, 255, 255, 0.9)"};
    ${FONT_RENDER}
    text-shadow:
      0 0 18px rgba(0, 0, 0, 0.55),
      0 2px 8px rgba(0, 0, 0, 0.8),
      0 1px 2px rgba(0, 0, 0, 0.9);
    transform-origin: left center;
    transform: translateX(${(p) => (p.$active ? "4px" : "0")});
    transition:
      color 0.16s ease,
      transform 0.16s cubic-bezier(0.25, 0.85, 0.2, 1);
  }

  .mode-soon {
    font-size: 0.42em;
    font-weight: ${FONT_WEIGHT.medium};
    letter-spacing: 0.18em;
    color: rgba(245, 236, 217, 0.7);
    animation: ${fadeIn} 0.2s ease-out;
  }

  &:hover .mode-label,
  &:focus-visible .mode-label {
    color: ${(p) => (p.$quiet ? "rgba(245, 236, 217, 0.88)" : "#ff6d5c")};
    transform: translateX(4px);
  }

  &:active .mode-label {
    transform: translateX(2px);
    opacity: 0.88;
  }

  &:focus {
    outline: none;
  }
`;
/*
 * Key-art sit: large on the right, feet on the ice, head in the sky.
 */
const PumoHeroWrapper = styled.div`
  position: absolute;
  right: clamp(8px, 1.8cqw, 28px);
  bottom: clamp(12px, 2.8cqh, 24px);
  height: clamp(440px, 80cqh, 620px);
  width: auto;
  z-index: 4;
  overflow: visible;
  pointer-events: none;
  user-select: none;
  animation: ${fadeUp} 0.85s ease-out 0.18s backwards;

  @media (max-width: 720px) {
    display: none;
  }
`;

/* Sized to the opaque penguin (~63% of the 960 pad), not the square
 * canvas. Same slate as the Basho portrait oval. */
const HeroFloorShadow = styled.div`
  position: absolute;
  left: 49.5%;
  bottom: 1%;
  transform: translate(-50%, 16%);
  width: 58%;
  height: 8.5%;
  min-height: 32px;
  max-height: 48px;
  border-radius: 50%;
  background: radial-gradient(
    ellipse 100% 100% at 50% 50%,
    rgba(6, 12, 24, 0.38) 0%,
    rgba(8, 16, 30, 0.2) 48%,
    rgba(10, 20, 36, 0.07) 74%,
    transparent 100%
  );
  z-index: 0;
  pointer-events: none;
`;

const PumoHero = styled.img`
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  width: auto;
  transform-origin: center bottom;
  filter: brightness(0.98) contrast(1.04) saturate(1.02)
    drop-shadow(0 8px 16px rgba(4, 10, 22, 0.22));
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

// ============================================
// MENU GRAPH
// ============================================

const ROOT_ITEMS = [
  { id: "play", label: "Play", featured: true, action: "openPlay" },
  { id: "shop", label: "Shop", action: "shop" },
  { id: "customize", label: "Customize", action: "customize" },
  { id: "options", label: "Options", quiet: true, action: "options" },
];

const PLAY_ITEMS = [
  { id: "basho", label: "Basho", featured: true, action: "basho" },
  { id: "online", label: "Online", action: "online" },
  { id: "cpu", label: "VS CPU", action: "cpu" },
  { id: "training", label: "Training", action: "training" },
  { id: "back", label: "Back", quiet: true, action: "back" },
];

const preGameImages = [titleSky, titleWorld, pumo];

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
  const [menuLayer, setMenuLayer] = useState("root");
  const [activeId, setActiveId] = useState("play");
  const [shopSoon, setShopSoon] = useState(false);
  const shopSoonTimerRef = useRef(null);
  const [isCPUMatch, setIsCPUMatch] = useState(false);
  const [isTrainingMatch, setIsTrainingMatch] = useState(false);
  const { socket } = useContext(SocketContext);
  const lowSpec = useLowSpec();

  useEffect(() => {
    return () => {
      if (shopSoonTimerRef.current) clearTimeout(shopSoonTimerRef.current);
    };
  }, []);

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
    silenceResultStingers();
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

  // Title hero is a recolored blob. Game teardown revokes combat blobs;
  // we protect the live hero URL and rebuild from the saved outfit whenever
  // we land on the menu. Don't snap back to the default PNG on the way out —
  // that race is what left Customize returns showing stock Pumo.
  const [heroSrc, setHeroSrc] = useState(mainMenuPumo);
  const heroSrcRef = useRef(mainMenuPumo);
  const heroMountedRef = useRef(true);

  const commitHeroSrc = useCallback((src) => {
    const prev = heroSrcRef.current;
    if (prev && prev !== src) unprotectBlobUrl(prev);
    protectBlobUrl(src);
    heroSrcRef.current = src;
    setHeroSrc(src);
  }, []);

  useEffect(() => {
    heroMountedRef.current = true;
    return () => {
      heroMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (currentPage !== "mainMenu") return undefined;
    let cancelled = false;
    loadSave()
      .then(async (doc) => {
        if (cancelled) return;
        const outfit = getActiveOutfit(doc.customization);
        applyOutfitToPlayer1Setters(outfit, {
          setPlayer1Color,
          setPlayer1BodyColor,
        });
        const gearIds = Array.isArray(outfit?.gearIds) ? outfit.gearIds : [];
        const src = await buildIdlePortraitSrc({
          baseSrc: mainMenuPumo,
          mawashiColor: outfit?.mawashiColor || SPRITE_BASE_COLOR,
          bodyColor: outfit?.bodyColor ?? null,
          gearIds,
          preserveLinework: true,
        });
        if (!cancelled && heroMountedRef.current) commitHeroSrc(src);
      })
      .catch(() => {
        if (!cancelled && heroMountedRef.current) commitHeroSrc(mainMenuPumo);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, setPlayer1Color, setPlayer1BodyColor, commitHeroSrc]);

  useEffect(() => {
    preGameImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

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

    const upsertTrainingRoom = (roomId, players) => {
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
              matchMode: "training",
              readyCount: 2,
              players: nextPlayers,
            },
          ];
        }
        return prev.map((r, i) =>
          i === idx ? { ...r, players: nextPlayers } : r
        );
      });
    };

    const handleTrainingMatchCreated = (data) => {
      setRoomName(data.roomId);
      setIsCPUMatch(true);
      setIsTrainingMatch(true);
      setPlayer2Color(SPRITE_BASE_COLOR);
      setPlayer2BodyColor(null);
      upsertTrainingRoom(data.roomId, data.players);
      setCurrentPage("game");
    };

    const handleTrainingMatchFailed = (data) => {
      console.error("Training match failed:", data?.reason);
      alert("Failed to start training: " + (data?.reason || "unknown"));
    };

    socket.on("cpu_match_created", handleCPUMatchCreated);
    socket.on("cpu_match_failed", handleCPUMatchFailed);
    socket.on("training_match_created", handleTrainingMatchCreated);
    socket.on("training_match_failed", handleTrainingMatchFailed);

    return () => {
      socket.off("cpu_match_created", handleCPUMatchCreated);
      socket.off("cpu_match_failed", handleCPUMatchFailed);
      socket.off("training_match_created", handleTrainingMatchCreated);
      socket.off("training_match_failed", handleTrainingMatchFailed);
    };
  }, [socket, setCurrentPage, setRooms, setPlayer2Color, setPlayer2BodyColor]);

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
    if (currentPage === "bashoResults") {
      const won = !!(
        bashoResult &&
        !bashoResult.withdrawn &&
        bashoResult.movement?.kachiKoshi
      );
      setMusic(resultsCue(won));
      return;
    }
    const cue = cueForPage(currentPage);
    if (cue) setMusic(cue);
    else setMusic(null);
  }, [currentPage, bashoResult]);

  const handleMainMenuPage = () => {
    setIsCPUMatch(false);
    setIsTrainingMatch(false);
    setCurrentPage("mainMenu");
  };

  const handleLeaveTraining = () => {
    if (roomName) {
      socket.emit("leave_room", { roomId: roomName });
    }
    setIsTrainingMatch(false);
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

  const handleTraining = async () => {
    playButtonPressSound2();
    const save = await loadSave();
    const outfit = getActiveOutfit(save.customization);
    applyOutfitToPlayer1Setters(outfit, {
      setPlayer1Color,
      setPlayer1BodyColor,
    });
    setPlayer2Color(SPRITE_BASE_COLOR);
    setPlayer2BodyColor(null);
    await selectGameServer("local");
    socket.emit("create_training_match", {
      socketId: socket.id,
      mawashiColor: outfit.mawashiColor,
      bodyColor: outfit.bodyColor,
      gearIds: Array.isArray(outfit.gearIds) ? outfit.gearIds : [],
    });
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

  const menuItems = menuLayer === "play" ? PLAY_ITEMS : ROOT_ITEMS;

  const activateItem = (item) => {
    switch (item?.action) {
      case "openPlay":
        playButtonPressSound2();
        setMenuLayer("play");
        setActiveId("basho");
        break;
      case "back":
        playButtonPressSound2();
        setMenuLayer("root");
        setActiveId("play");
        break;
      case "basho":
        handleBasho();
        break;
      case "online":
        playButtonPressSound2();
        handleDisplayRooms();
        break;
      case "cpu":
        handleVsCPU();
        break;
      case "training":
        handleTraining();
        break;
      case "customize":
        playButtonPressSound2();
        setCurrentPage("customize");
        break;
      case "shop":
        playButtonPressSound2();
        setShopSoon(true);
        if (shopSoonTimerRef.current) clearTimeout(shopSoonTimerRef.current);
        shopSoonTimerRef.current = setTimeout(() => setShopSoon(false), 1800);
        break;
      case "options":
        playButtonPressSound2();
        handleSettings();
        break;
      default:
        break;
    }
  };

  const activateRef = useRef(activateItem);
  activateRef.current = activateItem;

  const moveActive = (delta) => {
    const items = menuLayer === "play" ? PLAY_ITEMS : ROOT_ITEMS;
    const idx = Math.max(
      0,
      items.findIndex((entry) => entry.id === activeId),
    );
    const next = items[(idx + delta + items.length) % items.length];
    setActiveId(next.id);
    playButtonHoverSound();
  };
  const moveRef = useRef(moveActive);
  moveRef.current = moveActive;

  useEffect(() => {
    if (currentPage === "mainMenu") {
      setMenuLayer("root");
      setActiveId("play");
    }
  }, [currentPage]);

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

  useEffect(() => {
    if (currentPage !== "mainMenu") return;
    const onKey = (e) => {
      if (showSettings) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowSettings(false);
        }
        return;
      }
      const items = menuLayer === "play" ? PLAY_ITEMS : ROOT_ITEMS;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        moveRef.current(1);
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        moveRef.current(-1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = items.find((entry) => entry.id === activeId) || items[0];
        activateRef.current(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (menuLayer === "play") {
          playButtonPressSound2();
          setMenuLayer("root");
          setActiveId("play");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPage, showSettings, menuLayer, activeId]);

  useEffect(() => {
    if (currentPage !== "mainMenu") return;
    let lastDir = 0;
    let lastA = false;
    let lastB = false;
    let lastNavAt = 0;
    const id = window.setInterval(() => {
      const pads = navigator.getGamepads?.();
      if (!pads) return;
      let pad = null;
      for (let i = 0; i < pads.length; i += 1) {
        if (pads[i]) {
          pad = pads[i];
          break;
        }
      }
      if (!pad) return;
      const confirm = !!pad.buttons[0]?.pressed;
      const cancel = !!pad.buttons[1]?.pressed;
      if (showSettings) {
        if (cancel && !lastB) setShowSettings(false);
        lastB = cancel;
        lastA = confirm;
        return;
      }
      const axisY = pad.axes[1] || 0;
      const up = !!pad.buttons[12]?.pressed || axisY < -0.55;
      const down = !!pad.buttons[13]?.pressed || axisY > 0.55;
      const now = performance.now();
      let dir = 0;
      if (down) dir = 1;
      else if (up) dir = -1;
      if (dir !== 0 && (dir !== lastDir || now - lastNavAt > 220)) {
        moveRef.current(dir);
        lastNavAt = now;
      }
      lastDir = dir;
      if (confirm && !lastA) {
        const items = menuLayer === "play" ? PLAY_ITEMS : ROOT_ITEMS;
        const item = items.find((entry) => entry.id === activeId) || items[0];
        activateRef.current(item);
      }
      lastA = confirm;
      if (cancel && !lastB && menuLayer === "play") {
        playButtonPressSound2();
        setMenuLayer("root");
        setActiveId("play");
      }
      lastB = cancel;
    }, 50);
    return () => window.clearInterval(id);
  }, [currentPage, showSettings, menuLayer, activeId]);

  const renderMainMenu = () => {
    return (
      <MainMenuContainer>
        <BackgroundPlate aria-hidden $lowSpec={lowSpec}>
          <SkyImage src={titleSky} alt="" />
          <WorldImage src={titleWorld} alt="" />
        </BackgroundPlate>
        <CinematicOverlay />
        {!lowSpec && <Snowfall intensity={10} showFrost={false} zIndex={3} />}

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

            <MenuList key={menuLayer} aria-label="Main menu">
              {menuItems.map((item, index) => (
                <MenuButton
                  key={item.id}
                  $index={index}
                  $featured={!!item.featured}
                  $quiet={!!item.quiet}
                  $active={activeId === item.id}
                  className={item.action === "options" ? "settings-button" : undefined}
                  onClick={() => activateItem(item)}
                  onMouseEnter={() => {
                    setActiveId(item.id);
                    playButtonHoverSound();
                  }}
                >
                  <span className="mode-label">
                    {item.label}
                    {item.id === "shop" && shopSoon ? (
                      <span className="mode-soon">Soon</span>
                    ) : null}
                  </span>
                </MenuButton>
              ))}
            </MenuList>
          </LeftColumn>
        </HeroStage>

        <PumoHeroWrapper>
          <HeroFloorShadow aria-hidden />
          <PumoHero
            src={heroSrc}
            alt=""
            onError={() => {
              if (heroSrcRef.current !== mainMenuPumo) {
                commitHeroSrc(mainMenuPumo);
              }
            }}
          />
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
            isTrainingMatch={isTrainingMatch}
            onLeaveTraining={handleLeaveTraining}
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
