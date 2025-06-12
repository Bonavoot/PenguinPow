import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import chargedAttackSmokeGif from "../assets/charged-attack-smoke.gif";

const GIF_DURATION = 850; // ms

const SmokeContainer = styled.div.attrs((props) => {
  // Offset: adjust based on facing direction (matching DodgeDustEffect approach)
  let offset = 0;
  if (props.$facing === 1) {
    offset = 20; // Keep existing offset values that work for this effect
  } else {
    offset = 3;
  }

  return {
    style: {
      position: "absolute",
      left: `calc(${(props.$x / 1280) * 100}% + ${offset}%)`,
      bottom: `calc(${(props.$y / 720) * 100}% - 4.5%)`, // Lower the effect while maintaining scaling
      pointerEvents: "none",
      width: "clamp(192px, 33vw, 426px)",
      height: "auto",
      transform: `translateX(-50%) scaleX(${props.$facing === 1 ? 1 : -1})`,
      opacity: 0.8,
      zIndex: 1000,
      filter: "brightness(0) invert(1)",
    },
  };
})``;

const ChargedAttackSmokeEffect = ({
  x,
  y,
  isChargingAttack,
  facing,
  isSlapAttack,
  isThrowing,
}) => {
  const [smokeInstances, setSmokeInstances] = useState([]);
  const lastChargingState = useRef(isChargingAttack);

  useEffect(() => {
    // Only show smoke when charging stops (attack is released), it's not a slap attack, and not throwing
    if (
      !isChargingAttack &&
      lastChargingState.current &&
      !isSlapAttack &&
      !isThrowing
    ) {
      // Add new smoke instance to existing array instead of replacing it
      const newSmokeInstance = {
        x,
        y,
        facing,
        key: Date.now() + Math.random(),
      };
      setSmokeInstances((prev) => [...prev, newSmokeInstance]);

      // Set up individual cleanup timer for this specific instance
      setTimeout(() => {
        setSmokeInstances((prev) =>
          prev.filter((smoke) => smoke.key !== newSmokeInstance.key)
        );
      }, GIF_DURATION);
    }
    lastChargingState.current = isChargingAttack;
  }, [isChargingAttack, isSlapAttack, isThrowing, x, y, facing]);

  if (smokeInstances.length === 0) return null;
  return (
    <>
      {smokeInstances.map((smoke) => (
        <SmokeContainer
          $x={smoke.x}
          $y={smoke.y}
          $facing={smoke.facing}
          key={smoke.key}
        >
          <img
            src={chargedAttackSmokeGif}
            alt="Charged Attack Smoke Effect"
            style={{
              width: "clamp(192px, 33vw, 426px)",
              height: "auto",
              display: "block",
              zIndex: 1000,
            }}
            draggable={false}
          />
        </SmokeContainer>
      ))}
    </>
  );
};

ChargedAttackSmokeEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  isChargingAttack: PropTypes.bool.isRequired,
  facing: PropTypes.number.isRequired,
  isSlapAttack: PropTypes.bool.isRequired,
  isThrowing: PropTypes.bool.isRequired,
};

export default ChargedAttackSmokeEffect;
