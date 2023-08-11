import { useContext, useEffect, useState } from "react";
import daiba from "../assets/standingDaiba.gif";
import dinkey from "../assets/standing.gif";
import daibaAttacking from "../assets/daibaAttacking.gif";
import dinkeyAttacking from "../assets/dinkeyAttacking.gif";
import { SocketContext } from "../SocketContext";
import styled from "styled-components";

const getImageSrc = (fighter, isDiving, isJumping, isAttacking, isStrafing) => {
  if (fighter === "lil-dinkey") {
    if (isDiving) return dinkey;
    if (isJumping) return dinkey;
    if (isAttacking) return dinkeyAttacking;
    if (isStrafing) return dinkey;

    return dinkey;
  } else {
    if (isDiving) return daiba;
    if (isJumping) return daiba;
    if (isAttacking) return daibaAttacking;
    if (isStrafing) return daiba;
    return daiba;
  }
};

const StyledImage = styled("img", {
  shouldForwardProp: (prop) =>
    isPropValid(prop) &&
    !["fighter", "isJumping", "isDiving", "isAttacking", "isStrafing"].includes(
      prop
    ),
}).attrs((props) => ({
  src: getImageSrc(
    props.fighter,
    props.isDiving,
    props.isJumping,
    props.isAttacking,
    props.isStrafing
  ),
}))`
  position: absolute;
  left: ${(props) => props.x}px;
  bottom: ${(props) => props.y}px;
  transform: scaleX(${(props) => props.facing});
  transition: left 0.15s ease-out;
  height: 185px;
`;

const GameFighter = ({ player, index }) => {
  const { socket } = useContext(SocketContext);
  const [penguin, setPenguin] = useState(player);

  useEffect(() => {
    socket.on("fighter_action", (data) => {
      if (index < 1) {
        setPenguin(data.player1);
      } else {
        setPenguin(data.player2);
      }
    });

    return () => {
      socket.off("fighter_action");
    };
  }, []);

  return <StyledImage {...penguin} />;
};

export default GameFighter;

// <img className={`game-player${index + 1}`} src={penguin.fighter === "daiba" ? daiba : dinkey} alt="fighter" />
