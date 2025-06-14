import PropTypes from "prop-types";
import "./PowerUpUI.css";
import snowballImage from "../assets/snowball.png";
import powerWaterIcon from "../assets/power-water.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";

const PowerUpUI = ({
  activePowerUp,
  snowballCooldown,
  pumoArmyCooldown,
  index,
}) => {
  // Don't render anything if no power-up is active
  if (!activePowerUp) return null;

  const getPowerUpInfo = (powerUpType) => {
    switch (powerUpType) {
      case "speed":
        return {
          icon: happyFeetIcon,
          isImage: true,
          name: "Happy Feet",
          colors: {
            ready:
              "linear-gradient(135deg, #00d2ff 0%, #3a7bd5 30%, #0066cc 100%)",
            border: "#0066cc",
          },
        };
      case "power":
        return {
          icon: powerWaterIcon,
          isImage: true,
          name: "Power Water",
          colors: {
            ready:
              "linear-gradient(135deg, #ff6b6b 0%, #ee5a52 30%, #dc2626 100%)",
            border: "#dc2626",
          },
        };
      case "snowball":
        return {
          icon: snowballImage,
          isImage: true,
          name: "Snowball",
          colors: {
            ready:
              "linear-gradient(135deg, #e0f6ff 0%, #87ceeb 30%, #4682b4 100%)",
            border: "#1e3a8a",
          },
        };
      case "pumo_army":
        return {
          icon: pumoArmyIcon,
          isImage: true,
          name: "Pumo Army",
          colors: {
            ready:
              "linear-gradient(135deg, #fff4e6 0%, #ffcc80 30%, #ff8c00 100%)",
            border: "#cc6600",
          },
        };
      case "thick_blubber":
        return {
          icon: "🛡️",
          isImage: false,
          name: "Thick Blubber",
          colors: {
            ready:
              "linear-gradient(135deg, #9c88ff 0%, #7c4dff 30%, #5e35b1 100%)",
            border: "#5e35b1",
          },
        };
      default:
        return {
          icon: "?",
          isImage: false,
          name: "Unknown",
          colors: {
            ready:
              "linear-gradient(135deg, #6c757d 0%, #495057 30%, #343a40 100%)",
            border: "#343a40",
          },
        };
    }
  };

  const powerUpInfo = getPowerUpInfo(activePowerUp);

  // Determine if this power-up is on cooldown
  const isOnCooldown = () => {
    switch (activePowerUp) {
      case "snowball":
        return snowballCooldown;
      case "pumo_army":
        return pumoArmyCooldown;
      default:
        return false; // Passive power-ups don't have cooldowns
    }
  };

  const isUsablePowerUp =
    activePowerUp === "snowball" || activePowerUp === "pumo_army";

  return (
    <div
      className={`power-up-container ${index === 0 ? "player1" : "player2"}`}
    >
      <div
        className={`power-up-icon ${isOnCooldown() ? "cooldown" : "ready"}`}
        style={{
          background: isOnCooldown()
            ? "linear-gradient(135deg, #9ca3af 0%, #6b7280 30%, #4a5568 100%)"
            : powerUpInfo.colors.ready,
          borderColor: isOnCooldown() ? "#374151" : powerUpInfo.colors.border,
        }}
      >
        {powerUpInfo.isImage ? (
          <img
            src={powerUpInfo.icon}
            alt={powerUpInfo.name}
            className={`power-up-image ${
              activePowerUp === "pumo_army" ? "mirrored" : ""
            }`}
          />
        ) : (
          <span className="power-up-emoji">{powerUpInfo.icon}</span>
        )}

        {/* Show indicator for passive power-ups */}
        {!isUsablePowerUp && <div className="passive-indicator">PASSIVE</div>}

        {/* Show F key indicator for usable power-ups */}
        {isUsablePowerUp && <div className="f-key-indicator">F</div>}
      </div>
    </div>
  );
};

PowerUpUI.propTypes = {
  activePowerUp: PropTypes.string,
  snowballCooldown: PropTypes.bool,
  pumoArmyCooldown: PropTypes.bool,
  index: PropTypes.number.isRequired,
};

export default PowerUpUI;
