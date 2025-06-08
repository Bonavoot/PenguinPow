import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

const SaltContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    width: "23%",
    height: "auto",
    pointerEvents: "none",
    zIndex: 999,
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    transform: `scaleX(${props.$facing})`,
  },
}))``;

const SaltParticle = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    width: "calc(0.4vw * (16 / 9))",
    height: "calc(0.4vh * (16 / 9))",
    background:
      "radial-gradient(circle at center, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 70%)",
    borderRadius: "50%",
    willChange: "transform, opacity",
    transformStyle: "preserve-3d",
    backfaceVisibility: "hidden",
    boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)",
    transform: `translate(${props.$x}px, ${-props.$y}px) scale(${
      props.$scale
    })`,
    opacity: props.$opacity,
    filter: `blur(${props.$blur}px)`,
  },
}))``;

const SaltEffect = ({
  isActive,
  playerFacing,
  playerX,
  playerY,
  xOffset = 0,
  yOffset = 0,
}) => {
  const [particles, setParticles] = useState([]);
  const lastActiveState = useRef(false);
  const lastUpdateTime = useRef(null);
  const animationFrameRef = useRef(null);
  const containerRef = useRef(null);

  const updateParticle = useCallback((particle, deltaTime) => {
    // Apply gravity to velocityY (negative Y makes particles fall down since we use bottom positioning)
    const gravity = -0.5; // Negative gravity since bottom-referenced positioning
    const newVelocityY = particle.velocityY + gravity * (deltaTime / 16);

    const newX = particle.x + particle.velocityX * (deltaTime / 16);
    const newY = particle.y + newVelocityY * (deltaTime / 16);
    const newOpacity = particle.opacity - deltaTime / particle.life;
    const newScale = particle.scale * 0.99;
    const newBlur = particle.blur + 0.1;

    return {
      ...particle,
      x: newX,
      y: newY,
      velocityY: newVelocityY, // Store the updated velocity for next frame
      opacity: newOpacity,
      scale: newScale,
      blur: newBlur,
      life: particle.life - deltaTime,
    };
  }, []);

  useEffect(() => {
    // Only generate particles when isActive changes from false to true
    if (isActive && !lastActiveState.current) {
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
          x:
            ((playerX + xOffset + (playerFacing === 1 ? -20 : 1000)) / 1280) *
            100,
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
    lastActiveState.current = isActive;
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
