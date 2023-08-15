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
  transition: left 0.15s ease-out;
  height: 185px;
`;

const GameFighter = ({ player, index }) => {
  const { socket } = useContext(SocketContext);
  const [penguin, setPenguin] = useState(player);

  useEffect(() => {
    socket.on("fighter_action", (data) => {
      if (index === 0) {
        setPenguin(data.player1);
      } else if (index === 1) {
        setPenguin(data.player2);
      } else if (index === 2) {
        setPenguin(data.player3);
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
