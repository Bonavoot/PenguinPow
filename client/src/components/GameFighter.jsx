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
import DashAfterimageEffect from "./DashAfterimageEffect";
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
import { getBakedSprite } from "../utils/bakedSprites";
import { usePlayerColors } from "../context/PlayerColorContext";
import { addShake } from "../lib/cameraShake";

import UiPlayerInfo from "./UiPlayerInfo";
import UiPlayerInfoBasho from "./UiPlayerInfoBasho";
import { getBashoActiveDraft, toBashoHudActive } from "../config/powerUpConfig";
import MatchOver from "./MatchOver";
import RoundResult from "./RoundResult";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import HitEffect from "./HitEffect";
import RawParryEffect from "./RawParryEffect";
import { getGlobalVolume } from "./Settings";
import { playBuffer, createCrossfadeLoop } from "../utils/audioEngine";
import SnowEffect from "./SnowEffect";
import "./theme.css";
import { SERVER_BROADCAST_HZ, DOHYO_LEFT_BOUNDARY, DOHYO_RIGHT_BOUNDARY, isOutsideDohyo } from "../constants";
import { SHADOW_GROUND_LEVEL } from "./PlayerShadow";
import { getDisplayHitstopUntil, getEstimatedRtt } from "../lib/serverClock";
import {
  MovementPredictor,
  isMovementPredictionEnabled,
} from "../prediction/movementPredictor";
import { getLocalKeyState, isLocalGameActive } from "../prediction/localInput";

// Eeshi = pre-bout bed; battle BGM sits lower so hits/SFX stay forward in the mix.
const EESHI_MUSIC_VOL = 0.018;
const BATTLE_MUSIC_VOL = 0.014;
const EESHI_LOOP_CROSSFADE = 1.5;
const BATTLE_LOOP_CROSSFADE = 2.0;
const EESHI_ENTRY_FADE = 0.9;
const BATTLE_ENTRY_FADE = 0;
const BATTLE_MUSIC_ALT_ROUND = 3;

// Assets, sounds, preloading, constants, ritual config, playSound helper
import {
  pumo,
  dodging,
  recovering,
  saltBasket,
  saltBasketEmpty,
  snowball,
  attackSound,
  palmThrustWhiffSound,
  hitSound,
  dodgeSound,
  throwSound,
  grabSound,
  winnerSound,
  hakkiyoiSound,
  teWoTsuiteSound,
  bellSound,
  battleMusicTracks,
  eeshiMusic,
  slapParrySound,
  saltSound,
  snowballThrowSound,
  pumoArmySound,
  thickBlubberSound,
  rawParryGruntSound,
  flapSound,
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
  bellyLaying as bellyLayingSprite,
  bellyLayingEyesOpen as bellyLayingEyesOpenSprite,
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

  // BUILD-TIME BAKE FIRST: clones use the SAME stable baked file as the main
  // fighter, so both always agree on the current color (no per-bout blob).
  const bakedSrc = useMemo(() => {
    if (!needsRecolor) return null;
    return getBakedSprite(baseSrc, ownerColor, ownerBodyColor || null, "base");
  }, [baseSrc, ownerColor, ownerBodyColor, needsRecolor]);

  const cachedSrc = useMemo(() => {
    if (!needsRecolor || bakedSrc) return null;
    const opts = ownerBodyColor
      ? { bodyColorRange: GREY_BODY_RANGES, bodyColorHex: ownerBodyColor }
      : {};
    return getCachedRecoloredImage(
      baseSrc,
      BLUE_COLOR_RANGES,
      ownerColor,
      opts
    );
  }, [baseSrc, ownerColor, ownerBodyColor, needsRecolor, bakedSrc]);

  const [asyncSrc, setAsyncSrc] = useState(null);

  useEffect(() => {
    // Whenever the inputs change we must drop any stale async result so we
    // don't flash the previous owner's color before the new recolor lands.
    setAsyncSrc(null);

    if (!needsRecolor || bakedSrc || cachedSrc) return undefined;

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
  }, [baseSrc, ownerColor, ownerBodyColor, needsRecolor, bakedSrc, cachedSrc]);

  if (!needsRecolor) return baseSrc;
  return bakedSrc || cachedSrc || asyncSrc || baseSrc;
}

// =====================================================================
// SHARED SERVER-STATE ACCUMULATOR (module scope)
// Both GameFighter instances (and the clinch-tech listener) subscribe to
// the same "fighter_action" packets. socket.io hands every listener the
// SAME parsed object, so deltas are merged exactly once per packet here
// and each listener reads the shared result — previously every listener
// repeated the full merge for both players on every broadcast.
// A full (non-delta) packet resets the accumulator, so stale state from
// a previous match can never leak into a new one.
// =====================================================================
const sharedFighterState = { player1: null, player2: null, lastPacket: null };

// True while the flap power-up owns the player (startup, flight, or landing).
// Uses flapPhase as a backstop when isFlapping is missing from a delta tick.
function isInFlapMechanic(p) {
  if (!p) return false;
  if (p.isFlapping === true) return true;
  const phase = p.flapPhase;
  return phase === "startup" || phase === "flight" || phase === "landing";
}

// Server-side clearAllActionStates clears slap during these — client merge
// and VFX must mirror that so stale isSlapAttack can't survive a snowball hit,
// grab, flap, etc.
function isSlapAttackBlocked(state) {
  if (!state) return false;
  return (
    isInFlapMechanic(state) ||
    state.isHit === true ||
    state.isBeingGrabbed === true ||
    state.isBeingThrown === true ||
    state.isRawParryStun === true ||
    state.isAtTheRopes === true
  );
}

function clearStaleSlapFlagsOnBlockedState(state) {
  if (!isSlapAttackBlocked(state)) return;
  state.isSlapAttack = false;
  state.isAttacking = false;
}

function shouldShowSlapAttackHands(p, { gameOver, matchOver } = {}) {
  if (!p || gameOver || matchOver) return false;
  if (
    p.isDead ||
    p.isBowing ||
    p.isHit === true ||
    p.isThrowingSnowball ||
    p.isThrowing ||
    p.isBeingGrabbed ||
    p.isBeingThrown ||
    p.isBeingPulled ||
    p.isBeingPushed ||
    p.isRawParryStun ||
    p.isAtTheRopes
  ) {
    return false;
  }
  if (isInFlapMechanic(p)) return false;
  return p.isSlapAttack === true && p.isAttacking === true;
}

