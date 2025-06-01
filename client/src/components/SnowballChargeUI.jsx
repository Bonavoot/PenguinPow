import PropTypes from "prop-types";
import "./SnowballChargeUI.css";
import { useEffect, useState } from "react";

const SnowballChargeUI = ({ snowballCooldown, lastSnowballTime, index }) => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const cooldownDuration = 5000; // 5 seconds
  
  // Update current time for live cooldown progress
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 50); // Update every 50ms for smooth animation
    
    return () => clearInterval(interval);
  }, []);
  
  const timeSinceLastSnowball = currentTime - lastSnowballTime;
  const isOnCooldown = snowballCooldown && timeSinceLastSnowball < cooldownDuration;
  const cooldownProgress = isOnCooldown 
    ? Math.min(timeSinceLastSnowball / cooldownDuration, 1)
    : 1;

  return (
    <div className={`snowball-container ${index === 0 ? "player1" : "player2"}`}>
      <div
        className={`snowball-icon ${isOnCooldown ? "cooldown" : "ready"}`}
        style={{
          "--cooldown-progress": cooldownProgress,
        }}
      >
        ❄️
      </div>
    </div>
  );
};

SnowballChargeUI.propTypes = {
  snowballCooldown: PropTypes.bool.isRequired,
  lastSnowballTime: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
};

export default SnowballChargeUI; 