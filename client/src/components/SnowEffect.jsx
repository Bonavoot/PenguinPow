import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import styled from "styled-components";
import envelope from "../assets/envelope.png";

// 3D depth layers - MORE dramatic depth differences
// depth: 0 = very far (back of stadium seats), 1 = very close (front of camera)
const DEPTH_LAYERS = [
  { depth: 0.1, probability: 0.12 },  // Way back in crowd - tiny, very slow
  { depth: 0.25, probability: 0.15 }, // Back of crowd
  { depth: 0.4, probability: 0.18 },  // Middle crowd
  { depth: 0.55, probability: 0.2 },  // Front of crowd / back of dohyo
  { depth: 0.7, probability: 0.15 },  // On the dohyo
  { depth: 0.85, probability: 0.12 }, // Front of dohyo
  { depth: 1.0, probability: 0.08 },  // Very close to camera
];

// Ground level - INVERTED for stadium perspective
// Far seats are HIGH on screen (low Y), dohyo/close is LOW on screen (high Y)
const getGroundLevel = (depth, screenHeight) => {
  // depth 0.1 (far back seats) = lands around Y ~150-200 (top of crowd)
  // depth 0.5 (middle) = lands around Y ~400-450 (middle area)
  // depth 1.0 (very close) = falls off screen Y ~900+
  const minGround = screenHeight * 0.15; // Far back - top of visible crowd
  const maxGround = screenHeight * 1.1;  // Close - below screen
  return minGround + depth * (maxGround - minGround);
};

// Performance settings
const MAX_SNOWFLAKES = 15;
const MAX_ENVELOPES = 25; // More for better coverage
const UPDATE_INTERVAL = 33; // ~30fps

const SnowContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
  contain: layout style paint;
