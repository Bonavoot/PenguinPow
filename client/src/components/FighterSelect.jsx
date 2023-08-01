import { useContext } from "react";
import lilDinkey from "../assets/lil-dinkey-avatar.png";
import daiba from "../assets/daiba-avatar.png";
import { SocketContext } from "../SocketContext";

const FighterSelect = () => {
  const socket = useContext(SocketContext);

  const handleSelect = (e) => {
    socket.emit("fighter-select", {
      fighter: e.target.className,
      player: socket.id,
    });

    console.log("emitted");
  };

  return (
    <div className="fighter-select">
      <button onClick={handleSelect}>
        <img
          style={{ height: "110px", width: "110px" }}
          className="lil-dinkey"
          src={lilDinkey}
          alt="lil-dinkey"
        />
      </button>
      <button onClick={handleSelect}>
        <img
          className="daiba"
          style={{ height: "110px", width: "110px" }}
          src={daiba}
          alt="Daiba"
        />
      </button>
    </div>
  );
};

export default FighterSelect;
