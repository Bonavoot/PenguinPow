import { useEffect, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";

const HitEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100 - 4}%`, // Lower the effect by 4% of screen height
    transform: "translate(-50%, -50%)",
    zIndex: 100,
    pointerEvents: "none",
  },
}))``;

const HitEffect = ({ position }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (position) {
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 300);
    }
  }, [position]);

  if (!showEffect || !position) return null;

  return (
    <HitEffectContainer $x={position.x} $y={position.y}>
      <div 
        className="hit-ring" 
        style={{ 
          transform: position.facing === 1 ? "scaleX(-1)" : "scaleX(1)" 
        }}
      ></div>
    </HitEffectContainer>
  );
};

HitEffect.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    facing: PropTypes.number,
  }),
};

export default HitEffect;
