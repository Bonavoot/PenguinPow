import { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import "./PowerMeter.css";

const PowerMeter = ({
  isCharging,
  chargePower,
  x,
  y,
  facing,
  playerId,
  localId,
  activePowerUp,
}) => {
  const [smoothPower, setSmoothPower] = useState(0);
  const animationFrameRef = useRef();
  const lastPowerRef = useRef(0);
  const lastChargePowerRef = useRef(0);

  useEffect(() => {
    if (isCharging && playerId === localId) {
      const animate = () => {
        const targetPower = chargePower || 0;

        // If charge power changed significantly, update immediately
        if (Math.abs(targetPower - lastChargePowerRef.current) > 5) {
          setSmoothPower(targetPower);
          lastPowerRef.current = targetPower;
          lastChargePowerRef.current = targetPower;
        } else {
          // Otherwise, smooth the transition
          const currentPower = lastPowerRef.current;
          const newPower = currentPower + (targetPower - currentPower) * 0.3;
          setSmoothPower(newPower);
          lastPowerRef.current = newPower;
        }

        if (isCharging && playerId === localId) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Initialize with current charge power
      lastChargePowerRef.current = chargePower || 0;
      lastPowerRef.current = chargePower || 0;
      setSmoothPower(chargePower || 0);

      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Reset when charging stops
      setSmoothPower(0);
      lastPowerRef.current = 0;
      lastChargePowerRef.current = 0;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCharging, chargePower, playerId, localId]);

  if (!isCharging || playerId !== localId || smoothPower < 5) return null;

  const getColor = () => {
    if (smoothPower < 33) return "#00ff00"; // Green
    if (smoothPower < 66) return "#ffff00"; // Yellow
    return "#ff0000"; // Red
  };

  const meterStyle = {
    left: `${(x / 1280) * 100}%`,
    bottom: `${((y + (activePowerUp === "size" ? 270 : 235)) / 720) * 100}%`,
    transform: `translateX(${
      facing === 1
        ? activePowerUp === "size"
          ? "85%"
          : "65%"
        : activePowerUp === "size"
        ? "75%"
        : "55%"
    }) scale(${activePowerUp === "size" ? 1.1 : 1})`,
  };

  const fillStyle = {
    width: `${smoothPower}%`,
    backgroundColor: getColor(),
    transition: "width 0.05s ease-out, background-color 0.15s ease-out",
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

PowerMeter.propTypes = {
  isCharging: PropTypes.bool.isRequired,
  chargePower: PropTypes.number.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  playerId: PropTypes.string.isRequired,
  localId: PropTypes.string.isRequired,
  activePowerUp: PropTypes.string,
};

export default PowerMeter;
