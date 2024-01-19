import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled from "styled-components";
import PlayerStaminaUi from "./PlayerStaminaUi";
import pumo from "../assets/pumo.png";
import pumoWaddle from "../assets/pumo-waddle.gif";

import daiba from "../assets/daibaStanding.gif";
// import daibaJumping from "../assets/daibaJumping.gif";
// import daibaDiving from "../assets/daibaDiving.png";
// import dinkey from "../assets/pumo.png";
// import dinkeyDiving from "../assets/pumo.png";
// import dinkeyHit from "../assets/pumo.png";
// import daibaHit from "../assets/daibaHit.gif";
// import daibaDeath from "../assets/daibaDeath.png";

const getImageSrc = (
  fighter,
  isDiving,
  isJumping,
  isAttacking,
  isStrafing,
  isCrouching,
  isHit,
  isDead
) => {
  if (fighter === "pumo") {
    if (isDiving) return pumo;
    if (isJumping) return pumo;
    if (isAttacking) return pumo;
    if (isCrouching) return daiba;
    if (isStrafing) return pumoWaddle;
    if (isHit) return pumo;
    if (isDead) return pumo;
    return pumo;
  }
};

const StyledImage = styled("img", {
  shouldForwardProp: (prop) =>
    isPropValid(prop) &&
    ![
      "fighter",
      "isJumping",
      "isDiving",
      "isAttacking",
      "isStrafing",
      "isCrouching",
      "isHit",
      "isDead",
    ].includes(prop),
}).attrs((props) => ({
  src: getImageSrc(
    props.fighter,
    props.isDiving,
    props.isJumping,
    props.isAttacking,
    props.isStrafing,
    props.isCrouching,
    props.isHit,
    props.isDead
  ),
}))`
  position: absolute;
  left: ${(props) => props.x}px;
  bottom: ${(props) => props.y}px;
  transform: scaleX(${(props) => props.facing});
  height: 235px;
`;

const StyledLabel = styled.div`
  position: absolute;
  font-size: 2rem;
  bottom: ${(props) => props.y + 230}px; // Adjust based on the image height
  left: ${(props) =>
    props.facing === -1
      ? props.x + 100
      : props.x + 100}px; // Adjust based on the label position
  color: ${(props) => props.color || "black"};
  font-family: "Bungee";
`;

const GameFighter = ({ player, index }) => {
  const { socket } = useContext(SocketContext);
  const [penguin, setPenguin] = useState(player);
  const [stamina, setStamina] = useState(player);
  const [hakkiyoi, setHakkiyoi] = useState(false);

  useEffect(() => {
    socket.on("fighter_action", (data) => {
      if (index === 0) {
        setPenguin(data.player1);
        setStamina(data.player1.stamina);
      } else if (index === 1) {
        setPenguin(data.player2);
        setStamina(data.player2.stamina);
      } //else if (index === 2) {
      //   setPenguin(data.player3);
      //   setHealth(data.player3.health);
      // }
    });

    socket.on("game_start", (data) => {
      console.log(data);
      setHakkiyoi(true);

      const timer = setTimeout(() => {
        setHakkiyoi(false);
      }, 2000);

      return () => clearTimeout(timer);
    });

    return () => {
      socket.off("fighter_action");
      socket.off("game_start");
    };
  }, [index, socket]);

  useEffect(() => {});

  return (
    <div className="ui-container">
      {hakkiyoi && <div className="hakkiyoi">HAKKI-YOI !</div>}
      <PlayerStaminaUi stamina={stamina} index={index} />
      <StyledLabel {...penguin}>P{index + 1}</StyledLabel>
      <StyledImage {...penguin} />
    </div>
  );
};

GameFighter.propTypes = {
  player: PropTypes.shape({
    id: PropTypes.string.isRequired,
    fighter: PropTypes.string.isRequired,
    color: PropTypes.string,
    isJumping: PropTypes.bool,
    isAttacking: PropTypes.bool,
    isStrafing: PropTypes.bool,
    isDiving: PropTypes.bool,
    isCrouching: PropTypes.bool,
    isHit: PropTypes.bool,
    isDead: PropTypes.bool,
    facing: PropTypes.number,
    stamina: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  index: PropTypes.number.isRequired,
};

export default GameFighter;

// <img className={`game-player${index + 1}`} src={penguin.fighter === "daiba" ? daiba : dinkey} alt="fighter" />
