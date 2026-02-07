import React, {
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
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
import DodgeSmokeEffect from "./DodgeDustEffect";
// import DodgeLandingEffect from "./DodgeLandingEffect";
// import ChargedAttackSmokeEffect from "./ChargedAttackSmokeEffect";
import StarStunEffect from "./StarStunEffect";
import ThickBlubberEffect from "./ThickBlubberEffect";
import GrabBreakEffect from "./GrabBreakEffect";
import CounterGrabEffect from "./CounterGrabEffect";
import PunishBannerEffect from "./PunishBannerEffect";
import CounterHitEffect from "./CounterHitEffect";
import EdgeDangerEffect from "./EdgeDangerEffect";
import NoStaminaEffect from "./GassedEffect";
import SnowballImpactEffect from "./SnowballImpactEffect";
import PumoCloneSpawnEffect from "./PumoCloneSpawnEffect";
import SlapAttackHandsEffect from "./SlapAttackHandsEffect";
import PerfectParryPowerEffect from "./PerfectParryPowerEffect";
import SumoGameAnnouncement from "./SumoGameAnnouncement";

// Dynamic sprite recoloring system
import { useDynamicSprite } from "../hooks/useDynamicSprite";
import {
  recolorImage,
  getCachedRecoloredImage,
  BLUE_COLOR_RANGES,
  SPRITE_BASE_COLOR,
  COLOR_PRESETS,
} from "../utils/SpriteRecolorizer";
import { usePlayerColors } from "../context/PlayerColorContext";

// ============================================
// STATIC SPRITE IMPORTS (Single frame images)
// UNIFIED: All players use BLUE sprites - recoloring handles Player 2
// ============================================
import pumo2 from "../assets/pumo2.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import grabbing2 from "../assets/grabbing2.png";
import attemptingGrabThrow2 from "../assets/attempting-grab-throw2.png";
import grabSound from "../sounds/grab-sound.mp3";
import ready2 from "../assets/ready2.png";
import attack2 from "../assets/attack2.png";
import slapAttack1Blue from "../assets/slapAttack1blue.png";
import slapAttack2Blue from "../assets/slapAttack2blue.png";
import dodging2 from "../assets/dodging2.png";
import throwing2 from "../assets/throwing2.png";
import salt2 from "../assets/salt2.png";
import throwTech2 from "../assets/throw-tech2.png";
import saltBasket from "../assets/salt-basket.png";
import saltBasketEmpty from "../assets/salt-basket-empty.png";
import recovering2 from "../assets/recovering2.png";
import rawParrySuccess2 from "../assets/raw-parry-success2.png";
import snowball from "../assets/snowball.png";
import crouchStance2 from "../assets/crouch-stance2.png";

// ============================================
// ANIMATED SPRITE IMPORTS (APNGs/GIFs)
// UNIFIED: All players use BLUE sprites - recoloring handles Player 2
// ============================================
import pumoWaddle2 from "../assets/pumo-waddle2.png";  // APNG
import pumoArmy2 from "../assets/pumo-army2.png";      // APNG
import crouching2 from "../assets/blocking2.png";       // APNG (blue)
import bow2 from "../assets/bow2.png";                 // APNG
import grabAttempt2 from "../assets/grab-attempt2.png"; // APNG
import hit2 from "../assets/hit2.png";                 // APNG
import snowballThrow2 from "../assets/snowball-throw2.png"; // APNG
import beingGrabbed2 from "../assets/is-being-grabbed2.gif";
import atTheRopes2 from "../assets/at-the-ropes2.png"; // APNG
import crouchStrafing2Apng from "../assets/crouch-strafing2.png"; // APNG

// Spritesheets created for future canvas-based recoloring (kept for reference)
// import crouchingSpritesheet from "../assets/spritesheets/blocking2_spritesheet.png";
// import bowSpritesheet from "../assets/spritesheets/bow_spritesheet.png";
// import grabAttemptSpritesheet from "../assets/spritesheets/grab-attempt_spritesheet.png";
// import hitSpritesheet from "../assets/spritesheets/hit2_spritesheet.png";
// Spritesheets kept for future canvas-based recoloring
// (Currently using CSS hue-rotate which is simpler and preserves APNG animations)
import attackSound from "../sounds/attack-sound.mp3";
import hitSound from "../sounds/hit-sound.mp3";
import dodgeSound from "../sounds/dodge-sound.mp3";
import throwSound from "../sounds/throw-sound.mp3";
import winnerSound from "../sounds/winner-sound.wav";
import hakkiyoiSound from "../sounds/hakkiyoi-sound.mp3";
import teWoTsuiteSound from "../sounds/tewotsuite.wav";
import bellSound from "../sounds/bell-sound.mp3";
import gameMusic from "../sounds/game-music.mp3";
import eeshiMusic from "../sounds/eeshi.mp3";
import slapParrySound from "../sounds/slap-parry-sound.mp3";
import saltSound from "../sounds/salt-sound.mp3";
import snowballThrowSound from "../sounds/snowball-throw-sound.mp3";
import pumoArmySound from "../sounds/pumo-army-sound.mp3";
import thickBlubberSound from "../sounds/thick-blubber-sound.mp3";
import rawParryGruntSound from "../sounds/raw-parry-grunt.mp3";
import rawParrySuccessSound from "../sounds/raw-parry-success-sound.wav";
import regularRawParrySound from "../sounds/regular-raw-parry-sound.wav";
import grabBreakSound from "../sounds/grab-break-sound.wav";
import counterGrabSound from "../sounds/counter-grab-sound.wav";
import notEnoughStaminaSound from "../sounds/not-enough-stamina-sound.wav";
import grabClashSound from "../sounds/grab-clash-sound.wav";
import clashVictorySound from "../sounds/clash-victory-sound.wav";
import clashDefeatSound from "../sounds/clash-defeat-sound.wav";
import roundVictorySound from "../sounds/round-victory-sound.mp3";
import roundDefeatSound from "../sounds/round-defeat-sound.mp3";
import hitEffectImage from "../assets/hit-effect.png";
// crouchStance2 and crouchStrafing2 already imported above

// CSS background images (preload to prevent flash on game start)
import gameMapBackground from "../assets/game-map-1.png";
import dohyoOverlay from "../assets/dohyo.png";

// Gyoji images (referee appears at game start and during announcements)
import gyojiImage from "../assets/gyoji.png";
import gyojiReady from "../assets/gyoji-ready.png";
import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";
import gyojiHakkiyoi from "../assets/gyoji-hakkiyoi.gif";

// Effect images (used during gameplay)
import dodgeEffectGif from "../assets/dodge-effect.gif";
import slapAttackHand from "../assets/slap-attack-hand.png";

// Get ritual sprites from ANIMATED_SPRITES to share cache with preloading system
// This ensures preloaded sprites are found in cache when GameFighter looks them up
import { ANIMATED_SPRITES } from "../config/spriteConfig";

// Extract ritual spritesheets from the same source as preloading uses
const ritualPart1Spritesheet = ANIMATED_SPRITES.player1.ritualPart1.src;
const ritualPart2Spritesheet = ANIMATED_SPRITES.player1.ritualPart2.src;
const ritualPart3Spritesheet = ANIMATED_SPRITES.player1.ritualPart3.src;
const ritualPart4Spritesheet = ANIMATED_SPRITES.player1.ritualPart4.src;

// Ritual clap sounds
import clap1Sound from "../sounds/clap1-sound.wav";
import clap2Sound from "../sounds/clap2-sound.mp3";
import clap3Sound from "../sounds/clap3-sound.wav";
import clap4Sound from "../sounds/clap4-sound.wav";

import UiPlayerInfo from "./UiPlayerInfo";
import SaltEffect from "./SaltEffect";
import MatchOver from "./MatchOver";
import RoundResult from "./RoundResult";
import HitEffect from "./HitEffect";
import RawParryEffect from "./RawParryEffect";
import { getGlobalVolume } from "./Settings";
import SnowEffect from "./SnowEffect";
import ThemeOverlay from "./ThemeOverlay";
import "./theme.css";
import { isOutsideDohyo, DOHYO_FALL_DEPTH, SERVER_BROADCAST_HZ } from "../constants";

const GROUND_LEVEL = 120; // Ground level constant

// ============================================
// RITUAL ANIMATION CONFIGURATION (Sprite Sheets)
// Each part has: spritesheet image, frame count, frame width, fps
// ============================================
const RITUAL_SPRITE_CONFIG = [
  { spritesheet: ritualPart1Spritesheet, frameCount: 28, frameWidth: 480, fps: 14 },
  { spritesheet: ritualPart2Spritesheet, frameCount: 24, frameWidth: 480, fps: 14 },
  { spritesheet: ritualPart3Spritesheet, frameCount: 39, frameWidth: 480, fps: 14 },
  { spritesheet: ritualPart4Spritesheet, frameCount: 38, frameWidth: 480, fps: 14 },
];

// Calculate durations from frame count and fps
const RITUAL_ANIMATION_DURATIONS = RITUAL_SPRITE_CONFIG.map(
  (config) => Math.round((config.frameCount / config.fps) * 1000)
);

// How many ms BEFORE the animation ends should the clap sound play?
const CLAP_SOUND_OFFSET = 100; // ms before animation end

// Player 1 (Blue) ritual spritesheets
const ritualSpritesheetsPlayer1 = RITUAL_SPRITE_CONFIG;

// Player 2 - NOW USES BLUE spritesheets (same as player 1)
// CSS hue-rotate filter in RitualSpriteImage will shift blue -> pink
// This allows both players to use the same sprites with different colors
const ritualSpritesheetsPlayer2 = RITUAL_SPRITE_CONFIG;

// Clap sounds for each ritual part
const ritualClapSounds = [clap1Sound, clap2Sound, clap3Sound, clap4Sound];

// MEMORY OPTIMIZATION: Ritual spritesheet preloading removed
// Ritual spritesheets are enormous (up to 18720x480 px, ~35MB decoded bitmap each).
// Pre-decoding all 4 parts at module load wastes ~120MB per player of decoded bitmap memory
// for images that are never displayed directly (recolored versions are used instead).
// The recoloring system caches them as blob URLs - the browser decodes on-demand when rendered.

// Audio pool for better performance
const audioPool = new Map();
const imagePool = new Map();

const createAudioPool = (src, poolSize = 3) => {
  if (!audioPool.has(src)) {
    const pool = [];
    for (let i = 0; i < poolSize; i++) {
      const audio = new Audio(src);
      audio.preload = "auto";
      pool.push(audio);
    }
    audioPool.set(src, { pool, currentIndex: 0 });
  }
};

// Image preloading function
const preloadImage = (src) => {
  if (!imagePool.has(src)) {
    const img = new Image();
    img.src = src;
    imagePool.set(src, img);
  }
};

// Initialize audio pools
const initializeAudioPools = () => {
  createAudioPool(attackSound, 2);
  createAudioPool(hitSound, 2);
  createAudioPool(dodgeSound, 2);
  createAudioPool(throwSound, 2);
  createAudioPool(grabSound, 2);
  createAudioPool(slapParrySound, 2);
  createAudioPool(saltSound, 2);
  createAudioPool(snowballThrowSound, 2);
  createAudioPool(pumoArmySound, 2);
  createAudioPool(hakkiyoiSound, 1);
  createAudioPool(teWoTsuiteSound, 1);
  createAudioPool(bellSound, 1);
  createAudioPool(winnerSound, 1);
  createAudioPool(thickBlubberSound, 2);
  createAudioPool(rawParryGruntSound, 2);
  createAudioPool(rawParrySuccessSound, 2);
  createAudioPool(regularRawParrySound, 2);
  createAudioPool(grabBreakSound, 2);
  createAudioPool(counterGrabSound, 2);
  createAudioPool(notEnoughStaminaSound, 2);
  createAudioPool(grabClashSound, 2);
  createAudioPool(clashVictorySound, 2);
  createAudioPool(clashDefeatSound, 2);
  createAudioPool(roundVictorySound, 2);
  createAudioPool(roundDefeatSound, 2);
  // Add missing audio files
  createAudioPool(gameMusic, 1);
  createAudioPool(eeshiMusic, 1);
  // Ritual clap sounds
  createAudioPool(clap1Sound, 2);
  createAudioPool(clap2Sound, 2);
  createAudioPool(clap3Sound, 2);
  createAudioPool(clap4Sound, 2);
};

// Initialize image preloading
// UNIFIED SPRITES: Only preload blue sprites - recoloring handles Player 2
const initializeImagePreloading = () => {
  // Character sprites (blue only)
  preloadImage(pumo2);
  preloadImage(pumoWaddle2);
  preloadImage(pumoArmy2);

  // Action sprites (blue only)
  preloadImage(attack2);
  preloadImage(throwing2);
  preloadImage(grabbing2);
  preloadImage(grabAttempt2);
  preloadImage(attemptingGrabThrow2);
  preloadImage(beingGrabbed2);

  // State sprites (blue only)
  preloadImage(ready2);
  preloadImage(hit2);
  preloadImage(dodging2);
  preloadImage(crouching2);
  preloadImage(crouchStance2);
  preloadImage(crouchStrafing2Apng);

  // Special moves (blue only)
  preloadImage(slapAttack1Blue);
  preloadImage(slapAttack2Blue);
  preloadImage(snowballThrow2);

  // Utility sprites (blue only)
  preloadImage(bow2);
  preloadImage(throwTech2);
  preloadImage(salt2);
  preloadImage(saltBasket);
  preloadImage(saltBasketEmpty);
  preloadImage(recovering2);
  preloadImage(rawParrySuccess2);
  preloadImage(atTheRopes2);
  preloadImage(snowball);

  // Effect sprites
  preloadImage(hitEffectImage);

  // CSS background images (critical for smooth game start)
  preloadImage(gameMapBackground);
  preloadImage(dohyoOverlay);

  // Power-up icons
  preloadImage(powerWaterIcon);
  preloadImage(pumoArmyIcon);
  preloadImage(happyFeetIcon);
  preloadImage(thickBlubberIcon);

  // Gyoji images (referee)
  preloadImage(gyojiImage);
  preloadImage(gyojiReady);
  preloadImage(gyojiPlayer1wins);
  preloadImage(gyojiPlayer2wins);
  preloadImage(gyojiHakkiyoi);

  // Effect images
  preloadImage(dodgeEffectGif);
  preloadImage(slapAttackHand);
};

// Initialize pools and preloading immediately
initializeAudioPools();
initializeImagePreloading();

// UNIFIED SPRITES: Both players use blue sprites as base
// Player 2's color is handled via canvas-based recoloring (defaults to red)

const playSound = (audioFile, volume = 1.0, duration = null) => {
  try {
    const poolData = audioPool.get(audioFile);
    if (poolData) {
      const { pool, currentIndex } = poolData;
      const sound = pool[currentIndex];
      sound.volume = volume * getGlobalVolume();
      sound.currentTime = 0; // Reset to start
      sound.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error playing sound:", error);
        }
      });
      // Stop sound early if duration is specified (in milliseconds)
      if (duration) {
        setTimeout(() => {
          sound.pause();
          sound.currentTime = 0;
        }, duration);
      }
      // Cycle to next audio instance
      audioPool.set(audioFile, {
        pool,
        currentIndex: (currentIndex + 1) % pool.length,
      });
    } else {
      // Fallback to old method
      const sound = new Audio(audioFile);
      sound.volume = volume * getGlobalVolume();
      sound.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error playing sound:", error);
        }
      });
      // Stop sound early if duration is specified (in milliseconds)
      if (duration) {
        setTimeout(() => {
          sound.pause();
          sound.currentTime = 0;
        }, duration);
      }
    }
  } catch (error) {
    console.error("Error creating audio:", error);
  }
};

