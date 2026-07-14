import PropTypes from "prop-types";
import "./PowerUpUI.css";
import snowballImage from "../assets/snowball.png";
import powerWaterIcon from "../assets/power-water.png";
import pumoArmyIcon from "./pumo-army-icon.png";
import happyFeetIcon from "../assets/happy-feet.png";
import flapIcon from "../assets/flap-icon.png";
import shatterPalmIcon from "../assets/shatter-palm-icon.png";

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
              "linear-gradient(135deg, #ffd0e0 0%, #ff5087 30%, #a01f4a 100%)",
            border: "#a01f4a",
          },
        };
      case "flap":
        return {
          icon: flapIcon,
          isImage: true,
          name: "Flap",
          colors: {
            ready:
              "linear-gradient(135deg, #c8fff4 0%, #34e0c0 30%, #15705f 100%)",
            border: "#15705f",
          },
        };
      case "shatter_palm":
        return {
          icon: shatterPalmIcon,
          isImage: true,
          name: "Shatter Palm",
          colors: {
            ready:
              "linear-gradient(135deg, #fff9c4 0%, #ffe566 30%, #ffd024 100%)",
            border: "#c99200",
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
