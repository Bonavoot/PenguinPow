import { useContext, useEffect, useState, useRef } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled from "styled-components";
import PlayerStaminaUi from "./PlayerStaminaUi";
import pumo from "../assets/pumo.png";
import pumo2 from "../assets/pumo2.png";
import pumoWaddle from "../assets/pumo-waddle.gif";
import pumoWaddle2 from "../assets/pumo-waddle2.gif";
import crouching from "../assets/crouching.png";
import crouching2 from "../assets/crouching2.png";
import grabbing from "../assets/grabbing.png"; // You'll need to create this asset
import grabbing2 from "../assets/grabbing2.png";

import grabSound from "../sounds/grab-sound.mp3"; // You'll need to create this sound

//import daibaHit from "../assets/daibaHit.gif";
import ready from "../assets/ready.png";
import ready2 from "../assets/ready2.png";
import attack from "../assets/attack.png";
import attack2 from "../assets/attack2.png";
import dodging from "../assets/dodging.gif";
import dodging2 from "../assets/dodging2.gif";
import throwing from "../assets/throwing-nonmirror.png";
import throwing2 from "../assets/throwing2.png";
import hit from "../assets/hit.png";
import attackSound from "../sounds/attack-sound.mp3";
import hitSound from "../sounds/hit-sound.mp3";
import dodgeSound from "../sounds/dodge-sound.mp3";
import throwSound from "../sounds/throw-sound.mp3";
import winnerSound from "../sounds/winner-sound.mp3";
import hakkiyoiSound from "../sounds/hakkiyoi-sound.mp3";
import bellSound from "../sounds/bell-sound.mp3";
import UiPlayerInfo from "./UiPlayerInfo";

//import gameMusic from "../sounds/game-music.mp3";

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
  isGrabbing
) => {
  if (fighter === "player 2") {
    if (isDiving) return pumo;

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
    return pumo;
  } else if (fighter === "player 1") {
    if (isDiving) return pumo;

    if (isJumping) return throwing2;
    if (isAttacking && !isSlapAttack) return attack2;
    if (isGrabbing) return grabbing2;
    if (isDodging) return dodging2;
    if (isCrouching) return crouching2;
    if (isReady) return ready2;
    if (isStrafing && !isThrowing) return pumoWaddle2;
    if (isHit) return hit;
    if (isDead) return pumo;
    if (isThrowing) return throwing2;
    return pumo2;
  }
};

const validProps = [
  // Add any valid HTML attributes that you want to allow
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
      props.isGrabbing
    ),
    style: {
      position: "absolute",
      left: `${props.x}px`,
      bottom: `${props.y}px`,
      transform: `scaleX(${props.facing})`,
    },
  }))`
  position: absolute;
  height: 300px;
  will-change: transform, bottom, left; // optimize for animations
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
        // ...any other prop names that should not be forwarded
      ].includes(prop),
  })
  .attrs((props) => ({
    style: {
      bottom: `${props.y + 295}px`, // Adjust based on the image height
      left: `${props.facing === -1 ? props.x + 120 : props.x + 125}px`, // Adjust based on the label position
      color: props.color || "black",
    },
  }))`
  position: absolute;
  font-size: 2.5rem;
  font-family: "Bungee";
  pointer-events: none;
`;

const winnerAudio = new Audio(winnerSound);

const GameFighter = ({ player, index }) => {
  const { socket } = useContext(SocketContext);
  const [penguin, setPenguin] = useState(player);
  const [stamina, setStamina] = useState(player);
  const [hakkiyoi, setHakkiyoi] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState("");
  const [playerOneWinCount, setPlayerOneWinCount] = useState(0);
  const [playerTwoWinCount, setPlayerTwoWinCount] = useState(0);

  const lastAttackState = useRef(player.isAttacking);
  const lastHitState = useRef(player.isHit);
  const lastThrowState = useRef(player.isThrowing);
  const lastDodgeState = useRef(player.isDodging);
  const lastWinnerState = useRef(gameOver);
  const lastGrabState = useRef(player.isGrabbing);

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

      return () => clearTimeout(timer);
    });

    socket.on("game_reset", (data) => {
      setGameOver(data);
    });

    socket.on("game_over", (data) => {
      setGameOver(data.isGameOver);
      setWinner(data.winner);
      if (data.winner === "player 1") {
        setPlayerOneWinCount(data.wins);
      } else {
        setPlayerTwoWinCount(data.wins);
      }
    });

    return () => {
      socket.off("fighter_action");
      socket.off("game_start");
      socket.off("game_reset");
      socket.off("game_over");
    };
  }, [index, socket]);

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
    if (gameOver && !lastWinnerState.current) {
      winnerAudio.volume = 0.01;
      winnerAudio.play();
    }
    lastWinnerState.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    if (hakkiyoi) {
      playSound(hakkiyoiSound, 0.015);
      playSound(bellSound, 0.005);
    }
  }, [hakkiyoi]);

  return (
    <div className="ui-container">
      <UiPlayerInfo
        playerOneWinCount={playerOneWinCount}
        playerTwoWinCount={playerTwoWinCount}
      />
      {hakkiyoi && <div className="hakkiyoi">HAKKI-YOI !</div>}
      {gameOver && (
        <div
          className="hakkiyoi"
          style={{ color: `${winner === "player 1" ? "aqua" : "salmon"}` }}
        >
          {winner} wins !
        </div>
      )}

      <PlayerStaminaUi stamina={stamina} index={index} />
      <StyledLabel {...penguin}>P{index + 1}</StyledLabel>
      <StyledImage {...penguin} />

      <div className="scoreboard">
        <div className="player1-win-count">{playerOneWinCount}</div>
        <div className="dash">-</div>
        <div className="player2-win-count">{playerTwoWinCount}</div>
      </div>
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
      // Shape added to specify object structure
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
    }),
  }),
  index: PropTypes.number.isRequired,
};

export default GameFighter;
