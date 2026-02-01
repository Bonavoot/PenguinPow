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
import styled from "styled-components";
import "./MatchOver.css";
import Gyoji from "./Gyoji";
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
import EdgeDangerEffect from "./EdgeDangerEffect";
import NoStaminaEffect from "./GassedEffect";
import SnowballImpactEffect from "./SnowballImpactEffect";
import PumoCloneSpawnEffect from "./PumoCloneSpawnEffect";
import SlapAttackHandsEffect from "./SlapAttackHandsEffect";
import PerfectParryPowerEffect from "./PerfectParryPowerEffect";

import snowballThrow2 from "../assets/snowball-throw2.png";
import snowballThrow from "../assets/snowball-throw.png";
import pumo from "../assets/pumo.png";
import pumo2 from "../assets/pumo2.png";
import pumoWaddle from "../assets/pumo-waddle.png";
import pumoWaddle2 from "../assets/pumo-waddle2.png";
import pumoArmy from "../assets/pumo-army.png";
import pumoArmy2 from "../assets/pumo-army2.png";
import powerWaterIcon from "../assets/power-water.png";
import snowballImage from "../assets/snowball.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import thickBlubberIcon from "../assets/thick-blubber-icon.png";
import crouching from "../assets/blocking2.png";
import crouching2 from "../assets/blocking.png";
import grabbing from "../assets/grabbing.png";
import grabbing2 from "../assets/grabbing2.png";
import grabAttempt from "../assets/grab-attempt.png";
import grabAttempt2 from "../assets/grab-attempt2.png";
import attemptingGrabThrow from "../assets/attempting-grab-throw.png";
import attemptingGrabThrow2 from "../assets/attempting-grab-throw2.png";
import beingGrabbed from "../assets/is-being-grabbed.gif";
import beingGrabbed2 from "../assets/is-being-grabbed2.gif";
import atTheRopes2 from "../assets/at-the-ropes2.png";
import grabSound from "../sounds/grab-sound.mp3";
import ready from "../assets/ready.png";
import ready2 from "../assets/ready2.png";
import attack from "../assets/attack.png";
import attack2 from "../assets/attack2.png";
import slapAttack1Blue from "../assets/slapAttack1blue.png";
import slapAttack2Blue from "../assets/slapAttack2blue.png";
import slapAttack1Red from "../assets/slapAttack1Red.png";
import slapAttack2Red from "../assets/slapAttack2Red.png";
import dodging from "../assets/dodging.gif";
import dodging2 from "../assets/dodging2.png";
import throwing from "../assets/throwing.png";
import throwing2 from "../assets/throwing2.png";
import hit from "../assets/hit-clean.png";
import hit2 from "../assets/hit2.png";
import salt2 from "../assets/salt2.png";
import salt from "../assets/salt.png";
import bow from "../assets/bow.png";
import bow2 from "../assets/bow2.png";
import throwTech from "../assets/throw-tech.png";
import throwTech2 from "../assets/throw-tech2.png";
import saltBasket from "../assets/salt-basket.png";
import saltBasketEmpty from "../assets/salt-basket-empty.png";
import recovering2 from "../assets/recovering2.png";
import recovering from "../assets/recovering.png";
import rawParrySuccess2 from "../assets/raw-parry-success2.png";
import rawParrySuccess from "../assets/raw-parry-success.png";
import snowball from "../assets/snowball.png";
import attackSound from "../sounds/attack-sound.mp3";
import hitSound from "../sounds/hit-sound.mp3";
import dodgeSound from "../sounds/dodge-sound.mp3";
import throwSound from "../sounds/throw-sound.mp3";
import winnerSound from "../sounds/winner-sound.wav";
import hakkiyoiSound from "../sounds/hakkiyoi-sound.mp3";
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
import crouchStance2 from "../assets/crouch-stance2.png";
import crouchStrafing2 from "../assets/crouch-strafing2.png";

// Ritual animation sprite sheet imports (Player 1 - Blue)
import ritualPart1Spritesheet from "../assets/ritual_part1_spritesheet.png";
import ritualPart2Spritesheet from "../assets/ritual_part2_spritesheet.png";
import ritualPart3Spritesheet from "../assets/ritual_part3_spritesheet.png";
import ritualPart4Spritesheet from "../assets/ritual_part4_spritesheet.png";

// Ritual animation sprite sheet imports (Player 2 - Red)
import ritualPart1SpritesheetRed from "../assets/ritual_part1_spritesheet_red.png";
import ritualPart2SpritesheetRed from "../assets/ritual_part2_spritesheet_red.png";
import ritualPart3SpritesheetRed from "../assets/ritual_part3_spritesheet_red.png";
import ritualPart4SpritesheetRed from "../assets/ritual_part4_spritesheet_red.png";

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
import { isOutsideDohyo, DOHYO_FALL_DEPTH } from "../constants";

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

