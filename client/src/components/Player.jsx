import { useEffect, useState } from "react";
import standing from "../assets/standing.gif";
import Fighter from "./Fighter";

const Player = ({ player, index }) => {
  const [fighter, setFighter] = useState(standing);

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
