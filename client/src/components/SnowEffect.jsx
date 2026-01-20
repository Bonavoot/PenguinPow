import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import envelope from "../assets/envelope.png";

const GROUND_LEVEL = 650; // Main ground level constant
const DEPTH_LEVELS = [
  { level: GROUND_LEVEL - 300, probability: 0.2 }, // Far background snow
  { level: GROUND_LEVEL - 150, probability: 0.3 }, // Mid background snow
  { level: GROUND_LEVEL, probability: 0.5 }, // Foreground snow
];

// Performance settings - OPTIMIZED
const MAX_SNOWFLAKES = 8; // Reduced from 15 for better performance
const MAX_ENVELOPES = 15; // Slightly more envelopes for a fuller effect
const UPDATE_INTERVAL = 24; // Smoother updates (40fps) for paper-like motion
const USE_BLUR = false; // Keep disabled for performance

const SnowContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
  perspective: 1000px;
`;

const Snowflake = styled.div.attrs((props) => ({
  style: {
    // Use transform3d with 3D rotations for paper-like tumbling effect
    transform: props.$isEnvelope
      ? `translate3d(${props.$x}px, ${props.$y}px, 0) 
         scale(${props.$scale}) 
         rotateZ(${props.$rotation}deg) 
         rotateX(${props.$tiltX || 0}deg) 
         rotateY(${props.$tiltY || 0}deg)`
      : `translate3d(${props.$x}px, ${props.$y}px, 0) scale(${props.$scale}) rotate(${props.$rotation}deg)`,
    opacity: props.$opacity,
  },
}))`
  position: absolute;
  width: ${(props) => (props.$isEnvelope ? "clamp(1.5rem, 3vw, 3rem)" : "6px")};
  height: ${(props) =>
    props.$isEnvelope ? "clamp(2.25rem, 4.5vw, 4.5rem)" : "6px"};
  background: ${(props) =>
    props.$isEnvelope
      ? `url(${envelope}) no-repeat center center`
      : `radial-gradient(
        circle at center,
        rgba(255, 255, 255, 0.8) 0%,
        rgba(255, 255, 255, 0) 70%
      )`};
  background-size: contain;
  border-radius: ${(props) => (props.$isEnvelope ? "0" : "50%")};
  will-change: transform, opacity;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  /* Removed box-shadow for better performance */
