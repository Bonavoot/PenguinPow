import { useContext, useEffect, useState, useRef } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled from "styled-components";
import "./MatchOver.css";
import PlayerStaminaUi from "./PlayerStaminaUi";
import Gyoji from "./Gyoji";
import PlayerShadow from "./PlayerShadow";
import ThrowTechEffect from "./ThrowTechEffect";
import PowerMeter from "./PowerMeter";
import SlapParryEffect from "./SlapParryEffect";
import DodgeSmokeEffect from "./DodgeDustEffect";
import ChargedAttackSmokeEffect from "./ChargedAttackSmokeEffect";
import DodgeChargeUI from "./DodgeChargeUI";

import pumo from "../assets/pumo.png";
import pumo2 from "../assets/pumo2.png";
import pumoWaddle from "../assets/pumo-waddle.png";
import pumoWaddle2 from "../assets/pumo-waddle2.png";
import crouching from "../assets/crouching.png";
import crouching2 from "../assets/blocking.gif";
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

import UiPlayerInfo from "./UiPlayerInfo";
import SaltEffect from "./SaltEffect";
import MatchOver from "./MatchOver";
import HitEffect from "./HitEffect";
import { getGlobalVolume } from "./Settings";
import SnowEffect from "./SnowEffect";

const GROUND_LEVEL = 145; // Ground level constant

const playSound = (audioFile, volume = 1.0) => {
  try {
    const sound = new Audio(audioFile);
    sound.volume = volume * getGlobalVolume();
    sound.play().catch((error) => {
      // Ignore AbortError as it's expected when sounds overlap
      if (error.name !== "AbortError") {
        console.error("Error playing sound:", error);
      }
    });
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
  isRawParryStun
) => {
  if (fighter === "player 2") {
    if (isBowing) return bow;
    if (isThrowTeching) return throwTech;
    if (isRecovering) return recovering;
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
    if (isRawParryStun) return hit;
    if (isReady) return ready;
    if (isStrafing && !isThrowing) return pumoWaddle;
    if (isHit) return hit;
    if (isDead) return pumo;
    if (isThrowing) return throwing;
    if (isThrowingSalt) return salt;
    return pumo;
  } else if (fighter === "player 1") {
    if (isJumping) return throwing2;
    if (isAttacking && !isSlapAttack) return attack2;
    if (isBowing) return bow2;
    if (isThrowTeching) return throwTech2;
    if (isRecovering) return recovering2;
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
    if (isRawParryStun) return hit2;
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
      props.$isRawParryStun
    ),
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(props.$y / 720) * 100}%`,
      transform: `scaleX(${props.$facing})`,
      zIndex:
        props.$isThrowing || props.$isDodging || props.$isGrabbing ? 98 : 99,
      filter: props.$isDodging
        ? "drop-shadow(0 0 6px rgba(255, 255, 255, 0.6)) brightness(1.5) drop-shadow(0 0 2px #000)"
        : "drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)",
      animation: props.$isDodging
        ? "dodgeFlash 0.3s ease-in-out"
        : "none",
    },
  }))`
  position: absolute;
  width: 18.4%;
  height: auto;
  will-change: transform, bottom, left, filter, opacity;
  pointer-events: none;
  transform-origin: center;

  @keyframes dodgeFlash {
    0% {
      filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0)) brightness(1);
      opacity: 1;
    }
    15% {
      filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6)) brightness(2);
      opacity: 0.95;
    }
    30% {
      filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.3)) brightness(1.2);
      opacity: 0.98;
    }
    45% {
      filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6)) brightness(2);
      opacity: 0.95;
    }
    60% {
      filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.3)) brightness(1.2);
      opacity: 0.98;
    }
    75% {
      filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6)) brightness(2);
      opacity: 0.95;
    }
    100% {
      filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0)) brightness(1);
      opacity: 1;
    }
  }
`;

const PowerUpText = styled.div`
  position: absolute;
  font-family: "Bungee";
  font-size: clamp(0.5rem, 1.5vw, 1.2rem);
  color: #ffffff;
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000;
  pointer-events: none;
  bottom: 54%;
  left: ${(props) => (props.$index === 0 ? "18.3%" : "auto")};
  right: ${(props) => (props.$index === 1 ? "17.9%" : "auto")};
  text-align: center;
  transform: translateX(${(props) => (props.$index === 1 ? "50%" : "-50%")});
