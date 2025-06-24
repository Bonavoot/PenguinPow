import { useEffect, useState } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import "./HitEffect.css";
import hitEffectImage from "../assets/hit-effect.png";

const HitEffectContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100 - 2}%`,
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
  width: 120%;
  height: 120%;
  object-fit: contain;
  opacity: 0;
  z-index: 10;
  filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.8));
  animation: imageFlash 0.25s ease-out forwards;

  @keyframes imageFlash {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(20deg) scale(0.7);
      filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.8)) brightness(1.4);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) rotate(25deg) scale(1.0);
      filter: drop-shadow(0 0 10px rgba(255, 215, 0, 1)) brightness(1.6);
    }
    50% {
      opacity: 0.8;
      transform: translate(-50%, -50%) rotate(30deg) scale(1.1);
      filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.6)) brightness(1.2);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(35deg) scale(1.2);
      filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.3)) brightness(1);
    }
  }
`;

const ParticleContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 8;
`;

const Particle = styled.div`
  position: absolute;
  width: 3px;
  height: 3px;
  background: radial-gradient(circle, #FFFF99, #FFD700);
  border-radius: 50%;
  opacity: 0;
`;

const HitEffect = ({ position }) => {
  const [showEffect, setShowEffect] = useState(false);
  const [hitKey, setHitKey] = useState(0);

  useEffect(() => {
    if (position) {
      // Force a new effect every time by incrementing the key
      setHitKey(prev => prev + 1);
      setShowEffect(true);
      
      // Reduced duration to 300ms to prevent overlapping with rapid hits
      setTimeout(() => setShowEffect(false), 300);
    }
  }, [position]);

  if (!showEffect || !position) return null;

  // Generate fewer particles for better performance during rapid hits
  const particles = Array.from({ length: 4 }, (_, i) => (
    <Particle 
      key={`${hitKey}-${i}`} // Use hitKey to ensure unique particles
      className="particle"
      style={{
        top: `${20 + Math.random() * 60}%`,
        left: `${20 + Math.random() * 60}%`,
      }}
    />
  ));

  return (
    <HitEffectContainer $x={position.x} $y={position.y} key={hitKey}>
      <div className="hit-ring-wrapper">
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
              transform: position.facing === 1 
                ? "translate(-50%, -50%) rotate(25deg) scaleX(-1)" 
                : "translate(-50%, -50%) rotate(25deg) scaleX(1)" 
            }}
          />
        </div>
        <ParticleContainer className="hit-particles">
          {particles}
        </ParticleContainer>
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
