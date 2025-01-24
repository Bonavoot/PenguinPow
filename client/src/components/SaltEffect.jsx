import { useState, useEffect, useCallback } from "react";
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
  transition: transform 16ms linear, opacity 300ms linear;
`;

const SaltEffect = ({ isActive, playerFacing, playerX, playerY }) => {
  const [particles, setParticles] = useState([]);

  const updateParticle = useCallback((particle) => {
    const gravity = 0.3;
    const drag = 0.99;

    return {
      ...particle,
      x: particle.x + particle.velocityX,
      y: particle.y + particle.velocityY,
      velocityX: particle.velocityX * drag,
      velocityY: particle.velocityY * drag - gravity,
      opacity: Math.max(0, particle.opacity - 0.02),
      life: particle.life - 16,
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      const baseAngle = playerFacing === 1 ? 135 : 40;
      const windowWidth = window.innerWidth;
      const maxWidth = 1280;
      const velocityScale = Math.min(windowWidth / maxWidth, 1);

      const newParticles = Array.from({ length: 20 }, () => {
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
    const intervalId = setInterval(() => {
      setParticles((prevParticles) =>
        prevParticles
          .map(updateParticle)
          .filter((particle) => particle.life > 0 && particle.opacity > 0)
      );
    }, 16);

    return () => clearInterval(intervalId);
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
