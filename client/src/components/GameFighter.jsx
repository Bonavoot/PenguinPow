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
import ChargedAttackSmokeEffect from "./ChargedAttackSmokeEffect";
import StarStunEffect from "./StarStunEffect";
import ThickBlubberEffect from "./ThickBlubberEffect";

import snowballThrow2 from "../assets/snowball-throw2.png";
import snowballThrow from "../assets/snowball-throw.png";
import pumo from "../assets/pumo.png";
import pumo2 from "../assets/pumo2.png";
import pumoWaddle from "../assets/pumo-waddle.png";
import pumoWaddle2 from "../assets/pumo-waddle2.png";
import pumoArmy from "../assets/pumo-army.png";
import pumoArmy2 from "../assets/pumo-army2.png";
import crouching from "../assets/blocking2.png";
import crouching2 from "../assets/blocking.png";
import grabbing from "../assets/grabbing.png";
import grabbing2 from "../assets/grabbing2.png";
import beingGrabbed from "../assets/is-being-grabbed.gif";
import beingGrabbed2 from "../assets/is-being-grabbed2.gif";
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
import hitEffectImage from "../assets/hit-effect.png";

import UiPlayerInfo from "./UiPlayerInfo";
import SaltEffect from "./SaltEffect";
import MatchOver from "./MatchOver";
import HitEffect from "./HitEffect";
import { getGlobalVolume } from "./Settings";
import SnowEffect from "./SnowEffect";

const GROUND_LEVEL = 120; // Ground level constant

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
  preloadImage(snowball);
  
  // Effect sprites
  preloadImage(hitEffectImage);
};

// Initialize pools and preloading immediately
initializeAudioPools();
initializeImagePreloading();

