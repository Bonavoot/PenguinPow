import Fighter from "./Fighter";
import { useState, useEffect } from "react";
import pumo from "../assets/pumo.png";

const Player = ({ index, fighter }) => {
  const [penguin, setPenguin] = useState(pumo);

  useEffect(() => {
    if (fighter === "dinkey") {
      setPenguin(pumo);
    } else if (fighter === "daiba") {
      setPenguin(pumo);
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
