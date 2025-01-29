import { useContext, useEffect, useState, useRef } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled from "styled-components";
import "./MatchOver.css";
import PlayerStaminaUi from "./PlayerStaminaUi";
import Gyoji from "./Gyoji";
import PlayerShadow from "./PlayerShadow";
import ThrowTechEffect from "./ThrowTechEffect";
// import "./DustEffect.css";
// import DustEffect from "./DustEffect";

import pumo from "../assets/pumo.png";
import pumo2 from "../assets/pumo2.png";
import pumoWaddle from "../assets/pumo-waddle.gif";
import pumoWaddle2 from "../assets/pumo-waddle2.gif";
import crouching from "../assets/crouching.png";
import crouching2 from "../assets/crouching2.png";
import grabbing from "../assets/grabbing.png";
import grabbing2 from "../assets/grabbing2.png";
import grabSound from "../sounds/grab-sound.mp3";
import ready from "../assets/ready.png";
import ready2 from "../assets/ready2.png";
import attack from "../assets/attack.png";
import attack2 from "../assets/attack2.png";
import slapAttack1Blue from "../assets/slapAttack1blue.png";
import slapAttack2Blue from "../assets/slapAttack2blue.png";
import dodging from "../assets/dodging.gif";
import dodging2 from "../assets/dodging2.gif";
import throwing from "../assets/throwing-nonmirror.png";
import throwing2 from "../assets/throwing2.png";
import hit from "../assets/hit.png";
import hit2 from "../assets/hit2.png";
import salt2 from "../assets/salt2.png";
import salt from "../assets/salt.png";
import bow from "../assets/bow.png";
import bow2 from "../assets/bow2.png";
import throwTech from "../assets/throw-tech.png";
import throwTech2 from "../assets/throw-tech2.png";

import attackSound from "../sounds/attack-sound.mp3";
import hitSound from "../sounds/hit-sound.mp3";
import dodgeSound from "../sounds/dodge-sound.mp3";
import throwSound from "../sounds/throw-sound.mp3";
import winnerSound from "../sounds/winner-sound.wav";
import hakkiyoiSound from "../sounds/hakkiyoi-sound.mp3";
import bellSound from "../sounds/bell-sound.mp3";
import saltSound from "../sounds/salt-sound.mp3";
import gameMusic from "../sounds/game-music.mp3";
import eeshiMusic from "../sounds/eeshi.mp3";

import UiPlayerInfo from "./UiPlayerInfo";
import SaltEffect from "./SaltEffect";
import MatchOver from "./MatchOver";

const playSound = (audioFile, volume = 1.0) => {
  const sound = new Audio(audioFile);
  sound.volume = volume;
  sound.play();
};

const getImageSrc = (
  fighter,
  isDiving,
  isJumping,
  isAttacking,
  isDodging,
  isStrafing,
  isCrouching,
  isReady,
  isHit,
  isDead,
  isSlapAttack,
  isThrowing,
  isGrabbing,
  isThrowingSalt,
  slapAnimation,
  isBowing,
  isThrowTeching
) => {
  if (fighter === "player 2") {
    if (isBowing) return bow;
    if (isThrowTeching) return throwTech;
    if (isJumping) return throwing;
    if (isAttacking && !isSlapAttack) return attack;
    if (isGrabbing) return grabbing;
    if (isDodging) return dodging;
    if (isCrouching) return crouching;
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
    if (isSlapAttack) {
      // Toggle between two slap attack animations based on slapAnimation value
      return slapAnimation === 1 ? slapAttack1Blue : slapAttack2Blue;
    }
    if (isGrabbing) return grabbing2;
    if (isDodging) return dodging2;
    if (isCrouching) return crouching2;
    if (isReady) return ready2;
    if (isStrafing && !isThrowing) return pumoWaddle2;
    if (isHit) return hit2;
    if (isDead) return pumo;
    if (isThrowing) return throwing2;
    if (isThrowingSalt) return salt2;
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
        "isCrouching",
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

        // ...any other prop names that should not be forwarded
      ].includes(prop),
  })
  .attrs((props) => ({
    src: getImageSrc(
      props.fighter,
      props.isDiving,
      props.isJumping,
      props.isAttacking,
      props.isDodging,
      props.isStrafing,
      props.isCrouching,
      props.isReady,
      props.isHit,
      props.isDead,
      props.isSlapAttack,
      props.isThrowing,
      props.isGrabbing,
      props.isThrowingSalt,
      props.slapAnimation,
      props.isBowing,
      props.isThrowTeching
    ),
    style: {
      position: "absolute",
      /* Convert x, y from 1280×720 to percentages of the container */
      left: `${(props.x / 1280) * 100}%`,
      bottom: `${(props.y / 720) * 100}%`,
      /* Flip horizontally if facing is -1; scaleX(1) is normal, scaleX(-1) is mirrored */
      transform: `scaleX(${props.facing})`,

      zIndex: props.isBeingThrown || !props.isDodging ? 99 : 98,
    },
  }))`
  position: absolute;
  width: 23%;
  height: auto;
  will-change: transform, bottom, left;
  pointer-events: none;
`;