`;

const FloatingPowerUpText = styled.div`
  position: absolute;
  font-family: "Bungee";
  font-size: clamp(0.5rem, 1.5vw, 1.2rem);
  color: ${(props) => {
    switch (props.$powerUpType) {
      case "speed":
        return "#0066ff"; // Electric blue
      case "power":
        return "#ff4444"; // red
      default:
        return "#ffffff";
    }
  }};
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000;
  pointer-events: none;
  animation: powerUpFloat 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  bottom: 52%;
  left: ${(props) => (props.$index === 0 ? "21.5%" : "auto")};
  right: ${(props) => (props.$index === 1 ? "21.5%" : "auto")};
  text-align: center;
  transform-origin: center;
  z-index: 100;
  opacity: 0;
  filter: drop-shadow(
    0 0 8px
      ${(props) => {
        switch (props.$powerUpType) {
          case "speed":
            return "rgba(0, 102, 255, 0.6)";
          case "power":
            return "rgba(255, 68, 68, 0.6)";
          default:
            return "rgba(255, 255, 255, 0.6)";
        }
      }}
  );

  @keyframes powerUpFloat {
    0% {
      transform: translateY(0) scale(0.8);
      opacity: 0;
    }
    20% {
      transform: translateY(-20px) scale(1.1);
      opacity: 1;
    }
    100% {
      transform: translateY(-100px) scale(0.9);
      opacity: 0;
    }
  }
`;

const KeyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.25rem, 0.5vw, 0.5rem);
`;

const Key = styled.div`
  width: clamp(1.5rem, 3vw, 2.5rem);
  height: clamp(1.5rem, 3vw, 2.5rem);
  background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
  border-radius: 0.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Bungee";
  font-size: clamp(0.8rem, 1.5vw, 1.2rem);
  color: #ffd700;
  box-shadow: 0 0.2rem 0.4rem rgba(0, 0, 0, 0.3),
    inset 0 0.1rem 0.2rem rgba(255, 255, 255, 0.1);
  position: relative;
  animation: keyPress 1.5s infinite;

  @keyframes keyPress {
    0% {
      transform: translateY(0) scale(1);
      box-shadow: 0 0.2rem 0.4rem rgba(0, 0, 0, 0.3),
        inset 0 0.1rem 0.2rem rgba(255, 255, 255, 0.1);
    }
    10% {
      transform: translateY(-0.3rem) scale(0.95);
      box-shadow: 0 0.1rem 0.2rem rgba(0, 0, 0, 0.2),
        inset 0 0.05rem 0.1rem rgba(255, 255, 255, 0.05);
    }
    20% {
      transform: translateY(0) scale(1);
      box-shadow: 0 0.2rem 0.4rem rgba(0, 0, 0, 0.3),
        inset 0 0.1rem 0.2rem rgba(255, 255, 255, 0.1);
    }
    30% {
      transform: translateY(-0.2rem) scale(0.98);
      box-shadow: 0 0.15rem 0.3rem rgba(0, 0, 0, 0.25),
        inset 0 0.08rem 0.15rem rgba(255, 255, 255, 0.08);
    }
    40% {
      transform: translateY(0) scale(1);
      box-shadow: 0 0.2rem 0.4rem rgba(0, 0, 0, 0.3),
        inset 0 0.1rem 0.2rem rgba(255, 255, 255, 0.1);
    }
    100% {
      transform: translateY(0) scale(1);
      box-shadow: 0 0.2rem 0.4rem rgba(0, 0, 0, 0.3),
        inset 0 0.1rem 0.2rem rgba(255, 255, 255, 0.1);
    }
  }
`;

const KeyLabel = styled.div`
  font-size: clamp(0.6rem, 1vw, 0.8rem);
  color: #ffd700;
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000;
`;

const CountdownTimer = styled.div`
  position: absolute;
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
      width: "5%",
      height: "auto",
      bottom: `${((GROUND_LEVEL + 100) / 720) * 118}%`,
      left: props.$index === 0 ? "16%" : "auto",
      right: props.$index === 1 ? "15.5%" : "auto",
      transform: props.$index === 1 ? "scaleX(-1)" : "none",
      zIndex: 1,
      pointerEvents: "none",
      opacity: props.$isVisible ? 1 : 0,
      transition: "opacity 0.3s ease",
    },
  }))``;

const YouLabel = styled.div`
  position: absolute;
  bottom: ${props => (props.y / 720) * 100 + 33}%;
  left: ${props => (props.x / 1280) * 100 + 9}%;
  transform: translateX(-50%);
  color: #ffd700;
  font-family: "Bungee";
  font-size: clamp(18px, 1.5vw, 24px);
  text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;
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