const playSound = (audioFile, volume = 1.0) => {
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
  isReady,
  isHit,
  isDead,
  isSlapAttack,
  isThrowing,
  isGrabbing,
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
  isThrowingSnowball,
  isSpawningPumoArmy,
  isAtTheRopes
) => {
  if (fighter === "player 2") {
    if (isAtTheRopes) return beingGrabbed;
    if (isBowing) return bow;
    if (isThrowTeching) return throwTech;
    if (isRecovering) return recovering;
    if (isThrowingSnowball) return snowballThrow;
    if (isSpawningPumoArmy) return pumoArmy;
    if (isSlapAttack) {
      return slapAnimation === 1 ? slapAttack1Red : slapAttack2Red;
    }
    if (isJumping) return throwing;
    if (isAttacking && !isSlapAttack) return attack;
    if (isGrabbing) {
      if (grabState === "attempting") {
        return grabAttemptType === "throw" ? throwing : grabbing;
      }
      return grabbing;
    }
    if (isBeingGrabbed || isBeingPulled || isBeingPushed) return beingGrabbed;
    if (isDodging) return dodging;
    if (isRawParrying) return crouching;
    if (isRawParryStun) return bow;
    if (isReady) return ready;
    if (isStrafing && !isThrowing) return pumoWaddle;
    if (isHit) return hit;
    if (isDead) return pumo;
    if (isThrowing) return throwing;
    if (isThrowingSalt) return salt;
    return pumo;
  } else if (fighter === "player 1") {
    if (isAtTheRopes) return beingGrabbed2;
    if (isJumping) return throwing2;
    if (isAttacking && !isSlapAttack) return attack2;
    if (isBowing) return bow2;
    if (isThrowTeching) return throwTech2;
    if (isRecovering) return recovering2;
    if (isThrowingSnowball) return snowballThrow2;
    if (isSpawningPumoArmy) return pumoArmy2;
    if (isSlapAttack) {
      return slapAnimation === 1 ? slapAttack1Blue : slapAttack2Blue;
    }
    if (isGrabbing) {
      if (grabState === "attempting") {
        return grabAttemptType === "throw" ? throwing2 : grabbing2;
      }
      return grabbing2;
    }
    if (isDodging) return dodging2;
    if (isRawParrying) return crouching2;
    if (isRawParryStun) return bow2;
    if (isReady) return ready2;
    if (isStrafing && !isThrowing) return pumoWaddle2;
    if (isHit) return hit2;
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

const RedTintOverlay = styled.div`
  position: absolute;
  width: 16.7%;
  height: auto;
  aspect-ratio: 1;
  left: ${(props) => (props.$x / 1280) * 100}%;
  bottom: ${(props) => (props.$y / 720) * 100}%;
  transform: ${(props) => `scaleX(${props.$facing})`};
  background: rgba(156, 136, 255, 0.7);
  z-index: 101;
  pointer-events: none;
  mix-blend-mode: multiply;
  animation: thickBlubberPulse 0.5s ease-in-out infinite;

  /* Use the player image as a mask to only show red where the image is opaque */
  mask-image: url(${(props) => props.$imageSrc});
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-image: url(${(props) => props.$imageSrc});
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;

  @keyframes thickBlubberPulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
`;

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
        "speedFactor",
        "sizeMultiplier",
        "isRecovering",
        "isRawParryStun",
        "isAtTheRopes",
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
      props.$isReady,
      props.$isHit,
      props.$isDead,
      props.$isSlapAttack,
      props.$isThrowing,
      props.$isGrabbing,
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
      props.$isThrowingSnowball,
      props.$isSpawningPumoArmy,
      props.$isAtTheRopes
    ),
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      transform: props.$facing === 1 ? "scaleX(1)" : "scaleX(-1)",
      zIndex:
        props.$isThrowing || props.$isDodging || props.$isGrabbing ? 98 : 99,
      filter: props.$isRawParrying
        ? "drop-shadow(0 0 8px rgba(0, 150, 255, 0.8)) brightness(1.3) drop-shadow(0 0 3px #000)"
        : "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) contrast(1.2) ",
      animation: props.$isRawParrying
        ? "rawParryFlash 1.2s ease-in-out infinite"
        : "none",
      width: "min(16.7%, 437px)",
      height: "auto",
      willChange: "bottom, left, filter, opacity",
      pointerEvents: "none",
      transformOrigin: "center",
      transition: "none",
    },
  }))`
  /* Static styles only - no dynamic props here */
  @keyframes rawParryFlash {
    0% {
      filter: drop-shadow(0 0 2px rgba(0, 150, 255, 0.4)) brightness(1) drop-shadow(0 0 1px #000);
    }
    25% {
      filter: drop-shadow(0 0 12px rgba(0, 150, 255, 0.9)) brightness(1.6) drop-shadow(0 0 4px #000);
    }
    50% {
      filter: drop-shadow(0 0 8px rgba(0, 150, 255, 0.7)) brightness(1.3) drop-shadow(0 0 3px #000);
    }
    75% {
      filter: drop-shadow(0 0 12px rgba(0, 150, 255, 0.9)) brightness(1.6) drop-shadow(0 0 4px #000);
    }
    100% {
      filter: drop-shadow(0 0 2px rgba(0, 150, 255, 0.4)) brightness(1) drop-shadow(0 0 1px #000);
    }
  }
`;

const FloatingPowerUpText = styled.div`
  position: absolute;
  font-family: "Bungee", cursive;
  font-size: clamp(0.85rem, 1.6vw, 1.3rem);
  font-weight: 400;
  color: ${(props) => {
    switch (props.$powerUpType) {
      case "speed":
        return "#00BFFF";
      case "power":
        return "#FF4444";
      case "snowball":
        return "#FFFFFF";
      case "pumo_army":
        return "#FF8C00";
      case "thick_blubber":
        return "#9C88FF";
      default:
        return "#FFD700";
    }
  }};
  text-shadow: -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000,
    1.5px 1.5px 0 #000, -1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000,
    0 0 8px
      ${(props) => {
        switch (props.$powerUpType) {
          case "speed":
            return "rgba(0, 191, 255, 0.6)";
          case "power":
            return "rgba(255, 68, 68, 0.6)";
          case "snowball":
            return "rgba(255, 255, 255, 0.6)";
          case "pumo_army":
            return "rgba(255, 140, 0, 0.6)";
          case "thick_blubber":
            return "rgba(156, 136, 255, 0.6)";
          default:
            return "rgba(255, 215, 0, 0.6)";
        }
      }};
  pointer-events: none;
  animation: simpleFloatUp 2s ease-out forwards;
  bottom: 55%;
  left: ${(props) => (props.$index === 0 ? "20%" : "auto")};
  right: ${(props) => (props.$index === 1 ? "20%" : "auto")};
  text-align: center;
  transform-origin: center;
  z-index: 101;
  opacity: 0;
  letter-spacing: 0.15em;
  white-space: nowrap;
  text-transform: uppercase;

  @keyframes simpleFloatUp {
    0% {
      transform: translateY(0px) scale(1);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    100% {
      transform: translateY(-60px) scale(1);
      opacity: 0;
    }
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
      bottom: `${((GROUND_LEVEL + 100) / 720) * 130}%`,
      left: props.$index === 0 ? "18.5%" : "auto",
      right: props.$index === 1 ? "18.5%" : "auto",
      transform: props.$index === 1 ? "scaleX(-1)" : "none",
      zIndex: 1,
      pointerEvents: "none",
      opacity: props.$isVisible ? 1 : 0,
      transition: "opacity 0.3s ease",
    },
  }))``;

const YouLabel = styled.div`
  position: absolute;
  bottom: ${(props) => (props.y / 720) * 100 + 30}%;
  left: ${(props) => (props.x / 1280) * 100 + 9}%;
  transform: translateX(-50%);
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

