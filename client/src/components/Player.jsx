import Fighter from "./Fighter";
import { useState, useEffect } from "react";
import standing from "../assets/pumo.png";
import standingDaiba from "../assets/daibaStanding.gif";

const Player = ({ index, fighter }) => {
  const [penguin, setPenguin] = useState(standing);

  useEffect(() => {
    if (fighter === "dinkey") {
      setPenguin(standing);
    } else if (fighter === "daiba") {
      setPenguin(standingDaiba);
    }
  }, [fighter]);

  return (
    <div className="player-lobby">
      <h1 className={`player-side player${index}`}>PLAYER {index + 1}</h1>
      <div>
        <Fighter
          index={index}
          fighterImgSrc={penguin}
          fighterName={fighter.toUpperCase()}
        />
      </div>
    </div>
  );
};

export default Player;
