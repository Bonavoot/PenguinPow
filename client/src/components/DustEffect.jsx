import { useEffect, useState, useRef, memo } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

// OPTIMIZED: Simplified dust particle - removed complex computed styles
const DustParticle = styled.div`
  position: absolute;
  left: ${props => (props.$x / 1280) * 100}%;
  bottom: ${props => (props.$y / 720) * 100}%;
  width: ${props => (props.$size / 1280) * 100}%;
  height: ${props => (props.$size / 720) * 100}%;
  background-color: rgba(151, 127, 17, 0.7);
  border-radius: 50%;
  animation: dust-rise 0.6s ease-out forwards;
  z-index: 100;
  pointer-events: none;
  contain: layout style;
  
  @keyframes dust-rise {
    0% {
      opacity: 0.8;
      transform: translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-20px) scale(0.5);
    }
  }
`;

const DustEffect = memo(({ playerX, playerY, facing }) => {
  const [particles, setParticles] = useState([]);
  const lastX = useRef(playerX);
  const lastUpdateTime = useRef(Date.now());

  useEffect(() => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastUpdateTime.current;

    // Balanced threshold for responsive dust without spam
    if (timeDiff > 60 && Math.abs(lastX.current - playerX) > 3) {
      setParticles((current) => {
        // Keep max 5 particles for smooth effect
        const newParticles = current.length > 5 ? current.slice(1) : [...current];

        const xOffset = facing === 1 ? 160 : 147;

        newParticles.push({
          id: currentTime,
          x: playerX + xOffset + (Math.random() * -40 - 10),
          y: playerY + 25,
          size: 8 + Math.random() * 4,
        });

        return newParticles;
      });

      lastUpdateTime.current = currentTime;
    }

    lastX.current = playerX;
  }, [playerX, playerY, facing]);

  // OPTIMIZED: Single cleanup effect instead of per-particle
  useEffect(() => {
    if (particles.length === 0) return;
    
    const cleanup = setTimeout(() => {
      setParticles((current) => current.filter((p) => Date.now() - p.id < 600));
    }, 600);

    return () => clearTimeout(cleanup);
  }, [particles.length]);

  return (
    <>
      {particles.map((particle) => (
        <DustParticle
          key={particle.id}
          $x={particle.x}
          $y={particle.y}
          $size={particle.size}
        />
      ))}
    </>
  );
});

DustEffect.displayName = 'DustEffect';

DustEffect.propTypes = {
  playerX: PropTypes.number.isRequired,
  playerY: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
};

export default DustEffect;
