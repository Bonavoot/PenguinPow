import { useContext } from "react";
import dinkey from "../assets/lil-dinkey-avatar.png";
import daiba from "../assets/daiba-avatar.png";
import { SocketContext } from "../SocketContext";

const FighterSelect = () => {
  const { socket } = useContext(SocketContext);

  const handleSelect = (e) => {
    socket.emit("fighter-select", {
      fighter: e.target.className,
      player: socket.id,
    });
  };

  return (
    <div className="fighter-select">
      <img
        style={{ height: "100px", width: "100px" }}
        onClick={handleSelect}
        className="dinkey"
        src={dinkey}
        alt="dinkey"
      />
      <p className="dinkey-name">DINKEY</p>
      <img
        className="daiba"
        onClick={handleSelect}
        style={{ height: "100px", width: "100px" }}
        src={daiba}
        alt="Daiba"
      />

      <p className="daiba-name">DAIBA</p>
    </div>
  );
};

export default FighterSelect;
