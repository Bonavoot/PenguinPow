import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";

const SaltContainer = styled.div.attrs((props) => ({
  style: {
    left: `${(props.x / 1280) * 100}%`,
    bottom: `${(props.y / 720) * 100}%`,
    transform: `scaleX(${props.facing})`,
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
    transform: `translate(${props.x}px, ${-props.y}px)`,
    opacity: props.opacity,
  },
}))`
  position: absolute;
  width: calc(0.3vw * (16 / 9)); // Scale width based on 16:9 aspect ratio
  height: calc(0.3vh * (16 / 9)); // Scale height based on 16:9 aspect ratio
  background-color: white;
  border-radius: 50%;
  will-change: transform, opacity;
  transform-style: preserve-3d;
  backface-visibility: hidden;
`;

const SaltEffect = ({ isActive, playerFacing, playerX, playerY }) => {
  const [particles, setParticles] = useState([]);
  const animationFrameRef = useRef();
  const lastUpdateTime = useRef(0);

  const updateParticle = useCallback((particle, deltaTime) => {
    const gravity = 0.3;
    const drag = 0.99;
    const timeFactor = deltaTime / 16; // Normalize to 16ms frame time

    return {
      ...particle,
      x: particle.x + particle.velocityX * timeFactor,
      y: particle.y + particle.velocityY * timeFactor,
      velocityX: particle.velocityX * Math.pow(drag, timeFactor),
      velocityY:
        particle.velocityY * Math.pow(drag, timeFactor) - gravity * timeFactor,
      opacity: Math.max(0, particle.opacity - 0.02 * timeFactor),
      life: particle.life - deltaTime,
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      const baseAngle = playerFacing === 1 ? 135 : 40;
      const windowWidth = window.innerWidth;
      const maxWidth = 1280;
      const velocityScale = Math.min(windowWidth / maxWidth, 1);

      // Reduce particle count to 12 for better performance
      const newParticles = Array.from({ length: 12 }, () => {
        const angle = (baseAngle + (Math.random() * 60 - 30)) * (Math.PI / 180);
        const baseSpeed = 10 + Math.random() * 5;
        const speed = baseSpeed * velocityScale;

        return {
          id: Math.random(),
          x: (1050 / 1280) * 100,
          y: (1000 / 720) * 100,
          velocityX: Math.cos(angle) * speed * (playerFacing === 1 ? 1 : -1),
          velocityY: Math.sin(angle) * speed,
          opacity: 1,
          life: 1000,
        };
      });

      setParticles((prev) => [...prev, ...newParticles]);
    }
  }, [isActive, playerFacing]);

  useEffect(() => {
    const animate = (timestamp) => {
      if (!lastUpdateTime.current) {
        lastUpdateTime.current = timestamp;
      }

      const deltaTime = timestamp - lastUpdateTime.current;

      if (deltaTime >= 16) {
        // Cap at 60fps
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
    <SaltContainer x={playerX} y={playerY} facing={playerFacing}>
      {particles.map((particle) => (
        <SaltParticle
          key={particle.id}
          x={particle.x}
          y={particle.y}
          opacity={particle.opacity}
        />
      ))}
    </SaltContainer>
  );
};

export default SaltEffect;