const GameFighter = ({ player, index, roomName, localId }) => {
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
    slapAnimation: 2,
    isBowing: false,
    isThrowTeching: false,
    isBeingPulled: false,
    isBeingPushed: false,
    grabState: null,
    grabAttemptType: null,
    isRecovering: false,
    isRawParryStun: false,
    facing: 1,
    x: 0,
    y: 0,
    dodgeCharges: 2,
    dodgeChargeCooldowns: [0, 0],
  });
  const [stamina, setStamina] = useState(player);
  const [hakkiyoi, setHakkiyoi] = useState(false);
  const [gyojiState, setGyojiState] = useState("idle");
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState("");
  const [playerOneWinCount, setPlayerOneWinCount] = useState(0);
  const [playerTwoWinCount, setPlayerTwoWinCount] = useState(0);
  const [matchOver, setMatchOver] = useState(false);
  const [parryEffectPosition, setParryEffectPosition] = useState(null);
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

  const lastAttackState = useRef(player.isAttacking);
  const lastHitState = useRef(player.isHit);
  const lastThrowState = useRef(player.isThrowing);
  const lastDodgeState = useRef(player.isDodging);
  const lastGrabState = useRef(player.isGrabbing);
  const lastThrowingSaltState = useRef(player.isThrowingSalt);
  const gameMusicRef = useRef(null);
  const eeshiMusicRef = useRef(null);
  const lastWinnerState = useRef(gameOver);
  const lastWinnerSoundPlay = useRef(0);

  useEffect(() => {
    socket.on("fighter_action", (data) => {
      if (index === 0) {
        setPenguin({
          ...data.player1,
          isDodging: data.player1.isDodging || false,
          dodgeDirection:
            typeof data.player1.dodgeDirection === "number"
              ? data.player1.dodgeDirection
              : data.player1.facing || 1,
          dodgeCharges: data.player1.dodgeCharges || 2,
          dodgeChargeCooldowns: data.player1.dodgeChargeCooldowns || [0, 0],
        });
        setStamina(data.player1.stamina);
      } else if (index === 1) {
        setPenguin({
          ...data.player2,
          isDodging: data.player2.isDodging || false,
          dodgeDirection:
            typeof data.player2.dodgeDirection === "number"
              ? data.player2.dodgeDirection
              : data.player2.facing || 1,
          dodgeCharges: data.player2.dodgeCharges || 2,
          dodgeChargeCooldowns: data.player2.dodgeChargeCooldowns || [0, 0],
        });
        setStamina(data.player2.stamina);
      }
    });

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

    socket.on("power_up_activated", (data) => {
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
        setShowFloatingPowerUp(true);
        setFloatingPowerUpType(data.powerUpType);
        playSound(saltSound, 0.01);

        // Hide the floating text after animation
        setTimeout(() => {
          setShowFloatingPowerUp(false);
        }, 2000);
      }
    });

    socket.on("game_reset", (data) => {
      setGameOver(data);
      setGyojiState("idle");
      setMatchOver(false);
      setHasUsedPowerUp(false);
      setCountdown(15);
      console.log("game reset gamefighter.jsx");

      // Start countdown timer immediately
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on("game_start", () => {
      console.log("game start gamefighter.jsx");
      setHakkiyoi(true);
      // Clear the countdown timer when game starts
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        setCountdown(0);
      }
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
      socket.off("game_start");
      socket.off("game_reset");
      socket.off("game_over");
      socket.off("match_over");
      socket.off("power_up_activated");
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [index, socket]);

  useEffect(() => {
    gameMusicRef.current = new Audio(gameMusic);
    gameMusicRef.current.volume = 0.009; // lower volume
    eeshiMusicRef.current = new Audio(eeshiMusic);
    eeshiMusicRef.current.volume = 0.009; // lower volume
    eeshiMusicRef.current.loop = true;
    eeshiMusicRef.current.play();

    return () => {
      eeshiMusicRef.current.pause();
    };
  }, []);

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
      // eeshiMusicRef.current.volume = 0.006;
      eeshiMusicRef.current.loop = true;
      eeshiMusicRef.current.play();
    });

    return () => {
      socket.off("game_start");
      socket.off("game_over");
    };
  }, [socket]);

  useEffect(() => {
    if (penguin.isAttacking && !lastAttackState.current) {
      playSound(attackSound, 0.01);
    }
    // Update the last attack state
    lastAttackState.current = penguin.isAttacking;
  }, [penguin.isAttacking]);

  useEffect(() => {
    if (penguin.isHit && !lastHitState.current && !penguin.isBeingThrown) {
      playSound(hitSound, 0.01);
    }
    lastHitState.current = penguin.isHit;
  }, [penguin.isHit, penguin.isBeingThrown]);

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

  // Add screen shake event listener
  useEffect(() => {
    socket.on("screen_shake", (data) => {
      setScreenShake({
        intensity: data.intensity,
        duration: data.duration,
        startTime: Date.now(),
      });
    });

    return () => {
      socket.off("screen_shake");
    };
  }, [socket]);

  return (
    <div className="ui-container">
      <SnowEffect
        mode={matchOver ? "envelope" : "snow"}
        winner={winner}
        playerIndex={index}
      />
      <UiPlayerInfo
        playerOneWinCount={playerOneWinCount}
        playerTwoWinCount={playerTwoWinCount}
      />

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
      {penguin.id === localId && !hakkiyoi && gyojiState === "idle" && countdown > 0 && (
        <YouLabel x={penguin.x} y={penguin.y}>YOU</YouLabel>
      )}
      <PowerMeter
        isCharging={penguin.isChargingAttack}
        chargePower={penguin.chargeAttackPower}
        x={penguin.x}
        y={penguin.y}
        facing={penguin.facing}
        playerId={penguin.id}
        localId={localId}
        activePowerUp={penguin.activePowerUp}
      />
      <PlayerStaminaUi
        stamina={stamina}
        index={index}
        dodgeCharges={penguin.dodgeCharges}
        dodgeChargeCooldowns={penguin.dodgeChargeCooldowns}
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
      {penguin.id === localId &&
        !hasUsedPowerUp &&
        !penguin.isThrowingSalt &&
        gyojiState === "idle" &&
        countdown > 0 && (
          <PowerUpText $index={index}>
            <KeyContainer>
              <Key>F</Key>
              <KeyLabel>POWER UP</KeyLabel>
            </KeyContainer>
          </PowerUpText>
        )}
      {showFloatingPowerUp && (
        <FloatingPowerUpText $powerUpType={floatingPowerUpType} $index={index}>
          {floatingPowerUpType.toUpperCase()}++
        </FloatingPowerUpText>
      )}
      <PlayerShadow
        x={penguin.x}
        y={penguin.y}
        facing={penguin.facing}
        isDodging={penguin.isDodging}
      />
      <DodgeSmokeEffect
        x={penguin.dodgeStartX || penguin.x}
        y={penguin.dodgeStartY || penguin.y}
        isDodging={penguin.isDodging}
        facing={penguin.facing}
        dodgeDirection={penguin.dodgeDirection}
      />
      <DodgeChargeUI
        dodgeCharges={penguin.dodgeCharges}
        dodgeChargeCooldowns={penguin.dodgeChargeCooldowns}
        index={index}
      />
      <ChargedAttackSmokeEffect
        x={penguin.x}
        y={penguin.y}
        isChargingAttack={penguin.isChargingAttack}
        facing={penguin.facing}
        isSlapAttack={penguin.isSlapAttack}
        isThrowing={penguin.isThrowing}
      />
      <HitEffect
        isActive={penguin.isHit}
        x={penguin.x}
        y={penguin.y}
        facing={penguin.facing}
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
        $x={penguin.x}
        $y={penguin.y}
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
        style={{
          transform: `scaleX(${penguin.facing})`,
          width: "18.4%",
        }}
      />
      <SaltEffect
        isActive={penguin.isThrowingSalt}
        playerFacing={penguin.facing}
        playerX={penguin.x}
        playerY={penguin.y + 100}
      />
      <SlapParryEffect position={parryEffectPosition} />
      <ThrowTechEffect />
      {countdown > 0 &&
        !hakkiyoi &&
        !matchOver &&
        !gyojiState.includes("ready") && (
          <CountdownTimer>{countdown}</CountdownTimer>
        )}
    </div>
  );
};

GameFighter.propTypes = {
  player: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  roomName: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
};

export default GameFighter;
