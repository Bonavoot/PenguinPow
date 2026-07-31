import React, {
  useContext,
  useEffect,
  useLayoutEffect,
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
import IceReflection, {
  ICE_REFLECTION_FOOT_NUDGE_PCT,
  iceReflectionBottomY,
  iceReflectionOpacity,
  iceReflectionShouldShow,
} from "./IceReflection";
import ThrowTechEffect from "./ThrowTechEffect";
import SlapParryEffect from "./SlapParryEffect";
import BlockingEffect, { BLOCK_SUCCESS_POSE_MS } from "./BlockingEffect";
import ChargeClashEffect from "./ChargeClashEffect";
import { useParticles } from "../particles/ParticleContext";
import StarStunEffect, {
  STAR_STUN_BOTTOM_OFFSET_PCT,
} from "./StarStunEffect";
import GrabBreakEffect from "./GrabBreakEffect";
import GrabTechEffect from "./GrabTechEffect";
import ClinchJoltEffect from "./ClinchJoltEffect";
import CounterGrabEffect from "./CounterGrabEffect";
import PunishBannerEffect from "./PunishBannerEffect";
import GoredBannerEffect from "./GoredBannerEffect";
import MatadorSuccessEffect from "./MatadorSuccessEffect";
import CounterHitEffect from "./CounterHitEffect";
import EdgeDangerEffect from "./EdgeDangerEffect";
import GripPromptEffect from "./GripPromptEffect";
import ClinchCalloutEffect from "./ClinchCalloutEffect";
import NoStaminaEffect from "./GassedEffect";
import SnowballImpactEffect from "./SnowballImpactEffect";
import PumoCloneSpawnEffect from "./PumoCloneSpawnEffect";
import SlapHitSpriteEffect from "./SlapHitSpriteEffect";
import SumoGameAnnouncement from "./SumoGameAnnouncement";
import {
  recolorImage,
  getCachedRecoloredImage,
  preDecodeImage,
  BLUE_COLOR_RANGES,
  GREY_BODY_RANGES,
  SPRITE_BASE_COLOR,
  COLOR_PRESETS,
} from "../utils/SpriteRecolorizer";
import { getBakedSprite } from "../utils/bakedSprites";
import { usePlayerColors } from "../context/PlayerColorContext";
import { addShake } from "../lib/cameraShake";
import {
  getSharedFighterState,
  isMasteryP5Live,
  subscribeFighterSnapshot,
} from "../net/fighterSnapshotBus";

import UiPlayerInfo from "./UiPlayerInfo";
import UiPlayerInfoBasho from "./UiPlayerInfoBasho";
import { getBashoActiveDraft, toBashoHudActive } from "../config/powerUpConfig";
import MatchOver from "./MatchOver";
import RoundResult from "./RoundResult";
import SumoAnnouncementBanner from "./SumoAnnouncementBanner";
import SumoHypeStamp from "./SumoHypeStamp";
import PerfectBraceEffect from "./PerfectBraceEffect";
import HitEffect from "./HitEffect";
import RawParryEffect from "./RawParryEffect";
import { getGlobalVolume } from "./Settings";
import { playBuffer, createCrossfadeLoop } from "../utils/audioEngine";
import SnowEffect from "./SnowEffect";
import "./theme.css";
import { SERVER_BROADCAST_HZ, DOHYO_LEFT_BOUNDARY, DOHYO_RIGHT_BOUNDARY, isOutsideDohyo } from "../constants";
import {
  SLAP_ANIM,
  AP_WHIFF_RECOVERY_MS,
} from "../config/combatTiming";
import {
  SHADOW_GROUND_LEVEL,
  playerShadowBottomY,
  playerShadowOpacity,
  playerShadowShouldShow,
} from "./PlayerShadow";

/** Hit / defense VFX X — prefer server contact seam, fall back to legacy +70. */
function contactFxX(data) {
  if (data && typeof data.contactX === "number") return data.contactX;
  return (data?.x ?? 0) + 70;
}

function hasContactSeam(data) {
  return data && typeof data.contactX === "number";
}
// Kill-throw: swap to flat landing art this many px above GROUND_LEVEL so the
// KO pose finishes the descent (avoids a hard cut on the impact frame).
const KILL_THROW_LANDING_EARLY_PX = 80;
// Must clear this height before early-landing can arm — blocks the pre-rise
// grounded frames at throw start from looking like "near impact".
const KILL_THROW_PEAK_ARM_PX = 400;
import { getDisplayHitstopUntil, getEstimatedRtt } from "../lib/serverClock";
import {
  MovementPredictor,
  isMovementPredictionEnabled,
} from "../prediction/movementPredictor";
import { getLocalKeyState, isLocalGameActive } from "../prediction/localInput";
import {
  isCombatFidelityDebugEnabled,
  noteCombatContactEvent,
  renderCombatFidelityOverlay,
} from "../debug/CombatFidelityDebug";

// Eeshi = pre-bout bed; battle BGM sits lower so hits/SFX stay forward in the mix.
const EESHI_MUSIC_VOL = 0.018;
const BATTLE_MUSIC_VOL = 0.014;
const EESHI_LOOP_CROSSFADE = 1.5;
const BATTLE_LOOP_CROSSFADE = 2.0;
const EESHI_ENTRY_FADE = 0.9;
const BATTLE_ENTRY_FADE = 0;
// After round end: keep BGM going briefly, then a longer fade (not a hard cut).
const BATTLE_EXIT_HOLD = 1.5;
const BATTLE_EXIT_FADE = 2.8;

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
  HIT_EFFECT_Y,
  FLAP_HIT_EFFECT_Y,
  LOW_KICK_HIT_EFFECT_Y,
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
  cinematicThrowKillLanding as cinematicThrowKillLandingSprite,
  pushDefeatPose as pushDefeatPoseSprite,
  grabbing as grabbingSprite,
  clinchPlanting as clinchPlantingSprite,
  beltGrabArm as beltGrabArmSprite,
} from "./fighterAssets";
import getImageSrc from "./getImageSrc";
import {
  getHatOverlayForSprite,
  getEquippedHeadGearId,
  isHeadGearUnderBody,
} from "../config/cosmetics";
import { resolveBodyForHeadGear } from "../config/baldSprites";
import {
  compositeHatOntoSprite,
  resolveHattedSpriteSync,
  resolveHatOverlaySrcSync,
} from "../utils/hatComposite";
import { recordFighterPresent } from "../utils/perf/GhostFrameTracer";
import { getPerfRecorder } from "../utils/perf/PerfRecorder";
import { tintFromFlags } from "../utils/bakedSprites";
import {
  StyledImage,
  DeepGripArmGlow,
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
// Hitstop-aware animation clock
// ---------------------------------------------------------------------
// Client-driven pose animations (palm thrust, slap string) advance off a local
// ms clock anchored on a rising edge. The problem: a landed hit triggers a
// display-hitstop freeze that PAUSES the game (see getDisplayHitstopUntil), but
// the interpolation rAF loop EARLY-RETURNS during that freeze — so no renders
// occur while frozen, and a naive `now - startedAt` clock would silently accrue
// the freeze duration and JUMP forward (skipping the hit/impact frame) the
// instant the freeze ends.
//
// This helper banks each freeze window's duration into `frozenAccum` so elapsed
// time excludes any hitstop. It self-corrects from a single post-freeze render:
// the freeze end-time (hitstopUntil) is known, so once `now` passes it we bank
// the frozen span and elapsed resumes exactly where it paused — the impact
// frame holds through the freeze, then the animation continues cleanly.
//
// `clock` is a plain mutable object (kept on a ref): { startedAt, frozenAccum,
// freezeStart, freezeEnd, lastHitstopUntil }. Returns elapsed ms since anchor,
// excluding frozen time.
function computeAnimElapsed(clock, nowT) {
  const hitstopUntil = getDisplayHitstopUntil();
  // A newly-triggered freeze surfaces as a larger hitstopUntil than we've seen.
  // Record its window; freezeStart is clamped to the freeze end so observing it
  // late (after it already lapsed) banks nothing rather than a negative span.
  if (hitstopUntil > (clock.lastHitstopUntil || 0)) {
    clock.freezeStart = Math.min(nowT, hitstopUntil);
    clock.freezeEnd = hitstopUntil;
    clock.lastHitstopUntil = hitstopUntil;
  }
  // Once we're past a tracked freeze, bank its (non-negative) duration.
  if (clock.freezeEnd && nowT >= clock.freezeEnd) {
    clock.frozenAccum =
      (clock.frozenAccum || 0) + Math.max(0, clock.freezeEnd - clock.freezeStart);
    clock.freezeStart = 0;
    clock.freezeEnd = 0;
  }
  // While inside the freeze, pin elapsed to the moment the freeze began.
  const ref =
    clock.freezeEnd && nowT < clock.freezeEnd ? clock.freezeStart : nowT;
  return ref - clock.startedAt - (clock.frozenAccum || 0);
}

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

// Shared fighter_action merge lives in net/fighterSnapshotBus (Phase 5+).
// Game retains one socket listener; fighters/camera/VFX subscribe to fan-out.

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
    state.isHitFalling === true ||
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
  const {
    emit: emitParticles,
    clearRawParryBlueHold,
    clearMatadorGoldHold,
    clearPalmThrust,
    setFrozen,
  } = useParticles();

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

  // OPEN-PALM THRUST animation: a client-driven forward-only timeline anchored
  // to the rising edge of isPalmThrust (server keeps the flag true from startup
  // through recovery). Frame boundaries are cumulative ms since that edge —
  // tuned to the move's ~90ms startup / ~90ms active cadence, holding the
  // active strike longest and the smear shortest per the move's feel:
  //   [0,       STARTUP)  → 0 startup (windup)
  //   [STARTUP, SMEAR)    → 1 smear   (whoosh, shortest)
  //   [SMEAR,   ACTIVE)   → 2 active  (strike, held the longest)
  //   [ACTIVE,  ∞)        → 3 recovery(reuses the startup pose, brief tail)
  // Held forward-only so the differing hit vs whiff recovery lengths can't
  // desync the sequence — whichever ends first just drops the flag. The active
  // strike owns the bulk of the move; recovery is only a short settle before
  // the flag drops (on-hit recovery is short enough it may skip recovery
  // entirely and cut straight to the idle/recovering pose).
  // Flag lifetime on the server is ~500ms whiff / ~380ms hit. The pre-active
  // smear and the recovery smear are both kept EXTREMELY short (brief flashes)
  // so the active strike dominates: a ~24ms smear lead-in, then active until
  // ~460ms, leaving only a ~40ms recovery smear flash on whiff (hit is short
  // enough it cuts straight to idle).
  const palmThrustAnimRef = useRef({
    startedAt: 0,
    fxId: 0,
    frozenAccum: 0,
    freezeStart: 0,
    freezeEnd: 0,
    lastHitstopUntil: 0,
  });
  const PALM_THRUST_ANIM = {
    STARTUP_END: 20,
    SMEAR_END: 40,
    ACTIVE_END: 460,
  };

  // SLAP animation: client-driven windup → smear → hit → recovery.
  // Boundaries from config/combatTiming.js (mirrors server SLAP_*_MS):
  //   [0, WINDUP_END)              → 0 windup
  //   [WINDUP_END, HIT_POSE_START) → 1 smear
  //   [HIT_POSE_START, HIT_END)    → 2 hit (starts with active — parry freezes here)
  //   [HIT_END, ∞)                 → 3 recovery (ready stance)
  // Clock is hitstop-aware (computeAnimElapsed).
  const slapAnimRef = useRef({
    startedAt: 0,
    anim: 0,
    frozenAccum: 0,
    freezeStart: 0,
    freezeEnd: 0,
    lastHitstopUntil: 0,
  });
  // SLAP_ANIM imported from config/combatTiming.js (mirrors server SLAP_*_MS).

  // RAW PARRY SUCCESS pose director (client-side, juice — not sim-authoritative).
  //
  // Why a local hold: server success flags are NOT a stable animation clock.
  //   • Flurry re-tap (armAttackParry) CLEARS success pose immediately
  //   • Perfect hitstop vs regular made Frame 2 length vary
  //   • Hitstop packet vs state-stream can arrive in either order
  // So we run a FIXED minimum timeline per landed parry (restarted on each
  // raw_parry_success / rising edge), and keep painting it even after the
  // server clears the flags for the next read.
  //
  // Every land: blocking → success-f1 (quick) → success-f2 (hold). No frame 3.
  const rawParrySuccessVisualRef = useRef({
    startedAt: 0,
    until: 0,
    parryId: null,
    lastServerSuccess: false,
    chainCount: 1,
  });
  const rawParrySuccessFrameRef = useRef(1);
  const RAW_PARRY_SUCCESS_ANIM = {
    BLOCK_MS: 16, // blocking.png — ~1 frame
    FRAME1_MS: 40, // success-f1 — quick
    // F2 hold floor after block+f1. Longer hitstop on perfect only EXTENDS
    // past this — it never shortens it.
    MIN_HOLD_MS: 180,
    POST_HITSTOP_HOLD_MS: 80,
  };
  const successLeadMs = () =>
    RAW_PARRY_SUCCESS_ANIM.BLOCK_MS + RAW_PARRY_SUCCESS_ANIM.FRAME1_MS;
  // 0 = blocking, 1 = success-f1, 2 = success-f2
  const resolveRawParrySuccessFrame = (_v, wallElapsed) => {
    const { BLOCK_MS, FRAME1_MS } = RAW_PARRY_SUCCESS_ANIM;
    if (wallElapsed < BLOCK_MS) return 0;
    if (wallElapsed < BLOCK_MS + FRAME1_MS) return 1;
    return 2;
  };
  const beginRawParrySuccessVisual = useCallback((now, parryId, chainCount = 1) => {
    const v = rawParrySuccessVisualRef.current;
    // Deduplicate socket + rising-edge for the same land.
    if (parryId && v.parryId === parryId) return;
    // Rising-edge without id while a socket-started visual is still live: ignore.
    if (!parryId && now < v.until) return;

    const chain = Math.max(1, chainCount | 0);

    // Socket arriving after a rising-edge start for the same beat: adopt the
    // id / chain / hold length, but do NOT restart the swing.
    if (
      parryId &&
      typeof v.parryId === "string" &&
      v.parryId.startsWith("edge_") &&
      now < v.until
    ) {
      v.parryId = parryId;
      v.chainCount = chain;
      const hitstopUntil = getDisplayHitstopUntil();
      const minUntil =
        v.startedAt + successLeadMs() + RAW_PARRY_SUCCESS_ANIM.MIN_HOLD_MS;
      const hitstopBasedUntil =
        Math.max(hitstopUntil > now ? hitstopUntil : now, now) +
        RAW_PARRY_SUCCESS_ANIM.POST_HITSTOP_HOLD_MS;
      v.until = Math.max(v.until, minUntil, hitstopBasedUntil);
      return;
    }

    v.startedAt = now;
    v.parryId = parryId || `edge_${now}`;
    v.chainCount = chain;
    const hitstopUntil = getDisplayHitstopUntil();
    const minUntil = now + successLeadMs() + RAW_PARRY_SUCCESS_ANIM.MIN_HOLD_MS;
    const hitstopBasedUntil =
      Math.max(hitstopUntil > now ? hitstopUntil : now, now) +
      RAW_PARRY_SUCCESS_ANIM.POST_HITSTOP_HOLD_MS;
    v.until = Math.max(minUntil, hitstopBasedUntil);
    rawParrySuccessFrameRef.current = -1;
  }, []);

  // Dash phase clock. Anchored locally on the rising edge of the (predicted)
  // dodge so the windup→jump pose/arc sequence is reliable regardless of
  // netcode jitter. Must match DODGE_STARTUP_MS on the server.
  const dodgeVisualRef = useRef({ startedAt: 0, active: false });
  const DASH_WINDUP_MS = 50;

  const [penguin, setPenguin] = useState(() => ({
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
    isApWhiffRecovering: false,
    isMatadorParrying: false,
    isMatadorSuccess: false,
    isMatadorWhiffRecovering: false,
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
    isGrabPushDefeat: false,
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
    // Seed from room player so wardrobe gear shows before first discrete delta
    gearIds: Array.isArray(player?.gearIds) ? [...player.gearIds] : [],
    isCrouchStance: false,
    isCrouchStrafing: false,
    isFlapping: false,
    flapPhase: null,
    flapWingBeatTime: 0,
    flapCharges: 0,
    flapFastFalling: false,
    flapBeatHDir: 0,
  }));

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
  const grabArmImgDomRef = useRef(null); // grab/clinch arm overlay (static)
  const deepGripGlowDomRef = useRef(null); // Deep Grip tip glow (arm motion twin)
  const animContainerDomRef = useRef(null); // AnimatedFighterContainer
  const shadowDomRef = useRef(null); // PlayerShadow root div
  const reflectionDomRef = useRef(null); // IceReflection root div
  // Round-result loser: hide ice reflection / show oval even if x is still
  // mid-slide between MAP (win line) and DOHYO (fall edge).
  const isRoundLoserRef = useRef(false);
  const youLabelDomRef = useRef(null); // pre-game "You" label
  const gripPromptDomRef = useRef(null); // in-clinch "CLAMPED!" prompt
  const starStunDomRef = useRef(null); // Open / parry stun stars (head orbit)
  // Mirror of the latest rendered penguin state for the rAF loop (flags used
  // in position formulas: at-the-ropes nudge, shadow ground-pinning).
  const penguinRef = useRef(penguin);
  // Last value of isOutsideDohyo(x, y) committed by a React render. The rAF
  // loop watches for position-driven flips (ring-out slides) and forces a
  // re-render so all zIndex formulas update consistently.
  const lastRenderedOutsideRef = useRef(false);
  // Kill-throw early landing pose: latch that the victim has gone high enough
  // that a near-ground Y means "falling into impact" (not the pre-rise start).
  const killThrowAirbornePeakRef = useRef(false);
  const killThrowShowLandingRef = useRef(false);
  // Bumped by the rAF loop when a time-based visual (hit flash / hit tint /
  // idle sprite hold / dohyo-side flip) needs a re-render to update.
  const [, setVisualTick] = useState(0);
  // Equipped head gear: body+hat baked to one URL so ice-slide / breathe CSS
  // can't desync a second layer.
  const [hattedBodySrc, setHattedBodySrc] = useState(null);
  // Tracks which recolored+overlay pair hattedBodySrc belongs to (stale guard).
  const [hattedPairKey, setHattedPairKey] = useState(null);
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
    // Rooted open-palm thrust (back + mouse1). Predicted separately from a slap
    // so its animation and its "no movement" rooting show on the press frame,
    // and so it reconciles against the server's isPalmThrust — NOT isSlapAttack
    // (the server never sets isSlapAttack for a thrust, so a slap prediction here
    // would never get confirmed/cleared and would latch movement off).
    isPalmThrust: false,
    // Rooted low kick / trip (S + mouse1). Same prediction model as palm thrust.
    isLowKick: false,
    isDodging: false,
    dodgeDirection: null,
    isChargingAttack: false,
    isRawParrying: false,
    isMatadorParrying: false,
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

  // PREDICTED ACTION AUDIO: swing/whoosh sounds are SCHEDULED on the press
  // frame to land at the attack's ACTIVE window (press + startup), instead of
  // firing instantly. The whoosh is the limb cutting air — playing it at the
  // press made every windup sound premature (worst on charged: 150ms early)
  // and made interrupted attacks (slap eaten by a grab mid-startup) whoosh
  // with no visible swing. Scheduled sounds are cancellable: if the attack
  // dies during startup, the timer is cleared and the sound never plays.
  //
  // Each stamp records the SCHEDULED play moment and gates the corresponding
  // server-driven sound effect below so the confirmation broadcast doesn't
  // double-play the sample. Window budget: it must suppress a confirm arriving
  // up to a worst tolerable RTT after the scheduled moment, but must NOT
  // suppress the next legitimate same-sound repeat — the tightest being a
  // server-buffered follow-up slap, whose rising edge lands ~SLAP_TOTAL_MS
  // (260) − SLAP_STARTUP (55) = ~205ms after the previous stamp. 200 < 205.
  const PREDICTED_SOUND_SUPPRESS_MS = 200;
  const predictedSwingSoundAtRef = useRef({ attack: 0, slap: 0, dodge: 0 });

  // Client mirror of the server's attack startup durations (server-io/
  // constants.js: SLAP_STARTUP_MS etc.) — how long after execution start the
  // hitbox (and the visible swing) actually comes out.
  const SWING_STARTUP_MS = { slap: 55, palm: 90, lowKick: 95, charged: 150 };

  // Pending scheduled swing sounds (timer ids). Cancelled wholesale when this
  // fighter's attack is interrupted during startup (hit / grabbed / thrown /
  // parry-stunned) — see the cancellation effect below.
  const pendingSwingSoundsRef = useRef(new Set());
  const scheduleSwingSound = useCallback((delayMs, playFn) => {
    if (delayMs <= 0) {
      playFn();
      return;
    }
    const id = setTimeout(() => {
      pendingSwingSoundsRef.current.delete(id);
      playFn();
    }, delayMs);
    pendingSwingSoundsRef.current.add(id);
  }, []);
  const cancelPendingSwingSounds = useCallback(() => {
    for (const id of pendingSwingSoundsRef.current) clearTimeout(id);
    pendingSwingSoundsRef.current.clear();
  }, []);

  // Swing-sound interruption: if this fighter's attack dies during startup
  // (grabbed, hit, thrown, or parry-stunned before the swing came out), kill
  // any scheduled whoosh. This is the fix for "slap eaten by a grab still
  // whooshes" — the interrupt broadcast beats the 55ms slap timer on the
  // local server, so the sound simply never happens.
  useEffect(() => {
    if (
      penguin.isHit ||
      penguin.isBeingGrabbed ||
      penguin.isBeingThrown ||
      penguin.isRawParryStun
    ) {
      cancelPendingSwingSounds();
    }
  }, [
    penguin.isHit,
    penguin.isBeingGrabbed,
    penguin.isBeingThrown,
    penguin.isRawParryStun,
    cancelPendingSwingSounds,
  ]);
  // Unmount: never let a scheduled swing outlive the fighter.
  useEffect(() => () => cancelPendingSwingSounds(), [cancelPendingSwingSounds]);

  // SERVER ACTION LOCKS (prediction gates): the server serializes actions
  // with sim-clock deadlines (actionLockUntil = blocks everything;
  // attackCooldownUntil = blocks strikes only). They arrive as remaining-ms
  // countdowns in the state broadcast (see server-io/index.js) and are
  // converted to local performance.now() deadlines on packet arrival.
  // Predictions must respect them — otherwise a press the server is
  // guaranteed to reject still flashes a pose and plays a whiff sound.
  const serverActionLockUntilRef = useRef(0);
  const serverAttackCooldownUntilRef = useRef(0);

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

  // Client-side mirror of server parry commitment — suppress OFFENSIVE
  // predictions the server will reject. Server AP:
  //   • Neutral: live window while held; release → whiff jail (AP_WHIFF_RECOVERY_MS)
  //   • Post-parry flurry: re-tap may extend window; release soft-clears
  //     (no linger). predictedFlurryUntilRef only lengthens the NEXT re-arm.
  const AP_ACTIVE_MS_CLIENT = 180;
  const AP_CANCEL_RECOVERY_MS_CLIENT = AP_WHIFF_RECOVERY_MS;
  // Match server grantAttackParryFlurryCover (regular slap ≈ 345; perfect ≈ 565)
  const AP_FLURRY_COVER_REGULAR_MS_CLIENT = 345;
  const AP_FLURRY_COVER_PERFECT_MS_CLIENT = 565;
  const predictedParryCommitUntilRef = useRef(0);
  const predictedFlurryUntilRef = useRef(0);
  // Local Space-up whiff pose — snaps to success-f1 before server isApWhiffRecovering.
  // Gated: live read only (not guard), not during flurry soft-clear.
  const apWhiffPredictRef = useRef({ until: 0, sawServerWhiff: false });
  const isLocalParryActive = useCallback(() => {
    if (!isLocalPlayer) return false;
    // Post-parry lock (survives flurry re-tap that clears success pose).
    if (
      penguin.isApPostParryLocked ||
      penguin.isRawParrySuccess ||
      penguin.isPerfectRawParrySuccess ||
      penguin.isApWhiffRecovering ||
      penguin.isMatadorParrying ||
      penguin.isMatadorSuccess ||
      penguin.isMatadorWhiffRecovering
    ) {
      return true;
    }
    // Server-confirmed stance. Do NOT treat bare Space as active — only
    // isRawParrying / isGuarding (treating Space alone caused "can't attack"
    // while walking after a stance drop).
    if (penguin.isRawParrying || penguin.isGuarding) return true;
    const nowT = performance.now();
    if (nowT < apWhiffPredictRef.current.until) return true;
    return nowT < predictedParryCommitUntilRef.current;
  }, [
    isLocalPlayer,
    penguin.isApPostParryLocked,
    penguin.isRawParrySuccess,
    penguin.isPerfectRawParrySuccess,
    penguin.isApWhiffRecovering,
    penguin.isMatadorParrying,
    penguin.isMatadorSuccess,
    penguin.isMatadorWhiffRecovering,
    penguin.isRawParrying,
    penguin.isGuarding,
  ]);

  // ============================================
  // HELPER: Check if player can perform ANY action
  // This must match the server's canPlayerUseAction logic exactly
  // to prevent showing predictions for actions the server will reject
  // ============================================
  const canPredictAction = useCallback(
    (gameStarted) => {
      // CRITICAL: No actions allowed before game starts (hakkiyoi)
      if (!gameStarted) return false;

      // Server-side global action lock (actionLockUntil, not otherwise on the
      // wire) — the server WILL reject this press, so don't flash/sound it.
      if (performance.now() < serverActionLockUntilRef.current) return false;

      // A fresh, unconfirmed prediction is already "the current action" —
      // don't stack another prediction (and its swing sound) on top while
      // waiting for the server to confirm. Without this, mashing inside the
      // round-trip window predicts (and whooshes) once per press while the
      // server only executes one.
      const pred = predictedState.current;
      if (
        performance.now() - pred.timestamp < PREDICTION_TIMEOUT_MS &&
        (pred.isAttacking ||
          pred.isDodging ||
          pred.isGrabbing ||
          pred.isChargingAttack)
      ) {
        return false;
      }

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
        // Clinch: SPACE in a clinch is a GRAB BREAK, not an AP — never predict a
        // parry (or any action) here, or the predicted parry pose flickers
        // against the real clinch/grab-break state ("shaking").
        !penguin.inClinch &&
        !penguin.hasGrip &&
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

      // Server-side global action lock — see canPredictAction. The strike
      // cooldown (attackCooldownUntil) deliberately NOT checked here: dodging
      // during slap cooldown is legal server-side.
      if (performance.now() < serverActionLockUntilRef.current) return false;

      // Fresh unconfirmed prediction gate — isChargingAttack deliberately
      // excluded: dash is allowed to cancel a charge.
      const pred = predictedState.current;
      if (
        performance.now() - pred.timestamp < PREDICTION_TIMEOUT_MS &&
        (pred.isAttacking || pred.isDodging || pred.isGrabbing)
      ) {
        return false;
      }

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
          // not parrying (held, committed, or server-confirmed) — see isLocalParryActive.
          // Also respects the server's strike cooldown (attackCooldownUntil) so a
          // press the server will reject/buffer doesn't whoosh early.
          if (
            canPredictAction(gameStarted) &&
            performance.now() >= serverAttackCooldownUntilRef.current &&
            !penguin.isChargingAttack &&
            !isLocalParryActive()
          ) {
            predictedState.current = {
              ...predictedState.current,
              isSlapAttack: true,
              isAttacking: true,
              isPalmThrust: false,
              isLowKick: false,
              slapAnimation: predictedState.current.slapAnimation === 1 ? 2 : 1,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isChargingAttack: false,
              isDodging: false,
              isRawParrying: false,
              isMatadorParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
            // Predicted swing audio — scheduled to land at the ACTIVE window
            // (press + startup), when the hand actually cuts air. Cancellable:
            // an interrupt during startup clears it (no phantom whoosh).
            {
              const panX = penguin.x;
              scheduleSwingSound(SWING_STARTUP_MS.slap, () =>
                playSound(
                  pickRandomSound(slapWhiffSounds),
                  0.02,
                  null,
                  1.0,
                  xToPan(panX)
                )
              );
            }
            predictedSwingSoundAtRef.current.slap =
              now + SWING_STARTUP_MS.slap;
          }
          break;
        case "palm_thrust":
          // Rooted open-palm thrust (back + mouse1). Same gating as a slap, but
          // it sets isPalmThrust (not isSlapAttack) so it reconciles against the
          // server's thrust state, renders the thrust pose immediately, and roots
          // movement (isAttacking suspends the movement predictor) on the press
          // frame. Predicting a slap here was the "stuck after palm thrust" bug:
          // the server never confirms isSlapAttack for a thrust, so the predicted
          // isAttacking/isSlapAttack never cleared and kept strafing locked.
          if (
            canPredictAction(gameStarted) &&
            performance.now() >= serverAttackCooldownUntilRef.current &&
            !penguin.isChargingAttack &&
            !isLocalParryActive()
          ) {
            predictedState.current = {
              ...predictedState.current,
              isPalmThrust: true,
              isLowKick: false,
              isAttacking: true,
              isSlapAttack: false,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isChargingAttack: false,
              isDodging: false,
              isRawParrying: false,
              isMatadorParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
            // Predicted swing audio — scheduled at the active window (90ms
            // startup); cancellable if the thrust dies in windup.
            {
              const panX = penguin.x;
              scheduleSwingSound(SWING_STARTUP_MS.palm, () =>
                playSound(palmThrustWhiffSound, 0.05, null, 1.0, xToPan(panX))
              );
            }
            predictedSwingSoundAtRef.current.attack =
              now + SWING_STARTUP_MS.palm;
          }
          break;
        case "low_kick":
          // Rooted trip (S + mouse1). Same prediction model as palm thrust.
          if (
            canPredictAction(gameStarted) &&
            performance.now() >= serverAttackCooldownUntilRef.current &&
            !penguin.isChargingAttack &&
            !isLocalParryActive()
          ) {
            predictedState.current = {
              ...predictedState.current,
              isLowKick: true,
              isPalmThrust: false,
              isAttacking: true,
              isSlapAttack: false,
              isChargingAttack: false,
              isDodging: false,
              isRawParrying: false,
              isMatadorParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
            // Predicted swing audio — scheduled at the active window (95ms
            // startup); cancellable if the kick dies in windup.
            scheduleSwingSound(SWING_STARTUP_MS.lowKick, () =>
              playSound(attackSound, 0.05)
            );
            predictedSwingSoundAtRef.current.attack =
              now + SWING_STARTUP_MS.lowKick;
          }
          break;
        case "charge_start":
          if (canPredictAction(gameStarted) && !isLocalParryActive()) {
            predictedState.current = {
              ...predictedState.current,
              isChargingAttack: true,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isSlapAttack: false,
              isPalmThrust: false,
              isLowKick: false,
              isAttacking: false,
              isDodging: false,
              isRawParrying: false,
              isMatadorParrying: false,
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
              isPalmThrust: false,
              isLowKick: false,
              // Don't clear dodge state - let dodge continue visually
              isDodging: predictedState.current.isDodging,
              isRawParrying: false,
              isMatadorParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
            // Predicted swing audio for the released charged attack —
            // scheduled at the LUNGE (release + 150ms startup), not the
            // release itself. Playing it at release was the clearest
            // "premature sound" case: a full windup telegraph passed between
            // the whoosh and the visible swing. Skipped while dodging — the
            // server holds the attack as pending until the dodge ends.
            if (!isDodging) {
              scheduleSwingSound(SWING_STARTUP_MS.charged, () =>
                playSound(attackSound, 0.05)
              );
              predictedSwingSoundAtRef.current.attack =
                now + SWING_STARTUP_MS.charged;
            }
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
              isPalmThrust: false,
              isLowKick: false,
              isRawParrying: false,
              isMatadorParrying: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
            // Predicted dash audio + launch dust — same frame as the press.
            // The server-edge effect below is gated so it won't re-fire these
            // when the confirmation broadcast arrives.
            playSound(dodgeSound, 0.02);
            emitParticles("dashStart", {
              x: penguin.x,
              y: penguin.y,
              direction: action.direction || penguin.facing || 1,
              facing: penguin.facing ?? 1,
            });
            predictedSwingSoundAtRef.current.dodge = now;
          }
          break;
        case "parry_start":
          // Suppress offense for the live window (+RTT). Flurry cover may extend
          // the server window on re-arm — keep commit at least until flurry ends
          // while Space is committing a read.
          if (gameStarted) {
            predictedParryCommitUntilRef.current = Math.max(
              now + AP_ACTIVE_MS_CLIENT,
              predictedFlurryUntilRef.current
            );
          }
          if (canPredictAction(gameStarted) && !penguin.isChargingAttack) {
            predictedState.current = {
              ...predictedState.current,
              isRawParrying: true,
              isMatadorParrying: false,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isChargingAttack: false,
              isAttacking: false,
              isSlapAttack: false,
              isPalmThrust: false,
              isLowKick: false,
              isDodging: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "matador_start":
          if (gameStarted) {
            predictedParryCommitUntilRef.current = Math.max(
              now + AP_ACTIVE_MS_CLIENT,
              predictedFlurryUntilRef.current
            );
          }
          if (canPredictAction(gameStarted) && !penguin.isChargingAttack) {
            predictedState.current = {
              ...predictedState.current,
              isMatadorParrying: true,
              isRawParrying: false,
              isChargingAttack: false,
              isAttacking: false,
              isSlapAttack: false,
              isPalmThrust: false,
              isLowKick: false,
              isDodging: false,
              isGrabbing: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        case "matador_release": {
          if (gameStarted) {
            predictedParryCommitUntilRef.current =
              now + AP_CANCEL_RECOVERY_MS_CLIENT;
          }
          const inLiveMatador =
            isLocalPlayer &&
            (penguin.isMatadorParrying ||
              predictedState.current.isMatadorParrying);
          if (gameStarted && inLiveMatador) {
            apWhiffPredictRef.current.until = now + AP_WHIFF_RECOVERY_MS;
            apWhiffPredictRef.current.sawServerWhiff = false;
            forceVisualRender();
          }
          if (
            penguin.isMatadorParrying ||
            predictedState.current.isMatadorParrying
          ) {
            predictedState.current = {
              ...predictedState.current,
              isMatadorParrying: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        }
        case "parry_release": {
          // Offense suppress for whiff jail length. Do NOT hold commit until
          // flurry end or you can walk unable to attack for hundreds of ms.
          if (gameStarted) {
            predictedParryCommitUntilRef.current =
              now + AP_CANCEL_RECOVERY_MS_CLIENT;
          }
          // Snap whiff pose (success-f1) on Space-up from a LIVE read — not
          // from hold-guard, not during post-land flurry soft-clear.
          const inLiveRead =
            isLocalPlayer &&
            !penguin.isGuarding &&
            !penguin.isRawParrySuccess &&
            !penguin.isPerfectRawParrySuccess &&
            (penguin.isRawParrying || predictedState.current.isRawParrying);
          const inFlurryCover = now < predictedFlurryUntilRef.current;
          if (gameStarted && inLiveRead && !inFlurryCover) {
            apWhiffPredictRef.current.until = now + AP_WHIFF_RECOVERY_MS;
            apWhiffPredictRef.current.sawServerWhiff = false;
            forceVisualRender();
          }
          if (penguin.isRawParrying || predictedState.current.isRawParrying) {
            predictedState.current = {
              ...predictedState.current,
              isRawParrying: false,
              isMatadorParrying: false,
              timestamp: now,
            };
            predictionChanged = true;
          }
          break;
        }
        case "grab":
          if (canPredictAction(gameStarted) && !penguin.isChargingAttack && !isLocalParryActive()) {
            predictedState.current = {
              ...predictedState.current,
              isGrabbing: true,
              // CRITICAL: Clear other action predictions to prevent visual flicker
              isChargingAttack: false,
              isAttacking: false,
              isSlapAttack: false,
              isPalmThrust: false,
              isLowKick: false,
              isDodging: false,
              isRawParrying: false,
              isMatadorParrying: false,
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
            isPalmThrust: false,
            isLowKick: false,
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
      forceVisualRender,
      emitParticles,
      scheduleSwingSound,
      penguin.x,
      penguin.y,
      penguin.isChargingAttack,
      penguin.isRawParrying,
      penguin.isGuarding,
      penguin.isRawParrySuccess,
      penguin.isPerfectRawParrySuccess,
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
        predictedState.current.isPalmThrust ||
        predictedState.current.isLowKick ||
        predictedState.current.isAttacking
      ) {
        predictedState.current.isSlapAttack = false;
        predictedState.current.isPalmThrust = false;
        predictedState.current.isLowKick = false;
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
        // CRITICAL: drop any stale predicted ACTION flags before handing back to
        // the server state. Past the prediction window the server is authoritative
        // anyway, but the movement predictor reads predictedState.current DIRECTLY
        // (see `locallyActing`), so a prediction the server resolved into a
        // DIFFERENT action — e.g. back+mouse1 mispredicted as a slap that the
        // server ran as a palm thrust (never sets isSlapAttack) — would otherwise
        // leave isAttacking/isSlapAttack latched true forever and permanently
        // suspend movement prediction. That is the "can't strafe after a palm
        // thrust until I press something else" lock.
        predictedState.current.isSlapAttack = false;
        predictedState.current.isPalmThrust = false;
        predictedState.current.isLowKick = false;
        predictedState.current.isAttacking = false;
        predictedState.current.isDodging = false;
        predictedState.current.isChargingAttack = false;
        predictedState.current.isRawParrying = false;
        predictedState.current.isGrabbing = false;
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
        isPalmThrust: false,
        isLowKick: false,
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

    // Palm thrust reconciliation (mirrors the slap branch, keyed on isPalmThrust).
    // Once the server CONFIRMS the thrust (isPalmThrust) or has clearly moved on
    // (no thrust and no longer attacking), hand the pose + rooting back to the
    // authoritative state so nothing stays latched locally.
    if (
      prediction.isPalmThrust &&
      !penguin.isPalmThrust &&
      !penguin.isAttacking
    ) {
      predictedState.current.isPalmThrust = false;
      predictedState.current.isAttacking = false;
    } else if (prediction.isPalmThrust && penguin.isPalmThrust) {
      predictedState.current.isPalmThrust = false;
      predictedState.current.isAttacking = false;
    }

    // Low kick reconciliation (same model as palm thrust).
    if (
      prediction.isLowKick &&
      !penguin.isLowKick &&
      !penguin.isAttacking
    ) {
      predictedState.current.isLowKick = false;
      predictedState.current.isAttacking = false;
    } else if (prediction.isLowKick && penguin.isLowKick) {
      predictedState.current.isLowKick = false;
      predictedState.current.isAttacking = false;
    }

    // Charged attack: If we predicted attacking (non-slap) but server says not attacking
    // AND not charging, the server has moved past the attack - clear stale prediction.
    // Use predictionAge > 100ms to give the server time to confirm the attack initially.
    if (
      prediction.isAttacking &&
      !prediction.isSlapAttack &&
      !prediction.isLowKick &&
      !penguin.isAttacking &&
      !penguin.isChargingAttack &&
      predictionAge > 100
    ) {
      predictedState.current.isAttacking = false;
      predictedState.current.isPalmThrust = false;
      predictedState.current.isLowKick = false;
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
    if (prediction.isMatadorParrying && !penguin.isMatadorParrying) {
      predictedState.current.isMatadorParrying = false;
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
      !p.isPalmThrust &&
      !p.isLowKick &&
      !p.isAttacking &&
      !p.isDodging &&
      !p.isChargingAttack &&
      !p.isRawParrying &&
      !p.isMatadorParrying &&
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
      isPalmThrust: p.isPalmThrust || penguin.isPalmThrust,
      isLowKick: p.isLowKick || penguin.isLowKick,
      isAttacking: p.isAttacking || penguin.isAttacking,
      isDodging: p.isDodging || penguin.isDodging,
      dodgeDirection: p.isDodging ? p.dodgeDirection : penguin.dodgeDirection,
      isChargingAttack: p.isChargingAttack || penguin.isChargingAttack,
      isRawParrying: p.isRawParrying || penguin.isRawParrying,
      isMatadorParrying: p.isMatadorParrying || penguin.isMatadorParrying,
      // Guard floor is server-authored (window expired while holding). Don't
      // OR-predict it — the live parry window must keep the parry stance.
      isGuarding: !!penguin.isGuarding,
      isGrabbing: p.isGrabbing || penguin.isGrabbing,
      // ICE PHYSICS: Movement predictions
      isPowerSliding: p.isPowerSliding || penguin.isPowerSliding,
      isBraking: p.isBraking || penguin.isBraking,
    };

    if (isInFlapMechanic(penguin)) {
      merged.isSlapAttack = false;
      merged.isPalmThrust = false;
      merged.isLowKick = false;
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
      merged.isPalmThrust = penguin.isPalmThrust;
      merged.isLowKick = penguin.isLowKick;
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

  // Deep Grip tip glow mounts mid-clinch — copy live arm motion CSS vars
  // before paint so it doesn't flash at belt-rest for a frame.
  useLayoutEffect(() => {
    if (!penguin.hasDeepGrip || !penguin.inClinch) return;
    const glow = deepGripGlowDomRef.current;
    const arm = grabArmImgDomRef.current;
    if (!glow || !arm) return;
    glow.style.left = arm.style.left;
    glow.style.bottom = arm.style.bottom;
    for (const prop of [
      "--grab-arm-body-hold-deg",
      "--grab-arm-body-hold-y",
      "--grab-arm-body-hold-len",
      "--grab-arm-nudge-x",
      "--grab-arm-nudge-y",
    ]) {
      const v = arm.style.getPropertyValue(prop);
      if (v) glow.style.setProperty(prop, v);
    }
  }, [
    penguin.hasDeepGrip,
    penguin.inClinch,
    penguin.isClinchBeltHolding,
    penguin.isClinchPlanting,
    penguin.isGrabbing,
  ]);

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
  const [blockingEffectPosition, setBlockingEffectPosition] = useState(null);
  // Guard SUCCESS pose — mirrors isRawParrySuccess. True only for the absorb
  // window after a chip lands; held-guard "attempting" uses blocking.png.
  const [guardBlockSuccess, setGuardBlockSuccess] = useState(false);
  const guardBlockSuccessTimeoutRef = useRef(null);
  const [chargeClashEffectPosition, setChargeClashEffectPosition] = useState(null);
  const [hitEffectPosition, setHitEffectPosition] = useState(null);
  const [rawParryEffectPosition, setRawParryEffectPosition] = useState(null);
  const [p1ParryRefund, setP1ParryRefund] = useState(0);
  const [p2ParryRefund, setP2ParryRefund] = useState(0);
  const [p1BalanceGain, setP1BalanceGain] = useState(0);
  const [p2BalanceGain, setP2BalanceGain] = useState(0);
  // Tip-slap posture drain flinch on the victim's gauge (spacing tell).
  const [p1TipDrain, setP1TipDrain] = useState(0);
  const [p2TipDrain, setP2TipDrain] = useState(0);
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

  // Thick Blubber absorb VFX is now the pink "wrap ring" (grab_armor_absorb
  // handler / grabArmorAbsorb particle) — no per-fighter effect state and no
  // body tint needed.
  const [disconnectCountdown, setDisconnectCountdown] = useState(3);
  const [uiRoundId, setUiRoundId] = useState(0);

  // New enhanced effects state
  const [grabBreakEffectPosition, setGrabBreakEffectPosition] = useState(null);
  const [grabTechEffectPosition, setGrabTechEffectPosition] = useState(null);
  const [counterGrabEffectPosition, setCounterGrabEffectPosition] =
    useState(null);
  const [punishBannerPosition, setPunishBannerPosition] = useState(null);
  const [goredBannerPosition, setGoredBannerPosition] = useState(null);
  const [matadorSuccessStampPosition, setMatadorSuccessStampPosition] =
    useState(null);
  const [snowballImpactPosition, setSnowballImpactPosition] = useState(null);
  const [counterHitEffectPosition, setCounterHitEffectPosition] =
    useState(null);
  const [clinchJoltEffectPosition, setClinchJoltEffectPosition] = useState(null);
  // Clinch mind-game callouts: COUNTER THROW / RESISTED / DEEP GRIP side banners
  const [clinchCalloutData, setClinchCalloutData] = useState(null);
  // Perfect Brace — hype stamp (same register as PERFECT parry)
  const [perfectBraceStampPosition, setPerfectBraceStampPosition] =
    useState(null);

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

        // RAW PARRY SUCCESS: movement is frozen, but block → f1 → f2 must still
        // advance (and the local visual hold must keep ticking) so the
        // DEFLECT is readable every time — including through flurry clears.
        const vSuccess = rawParrySuccessVisualRef.current;
        if (vSuccess.until > timestamp) {
          // Hitstop packet can arrive AFTER we stamped `until`; extend to match.
          const hs = getDisplayHitstopUntil();
          if (hs > timestamp) {
            vSuccess.until = Math.max(
              vSuccess.until,
              hs + RAW_PARRY_SUCCESS_ANIM.POST_HITSTOP_HOLD_MS
            );
          }
          const wallElapsed = timestamp - vSuccess.startedAt;
          const frame = resolveRawParrySuccessFrame(vSuccess, wallElapsed);
          if (frame !== rawParrySuccessFrameRef.current) {
            rawParrySuccessFrameRef.current = frame;
            forceVisualRender();
          }
        }

        // VICTIM JUDDER: if this fighter just got hit, vibrate the pinned
        // sprite around its frozen position for the duration of the freeze
        // (alternating ±amp px per frame, easing off as the freeze ends).
        // The normal write path below rewrites `left` on the first post-freeze
        // frame, so this needs no cleanup.
        const judder = hitJudderRef.current;
        const basePos = interpolatedPositionRef.current;
        if (judder.armedUntil > timestamp && basePos) {
          judder.frame++;
          const settle = Math.max(
            0.35,
            Math.min(1, (hitstopUntil - timestamp) / 90)
          );
          const jx = (judder.frame % 2 === 0 ? 1 : -1) * judder.amp * settle;
          const jitterLeft = `${((basePos.x + jx) / 1280) * 100}%`;
          if (fighterImgDomRef.current) {
            fighterImgDomRef.current.style.left = jitterLeft;
          }
          if (animContainerDomRef.current) {
            animContainerDomRef.current.style.left = jitterLeft;
          }
        }

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
            pendingAction.isPalmThrust ||
            pendingAction.isLowKick ||
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
        // Dev-only pushbox/contact overlay — player1 instance owns the draw.
        if (
          isCombatFidelityDebugEnabled() &&
          penguinRef.current?.fighter === "player 1"
        ) {
          const shared = getSharedFighterState();
          {
            const p1 = shared?.player1;
            const p2 = shared?.player2;
            const landingFields = (p, x, y) =>
              p
                ? {
                    x,
                    y,
                    sizeMult: p.sizeMultiplier || 1,
                    sizeMultiplier: p.sizeMultiplier || 1,
                    ropeJumpPhase: p.ropeJumpPhase,
                    ropeJumpRawTargetX: p.ropeJumpRawTargetX,
                    ropeJumpResolvedTargetX: p.ropeJumpResolvedTargetX,
                    ropeJumpLandingCommitted: p.ropeJumpLandingCommitted,
                    ropeJumpLandingCommitX: p.ropeJumpLandingCommitX,
                    ropeJumpLandingCommitT: p.ropeJumpLandingCommitT,
                    ropeJumpLandingPath: p.ropeJumpLandingPath,
                    ropeJumpPreferredSide: p.ropeJumpPreferredSide,
                    ropeJumpResolvedSide: p.ropeJumpResolvedSide,
                    ropeJumpMinDistance: p.ropeJumpMinDistance,
                    ropeJumpCenterDistance: p.ropeJumpCenterDistance,
                    ropeJumpOverlap: p.ropeJumpOverlap,
                    ropeJumpSafetyCorrectionPx: p.ropeJumpSafetyCorrectionPx,
                    ropeJumpPreTouchdownX: p.ropeJumpPreTouchdownX,
                    ropeJumpTouchdownX: p.ropeJumpTouchdownX,
                    ropeJumpUsedFallback: p.ropeJumpUsedFallback,
                  }
                : null;
            renderCombatFidelityOverlay({
              // P1 uses this instance's interpolated pose; P2 uses shared server snapshot.
              p1: landingFields(
                p1 || penguinRef.current,
                newPos.x,
                newPos.y
              ) || {
                x: newPos.x,
                y: newPos.y,
                sizeMult: penguinRef.current?.sizeMultiplier || 1,
              },
              p2: landingFields(p2, p2?.x ?? 0, p2?.y ?? 0) || {
                x: 0,
                y: 0,
                sizeMult: 1,
              },
            });
          }
        }
        // Grab-arm overlay shares the body's exact position formula so it stays
        // pixel-locked to the (armless) grab/clinch body as it slides.
        // Deep Grip tip glow is a motion twin — same left/bottom + CSS vars.
        const grabArmEl = grabArmImgDomRef.current;
        const deepGripGlowEl = deepGripGlowDomRef.current;
        if (grabArmEl || deepGripGlowEl) {
          // Belt vs body-hold arm pose. Local M2 is read live so the flipper
          // drops to the belt on press without waiting on the 32Hz flag.
          // Holding M2 through grab connect stays on the belt (cosmetic only).
          // Body holds are ASYMMETRIC (over / under) so the two long flippers
          // nest at different heights instead of crossing through each other.
          //   Grabber  → overhook (higher chest)
          //   Grabbed  → underhook (mid torso, still clearly off the belt)
          const localKeys = isLocalPlayer ? getLocalKeyState() : null;
          const localM2Down = !!localKeys?.mouse2;
          const localM2 =
            isLocalPlayer &&
            p.inClinch &&
            !p.isArmClamped &&
            localM2Down;
          const onBelt =
            !!p.isClinchBeltHolding ||
            localM2 ||
            !!p.isAttemptingGrabThrow ||
            !!p.isAttemptingPull;
          const bodyHolding = p.inClinch && !onBelt;
          // +deg = tip swings UP from the belt-rest asset. Mild over/under
          // split — server also spaces body holds farther apart so we don't
          // need a tiny underhook or a severe length chop (those made the
          // snap to full belt-arm look broken).
          const BODY_HOLD_OVER_DEG = 20;
          const BODY_HOLD_UNDER_DEG = 17;
          const BODY_HOLD_LEN = 0.88;
          const isOverhook = !!p.isGrabbing;
          let bodyHoldDeg = 0;
          let bodyHoldY = "0%";
          let bodyHoldLen = 1;
          if (bodyHolding) {
            bodyHoldDeg = isOverhook
              ? BODY_HOLD_OVER_DEG
              : BODY_HOLD_UNDER_DEG;
            bodyHoldY = isOverhook ? "-0.5%" : "1.5%";
            bodyHoldLen = BODY_HOLD_LEN;
          }
          // Plant / body-hold: pull flipper BACK off the white belly. Belt (M2)
          // stays pre-aligned (0). Written here so M2 press/release is instant.
          let nudgeX = 0;
          let nudgeY = 0;
          if (p.isClinchPlanting) {
            nudgeX = 7.5;
            nudgeY = 2;
          } else if (bodyHolding) {
            nudgeX = 4.5;
            nudgeY = 0.75;
          }
          const applyGrabArmMotion = (el) => {
            if (!el) return;
            el.style.left = leftPct;
            el.style.bottom = bottomPct;
            el.style.setProperty(
              "--grab-arm-body-hold-deg",
              `${bodyHoldDeg}deg`
            );
            el.style.setProperty("--grab-arm-body-hold-y", bodyHoldY);
            el.style.setProperty(
              "--grab-arm-body-hold-len",
              String(bodyHoldLen)
            );
            el.style.setProperty("--grab-arm-nudge-x", `${nudgeX}%`);
            el.style.setProperty("--grab-arm-nudge-y", `${nudgeY}%`);
          };
          applyGrabArmMotion(grabArmEl);
          applyGrabArmMotion(deepGripGlowEl);
        }
        const animEl = animContainerDomRef.current;
        if (animEl) {
          animEl.style.left = leftPct;
          animEl.style.bottom = bottomPct;
        }

        // PROCEDURAL ANIMATION — knockback afterimages. Heavy launches
        // (charged, palm burst, belly-slam — kb |x| ≥ 1.8; slap drift never
        // qualifies) leave brief ghost echoes of the sprite along the flight
        // path: the motion smear the art has no frames for. DOM clones (not
        // canvas) so each ghost keeps the exact recolored, mid-squash pose —
        // computed transforms are copied per node BEFORE killing animations,
        // freezing the deformation instead of snapping to frame 0. Throttled
        // at 55ms with a 240ms lifetime ⇒ ≤ ~5 live ghosts worst case.
        const kbSpeed = Math.abs(
          currentState.current?.knockbackVelocity?.x || 0
        );
        if (
          (p.isHit || p.isBurstKnockback) &&
          kbSpeed >= 1.8 &&
          !p.isBeingThrown &&
          !p.inClinch &&
          !p.isBeingGrabbed &&
          timestamp - lastGhostAtRef.current >= 55
        ) {
          lastGhostAtRef.current = timestamp;
          const srcEl = animContainerDomRef.current || fighterImgDomRef.current;
          if (srcEl && srcEl.parentElement) {
            const ghost = srcEl.cloneNode(true);
            const srcNodes = [srcEl, ...srcEl.querySelectorAll("*")];
            const ghostNodes = [ghost, ...ghost.querySelectorAll("*")];
            for (let i = 0; i < srcNodes.length; i++) {
              const computed = getComputedStyle(srcNodes[i]);
              if (computed.transform !== "none") {
                ghostNodes[i].style.transform = computed.transform;
              }
              ghostNodes[i].style.animation = "none";
            }
            ghost.style.opacity = "0.28";
            ghost.style.zIndex = "96";
            ghost.style.transition = "opacity 0.19s ease-out";
            ghost.style.pointerEvents = "none";
            // Plain DOM sibling — React never learns about it, so it can't
            // disturb reconciliation; removed on a timer.
            srcEl.parentElement.appendChild(ghost);
            requestAnimationFrame(() => {
              ghost.style.opacity = "0";
            });
            setTimeout(() => ghost.remove(), 240);
          }
        }
        const shadowEl = shadowDomRef.current;
        const reflectionEl = reflectionDomRef.current;
        if (shadowEl || reflectionEl) {
          const shadowFlags = {
            isDodging: p.isDodging,
            isSidestepping: p.isSidestepping,
            isGrabStartup: p.isGrabStartup,
            isThrowing: p.isThrowing,
            isBeingThrown: p.isBeingThrown,
            isRingOutThrowCutscene: p.isRingOutThrowCutscene,
            isRopeJumping: p.isRopeJumping,
            isFlapping: p.isFlapping,
          };
          // Ice reflection is clipped to the blue disc by `.ice-reflection-clip`.
          // Oval only when fallen off the platform or RoundResult loser.
          const roundLoser = isRoundLoserRef.current;
          const shadowY = playerShadowBottomY(newPos.x, newPos.y, shadowFlags);
          const shadowBottom = `${(shadowY / 720) * 100 - 0.2}%`;
          const showOval = playerShadowShouldShow(newPos.x, newPos.y, {
            forceShow: roundLoser,
          });
          const showReflect = iceReflectionShouldShow(newPos.x, newPos.y, {
            forceHide: roundLoser,
          });
          // Reflection pins to the ice (sidestep tracks lane dip) and fades
          // with height so airborne hops don't float a clone under the feet.
          const reflectY = iceReflectionBottomY(newPos.y, {
            isSidestepping: p.isSidestepping,
          });
          const reflectBottom = `${(reflectY / 720) * 100 + ICE_REFLECTION_FOOT_NUDGE_PCT}%`;
          if (shadowEl) {
            shadowEl.style.left = plainLeftPct;
            shadowEl.style.bottom = shadowBottom;
            shadowEl.style.opacity = String(
              playerShadowOpacity(newPos.x, newPos.y, {
                forceShow: roundLoser,
              })
            );
            shadowEl.style.visibility = showOval ? "visible" : "hidden";
            shadowEl.style.display = showOval ? "block" : "none";
          }
          if (reflectionEl) {
            reflectionEl.style.left = plainLeftPct;
            reflectionEl.style.bottom = reflectBottom;
            reflectionEl.style.opacity = String(
              iceReflectionOpacity(newPos.x, newPos.y, {
                isSidestepping: p.isSidestepping,
                forceHide: roundLoser,
              })
            );
            reflectionEl.style.visibility = showReflect ? "visible" : "hidden";
            reflectionEl.style.display = showReflect ? "block" : "none";
          }
        }
        const youEl = youLabelDomRef.current;
        if (youEl) {
          youEl.style.left = plainLeftPct;
          youEl.style.bottom = `${(newPos.y / 720) * 100 + 21}%`;
        }
        // Grip prompt rides the same per-frame position writes as the sprite —
        // React-prop positioning alone only updates on discrete re-renders,
        // which made the text visibly chop along during clinch movement.
        const gripEl = gripPromptDomRef.current;
        if (gripEl) {
          gripEl.style.left = `${(newPos.x / 1280) * 100 + 2}%`;
          gripEl.style.bottom = `${(newPos.y / 720) * 100 + 27}%`;
        }
        // Stun stars: same per-frame writes as the sprite / You label so they
        // don't hitch to React re-renders while the fighter slides.
        const starEl = starStunDomRef.current;
        if (starEl) {
          starEl.style.left = plainLeftPct;
          starEl.style.bottom = `${(newPos.y / 720) * 100 + STAR_STUN_BOTTOM_OFFSET_PCT}%`;
        }

        // Position-driven zIndex flip (falling off the dohyo): needs a real
        // render so every element's zIndex formula updates consistently.
        if (
          isOutsideDohyo(newPos.x, newPos.y) !== lastRenderedOutsideRef.current
        ) {
          forceVisualRender();
        }

        // Kill-throw early landing pose: once the victim has peaked, crossing
        // near-ground swaps hit+spin → flat landing art before impact.
        if (p.isClinchKillThrowVictim) {
          if (newPos.y > SHADOW_GROUND_LEVEL + KILL_THROW_PEAK_ARM_PX) {
            killThrowAirbornePeakRef.current = true;
          }
          const showLanding =
            !p.isBeingThrown ||
            (killThrowAirbornePeakRef.current &&
              newPos.y <= SHADOW_GROUND_LEVEL + KILL_THROW_LANDING_EARLY_PX);
          if (showLanding !== killThrowShowLandingRef.current) {
            killThrowShowLandingRef.current = showLanding;
            forceVisualRender();
          }
        } else if (
          killThrowAirbornePeakRef.current ||
          killThrowShowLandingRef.current
        ) {
          killThrowAirbornePeakRef.current = false;
          killThrowShowLandingRef.current = false;
        }
      }

      // Time-based visual windows (hit flash / hit tint / idle sprite hold /
      // unconfirmed predictions): re-render when a window the last render
      // showed as active has expired, so the "off" state actually commits.
      if (isLocalPlayer) {
        const p = penguinRef.current;
        // S toggles dodge/dive pose for legacy FLAP flight AND slide-jump flight.
        // Without this, local S on a slide-jump never forces a re-render until
        // the next server discrete packet — reads as a stuck/cached pose.
        const inAirSPose =
          (p?.isFlapping && p?.flapPhase === "flight") ||
          (p?.isSlideJumping && p?.slideJumpPhase === "flight");
        if (inAirSPose) {
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
        // Palm-thrust animation is mid-sequence: force frames until it settles
        // on the terminal recovery pose (the ref flag is cleared once frame 3
        // is committed).
        rendered.palmThrustAnim ||
        // Slap string animation is mid-sequence: force frames until it settles
        // on the terminal recovery pose (flag cleared once frame 3 is committed).
        rendered.slapAnim ||
        // Raw parry SUCCESS mid block→f1→f2 — force frame advances.
        rendered.rawParrySuccessAnim ||
        // Local AP whiff predict still holding success-f1 — force clear at until.
        rendered.apWhiffPredict ||
        // Dash is mid-sequence: force frames so the windup→jump→landing pose
        // and arc advance on their own clock even while briefly stationary
        // (startup) or when no server packet arrives.
        rendered.dashAnim ||
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
    flapBeat: false,
    palmThrustAnim: false,
    slapAnim: false,
    dashAnim: false,
  });
  // Debounce flag for rapid multi-hits (e.g. back-to-back slaps). Only the
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
  // Loop currently in exit hold/fade (ref cleared so a new track can start).
  const battleMusicStoppingRef = useRef(null);
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

  const stopBattleMusic = useCallback((immediate = false) => {
    if (!ownsMatchMusic) return;

    // Kill an in-progress exit hold/fade (disconnect / unmount).
    if (immediate && battleMusicStoppingRef.current) {
      const fading = battleMusicStoppingRef.current;
      battleMusicStoppingRef.current = null;
      fading.stop({ fadeOut: 0.3, hold: 0 });
    }

    if (!battleMusicRef.current) return;
    const loop = battleMusicRef.current;
    battleMusicRef.current = null;
    if (immediate) {
      loop.stop({ fadeOut: 0.3, hold: 0 });
      return;
    }
    battleMusicStoppingRef.current = loop;
    loop.stop({ fadeOut: BATTLE_EXIT_FADE, hold: BATTLE_EXIT_HOLD });
  }, [ownsMatchMusic]);

  const startBattleMusic = useCallback(() => {
    if (!ownsMatchMusic || battleMusicRef.current) return;
    // Drop any leftover exit tail so the new round starts clean.
    if (battleMusicStoppingRef.current) {
      const fading = battleMusicStoppingRef.current;
      battleMusicStoppingRef.current = null;
      fading.stop({ fadeOut: 0.35, hold: 0 });
    }
    battleMusicRoundRef.current += 1;
    const trackIndex =
      (battleMusicRoundRef.current - 1) % battleMusicTracks.length;
    const track = battleMusicTracks[trackIndex];
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
    stopBattleMusic(true);

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
      stopBattleMusic(true);
    }
  }, [opponentDisconnected, ownsMatchMusic, stopEeshi, stopBattleMusic]);

  // FPS counter RAF loop removed — it consumed a full rAF slot per
  // GameFighter instance (×2) with no visible output.

  // Memoize frequently accessed socket listeners to prevent recreation
  const handleFighterAction = useCallback(
    (data) => {
      const currentTime = performance.now();

      // PERFORMANCE: merge happens once in fighterSnapshotBus (retainFighterSocket).
      // This handler is invoked via subscribeFighterSnapshot fan-out.
      const shared = getSharedFighterState();
      const player1Data = shared.player1;
      const player2Data = shared.player2;
      if (!player1Data || !player2Data) return;

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
          snap.p1Edge !== player1Data.isBeingEdgePushed ||
          // Integer balance — keeps the stance gauge live without per-packet
          // float noise from ALWAYS_SEND balance. Deep Grip flips must sync
          // the victim's throw-gate mark the moment the install lands.
          snap.p1Bal !== Math.round(player1Data.balance ?? 100) ||
          snap.p2Bal !== Math.round(player2Data.balance ?? 100) ||
          snap.p1DG !== !!player1Data.hasDeepGrip ||
          snap.p2DG !== !!player2Data.hasDeepGrip ||
          // Push-war HUD tags (PUSH/BACK/EVEN) — gated on inClinch so a
          // stale lead after a push-kill still dirties when the clinch ends.
          snap.p1Shove !==
            (player1Data.inClinch
              ? (player1Data.clinchShoveLead ?? null)
              : null) ||
          snap.p2Shove !==
            (player2Data.inClinch
              ? (player2Data.clinchShoveLead ?? null)
              : null)
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
          snap.p1Bal = Math.round(player1Data.balance ?? 100);
          snap.p2Bal = Math.round(player2Data.balance ?? 100);
          snap.p1DG = !!player1Data.hasDeepGrip;
          snap.p2DG = !!player2Data.hasDeepGrip;
          snap.p1Shove = player1Data.inClinch
            ? (player1Data.clinchShoveLead ?? null)
            : null;
          snap.p2Shove = player2Data.inClinch
            ? (player2Data.clinchShoveLead ?? null)
            : null;
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

      // SERVER ACTION LOCKS: convert the remaining-ms countdowns into local
      // deadlines so the prediction gates can count them down between packets.
      if (typeof playerData.actionLockRemainingMs === "number") {
        serverActionLockUntilRef.current =
          currentTime + playerData.actionLockRemainingMs;
      }
      if (typeof playerData.attackCooldownRemainingMs === "number") {
        serverAttackCooldownUntilRef.current =
          currentTime + playerData.attackCooldownRemainingMs;
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
          prev.isHitFalling !== newState.isHitFalling ||
          prev.lastHitType !== newState.lastHitType ||
          prev.isGrabbing !== newState.isGrabbing ||
          prev.isBeingGrabbed !== newState.isBeingGrabbed ||
          prev.isThrowing !== newState.isThrowing ||
          prev.isBeingThrown !== newState.isBeingThrown ||
          prev.isRawParrying !== newState.isRawParrying ||
          prev.isMatadorParrying !== newState.isMatadorParrying ||
          prev.isMatadorSuccess !== newState.isMatadorSuccess ||
          prev.isMatadorWhiffRecovering !== newState.isMatadorWhiffRecovering ||
          prev.isGuarding !== newState.isGuarding ||
          prev.isApWhiffRecovering !== newState.isApWhiffRecovering ||
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
          prev.isLowKick !== newState.isLowKick ||
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
          prev.isApPostParryLocked !== newState.isApPostParryLocked ||
          prev.isThrowingSnowball !== newState.isThrowingSnowball ||
          prev.isSpawningPumoArmy !== newState.isSpawningPumoArmy ||
          prev.isBeingPulled !== newState.isBeingPulled ||
          prev.isBeingPushed !== newState.isBeingPushed ||
          prev.isThrowTeching !== newState.isThrowTeching ||
          prev.isBowing !== newState.isBowing ||
          prev.isGrabPushDefeat !== newState.isGrabPushDefeat ||
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
          prev.isIceSliding !== newState.isIceSliding ||
          prev.iceSlideDir !== newState.iceSlideDir ||
          prev.isIceSlideReverseHopping !== newState.isIceSlideReverseHopping ||
          prev.isSlideJumping !== newState.isSlideJumping ||
          prev.slideJumpPhase !== newState.slideJumpPhase ||
          prev.slideJumpHasFlap !== newState.slideJumpHasFlap ||
          prev.slideJumpDiveCommitted !== newState.slideJumpDiveCommitted ||
          prev.slideJumpFastFalling !== newState.slideJumpFastFalling ||
          prev.isSidestepping !== newState.isSidestepping ||
          prev.isSidestepStartup !== newState.isSidestepStartup ||
          prev.isSidestepRecovery !== newState.isSidestepRecovery ||
          prev.hasGrip !== newState.hasGrip ||
          prev.isClinchBeltHolding !== newState.isClinchBeltHolding ||
          prev.clinchBeltRequiresM2Release !==
            newState.clinchBeltRequiresM2Release ||
          prev.inClinch !== newState.inClinch ||
          prev.clinchAction !== newState.clinchAction ||
          prev.isClinchThrowing !== newState.isClinchThrowing ||
          prev.isClinchClashing !== newState.isClinchClashing ||
          prev.isClinchPushing !== newState.isClinchPushing ||
          prev.isClinchPlanting !== newState.isClinchPlanting ||
          prev.isResistingThrow !== newState.isResistingThrow ||
          prev.isResistingPull !== newState.isResistingPull ||
          prev.isClinchKillThrowVictim !== newState.isClinchKillThrowVictim ||
          prev.isClinchKillPullVictim !== newState.isClinchKillPullVictim ||
          prev.isClinchJolting !== newState.isClinchJolting ||
          prev.isBeingClinchJolted !== newState.isBeingClinchJolted ||
          prev.isClinchJoltClashing !== newState.isClinchJoltClashing ||
          prev.clinchJoltRecovery !== newState.clinchJoltRecovery ||
          prev.isArmClamped !== newState.isArmClamped ||
          prev.clinchThrowFailStagger !== newState.clinchThrowFailStagger ||
          prev.isClinchOpen !== newState.isClinchOpen ||
          prev.clinchOpenHideStars !== newState.clinchOpenHideStars ||
          prev.hasDeepGrip !== newState.hasDeepGrip ||
          prev.clinchShoveLead !== newState.clinchShoveLead ||
          // MASTERY Phase 2 (2.1): broken-posture tell drives the openable teeter.
          prev.isPostureBroken !== newState.isPostureBroken ||
          // Wardrobe gear (top hat) — rare, but must commit when it arrives
          JSON.stringify(prev.gearIds || []) !==
            JSON.stringify(newState.gearIds || []) ||
          // Balance threshold crossings (throwable <=50, kill zone <15) drive the
          // clinch wobble/stagger animations — balance is ALWAYS_SEND so a plain
          // value compare would re-render every packet; compare zone membership.
          (prev.balance <= 50) !== (newState.balance <= 50) ||
          (prev.balance < 15) !== (newState.balance < 15);

        // Blocked-state guard may clear stale slap flags even when nothing else
        // in the discrete check changed — still commit so the slap sprite
        // animation can't hold a pre-hit / pre-flap isSlapAttack from a skipped
        // merge (which would freeze the fighter on a stale slap pose).
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
    const unsubFighterAction = subscribeFighterSnapshot((_state, data) => {
      handleFighterAction(data);
    });

    const handleSlapParry = (data) => {
      if (
        data &&
        typeof data.x === "number" &&
        typeof data.y === "number"
      ) {
        setParryEffectPosition({
          x: data.x + SPRITE_HALF_W,
          y: HIT_EFFECT_Y,
        });
        playSound(slapParrySound, 0.01);
        // TEST: the new sprite-sheet SlapParryEffect (white grab-break burst) is
        // the sole slap-parry visual now — the old particle clash burst is
        // disabled so we can evaluate the sprite on its own.
        // if (index === 0) {
        //   emitParticles("slapParryClash", {
        //     x: data.x + SPRITE_HALF_W,
        //     y: HIT_EFFECT_Y,
        //     p1x: data.p1x,
        //     p2x: data.p2x,
        //     intensity: data.intensity || 1,
        //   });
        // }
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
      // Dev-only contact overlay ingest (no-op unless localStorage flag set).
      noteCombatContactEvent(data);
      if (data && typeof data.x === "number" && typeof data.y === "number") {
        lastPlayerHitTime.current = Date.now();

        // Attacker-side hit-confirm flash. Fires only on the GameFighter
        // instance whose player.id matches the server-provided attackerId, so each
        // local fighter pulses independently when *they* land a hit. The tier
        // scales the glow intensity in the styled-component pop filter.
        // Palm thrust skips the outline flash — burst VFX/hitstop already sell it.
        if (data.attackerId && data.attackerId === player.id && !data.isPalmThrust) {
          let tier = "slap";
          if (data.attackType === "charged") tier = "charged";
          if (data.cinematicKill) tier = "cinematic";
          // Tip slap confirm reads a touch sharper than a deep mash connect.
          if (data.tipSlap && tier === "slap") tier = "tip";
          setAttackerConfirmTier(tier);
          if (attackerConfirmTimeoutRef.current) {
            clearTimeout(attackerConfirmTimeoutRef.current);
          }
          // Cinematic / charged confirms linger longer so the satisfaction matches the weight.
          // Slap is short — presses fire fast and the pulse must clear before the next hit.
          const dur =
            tier === "cinematic" ? 280 :
            tier === "charged" ? 200 :
            tier === "tip" ? 170 : 140;
          attackerConfirmTimeoutRef.current = setTimeout(() => {
            setAttackerConfirmTier(null);
            attackerConfirmTimeoutRef.current = null;
          }, dur);
        }

        // PROCEDURAL ANIMATION — attacker contact recoil. On connect, the
        // attacker's body jolts back for ~0.18s (attackerContactRecoil
        // keyframes) before resuming the swing loop. Charged headbutts PLANT
        // (server + no CSS bounce). Cinematic kills keep their scripted pose.
        // The 200ms auto-clear ends before the fastest slap re-chain.
        if (
          data.attackerId &&
          data.attackerId === player.id &&
          !data.cinematicKill &&
          data.attackType !== "charged"
        ) {
          setAttackerRecoil(true);
          if (attackerRecoilTimeoutRef.current) {
            clearTimeout(attackerRecoilTimeoutRef.current);
          }
          attackerRecoilTimeoutRef.current = setTimeout(() => {
            setAttackerRecoil(false);
            attackerRecoilTimeoutRef.current = null;
          }, 200);
        }

        // Contact freeze pin — snap interpolated X to the server park pose so
        // hitstop doesn't freeze a pre-correction bury (worst on point-blank
        // palm: arm through belly for the whole 160ms burst freeze).
        const pinFighterX = (plantX, plantY) => {
          if (typeof plantX !== "number") return;
          const y =
            typeof plantY === "number"
              ? plantY
              : interpolatedPositionRef.current?.y ?? 0;
          interpolatedPositionRef.current = { x: plantX, y };
          if (previousState.current) {
            previousState.current = {
              ...previousState.current,
              x: plantX,
              y,
            };
          }
          if (currentState.current) {
            currentState.current = {
              ...currentState.current,
              x: plantX,
              y,
            };
          }
          const leftPct = `${(plantX / 1280) * 100}%`;
          const bottomPct = `${(y / 720) * 100}%`;
          if (fighterImgDomRef.current) {
            fighterImgDomRef.current.style.left = leftPct;
            fighterImgDomRef.current.style.bottom = bottomPct;
          }
          if (animContainerDomRef.current) {
            animContainerDomRef.current.style.left = leftPct;
            animContainerDomRef.current.style.bottom = bottomPct;
          }
        };

        // Attacker plant pin — charged / palm / slap. Snap interp to server X so
        // hitstop freezes the tip park, not a pre-correction bury or coast.
        if (
          data.attackerId &&
          data.attackerId === player.id &&
          (data.attackType === "charged" || data.attackType === "slap")
        ) {
          pinFighterX(data.attackerX, data.attackerY);
          // Headbutt drops strike pose on connect — clear local attack predict.
          // Palm HOLDS the strike through hitstop/recovery; slap keeps its
          // anim cycle. Clearing isPalmThrust here flickered pocket palm poses.
          if (data.attackType === "charged" && !data.isPalmThrust) {
            predictedState.current = {
              ...predictedState.current,
              isAttacking: false,
              isChargingAttack: false,
              isSlapAttack: false,
              isPalmThrust: false,
              timestamp: Date.now(),
            };
            isChargedLungingRef.current = false;
          }
        }

        // Victim park pin — data.x is post-contact-correction (tip/palm park).
        if (
          data.victimId &&
          data.victimId === player.id &&
          typeof data.x === "number"
        ) {
          pinFighterX(data.x, data.y);
        }

        // Screen shake — explicit per-hit tiers. Charged attacks get a heavy
        // crunch profile with zoom + roll; slap pokes stay snappy with no zoom.
        // Fired once per client (index===0). Cinematic kills run their own
        // camera, so we skip here to avoid stepping on it.
        if (index === 0 && !data.cinematicKill) {
          const shakeDir = data.knockbackDirection || (data.facing === 1 ? -1 : 1);
          if (data.isGored) {
            // EXPOSED (matador punish) — heavier crack than a normal slap/charge.
            addShake("slap_parry", { dirX: shakeDir, scale: 0.95 });
          } else if (data.isPalmThrust) {
            // Palm is a planted burst — use throw-landing weight, not charged crunch.
            addShake("throw_landing", { dirX: shakeDir, scale: 1.05 });
          } else if (data.attackType === "charged") {
            const chargeScale =
              0.8 + Math.min((data.chargePercentage || 0) / 100, 1) * 0.45;
            addShake("charged_hit", { scale: chargeScale, dirX: shakeDir });
          } else if (data.attackType === "flap") {
            // Belly-slam (flap / slide-jump dive) — heavier plant than a slap poke.
            addShake("throw_landing", { dirX: shakeDir, scale: 1.15 });
          } else {
            // MASTERY Phase 5 (5.2): a momentum hit (dash-in / carried speed)
            // punches the camera harder than a flat-footed slap. Tip spacing
            // gets a snappier crack (lighter than momentum weight). Server-gated.
            let slapShake = 1;
            if (data.momentumHit) slapShake = 1.4;
            else if (data.tipSlap) slapShake = 1.15 + (data.tipQuality || 0.45) * 0.1;
            addShake("slap_hit", { dirX: shakeDir, scale: slapShake });
          }
        }

        if (index === 0 && !data.cinematicKill) {
          const pan = xToPan(data.x);
          const isLowKickHit =
            data.isLowKick || data.attackType === "lowKick";
          if (data.attackType === "slap" || isLowKickHit) {
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
            if (data.isGored) {
              // EXPOSED — heavier than counter: deep thud + sharp crack.
              playSound(baseSound, 0.03, null, 0.62, pan);
              playSound(baseSound, 0.024, null, 1.4, pan);
            } else if (data.isCounterHit) {
              playSound(baseSound, 0.022, null, 0.78, pan);
            } else if (data.isPunish) {
              playSound(baseSound, 0.020, null, 1.32, pan);
            }
            // MASTERY Phase 3 (tsuppari cadence): an enhanced (rhythm-timed) slap
            // layers a sharper, higher "crack" whose pitch RISES with each
            // consecutive enhanced slap — the crowd can HEAR a good player's
            // tsuppari. Reuses the same sample at a climbing rate (capped) so it
            // reads as belonging to the hit. Falls back to silent (isCadence
            // false) with the flag off.
            if (data.isCadence) {
              const chain = Math.max(1, data.cadenceChain || 1);
              const cadenceRate = Math.min(1.35 + (chain - 1) * 0.12, 1.9);
              playSound(baseSound, 0.03, null, cadenceRate, pan);
            }
            // MASTERY Phase 5 (5.2): a momentum hit adds a faint, pitched-DOWN
            // SUB-layer so a big-momentum slap FEELS heavier — kept well under the
            // base hit so it reads as added weight, NOT a second hit (a near-base
            // replay of the same sample flams into an audible "double" on the
            // frequent momentum slaps). Braked knockback stays a VISUAL-only tell
            // (the dig-in skid below) — replaying the hit sample here was the
            // other half of the doubling. Server-gated ⇒ silent with the flag off.
            if (data.momentumHit) {
              playSound(baseSound, 0.012, null, 0.6, pan);
            }
            // MASTERY Phase 4 (4.2): tip spacing — pitched-UP crack so a clean
            // tip connect reads as snappy / precise (opposite of momentum weight).
            // Scales with tipQuality; silent below the server feel threshold.
            if (data.tipSlap) {
              const q = Math.max(0.45, Math.min(1, data.tipQuality || 0.45));
              playSound(baseSound, 0.016 + q * 0.014, null, 1.22 + q * 0.2, pan);
            }
          } else {
            const baseSound = pickRandomSound(chargedHitSounds);
            playSound(baseSound, 0.045, null, 1.0, pan);
            // Same layering treatment as slaps but slightly louder/wider pitch
            // gap because charged hits already have weight — the layer needs to
            // stand out without overpowering the primary thwack.
            if (data.isGored) {
              playSound(baseSound, 0.034, null, 0.58, pan);
              playSound(baseSound, 0.028, null, 1.38, pan);
            } else if (data.isCounterHit) {
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
          const isLowKickHit =
            data.isLowKick || data.attackType === "lowKick";
          const isFlapSlamHit = data.attackType === "flap";
          const seamX = contactFxX(data);
          setHitEffectPosition({
            x: seamX,
            // Low kick → ankles; belly-slam → high on the body; else chest.
            y: isLowKickHit
              ? LOW_KICK_HIT_EFFECT_Y
              : isFlapSlamHit
              ? FLAP_HIT_EFFECT_Y
              : HIT_EFFECT_Y,
            facing: data.facing || 1,
            // Absolute server tip seam — skip legacy victim.x+70 % offsets in
            // SlapHitSpriteEffect (those were shoving sparks behind P1).
            seamAnchored: hasContactSeam(data),
            timestamp: data.timestamp,
            hitId: data.hitId,
            attackType: data.attackType || "slap",
            isPalmThrust: data.isPalmThrust || false,
            isLowKick: isLowKickHit,
            isCounterHit: data.isCounterHit || false,
            isPunish: data.isPunish || false,
            isArmorBreak: data.isArmorBreak || false,
            isPowered: data.isPowered || false,
            isTipSlap: !!data.tipSlap,
            cinematicKill: data.cinematicKill || false,
            cinematicHitstopMs: data.cinematicKill ? 550 : 0,
          });
        }

        // Tip posture HUD flinch — victim's gauge flashes so the spacing reward
        // is visible in the moment, not only as a mysterious later throw setup.
        if (index === 0 && data.tipSlap && data.attackType === "slap") {
          const vNum = data.victimPlayerNumber;
          if (vNum === 1) setP1TipDrain(Date.now());
          else if (vNum === 2) setP2TipDrain(Date.now());
        }

        // COUNTER HIT / PUNISH side banners — folded into player_hit (were
        // separate `counter_hit` / `punish_banner` socket events, each of which
        // cost an extra unbatched GameFighter re-render on the same frame as the
        // hit). Index 0 owns the HUD banner state (same as the old handlers).
        // hitId is the dedup key.
        if (index === 0) {
          if (data.showGoredBanner) {
            setGoredBannerPosition({
              counterId: `gored-${data.hitId || Date.now()}`,
              playerNumber: data.attackerPlayerNumber || 1,
            });
          } else if (data.showCounterBanner) {
            setCounterHitEffectPosition({
              x: contactFxX(data),
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

        // DISABLED: the old canvas center burst (star flare + bloom + streaks).
        // This was the "old" hit effect that still drew on every slap/charged/
        // burst hit underneath the new sprite-sheet burst (SlapHitSpriteEffect),
        // which now owns the impact read. Re-enable this block to bring the
        // canvas hitRingCore back.
        // if (index === 0) {
        //   const hitFacing = data.facing || 1;
        //   const facingOffsetPx = (hitFacing === 1 ? -8 : -3) * 12.8;
        //   const hitX = data.x + 70 + facingOffsetPx;
        //   const knockbackDir =
        //     data.knockbackDirection || (hitFacing === 1 ? -1 : 1);
        //   let tier = "slap";
        //   if (data.attackType === "charged") tier = "charged";
        //
        //   let palette = "white";
        //   if (data.isArmorBreak) palette = "amber";
        //   else if (data.isCounterHit) palette = "gold";
        //   else if (data.isPunish) palette = "purple";
        //   else if (data.isPowered) palette = "red";
        //
        //   emitParticles("hitRingCore", {
        //     x: hitX,
        //     y: HIT_EFFECT_Y,
        //     dir: knockbackDir,
        //     tier,
        //     palette,
        //   });
        // }

        // Victim feet skid dust on slap hits — the ground-side read of the
        // knockback transfer (the judder below is the body-side read). Index 0
        // owns world-anchored particles, same as the hit spark. data.x is the
        // victim's raw x — the sprite is CENTERED on it (translate -50%), so
        // no offset: canvas presets anchored on raw x sit under the body for
        // both facings (same convention as sidestepLand / throwLand).
        if (index === 0 && !data.cinematicKill && data.attackType === "slap") {
          const skidDir =
            data.knockbackDirection || (data.facing === 1 ? -1 : 1);
          emitParticles("slapSkidDust", {
            x: data.x,
            y: data.y,
            dir: skidDir,
          });
          // MASTERY Phase 5 (5.2): a momentum hit throws a second, heavier skid
          // (more ground visibly lost); a braked hit kicks the chips BACK toward
          // the incoming shove ("dig-in" against it). Both reuse the existing
          // skid preset and only fire on server-gated flags ⇒ nothing extra with
          // the flag off.
          if (data.momentumHit) {
            emitParticles("slapSkidDust", { x: data.x + skidDir * 6, y: data.y, dir: skidDir });
          }
          if (data.braked) {
            emitParticles("slapSkidDust", { x: data.x, y: data.y, dir: -skidDir });
          }
        }

        // PROCEDURAL ANIMATION — grade THIS victim's squash amplitude from
        // the hit's actual weight. Feeds --impact-amp (see fighterStyled
        // Components): 1 = the legacy fixed squash, ~1.75 = max crumple.
        // Palm-thrust bursts stay near 1 — burstHitSquash keyframes already
        // start much bigger, so their base shape carries the weight.
        if (data.victimId && data.victimId === player.id) {
          let amp = 1;
          if (data.attackType === "charged") {
            amp = 1.2 + Math.min((data.chargePercentage || 0) / 100, 1) * 0.25;
          } else if (data.attackType === "flap") {
            amp = 1.35;
          } else if (data.isLowKick || data.attackType === "lowKick") {
            amp = 0.9;
          }
          if (data.isCounterHit) amp += 0.2;
          else if (data.isPunish) amp += 0.15;
          if (data.isArmorBreak) amp += 0.15;
          if (data.momentumHit) amp += 0.12;
          if (data.tipSlap) amp += 0.08;
          // Braked knockback = the victim dug in — displacement is the tell
          // that shrinks, so the body deformation shrinks with it.
          if (data.braked) amp -= 0.2;
          setImpactAmp(Math.max(0.7, Math.min(amp, 1.75)));
        }

        // Arm the victim hitstop judder on THIS fighter's instance (cinematic
        // kills run their own camera/freeze choreography — skip them).
        if (
          data.victimId &&
          data.victimId === player.id &&
          !data.cinematicKill
        ) {
          hitJudderRef.current = {
            // Only draws while the display freeze is active; the arm window
            // just needs to outlast the longest non-cinematic hitstop.
            armedUntil: performance.now() + 400,
            amp: data.attackType === "charged" ? 4 : 3,
            frame: 0,
          };
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
      // Local parrier: stamp flurry cover for the NEXT rising-edge re-arm only.
      // Stance already dropped on connect — clear local commit so a held Space
      // doesn't keep suppressing offense after the plant unlocks.
      if (
        isLocalPlayer &&
        data?.isAttackParry &&
        data.parrierId === penguin.id
      ) {
        predictedFlurryUntilRef.current =
          performance.now() +
          (data.isPerfect
            ? AP_FLURRY_COVER_PERFECT_MS_CLIENT
            : AP_FLURRY_COVER_REGULAR_MS_CLIENT);
        predictedParryCommitUntilRef.current = 0;
        // Land overrides any Space-up whiff pose predict.
        apWhiffPredictRef.current.until = 0;
        apWhiffPredictRef.current.sawServerWhiff = false;
        if (predictedState.current.isRawParrying) {
          predictedState.current.isRawParrying = false;
        }
      }
      // Pose director: EVERY GameFighter that is the parrier restarts the
      // success anim on this land (including flurry). Must run before the
      // index!==0 VFX early-return — opponent/local both need the pose hold.
      if (
        data &&
        (data.parrierId === penguin.id || data.parrierId === player.id)
      ) {
        beginRawParrySuccessVisual(
          performance.now(),
          data.parryId || null,
          data.chainCount || 1
        );
        forceVisualRender();
      }
      if (data && typeof data.parrierX === "number") {
        // Two GameFighter instances both listen to this event; only index 0
        // owns the HUD portal + shared VFX state (same pattern as UiPlayerInfo).
        if (index !== 0) return;
        // Position effect in front of the parrying player (where a hit effect would appear)
        const facing = data.facing || 1;
        // Front offset — regular snowball/raw parry sits ahead of the body.
        const frontOffset = facing === 1 ? 55 : -55;
        const parryPan = xToPan(data.parrierX);

        // ── ATTACK PARRY (AP) ──────────────────────────────────────────────
        // Grab-break star burst pinned to the TOP of the raised deflecting
        // hand (success frame-2 palm). Forward along the attacker axis so it
        // sits on the hand that "comes out" into the clash. Perfect still gets
        // the electric-cyan tier + flash/banner (no camera zoom/darken).
        if (data.isAttackParry) {
          const isPerfect = !!data.isPerfect;
          const towardAttacker =
            typeof data.attackerX === "number"
              ? data.attackerX < data.parrierX
                ? -1
                : 1
              : facing === 1
                ? 1
                : -1;
          // Raised deflecting-hand pin (success frame-2). Prefer server contact
          // seam (strike tip); fall back to hand-forward offset from parrier.
          // Extra outward push so the grab-break burst sits clear of the body
          // instead of overlapping the parrier's torso/arm.
          const PARRY_HAND_FORWARD_PX = 52;
          const PARRY_EFFECT_OUTWARD_PX = 28;
          const PARRY_HAND_Y = HIT_EFFECT_Y + 22;
          const chain = data.chainCount || 1;
          // Contact pin on F2 deflect hand (success anim: block → f1 → f2).
          const parrySeamX =
            (typeof data.contactX === "number"
              ? data.contactX
              : data.parrierX + towardAttacker * PARRY_HAND_FORWARD_PX) +
            towardAttacker * PARRY_EFFECT_OUTWARD_PX;
          setParryEffectPosition({
            x: parrySeamX,
            y: PARRY_HAND_Y,
            facing,
            parryId: data.parryId,
            variant: isPerfect ? "perfect" : "parry",
            chain,
            isPerfect,
            playerNumber: data.playerNumber || 1,
          });
          // Chain crescendo: each consecutive deflect rises in pitch so a flurry
          // of parries builds musically instead of flatly repeating.
          const chainRate = Math.min(1.0 + (chain - 1) * 0.06, 1.6);
          if (data.isPerfect) {
            // Perfect: the bright success clink + a hotter clang layered on top.
            playSound(slapParrySound, data.isKill ? 0.035 : 0.024, null, chainRate * 1.08, parryPan);
            playSound(rawParrySuccessSound, 0.02, null, 1.0, parryPan);
          } else {
            playSound(slapParrySound, data.isKill ? 0.03 : 0.018, null, chainRate, parryPan);
          }
          return;
        }

        // ── Snowball / pumo-clone parry (still the blue ring + refund cues) ──
        const effectData = {
          x: data.parrierX + 150 + frontOffset,
          // Match the hit-spark height so parry sits inline with where hits land.
          y: HIT_EFFECT_Y,
          facing: facing,
          timestamp: data.timestamp,
          parryId: data.parryId,
          isPerfect: data.isPerfect || false,
          playerNumber: data.playerNumber || 1,
        };
        setRawParryEffectPosition(effectData);
        if (data.playerNumber === 1) {
          setP1ParryRefund(Date.now());
        } else if (data.playerNumber === 2) {
          setP2ParryRefund(Date.now());
        }
        if (data.isPerfect && data.balanceGain > 0) {
          if (data.playerNumber === 1) {
            setP1BalanceGain(Date.now());
          } else if (data.playerNumber === 2) {
            setP2BalanceGain(Date.now());
          }
        }
        playSound(rawParryGruntSound, 0.025, null, 1.0, parryPan);
        if (data.isPerfect) {
          playSound(rawParrySuccessSound, 0.015, null, 1.0, parryPan);
        } else {
          playSound(regularRawParrySound, 0.04, null, 1.0, parryPan);
        }
      }
    };
    socket.on("raw_parry_success", handleRawParrySuccess);

    // GUARD BLOCK — the block floor absorbed a slap/palm as chip. Tilted blue
    // absorb ring + muffled thud; distinctly weaker than a parry's bright clink.
    // Pose: brief block-parry.png SUCCESS (BLOCK_SUCCESS_POSE_MS ≈ AP success pose),
    // then back to attempting so a flurry re-fires instead of freezing on success.
    // Index 0 owns VFX.
    const handleGuardBlock = (data) => {
      if (!data || typeof data.parrierX !== "number") return;
      // SUCCESS pose on the fighter who absorbed the hit (both instances listen).
      if (data.parrierId === player.id) {
        // Force attempting → success on every chip (even if already in success)
        // so the sprite swap re-triggers like AP's isRawParrySuccess re-fire.
        setGuardBlockSuccess(false);
        if (guardBlockSuccessTimeoutRef.current) {
          clearTimeout(guardBlockSuccessTimeoutRef.current);
          guardBlockSuccessTimeoutRef.current = null;
        }
        requestAnimationFrame(() => {
          setGuardBlockSuccess(true);
          guardBlockSuccessTimeoutRef.current = setTimeout(() => {
            setGuardBlockSuccess(false);
            guardBlockSuccessTimeoutRef.current = null;
          }, BLOCK_SUCCESS_POSE_MS);
        });
      }
      if (index !== 0) return;
      // Prefer server tip-seam; fall back to a short front offset from parrier.
      const facing = data.facing || 1;
      const FRONT_PX = 16;
      const blockX =
        typeof data.contactX === "number"
          ? data.contactX
          : data.parrierX + facing * FRONT_PX;
      const blockPan = xToPan(blockX);
      setBlockingEffectPosition({
        x: blockX,
        y: HIT_EFFECT_Y,
        facing,
        blockId: data.blockId,
        timestamp: data.timestamp,
      });
      // Same cue as a regular (non-perfect) raw parry — block is the lesser
      // outcome so it plays a hair quieter. A guard-crush adds a sharper snap.
      playSound(regularRawParrySound, data.isPalm ? 0.035 : 0.028, null, 1.0, blockPan);
      if (data.guardCrushed) {
        playSound(glassBreakSound, 0.03, null, 1.0, blockPan);
      }
    };
    socket.on("guard_block", handleGuardBlock);

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

    let unsubClinchTech = null;
    let handleGrabBreak, handleClinchTech, handleCounterGrab,
    handleMatadorSuccess, handleStaminaBlocked, handleClinchCallout,
    handleClinchThrowFail, handleDeepGrip, handlePostureBreak;
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

      // Mutual grab-at-once is a quiet clinch (no TECH rings / pose).
      // GrabTechEffect is still used for clinch throw-clash tumble below.

      let wasClinchClashing = false;
      handleClinchTech = (_state, data) => {
        const shared = getSharedFighterState();
        const p1 = shared.player1;
        const p2 = shared.player2;
        if (!p1 || !p2) return;
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
      unsubClinchTech = subscribeFighterSnapshot(handleClinchTech);

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

      handleMatadorSuccess = (data) => {
        if (!data || data.type !== "matador_success") return;
        // Yank SFX/shake + gold MATADOR stamp. Keep regular gold plumes
        // running through the pull (no extra on-hit particle burst).
        const matX = data.matadorX ?? data.x;
        const grabX = data.grabberX ?? data.x;
        const pullDirection =
          matX != null && grabX != null
            ? grabX < matX
              ? 1
              : -1
            : 1;
        const pan = xToPan(data.x ?? matX ?? 640);
        playSound(throwSound, 0.03, null, 1.15, pan);
        playSound(dodgeSound, 0.032, null, 0.85, pan);
        playSound(palmThrustWhiffSound, 0.022, null, 1.2, pan);
        if (index === 0) {
          addShake("matador", { dirX: pullDirection });
          setMatadorSuccessStampPosition({
            counterId:
              data.matadorId_token ||
              `matador-${data.matadorId || Date.now()}`,
            playerNumber: data.matadorPlayerNumber || 1,
          });
        }
      };
      socket.on("matador_success", handleMatadorSuccess);

      // Clinch stance-read banners (counter_throw only emits after a LAND)
      handleClinchCallout = (data) => {
        if (!data || data.type !== "counter_throw") return;
        setClinchCalloutData({
          type: data.type,
          playerNumber: data.playerNumber || 1,
          calloutId: data.calloutId || `clinch-callout-${Date.now()}`,
        });
      };
      socket.on("clinch_callout", handleClinchCallout);

      // Failed throw/pull — RESISTED plaque, or PERFECT BRACE hype stamp
      handleClinchThrowFail = (data) => {
        if (!data) return;
        if (data.perfectBrace) {
          setPerfectBraceStampPosition({
            braceId: data.failId || `perfect-brace-${Date.now()}`,
            playerNumber: data.playerNumber || 1,
          });
          return;
        }
        setClinchCalloutData({
          type: "resisted",
          playerNumber: data.playerNumber || 1,
          calloutId: data.failId || `clinch-fail-${Date.now()}`,
        });
      };
      socket.on("clinch_throw_fail", handleClinchThrowFail);

      // Deep grip earned — announce on the holder's side
      handleDeepGrip = (data) => {
        if (!data) return;
        setClinchCalloutData({
          type: "deep_grip",
          playerNumber: data.playerNumber || 1,
          calloutId: data.gripId || `deep-grip-${Date.now()}`,
        });
      };
      socket.on("deep_grip", handleDeepGrip);

      // MASTERY Phase 2 (2.1): posture-crack SFX on the break edge — the audible
      // half of the broken-posture "openable" tell (the visual half is the
      // feet-planted teeter driven by isPostureBroken). Fires once per break,
      // panned to the staggered fighter. Server only emits this behind the
      // MASTERY_P2_POSTURE flag, so it's silent when the phase is off.
      handlePostureBreak = (data) => {
        if (!data) return;
        playSound(stunnedSound, 0.03, null, 0.85, xToPan(data.x));
      };
      socket.on("posture_break", handlePostureBreak);

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
      setBlockingEffectPosition(null);
      setGuardBlockSuccess(false);
      if (guardBlockSuccessTimeoutRef.current) {
        clearTimeout(guardBlockSuccessTimeoutRef.current);
        guardBlockSuccessTimeoutRef.current = null;
      }
      setChargeClashEffectPosition(null); // Clear any active charge clash effects
      setNoStaminaEffectKey(0); // Clear "No Stamina" effect on round reset
      onResetDisconnectState(); // Reset opponent disconnected state for new games

      // Drop any leftover charge/attack prediction from the previous round so a
      // phantom charge shake can't carry into the next walk-up / HAKKIYOI.
      predictedState.current = {
        isSlapAttack: false,
        slapAnimation: predictedState.current.slapAnimation,
        isAttacking: false,
        isPalmThrust: false,
        isLowKick: false,
        isDodging: false,
        dodgeDirection: null,
        isChargingAttack: false,
        isRawParrying: false,
        isGrabbing: false,
        isPowerSliding: false,
        isBraking: false,
        timestamp: 0,
      };

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
      setBlockingEffectPosition(null);
      setGuardBlockSuccess(false);
      if (guardBlockSuccessTimeoutRef.current) {
        clearTimeout(guardBlockSuccessTimeoutRef.current);
        guardBlockSuccessTimeoutRef.current = null;
      }
      setChargeClashEffectPosition(null); // Clear any leftover charge clash effects
      // Clear stale predictions to prevent phantom charge at round start
      predictedState.current = {
        isSlapAttack: false,
        slapAnimation: predictedState.current.slapAnimation,
        isAttacking: false,
        isPalmThrust: false,
        isLowKick: false,
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
        isPalmThrust: false,
        isLowKick: false,
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
      unsubFighterAction();
      socket.off("slap_parry", handleSlapParry);
      socket.off("charge_clash", handleChargeClash);
      socket.off("player_hit", handlePlayerHit);
      socket.off("raw_parry_success", handleRawParrySuccess);
      socket.off("guard_block", handleGuardBlock);
      socket.off("perfect_parry", handlePerfectParry);
      if (guardBlockSuccessTimeoutRef.current) {
        clearTimeout(guardBlockSuccessTimeoutRef.current);
        guardBlockSuccessTimeoutRef.current = null;
      }
      if (attackerConfirmTimeoutRef.current) {
        clearTimeout(attackerConfirmTimeoutRef.current);
        attackerConfirmTimeoutRef.current = null;
      }
      if (attackerRecoilTimeoutRef.current) {
        clearTimeout(attackerRecoilTimeoutRef.current);
        attackerRecoilTimeoutRef.current = null;
      }
      if (knockbackTrailIntervalsRef.current.length > 0) {
        knockbackTrailIntervalsRef.current.forEach((id) => clearInterval(id));
        knockbackTrailIntervalsRef.current = [];
      }
      if (index === 0) {
        socket.off("grab_break", handleGrabBreak);
        if (typeof unsubClinchTech === "function") unsubClinchTech();
        socket.off("counter_grab", handleCounterGrab);
        socket.off("matador_success", handleMatadorSuccess);
        socket.off("stamina_blocked", handleStaminaBlocked);
        socket.off("clinch_callout", handleClinchCallout);
        socket.off("clinch_throw_fail", handleClinchThrowFail);
        socket.off("deep_grip", handleDeepGrip);
        socket.off("posture_break", handlePostureBreak);
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
  }, [
    index,
    socket,
    handleFighterAction,
    opponentDisconnected,
    localId,
    beginRawParrySuccessVisual,
    forceVisualRender,
    isLocalPlayer,
    penguin.id,
    player.id,
  ]);

  // Index 0 only — two GameFighters share one room; one BGM owner avoids double playback.
  useEffect(() => {
    if (!ownsMatchMusic) return;

    if (!opponentDisconnected && !matchEndingRef.current) {
      startEeshi(false);
    }

    return () => {
      stopEeshi();
      stopBattleMusic(true);
    };
  }, [opponentDisconnected, ownsMatchMusic, startEeshi, stopEeshi, stopBattleMusic]);

  // NOTE: game_start and game_over music handling is now consolidated into the main socket useEffect
  // to prevent duplicate listeners and cleanup race conditions

  useEffect(() => {
    // Trigger swing sound for non-slap attacks. Palm thrust gets its own
    // dedicated whiff sound; charged / low kick keep the generic attack sound.
    // For the LOCAL player this sound normally already played at prediction
    // time (applyPrediction) — the gate suppresses the server-confirmation
    // replay. It still fires here when prediction was gated (e.g. the press
    // was server-buffered during recovery) or expired before the confirm.
    if (
      penguin.isAttacking &&
      !penguin.isSlapAttack &&
      !lastAttackState.current
    ) {
      const sincePredicted =
        performance.now() - predictedSwingSoundAtRef.current.attack;
      if (sincePredicted >= PREDICTED_SOUND_SUPPRESS_MS) {
        // Align the whoosh with the ACTIVE swing, not the windup start.
        // Charged / palm / low kick all set actionLockUntil = startup end on
        // the server, and its remaining ms rides the broadcast — so this is
        // "startup time this client hasn't seen yet". Scheduled → cancellable
        // if the windup is interrupted before the swing comes out.
        const startupCap = penguin.isPalmThrust
          ? SWING_STARTUP_MS.palm
          : penguin.isLowKick
          ? SWING_STARTUP_MS.lowKick
          : SWING_STARTUP_MS.charged;
        const delay = Math.max(
          0,
          Math.min(penguin.actionLockRemainingMs || 0, startupCap)
        );
        const isPalm = penguin.isPalmThrust;
        const panX = penguin.x;
        scheduleSwingSound(delay, () => {
          if (isPalm) {
            playSound(palmThrustWhiffSound, 0.05, null, 1.0, xToPan(panX));
          } else {
            playSound(attackSound, 0.05);
          }
        });
      }
    }
    // Update the last attack state
    lastAttackState.current = penguin.isAttacking && !penguin.isSlapAttack;
  }, [penguin.isAttacking, penguin.isSlapAttack, penguin.isPalmThrust, penguin.isLowKick]);

  // Separate effect for slap attack sounds based on slapAnimation changes.
  // Gated against the predicted-audio path: the local player's slap whoosh
  // already played on the press frame in applyPrediction, so skip the replay
  // when the server confirmation lands. Buffered/pending slaps (prediction
  // gated during an active slap) still sound from here.
  useEffect(() => {
    if (
      penguin.isSlapAttack &&
      penguin.isAttacking &&
      !isInFlapMechanic(penguin)
    ) {
      const sincePredicted =
        performance.now() - predictedSwingSoundAtRef.current.slap;
      if (sincePredicted >= PREDICTED_SOUND_SUPPRESS_MS) {
        // Slap sets no actionLock, so there's no exact startup-remaining hint
        // in the broadcast. 40ms ≈ 55ms startup minus typical local transit —
        // close enough to put the whoosh on the swing, and scheduling keeps
        // it cancellable when the slap dies in windup (grab/hit eats it).
        const panX = penguin.x;
        scheduleSwingSound(40, () =>
          playSound(
            pickRandomSound(slapWhiffSounds),
            0.02,
            null,
            1.0,
            xToPan(panX)
          )
        );
      }
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
      // Skip when the predicted dash already played sound + dust on the
      // press frame (applyPrediction) — this is just the server confirming.
      const sincePredicted =
        performance.now() - predictedSwingSoundAtRef.current.dodge;
      if (sincePredicted >= PREDICTED_SOUND_SUPPRESS_MS) {
        playSound(dodgeSound, 0.02);
        emitParticles("dashStart", {
          x: penguin.dodgeStartX ?? penguin.x,
          y: penguin.y,
          direction: penguin.dodgeDirection ?? penguin.facing ?? 1,
          facing: penguin.facing ?? 1,
        });
      }
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

  // Ice-slide foot FX — glowy frost / blade sparks under the sliding-pose feet
  // while SHIFT-held ice sliding. Travel dir must come from server iceSlideDir
  // (dodgeDirection is cleared on the land tick that arms the slide). X-delta
  // only fills speed + brief prediction gaps.
  const isIceSlidingRef = useRef(false);
  const iceSlideDirRef = useRef(1);
  const lastDodgeDirRef = useRef(1);
  const iceSlideLastXRef = useRef(null);
  const prevIceSlidingForParticles = useRef(false);

  useEffect(() => {
    if (
      penguin.isDodging &&
      typeof penguin.dodgeDirection === "number" &&
      penguin.dodgeDirection !== 0
    ) {
      lastDodgeDirRef.current = Math.sign(penguin.dodgeDirection);
    }
  }, [penguin.isDodging, penguin.dodgeDirection]);

  useEffect(() => {
    isIceSlidingRef.current =
      !!penguin.isIceSliding &&
      !penguin.isDodging &&
      !penguin.isSlideJumping;
    if (
      typeof penguin.iceSlideDir === "number" &&
      penguin.iceSlideDir !== 0
    ) {
      iceSlideDirRef.current = Math.sign(penguin.iceSlideDir);
    }
  }, [
    penguin.isIceSliding,
    penguin.isDodging,
    penguin.isSlideJumping,
    penguin.iceSlideDir,
  ]);

  useEffect(() => {
    const active =
      !!penguin.isIceSliding &&
      !penguin.isDodging &&
      !penguin.isSlideJumping;

    if (active && !prevIceSlidingForParticles.current) {
      const pos = interpolatedPositionRef.current;
      const startX = pos?.x ?? penguin.x;
      iceSlideLastXRef.current = startX;
      const commitDir =
        typeof penguin.iceSlideDir === "number" && penguin.iceSlideDir !== 0
          ? Math.sign(penguin.iceSlideDir)
          : lastDodgeDirRef.current || iceSlideDirRef.current || 1;
      iceSlideDirRef.current = commitDir;
      emitParticles("iceSlideStart", {
        x: startX,
        y: pos?.y ?? penguin.y,
        direction: commitDir,
        facing: penguin.facing || 1,
      });
    }
    prevIceSlidingForParticles.current = active;
    if (!active) {
      iceSlideLastXRef.current = null;
      return undefined;
    }

    const EMIT_INTERVAL = 36;
    // ~px traveled per emit at a strong slide; used to normalize intensity.
    const MAX_DELTA_FOR_FULL_SPEED = 14;
    const fireTrail = () => {
      if (!isIceSlidingRef.current) return;

      const p = penguinRef.current;
      const curX = interpolatedPositionRef.current.x || p.x;
      const curY = interpolatedPositionRef.current.y || p.y;
      const lastX = iceSlideLastXRef.current;
      iceSlideLastXRef.current = curX;
      const dx = lastX == null ? 0 : curX - lastX;
      // Prefer server slide dir; only let X-delta override once we're clearly moving.
      if (
        typeof p.iceSlideDir === "number" &&
        p.iceSlideDir !== 0
      ) {
        iceSlideDirRef.current = Math.sign(p.iceSlideDir);
      } else if (Math.abs(dx) > 0.4) {
        iceSlideDirRef.current = Math.sign(dx);
      }
      const speed = Math.min(
        Math.abs(dx) / MAX_DELTA_FOR_FULL_SPEED,
        1.5
      );

      emitParticles("iceSlideTrail", {
        x: curX,
        y: curY,
        direction: iceSlideDirRef.current || 1,
        facing: p.facing || 1,
        speed: Math.max(speed, 0.35),
        braking: !!p.isBraking || !!predictedState.current?.isBraking,
      });
    };

    fireTrail();
    const id = setInterval(fireTrail, EMIT_INTERVAL);

    return () => clearInterval(id);
  }, [
    penguin.isIceSliding,
    penguin.isDodging,
    penguin.isSlideJumping,
    penguin.iceSlideDir,
    emitParticles,
  ]);

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
      penguin.isAttacking &&
      penguin.attackType === "charged" &&
      !penguin.isPalmThrust &&
      !penguin.chargedAttackHit;
  }, [
    penguin.isAttacking,
    penguin.attackType,
    penguin.isPalmThrust,
    penguin.chargedAttackHit,
  ]);

  // One-shot smoke swoosh at the moment the charged lunge begins (mirrors the
  // dash-start smoke). Transition-guarded so it fires once, not every frame the
  // position updates while lunging.
  const lastChargedLungeState = useRef(false);
  useEffect(() => {
    const isLunging =
      penguin.isAttacking &&
      penguin.attackType === "charged" &&
      !penguin.isPalmThrust &&
      !penguin.chargedAttackHit;
    if (isLunging && !lastChargedLungeState.current) {
      emitParticles("chargedLungeSmoke", {
        x: interpolatedPositionRef.current.x || penguin.x,
        y: penguin.y,
        direction: penguin.facing ?? 1,
      });
    }
    lastChargedLungeState.current = isLunging;
  }, [
    penguin.isAttacking,
    penguin.attackType,
    penguin.isPalmThrust,
    penguin.chargedAttackHit,
    penguin.facing,
    penguin.x,
    penguin.y,
    emitParticles,
  ]);

  useEffect(() => {
    const isLunging =
      penguin.isAttacking &&
      penguin.attackType === "charged" &&
      !penguin.isPalmThrust &&
      !penguin.chargedAttackHit;
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
    penguin.isPalmThrust,
    penguin.chargedAttackHit,
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
    let echoId = null;
    if (wasBeingThrown.current && !penguin.isBeingThrown) {
      const landX = interpolatedPositionRef.current.x || penguin.x;
      if (penguin.isClinchKillThrowVictim) {
        const outsideDohyo = landX <= DOHYO_LEFT_BOUNDARY || landX >= DOHYO_RIGHT_BOUNDARY;
        emitParticles("clinchKillThrowLand", {
          x: landX,
          y: penguin.y,
          behindDohyo: outsideDohyo,
        });
        playSound(chargedHit04, 0.09, null, 0.6, xToPan(landX));
        // Aftershock — server already fired the main kill_throw_land boom;
        // a delayed echo sells the comic "the ground is still ringing" beat.
        echoId = setTimeout(() => {
          addShake("kill_throw_land", { scale: 0.55 });
        }, 95);
      } else {
        emitParticles("throwLand", { x: landX, y: penguin.y });
      }
    }
    wasBeingThrown.current = !!penguin.isBeingThrown;
    return () => {
      if (echoId) clearTimeout(echoId);
    };
  }, [penguin.isBeingThrown, penguin.isClinchKillThrowVictim, penguin.x, penguin.y, emitParticles]);

  // Warm the throw-kill landing pose as soon as the victim flag arms, so the
  // mid-arc hit→landing src swap paints from an already-decoded bitmap instead
  // of flashing a ghost of the previous pose while the new one decodes.
  useEffect(() => {
    if (!penguin.isClinchKillThrowVictim) return;
    const info = getSpriteRenderInfo(
      cinematicThrowKillLandingSprite,
      false,
      false,
      false,
      true,
      false
    );
    if (info?.src) preDecodeImage(info.src);
  }, [penguin.isClinchKillThrowVictim, getSpriteRenderInfo]);

  // FORCE OUT: warm push-defeat as soon as the win type is known (before the
  // delayed idle→defeat swap), so the pose change doesn't decode-flash.
  useEffect(() => {
    if (winType !== "grabPush" || !gameOver) return;
    const info = getSpriteRenderInfo(
      pushDefeatPoseSprite,
      false,
      false,
      false,
      true,
      false
    );
    if (info?.src) preDecodeImage(info.src);
  }, [winType, gameOver, getSpriteRenderInfo]);

  // Rope jump — angled liftoff plume on takeoff, smoke puff on touchdown.
  const prevRopeJumpPhase = useRef(null);
  useEffect(() => {
    // Liftoff: entering the "active" (airborne) phase.
    if (prevRopeJumpPhase.current !== "active" && penguin.ropeJumpPhase === "active") {
      emitParticles("liftoffSmoke", {
        x: interpolatedPositionRef.current.x || penguin.x,
        y: penguin.y,
        tilted: true,
        // facing's sign is opposite to the plume-tilt convention the flap uses
        // (which keys off movement dir), so negate it to mirror correctly.
        dir: -(penguin.facing ?? 1),
        maxLife: 0.4, // rope jump plume plays a bit quicker than the flap's
      });
    }
    if (prevRopeJumpPhase.current === "active" && penguin.ropeJumpPhase === "landing") {
      emitParticles("throwLand", {
        x: interpolatedPositionRef.current.x || penguin.x,
        y: penguin.y,
      });
    }
    prevRopeJumpPhase.current = penguin.ropeJumpPhase;
  }, [penguin.ropeJumpPhase, penguin.facing, penguin.x, penguin.y, emitParticles]);

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

  // Slide-jump liftoff + land. Same tilted-up plume as a directional flap
  // (flapLiftoff untouched). Forward nudge for slide carry; extra lift so the
  // plume sits on sliding.png's crouch (pads sit above the img bottom gutter).
  const prevSlideJumpPhase = useRef(null);
  useEffect(() => {
    const x = interpolatedPositionRef.current.x || penguin.x;
    const y = interpolatedPositionRef.current.y || penguin.y;

    if (
      prevSlideJumpPhase.current !== "flight" &&
      penguin.slideJumpPhase === "flight"
    ) {
      const travelDir = iceSlideDirRef.current || 1;
      emitParticles("liftoffSmoke", {
        x: x + travelDir * 28,
        y,
        tilted: true,
        dir: travelDir,
        lift: 16,
      });
    }

    if (
      prevSlideJumpPhase.current !== "landing" &&
      penguin.slideJumpPhase === "landing"
    ) {
      // Same belly-flop land burst flap uses (edited landing smoke + ice shards).
      if (
        flapFastFallAtLandRef.current ||
        penguin.slideJumpDiveCommitted ||
        penguin.slideJumpFastFalling
      ) {
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
    if (!penguin.isSlideJumping) {
      flapFastFallAtLandRef.current = false;
    }
    prevSlideJumpPhase.current = penguin.slideJumpPhase;
  }, [
    penguin.slideJumpPhase,
    penguin.isSlideJumping,
    penguin.slideJumpDiveCommitted,
    penguin.slideJumpFastFalling,
    penguin.facing,
    penguin.x,
    penguin.y,
    emitParticles,
  ]);

  useEffect(() => {
    const inFlapChargeFlight =
      (penguin.isSlideJumping &&
        penguin.slideJumpPhase === "flight" &&
        penguin.slideJumpHasFlap) ||
      (penguin.isFlapping && penguin.flapPhase === "flight");
    if (inFlapChargeFlight) {
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
    penguin.isSlideJumping,
    penguin.slideJumpPhase,
    penguin.slideJumpHasFlap,
    penguin.flapCharges,
    penguin.x,
    penguin.y,
    penguin.facing,
    isLocalPlayer,
    emitParticles,
  ]);

  // Flap audio — each wing beat (air charge during FLAP-armed slide-jump).
  const prevFlapBeatSound = useRef(0);
  useEffect(() => {
    const inFlapChargeFlight =
      (penguin.isSlideJumping && penguin.slideJumpHasFlap) ||
      penguin.isFlapping;
    if (
      inFlapChargeFlight &&
      penguin.flapWingBeatTime &&
      penguin.flapWingBeatTime !== prevFlapBeatSound.current
    ) {
      const pan = xToPan(penguin.x);
      playSound(attackSound, 0.04, null, 1.0, pan);
      playSound(flapSound, 0.012, null, 1.0, pan);
    }
    prevFlapBeatSound.current = penguin.flapWingBeatTime || 0;
  }, [
    penguin.flapWingBeatTime,
    penguin.isFlapping,
    penguin.isSlideJumping,
    penguin.slideJumpHasFlap,
    penguin.x,
  ]);

  // Fast-fall / belly-flop trail — vertical dive streaks while S is held
  // mid-flight (flap power-up OR slide-jump dive). Interval runs for the whole
  // flight phase; emissions gate on server dive flag OR local S.
  const flapFastFallIntervalRef = useRef(null);
  useEffect(() => {
    const inFlapFlight =
      penguin.isFlapping && penguin.flapPhase === "flight";
    const inSlideJumpFlight =
      penguin.isSlideJumping && penguin.slideJumpPhase === "flight";
    const inFlight = inFlapFlight || inSlideJumpFlight;

    if (inFlight) {
      const EMIT_INTERVAL = 45;
      flapFastFallIntervalRef.current = setInterval(() => {
        const p = penguinRef.current;
        const stillFlap = p?.isFlapping && p.flapPhase === "flight";
        const stillSlide =
          p?.isSlideJumping && p.slideJumpPhase === "flight";
        if (!stillFlap && !stillSlide) {
          clearInterval(flapFastFallIntervalRef.current);
          flapFastFallIntervalRef.current = null;
          return;
        }
        // Same gates flap uses: server fast-fall flag OR local S while airborne.
        const diving =
          p.flapFastFalling ||
          p.slideJumpFastFalling ||
          p.slideJumpDiveCommitted ||
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
        // flapFastFallTrail = speed lines + edited smoke-puff wisps (same as flap).
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
    penguin.isSlideJumping,
    penguin.slideJumpPhase,
    penguin.slideJumpDiveCommitted,
    penguin.slideJumpFastFalling,
    isLocalPlayer,
    emitParticles,
  ]);

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
  // CLINCH BALANCE TELL — strain sweat
  //
  // While clinched with balance in the throwable zone (<=50), sweat
  // droplets flick off the fighter on an interval; below the kill
  // threshold (<15) the spray gets denser/faster and the sprite also
  // picks up the red danger rim (getFighterPopFilter). Zone crossings
  // are in discreteStateChanged, so `penguin.balance` here is always
  // fresh at the boundaries that matter.
  // ─────────────────────────────────────────────────────────────────
  const balanceZone = !penguin.inClinch
    ? 0
    : (penguin.balance ?? 100) < 15
    ? 2
    : (penguin.balance ?? 100) <= 50
    ? 1
    : 0;
  useEffect(() => {
    if (balanceZone === 0 || penguin.isDead || gameOver) return;
    const danger = balanceZone === 2;
    const fire = () => {
      const pos = interpolatedPositionRef.current;
      emitParticles("clinchStrainSweat", {
        x: pos?.x ?? penguin.x,
        y: pos?.y ?? penguin.y,
        facing: penguin.facing ?? 1,
        intensity: danger ? 1 : 0.45,
      });
    };
    fire();
    const id = setInterval(fire, danger ? 240 : 520);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceZone, penguin.isDead, gameOver, emitParticles]);

  // Arm clamp (counter-grab) — magenta crackle burst on the victim when the
  // clamp connects, then a smaller sustained zap while it holds. Uses the
  // clamped-effect sprite sheet; matches the countergrab pink/purple theme.
  const prevArmClamped = useRef(false);
  useEffect(() => {
    if (penguin.isArmClamped && !prevArmClamped.current) {
      const pos = interpolatedPositionRef.current;
      emitParticles("clampCrackle", {
        x: pos?.x ?? penguin.x,
        y: pos?.y ?? penguin.y,
        scale: 1.05,
      });
    }
    prevArmClamped.current = !!penguin.isArmClamped;
    if (!penguin.isArmClamped) return;
    const id = setInterval(() => {
      const pos = interpolatedPositionRef.current;
      emitParticles("clampCrackle", {
        x: pos?.x ?? penguin.x,
        y: pos?.y ?? penguin.y,
        scale: 0.5,
        alpha: 0.85,
      });
    }, 340);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penguin.isArmClamped, emitParticles]);

  // Failed clinch throw/pull — weight-drop dust at the attacker's feet on the
  // stagger's rising edge, matching the clinchFailStumble squash.
  const prevFailStagger = useRef(false);
  useEffect(() => {
    if (penguin.clinchThrowFailStagger && !prevFailStagger.current) {
      const pos = interpolatedPositionRef.current;
      emitParticles("sidestepLand", {
        x: pos?.x ?? penguin.x,
        y: pos?.y ?? penguin.y,
      });
    }
    prevFailStagger.current = !!penguin.clinchThrowFailStagger;
  }, [penguin.clinchThrowFailStagger, emitParticles]);

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
        // Pocket-range: shrink the force cone so it doesn't bloom through both
        // bodies. Tip-range keeps the full shove read.
        const opp =
          index === 0
            ? allPlayersDataRef.current?.player2
            : allPlayersDataRef.current?.player1;
        const oppX = typeof opp?.x === "number" ? opp.x : null;
        const spacing = oppX == null ? 999 : Math.abs(px - oppX);
        // ~pushbox floor ≈ 110; palm connect ≈ 136 @ default size.
        const pocketScale =
          spacing < 125 ? 0.55 + Math.max(0, spacing - 95) * 0.015 : 1;
        emitParticles("palmThrust", {
          x: px + 70 + facingOffsetPx,
          y: PLAYER_MID_Y,
          dir: -facing,
          owner: penguin.id,
          scale: Math.min(1, Math.max(0.5, pocketScale)),
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

  // MATADOR activation — cloth/air whoosh + gold AP-style plumes.
  // Plumes stay up through success/pull; only clear when the whole beat ends.
  const lastMatadorState = useRef(false);
  const matadorPlumeActive =
    !!penguin.isMatadorParrying || !!penguin.isMatadorSuccess;
  useEffect(() => {
    if (penguin.isMatadorParrying && !lastMatadorState.current) {
      playSound(dodgeSound, 0.028, null, 1.35);
      playSound(palmThrustWhiffSound, 0.018, null, 1.45);
      emitParticles("matadorActivation", {
        x: penguin.x,
        y: penguin.y,
        facing: penguin.facing,
      });
    }
    if (!matadorPlumeActive && lastMatadorState.current) {
      clearMatadorGoldHold();
    }
    lastMatadorState.current = matadorPlumeActive;
  }, [
    penguin.isMatadorParrying,
    matadorPlumeActive,
    penguin.x,
    penguin.y,
    penguin.facing,
    emitParticles,
    clearMatadorGoldHold,
  ]);

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

  // MATADOR plumes continue through the pull (parry window + success).
  const matadorStanceIntervalRef = useRef(null);
  const isMatadorRef = useRef(false);
  useEffect(() => {
    isMatadorRef.current =
      !!penguin.isMatadorParrying || !!penguin.isMatadorSuccess;

    if (isMatadorRef.current && !matadorStanceIntervalRef.current) {
      matadorStanceIntervalRef.current = setInterval(() => {
        if (!isMatadorRef.current) return;
        const curX = interpolatedPositionRef.current.x || penguin.x;
        emitParticles("matadorStance", {
          x: curX,
          y: penguin.y,
          facing: penguin.facing,
          intensity: 0.85,
        });
      }, 90);
    }

    if (!isMatadorRef.current && matadorStanceIntervalRef.current) {
      clearInterval(matadorStanceIntervalRef.current);
      matadorStanceIntervalRef.current = null;
    }

    return () => {
      if (matadorStanceIntervalRef.current) {
        clearInterval(matadorStanceIntervalRef.current);
        matadorStanceIntervalRef.current = null;
      }
    };
  }, [
    penguin.isMatadorParrying,
    penguin.isMatadorSuccess,
    penguin.x,
    penguin.y,
    penguin.facing,
    emitParticles,
  ]);

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
      emitParticles("perfectParryLandSmoke", {
        x: penguin.x,
        y: penguin.y,
      });
      emitParticles("perfectParrySparkBurst", {
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

  // Stun stars: raw-parry stun OR clinch Open / punishable recovery.
  // Mutual throw/pull tumble sets clinchOpenHideStars — separation already
  // sells that lockout, so no stars there.
  const clinchVulnerable = !!(
    penguin.isClinchOpen ||
    penguin.clinchThrowFailStagger ||
    penguin.clinchJoltRecovery
  );
  const clinchStarsOk = clinchVulnerable && !penguin.clinchOpenHideStars;
  useEffect(() => {
    const shouldShowStars = !!(penguin.isRawParryStun || clinchStarsOk);
    if (shouldShowStars !== showStarStunEffect) {
      setShowStarStunEffect(shouldShowStars);
    }
  }, [
    penguin.isRawParryStun,
    clinchStarsOk,
    showStarStunEffect,
  ]);

  const starStunVariant = clinchStarsOk
    ? penguin.id === localId
      ? "self"
      : "foe"
    : "parry";

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

  // VICTIM HITSTOP JUDDER — Smash-style impact vibration. Armed on player_hit
  // when THIS fighter is the victim; the interpolation loop's hitstop branch
  // (the only code running mid-freeze) draws it by jittering the pinned sprite
  // a few px around its frozen position. Purely visual: positions are restored
  // by the normal write path the frame the freeze ends. This is what breaks the
  // "both statues, then both glide" symmetry — the victim's body VIBRATES from
  // the hit while the attacker holds firm.
  const hitJudderRef = useRef({ armedUntil: 0, amp: 0, frame: 0 });

  // PROCEDURAL ANIMATION — per-hit reaction grading + attacker recoil.
  // impactAmp feeds the --impact-amp CSS var (fighterStyledComponents): the
  // hitSquash-family keyframes multiply their deformation by it, so a counter
  // charged slam visibly crumples the victim while a poke barely dents them.
  // Before this, every hit played the exact same fixed squash — one of the
  // big "hits feel like stickers" tells. attackerRecoil briefly swaps the
  // ATTACKER's animation to a backward contact jolt when their strike lands
  // (impact resistance — the target has mass).
  const [impactAmp, setImpactAmp] = useState(1);
  const [attackerRecoil, setAttackerRecoil] = useState(false);
  const attackerRecoilTimeoutRef = useRef(null);
  // Afterimage ghost throttle (rAF-loop spawner) — see the knockback ghost
  // block in the interpolation loop.
  const lastGhostAtRef = useRef(0);


  // Tracks the cinematic-kill smoke-trail rAF so it can be cancelled on unmount
  // / round change (the trail is a distance-based rAF loop, not a setInterval).
  const cinematicTrailRafRef = useRef(null);
  // Same pattern for clinch kill-throw descent smoke.
  const killThrowTrailRafRef = useRef(null);

  // Add screen shake, thick blubber absorption, and danger zone event listeners
  // MEMORY FIX: Track timeouts so we can clear them on unmount (prevents setState after unmount)
  useEffect(() => {
    const pendingTimeouts = [];

    const handleRingOut = () => {
      addShake("ring_out");
    };
    socket.on("ring_out", handleRingOut);

    const handleCinematicKill = (data) => {
      // AP slap-down KILL: reuses the charged cinematic CAMERA beat (zoom +
      // screen-darken, via useCamera + Game.jsx) but the victim belly-slides
      // through the parrier (pull tween), NOT a charged fly-out. So skip the
      // charged flight VFX (orange impact spark, charged SFX, launch sounds,
      // smoke trail) — the blue AP burst + slap-parry clang play via
      // raw_parry_success instead.
      const isApPullKill = !!data.apPullKill;
      if (index === 0) {
        if (!isApPullKill) {
          emitParticles("cinematicKillImpact", {
            x: data.impactX,
            y: data.victimY,
          });

          playSound(pickRandomSound(chargedHitSounds), 0.07, null, 0.55, xToPan(data.impactX));
        }

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

        if (!isApPullKill) {
          const launchDelay = data.hitstopMs || 550;
          const launchSoundId = setTimeout(() => {
            playSound(chargeAttackLaunchSound, 0.2, null, 1.5, xToPan(data.victimX));
            playSound(gunLaunchSound, 0.06, null, 1.0, xToPan(data.victimX));
          }, launchDelay);
          pendingTimeouts.push(launchSoundId);
        }
      }

      if (player.id === data.attackerId) {
        setIsCinematicKillAttacker(true);
        const clearId = setTimeout(() => {
          setIsCinematicKillAttacker(false);
        }, (data.hitstopMs || 550) + 200);
        pendingTimeouts.push(clearId);
      }

      const isVictim = player.id === data.victimId;
      if (isVictim && !isApPullKill) {
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
      const midX =
        typeof data.contactX === "number"
          ? data.contactX
          : (data.jolterX + data.targetX) / 2;
      const pushDir = data.jolterX < data.targetX ? 1 : -1;
      // Mutual: dead center (clinch attach seam). Single: nudge toward target chest.
      const chestOffset =
        isMutual || typeof data.contactX === "number"
          ? 0
          : (data.targetX - midX) * 0.6;
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

      // Descent smoke trail — distance-based rAF (same gap-proof pattern as
      // cinematicKillTrail). Starts after launch, denser spacing on the way down.
      if (killThrowTrailRafRef.current) {
        cancelAnimationFrame(killThrowTrailRafRef.current);
        killThrowTrailRafRef.current = null;
      }
      const throwDir = data.throwDir || penguin.facing || 1;
      const trailDuration = Math.max(900, (data.durationMs || 1700) + 80);
      const SPACING = 28;
      const MAX_FILL = 6;
      const trailStartId = setTimeout(() => {
        const startedAt = performance.now();
        let last = null;
        const step = (now) => {
          if (now - startedAt > trailDuration) {
            killThrowTrailRafRef.current = null;
            return;
          }
          const pos = interpolatedPositionRef.current;
          if (pos && typeof pos.x === "number") {
            const py = pos.y ?? 290;
            if (!last) {
              last = { x: pos.x, y: py };
              emitParticles("clinchKillThrowTrail", {
                x: last.x,
                y: last.y,
                direction: throwDir,
                ascending: true,
              });
            } else {
              let dx = pos.x - last.x;
              let dy = py - last.y;
              let dist = Math.hypot(dx, dy);
              let fills = 0;
              while (dist >= SPACING && fills < MAX_FILL) {
                const t = SPACING / dist;
                const nextY = last.y + dy * t;
                const segAscending = nextY > last.y + 0.5;
                last = { x: last.x + dx * t, y: nextY };
                emitParticles("clinchKillThrowTrail", {
                  x: last.x,
                  y: last.y,
                  direction: throwDir,
                  ascending: segAscending,
                });
                dx = pos.x - last.x;
                dy = py - last.y;
                dist = Math.hypot(dx, dy);
                fills++;
              }
              if (fills >= MAX_FILL) last = { x: pos.x, y: py };
            }
          }
          killThrowTrailRafRef.current = requestAnimationFrame(step);
        };
        killThrowTrailRafRef.current = requestAnimationFrame(step);
      }, hitstopDelay);
      pendingTimeouts.push(trailStartId);
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
    // the grab armor. Anchored on the charged hit-spark contact seam (same
    // +70 + facing nudge SlapHitSpriteEffect uses for charged) so the
    // shards erupt FROM the impact spark, not the body center. Gated to
    // the defender's component for consistency with the absorb.
    const handleGrabArmorBreak = (data) => {
      if (typeof data?.x !== "number") return;
      if (data.defenderId !== penguin.id) return;
      const breakFacing = data.facing || 1;
      // Prefer server tip-seam; fall back to charged HIT_FX offsets.
      const facingOffsetPx = (-5.5 + breakFacing * -1.0) * 12.8;
      const fxX =
        typeof data.contactX === "number"
          ? data.contactX
          : data.x + 70 + facingOffsetPx;
      emitParticles("grabArmorBreak", {
        x: fxX,
        y: HIT_EFFECT_Y,
        facing: breakFacing,
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
      if (killThrowTrailRafRef.current) {
        cancelAnimationFrame(killThrowTrailRafRef.current);
        killThrowTrailRafRef.current = null;
      }
      // Safety net: if this effect tears down mid-cinematic (unmount / round
      // change) the scheduled unfreeze timeout above is cleared, so make sure
      // the engine never gets stranded in its frozen state.
      if (index === 0) setFrozen(false);
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
      stopBattleMusic(true);
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

  // Kill-throw landing pose: after peaking, swap early (near ground) so the
  // flat KO art finishes the fall instead of hard-cutting on impact.
  if (!penguin.isClinchKillThrowVictim) {
    killThrowAirbornePeakRef.current = false;
  } else if (displayPosition.y > SHADOW_GROUND_LEVEL + KILL_THROW_PEAK_ARM_PX) {
    killThrowAirbornePeakRef.current = true;
  }
  const showClinchKillThrowLanding =
    !!penguin.isClinchKillThrowVictim &&
    (!penguin.isBeingThrown ||
      (killThrowAirbornePeakRef.current &&
        displayPosition.y <= SHADOW_GROUND_LEVEL + KILL_THROW_LANDING_EARLY_PX));
  killThrowShowLandingRef.current = showClinchKillThrowLanding;

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

  // Slide-jump: flap wing art while airborne; dodge pose on S butt-slam dive.
  // FLAP-armed jumps also wing-beat on charge spends (same flapFrame timing).
  const slideJumpUseDodgePose =
    !!penguin.isSlideJumping &&
    penguin.slideJumpPhase === "flight" &&
    (!!penguin.slideJumpDiveCommitted ||
      !!penguin.slideJumpFastFalling ||
      (isLocalPlayer && !!getLocalKeyState()?.s));
  const slideJumpFlapFrame =
    penguin.slideJumpHasFlap &&
    flapBeatRef.current.startedAt &&
    performance.now() - flapBeatRef.current.startedAt < FLAP_WINGBEAT_MS
      ? 2
      : 1;

  // OPEN-PALM THRUST frame. Anchor a local clock when a thrust begins, then
  // advance startup → smear → active → recovery off elapsed ms. We anchor on
  // each new palmThrustFxId (a per-executed-thrust server counter) as well as
  // the rising edge, so buffered back-to-back thrusts — where isPalmThrust
  // never drops between reps — still replay the full sequence. Ref mutated
  // during render, same pattern as the flap/idle-hold refs.
  if (displayPenguin.isPalmThrust) {
    const fxId = penguin.palmThrustFxId || 0;
    if (
      !palmThrustAnimRef.current.startedAt ||
      fxId !== palmThrustAnimRef.current.fxId
    ) {
      palmThrustAnimRef.current.startedAt = performance.now();
      palmThrustAnimRef.current.fxId = fxId;
      palmThrustAnimRef.current.frozenAccum = 0;
      palmThrustAnimRef.current.freezeStart = 0;
      palmThrustAnimRef.current.freezeEnd = 0;
    }
  } else if (palmThrustAnimRef.current.startedAt) {
    palmThrustAnimRef.current.startedAt = 0;
  }
  let palmThrustFrame = 2;
  if (displayPenguin.isPalmThrust && palmThrustAnimRef.current.startedAt) {
    // Hitstop-aware: the strike frame holds through the on-hit freeze instead of
    // the clock silently advancing past ACTIVE_END while the game is frozen.
    const elapsed = computeAnimElapsed(palmThrustAnimRef.current, performance.now());
    if (elapsed < PALM_THRUST_ANIM.STARTUP_END) palmThrustFrame = 0;
    else if (elapsed < PALM_THRUST_ANIM.SMEAR_END) palmThrustFrame = 1;
    else if (elapsed < PALM_THRUST_ANIM.ACTIVE_END) palmThrustFrame = 2;
    else palmThrustFrame = 3;
  }

  // SLAP frame. Same render-anchored, hitstop-aware model as palm thrust.
  // Anchor on the isSlapAttack rising edge AND on slapAnimation change
  // (consecutive slaps always differ — toggle 1↔2), so a back-to-back
  // slap1→slap2 (where isSlapAttack never drops) still replays frame 0.
  const inSlapPhaseAnim = displayPenguin.isSlapAttack;
  if (inSlapPhaseAnim) {
    const animId = displayPenguin.slapAnimation || 0;
    if (!slapAnimRef.current.startedAt || animId !== slapAnimRef.current.anim) {
      slapAnimRef.current.startedAt = performance.now();
      slapAnimRef.current.anim = animId;
      slapAnimRef.current.frozenAccum = 0;
      slapAnimRef.current.freezeStart = 0;
      slapAnimRef.current.freezeEnd = 0;
    }
  } else if (slapAnimRef.current.startedAt) {
    slapAnimRef.current.startedAt = 0;
    slapAnimRef.current.anim = 0;
  }
  let slapFrame = 2;
  if (inSlapPhaseAnim && slapAnimRef.current.startedAt) {
    const elapsed = computeAnimElapsed(slapAnimRef.current, performance.now());
    if (elapsed < SLAP_ANIM.WINDUP_END) slapFrame = 0; // windup (ready stance)
    else if (elapsed < SLAP_ANIM.HIT_POSE_START) slapFrame = 1; // smear
    else if (elapsed < SLAP_ANIM.HIT_END) slapFrame = 2; // hit (strike, held)
    else slapFrame = 3; // recovery — settle back to the ready stance (not idle)
  }
  // Raw parry SUCCESS pose director — see rawParrySuccessVisualRef.
  const nowSuccessMs = performance.now();
  const successVisual = rawParrySuccessVisualRef.current;
  const serverRawParrySuccess =
    !!penguin.isRawParrySuccess || !!penguin.isPerfectRawParrySuccess;
  // Rising edge backup (snowball / paths that omit raw_parry_success, or
  // state arriving before the socket). Socket path stamps parryId + chain.
  if (serverRawParrySuccess && !successVisual.lastServerSuccess) {
    beginRawParrySuccessVisual(nowSuccessMs, null, 1);
  }
  successVisual.lastServerSuccess = serverRawParrySuccess;
  // Extend hold if hitstop grew after we stamped (packet order race).
  if (successVisual.until > nowSuccessMs) {
    const hs = getDisplayHitstopUntil();
    if (hs > nowSuccessMs) {
      successVisual.until = Math.max(
        successVisual.until,
        hs + RAW_PARRY_SUCCESS_ANIM.POST_HITSTOP_HOLD_MS
      );
    }
  }
  const inRawParrySuccessAnim =
    serverRawParrySuccess || nowSuccessMs < successVisual.until;
  let rawParrySuccessFrame = 2;
  if (inRawParrySuccessAnim && successVisual.startedAt) {
    rawParrySuccessFrame = resolveRawParrySuccessFrame(
      successVisual,
      nowSuccessMs - successVisual.startedAt
    );
  }

  // AP whiff pose: server flag OR local Space-up predict (cleared on land /
  // when server whiff ends so we don't overhold past authority).
  const whiffPredict = apWhiffPredictRef.current;
  if (serverRawParrySuccess || inRawParrySuccessAnim) {
    whiffPredict.until = 0;
    whiffPredict.sawServerWhiff = false;
  }
  const serverApWhiff =
    !!penguin.isApWhiffRecovering || !!penguin.isMatadorWhiffRecovering;
  if (serverApWhiff) whiffPredict.sawServerWhiff = true;
  else if (whiffPredict.sawServerWhiff) {
    whiffPredict.until = 0;
    whiffPredict.sawServerWhiff = false;
  }
  const showApWhiff =
    serverApWhiff || nowSuccessMs < whiffPredict.until;

  // Anchor the dash clock on the rising edge of the predicted dodge (same
  // render-anchored pattern as the palm-thrust/flap clocks). Driving the phase
  // off ONE predicted source removes the previous flicker where the server's
  // isDodgeStartup arrived out of sync with the predicted isDodging and the
  // jump pose/arc dropped frames or restarted mid-air.
  if (displayPenguin.isDodging) {
    if (!dodgeVisualRef.current.active) {
      dodgeVisualRef.current.startedAt = performance.now();
      dodgeVisualRef.current.active = true;
    }
  } else {
    dodgeVisualRef.current.active = false;
  }
  const inDashWindup =
    displayPenguin.isDodging &&
    performance.now() - dodgeVisualRef.current.startedAt < DASH_WINDUP_MS;

  const rawSpriteSrc = getImageSrc(
    penguin.fighter,
    penguin.isDiving,
    penguin.isJumping,
    displayPenguin.isAttacking,
    displayPenguin.isDodging,
    penguin.isStrafing,
    // Attempt stance = AP blocking.png. Success uses the pull pose below.
    displayPenguin.isRawParrying || displayPenguin.isMatadorParrying,
    penguin.isGrabBreaking,
    penguin.isReady,
    readyIntroComplete,
    // Keep hit pose through air-hit dump — stun can end mid-air while
    // isHitFalling is still true; dropping to idle remounts the <img> (ghost).
    penguin.isHit || penguin.isHitFalling,
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
    // Local visual hold keeps the deflect pose even after flurry re-tap clears
    // server success flags (same sprites for regular/perfect).
    inRawParrySuccessAnim && !penguin.isPerfectRawParrySuccess,
    !!penguin.isPerfectRawParrySuccess && inRawParrySuccessAnim,
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
    // MATADOR success = pull yank pose (not AP success frames).
    penguin.isAttemptingPull || !!penguin.isMatadorSuccess,
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
    penguin.isClinchClashing,
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
    displayPenguin.isPalmThrust,
    palmThrustFrame,
    displayPenguin.isLowKick,
    // Aerial hit+spin only while thrown AND not yet in the early-landing window.
    penguin.isBeingThrown && !showClinchKillThrowLanding,
    slapFrame,
    // True block floor only — not the live parry window (see getImageSrc).
    !!penguin.isGuarding,
    guardBlockSuccess,
    rawParrySuccessFrame,
    showApWhiff,
    !!penguin.isIceSliding,
    !!penguin.isIceSlideReverseHopping,
    !!penguin.isSlideJumping,
    penguin.slideJumpPhase,
    slideJumpUseDodgePose,
    slideJumpFlapFrame,
    !!penguin.isGrabPushDefeat
  );

  // Dash frames: the dodge now has real anticipation + landing poses.
  // getImageSrc returns the tucked `dodging` pose for the whole dodge; here we
  // swap in the braced `recovering` pose for the brief startup windup, and again
  // for the post-hop landing settle (justLandedFromDodge), so the jump gets the
  // bookend frames that sell its weight. Landing only overrides an idle (pumo)
  // frame so it never stomps an action buffered out of the (0ms) recovery, nor
  // the power-slide crouch pose.
  const displaySpriteSrc = inDashWindup
    ? recovering
    : penguin.justLandedFromDodge && rawSpriteSrc === pumo
    ? recovering
    : rawSpriteSrc;

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
  const inHitVisual = penguin.isHit || penguin.isHitFalling;
  if (!inHitVisual) {
    hitTintUntilRef.current = 0;
    hitFlashUntilRef.current = 0;
  }
  const showHitTintThisFrame =
    inHitVisual && renderNowMs < hitTintUntilRef.current;
  const showHitFlashThisFrame =
    inHitVisual && renderNowMs < hitFlashUntilRef.current;
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
  renderedHitVisualsRef.current.dashAnim =
    displayPenguin.isDodging || penguin.justLandedFromDodge;
  // FLAP / slide-jump wing-beat: when this render committed the down-stroke
  // (flap2), the rAF loop forces the flip back to flap1 once the beat window
  // expires — unless we're in the dodge/dive pose. Slide-jump charges reuse
  // the same flapBeatRef timing but previously never armed this flag, so
  // flap2 could stick until an unrelated discrete update (felt like cache).
  renderedHitVisualsRef.current.flapBeat =
    (!flapUseDodgePose && flapFrame === 2) ||
    (!!penguin.isSlideJumping &&
      !slideJumpUseDodgePose &&
      slideJumpFlapFrame === 2);
  // OPEN-PALM THRUST: keep re-rendering while the animation hasn't reached its
  // terminal recovery frame (3) so startup → smear → active advance on their
  // ms boundaries. Frame 3 is a static hold, so it needs no further forcing.
  renderedHitVisualsRef.current.palmThrustAnim =
    displayPenguin.isPalmThrust && palmThrustFrame < 3;
  // SLAP: keep re-rendering while windup → hit are still advancing on their
  // ms boundaries (slapFrame < 3). Frame 3 (recovery / settle-back) is the terminal
  // static hold, so no further forcing is needed — the isSlapAttack drop (→ idle)
  // or the next slap's slapAnimation change triggers the re-render on its own.
  renderedHitVisualsRef.current.slapAnim = inSlapPhaseAnim && slapFrame < 3;
  // RAW PARRY SUCCESS: keep ticking through the local visual hold so
  // block→f1→f2 advances and the pose clears when `until` expires (even if
  // server flags already dropped for a flurry re-tap). Mid-hitstop swaps also
  // use the freeze branch above.
  renderedHitVisualsRef.current.rawParrySuccessAnim =
    nowSuccessMs < successVisual.until;
  // Local Space-up whiff predict (before/without server flag) — tick until expiry.
  renderedHitVisualsRef.current.apWhiffPredict =
    !serverApWhiff && nowSuccessMs < whiffPredict.until;
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
  // Thick Blubber no longer tints the body purple. The absorb is communicated
  // entirely by the pink "wrap ring" VFX (see grab_armor_absorb handler), so
  // this is kept as a constant `false` — the shared sprite-recolor pipeline
  // below is untouched.
  const useBlubberTint = false;

  // Toppers composite onto bald underlays when available (knot baked out).
  // Overlay lookup below still keys off the haired pose URL.
  const fighterGearIds = Array.isArray(penguin.gearIds) ? penguin.gearIds : [];
  const headGearId = getEquippedHeadGearId(fighterGearIds);
  const bodyForRender = headGearId
    ? resolveBodyForHeadGear(effectiveSpriteSrc, fighterGearIds)
    : effectiveSpriteSrc;

  // Hit react MUST stay on the static <StyledImage> path. `hit` has a
  // spritesheet, so the default path mounts <AnimatedFighterImage>; when
  // stun/air-dump ends we switch to idle on <StyledImage> — that component
  // swap remounts and decodes → classic one-frame ghost. Air-hit fall made
  // this constant (isHit clears mid-air, then isHitFalling → idle on land).
  // forceStatic keeps hit.png on the same element as surrounding poses; white
  // flash / red tint still apply. (Kill victims already forceStatic.)
  const forceHitStatic =
    penguin.isHit ||
    penguin.isHitFalling ||
    effectiveSpriteSrc === hitSprite;

  // Get sprite render info (handles animated spritesheets and recoloring).
  // `renderHitTint` (NOT raw showHitTintThisFrame) is passed for the red tint
  // arg so the white impact flash visually takes priority during its 4-frame
  // window. `showHitFlashThisFrame` is passed as the isWhiteFlash arg.
  const spriteRenderInfo = getSpriteRenderInfo(
    bodyForRender,
    renderHitTint,
    showHitFlashThisFrame,
    useBlubberTint,
    forceHitStatic,
    useArmorTint
  );
  const isKillVictim = penguin.isClinchKillThrowVictim || penguin.isClinchKillPullVictim;

  // Kill victims use a static image (forceStatic bypasses the spritesheet lookup
  // that would return a 3-frame strip, while still applying recoloring). The white
  // impact flash still applies here — being on the receiving end of a cinematic
  // kill is exactly when a sharp impact-snap reads strongest.
  //   • Throw kill (high air) → hit pose + CSS spin during the crash arc.
  //   • Throw kill (near ground / landed) → flat landing art finishes the fall.
  //   • Pull kill  → belly-laying pose: eyes open during the slide, eyes closed
  //     once the bow phase starts.
  const killVictimSprite = penguin.isClinchKillPullVictim
    ? penguin.isBowing
      ? bellyLayingSprite
      : bellyLayingEyesOpenSprite
    : showClinchKillThrowLanding
    ? cinematicThrowKillLandingSprite
    : hitSprite;
  const {
    src: recoloredSpriteSrc,
    isAnimated: isAnimatedSprite,
    config: spriteConfig,
  } = isKillVictim
    ? getSpriteRenderInfo(killVictimSprite, renderHitTint, showHitFlashThisFrame, useBlubberTint, true, useArmorTint)
    : spriteRenderInfo;

  // GHOST-FRAME / INTERACTION-HITCH FIX:
  // Key the fighter <img> on a tint-independent identity, NOT the recolored
  // blob URL (tint toggles used to remount every flash). For ANIMATED sheets,
  // key the sheet so loop restarts only when the sheet changes. For STATIC
  // poses, use ONE stable key for the whole fighter — static pose swaps have
  // no spritesheet loop to restart, and pose-keyed remounts were the main
  // remaining ghost source (slide-jump → hit → idle, slap frames, flap wings,
  // hat composite URL changes). In-place `src` updates keep the last decoded
  // frame painted until the next src decodes (no blank).
  const baseSpriteSrc = spriteConfig
    ? penguin.isClinchKillThrowVictim
      ? "clinch-kill-throw-victim"
      : displayPenguin.isDodging || penguin.justLandedFromDodge
      ? "dash-anim"
      : spriteConfig.spritesheet
    : // All static combat poses share one element (incl. forceStatic hit).
      "static-fighter";

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

  // ── Grab / clinch ARM overlay ──────────────────────────────────────────────
  // The grabbing.png and clinch-planting.png bodies are now armless; the arm is
  // a separate, pre-aligned 960×960 image stacked on top so two locked penguins'
  // arms visibly overlap. Any state that resolves to one of those two bodies
  // (grabber, clinch-pusher, grabbed-with-grip, belly-flop, force-out, etc.)
  // gets the arm — matching whatever the body is currently showing.
  const showGrabArm =
    !isKillVictim &&
    (effectiveSpriteSrc === grabbingSprite ||
      effectiveSpriteSrc === clinchPlantingSprite);
  // Recolor the arm through the SAME pipeline as the body (baked file first,
  // then cache, then live recolor) with the SAME tint flags, so it always
  // matches the penguin's colors and flashes/tints in lockstep with the body.
  const recoloredArmSrc = showGrabArm
    ? getSpriteRenderInfo(
        beltGrabArmSprite,
        renderHitTint,
        showHitFlashThisFrame,
        useBlubberTint,
        false,
        useArmorTint
      ).src
    : null;
  // Facing decides which arm wins the overlap: the two locked penguins always
  // face opposite directions, so exactly one has facing===1. Both arms sit above
  // either body (bodies are ≤ 99 during a grab); the +1 puts the facing===1
  // penguin's arm on top of the other's.
  const grabArmZ = (penguin.facing ?? -1) === 1 ? 106 : 105;
  // Plant / body-hold poses angle the armless body such that the pre-aligned
  // belt arm lands on the white belly — nudge BACK (local +X, symmetric across
  // facing) so the flipper sits on the dark torso. Belt (M2) grabbing pose
  // stays at 0. +X = back, +Y = down.
  const GRAB_ARM_PLANT_NUDGE_X_PCT = 7.5; // back (plant body angles arm onto belly)
  const GRAB_ARM_PLANT_NUDGE_Y_PCT = 2; // down
  const GRAB_ARM_BODY_HOLD_NUDGE_X_PCT = 4.5; // back off white belly
  const GRAB_ARM_BODY_HOLD_NUDGE_Y_PCT = 0.75;
  const isPlantingArm = effectiveSpriteSrc === clinchPlantingSprite;
  const renderLocalM2 = !!getLocalKeyState()?.mouse2;
  const localBeltHold =
    isLocalPlayer &&
    penguin.inClinch &&
    !penguin.isArmClamped &&
    renderLocalM2;
  const armOnBelt =
    !!penguin.isClinchBeltHolding ||
    localBeltHold ||
    !!penguin.isAttemptingGrabThrow ||
    !!penguin.isAttemptingPull;
  let grabArmNudgeXPct = 0;
  let grabArmNudgeYPct = 0;
  if (isPlantingArm) {
    grabArmNudgeXPct = GRAB_ARM_PLANT_NUDGE_X_PCT;
    grabArmNudgeYPct = GRAB_ARM_PLANT_NUDGE_Y_PCT;
  } else if (penguin.inClinch && !armOnBelt) {
    grabArmNudgeXPct = GRAB_ARM_BODY_HOLD_NUDGE_X_PCT;
    grabArmNudgeYPct = GRAB_ARM_BODY_HOLD_NUDGE_Y_PCT;
  }

  // Clinch arm overlay uses shoulder-pivot rotate driven by CSS var
  // --grab-arm-body-hold-deg (written per-frame in the rAF loop).
  const grabArmBodyHoldActive = showGrabArm && penguin.inClinch;

  // ── Equipped top hat (composited into body — NOT a second animated layer) ─
  // Ice slide / brake / breathe apply CSS transforms to the fighter <img>.
  // Baking the hat onto the recolored (bald) body keeps motion glued to the head.
  // Only newer pose art has overlays; old sheets (waddle, ritual, salt…) skip.
  //
  // Phase 2: prefer build-time flattened toppers (resolveHattedSpriteSync).
  // Runtime compose is fallback for custom colors / tint flashes not in bake.
  const hatOverlaySrc =
    !isKillVictim && !isAnimatedSprite && headGearId
      ? resolveHatOverlaySrcSync(
          getHatOverlayForSprite(effectiveSpriteSrc, headGearId),
          headGearId,
          targetColor,
        )
      : null;
  const hatUnderBody = !!(headGearId && isHeadGearUnderBody(headGearId));
  const hatTint = tintFromFlags({
    hitTintRed: !!renderHitTint,
    chargeTintWhite: !!showHitFlashThisFrame,
    blubberTintPurple: !!useBlubberTint,
    armorTintPink: !!useArmorTint,
  });

  const hatPairKey =
    headGearId && recoloredSpriteSrc
      ? `${recoloredSpriteSrc}||${headGearId}||${hatTint}||${hatUnderBody ? "under" : "over"}`
      : null;
  const cachedHatted =
    headGearId && (recoloredSpriteSrc || bodyForRender)
      ? resolveHattedSpriteSync({
          baseSrc: recoloredSpriteSrc,
          bakeSourceUrl: bodyForRender,
          overlaySrc: hatOverlaySrc,
          underBody: hatUnderBody,
          gearId: headGearId,
          mawashiColor: targetColor,
          bodyColor: playerBodyColor,
          tint: hatTint,
        })
      : null;

  useEffect(() => {
    if (!headGearId || !recoloredSpriteSrc) {
      setHattedBodySrc(null);
      setHattedPairKey(null);
      return undefined;
    }
    const pairKey = `${recoloredSpriteSrc}||${headGearId}||${hatTint}||${hatUnderBody ? "under" : "over"}`;
    const ready = resolveHattedSpriteSync({
      baseSrc: recoloredSpriteSrc,
      bakeSourceUrl: bodyForRender,
      overlaySrc: hatOverlaySrc,
      underBody: hatUnderBody,
      gearId: headGearId,
      mawashiColor: targetColor,
      bodyColor: playerBodyColor,
      tint: hatTint,
    });
    if (ready) {
      setHattedBodySrc(ready);
      setHattedPairKey(pairKey);
      return undefined;
    }
    if (!hatOverlaySrc) return undefined;
    let cancelled = false;
    // Custom-color / tint-flash recovery only when bake missed.
    compositeHatOntoSprite(recoloredSpriteSrc, hatOverlaySrc, hatUnderBody)
      .then(async (url) => {
        const ok = await preDecodeImage(url);
        if (!cancelled && ok !== false) {
          setHattedBodySrc(url);
          setHattedPairKey(pairKey);
        }
      })
      .catch(() => {
        getPerfRecorder().count("hat.asyncCompositeError");
      });
    return () => {
      cancelled = true;
    };
  }, [
    headGearId,
    hatOverlaySrc,
    recoloredSpriteSrc,
    bodyForRender,
    hatUnderBody,
    hatTint,
    targetColor,
    playerBodyColor,
  ]);

  const validHatted =
    cachedHatted ||
    (hatPairKey && hattedPairKey === hatPairKey ? hattedBodySrc : null);
  const staticBodySrc = validHatted || recoloredSpriteSrc;
  const presentPath = !headGearId
    ? "noTopper"
    : validHatted
      ? cachedHatted && validHatted === cachedHatted
        ? "cachedOrSyncTopper"
        : "asyncTopper"
      : "fallbackBody";

  // Phase 0/1 ghost-frame diagnostics (no-op unless ?perf=1 / pumo_perf).
  if (typeof window !== "undefined" && window.__PUMO_PERF?.enabled) {
    recordFighterPresent({
      fighterId: penguin?.fighter ?? "unknown",
      requestedPoseSrc: effectiveSpriteSrc || null,
      bodySrc: recoloredSpriteSrc || null,
      displayedSrc: staticBodySrc || null,
      mawashiColor: targetColor || null,
      bodyColor: playerBodyColor || null,
      topperId: headGearId || null,
      tint: null,
      underBody: hatUnderBody,
      path: presentPath,
      cacheKey: hatPairKey,
      hattedPairKey: hattedPairKey || null,
      decodePending: !!(hatOverlaySrc && !validHatted),
    });
  }

  // Shared style-driving props for the static fighter <img>. Spread into BOTH
  // the body sprite and the grab-arm overlay so the arm inherits the exact same
  // position/facing/animation/filter and stays pixel-locked to the body through
  // every grab/clinch animation (strain, belly-flop, force-out, …).
  const fighterImgStyleProps = {
    $fighter: penguin.fighter,
    $isDiving: penguin.isDiving,
    $isJumping: penguin.isJumping,
    $isAttacking: displayPenguin.isAttacking,
    $isDodging: displayPenguin.isDodging,
    $isStrafing: penguin.isStrafing,
    $isBraking: displayPenguin.isBraking && !penguin.isRawParryStun,
    $isSlideJumping: !!penguin.isSlideJumping && penguin.slideJumpPhase === "flight",
    $isPowerSliding: displayPenguin.isPowerSliding,
    $isRawParrying: displayPenguin.isRawParrying,
    $isMatadorParrying: !!displayPenguin.isMatadorParrying,
    $isMatadorSuccess: !!penguin.isMatadorSuccess,
    $isGuarding: !!penguin.isGuarding,
    $isGuardBlockSuccess: guardBlockSuccess,
    $isGrabBreaking: penguin.isGrabBreaking,
    $isReady: penguin.isReady,
    $readyIntroComplete: readyIntroComplete,
    $isHit: penguin.isHit || penguin.isHitFalling,
    $lastHitType: penguin.lastHitType,
    // Procedural impact grading + attacker contact recoil (see the
    // player_hit handler and fighterStyledComponents keyframes).
    $impactAmp: impactAmp,
    $attackerRecoil: attackerRecoil,
    $isDead: penguin.isDead,
    $isSlapAttack: displayPenguin.isSlapAttack,
    // Limb-out poses: raise z so the slap/palm paints over the opponent body
    // while extended (separate arm layer would be better long-term; this is the
    // interim rail that stops "arm behind belly" without new art).
    $isStrikeExtending:
      !!(
        (displayPenguin.isSlapAttack && displayPenguin.isAttacking) ||
        (displayPenguin.isPalmThrust && displayPenguin.isAttacking)
      ),
    $isThrowing: penguin.isThrowing,
    $isRingOutThrowCutscene: penguin.isRingOutThrowCutscene,
    $isGrabbing: displayPenguin.isGrabbing,
    $isGrabbingMovement: penguin.isGrabbingMovement,
    $isBeingGrabbed: penguin.isBeingGrabbed,
    $isThrowingSalt: penguin.isThrowingSalt,
    $slapAnimation: displayPenguin.slapAnimation,
    $isBowing: penguin.isBowing,
    $isThrowTeching: penguin.isThrowTeching,
    $isBeingPulled: penguin.isBeingPulled,
    $isBeingPushed: penguin.isBeingPushed,
    $grabState: penguin.grabState,
    $grabAttemptType: penguin.grabAttemptType,
    $x: displayPosition.x,
    $y: displayPosition.y,
    $facing: penguin.facing ?? -1,
    $throwCooldown: penguin.throwCooldown,
    $grabCooldown: penguin.grabCooldown,
    $isChargingAttack: displayPenguin.isChargingAttack,
    $chargeAttackPower: penguin.chargeAttackPower || 0,
    $chargingFacingDirection: penguin.chargingFacingDirection,
    $saltCooldown: penguin.saltCooldown,
    $grabStartTime: penguin.grabStartTime,
    $grabbedOpponent: penguin.grabbedOpponent,
    $grabAttemptStartTime: penguin.grabAttemptStartTime,
    $throwTechCooldown: penguin.throwTechCooldown,
    $isSlapParrying: penguin.isSlapParrying,
    $isSlapParryRecovering: penguin.isSlapParryRecovering,
    $lastThrowAttemptTime: penguin.lastThrowAttemptTime,
    $lastGrabAttemptTime: penguin.lastGrabAttemptTime,
    $dodgeDirection: displayPenguin.dodgeDirection,
    $justLandedFromDodge: penguin.justLandedFromDodge,
    $speedFactor: penguin.speedFactor,
    $sizeMultiplier: penguin.sizeMultiplier,
    $isRecovering: penguin.isRecovering,
    $isRawParryStun: penguin.isRawParryStun,
    $isRawParrySuccess: inRawParrySuccessAnim && !penguin.isPerfectRawParrySuccess,
    $isPerfectRawParrySuccess:
      !!penguin.isPerfectRawParrySuccess && inRawParrySuccessAnim,
    $isThrowingSnowball: penguin.isThrowingSnowball,
    $isSpawningPumoArmy: penguin.isSpawningPumoArmy,
    $isAtTheRopes: penguin.isAtTheRopes,
    $isRopeJumping: penguin.isRopeJumping,
    $ropeJumpPhase: penguin.ropeJumpPhase,
    $isCrouchStance: penguin.isCrouchStance,
    $isCrouchStrafing: penguin.isCrouchStrafing,
    $isGrabBreakCountered: penguin.isGrabBreakCountered,
    $isAttemptingGrabThrow: penguin.isAttemptingGrabThrow,
    $ritualAnimationSrc: null,
    $isGrabPushing: penguin.isGrabPushing,
    $isBeingGrabPushed: penguin.isBeingGrabPushed,
    $isAttemptingPull: penguin.isAttemptingPull || !!penguin.isMatadorSuccess,
    $isBeingPullReversaled: penguin.isBeingPullReversaled,
    $isGrabSeparating: penguin.isGrabSeparating,
    $isGrabBellyFlopping: penguin.isGrabBellyFlopping,
    $isBeingGrabBellyFlopped: penguin.isBeingGrabBellyFlopped,
    $isGrabFrontalForceOut: penguin.isGrabFrontalForceOut,
    $isBeingGrabFrontalForceOut: penguin.isBeingGrabFrontalForceOut,
    $isGrabTeching: penguin.isGrabTeching,
    $grabTechRole: penguin.grabTechRole,
    $isGrabWhiffRecovery: penguin.isGrabWhiffRecovery,
    $isClinchClashing: penguin.isClinchClashing,
    $isClinchJolting: penguin.isClinchJolting,
    $isBeingClinchJolted: penguin.isBeingClinchJolted,
    $isClinchJoltClashing: penguin.isClinchJoltClashing,
    $clinchJoltRecovery: penguin.clinchJoltRecovery,
    $clinchThrowFailStagger: penguin.clinchThrowFailStagger,
    $isClinchOpen: !!(penguin.isClinchOpen || penguin.clinchThrowFailStagger),
    $isClinchPerfectBracing: !!penguin.isClinchPerfectBracing,
    $isClinchCommittedDrive: !!penguin.isClinchCommittedDrive,
    $inClinch: penguin.inClinch,
    $hasDeepGrip: penguin.hasDeepGrip,
    // MASTERY Phase 2 (2.1): broken-posture openable teeter (server-derived;
    // false when the Phase 2 flag is off). Kill it on gameOver so the loser
    // isn't still trembling under the round-result / next-round transition.
    $isPostureBroken: !!penguin.isPostureBroken && !gameOver,
    $balanceDanger: (penguin.balance ?? 100) < 15,
    $balanceWobble: (penguin.balance ?? 100) <= 50,
    $isCinematicKillAttacker: isCinematicKillAttacker,
    $attackerConfirmTier: attackerConfirmTier,
    $isClinchKillThrowVictim: penguin.isClinchKillThrowVictim,
    $isClinchKillPullVictim: penguin.isClinchKillPullVictim,
    $showClinchKillThrowLanding: showClinchKillThrowLanding,
    $isBeingThrown: penguin.isBeingThrown,
    $isLocalPlayer: penguin.id === localId,
  };

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
  // Round-result loser is off the ice for ground FX even while sliding between
  // the MAP win line and the DOHYO fall edge.
  const isRoundLoser = !!(
    gameOver &&
    winner &&
    typeof winner === "object" &&
    winner.id &&
    penguin?.id &&
    winner.id !== penguin.id
  );
  isRoundLoserRef.current = isRoundLoser;

  const isOutsideRingNow = isOutsideDohyo(displayPosition.x, displayPosition.y);
  const fallenSpriteHost =
    isOutsideRingNow && typeof document !== "undefined"
      ? document.querySelector(".fallen-actors")
      : null;
  // Shared ice-disc clip (ellipse). Reflections portal here so they can only
  // paint on the blue ice, regardless of MAP rope X.
  const iceClipHost =
    typeof document !== "undefined"
      ? document.querySelector(".ice-reflection-clip")
      : null;

  return (
    <div className="ui-container">
      {/* Ambient snowfall now lives at the scene level (single system in
          Game.jsx). This per-fighter instance only handles the kenshō envelope
          shower for the winning player on match-over. */}
      {matchOver && (
        <SnowEffect mode="envelope" winner={winner} playerIndex={index} />
      )}
      {/* World-space gyoji — portalled into #game-ring-props (camera-synced,
          below side callouts / above nameplates). index===0 only. */}
      {index === 0 &&
        (document.getElementById("game-ring-props")
          ? createPortal(
              <Gyoji gyojiState={gyojiState} hakkiyoi={hakkiyoi} />,
              document.getElementById("game-ring-props"),
            )
          : (
              <Gyoji gyojiState={gyojiState} hakkiyoi={hakkiyoi} />
            ))}

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
              player1TipDrain: p1TipDrain,
              player1HasDeepGrip: !!allPlayersData.player1?.hasDeepGrip,
              // Only show PUSH/BACK while actually clinched — defends against
              // a stale clinchShoveLead surviving a push-kill / round freeze.
              player1ShoveLead: allPlayersData.player1?.inClinch
                ? (allPlayersData.player1?.clinchShoveLead ?? null)
                : null,
              // MASTERY Phase 5 (5.2): the posture bar PULSES when broken so the
              // "openable" tell reads on the HUD too. Gated on the phase flag ⇒
              // no pulse with the flag off (server drives isPostureBroken).
              player1PostureBroken:
                isMasteryP5Live() && !!allPlayersData.player1?.isPostureBroken,
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
              player2TipDrain: p2TipDrain,
              player2HasDeepGrip: !!allPlayersData.player2?.hasDeepGrip,
              player2ShoveLead: allPlayersData.player2?.inClinch
                ? (allPlayersData.player2?.clinchShoveLead ?? null)
                : null,
              player2PostureBroken:
                isMasteryP5Live() && !!allPlayersData.player2?.isPostureBroken,
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
          NOTE: UiPlayerInfo → #game-hud-info (under actors). Side combat
          plaques → #game-hud-callouts (also under actors). Center callouts /
          KO / match-over below stay in #game-hud (z 210) above wrestlers. */}
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
          {/* PERF: pre-inject info-rail + hype-stamp variants so the first
              real callout doesn't pay styled-components CSS injection mid-
              combat. Unmounts after 2 frames. */}
          {[
            "parry",
            "counter",
            "counterhit",
            "countergrab",
            "matadorbreak",
            "punish",
            "counterthrow",
            "deepgrip",
            "break",
            "tech",
            "default",
          ].map((t) => (
            <span key={`warm-${t}`}>
              <SumoAnnouncementBanner text="WARM" type={t} isLeftSide={true} />
              <SumoAnnouncementBanner text="WARM" type={t} isLeftSide={false} />
            </span>
          ))}
          {["perfect"].map((t) => (
            <span key={`warm-hype-${t}`}>
              <SumoHypeStamp type={t} isLeftSide={true} />
              <SumoHypeStamp type={t} isLeftSide={false} />
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

      {document.getElementById("game-ring-props")
        ? createPortal(
            <SaltBasket
              src={
                penguin.isThrowingSalt || hasUsedPowerUp
                  ? saltBasketEmpty
                  : saltBasket
              }
              alt="Salt Basket"
              $index={index}
              $isVisible={true}
            />,
            document.getElementById("game-ring-props"),
          )
        : (
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
          )}
      {/* Ground shadow — like the sprite, it rides down into `.fallen-actors`
          (scene, below the dohyo) while this fighter is outside the ring so it
          sinks behind the platform instead of floating over it. It already
          flips its own z-index to 0 when outside (PlayerShadow), so once it's
          back in the scene that 0 lands below the dohyo's z:1.
          Hidden only after throw-kill impact (not the early mid-air pose swap):
          a foot-shadow under the prone sprite reads as floating. */}
      {!(penguin.isClinchKillThrowVictim && !penguin.isBeingThrown) && (() => {
        const reflectionSrc = isAnimatedSprite
          ? recoloredSpriteSrc
          : staticBodySrc;
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
            forceShow={isRoundLoser}
            isLocalPlayer={penguin.id === localId}
          />
        );
        const reflectionNode = (
          <IceReflection
            ref={reflectionDomRef}
            x={displayPosition.x}
            y={displayPosition.y}
            facing={penguin.facing ?? -1}
            src={reflectionSrc}
            isAnimated={isAnimatedSprite}
            frameCount={spriteConfig?.frameCount || 1}
            fps={spriteConfig?.fps || 30}
            loop={spriteConfig?.loop !== false}
            isSidestepping={penguin.isSidestepping}
            forceHide={isRoundLoser}
          />
        );
        return (
          <>
            {isOutsideRingNow && fallenSpriteHost
              ? createPortal(shadowNode, fallenSpriteHost)
              : shadowNode}
            {iceClipHost
              ? createPortal(reflectionNode, iceClipHost)
              : reflectionNode}
          </>
        );
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
          $isHit={penguin.isHit || penguin.isHitFalling}
          $isBurstKnockback={penguin.isBurstKnockback}
          $impactAmp={impactAmp}
          $isRawParryStun={penguin.isRawParryStun}
          $isCinematicKillAttacker={isCinematicKillAttacker}
          $attackerConfirmTier={attackerConfirmTier}
          $isPostureBroken={!!penguin.isPostureBroken && !gameOver}
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
            $isMatadorParrying={!!displayPenguin.isMatadorParrying}
            $isMatadorSuccess={!!penguin.isMatadorSuccess}
            $isPerfectRawParrySuccess={
              !!penguin.isPerfectRawParrySuccess && inRawParrySuccessAnim
            }
            $isHit={penguin.isHit || penguin.isHitFalling}
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
          $overrideSrc={staticBodySrc}
          {...fighterImgStyleProps}
          decoding="async"
          style={{ display: showRitualSprite ? "none" : "block" }}
        />
      )}

      {/* Grab / clinch ARM overlay — a second static <img> stacked on the
          armless grabbing/clinch body. It shares every style-driving prop with
          the body (so it moves/flips/animates identically) plus its own ref for
          per-frame position writes and $grabArmLayer for the facing-based
          over/under z. Keyed off the body's base source so it remounts in sync
          with the body (grabbing↔clinch) and their CSS animations stay aligned. */}
      {!isAnimatedSprite && showGrabArm && recoloredArmSrc && (
        <StyledImage
          ref={grabArmImgDomRef}
          key={`grabarm-${baseSpriteSrc}-${chargeAnimKeyRef.current}|${spriteColorKey}`}
          $overrideSrc={recoloredArmSrc}
          {...fighterImgStyleProps}
          $grabArmLayer={grabArmZ}
          $grabArmNudgeXPct={grabArmNudgeXPct}
          $grabArmNudgeYPct={grabArmNudgeYPct}
          $grabArmBodyHoldActive={grabArmBodyHoldActive}
          decoding="async"
          draggable={false}
          style={{
            display: showRitualSprite ? "none" : "block",
          }}
        />
      )}
      {/* Deep Grip tip glow — motion twin of the grab arm (same footprint,
          shoulder pivot, nudges, arm keyframes, and $grabArmLayer z). Renders
          after the arm so it sits on the flipper tip; an opponent arm at the
          higher facing z still paints over it. */}
      {!isAnimatedSprite &&
        showGrabArm &&
        !!penguin.hasDeepGrip &&
        penguin.inClinch && (
          <DeepGripArmGlow
            ref={deepGripGlowDomRef}
            key={`grabarm-dg-${baseSpriteSrc}-${chargeAnimKeyRef.current}`}
            {...fighterImgStyleProps}
            $grabArmLayer={grabArmZ}
            $grabArmNudgeXPct={grabArmNudgeXPct}
            $grabArmNudgeYPct={grabArmNudgeYPct}
            $grabArmBodyHoldActive={grabArmBodyHoldActive}
            style={{ display: showRitualSprite ? "none" : "block" }}
            aria-hidden
          >
            <i />
          </DeepGripArmGlow>
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

      <SlapParryEffect position={parryEffectPosition} />
      {index === 0 && (
        <BlockingEffect position={blockingEffectPosition} />
      )}
      <ChargeClashEffect position={chargeClashEffectPosition} />
      <HitEffect position={hitEffectPosition} />
      <SlapHitSpriteEffect position={hitEffectPosition} />
      {index === 0 && (
        <RawParryEffect position={rawParryEffectPosition} />
      )}
      <GrabBreakEffect position={grabBreakEffectPosition} />
      <GrabTechEffect position={grabTechEffectPosition} />
      <ClinchJoltEffect position={clinchJoltEffectPosition} />
      <CounterGrabEffect position={trackedCounterGrabEffectPosition} />
      {index === 0 && <ClinchCalloutEffect callout={clinchCalloutData} />}
      {index === 0 && (
        <PerfectBraceEffect position={perfectBraceStampPosition} />
      )}
      <PunishBannerEffect position={punishBannerPosition} />
      <GoredBannerEffect position={goredBannerPosition} />
      <MatadorSuccessEffect position={matadorSuccessStampPosition} />
      <CounterHitEffect position={counterHitEffectPosition} />
      <SnowballImpactEffect position={snowballImpactPosition} />
      <StarStunEffect
        ref={starStunDomRef}
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing ?? -1}
        isActive={showStarStunEffect}
        variant={starStunVariant}
      />
      <EdgeDangerEffect
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing ?? -1}
        isActive={penguin.isAtTheRopes}
      />
      {/* CLAMPED! prompt only — grip-up is gone; mutual grip is automatic.
          Counter-grab arm clamp: readable strong-advantage tell (Plant still ok). */}
      <GripPromptEffect
        ref={gripPromptDomRef}
        x={displayPosition.x}
        y={displayPosition.y}
        isActive={
          penguin.id === localId &&
          penguin.inClinch === true &&
          penguin.isBeingGrabbed === true &&
          penguin.isArmClamped === true &&
          !penguin.isClinchKillThrowVictim &&
          !penguin.isClinchKillPullVictim
        }
      />
      {/* NoStaminaEffect - centered on screen, only render once (index 0) and only for local player */}
      {index === 0 && noStaminaEffectKey > 0 && (
        <NoStaminaEffect showEffect={noStaminaEffectKey} />
      )}
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
