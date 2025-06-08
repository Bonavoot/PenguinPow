import PropTypes from "prop-types";
import "./SnowballChargeUI.css";
import snowballImage from "../assets/snowball.png";

const SnowballChargeUI = ({ snowballCooldown, index }) => {
  return (
    <div
      className={`snowball-container ${index === 0 ? "player1" : "player2"}`}
    >
      <div
        className={`snowball-icon ${snowballCooldown ? "cooldown" : "ready"}`}
      >
        <img src={snowballImage} alt="Snowball" className="snowball-image" />
      </div>
    </div>
  );
};

SnowballChargeUI.propTypes = {
  snowballCooldown: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
};

export default SnowballChargeUI;