const getImageSrc = (
  fighter,
  isDiving,
  isJumping,
  isAttacking,
  isDodging,
  isStrafing,
  isRawParrying,
  isGrabBreaking,
  isReady,
  isHit,
  isDead,
  isSlapAttack,
  isThrowing,
  isGrabbing,
  isGrabbingMovement,
  isBeingGrabbed,
  isThrowingSalt,
  slapAnimation,
  isBowing,
  isThrowTeching,
  isBeingPulled,
  isBeingPushed,
  grabState,
  grabAttemptType,
  isRecovering,
  isRawParryStun,
  isRawParrySuccess,
  isPerfectRawParrySuccess,
  isThrowingSnowball,
  isSpawningPumoArmy,
  isAtTheRopes,
  isCrouchStance,
  isCrouchStrafing,
  isGrabBreakCountered,
  // new optional trailing param(s)
  isGrabbingMovementTrailing,
  isGrabClashActive,
  isAttemptingGrabThrow,
  // Ritual animation source - if provided, use it instead of state-based selection
  ritualAnimationSrc
) => {
  // If ritual animation is active, return that directly
  if (ritualAnimationSrc) {
    return ritualAnimationSrc;
  }
  
  // Backward-compat: allow passing as trailing param or main param
  const attemptingGrabMovement =
    typeof isGrabbingMovementTrailing === "boolean"
      ? isGrabbingMovementTrailing
      : !!isGrabbingMovement;
  // ============================================
  // UNIFIED SPRITES - Both players use BLUE sprites
  // Color differentiation is handled by the recoloring system
  // Player 1 stays blue, Player 2 gets recolored to red (or custom color)
  // ============================================
  
  if (isGrabBreaking) return crouching2;
  if (isGrabBreakCountered) return hit2;
  // Both perfect and regular parry use the same success animation
  if (isRawParrySuccess || isPerfectRawParrySuccess) return rawParrySuccess2;
  // Check isHit before isAtTheRopes to prevent red silhouette issue
  if (isHit) return hit2;
  if (isAtTheRopes) return atTheRopes2;
  if (isBowing) return bow2;
  if (isThrowTeching) return throwTech2;
  if (isRecovering) return recovering2;
  if (isThrowingSnowball) return snowballThrow2;
  if (isSpawningPumoArmy) return pumoArmy2;
  // CRITICAL: Check isBeingGrabbed BEFORE isDodging to prevent dodge animation during grab
  if (isBeingGrabbed || isBeingPulled || isBeingPushed) return beingGrabbed2;
  // CRITICAL: Check isDodging BEFORE isAttacking to prevent attack animation during dodge
  if (isDodging) return dodging2;
  if (isJumping) return throwing2;
  if (isAttacking && !isSlapAttack) return attack2;
  if (isCrouchStrafing) return crouchStrafing2Apng;
  if (isCrouchStance) return crouchStance2;
  // Show attempting grab throw animation
  if (isAttemptingGrabThrow) return attemptingGrabThrow2;
  // Show attempt animation during grab movement attempt
  if (attemptingGrabMovement) {
    return grabAttemptType === "throw" ? throwing2 : grabAttempt2;
  }
  // Show attempt animation even if isGrabbing is false, UNLESS in grab clash
  if (grabState === "attempting") {
    // During grab clash, show grabbing animation instead of grab attempt
    if (isGrabClashActive) {
      return grabbing2;
    }
    return grabAttemptType === "throw" ? throwing2 : grabAttempt2;
  }
  if (isSlapAttack) {
    return slapAnimation === 1 ? slapAttack1Blue : slapAttack2Blue;
  }
  if (isGrabbing) {
    if (grabState === "attempting") {
      // During grab clash, show grabbing animation instead of grab attempt
      if (isGrabClashActive) {
        return grabbing2;
      }
      return grabAttemptType === "throw" ? throwing2 : grabAttempt2;
    }
    return grabbing2;
  }
  if (isRawParrying) return crouching2;
  if (isRawParryStun) return bow2;
  if (isReady) return ready2;
  if (isStrafing && !isThrowing) return pumoWaddle2;
  if (isDead) return pumo2;
  if (isThrowing) return throwing2;
  if (isThrowingSalt) return salt2;
  return pumo2;
};

const validProps = [
  // valid HTML attributes
  "src",
  "style",
  "alt",
  "className",
  "id",
  "onClick",
  "pullSpeed",
  "pullHopHeight",
  "pullHopSpeed",
];

const RedTintOverlay = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$x", "$y", "$facing", "$isThrowing", "$isRingOutThrowCutscene", "$imageSrc"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "16.609%",
      height: "auto",
      aspectRatio: 1,
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
      background: "rgba(156, 136, 255, 0.6)",
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : 101,
      pointerEvents: "none",
      mixBlendMode: "multiply",
      maskImage: `url(${props.$imageSrc})`,
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskImage: `url(${props.$imageSrc})`,
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
    },
  }))``;

const HurtTintOverlay = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$x", "$y", "$facing", "$isThrowing", "$isRingOutThrowCutscene", "$imageSrc"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "16.609%",
      height: "auto",
      aspectRatio: 1,
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
      background: "rgba(255, 64, 64, 0.55)",
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : 101,
      pointerEvents: "none",
      mixBlendMode: "multiply",
      maskImage: `url(${props.$imageSrc})`,
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskImage: `url(${props.$imageSrc})`,
      WebkitMaskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
    },
  }))``;

// Lightweight tinted clone image (no masks) for performance and perfect alignment
const TintedImage = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "$x",
        "$y",
        "$facing",
        "$isThrowing",
        "$isRingOutThrowCutscene",
        "$variant",
      ].includes(prop),
  })
  .attrs((props) => ({
    decoding: "async",
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : 101,
      pointerEvents: "none",
      width: "min(16.609%, 511px)",

      height: "auto",
      willChange: "opacity, transform",
      // Force strong hue for consistent red/purple regardless of base colors
      filter:
        props.$variant === "hurt"
          ? "sepia(1) saturate(10000%) hue-rotate(0deg) brightness(.75)"
          : "sepia(1) saturate(10000%) hue-rotate(265deg) brightness(.75)",
      opacity: props.$variant === "hurt" ? 0.4 : 0.4,
      // Use color blend so the red hue overlays predictably on aqua/salmon bases
      mixBlendMode: "color",
    },
  }))``;

