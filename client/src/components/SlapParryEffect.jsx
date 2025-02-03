import { useEffect, useState } from "react";
import "./SlapParryEffect.css";

const SlapParryEffect = ({ position }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (position) {
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 300);
    }
  }, [position]);

  if (!showEffect || !position) return null;

  // Convert game coordinates to percentage of container
  const left = `${(position.x / 1280) * 100}%`;
  const bottom = `${(position.y / 720) * 100}%`;

  return (
    <div
      className="slap-parry-effect"
      style={{
        position: "absolute",
        left,
        bottom,
        transform: "translate(-50%, -50%)",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <div className="slap-parry-ring"></div>
    </div>
  );
};

export default SlapParryEffect;
