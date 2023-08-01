import { useContext } from "react";
import standing from "../assets/standing.gif";
import standingDaiba from "../assets/standingDaiba.gif";
import { SocketContext } from "../SocketContext";

const FighterSelect = () => {
  const socket = useContext(SocketContext);

  const handleSelect = (e) => {
    socket.emit("fighter-select", {
      fighter: e.target.className,
      socketId: socket.id,
    });

    console.log("emitted");
  };

  return (
    <div className="fighter-select">
      <h1 className="select-penguin-txt">SELECT PENGUIN</h1>
      <button onClick={handleSelect}>
        <img
          style={{ height: "150px" }}
          className="lil-dinkey"
          src={standing}
          alt="lil-dinkey"
        />
      </button>
      <button onClick={handleSelect}>
        <img
          className="daiba"
          style={{ height: "135px" }}
          src={standingDaiba}
          alt="Daiba"
        />
      </button>
    </div>
  );
};

export default FighterSelect;