const StyledLabel = styled.div
  .withConfig({
    shouldForwardProp: (prop) =>
      ![
        "fighter",
        "isJumping",
        "isDiving",
        "isAttacking",
        "isAttackCooldown",
        "isDodging",
        "isStrafing",
        "isCrouching",
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
        "throwFacingDirection",
        "throwingFacingDirection",
        "beingThrownFacingDirection",
        "isBeingThrown",
        "isSlapAttack",
        "isBowing",
        "isThrowTeching",
        // ...any other prop names that should not be forwarded
      ].includes(prop),
  })
  .attrs((props) => ({
    style: {
      position: "absolute",
      // The base vertical position is y + some offset
      // so it ends up above the player's head
      left: `${(props.x / 1280) * 100}%`,
      bottom: `${((props.y + 290) / 720) * 100}%`,
      transform: "translateX(265%)",
    },
  }))`
    position: absolute;
    font-size: clamp(.2rem, 2.5vw, 2rem); /* optional fluid sizing */
    font-family: "Bungee";
    pointer-events: none;
    color: ${(props) => props.color || "black"};
    text-shadow: -1px -1px 0 #000, 1px -1px 0 #000,
                 -1px 1px 0 #000, 1px 1px 0 #000;
  `;

const GameFighter = ({ player, index, roomName, localId }) => {
  const { socket } = useContext(SocketContext);
  const [penguin, setPenguin] = useState(player);
  const [stamina, setStamina] = useState(player);
  const [hakkiyoi, setHakkiyoi] = useState(false);
  const [gyojiState, setGyojiState] = useState("idle");
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState("");
  const [playerOneWinCount, setPlayerOneWinCount] = useState(0);
  const [playerTwoWinCount, setPlayerTwoWinCount] = useState(0);
  const [matchOver, setMatchOver] = useState(false);

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
        setPenguin(data.player1);
        setStamina(data.player1.stamina);
      } else if (index === 1) {
        setPenguin(data.player2);
        setStamina(data.player2.stamina);
      }
    });

    socket.on("game_start", (data) => {
      console.log(data);
      setHakkiyoi(true);

      const timer = setTimeout(() => {
        setHakkiyoi(false);
      }, 2000);

      setGyojiState("ready");
      return () => clearTimeout(timer);
    });

    socket.on("game_reset", (data) => {
      setGameOver(data);
      setGyojiState("idle");
      setMatchOver(false);
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
      socket.off("game_start");
      socket.off("game_reset");
      socket.off("game_over");
      socket.off("match_over");
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
    if (penguin.isThrowingSalt) {
      playSound(saltSound, 0.03);
      console.log("sound on");
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

  return (
    <div className="ui-container">
      <UiPlayerInfo
        playerOneWinCount={playerOneWinCount}
        playerTwoWinCount={playerTwoWinCount}
      />

      <Gyoji gyojiState={gyojiState} />
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
      <PlayerStaminaUi stamina={stamina} index={index} />
      <StyledLabel {...penguin}>P{index + 1}</StyledLabel>
      <PlayerShadow x={penguin.x} y={penguin.y} facing={penguin.facing} />
      <StyledImage {...penguin} />
      <SaltEffect
        isActive={penguin.isThrowingSalt}
        playerFacing={penguin.facing}
        playerX={penguin.x}
        playerY={penguin.y}
      />
      <ThrowTechEffect />
    </div>
  );
};

GameFighter.propTypes = {
  player: PropTypes.shape({
    id: PropTypes.string.isRequired,
    fighter: PropTypes.string.isRequired,
    color: PropTypes.string,
    isJumping: PropTypes.bool,
    isThrowing: PropTypes.bool,
    isThrowingSalt: PropTypes.bool,
    isGrabbing: PropTypes.bool,
    isBeingGrabbed: PropTypes.bool,
    isAttacking: PropTypes.bool,
    isAttackCooldown: PropTypes.bool,
    isSlapAttack: PropTypes.bool,
    isDodging: PropTypes.bool,
    isStrafing: PropTypes.bool,
    isDiving: PropTypes.bool,
    isCrouching: PropTypes.bool,
    isReady: PropTypes.bool,
    isHit: PropTypes.bool,
    isAlreadyHit: PropTypes.bool,
    isDead: PropTypes.bool,
    facing: PropTypes.number,
    stamina: PropTypes.number,
    dodgeEndTime: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
    knockbackVelocity: PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
    }),
    keys: PropTypes.shape({
      w: PropTypes.bool,
      a: PropTypes.bool,
      s: PropTypes.bool,
      d: PropTypes.bool,
      " ": PropTypes.bool,
      shift: PropTypes.bool,
      e: PropTypes.bool,
      f: PropTypes.bool,
    }),
  }),
  index: PropTypes.number.isRequired,
};

export default GameFighter;
