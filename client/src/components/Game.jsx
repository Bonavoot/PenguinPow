import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { SocketContext } from "../SocketContext";
import GameFighter from "./GameFighter";
import MobileControls from "./MobileControls";
import PowerUpSelection from "./PowerUpSelection";
import PowerUpReveal from "./PowerUpReveal";
import CrowdLayer from "./CrowdLayer";
import SnowEffect from "./SnowEffect";
import PreMatchScreen from "./PreMatchScreen";
import gamepadHandler from "../utils/gamepadHandler";
import useCamera from "../hooks/useCamera";
import { usePlayerColors } from "../context/PlayerColorContext";
import {
  startMemoryMonitor,
  setupMemoryMonitorShortcut,
} from "../utils/memoryMonitor";
import { clearDecodedImageCache, rewarmDecodedImages } from "../utils/SpriteRecolorizer";
import { pickRandomGyojiOutfit } from "../config/gyojiOutfitPresets";
import { preloadGyojiOutfit, clearGyojiRecolorCache } from "../utils/GyojiRecolorizer";
import { ParticleProvider } from "../particles/ParticleContext";
import {
  registerLocalKeyState,
  unregisterLocalKeyState,
  setLocalGameActive,
} from "../prediction/localInput";
import { getServerOffset, isServerClockSynced } from "../lib/serverClock";
// import gameMusic from "../sounds/game-music.mp3";
import PropTypes from "prop-types";

// const gameMusicAudio = new Audio(gameMusic);
// gameMusicAudio.loop = true;
// gameMusicAudio.volume = 0.02;

// PERFORMANCE: Hidden element that forces the browser to download, parse, and rasterize
// the "Noto Serif JP" font at the exact size/weight used by RoundResult (22rem, weight 900).
// Without this, the first win triggers a freeze while the browser downloads the CJK font file
// (potentially several hundred KB) and rasterizes the 勝/敗 kanji at 350px+.
// This renders invisibly on mount so the font is warm before it's ever needed.
// The text-shadow matches RoundResult's MainKanji so the shadow rasterization is also cached.
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
        fontFamily: '"Noto Serif JP", serif',
        fontSize: "22rem",
        fontWeight: 900,
        lineHeight: 1,
        textShadow:
          "4px 4px 0 #E6B800, 8px 8px 0 #CC9900, 12px 12px 0 #B38600, 0 0 40px rgba(255, 215, 0, 0.35)",
        background:
          "linear-gradient(145deg, #FFFFFF 0%, #FFD700 40%, #FF8000 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      勝敗
    </span>
  </div>
);

