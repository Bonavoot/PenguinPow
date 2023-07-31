import Fighter from "./Fighter";
import { useContext, useState, useEffect } from "react";
import { SocketContext } from "../SocketContext";
import standing from "../assets/standing.gif";
import standingDaiba from "../assets/standingDaiba.gif";

const Player = ({ index }) => {
  const socket = useContext(SocketContext);

  const [fighter, setFighter] = useState(standing);

  useEffect(() => {
    socket.on("fighter-select", (selectedFighter) => {
      console.log(selectedFighter.fighter);
      if (selectedFighter === "lil-dinkey") {
        setFighter(standing);
      } else if (selectedFighter === "daiba") {
        setFighter(standingDaiba);
      }
    });
  }, [fighter]);

  return (
    <div className="player-lobby">
      <h1 className="player-side">PLAYER {index + 1}</h1>
      <div>
        <Fighter index={index} fighter={fighter} />
      </div>
    </div>
  );
};

export default Player;
