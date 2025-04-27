import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

const SaltContainer = styled.div.attrs((props) => ({
  style: {
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    transform: `scaleX(${props.$facing})`,
  },
}))`
  position: absolute;
  width: 23%;
  height: auto;
  pointer-events: none;
  z-index: 999; // Increase this to be above characters
`;

const SaltParticle = styled.div.attrs((props) => ({
  style: {
    transform: `translate(${props.$x}px, ${-props.$y}px) scale(${
      props.$scale
    })`,
    opacity: props.$opacity,
    filter: `blur(${props.$blur}px)`,
  },
}))`
  position: absolute;
  width: calc(0.4vw * (16 / 9));
  height: calc(0.4vh * (16 / 9));
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 255, 255, 0) 70%
  );
  border-radius: 50%;
  will-change: transform, opacity;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
`;

const SaltEffect = ({
  isActive,
  playerFacing,
  playerX,
  playerY,
  xOffset = 0,
  yOffset = 0,
}) => {
  const [particles, setParticles] = useState([]);
  const animationFrameRef = useRef();
  const lastUpdateTime = useRef(0);
  const containerRef = useRef(null);

  const updateParticle = useCallback((particle, deltaTime) => {
    const gravity = 0.25;
    const drag = 0.98;
    const timeFactor = deltaTime / 16;

    return {
      ...particle,
      x: particle.x + particle.velocityX * timeFactor,
      y: particle.y + particle.velocityY * timeFactor,
      velocityX: particle.velocityX * Math.pow(drag, timeFactor),
      velocityY:
        particle.velocityY * Math.pow(drag, timeFactor) - gravity * timeFactor,
      opacity: Math.max(0, particle.opacity - 0.015 * timeFactor),
      life: particle.life - deltaTime,
      rotation: particle.rotation + particle.rotationSpeed * timeFactor,
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      const baseAngle = playerFacing === 1 ? 135 : 40;
      const windowWidth = window.innerWidth;
      const maxWidth = 1280;
      const velocityScale = Math.min(windowWidth / maxWidth, 1);

      const newParticles = Array.from({ length: 15 }, () => {
        const angle = (baseAngle + (Math.random() * 80 - 40)) * (Math.PI / 180);
        const baseSpeed = 8 + Math.random() * 7;
        const speed = baseSpeed * velocityScale;
        const scale = 0.8 + Math.random() * 0.4;

        return {
          id: Math.random(),
          x: ((playerX + xOffset) / 1280) * 100,
          y: ((playerY + yOffset) / 720) * 100,
          velocityX: Math.cos(angle) * speed * (playerFacing === 1 ? 1 : -1),
          velocityY: Math.sin(angle) * speed,
          opacity: 0.8 + Math.random() * 0.2,
          life: 1200 + Math.random() * 400,
          scale,
          blur: Math.random() * 0.5,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 2,
        };
      });

      setParticles((prev) => [...prev, ...newParticles]);
    }
  }, [isActive, playerFacing, playerX, playerY, xOffset, yOffset]);

  useEffect(() => {
    const animate = (timestamp) => {
      if (!lastUpdateTime.current) {
        lastUpdateTime.current = timestamp;
      }

      const deltaTime = timestamp - lastUpdateTime.current;

      if (deltaTime >= 16) {
        setParticles((prevParticles) => {
          const updatedParticles = prevParticles
            .map((particle) => updateParticle(particle, deltaTime))
            .filter((particle) => particle.life > 0 && particle.opacity > 0);

          return updatedParticles;
        });

        lastUpdateTime.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateParticle]);

  return (
    <SaltContainer
      ref={containerRef}
      $x={playerX}
      $y={playerY}
      $facing={playerFacing}
    >
      {particles.map((particle, index) => (
        <SaltParticle
          key={index}
          $x={particle.x}
          $y={particle.y}
          $opacity={particle.opacity}
          $scale={particle.scale}
          $blur={particle.blur}
        />
      ))}
    </SaltContainer>
  );
};

SaltEffect.propTypes = {
  isActive: PropTypes.bool.isRequired,
  playerFacing: PropTypes.number.isRequired,
  playerX: PropTypes.number.isRequired,
  playerY: PropTypes.number.isRequired,
  xOffset: PropTypes.number,
  yOffset: PropTypes.number,
};

export default SaltEffect;
