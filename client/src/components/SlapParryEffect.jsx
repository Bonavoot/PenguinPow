import { useEffect, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./SlapParryEffect.css";

const ParryEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100 - 3}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 100,
    pointerEvents: "none",
  },
}))``;

const SlapParryEffect = ({ position }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (position) {
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 400); // Increased duration for better visibility
    }
  }, [position]);

  if (!showEffect || !position) return null;

  return (
    <ParryEffectContainer $x={position.x} $y={position.y}>
      <div className="slap-parry-ring"></div>
    </ParryEffectContainer>
  );
};

SlapParryEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }),
};

export default SlapParryEffect;
