import { useContext, useEffect, useState } from "react";
import daiba from "../assets/standingDaiba.gif";
import dinkey from "../assets/standing.gif";
import { SocketContext } from "../SocketContext";
import styled from "styled-components";

const StyledImage = styled.img.attrs((props) => ({
  src: props.fighter === "lil-dinkey" ? dinkey : daiba,
}))`
  position: absolute;
  left: ${(props) => props.x}px;
  bottom: ${(props) => props.y}px;
  transform: scaleX(${(props) => props.facing});
  transition: left 0.35s ease-out;
  height: 250px;
`;

const GameFighter = ({ fighter, index, player }) => {
  const { socket } = useContext(SocketContext);
  const [penguin, setPenguin] = useState(player);
  console.log(player);

  useEffect(() => {
    socket.on("fighter_action", (data) => {
      if (data.id === player.id) {
        setPenguin(data);
      }
    });
  }, []);

  return <StyledImage {...penguin} />;
};

export default GameFighter;

// <img className={`game-player${index + 1}`} src={penguin.fighter === "daiba" ? daiba : dinkey} alt="fighter" />
