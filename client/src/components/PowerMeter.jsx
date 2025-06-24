import { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import "./PowerMeter.css";

const PowerMeterContainer = styled.div.attrs((props) => {
  // Check if we're on Steam Deck resolution
  const isSteamDeck = typeof window !== 'undefined' && window.innerWidth === 1280 && window.innerHeight === 800;
  
  return {
    style: {
      position: "absolute",
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${((props.$y + 235) / 720) * 100}%`,
      // Use hardware-accelerated transform for positioning and facing offset
      transform: isSteamDeck 
        ? `translate3d(${props.$facing === 1 ? "65%" : "55%"}, 0, 0) scale(0.9)` // Slightly smaller on Steam Deck
        : `translate3d(${props.$facing === 1 ? "65%" : "55%"}, 0, 0)`,
      width: isSteamDeck ? "clamp(50px, 7vw, 120px)" : "clamp(60px, 8vw, 140px)",
      pointerEvents: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: isSteamDeck ? "clamp(1px, 0.2vw, 3px)" : "clamp(2px, 0.3vw, 4px)",
      zIndex: 999,
      filter: isSteamDeck ? "drop-shadow(0 0 6px rgba(0, 0, 0, 0.3))" : "drop-shadow(0 0 8px rgba(0, 0, 0, 0.4))",
      willChange: "transform",
      transformStyle: "preserve-3d",
      backfaceVisibility: "hidden",
    },
  };
})`
  /* All styles moved to attrs for performance */
`;

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

  const fillStyle = {
    width: `${smoothPower}%`,
    backgroundColor: getColor(),
    transition: "width 0.05s ease-out, background-color 0.15s ease-out",
  };

  return (
    <PowerMeterContainer 
      $x={x} 
      $y={y} 
      $facing={facing}
      className="power-meter"
    >
      <div className="power-meter-bar">
        <div className="power-meter-fill" style={fillStyle} />
      </div>
      {/* <div className="power-meter-text">{Math.round(smoothPower)}%</div> */}
    </PowerMeterContainer>
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
