import { useContext, useEffect, useState } from "react";
import daiba from "../assets/daibaStanding.gif";
//import daibaStrafing from "../assets/daibaStrafing.gif";
import daibaJumping from "../assets/daibaJumping.gif";
import daibaDiving from "../assets/daibaDiving.gif";
import dinkey from "../assets/standing.gif";
import dinkeyDiving from "../assets/dinkeyDiving.gif";
import dinkeyHit from "../assets/dinkeyHit.gif";
import daibaHit from "../assets/daibaHit.gif";
//import daibaAttacking from "../assets/daibaAttacking.gif";
//import dinkeyAttacking from "../assets/dinkeyAttacking.gif";
//import dinkeyStrafing from "../assets/dinkeyStrafing.gif";
import { SocketContext } from "../SocketContext";
import styled from "styled-components";
import PlayerHealthUi from "./PlayerHealthUi";

const getImageSrc = (
  fighter,
  isDiving,
  isJumping,
  isAttacking,
  isStrafing,
  isHit
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
    ].includes(prop),
}).attrs((props) => ({
  src: getImageSrc(
    props.fighter,
    props.isDiving,
    props.isJumping,
    props.isAttacking,
    props.isStrafing,
    props.isHit
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
  bottom: ${(props) => props.y + 135}px; // Adjust based on the image height
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
  }, []);

  return (
    <>
      <PlayerHealthUi health={health} index={index} />
      <StyledLabel {...penguin}>P{index + 1}</StyledLabel>
      <StyledImage {...penguin} />
    </>
  );
};

export default GameFighter;

// <img className={`game-player${index + 1}`} src={penguin.fighter === "daiba" ? daiba : dinkey} alt="fighter" />