const StyledImage = styled("img")
  .withConfig({
    shouldForwardProp: (prop) =>
      validProps.includes(prop) ||
      ![
        "fighter",
        "isJumping",
        "isDiving",
        "isAttacking",
        "isAttackCooldown",
        "isDodging",
        "isStrafing",
        "isRawParrying",
        "isGrabBreaking",
        "isReady",
        "isHit",
        "isDead",
        "x",
        "y",
        "facing",
        "yVelocity",
        "attackEndTime",
        "knockbackVelocity",
        "dodgeEndTime",
        "isAlreadyHit",
        "attackStartTime",
        "isSpaceBarPressed",
        "isThrowing",
        "throwStartTime",
        "throwEndTime",
        "throwOpponent",
        "throwingFacingDirection",
        "throwFacingDirection",
        "beingThrownFacingDirection",
        "isBeingThrown",
        "isGrabbing",
        "isBeingGrabbed",
        "isSlapAttack",
        "slapAnimation",
        "isBowing",
        "isThrowTeching",
        "isBeingPulled",
        "isBeingPushed",
        "grabState",
        "grabAttemptType",
        "throwCooldown",
        "grabCooldown",
        "isChargingAttack",
        "chargeStartTime",
        "chargeMaxDuration",
        "chargeAttackPower",
        "chargingFacingDirection",
        "isThrowingSalt",
        "isThrowingSnowball",
        "isSpawningPumoArmy",
        "saltCooldown",
        "grabStartTime",
        "grabbedOpponent",
        "grabAttemptStartTime",
        "throwTechCooldown",
        "isSlapParrying",
        "lastThrowAttemptTime",
        "lastGrabAttemptTime",
        "dodgeDirection",
        "isDodgeCancelling",
        "justLandedFromDodge",
        "speedFactor",
        "sizeMultiplier",
        "isRecovering",
        "isRawParryStun",
        "isRawParrySuccess",
        "isPerfectRawParrySuccess",
        "isAtTheRopes",
        "isCrouchStance",
        "isCrouchStrafing",
        "isGrabBreakCountered",
        "isGrabClashActive",
        "isAttemptingGrabThrow",
        "ritualAnimationSrc",
        "isLocalPlayer",
        "overrideSrc",
      ].includes(prop),
  })
  .attrs((props) => ({
    // Use override src if provided (for recolored sprites), otherwise compute from state
    src: props.$overrideSrc || getImageSrc(
      props.$fighter,
      props.$isDiving,
      props.$isJumping,
      props.$isAttacking,
      props.$isDodging,
      props.$isStrafing,
      props.$isRawParrying,
      props.$isGrabBreaking,
      props.$isReady,
      props.$isHit,
      props.$isDead,
      props.$isSlapAttack,
      props.$isThrowing,
      props.$isGrabbing,
      props.$isGrabbingMovement,
      props.$isBeingGrabbed,
      props.$isThrowingSalt,
      props.$slapAnimation,
      props.$isBowing,
      props.$isThrowTeching,
      props.$isBeingPulled,
      props.$isBeingPushed,
      props.$grabState,
      props.$grabAttemptType,
      props.$isRecovering,
      props.$isRawParryStun,
      props.$isRawParrySuccess,
      props.$isPerfectRawParrySuccess,
      props.$isThrowingSnowball,
      props.$isSpawningPumoArmy,
      props.$isAtTheRopes,
      props.$isCrouchStance,
      props.$isCrouchStrafing,
      props.$isGrabBreakCountered,
      props.$isGrabbingMovement,
      props.$isGrabClashActive,
      props.$isAttemptingGrabThrow,
      props.$ritualAnimationSrc
    ),
    style: {
      position: "absolute",
      left: props.$isAtTheRopes && props.$fighter === "player 1"
        ? `${((props.$x + (props.$x < 640 ? -5 : 5)) / 1280) * 100}%`  // Move 5px closer to ropes
        : `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      "--facing": props.$facing === 1 ? "1" : "-1",
      transform: props.$isAtTheRopes && props.$fighter === "player 1"
        ? (props.$facing === 1
            ? "scaleX(1) scaleY(0.95)"
            : "scaleX(-1) scaleY(0.95)")
        : (props.$facing === 1
            ? "scaleX(1)"
            : "scaleX(-1)"),
      zIndex:
        isOutsideDohyo(props.$x, props.$y) ? 0 : // Behind dohyo overlay when outside
        props.$isThrowing || props.$isDodging || props.$isGrabbing ? 98 : 99,
      // PERFORMANCE: Reduced drop-shadows from 4+ to 1 outline + effects
      // Original had 4 separate drop-shadows for outline which is very expensive
      filter: props.$isAtTheRopes
        ? "drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(255, 50, 50, 0.7)) brightness(1.15) contrast(1.25)"
        : props.$isGrabBreaking
        ? "drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(0, 255, 128, 0.85)) brightness(1.35)"
        : props.$isRawParrying
        ? "drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(0, 150, 255, 0.8)) brightness(1.3)"
        : props.$isHit
        ? "drop-shadow(0 0 1px #000) contrast(1.2) brightness(1.15)"
        : props.$isChargingAttack
        ? "drop-shadow(0 0 1px #000) drop-shadow(0 0 12px rgba(255, 200, 50, 0.85)) contrast(1.25)"
        : props.$isGrabClashActive
        ? "drop-shadow(0 0 1px #000) contrast(1.25) brightness(1.1)"
        : "drop-shadow(0 0 1px #000) contrast(1.2)",
      animation: props.$isAtTheRopes
        ? "atTheRopesWobble 0.3s ease-in-out infinite"
        : props.$isAttemptingGrabThrow
        ? "attemptingGrabThrowPull 0.5s cubic-bezier(0.4, 0.0, 0.6, 1.0)"
        : props.$isRawParrySuccess || props.$isPerfectRawParrySuccess
        ? "rawParryRecoil 0.5s ease-out"
        : props.$isGrabBreaking
        ? "grabBreakFlash 1.2s ease-in-out infinite"
        : props.$isRawParrying
        ? "rawParryFlash 1.2s ease-in-out infinite"
        : props.$isGrabClashActive
        ? "grabClashStruggle 0.15s ease-in-out infinite"
        : props.$isHit
        ? "hitSquash 0.28s cubic-bezier(0.22, 0.6, 0.35, 1)"
        : props.$justLandedFromDodge && !props.$isPowerSliding
        ? "dodgeLanding 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
        // : props.$isDodgeCancelling
        // ? "dodgeCancelSlam 0.12s cubic-bezier(0.25, 0.1, 0.25, 1) forwards"
        : props.$isDodging
        ? "dodgeTakeoff 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards"
        : // ICE PHYSICS: Movement animations take priority over charging
        // Power slide animation - blocked during victim/special states
        props.$isPowerSliding && 
          !props.$isBeingGrabbed && 
          !props.$isBeingThrown && 
          !props.$isThrowing &&
          !props.$isGrabbing &&
          !props.$isRecovering &&
          !props.$isDead
        ? "powerSlide 0.15s ease-in-out infinite"
        : // ICE PHYSICS: Braking animation when digging in to stop - shows during charging
        // Also blocked during victim/special states
        props.$isBraking && 
          !props.$isBeingGrabbed && 
          !props.$isBeingThrown && 
          !props.$isThrowing &&
          !props.$isGrabbing &&
          !props.$isRecovering &&
          !props.$isDead
        ? "iceBrake 0.2s ease-in-out infinite"
        : props.$isChargingAttack
        ? "chargePulse 0.6s ease-in-out infinite"
        : props.$isAttacking && !props.$isSlapAttack
        ? "attackPunch 0.2s ease-out"
        : props.$isSlapAttack
        ? "slapRush 0.12s ease-in-out infinite"
        : // Breathing animation for idle states
        !props.$isAttacking &&
          !props.$isDodging &&
          !props.$isJumping &&
          !props.$isThrowing &&
          !props.$isGrabbing &&
          !props.$isBeingGrabbed &&
          !props.$isBeingPulled &&
          !props.$isBeingPushed &&
          !props.$isThrowTeching &&
          !props.$isRecovering &&
          !props.$isThrowingSalt &&
          !props.$isThrowingSnowball &&
          !props.$isSpawningPumoArmy &&
          !props.$isBowing
        ? "breathe 1.5s ease-in-out infinite"
        : "none",
      width: props.$isAtTheRopes && props.$fighter === "player 1"
        ? "min(15.612%, 480px)"  // 6% smaller: 16.609 * 0.94
        : "min(16.609%, 511px)",
      height: "auto",
      // PERFORMANCE: Reduced willChange - only specify transform (most frequent)
      willChange: "transform",
      pointerEvents: "none",
      transformOrigin: "center bottom",
      transition: "none",
    },
  }))`
  /* PERFORMANCE: Optimized keyframes - reduced drop-shadows from 4+ to 1-2 */
  @keyframes rawParryFlash {
    0% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 2px rgba(0, 150, 255, 0.4)) brightness(1);
    }
    25% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 12px rgba(0, 150, 255, 0.9)) brightness(1.6);
    }
    50% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(0, 150, 255, 0.7)) brightness(1.3);
    }
    75% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 12px rgba(0, 150, 255, 0.9)) brightness(1.6);
    }
    100% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 2px rgba(0, 150, 255, 0.4)) brightness(1);
    }
  }
  @keyframes grabBreakFlash {
    0% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 2px rgba(0, 255, 128, 0.45)) brightness(1);
    }
    25% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 12px rgba(0, 255, 128, 0.95)) brightness(1.7);
    }
    50% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(0, 255, 128, 0.75)) brightness(1.4);
    }
    75% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 12px rgba(0, 255, 128, 0.95)) brightness(1.7);
    }
    100% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 2px rgba(0, 255, 128, 0.45)) brightness(1);
    }
  }
  
  /* Hit impact animation - heavy sumo palm/headbutt impact with recoil */
  @keyframes hitSquash {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) rotate(0deg);
      filter: drop-shadow(0 0 1px #000) contrast(1.2) brightness(1);
    }
    /* IMPACT - hard compression, bright flash */
    6% {
      transform: scaleX(calc(var(--facing, 1) * 1.25)) scaleY(0.75) translateX(calc(var(--facing, 1) * -3%)) rotate(calc(var(--facing, 1) * 2deg));
      filter: drop-shadow(0 0 1px #000) contrast(1.5) brightness(1.8);
    }
    /* Recoil - shoved back hard, body whips */
    18% {
      transform: scaleX(calc(var(--facing, 1) * 0.88)) scaleY(1.12) translateX(calc(var(--facing, 1) * -5%)) rotate(calc(var(--facing, 1) * -4deg));
      filter: drop-shadow(0 0 1px #000) contrast(1.35) brightness(1.4);
    }
    /* Secondary bounce - body weight shifts */
    35% {
      transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.92) translateX(calc(var(--facing, 1) * -2%)) rotate(calc(var(--facing, 1) * 1.5deg));
      filter: drop-shadow(0 0 1px #000) contrast(1.25) brightness(1.2);
    }
    /* Settling */
    55% {
      transform: scaleX(calc(var(--facing, 1) * 0.96)) scaleY(1.04) translateX(calc(var(--facing, 1) * -0.5%)) rotate(calc(var(--facing, 1) * -0.5deg));
      filter: drop-shadow(0 0 1px #000) contrast(1.2) brightness(1.15);
    }
    /* Back to normal */
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) rotate(0deg);
      filter: drop-shadow(0 0 1px #000) contrast(1.2) brightness(1.15);
    }
  }
  
  /* Attack punch animation - wind up and release with facing direction */
  @keyframes attackPunch {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1);
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
    25% {
      transform: scaleX(calc(var(--facing, 1) * 0.9)) scaleY(1.1);
      filter: drop-shadow(0 0 1px #000) contrast(1.3) brightness(1.15);
    }
    55% {
      transform: scaleX(calc(var(--facing, 1) * 1.12)) scaleY(0.92);
      filter: drop-shadow(0 0 1px #000) contrast(1.25) brightness(1.1) drop-shadow(0 0 8px rgba(255, 200, 50, 0.6));
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1);
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
  }
  
  /* Charge pulse animation - builds anticipation for charged attack */
  @keyframes chargePulse {
    0% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(255, 200, 50, 0.5)) contrast(1.2);
    }
    50% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 18px rgba(255, 150, 0, 0.9)) contrast(1.35) brightness(1.1);
    }
    100% {
      filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(255, 200, 50, 0.5)) contrast(1.2);
    }
  }
  
  /* Lively idle animation - smooth rhythmic stretch from feet */
  @keyframes breathe {
    0%, 100% {
      transform: scaleX(var(--facing, 1)) scaleY(1);
    }
    50% {
      transform: scaleX(var(--facing, 1)) scaleY(1.03);
    }
  }
  
  /* ICE PHYSICS: Braking animation - penguin digs in to stop sliding */
  @keyframes iceBrake {
    0%, 100% {
      transform: scaleX(var(--facing, 1)) scaleY(0.96) rotate(calc(var(--facing, 1) * 3deg));
    }
    50% {
      transform: scaleX(var(--facing, 1)) scaleY(0.94) rotate(calc(var(--facing, 1) * 5deg));
    }
  }
  
  /* Power slide - more squished down with bounce */
  @keyframes powerSlide {
    0%, 100% {
      transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.88) translateY(6px);
    }
    50% {
      transform: scaleX(calc(var(--facing, 1) * 1.10)) scaleY(0.85) translateY(8px);
    }
  }
  
  /* At the ropes wobble - showing off-balance fear and panic */
  @keyframes atTheRopesWobble {
    0%, 100% {
      transform: scaleX(var(--facing, 1)) scaleY(0.95) rotate(0deg) translateX(0);
    }
    25% {
      transform: scaleX(var(--facing, 1)) scaleY(0.95) rotate(-4deg) translateX(-2px) translateY(1px);
    }
    50% {
      transform: scaleX(var(--facing, 1)) scaleY(0.95) rotate(2deg) translateX(1px) translateY(-1px);
    }
    75% {
      transform: scaleX(var(--facing, 1)) scaleY(0.95) rotate(-2deg) translateX(-1px) translateY(1px);
    }
  }
  
  /* Grab clash struggling animation - rapid horizontal shake */
  @keyframes grabClashStruggle {
    0% {
      transform: scaleX(var(--facing, 1)) translateX(0px);
    }
    25% {
      transform: scaleX(var(--facing, 1)) translateX(-3px);
    }
    50% {
      transform: scaleX(var(--facing, 1)) translateX(0px);
    }
    75% {
      transform: scaleX(var(--facing, 1)) translateX(3px);
    }
    100% {
      transform: scaleX(var(--facing, 1)) translateX(0px);
    }
  }

  /* Slap attack animation - subtle motion blur */
  @keyframes slapRush {
    0%, 100% {
      transform: scaleX(var(--facing, 1));
      filter: drop-shadow(0 0 1px #000) contrast(1.2) blur(0.3px);
    }
    50% {
      transform: scaleX(var(--facing, 1));
      filter: drop-shadow(0 0 1px #000) contrast(1.2) blur(0.6px);
    }
  }
  
  /* Attempting grab throw animation - slower, more deliberate pulling motion */
  @keyframes attemptingGrabThrowPull {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      transform-origin: center bottom;
    }
    25% {
      transform: scaleX(calc(var(--facing, 1) * 0.95)) scaleY(1.08) translateY(-3px);
      transform-origin: center bottom;
    }
    50% {
      transform: scaleX(calc(var(--facing, 1) * 0.97)) scaleY(1.06) translateY(-4px);
      transform-origin: center bottom;
    }
    75% {
      transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.04) translateY(-2px);
      transform-origin: center bottom;
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      transform-origin: center bottom;
    }
  }
  
  /* DODGE ANIMATIONS - Smooth graceful arc with subtle squash/stretch */
  
  /* Dodge takeoff - gentle squash then smooth stretch */
  @keyframes dodgeTakeoff {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
    20% {
      transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.88) translateY(0);
      filter: drop-shadow(0 0 1px #000) contrast(1.25) brightness(1.05);
    }
    50% {
      transform: scaleX(calc(var(--facing, 1) * 0.94)) scaleY(1.08) translateY(-2px);
      filter: drop-shadow(0 0 1px #000) contrast(1.22) brightness(1.08);
    }
    80% {
      transform: scaleX(calc(var(--facing, 1) * 0.97)) scaleY(1.04) translateY(-1px);
      filter: drop-shadow(0 0 1px #000) contrast(1.2) brightness(1.03);
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
  }
  
  /* Dodge cancel slam - smooth drop with impact squash */
  @keyframes dodgeCancelSlam {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
    40% {
      transform: scaleX(calc(var(--facing, 1) * 0.94)) scaleY(1.08) translateY(1px);
      filter: drop-shadow(0 0 1px #000) contrast(1.22) brightness(1.05);
    }
    70% {
      transform: scaleX(calc(var(--facing, 1) * 1.12)) scaleY(0.82) translateY(0);
      filter: drop-shadow(0 0 1px #000) contrast(1.28) brightness(1.1);
    }
    90% {
      transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.03) translateY(0);
      filter: drop-shadow(0 0 1px #000) contrast(1.22);
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
  }
  
  /* Dodge landing - gentle impact squash with smooth recovery */
  @keyframes dodgeLanding {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
    25% {
      transform: scaleX(calc(var(--facing, 1) * 1.06)) scaleY(0.88) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(0 0 1px #000) contrast(1.24) brightness(1.05);
    }
    55% {
      transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.04) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(0 0 1px #000) contrast(1.21) brightness(1.02);
    }
    80% {
      transform: scaleX(calc(var(--facing, 1) * 1.02)) scaleY(0.99) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(0 0 1px #000) contrast(1.2);
    }
  }
  
  /* Raw parry success animation - defensive recoil and recovery */
  @keyframes rawParryRecoil {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0);
      transform-origin: center bottom;
    }
    10% {
      transform: scaleX(calc(var(--facing, 1) * 1.05)) scaleY(0.95) translateX(calc(var(--facing, 1) * -8px));
      transform-origin: center bottom;
    }
    25% {
      transform: scaleX(calc(var(--facing, 1) * 0.92)) scaleY(1.08) translateX(calc(var(--facing, 1) * -5px));
      transform-origin: center bottom;
    }
    45% {
      transform: scaleX(calc(var(--facing, 1) * 1.03)) scaleY(0.97) translateX(calc(var(--facing, 1) * 3px));
      transform-origin: center bottom;
    }
    65% {
      transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.02) translateX(calc(var(--facing, 1) * -2px));
      transform-origin: center bottom;
    }
    85% {
      transform: scaleX(calc(var(--facing, 1) * 1.01)) scaleY(0.99) translateX(calc(var(--facing, 1) * 1px));
      transform-origin: center bottom;
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0);
      transform-origin: center bottom;
    }
  }
`;

// Ritual Sprite Sheet Container - clips to show one frame with extra clipping to prevent bleed
const RitualSpriteContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    width: "min(16.609%, 511px)",
    aspectRatio: "1",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
    overflow: "hidden",
    zIndex: 99,
    pointerEvents: "none",
    // Clip from left/right edges to prevent sub-pixel bleed from adjacent frames
    clipPath: "inset(0 1.5% 0 1.5%)",
  },
}))``;

// Sprite sheet image - positioned to show current frame
const RitualSpriteImage = styled.img.attrs((props) => {
  // Clamp frame to valid range to prevent showing invalid frames
  const safeFrame = Math.max(0, Math.min(props.$frame, props.$frameCount - 1));
  // Each frame is 1/frameCount of the total image width
  const offsetPercent = (safeFrame / props.$frameCount) * 100;
  return {
    style: {
      position: "relative",
      display: "block",
      height: "100%",
      width: "auto",
      // Use translate3d for GPU acceleration and more precise rendering
      transform: `translate3d(-${offsetPercent}%, 0, 0)`,
      willChange: "transform",
      backfaceVisibility: "hidden",
        // PERFORMANCE: Reduced drop-shadows
        filter: "drop-shadow(0 0 1px #000) contrast(1.2)",
    },
  };
})``;

// Animated Fighter Sprite Container - for spritesheet animations (like waddle, hit, bow)
const AnimatedFighterContainer = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      !["x", "y", "facing", "fighter", "isThrowing", "isDodging", "isGrabbing", 
        "isRingOutThrowCutscene", "isAtTheRopes", "isHit"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "min(16.609%, 511px)",
      aspectRatio: "1",
      left: props.$isAtTheRopes && props.$fighter === "player 1"
        ? `${((props.$x + (props.$x < 640 ? -5 : 5)) / 1280) * 100}%`
        : `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      "--facing": props.$facing === 1 ? "1" : "-1",
      transform: props.$facing === 1
        ? "scaleX(1)"
        : "scaleX(-1)",
      overflow: "hidden",
      zIndex: isOutsideDohyo(props.$x, props.$y) ? 0 : // Behind dohyo overlay when outside
        props.$isThrowing || props.$isDodging || props.$isGrabbing ? 98 : 99,
      pointerEvents: "none",
      // Clip edges to prevent sub-pixel bleed from adjacent frames
      clipPath: "inset(0 0.5% 0 0.5%)",
      transformOrigin: "center bottom",
      animation: props.$isHit ? "hitSquashContainer 0.28s cubic-bezier(0.22, 0.6, 0.35, 1)" : "none",
    },
  }))`
  /* Hit impact animation for animated sprite container - sumo palm/headbutt */
  @keyframes hitSquashContainer {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) rotate(0deg);
    }
    /* IMPACT - hard compression */
    6% {
      transform: scaleX(calc(var(--facing, 1) * 1.25)) scaleY(0.75) translateX(calc(var(--facing, 1) * -3%)) rotate(calc(var(--facing, 1) * 2deg));
    }
    /* Recoil - shoved back hard, body whips */
    18% {
      transform: scaleX(calc(var(--facing, 1) * 0.88)) scaleY(1.12) translateX(calc(var(--facing, 1) * -5%)) rotate(calc(var(--facing, 1) * -4deg));
    }
    /* Secondary bounce - body weight shifts */
    35% {
      transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.92) translateX(calc(var(--facing, 1) * -2%)) rotate(calc(var(--facing, 1) * 1.5deg));
    }
    /* Settling */
    55% {
      transform: scaleX(calc(var(--facing, 1) * 0.96)) scaleY(1.04) translateX(calc(var(--facing, 1) * -0.5%)) rotate(calc(var(--facing, 1) * -0.5deg));
    }
    /* Back to normal */
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateX(0) rotate(0deg);
    }
  }
`;

