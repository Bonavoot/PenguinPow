import PropTypes from "prop-types";
import "./SnowballChargeUI.css";

const SnowballChargeUI = ({ snowballCooldown, index }) => {
  return (
    <div className={`snowball-container ${index === 0 ? "player1" : "player2"}`}>
      <div
        className={`snowball-icon ${snowballCooldown ? "cooldown" : "ready"}`}
      >
        ❄️
      </div>
    </div>
  );
};

SnowballChargeUI.propTypes = {
  snowballCooldown: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
};

export default SnowballChargeUI; 