import PropTypes from "prop-types";
import "./PumoArmyChargeUI.css";
import pumoArmyIcon from "./pumo-army-icon.png";

const PumoArmyChargeUI = ({ pumoArmyCooldown, index }) => {
  return (
    <div
      className={`pumo-army-container ${index === 0 ? "player1" : "player2"}`}
    >
      <div
        className={`pumo-army-icon ${pumoArmyCooldown ? "cooldown" : "ready"}`}
      >
        <img src={pumoArmyIcon} alt="Pumo Army" className="pumo-army-image" />
      </div>
    </div>
  );
};

PumoArmyChargeUI.propTypes = {
  pumoArmyCooldown: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
};

export default PumoArmyChargeUI;