// Player 2 (Red) ritual spritesheets
const RITUAL_SPRITE_CONFIG_PLAYER2 = [
  { spritesheet: ritualPart1SpritesheetRed, frameCount: 28, frameWidth: 480, fps: 14 },
  { spritesheet: ritualPart2SpritesheetRed, frameCount: 24, frameWidth: 480, fps: 14 },
  { spritesheet: ritualPart3SpritesheetRed, frameCount: 39, frameWidth: 480, fps: 14 },
  { spritesheet: ritualPart4SpritesheetRed, frameCount: 38, frameWidth: 480, fps: 14 },
];
const ritualSpritesheetsPlayer2 = RITUAL_SPRITE_CONFIG_PLAYER2;

// Clap sounds for each ritual part
const ritualClapSounds = [clap1Sound, clap2Sound, clap3Sound, clap4Sound];

// Preload ritual sprite sheets to prevent loading delays
const ritualImagesLoaded = { count: 0, total: RITUAL_SPRITE_CONFIG.length + RITUAL_SPRITE_CONFIG_PLAYER2.length };
const preloadRitualSpritesheets = () => {
  RITUAL_SPRITE_CONFIG.forEach((config) => {
    const img = new Image();
    img.onload = () => { ritualImagesLoaded.count++; };
    img.src = config.spritesheet;
  });
  RITUAL_SPRITE_CONFIG_PLAYER2.forEach((config) => {
    const img = new Image();
    img.onload = () => { ritualImagesLoaded.count++; };
    img.src = config.spritesheet;
  });
};
// Call preload on module load
preloadRitualSpritesheets();

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
};

// Initialize image preloading
const initializeImagePreloading = () => {
  // Character sprites
  preloadImage(pumo);
  preloadImage(pumo2);
  preloadImage(pumoWaddle);
  preloadImage(pumoWaddle2);
  preloadImage(pumoArmy);
  preloadImage(pumoArmy2);

  // Action sprites
  preloadImage(attack);
  preloadImage(attack2);
  preloadImage(throwing);
  preloadImage(throwing2);
  preloadImage(grabbing);
  preloadImage(grabbing2);
  preloadImage(grabAttempt);
  preloadImage(grabAttempt2);
  preloadImage(beingGrabbed);
  preloadImage(beingGrabbed2);

  // State sprites
  preloadImage(ready);
  preloadImage(ready2);
  preloadImage(hit);
  preloadImage(hit2);
  preloadImage(dodging);
  preloadImage(dodging2);
  preloadImage(crouching);
  preloadImage(crouching2);

  // Special moves
  preloadImage(slapAttack1Blue);
  preloadImage(slapAttack2Blue);
  preloadImage(slapAttack1Red);
  preloadImage(slapAttack2Red);
  preloadImage(snowballThrow);
  preloadImage(snowballThrow2);

  // Utility sprites
  preloadImage(bow);
  preloadImage(bow2);
  preloadImage(throwTech);
  preloadImage(throwTech2);
  preloadImage(salt);
  preloadImage(salt2);
  preloadImage(saltBasket);
  preloadImage(saltBasketEmpty);
  preloadImage(recovering);
  preloadImage(recovering2);
  preloadImage(rawParrySuccess);
  preloadImage(rawParrySuccess2);
  preloadImage(atTheRopes2);
  preloadImage(snowball);

  // Effect sprites
  preloadImage(hitEffectImage);
};

