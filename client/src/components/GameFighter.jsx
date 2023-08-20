import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import styled from "styled-components";
import PlayerHealthUi from "./PlayerHealthUi";

import daiba from "../assets/daibaStanding.gif";
import daibaJumping from "../assets/daibaJumping.gif";
import daibaDiving from "../assets/daibaDiving.png";
import dinkey from "../assets/standing.gif";
import dinkeyDiving from "../assets/dinkeyDiving.gif";
import dinkeyHit from "../assets/dinkeyHit.gif";
import daibaHit from "../assets/daibaHit.gif";
import daibaDeath from "../assets/daibaDeath.png";

const getImageSrc = (
  fighter,
  isDiving,
  isJumping,
  isAttacking,
  isStrafing,
  isHit,
  isDead
) => {
  if (fighter === "dinkey") {
    if (isDiving) return dinkeyDiving;
    if (isJumping) return dinkey;
    if (isAttacking) return dinkey;
    if (isStrafing) return dinkey;
    if (isHit) return dinkeyHit;

    return dinkey;
  } else {
    if (isDiving) return daibaDiving;
    if (isJumping) return daibaJumping;
    if (isAttacking) return daiba;
    if (isStrafing) return daiba;
    if (isHit) return daibaHit;
    if (isDead) return daibaDeath;
    return daiba;
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
    props.isHit,
    props.isDead
  ),
}))`
  position: absolute;
  left: ${(props) => props.x}px;
  bottom: ${(props) => props.y}px;
  transform: scaleX(${(props) => props.facing});
  height: 185px;
`;

const StyledLabel = styled.div`
  position: absolute;
  font-size: 2rem;
  bottom: ${(props) => props.y + 170}px; // Adjust based on the image height
  left: ${(props) =>
    props.facing === -1
      ? props.x + 45
      : props.x + 65}px; // Adjust based on the label position
  color: ${(props) => props.color || "black"};
  font-family: "Bungee";
`;

const GameFighter = ({ player, index }) => {
  const { socket } = useContext(SocketContext);
  const [penguin, setPenguin] = useState(player);
  const [health, setHealth] = useState(player);

  useEffect(() => {
    socket.on("fighter_action", (data) => {
      if (index === 0) {
        setPenguin(data.player1);
        setHealth(data.player1.health);
      } else if (index === 1) {
        setPenguin(data.player2);
        setHealth(data.player2.health);
      } else if (index === 2) {
        setPenguin(data.player3);
        setHealth(data.player3.health);
      }
    });

    return () => {
      socket.off("fighter_action");
    };
  }, [index, socket]);

  return (
    <>
      <PlayerHealthUi health={health} index={index} />
      <StyledLabel {...penguin}>P{index + 1}</StyledLabel>
      <StyledImage {...penguin} />
    </>
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
    isHit: PropTypes.bool,
    isDead: PropTypes.bool,
    facing: PropTypes.number,
    health: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  index: PropTypes.number.isRequired,
};

export default GameFighter;

// <img className={`game-player${index + 1}`} src={penguin.fighter === "daiba" ? daiba : dinkey} alt="fighter" />
