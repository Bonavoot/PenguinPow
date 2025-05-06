import gyoji from "../assets/gyoji.png";
import gyojiReady from "../assets/gyoji-ready.png";
import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";
import gyojiHakkiyoi from "../assets/gyoji-hakkiyoi.gif";
import GyojiShadow from "./GyojiShadow";
import PropTypes from "prop-types";
import { useState, useEffect } from "react";

const Gyoji = ({ gyojiState, hakkiyoi }) => {
  const [showHakkiyoiAnimation, setShowHakkiyoiAnimation] = useState(false);

  useEffect(() => {
    if (hakkiyoi) {
      setShowHakkiyoiAnimation(true);
      const timer = setTimeout(() => {
        setShowHakkiyoiAnimation(false);
      }, 1000); // Animation lasts 1 second
      return () => clearTimeout(timer);
    }
  }, [hakkiyoi]);

  let imgSrc = gyoji;

  if (showHakkiyoiAnimation) {
    imgSrc = gyojiHakkiyoi;
  } else if (gyojiState === "ready") {
    imgSrc = gyojiReady;
  } else if (gyojiState === "player1Win") {
    imgSrc = gyojiPlayer1wins;
  } else if (gyojiState === "player2Win") {
    imgSrc = gyojiPlayer2wins;
  }

  return (
    <>
      <GyojiShadow gyojiState={gyojiState} />
      <img src={imgSrc} alt="gyoji" className="gyoji"></img>
    </>
  );
};

Gyoji.propTypes = {
  gyojiState: PropTypes.string.isRequired,
  hakkiyoi: PropTypes.bool.isRequired,
};

export default Gyoji;