`;

const SnowEffect = ({ mode = "snow", winner = null, playerIndex = null }) => {
  const [particles, setParticles] = useState([]);
  const lastUpdateTime = useRef(0);
  const animationFrameRef = useRef(null);
  const isLowPerformance = useRef(false);

  // Determine if this player should show envelopes
  const shouldShowEnvelopes =
    mode === "envelope" &&
    winner &&
    ((winner.fighter === "player 1" && playerIndex === 0) ||
      (winner.fighter === "player 2" && playerIndex === 1));

  // Simplified performance check
  useEffect(() => {
    const checkPerformance = () => {
      const fps = 1000 / (performance.now() - lastUpdateTime.current);
      isLowPerformance.current = fps < 20; // Lower threshold
    };

    const performanceCheckInterval = setInterval(checkPerformance, 2000); // Check less frequently
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

      // For envelopes: create more natural paper-like motion parameters
      const baseSpeed = isEnvelope ? 0.8 + Math.random() * 0.6 : 1 + Math.random() * 2;

      return {
        id: Math.random(),
        x: Math.random() * window.innerWidth,
        y: initialY,
        velocityX: (Math.random() - 0.5) * (isEnvelope ? 1.5 : 0.5),
        velocityY: baseSpeed,
        baseVelocityY: baseSpeed, // Store base speed for flutter variation
        opacity: isEnvelope ? 0.85 + Math.random() * 0.15 : 0.5 + Math.random() * 0.5,
        scale: isEnvelope ? 0.85 + Math.random() * 0.3 : 0.5 + Math.random() * 1,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * (isEnvelope ? 1.5 : 1), // Gentler rotation
        depthLevel,
        isEnvelope,
        // Paper flutter physics - compound waves for organic movement
        swayPhase: Math.random() * Math.PI * 2,
        swayPhase2: Math.random() * Math.PI * 2, // Secondary wave for complexity
        swayAmplitude: isEnvelope ? 0.8 + Math.random() * 0.6 : 0,
        swayFrequency: isEnvelope ? 1.2 + Math.random() * 0.5 : 0,
        // 3D tilt for paper tumbling effect
        tiltX: isEnvelope ? (Math.random() - 0.5) * 30 : 0,
        tiltY: isEnvelope ? (Math.random() - 0.5) * 20 : 0,
        tiltPhase: Math.random() * Math.PI * 2,
        tiltSpeed: isEnvelope ? 0.3 + Math.random() * 0.4 : 0,
        // Direction of drift (-1 or 1) for consistent side movement
        driftDirection: Math.random() > 0.5 ? 1 : -1,
      };
    },
    [getRandomDepthLevel, shouldShowEnvelopes]
  );

  const updateParticle = useCallback(
    (particle, deltaTime) => {
      const timeFactor = deltaTime / 16;
      const time = performance.now() / 1000;

      let newVelocityY = particle.velocityY;
      let swayX = 0;
      let newTiltX = particle.tiltX;
      let newTiltY = particle.tiltY;

      if (particle.isEnvelope) {
        // Compound sine waves create organic paper-like sway
        // Primary wave - main side-to-side motion
        const primarySway =
          Math.sin(time * particle.swayFrequency + particle.swayPhase) *
          particle.swayAmplitude;
        // Secondary wave - adds irregularity (different frequency)
        const secondarySway =
          Math.sin(time * particle.swayFrequency * 0.7 + particle.swayPhase2) *
          particle.swayAmplitude *
          0.3;
        swayX = primarySway + secondarySway;

        // Variable fall speed - paper catches air and slows/speeds up
        // Speed varies based on tilt angle (more horizontal = more air resistance)
        const tiltFactor = Math.cos(time * particle.tiltSpeed + particle.tiltPhase);
        const airResistance = 0.85 + tiltFactor * 0.15; // 0.7 to 1.0
        newVelocityY = particle.baseVelocityY * airResistance;

        // 3D tumbling effect - smooth oscillating tilt
        newTiltX = Math.sin(time * particle.tiltSpeed + particle.tiltPhase) * 25;
        newTiltY =
          Math.cos(time * particle.tiltSpeed * 0.8 + particle.tiltPhase) * 15 +
          swayX * 8; // Tilt correlates with sway direction
      }

      const newY = particle.y + newVelocityY * timeFactor;
      const newX =
        particle.x +
        particle.velocityX * timeFactor +
        swayX +
        (particle.isEnvelope ? particle.driftDirection * 0.15 : 0); // Gentle consistent drift

      if (newY >= particle.depthLevel) {
        return createParticle();
      }

      let finalX = newX;
      if (newX < -30) finalX = window.innerWidth + 30;
      if (newX > window.innerWidth + 30) finalX = -30;

      // Smooth rotation - correlate with horizontal movement for realism
      const rotationInfluence = particle.isEnvelope ? swayX * 0.5 : 0;
      const newRotation =
        particle.rotation + particle.rotationSpeed + rotationInfluence;

      return {
        ...particle,
        x: finalX,
        y: newY,
        rotation: newRotation,
        velocityX: particle.velocityX * 0.995, // Very gentle decay
        velocityY: newVelocityY,
        tiltX: newTiltX,
        tiltY: newTiltY,
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
            ? Math.max(1, maxParticles / 3) // More aggressive reduction
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
          $rotation={particle.rotation}
          $tiltX={particle.tiltX}
          $tiltY={particle.tiltY}
          $isEnvelope={particle.isEnvelope}
        />
      ))}
    </SnowContainer>
  );
};

export default SnowEffect;