// Initialize pools and preloading immediately
initializeAudioPools();
initializeImagePreloading();

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
  if (fighter === "player 2") {
    if (isGrabBreaking) return crouching;
    if (isGrabBreakCountered) return hit;
    // Both perfect and regular parry use the same success animation
    if (isRawParrySuccess || isPerfectRawParrySuccess) return rawParrySuccess;
    // Check isHit before isAtTheRopes to prevent red silhouette issue
    if (isHit) return hit;
    if (isAtTheRopes) return beingGrabbed;
    if (isBowing) return bow;
    if (isThrowTeching) return throwTech;
    if (isRecovering) return recovering;
    if (isThrowingSnowball) return snowballThrow;
    if (isSpawningPumoArmy) return pumoArmy;
    if (isDodging) return dodging;
    if (isCrouchStrafing) return crouchStrafing2;
    if (isCrouchStance) return crouchStance2;
    // Show attempting grab throw animation for player 2
    if (isAttemptingGrabThrow) return attemptingGrabThrow;
    // Show attempt animation during grab movement attempt
    if (attemptingGrabMovement) {
      return grabAttemptType === "throw" ? throwing : grabAttempt;
    }
    // Show attempt animation even if isGrabbing is false, UNLESS in grab clash
    if (grabState === "attempting") {
      // During grab clash, show grabbing animation instead of grab attempt
      if (isGrabClashActive) {
        return grabbing;
      }
      return grabAttemptType === "throw" ? throwing : grabAttempt;
    }
    if (isSlapAttack) {
      return slapAnimation === 1 ? slapAttack1Red : slapAttack2Red;
    }
    if (isJumping) return throwing;
    if (isAttacking && !isSlapAttack) return attack;
    if (isGrabbing) {
      if (grabState === "attempting") {
        // During grab clash, show grabbing animation instead of grab attempt
        if (isGrabClashActive) {
          return grabbing;
        }
        return grabAttemptType === "throw" ? throwing : grabAttempt;
      }
      return grabbing;
    }
    if (isBeingGrabbed || isBeingPulled || isBeingPushed) return beingGrabbed;
    if (isRawParrying) return crouching;
    if (isRawParryStun) return bow;
    if (isReady) return ready;
    if (isStrafing && !isThrowing) return pumoWaddle;
    if (isDead) return pumo;
    if (isThrowing) return throwing;
    if (isThrowingSalt) return salt;
    return pumo;
  } else if (fighter === "player 1") {
    if (isGrabBreaking) return crouching2;
    if (isGrabBreakCountered) return hit2;
    // Both perfect and regular parry use the same success animation
    if (isRawParrySuccess || isPerfectRawParrySuccess) return rawParrySuccess2;
    // Check isHit before isAtTheRopes to prevent red silhouette issue
    if (isHit) return hit2;
    if (isAtTheRopes) return atTheRopes2;
    if (isJumping) return throwing2;
    if (isAttacking && !isSlapAttack) return attack2;
    if (isBowing) return bow2;
    if (isThrowTeching) return throwTech2;
    if (isRecovering) return recovering2;
    if (isThrowingSnowball) return snowballThrow2;
    if (isSpawningPumoArmy) return pumoArmy2;
    if (isDodging) return dodging2;
    if (isCrouchStrafing) return crouchStrafing2;
    if (isCrouchStance) return crouchStance2;
    // Show attempting grab throw animation for player 1
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
    if (isDead) return pumo;
    if (isThrowing) return throwing2;
    if (isThrowingSalt) return salt2;
    if (isBeingGrabbed || isBeingPulled || isBeingPushed) return beingGrabbed2;
    return pumo2;
  }
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
      transform:
        (props.$isRingOutThrowCutscene && props.$isThrowing
          ? -props.$facing
          : props.$facing) === 1
          ? "scaleX(1)"
          : "scaleX(-1)",
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
      transform:
        (props.$isRingOutThrowCutscene && props.$isThrowing
          ? -props.$facing
          : props.$facing) === 1
          ? "scaleX(1)"
          : "scaleX(-1)",
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
      transform:
        (props.$isRingOutThrowCutscene && props.$isThrowing
          ? -props.$facing
          : props.$facing) === 1
          ? "scaleX(1)"
          : "scaleX(-1)",
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
      ].includes(prop),
  })
  .attrs((props) => ({
    src: getImageSrc(
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
      "--facing": (props.$isRingOutThrowCutscene && props.$isThrowing
            ? -props.$facing
            : props.$facing) === 1
          ? "1"
          : "-1",
      transform: props.$isAtTheRopes && props.$fighter === "player 1"
        ? ((props.$isRingOutThrowCutscene && props.$isThrowing
            ? -props.$facing
            : props.$facing) === 1
            ? "scaleX(1) scaleY(0.95)"
            : "scaleX(-1) scaleY(0.95)")
        : ((props.$isRingOutThrowCutscene && props.$isThrowing
            ? -props.$facing
            : props.$facing) === 1
            ? "scaleX(1)"
            : "scaleX(-1)"),
      zIndex:
        isOutsideDohyo(props.$x, props.$y) ? 0 : // Behind dohyo overlay when outside
        props.$isThrowing || props.$isDodging || props.$isGrabbing ? 98 : 99,
      filter: props.$isAtTheRopes
        ? `drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 8px rgba(255, 50, 50, 0.7)) brightness(1.15) contrast(1.25)${props.$isLocalPlayer ? ' drop-shadow(0 0 3px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 1))' : ''}`
        : props.$isGrabBreaking
        ? `drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 8px rgba(0, 255, 128, 0.85)) brightness(1.35) drop-shadow(0 0 3px #000)${props.$isLocalPlayer ? ' drop-shadow(0 0 3px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 1))' : ''}`
        : props.$isRawParrying
        ? `drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 8px rgba(0, 150, 255, 0.8)) brightness(1.3) drop-shadow(0 0 3px #000)${props.$isLocalPlayer ? ' drop-shadow(0 0 3px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 1))' : ''}`
        : props.$isHit
        ? `drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2) brightness(1.15)${props.$isLocalPlayer ? ' drop-shadow(0 0 3px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 1))' : ''}`
        : props.$isChargingAttack
        ? `drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 12px rgba(255, 200, 50, 0.85)) contrast(1.25)${props.$isLocalPlayer ? ' drop-shadow(0 0 3px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 1))' : ''}`
        : props.$isGrabClashActive
        ? `drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.25) brightness(1.1)${props.$isLocalPlayer ? ' drop-shadow(0 0 3px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 1))' : ''}`
        : props.$isLocalPlayer
        ? "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 3px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 1)) contrast(1.2)"
        : "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2) ",
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
        ? "hitSquash 0.18s ease-out"
        : props.$justLandedFromDodge
        ? "dodgeLanding 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
        // : props.$isDodgeCancelling
        // ? "dodgeCancelSlam 0.12s cubic-bezier(0.25, 0.1, 0.25, 1) forwards"
        : props.$isDodging
        ? "dodgeTakeoff 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards"
        : props.$isChargingAttack
        ? "chargePulse 0.6s ease-in-out infinite"
        : props.$isAttacking && !props.$isSlapAttack
        ? "attackPunch 0.2s ease-out"
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
      willChange: "bottom, left, filter, opacity, transform",
      pointerEvents: "none",
      transformOrigin: "center bottom",
      transition: "none",
    },
  }))`
  /* Static styles only - no dynamic props here */
  @keyframes rawParryFlash {
    0% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 2px rgba(0, 150, 255, 0.4)) brightness(1) drop-shadow(0 0 1px #000);
    }
    25% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 12px rgba(0, 150, 255, 0.9)) brightness(1.6) drop-shadow(0 0 4px #000);
    }
    50% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 8px rgba(0, 150, 255, 0.7)) brightness(1.3) drop-shadow(0 0 3px #000);
    }
    75% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 12px rgba(0, 150, 255, 0.9)) brightness(1.6) drop-shadow(0 0 4px #000);
    }
    100% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 2px rgba(0, 150, 255, 0.4)) brightness(1) drop-shadow(0 0 1px #000);
    }
  }
  @keyframes grabBreakFlash {
    0% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 2px rgba(0, 255, 128, 0.45)) brightness(1) drop-shadow(0 0 1px #000);
    }
    25% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 12px rgba(0, 255, 128, 0.95)) brightness(1.7) drop-shadow(0 0 4px #000);
    }
    50% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 8px rgba(0, 255, 128, 0.75)) brightness(1.4) drop-shadow(0 0 3px #000);
    }
    75% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 12px rgba(0, 255, 128, 0.95)) brightness(1.7) drop-shadow(0 0 4px #000);
    }
    100% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 2px rgba(0, 255, 128, 0.45)) brightness(1) drop-shadow(0 0 1px #000);
    }
  }
  
  /* Hit squash/stretch animation - uses CSS var for facing direction */
  @keyframes hitSquash {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2) brightness(1.4);
    }
    20% {
      transform: scaleX(calc(var(--facing, 1) * 1.18)) scaleY(0.82);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.3) brightness(1.5);
    }
    50% {
      transform: scaleX(calc(var(--facing, 1) * 0.88)) scaleY(1.12);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.25) brightness(1.3);
    }
    75% {
      transform: scaleX(calc(var(--facing, 1) * 1.06)) scaleY(0.94);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2) brightness(1.2);
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2) brightness(1.15);
    }
  }
  
  /* Attack punch animation - wind up and release with facing direction */
  @keyframes attackPunch {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
    }
    25% {
      transform: scaleX(calc(var(--facing, 1) * 0.9)) scaleY(1.1);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.3) brightness(1.15);
    }
    55% {
      transform: scaleX(calc(var(--facing, 1) * 1.12)) scaleY(0.92);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.25) brightness(1.1) drop-shadow(0 0 8px rgba(255, 200, 50, 0.6));
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
    }
  }
  
  /* Charge pulse animation - builds anticipation for charged attack */
  @keyframes chargePulse {
    0% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 8px rgba(255, 200, 50, 0.5)) contrast(1.2);
    }
    50% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 18px rgba(255, 150, 0, 0.9)) contrast(1.35) brightness(1.1);
    }
    100% {
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 8px rgba(255, 200, 50, 0.5)) contrast(1.2);
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
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
    }
    20% {
      transform: scaleX(calc(var(--facing, 1) * 1.08)) scaleY(0.88) translateY(0);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.25) brightness(1.05);
    }
    50% {
      transform: scaleX(calc(var(--facing, 1) * 0.94)) scaleY(1.08) translateY(-2px);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.22) brightness(1.08) drop-shadow(0 0 5px rgba(255, 255, 255, 0.25));
    }
    80% {
      transform: scaleX(calc(var(--facing, 1) * 0.97)) scaleY(1.04) translateY(-1px);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2) brightness(1.03);
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
    }
  }
  
  /* Dodge cancel slam - smooth drop with impact squash */
  @keyframes dodgeCancelSlam {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
    }
    40% {
      transform: scaleX(calc(var(--facing, 1) * 0.94)) scaleY(1.08) translateY(1px);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.22) brightness(1.05);
    }
    70% {
      transform: scaleX(calc(var(--facing, 1) * 1.12)) scaleY(0.82) translateY(0);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.28) brightness(1.1) drop-shadow(0 0 4px rgba(255, 255, 255, 0.35));
    }
    90% {
      transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.03) translateY(0);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.22);
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
    }
  }
  
  /* Dodge landing - gentle impact squash with smooth recovery */
  @keyframes dodgeLanding {
    0% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
    }
    25% {
      transform: scaleX(calc(var(--facing, 1) * 1.06)) scaleY(0.88) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.24) brightness(1.05) drop-shadow(0 0 3px rgba(255, 255, 255, 0.2));
    }
    55% {
      transform: scaleX(calc(var(--facing, 1) * 0.98)) scaleY(1.04) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.21) brightness(1.02);
    }
    80% {
      transform: scaleX(calc(var(--facing, 1) * 1.02)) scaleY(0.99) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
    }
    100% {
      transform: scaleX(var(--facing, 1)) scaleY(1) translateY(0);
      transform-origin: center bottom;
      filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2);
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
    // Clip 1.5% from left/right edges to prevent sub-pixel bleed from adjacent frames
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
      filter: props.$isLocalPlayer
        ? "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 0 3px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 1)) contrast(1.2)"
        : "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2)",
    },
  };
})``;

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
      left: props.$index === 0 ? "15.5%" : "auto",
      right: props.$index === 1 ? "16.5%" : "auto",
      transform: props.$index === 1 ? "scaleX(-1)" : "none",
      zIndex: 1,
      pointerEvents: "none",
      opacity: props.$isVisible ? 1 : 0,
      transition: "opacity 0.3s ease",
    },
  }))``;

const YouLabel = styled.div
  .withConfig({
    shouldForwardProp: (prop) => !["x", "y"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      bottom: `${(props.y / 720) * 100 + 31}%`,
      left: `${(props.x / 1280) * 100 + 8}%`,
      transform: "translateX(-50%)",
    },
  }))`
  color: #ffd700;
  font-family: "Bungee";
  font-size: clamp(18px, 1.5vw, 24px);
  text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000,
    2px 2px 0 #000;
  z-index: 1000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  &::after {
    content: "↓";
    font-size: clamp(14px, 1.2vw, 18px);
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
      filter:
        "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)",
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
      zIndex: 97,
      pointerEvents: "none",
      filter:
        "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.3)",
    },
  }))``;

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
}) => {
  const { socket } = useContext(SocketContext);
  const [penguin, setPenguin] = useState({
    id: "",
    fighter: "",
    color: "",
    isJumping: false,
    isAttacking: false,
    isDodging: false,
    dodgeDirection: null,
    isStrafing: false,
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

  // Add interpolation state
  const [interpolatedPosition, setInterpolatedPosition] = useState({
    x: 0,
    y: 0,
  });
  const previousState = useRef(null);
  const currentState = useRef(null);
  const lastUpdateTime = useRef(performance.now());

  // Store both players' data for UI (only needed for first component)
  const [allPlayersData, setAllPlayersData] = useState({
    player1: null,
    player2: null,
  });
  const [hakkiyoi, setHakkiyoi] = useState(false);
  const [gyojiCall, setGyojiCall] = useState(null); // Gyoji's call before HAKKIYOI (e.g., "TE WO TSUITE!")
  const [gyojiState, setGyojiState] = useState("idle");
  const [gameOver, setGameOver] = useState(false);
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
  const [snowballImpactPosition, setSnowballImpactPosition] = useState(null);
  
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
        try {
          const randomIndex = Math.floor(Math.random() * ritualClapSounds.length);
          const clapAudio = new Audio(ritualClapSounds[randomIndex]);
          clapAudio.volume = 0.03 * getGlobalVolume();
          clapAudio.play().catch(() => {});
        } catch (e) {}
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

  // Interpolation constants
  const SERVER_TICK_RATE = 64; // Server runs at 64 FPS
  const SERVER_UPDATE_INTERVAL = 1000 / SERVER_TICK_RATE; // ~15.625ms

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

  // Animation loop for interpolation - smooth updates at full framerate
  const interpolationLoop = useCallback(
    (timestamp) => {
      if (currentState.current && previousState.current) {
        const timeSinceUpdate = timestamp - lastUpdateTime.current;
        const interpolationFactor = Math.min(
          timeSinceUpdate / SERVER_UPDATE_INTERVAL,
          1
        );

        // Calculate and set interpolated position
        const interpolatedPos = interpolatePosition(
          { x: previousState.current.x, y: previousState.current.y },
          { x: currentState.current.x, y: currentState.current.y },
          interpolationFactor
        );

        setInterpolatedPosition(interpolatedPos);
      } else if (currentState.current) {
        setInterpolatedPosition({
          x: currentState.current.x,
          y: currentState.current.y,
        });
      }

      requestAnimationFrame(interpolationLoop);
    },
    [interpolatePosition]
  );

  // Start interpolation loop
  useEffect(() => {
    const animationId = requestAnimationFrame(interpolationLoop);
    return () => cancelAnimationFrame(animationId);
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

  // Optimize animation frame with actual usage
  const animate = useCallback((timestamp) => {
    // Request next frame first to ensure consistent timing
    requestAnimationFrame(animate);

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
    // Start animation loop
    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [animate]);

  // Memoize frequently accessed socket listeners to prevent recreation
  const handleFighterAction = useCallback(
    (data) => {
      const currentTime = performance.now();

      // Store both players' data for UI (only for first component)
      if (index === 0) {
        setAllPlayersData({
          player1: data.player1,
          player2: data.player2,
        });
      }

      // Get the relevant player data based on index
      const playerData = index === 0 ? data.player1 : data.player2;

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
      setPenguin({
        ...playerData,
        isDodging: playerData.isDodging || false,
        dodgeDirection:
          typeof playerData.dodgeDirection === "number"
            ? playerData.dodgeDirection
            : playerData.facing || 1,
        isGrabBreaking: playerData.isGrabBreaking || false,
        isGrabBreakCountered: playerData.isGrabBreakCountered || false,
      });

      // Update all snowballs from both players
      const combinedSnowballs = [
        ...(data.player1.snowballs || []),
        ...(data.player2.snowballs || []),
      ];
      setAllSnowballs(combinedSnowballs);

      // Update all pumo armies from both players
      const combinedPumoArmies = [
        ...(data.player1.pumoArmy || []),
        ...(data.player2.pumoArmy || []),
      ];
      setAllPumoArmies(combinedPumoArmies);
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
        });
      }
    });

    socket.on("raw_parry_success", (data) => {
      console.log("Received raw_parry_success event:", data);
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
        console.log("Setting rawParryEffectPosition:", effectData);
        setRawParryEffectPosition(effectData);
        // Play different sounds for regular vs perfect parry
        if (data.isPerfect) {
          playSound(rawParrySuccessSound, 0.01);
        } else {
          playSound(regularRawParrySound, 0.03);
        }
      } else {
        console.warn("Invalid raw_parry_success data:", data);
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

      // Counter grab effect - when grabbing someone doing a raw parry
      socket.on("counter_grab", (data) => {
        if (data && typeof data.grabberX === "number" && typeof data.grabbedX === "number") {
          // Calculate center position between grabber and grabbed player
          const centerX = (data.grabberX + data.grabbedX) / 2;
          setCounterGrabEffectPosition({
            x: centerX + 150,
            y: GROUND_LEVEL + 110,
            counterId: data.counterId || `counter-${Date.now()}`,
            grabberPlayerNumber: data.grabberPlayerNumber || 1,
          });
          // Play counter grab sound at similar volume to other grab-related sounds
          playSound(counterGrabSound, 0.035);
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
          playSound(clashVictorySound, 0.03);
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
      setGyojiState("idle");
      setMatchOver(false);
      setHasUsedPowerUp(false);
      setGyojiCall(null); // Clear gyoji call
      setRawParryEffectPosition(null); // Clear any active parry effects
      setNoStaminaEffectKey(0); // Clear "No Stamina" effect on round reset
      setIsGrabClashActive(false); // Reset grab clash state
      onResetDisconnectState(); // Reset opponent disconnected state for new games
      console.log("game reset gamefighter.jsx");

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
      console.log("gyoji_call:", call);
      setGyojiCall(call);
      
      // Clear the call after animation completes
      setTimeout(() => {
        setGyojiCall(null);
      }, 2000);
    });

    socket.on("game_start", () => {
      console.log("game start gamefighter.jsx");
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

      // Hide hakkiyoi text after 3 seconds
      setTimeout(() => {
        setHakkiyoi(false);
      }, 3000);
    });

    socket.on("game_over", (data) => {
      setGameOver(data.isGameOver);
      setWinner(data.winner);
      console.log(data.winner);
      
      // Add winner to round history
      const winnerName = data.winner.fighter === "player 1" ? "player1" : "player2";
      setRoundHistory(prev => [...prev, winnerName]);
      
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
        socket.off("snowball_hit");
        socket.off("stamina_blocked");
      }
      socket.off("grab_clash_start");
      socket.off("grab_clash_end");
      socket.off("gyoji_call");
      socket.off("game_start");
      socket.off("game_reset");
      socket.off("game_over");
      socket.off("match_over");
      socket.off("power_ups_revealed");
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [index, socket, handleFighterAction]);

  useEffect(() => {
    gameMusicRef.current = new Audio(gameMusic);
    gameMusicRef.current.volume = 0.009; // lower volume
    eeshiMusicRef.current = new Audio(eeshiMusic);
    eeshiMusicRef.current.volume = 0.009; // lower volume
    eeshiMusicRef.current.loop = true;

    // Only start eeshi music if opponent hasn't disconnected
    if (!opponentDisconnected) {
      eeshiMusicRef.current.play();
    }

    return () => {
      // Clean up both music refs when component unmounts
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

  useEffect(() => {
    socket.on("game_start", () => {
      eeshiMusicRef.current.pause();
      eeshiMusicRef.current.currentTime = 0;
      gameMusicRef.current.loop = true;
      gameMusicRef.current.play();
    });

    socket.on("game_over", () => {
      gameMusicRef.current.pause();
      gameMusicRef.current.currentTime = 0;

      // Only restart eeshi music if opponent hasn't disconnected
      if (!opponentDisconnected) {
        // eeshiMusicRef.current.volume = 0.006;
        eeshiMusicRef.current.loop = true;
        eeshiMusicRef.current.play();
      }
    });

    return () => {
      socket.off("game_start");
      socket.off("game_over");
    };
  }, [socket, opponentDisconnected]); // Add opponentDisconnected as dependency

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
      console.log(
        "Hiding star stun effect - isRawParryStun:",
        penguin.isRawParryStun,
        "showStarStunEffect:",
        showStarStunEffect
      );
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

        // Calculate shake intensity based on elapsed time (fade out)
        const remainingIntensity =
          screenShake.intensity * (1 - elapsed / screenShake.duration);

        // Apply random offset based on intensity
        const offsetX = (Math.random() - 0.5) * remainingIntensity * 10;
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
  useEffect(() => {
    console.log(
      `🔵 Setting up event listeners for player ${player.id}, isLocal: ${
        player.id === localId
      }`
    );

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

        // Play thick blubber absorption sound
        playSound(thickBlubberSound, 0.01);

        // Reset the effect after a brief moment
        setTimeout(() => {
          setThickBlubberEffect({
            isActive: false,
            x: 0,
            y: 0,
          });
        }, 50);
      }
    });

    // Danger zone event - dramatic moment when player is near ring-out
    socket.on("danger_zone", (data) => {
      console.log("🔴 DANGER ZONE triggered!", data);
      setDangerZoneActive(true);
      setSlowMoActive(true);
      
      // Reset after brief dramatic moment (no filter changes - dohyo must stay consistent)
      setTimeout(() => {
        setDangerZoneActive(false);
        setSlowMoActive(false);
      }, 400);
    });

    // Ring-out event - player knocked out of ring
    socket.on("ring_out", (data) => {
      console.log("🎯 RING OUT!", data);
      // Extra dramatic screen shake for ring-out
      setScreenShake({
        intensity: 1.2,
        duration: 600,
        startTime: Date.now(),
      });
    });

    // Test listener for any event to verify socket is working
    socket.on("fighter_action", () => {});

    // Test if socket is connected and in the right room
    console.log(
      `🔵 Socket connected: ${socket.connected}, Socket ID: ${socket.id}, Room: ${roomName}`
    );

    return () => {
      console.log(`🔵 Cleaning up event listeners for player ${player.id}`);
      socket.off("screen_shake");
      socket.off("thick_blubber_absorption");
      socket.off("danger_zone");
      socket.off("ring_out");
      socket.off("fighter_action");
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
        <div className="gyoji-call">{gyojiCall}</div>
      )}
      {hakkiyoi && <div className="hakkiyoi">HAKKI-YOI !</div>}
      {gameOver && !matchOver && (
        <RoundResult isVictory={winner.id === localId} />
      )}
      {matchOver && (
        <MatchOver winner={winner} localId={localId} roomName={roomName} />
      )}
      {penguin.id === localId &&
        !hakkiyoi &&
        gyojiState === "idle" &&
        countdown > 0 && (
          <YouLabel x={getDisplayPosition().x} y={getDisplayPosition().y}>
            YOU
          </YouLabel>
        )}
      <PowerMeter
        isCharging={penguin.isChargingAttack}
        chargePower={penguin.chargeAttackPower}
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
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
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        facing={penguin.facing}
        isDodging={penguin.isDodging}
        isGrabStartup={penguin.isGrabStartup}
        isThrowing={penguin.isThrowing}
        isBeingThrown={penguin.isBeingThrown}
        isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
        isLocalPlayer={penguin.id === localId}
      />
      {/* <DodgeSmokeEffect
        x={penguin.dodgeStartX || getDisplayPosition().x}
        y={penguin.dodgeStartY || getDisplayPosition().y}
        isDodging={penguin.isDodging}
        facing={penguin.facing}
        dodgeDirection={penguin.dodgeDirection}
      /> */}
      {/* <DodgeLandingEffect
        x={getDisplayPosition().x}
        y={GROUND_LEVEL}
        justLanded={penguin.justLandedFromDodge}
        isCancelled={penguin.isDodgeCancelling}
      /> */}
{/* 
      <ChargedAttackSmokeEffect
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        isChargingAttack={penguin.isChargingAttack}
        facing={penguin.facing}
        isSlapAttack={penguin.isSlapAttack}
        isThrowing={penguin.isThrowing}
        chargeCancelled={penguin.chargeCancelled || false}
      /> */}
      <StyledImage
        $fighter={penguin.fighter}
        $isDiving={penguin.isDiving}
        $isJumping={penguin.isJumping}
        $isAttacking={penguin.isAttacking}
        $isDodging={penguin.isDodging}
        $isStrafing={penguin.isStrafing}
        $isRawParrying={penguin.isRawParrying}
        $isGrabBreaking={penguin.isGrabBreaking}
        $isReady={penguin.isReady}
        $isHit={penguin.isHit}
        $isDead={penguin.isDead}
        $isSlapAttack={penguin.isSlapAttack}
        $isThrowing={penguin.isThrowing}
        $isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
        $isGrabbing={penguin.isGrabbing}
        $isGrabbingMovement={penguin.isGrabbingMovement}
        $isBeingGrabbed={penguin.isBeingGrabbed}
        $isThrowingSalt={penguin.isThrowingSalt}
        $slapAnimation={penguin.slapAnimation}
        $isBowing={penguin.isBowing}
        $isThrowTeching={penguin.isThrowTeching}
        $isBeingPulled={penguin.isBeingPulled}
        $isBeingPushed={penguin.isBeingPushed}
        $grabState={penguin.grabState}
        $grabAttemptType={penguin.grabAttemptType}
        $x={getDisplayPosition().x}
        $y={getDisplayPosition().y}
        $facing={penguin.facing}
        $throwCooldown={penguin.throwCooldown}
        $grabCooldown={penguin.grabCooldown}
        $isChargingAttack={penguin.isChargingAttack}
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
        $dodgeDirection={penguin.dodgeDirection}
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
        style={{ display: shouldShowRitualForPlayer && ritualSpriteConfig ? 'none' : 'block' }}
      />

      {/* Ritual Sprite Sheet Animation - all 4 parts pre-rendered, only current one visible */}
      {/* Each player's ritual stops independently when they select their power-up and start salt throwing */}
      {shouldShowRitualForPlayer && (index === 0 ? ritualSpritesheetsPlayer1 : ritualSpritesheetsPlayer2).map((config, partIndex) => (
        <RitualSpriteContainer
          key={partIndex}
          $x={getDisplayPosition().x}
          $y={getDisplayPosition().y}
          $facing={penguin.facing}
          style={{ 
            visibility: partIndex === ritualPart ? 'visible' : 'hidden',
            pointerEvents: 'none'
          }}
        >
          <RitualSpriteImage
            src={config.spritesheet}
            alt={`Ritual Part ${partIndex + 1}`}
            $frame={partIndex === ritualPart ? ritualFrame : 0}
            $frameCount={config.frameCount}
            $isLocalPlayer={penguin.id === localId}
            draggable={false}
          />
        </RitualSpriteContainer>
      ))}

      {(penguin.isHit || penguin.isBeingThrown) && (
        <TintedImage
          $x={getDisplayPosition().x}
          $y={getDisplayPosition().y}
          $facing={penguin.facing}
          $isThrowing={penguin.isThrowing}
          $isRingOutThrowCutscene={penguin.isRingOutThrowCutscene}
          src={currentSpriteSrc}
          alt="hurt-tint"
          $variant="hurt"
        />
      )}

      {thickBlubberIndicator && (
        <TintedImage
          $x={getDisplayPosition().x}
          $y={getDisplayPosition().y}
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
        playerX={getDisplayPosition().x}
        playerY={getDisplayPosition().y + 100}
      />
      <SlapAttackHandsEffect
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        facing={penguin.facing}
        isActive={penguin.isSlapAttack}
        slapAnimation={penguin.slapAnimation}
      />
      <SlapParryEffect position={parryEffectPosition} />
      <HitEffect position={hitEffectPosition} />
      <RawParryEffect position={rawParryEffectPosition} />
      <GrabBreakEffect position={grabBreakEffectPosition} />
      <CounterGrabEffect position={counterGrabEffectPosition} />
      <SnowballImpactEffect position={snowballImpactPosition} />
      <StarStunEffect
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        facing={penguin.facing}
        isActive={showStarStunEffect}
      />
      <EdgeDangerEffect
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        facing={penguin.facing}
        isActive={penguin.isAtTheRopes}
      />
      <PerfectParryPowerEffect
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        isPerfectParrySuccess={penguin.isPerfectRawParrySuccess}
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
      <PumoCloneSpawnEffect clones={allPumoArmies} />
      {allPumoArmies.map((clone) => {
        // Determine the correct sprite based on the owner's fighter type and state
        let cloneSprite;
        if (clone.isStrafing) {
          // Use waddle sprites for strafing animation
          cloneSprite =
            clone.ownerFighter === "player 1" ? pumoWaddle2 : pumoWaddle;
        } else {
          // Use default sprites
          cloneSprite = clone.ownerFighter === "player 1" ? pumo2 : pumo;
        }

        return (
          <React.Fragment key={clone.id}>
            <PlayerShadow
              x={clone.x}
              y={clone.y}
              facing={clone.facing}
              isDodging={false}
              width="6.57%"
              height="2.04%"
              offsetLeft="15%"
              offsetRight="15%"
            />
            <PumoClone
              src={cloneSprite}
              alt="Pumo Clone"
              $x={clone.x}
              $y={clone.y}
              $facing={clone.facing}
              $size={clone.size}
            />
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
};

// Optimize the component with React.memo
export default React.memo(GameFighter, (prevProps, nextProps) => {
  // Add custom comparison logic if needed
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
