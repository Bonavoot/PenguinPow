import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import envelope from "../assets/envelope.png";

const GROUND_LEVEL = 650; // Main ground level constant
const DEPTH_LEVELS = [
  { level: GROUND_LEVEL - 300, probability: 0.2 }, // Far background snow
  { level: GROUND_LEVEL - 150, probability: 0.3 }, // Mid background snow
  { level: GROUND_LEVEL, probability: 0.5 }, // Foreground snow
];

// Performance settings
const MAX_SNOWFLAKES = 15; // Reduced from 100
const MAX_ENVELOPES = 25; // Fewer envelopes than snowflakes for better performance
const UPDATE_INTERVAL = 16; // Update every 16ms for smoother animation
const USE_BLUR = false; // Disable blur effect for better performance

const SnowContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
`;

const Snowflake = styled.div.attrs((props) => ({
  style: {
    transform: `translate(${props.$x}px, ${props.$y}px) scale(${props.$scale}) rotate(${props.$rotation}deg)`,
    opacity: props.$opacity,
    ...(USE_BLUR && { filter: `blur(${props.$blur}px)` }),
  },
}))`
  position: absolute;
  width: ${props => props.$isEnvelope ? 'clamp(1.5rem, 3vw, 3rem)' : '6px'};
  height: ${props => props.$isEnvelope ? 'clamp(2.25rem, 4.5vw, 4.5rem)' : '6px'};
  background: ${props => props.$isEnvelope 
    ? `url(${envelope}) no-repeat center center`
    : `radial-gradient(
        circle at center,
        rgba(255, 255, 255, 0.8) 0%,
        rgba(255, 255, 255, 0) 70%
      )`};
  background-size: contain;
  border-radius: ${props => props.$isEnvelope ? '0' : '50%'};
  will-change: transform, opacity;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  box-shadow: ${props => props.$isEnvelope 
    ? '0 0 8px rgba(255, 255, 255, 0.0)'
    : '0 0 4px rgba(255, 255, 255, 0.3)'};
`;

const SnowEffect = ({ mode = 'snow', winner = null, playerIndex = null }) => {
  const [particles, setParticles] = useState([]);
  const lastUpdateTime = useRef(0);
  const animationFrameRef = useRef(null);
  const isLowPerformance = useRef(false);

  // Determine if this player should show envelopes
  const shouldShowEnvelopes = mode === 'envelope' && winner && 
    ((winner.fighter === 'player 1' && playerIndex === 0) || 
     (winner.fighter === 'player 2' && playerIndex === 1));

  // Check for low performance
  useEffect(() => {
    const checkPerformance = () => {
      const fps = 1000 / (performance.now() - lastUpdateTime.current);
      isLowPerformance.current = fps < 30;
    };

    const performanceCheckInterval = setInterval(checkPerformance, 1000);
    return () => clearInterval(performanceCheckInterval);
  }, []);

  const getRandomDepthLevel = useCallback(() => {
    const random = Math.random();
    let cumulativeProbability = 0;

    for (const { level, probability } of DEPTH_LEVELS) {
      cumulativeProbability += probability;
      if (random <= cumulativeProbability) {
        return level;
      }
    }
    return GROUND_LEVEL;
  }, []);

  const createParticle = useCallback(
    (initialY = -10) => {
      const depthLevel = getRandomDepthLevel();
      const isEnvelope = shouldShowEnvelopes;
      return {
        id: Math.random(),
        x: Math.random() * window.innerWidth,
        y: initialY,
        velocityX: (Math.random() - 0.5) * (isEnvelope ? 0.7 : 0.5),
        velocityY: (isEnvelope ? 1.5 : 1) + Math.random() * (isEnvelope ? 1.8 : 2),
        opacity: 0.5 + Math.random() * 0.5,
        scale: isEnvelope ? 0.8 + Math.random() * 0.4 : 0.5 + Math.random() * 1,
        blur: Math.random() * 0.5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * (isEnvelope ? 4 : 2),
        depthLevel,
        isEnvelope,
      };
    },
    [getRandomDepthLevel, shouldShowEnvelopes]
  );

  const updateParticle = useCallback(
    (particle, deltaTime) => {
      // Add easing to the movement
      const easing = 0.98; // Increased from 0.95 to maintain more momentum
      const newY = particle.y + particle.velocityY * (deltaTime / 16);
      const newX = particle.x + particle.velocityX * (deltaTime / 16);

      if (newY >= particle.depthLevel) {
        return createParticle();
      }

      let finalX = newX;
      if (newX < -10) finalX = window.innerWidth + 10;
      if (newX > window.innerWidth + 10) finalX = -10;

      // Apply easing to rotation
      const targetRotation = particle.rotation + particle.rotationSpeed;
      const easedRotation = particle.rotation + (targetRotation - particle.rotation) * (1 - easing);

      return {
        ...particle,
        x: finalX,
        y: newY,
        rotation: easedRotation,
        // Only apply easing to horizontal movement, keep vertical velocity constant
        velocityX: particle.velocityX * easing,
        velocityY: particle.velocityY,
      };
    },
    [createParticle]
  );

  useEffect(() => {
    // Create initial particles with distributed y-positions
    const maxParticles = shouldShowEnvelopes ? MAX_ENVELOPES : MAX_SNOWFLAKES;
    const initialParticles = Array.from(
      { length: maxParticles },
      (_, index) => {
        // Distribute particles across the top portion of the screen
        const initialY = -10 - index * (window.innerHeight / maxParticles);
        return createParticle(initialY);
      }
    );
    setParticles(initialParticles);

    const animate = (timestamp) => {
      if (!lastUpdateTime.current) {
        lastUpdateTime.current = timestamp;
      }

      const deltaTime = timestamp - lastUpdateTime.current;

      if (deltaTime >= UPDATE_INTERVAL) {
        setParticles((prevParticles) => {
          const updatedParticles = prevParticles
            .map((particle) => updateParticle(particle, deltaTime))
            .filter((particle) => particle.y < particle.depthLevel);

          // Add new particles if needed, but respect performance mode
          const targetCount = isLowPerformance.current
            ? maxParticles / 2
            : maxParticles;
          while (updatedParticles.length < targetCount) {
            updatedParticles.push(createParticle());
          }

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
  }, [createParticle, updateParticle, shouldShowEnvelopes]);

  return (
    <SnowContainer>
      {particles.map((particle) => (
        <Snowflake
          key={particle.id}
          $x={particle.x}
          $y={particle.y}
          $opacity={particle.opacity}
          $scale={particle.scale}
          $blur={particle.blur}
          $rotation={particle.rotation}
          $isEnvelope={particle.isEnvelope}
        />
      ))}
    </SnowContainer>
  );
};

export default SnowEffect;
