import { useEffect, useState } from "react";
import daiba from "../assets/standingDaiba.gif";
import dinkey from "../assets/standing.gif";

const GameFighter = ({ fighter, index }) => {
  const [penguin, setPenguin] = useState("../assets/standing.gif");

  useEffect(() => {
    if (fighter === "daiba") {
      setPenguin(daiba);
    } else {
      setPenguin(dinkey);
    }
  }, []);

  return <img className={`player${index + 1}`} src={penguin} alt="fighter" />;
};

export default GameFighter;
