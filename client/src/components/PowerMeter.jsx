import { useEffect, useState, useRef } from "react";
import "./PowerMeter.css";

const PowerMeter = ({ isCharging, x, y, facing, playerId, localId }) => {
  const [smoothPower, setSmoothPower] = useState(0);
  const animationFrameRef = useRef();
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (isCharging && playerId === localId) {
      // Set start time if charging just began
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        // Calculate power based on elapsed time directly
        const currentPower = Math.min((elapsed / 1500) * 100, 100);

        setSmoothPower(currentPower);
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Reset when charging stops
      startTimeRef.current = null;
      setSmoothPower(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCharging, playerId, localId]);

  //|| smoothPower < 25
  if (!isCharging || playerId !== localId || smoothPower < 10) return null;

  const getColor = () => {
    if (smoothPower < 33) return "#00ff00"; // Green
    if (smoothPower < 66) return "#ffff00"; // Yellow
    return "#ff0000"; // Red
  };

  const meterStyle = {
    left: `${(x / 1280) * 100}%`,
    bottom: `${((y + 275) / 720) * 100}%`,
    transform: `translateX(${facing === 1 ? "80%" : "52%"})`,
  };

  const fillStyle = {
    width: `${smoothPower}%`,
    backgroundColor: getColor(),
  };

  return (
    <div className="power-meter" style={meterStyle}>
      <div className="power-meter-bar">
        <div className="power-meter-fill" style={fillStyle} />
      </div>
      {/* <div className="power-meter-text">{Math.round(smoothPower)}%</div> */}
    </div>
  );
};

export default PowerMeter;
