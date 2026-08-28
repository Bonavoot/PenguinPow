import { useContext, useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";
import MobileControls from "./MobileControls";
import PowerUpSelection from "./PowerUpSelection";
import PowerUpReveal from "./PowerUpReveal";
import CrowdLayer from "./CrowdLayer";
import RoofTassleLayer from "./RoofTassleLayer";
import SnowEffect from "./SnowEffect";
import PreMatchScreen from "./PreMatchScreen";
import TrainingPanel from "./TrainingPanel";
import {
  EMPTY_TRAINING_KITS,
  applyTrainingKitView,
} from "./TrainingKitTray";
import gamepadHandler from "../utils/gamepadHandler";
import useCamera from "../hooks/useCamera";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  startMemoryMonitor,
  setupMemoryMonitorShortcut,
} from "../utils/memoryMonitor";
import {
  clearDecodedImageCache,
  clearRecolorCache,
  rewarmDecodedImages,
  getCacheStats,
} from "../utils/SpriteRecolorizer";
import { clearHatCompositeCache, getHatCompositeCacheStats } from "../utils/hatComposite";
import { getPerfRecorder } from "../utils/perf/PerfRecorder";
import {
  pickRandomGyojiOutfit,
  GYOJI_OUTFIT_PRESETS,
} from "../config/gyojiOutfitPresets";
import {
  preloadGyojiOutfit,
  clearGyojiRecolorCache,
  prewarmGyojiOutfit,
} from "../utils/GyojiRecolorizer";
import { ParticleProvider } from "../particles/ParticleContext";
import { useLowSpec } from "../utils/lowSpecMode";
import {
  registerLocalKeyState,
  unregisterLocalKeyState,
  setLocalGameActive,
  getLocalKeyState,
} from "../prediction/localInput";
import { acquireCursor, releaseCursor } from "../ui/cursorGate";
import { getServerOffset, isServerClockSynced, getEstimatedRtt } from "../lib/serverClock";
import { warmCues } from "../utils/musicDirector";
import {
  requestFighterResync,
  retainFighterSocket,
} from "../net/fighterSnapshotBus";
import { selectLiveLocalFighter } from "../prediction/liveLocalFighter";
import { facingKeys } from "../combatAudio/strikeAudioPrediction";
import { selectMouse1StrikeCommand } from "../combatAudio/mouse1CommandSelection";
import {
  pushClientInputCommandTrace,
  clearClientInputCommandTrace,
  isInputCommandTraceEnabled,
} from "../debug/inputCommandTrace";
import {
  applyDohyoOverlayVars,
  loadDohyoOverlay,
  DOHYO_CHANGED_EVENT,
} from "./dohyoOverlayData";
// import gameMusic from "../sounds/game-music.mp3";
import PropTypes from "prop-types";

/** Phase 1: tag rewarm call sites; fire-and-forget but single-flight inside. */
function rewarmTagged(reason) {
  const perf = getPerfRecorder();
  if (perf.enabled) {
    let cache = null;
    let hats = null;
    try {
      cache = getCacheStats();
      hats = getHatCompositeCacheStats();
    } catch {
      /* ignore */
    }
    perf.mark("rewarm.trigger", {
      reason,
      visibility: document.visibilityState,
      cache,
      hats,
    });
  }
  return rewarmDecodedImages();
}

/** Coalesce focus + visibilitychange into one rewarm within a short window. */
let _rewarmCoalesceTimer = null;
function scheduleRewarmCoalesced(reason) {
  if (_rewarmCoalesceTimer != null) {
    getPerfRecorder().count("rewarm.scheduleCoalesced");
    return;
  }
  _rewarmCoalesceTimer = setTimeout(() => {
    _rewarmCoalesceTimer = null;
    rewarmTagged(reason);
  }, 50);
}

// const gameMusicAudio = new Audio(gameMusic);
// gameMusicAudio.loop = true;
// gameMusicAudio.volume = 0.02;

// PERFORMANCE: Hidden element that forces the browser to download, parse, and
// rasterize Yuji Boku at the size used by RoundResult kimarite. Without this,
// the first win can hitch while the brush subset loads.
const FontWarmup = () => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      left: "-9999px",
      top: "-9999px",
      visibility: "hidden",
      pointerEvents: "none",
      overflow: "hidden",
      width: "1px",
      height: "1px",
    }}
  >
    <span
      style={{
        fontFamily: '"Yuji Boku", "Noto Serif JP", serif',
        fontSize: "1.7rem",
        fontWeight: 400,
        letterSpacing: "0.14em",
        lineHeight: 1,
        color: "#f5ecd9",
      }}
    >
      突き出し寄り切り場外判定取り直し
    </span>
  </div>
);

