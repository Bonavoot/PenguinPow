import { useState } from "react";
import io from "socket.io-client";
import "./MainMenu.css";
const socket = io.connect("http://localhost:3001");

const MainMenu = ({ socketId }) => {
  const [matchmaking, setMatchmaking] = useState(false);
  const handleQuickplay = () => {
    socket.emit("quickplay", socketId);
    setMatchmaking(true);
  };

  return (
    <>
      <button onClick={handleQuickplay}>QUICK PLAY</button>
      {matchmaking ? (
        <div className="matchmaking">Seeking opponent...</div>
      ) : null}
    </>
  );
};

export default MainMenu;
