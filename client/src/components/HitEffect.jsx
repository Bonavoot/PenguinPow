import { useEffect, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";
import hitEffectImage from "../assets/hit-effect.png";

const HitEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100 - 6}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 100,
    pointerEvents: "none",
  },
}))``;

const HitImage = styled.img`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(25deg);
  width: 150%;
  height: 150%;
  object-fit: contain;
  opacity: 0;
  z-index: 10;
  animation: imageFlash 0.25s ease-out forwards;

  @keyframes imageFlash {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(25deg) scale(0.8);
    }
    30% {
      opacity: 1;
      transform: translate(-50%, -50%) rotate(25deg) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(25deg) scale(1.2);
    }
  }
`;

const HitEffect = ({ position }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (position) {
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 250);
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
      >
        <HitImage 
          src={hitEffectImage} 
          alt="Hit effect" 
          style={{ 
            transform: position.facing === 1 ? "scaleX(-1)" : "scaleX(1)" 
          }}
        />
      </div>
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
