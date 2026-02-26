import React, {
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import "./MatchOver.css";
import Gyoji from "./Gyoji";
import {
  getSpritesheetConfig,
  SPRITESHEET_CONFIG_BY_NAME,
} from "../config/animatedSpriteConfig";
import PlayerShadow from "./PlayerShadow";
import ThrowTechEffect from "./ThrowTechEffect";
import PowerMeter from "./PowerMeter";
import SlapParryEffect from "./SlapParryEffect";
import { useParticles } from "../particles/ParticleContext";
import StarStunEffect from "./StarStunEffect";
import ThickBlubberEffect from "./ThickBlubberEffect";
import GrabBreakEffect from "./GrabBreakEffect";
import GrabTechEffect from "./GrabTechEffect";
import CounterGrabEffect from "./CounterGrabEffect";
import PunishBannerEffect from "./PunishBannerEffect";
import CounterHitEffect from "./CounterHitEffect";
import EdgeDangerEffect from "./EdgeDangerEffect";
import NoStaminaEffect from "./GassedEffect";
import SnowballImpactEffect from "./SnowballImpactEffect";
import PumoCloneSpawnEffect from "./PumoCloneSpawnEffect";
import SlapAttackHandsEffect from "./SlapAttackHandsEffect";
import SumoGameAnnouncement from "./SumoGameAnnouncement";
import { useDynamicSprite } from "../hooks/useDynamicSprite";
import {
  recolorImage,
  getCachedRecoloredImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
  COLOR_PRESETS,
} from "../utils/SpriteRecolorizer";
import { usePlayerColors } from "../context/PlayerColorContext";
import { SPECIAL_MAWASHI_GRADIENTS } from "./PreMatchScreen";
import UiPlayerInfo from "./UiPlayerInfo";
import MatchOver from "./MatchOver";
import RoundResult from "./RoundResult";
import HitEffect from "./HitEffect";
import RawParryEffect from "./RawParryEffect";
import { getGlobalVolume } from "./Settings";
import { playBuffer, createCrossfadeLoop } from "../utils/audioEngine";
import SnowEffect from "./SnowEffect";
import ThemeOverlay from "./ThemeOverlay";
import "./theme.css";
import {
  isOutsideDohyo,
  DOHYO_FALL_DEPTH,
  SERVER_BROADCAST_HZ,
} from "../constants";

// Assets, sounds, preloading, constants, ritual config, playSound helper
import {
  pumo,
  saltBasket,
  saltBasketEmpty,
  snowball,
  attackSound,
  hitSound,
  dodgeSound,
  throwSound,
  grabSound,
  winnerSound,
  hakkiyoiSound,
  teWoTsuiteSound,
  bellSound,
  gameMusic,
  eeshiMusic,
  slapParrySound,
  saltSound,
  snowballThrowSound,
  pumoArmySound,
  thickBlubberSound,
  rawParryGruntSound,
  rawParrySuccessSound,
  regularRawParrySound,
  stunnedSound,
  gassedSound,
  gassedRegenSound,
  grabBreakSound,
  counterGrabSound,
  notEnoughStaminaSound,
  grabClashSound,
  isTechingSound,
  roundVictorySound,
  roundDefeatSound,
  strafingSound,
  heartbeatSound,
  clap1Sound,
  clap2Sound,
  clap3Sound,
  clap4Sound,
  GROUND_LEVEL,
  SPRITE_HALF_W,
  PLAYER_MID_Y,
  RITUAL_SPRITE_CONFIG,
  CLAP_SOUND_OFFSET,
  ritualSpritesheetsPlayer1,
  ritualSpritesheetsPlayer2,
  ritualClapSounds,
  playSound,
  slapHitSounds,
  slapWhiffSounds,
  chargedHitSounds,
  grabHitSounds,
  rawParrySounds,
  pickRandomSound,
  xToPan,
} from "./fighterAssets";
import getImageSrc from "./getImageSrc";
import {
  StyledImage,
  getFighterPopFilter,
  RitualSpriteContainer,
  RitualSpriteImage,
  AnimatedFighterContainer,
  AnimatedFighterImage,
  CountdownTimer,
  SaltBasket,
  YouLabel,
  SnowballWrapper,
  SnowballProjectileImg,
  PumoClone,
  AnimatedPumoCloneContainer,
  AnimatedPumoCloneImage,
  OpponentDisconnectedOverlay,
  DisconnectedModal,
  DisconnectedTitle,
  DisconnectedMessage,
} from "./fighterStyledComponents";

const GameFighter = ({
  player,
  index,
  roomName,
  localId,
  setCurrentPage,
  opponentDisconnected,
  disconnectedRoomId,
  onResetDisconnectState,
  isPowerUpSelectionActive,
  predictionRef, // Ref for client-side prediction (only used for local player)
  playerColor, // Custom color for mawashi/headband recoloring
  playerBodyColor, // Custom body color (null = default grey)
}) => {
  const { socket } = useContext(SocketContext);
  const emitParticles = useParticles();

  // ============================================
  // SPRITE RECOLORING STATE
  // Cache recolored sprites to avoid re-processing each render
  // ============================================
  const [recoloredSprites, setRecoloredSprites] = useState({});
  const recoloringInProgress = useRef(new Set());

  // Determine if we need to recolor
  // UNIFIED: All sprites are BLUE - only skip recoloring if target color is blue
  // Player 2's default is red, so they ALWAYS need recoloring (blue -> red/custom)
  const playerNumber = index === 0 ? 1 : 2;
  const targetColor =
    playerColor ||
    (playerNumber === 1 ? SPRITE_BASE_COLOR : COLOR_PRESETS.scarlet);
  const needsRecoloring =
    targetColor !== SPRITE_BASE_COLOR || !!playerBodyColor;
  const colorRanges = BLUE_COLOR_RANGES;

  // Get both player colors for pumo clone coloring
  const { player1Color: p1Color, player2Color: p2Color } = usePlayerColors();

  // Function to get sprite render info (handles both static and animated sprites)
  // Returns: { src, isAnimated, config } where config contains spritesheet animation data
  // When isHit is true, uses hit-tinted variant (mawashi/headband unchanged, rest tinted red)
  // When isWhiteFlash is true, uses white-tinted variant (dodge invincibility flash)
  // When isBlubberTint is true, uses purple-tinted variant for thick blubber power-up
  const getSpriteRenderInfo = useCallback(
    (
      originalSrc,
      isHit = false,
      isWhiteFlash = false,
      isBlubberTint = false
    ) => {
      if (!originalSrc) {
        return { src: originalSrc, isAnimated: false, config: null };
      }

      // Check if this is an animated spritesheet
      const spritesheetConfig = getSpritesheetConfig(originalSrc);
      const isAnimated = !!spritesheetConfig;

      // Determine the source to recolor (spritesheet for animated, original for static)
      const sourceToRecolor = isAnimated
        ? spritesheetConfig.spritesheet
        : originalSrc;
      const useHitTint = isHit;
      const useWhiteFlash = isWhiteFlash;
      const useBlubberTint = isBlubberTint;

      if (
        !needsRecoloring &&
        !useHitTint &&
        !useWhiteFlash &&
        !useBlubberTint
      ) {
        return {
          src: sourceToRecolor,
          isAnimated,
          config: spritesheetConfig,
        };
      }

      // Build options for cache lookup (body color options computed inline to avoid stale closure)
      const tintOptions = playerBodyColor
        ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: playerBodyColor }
        : {};
      if (useHitTint) tintOptions.hitTintRed = true;
      if (useWhiteFlash) tintOptions.chargeTintWhite = true;
      if (useBlubberTint) tintOptions.blubberTintPurple = true;

      // FIRST: Check global cache (populated by preloadSprites in Lobby)
      const globalCached = getCachedRecoloredImage(
        sourceToRecolor,
        colorRanges,
        targetColor,
        tintOptions
      );
      if (globalCached) {
        return {
          src: globalCached,
          isAnimated,
          config: spritesheetConfig,
        };
      }

      const cacheKey = `${sourceToRecolor}_${targetColor}${
        playerBodyColor ? "_body_" + playerBodyColor : ""
      }${useHitTint ? "_hit" : ""}${useWhiteFlash ? "_charge" : ""}${
        useBlubberTint ? "_blubber" : ""
      }`;
      if (recoloredSprites[cacheKey]) {
        return {
          src: recoloredSprites[cacheKey],
          isAnimated,
          config: spritesheetConfig,
        };
      }

      // Skip GIFs (they can't be recolored with canvas) - but use spritesheet if available
      if (
        typeof originalSrc === "string" &&
        originalSrc.includes(".gif") &&
        !isAnimated
      ) {
        return { src: originalSrc, isAnimated: false, config: null };
      }

      // Start async recoloring if not already in progress (fallback for uncached sprites)
      if (!recoloringInProgress.current.has(cacheKey)) {
        recoloringInProgress.current.add(cacheKey);
        recolorImage(sourceToRecolor, colorRanges, targetColor, tintOptions)
          .then((recolored) => {
            setRecoloredSprites((prev) => ({
              ...prev,
              [cacheKey]: recolored,
            }));
          })
          .catch((err) => {
            console.error("Failed to recolor sprite:", err);
          })
          .finally(() => {
            recoloringInProgress.current.delete(cacheKey);
          });
      }

      // Return original/spritesheet while recoloring is in progress
      return {
        src: sourceToRecolor,
        isAnimated,
        config: spritesheetConfig,
      };
    },
    [
      needsRecoloring,
      targetColor,
      colorRanges,
      recoloredSprites,
      playerBodyColor,
    ]
  );

  // Backwards compatible wrapper for simple recoloring (ritual spritesheets, etc.)
  const getRecoloredSrc = useCallback(
    (originalSrc, isHit = false) => {
      return getSpriteRenderInfo(originalSrc, isHit).src;
    },
    [getSpriteRenderInfo]
  );

  // ============================================
  // SPRITESHEET ANIMATION STATE
  // PERFORMANCE: Sprite animation now handled by CSS (no React state needed)
  // ============================================
  const lastNonIdleSpriteRef = useRef(null);
  const idleHoldFramesRef = useRef(0);
  const IDLE_HOLD_FRAMES = 2;

  const [penguin, setPenguin] = useState({
    id: "",
    fighter: "",
    color: "",
    isJumping: false,
    isAttacking: false,
    isDodging: false,
    dodgeDirection: null,
    isStrafing: false,
    isBraking: false, // ICE PHYSICS: True when actively braking (digging in)
    isPowerSliding: false, // ICE PHYSICS: True when power sliding (C key held)
    isRawParrying: false,
    isReady: false,
    isHit: false,
    isDead: false,
    isSlapAttack: false,
    isThrowing: false,
    isGrabbing: false,
    isBeingGrabbed: false,
    isGrabBreaking: false,
    isGrabBreakCountered: false,
    isThrowingSalt: false,
    isThrowingSnowball: false,
    slapAnimation: 2,
    isBowing: false,
    isThrowTeching: false,
    isBeingPulled: false,
    isBeingPushed: false,
    grabState: null,
    grabAttemptType: null,
    isRecovering: false,
    isRawParryStun: false,
    isAtTheRopes: false,
    facing: 1,
    x: 0,
    y: 0,
    snowballs: [],
    snowballCooldown: false,
    lastSnowballTime: 0,
    pumoArmy: [],
    pumoArmyCooldown: false,
    isSpawningPumoArmy: false,
    activePowerUp: null,
    hitAbsorptionUsed: false,
    attackType: null,
    hitCounter: 0,
    isCrouchStance: false,
    isCrouchStrafing: false,
  });

  // PERFORMANCE: Use ref for interpolated position to avoid constant re-renders
  // Only update React state when position changes significantly
  const interpolatedPositionRef = useRef({ x: 0, y: 0 });
  const [interpolatedPosition, setInterpolatedPosition] = useState({
    x: 0,
    y: 0,
  });
  const previousState = useRef(null);
  const currentState = useRef(null);
  const lastUpdateTime = useRef(performance.now());
  const previousUpdateTime = useRef(0); // Tracks when the update before lastUpdateTime arrived
  const lastRenderUpdateTime = useRef(0);
  // PERFORMANCE: Only skip updates when position change is imperceptible
  // This gives smooth 60fps visuals while skipping redundant micro-updates
  const MIN_POSITION_CHANGE = 0.3; // pixels - skip if position changed less than this

  // ============================================
  // CLIENT-SIDE PREDICTION SYSTEM
  // For the local player only, we predict certain actions immediately
  // to eliminate perceived input lag. Server remains authoritative.
  // ============================================
  const predictedState = useRef({
    isSlapAttack: false,
    slapAnimation: 1,
    isAttacking: false,
    isDodging: false,
    dodgeDirection: null,
    isChargingAttack: false,
    isRawParrying: false,
    isGrabbing: false,
    // ICE PHYSICS: Movement predictions for responsive feel
    isPowerSliding: false,
    isBraking: false,
    timestamp: 0,
  });

  // Force re-render when predictions change (refs don't trigger re-renders)
  const [predictionTrigger, setPredictionTrigger] = useState(0);

  // Prediction timeout - clear predictions if server doesn't confirm within this time
  // Shorter timeout to prevent predictions from staying visible too long
  const PREDICTION_TIMEOUT_MS = 150; // 150ms max prediction window (about 2-3 server ticks)

  // Track if this is the local player
  const isLocalPlayer = player.id === localId;

  // ============================================
  // HELPER: Check if player can perform ANY action
  // This must match the server's canPlayerUseAction logic exactly
  // to prevent showing predictions for actions the server will reject
  // ============================================
  const canPredictAction = useCallback(
    (gameStarted) => {
      // CRITICAL: No actions allowed before game starts (hakkiyoi)
      if (!gameStarted) return false;

      // Check all blocking states that prevent ANY action
      return (
        // Core action states
        !penguin.isAttacking &&
        !penguin.isDodging &&
        !penguin.isThrowing &&
        !penguin.isBeingThrown &&
        !penguin.isGrabbing &&
        !penguin.isBeingGrabbed &&
        !penguin.isHit &&
        !penguin.isRawParryStun &&
        !penguin.isRawParrying &&
        !penguin.isThrowingSnowball &&
        !penguin.isAtTheRopes &&
        // Grab-related intermediate states
        !penguin.isGrabStartup &&
        !penguin.isGrabbingMovement &&
        !penguin.isWhiffingGrab &&
        !penguin.isGrabWhiffRecovery &&
        !penguin.isGrabTeching &&
        !penguin.isGrabBreaking &&
        !penguin.isGrabBreakCountered &&
        !penguin.isGrabBreakSeparating &&
        !penguin.isGrabClashing &&
        // Other action states
        !penguin.isThrowingSalt &&
        !penguin.isThrowTeching &&
        !penguin.isSpawningPumoArmy &&
        // Attack timing states
        !penguin.isInStartupFrames &&
        !penguin.isInEndlag &&
        // Recovery and ready states
        !penguin.isRecovering &&
        !penguin.canMoveToReady &&
        // Pre-game states
        !penguin.isReady &&
        !penguin.isBowing
        // NOTE: Power sliding no longer blocks actions - attacks cancel the slide
      );
    },
    [penguin]
  );

  // Helper: Check if player can dodge (more permissive - allows during charging)
  const canPredictDodge = useCallback(
    (gameStarted) => {
      if (!gameStarted) return false;

      return (
        !penguin.isAttacking &&
        !penguin.isDodging &&
        !penguin.isThrowing &&
        !penguin.isBeingThrown &&
        !penguin.isGrabbing &&
        !penguin.isBeingGrabbed &&
        !penguin.isHit &&
        !penguin.isRawParryStun &&
        !penguin.isRawParrying &&
        !penguin.isThrowingSnowball &&
        !penguin.isAtTheRopes &&
        !penguin.isGrabStartup &&
        !penguin.isGrabbingMovement &&
        !penguin.isWhiffingGrab &&
        !penguin.isGrabWhiffRecovery &&
        !penguin.isGrabTeching &&
        !penguin.isGrabBreaking &&
        !penguin.isGrabBreakCountered &&
        !penguin.isGrabBreakSeparating &&
        !penguin.isGrabClashing &&
        !penguin.isThrowingSalt &&
        !penguin.isThrowTeching &&
        !penguin.isSpawningPumoArmy &&
        !penguin.isInStartupFrames &&
        !penguin.isInEndlag &&
        !penguin.isRecovering &&
        !penguin.canMoveToReady &&
        !penguin.isReady &&
        !penguin.isBowing
        // NOTE: isChargingAttack NOT checked - dodge is allowed during charge
      );
    },
    [penguin]
  );

  // Function to apply a prediction (called from Game.jsx via callback)
  const applyPrediction = useCallback(
    (action) => {
      if (!isLocalPlayer) return;

      // Get game started state from action (passed from Game.jsx)
      const gameStarted = action.gameStarted;

      const now = performance.now();

      // OPTIMIZATION: Track if prediction actually changed to avoid unnecessary re-renders
      let predictionChanged = false;

      switch (action.type) {
        case "slap":
          // Only predict if we can perform actions AND not already charging
          if (canPredictAction(gameStarted) && !penguin.isChargingAttack) {
            predictedState.current = {
              ...predictedState.current,
              isSlapAttack: true,
              isAttacking: true,
              slapAnimation: predictedState.current.slapAnimation === 1 ? 2 : 1,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isChargingAttack: false,
              isDodging: false,
              isRawParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "charge_start":
          if (canPredictAction(gameStarted)) {
            predictedState.current = {
              ...predictedState.current,
              isChargingAttack: true,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isSlapAttack: false,
              isAttacking: false,
              isDodging: false,
              isRawParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "charge_release":
          // Only predict release if we were charging
          if (
            penguin.isChargingAttack ||
            predictedState.current.isChargingAttack
          ) {
            // CRITICAL: If dodging, don't predict isAttacking - server stores it as pending
            // and executes AFTER dodge ends. Setting isAttacking during dodge causes
            // attack animation to show during dodge.
            const isDodging =
              penguin.isDodging || predictedState.current.isDodging;
            predictedState.current = {
              ...predictedState.current,
              isChargingAttack: false,
              // Only predict attack if NOT dodging - during dodge, server stores as pending
              isAttacking: !isDodging,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isSlapAttack: false,
              // Don't clear dodge state - let dodge continue visually
              isDodging: predictedState.current.isDodging,
              isRawParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "dodge":
          // Dodge has special rules - allowed during charging
          if (canPredictDodge(gameStarted)) {
            predictedState.current = {
              ...predictedState.current,
              isDodging: true,
              dodgeDirection: action.direction || penguin.facing,
              // CRITICAL: Dodge cancels charging - clear it to prevent visual flicker
              isChargingAttack: false,
              isAttacking: false,
              isSlapAttack: false,
              isRawParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "parry_start":
          if (canPredictAction(gameStarted) && !penguin.isChargingAttack) {
            predictedState.current = {
              ...predictedState.current,
              isRawParrying: true,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isChargingAttack: false,
              isAttacking: false,
              isSlapAttack: false,
              isDodging: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "parry_release":
          // Only clear parry if we were parrying
          if (penguin.isRawParrying || predictedState.current.isRawParrying) {
            predictedState.current = {
              ...predictedState.current,
              isRawParrying: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "grab":
          if (canPredictAction(gameStarted) && !penguin.isChargingAttack) {
            predictedState.current = {
              ...predictedState.current,
              isGrabbing: true,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isChargingAttack: false,
              isAttacking: false,
              isSlapAttack: false,
              isDodging: false,
              isRawParrying: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "power_slide_start":
          // Predict power sliding when C/CTRL pressed
          // Must match server's canPowerSlide conditions (server-io/index.js line 2898)
          // NOTE: isChargingAttack is NOT blocked - can power slide while charging!
          // CRITICAL: gameStarted check prevents visual squish before hakkiyoi and after match ends
          // CRITICAL: velocity check prevents visual squish when standing still or moving too slow
          // NOTE: We allow prediction when isRecovering or when charged attack (so charged HIT -> power slide works)
          const SLIDE_MIN_VELOCITY = 0.5; // Must match server (server-io/index.js line 209)
          const hasEnoughVelocity =
            Math.abs(penguin.movementVelocity || 0) >= SLIDE_MIN_VELOCITY;
          const blockSlideForAttack =
            penguin.isAttacking && penguin.isSlapAttack; // Only block for slap, allow for charged
          if (
            gameStarted &&
            hasEnoughVelocity &&
            !penguin.isDodging &&
            !penguin.isThrowing &&
            !penguin.isGrabbing &&
            !penguin.isWhiffingGrab &&
            !blockSlideForAttack &&
            !penguin.isRawParrying &&
            !penguin.isHit &&
            !penguin.isBeingGrabbed &&
            !penguin.isBeingThrown &&
            !penguin.isAtTheRopes &&
            !penguin.isGrabClashing &&
            !penguin.isGrabBreaking &&
            !penguin.isGrabBreakSeparating &&
            // Check we're not already predicting power slide
            !predictedState.current.isPowerSliding
          ) {
            predictedState.current = {
              ...predictedState.current,
              isPowerSliding: true,
              isBraking: false,
              // CRITICAL: Clear stale attack predictions to prevent chargedAttack animation flash.
              // charge_release sets isAttacking=true and if the prediction expires without being
              // cleared (e.g. victim handler never ran), the stale isAttacking persists in the ref.
              // When isPowerSliding gets cleared by reconciliation (~50ms), the stale isAttacking
              // would leak through the merge and briefly show the attack animation.
              isAttacking: false,
              isSlapAttack: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "power_slide_end":
          // Clear power sliding prediction when C/CTRL released (only if was predicting).
          // During recovery or while server still has charged attack (e.g. right after charged hit),
          // don't clear so we keep showing power slide until that state ends.
          const inChargedAttackOrRecoveryEnd =
            penguin.isRecovering ||
            (penguin.isAttacking && !penguin.isSlapAttack);
          if (
            predictedState.current.isPowerSliding &&
            !inChargedAttackOrRecoveryEnd
          ) {
            predictedState.current = {
              ...predictedState.current,
              isPowerSliding: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "brake_start":
          // Predict braking when holding opposite direction while sliding
          if (
            !penguin.isAttacking &&
            !penguin.isDodging &&
            !penguin.isGrabbing &&
            !penguin.isBeingGrabbed &&
            !penguin.isRawParrying &&
            !penguin.isHit &&
            !penguin.isPowerSliding &&
            !predictedState.current.isPowerSliding &&
            !predictedState.current.isBraking
          ) {
            predictedState.current = {
              ...predictedState.current,
              isBraking: true,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "brake_end":
          // Clear braking prediction (only if was predicting)
          if (predictedState.current.isBraking) {
            predictedState.current = {
              ...predictedState.current,
              isBraking: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "clear":
          // Clear all predictions
          predictedState.current = {
            isSlapAttack: false,
            slapAnimation: predictedState.current.slapAnimation,
            isAttacking: false,
            isDodging: false,
            dodgeDirection: null,
            isChargingAttack: false,
            isRawParrying: false,
            isGrabbing: false,
            isPowerSliding: false,
            isBraking: false,
            timestamp: 0,
          };
          predictionChanged = true;
          break;
        default:
          break;
      }

      // OPTIMIZATION: Only force re-render if prediction actually changed
      if (predictionChanged) {
        setPredictionTrigger((prev) => prev + 1);
      }
    },
    [
      isLocalPlayer,
      canPredictAction,
      canPredictDodge,
      penguin.isChargingAttack,
      penguin.isRawParrying,
      penguin.facing,
      penguin.isAttacking,
      penguin.isDodging,
      penguin.isGrabbing,
      penguin.isBeingGrabbed,
      penguin.isHit,
      penguin.isRecovering,
      penguin.isAtTheRopes,
      penguin.isPowerSliding,
      penguin.isThrowing,
      penguin.isWhiffingGrab,
      penguin.isBeingThrown,
      penguin.isGrabClashing,
      penguin.isGrabBreaking,
      penguin.isGrabBreakSeparating,
    ]
  );

  // Get the display state (merges server state with predictions for local player)
  const getDisplayState = useCallback(() => {
    const now = performance.now();
    const prediction = predictedState.current;

    // For non-local players, just return server state
    if (!isLocalPlayer) {
      return penguin;
    }

    // Check if prediction has expired
    const predictionAge = now - prediction.timestamp;
    const expired =
      prediction.timestamp === 0 || predictionAge > PREDICTION_TIMEOUT_MS;
    if (expired) {
      // Don't expire power slide while charged attack or recovery - otherwise we'd show attack sprite
      const inChargedAttackOrRecovery =
        penguin.isRecovering || (penguin.isAttacking && !penguin.isSlapAttack);
      if (prediction.isPowerSliding && inChargedAttackOrRecovery) {
        predictedState.current.timestamp = now; // Refresh so we keep merging with isPowerSliding true
      } else {
        return penguin;
      }
    }

    // Server state takes priority if it shows a conflicting state
    // (e.g., server says we got hit, trust that over our attack prediction)
    const inVictimOrBlockingState =
      penguin.isHit ||
      penguin.isBeingGrabbed ||
      penguin.isBeingThrown ||
      penguin.isRawParryStun ||
      penguin.isAtTheRopes ||
      penguin.isRecovering ||
      penguin.isGrabBreaking ||
      penguin.isGrabBreakCountered ||
      penguin.isThrowTeching ||
      penguin.isDead ||
      penguin.isThrowing ||
      penguin.isGrabbing;
    if (inVictimOrBlockingState) {
      // Clear predictions when server shows victim/blocking state - but preserve power slide
      // during recovery (or while charged attack still in state) so charged-attack -> power slide
      // doesn't flicker to attack animation. After a charged HIT the server sets isAttacking=false
      // and isRecovering=true; preserve also when isAttacking (charged) so we don't clear on the
      // frame where hit was applied but isRecovering hasn't arrived yet.
      const inChargedAttackOrRecovery =
        penguin.isRecovering || (penguin.isAttacking && !penguin.isSlapAttack);
      const keepPowerSlide =
        inChargedAttackOrRecovery && prediction.isPowerSliding;
      predictedState.current = {
        isSlapAttack: false,
        slapAnimation: predictedState.current.slapAnimation,
        isAttacking: false,
        isDodging: false,
        dodgeDirection: null,
        isChargingAttack: false,
        isRawParrying: false,
        isGrabbing: false,
        isPowerSliding: keepPowerSlide ? true : false,
        isBraking: keepPowerSlide ? predictedState.current.isBraking : false,
        // Refresh timestamp so prediction doesn't expire (150ms) while we're in recovery
        timestamp: keepPowerSlide ? now : 0,
      };
      if (!keepPowerSlide) return penguin;
      // Fall through so we merge and return display state with isPowerSliding true
    }

    // CRITICAL: If server shows action has ENDED but we predicted it's active,
    // the server is authoritative - clear the prediction
    // This prevents "stuck" visual states

    // If we predicted slap but server says no slap AND no attacking, server wins
    if (
      prediction.isSlapAttack &&
      !penguin.isSlapAttack &&
      !penguin.isAttacking
    ) {
      predictedState.current.isSlapAttack = false;
      predictedState.current.isAttacking = false;
    }
    // If server CONFIRMS the action, also clear prediction (server has correct timing)
    else if (prediction.isSlapAttack && penguin.isSlapAttack) {
      predictedState.current.isSlapAttack = false;
      predictedState.current.isAttacking = false;
    }

    // Charged attack: If we predicted attacking (non-slap) but server says not attacking
    // AND not charging, the server has moved past the attack - clear stale prediction.
    // Use predictionAge > 100ms to give the server time to confirm the attack initially.
    if (
      prediction.isAttacking &&
      !prediction.isSlapAttack &&
      !penguin.isAttacking &&
      !penguin.isChargingAttack &&
      predictionAge > 100
    ) {
      predictedState.current.isAttacking = false;
    }

    // Dodge: If server says no dodge, trust server
    if (prediction.isDodging && !penguin.isDodging) {
      predictedState.current.isDodging = false;
    }

    // Charging: If server says no charging, trust server
    if (prediction.isChargingAttack && !penguin.isChargingAttack) {
      predictedState.current.isChargingAttack = false;
    }

    // Parrying: If server says no parrying, trust server
    if (prediction.isRawParrying && !penguin.isRawParrying) {
      predictedState.current.isRawParrying = false;
    }

    // Grabbing: If server says no grabbing, trust server
    if (prediction.isGrabbing && !penguin.isGrabbing) {
      predictedState.current.isGrabbing = false;
    }

    // ICE PHYSICS: Power sliding reconciliation
    // If server says sliding, clear our prediction (server confirmed)
    // If server says no sliding but we predicted it, trust server after a delay - unless we're
    // in recovery (charged attack), in which case keep showing power slide until recovery ends
    if (prediction.isPowerSliding && penguin.isPowerSliding) {
      predictedState.current.isPowerSliding = false; // Server confirmed, clear prediction
    } else if (prediction.isPowerSliding && !penguin.isPowerSliding) {
      // Don't clear while recovering or while server still has charged attack (e.g. right after hit)
      const inChargedAttackOrRecovery =
        penguin.isRecovering || (penguin.isAttacking && !penguin.isSlapAttack);
      if (!inChargedAttackOrRecovery && predictionAge > 50) {
        predictedState.current.isPowerSliding = false;
      }
    }

    // Braking reconciliation
    if (prediction.isBraking && penguin.isBraking) {
      predictedState.current.isBraking = false; // Server confirmed
    } else if (prediction.isBraking && !penguin.isBraking) {
      if (predictionAge > 50) {
        predictedState.current.isBraking = false;
      }
    }

    // Re-check if all predictions are cleared
    const p = predictedState.current;
    if (
      !p.isSlapAttack &&
      !p.isAttacking &&
      !p.isDodging &&
      !p.isChargingAttack &&
      !p.isRawParrying &&
      !p.isGrabbing &&
      !p.isPowerSliding &&
      !p.isBraking
    ) {
      // All predictions cleared, just return server state
      return penguin;
    }

    // Merge remaining predicted state with server state
    // Predictions override server state for visual display only
    return {
      ...penguin,
      isSlapAttack: p.isSlapAttack || penguin.isSlapAttack,
      slapAnimation: p.isSlapAttack ? p.slapAnimation : penguin.slapAnimation,
      isAttacking: p.isAttacking || penguin.isAttacking,
      isDodging: p.isDodging || penguin.isDodging,
      dodgeDirection: p.isDodging ? p.dodgeDirection : penguin.dodgeDirection,
      isChargingAttack: p.isChargingAttack || penguin.isChargingAttack,
      isRawParrying: p.isRawParrying || penguin.isRawParrying,
      isGrabbing: p.isGrabbing || penguin.isGrabbing,
      // ICE PHYSICS: Movement predictions
      isPowerSliding: p.isPowerSliding || penguin.isPowerSliding,
      isBraking: p.isBraking || penguin.isBraking,
    };
  }, [isLocalPlayer, penguin]);

  // Expose the prediction function via the prop ref that Game.jsx can access
  // This allows Game.jsx to call applyPrediction() directly when input occurs
  useEffect(() => {
    if (predictionRef && isLocalPlayer) {
      predictionRef.current = { applyPrediction };
    }
  }, [predictionRef, isLocalPlayer, applyPrediction]);

  // Store both players' data for UI (only needed for first component)
  const [allPlayersData, setAllPlayersData] = useState({
    player1: null,
    player2: null,
  });
  const [hakkiyoi, setHakkiyoi] = useState(false);
  const [gyojiCall, setGyojiCall] = useState(null); // Gyoji's call before HAKKIYOI (e.g., "TE WO TSUITE!")
  const [gyojiState, setGyojiState] = useState("idle");
  const [gameOver, setGameOver] = useState(false);
  const [showRoundResult, setShowRoundResult] = useState(false); // Deferred from gameOver to prevent freeze
  const showRoundResultRafRef = useRef(null); // Track rAF so we can cancel on reset
  // PERFORMANCE: Pre-warm RoundResult styled-components CSS on mount.
  // Rendering both variants (victory/defeat) for 1 frame forces styled-components to
  // generate and inject all ~15 CSS classes into the <style> tag. These persist even
  // after the components unmount, so the real RoundResult mounts instantly on win.
  const [warmupRoundResult, setWarmupRoundResult] = useState(index === 0);
  const [winner, setWinner] = useState("");
  const [playerOneWinCount, setPlayerOneWinCount] = useState(0);
  const [playerTwoWinCount, setPlayerTwoWinCount] = useState(0);
  const [roundHistory, setRoundHistory] = useState([]); // Track order of wins: ["player1", "player2", "player1", ...]
  const [matchOver, setMatchOver] = useState(false);
  const [parryEffectPosition, setParryEffectPosition] = useState(null);
  const [hitEffectPosition, setHitEffectPosition] = useState(null);
  const [rawParryEffectPosition, setRawParryEffectPosition] = useState(null);
  const [p1ParryRefund, setP1ParryRefund] = useState(0);
  const [p2ParryRefund, setP2ParryRefund] = useState(0);
  const [showStarStunEffect, setShowStarStunEffect] = useState(false);
  const [hasUsedPowerUp, setHasUsedPowerUp] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const countdownRef = useRef(null);
  const [screenShake, setScreenShake] = useState({
    intensity: 0,
    duration: 0,
    startTime: 0,
  });
  const [allSnowballs, setAllSnowballs] = useState([]);
  const snowballDomRefs = useRef({});
  const [allPumoArmies, setAllPumoArmies] = useState([]);

  const [thickBlubberEffect, setThickBlubberEffect] = useState({
    isActive: false,
    x: 0,
    y: 0,
  });
  const [thickBlubberIndicator, setThickBlubberIndicator] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(3);
  const [uiRoundId, setUiRoundId] = useState(0);

  // New enhanced effects state
  const [grabBreakEffectPosition, setGrabBreakEffectPosition] = useState(null);
  const [grabTechEffectPosition, setGrabTechEffectPosition] = useState(null);
  const [counterGrabEffectPosition, setCounterGrabEffectPosition] =
    useState(null);
  const [punishBannerPosition, setPunishBannerPosition] = useState(null);
  const [snowballImpactPosition, setSnowballImpactPosition] = useState(null);
  const [counterHitEffectPosition, setCounterHitEffectPosition] =
    useState(null);

  // Grab clash state - track when both players are in a grab clash
  const [isGrabClashActive, setIsGrabClashActive] = useState(false);

  // "No Stamina" effect - shows when player tries to use action without enough stamina
  const [noStaminaEffectKey, setNoStaminaEffectKey] = useState(0);

  // Ritual animation state - sprite sheet based animation
  const [ritualPart, setRitualPart] = useState(0);
  const [ritualFrame, setRitualFrame] = useState(0);
  const ritualIntervalRef = useRef(null);

  // Get current ritual sprite config based on current part
  // Use server state (isInRitualPhase) to determine if config should be returned
  const ritualSpriteConfig = useMemo(() => {
    if (!penguin.isInRitualPhase) return null;
    const configs =
      index === 0 ? ritualSpritesheetsPlayer1 : ritualSpritesheetsPlayer2;
    return configs[ritualPart];
  }, [penguin.isInRitualPhase, index, ritualPart]);

  // For backward compatibility with existing code that checks ritualAnimationSrc
  // Use server state to determine if this specific player is in ritual phase
  // This allows each player to independently show/hide ritual based on their own state
  const shouldShowRitualForPlayer = penguin.isInRitualPhase === true;
  const ritualAnimationSrc = shouldShowRitualForPlayer ? "sprite" : null;

  const trackedCounterGrabEffectPosition = useMemo(() => {
    if (!counterGrabEffectPosition) return null;
    if (index !== 0) return counterGrabEffectPosition;

    const { grabberId, grabbedId } = counterGrabEffectPosition;
    if (!grabberId || !grabbedId) return counterGrabEffectPosition;

    const player1 = allPlayersData.player1;
    const player2 = allPlayersData.player2;
    if (!player1 || !player2) return counterGrabEffectPosition;

    const grabbed =
      player1.id === grabbedId
        ? player1
        : player2.id === grabbedId
        ? player2
        : null;

    if (!grabbed) return counterGrabEffectPosition;

    return {
      ...counterGrabEffectPosition,
      x: grabbed.x + SPRITE_HALF_W,
      y: PLAYER_MID_Y,
    };
  }, [counterGrabEffectPosition, allPlayersData, index]);

  // Exact sprite source used for the main fighter image so masks always match
  const currentSpriteSrc = useMemo(() => {
    return getImageSrc(
      penguin.fighter,
      penguin.isDiving,
      penguin.isJumping,
      penguin.isAttacking,
      penguin.isDodging,
      penguin.isStrafing,
      penguin.isRawParrying,
      penguin.isGrabBreaking,
      penguin.isReady,
      penguin.isHit,
      penguin.isDead,
      penguin.isSlapAttack,
      penguin.isThrowing,
      penguin.isGrabbing,
      penguin.isGrabbingMovement,
      penguin.isBeingGrabbed,
      penguin.isThrowingSalt,
      penguin.slapAnimation,
      penguin.isBowing,
      penguin.isThrowTeching,
      penguin.isBeingPulled,
      penguin.isBeingPushed,
      penguin.grabState,
      penguin.grabAttemptType,
      penguin.isRecovering,
      penguin.isRawParryStun,
      penguin.isRawParrySuccess,
      penguin.isPerfectRawParrySuccess,
      penguin.isThrowingSnowball,
      penguin.isSpawningPumoArmy,
      penguin.isAtTheRopes,
      penguin.isCrouchStance,
      penguin.isCrouchStrafing,
      penguin.isPowerSliding,
      penguin.isGrabBreakCountered,
      penguin.isGrabbingMovement,
      isGrabClashActive,
      penguin.isAttemptingGrabThrow,
      ritualAnimationSrc, // Pass ritual animation if active
      // New grab action system states
      penguin.isGrabPushing,
      penguin.isBeingGrabPushed,
      penguin.isAttemptingPull,
      penguin.isBeingPullReversaled,
      penguin.isGrabSeparating,
      penguin.isGrabBellyFlopping,
      penguin.isBeingGrabBellyFlopped,
      penguin.isGrabFrontalForceOut,
      penguin.isBeingGrabFrontalForceOut,
      penguin.isGrabTeching,
      penguin.grabTechRole,
      penguin.isGrabWhiffRecovery
    );
  }, [
    penguin.fighter,
    penguin.isDiving,
    penguin.isJumping,
    penguin.isAttacking,
    penguin.isDodging,
    penguin.isStrafing,
    penguin.isRawParrying,
    penguin.isGrabBreaking,
    penguin.isReady,
    penguin.isHit,
    penguin.isDead,
    penguin.isSlapAttack,
    penguin.isThrowing,
    penguin.isGrabbing,
    penguin.isGrabbingMovement,
    penguin.isBeingGrabbed,
    penguin.isThrowingSalt,
    penguin.slapAnimation,
    penguin.isBowing,
    penguin.isThrowTeching,
    penguin.isBeingPulled,
    penguin.isBeingPushed,
    penguin.grabState,
    penguin.grabAttemptType,
    penguin.isRecovering,
    penguin.isRawParryStun,
    penguin.isRawParrySuccess,
    penguin.isPerfectRawParrySuccess,
    penguin.isThrowingSnowball,
    penguin.isSpawningPumoArmy,
    penguin.isAtTheRopes,
    penguin.isCrouchStance,
    penguin.isCrouchStrafing,
    penguin.isPowerSliding,
    penguin.isGrabBreakCountered,
    penguin.isGrabbingMovement,
    isGrabClashActive,
    penguin.isAttemptingGrabThrow,
    ritualAnimationSrc,
    // New grab action system states
    penguin.isGrabPushing,
    penguin.isBeingGrabPushed,
    penguin.isAttemptingPull,
    penguin.isBeingPullReversaled,
    penguin.isGrabSeparating,
    penguin.isGrabBellyFlopping,
    penguin.isBeingGrabBellyFlopped,
    penguin.isGrabFrontalForceOut,
    penguin.isBeingGrabFrontalForceOut,
    penguin.isGrabTeching,
    penguin.grabTechRole,
    penguin.isGrabWhiffRecovery,
  ]);

  // PERFORMANCE: Remove RoundResult warmup after styled-components CSS is generated.
  // Rendering both victory/defeat variants for 2 frames generates all CSS classes.
  // After that, the hidden warmup is removed to avoid wasting animation CPU.
  useEffect(() => {
    if (!warmupRoundResult) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWarmupRoundResult(false);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [warmupRoundResult]);

  // Ritual sprite sheet animation - runs entirely on interval, no effect restarts
  // Use server state (isInRitualPhase) to determine if this player should show ritual
  useEffect(() => {
    if (!penguin.isInRitualPhase) {
      setRitualPart(0);
      setRitualFrame(0);
      if (ritualIntervalRef.current) {
        clearInterval(ritualIntervalRef.current);
        ritualIntervalRef.current = null;
      }
      return;
    }

    const configs =
      index === 0 ? ritualSpritesheetsPlayer1 : ritualSpritesheetsPlayer2;
    const shouldPlaySound = true; // Both players play claps during ritual

    // Local state that persists across interval calls
    let currentPart = 0;
    let currentFrame = 0;
    let soundPlayedThisPart = false;
    let holdFrames = 0; // Extra frames to hold on last frame before transitioning

    // Initialize
    setRitualPart(0);
    setRitualFrame(0);

    ritualIntervalRef.current = setInterval(() => {
      const config = configs[currentPart];

      // If we're holding on last frame, count down
      if (holdFrames > 0) {
        holdFrames--;
        if (holdFrames === 0) {
          // Now actually transition
          currentFrame = 0;
          currentPart = (currentPart + 1) % 4;
          soundPlayedThisPart = false;
          setRitualPart(currentPart);
          setRitualFrame(0);
        }
        return; // Don't advance frame while holding
      }

      // Play clap sound near the end of each part
      const framesRemaining = config.frameCount - currentFrame - 1;
      const frameDuration = 1000 / config.fps;
      const timeRemaining = framesRemaining * frameDuration;
      if (
        shouldPlaySound &&
        !soundPlayedThisPart &&
        timeRemaining <= CLAP_SOUND_OFFSET
      ) {
        soundPlayedThisPart = true;
        const randomIndex = Math.floor(Math.random() * ritualClapSounds.length);
        const selectedSound = ritualClapSounds[randomIndex];
        // clap2Sound is louder, so reduce its volume more
        const volumeMultiplier = selectedSound === clap2Sound ? 0.01 : 0.02;
        // Use audio pool via playSound instead of creating new Audio objects
        playSound(selectedSound, volumeMultiplier);
      }

      // Advance frame
      currentFrame++;

      // Check if we've reached the last frame
      if (currentFrame >= config.frameCount - 1) {
        // Show the last frame and hold for 2 extra ticks before transitioning
        setRitualFrame(config.frameCount - 1);
        holdFrames = 2; // Hold for 2 interval ticks (~140ms buffer)
        return;
      }

      setRitualFrame(currentFrame);
    }, 1000 / 14); // Run at 14fps (71ms interval)

    return () => {
      if (ritualIntervalRef.current) {
        clearInterval(ritualIntervalRef.current);
        ritualIntervalRef.current = null;
      }
    };
  }, [penguin.isInRitualPhase, index]);

  // ============================================
  // FIGHTER SPRITE ANIMATION
  // PERFORMANCE: Now using CSS-based animation instead of setInterval
  // This avoids 30-40 React re-renders per second per animated sprite
  // ============================================

  // Simply returns the config - CSS animation handles the frame cycling
  const updateSpriteAnimation = useCallback((spriteSrc) => {
    return getSpritesheetConfig(spriteSrc);
  }, []);

  // Fallback interval if we don't have two update timestamps yet
  const SERVER_UPDATE_INTERVAL = 1000 / SERVER_BROADCAST_HZ;

  // Interpolation function for smooth movement (supports factor > 1 for extrapolation)
  const interpolatePosition = useCallback((prevPos, currentPos, factor) => {
    // Don't interpolate discrete jumps — if the position jumped more than 100px
    // in a single update, it's a teleport/reset, not continuous movement.
    // All rapid-movement states (dodging, knockback, throws, pull hops) move
    // well under 100px per 32Hz update cycle, so they get smooth interpolation.
    const maxInterpolationDistance = 100;
    const distance =
      Math.abs(currentPos.x - prevPos.x) + Math.abs(currentPos.y - prevPos.y);

    if (distance > maxInterpolationDistance) {
      return currentPos;
    }

    return {
      x: prevPos.x + (currentPos.x - prevPos.x) * factor,
      y: prevPos.y + (currentPos.y - prevPos.y) * factor,
    };
  }, []);

  // MEMORY FIX: Ref for interpolation loop cleanup on unmount
  const interpolationIdRef = useRef(null);

  // Animation loop for interpolation - ADAPTIVE TIMING
  // Uses actual measured interval between server updates (not a hardcoded constant)
  // and allows mild extrapolation (factor > 1) so position keeps moving smoothly
  // between server updates instead of freezing when interpolation factor hits 1.
  const interpolationLoop = useCallback(
    (timestamp) => {
      let newPos = null;

      if (currentState.current && previousState.current) {
        const timeSinceUpdate = timestamp - lastUpdateTime.current;

        // Use the actual measured interval between the last two server updates.
        // This makes interpolation rate-agnostic: works equally well at 32Hz or 64Hz.
        const actualInterval =
          lastUpdateTime.current - previousUpdateTime.current;
        const effectiveInterval =
          actualInterval > 5 ? actualInterval : SERVER_UPDATE_INTERVAL;

        // Allow mild extrapolation (up to 25% past the target) so position
        // continues moving smoothly while waiting for the next server update.
        // Without this, the position freezes at factor=1 and the sprite stutters.
        const interpolationFactor = Math.min(
          timeSinceUpdate / effectiveInterval,
          1.25
        );

        newPos = interpolatePosition(
          { x: previousState.current.x, y: previousState.current.y },
          { x: currentState.current.x, y: currentState.current.y },
          interpolationFactor
        );
      } else if (currentState.current) {
        newPos = {
          x: currentState.current.x,
          y: currentState.current.y,
        };
      }

      if (newPos) {
        const prevPos = interpolatedPositionRef.current;
        interpolatedPositionRef.current = newPos;

        // PERFORMANCE: Only update React state if position changed noticeably
        const positionDelta =
          Math.abs(newPos.x - prevPos.x) + Math.abs(newPos.y - prevPos.y);
        if (positionDelta >= MIN_POSITION_CHANGE) {
          setInterpolatedPosition(newPos);
        }
      }

      interpolationIdRef.current = requestAnimationFrame(interpolationLoop);
    },
    [interpolatePosition, MIN_POSITION_CHANGE]
  );

  // Start interpolation loop
  useEffect(() => {
    interpolationIdRef.current = requestAnimationFrame(interpolationLoop);
    return () => {
      if (interpolationIdRef.current) {
        cancelAnimationFrame(interpolationIdRef.current);
        interpolationIdRef.current = null;
      }
    };
  }, [interpolationLoop]);

  // Smooth interpolation with predictive positioning for better feel
  const getDisplayPosition = useCallback(() => {
    // If no interpolation data is available yet, fall back to server position
    let position;
    if (!interpolatedPosition.x && !interpolatedPosition.y && penguin.x) {
      position = { x: penguin.x, y: penguin.y };
    } else {
      position = interpolatedPosition;
    }

    // During grab clash, move players closer together for more intense overlap
    if (isGrabClashActive) {
      const CLASH_PULL_DISTANCE = 20; // pixels to move toward opponent
      // Move OPPOSITE to facing direction to get closer to opponent
      // If facing right (1), move left (negative) toward opponent on left
      // If facing left (-1), move right (positive) toward opponent on right
      const pullOffset = -penguin.facing * CLASH_PULL_DISTANCE;
      return {
        x: position.x + pullOffset,
        y: position.y,
      };
    }

    return position;
  }, [
    interpolatedPosition,
    penguin.x,
    penguin.y,
    isGrabClashActive,
    penguin.facing,
  ]);

  // Function to handle exiting from disconnected game
  const handleExitDisconnectedGame = useCallback(() => {
    // Emit exit event to server
    if (disconnectedRoomId) {
      socket.emit("exit_disconnected_game", { roomId: disconnectedRoomId });
    }

    // Stop all music immediately
    stopEeshi();
    if (gameMusicRef.current) {
      gameMusicRef.current.pause();
      gameMusicRef.current.currentTime = 0;
    }

    // Clear any active timers
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Reset disconnect state
    onResetDisconnectState();

    // Navigate to main menu (use correct page name)
    setCurrentPage("mainMenu");
  }, [socket, disconnectedRoomId, onResetDisconnectState, setCurrentPage]);

  // Handle automatic exit after opponent disconnection
  useEffect(() => {
    if (opponentDisconnected && player.id === localId) {
      setDisconnectCountdown(3);

      const countdownInterval = setInterval(() => {
        setDisconnectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            handleExitDisconnectedGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [opponentDisconnected, player.id, localId, handleExitDisconnectedGame]);

  // Stop eeshi music when opponent disconnects
  useEffect(() => {
    if (opponentDisconnected) {
      stopEeshi();
    }
  }, [opponentDisconnected]);

  const lastAttackState = useRef(false);
  const lastHitState = useRef(false);
  const lastThrowingSaltState = useRef(false);
  const saltParticleTimerRef = useRef(null);
  const lastThrowState = useRef(false);
  const lastDodgeState = useRef(false);
  const lastDodgeLandState = useRef(false);
  const lastDodgeLandParticleState = useRef(false);
  const lastGrabState = useRef(false);
  const lastThrowingSnowballState = useRef(false);
  const lastSpawningPumoArmyState = useRef(false);
  const lastRawParryState = useRef(false);
  const lastRawParryStunState = useRef(false);
  const lastWinnerState = useRef(false);
  const lastWinnerSoundPlay = useRef(0);
  const strafingSoundRef = useRef(null);
  const lastPlayerHitTime = useRef(0);
  const lastRawParryTime = useRef(0);
  const hitTintFramesRemaining = useRef(0); // Show hit tint for first N frames of isHit so red is visible (1 frame was too short)
  const gameMusicRef = useRef(null);
  const eeshiMusicRef = useRef(null);

  const startEeshi = useCallback(() => {
    if (eeshiMusicRef.current) return;
    eeshiMusicRef.current = createCrossfadeLoop(eeshiMusic, 0.018 * getGlobalVolume(), 1.5);
  }, []);

  const stopEeshi = useCallback(() => {
    if (eeshiMusicRef.current) {
      eeshiMusicRef.current.stop();
      eeshiMusicRef.current = null;
    }
  }, []);
  const duckTimerRef = useRef(null);
  const musicBaseVolume = useRef(0.029);

  const duckMusic = useCallback((intensity = 0.3, durationMs = 400) => {
    const music = gameMusicRef.current;
    if (!music || music.paused) return;

    if (duckTimerRef.current) cancelAnimationFrame(duckTimerRef.current);

    const baseVol = musicBaseVolume.current;
    const duckedVol = baseVol * intensity;
    music.volume = duckedVol;

    const startTime = performance.now();
    const recover = (now) => {
      const elapsed = now - startTime;
      if (elapsed >= durationMs) {
        music.volume = baseVol;
        duckTimerRef.current = null;
        return;
      }
      const t = elapsed / durationMs;
      music.volume = duckedVol + (baseVol - duckedVol) * t * t;
      duckTimerRef.current = requestAnimationFrame(recover);
    };
    duckTimerRef.current = requestAnimationFrame(recover);
  }, []);

  // Add performance optimizations
  const frameRate = useRef(60);
  const lastFrameTime = useRef(performance.now());
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(performance.now());
  const animateIdRef = useRef(null);

  // Optimize animation frame with actual usage
  // MEMORY FIX: Store animation ID in ref so cleanup can cancel the actual pending frame
  const animate = useCallback((timestamp) => {
    animateIdRef.current = requestAnimationFrame(animate);

    // Calculate delta time for smooth animations
    lastFrameTime.current = timestamp;

    // Update FPS counter every second
    frameCount.current++;
    if (timestamp - lastFpsUpdate.current >= 1000) {
      frameRate.current = frameCount.current;
      frameCount.current = 0;
      lastFpsUpdate.current = timestamp;
    }
  }, []);

  useEffect(() => {
    animateIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (animateIdRef.current) {
        cancelAnimationFrame(animateIdRef.current);
        animateIdRef.current = null;
      }
    };
  }, [animate]);

  // PERFORMANCE: Refs to store accumulated player state for delta merging
  const accumulatedPlayer1State = useRef(null);
  const accumulatedPlayer2State = useRef(null);

  // Memoize frequently accessed socket listeners to prevent recreation
  const handleFighterAction = useCallback(
    (data) => {
      const currentTime = performance.now();

      // PERFORMANCE: Handle delta updates by merging with existing state
      // Server sends isDelta: true when only changed properties are included
      let player1Data, player2Data;

      if (
        data.isDelta &&
        accumulatedPlayer1State.current &&
        accumulatedPlayer2State.current
      ) {
        // Merge delta with accumulated state (only if we have previous state)
        player1Data = { ...accumulatedPlayer1State.current, ...data.player1 };
        player2Data = { ...accumulatedPlayer2State.current, ...data.player2 };
      } else {
        // First update or full update - use as-is
        // Delta updates contain all essential properties on first send
        player1Data = data.player1;
        player2Data = data.player2;
      }

      // Store accumulated state for next delta merge
      accumulatedPlayer1State.current = player1Data;
      accumulatedPlayer2State.current = player2Data;

      // Store both players' data for UI (only for first component)
      if (index === 0) {
        setAllPlayersData({
          player1: player1Data,
          player2: player2Data,
        });
      }

      // Get the relevant player data based on index
      const playerData = index === 0 ? player1Data : player2Data;

      // Store previous state for interpolation
      if (currentState.current) {
        previousState.current = { ...currentState.current };
      }

      // Store current state
      currentState.current = {
        x: playerData.x,
        y: playerData.y,
        facing: playerData.facing,
        knockbackVelocity: playerData.knockbackVelocity,
      };

      // Track actual intervals between server updates for adaptive interpolation
      previousUpdateTime.current = lastUpdateTime.current;
      lastUpdateTime.current = currentTime;

      // If this is the first update, set previous state to current
      if (!previousState.current) {
        previousState.current = { ...currentState.current };
        setInterpolatedPosition({ x: playerData.x, y: playerData.y });
      }

      // Update penguin state with all data (discrete states are not interpolated)
      // PERFORMANCE FIX: Use functional update to merge delta with previous state
      // This prevents state loss when server sends partial delta updates
      setPenguin((prev) => {
        // PERFORMANCE: Create new state object
        const newState = {
          ...prev,
          ...playerData,
          isDodging: playerData.isDodging ?? prev.isDodging ?? false,
          dodgeDirection:
            typeof playerData.dodgeDirection === "number"
              ? playerData.dodgeDirection
              : playerData.facing ?? prev.dodgeDirection ?? 1,
          isGrabBreaking:
            playerData.isGrabBreaking ?? prev.isGrabBreaking ?? false,
          isGrabBreakCountered:
            playerData.isGrabBreakCountered ??
            prev.isGrabBreakCountered ??
            false,
        };

        // PERFORMANCE: Check if any key discrete game states changed
        // Position changes are handled by interpolation refs, so we skip x/y comparison
        // This avoids re-renders when only position/velocity changes (which is every frame)
        // IMPORTANT: Include ALL states that affect sprite selection (see getImageSrc)
        const discreteStateChanged =
          // Core action states
          prev.isAttacking !== newState.isAttacking ||
          prev.isDodging !== newState.isDodging ||
          prev.isHit !== newState.isHit ||
          prev.isGrabbing !== newState.isGrabbing ||
          prev.isBeingGrabbed !== newState.isBeingGrabbed ||
          prev.isThrowing !== newState.isThrowing ||
          prev.isBeingThrown !== newState.isBeingThrown ||
          prev.isRawParrying !== newState.isRawParrying ||
          prev.isChargingAttack !== newState.isChargingAttack ||
          prev.isBraking !== newState.isBraking ||
          prev.isPowerSliding !== newState.isPowerSliding ||
          prev.facing !== newState.facing ||
          prev.isJumping !== newState.isJumping ||
          prev.isDead !== newState.isDead ||
          prev.isReady !== newState.isReady ||
          prev.health !== newState.health ||
          prev.stamina !== newState.stamina ||
          prev.activePowerUp !== newState.activePowerUp ||
          prev.isAtTheRopes !== newState.isAtTheRopes ||
          prev.isRawParryStun !== newState.isRawParryStun ||
          prev.grabState !== newState.grabState ||
          prev.isSlapAttack !== newState.isSlapAttack ||
          prev.chargeAttackPower !== newState.chargeAttackPower ||
          // CRITICAL: Movement/animation states (affects sprite selection)
          prev.isStrafing !== newState.isStrafing || // Controls waddle animation!
          prev.isCrouchStance !== newState.isCrouchStance ||
          prev.isCrouchStrafing !== newState.isCrouchStrafing ||
          prev.isRecovering !== newState.isRecovering ||
          prev.isRawParrySuccess !== newState.isRawParrySuccess ||
          prev.isPerfectRawParrySuccess !== newState.isPerfectRawParrySuccess ||
          prev.isThrowingSnowball !== newState.isThrowingSnowball ||
          prev.isSpawningPumoArmy !== newState.isSpawningPumoArmy ||
          prev.isBeingPulled !== newState.isBeingPulled ||
          prev.isBeingPushed !== newState.isBeingPushed ||
          prev.isThrowTeching !== newState.isThrowTeching ||
          prev.isBowing !== newState.isBowing ||
          prev.isGrabBreaking !== newState.isGrabBreaking ||
          prev.isGrabBreakCountered !== newState.isGrabBreakCountered ||
          prev.isAttemptingGrabThrow !== newState.isAttemptingGrabThrow ||
          prev.grabAttemptType !== newState.grabAttemptType ||
          prev.slapAnimation !== newState.slapAnimation ||
          prev.isThrowingSalt !== newState.isThrowingSalt ||
          prev.isGrabbingMovement !== newState.isGrabbingMovement ||
          prev.isInRitualPhase !== newState.isInRitualPhase ||
          // New grab action system states
          prev.isGrabPushing !== newState.isGrabPushing ||
          prev.isBeingGrabPushed !== newState.isBeingGrabPushed ||
          prev.isAttemptingPull !== newState.isAttemptingPull ||
          prev.isBeingPullReversaled !== newState.isBeingPullReversaled ||
          prev.isGrabSeparating !== newState.isGrabSeparating ||
          prev.isGrabBellyFlopping !== newState.isGrabBellyFlopping ||
          prev.isBeingGrabBellyFlopped !== newState.isBeingGrabBellyFlopped ||
          prev.isGrabFrontalForceOut !== newState.isGrabFrontalForceOut ||
          prev.isBeingGrabFrontalForceOut !==
            newState.isBeingGrabFrontalForceOut ||
          prev.isGrabTeching !== newState.isGrabTeching ||
          prev.grabTechRole !== newState.grabTechRole ||
          prev.isGrabWhiffRecovery !== newState.isGrabWhiffRecovery ||
          prev.justLandedFromDodge !== newState.justLandedFromDodge;

        if (!discreteStateChanged) {
          return prev; // No discrete state change, skip re-render
        }

        return newState;
      });

      // Update all snowballs from both players (only if present in update)
      if (
        player1Data.snowballs !== undefined ||
        player2Data.snowballs !== undefined
      ) {
        const combinedSnowballs = [
          ...(player1Data.snowballs || []),
          ...(player2Data.snowballs || []),
        ];

        // Direct DOM position updates bypass React's render pipeline, keeping
        // snowball movement smooth even when heavy state changes (parry, etc.)
        // delay React re-renders. React state update below handles mount/unmount.
        for (let i = 0; i < combinedSnowballs.length; i++) {
          const sb = combinedSnowballs[i];
          const wrapper = snowballDomRefs.current[sb.id];
          const el = wrapper && wrapper.firstElementChild;
          if (el) {
            el.style.left = `${(sb.x / 1280) * 100}%`;
            el.style.bottom = `${(sb.y / 720) * 100 + 11}%`;
          }
        }

        setAllSnowballs(combinedSnowballs);
      }

      // Update all pumo armies from both players (only if present in update)
      // Tag each clone with ownerPlayerNumber so we can color them correctly
      if (
        player1Data.pumoArmy !== undefined ||
        player2Data.pumoArmy !== undefined
      ) {
        const combinedPumoArmies = [
          ...(player1Data.pumoArmy || []).map((clone) => ({
            ...clone,
            ownerPlayerNumber: 1,
          })),
          ...(player2Data.pumoArmy || []).map((clone) => ({
            ...clone,
            ownerPlayerNumber: 2,
          })),
        ];

        setAllPumoArmies(combinedPumoArmies);
      }
    },
    [index]
  );

  useEffect(() => {
    socket.on("fighter_action", handleFighterAction);

    socket.on("slap_parry", (position) => {
      if (
        position &&
        typeof position.x === "number" &&
        typeof position.y === "number"
      ) {
        setParryEffectPosition({
          x: position.x + SPRITE_HALF_W,
          y: PLAYER_MID_Y,
        });
        playSound(slapParrySound, 0.01);
      }
    });

    socket.on("player_hit", (data) => {
      if (data && typeof data.x === "number" && typeof data.y === "number") {
        lastPlayerHitTime.current = Date.now();
        if (index === 0) {
          const pan = xToPan(data.x);
          if (data.attackType === "slap") {
            const sound = pickRandomSound(slapHitSounds);
            playSound(sound.src, 0.045 * sound.vol, null, 1.0, pan);
            duckMusic(0.4, 300);
          } else {
            playSound(pickRandomSound(chargedHitSounds), 0.045, null, 1.0, pan);
            duckMusic(0.2, 500);
          }
        }
        setHitEffectPosition({
          x: data.x + 70,
          y: PLAYER_MID_Y,
          facing: data.facing || 1, // Default to 1 if facing not provided
          timestamp: data.timestamp, // Pass through unique timestamp
          hitId: data.hitId, // Pass through unique hit ID
          attackType: data.attackType || "slap", // Pass attack type for distinct effects
          isCounterHit: data.isCounterHit || false, // Counter hit for yellow effect
          isPunish: data.isPunish || false, // Punish for purple effect
        });
      }
    });

    socket.on("raw_parry_success", (data) => {
      lastRawParryTime.current = Date.now();
      if (data && typeof data.parrierX === "number") {
        // Position effect in front of the parrying player (where a hit effect would appear)
        const facing = data.facing || 1;
        // Offset in front of the parrier based on facing direction
        const frontOffset = facing === 1 ? 80 : -80;
        const effectData = {
          x: data.parrierX + 150 + frontOffset,
          y: PLAYER_MID_Y,
          facing: facing,
          timestamp: data.timestamp,
          parryId: data.parryId,
          isPerfect: data.isPerfect || false,
          playerNumber: data.playerNumber || 1,
        };
        setRawParryEffectPosition(effectData);
        // Signal parry stamina refund to the HUD
        if (data.playerNumber === 1) {
          setP1ParryRefund(Date.now());
        } else if (data.playerNumber === 2) {
          setP2ParryRefund(Date.now());
        }
        const parryPan = xToPan(data.parrierX);
        if (data.isPerfect) {
          playSound(rawParrySuccessSound, 0.015, null, 1.0, parryPan);
        } else {
          playSound(regularRawParrySound, 0.04, null, 1.0, parryPan);
        }
      }
    });

    socket.on("perfect_parry", (data) => {
      if (
        data &&
        typeof data.stunnedPlayerX === "number" &&
        typeof data.stunnedPlayerY === "number" &&
        data.showStarStunEffect
      ) {
        // Only show the star stun effect for the stunned player (attacking player)
        if (data.attackingPlayerId === player.id) {
          setShowStarStunEffect(true);

          // Don't set a timeout here - let the effect disappear when stun ends
        }
      }
    });

    // Grab break effect - dramatic feedback when escaping a grab
    // Only listen on index 0 to prevent duplicate effects
    if (index === 0) {
      socket.on("grab_break", (data) => {
        if (
          data &&
          typeof data.breakerX === "number" &&
          typeof data.grabberX === "number"
        ) {
          const centerX = (data.breakerX + data.grabberX) / 2;
          setGrabBreakEffectPosition({
            x: centerX + SPRITE_HALF_W,
            y: PLAYER_MID_Y,
            breakId: data.breakId || `break-${Date.now()}`,
            breakerPlayerNumber: data.breakerPlayerNumber || 1,
          });
          playSound(grabBreakSound, 0.01);
        }
      });

      // Grab tech effect — both players grabbed simultaneously, frost/blue burst
      socket.on("grab_tech", (data) => {
        if (data && typeof data.x === "number") {
          setGrabTechEffectPosition({
            x: data.x + SPRITE_HALF_W,
            y: PLAYER_MID_Y,
            techId: data.techId || `tech-${Date.now()}`,
            facing: data.grabberFacing || 1,
          });
          playSound(isTechingSound, 0.04);
        }
      });

      // Counter grab effect - only when grabbing opponent during their raw parry (LOCKED! + Counter Grab banner)
      socket.on("counter_grab", (data) => {
        if (data?.type !== "counter_grab") return;
        const x =
          typeof data.grabbedX === "number"
            ? data.grabbedX + SPRITE_HALF_W
            : (data.grabberX + data.grabbedX) / 2 + SPRITE_HALF_W;
        const y = PLAYER_MID_Y;
        setCounterGrabEffectPosition({
          type: "counter_grab",
          x,
          y,
          grabberId: data.grabberId,
          grabbedId: data.grabbedId,
          counterId: data.counterId || `counter-grab-${Date.now()}`,
          grabberPlayerNumber: data.grabberPlayerNumber || 1,
        });
        playSound(counterGrabSound, 0.035);
      });

      // Punish banner only (no hit effect) - when hitting opponent during recovery
      socket.on("punish_banner", (data) => {
        if (data?.counterId) {
          setPunishBannerPosition({
            counterId: data.counterId,
            grabberPlayerNumber: data.grabberPlayerNumber ?? 1,
          });
        }
      });

      // Counter hit effect - when active frames hit opponent's startup frames
      socket.on("counter_hit", (data) => {
        if (data && typeof data.x === "number" && typeof data.y === "number") {
          setCounterHitEffectPosition({
            x: data.x + 70,
            y: PLAYER_MID_Y,
            counterId: data.counterId || `counter-hit-${Date.now()}`,
            playerNumber: data.playerNumber || 1,
            timestamp: data.timestamp,
          });
        }
      });

      // "No Stamina" effect - only visible to local player when they try an action they can't afford
      socket.on("stamina_blocked", (data) => {
        if (data.playerId === localId) {
          // Play the not enough stamina sound at low volume
          playSound(notEnoughStaminaSound, 0.08);
          // Use timestamp as key to trigger new animation each time
          const newKey = Date.now();
          setNoStaminaEffectKey(newKey);
          // Auto-clear after animation completes (0.8 second)
          setTimeout(() => {
            setNoStaminaEffectKey((current) =>
              current === newKey ? 0 : current
            );
          }, 900);
        }
      });
    }

    // Snowball impact - listen on all components so both update lastPlayerHitTime
    socket.on("snowball_hit", (data) => {
      if (data && typeof data.x === "number" && typeof data.y === "number") {
        lastPlayerHitTime.current = Date.now();
        if (index === 0) {
          playSound(hitSound, 0.02, null, 1.0, xToPan(data.x));
        }
        setSnowballImpactPosition({
          x: data.x + 70,
          y: data.y + 50,
          facing: data.facing,
          hitId: data.hitId || `snowball-${Date.now()}`,
        });
      }
    });

    // Grab clash events - listen on ALL components so both players get the animation
    socket.on("grab_clash_start", () => {
      // Only play sound once (on index 0)
      if (index === 0) {
        playSound(grabClashSound, 0.04);
      }
      setIsGrabClashActive(true);
    });

    // Grab clash end - play victory or defeat sound based on local player result
    socket.on("grab_clash_end", (data) => {
      if (index === 0) {
        if (data.winnerId === localId) {
          playSound(clashVictorySound, 0.01);
        } else if (data.loserId === localId) {
          playSound(clashDefeatSound, 0.08);
        }
      }
      setIsGrabClashActive(false);
    });

    // Power-ups revealed simultaneously after both players have picked
    // This prevents counter-picking by hiding choices until both are locked in
    // The visual reveal is now handled by the PowerUpReveal component in Game.jsx
    socket.on("power_ups_revealed", (data) => {
      // Find this player's power-up from the reveal data
      const thisPlayerData =
        data.player1.playerId === player.id ? data.player1 : data.player2;

      // Only update penguin state for local player
      // Note: salt sound already plays during isThrowingSalt, and hasUsedPowerUp is set there too
      if (thisPlayerData.playerId === localId) {
        setPenguin((prev) => ({
          ...prev,
          activePowerUp: thisPlayerData.powerUpType,
          powerUpMultiplier:
            thisPlayerData.powerUpType === "speed"
              ? 1.4
              : thisPlayerData.powerUpType === "power"
              ? 1.3
              : 1,
        }));

        // Add a satisfying screen shake for power-up reveal
        setScreenShake({
          intensity: 0.35,
          duration: 150,
          startTime: Date.now(),
        });
      }
    });

    socket.on("game_reset", (data) => {
      setGameOver(data);
      setShowRoundResult(false); // Clear deferred round result
      if (showRoundResultRafRef.current) {
        cancelAnimationFrame(showRoundResultRafRef.current);
        showRoundResultRafRef.current = null;
      }
      setGyojiState("idle");
      setMatchOver(false);
      setHasUsedPowerUp(false);
      setGyojiCall(null); // Clear gyoji call
      setRawParryEffectPosition(null); // Clear any active parry effects
      setNoStaminaEffectKey(0); // Clear "No Stamina" effect on round reset
      setIsGrabClashActive(false); // Reset grab clash state
      onResetDisconnectState(); // Reset opponent disconnected state for new games

      // Bump round ID so UI can hard reset stamina visuals
      setUiRoundId((id) => id + 1);

      // Clear any existing countdown timer first
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      // Set countdown to 15 and start timer
      setCountdown(15);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    // Gyoji's call before HAKKIYOI (authentic sumo)
    socket.on("gyoji_call", (call) => {
      setGyojiCall(call);

      // Clear the call after animation completes
      setTimeout(() => {
        setGyojiCall(null);
      }, 2000);
    });

    socket.on("game_start", () => {
      setGyojiCall(null); // Clear any lingering gyoji call
      setHakkiyoi(true);
      setRawParryEffectPosition(null); // Clear any leftover parry effects
      // Clear stale predictions to prevent phantom charge at round start
      predictedState.current = {
        isSlapAttack: false,
        slapAnimation: predictedState.current.slapAnimation,
        isAttacking: false,
        isDodging: false,
        dodgeDirection: null,
        isChargingAttack: false,
        isRawParrying: false,
        isGrabbing: false,
        isPowerSliding: false,
        isBraking: false,
        timestamp: 0,
      };
      // Bump round ID on start in case clients skipped reset event
      setUiRoundId((id) => id + 1);
      // Clear the countdown timer when game starts and immediately reset countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      // Immediately set countdown to 0 to hide YOU label during gameplay
      setCountdown(0);

      // Add dramatic screen shake for round start
      setScreenShake({
        intensity: 0.6,
        duration: 300,
        startTime: Date.now(),
      });

      // Handle music transition: eeshi -> game music
      stopEeshi();
      if (gameMusicRef.current) {
        gameMusicRef.current.loop = true;
        gameMusicRef.current.play().catch((e) => {
          if (e.name !== "AbortError")
            console.error("Game music play error:", e);
        });
      }

      // Hide hakkiyoi text after 3 seconds
      setTimeout(() => {
        setHakkiyoi(false);
      }, 3000);
    });

    socket.on("game_over", (data) => {
      setGameOver(data.isGameOver);
      setWinner(data.winner);

      // Clear animation states that could cause stale jiggle/shake during round result
      setIsGrabClashActive(false);
      predictedState.current = {
        isSlapAttack: false,
        slapAnimation: predictedState.current.slapAnimation,
        isAttacking: false,
        isDodging: false,
        dodgeDirection: null,
        isChargingAttack: false,
        isRawParrying: false,
        isGrabbing: false,
        isPowerSliding: false,
        isBraking: false,
        timestamp: 0,
      };

      // Add winner to round history (MEMORY FIX: cap at 250 for best-of-127 support)
      const winnerName =
        data.winner.fighter === "player 1" ? "player1" : "player2";
      setRoundHistory((prev) => [...prev.slice(-249), winnerName]);

      if (data.winner.fighter === "player 1") {
        setPlayerOneWinCount(data.wins);
        setGyojiState("player1Win");
      } else {
        setPlayerTwoWinCount(data.wins);
        setGyojiState("player2Win");
      }
      // Play round victory or defeat sound based on local player result
      if (index === 0) {
        if (data.winner.id === localId) {
          playSound(roundVictorySound, 0.02);
        } else {
          playSound(roundDefeatSound, 0.01);
        }
      }
      // Bump round ID immediately on winner declaration to reset UI stamina to server value
      setUiRoundId((id) => id + 1);

      // PERFORMANCE: Defer RoundResult mount by 2 animation frames.
      // Without this, the browser has to do ALL of this in a single 16ms frame:
      // - Re-render the 4000+ line GameFighter component
      // - Generate ~15 new styled-components CSS classes for RoundResult
      // - Rasterize a 22rem (350px) kanji character with gradient + 6 text-shadows
      // - Start ~20 CSS animations simultaneously
      // - Swap ~200 crowd member sprites (from Game.jsx's crowd cheering)
      // By using double-rAF, the work is distributed across 3 frames:
      //   Frame 0: game state updates (setGameOver, setWinner, etc.)
      //   Frame 1: crowd cheering sprite swap (~200 img.src changes from Game.jsx)
      //   Frame 2: RoundResult mount (styled-components CSS + kanji rasterization)
      // Total delay is ~32ms at 60fps - imperceptible, but prevents the freeze.
      if (showRoundResultRafRef.current)
        cancelAnimationFrame(showRoundResultRafRef.current);
      showRoundResultRafRef.current = requestAnimationFrame(() => {
        showRoundResultRafRef.current = requestAnimationFrame(() => {
          setShowRoundResult(true);
          showRoundResultRafRef.current = null;
        });
      });

      // Handle music transition: game music -> eeshi music
      if (gameMusicRef.current) {
        gameMusicRef.current.pause();
        gameMusicRef.current.currentTime = 0;
      }
      if (!opponentDisconnected) {
        startEeshi();
      }
    });

    socket.on("match_over", (data) => {
      // Delay showing match over screen so round result animation can play (3 seconds)
      setTimeout(() => {
        setMatchOver(data.isMatchOver);
      }, 3000);
      // Keep win counts displayed until rematch - don't reset here!
      // Also bump round id at match end to reset UI
      setUiRoundId((id) => id + 1);
    });

    socket.on("rematch", () => {
      // Reset win counts and round history when rematch starts
      setPlayerOneWinCount(0);
      setPlayerTwoWinCount(0);
      setRoundHistory([]);
      setMatchOver(false);
    });

    return () => {
      socket.off("fighter_action");
      socket.off("slap_parry");
      socket.off("player_hit");
      socket.off("raw_parry_success");
      socket.off("perfect_parry");
      if (index === 0) {
        socket.off("grab_break");
        socket.off("grab_tech");
        socket.off("counter_grab");
        socket.off("punish_banner");
        socket.off("stamina_blocked");
        socket.off("counter_hit"); // Fix: was missing cleanup
      }
      socket.off("snowball_hit");
      socket.off("gyoji_call");
      socket.off("game_start");
      socket.off("game_reset");
      socket.off("game_over");
      socket.off("match_over");
      socket.off("power_ups_revealed");
      socket.off("rematch"); // Fix: was missing cleanup
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      // Clean up deferred RoundResult rAF
      if (showRoundResultRafRef.current) {
        cancelAnimationFrame(showRoundResultRafRef.current);
        showRoundResultRafRef.current = null;
      }
    };
  }, [index, socket, handleFighterAction, opponentDisconnected, localId]);

  // MEMORY FIX: Create music Audio objects only once on mount, reuse on opponentDisconnected changes
  useEffect(() => {
    if (!gameMusicRef.current) {
      gameMusicRef.current = new Audio(gameMusic);
      gameMusicRef.current.volume = 0.029;
    }
    if (!opponentDisconnected) {
      startEeshi();
    }

    return () => {
      stopEeshi();
      if (gameMusicRef.current) {
        gameMusicRef.current.pause();
        gameMusicRef.current.currentTime = 0;
      }
    };
  }, [opponentDisconnected]);

  // NOTE: game_start and game_over music handling is now consolidated into the main socket useEffect
  // to prevent duplicate listeners and cleanup race conditions

  useEffect(() => {
    // Trigger sound for charged attacks (non-slap attacks)
    if (
      penguin.isAttacking &&
      !penguin.isSlapAttack &&
      !lastAttackState.current
    ) {
      playSound(attackSound, 0.05);
    }
    // Update the last attack state
    lastAttackState.current = penguin.isAttacking && !penguin.isSlapAttack;
  }, [penguin.isAttacking, penguin.isSlapAttack]);

  // Separate effect for slap attack sounds based on slapAnimation changes
  useEffect(() => {
    if (penguin.isSlapAttack && penguin.isAttacking) {
      playSound(pickRandomSound(slapWhiffSounds), 0.02, null, 1.0, xToPan(penguin.x));
    }
  }, [penguin.slapAnimation, penguin.isSlapAttack, penguin.isAttacking]);

  useEffect(() => {
    const now = Date.now();
    if (
      penguin.isHit &&
      !lastHitState.current &&
      !penguin.isBeingThrown &&
      now - lastPlayerHitTime.current > 200 &&
      now - lastRawParryTime.current > 200
    ) {
      playSound(hitSound, 0.02);
    }
    lastHitState.current = penguin.isHit;
  }, [
    penguin.isHit,
    penguin.isBeingThrown,
    penguin.hitCounter,
    penguin.isDead,
  ]);

  useEffect(() => {
    if (penguin.isThrowingSalt && !lastThrowingSaltState.current) {
      setHasUsedPowerUp(true);

      const throwX = penguin.x;
      const throwY = penguin.y;
      const throwFacing = penguin.facing ?? 1;

      // Salt is released on frame 12 of the 17-frame animation at 15fps
      const SALT_RELEASE_FRAME = 12;
      const SALT_FPS = 15;
      const particleDelay = Math.round(((SALT_RELEASE_FRAME - 1) / SALT_FPS) * 1000);

      saltParticleTimerRef.current = setTimeout(() => {
        playSound(saltSound, 0.01);
        emitParticles("saltThrow", {
          x: throwX,
          y: throwY,
          facing: throwFacing,
        });
        saltParticleTimerRef.current = null;
      }, particleDelay);
    }
    if (!penguin.isThrowingSalt && lastThrowingSaltState.current) {
      if (saltParticleTimerRef.current) {
        clearTimeout(saltParticleTimerRef.current);
        saltParticleTimerRef.current = null;
      }
    }
    lastThrowingSaltState.current = penguin.isThrowingSalt;
  }, [penguin.isThrowingSalt, penguin.x, penguin.y, penguin.facing, emitParticles]);

  useEffect(() => {
    if (penguin.isThrowing && !lastThrowState.current) {
      playSound(throwSound, 0.03);
    }
    lastThrowState.current = penguin.isThrowing;
  }, [penguin.isThrowing]);

  useEffect(() => {
    if (penguin.isDodging && !lastDodgeState.current) {
      playSound(dodgeSound, 0.02);
      emitParticles("dodgeStart", {
        x: penguin.dodgeStartX ?? penguin.x,
        y: penguin.dodgeStartY ?? penguin.y,
        direction: penguin.dodgeDirection ?? penguin.facing ?? 1,
        facing: penguin.facing ?? 1,
      });
    }
    lastDodgeState.current = penguin.isDodging;
  }, [
    penguin.isDodging,
    penguin.dodgeStartX,
    penguin.dodgeStartY,
    penguin.dodgeDirection,
    penguin.facing,
    penguin.x,
    penguin.y,
    emitParticles,
  ]);

  useEffect(() => {
    lastDodgeLandParticleState.current = penguin.justLandedFromDodge;
  }, [penguin.justLandedFromDodge]);

  // Grab push dust trail — continuous emission under the GRABBED player while being pushed.
  // Uses a ref so the interval callback always sees the latest pushed state,
  // stopping immediately when ANY grab action interrupts the push.
  const grabPushLastX = useRef(null);
  const grabPushIntervalRef = useRef(null);
  const isBeingGrabPushedRef = useRef(false);

  useEffect(() => {
    isBeingGrabPushedRef.current =
      penguin.isBeingGrabPushed && penguin.isBeingGrabbed;
  }, [penguin.isBeingGrabPushed, penguin.isBeingGrabbed]);

  useEffect(() => {
    const shouldEmit = penguin.isBeingGrabPushed && penguin.isBeingGrabbed;
    if (shouldEmit) {
      grabPushLastX.current = interpolatedPosition.x || penguin.x;
      const EMIT_INTERVAL = 50;
      const MAX_DELTA_FOR_FULL_SPEED = 12;

      grabPushIntervalRef.current = setInterval(() => {
        if (!isBeingGrabPushedRef.current) {
          clearInterval(grabPushIntervalRef.current);
          grabPushIntervalRef.current = null;
          return;
        }

        const curX = interpolatedPositionRef.current.x || penguin.x;
        const dx = Math.abs(curX - (grabPushLastX.current ?? curX));
        grabPushLastX.current = curX;
        const speed = Math.min(dx / MAX_DELTA_FOR_FULL_SPEED, 1);

        emitParticles("grabPushTrail", {
          x: curX,
          y: penguin.y,
          direction: penguin.facing ?? 1,
          speed,
        });
      }, EMIT_INTERVAL);
    } else {
      if (grabPushIntervalRef.current) {
        clearInterval(grabPushIntervalRef.current);
        grabPushIntervalRef.current = null;
      }
      grabPushLastX.current = null;
    }
    return () => {
      if (grabPushIntervalRef.current) {
        clearInterval(grabPushIntervalRef.current);
        grabPushIntervalRef.current = null;
      }
    };
  }, [
    penguin.isBeingGrabPushed,
    penguin.isBeingGrabbed,
    penguin.facing,
    penguin.x,
    penguin.y,
    emitParticles,
  ]);

  // Charged attack (flying headbutt) jet trail — big clouds behind the player during lunge
  const chargedTrailLastX = useRef(null);
  const chargedTrailIntervalRef = useRef(null);
  const isChargedLungingRef = useRef(false);

  useEffect(() => {
    isChargedLungingRef.current =
      penguin.isAttacking && penguin.attackType === "charged";
  }, [penguin.isAttacking, penguin.attackType]);

  useEffect(() => {
    const isLunging = penguin.isAttacking && penguin.attackType === "charged";
    if (isLunging) {
      chargedTrailLastX.current = interpolatedPosition.x || penguin.x;
      const EMIT_INTERVAL = 50;
      const MAX_DELTA_FOR_FULL_SPEED = 14;

      chargedTrailIntervalRef.current = setInterval(() => {
        if (!isChargedLungingRef.current) {
          clearInterval(chargedTrailIntervalRef.current);
          chargedTrailIntervalRef.current = null;
          return;
        }

        const curX = interpolatedPositionRef.current.x || penguin.x;
        const dx = Math.abs(curX - (chargedTrailLastX.current ?? curX));
        chargedTrailLastX.current = curX;
        const speed = Math.min(dx / MAX_DELTA_FOR_FULL_SPEED, 1);

        emitParticles("chargedAttackTrail", {
          x: curX,
          y: penguin.y,
          direction: penguin.facing ?? 1,
          speed,
        });
      }, EMIT_INTERVAL);
    } else {
      if (chargedTrailIntervalRef.current) {
        clearInterval(chargedTrailIntervalRef.current);
        chargedTrailIntervalRef.current = null;
      }
      chargedTrailLastX.current = null;
    }
    return () => {
      if (chargedTrailIntervalRef.current) {
        clearInterval(chargedTrailIntervalRef.current);
        chargedTrailIntervalRef.current = null;
      }
    };
  }, [
    penguin.isAttacking,
    penguin.attackType,
    penguin.facing,
    penguin.x,
    penguin.y,
    emitParticles,
  ]);

  // Pull reversal hop landings — schedule a dust burst at each hop landing time.
  // The server hop tween is deterministic (650ms, 4 decaying hops after 18% delay),
  // but the 32Hz broadcast rate is too coarse to capture the brief ground touches
  // between hops, so we schedule bursts based on known tween timing instead.
  const pullReversalTimeouts = useRef([]);
  useEffect(() => {
    if (penguin.isBeingPullReversaled) {
      const TWEEN_DURATION = 650;
      const HOP_DELAY = 0.18;
      const HOP_COUNT = 4;
      const hopWindowStart = TWEEN_DURATION * HOP_DELAY;
      const hopDuration = (TWEEN_DURATION * (1 - HOP_DELAY)) / HOP_COUNT;
      const LATENCY_OFFSET = 35;

      const baseY = interpolatedPositionRef.current.y || penguin.y;

      // Immediate burst at the start of the pull (the initial yank).
      // Direction = facing, so dust kicks up in front of the player (opposite pull travel).
      emitParticles("pullReversalLand", {
        x: interpolatedPositionRef.current.x,
        y: baseY,
        intensity: 1.0,
        direction: penguin.facing ?? 1,
      });

      for (let i = 0; i < HOP_COUNT; i++) {
        const landingTime =
          hopWindowStart + (i + 1) * hopDuration - LATENCY_OFFSET;
        const intensity = Math.max(0.15, 1.0 - (i + 1) * 0.2);

        const tid = setTimeout(() => {
          emitParticles("pullReversalLand", {
            x: interpolatedPositionRef.current.x,
            y: baseY,
            intensity,
          });
        }, Math.max(0, landingTime));
        pullReversalTimeouts.current.push(tid);
      }
    } else {
      pullReversalTimeouts.current.forEach(clearTimeout);
      pullReversalTimeouts.current = [];
    }
    return () => {
      pullReversalTimeouts.current.forEach(clearTimeout);
      pullReversalTimeouts.current = [];
    };
  }, [penguin.isBeingPullReversaled, emitParticles]);

  // Grab throw landing — dust burst when the thrown player hits the ground.
  // Uses penguin.y (not interpolatedPositionRef) because at the moment isBeingThrown
  // flips to false, the interpolated Y is still mid-throw-arc. The React state update
  // includes the corrected ground-level Y from the same delta.
  const wasBeingThrown = useRef(false);
  useEffect(() => {
    if (wasBeingThrown.current && !penguin.isBeingThrown) {
      emitParticles("throwLand", {
        x: interpolatedPositionRef.current.x || penguin.x,
        y: penguin.y,
      });
    }
    wasBeingThrown.current = !!penguin.isBeingThrown;
  }, [penguin.isBeingThrown, penguin.x, penguin.y, emitParticles]);

  useEffect(() => {
    const STRAFE_VOL = 0.015 * getGlobalVolume();
    const FADE_MS = 0.08;
    if (penguin.isStrafing) {
      if (!strafingSoundRef.current) {
        const result = playBuffer(strafingSound, 0, null, 1.0, true);
        if (result) {
          result.gainNode.gain.setValueAtTime(
            0,
            result.gainNode.context.currentTime
          );
          result.gainNode.gain.linearRampToValueAtTime(
            STRAFE_VOL,
            result.gainNode.context.currentTime + FADE_MS
          );
        }
        strafingSoundRef.current = result;
      }
    } else if (strafingSoundRef.current) {
      const { source, gainNode } = strafingSoundRef.current;
      const ctx = gainNode.context;
      gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_MS);
      const ref = strafingSoundRef.current;
      strafingSoundRef.current = null;
      setTimeout(() => {
        try {
          ref.source.stop();
        } catch (_) {}
      }, FADE_MS * 1000 + 20);
    }
    return () => {
      if (strafingSoundRef.current) {
        try {
          strafingSoundRef.current.source.stop();
        } catch (_) {}
        strafingSoundRef.current = null;
      }
    };
  }, [penguin.isStrafing]);

  // Edge-push danger state for local player (vignette + heartbeat + shake)
  const DANGER_STAMINA_THRESHOLD = 40;
  const localEdgeData = index === 0
    ? (isLocalPlayer ? allPlayersData.player1 : allPlayersData.player2)
    : null;
  const isLocalEdgePushed = !!localEdgeData?.isBeingEdgePushed;
  const localEdgeStamina = localEdgeData?.stamina ?? 100;

  // Heartbeat sound: plays single-beat mp3 repeatedly while edge-pushed.
  // Speed ramps up as stamina drops below 50%. Beats never overlap — each
  // plays to completion, then the next one uses the latest stamina to pick its speed.
  const heartbeatTimeoutRef = useRef(null);
  const heartbeatActiveRef = useRef(false);
  const staminaRef = useRef(localEdgeStamina);
  staminaRef.current = localEdgeStamina;

  useEffect(() => {
    const BEAT_VOL = 0.18;

    // Above 50% stamina: 2x rate, 250ms gap
    // At or below 50%:   3x rate, 30ms gap
    const getBeatParams = () => {
      const stamina = staminaRef.current;
      if (stamina > 50) return { rate: 2.3, gap: 250 };
      return { rate: 2.5, gap: 30 };
    };

    const scheduleBeat = () => {
      if (!heartbeatActiveRef.current) return;
      const { rate, gap } = getBeatParams();
      const result = playBuffer(heartbeatSound, BEAT_VOL * getGlobalVolume(), null, rate);
      const duration = (result?.source?.buffer?.duration ?? 0.4) / rate;
      const delay = (duration * 1000) + gap;
      heartbeatTimeoutRef.current = setTimeout(scheduleBeat, delay);
    };

    if (isLocalEdgePushed) {
      heartbeatActiveRef.current = true;
      scheduleBeat();
    } else {
      heartbeatActiveRef.current = false;
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
    }
    return () => {
      heartbeatActiveRef.current = false;
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
    };
  }, [isLocalEdgePushed]);

  // Screen shake on initial edge pin
  const wasEdgePushedRef = useRef(false);
  useEffect(() => {
    if (isLocalEdgePushed && !wasEdgePushedRef.current) {
      setScreenShake({ intensity: 2.0, duration: 120, startTime: Date.now() });
    }
    wasEdgePushedRef.current = isLocalEdgePushed;
  }, [isLocalEdgePushed]);

  // Screen shake on dodge landing for satisfying impact feel
  useEffect(() => {
    if (penguin.justLandedFromDodge && !lastDodgeLandState.current) {
      // Subtle shake for landing impact - gentler for smoother feel
      setScreenShake({
        intensity: penguin.isDodgeCancelling ? 2.5 : 1.5, // Gentler shake
        duration: penguin.isDodgeCancelling ? 100 : 60,
        startTime: Date.now(),
      });
    }
    lastDodgeLandState.current = penguin.justLandedFromDodge;
  }, [penguin.justLandedFromDodge, penguin.isDodgeCancelling]);

  useEffect(() => {
    if (penguin.isGrabbing && !lastGrabState.current) {
      const pan = xToPan(penguin.x);
      playSound(grabSound, 0.04, null, 1.0, pan);
      playSound(pickRandomSound(grabHitSounds), 0.03, null, 1.0, pan);
      duckMusic(0.25, 450);
    }
    lastGrabState.current = penguin.isGrabbing;
  }, [penguin.isGrabbing]);

  useEffect(() => {
    if (penguin.isThrowingSnowball && !lastThrowingSnowballState.current) {
      playSound(snowballThrowSound, 0.05);
    }
    lastThrowingSnowballState.current = penguin.isThrowingSnowball;
  }, [penguin.isThrowingSnowball]);

  useEffect(() => {
    if (index !== 0 || allSnowballs.length === 0) return;
    for (const sb of allSnowballs) {
      emitParticles("snowballTrail", {
        x: sb.x,
        y: sb.y,
        direction: sb.velocityX > 0 ? 1 : -1,
      });
    }
  }, [allSnowballs, index, emitParticles]);

  useEffect(() => {
    if (penguin.isSpawningPumoArmy && !lastSpawningPumoArmyState.current) {
      playSound(pumoArmySound, 0.02);
    }
    lastSpawningPumoArmyState.current = penguin.isSpawningPumoArmy;
  }, [penguin.isSpawningPumoArmy]);

  useEffect(() => {
    if (penguin.isRawParrying && !lastRawParryState.current) {
      playSound(rawParryGruntSound, 0.03);
    }
    lastRawParryState.current = penguin.isRawParrying;
  }, [penguin.isRawParrying]);

  // Raw perfect parry stun: play stunned sound when this player becomes stunned
  useEffect(() => {
    if (
      penguin.isRawParryStun &&
      !lastRawParryStunState.current &&
      penguin.id === player.id
    ) {
      playSound(stunnedSound, 0.04);
    }
    lastRawParryStunState.current = penguin.isRawParryStun;
  }, [penguin.isRawParryStun, penguin.id, player.id]);

  const lastGassedState = useRef(false);
  const gassedSoundSuppressed = useRef(false);
  useEffect(() => {
    if (gameOver || penguin.isDead) {
      lastGassedState.current = false;
      gassedSoundSuppressed.current = true;
      return;
    }
    if (gassedSoundSuppressed.current) {
      lastGassedState.current = penguin.isGassed;
      if (!penguin.isGassed) gassedSoundSuppressed.current = false;
      return;
    }
    if (penguin.isGassed && !lastGassedState.current) {
      playSound(gassedSound, 0.03);
    }
    if (!penguin.isGassed && lastGassedState.current && player.id === localId) {
      playSound(gassedRegenSound, 0.03, null, 2.0);
    }
    lastGassedState.current = penguin.isGassed;
  }, [penguin.isGassed, penguin.isDead, gameOver, player.id, localId]);

  const lastPerfectParryState = useRef(false);
  useEffect(() => {
    if (penguin.isPerfectRawParrySuccess && !lastPerfectParryState.current) {
      emitParticles("throwLand", {
        x: penguin.x,
        y: penguin.y,
      });
    }
    lastPerfectParryState.current = penguin.isPerfectRawParrySuccess;
  }, [penguin.isPerfectRawParrySuccess, penguin.x, penguin.y, emitParticles]);

  useEffect(() => {
    if (hakkiyoi) {
      playSound(hakkiyoiSound, 0.015);
      playSound(bellSound, 0.005);
    }
  }, [hakkiyoi]);

  useEffect(() => {
    if (gyojiCall === "TE WO TSUITE!") {
      playSound(teWoTsuiteSound, 0.1);
    }
  }, [gyojiCall]);

  useEffect(() => {
    const currentTime = Date.now();
    if (
      gameOver &&
      !lastWinnerState.current &&
      currentTime - lastWinnerSoundPlay.current > 1000
    ) {
      playSound(winnerSound, 0.01);
      lastWinnerSoundPlay.current = currentTime;
    }
    lastWinnerState.current = gameOver;
  }, [gameOver]);

  // Hide star stun effect when stun ends
  useEffect(() => {
    if (!penguin.isRawParryStun && showStarStunEffect) {
      setShowStarStunEffect(false);
    }
    // Also show the effect if the player becomes stunned but the effect isn't showing
    // This handles cases where the perfect_parry event might arrive after the fighter_action update
    if (
      penguin.isRawParryStun &&
      !showStarStunEffect &&
      penguin.id === player.id
    ) {
      setShowStarStunEffect(true);
    }
  }, [penguin.isRawParryStun, showStarStunEffect, penguin.id, player.id]);

  // Add screen shake effect - OPTIMIZED using requestAnimationFrame
  // Enhanced with punchy initial shake and smooth decay
  useEffect(() => {
    if (screenShake.intensity > 0) {
      let animationId;
      const gameContainer = document.querySelector(".game-container");

      const shakeFrame = () => {
        const elapsed = Date.now() - screenShake.startTime;
        if (elapsed >= screenShake.duration) {
          setScreenShake({ intensity: 0, duration: 0, startTime: 0 });
          if (gameContainer) {
            gameContainer.style.transform = "translate(0px, 0px)";
          }
          return;
        }

        // Use exponential decay for punchier initial shake
        // The shake is strongest at the start and quickly tapers off
        const progress = elapsed / screenShake.duration;
        const decayFactor = Math.pow(1 - progress, 1.5); // Exponential decay
        const remainingIntensity = screenShake.intensity * decayFactor;

        // Increased shake multiplier (12px instead of 10px) for more visible impact
        // Slight bias towards horizontal shake since hits push sideways
        const offsetX = (Math.random() - 0.5) * remainingIntensity * 14;
        const offsetY = (Math.random() - 0.5) * remainingIntensity * 10;

        if (gameContainer) {
          gameContainer.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }

        animationId = requestAnimationFrame(shakeFrame);
      };

      animationId = requestAnimationFrame(shakeFrame);

      return () => {
        cancelAnimationFrame(animationId);
        if (gameContainer) {
          gameContainer.style.transform = "translate(0px, 0px)";
        }
      };
    }
  }, [screenShake]);

  // Update thick blubber indicator based on actual game state
  const shouldShowThickBlubberIndicator = useMemo(() => {
    const isGrabbing =
      penguin.isGrabStartup || penguin.isGrabbingMovement || penguin.isGrabbing;
    return (
      penguin.activePowerUp === "thick_blubber" &&
      ((penguin.isAttacking && penguin.attackType === "charged") ||
        isGrabbing) &&
      !penguin.hitAbsorptionUsed
    );
  }, [
    penguin.activePowerUp,
    penguin.isAttacking,
    penguin.attackType,
    penguin.hitAbsorptionUsed,
    penguin.isGrabStartup,
    penguin.isGrabbingMovement,
    penguin.isGrabbing,
  ]);

  useEffect(() => {
    setThickBlubberIndicator(shouldShowThickBlubberIndicator);
  }, [shouldShowThickBlubberIndicator]);

  // Add state for danger zone effect
  const [dangerZoneActive, setDangerZoneActive] = useState(false);
  const [slowMoActive, setSlowMoActive] = useState(false);

  // Add screen shake, thick blubber absorption, and danger zone event listeners
  // MEMORY FIX: Track timeouts so we can clear them on unmount (prevents setState after unmount)
  useEffect(() => {
    const pendingTimeouts = [];

    socket.on("screen_shake", (data) => {
      setScreenShake({
        intensity: data.intensity,
        duration: data.duration,
        startTime: Date.now(),
      });
    });

    socket.on("thick_blubber_absorption", (data) => {
      if (data.playerId === player.id) {
        setThickBlubberEffect({
          isActive: true,
          x: data.x,
          y: data.y,
        });

        playSound(thickBlubberSound, 0.01);

        const id = setTimeout(() => {
          setThickBlubberEffect({
            isActive: false,
            x: 0,
            y: 0,
          });
        }, 50);
        pendingTimeouts.push(id);
      }
    });

    socket.on("danger_zone", (data) => {
      setDangerZoneActive(true);
      setSlowMoActive(true);

      const id = setTimeout(() => {
        setDangerZoneActive(false);
        setSlowMoActive(false);
      }, 400);
      pendingTimeouts.push(id);
    });

    socket.on("ring_out", (data) => {
      setScreenShake({
        intensity: 1.2,
        duration: 600,
        startTime: Date.now(),
      });
    });

    return () => {
      pendingTimeouts.forEach(clearTimeout);
      socket.off("screen_shake");
      socket.off("thick_blubber_absorption");
      socket.off("danger_zone");
      socket.off("ring_out");
    };
  }, [socket, player.id, localId, roomName]);

  // Final cleanup effect - ensure all music stops when component unmounts
  useEffect(() => {
    return () => {
      stopEeshi();
      if (gameMusicRef.current) {
        gameMusicRef.current.pause();
        gameMusicRef.current.currentTime = 0;
      }
    };
  }, []); // Empty dependency array means this only runs on mount/unmount

  // ============================================
  // DISPLAY STATE - Merges predicted state with server state
  // This is what we actually render - gives instant visual feedback
  // PERFORMANCE: Memoized to avoid recalculating on every render
  // ============================================
  const displayPenguin = useMemo(() => {
    return getDisplayState();
  }, [getDisplayState]);

  // PERFORMANCE: Calculate position ONCE per render instead of calling getDisplayPosition() multiple times
  // Memoized to avoid recalculating on every render
  const displayPosition = useMemo(() => {
    return getDisplayPosition();
  }, [getDisplayPosition]);

  // ============================================
  // SPRITE RECOLORING
  // Compute the current sprite and apply recoloring if needed
  // ============================================
  const displaySpriteSrc = getImageSrc(
    penguin.fighter,
    penguin.isDiving,
    penguin.isJumping,
    displayPenguin.isAttacking,
    displayPenguin.isDodging,
    penguin.isStrafing,
    displayPenguin.isRawParrying,
    penguin.isGrabBreaking,
    penguin.isReady,
    penguin.isHit,
    penguin.isDead,
    displayPenguin.isSlapAttack,
    penguin.isThrowing,
    displayPenguin.isGrabbing,
    penguin.isGrabbingMovement,
    penguin.isBeingGrabbed,
    penguin.isThrowingSalt,
    displayPenguin.slapAnimation,
    penguin.isBowing,
    penguin.isThrowTeching,
    penguin.isBeingPulled,
    penguin.isBeingPushed,
    penguin.grabState,
    penguin.grabAttemptType,
    penguin.isRecovering,
    penguin.isRawParryStun,
    penguin.isRawParrySuccess,
    penguin.isPerfectRawParrySuccess,
    penguin.isThrowingSnowball,
    penguin.isSpawningPumoArmy,
    penguin.isAtTheRopes,
    penguin.isCrouchStance,
    penguin.isCrouchStrafing,
    displayPenguin.isPowerSliding,
    penguin.isGrabBreakCountered,
    penguin.isGrabbingMovement,
    isGrabClashActive,
    penguin.isAttemptingGrabThrow,
    null, // ritualAnimationSrc - handled separately
    // New grab action system states
    penguin.isGrabPushing,
    penguin.isBeingGrabPushed,
    penguin.isAttemptingPull,
    penguin.isBeingPullReversaled,
    penguin.isGrabSeparating,
    penguin.isGrabBellyFlopping,
    penguin.isBeingGrabBellyFlopped,
    penguin.isGrabFrontalForceOut,
    penguin.isBeingGrabFrontalForceOut,
    penguin.isGrabTeching,
    penguin.grabTechRole,
    penguin.isGrabWhiffRecovery
  );

  // Hold previous sprite for a few frames when transitioning to idle to prevent
  // ghost frames during state transition gaps (e.g. isHit=false before isRecovering=true)
  let effectiveSpriteSrc = displaySpriteSrc;
  if (displaySpriteSrc === pumo && lastNonIdleSpriteRef.current) {
    if (idleHoldFramesRef.current < IDLE_HOLD_FRAMES) {
      effectiveSpriteSrc = lastNonIdleSpriteRef.current;
      idleHoldFramesRef.current++;
    } else {
      lastNonIdleSpriteRef.current = null;
      idleHoldFramesRef.current = 0;
    }
  } else if (displaySpriteSrc !== pumo) {
    lastNonIdleSpriteRef.current = displaySpriteSrc;
    idleHoldFramesRef.current = 0;
  }

  // Hit tint for first few frames of isHit only (brief red flash on impact, not whole hitstun)
  if (penguin.isHit && !lastHitState.current) {
    hitTintFramesRemaining.current = 10; // ~165ms at 60fps - short red flash on impact
  }
  if (!penguin.isHit) {
    hitTintFramesRemaining.current = 0;
  }
  const showHitTintThisFrame =
    penguin.isHit && hitTintFramesRemaining.current > 0;
  if (showHitTintThisFrame) {
    hitTintFramesRemaining.current -= 1;
  }

  // Tint priority: hit > thick blubber
  // (Dodge invincibility is handled via CSS opacity pulse, not sprite-level tinting)
  const useBlubberTint = thickBlubberIndicator && !showHitTintThisFrame;

  // Get sprite render info (handles animated spritesheets and recoloring)
  const spriteRenderInfo = getSpriteRenderInfo(
    effectiveSpriteSrc,
    showHitTintThisFrame,
    false,
    useBlubberTint
  );
  const {
    src: recoloredSpriteSrc,
    isAnimated: isAnimatedSprite,
    config: spriteConfig,
  } = spriteRenderInfo;

  const baseSpriteSrc = recoloredSpriteSrc;

  // Update animation state (will start/stop intervals as needed)
  updateSpriteAnimation(effectiveSpriteSrc);

  // Determine if we should show ritual or fighter sprite
  const showRitualSprite = shouldShowRitualForPlayer && ritualSpriteConfig;

  return (
    <div className="ui-container">
      {/* Global visual theme overlay - optimized for performance */}
      <ThemeOverlay
        theme="edo-nightfall"
        intensity={0.16}
        lanterns={0.1}
        zIndex={0}
      />
      <SnowEffect
        mode={matchOver ? "envelope" : "snow"}
        winner={winner}
        playerIndex={index}
      />
      {/* World-space: Gyoji stays in the scene and zooms with camera */}
      <Gyoji gyojiState={gyojiState} hakkiyoi={hakkiyoi} />

      {/* Screen-space HUD: portalled outside the scene so it never zooms */}
      {document.getElementById("game-hud") &&
        createPortal(
          <>
            {index === 0 && (
              <UiPlayerInfo
                playerOneWinCount={playerOneWinCount}
                playerTwoWinCount={playerTwoWinCount}
                roundHistory={roundHistory}
                roundId={uiRoundId}
                player1Stamina={allPlayersData.player1?.stamina ?? 100}
                player1ActivePowerUp={
                  allPlayersData.player1?.activePowerUp ?? null
                }
                player1SnowballCooldown={
                  allPlayersData.player1?.snowballCooldown ?? false
                }
                player1PumoArmyCooldown={
                  allPlayersData.player1?.pumoArmyCooldown ?? false
                }
                player1IsGassed={allPlayersData.player1?.isGassed ?? false}
                player1ParryRefund={p1ParryRefund}
                player2Stamina={allPlayersData.player2?.stamina ?? 100}
                player2ActivePowerUp={
                  allPlayersData.player2?.activePowerUp ?? null
                }
                player2SnowballCooldown={
                  allPlayersData.player2?.snowballCooldown ?? false
                }
                player2PumoArmyCooldown={
                  allPlayersData.player2?.pumoArmyCooldown ?? false
                }
                player2IsGassed={allPlayersData.player2?.isGassed ?? false}
                player2ParryRefund={p2ParryRefund}
              />
            )}
            {index === 0 && isLocalEdgePushed && (() => {
              const belowThreshold = localEdgeStamina <= DANGER_STAMINA_THRESHOLD;
              const staminaRatio = belowThreshold
                ? 1 - localEdgeStamina / DANGER_STAMINA_THRESHOLD
                : 0;
              return (
                <div
                  className="danger-vignette"
                  style={{
                    animationDuration: belowThreshold
                      ? `${Math.max(0.25, 0.8 - staminaRatio * 0.55)}s`
                      : '1.6s',
                    '--danger-lo': belowThreshold ? 0.45 + staminaRatio * 0.2 : 0.28,
                    '--danger-hi': belowThreshold ? 0.7 + staminaRatio * 0.25 : 0.5,
                  }}
                  aria-hidden="true"
                />
              );
            })()}
            {gyojiCall && (
              <SumoGameAnnouncement type="tewotsuite" duration={2} />
            )}
            {hakkiyoi && (
              <SumoGameAnnouncement type="hakkiyoi" duration={1.8} />
            )}
            {matchOver && (
              <MatchOver
                winner={winner}
                localId={localId}
                roomName={roomName}
              />
            )}
          </>,
          document.getElementById("game-hud")
        )}
      {showRoundResult && !matchOver && (
        <RoundResult isVictory={winner.id === localId} />
      )}
      {warmupRoundResult && (
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
          <RoundResult isVictory={true} />
          <RoundResult isVictory={false} />
        </div>
      )}
      {penguin.id === localId &&
        !hakkiyoi &&
        gyojiState === "idle" &&
        countdown > 0 && (
          <YouLabel x={displayPosition.x} y={displayPosition.y} />
        )}
      {/* PowerMeter and charge flash removed — hidden charge (TAP-style) */}

      <SaltBasket
        src={
          penguin.isThrowingSalt || hasUsedPowerUp
            ? saltBasketEmpty
            : saltBasket
        }
        alt="Salt Basket"
        $index={index}
        $isVisible={true}
      />
      <PlayerShadow
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing ?? -1}
        isDodging={penguin.isDodging}
        isGrabStartup={penguin.isGrabStartup}
        isThrowing={penguin.isThrowing}
        isBeingThrown={penguin.isBeingThrown}
        isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
        isLocalPlayer={penguin.id === localId}
        localPlayerRingStyle={
          penguin.id === localId
            ? SPECIAL_MAWASHI_GRADIENTS[playerColor] || playerColor
            : undefined
        }
      />
      {/* <DodgeSmokeEffect
        x={penguin.dodgeStartX || displayPosition.x}
        y={penguin.dodgeStartY || displayPosition.y}
        isDodging={penguin.isDodging}
        facing={penguin.facing ?? -1}
        dodgeDirection={penguin.dodgeDirection}
      /> */}
      {/* <DodgeLandingEffect
        x={displayPosition.x}
        y={GROUND_LEVEL}
        justLanded={penguin.justLandedFromDodge}
        isCancelled={penguin.isDodgeCancelling}
      /> */}
      {/* 
      <ChargedAttackSmokeEffect
        x={displayPosition.x}
        y={displayPosition.y}
        isChargingAttack={penguin.isChargingAttack}
        facing={penguin.facing ?? -1}
        isSlapAttack={penguin.isSlapAttack}
        isThrowing={penguin.isThrowing}
        chargeCancelled={penguin.chargeCancelled || false}
      /> */}
      {/* Animated Sprite Sheet (when sprite is a spritesheet animation) */}
      {isAnimatedSprite && !showRitualSprite && (
        <AnimatedFighterContainer
          $x={displayPosition.x}
          $y={displayPosition.y}
          $facing={penguin.facing ?? -1}
          $fighter={penguin.fighter}
          $isThrowing={penguin.isThrowing}
          $isDodging={displayPenguin.isDodging}
          $isGrabbing={displayPenguin.isGrabbing}
          $isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
          $isAtTheRopes={penguin.isAtTheRopes}
          $isHit={penguin.isHit}
          $isRawParryStun={penguin.isRawParryStun}
        >
          <AnimatedFighterImage
            key={baseSpriteSrc}
            src={recoloredSpriteSrc}
            alt="fighter"
            $frameCount={spriteConfig?.frameCount || 1}
            $fps={spriteConfig?.fps || 30}
            $loop={spriteConfig?.loop !== false}
            $isLocalPlayer={penguin.id === localId}
            $isAtTheRopes={penguin.isAtTheRopes}
            $isGrabBreaking={penguin.isGrabBreaking}
            $isRawParrying={displayPenguin.isRawParrying}
            $isHit={penguin.isHit}
            $isChargingAttack={displayPenguin.isChargingAttack}
            $isGrabClashActive={isGrabClashActive}
            $isGrabTeching={penguin.isGrabTeching}
            $grabTechRole={penguin.grabTechRole}
            $isGrabWhiffRecovery={penguin.isGrabWhiffRecovery}
            draggable={false}
          />
        </AnimatedFighterContainer>
      )}

      {/* Static Sprite (when sprite is not an animated spritesheet) */}
      {!isAnimatedSprite && (
        <StyledImage
          $overrideSrc={recoloredSpriteSrc}
          $fighter={penguin.fighter}
          $isDiving={penguin.isDiving}
          $isJumping={penguin.isJumping}
          $isAttacking={displayPenguin.isAttacking}
          $isDodging={displayPenguin.isDodging}
          $isStrafing={penguin.isStrafing}
          $isBraking={displayPenguin.isBraking && !penguin.isRawParryStun}
          $isPowerSliding={displayPenguin.isPowerSliding}
          $isRawParrying={displayPenguin.isRawParrying}
          $isGrabBreaking={penguin.isGrabBreaking}
          $isReady={penguin.isReady}
          $isHit={penguin.isHit}
          $isDead={penguin.isDead}
          $isSlapAttack={displayPenguin.isSlapAttack}
          $isThrowing={penguin.isThrowing}
          $isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
          $isGrabbing={displayPenguin.isGrabbing}
          $isGrabbingMovement={penguin.isGrabbingMovement}
          $isBeingGrabbed={penguin.isBeingGrabbed}
          $isThrowingSalt={penguin.isThrowingSalt}
          $slapAnimation={displayPenguin.slapAnimation}
          $isBowing={penguin.isBowing}
          $isThrowTeching={penguin.isThrowTeching}
          $isBeingPulled={penguin.isBeingPulled}
          $isBeingPushed={penguin.isBeingPushed}
          $grabState={penguin.grabState}
          $grabAttemptType={penguin.grabAttemptType}
          $x={displayPosition.x}
          $y={displayPosition.y}
          $facing={penguin.facing ?? -1}
          $throwCooldown={penguin.throwCooldown}
          $grabCooldown={penguin.grabCooldown}
          $isChargingAttack={displayPenguin.isChargingAttack}
          $chargingFacingDirection={penguin.chargingFacingDirection}
          $saltCooldown={penguin.saltCooldown}
          $grabStartTime={penguin.grabStartTime}
          $grabbedOpponent={penguin.grabbedOpponent}
          $grabAttemptStartTime={penguin.grabAttemptStartTime}
          $throwTechCooldown={penguin.throwTechCooldown}
          $isSlapParrying={penguin.isSlapParrying}
          $lastThrowAttemptTime={penguin.lastThrowAttemptTime}
          $lastGrabAttemptTime={penguin.lastGrabAttemptTime}
          $dodgeDirection={displayPenguin.dodgeDirection}
          $isDodgeCancelling={penguin.isDodgeCancelling}
          $justLandedFromDodge={penguin.justLandedFromDodge}
          $speedFactor={penguin.speedFactor}
          $sizeMultiplier={penguin.sizeMultiplier}
          $isRecovering={penguin.isRecovering}
          $isRawParryStun={penguin.isRawParryStun}
          $isRawParrySuccess={penguin.isRawParrySuccess}
          $isPerfectRawParrySuccess={penguin.isPerfectRawParrySuccess}
          $isThrowingSnowball={penguin.isThrowingSnowball}
          $isSpawningPumoArmy={penguin.isSpawningPumoArmy}
          $isAtTheRopes={penguin.isAtTheRopes}
          $isCrouchStance={penguin.isCrouchStance}
          $isCrouchStrafing={penguin.isCrouchStrafing}
          $isGrabBreakCountered={penguin.isGrabBreakCountered}
          $isGrabClashActive={isGrabClashActive}
          $isAttemptingGrabThrow={penguin.isAttemptingGrabThrow}
          $ritualAnimationSrc={null}
          $isGrabPushing={penguin.isGrabPushing}
          $isBeingGrabPushed={penguin.isBeingGrabPushed}
          $isAttemptingPull={penguin.isAttemptingPull}
          $isBeingPullReversaled={penguin.isBeingPullReversaled}
          $isGrabSeparating={penguin.isGrabSeparating}
          $isGrabBellyFlopping={penguin.isGrabBellyFlopping}
          $isBeingGrabBellyFlopped={penguin.isBeingGrabBellyFlopped}
          $isGrabFrontalForceOut={penguin.isGrabFrontalForceOut}
          $isBeingGrabFrontalForceOut={penguin.isBeingGrabFrontalForceOut}
          $isGrabTeching={penguin.isGrabTeching}
          $grabTechRole={penguin.grabTechRole}
          $isGrabWhiffRecovery={penguin.isGrabWhiffRecovery}
          $isLocalPlayer={penguin.id === localId}
          style={{ display: showRitualSprite ? "none" : "block" }}
        />
      )}

      {/* Ritual Sprite Sheet Animation - all 4 parts pre-rendered, only current one visible */}
      {/* Each player's ritual stops independently when they select their power-up and start salt throwing */}
      {shouldShowRitualForPlayer &&
        (index === 0
          ? ritualSpritesheetsPlayer1
          : ritualSpritesheetsPlayer2
        ).map((config, partIndex) => (
          <RitualSpriteContainer
            key={partIndex}
            $x={displayPosition.x}
            $y={displayPosition.y}
            $facing={penguin.facing ?? -1}
            $partIndex={partIndex}
            style={{
              visibility: partIndex === ritualPart ? "visible" : "hidden",
              pointerEvents: "none",
            }}
          >
            <RitualSpriteImage
              src={getRecoloredSrc(config.spritesheet)}
              alt={`Ritual Part ${partIndex + 1}`}
              $frame={partIndex === ritualPart ? ritualFrame : 0}
              $frameCount={config.frameCount}
              $isLocalPlayer={penguin.id === localId}
              $playerIndex={index}
              draggable={false}
            />
          </RitualSpriteContainer>
        ))}

      <SlapAttackHandsEffect
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing ?? -1}
        isActive={penguin.isSlapAttack}
        slapAnimation={penguin.slapAnimation}
      />
      <SlapParryEffect position={parryEffectPosition} />
      <HitEffect position={hitEffectPosition} />
      <RawParryEffect position={rawParryEffectPosition} />
      <GrabBreakEffect position={grabBreakEffectPosition} />
      <GrabTechEffect position={grabTechEffectPosition} />
      <CounterGrabEffect position={trackedCounterGrabEffectPosition} />
      <PunishBannerEffect position={punishBannerPosition} />
      <CounterHitEffect position={counterHitEffectPosition} />
      <SnowballImpactEffect position={snowballImpactPosition} />
      <StarStunEffect
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing ?? -1}
        isActive={showStarStunEffect}
      />
      <EdgeDangerEffect
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing ?? -1}
        isActive={penguin.isAtTheRopes}
      />
      {/* NoStaminaEffect - centered on screen, only render once (index 0) and only for local player */}
      {index === 0 && noStaminaEffectKey > 0 && (
        <NoStaminaEffect showEffect={noStaminaEffectKey} />
      )}
      <ThickBlubberEffect
        x={thickBlubberEffect.x}
        y={thickBlubberEffect.y}
        isActive={thickBlubberEffect.isActive}
      />
      <ThrowTechEffect />
      {countdown > 0 &&
        !hakkiyoi &&
        !matchOver &&
        !gyojiState.includes("ready") && (
          <CountdownTimer>{countdown}</CountdownTimer>
        )}
      {allSnowballs.map((projectile) => (
        <div
          key={projectile.id}
          ref={(el) => {
            if (el) snowballDomRefs.current[projectile.id] = el;
            else delete snowballDomRefs.current[projectile.id];
          }}
          style={{ display: "contents" }}
        >
          <SnowballWrapper
            $x={projectile.x}
            $y={projectile.y}
            $vx={projectile.velocityX}
          >
            <SnowballProjectileImg src={snowball} alt="" draggable={false} />
          </SnowballWrapper>
        </div>
      ))}
      <PumoCloneSpawnEffect
        clones={allPumoArmies}
        player1Color={p1Color}
        player2Color={p2Color}
      />
      {allPumoArmies.map((clone) => {
        // Color the clone to match its owner's color
        // Uses the pre-cached recolored sprites (synchronous lookup, no perf cost)
        const ownerColor = clone.ownerPlayerNumber === 1 ? p1Color : p2Color;
        const needsCloneRecolor =
          ownerColor && ownerColor !== SPRITE_BASE_COLOR;

        // For strafing clones, use spritesheet animation (APNG recoloring loses animation frames)
        const waddleConfig = SPRITESHEET_CONFIG_BY_NAME.pumoWaddle;
        const isAnimatedClone = clone.isStrafing && waddleConfig;

        let cloneSprite;
        if (isAnimatedClone) {
          // Use the spritesheet (not the APNG) for animation
          cloneSprite = waddleConfig.spritesheet;
          if (needsCloneRecolor) {
            const cached = getCachedRecoloredImage(
              waddleConfig.spritesheet,
              BLUE_COLOR_RANGES,
              ownerColor
            );
            if (cached) cloneSprite = cached;
          }
        } else {
          // Static idle sprite
          cloneSprite = pumo;
          if (needsCloneRecolor) {
            const cached = getCachedRecoloredImage(
              pumo,
              BLUE_COLOR_RANGES,
              ownerColor
            );
            if (cached) cloneSprite = cached;
          }
        }

        return (
          <React.Fragment key={clone.id}>
            <PlayerShadow
              x={clone.x}
              y={clone.y}
              facing={clone.facing}
              isDodging={false}
              width="9%"
              height="2.04%"
              offsetLeft="-50%"
              offsetRight="-50%"
            />
            {isAnimatedClone ? (
              <AnimatedPumoCloneContainer
                $x={clone.x}
                $y={clone.y}
                $facing={clone.facing}
                $size={clone.size}
              >
                <AnimatedPumoCloneImage
                  src={cloneSprite}
                  alt="Pumo Clone"
                  $frameCount={waddleConfig.frameCount}
                  $fps={waddleConfig.fps}
                  draggable={false}
                />
              </AnimatedPumoCloneContainer>
            ) : (
              <PumoClone
                src={cloneSprite}
                alt="Pumo Clone"
                $x={clone.x}
                $y={clone.y}
                $facing={clone.facing}
                $size={clone.size}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Opponent Disconnected Overlay - Only show for local player */}
      {opponentDisconnected && player.id === localId && (
        <OpponentDisconnectedOverlay>
          <DisconnectedModal>
            <DisconnectedTitle>OPPONENT DISCONNECTED</DisconnectedTitle>
            <DisconnectedMessage>
              Your opponent has left the match.
            </DisconnectedMessage>
            <DisconnectedMessage>
              Returning to main menu in {disconnectCountdown} seconds...
            </DisconnectedMessage>
          </DisconnectedModal>
        </OpponentDisconnectedOverlay>
      )}
    </div>
  );
};

GameFighter.propTypes = {
  player: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  roomName: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  opponentDisconnected: PropTypes.bool.isRequired,
  disconnectedRoomId: PropTypes.string,
  onResetDisconnectState: PropTypes.func.isRequired,
  isPowerUpSelectionActive: PropTypes.bool,
  predictionRef: PropTypes.object, // Ref object for client-side prediction
};

// Optimize the component with React.memo
export default React.memo(GameFighter, (prevProps, nextProps) => {
  // Add custom comparison logic if needed
  // Note: predictionRef is intentionally not compared since it's a stable ref
  return (
    prevProps.player === nextProps.player &&
    prevProps.index === nextProps.index &&
    prevProps.roomName === nextProps.roomName &&
    prevProps.localId === nextProps.localId &&
    prevProps.setCurrentPage === nextProps.setCurrentPage &&
    prevProps.opponentDisconnected === nextProps.opponentDisconnected &&
    prevProps.disconnectedRoomId === nextProps.disconnectedRoomId &&
    prevProps.onResetDisconnectState === nextProps.onResetDisconnectState &&
    prevProps.isPowerUpSelectionActive === nextProps.isPowerUpSelectionActive
  );
});
