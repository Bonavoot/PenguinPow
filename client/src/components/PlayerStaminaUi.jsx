import PropTypes from "prop-types";
import "./PlayerStaminaUi.css";

const PlayerStaminaUi = ({ stamina, index }) => {
  return (
    <div>
      <div className="ui-player-container" id={`ui-container-${index + 1}`}>
        <div className="ui-player-stamina-container">
          <div
            className="ui-player-stamina-red"
            style={{
              width: `${stamina}%`,
              transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              background: `linear-gradient(90deg, 
                ${stamina <= 25 ? "#ff4d4d" : "#ffd700"} 0%,
                ${stamina <= 25 ? "#ff8080" : "#ffe066"} 100%)`,
              boxShadow: `0 0 10px ${stamina <= 25 ? "#ff4d4d" : "#ffd700"}`,
            }}
          >
            {stamina > 90 && (
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
              width: `${stamina}%`,
              background: `linear-gradient(90deg, 
                ${stamina <= 25 ? "#ff4d4d" : "#ffd700"} 0%,
                ${stamina <= 25 ? "#ff8080" : "#ffe066"} 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

PlayerStaminaUi.propTypes = {
  stamina: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
};

export default PlayerStaminaUi;