`;

// Use a base size that we scale with depth
const Snowflake = styled.div.attrs((props) => ({
  style: {
    transform: `translate3d(${props.$x}px, ${props.$y}px, 0) scale(${props.$scale}) rotate(${props.$rotation}deg)`,
    opacity: props.$opacity,
  },
}))`
  position: absolute;
  will-change: transform, opacity;
  width: ${(props) => (props.$isEnvelope ? "40px" : "5px")};
  height: ${(props) => (props.$isEnvelope ? "60px" : "5px")};
  background: ${(props) =>
    props.$isEnvelope
      ? `url(${envelope}) no-repeat center center`
      : `rgba(255, 255, 255, 0.9)`};
  background-size: contain;
  border-radius: ${(props) => (props.$isEnvelope ? "0" : "50%")};
  box-shadow: ${(props) => (props.$isEnvelope ? "none" : "0 0 2px 1px rgba(255, 255, 255, 0.25)")};
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

  const getRandomDepth = useCallback(() => {
    const random = Math.random();
    let cumulativeProbability = 0;

    for (const { depth, probability } of DEPTH_LAYERS) {
      cumulativeProbability += probability;
      if (random <= cumulativeProbability) {
        return depth;
      }
    }
    return 0.5;
  }, []);

  const createParticle = useCallback(
    (initialY = -10) => {
      const depth = getRandomDepth();
      const isEnvelope = shouldShowEnvelopes;

      // MUCH more dramatic scale difference based on depth
      // depth 0.1 (very far) -> scale 0.15 (tiny!)
      // depth 1.0 (very close) -> scale 2.0 (huge!)
      const depthScale = isEnvelope
        ? 0.15 + depth * depth * 1.85  // Quadratic for more dramatic close-up
        : 0.3 + depth * 1.0;
      
      // Speed based on depth - MUCH faster for close particles
      // Far particles drift slowly, close ones zoom past
      const baseSpeed = isEnvelope 
        ? (0.3 + depth * depth * 2.5) * (0.85 + Math.random() * 0.3)
        : (0.4 + depth * 2.5) * (0.8 + Math.random() * 0.4);
      
      // Opacity - far particles faded, close ones solid
      // depth 0.1 -> opacity ~0.25, depth 1.0 -> opacity ~1.0
      const depthOpacity = isEnvelope 
        ? 0.2 + depth * 0.75 
        : 0.5 + depth * 0.5; // Snow more visible now
      
      // Horizontal drift - close particles can drift more
      const horizontalDrift = (Math.random() - 0.5) * (0.1 + depth * 0.8);

      // X position distribution
      // Far particles: tighter to center (in the stadium)
      // Close particles: full screen width + overflow
      const screenW = window.innerWidth;
      let xPos;
      if (depth > 0.8) {
        // Very close - can be anywhere, even off edges
        xPos = Math.random() * (screenW + 200) - 100;
      } else if (depth > 0.5) {
        // Medium - mostly full width
        xPos = Math.random() * (screenW + 60) - 30;
      } else {
        // Far - more centered, as if falling in the crowd/stadium
        const center = screenW / 2;
        const spread = screenW * (0.3 + depth * 0.5);
        xPos = center + (Math.random() - 0.5) * spread;
      }

      return {
        id: Math.random(),
        x: xPos,
        y: initialY,
        velocityX: horizontalDrift,
        velocityY: baseSpeed,
        opacity: depthOpacity,
        scale: depthScale,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * (isEnvelope ? 3 : 0.5) * (0.3 + depth),
        depth,
        groundLevel: getGroundLevel(depth, window.innerHeight),
        isEnvelope,
        swayPhase: Math.random() * Math.PI * 2,
        // Closer envelopes sway more dramatically
        swayAmplitude: isEnvelope ? 0.3 + depth * 1.5 : 0,
        swayFrequency: isEnvelope ? 0.6 + Math.random() * 1.0 : 0,
      };
    },
    [getRandomDepth, shouldShowEnvelopes]
  );

  const updateParticle = useCallback(
    (particle, deltaTime) => {
      const timeFactor = deltaTime / 16;
      const time = performance.now() / 1000;

      let swayX = 0;

      if (particle.isEnvelope) {
        // More complex sway for envelopes - flutter effect
        const primarySway = Math.sin(time * particle.swayFrequency + particle.swayPhase) * particle.swayAmplitude;
        const secondarySway = Math.sin(time * particle.swayFrequency * 2.3 + particle.swayPhase) * particle.swayAmplitude * 0.3;
        swayX = primarySway + secondarySway;
      }

      const newY = particle.y + particle.velocityY * timeFactor;
      const newX = particle.x + particle.velocityX * timeFactor + swayX;

      // Check against depth-specific ground level
      if (newY >= particle.groundLevel) {
        return createParticle();
      }

      // Allow particles to wrap around for continuous effect
      let finalX = newX;
      const buffer = 50 + particle.depth * 50; // Larger buffer for close particles
      if (newX < -buffer) finalX = window.innerWidth + buffer;
      if (newX > window.innerWidth + buffer) finalX = -buffer;

      const newRotation = particle.rotation + particle.rotationSpeed * timeFactor;

      return {
        ...particle,
        x: finalX,
        y: newY,
        rotation: newRotation,
      };
    },
    [createParticle]
  );

  useEffect(() => {
    // Create initial particles with distributed y-positions across different depths
    const maxParticles = shouldShowEnvelopes ? MAX_ENVELOPES : MAX_SNOWFLAKES;
    const initialParticles = Array.from(
      { length: maxParticles },
      (_, index) => {
        // Distribute particles vertically - stagger them so they don't all start at once
        const initialY = -10 - Math.random() * window.innerHeight * 0.8;
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
            .filter((particle) => particle.y < particle.groundLevel);

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

  // Memoize sorted particles to avoid re-sorting on every render
  const sortedParticles = useMemo(() => 
    [...particles].sort((a, b) => a.depth - b.depth),
    [particles]
  );

  return (
    <SnowContainer>
      {sortedParticles.map((particle) => (
        <Snowflake
          key={particle.id}
          $x={particle.x}
          $y={particle.y}
          $opacity={particle.opacity}
          $scale={particle.scale}
          $rotation={particle.rotation}
          $isEnvelope={particle.isEnvelope}
        />
      ))}
    </SnowContainer>
  );
};

export default SnowEffect;
