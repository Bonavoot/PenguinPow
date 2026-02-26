import { useEffect, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./SlapParryEffect.css";

const ParryEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100 + 4}%`,
    transform: "translate(-50%, 50%)",
    zIndex: 100,
    pointerEvents: "none",
  },
}))``;

const SlapParryEffect = ({ position }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (position) {
      setShowEffect(true);
      const tid = setTimeout(() => setShowEffect(false), 400);
      return () => clearTimeout(tid);
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
