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
import Gyoji from "./Gyoji";
import {
  getSpritesheetConfig,
  SPRITESHEET_CONFIG_BY_NAME,
} from "../config/animatedSpriteConfig";
import PlayerShadow from "./PlayerShadow";
import ThrowTechEffect from "./ThrowTechEffect";
import SlapParryEffect from "./SlapParryEffect";
import ChargeClashEffect from "./ChargeClashEffect";
import { useParticles } from "../particles/ParticleContext";
import StarStunEffect from "./StarStunEffect";
import ThickBlubberEffect from "./ThickBlubberEffect";
import GrabBreakEffect from "./GrabBreakEffect";
import GrabTechEffect from "./GrabTechEffect";
import ClinchJoltEffect from "./ClinchJoltEffect";
import CounterGrabEffect from "./CounterGrabEffect";
import PunishBannerEffect from "./PunishBannerEffect";
import CounterHitEffect from "./CounterHitEffect";
import EdgeDangerEffect from "./EdgeDangerEffect";
import NoStaminaEffect from "./GassedEffect";
import SnowballImpactEffect from "./SnowballImpactEffect";
import PumoCloneSpawnEffect from "./PumoCloneSpawnEffect";
import SlapAttackHandsEffect from "./SlapAttackHandsEffect";
import SumoGameAnnouncement from "./SumoGameAnnouncement";
import {
  recolorImage,
  getCachedRecoloredImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
  COLOR_PRESETS,
} from "../utils/SpriteRecolorizer";
import { usePlayerColors } from "../context/PlayerColorContext";

import UiPlayerInfo from "./UiPlayerInfo";
import MatchOver from "./MatchOver";
import RoundResult from "./RoundResult";
import HitEffect from "./HitEffect";
import RawParryEffect from "./RawParryEffect";
import { getGlobalVolume } from "./Settings";
import { playBuffer, createCrossfadeLoop } from "../utils/audioEngine";
import SnowEffect from "./SnowEffect";
import "./theme.css";
import { SERVER_BROADCAST_HZ, DOHYO_LEFT_BOUNDARY, DOHYO_RIGHT_BOUNDARY } from "../constants";
import { getDisplayHitstopUntil } from "../lib/serverClock";

// Assets, sounds, preloading, constants, ritual config, playSound helper
import {
  pumo,
  dodging,
  recovering,
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
  glassBreakSound,
  counterGrabSound,
  notEnoughStaminaSound,
  isTechingSound,
  roundVictorySound,
  roundDefeatSound,
  strafingSound,
  heartbeatSound,
  clap2Sound,
  SPRITE_HALF_W,
  PLAYER_MID_Y,
  CLAP_SOUND_OFFSET,
  ritualSpritesheetsPlayer1,
  ritualSpritesheetsPlayer2,
  ritualClapSounds,
  playSound,
  playSoundVaried,
  slapHitSounds,
  slapWhiffSounds,
  chargedHitSounds,
  grabHitSounds,
  pickRandomSound,
  xToPan,
  chargeAttackLaunchSound,
  gunLaunchSound,
  chargedHit04,
  hit as hitSprite,
} from "./fighterAssets";
import getImageSrc from "./getImageSrc";
import {
  StyledImage,
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

// =====================================================================
// Pumo clone sprite resolution
// ---------------------------------------------------------------------
// Fighter sprites have a robust render path (sync cache → local async
// recolor state → tint-fallback) so a cache miss never flashes the raw
// blue source. Pumo clones used to call only `getCachedRecoloredImage`,
// which meant any miss (race, eviction, mid-match color change) showed
// the default blue penguin. With the Pumo Army charge bump we now have
// up to 9 simultaneous clones per player; brittleness compounds.
//
// This hook gives clones the same resilience: it returns the cached
// recolored URL if available, otherwise it kicks an async recolor and
// returns the base sprite while we wait — never null, never wrong color
// for longer than one paint after the recolor finishes.
//
// The hook is also a memo point: calling it once per (player, baseSrc)
// at the GameFighter level — instead of inline inside the clone .map —
// collapses N per-frame cache lookups into 4 (p1/p2 × animated/static).
// =====================================================================
function useRecoloredCloneSrc(baseSrc, ownerColor, ownerBodyColor) {
  const needsRecolor =
    !!baseSrc &&
    !!ownerColor &&
    (ownerColor !== SPRITE_BASE_COLOR || !!ownerBodyColor);

  const cachedSrc = useMemo(() => {
    if (!needsRecolor) return null;
    const opts = ownerBodyColor
      ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: ownerBodyColor }
      : {};
    return getCachedRecoloredImage(
      baseSrc,
      BLUE_COLOR_RANGES,
      ownerColor,
      opts
    );
  }, [baseSrc, ownerColor, ownerBodyColor, needsRecolor]);

  const [asyncSrc, setAsyncSrc] = useState(null);

  useEffect(() => {
    // Whenever the inputs change we must drop any stale async result so we
    // don't flash the previous owner's color before the new recolor lands.
    setAsyncSrc(null);

    if (!needsRecolor || cachedSrc) return undefined;

    let cancelled = false;
    const opts = ownerBodyColor
      ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: ownerBodyColor }
      : {};
    // recolorImage() dedupes concurrent calls with the same key via
    // inFlightRecolors, so calling this from multiple GameFighter
    // instances with the same color is a single shared promise.
    recolorImage(baseSrc, BLUE_COLOR_RANGES, ownerColor, opts)
      .then((url) => {
        if (!cancelled) setAsyncSrc(url);
      })
      .catch(() => {
        /* keep the base sprite as graceful fallback */
      });

    return () => {
      cancelled = true;
    };
  }, [baseSrc, ownerColor, ownerBodyColor, needsRecolor, cachedSrc]);

  if (!needsRecolor) return baseSrc;
  return cachedSrc || asyncSrc || baseSrc;
}

