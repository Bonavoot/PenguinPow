import { useState, useEffect } from "react";
import gyoji from "../assets/gyoji.png";
import gyojiReady from "../assets/gyoji-ready.png";
import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";
import { getActiveGyojiSprites } from "../utils/GyojiRecolorizer";
import GyojiShadow from "./GyojiShadow";
import PropTypes from "prop-types";

const BASE_SOURCES = {
  idle: gyoji,
  ready: gyojiReady,
  player1Win: gyojiPlayer1wins,
  player2Win: gyojiPlayer2wins,
};

const Gyoji = ({ gyojiState, hakkiyoi }) => {
  let sourceKey = "idle";
  if (hakkiyoi || gyojiState === "ready") {
    sourceKey = "ready";
  } else if (gyojiState === "player1Win") {
    sourceKey = "player1Win";
  } else if (gyojiState === "player2Win") {
    sourceKey = "player2Win";
  }

  const recoloredSources = getActiveGyojiSprites();
  const preferredSrc =
    recoloredSources?.[sourceKey] || BASE_SOURCES[sourceKey];

  const [imgSrc, setImgSrc] = useState(preferredSrc);

  useEffect(() => {
    setImgSrc(preferredSrc);
  }, [preferredSrc]);

  const shouldBreathe = gyojiState === "idle" && !hakkiyoi;

  return (
    <>
      <GyojiShadow gyojiState={gyojiState} />
      <img
        src={imgSrc}
        alt="gyoji"
        className={`gyoji${shouldBreathe ? " gyoji-breathing" : ""}`}
        onError={() => {
          if (imgSrc !== BASE_SOURCES[sourceKey]) {
            setImgSrc(BASE_SOURCES[sourceKey]);
          }
        }}
      />
    </>
  );
};

Gyoji.propTypes = {
  gyojiState: PropTypes.string.isRequired,
  hakkiyoi: PropTypes.bool.isRequired,
};

export default Gyoji;