const Game = ({
  rooms,
  roomName,
  localId,
  setCurrentPage,
  isCPUMatch = false,
  isTrainingMatch = false,
  onLeaveTraining = null,
  isBashoMatch = false,
  bashoBout = null,
  bashoBoutToken = 0,
  bashoArmed = false,
}) => {
  const { socket } = useContext(SocketContext);
  const lowSpec = useLowSpec();

  // Phase 5+/soak: one socket listener owns fighter_action merge + fan-out.
  useEffect(() => {
    if (!socket) return undefined;
    return retainFighterSocket(socket);
  }, [socket]);
  const [isPowerUpSelectionActive, setIsPowerUpSelectionActive] =
    useState(false);
  // Cursor only while the power-up picker is actually open — not prematch,
  // not the between-round wait before selection_start.
  useLayoutEffect(() => {
    if (isPowerUpSelectionActive) acquireCursor("powerup");
    else releaseCursor("powerup");
    return () => releaseCursor("powerup");
  }, [isPowerUpSelectionActive]);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectedRoomId, setDisconnectedRoomId] = useState(null);
  const [crowdEvent, setCrowdEvent] = useState(null);

  // Pre-match screen state
  const [showPreMatchScreen, setShowPreMatchScreen] = useState(
    !isTrainingMatch
  ); // Training starts already live — no pre-match card
  const [trainingBehavior, setTrainingBehavior] = useState("standby");
  const [trainingInfiniteResources, setTrainingInfiniteResources] =
    useState(false);
  const [trainingKits, setTrainingKits] = useState(EMPTY_TRAINING_KITS);
  const [trainingKitTarget, setTrainingKitTarget] = useState("human");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPreloading, setIsPreloading] = useState(true);
  // Tracks which bout the pre-match sequence has already run for. For a normal
  // match this stays 0 (runs once on mount). For a BASHO run it advances with
  // bashoBoutToken so each bout re-shows the pre-match WITHOUT a remount.
  const preMatchTokenRef = useRef(-1);
  const preMatchDoneRef = useRef(false); // current bout's preload finished
  const bashoBeginningRef = useRef(false); // guards the one-shot "begin bout" emit
  const bashoArmedRef = useRef(false);
  bashoArmedRef.current = bashoArmed;
  const gyojiOutfitRef = useRef(pickRandomGyojiOutfit());
  const [, setGyojiRevision] = useState(0);

  const index = rooms.findIndex((room) => room.id === roomName);

  // Get player colors for sprite recoloring
  const {
    player1Color,
    player2Color,
    player1BodyColor,
    player2BodyColor,
    preloadSprites,
  } = usePlayerColors();

  // Get the current room with null safety
  const currentRoom = index !== -1 ? rooms[index] : null;

  // Find current player for input blocking checks.
  // Facing for Mouse1 classification must NOT trust this alone — rooms[] is a
  // sanitized lobby/summary and can lag live fighter_action facing after cross-ups.
  const currentPlayer = currentRoom?.players?.find(
    (player) => player.id === localId
  );
  const currentPlayerRef = useRef(null);
  currentPlayerRef.current = currentPlayer;
  const localIdRef = useRef(localId);
  localIdRef.current = localId;
  // Diagnostic mode label only — never branches combat/audio behavior.
  const modeLabelRef = useRef("custom_pvp");
  modeLabelRef.current = isTrainingMatch
    ? "training"
    : isBashoMatch
      ? "basho"
      : isCPUMatch
        ? "vs_cpu"
        : "custom_pvp";

  const isTrainingMatchRef = useRef(isTrainingMatch);
  isTrainingMatchRef.current = isTrainingMatch;

  // Stream-warm results BGM during prematch (existing preloadMusic path —
  // HTMLAudio cache, not decodeAudioData). Avoids a 2–3MB hitch when the
  // ceremony card mounts after the last bout.
  useEffect(() => {
    warmCues(["resultsWin", "resultsLose"]);
  }, []);

  // ============================================
  // GAME STATE TRACKING FOR PREDICTIONS
  // Track when game is active (after hakkiyoi) to prevent
  // predictions during power-up selection or before match starts
  // ============================================
  const isGameActiveRef = useRef(!!isTrainingMatch);

  useLayoutEffect(() => {
    if (!isTrainingMatch) return undefined;
    isGameActiveRef.current = true;
    setLocalGameActive(true);
    return undefined;
  }, [isTrainingMatch]);

  // ============================================
  // CLIENT-SIDE PREDICTION REF
  // This ref will be populated by the local player's GameFighter
  // We call it to show predicted actions immediately before server confirms
  // ============================================
  const predictionRef = useRef(null);
  const containerRef = useRef(null);
  // Behind-dohyo particle canvas. Lives in `.game-scene` (below the dohyo)
  // rather than inside the actors layer, so `behindDohyo` particles (ring-out
  // throw smoke, the local-player halo during a ring-out, etc.) actually paint
  // BEHIND the platform. Passed down to ParticleProvider, which hands it to the
  // engine's `initBehind`. (The main + front particle canvases stay in the
  // actors layer so normal VFX paint over the HUD with the wrestlers.)
  const sceneBehindCanvasRef = useRef(null);
  const koPunchTimeoutRef = useRef(null);
  const koPunchLiteTimeoutRef = useRef(null);
  const lastCinematicPunchRef = useRef(0);
  const perfectParryFlashTimeoutRef = useRef(null);

  useCamera(containerRef, socket, showPreMatchScreen, isTrainingMatch);

  // Dohyo plate knobs (CSS vars) — baked defaults or editor draft in localStorage.
  // Live z-order unchanged; only --dohyo-* appearance updates.
  useEffect(() => {
    const apply = () =>
      applyDohyoOverlayVars(document.documentElement, loadDohyoOverlay());
    apply();
    window.addEventListener(DOHYO_CHANGED_EVENT, apply);
    return () => window.removeEventListener(DOHYO_CHANGED_EVENT, apply);
  }, []);

  const loadGyojiOutfit = useCallback(async (outfit) => {
    await preloadGyojiOutfit(outfit);
    setGyojiRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    const handleRematch = () => {
      const outfit = pickRandomGyojiOutfit();
      gyojiOutfitRef.current = outfit;
      loadGyojiOutfit(outfit);
      // Re-decode the pinned fighter sprites before the round starts. The
      // browser/Electron can purge decoded bitmaps after a long idle on the
      // rematch screen (the hidden, never-painted preload <img>s don't get
      // re-decoded on their own), which brought the ghost frames back on the
      // next round. This forces them hot again during the rematch transition.
      rewarmTagged("rematch");
    };
    socket.on("rematch", handleRematch);
    return () => socket.off("rematch", handleRematch);
  }, [socket, loadGyojiOutfit]);

  // PERF: pre-warm every gyoji outfit's recolor during idle time. A rematch
  // picks a RANDOM outfit and then synchronously recolors all 4 gyoji sheets
  // (pixel loop + toDataURL PNG encode) on the main thread — a measured
  // 96–220ms stall right in the match→match transition. Warming the cache now,
  // one outfit per idle slice (so the warm never blocks a visible frame), makes
  // every later rematch an instant cache hit. prewarmGyojiOutfit never touches
  // the active sprites, so this can't change what's on screen.
  useEffect(() => {
    const ric =
      window.requestIdleCallback ||
      ((fn) => setTimeout(() => fn(), 300));
    const cic = window.cancelIdleCallback || clearTimeout;
    let i = 0;
    let handle = null;
    let cancelled = false;
    const warmNext = () => {
      if (cancelled || i >= GYOJI_OUTFIT_PRESETS.length) return;
      const outfit = GYOJI_OUTFIT_PRESETS[i++];
      prewarmGyojiOutfit(outfit).finally(() => {
        if (!cancelled) handle = ric(warmNext);
      });
    };
    handle = ric(warmNext);
    return () => {
      cancelled = true;
      if (handle != null) cic(handle);
    };
  }, []);

  // AFK RECOVERY: when the tab/window regains focus after being hidden (the
  // exact "AFK'd on the rematch screen" case), the browser has very likely
  // purged decoded image bitmaps. Force them hot again on return so the next
  // round/interaction doesn't ghost. Cheap (decode work is off-main-thread).
  // Phase 5: also request a full fighter snapshot so delta-accumulators cannot
  // stay stale after a long background pause.
  useEffect(() => {
    const handleVisible = (e) => {
      if (document.visibilityState === "visible") {
        // focus + visibilitychange often fire together on return — coalesce.
        scheduleRewarmCoalesced(`lifecycle:${e.type}`);
        if (socket) requestFighterResync(socket, `lifecycle:${e.type}`);
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
      if (_rewarmCoalesceTimer != null) {
        clearTimeout(_rewarmCoalesceTimer);
        _rewarmCoalesceTimer = null;
      }
    };
  }, [socket]);

  const handleResetDisconnectState = useCallback(() => {
    setOpponentDisconnected(false);
    setDisconnectedRoomId(null);
  }, []);

  // Helper function to apply prediction for an action
  const applyPrediction = useCallback((actionType, direction = null) => {
    if (predictionRef.current?.applyPrediction) {
      // Pass gameStarted state so predictions know if game is active
      predictionRef.current.applyPrediction({
        type: actionType,
        direction,
        gameStarted: isGameActiveRef.current,
      });
    }
  }, []);

  // Memory monitor - DEV ONLY auto-logging (every 30s). In production it added
  // a periodic DOM-walk + console.log for no player benefit, so the 30s logger
  // is gated to dev. The manual Ctrl+Shift+M overlay + window.__PENGUIN_DEBUG()
  // shortcut stay available everywhere for on-demand inspection.
  useEffect(() => {
    const cleanupMonitor = import.meta.env.DEV ? startMemoryMonitor() : null;
    const cleanupShortcut = setupMemoryMonitorShortcut();
    return () => {
      cleanupMonitor?.();
      cleanupShortcut?.();
    };
  }, []);

  // Free sprite caches when leaving game (reduces memory when in menu/lobby).
  //
  // CRITICAL ORDERING/PAIRING: clearDecodedImageCache() REVOKES the blob URLs of
  // every decoded sprite. Those exact blob URLs are also the VALUES stored in the
  // persistent recolor LRU (recoloredImageCache) AND the hat-composite Map.
  // If we only clear decoded/recolor, hat cache survives mapping each pose to a
  // now-DEAD blob → BashoHub "Your wrestler" broken image + combat hat ghosts.
  // Clear hats first (unprotect + revoke), then recolor, then decoded.
  useEffect(() => {
    return () => {
      clearGyojiRecolorCache();
      clearHatCompositeCache();
      clearRecolorCache();
      clearDecodedImageCache();
    };
  }, []);

  useEffect(() => {
    const keyState = {
      w: false,
      a: false,
      s: false,
      d: false,
      " ": false,
      shift: false,
      e: false,
      f: false,
      mouse1: false,
      mouse2: false,
    };

    // Expose the live key state to the movement predictor (read-only, by
    // reference — this object is mutated in place and never recreated).
    registerLocalKeyState(keyState);

    // Input throttle: batch rapid key events into at most ~60 emits/sec
    // (one per server tick). Sends immediately on first change, then
    // schedules a trailing emit so the final state is never lost.
    let lastEmitTime = 0;
    let emitTimerId = null;
    const MIN_EMIT_INTERVAL = 16;

    // Per-packet edge-event buffer. Records every key state transition
    // since the last emit so the server can detect a press-release-press
    // faster than the throttle interval (e.g., piano-tap mashing) — the
    // trailing snapshot would otherwise collapse the middle press out.
    // Cap at 32 to absorb realistic bursts; older entries get dropped.
    const MAX_PENDING_EVENTS = 32;
    let pendingEvents = [];
    let droppedEventsWarned = false;

    const pushEvent = (k, action) => {
      if (pendingEvents.length >= MAX_PENDING_EVENTS) {
        pendingEvents.shift();
        if (!droppedEventsWarned) {
          droppedEventsWarned = true;
          console.warn("[Game] pendingEvents buffer overflowed; dropping oldest");
        }
      }
      pendingEvents.push({ k, a: action, t: performance.now() });
    };

    /** Live combat fighter at the physical input seam (event-time read). */
    const resolveLocalInputFighter = () =>
      selectLiveLocalFighter({
        localId: localIdRef.current,
        roomPlayer: currentPlayerRef.current,
      });

    /**
     * Canonical Mouse1 open-game strike classification for keyboard + gamepad.
     * Uses live-snapshot facing when available; room summary only as fallback.
     */
    const applyMouse1StrikeFromKeys = (keys) => {
      const sel = resolveLocalInputFighter();
      const result = selectMouse1StrikeCommand({
        keys,
        facing: sel.facing,
        roomFacing: sel.roomFacing,
        liveFacing: sel.liveFacing,
        facingSource: sel.facingSource,
        modeLabel: modeLabelRef.current,
      });
      applyPrediction(result.command);
      pushClientInputCommandTrace("COMMAND_SELECTED", {
        command: result.command,
        relativeDir: result.relativeDir,
        facing: result.facing,
        roomFacing: result.roomFacing,
        liveFacing: result.liveFacing,
        facingSource: result.facingSource,
      });
      return result;
    };

    const liveFacingOrRoom = () => {
      const sel = resolveLocalInputFighter();
      return sel.facing;
    };

    const emitInputNow = () => {
      if (emitTimerId !== null) {
        clearTimeout(emitTimerId);
        emitTimerId = null;
      }
      lastEmitTime = performance.now();
      const events = pendingEvents;
      pendingEvents = [];
      // Lag-compensation: include the client→server clock offset so the server
      // can reconstruct the real-world moment each event's `t` (performance.now)
      // occurred, in its own clock. Used to backdate the raw-parry start time so
      // the perfect-parry window is judged against when the player ACTUALLY
      // pressed — not when the packet happened to arrive (which jitters with
      // ping). `clientSynced` gates this: until the handshake completes,
      // `getServerOffset()` is the meaningless default and must be ignored.
      const clientSynced = isServerClockSynced();
      socket.emit("fighter_action", {
        id: socket.id,
        keys: keyState,
        events,
        clientSynced,
        clientOffset: clientSynced ? getServerOffset() : 0,
        clientRtt: clientSynced ? getEstimatedRtt() : 0,
      });
      if (isInputCommandTraceEnabled() && events.length > 0) {
        pushClientInputCommandTrace("COMMAND_EMITTED", {
          eventCount: events.length,
          keys: {
            a: !!keyState.a,
            d: !!keyState.d,
            w: !!keyState.w,
            shift: !!keyState.shift,
            mouse1: !!keyState.mouse1,
            mouse2: !!keyState.mouse2,
          },
        });
      }
    };

    const scheduleEmit = () => {
      const now = performance.now();
      const elapsed = now - lastEmitTime;
      if (elapsed >= MIN_EMIT_INTERVAL) {
        emitInputNow();
      } else if (emitTimerId === null) {
        emitTimerId = setTimeout(emitInputNow, MIN_EMIT_INTERVAL - elapsed);
      }
    };

    // Set up Steam Deck controller input
    const handleGamepadInput = (gamepadKeyState) => {
      const cp = currentPlayerRef.current;
      // Block inputs during power-up selection or when throwing snowball
      if (isPowerUpSelectionActive || cp?.isThrowingSnowball) return;

      // When being grabbed, allow full clinch kit: directions (push/plant),
      // W + M2 (throw/pull), M1 (jolt), Space (grab break). Block open-game
      // actions (dash/shift/power-ups). Do NOT gate on hasGrip — grip is
      // automatic on connect and may lag a packet behind isBeingGrabbed.
      // ARM CLAMP is enforced server-side.
      if (cp?.isBeingGrabbed) {
        const grabCounterOnly = {
          w: gamepadKeyState.w || false,
          a: gamepadKeyState.a || false,
          s: gamepadKeyState.s || false,
          d: gamepadKeyState.d || false,
          " ": gamepadKeyState[" "] || false,
          shift: false,
          e: false,
          f: false,
          mouse1: gamepadKeyState.mouse1 || false,
          mouse2: gamepadKeyState.mouse2 || false,
        };
        // No events array for grab-counter packets — this is a constrained
        // bypass and the server only reads `keys`. Skipping events here is
        // fine: grab-counter inputs are slow directional holds, not piano taps.
        socket.emit("fighter_action", { id: socket.id, keys: grabCounterOnly });
        return;
      }

      // CLIENT-SIDE PREDICTION for gamepad inputs (open game only — clinch M1 is jolt)
      if (
        gamepadKeyState.mouse1 &&
        !keyState.mouse1 &&
        !cp?.isBeingGrabbed &&
        !cp?.inClinch
      ) {
        applyMouse1StrikeFromKeys(gamepadKeyState);
      }
      if (
        gamepadKeyState.mouse2 &&
        !keyState.mouse2 &&
        !cp?.isBeingGrabbed &&
        !cp?.inClinch &&
        !cp?.isGrabbing &&
        !cp?.isGrabStartup
      ) {
        applyPrediction("grab");
      }
      if (gamepadKeyState.shift && !keyState.shift) {
        const direction = gamepadKeyState.a ? -1 : gamepadKeyState.d ? 1 : null;
        applyPrediction("dash", direction);
      }
      if (gamepadKeyState[" "] && !keyState[" "]) {
        const facing = liveFacingOrRoom();
        if (facing != null) {
          const { forwardKey, backKey } = facingKeys(facing);
          if (gamepadKeyState[backKey] && !gamepadKeyState[forwardKey]) {
            applyPrediction("matador_start");
          } else {
            applyPrediction("parry_start");
          }
        } else {
          applyPrediction("parry_start");
        }
      }
      if (!gamepadKeyState[" "] && keyState[" "]) {
        applyPrediction("matador_release");
        applyPrediction("parry_release");
      }
      // Charged-attack release parity with keyboard/mouse Mouse1-up prediction.
      if (
        !gamepadKeyState.mouse1 &&
        keyState.mouse1 &&
        !cp?.isBeingGrabbed &&
        !cp?.inClinch &&
        !cp?.isThrowingSnowball
      ) {
        applyPrediction("charge_release");
      }
      // Continuous charge chord while Mouse1 held (mirrors server + keyboard path).
      {
        const facing = liveFacingOrRoom();
        if (
          gamepadKeyState.mouse1 &&
          !cp?.isBeingGrabbed &&
          !cp?.inClinch &&
          facing != null
        ) {
          const { forwardKey } = facingKeys(facing);
          if (
            gamepadKeyState.s &&
            gamepadKeyState[forwardKey] &&
            (!keyState.s || !keyState[forwardKey])
          ) {
            applyPrediction("charge_start");
          }
        }
      }
      // ICE PHYSICS: Power slide predictions for gamepad
      // Diff each tracked key against keyState BEFORE the bulk assign so we
      // can emit per-key edge events for the gamepad path (the keyboard/mouse
      // handlers below push events directly at the change site).
      for (const k in keyState) {
        if (!Object.prototype.hasOwnProperty.call(keyState, k)) continue;
        const prev = !!keyState[k];
        const next = !!gamepadKeyState[k];
        if (prev !== next) {
          pushEvent(k, next ? "down" : "up");
        }
      }

      // Update keyState for next comparison
      Object.assign(keyState, gamepadKeyState);

      scheduleEmit();
    };

    // Add gamepad input callback
    gamepadHandler.addInputCallback(handleGamepadInput);

    const handleKeyDown = (e) => {
      const cp = currentPlayerRef.current;
      const key = e.key.toLowerCase();
      if (isTrainingMatchRef.current && key === "e") {
        e.preventDefault();
        if (!e.repeat && socket?.connected) {
          socket.emit("request_training_reset");
        }
        return;
      }

      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (cp?.isThrowingSnowball) return;

      // When being grabbed, allow clinch keys: A/D/S (push/plant), W (throw
      // chord), Space (grab break). Other keys stay blocked.
      const allowedGrabKeys = ["a", "d", "s", "w", " "];
      if (
        cp?.isBeingGrabbed &&
        !allowedGrabKeys.includes(e.key.toLowerCase())
      ) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(keyState, key)) {
        // Prevent browser default behavior for game keys (especially CTRL which triggers selection)
        e.preventDefault();

        const wasPressed = keyState[key];
        keyState[key] = true;
        if (!wasPressed) pushEvent(key, "down");

        // CLIENT-SIDE PREDICTION: Apply predicted state immediately for certain actions
        if (!wasPressed && !cp?.isBeingGrabbed) {
          // Dash (shift + direction)
          if (key === "shift") {
            const direction = keyState.a ? -1 : keyState.d ? 1 : null;
            applyPrediction("dash", direction);
          }
          // Space: BACK+SPACE → MATADOR, else ATTACK PARRY.
          else if (key === " ") {
            const facing = liveFacingOrRoom();
            if (facing != null) {
              const { forwardKey, backKey } = facingKeys(facing);
              if (keyState[backKey] && !keyState[forwardKey]) {
                applyPrediction("matador_start");
              } else {
                applyPrediction("parry_start");
              }
            } else {
              applyPrediction("parry_start");
            }
          }
          // Mouse1 already held + S/forward completes the charge chord — mirror
          // the server's continuous charge check so provisional slap/palm audio is
          // canceled via charge_start (combat-audio fidelity).
          else if (
            keyState.mouse1 &&
            !cp?.inClinch &&
            (key === "s" || key === "a" || key === "d")
          ) {
            const facing = liveFacingOrRoom();
            if (facing != null) {
              const { forwardKey } = facingKeys(facing);
              if (keyState.s && keyState[forwardKey]) {
                applyPrediction("charge_start");
              }
            }
          }
        }

        scheduleEmit();
      }
    };

    const handleKeyUp = (e) => {
      const cp = currentPlayerRef.current;
      // RELEASES ARE ALWAYS TRACKED — even while being grabbed, during power-up
      // selection, or mid-snowball. Swallowing a key-up leaves keyState stuck
      // "held": every later packet then tells the server the key is still down
      // long after the finger left it, and the first system that reads held
      // keys (post-grab input buffer, S+forward auto-charge, level-triggered
      // parry, tachiai charge) fires a phantom action or strands the player in
      // the charging stance. Only the visual predictions are skipped while in
      // a blocked state — the key state itself must stay truthful.
      const inputsBlocked =
        isPowerUpSelectionActive ||
        cp?.isThrowingSnowball ||
        cp?.isBeingGrabbed;

      const key = e.key.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(keyState, key)) {
        // Prevent browser default behavior for game keys
        e.preventDefault();

        const wasPressed = keyState[key];
        keyState[key] = false;
        if (wasPressed) pushEvent(key, "up");

        // CLIENT-SIDE PREDICTION: Apply predicted state for releases
        if (!inputsBlocked) {
          if (key === " ") {
            applyPrediction("matador_release");
            applyPrediction("parry_release");
          }
        }

        scheduleEmit();
      }
    };

    const handleMouseDown = (e) => {
      const cp = currentPlayerRef.current;
      if (e.target?.closest?.("[data-training-ui]")) return;
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (cp?.isThrowingSnowball) return;

      // Being grabbed / in clinch: Mouse1 is clinch jolt (server-gated) — never
      // an open-game strike. Still accept the key so the jolt request goes out.
      // Mouse2 is always allowed (throw/pull chords in clinch).
      if (e.button === 0) {
        e.preventDefault();
        const wasPressed = keyState.mouse1;
        keyState.mouse1 = true;
        if (!wasPressed) pushEvent("mouse1", "down");
        // Skip strike prediction in clinch — M1 is jolt there, and predicting
        // a slap/charge against the clinch pose causes flicker.
        if (!cp?.isBeingGrabbed && !cp?.inClinch) {
          // Canonical classifier: live fighter_action facing preferred over
          // rooms[] summary (stale facing after cross-ups caused false palm).
          applyMouse1StrikeFromKeys(keyState);
        }
        scheduleEmit();
      } else if (e.button === 2) {
        e.preventDefault();
        const wasPressed = keyState.mouse2;
        keyState.mouse2 = true;
        if (!wasPressed) pushEvent("mouse2", "down");

        // Don't predict an open-game grab while already clinching / grabbing —
        // M2 is throw/pull chord there. canPredictAction also rejects this,
        // but skip the call so we don't even attempt a grab pose flash.
        if (
          !wasPressed &&
          !cp?.isBeingGrabbed &&
          !cp?.inClinch &&
          !cp?.isGrabbing &&
          !cp?.isGrabStartup
        ) {
          applyPrediction("grab");
        }

        scheduleEmit();
      }
    };

    const handleMouseUp = (e) => {
      const cp = currentPlayerRef.current;
      // RELEASES ARE ALWAYS TRACKED — same rule as handleKeyUp. The old early
      // returns here (being grabbed / power-up selection / snowball) swallowed
      // the mouse1 release, leaving keyState.mouse1 stuck true. Real-world
      // repro: palm thrust whiffs → you get grabbed during its recovery → you
      // let go of M1 mid-grab → server believes M1 is held forever → the next
      // S+forward walk auto-starts a charge and the player stands stranded in
      // the shaking charge stance until M1 is physically clicked again. Only
      // the prediction is gated; the release itself always goes through.
      const inputsBlocked =
        isPowerUpSelectionActive ||
        cp?.isThrowingSnowball ||
        cp?.isBeingGrabbed;

      if (e.button === 0) {
        e.preventDefault();
        const wasPressed = keyState.mouse1;
        keyState.mouse1 = false;
        if (wasPressed) {
          pushEvent("mouse1", "up");
          // Predict the charged-attack release on the same frame as the
          // mouse-up. Internally a no-op unless we're actually charging, and
          // the server unconditionally executes the charged attack on release
          // while charging — so this prediction can't desync.
          if (!inputsBlocked) {
            applyPrediction("charge_release");
          }
        }
        scheduleEmit();
      } else if (e.button === 2) {
        e.preventDefault();
        const wasPressed = keyState.mouse2;
        keyState.mouse2 = false;
        if (wasPressed) pushEvent("mouse2", "up");
        scheduleEmit();
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Emit "up" events for any keys that were held so the server's edge
        // detector sees a clean release on focus loss instead of a stale
        // "still held" assumption.
        for (const key in keyState) {
          if (!Object.prototype.hasOwnProperty.call(keyState, key)) continue;
          if (keyState[key]) pushEvent(key, "up");
          keyState[key] = false;
        }
        pushClientInputCommandTrace("HELD_STATE_UPDATED", {
          reason: "visibility_blur_clear",
        });
        emitInputNow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearClientInputCommandTrace();

      // Remove gamepad input callback
      gamepadHandler.removeInputCallback(handleGamepadInput);
      if (emitTimerId !== null) {
        clearTimeout(emitTimerId);
      }
      unregisterLocalKeyState(keyState);
    };
  }, [isPowerUpSelectionActive, socket, applyPrediction, localId]);

  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener("touchmove", preventDefault, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventDefault);
    };
  }, []);

  // For a BASHO run the bout doesn't START until the DAY card is dismissed
  // ("Begin"). This emits pre_match_complete once preload is done AND the bout
  // is armed, after a short pre-match beat. For a normal match this is bypassed
  // (pre_match_complete fires straight after preload — see the effect below).
  const beginBashoBout = useCallback(() => {
    if (!isBashoMatch) return;
    if (!preMatchDoneRef.current) return; // sprites not ready yet
    if (!bashoArmedRef.current) return; // DAY card still up
    if (bashoBeginningRef.current) return; // already starting
    bashoBeginningRef.current = true;
    // GHOST-FRAME FIX (basho): the new opponent's freshly-recolored sprites were
    // decoded + pinned during the reskin, but their decoded bitmaps can be
    // purged by the browser while the DAY card / pre-match overlay sits idle and
    // unpainted. Re-decode the pinned working set NOW — a dead, no-input window
    // right before the bout — so pose transitions paint warm from the first
    // frame instead of ghosting until the later power_ups_revealed rewarm.
    rewarmTagged("basho_begin_bout");
    // Hold the pre-match card for a brief beat, then start the bout.
    setTimeout(() => {
      setShowPreMatchScreen(false);
      socket.emit("pre_match_complete", { roomId: roomName });
    }, 1100);
  }, [isBashoMatch, socket, roomName]);

  // Pre-match screen: show overlay while (re)preloading the bout's sprites.
  // Runs once on mount for a normal match; for BASHO it re-runs each bout as
  // bashoBoutToken advances (no remount). The opponent recolor between bouts
  // is light because the originals are already decoded + pinned from bout 1.
  useEffect(() => {
    const token = isBashoMatch ? bashoBoutToken : 0;
    if (preMatchTokenRef.current === token) return;
    preMatchTokenRef.current = token;

    const isLightReskin = isBashoMatch && token > 0; // only the opponent changed
    preMatchDoneRef.current = false;
    bashoBeginningRef.current = false;

    if (isTrainingMatch) {
      setShowPreMatchScreen(false);
      isGameActiveRef.current = true;
      setLocalGameActive(true);
      const runTrainingPreload = async () => {
        try {
          await preloadSprites(
            player1Color,
            player2Color,
            player1BodyColor,
            player2BodyColor,
            currentRoom?.players?.[0]?.gearIds || [],
            []
          );
        } catch (error) {
          console.error("Game: Training preload failed:", error);
        }
        preMatchDoneRef.current = true;
      };
      runTrainingPreload();
      return;
    }

    setShowPreMatchScreen(true);

    const runPreload = async () => {
      let progressInterval = null;
      if (isLightReskin) {
        // Heavy decode/pin already done on bout 1 — just recolor the opponent.
        // No loading bar; the DAY card masks the brief recolor.
        setIsPreloading(false);
        setLoadingProgress(100);
      } else {
        setIsPreloading(true);
        setLoadingProgress(0);
        progressInterval = setInterval(() => {
          setLoadingProgress((prev) => (prev >= 90 ? 90 : prev + Math.random() * 15));
        }, 200);
      }

      try {
        await preloadSprites(
          player1Color,
          player2Color,
          player1BodyColor,
          player2BodyColor,
          currentRoom?.players?.[0]?.gearIds || [],
          isBashoMatch ? [] : currentRoom?.players?.[1]?.gearIds || [],
        );
        if (!isLightReskin) {
          await loadGyojiOutfit(gyojiOutfitRef.current);
        }
        if (progressInterval) clearInterval(progressInterval);
        setLoadingProgress(100);
      } catch (error) {
        console.error("Game: Failed to preload sprites:", error);
        if (progressInterval) clearInterval(progressInterval);
        setLoadingProgress(100);
      }

      setIsPreloading(false);
      preMatchDoneRef.current = true;

      if (isBashoMatch) {
        // Wait for the DAY card "Begin" (arming) before starting the bout.
        beginBashoBout();
      } else {
        setShowPreMatchScreen(false);
        socket.emit("pre_match_complete", { roomId: roomName });
      }
    };

    runPreload();
  }, [
    bashoBoutToken,
    isBashoMatch,
    isTrainingMatch,
    beginBashoBout,
    preloadSprites,
    loadGyojiOutfit,
    player1Color,
    player2Color,
    player1BodyColor,
    player2BodyColor,
    currentRoom?.players,
    socket,
    roomName,
  ]);

  // When the DAY card is dismissed (bout armed), start the bout if its sprites
  // are already preloaded (covers the case where preload finished first).
  useEffect(() => {
    if (bashoArmed) beginBashoBout();
  }, [bashoArmed, beginBashoBout]);

  // Handle opponent disconnection - hide power-up selection UI for ALL game phases
  useEffect(() => {
    const handleOpponentDisconnected = (data) => {
      setIsPowerUpSelectionActive(false);
      setOpponentDisconnected(true);
      setDisconnectedRoomId(data.roomId);
    };

    const handleGameReset = () => {
      setOpponentDisconnected(false);
      setDisconnectedRoomId(null);
      setCrowdEvent({ type: "reset", timestamp: Date.now() });
      if (isTrainingMatchRef.current) {
        isGameActiveRef.current = true;
        setLocalGameActive(true);
        return;
      }
      isGameActiveRef.current = false;
      setLocalGameActive(false);
    };

    const handleTrainingReset = () => {
      setCrowdEvent({ type: "reset", timestamp: Date.now() });
      isGameActiveRef.current = true;
      setLocalGameActive(true);
    };

    const handleTrainingBehavior = (data) => {
      if (data?.behavior) setTrainingBehavior(data.behavior);
    };

    const handleTrainingSettings = (data) => {
      if (data?.behavior) setTrainingBehavior(data.behavior);
      if (typeof data?.infiniteResources === "boolean") {
        setTrainingInfiniteResources(data.infiniteResources);
      }
      if (data?.kits) setTrainingKits(data.kits);
    };

    const handleGameOver = (data) => {
      if (isTrainingMatchRef.current) return;
      requestAnimationFrame(() => {
        setCrowdEvent({
          type: "cheer",
          intensity: "heavy",
          timestamp: Date.now(),
        });
      });
      isGameActiveRef.current = false;
      setLocalGameActive(false);
    };

    const handleGameStart = () => {
      isGameActiveRef.current = true;
      setLocalGameActive(true);
      // PERF: rewarmDecodedImages() used to run HERE, on the exact frame inputs
      // go live (HAKKIYOI). Kicking off the whole pinned-sprite decode batch on
      // the first-input frame was a measured ~110ms longtask right when the
      // round opens = eaten opening moves. It now runs on `power_ups_revealed`
      // (below) — the dead window ~5s before the round — so sprites are already
      // hot when the round starts, with no collision with live input.

      // Re-send the current held-key snapshot at HAKKIYOI. Input emits are
      // edge-only, so a forward hold that started during ready never produces
      // a post-start packet — the server would stay rooted until release+press.
      // Server also buffers A/D; this is the client-side belt-and-suspenders.
      const keys = getLocalKeyState();
      if (keys && socket?.connected) {
        const clientSynced = isServerClockSynced();
        socket.emit("fighter_action", {
          id: socket.id,
          keys: { ...keys },
          events: [],
          clientSynced,
          clientOffset: clientSynced ? getServerOffset() : 0,
          clientRtt: clientSynced ? getEstimatedRtt() : 0,
        });
      }
    };

    // Re-warm the fighter sprites during the power-up REVEAL (a dead, non-input
    // moment that reliably fires right before every game_start). The browser
    // can purge decoded bitmaps while idling on the power-up/rematch screens;
    // warming here guarantees pose-change <img> remounts paint warm during the
    // round instead of ghosting — without paying the decode cost on the live
    // round-start frame.
    const handlePowerUpsRevealedRewarm = () => {
      rewarmTagged("power_ups_revealed");
    };

    // Perfect-parry screen flash — driven by raw_parry_success (the live emit),
    // not the legacy "perfect_parry" socket which the server never sends.
    // Short electric-cyan flash-bulb only — no world darken (KO owns that).
    const armPerfectParryFlash = () => {
      setCrowdEvent({
        type: "cheer",
        intensity: "medium",
        timestamp: Date.now(),
      });

      const el = containerRef.current;
      if (el && !el.classList.contains("ko-grade-punch")) {
        el.classList.remove("perfect-parry-flash");
        void el.offsetWidth;
        el.classList.add("perfect-parry-flash");
        clearTimeout(perfectParryFlashTimeoutRef.current);
        perfectParryFlashTimeoutRef.current = setTimeout(() => {
          const cur = containerRef.current;
          if (cur) cur.classList.remove("perfect-parry-flash");
        }, 360);
      }
    };

    const handlePerfectParry = () => {
      armPerfectParryFlash();
    };

    const handleRawParrySuccessFlash = (data) => {
      if (data?.isPerfect) armPerfectParryFlash();
    };

    // Cinematic-kill framing: for the duration of the KO hitstop, fade in the
    // screen-fixed `.cinematic-dim` overlay so the surroundings sink into shadow
    // (the "dark background" beat) while the camera zooms in, then ease back out.
    // Pure class toggle — the overlay + opacity transition live in App.css on
    // `.ko-grade-punch .cinematic-dim`. NOTE: this used to apply a CSS `filter:`
    // grade to the camera-transformed .game-scene/.game-actors, which forced a
    // per-frame offscreen re-raster of the heavy zooming layers for the whole
    // ~710ms hitstop = the cinematic freeze. The opacity-only overlay is free.
    const handleCinematicKill = (data) => {
      if (isTrainingMatchRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      lastCinematicPunchRef.current = Date.now();
      el.classList.add("ko-grade-punch");
      const hold = (data?.hitstopMs || 550) + 160;
      clearTimeout(koPunchTimeoutRef.current);
      koPunchTimeoutRef.current = setTimeout(() => {
        const cur = containerRef.current;
        if (cur) cur.classList.remove("ko-grade-punch");
      }, hold);
    };

    // Regular ring-outs get the LITE grade pop — but never on top of (or right
    // after) the big cinematic punch, so the cinematic finish stays special.
    // A cinematic kill emits its own ring_out ~1–2s later as the victim flies
    // out; the timestamp guard swallows that one.
    const handleRingOut = () => {
      if (isTrainingMatchRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      if (el.classList.contains("ko-grade-punch")) return;
      if (Date.now() - lastCinematicPunchRef.current < 2000) return;
      el.classList.add("ko-grade-punch--lite");
      clearTimeout(koPunchLiteTimeoutRef.current);
      koPunchLiteTimeoutRef.current = setTimeout(() => {
        const cur = containerRef.current;
        if (cur) cur.classList.remove("ko-grade-punch--lite");
      }, 240);
    };

    socket.on("opponent_disconnected", handleOpponentDisconnected);
    socket.on("game_reset", handleGameReset);
    socket.on("training_reset", handleTrainingReset);
    socket.on("training_behavior", handleTrainingBehavior);
    socket.on("training_settings", handleTrainingSettings);
    socket.on("game_over", handleGameOver);
    socket.on("game_start", handleGameStart);
    socket.on("power_ups_revealed", handlePowerUpsRevealedRewarm);
    socket.on("perfect_parry", handlePerfectParry);
    socket.on("raw_parry_success", handleRawParrySuccessFlash);
    socket.on("cinematic_kill", handleCinematicKill);
    socket.on("ring_out", handleRingOut);

    return () => {
      socket.off("opponent_disconnected", handleOpponentDisconnected);
      socket.off("game_reset", handleGameReset);
      socket.off("training_reset", handleTrainingReset);
      socket.off("training_behavior", handleTrainingBehavior);
      socket.off("training_settings", handleTrainingSettings);
      socket.off("game_over", handleGameOver);
      socket.off("game_start", handleGameStart);
      socket.off("power_ups_revealed", handlePowerUpsRevealedRewarm);
      socket.off("perfect_parry", handlePerfectParry);
      socket.off("raw_parry_success", handleRawParrySuccessFlash);
      socket.off("cinematic_kill", handleCinematicKill);
      socket.off("ring_out", handleRingOut);
      clearTimeout(koPunchTimeoutRef.current);
      clearTimeout(koPunchLiteTimeoutRef.current);
      clearTimeout(perfectParryFlashTimeoutRef.current);
      if (containerRef.current) {
        containerRef.current.classList.remove("ko-grade-punch");
        containerRef.current.classList.remove("ko-grade-punch--lite");
        containerRef.current.classList.remove("perfect-parry-flash");
      }
      setLocalGameActive(false);
    };
  }, [socket]);

  // Room can lag a tick behind basho/CPU create (rooms broadcast vs page swap).
  // Never setState during render — and use the real page id ("mainMenu").
  useEffect(() => {
    if (currentRoom) return undefined;
    const t = setTimeout(() => {
      if (isTrainingMatch && onLeaveTraining) onLeaveTraining();
      else setCurrentPage("mainMenu");
    }, 1200);
    return () => clearTimeout(t);
  }, [currentRoom, setCurrentPage, isTrainingMatch, onLeaveTraining]);

  if (!currentRoom) {
    return null;
  }

  return (
    <div className="game-wrapper">
      <FontWarmup />
      <div ref={containerRef} className="game-container">
        {/* Far field — sky lags; floor plate (ice + water + mountains) uses
            the fight cam. Sibling of .game-scene, not inside it. */}
        <div className="game-parallax" aria-hidden="true">
          <div className="game-parallax-sky"></div>
          <div className="game-parallax-floor">
            <div className="game-parallax-floor-art">
              <div className="game-parallax-water" aria-hidden="true"></div>
            </div>
          </div>
        </div>
        {/* Scene — everything inside moves together when the camera pans/zooms */}
        <div className="game-scene">
          <div className="game-map"></div>
          <CrowdLayer
            crowdEvent={crowdEvent}
            bashoRank={isBashoMatch ? bashoBout?.playerRank : null}
          />
          {/* Behind-dohyo particle canvas (engine `ctxBehind`). Sits below the
              dohyo so `behindDohyo` particles render behind the platform; the
              engine receives this via ParticleProvider's `behindCanvasRef`. */}
          <canvas
            ref={sceneBehindCanvasRef}
            className="scene-particles-behind"
            aria-hidden="true"
          />
          <div className="dohyo-platform-shadow" aria-hidden="true"></div>
          {/* Flat 2× bake (dohyo-display.webp). After knob changes: npm run bake:dohyo */}
          <div className="dohyo-overlay"></div>
          {/* Ice mask host — tawara interior. In the scene (under gyoji /
              fighters) so grain/sheen/reflections cannot tint the referee.
              GameFighter portals IceReflection here. */}
          <div
            className={`ice-reflection-clip${
              showPreMatchScreen ? " is-prematch-hidden" : ""
            }`}
            aria-hidden="true"
          >
            {!lowSpec && <div className="ice-disc-grain" />}
          </div>
          {/* Sumo roof fusas hanging over the four dohyo corners.
              Dev: press ~ (Shift+`) to place / resize. */}
          <RoofTassleLayer />
          {/* Ring-out occluder target. Players normally live in `.game-actors`
              (above the UI) so flight paints over the nameplates. But that layer
              sits above the dohyo too, so a player who falls OFF the ring would
              float over the platform instead of sinking behind it. When a fighter
              crosses the dohyo boundary, GameFighter portals just its SPRITE here
              — back inside the scene, below the lit dohyo (z1) and its atmospherics
              — restoring the "fall behind the platform" look. No z-index here so
              the sprite's own z:0 competes directly with the dohyo's z:1. */}
          <div className="fallen-actors" aria-hidden="true"></div>
          {/* Ambient snowfall behind the wrestlers. Low Spec skips mount. */}
          {!lowSpec && <SnowEffect mode="snow" />}
          <div className="arena-lighting" aria-hidden="true"></div>
          {/* Rafter shafts — world-space, pre-softened plate, opacity only. */}
          <div className="god-rays" aria-hidden="true"></div>
        </div>
        {/* Screen-space film grain — sits on .game-container (NOT the scene)
            so it's fixed to the lens and never scales/pans with the camera. */}
        <div className="film-grain" aria-hidden="true"></div>
        <div
          className="antarctica-map-hint"
          data-on="Antarctica · Ctrl+Shift+A to stadium"
          data-off="Stadium · Ctrl+Shift+A to Antarctica"
        ></div>
        {/* Cinematic-kill dim — the "dark background" beat. Screen-fixed (not
            camera-transformed) and driven purely by opacity via the
            `.ko-grade-punch` class on .game-container, so it composites for
            free instead of filtering the zooming scene/actors layers (see
            .cinematic-dim in App.css for the full freeze-fix rationale). */}
        <div className="cinematic-dim" aria-hidden="true"></div>
        {/* Player-info HUD target — portal host for the nameplate/health/stamina
            lower-thirds (UiPlayerInfo). Below actors and ceremony so speech
            reads above the persistent HUD; below #game-hud RoundResult / KO.
            Hidden during the pre-match screen, same as the main HUD. */}
        <div
          id="game-hud-info"
          className={`game-hud-info${
            showPreMatchScreen ? " is-prematch-hidden" : ""
          }`}
        ></div>
        {/* Ring props — gyoji + salt baskets. Camera-synced like .game-actors,
            but below side callouts so combat banners paint over the dressing.
            Hidden during prematch (same as .ui) — these used to live inside
            .ui and disappeared with it; portalling them out for z-order must
            not leave the gyoji peeking through the StageDim hole. */}
        <div
          id="game-ring-props"
          className={`game-ring-props${
            showPreMatchScreen ? " is-prematch-hidden" : ""
          }`}
        ></div>
        {/* Side combat callout host — pigment slabs + hype marks portal here so
            COUNTER HIT / PUNISH / PERFECT / MATADOR sit OVER ring props
            and UNDER the wrestlers. Center announcements still target #game-hud. */}
        <div
          id="game-hud-callouts"
          className={`game-hud-callouts${
            showPreMatchScreen ? " is-prematch-hidden" : ""
          }`}
        ></div>
        {/* Actors layer — the wrestlers + their particles. A SECOND camera layer
            that reuses the inherited --cam-* transform (perfect sync with
            .game-scene) but sits above the player-info HUD, ring props, and
            side callouts so flight is never covered by the UI. ParticleProvider
            lives here so VFX track the players; HUD portals still target
            #game-hud-info / #game-hud-callouts / #game-hud by id. */}
        <div className="game-actors">
          <ParticleProvider behindCanvasRef={sceneBehindCanvasRef}>
            <div
              className={`ui${
                showPreMatchScreen ? " is-prematch-hidden" : ""
              }`}
            >
              {currentRoom.players
                .filter((player) => player.id !== "disconnected_placeholder")
                .map((player, i) => {
                  const isLocalPlayerFighter = player.id === localId;
                  return (
                    <GameFighter
                      localId={localId}
                      key={player.id}
                      player={player}
                      index={i}
                      roomName={roomName}
                      setCurrentPage={setCurrentPage}
                      opponentDisconnected={opponentDisconnected}
                      disconnectedRoomId={disconnectedRoomId}
                      onResetDisconnectState={handleResetDisconnectState}
                      predictionRef={
                        isLocalPlayerFighter ? predictionRef : null
                      }
                      playerColor={i === 0 ? player1Color : player2Color}
                      playerBodyColor={
                        i === 0 ? player1BodyColor : player2BodyColor
                      }
                      isCPUMatch={isCPUMatch}
                      isTrainingMatch={isTrainingMatch}
                      isBashoMatch={isBashoMatch}
                      bashoPlayerRankLabel={
                        isBashoMatch ? bashoBout?.playerRankLabel : undefined
                      }
                      bashoOpponentRankLabel={
                        isBashoMatch ? bashoBout?.opponentRankLabel : undefined
                      }
                      bashoDraftedPowerUps={
                        isBashoMatch ? bashoBout?.draftedPowerUps : undefined
                      }
                      bashoOpponentPowerUps={
                        isBashoMatch ? bashoBout?.opponentPowerUps : undefined
                      }
                      bashoDay={isBashoMatch ? bashoBout?.day : undefined}
                      bashoTotalBouts={
                        isBashoMatch ? bashoBout?.totalBouts : undefined
                      }
                      bashoOpponentName={
                        isBashoMatch ? bashoBout?.opponentName : undefined
                      }
                    />
                  );
                })}
            </div>
          </ParticleProvider>
        </div>
        {/* Gyoji ceremony bubbles — camera-synced above wrestlers (205) and
            UiPlayerInfo (200) so dialogue reads over the persistent HUD.
            RoundResult / MatchOver remain in #game-hud (210). */}
        <div
          id="game-ceremony"
          className={`game-ceremony${
            showPreMatchScreen ? " is-prematch-hidden" : ""
          }`}
        ></div>
        {/* HUD layer — viewport-fixed, unaffected by camera zoom/pan.
            While the pre-match screen is up we add `is-prematch-hidden`
            so the in-game HUD (player nameplates, health/balance bars,
            stamina, power-up chips, etc.) doesn't visually compete with
            the broadcast lower-third. The portal target itself stays
            mounted so any portalled effects/components keep their DOM. */}
        <div
          id="game-hud"
          className={`game-hud${showPreMatchScreen ? " is-prematch-hidden" : ""}`}
        ></div>
        {!isTrainingMatch && (
          <PowerUpSelection
            roomId={roomName}
            playerId={localId}
            onSelectionStateChange={setIsPowerUpSelectionActive}
          />
        )}
        {!isTrainingMatch && (
          <PowerUpReveal roomId={roomName} localId={localId} />
        )}
        {isTrainingMatch && (
          <TrainingPanel
            behavior={trainingBehavior}
            infiniteResources={trainingInfiniteResources}
            onSelect={(next) => {
              setTrainingBehavior(next);
              socket.emit("set_training_behavior", { behavior: next });
            }}
            onToggleResources={(next) => {
              setTrainingInfiniteResources(next);
              socket.emit("set_training_resources", {
                infiniteResources: next,
              });
            }}
            onReset={() => {
              if (socket?.connected) socket.emit("request_training_reset");
            }}
            onExit={onLeaveTraining || (() => setCurrentPage("mainMenu"))}
            kits={trainingKits}
            kitTarget={trainingKitTarget}
            onKitTarget={setTrainingKitTarget}
            onKitChange={(op, type) => {
              setTrainingKits((prev) => ({
                ...prev,
                [trainingKitTarget]: applyTrainingKitView(
                  prev[trainingKitTarget],
                  op,
                  type
                ),
              }));
              if (socket?.connected) {
                socket.emit("set_training_kit", {
                  target: trainingKitTarget,
                  op,
                  type,
                });
              }
            }}
          />
        )}
        {showPreMatchScreen && currentRoom && (
          <PreMatchScreen
            player1Name={currentRoom.players[0]?.fighter || "Player 1"}
            player2Name={
              isBashoMatch && bashoBout?.opponentName
                ? bashoBout.opponentName
                : currentRoom.players[1]?.isCPU
                ? "CPU"
                : currentRoom.players[1]?.fighter || "Player 2"
            }
            player1Color={currentRoom.players[0]?.mawashiColor || player1Color}
            player2Color={
              isBashoMatch
                ? player2Color
                : currentRoom.players[1]?.mawashiColor || player2Color
            }
            player1BodyColor={
              currentRoom.players[0]?.bodyColor || player1BodyColor
            }
            player2BodyColor={
              isBashoMatch
                ? player2BodyColor
                : currentRoom.players[1]?.bodyColor || player2BodyColor
            }
            player1GearIds={currentRoom.players[0]?.gearIds || []}
            player2GearIds={
              isBashoMatch ? [] : currentRoom.players[1]?.gearIds || []
            }
            player1Record={
              isBashoMatch && bashoBout?.playerRecord
                ? bashoBout.playerRecord
                : { wins: 0, losses: 0 }
            }
            player2Record={
              isBashoMatch && bashoBout?.opponentRecord
                ? bashoBout.opponentRecord
                : { wins: 0, losses: 0 }
            }
            player1RankLabel={
              isBashoMatch ? bashoBout?.playerRankLabel : undefined
            }
            player2RankLabel={
              isBashoMatch ? bashoBout?.opponentRankLabel : undefined
            }
            loadingProgress={loadingProgress}
            isLoading={isPreloading}
            isCPUMatch={isCPUMatch}
            isBashoMatch={isBashoMatch}
            dayLabel={
              isBashoMatch && bashoBout
                ? `Day ${bashoBout.day}`
                : undefined
            }
          />
        )}
      </div>
      <MobileControls
        isInputBlocked={isPowerUpSelectionActive}
        currentPlayer={currentPlayer}
      />
    </div>
  );
};

Game.propTypes = {
  rooms: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      players: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  roomName: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  isCPUMatch: PropTypes.bool,
  isTrainingMatch: PropTypes.bool,
  onLeaveTraining: PropTypes.func,
  isBashoMatch: PropTypes.bool,
  bashoBout: PropTypes.object,
  bashoBoutToken: PropTypes.number,
  bashoArmed: PropTypes.bool,
};

export default Game;