// Animated Fighter Sprite Image - CSS-based animation for PERFORMANCE
// Uses CSS animation with steps() instead of React state updates
// This moves animation to GPU and avoids 30-40 React re-renders per second
const AnimatedFighterImage = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      !["frameCount", "fps", "loop", "isLocalPlayer", "isAtTheRopes", "isGrabBreaking",
        "isRawParrying", "isHit", "isChargingAttack", "isGrabClashActive", "animationKey"].includes(prop),
  })
  .attrs((props) => {
    // Calculate animation duration based on fps and frame count
    const frameCount = props.$frameCount || 1;
    const fps = props.$fps || 30;
    const duration = frameCount / fps; // seconds for full animation cycle
    
    // Calculate total width percentage for the full animation offset
    // The image moves from 0% to -(100% - 100%/frameCount) 
    const totalOffset = ((frameCount - 1) / frameCount) * 100;
    
    return {
      style: {
        position: "relative",
        display: "block",
        height: "100%",
        width: "auto",
        backfaceVisibility: "hidden",
        // PERFORMANCE: Reduced drop-shadows from 4+ to 1 outline + effects
        filter: props.$isAtTheRopes
          ? "drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(255, 50, 50, 0.7)) brightness(1.15) contrast(1.25)"
          : props.$isGrabBreaking
          ? "drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(0, 255, 128, 0.85)) brightness(1.35)"
          : props.$isRawParrying
          ? "drop-shadow(0 0 1px #000) drop-shadow(0 0 8px rgba(0, 150, 255, 0.8)) brightness(1.3)"
          : props.$isHit
          ? "drop-shadow(0 0 1px #000) contrast(1.2) brightness(1.15)"
          : props.$isChargingAttack
          ? "drop-shadow(0 0 1px #000) drop-shadow(0 0 12px rgba(255, 200, 50, 0.85)) contrast(1.25)"
          : props.$isGrabClashActive
          ? "drop-shadow(0 0 1px #000) contrast(1.25) brightness(1.1)"
          : "drop-shadow(0 0 1px #000) contrast(1.2)",
        // CSS-based spritesheet animation - no React state updates needed!
        animation: frameCount > 1 
          ? `spritesheet-${frameCount} ${duration}s steps(${frameCount - 1}) ${props.$loop !== false ? 'infinite' : 'forwards'}`
          : 'none',
        // Use animationKey to force restart animation when sprite changes
        animationName: frameCount > 1 ? `spritesheet-${frameCount}` : 'none',
      },
    };
  })`
  /* Generate keyframes for common frame counts (2-25) */
  @keyframes spritesheet-2 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-50%, 0, 0); }
  }
  @keyframes spritesheet-3 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-66.667%, 0, 0); }
  }
  @keyframes spritesheet-4 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-75%, 0, 0); }
  }
  @keyframes spritesheet-5 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-80%, 0, 0); }
  }
  @keyframes spritesheet-6 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-83.333%, 0, 0); }
  }
  @keyframes spritesheet-7 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-85.714%, 0, 0); }
  }
  @keyframes spritesheet-8 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-87.5%, 0, 0); }
  }
  @keyframes spritesheet-9 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-88.889%, 0, 0); }
  }
  @keyframes spritesheet-10 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-90%, 0, 0); }
  }
  @keyframes spritesheet-11 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-90.909%, 0, 0); }
  }
  @keyframes spritesheet-12 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-91.667%, 0, 0); }
  }
  @keyframes spritesheet-13 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-92.308%, 0, 0); }
  }
  @keyframes spritesheet-14 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-92.857%, 0, 0); }
  }
  @keyframes spritesheet-15 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-93.333%, 0, 0); }
  }
  @keyframes spritesheet-16 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-93.75%, 0, 0); }
  }
  @keyframes spritesheet-17 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-94.118%, 0, 0); }
  }
  @keyframes spritesheet-18 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-94.444%, 0, 0); }
  }
  @keyframes spritesheet-19 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-94.737%, 0, 0); }
  }
  @keyframes spritesheet-20 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-95%, 0, 0); }
  }
  @keyframes spritesheet-21 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-95.238%, 0, 0); }
  }
  @keyframes spritesheet-22 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-95.455%, 0, 0); }
  }
  @keyframes spritesheet-23 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-95.652%, 0, 0); }
  }
  @keyframes spritesheet-24 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-95.833%, 0, 0); }
  }
  @keyframes spritesheet-25 {
    from { transform: translate3d(0%, 0, 0); }
    to { transform: translate3d(-96%, 0, 0); }
  }
`;