const SnowballProjectile = styled.img`
  position: absolute;
  width: 4.1%;
  height: auto;
  left: ${(props) => (props.$x / 1280) * 100 + 5}%;
  bottom: ${(props) => (props.$y / 720) * 100 + 17}%;
  z-index: 95;
  pointer-events: none;
  filter: drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000)
    drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000);
`;

const PumoClone = styled.img
  .withConfig({
    shouldForwardProp: (prop) =>
      !["$x", "$y", "$facing", "$size"].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      width: `${(props.$size || 0.6) * 16.7}%`,
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
    dodgeCharges: 2,
    dodgeChargeCooldowns: [0, 0],
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
  });

  // Add interpolation state
  const [interpolatedPosition, setInterpolatedPosition] = useState({ x: 0, y: 0 });
  const previousState = useRef(null);
  const currentState = useRef(null);
  const lastUpdateTime = useRef(performance.now());
  const interpolationStartTime = useRef(performance.now());

  // Store both players' data for UI (only needed for first component)
  const [allPlayersData, setAllPlayersData] = useState({
    player1: null,
    player2: null,
  });
  const [hakkiyoi, setHakkiyoi] = useState(false);
  const [gyojiState, setGyojiState] = useState("idle");
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState("");
  const [playerOneWinCount, setPlayerOneWinCount] = useState(0);
  const [playerTwoWinCount, setPlayerTwoWinCount] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [parryEffectPosition, setParryEffectPosition] = useState(null);
  const [hitEffectPosition, setHitEffectPosition] = useState(null);
  const [showStarStunEffect, setShowStarStunEffect] = useState(false);
  const [hasUsedPowerUp, setHasUsedPowerUp] = useState(false);
  const [showFloatingPowerUp, setShowFloatingPowerUp] = useState(false);
  const [floatingPowerUpType, setFloatingPowerUpType] = useState(null);
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

  // Interpolation constants
  const SERVER_TICK_RATE = 64; // Server runs at 64 FPS
  const SERVER_UPDATE_INTERVAL = 1000 / SERVER_TICK_RATE; // ~15.625ms

  // Interpolation function for smooth movement
  const interpolatePosition = useCallback((prevPos, currentPos, factor) => {
    // Don't interpolate discrete jumps (teleports, throws, hits)
    const maxInterpolationDistance = 100; // Don't interpolate if positions are too far apart
    const distance = Math.abs(currentPos.x - prevPos.x) + Math.abs(currentPos.y - prevPos.y);
    
    if (distance > maxInterpolationDistance) {
      return currentPos; // Use current position for teleports/throws
    }

    // Don't interpolate during certain states where position changes should be instant
    if (penguin.isBeingThrown || penguin.isThrowing || penguin.isHit || penguin.isDodging) {
      return currentPos;
    }

    return {
      x: prevPos.x + (currentPos.x - prevPos.x) * factor,
      y: prevPos.y + (currentPos.y - prevPos.y) * factor,
    };
  }, [penguin.isBeingThrown, penguin.isThrowing, penguin.isHit, penguin.isDodging]);

  // Animation loop for interpolation
  const interpolationLoop = useCallback((timestamp) => {
    if (currentState.current && previousState.current) {
      const timeSinceUpdate = timestamp - lastUpdateTime.current;
      const interpolationFactor = Math.min(timeSinceUpdate / SERVER_UPDATE_INTERVAL, 1);

      // Only interpolate position, not discrete states
      const interpolatedPos = interpolatePosition(
        { x: previousState.current.x, y: previousState.current.y },
        { x: currentState.current.x, y: currentState.current.y },
        interpolationFactor
      );

      setInterpolatedPosition(interpolatedPos);
    } else if (currentState.current) {
      // Fallback to current position if no previous state
      setInterpolatedPosition({ x: currentState.current.x, y: currentState.current.y });
    }

    requestAnimationFrame(interpolationLoop);
  }, [interpolatePosition]);

  // Start interpolation loop
  useEffect(() => {
    const animationId = requestAnimationFrame(interpolationLoop);
    return () => cancelAnimationFrame(animationId);
  }, [interpolationLoop]);

  // Smooth interpolation with predictive positioning for better feel
  const getDisplayPosition = useCallback(() => {
    // If no interpolation data is available yet, fall back to server position
    if (!interpolatedPosition.x && !interpolatedPosition.y && penguin.x) {
      return { x: penguin.x, y: penguin.y };
    }
    return interpolatedPosition;
  }, [interpolatedPosition, penguin.x, penguin.y]);

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
        dodgeCharges: playerData.dodgeCharges || 2,
        dodgeChargeCooldowns: playerData.dodgeChargeCooldowns || [0, 0],
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
      if (
        data &&
        typeof data.x === "number" &&
        typeof data.y === "number"
      ) {
        setHitEffectPosition({
          x: data.x + 150,
          y: data.y + 110, // Add GROUND_LEVEL to match player height
          facing: data.facing || 1, // Default to 1 if facing not provided
          timestamp: data.timestamp, // Pass through unique timestamp
          hitId: data.hitId, // Pass through unique hit ID
        });
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

    socket.on("power_up_activated", (data) => {
      if (data.playerId === player.id) {
        // Show floating text for this specific player
        setShowFloatingPowerUp(true);
        setFloatingPowerUpType(data.powerUpType);

        // Hide the floating text after animation
        setTimeout(() => {
          setShowFloatingPowerUp(false);
        }, 2000);

        // Only update penguin state and play sound for local player
        if (data.playerId === localId) {
          setPenguin((prev) => ({
            ...prev,
            activePowerUp: data.powerUpType,
            powerUpMultiplier:
              data.powerUpType === "speed"
                ? 1.4
                : data.powerUpType === "power"
                ? 1.3
                : 1,
          }));
          setHasUsedPowerUp(true);
          playSound(saltSound, 0.01);
        }
      }
    });

    socket.on("game_reset", (data) => {
      setGameOver(data);
      setGyojiState("idle");
      setMatchOver(false);
      setHasUsedPowerUp(false);
      onResetDisconnectState(); // Reset opponent disconnected state for new games
      console.log("game reset gamefighter.jsx");

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

    socket.on("game_start", () => {
      console.log("game start gamefighter.jsx");
      setHakkiyoi(true);
      // Clear the countdown timer when game starts and immediately reset countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      // Immediately set countdown to 0 to hide YOU label during gameplay
      setCountdown(0);
      
      // Hide hakkiyoi text after 3 seconds
      setTimeout(() => {
        setHakkiyoi(false);
      }, 3000);
    });

    socket.on("game_over", (data) => {
      setGameOver(data.isGameOver);
      setWinner(data.winner);
      console.log(data.winner);
      if (data.winner.fighter === "player 1") {
        setPlayerOneWinCount(data.wins);
        setGyojiState("player1Win");
      } else {
        setPlayerTwoWinCount(data.wins);
        setGyojiState("player2Win");
      }
    });

    socket.on("match_over", (data) => {
      setMatchOver(data.isMatchOver);
      setPlayerOneWinCount(0);
      setPlayerTwoWinCount(0);
    });

    socket.on("rematch", () => {
      setMatchOver(false);
    });

    return () => {
      socket.off("fighter_action");
      socket.off("slap_parry");
      socket.off("player_hit");
      socket.off("perfect_parry");
      socket.off("game_start");
      socket.off("game_reset");
      socket.off("game_over");
      socket.off("match_over");
      socket.off("power_up_activated");
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
      playSound(dodgeSound, 0.01);
    }
    lastDodgeState.current = penguin.isDodging;
  }, [penguin.isDodging]);

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

  // Add screen shake effect
  useEffect(() => {
    if (screenShake.intensity > 0) {
      const shakeInterval = setInterval(() => {
        const elapsed = Date.now() - screenShake.startTime;
        if (elapsed >= screenShake.duration) {
          setScreenShake({ intensity: 0, duration: 0, startTime: 0 });
          clearInterval(shakeInterval);
          return;
        }

        // Calculate shake intensity based on elapsed time (fade out)
        const remainingIntensity =
          screenShake.intensity * (1 - elapsed / screenShake.duration);

        // Apply random offset based on intensity
        const offsetX = (Math.random() - 0.5) * remainingIntensity * 10;
        const offsetY = (Math.random() - 0.5) * remainingIntensity * 10;

        // Apply the shake effect to the game container
        const gameContainer = document.querySelector(".game-container");
        if (gameContainer) {
          gameContainer.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }
      }, 16); // 60fps

      return () => {
        clearInterval(shakeInterval);
        // Reset transform when effect ends
        const gameContainer = document.querySelector(".game-container");
        if (gameContainer) {
          gameContainer.style.transform = "translate(0px, 0px)";
        }
      };
    }
  }, [screenShake]);

  // Update thick blubber indicator based on actual game state
  const shouldShowThickBlubberIndicator = useMemo(() => {
    return (
      penguin.activePowerUp === "thick_blubber" &&
      penguin.isAttacking &&
      penguin.attackType === "charged" &&
      !penguin.hitAbsorptionUsed
    );
  }, [
    penguin.activePowerUp,
    penguin.isAttacking,
    penguin.attackType,
    penguin.hitAbsorptionUsed,
  ]);

  useEffect(() => {
    setThickBlubberIndicator(shouldShowThickBlubberIndicator);
  }, [shouldShowThickBlubberIndicator]);

  // Add screen shake and thick blubber absorption event listeners
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
        playSound(thickBlubberSound, 0.03);

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

    // Test listener for any event to verify socket is working
    socket.on("fighter_action", () => {
    });

    // Test if socket is connected and in the right room
    console.log(
      `🔵 Socket connected: ${socket.connected}, Socket ID: ${socket.id}, Room: ${roomName}`
    );

    return () => {
      console.log(`🔵 Cleaning up event listeners for player ${player.id}`);
      socket.off("screen_shake");
      socket.off("thick_blubber_absorption");
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
      <SnowEffect
        mode={matchOver ? "envelope" : "snow"}
        winner={winner}
        playerIndex={index}
      />
      {index === 0 && (
        <UiPlayerInfo
          playerOneWinCount={playerOneWinCount}
          playerTwoWinCount={playerTwoWinCount}
          player1Stamina={allPlayersData.player1?.stamina || 100}
          player1DodgeCharges={allPlayersData.player1?.dodgeCharges || 2}
          player1DodgeChargeCooldowns={
            allPlayersData.player1?.dodgeChargeCooldowns || [0, 0]
          }
          player1ActivePowerUp={allPlayersData.player1?.activePowerUp || null}
          player1SnowballCooldown={
            allPlayersData.player1?.snowballCooldown || false
          }
          player1PumoArmyCooldown={
            allPlayersData.player1?.pumoArmyCooldown || false
          }
          player2Stamina={allPlayersData.player2?.stamina || 100}
          player2DodgeCharges={allPlayersData.player2?.dodgeCharges || 2}
          player2DodgeChargeCooldowns={
            allPlayersData.player2?.dodgeChargeCooldowns || [0, 0]
          }
          player2ActivePowerUp={allPlayersData.player2?.activePowerUp || null}
          player2SnowballCooldown={
            allPlayersData.player2?.snowballCooldown || false
          }
          player2PumoArmyCooldown={
            allPlayersData.player2?.pumoArmyCooldown || false
          }
        />
      )}

      <Gyoji gyojiState={gyojiState} hakkiyoi={hakkiyoi} />
      {hakkiyoi && <div className="hakkiyoi">HAKKI-YOI !</div>}
      {gameOver && (
        <div
          className="hakkiyoi"
          style={{
            color: `${winner.fighter === "player 1" ? "aqua" : "salmon"}`,
          }}
        >
          {winner.fighter} wins !
        </div>
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
      {showFloatingPowerUp && (
        <FloatingPowerUpText $powerUpType={floatingPowerUpType} $index={index}>
          {floatingPowerUpType === "speed"
            ? "HAPPY FEET"
            : floatingPowerUpType === "power"
            ? "POWER WATER"
            : floatingPowerUpType.replace(/_/g, " ").toUpperCase()}
        </FloatingPowerUpText>
      )}
      <PlayerShadow
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        facing={penguin.facing}
        isDodging={penguin.isDodging}
      />
      <DodgeSmokeEffect
        x={penguin.dodgeStartX || getDisplayPosition().x}
        y={penguin.dodgeStartY || getDisplayPosition().y}
        isDodging={penguin.isDodging}
        facing={penguin.facing}
        dodgeDirection={penguin.dodgeDirection}
      />

      <ChargedAttackSmokeEffect
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        isChargingAttack={penguin.isChargingAttack}
        facing={penguin.facing}
        isSlapAttack={penguin.isSlapAttack}
        isThrowing={penguin.isThrowing}
        chargeCancelled={penguin.chargeCancelled || false}
      />
      <StyledImage
        $fighter={penguin.fighter}
        $isDiving={penguin.isDiving}
        $isJumping={penguin.isJumping}
        $isAttacking={penguin.isAttacking}
        $isDodging={penguin.isDodging}
        $isStrafing={penguin.isStrafing}
        $isRawParrying={penguin.isRawParrying}
        $isReady={penguin.isReady}
        $isHit={penguin.isHit}
        $isDead={penguin.isDead}
        $isSlapAttack={penguin.isSlapAttack}
        $isThrowing={penguin.isThrowing}
        $isGrabbing={penguin.isGrabbing}
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
        $speedFactor={penguin.speedFactor}
        $sizeMultiplier={penguin.sizeMultiplier}
        $isRecovering={penguin.isRecovering}
        $isRawParryStun={penguin.isRawParryStun}
        $isThrowingSnowball={penguin.isThrowingSnowball}
        $isSpawningPumoArmy={penguin.isSpawningPumoArmy}
        $isAtTheRopes={penguin.isAtTheRopes}
      />

      {thickBlubberIndicator && (
        <RedTintOverlay
          $x={getDisplayPosition().x}
          $y={getDisplayPosition().y}
          $facing={penguin.facing}
          $imageSrc={getImageSrc(
            penguin.fighter,
            penguin.isDiving,
            penguin.isJumping,
            penguin.isAttacking,
            penguin.isDodging,
            penguin.isStrafing,
            penguin.isRawParrying,
            penguin.isReady,
            penguin.isHit,
            penguin.isDead,
            penguin.isSlapAttack,
            penguin.isThrowing,
            penguin.isGrabbing,
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
            penguin.isThrowingSnowball,
            penguin.isSpawningPumoArmy
          )}
        />
      )}
      <SaltEffect
        isActive={penguin.isThrowingSalt}
        playerFacing={penguin.facing}
        playerX={getDisplayPosition().x}
        playerY={getDisplayPosition().y + 100}
      />
      <SlapParryEffect position={parryEffectPosition} />
      <HitEffect position={hitEffectPosition} />
      <StarStunEffect
        x={getDisplayPosition().x}
        y={getDisplayPosition().y}
        facing={penguin.facing}
        isActive={showStarStunEffect}
      />
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
              width="7.3%"
              height="2.27%"
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
    prevProps.onResetDisconnectState === nextProps.onResetDisconnectState
  );
});
