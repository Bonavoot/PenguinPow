import PropTypes from "prop-types";
import "./PlayerStaminaUi.css";
import DodgeChargeUI from "./DodgeChargeUI";
import PowerUpUI from "./PowerUpUI";

const PlayerStaminaUi = ({
  stamina,
  index,
  dodgeCharges,
  dodgeChargeCooldowns,
  activePowerUp,
  snowballCooldown,
  pumoArmyCooldown,
}) => {
  const staminaValue = typeof stamina === "object" ? stamina.stamina : stamina;

  return (
    <div>
      <div className="ui-player-container" id={`ui-container-${index + 1}`}>
        <PowerUpUI
          activePowerUp={activePowerUp}
          snowballCooldown={snowballCooldown}
          pumoArmyCooldown={pumoArmyCooldown}
          index={index}
        />
        <DodgeChargeUI
          dodgeCharges={dodgeCharges}
          dodgeChargeCooldowns={dodgeChargeCooldowns}
          index={index}
        />
        <div className="ui-player-stamina-container">
          <div
            className="ui-player-stamina-red"
            style={{
              width: `${staminaValue}%`,
              transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              background: `linear-gradient(90deg, 
                ${staminaValue <= 25 ? "#ff4d4d" : "#ffd700"} 0%,
                ${staminaValue <= 25 ? "#ff8080" : "#ffe066"} 100%)`,
              boxShadow: `0 0 10px ${
                staminaValue <= 25 ? "#ff4d4d" : "#ffd700"
              }`,
            }}
          >
            {staminaValue > 90 && (
              <div className="stamina-particles">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="particle"
                    style={{
                      animationDelay: `${i * 0.2}s`,
                      left: `${Math.random() * 100}%`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div
            className="ui-player-stamina-yellow"
            style={{
              width: `${staminaValue}%`,
              background: `linear-gradient(90deg, 
                ${staminaValue <= 25 ? "#ff4d4d" : "#ffd700"} 0%,
                ${staminaValue <= 25 ? "#ff8080" : "#ffe066"} 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

PlayerStaminaUi.propTypes = {
  stamina: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.shape({
      stamina: PropTypes.number.isRequired,
    }),
  ]).isRequired,
  index: PropTypes.number.isRequired,
  dodgeCharges: PropTypes.number,
  dodgeChargeCooldowns: PropTypes.arrayOf(PropTypes.number),
  activePowerUp: PropTypes.string,
  snowballCooldown: PropTypes.bool,
  pumoArmyCooldown: PropTypes.bool,
};

export default PlayerStaminaUi;