const GameFighter = ({
  player,
  index,
  roomName,
  localId,
  setCurrentPage,
  opponentDisconnected,
  disconnectedRoomId,
  onResetDisconnectState,
  predictionRef,
  playerColor, // Custom color for mawashi/headband recoloring
  playerBodyColor, // Custom body color (null = default grey)
  isCPUMatch, // True when playing vs CPU — hides PvP-only HUD bits (rematch tally)
}) => {
  const { socket } = useContext(SocketContext);
  const { emit: emitParticles, setFrozen: setParticlesFrozen, clearRawParryBlueHold } = useParticles();

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

  // Get both player colors (belt + body) for pumo clone coloring
  const {
    player1Color: p1Color, player2Color: p2Color,
    player1BodyColor: p1BodyColor, player2BodyColor: p2BodyColor,
  } = usePlayerColors();

  // ============================================
  // PUMO CLONE SPRITE RESOLUTION
  // Resolve the recolored clone sprite per (player, base) ONCE per render
  // and reuse it across the inline .map below. With 3 charges allowing up
  // to 9 simultaneous clones per player, doing this lookup per-clone
  // per-frame caused noticeable churn AND any cache miss painted the
  // default blue. The hook returns the cached recolored URL if available,
  // else triggers async recolor and falls back to the base sprite — same
  // resilience the fighter render path has. Hooks must be unconditional
  // so we always call them; the cache is global so duplicate calls from
  // both GameFighter instances are deduped by inFlightRecolors.
  // ============================================
  const pumoWaddleConfig = SPRITESHEET_CONFIG_BY_NAME.pumoWaddle;
  const pumoWaddleBase = pumoWaddleConfig?.spritesheet || null;
  const p1AnimatedCloneSrc = useRecoloredCloneSrc(pumoWaddleBase, p1Color, p1BodyColor);
  const p2AnimatedCloneSrc = useRecoloredCloneSrc(pumoWaddleBase, p2Color, p2BodyColor);
  const p1StaticCloneSrc = useRecoloredCloneSrc(pumo, p1Color, p1BodyColor);
  const p2StaticCloneSrc = useRecoloredCloneSrc(pumo, p2Color, p2BodyColor);

  // Function to get sprite render info (handles both static and animated sprites)
  // Returns: { src, isAnimated, config } where config contains spritesheet animation data
  // When isHit is true, uses hit-tinted variant (mawashi/headband unchanged, rest tinted red)
  // When isWhiteFlash is true, uses white-tinted variant (dash invincibility flash)
  // When isBlubberTint is true, uses purple-tinted variant for thick blubber power-up
  // When isArmorTint is true, uses pink-tinted variant for grab-armor absorb flash
  const getSpriteRenderInfo = useCallback(
    (
      originalSrc,
      isHit = false,
      isWhiteFlash = false,
      isBlubberTint = false,
      forceStatic = false,
      isArmorTint = false
    ) => {
      if (!originalSrc) {
        return { src: originalSrc, isAnimated: false, config: null };
      }

      // Check if this is an animated spritesheet (skip lookup when forceStatic)
      const spritesheetConfig = forceStatic ? null : getSpritesheetConfig(originalSrc);
      const isAnimated = !!spritesheetConfig;

      // Determine the source to recolor (spritesheet for animated, original for static)
      const sourceToRecolor = isAnimated
        ? spritesheetConfig.spritesheet
        : originalSrc;
      const useHitTint = isHit;
      const useWhiteFlash = isWhiteFlash;
      const useBlubberTint = isBlubberTint;
      const useArmorTint = isArmorTint;

      if (
        !needsRecoloring &&
        !useHitTint &&
        !useWhiteFlash &&
        !useBlubberTint &&
        !useArmorTint
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
      if (useArmorTint) tintOptions.armorTintPink = true;

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
      }${useArmorTint ? "_armor" : ""}`;
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

      // CACHE-MISS FALLBACK for tint variants — instead of returning the raw
      // un-recolored source (which would flash the default-color penguin while
      // the tinted variant computes), fall back to the regular body+mawashi
      // recolored sprite. The player keeps their colors; they just don't see
      // the tint for that one frame, which is invisible to the eye.
      const isAnyTint = useHitTint || useWhiteFlash || useBlubberTint || useArmorTint;
      if (isAnyTint && needsRecoloring) {
        const baseTintOptions = playerBodyColor
          ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: playerBodyColor }
          : {};
        const baseGlobalCached = getCachedRecoloredImage(
          sourceToRecolor,
          colorRanges,
          targetColor,
          baseTintOptions
        );
        if (baseGlobalCached) {
          return {
            src: baseGlobalCached,
            isAnimated,
            config: spritesheetConfig,
          };
        }
        const baseCacheKey = `${sourceToRecolor}_${targetColor}${
          playerBodyColor ? "_body_" + playerBodyColor : ""
        }`;
        if (recoloredSprites[baseCacheKey]) {
          return {
            src: recoloredSprites[baseCacheKey],
            isAnimated,
            config: spritesheetConfig,
          };
        }
      }

      // Return original/spritesheet while recoloring is in progress (no base variant available)
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
    isSidestepping: false,
    isSidestepStartup: false,
    isSidestepRecovery: false,
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
    snowballThrowsRemaining: null,
    lastSnowballTime: 0,
    pumoArmy: [],
    pumoArmyCooldown: false,
    pumoArmySpawnsRemaining: null,
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
  const lastRenderedPositionRef = useRef({ x: 0, y: 0 });
  const [interpolatedPosition, setInterpolatedPosition] = useState({
    x: 0,
    y: 0,
  });
  const previousState = useRef(null);
  const currentState = useRef(null);
  const lastUpdateTime = useRef(performance.now());
  const previousUpdateTime = useRef(0);
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
  const [, setPredictionTrigger] = useState(0);

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
        !penguin.isSidestepping &&
        !penguin.isSidestepRecovery &&
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

  // Helper: Check if player can dash (more permissive - allows during charging)
  const canPredictDash = useCallback(
    (gameStarted) => {
      if (!gameStarted) return false;

      return (
        !penguin.isAttacking &&
        !penguin.isDodging &&
        !penguin.isDodgeRecovery &&
        !penguin.isSidestepping &&
        !penguin.isSidestepRecovery &&
        !penguin.justLandedFromDodge &&
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
        case "dash":
          // Dash has special rules - allowed during charging
          if (canPredictDash(gameStarted)) {
            predictedState.current = {
              ...predictedState.current,
              isDodging: true,
              dodgeDirection: action.direction || penguin.facing,
              // CRITICAL: Dash cancels charging - clear it to prevent visual flicker
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
        case "power_slide_start": {
          const SLIDE_MIN_VELOCITY = 0.5;
          const hasEnoughVelocity =
            Math.abs(penguin.movementVelocity || 0) >= SLIDE_MIN_VELOCITY;
          const blockSlideForAttack =
            penguin.isAttacking && penguin.isSlapAttack;
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
            !predictedState.current.isPowerSliding
          ) {
            predictedState.current = {
              ...predictedState.current,
              isPowerSliding: true,
              isBraking: false,
              isAttacking: false,
              isSlapAttack: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        }
        case "power_slide_end": {
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
        }
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
      canPredictDash,
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
  const allPlayersDataRef = useRef({ player1: null, player2: null });
  const prevUiSnapshot = useRef({});
  const [hakkiyoi, setHakkiyoi] = useState(false);
  const [gyojiCall, setGyojiCall] = useState(null); // Gyoji's call before HAKKIYOI (e.g., "TE WO TSUITE!")
  const [gyojiState, setGyojiState] = useState("idle");
  const [gameOver, setGameOver] = useState(false);
  const [showRoundResult, setShowRoundResult] = useState(false); // Deferred from gameOver to prevent freeze
  const [winType, setWinType] = useState(null);
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
  const [chargeClashEffectPosition, setChargeClashEffectPosition] = useState(null);
  const [hitEffectPosition, setHitEffectPosition] = useState(null);
  const [rawParryEffectPosition, setRawParryEffectPosition] = useState(null);
  const [p1ParryRefund, setP1ParryRefund] = useState(0);
  const [p2ParryRefund, setP2ParryRefund] = useState(0);
  const [p1BalanceGain, setP1BalanceGain] = useState(0);
  const [p2BalanceGain, setP2BalanceGain] = useState(0);
  const [showStarStunEffect, setShowStarStunEffect] = useState(false);
  const [hasUsedPowerUp, setHasUsedPowerUp] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const countdownRef = useRef(null);
  const pendingSocketTimeouts = useRef([]);
  const pendingSocketRafs = useRef([]);
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
  // (Sprite tint for grab-armor absorb intentionally removed — the
  // particle VFX alone communicates the absorb; tinting the body
  // washed the player out and competed with the ring's own color.)
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
  const [clinchJoltEffectPosition, setClinchJoltEffectPosition] = useState(null);

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

  const trackedCounterGrabEffectPosition = useMemo(() => {
    if (!counterGrabEffectPosition) return null;
    if (index !== 0) return counterGrabEffectPosition;

    const { grabberId, grabbedId } = counterGrabEffectPosition;
    if (!grabberId || !grabbedId) return counterGrabEffectPosition;

    const player1 = allPlayersDataRef.current.player1;
    const player2 = allPlayersDataRef.current.player2;
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
  }, [counterGrabEffectPosition, index]);

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
      // Hitstop visual sync: while a server-anchored display freeze is active,
      // pin the rendered position to whatever was last committed. The state
      // stream still updates currentState/previousState refs underneath; we
      // just don't advance the interpolated position so both clients exit
      // the freeze at the same server-clock moment regardless of ping.
      const hitstopUntil = getDisplayHitstopUntil();
      if (hitstopUntil > 0 && timestamp < hitstopUntil) {
        interpolationIdRef.current = requestAnimationFrame(interpolationLoop);
        return;
      }

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
        interpolatedPositionRef.current = newPos;

        // PERFORMANCE: Only update React state if position changed noticeably.
        // Compare against the last position committed to React state (not the
        // per-frame ref) so small per-frame deltas accumulate until they cross
        // the threshold — prevents visual freeze during slow clinch pushes.
        const positionDelta =
          Math.abs(newPos.x - lastRenderedPositionRef.current.x) +
          Math.abs(newPos.y - lastRenderedPositionRef.current.y);
        if (positionDelta >= MIN_POSITION_CHANGE) {
          lastRenderedPositionRef.current = newPos;
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
    if (!interpolatedPosition.x && !interpolatedPosition.y && penguin.x) {
      return { x: penguin.x, y: penguin.y };
    }
    return interpolatedPosition;
  }, [
    interpolatedPosition,
    penguin.x,
    penguin.y,
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
  const chargeAnimKeyRef = useRef(0);
  const prevChargingRef = useRef(false);
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
  const musicBaseVolume = useRef(0.029 * getGlobalVolume());

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

  // FPS counter RAF loop removed — it consumed a full rAF slot per
  // GameFighter instance (×2) with no visible output.

  // PERFORMANCE: Refs to store accumulated player state for delta merging
  const accumulatedPlayer1State = useRef(null);
  const accumulatedPlayer2State = useRef(null);

  // Memoize frequently accessed socket listeners to prevent recreation
  const handleFighterAction = useCallback(
    (data) => {
      const currentTime = performance.now();

      // PERFORMANCE: Handle delta updates by merging into existing refs in-place
      // (avoids creating new objects 32×/sec which causes GC pressure)
      let player1Data, player2Data;

      if (
        data.isDelta &&
        accumulatedPlayer1State.current &&
        accumulatedPlayer2State.current
      ) {
        const d1 = data.player1;
        const d2 = data.player2;
        const a1 = accumulatedPlayer1State.current;
        const a2 = accumulatedPlayer2State.current;
        for (const k in d1) a1[k] = d1[k];
        for (const k in d2) a2[k] = d2[k];
        player1Data = a1;
        player2Data = a2;
      } else {
        accumulatedPlayer1State.current = { ...data.player1 };
        accumulatedPlayer2State.current = { ...data.player2 };
        player1Data = accumulatedPlayer1State.current;
        player2Data = accumulatedPlayer2State.current;
      }

      // Always update ref (read by counter-grab positioning etc.)
      allPlayersDataRef.current.player1 = player1Data;
      allPlayersDataRef.current.player2 = player2Data;

      // Only trigger React re-render when UI-visible properties change.
      // Because accumulated state is mutated in-place, we compare against a
      // separate snapshot of primitive values (not the object reference).
      if (index === 0) {
        const snap = prevUiSnapshot.current;
        if (
          snap.p1Stam !== player1Data.stamina ||
          snap.p2Stam !== player2Data.stamina ||
          snap.p1Pow !== player1Data.activePowerUp ||
          snap.p2Pow !== player2Data.activePowerUp ||
          snap.p1SbCd !== player1Data.snowballCooldown ||
          snap.p2SbCd !== player2Data.snowballCooldown ||
          snap.p1SbRem !== player1Data.snowballThrowsRemaining ||
          snap.p2SbRem !== player2Data.snowballThrowsRemaining ||
          snap.p1PaCd !== player1Data.pumoArmyCooldown ||
          snap.p2PaCd !== player2Data.pumoArmyCooldown ||
          snap.p1PaRem !== player1Data.pumoArmySpawnsRemaining ||
          snap.p2PaRem !== player2Data.pumoArmySpawnsRemaining ||
          snap.p1Gas !== player1Data.isGassed ||
          snap.p2Gas !== player2Data.isGassed ||
          snap.p1Edge !== player1Data.isBeingEdgePushed
        ) {
          snap.p1Stam = player1Data.stamina;
          snap.p2Stam = player2Data.stamina;
          snap.p1Pow = player1Data.activePowerUp;
          snap.p2Pow = player2Data.activePowerUp;
          snap.p1SbCd = player1Data.snowballCooldown;
          snap.p2SbCd = player2Data.snowballCooldown;
          snap.p1SbRem = player1Data.snowballThrowsRemaining;
          snap.p2SbRem = player2Data.snowballThrowsRemaining;
          snap.p1PaCd = player1Data.pumoArmyCooldown;
          snap.p2PaCd = player2Data.pumoArmyCooldown;
          snap.p1PaRem = player1Data.pumoArmySpawnsRemaining;
          snap.p2PaRem = player2Data.pumoArmySpawnsRemaining;
          snap.p1Gas = player1Data.isGassed;
          snap.p2Gas = player2Data.isGassed;
          snap.p1Edge = player1Data.isBeingEdgePushed;
          setAllPlayersData({ player1: player1Data, player2: player2Data });
        }
      }

      // Get the relevant player data based on index
      const playerData = index === 0 ? player1Data : player2Data;

      // Store previous state for interpolation (mutate in-place to avoid GC)
      if (currentState.current) {
        if (!previousState.current) {
          previousState.current = { x: 0, y: 0, facing: 1, knockbackVelocity: null };
        }
        previousState.current.x = currentState.current.x;
        previousState.current.y = currentState.current.y;
        previousState.current.facing = currentState.current.facing;
        previousState.current.knockbackVelocity = currentState.current.knockbackVelocity;
      }

      // Store current state (mutate in-place)
      if (!currentState.current) {
        currentState.current = { x: 0, y: 0, facing: 1, knockbackVelocity: null };
      }
      currentState.current.x = playerData.x;
      currentState.current.y = playerData.y;
      currentState.current.facing = playerData.facing;
      currentState.current.knockbackVelocity = playerData.knockbackVelocity;

      // Track actual intervals between server updates for adaptive interpolation
      previousUpdateTime.current = lastUpdateTime.current;
      lastUpdateTime.current = currentTime;

      // If this is the first update, set previous state to current
      if (!previousState.current) {
        previousState.current = { ...currentState.current };
        const initPos = { x: playerData.x, y: playerData.y };
        lastRenderedPositionRef.current = initPos;
        setInterpolatedPosition(initPos);
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
          isSidestepping: playerData.isSidestepping ?? prev.isSidestepping ?? false,
          isSidestepStartup: playerData.isSidestepStartup ?? prev.isSidestepStartup ?? false,
          isSidestepRecovery: playerData.isSidestepRecovery ?? prev.isSidestepRecovery ?? false,
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
          prev.isDodgeRecovery !== newState.isDodgeRecovery ||
          prev.justLandedFromDodge !== newState.justLandedFromDodge ||
          prev.isRopeJumping !== newState.isRopeJumping ||
          prev.ropeJumpPhase !== newState.ropeJumpPhase ||
          prev.isSidestepping !== newState.isSidestepping ||
          prev.isSidestepStartup !== newState.isSidestepStartup ||
          prev.isSidestepRecovery !== newState.isSidestepRecovery ||
          prev.hasGrip !== newState.hasGrip ||
          prev.inClinch !== newState.inClinch ||
          prev.clinchAction !== newState.clinchAction ||
          prev.isBeingLifted !== newState.isBeingLifted ||
          prev.isClinchThrowing !== newState.isClinchThrowing ||
          prev.isClinchClashing !== newState.isClinchClashing ||
          prev.isClinchLifting !== newState.isClinchLifting ||
          prev.isClinchPushing !== newState.isClinchPushing ||
          prev.isClinchPlanting !== newState.isClinchPlanting ||
          prev.isResistingThrow !== newState.isResistingThrow ||
          prev.isResistingPull !== newState.isResistingPull ||
          prev.isClinchKillThrowVictim !== newState.isClinchKillThrowVictim ||
          prev.isClinchKillPullVictim !== newState.isClinchKillPullVictim ||
          prev.isClinchJolting !== newState.isClinchJolting ||
          prev.isBeingClinchJolted !== newState.isBeingClinchJolted ||
          prev.isClinchJoltClashing !== newState.isClinchJoltClashing ||
          prev.clinchJoltRecovery !== newState.clinchJoltRecovery;

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
        const combinedSnowballs = (player1Data.snowballs || []).concat(
          player2Data.snowballs || []
        );

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
        const p1a = player1Data.pumoArmy || [];
        const p2a = player2Data.pumoArmy || [];
        const combined = new Array(p1a.length + p2a.length);
        for (let i = 0; i < p1a.length; i++) {
          combined[i] = { ...p1a[i], ownerPlayerNumber: 1 };
        }
        for (let i = 0; i < p2a.length; i++) {
          combined[p1a.length + i] = { ...p2a[i], ownerPlayerNumber: 2 };
        }
        setAllPumoArmies(combined);
      }
    },
    [index]
  );

  useEffect(() => {
    socket.on("fighter_action", handleFighterAction);

    const handleSlapParry = (data) => {
      if (
        data &&
        typeof data.x === "number" &&
        typeof data.y === "number"
      ) {
        setParryEffectPosition({
          x: data.x + SPRITE_HALF_W,
          y: PLAYER_MID_Y,
        });
        playSound(slapParrySound, 0.01);
        if (index === 0) {
          emitParticles("slapParryClash", {
            x: data.x + SPRITE_HALF_W,
            y: PLAYER_MID_Y,
            p1x: data.p1x,
            p2x: data.p2x,
            intensity: data.intensity || 1,
          });
        }
      }
    };
    socket.on("slap_parry", handleSlapParry);

    const handleChargeClash = (data) => {
      if (
        data &&
        typeof data.x === "number" &&
        typeof data.y === "number"
      ) {
        setChargeClashEffectPosition({
          x: data.x + SPRITE_HALF_W,
          y: PLAYER_MID_Y,
        });
        if (index === 0) {
          const pan = xToPan(data.x);
          playSound(pickRandomSound(chargedHitSounds), 0.04, null, 0.8, pan);
          duckMusic(0.3, 400);
        }
      }
    };
    socket.on("charge_clash", handleChargeClash);

    const handlePlayerHit = (data) => {
      if (data && typeof data.x === "number" && typeof data.y === "number") {
        lastPlayerHitTime.current = Date.now();
        const isBurst = data.attackType === "slap" && data.stringPos === 3;

        // Attacker-side hit-confirm flash. Fires only on the GameFighter
        // instance whose player.id matches the server-provided attackerId, so each
        // local fighter pulses independently when *they* land a hit. The tier
        // scales the glow intensity in the styled-component pop filter.
        if (data.attackerId && data.attackerId === player.id) {
          let tier = "slap";
          if (data.attackType === "charged") tier = "charged";
          else if (isBurst) tier = "burst";
          if (data.cinematicKill) tier = "cinematic";
          setAttackerConfirmTier(tier);
          if (attackerConfirmTimeoutRef.current) {
            clearTimeout(attackerConfirmTimeoutRef.current);
          }
          // Cinematic / charged confirms linger longer so the satisfaction matches the weight.
          // Slap is short — combos fire fast and the pulse must clear before the next hit.
          const dur =
            tier === "cinematic" ? 280 :
            tier === "charged" ? 200 :
            tier === "burst" ? 220 : 140;
          attackerConfirmTimeoutRef.current = setTimeout(() => {
            setAttackerConfirmTier(null);
            attackerConfirmTimeoutRef.current = null;
          }, dur);
        }

        if (index === 0 && !data.cinematicKill) {
          const pan = xToPan(data.x);
          if (data.attackType === "slap") {
            const baseSound = pickRandomSound(slapHitSounds);
            playSoundVaried(baseSound, 0.038, null, 1.0, pan);
            // Burst (combo finisher) ducks deeper & longer than string hits 1/2 — sells the weight.
            // Counter / punish ducks deeper too — the moment matters, let it breathe.
            if (isBurst) {
              duckMusic(0.22, 520);
            } else if (data.isCounterHit || data.isPunish) {
              duckMusic(0.3, 400);
            } else {
              duckMusic(0.4, 300);
            }
            // A5 sound layering — counter / punish gets a second pitched layer
            // on top of the base hit. We don't have unique counter/punish sfx
            // assets so we synthesize them by re-using the same sample at a
            // different rate (cheap, recognizable, no perceptible artifacts).
            //   - Counter: pitched DOWN, played simultaneously → adds "thud" weight
            //   - Punish:  pitched UP,   played simultaneously → adds "crack" snap
            // Both reuse the same selected base sound so the layer sounds like
            // it belongs together, not a separate hit.
            if (data.isCounterHit) {
              playSound(baseSound, 0.022, null, 0.78, pan);
            } else if (data.isPunish) {
              playSound(baseSound, 0.020, null, 1.32, pan);
            }
          } else {
            const baseSound = pickRandomSound(chargedHitSounds);
            playSound(baseSound, 0.045, null, 1.0, pan);
            // Charged punish/counter: deeper than a normal charged hit — they're earned.
            duckMusic(data.isCounterHit || data.isPunish ? 0.15 : 0.2, 500);
            // Same layering treatment as slaps but slightly louder/wider pitch
            // gap because charged hits already have weight — the layer needs to
            // stand out without overpowering the primary thwack.
            if (data.isCounterHit) {
              playSound(baseSound, 0.028, null, 0.72, pan);
            } else if (data.isPunish) {
              playSound(baseSound, 0.026, null, 1.36, pan);
            }
          }
        }
        setHitEffectPosition({
          x: data.x + 70,
          y: PLAYER_MID_Y,
          facing: data.facing || 1,
          timestamp: data.timestamp,
          hitId: data.hitId,
          attackType: data.attackType || "slap",
          isBurstHit: isBurst,
          isCounterHit: data.isCounterHit || false,
          isPunish: data.isPunish || false,
          isArmorBreak: data.isArmorBreak || false,
          cinematicKill: data.cinematicKill || false,
          cinematicHitstopMs: data.cinematicKill ? 550 : 0,
        });

        const hitFacing = data.facing || 1;
        const facingOffsetPx = (hitFacing === 1 ? -8 : -3) * 12.8;
        const sparkOpts = { x: data.x + 70 + facingOffsetPx, y: PLAYER_MID_Y, facing: hitFacing };
        if (data.attackType === "charged") {
          emitParticles("hitSparkCharged", sparkOpts);
        } else if (isBurst) {
          emitParticles("hitSparkBurst", sparkOpts);
        } else {
          emitParticles("hitSparkSlap", sparkOpts);
        }

        // Charged-hit knockback trail (A4): only the victim's GameFighter instance
        // tracks its own interpolated position over the next ~280ms and emits speed
        // lines behind the flight path. Skipped for cinematic kills (they have
        // their own much-bigger cinematicKillTrail) and for slap hits (knockback
        // is too short to read as flight). Sells the weight of charged hits at
        // a glance — you SEE the launch, not just the impact spark.
        const isVictimOfChargedHit =
          data.attackType === "charged" &&
          !data.cinematicKill &&
          data.victimId &&
          data.victimId === player.id;
        if (isVictimOfChargedHit) {
          if (knockbackTrailIntervalsRef.current.length > 0) {
            knockbackTrailIntervalsRef.current.forEach((id) => clearInterval(id));
            knockbackTrailIntervalsRef.current = [];
          }
          const trailDir = data.knockbackDirection || (data.facing === 1 ? -1 : 1);
          const TRAIL_INTERVAL_MS = 28;
          const TRAIL_DURATION_MS = 280;
          const maxTicks = Math.ceil(TRAIL_DURATION_MS / TRAIL_INTERVAL_MS);
          let tick = 0;
          const intervalId = setInterval(() => {
            tick++;
            if (tick > maxTicks) {
              clearInterval(intervalId);
              return;
            }
            const pos = interpolatedPositionRef.current;
            if (pos && typeof pos.x === "number") {
              emitParticles("chargedHitKnockbackTrail", {
                x: pos.x,
                y: pos.y ?? 290,
                direction: trailDir,
              });
            }
          }, TRAIL_INTERVAL_MS);
          knockbackTrailIntervalsRef.current.push(intervalId);
        }
      }
    };
    socket.on("player_hit", handlePlayerHit);

    const handleRawParrySuccess = (data) => {
      lastRawParryTime.current = Date.now();
      if (data && typeof data.parrierX === "number") {
        // Two GameFighter instances both listen to this event; only index 0
        // owns the HUD portal + shared VFX state (same pattern as UiPlayerInfo).
        // Without this guard, RawParryEffect mounts twice and PERFECT banners
        // stack in #game-hud.
        if (index !== 0) return;
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
        // Signal perfect-parry balance gain to the HUD (only for perfect parries
        // that actually moved the balance bar — server reports clamped delta)
        if (data.isPerfect && data.balanceGain > 0) {
          if (data.playerNumber === 1) {
            setP1BalanceGain(Date.now());
          } else if (data.playerNumber === 2) {
            setP2BalanceGain(Date.now());
          }
        }
        const parryPan = xToPan(data.parrierX);
        playSound(rawParryGruntSound, 0.025, null, 1.0, parryPan);
        if (data.isPerfect) {
          playSound(rawParrySuccessSound, 0.015, null, 1.0, parryPan);
        } else {
          playSound(regularRawParrySound, 0.04, null, 1.0, parryPan);
        }
      }
    };
    socket.on("raw_parry_success", handleRawParrySuccess);

    const handlePerfectParry = (data) => {
      if (
        data &&
        typeof data.stunnedPlayerX === "number" &&
        typeof data.stunnedPlayerY === "number" &&
        data.showStarStunEffect
      ) {
        if (data.attackingPlayerId === player.id) {
          setShowStarStunEffect(true);
        }
      }
    };
    socket.on("perfect_parry", handlePerfectParry);

    let handleGrabBreak, handleGrabTech, handleClinchTech, handleCounterGrab,
        handlePunishBanner, handleCounterHit, handleStaminaBlocked;
    if (index === 0) {
      handleGrabBreak = (data) => {
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
      };
      socket.on("grab_break", handleGrabBreak);

      handleGrabTech = (data) => {
        if (data && typeof data.x === "number") {
          setGrabTechEffectPosition({
            x: data.x + SPRITE_HALF_W,
            y: PLAYER_MID_Y,
            techId: data.techId || `tech-${Date.now()}`,
            facing: data.grabberFacing || 1,
          });
          playSound(isTechingSound, 0.04);
        }
      };
      socket.on("grab_tech", handleGrabTech);

      let wasClinchClashing = false;
      handleClinchTech = (data) => {
        const p1 = data.isDelta && accumulatedPlayer1State.current
          ? accumulatedPlayer1State.current : data.player1;
        const p2 = data.isDelta && accumulatedPlayer2State.current
          ? accumulatedPlayer2State.current : data.player2;
        const nowClashing = p1.isClinchClashing || p2.isClinchClashing;
        if (nowClashing && !wasClinchClashing) {
          const centerX = (p1.x + p2.x) / 2;
          setGrabTechEffectPosition({
            x: centerX + SPRITE_HALF_W,
            y: PLAYER_MID_Y,
            techId: `clinch-tech-${Date.now()}`,
            facing: p1.x < p2.x ? 1 : -1,
          });
          playSound(isTechingSound, 0.04);
        }
        wasClinchClashing = nowClashing;
      };
      socket.on("fighter_action", handleClinchTech);

      handleCounterGrab = (data) => {
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
      };
      socket.on("counter_grab", handleCounterGrab);

      handlePunishBanner = (data) => {
        if (data?.counterId) {
          setPunishBannerPosition({
            counterId: data.counterId,
            grabberPlayerNumber: data.grabberPlayerNumber ?? 1,
          });
        }
      };
      socket.on("punish_banner", handlePunishBanner);

      handleCounterHit = (data) => {
        if (data && typeof data.x === "number" && typeof data.y === "number") {
          setCounterHitEffectPosition({
            x: data.x + 70,
            y: PLAYER_MID_Y,
            counterId: data.counterId || `counter-hit-${Date.now()}`,
            playerNumber: data.playerNumber || 1,
            timestamp: data.timestamp,
          });
        }
      };
      socket.on("counter_hit", handleCounterHit);

      handleStaminaBlocked = (data) => {
        if (data.playerId === localId) {
          playSound(notEnoughStaminaSound, 0.08);
          const newKey = Date.now();
          setNoStaminaEffectKey(newKey);
          const tid = setTimeout(() => {
            setNoStaminaEffectKey((current) =>
              current === newKey ? 0 : current
            );
          }, 900);
          pendingSocketTimeouts.current.push(tid);
        }
      };
      socket.on("stamina_blocked", handleStaminaBlocked);
    }

    const handleSnowballHit = (data) => {
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
    };
    socket.on("snowball_hit", handleSnowballHit);

    // Power-ups revealed simultaneously after both players have picked
    // This prevents counter-picking by hiding choices until both are locked in
    // The visual reveal is now handled by the PowerUpReveal component in Game.jsx
    const handlePowerUpsRevealed = (data) => {
      const thisPlayerData =
        data.player1.playerId === player.id ? data.player1 : data.player2;

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

        setScreenShake({
          intensity: 0.35,
          duration: 150,
          startTime: Date.now(),
        });
      }
    };
    socket.on("power_ups_revealed", handlePowerUpsRevealed);

    const handleGameReset = (data) => {
      setGameOver(data);
      setShowRoundResult(false);
      setWinType(null);
      if (showRoundResultRafRef.current) {
        cancelAnimationFrame(showRoundResultRafRef.current);
        showRoundResultRafRef.current = null;
      }
      setGyojiState("idle");
      setMatchOver(false);
      setHasUsedPowerUp(false);
      setGyojiCall(null); // Clear gyoji call
      setRawParryEffectPosition(null); // Clear any active parry effects
      setChargeClashEffectPosition(null); // Clear any active charge clash effects
      setNoStaminaEffectKey(0); // Clear "No Stamina" effect on round reset
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
    };
    socket.on("game_reset", handleGameReset);

    const handleGyojiCall = (call) => {
      setGyojiCall(call);

      const tid = setTimeout(() => {
        setGyojiCall(null);
      }, 2000);
      pendingSocketTimeouts.current.push(tid);
    };
    socket.on("gyoji_call", handleGyojiCall);

    const handleGameStart = () => {
      setGyojiCall(null); // Clear any lingering gyoji call
      setHakkiyoi(true);
      setRawParryEffectPosition(null); // Clear any leftover parry effects
      setChargeClashEffectPosition(null); // Clear any leftover charge clash effects
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

      const tid = setTimeout(() => {
        setHakkiyoi(false);
      }, 3000);
      pendingSocketTimeouts.current.push(tid);
    };
    socket.on("game_start", handleGameStart);

    const handleGameOver = (data) => {
      setGameOver(data.isGameOver);
      setWinner(data.winner);
      setWinType(data.winType || "ringOut");

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
      // Play round victory or defeat sound based on local player result.
      // Kill throws: defer sound to align with the visual landing (state update + render).
      // The game_over event arrives before the fighter_action state that shows the player
      // at ground level, so playing immediately sounds ahead of the visual impact.
      if (index === 0) {
        const playRoundSound = () => {
          if (data.winner.id === localId) {
            playSound(roundVictorySound, 0.05);
          } else {
            playSound(roundDefeatSound, 0.03);
          }
        };
        if (data.winType === "clinchKillThrow" || data.winType === "clinchKillPull") {
          const tid = requestAnimationFrame(() => {
            const tid2 = requestAnimationFrame(playRoundSound);
            pendingSocketRafs.current.push(tid2);
          });
          pendingSocketRafs.current.push(tid);
        } else {
          playRoundSound();
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
    };
    socket.on("game_over", handleGameOver);

    const handleMatchOver = (data) => {
      const tid = setTimeout(() => {
        setMatchOver(data.isMatchOver);
      }, 3000);
      pendingSocketTimeouts.current.push(tid);
      setUiRoundId((id) => id + 1);
    };
    socket.on("match_over", handleMatchOver);

    const handleRematch = () => {
      setPlayerOneWinCount(0);
      setPlayerTwoWinCount(0);
      setRoundHistory([]);
      setMatchOver(false);
    };
    socket.on("rematch", handleRematch);

    return () => {
      socket.off("fighter_action", handleFighterAction);
      socket.off("slap_parry", handleSlapParry);
      socket.off("charge_clash", handleChargeClash);
      socket.off("player_hit", handlePlayerHit);
      socket.off("raw_parry_success", handleRawParrySuccess);
      socket.off("perfect_parry", handlePerfectParry);
      if (attackerConfirmTimeoutRef.current) {
        clearTimeout(attackerConfirmTimeoutRef.current);
        attackerConfirmTimeoutRef.current = null;
      }
      if (knockbackTrailIntervalsRef.current.length > 0) {
        knockbackTrailIntervalsRef.current.forEach((id) => clearInterval(id));
        knockbackTrailIntervalsRef.current = [];
      }
      if (index === 0) {
        socket.off("grab_break", handleGrabBreak);
        socket.off("grab_tech", handleGrabTech);
        socket.off("fighter_action", handleClinchTech);
        socket.off("counter_grab", handleCounterGrab);
        socket.off("punish_banner", handlePunishBanner);
        socket.off("stamina_blocked", handleStaminaBlocked);
        socket.off("counter_hit", handleCounterHit);
      }
      socket.off("snowball_hit", handleSnowballHit);
      socket.off("gyoji_call", handleGyojiCall);
      socket.off("game_start", handleGameStart);
      socket.off("game_reset", handleGameReset);
      socket.off("game_over", handleGameOver);
      socket.off("match_over", handleMatchOver);
      socket.off("power_ups_revealed", handlePowerUpsRevealed);
      socket.off("rematch", handleRematch);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      // Clean up deferred RoundResult rAF
      if (showRoundResultRafRef.current) {
        cancelAnimationFrame(showRoundResultRafRef.current);
        showRoundResultRafRef.current = null;
      }
      pendingSocketTimeouts.current.forEach(clearTimeout);
      pendingSocketTimeouts.current = [];
      pendingSocketRafs.current.forEach(cancelAnimationFrame);
      pendingSocketRafs.current = [];
    };
  }, [index, socket, handleFighterAction, opponentDisconnected, localId]);

  // MEMORY FIX: Create music Audio objects only once on mount, reuse on opponentDisconnected changes.
  // Match BGM honors getGlobalVolume() — the user's volume slider was previously bypassed for in-match music.
  useEffect(() => {
    if (!gameMusicRef.current) {
      gameMusicRef.current = new Audio(gameMusic);
      const baseVol = 0.029 * getGlobalVolume();
      musicBaseVolume.current = baseVol;
      gameMusicRef.current.volume = baseVol;
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
      emitParticles("dashStart", {
        x: penguin.dodgeStartX ?? penguin.x,
        y: penguin.y,
        direction: penguin.dodgeDirection ?? penguin.facing ?? 1,
        facing: penguin.facing ?? 1,
      });
    }
    lastDodgeState.current = penguin.isDodging;
  }, [
    penguin.isDodging,
    penguin.dodgeStartX,
    penguin.dodgeDirection,
    penguin.facing,
    penguin.x,
    penguin.y,
    emitParticles,
  ]);

  // Dash spark trail — continuous ice sparks + ground streaks during the dash
  const dashTrailIntervalRef = useRef(null);
  const isDashingRef = useRef(false);

  useEffect(() => {
    isDashingRef.current = penguin.isDodging;
  }, [penguin.isDodging]);

  useEffect(() => {
    if (penguin.isDodging) {
      const EMIT_INTERVAL = 45;

      dashTrailIntervalRef.current = setInterval(() => {
        if (!isDashingRef.current) {
          clearInterval(dashTrailIntervalRef.current);
          dashTrailIntervalRef.current = null;
          return;
        }

        const curX = interpolatedPositionRef.current.x || penguin.x;

        emitParticles("dashSparkTrail", {
          x: curX,
          y: penguin.y,
          direction: penguin.dodgeDirection ?? penguin.facing ?? 1,
        });
      }, EMIT_INTERVAL);
    } else {
      if (dashTrailIntervalRef.current) {
        clearInterval(dashTrailIntervalRef.current);
        dashTrailIntervalRef.current = null;
      }
    }
    return () => {
      if (dashTrailIntervalRef.current) {
        clearInterval(dashTrailIntervalRef.current);
        dashTrailIntervalRef.current = null;
      }
    };
  }, [
    penguin.isDodging,
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
  // Kill throw victims get an enhanced landing cloud + impact sound.
  // Rise trail + launch sound are handled via the "clinch_kill_throw" socket event.
  const wasBeingThrown = useRef(false);
  useEffect(() => {
    if (wasBeingThrown.current && !penguin.isBeingThrown) {
      const landX = interpolatedPositionRef.current.x || penguin.x;
      if (penguin.isClinchKillThrowVictim) {
        const outsideDohyo = landX <= DOHYO_LEFT_BOUNDARY || landX >= DOHYO_RIGHT_BOUNDARY;
        const groundY = outsideDohyo ? penguin.y + 10 : penguin.y + 30;
        emitParticles("clinchKillThrowLand", { x: landX, y: groundY, behindDohyo: outsideDohyo });
        playSound(chargedHit04, 0.09, null, 0.6, xToPan(landX));
      } else {
        emitParticles("throwLand", { x: landX, y: penguin.y });
      }
    }
    wasBeingThrown.current = !!penguin.isBeingThrown;
  }, [penguin.isBeingThrown, penguin.isClinchKillThrowVictim, penguin.x, penguin.y, emitParticles]);

  // Rope jump landing — smoke ring on touchdown
  const prevRopeJumpPhase = useRef(null);
  useEffect(() => {
    if (prevRopeJumpPhase.current === "active" && penguin.ropeJumpPhase === "landing") {
      emitParticles("throwLand", {
        x: interpolatedPositionRef.current.x || penguin.x,
        y: penguin.y,
      });
    }
    prevRopeJumpPhase.current = penguin.ropeJumpPhase;
  }, [penguin.ropeJumpPhase, penguin.x, penguin.y, emitParticles]);

  // ─────────────────────────────────────────────────────────────────
  // LOCAL PLAYER HALO — persistent identity marker
  //
  // Emits localPlayerHalo every 600ms while the LOCAL player is alive
  // and the round isn't over. Each emission spawns one ring on the
  // default canvas (occluded by the fighter sprite — wraps around the
  // feet) and one faint copy on the aboveFighters canvas (preserves
  // identity through overlap). The ring tracks live X/Y via
  // followGetter, so it dips with the player during the sidestep arc
  // — they're walking around the dohyo's curved near edge, not jumping.
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLocalPlayer || penguin.isDead || gameOver) return;

    // followGetter returns canvas-space coordinates (Y is already flipped
    // because the engine spawns the particle at GAME_H - y).
    const followGetter = () => {
      const pos = interpolatedPositionRef.current;
      const px = pos?.x ?? penguin.x;
      const py = pos?.y ?? penguin.y;
      if (typeof px !== "number" || typeof py !== "number") return null;
      return { x: px, y: 720 - py };
    };

    const fire = () => {
      const pos = interpolatedPositionRef.current;
      emitParticles("localPlayerHalo", {
        x: pos?.x ?? penguin.x,
        y: pos?.y ?? penguin.y,
        playerNumber,
        followGetter,
      });
    };

    fire();
    // 2000ms cadence MATCHES the halo's 2.0s `maxLife` exactly.
    // Each particle's bump-eased alpha goes BASE → PEAK → BASE, and
    // the next one starts at BASE — same value, seamless transition,
    // consistent breath rhythm with no double-pulse from overlap.
    const id = setInterval(fire, 2000);
    return () => clearInterval(id);
  }, [isLocalPlayer, penguin.isDead, gameOver, playerNumber, emitParticles]);

  // ─────────────────────────────────────────────────────────────────
  // SIDESTEP VFX — start / trail / land
  //
  // The sidestep is GROUND footwork, not a leap. The downward Y dip
  // (toward camera) reflects walking around the dohyo's near edge.
  // All three effects emit ground-level dust, no airborne mist.
  //
  // sidestepStart: rising edge of "active arc began" (startup ended)
  // sidestepTrail: every 40ms while active, with `t` for arc progress
  // sidestepLand:  rising edge of recovery (arc completed)
  // ─────────────────────────────────────────────────────────────────
  const prevSidestepActive = useRef(false);
  useEffect(() => {
    const isActive =
      penguin.isSidestepping &&
      !penguin.isSidestepStartup &&
      !penguin.isSidestepRecovery;

    if (isActive && !prevSidestepActive.current) {
      const pos = interpolatedPositionRef.current;
      emitParticles("sidestepStart", {
        x: pos?.x ?? penguin.x,
        y: pos?.y ?? penguin.y,
        direction: penguin.facing || 1,
        playerNumber,
      });
    }
    prevSidestepActive.current = isActive;
  }, [
    penguin.isSidestepping,
    penguin.isSidestepStartup,
    penguin.isSidestepRecovery,
    penguin.facing,
    playerNumber,
    emitParticles,
  ]);

  useEffect(() => {
    const isActive =
      penguin.isSidestepping &&
      !penguin.isSidestepStartup &&
      !penguin.isSidestepRecovery;
    if (!isActive) return;

    // Active phase length is fixed server-side (SIDESTEP_ACTIVE_MS = 320).
    // Tracking elapsed locally lets us pass a 0..1 `t` for apex-boost in
    // the trail preset — fine even with mild server clock drift since the
    // effect just intensifies dust at mid-arc.
    const startTime = performance.now();
    const ACTIVE_MS = 320;
    const TRAIL_INTERVAL_MS = 40;

    const fire = () => {
      const pos = interpolatedPositionRef.current;
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / ACTIVE_MS, 1);
      emitParticles("sidestepTrail", {
        x: pos?.x ?? penguin.x,
        y: pos?.y ?? penguin.y,
        direction: penguin.facing || 1,
        t,
        playerNumber,
      });
    };

    fire();
    const id = setInterval(fire, TRAIL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [
    penguin.isSidestepping,
    penguin.isSidestepStartup,
    penguin.isSidestepRecovery,
    penguin.facing,
    playerNumber,
    emitParticles,
  ]);

  const prevSidestepRecovery = useRef(false);
  useEffect(() => {
    if (penguin.isSidestepRecovery && !prevSidestepRecovery.current) {
      const pos = interpolatedPositionRef.current;
      emitParticles("sidestepLand", {
        x: pos?.x ?? penguin.x,
        y: pos?.y ?? penguin.y,
      });
    }
    prevSidestepRecovery.current = penguin.isSidestepRecovery;
  }, [penguin.isSidestepRecovery, emitParticles]);

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
      const { gainNode } = strafingSoundRef.current;
      const ctx = gainNode.context;
      gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_MS);
      const ref = strafingSoundRef.current;
      strafingSoundRef.current = null;
      setTimeout(() => {
        try {
          ref.source.stop();
        } catch (_) { /* AudioNode may already be stopped */ }
      }, FADE_MS * 1000 + 20);
    }
    return () => {
      if (strafingSoundRef.current) {
        try {
          strafingSoundRef.current.source.stop();
        } catch (_) { /* AudioNode may already be stopped */ }
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

  useEffect(() => {
    lastDodgeLandState.current = penguin.justLandedFromDodge;
  }, [penguin.justLandedFromDodge]);

  useEffect(() => {
    if (penguin.isGrabbing && !lastGrabState.current) {
      const pan = xToPan(penguin.x);
      playSound(grabSound, 0.04, null, 1.0, pan);
      playSound(pickRandomSound(grabHitSounds), 0.035, null, 1.0, pan);
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

  // Throttle snowball trail emission per snowball. The previous implementation
  // emitted a particle for EVERY snowball every time the allSnowballs reference
  // changed, which happens on every server tick the snowball delta is sent.
  // That produced thousands of particles/sec from a single in-flight projectile
  // and was a major source of frame-time spikes during snowball combat.
  const lastSnowballTrailEmitRef = useRef(new Map());
  useEffect(() => {
    if (index !== 0 || allSnowballs.length === 0) return;
    const now = performance.now();
    const SNOWBALL_TRAIL_EMIT_MS = 40;
    const cache = lastSnowballTrailEmitRef.current;
    const seen = new Set();
    for (const sb of allSnowballs) {
      const key = sb.id ?? `${sb.x | 0}:${sb.velocityX > 0 ? 1 : -1}`;
      seen.add(key);
      const last = cache.get(key) || 0;
      if (now - last < SNOWBALL_TRAIL_EMIT_MS) continue;
      cache.set(key, now);
      emitParticles("snowballTrail", {
        x: sb.x,
        y: sb.y,
        direction: sb.velocityX > 0 ? 1 : -1,
      });
    }
    if (cache.size > seen.size) {
      for (const k of cache.keys()) {
        if (!seen.has(k)) cache.delete(k);
      }
    }
  }, [allSnowballs, index, emitParticles]);

  useEffect(() => {
    if (penguin.isSpawningPumoArmy && !lastSpawningPumoArmyState.current) {
      playSound(pumoArmySound, 0.02);
    }
    lastSpawningPumoArmyState.current = penguin.isSpawningPumoArmy;
  }, [penguin.isSpawningPumoArmy]);

  // Parry activation: subtle sound + particle burst on press (grunt moved to success)
  useEffect(() => {
    if (penguin.isRawParrying && !lastRawParryState.current) {
      playSound(rawParryGruntSound, 0.006, null, 1.25);
      emitParticles("parryActivation", {
        x: penguin.x,
        y: penguin.y,
        facing: penguin.facing,
      });
    }
    lastRawParryState.current = penguin.isRawParrying;
  }, [penguin.isRawParrying, penguin.x, penguin.y, penguin.facing, emitParticles]);

  // Parry stance: ongoing luminous motes while holding parry
  const parryStanceIntervalRef = useRef(null);
  const isParryingRef = useRef(false);
  useEffect(() => {
    isParryingRef.current = penguin.isRawParrying && !penguin.isRawParrySuccess && !penguin.isPerfectRawParrySuccess;

    if (isParryingRef.current && !parryStanceIntervalRef.current) {
      const startTime = Date.now();
      parryStanceIntervalRef.current = setInterval(() => {
        if (!isParryingRef.current) return;
        const held = (Date.now() - startTime) / 550;
        const intensity = 0.6 + Math.min(held, 1) * 0.4;
        const curX = interpolatedPositionRef.current.x || penguin.x;
        emitParticles("parryStance", {
          x: curX,
          y: penguin.y,
          facing: penguin.facing,
          intensity,
        });
      }, 90);
    }

    if (!isParryingRef.current && parryStanceIntervalRef.current) {
      clearInterval(parryStanceIntervalRef.current);
      parryStanceIntervalRef.current = null;
    }

    return () => {
      if (parryStanceIntervalRef.current) {
        clearInterval(parryStanceIntervalRef.current);
        parryStanceIntervalRef.current = null;
      }
    };
  }, [penguin.isRawParrying, penguin.isRawParrySuccess, penguin.isPerfectRawParrySuccess, penguin.x, penguin.y, emitParticles]);

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
      playSound(gassedSound, 0.12);
    }
    if (!penguin.isGassed && lastGassedState.current && player.id === localId) {
      playSound(gassedRegenSound, 0.03, null, 2.0);
    }
    lastGassedState.current = penguin.isGassed;
  }, [penguin.isGassed, penguin.isDead, gameOver, player.id, localId]);

  const lastPerfectParryState = useRef(false);
  useEffect(() => {
    if (penguin.isPerfectRawParrySuccess && !lastPerfectParryState.current) {
      clearRawParryBlueHold();
      emitParticles("throwLand", {
        x: penguin.x,
        y: penguin.y,
      });
      emitParticles("perfectParryFlameBurst", {
        x: penguin.x,
        y: penguin.y,
        facing: penguin.facing,
      });
    }
    lastPerfectParryState.current = penguin.isPerfectRawParrySuccess;
  }, [penguin.isPerfectRawParrySuccess, penguin.x, penguin.y, penguin.facing, emitParticles, clearRawParryBlueHold]);

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

  // ============================================
  // EVENT SHAKE SYSTEM — distinct from useCamera's hit shake
  // ============================================
  // Two screen-shake systems coexist on purpose, each owning a different
  // CSS variable that .game-scene's transform sums together:
  //
  //   useCamera (--cam-x/y)   = HIT shake. Triggered by hitCounter deltas
  //                             observed in the fighter_action stream. Has
  //                             directional bias and impact-driven decay.
  //
  //   This effect (--shake-x/y) = EVENT shake. Triggered by parries, clashes,
  //                               clinch jolts, projectile hits, edge pin,
  //                               ring out, round start, power-up reveal.
  //                               These never coincide with hit moments, so
  //                               there's no double-firing in practice.
  //
  // Both write into .game-scene's transform but NOT .game-hud, so the HUD
  // layer stays rock-steady during shakes. If you find yourself wanting to
  // "consolidate" these — don't. They're orthogonal, well-tested, and
  // collapsing them would replicate working logic with new bugs.
  useEffect(() => {
    if (screenShake.intensity > 0) {
      let animationId;
      const gameScene = document.querySelector(".game-scene");

      const shakeFrame = () => {
        const elapsed = Date.now() - screenShake.startTime;
        if (elapsed >= screenShake.duration) {
          setScreenShake({ intensity: 0, duration: 0, startTime: 0 });
          if (gameScene) {
            gameScene.style.setProperty("--shake-x", "0px");
            gameScene.style.setProperty("--shake-y", "0px");
          }
          return;
        }

        const progress = elapsed / screenShake.duration;
        const decayFactor = Math.pow(1 - progress, 1.5);
        const remainingIntensity = screenShake.intensity * decayFactor;

        const offsetX = (Math.random() - 0.5) * remainingIntensity * 14;
        const offsetY = (Math.random() - 0.5) * remainingIntensity * 10;

        if (gameScene) {
          gameScene.style.setProperty("--shake-x", `${offsetX}px`);
          gameScene.style.setProperty("--shake-y", `${offsetY}px`);
        }

        animationId = requestAnimationFrame(shakeFrame);
      };

      animationId = requestAnimationFrame(shakeFrame);

      return () => {
        cancelAnimationFrame(animationId);
        if (gameScene) {
          gameScene.style.setProperty("--shake-x", "0px");
          gameScene.style.setProperty("--shake-y", "0px");
        }
      };
    }
  }, [screenShake]);

  // Update thick blubber indicator based on actual game state
  // Only show during grab startup/lunge, NOT during the full grab hold/clinch
  const shouldShowThickBlubberIndicator = useMemo(() => {
    const isInGrabLunge = penguin.isGrabStartup || penguin.isGrabbingMovement;
    return (
      penguin.activePowerUp === "thick_blubber" &&
      ((penguin.isAttacking && penguin.attackType === "charged") ||
        isInGrabLunge) &&
      !penguin.hitAbsorptionUsed
    );
  }, [
    penguin.activePowerUp,
    penguin.isAttacking,
    penguin.attackType,
    penguin.hitAbsorptionUsed,
    penguin.isGrabStartup,
    penguin.isGrabbingMovement,
  ]);

  useEffect(() => {
    setThickBlubberIndicator(shouldShowThickBlubberIndicator);
  }, [shouldShowThickBlubberIndicator]);

  const [isCinematicKillAttacker, setIsCinematicKillAttacker] = useState(false);

  // Attacker-side hit-confirm: brief golden flash on the *attacker's* sprite when their
  // attack lands. Distinct from the victim's hit VFX — this is the proprioceptive
  // "yes, I hit" cue that AAA fighters give the attacker. Tier scales the glow:
  //   slap < burst (3rd slap finisher) < charged < cinematic
  // Auto-clears via timeout. Held in a ref so handlePlayerHit can clear stale ones
  // without re-binding (handler is set up once in a useEffect).
  const [attackerConfirmTier, setAttackerConfirmTier] = useState(null);
  const attackerConfirmTimeoutRef = useRef(null);

  // Tracks setInterval ids spawned by the charged-hit knockback trail (A4) so we
  // can clear them on unmount AND on subsequent hits (prevents double-trails
  // when the same player gets re-hit before the trail decay finishes).
  const knockbackTrailIntervalsRef = useRef([]);

  // Add screen shake, thick blubber absorption, and danger zone event listeners
  // MEMORY FIX: Track timeouts so we can clear them on unmount (prevents setState after unmount)
  useEffect(() => {
    const pendingTimeouts = [];

    const handleScreenShake = (data) => {
      setScreenShake({
        intensity: data.intensity,
        duration: data.duration,
        startTime: Date.now(),
      });
    };
    socket.on("screen_shake", handleScreenShake);

    const handleThickBlubber = (data) => {
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
    };
    socket.on("thick_blubber_absorption", handleThickBlubber);

    const handleRingOut = () => {
      setScreenShake({
        intensity: 1.2,
        duration: 600,
        startTime: Date.now(),
      });
    };
    socket.on("ring_out", handleRingOut);

    const handleCinematicKill = (data) => {
      if (index === 0) {
        emitParticles("cinematicKillImpact", {
          x: data.impactX,
          y: data.victimY,
        });

        playSound(pickRandomSound(chargedHitSounds), 0.07, null, 0.55, xToPan(data.impactX));
        duckMusic(0.3, 400);

        const launchDelay = data.hitstopMs || 550;
        const launchSoundId = setTimeout(() => {
          playSound(chargeAttackLaunchSound, 0.2, null, 1.5, xToPan(data.victimX));
          playSound(gunLaunchSound, 0.06, null, 1.0, xToPan(data.victimX));
        }, launchDelay);
        pendingTimeouts.push(launchSoundId);
      }

      if (player.id === data.attackerId) {
        setIsCinematicKillAttacker(true);
        const clearId = setTimeout(() => {
          setIsCinematicKillAttacker(false);
        }, (data.hitstopMs || 550) + 200);
        pendingTimeouts.push(clearId);
      }

      const isVictim = player.id === data.victimId;
      if (isVictim) {
        const trailDir = data.knockbackDirection;
        const trailStartDelay = data.hitstopMs || 550;
        let trailTick = 0;

        const trailStartId = setTimeout(() => {
          const trailInterval = setInterval(() => {
            trailTick++;
            if (trailTick > 50) {
              clearInterval(trailInterval);
              return;
            }
            const victimPos = interpolatedPositionRef.current;
            if (victimPos && typeof victimPos.x === "number") {
              emitParticles("cinematicKillTrail", {
                x: victimPos.x,
                y: victimPos.y ?? 290,
                direction: trailDir,
              });
            }
          }, 16);
          pendingTimeouts.push(trailInterval);
        }, trailStartDelay);
        pendingTimeouts.push(trailStartId);
      }
    };
    socket.on("cinematic_kill", handleCinematicKill);

    const handleClinchJolt = (data) => {
      const isMutual = data.type === "mutual";
      const midX = (data.jolterX + data.targetX) / 2;
      const pushDir = data.jolterX < data.targetX ? 1 : -1;
      // Mutual: dead center (same as clinch tech). Single: shift ~60% from midpoint toward target's chest.
      const chestOffset = isMutual ? 0 : (data.targetX - midX) * 0.6;
      const effectX = midX + chestOffset;
      setClinchJoltEffectPosition({
        x: effectX,
        y: PLAYER_MID_Y,
        joltId: `clinch-jolt-${Date.now()}`,
        direction: pushDir,
        isMutual,
      });
      const pan = xToPan(effectX);
      playSound(pickRandomSound(slapHitSounds), isMutual ? 0.05 : 0.04, null, 1.2, pan);
    };
    socket.on("clinch_jolt", handleClinchJolt);

    const handleClinchKillThrow = (data) => {
      const isVictim = player.id === data.victimId;
      if (!isVictim) return;

      const launchX = data.victimX;
      const hitstopDelay = Math.max(0, (data.hitstopMs || 0));
      const soundId = setTimeout(() => {
        playSound(chargeAttackLaunchSound, 0.18, null, 1.4, xToPan(launchX));
        duckMusic(0.3, 400);
      }, hitstopDelay);
      pendingTimeouts.push(soundId);
    };
    socket.on("clinch_kill_throw", handleClinchKillThrow);

    // Grab-armor absorb — pinkish-red ring + small particles when a grab
    // attempt eats one slap during startup. Fires once per absorb (gated to
    // index === 0 so the particle emit + sound don't double on the second
    // fighter). Reuses the thick-blubber absorb sound.
    //
    // POSITION — uses the EXACT same offset formula as hitSparkSlap so
    // the absorb VFX lands at the same chest point a slap hit would
    // (data.x + 70 + facingOffsetPx). When this matched correctly, the
    // user couldn't see it only because the previous grey ring blended
    // with the grey sprite tint — placement was already right.
    //
    // FOLLOWS THE DEFENDER — emission is gated to the defender's own
    // GameFighter instance so we can pass its `interpolatedPositionRef`
    // as the followGetter. The follow offset uses the SAME slap-hit math
    // so the anchor stays consistent as the player moves.
    const handleGrabArmorAbsorb = (data) => {
      if (typeof data?.x !== "number") return;

      // Both GameFighter components receive this event. Only the
      // defender's component emits the VFX/sound (so it can use its
      // own position ref).
      if (data.defenderId !== penguin.id) return;

      // ── ABSORB SPAWN POSITION ──────────────────────────────────────
      // Starts from the same chest-height slap-hit offset that the slap
      // hit-spark uses (so the absorb visually REPLACES the would-be
      // hit-spark), then PULLS BACK to the absorber's body anchor so
      // the ring sits centered ON the absorber's body — not floating
      // out at the slap-contact tip and not biased toward the
      // attacker side. Reads as "the energy sank INTO the absorber"
      // rather than "spark hovering between the two players".
      //
      // FACING SEMANTICS (this codebase): facing = -1 means facing
      // RIGHT (opponent on right, "front" is right), facing = +1
      // means facing LEFT (opponent on left, "front" is left). The
      // contact point sits ~32px FORWARD of the body anchor in the
      // facing direction, so a `+armorFacing * 32` pullback exactly
      // cancels that, landing the effect on the body anchor.
      const armorFacing = data.facing || 1;
      const armorFacingOffsetPx = (armorFacing === 1 ? -8 : -3) * 12.8;
      const ABSORB_BODY_PULLBACK = 32;
      const xOffsetFromCenter =
        70 + armorFacingOffsetPx + armorFacing * ABSORB_BODY_PULLBACK;
      const fxX = data.x + xOffsetFromCenter;

      // followGetter anchors to the player's CURRENT x with the SAME
      // offset, so the effect tracks them as they walk/lunge during
      // the absorb. y is locked to chest height (PLAYER_MID_Y).
      const armorCanvasY = 720 - PLAYER_MID_Y; // GAME_H - PLAYER_MID_Y
      const followGetter = () => {
        const pos = interpolatedPositionRef.current;
        if (!pos || typeof pos.x !== "number") return null;
        return {
          x: pos.x + xOffsetFromCenter,
          y: armorCanvasY,
        };
      };
      emitParticles("grabArmorAbsorb", {
        x: fxX,
        y: PLAYER_MID_Y,
        facing: armorFacing,
        followGetter,
      });
      playSound(thickBlubberSound, 0.012, null, 1.0, xToPan(fxX));
    };
    socket.on("grab_armor_absorb", handleGrabArmorAbsorb);

    // Grab-armor break — glass-shard burst when a charged attack shatters
    // the grab armor. Centered on the defender's body too (the armor is
    // shattering AROUND them, not at the impact point). Single-emit
    // gated to the defender's component for consistency with the absorb.
    const handleGrabArmorBreak = (data) => {
      if (typeof data?.x !== "number") return;
      if (data.defenderId !== penguin.id) return;
      const fxX = data.x + SPRITE_HALF_W;
      emitParticles("grabArmorBreak", {
        x: fxX,
        y: PLAYER_MID_Y,
        facing: data.facing || 1,
      });
      playSound(glassBreakSound, 0.05, null, 1.0, xToPan(fxX));
    };
    socket.on("grab_armor_break", handleGrabArmorBreak);

    return () => {
      pendingTimeouts.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
      socket.off("screen_shake", handleScreenShake);
      socket.off("thick_blubber_absorption", handleThickBlubber);
      socket.off("ring_out", handleRingOut);
      socket.off("cinematic_kill", handleCinematicKill);
      socket.off("clinch_kill_throw", handleClinchKillThrow);
      socket.off("clinch_jolt", handleClinchJolt);
      socket.off("grab_armor_absorb", handleGrabArmorAbsorb);
      socket.off("grab_armor_break", handleGrabArmorBreak);
    };
  }, [socket, player.id, localId, roomName, index, emitParticles, penguin.id]);

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

  // Track charge sessions so CSS animation restarts on each new charge
  const isCurrentlyCharging = displayPenguin.isChargingAttack;
  if (isCurrentlyCharging && !prevChargingRef.current) {
    chargeAnimKeyRef.current++;
  }
  prevChargingRef.current = isCurrentlyCharging;

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
    false, // dead positional slot — used to be isGrabClashActive
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
    penguin.isGrabWhiffRecovery,
    penguin.isRopeJumping,
    penguin.ropeJumpPhase,
    penguin.isDodgeRecovery,
    penguin.isSidestepping,
    penguin.isSidestepRecovery,
    displayPenguin.isChargingAttack,
    penguin.hasGrip,
    penguin.isBeingLifted,
    penguin.isClinchClashing,
    penguin.isClinchLifting,
    penguin.isClinchPushing,
    penguin.isClinchPlanting,
    penguin.isResistingThrow,
    penguin.isResistingPull,
    penguin.isClinchKillThrowVictim,
    penguin.isClinchKillPullVictim,
    penguin.isClinchJolting,
    penguin.isBeingClinchJolted,
    penguin.isClinchJoltClashing,
    penguin.clinchJoltRecovery
  );

  // Hold previous sprite for a few frames when transitioning to idle to prevent
  // ghost frames during state transition gaps (e.g. isHit=false before isRecovering=true)
  // Skip hold for dodge→idle: dash recovery should snap to idle instantly so
  // consecutive dashes read as distinct (the hold would mask the idle gap).
  let effectiveSpriteSrc = displaySpriteSrc;
  if (displaySpriteSrc === pumo && lastNonIdleSpriteRef.current) {
    if (lastNonIdleSpriteRef.current === dodging || lastNonIdleSpriteRef.current === recovering) {
      lastNonIdleSpriteRef.current = null;
      idleHoldFramesRef.current = 0;
    } else if (idleHoldFramesRef.current < IDLE_HOLD_FRAMES) {
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
  // Grab-armor absorb intentionally does NOT tint the body — the
  // particle ring alone communicates the absorb without washing the
  // player out. `useArmorTint` is kept as a constant `false` so the
  // shared sprite-recolor pipeline below doesn't need to change.
  const useArmorTint = false;
  const useBlubberTint = thickBlubberIndicator && !showHitTintThisFrame;

  // Get sprite render info (handles animated spritesheets and recoloring)
  const spriteRenderInfo = getSpriteRenderInfo(
    effectiveSpriteSrc,
    showHitTintThisFrame,
    false,
    useBlubberTint,
    false,
    useArmorTint
  );
  const isKillVictim = penguin.isClinchKillThrowVictim || penguin.isClinchKillPullVictim;

  // Kill victims use the raw hit APNG as a static image (forceStatic bypasses the
  // spritesheet lookup that would return a 3-frame strip, while still applying recoloring)
  const {
    src: recoloredSpriteSrc,
    isAnimated: isAnimatedSprite,
    config: spriteConfig,
  } = isKillVictim
    ? getSpriteRenderInfo(hitSprite, showHitTintThisFrame, false, useBlubberTint, true, useArmorTint)
    : spriteRenderInfo;

  const baseSpriteSrc = recoloredSpriteSrc;

  // Update animation state (will start/stop intervals as needed)
  updateSpriteAnimation(effectiveSpriteSrc);

  // Determine if we should show ritual or fighter sprite
  const showRitualSprite = shouldShowRitualForPlayer && ritualSpriteConfig;

  return (
    <div className="ui-container">
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
                matchOver={matchOver}
                isPlayer1Local={isLocalPlayer}
                player1Stamina={allPlayersData.player1?.stamina ?? 100}
                player1ActivePowerUp={
                  allPlayersData.player1?.activePowerUp ?? null
                }
                player1SnowballCooldown={
                  allPlayersData.player1?.snowballCooldown ?? false
                }
                player1SnowballThrowsRemaining={
                  allPlayersData.player1?.snowballThrowsRemaining ?? null
                }
                player1PumoArmyCooldown={
                  allPlayersData.player1?.pumoArmyCooldown ?? false
                }
                player1PumoArmySpawnsRemaining={
                  allPlayersData.player1?.pumoArmySpawnsRemaining ?? null
                }
                player1IsGassed={allPlayersData.player1?.isGassed ?? false}
                player1ParryRefund={p1ParryRefund}
                player1Balance={allPlayersData.player1?.balance ?? 100}
                player1BalanceGain={p1BalanceGain}
                player2Stamina={allPlayersData.player2?.stamina ?? 100}
                player2ActivePowerUp={
                  allPlayersData.player2?.activePowerUp ?? null
                }
                player2SnowballCooldown={
                  allPlayersData.player2?.snowballCooldown ?? false
                }
                player2SnowballThrowsRemaining={
                  allPlayersData.player2?.snowballThrowsRemaining ?? null
                }
                player2PumoArmyCooldown={
                  allPlayersData.player2?.pumoArmyCooldown ?? false
                }
                player2PumoArmySpawnsRemaining={
                  allPlayersData.player2?.pumoArmySpawnsRemaining ?? null
                }
                player2IsGassed={allPlayersData.player2?.isGassed ?? false}
                player2ParryRefund={p2ParryRefund}
                player2Balance={allPlayersData.player2?.balance ?? 100}
                player2BalanceGain={p2BalanceGain}
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
            {index === 0 && gyojiCall && (
              <SumoGameAnnouncement type="tewotsuite" duration={2} />
            )}
            {index === 0 && hakkiyoi && (
              <SumoGameAnnouncement type="hakkiyoi" duration={1.8} />
            )}
            {index === 0 && showRoundResult && !matchOver && (
              <RoundResult isVictory={winner.id === localId} winType={winType} />
            )}
            {index === 0 && matchOver && (
              <MatchOver
                winner={winner}
                localId={localId}
                roomName={roomName}
                isCPUMatch={isCPUMatch}
              />
            )}
          </>,
          document.getElementById("game-hud")
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
          <RoundResult isVictory={true} winType="slap" />
          <RoundResult isVictory={false} winType="slap" />
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
        isSidestepping={penguin.isSidestepping}
        isGrabStartup={penguin.isGrabStartup}
        isThrowing={penguin.isThrowing}
        isBeingThrown={penguin.isBeingThrown}
        isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
        isRopeJumping={penguin.isRopeJumping}
        isLocalPlayer={penguin.id === localId}
      />
      {/* <DodgeSmokeEffect
        x={penguin.dodgeStartX || displayPosition.x}
        y={displayPosition.y}
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
          $isSidestepping={penguin.isSidestepping}
          $isGrabbing={displayPenguin.isGrabbing}
          $isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
          $isAtTheRopes={penguin.isAtTheRopes}
          $isHit={penguin.isHit}
          $isBurstKnockback={penguin.isBurstKnockback}
          $isRawParryStun={penguin.isRawParryStun}
          $isCinematicKillAttacker={isCinematicKillAttacker}
          $attackerConfirmTier={attackerConfirmTier}
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
            $isGrabTeching={penguin.isGrabTeching}
            $grabTechRole={penguin.grabTechRole}
            $isGrabWhiffRecovery={penguin.isGrabWhiffRecovery}
            $attackerConfirmTier={attackerConfirmTier}
            draggable={false}
          />
        </AnimatedFighterContainer>
      )}

      {/* Static Sprite (when sprite is not an animated spritesheet) */}
      {!isAnimatedSprite && (
        <StyledImage
          key={`${baseSpriteSrc}-${chargeAnimKeyRef.current}`}
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
          $chargeAttackPower={penguin.chargeAttackPower || 0}
          $chargingFacingDirection={penguin.chargingFacingDirection}
          $saltCooldown={penguin.saltCooldown}
          $grabStartTime={penguin.grabStartTime}
          $grabbedOpponent={penguin.grabbedOpponent}
          $grabAttemptStartTime={penguin.grabAttemptStartTime}
          $throwTechCooldown={penguin.throwTechCooldown}
          $isSlapParrying={penguin.isSlapParrying}
          $isSlapParryRecovering={penguin.isSlapParryRecovering}
          $lastThrowAttemptTime={penguin.lastThrowAttemptTime}
          $lastGrabAttemptTime={penguin.lastGrabAttemptTime}
          $dodgeDirection={displayPenguin.dodgeDirection}
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
          $isRopeJumping={penguin.isRopeJumping}
          $ropeJumpPhase={penguin.ropeJumpPhase}
          $isCrouchStance={penguin.isCrouchStance}
          $isCrouchStrafing={penguin.isCrouchStrafing}
          $isGrabBreakCountered={penguin.isGrabBreakCountered}
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
          $isClinchClashing={penguin.isClinchClashing}
          $isClinchJolting={penguin.isClinchJolting}
          $isBeingClinchJolted={penguin.isBeingClinchJolted}
          $isClinchJoltClashing={penguin.isClinchJoltClashing}
          $clinchJoltRecovery={penguin.clinchJoltRecovery}
          $isCinematicKillAttacker={isCinematicKillAttacker}
          $attackerConfirmTier={attackerConfirmTier}
          $isClinchKillThrowVictim={penguin.isClinchKillThrowVictim}
          $isClinchKillPullVictim={penguin.isClinchKillPullVictim}
          $isBeingThrown={penguin.isBeingThrown}
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
      <ChargeClashEffect position={chargeClashEffectPosition} />
      <HitEffect position={hitEffectPosition} />
      {index === 0 && (
        <RawParryEffect position={rawParryEffectPosition} />
      )}
      <GrabBreakEffect position={grabBreakEffectPosition} />
      <GrabTechEffect position={grabTechEffectPosition} />
      <ClinchJoltEffect position={clinchJoltEffectPosition} />
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
      {index === 0 && <ThrowTechEffect />}
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
      {/*
        Pumo clones (and their spawn FX) live in shared world space, not
        per-player UI. Both GameFighter instances mount this same JSX, so
        without an index gate we'd render every clone TWICE (one stack
        per instance) — exactly when the user upgraded to 3 charges and
        started seeing perf dips and color-flicker between overlapping
        copies. Render from index 0 only; clone state is socket-driven
        so both instances stay in sync.
      */}
      {index === 0 && (
        <>
          <PumoCloneSpawnEffect
            clones={allPumoArmies}
            player1Color={p1Color}
            player2Color={p2Color}
          />
          {allPumoArmies.map((clone) => {
            const isAnimatedClone = clone.isStrafing && pumoWaddleConfig;
            const isP1 = clone.ownerPlayerNumber === 1;
            const cloneSprite = isAnimatedClone
              ? (isP1 ? p1AnimatedCloneSrc : p2AnimatedCloneSrc)
              : (isP1 ? p1StaticCloneSrc : p2StaticCloneSrc);

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
                    $lane={clone.lane}
                  >
                    <AnimatedPumoCloneImage
                      src={cloneSprite}
                      alt="Pumo Clone"
                      $frameCount={pumoWaddleConfig.frameCount}
                      $fps={pumoWaddleConfig.fps}
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
                    $lane={clone.lane}
                  />
                )}
              </React.Fragment>
            );
          })}
        </>
      )}

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
  predictionRef: PropTypes.object,
  playerColor: PropTypes.string,
  playerBodyColor: PropTypes.string,
  isCPUMatch: PropTypes.bool,
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
    prevProps.isPowerUpSelectionActive === nextProps.isPowerUpSelectionActive &&
    prevProps.isCPUMatch === nextProps.isCPUMatch
  );
});
