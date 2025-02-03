import { useEffect, useState, useContext } from "react";
import { SocketContext } from "../SocketContext";
import "./SlapParryEffect.css";

const SlapParryEffect = () => {
  const [showEffect, setShowEffect] = useState(false);
  const { socket } = useContext(SocketContext);

  useEffect(() => {
    const handleSlap = () => {
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 300); // Match this with your parry duration
    };

    // Listen for the slap parry event
    socket.on("slap_parry", handleSlap);

    return () => {
      socket.off("slap_parry", handleSlap);
    };
  }, []);

  if (!showEffect) return null;

  return (
    <div className="slap-parry-effect">
      <div className="slap-parry-ring"></div>
    </div>
  );
};

export default SlapParryEffect;