function mergeFighterPacket(data) {
  if (data === sharedFighterState.lastPacket) return; // already merged this packet
  sharedFighterState.lastPacket = data;
  if (
    data.isDelta &&
    sharedFighterState.player1 &&
    sharedFighterState.player2
  ) {
    // Merge in-place (avoids creating new objects 32×/sec → GC pressure)
    const d1 = data.player1;
    const d2 = data.player2;
    const a1 = sharedFighterState.player1;
    const a2 = sharedFighterState.player2;
    for (const k in d1) a1[k] = d1[k];
    for (const k in d2) a2[k] = d2[k];
  } else {
    sharedFighterState.player1 = { ...data.player1 };
    sharedFighterState.player2 = { ...data.player2 };
  }
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
  isBashoMatch, // True during a BASHO bout — the run controller drives the post-bout flow, so the MatchOver/Rematch UI is suppressed here
  bashoPlayerRankLabel = null, // BASHO-only: real banzuke rank for the HUD plaque
  bashoOpponentRankLabel = null, // BASHO-only: opponent's division label for the HUD plaque
  bashoDraftedPowerUps = null, // BASHO-only: stacked in-run power-up draft for the boon tray
  bashoOpponentPowerUps = null, // BASHO-only: CPU rival's passive/active draft loadout
  bashoDay = 1, // BASHO-only: current honbasho day (center HUD)
  bashoOpponentName = null, // BASHO-only: CPU rival name for the HUD nameplate
}) => {
  const { socket } = useContext(SocketContext);
  const { emit: emitParticles, clearRawParryBlueHold, clearPalmThrust, setFrozen } = useParticles();

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

  // BASHO no-remount fix: this fighter instance persists across every bout of a
  // run (keyed by the stable CPU/player id), so its local recolored-sprite cache
  // outlives the opponent that populated it. When the fighter's color changes
  // between bouts (a new day's rikishi), drop the previous color's cached blob
  // URLs: the module-level recolor LRU may have already evicted+revoked them,
  // and rendering a dead blob shows a broken/wrong-color sprite (the pumo clones
  // never hit this because their hook re-resolves on every color change). Force
  // a fresh re-resolve for the new color from the freshly-preloaded global cache.
  useEffect(() => {
    setRecoloredSprites({});
    recoloringInProgress.current.clear();
  }, [targetColor, playerBodyColor]);

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

      // BUILD-TIME BAKE FIRST: a stable, real PNG file for this exact
      // (sprite, mawashi, body, tint). This is a pure deterministic lookup —
      // no async, no LRU, no per-bout blob — so the main fighter resolves the
      // SAME file the clones do and never gets stuck on a prior bout's color
      // (Bug A), and the URL is identical every bout so there's no blob churn
      // / ghost frames (Bug B). Misses (arbitrary custom hex, or no bake run)
      // fall through to the live recolor path below unchanged.
      const bakedTint = useHitTint
        ? "hit"
        : useWhiteFlash
        ? "charge"
        : useBlubberTint
        ? "blubber"
        : useArmorTint
        ? "armor"
        : "base";
      const bakedSrc = getBakedSprite(
        sourceToRecolor,
        targetColor,
        playerBodyColor || null,
        bakedTint
      );
      if (bakedSrc) {
        return { src: bakedSrc, isAnimated, config: spritesheetConfig };
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
  // Time-based (was render-frame-based): movement no longer re-renders the
  // component, so visual windows are deadlines checked by the rAF loop.
  const idleHoldUntilRef = useRef(0);
  const IDLE_HOLD_MS = 34; // ~2 frames @60fps
  // FLAP wing-beat: each new flapWingBeatTime from the server snaps the wings
  // DOWN (flap2) for FLAP_WINGBEAT_MS, then back up (flap1). Once air charges
  // are spent, getImageSrc holds the dodge pose until landing. Change-detected
  // against a local clock so it doesn't need server sim-clock alignment.
  const flapBeatRef = useRef({ beat: 0, startedAt: 0 });
  const lastFlapSHeldRef = useRef(false);
  const FLAP_WINGBEAT_MS = 90; // ~down-stroke hold (snappy wing flap)

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
    isFlapping: false,
    flapPhase: null,
    flapWingBeatTime: 0,
    flapCharges: 0,
    flapFastFalling: false,
    flapBeatHDir: 0,
  });

  // PERFORMANCE: Position is rendered IMPERATIVELY, outside React.
  // The interpolation rAF loop writes left/bottom styles directly to the DOM
  // nodes below every frame. React renders only happen on discrete state
  // changes (sprite/flag changes), never for movement. This removes the
  // 60fps full-component re-render that movement used to cause.
  const interpolatedPositionRef = useRef({ x: 0, y: 0 });
  const previousState = useRef(null);
  const currentState = useRef(null);
  const lastUpdateTime = useRef(performance.now());
  const previousUpdateTime = useRef(0);

  // DOM nodes driven imperatively by the interpolation loop (position only —
  // all flag-dependent styling still flows through React renders).
  const fighterImgDomRef = useRef(null); // StyledImage (static sprite)
  const animContainerDomRef = useRef(null); // AnimatedFighterContainer
  const shadowDomRef = useRef(null); // PlayerShadow root div
  const youLabelDomRef = useRef(null); // pre-game "You" label
  // Mirror of the latest rendered penguin state for the rAF loop (flags used
  // in position formulas: at-the-ropes nudge, shadow ground-pinning).
  const penguinRef = useRef(penguin);
  // Last value of isOutsideDohyo(x, y) committed by a React render. The rAF
  // loop watches for position-driven flips (ring-out slides) and forces a
  // re-render so all zIndex formulas update consistently.
  const lastRenderedOutsideRef = useRef(false);
  // Bumped by the rAF loop when a time-based visual (hit flash / hit tint /
  // idle sprite hold / dohyo-side flip) needs a re-render to update.
  const [, setVisualTick] = useState(0);
  const forceVisualRender = useCallback(() => setVisualTick((t) => t + 1), []);

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

  // Force re-render when predictions change (refs don't trigger re-renders).
  // CRITICAL: predictionVersion is also a dependency of the displayPenguin
  // memo below — without it, a prediction-triggered re-render would read the
  // CACHED display state (memo keyed only on server state) and the predicted
  // action wouldn't be visible until the next server broadcast, defeating
  // the entire point of client-side prediction.
  const [predictionVersion, setPredictionVersion] = useState(0);

  // Prediction timeout - clear predictions if server doesn't confirm within this time
  // Shorter timeout to prevent predictions from staying visible too long
  const PREDICTION_TIMEOUT_MS = 150; // 150ms max prediction window (about 2-3 server ticks)

  // Track if this is the local player
  const isLocalPlayer = player.id === localId;

  // ============================================
  // CLIENT-SIDE MOVEMENT PREDICTION (local player only)
  // Runs the server's ice-movement physics locally so strafing responds on
  // the same frame as the keypress; reconciled against every server snapshot.
  // See client/src/prediction/movementPredictor.js for details + kill switch.
  // ============================================
  const movementPredictorRef = useRef(null);
  if (isLocalPlayer && !movementPredictorRef.current) {
    movementPredictorRef.current = new MovementPredictor();
  }

  // Client-side mirror of the server's parry commitment, used to suppress
  // OFFENSIVE predictions (slap / charge / grab / dash) that the server will
  // reject because it's parrying. Two reasons the server-confirmed
  // `penguin.isRawParrying` flag isn't enough on its own:
  //   1) It lags a round trip behind the keypress, so right after you press
  //      space the client still thinks it can attack.
  //   2) The server keeps parrying for RAW_PARRY_MIN_DURATION (~200ms) after a
  //      press EVEN IF space is released — so spamming space + mashing mouse1
  //      lands attack presses in the gaps between taps, when space is physically
  //      up and the lagged flag is false, yet the server is still parrying.
  // We cover both: the live spacebar (covers holds) OR a commit window stamped
  // on every space press (covers taps/spam + the round-trip lag). Combined with
  // the server-confirmed flag in the gates below, the whole parry window is
  // covered with no hole. Local player only; null keys (mobile) read as inactive.
  const predictedParryCommitUntilRef = useRef(0);
  const isLocalParryActive = useCallback(() => {
    if (!isLocalPlayer) return false;
    const k = getLocalKeyState();
    if (k && k[" "]) return true; // space physically held
    return performance.now() < predictedParryCommitUntilRef.current;
  }, [isLocalPlayer]);

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
        !penguin.isBowing &&
        !isInFlapMechanic(penguin)
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
        !isLocalParryActive() && // local parry intent + commit window — server flag above lags
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
    [penguin, isLocalParryActive]
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
          // Only predict if we can perform actions AND not already charging AND
          // not parrying (held, committed, or server-confirmed) — see isLocalParryActive
          if (canPredictAction(gameStarted) && !penguin.isChargingAttack && !isLocalParryActive()) {
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
          if (canPredictAction(gameStarted) && !isLocalParryActive()) {
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
          // Stamp the parry commit window on EVERY space press (even when the
          // parry itself can't visually predict this instant), so offensive
          // predictions stay suppressed across the server's min-duration parry
          // and the round-trip lag. Mirrors server RAW_PARRY_MIN_DURATION (200).
          if (gameStarted) {
            predictedParryCommitUntilRef.current = now + 200;
          }
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
          if (canPredictAction(gameStarted) && !penguin.isChargingAttack && !isLocalParryActive()) {
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
        setPredictionVersion((prev) => prev + 1);
      }
    },
    [
      isLocalPlayer,
      canPredictAction,
      canPredictDash,
      isLocalParryActive,
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

    // Flap owns the player — drop any stale slap predictions so A/D facing
    // re-renders can't resurrect slap-hands VFX mid-flight.
    if (isInFlapMechanic(penguin)) {
      if (
        predictedState.current.isSlapAttack ||
        predictedState.current.isAttacking
      ) {
        predictedState.current.isSlapAttack = false;
        predictedState.current.isAttacking = false;
      }
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
    const merged = {
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

    if (isInFlapMechanic(penguin)) {
      merged.isSlapAttack = false;
      merged.isAttacking = false;
    }

    // ── VISUAL EXCLUSIVITY GUARD ──────────────────────────────────────────
    // The OR-merge above lets two mutually-exclusive action flags assert at the
    // same time when a freshly-predicted action briefly overlaps a different
    // server-confirmed one (the round trip during which they disagree). The
    // sprite picker resolves to a single image by priority, but independent
    // overlays — most visibly the raw-parry glow, keyed straight off
    // `isRawParrying` — don't, so a predicted parry's flame leaks on top of a
    // confirmed grab/attack (and a predicted attack flashes during a confirmed
    // parry). The raw-parry stance is fully committed and cannot legitimately
    // coexist with any other action, so resolve it with the SERVER as authority
    // for which action is real: a confirmed non-parry action strips a predicted
    // parry; a confirmed parry strips predicted offense. Prediction still leads
    // freely from neutral — this only fires when the server has already
    // committed to a conflicting action. (Note: dodge+charge is a LEGITIMATE
    // co-state in this game, so it is intentionally left untouched here.)
    if (penguin.isRawParrying) {
      // Server is parrying — never paint predicted offense over the parry.
      merged.isSlapAttack = penguin.isSlapAttack;
      merged.isAttacking = penguin.isAttacking;
      merged.isChargingAttack = penguin.isChargingAttack;
      merged.isGrabbing = penguin.isGrabbing;
    } else if (merged.isRawParrying) {
      // Predicted parry — drop it if the server has committed to another action.
      const serverInOtherAction =
        penguin.isGrabbing ||
        penguin.isGrabStartup ||
        penguin.isGrabbingMovement ||
        penguin.isWhiffingGrab ||
        penguin.inClinch ||
        penguin.isThrowing ||
        penguin.isBeingThrown ||
        penguin.isBeingGrabbed ||
        penguin.isAttacking ||
        penguin.isChargingAttack ||
        penguin.isDodging ||
        penguin.isHit ||
        penguin.isRawParryStun ||
        penguin.isAtTheRopes;
      if (serverInOtherAction) {
        merged.isRawParrying = false;
      }
    }

    return merged;
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
  const [handsDownReached, setHandsDownReached] = useState(false);
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
  
  const [allSnowballs, setAllSnowballs] = useState([]);
  const snowballDomRefs = useRef({});
  // Per-snowball server samples for client-side velocity extrapolation.
  // Snowballs travel at constant velocity, so we can predict position between
  // 32Hz server broadcasts and render at 60fps. Without this the last sampled
  // position lingers for a full broadcast interval right before a parry/hit,
  // which reads as the snowball "freezing" just before it lands.
  const snowballSamplesRef = useRef(new Map());
  const snowballRafRef = useRef(null);
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
        // Keep the movement predictor's clock aligned so the freeze doesn't
        // turn into a burst of catch-up simulation ticks afterwards.
        movementPredictorRef.current?.notePause(timestamp);
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

      // MOVEMENT PREDICTION: for the local player, let the predictor either
      // take over the X position (active) or blend a residual offset while
      // handing control back to server interpolation (inactive). Y always
      // comes from the server path — predicted movement is ground-only.
      if (newPos && isLocalPlayer && isMovementPredictionEnabled()) {
        const predictor = movementPredictorRef.current;
        const selfState =
          index === 0
            ? allPlayersDataRef.current.player1
            : allPlayersDataRef.current.player2;
        const oppState =
          index === 0
            ? allPlayersDataRef.current.player2
            : allPlayersDataRef.current.player1;
        if (predictor && selfState) {
          // If the action-prediction layer is already showing an unconfirmed
          // action (dodge/attack/parry/...), suspend movement prediction NOW
          // instead of waiting a round trip for the server's state flag.
          const pendingAction = predictedState.current;
          const locallyActing =
            pendingAction.isAttacking ||
            pendingAction.isSlapAttack ||
            pendingAction.isDodging ||
            pendingAction.isChargingAttack ||
            pendingAction.isRawParrying ||
            pendingAction.isGrabbing ||
            pendingAction.isPowerSliding;
          const result = predictor.update(
            timestamp,
            getLocalKeyState(),
            selfState,
            oppState,
            isLocalGameActive() && !locallyActing,
            newPos.x
          );
          if (result.active) {
            newPos = { x: result.x, y: newPos.y };
          } else if (result.offsetX !== 0) {
            newPos = { x: newPos.x + result.offsetX, y: newPos.y };
          }
        }
      }

      if (newPos) {
        interpolatedPositionRef.current = newPos;

        // PERFORMANCE: Write position straight to the DOM — no React render.
        // Formulas must mirror the styled-components attrs exactly so a React
        // render (which re-applies attrs from this same ref) is a no-op.
        const p = penguinRef.current;
        const atRopesNudge =
          p.isAtTheRopes && p.fighter === "player 1"
            ? newPos.x < 640
              ? -5
              : 5
            : 0;
        const leftPct = `${((newPos.x + atRopesNudge) / 1280) * 100}%`;
        const plainLeftPct = `${(newPos.x / 1280) * 100}%`;
        const bottomPct = `${(newPos.y / 720) * 100}%`;

        const fighterEl = fighterImgDomRef.current;
        if (fighterEl) {
          fighterEl.style.left = leftPct;
          fighterEl.style.bottom = bottomPct;
        }
        const animEl = animContainerDomRef.current;
        if (animEl) {
          animEl.style.left = leftPct;
          animEl.style.bottom = bottomPct;
        }
        const shadowEl = shadowDomRef.current;
        if (shadowEl) {
          // Mirror PlayerShadow's ground-pinning: during airborne moves the
          // shadow stays at GROUND_LEVEL; during sidestep it tracks the dip.
          const forceGround =
            !p.isSidestepping &&
            (p.isDodging ||
              p.isGrabStartup ||
              p.isThrowing ||
              p.isBeingThrown ||
              p.isRingOutThrowCutscene ||
              p.isRopeJumping ||
              p.isFlapping);
          const shadowY = forceGround ? SHADOW_GROUND_LEVEL : newPos.y;
          shadowEl.style.left = plainLeftPct;
          shadowEl.style.bottom = `${(shadowY / 720) * 100 - 0.2}%`;
        }
        const youEl = youLabelDomRef.current;
        if (youEl) {
          youEl.style.left = plainLeftPct;
          youEl.style.bottom = `${(newPos.y / 720) * 100 + 21}%`;
        }

        // Position-driven zIndex flip (falling off the dohyo): needs a real
        // render so every element's zIndex formula updates consistently.
        if (
          isOutsideDohyo(newPos.x, newPos.y) !== lastRenderedOutsideRef.current
        ) {
          forceVisualRender();
        }
      }

      // Time-based visual windows (hit flash / hit tint / idle sprite hold /
      // unconfirmed predictions): re-render when a window the last render
      // showed as active has expired, so the "off" state actually commits.
      if (isLocalPlayer) {
        const p = penguinRef.current;
        if (p?.isFlapping && p?.flapPhase === "flight") {
          const sHeld = !!getLocalKeyState()?.s;
          if (sHeld !== lastFlapSHeldRef.current) {
            lastFlapSHeldRef.current = sHeld;
            forceVisualRender();
          }
        } else if (lastFlapSHeldRef.current) {
          lastFlapSHeldRef.current = false;
        }
      }

      const rendered = renderedHitVisualsRef.current;
      const nowMs = timestamp;
      if (
        (rendered.flash && nowMs >= hitFlashUntilRef.current) ||
        (rendered.tint && nowMs >= hitTintUntilRef.current) ||
        (rendered.hold && nowMs >= idleHoldUntilRef.current) ||
        (rendered.flapBeat &&
          nowMs >= flapBeatRef.current.startedAt + FLAP_WINGBEAT_MS) ||
        (rendered.prediction &&
          nowMs - predictedState.current.timestamp > PREDICTION_TIMEOUT_MS)
      ) {
        forceVisualRender();
      }

      interpolationIdRef.current = requestAnimationFrame(interpolationLoop);
    },
    [interpolatePosition, isLocalPlayer, index, forceVisualRender]
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

  // Snowball extrapolation loop. Snowballs move at a constant velocity, so we
  // predict their position between 32Hz server broadcasts and render at 60fps.
  // This removes the brief "freeze" of the last sampled position right before a
  // snowball lands or is parried (the server destroys/reflects the ball on a
  // tick between broadcasts, so without extrapolation the final visible sample
  // lingers ~one broadcast interval). Matches the player interpolation loop's
  // hitstop handling so melee freezes still pause the whole scene together.
  const snowballLoop = useCallback((timestamp) => {
    const samples = snowballSamplesRef.current;
    if (samples.size > 0) {
      // During a display-hitstop freeze, pin snowballs to their last sample so
      // they freeze in sync with players (snowball parries never trigger
      // hitstop, so the parry itself stays fully fluid).
      const hitstopUntil = getDisplayHitstopUntil();
      const frozen = hitstopUntil > 0 && timestamp < hitstopUntil;
      // Server moves the ball by velocityX * delta(ms) * speedFactor per tick,
      // so the per-ms rate is velocityX * speedFactor (speedFactor = 0.185).
      const RATE = 0.185;
      const MAX_EXTRAPOLATION_MS = 60; // cap so a dropped packet can't overshoot
      for (const [id, sample] of samples) {
        const wrapper = snowballDomRefs.current[id];
        const el = wrapper && wrapper.firstElementChild;
        if (!el) continue;
        let predictedX = sample.x;
        if (!frozen) {
          const elapsed = Math.min(timestamp - sample.t, MAX_EXTRAPOLATION_MS);
          predictedX = sample.x + sample.velocityX * RATE * elapsed;
        }
        el.style.left = `${(predictedX / 1280) * 100}%`;
        el.style.bottom = `${(sample.y / 720) * 100 + 11}%`;
      }
    }
    snowballRafRef.current = requestAnimationFrame(snowballLoop);
  }, []);

  useEffect(() => {
    snowballRafRef.current = requestAnimationFrame(snowballLoop);
    return () => {
      if (snowballRafRef.current) {
        cancelAnimationFrame(snowballRafRef.current);
        snowballRafRef.current = null;
      }
    };
  }, [snowballLoop]);

  // Position for the current render pass. Reads the live interpolation ref —
  // between renders the rAF loop keeps the DOM nodes up to date imperatively,
  // so whatever React commits here is immediately consistent with the loop.
  const getDisplayPosition = useCallback(() => {
    const pos = interpolatedPositionRef.current;
    if (!pos.x && !pos.y && penguin.x) {
      return { x: penguin.x, y: penguin.y };
    }
    return pos;
  }, [penguin.x, penguin.y]);

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
  // Deadline (performance.now() ms) until which the red hit tint shows.
  // Time-based, not render-frame-based: movement no longer re-renders the
  // component, so the rAF loop watches these deadlines and forces a render
  // when one expires.
  const hitTintUntilRef = useRef(0);
  // Pure-white impact snap on the receiving fighter, layered for the first
  // few frames *before* the lingering red hit tint. This is the AAA "moment
  // of impact" pop — Smash/SF6/T8 all do it. Uses the existing
  // chargeTintWhite sprite variant (preloaded by PlayerColorContext for every
  // skin combo), so it lights up instantly with no first-hit pop.
  const hitFlashUntilRef = useRef(0);
  // What the last committed render showed (flash/tint/hold/prediction
  // visible) — the rAF loop compares against live deadlines to know when a
  // re-render is needed.
  const renderedHitVisualsRef = useRef({
    flash: false,
    tint: false,
    hold: false,
    prediction: false,
  });
  // Debounce flag for multi-hit combos (e.g. slap1 → slap2 → slap3). Only the
  // OPENING hit of a string should flash; subsequent hits within the cooldown
  // window use the red damage tint only. Three reasons:
  //   1. Three white flashes in 300ms reads as strobing, not "impact".
  //   2. Every individual hit still gets camera shake, zoom-punch, chromatic
  //      burst, and the 10-layer hit VFX — those carry the per-hit response.
  //   3. Fewer IMG src swaps per combo (was 6+, now 2) eliminates the rare
  //      "invisible frame" hiccup caused by mid-swap browser compositing.
  const lastHitFlashTime = useRef(0);
  const HIT_FLASH_COOLDOWN_MS = 300;
  const HIT_FLASH_MS = 67; // ~4 frames @60fps
  const HIT_TINT_MS = 167; // ~10 frames @60fps
  const battleMusicRef = useRef(null);
  const eeshiMusicRef = useRef(null);
  // Set when match_over fires (2-round win); suppresses eeshi through MatchOver/rematch UI.
  const matchEndingRef = useRef(false);
  const battleMusicRoundRef = useRef(0);
  const ownsMatchMusic = index === 0;

  const startEeshi = useCallback((withFadeIn = false) => {
    if (!ownsMatchMusic || eeshiMusicRef.current) return;
    eeshiMusicRef.current = createCrossfadeLoop(
      eeshiMusic,
      EESHI_MUSIC_VOL * getGlobalVolume(),
      EESHI_LOOP_CROSSFADE,
      withFadeIn ? EESHI_ENTRY_FADE : 0
    );
  }, [ownsMatchMusic]);

  const stopEeshi = useCallback(() => {
    if (!ownsMatchMusic || !eeshiMusicRef.current) return;
    const loop = eeshiMusicRef.current;
    eeshiMusicRef.current = null;
    loop.stop();
  }, [ownsMatchMusic]);

  const stopBattleMusic = useCallback(() => {
    if (!ownsMatchMusic || !battleMusicRef.current) return;
    const loop = battleMusicRef.current;
    battleMusicRef.current = null;
    loop.stop();
  }, [ownsMatchMusic]);

  const startBattleMusic = useCallback(() => {
    if (!ownsMatchMusic || battleMusicRef.current) return;
    battleMusicRoundRef.current += 1;
    const roundNumber = battleMusicRoundRef.current;
    const track =
      roundNumber === BATTLE_MUSIC_ALT_ROUND
        ? battleMusicTracks[1]
        : battleMusicTracks[0];
    const loop = createCrossfadeLoop(
      track,
      BATTLE_MUSIC_VOL * getGlobalVolume(),
      BATTLE_LOOP_CROSSFADE,
      BATTLE_ENTRY_FADE
    );
    if (loop) battleMusicRef.current = loop;
  }, [ownsMatchMusic]);

  // Function to handle exiting from disconnected game
  const handleExitDisconnectedGame = useCallback(() => {
    if (disconnectedRoomId) {
      socket.emit("exit_disconnected_game", { roomId: disconnectedRoomId });
    }

    stopEeshi();
    stopBattleMusic();

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    onResetDisconnectState();
    setCurrentPage("mainMenu");
  }, [
    socket,
    disconnectedRoomId,
    onResetDisconnectState,
    setCurrentPage,
    stopEeshi,
    stopBattleMusic,
  ]);

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

  useEffect(() => {
    if (opponentDisconnected && ownsMatchMusic) {
      stopEeshi();
      stopBattleMusic();
    }
  }, [opponentDisconnected, ownsMatchMusic, stopEeshi, stopBattleMusic]);

  // FPS counter RAF loop removed — it consumed a full rAF slot per
  // GameFighter instance (×2) with no visible output.

  // Memoize frequently accessed socket listeners to prevent recreation
  const handleFighterAction = useCallback(
    (data) => {
      const currentTime = performance.now();

      // PERFORMANCE: Delta merging is done ONCE per packet in the shared
      // module-level accumulator (see sharedFighterState) — both GameFighter
      // instances receive the same parsed packet object from socket.io, so
      // the second instance reuses the merge instead of repeating it.
      mergeFighterPacket(data);
      const player1Data = sharedFighterState.player1;
      const player2Data = sharedFighterState.player2;

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

      // MOVEMENT PREDICTION: reconcile the local predictor against this
      // authoritative snapshot (no-op while the predictor is passive).
      if (isLocalPlayer && movementPredictorRef.current) {
        movementPredictorRef.current.onServerSnapshot(
          playerData,
          currentTime,
          getEstimatedRtt()
        );
      }

      // Track actual intervals between server updates for adaptive interpolation
      previousUpdateTime.current = lastUpdateTime.current;
      lastUpdateTime.current = currentTime;

      // If this is the first update, set previous state to current
      if (!previousState.current) {
        previousState.current = { ...currentState.current };
        interpolatedPositionRef.current = { x: playerData.x, y: playerData.y };
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

        // Victim / flap states own the player — stale slap flags must not
        // survive merge (snowball hits, grabs, flap air-steer, etc.).
        clearStaleSlapFlagsOnBlockedState(newState);

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
          prev.isPalmThrust !== newState.isPalmThrust ||
          // Per-thrust VFX nonce — MUST force a commit so the palm-thrust cone
          // fires on EVERY thrust. Without it, a buffered thrust (isAttacking
          // already latched true) or a locally-predicted first thrust would
          // bump the id on a frame with no other discrete change, the commit
          // would be skipped, and the cone would be dropped or delayed.
          prev.palmThrustFxId !== newState.palmThrustFxId ||
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
          prev.isFlapping !== newState.isFlapping ||
          prev.flapPhase !== newState.flapPhase ||
          prev.flapWingBeatTime !== newState.flapWingBeatTime ||
          prev.flapCharges !== newState.flapCharges ||
          prev.flapFastFalling !== newState.flapFastFalling ||
          prev.flapBeatHDir !== newState.flapBeatHDir ||
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

        // Blocked-state guard may clear stale slap flags even when nothing else
        // in the discrete check changed — still commit so SlapAttackHandsEffect
        // can't read pre-hit / pre-flap isSlapAttack from a skipped merge.
        const blockedClearedStaleSlap =
          (prev.isSlapAttack || prev.isAttacking) &&
          (!newState.isSlapAttack || !newState.isAttacking) &&
          isSlapAttackBlocked(newState);

        if (!discreteStateChanged && !blockedClearedStaleSlap) {
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

        // Store the latest server sample per snowball (position + velocity +
        // arrival time). The rAF loop below extrapolates from this each frame
        // so motion is smooth at 60fps instead of stepping at the 32Hz
        // broadcast rate. Direct DOM write here sets the baseline immediately
        // and prunes samples for snowballs that no longer exist.
        const samples = snowballSamplesRef.current;
        const seenIds = new Set();
        for (let i = 0; i < combinedSnowballs.length; i++) {
          const sb = combinedSnowballs[i];
          seenIds.add(sb.id);
          samples.set(sb.id, {
            x: sb.x,
            y: sb.y,
            velocityX: sb.velocityX || 0,
            t: currentTime,
          });
          const wrapper = snowballDomRefs.current[sb.id];
          const el = wrapper && wrapper.firstElementChild;
          if (el) {
            el.style.left = `${(sb.x / 1280) * 100}%`;
            el.style.bottom = `${(sb.y / 720) * 100 + 11}%`;
          }
        }
        for (const id of samples.keys()) {
          if (!seenIds.has(id)) samples.delete(id);
        }

        // Bail out when the list stays empty: the `snowballs` key persists in
        // the accumulated state after the last ball despawns, and committing
        // a fresh empty array every packet would re-render at broadcast rate
        // for the rest of the match.
        setAllSnowballs((prev) =>
          prev.length === 0 && combinedSnowballs.length === 0
            ? prev
            : combinedSnowballs
        );
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
        // Same empty-list bailout as snowballs above (clone positions are
        // React-rendered, so while clones are alive the per-broadcast commit
        // is what animates them — only the empty steady-state is skippable).
        setAllPumoArmies((prev) =>
          prev.length === 0 && combined.length === 0 ? prev : combined
        );
      }
    },
    [index, isLocalPlayer]
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

        // Screen shake — explicit per-hit tiers. The BIG hits (charged attack
        // and the slap-string finisher / slap3) get a heavy crunch profile with
        // zoom + roll; light pokes (slap 1 & 2) stay snappy with no zoom. Fired
        // once per client (index===0). Cinematic kills run their own camera, so
        // we skip here to avoid stepping on it.
        if (index === 0 && !data.cinematicKill) {
          const shakeDir = data.knockbackDirection || (data.facing === 1 ? -1 : 1);
          if (data.attackType === "charged") {
            const chargeScale =
              0.8 + Math.min((data.chargePercentage || 0) / 100, 1) * 0.45;
            addShake("charged_hit", { scale: chargeScale, dirX: shakeDir });
          } else if (isBurst) {
            addShake("slap_finisher", { dirX: shakeDir });
          } else {
            addShake("slap_hit", { dirX: shakeDir });
          }
        }

        if (index === 0 && !data.cinematicKill) {
          const pan = xToPan(data.x);
          if (data.attackType === "slap" && isBurst) {
            const baseSound = pickRandomSound(chargedHitSounds);
            playSound(baseSound, 0.045, null, 1.0, pan);
            if (data.isCounterHit) {
              playSound(baseSound, 0.028, null, 0.72, pan);
            } else if (data.isPunish) {
              playSound(baseSound, 0.026, null, 1.36, pan);
            }
          } else if (data.attackType === "slap") {
            const baseSound = pickRandomSound(slapHitSounds);
            playSoundVaried(baseSound, 0.038, null, 1.0, pan);
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
        // PERF: index===0 owns the hit spark. `player_hit` fires on BOTH
        // GameFighter instances, and HitEffect renders at an absolute world
        // coordinate (data.x), so without this guard every hit mounted TWO
        // identical HitEffect DOM trees at the same spot AND re-rendered the
        // index-1 fighter for nothing. Gating to one instance halves the
        // per-hit DOM/animation cost — same single effect on screen. (Shake,
        // sounds, and the counter/punish banner above are already index-0 only.)
        if (index === 0) {
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
            isPowered: data.isPowered || false,
            cinematicKill: data.cinematicKill || false,
            cinematicHitstopMs: data.cinematicKill ? 550 : 0,
          });
        }

        // COUNTER HIT / PUNISH side banners — folded into player_hit (were
        // separate `counter_hit` / `punish_banner` socket events, each of which
        // cost an extra unbatched GameFighter re-render on the same frame as the
        // hit). Index 0 owns the HUD banner state (same as the old handlers).
        // Uses the RAW server flags (showCounterBanner/showPunishBanner) so the
        // banner fires only on the real counter/punish frame, not on latched
        // slap-string follow-ups. hitId is the dedup key.
        if (index === 0) {
          if (data.showCounterBanner) {
            setCounterHitEffectPosition({
              x: data.x + 70,
              y: PLAYER_MID_Y,
              counterId: data.hitId || `counter-hit-${Date.now()}`,
              playerNumber: data.attackerPlayerNumber || 1,
              timestamp: data.timestamp,
            });
          } else if (data.showPunishBanner) {
            setPunishBannerPosition({
              counterId: `punish-${data.hitId || Date.now()}`,
              grabberPlayerNumber: data.attackerPlayerNumber || 1,
            });
          }
        }

        // PERF: index===0 owns the hit-spark burst. The particle engine is a
        // shared singleton, so emitting from both instances spawned DOUBLE the
        // particles on every hit (charged = 44 instead of the designed 22) —
        // the heaviest synchronous work on the impact frame. One emit = the
        // intended count into the shared canvas.
        if (index === 0) {
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
        handleStaminaBlocked;
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
        // Idempotent — reuses the merge if handleFighterAction ran first.
        mergeFighterPacket(data);
        const p1 = sharedFighterState.player1;
        const p2 = sharedFighterState.player2;
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

      // NOTE: counter-hit and punish side banners are no longer separate socket
      // events — they're folded into the player_hit handler above (which fires
      // setCounterHitEffectPosition / setPunishBannerPosition off the raw
      // showCounterBanner / showPunishBanner flags). This removes the extra
      // per-counter/punish GameFighter re-render that caused the hitch.

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

        addShake("power_up_reveal");
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

      // Back to power-up selection: battle BGM off, pre-bout eeshi on.
      matchEndingRef.current = false;
      stopBattleMusic();
      if (!opponentDisconnected) {
        startEeshi(true);
      }
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
      setGyojiState("ready");
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

      // Round-start shake (zoom-punch is handled by useCamera's onGameStart)
      addShake("round_start");

      // Handle music transition: eeshi -> battle music (after HAKKIYOI)
      stopEeshi();
      startBattleMusic();

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

      const gyojiIdleTid = setTimeout(() => {
        setGyojiState("idle");
      }, 2000);
      pendingSocketTimeouts.current.push(gyojiIdleTid);

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

      // Round over: battle BGM off; eeshi only if another round follows (not match end).
      if (data.wins > 1) {
        matchEndingRef.current = true;
      }
      stopBattleMusic();
      if (!matchEndingRef.current && !opponentDisconnected) {
        startEeshi(true);
      }
    };
    socket.on("game_over", handleGameOver);

    const handleMatchOver = (data) => {
      // match_over is emitted before game_over on the winning match — silence all BGM
      // through MatchOver / rematch (game_reset does not run when matchOver is set).
      matchEndingRef.current = true;
      stopBattleMusic();
      stopEeshi();

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
      matchEndingRef.current = false;
      battleMusicRoundRef.current = 0;
      if (!opponentDisconnected) {
        startEeshi(true);
      }
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
        socket.off("stamina_blocked", handleStaminaBlocked);
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

  // Index 0 only — two GameFighters share one room; one BGM owner avoids double playback.
  useEffect(() => {
    if (!ownsMatchMusic) return;

    if (!opponentDisconnected && !matchEndingRef.current) {
      startEeshi(false);
    }

    return () => {
      stopEeshi();
      stopBattleMusic();
    };
  }, [opponentDisconnected, ownsMatchMusic, startEeshi, stopEeshi, stopBattleMusic]);

  // NOTE: game_start and game_over music handling is now consolidated into the main socket useEffect
  // to prevent duplicate listeners and cleanup race conditions

  useEffect(() => {
    // Trigger swing sound for non-slap attacks. Palm thrust gets its own
    // dedicated whiff sound; charged attacks keep the generic attack sound.
    if (
      penguin.isAttacking &&
      !penguin.isSlapAttack &&
      !lastAttackState.current
    ) {
      if (penguin.isPalmThrust) {
        playSound(palmThrustWhiffSound, 0.05, null, 1.0, xToPan(penguin.x));
      } else {
        playSound(attackSound, 0.05);
      }
    }
    // Update the last attack state
    lastAttackState.current = penguin.isAttacking && !penguin.isSlapAttack;
  }, [penguin.isAttacking, penguin.isSlapAttack, penguin.isPalmThrust]);

  // Separate effect for slap attack sounds based on slapAnimation changes
  useEffect(() => {
    if (
      penguin.isSlapAttack &&
      penguin.isAttacking &&
      !isInFlapMechanic(penguin)
    ) {
      playSound(pickRandomSound(slapWhiffSounds), 0.02, null, 1.0, xToPan(penguin.x));
    }
  }, [penguin.slapAnimation, penguin.isSlapAttack, penguin.isAttacking, penguin.isFlapping, penguin.flapPhase]);

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
      grabPushLastX.current = interpolatedPositionRef.current.x || penguin.x;
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
      chargedTrailLastX.current = interpolatedPositionRef.current.x || penguin.x;
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
    // Kill pulls have their own heavy slam burst (below) — skip the light
    // hop dust here so the two don't stack.
    if (penguin.isBeingPullReversaled && !penguin.isClinchKillPullVictim) {
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
  }, [penguin.isBeingPullReversaled, penguin.isClinchKillPullVictim, emitParticles]);

  // Clinch kill PULL — heavy belly-slam onto the ice. One big slam burst on the
  // first ground contact, then diminishing bursts on each bounce-hop landing.
  // Timing mirrors the server tween (constants: CLINCH_KILL_PULL_TWEEN_DURATION,
  // and the kill hop profile in index.js: HOP_DELAY 0.03, 4 hops).
  const killPullSlamTimeouts = useRef([]);
  useEffect(() => {
    if (penguin.isClinchKillPullVictim) {
      // Matches the server belly-slide (constants: CLINCH_KILL_PULL_TWEEN_DURATION).
      const TWEEN_DURATION = 850;
      const dir = penguin.facing ?? 1;

      // Light contact puff right where they hit (de-emphasized — the slide is the star,
      // and a big burst here read as "too close to the thrower").
      emitParticles("clinchKillPullSlam", {
        x: interpolatedPositionRef.current.x,
        y: interpolatedPositionRef.current.y || penguin.y,
        intensity: 0.4,
        direction: dir,
      });

      // Snow kicked up ALONG the slide. Each burst fires at the body's CURRENT position
      // as it glides away, so the dust trails out across the ice instead of clumping at
      // the thrower. Peaks just after they've moved clear, then tapers as they slow.
      const slideBursts = [
        { frac: 0.32, intensity: 0.6 },
        { frac: 0.52, intensity: 0.5 },
        { frac: 0.72, intensity: 0.38 },
        { frac: 0.9, intensity: 0.26 },
      ];
      slideBursts.forEach(({ frac, intensity }) => {
        const tid = setTimeout(() => {
          emitParticles("clinchKillPullSlam", {
            x: interpolatedPositionRef.current.x,
            y: interpolatedPositionRef.current.y || penguin.y,
            intensity,
            direction: dir,
          });
        }, TWEEN_DURATION * frac);
        killPullSlamTimeouts.current.push(tid);
      });
    } else {
      killPullSlamTimeouts.current.forEach(clearTimeout);
      killPullSlamTimeouts.current = [];
    }
    return () => {
      killPullSlamTimeouts.current.forEach(clearTimeout);
      killPullSlamTimeouts.current = [];
    };
  }, [penguin.isClinchKillPullVictim, emitParticles]);

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

  // Flap landing — same smoke ring as the rope jump on touchdown. Liftoff burst
  // fires on startup → flight. Air-charge puffs fire on each flapCharges
  // decrement (reliable across network snapshots; flapWingBeatTime alone can
  // miss beats between state packets).
  const prevFlapPhase = useRef(null);
  const prevFlapChargesParticles = useRef(null);
  const prevFlapFastFallSoundRef = useRef(false);
  const flapFastFallAtLandRef = useRef(false);
  useEffect(() => {
    const x = interpolatedPositionRef.current.x || penguin.x;
    const y = interpolatedPositionRef.current.y || penguin.y;
    const facing = penguin.facing ?? 1;

    if (prevFlapPhase.current === "startup" && penguin.flapPhase === "flight") {
      let beatHDir = 0;
      if (isLocalPlayer) {
        const k = getLocalKeyState();
        if (k?.d && !k?.a) beatHDir = 1;
        else if (k?.a && !k?.d) beatHDir = -1;
      } else {
        beatHDir = penguin.flapBeatHDir ?? 0;
      }
      emitParticles("flapLiftoff", { x, y, facing, beatHDir });
    }
    if (prevFlapPhase.current !== "landing" && penguin.flapPhase === "landing") {
      if (flapFastFallAtLandRef.current) {
        emitParticles("flapFastFallLand", {
          x,
          y: SHADOW_GROUND_LEVEL,
        });
        addShake("throw_landing");
      } else {
        emitParticles("throwLand", {
          x,
          y: SHADOW_GROUND_LEVEL,
        });
      }
      flapFastFallAtLandRef.current = false;
    }
    if (!isInFlapMechanic(penguin)) {
      flapFastFallAtLandRef.current = false;
    }
    prevFlapPhase.current = penguin.flapPhase;
  }, [penguin.flapPhase, penguin.x, penguin.y, penguin.facing, penguin.flapBeatHDir, penguin.isFlapping, isLocalPlayer, emitParticles]);

  useEffect(() => {
    if (penguin.isFlapping && penguin.flapPhase === "flight") {
      const charges = penguin.flapCharges ?? 0;
      if (
        prevFlapChargesParticles.current !== null &&
        charges < prevFlapChargesParticles.current
      ) {
        const x = interpolatedPositionRef.current.x || penguin.x;
        const y = interpolatedPositionRef.current.y || penguin.y;
        let beatHDir = 0;
        if (isLocalPlayer) {
          const k = getLocalKeyState();
          if (k?.d && !k?.a) beatHDir = 1;
          else if (k?.a && !k?.d) beatHDir = -1;
        } else {
          beatHDir = penguin.flapBeatHDir ?? 0;
        }
        emitParticles("flapWingBeat", {
          x,
          y,
          facing: penguin.facing ?? 1,
          beatHDir,
        });
      }
      prevFlapChargesParticles.current = charges;
    } else {
      prevFlapChargesParticles.current = null;
    }
  }, [
    penguin.isFlapping,
    penguin.flapPhase,
    penguin.flapCharges,
    penguin.x,
    penguin.y,
    penguin.facing,
    isLocalPlayer,
    emitParticles,
  ]);

  // Flap audio — each wing beat (liftoff + every air flap) plays layered whoosh.
  const prevFlapBeatSound = useRef(0);
  useEffect(() => {
    if (
      penguin.isFlapping &&
      penguin.flapWingBeatTime &&
      penguin.flapWingBeatTime !== prevFlapBeatSound.current
    ) {
      const pan = xToPan(penguin.x);
      playSound(attackSound, 0.04, null, 1.0, pan);
      playSound(flapSound, 0.012, null, 1.0, pan);
    }
    prevFlapBeatSound.current = penguin.flapWingBeatTime || 0;
  }, [penguin.flapWingBeatTime, penguin.isFlapping, penguin.x]);

  // Flap fast-fall trail — vertical dive streaks while S is held mid-flight.
  // Interval runs for the whole flight phase; emissions gate on server
  // flapFastFalling OR local S (same pattern as the dodge-pose swap).
  const flapFastFallIntervalRef = useRef(null);
  useEffect(() => {
    const inFlight =
      penguin.isFlapping && penguin.flapPhase === "flight";

    if (inFlight) {
      const EMIT_INTERVAL = 45;
      flapFastFallIntervalRef.current = setInterval(() => {
        const p = penguinRef.current;
        if (!p?.isFlapping || p.flapPhase !== "flight") {
          clearInterval(flapFastFallIntervalRef.current);
          flapFastFallIntervalRef.current = null;
          return;
        }
        const diving =
          p.flapFastFalling ||
          (isLocalPlayer && !!getLocalKeyState()?.s);

        flapFastFallAtLandRef.current = diving;

        if (diving && !prevFlapFastFallSoundRef.current) {
          playSound(
            pickRandomSound(slapWhiffSounds),
            0.02,
            null,
            1.0,
            xToPan(p.x)
          );
        }
        prevFlapFastFallSoundRef.current = diving;

        if (!diving) return;

        const pos = interpolatedPositionRef.current;
        emitParticles("flapFastFallTrail", {
          x: pos?.x ?? p.x,
          y: pos?.y ?? p.y,
          facing: p.facing ?? 1,
        });
      }, EMIT_INTERVAL);
    } else if (flapFastFallIntervalRef.current) {
      clearInterval(flapFastFallIntervalRef.current);
      flapFastFallIntervalRef.current = null;
      prevFlapFastFallSoundRef.current = false;
    }

    return () => {
      if (flapFastFallIntervalRef.current) {
        clearInterval(flapFastFallIntervalRef.current);
        flapFastFallIntervalRef.current = null;
      }
      prevFlapFastFallSoundRef.current = false;
    };
  }, [
    penguin.isFlapping,
    penguin.flapPhase,
    penguin.flapFastFalling,
    isLocalPlayer,
    emitParticles,
  ]);

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
    // While airborne in a flap, the identity ring stays PINNED TO THE GROUND
    // (like the shadow) so it keeps reading as a ground-position marker rather
    // than floating up with the penguin. Read live state via a ref since this
    // closure isn't recreated on every flap toggle.
    const followGetter = () => {
      const pos = interpolatedPositionRef.current;
      const px = pos?.x ?? penguin.x;
      let py = pos?.y ?? penguin.y;
      if (typeof px !== "number" || typeof py !== "number") return null;
      if (penguinRef.current?.isFlapping) py = SHADOW_GROUND_LEVEL;
      return { x: px, y: 720 - py };
    };

    const fire = () => {
      const pos = interpolatedPositionRef.current;
      const py = penguinRef.current?.isFlapping
        ? SHADOW_GROUND_LEVEL
        : pos?.y ?? penguin.y;
      emitParticles("localPlayerHalo", {
        x: pos?.x ?? penguin.x,
        y: py,
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

  // ─────────────────────────────────────────────────────────────────
  // OPEN-PALM THRUST VFX — force cone
  //
  // Fires on every change of palmThrustFxId — a server counter bumped once
  // per executed thrust. We can't key off the isPalmThrust rising edge:
  // buffered back+mouse1 spam runs the next thrust while isPalmThrust is
  // still latched true, so the client never sees false→true and would skip
  // the buffered cones. The counter changes on every execution → one cone
  // per thrust, always.
  //
  // The preset carries its own lead delay so the cone bloom lands as the arm
  // reaches full extension (~end of the ~90ms startup). We center on the
  // sprite exactly like the hit-spark (x + 70 + facingOffsetPx), and pass
  // dir = -facing — the authoritative forward screen-x direction (see the
  // auto-facing in gameFunctions) — so the cone always erupts toward the
  // opponent, never backward.
  // ─────────────────────────────────────────────────────────────────
  const prevPalmThrustFxId = useRef(null);
  useEffect(() => {
    const fxId = penguin.palmThrustFxId || 0;
    // Sync (don't fire) on first mount / round remount so a stale non-zero
    // counter from a prior round can't spawn a phantom cone.
    if (prevPalmThrustFxId.current === null) {
      prevPalmThrustFxId.current = fxId;
      return;
    }
    if (fxId !== prevPalmThrustFxId.current) {
      prevPalmThrustFxId.current = fxId;
      if (fxId > 0) {
        const pos = interpolatedPositionRef.current;
        const px = pos?.x ?? penguin.x;
        const facing = penguin.facing ?? -1;
        const facingOffsetPx = (facing === 1 ? -8 : -3) * 12.8;
        emitParticles("palmThrust", {
          x: px + 70 + facingOffsetPx,
          y: PLAYER_MID_Y,
          dir: -facing,
          owner: penguin.id,
        });
      }
    }
  }, [penguin.palmThrustFxId, penguin.facing, penguin.x, emitParticles]);

  // Clear a lingering force cone the instant THIS player gets hit (i.e. gets
  // punished for whiffing the thrust). Scoped to penguin.id so the cone is
  // only wiped when its OWNER is hit — NOT when the owner's thrust connects
  // and the opponent's isHit fires (that global wipe made the cone vanish the
  // moment it hit). A whiffed cone otherwise hangs frozen mid-air during the
  // punish's hitstop while the thruster is knocked into a different pose.
  const prevPalmHitClear = useRef(false);
  useEffect(() => {
    if (penguin.isHit && !prevPalmHitClear.current) {
      clearPalmThrust(penguin.id);
    }
    prevPalmHitClear.current = penguin.isHit;
  }, [penguin.isHit, penguin.id, clearPalmThrust]);

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
      addShake("edge_pin");
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
    // index===0 owns the round-start announcement audio. This effect runs on
    // BOTH fighter instances, so without the guard the HAKKIYOI + bell SFX
    // fired twice on every round start (double-volume/phasing + redundant
    // decode work on the input frame).
    if (hakkiyoi && index === 0) {
      playSound(hakkiyoiSound, 0.015);
      playSound(bellSound, 0.005);
    }
  }, [hakkiyoi, index]);

  useEffect(() => {
    if (gyojiCall === "TE WO TSUITE!") {
      playSound(teWoTsuiteSound, 0.1);
    }
  }, [gyojiCall]);

  // Latch tachiai pose once HANDS DOWN fires — gyojiCall clears after 2s but ready holds until HAKKIYOI
  useEffect(() => {
    if (!penguin.isReady) {
      setHandsDownReached(false);
      return;
    }
    if (gyojiCall === "TE WO TSUITE!") {
      setHandsDownReached(true);
    }
  }, [penguin.isReady, gyojiCall]);

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
  // SCREEN SHAKE — unified trauma bus (lib/cameraShake)
  // ============================================
  // All shake (hits AND events: parries, clashes, clinch jolts, projectile
  // hits, edge pin, ring out, round start, power-up reveal) now flows through
  // one trauma-based model rendered by useCamera. Local events here call
  // addShake(type); server-emitted shakes are handled directly in useCamera's
  // "screen_shake" listener. The old --shake-x/y CSS path is retired in favor
  // of useCamera's --cam-x/y/-rot output, so there's a single coherent motion
  // and the HUD still stays rock-steady (only .game-scene is transformed).

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

  // Tracks the cinematic-kill smoke-trail rAF so it can be cancelled on unmount
  // / round change (the trail is a distance-based rAF loop, not a setInterval).
  const cinematicTrailRafRef = useRef(null);

  // Add screen shake, thick blubber absorption, and danger zone event listeners
  // MEMORY FIX: Track timeouts so we can clear them on unmount (prevents setState after unmount)
  useEffect(() => {
    const pendingTimeouts = [];

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
      addShake("ring_out");
    };
    socket.on("ring_out", handleRingOut);

    const handleCinematicKill = (data) => {
      if (index === 0) {
        emitParticles("cinematicKillImpact", {
          x: data.impactX,
          y: data.victimY,
        });

        playSound(pickRandomSound(chargedHitSounds), 0.07, null, 0.55, xToPan(data.impactX));

        // ── Suspend the particle sim for the hitstop ──
        // The scene + CSS rings already freeze on a cinematic kill (HitEffect's
        // `.cinematic-frozen`), but the canvas engine kept simulating, so the
        // impact sparks flew on through the dramatic freeze-frame. Freeze the
        // engine for the hitstop window so they hang suspended with everything
        // else, then release. A short bloom delay first lets the burst expand
        // into a readable "suspended explosion" (sparks caught mid-flight)
        // instead of locking as a tight cluster at the contact point.
        const hold = data.hitstopMs || 550;
        if (hold > 150) {
          const FREEZE_BLOOM_MS = 70;
          const freezeId = setTimeout(() => setFrozen(true), FREEZE_BLOOM_MS);
          const unfreezeId = setTimeout(() => setFrozen(false), hold);
          pendingTimeouts.push(freezeId, unfreezeId);
        }

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

        // SMOKE TRAIL — emitted ALONG the victim's flight path.
        //
        // The old version dropped one puff per setInterval(16ms) tick at the
        // victim's *current* position. setInterval drifts and coalesces whenever
        // the main thread is busy, so any hitch delays/drops a tick — the victim
        // flies a long way between two real emissions and you get a visible GAP
        // ("skipped lines"). It was time-based, so it was only ever as smooth as
        // the frame timing.
        //
        // This version is DISTANCE-based and rAF-driven: each frame we read the
        // freshest interpolated position and lay puffs every SPACING px along the
        // segment from the last puff to the current position. If a frame is
        // dropped and the victim jumps far, we BACKFILL the segment with multiple
        // evenly-spaced puffs (capped per frame) so the trail stays continuous no
        // matter how janky the timing gets — the gap can't form.
        const SPACING = 24; // game-px between puffs (even spacing = no gaps)
        const MAX_FILL = 5; // cap puffs/frame so a long stall can't burst-spawn
        const TRAIL_DURATION_MS = 820; // ≈ the old 50 ticks × 16ms

        const trailStartId = setTimeout(() => {
          const startedAt = performance.now();
          let last = null;
          const step = (now) => {
            if (now - startedAt > TRAIL_DURATION_MS) {
              cinematicTrailRafRef.current = null;
              return;
            }
            const pos = interpolatedPositionRef.current;
            if (pos && typeof pos.x === "number") {
              const py = pos.y ?? 290;
              if (!last) {
                last = { x: pos.x, y: py };
                emitParticles("cinematicKillTrail", {
                  x: last.x,
                  y: last.y,
                  direction: trailDir,
                });
              } else {
                let dx = pos.x - last.x;
                let dy = py - last.y;
                let dist = Math.hypot(dx, dy);
                let fills = 0;
                while (dist >= SPACING && fills < MAX_FILL) {
                  const t = SPACING / dist;
                  last = { x: last.x + dx * t, y: last.y + dy * t };
                  emitParticles("cinematicKillTrail", {
                    x: last.x,
                    y: last.y,
                    direction: trailDir,
                  });
                  dx = pos.x - last.x;
                  dy = py - last.y;
                  dist = Math.hypot(dx, dy);
                  fills++;
                }
                // Hit the per-frame cap on a huge jump (a long stall): snap
                // forward to current so we don't chase a stale backlog next frame.
                if (fills >= MAX_FILL) last = { x: pos.x, y: py };
              }
            }
            cinematicTrailRafRef.current = requestAnimationFrame(step);
          };
          cinematicTrailRafRef.current = requestAnimationFrame(step);
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
      // Stop the distance-based smoke-trail rAF loop if one is mid-flight.
      if (cinematicTrailRafRef.current) {
        cancelAnimationFrame(cinematicTrailRafRef.current);
        cinematicTrailRafRef.current = null;
      }
      // Safety net: if this effect tears down mid-cinematic (unmount / round
      // change) the scheduled unfreeze timeout above is cleared, so make sure
      // the engine never gets stranded in its frozen state.
      if (index === 0) setFrozen(false);
      socket.off("thick_blubber_absorption", handleThickBlubber);
      socket.off("ring_out", handleRingOut);
      socket.off("cinematic_kill", handleCinematicKill);
      socket.off("clinch_kill_throw", handleClinchKillThrow);
      socket.off("clinch_jolt", handleClinchJolt);
      socket.off("grab_armor_absorb", handleGrabArmorAbsorb);
      socket.off("grab_armor_break", handleGrabArmorBreak);
    };
  }, [socket, player.id, localId, roomName, index, emitParticles, penguin.id, setFrozen]);

  // Final cleanup effect - ensure all music stops when component unmounts
  useEffect(() => {
    if (!ownsMatchMusic) return;
    return () => {
      stopEeshi();
      stopBattleMusic();
    };
  }, [ownsMatchMusic, stopEeshi, stopBattleMusic]);

  // ============================================
  // DISPLAY STATE - Merges predicted state with server state
  // This is what we actually render - gives instant visual feedback
  // PERFORMANCE: Memoized to avoid recalculating on every render
  // ============================================
  const displayPenguin = useMemo(() => {
    return getDisplayState();
    // predictionVersion invalidates the cache when a local prediction is
    // applied (predictions live in a ref, invisible to React's dep tracking).
    // Without it predicted actions only render after the next server packet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getDisplayState, predictionVersion]);

  // Track charge sessions so CSS animation restarts on each new charge
  const isCurrentlyCharging = displayPenguin.isChargingAttack;
  if (isCurrentlyCharging && !prevChargingRef.current) {
    chargeAnimKeyRef.current++;
  }
  prevChargingRef.current = isCurrentlyCharging;

  // Calculate position ONCE per render. Deliberately NOT memoized: it reads
  // the live interpolation ref, so every render must commit the freshest
  // value (a memo keyed on server x/y would snap elements back to a stale
  // position on prediction-triggered renders).
  const displayPosition = getDisplayPosition();

  // Sync refs the imperative position loop reads (flags for position
  // formulas + which side of the dohyo boundary this render committed).
  penguinRef.current = penguin;
  lastRenderedOutsideRef.current = isOutsideDohyo(
    displayPosition.x,
    displayPosition.y
  );

  // ============================================
  // SPRITE RECOLORING
  // Compute the current sprite and apply recoloring if needed
  // ============================================
  // Side profile until gyoji "TE WO TSUITE!" (HANDS DOWN), then tachiai until HAKKIYOI
  const readyIntroComplete = penguin.isReady && handsDownReached;

  // FLAP wing-beat frame. Each new server flapWingBeatTime opens a local
  // down-stroke window (flap2); otherwise the wings are up (flap1). With no
  // air charges left or holding S to fast-fall, getImageSrc switches to the
  // dodge pose for the rest of that flight segment. Ref mutated during render —
  // same pattern as idle-hold refs.
  if (
    penguin.flapWingBeatTime &&
    penguin.flapWingBeatTime !== flapBeatRef.current.beat
  ) {
    flapBeatRef.current = {
      beat: penguin.flapWingBeatTime,
      startedAt: performance.now(),
    };
  }
  const flapHoldingFastFall =
    penguin.flapFastFalling === true ||
    (isLocalPlayer && !!getLocalKeyState()?.s);
  const flapUseDodgePose =
    penguin.isFlapping &&
    penguin.flapPhase === "flight" &&
    ((penguin.flapCharges ?? 0) <= 0 || flapHoldingFastFall);
  const flapFrame =
    penguin.isFlapping &&
    flapBeatRef.current.startedAt &&
    performance.now() - flapBeatRef.current.startedAt < FLAP_WINGBEAT_MS
      ? 2
      : 1;

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
    readyIntroComplete,
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
    penguin.clinchJoltRecovery,
    penguin.isFlapping,
    penguin.flapPhase,
    flapFrame,
    flapUseDodgePose,
    displayPenguin.isPalmThrust
  );

  // Hold previous sprite briefly when transitioning to idle to prevent
  // ghost frames during state transition gaps (e.g. isHit=false before isRecovering=true)
  // Skip hold for dodge→idle: dash recovery should snap to idle instantly so
  // consecutive dashes read as distinct (the hold would mask the idle gap).
  // Time-based window; the rAF loop forces a re-render when it expires.
  const renderNowMs = performance.now();
  let effectiveSpriteSrc = displaySpriteSrc;
  if (displaySpriteSrc === pumo && lastNonIdleSpriteRef.current) {
    if (lastNonIdleSpriteRef.current === dodging || lastNonIdleSpriteRef.current === recovering) {
      lastNonIdleSpriteRef.current = null;
      idleHoldUntilRef.current = 0;
    } else {
      if (idleHoldUntilRef.current === 0) {
        // First idle render after a non-idle sprite — open the hold window.
        idleHoldUntilRef.current = renderNowMs + IDLE_HOLD_MS;
      }
      if (renderNowMs < idleHoldUntilRef.current) {
        effectiveSpriteSrc = lastNonIdleSpriteRef.current;
      } else {
        lastNonIdleSpriteRef.current = null;
        idleHoldUntilRef.current = 0;
      }
    }
  } else if (displaySpriteSrc !== pumo) {
    lastNonIdleSpriteRef.current = displaySpriteSrc;
    idleHoldUntilRef.current = 0;
  }

  // ── Hit visual response: mutually exclusive white flash XOR red tint ──
  // A single hit only ever produces ONE of these two responses, never both.
  // Rationale: stacking white→red within a single hit's lifecycle creates a
  // visually messy color transition (the eye reads it as two separate beats
  // glued together, not one impact response). Splitting them by hit role
  // gives each its own coherent moment:
  //
  //   • Opening hit (or isolated hit): pure ~67ms white impact-snap.
  //   • Combo follow-up (within 300ms): pure ~167ms red damage tint.
  //
  // Typical combo timing (~100–150ms between hits) means the opener's
  // 67ms white flash ends well before the follow-up's red tint starts —
  // so the two colors are separated in time, not adjacent.
  // Windows are time deadlines (was render-frame counters); the rAF loop
  // forces the "off" re-render when an active window expires.
  if (penguin.isHit && !lastHitState.current) {
    if (renderNowMs - lastHitFlashTime.current > HIT_FLASH_COOLDOWN_MS) {
      // Opening / isolated hit: white impact-snap only.
      hitFlashUntilRef.current = renderNowMs + HIT_FLASH_MS;
      lastHitFlashTime.current = renderNowMs;
    } else {
      // Cooldown-suppressed combo follow-up: red damage tint only.
      hitTintUntilRef.current = renderNowMs + HIT_TINT_MS;
    }
  }
  if (!penguin.isHit) {
    hitTintUntilRef.current = 0;
    hitFlashUntilRef.current = 0;
  }
  const showHitTintThisFrame =
    penguin.isHit && renderNowMs < hitTintUntilRef.current;
  const showHitFlashThisFrame =
    penguin.isHit && renderNowMs < hitFlashUntilRef.current;
  // Safety precedence: by construction (see hit-trigger block above) only ONE
  // of the two windows is opened per hit, so they shouldn't overlap. The
  // && !showHitFlashThisFrame guard remains as a defensive net for the rare
  // case where a follow-up hit lands inside the opener's flash window —
  // in that edge case white wins on the contested frames.
  const renderHitTint = showHitTintThisFrame && !showHitFlashThisFrame;

  // Bookkeeping for the rAF watcher: record what this render committed so the
  // loop knows when an active visual window expires (and only then re-renders).
  renderedHitVisualsRef.current.flash = showHitFlashThisFrame;
  renderedHitVisualsRef.current.tint = showHitTintThisFrame;
  renderedHitVisualsRef.current.hold = effectiveSpriteSrc !== displaySpriteSrc;
  // FLAP wing-beat: when this render committed the down-stroke (flap2), the rAF
  // loop forces the flip back to flap1 once the beat window expires — unless
  // we're in the dodge pose (out of charges or fast-falling), which holds until
  // landing or S is released.
  renderedHitVisualsRef.current.flapBeat =
    !flapUseDodgePose && flapFrame === 2;
  // True when this render showed merged (unconfirmed) predictions — the rAF
  // watcher uses it to force the cleanup render once the prediction window
  // (PREDICTION_TIMEOUT_MS) lapses without server confirmation.
  renderedHitVisualsRef.current.prediction =
    isLocalPlayer && displayPenguin !== penguin;

  // Tint priority: white flash (impact frames) > red hit tint > thick blubber
  // (Dodge invincibility is handled via CSS opacity pulse, not sprite-level tinting)
  // Grab-armor absorb intentionally does NOT tint the body — the
  // particle ring alone communicates the absorb without washing the
  // player out. `useArmorTint` is kept as a constant `false` so the
  // shared sprite-recolor pipeline below doesn't need to change.
  const useArmorTint = false;
  // Suppress blubber tint during both flash and red-tint frames so the
  // damage-state visuals win cleanly over passive power-up tinting.
  const useBlubberTint =
    thickBlubberIndicator && !showHitTintThisFrame && !showHitFlashThisFrame;

  // Get sprite render info (handles animated spritesheets and recoloring).
  // `renderHitTint` (NOT raw showHitTintThisFrame) is passed for the red tint
  // arg so the white impact flash visually takes priority during its 4-frame
  // window. `showHitFlashThisFrame` is passed as the isWhiteFlash arg.
  const spriteRenderInfo = getSpriteRenderInfo(
    effectiveSpriteSrc,
    renderHitTint,
    showHitFlashThisFrame,
    useBlubberTint,
    false,
    useArmorTint
  );
  const isKillVictim = penguin.isClinchKillThrowVictim || penguin.isClinchKillPullVictim;

  // Kill victims use a static image (forceStatic bypasses the spritesheet lookup
  // that would return a 3-frame strip, while still applying recoloring). The white
  // impact flash still applies here — being on the receiving end of a cinematic
  // kill is exactly when a sharp impact-snap reads strongest.
  //   • Throw kill → the hit APNG (spinning faceplant arc).
  //   • Pull kill  → belly-laying pose: eyes open during the slide, eyes closed
  //     once the bow phase starts.
  const killVictimSprite = penguin.isClinchKillPullVictim
    ? penguin.isBowing
      ? bellyLayingSprite
      : bellyLayingEyesOpenSprite
    : hitSprite;
  const {
    src: recoloredSpriteSrc,
    isAnimated: isAnimatedSprite,
    config: spriteConfig,
  } = isKillVictim
    ? getSpriteRenderInfo(killVictimSprite, renderHitTint, showHitFlashThisFrame, useBlubberTint, true, useArmorTint)
    : spriteRenderInfo;

  const { src: dodgeGhostSpriteSrc } = getSpriteRenderInfo(
    dodging,
    false,
    false,
    false,
    true
  );

  // GHOST-FRAME / INTERACTION-HITCH FIX:
  // Key the fighter <img> on the tint- and color-INDEPENDENT base source (the
  // pose identity), NOT the recolored/tinted blob URL. During combat the tint
  // toggles every few frames (white impact flash, red damage tint, charge
  // white, blubber purple); each toggle changes `recoloredSpriteSrc`. When that
  // was the React `key`, every toggle REMOUNTED the <img> — which (a) starts
  // blank and must decode → the one-frame "ghost", and (b) restarts the CSS
  // spritesheet animation from frame 0 → a visible animation reset mid-combo.
  //
  // Keying on the base source instead means tint/color changes update `src` IN
  // PLACE on a stable element: the browser keeps painting the last decoded
  // frame until the new src decodes (no blank), and the animation keeps running.
  // A remount (and intended animation restart) now happens ONLY on a genuine
  // pose change. This mirrors `sourceToRecolor` inside getSpriteRenderInfo:
  // animated → the spritesheet; static → the original (kill-victim) source.
  const baseSpriteSrc = spriteConfig
    ? spriteConfig.spritesheet
    : isKillVictim
    ? killVictimSprite
    : effectiveSpriteSrc;

  // BASHO no-remount fix: the fighter <img> is keyed on the color-INDEPENDENT
  // base source (the ghost-frame fix above) so tint toggles update `src` in
  // place without remounting/re-decoding. The downside: when this persistent
  // fighter's COLOR changes between bouts (a new day's opponent), the element
  // is reused and the browser keeps painting the last-decoded frame (the
  // PREVIOUS opponent's colors) — the in-place src swap to the new-color blob
  // doesn't reliably force a re-decode. Folding the color into the key remounts
  // the <img> ONLY on a genuine color change (rare, between bouts behind the
  // DAY/pre-match overlay), forcing a clean decode of the new-color sprite,
  // while tint changes during combat (color stable) still update in place.
  const spriteColorKey = `${targetColor || ""}:${playerBodyColor || ""}`;

  // Update animation state (will start/stop intervals as needed)
  updateSpriteAnimation(effectiveSpriteSrc);

  // Determine if we should show ritual or fighter sprite
  const showRitualSprite = shouldShowRitualForPlayer && ritualSpriteConfig;

  // Ring-out layering: while this fighter is OUTSIDE the dohyo boundary, its
  // sprite is portaled down into the scene (`.fallen-actors`, below the lit
  // dohyo at z:1) so it sinks BEHIND the platform instead of floating over it
  // in the actors layer (which lives above the HUD/dohyo). Only the sprite
  // moves — shadow, VFX and HUD stay put; the shadow never flipped under the
  // dohyo even in the old single-layer setup. `forceVisualRender` already
  // forces a render on the boundary flip, so the swap lands at the right frame.
  const isOutsideRingNow = isOutsideDohyo(displayPosition.x, displayPosition.y);
  const fallenSpriteHost =
    isOutsideRingNow && typeof document !== "undefined"
      ? document.querySelector(".fallen-actors")
      : null;

  return (
    <div className="ui-container">
      {/* Ambient snowfall now lives at the scene level (single system in
          Game.jsx). This per-fighter instance only handles the kenshō envelope
          shower for the winning player on match-over. */}
      {matchOver && (
        <SnowEffect mode="envelope" winner={winner} playerIndex={index} />
      )}
      {/* World-space: Gyoji stays in the scene and zooms with camera */}
      <Gyoji gyojiState={gyojiState} hakkiyoi={hakkiyoi} />

      {/* Player-info lower-thirds: portalled into #game-hud-info, which sits
          BELOW the actors layer so airborne penguins paint over the nameplates
          (fighting-game style) while the panel itself stays visually identical. */}
      {index === 0 &&
        document.getElementById("game-hud-info") &&
        createPortal(
          (() => {
            const inferActiveFromState = (playerData) => {
              if (playerData?.activePowerUp) return playerData.activePowerUp;
              if ((playerData?.snowballThrowsRemaining ?? 0) > 0) return "snowball";
              if ((playerData?.pumoArmySpawnsRemaining ?? 0) > 0) return "pumo_army";
              return null;
            };
            const bashoHudActive = (draftList, playerData) =>
              toBashoHudActive(
                getBashoActiveDraft(draftList || []) ??
                  inferActiveFromState(playerData)
              );
            const bashoPlayerActive = bashoHudActive(
              bashoDraftedPowerUps,
              allPlayersData.player1
            );
            const bashoOpponentActive = bashoHudActive(
              bashoOpponentPowerUps,
              allPlayersData.player2
            );

            const hudProps = {
              playerOneWinCount,
              playerTwoWinCount,
              roundHistory,
              roundId: uiRoundId,
              matchOver,
              isPlayer1Local: isLocalPlayer,
              player1RankLabel: bashoPlayerRankLabel,
              player2RankLabel: bashoOpponentRankLabel,
              player1Stamina: allPlayersData.player1?.stamina ?? 100,
              player1ActivePowerUp: isBashoMatch
                ? bashoPlayerActive
                : allPlayersData.player1?.activePowerUp ??
                  inferActiveFromState(allPlayersData.player1),
              player1SnowballCooldown:
                allPlayersData.player1?.snowballCooldown ?? false,
              player1SnowballThrowsRemaining:
                allPlayersData.player1?.snowballThrowsRemaining ?? null,
              player1PumoArmyCooldown:
                allPlayersData.player1?.pumoArmyCooldown ?? false,
              player1PumoArmySpawnsRemaining:
                allPlayersData.player1?.pumoArmySpawnsRemaining ?? null,
              player1IsGassed: allPlayersData.player1?.isGassed ?? false,
              player1ParryRefund: p1ParryRefund,
              player1Balance: allPlayersData.player1?.balance ?? 100,
              player1BalanceGain: p1BalanceGain,
              player2Stamina: allPlayersData.player2?.stamina ?? 100,
              player2ActivePowerUp: isBashoMatch
                ? bashoOpponentActive
                : allPlayersData.player2?.activePowerUp ??
                  inferActiveFromState(allPlayersData.player2),
              player2SnowballCooldown:
                allPlayersData.player2?.snowballCooldown ?? false,
              player2SnowballThrowsRemaining:
                allPlayersData.player2?.snowballThrowsRemaining ?? null,
              player2PumoArmyCooldown:
                allPlayersData.player2?.pumoArmyCooldown ?? false,
              player2PumoArmySpawnsRemaining:
                allPlayersData.player2?.pumoArmySpawnsRemaining ?? null,
              player2IsGassed: allPlayersData.player2?.isGassed ?? false,
              player2ParryRefund: p2ParryRefund,
              player2Balance: allPlayersData.player2?.balance ?? 100,
              player2BalanceGain: p2BalanceGain,
            };

            if (isBashoMatch) {
              return (
                <UiPlayerInfoBasho
                  {...hudProps}
                  bashoDraftedPowerUps={bashoDraftedPowerUps || []}
                  bashoOpponentPowerUps={bashoOpponentPowerUps || []}
                  bashoDay={bashoDay}
                  bashoOpponentName={bashoOpponentName}
                />
              );
            }

            return <UiPlayerInfo {...hudProps} />;
          })(),
          document.getElementById("game-hud-info")
        )}

      {/* Screen-space HUD: portalled outside the scene so it never zooms.
          NOTE: UiPlayerInfo is portalled separately into #game-hud-info (above)
          so it can sit UNDER the actors layer. Everything below stays in
          #game-hud (z 210) and remains ABOVE the wrestlers. */}
      {document.getElementById("game-hud") &&
        createPortal(
          <>
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
            {index === 0 && matchOver && !isBashoMatch && (
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
          {/* PERF: pre-inject every SumoAnnouncementBanner type/side variant so the
              first real COUNTER HIT / PUNISH / PERFECT PARRY callout doesn't pay
              styled-components CSS injection + first-paint cost mid-combat. Each
              $type renders a different color/rule treatment (a distinct generated
              class), so we warm them all, both sides. Unmounts after 2 frames. */}
          {[
            "parry",
            "perfect",
            "perfectparry",
            "counter",
            "counterhit",
            "punish",
            "countergrab",
            "break",
            "tech",
            "default",
          ].map((t) => (
            <span key={`warm-${t}`}>
              <SumoAnnouncementBanner text="WARM" type={t} isLeftSide={true} />
              <SumoAnnouncementBanner text="WARM" type={t} isLeftSide={false} />
            </span>
          ))}
          {/* PERF: warm the round-start HAKKIYOI / TE WO TSUITE announcements
              too. Profiling showed round 1's game_start paid a ~119ms first-use
              mount cost (styled-components injection + first paint of this
              announcement tree) right as opening inputs go live; later rounds
              were clean. Pre-injecting it here moves that one-time cost into the
              hidden pre-round warm-up. */}
          <SumoGameAnnouncement type="hakkiyoi" duration={1.8} />
          <SumoGameAnnouncement type="tewotsuite" duration={2} />
        </div>
      )}
      {penguin.id === localId &&
        !hakkiyoi &&
        gyojiState === "idle" &&
        countdown > 0 && (
          <YouLabel
            ref={youLabelDomRef}
            x={displayPosition.x}
            y={displayPosition.y}
          />
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
      {/* Ground shadow — like the sprite, it rides down into `.fallen-actors`
          (scene, below the dohyo) while this fighter is outside the ring so it
          sinks behind the platform instead of floating over it. It already
          flips its own z-index to 0 when outside (PlayerShadow), so once it's
          back in the scene that 0 lands below the dohyo's z:1. */}
      {(() => {
        const shadowNode = (
          <PlayerShadow
            ref={shadowDomRef}
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
            isFlapping={penguin.isFlapping}
            isLocalPlayer={penguin.id === localId}
          />
        );
        return isOutsideRingNow && fallenSpriteHost
          ? createPortal(shadowNode, fallenSpriteHost)
          : shadowNode;
      })()}
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
      {/* Sprite — while this fighter is outside the ring its sprite is portaled
          into `.fallen-actors` (scene, below the dohyo) so it sinks behind the
          platform; otherwise it renders inline in the actors layer. */}
      {(() => {
      const fighterSpriteNodes = (
      <>
      <DashAfterimageEffect
        isDodging={displayPenguin.isDodging}
        spriteSrc={dodgeGhostSpriteSrc}
        facing={penguin.facing ?? -1}
        dodgeDirection={
          displayPenguin.dodgeDirection ?? penguin.dodgeDirection ?? penguin.facing ?? 1
        }
        getPosition={() => interpolatedPositionRef.current}
        isAtTheRopes={penguin.isAtTheRopes}
        fighter={penguin.fighter}
      />
      {/* Animated Sprite Sheet (when sprite is a spritesheet animation) */}
      {isAnimatedSprite && !showRitualSprite && (
        <AnimatedFighterContainer
          ref={animContainerDomRef}
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
            key={`${baseSpriteSrc}|${spriteColorKey}`}
            src={recoloredSpriteSrc}
            alt="fighter"
            $frameCount={spriteConfig?.frameCount || 1}
            $fps={spriteConfig?.fps || 30}
            $loop={spriteConfig?.loop !== false}
            $isLocalPlayer={penguin.id === localId}
            $isAtTheRopes={penguin.isAtTheRopes}
            $isGrabBreaking={penguin.isGrabBreaking}
            $isRawParrying={displayPenguin.isRawParrying}
            $isPerfectRawParrySuccess={penguin.isPerfectRawParrySuccess}
            $isHit={penguin.isHit}
            $isChargingAttack={displayPenguin.isChargingAttack}
            $isGrabTeching={penguin.isGrabTeching}
            $grabTechRole={penguin.grabTechRole}
            $isGrabWhiffRecovery={penguin.isGrabWhiffRecovery}
            $attackerConfirmTier={attackerConfirmTier}
            decoding="async"
            draggable={false}
          />
        </AnimatedFighterContainer>
      )}

      {/* Static Sprite (when sprite is not an animated spritesheet) */}
      {!isAnimatedSprite && (
        <StyledImage
          ref={fighterImgDomRef}
          key={`${baseSpriteSrc}-${chargeAnimKeyRef.current}|${spriteColorKey}`}
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
          $readyIntroComplete={readyIntroComplete}
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
          decoding="async"
          style={{ display: showRitualSprite ? "none" : "block" }}
        />
      )}
      </>
      );
      return isOutsideRingNow && fallenSpriteHost
        ? createPortal(fighterSpriteNodes, fallenSpriteHost)
        : fighterSpriteNodes;
      })()}

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
        key={uiRoundId}
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing ?? -1}
        isActive={shouldShowSlapAttackHands(penguin, { gameOver, matchOver })}
        isHit={penguin.isHit === true}
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
  predictionRef: PropTypes.object,
  playerColor: PropTypes.string,
  playerBodyColor: PropTypes.string,
  isCPUMatch: PropTypes.bool,
  isBashoMatch: PropTypes.bool,
  bashoPlayerRankLabel: PropTypes.string,
  bashoOpponentRankLabel: PropTypes.string,
  bashoDraftedPowerUps: PropTypes.arrayOf(PropTypes.string),
  bashoOpponentPowerUps: PropTypes.arrayOf(PropTypes.string),
  bashoDay: PropTypes.number,
  bashoOpponentName: PropTypes.string,
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
    // BASHO no-remount fix (root cause of BOTH the stuck-opponent-color bug AND
    // the progressive ghost frames): the opponent's `player` object reference is
    // stable across bouts (merged in place), so without comparing the colors
    // this comparator returned true on a new day and React BAILED OUT — silently
    // discarding the new playerColor/playerBodyColor prop. The fighter then only
    // re-rendered via the player2Color CONTEXT change, but with the stale (Day-1)
    // props the memo never accepted → main fighter stuck on Day-1 colors while
    // the context-driven clones updated correctly. It also desynced what
    // preloadSprites PINNED (new color) from what the fighter RENDERED (old
    // color), so the rendered sprites got LRU-evicted → ghost frames. Comparing
    // the colors here makes a color change re-render the fighter with fresh
    // props. These only differ between bouts, so combat re-render cost is zero.
    prevProps.playerColor === nextProps.playerColor &&
    prevProps.playerBodyColor === nextProps.playerBodyColor &&
    // NOTE: isPowerUpSelectionActive was intentionally removed here. GameFighter
    // never reads it in render, but having it in this comparator forced BOTH
    // fighters to fully re-render every time power-up selection started/ended —
    // a measured ~70-90ms transition stall for zero visual change. Input gating
    // for selection lives in Game.jsx, not here.
    prevProps.isCPUMatch === nextProps.isCPUMatch &&
    prevProps.isBashoMatch === nextProps.isBashoMatch &&
    prevProps.bashoPlayerRankLabel === nextProps.bashoPlayerRankLabel &&
    prevProps.bashoOpponentRankLabel === nextProps.bashoOpponentRankLabel &&
    prevProps.bashoDraftedPowerUps === nextProps.bashoDraftedPowerUps &&
    prevProps.bashoOpponentPowerUps === nextProps.bashoOpponentPowerUps &&
    prevProps.bashoDay === nextProps.bashoDay &&
    prevProps.bashoOpponentName === nextProps.bashoOpponentName
  );
});