const Game = ({
  rooms,
  roomName,
  localId,
  setCurrentPage,
  isCPUMatch = false,
}) => {
  const { socket } = useContext(SocketContext);
  const [isPowerUpSelectionActive, setIsPowerUpSelectionActive] =
    useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectedRoomId, setDisconnectedRoomId] = useState(null);
  const [crowdEvent, setCrowdEvent] = useState(null);

  // Pre-match screen state
  const [showPreMatchScreen, setShowPreMatchScreen] = useState(true); // Start with overlay visible
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPreloading, setIsPreloading] = useState(true);
  const preMatchShownRef = useRef(false); // Track if we've already shown/hidden the pre-match
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

  // Find current player for input blocking checks
  const currentPlayer = currentRoom?.players?.find(
    (player) => player.id === localId
  );
  const currentPlayerRef = useRef(null);
  currentPlayerRef.current = currentPlayer;

  // ============================================
  // GAME STATE TRACKING FOR PREDICTIONS
  // Track when game is active (after hakkiyoi) to prevent
  // predictions during power-up selection or before match starts
  // ============================================
  const isGameActiveRef = useRef(false);

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

  useCamera(containerRef, socket, showPreMatchScreen);

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
      rewarmDecodedImages();
    };
    socket.on("rematch", handleRematch);
    return () => socket.off("rematch", handleRematch);
  }, [socket, loadGyojiOutfit]);

  // AFK RECOVERY: when the tab/window regains focus after being hidden (the
  // exact "AFK'd on the rematch screen" case), the browser has very likely
  // purged decoded image bitmaps. Force them hot again on return so the next
  // round/interaction doesn't ghost. Cheap (decode work is off-main-thread).
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") rewarmDecodedImages();
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, []);

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

  // Memory monitor - logs to console every 30s, Ctrl+Shift+M for overlay
  useEffect(() => {
    const cleanupMonitor = startMemoryMonitor();
    const cleanupShortcut = setupMemoryMonitorShortcut();
    return () => {
      cleanupMonitor?.();
      cleanupShortcut?.();
    };
  }, []);

  // Free sprite caches when leaving game (reduces memory when in menu/lobby)
  useEffect(() => {
    return () => {
      clearGyojiRecolorCache();
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
      c: false,
      control: false,
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
      });
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

      // When being grabbed, only allow directional counter-inputs (A, D, S for grab break system)
      // Allow mouse1 through when in clinch with grip (clinch jolt)
      if (cp?.isBeingGrabbed) {
        const inClinchWithGrip = cp?.inClinch && cp?.hasGrip;
        const grabCounterOnly = {
          w: false,
          a: gamepadKeyState.a || false,
          s: gamepadKeyState.s || false,
          d: gamepadKeyState.d || false,
          " ": false,
          shift: false,
          e: false,
          f: false,
          mouse1: inClinchWithGrip ? (gamepadKeyState.mouse1 || false) : false,
          mouse2: false,
        };
        // No events array for grab-counter packets — this is a constrained
        // bypass and the server only reads `keys`. Skipping events here is
        // fine: grab-counter inputs are slow directional holds, not piano taps.
        socket.emit("fighter_action", { id: socket.id, keys: grabCounterOnly });
        return;
      }

      // CLIENT-SIDE PREDICTION for gamepad inputs
      if (gamepadKeyState.mouse1 && !keyState.mouse1) {
        if (gamepadKeyState.s && cp?.facing != null) {
          const forwardKey = cp.facing === -1 ? 'd' : 'a';
          if (gamepadKeyState[forwardKey]) {
            applyPrediction("charge_start");
          } else {
            applyPrediction("slap");
          }
        } else {
          applyPrediction("slap");
        }
      }
      if (gamepadKeyState.mouse2 && !keyState.mouse2) {
        applyPrediction("grab");
      }
      if (gamepadKeyState.shift && !keyState.shift) {
        const direction = gamepadKeyState.a ? -1 : gamepadKeyState.d ? 1 : null;
        applyPrediction("dash", direction);
      }
      if (gamepadKeyState[" "] && !keyState[" "]) {
        // Flap replaces raw parry on Space — don't locally predict a parry
        // (and its blue flame) for flap players; flight is server-authoritative.
        if (cp?.activePowerUp !== "flap") {
          applyPrediction("parry_start");
        }
      }
      if (!gamepadKeyState[" "] && keyState[" "]) {
        applyPrediction("parry_release");
      }
      // ICE PHYSICS: Power slide predictions for gamepad
      if (
        (gamepadKeyState.c || gamepadKeyState.control) &&
        !(keyState.c || keyState.control)
      ) {
        applyPrediction("power_slide_start");
      }
      if (
        !(gamepadKeyState.c || gamepadKeyState.control) &&
        (keyState.c || keyState.control)
      ) {
        applyPrediction("power_slide_end");
      }

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
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (cp?.isThrowingSnowball) return;

      // When being grabbed, allow A/D/S (push/plant) and W (throw backward during clinch)
      const allowedGrabKeys = ["a", "d", "s", "w"];
      if (
        cp?.isBeingGrabbed &&
        !allowedGrabKeys.includes(e.key.toLowerCase())
      ) {
        return;
      }

      const key = e.key.toLowerCase();
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
          // Raw parry (spacebar) — skip for flap players (Space takes flight,
          // which is server-authoritative; predicting a parry would flash the
          // blue flame mid-flight).
          else if (key === " ") {
            if (cp?.activePowerUp !== "flap") {
              applyPrediction("parry_start");
            }
          }
          // ICE PHYSICS: Power slide (c or control key)
          else if (key === "c" || key === "control") {
            applyPrediction("power_slide_start");
          }
        }

        scheduleEmit();
      }
    };

    const handleKeyUp = (e) => {
      const cp = currentPlayerRef.current;
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (cp?.isThrowingSnowball) return;

      // When being grabbed, allow A/D/S/W key releases (clinch inputs)
      const allowedGrabKeysUp = ["a", "d", "s", "w"];
      if (
        cp?.isBeingGrabbed &&
        !allowedGrabKeysUp.includes(e.key.toLowerCase())
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(keyState, key)) {
        // Prevent browser default behavior for game keys
        e.preventDefault();

        const wasPressed = keyState[key];
        keyState[key] = false;
        if (wasPressed) pushEvent(key, "up");

        // CLIENT-SIDE PREDICTION: Apply predicted state for releases
        if (key === " ") {
          applyPrediction("parry_release");
        }
        // ICE PHYSICS: End power slide when c/control released
        else if (key === "c" || key === "control") {
          applyPrediction("power_slide_end");
        }

        scheduleEmit();
      }
    };

    const handleMouseDown = (e) => {
      const cp = currentPlayerRef.current;
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (cp?.isThrowingSnowball) return;

      // Block Mouse1 (attack) when being grabbed, but allow Mouse2 (grip-up / clinch throws)
      // Allow Mouse1 through when in clinch with grip (clinch jolt)
      if (cp?.isBeingGrabbed && e.button === 0 && !(cp?.inClinch && cp?.hasGrip)) return;

      if (e.button === 0) {
        e.preventDefault();
        const wasPressed = keyState.mouse1;
        keyState.mouse1 = true;
        if (!wasPressed) pushEvent("mouse1", "down");
        if (keyState.s && cp?.facing != null) {
          const forwardKey = cp.facing === -1 ? 'd' : 'a';
          if (keyState[forwardKey]) {
            applyPrediction("charge_start");
          } else {
            applyPrediction("slap");
          }
        } else {
          applyPrediction("slap");
        }
        scheduleEmit();
      } else if (e.button === 2) {
        e.preventDefault();
        const wasPressed = keyState.mouse2;
        keyState.mouse2 = true;
        if (!wasPressed) pushEvent("mouse2", "down");

        if (!wasPressed && !cp?.isBeingGrabbed) {
          applyPrediction("grab");
        }

        scheduleEmit();
      }
    };

    const handleMouseUp = (e) => {
      const cp = currentPlayerRef.current;
      // Block inputs during power-up selection
      if (isPowerUpSelectionActive) return;

      // Block inputs when current player is throwing snowball
      if (cp?.isThrowingSnowball) return;

      // Block Mouse1 release when being grabbed, but allow Mouse2 release
      if (cp?.isBeingGrabbed && e.button === 0) return;

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
          applyPrediction("charge_release");
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

      // Remove gamepad input callback
      gamepadHandler.removeInputCallback(handleGamepadInput);
      if (emitTimerId !== null) {
        clearTimeout(emitTimerId);
      }
      unregisterLocalKeyState(keyState);
    };
  }, [isPowerUpSelectionActive, socket, applyPrediction]);

  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener("touchmove", preventDefault, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventDefault);
    };
  }, []);

  // Pre-match screen: Show overlay while preloading sprites
  // This shows the actual game scene (crowd, gyoji, players) behind a semi-transparent overlay
  useEffect(() => {
    // Only run once when game first loads
    if (preMatchShownRef.current) return;
    preMatchShownRef.current = true;

    const runPreload = async () => {

      // Simulate loading progress while actual preloading happens
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return 90;
          return prev + Math.random() * 15;
        });
      }, 200);

      try {
        // Preload all recolored sprites
        await preloadSprites(
          player1Color,
          player2Color,
          player1BodyColor,
          player2BodyColor
        );

        await loadGyojiOutfit(gyojiOutfitRef.current);

        // Complete the progress bar
        clearInterval(progressInterval);
        setLoadingProgress(100);
      } catch (error) {
        console.error("Game: Failed to preload sprites:", error);
        clearInterval(progressInterval);
        setLoadingProgress(100);
      }

      // Hide pre-match screen
      setIsPreloading(false);
      setShowPreMatchScreen(false);

      // Signal server that pre-match is complete - NOW start power-up selection
      socket.emit("pre_match_complete", { roomId: roomName });
    };

    runPreload();
  }, [
    preloadSprites,
    loadGyojiOutfit,
    player1Color,
    player2Color,
    player1BodyColor,
    player2BodyColor,
    socket,
    roomName,
  ]);

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
      isGameActiveRef.current = false;
      setLocalGameActive(false);
    };

    const handleGameOver = () => {
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
      // Force the fighter sprites hot at the start of EVERY round. The browser
      // can purge decoded bitmaps while idling between rounds (power-up select,
      // rematch screen) — re-warming here guarantees pose-change <img> remounts
      // paint warm during the round instead of ghosting on each pose's first use.
      rewarmDecodedImages();
    };

    const handlePerfectParry = () => {
      setCrowdEvent({
        type: "cheer",
        intensity: "medium",
        timestamp: Date.now(),
      });

      // "Time-freeze" flash framing the perfect-parry hitstop: cool grade snap
      // on the world + a faint cyan camera flash (see .perfect-parry-flash in
      // App.css). Suppressed if a KO grade-punch is mid-flight so they can't
      // collide.
      const el = containerRef.current;
      if (el && !el.classList.contains("ko-grade-punch")) {
        // Re-arm the CSS animation cleanly if one is somehow still active.
        el.classList.remove("perfect-parry-flash");
        // Force reflow so removing + re-adding restarts the keyframes.
        void el.offsetWidth;
        el.classList.add("perfect-parry-flash");
        clearTimeout(perfectParryFlashTimeoutRef.current);
        perfectParryFlashTimeoutRef.current = setTimeout(() => {
          const cur = containerRef.current;
          if (cur) cur.classList.remove("perfect-parry-flash");
        }, 360);
      }
    };

    // Cinematic-kill grade-punch: for the duration of the KO hitstop, snap the
    // whole scene to a higher-contrast, richer-saturation grade so the finishing
    // blow lands with a visceral pop, then ease back out. Pure class toggle —
    // the filter + transition live in App.css on `.ko-grade-punch .game-scene`.
    const handleCinematicKill = (data) => {
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
    socket.on("game_over", handleGameOver);
    socket.on("game_start", handleGameStart);
    socket.on("perfect_parry", handlePerfectParry);
    socket.on("cinematic_kill", handleCinematicKill);
    socket.on("ring_out", handleRingOut);

    return () => {
      socket.off("opponent_disconnected", handleOpponentDisconnected);
      socket.off("game_reset", handleGameReset);
      socket.off("game_over", handleGameOver);
      socket.off("game_start", handleGameStart);
      socket.off("perfect_parry", handlePerfectParry);
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

  // Early return if room doesn't exist (e.g., after disconnect/reconnect for CPU games)
  if (!currentRoom) {
    // Redirect to main menu if room doesn't exist
    setCurrentPage("main-menu");
    return null;
  }

  return (
    <div className="game-wrapper">
      <FontWarmup />
      <div ref={containerRef} className="game-container look-arcade-punchy">
        {/* Scene — everything inside moves together when the camera pans/zooms */}
        <div className="game-scene">
          <div className="game-map"></div>
          <CrowdLayer crowdEvent={crowdEvent} />
          {/* Behind-dohyo particle canvas (engine `ctxBehind`). Sits below the
              dohyo so `behindDohyo` particles render behind the platform; the
              engine receives this via ParticleProvider's `behindCanvasRef`. */}
          <canvas
            ref={sceneBehindCanvasRef}
            className="scene-particles-behind"
            aria-hidden="true"
          />
          {/* Grade + spotlight lighting are baked into dohyo.webp, so this is a
              plain crisp background layer (no runtime filter / blend layers). */}
          <div className="dohyo-overlay"></div>
          {/* Ring-out occluder target. Players normally live in `.game-actors`
              (above the UI) so flight paints over the nameplates. But that layer
              sits above the dohyo too, so a player who falls OFF the ring would
              float over the platform instead of sinking behind it. When a fighter
              crosses the dohyo boundary, GameFighter portals just its SPRITE here
              — back inside the scene, below the lit dohyo (z1) and its atmospherics
              — restoring the "fall behind the platform" look. No z-index here so
              the sprite's own z:0 competes directly with the dohyo's z:1. */}
          <div className="fallen-actors" aria-hidden="true"></div>
          {/* Scene-wide ambient snowfall (single system, parallax depth).
              Its internal back/front layers (z40 / z105) straddle the players
              so most snow falls behind them and only sparse foreground bokeh
              flakes drift in front. */}
          <SnowEffect mode="snow" />
          <div className="god-rays" aria-hidden="true"></div>
          <div className="arena-lighting" aria-hidden="true"></div>
        </div>
        {/* Screen-space film grain — sits on .game-container (NOT the scene)
            so it's fixed to the lens and never scales/pans with the camera. */}
        <div className="film-grain" aria-hidden="true"></div>
        {/* Player-info HUD target — portal host for the nameplate/health/stamina
            lower-thirds (UiPlayerInfo). Lives UNDER the actors layer so airborne
            penguins paint over it, but above the film-grain/vignette so the panel
            itself is visually unchanged. Hidden during the pre-match screen, same
            as the main HUD. */}
        <div
          id="game-hud-info"
          className={`game-hud-info${
            showPreMatchScreen ? " is-prematch-hidden" : ""
          }`}
        ></div>
        {/* Actors layer — the wrestlers + their particles. A SECOND camera layer
            that reuses the inherited --cam-* transform (perfect sync with
            .game-scene) but sits above the player-info HUD so flight is never
            covered by the UI. ParticleProvider lives here so VFX track the
            players; the in-HUD portals (UiPlayerInfo, announcements) still target
            #game-hud-info / #game-hud by id regardless of tree position. */}
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
                      isPowerUpSelectionActive={isPowerUpSelectionActive}
                      predictionRef={
                        isLocalPlayerFighter ? predictionRef : null
                      }
                      playerColor={i === 0 ? player1Color : player2Color}
                      playerBodyColor={
                        i === 0 ? player1BodyColor : player2BodyColor
                      }
                      isCPUMatch={isCPUMatch}
                    />
                  );
                })}
            </div>
          </ParticleProvider>
        </div>
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
        <PowerUpSelection
          roomId={roomName}
          playerId={localId}
          onSelectionStateChange={setIsPowerUpSelectionActive}
        />
        <PowerUpReveal roomId={roomName} localId={localId} />
        {showPreMatchScreen && currentRoom && (
          <PreMatchScreen
            player1Name={currentRoom.players[0]?.fighter || "Player 1"}
            player2Name={
              currentRoom.players[1]?.isCPU
                ? "CPU"
                : currentRoom.players[1]?.fighter || "Player 2"
            }
            player1Color={currentRoom.players[0]?.mawashiColor || player1Color}
            player2Color={currentRoom.players[1]?.mawashiColor || player2Color}
            player1BodyColor={
              currentRoom.players[0]?.bodyColor || player1BodyColor
            }
            player2BodyColor={
              currentRoom.players[1]?.bodyColor || player2BodyColor
            }
            player1Record={{ wins: 0, losses: 0 }}
            player2Record={{ wins: 0, losses: 0 }}
            loadingProgress={loadingProgress}
            isLoading={isPreloading}
            isCPUMatch={isCPUMatch}
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
};

export default Game;
