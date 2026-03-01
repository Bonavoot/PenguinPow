import PropTypes from "prop-types";
import "./DodgeChargeUI.css";

const DashChargeUI = ({ dodgeCharges, dodgeChargeCooldowns, index }) => {
  const currentTime = Date.now();

  return (
    <div className={`charge-container ${index === 0 ? "player1" : "player2"}`}>
      {[0, 1].map((chargeIndex) => {
        const cooldownEndTime = dodgeChargeCooldowns[chargeIndex];
        const isOnCooldown = cooldownEndTime > currentTime;
        const isActive = chargeIndex < dodgeCharges;

        return (
          <div
            key={chargeIndex}
            className={`charge-icon ${isOnCooldown ? "cooldown" : ""}`}
            style={{
              "--cooldown-progress": isOnCooldown
                ? (currentTime - (cooldownEndTime - 2000)) / 2000
                : 0,
            }}
          />
        );
      })}
    </div>
  );
};

DashChargeUI.propTypes = {
  dodgeCharges: PropTypes.number.isRequired,
  dodgeChargeCooldowns: PropTypes.arrayOf(PropTypes.number).isRequired,
  index: PropTypes.number.isRequired,
};

export default DashChargeUI;
