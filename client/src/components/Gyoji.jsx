import gyoji from "../assets/gyoji.png";
import gyojiReady from "../assets/gyoji-ready.png";
import GyojiShadow from "./GyojiShadow";
import gyojiPlayer1wins from "../assets/gyoji-player1-wins.png";
import gyojiPlayer2wins from "../assets/gyoji-player2-wins.png";

const Gyoji = ({ gyojiState }) => {
  let imgSrc = gyoji;

  if (gyojiState === "ready") {
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

export default Gyoji;