const CountdownTimer = styled.div`
  position: absolute;
  opacity: 0;
  font-family: "Bungee";
  font-size: clamp(1rem, 3vw, 2.5rem);
  color: rgb(255, 0, 0);
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000;
  pointer-events: none;
  bottom: 80.5%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
`;

const SaltBasket = styled.img
  .withConfig({
    shouldForwardProp: (prop) => !["isVisible", "index"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "4.55%",
      height: "auto",
      bottom: `${((GROUND_LEVEL + 100) / 720) * 140}%`,
      left: props.$index === 0 ? "12.5%" : "auto",
      right: props.$index === 1 ? "13.8%" : "auto",
      transform: props.$index === 1 ? "scaleX(-1)" : "none",
      zIndex: 1,
      pointerEvents: "none",
      opacity: props.$isVisible ? 1 : 0,
      transition: "opacity 0.3s ease",
    },
  }))``;

const youLabelPulse = keyframes`
  0%, 100% { 
    transform: translateX(-50%) scale(1);
    filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.6));
  }
  50% { 
    transform: translateX(-50%) scale(1.05);
    filter: drop-shadow(0 0 14px rgba(212, 175, 55, 0.9));
  }
`;

const youArrowBounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
`;

const YouLabel = styled.div
  .withConfig({
    shouldForwardProp: (prop) => !["x", "y"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      bottom: `${(props.y / 720) * 100 + 27}%`,
      left: `${(props.x / 1280) * 100 + 8.2}%`,
    },
  }))`
  z-index: 1000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  transform: translateX(-50%);
  animation: ${youLabelPulse} 1.5s ease-in-out infinite;
  
  /* Main banner */
  &::before {
    content: "YOU";
    font-family: "Bungee", cursive;
    font-size: clamp(12px, 1.1vw, 16px);
    letter-spacing: 0.1em;
    color:rgb(255, 223, 120);
    background: linear-gradient(
      180deg,
      rgba(11, 16, 32, 0.95) 0%,
      rgba(67, 61, 103, 0.9) 100%
    );
    padding: clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px);
    border: 2px solid rgba(212, 175, 55, 0.8);
    border-radius: 4px;
    text-shadow: 0 0 8px rgba(212, 175, 55, 0.5);
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  
  /* Arrow pointer */
  &::after {
    content: "";
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 10px solid rgba(212, 175, 55, 0.9);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
    animation: ${youArrowBounce} 0.8s ease-in-out infinite;
  }
`;

const SnowballProjectile = styled.img
  .withConfig({
    shouldForwardProp: (prop) => !["$x", "$y"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: "4.55%",
      height: "auto",
      left: `${(props.$x / 1280) * 100 + 5}%`,
      bottom: `${(props.$y / 720) * 100 + 14}%`,
      zIndex: 95,
      pointerEvents: "none",
      filter: "drop-shadow(0 0 1px #000)",
    },
  }))``;

const PumoClone = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$x", "$y", "$facing", "$size"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: `${(props.$size || 0.6) * 19.54}%`,
      height: "auto",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      transform: `scaleX(${props.$facing * -1})`,
      zIndex: (props.$x < -20 || props.$x > 1075) || props.$y < (GROUND_LEVEL - 35) ? 0 : 98,
      pointerEvents: "none",
      filter: "drop-shadow(0 0 1px #000) contrast(1.3)",
    },
  }))``;

// Animated Pumo Clone Container - clips to one frame of the spritesheet
const AnimatedPumoCloneContainer = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$x", "$y", "$facing", "$size"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: `${(props.$size || 0.6) * 19.54}%`,
      aspectRatio: "1",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      transform: `scaleX(${props.$facing * -1})`,
      zIndex: (props.$x < -20 || props.$x > 1075) || props.$y < (GROUND_LEVEL - 35) ? 0 : 98,
      pointerEvents: "none",
      overflow: "hidden",
      clipPath: "inset(0 0.5% 0 0.5%)",
    },
  }))``;

// Animated Pumo Clone Image - CSS spritesheet animation (same approach as AnimatedFighterImage)
const AnimatedPumoCloneImage = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$frameCount", "$fps"].includes(prop),
  })
  .attrs((props) => {
    const frameCount = props.$frameCount || 1;
    const fps = props.$fps || 30;
    const duration = frameCount / fps;
    return {
      style: {
        position: "relative",
        display: "block",
        height: "100%",
        width: "auto",
        backfaceVisibility: "hidden",
        filter: "drop-shadow(0 0 1px #000) contrast(1.3)",
        animation: frameCount > 1
          ? `spritesheet-${frameCount} ${duration}s steps(${frameCount - 1}) infinite`
          : "none",
      },
    };
  })``;

const OpponentDisconnectedOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
`;

const DisconnectedModal = styled.div`
  background: linear-gradient(
    135deg,
    rgba(28, 28, 28, 0.95),
    rgba(18, 18, 18, 0.95)
  );
  border: 2px solid #8b4513;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
  min-width: 400px;
`;

const DisconnectedTitle = styled.h2`
  font-family: "Bungee", cursive;
  font-size: 1.8rem;
  color: #d4af37;
  margin: 0 0 1rem 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
`;

const DisconnectedMessage = styled.p`
  font-family: "Noto Sans JP", sans-serif;
  font-size: 1.2rem;
  color: #ffffff;
  margin: 0 0 2rem 0;
  font-weight: 600;
`;

