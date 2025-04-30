import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

const GROUND_LEVEL = 257; // Match the server's GROUND_LEVEL

const DustContainer = styled.div.attrs((props) => ({
  style: {
    position: "absolute",
    left: `${(props.$x / 1280) * 100}%`,
    bottom: `${(props.$y / 720) * 100}%`,
    transform: `translateX(${props.$facing === -1 ? "12%" : "9%"})`,
  },
}))`
  width: 30%;
  height: 8%;
  pointer-events: none;
  z-index: 1;
`;

const DustParticle = styled.div.attrs((props) => ({
  style: {
    transform: `translate(${props.$x}px, ${-props.$y}px) scale(${
      props.$scale
    })`,
    opacity: props.$opacity,
    filter: `blur(${props.$blur}px)`,
  },
}))`
  position: absolute;
  width: calc(0.8vw * (16 / 9));
  height: calc(0.8vh * (16 / 9));
  background: radial-gradient(
    circle at center,
    rgba(210, 180, 140, 0.6) 0%,
    rgba(210, 180, 140, 0) 70%
  );
  border-radius: 50%;
  will-change: transform, opacity;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  box-shadow: 0 0 8px rgba(210, 180, 140, 0.4);
`;

const DodgeDustEffect = ({ x, y, facing, isDodging, dodgeDirection }) => {
  const [particles, setParticles] = useState([]);
  const animationRef = useRef(null);
  const lastDodgeState = useRef(isDodging);

  useEffect(() => {
    // If dodge just ended, clear particles
    if (!isDodging && lastDodgeState.current) {
      setParticles([]);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    // If dodge just started, create new particles
    if (isDodging) {
      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Calculate offset based on facing and dodge direction
      const isForwardDodge =
        (facing === 1 && dodgeDirection === -1) ||
        (facing === -1 && dodgeDirection === 1);
      const xOffset = isForwardDodge ? 25 : -25;

      // Create initial dust particles with more varied properties
      const newParticles = Array.from({ length: 15 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5;
        const distance = 15 + Math.random() * 30;

        return {
          id: Math.random(),
          x: Math.cos(angle) * distance + xOffset,
          y: Math.sin(angle) * distance - 20,
          scale: 1 + Math.random() * 1.5,
          opacity: 0.6 + Math.random() * 0.4,
          blur: 1 + Math.random() * 2,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed,
          life: 1000 + Math.random() * 500,
        };
      });

      setParticles(newParticles);

      // Animate particles
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;

        setParticles((prev) =>
          prev
            .map((particle) => {
              const progress = elapsed / particle.life;
              if (progress >= 1) return null;

              // Calculate new position
              const newX = particle.x + particle.velocityX;
              const newY = particle.y + particle.velocityY;

              // Ensure particle doesn't go below GROUND_LEVEL
              const maxY = y - GROUND_LEVEL;
              const clampedY = Math.max(newY, maxY);

              return {
                ...particle,
                x: newX,
                y: clampedY,
                opacity: particle.opacity * (1 - progress),
                scale: particle.scale * (1 - progress * 0.5),
              };
            })
            .filter(Boolean)
        );

        if (elapsed < 1500) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setParticles([]);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }

    lastDodgeState.current = isDodging;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDodging, y, facing, dodgeDirection]);

  if (particles.length === 0) return null;

  return (
    <DustContainer $x={x} $y={y} $facing={facing}>
      {particles.map((particle) => (
        <DustParticle
          key={particle.id}
          $x={particle.x}
          $y={particle.y}
          $opacity={particle.opacity}
          $scale={particle.scale}
          $blur={particle.blur}
        />
      ))}
    </DustContainer>
  );
};

DodgeDustEffect.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isDodging: PropTypes.bool.isRequired,
  dodgeDirection: PropTypes.number.isRequired,
};

export default DodgeDustEffect;