// ExitButton removed - no longer needed with automatic exit

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
}) => {
  const { socket } = useContext(SocketContext);
  
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
  const targetColor = playerColor || (playerNumber === 1 ? SPRITE_BASE_COLOR : COLOR_PRESETS.red);
  // Only skip recoloring if target color is blue (sprites are already blue)
  const needsRecoloring = targetColor !== SPRITE_BASE_COLOR;
  // Both players use BLUE_COLOR_RANGES since all sprites are blue
  const colorRanges = BLUE_COLOR_RANGES;
  
  // Get both player colors for pumo clone coloring
  const { player1Color: p1Color, player2Color: p2Color } = usePlayerColors();
  
  // Function to get sprite render info (handles both static and animated sprites)
  // Returns: { src, isAnimated, config } where config contains spritesheet animation data
  const getSpriteRenderInfo = useCallback((originalSrc) => {
    if (!originalSrc) {
      return { src: originalSrc, isAnimated: false, config: null };
    }
    
    // Check if this is an animated spritesheet
    const spritesheetConfig = getSpritesheetConfig(originalSrc);
    const isAnimated = !!spritesheetConfig;
    
    // Determine the source to recolor (spritesheet for animated, original for static)
    const sourceToRecolor = isAnimated ? spritesheetConfig.spritesheet : originalSrc;
    
    if (!needsRecoloring) {
      return {
        src: sourceToRecolor,
        isAnimated,
        config: spritesheetConfig,
      };
    }
    
    // FIRST: Check global cache (populated by preloadSprites in Lobby)
    // This is synchronous and avoids any flash of wrong color
    const globalCached = getCachedRecoloredImage(sourceToRecolor, colorRanges, targetColor);
    if (globalCached) {
      return {
        src: globalCached,
        isAnimated,
        config: spritesheetConfig,
      };
    }
    
    // Check local cache as fallback
    const cacheKey = `${sourceToRecolor}_${targetColor}`;
    if (recoloredSprites[cacheKey]) {
      return {
        src: recoloredSprites[cacheKey],
        isAnimated,
        config: spritesheetConfig,
      };
    }
    
    // Skip GIFs (they can't be recolored with canvas) - but use spritesheet if available
    if (typeof originalSrc === 'string' && originalSrc.includes('.gif') && !isAnimated) {
      return { src: originalSrc, isAnimated: false, config: null };
    }
    
    // Start async recoloring if not already in progress (fallback for uncached sprites)
    if (!recoloringInProgress.current.has(cacheKey)) {
      recoloringInProgress.current.add(cacheKey);
      recolorImage(sourceToRecolor, colorRanges, targetColor)
        .then((recolored) => {
          setRecoloredSprites(prev => ({
            ...prev,
            [cacheKey]: recolored
          }));
        })
        .catch((err) => {
          console.error('Failed to recolor sprite:', err);
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
  }, [needsRecoloring, targetColor, colorRanges, recoloredSprites]);
  
  // Backwards compatible wrapper for simple recoloring (ritual spritesheets, etc.)
  const getRecoloredSrc = useCallback((originalSrc) => {
    return getSpriteRenderInfo(originalSrc).src;
  }, [getSpriteRenderInfo]);

  // ============================================
  // SPRITESHEET ANIMATION STATE
  // PERFORMANCE: Sprite animation now handled by CSS (no React state needed)
  // ============================================
  const lastSpriteSrcRef = useRef(null);
  
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
  const canPredictAction = useCallback((gameStarted) => {
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
  }, [penguin]);

  // Helper: Check if player can dodge (more permissive - allows during charging)
  const canPredictDodge = useCallback((gameStarted) => {
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
  }, [penguin]);

  // Function to apply a prediction (called from Game.jsx via callback)
  const applyPrediction = useCallback((action) => {
    if (!isLocalPlayer) return;
    
    // Get game started state from action (passed from Game.jsx)
    const gameStarted = action.gameStarted;
    
    const now = performance.now();
    
    // OPTIMIZATION: Track if prediction actually changed to avoid unnecessary re-renders
    let predictionChanged = false;
    
    switch (action.type) {
      case 'slap':
        // Only predict if we can perform actions AND not already charging
        if (canPredictAction(gameStarted) && !penguin.isChargingAttack) {
          predictedState.current = {
            ...predictedState.current,
            isSlapAttack: true,
            isAttacking: true,
            slapAnimation: (predictedState.current.slapAnimation === 1) ? 2 : 1,
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
      case 'charge_start':
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
      case 'charge_release':
        // Only predict release if we were charging
        if (penguin.isChargingAttack || predictedState.current.isChargingAttack) {
          // CRITICAL: If dodging, don't predict isAttacking - server stores it as pending
          // and executes AFTER dodge ends. Setting isAttacking during dodge causes
          // attack animation to show during dodge.
          const isDodging = penguin.isDodging || predictedState.current.isDodging;
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
      case 'dodge':
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
      case 'parry_start':
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
      case 'parry_release':
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
      case 'grab':
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
      case 'power_slide_start':
        // Predict power sliding when C/CTRL pressed
        // Must match server's canPowerSlide conditions (server-io/index.js line 2898)
        // NOTE: isChargingAttack is NOT blocked - can power slide while charging!
        // CRITICAL: gameStarted check prevents visual squish before hakkiyoi and after match ends
        // CRITICAL: velocity check prevents visual squish when standing still or moving too slow
        const SLIDE_MIN_VELOCITY = 0.5; // Must match server (server-io/index.js line 209)
        const hasEnoughVelocity = Math.abs(penguin.movementVelocity || 0) >= SLIDE_MIN_VELOCITY;
        if (gameStarted &&
            hasEnoughVelocity &&
            !penguin.isDodging && 
            !penguin.isThrowing &&
            !penguin.isGrabbing && 
            !penguin.isWhiffingGrab &&
            !penguin.isAttacking &&
            // isChargingAttack is allowed - can slide while charging
            !penguin.isRecovering &&
            !penguin.isRawParrying &&
            !penguin.isHit &&
            !penguin.isBeingGrabbed &&
            !penguin.isBeingThrown &&
            !penguin.isAtTheRopes &&
            !penguin.isGrabClashing &&
            !penguin.isGrabBreaking &&
            !penguin.isGrabBreakSeparating &&
            // Check we're not already predicting power slide
            !predictedState.current.isPowerSliding) {
          predictedState.current = {
            ...predictedState.current,
            isPowerSliding: true,
            isBraking: false,
            timestamp: now,
          };
          predictionChanged = true;
        }
        break;
      case 'power_slide_end':
        // Clear power sliding prediction when C/CTRL released (only if was predicting)
        if (predictedState.current.isPowerSliding) {
          predictedState.current = {
            ...predictedState.current,
            isPowerSliding: false,
            timestamp: now,
          };
          predictionChanged = true;
        }
        break;
      case 'brake_start':
        // Predict braking when holding opposite direction while sliding
        if (!penguin.isAttacking && !penguin.isDodging && !penguin.isGrabbing &&
            !penguin.isBeingGrabbed && !penguin.isRawParrying && !penguin.isHit &&
            !penguin.isPowerSliding && !predictedState.current.isPowerSliding &&
            !predictedState.current.isBraking) {
          predictedState.current = {
            ...predictedState.current,
            isBraking: true,
            timestamp: now,
          };
          predictionChanged = true;
        }
        break;
      case 'brake_end':
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
      case 'clear':
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
      setPredictionTrigger(prev => prev + 1);
    }
  }, [isLocalPlayer, canPredictAction, canPredictDodge, penguin.isChargingAttack, 
      penguin.isRawParrying, penguin.facing, penguin.isAttacking, penguin.isDodging,
      penguin.isGrabbing, penguin.isBeingGrabbed, penguin.isHit, penguin.isRecovering,
      penguin.isAtTheRopes, penguin.isPowerSliding, penguin.isThrowing, penguin.isWhiffingGrab,
      penguin.isBeingThrown, penguin.isGrabClashing, penguin.isGrabBreaking, 
      penguin.isGrabBreakSeparating]);
  
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
    if (prediction.timestamp === 0 || predictionAge > PREDICTION_TIMEOUT_MS) {
      return penguin;
    }
    
    // Server state takes priority if it shows a conflicting state
    // (e.g., server says we got hit, trust that over our attack prediction)
    if (penguin.isHit || penguin.isBeingGrabbed || penguin.isBeingThrown || 
        penguin.isRawParryStun || penguin.isAtTheRopes || penguin.isRecovering ||
        penguin.isGrabBreaking || penguin.isGrabBreakCountered || penguin.isThrowTeching ||
        penguin.isDead || penguin.isThrowing || penguin.isGrabbing) {
      // Clear ALL predictions when server shows we're in a "victim" or conflicting state
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
      return penguin;
    }
    
    // CRITICAL: If server shows action has ENDED but we predicted it's active,
    // the server is authoritative - clear the prediction
    // This prevents "stuck" visual states
    
    // If we predicted slap but server says no slap AND no attacking, server wins
    if (prediction.isSlapAttack && !penguin.isSlapAttack && !penguin.isAttacking) {
      predictedState.current.isSlapAttack = false;
      predictedState.current.isAttacking = false;
    }
    // If server CONFIRMS the action, also clear prediction (server has correct timing)
    else if (prediction.isSlapAttack && penguin.isSlapAttack) {
      predictedState.current.isSlapAttack = false;
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
    // If server says no sliding but we predicted it, trust server (might not have enough velocity)
    if (prediction.isPowerSliding && penguin.isPowerSliding) {
      predictedState.current.isPowerSliding = false; // Server confirmed, clear prediction
    } else if (prediction.isPowerSliding && !penguin.isPowerSliding) {
      // Server says no sliding - could be velocity too low or state blocked
      // Give server authority after a short time
      if (predictionAge > 50) {
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
    if (!p.isSlapAttack && !p.isAttacking && !p.isDodging && 
        !p.isChargingAttack && !p.isRawParrying && !p.isGrabbing &&
        !p.isPowerSliding && !p.isBraking) {
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
  const [counterGrabEffectPosition, setCounterGrabEffectPosition] = useState(null);
  const [punishBannerPosition, setPunishBannerPosition] = useState(null);
  const [snowballImpactPosition, setSnowballImpactPosition] = useState(null);
  const [counterHitEffectPosition, setCounterHitEffectPosition] = useState(null);
  
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
    const configs = index === 0 ? ritualSpritesheetsPlayer1 : ritualSpritesheetsPlayer2;
    return configs[ritualPart];
  }, [penguin.isInRitualPhase, index, ritualPart]);

  // For backward compatibility with existing code that checks ritualAnimationSrc
  // Use server state to determine if this specific player is in ritual phase
  // This allows each player to independently show/hide ritual based on their own state
  const shouldShowRitualForPlayer = penguin.isInRitualPhase === true;
  const ritualAnimationSrc = shouldShowRitualForPlayer ? "sprite" : null;

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
      penguin.isGrabBreakCountered,
      penguin.isGrabbingMovement,
      isGrabClashActive,
      penguin.isAttemptingGrabThrow,
      ritualAnimationSrc // Pass ritual animation if active
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
    penguin.isGrabBreakCountered,
    penguin.isGrabbingMovement,
    isGrabClashActive,
    penguin.isAttemptingGrabThrow,
    ritualAnimationSrc,
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

    const configs = index === 0 ? ritualSpritesheetsPlayer1 : ritualSpritesheetsPlayer2;
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
      if (shouldPlaySound && !soundPlayedThisPart && timeRemaining <= CLAP_SOUND_OFFSET) {
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

  // Interpolation: match server broadcast rate (server sends every N ticks)
  const SERVER_UPDATE_INTERVAL = 1000 / SERVER_BROADCAST_HZ;

  // Interpolation function for smooth movement
  const interpolatePosition = useCallback(
    (prevPos, currentPos, factor) => {
      // Don't interpolate discrete jumps (teleports, throws, hits)
      const maxInterpolationDistance = 100; // Don't interpolate if positions are too far apart
      const distance =
        Math.abs(currentPos.x - prevPos.x) + Math.abs(currentPos.y - prevPos.y);

      if (distance > maxInterpolationDistance) {
        return currentPos; // Use current position for teleports/throws
      }

      // Don't interpolate during certain states where position changes should be instant
      if (
        penguin.isBeingThrown ||
        penguin.isThrowing ||
        penguin.isHit ||
        penguin.isDodging
      ) {
        return currentPos;
      }

      return {
        x: prevPos.x + (currentPos.x - prevPos.x) * factor,
        y: prevPos.y + (currentPos.y - prevPos.y) * factor,
      };
    },
    [
      penguin.isBeingThrown,
      penguin.isThrowing,
      penguin.isHit,
      penguin.isDodging,
    ]
  );

  // MEMORY FIX: Ref for interpolation loop cleanup on unmount
  const interpolationIdRef = useRef(null);

  // Animation loop for interpolation - PERFORMANCE OPTIMIZED
  // Calculates position every frame but only updates React state at throttled rate
  const interpolationLoop = useCallback(
    (timestamp) => {
      let newPos = null;
      
      if (currentState.current && previousState.current) {
        const timeSinceUpdate = timestamp - lastUpdateTime.current;
        const interpolationFactor = Math.min(
          timeSinceUpdate / SERVER_UPDATE_INTERVAL,
          1
        );

        // Calculate interpolated position (stored in ref, no re-render)
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
        // Always update ref (no re-render)
        const prevPos = interpolatedPositionRef.current;
        interpolatedPositionRef.current = newPos;
        
        // PERFORMANCE: Only update React state if position changed noticeably
        // This gives 60fps smoothness while skipping imperceptible micro-updates
        const positionDelta = Math.abs(newPos.x - prevPos.x) + Math.abs(newPos.y - prevPos.y);
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
        y: position.y 
      };
    }
    
    return position;
  }, [interpolatedPosition, penguin.x, penguin.y, isGrabClashActive, penguin.facing]);

  // Function to handle exiting from disconnected game
  const handleExitDisconnectedGame = useCallback(() => {
    // Emit exit event to server
    if (disconnectedRoomId) {
      socket.emit("exit_disconnected_game", { roomId: disconnectedRoomId });
    }

    // Stop all music immediately
    if (eeshiMusicRef.current) {
      eeshiMusicRef.current.pause();
      eeshiMusicRef.current.currentTime = 0;
    }
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
    if (opponentDisconnected && eeshiMusicRef.current) {
      eeshiMusicRef.current.pause();
      eeshiMusicRef.current.currentTime = 0;
    }
  }, [opponentDisconnected]);

  const lastAttackState = useRef(false);
  const lastHitState = useRef(false);
  const lastThrowingSaltState = useRef(false);
  const lastThrowState = useRef(false);
  const lastDodgeState = useRef(false);
  const lastDodgeLandState = useRef(false);
  const lastGrabState = useRef(false);
  const lastThrowingSnowballState = useRef(false);
  const lastSpawningPumoArmyState = useRef(false);
  const lastRawParryState = useRef(false);
  const lastWinnerState = useRef(false);
  const lastWinnerSoundPlay = useRef(0);
  const lastHitSoundTime = useRef(0);
  const gameMusicRef = useRef(null);
  const eeshiMusicRef = useRef(null);

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
      
      if (data.isDelta && accumulatedPlayer1State.current && accumulatedPlayer2State.current) {
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
        // Add other continuous properties that might benefit from interpolation
        knockbackVelocity: playerData.knockbackVelocity,
      };

      // Update timing for interpolation
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
          isGrabBreaking: playerData.isGrabBreaking ?? prev.isGrabBreaking ?? false,
          isGrabBreakCountered: playerData.isGrabBreakCountered ?? prev.isGrabBreakCountered ?? false,
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
          prev.isStrafing !== newState.isStrafing ||  // Controls waddle animation!
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
          prev.isInRitualPhase !== newState.isInRitualPhase;
        
        if (!discreteStateChanged) {
          return prev; // No discrete state change, skip re-render
        }
        
        return newState;
      });

      // Update all snowballs from both players (only if present in update)
      if (player1Data.snowballs !== undefined || player2Data.snowballs !== undefined) {
        const combinedSnowballs = [
          ...(player1Data.snowballs || []),
          ...(player2Data.snowballs || []),
        ];
        setAllSnowballs(combinedSnowballs);
      }

      // Update all pumo armies from both players (only if present in update)
      // Tag each clone with ownerPlayerNumber so we can color them correctly
      if (player1Data.pumoArmy !== undefined || player2Data.pumoArmy !== undefined) {
        const combinedPumoArmies = [
          ...(player1Data.pumoArmy || []).map(clone => ({ ...clone, ownerPlayerNumber: 1 })),
          ...(player2Data.pumoArmy || []).map(clone => ({ ...clone, ownerPlayerNumber: 2 })),
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
          x: position.x + 150,
          y: position.y + 110, // Add GROUND_LEVEL to match player height
        });
        playSound(slapParrySound, 0.01);
      }
    });

    socket.on("player_hit", (data) => {
      if (data && typeof data.x === "number" && typeof data.y === "number") {
        setHitEffectPosition({
          x: data.x + 150,
          y: data.y + 110, // Add GROUND_LEVEL to match player height
          facing: data.facing || 1, // Default to 1 if facing not provided
          timestamp: data.timestamp, // Pass through unique timestamp
          hitId: data.hitId, // Pass through unique hit ID
          attackType: data.attackType || 'slap', // Pass attack type for distinct effects
          isCounterHit: data.isCounterHit || false, // Counter hit for orange effect
        });
      }
    });

    socket.on("raw_parry_success", (data) => {
      if (data && typeof data.parrierX === "number") {
        // Position effect in front of the parrying player (where a hit effect would appear)
        const facing = data.facing || 1;
        // Offset in front of the parrier based on facing direction
        const frontOffset = facing === 1 ? 80 : -80;
        const effectData = {
          x: data.parrierX + 150 + frontOffset,
          y: GROUND_LEVEL + 110,
          facing: facing,
          timestamp: data.timestamp,
          parryId: data.parryId,
          isPerfect: data.isPerfect || false,
          playerNumber: data.playerNumber || 1,
        };
        setRawParryEffectPosition(effectData);
        // Play different sounds for regular vs perfect parry
        if (data.isPerfect) {
          playSound(rawParrySuccessSound, 0.01);
        } else {
          playSound(regularRawParrySound, 0.03);
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
        if (data && typeof data.breakerX === "number" && typeof data.grabberX === "number") {
          // Calculate center position between breaker and grabber
          const centerX = (data.breakerX + data.grabberX) / 2;
          setGrabBreakEffectPosition({
            x: centerX + 150,
            y: GROUND_LEVEL + 110,
            breakId: data.breakId || `break-${Date.now()}`,
            breakerPlayerNumber: data.breakerPlayerNumber || 1,
          });
          playSound(grabBreakSound, 0.01);
        }
      });

      // Counter grab effect - only when grabbing opponent during their raw parry (LOCKED! + Counter Grab banner)
      socket.on("counter_grab", (data) => {
        if (data?.type !== "counter_grab") return;
        const x = typeof data.x === "number" ? data.x + 150 : (data.grabberX + data.grabbedX) / 2 + 150;
        const y = typeof data.y === "number" ? data.y : GROUND_LEVEL + 110;
        setCounterGrabEffectPosition({
          type: "counter_grab",
          x,
          y,
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

      // Snowball impact effect
      socket.on("snowball_hit", (data) => {
        if (data && typeof data.x === "number" && typeof data.y === "number") {
          setSnowballImpactPosition({
            x: data.x + 150,
            y: data.y + 50,
            hitId: data.hitId || `snowball-${Date.now()}`,
          });
        }
      });

      // Counter hit effect - when active frames hit opponent's startup frames
      socket.on("counter_hit", (data) => {
        if (data && typeof data.x === "number" && typeof data.y === "number") {
          setCounterHitEffectPosition({
            x: data.x + 150,
            y: GROUND_LEVEL + 110,
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
            setNoStaminaEffectKey((current) => (current === newKey ? 0 : current));
          }, 900);
        }
      });
    }
    
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
      const thisPlayerData = data.player1.playerId === player.id ? data.player1 : data.player2;
      
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
      if (eeshiMusicRef.current) {
        eeshiMusicRef.current.pause();
        eeshiMusicRef.current.currentTime = 0;
      }
      if (gameMusicRef.current) {
        gameMusicRef.current.loop = true;
        gameMusicRef.current.play().catch((e) => {
          if (e.name !== "AbortError") console.error("Game music play error:", e);
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
      
      // Add winner to round history (MEMORY FIX: cap at 250 for best-of-127 support)
      const winnerName = data.winner.fighter === "player 1" ? "player1" : "player2";
      setRoundHistory(prev => [...prev.slice(-249), winnerName]);
      
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
      if (showRoundResultRafRef.current) cancelAnimationFrame(showRoundResultRafRef.current);
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
      // Only restart eeshi music if opponent hasn't disconnected
      if (!opponentDisconnected && eeshiMusicRef.current) {
        eeshiMusicRef.current.loop = true;
        eeshiMusicRef.current.play().catch((e) => {
          if (e.name !== "AbortError") console.error("Eeshi music play error:", e);
        });
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
        socket.off("counter_grab");
        socket.off("punish_banner");
        socket.off("snowball_hit");
        socket.off("stamina_blocked");
        socket.off("counter_hit"); // Fix: was missing cleanup
      }
      socket.off("grab_clash_start");
      socket.off("grab_clash_end");
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
      gameMusicRef.current.volume = 0.009;
    }
    if (!eeshiMusicRef.current) {
      eeshiMusicRef.current = new Audio(eeshiMusic);
      eeshiMusicRef.current.volume = 0.009;
      eeshiMusicRef.current.loop = true;
    }

    if (!opponentDisconnected) {
      eeshiMusicRef.current.play().catch((e) => {
        if (e.name !== "AbortError") console.error("Eeshi music play error:", e);
      });
    }

    return () => {
      if (eeshiMusicRef.current) {
        eeshiMusicRef.current.pause();
        eeshiMusicRef.current.currentTime = 0;
      }
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
      playSound(attackSound, 0.01);
    }
    // Update the last attack state
    lastAttackState.current = penguin.isAttacking && !penguin.isSlapAttack;
  }, [penguin.isAttacking, penguin.isSlapAttack]);

  // Separate effect for slap attack sounds based on slapAnimation changes
  useEffect(() => {
    // Trigger sound whenever slapAnimation changes and player is slap attacking
    if (penguin.isSlapAttack && penguin.isAttacking) {
      playSound(attackSound, 0.01);
    }
  }, [penguin.slapAnimation, penguin.isSlapAttack, penguin.isAttacking]);

  useEffect(() => {
    // Play hit sound based on isHit state transitions (false -> true)
    // This ensures hit sound plays exactly once per hit
    const currentTime = Date.now();

    // Use a consistent throttle time for all hit sounds
    // The server already handles preventing multiple hits per attack
    const throttleTime = 30; // Short throttle just to prevent audio glitches

    // Only play sound if:
    // 1. isHit is currently true
    // 2. isHit was false in the previous frame (state transition)
    // 3. Player is not being thrown
    // 4. Appropriate time has passed since last hit sound (throttle)
    if (
      penguin.isHit &&
      !lastHitState.current &&
      !penguin.isBeingThrown &&
      currentTime - lastHitSoundTime.current > throttleTime
    ) {
      playSound(hitSound, 0.01);
      lastHitSoundTime.current = currentTime;
    }

    // Update the previous state for next comparison
    lastHitState.current = penguin.isHit;
  }, [penguin.isHit, penguin.isBeingThrown, penguin.hitCounter]);

  useEffect(() => {
    if (penguin.isThrowingSalt && !lastThrowingSaltState.current) {
      setHasUsedPowerUp(true);
      playSound(saltSound, 0.01);
    }
    lastThrowingSaltState.current = penguin.isThrowingSalt;
  }, [penguin.isThrowingSalt]);

  useEffect(() => {
    if (penguin.isThrowing && !lastThrowState.current) {
      playSound(throwSound, 0.03);
    }
    lastThrowState.current = penguin.isThrowing;
  }, [penguin.isThrowing]);

  useEffect(() => {
    if (penguin.isDodging && !lastDodgeState.current) {
      playSound(dodgeSound, 0.02); // Louder for satisfying feedback
    }
    lastDodgeState.current = penguin.isDodging;
  }, [penguin.isDodging]);

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
      playSound(grabSound, 0.03);
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

  useEffect(() => {
    if (hakkiyoi) {
      playSound(hakkiyoiSound, 0.015);
      playSound(bellSound, 0.005);
    }
  }, [hakkiyoi]);

  useEffect(() => {
    if (gyojiCall === "TE WO TSUITE!") {
      playSound(teWoTsuiteSound, 0.2);
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
    const isGrabbing = penguin.isGrabStartup || penguin.isGrabbingMovement || penguin.isGrabbing;
    return (
      penguin.activePowerUp === "thick_blubber" &&
      ((penguin.isAttacking && penguin.attackType === "charged") || isGrabbing) &&
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
      // This cleanup runs when the component unmounts for any reason
      if (eeshiMusicRef.current) {
        eeshiMusicRef.current.pause();
        eeshiMusicRef.current.currentTime = 0;
      }
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
    penguin.isGrabBreakCountered,
    penguin.isGrabbingMovement,
    isGrabClashActive,
    penguin.isAttemptingGrabThrow,
    null // ritualAnimationSrc - handled separately
  );
  
  // Get sprite render info (handles animated spritesheets and recoloring)
  const spriteRenderInfo = getSpriteRenderInfo(displaySpriteSrc);
  const { src: recoloredSpriteSrc, isAnimated: isAnimatedSprite, config: spriteConfig } = spriteRenderInfo;
  
  // Update animation state (will start/stop intervals as needed)
  updateSpriteAnimation(displaySpriteSrc);
  
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
      {index === 0 && (
        <UiPlayerInfo
          playerOneWinCount={playerOneWinCount}
          playerTwoWinCount={playerTwoWinCount}
          roundHistory={roundHistory}
          roundId={uiRoundId}
          player1Stamina={allPlayersData.player1?.stamina ?? 100}
          player1ActivePowerUp={allPlayersData.player1?.activePowerUp ?? null}
          player1SnowballCooldown={
            allPlayersData.player1?.snowballCooldown ?? false
          }
          player1PumoArmyCooldown={
            allPlayersData.player1?.pumoArmyCooldown ?? false
          }
          player2Stamina={allPlayersData.player2?.stamina ?? 100}
          player2ActivePowerUp={allPlayersData.player2?.activePowerUp ?? null}
          player2SnowballCooldown={
            allPlayersData.player2?.snowballCooldown ?? false
          }
          player2PumoArmyCooldown={
            allPlayersData.player2?.pumoArmyCooldown ?? false
          }
        />
      )}

      <Gyoji gyojiState={gyojiState} hakkiyoi={hakkiyoi} />
      {gyojiCall && (
        <SumoGameAnnouncement type="tewotsuite" duration={2} />
      )}
      {hakkiyoi && <SumoGameAnnouncement type="hakkiyoi" duration={1.8} />}
      {showRoundResult && !matchOver && (
        <RoundResult isVictory={winner.id === localId} />
      )}
      {/* PERFORMANCE: Hidden warmup renders both RoundResult variants to pre-generate
          styled-components CSS classes. Removed after 2 frames via useEffect above. */}
      {warmupRoundResult && (
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden', width: '1px', height: '1px' }}>
          <RoundResult isVictory={true} />
          <RoundResult isVictory={false} />
        </div>
      )}
      {matchOver && (
        <MatchOver winner={winner} localId={localId} roomName={roomName} />
      )}
      {penguin.id === localId &&
        !hakkiyoi &&
        gyojiState === "idle" &&
        countdown > 0 && (
          <YouLabel x={displayPosition.x} y={displayPosition.y} />
        )}
      <PowerMeter
        isCharging={penguin.isChargingAttack ?? false}
        chargePower={penguin.chargeAttackPower ?? 0}
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing}
        playerId={penguin.id}
        localId={localId}
        activePowerUp={penguin.activePowerUp}
      />

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
        facing={penguin.facing}
        isDodging={penguin.isDodging}
        isGrabStartup={penguin.isGrabStartup}
        isThrowing={penguin.isThrowing}
        isBeingThrown={penguin.isBeingThrown}
        isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
        isLocalPlayer={penguin.id === localId}
      />
      {/* <DodgeSmokeEffect
        x={penguin.dodgeStartX || displayPosition.x}
        y={penguin.dodgeStartY || displayPosition.y}
        isDodging={penguin.isDodging}
        facing={penguin.facing}
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
        facing={penguin.facing}
        isSlapAttack={penguin.isSlapAttack}
        isThrowing={penguin.isThrowing}
        chargeCancelled={penguin.chargeCancelled || false}
      /> */}
      {/* Animated Sprite Sheet (when sprite is a spritesheet animation) */}
      {isAnimatedSprite && !showRitualSprite && (
        <AnimatedFighterContainer
          $x={displayPosition.x}
          $y={displayPosition.y}
          $facing={penguin.facing}
          $fighter={penguin.fighter}
          $isThrowing={penguin.isThrowing}
          $isDodging={displayPenguin.isDodging}
          $isGrabbing={displayPenguin.isGrabbing}
          $isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
          $isAtTheRopes={penguin.isAtTheRopes}
          $isHit={penguin.isHit}
        >
          <AnimatedFighterImage
            key={recoloredSpriteSrc} // Force animation restart when sprite changes
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
          $isBraking={displayPenguin.isBraking}
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
          $facing={penguin.facing}
          $throwCooldown={penguin.throwCooldown}
          $grabCooldown={penguin.grabCooldown}
          $isChargingAttack={displayPenguin.isChargingAttack}
          $chargeStartTime={penguin.chargeStartTime}
          $chargeMaxDuration={penguin.chargeMaxDuration}
          $chargeAttackPower={penguin.chargeAttackPower}
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
          $isLocalPlayer={penguin.id === localId}
          style={{ display: showRitualSprite ? 'none' : 'block' }}
        />
      )}

      {/* Ritual Sprite Sheet Animation - all 4 parts pre-rendered, only current one visible */}
      {/* Each player's ritual stops independently when they select their power-up and start salt throwing */}
      {shouldShowRitualForPlayer && (index === 0 ? ritualSpritesheetsPlayer1 : ritualSpritesheetsPlayer2).map((config, partIndex) => (
        <RitualSpriteContainer
          key={partIndex}
          $x={displayPosition.x}
          $y={displayPosition.y}
          $facing={penguin.facing}
          $partIndex={partIndex}
          style={{ 
            visibility: partIndex === ritualPart ? 'visible' : 'hidden',
            pointerEvents: 'none'
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

      {thickBlubberIndicator && (
        <TintedImage
          $x={displayPosition.x}
          $y={displayPosition.y}
          $facing={penguin.facing}
          $isThrowing={penguin.isThrowing}
          $isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
          src={currentSpriteSrc}
          alt="blubber-tint"
          $variant="blubber"
        />
      )}
      <SaltEffect
        isActive={penguin.isThrowingSalt}
        playerFacing={penguin.facing}
        playerX={displayPosition.x}
        playerY={displayPosition.y + 100}
      />
      <SlapAttackHandsEffect
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing}
        isActive={penguin.isSlapAttack}
        slapAnimation={penguin.slapAnimation}
      />
      <SlapParryEffect position={parryEffectPosition} />
      <HitEffect position={hitEffectPosition} />
      <RawParryEffect position={rawParryEffectPosition} />
      <GrabBreakEffect position={grabBreakEffectPosition} />
      <CounterGrabEffect position={counterGrabEffectPosition} />
      <PunishBannerEffect position={punishBannerPosition} />
      <CounterHitEffect position={counterHitEffectPosition} />
      <SnowballImpactEffect position={snowballImpactPosition} />
      <StarStunEffect
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing}
        isActive={showStarStunEffect}
      />
      <EdgeDangerEffect
        x={displayPosition.x}
        y={displayPosition.y}
        facing={penguin.facing}
        isActive={penguin.isAtTheRopes}
      />
      <PerfectParryPowerEffect
        x={displayPosition.x}
        y={displayPosition.y}
        isPerfectParrySuccess={penguin.isPerfectRawParrySuccess ?? false}
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
        <SnowballProjectile
          key={projectile.id}
          src={snowball}
          alt="Snowball"
          $x={projectile.x}
          $y={projectile.y}
        />
      ))}
      <PumoCloneSpawnEffect clones={allPumoArmies} player1Color={p1Color} player2Color={p2Color} />
      {allPumoArmies.map((clone) => {
        // Color the clone to match its owner's color
        // Uses the pre-cached recolored sprites (synchronous lookup, no perf cost)
        const ownerColor = clone.ownerPlayerNumber === 1 ? p1Color : p2Color;
        const needsCloneRecolor = ownerColor && ownerColor !== SPRITE_BASE_COLOR;

        // For strafing clones, use spritesheet animation (APNG recoloring loses animation frames)
        const waddleConfig = SPRITESHEET_CONFIG_BY_NAME.pumoWaddle;
        const isAnimatedClone = clone.isStrafing && waddleConfig;

        let cloneSprite;
        if (isAnimatedClone) {
          // Use the spritesheet (not the APNG) for animation
          cloneSprite = waddleConfig.spritesheet;
          if (needsCloneRecolor) {
            const cached = getCachedRecoloredImage(waddleConfig.spritesheet, BLUE_COLOR_RANGES, ownerColor);
            if (cached) cloneSprite = cached;
          }
        } else {
          // Static idle sprite
          cloneSprite = pumo2;
          if (needsCloneRecolor) {
            const cached = getCachedRecoloredImage(pumo2, BLUE_COLOR_RANGES, ownerColor);
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
              offsetLeft="15%"
              offsetRight="18%"
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
